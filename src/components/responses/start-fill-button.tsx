"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import { startOrResumeResponse } from "@/lib/responses/actions";
import { Button } from "@/components/ui/button";

/**
 * "Preencher" affordance (F1). Starts (or resumes) a response for a published
 * form version via B3's `startOrResumeResponse`, then navigates into the wizard
 * at the returned response id. Shown only when the user has NO existing
 * in_progress response (the card renders a direct "Continuar" link otherwise).
 *
 * A failure surfaces a pt-BR message inline (no raw PG errors). The action is
 * idempotent server-side (the one-draft unique index), so a double-click can't
 * create two drafts.
 */
export function StartFillButton({
  slug,
  formId,
  publishedVersionId,
}: {
  slug: string;
  formId: string;
  publishedVersionId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleStart() {
    setError(null);
    startTransition(async () => {
      const result = await startOrResumeResponse(publishedVersionId);
      if (!result.ok || !result.responseId) {
        setError(result.error ?? "Não foi possível iniciar o preenchimento.");
        return;
      }
      router.push(
        `/c/${slug}/forms/${formId}/responder/${result.responseId}`,
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
        <Pencil aria-hidden="true" />
        {pending ? "Abrindo…" : "Preencher"}
      </Button>
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
