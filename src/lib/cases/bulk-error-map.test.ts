import { describe, it, expect } from 'vitest'

import {
  FORBIDDEN_ERROR,
  GENERIC_ERROR,
  RECOGNISED_FORBIDDEN_MESSAGES,
  mapBulkRpcError,
} from './bulk-error-map'

/**
 * ⛔ THE TWO HALVES ARE ONE TEST. Asserting only that the recognised message survives
 * would pass on a plain pass-through — i.e. on the exact change Rule 8 forbids, where
 * every `42501` (including Postgres's raw-English "permission denied for table X")
 * reaches the UI. The unrecognised-`42501` half is what makes this a test of a MAPPING
 * rather than of a passthrough, and it is the half that would go red first.
 *
 * Measured 2026-08-22 against the live catalog: **104 distinct authored pt-BR messages
 * are raised with `42501`, and 103 of them are informative** (only `sem permissão` is
 * the bare form). So the code alone can never decide whether a `42501` message is
 * authored pt-BR or raw English — recognition has to be explicit. Filed as
 * `FUP-42501-AUTHORED-MESSAGES-FLATTENED-BY-EVERY-MAPPER`.
 */
describe('mapBulkRpcError', () => {
  const ALL_PHASES = 'o escopo "todas as fases" é exclusivo da coordenação da comissão'

  it('is anchored on the door: the canonical entry matches the migration verbatim', () => {
    // If the door's wording changes, this reds HERE rather than by silently falling
    // back to the generic string in production.
    expect(RECOGNISED_FORBIDDEN_MESSAGES).toContain(ALL_PHASES)
  })

  it("surfaces the all_phases refusal's OWN text (ADR 0134 Amdt 7 §A7.2)", () => {
    expect(mapBulkRpcError({ code: '42501', message: ALL_PHASES })).toBe(ALL_PHASES)
  })

  it('still surfaces it when the RPC re-raises with a `linha N:` prefix', () => {
    expect(mapBulkRpcError({ code: '42501', message: `linha 7: ${ALL_PHASES}` })).toBe(
      ALL_PHASES,
    )
  })

  it('returns the CANONICAL text, never the raw message it matched inside', () => {
    // The prefix and any trailing Postgres detail must not ride along.
    const result = mapBulkRpcError({
      code: '42501',
      message: `linha 7: ${ALL_PHASES}\nCONTEXT: PL/pgSQL function bulk_create_cases`,
    })
    expect(result).toBe(ALL_PHASES)
    expect(result).not.toContain('CONTEXT')
    expect(result).not.toContain('linha 7')
  })

  // ⭐ THE HALF THAT MAKES THIS A MAPPING TEST.
  it('maps an UNRECOGNISED 42501 to the generic forbidden string', () => {
    expect(mapBulkRpcError({ code: '42501', message: 'sem permissão' })).toBe(
      FORBIDDEN_ERROR,
    )
  })

  it("maps Postgres's own raw-English 42501 to the generic string, not through", () => {
    const raw = 'permission denied for table patient_identifiers'
    const result = mapBulkRpcError({ code: '42501', message: raw })
    expect(result).toBe(FORBIDDEN_ERROR)
    expect(result).not.toContain('permission denied')
  })

  it('maps an unknown SQLSTATE to the generic string (Rule 8)', () => {
    expect(
      mapBulkRpcError({ code: '42P01', message: 'relation "x" does not exist' }),
    ).toBe(GENERIC_ERROR)
  })

  it('still passes an allowlisted pt-BR SQLSTATE through unchanged', () => {
    expect(
      mapBulkRpcError({ code: 'HC021', message: 'o responsável deve ser membro da comissão' }),
    ).toBe('o responsável deve ser membro da comissão')
  })

  it('maps a null error to the generic string', () => {
    expect(mapBulkRpcError(null)).toBe(GENERIC_ERROR)
  })
})
