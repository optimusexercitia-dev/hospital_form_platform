"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import type { DsrTaskRow } from "@/lib/queries/dsr";
import { attestDsrTask } from "@/lib/dsr/actions";
import { DSR_MESSAGES, dsrAttestProcedure } from "@/lib/dsr/messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { PHI_FREE_TEXT_HINT } from "@/components/ui/phi-input-hint";
import { FormBanner } from "@/components/auth/form-banner";

/**
 * The ATTESTED TIER's completion form (ADR 0130 Decision 6 / Q5a).
 *
 * ⭐ WHAT THIS IS. `patient_xref` structurally cannot find a subject's name typed
 * into narrative prose — meeting minutes, non-case form responses, case
 * narratives. No refactor changes that, so the honest claim for those surfaces is
 * a NAMED PERSON's statement that they read the content, plus the count of
 * mentions they removed. Both are required: an attestation with no attestor and no
 * count cannot be reported in the outcome record, and an optional structured tier
 * is an unreliable one. `complete_dsr_task` refuses this kind for exactly that
 * reason — the fields below are the door's requirement surfaced, not a UI opinion.
 *
 * ⛔ THIS FORM REDACTS NOTHING, AND NO DOOR DOES. The procedure for a mention found
 * in locked content is the REVOKE CORRIDOR — `reopen_meeting` (→ `revoked`,
 * children unlock) → edit → re-sign; the revision bump correctly invalidates
 * registered prints (ADR 0126). An in-place redaction door for locked content is
 * "the child-lock defect's evil twin, a bypass that works" (ADR 0130 Decision 7)
 * and will not be built. {@link dsrAttestProcedure} states that corridor verbatim
 * and is rendered UP FRONT — before the fields, not as fine print under them —
 * because it is the instruction the reviewer needs before they start, not after.
 *
 * ⚠ THE PROCEDURE IS PER-SUBJECT, NOT ONE TEXT. `attest_review` covers two
 * different scopes — the entity-bearing per-MEETING task ("review this ata") and
 * the entity-less per-COMMISSION sweep ("review your commission's non-case free
 * text"). `dsrAttestProcedure(task.module)` picks the matching one. A shared text
 * would have a named human attesting to the wrong scope, in a legal record.
 *
 * ⚠ NOT GATED ON `canExecute`. That flag governs the DISPOSAL affordance only.
 * `complete_dsr_task` accepts anyone the RLS policy lets SEE the task, and gating
 * completion on `canExecute` once locked the Encarregado out of their own
 * attestation tasks — the exact bug this split exists to prevent.
 */
export function DsrAttestForm({
  org,
  task,
}: {
  org: string;
  task: DsrTaskRow;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    reviewer?: string;
    redactions?: string;
    note?: string;
  }>({});
  // ⛔ CONTROLLED, AND UNNAMED (no `nameRequiredFor`). A `<form>` that has not
  // hydrated yet still submits NATIVELY on Enter, and a native GET submit
  // serialises every NAMED input into the QUERY STRING — the sibling search form
  // put a real MRN in the URL that way during verification. `preventDefault()`
  // cannot stop it, because pre-hydration there is no handler. The reviewer's NAME
  // is personal data and must not reach a URL, a history entry or a proxy log
  // either, so this form is state-driven and nameless for the same reason.
  const [reviewerName, setReviewerName] = useState("");
  const [redactions, setRedactions] = useState("");
  const [note, setNote] = useState("");

  const reviewerIds = useFieldIds(`attest-reviewer-${task.id}`, {
    hasDescription: true,
    hasError: !!fieldErrors.reviewer,
    required: true,
  });
  const redactionsIds = useFieldIds(`attest-redactions-${task.id}`, {
    hasDescription: true,
    hasError: !!fieldErrors.redactions,
    required: true,
  });
  const noteIds = useFieldIds(`attest-note-${task.id}`, {
    hasDescription: true,
    hasError: !!fieldErrors.note,
    required: true,
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedReviewer = reviewerName.trim();
    const rawRedactions = redactions.trim();
    const trimmedNote = note.trim();

    // Client-side validation is UX only — `complete_dsr_task` is the authority and
    // refuses the same shapes with its own pt-BR text.
    const next: typeof fieldErrors = {};
    if (!trimmedReviewer) next.reviewer = DSR_MESSAGES.missingReviewerName;
    if (rawRedactions === "" || !Number.isInteger(Number(rawRedactions)) || Number(rawRedactions) < 0) {
      next.redactions = DSR_MESSAGES.missingRedactions;
    }
    if (!trimmedNote) next.note = DSR_MESSAGES.missingNote;
    setFieldErrors(next);
    setError(null);
    if (Object.keys(next).length > 0) return;

    startTransition(async () => {
      const result = await attestDsrTask({
        org,
        taskId: task.id,
        reviewerName: trimmedReviewer,
        redactions: Number(rawRedactions),
        note: trimmedNote,
      });
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? DSR_MESSAGES.unexpected);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {/* The corridor, stated before the fields — this is the instruction, not a
          footnote. Rendered verbatim from the shared constant. */}
      <div className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-accent/40 p-3.5">
        <div className="flex items-center gap-2">
          <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
          <h4 className="text-xs font-semibold tracking-wide uppercase">
            Como proceder
          </h4>
        </div>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-xs text-accent-foreground">
          {dsrAttestProcedure(task.module).map((line) => (
            <li key={line} className="text-pretty">
              {line}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={reviewerIds.controlProps.id}>
            Quem revisou
          </FieldLabel>
          <Input
            {...reviewerIds.controlProps}
            type="text"
            autoComplete="off"
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
          />
          <FieldDescription id={reviewerIds.descriptionId}>
            Nome completo. A atestação é pessoal e nominal, e entra no registro de
            desfecho entregue ao titular.
          </FieldDescription>
          <FieldError id={reviewerIds.errorId}>{fieldErrors.reviewer}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor={redactionsIds.controlProps.id}>
            Menções removidas
          </FieldLabel>
          <Input
            {...redactionsIds.controlProps}
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            autoComplete="off"
            value={redactions}
            onChange={(e) => setRedactions(e.target.value)}
          />
          <FieldDescription id={redactionsIds.descriptionId}>
            Use 0 se nenhuma menção ao titular foi encontrada — zero é uma
            resposta, e não a ausência de uma.
          </FieldDescription>
          <FieldError id={redactionsIds.errorId}>
            {fieldErrors.redactions}
          </FieldError>
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor={noteIds.controlProps.id}>
          O que foi revisado
        </FieldLabel>
        <Textarea
          {...noteIds.controlProps}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Quais conteúdos foram lidos e o que foi encontrado."
        />
        {/* ⛔ The attestation note is where the risk is sharpest: the reviewer has
            just READ the subject's content in order to write this, so the tempting
            thing to type is the very mention they were looking for. The note is
            persisted on the task and surfaced to the DPO. */}
        <FieldDescription id={noteIds.descriptionId}>
          {PHI_FREE_TEXT_HINT}
        </FieldDescription>
        <FieldError id={noteIds.errorId}>{fieldErrors.note}</FieldError>
      </Field>

      <FormBanner tone="error">{error}</FormBanner>

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Registrando…" : "Atestar revisão"}
        </Button>
      </div>
    </form>
  );
}
