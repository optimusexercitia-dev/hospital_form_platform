import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, FolderOpen } from "lucide-react";

import { commissionHref } from "@/lib/routing";
import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getFeatureFlags } from "@/lib/queries/feature-flags";
import { listProcessTemplateVersions } from "@/lib/queries/process-templates";
import { listMembers } from "@/lib/queries/members";
import { bulkCreateCases } from "@/lib/cases/bulk-actions";
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
 * coordinator (staff_admin / commission-admin) picks one process, fills a grid of
 * cases, and the balanced deal distributes them across chosen members in a single
 * atomic operation. The route mirrors the board's access gate but is stricter
 * (Design #9: staff_admin only — an Administrativo with `create_cases` uses the
 * single-case flow); the `bulk_create_cases` RPC is the real authority (Rule 1).
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

  // staff_admin gate (the board's coordinator seam; commission-admins resolve to
  // 'staff_admin'). The RPC re-checks and 42501s anyone else.
  const isStaffAdmin =
    access.role === "staff_admin" || access.context.isAdmin;
  if (!isStaffAdmin) {
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

  const bulkMembers: BulkMember[] = members.map((m) => ({
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
          caseNarrativesEnabled={flags.case_narratives === true}
        />
      )}
    </div>
  );
}
