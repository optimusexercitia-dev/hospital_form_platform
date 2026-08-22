import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, FolderOpen } from "lucide-react";

import { commissionHref } from "@/lib/routing";
import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getFeatureFlags } from "@/lib/queries/feature-flags";
import { listProcessTemplateVersions } from "@/lib/queries/process-templates";
import { activeMembers, listMembers } from "@/lib/queries/members";
import { bulkCreateCases } from "@/lib/cases/bulk-actions";
import {
  canBulkCreateCases,
  canUseAllPhasesScope,
} from "@/components/cases/bulk-create-gate";
import { BulkCreateWizard } from "@/components/cases/bulk-create-wizard";
import type {
  BulkMember,
  BulkTemplateOption,
} from "@/components/cases/bulk-create-types";

export const metadata: Metadata = {
  title: "Múltiplos casos",
};

/**
 * "Múltiplos casos" — the full-page bulk-case creation wizard (ADR 0084). A
 * coordinator — or an Administrativo holding BOTH `create_cases` and
 * `assign_case_phases` (ADR 0134 Amendment 7) — picks one process, fills a grid of
 * cases, and the balanced deal distributes them across chosen members in a single
 * atomic operation. The gate is {@link canBulkCreateCases}, shared with the board's
 * link; the `bulk_create_cases` RPC is the real authority (Rule 1).
 *
 * A phase-less / narratives-only template cannot be bulk-created (first-only mode
 * would assign nobody), so only ACTIVE templates with ≥1 phase are offered. When the
 * `cases_bulk_create` flag is off the route 404s.
 */
export default async function BulkCreateCasesPage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;
  const slug = commission;
  const access = await getCommissionAccessByOrg(org, commission);

  if (!access) {
    notFound();
  }

  // ⛔ THE EXACT TS MIRROR OF `app.is_staff_admin_of`, which is what
  // `public.bulk_create_cases` gates on — not a hand-set narrowing.
  // `app.is_staff_admin_of` = `app.is_active(uid) AND app.has_role('commission', id,
  // 'staff_admin', uid)`, and `access.role` is populated only from the caller's
  // commission-scoped, ACT-hat-filtered membership partition, so this reproduces
  // both the membership arm and the hat arm. The one predicate it does NOT mirror is
  // `app.is_active`: the shell sends deactivated/suspended users to `/conta-inativa`
  // before any commission route runs, so it is covered ELSEWHERE, not here — do not
  // "improve" this gate by re-adding a check that already ran.
  //
  // ⛔ `|| access.context.isAdmin` REMOVED (ADR 0134 D5 / noun rule, ADR 0078 A35),
  // and the comment it carried — "commission-admins resolve to 'staff_admin'" — was
  // FALSE from BUG-QOB-003 / ADR 0100 D12 onward, which deleted that coercion.
  // The bypass was already dead: a platform_admin 404s on the entire commission area
  // at the shell (pinned by the passing MT-3 spec in `phase-multitenancy.spec.ts`),
  // and `bulk_create_cases` refuses them regardless. Removing it deletes a false
  // statement; it does not close a hole. Changes in lockstep with the board's
  // "Múltiplos casos" link, or one surface offers what the other 404s.
  //
  // ⚠ REVERSED 2026-08-22 (ADR 0134 Amendment 1 §A1.2 + Amendment 7). This gate used
  // to be `access.role !== "staff_admin"`, carrying the note that "T4 keeps the ROLE
  // gate … `bulk_create_cases` is `app.is_staff_admin_of`-only". That is no longer
  // true of the door, so the gate moved with it — and the door now takes TWO keys,
  // which is why the predicate is shared rather than re-typed here. The old sentence
  // is quoted rather than deleted, so a reader can tell this was reversed rather than
  // overlooked. The route must never out-run the door.
  if (!canBulkCreateCases(access)) {
    notFound();
  }

  const flags = await getFeatureFlags();
  if (flags.cases_bulk_create !== true) {
    notFound();
  }

  const [templates, members] = await Promise.all([
    listProcessTemplateVersions(access.commission.id),
    listMembers(access.commission.id),
  ]);

  // Eligible = PUBLISHED template version with ≥1 phase (ADR 0096 renamed the old
  // `active`; phase-less templates are rejected by the RPC — Design minor rule).
  // `id` stays the TEMPLATE identity: `bulk_create_cases` follows
  // `create_case_from_template` and resolves the published version itself. Carry
  // `collectsPatient` + `customFields` for the wizard's PHI + custom-field columns.
  const eligibleTemplates: BulkTemplateOption[] = templates
    .filter(
      (entry) =>
        entry.version.status === "published" && entry.version.phases.length > 0,
    )
    .map((entry) => ({
      id: entry.template.id,
      title: entry.version.title,
      collectsPatient: entry.version.collectsPatient,
      customFields: entry.version.customFields,
    }));

  // FUP-BULK-1: offer only members `bulk_create_cases` will accept as an owner. The
  // RPC gates every owner on `app.is_member_of_for` → `app.is_active` and raises
  // HC021; the wizard defaults every listed member to SELECTED and deals with
  // `Math.random`, so a suspended member in the roster failed the whole atomic
  // creation at random rather than being quietly skipped.
  const bulkMembers: BulkMember[] = activeMembers(members).map((m) => ({
    userId: m.userId,
    fullName: m.fullName,
    email: m.email,
  }));

  const boardHref = commissionHref(org, slug, "manage", "cases");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <a
          href={boardHref}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Voltar aos casos
        </a>
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {access.commission.name}
        </p>
        <h1 className="text-3xl text-balance">Múltiplos casos</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Crie vários casos a partir de um único processo e distribua-os de forma
          equilibrada entre os responsáveis, ativando a primeira fase de cada um em
          uma única operação.
        </p>
      </header>

      {eligibleTemplates.length === 0 ? (
        <section
          aria-label="Nenhum processo elegível"
          className="animate-rise-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FolderOpen aria-hidden="true" className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">Nenhum processo elegível</h2>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            A criação em lote exige um processo ativo com ao menos uma fase. Publique
            um processo multifásico para começar.
          </p>
          <a
            href={boardHref}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Voltar aos casos
          </a>
        </section>
      ) : (
        <BulkCreateWizard
          org={org}
          slug={slug}
          templates={eligibleTemplates}
          members={bulkMembers}
          action={bulkCreateCases}
          casePatientEnabled={flags.case_patient === true}
          caseCustomFieldsEnabled={flags.case_custom_fields === true}
          casesMultiPhaseEnabled={flags.cases_multi_phase === true}
          canUseAllPhases={canUseAllPhasesScope(access)}
          caseNarrativesEnabled={flags.case_narratives === true}
        />
      )}
    </div>
  );
}
