import type { DataMode, HistoryEvent, Patch, Snapshot } from "@/lib/domain/types";

export interface HistoryPage {
  events: HistoryEvent[];
  hasMore: boolean;
  /** True when older history exists but this mode can't show it (guest limit). */
  limited: boolean;
}

/** Storage backend. Guests use the browser; accounts use Supabase. */
export interface Repo {
  readonly mode: DataMode;
  load(): Promise<Snapshot>;
  commit(patch: Patch): Promise<void>;
  listHistory(opts: { before?: string; limit?: number }): Promise<HistoryPage>;
}

export class RepoError extends Error {
  constructor(
    message: string,
    public retryable = true,
  ) {
    super(message);
    this.name = "RepoError";
  }
}

/** Reject if `p` doesn't settle in `ms`, so loading states can never hang forever. */
export function withTimeout<T>(p: Promise<T>, ms: number, message = "This is taking longer than expected. Check your connection and try again."): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new RepoError(message)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
