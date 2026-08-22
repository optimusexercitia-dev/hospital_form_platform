import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, FolderOpen, Layers } from "lucide-react";

import { commissionHref } from "@/lib/routing";
import { plural } from "@/lib/text";
import { getCommissionAccessByOrg, canInCommission } from "@/lib/queries/session";
import { canBulkCreateCases } from "@/components/cases/bulk-create-gate";
import {
  listCasesBoard,
  canOpenCaseManagement,
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
 * standing here is ADMINISTRATION — an org_admin/hospital_admin holding no
 * membership row — gets exactly zero rows back. That board reads as "this
 * commission has no cases" when it means "you may not see this", so we 404 it.
 *
 * ⛔ This paragraph said such a principal was "resolved to the coordinator
 * `staff_admin` role by `getCommissionAccessByOrg`". **That has been false since
 * BUG-QOB-003 / ADR 0100 D12 deleted the `memberRole ?? (isCommAdmin ?
 * 'staff_admin' : null)` coercion.** `access.role` is now populated ONLY from the
 * caller's own commission-scoped, hat-filtered membership row, so it can never
 * hold a tenancy or platform standing; a tenancy admin arrives with `role: null`
 * and the distinct `isTenancyAdmin` flag. They are excluded by
 * `canInCommission(access, 'create_cases')` above, not by the standing check.
 *
 * The 404 keys on the principal's REACH, never on the row count: a genuine
 * coordinator of a brand-new commission with zero cases must still get the empty
 * state below. `hasCaseStanding` is that reach — a real membership (the
 * resolver's own `memberRole` arm, mirroring the meetings route's C7 gate) OR an
 * Administrativo appointment (ADR 0061).
 *
 * ⚠ Since the 2026-08-22 mirror fix this is **NOT a second, independent lock** —
 * say so rather than counting it as defense in depth. `canInCommission` now
 * requires `role !== null`, and `isCommissionMember` is that same predicate read
 * off the same `context.memberships`, so every principal past the gate above
 * already satisfies the `isCommissionMember` arm and the `isAdministrativo` arm
 * can no longer decide anything. Kept as a fail-closed backstop against a
 * regression in the gate above, not because it admits or refuses anyone today.
 *
 * ⛔ **THE ORPHANED-ADMINISTRATIVO RATIONALE WAS BACKWARDS, AND THE CONSEQUENCE
 * INVERTS.** This block used to justify the Administrativo arm by claiming
 * "`app.member_can` gates on the capability row alone", so an orphan — appointment
 * and capability rows surviving a REMOVED membership (nothing revokes them: no FK,
 * no cascade trigger) — "keeps `create_cases` at the DB" and a membership-only
 * predicate would lock out someone the database still serves.
 *
 * Measured from the live catalog (`pg_proc`, not migration text), `app.member_can`
 * is:
 *
 *     feature_enabled('administrativo')
 *       AND is_active(auth.uid())
 *       AND app.is_member_of(p_commission_id)      <-- the clause said not to exist
 *       AND EXISTS (capability row)
 *
 * So an orphan is REFUSED by the door, not served by it, and the direction of the
 * risk flips: the TS mirror was the WIDER of the two. `canInCommission` tested
 * `role === 'staff_admin' || capabilities.includes(cap)` and checked **no
 * membership at all**, while `access.capabilities` is read straight from
 * `commission_administrativo_capabilities` regardless of membership — a dead-end
 * door, the opposite failure from the one this comment used to describe.
 *
 * ✅ **RESOLVED 2026-08-22 by construction, not by inference**
 * (FUP-ORPHAN-ADMINISTRATIVO-REACHABILITY-UNVERIFIED). The earlier text left this
 * OPEN because the two guards it cited were an inference from guards, not an
 * observation. Built and measured, the inference was **half wrong**:
 *
 *   - A **plain** orphan indeed never gets here — but NOT via the shell gate this
 *     comment predicted. `commissions_select_member_or_admin` denies them the
 *     commission ROW, so `getCommissionAccessByOrg` returns `null` one step
 *     earlier and `!access` 404s them. The shell's
 *     `role === null && !isQualityViewer && !isTenancyAdmin` never even runs.
 *   - An orphan who ALSO holds **tenancy-admin** or **quality-reviewer** standing
 *     reads that row on the other policy arm and **DID reach this page** — both
 *     were offered "Novo caso" and got "Você não tem permissão para esta ação."
 *     The dead-end door was live for two principal classes, not unreachable.
 *
 * The fix is in the mirror, not here: `canInCommission` now carries the
 * `role !== null` membership conjunct that `app.member_can` always had, so the
 * gate above refuses both composites for the same reason the DB does.
 * `e2e/orphan-administrativo-reachability.spec.ts` pins all three compositions
 * against a member-administrativo positive control.
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

  // ADR 0134 T5 — where a board ROW points. Resolved through the shared entry
  // predicate {@link canOpenCaseManagement} so the row link and the route's own gate
  // can never disagree.
  //
  // ⚠ Evaluated at the BOARD's grain, deliberately, and the `canWriteContent: false`
  // argument is what says so: it answers the per-case arm locally instead of firing
  // one `case_viewer_capabilities` RPC per row. That is exact rather than
  // approximate HERE, because reaching this board at all requires
  // `canInCommission(access, 'create_cases')` — coordinator or appointed
  // administrativo — and both resolve on arms 1/2 with no query, so the per-case arm
  // never decides anything for this audience. It also cannot strand anyone: a viewer
  // who would have passed only on a per-case write grant lands on `/casos`, where the
  // button IS resolved per case and carries them through.
  //
  // ⛔ The case id is a REAL row's id, not the commission's. An earlier version
  // passed `access.commission.id` into a parameter named `caseId`, reasoning that
  // the argument is unread on this path — true today, and exactly the kind of
  // type-correct lie that turns into a live defect the moment someone drops the
  // `knownCapabilities` argument and the helper starts probing for real. Since the
  // answer is row-INDEPENDENT here (arm 3 is supplied), any row answers for all of
  // them; an empty board has no rows and no links to point anywhere.
  const boardRowsOpenManagement =
    rows.length === 0
      ? false
      : await canOpenCaseManagement(access, rows[0].case.id, {
          canWriteContent: false,
        });

  const kpis = computeCaseKpis(rows);
  const outcomeBreakdown = computeOutcomeBreakdown(rows);
  const initialView: CasesViewMode = view === "kanban" ? "kanban" : "table";

  // A case can be created from an active template OR, when the flag is on, without
  // a process at all ("Sem processo"). Drives the create button + empty-state copy.
  const canCreate = processlessOn || activeTemplates.length > 0;

  // "Múltiplos casos" (ADR 0084): a staff_admin bulk-create link, shown only when
  // the flag is on and at least one ELIGIBLE template exists (active + ≥1 phase — a
  // phase-less template is rejected by the RPC, so it would offer nothing).
  //
  // ⛔ `|| access.context.isAdmin` REMOVED (ADR 0134 D5 / the noun rule, ADR 0078
  // A35). It was already dead — a platform_admin 404s on the whole commission area
  // at the shell (`c/[commission]/layout.tsx`, pinned by the passing MT-3 spec) and
  // `bulk_create_cases` refuses them regardless — so this is the deletion of a false
  // statement, not the closing of a hole. It must change in lockstep with the
  // `multiplos` route's own gate, or one of the two offers a link the other 404s.
  //
  // `access.role === 'staff_admin'` is the exact TS mirror of `app.is_staff_admin_of`,
  // not a hand-set narrowing: `role` comes only from the caller's commission-scoped,
  // hat-filtered membership partition, reproducing both the membership arm and the
  // ACT-hat arm. The one predicate it does NOT mirror is `app.is_active` — the shell
  // routes deactivated users to `/conta-inativa` before any commission route, so
  // that is covered elsewhere. Do not "improve" this by re-adding it here.
  const eligibleBulkCount = templates.filter(
    (entry) => entry.version.status === "published" && entry.version.phases.length > 0,
  ).length;
  // ⛔ ONE PREDICATE, SHARED WITH THE `multiplos` ROUTE'S OWN GATE. Two hand-written
  // copies of the same sentence is how one surface came to offer what the other 404s;
  // `canBulkCreateCases` mirrors the door's TWO keys (ADR 0134 Amendment 7).
  // `canCreateCases` is now implied by it (create_cases is one of the two keys) and is
  // dropped from this conjunction rather than restated.
  const showBulk =
    canBulkCreateCases(access) &&
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
            // ADR 0134 T5 — rows point at the manage detail for viewers who pass the
            // entry predicate and at `/casos` for everyone else. Sourced from the
            // SAME helper the manage route gates on, never a second copy of it: the
            // old `access.role !== "staff_admin"` copy is exactly what would send an
            // administrativo to the reading surface after D3 admitted them to manage.
            staffCaseRoute={!boardRowsOpenManagement}
            caseCustomFieldsEnabled={caseCustomFieldsOn}
          />
        </>
      )}
    </div>
  );
}
