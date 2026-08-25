import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

import { MARKDOWN_SANITIZE_SCHEMA } from '@/lib/markdown/sanitize-schema'

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
 * `remark-gfm` + `rehype-sanitize` with {@link MARKDOWN_SANITIZE_SCHEMA} is
 * exactly what `markdown-renderer.tsx` uses. Two policies for one corpus would
 * drift, and the drift is asymmetric: paper stricter than screen loses a
 * heading, paper looser than screen renders what the platform judged unsafe.
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
  .use(rehypeSanitize, MARKDOWN_SANITIZE_SCHEMA)
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
