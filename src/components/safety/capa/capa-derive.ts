/**
 * The CAPA workspace's derived values (Phase 14d). PURE + client-safe (zero data
 * access): the single source of truth for the plan-level PDCA wheel, the
 * conclude-gate, and the per-action advance entitlement — recomputed from the REAL
 * committed contract (`@/lib/safety/capa-types`).
 *
 * Our CAPA model is richer than the README's per-action 4-cell PDCA: measures +
 * effectiveness live at the PLAN level and `capa_plan.status` already encodes the
 * PDCA progression, so the wheel is keyed off the plan lifecycle + child
 * completeness (purely derived — no separate state).
 */

import type {
  CapaAction,
  CapaEffectiveness,
  CapaMeasure,
  CapaMeasureResult,
  CapaPlan,
} from "@/lib/safety/capa-types";

/** The four PDCA cells, in clockwise order. */
export type PdcaStageId = "plan" | "do" | "check" | "act";
export type PdcaCellStatus = "todo" | "active" | "done";

export const PDCA_ORDER: PdcaStageId[] = ["plan", "do", "check", "act"];

/** pt-BR label + blurb + compass letter per PDCA cell. */
export const PDCA_META: Record<
  PdcaStageId,
  { letter: string; label: string; blurb: string }
> = {
  plan: {
    letter: "P",
    label: "Planejar",
    blurb: "Ações corretivas definidas",
  },
  do: { letter: "D", label: "Executar", blurb: "Ações em execução" },
  check: {
    letter: "C",
    label: "Verificar",
    blurb: "Medidas com resultados",
  },
  act: { letter: "A", label: "Agir", blurb: "Eficácia e encerramento" },
};

/**
 * Whether every action is settled (concluída or cancelada) — and there is at least
 * one. Drives the "Do" cell and the conclude-gate.
 */
export function allActionsSettled(actions: CapaAction[]): boolean {
  return (
    actions.length > 0 &&
    actions.every((a) => a.status === "concluida" || a.status === "cancelada")
  );
}

/** Whether every measure has at least one recorded result. Drives the "Check" cell. */
export function allMeasuresHaveResults(
  measures: CapaMeasure[],
  resultsByMeasure: Map<string, CapaMeasureResult[]>,
): boolean {
  if (measures.length === 0) return false;
  return measures.every((m) => (resultsByMeasure.get(m.id)?.length ?? 0) > 0);
}

/**
 * The plan-level PDCA cell statuses (README_rca §7.1 wheel), derived from the plan
 * status + child completeness:
 *  - Plan : actions defined (status past `aberto`)
 *  - Do   : actions executing/settled (status ≥ `em_verificacao` OR all settled)
 *  - Check: measures recorded with results (status ≥ `em_verificacao` AND all measured)
 *  - Act  : effectiveness verdict recorded + closed (status `concluido`)
 * `active` is the first non-done cell; nothing is active once concluído/cancelado.
 */
export function derivePdca(
  plan: CapaPlan,
  actions: CapaAction[],
  measures: CapaMeasure[],
  resultsByMeasure: Map<string, CapaMeasureResult[]>,
): Record<PdcaStageId, PdcaCellStatus> {
  const s = plan.status;
  const beyondOpen = s === "em_execucao" || s === "em_verificacao" || s === "concluido";
  const beyondExec = s === "em_verificacao" || s === "concluido";

  const done: Record<PdcaStageId, boolean> = {
    plan: beyondOpen && actions.length > 0,
    do: beyondExec || allActionsSettled(actions),
    check: beyondExec && allMeasuresHaveResults(measures, resultsByMeasure),
    act: s === "concluido",
  };

  const result = {} as Record<PdcaStageId, PdcaCellStatus>;
  let activeAssigned = false;
  const terminal = s === "concluido" || s === "cancelado";
  for (const cell of PDCA_ORDER) {
    if (done[cell]) {
      result[cell] = "done";
    } else if (!activeAssigned && !terminal) {
      result[cell] = "active";
      activeAssigned = true;
    } else {
      result[cell] = "todo";
    }
  }
  return result;
}

/** The number of `done` PDCA cells (the wheel center count). */
export function countPdcaDone(
  cells: Record<PdcaStageId, PdcaCellStatus>,
): number {
  return PDCA_ORDER.filter((c) => cells[c] === "done").length;
}

/** The currently-active cell (for the wheel center label), or null. */
export function activePdcaStage(
  cells: Record<PdcaStageId, PdcaCellStatus>,
): PdcaStageId | null {
  return PDCA_ORDER.find((c) => cells[c] === "active") ?? null;
}

/**
 * The conclude-gate (HC051 / HC052 mirrored client-side for the disabled-button UX):
 * a plan may be concluded only from `em_verificacao` with all actions settled AND an
 * effectiveness verdict recorded. The server re-enforces — this drives the explicit
 * ✓/✗ checklist + disabled "Concluir" button.
 */
export interface ConcludeGate {
  allActionsSettled: boolean;
  hasEffectiveness: boolean;
  inVerification: boolean;
  canConclude: boolean;
}

export function concludeGate(
  plan: CapaPlan,
  actions: CapaAction[],
  effectiveness: CapaEffectiveness | null,
): ConcludeGate {
  const settled = allActionsSettled(actions);
  const hasEffectiveness = effectiveness != null;
  const inVerification = plan.status === "em_verificacao";
  return {
    allActionsSettled: settled,
    hasEffectiveness,
    inVerification,
    canConclude: inVerification && settled && hasEffectiveness,
  };
}

/**
 * Whether the viewer may advance THIS action (the narrow assignee-OR-PQS path): the
 * plan manager, or the action's assignee. The server (HC050) is the authority; this
 * gates the control's visibility.
 */
export function canAdvanceAction(
  plan: CapaPlan,
  action: CapaAction,
  sessionUserId: string | null,
): boolean {
  if (plan.viewerCanManage) return true;
  return sessionUserId != null && action.assigneeUserId === sessionUserId;
}

/** Group measure results by their measure id (newest period first, server-ordered). */
export function groupResultsByMeasure(
  results: CapaMeasureResult[],
): Map<string, CapaMeasureResult[]> {
  const map = new Map<string, CapaMeasureResult[]>();
  for (const r of results) {
    const list = map.get(r.measureId) ?? [];
    list.push(r);
    map.set(r.measureId, list);
  }
  return map;
}
