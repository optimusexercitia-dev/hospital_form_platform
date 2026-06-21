"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Send } from "lucide-react";

import type { ReferralListItem, ReferralType } from "@/lib/referrals/types";
import { Button } from "@/components/ui/button";
import {
  ReferralStatusChip,
  ReferralTypeChip,
  ResponseExpectedChip,
} from "./referral-chips";
import { loadCaseSafetyPrefill } from "@/lib/referrals/actions";
import {
  ReferralSendWizard,
  type PickableDocument,
  type PickableNarrative,
  type ReferralTargetCommission,
} from "./referral-send-wizard";
import { formatDate, formatReferralCode } from "./format";
import { RESOLVED_REFERRAL_STATUSES } from "@/lib/referrals/types";

/**
 * The outbound-referrals card on the case detail (Decision 12), mounted in the
 * LEFT column of {@link import('@/components/cases/case-detail-view').CaseDetailView}.
 * Lists the referrals THIS case sent to other committees with their status + reply
 * affordance, and — for a coordinator (`canManageLifecycle`) — an "Encaminhar
 * caso" button that opens the multi-step send wizard.
 *
 * PHI-FREE: the list shows only governance metadata (code, subject, type, status,
 * target, dates). Opening a referral routes to its detail, where the snapshot and
 * any PHI re-gate server-side.
 *
 * A `"use client"` shell — it owns the wizard's open state — fed plain props by the
 * server host page. The wizard's inputs (types / target commissions / pickable
 * narratives + documents) are passed straight through, so the host page owns all
 * data-loading (Rule 9). The safety-event PHI pre-fill is the one exception: it is
 * loaded LAZILY by the wizard via the `loadCaseSafetyPrefill` `"use server"` action
 * (`@/lib/referrals/actions`) — an audited PHI read fired on intent, not at card mount.
 */
export function CaseOutboundReferralsCard({
  slug,
  sourceCaseId,
  sourceCaseNumber,
  referrals,
  canManageLifecycle,
  referralTypes,
  targetCommissions,
  narratives,
  documents,
}: {
  slug: string;
  sourceCaseId: string;
  sourceCaseNumber: number | null;
  referrals: ReferralListItem[];
  /** Whether the viewer may send referrals (coordinator/admin; mirrors `close_case`). */
  canManageLifecycle: boolean;
  referralTypes: ReferralType[];
  targetCommissions: ReferralTargetCommission[];
  narratives: PickableNarrative[];
  documents: PickableDocument[];
}) {
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <section
      aria-labelledby="case-referrals-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ArrowLeftRight
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h2 id="case-referrals-heading" className="text-base font-semibold">
            Encaminhamentos
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {referrals.length}
          </span>
        </div>
        {canManageLifecycle && (
          <Button type="button" size="sm" onClick={() => setWizardOpen(true)}>
            <Send aria-hidden="true" />
            Encaminhar caso
          </Button>
        )}
      </div>

      {referrals.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground text-pretty">
          {canManageLifecycle
            ? "Nenhum encaminhamento. Encaminhe este caso a outra comissão para análise ou ciência."
            : "Nenhum encaminhamento para outra comissão."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {referrals.map((r) => {
            const inFlight = !RESOLVED_REFERRAL_STATUSES.has(r.status);
            return (
              <li
                key={r.id}
                className="flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/20 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatReferralCode(r.code)}
                  </span>
                  <ReferralStatusChip status={r.status} />
                  {r.responseExpected && inFlight && <ResponseExpectedChip />}
                </div>
                <Link
                  href={`/c/${slug}/encaminhamentos/${r.id}`}
                  className="rounded text-sm font-medium text-foreground underline-offset-2 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  {r.subject}
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <ReferralTypeChip
                    label={r.typeLabel}
                    colorToken={r.typeColorToken}
                  />
                  <span>
                    para {r.targetCommissionName ?? "comissão"}
                    {" · "}
                    {formatDate(r.sentAt ?? r.createdAt)}
                  </span>
                </div>
                {r.hasReply && (
                  <p className="text-xs text-success">
                    Resposta recebida — abra para ver o resultado.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManageLifecycle && (
        <ReferralSendWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          sourceCaseId={sourceCaseId}
          sourceCaseNumber={sourceCaseNumber}
          referralTypes={referralTypes}
          targetCommissions={targetCommissions}
          narratives={narratives}
          documents={documents}
          onLoadSafetyPrefill={() => loadCaseSafetyPrefill(sourceCaseId)}
        />
      )}
    </section>
  );
}
