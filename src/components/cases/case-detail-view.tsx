import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import type { CaseDetail } from "@/lib/queries/cases";
import type { CaseActionItem } from "@/lib/queries/case-action-items";
import type { CaseDocumentWithUrl, CaseEvent } from "@/lib/queries/case-documents";
import type { CaseTag } from "@/lib/queries/case-tags";
import type { InterviewListItem } from "@/lib/queries/interviews";
import type { MemberListItem } from "@/lib/queries/members";
import { isTerminalCaseStatus } from "@/lib/cases/case-status";
import {
  CaseStatusBadge,
  CaseStatusBadgeFixed,
} from "@/components/cases/case-status-badge";
import { CaseRoleChip } from "@/components/cases/case-role-chip";
import { CasePhaseList, type AssigneeOption } from "@/components/cases/case-phase-list";
import { CaseActionItemsPanel } from "@/components/cases/case-action-items-panel";
import { CaseEventsTimeline } from "@/components/cases/case-events-timeline";
import { CaseTagsPanel } from "@/components/cases/case-tags-panel";
import { CaseDocumentsPanel } from "@/components/cases/case-documents-panel";
import { CaseOutcomeSelector } from "@/components/cases/case-outcome-selector";
import { CaseDetailMotion } from "@/components/cases/case-detail-motion";
import { InterviewsPanel } from "@/components/interviews/interviews-panel";
import { NotifyEventDialog } from "@/components/safety/notify-event-dialog";
import { CaseOutboundReferralsCard } from "@/components/referrals/case-outbound-referrals-card";
import type { ReferralListItem, ReferralType } from "@/lib/referrals/types";
import type {
  PickableDocument,
  PickableNarrative,
  ReferralTargetCommission,
} from "@/components/referrals/referral-send-wizard";
import { formatCaseNumber, formatDate } from "@/components/cases/format";
import type { MyCaseRole } from "@/lib/queries/cases";

/**
 * Everything the case-detail outbound-referrals card (Phase 22 — `case_referrals`)
 * needs, assembled by the host page (Rule 9 — data-loading on the server). Passed
 * as ONE optional prop so the card mounts only when the flag is on; `null`/absent
 * → the card is not rendered (flag-OFF behavior unchanged). PHI-FREE — the
 * safety-event PHI pre-fill is NOT here; the wizard loads it lazily on demand via
 * the audited `loadCaseSafetyPrefill` bridge.
 */
export interface CaseReferralsModule {
  referrals: ReferralListItem[];
  referralTypes: ReferralType[];
  targetCommissions: ReferralTargetCommission[];
  narratives: PickableNarrative[];
  documents: PickableDocument[];
}

/**
 * The SINGLE capability-gated case-detail body (Case Access Control increment, ADR
 * 0033 D7). Mounted at BOTH the coordinator route (`/c/[slug]/manage/cases/[caseId]`,
 * full caps via `get_case_detail`'s coordinator-grade default) AND the staff route
 * (`/c/[slug]/casos/[caseId]`, caps from `viewerCapabilities`). Generalizes the
 * interviews `viewerCanWrite` signal to a three-way descriptor:
 *  - `canManageLifecycle` → the header lifecycle menu, phase activate/skip/reassign,
 *    the outcome selector, and the access panel (coordinator/admin only).
 *  - `canWriteContent` → the content editors (action items, documents, tags, events)
 *    + un-attributed-narrative editing (a write-grantee "collaborator").
 *  - else → pure read.
 *
 * The DATA is loaded by the host page (server) and passed as plain props; this
 * component owns only composition + gating. The narratives carry their assignment
 * via the FE adapter ({@link import('./narrative-access')}) until BE-4 widens the type.
 *
 * `withHeader` lets the coordinator route keep its richer `(detail)` layout chrome
 * (back-link + tab bar live in the layout, so it passes `withHeader={false}`), while
 * the staff route renders the self-contained header here (`withHeader={true}`).
 */
export function CaseDetailView({
  slug,
  detail,
  members,
  documents,
  events,
  tags,
  caseTags,
  actionItems,
  interviews,
  interviewsEnabled,
  patientSafetyEnabled,
  narrativesEnabled,
  caseAccessEnabled,
  viewerId,
  myRole,
  withHeader,
  backHref,
  referralsModule,
}: {
  slug: string;
  detail: CaseDetail;
  members: MemberListItem[];
  documents: CaseDocumentWithUrl[];
  events: CaseEvent[];
  tags: CaseTag[];
  caseTags: CaseTag[];
  actionItems: CaseActionItem[];
  interviews: InterviewListItem[];
  interviewsEnabled: boolean;
  patientSafetyEnabled: boolean;
  narrativesEnabled: boolean;
  /** Whether the `case_access` flag is on (gates the access panel + role chip). */
  caseAccessEnabled: boolean;
  /**
   * The inter-committee referrals module data (Phase 22 — `case_referrals`), or
   * `null`/absent when the flag is off → the outbound-referrals card is not
   * rendered. Assembled + gated by the host page.
   */
  referralsModule?: CaseReferralsModule | null;
  /** The viewer's user id — for the per-narrative assignee check (Q14). */
  viewerId: string | null;
  /** The viewer's role chip (shown in the self-contained header only). */
  myRole: MyCaseRole;
  /** Render the self-contained header (staff route) vs rely on a layout (coordinator). */
  withHeader: boolean;
  /** Back-link target for the self-contained header. */
  backHref: string;
}) {
  const c = detail.case;
  const caps = detail.viewerCapabilities;
  const isOpen = !isTerminalCaseStatus(c.status);
  const offersOutcomes = detail.offeredOutcomes.length > 0;

  const sorted = [...members].sort((a, b) => {
    const aKey = a.fullName || a.email || "";
    const bKey = b.fullName || b.email || "";
    return aKey.localeCompare(bKey, "pt-BR");
  });
  const assignees: AssigneeOption[] = sorted.map((m) => ({
    userId: m.userId,
    name: m.fullName ?? m.email ?? "Membro",
  }));

  // Narratives (ADR 0032/0033): the narrative SLOTS are part of the case structure
  // (like phases), so ANYONE who can read the case sees them — including empty /
  // un-attributed ones (a read grantee or a phase/narrative assignee, not just
  // writers). The per-card Editar affordance stays gated by `canEditNarrative`, so a
  // reader sees the slot without an edit control. EXCEPTION: on a CLOSED (terminal)
  // case, never-filled slots are dropped as noise (decision 7 / AC-7). Feature off →
  // none.
  const visibleNarratives = !narrativesEnabled
    ? []
    : isOpen
      ? detail.narratives
      : detail.narratives.filter((n) => (n.bodyMd ?? "").trim().length > 0);
  const detailForLayout = { ...detail, narratives: visibleNarratives };

  // Phases for the action-item "origin phase" picker (id + label only).
  const phaseOptions = [...detail.phases]
    .sort((a, b) => a.position - b.position)
    .map((p) => ({ id: p.id, label: p.title || `Fase ${p.position}` }));

  const body = (
    <>
      {withHeader && (
        <header className="flex flex-col gap-4">
          <Link
            href={backHref}
            className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Meus Casos
          </Link>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl text-balance">
                  {formatCaseNumber(c.caseNumber)}
                </h1>
                <CaseStatusBadgeFixed status={c.status} />
                {detail.outcome && (
                  <CaseStatusBadge
                    label={detail.outcome.label}
                    colorToken={detail.outcome.colorToken}
                  />
                )}
                {caseAccessEnabled && <CaseRoleChip role={myRole} />}
              </div>
              {c.label && (
                <p className="max-w-prose text-muted-foreground text-pretty">
                  {c.label}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Criado em {formatDate(c.createdAt)}
                {c.closedAt ? ` · Encerrado em ${formatDate(c.closedAt)}` : ""}
              </p>
            </div>

            {/* Lifecycle MANAGEMENT (activate/close/cancel/add-phase + its form +
                expected-narrative pickers) lives on the coordinator `/manage/...`
                route, whose `(detail)` layout loads the data it needs. The staff
                full-case header is a read/contribute surface; a coordinator who needs
                to run lifecycle uses the management route. Phase-level + content +
                access actions below still honour `caps`. */}
            {caps.canManageLifecycle && (
              <Link
                href={`/c/${slug}/manage/cases/${c.id}`}
                className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                Gerenciar caso
              </Link>
            )}
          </div>
        </header>
      )}

      <CaseDetailMotion className="flex w-full flex-col gap-8">
        {/* Patient-safety entry (Phase 14a): any commission member may notify the
            NSP of a safety event raised from this case. Flag-gated. A read-only
            viewer can still raise a safety event (it is not a case-workflow op). */}
        {patientSafetyEnabled && (
          <div data-rise className="flex justify-end">
            <NotifyEventDialog commissionId={c.commissionId} caseId={c.id} />
          </div>
        )}

        {/* Case-access grants moved to the coordinator `(detail)` layout's top-bar
            "Acesso ao caso" button + dialog (ADR 0033). This SHARED body — also mounted
            at the staff `/casos/[caseId]` route — no longer renders the inline panel;
            a coordinator manages access from the management route (reachable via the
            "Gerenciar caso" link above). */}

        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8 lg:items-start">
          {/* LEFT — phases + narratives, action items, working notes */}
          <div className="contents lg:flex lg:flex-col lg:gap-6">
            <div data-rise className="order-1 lg:order-none">
              <CasePhaseList
                slug={slug}
                detail={detailForLayout}
                assignees={assignees}
                isOpen={isOpen}
                caps={caps}
                viewerId={viewerId}
                caseAccessEnabled={caseAccessEnabled}
              />
            </div>
            <div data-rise className="order-2 lg:order-none">
              <CaseActionItemsPanel
                caseId={c.id}
                items={actionItems}
                assignees={assignees}
                phases={phaseOptions}
                canWrite={caps.canWriteContent}
              />
            </div>
            {referralsModule && (
              <div data-rise className="order-3 lg:order-none">
                <CaseOutboundReferralsCard
                  slug={slug}
                  sourceCaseId={c.id}
                  sourceCaseNumber={c.caseNumber}
                  referrals={referralsModule.referrals}
                  canManageLifecycle={caps.canManageLifecycle}
                  referralTypes={referralsModule.referralTypes}
                  targetCommissions={referralsModule.targetCommissions}
                  narratives={referralsModule.narratives}
                  documents={referralsModule.documents}
                />
              </div>
            )}
            <div data-rise className="order-6 lg:order-none">
              <CaseEventsTimeline
                caseId={c.id}
                events={events}
                canWrite={caps.canWriteContent}
              />
            </div>
          </div>

          {/* RAIL — reference material (compact variant) */}
          <div className="contents lg:flex lg:flex-col lg:gap-4">
            <div data-rise className="order-3 lg:order-none">
              <CaseTagsPanel
                slug={slug}
                caseId={c.id}
                assigned={caseTags}
                vocabulary={tags}
                variant="rail"
                canWrite={caps.canWriteContent}
              />
            </div>
            <div data-rise className="order-4 lg:order-none">
              <CaseDocumentsPanel
                caseId={c.id}
                documents={documents}
                variant="rail"
                canWrite={caps.canWriteContent}
              />
            </div>
            {interviewsEnabled && (
              <div data-rise className="order-5 lg:order-none">
                <InterviewsPanel
                  slug={slug}
                  caseId={c.id}
                  interviews={interviews}
                  phases={phaseOptions}
                  canCreate={caps.canManageLifecycle}
                  variant="rail"
                />
              </div>
            )}
          </div>
        </div>

        {isOpen && offersOutcomes && caps.canManageLifecycle && (
          <div data-rise>
            <CaseOutcomeSelector
              caseId={c.id}
              offeredOutcomes={detail.offeredOutcomes}
              current={detail.outcome}
            />
          </div>
        )}
      </CaseDetailMotion>
    </>
  );

  // The staff route renders this standalone (so it owns the page container + header
  // spacing); the coordinator route mounts it INSIDE the `(detail)` layout's
  // container + header, so it returns the bare body to avoid a double-wrapped width.
  if (!withHeader) return body;
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">{body}</div>
  );
}
