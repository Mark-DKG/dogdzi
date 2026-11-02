import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, toISODate } from "@/lib/domain/dates";
import { emptySnapshot } from "@/lib/domain/snapshot";
import type { Patch, Snapshot } from "@/lib/domain/types";
import { fromRow, prefsFromRows, prefsToRows, TABLES, toRow } from "./mappers";
import { RepoError, type HistoryPage, type Repo } from "./repo";

const PAGE = 1000;
/** Past occurrences loaded up front; older ones are reached through History. */
const LOOKBACK_DAYS = 120;

type Row = Record<string, unknown>;

function fail(context: string, error: { message?: string } | null): never {
  // Don't surface raw database messages to people; keep them in the console for debugging.
  console.error(`[dogdzi] ${context}`, error);
  throw new RepoError("We couldn't reach your account. Check your connection and try again.");
}

/**
 * Account storage in Supabase. Row-level security guarantees every query
 * only sees the signed-in user's rows; `user_id` is still set explicitly on
 * writes and checked by the database.
 */
export class SupabaseRepo implements Repo {
  readonly mode = "account" as const;
  constructor(
    private sb: SupabaseClient,
    private userId: string,
    private timezone: string,
  ) {}

  /** Fetch every row of a table (paged past PostgREST's 1,000-row limit). */
  private async all(table: string, orFilter?: string): Promise<Row[]> {
    const out: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      let q = this.sb.from(table).select("*");
      if (orFilter) q = q.or(orFilter);
      const { data, error } = await q.order("id").range(from, from + PAGE - 1);
      if (error) fail(`load ${table}`, error);
      out.push(...((data as Row[]) ?? []));
      if (!data || data.length < PAGE) break;
    }
    return out;
  }

  async load(): Promise<Snapshot> {
    const now = new Date();
    const since = addDays(toISODate(now, this.timezone), -LOOKBACK_DAYS);
    const [categories, goals, milestones, actions, occurrences, recoveryPlans, events, responses, userPrefs, notifPrefs] = await Promise.all([
      this.all(TABLES.categories),
      this.all(TABLES.goals),
      this.all(TABLES.milestones),
      this.all(TABLES.actions),
      this.all(TABLES.occurrences, `scheduled_date.gte.${since},and(status.eq.missed,resolution.is.null)`),
      this.all(TABLES.recoveryPlans),
      this.sb.from(TABLES.events).select("*").order("created_at", { ascending: false }).limit(300),
      this.sb.from(TABLES.responses).select("*").gte("created_at", `${since}T00:00:00Z`).order("created_at", { ascending: false }).limit(1000),
      this.sb.from("user_preferences").select("*").maybeSingle(),
      this.sb.from("notification_preferences").select("*").maybeSingle(),
    ]);
    if (events.error) fail("load history", events.error);
    if (responses.error) fail("load responses", responses.error);
    if (userPrefs.error) fail("load preferences", userPrefs.error);
    if (notifPrefs.error) fail("load notification preferences", notifPrefs.error);
    const base = emptySnapshot(this.timezone, now.toISOString());
    return {
      categories: categories.map(fromRow.categories),
      goals: goals.map(fromRow.goals),
      milestones: milestones.map(fromRow.milestones),
      actions: actions.map(fromRow.actions),
      occurrences: occurrences.map(fromRow.occurrences),
      recoveryPlans: recoveryPlans.map(fromRow.recoveryPlans),
      events: ((events.data as Row[]) ?? []).map(fromRow.events).reverse(),
      responses: ((responses.data as Row[]) ?? []).map(fromRow.responses).reverse(),
      preferences: prefsFromRows(userPrefs.data as Row | null, notifPrefs.data as Row | null, base.preferences),
    };
  }

  async commit(patch: Patch): Promise<void> {
    const u = this.userId;
    // Parents before children so foreign keys are satisfied.
    const order = ["categories", "goals", "milestones", "actions", "occurrences", "recoveryPlans"] as const;
    for (const key of order) {
      const rows = patch.upsert[key];
      if (!rows?.length) continue;
      const mapped = (rows as never[]).map((r) => (toRow[key] as (x: never, u: string) => Row)(r, u));
      const { error } = await this.sb.from(TABLES[key]).upsert(mapped, { onConflict: "id" });
      if (error) fail(`save ${key}`, error);
    }
    // Append-only tables: insert, ignore exact duplicates (safe retries), never update.
    for (const key of ["events", "responses"] as const) {
      const rows = patch.append[key];
      if (!rows?.length) continue;
      const mapped = (rows as never[]).map((r) => (toRow[key] as (x: never, u: string) => Row)(r, u));
      const { error } = await this.sb.from(TABLES[key]).upsert(mapped, { onConflict: "id", ignoreDuplicates: true });
      if (error) fail(`save ${key}`, error);
    }
    if (patch.preferences) {
      const { user, notif } = prefsToRows(patch.preferences, u);
      if (user) {
        const { error } = await this.sb.from("user_preferences").upsert(user, { onConflict: "user_id" });
        if (error) fail("save preferences", error);
      }
      if (notif) {
        const { error } = await this.sb.from("notification_preferences").upsert(notif, { onConflict: "user_id" });
        if (error) fail("save notification preferences", error);
      }
    }
  }

  async listHistory({ before, limit = 50 }: { before?: string; limit?: number }): Promise<HistoryPage> {
    let q = this.sb.from(TABLES.events).select("*");
    if (before) q = q.lt("created_at", before);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(limit + 1);
    if (error) fail("load history page", error);
    const rows = ((data as Row[]) ?? []).map(fromRow.events);
    return { events: rows.slice(0, limit), hasMore: rows.length > limit, limited: false };
  }

  /** Occurrences for specific ids (history page needs ones outside the loaded window). */
  async occurrencesByIds(ids: string[]) {
    if (!ids.length) return [];
    const { data, error } = await this.sb.from(TABLES.occurrences).select("*").in("id", ids);
    if (error) fail("load occurrences", error);
    return ((data as Row[]) ?? []).map(fromRow.occurrences);
  }
}
