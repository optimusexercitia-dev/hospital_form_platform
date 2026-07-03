import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getNspAccessByOrg } from "@/lib/queries/session";
import { nspHref } from "@/lib/routing";
import {
  patientSafetyEnabled,
  getPqsDepartmentForHospital,
} from "@/lib/queries/pqs";
import { listEventTypes, listSentinelCriteria } from "@/lib/queries/triage";
import { SafetyMotion } from "@/components/safety/safety-motion";
import { EventTypeManager } from "@/components/safety/triage/event-type-manager";
import { SentinelCriterionManager } from "@/components/safety/triage/sentinel-criterion-manager";
import { RcaWindowForm } from "@/components/safety/triage/rca-window-form";
import { resolveNspHospital } from "@/components/shell/nsp-hospital-scope";

export const metadata: Metadata = {
  title: "NSP — configurações",
};

/**
 * The NSP CONFIG area (Phase 14b): manage the configurable event-type vocabulary,
 * the sentinel checklist, and the RCA due-window. The vocab (event types +
 * sentinel criteria) is GLOBAL config (shared across orgs); the RCA due-window is
 * PER-HOSPITAL (`pqs_department`, NSP-per-hospital, ADR 0052).
 *
 * Access: the `/o/[org]/nsp` layout gates to an operator of ≥1 hospital in THIS
 * org + the `patient_safety` flag → 404 when off; the page resolves the selected
 * `?hospital=`. The vocab managers are global (any operator may view/edit them —
 * global config). The per-hospital RCA-window write is `nsp_org_admin OR
 * coordinator`-gated server-side, so the RCA form is shown only when the caller
 * COORDINATES the selected hospital; a plain member sees the vocab + a note. The
 * vocab lists include INACTIVE entries (archived ones shown muted) so existing
 * flags/events keep resolving.
 *
 * Hospital-scoping (ADR 0052): the RCA due-window reads the PER-HOSPITAL
 * `pqs_department` row via `getPqsDepartmentForHospital(hospitalId)`, and
 * `RcaWindowForm` submits through `setPqsRcaDueWindow(hospitalId, days)` (audited at
 * the hospital tier). The vocab managers stay global.
 */
export default async function NspConfigPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ hospital?: string }>;
}) {
  const { org } = await params;
  const access = await getNspAccessByOrg(org);
  if (!access) {
    notFound();
  }
  if (!(await patientSafetyEnabled())) {
    notFound();
  }

  const sp = await searchParams;
  const hospital = resolveNspHospital(access.hospitals, sp.hospital);
  if (!hospital) {
    notFound();
  }
  const canEditRcaWindow = hospital.role === "coordinator";

  const [eventTypes, criteria, department] = await Promise.all([
    listEventTypes(true),
    listSentinelCriteria(true),
    getPqsDepartmentForHospital(hospital.hospitalId),
  ]);

  return (
    <SafetyMotion runKey="nsp-config" className="flex flex-col gap-8">
      <header data-rise className="flex flex-col gap-3">
        <Link
          href={`${nspHref(org)}?hospital=${encodeURIComponent(hospital.hospitalId)}`}
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
        <div className="flex flex-col gap-1">
          <h2 id="cfg-rca-window" className="text-lg">
            Prazo da análise de causa raiz
          </h2>
          {access.hospitals.length > 1 ? (
            <p className="text-sm text-muted-foreground">
              Configuração do hospital {hospital.hospitalName}.
            </p>
          ) : null}
        </div>
        {!department ? (
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar a configuração do NSP deste hospital.
          </p>
        ) : canEditRcaWindow ? (
          <RcaWindowForm
            hospitalId={hospital.hospitalId}
            defaultDueDays={department.defaultDueDays}
          />
        ) : (
          <p className="text-sm text-muted-foreground text-pretty">
            O prazo padrão da RCA deste hospital é de{" "}
            <strong className="tabular-nums">{department.defaultDueDays}</strong>{" "}
            dias. Apenas a coordenação do NSP deste hospital pode alterá-lo.
          </p>
        )}
      </section>
    </SafetyMotion>
  );
}
