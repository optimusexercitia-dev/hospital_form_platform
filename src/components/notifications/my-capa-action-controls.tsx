"use client";

import { Check, ChevronRight } from "lucide-react";

import {
  advanceCapaAction,
  completeCapaAction,
} from "@/lib/safety/capa-actions";
import { Button } from "@/components/ui/button";
import { useSafetyAction } from "@/components/safety/use-safety-action";
// Type-only — `capa-types` is a zero-import client-safe module, but keeping the
// import type-only documents that this island needs no runtime from it.
import type { CapaActionStatus } from "@/lib/safety/capa-types";

/**
 * S1·N BUG-N-001 (ADR 0076) — the per-row advance controls on the personal
 * `/conta/itens-de-acao` page. A small client island so the surrounding list
 * stays a Server Component; the assignee branch of `advance_capa_action` has no
 * PQS gate, so these work for ANY assignee reached from a `capa/assigned`
 * notification (no CAPA workspace access needed).
 *
 * `useSafetyAction` surfaces the mapped pt-BR error and calls `router.refresh()`
 * on success — the actions `revalidateNsp()` (a no-op for this route), so the
 * client refresh is what re-fetches the list to reflect the new status.
 *
 * Terminal states (`completed` / `cancelled`) render nothing — there is no
 * further step to take, and cancelling is a coordinator action, not an
 * assignee one.
 */
export function MyCapaActionControls({
  actionId,
  status,
}: {
  actionId: string;
  status: CapaActionStatus;
}) {
  const { run, isPending, error } = useSafetyAction();

  if (status === "completed" || status === "cancelled") return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {status === "pending" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => advanceCapaAction(actionId, "in_progress"))}
          >
            <ChevronRight aria-hidden="true" />
            Iniciar
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => run(() => completeCapaAction(actionId))}
        >
          <Check aria-hidden="true" />
          Concluir
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
