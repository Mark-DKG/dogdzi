"use client";

import { ErrorState } from "@/components/ui/states";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="The admin console hit a problem" message="The request failed or the database is unreachable. No changes were made." onRetry={reset} />;
}
