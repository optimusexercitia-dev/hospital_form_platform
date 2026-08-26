/**
 * pt-BR naming for one blocker row, shared by every surface that renders a refusal's
 * blocker list (`AffiliationsPanel`, `OrgOffboardingWizard`).
 *
 * ⛔ WHY THIS IS ONE MODULE AND NOT TWO INLINE EXPRESSIONS. The two render sites carried
 * the SAME expression, copied — `roleLabel(b.role)` plus a commission-or-"cargo do
 * hospital" suffix — and both were wrong in the same way for the same reason (AFF4 B2).
 * A blocker of `kind: 'hospital_affiliation'` has NO role, so both sites rendered an empty
 * label followed by a bare " — cargo do hospital": nameless, and labelled as a role it does
 * not have. It is the most common blocker kind. Two copies of a labelling rule is two
 * places for it to be wrong; a fix applied to one of them is worse than either.
 *
 * ⛔ THE INPUT SHAPE IS THE DOOR'S, and it is imported, never restated. `AffiliationBlocker`
 * comes from `@/lib/affiliations/actions` (backend's, re-exported from
 * `@/lib/affiliations/blockers`) precisely so that a change to what the doors emit reaches
 * this file as a TYPE ERROR rather than as a silently-unrendered field — which is the
 * failure this module exists to repair.
 *
 * ⚠ `kind` IS PRESENT ON EXACTLY ONE OF THE THREE PRODUCING DOORS, and every branch below
 * is shaped by that. Per `AffiliationBlocker`'s catalog-derived enumeration:
 *
 *     HC0R1 `end_affiliation`      → {role, commission}            — no kind, no hospital
 *     HC0R6 `end_org_affiliation`  → {kind, role, hospital, commission}
 *     HC0R9 `void_affiliation`     → {role, commission}            — no kind, no hospital
 *     HC0R9 `void_org_affiliation` → {role, commission}            — no kind, no hospital
 *
 * So a naive `switch (kind)` would REGRESS the two doors that render correctly today in
 * order to fix the one that does not: their blockers arrive with `kind: null` and are all
 * memberships, which the role path already names correctly. `kind: null` therefore falls
 * through to the role path deliberately — it is the majority case, not an error case.
 */

import type { AffiliationBlocker } from '@/lib/affiliations/actions'

/**
 * pt-BR labels for the seats the affiliation doors report as blockers (ADR 0097 D5 —
 * ending is refused while the person holds active memberships of ANY tier under the
 * hospital).
 *
 * ⚠ THE AUTHORITY FOR THIS SET IS `memberships_role_check`, not this file. The blocker
 * `role` arrives from PostgreSQL as the raw enum text, so a role added to that CHECK
 * without a label here leaks an English snake_case identifier into a pt-BR `role="alert"`
 * — the exact shape of the defect QA caught on the hospital-tier arm. Pinned executably by
 * `affiliations-panel.test.ts` against the committed role fixture, because a comment
 * asserting completeness goes stale in silence.
 *
 * The `?? role` fallback in {@link roleLabel} is therefore unreachable today and is kept
 * only as a fail-soft: a blocker the admin cannot name is worse than one that is
 * untranslated.
 */
export const ROLE_LABELS: Record<string, string> = {
  staff: 'Membro',
  staff_admin: 'Coordenação',
  hospital_admin: 'Administração do hospital',
  org_admin: 'Administração da organização',
  technical_director: 'Direção técnica',
  technical_director_deputy: 'Direção técnica (substituto)',
  nsp_coordinator: 'Coordenação do NSP',
  nsp_org_admin: 'Administração do NSP',
  pqs_member: 'Membro do PQS',
  quality_reviewer: 'Revisão da qualidade',
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}

/**
 * What the blocker IS — the noun the admin has to act on.
 *
 * ⚠ THE VOCABULARY IS REUSED, NOT INVENTED. "Vínculo hospitalar" is what
 * `OrgOffboardingWizard`'s own footprint list (`tieLabel`) and the panel's success message
 * already call this row; "Vínculo organizacional" is `MESSAGES.orgUpdated`'s wording; and
 * "Função" is `tieLabel`'s fallback for a membership with no role. This build has already
 * had one near-miss from inventing a synonym (a plan wrote "Desligado" where the shared
 * badge renders "Encerrado"), and the cost of a synonym is that the admin cannot tell
 * whether two screens are describing one thing or two.
 */
function blockerNoun(b: AffiliationBlocker): string {
  if (b.kind === 'org_affiliation') return 'Vínculo organizacional'
  if (isEmploymentTie(b)) return 'Vínculo hospitalar'
  // `kind: 'membership'` AND `kind: null` (HC0R1 / HC0R9, where every blocker is a seat).
  return b.role ? roleLabel(b.role) : 'Função'
}

/**
 * Is this row an EMPLOYMENT, rather than a post someone holds?
 *
 * ⛔ THE SECOND CLAUSE EXISTS BECAUSE `kind` IS NOT THE ONLY WAY TO ARRIVE HERE. HC0RA
 * (`void_org_affiliation`, refused because hospital ties remain) emits `[{hospital}]` —
 * no `kind`, no `role`, no `commission`, just a name. Dispatching on `kind` alone would
 * send it down the role path and render "Função — cargo no Hospital Central": a nameless
 * role at a hospital, which is the SAME defect this module exists to fix, reached from a
 * different arm. It is worth catching structurally rather than by adding a `kind` the door
 * does not emit.
 *
 * ⚠ THE INFERENCE IS SOUND, and rests on a schema fact rather than on convention:
 * `memberships.role` is NOT NULL and every door selects it directly, so a membership
 * blocker ALWAYS carries a role. "No role and no commission, but a hospital" therefore
 * cannot be a seat — there is no such membership to describe.
 */
function isEmploymentTie(b: AffiliationBlocker): boolean {
  if (b.kind === 'hospital_affiliation') return true
  return !b.role && !b.commission && !!b.hospital
}

/**
 * WHERE it is held — so the admin knows which page to go to in order to clear it.
 *
 * ⚠ The bare `"cargo do hospital"` is kept for the case that produces it: HC0R1 and HC0R9
 * emit no hospital name, and a hospital-tier seat has no committee to name, so saying so
 * is what tells the admin to look OUTSIDE the committee pages. It is a fallback, not the
 * default — when the door does name the hospital, naming it beats a generic phrase. This
 * ordering is what keeps the two `kind`-less doors rendering byte-identically to before.
 */
function blockerScope(b: AffiliationBlocker): string | null {
  if (b.commission) return b.commission
  if (b.kind === 'org_affiliation' || isEmploymentTie(b)) {
    // The row IS the affiliation; "cargo do hospital" would be false here — there is no
    // post involved. With no name emitted, say nothing rather than something untrue.
    return b.hospital
  }
  if (b.hospital) return `cargo no ${b.hospital}`
  return 'cargo do hospital'
}

/** One blocker as a single pt-BR line: what it is, and where it is held. */
export function blockerLabel(b: AffiliationBlocker): string {
  const scope = blockerScope(b)
  return scope ? `${blockerNoun(b)} — ${scope}` : blockerNoun(b)
}

/**
 * A stable React `key` for a blocker row.
 *
 * ⚠ THE INDEX IS PART OF THE KEY ON PURPOSE. Two blockers can be genuinely identical in
 * every field the door emits — the same role held in two commissions that share a name, or
 * two membership rows differing only by an id the DETAIL does not carry — and a key
 * collision there drops a row the admin has to act on.
 */
export function blockerKey(b: AffiliationBlocker, index: number): string {
  return [b.kind ?? '-', b.role ?? '-', b.hospital ?? '-', b.commission ?? '-', index].join(
    '|',
  )
}
