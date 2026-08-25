import { esc } from '../escape'

/**
 * The table-of-contents primitive (PDF·P3; ADR 0144 D13) — the ONE new
 * primitive this phase adds. PURE, like every sibling (ADR 0104 D14).
 *
 * ⛔ **RENDERED UNCONDITIONALLY, AND THAT IS A DECISION WITH A REASON.** D13
 * forbids gating this block on document length or section count. Conditional
 * rendering would let one template key + version produce STRUCTURALLY DIFFERENT
 * documents — a short dossier with no index, a long one with — which is ADR 0144
 * D1's fingerprint problem wearing a different costume: the committed
 * fingerprint would pin whichever shape the canonical fixture happened to
 * exercise, and the other would ship unguarded.
 *
 * ⚠ **NO PAGE NUMBERS, and this is a renderer limit rather than a preference.**
 * Chromium ignores CSS `@page` margin boxes, so `counter(page)` is unreachable
 * from the document itself; the only route to a page number is a Gotenberg
 * header/footer template file, which is a separate artefact from this HTML. A
 * TOC that carried made-up or best-guess numbers would be worse than one that
 * carries none, on a document whose whole premise (D1) is that it is a RECORD.
 * The compensating affordance is D13's other half: every top-level section
 * starts on a new page, so the order below IS the page order.
 */

/** One index line. `title` must be the EXACT heading the body renders, so the
 * index and the document cannot disagree — see {@link renderTableOfContents}. */
export interface TableOfContentsEntry {
  title: string
}

/**
 * Renders the index block.
 *
 * ⚠ **Callers must derive these entries from the SAME list that drives the body,
 * never from a hand-written parallel array.** Two hand-maintained lists is this
 * codebase's recurring drift class, and here it would produce an index naming a
 * section the document does not contain — on a page that claims to be an
 * authoritative record. `documents/case.ts` builds one `Section[]` and feeds it
 * to both, which makes the disagreement unrepresentable rather than merely
 * discouraged.
 *
 * Empty (`entries.length === 0`) still renders the block with its heading and an
 * explicit empty marker: the STRUCTURE is what must be constant, and a
 * fully-disposed case whose every section is empty is a real state that must
 * still produce a well-formed document.
 */
export function renderTableOfContents(entries: TableOfContentsEntry[]): string {
  const body =
    entries.length === 0
      ? '<div class="toc-empty">— sem seções com conteúdo —</div>'
      : `<ol class="toc-list">
${entries.map((e) => `  <li>${esc(e.title)}</li>`).join('\n')}
</ol>`

  return `<nav class="doc-toc">
<h2 class="toc-title">Sumário</h2>
${body}
</nav>`
}
