import { render } from '@testing-library/react'
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

    // NOT a claim that the renderer produced nothing: see the ordinary-Markdown
    // test below, which is what separates "dropped the tag" from "dropped
    // everything".
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
