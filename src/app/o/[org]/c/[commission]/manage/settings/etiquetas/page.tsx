import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { listCaseTags } from "@/lib/queries/case-tags";
import { narrativesEnabled } from "@/lib/case-narratives/actions";
import { phaseResultsEnabled } from "@/lib/queries/phase-results";
import { SettingsTabs } from "@/components/cases/settings-tabs";
import { TagManager } from "@/components/cases/tag-manager";

export const metadata: Metadata = {
  title: "Etiquetas dos casos",
};

/**
 * Tag-vocabulary manager (Cases-Extras R3, coordinator area): create / rename /
 * recolour / archive the commission's case tags.
 *
 * Coordinator-gated here (mirrors the cases board / builder); the CRUD actions
 * are themselves staff_admin-gated (RLS is the authority).
 */
export default async function CaseTagsSettingsPage({
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

  const [tags, narrativesOn, phaseResultsOn] = await Promise.all([
    listCaseTags(access.commission.id),
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

      <TagManager commissionId={access.commission.id} tags={tags} />
    </div>
  );
}
