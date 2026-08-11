import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, FolderOpen, Layers } from "lucide-react";

import { commissionHref } from "@/lib/routing";
import { plural } from "@/lib/text";
import { getCommissionAccessByOrg, canInCommission } from "@/lib/queries/session";
import {
  listCasesBoard,
  casePatientEnabled,
  processlessCasesEnabled,
  casesExtrasEnabled,
} from "@/lib/queries/cases";
import {
  caseCustomFieldsEnabled,
  caseTypesEnabled,
  getFeatureFlags,
} from "@/lib/queries/feature-flags";
import { listCaseOutcomes } from "@/lib/queries/case-outcomes";
import { listCaseTypes } from "@/lib/queries/case-types";
import { getCaseActionItemKpis } from "@/lib/queries/case-action-items";
import { listProcessTemplateVersions } from "@/lib/queries/process-templates";
import { listDepartmentsForHospital } from "@/lib/hospitals/departments";
import { Button } from "@/components/ui/button";
import { CreateCaseDialog } from "@/components/cases/create-case-dialog";
import { CasesKpiStrip } from "@/components/cases/cases-kpi-strip";
import { CasesView, type CasesViewMode } from "@/components/cases/cases-view";
import {
  computeCaseKpis,
  computeOutcomeBreakdown,
} from "@/components/cases/case-derive";

export const metadata: Metadata = {
  title: "Casos",
};

/**
 * Per-commission cases board (coordinator area): one row per case with its
 * phases' progress and a "Novo caso" create flow. Backed by the SECURITY DEFINER
 * `list_cases_board` — a coordinator sees the whole commission's board; an
 * Administrativo with `create_cases` (ADR 0061) sees only the cases they can read
 * (creator/assignee), so their board is correctly scoped. The route admits both;
 * everyone else gets `notFound()` rather than an empty board.
 *
 * The board carries STATUS ONLY — never answers (the Phase-7 invariant).
 *
 * ADR 0078 Gate-2 fallout: `list_cases_board` now filters every row through
 * `app.can_read_case` with no coordinator fast-path, so a principal whose only
 * standing here is ADMINISTRATION — an org_admin/hospital_admin, resolved to the
 * coordinator `staff_admin` role by {@link getCommissionAccessByOrg} but holding
 * no membership row — gets exactly zero rows back. That board reads as "this
 * commission has no cases" when it means "you may not see this", so we 404 it.
 *
 * The 404 keys on the principal's REACH, never on the row count: a genuine
 * coordinator of a brand-new commission with zero cases must still get the empty
 * state below. `hasCaseStanding` is that reach — a real membership (the
 * resolver's own `memberRole` arm, mirroring the meetings route's C7 gate) OR an
 * Administrativo appointment (ADR 0061).
 *
 * The Administrativo arm is not redundant: `appoint_administrativo` requires a
 * `staff` membership, but nothing REVOKES the appointment when that membership is
 * later removed (no FK, no cascade trigger), and `app.member_can` gates on the
 * capability row alone. Such an orphaned Administrativo keeps `create_cases` at
 * the DB and still reads any case they were granted or assigned (`_case_caps` S3 /
 * S4 need no membership), so a membership-only predicate would 404 someone the
 * database still serves rows to.
 *
 * UX gate only — `can_read_case` is the authority (Rule 1). The rows are already
 * correct with or without this check; it only decides empty-state vs. 404.
 */
export default async function CasesBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; commission: string }>;
  searchParams: Promise<{ view?: string; criados?: string }>;
}) {
  const { org, commission } = await params;
  const slug = commission;
  const { view, criados } = await searchParams;
  const access = await getCommissionAccessByOrg(org, commission);

  // Coordinator OR (ADR 0061) an Administrativo with `create_cases`. The board read
  // is RLS/DEFINER-scoped per caller, so an Administrativo sees only their own cases.
  if (!access || !canInCommission(access, "create_cases")) {
    notFound();
  }

  const isCommissionMember = access.context.memberships.some(
    (m) => m.commission.id === access.commission.id,
  );
  const hasCaseStanding = isCommissionMember || access.isAdministrativo;
  if (!hasCaseStanding) {
    notFound();
  }

  const canCreateCases = canInCommission(access, "create_cases");

  const [
    // The board is CAPPED, not cursor-paginated (`nextCursor` is always null),
    // so we take `.rows` and render no pagination control (WS-6 P3).
    { rows },
    templates,
    actionItemKpis,
    casePatientOn,
    processlessOn,
    casesExtrasOn,
    caseCustomFieldsOn,
    outcomes,
    // The case's hospital ACTIVE departments (non-archived) for the Novo-caso
    // "Unidade / setor" dropdown. A commission with no hospital → `[]` (the field
    // still offers the "Outros" custom option). RLS-scoped (member-read).
    departments,
    flags,
    caseTypesOn,
  ] = await Promise.all([
    listCasesBoard(access.commission.id),
    listProcessTemplateVersions(access.commission.id),
    getCaseActionItemKpis(access.commission.id),
    casePatientEnabled(),
    processlessCasesEnabled(),
    casesExtrasEnabled(),
    caseCustomFieldsEnabled(),
    listCaseOutcomes(access.commission.id),
    // The case's hospital ACTIVE departments (non-archived) for the Novo-caso
    // "Unidade / setor" dropdown. A commission with no hospital → `[]` (the field
    // still offers the "Outros" custom option). RLS-scoped (member-read).
    access.commission.hospitalId
      ? listDepartmentsForHospital(access.commission.hospitalId)
      : Promise.resolve([]),
    getFeatureFlags(),
    caseTypesEnabled(),
  ]);

  // ADR 0064 D4 — the org's ACTIVE case types for the process-less "Tipo de caso"
  // picker. A TEMPLATED case inherits its type from the process instead, so this
  // list only backs the "Sem processo" path.
  const caseTypes = caseTypesOn
    ? await listCaseTypes(access.organization.id)
    : [];

  // A case can only be minted from a PUBLISHED template version (ADR 0096 renamed
  // the old `active`). The id stays the TEMPLATE identity: `create_case_from_template`
  // resolves the published version itself via `app.published_version_of_template`, so
  // passing a version id here would be wrong even though the config below is
  // version-scoped. Carry `collectsPatient` so the create dialog can offer the
  // optional patient block (ADR 0038).
  const activeTemplates = templates
    .filter((entry) => entry.version.status === "published")
    .map((entry) => ({
      id: entry.template.id,
      title: entry.version.title,
      collectsPatient: entry.version.collectsPatient,
      // Custom-field defs (ADR 0083) — drive the dialog's reveal + required-gating.
      customFields: entry.version.customFields,
    }));

  const kpis = computeCaseKpis(rows);
  const outcomeBreakdown = computeOutcomeBreakdown(rows);
  const initialView: CasesViewMode = view === "kanban" ? "kanban" : "table";

  // A case can be created from an active template OR, when the flag is on, without
  // a process at all ("Sem processo"). Drives the create button + empty-state copy.
  const canCreate = processlessOn || activeTemplates.length > 0;

  // "Múltiplos casos" (ADR 0084): a staff_admin bulk-create link, shown only when
  // the flag is on and at least one ELIGIBLE template exists (active + ≥1 phase — a
  // phase-less template is rejected by the RPC, so it would offer nothing).
  const isStaffAdmin = access.role === "staff_admin" || access.context.isAdmin;
  const eligibleBulkCount = templates.filter(
    (entry) => entry.version.status === "published" && entry.version.phases.length > 0,
  ).length;
  const showBulk =
    canCreateCases &&
    isStaffAdmin &&
    flags.cases_bulk_create === true &&
    eligibleBulkCount > 0;
  const multiplosHref = commissionHref(org, slug, "manage", "cases", "multiplos");

  // Success banner after a bulk creation (?criados=N), the ?aviso= pattern used
  // elsewhere (no toast system in the app).
  const createdCount = criados ? Number.parseInt(criados, 10) : Number.NaN;
  const showCreatedBanner = Number.isFinite(createdCount) && createdCount > 0;

  return (
    <div className="flex flex-col gap-8">
      {showCreatedBanner && (
        <p
          role="status"
          className="animate-rise-in flex items-center gap-2 rounded-xl border border-success/30 bg-success/12 px-4 py-3 text-sm font-medium text-success"
        >
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
          {createdCount} {plural(createdCount, "caso", "casos")}{" "}
          {plural(createdCount, "criado", "criados")} com sucesso.
        </p>
      )}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            {access.commission.name}
          </p>
          {/* ETH·E3a terminology (ADR 0064 D4): the board heading stays the platform
              default "Casos". A commission's board is inherently MIXED-TYPE (an ethics
              "Denúncia" and a generic "Caso" coexist in the same commission), so there
              is no single unambiguous case-terminology for the whole board — and the
              frozen contract exposes no per-commission terminology bundle (only the
              per-`caseTypeId` `getCaseTypeTerminology`). Per-card labels are
              type-agnostic (`caseNumber`/`label`), so they are unaffected. Per-type
              wording surfaces on the case DETAIL, which resolves its own bundle. */}
          <h1 className="text-3xl text-balance">Casos</h1>
          <p className="max-w-prose text-muted-foreground text-pretty">
            Acompanhe as avaliações multifásicas em andamento e o progresso de cada
            fase. Um caso é identificado por um número — nunca por dados de
            paciente.
          </p>
        </div>
        {canCreateCases && (
          <div className="flex flex-wrap items-center gap-2">
            {showBulk && (
              <Button asChild variant="outline" size="lg">
                <a href={multiplosHref}>
                  <Layers aria-hidden="true" className="size-4" />
                  Múltiplos casos
                </a>
              </Button>
            )}
            <CreateCaseDialog
              org={org} slug={slug}
              templates={activeTemplates}
              commissionId={access.commission.id}
              departments={departments}
              casePatientEnabled={casePatientOn}
              caseCustomFieldsEnabled={caseCustomFieldsOn}
              processlessEnabled={processlessOn}
              casesExtrasEnabled={casesExtrasOn}
              outcomes={outcomes}
              caseTypesEnabled={caseTypesOn}
              caseTypes={caseTypes}
            />
          </div>
        )}
      </header>

      {rows.length === 0 ? (
        <section
          aria-label="Nenhum caso"
          className="animate-rise-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FolderOpen aria-hidden="true" className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">Nenhum caso ainda</h2>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            {!canCreate
              ? "Publique um processo multifásico para começar a criar casos."
              : processlessOn
                ? "Crie o primeiro caso — a partir de um processo publicado ou sem processo."
                : "Crie o primeiro caso a partir de um processo publicado."}
          </p>
          {canCreate && canCreateCases && (
            <div className="mt-2">
              <CreateCaseDialog
                org={org} slug={slug}
                templates={activeTemplates}
                commissionId={access.commission.id}
                departments={departments}
                casePatientEnabled={casePatientOn}
                caseCustomFieldsEnabled={caseCustomFieldsOn}
                processlessEnabled={processlessOn}
                casesExtrasEnabled={casesExtrasOn}
                outcomes={outcomes}
                caseTypesEnabled={caseTypesOn}
                caseTypes={caseTypes}
              />
            </div>
          )}
        </section>
      ) : (
        <>
          <CasesKpiStrip
            kpis={kpis}
            actionItems={actionItemKpis}
            outcomeBreakdown={outcomeBreakdown}
          />
          <CasesView
            rows={rows}
            org={org}
            slug={slug}
            initialView={initialView}
            // A non-coordinator reaching the board via `create_cases` (ADR 0061) is
            // routed to the STAFF case route — the coordinator `(detail)` route 404s them.
            staffCaseRoute={access.role !== "staff_admin"}
            caseCustomFieldsEnabled={caseCustomFieldsOn}
          />
        </>
      )}
    </div>
  );
}
