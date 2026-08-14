import { CircleSlash, Info } from "lucide-react";

import {
  REFERRAL_DECLINE_REASON_LABELS,
  type ReferralDetail,
} from "@/lib/referrals/types";
import {
  ReferralOverdueChip,
  ReferralPriorityChip,
  ReferralStatusChip,
} from "./referral-chips";
import { ReferralDeadlineButton } from "./referral-deadline-button";
import { formatDateTime } from "./format";

/**
 * The rail "Detalhes" card — the referral's core FACTS, deliberately SHORT: origin,
 * requested action, priority, created, response deadline, status. Nothing else.
 *
 * The long lifecycle-timestamp ledger this card used to carry (enviado / recebido /
 * decidido / concluído / retirado, plus the destination and the "resposta esperada"
 * chip) is gone: every one of those moments is already narrated, in order and with its
 * actor, by the synthesized system rows interleaved into the Diálogo (RDR D7). Two
 * renderings of the same timeline made the rail long without adding a fact.
 *
 * A quiet `dl` of label/value rows: the label and the value are SEPARATE elements (no
 * "Label: value" prose), so a value can be asserted without dragging its label along.
 * The deadline row is the one interactive one — the coordinator control that CHANGES it
 * sits beside the value it changes, rather than in a distant action panel.
 *
 * PHI-FREE: governance metadata only (commission names, timestamps, the structured
 * decline reason code). A Server Component — `ReferralDeadlineButton` is the sole
 * client island it renders.
 */
export function ReferralDetailsCard({
  detail,
  canSetDeadline = false,
}: {
  detail: ReferralDetail;
  /**
   * Whether THIS viewer may set/change the response deadline — decide it with
   * `canSetReferralDeadline` rather than restating its status set here. When false the
   * deadline is read-only, and the row hides entirely if none is set.
   */
  canSetDeadline?: boolean;
}) {
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
        <Row label="Ação solicitada" value={detail.requestedActionLabel} />

        <Row label="Prioridade">
          <ReferralPriorityChip priority={detail.priority} />
        </Row>

        <Row
          label="Criado"
          value={`${formatDateTime(detail.createdAt)}${
            detail.createdByName ? ` por ${detail.createdByName}` : ""
          }`}
          numeric
        />

        {/* The deadline and the control that changes it, together. The row survives an
            EMPTY deadline whenever the viewer may set one — otherwise "Definir prazo"
            would have nowhere to live for the referral that most needs it. */}
        {detail.responseDueAt || canSetDeadline ? (
          <Row label="Prazo de resposta">
            <span className="flex flex-wrap items-center justify-between gap-2">
              {detail.responseDueAt ? (
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
              ) : (
                <span className="text-muted-foreground">Sem prazo definido</span>
              )}
              {canSetDeadline ? (
                <ReferralDeadlineButton
                  referralId={detail.id}
                  responseDueAt={detail.responseDueAt}
                  size="xs"
                />
              ) : null}
            </span>
          </Row>
        ) : null}

        <Row label="Status">
          <span className="flex flex-wrap items-center gap-1.5">
            <ReferralStatusChip status={detail.status} />
            {detail.overdue ? <ReferralOverdueChip /> : null}
          </span>
        </Row>
      </dl>

      {/* RV2 R2: the PHI-free STRUCTURED decline reason (distinct from the PHI-gated
          decline note). Only a `rejected` referral carries one; the status chip above
          already says "recusada", so this block supplies the why — and it is the only
          surface that carries it. */}
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
