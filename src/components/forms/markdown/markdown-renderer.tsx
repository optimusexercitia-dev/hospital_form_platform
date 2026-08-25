import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

import { MARKDOWN_SANITIZE_SCHEMA } from "@/lib/markdown/sanitize-schema";
import { cn } from "@/lib/utils";

/**
 * The platform's ONE sanitizing Markdown renderer (ARCHITECTURE.md Rule 7).
 *
 * Staff_admin-authored explanatory text (`section_text` content, and any rich
 * `question_explanation`) is Markdown that reaches OTHER users' browsers, so it
 * is a stored-XSS surface. This component is the only sanctioned way to render
 * it, and it is reused in the builder preview (Phase 4), the wizard (Phase 5),
 * and the read-only submission views (Phase 7).
 *
 * Why this is safe by construction:
 *  - `react-markdown` parses Markdown into a **React element tree** — it never
 *    produces an HTML string, so there is no `dangerouslySetInnerHTML` anywhere
 *    in the path. Raw HTML in the source is NOT enabled (no `rehype-raw`), so
 *    inline `<script>`/`<img onerror=…>` etc. are passed through as inert text.
 *  - `rehype-sanitize` runs explicitly in the pipeline against a hardened
 *    allowlist schema — {@link MARKDOWN_SANITIZE_SCHEMA}: it strips disallowed
 *    tags/attributes and, via `protocols`, blocks `javascript:`/`data:` URLs on
 *    links and images. This is defense-in-depth on top of "no raw HTML".
 *
 * Server-Component-safe (no `"use client"`): it renders purely from props and is
 * used inside both server and client trees.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ THE SCHEMA IS IMPORTED, NOT DECLARED — DO NOT REINTRODUCE A LOCAL COPY
 * ═══════════════════════════════════════════════════════════════════════════
 * This component used to carry its own `SANITIZE_SCHEMA` literal. The identical
 * policy is now needed by the PRINT renderer (`src/lib/pdf/markdown.ts`), which
 * is a pure module and cannot import a React component, so the policy lives in
 * `@/lib/markdown/sanitize-schema` and both surfaces read it.
 *
 * ⚠ A divergence between the two is NOT symmetric. Paper stricter than screen is
 * cosmetic — something vanishes from a PDF. Paper LOOSER than screen is a
 * security defect: content this component judged unsafe gets rendered into a
 * document that is stored, downloaded and handed to an external auditor
 * (Rule 7). A local copy here is how that gap opens, silently, because both
 * files keep passing their own tests.
 *
 * The repoint was proven behavioural, not assumed: `sanitize-equivalence.test.ts`
 * renders 22 hostile and ordinary payloads through the old literal and the
 * imported schema and requires byte-identical HTML.
 */

export function MarkdownRenderer({
  content,
  className,
}: {
  /** Raw Markdown source authored by a coordinator. Never trusted as HTML. */
  content: string;
  className?: string;
}) {
  return (
    <div
      // `prose`-like spacing tuned to the design tokens; kept local (no
      // typography plugin) so headings/lists read calmly inside cards.
      className={cn(
        "text-sm leading-relaxed text-foreground/90",
        "[&_h1]:mt-0 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold",
        "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold",
        "[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold",
        "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:my-0.5",
        "[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
        "[&_strong]:font-semibold",
        "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
        "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm",
        "[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold",
        "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1",
        "[&_hr]:my-4 [&_hr]:border-border",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, MARKDOWN_SANITIZE_SCHEMA]]}
        components={{
          // External links from author content open in a new tab with a safe
          // rel; the sanitizer has already guaranteed an http(s)/mailto href.
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              {...props}
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
