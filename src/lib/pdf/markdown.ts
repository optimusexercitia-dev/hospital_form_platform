import type { Element, ElementContent, Root, RootContent } from 'hast'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

import { PDF_MARKDOWN_SANITIZE_SCHEMA } from '@/lib/markdown/sanitize-schema'

/**
 * Author-written Markdown → **sanitized** HTML string, for the print templates
 * (PDF·P3; Architecture Rule 7).
 *
 * PURE, and deliberately so — no React, no Supabase, no `server-only`, so
 * `src/lib/pdf/**`'s purity gate (ADR 0104 D14) still holds.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ WHY THIS EXISTS: RAW MARKDOWN ON PAPER IS NOT A COSMETIC BUG
 * ═══════════════════════════════════════════════════════════════════════════
 * Before this, the dossier passed narrative bodies, interview summaries and
 * referral replies through `esc()` — so a coordinator's `## Conclusão` printed
 * as the two literal characters `##`, and `**risco alto**` printed its asterisks.
 * The database stores real Markdown and the screen renders it; only paper did
 * not.
 *
 * ⛔ **AND THE OBVIOUS FIX IS THE DANGEROUS ONE.** Dropping `esc()` and
 * interpolating the author's text into the template would convert a cosmetic
 * defect into **stored XSS reaching Gotenberg** — a headless Chromium that then
 * renders it into a permanent, downloadable, externally-distributed document.
 * The escape was not wrong; it was the wrong TOOL. The right one is a pipeline
 * that parses Markdown and then sanitizes the resulting tree.
 *
 * ⚠ **The plugin set and the schema are the SCREEN'S, not a second policy.**
 * `remark-gfm` + `rehype-sanitize` is exactly what `markdown-renderer.tsx` uses,
 * and the schema is DERIVED from the screen's, not written here. Two independent
 * policies for one corpus would drift, and the drift is asymmetric: paper
 * stricter than screen loses a heading, paper looser than screen renders what
 * the platform judged unsafe.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ ONE NARROWING: `<img>` IS DROPPED ON PAPER, AND THAT DIRECTION IS CORRECT
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ **The guidance above is what hid a real defect for the whole of P3, so read
 * this before "restoring symmetry".** "Don't define your own schema, paper must
 * never be stricter" is right about *policy ownership* and wrong as an absolute
 * about `<img src>`, because the two surfaces do not run the fetch in the same
 * place: on screen an `<img>` is fetched by the READER'S browser (ordinary web
 * behaviour); here it is fetched by **Gotenberg, a headless Chromium on the
 * SERVER network**, on every prévia and every mint. So `![](https://attacker/x)`
 * in a case narrative is SSRF reach + a per-render exfil beacon on a Rule 12
 * document + a `content_hash` that is no longer a function of our own data.
 *
 * Hence {@link PDF_MARKDOWN_SANITIZE_SCHEMA}: the shared policy MINUS `img`,
 * derived in the shared module so there is still exactly one authority and one
 * documented narrowing. The narrowing is one-directional and deliberate; the
 * "paper is never looser" half of the rule is untouched. Its rationale, and the
 * dormant `srcSet` / `<picture>` sibling that `rehype-raw` would wake up, are
 * documented at the declaration. The differential proof — same payload, `<img>`
 * gone HERE and still present on screen — is
 * `src/lib/markdown/sanitize-print-narrowing.test.tsx` (it is not colocated
 * because the control renders the React screen component).
 *
 * ⛔ Never `string`-interpolate author content into a template. Call this.
 */

/**
 * The two halves of the printed marker. Kept as one sentence in two shapes so a
 * reader meets identical wording whether or not the author wrote an `alt`.
 *
 * ⚠ pt-BR, calm, no jargon (Rule 10). It is read by clinicians and by external
 * auditors holding a printed dossier, not by developers.
 */
const IMAGE_PLACEHOLDER_TEXT = 'imagem não incluída na versão impressa'

/**
 * One dropped `<img>` → the visible marker that replaces it.
 *
 * ⛔ **The `src` is never emitted, in any shape.** It is attacker-controlled by
 * construction (that is the whole of C-2), and a URL printed on paper invites a
 * reader to type it into a browser — which hands the beacon the click that the
 * schema just denied the renderer. The marker DESCRIBES; it never links.
 *
 * The `alt` is included when the author wrote one, because it is the only
 * description of the missing content that exists anywhere. It is not a new
 * disclosure: this document class is entirely PHI-banded (ADR 0144 Amendment 5),
 * so the alt is already inside the band the dossier is handled under.
 *
 * ⚠ The alt lands in a hast TEXT node, so `rehype-stringify` escapes it on the
 * way out — `![<script>…](…)` prints its angle brackets and executes nothing.
 * That is a property of the node type, not of a string we escape by hand.
 */
function imagePlaceholder(image: Element): Element {
  const rawAlt = image.properties?.alt
  const alt = typeof rawAlt === 'string' ? rawAlt.trim() : ''
  return {
    type: 'element',
    // `em` and text need NO schema grant — both are already in the print
    // allowlist. That is the point of doing this here instead of re-allowing
    // `img`: the marker exists precisely BECAUSE the element is gone.
    tagName: 'em',
    properties: {},
    children: [
      {
        type: 'text',
        value: alt === ''
          ? `[${IMAGE_PLACEHOLDER_TEXT}]`
          : `[${IMAGE_PLACEHOLDER_TEXT}: ${alt}]`,
      },
    ],
  }
}

/**
 * Replace every `img` element with {@link imagePlaceholder}, in place.
 *
 * ⚠ The `root`/`element` branches are identical text on purpose: `hast` types
 * `Root['children']` and `Element['children']` as two different arrays, and a
 * write into the union of them narrows to `never`. Splitting the assignment is
 * what keeps this cast-free.
 */
function replaceImages(node: Root | Element): void {
  if (node.type === 'root') node.children = node.children.map(mapChild)
  else node.children = node.children.map(mapChild)
}

function mapChild<T extends RootContent | ElementContent>(child: T): T | Element {
  if (child.type !== 'element') return child
  if (child.tagName === 'img') return imagePlaceholder(child)
  replaceImages(child)
  return child
}

/**
 * ⭐ **Why this runs on hast (after `remark-rehype`) and not on mdast.**
 * The obvious seam is a remark plugin visiting mdast `image` nodes — and it is
 * WRONG, because Markdown has a second image syntax: `![alt][ref]` with a
 * `[ref]: https://…` definition parses to `imageReference`, not `image`, and
 * only becomes an `img` during `remark-rehype`. A mdast `image` visitor prints
 * a marker for one syntax and silently drops the other. Running after the
 * conversion means ONE node shape (`element` + `tagName === 'img'`) covers every
 * way an image can reach the document, including any future one. Pinned by the
 * reference-image test in `sanitize-print-narrowing.test.tsx`.
 */
function printImagePlaceholders() {
  return (tree: Root): void => {
    replaceImages(tree)
  }
}

/**
 * ⚠ Built ONCE at module load, not per call. The pipeline is stateless after
 * `.freeze()`, and rebuilding it per narrative on a 124-page dossier would run
 * the plugin-resolution work hundreds of times per render.
 */
const PROCESSOR = unified()
  .use(remarkParse)
  .use(remarkGfm)
  // `allowDangerousHtml` is NOT set, so raw HTML embedded in the Markdown source
  // is dropped at this boundary before the sanitizer even sees it. That is two
  // independent defences, and this one is the cheaper of the two to reason about.
  .use(remarkRehype)
  // ⭐ ORDER IS LOAD-BEARING: the marker is substituted BEFORE the sanitizer
  // runs, so no tag has to be newly allowed. ⛔ The sanitizer stays exactly as
  // ADR 0145 left it — the two are defence in depth, not alternatives. If this
  // transform were deleted tomorrow the schema would still strip the `<img>`;
  // the only loss would be that the omission goes back to being silent.
  .use(printImagePlaceholders)
  .use(rehypeSanitize, PDF_MARKDOWN_SANITIZE_SCHEMA)
  .use(rehypeStringify)
  .freeze()

/**
 * Render one Markdown string as sanitized HTML.
 *
 * Returns `''` for null/blank input, so callers can treat "nothing to render"
 * and "rendered to nothing" identically — every consumer here drops an empty
 * section rather than printing a bare heading.
 *
 * ⚠ Synchronous by `processSync`, which `unified` supports because every plugin
 * in this chain is synchronous. An async variant would force every template
 * function to become async, and the templates are pure string builders by
 * design.
 */
export function renderMarkdown(md: string | null | undefined): string {
  if (md === null || md === undefined || md.trim() === '') return ''
  return String(PROCESSOR.processSync(md))
}
