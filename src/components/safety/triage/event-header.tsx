import { Building2, CalendarClock, MapPin, User2, FolderOpen } from "lucide-react";

import type { EventPatient, SafetyEvent } from "@/lib/safety/types";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { SuspectedHarmChip } from "../event-chips";
import { PatientPanel, PatientPanelEmpty } from "../patient-panel";
import { formatDateTime, formatEventCode } from "../format";
import { sourceChipClass } from "./triage-visuals";

/**
 * The center-pane CONTEXT strip (README_triage §5): the event id (mono) · source
 * chip · suspected-harm flag · received time, the brief as a serif headline, a meta
 * line, the reporter's sanitized-Markdown narrative, and the in-scope PHI panel.
 *
 * The PHI {@link EventPatient} is loaded (and AUDITED) by the SERVER page only when
 * `event.hasPatient` is true; we render whatever it hands us here and do NO data
 * access (Rule 12). `patient = null` with `hasPatient` true means "in scope, no
 * identifiers" → the empty affordance.
 */
export function EventHeader({
  event,
  commissionName,
  patient,
}: {
  event: SafetyEvent;
  commissionName: string | null;
  patient: EventPatient | null;
}) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          {formatEventCode(event.code)}
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-medium",
            sourceChipClass(event.reportingCommissionId),
          )}
        >
          {commissionName ?? event.reportingCommissionName ?? "Comissão"}
        </span>
        <SuspectedHarmChip level={event.suspectedHarmLevel} />
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          Notificado em {formatDateTime(event.reportedAt)}
        </span>
      </div>

      <h2 className="text-2xl leading-tight text-balance">{event.title}</h2>

      <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        {event.location && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin aria-hidden="true" className="size-4" />
            {event.location}
          </span>
        )}
        {event.discoveredAt && (
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <CalendarClock aria-hidden="true" className="size-4" />
            {formatDateTime(event.discoveredAt)}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Building2 aria-hidden="true" className="size-4" />
          {commissionName ?? event.reportingCommissionName ?? "Comissão"}
        </span>
        {event.reportedByName && (
          <span className="inline-flex items-center gap-1.5">
            <User2 aria-hidden="true" className="size-4" />
            {event.reportedByName}
          </span>
        )}
        {event.caseNumber != null && (
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <FolderOpen aria-hidden="true" className="size-4" />
            Caso {String(event.caseNumber).padStart(4, "0")}
          </span>
        )}
      </dl>

      {event.descriptionMd?.trim() ? (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <MarkdownRenderer content={event.descriptionMd} />
        </div>
      ) : null}

      {event.hasPatient ? (
        patient ? (
          <PatientPanel patient={patient} />
        ) : (
          <PatientPanelEmpty />
        )
      ) : (
        <PatientPanelEmpty />
      )}
    </header>
  );
}
