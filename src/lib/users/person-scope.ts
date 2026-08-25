/**
 * ADR 0133 D1–D4, as amended by Amendment 1 ruling 1 — the affiliation-scoped person
 * authority rule, expressed as a PURE predicate.
 *
 * ⚠ WHY THIS IS A SEPARATE, I/O-FREE MODULE. The rule it encodes is the only thing
 * standing between a hospital_admin and another hospital's people, and it runs on the
 * SERVICE-ROLE path where there is no RLS backstop (D4). A predicate that can only be
 * exercised by mocking a Supabase client is a predicate whose corner cases never get
 * tested — so the resolution (which needs the admin client) lives in `actions.ts` and the
 * DECISION lives here, where a keystone can drive it directly with a literal footprint.
 *
 * ⛔ A SQL TWIN IS DELIBERATELY NOT BUILT (ADR 0133 D4, and its Alternatives table). No RLS
 * policy consumes this rule — every affected path is service-role — and a dead DB
 * predicate is a standing census/sweep liability forever. Do not "mirror it for
 * consistency": the mirroring obligation in Architecture Rule 3 attaches to predicates
 * that genuinely exist on both sides, and this one must not.
 *
 * ⚠ THE FOUR CAPABILITIES DO NOT SHARE ONE BOUND. Amendment 1 ruling 1 split them, and
 * collapsing them back into a single "may this admin manage this person?" boolean is the
 * specific regression this module exists to prevent:
 *
 *   fields · credentials  → INTERSECTION.  Authority at ANY hospital the person serves.
 *   cpf_change · lifecycle → SUBSET.       Authority only over a SOLE-footprint person.
 *
 * The asymmetry is not a compromise, it is the decision. A name fix or a credential
 * update is a LOCAL correction and the local-knowledge argument holds at every hospital
 * the person serves — which is also why it matches the read boundary D13 draws. A CPF
 * rewrite is a person-key identity event other hospitals depend on, and deactivation is
 * cross-hospital denial of access (`app.is_active` is folded into every membership
 * predicate, making it a PLATFORM-WIDE kill switch). Neither is a local fix, so both stay
 * with the org_admin unless the caller administers the person's ENTIRE footprint.
 */

/**
 * The four authority classes of ADR 0133 D3. Deliberately an explicit union rather than a
 * boolean pair: the call sites read `'lifecycle'`, not `subset: true`, so a reviewer sees
 * WHICH rule is being invoked rather than having to recover it from a flag.
 */
export type PersonScopeCapability =
  | 'fields'
  | 'credentials'
  | 'cpf_change'
  | 'lifecycle'

/** Capabilities bounded by INTERSECTION (Amdt 1 ruling 1). The rest are SUBSET. */
const INTERSECTION_CAPABILITIES: ReadonlySet<PersonScopeCapability> = new Set([
  'fields',
  'credentials',
])

/**
 * The target person's footprint, already resolved against the database by the caller.
 *
 * Kept as plain data so the decision is testable without a client. The resolution rules
 * (which rows count, and how the tier is derived) are documented on each field because
 * getting either wrong reproduces a bug this rule exists to prevent.
 */
export interface PersonFootprint {
  /**
   * ADR 0133 D1(c): active `hospital_affiliations` (`ended_on IS NULL`) ∪ the hospitals
   * of the person's active COMMISSION-tier memberships, resolved via
   * `commissions.hospital_id`.
   *
   * ⛔ THIS IS THE **WRITE** RULE, AND SINCE ADR 0148 IT NO LONGER MATCHES THE READ RULE.
   * The `profiles` / `professional_credentials` SELECT policies test affiliation as
   * EVER-HELD (the `ended_on` conjunct was removed in migration 20261003002900) so that
   * `end_affiliation` does not 404 the admin who performed it. This footprint stays
   * ACTIVE-ONLY on purpose: a hospital_admin may now OPEN an ex-employee's record and must
   * still not be able to edit it. A departed person resolves to an empty footprint here,
   * which `personScopeAllows` denies for every capability. Do not "align" the two.
   *
   * ⚠ BOTH SOURCES ARE REQUIRED. "Affiliations only" was considered and rejected in the
   * ADR's Alternatives table for a concrete reason: the org-wide member picker seats
   * people on commissions of hospitals they hold no affiliation with, so an
   * affiliations-only footprint would let a hospital admin deactivate someone actively
   * serving elsewhere — the person would look sole-footprint when they are not.
   */
  hospitalIds: string[]
  /**
   * ADR 0133 D2: TRUE when the target holds ANY org-tier or hospital-tier membership.
   * Such a person is org_admin-only for EVERY capability — even a seat at the caller's
   * own hospital, and even for the intersection ones (Amdt 1 ruling 2 left D2 untouched).
   *
   * ⚠ DERIVE THIS STRUCTURALLY, never from a role name list. The tier is a property of
   * the membership ROW's scope columns — commission-tier ≡ `commission_id IS NOT NULL`,
   * matching `memberships_scope_shape` — and the role vocabulary has been widened four
   * times (technical_director, technical_director_deputy, quality_reviewer, pqs_member
   * all arrived after the original list). A hardcoded list silently admits the next one.
   *
   * This is also what makes self-deactivation structurally impossible: the caller is
   * themselves hospital-tier, so they can never be a valid target.
   */
  hasNonCommissionTierMembership: boolean
}

/**
 * Does `capability` fall inside a hospital_admin's authority over this person?
 *
 * ⛔ THIS ANSWERS THE FOOTPRINT QUESTION ONLY. It assumes the caller has already been
 * established as an active `hospital_admin` in the target's home organization, and that
 * `administeredHospitalIds` is the set they actually administer THERE. The org_admin arm
 * is handled before this is ever called — an org_admin is not footprint-bounded at all.
 * Calling this without those preconditions produces a confidently wrong answer.
 *
 * @param administeredHospitalIds hospitals the CALLER administers, from the session.
 */
export function personScopeAllows(
  capability: PersonScopeCapability,
  footprint: PersonFootprint,
  administeredHospitalIds: readonly string[],
): boolean {
  // D2 — any org-tier or hospital-tier seat pushes the person to org_admin-only, for
  // every capability. Checked FIRST so no bound below can accidentally admit them.
  if (footprint.hasNonCommissionTierMembership) return false

  const administered = new Set(administeredHospitalIds)
  if (administered.size === 0) return false

  // D2 — an empty footprint is org_admin-only: an unaffiliated, uncommitteed person
  // belongs to no hospital, so no hospital admin has a claim on them.
  //
  // ⚠ PINNED EXPLICITLY, NOT DERIVED. For the subset capabilities ∅ ⊆ anything is TRUE,
  // so without this line a zero-footprint person would be MORE manageable than a
  // sole-hospital one — the classic vacuous-subset inversion. The intersection
  // capabilities would deny anyway (∅ ∩ X = ∅), which is exactly why relying on the maths
  // to express the rule would leave half of it correct by accident.
  const footprintHospitals = new Set(footprint.hospitalIds)
  if (footprintHospitals.size === 0) return false

  if (INTERSECTION_CAPABILITIES.has(capability)) {
    // fields · credentials — authority at ANY hospital the person serves (Amdt 1 r1).
    for (const hospitalId of footprintHospitals) {
      if (administered.has(hospitalId)) return true
    }
    return false
  }

  // cpf_change · lifecycle — the caller must administer the person's ENTIRE footprint.
  for (const hospitalId of footprintHospitals) {
    if (!administered.has(hospitalId)) return false
  }
  return true
}
