import { describe, expect, it } from 'vitest'

import { renderPreviaFooter } from './previa-footer'
import { renderQrFooter } from './qr-footer'
import { esc } from '../escape'
import { formatDateTime } from '../format'
import type { DocumentEmission, DocumentGeneration, DocumentQr } from '../types'

/**
 * ADR 0125 D5 — the prévia footer states the page's status IN WORDS and keeps
 * provenance, and the reserved verb `Emitido` must not appear on it.
 *
 * ⛔ **EVERY ABSENCE ASSERTION HERE CARRIES A POSITIVE CONTROL.** "The output does
 * not contain X" is satisfied forever by a renderer that returns `""`, by a typo
 * in the needle, and by a needle no footer would ever contain. The control is the
 * SIBLING primitive: `renderQrFooter` must contain exactly the strings
 * `renderPreviaFooter` must not. That makes each pair a differential rather than
 * a one-sided claim.
 */

const GENERATION: DocumentGeneration = {
  at: '2026-01-02T14:00:00.000Z',
  byDisplay: 'Maria Fixa',
}

const QR: DocumentQr = {
  token: 'FIXTURETOKENAAAABBBBCCCCDDDDEEEE',
  shortCode: 'ABCDEF2345',
  url: 'https://example.invalid/verificar/FIXTURETOKENAAAABBBBCCCCDDDDEEEE',
}

const EMISSION: DocumentEmission = { at: '2026-01-02T14:00:00.000Z', byDisplay: 'Maria Fixa' }

/**
 * The reserved-verb family (ADR 0125 D5 + Consequences: *"`Emitido` becomes a
 * reserved verb in the UI vocabulary — it names the registered act only"*).
 * Matches `Emitido`/`emitida`/`emitir`/`emissão` so a future rewording cannot
 * slip past a needle pinned to one inflection.
 */
const RESERVED_VERB = /emit|emiss/i

/**
 * ⭐ **The rule governs the TEMPLATE's vocabulary, not payload data — and this
 * helper exists because the naive version of this suite was WRONG.**
 *
 * Its first fixture used the actor name `João Emissor` (borrowed from
 * `fingerprint.test.ts`), so `RESERVED_VERB` matched the PERSON'S NAME and the
 * absence check failed against a footer that never said "emitido". The mirror of
 * that mistake is the dangerous one: a display name containing the verb would
 * also make a broken template PASS a `toContain` check for the wrong reason.
 *
 * ADR 0125 D5 reserves the verb for what the PLATFORM says about the page. A
 * member named "Emissor" is not the platform claiming emission. So the needle is
 * applied to the output with the payload-sourced substitutions removed.
 */
const templateTextOf = (html: string, g: DocumentGeneration): string =>
  html.replaceAll(esc(g.byDisplay), '').replaceAll(esc(formatDateTime(g.at)), '')

/** The QR block's own markers — dropping the QR must not silently drop these. */
const VERIFICATION_CODE_LABEL = 'Código de verificação:'
const QR_SVG = '<svg'

describe('renderPreviaFooter (ADR 0125 D5)', () => {
  const html = renderPreviaFooter(GENERATION)

  it('renders deterministically', () => {
    expect(renderPreviaFooter(GENERATION)).toBe(renderPreviaFooter(GENERATION))
  })

  it('is non-empty and renders its own footer element', () => {
    // Without this, every `not.toContain` below is satisfied by the empty string.
    expect(html.length).toBeGreaterThan(0)
    expect(html).toContain('<footer class="previa-footer">')
  })

  it('⛔ does NOT use the reserved verb — the page never claims to be emitted', () => {
    const template = templateTextOf(html, GENERATION)
    expect(RESERVED_VERB.test(template), `reserved verb found in: ${template}`).toBe(false)
  })

  it('the verb rule applies to the TEMPLATE, not to a member whose NAME contains it', () => {
    // A display name is payload data. Someone named "Emissor" must still get a
    // prévia, and their name must not be mistaken for the platform's claim —
    // in either direction (see templateTextOf's note: this suite got it wrong once).
    const g: DocumentGeneration = { ...GENERATION, byDisplay: 'Emissor Emissivo' }
    const out = renderPreviaFooter(g)
    expect(out).toContain('Emissor Emissivo') // the name renders, unaltered
    expect(RESERVED_VERB.test(templateTextOf(out, g))).toBe(false) // the template stays clean
    expect(RESERVED_VERB.test(out), 'the naive whole-output check would false-positive here').toBe(
      true,
    )
  })

  it('⛔ carries NO QR and NO verification code — it is not verifiable', () => {
    expect(html).not.toContain(QR_SVG)
    expect(html).not.toContain(VERIFICATION_CODE_LABEL)
    expect(html).not.toContain('/verificar/')
  })

  it('STATES the page status in words (pt-BR)', () => {
    expect(html).toContain('PRÉVIA — sem valor de registro, não verificável.')
  })

  it('⭐ KEEPS provenance — dropping the QR must not drop who generated it, and when', () => {
    // The whole reason this is a sibling primitive rather than "the QR footer
    // minus the QR": qr-footer renders the code AND the provenance as one block.
    // Hardcoded, not recomputed via formatDateTime: recomputing would make the
    // assertion agree with whatever the formatter does. 14:00Z renders as 11:00
    // in America/Sao_Paulo — the zone the paper is read in (format.ts).
    expect(html).toContain('Gerada em 02/01/2026 11:00 por Maria Fixa.')
  })

  it('escapes payload-sourced text (Rule 7 — the renderer is the XSS surface)', () => {
    const hostile = renderPreviaFooter({
      ...GENERATION,
      byDisplay: '<script>alert("x")</script>',
    })
    expect(hostile).not.toContain('<script>')
    expect(hostile).toContain('&lt;script&gt;')
  })

  it('conveys its status by TEXT, not by colour alone', () => {
    // The scoped style tints the status line, but the sentence carries the whole
    // meaning — a greyscale print and a screen reader both get it.
    const withoutStyle = html.replace(/<style>[\s\S]*?<\/style>/, '')
    expect(withoutStyle).toContain('sem valor de registro, não verificável')
  })

  it('pins the exact READABLE text of the page (ADR 0125 D5 governs the words)', () => {
    // Grain choice: the rendered TEXT, not a hash of the markup. A hash would red
    // on any CSS tweak and be silenced by updating a number — but this footer has
    // no TEMPLATE_VERSION to make that a deliberate decision (a prévia is never
    // stored and records no template metadata). The words ARE the decision, so
    // they are what is pinned; a reviewer can read the assertion and check it
    // against the ADR.
    const text = html
      .replace(/<style>[\s\S]*?<\/style>/, '')
      .replace(/<[^>]+>/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    expect(text).toEqual([
      'PRÉVIA — sem valor de registro, não verificável.',
      'Gerada em 02/01/2026 11:00 por Maria Fixa.',
    ])
  })

  it('scopes its CSS to itself (the shared PRINT_CSS is part of every document hash)', () => {
    // Putting these rules in `render.ts`'s PRINT_CSS would move both committed
    // template fingerprints and force TEMPLATE_VERSION bumps on two templates
    // whose layout did not change. Same shape as documents/meeting.ts.
    expect(html).toContain('<style>')
    expect(html).toContain('.previa-footer {')
  })
})

describe('⭐ POSITIVE CONTROL — the sibling primitive contains what the prévia must not', () => {
  const qrHtml = renderQrFooter(QR, EMISSION)

  it('renderQrFooter DOES use the reserved verb (so the absence check has a real target)', () => {
    // If this ever goes red, the `not.toContain` above stopped meaning anything:
    // either the needle is wrong or the registered footer lost its provenance line.
    // Measured through the SAME template-only filter, so the control proves the
    // TEMPLATE says it — not the fixture's actor name.
    expect(RESERVED_VERB.test(templateTextOf(qrHtml, EMISSION))).toBe(true)
    expect(qrHtml).toContain('Emitido em ')
  })

  it('renderQrFooter DOES carry the QR and the verification code', () => {
    expect(qrHtml).toContain(QR_SVG)
    expect(qrHtml).toContain(VERIFICATION_CODE_LABEL)
    expect(qrHtml).toContain('/verificar/')
  })

  it('the two footers are mutually exclusive markup — neither can be mistaken for the other', () => {
    const previaHtml = renderPreviaFooter(GENERATION)
    expect(qrHtml).not.toContain('previa-footer')
    expect(previaHtml).not.toContain('qr-footer')
  })
})
