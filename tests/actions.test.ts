import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DomainError,
  cancelAction,
  completeOccurrence,
  createAction,
  maintenance,
  markMissed,
  reopenOccurrence,
  rescheduleOccurrence,
  respond,
  reviewQueue,
  updateAction,
  acknowledgeMany,
  setRecoveryStatus,
} from "../src/lib/domain/actions";
import { applyPatch } from "../src/lib/domain/snapshot";
import { makeCtx, run, snap } from "./helpers";

const onlyOcc = (s: ReturnType<typeof snap>) => s.occurrences[0];

test("create → complete records history and a done occurrence", () => {
  const ctx = makeCtx("2026-11-02T08:00:00Z");
  let s = run(snap(), (x) => createAction(x, { title: "  Submit report ", startDate: "2026-11-02", time: "15:00" }, ctx));
  assert.equal(s.actions.length, 1);
  assert.equal(s.actions[0].title, "Submit report");
  assert.equal(s.occurrences.length, 1);
  assert.equal(onlyOcc(s).status, "pending");
  s = run(s, (x) => completeOccurrence(x, onlyOcc(x).id, ctx));
  assert.equal(onlyOcc(s).status, "done");
  assert.deepEqual(s.events.map((e) => e.type), ["created", "completed"]);
});

test("validation rejects empty titles and bad dates with friendly messages", () => {
  const ctx = makeCtx("2026-11-02T08:00:00Z");
  assert.throws(() => createAction(snap(), { title: "  ", startDate: "2026-11-02" }, ctx), DomainError);
  assert.throws(() => createAction(snap(), { title: "x", startDate: "2026-02-30" }, ctx), /valid date/);
  assert.throws(() => createAction(snap(), { title: "x", startDate: "2026-11-02", time: "25:00" }, ctx), /valid time/);
});

test("overdue timed action becomes missed after the grace period, untimed at end of day", () => {
  const ctx = makeCtx("2026-11-02T08:00:00Z");
  let s = run(
    snap(),
    (x) => createAction(x, { title: "Call bank", startDate: "2026-11-02", time: "10:00" }, ctx),
    (x) => createAction(x, { title: "Tidy desk", startDate: "2026-11-02" }, ctx),
  );
  ctx.set("2026-11-02T11:59:00Z");
  assert.equal(markMissed(s, ctx).upsert.occurrences, undefined, "still inside the 2h grace window");
  ctx.set("2026-11-02T12:00:00Z");
  s = applyPatch(s, markMissed(s, ctx));
  assert.deepEqual(s.occurrences.map((o) => o.status), ["missed", "pending"]);
  ctx.set("2026-11-03T00:00:00Z");
  s = applyPatch(s, markMissed(s, ctx));
  assert.deepEqual(s.occurrences.map((o) => o.status), ["missed", "missed"]);
  assert.equal(reviewQueue(s).length, 2);
  assert.equal(s.events.filter((e) => e.type === "missed").length, 2);
});

test("missed → complete now keeps the miss on record as a late completion", () => {
  const ctx = makeCtx("2026-11-02T08:00:00Z");
  let s = run(snap(), (x) => createAction(x, { title: "Pay rent", startDate: "2026-11-01" }, ctx));
  s = applyPatch(s, markMissed(s, ctx));
  s = run(s, (x) => respond(x, onlyOcc(x).id, { trigger: "missed", reasonCode: "forgot", note: "Was travelling", outcome: "complete_now" }, ctx));
  const o = onlyOcc(s);
  assert.equal(o.status, "done");
  assert.equal(o.resolution, "completed_late");
  assert.equal(s.responses.length, 1);
  assert.equal(s.responses[0].note, "Was travelling");
  assert.deepEqual(s.events.map((e) => e.type), ["created", "missed", "reason_recorded", "completed_late"]);
  assert.equal(reviewQueue(s).length, 0);
});

test("missed → reschedule creates a linked new occurrence; the original stays missed", () => {
  const ctx = makeCtx("2026-11-02T08:00:00Z");
  let s = run(snap(), (x) => createAction(x, { title: "Gym", startDate: "2026-11-01", time: "07:00" }, ctx));
  s = applyPatch(s, markMissed(s, ctx));
  const missedId = onlyOcc(s).id;
  s = run(s, (x) => respond(x, missedId, { trigger: "missed", reasonCode: "low_energy", note: null, outcome: "reschedule", reschedule: { date: "2026-11-03", time: "18:00" } }, ctx));
  const orig = s.occurrences.find((o) => o.id === missedId)!;
  const moved = s.occurrences.find((o) => o.id === orig.rescheduledToId)!;
  assert.equal(orig.status, "missed");
  assert.equal(orig.resolution, "rescheduled");
  assert.equal(moved.status, "pending");
  assert.equal(moved.rescheduledFromId, missedId);
  assert.equal(moved.date, "2026-11-03");
  assert.throws(() => respond(s, missedId, { trigger: "missed", reasonCode: "other", note: null, outcome: "acknowledge" }, ctx), /already been reviewed/);
});

test("rescheduling into the past is refused", () => {
  const ctx = makeCtx("2026-11-02T08:00:00Z");
  const s = run(snap(), (x) => createAction(x, { title: "Read", startDate: "2026-11-02" }, ctx));
  assert.throws(() => rescheduleOccurrence(s, onlyOcc(s).id, "2026-11-01", null, ctx), /today or a later date/);
});

test("skip with a recovery plan records the reason, plan and a restart occurrence", () => {
  const ctx = makeCtx("2026-11-02T08:00:00Z");
  let s = run(snap(), (x) => createAction(x, { title: "Study chapter 4", startDate: "2026-11-02", time: "19:00" }, ctx));
  s = run(s, (x) =>
    respond(x, onlyOcc(x).id, {
      trigger: "skipped",
      reasonCode: "unclear_next_step",
      note: null,
      outcome: "recovery_plan",
      recovery: { title: "", steps: ["Skim the summary", " ", "Do 3 exercises"], restartDate: "2026-11-04" },
    }, ctx),
  );
  const skipped = s.occurrences.find((o) => o.status === "skipped")!;
  assert.equal(skipped.resolution, "recovery_plan");
  assert.equal(s.recoveryPlans.length, 1);
  assert.equal(s.recoveryPlans[0].steps.length, 2, "blank steps are dropped");
  assert.match(s.recoveryPlans[0].title, /Study chapter 4/);
  const restart = s.occurrences.find((o) => o.source === "recovery")!;
  assert.equal(restart.date, "2026-11-04");
  assert.ok(s.events.some((e) => e.type === "skipped"));
  s = run(s, (x) => setRecoveryStatus(x, x.recoveryPlans[0].id, "completed", ctx));
  assert.ok(s.events.some((e) => e.type === "recovery_plan_completed"));
});

test("cancelling a missed one-off cancels the action but keeps every record", () => {
  const ctx = makeCtx("2026-11-02T08:00:00Z");
  let s = run(snap(), (x) => createAction(x, { title: "Renew licence", startDate: "2026-10-30" }, ctx));
  s = applyPatch(s, markMissed(s, ctx));
  s = run(s, (x) => respond(x, onlyOcc(x).id, { trigger: "missed", reasonCode: "changed_priorities", note: null, outcome: "cancel" }, ctx));
  assert.equal(s.actions[0].status, "cancelled");
  assert.equal(s.occurrences.length, 1, "nothing removed");
  assert.equal(onlyOcc(s).status, "missed");
  assert.equal(onlyOcc(s).resolution, "cancelled");
});

test("a skipped or missed occurrence can never return to pending", () => {
  const ctx = makeCtx("2026-11-02T08:00:00Z");
  let s = run(snap(), (x) => createAction(x, { title: "Walk", startDate: "2026-11-01" }, ctx));
  s = applyPatch(s, markMissed(s, ctx));
  s = run(s, (x) => completeOccurrence(x, onlyOcc(x).id, ctx));
  assert.equal(onlyOcc(s).resolution, "completed_late");
  s = run(s, (x) => reopenOccurrence(x, onlyOcc(x).id, ctx));
  assert.equal(onlyOcc(s).status, "missed", "a reopened late completion goes back to review, not pending");
  assert.equal(onlyOcc(s).resolution, null);
});

test("cancelAction closes open occurrences without deleting them", () => {
  const ctx = makeCtx("2026-11-02T08:00:00Z");
  let s = run(snap(), (x) => createAction(x, { title: "Water plants", startDate: "2026-11-02", recurrence: { freq: "daily", interval: 1 } }, ctx));
  const before = s.occurrences.length;
  s = run(s, (x) => cancelAction(x, x.actions[0].id, ctx));
  assert.equal(s.occurrences.length, before);
  assert.ok(s.occurrences.every((o) => o.status === "cancelled"));
  assert.equal(maintenance(s, ctx).upsert.occurrences, undefined, "cancelled routines don't materialise");
});

test("routines materialise idempotently and backfill at most 7 days after creation", () => {
  const ctx = makeCtx("2026-11-02T08:00:00Z");
  let s = run(snap(), (x) => createAction(x, { title: "Journal", startDate: "2026-10-01", recurrence: { freq: "daily", interval: 1 } }, ctx));
  // Created today → nothing before today even though the start date is in the past.
  assert.equal(s.occurrences[0].date, "2026-11-02");
  assert.equal(s.occurrences.length, 15);
  assert.equal(maintenance(s, ctx).upsert.occurrences, undefined, "second pass adds nothing");
  ctx.set("2026-11-20T08:00:00Z");
  const p = maintenance(s, ctx);
  s = applyPatch(s, p);
  const missed = s.occurrences.filter((o) => o.status === "missed");
  assert.ok(missed.length >= 3, "unopened days become missed and enter review");
  const ids = new Set(s.occurrences.map((o) => o.id));
  assert.equal(ids.size, s.occurrences.length, "no duplicate occurrences");
  s = run(s, (x) => acknowledgeMany(x, reviewQueue(x).map((o) => o.id), "unexpected_event", ctx));
  assert.equal(reviewQueue(s).length, 0);
  assert.equal(s.responses.length, missed.length);
});

test("editing a routine's days cancels non-matching future days and adds new ones", () => {
  const ctx = makeCtx("2026-11-02T08:00:00Z"); // Monday
  let s = run(snap(), (x) => createAction(x, { title: "Run", startDate: "2026-11-02", time: "06:30", recurrence: { freq: "weekly", interval: 1, byWeekday: [1, 3, 5] } }, ctx));
  const id = s.actions[0].id;
  s = run(s, (x) => updateAction(x, id, { recurrence: { freq: "weekly", interval: 1, byWeekday: [2, 4] }, time: "07:00" }, ctx));
  const pending = s.occurrences.filter((o) => o.status === "pending");
  assert.ok(pending.length > 0);
  for (const o of pending) assert.ok([2, 4].includes(new Date(o.date + "T00:00:00Z").getUTCDay()), `${o.date} should be Tue/Thu`);
  assert.ok(pending.every((o) => o.time === "07:00"));
  assert.ok(s.events.some((e) => e.type === "edited" && (e.data.fields as string[]).includes("recurrence")));
  assert.throws(() => updateAction(s, id, { recurrence: null }, ctx), /can't be turned/);
});

test("time zones: an Accra 10:00 action is due at 10:00 UTC, a Tokyo one at 01:00 UTC", () => {
  const acc = makeCtx("2026-11-02T00:00:00Z", "Africa/Accra");
  let a = run(snap("Africa/Accra"), (x) => createAction(x, { title: "A", startDate: "2026-11-02", time: "10:00" }, acc));
  acc.set("2026-11-02T12:00:00Z");
  a = applyPatch(a, markMissed(a, acc));
  assert.equal(a.occurrences[0].status, "missed");

  const tok = makeCtx("2026-11-01T20:00:00Z", "Asia/Tokyo");
  let t = run(snap("Asia/Tokyo"), (x) => createAction(x, { title: "T", startDate: "2026-11-02", time: "10:00" }, tok));
  tok.set("2026-11-02T02:59:00Z");
  t = applyPatch(t, markMissed(t, tok));
  assert.equal(t.occurrences[0].status, "pending");
  tok.set("2026-11-02T03:00:00Z");
  t = applyPatch(t, markMissed(t, tok));
  assert.equal(t.occurrences[0].status, "missed");
});
