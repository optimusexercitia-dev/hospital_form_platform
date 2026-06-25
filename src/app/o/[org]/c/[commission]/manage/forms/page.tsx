import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { listForms } from "@/lib/queries/forms";
import { FormCard } from "@/components/forms/form-card";
import { CreateFormDialog } from "@/components/forms/create-form-dialog";

export const metadata: Metadata = {
  title: "Construtor de formulários",
};

/**
 * Per-commission form builder list (coordinator area). Lists the commission's
 * forms with their lifecycle state and a "Novo formulário" create flow.
 *
 * Access is gated HERE on the server in addition to RLS: only a `staff_admin` of
 * this commission OR a global admin may reach it. Everyone else (staff of this
 * commission, members of another commission, unknown slug) gets `notFound()` —
 * mirroring the members page. RLS remains the ultimate boundary for the data.
 */
export default async function FormsListPage({
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

  const forms = await listForms(access.commission.id);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            {access.commission.name}
          </p>
          <h1 className="text-3xl text-balance">Formulários</h1>
          <p className="max-w-prose text-muted-foreground text-pretty">
            Construa, versione e publique os checklists e formulários da
            comissão.
          </p>
        </div>
        <CreateFormDialog commissionId={access.commission.id} />
      </header>

      {forms.length === 0 ? (
        <section
          aria-label="Nenhum formulário"
          className="animate-rise-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FileText aria-hidden="true" className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">Nenhum formulário ainda</h2>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            Crie o primeiro formulário da comissão para começar a estruturar
            seções e perguntas.
          </p>
          <div className="mt-2">
            <CreateFormDialog commissionId={access.commission.id} />
          </div>
        </section>
      ) : (
        <section
          aria-label="Formulários da comissão"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {forms.map((form, index) => (
            <FormCard
              key={form.id}
              form={form}
              org={org} slug={slug}
              index={index}
            />
          ))}
        </section>
      )}
    </div>
  );
}
