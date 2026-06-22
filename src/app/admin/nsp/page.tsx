import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftRight, ListChecks, Settings, Users } from "lucide-react";

import { requireUser } from "@/lib/queries/session";
import { listCommissionsForAdmin } from "@/lib/queries/commissions";
import {
  pqsInbox,
  patientSafetyEnabled,
  type PqsInboxFilters,
} from "@/lib/queries/pqs";
import { referralsEnabled } from "@/lib/queries/referrals";
import { patientIndexEnabled } from "@/lib/queries/patient-index";
import {
  EVENT_STATUS_LABELS,
  SUSPECTED_HARM_LABELS,
  type EventStatus,
  type SuspectedHarmLevel,
} from "@/lib/queries/safety-events";
import { PqsInboxList } from "@/components/safety/pqs-inbox-list";
import { PqsInboxFiltersBar } from "@/components/safety/pqs-inbox-filters";

export const metadata: Metadata = {
  title: "NSP — fila de eventos",
};

/**
 * The NSP inbox/queue (F3): the central Núcleo de Segurança do Paciente triage
 * queue, served by the `is_pqs_member`-gated `pqs_inbox` RPC. PHI-FREE — it
 * shows governance metadata only; the patient panel is loaded (and audited)
 * only when an analyst opens an event detail.
 *
 * Gated behind the `patient_safety` flag (404 when off). The admin layout
 * already enforces `isAdmin` (today `is_pqs_member = is_admin`); we re-check
 * defensively. Filters are URL-driven (`?status=&priority=&commission=`); RLS
 * remains the boundary (a non-PQS caller gets `[]`).
 */
export default async function NspInboxPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    commission?: string;
  }>;
}) {
  const context = await requireUser();
  if (!context.isAdmin) {
    notFound();
  }
  if (!(await patientSafetyEnabled())) {
    notFound();
  }

  const sp = await searchParams;

  const filters: PqsInboxFilters = {
    status: (sp.status as EventStatus) || undefined,
    suspectedHarmLevel: (sp.priority as SuspectedHarmLevel) || undefined,
    reportingCommissionId: sp.commission || undefined,
  };

  const [items, commissions, referralsOn, patientIndexOn] = await Promise.all([
    pqsInbox(filters),
    listCommissionsForAdmin(),
    referralsEnabled(),
    patientIndexEnabled(),
  ]);

  const commissionNames = Object.fromEntries(
    commissions.map((c) => [c.id, c.name]),
  );

  // A stable key over the active filters so the entrance animation re-runs on
  // any filter change (mirrors the audit feed's page-keyed re-run).
  const runKey = `${sp.status ?? ""}|${sp.priority ?? ""}|${sp.commission ?? ""}`;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            Administração
          </p>
          <h1 className="text-3xl text-balance">
            Núcleo de Segurança do Paciente
          </h1>
          <p className="max-w-prose text-muted-foreground text-pretty">
            Fila de eventos de segurança notificados pelas comissões. Reconheça,
            acompanhe a custódia e abra cada evento para a análise. A
            identificação do paciente não aparece nesta lista — apenas dentro de
            cada evento, com acesso registrado.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href="/admin/nsp/triagem"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <ListChecks aria-hidden="true" className="size-4" />
            Abrir triagem
          </Link>
          {referralsOn && (
            <Link
              href="/admin/nsp/encaminhamentos"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <ArrowLeftRight aria-hidden="true" className="size-4" />
              Encaminhamentos
            </Link>
          )}
          {patientIndexOn && (
            <Link
              href="/admin/nsp/pacientes"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <Users aria-hidden="true" className="size-4" />
              Pacientes
            </Link>
          )}
          <Link
            href="/admin/nsp/configuracoes"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <Settings aria-hidden="true" className="size-4" />
            Configurações
          </Link>
        </div>
      </header>

      <PqsInboxFiltersBar
        statusOptions={Object.entries(EVENT_STATUS_LABELS)}
        priorityOptions={Object.entries(SUSPECTED_HARM_LABELS)}
        commissions={commissions.map((c) => ({ id: c.id, name: c.name }))}
        status={sp.status ?? null}
        priority={sp.priority ?? null}
        commission={sp.commission ?? null}
      />

      <PqsInboxList
        items={items}
        commissionNames={commissionNames}
        runKey={runKey}
      />
    </div>
  );
}
