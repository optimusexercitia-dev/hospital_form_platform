"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Gavel, Lock } from "lucide-react";

import type {
  DsrDisposableMeeting,
  DsrOutcome,
  DsrOutcomeRecord,
} from "@/lib/queries/dsr";
import { adjudicateDsrRequest, closeDsrRequest } from "@/lib/dsr/actions";
import {
  DSR_MEETING_DISPOSAL_WARNING,
  DSR_MESSAGES,
  DSR_OUTCOME_LABELS,
  DSR_REFUSAL_RETENTION_BASIS,
} from "@/lib/dsr/messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { FormBanner } from "@/components/auth/form-banner";

/**
 * ⛔ THE ESCALATION LIST, WITH `taskId` STRUCTURALLY REMOVED (BUG-DSR-S3-001).
 *
 * `DsrDisposableMeeting` carries TWO uuids — `taskId` and `meetingId` — and the
 * escalation corridor needs exactly one of them: `adjudicate_dsr_request`
 * validates against MEETING ids (`t.entity_id = u.id`, then
 * `from public.meetings m where m.id = any(v_ids)`). This panel originally posted
 * `taskId`, so every escalation was refused with HCDS2 and NOTHING was minted —
 * silently, because the door's refusal was the only symptom.
 *
 * ⚠ A one-token slip between two same-typed fields is invisible to `tsc` and to
 * review, so fixing the call site alone would leave the trap armed. `Omit`ting
 * `taskId` at the boundary means the wrong id is **not in scope** anywhere below:
 * `meeting.taskId` is now a compile error, not a runtime refusal. Nothing else in
 * the codebase reads `DsrDisposableMeeting.taskId` — it was only ever used here,
 * as a React key.
 */
type EscalatableMeeting = Omit<DsrDisposableMeeting, "taskId">;

/** Outcomes whose basis text is delivered to the data subject (Art. 18 §4). */
const REFUSALS = new Set<DsrOutcome>(["refused_retention", "refused_identity"]);
/** Outcomes counsel's holding 2 makes a substantive adjudication. */
const NEEDS_LEGAL_REF = new Set<DsrOutcome>([
  "granted",
  "granted_partial",
  "refused_retention",
]);
/** Outcomes that erase something, and therefore require a prior adjudication. */
const ERASING = new Set<DsrOutcome>(["granted", "granted_partial"]);

function isOutcome(value: string): value is DsrOutcome {
  return Object.hasOwn(DSR_OUTCOME_LABELS, value);
}

/**
 * The ADJUDICATION lane (ADR 0130 Decision 1 + Amendment 1) and the two-phase
 * close (Q16iii).
 *
 * ⭐ WHY ADJUDICATION EXISTS AT ALL. Counsel returned on 2026-08-19 (ADR 0035
 * Amendment 1) holding that committee documentation is the ANALYSIS of a
 * prontuário and NOT part of it — so a removal request is never auto-refused and
 * never auto-granted. Each is decided CASE BY CASE, together with legal
 * consultation, against a 20-year retention period adopted as INSTITUTIONAL
 * POLICY. This form is that decision being recorded.
 *
 * ⛔ THE REFUSAL BASIS CITES THE INSTITUTIONAL RETENTION POLICY AND NEVER CFM
 * 1821/2007. Counsel held that statute does not attach to these records; citing it
 * to a data subject would be a FALSE LEGAL BASIS. The prefill comes from
 * {@link DSR_REFUSAL_RETENTION_BASIS} so the next counsel refinement is a
 * one-file change — the string is never typed into this component.
 *
 * ⛔ MEETING ESCALATION IS PER-MEETING, EXPLICIT, AND WARNED. `disposeMeetingIds`
 * is the ONLY way a `dispose_meeting` task is ever minted (ADR 0130 Amdt 2 item 3):
 * `dispose_meeting_minutes` erases the WHOLE minutes — the minutes text plus every
 * agenda item's description, discussion notes and resolution — so the intake
 * fan-out deliberately mints `attest_review` instead. Escalating destroys OTHER
 * COMMITTEES' unrelated records, which is why {@link DSR_MEETING_DISPOSAL_WARNING}
 * sits inside the fieldset, above the checkboxes, and not under the submit button.
 *
 * ⚠ Only meetings THIS request already enumerated are offerable — an arbitrary
 * meeting id is not, and the door refuses it (HCDS2).
 *
 * The decision is WRITE-ONCE: `alreadyAdjudicated` (HCDS5) refuses a rewrite at
 * the door, so once recorded this component renders the decision and offers only
 * the close.
 */
export function DsrAdjudicationPanel({
  org,
  record,
  meetings,
}: {
  org: string;
  record: DsrOutcomeRecord;
  meetings: EscalatableMeeting[];
}) {
  const adjudicated = record.adjudicatedAt !== null;
  const closed = record.status === "closed";

  if (closed) {
    return (
      <section
        aria-labelledby="dsr-adjudication-heading"
        className="flex items-start gap-2.5 rounded-2xl border border-border bg-muted/40 p-5"
      >
        <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <h2 id="dsr-adjudication-heading" className="text-base font-semibold">
            Solicitação encerrada
          </h2>
          <p className="text-sm text-muted-foreground text-pretty">
            A decisão registrada e o registro de desfecho acima são o que foi
            entregue ao titular. Nada mais pode ser alterado nesta solicitação.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="dsr-adjudication-heading"
      className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Gavel aria-hidden="true" className="size-4 text-primary" />
          <h2 id="dsr-adjudication-heading" className="text-base font-semibold">
            {adjudicated ? "Encerrar solicitação" : "Registrar decisão"}
          </h2>
        </div>
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          {adjudicated
            ? "A decisão já está registrada e não pode ser reescrita. O encerramento consome essa decisão; ele é recusado enquanto houver tarefas de execução pendentes."
            : "Cada solicitação é analisada caso a caso, com consulta jurídica registrada. A retenção de 20 anos é a política institucional padrão — não uma recusa automática."}
        </p>
      </div>

      {adjudicated ? (
        <DsrCloseForm org={org} record={record} />
      ) : (
        <DsrAdjudicateForm org={org} record={record} meetings={meetings} />
      )}
    </section>
  );
}

function DsrAdjudicateForm({
  org,
  record,
  meetings,
}: {
  org: string;
  record: DsrOutcomeRecord;
  meetings: EscalatableMeeting[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<DsrOutcome | "">("");
  const [basis, setBasis] = useState("");
  // ⛔ CONTROLLED AND UNNAMED, like every other DSR form — a `<form>` that has
  // not hydrated yet still submits NATIVELY on Enter, and a native GET submit
  // serialises every NAMED input into the QUERY STRING (the search form put a
  // real MRN in the URL that way during verification). The legal basis is text
  // delivered to a data subject and the consultation reference identifies a
  // lawyer; neither belongs in a URL, a history entry or a proxy log.
  const [legalRef, setLegalRef] = useState("");
  // Holds MEETING ids — the unit `adjudicate_dsr_request` validates and mints
  // against. Named to match the payload so a future reader cannot re-introduce
  // the task-id slip by reading the variable name alone.
  const [meetingIds, setMeetingIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    outcome?: string;
    basis?: string;
    legalRef?: string;
  }>({});

  const outcomeIds = useFieldIds(`adj-outcome-${record.requestId}`, {
    hasError: !!fieldErrors.outcome,
    required: true,
  });
  const basisIds = useFieldIds(`adj-basis-${record.requestId}`, {
    hasDescription: true,
    hasError: !!fieldErrors.basis,
    required: true,
  });
  const legalIds = useFieldIds(`adj-legal-${record.requestId}`, {
    hasDescription: true,
    hasError: !!fieldErrors.legalRef,
    required: true,
  });

  const needsBasis = outcome !== "" && REFUSALS.has(outcome);
  const needsLegalRef = outcome !== "" && NEEDS_LEGAL_REF.has(outcome);
  const isErasing = outcome !== "" && ERASING.has(outcome);
  const escalatable = meetings.filter((m) => !m.alreadyDisposed);

  function handleOutcomeChange(next: string) {
    const value = isOutcome(next) ? next : "";
    setOutcome(value);
    // Prefill the refusal basis from the shared constant so the operator edits a
    // vetted text rather than composing a legal basis from memory. ⛔ The
    // institutional retention policy — never CFM 1821/2007.
    if (value === "refused_retention" && !basis.trim()) {
      setBasis(DSR_REFUSAL_RETENTION_BASIS);
    }
  }

  function toggleMeeting(meetingId: string, checked: boolean) {
    setMeetingIds((prev) =>
      checked ? [...prev, meetingId] : prev.filter((id) => id !== meetingId),
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const legalRefText = legalRef.trim();
    const basisText = basis.trim();

    const next: typeof fieldErrors = {};
    if (outcome === "") next.outcome = DSR_MESSAGES.missingOutcome;
    if (needsBasis && !basisText) next.basis = DSR_MESSAGES.missingBasis;
    if (needsLegalRef && !legalRefText) next.legalRef = DSR_MESSAGES.missingLegalRef;
    setFieldErrors(next);
    setError(null);
    if (Object.keys(next).length > 0 || outcome === "") return;

    startTransition(async () => {
      const result = await adjudicateDsrRequest({
        org,
        requestId: record.requestId,
        outcome,
        outcomeBasis: basisText || null,
        legalConsultationRef: legalRefText || null,
        disposeMeetingIds: meetingIds,
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
      <Field>
        <FieldLabel htmlFor={outcomeIds.controlProps.id}>Desfecho</FieldLabel>
        <NativeSelect
          {...outcomeIds.controlProps}
          value={outcome}
          onChange={(e) => handleOutcomeChange(e.target.value)}
        >
          <option value="">Selecione…</option>
          {Object.entries(DSR_OUTCOME_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <FieldError id={outcomeIds.errorId}>{fieldErrors.outcome}</FieldError>
      </Field>

      {needsBasis ? (
        <Field>
          <FieldLabel htmlFor={basisIds.controlProps.id}>
            Fundamento informado ao titular
          </FieldLabel>
          <Textarea
            {...basisIds.controlProps}
            rows={4}
            value={basis}
            onChange={(e) => setBasis(e.target.value)}
          />
          <FieldDescription id={basisIds.descriptionId}>
            Este texto é entregue ao titular (LGPD art. 18 §4). A recusa por
            retenção se apoia na política institucional de 20 anos.
          </FieldDescription>
          <FieldError id={basisIds.errorId}>{fieldErrors.basis}</FieldError>
        </Field>
      ) : null}

      {needsLegalRef ? (
        <Field>
          <FieldLabel htmlFor={legalIds.controlProps.id}>
            Consulta jurídica
          </FieldLabel>
          <Input
            {...legalIds.controlProps}
            type="text"
            autoComplete="off"
            value={legalRef}
            onChange={(e) => setLegalRef(e.target.value)}
          />
          <FieldDescription id={legalIds.descriptionId}>
            Data e referência do parecer que fundamentou a decisão. Toda análise
            de mérito é feita caso a caso, com consulta jurídica.
          </FieldDescription>
          <FieldError id={legalIds.errorId}>{fieldErrors.legalRef}</FieldError>
        </Field>
      ) : null}

      {/* ---- Meeting escalation — only on an erasing outcome -------------- */}
      {isErasing && escalatable.length > 0 ? (
        <fieldset className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <legend className="px-1 text-sm font-semibold text-destructive">
            Escalar reuniões para descarte da ata
          </legend>

          <div className="flex items-start gap-2.5">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-destructive"
            />
            <p className="text-sm font-medium text-destructive text-pretty">
              {DSR_MEETING_DISPOSAL_WARNING}
            </p>
          </div>

          <p className="text-xs text-muted-foreground text-pretty">
            Sem escalar, cada reunião permanece como tarefa de revisão e atestação
            — o caminho normal. Marque apenas as atas cujo descarte integral foi
            decidido.
          </p>

          <ul className="flex flex-col gap-2">
            {escalatable.map((meeting) => (
              <li key={meeting.meetingId} className="flex items-start gap-2.5">
                <Checkbox
                  id={`meeting-${meeting.meetingId}`}
                  checked={meetingIds.includes(meeting.meetingId)}
                  onCheckedChange={(checked) =>
                    toggleMeeting(meeting.meetingId, checked === true)
                  }
                />
                <label
                  htmlFor={`meeting-${meeting.meetingId}`}
                  className="cursor-pointer text-sm text-pretty"
                >
                  {meeting.label}
                  {meeting.commissionName ? (
                    <span className="block text-xs text-muted-foreground">
                      {meeting.commissionName}
                    </span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}

      <FormBanner tone="error">{error}</FormBanner>

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Registrando…" : "Registrar decisão"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Phase two of the close. The decision is already recorded, so this CONSUMES it:
 * `closeDsrRequest` is called with no outcome, and the door reads the adjudicated
 * one. A close can therefore never quietly rewrite a decision, and it is refused
 * (HCDS4) while execution tasks are still pending.
 */
function DsrCloseForm({
  org,
  record,
}: {
  org: string;
  record: DsrOutcomeRecord;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // ⛔ BOTH TERMS ARE COUNTED, NEITHER IS DERIVED. This once read
  // `attested.total - attested.completed`, which counts a retired task as
  // still-to-do, so a closed refusal warned about cancelled work and never reached
  // zero. It was then corrected by subtracting `retired` — still a remainder.
  // `attested.pending` is now counted from rows, so the subtraction is gone
  // entirely: same family as the console-card blocker, and the third time a
  // derived count produced a false figure in this program.
  const outstanding = record.mechanical.pending + record.attested.pending;

  function handleClose() {
    setError(null);
    startTransition(async () => {
      const result = await closeDsrRequest({ org, requestId: record.requestId });
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? DSR_MESSAGES.unexpected);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {outstanding > 0 ? (
        <p
          role="status"
          className="rounded-xl border border-warning/40 bg-warning/12 px-3.5 py-2.5 text-sm font-medium text-warning text-pretty"
        >
          Ainda há {outstanding} tarefa{outstanding === 1 ? "" : "s"} de execução
          pendente{outstanding === 1 ? "" : "s"}. O encerramento como atendida será
          recusado até que todas sejam concluídas.
        </p>
      ) : null}

      <FormBanner tone="error">{error}</FormBanner>

      <div>
        <Button type="button" onClick={handleClose} disabled={isPending}>
          {isPending ? "Encerrando…" : "Encerrar solicitação"}
        </Button>
      </div>
    </div>
  );
}
