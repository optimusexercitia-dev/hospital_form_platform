import type { AnswerMap } from "@/lib/queries/conditions";
import type { Item, Section } from "@/lib/queries/forms";
import type { MatrixCellsState, RiskMatrixState } from "@/lib/forms/matrix";

import type { AnswerRecord, AnswerState } from "./types";
import { hasAnyReference, type ReferenceState } from "./references";

/**
 * FF-1 (ADR 0087) — the wizard's REPEATING-GROUP instance state, kept pure so
 * both `use-wizard` and the per-instance renderers share one shape.
 *
 * A `repeating_group` owns N instances (`response_group_instances`); each holds
 * its own answers for the container's children. A plain `group` produces NO
 * instances at all (ruling 6) — its children answer at top level and live in
 * the ordinary {@link AnswerState}, so nothing here touches them.
 */

/** One instance as the client holds it while filling. */
export interface InstanceState {
  /** `response_group_instances.id` — the id the save/remove/reorder calls use. */
  id: string;
  /** The owning `repeating_group` item. */
  groupItemId: string;
  /** 0-based order within its group; kept contiguous by the instance RPCs. */
  position: number;
  /** This instance's own answers, keyed by item_id — same shape as top level. */
  answers: AnswerState;
  /**
   * FF-2 — this instance's own matrix grids / risk selections. A matrix inside a
   * repeating group answers PER INSTANCE, exactly as a scalar child does, so the
   * three slices together are one scope's complete answer state.
   *
   * OPTIONAL so the hand-built instance fixtures in the component tests need not
   * enumerate a field irrelevant to them; every reader treats absent as `{}`. The
   * collectors take the whole scope object rather than the three slices
   * separately, so a new slice cannot be silently dropped from a save payload
   * the way `observationsByItemId` (BUG-FBE-004) and `otherTextByItemId`
   * (BUG-FBE-008) each were.
   */
  matrixCells?: MatrixCellsState;
  riskMatrix?: RiskMatrixState;
  /**
   * FF-5 — this instance's own entity references. A reference inside a repeating
   * group answers PER INSTANCE like every other child, so the four slices
   * together are one scope's complete answer state. Optional for the same
   * fixture reason as the two above; every reader treats absent as `{}`.
   */
  references?: ReferenceState;
}

/** The per-group instance lists, keyed by the container's item id. */
export type InstancesByGroup = Record<string, InstanceState[]>;

/**
 * Group a flat instance list by container and sort each group by `position`,
 * so a renderer never depends on the incoming order.
 */
export function groupInstances(instances: InstanceState[]): InstancesByGroup {
  const byGroup: InstancesByGroup = {};
  for (const instance of instances) {
    (byGroup[instance.groupItemId] ??= []).push(instance);
  }
  for (const list of Object.values(byGroup)) {
    list.sort((a, b) => a.position - b.position);
  }
  return byGroup;
}

/** An instance's `question_key → value` map, for the 2-tier overlay. Only
 *  ANSWERED keys appear: the overlay contract forbids an explicit `undefined`
 *  value, because `evalCondition` tests key PRESENCE. */
export function instanceAnswerMap(instance: InstanceState): AnswerMap {
  const map: AnswerMap = {};
  for (const rec of Object.values(instance.answers)) {
    map[rec.questionKey] = rec.value;
  }
  return map;
}

/**
 * Every `repeating_group` of a section, in document order — the containers the
 * wizard renders with instance chrome.
 */
export function repeatingGroupsOfSection(section: Section): Item[] {
  return section.items.filter((item) => item.itemType === "repeating_group");
}

/**
 * True when an instance holds no meaningful answer at all — the emptiness test
 * ADR 0087 ruling 3 turns on. A fully-empty instance is NOT incomplete: it is
 * not there. `submit_response` PRUNES it before evaluating completeness, and
 * `minInstances` is enforced on what remains, so the wizard must count the same
 * way or its live "faltam N repetições" hint would disagree with the server.
 *
 * Mirrors `app.instance_is_empty`: no answer with a non-null, non-`'null'::jsonb`
 * value, no selection (the same empty-array check on the client), no matrix cell
 * and no risk selection (FF-2) — and, as of FF-5, **no entity reference either**.
 *
 * ⚠ Those last two clauses are not cosmetic, and FF-5's is the SAME blindness
 * FF-2 found, one payload table later. A matrix answer lives in
 * `answer_matrix_cells` / `answer_risk_matrix` and a reference lives in
 * `answer_references`, both with `answers.value` NULL — so an instance whose
 * only content is one of them looks empty to a value-only test. The SQL twin was
 * blind to exactly this for matrices and would have let `submit_response` PRUNE
 * such an instance, destroying the answer with its payload cascading after it
 * (ADR 0089 §A; ADR 0091 ruling 6 restates it verbatim for references, which is
 * why the arm is added here in the same wave as the writer rather than after a
 * bug report). The client mirror must count the same way or the review screen
 * would hide a repetition the server is about to keep.
 */
export function isEmptyInstance(instance: InstanceState): boolean {
  if (Object.values(instance.answers).some(hasMeaningfulValue)) return false;
  const cells = instance.matrixCells ?? {};
  if (Object.values(cells).some((grid) => Object.keys(grid).length > 0)) {
    return false;
  }
  if (Object.keys(instance.riskMatrix ?? {}).length > 0) return false;
  return !hasAnyReference(instance.references);
}

function hasMeaningfulValue(rec: AnswerRecord): boolean {
  const value = rec.value;
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** The instances that would SURVIVE submit — the set `minInstances` is checked
 *  against (ruling 3: prune first, then enforce). */
export function survivingInstances(instances: InstanceState[]): InstanceState[] {
  return instances.filter((instance) => !isEmptyInstance(instance));
}

/**
 * The pt-BR reason a repeating group currently blocks submission, or `null` when
 * it is satisfied. Client-side UX only — `submit_response` is the authority and
 * raises its own pt-BR message — but the wording deliberately matches the
 * server's intent: an unmet minimum reads as "adicione ao menos N", never as
 * "campo obrigatório" pointing into a blank row the user never meant to create.
 */
export function describeInstanceShortfall(
  container: Item,
  instances: InstanceState[],
): string | null {
  const min = container.config?.minInstances ?? null;
  if (min === null || min <= 0) return null;
  const kept = survivingInstances(instances).length;
  if (kept >= min) return null;
  const missing = min - kept;
  return missing === 1
    ? "Adicione ao menos mais 1 repetição preenchida."
    : `Adicione ao menos mais ${missing} repetições preenchidas.`;
}

/** Whether another instance may be added — `maxInstances` is enforced by the
 *  `add_group_instance` RPC; this only disables the affordance so the user is
 *  never offered an action the server will refuse. */
export function canAddInstance(
  container: Item,
  instances: InstanceState[],
): boolean {
  const max = container.config?.maxInstances ?? null;
  return max === null || instances.length < max;
}
