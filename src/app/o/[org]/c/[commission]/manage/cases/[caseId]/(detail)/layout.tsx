import { commissionHref } from "@/lib/routing";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import {
  getCaseDetail,
  casePatientEnabled,
  listCaseAccessGrants,
} from "@/lib/queries/cases";
import { isTerminalCaseStatus } from "@/lib/cases/case-status";
import { listMembers, sortMembers } from "@/lib/queries/members";
import { listForms } from "@/lib/queries/forms";
import {
  CaseStatusBadge,
  CaseStatusBadgeFixed,
} from "@/components/cases/case-status-badge";
import { CaseLifecycleActions } from "@/components/cases/case-lifecycle-actions";
import { EditCaseMetaDialog } from "@/components/cases/edit-case-meta-dialog";
import { CaseAccessButton } from "@/components/cases/case-access-button";
import { listDepartmentsForHospital } from "@/lib/hospitals/departments";
import type { Department } from "@/lib/hospitals/departments";
import { NotifyEventDialog } from "@/components/safety/notify-event-dialog";
import { CaseTabs } from "@/components/cases/case-tabs";
import { formatCaseNumber, formatDate } from "@/components/cases/format";
import { narrativesEnabled } from "@/lib/case-narratives/actions";
import { listNarrativeTypes } from "@/lib/queries/case-narratives";
import { caseAccessEnabled } from "@/lib/case-access/actions";
import { patientSafetyEnabled } from "@/lib/queries/pqs";
import { loadCasePatientForNotify } from "@/lib/cases/actions";

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
 * Coordinator-gated (mirrors the board + the old page): a non-coordinator, or a
 * case from another commission, gets `notFound()`. `getCommissionAccessByOrg` and
 * `getCaseDetail` are React `cache()`-wrapped, so this guard/fetch and the child
 * page's identical guard/fetch collapse to one call per request (no double fetch).
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

  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const detail = await getCaseDetail(caseId);
  if (!detail || detail.case.commissionId !== access.commission.id) {
    notFound();
  }

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
  const [members, accessEnabled, patientSafetyOn, casePatientOn, accessGrants] =
    await Promise.all([
      listMembers(access.commission.id),
      caseAccessEnabled(),
      patientSafetyEnabled(),
      casePatientEnabled(),
      // The stored read/write grant rows for the access roster's per-member badge
      // (coordinator/admin-gated — safe here, the layout already requires
      // staff_admin). Used only when the access button renders.
      listCaseAccessGrants(caseId),
    ]);
  const sortedMembers = sortMembers(members);

  // The NSP dialog seeds its patient panel from this case's identifiers only when
  // the case COLLECTS PHI and the `case_patient` flag is on (ADR 0038 — value copy
  // via the audited door). Mirrors `CaseDetailView`'s `showPatientPanel` derivation.
  const showPatientPanel = casePatientOn && c.patientEnabled;

  // The lifecycle-actions menu (open cases only) needs the assignee + publishable-
  // form + phase pickers. These derive from cheap commission-scoped reads; loaded
  // here in the spine so the action menu is available from BOTH tabs.
  let assignees: { userId: string; name: string }[] = [];
  let publishableForms: { id: string; title: string }[] = [];
  // Advisory soft-close warning (ADR 0032, decision 7): the labels of EXPECTED
  // narratives left empty. Non-blocking — surfaced in the conclude dialog so the
  // coordinator notices, but `close_case` is untouched. Flag-gated.
  let expectedEmptyNarrativeLabels: string[] = [];
  // Narrative feature state + the commission's type vocabulary seed the ad-hoc
  // "Adicionar narrativa" dialog (button gated on `narrativesOn`; the picker gets
  // the non-archived types, `[]` being valid — inline "Criar novo tipo" covers it).
  let narrativesOn = false;
  let narrativeTypes: { id: string; label: string }[] = [];
  // The hospital's ACTIVE departments seed the edit-meta dialog's "Unidade / setor"
  // dropdown (ADR 0061); loaded only when the case is open (the affordance is
  // open-only). A commission with no hospital → `[]` (the "Outros" value still works).
  let departments: Department[] = [];
  if (isOpen) {
    const [forms, narrativesEnabledResult, deps] = await Promise.all([
      listForms(access.commission.id),
      narrativesEnabled(),
      access.commission.hospitalId
        ? listDepartmentsForHospital(access.commission.hospitalId)
        : Promise.resolve<Department[]>([]),
    ]);
    departments = deps;
    narrativesOn = narrativesEnabledResult;
    assignees = sortedMembers.map((m) => ({
      userId: m.userId,
      name: m.fullName ?? m.email ?? "Membro",
    }));
    publishableForms = forms
      .filter((f) => f.publishedVersionNumber != null)
      .map((f) => ({ id: f.id, title: f.title }));
    if (narrativesOn) {
      expectedEmptyNarrativeLabels = detail.narratives
        .filter((n) => n.isExpected && (n.bodyMd ?? "").trim().length === 0)
        .map((n) => n.title || n.typeLabel);
      narrativeTypes = (await listNarrativeTypes(access.commission.id)).map(
        (t) => ({ id: t.id, label: t.label }),
      );
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl text-balance">
                {formatCaseNumber(c.caseNumber)}
              </h1>
              <CaseStatusBadgeFixed status={c.status} />
              {c.templateId === null && (
                <CaseStatusBadge label="Sem processo" colorToken="muted" />
              )}
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
            <p className="text-sm text-muted-foreground">
              Criado em {formatDate(c.createdAt)}
              {c.closedAt ? ` · Encerrado em ${formatDate(c.closedAt)}` : ""}
            </p>
          </div>

          {(accessEnabled || isOpen || patientSafetyOn) && (
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
                  terminal case, where read grants remain allowed (D6). */}
              {accessEnabled && (
                <CaseAccessButton
                  caseId={c.id}
                  members={sortedMembers}
                  detail={detail}
                  grants={accessGrants}
                  caseOpen={isOpen}
                />
              )}
              {/* Edit META (label + department) — the single audited edit door
                  (ADR 0061). Open-only (a terminal case is frozen, HC025). Reachable
                  today by coordinators; when the affordance-gating batch relaxes this
                  route to admit `create_cases` Administrativos, they use the same RPC. */}
              {isOpen && (
                <EditCaseMetaDialog
                  caseId={c.id}
                  currentLabel={c.label}
                  currentDepartmentId={c.departmentId}
                  currentDepartmentOther={c.departmentOther}
                  departments={departments}
                />
              )}
              {isOpen && (
                <CaseLifecycleActions
                  caseId={c.id}
                  offeredOutcomes={detail.offeredOutcomes}
                  currentOutcomeId={c.outcomeId}
                  forms={publishableForms}
                  phases={detail.phases}
                  assignees={assignees}
                  expectedEmptyNarrativeLabels={expectedEmptyNarrativeLabels}
                  narrativeTypes={narrativeTypes}
                  narrativesEnabled={narrativesOn}
                />
              )}
            </div>
          )}
        </div>

        <CaseTabs org={org} slug={slug} caseId={caseId} />
      </header>

      {children}
    </div>
  );
}
