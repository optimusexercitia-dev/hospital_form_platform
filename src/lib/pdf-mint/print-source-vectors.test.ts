import { describe, expect, it } from 'vitest'

import { meetingWatermarkFor } from '@/lib/pdf/documents/meeting'
import {
  printSourceRegisters,
  printSourceWatermark,
  type PrintSourceState,
} from '@/lib/pdf/documents/print-source'
import vectorFile from '@/lib/queries/__fixtures__/print-source-registers-vectors.json'

/**
 * ADR 0125 D1/D5/D8 + Amendment 2 · ADR 0126 D5/D7/D10 — the TS side of the two
 * mint-time print derivations. This is consumer #3 of the shared vectors (named
 * as such in the fixture's own header).
 *
 * ⚠ This is NOT `src/lib/queries/print-source-vectors.test.ts`. That file is the
 * SYNC GUARD (JSON ↔ generated SQL) and deliberately tests neither predicate,
 * because a parity test that also owns the semantics can go green by agreeing
 * with itself. THIS file owns the TS semantics; pgTAP owns the SQL ones; both
 * read the same vectors.
 *
 * ⚠ **Why this suite is NOT colocated with its subject** (`src/lib/pdf/documents/
 * print-source.ts`). `src/lib/pdf/**` is PURE (ADR 0104 D14) and eslint enforces
 * it by BANNING every path shape that reaches `src/lib/queries` — a rule
 * deliberately red-teamed against relative escapes in the PDF·P1 fix wave. The
 * shared fixture lives under `src/lib/queries/__fixtures__/`, so a colocated
 * suite cannot read it, and dodging the ban (raw `readFileSync`, a test-file
 * exemption) would weaken a gate to move a test. `src/lib/pdf-mint/` is the
 * orchestration layer the ban's own message points to, it already reads both
 * sides, and nothing here ships to a client bundle.
 *
 * ⚠ NOT COVERED HERE: currency/head (0126 D2/D8/D9). It reads chain, pointer and
 * revision state that a stateless vector cannot carry — its coverage is the
 * two-sided keystones 0126's Consequences demand. Nothing in this file should be
 * read as covering it.
 */

interface PrintSourceVector {
  kind: string
  status: string
  correction_open?: boolean
  phase_voided?: boolean
  meeting_disposed?: boolean
  registers: boolean
  watermark: string
  note: string
}

const vectors = vectorFile.vectors as PrintSourceVector[]

/**
 * ⚠ **EVERY vector dimension MUST be mapped here, or its rows pass VACUOUSLY.**
 * A flag the fixture sets and this function drops never reaches the predicate,
 * so the row asserts the DEFAULT behaviour under a different name and goes green
 * whatever the predicate does with that flag. `meeting_disposed` was caught in
 * exactly that state by `backend` when the dimension was added — the
 * cross-kind row (`form_response` + `meeting_disposed`) was passing while the
 * flag was unreachable. A new dimension is not integrated until it is here.
 */
const stateOf = (v: PrintSourceVector): PrintSourceState => ({
  status: v.status,
  correctionOpen: v.correction_open ?? false,
  phaseVoided: v.phase_voided ?? false,
  meetingDisposed: v.meeting_disposed ?? false,
})

const label = (v: PrintSourceVector) =>
  `${v.kind}/${v.status}${v.correction_open ? '+correction_open' : ''}${
    v.phase_voided ? '+phase_voided' : ''
  }${v.meeting_disposed ? '+meeting_disposed' : ''}`

describe('printSourceRegisters / printSourceWatermark: the shared vectors', () => {
  it('the vector file is actually populated (the loops below are not vacuous)', () => {
    // Every `it.each`/for-loop in this file iterates `vectors`. Over an empty
    // array they all pass having asserted nothing — the dominant failure family
    // in this project's record. This is the anchor that makes them mean something.
    expect(vectors.length).toBeGreaterThan(0)
    expect(vectors.some((v) => v.kind === 'form_response')).toBe(true)
    expect(vectors.some((v) => v.kind === 'meeting')).toBe(true)
  })

  for (const v of vectors) {
    it(`${label(v)} → registers=${v.registers}, watermark=${v.watermark}`, () => {
      expect(printSourceRegisters(v.kind, stateOf(v)), v.note).toBe(v.registers)
      expect(printSourceWatermark(v.kind, stateOf(v)), v.note).toBe(v.watermark)
    })
  }

  it('⭐ EVERY dimension the fixture declares is MAPPED — the anti-vacuity guard', () => {
    // The durable fix for the class, not just for `meeting_disposed`: if backend
    // adds a fourth dimension and this suite does not map it, those rows would
    // silently assert the DEFAULT behaviour under a new name. This reds instead.
    const NON_FLAG_KEYS = ['kind', 'status', 'registers', 'watermark', 'note']
    const declared = new Set<string>()
    for (const v of vectors) {
      for (const key of Object.keys(v)) {
        if (!NON_FLAG_KEYS.includes(key)) declared.add(key)
      }
    }
    expect(
      [...declared].sort(),
      'a fixture dimension is not mapped in stateOf() — its rows are vacuous',
    ).toEqual(['correction_open', 'meeting_disposed', 'phase_voided'])

    // ...and each declared flag genuinely REACHES the predicate input. Knowing the
    // name is not the same as passing the value.
    const camel = (s: string) => s.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase())
    const probe = stateOf({
      kind: 'meeting',
      status: 'signed',
      correction_open: true,
      phase_voided: true,
      meeting_disposed: true,
      registers: false,
      watermark: 'draft',
      note: 'probe',
    }) as unknown as Record<string, unknown>
    for (const flag of declared) {
      expect(probe[camel(flag)], `stateOf drops ${flag}`).toBe(true)
    }
  })

  it('the flags are OMITTABLE and default false — the vectors pass them explicitly', () => {
    // The vector loop always supplies both flags, so it cannot see a predicate
    // that mishandles `undefined`. Callers will omit them for meetings.
    expect(printSourceRegisters('form_response', { status: 'submitted' })).toBe(true)
    expect(printSourceWatermark('form_response', { status: 'submitted' })).toBe('final')
    expect(printSourceRegisters('meeting', { status: 'in_signature' })).toBe(true)
  })

  it('the FORM flags are IGNORED by meetings, and the MEETING flag by form responses', () => {
    // Each flag is kind-scoped; a predicate that read them all uniformly would
    // still satisfy most vectors.
    for (const status of ['in_signature', 'signed', 'distributed']) {
      expect(
        printSourceRegisters('meeting', { status, correctionOpen: true, phaseVoided: true }),
        `a meeting must not be affected by form_response flags (${status})`,
      ).toBe(true)
    }
    expect(
      printSourceWatermark('meeting', { status: 'signed', correctionOpen: true, phaseVoided: true }),
    ).toBe('final')
    expect(
      printSourceRegisters('form_response', { status: 'submitted', meetingDisposed: true }),
      'a form response must not be affected by the meeting disposal flag',
    ).toBe(true)
    expect(
      printSourceWatermark('form_response', { status: 'submitted', meetingDisposed: true }),
    ).toBe('final')
  })

  it('a DISPOSED meeting neither registers nor stamps FINAL — the tandem move', () => {
    // `dispose_meeting_minutes` empties the content without touching `status` or
    // `revision`, so neither the status term nor 0126 D9's revision match sees
    // it. Both arms must drop, or `signed` + disposed is registers=false +
    // watermark='final' — the forbidden fourth cell.
    for (const status of ['in_signature', 'signed', 'distributed']) {
      expect(printSourceRegisters('meeting', { status, meetingDisposed: true }), status).toBe(false)
      expect(printSourceWatermark('meeting', { status, meetingDisposed: true }), status).toBe(
        'draft',
      )
    }
    // The differential: the same statuses UNDISPOSED still register.
    for (const status of ['in_signature', 'signed', 'distributed']) {
      expect(printSourceRegisters('meeting', { status }), status).toBe(true)
    }
  })
})

describe('the two axes are SEPARATE declarations (ADR 0125 D8 / 0126 D7)', () => {
  it('SEPARATES for meetings: in_signature REGISTERS while stamped RASCUNHO', () => {
    // The case that makes "two predicates" more than ceremony. If a later edit
    // collapses the axes into one function, this red is the first thing to fire.
    expect(printSourceRegisters('meeting', { status: 'in_signature' })).toBe(true)
    expect(printSourceWatermark('meeting', { status: 'in_signature' })).toBe('draft')
  })

  it('the meeting watermark still delegates to the UNCHANGED meetingWatermarkFor', () => {
    // ⛔ ADR 0125 does not change `meetingWatermarkFor` — pgTAP `312` and E2E pin
    // the mark. Delegation (not re-implementation) is what keeps ONE meeting
    // watermark derivation, so the mark the mint dialog previews is the mark the
    // renderer stamps. Divergence here would be silent in every other test.
    for (const status of [
      'scheduled',
      'held',
      'in_signature',
      'signed',
      'distributed',
      'cancelled',
    ]) {
      expect(printSourceWatermark('meeting', { status })).toBe(meetingWatermarkFor(status))
    }
  })

  it('CANCELLED is locked but does NOT register — the strict subset (D1)', () => {
    // `guard_meeting_status` refuses a DELETE at `cancelled`, so a predicate named
    // for the LOCK would return true here. It is named for what it decides.
    expect(printSourceRegisters('meeting', { status: 'cancelled' })).toBe(false)
  })

  it('an unhandled kind is EPHEMERAL, not registered (D8, fail closed)', () => {
    for (const kind of ['case', 'interview', 'unknown_kind', '', 'form_responses']) {
      expect(printSourceRegisters(kind, { status: 'submitted' }), kind).toBe(false)
      expect(printSourceRegisters(kind, { status: 'signed' }), kind).toBe(false)
      expect(printSourceWatermark(kind, { status: 'submitted' }), kind).toBe('draft')
    }
  })
})

// ---------------------------------------------------------------------------
// The fourth cell (ADR 0125 D5) — pinned by exhaustive sweep, not reasoned.
// ---------------------------------------------------------------------------

/**
 * The full input space, deliberately wider than the vectors: every kind crossed
 * with every kind's statuses (so `form_response`/`signed` and `meeting`/
 * `submitted` are probed too) plus junk, crossed with EVERY flag.
 *
 * ⚠ The width is deliberately NOT stated here. It is asserted below against a
 * literal, so it cannot go stale silently — a comment claiming a probe count is
 * exactly the §J defect, and this file already carries the record of it.
 *
 * The vectors are a hand-chosen set. "No FINAL-and-ephemeral vector" is a
 * statement about those vectors ALONE; the fourth cell must be unreachable over
 * the whole input space, which is what makes it a keystone rather than a sample.
 * ⚠ No count here on purpose — this paragraph said "those 14" against 20 vectors
 * (found by qa, in the same block whose two OTHER stale counts had just been
 * fixed). The fixture's width is asserted below, where it must be maintained or
 * the build fails; a count in prose is the §J defect this file records.
 */
const ALL_KINDS = ['form_response', 'meeting', 'case', 'interview', 'unknown_kind']
const ALL_STATUSES = [
  'in_progress',
  'submitted',
  'scheduled',
  'held',
  'in_signature',
  'signed',
  'distributed',
  'cancelled',
  'open',
  'whatever',
  '',
]

interface Probe {
  kind: string
  state: PrintSourceState
}

const ALL_PROBES: Probe[] = ALL_KINDS.flatMap((kind) =>
  ALL_STATUSES.flatMap((status) =>
    [false, true].flatMap((correctionOpen) =>
      [false, true].flatMap((phaseVoided) =>
        [false, true].map((meetingDisposed) => ({
          kind,
          state: { status, correctionOpen, phaseVoided, meetingDisposed },
        })),
      ),
    ),
  ),
)

/** The predicate pair under test, as data — so the same sweep can be re-run
 *  against a MUTANT pair to prove it is able to find an offender. */
type PredicatePair = {
  registers: (kind: string, state: PrintSourceState) => boolean
  watermark: (kind: string, state: PrintSourceState) => string
}

const finalEphemeralOffenders = (pair: PredicatePair): string[] =>
  ALL_PROBES.filter(
    (p) => pair.watermark(p.kind, p.state) === 'final' && pair.registers(p.kind, p.state) === false,
  ).map((p) => `${p.kind}/${p.state.status}/c=${p.state.correctionOpen}/v=${p.state.phaseVoided}`)

describe('ADR 0125 D5 — the fourth cell (FINAL content + prévia footer) is UNREACHABLE', () => {
  const LIVE: PredicatePair = {
    registers: printSourceRegisters,
    watermark: printSourceWatermark,
  }

  it('⭐ the sweep CROSSES every dimension the predicate reads — it stays exhaustive', () => {
    // ⛔ THIS GUARD EXISTS BECAUSE THE SWEEP SILENTLY STOPPED BEING EXHAUSTIVE.
    // When `meetingDisposed` was added, the predicate gained a third input and
    // this cross-product still crossed two — so the keystone could not have
    // caught a disposal tandem-move error, and NOTHING RED, because a narrower
    // sweep still passes everything it does check. The comment in
    // `print-source.ts` said "440-probe sweep" while the sweep ran 220.
    //
    // The chain this pins: fixture dimensions → `stateOf` keys → probe keys.
    // The first link is guarded above; this is the second.
    const stateKeys = Object.keys(
      stateOf({
        kind: 'meeting',
        status: 'signed',
        correction_open: true,
        phase_voided: true,
        meeting_disposed: true,
        registers: false,
        watermark: 'draft',
        note: 'probe',
      }),
    )
    const probeKeys = Object.keys(ALL_PROBES[0]!.state)
    expect(
      probeKeys.sort(),
      'the probe space does not cross every dimension stateOf produces',
    ).toEqual(stateKeys.sort())

    // ...and each boolean dimension is exercised in BOTH directions. A key that
    // is present but constant is a dimension in name only.
    for (const key of probeKeys.filter((k) => k !== 'status')) {
      const values = new Set(
        ALL_PROBES.map((p) => (p.state as unknown as Record<string, unknown>)[key]),
      )
      expect(values, `${key} is not varied across the sweep`).toEqual(new Set([false, true]))
    }
  })

  it('no input anywhere in the space produces FINAL-and-ephemeral', () => {
    // A page watermarked FINAL that carries the prévia footer would be a page the
    // platform disclaims whose source is immutable. Three of the four cells are
    // legal; this one must not become reachable.
    expect(finalEphemeralOffenders(LIVE)).toEqual([])
  })

  it('the other three cells are each genuinely REACHED by this sweep', () => {
    // ⭐ Anchors the check above on something real. "No FINAL-ephemeral case" is
    // also true of a sweep that never produces `final` at all, or one whose probe
    // list is empty — both would satisfy the invariant while proving nothing.
    const reaches = (w: string, r: boolean) =>
      ALL_PROBES.some(
        (p) => LIVE.watermark(p.kind, p.state) === w && LIVE.registers(p.kind, p.state) === r,
      )
    // ⭐ The width is pinned as a LITERAL, on purpose. §J happened because a
    // probe count lived in PROSE, where widening the space left the number
    // behind and nothing red. Here a changed space reds this line and forces a
    // deliberate update — the same discipline as a template fingerprint.
    // The product form beside it catches a flatMap that silently drops an axis.
    expect(ALL_PROBES.length, 'the probe space changed — update this literal deliberately').toBe(440)
    expect(ALL_PROBES.length).toBe(ALL_KINDS.length * ALL_STATUSES.length * 8)
    expect(reaches('final', true), 'FINAL + registered (submitted response / signed ata)').toBe(true)
    expect(reaches('draft', true), 'RASCUNHO + registered — the in_signature ata (D1)').toBe(true)
    expect(reaches('draft', false), 'RASCUNHO + ephemeral — the ordinary prévia').toBe(true)
  })

  it('⭐ the sweep can actually FIND an offender — the pre-Amendment-2 rule is caught', () => {
    // A detector that finds nothing must be proven able to find something. The
    // mutant is not invented: it is EXACTLY the rule that shipped in ADR 0125 D1
    // before Amendment 2 — watermark keyed on `submitted` alone, while 0126 D5
    // had already refined the lock. That pairing is what made the fourth cell
    // reachable, and it is the specific regression a future edit would re-create.
    const MUTANT: PredicatePair = {
      registers: printSourceRegisters, // refined (0126 D5 + D10)
      watermark: (kind, state) =>
        kind === 'form_response'
          ? state.status === 'submitted'
            ? 'final' // ⛔ the un-refined watermark: `submitted` alone
            : 'draft'
          : printSourceWatermark(kind, state),
    }
    const offenders = finalEphemeralOffenders(MUTANT)
    expect(offenders.length, 'the mutant must be CAUGHT, or this suite proves nothing').toBeGreaterThan(0)
    // ...and specifically the two corridors the amendment exists for.
    expect(offenders).toContain('form_response/submitted/c=true/v=false')
    expect(offenders).toContain('form_response/submitted/c=false/v=true')
  })
})
