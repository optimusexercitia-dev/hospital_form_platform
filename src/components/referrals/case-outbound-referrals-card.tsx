"use client";

import { commissionHref } from "@/lib/routing";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Send } from "lucide-react";

import type {
  ReferralListItem,
  ReferralRequestedAction,
  ReferralType,
} from "@/lib/referrals/types";
import { Button } from "@/components/ui/button";
import {
  ReferralStatusChip,
  ReferralTypeChip,
  ResponseExpectedChip,
} from "./referral-chips";
import {
  loadCaseSafetyPrefill,
  loadReferralDraft,
  revealReferralPatient,
} from "@/lib/referrals/actions";
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
  org,
  slug,
  sourceCaseId,
  sourceCaseNumber,
  referrals,
  canManageLifecycle,
  referralTypes,
  requestedActions,
  targetCommissions,
  technicalDirectionHospitalId,
  narratives,
  documents,
  forwardParentReferralId,
}: {
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  sourceCaseId: string;
  sourceCaseNumber: number | null;
  referrals: ReferralListItem[];
  /** Whether the viewer may send referrals (coordinator/admin; mirrors `close_case`). */
  canManageLifecycle: boolean;
  referralTypes: ReferralType[];
  /** RV2 R2: the requested-action vocabulary for the wizard. */
  requestedActions: ReferralRequestedAction[];
  targetCommissions: ReferralTargetCommission[];
  /** ADR 0094 W4 — the source commission's own hospital, which enables the "direção
   * técnica" destination in the send wizard. `null` when the `technical_director`
   * flag is off or the commission has no hospital. */
  technicalDirectionHospitalId?: string | null;
  narratives: PickableNarrative[];
  documents: PickableDocument[];
  /** RV2 R3: when this case-detail was reached via an "Encaminhar adiante"
   * deep-link (`?encaminharDe=<referralId>`), the parent referral id to seed the new
   * draft's lineage — the wizard opens automatically in forward mode. `null`
   * otherwise. */
  forwardParentReferralId?: string | null;
}) {
  // Auto-open the wizard in forward mode on arrival via an "Encaminhar adiante"
  // deep-link. Initialized once (a full navigation mounts fresh); a later
  // router.refresh() preserves this client state, so the wizard is not re-opened
  // after a forward is sent + closed.
  const [wizardOpen, setWizardOpen] = useState(
    Boolean(forwardParentReferralId) && canManageLifecycle,
  );
  /**
   * The `rascunho` the wizard is RESUMING (ADR 0137 D6), or `null` for a fresh
   * referral. Cleared whenever the wizard closes, so the next "Encaminhar caso"
   * cannot inherit the previous resume target — a stale id here would silently reopen
   * someone else's draft instead of starting a new referral.
   */
  const [resumeReferralId, setResumeReferralId] = useState<string | null>(null);

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
          <Button
            type="button"
            size="sm"
            onClick={() => {
              // Always a FRESH referral — clear any resume target first.
              setResumeReferralId(null);
              setWizardOpen(true);
            }}
          >
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
                {/* ADR 0137 **D6** — a `rascunho` reopens the WIZARD; every other
                    status keeps navigating to the detail page. A draft has no
                    recipient and nothing frozen for anyone to read, so the detail
                    page has almost nothing to show it; the wizard is where the work
                    actually continues. Gated on `canManageLifecycle` too: resuming is
                    an authoring act, and a non-coordinator never had the wizard. */}
                {r.status === "draft" && canManageLifecycle ? (
                  <button
                    type="button"
                    onClick={() => {
                      setResumeReferralId(r.id);
                      setWizardOpen(true);
                    }}
                    className="rounded text-left text-sm font-medium text-foreground underline-offset-2 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    {r.subject}
                  </button>
                ) : (
                  <Link
                    href={commissionHref(org, slug, "encaminhamentos", r.id)}
                    className="rounded text-sm font-medium text-foreground underline-offset-2 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    {r.subject}
                  </Link>
                )}
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
                  {/* ⛔ REACHABILITY, not new UI. ADR 0137 D6 keeps the discard-draft
                      affordance on the detail page — but once the subject above opens
                      the wizard instead of linking, and given the hub deliberately does
                      NOT list drafts, that page would have had NO in-app path left and
                      discarding a draft would have become a URL-only act. This link is
                      what keeps D6's sentence true. */}
                  {r.status === "draft" && canManageLifecycle && (
                    <Link
                      href={commissionHref(org, slug, "encaminhamentos", r.id)}
                      className="rounded underline underline-offset-2 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                    >
                      Abrir detalhes
                    </Link>
                  )}
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
          // Keyed on the resume target so reopening a DIFFERENT draft remounts the
          // wizard. Without this, its once-only resume guard (`resumeState`) would
          // still read "loaded" from the previous draft and the second one would
          // render the first one's content.
          key={resumeReferralId ?? "new"}
          open={wizardOpen}
          onOpenChange={(next) => {
            setWizardOpen(next);
            if (!next) setResumeReferralId(null);
          }}
          resumeReferralId={resumeReferralId}
          onLoadDraft={loadReferralDraft}
          onLoadPatient={revealReferralPatient}
          sourceCaseId={sourceCaseId}
          sourceCaseNumber={sourceCaseNumber}
          referralTypes={referralTypes}
          requestedActions={requestedActions}
          targetCommissions={targetCommissions}
          technicalDirectionHospitalId={technicalDirectionHospitalId}
          narratives={narratives}
          documents={documents}
          parentReferralId={forwardParentReferralId ?? null}
          onLoadSafetyPrefill={() => loadCaseSafetyPrefill(sourceCaseId)}
        />
      )}
    </section>
  );
}
