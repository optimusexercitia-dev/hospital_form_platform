import { CircleSlash, Info } from "lucide-react";

import {
  REFERRAL_DECLINE_REASON_LABELS,
  type ReferralDetail,
} from "@/lib/referrals/types";
import {
  ReferralOverdueChip,
  ReferralPriorityChip,
  ReferralStatusChip,
  ResponseExpectedChip,
} from "./referral-chips";
import { formatDateTime } from "./format";

/**
 * The rail "Detalhes" card — every referral FACT the minimal header no longer
 * carries (RDR D1). A quiet `dl` of label/value rows: the label and the value are
 * SEPARATE elements (no "Label: value" prose), so a value can be asserted without
 * dragging its label along.
 *
 * Null rows are hidden outright — a referral that was never decided shows no
 * "Decidido" row rather than an em dash. `targetCommissionId` is NULL on a
 * technical-direction referral, so "Para" reads the query layer's already-composed
 * {@link ReferralDetail.targetCommissionName} (the Diretor Técnico's display name)
 * and never dereferences the id.
 *
 * PHI-FREE: governance metadata only (commission names, timestamps, the structured
 * decline reason code). Server-Component safe — no client hooks.
 */
export function ReferralDetailsCard({ detail }: { detail: ReferralDetail }) {
  const inFlight = !detail.concludedAt && !detail.withdrawnAt;

  return (
    <section
      aria-labelledby="referral-details-heading"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs"
    >
      <div className="flex items-center gap-2">
        <Info aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 id="referral-details-heading" className="text-sm font-semibold">
          Detalhes
        </h2>
      </div>

      <dl className="flex flex-col gap-2.5 text-sm">
        <Row label="De" value={detail.sourceCommissionName} />
        <Row label="Para" value={detail.targetCommissionName} />
        <Row label="Ação solicitada" value={detail.requestedActionLabel} />

        <Row label="Status">
          <span className="flex flex-wrap items-center gap-1.5">
            <ReferralStatusChip status={detail.status} />
            {detail.overdue ? <ReferralOverdueChip /> : null}
          </span>
        </Row>

        {detail.priority !== "routine" ? (
          <Row label="Prioridade">
            <ReferralPriorityChip priority={detail.priority} />
          </Row>
        ) : null}

        {detail.responseExpected && inFlight ? (
          <Row label="Resposta">
            <ResponseExpectedChip />
          </Row>
        ) : null}

        {detail.responseDueAt ? (
          <Row label="Prazo de resposta">
            <span
              className={
                detail.overdue
                  ? "font-medium text-destructive tabular-nums"
                  : "tabular-nums"
              }
            >
              {formatDateTime(detail.responseDueAt)}
              {detail.overdue ? " · vencido" : ""}
            </span>
          </Row>
        ) : null}

        <Row
          label="Criado"
          value={`${formatDateTime(detail.createdAt)}${
            detail.createdByName ? ` por ${detail.createdByName}` : ""
          }`}
          numeric
        />
        {detail.sentAt ? (
          <Row label="Enviado" value={formatDateTime(detail.sentAt)} numeric />
        ) : null}
        {detail.receivedAt ? (
          <Row
            label="Recebido"
            value={formatDateTime(detail.receivedAt)}
            numeric
          />
        ) : null}
        {detail.decidedAt ? (
          <Row
            label="Decidido"
            value={formatDateTime(detail.decidedAt)}
            numeric
          />
        ) : null}
        {detail.concludedAt ? (
          <Row
            label="Concluído"
            value={formatDateTime(detail.concludedAt)}
            numeric
          />
        ) : null}
        {detail.withdrawnAt ? (
          <Row
            label="Retirado"
            value={formatDateTime(detail.withdrawnAt)}
            numeric
          />
        ) : null}
      </dl>

      {/* RV2 R2: the PHI-free STRUCTURED decline reason (distinct from the PHI-gated
          decline note). Only a `rejected` referral carries one; the header status
          chip already says "recusada", so this row supplies the why. */}
      {detail.status === "rejected" && detail.declineReasonCode ? (
        <div className="flex flex-col gap-1 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2">
          <dl>
            <dt className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
              <CircleSlash aria-hidden="true" className="size-3.5" />
              Motivo da recusa
            </dt>
            <dd className="text-sm text-destructive text-pretty">
              {REFERRAL_DECLINE_REASON_LABELS[detail.declineReasonCode]}
            </dd>
          </dl>
        </div>
      ) : null}
    </section>
  );
}

/**
 * One label/value row. Renders NOTHING when a plain `value` is null/blank and no
 * `children` were supplied — the "null rows hidden" rule, kept in one place so no
 * call site can forget it.
 */
function Row({
  label,
  value,
  children,
  numeric = false,
}: {
  label: string;
  value?: string | null;
  children?: React.ReactNode;
  /** Tabular figures for timestamps. */
  numeric?: boolean;
}) {
  if (children == null && !value?.trim()) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={
          numeric
            ? "text-sm text-foreground tabular-nums text-pretty"
            : "text-sm text-foreground text-pretty"
        }
      >
        {children ?? value}
      </dd>
    </div>
  );
}
