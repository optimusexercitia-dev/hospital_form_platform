import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg, canInCommission } from "@/lib/queries/session";
import {
  getCaseDetail,
  canOpenCaseManagement,
  casePatientEnabled,
  casesExtrasEnabled,
  listCaseCustomFieldValues,
} from "@/lib/queries/cases";
import { caseCustomFieldsEnabled, featureEnabled } from "@/lib/queries/feature-flags";
import { isTerminalCaseStatus } from "@/lib/cases/case-status";
import { listForms } from "@/lib/queries/forms";
import { listNarrativeTypes } from "@/lib/queries/case-narratives";
import { listCaseOutcomes } from "@/lib/queries/case-outcomes";
import {
  listPhaseResults,
  phaseResultsEnabled,
} from "@/lib/queries/phase-results";
import { toResolvedPhaseResultOptions } from "@/components/cases/phase-result-options";
import {
  phaseResultAffordance,
  type PhaseResultGate,
} from "@/components/cases/phase-result-access";
import { listMembers, listLinkableOrgUsers } from "@/lib/queries/members";
import { CaseDetailView } from "@/components/cases/case-detail-view";
import { listCaseDocuments, listCaseEvents } from "@/lib/queries/case-documents";
import { listCaseTags, listCaseTagsForCase } from "@/lib/queries/case-tags";
import { listCaseActionItems } from "@/lib/queries/case-action-items";
import { actionItemsEnabled } from "@/lib/queries/action-items";
import { listCaseInterviews, interviewsEnabled } from "@/lib/queries/interviews";
import { listCaseMeetings } from "@/lib/queries/case-timeline";
import { meetingsEnabled } from "@/lib/meetings/actions";
import { patientSafetyEnabled } from "@/lib/queries/pqs";
import { narrativesEnabled } from "@/lib/case-narratives/actions";
import { caseAccessEnabled } from "@/lib/case-access/actions";
import { buildCaseReferralsModule } from "@/components/referrals/build-case-referrals-module";
import { buildCaseCorrectionsData } from "@/components/cases/build-case-corrections";
import {
  getParticipantRoleVocabularyHref,
  listCaseParticipantRoles,
} from "@/lib/queries/participants";
import { formatCaseNumberWithTerm } from "@/components/cases/format";
import { PrintedDocumentsSection } from "@/components/printing/printed-documents-panel";
import { getCasePrintContext } from "@/lib/queries/printed-documents";
import {
  printSourceRegisters,
  printSourceWatermark,
} from "@/lib/pdf/documents/print-source";
import {
  mintPrintedDocument,
  revokePrintedDocument,
} from "@/lib/pdf-mint/actions";
import { PDF_PROVIDERS } from "@/lib/pdf-mint/providers";

export const metadata: Metadata = {
  title: "Detalhe do caso",
};

/**
 * The "Detalhes" tab body (default child of the `(detail)` layout): the coordinator
 * case-detail content. The case header spine + tab bar live in the layout, so this
 * page renders only the tab CONTENT — now via the SHARED, capability-gated
 * {@link CaseDetailView} (Case Access Control increment, ADR 0033 D7), the SAME
 * component the staff route mounts. The coordinator keeps full caps (the
 * `get_case_detail` envelope is coordinator-grade here) and the layout's richer
 * chrome (so `withHeader={false}`).
 *
 * Gated + commission-scoped here too (defense in depth; the layout gates
 * IDENTICALLY — both call {@link canOpenCaseManagement} — and both reads are React
 * `cache()`-memoized, so the repeat is free). ⛔ Since ADR 0134 D3 the entrant is
 * no longer necessarily a coordinator: an appointed administrativo or a per-case
 * write-grantee reaches this body too, with `detail.viewerCapabilities` — not the
 * route — deciding what they may do. Every prop below that used to ride on the old
 * role gate now carries its door's own authority explicitly.
 */
export default async function CaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; commission: string; caseId: string }>;
  searchParams: Promise<{ encaminharDe?: string }>;
}) {
  const { org, commission, caseId } = await params;
  // RV2 R3: an "Encaminhar adiante" deep-link seeds the forward wizard's parent
  // referral id (the new draft's lineage back-pointer). Absent for a normal visit.
  const { encaminharDe } = await searchParams;
  const slug = commission;
  const access = await getCommissionAccessByOrg(org, commission);

  if (!access) {
    notFound();
  }

  // ⛔ READ GATE, and it must precede the entry predicate — see the identical note
  // in the `(detail)` layout: `isAdministrativo` is independent of per-case read
  // reach until the Increment-2 S8 arm lands, so this is what stops an appointed
  // administrativo on a case they cannot read.
  const detail = await getCaseDetail(caseId);
  if (!detail || detail.case.commissionId !== access.commission.id) {
    notFound();
  }

  // ADR 0134 D3 — the SAME single-point predicate the layout gates on. This page is
  // the layout's default child, so leaving a `staff_admin` copy here would 404 every
  // class the layout now admits and D3 would be a no-op. Defense in depth only
  // works when both copies are the same expression; both call the helper.
  if (
    !(await canOpenCaseManagement(access, caseId, detail.viewerCapabilities))
  ) {
    notFound();
  }

  // A terminal case is frozen (HC025), so nothing may be appended to its work list.
  // Mirrors the `(detail)` layout's own derivation.
  const isOpen = !isTerminalCaseStatus(detail.case.status);

  // The coordinator claim STRAIGHT FROM THE DB ENVELOPE — the same value the body's
  // `caps.canManageLifecycle` gates on (this host passes no `managementElsewhere`,
  // so nothing narrows it). Used below to keep coordinator-only dialog FUEL absent
  // by construction now that ADR 0134 D3 admits non-coordinators to this route.
  const canManageLifecycle = detail.viewerCapabilities.canManageLifecycle;

  const [
    interviewsOn,
    patientSafetyOn,
    casePatientOn,
    narrativesOn,
    caseAccessOn,
    phaseResultsOn,
    casesExtrasOn,
    meetingsOn,
    actionItemsOn,
    caseCustomFieldsOn,
    caseParticipantsOn,
    documentPrintingOn,
  ] = await Promise.all([
    interviewsEnabled(),
    patientSafetyEnabled(),
    casePatientEnabled(),
    narrativesEnabled(),
    caseAccessEnabled(),
    phaseResultsEnabled(),
    casesExtrasEnabled(),
    meetingsEnabled(),
    actionItemsEnabled(),
    caseCustomFieldsEnabled(),
    featureEnabled("case_participants"),
    // PDF·P3 (ADR 0144 D12): the printing module's platform-wide flag. ⛔ There
    // is NO `case_printing` flag — activation is provider registration (ADR 0104
    // D15), and ADR 0144 D12 names re-asserting a per-phase flag as a P3 trap.
    // Joins the existing parallel batch; it is independent of every read here.
    featureEnabled("document_printing"),
  ]);

  // ETH·E4 (ADR 0108) — same org-scoped roster surfaces as the staff route.
  const [participantRoles, participantPlatformUsers, roleVocabularyHref] =
    caseParticipantsOn
    ? await Promise.all([
        listCaseParticipantRoles(
          access.organization.id,
          detail.case.caseTypeId,
        ),
        // ⚠ NOT `listAddableMembers` — see the sibling staff route: that RPC
        // excludes people already in this commission, i.e. the likeliest
        // respondents (ADR 0108 D6 / the `no_account` dead end).
        listLinkableOrgUsers(access.organization.id),
        // The remedy link for the "no role accepts this type" empty state —
        // `null` unless this viewer can open the vocabulary admin.
        getParticipantRoleVocabularyHref(org),
      ])
    : [[], [], null];

  // The commission's outcome vocabulary — for the process-less offered-outcome
  // editor (processless_cases). Only needed when this case is process-less AND the
  // coordinator may edit the set; otherwise the editor never renders, so `[]`.
  const outcomes =
    detail.case.templateId === null && casesExtrasOn && canManageLifecycle
      ? await listCaseOutcomes(access.commission.id)
      : [];

  // Per-phase result affordance (phase-results feature; task #10).
  //
  // ⛔ THE ROLE TEST IS LOAD-BEARING AND IS NOT A NARROWING. This started as a bare
  // `phaseResultsOn` while the route guaranteed `staff_admin`; ADR 0134 D3 removed
  // that guarantee, which turns the bare flag into a UI over-grant for every newly
  // admitted class. Measured authority of `set_case_phase_result_override` — TWO
  // BRANCHES, not one guard: an `active` phase admits the phase's OWN assignee ∨
  // coordinator; a `completed` one is coordinator-only + non-terminal case; any
  // other status admits nobody. There is **no `member_can` arm**, so an
  // administrativo is refused by the door and must not see the affordance, and no
  // `is_admin` arm either. Full mirror + rationale: `phaseResultAffordance`.
  //
  // ⚠ THE ASSIGNEE DISJUNCT IS PER-PHASE, so it CANNOT live in a per-case boolean —
  // which is why the old `canManagePhaseResults` prop is gone. What this host
  // resolves is only the per-CASE half (the flag + the coordinator arm); the
  // per-phase half is derived from SERVER state (`status`, `assignedTo`) against the
  // session's user id at each row. Closing
  // FUP-CASE-PHASE-RESULT-ASSIGNEE-UNDERGRANT (PO ruling 2026-08-22).
  //
  // ⛔ This comment once ended "`/casos` hand-sets the same coordinator-only test" —
  // FALSE as of the very commit that wrote it (ADR 0134 D2), which stopped the
  // reading surface passing this gate at all. `/casos` does not set it and does not
  // offer the affordance. A stale comment introduced by the pass that was FIXING
  // stale comments — the argument for keeping cross-file claims out of a comment
  // unless a gate can contradict them.
  const isPhaseResultCoordinator = access.role === "staff_admin";
  // Load the commission's vocabulary only when at least ONE phase actually offers
  // something — derived with the SAME predicate the rows render from, so the read
  // can never drift wider (or narrower) than the affordance it feeds. A plain-member
  // assignee can read it: `phase_results_select` is `app.is_member_of`.
  const anyPhaseResultAffordance =
    phaseResultsOn &&
    detail.phases.some(
      (p) =>
        phaseResultAffordance(
          p,
          { isCoordinator: isPhaseResultCoordinator, options: [] },
          isOpen,
          access.context.userId,
        ) !== "none",
    );
  // The commission's full active vocabulary; the picker narrows it per phase — a
  // MANUAL phase is restricted to its allowed subset (phase-result-manual-mode).
  const phaseResultGate: PhaseResultGate | null = anyPhaseResultAffordance
    ? {
        isCoordinator: isPhaseResultCoordinator,
        options: toResolvedPhaseResultOptions(
          await listPhaseResults(access.commission.id),
        ),
      }
    : null;
  const [
    members,
    documents,
    events,
    tags,
    caseTags,
    actionItems,
    interviews,
    meetings,
    customFields,
    forms,
    narrativeTypes,
  ] = await Promise.all([
    listMembers(access.commission.id),
    listCaseDocuments(caseId),
    listCaseEvents(caseId),
    listCaseTags(access.commission.id),
    listCaseTagsForCase(caseId),
    listCaseActionItems(caseId),
    interviewsOn ? listCaseInterviews(caseId) : Promise.resolve([]),
    meetingsOn ? listCaseMeetings(caseId) : Promise.resolve([]),
    caseCustomFieldsOn
      ? listCaseCustomFieldValues(caseId)
      : Promise.resolve([]),
    // The work card's ad-hoc "Adicionar fase" / "Adicionar narrativa" pickers.
    // Loaded HERE rather than in the `(detail)` layout because this page owns the
    // card, and only on an OPEN case — a terminal case is frozen (HC025), so the
    // footer never renders and the reads would be pure waste. The staff route
    // never makes them at all, which is what keeps the commission's form list and
    // narrative vocabulary off that page's payload.
    //
    // ⛔ `canManageLifecycle` joins `isOpen` since ADR 0134 D3. Both doors are
    // ROLE-LOCKED at the DB (`add_ad_hoc_narrative` gates on `app.is_staff_admin_of`;
    // `add_ad_hoc_phase` runs INVOKER under `case_phases_staff_admin_write`), so an
    // administrativo or write-grantee entering this route would refuse at the door —
    // and the pickers' data must be absent by construction, not merely unrendered.
    isOpen && canManageLifecycle
      ? listForms(access.commission.id)
      : Promise.resolve([]),
    isOpen && canManageLifecycle && narrativesOn
      ? listNarrativeTypes(access.commission.id)
      : Promise.resolve([]),
  ]);
  const adHocForms = forms
    .filter((f) => f.publishedVersionNumber != null)
    .map((f) => ({ id: f.id, title: f.title }));
  const adHocNarrativeTypes = narrativeTypes.map((t) => ({
    id: t.id,
    label: t.label,
  }));

  // The outbound-referrals card module (Phase 22; null when the flag is off). Built
  // from data already loaded — no inline supabase-js (Rule 9; UI-prop assembly).
  const referralsModule = await buildCaseReferralsModule(
    detail,
    documents,
    access.commission.hospitalId,
  );

  // Case Correction Lifecycle surface data (ADR 0085; empty when the flag is off).
  const correctionsData = await buildCaseCorrectionsData(detail);

  // ADR 0144 D3 — BOTH print axes derive from ONE state object, read once.
  //
  // ⚠ Sharing the FUNCTION is not enough; the ARGUMENT LISTS must be the same
  // object. `printSourceRegisters` and `printSourceWatermark` are spelled out
  // separately by design (ADR 0125 D8 / 0126 D7 — the coincidence is recorded,
  // not exploited), so two call sites passing different arguments is exactly how
  // ADR 0125 D5's forbidden fourth cell — a FINAL page carrying a prévia footer —
  // gets reached. One object makes that impossible here.
  //
  // ⛔ Fails CLOSED on an absent context (`null` when the door refused, or the
  // case is unresolvable): `caseDisposed: true` alone drops registration whatever
  // the status is, so the screen offers a PRÉVIA rather than entering the
  // registry on state nobody confirmed. The status fallback is the case row this
  // page already gated on and read — a known fact, not an invented one.
  //
  // ⛔ Only the two fields the `case` arm reads. `correctionOpen` / `phaseVoided`
  // / `meetingDisposed` are IGNORED for this kind (pinned by ADR 0144 D14's
  // vectors); passing an explicit `false` for another kind's fact would read as
  // though it mattered here.
  const casePrintContext = documentPrintingOn
    ? await getCasePrintContext(caseId)
    : null;
  const casePrintState = {
    status: casePrintContext?.status ?? detail.case.status,
    caseDisposed: casePrintContext?.caseDisposed ?? true,
  };

  return (
    <>
    <CaseDetailView
      org={org} slug={slug}
      detail={detail}
      members={members}
      events={events}
      tags={tags}
      caseTags={caseTags}
      actionItems={actionItems}
      interviews={interviews}
      interviewsEnabled={interviewsOn}
      meetings={meetings}
      meetingsEnabled={meetingsOn}
      patientSafetyEnabled={patientSafetyOn}
      casePatientEnabled={casePatientOn}
      narrativesEnabled={narrativesOn}
      caseAccessEnabled={caseAccessOn}
      viewerId={access.context.userId}
      myRole="coordinator"
      withHeader={false}
      backHref={commissionHref(org, commission, "manage", "cases")}
      referralsModule={referralsModule}
      forwardParentReferralId={encaminharDe ?? null}
      phaseResultGate={phaseResultGate}
      outcomes={outcomes}
      casesExtrasEnabled={casesExtrasOn}
      actionItemsEnabled={actionItemsOn}
      canAssignPhases={canInCommission(access, "assign_case_phases")}
      // ADR 0134 R-2 — the custom-fields edit door is
      // `is_staff_admin_of ∨ member_can('create_cases')` (measured), and
      // `canInCommission` is that expression exactly. Passed ONLY on this host:
      // editing custom fields is case-wide work, so `/casos` passes nothing and the
      // D1 narrowing keeps it off the reading surface.
      canEditCustomFields={canInCommission(access, "create_cases")}
      caseCustomFieldsEnabled={caseCustomFieldsOn}
      customFields={customFields}
      correctionsEnabled={correctionsData.enabled}
      corrections={correctionsData.requests}
      narrativeRevisions={correctionsData.narrativeRevisions}
      // The work card's authoring footer. Supplying these IS the opt-in — the
      // staff route passes neither, so it renders no footer and never loads them.
      adHocForms={adHocForms}
      adHocNarrativeTypes={adHocNarrativeTypes}
      caseParticipantsEnabled={caseParticipantsOn}
      organizationId={access.organization.id}
      participantRoles={participantRoles}
      participantPlatformUsers={participantPlatformUsers}
      participantRoleVocabularyHref={roleVocabularyHref}
    />

    {/* Documentos impressos (PDF·P3; ADR 0144). A sibling of CaseDetailView, not
        a prop: the view is SHARED with the reading route `/casos/[caseId]`, so a
        prop would either put the mint surface on that route too or add a fourth
        boolean to a component that already carries thirty-odd. `withHeader={false}`
        makes the view return a bare fragment, so this card lands directly in the
        `(detail)` layout's `flex flex-col gap-6` column, beneath the tab content.

        ⛔ On the DETALHES tab only, never in the shared `(detail)` layout header.
        The layout renders above every tab, so a card there would follow the user
        into "Linha do tempo" and "Processo ético" — printing belongs to the
        record, not to the chrome.

        ⚠ What is deliberately ABSENT: this module reproduces NO visibility check.
        The route already gated on `canOpenCaseManagement` AND on the case
        belonging to this commission, and ADR 0144 D8's mint arm
        (`can_read_case` ∧ the full-content predicate ∧, for the identified
        variant, `app.can_read_case_patient`) re-decides at the door for mint and
        download alike. A recused member or a phase-only respondent who reaches
        this route is refused there, in pt-BR — that is the domain's gate doing
        its job, not something for this card to pre-empt or compensate for. */}
    {documentPrintingOn ? (
      <div className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs">
        <PrintedDocumentsSection
          sourceKind="case"
          sourceId={detail.case.id}
          registers={printSourceRegisters("case", casePrintState)}
          watermark={printSourceWatermark("case", casePrintState)}
          // ⛔ The case NUMBER and its type term, never `case.label`. The label is
          // clinician-authored free text on a PHI-capable record, and the mint
          // dialog restates the scope on a screen whose whole subject is how much
          // patient data to print — minimum-necessary (Rule 12) says the scope
          // line identifies the dossier, it does not sample its contents. The
          // number does that unambiguously, and ADR 0064 D4's terminology keeps
          // it reading as the domain does ("Denúncia 0042" on an ethics case).
          scopeLabel={formatCaseNumberWithTerm(
            detail.terminology.case.singular,
            detail.case.caseNumber,
          )}
          // ADR 0104 D11 — revocation is `staff_admin` of the owning commission,
          // the same expression the meetings and submissions surfaces use. ⛔ NOT
          // `canOpenCaseManagement` and NOT `canManageLifecycle`: since ADR 0134
          // D3 the first admits administrativos and per-case write-grantees, who
          // may reach this route without holding the coordinator role revocation
          // is scoped to. The server action re-checks regardless (Rule 1).
          canRevoke={access.role === "staff_admin"}
          // From the provider registry, never a literal `true` (ADR 0104 D9
          // v2-readiness). `case` is the FIRST kind to declare `phiCapable` — and
          // reading it here means the PHI control appears exactly when a provider
          // exists that can honour it, with no second place to keep in step.
          phiCapable={PDF_PROVIDERS.case?.phiCapable ?? false}
          mintAction={mintPrintedDocument}
          revokeAction={revokePrintedDocument}
        />
      </div>
    ) : null}
    </>
  );
}
