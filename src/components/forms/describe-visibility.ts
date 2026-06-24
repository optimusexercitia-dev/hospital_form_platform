import type {
  ConditionGroup,
  ConditionOp,
  Section,
  Visibility,
  VisibleWhen,
} from "@/lib/queries/forms";

/**
 * Turn a stored {@link Visibility} into a human-readable pt-BR summary for the
 * builder — so an author can SEE, on the question card, that a question has a
 * conditional appearance and exactly what triggers it, without opening the
 * editor. Pure + server-safe (no `next/headers`, mirrors the `condition-targets`
 * module boundary) so both Server and Client components can render it.
 *
 * It resolves each condition's `question_key` to the controlling question's
 * human label via {@link buildQuestionLabelMap}; an unresolved key (e.g. a target
 * since deleted) falls back to the raw key. Operator phrasing mirrors the
 * `ConditionBuilder`'s `OP_LABELS` so the card and the editor speak the same
 * language.
 */

/** pt-BR operator phrases (mirrors `condition-builder`'s `OP_LABELS`). */
const OP_LABELS: Record<ConditionOp, string> = {
  equals: "é igual a",
  not_equals: "é diferente de",
  in: "é uma das opções",
  gt: "é maior que",
  gte: "é maior ou igual a",
  lt: "é menor que",
  lte: "é menor ou igual a",
};

/** One rendered clause of a condition summary. */
export interface ConditionClause {
  /** The controlling question's human label (or its raw key if unresolved). */
  target: string;
  /** The pt-BR operator phrase (e.g. "é igual a"). */
  op: string;
  /** The formatted comparison value (e.g. "Sim", "A, B"); "" when absent. */
  value: string;
}

/** A condition summary: the ordered clauses plus how they combine. */
export interface VisibilitySummary {
  clauses: ConditionClause[];
  /** `all` = E, `any` = OU; `null` for a single clause (no combinator shown). */
  combinator: "all" | "any" | null;
}

/** Build a `question_key → label` map from the full ordered section tree. */
export function buildQuestionLabelMap(sections: Section[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const section of sections) {
    for (const item of section.items) {
      if (item.questionKey) {
        map.set(item.questionKey, item.label ?? item.questionKey);
      }
    }
  }
  return map;
}

function isGroup(value: Visibility): value is ConditionGroup {
  return Array.isArray((value as ConditionGroup).conditions);
}

/** Format a condition's comparison value for display (arrays → comma-joined). */
function formatValue(value: VisibleWhen["value"]): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  return String(value);
}

/**
 * Describe a {@link Visibility}, or return `null` when the item is always
 * visible (no condition). A normalized 1-row group renders as a single clause
 * with no combinator, identical to the legacy single shape.
 */
export function describeVisibility(
  visibility: Visibility | null | undefined,
  labelByKey: Map<string, string>,
): VisibilitySummary | null {
  if (visibility == null) return null;

  const conditions: VisibleWhen[] = isGroup(visibility)
    ? visibility.conditions
    : [visibility];
  if (conditions.length === 0) return null;

  const combinator =
    isGroup(visibility) && conditions.length > 1 ? visibility.match : null;

  const clauses: ConditionClause[] = conditions.map((c) => ({
    target: labelByKey.get(c.question_key) ?? c.question_key,
    op: OP_LABELS[c.op],
    value: formatValue(c.value),
  }));

  return { clauses, combinator };
}
