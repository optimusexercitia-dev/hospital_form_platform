/**
 * The D3/D8 blocker payload the affiliation doors emit in a refusal's `DETAIL`.
 *
 * ⭐⭐ THE RULE, AND IT IS THE DURABLE PART: **a blocker is the UNION of what every door
 * emits, never the INTERSECTION.** The previous parser kept only `role` and `commission` —
 * the two fields ALL the doors happen to share — and that is the entire defect. The
 * intersection is invisible while every door emits the same shape, and it silently destroys
 * data the moment one door emits more. HC0R6 emits four fields; a `hospital_affiliation`
 * blocker carries its identity in `hospital` and has `role IS NULL`, so intersecting left it
 * nameless and mislabelled as a role — and it is the MOST COMMON blocker kind.
 * ⛔ **Adding a sixth door? Widen this type to the union of its payload and the ones below.
 * Never narrow it to what one caller currently renders.**
 *
 * ⭐ WHY THIS IS A SEPARATE FILE — a general fact about this codebase, not about this
 * parser. `./actions.ts` is `'use server'`, and **every RUNTIME export of a `'use server'`
 * module must be an async function**. A synchronous helper therefore cannot be exported from
 * one at all, so it cannot be imported by a test, so it cannot be asserted against. That is
 * *why* this went untested and silently lost two fields for as long as it did — not an
 * oversight, a structural blind spot. Any `'use server'` module hiding sync logic has the
 * same one; move the logic to a sibling module to make it testable, as here.
 */

/**
 * One active blocker, EXACTLY as the doors emit it.
 *
 * ⛔ THE FIELD SET IS THE DOOR'S, NOT THE UI'S. Derived from the live catalog
 * (`pg_proc.prosrc` of the four `app.*_impl` kernels), never from the migration text:
 *
 *   HC0R1 `app.end_affiliation_impl`      → {role, commission}
 *   HC0R6 `app.end_org_affiliation_impl`  → {kind, role, hospital, commission}
 *   HC0R9 `app.void_affiliation_impl`     → {role, commission}
 *   HC0R9 `app.void_org_affiliation_impl` → {role, commission}
 *   HC0RA `app.void_org_affiliation_impl` → {hospital}
 *
 * Every field is therefore OPTIONAL AT THE SOURCE and is carried as `string | null`. A
 * parser that keeps only the intersection of those shapes is what produced the B2 defect:
 * a `kind: 'hospital_affiliation'` blocker carries its identity in `hospital` and has
 * `role IS NULL`, so keeping only `role`/`commission` rendered it as a nameless, mislabelled
 * role — and it is the MOST COMMON blocker kind.
 */
export interface AffiliationBlocker {
  /**
   * `'hospital_affiliation'` | `'membership'` — emitted by HC0R6 only, `null` elsewhere.
   * The discriminator the render site needs to label the row at all.
   */
  kind: string | null
  /** The membership role. `null` on a `hospital_affiliation` blocker — it has no role. */
  role: string | null
  /** The hospital name. `null` where the door does not emit one (HC0R1/HC0R9). */
  hospital: string | null
  /** The commission name. `null` for a hospital- or org-tier seat. */
  commission: string | null
}

/** `null` unless the value is a non-empty string — the doors emit SQL `null`, not `''`. */
function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * Parse a refusal's `DETAIL` into blockers, PRESERVING EVERY FIELD THE DOOR EMITS.
 *
 * ⛔ Do not narrow this to the fields one caller happens to render. The doors are the
 * authority on the payload; a field dropped here is unrecoverable downstream, and the
 * dropped field is exactly what names the row.
 */
export function parseBlockers(
  details: string | null | undefined,
): AffiliationBlocker[] | undefined {
  if (!details) return undefined
  try {
    const parsed: unknown = JSON.parse(details)
    if (!Array.isArray(parsed)) return undefined
    return parsed.map((b) => {
      const row = b as {
        kind?: unknown
        role?: unknown
        hospital?: unknown
        commission?: unknown
      }
      return {
        kind: str(row.kind),
        role: str(row.role),
        hospital: str(row.hospital),
        commission: str(row.commission),
      }
    })
  } catch {
    // A malformed DETAIL must never break the action — the refusal still stands.
    return undefined
  }
}
