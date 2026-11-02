"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Occurrence } from "@/lib/domain/types";
import { ActionForm, type ActionFormPreset } from "./action-form";
import { RescheduleDialog } from "./reschedule-dialog";
import { ReviewDialog } from "./review-dialog";

type Review = { occurrence: Occurrence; trigger: "missed" | "skipped" };

interface ComposerApi {
  newAction(preset?: ActionFormPreset): void;
  editAction(actionId: string): void;
  review(occurrence: Occurrence, trigger: "missed" | "skipped"): void;
  reschedule(occurrence: Occurrence): void;
}

const Ctx = createContext<ComposerApi>({ newAction() {}, editAction() {}, review() {}, reschedule() {} });
export const useComposer = () => useContext(Ctx);

/** Hosts the app-wide dialogs so any screen can open them. */
export function ComposerProvider({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<{ open: boolean; editId?: string; preset?: ActionFormPreset; key: number }>({ open: false, key: 0 });
  const [review, setReview] = useState<Review | null>(null);
  const [move, setMove] = useState<Occurrence | null>(null);

  const newAction = useCallback((preset?: ActionFormPreset) => setForm((f) => ({ open: true, preset, key: f.key + 1 })), []);
  const editAction = useCallback((editId: string) => setForm((f) => ({ open: true, editId, key: f.key + 1 })), []);
  const api = useMemo<ComposerApi>(
    () => ({ newAction, editAction, review: (occurrence, trigger) => setReview({ occurrence, trigger }), reschedule: setMove }),
    [newAction, editAction],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <ActionForm key={form.key} open={form.open} editId={form.editId} preset={form.preset} onClose={() => setForm((f) => ({ ...f, open: false }))} />
      {review && <ReviewDialog key={review.occurrence.id} occurrence={review.occurrence} trigger={review.trigger} onClose={() => setReview(null)} />}
      {move && <RescheduleDialog key={move.id} occurrence={move} onClose={() => setMove(null)} />}
    </Ctx.Provider>
  );
}
