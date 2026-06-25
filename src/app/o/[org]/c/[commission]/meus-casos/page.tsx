import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Briefcase } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { listMyCases } from "@/lib/queries/cases";
import { caseAccessEnabled } from "@/lib/case-access/actions";
import { MyCaseCard } from "@/components/cases/my-case-card";

export const metadata: Metadata = {
  title: "Meus Casos",
};

/**
 * "Meus Casos" (Case Access Control increment, ADR 0033 D7): every case the caller
 * can access in this commission — personally ATTRIBUTED (a phase/narrative assignee)
 * OR GRANTED a `case_access` row — one card each, replacing "Minhas fases". Each card
 * lists the member's attributed items inline (direct Preencher / Abrir / Concluir)
 * plus "Ver caso completo" (the capability-gated detail page).
 *
 * Flag-gated: the canonical surface only exists when `case_access` is ON; with the
 * flag OFF this route 404s and "Minhas fases" remains the member's "my work" landing
 * (the invariant: flag OFF ⇒ today's behavior). Open to staff and staff_admin alike;
 * `listMyCases` is self-scoped (RLS), so it never leaks an inaccessible case.
 */
export default async function MyCasesPage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;
  const slug = commission;
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role === null) notFound();

  // Flag OFF → this surface does not exist yet (the redirect from /minhas-fases is
  // also gated on the flag, so OFF keeps the old page).
  if (!(await caseAccessEnabled())) notFound();

  const cases = await listMyCases(access.commission.id);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {access.commission.name}
        </p>
        <h1 className="text-3xl text-balance">Meus Casos</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Os casos a que você tem acesso — atribuídos a você ou compartilhados pela
          coordenação. Abra um caso para ver o panorama completo ou aja direto nas
          suas fases e narrativas.
        </p>
      </header>

      {cases.length === 0 ? (
        <EmptyState />
      ) : (
        <section aria-label="Casos acessíveis" className="flex flex-col gap-3">
          {cases.map((myCase, index) => (
            <MyCaseCard
              key={myCase.caseId}
              org={org} slug={slug}
              myCase={myCase}
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
        <Briefcase aria-hidden="true" className="size-6" />
      </span>
      <h2 className="text-lg font-semibold">Nenhum caso acessível</h2>
      <p className="max-w-sm text-sm text-muted-foreground text-pretty">
        Quando a coordenação atribuir uma fase ou narrativa a você, ou compartilhar
        um caso, ele aparecerá aqui.
      </p>
    </div>
  );
}
