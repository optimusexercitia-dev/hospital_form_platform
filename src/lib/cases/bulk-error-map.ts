/**
 * Error mapping for the bulk case-creation RPC (Architecture Rules 8 & 10).
 *
 * Extracted from `bulk-actions.ts` so it can be unit-tested: that module is
 * `'use server'`, and such a module may only EXPORT async functions — a private
 * synchronous mapper inside it is unreachable from a test. Nothing here is
 * server-only, so importing it from either side is safe.
 */

export const GENERIC_ERROR = 'Não foi possível criar os casos. Tente novamente.'
export const FORBIDDEN_ERROR = 'Você não tem permissão para esta ação.'

/**
 * SQLSTATEs the RPC + its composed doors raise INTENTIONALLY, whose (row-indexed)
 * messages are user-facing pt-BR and may be surfaced verbatim. Mirrors
 * `actions.ts::mapCaseError`'s allowlist. Anything OUTSIDE this set is an unexpected
 * low-level Postgres error whose message is raw English — mapped to the generic pt-BR
 * instead (Rule 8: raw Postgres text never reaches the UI).
 */
export const PT_BR_SQLSTATES: ReadonlySet<string> = new Set<string>([
  '23514', // check_violation — scope/cap/count/template-status/PHI-floor/patient-not-enabled
  'P0002', // no_data_found — processo/caso não encontrado
  'HC017', // no published version for a phase form
  'HC018', // phase blocked (its blockers unsettled)
  'HC019', // phase not pending
  'HC020', // case not open
  'HC021', // assignee not a member
  'HC055', // narrative not in the required state
  'HC068', // required custom field missing
  'HC0F1', // case-excluded (exclusion perimeter)
])

/**
 * ⛔ `42501` IS THE ONE SQLSTATE WHOSE MESSAGE CANNOT BE TRUSTED FROM THE CODE ALONE,
 * which is why it is NOT in `PT_BR_SQLSTATES` and never should be. Postgres raises it
 * for BOTH an authored pt-BR refusal AND its own raw-English "permission denied for
 * table X" — the same conflation recorded in `FUP-42501-CONFLATES-GRANT-WITH-RLS`.
 * Allowing the code through would leak raw English to the UI.
 *
 * So this is a RECOGNITION LIST, not a pass-through: only messages named here survive,
 * and every unrecognised `42501` still becomes {@link FORBIDDEN_ERROR}. That second
 * half is the part that keeps Rule 8 intact — without it this would be a passthrough
 * wearing an allowlist's name.
 *
 * ⚠ Each entry must be the door's message VERBATIM, copied from the live catalog
 * (`pg_get_functiondef`), never retyped from an ADR or a commit message — the pt-BR
 * accents and the straight double quotes are load-bearing for the match.
 */
export const RECOGNISED_FORBIDDEN_MESSAGES: readonly string[] = [
  // `public.bulk_create_cases`' gate-level `all_phases` refusal. ADR 0134 Amendment 7
  // §A7.2 requires that scope be refused AT THE GATE *with its own message naming the
  // scope* — step (c) `assign_narrative` is coordinator-only with no capability arm, so
  // no combination of ADR-0061 keys can satisfy it, and a delegate must be told which
  // half to change rather than being handed a generic "forbidden".
  // ⚠ The UI also suppresses the option, so a user reaches this only through stale
  // state or a direct call. That does not make it optional: the suppression is a
  // MIRROR, the door is the AUTHORITY, and a refusal the user cannot read is how the
  // next person concludes the feature is broken rather than forbidden.
  'o escopo "todas as fases" é exclusivo da coordenação da comissão',
]

/**
 * Map a PostgREST/Postgres error from `bulk_create_cases` to a user-facing pt-BR
 * string. Never returns raw Postgres text.
 */
export function mapBulkRpcError(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return GENERIC_ERROR

  if (error.code === '42501') {
    const message = error.message?.trim() ?? ''
    // Substring, not equality: the RPC re-raises per-row failures with a `linha N:`
    // prefix. (This particular refusal fires at the GATE, before the loop, so it
    // arrives unprefixed — matching by substring covers both without a second path.)
    // ⭐ The CANONICAL entry is returned, never `message` itself, so no prefix or
    // trailing Postgres detail can ride along with a recognised sentence.
    const recognised = RECOGNISED_FORBIDDEN_MESSAGES.find((m) => message.includes(m))
    return recognised ?? FORBIDDEN_ERROR
  }

  // Only the RPC's intentional pt-BR SQLSTATEs pass their message through; any other
  // code is unexpected raw-English Postgres → generic pt-BR (Rule 8).
  if (error.code && PT_BR_SQLSTATES.has(error.code)) {
    return error.message?.trim() || GENERIC_ERROR
  }
  return GENERIC_ERROR
}
