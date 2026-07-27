import type { AnswerMap } from "@/lib/queries/conditions";
import type { Item, Section } from "@/lib/queries/forms";

import type { AnswerRecord, AnswerState } from "./types";

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
 * Mirrors `app.response_required_complete`'s emptiness test: no answer with a
 * non-null, non-`'null'::jsonb` value (and, for choice items, no selection —
 * which on the client is the same empty-array check).
 */
export function isEmptyInstance(instance: InstanceState): boolean {
  return !Object.values(instance.answers).some(hasMeaningfulValue);
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
