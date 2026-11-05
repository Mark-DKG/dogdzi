"use client";

import { useEffect, useRef } from "react";
import { toISODate } from "@/lib/domain/dates";
import { applyDailyCap, dueInWindow, planReminders, type PlannedReminder } from "@/lib/domain/reminders";
import { devicePushActive, showLocalNotification } from "@/lib/push/client";
import { useToast } from "@/components/ui/toast";
import { useData } from "./data-provider";

const CHECK_MS = 30_000;
const SENT_KEY = "dogdzi:reminders-sent";

function readSent(day: string): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(SENT_KEY) ?? "{}") as { day?: string; keys?: string[] };
    return new Set(raw.day === day ? (raw.keys ?? []) : []);
  } catch {
    return new Set();
  }
}
function writeSent(day: string, keys: Set<string>) {
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify({ day, keys: Array.from(keys).slice(-200) }));
  } catch {
    /* ignore */
  }
}

/**
 * In-app reminders while Dogdzi is open (guests and accounts). Uses system
 * notifications if the user allowed them, otherwise an on-screen toast.
 * When this device is subscribed to server push (account with push on), the
 * server sends reminders instead so people aren't notified twice. Push being
 * on in settings isn't enough: without a subscription here (blocked, not yet
 * allowed, or unsupported), in-app reminders still run.
 */
export function ReminderEngine() {
  const { status, snapshot, mode } = useData();
  const toast = useToast();
  const lastCheck = useRef<Date>(new Date());
  const snapRef = useRef(snapshot);
  snapRef.current = snapshot;

  useEffect(() => {
    if (status !== "ready") return;
    const check = async () => {
      const s = snapRef.current;
      const prefs = s.preferences;
      if (mode === "account" && prefs.pushEnabled && (await devicePushActive())) return;
      const now = new Date();
      const from = lastCheck.current;
      lastCheck.current = now;
      const day = toISODate(now, prefs.timezone);
      const sent = readSent(day);
      const byId = new Map(s.actions.map((a) => [a.id, a]));
      const due: PlannedReminder[] = [];
      for (const o of s.occurrences) {
        if (o.status !== "pending" || o.date < day) continue;
        const a = byId.get(o.actionId);
        if (!a) continue;
        for (const r of dueInWindow(planReminders(o, a, prefs), from, now)) if (!sent.has(r.key)) due.push(r);
      }
      const toSend = applyDailyCap(due, sent.size, prefs.maxNotificationsPerDay);
      for (const r of toSend) {
        sent.add(r.key);
        const shown = await showLocalNotification(r.title, r.body, r.key);
        if (!shown) toast.show(r.body, "info");
      }
      if (toSend.length) writeSent(day, sent);
    };
    const id = setInterval(check, CHECK_MS);
    return () => clearInterval(id);
  }, [status, mode, toast]);

  return null;
}
