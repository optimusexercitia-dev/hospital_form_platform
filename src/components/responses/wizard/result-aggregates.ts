import type { Item, Section } from "@/lib/queries/forms";
import type { AnswerMap, FlaggedWhenInput } from "@/lib/queries/conditions";
import { computeAggregateKeys } from "@/lib/queries/conditions";

import type { AnswerState } from "./types";
import type { InstanceState } from "./instances";

/**
 * The end-of-wizard result preview's ANSWER MAP — the wizard's plain
 * `question_key → value` map PLUS the two reserved aggregate keys
 * (`__total_score__`, `__flagged_count__`).
 *
 * Why this exists (BUG: the review screen's computed result disagreed with the
 * one the case recorded): `walkResultRuleset` is an UNCHANGED evaluator on both
 * sides of the mirror — a rule keyed on an aggregate only ever fires because the
 * CALLER injected that key first. SQL `app.compute_case_phase_result` injects
 * both keys before its rule-walk; the wizard preview handed it the bare answer
 * map, so `{ __total_score__ >= 2 }` tested an ABSENT key, evaluated false, and
 * the preview fell through to `default_result_id` — while the conclude-time
 * compute (the authority) got it right. The two disagreed for every ruleset that
 * scores or flags.
 *
 * Mirror notes (`app.compute_case_phase_result` +
 * `app.case_phase_option_aggregates`):
 *   - the score/flagged half sums the SELECTED options of every
 *     `multiple_choice`/`dropdown`/`checkbox` answer of the response — top level
 *     AND inside repeating-group instances, because the SQL aggregate joins
 *     `answer_selected_options` for the whole response with no
 *     `group_instance_id` filter. A null `score` counts as 0;
 *   - the `flaggedWhen` half evaluates each `number`/`date`/`time` item's own
 *     condition through the UNCHANGED `evalCondition`, against the same value the
 *     rest of the evaluator sees.
 *
 * KNOWN, BOUNDED DIVERGENCE: the `flaggedWhen` half reads the TOP-LEVEL answer
 * map, so a `flaggedWhen` on a repeating-group CHILD contributes nothing here.
 * SQL's `app.case_phase_answer_map` folds instance scalars into the same
 * flat key space, where N repetitions of one key collapse to a single
 * last-writer-wins entry — an order-dependent value no client mirror can
 * reproduce. Preview and authority agree everywhere the SQL side is itself
 * well-defined.
 */
export function buildResultAnswerMap({
  sections,
  answers,
  instances,
  answerMap,
}: {
  /** The version's section tree (containers carry their `children`). */
  sections: Section[];
  /** The wizard's TOP-LEVEL answer records, keyed by item id. */
  answers: AnswerState;
  /** The response's repeating-group instances (their answers score too). */
  instances: InstanceState[];
  /** The wizard's derived `question_key → value` map. */
  answerMap: AnswerMap;
}): AnswerMap {
  const itemsById = new Map<string, Item>();
  for (const section of sections) collectItems(section.items, itemsById);

  const selectedOptionScores: number[] = [];
  let selectedFlaggedCount = 0;

  const tally = (state: AnswerState) => {
    for (const rec of Object.values(state)) {
      const item = itemsById.get(rec.itemId);
      if (!item || !CHOICE_TYPES.has(item.itemType)) continue;
      const options = item.options;
      if (!options || options.length === 0) continue;
      for (const code of selectedCodes(rec.value)) {
        const option = options.find((o) => o.code === code);
        if (!option) continue;
        // A null score contributes nothing; `computeAggregateKeys` treats the
        // list as the non-null scores (SQL: `coalesce(score, 0)`).
        if (typeof option.score === "number") selectedOptionScores.push(option.score);
        if (option.flagged) selectedFlaggedCount += 1;
      }
    }
  };

  tally(answers);
  for (const instance of instances) tally(instance.answers);

  const flaggedWhenInputs: FlaggedWhenInput[] = [];
  for (const item of itemsById.values()) {
    if (!FLAGGED_WHEN_TYPES.has(item.itemType)) continue;
    const flaggedWhen = item.config?.flaggedWhen;
    if (!flaggedWhen) continue;
    if (item.questionKey == null) continue;
    flaggedWhenInputs.push({
      answer: answerMap[item.questionKey],
      flaggedWhen,
    });
  }

  return {
    ...answerMap,
    ...computeAggregateKeys({
      selectedOptionScores,
      selectedFlaggedCount,
      flaggedWhenInputs,
    }),
  };
}

/** The item types whose SELECTED options carry `score`/`flagged`. */
const CHOICE_TYPES = new Set<string>(["multiple_choice", "dropdown", "checkbox"]);

/** The item types that may carry a `config.flaggedWhen` (SQL uses the same three). */
const FLAGGED_WHEN_TYPES = new Set<string>(["number", "date", "time"]);

/**
 * Index every item by id, descending into BOTH container kinds: a plain
 * `group`'s children answer at top level, and a `repeating_group`'s children
 * answer per instance — and both kinds of answer are rows the SQL aggregate
 * sums, so both must be resolvable here.
 */
function collectItems(items: Item[], into: Map<string, Item>): void {
  for (const item of items) {
    into.set(item.id, item);
    if (item.children.length > 0) collectItems(item.children, into);
  }
}

/**
 * The option CODES a stored choice answer selects: a scalar for
 * `multiple_choice`/`dropdown`, an array for `checkbox`. Anything else (an empty
 * answer, a non-string payload) selects nothing.
 */
function selectedCodes(value: unknown): string[] {
  if (typeof value === "string") return value === "" ? [] : [value];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}
