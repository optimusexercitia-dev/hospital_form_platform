import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getNspAccessByOrg } from "@/lib/queries/session";
import { nspHref } from "@/lib/routing";
import { patientSafetyEnabled, getPqsDepartmentForOrg } from "@/lib/queries/pqs";
import { listEventTypes, listSentinelCriteria } from "@/lib/queries/triage";
import { SafetyMotion } from "@/components/safety/safety-motion";
import { EventTypeManager } from "@/components/safety/triage/event-type-manager";
import { SentinelCriterionManager } from "@/components/safety/triage/sentinel-criterion-manager";
import { RcaWindowForm } from "@/components/safety/triage/rca-window-form";

export const metadata: Metadata = {
  title: "NSP — configurações",
};

/**
 * The NSP CONFIG area (Phase 14b): manage the configurable event-type vocabulary,
 * the sentinel checklist, and the RCA due-window. The vocab (event types +
 * sentinel criteria) is GLOBAL config (shared across orgs); the RCA due-window is
 * PER-ORG (`pqs_department`).
 *
 * Access: the `/o/[org]/nsp` layout gates to a PQS member/coordinator of THIS
 * org + the `patient_safety` flag → 404 when off; the page pins the org. A
 * non-enrolled coordinator may reach config (the vocab managers are global; the
 * per-org RCA-window write is coordinator/member-gated server-side). The vocab
 * lists include INACTIVE entries (the managers show archived ones in a muted
 * section) so existing flags/events keep resolving.
 *
 * Org-scoping (NSP-per-org, ADR 0042): the RCA due-window reads the PER-ORG
 * `pqs_department` row via `getPqsDepartmentForOrg(access.orgId)`, and
 * `RcaWindowForm` submits through `setPqsRcaDueWindow(orgId, days)` (audited at
 * the org tier). The vocab managers stay global (shared config across orgs).
 */
export default async function NspConfigPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const access = await getNspAccessByOrg(org);
  if (!access) {
    notFound();
  }
  if (!(await patientSafetyEnabled())) {
    notFound();
  }

  const [eventTypes, criteria, department] = await Promise.all([
    listEventTypes(true),
    listSentinelCriteria(true),
    getPqsDepartmentForOrg(access.orgId),
  ]);

  return (
    <SafetyMotion runKey="nsp-config" className="flex flex-col gap-8">
      <header data-rise className="flex flex-col gap-3">
        <Link
          href={nspHref(org)}
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Fila do NSP
        </Link>
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Núcleo de Segurança do Paciente
        </p>
        <h1 className="text-3xl text-balance">Configurações da triagem</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Vocabulários e parâmetros que orientam a triagem de eventos: os tipos de
          evento, a lista de critérios sentinela e o prazo padrão da análise de
          causa raiz.
        </p>
      </header>

      <section
        data-rise
        aria-labelledby="cfg-event-types"
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-xs"
      >
        <h2 id="cfg-event-types" className="text-lg">
          Tipos de evento
        </h2>
        <EventTypeManager eventTypes={eventTypes} />
      </section>

      <section
        data-rise
        aria-labelledby="cfg-criteria"
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-xs"
      >
        <h2 id="cfg-criteria" className="text-lg">
          Critérios sentinela
        </h2>
        <SentinelCriterionManager criteria={criteria} />
      </section>

      <section
        data-rise
        aria-labelledby="cfg-rca-window"
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-xs"
      >
        <h2 id="cfg-rca-window" className="text-lg">
          Prazo da análise de causa raiz
        </h2>
        {department ? (
          <RcaWindowForm
            orgId={access.orgId}
            defaultDueDays={department.defaultDueDays}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar a configuração do NSP.
          </p>
        )}
      </section>
    </SafetyMotion>
  );
}
