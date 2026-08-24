import type { Json } from "@/lib/types/database";
import type { Item, Section, VersionTree } from "@/lib/queries/forms";
import type { AnswerMap, ResultRuleset } from "@/lib/queries/conditions";
import type { ResolvedPhaseResult } from "@/lib/queries/phase-results";
import type { SectionSignoff } from "@/components/signoffs/types";
import type { MatrixCellsState, RiskMatrixState } from "@/lib/forms/matrix";

import type { InstanceState } from "./instances";
import type { ReferenceState } from "./references";

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
  /**
   * Optional per-item "Outros" free text ("Outros" open option). Stored on the
   * answer row (`answers.other_text`); persisted via `saveSection`'s
   * `otherTextByItemId`, written server-side ONLY when the item's reserved
   * `__other__` option is selected. The evaluator reads only the option CODE, so
   * `otherText` never affects conditions. Blank is allowed ("Outro" selected is a
   * valid answer; the text is optional).
   */
  otherText?: string;
}

/** The wizard's answer state: per-item answer records keyed by item id. */
export type AnswerState = Record<string, AnswerRecord>;

/**
 * Everything the wizard client needs to render + drive navigation for one
 * in_progress response. Resolved server-side by the route page (from B2's
 * `getResponseForFill`) and passed to `<WizardClient>`.
 */
export interface WizardData {
  /**
   * Route identifiers — used by F4 save calls and F5 submit. `org` + `slug` (the
   * commission slug) build the multi-tenant `/o/[org]/c/[commission]` URLs.
   */
  org: string;
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
  /**
   * FF-1 (ADR 0087) — the response's saved repeating-group instances, already
   * mapped to per-instance answer records. `[]` for a form with no
   * `repeating_group`, which is every form until FF-1's builder ships one.
   *
   * A plain `group` contributes NOTHING here (ruling 6): its children answer at
   * top level and are already in {@link initialAnswers}.
   */
  initialInstances: InstanceState[];
  /**
   * FF-2 (ADR 0089) — the response's saved TOP-LEVEL matrix answers, rehydrated
   * from `getResponseForFill`. Kept OUT of {@link initialAnswers} on purpose: a
   * matrix has `answers.value` NULL by design, so putting it in the answer state
   * would put it in the derived `AnswerMap` and corrupt condition evaluation —
   * a matrix is not a condition target (`CONDITION_TARGET_TYPES` excludes both
   * types, and the SQL evaluator reads `value`, which is null for them).
   *
   * A matrix INSIDE a repeating group is not here; it lives on its
   * {@link InstanceState}, exactly as scalar answers do.
   */
  initialMatrixCells: MatrixCellsState;
  initialRiskMatrix: RiskMatrixState;
  /**
   * FF-5 (ADR 0091) — the response's saved TOP-LEVEL entity references, with
   * their labels ALREADY RESOLVED server-side by live join (ruling 4), so a
   * resumed fill renders "Maria Silva · Enfermeira" rather than a UUID or an
   * empty box waiting on a client round trip.
   *
   * Kept OUT of {@link initialAnswers} for the same reason the matrix slices are:
   * a reference has `answers.value` NULL, so it would poison the derived
   * `AnswerMap` — and ruling 5 keeps it out of condition evaluation entirely.
   *
   * A reference INSIDE a repeating group is not here; it lives on its
   * {@link InstanceState}, exactly as scalar answers and matrix grids do.
   */
  initialReferences: ReferenceState;
  /** Where the user left off — the wizard opens on this section if resumable. */
  lastSectionId: string | null;
  /**
   * FF-4 (ADR 0092 ruling 5) — the context a DYNAMIC default
   * (`item.defaultSource`) resolves against. Everything here is already
   * loaded by the route page for other purposes (the respondent's name for
   * the sign-off badge, the commission for the header) — no new read path,
   * no new join, no PHI (the ADR's own stated property).
   *
   * `startedAt` is the response's own `responses.started_at` — what "draft-
   * start date/time" (the `today`/`now` tokens) resolves against, per the
   * ADR's table. Reading it from the response rather than `Date.now()` at
   * wizard mount is deliberate: a value frozen at `startedAt` can never
   * drift if the same in_progress response is resumed days later, which a
   * live clock read at every mount would.
   *
   * REQUIRED (not optional-with-a-default): an omitted field here is exactly
   * the class of bug BUG-FF5-002 was (a type-system opt-out that blanked a
   * durable value silently) — every `WizardData` constructor, including
   * every test fixture, must state this context explicitly.
   */
  dynamicDefaultContext: {
    startedAt: string;
    userName: string;
    userEmail: string;
    commissionName: string;
  };
  /**
   * Existing sign-off rows for this response, keyed by `section_id` (F3). B2
   * extends `getResponseForFill` to surface these so the review screen can show
   * each visible sign-off section's status and gate submission. Empty for a
   * response with no signed sections (or no sign-off sections at all).
   */
  signoffsBySectionId: Record<string, SectionSignoff>;
  /**
   * ADR 0136 — the `staff_admin` sign-off is DEFERRED past this submit: the
   * response freezes, the case phase parks in `awaiting_signoff`, and a
   * coordinator countersigns from the sign-off queue.
   *
   * ⛔ REQUIRED, not optional, and it is the reason the feature is reachable at
   * all. `submit_response` stopped blocking on the DB side (D1/D2) — but the
   * wizard has its OWN submit gate, and with that gate untouched the button stays
   * `disabled` with "Há seções pendentes de assinatura", so the filler is stuck on
   * exactly the screen the ADR exists to release. Caught by
   * `e2e/deferred-staff-signoff.spec.ts`, which pgTAP structurally cannot see:
   * the SQL is truth about the SQL and evidence about nothing downstream.
   *
   * True ONLY for a case-phase response with the flag on — the server resolves
   * both, so the client never guesses.
   */
  deferStaffSignoff: boolean;
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
  /**
   * Case Correction Lifecycle context (ADR 0085), present ONLY when this draft is a
   * CORRECTION of a completed phase — a `responses` row with `supersedes_id != null`,
   * opened via "Continuar correção". Mutually exclusive with `phaseResult` (the
   * result-override panel is HIDDEN in correction mode — the recompute is owned by
   * `approve_correction`, never by a per-fill override). When present, the wizard
   * submits via `resubmitCorrection(requestId)` (sends the draft for review) instead
   * of concluding the phase, and shows correction-aware copy.
   */
  correction?: {
    /** The open correction request this draft belongs to — RESUBMITTED on submit. */
    requestId: string;
    /** Where the corrector returns after sending for review (a route they can reach). */
    doneHref: string;
  };
}

export type { Item, Section, VersionTree, AnswerMap };
export type { InstanceState } from "./instances";
