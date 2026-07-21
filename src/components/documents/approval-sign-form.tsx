"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import type { ActionState } from "@/lib/documents/actions";

type DecisionAction = (
  prev: ActionState | undefined,
  formData: FormData,
) => Promise<ActionState>;

/**
 * Shared e-signature form (Phase 17, F3 + F4). A named approver records their
 * decision on a version they were named on: `aprovado` (optional note) or
 * `rejeitado` (note required — the reason, surfaced on the returned draft). Posts
 * to `approveDocument` / `rejectDocument` (passed in as props). Used in BOTH the
 * org-level approver-detail page (F4) and the commission-gated coordinator detail
 * (F3, for a coordinator who is also a named approver).
 *
 * The RPC is the real authority (sign-own-row + entitlement → HC091 for a
 * non-approver), so rendering this component is safe wherever a pending approval
 * exists; the UI simply mirrors that permission.
 */
export function ApprovalSignForm({
  documentVersionId,
  approveAction,
  rejectAction,
}: {
  documentVersionId: string;
  approveAction: DecisionAction;
  rejectAction: DecisionAction;
}) {
  const router = useRouter();
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(
    null,
  );

  return (
    <section
      aria-labelledby="sign-heading"
      className="flex flex-col gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5 shadow-xs sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="sign-heading" className="text-lg font-semibold">
          Sua assinatura
        </h2>
        <p className="text-sm text-muted-foreground text-pretty">
          Você foi indicado como aprovador desta versão. Registre sua decisão —
          ela fica assinada e não pode ser desfeita.
        </p>
      </div>

      {decision === null ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="lg" onClick={() => setDecision("approved")}>
            <Check aria-hidden="true" className="size-4" />
            Aprovar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setDecision("rejected")}
          >
            <X aria-hidden="true" className="size-4" />
            Rejeitar
          </Button>
        </div>
      ) : (
        <DecisionForm
          key={decision}
          decision={decision}
          documentVersionId={documentVersionId}
          action={decision === "approved" ? approveAction : rejectAction}
          onCancel={() => setDecision(null)}
          onDone={() => router.refresh()}
        />
      )}
    </section>
  );
}

function DecisionForm({
  decision,
  documentVersionId,
  action,
  onCancel,
  onDone,
}: {
  decision: "approved" | "rejected";
  documentVersionId: string;
  action: DecisionAction;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const doneRef = useRef(false);
  const isReject = decision === "rejected";

  useEffect(() => {
    if (state?.ok && !doneRef.current) {
      doneRef.current = true;
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="versionId" value={documentVersionId} />

      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <Field>
        <FieldLabel htmlFor="note">
          {isReject ? "Motivo da rejeição" : "Observação (opcional)"}
        </FieldLabel>
        <Textarea
          id="note"
          name="note"
          rows={3}
          required={isReject}
          placeholder={
            isReject
              ? "Explique por que a versão foi rejeitada."
              : "Comentário opcional sobre a aprovação."
          }
          aria-describedby="note-description"
          aria-invalid={state?.fieldErrors?.note ? true : undefined}
        />
        <FieldDescription id="note-description">
          {isReject
            ? "O motivo é registrado e devolve a versão ao rascunho para correção."
            : "Aceita formatação Markdown."}
        </FieldDescription>
        <FieldError>{state?.fieldErrors?.note}</FieldError>
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="lg"
          variant={isReject ? "destructive" : "default"}
          disabled={pending}
        >
          {pending
            ? "Registrando…"
            : isReject
              ? "Confirmar rejeição"
              : "Confirmar aprovação"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={onCancel}
          disabled={pending}
        >
          Voltar
        </Button>
      </div>
    </form>
  );
}
