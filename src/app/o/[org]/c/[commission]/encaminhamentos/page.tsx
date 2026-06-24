import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import {
  listCommissionReferrals,
  referralsEnabled,
} from "@/lib/queries/referrals";
import { ReferralsHubSections } from "@/components/referrals/referrals-list";

export const metadata: Metadata = {
  title: "Encaminhamentos",
};

/**
 * The per-commission "Encaminhamentos" hub (Decision 11): the referrals this
 * commission SENT ("Enviados") and RECEIVED ("Recebidos"), each with its
 * lifecycle status. Mirrors the patient-safety read-back page (`eventos/page.tsx`):
 * a Server Component that gates on the feature flag, resolves commission access,
 * loads the RLS-scoped list, and hands plain props to the client table.
 *
 * PHI-FREE — the list shows only governance metadata (code, subject, type,
 * status, counterpart committee, case number, dates). Patient context surfaces
 * only on drill-down to an authorized reader, audited.
 *
 * Gated behind the `case_referrals` flag — when off the route 404s (the nav item
 * is hidden too). A non-member already gets `notFound()` from
 * `getCommissionAccessByOrg`; a foreign committee gets `[]` from the RLS-scoped query.
 */
export default async function CommissionReferralsPage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;
  const slug = commission;

  if (!(await referralsEnabled())) {
    notFound();
  }

  const access = await getCommissionAccessByOrg(org, commission);
  if (!access) {
    notFound();
  }

  const referrals = await listCommissionReferrals(access.commission.id);
  const incoming = referrals.filter((r) => r.direction === "incoming");
  const outgoing = referrals.filter((r) => r.direction === "outgoing");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {access.commission.name}
        </p>
        <h1 className="inline-flex items-center gap-2.5 text-3xl text-balance">
          <ArrowLeftRight aria-hidden="true" className="size-7 text-primary" />
          Encaminhamentos
        </h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Acompanhe os casos encaminhados entre comissões. Cada encaminhamento
          compartilha uma visão selecionada de um caso com outra comissão para
          análise ou ciência — o trabalho interno de cada comissão permanece
          privado. Para encaminhar um caso, abra o caso e use{" "}
          <span className="font-medium text-foreground">Encaminhar caso</span>.
        </p>
      </header>

      <ReferralsHubSections
        org={org}
        slug={slug}
        incoming={incoming}
        outgoing={outgoing}
      />
    </div>
  );
}
