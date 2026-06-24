import type { Json } from "@/lib/types/database";
import type { Item, Section, VersionTree } from "@/lib/queries/forms";
import type { AnswerMap, ResultRuleset } from "@/lib/queries/conditions";
import type { ResolvedPhaseResult } from "@/lib/queries/phase-results";
import type { SectionSignoff } from "@/components/signoffs/types";

/**
 * Local, thin interface the wizard is built against so the non-data-bound
 * engine (F2/F3/F5 scaffold) compiles and runs ahead of backend's B2/B3
 * data-access landing. When B2 (`getResponseForFill`) / B3 (`saveSection`,
 * `submitResponse`, `saveAndExit`) land, this is bound to those exports — the
 * shapes here are intentionally aligned with the existing `VersionTree`/`Item`
 * domain types (`src/lib/queries/forms.ts`) and `AnswerMap`
 * (`src/lib/queries/conditions.ts`) so the wiring is a pass-through, not a
 * rewrite. The wizard NEVER touches supabase-js (Rule 9) nor `src/lib/**`.
 */

/**
 * One saved/in-flight answer, carrying BOTH identifiers.
 *
 * Per the lead's F2/F4 steer:
 *  - `evalCondition` reads an `AnswerMap` keyed by `question_key`, but backend's
 *    `saveSection` takes answers keyed by `item_id` (`answers` rows are
 *    per-item). Carrying both means saving sends `{ itemId: value }` with no
 *    lossy reverse-lookup, and a duplicate `question_key` across items can't
 *    bite the navigation engine.
 */
export interface AnswerRecord {
  itemId: string;
  questionKey: string;
  value: Json;
  /**
   * Optional per-item observation note (form-builder-enhancements, decision
   * #11). Stored on the answer row (`answers.observation`); persisted via
   * `saveSection`'s `observationsByItemId`. The evaluator/answer_map read only
   * `value`, so observations never affect conditions.
   */
  observation?: string;
}

/** The wizard's answer state: per-item answer records keyed by item id. */
export type AnswerState = Record<string, AnswerRecord>;

/**
 * Everything the wizard client needs to render + drive navigation for one
 * in_progress response. Resolved server-side by the route page (from B2's
 * `getResponseForFill`) and passed to `<WizardClient>`.
 */
export interface WizardData {
  /** Route identifiers — used by F4 save calls and F5 submit. */
  slug: string;
  formId: string;
  responseId: string;
  /** Display metadata for the wizard header. */
  formTitle: string;
  /**
   * The respondent's display name (the current user). Used to render the
   * optimistic "Assinado por você em DATA" badge after a respondent sign-off
   * (F3) without a round-trip.
   */
  respondentName: string;
  /** The version-faithful section/item tree (immutable for this response). */
  tree: VersionTree;
  /** Saved answers, already mapped to per-item records (B2 returns these). */
  initialAnswers: AnswerState;
  /** Where the user left off — the wizard opens on this section if resumable. */
  lastSectionId: string | null;
  /**
   * Existing sign-off rows for this response, keyed by `section_id` (F3). B2
   * extends `getResponseForFill` to surface these so the review screen can show
   * each visible sign-off section's status and gate submission. Empty for a
   * response with no signed sections (or no sign-off sections at all).
   */
  signoffsBySectionId: Record<string, SectionSignoff>;
  /**
   * Per-phase RESULT context (phase-results feature), present ONLY on the
   * case-phase responder page and left `undefined` for standalone fills. Drives
   * the end-of-wizard override panel: `ruleset` powers the live computed preview
   * (client-side `walkResultRuleset` over the wizard's current answer map),
   * `options` are the active result options for the override picker, and
   * `currentOverrideId` is the override stashed on the still-`ativa` phase. When
   * an override is chosen/cleared, the wizard routes submit through
   * `submitCasePhaseResponse` (vs plain `submitResponse`).
   */
  phaseResult?: {
    casePhaseId: string;
    /**
     * Result MODE (phase-result-manual-mode). `automatic` = the ruleset computes
     * the result and the override is OPTIONAL; `manual` = the filler MUST pick a
     * result from `options` (the author-selected subset) before submit.
     */
    mode: "automatic" | "manual";
    ruleset: ResultRuleset | null;
    options: ResolvedPhaseResult[];
    currentOverrideId: string | null;
  };
}

export type { Item, Section, VersionTree, AnswerMap };
