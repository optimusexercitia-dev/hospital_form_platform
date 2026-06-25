import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getNspAccessByOrg } from "@/lib/queries/session";
import { listCommissionsForOrg } from "@/lib/queries/org";
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
 * Access: the `/o/[org]/nsp` layout gates to a PQS member/coordinator of THIS
 * org; here we re-resolve to pin the org id. We do NOT additionally 404 a
 * non-enrolled coordinator — the `pqs_inbox` RPC returns `[]` for a non-member,
 * so a coordinator-only user (PHI nav hidden) sees an empty workstation rather
 * than a hard 404. Also gated on the `patient_safety` flag → 404 when off. RLS +
 * the per-org door remain the boundary (a non-member's inbox is `[]`; an
 * out-of-scope event is `null`).
 *
 * Full-bleed: the shared NSP `main` is `max-w-7xl`; the workstation breaks out of
 * it with a scoped negative-margin wrapper (the layout itself is NOT edited).
 */
export default async function NspTriagePage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ event?: string }>;
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

  const [items, commissions] = await Promise.all([
    pqsInbox({}),
    listCommissionsForOrg(access.orgId),
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
        // wires the rail's "Abrir workspace de RCA" to /o/[org]/nsp/rca/<rcaId>.
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
          org={org}
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
