"use client";

import { commissionHref } from "@/lib/routing";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { startOrResumePhase } from "@/lib/cases/actions";
import { Button } from "@/components/ui/button";

/**
 * "Preencher" affordance for an assigned case phase (F5). Mirrors the forms
 * {@link StartFillButton}: a CLICK-driven button that starts (or resumes) the
 * phase's response via `startOrResumePhase` inside `useTransition`, then navigates
 * straight to the wizard at the returned response id.
 *
 * This replaces the earlier auto-redirecting landing route (P7-001): a server
 * action auto-run from a `useEffect` on mount hangs under Next.js client-side
 * navigation. Running it from a user click in a transition is the working
 * pattern. The RPC is idempotent server-side (one response per phase via the
 * unique index), so a double-click can't create two responses, and only the
 * assignee passes (P0022) — a non-assignee gets the pt-BR message inline.
 */
export function StartPhaseButton({
  org,
  slug,
  caseId,
  phaseId,
}: {
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  caseId: string;
  phaseId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleStart() {
    setError(null);
    startTransition(async () => {
      const result = await startOrResumePhase(phaseId);
      if (!result.ok || !result.responseId) {
        setError(result.error ?? "Não foi possível abrir esta fase.");
        return;
      }
      router.push(
        commissionHref(org, slug, "cases", caseId, "phase", phaseId, "responder", result.responseId),
      );
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        type="button"
        size="sm"
        onClick={handleStart}
        disabled={pending}
        aria-busy={pending || undefined}
      >
        {pending ? "Abrindo…" : "Preencher"}
        <ArrowRight aria-hidden="true" />
      </Button>
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
