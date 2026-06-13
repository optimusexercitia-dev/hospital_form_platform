import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListChecks } from "lucide-react";

import { getCommissionAccess } from "@/lib/queries/session";
import { listMyAssignedPhases } from "@/lib/queries/cases";
import { MyPhaseCard } from "@/components/cases/my-phase-card";

export const metadata: Metadata = {
  title: "Minhas fases",
};

/**
 * "Minhas fases" (F5): the caller's ACTIVE assigned case phases in this
 * commission — the member-scoped "my work" landing for multi-phase cases,
 * distinct from the staff_admin "Casos" board. Open to staff and staff_admin
 * alike (a plain staff member may be a phase assignee). Scoped to the caller by
 * `listMyAssignedPhases` (RLS + `assigned_to = me`).
 *
 * Each row enters the phase landing, which starts/resumes the response and opens
 * the unchanged wizard.
 */
export default async function MyPhasesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const access = await getCommissionAccess(slug);
  if (!access) notFound();

  const phases = await listMyAssignedPhases(access.commission.id);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {access.commission.name}
        </p>
        <h1 className="text-3xl text-balance">Minhas fases</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          As fases de casos atribuídas a você que estão prontas para preencher.
        </p>
      </header>

      {phases.length === 0 ? (
        <EmptyState />
      ) : (
        <section aria-label="Fases atribuídas" className="flex flex-col gap-3">
          {phases.map((phase, index) => (
            <MyPhaseCard
              key={phase.phaseId}
              slug={slug}
              phase={phase}
              index={index}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-accent/60 text-accent-foreground">
        <ListChecks aria-hidden="true" className="size-6" />
      </span>
      <h2 className="text-lg font-semibold">Nenhuma fase pendente</h2>
      <p className="max-w-sm text-sm text-muted-foreground text-pretty">
        Quando a coordenação atribuir uma fase de caso a você e ela for ativada,
        ela aparecerá aqui para preenchimento.
      </p>
    </div>
  );
}
