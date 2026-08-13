"use client";

import { useState, useTransition } from "react";
import { Bell } from "lucide-react";

import type { ActionState } from "@/lib/controlled-documents/actions";
import { cn } from "@/lib/utils";

type RemindAction = (
  versionId: string,
  approverId: string,
) => Promise<ActionState>;

/**
 * "Lembrar" button for a still-pending approver of the version under approval
 * (Phase 17 v2, F-C). Calls the staff_admin-gated `remindDocumentApprover` and
 * surfaces its pt-BR result inline (`remindSent` vs the deduped `remindSkipped`)
 * via `role="status"`. The action is passed in as a prop (never value-imported).
 */
export function RemindApproverButton({
  versionId,
  approverId,
  action,
}: {
  versionId: string;
  approverId: string;
  action: RemindAction;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function remind() {
    setMessage(null);
    startTransition(async () => {
      const result = await action(versionId, approverId);
      setMessage(result.error ?? (result.ok ? "Lembrete enviado." : null));
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={remind}
        disabled={isPending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <Bell aria-hidden="true" className="size-3.5" />
        {isPending ? "Enviando…" : "Lembrar"}
      </button>
      {message ? (
        <span role="status" className="text-xs text-muted-foreground">
          {message}
        </span>
      ) : null}
    </div>
  );
}
