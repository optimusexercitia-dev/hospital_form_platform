import type { NspHospitalGrant } from "@/lib/pqs/roster-types";

/**
 * Resolve the SELECTED NSP hospital from the `?hospital=` search param against the
 * caller's operator grants for the org (NSP-per-hospital, ADR 0052; B6).
 *
 * Pure, client-safe (no I/O, no server imports) so it can run in a Server
 * Component page or the layout alike. The rule:
 *  - if `?hospital=` names a hospital the caller operates → select it;
 *  - otherwise (missing, empty, or a hospital the caller does NOT operate — e.g. a
 *    tampered deep link) → fall back to the FIRST grant (grants are name-sorted).
 *
 * Returns `null` only when the caller operates NO hospital in this org (the caller
 * has no NSP standing; the page 404s upstream). Never trusts the URL to widen scope:
 * an unknown/foreign hospital id can only ever collapse to a hospital the caller
 * already operates, so it can't be used to reach another hospital's PHI door.
 */
export function resolveNspHospital(
  grants: NspHospitalGrant[],
  requested: string | undefined,
): NspHospitalGrant | null {
  if (grants.length === 0) return null;
  if (requested) {
    const match = grants.find((g) => g.hospitalId === requested);
    if (match) return match;
  }
  return grants[0]!;
}
