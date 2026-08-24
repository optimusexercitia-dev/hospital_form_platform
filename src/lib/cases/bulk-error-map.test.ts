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

  // ⛔ RETITLED (QA B5-3). This was called "anchored on the door", which it is NOT and
  // cannot be: it compares TS against a hand-copy of TS four lines above, so it is blind
  // to the only thing that title claimed — the DOOR's message changing. A test whose
  // title claims coverage it does not have is worse than no test, because it is what
  // stops someone writing the real one.
  // ⭐ THE REAL DOOR ANCHOR IS IN SQL, where the door is: `189_bulk_create_cases.sql`
  // asserts `bulk_create_cases`' comment-stripped body contains this exact literal. If
  // the door's wording changes, THAT reds. This one only guards the list against being
  // edited out from under the mapper.
  it('regression guard: the recognition list still contains the all_phases entry', () => {
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

  /**
   * ADR 0137 D3 — `app.assert_patient_required_fields` (FUP-0137-BULK-WIZARD-STILL-BOOLEAN).
   *
   * ⛔ The assertion is `not.toBe(GENERIC_ERROR)` AS WELL AS the passthrough, because
   * the defect was not a wrong string — it was the RIGHT string being replaced by the
   * generic. Pinning only the passthrough would go green if someone later widened the
   * allowlist to everything, which is the failure this file's `42501` tests exist to
   * refuse.
   */
  it('passes HC0T1 through so the refusal NAMES the missing identifiers', () => {
    // ⚠ Copied from the LIVE catalog (`pg_get_functiondef(app.assert_patient_
    // required_fields)`, 2026-08-24), never retyped from an ADR — CLAUDE.md's binding
    // exception. `%` is `v_labels`, whose `case f when 'mrn' then 'prontuário'` arm
    // is LOWERCASE — it is not the UI's `PATIENT_REQUIRED_FIELD_LABELS` vocabulary.
    // ⛔ The first version of this line wrote 'Prontuário' and claimed to be copied
    // from the catalog; it was copied for the sentence and guessed for the label. It
    // failed loudly here, which is the only reason it is not still wrong.
    const authored = 'este processo exige a identificação do paciente: preencha prontuário'
    const result = mapBulkRpcError({ code: 'HC0T1', message: `linha 3: ${authored}` })
    expect(result).toBe(`linha 3: ${authored}`)
    expect(result).not.toBe(GENERIC_ERROR)
    expect(result).toContain('prontuário')
  })
})
