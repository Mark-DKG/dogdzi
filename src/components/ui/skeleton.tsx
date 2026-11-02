import { cn } from "@/lib/utils";

/*
 * Skeleton screens shaped like the content they stand in for. The shimmer
 * stops for people who prefer reduced motion (see globals.css). Each loading
 * region is announced once to screen readers via role="status".
 */

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("skeleton", className)} style={style} aria-hidden="true" />;
}

function Loading({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="mb-6 space-y-2">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
    </div>
  );
}

export function ActionRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
      <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
      <Skeleton className="h-8 w-8 rounded-lg" />
    </div>
  );
}

export function ActionListSkeleton({ rows = 4, label = "Loading actions" }: { rows?: number; label?: string }) {
  return (
    <Loading label={label} className="space-y-2.5">
      {Array.from({ length: rows }, (_, i) => (
        <ActionRowSkeleton key={i} />
      ))}
    </Loading>
  );
}

export function DashboardSkeleton() {
  return (
    <Loading label="Loading your day">
      <PageHeaderSkeleton />
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-7 w-10" />
          </div>
        ))}
      </div>
      <Skeleton className="mb-3 h-3 w-24" />
      <div className="space-y-2.5">
        {[0, 1, 2, 3].map((i) => (
          <ActionRowSkeleton key={i} />
        ))}
      </div>
    </Loading>
  );
}

export function MilestoneSkeleton() {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="mt-1 h-12 w-0.5" />
      </div>
      <div className="flex-1 space-y-2 pb-4">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  );
}

export function RoadmapSkeleton() {
  return (
    <Loading label="Loading roadmap">
      <PageHeaderSkeleton />
      <div className="mb-6 rounded-2xl border border-line bg-surface p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-2 w-full rounded-full" />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <MilestoneSkeleton key={i} />
      ))}
    </Loading>
  );
}

export function GoalsSkeleton() {
  return (
    <Loading label="Loading goals">
      <PageHeaderSkeleton />
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-5">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-2 h-3 w-1/3" />
            <Skeleton className="mt-5 h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </Loading>
  );
}

export function HistorySkeleton() {
  return (
    <Loading label="Loading history">
      <PageHeaderSkeleton />
      {[0, 1].map((g) => (
        <div key={g} className="mb-6">
          <Skeleton className="mb-3 h-3 w-24" />
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Loading>
  );
}

export function AnalyticsSkeleton() {
  return (
    <Loading label="Loading analytics">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-7 w-14" />
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <Skeleton className="h-4 w-32" />
        <div className="mt-5 flex h-40 items-end gap-2">
          {[40, 65, 50, 80, 55, 90, 70, 60, 85, 45, 75, 95].map((h, i) => (
            <Skeleton key={i} className="flex-1 rounded-md" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <TableSkeleton rows={4} />
        <TableSkeleton rows={4} />
      </div>
    </Loading>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="border-b border-line p-4">
        <Skeleton className="h-4 w-28" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line p-4 last:border-0">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/5" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <Loading label="Loading settings">
      <PageHeaderSkeleton />
      {[0, 1, 2].map((i) => (
        <div key={i} className="mb-4 rounded-2xl border border-line bg-surface p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-10 w-full" />
          <Skeleton className="mt-3 h-10 w-2/3" />
        </div>
      ))}
    </Loading>
  );
}
