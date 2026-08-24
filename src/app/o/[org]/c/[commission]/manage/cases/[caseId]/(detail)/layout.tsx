import { commissionHref } from "@/lib/routing";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";

import { getCommissionAccessByOrg, canInCommission } from "@/lib/queries/session";
import {
  getCaseDetail,
  canOpenCaseManagement,
  casePatientEnabled,
  listCaseAccessGrants,
} from "@/lib/queries/cases";
import type { CaseAccessGrant } from "@/lib/queries/cases";
import { isTerminalCaseStatus } from "@/lib/cases/case-status";
import { listMembers, sortMembers } from "@/lib/queries/members";
import {
  CaseStatusBadge,
  CaseStatusBadgeFixed,
} from "@/components/cases/case-status-badge";
import { CaseLifecycleActions } from "@/components/cases/case-lifecycle-actions";
import { EditCaseMetaDialog } from "@/components/cases/edit-case-meta-dialog";
import { CaseAccessButton } from "@/components/cases/case-access-button";
import { NotifyEventDialog } from "@/components/safety/notify-event-dialog";
import { CaseTabs } from "@/components/cases/case-tabs";
import { formatCaseNumberWithTerm, formatDate } from "@/components/cases/format";
import { listCaseCorrectionRequests } from "@/lib/queries/corrections";
import { isOpenCorrection } from "@/components/cases/correction-labels";
import { narrativesEnabled } from "@/lib/case-narratives/actions";
import { caseAccessEnabled } from "@/lib/case-access/actions";
import { patientSafetyEnabled } from "@/lib/queries/pqs";
import { loadCasePatientForNotify } from "@/lib/cases/actions";
import { getEthicsCaseProcedure } from "@/lib/queries/ethics";
import { getCaseTemplateProvenance } from "@/lib/queries/process-templates";
import { CaseTemplateProvenance } from "@/components/cases/case-template-provenance";

/**
 * Shared shell for a case's two tabs — **Detalhes** (default child) and **Linha
 * do tempo** (`timeline/`). Scoped to the `(detail)` ROUTE GROUP so it wraps only
 * those two pages; the deeper `fase/[phaseId]/respostas` and
 * `interviews/[interviewId]` routes are siblings OUTSIDE the group and keep their
 * own headers (a bare `[caseId]/layout.tsx` would double-header them).
 *
 * Owns the case **header spine** (back-link, case number, status/outcome badges,
 * created/closed line, lifecycle actions when open) + the **tab bar**, so both
 * tabs share one identity and the body pages render only their tab content.
 *
 * **Entry gate (ADR 0134 D3):** `staff_admin ∨ isAdministrativo ∨ per-case
 * canWriteContent`, resolved by the single-point predicate
 * {@link canOpenCaseManagement}. A pure read-grantee, a plain committee member, a
 * quality reviewer, a tenancy admin and a case from another commission all get
 * `notFound()`. ⛔ The predicate is NEVER re-expressed inline: the same function
 * backs the "Gerenciar caso" button and the board row links, and two hand-written
 * copies is exactly how a gate and the control pointing at it drift apart.
 *
 * ⚠ UX gate, not the security boundary (Rule 1). `getCaseDetail` runs FIRST and
 * `notFound()`s on its own when RLS says the caller may not read this case, so the
 * predicate only ever decides between two surfaces the caller can already reach.
 * Fetching it first also lets us pass `detail.viewerCapabilities` as
 * `knownCapabilities`, which spends the per-case arm with no second round trip.
 * `getCommissionAccessByOrg` and `getCaseDetail` are React `cache()`-wrapped, so
 * this guard/fetch and each child tab's identical guard/fetch collapse to one call
 * per request (no double fetch).
 *
 * ⛔ **Entering is not managing (ADR 0134 D5 / T3).** Widening the gate does NOT
 * hand a non-coordinator entrant the affordances the old role gate used to imply.
 * Every control below is now gated on the authority of the DOOR IT OPENS, measured
 * from the live catalog — never inferred from this route's former role check:
 * lifecycle and the access roster are coordinator-only, meta edit mirrors
 * `update_case_meta` (coordinator ∨ `create_cases`), and the "Processo ético" tab
 * is not offered at all to a non-coordinator because `etica/` keeps its own
 * `staff_admin` gate. Each control's data load carries the same condition, so what
 * a viewer cannot open is absent BY CONSTRUCTION rather than fetched and hidden.
 */
export default async function CaseDetailLayout({
  params,
  children,
}: {
  params: Promise<{ org: string; commission: string; caseId: string }>;
  children: React.ReactNode;
}) {
  const { org, commission, caseId } = await params;
  const slug = commission;
  const access = await getCommissionAccessByOrg(org, commission);

  if (!access) {
    notFound();
  }

  // ⛔ READ GATE — NOT redundant with the ADR 0134 D3 predicate below, and it must
  // stay ABOVE it. `getCaseDetail` returns null when RLS says this caller cannot
  // read this case, and `isAdministrativo` (arm 2 of the predicate) is INDEPENDENT
  // of per-case read reach until the Increment-2 `_case_caps` S8 arm lands. So an
  // appointed administrativo passes the predicate on a case they cannot read, and
  // after D3 widened the entry gate this line is the ONLY thing that stops them.
  // Deleting it as "the predicate already covers that" opens a read hole.
  const detail = await getCaseDetail(caseId);
  if (!detail || detail.case.commissionId !== access.commission.id) {
    notFound();
  }

  // ADR 0134 D3 — the manage-surface entry predicate. Fail-closed: the helper
  // returns `false` for every non-answer (RPC error, unknown case, thrown client),
  // so an error path 404s and never admits.
  if (
    !(await canOpenCaseManagement(access, caseId, detail.viewerCapabilities))
  ) {
    notFound();
  }

  // ADR 0134 D5 / T3 — per-affordance authority, each mirroring the door it opens
  // (measured from the live catalog, not inferred from the route's old role gate):
  //   · lifecycle  — `close_case` / `cancel_case` / `reopen_case`: coordinator only.
  //   · roster     — `case_access_grants` writes: coordinator only (ADR 0033).
  //   · meta       — `update_case_meta`: coordinator ∨ member_can('create_cases'),
  //                  i.e. an appointed administrativo holding `create_cases` passes.
  //                  There is NO dedicated meta capability; do not invent one.
  const isCoordinator = access.role === "staff_admin";
  const canEditCaseMeta = canInCommission(access, "create_cases");

  const c = detail.case;
  const isOpen = !isTerminalCaseStatus(c.status);

  // The commission roster + the `case_access` flag are needed UNCONDITIONALLY: the
  // "Acesso ao caso" button (Case Access Control, ADR 0033) shows on terminal cases
  // too (read grants are allowed there, D6), so it can't depend on `isOpen`. The
  // patient-safety + case-patient flags gate the top-bar "Notificar evento ao NSP"
  // button, which — like the access button — must show on terminal cases too
  // (any member may raise a safety event regardless of case state). Loaded once here
  // in the spine and reused by both the access roster and (when open) the
  // lifecycle-actions assignee picker.
  const [
    members,
    accessEnabled,
    patientSafetyOn,
    casePatientOn,
    accessGrants,
    ethicsProcedure,
  ] = await Promise.all([
    listMembers(access.commission.id),
    caseAccessEnabled(),
    patientSafetyEnabled(),
    casePatientEnabled(),
    // The stored read/write grant rows for the access roster's per-member badge.
    // ⛔ The read itself is coordinator/admin-gated, and since ADR 0134 D3 this
    // layout no longer requires `staff_admin` — so the load is now conditional on
    // the same test that renders the button, not on the entry gate. Absent by
    // construction for a non-coordinator entrant rather than fetched-and-hidden.
    isCoordinator
      ? listCaseAccessGrants(caseId)
      : Promise.resolve<CaseAccessGrant[]>([]),
    // The ethics procedure envelope (ETH·E2; ADR 0073) — `null` unless the case is
    // ethics-typed AND the `ethics` flag is on. Drives the "Processo ético" tab.
    // React `cache()`-memoized, so the `etica` page's own read reuses this.
    getEthicsCaseProcedure(caseId),
  ]);

  // ADR 0096 D3 — which template VERSION this case ran under. `null` for a
  // processless case, which is a supported answer, not a load failure; the
  // component renders it as "Sem processo".
  const templateProvenance = await getCaseTemplateProvenance(caseId);
  const sortedMembers = sortMembers(members);
  // ⛔ The "Processo ético" tab is COORDINATOR-ONLY, and the second conjunct is
  // load-bearing since ADR 0134 D3 widened the entry gate. `etica/page.tsx` hosts
  // five coordinator write controls plus the disciplinary procedure surface, so it
  // is not capability-mapped and keeps its `staff_admin` gate (D5's fail-closed
  // default). Offering the tab to an administrativo would hand them a link that
  // then 404s — the exact failure the single-point predicate exists to prevent.
  const showEthics = ethicsProcedure !== null && isCoordinator;

  // The NSP dialog seeds its patient panel from this case's identifiers only when
  // the case COLLECTS PHI and the `case_patient` flag is on (ADR 0038 — value copy
  // via the audited door). Mirrors `CaseDetailView`'s `showPatientPanel` derivation.
  const showPatientPanel = casePatientOn && c.patientEnabled;

  // The lifecycle-actions menu (open cases only) is Concluir + Cancelar now, so all
  // it needs from here is the conclude dialog's two warning lists. The assignee and
  // publishable-form pickers left with the ad-hoc buttons; loaded in the spine so
  // the menu stays available from BOTH tabs.
  // Advisory soft-close warning (ADR 0032, decision 7): the labels of EXPECTED
  // narratives left empty. Non-blocking — surfaced in the conclude dialog so the
  // coordinator notices, but `close_case` is untouched. Flag-gated.
  let expectedEmptyNarrativeLabels: string[] = [];
  // BLOCKING conclude gate (HC0T0): the targets of this case's OPEN correction
  // requests. `listCaseCorrectionRequests` returns `[]` when the `case_corrections`
  // flag is off, so no extra flag read is needed here.
  let pendingCorrectionLabels: string[] = [];
  // Narrative feature state — gates the conclude dialog's expected-empty advisory.
  // The ad-hoc "Adicionar narrativa" dialog moved to the work card, and took the
  // type vocabulary + publishable-form loads with it (see the (detail) page).
  let narrativesOn = false;
  // ⛔ The edit-meta "Unidade / setor" DROPDOWN is gone (ADR 0137 D9), and the
  // departments read that fuelled it goes with it — absent by construction rather
  // than fetched-and-hidden. The case's STORED department is unaffected: it still
  // renders read-only in the header below, and the edit dialog carries it through
  // unchanged so a label edit can never clear it.
  //
  // ⛔ SPLIT BY AFFORDANCE since ADR 0134 D3 widened the entry gate. The loads below
  // used to ride on `isOpen` alone because the route guaranteed `staff_admin`; each
  // is now conditional on the SAME test that renders the control it fuels, so a
  // non-coordinator entrant's dialogs are absent by construction. These two follow
  // the conclude dialog (coordinator).
  if (isOpen && isCoordinator) {
    const [narrativesEnabledResult, corrections] = await Promise.all([
      narrativesEnabled(),
      listCaseCorrectionRequests(caseId),
    ]);
    // Name each open request by its TARGET, not by the request — "Fase 2 — Revisão"
    // is what the coordinator has to go resolve; a request id tells them nothing.
    pendingCorrectionLabels = corrections
      .filter((r) => isOpenCorrection(r.status))
      .map((r) => {
        const phase = detail.phases.find((p) => p.id === r.casePhaseId);
        if (phase) return phase.title || `Fase ${phase.position}`;
        const narrative = detail.narratives.find(
          (n) => n.id === r.caseNarrativeId,
        );
        // ADR 0137 D10 — `case_narratives.type_label` -> `display_label`.
        if (narrative) return narrative.title || narrative.displayLabel;
        return "Item do caso";
      });
    narrativesOn = narrativesEnabledResult;
    if (narrativesOn) {
      expectedEmptyNarrativeLabels = detail.narratives
        .filter((n) => n.isExpected && (n.bodyMd ?? "").trim().length === 0)
        .map((n) => n.title || n.displayLabel);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4">
        <Link
          href={commissionHref(org, commission, "manage", "cases")}
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Casos
        </Link>
        {/* `sm:flex-wrap` + a title-block flex-basis keep the header from collapsing:
            the action cluster is `shrink-0`, so without a basis the `min-w-0` title
            column shrank to width 0 (title/label/department wrapped one word per line)
            whenever the cluster's buttons filled the row. With a 16rem basis + grow the
            title claims the row and the cluster wraps beneath it when space is tight. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5 sm:grow sm:basis-64">
            <div className="flex flex-wrap items-center gap-2">
              {/* ETH·E3a (ADR 0064 D4): the detail heading uses this case type's
                  term ("Denúncia 0042" for ethics), falling back to "Caso 0042" for
                  a type-less case. The board cards keep type-agnostic formatCaseNumber. */}
              <h1 className="text-3xl text-balance">
                {formatCaseNumberWithTerm(
                  detail.terminology.case.singular,
                  c.caseNumber,
                )}
              </h1>
              <CaseStatusBadgeFixed status={c.status} />
              {/* ADR 0096 D3 — the "Sem processo" badge that used to sit here is
                  gone: CaseTemplateProvenance below now owns that fact, and states
                  it alongside the version when there IS a process. Two renderings
                  of one fact also made an unscoped `getByText('Sem processo')`
                  match twice, which is a Playwright strict-mode failure. */}
              {detail.outcome && (
                <CaseStatusBadge
                  label={detail.outcome.label}
                  colorToken={detail.outcome.colorToken}
                />
              )}
            </div>
            {c.label && (
              <p className="max-w-prose text-muted-foreground text-pretty">
                {c.label}
              </p>
            )}
            {c.departmentName && (
              <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                {c.departmentName}
              </p>
            )}
            <CaseTemplateProvenance
              provenance={templateProvenance}
              templateVersionHref={
                templateProvenance
                  ? `${commissionHref(org, commission, "manage", "process-templates", templateProvenance.templateId)}?v=${templateProvenance.templateVersionId}`
                  : null
              }
            />
            <p className="text-sm text-muted-foreground">
              Criado em {formatDate(c.createdAt)}
              {c.closedAt ? ` · Encerrado em ${formatDate(c.closedAt)}` : ""}
            </p>
          </div>

          {(patientSafetyOn ||
            (accessEnabled && isCoordinator) ||
            (isOpen && (isCoordinator || canEditCaseMeta))) && (
            <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">
              {/* Patient-safety entry (Phase 14a): any commission member may notify
                  the NSP of a safety event from this case — open OR concluded — so it
                  is gated only on the flag (independent of `isOpen`/access), and sits
                  leftmost in the cluster. Seeds the patient panel from the case's PHI
                  only when the case collects it (ADR 0038, audited door). */}
              {patientSafetyOn && (
                <NotifyEventDialog
                  commissionId={c.commissionId}
                  caseId={c.id}
                  onLoadPatientPrefill={
                    showPatientPanel
                      ? loadCasePatientForNotify.bind(null, c.id)
                      : undefined
                  }
                />
              )}
              {/* Coordinator access roster (ADR 0033). Rendered INDEPENDENTLY of the
                  lifecycle actions (open-only) so it still shows — alone — on a
                  terminal case, where read grants remain allowed (D6).
                  ⛔ `isCoordinator` is explicit since ADR 0134 D3: grant writes are
                  coordinators-only, and this route no longer implies the role. */}
              {accessEnabled && isCoordinator && (
                <CaseAccessButton
                  caseId={c.id}
                  members={sortedMembers}
                  detail={detail}
                  grants={accessGrants}
                  caseOpen={isOpen}
                />
              )}
              {/* Edit META (label + department) — the single audited edit door
                  (ADR 0061). Open-only (a terminal case is frozen, HC025). ADR 0134
                  T3: `update_case_meta` is coordinator ∨ `member_can('create_cases')`
                  (measured), so this mirrors `canInCommission(access,'create_cases')`
                  exactly — the affordance an administrativo used to reach on `/casos`
                  now lives here, where D1 says case-wide work belongs. */}
              {isOpen && canEditCaseMeta && (
                <EditCaseMetaDialog
                  caseId={c.id}
                  currentLabel={c.label}
                  currentDepartmentId={c.departmentId}
                  currentDepartmentOther={c.departmentOther}
                />
              )}
              {/* Concluir / Cancelar — `close_case` / `cancel_case` are
                  coordinator-only (ADR 0134 §8 non-goal: no lifecycle for
                  administrativo). Explicit since D3 widened the entry gate. */}
              {isOpen && isCoordinator && (
                <CaseLifecycleActions
                  caseId={c.id}
                  offeredOutcomes={detail.offeredOutcomes}
                  currentOutcomeId={c.outcomeId}
                  phases={detail.phases}
                  expectedEmptyNarrativeLabels={expectedEmptyNarrativeLabels}
                  pendingCorrectionLabels={pendingCorrectionLabels}
                />
              )}
            </div>
          )}
        </div>

        {/* ETH·E3a (ADR 0064 D4): the timeline tab uses this case type's terminology
            ("Cronologia processual" for an ethics case), falling back to the platform
            default "Linha do tempo" for a type-less case. */}
        <CaseTabs
          org={org}
          slug={slug}
          caseId={caseId}
          showEthics={showEthics}
          timelineLabel={detail.terminology.timeline.singular}
        />
      </header>

      {children}
    </div>
  );
}
