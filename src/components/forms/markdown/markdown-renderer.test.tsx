import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MarkdownRenderer } from './markdown-renderer'

/**
 * The Rule 7 (stored-XSS) contract for the platform's ONE sanitizing Markdown
 * renderer.
 *
 * WHY THIS FILE EXISTS. Under plan amendment A11 this component is the ENTIRE
 * Rule 7 defense: registro and narrative bodies are stored verbatim,
 * `saveNarrativeBody` sanitizes nothing, and there is no write-time net. QA
 * (MINOR-2) showed that removing `rehypeSanitize` or adding `rehype-raw` left
 * lint, typecheck, vitest, pgTAP and the full E2E gate green — the one E2E
 * assertion on this path only checks that a `<strong>` renders, which survives
 * both changes by construction. The single control protecting every stored body
 * had no coverage that could fail.
 *
 * ⚠ WHICH CASE CATCHES WHICH REGRESSION — MEASURED by mutation, not reasoned.
 * The obvious tests here are the useless ones, so each case states its power:
 *
 *   - `rehypeSanitize` removed        → caught ONLY by the `irc:` / `xmpp:` cases
 *                                       in §3. Everything else survives, because
 *                                       react-markdown v10's own
 *                                       `defaultUrlTransform` — not this
 *                                       component — is what neutralizes
 *                                       `javascript:`, `vbscript:`, `data:`,
 *                                       `ftp:` and `tel:`. Deleting the sanitizer
 *                                       changes NOTHING else observable in the
 *                                       current pipeline. That is why QA could
 *                                       remove it and keep every gate green.
 *   - raw HTML made live (rehype-raw) → caught ONLY by §2, and only because §2
 *                                       uses tags the sanitize schema ALLOWS
 *                                       (`b`, `em`, `a`, `img`). A `<script>`
 *                                       probe cannot catch it: sanitize strips
 *                                       `script` on the way out, so the
 *                                       observable never changes.
 *   - `<script>` / `onerror` (§1)     → DEFENSE-IN-DEPTH pins. They fail only if
 *                                       BOTH layers break at once. Kept
 *                                       deliberately, labelled honestly rather
 *                                       than left to read as coverage they do
 *                                       not provide.
 *
 * The standing lesson: the sanitizer is REDUNDANT today and load-bearing the
 * moment anyone enables raw HTML. Its removal is nearly unobservable, so §2 —
 * not §1 or §3 — is what actually protects stored bodies.
 *
 * The §4 positive controls exist so none of the above can be satisfied by a
 * renderer that has simply stopped rendering.
 */

function renderMd(source: string): HTMLElement {
  return render(<MarkdownRenderer content={source} />).container
}

/** Every attribute name present anywhere in the rendered tree, lowercased. */
function allAttributeNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll('*')].flatMap((el) =>
    el.getAttributeNames().map((n) => n.toLowerCase()),
  )
}

describe('MarkdownRenderer — Rule 7 sanitization contract', () => {
  // -------------------------------------------------------------------------
  // §1 Script tags and event handlers (defense-in-depth; see the header note)
  // -------------------------------------------------------------------------

  it('never produces a script element from a <script> tag in the source', () => {
    const container = renderMd('Antes <script>alert("xss")</script> depois')
    expect(container.querySelector('script')).toBeNull()
    // …and the payload must not survive as executable-looking markup anywhere.
    expect(container.innerHTML).not.toContain('<script')
  })

  it('never produces a script element from an encoded/spaced script variant', () => {
    const container = renderMd('<SCRIPT SRC="https://evil.test/x.js"></SCRIPT>')
    expect(container.querySelector('script')).toBeNull()
    expect(container.innerHTML.toLowerCase()).not.toContain('<script')
  })

  it('never lets an event-handler attribute reach a rendered element', () => {
    const container = renderMd(
      '<img src="x" onerror="alert(1)"> <div onclick="alert(2)">hi</div>',
    )
    const handlers = allAttributeNames(container).filter((n) =>
      n.startsWith('on'),
    )
    expect(handlers).toEqual([])
  })

  // -------------------------------------------------------------------------
  // §2 Raw HTML is never live markup — what the ABSENCE of rehype-raw buys.
  //    These use tags the sanitize schema ALLOWS (b, em, a, img), which is the
  //    whole point: a disallowed tag would be stripped by the sanitizer either
  //    way and could not distinguish the two layers.
  // -------------------------------------------------------------------------

  it('renders raw inline HTML as text, not as elements (allowed tags included)', () => {
    const container = renderMd('<b>negrito</b> e <em>enfase</em>')
    // The tags must NOT become elements…
    expect(container.querySelector('b')).toBeNull()
    expect(container.querySelector('em')).toBeNull()
    // …while the text survives, so this is "inert", not "swallowed" (a renderer
    // that dropped everything would otherwise satisfy the assertions above).
    expect(container.textContent).toContain('negrito')
    expect(container.textContent).toContain('enfase')
  })

  it('does not turn a raw <a> tag into a live link', () => {
    const container = renderMd('<a href="https://evil.test">clique</a>')
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('clique')
  })

  it('does not turn a raw <img> tag into a live image', () => {
    // `img` IS in the sanitize allowlist, so if raw HTML ever became live this
    // element would render — with an attacker-chosen `src` that passes the
    // protocol filter. Nothing else in this file would notice.
    const container = renderMd(
      '<img src="https://evil.test/track.gif" alt="x">',
    )
    expect(container.querySelector('img')).toBeNull()
  })

  // -------------------------------------------------------------------------
  // §3 URL protocols — what rehype-sanitize buys. The ONLY cases that notice
  //    when the sanitizer is removed.
  // -------------------------------------------------------------------------

  it('strips a javascript: href from a genuine markdown link', () => {
    const container = renderMd('[clique](javascript:alert(1))')
    const anchor = container.querySelector('a')
    // The anchor itself still renders (the link syntax is legitimate markdown);
    // it is the DANGEROUS URL that must not survive.
    expect(anchor).not.toBeNull()
    expect(anchor?.getAttribute('href') ?? '').not.toMatch(/^javascript:/i)
    expect(container.innerHTML.toLowerCase()).not.toContain('javascript:')
  })

  it('strips a data: src from a genuine markdown image', () => {
    const container = renderMd(
      '![alt](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
    )
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src') ?? '').not.toMatch(/^data:/i)
    expect(container.innerHTML.toLowerCase()).not.toContain('data:text/html')
  })

  it('strips a vbscript: href (a non-obvious protocol the allowlist excludes)', () => {
    const container = renderMd('[clique](vbscript:msgbox(1))')
    expect(container.innerHTML.toLowerCase()).not.toContain('vbscript:')
  })

  it('strips an irc: href — THE case that fails when rehypeSanitize is removed', () => {
    // ⚠ MEASURED, not assumed. A battery diff of the rendered output with and
    // without `rehypeSanitize` showed that `javascript:`, `vbscript:`, `data:`,
    // `ftp:` and `tel:` are ALL neutralized by react-markdown v10's own
    // `defaultUrlTransform` — the three cases above therefore stay green with the
    // sanitizer deleted, and pin react-markdown's behaviour rather than ours.
    //
    // `irc:`/`ircs:`/`xmpp:` are the exception: they are IN react-markdown's safe
    // protocol list and are excluded only by this component's hardened
    // `SANITIZE_SCHEMA` (`href: ["http", "https", "mailto"]`). So this case — and,
    // in the current pipeline, ONLY this case — is what makes removing the
    // sanitizer observable. If a future react-markdown drops those protocols from
    // its default too, this test goes vacuous and the sanitizer becomes
    // unfalsifiable again; re-run the battery diff before trusting it.
    const container = renderMd('[chat](irc://chat.test/sala)')
    expect(container.innerHTML.toLowerCase()).not.toContain('irc://')
  })

  it('strips an xmpp: href (the same allowlist gap as irc:)', () => {
    const container = renderMd('[chat](xmpp:alguem@test)')
    expect(container.innerHTML.toLowerCase()).not.toContain('xmpp:')
  })

  // -------------------------------------------------------------------------
  // §4 Positive controls — "sanitized" must be distinguishable from "rendered
  //    nothing at all". Without these, deleting the component body would pass
  //    every assertion above.
  // -------------------------------------------------------------------------

  it('still renders legitimate markdown emphasis', () => {
    const container = renderMd('**negrito** e *italico*')
    expect(container.querySelector('strong')?.textContent).toBe('negrito')
    expect(container.querySelector('em')?.textContent).toBe('italico')
  })

  it('still renders headings, lists and code', () => {
    const container = renderMd('# Titulo\n\n- um\n- dois\n\n`codigo`')
    expect(container.querySelector('h1')?.textContent).toBe('Titulo')
    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(container.querySelector('code')?.textContent).toBe('codigo')
  })

  it('PRESERVES a safe https href — the protocol filter is selective, not total', () => {
    // The paired control for §3: without this, "no javascript: href" would also
    // pass if hrefs were being dropped wholesale, and the link feature could
    // silently die while the security tests stayed green.
    const container = renderMd('[ok](https://example.test/pagina)')
    const anchor = container.querySelector('a')
    expect(anchor?.getAttribute('href')).toBe('https://example.test/pagina')
  })

  it('PRESERVES a mailto href (allowlisted alongside http/https)', () => {
    const container = renderMd('[email](mailto:qualidade@example.test)')
    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      'mailto:qualidade@example.test',
    )
  })

  it('opens author links in a new tab with a safe rel', () => {
    const container = renderMd('[ok](https://example.test/pagina)')
    const anchor = container.querySelector('a')
    expect(anchor?.getAttribute('target')).toBe('_blank')
    expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer nofollow')
  })
})
