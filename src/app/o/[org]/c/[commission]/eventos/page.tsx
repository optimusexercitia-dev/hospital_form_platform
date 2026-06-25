import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ShieldPlus } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { listCommissionEvents } from "@/lib/queries/safety-events";
import { patientSafetyEnabled } from "@/lib/queries/pqs";
import { Button } from "@/components/ui/button";
import { EventsList } from "@/components/safety/events-list";

export const metadata: Metadata = {
  title: "Eventos de segurança",
};

/**
 * Per-commission patient-safety read-back list (F2): the events this commission
 * reported OR currently holds, with their NSP status. Every member of the
 * commission reads the list (RLS-scoped — a foreign committee gets `[]`); any
 * member may notify a new event (just-culture). PHI-FREE — the list shows only
 * governance metadata.
 *
 * Gated behind the `patient_safety` flag — when off, the route 404s (the nav
 * item is hidden too). A non-member already gets `notFound()` from
 * `getCommissionAccessByOrg`.
 */
export default async function CommissionEventsPage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;

  if (!(await patientSafetyEnabled())) {
    notFound();
  }

  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role === null) {
    notFound();
  }

  const events = await listCommissionEvents(access.commission.id);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            {access.commission.name}
          </p>
          <h1 className="text-3xl text-balance">Eventos de segurança</h1>
          <p className="max-w-prose text-muted-foreground text-pretty">
            Acompanhe o estado dos eventos de segurança do paciente notificados
            por esta comissão ao Núcleo de Segurança do Paciente (NSP). Qualquer
            membro pode notificar um novo evento.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href={commissionHref(org, commission, "eventos", "novo")}>
            <ShieldPlus aria-hidden="true" />
            Notificar evento
          </Link>
        </Button>
      </header>

      <EventsList events={events} />
    </div>
  );
}
