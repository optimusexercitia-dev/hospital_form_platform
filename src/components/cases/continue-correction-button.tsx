"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";

import { commissionHref } from "@/lib/routing";
import { startCorrectionDraft } from "@/lib/corrections/actions";
import { Button } from "@/components/ui/button";

/**
 * "Continuar correção" (Case Correction Lifecycle, ADR 0085) — the designated
 * corrector's entry into a PHASE correction/addendum draft. Mirrors
 * {@link StartPhaseButton}: creates or resumes the successor draft via
 * `start_correction_draft` inside a transition, then routes straight to the phase
 * responder wizard at the returned draft response id (the wizard runs in correction
 * mode — FE-3). The RPC is idempotent (create-or-resume), and only the corrector
 * passes (HC0M1) — a non-corrector gets the pt-BR message inline.
 */
export function ContinueCorrectionButton({
  org,
  slug,
  caseId,
  phaseId,
  requestId,
}: {
  org: string;
  slug: string;
  caseId: string;
  phaseId: string;
  requestId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    setError(null);
    startTransition(async () => {
      const result = await startCorrectionDraft(requestId);
      if (!result.ok || !result.draftResponseId) {
        setError(result.error ?? "Não foi possível abrir a correção.");
        return;
      }
      router.push(
        commissionHref(
          org,
          slug,
          "cases",
          caseId,
          "phase",
          phaseId,
          "responder",
          result.draftResponseId,
        ),
      );
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        type="button"
        size="sm"
        onClick={handleContinue}
        disabled={pending}
        aria-busy={pending || undefined}
      >
        <PenLine aria-hidden="true" />
        {pending ? "Abrindo…" : "Continuar correção"}
      </Button>
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
