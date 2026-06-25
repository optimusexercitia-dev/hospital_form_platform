import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/queries/session";
import { patientSafetyEnabled } from "@/lib/queries/pqs";
import {
  getCapaPlan,
  getCapaEffectiveness,
  listCapaActions,
  listCapaActionEvidence,
  listCapaActionTasks,
  listCapaMeasureResults,
  listCapaMeasures,
} from "@/lib/queries/capa";
import { listAssignableUsers, listRcaRootCauses } from "@/lib/queries/rca";
import type {
  CapaActionEvidence,
  CapaActionTask,
  CapaMeasureResult,
} from "@/lib/safety/capa-types";
import {
  CapaWorkspace,
  type CapaWorkspaceData,
} from "@/components/safety/capa/capa-workspace";

export const metadata: Metadata = {
  title: "Plano de ação (CAPA)",
};

/**
 * The CAPA workspace (Phase 14d — README_rca stage 4). 1:1 with a `capa_plan`,
 * reached from the RCA stage-4 list / a root cause / the event detail. Loads the plan
 * + actions (with each action's tasks + implementation evidence) + measures (with
 * results) + the effectiveness verdict + the source RCA's root causes (for the
 * action↔root-cause linkage labels) + the assignable-user roster + the session user
 * id (for the assignee self-advance gate).
 *
 * Gating mirrors the other NSP pages: the admin layout enforces `isAdmin`; re-checked
 * + the `patient_safety` flag → 404. `getCapaPlan` returns `null` out of scope →
 * `notFound()` (RLS boundary). PHI-free.
 */
export default async function NspCapaPage({
  params,
}: {
  params: Promise<{ capaId: string }>;
}) {
  const { capaId } = await params;

  const context = await requireUser();
  if (!context.isAdmin) {
    notFound();
  }
  if (!(await patientSafetyEnabled())) {
    notFound();
  }

  const plan = await getCapaPlan(capaId);
  if (!plan) {
    notFound();
  }

  const [actions, measures, effectiveness, users] = await Promise.all([
    listCapaActions(capaId),
    listCapaMeasures(capaId),
    getCapaEffectiveness(capaId),
    listAssignableUsers(),
  ]);

  // Per-action tasks + evidence (a detail view; bounded fan-out), the source RCA's
  // root causes (only when RCA-sourced), and each measure's results.
  const [tasksLists, evidenceLists, resultLists, rootCauses] = await Promise.all([
    Promise.all(actions.map((a) => listCapaActionTasks(a.id))),
    Promise.all(actions.map((a) => listCapaActionEvidence(a.id))),
    Promise.all(measures.map((m) => listCapaMeasureResults(m.id))),
    plan.source === "rca" && plan.sourceId
      ? listRcaRootCauses(plan.sourceId)
      : Promise.resolve([]),
  ]);

  const tasksByAction = new Map<string, CapaActionTask[]>();
  actions.forEach((a, i) => tasksByAction.set(a.id, tasksLists[i]));
  const evidenceByAction = new Map<string, CapaActionEvidence[]>();
  actions.forEach((a, i) => evidenceByAction.set(a.id, evidenceLists[i]));
  const measureResults: CapaMeasureResult[] = resultLists.flat();

  const data: CapaWorkspaceData = {
    plan,
    actions,
    tasksByAction,
    evidenceByAction,
    measures,
    measureResults,
    effectiveness,
    rootCauses,
    users,
    sessionUserId: context.userId,
  };

  return <CapaWorkspace data={data} />;
}
