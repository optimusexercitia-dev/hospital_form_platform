"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { GitBranchPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AddVersionState } from "@/lib/documents/actions";

type SupersedeAction = (
  prev: AddVersionState | undefined,
  formData: FormData,
) => Promise<AddVersionState>;

/**
 * Supersede control (Phase 17, F3). Creates a NEW `rascunho` version of a `vigente`
 * document via `supersedeDocument` (which reads ONLY `documentId` and returns the
 * new version id — it does NOT take a file). The prior version stays `vigente`
 * until the new one publishes. On success the page refreshes: the document is now
 * back in `rascunho`, where `AddVersionForm` handles uploading the new file to the
 * freshly-created draft version. Two steps by design (the action contract).
 *
 * The action is passed in as a prop (never value-imported).
 */
export function SupersedeDocumentButton({
  documentId,
  action,
}: {
  documentId: string;
  action: SupersedeAction;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, undefined);
  const doneRef = useRef(false);

  useEffect(() => {
    if (state?.ok && !doneRef.current) {
      doneRef.current = true;
      // The new draft version now exists; refresh so the page re-renders in the
      // `rascunho` state where the file upload form appears.
      router.refresh();
    }
  }, [state, router]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
    >
      <input type="hidden" name="documentId" value={documentId} />
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Nova versão</h2>
        <p className="text-sm text-muted-foreground text-pretty">
          Crie uma nova versão em rascunho para substituir a versão vigente. A
          versão atual continua valendo até a nova ser publicada.
        </p>
      </div>

      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <div>
        <Button type="submit" size="lg" disabled={pending}>
          <GitBranchPlus aria-hidden="true" className="size-4" />
          {pending ? "Criando…" : "Criar nova versão"}
        </Button>
      </div>
    </form>
  );
}
