import { test } from "node:test";
import assert from "node:assert/strict";
import { cancelAction, completeOccurrence, createAction, ensureOccurrence, maintenance, markMissed, materialize, rescheduleOn, reviewQueue, updateAction } from "../src/lib/domain/actions";
import { calendarEntries, describeDay, entryStatus, monthGrid, summarize, weekDays } from "../src/lib/domain/calendar";
import { addMonths, formatTimeRange } from "../src/lib/domain/dates";
import { describeRecurrence, expandRecurrence } from "../src/lib/domain/recurrence";
import { applyPatch } from "../src/lib/domain/snapshot";
import { makeCtx, run, snap } from "./helpers";

const TZ = "Africa/Accra";

test("yearly repeats keep the date; 29 February falls on the 28th in other years", () => {
  assert.deepEqual(expandRecurrence({ freq: "yearly", interval: 1 }, "2028-02-29", "2028-01-01", "2032-12-31"), ["2028-02-29", "2029-02-28", "2030-02-28", "2031-02-28", "2032-02-29"]);
  assert.deepEqual(expandRecurrence({ freq: "yearly", interval: 2, until: "2034-01-01" }, "2026-11-20", "2026-01-01", "2040-01-01"), ["2026-11-20", "2028-11-20", "2030-11-20", "2032-11-20"]);
  assert.equal(describeRecurrence({ freq: "yearly", interval: 1 }), "Every year");
  assert.equal(describeRecurrence({ freq: "yearly", interval: 3 }), "Every 3 years");
});

test("a plan several years ahead can be created and shows on its date", () => {
  const ctx = makeCtx("2026-11-03T09:00:00Z");
  const s = run(snap(), (x) => createAction(x, { title: "Renew passport", startDate: "2031-05-14", time: "09:30", durationMin: 60 }, ctx));
  const map = calendarEntries(s, "2031-05-01", "2031-05-31", "2026-11-03", TZ);
  const day = map.get("2031-05-14")!;
  assert.equal(day.length, 1);
  assert.equal(day[0].kind, "occurrence");
  assert.equal(entryStatus(day[0]), "planned");
  assert.equal(formatTimeRange("09:30", 60), "9:30am–10:30am");
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-11-03", 12 * 5), "2031-11-03");
});

test("repeating plans are projected beyond the scheduling window without duplicates", () => {
  const ctx = makeCtx("2026-11-03T09:00:00Z");
  let s = run(snap(), (x) => createAction(x, { title: "Team review", startDate: "2026-11-03", time: "10:00", recurrence: { freq: "weekly", interval: 1, byWeekday: [2] } }, ctx));
  const real = s.occurrences.length;
  assert.ok(real >= 2 && real <= 3, "only ~2 weeks are stored");
  const map = calendarEntries(s, "2026-11-01", "2027-01-31", "2026-11-03", TZ);
  const tuesdays = [...map.values()].flat();
  assert.equal(tuesdays.length, 13, "every Tuesday from 3 Nov to 26 Jan, each once");
  assert.equal(new Set(tuesdays.map((e) => e.date)).size, 13);
  assert.equal(tuesdays.filter((e) => e.kind === "occurrence").length, real);

  // Materialising a projected date twice, or letting the scheduler catch up, never duplicates it.
  const first = ensureOccurrence(s, s.actions[0].id, "2027-01-19", ctx);
  s = applyPatch(s, first.patch);
  const again = ensureOccurrence(s, s.actions[0].id, "2027-01-19", ctx);
  assert.equal(again.occurrenceId, first.occurrenceId);
  assert.equal(again.patch.upsert.occurrences, undefined);
  ctx.set("2027-01-10T09:00:00Z");
  s = run(s, (x) => materialize(x, ctx));
  assert.equal(s.occurrences.filter((o) => o.date === "2027-01-19").length, 1);
  assert.throws(() => ensureOccurrence(s, s.actions[0].id, "2027-01-20", ctx), /doesn't repeat/);
});

test("moving one date of a repeating plan keeps the original on record", () => {
  const ctx = makeCtx("2026-11-03T09:00:00Z");
  let s = run(snap(), (x) => createAction(x, { title: "Piano lesson", startDate: "2026-11-05", time: "17:00", recurrence: { freq: "weekly", interval: 1, byWeekday: [4] } }, ctx));
  const aid = s.actions[0].id;
  s = run(s, (x) => rescheduleOn(x, aid, "2027-03-04", "2027-03-06", "11:00", ctx));
  const map = calendarEntries(s, "2027-03-01", "2027-03-07", "2026-11-03", TZ);
  assert.equal(entryStatus(map.get("2027-03-04")![0]), "moved");
  const moved = map.get("2027-03-06")![0];
  assert.equal(moved.kind, "occurrence");
  assert.equal(moved.kind === "occurrence" && moved.occurrence.time, "11:00");
  assert.ok(s.events.some((e) => e.type === "rescheduled" && e.data.to === "2027-03-06"));
  assert.equal(summarize(map.get("2027-03-04")).total, 0, "a moved date isn't counted as planned");
});

test("calendar plans follow the accountability workflow when done or missed", () => {
  const ctx = makeCtx("2026-11-03T08:00:00Z");
  let s = run(
    snap(),
    (x) => createAction(x, { title: "Call the bank", startDate: "2026-11-03", time: "09:00" }, ctx),
    (x) => createAction(x, { title: "Water plants", startDate: "2026-11-03" }, ctx),
  );
  const [bank, plants] = s.occurrences;
  s = run(s, (x) => completeOccurrence(x, plants.id, ctx));
  ctx.set("2026-11-03T12:00:00Z");
  s = run(s, (x) => markMissed(x, ctx));
  const day = calendarEntries(s, "2026-11-03", "2026-11-03", "2026-11-03", TZ).get("2026-11-03")!;
  const byTitle = Object.fromEntries(day.map((e) => [e.action.title, entryStatus(e)]));
  assert.deepEqual(byTitle, { "Call the bank": "missed", "Water plants": "done" });
  assert.ok(reviewQueue(s).some((o) => o.id === bank.id), "missed plan goes to Review");
  const sum = summarize(day);
  assert.match(describeDay("2026-11-03", sum, { today: true, selected: true }), /^Tuesday,? 3 November 2026, today, 1 done, 1 missed$/);
});

test("editing or deleting a plan never erases what already happened", () => {
  const ctx = makeCtx("2026-11-02T08:00:00Z");
  let s = run(snap(), (x) => createAction(x, { title: "Stretch", startDate: "2026-11-02", time: "07:00", recurrence: { freq: "daily", interval: 1 } }, ctx));
  const aid = s.actions[0].id;
  ctx.set("2026-11-04T10:00:00Z");
  s = run(s, (x) => maintenance(x, ctx));
  const missedBefore = s.occurrences.filter((o) => o.status === "missed").length;
  assert.ok(missedBefore >= 2);
  s = run(s, (x) => updateAction(x, aid, { time: "18:00", recurrence: { freq: "weekly", interval: 1, byWeekday: [1] } }, ctx));
  assert.equal(s.occurrences.filter((o) => o.status === "missed").length, missedBefore, "edit keeps missed days");
  s = run(s, (x) => cancelAction(x, aid, ctx));
  assert.equal(s.occurrences.filter((o) => o.status === "missed").length, missedBefore, "delete keeps missed days");
  const map = calendarEntries(s, "2026-11-01", "2026-12-31", "2026-11-04", TZ);
  assert.ok([...map.values()].flat().every((e) => e.kind === "occurrence"), "a cancelled plan is no longer projected");
  assert.ok(s.events.some((e) => e.type === "cancelled"));
});

test("month and week grids start on the chosen first day", () => {
  const g = monthGrid("2026-11-18", 1);
  assert.equal(g.length, 6);
  assert.equal(g[0][0], "2026-10-26", "Monday before 1 November");
  assert.ok(g.flat().includes("2026-11-30"));
  assert.equal(monthGrid("2026-11-18", 0)[0][0], "2026-11-01", "1 Nov 2026 is a Sunday");
  assert.deepEqual(weekDays("2026-11-04", 1), ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
});
