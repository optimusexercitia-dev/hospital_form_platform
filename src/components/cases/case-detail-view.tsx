import { commissionHref } from "@/lib/routing";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";

import type { CaseTemplateProvenance as TemplateProvenance } from "@/lib/queries/process-templates";
import { CaseTemplateProvenance } from "@/components/cases/case-template-provenance";

import type { CaseDetail, CaseViewerCapabilities } from "@/lib/queries/cases";
import type { SlotForm } from "@/components/process-templates/template-builder-shell";
import { AddCaseWorkActions } from "@/components/cases/add-case-work-actions";
import type { CaseActionItem } from "@/lib/queries/case-action-items";
import type { CaseEvent } from "@/lib/queries/case-documents";
import type { CaseTag } from "@/lib/queries/case-tags";
import type { InterviewListItem } from "@/lib/queries/interviews";
import type { MemberListItem } from "@/lib/queries/members";
import { isTerminalCaseStatus } from "@/lib/cases/case-status";
import {
  CaseStatusBadge,
  CaseStatusBadgeFixed,
} from "@/components/cases/case-status-badge";
import { CaseRoleChip } from "@/components/cases/case-role-chip";
import {
  isReadingAsMember,
  narrowToReadingSurface,
} from "@/components/cases/reading-surface";
import type { PhaseResultGate } from "@/components/cases/phase-result-access";
import type {
  CorrectionRequest,
  NarrativeRevision,
} from "@/lib/queries/corrections";
import type { CorrectionCaps } from "@/components/cases/correction-labels";
import { ReopenCaseButton } from "@/components/cases/reopen-case-button";
import { CasePhaseList, type AssigneeOption } from "@/components/cases/case-phase-list";
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
import { formatCaseNumberWithTerm, formatDate } from "@/components/cases/format";
import { CasePrimarySubjectPanel } from "@/components/cases/case-primary-subject-panel";
import { QualityViewerChip } from "@/components/quality/quality-viewer-chip";
import type { MyCaseRole } from "@/lib/queries/cases";
import { CaseParticipantsPanel } from "@/components/cases/case-participants-panel";
import type { CaseParticipantRoleOption } from "@/lib/queries/participants";
import type { AddableUser } from "@/lib/queries/members";

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
  /** ADR 0094 W4 — the source commission's hospital when the `technical_director`
   * flag is on, which unlocks the wizard's "direção técnica" destination. */
  technicalDirectionHospitalId: string | null;
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
  templateProvenance = null,
  referralsModule,
  forwardParentReferralId = null,
  phaseResultGate = null,
  outcomes = [],
  casesExtrasEnabled = false,
  actionItemsEnabled = false,
  canAssignPhases = false,
  canEditCustomFields = false,
  caseCustomFieldsEnabled = false,
  customFields = [],
  correctionsEnabled = false,
  corrections = [],
  narrativeRevisions = {},
  viewerKind = "member",
  managementElsewhere = false,
  canOpenManagement = false,
  adHocForms,
  adHocNarrativeTypes = [],
  backLabel = "Meus Casos",
  caseParticipantsEnabled = false,
  organizationId,
  participantRoles = [],
  participantPlatformUsers = [],
  participantRoleVocabularyHref = null,
}: {
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  detail: CaseDetail;
  members: MemberListItem[];
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
   * Which template VERSION this case ran under (ADR 0096 D3) — shown in the
   * self-contained header only, like {@link myRole}. The coordinator route renders
   * its own copy in the `(detail)` layout and passes nothing here.
   *
   * `null` is the PROCESSLESS answer, not a missing value: it renders as
   * "Sem processo", which is why this REPLACED the badge that used to sit in the
   * header's badge row rather than joining it. Two renderings of one fact is how the
   * coordinator route ended up with a Playwright strict-mode collision.
   */
  templateProvenance?: TemplateProvenance | null;
  /**
   * The per-CASE half of the phase-result authority (phase-results feature; task
   * #10) — the coordinator arm plus the picker's vocabulary. `null`/absent = the
   * affordance is off entirely: the `case_phase_results` flag is off, no phase
   * offers anything, or this is a READING surface (`/casos` passes nothing —
   * ADR 0134 D2).
   *
   * ⚠ REPLACED the per-case `canManagePhaseResults` boolean, which structurally
   * could not express the door's per-PHASE assignee arm
   * (FUP-CASE-PHASE-RESULT-ASSIGNEE-UNDERGRANT). The per-phase half is derived
   * per row from SERVER state by {@link phaseResultAffordance} — never from a
   * client-side assumption about who the viewer is.
   */
  phaseResultGate?: PhaseResultGate | null;
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
   * Whether this viewer may EDIT the case's custom-field values (ADR 0083) — the UI
   * mirror of `public.update_case_custom_field_values`, whose measured gate is
   * `app.is_staff_admin_of(commission) ∨ app.member_can(commission, 'create_cases')`.
   * Resolve it at the HOST as `canInCommission(access, "create_cases")`, which is
   * that expression exactly (its `role === 'staff_admin'` arm covers the first
   * disjunct). Default `false`.
   *
   * ⛔ **A SEPARATE AUTHORITY, deliberately its own prop.** It is not derivable from
   * `caps` — `canManageLifecycle` is coordinator-only and would silently drop the
   * administrativo arm, which is exactly the regression ADR 0134 F-5 introduced when
   * this affordance was left riding on the deleted `canEditMeta` prop. Editing
   * custom fields is CASE-WIDE, so the reading surface passes nothing and the
   * narrowing keeps it off `/casos` (D1); the manage host passes the real value.
   * That differential is the point, not an accident of which host remembered.
   *
   * ⚠ Server-computed, never derived in this component: two of the door's inputs
   * (`role`, `capabilities`) live on the commission-access object the component
   * never sees.
   */
  canEditCustomFields?: boolean;
  /** Whether the `case_custom_fields` flag is on (gates the custom-fields panel; ADR 0083). */
  caseCustomFieldsEnabled?: boolean;
  /** The case's custom-field values (ADR 0083); `[]` when none / the flag is off. */
  customFields?: CaseCustomFieldValue[];
  /**
   * Whether the `case_corrections` flag is on (Case Correction Lifecycle, ADR 0085).
   * Gates the whole correction surface: the "Corrigir…" affordance in each
   * phase/narrative card's header, that card's "Solicitações de correção" list, and
   * the "Reabrir caso" control on a concluded case. Default `false` (no chrome).
   */
  correctionsEnabled?: boolean;
  /** Every correction request for this case, newest-first (RLS-scoped). Default `[]`. */
  corrections?: CorrectionRequest[];
  /** narrativeId → its revision history (newest-first). Default `{}`. */
  narrativeRevisions?: Record<string, NarrativeRevision[]>;
  /**
   * WHO IS READING (ADR 0100 D7/D10). `'oversight'` = a `quality_reviewer`:
   * strictly read-only, PHI-free, no correction filing, no NSP notification.
   * Default `'member'` keeps every existing caller byte-identical.
   *
   * ⚠ ONE DISCRIMINATOR, NOT FOUR BOOLEANS, and deliberately so. This component
   * already carries seven capability/flag booleans; adding a 3rd/4th behavioural
   * one would scatter the read-only contract across independent props that a
   * future caller can get PARTLY right — the failure `architecture-avoid-boolean-props`
   * describes. An explicit variant makes "is this the oversight reader?" a single
   * question with a single answer (`patterns-explicit-variants`).
   *
   * ⚠ THIS IS NOT THE SECURITY BOUNDARY. The DB is: the S7 arm of `app._case_caps`
   * confers `read_case_content | view_case_overview` and nothing else, so every
   * write door refuses a reviewer regardless of what renders. This prop exists so
   * the UI does not OFFER what the DB would refuse — the host page independently
   * resolves the same affordances off, so neither side alone can open a write path.
   */
  viewerKind?: "member" | "oversight";
  /**
   * `true` on a host that is a READING surface — the staff `/casos/[caseId]`
   * route. It narrows EVERY case-wide capability to `false` for every child of this
   * component — `canManageLifecycle` AND `canWriteContent` (ADR 0134 D2) — so a
   * coordinator OR a per-case write-grantee who opens that route sees the case the
   * way a committee member does; management stays one click away behind the
   * header's "Gerenciar caso" link, which is gated on {@link canOpenManagement},
   * i.e. the UN-narrowed predicate (otherwise the narrowing would strand them).
   *
   * Not a security control (Rule 1) — it is the same viewer with the same DB
   * rights, choosing a calmer surface. It only changes what is OFFERED, and every
   * door still decides for itself.
   */
  managementElsewhere?: boolean;
  /**
   * **May this viewer open `/manage/cases/[caseId]`?** (ADR 0134 D3/D4.) Gates the
   * self-contained header's "Gerenciar caso" link — the single, uniformly labelled
   * escape hatch off the reading surface.
   *
   * ⛔ **SERVER-COMPUTED, and by exactly ONE expression.** The host resolves it with
   * `canOpenCaseManagement(access, caseId, detail.viewerCapabilities)` — the same
   * helper the manage route's entry gate calls — and passes the resulting boolean.
   * It is NOT derivable here: two of its three arms (`staff_admin`,
   * `isAdministrativo`) live on the commission-access object this component never
   * sees, and re-deriving the third from `caps` would be a second copy of the
   * predicate, which is precisely how a gate and the control pointing at it drift
   * into offering a link that 404s.
   *
   * ⚠ Fed from the UN-NARROWED capabilities on purpose: the narrowing above is what
   * creates the need for this exit, so gating the exit on the narrowed value would
   * strand every viewer it applies to. Default `false` — a host that does not pass
   * it offers no link (fail-closed), which is also why the manage host (which
   * renders no header at all) can omit it.
   *
   * ⚠ ONE LABEL FOR EVERY ROLE (D4). A per-role label fork would add an E2E locator
   * axis for zero information gain.
   */
  canOpenManagement?: boolean;
  /**
   * The commission's PUBLISHED forms, for the work card's "Adicionar fase"
   * dialog. `undefined` — the staff route's case — renders NO authoring footer
   * and, more to the point, means that route never loads this list at all.
   */
  adHocForms?: SlotForm[];
  /** The commission's narrative vocabulary, for "Adicionar narrativa". */
  adHocNarrativeTypes?: { id: string; label: string }[];
  /**
   * Label for the self-contained header's back link. Defaults to `"Meus Casos"`,
   * which was hardcoded here until ADR 0100 — a reviewer arrives from the quality
   * console and has no "Meus Casos" (that route is member-gated), so `backHref`
   * alone was not enough to avoid pointing them at a 404.
   */
  backLabel?: string;
  /**
   * Whether the `case_participants` flag is ON (ETH·E4 — ADR 0108). Gates the
   * main-column roster panel; the rail's {@link CasePrimarySubjectPanel} is
   * unaffected — D7 keeps that card exactly as E3a shipped it.
   */
  caseParticipantsEnabled?: boolean;
  /**
   * The case's owning organization — required by the roster panel's search /
   * role-vocabulary / platform-user-pick surfaces (all org-scoped). Threaded
   * from the host page (`access.commission.organization.id`); absent/`null`
   * is treated as "panel not shown" alongside the flag.
   */
  organizationId?: string;
  /** The case's active participant-role vocabulary (org-wide + this case type's own). */
  participantRoles?: CaseParticipantRoleOption[];
  /** The org roster for the roster panel's "possui conta" platform-user pick. */
  participantPlatformUsers?: AddableUser[];
  /**
   * Org vocabulary-admin href for the add-participant dialog's "no role accepts
   * this type" empty state, or `null` when this viewer cannot reach it.
   *
   * Computed by the HOST, not here: `/o/[org]/manage/tipos-de-caso` `notFound()`s
   * unless the viewer is org_admin of this org AND the `case_types` flag is on, and
   * this component knows neither. Pass-through to `CaseParticipantsPanel`.
   */
  participantRoleVocabularyHref?: string | null;
}) {
  const c = detail.case;
  // The viewer's TRUE capabilities, straight from the envelope. Exactly one thing
  // reads this now: the narrowing below. (The "Gerenciar caso" escape hatch used to
  // read it too; since ADR 0134 D4 it takes the host-computed `canOpenManagement`,
  // whose predicate spans arms this envelope does not carry.)
  const rawCaps = detail.viewerCapabilities;
  // `managementElsewhere` (the staff `/casos/[caseId]` route): the viewer READS the
  // case here and manages it from `/manage/...`. Narrowing at the single place
  // `caps` is derived is what makes that ONE decision instead of one per card —
  // every child already gates off this object, so phase activate/reassign, narrative
  // assign/conclude, Encaminhar caso, Nova entrevista, patient + custom-field edit,
  // event visibility, the offered-outcomes editor, Reabrir caso and ad-hoc delete all
  // follow from `canManageLifecycle: false`, and Novo item, Adicionar registro,
  // Anexar documento and the tag editor from `canWriteContent: false`.
  //
  // ⭐ ADR 0134 D1/D2 — the TRIGGER is any case-wide claim, not just the
  // coordinator's. `8675b7cd` tested `canManageLifecycle` alone, which left a
  // per-case WRITE grantee holding the content affordances here: one of the two
  // carve-outs that were exactly the "somewhere between read-only and full
  // management" state the split exists to abolish. (Its own differential control
  // proved it.) Both classes now do that work on `/manage/cases/[caseId]`, which
  // since D3 admits a write-grantee too — so nothing is deleted, it RELOCATES.
  //
  // What survives is what the viewer holds by NAME rather than by capability: the
  // assignee checks precede the capability checks (ADR 0033 Q14 / CA-002), so a
  // coordinator assigned a narrative, or a grantee assigned a phase, still does that
  // work here — which is exactly the committee-member surface this route is meant to
  // be. After this, `/casos` writes are name-attributed only, which is D1's sentence
  // made literally true.
  // ⛔ The narrowing itself lives in ONE place (`./reading-surface`) and is shared
  // with every other `/casos` route — see that module's header for why a per-file
  // copy of this rule is the defect it was extracted to prevent.
  const readingAsMember = managementElsewhere && isReadingAsMember(rawCaps);
  const caps: CaseViewerCapabilities = managementElsewhere
    ? narrowToReadingSurface(rawCaps)
    : rawCaps;
  // ADR 0100 D7 — the oversight reader. Three affordances on this page are NOT
  // derived from `caps` and would otherwise render for them; see each use site.
  const isOversight = viewerKind === "oversight";
  // Activate/reassign: an `assign_case_phases` Administrativo OR anyone who already
  // manages lifecycle (a coordinator) — the latter keeps coordinators from regressing
  // regardless of what the page passes.
  //
  // These three affordances arrive as their OWN props and so survive the `caps`
  // narrowing above. ⛔ ADR 0134 D2 closes that bypass at BOTH ends, and neither end
  // is load-bearing alone (the house rule this component states throughout): the
  // reading-surface HOST no longer passes any of them, and these guards zero them
  // again here. A host that forgets still cannot open a case-wide door on `/casos`;
  // a caller that forgets `managementElsewhere` still cannot either.
  //
  // ⚠ The 2026-08-19 rationale for exempting a non-coordinator's Administrativo
  // grant — "`/manage/...` 404s for an Administrativo, so this page is their ONLY
  // surface" — is DEAD as of ADR 0134 D3, which admits them to the manage host.
  // Suppressing them here now relocates the capability instead of deleting it.
  const effectiveCanAssignPhases = readingAsMember
    ? false
    : canAssignPhases || caps.canManageLifecycle;
  // ⛔ BEHAVIOUR-NEUTRAL TODAY, AND DELIBERATELY KEPT. Do not "simplify" this back
  // to a bare `canEditCustomFields` — it is defence in depth, not live logic:
  //   · manage host — passes no `managementElsewhere`, so `readingAsMember` is
  //     `false` and this expression is the IDENTITY.
  //   · `/casos` host — passes no `canEditCustomFields`, so BOTH branches are
  //     `false`.
  // Every reachable (host, flag, caps, status) combination therefore yields the
  // same value with or without this line.
  //
  // What it buys is the FUTURE host. `canEditCustomFields` sits OUTSIDE `caps`, so
  // `narrowToReadingSurface` cannot see it, and without this backstop the only
  // thing keeping a case-wide affordance off a reading surface is WHICH HOST
  // REMEMBERED not to pass it — a convention, not a mechanism. That is exactly the
  // ADR 0134 F-1 condition one prop later: a second `/casos` route kept case-wide
  // narrative authorship because nobody re-derived the narrowing at the new site.
  // With this line a forgetful host is narrowed anyway instead of leaking.
  const effectiveCanEditCustomFields = readingAsMember
    ? false
    : canEditCustomFields;
  // Same backstop as the two above, and for the same reason: the reading surface
  // must not offer a phase-result affordance even if a future host forgets not to
  // pass the gate. `null` is the whole "off" answer, so this zeroes BOTH arms at
  // once — the coordinator arm and the per-phase assignee arm.
  const effectivePhaseResultGate = readingAsMember ? null : phaseResultGate;
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
  //
  // ⚠ ADR 0100 D7: `canFile: isOpen` admits ANY case-content reader — which the
  // quality reviewer now is (D3 confers `read_case_content`). Filing a correction
  // request is a WRITE, so without the `!isOversight` guard every phase and
  // narrative card would offer the reviewer a "Corrigir…" affordance.
  //
  // ⭐ On `/casos` this is a SANCTIONED exception, not an escapee: its door
  // (`public.file_correction_request`) is keyed on `app.can_read_case`, which is
  // that page's own admission test, so the affordance is invariant across everyone
  // who can see the page. The rule and its admission test live in ONE place —
  // `./reading-surface` (ADR 0134 D1 as amended by Amendment 3). Do not restate
  // the rule here; per-file restatement is how it drifted before.
  const correctionCaps: CorrectionCaps | null =
    correctionsEnabled && !isOversight
      ? {
          enabled: true,
          canFile: isOpen,
          canApprove: caps.canManageLifecycle,
          viewerId,
        }
      : null;
  // The per-card request lists resolve requester/corrector ids → human names. Built
  // from data the host already loaded; each list renders nothing when its target has
  // no requests. (The phase/narrative LABELS the old cockpit needed are gone — a list
  // now sits inside its target's card and takes that card's heading.)
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
  //
  // ⚠ ADR 0100 D5: the reviewer arm carries ZERO PHI bits, so `get_case_patient`
  // returns null for them. Rendering the panel anyway would offer an "Exibir
  // identificação" button that fails — and, worse, would disclose that this case
  // HAS a patient, which is itself PHI-adjacent. Omitted entirely for oversight.
  const showPatientPanel =
    casePatientEnabled && c.patientEnabled && !isOversight;
  const revealPatient = revealCasePatient.bind(null, c.id);
  const savePatient = setCasePatient.bind(null, c.id);

  // ETH·E3a (ADR 0064 D4): for a non-patient primary-subject case type (an Ethics
  // case → `primary_subject_kind = 'professional'`), the patient panel is omitted
  // and a compact read-only primary-subject card takes its place in the rail,
  // labeled with the case-type terminology (`terminology.primarySubject.singular`
  // → "Médico denunciado"). `'patient'` keeps today's patient panel; `'none'` shows
  // neither. The subject is the `isPrimarySubject` participant (surrogate label,
  // Rule 12), or `null` → a calm labeled empty state.
  const primarySubject =
    detail.participants.find((p) => p.isPrimarySubject) ?? null;
  const showPrimarySubjectPanel =
    detail.primarySubjectKind === "professional" ||
    detail.primarySubjectKind === "entity";

  // Custom fields (ADR 0083) — the panel shows when the flag is on and the case has
  // any values; editing needs the authority below AND an OPEN case (terminal cases
  // are frozen server-side, HC025).
  //
  // ⛔ THIS LINE CARRIES ITS OWN AUTHORITY, and it must not be folded back into any
  // other one. `update_case_custom_field_values` gates on
  // `is_staff_admin_of ∨ member_can('create_cases')` (measured from the catalog), so
  // a `create_cases` administrativo may edit custom fields. That is the SAME
  // authority as the meta door but a DIFFERENT door, and the distinction is what
  // this comment exists to keep.
  //
  // ⛔ Correcting the record: the ADR 0134 F-5 seam deletion removed a
  // `|| effectiveCanEditMeta` disjunct from here and this comment called that a
  // no-op. **It was a no-op for META and an UNDER-GRANT for CUSTOM FIELDS** — the
  // administrativo's only path to this affordance rode on that prop, so deleting it
  // left the door open at the DB with no surface offering it. An under-grant emits
  // NOTHING: no 42501, no log, no red test. Lint, tsc, pgTAP, the four authz ARMs
  // and a green `e2e:prod` all passed across the regression. Only a reviewer
  // diffing the door against the UI caught it, which is why the authority is now
  // named here explicitly instead of inherited from a neighbouring prop.
  const showCustomFieldsPanel = caseCustomFieldsEnabled && customFields.length > 0;
  const customFieldsEditable = effectiveCanEditCustomFields && isOpen;

  const body = (
    <>
      {withHeader && (
        <header className="flex flex-col gap-4">
          <Link
            href={backHref}
            className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {backLabel}
          </Link>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                {/* ETH·E3a (ADR 0064 D4): terminology-aware detail heading
                    ("Denúncia 0042" for ethics; "Caso 0042" when type-less). */}
                <h1 className="text-3xl text-balance">
                  {formatCaseNumberWithTerm(
                    detail.terminology.case.singular,
                    c.caseNumber,
                  )}
                </h1>
                <CaseStatusBadgeFixed status={c.status} />
                {/* ADR 0096 D3 — the "Sem processo" badge that sat here MOVED to the
                    provenance line below, mirroring the coordinator route. It is a
                    move, not a copy: rendering the fact in both places is what put
                    two `Sem processo` nodes on one page and broke Playwright's
                    strict mode. The line says more than the badge could — it names
                    the VERSION when there is a process. */}
                {detail.outcome && (
                  <CaseStatusBadge
                    label={detail.outcome.label}
                    colorToken={detail.outcome.colorToken}
                  />
                )}
                {/* ADR 0100 D10 — the oversight reader gets the office chip, not
                    the capability-derived "viewer" chip, which would read as
                    "a colleague granted access to this case". */}
                {isOversight ? (
                  <QualityViewerChip />
                ) : (
                  caseAccessEnabled && <CaseRoleChip role={myRole} />
                )}
              </div>
              {c.label && (
                <p className="max-w-prose text-muted-foreground text-pretty">
                  {c.label}
                </p>
              )}
              {/* ADR 0137 D9 — the department INPUT is gone from every case surface,
                  but an existing value stays VISIBLE. The coordinator `(detail)`
                  layout already rendered this line; the reading surface did not, so a
                  member could no longer learn a case's setor anywhere. Read-only on
                  both hosts now, same MapPin idiom. Absent when unspecified. */}
              {c.departmentName && (
                <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                  {c.departmentName}
                </p>
              )}
              {/* No `templateVersionHref`: staff cannot open the template builder
                  (that route is coordinator-gated), so this renders as plain text
                  rather than a dead link. */}
              <CaseTemplateProvenance provenance={templateProvenance} />
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
                lives on the `/manage/...` route, so here the right side only offers
                the "Gerenciar caso" link — to everyone who may open that route
                (ADR 0134 D3/D4), not only to a coordinator. */}
            {/* ⚠ ADR 0100 D7: `NotifyEventDialog` is gated on the FEATURE FLAG
                alone — no capability check anywhere — so `caps` does not close it.
                Notifying an event is a WRITE (it creates a patient-safety event)
                and its pre-fill bridge carries PHI, both forbidden to the reviewer.
                ⭐ On `/casos` that is SANCTIONED: `public.notify_safety_event` is
                guarded by `app.is_member_of` alone (measured), so it admits every
                member who can open the page — the exception ADR 0134 Amendment 3
                names. Rule + admission test live in `./reading-surface`, once. */}
            {/* `canOpenManagement`, not `caps`: this cluster hosts the "Gerenciar
                caso" link, whose whole purpose is to carry a manage-capable viewer
                OFF this reading surface. Gating it on the NARROWED capability would
                hide the one exit the narrowing creates the need for — which is why
                the host feeds it the un-narrowed predicate. */}
            {((patientSafetyEnabled && !isOversight) || canOpenManagement) && (
              <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">
                {patientSafetyEnabled && !isOversight && (
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
                {/* ⛔ The Edit META dialog that stood here is DELETED (ADR 0134
                    F-5), not hidden. It was reachable only via `canEditMeta`, which
                    D2 stopped every host from passing, so the branch was structurally
                    dead. `update_case_meta` is unchanged and its affordance lives on
                    the manage host — coordinator ∨ `create_cases` — which is exactly
                    where D1 puts case-wide work. */}
                {canOpenManagement && (
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

        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_384px] lg:gap-8 lg:items-start">
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
                // Per-phase result affordance (task #10). The list resolves it per
                // row from this gate + each phase's own `status`/`assignedTo` +
                // `viewerId` + `isOpen`, mirroring the door's two branches — a
                // `completed` phase is coordinator-only, an `active` one also
                // admits that phase's OWN assignee.
                phaseResultGate={effectivePhaseResultGate}
                correctionCaps={correctionCaps}
                corrections={corrections}
                memberNames={memberNames}
                narrativeRevisions={narrativeRevisions}
                // Two independent conditions, neither load-bearing alone (the
                // house rule the `viewerKind` contract states): the host must
                // have supplied the pickers' data AND the viewer must still hold
                // lifecycle here. The staff route fails both.
                footerActions={
                  isOpen && caps.canManageLifecycle && adHocForms ? (
                    <AddCaseWorkActions
                      caseId={c.id}
                      forms={adHocForms}
                      assignees={assignees}
                      narrativeTypes={adHocNarrativeTypes}
                      narrativesEnabled={narrativesEnabled}
                    />
                  ) : null
                }
              />
            </div>
            {/* The "Solicitações de correção" cockpit CARD is gone (ADR 0085's
                original layout): a case-wide card of requests cluttered the page and
                sat far from the content it described. Each request now lists at the
                bottom of its own target's card, inside `CasePhaseList`. */}
            {/* ETH·E4 (ADR 0108 D7) — the participants ROSTER is a main-column
                surface, distinct from the read-only rail summary above
                (CasePrimarySubjectPanel, untouched). Requires both the flag AND
                a resolved organizationId (every roster surface is org-scoped);
                a host that has not threaded organizationId simply omits the
                panel, same as the flag being off. */}
            {caseParticipantsEnabled && organizationId && (
              <div data-rise className="order-2 lg:order-none">
                <CaseParticipantsPanel
                  caseId={c.id}
                  organizationId={organizationId}
                  participants={detail.participants}
                  roles={participantRoles}
                  platformUsers={participantPlatformUsers}
                  roleVocabularyHref={participantRoleVocabularyHref}
                  canManageLifecycle={caps.canManageLifecycle}
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
                  technicalDirectionHospitalId={
                    referralsModule.technicalDirectionHospitalId
                  }
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
            {showPrimarySubjectPanel && (
              <div data-rise className="order-2 lg:order-none">
                <CasePrimarySubjectPanel
                  label={detail.terminology.primarySubject.singular}
                  subject={primarySubject}
                />
              </div>
            )}
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
                  canEdit={customFieldsEditable}
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
                variant="rail"
                canWrite={caps.canWriteContent}
                // ADR 0100 — metadata yes, bytes no. This hides the download
                // affordance; it does NOT close the corridor, and saying it did
                // was the P0-1 defect written down as a design. The boundary is
                // `open_document_version`, which refuses case-homed BYTES to any
                // caller without `read_case_deliberation` — the capability the
                // S7 oversight arm alone does not confer (migration
                // `20260924000700`; pinned by `329` P0a–P0f and the `308` 5.2s
                // sentinel). This prop only keeps a dead control off the screen.
                canDownload={!isOversight}
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
