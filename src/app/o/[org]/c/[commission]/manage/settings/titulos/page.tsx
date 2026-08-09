import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getCommissionAccessByOrg,
  canConfigureCommission,
} from "@/lib/queries/session";
import { listMemberTitles } from "@/lib/commissions/titles";
import { phaseResultsEnabled } from "@/lib/queries/phase-results";
import { meetingsEnabled } from "@/lib/meetings/actions";
import { SettingsTabs } from "@/components/cases/settings-tabs";
import { TitlesManager } from "@/components/commissions/titles-manager";

export const metadata: Metadata = {
  title: "Títulos dos membros",
};

/**
 * Committee member-title vocabulary settings (ADR 0051 Decision 6): the
 * commission's `staff_admin` manages "Presidente" / "Vice-Presidente" /
 * "Secretário(a)"… — always on, no feature flag. Clones the `resultados`
 * settings route (an already-approved coordinator-gated pattern).
 *
 * Coordinator-gated here (only a staff_admin of this commission OR a global/
 * hospital admin acting as coordinator may reach it — `role` already resolves
 * that mirror in `getCommissionAccessByOrg`); the CRUD actions are themselves
 * commission-admin-gated (RLS is the authority).
 */
export default async function TitlesSettingsPage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;
  const slug = commission;
  const access = await getCommissionAccessByOrg(org, commission);

  if (!access || !canConfigureCommission(access)) {
    notFound();
  }

  const [titles, phaseResultsOn, meetingsOn] = await Promise.all([
    listMemberTitles(access.commission.id),
    phaseResultsEnabled(),
    meetingsEnabled(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {access.commission.name}
        </p>
        <h1 className="text-3xl text-balance">Configurações</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Personalize os títulos que podem ser atribuídos aos membros desta
          comissão.
        </p>
      </header>

      <SettingsTabs
        org={org} slug={slug}
        phaseResultsEnabled={phaseResultsOn}
        meetingsEnabled={meetingsOn}
      />

      <TitlesManager commissionId={access.commission.id} titles={titles} />
    </div>
  );
}
