import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { listNarrativeTypes } from "@/lib/queries/case-narratives";
import { narrativesEnabled } from "@/lib/case-narratives/actions";
import { ConstrutorTabs } from "@/components/forms/construtor-tabs";
import { NarrativeTypeManager } from "@/components/cases/narrative-type-manager";

export const metadata: Metadata = {
  title: "Construtor — Narrativas",
};

/**
 * Narrative-type vocabulary manager (coordinator area; ADR 0032): create /
 * rename / reorder / archive the commission's narrative TYPES. Lives under the
 * Construtor page as the "Narrativas" tab (moved here from Configurações), beside
 * the form builder.
 *
 * Coordinator-gated here (only a staff_admin of this commission OR a global admin
 * may reach it; everyone else gets `notFound()`); the CRUD actions are themselves
 * staff_admin-gated (RLS is the authority). Feature-flagged: when `case_narratives`
 * is off the route 404s (and the Narrativas tab is hidden), so it is invisible
 * until the increment ships.
 */
export default async function CaseNarrativesBuilderPage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;
  const slug = commission;
  const access = await getCommissionAccessByOrg(org, commission);

  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  if (!(await narrativesEnabled())) {
    notFound();
  }

  // Mirror the outcomes manager and show the NON-archived working set (archive
  // hides from the picker; archived types stay snapshotted on existing slots/cases).
  const narrativeTypes = await listNarrativeTypes(access.commission.id);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {access.commission.name}
        </p>
        <h1 className="text-3xl text-balance">Construtor</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Defina as narrativas usadas para documentar os casos desta comissão.
        </p>
      </header>

      <ConstrutorTabs org={org} slug={slug} narrativesEnabled />

      <NarrativeTypeManager
        commissionId={access.commission.id}
        narrativeTypes={narrativeTypes}
      />
    </div>
  );
}
