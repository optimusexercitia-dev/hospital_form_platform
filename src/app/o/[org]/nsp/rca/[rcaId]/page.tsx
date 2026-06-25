import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/queries/session";
import { patientSafetyEnabled } from "@/lib/queries/pqs";
import { getSafetyEvent } from "@/lib/queries/safety-events";
import {
  getRcaById,
  listAssignableUsers,
  listRcaCitationTargets,
  listRcaEvidence,
  listRcaFactors,
  listRcaMembers,
  listRcaRootCauses,
  listRcaTimeline,
  listRcaWhyChains,
} from "@/lib/queries/rca";
import { listCapaActions, listCapaPlansForRca } from "@/lib/queries/capa";
import {
  RcaWorkspace,
  type RcaWorkspaceData,
} from "@/components/safety/rca/rca-workspace";

export const metadata: Metadata = {
  title: "Análise de causa raiz",
};

/**
 * The RCA WORKSPACE (Phase 14c). 1:1 with a patient-safety event whose triage
 * mandated an RCA (`pathway = rca`); reached from the triage disposition rail's
 * "Abrir workspace de RCA". Loads the RCA + the event (for the breadcrumb/title) +
 * the team / timeline / evidence / fishbone factors / why-chains / root causes.
 *
 * Gating mirrors the other NSP pages: the admin layout enforces `isAdmin`; we
 * re-check it + the `patient_safety` flag → 404 when off. `getRcaById` returns
 * `null` outside the event's access scope → `notFound()` (RLS is the boundary).
 * Write controls are gated downstream by `rca.viewerCanWrite` (the server/RLS is
 * the authority).
 *
 * PHI-FREE: the RCA carries no patient identifiers; this page never loads the
 * isolated `event_patient` panel (that stays on the event detail, Rule 12).
 */
export default async function NspRcaPage({
  params,
}: {
  params: Promise<{ rcaId: string }>;
}) {
  const { rcaId } = await params;

  const context = await requireUser();
  if (!context.isAdmin) {
    notFound();
  }
  if (!(await patientSafetyEnabled())) {
    notFound();
  }

  const rca = await getRcaById(rcaId);
  if (!rca) {
    notFound();
  }

  const [
    event,
    members,
    timeline,
    evidence,
    factors,
    whyChains,
    rootCauses,
    users,
    citationTargets,
    capaPlans,
  ] = await Promise.all([
    getSafetyEvent(rca.eventId),
    listRcaMembers(rcaId),
    listRcaTimeline(rcaId),
    listRcaEvidence(rcaId),
    listRcaFactors(rcaId),
    listRcaWhyChains(rcaId),
    listRcaRootCauses(rcaId),
    // The admin/PQS-wide roster (member picker's `user_id` option) + the in-scope
    // citable artifacts (citation picker). Both RLS-scoped server-side.
    listAssignableUsers(),
    listRcaCitationTargets(rca.eventId),
    // Phase 14d — the CAPA plans opened from this RCA (stage 4).
    listCapaPlansForRca(rcaId),
  ]);

  // The root-cause→action linkage surfacing: count CAPA actions addressing each root
  // cause across this RCA's plans (the link lives on `capa_action.root_cause_id`).
  const capaActionLists = await Promise.all(
    capaPlans.map((p) => listCapaActions(p.id)),
  );
  const capaActionCountByRootCause: Record<string, number> = {};
  for (const list of capaActionLists) {
    for (const a of list) {
      if (a.rootCauseId) {
        capaActionCountByRootCause[a.rootCauseId] =
          (capaActionCountByRootCause[a.rootCauseId] ?? 0) + 1;
      }
    }
  }

  const data: RcaWorkspaceData = {
    rca,
    eventTitle: event?.title ?? rca.eventCode ?? "Evento de segurança",
    commissionName: event?.reportingCommissionName ?? null,
    members,
    timeline,
    evidence,
    factors,
    whyChains,
    rootCauses,
    users,
    citationTargets,
    capaPlans,
    capaActionCountByRootCause,
  };

  return <RcaWorkspace data={data} />;
}
