import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { listPhaseResults, phaseResultsEnabled } from "@/lib/queries/phase-results";
import { narrativesEnabled } from "@/lib/case-narratives/actions";
import { SettingsTabs } from "@/components/cases/settings-tabs";
import { ResultVocabManager } from "@/components/cases/result-vocab-manager";

export const metadata: Metadata = {
  title: "Resultados das fases",
};

/**
 * Per-phase RESULT-vocabulary manager (coordinator area; phase-results feature):
 * create / rename / recolour / reorder / archive the commission's phase results
 * (with the advisory "is adverse" flag). Clones the `desfechos` settings route —
 * an already-approved coordinator-gated pattern — minus the "requires action
 * plan" flag.
 *
 * Coordinator-gated here (only a staff_admin of this commission OR a global admin
 * may reach it; everyone else gets `notFound()`); the CRUD actions are themselves
 * staff_admin-gated (RLS is the authority). Feature-flagged: when
 * `case_phase_results` is off the route 404s (and the Resultados tab is hidden),
 * so it is invisible until the increment ships.
 */
export default async function PhaseResultsSettingsPage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;
  const slug = commission;
  const access = await getCommissionAccessByOrg(org, commission);

  if (!access || (access.role !== "staff_admin" && !access.context.isAdmin)) {
    notFound();
  }

  if (!(await phaseResultsEnabled())) {
    notFound();
  }

  // Mirror the outcomes manager: show the NON-archived working set (archive hides
  // from the picker; archived results stay snapshotted/referenced on cases).
  const [results, narrativesOn] = await Promise.all([
    listPhaseResults(access.commission.id),
    narrativesEnabled(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {access.commission.name}
        </p>
        <h1 className="text-3xl text-balance">Configurações</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Personalize os resultados que as fases dos processos desta comissão podem
          emitir.
        </p>
      </header>

      <SettingsTabs org={org} slug={slug} narrativesEnabled={narrativesOn} phaseResultsEnabled />

      <ResultVocabManager
        commissionId={access.commission.id}
        results={results}
      />
    </div>
  );
}
