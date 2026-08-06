import { describe, expect, it } from 'vitest'

import { containsHtmlTag, stripHtmlTags } from './sanitize'

/**
 * T2 — ata sanitization (Architecture Rule 7).
 *
 * The point of these tests is AGREEMENT between three layers that each decide, in a
 * different language, what counts as markup:
 *   - this stripper (ingest),
 *   - `apply_minutes_review`'s HC0S5 guard, whose SQL predicate is `~ '<[A-Za-z!/?]'`,
 *   - `MarkdownRenderer` (render).
 * A bare `<` is prose in all three. If they disagree, a legitimate ata either dies at
 * "Concluir" or ships markup.
 */

describe('stripHtmlTags', () => {
  it.each([
    ['<script>alert(1)</script>', 'alert(1)'],
    ['<img src=x onerror=alert(1)>', ''],
    ['texto <b>negrito</b> aqui', 'texto negrito aqui'],
    ['<!-- comentário -->', ''],
    ['<?php echo 1; ?>', ''],
    ['<IMG SRC=x>', ''],
  ])('strips %j', (input, expected) => {
    expect(stripHtmlTags(input)).toBe(expected)
  })

  it('strips an UNCLOSED tag opener', () => {
    // Requiring the closing `>` would leave `<script src=x` in the text, which the SQL
    // backstop then rejects — turning a silent clean-up into a dead-end error at the
    // final click.
    expect(stripHtmlTags('texto <script src=x')).toBe('texto ')
    expect(containsHtmlTag(stripHtmlTags('texto <script src=x'))).toBe(false)
  })

  it.each([
    ['quórum 3 < 5 confirmado', 'quórum 3 < 5 confirmado'],
    ['a < b e c > d', 'a < b e c > d'],
    ['## Título\n\n- item\n- outro', '## Título\n\n- item\n- outro'],
    ['5 < 10 < 20', '5 < 10 < 20'],
  ])('leaves prose %j untouched', (input, expected) => {
    expect(stripHtmlTags(input)).toBe(expected)
  })

  it('produces output the SQL guard accepts', () => {
    // The agreement assertion. `containsHtmlTag` mirrors `~ '<[A-Za-z!/?]'` exactly, so a
    // stripped ata can never be refused by HC0S5.
    const hostile = 'Ata <b>x</b> <script>y</script> com 3 < 5 e <!-- nota -->'
    expect(containsHtmlTag(stripHtmlTags(hostile))).toBe(false)
    expect(stripHtmlTags(hostile)).toContain('3 < 5')
  })
})

describe('containsHtmlTag mirrors the SQL predicate', () => {
  it.each(['<b>', '</b>', '<!doctype', '<?xml', '<script'])('flags %j', (v) =>
    expect(containsHtmlTag(v)).toBe(true),
  )
  it.each(['3 < 5', 'a<', '< ', '<1', '<-'])('does not flag %j', (v) =>
    expect(containsHtmlTag(v)).toBe(false),
  )
})
