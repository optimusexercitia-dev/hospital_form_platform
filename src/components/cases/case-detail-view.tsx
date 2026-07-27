import { commissionHref } from "@/lib/routing";
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
import type { ResolvedPhaseResult } from "@/lib/queries/phase-results";
import type {
  CorrectionRequest,
  NarrativeRevision,
} from "@/lib/queries/corrections";
import type { CorrectionCaps } from "@/components/cases/correction-labels";
import { CaseCorrectionsPanel } from "@/components/cases/case-corrections-panel";
import { ReopenCaseButton } from "@/components/cases/reopen-case-button";
import { CasePhaseList, type AssigneeOption } from "@/components/cases/case-phase-list";
import { EditCaseMetaDialog } from "@/components/cases/edit-case-meta-dialog";
import type { Department } from "@/lib/hospitals/departments";
import { CaseActionItemsPanel } from "@/components/cases/case-action-items-panel";
import { CaseEventsTimeline } from "@/components/cases/case-events-timeline";
import { CaseTagsPanel } from "@/components/cases/case-tags-panel";
import { CaseDocumentsPanel } from "@/components/cases/case-documents-panel";
import { CaseOutcomeSelector } from "@/components/cases/case-outcome-selector";
import { CaseOfferedOutcomesEditor } from "@/components/cases/case-offered-outcomes-editor";
import type { CaseOutcome } from "@/lib/queries/case-outcomes";
import { CasePatientPanel } from "@/components/cases/case-patient-panel";
import { CaseCustomFieldsPanel } from "@/components/cases/case-custom-fields-panel";
import type { CaseCustomFieldValue } from "@/lib/queries/cases";
import {
  loadCasePatientForNotify,
  revealCasePatient,
  setCasePatient,
} from "@/lib/cases/actions";
import { CaseDetailMotion } from "@/components/cases/case-detail-motion";
import { InterviewsPanel } from "@/components/interviews/interviews-panel";
import { CaseMeetingsPanel } from "@/components/cases/case-meetings-panel";
import type { CaseMeetingLink } from "@/lib/queries/case-timeline";
import { NotifyEventDialog } from "@/components/safety/notify-event-dialog";
import { CaseOutboundReferralsCard } from "@/components/referrals/case-outbound-referrals-card";
import type {
  ReferralListItem,
  ReferralRequestedAction,
  ReferralType,
} from "@/lib/referrals/types";
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
  /** RV2 R2: the active requested-action vocabulary for the wizard's "o que se pede". */
  requestedActions: ReferralRequestedAction[];
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
  org,
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
  meetings = [],
  meetingsEnabled = false,
  patientSafetyEnabled,
  casePatientEnabled,
  narrativesEnabled,
  caseAccessEnabled,
  viewerId,
  myRole,
  withHeader,
  backHref,
  referralsModule,
  forwardParentReferralId = null,
  canManagePhaseResults = false,
  phaseResultOptions = [],
  outcomes = [],
  casesExtrasEnabled = false,
  actionItemsEnabled = false,
  canAssignPhases = false,
  canEditMeta = false,
  departments = [],
  caseCustomFieldsEnabled = false,
  customFields = [],
  correctionsEnabled = false,
  corrections = [],
  narrativeRevisions = {},
}: {
  /** Org slug for hrefs. */
  org: string;
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
  /** The meetings this case was discussed in (the reverse of a meeting's "Casos discutidos"). Default `[]`. */
  meetings?: CaseMeetingLink[];
  /** Whether the `meetings` flag is on (gates the rail card). Default `false`. */
  meetingsEnabled?: boolean;
  patientSafetyEnabled: boolean;
  /** Whether the `case_patient` flag is on (gates the patient reveal panel; ADR 0038). */
  casePatientEnabled: boolean;
  narrativesEnabled: boolean;
  /** Whether the `case_access` flag is on (gates the access panel + role chip). */
  caseAccessEnabled: boolean;
  /**
   * The inter-committee referrals module data (Phase 22 — `case_referrals`), or
   * `null`/absent when the flag is off → the outbound-referrals card is not
   * rendered. Assembled + gated by the host page.
   */
  referralsModule?: CaseReferralsModule | null;
  /** RV2 R3: the parent referral id when this case-detail was reached via an
   * "Encaminhar adiante" deep-link — threaded to the outbound card, which opens the
   * send wizard in forward mode. `null`/absent otherwise. */
  forwardParentReferralId?: string | null;
  /** The viewer's user id — for the per-narrative assignee check (Q14). */
  viewerId: string | null;
  /** The viewer's role chip (shown in the self-contained header only). */
  myRole: MyCaseRole;
  /** Render the self-contained header (staff route) vs rely on a layout (coordinator). */
  withHeader: boolean;
  /** Back-link target for the self-contained header. */
  backHref: string;
  /**
   * Whether the viewer may CORRECT a concluded phase's result post-conclusion
   * (phase-results feature; task #10): resolved at the host page as
   * `phaseResultsEnabled` + staff_admin/admin of the commission. Combined here with
   * the case being non-terminal. Default `false`.
   */
  canManagePhaseResults?: boolean;
  /** The commission's active result options (the correction dialog's picker). */
  phaseResultOptions?: ResolvedPhaseResult[];
  /**
   * The commission's non-archived outcome vocabulary — threaded for the
   * process-less offered-outcome editor (processless_cases). Default `[]` (e.g.
   * staff renders where the editor never shows, since it is coordinator-only).
   */
  outcomes?: CaseOutcome[];
  /** Whether `cases_extras` is on (gates the process-less offered-outcome editor). */
  casesExtrasEnabled?: boolean;
  /**
   * Whether the shared `action_items` flag is on — gates the per-item satellite
   * panel (reminders / updates / checklist) on each case action item. Default
   * `false`.
   */
  actionItemsEnabled?: boolean;
  /**
   * Whether the viewer may ACTIVATE / REASSIGN phases (ADR 0061) — resolved at the
   * host page via `canInCommission(access, 'assign_case_phases')`. OR-ed below with
   * the coordinator lifecycle capability so a coordinator always retains it. Default
   * `false` (a plain read/write grantee gets no phase-assignment controls).
   */
  canAssignPhases?: boolean;
  /**
   * Whether the viewer may EDIT this case's meta (label + department) — a coordinator
   * OR a `create_cases` Administrativo (ADR 0061), resolved at the host page via
   * `canInCommission(access, 'create_cases')`. Surfaces the "Editar" affordance in the
   * self-contained (staff-route) header on an OPEN case; the coordinator `(detail)`
   * layout renders its own edit-meta button. Default `false`.
   */
  canEditMeta?: boolean;
  /** The case's hospital ACTIVE departments — seeds the edit-meta dialog. Default `[]`. */
  departments?: Department[];
  /** Whether the `case_custom_fields` flag is on (gates the custom-fields panel; ADR 0083). */
  caseCustomFieldsEnabled?: boolean;
  /** The case's custom-field values (ADR 0083); `[]` when none / the flag is off. */
  customFields?: CaseCustomFieldValue[];
  /**
   * Whether the `case_corrections` flag is on (Case Correction Lifecycle, ADR 0085).
   * Gates the whole correction surface: the contextual "Corrigir…" affordances on
   * phase/narrative rows, the "Solicitações de correção" cockpit, and the "Reabrir
   * caso" control on a concluded case. Default `false` (no correction chrome).
   */
  correctionsEnabled?: boolean;
  /** Every correction request for this case, newest-first (RLS-scoped). Default `[]`. */
  corrections?: CorrectionRequest[];
  /** narrativeId → its revision history (newest-first). Default `{}`. */
  narrativeRevisions?: Record<string, NarrativeRevision[]>;
}) {
  const c = detail.case;
  const caps = detail.viewerCapabilities;
  // Activate/reassign: an `assign_case_phases` Administrativo OR anyone who already
  // manages lifecycle (a coordinator) — the latter keeps coordinators from regressing
  // regardless of what the page passes.
  const effectiveCanAssignPhases = canAssignPhases || caps.canManageLifecycle;
  const isOpen = !isTerminalCaseStatus(c.status);
  const offersOutcomes = detail.offeredOutcomes.length > 0;
  // A process-less case (templateId === null) has no template snapshot to freeze,
  // so its offered set stays editable by a coordinator while the case is open
  // (processless_cases + cases_extras). Templated cases keep the frozen snapshot.
  const isProcessless = c.templateId === null;
  const showOfferedEditor =
    isOpen && caps.canManageLifecycle && isProcessless && casesExtrasEnabled;

  const sorted = [...members].sort((a, b) => {
    const aKey = a.fullName || a.email || "";
    const bKey = b.fullName || b.email || "";
    return aKey.localeCompare(bKey, "pt-BR");
  });
  const assignees: AssigneeOption[] = sorted.map((m) => ({
    userId: m.userId,
    name: m.fullName ?? m.email ?? "Membro",
  }));

  // Case Correction Lifecycle (ADR 0085). The capability descriptor is a SIGNAL, not
  // the security boundary (RLS + the DEFINER doors are — Rule 1): filing is open to any
  // case-content reader while the case is OPEN; approve/reject mirror `canManageLifecycle`
  // (coordinator/admin). `null` when the flag is off → no correction chrome at all.
  const correctionCaps: CorrectionCaps | null = correctionsEnabled
    ? {
        enabled: true,
        canFile: isOpen,
        canApprove: caps.canManageLifecycle,
        viewerId,
      }
    : null;
  // The cockpit ("Solicitações de correção") resolves ids → human labels. Built from
  // data the host already loaded; the panel returns null when there are no requests.
  const phaseLabels: Record<string, string> = {};
  for (const p of detail.phases) {
    phaseLabels[p.id] = p.title || `Fase ${p.position}`;
  }
  const narrativeLabels: Record<string, string> = {};
  for (const n of detail.narratives) {
    narrativeLabels[n.id] = n.title || n.typeLabel;
  }
  const memberNames: Record<string, string> = {};
  for (const m of members) {
    memberNames[m.userId] = m.fullName ?? m.email ?? "Membro";
  }
  // "Reabrir caso" (staff_admin) shows only on a CONCLUDED case — a completed target on
  // a closed case must reopen first. `cancelled` is terminal-forever (HC0M8), so never
  // here. Flag-gated (the `reopen_case` door is too).
  const showReopenCase =
    correctionsEnabled &&
    c.status === "completed" &&
    caps.canManageLifecycle;

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

  // The audited isolated-PHI doors, bound to this case (ADR 0038). `revealCasePatient`
  // wraps the `get_case_patient` RPC (emits `case_patient.read`, returns null for an
  // unentitled reader); `setCasePatient` is the coordinator-only upsert. `.bind`
  // yields no-/single-arg server references safe to hand the client panel, so the
  // audited read fires only when a reader clicks "Exibir identificação".
  //
  // Rendered only when this case COLLECTS patient identifiers (`patientEnabled`) and
  // the flag is on. ETH·E3a (ADR 0064 D4): this panel is patient-SUBJECT framing, so
  // it must be ABSENT for a professional-subject case type (Ethics —
  // `primary_subject_kind = 'professional'`, whose subject detail lives in the
  // "Processo ético" tab, not this rail). `patientEnabled` is the canonical
  // patient-subject signal here — it is snapshotted at creation and is `false` for a
  // professional-subject case type, so the panel is already omitted for an ethics
  // case. (The frozen contract does not project `primary_subject_kind` onto
  // `CaseDetail`; `patientEnabled` is the available, equivalent guard. `terminology`
  // is available on `detail.terminology` should later copy need per-type wording.)
  const showPatientPanel = casePatientEnabled && c.patientEnabled;
  const revealPatient = revealCasePatient.bind(null, c.id);
  const savePatient = setCasePatient.bind(null, c.id);

  // Custom fields (ADR 0083) — the panel shows when the flag is on and the case has
  // any values. Edit authority mirrors the meta-edit door: a coordinator
  // (`canManageLifecycle`) OR a `create_cases` Administrativo (`canEditMeta`), and only
  // while the case is OPEN (terminal cases are frozen server-side, HC025).
  const showCustomFieldsPanel = caseCustomFieldsEnabled && customFields.length > 0;
  const canEditCustomFields = (caps.canManageLifecycle || canEditMeta) && isOpen;

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
                {isProcessless && (
                  <CaseStatusBadge label="Sem processo" colorToken="muted" />
                )}
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

            {/* Self-contained header action cluster (staff route only — the
                coordinator `(detail)` route renders its actions in the layout top bar
                with `withHeader={false}`). The NSP entry is leftmost and gated only on
                the flag, so any member may notify a safety event from an open OR
                concluded case (mirrors the coordinator top bar). Lifecycle MANAGEMENT
                lives on the coordinator `/manage/...` route, so here the right side
                only offers the "Gerenciar caso" link to a coordinator. */}
            {(patientSafetyEnabled ||
              caps.canManageLifecycle ||
              (isOpen && canEditMeta)) && (
              <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">
                {patientSafetyEnabled && (
                  <NotifyEventDialog
                    commissionId={c.commissionId}
                    caseId={c.id}
                    // Seed the NSP patient panel from this case's identifiers when it
                    // collects PHI (ADR 0038 — value copy via the audited door).
                    // Absent for a PHI-free case (no prefill offered).
                    onLoadPatientPrefill={
                      showPatientPanel
                        ? loadCasePatientForNotify.bind(null, c.id)
                        : undefined
                    }
                  />
                )}
                {/* Edit META (label + department) — the single audited edit door
                    (ADR 0061). Open-only (terminal cases are frozen, HC025). Shown to a
                    `create_cases` Administrativo on the staff route; coordinators edit
                    from the `(detail)` layout's own button. */}
                {isOpen && canEditMeta && (
                  <EditCaseMetaDialog
                    caseId={c.id}
                    currentLabel={c.label}
                    currentDepartmentId={c.departmentId}
                    currentDepartmentOther={c.departmentOther}
                    departments={departments}
                  />
                )}
                {caps.canManageLifecycle && (
                  <Link
                    href={commissionHref(org, slug, "manage", "cases", c.id)}
                    className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    Gerenciar caso
                  </Link>
                )}
              </div>
            )}
          </div>
        </header>
      )}

      <CaseDetailMotion className="flex w-full flex-col gap-8">
        {/* Patient-safety entry (Phase 14a) moved to the coordinator `(detail)`
            layout's top-bar "Notificar evento ao NSP" button, alongside the access
            roster (D3 of the layout-fixes batch). It now shows on terminal cases too
            (flag-gated, independent of case state). The staff `/casos/[caseId]` route
            mounts this SHARED body without that top bar; the NSP entry there follows
            its own route header. */}

        {/* Case-access grants moved to the coordinator `(detail)` layout's top-bar
            "Acesso ao caso" button + dialog (ADR 0033). This SHARED body — also mounted
            at the staff `/casos/[caseId]` route — no longer renders the inline panel;
            a coordinator manages access from the management route (reachable via the
            "Gerenciar caso" link above). */}

        {/* "Reabrir caso" (Case Correction Lifecycle, ADR 0085) — a concluded case is
            frozen, so its testimony can only be corrected after a staff_admin reopens
            it. Shown on BOTH routes (the coordinator layout has no top-bar slot for it). */}
        {showReopenCase && (
          <div
            data-rise
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="text-base font-semibold">Caso concluído</h2>
              <p className="max-w-prose text-sm text-muted-foreground text-pretty">
                Para corrigir ou anular fases e narrativas concluídas, reabra o caso
                primeiro. O motivo fica registrado.
              </p>
            </div>
            <div className="shrink-0">
              <ReopenCaseButton caseId={c.id} />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8 lg:items-start">
          {/* LEFT — phases + narratives, action items, working notes */}
          <div className="contents lg:flex lg:flex-col lg:gap-6">
            <div data-rise className="order-1 lg:order-none">
              <CasePhaseList
                org={org} slug={slug}
                detail={detailForLayout}
                assignees={assignees}
                isOpen={isOpen}
                caps={caps}
                canAssignPhases={effectiveCanAssignPhases}
                viewerId={viewerId}
                caseAccessEnabled={caseAccessEnabled}
                // Post-conclusion correction (task #10): staff_admin + flag on +
                // the case is non-terminal (open). The article also requires the
                // phase to be `concluida`.
                canCorrectResult={canManagePhaseResults && isOpen}
                resultOptions={phaseResultOptions}
                correctionCaps={correctionCaps}
                corrections={corrections}
                narrativeRevisions={narrativeRevisions}
              />
            </div>
            {correctionCaps && (
              <div data-rise className="order-2 lg:order-none">
                <CaseCorrectionsPanel
                  requests={corrections}
                  caps={correctionCaps}
                  phaseLabels={phaseLabels}
                  narrativeLabels={narrativeLabels}
                  memberNames={memberNames}
                />
              </div>
            )}
            <div data-rise className="order-2 lg:order-none">
              <CaseActionItemsPanel
                caseId={c.id}
                org={org}
                commission={slug}
                items={actionItems}
                assignees={assignees}
                phases={phaseOptions}
                canWrite={caps.canWriteContent}
                actionItemsEnabled={actionItemsEnabled}
              />
            </div>
            {referralsModule && (
              <div data-rise className="order-3 lg:order-none">
                <CaseOutboundReferralsCard
                  org={org} slug={slug}
                  sourceCaseId={c.id}
                  sourceCaseNumber={c.caseNumber}
                  referrals={referralsModule.referrals}
                  canManageLifecycle={caps.canManageLifecycle}
                  referralTypes={referralsModule.referralTypes}
                  requestedActions={referralsModule.requestedActions}
                  targetCommissions={referralsModule.targetCommissions}
                  narratives={referralsModule.narratives}
                  documents={referralsModule.documents}
                  forwardParentReferralId={forwardParentReferralId}
                />
              </div>
            )}
            <div data-rise className="order-6 lg:order-none">
              <CaseEventsTimeline
                caseId={c.id}
                events={events}
                canWrite={caps.canWriteContent}
                // ETH·E3a: only a coordinator may set a record's visibility to
                // "coordinator_only"; a plain write-grantee's form omits the field.
                canSetVisibility={caps.canManageLifecycle}
              />
            </div>
          </div>

          {/* RAIL — reference material (compact variant) */}
          <div className="contents lg:flex lg:flex-col lg:gap-4">
            {showPatientPanel && (
              <div data-rise className="order-2 lg:order-none">
                <CasePatientPanel
                  hasPatient={c.hasPatient}
                  canEdit={caps.canManageLifecycle}
                  onReveal={revealPatient}
                  onSave={savePatient}
                />
              </div>
            )}
            {showCustomFieldsPanel && (
              <div data-rise className="order-2 lg:order-none">
                <CaseCustomFieldsPanel
                  caseId={c.id}
                  fields={customFields}
                  canEdit={canEditCustomFields}
                />
              </div>
            )}
            <div data-rise className="order-3 lg:order-none">
              <CaseTagsPanel
                org={org} slug={slug}
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
                  org={org} slug={slug}
                  caseId={c.id}
                  interviews={interviews}
                  phases={phaseOptions}
                  canCreate={caps.canManageLifecycle}
                  variant="rail"
                />
              </div>
            )}
            {meetingsEnabled && (
              <div data-rise className="order-6 lg:order-none">
                <CaseMeetingsPanel
                  org={org} slug={slug}
                  meetings={meetings}
                  variant="rail"
                />
              </div>
            )}
          </div>
        </div>

        {isOpen && caps.canManageLifecycle && (offersOutcomes || showOfferedEditor) && (
          <div data-rise className="flex flex-col gap-3">
            {offersOutcomes && (
              <CaseOutcomeSelector
                caseId={c.id}
                offeredOutcomes={detail.offeredOutcomes}
                current={detail.outcome}
              />
            )}
            {/* Process-less cases (templateId === null) keep an EDITABLE offered
                set — the coordinator can grow/shrink it while the case is open
                (processless_cases). Templated cases keep their frozen snapshot, so
                no editor renders for them. */}
            {showOfferedEditor && (
              <div className="flex justify-end">
                <CaseOfferedOutcomesEditor
                  caseId={c.id}
                  commissionId={c.commissionId}
                  outcomes={outcomes}
                  offeredOutcomes={detail.offeredOutcomes}
                />
              </div>
            )}
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
