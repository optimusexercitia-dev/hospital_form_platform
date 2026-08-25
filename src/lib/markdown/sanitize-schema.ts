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
 * ⚠ **The print side DOES take one narrowing, and it lives here, not there:**
 * {@link PDF_MARKDOWN_SANITIZE_SCHEMA} below. It is derived from this constant —
 * a second policy, not a second copy — so this one stays the single authority.
 * The rule above is unchanged: paper may only ever be STRICTER.
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

/**
 * ⚠ **Fail-CLOSED defaults, and they are load-bearing.** `hast-util-sanitize`
 * documents that *"if any top-level key is missing in the given schema, the
 * corresponding value of the default schema is used"* — so a derived schema that
 * leaves `tagNames` or `attributes` `undefined` silently gets `defaultSchema`'s
 * back, `img` included. The `?? []` / `?? {}` below therefore narrow to
 * "nothing allowed" rather than to "whatever the library defaults to"; an empty
 * array is PRESENT, an absent key is not. The behavioural test named below
 * catches the over-narrowing that fail-closed can produce.
 */
const SHARED_TAG_NAMES: NonNullable<typeof defaultSchema.tagNames> =
  MARKDOWN_SANITIZE_SCHEMA.tagNames ?? []
const SHARED_ATTRIBUTES: NonNullable<typeof defaultSchema.attributes> =
  MARKDOWN_SANITIZE_SCHEMA.attributes ?? {}

/**
 * The PRINT policy: {@link MARKDOWN_SANITIZE_SCHEMA} minus `<img>`.
 *
 * Consumed by exactly one module — `src/lib/pdf/markdown.ts`. Not by the screen.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ WHY PAPER IS STRICTER HERE, AND WHY THAT DOES NOT CONTRADICT THE RULE ABOVE
 * ═══════════════════════════════════════════════════════════════════════════
 * The asymmetry rule says paper may be stricter and must never be looser. This
 * is the stricter direction, taken deliberately, because on paper `<img src>`
 * is not a rendering feature — it is an OUTBOUND REQUEST FROM THE SERVER.
 *
 * The screen renders author Markdown in the READER'S browser: an `<img>` there
 * fetches from the reader's own network, which is ordinary web behaviour. The
 * print pipeline hands the same HTML to **Gotenberg — a headless Chromium on the
 * server network** (`src/lib/pdf-mint/gotenberg.ts`). There, `![](https://…)` in
 * any case narrative becomes a GET issued by the server, on **every prévia and
 * every mint**, and that is three defects at once:
 *   1. **SSRF reach** — the author chooses a URL the server resolves, from
 *      inside the private network, with no egress restriction anywhere in the
 *      stack (dev is a bare `docker run`; Coolify constrains inbound only).
 *   2. **A per-render exfiltration beacon on a Rule 12 document** — each prévia
 *      and mint pings the author's chosen host, timing and all. ⚠ Not
 *      *sometimes*: C-1's constitutive rule makes `contains_phi = true` for
 *      EVERY live case dossier, so this and (3) land on a PHI artifact every
 *      single time, never on an incidental one.
 *   3. **A non-reproducible `content_hash`** — remote bytes can change between
 *      renders, so the mint-time hash stops being a function of our own data.
 * None of those exist on screen. That is why the direction flips for this ONE
 * attribute and for nothing else.
 *
 * ⚠ **Dormant sibling, deliberately named so nobody reopens it by accident.**
 * `hast-util-sanitize` protocol-filters only `cite` / `href` / `longDesc` /
 * `src`. **`srcSet` is never protocol-filtered**, and `defaultSchema` allows the
 * `source` tag *and* `attributes.source: ['srcSet']` — so `<picture><source
 * srcset="https://attacker/…"></picture>` is a live fetch vector the moment raw
 * HTML is enabled. It is inert today for one reason only: no Markdown syntax
 * emits those tags and neither pipeline turns on `rehype-raw` /
 * `allowDangerousHtml`. ⛔ Adding either without also filtering `srcSet` (or
 * dropping `picture`/`source` here) reopens exactly what this schema closes.
 * `<img>` is the one that had to be closed today because `![](url)` is
 * first-class Markdown and needs no raw HTML at all.
 *
 * Proof, behavioural and differential (a schema diff would not have caught the
 * direction): `src/lib/markdown/sanitize-print-narrowing.test.tsx`.
 */
export const PDF_MARKDOWN_SANITIZE_SCHEMA = {
  ...MARKDOWN_SANITIZE_SCHEMA,
  tagNames: SHARED_TAG_NAMES.filter((tagName) => tagName !== 'img'),
  // Dropping the tag already removes the element; dropping its attribute entry
  // keeps the policy honest — a stale `attributes.img` reads as "img is allowed,
  // narrowly", which is the opposite of what this schema says.
  attributes: Object.fromEntries(
    Object.entries(SHARED_ATTRIBUTES).filter(([tagName]) => tagName !== 'img'),
  ),
} satisfies typeof defaultSchema
