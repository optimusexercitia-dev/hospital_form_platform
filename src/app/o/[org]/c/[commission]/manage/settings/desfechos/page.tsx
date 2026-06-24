import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { listCaseOutcomes } from "@/lib/queries/case-outcomes";
import { narrativesEnabled } from "@/lib/case-narratives/actions";
import { phaseResultsEnabled } from "@/lib/queries/phase-results";
import { SettingsTabs } from "@/components/cases/settings-tabs";
import { OutcomeManager } from "@/components/cases/outcome-manager";

export const metadata: Metadata = {
  title: "Desfechos dos casos",
};

/**
 * Outcome-vocabulary manager (coordinator area): create / rename / recolour /
 * reorder / archive the commission's case outcomes (with the advisory
 * "requires action plan" / "is adverse" flags). Mirrors the `etiquetas` settings
 * route — an already-approved coordinator-gated pattern.
 *
 * Coordinator-gated here (only a staff_admin of this commission OR a global admin
 * may reach it; everyone else gets `notFound()`); the CRUD actions are themselves
 * staff_admin-gated (RLS is the authority).
 */
export default async function CaseOutcomesSettingsPage({
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

  const [outcomes, narrativesOn, phaseResultsOn] = await Promise.all([
    listCaseOutcomes(access.commission.id),
    narrativesEnabled(),
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
          Personalize os desfechos e as etiquetas usados nos casos desta comissão.
        </p>
      </header>

      <SettingsTabs
        org={org} slug={slug}
        narrativesEnabled={narrativesOn}
        phaseResultsEnabled={phaseResultsOn}
      />

      <OutcomeManager commissionId={access.commission.id} outcomes={outcomes} />
    </div>
  );
}
