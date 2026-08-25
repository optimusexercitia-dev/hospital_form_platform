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
  // ⭐ **A NULL CONTEXT IS AN AUTHORITATIVE "THIS CALLER CANNOT MINT", so it
  // gates the CARD — this is the whole affordance control, and it re-derives
  // nothing.** Verified against the live catalog 2026-08-25 (never migration
  // text — CLAUDE.md's graphify exception), all three links:
  //
  //   1. `public.print_source_state` is SECURITY DEFINER, so its own gate
  //      REPLACES RLS and is the entire authority. Its first act after the flag
  //      assert is `if not app.can_view_printed_document(...) then return;` — a
  //      bare `return` in a `RETURNS TABLE` function, i.e. ZERO ROWS. Its own
  //      comment names the intent: *"no row: no oracle"*. There is exactly one
  //      `return query`, past that gate, so no row can be produced without it.
  //   2. `app.can_view_printed_document`'s `case` arm is
  //      `app.can_read_case(id, uid) AND app.can_read_full_case_content(id, uid)`
  //      — ADR 0144 D8's mint arm exactly, all seven masking axes included via
  //      the full-content predicate; unknown kinds hit `else return false`.
  //   3. `getCasePrintContext` maps every incomplete answer to `null`: an RLS
  //      miss on `cases`, an absent RPC row, AND a row whose fields are missing
  //      or mistyped.
  //
  // The contrapositive is what this page relies on: a NON-NULL context means the
  // door did not refuse. ⛔ Do NOT "restore" a defensive `?? true` /
  // `?? detail.case.status` fallback here — an earlier draft had exactly that,
  // and it is worse than useless now: it would manufacture a state for a caller
  // the door already answered about, and turn an honest absence back into the
  // refusal-on-click this gate exists to remove. Closes
  // FUP-P3-MINT-AFFORDANCE-WIDER-THAN-ITS-DOOR.
  //
  // ⚠ Bounded, stated: this is the DE-IDENTIFIED mint authority. D8 adds
  // `app.can_read_case_patient` for the identified variant only, and that door is
  // not exposed here — see the PHI residue note on the card below.
  //
  // ⛔ Only the two fields the `case` arm reads. `correctionOpen` / `phaseVoided`
  // / `meetingDisposed` are IGNORED for this kind (pinned by ADR 0144 D14's
  // vectors); passing an explicit `false` for another kind's fact would read as
  // though it mattered here.
  const casePrintContext = documentPrintingOn
    ? await getCasePrintContext(caseId)
    : null;
  const casePrintState = casePrintContext
    ? {
        status: casePrintContext.status,
        caseDisposed: casePrintContext.caseDisposed,
      }
    : null;

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

        ⭐ The render condition is `casePrintState`, i.e. a NON-NULL print
        context — which is the DB door's own answer, not a check this file makes.
        See the derivation above the read. A caller ADR 0144 D8's arm refuses
        gets an ABSENT card instead of a button that errors on click, and the
        predicate stays declared exactly once, in SQL. ⛔ This is NOT the module
        reproducing a visibility check: nothing here re-states the arms, and if
        the door's definition changes this page follows it without an edit.

        ⚠ **The PHI variant is a bounded residue, named rather than papered
        over.** The gate above is D8's DE-IDENTIFIED authority. The identified
        variant needs `app.can_read_case_patient` too, and that door is not
        exposed to this page — so a caller with case-read + full-content but
        without PHI read still sees the checkbox and is refused on submit. That
        is the ORIGINAL finding, narrowed, not eliminated; closing it needs a
        capability on the detail envelope (a backend surface change) and must not
        be faked by re-deriving the PHI door here. */}
    {casePrintState ? (
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
