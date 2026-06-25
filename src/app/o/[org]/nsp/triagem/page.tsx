import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/queries/session";
import { listCommissionsForAdmin } from "@/lib/queries/commissions";
import { pqsInbox, patientSafetyEnabled } from "@/lib/queries/pqs";
import {
  getSafetyEvent,
  getEventPatient,
} from "@/lib/queries/safety-events";
import {
  getEventTriage,
  getTriageDisposition,
  listSentinelCriteria,
} from "@/lib/queries/triage";
import { getRca } from "@/lib/queries/rca";
import {
  TriageWorkstation,
  type SelectedEventData,
} from "@/components/safety/triage/triage-workstation";

export const metadata: Metadata = {
  title: "NSP — triagem de eventos",
};

/**
 * The three-pane triage WORKSTATION (Phase 14b). Loads the PHI-FREE queue
 * (`pqsInbox`), resolves the selected event (`?event=<id>`, defaulting to the first
 * still-awaiting event), and for that event loads the worksheet + derived
 * disposition + the active sentinel checklist, plus — ONLY when the event has an
 * isolated PHI record — the AUDITED patient panel (`getEventPatient`, which emits
 * the `event_patient.read` audit row server-side, Rule 12). The queue path never
 * loads PHI.
 *
 * Gating mirrors the 14a NSP pages: the admin layout enforces `isAdmin`; we
 * re-check it + the `patient_safety` flag → 404 when off. RLS remains the boundary
 * (a non-PQS caller's inbox is `[]`; an out-of-scope event detail is `null`).
 *
 * Full-bleed: the shared admin `main` is `max-w-7xl`; the workstation breaks out of
 * it with a scoped negative-margin wrapper (the layout itself is NOT edited).
 */
export default async function NspTriagePage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const context = await requireUser();
  if (!context.isAdmin) {
    notFound();
  }
  if (!(await patientSafetyEnabled())) {
    notFound();
  }

  const sp = await searchParams;

  const [items, commissions] = await Promise.all([
    pqsInbox({}),
    listCommissionsForAdmin(),
  ]);

  const commissionNames = Object.fromEntries(
    commissions.map((c) => [c.id, c.name]),
  );

  // Resolve selection: the requested event, else the first still-awaiting one,
  // else the first in the queue.
  const requestedId = sp.event ?? null;
  const awaiting = items.filter(
    (it) => it.status === "reported" || it.status === "acknowledged",
  );
  const selectedId =
    (requestedId && items.some((it) => it.id === requestedId)
      ? requestedId
      : null) ??
    awaiting[0]?.id ??
    items[0]?.id ??
    null;

  // Queue stat readouts.
  const awaitingCount = awaiting.length;
  const sentinelCount = items.filter((it) => it.status === "triaged").length;
  const rcaCount = sentinelCount;

  let selected: SelectedEventData | null = null;
  if (selectedId) {
    const event = await getSafetyEvent(selectedId);
    if (event) {
      const [patient, triage, disposition, criteria, rca] = await Promise.all([
        event.hasPatient
          ? getEventPatient(selectedId)
          : Promise.resolve(null),
        getEventTriage(selectedId),
        getTriageDisposition(selectedId),
        listSentinelCriteria(),
        // The RCA shell exists only once a sentinel disposition is confirmed; its id
        // wires the rail's "Abrir workspace de RCA" to /admin/nsp/rca/<rcaId>.
        getRca(selectedId),
      ]);
      selected = {
        event,
        commissionName:
          event.reportingCommissionName ??
          commissionNames[event.reportingCommissionId] ??
          null,
        patient,
        triage,
        disposition,
        criteria,
        rcaId: rca?.id ?? null,
      };
    }
  }

  return (
    <div className="-mx-4 sm:-mx-6">
      <div className="px-4 sm:px-6">
        <TriageWorkstation
          items={items}
          commissionNames={commissionNames}
          selectedId={selectedId}
          selected={selected}
          awaitingCount={awaitingCount}
          sentinelCount={sentinelCount}
          rcaCount={rcaCount}
        />
      </div>
    </div>
  );
}
