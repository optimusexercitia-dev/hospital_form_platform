import type { Item, Section } from "@/lib/queries/forms";

import type { AnswerState } from "./types";
import { hasAnswer, isInputItem } from "./use-wizard";

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
  answers: AnswerState,
  visibleItemIds?: Set<string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const item of section.items) {
    if (!isInputItem(item.itemType)) continue;
    // Skip items hidden by an item-level condition.
    if (visibleItemIds && !visibleItemIds.has(item.id)) continue;

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

/** Whether a section currently has no validation errors (visible items only). */
export function isSectionComplete(
  section: Section,
  answers: AnswerState,
  visibleItemIds?: Set<string>,
): boolean {
  return (
    Object.keys(validateSection(section, answers, visibleItemIds)).length === 0
  );
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
