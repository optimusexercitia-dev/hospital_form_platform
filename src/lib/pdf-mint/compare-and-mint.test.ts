import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DocumentPayload } from '@/lib/pdf/types'

/**
 * ADR 0126 D9 + Consequences — **compare-and-mint: the observed revision must be
 * the one the PROVIDER read, not one fetched at submit.**
 *
 * ⛔ The defect this guards is invisible to every other gate. A fresh read at the
 * mint call hands the door its own current value, the comparison always
 * succeeds, and `HC0DU` goes **vacuous while looking correct** — suite green,
 * `tsc` clean, door correct, guard dead.
 *
 * ⚠ **And "the argument is present" is NOT that assertion.** `346` t8 already
 * passes while the product could not re-mint a reopened ata at all, because
 * pgTAP supplies the argument the action never sent: **the test is a SECOND
 * CALLER, and a second caller can satisfy a door the real one cannot open.** So
 * the tests below pin PROVENANCE — where the value came from — not presence.
 */

const OBSERVED_REVISION = 7
/** What a re-read at submit would plausibly return instead. Any assertion that
 *  accepts this value is measuring the wrong thing. */
const STALE_DIFFERENT_REVISION = 99

const payload: DocumentPayload = {
  letterhead: {
    hospitalName: 'Hospital Canônico',
    hospitalAddress: null,
    logoDataUri: null,
    commissionName: 'CCIH',
  },
  provenance: {
    kind: 'registered',
    watermark: 'final',
    qr: { token: 't'.repeat(32), shortCode: 'ABCDEF2345', url: 'https://x.invalid/verificar/t' },
    emission: { at: '2026-01-02T14:00:00.000Z', byDisplay: 'Maria Fixa' },
  },
  signatures: [],
  containsPhi: false,
  sourceRevision: OBSERVED_REVISION,
  body: {
    kind: 'meeting',
    meetingNumber: 1,
    title: 'Ata',
    meetingTypeDisplay: null,
    statusDisplay: 'Assinada',
    scheduledStart: '2026-01-03T12:00:00.000Z',
    heldAt: null,
    heldEnd: null,
    modalityDisplay: null,
    locationDisplay: null,
    quorum: null,
    minutesMd: null,
    agenda: [],
    attendance: [],
    actionItems: [],
  },
}

const rpcCalls: { name: string; args: Record<string, unknown> }[] = []

vi.mock('@/lib/queries/feature-flags', () => ({ featureEnabled: vi.fn(async () => true) }))
vi.mock('@/lib/queries/printed-documents', () => ({
  getViewerDisplayName: vi.fn(async () => 'Maria Fixa'),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args })
      return { data: null, error: { code: 'HC0DU', message: 'stop after the call' } }
    }),
  })),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    storage: {
      from: () => ({
        upload: vi.fn(async () => ({ error: null })),
        remove: vi.fn(async () => ({ error: null })),
      }),
    },
  })),
}))
vi.mock('./gotenberg', () => ({
  renderPdfViaGotenberg: vi.fn(async () => Buffer.from('%PDF-1.7 fake')),
}))
vi.mock('./providers', () => ({
  PDF_PROVIDERS: {
    meeting: {
      templateKey: 'meeting',
      templateVersion: 1,
      phiCapable: false,
      // The ONLY source of a revision in this test. If the action ever fetches
      // its own, it will not be this number.
      build: vi.fn(async () => payload),
    },
  },
}))

beforeEach(() => {
  rpcCalls.length = 0
  process.env.PDF_VERIFICATION_BASE_URL = 'https://x.invalid'
})

describe('the mint action passes the OBSERVED revision (ADR 0126 D9)', () => {
  it('⭐ hands the door the value the PROVIDER read, not a fresher one', async () => {
    const { mintPrintedDocument } = await import('./actions')
    await mintPrintedDocument({
      sourceKind: 'meeting',
      sourceId: '11111111-2222-3333-4444-555555555555',
    } as never)

    const mint = rpcCalls.find((c) => c.name === 'mint_printed_document')
    expect(mint, 'the mint RPC was never called').toBeDefined()
    // PROVENANCE, not presence: this exact number exists nowhere but the payload
    // the provider returned. A re-read would produce something else.
    expect(mint!.args.p_source_revision).toBe(OBSERVED_REVISION)
    expect(mint!.args.p_source_revision).not.toBe(STALE_DIFFERENT_REVISION)
    expect(mint!.args.p_source_revision).not.toBe(0) // the door's silent default
  })

  it('the assertion can FAIL — a payload carrying a different revision moves it', async () => {
    // A detector that finds nothing must be proven able to find something. If
    // the action ignored the payload and sent a constant (0, or its own read),
    // this would not track.
    payload.sourceRevision = STALE_DIFFERENT_REVISION
    const { mintPrintedDocument } = await import('./actions')
    await mintPrintedDocument({
      sourceKind: 'meeting',
      sourceId: '11111111-2222-3333-4444-555555555555',
    } as never)
    payload.sourceRevision = OBSERVED_REVISION

    const mint = rpcCalls.find((c) => c.name === 'mint_printed_document')
    expect(mint!.args.p_source_revision).toBe(STALE_DIFFERENT_REVISION)
  })
})

describe('⛔ the action performs NO source read of its own', () => {
  /**
   * The structural half, and the one that actually carries the "observed, not
   * re-read" claim. The behavioural test above proves the value *currently*
   * comes from the payload; this proves a fresher value is not even reachable —
   * which is what makes the guard hold against a later "simplification" that
   * moves the read closer to the call.
   */
  const src = readFileSync(join(__dirname, 'actions.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')

  it('the comment stripper left real code behind', () => {
    expect(src).toContain('export async function mintPrintedDocument')
    expect(src).toContain('p_source_revision')
  })

  it('imports no source-detail query it could re-read from', () => {
    for (const forbidden of [/getMeetingDetail/, /getResponseForFill/, /print_source_revision/]) {
      expect(forbidden.test(src), `actions.ts can reach a fresher revision via ${forbidden}`).toBe(
        false,
      )
    }
  })

  it('passes a captured VARIABLE, never an inline call at the mint site', () => {
    // `p_source_revision: (await getMeetingDetail(id)).revision` is the exact
    // shape that defeats the guard while reading as a fix.
    expect(src).toMatch(/p_source_revision:\s*sourceRevision\s*,/)
    expect(src).not.toMatch(/p_source_revision:\s*(await|[\w.]+\()/)
  })

  it('sources that variable from the payload, and does not branch on kind', () => {
    expect(src).toMatch(/sourceRevision\s*=\s*payload\.sourceRevision/)
    // Uniform for every kind — a caller-side branch re-creates the abstraction
    // leak the mint door's own body forbids.
    expect(src).not.toMatch(/sourceKind\s*===\s*'meeting'/)
  })
})
