/**
 * Ata-text sanitization (Architecture Rule 7 — explanatory text is sanitized Markdown,
 * never raw HTML).
 *
 * Its own module rather than a helper inside `actions.ts` because that file carries
 * `'use server'`, where every export must be an async server action — a pure string
 * function would have to be smuggled out behind a pointless `async` wrapper just to be
 * unit-testable.
 *
 * ⚠ This is the INGEST half of Rule 7 and it is deliberately narrow. The platform's
 * durable defence is render-time: `MarkdownRenderer` is what actually decides what
 * becomes DOM. Stripping here exists so a hostile payload never reaches the database in
 * the first place, and so the reviewer is not told "o texto contém HTML" only at the
 * final "Concluir" click by `apply_minutes_review`'s HC0S5 backstop.
 *
 * The three layers agree on one rule: a `<` followed by a tag-name character is markup;
 * a bare `<` is prose. "quórum 3 < 5 confirmado" must survive all three — the SQL guard
 * matches `<[A-Za-z!/?]`, and so does this.
 */

/** Matches an HTML/XML tag opener, a closing tag, or a comment/PI — never a bare `<`. */
const TAG_RE = /<\/?[A-Za-z][^>]*>?|<[!?][^>]*>?/g

/**
 * Remove HTML markup from a Markdown string, leaving prose (and a lone `<`) intact.
 *
 * Note the trailing `>?` in the pattern: an UNCLOSED `<script` must be stripped too.
 * Requiring the `>` would leave `<script src=x` in the text, which the SQL backstop then
 * rejects at apply time — turning a silent clean-up into a dead-end error.
 */
export function stripHtmlTags(value: string): string {
  return value.replace(TAG_RE, '')
}

/** True when the value still carries a tag opener — mirrors the SQL guard's predicate. */
export function containsHtmlTag(value: string): boolean {
  return /<[A-Za-z!/?]/.test(value)
}
