import { addDays, toISODate } from "@/lib/domain/dates";
import { GUEST_LIMITS } from "@/lib/domain/limits";
import { applyPatch, emptySnapshot } from "@/lib/domain/snapshot";
import type { Patch, Snapshot } from "@/lib/domain/types";
import { RepoError, type HistoryPage, type Repo } from "./repo";

export const GUEST_KEY = "dogdzi:guest:v1";
export const GUEST_IMPORTED_PREFIX = "dogdzi:guest:imported:";

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

/** In-memory fallback when browser storage is unavailable (e.g. some private modes). */
export class MemoryKV implements KV {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

export function browserKV(): { kv: KV; persistent: boolean } {
  try {
    const ls = window.localStorage;
    const probe = "dogdzi:probe";
    ls.setItem(probe, "1");
    ls.removeItem(probe);
    return { kv: ls, persistent: true };
  } catch {
    return { kv: new MemoryKV(), persistent: false };
  }
}

export function readGuestSnapshot(kv: KV): Snapshot | null {
  const raw = kv.getItem(GUEST_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Snapshot;
    if (!parsed || !Array.isArray(parsed.actions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasGuestData(s: Snapshot | null): boolean {
  return !!s && (s.actions.length > 0 || s.goals.length > 0);
}

/** Guest storage: everything stays in this browser. Not backed up, not synced. */
export class LocalRepo implements Repo {
  readonly mode = "guest" as const;
  constructor(
    private kv: KV,
    private timezone: string,
    private clock: () => Date = () => new Date(),
  ) {}

  async load(): Promise<Snapshot> {
    const s = readGuestSnapshot(this.kv);
    if (s) return { ...emptySnapshot(this.timezone, this.clock().toISOString()), ...s };
    return emptySnapshot(this.timezone, this.clock().toISOString());
  }

  async commit(patch: Patch): Promise<void> {
    const cur = await this.load();
    try {
      this.kv.setItem(GUEST_KEY, JSON.stringify(applyPatch(cur, patch)));
    } catch {
      throw new RepoError("Your browser's storage is full, so this change couldn't be saved. Create an account to keep everything safely.", false);
    }
  }

  async listHistory({ before, limit = 50 }: { before?: string; limit?: number }): Promise<HistoryPage> {
    const s = await this.load();
    const cutoff = addDays(toISODate(this.clock(), s.preferences.timezone), -GUEST_LIMITS.historyDays);
    const sorted = s.events.slice().sort((a, b) => b.at.localeCompare(a.at));
    const visible = sorted.filter((e) => e.at.slice(0, 10) >= cutoff);
    const page = visible.filter((e) => !before || e.at < before);
    return { events: page.slice(0, limit), hasMore: page.length > limit, limited: visible.length < sorted.length };
  }

  /** Keep a copy of imported guest data on this device, then clear the active guest store. */
  archiveAfterImport(stamp: string) {
    const raw = this.kv.getItem(GUEST_KEY);
    if (raw) {
      try {
        this.kv.setItem(GUEST_IMPORTED_PREFIX + stamp, raw);
      } catch {
        /* storage full: the data is already in the account */
      }
    }
    this.kv.removeItem(GUEST_KEY);
  }
}
