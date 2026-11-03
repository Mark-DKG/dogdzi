"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback } from "react";
import { CalendarView, type CalendarMode } from "@/components/app/calendar/calendar-view";
import { DataGate } from "@/components/app/gate";
import { Skeleton } from "@/components/ui/skeleton";

function CalendarSkeleton() {
  return (
    <div role="status" aria-label="Loading calendar">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-11 w-56 rounded-xl" />
      </div>
      <Skeleton className="mb-3 h-11 w-full rounded-xl" />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:gap-6">
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 42 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl sm:h-16 lg:h-24" />
          ))}
        </div>
        <Skeleton className="mt-4 h-64 rounded-3xl lg:mt-0" />
      </div>
    </div>
  );
}

const MODES: CalendarMode[] = ["month", "week", "agenda"];

function CalendarPage() {
  const params = useSearchParams();
  const view = params.get("view");
  const initialMode: CalendarMode = MODES.includes(view as CalendarMode) ? (view as CalendarMode) : "month";
  // Keep the selected date and view in the address so links and Back work, without a navigation.
  const sync = useCallback((date: string, mode: CalendarMode) => {
    const url = `/app/calendar?date=${date}${mode === "month" ? "" : `&view=${mode}`}`;
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(window.history.state, "", url);
  }, []);
  return (
    <DataGate skeleton={<CalendarSkeleton />}>
      {() => <CalendarView initialDate={params.get("date")} initialMode={initialMode} onChange={sync} />}
    </DataGate>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <CalendarPage />
    </Suspense>
  );
}
