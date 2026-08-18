import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import vectorFile from './__fixtures__/print-source-registers-vectors.json'

/**
 * ADR 0125 D1/D8 (+ Amendment 2) · ADR 0126 D5/D10 — the SYNC GUARD for the
 * shared print-derivation vectors.
 *
 * The registration rule exists twice: `app.print_source_registers` in SQL and a
 * pure client-importable predicate in TS. Both are driven by
 * `__fixtures__/print-source-registers-vectors.json`, but pgTAP cannot read JSON
 * (it runs inside the database), so the SQL side consumes a GENERATED file. This
 * test is what makes that generation step non-optional: it is the only thing
 * standing between "the vectors are shared" and "the vectors WERE shared, once".
 *
 * ⚠ This file deliberately does NOT test either predicate. It tests that the two
 * consumers are reading the same rows. The predicates are pinned by their own
 * suites — pgTAP for SQL, the frontend's vitest for TS — because a parity test
 * that also owns the semantics can go green by agreeing with itself.
 */

interface PrintSourceVector {
  kind: string
  status: string
  /** 0126 D5/D10 — defaults false when absent; meaningful for form_response only. */
  correction_open?: boolean
  /** 0126 D10 — defaults false when absent; meaningful for form_response only. */
  phase_voided?: boolean
  /**
   * The disposal conjunct — `meetings.phi_disposed_at is not null`. Defaults
   * false when absent; meaningful for MEETING only. `dispose_meeting_minutes`
   * erases the minutes without touching status or revision, so it moves BOTH
   * meeting axes in tandem (registration, and the watermark with it — keyed on
   * status alone a signed+disposed meeting is the forbidden fourth cell).
   */
  meeting_disposed?: boolean
  registers: boolean
  watermark: string
  note: string
}

const vectors = vectorFile.vectors as PrintSourceVector[]

/**
 * ⚠ `kind/status` is NOT unique across the fixture — `meeting/signed` alone
 * appears three times (plain, disposed, and the cross-kind-ignore row). A failure
 * message keyed on the pair would name the wrong vector, so the flags are part of
 * the label.
 */
const label = (v: PrintSourceVector) =>
  `${v.kind}/${v.status}${v.correction_open ? '+correction_open' : ''}` +
  `${v.phase_voided ? '+phase_voided' : ''}${v.meeting_disposed ? '+meeting_disposed' : ''}`

const ROOT = join(__dirname, '..', '..', '..')
const JSON_PATH = join(ROOT, 'src', 'lib', 'queries', '__fixtures__', 'print-source-registers-vectors.json')
/**
 * ⚠ `.psql`, NOT `.sql` — load-bearing. `pg_prove` collects every `*.sql` under
 * `supabase/tests/` AS A TEST, and this fixture declares no plan, so a `.sql`
 * extension fails the whole `npm run test:db` run with "No plan found in TAP
 * output". `\ir` loads it by explicit path regardless of extension. See the
 * generator's `OUT` comment for the measured evidence.
 */
const SQL_PATH = join(ROOT, 'supabase', 'tests', 'vectors', 'print_source_registers_vectors.psql')

const sha256 = (buf: Buffer | string) => createHash('sha256').update(buf).digest('hex')

describe('print-source vectors: SQL/TS sync guard', () => {
  const generated = readFileSync(SQL_PATH, 'utf8')
  const jsonBytes = readFileSync(JSON_PATH)

  it('the generated SQL declares the hash of the JSON it was built from', () => {
    const declared = /^-- sourceSha256: ([0-9a-f]{64})$/m.exec(generated)?.[1]
    expect(declared, 'the generated fixture has no sourceSha256 header').toBeDefined()
    expect(
      declared,
      'DRIFT: the vectors JSON and the generated SQL disagree. Run `node scripts/gen-print-source-vectors.mjs`.',
    ).toBe(sha256(jsonBytes))
  })

  it('the guard can actually FAIL — a one-byte change to the JSON changes the hash', () => {
    // A detector that finds nothing must be proven able to find something. Without
    // this, a broken hash step (empty string, constant, wrong algorithm) would let
    // the assertion above pass over any pair of files forever.
    const mutated = Buffer.concat([jsonBytes, Buffer.from(' ')])
    expect(sha256(mutated)).not.toBe(sha256(jsonBytes))
  })

  it('every JSON vector reaches the generated SQL, with its flags and registers value intact', () => {
    // The hash proves the two files correspond. This proves the GENERATOR does not
    // drop rows on the way: a hash guard alone is satisfied by a generator that
    // emits nothing, as long as it emits nothing consistently. The flags are part
    // of the row shape — a generator that silently dropped a column would still
    // hash clean.
    for (const v of vectors) {
      const row = `('${v.kind}', '${v.status}', ${v.correction_open ?? false}, ${v.phase_voided ?? false}, ${v.meeting_disposed ?? false}, ${v.registers}, '${v.watermark}')`
      expect(generated, `vector ${label(v)} is missing from the generated SQL`).toContain(row)
    }
    const emitted = generated.match(/^ {4}\('/gm)?.length ?? 0
    expect(emitted, 'the generated SQL carries rows the JSON does not').toBe(vectors.length)
  })
})

describe('print-source vectors: ADR 0125 D5 — the fourth cell is unreachable', () => {
  it('no vector is FINAL-and-ephemeral', () => {
    // The two axes give four combinations; three are legal. A page watermarked
    // FINAL that carries the prévia footer would be a page the platform disclaims.
    // ⚠ 0126 D5 made this invariant FALSIFIABLE — a submitted correction draft no
    // longer registers — and it survives only because the watermark moved in
    // tandem (0125 Amendment 2). This is now a pin over a decision that was
    // nearly lost, not over a coincidence.
    const offenders = vectors.filter((v) => v.watermark === 'final' && v.registers === false)
    expect(offenders.map((v) => `${v.kind}/${v.status}`)).toEqual([])
  })

  it('the other three cells are each actually POPULATED', () => {
    // Anchors the check above on something real. "No FINAL-ephemeral vectors" is
    // also true of an empty file, and of a file that only ever describes drafts —
    // both of which would satisfy the invariant while proving nothing about it.
    const cell = (w: string, r: boolean) => vectors.some((v) => v.watermark === w && v.registers === r)
    expect(cell('final', true), 'no FINAL + registered vector (submitted response / signed ata)').toBe(true)
    expect(cell('draft', true), 'no RASCUNHO + registered vector — this is the in_signature ata, D1').toBe(true)
    expect(cell('draft', false), 'no RASCUNHO + ephemeral vector (the ordinary prévia)').toBe(true)
  })
})

describe('print-source vectors: the decisions that are easy to lose', () => {
  const find = (kind: string, status: string, flags?: { correctionOpen?: boolean; phaseVoided?: boolean }) =>
    vectors.find(
      (v) =>
        v.kind === kind &&
        v.status === status &&
        (v.correction_open ?? false) === (flags?.correctionOpen ?? false) &&
        (v.phase_voided ?? false) === (flags?.phaseVoided ?? false),
    )

  it('a cancelled meeting is LOCKED but does NOT register (D1, the strict subset)', () => {
    // The one place the registering set is a strict subset of the lock set.
    // app.guard_meeting_status refuses a DELETE at `cancelled`, so any predicate
    // named for the LOCK would have to return true here. It is named for what it
    // decides — registration — and it decides false.
    expect(find('meeting', 'cancelled')?.registers).toBe(false)
  })

  it('an in_signature ata registers while still watermarked RASCUNHO (D1, the separating case)', () => {
    const v = find('meeting', 'in_signature')
    expect(v?.registers).toBe(true)
    expect(v?.watermark, 'meetingWatermarkFor is NOT changed by ADR 0125').toBe('draft')
  })

  it('a submitted draft of an OPEN correction neither registers nor stamps FINAL (0126 D5 + 0125 Am. 2)', () => {
    // The tandem move. If a later edit re-keys the watermark on `submitted` alone,
    // this vector becomes the fourth cell's counterexample and the invariant test
    // above goes red — that pairing is the point of pinning both here.
    const v = find('form_response', 'submitted', { correctionOpen: true })
    expect(v?.registers, 'a still-rejectable correction draft is not a lock point (0126 D5)').toBe(false)
    expect(v?.watermark, 'the watermark moves in tandem — RASCUNHO, "not settled" (0125 Amendment 2)').toBe('draft')
  })

  it("a voided phase's response neither registers nor stamps FINAL (0126 D10)", () => {
    const v = find('form_response', 'submitted', { phaseVoided: true })
    expect(v?.registers, 'approve_correction(void) annuls the phase; its paper must not stay mintable').toBe(false)
    expect(v?.watermark).toBe('draft')
  })

  it('the PLAIN submitted response still registers FINAL — the differential against fail-closed stubs', () => {
    // Without this row, a predicate stubbed to "never registers" satisfies both
    // refined pins above. The two-sided shape (0126 Consequences).
    const v = find('form_response', 'submitted')
    expect(v?.registers).toBe(true)
    expect(v?.watermark).toBe('final')
  })

  it('an unhandled kind is ephemeral, not registered (D8, fail closed)', () => {
    expect(find('unknown_kind', 'whatever')?.registers).toBe(false)
    expect(find('case', 'open')?.registers).toBe(false)
    expect(find('interview', 'scheduled')?.registers).toBe(false)
  })
})
