import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  CalendarClock,
  Building2,
  ListChecks,
  ClipboardList,
  Users,
} from "lucide-react";

import { requireUser } from "@/lib/queries/session";
import {
  getSafetyEvent,
  getEventCustody,
  getEventPatient,
} from "@/lib/queries/safety-events";
import { patientSafetyEnabled } from "@/lib/queries/pqs";
import { patientIndexEnabled } from "@/lib/queries/patient-index";
import { listCapaPlansForEvent } from "@/lib/queries/capa";
import { OpenCapaButton } from "@/components/safety/capa/open-capa-button";
import { CapaPlanCard } from "@/components/safety/capa/capa-plan-card";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { SafetyMotion } from "@/components/safety/safety-motion";
import {
  EventStatusChip,
  OwnerChip,
  SuspectedHarmChip,
} from "@/components/safety/event-chips";
import { AcknowledgeButton } from "@/components/safety/acknowledge-button";
import { CustodyHistory } from "@/components/safety/custody-history";
import {
  PatientPanel,
  PatientPanelEmpty,
} from "@/components/safety/patient-panel";
import { formatDate, formatDateTime, formatEventCode } from "@/components/safety/format";

export const metadata: Metadata = {
  title: "Evento de segurança",
};

/**
 * The NSP event detail (F3 + F4): an analyst's working view of one event —
 * governance metadata, the reporter's sanitized-Markdown narrative, the
 * acknowledge action (while `reported`), the append-only custody ledger, and the
 * ISOLATED PHI patient panel.
 *
 * Gating: admin layout enforces `isAdmin` (today `is_pqs_member = is_admin`);
 * re-checked here + `patient_safety` flag → 404 when off. `getSafetyEvent`
 * returns `null` outside the access-follows-custody scope → `notFound()` (a
 * foreign committee sees nothing — RLS is the boundary, not UI hiding).
 *
 * PHI (Rule 12): the patient panel loads via the AUDITED `getEventPatient`,
 * which emits the `event_patient.read` audit row SERVER-SIDE. We call it ONLY
 * when `event.hasPatient` is true (so the audited read never fires for a missing
 * record), and never on a list/queue path.
 */
export default async function NspEventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const context = await requireUser();
  if (!context.isAdmin) {
    notFound();
  }
  if (!(await patientSafetyEnabled())) {
    notFound();
  }

  const event = await getSafetyEvent(eventId);
  if (!event) {
    notFound();
  }

  // Custody ledger always loads; the AUDITED PHI read fires only when a record
  // exists (Rule 12 — no audit row for a non-existent read). CAPA plans (Phase 14d)
  // sourced from this event are listed alongside.
  const [custody, patient, capaPlans, patientIndexOn] = await Promise.all([
    getEventCustody(eventId),
    event.hasPatient ? getEventPatient(eventId) : Promise.resolve(null),
    listCapaPlansForEvent(eventId),
    patientIndexEnabled(),
  ]);

  // QPS-only cross-committee trajectory deep-link. This page is already
  // `isAdmin`-gated and in the NSP admin area (where `is_pqs_member = is_admin`
  // today); the target page re-gates `isAdmin` + the `patient_index` flag and the
  // trajectory data is PQS-gated server-side. Shown only when the event carries a
  // patient and the flag is on (so the link never 404s / never points at nothing).
  const showTrajectoryLink = patientIndexOn && event.hasPatient;

  const meta: { icon: typeof MapPin; label: string; value: string }[] = [];
  if (event.location) {
    meta.push({ icon: MapPin, label: "Local", value: event.location });
  }
  if (event.discoveredAt) {
    meta.push({
      icon: CalendarClock,
      label: "Data do evento",
      value: formatDate(event.discoveredAt),
    });
  }
  meta.push({
    icon: Building2,
    label: "Comissão notificante",
    value: event.reportingCommissionName ?? "Comissão",
  });

  return (
    <SafetyMotion runKey={event.id} className="flex flex-col gap-8">
      <header data-rise className="flex flex-col gap-4">
        <Link
          href="/admin/nsp"
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Fila do NSP
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="font-mono text-xs text-muted-foreground">
              {formatEventCode(event.code)}
              {event.caseNumber != null
                ? ` · Caso ${String(event.caseNumber).padStart(4, "0")}`
                : ""}
            </span>
            <h1 className="text-3xl text-balance">{event.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <EventStatusChip status={event.status} />
              <SuspectedHarmChip level={event.suspectedHarmLevel} />
              <OwnerChip
                ownerKind={event.currentOwnerKind}
                commissionName={event.currentOwnerCommissionName}
              />
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {event.status === "reported" && (
              <AcknowledgeButton eventId={event.id} />
            )}
            {showTrajectoryLink && (
              <Link
                href={`/admin/nsp/pacientes?entity=event:${event.id}`}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <Users aria-hidden="true" className="size-4" />
                Ver trajetória do paciente
              </Link>
            )}
            <Link
              href={`/admin/nsp/triagem?event=${event.id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <ListChecks aria-hidden="true" className="size-4" />
              Abrir triagem
            </Link>
          </div>
        </div>

        <p className="text-sm text-muted-foreground tabular-nums">
          Notificado em {formatDateTime(event.reportedAt)}
          {event.reportedByName ? ` por ${event.reportedByName}` : ""}
          {event.acknowledgedAt
            ? ` · Reconhecido em ${formatDateTime(event.acknowledgedAt)}${
                event.acknowledgedByName ? ` por ${event.acknowledgedByName}` : ""
              }`
            : ""}
        </p>
      </header>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-6">
          {/* Reporter narrative (sanitized Markdown — Rule 7). */}
          <section
            data-rise
            aria-labelledby="event-narrative-heading"
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
          >
            <h2 id="event-narrative-heading" className="text-base font-semibold">
              Descrição do evento
            </h2>
            {event.descriptionMd?.trim() ? (
              <MarkdownRenderer content={event.descriptionMd} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Sem descrição registrada.
              </p>
            )}
          </section>

          {/* Governance metadata. */}
          <section
            data-rise
            aria-labelledby="event-meta-heading"
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
          >
            <h2 id="event-meta-heading" className="text-base font-semibold">
              Dados do evento
            </h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {meta.map((m) => {
                const Icon = m.icon;
                return (
                  <div key={m.label} className="flex flex-col gap-0.5">
                    <dt className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      <Icon aria-hidden="true" className="size-3.5" />
                      {m.label}
                    </dt>
                    <dd className="text-sm text-foreground">{m.value}</dd>
                  </div>
                );
              })}
            </dl>
          </section>

          {/* Isolated PHI panel (F4) — audited read; in-scope only. */}
          <div data-rise>
            {patient ? (
              <PatientPanel patient={patient} />
            ) : (
              <PatientPanelEmpty />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-8">
          {/* CAPA plans (Phase 14d) sourced from this event. */}
          <section
            data-rise
            aria-labelledby="event-capa-heading"
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2
                id="event-capa-heading"
                className="inline-flex items-center gap-2 text-base font-semibold"
              >
                <ClipboardList
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
                Planos de ação
              </h2>
              <OpenCapaButton
                source="event"
                sourceId={event.id}
                label="Abrir plano"
                variant="outline"
                size="sm"
              />
            </div>
            {capaPlans.length === 0 ? (
              <p className="text-sm text-muted-foreground text-pretty">
                Nenhum plano de ação para este evento.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {capaPlans.map((plan) => (
                  <li key={plan.id}>
                    <CapaPlanCard plan={plan} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div data-rise>
            <CustodyHistory entries={custody} />
          </div>
        </div>
      </div>
    </SafetyMotion>
  );
}
