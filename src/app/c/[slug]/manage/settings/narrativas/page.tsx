import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccess } from "@/lib/queries/session";
import { listNarrativeTypes } from "@/lib/queries/case-narratives";
import { narrativesEnabled } from "@/lib/case-narratives/actions";
import { phaseResultsEnabled } from "@/lib/queries/phase-results";
import { SettingsTabs } from "@/components/cases/settings-tabs";
import { NarrativeTypeManager } from "@/components/cases/narrative-type-manager";

export const metadata: Metadata = {
  title: "Narrativas dos casos",
};

/**
 * Narrative-type vocabulary manager (coordinator area; ADR 0032): create /
 * rename / reorder / archive the commission's narrative TYPES. Clones the
 * `desfechos` settings route — an already-approved coordinator-gated pattern —
 * minus the colour token.
 *
 * Coordinator-gated here (only a staff_admin of this commission OR a global admin
 * may reach it; everyone else gets `notFound()`); the CRUD actions are themselves
 * staff_admin-gated (RLS is the authority). Feature-flagged: when `case_narratives`
 * is off the route 404s (and the Narrativas tab is hidden), so it is invisible
 * until the increment ships.
 */
export default async function CaseNarrativesSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const access = await getCommissionAccess(slug);

  if (!access || (access.role !== "staff_admin" && !access.context.isAdmin)) {
    notFound();
  }

  if (!(await narrativesEnabled())) {
    notFound();
  }

  // The settings manager shows the full vocabulary incl. archived? No — mirror
  // the outcomes manager and show the NON-archived working set (archive hides
  // from the picker; archived types stay snapshotted on existing slots/cases).
  const [narrativeTypes, phaseResultsOn] = await Promise.all([
    listNarrativeTypes(access.commission.id),
    phaseResultsEnabled(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {access.commission.name}
        </p>
        <h1 className="text-3xl text-balance">Configurações</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Personalize os desfechos, as etiquetas e as narrativas usados nos casos
          desta comissão.
        </p>
      </header>

      <SettingsTabs
        slug={slug}
        narrativesEnabled
        phaseResultsEnabled={phaseResultsOn}
      />

      <NarrativeTypeManager
        commissionId={access.commission.id}
        narrativeTypes={narrativeTypes}
      />
    </div>
  );
}
