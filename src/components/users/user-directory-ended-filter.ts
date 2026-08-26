/**
 * The `?includeEnded=` vocabulary for the user directory (AFF4 F6 — ADR 0151 D10 as
 * amended by ADR 0154).
 *
 * ⛔ ONE OWNER, and it is this module — the same reason `parseUserDirectoryStatusFilter`
 * owns `?status=`: the page reads the parameter and the control writes it, and two
 * parses of one query parameter is how a directory widens by one rule and renders the
 * toggle by another.
 *
 * ⚠ IT LIVES IN A NON-CLIENT MODULE DELIBERATELY. The control that writes it is a Client
 * Component; the page that reads it is a Server Component. A value imported from a
 * `"use client"` module into a Server Component arrives as a client REFERENCE, not a
 * callable function — so putting `parseIncludeEnded` beside the switch would typecheck
 * and then fail at render. The dependency runs the safe way: both sides import this.
 *
 * ⚠ THE PARAMETER IS ORG-DIRECTORY-ONLY (PO-ruled 2026-08-26, plan §F6). A
 * `hospital_admin` cannot read `organization_affiliations` at all — the SELECT policy has
 * no hospital tier (ADR 0151 D1, pinned by pgTAP `375` §4.1) — so `listHospitalUsers`
 * ignores `includeEnded` by construction. The page must therefore not merely hide the
 * control on that arm; it must not parse the parameter either, so a hand-typed
 * `?includeEnded=1` is inert rather than half-honoured.
 */

/** The query-parameter name. camelCase matches the existing `?inProgress=` precedent. */
export const INCLUDE_ENDED_PARAM = 'includeEnded'

/**
 * The single ON token.
 *
 * A closed vocabulary rather than a truthiness test: `?includeEnded=false` and
 * `?includeEnded=0` must not widen the roster, and a bare `Boolean(raw)` would widen on
 * both. Anything that is not exactly this token means "narrow" — *narrowing can be wrong
 * and safe; widening cannot.*
 */
const ON = '1'

/** `true` only for the exact ON token. Every other value, and absence, means narrow. */
export function parseIncludeEnded(raw: string | undefined): boolean {
  return raw === ON
}

/**
 * The value to put in the URL for a desired state, or `undefined` to drop the key.
 *
 * The OFF state is expressed by ABSENCE, never by `includeEnded=0`: the default is the
 * narrow set, and a URL that spells out its own default accumulates noise on every
 * toggle and makes the clean directory link no longer the canonical one.
 */
export function includeEndedValue(next: boolean): string | undefined {
  return next ? ON : undefined
}
