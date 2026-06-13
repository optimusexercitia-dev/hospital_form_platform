import type { Section } from "@/lib/queries/forms";

import type { AnswerState } from "./types";
import { hasAnswer, isInputItem } from "./use-wizard";

/**
 * Per-section client-side validation (F2). This is UX ONLY: it gives immediate
 * feedback before "Próximo"/"Revisar", but `submit_response` on the server is
 * the authority (ARCHITECTURE Rule 3 / PHASES Phase 5). It mirrors the server's
 * "every required input in a visible section is answered" check so the two
 * rarely disagree, but the server always has the final word.
 *
 * Returns a map of `item_id → pt-BR error message` for required inputs left
 * blank. Empty map = the section passes.
 */
export function validateSection(
  section: Section,
  answers: AnswerState,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const item of section.items) {
    if (!isInputItem(item.itemType)) continue;
    if (!item.required) continue;
    if (!hasAnswer(answers[item.id])) {
      errors[item.id] = "Esta pergunta é obrigatória.";
    }
  }
  return errors;
}

/** Whether a section currently has no required-but-blank inputs. */
export function isSectionComplete(
  section: Section,
  answers: AnswerState,
): boolean {
  return Object.keys(validateSection(section, answers)).length === 0;
}
