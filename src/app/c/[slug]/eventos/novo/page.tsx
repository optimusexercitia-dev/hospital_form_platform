import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getCommissionAccess } from "@/lib/queries/session";
import { patientSafetyEnabled } from "@/lib/queries/pqs";
import { StandaloneNotify } from "@/components/safety/standalone-notify";

export const metadata: Metadata = {
  title: "Notificar evento ao NSP",
};

/**
 * Stand-alone (case-less) "notificar evento" entry (F1): any member of the
 * commission may notify the NSP of a patient-safety event not tied to a case
 * (just-culture — the RPC authorizes membership of the reporting commission, not
 * a role). Mirrors the case-detail dialog but as a full page reachable from the
 * commission events area.
 *
 * Flag-gated (`patient_safety` → 404 when off); a non-member already gets
 * `notFound()` from `getCommissionAccess`.
 */
export default async function NewCommissionEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!(await patientSafetyEnabled())) {
    notFound();
  }

  const access = await getCommissionAccess(slug);
  if (!access) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-4">
        <Link
          href={`/c/${slug}/eventos`}
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Eventos de segurança
        </Link>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            {access.commission.name}
          </p>
          <h1 className="text-3xl text-balance">Notificar evento ao NSP</h1>
          <p className="max-w-prose text-muted-foreground text-pretty">
            Encaminhe um evento de segurança do paciente ao Núcleo de Segurança
            do Paciente. Informe a narrativa e o dano suspeito; a identificação do
            paciente é opcional.
          </p>
        </div>
      </header>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <StandaloneNotify slug={slug} commissionId={access.commission.id} />
      </div>
    </div>
  );
}
