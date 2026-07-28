import { createClient } from '@/lib/supabase/server'
import type { ReferenceCandidate } from '@/lib/forms/reference-constants'

/**
 * FF-5 (ADR 0091) — entity-reference data access (Architecture Rule 9: no
 * inline supabase-js anywhere else).
 *
 * ⚠ SERVER-ONLY. This module value-imports the server Supabase client, so a
 * Client Component that value-imports from here aborts `next build`
 * (BUG-FBE-005 — invisible to lint, typecheck and the unit suite alike). The
 * wizard typeahead must go through the `searchReferenceCandidates` SERVER ACTION
 * in `src/lib/responses/actions.ts`, which wraps this.
 *
 * ⚠ THE RPC IT WRAPS IS INVOKER-RIGHTS, AND THAT IS THE SECURITY DESIGN (ADR
 * 0091 ruling 3). `public.reference_candidates` runs as the CALLER, so it
 * inherits `participants_select` / `commissions_select_member_or_admin` /
 * `profiles_select_self_or_admin` verbatim and CANNOT return a row the caller
 * could not already select. A DEFINER search would *replace* all three (ADR 0078
 * A28 / 0079: a DEFINER's gate replaces RLS rather than adding to it) and would
 * have to re-derive three perimeters by hand — strictly more surface for no
 * capability. Nothing in this file may "help" by adding a service-role client.
 *
 * NO PHI (ruling 1). The lane resolves `participants.display_name`, which is a
 * SURROGATE for patients by construction — `set_participant_patient` is the only
 * door that creates one and it hardcodes the literal 'Paciente'. Raw identity
 * lives in `patient_identifiers`, which has zero RLS policies and is reachable
 * only through its audited single door. This path never names it, so there is no
 * PHI read here and no audit door to open.
 */

// The row shape lives in the PURE module so a Client Component can name it
// without any risk of value-importing this server module (BUG-FBE-005).
export type { ReferenceCandidate } from '@/lib/forms/reference-constants'

/** Raw row shape of `public.reference_candidates`, before camel-casing. */
interface CandidateRow {
  target_id: string
  label: string | null
  sublabel: string | null
}

/**
 * The outcome of a candidate search — DISCRIMINATED, because "no matches" and
 * "the call failed" are different facts that must not arrive the same way.
 *
 * ⚠ THIS TYPE EXISTS BECAUSE COLLAPSING THEM WAS A REAL DEFECT (QA M-2). This
 * function used to end `if (error || !data) return []`, which turned every
 * Postgres error into an empty array. The picker then explained the emptiness
 * with its most specific empty-state copy — so with `entity_refs` OFF, the RPC
 * raised HC0Q3 and the user was told *"este campo lista apenas os pacientes do
 * caso — em um formulário avulso … ele fica vazio"*. A feature-flag outage
 * presented as correct behaviour, and to an operator as a data problem. That is
 * the flag-dark hazard FF-2 r1 B-3 and FF-3 r1 B-1 both hit, wearing a
 * reassuring sentence.
 *
 * An empty `candidates` on `ok: true` is still frequently CORRECT — a
 * `patient` lane on a standalone response, or a commission lane for a caller who
 * belongs to one commission. That is exactly why the failure must be a
 * different shape rather than a different-looking empty.
 */
export type ReferenceCandidatesResult =
  | { ok: true; candidates: ReferenceCandidate[] }
  | { ok: false; code: string | null; message: string | null }

/**
 * Candidates for one reference item of one response, optionally filtered by a
 * typeahead query. Ordered by label and capped at 50 SERVER-SIDE (the RPC's own
 * `limit`), so this never streams an org's whole participant roster.
 *
 * Never throws: a raised RPC comes back as `{ ok: false, code, message }` for
 * the caller to map to pt-BR. The `code` is the SQLSTATE; `message` is the DB's
 * own sentence, which for some codes IS the right user-facing text.
 */
export async function listReferenceCandidates(input: {
  responseId: string
  itemId: string
  query?: string
}): Promise<ReferenceCandidatesResult> {
  const { responseId, itemId, query } = input
  // A missing id is a malformed caller, not a failed call: there is nothing to
  // search for and nothing went wrong downstream.
  if (!responseId || !itemId) return { ok: true, candidates: [] }

  const supabase = await createClient()
  const trimmed = query?.trim()

  const { data, error } = await supabase.rpc('reference_candidates', {
    p_response_id: responseId,
    p_item_id: itemId,
    // Omit rather than send '' — the RPC nullifies a blank itself, but an
    // absent arg keeps the "no filter" path explicit on the wire.
    p_query: trimmed ? trimmed : undefined,
  })

  if (error) {
    return { ok: false, code: error.code ?? null, message: error.message ?? null }
  }

  return {
    ok: true,
    // `data` null with no error is PostgREST returning an empty set, which is a
    // genuine "no matches" — not a failure, and no longer conflated with one.
    candidates: ((data ?? []) as CandidateRow[]).map((row) => ({
      targetId: row.target_id,
      // The three lanes' name columns are all nullable in the schema; a candidate
      // with no name still needs to be pickable, so fall back to the id rather
      // than dropping the row or rendering an empty button.
      label: row.label ?? row.target_id,
      sublabel: row.sublabel,
    })),
  }
}
