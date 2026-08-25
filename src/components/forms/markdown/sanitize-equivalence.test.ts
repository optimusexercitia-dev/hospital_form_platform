import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

import { MARKDOWN_SANITIZE_SCHEMA } from '@/lib/markdown/sanitize-schema'

/**
 * F5 — proof that repointing the SCREEN renderer at the extracted schema is a
 * repoint and not a policy change (Architecture Rule 7).
 *
 * ⭐ **Why this is behavioural and not a deep-equal.** Two sanitize schemas can
 * be structurally different and behave identically (key order, an override that
 * restates a default), and — far worse — can *look* identical while differing in
 * one nested array nobody reads to the end. What Rule 7 cares about is the OUTPUT
 * for hostile input, so that is what is compared: the same payloads through both
 * policies, byte-for-byte.
 *
 * ⚠ **The asymmetry is the whole point.** These two policies govern the same
 * author-supplied content on two surfaces. Paper STRICTER than screen is
 * cosmetic. Paper LOOSER than screen is a security hole — content the platform
 * judged unsafe on screen, rendered into a document that is stored, downloaded
 * and handed to an external auditor. So this suite asserts equality, and the
 * payload list leans on the loosening direction.
 *
 * `COMPONENT_SCHEMA_AT_HEAD` is the literal the screen renderer carried before
 * F5 deleted it, kept here verbatim. It is the BASELINE the repoint is measured
 * against; ⛔ never "update" it to match a changed policy — that would make the
 * test agree with any future divergence, which is the one thing it exists to
 * prevent.
 */
const COMPONENT_SCHEMA_AT_HEAD = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
  },
} satisfies typeof defaultSchema

function render(markdown: string, schema: unknown): string {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeSanitize, schema as never)
      .use(rehypeStringify)
      .processSync(markdown),
  )
}

/** Hostile + ordinary inputs. The hostile ones are weighted toward the
 * LOOSENING direction: a protocol or attribute that should be stripped. */
const PAYLOADS: [string, string][] = [
  ['javascript href', '[clique](javascript:alert(1))'],
  ['data href', '[clique](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)'],
  ['vbscript href', '[clique](vbscript:msgbox(1))'],
  ['data image src', '![x](data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Pi4uLjwvc2NyaXB0Pjwvc3ZnPg==)'],
  ['javascript image src', '![x](javascript:alert(1))'],
  ['mailto href (allowed)', '[mail](mailto:a@b.test)'],
  ['http href (allowed)', '[link](http://example.test/a)'],
  ['https image (allowed)', '![alt](https://example.test/a.png)'],
  ['irc href (dropped by both)', '[irc](irc://example.test/chan)'],
  ['xmpp href (dropped by both)', '[xmpp](xmpp:a@b.test)'],
  ['raw script tag', 'antes <script>alert(1)</script> depois'],
  ['img onerror', 'antes <img src=x onerror=alert(1)> depois'],
  ['style attribute', '<p style="position:fixed;top:0">x</p>'],
  ['iframe', '<iframe src="https://evil.test"></iframe>'],
  ['svg onload', '<svg onload=alert(1)></svg>'],
  ['event handler on link', '<a href="https://ok.test" onclick="alert(1)">x</a>'],
  ['gfm table', '| a | b |\n| - | - |\n| 1 | 2 |'],
  ['heading + emphasis', '## Resumo\n\nTexto com **negrito** e *itálico*.'],
  ['list + code', '- um\n- dois\n\n`inline` e\n\n```\nbloco\n```'],
  ['blockquote + hr', '> citação\n\n---'],
  ['autolink', 'veja https://example.test/x'],
  ['footnote-ish gfm', 'texto[^1]\n\n[^1]: nota'],
]

describe('F5 — the extracted schema is the component policy, unchanged', () => {
  it('⭐ produces byte-identical HTML for every payload', () => {
    // Unconditional first: an empty payload list would make the loop vacuous.
    expect(PAYLOADS.length).toBeGreaterThanOrEqual(20)

    const diffs: string[] = []
    for (const [name, md] of PAYLOADS) {
      const fromLib = render(md, MARKDOWN_SANITIZE_SCHEMA)
      const fromComponent = render(md, COMPONENT_SCHEMA_AT_HEAD)
      if (fromLib !== fromComponent) {
        diffs.push(`${name}\n    lib      : ${fromLib}\n    component: ${fromComponent}`)
      }
    }
    expect(diffs, `policies DIVERGE on ${diffs.length} payload(s):\n  ${diffs.join('\n  ')}`)
      .toEqual([])
  })

  it('⭐ CONTROL: this comparison can actually FAIL', () => {
    // Without this, "0 diffs" is equally satisfied by a renderer that returns ""
    // for everything, or by a payload set nothing can distinguish. Loosen ONE
    // protocol and the comparison must notice.
    const loosened = {
      ...defaultSchema,
      protocols: {
        ...defaultSchema.protocols,
        href: ['http', 'https', 'mailto', 'javascript'],
        src: ['http', 'https'],
      },
    }
    const strict = render('[clique](javascript:alert(1))', MARKDOWN_SANITIZE_SCHEMA)
    const loose = render('[clique](javascript:alert(1))', loosened)
    expect(strict).not.toBe(loose)
    // ...and name the direction: the loosened one is the one that keeps the URL.
    expect(loose).toContain('javascript:')
    expect(strict).not.toContain('javascript:')
  })

  it('⛔ the SCREEN renderer imports the policy and declares none of its own', () => {
    // The structural half. The behavioural test above compares the lib schema to
    // a baseline literal — it would keep passing if someone reintroduced a third
    // copy inside the component, because it never looks at the component. This
    // does. ⚠ A local literal is exactly how the screen/paper gap reopens, and
    // both files would still pass their own tests while it was open.
    const src = readFileSync(
      join(__dirname, 'markdown-renderer.tsx'),
      'utf8',
    )
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '')

    // POSITIVE CONTROL: the stripper left real code, so the negatives below are
    // findings about the component and not about an empty string.
    expect(src).toContain('export function MarkdownRenderer')
    expect(src).toContain('rehypeSanitize')

    expect(src).toContain('MARKDOWN_SANITIZE_SCHEMA')
    expect(src).toMatch(/from ["']@\/lib\/markdown\/sanitize-schema["']/)
    // No local schema literal, and no direct `defaultSchema` import to build one
    // from — that import is what a reintroduced copy would need first.
    expect(src).not.toMatch(/const\s+\w*SANITIZE_SCHEMA\s*=/)
    expect(src).not.toMatch(/defaultSchema/)
  })

  it('⛔ the policy still blocks the dangerous protocols at all', () => {
    // A guard against both schemas being wrong in the same way — equality with a
    // broken baseline is not safety.
    for (const md of [
      '[a](javascript:alert(1))',
      '[a](data:text/html,<script>alert(1)</script>)',
      '![a](javascript:alert(1))',
    ]) {
      const html = render(md, MARKDOWN_SANITIZE_SCHEMA)
      expect(html, md).not.toMatch(/javascript:|data:text\/html/)
    }
    // ...and still renders the safe ones, so the above is not "strips everything".
    expect(render('[a](https://ok.test)', MARKDOWN_SANITIZE_SCHEMA)).toContain('https://ok.test')
    expect(render('[a](mailto:x@y.test)', MARKDOWN_SANITIZE_SCHEMA)).toContain('mailto:x@y.test')
  })
})
