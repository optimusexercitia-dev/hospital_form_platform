import { CheckCircle2, CircleDashed, FileText, Scale, UserCheck } from "lucide-react";

import type { DsrOutcomeRecord } from "@/lib/queries/dsr";
import {
  DSR_MEETING_RESIDUE_RETAINED,
  DSR_OUTCOME_LABELS,
  DSR_STATUS_LABELS,
} from "@/lib/dsr/messages";
import { DsrDueBadge, DsrDueNotice } from "@/components/dsr/dsr-due-badge";

/**
 * ⭐ THE TWO-TIER OUTCOME RECORD (ADR 0130 Decision 6 / Q5a) — what the hospital
 * can honestly tell the data subject it did.
 *
 * The whole point of this component is that it makes the claim's SHAPE visible
 * instead of implying a single flat one:
 *
 *  · **Mechanical** — what `patient_xref` found and the four disposal doors
 *    erased. The platform knows these exactly, so they are reported as machine
 *    facts with counts.
 *  · **Attested** — what a NAMED HUMAN read in free-text prose, with the count of
 *    mentions they removed. `patient_xref` STRUCTURALLY CANNOT find a name typed
 *    into narrative prose, and no refactor changes that — so this tier is a
 *    person's statement and is presented as one, with their name attached. Showing
 *    it as a machine total would be the over-claim this program exists to end.
 *  · **Residue** — the FIXED language of Decision 9, rendered VERBATIM from
 *    `DSR_RESIDUE_NOTICE` via `record.residue`. ⛔ Never improvised, never
 *    summarised, never re-worded per request.
 *
 * ⚠ NO CFM 1821/2007 ANYWHERE. Counsel held (ADR 0035 Amendment 1) that the
 * statute does not attach to committee records; citing it to a data subject would
 * be a FALSE LEGAL BASIS. The refusal text shown here is whatever the DPO recorded
 * via `DSR_REFUSAL_RETENTION_BASIS`, which cites the institutional 20-year
 * retention policy.
 *
 * ⚠ THE PARTS MUST SUM: `total === disposed + pending + retired` on the mechanical
 * tier, and `total === completed + retired + pending` on the attested one — both
 * exact, because every part of both is counted from rows rather than derived.
 * `retired` exists because a non-granting close now retires outstanding tasks to
 * `blocked`; before it, a retired task counted as NEITHER disposed NOR pending and
 * `total` silently stopped equalling its parts. A closed refusal rendering
 * "0 pendentes" with no retired line reads as COMPLETED — the precise opposite of
 * what happened, in the one artifact that must not make false claims. Both tiers
 * therefore render `retired` unconditionally, and {@link TierSum} states the
 * arithmetic outright rather than leaving the reader to trust it.
 *
 * Server-safe: presentational, no `"use client"`, no data access. The count-up
 * micro-animation is driven from the client wrapper (`DsrRecordMotion`) via the
 * `data-countup` hook below — and the ANIMATED numeral is `aria-hidden` with the
 * true value in an `sr-only` sibling, so assistive tech can never announce an
 * intermediate tally. A screen reader hearing "2 registros descartados" while the
 * true figure is 7 would be a false statement in the one artifact that must not
 * make them.
 */
export function DsrOutcomeRecord({ record }: { record: DsrOutcomeRecord }) {
  const outcomeLabel = record.outcome
    ? (DSR_OUTCOME_LABELS[record.outcome] ?? record.outcome)
    : null;

  return (
    <section
      aria-labelledby="dsr-outcome-heading"
      className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
    >
      <div data-rise className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FileText aria-hidden="true" className="size-4 text-primary" />
          <h2 id="dsr-outcome-heading" className="text-base font-semibold">
            Registro de desfecho
          </h2>
          <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {DSR_STATUS_LABELS[record.status] ?? record.status}
          </span>
          <DsrDueBadge dueDate={record.dueDate} closedAt={record.closedAt} />
        </div>
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          O que a instituição pode afirmar ao titular sobre esta solicitação. A
          declaração tem dois níveis, e eles não são equivalentes.
        </p>
        <DsrDueNotice />
      </div>

      {/* ---- The decision, when there is one ---------------------------- */}
      {outcomeLabel ? (
        <div
          data-rise
          className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-accent/50 p-4"
        >
          <div className="flex items-center gap-2">
            <Scale aria-hidden="true" className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">Decisão: {outcomeLabel}</h3>
          </div>
          {record.outcomeBasis ? (
            <p className="max-w-prose text-sm text-accent-foreground text-pretty">
              {record.outcomeBasis}
            </p>
          ) : null}
          {record.legalConsultationRef ? (
            <p className="text-xs text-muted-foreground">
              Consulta jurídica: {record.legalConsultationRef}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ---- The two tiers ---------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <article
          data-rise
          className="flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-4"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" className="size-4 text-success" />
            <h3 className="text-sm font-semibold">Nível mecânico</h3>
          </div>
          <p className="text-xs text-muted-foreground text-pretty">
            Registros localizados pelo índice do paciente e apagados pelas portas
            de descarte. A plataforma conhece estes números exatamente.
          </p>
          <dl className="flex flex-col gap-1.5 text-sm">
            <Tally label="Registros localizados" value={record.mechanical.total} />
            <Tally label="Descartados" value={record.mechanical.disposed} />
            <Tally label="Pendentes" value={record.mechanical.pending} />
            <Tally label="Retirados pela decisão" value={record.mechanical.retired} />
          </dl>
          <TierSum
            total={record.mechanical.total}
            parts={[
              record.mechanical.disposed,
              record.mechanical.pending,
              record.mechanical.retired,
            ]}
          />
          {record.mechanical.retired > 0 ? (
            <p className="text-xs text-muted-foreground text-pretty">
              Registros retirados pela decisão registrada — não foram descartados
              e permanecem preservados.
            </p>
          ) : null}
        </article>

        <article
          data-rise
          className="flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-4"
        >
          <div className="flex items-center gap-2">
            <UserCheck aria-hidden="true" className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">Nível atestado</h3>
          </div>
          <p className="text-xs text-muted-foreground text-pretty">
            Texto livre revisado por pessoa identificada. O índice do paciente não
            localiza um nome digitado em prosa — por isso este nível é uma
            declaração pessoal, e não uma contagem automática.
          </p>
          <dl className="flex flex-col gap-1.5 text-sm">
            <Tally label="Revisões solicitadas" value={record.attested.total} />
            <Tally label="Revisões concluídas" value={record.attested.completed} />
            <Tally label="Retiradas pela decisão" value={record.attested.retired} />
            <Tally label="Revisões pendentes" value={record.attested.pending} />
            <Tally label="Menções removidas" value={record.attested.redactions} />
          </dl>
          {/* ⭐ NOW AN EXACT-SUM CHECK, and only because the data earned it.
              `attested.pending` is COUNTED FROM THE ROWS
              (`att.filter(t => t.status === 'pending')`), not derived as
              `total - completed - retired`. That distinction is the whole reason
              this is a real assertion: a sum check over a derived remainder is an
              IDENTITY and can never fail, which would read as the stronger claim
              while proving nothing. Until the field existed this tier deliberately
              carried the weaker at-most guard instead. ⛔ If `pending` ever goes
              back to being derived, this must revert with it. */}
          <TierSum
            total={record.attested.total}
            parts={[
              record.attested.completed,
              record.attested.retired,
              record.attested.pending,
            ]}
          />
          {/* ⛔ CAUSE-NEUTRAL, AND IT HAD TO WIDEN. This read "a solicitação foi
              encerrada por uma decisão que não determinou erasão" — which went
              LIVE-FALSE the moment `adjudicate_dsr_request` began retiring an
              escalated meeting's own `attest_review`: in that case the request is
              OPEN and GRANTED, and the decision determined a FULLER erasure (the
              whole ata), which is exactly why the review was mooted. `retired` is a
              count and cannot say which of the two writers produced it, so this
              sentence states only what the count supports. Same rule as the task
              card: no surface names the cause of a retirement from status alone. */}
          {record.attested.retired > 0 ? (
            <p className="text-xs text-muted-foreground text-pretty">
              Revisões retiradas pela decisão registrada — não são revisões
              pendentes nem abandonadas.
            </p>
          ) : null}
          {record.attested.reviewers.length > 0 ? (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium">Atestado por</p>
              <ul className="flex flex-wrap gap-1.5">
                {record.attested.reviewers.map((name) => (
                  <li
                    key={name}
                    className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CircleDashed aria-hidden="true" className="size-3.5" />
              Nenhuma revisão atestada até o momento.
            </p>
          )}
        </article>
      </div>

      {/* ---- The residue: FIXED language, rendered verbatim -------------- */}
      <div data-rise className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">O que permanece</h3>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
          {record.residue.map((line) => (
            <li key={line} className="text-pretty">
              {line}
            </li>
          ))}
        </ul>

        {/* ⛔ MEETING LANE ONLY, AND CONDITIONAL IS THE POINT. This is the artifact
            handed to the DATA SUBJECT, so a retention named here that never happened
            is a false statement *to them* — the over-claim's mirror image. Gated on
            the positive completion signal (`meetingMinutesDisposed`), rendered BESIDE
            the shared notice and never merged into it: `record.residue` is the same
            constant the referral and case lanes render, where a claim about meeting
            titles or signature notes would be false. ADR 0056 Amdt 1. */}
        {record.meetingMinutesDisposed ? (
          <>
            <h3 className="mt-2 text-sm font-semibold">
              Nesta ata, também permanecem
            </h3>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
              {DSR_MEETING_RESIDUE_RETAINED.map((line) => (
                <li key={line} className="text-pretty">
                  {line}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </section>
  );
}

/**
 * One tally row.
 *
 * ⚠ THE ACCESSIBLE VALUE IS NEVER THE ANIMATING ONE. The visible numeral is
 * `aria-hidden` and carries the `data-countup` hook the client motion wrapper
 * animates; the `sr-only` sibling holds the true, static value. Assistive tech
 * therefore always reads the final figure, whatever the animation is doing — and
 * under `prefers-reduced-motion` the wrapper never runs, leaving the correct
 * number rendered from the server exactly as-is.
 */
/**
 * States the census arithmetic instead of asking the reader to trust it.
 *
 * ⚠ Renders a VISIBLE discrepancy notice when the parts do not sum, rather than
 * displaying a census that is quietly wrong. This is the exact regression that
 * produced `retired`: a task fell into neither bucket and `total` stopped matching,
 * with nothing on screen to say so. A legal record should say "these figures do not
 * reconcile" out loud rather than present a confident wrong total.
 */
function TierSum({ total, parts }: { total: number; parts: number[] }) {
  const sum = parts.reduce((a, b) => a + b, 0);
  if (sum === total) {
    return (
      <p className="text-xs text-muted-foreground tabular-nums">
        {parts.join(" + ")} = {total}
      </p>
    );
  }
  return (
    <p
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs font-medium text-destructive text-pretty"
    >
      Inconsistência na contagem: as partes somam {sum}, mas o total registrado é{" "}
      {total}. Não utilize estes números na resposta ao titular sem conferir.
    </p>
  );
}

function Tally({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">
        <span aria-hidden="true" data-countup={value}>
          {value}
        </span>
        <span className="sr-only">{value}</span>
      </dd>
    </div>
  );
}
