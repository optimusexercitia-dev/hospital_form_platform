import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Inbox } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { listMyResponses } from "@/lib/queries/responses";
import { MyResponseCard } from "@/components/responses/my-response-card";

export const metadata: Metadata = {
  title: "Minhas respostas",
};

/**
 * "Minhas respostas" history (F6): the caller's own responses in this
 * commission — submitted AND in_progress — newest-activity first. Scoped to the
 * caller by RLS (`responses_select` returns own rows of any status). Open to
 * staff and staff_admin alike.
 *
 * In_progress rows offer "Continuar" (back into the wizard); submitted rows
 * offer "Ver" (the full read-only viewer arrives in Phase 7).
 */
export default async function MyResponsesPage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;
  const slug = commission;
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role === null) notFound();

  const responses = await listMyResponses(access.commission.id);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {access.commission.name}
        </p>
        <h1 className="text-3xl text-balance">Minhas respostas</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Acompanhe o que você já enviou e o que está em andamento.
        </p>
      </header>

      {responses.length === 0 ? (
        <EmptyState />
      ) : (
        <section aria-label="Histórico de respostas" className="flex flex-col gap-3">
          {responses.map((response, index) => (
            <MyResponseCard
              key={response.id}
              org={org} slug={slug}
              response={response}
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
        <Inbox aria-hidden="true" className="size-6" />
      </span>
      <h2 className="text-lg font-semibold">Nenhuma resposta ainda</h2>
      <p className="max-w-sm text-sm text-muted-foreground text-pretty">
        Quando você começar a preencher um formulário, ele aparecerá aqui para
        você continuar ou revisar.
      </p>
    </div>
  );
}
