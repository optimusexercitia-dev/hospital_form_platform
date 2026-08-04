import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getReadinessReport, getStandardTree, listFrameworks } from "@/lib/queries/accreditation";
import type { ReadinessRow } from "@/lib/accreditation/types";
import { StandardsTree } from "@/components/accreditation/standards-tree";

/**
 * One framework's master-detail shell: the standards tree (master, sticky on
 * desktop) beside whichever standard the nested route renders (detail —
 * `page.tsx`'s empty state, or `padrao/[standard]/page.tsx`'s panel).
 */
export default async function FrameworkLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string; commission: string; framework: string }>;
}) {
  const { org, commission, framework: frameworkId } = await params;
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const [tree, frameworks, readiness] = await Promise.all([
    getStandardTree(frameworkId),
    listFrameworks(access.commission.id),
    getReadinessReport(access.commission.id, frameworkId),
  ]);

  const framework = frameworks.find((f) => f.id === frameworkId);
  if (!framework) {
    notFound();
  }

  const readinessByStandardId: Record<string, ReadinessRow> = {};
  for (const row of readiness) {
    readinessByStandardId[row.standardId] = row;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {access.commission.name}
        </p>
        <h1 className="text-2xl font-semibold text-balance">{framework.name}</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr] lg:items-start">
        <nav
          aria-label={`Padrões de ${framework.name}`}
          className="rounded-2xl border border-border bg-card p-3 shadow-xs lg:sticky lg:top-6"
        >
          <StandardsTree
            nodes={tree}
            readinessByStandardId={readinessByStandardId}
            org={org}
            commission={commission}
            frameworkId={frameworkId}
          />
        </nav>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
