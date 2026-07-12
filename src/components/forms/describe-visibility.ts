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
 * since deleted) falls back to the raw key. form-model-normalization: a choice
 * condition STORES the option CODE, so the comparison value is also resolved
 * code → option label via {@link buildOptionLabelMap} (an unknown code falls back
 * to the raw code). Operator phrasing mirrors the `ConditionBuilder`'s
 * `OP_LABELS` so the card and the editor speak the same language.
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
  // F3 (ADR 0060 Rec D) — evaluator-only ops; not author-emittable. Present for the
  // exhaustive Record<ConditionOp> only (a stored visible_when never carries them today).
  contains: "contém",
  not_contains: "não contém",
  is_empty: "está vazio",
  is_not_empty: "não está vazio",
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

/**
 * Build a `question_key → (option code → option label)` map from the full ordered
 * section tree (form-model-normalization). Lets {@link describeVisibility} render
 * a choice condition's stored CODE value as its human option label on the builder
 * card. Only choice items contribute (others carry no options).
 */
export function buildOptionLabelMap(
  sections: Section[],
): Map<string, Map<string, string>> {
  const map = new Map<string, Map<string, string>>();
  for (const section of sections) {
    for (const item of section.items) {
      if (!item.questionKey || !item.options) continue;
      const codeToLabel = new Map<string, string>();
      for (const opt of item.options) codeToLabel.set(opt.code, opt.label);
      map.set(item.questionKey, codeToLabel);
    }
  }
  return map;
}

function isGroup(value: Visibility): value is ConditionGroup {
  return Array.isArray((value as ConditionGroup).conditions);
}

/**
 * Format a condition's comparison value for display (arrays → comma-joined).
 * `codeToLabel` (the controlling question's option code→label map, when it is a
 * choice question) resolves a stored option CODE to its human label; a non-choice
 * value (number/date/time) or an unknown code is shown as-is.
 */
function formatValue(
  value: VisibleWhen["value"],
  codeToLabel: Map<string, string> | undefined,
): string {
  if (value === null || value === undefined) return "";
  const resolve = (v: unknown) => codeToLabel?.get(String(v)) ?? String(v);
  if (Array.isArray(value)) return value.map(resolve).join(", ");
  return resolve(value);
}

/**
 * Describe a {@link Visibility}, or return `null` when the item is always
 * visible (no condition). A normalized 1-row group renders as a single clause
 * with no combinator, identical to the legacy single shape.
 *
 * `optionLabelByKey` (form-model-normalization) is the per-question
 * `code → option label` map from {@link buildOptionLabelMap}; pass it so a choice
 * condition's stored code value renders as its human label. Omitting it falls
 * back to showing raw codes (back-compatible signature).
 */
export function describeVisibility(
  visibility: Visibility | null | undefined,
  labelByKey: Map<string, string>,
  optionLabelByKey?: Map<string, Map<string, string>>,
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
    value: formatValue(c.value, optionLabelByKey?.get(c.question_key)),
  }));

  return { clauses, combinator };
}
