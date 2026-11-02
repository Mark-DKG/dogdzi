/**
 * Static guarantees about the database migration and privacy rules.
 * (Full RLS behaviour should also be verified against a real Supabase
 * project; see README → "Verifying RLS".)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { applyHeartbeat, MAX_GAP_SECONDS, sanitizeProps, scrubUrl } from "../src/lib/analytics/policy";
import { parseRange } from "../src/lib/admin/analytics";

const SQL = readFileSync(new URL("../supabase/migrations/0001_init.sql", import.meta.url), "utf8");
const tables = Array.from(SQL.matchAll(/create table public\.(\w+)/g), (m) => m[1]);

test("every table has row-level security enabled", () => {
  assert.ok(tables.length >= 20);
  for (const t of tables) assert.match(SQL, new RegExp(`alter table public\\.${t}\\s+enable row level security`), `${t} must enable RLS`);
});

test("users get no delete policy on actions, occurrences or history", () => {
  for (const t of ["actions", "occurrences", "action_history", "accountability_responses", "audit_log"]) {
    assert.ok(!new RegExp(`on public\\.${t} for delete`).test(SQL), `${t} must not have a delete policy`);
  }
  assert.match(SQL, /foreach t in array array\['action_history','accountability_responses'\][\s\S]*?for select[\s\S]*?for insert[\s\S]*?end loop/);
});

test("history, responses and the audit log are append-only for every role", () => {
  for (const t of ["action_history", "accountability_responses", "audit_log"]) {
    assert.match(SQL, new RegExp(`before update or delete on public\\.${t}\\s+for each row execute function public\\.prevent_mutation\\(\\)`), `${t} append-only trigger`);
  }
  assert.match(SQL, /occurrences_transition_guard/);
});

test("admin and analytics tables have no client policies", () => {
  for (const t of ["app_sessions", "analytics_events", "admin_users", "admin_permission_grants", "audit_log", "role_permissions"]) {
    assert.ok(!new RegExp(`on public\\.${t} for `).test(SQL), `${t} must only be reachable by the service role`);
  }
  for (const fn of ["admin_analytics", "admin_list_users", "admin_user_overview", "admin_user_activity", "purge_user_data"]) {
    assert.match(SQL, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated`), `${fn} revoked from clients`);
  }
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test("the service-role key never reaches client code", () => {
  const src = new URL("../src", import.meta.url).pathname;
  for (const file of walk(src).filter((f) => /\.tsx?$/.test(f))) {
    const text = readFileSync(file, "utf8");
    if (!/^["']use client["']/.test(text.trimStart())) continue;
    assert.ok(!text.includes("SUPABASE_SERVICE_ROLE_KEY"), `${file} references the service key`);
    assert.ok(!/from ["']@\/lib\/supabase\/server["']/.test(text), `${file} imports the server Supabase module`);
    assert.ok(!/from ["']@\/lib\/admin\/guard["']/.test(text), `${file} imports the admin guard`);
  }
});

test("analytics props drop free text and unknown keys", () => {
  assert.deepEqual(sanitizeProps({ mode: "guest", title: "Call mum", note: "private", count: 3, outcome: "Rescheduled to Friday!", late: true }), { mode: "guest", count: 3, late: true });
  assert.equal(scrubUrl("https://x.app/app/goals/0b7e2b1c-1234-4abc-8def-0123456789ab?code=secret#t"), "https://x.app/app/goals/:id");
});

test("session heartbeats: rate limited, long gaps not counted, ended sessions frozen", () => {
  const row = { last_seen_at: "2026-11-02T10:00:00Z", active_seconds: 100, ended_at: null };
  assert.equal(applyHeartbeat(row, new Date("2026-11-02T10:00:05Z"), "beat"), null);
  assert.equal(applyHeartbeat(row, new Date("2026-11-02T10:01:00Z"), "beat")?.active_seconds, 160);
  assert.equal(applyHeartbeat(row, new Date(Date.parse("2026-11-02T10:00:00Z") + (MAX_GAP_SECONDS + 60) * 1000), "beat")?.active_seconds, 100);
  assert.ok(applyHeartbeat(row, new Date("2026-11-02T10:00:30Z"), "end")?.ended_at);
  assert.equal(applyHeartbeat({ ...row, ended_at: "2026-11-02T10:00:00Z" }, new Date("2026-11-02T10:05:00Z"), "beat"), null);
});

test("admin analytics date ranges are bounded", () => {
  const now = new Date("2026-11-02T12:00:00Z");
  assert.equal(parseRange({}, now).key, "7d");
  assert.equal(parseRange({ range: "30d", platform: "ios" }, now).platform, "ios");
  assert.equal(parseRange({ platform: "<script>" }, now).platform, null);
  assert.equal(parseRange({ from: "2026-10-01", to: "2026-10-31" }, now).key, "custom");
  assert.equal(parseRange({ from: "2020-01-01", to: "2026-10-31" }, now).key, "7d", "over a year falls back");
});
