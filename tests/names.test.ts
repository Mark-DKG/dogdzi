import { test } from "node:test";
import assert from "node:assert/strict";
import { updatePreferences } from "../src/lib/domain/actions";
import { greetingFor, normalizeFirstName } from "../src/lib/domain/names";
import { applyPatch, defaultPreferences } from "../src/lib/domain/snapshot";
import { prefsFromRows, prefsToRows } from "../src/lib/store/mappers";
import { planGuestMigration } from "../src/lib/store/migrate-guest";
import { makeCtx, snap } from "./helpers";

test("first names are cleaned before storage", () => {
  assert.equal(normalizeFirstName("  Ama  "), "Ama");
  assert.equal(normalizeFirstName("Mary   Ann"), "Mary Ann");
  assert.equal(normalizeFirstName("Kwame​\n"), "Kwame");
  assert.equal(normalizeFirstName("   "), null);
  assert.equal(normalizeFirstName(null), null);
  assert.equal(normalizeFirstName("x".repeat(60))?.length, 40);
  assert.equal(normalizeFirstName("Àbẹ́ní"), "Àbẹ́ní");
});

test("the greeting uses the first name when there is one", () => {
  assert.equal(greetingFor(8, "Ama"), "Good morning, Ama");
  assert.equal(greetingFor(14, null), "Good afternoon");
  assert.equal(greetingFor(20, "  "), "Good evening");
});

test("updatePreferences normalises the first name", () => {
  const ctx = makeCtx("2026-11-02T08:00:00Z");
  let s = snap();
  s = applyPatch(s, updatePreferences(s, { firstName: "  Kofi " }, ctx));
  assert.equal(s.preferences.firstName, "Kofi");
  s = applyPatch(s, updatePreferences(s, { firstName: "" }, ctx));
  assert.equal(s.preferences.firstName, null);
});

test("first name maps to and from the database row", () => {
  const { user } = prefsToRows({ firstName: "Esi" }, "u1");
  assert.equal(user?.first_name, "Esi");
  const fallback = defaultPreferences("UTC", "2026-11-02T00:00:00Z");
  assert.equal(prefsFromRows({ first_name: "Esi" }, null, fallback).firstName, "Esi");
  assert.equal(prefsFromRows({ first_name: null }, null, { ...fallback, firstName: "Old" }).firstName, null);
  assert.equal(prefsFromRows(null, null, fallback).firstName, null);
});

test("a guest's first name carries into an account that has none", () => {
  const guest = snap();
  guest.preferences = { ...guest.preferences, firstName: "Yaw" };
  const account = snap();
  assert.equal(planGuestMigration(guest, account).patch.preferences?.firstName, "Yaw");
  account.preferences = { ...account.preferences, firstName: "Kojo" };
  assert.equal(planGuestMigration(guest, account).patch.preferences?.firstName, undefined);
});
