import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FolderOpen } from "lucide-react";

import { getCommissionAccess } from "@/lib/queries/session";
import { listCasesBoard } from "@/lib/queries/cases";
import { listProcessTemplates } from "@/lib/queries/process-templates";
import { CaseBoardCard } from "@/components/cases/case-board-card";
import { CreateCaseDialog } from "@/components/cases/create-case-dialog";

export const metadata: Metadata = {
  title: "Casos",
};

/**
 * Per-commission cases board (coordinator area): one row per case with its
 * phases' progress and a "Novo caso" create flow. Backed by the SECURITY DEFINER
 * `list_cases_board` (internally `is_staff_admin_of`-gated → `[]` for non-staff_
 * admins), but we ALSO gate the route here so a non-coordinator gets `notFound()`
 * rather than an empty board.
 *
 * The board carries STATUS ONLY — never answers (the Phase-7 invariant).
 */
export default async function CasesBoardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const access = await getCommissionAccess(slug);

  if (!access || (access.role !== "staff_admin" && !access.context.isAdmin)) {
    notFound();
  }

  const [rows, templates] = await Promise.all([
    listCasesBoard(access.commission.id),
    listProcessTemplates(access.commission.id),
  ]);

  // A case can only be minted from an ACTIVE template.
  const activeTemplates = templates
    .filter((t) => t.status === "active")
    .map((t) => ({ id: t.id, title: t.title }));

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            {access.commission.name}
          </p>
          <h1 className="text-3xl text-balance">Casos</h1>
          <p className="max-w-prose text-muted-foreground text-pretty">
            Acompanhe as avaliações multifásicas em andamento e o progresso de cada
            fase. Um caso é identificado por um número — nunca por dados de
            paciente.
          </p>
        </div>
        <CreateCaseDialog slug={slug} templates={activeTemplates} />
      </header>

      {rows.length === 0 ? (
        <section
          aria-label="Nenhum caso"
          className="animate-rise-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FolderOpen aria-hidden="true" className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">Nenhum caso ainda</h2>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            {activeTemplates.length === 0
              ? "Publique um processo multifásico para começar a criar casos."
              : "Crie o primeiro caso a partir de um processo publicado."}
          </p>
          {activeTemplates.length > 0 && (
            <div className="mt-2">
              <CreateCaseDialog slug={slug} templates={activeTemplates} />
            </div>
          )}
        </section>
      ) : (
        <section aria-label="Casos da comissão" className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <CaseBoardCard
              key={row.case.id}
              slug={slug}
              row={row}
              index={index}
            />
          ))}
        </section>
      )}
    </div>
  );
}
