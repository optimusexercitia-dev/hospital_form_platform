import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Workflow } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { listProcessTemplates } from "@/lib/queries/process-templates";
import { ProcessTemplateCard } from "@/components/process-templates/process-template-card";
import { CreateProcessTemplateDialog } from "@/components/process-templates/create-process-template-dialog";

export const metadata: Metadata = {
  title: "Processos multifásicos",
};

/**
 * Per-commission process-template list (coordinator area). A process template is
 * a blueprint of ordered phase-slots (each bound to a whole form) used to mint
 * multi-phase cases (e.g. a Mortality & Morbidity review).
 *
 * Coordinator-gated HERE on the server (mirrors the form builder list): only a
 * `staff_admin` of this commission OR a global admin may reach it; everyone else
 * gets `notFound()`. RLS remains the ultimate boundary for the data.
 */
export default async function ProcessTemplatesListPage({
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

  const templates = await listProcessTemplates(access.commission.id);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            {access.commission.name}
          </p>
          <h1 className="text-3xl text-balance">Processos multifásicos</h1>
          <p className="max-w-prose text-muted-foreground text-pretty">
            Defina sequências de fases — cada fase é um formulário — para conduzir
            avaliações em mais de uma etapa. Sem dados de paciente.
          </p>
        </div>
        <CreateProcessTemplateDialog commissionId={access.commission.id} />
      </header>

      {templates.length === 0 ? (
        <section
          aria-label="Nenhum processo"
          className="animate-rise-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Workflow aria-hidden="true" className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">Nenhum processo ainda</h2>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            Crie o primeiro processo da comissão para estruturar uma avaliação em
            várias fases.
          </p>
          <div className="mt-2">
            <CreateProcessTemplateDialog commissionId={access.commission.id} />
          </div>
        </section>
      ) : (
        <section
          aria-label="Processos da comissão"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {templates.map((template, index) => (
            <ProcessTemplateCard
              key={template.id}
              template={template}
              org={org} slug={slug}
              index={index}
            />
          ))}
        </section>
      )}
    </div>
  );
}
