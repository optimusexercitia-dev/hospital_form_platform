import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccess } from "@/lib/queries/session";
import { listCaseStatusDefs } from "@/lib/queries/case-statuses";
import { SettingsTabs } from "@/components/cases/settings-tabs";
import { StatusManager } from "@/components/cases/status-manager";

export const metadata: Metadata = {
  title: "Estados dos casos",
};

/**
 * Case-status vocabulary manager (Cases-Extras R2, coordinator area): create /
 * rename / recolour / reorder / archive the commission's configurable case
 * statuses (which become the kanban columns).
 *
 * Coordinator-gated here (mirrors the cases board / builder): only a staff_admin
 * of this commission OR a global admin may reach it; everyone else gets
 * `notFound()`. The CRUD actions are themselves staff_admin-gated (RLS is the
 * authority).
 */
export default async function CaseStatusesSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const access = await getCommissionAccess(slug);

  if (!access || (access.role !== "staff_admin" && !access.context.isAdmin)) {
    notFound();
  }

  const defs = await listCaseStatusDefs(access.commission.id);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {access.commission.name}
        </p>
        <h1 className="text-3xl text-balance">Configurações</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Personalize os estados e as etiquetas usados nos casos desta comissão.
        </p>
      </header>

      <SettingsTabs slug={slug} />

      <StatusManager commissionId={access.commission.id} defs={defs} />
    </div>
  );
}
