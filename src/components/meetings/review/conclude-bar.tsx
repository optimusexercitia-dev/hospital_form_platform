"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { applyMinutesReview, type ApplyMinutesReviewState } from "@/lib/minutes-jobs/actions";
import type { MinutesApplyCounts, MinutesDraft } from "@/lib/minutes-jobs/types";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatApplyCounts, MINUTES_UI } from "../minutes-labels";
import { useMinutesAction } from "../use-minutes-action";

/** A client-side ESTIMATE of what apply will do, for the confirm dialog — the real counts come back from `applyMinutesReview` itself. */
function previewCounts(draft: MinutesDraft): { updated: number; created: number; actions: number } {
  const agendaIncluded = draft.agenda.filter((a) => a.include);
  return {
    updated: agendaIncluded.filter((a) => a.ref !== null).length,
    created: agendaIncluded.filter((a) => a.ref === null).length,
    actions: draft.action_items.filter((a) => a.include).length,
  };
}

/**
 * F3 — the sticky "Concluir revisão" bar (ADR 0099 D12).
 *
 * Confirms (restating the overwrite warning + a live estimate of what apply will do),
 * then calls `applyMinutesReview(jobId, draft)` with the draft `review-shell.tsx`
 * currently holds — never a stale server copy. On success, hands the REAL counts up to
 * the parent via `onApplied` so it can switch to the inline success state; this
 * component never navigates itself.
 */
export function ConcludeBar({
  jobId,
  draft,
  hasCurrentMinutes,
  onApplied,
}: {
  jobId: string;
  draft: MinutesDraft;
  hasCurrentMinutes: boolean;
  onApplied: (counts: MinutesApplyCounts) => void;
}) {
  const [open, setOpen] = useState(false);
  const { run, isPending, error } = useMinutesAction();
  const preview = previewCounts(draft);

  return (
    <div className="animate-fade-in sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-md backdrop-blur">
      <span className="text-sm text-muted-foreground">
        {preview.updated + preview.created} itens de pauta · {preview.actions} itens de ação
      </span>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <Button type="button" size="lg" onClick={() => setOpen(true)}>
          <CheckCircle2 aria-hidden="true" />
          {MINUTES_UI.concludeButton}
        </Button>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{MINUTES_UI.concludeConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {formatApplyCounts({
                agendaUpdated: preview.updated,
                agendaCreated: preview.created,
                actionsCreated: preview.actions,
                actionsUnassigned: 0,
              })}
              {hasCurrentMinutes && ` ${MINUTES_UI.concludeConfirmOverwrite}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {MINUTES_UI.concludeConfirmCancel}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={() =>
                run<ApplyMinutesReviewState>(() => applyMinutesReview(jobId, draft), {
                  skipRefresh: true,
                  onSuccess: (result) => {
                    setOpen(false);
                    if (result.counts) onApplied(result.counts);
                  },
                })
              }
            >
              {isPending ? "Concluindo…" : MINUTES_UI.concludeConfirmAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
