import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DocumentPayload, FormResponseDocumentBody } from '@/lib/pdf/types'

import {
  PREVIA_ACQUIRE_TIMEOUT_MS,
  PREVIA_BUSY_MESSAGE,
  renderPreviaPdf,
} from './previa'
import { ACQUIRE_TIMEOUT_MS, MINT_BUSY_MESSAGE, __createSemaphoreForTests } from './semaphore'

/**
 * ADR 0125 D4/D9 — the ephemeral render path.
 *
 * ⛔ The load-bearing claim is a NEGATIVE ("no bytes are ever stored"), and a
 * negative is the easiest thing in this codebase to assert vacuously: a
 * `renderPreviaPdf` that did nothing at all would satisfy every "never uploaded"
 * check forever. Both negatives below therefore carry a POSITIVE CONTROL, and
 * the control is `actions.ts` — the sibling that genuinely does upload.
 */

vi.mock('./gotenberg', () => ({
  renderPdfViaGotenberg: vi.fn(async () => Buffer.from('%PDF-1.7 fake')),
}))

const { renderPdfViaGotenberg } = await import('./gotenberg')
const gotenbergMock = vi.mocked(renderPdfViaGotenberg)

afterEach(() => {
  gotenbergMock.mockClear()
})

const PREVIA_PAYLOAD: DocumentPayload = {
  letterhead: {
    hospitalName: 'Hospital Canônico',
    hospitalAddress: null,
    logoDataUri: null,
    commissionName: 'Comissão de Controle de Infecção Hospitalar',
  },
  provenance: {
    kind: 'previa',
    watermark: 'draft',
    generation: { at: '2026-01-02T14:00:00.000Z', byDisplay: 'Maria Fixa' },
  },
  signatures: [],
  containsPhi: false,
  body: {
    kind: 'form_response',
    formTitle: 'Checklist',
    versionNumber: 1,
    respondentDisplay: 'Maria Fixa',
    responseStatus: 'in_progress',
    startedAt: '2026-01-02T12:00:00.000Z',
    submittedAt: null,
    sections: [],
  } satisfies FormResponseDocumentBody,
}

describe('renderPreviaPdf: the render path (ADR 0125 D4)', () => {
  it('returns PDF bytes from the shared pipeline', async () => {
    const pdf = await renderPreviaPdf(PREVIA_PAYLOAD)
    expect(pdf).toBeInstanceOf(Buffer)
    expect(pdf.length).toBeGreaterThan(0)
    expect(gotenbergMock).toHaveBeenCalledTimes(1)
  })

  it('renders the SAME pipeline the emission uses — the HTML carries the prévia footer', async () => {
    // Fidelity (D4): a prévia that does not match the document it previews is not
    // one. Asserting on the HTML handed to Gotenberg proves it went through
    // renderDocumentHtml rather than some second rendering path.
    await renderPreviaPdf(PREVIA_PAYLOAD)
    const html = gotenbergMock.mock.calls[0]?.[0] as string
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<footer class="previa-footer">')
    expect(html).not.toContain('<footer class="qr-footer">')
  })

  it('refuses a REGISTERED payload — the ephemeral path must not serve records', async () => {
    const registered: DocumentPayload = {
      ...PREVIA_PAYLOAD,
      provenance: {
        kind: 'registered',
        watermark: 'final',
        qr: { token: 't'.repeat(32), shortCode: 'ABCDEF2345', url: 'https://x.invalid/verificar/t' },
        emission: { at: '2026-01-02T14:00:00.000Z', byDisplay: 'Maria Fixa' },
      },
    }
    await expect(renderPreviaPdf(registered)).rejects.toThrow(/prévia/i)
    expect(gotenbergMock, 'it must refuse BEFORE rendering').not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// D4 — no bytes at rest, proven structurally against the sibling that uploads
// ---------------------------------------------------------------------------

const HERE = __dirname
const readSrc = (f: string) => readFileSync(join(HERE, f), 'utf8')

/**
 * ⛔ **STRIP COMMENTS BEFORE MATCHING — comments are not code.**
 *
 * This suite's first run reported `previa.ts` as calling `.upload()`. It does
 * not: its header DOCUMENTS that `.upload()` is deliberately never called, and
 * the un-stripped regex matched the WARNING AGAINST the defect and reported it
 * as the defect. `scripts/check-client-server-imports.mjs` carries the identical
 * calibration rule for the identical reason ("Without this rule: 30 findings, 26
 * of them prose") — a source-text detector that skips this step produces a
 * confident false wall that then gets switched off.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

/** Markers for "this module can put bytes somewhere or write the registry". */
const STORAGE_MARKERS = [/\.storage\b/, /\.upload\(/, /\.rpc\(/, /createAdminClient/]

describe('⛔ ADR 0125 D4 — the prévia path reaches NO storage and NO registry', () => {
  const previaSrc = stripComments(readSrc('previa.ts'))
  const mintSrc = stripComments(readSrc('actions.ts'))

  it('the comment stripper does not gut the file it is protecting', () => {
    // If stripComments over-matched and returned near-nothing, every absence
    // assertion below would pass vacuously. Pin that real code survives.
    expect(previaSrc).toContain('export async function renderPreviaPdf')
    expect(previaSrc).toContain('mintSemaphore.run')
    expect(previaSrc).not.toContain('NOT CALLED') // ...and prose did not
  })

  it('previa.ts contains no storage or registry call of any kind', () => {
    for (const marker of STORAGE_MARKERS) {
      expect(marker.test(previaSrc), `previa.ts matches ${marker}`).toBe(false)
    }
  })

  it('⭐ POSITIVE CONTROL: the same markers DO hit the emission path (actions.ts)', () => {
    // Without this, the assertion above is satisfied by four regexes that match
    // nothing anywhere — the "detector that finds nothing must be proven able to
    // find something" rule. actions.ts is the sibling that genuinely uploads and
    // calls mint_printed_document, so every marker must fire there.
    for (const marker of STORAGE_MARKERS) {
      expect(marker.test(mintSrc), `actions.ts does NOT match ${marker} — needle is stale`).toBe(
        true,
      )
    }
  })

  it('previa.ts imports no Supabase client (the ban is structural, not a promise)', () => {
    expect(previaSrc).not.toMatch(/from '@\/lib\/supabase/)
    expect(mintSrc).toMatch(/from '@\/lib\/supabase/) // control
  })

  it('the D9 pool check reads the RAW source, so prose cannot satisfy it', () => {
    // `mintSemaphore` must appear as a CALL, not only in the header prose that
    // explains why the pool is shared.
    expect(stripComments(readSrc('previa.ts'))).toMatch(/mintSemaphore\.run\(/)
  })

  it('⛔ no "temporary upload, delete after" variant exists — D4 rejects it BY NAME', () => {
    // The rejected shape would show up as an upload followed by a remove. The
    // prévia module has neither verb.
    expect(previaSrc).not.toMatch(/\.remove\(/)
    expect(mintSrc).toMatch(/\.remove\(/) // control: the mint DOES clean up orphans
  })
})

// ---------------------------------------------------------------------------
// D9 — contention: one pool, and the prévia is the one that yields
// ---------------------------------------------------------------------------

describe('ADR 0125 D9 — the prévia yields under load', () => {
  it('waits materially less than the emission', () => {
    expect(PREVIA_ACQUIRE_TIMEOUT_MS).toBeLessThan(ACQUIRE_TIMEOUT_MS)
    // "Materially", not "by 1ms" — the ratio is the decision, so pin it.
    expect(PREVIA_ACQUIRE_TIMEOUT_MS * 2).toBeLessThanOrEqual(ACQUIRE_TIMEOUT_MS)
  })

  it('⛔ does NOT reuse the emission busy message — it says "emissão" (reserved verb)', () => {
    expect(MINT_BUSY_MESSAGE).toMatch(/emiss/i) // the reason the split exists
    expect(PREVIA_BUSY_MESSAGE).not.toMatch(/emit|emiss/i)
    expect(PREVIA_BUSY_MESSAGE).toMatch(/prévia/i)
  })

  it('⭐ TWO-SIDED: under saturation the prévia is refused WHILE an emission still acquires', async () => {
    // ⚠ A one-sided "the prévia times out" passes against a pool that refuses
    // EVERYTHING — which would look exactly like D9 working while D9 was broken.
    // The differential is that the same saturated pool, at the same moment, still
    // serves the longer-waiting emission.
    const sem = __createSemaphoreForTests(1)

    let releaseHolder: () => void = () => {}
    const held = new Promise<void>((resolve) => {
      releaseHolder = resolve
    })
    // Occupy the only permit.
    const holder = sem.run(() => held, ACQUIRE_TIMEOUT_MS, MINT_BUSY_MESSAGE)
    await Promise.resolve()

    const previa = sem.run(async () => 'previa', 20, PREVIA_BUSY_MESSAGE)
    const emission = sem.run(async () => 'emission', 5_000, MINT_BUSY_MESSAGE)

    // The prévia's short wait expires first...
    await expect(previa).rejects.toThrow(PREVIA_BUSY_MESSAGE)

    // ...and only then does the permit free. The emission, still waiting, gets it.
    releaseHolder()
    await holder
    await expect(emission).resolves.toBe('emission')
  })

  it('the pool is SHARED and still 3 permits — separate pools were rejected (D9)', async () => {
    // Separate pools would protect emissions by REMOVING the protection on the
    // Gotenberg sidecar, which is what the permit count exists for (ADR 0104 D5).
    const { MINT_CONCURRENCY, mintSemaphore } = await import('./semaphore')
    expect(MINT_CONCURRENCY).toBe(3)
    const previaModule = stripComments(readSrc('previa.ts'))
    expect(previaModule, 'the prévia must use the shared mintSemaphore').toContain('mintSemaphore')
    expect(previaModule, 'no second Semaphore may be constructed here').not.toMatch(
      /new Semaphore|__createSemaphoreForTests/,
    )
    expect(mintSemaphore).toBeDefined()
  })
})
