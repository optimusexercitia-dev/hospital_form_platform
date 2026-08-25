# 0145 — The print path's Markdown is stricter than the screen's: no `<img>` inside Gotenberg

**Date:** 2026-08-25 · **Status:** Accepted · **Owner:** backend
**Supersedes:** nothing. **Amends:** ADR 0014 (its "one hardened schema, one place" consequence —
see the Decision).
**Relates:** ADR 0104 (PDF module) · 0144 (case dossier printing — the path that made this live) ·
0030 / 0035 (PHI posture, Rule 12) · ARCHITECTURE.md Rule 7.

## Context

ADR 0014 hardened one `defaultSchema`-derived allowlist and stated that changes to what HTML is
allowed are "a deliberate, reviewable edit in **one place**". That was correct while every consumer
rendered into **a reader's browser**, where an author's `<img src="https://…">` is a feature.

PDF·P3 (ADR 0144) is the first path that renders author-controlled Markdown into HTML that is then
loaded by **Gotenberg — a headless Chromium on the server network.** The shared schema keeps
`defaultSchema`'s `<img>` with `src: ['http','https']`, so `![](https://attacker/beacon)` inside any
case narrative made that server-side browser issue the GET on **every prévia and every mint**. Three
consequences, and the first two are the security ones:

- **SSRF reach** from inside the private network, using a URL any narrative author controls.
- **A per-render exfiltration beacon on a Rule 12 document** — the request itself signals that a
  specific dossier was printed, and when.
- **A non-reproducible `content_hash`**, because the rendered bytes depend on a third party.

Two comments asserted the opposite (`src/lib/pdf-mint/gotenberg.ts`: the HTML *"fetches nothing"*;
a second copy in `docs/deployment/pdf-renderer.md`). Both were true for P1/P2 and **falsified by P3** —
the restated claim is the copy that drifts.

## Decision

**`PDF_MARKDOWN_SANITIZE_SCHEMA`** — derived from the shared schema, with `img` filtered out of
`tagNames` and its `attributes.img` entry dropped — declared beside the shared schema and consumed
**only** by `src/lib/pdf/markdown.ts`. The shared schema remains the single screen policy (Rule 7);
this is **one authority with one documented narrowing**, not a second policy.

This **amends ADR 0014's "one place"**: there are now exactly two schemas, and the derivation
relationship is the thing that keeps them honest — the print schema cannot loosen anything, because
it is the shared schema minus one tag.

⭐ **The guidance that hid the defect, corrected rather than deleted.** The module said *"paper must
never be stricter than screen, don't define your own schema."* That is right about **policy
ownership** and wrong as an absolute, because **the fetch happens in a different place on each
surface**: on screen it is the reader's own browser; on paper it is a server-side browser holding
network position. For `<img src>` specifically, paper-stricter is the correct direction — and the
narrowing is deliberately **one-directional**.

## Measured, not assumed

- `renderMarkdown` has **exactly one** consumer: `src/lib/pdf/documents/case.ts:158`, via `prose()`.
  No dynamic imports, no re-exports. Every *other* author field in that template goes through
  `esc()`, so `prose()` is the sole live-HTML channel; the only external URL in the assembled
  document is the verification URL, emitted as **inline SVG**, and fonts are data-URIs.
- ⛔ **`srcSet` is a worse dormant sibling than it looks.** `hast-util-sanitize` protocol-filters only
  `cite`/`href`/`longDesc`/`src` — and `defaultSchema.attributes.source` **already** lists `srcSet`
  while `source` and `picture` are **already** in `tagNames`. So enabling `rehype-raw` **alone** would
  open this vector with no further attribute grant. Both facts are pinned by assertions so a library
  bump reddens them.
- Enumerating every attribute still reachable on an allowed tag in the print schema, **no render-time
  fetcher survives**: `srcSet` (unreachable — `source` needs raw HTML), `action` (`form` not allowed),
  `cite` (protocol-filtered, never fetched), `href` (user-initiated navigation, correctly kept),
  `useMap`, `itemType`. ⚠ **Bound stated honestly:** the fetcher list is a hand-list, so it can only
  under-report; what the assertion guarantees is that a *known* fetcher cannot reappear silently. Its
  positive control is the same predicate over the screen schema, which finds `['src','srcSet']`.

## Consequences

- ⚠ **An author image no longer appears on paper.** `hast-util-sanitize` drops the element, and `alt`
  is an attribute, so the alt text goes with it: an image-only paragraph prints as `<p></p>` and an
  inline image vanishes from its sentence. On screen it still renders. **Whether a printed dossier
  should instead show a visible pt-BR placeholder is a product question this ADR does NOT decide** —
  it is referred to the PO, because silently omitting content from a legal document and announcing the
  omission are different postures, and only one of them is a rendering detail.
- **The schema is currently the only mitigation.** There is no network-layer backstop: the dev recipe
  is a bare `docker run` with no egress restriction, and the Coolify configuration constrains inbound
  only. Running Gotenberg with **outbound egress denied** is recommended as defence in depth, off the
  critical path.
- A third statement of the same claim lives at `src/lib/pdf/render.ts:28-32`. It is phrased as a
  **requirement** ("must fetch nothing"), so it is not false — but it now depends on a mechanism in
  another module, and carries a pointer to this ADR for that reason.
- Every live case dossier is `contains_phi = true` after ADR 0144 Amendment 5, so this narrowing
  protects a document class that is **entirely** PHI-classified.

## Alternatives rejected

- **Leave the shared schema and rely on the sidecar being private-network.** Rejected: it is the
  claim that was already written down twice and was already false; and a private network is exactly
  where SSRF reach is valuable.
- **Strip `<img>` in the template instead of the schema.** Rejected: it puts the security property in
  the layer that formats, where the next template would not inherit it.
- **Tighten the shared schema for both surfaces.** Rejected: it removes a working screen feature to
  fix a paper-only exposure — Rule 7's policy ownership does not require the surfaces to be identical,
  only that neither renders raw HTML.
