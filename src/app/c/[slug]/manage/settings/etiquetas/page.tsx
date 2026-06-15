import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccess } from "@/lib/queries/session";
import { listCaseTags } from "@/lib/queries/case-tags";
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
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const access = await getCommissionAccess(slug);

  if (!access || (access.role !== "staff_admin" && !access.context.isAdmin)) {
    notFound();
  }

  const tags = await listCaseTags(access.commission.id);

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

      <SettingsTabs slug={slug} />

      <TagManager commissionId={access.commission.id} tags={tags} />
    </div>
  );
}
