/**
 * The frontend MIRROR of the triage decision logic (Phase 14b). PURE +
 * client-safe: it reads only the FROZEN ordered metadata exported by the
 * import-free `@/lib/safety/triage-types` (`REACH_META` / `HARM_META`), so the
 * UI's live preview cannot drift from the predicates the SQL
 * `app.compute_sentinel_determination` evaluates.
 *
 * **The SQL is the authority.** This mirror drives ONLY the live, in-between-saves
 * UX (the disposition rail + queue badges while the analyst is still choosing):
 *  - the server `saveTriage` re-normalizes and recomputes `sentinelDetermination`,
 *  - the server `getTriageDisposition` RPC is the authoritative verdict the rail
 *    renders after each save/refresh.
 * We re-read the normalized worksheet after every save, so any divergence here is
 * corrected on the next round-trip — but the predicates are kept identical on
 * purpose (README_triage §6).
 */

import {
  HARM_META,
  REACH_META,
  type HarmSeverity,
  type PseClosureReason,
  type ReviewPathway,
  type TriageReach,
  type TriageVerdict,
} from "@/lib/safety/triage-types";

/**
 * The client-side draft the workstation edits — the raw selections the analyst
 * makes, shaped exactly like {@link import('@/lib/safety/triage-types').SaveTriageInput}
 * (plus nothing extra). The server applies the authoritative cross-field rules; the
 * helpers below preview them so the UI updates instantly.
 */
export interface TriageDraft {
  isPse: boolean | null;
  pseClosureReason: PseClosureReason | null;
  reach: TriageReach | null;
  harmSeverity: HarmSeverity | null;
  naturalCourse: boolean | null;
  reviewPathway: ReviewPathway | null;
  dispositionNotesMd: string | null;
  /** Full set of flagged designated-category criterion ids (replace semantics). */
  sentinelCriteriaIds: string[];
}

/** The triage stage that drives the queue badge + filter grouping. */
export type TriageStage = "untriaged" | "in" | "triaged";

/** Did the chosen reach reach the patient? (`REACH_META[reach].reached`.) */
export function isReached(reach: TriageReach | null): boolean {
  return reach != null && REACH_META[reach].reached;
}

/** Is the chosen reach a harmful one? (`unsafe`/`near_miss`/`no_harm` are not.) */
export function isHarmful(reach: TriageReach | null): boolean {
  return reach != null && REACH_META[reach].harmful;
}

/** Is the chosen harm in the sentinel tier? (`severe`/`permanent`/`death`.) */
export function isSevere(harm: HarmSeverity | null): boolean {
  return harm != null && HARM_META[harm].severe;
}

/**
 * Sentinel determination (README_triage §6, identical to the SQL): the
 * general-criteria path (reached + severe + explicitly NOT natural course) OR any
 * designated-category flag.
 */
export function isSentinel(draft: TriageDraft): boolean {
  const generalPath =
    isReached(draft.reach) &&
    isSevere(draft.harmSeverity) &&
    draft.naturalCourse === false;
  return generalPath || draft.sentinelCriteriaIds.length > 0;
}

/**
 * The derived verdict for the live disposition rail (mirror of the
 * `triage_disposition` RPC). `closed` for a non-PSE; `rca` when sentinel; `review`
 * once a reach is chosen for a non-sentinel PSE; `pending` otherwise.
 */
export function deriveVerdict(draft: TriageDraft): TriageVerdict {
  if (draft.isPse === false) return "closed";
  if (draft.isPse == null) return "pending";
  if (isSentinel(draft)) return "rca";
  if (draft.reach != null) return "review";
  return "pending";
}

/**
 * Whether the worksheet is complete enough to read as "triaged" (README_triage
 * §4): a reach is chosen, harm is set when the reach is harmful, and the
 * natural-course / designated question is resolved when the case reached + severe.
 */
function isComplete(draft: TriageDraft): boolean {
  if (draft.reach == null) return false;
  if (isHarmful(draft.reach) && draft.harmSeverity == null) return false;
  if (
    isReached(draft.reach) &&
    isSevere(draft.harmSeverity) &&
    draft.naturalCourse == null &&
    draft.sentinelCriteriaIds.length === 0
  ) {
    return false;
  }
  return true;
}

/**
 * The triage stage (README_triage §4): `untriaged` until the PSE gate is answered;
 * `triaged` once it is closed as not-a-PSE OR the worksheet is complete; `in`
 * (in triage) while partially filled.
 */
export function triageStage(draft: TriageDraft): TriageStage {
  if (draft.isPse == null) return "untriaged";
  if (draft.isPse === false) return "triaged";
  return isComplete(draft) ? "triaged" : "in";
}

/**
 * Apply the client-side preview of the server's cross-field rules when the reach
 * changes (the server is authoritative; this keeps the UI honest between saves):
 *  - a non-harmful reach forces harm to `none` and clears `naturalCourse`;
 *  - a `sentinel` reach floors harm to `severe` when it is below the sentinel tier.
 * Returns a NEW draft (never mutates).
 */
export function applyReachChange(
  draft: TriageDraft,
  reach: TriageReach | null,
): TriageDraft {
  const next: TriageDraft = { ...draft, reach };
  if (reach == null) return next;

  if (!REACH_META[reach].harmful) {
    next.harmSeverity = "none";
    next.naturalCourse = null;
    return next;
  }
  if (reach === "sentinel" && !isSevere(next.harmSeverity)) {
    next.harmSeverity = "severe";
  }
  return next;
}

/**
 * Whether the review pathway is FORCED to `rca` (sentinel ⇒ RCA mandatory,
 * non-overridable — matches the backend HC046 guard). The pathway selector is
 * disabled and pinned to `rca` when this is true.
 */
export function pathwayForcedToRca(draft: TriageDraft): boolean {
  return isSentinel(draft);
}
