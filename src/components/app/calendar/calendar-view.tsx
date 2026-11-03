"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ensureOccurrence } from "@/lib/domain/actions";
import { calendarEntries, describeDay, entryStatus, monthGrid, summarize, weekDays, type CalendarEntry, type DaySummary } from "@/lib/domain/calendar";
import { addDays, addMonths, formatDateLabel, formatLongDate, formatMonthYear, formatTimeRange, isValidISODate, parseISODate, weekday } from "@/lib/domain/dates";
import { describeRecurrence } from "@/lib/domain/recurrence";
import type { ISODate, Occurrence } from "@/lib/domain/types";
import { ActionItem } from "@/components/app/action-item";
import { useComposer } from "@/components/app/composer";
import { useData } from "@/components/app/data-provider";
import { IconCalendar, IconCheck, IconChevronDown, IconChevronLeft, IconChevronRight, IconEdit, IconMove, IconPlus, IconRepeat, IconSkip } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

export type CalendarMode = "month" | "week" | "agenda";
const MODES: { value: CalendarMode; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "agenda", label: "Agenda" },
];
const AGENDA_STEP = 30;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/* ───────────────────────────── status glyphs ───────────────────────────── */

/** Status shown with a shape as well as a colour, so it never relies on colour alone. */
export function StatusGlyph({ status, className }: { status: ReturnType<typeof entryStatus>; className?: string }) {
  switch (status) {
    case "done":
      return (
        <span className={cn("inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-done text-cream-50 dark:text-forest-950", className)} aria-hidden>
          <IconCheck size={9} strokeWidth={3.4} />
        </span>
      );
    case "missed":
      return (
        <span className={cn("inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] bg-missed text-[9px] font-black leading-none text-cream-50 dark:text-forest-950", className)} aria-hidden>
          !
        </span>
      );
    case "skipped":
      return <span className={cn("inline-block h-[3px] w-3 rounded-full bg-muted", className)} aria-hidden />;
    case "moved":
      return <IconMove size={11} className={cn("text-muted", className)} aria-hidden />;
    default:
      return <span className={cn("inline-block h-2.5 w-2.5 rounded-full border-2 border-forest-500 dark:border-forest-300", className)} aria-hidden />;
  }
}

function Markers({ sum }: { sum: DaySummary }) {
  const kinds = (["planned", "done", "missed", "skipped"] as const).filter((k) => sum[k] > 0);
  if (!kinds.length) return null;
  return (
    <span className="flex items-center justify-center gap-1" aria-hidden>
      {kinds.map((k) => (
        <span key={k} className="inline-flex items-center gap-0.5">
          <StatusGlyph status={k} />
          {sum[k] > 1 && <span className="hidden text-[10px] font-semibold text-muted sm:inline">{sum[k]}</span>}
        </span>
      ))}
    </span>
  );
}

/* ───────────────────────────── month grid ───────────────────────────── */

function MonthGrid({
  anchor,
  selected,
  today,
  weekStartsOn,
  entries,
  onSelect,
  onKey,
}: {
  anchor: ISODate;
  selected: ISODate;
  today: ISODate;
  weekStartsOn: 0 | 1;
  entries: Map<ISODate, CalendarEntry[]>;
  onSelect: (d: ISODate) => void;
  onKey: (e: KeyboardEvent<HTMLDivElement>) => void;
}) {
  const weeks = monthGrid(anchor, weekStartsOn);
  const month = parseISODate(anchor).m;
  const heads = Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7);
  return (
    <div role="grid" aria-label={formatMonthYear(anchor)} aria-readonly="true" onKeyDown={onKey} className="select-none">
      <div role="row" className="grid grid-cols-7 border-b border-line pb-1.5">
        {heads.map((d) => (
          <div key={d} role="columnheader" className="text-center text-[11px] font-bold uppercase tracking-wide text-muted">
            <abbr title={DAY_LONG[d]} className="no-underline">
              {DAY_NAMES[d]}
            </abbr>
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div role="row" key={week[0]} className="grid grid-cols-7">
          {week.map((d) => {
            const list = entries.get(d);
            const sum = summarize(list);
            const isToday = d === today;
            const isSel = d === selected;
            const inMonth = parseISODate(d).m === month;
            const shown = (list ?? []).filter((e) => entryStatus(e) !== "moved");
            return (
              <div role="gridcell" key={d} aria-selected={isSel} className="p-0.5">
                <button
                  type="button"
                  data-date={d}
                  tabIndex={isSel ? 0 : -1}
                  onClick={() => onSelect(d)}
                  aria-label={describeDay(d, sum, { today: isToday, selected: isSel })}
                  aria-current={isToday ? "date" : undefined}
                  className={cn(
                    "flex h-14 w-full flex-col items-center gap-1 rounded-xl pt-1.5 transition-colors sm:h-16 lg:h-24 lg:items-stretch lg:px-1.5",
                    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                    isSel ? "bg-surface-2 ring-2 ring-inset ring-primary" : "hover:bg-surface-2/70",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-sm tabular-nums lg:self-start",
                      isToday ? "bg-primary font-bold text-primary-fg" : inMonth ? "font-semibold text-fg" : "text-muted/60",
                    )}
                  >
                    {parseISODate(d).d}
                  </span>
                  <span className="lg:hidden">
                    <Markers sum={sum} />
                  </span>
                  <span className="hidden min-w-0 flex-col gap-0.5 lg:flex" aria-hidden>
                    {shown.slice(0, 2).map((e) => (
                      <span key={e.kind === "occurrence" ? e.occurrence.id : e.id} className="flex min-w-0 items-center gap-1 text-left text-[11px] leading-tight text-fg">
                        <StatusGlyph status={entryStatus(e)} className="shrink-0" />
                        <span className={cn("truncate", entryStatus(e) === "done" && "text-muted line-through")}>{e.action.title}</span>
                      </span>
                    ))}
                    {shown.length > 2 && <span className="text-left text-[11px] font-semibold text-muted">+{shown.length - 2} more</span>}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────────── day lists ───────────────────────────── */

function ProjectedItem({ entry }: { entry: Extract<CalendarEntry, { kind: "projected" }> }) {
  const { run } = useData();
  const composer = useComposer();
  const a = entry.action;
  // Turn this projected date into a real occurrence (same id the scheduler would use), then act on it.
  const materialize = async (then: (o: Occurrence) => void) => {
    let occ: Occurrence | undefined;
    const ok = await run((s, ctx) => {
      const r = ensureOccurrence(s, a.id, entry.date, ctx);
      occ = r.patch.upsert.occurrences?.[0] ?? s.occurrences.find((o) => o.id === r.occurrenceId);
      return r.patch;
    });
    if (ok && occ) then(occ);
  };
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-dashed border-forest-300 bg-surface p-3 pr-1.5 dark:border-forest-600">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center" aria-hidden>
        <span className="h-7 w-7 rounded-full border-2 border-dashed border-forest-300 dark:border-forest-500" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-fg">{a.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span>{formatTimeRange(a.time, a.durationMin)}</span>
          <span className="inline-flex items-center gap-1">
            <IconRepeat size={12} aria-hidden /> {describeRecurrence(a.recurrence)}
          </span>
          <Badge>Planned</Badge>
        </div>
      </div>
      <Menu
        label={`Options for ${a.title} on ${formatLongDate(entry.date)}`}
        items={[
          { label: "Move this date", icon: <IconMove size={16} />, onSelect: () => void materialize((o) => composer.reschedule(o)) },
          { label: "Skip this date", icon: <IconSkip size={16} />, onSelect: () => void materialize((o) => composer.review(o, "skipped")) },
          { label: "Edit repeating plan", icon: <IconEdit size={16} />, onSelect: () => composer.editAction(a.id, { plan: true }) },
        ]}
      />
    </li>
  );
}

function EntryList({ list }: { list: CalendarEntry[] }) {
  return (
    <ul className="space-y-2.5">
      {list.map((e) => (e.kind === "occurrence" ? <ActionItem key={e.occurrence.id} occurrence={e.occurrence} /> : <ProjectedItem key={e.id} entry={e} />))}
    </ul>
  );
}

function AddPlanButton({ date, today, size = "md", variant = "primary", className }: { date: ISODate; today: ISODate; size?: "sm" | "md"; variant?: "primary" | "secondary"; className?: string }) {
  const composer = useComposer();
  const past = date < today;
  return (
    <Button size={size} variant={variant} className={className} disabled={past} onClick={() => composer.newAction({ date, plan: true })} aria-label={`Add plan on ${formatLongDate(date)}`}>
      <IconPlus size={18} /> Add plan
    </Button>
  );
}

function DayPanel({ date, today, list }: { date: ISODate; today: ISODate; list: CalendarEntry[] }) {
  const sum = summarize(list);
  const past = date < today;
  return (
    <section aria-labelledby="day-heading" className="rounded-3xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">{formatDateLabel(date, today)}</p>
          <h2 id="day-heading" className="mt-0.5 text-lg font-bold leading-snug">
            {formatLongDate(date)}
          </h2>
          {sum.total > 0 && (
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              {sum.planned > 0 && <span className="inline-flex items-center gap-1"><StatusGlyph status="planned" /> {sum.planned} planned</span>}
              {sum.done > 0 && <span className="inline-flex items-center gap-1"><StatusGlyph status="done" /> {sum.done} done</span>}
              {sum.missed > 0 && <span className="inline-flex items-center gap-1"><StatusGlyph status="missed" /> {sum.missed} missed</span>}
              {sum.skipped > 0 && <span className="inline-flex items-center gap-1"><StatusGlyph status="skipped" /> {sum.skipped} skipped</span>}
            </p>
          )}
        </div>
        <AddPlanButton date={date} today={today} />
      </div>
      {past && <p className="mt-3 text-xs text-muted">This day has passed. You can still review or complete what was planned.</p>}
      <div className="mt-4">
        {list.length ? (
          <EntryList list={list} />
        ) : (
          <EmptyState
            className="py-8"
            icon={<IconCalendar />}
            title={past ? "Nothing was planned" : "Nothing planned yet"}
            body={past ? "Pick another day, or go back to today." : "Add a plan for this day. It shows up in Today and Upcoming too."}
          />
        )}
      </div>
    </section>
  );
}

function WeekList({ days, today, selected, entries, onSelect }: { days: ISODate[]; today: ISODate; selected: ISODate; entries: Map<ISODate, CalendarEntry[]>; onSelect: (d: ISODate) => void }) {
  return (
    <div className="space-y-3">
      {days.map((d) => {
        const list = entries.get(d) ?? [];
        const sum = summarize(list);
        return (
          <section key={d} aria-label={describeDay(d, sum, { today: d === today, selected: d === selected })} className={cn("rounded-2xl border bg-surface p-3 sm:p-4", d === selected ? "border-primary ring-1 ring-primary" : "border-line")}>
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => onSelect(d)} className="flex min-h-11 items-center gap-3 rounded-xl pr-2 text-left" aria-current={d === today ? "date" : undefined}>
                <span className={cn("flex h-10 w-10 flex-col items-center justify-center rounded-xl text-sm font-bold tabular-nums", d === today ? "bg-primary text-primary-fg" : "bg-surface-2")}>
                  {parseISODate(d).d}
                </span>
                <span>
                  <span className="block text-sm font-bold">{DAY_LONG[weekday(d)]}</span>
                  <span className="block text-xs text-muted">{formatDateLabel(d, today)}</span>
                </span>
              </button>
              <div className="flex items-center gap-2">
                <Markers sum={sum} />
                {d >= today && <AddPlanButton date={d} today={today} size="sm" variant="secondary" />}
              </div>
            </div>
            {list.length > 0 && (
              <div className="mt-3">
                <EntryList list={list} />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Agenda({ from, days, today, entries, onMore }: { from: ISODate; days: number; today: ISODate; entries: Map<ISODate, CalendarEntry[]>; onMore: () => void }) {
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i)).filter((d) => (entries.get(d) ?? []).length > 0);
  return (
    <div>
      {dates.length === 0 ? (
        <EmptyState
          icon={<IconCalendar />}
          title="Nothing planned in this period"
          body={`From ${formatLongDate(from)} to ${formatLongDate(addDays(from, days - 1))}.`}
          action={<AddPlanButton date={from < today ? today : from} today={today} />}
        />
      ) : (
        <div className="space-y-5">
          {dates.map((d) => (
            <section key={d} aria-labelledby={`ag-${d}`}>
              <h3 id={`ag-${d}`} className="mb-2 flex items-baseline gap-2 text-sm font-bold">
                {formatLongDate(d)}
                <span className="text-xs font-semibold text-muted">{formatDateLabel(d, today)}</span>
              </h3>
              <EntryList list={entries.get(d)!} />
            </section>
          ))}
        </div>
      )}
      <div className="mt-6 flex justify-center">
        <Button variant="secondary" onClick={onMore}>
          Show the next {AGENDA_STEP} days
        </Button>
      </div>
    </div>
  );
}

/* ───────────────────────────── jump to date ───────────────────────────── */

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function JumpDialog({ open, onClose, current, today, onGo }: { open: boolean; onClose: () => void; current: ISODate; today: ISODate; onGo: (d: ISODate) => void }) {
  const cur = parseISODate(current);
  const [year, setYear] = useState(cur.y);
  const [exact, setExact] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setYear(parseISODate(current).y);
      setExact("");
      setError(null);
    }
  }, [open, current]);
  const go = (d: ISODate) => {
    onGo(d);
    onClose();
  };
  const ty = parseISODate(today).y;
  return (
    <Dialog open={open} onClose={onClose} title="Go to a date" description="Jump to any month or year, past or future.">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Button variant="secondary" size="icon" onClick={() => setYear((y) => Math.max(1970, y - 1))} aria-label="Previous year">
            <IconChevronLeft />
          </Button>
          <p className="text-2xl font-bold tabular-nums" aria-live="polite">
            {year}
          </p>
          <Button variant="secondary" size="icon" onClick={() => setYear((y) => Math.min(2200, y + 1))} aria-label="Next year">
            <IconChevronRight />
          </Button>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {[1, 2, 5, 10].map((n) => (
            <button key={n} type="button" onClick={() => setYear(ty + n)} className="min-h-11 rounded-full border border-line px-3.5 text-sm font-semibold hover:bg-surface-2">
              +{n} {n === 1 ? "year" : "years"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="group" aria-label={`Months in ${year}`}>
          {MONTH_NAMES.map((m, i) => {
            const iso = `${year}-${String(i + 1).padStart(2, "0")}-01`;
            const isCur = year === cur.y && i + 1 === cur.m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => go(year === ty && i + 1 === parseISODate(today).m ? today : iso)}
                aria-pressed={isCur}
                className={cn("min-h-12 rounded-xl border text-sm font-semibold", isCur ? "border-primary bg-primary text-primary-fg" : "border-line hover:bg-surface-2")}
              >
                {m}
              </button>
            );
          })}
        </div>
        <form
          className="flex items-end gap-2 border-t border-line pt-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isValidISODate(exact)) return setError("Choose a date.");
            go(exact);
          }}
          noValidate
        >
          <Field label="Exact date" error={error} className="flex-1">
            {({ id, invalid, describedBy }) => <Input id={id} type="date" aria-invalid={invalid} aria-describedby={describedBy} value={exact} onChange={(e) => setExact(e.target.value)} />}
          </Field>
          <Button type="submit" className={error ? "mb-[1.375rem]" : undefined}>
            Go
          </Button>
        </form>
        <Button variant="ghost" className="w-full" onClick={() => go(today)}>
          Back to today
        </Button>
      </div>
    </Dialog>
  );
}

/* ───────────────────────────── page ───────────────────────────── */

function rangeFor(mode: CalendarMode, selected: ISODate, weekStartsOn: 0 | 1, agendaDays: number): [ISODate, ISODate] {
  if (mode === "month") {
    const g = monthGrid(selected, weekStartsOn);
    return [g[0][0], g[5][6]];
  }
  if (mode === "week") {
    const w = weekDays(selected, weekStartsOn);
    return [w[0], w[6]];
  }
  return [selected, addDays(selected, agendaDays - 1)];
}

export function CalendarView({ initialDate, initialMode, onChange }: { initialDate: ISODate | null; initialMode: CalendarMode; onChange: (d: ISODate, m: CalendarMode) => void }) {
  const { snapshot, today } = useData();
  const prefs = snapshot.preferences;
  const weekStartsOn = prefs.weekStartsOn;
  const [selected, setSelected] = useState<ISODate>(initialDate && isValidISODate(initialDate) ? initialDate : today);
  const [mode, setMode] = useState<CalendarMode>(initialMode);
  const [agendaDays, setAgendaDays] = useState(AGENDA_STEP);
  const [jumping, setJumping] = useState(false);
  const focusAfterMove = useRef(false);
  const gridWrap = useRef<HTMLDivElement>(null);

  useEffect(() => onChange(selected, mode), [selected, mode, onChange]);
  useEffect(() => {
    if (!focusAfterMove.current) return;
    focusAfterMove.current = false;
    gridWrap.current?.querySelector<HTMLButtonElement>(`[data-date="${selected}"]`)?.focus();
  }, [selected]);

  const [from, to] = rangeFor(mode, selected, weekStartsOn, agendaDays);
  const entries = useMemo(() => calendarEntries(snapshot, from, to, today, prefs.timezone), [snapshot, from, to, today, prefs.timezone]);
  const dayList = entries.get(selected) ?? [];

  const step = (dir: 1 | -1) => {
    if (mode === "month") setSelected((d) => addMonths(d, dir));
    else if (mode === "week") setSelected((d) => addDays(d, 7 * dir));
    else setSelected((d) => addDays(d, agendaDays * dir));
  };

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, () => ISODate> = {
      ArrowLeft: () => addDays(selected, -1),
      ArrowRight: () => addDays(selected, 1),
      ArrowUp: () => addDays(selected, -7),
      ArrowDown: () => addDays(selected, 7),
      Home: () => addDays(selected, -((weekday(selected) - weekStartsOn + 7) % 7)),
      End: () => addDays(selected, 6 - ((weekday(selected) - weekStartsOn + 7) % 7)),
      PageUp: () => addMonths(selected, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(selected, e.shiftKey ? 12 : 1),
    };
    const f = moves[e.key];
    if (!f) return;
    e.preventDefault();
    focusAfterMove.current = true;
    setSelected(f());
  };

  const title = mode === "month" ? formatMonthYear(selected) : mode === "week" ? weekTitle(from, to) : `${formatMonthYear(from)}${parseISODate(to).m !== parseISODate(from).m ? ` – ${formatMonthYear(to)}` : ""}`;
  const unit = mode === "month" ? "month" : mode === "week" ? "week" : `${agendaDays} days`;

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">Calendar</h1>
        <div role="group" aria-label="Calendar view" className="flex rounded-xl border border-line bg-surface p-1">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={mode === m.value}
              onClick={() => setMode(m.value)}
              className={cn("min-h-10 rounded-lg px-3.5 text-sm font-semibold", mode === m.value ? "bg-primary text-primary-fg" : "text-muted hover:text-fg")}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-1.5">
        <Button variant="secondary" size="icon" onClick={() => step(-1)} aria-label={`Previous ${unit}`}>
          <IconChevronLeft />
        </Button>
        <button
          type="button"
          onClick={() => setJumping(true)}
          className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-base font-bold hover:bg-surface-2 sm:flex-none sm:px-3 sm:text-lg"
          aria-label={`${title}. Choose a month, year or date`}
          aria-haspopup="dialog"
        >
          <span className="truncate" aria-live="polite">
            {title}
          </span>
          <IconChevronDown size={18} className="shrink-0 text-muted" />
        </button>
        <Button variant="secondary" size="icon" onClick={() => step(1)} aria-label={`Next ${unit}`}>
          <IconChevronRight />
        </Button>
        <Button variant="secondary" size="sm" className="ml-auto" onClick={() => setSelected(today)} disabled={selected === today}>
          Today
        </Button>
      </div>

      {mode === "month" ? (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:items-start lg:gap-6">
          <div ref={gridWrap} className="-mx-2 rounded-3xl border-line sm:mx-0 sm:border sm:bg-surface sm:p-3">
            <MonthGrid anchor={selected} selected={selected} today={today} weekStartsOn={weekStartsOn} entries={entries} onSelect={setSelected} onKey={onGridKey} />
            <Legend />
          </div>
          <div className="mt-4 lg:sticky lg:top-6 lg:mt-0">
            <DayPanel date={selected} today={today} list={dayList} />
          </div>
        </div>
      ) : mode === "week" ? (
        <WeekList days={weekDays(selected, weekStartsOn)} today={today} selected={selected} entries={entries} onSelect={setSelected} />
      ) : (
        <Agenda from={from} days={agendaDays} today={today} entries={entries} onMore={() => setAgendaDays((n) => n + AGENDA_STEP)} />
      )}

      <JumpDialog open={jumping} onClose={() => setJumping(false)} current={selected} today={today} onGo={setSelected} />
    </div>
  );
}

function weekTitle(from: ISODate, to: ISODate): string {
  const a = parseISODate(from);
  const b = parseISODate(to);
  const fmt = (iso: ISODate, opts: Intl.DateTimeFormatOptions) => {
    const p = parseISODate(iso);
    return new Date(Date.UTC(p.y, p.m - 1, p.d)).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
  };
  if (a.y !== b.y) return `${fmt(from, { day: "numeric", month: "short", year: "numeric" })} – ${fmt(to, { day: "numeric", month: "short", year: "numeric" })}`;
  if (a.m !== b.m) return `${fmt(from, { day: "numeric", month: "short" })} – ${fmt(to, { day: "numeric", month: "short", year: "numeric" })}`;
  return `${a.d}–${fmt(to, { day: "numeric", month: "long", year: "numeric" })}`;
}

function Legend() {
  const items: { s: ReturnType<typeof entryStatus>; label: string }[] = [
    { s: "planned", label: "Planned" },
    { s: "done", label: "Done" },
    { s: "missed", label: "Missed" },
    { s: "skipped", label: "Skipped" },
  ];
  return (
    <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 px-2 text-xs text-muted" aria-label="Key">
      {items.map((i) => (
        <li key={i.s} className="inline-flex items-center gap-1.5">
          <StatusGlyph status={i.s} /> {i.label}
        </li>
      ))}
      <li className="inline-flex items-center gap-1.5">
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-fg" aria-hidden>
          1
        </span>
        Today
      </li>
    </ul>
  );
}
