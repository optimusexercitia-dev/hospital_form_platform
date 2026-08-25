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
