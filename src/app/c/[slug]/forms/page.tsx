import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClipboardList } from "lucide-react";

import { getCommissionAccess } from "@/lib/queries/session";
import { listFillableForms } from "@/lib/queries/responses";
import { FillableFormCard } from "@/components/responses/fillable-form-card";
import { StartFillButton } from "@/components/responses/start-fill-button";

export const metadata: Metadata = {
  title: "Formulários",
};

/**
 * Staff form list (F1) — the published forms of the commission available for
 * filling. Open to staff AND staff_admin (both fill); a global admin viewing a
 * commission they're not a member of also sees it. Access is gated by the
 * layout; we re-read here (cheap, RLS-scoped) to resolve the commission id.
 *
 * Each card shows "Continuar preenchimento" when the user already has an
 * in_progress response for that form's published version, otherwise "Preencher"
 * (which starts a response and enters the wizard).
 */
export default async function FormsListPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const access = await getCommissionAccess(slug);
  if (!access) notFound();

  const forms = await listFillableForms(access.commission.id);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {access.commission.name}
        </p>
        <h1 className="text-3xl text-balance">Formulários</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Preencha os checklists e formulários publicados da comissão. O
          progresso é salvo automaticamente a cada seção, então você pode
          continuar mais tarde.
        </p>
      </header>

      {forms.length === 0 ? (
        <EmptyState />
      ) : (
        <section
          aria-label="Formulários disponíveis"
          className="grid gap-4 sm:grid-cols-2"
        >
          {forms.map((form, index) => (
            <FillableFormCard
              key={form.formId}
              slug={slug}
              form={form}
              index={index}
              startSlot={
                <StartFillButton
                  slug={slug}
                  formId={form.formId}
                  publishedVersionId={form.publishedVersionId}
                />
              }
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
        <ClipboardList aria-hidden="true" className="size-6" />
      </span>
      <h2 className="text-lg font-semibold">Nenhum formulário disponível</h2>
      <p className="max-w-sm text-sm text-muted-foreground text-pretty">
        Quando a coordenação publicar um formulário, ele aparecerá aqui para
        preenchimento.
      </p>
    </div>
  );
}
