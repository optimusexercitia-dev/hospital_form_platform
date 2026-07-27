/**
 * Pure parser for a form item's `required` flag, from the builder dialog's
 * checkbox field.
 *
 * WHY THIS IS ITS OWN MODULE, for one boolean: it is the anti-regression seam
 * for BUG-FF1-002. `parseItemFields` lives in a `'use server'` module, so its
 * behaviour was only ever exercised through the database — and a field the
 * parser silently discarded looked identical, from the UI, to one it saved. That
 * is precisely the rationale `parse-config.ts` records for its own extraction
 * ("a missing field-read here could go undetected; see the flaggedWhen gap"),
 * and it has now cost the phase twice.
 *
 * FF-1 (ADR 0087 ruling 4): `required` is persisted AS SUBMITTED, including
 * alongside a `visible_when` condition. The prior implementation cleared it
 * whenever a condition was present, defending the
 * `form_items_conditional_not_required` CHECK — which **BE-1 dropped
 * platform-wide**. The defence outlived the constraint, so the builder offered
 * "obrigatória" beside a condition (FE-4) while the value was thrown away on
 * save, for top-level items and repeating-group children alike.
 *
 * The combination is safe because `app.response_required_complete` already
 * carries the branch that resolves it — visibility wins: a required item hidden
 * by its own condition does not block submit. That branch was unreachable dead
 * code only because the CHECK made the combination unconstructible.
 */

/**
 * Whether the item form submitted `required`. An HTML checkbox posts its `value`
 * ("on") only when checked and is absent otherwise, so presence IS the flag —
 * and, deliberately, NOTHING else is consulted: not `visible_when`, not the item
 * type. Any coupling here is the bug this module exists to prevent.
 */
export function parseRequired(formData: FormData): boolean {
  return String(formData.get('required') ?? '') === 'on'
}
