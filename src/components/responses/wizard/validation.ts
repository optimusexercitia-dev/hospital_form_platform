import type { Item, Section } from "@/lib/queries/forms";
import { isMatrixComplete, isRiskComplete } from "@/lib/forms/matrix";
import type { AnswerMap } from "@/lib/queries/conditions";
import { overlayAnswerMap } from "@/lib/queries/conditions";
import {
  evalValidation,
  itemIsRequired,
  type ValidationRuleSpec,
} from "@/lib/forms/validation-rules";
import type { Json } from "@/lib/types/database";

import type { ScopeState } from "./collect";
import {
  describeInstanceShortfall,
  instanceAnswerMap,
  isEmptyInstance,
  type InstanceState,
} from "./instances";
import {
  hasAnswer,
  isAnswerableItem,
  isInputItem,
  isMatrixItem,
} from "./use-wizard";

/**
 * Per-section client-side validation (F2). This is UX ONLY: it gives immediate
 * feedback before "Próximo"/"Revisar", but `submit_response` on the server is
 * the authority (ARCHITECTURE Rule 3 / PHASES Phase 5). It mirrors the server's
 * checks so the two rarely disagree, but the server always has the final word:
 *   - every required input in a VISIBLE section + VISIBLE item is answered;
 *   - a `number`/`date` answer respects the item's optional min/max `config`
 *     bounds (mirror of the submit RPC's HC061 range rule).
 *
 * `visibleItemIds` (form-builder-enhancements): when provided, items hidden by
 * an item-level condition are skipped entirely (no required check, no bounds
 * check) — they collect no answer.
 *
 * Returns a map of `item_id → pt-BR error message`. Empty map = the section
 * passes.
 */
export function validateSection(
  section: Section,
  scope: ScopeState,
  visibleItemIds?: Set<string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const { answers } = scope;
  // FF-1: a plain `group`'s children answer at TOP LEVEL (ruling 6), so they
  // validate here exactly like flat items. A `repeating_group`'s children do
  // NOT — they are per-instance and go through `validateInstances`. Walking
  // `section.items` alone would silently stop enforcing `required` on every
  // plain-group child.
  const flat = section.items.flatMap((item) =>
    item.itemType === "group" ? item.children : [item],
  );
  for (const item of flat) {
    // Skip items hidden by an item-level condition — for a matrix too: ITEM
    // visibility wins over `required` (ADR 0089 ruling 3), so a hidden matrix
    // requires nothing, exactly as a hidden scalar does.
    if (visibleItemIds && !visibleItemIds.has(item.id)) continue;

    if (isMatrixItem(item.itemType)) {
      const matrixError = checkMatrix(item, scope);
      if (matrixError) errors[item.id] = matrixError;
      continue;
    }
    if (!isInputItem(item.itemType)) continue;

    const answered = hasAnswer(answers[item.id]);

    if (item.required && !answered) {
      errors[item.id] = "Esta pergunta é obrigatória.";
      continue;
    }
    // Range check only when there IS an answer (an empty optional is fine).
    if (answered) {
      const boundsError = checkBounds(item, answers[item.id]?.value);
      if (boundsError) errors[item.id] = boundsError;
    }
  }
  return errors;
}

/**
 * FF-2 (ADR 0089 ruling 3) — the client mirror of the matrix arm of
 * `app.item_required_satisfied`.
 *
 * A required `matrix` is ROW-COMPLETE: every row must carry a cell, not merely
 * one row somewhere. The weaker reading would make a 20-row checklist satisfiable
 * with a single tick, which is why the PO rejected it. A required `risk_matrix`
 * is satisfied by its single answer row existing — both halves chosen.
 *
 * An OPTIONAL matrix is never an error: a partly-filled optional grid is a
 * legitimate state, and the server agrees (the arm only runs for `required`).
 * UX only; `submit_response` remains the authority.
 */
function checkMatrix(item: Item, scope: ScopeState): string | null {
  if (!item.required) return null;
  const rows = item.matrixRows ?? [];
  const columns = item.matrixColumns ?? [];

  if (item.itemType === "risk_matrix") {
    return isRiskComplete(rows, columns, scope.riskMatrix?.[item.id])
      ? null
      : "Selecione a severidade e a probabilidade.";
  }
  return isMatrixComplete(rows, columns, scope.matrixCells?.[item.id])
    ? null
    : "Responda todas as linhas desta matriz.";
}

/**
 * FF-1 (ADR 0087) — per-INSTANCE validation of a section's repeating groups.
 *
 * Mirrors the two things `submit_response` does, in the same order (ruling 3):
 *   1. **Prune, then check.** A fully-EMPTY instance is not incomplete — it is
 *      not there. It contributes no field errors (a required child inside a
 *      blank row must never be reported: the actual fix is "remove the row",
 *      which is not what "campo obrigatório" says), and it does not count
 *      toward `minInstances`.
 *   2. **Then cardinality.** An unmet minimum is reported against the CONTAINER,
 *      in the "adicione ao menos N" register.
 *
 * Field errors are keyed `${instanceId}:${itemId}` so the same child can be
 * invalid in one repetition and fine in another; container errors are keyed by
 * the container's item id.
 *
 * A container hidden by its own condition is skipped entirely — visibility wins,
 * including over `minInstances`.
 */
export function validateInstances(
  section: Section,
  instancesByGroup: Record<string, InstanceState[]>,
  visibleItemIdsByInstance: Map<string, Set<string>>,
  visibleContainerIds?: Set<string>,
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const container of section.items) {
    if (container.itemType !== "repeating_group") continue;
    if (visibleContainerIds && !visibleContainerIds.has(container.id)) continue;

    const instances = instancesByGroup[container.id] ?? [];

    for (const instance of instances) {
      // (1) Prune: a zero-answer instance is dropped at submit, so it neither
      // reports errors nor counts.
      if (isEmptyInstance(instance)) continue;
      const visible = visibleItemIdsByInstance.get(instance.id);
      for (const child of container.children) {
        if (visible && !visible.has(child.id)) continue;

        // FF-2 — a matrix inside a repeating group is required PER INSTANCE, in
        // the surviving instances only. This is the per-instance loop the ADR
        // requires alongside the flat one; adding the arm to one and not the
        // other is a bug no test distinguishes from the fix.
        if (isMatrixItem(child.itemType)) {
          const matrixError = checkMatrix(child, instance);
          if (matrixError) errors[`${instance.id}:${child.id}`] = matrixError;
          continue;
        }
        if (!isInputItem(child.itemType)) continue;

        const record = instance.answers[child.id];
        const answered = hasAnswer(record);
        const key = `${instance.id}:${child.id}`;
        if (child.required && !answered) {
          errors[key] = "Esta pergunta é obrigatória.";
          continue;
        }
        if (answered) {
          const boundsError = checkBounds(child, record?.value);
          if (boundsError) errors[key] = boundsError;
        }
      }
    }

    // (2) Cardinality, evaluated on what SURVIVES the prune.
    const shortfall = describeInstanceShortfall(container, instances);
    if (shortfall) errors[container.id] = shortfall;
  }

  return errors;
}

/** Whether a section currently has no validation errors (visible items only). */
export function isSectionComplete(
  section: Section,
  scope: ScopeState,
  visibleItemIds?: Set<string>,
): boolean {
  return (
    Object.keys(validateSection(section, scope, visibleItemIds)).length === 0
  );
}

// ---------------------------------------------------------------------------
// FF-3 (ADR 0090) — authored validation rules + `required_if`
// ---------------------------------------------------------------------------

/**
 * FF-3 feedback for one scope, split by SEVERITY.
 *
 * `errors` block progression and submit; `warnings` never block, anywhere. Both
 * are keyed the way the wizard already keys its error maps — bare `itemId` at top
 * level, `${instanceId}:${itemId}` inside a repeating group — so they drop
 * straight into the existing per-field plumbing.
 */
export interface RuleFeedback {
  errors: Record<string, string>;
  warnings: Record<string, string>;
  /**
   * FF-3 (ADR 0090 ruling 4) — the fields that are required RIGHT NOW, keyed the
   * same way as the maps above. Includes plain `required` as well as a
   * `required_if` that currently holds, so a consumer needs one lookup rather
   * than an `||`.
   *
   * It rides along here because this walk already resolves effective
   * required-ness to decide whether to report a missing answer; recomputing it in
   * the render tree would be a second implementation of the same question, free
   * to disagree with the one that blocks submit.
   */
  requiredNow: Set<string>;
}

/** The shared no-feedback value — a stable reference, so a memo that falls back
 *  to it does not invalidate its consumers on every render. */
export const EMPTY_FEEDBACK: RuleFeedback = {
  errors: {},
  warnings: {},
  requiredNow: new Set(),
};

/**
 * Why this is a SEPARATE pass rather than more arms inside
 * {@link validateSection} / {@link validateInstances}:
 *
 *  - it needs the ANSWER MAP in scope (`question_key → value`), which the older
 *    validators never took — `required_if` and `datetime_order` are both
 *    expressed against question keys, not item ids;
 *  - it produces two severities, where the originals produce one string per field.
 *
 * Adding an optional map parameter to the originals was the alternative and it
 * fails OPEN: a caller that forgot to pass it would silently stop enforcing
 * `required_if` while still looking like it validated. Two explicit passes that
 * the caller merges cannot do that.
 *
 * This is UX. `submit_response` (HC0P9) is the authority, and it evaluates the
 * SAME rules through `app.eval_validation`, the SQL twin of `evalValidation`.
 */
export function validateSectionRules(
  section: Section,
  scope: ScopeState,
  answerMap: AnswerMap,
  visibleItemIds?: Set<string>,
): RuleFeedback {
  const feedback: RuleFeedback = {
    errors: {},
    warnings: {},
    requiredNow: new Set(),
  };

  // Same flattening as validateSection: a plain `group`'s children answer at top
  // level, so they validate here; a `repeating_group`'s children are per-instance.
  const flat = section.items.flatMap((item) =>
    item.itemType === "group" ? item.children : [item],
  );

  for (const item of flat) {
    // Visibility wins, unconditionally — a hidden item is never required and its
    // rules never fire (ADR 0090 ruling 4). The caller owns this filter on both
    // sides of the mirror, which is what keeps "visibility wins" structural.
    if (visibleItemIds && !visibleItemIds.has(item.id)) continue;
    // `isAnswerableItem`, NOT `isInputItem`: the latter is deliberately false for
    // `matrix`/`risk_matrix` because their answer is not a scalar in
    // `answers.value` — but the CHECK `form_items_input_vs_display` permits
    // `required_if` on both of them, and `app.response_required_complete` calls
    // `app.item_is_required` with no `item_type` filter. Gating this walk on
    // `isInputItem` therefore skipped the two types outright: a matrix made
    // mandatory only through `required_if` genuinely blocks submit server-side
    // while this pass reported nothing and never marked it.
    if (!isAnswerableItem(item.itemType)) continue;

    applyToField(feedback, item, item.id, answerMap, itemAnswered(item, scope));
  }

  return feedback;
}

/**
 * The per-INSTANCE half. Rules are evaluated once per NON-EMPTY instance against
 * that instance's overlaid map, so a violation in repetition 2 is reported on
 * repetition 2 and leaves repetition 1 alone.
 *
 * `baseAnswerMap` is the response's top-level map; each instance's own answers
 * are overlaid on it (FF-1's two-tier resolution, instance wins), which is what
 * makes a `datetime_order` rule compare against the SAME-instance sibling with
 * no instance-specific code in the evaluator.
 */
export function validateInstanceRules(
  section: Section,
  instancesByGroup: Record<string, InstanceState[]>,
  baseAnswerMap: AnswerMap,
  visibleItemIdsByInstance: Map<string, Set<string>>,
  visibleContainerIds?: Set<string>,
): RuleFeedback {
  const feedback: RuleFeedback = {
    errors: {},
    warnings: {},
    requiredNow: new Set(),
  };

  for (const container of section.items) {
    if (container.itemType !== "repeating_group") continue;
    if (visibleContainerIds && !visibleContainerIds.has(container.id)) continue;

    const instances = instancesByGroup[container.id] ?? [];
    // Prune FIRST, exactly as the server does: a wholly blank repetition is not
    // there, so it reports nothing AND contributes no `unique_within_group` peer.
    const surviving = instances.filter((i) => !isEmptyInstance(i));

    for (const instance of surviving) {
      const scopeMap = overlayAnswerMap(
        baseAnswerMap,
        instanceAnswerMap(instance),
      );
      const visible = visibleItemIdsByInstance.get(instance.id);

      for (const child of container.children) {
        if (visible && !visible.has(child.id)) continue;
        if (!isAnswerableItem(child.itemType)) continue;

        applyToField(
          feedback,
          child,
          `${instance.id}:${child.id}`,
          scopeMap,
          // `InstanceState` satisfies `ScopeState`, so a matrix inside a
          // repetition resolves against THAT repetition's grid.
          itemAnswered(child, instance),
          peerValuesFor(child, instance, surviving),
        );
      }
    }
  }

  return feedback;
}

/**
 * Is this item's answer PRESENT, in the sense its own type means?
 *
 * A scalar answers in `answers.value`; a `matrix` answers in
 * `answer_matrix_cells` and a `risk_matrix` in its severity/likelihood pair, so
 * `hasAnswer` is structurally blind to both. Presence for the matrix types is the
 * same ROW-COMPLETE / both-halves-chosen reading `app.item_required_satisfied`
 * uses, which is what {@link checkMatrix} already applies for static `required` —
 * shared here so `required_if` cannot end up with a second, disagreeing notion of
 * "answered".
 */
function itemAnswered(item: Item, scope: ScopeState): boolean {
  if (isMatrixItem(item.itemType)) {
    const rows = item.matrixRows ?? [];
    const columns = item.matrixColumns ?? [];
    return item.itemType === "risk_matrix"
      ? isRiskComplete(rows, columns, scope.riskMatrix?.[item.id])
      : isMatrixComplete(rows, columns, scope.matrixCells?.[item.id]);
  }
  return hasAnswer(scope.answers[item.id]);
}

/**
 * The same child's value in every OTHER surviving instance — the only input
 * `unique_within_group` needs, which is what lets the evaluator stay pure.
 *
 * Read from each peer's own instance map rather than the overlay: a peer that
 * left this child blank must contribute NOTHING, not the top-level fallback,
 * or two blank rows would collide against an unrelated top-level answer.
 */
function peerValuesFor(
  child: Item,
  instance: InstanceState,
  surviving: InstanceState[],
): Json[] {
  if (!child.questionKey) return [];
  const key = child.questionKey;
  return surviving
    .filter((other) => other.id !== instance.id)
    .map((other) => instanceAnswerMap(other)[key])
    .filter((value): value is Json => value !== undefined);
}

/**
 * Evaluate `required_if` and the authored rules for one field, writing into
 * `feedback` under `key`.
 *
 * Only the FIRST failing rule of each severity is recorded: a field shows one
 * error and one warning at a time, in the author's own `position` order, because
 * a stack of simultaneous complaints on one input is noise rather than guidance.
 */
function applyToField(
  feedback: RuleFeedback,
  item: Item,
  key: string,
  answers: AnswerMap,
  answered: boolean,
  peerValues?: Json[],
): void {
  // Effective required-ness, resolved ONCE and reused for both the marker and the
  // missing-answer report — the two cannot drift apart if they read one value.
  const requiredNow = itemIsRequired(item.required, item.requiredIf, answers);
  if (requiredNow) feedback.requiredNow.add(key);

  // The missing-answer REPORT is `required_if`-only: plain `required` is
  // {@link validateSection}'s job, and reporting it twice would put the same
  // message in two passes. The marker above is not so restricted — a statically
  // required field must still be marked.
  if (!item.required && item.requiredIf && requiredNow && !answered) {
    feedback.errors[key] = "Esta pergunta é obrigatória.";
    return;
  }

  // Coverage v1 gives the matrix types NO rules (ADR 0090 ruling 2), so this loop
  // is a no-op for them — but gate it explicitly rather than relying on an empty
  // array, because `answers[questionKey]` is not where a matrix keeps its answer
  // and a future rule type would silently evaluate against `undefined`.
  const rules = isInputItem(item.itemType) ? (item.validations ?? []) : [];
  if (rules.length === 0 || !item.questionKey) return;
  const value = answers[item.questionKey];

  for (const rule of rules) {
    const target = rule.severity === "error" ? feedback.errors : feedback.warnings;
    if (target[key] !== undefined) continue;
    // `ruleType` and `config` come from a row the database validated per type,
    // so the pairing is sound; TS cannot correlate the two fields across the
    // discriminated union on its own.
    const spec = {
      ruleType: rule.ruleType,
      config: rule.config,
    } as ValidationRuleSpec;
    if (!evalValidation(spec, value, { answers, peerValues })) {
      target[key] = rule.message;
    }
  }
}

/**
 * BUG-FF3-001 — drop the sticky per-instance errors for one child across EVERY
 * repetition, returning a new map (or the same reference when nothing changed).
 *
 * `unique_within_group` is the only rule whose violation is SYMMETRIC: two peers
 * collide and a blocked navigation records a message on BOTH. Clearing keyed to
 * the edited field alone strands the peer, so a repetition the user never touched
 * keeps a message and `aria-invalid="true"` for a field that no longer violates
 * anything — a valid input announced as invalid, which is the same misinformation
 * that keeps `warn` off the error channel.
 *
 * The rule's participant set is "this child in every instance of its group", and
 * an item has exactly ONE parent, so every key ending in `:${itemId}` IS that set.
 * Keying on the participants rather than the edited field is what makes the
 * clearing symmetric: editing repetition 1 clears repetition 2's stale copy
 * exactly as the reverse does.
 */
export function clearPeerFieldErrors(
  errors: Record<string, string>,
  itemId: string,
): Record<string, string> {
  const suffix = `:${itemId}`;
  const stale = Object.keys(errors).filter((key) => key.endsWith(suffix));
  if (stale.length === 0) return errors;
  const next = { ...errors };
  for (const key of stale) delete next[key];
  return next;
}

/**
 * Min/max bounds check for a number/date answer against the item's `config`
 * (mirror of the submit RPC's HC061 rule). Number bounds are JSON numbers; date
 * bounds are ISO `YYYY-MM-DD` strings that compare lexicographically. Returns a
 * pt-BR message or `null` when within bounds / not applicable.
 */
function checkBounds(item: Item, value: unknown): string | null {
  const config = item.config;
  if (!config) return null;

  if (item.itemType === "number" && typeof value === "number") {
    const { min, max } = config;
    if (typeof min === "number" && value < min) {
      return `O valor deve ser no mínimo ${formatNumber(min)}.`;
    }
    if (typeof max === "number" && value > max) {
      return `O valor deve ser no máximo ${formatNumber(max)}.`;
    }
  }

  if (item.itemType === "date" && typeof value === "string" && value !== "") {
    const { min, max } = config;
    if (typeof min === "string" && value < min) {
      return `A data deve ser a partir de ${formatDate(min)}.`;
    }
    if (typeof max === "string" && value > max) {
      return `A data deve ser até ${formatDate(max)}.`;
    }
  }

  return null;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

/** Format an ISO `YYYY-MM-DD` as a pt-BR date (no timezone shift). */
function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
