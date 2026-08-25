import { render } from '@testing-library/react'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'

import { MarkdownRenderer } from '@/components/forms/markdown/markdown-renderer'
import {
  MARKDOWN_SANITIZE_SCHEMA,
  PDF_MARKDOWN_SANITIZE_SCHEMA,
} from '@/lib/markdown/sanitize-schema'
import { renderMarkdown } from '@/lib/pdf/markdown'

/**
 * C-2 — the print pipeline must not let author Markdown make the SERVER fetch.
 *
 * `renderMarkdown` feeds Gotenberg, a headless Chromium on the server network, so
 * `![](https://attacker/x)` in a case narrative is an outbound GET on every prévia
 * and every mint: SSRF reach, a per-render exfil beacon on a Rule 12 document, and a
 * `content_hash` that stops being a function of our own data. The fix drops `<img>`
 * from the PRINT schema only.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ WHY THIS SUITE IS A DIFFERENTIAL AND NOT AN ASSERTION ABOUT THE FIX
 * ═══════════════════════════════════════════════════════════════════════════
 * "No `<img>` in the print output" is satisfied by a great many wrong programs: a
 * renderer that returns `''`, a schema narrowed to nothing, a payload the parser
 * never turned into an image, or — worst — the same narrowing applied to BOTH
 * surfaces, which would silently strip images from every screen in the product.
 * So the same payload runs through both production paths and the assertions name
 * the DIRECTION: gone on paper, still there on screen. That also pins the
 * narrowing as deliberate and one-directional, which is the property the shared
 * schema's own docblock claims and cannot itself prove.
 *
 * ⚠ Both arms are the real production paths — `renderMarkdown` itself, and the
 * `MarkdownRenderer` component itself — not reconstructed pipelines. A
 * reconstruction proves a claim about the test file.
 *
 * ⚠ This suite is the ONE documented exception to its neighbour
 * `src/components/forms/markdown/sanitize-equivalence.test.ts`, which asserts the
 * screen policy is byte-identical to its pre-extraction baseline. That remains
 * true: the narrowing is a DERIVED schema, so the shared constant is unchanged.
 */

/** The beacon. One payload, both arms — a differential needs the same input. */
const BEACON_MD = '![beacon](https://attacker.example/x.png)'
const BEACON_HOST = 'attacker.example'

describe('C-2 — <img> is dropped on paper and kept on screen', () => {
  it('⭐ PRINT: the beacon yields no <img> and no attacker host at all', () => {
    const html = renderMarkdown(BEACON_MD)

    // The element that performs the fetch.
    expect(html).not.toContain('<img')
    // ...and the URL itself, wherever it might have survived — an `alt`, a title,
    // a text node. The host is what an exfil beacon needs; the tag is only how it
    // gets there today.
    expect(html).not.toContain(BEACON_HOST)

    // NOT a claim that the renderer produced nothing: the marker stands in its
    // place, and the ordinary-Markdown test below separates "dropped the tag"
    // from "dropped everything".
    expect(html).toContain('imagem não incluída na versão impressa')

    // ⚠ WHAT THIS TEST NOW PROVES, AND WHAT IT NO LONGER PROVES ALONE. Two
    // independent layers strip the `<img>`: the placeholder transform removes the
    // node, and the sanitize schema would remove it anyway. So this assertion
    // measures the COMPOSITION. Neutralizing the schema by itself leaves it GREEN
    // — the transform masks it — which is exactly the shape that turns a keystone
    // vacuous without anyone noticing. The schema keeps its OWN failing proof in
    // the two structural tests below and in the isolated layer probe; do not
    // delete those on the grounds that this one covers the same ground.
  })

  it('⭐ CONTROL: the SAME payload still renders an <img> on SCREEN', () => {
    // This is what makes the assertion above a finding rather than a tautology.
    // If this arm ever goes red, the narrowing leaked onto the screen policy and
    // author images vanished from the whole product.
    const { container } = render(<MarkdownRenderer content={BEACON_MD} />)

    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    // Read off the element, not optional-chained into a matcher that passes on
    // `undefined`: `toBe` on a concrete string fails for a missing element too.
    expect(img?.getAttribute('src')).toBe('https://attacker.example/x.png')
    expect(container.innerHTML).toContain(BEACON_HOST)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // The visible marker (PO ruling): announcing an omission and silently making it
  // are different postures, and a reader comparing screen to paper had no way to
  // know anything had been there.
  //
  // ⚠ The expected strings are written out LONGHAND, deliberately. Importing the
  // constant from the implementation would make these tests agree with whatever
  // the implementation says — including a typo, or a future "improvement" into
  // English. This is the pt-BR copy, pinned.
  // ───────────────────────────────────────────────────────────────────────────
  const WITH_ALT = '<em>[imagem não incluída na versão impressa: Radiografia do tórax]</em>'
  const BARE = '<em>[imagem não incluída na versão impressa]</em>'

  it('⭐ PLACEHOLDER: the alt text is printed when the author wrote one', () => {
    expect(renderMarkdown('![Radiografia do tórax](https://a.example/x.png)')).toBe(
      `<p>${WITH_ALT}</p>`,
    )
  })

  it('⭐ PLACEHOLDER: the same sentence, without the colon clause, when there is no alt', () => {
    // All three ways of writing "no description": absent, empty, whitespace. A
    // whitespace-only alt printing `[…: ]` would be a visible defect on paper.
    for (const md of [
      '![](https://a.example/x.png)',
      '![   ](https://a.example/x.png)',
      '![](https://a.example/x.png "Radiografia")',
    ]) {
      expect(renderMarkdown(md), md).toBe(`<p>${BARE}</p>`)
    }
  })

  it('⭐ PLACEHOLDER: both SHAPES survive — no empty <p>, and the sentence still reads', () => {
    // The two cases measured before the fix: an image-only paragraph printed as
    // `<p></p>`, and an inline image left `<p>Antes  depois.</p>` with a double
    // space and nothing to explain the gap.
    const alone = renderMarkdown('![Radiografia do tórax](https://a.example/x.png)')
    expect(alone).not.toContain('<p></p>')
    expect(alone).toContain(WITH_ALT)

    const inline = renderMarkdown(
      'Antes ![Radiografia do tórax](https://a.example/x.png) depois.',
    )
    expect(inline).toBe(`<p>Antes ${WITH_ALT} depois.</p>`)
  })

  it('⛔ PLACEHOLDER: the src is NEVER emitted, in any shape', () => {
    // A URL on paper invites a reader to type it in, which hands the beacon the
    // click the renderer was just denied. The marker describes; it never links.
    for (const md of [
      BEACON_MD,
      `Antes ${BEACON_MD} depois.`,
      '![](https://attacker.example/x.png)',
      `[um link](https://attacker.example/page) e ${BEACON_MD}`,
    ]) {
      const html = renderMarkdown(md)
      expect(html, md).not.toContain('x.png')
      expect(html, md).not.toContain('<img')
    }
    // The link in the last payload proves the loop above is not "strips every
    // URL": an `<a href>` is user-initiated navigation and correctly survives.
    expect(renderMarkdown(`[um link](https://attacker.example/page) e ${BEACON_MD}`)).toContain(
      'https://attacker.example/page',
    )
  })

  it('⭐ PLACEHOLDER: reference images too — the reason the seam is hast, not mdast', () => {
    // `![alt][ref]` parses to `imageReference`, NOT `image`, and only becomes an
    // `img` during remark-rehype. A mdast `image` visitor would print a marker
    // for one syntax and silently drop this one — the exact defect the PO ruling
    // exists to remove, reintroduced through the back door.
    const html = renderMarkdown(
      'Veja ![Radiografia do tórax][ref] agora.\n\n[ref]: https://attacker.example/x.png\n',
    )

    expect(html).toBe(`<p>Veja ${WITH_ALT} agora.</p>`)
    expect(html).not.toContain(BEACON_HOST)
  })

  it('⛔ PLACEHOLDER: an author-written alt is escaped, not injected', () => {
    // The alt is author-controlled text travelling into the printed document. It
    // lands in a hast TEXT node, so rehype-stringify escapes it — but that is a
    // property worth pinning, because "put the alt on paper" is the kind of
    // change someone later reimplements with string concatenation.
    const html = renderMarkdown('![<script>alert(1)</script>](https://a.example/x.png)')

    expect(html).not.toContain('<script>')
    expect(html).toContain('&#x3C;script>')
  })

  it('⭐ LAYER PROBE: the sanitize schema still strips <img> on its own', () => {
    // ⚠ WHY THIS RECONSTRUCTS THE PIPELINE, against this file's own advice. The
    // placeholder transform now removes `img` nodes BEFORE the sanitizer sees
    // them, so no input through `renderMarkdown` can still prove the schema is
    // doing anything — its behavioural proof was silently swallowed by the fix
    // that sits in front of it. This runs the chain MINUS the transform so the
    // backstop keeps a test that can fail. It is a deliberate LAYER probe, and
    // the only reconstruction in this file.
    //
    // ⛔ If this ever goes green with `img` restored to the schema, the sanitizer
    // has stopped being a second line of defence and the transform is alone.
    const html = String(
      unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype)
        .use(rehypeSanitize, PDF_MARKDOWN_SANITIZE_SCHEMA)
        .use(rehypeStringify)
        .processSync(BEACON_MD),
    )

    expect(html).not.toContain('<img')
    expect(html).not.toContain(BEACON_HOST)
    // ...and with the SCREEN schema the same chain keeps the image, so the
    // assertion above is about the policy and not about the chain.
    const screenHtml = String(
      unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype)
        .use(rehypeSanitize, MARKDOWN_SANITIZE_SCHEMA)
        .use(rehypeStringify)
        .processSync(BEACON_MD),
    )
    expect(screenHtml).toContain('<img')
    expect(screenHtml).toContain(BEACON_HOST)
  })

  it('⛔ PRINT: the narrowing is the TAG, not the renderer', () => {
    // Guards the fail-closed derivation (`?? []` / `?? {}` on tagNames /
    // attributes): an empty allowlist would satisfy the first test perfectly and
    // blank every dossier.
    const html = renderMarkdown(
      '## Conclusão\n\nTexto com **negrito**, [um link](https://ok.test/a) e `código`.\n\n| a | b |\n| - | - |\n| 1 | 2 |\n',
    )

    expect(html).toContain('<h2>')
    expect(html).toContain('<strong>')
    expect(html).toContain('<code>')
    expect(html).toContain('<td>')
    // The URL protocols came along with the derivation — a link is still a link.
    expect(html).toContain('https://ok.test/a')
  })

  it('⛔ PRINT: the inherited protocol hardening survived the derivation', () => {
    // A derived schema is one spread away from losing the base's `protocols`
    // override, and that loss is invisible to every assertion above.
    for (const md of [
      '[a](javascript:alert(1))',
      '[a](data:text/html,<script>alert(1)</script>)',
      '[a](irc://example.test/chan)',
    ]) {
      expect(renderMarkdown(md), md).not.toMatch(/javascript:|data:text\/html|irc:/)
    }
    // ...and the allowed ones still pass, so the line above is not "strips all".
    expect(renderMarkdown('[a](mailto:x@y.test)')).toContain('mailto:x@y.test')
  })

  it('⛔ STRUCTURAL: paper narrows by exactly one tag, and screen keeps it', () => {
    // ⚠ The `?? []` is on the SHARED schema, whose type is `Schema` (every key
    // optional). It cannot make anything below vacuous: an empty list fails
    // `toContain('img')` on the very next line, so a nullish screen policy reds
    // this test rather than passing it.
    const paperTags: readonly string[] = PDF_MARKDOWN_SANITIZE_SCHEMA.tagNames
    const screenTags: readonly string[] = MARKDOWN_SANITIZE_SCHEMA.tagNames ?? []

    // The screen policy is untouched — the narrowing is derived, not an edit.
    expect(screenTags).toContain('img')
    expect(paperTags).not.toContain('img')

    // Exactly one tag of difference: a wider diff means someone narrowed more
    // than this fix documents, and the docblock stops being true.
    expect(screenTags.filter((t) => !paperTags.includes(t))).toEqual(['img'])
    expect(paperTags.filter((t) => !screenTags.includes(t))).toEqual([])

    // The attribute entry went with it. Dropping the tag is what removes the
    // element; a surviving `attributes.img` would read as "img is allowed,
    // narrowly" — the opposite of the policy.
    expect(Object.keys(MARKDOWN_SANITIZE_SCHEMA.attributes ?? {})).toContain('img')
    expect(Object.keys(PDF_MARKDOWN_SANITIZE_SCHEMA.attributes)).not.toContain('img')
  })

  it('⭐ no attribute the PRINT schema still permits triggers a render-time fetch', () => {
    // This is the CHECKED form of the sentence now standing in
    // `src/lib/pdf-mint/gotenberg.ts` and `docs/deployment/pdf-renderer.md`. Those
    // used to assert "the renderer fetches nothing" and went stale in silence for a
    // whole phase. Enumerating the surviving attributes is what lets the claim red.
    //
    // ⚠ HONEST BOUND. `RENDER_FETCHING` is a hand-list, so this test can only
    // under-report — it is not a proof that no unknown attribute fetches. What it
    // does guarantee is that the KNOWN fetchers cannot reappear silently, e.g. if a
    // future `hast-util-sanitize` adds `poster`/`background`/`data` to the defaults.
    const RENDER_FETCHING = [
      'src',
      'srcSet',
      'poster',
      'background',
      'data',
      'manifest',
      'formAction',
      'codeBase',
      'classId',
      'archive',
      'profile',
      'icon',
      'lowSrc',
      'dynSrc',
    ]

    /** Every attribute name reachable on a tag the schema allows. */
    function reachableAttributeNames(schema: {
      tagNames: readonly string[]
      attributes: Readonly<Record<string, readonly unknown[]>>
    }): Set<string> {
      const names = new Set<string>()
      for (const [tag, list] of Object.entries(schema.attributes)) {
        if (tag !== '*' && !schema.tagNames.includes(tag)) continue
        for (const definition of list) {
          names.add(String(Array.isArray(definition) ? definition[0] : definition))
        }
      }
      return names
    }

    const paper = reachableAttributeNames({
      tagNames: PDF_MARKDOWN_SANITIZE_SCHEMA.tagNames,
      attributes: PDF_MARKDOWN_SANITIZE_SCHEMA.attributes,
    })
    const screen = reachableAttributeNames({
      tagNames: MARKDOWN_SANITIZE_SCHEMA.tagNames ?? [],
      attributes: MARKDOWN_SANITIZE_SCHEMA.attributes ?? {},
    })

    // POSITIVE CONTROL, and the reason this is not a vacuous filter: the SAME
    // predicate over the SAME code finds `src` on the screen policy. A predicate
    // that found nothing on either side would prove only that it matches nothing.
    expect([...screen].filter((n) => RENDER_FETCHING.includes(n)).sort()).toEqual([
      'src',
      'srcSet',
    ])

    // On paper only `srcSet` survives — allowed on `source`, which no Markdown
    // syntax can emit (asserted behaviourally in the next test). ⛔ Any other name
    // appearing here is a live outbound-request surface inside Gotenberg.
    expect([...paper].filter((n) => RENDER_FETCHING.includes(n)).sort()).toEqual([
      'srcSet',
    ])

    // `<a href>` deliberately survives and is NOT in the list above: a link in a PDF
    // is navigation the reader initiates, not a fetch the renderer performs. Pinned
    // so nobody "hardens" it away while reading this file.
    expect(paper.has('href')).toBe(true)
  })

  it('⚠ DORMANT SIBLING: `srcSet` on `source` is allowed and NOT protocol-filtered', () => {
    // Not a defect today and not asserted as one. This pins the two facts that
    // make the schema docblock's warning true, so that if a future
    // `hast-util-sanitize` starts filtering `srcSet` — or stops allowing
    // `source` — the warning is found stale instead of believed forever.
    // ⛔ If this goes red, re-read the note beside PDF_MARKDOWN_SANITIZE_SCHEMA
    // before touching it: the note, not this test, may be the thing to change.
    expect(Object.keys(PDF_MARKDOWN_SANITIZE_SCHEMA.protocols)).not.toContain('srcSet')
    expect(PDF_MARKDOWN_SANITIZE_SCHEMA.attributes.source).toContain('srcSet')
    expect(PDF_MARKDOWN_SANITIZE_SCHEMA.tagNames).toContain('source')

    // And the reason it is inert: Markdown cannot emit those tags, and raw HTML
    // is dropped before the sanitizer runs.
    const html = renderMarkdown(
      '<picture><source srcset="https://attacker.example/beacon"></picture>',
    )
    expect(html).not.toContain(BEACON_HOST)
    expect(html).not.toContain('<source')
  })
})
