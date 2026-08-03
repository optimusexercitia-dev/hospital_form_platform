import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { listFrameworks } from "@/lib/queries/accreditation";
import { commissionHref } from "@/lib/routing";
import { FrameworkList } from "@/components/accreditation/framework-list";

export const metadata: Metadata = {
  title: "Acreditação",
};

/**
 * Framework list (Phase 16, ADR 0093). Coordinator area — the flag + role
 * are enforced by the `manage/acreditacao` layout. Global (ONA/JCI) packs
 * plus any framework this commission has already cloned.
 */
export default async function AcreditacaoPage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const frameworks = await listFrameworks(access.commission.id);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {access.commission.name}
        </p>
        <h1 className="text-3xl text-balance">Acreditação</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Vincule os artefatos que a comissão já produz como evidência de conformidade
          aos padrões ONA/JCI, autoavalie cada padrão e acompanhe as lacunas de
          prontidão.
        </p>
      </header>

      <FrameworkList
        frameworks={frameworks}
        commissionId={access.commission.id}
        canManage={access.role === "staff_admin"}
        frameworkHref={(frameworkId) =>
          commissionHref(org, commission, "manage", "acreditacao", frameworkId)
        }
      />
    </div>
  );
}
