"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gavel } from "lucide-react";

import type { CorrectionRequest } from "@/lib/queries/corrections";
import { approveCorrection, rejectCorrection } from "@/lib/corrections/actions";
import {
  ApproveButton,
  RejectButton,
} from "@/components/cases/case-corrections-panel";
import { FormBanner } from "@/components/auth/form-banner";
import { cn } from "@/lib/utils";

/**
 * The DECIDE control on the correction review screen — "Reprovar" / "Aprovar" for
 * the request the reviewer is currently reading.
 *
 * The two buttons are the very components the case page's request list uses
 * ({@link ApproveButton} / {@link RejectButton}, exported from
 * `case-corrections-panel`), so the confirm dialogs, the mandatory rejection reason
 * and the self-approval warning are one definition rendered in two places rather
 * than two implementations that agree today.
 *
 * What differs here is only what happens AFTER: the case page refreshes in place,
 * because the request list it just changed is on screen. This screen's whole subject
 * is a request that no longer awaits a decision, so it routes back to the case
 * instead — staying would leave the reviewer on a comparison whose decision has
 * already been made.
 */
export function CorrectionDecisionCard({
  request,
  targetLabel,
  viewerId,
  caseHref,
  className,
}: {
  request: CorrectionRequest;
  /** The phase this request corrects — fills the confirm-dialog copy. */
  targetLabel: string;
  /** The reviewer, to detect self-approval (permitted, but warned + recorded). */
  viewerId: string | null;
  /** Where to land once the request is decided (the case detail page). */
  caseHref: string;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const willSelfApprove =
    viewerId != null &&
    (request.requestedBy === viewerId || request.permittedCorrector === viewerId);

  function decide(thunk: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await thunk();
      if (!result.ok) {
        // Stay put on failure — the door refused (a stale state, a race with
        // another coordinator), and bouncing to the case would hide why.
        setError(result.error ?? "Não foi possível concluir. Tente novamente.");
        return;
      }
      router.push(caseHref);
    });
  }

  return (
    <section
      aria-labelledby="correction-decision-heading"
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Gavel
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
        <h2 id="correction-decision-heading" className="text-sm font-semibold">
          Decisão
        </h2>
      </div>

      <p className="text-xs text-muted-foreground text-pretty">
        Aprovar substitui o conteúdo registrado da fase e recalcula o resultado.
        Reprovar devolve o rascunho ao corretor com o motivo.
      </p>

      {error && <FormBanner tone="error">{error}</FormBanner>}

      <div className="flex flex-wrap items-center gap-2">
        <RejectButton
          disabled={isPending}
          onReject={(reason) =>
            decide(() => rejectCorrection(request.id, reason))
          }
        />
        <ApproveButton
          disabled={isPending}
          kind={request.kind}
          targetLabel={targetLabel}
          willSelfApprove={willSelfApprove}
          onConfirm={() => decide(() => approveCorrection(request.id))}
        />
      </div>
    </section>
  );
}
