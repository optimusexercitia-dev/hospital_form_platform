import { defaultSchema } from 'rehype-sanitize'

/**
 * The platform's ONE Markdown sanitization policy (Architecture Rule 7 —
 * explanatory text is sanitized Markdown, never raw HTML).
 *
 * Hardened from `rehype-sanitize`'s default: the default tag/attribute allowlist
 * is kept (already free of event handlers and `style`) and only the URL
 * protocols are tightened to the few that make sense for hospital copy — no
 * `irc`/`ircs`/`xmpp`, and never `javascript:` or `data:`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ ONE POLICY, TWO CONSUMERS — AND THE TWO DIRECTIONS ARE NOT SYMMETRIC
 * ═══════════════════════════════════════════════════════════════════════════
 * This schema is read by BOTH the screen renderer
 * (`src/components/forms/markdown/markdown-renderer.tsx`, via `react-markdown`)
 * and the PRINT renderer (`src/lib/pdf/markdown.ts`, via a `unified`
 * remark→rehype→stringify chain). It was extracted here in PDF·P3 precisely so
 * there is one authority rather than two copies.
 *
 * ⚠ **A divergence is not merely untidy, and it is asymmetric.** If paper is
 * STRICTER than screen the result is cosmetic — a heading disappears from a PDF.
 * If paper is LOOSER than screen the result is a security defect: content the
 * platform judged unsafe to render is rendered anyway, into a document that is
 * then stored, downloaded and handed to an external auditor. So the print side
 * must never define its own schema, not even "temporarily", and must never
 * relax this one for a rendering problem.
 *
 * ⚠ It lives under `src/lib/` rather than `src/components/` because
 * `src/lib/pdf/**` is a PURE module (ADR 0104 D14) that may not import a React
 * component — and because a security policy shared by two layers belongs to
 * neither of them.
 */
export const MARKDOWN_SANITIZE_SCHEMA = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
  },
} satisfies typeof defaultSchema
