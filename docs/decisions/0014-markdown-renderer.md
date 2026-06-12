# ADR 0014 — Sanitizing Markdown renderer

**Date:** 2026-06-12 · **Status:** accepted · **Owner:** frontend

## Context

ARCHITECTURE.md Rule 7 requires that all coordinator-authored explanatory text —
`section_text` display blocks, and any rich `question_explanation` — be rendered
as **sanitized Markdown, never raw HTML**. This text is authored by a
`staff_admin` and rendered in OTHER users' browsers (staff filling forms,
staff_admin reviewing submissions), so it is a stored-XSS surface: HTML reaching
those browsers must not be able to execute script. The renderer is introduced in
Phase 4 (builder `section_text` preview) and reused unchanged in Phase 5 (wizard)
and Phase 7 (read-only submission views). The library choice was deferred from
scaffolding and gated on this ADR.

## Decision

Render through **`react-markdown@10`** with **`rehype-sanitize@6`** explicitly in
the pipeline and **`remark-gfm@4`** for GitHub-flavored Markdown (tables,
strikethrough, task lists, autolinks). Wrapped in a single reusable component,
`src/components/forms/markdown/markdown-renderer.tsx`, which is the ONLY
sanctioned way to render author Markdown across the app. Three runtime deps added
(lead-approved 2026-06-12).

## Rationale

- **No `dangerouslySetInnerHTML` anywhere.** `react-markdown` parses Markdown
  into a **React element tree**, not an HTML string — so the forbidden API is
  structurally impossible in this path. Raw HTML embedding (`rehype-raw`) is
  deliberately NOT enabled, so inline `<script>` / `<img onerror=…>` in the
  source pass through as inert text, never as DOM.
- **`rehype-sanitize` is defense-in-depth on top of that**, run against a
  hardened allowlist schema derived from its `defaultSchema`: the default tag /
  attribute allowlist already excludes event handlers and `style`; we further
  tighten URL `protocols` to `http`/`https`/`mailto` for links and `http`/`https`
  for images, so `javascript:` and `data:` URLs are stripped.
- The alternative, **marked + DOMPurify**, inherently produces an HTML string and
  routes it through `dangerouslySetInnerHTML` — exactly what Rule 7 forbids — so
  it was rejected despite being a common pairing.

## Consequences

- The renderer is Server-Component-safe (no `"use client"`): it renders purely
  from a `content` prop and is used inside both server and client trees.
  External links from author content open in a new tab with
  `rel="noopener noreferrer nofollow"`; the sanitizer guarantees the href is
  already a safe protocol.
- **Verified inert** against the standard probes through the exact shipped
  pipeline (rendered server-side to a string for the check only — the component
  itself never stringifies): `<img src=x onerror=…>` is dropped; a
  `javascript:` link keeps its text but loses the href; `<script>` is dropped;
  a `data:text/html` image loses its src. Legitimate Markdown (bold, `https`
  links, code, GFM tables) renders correctly. This is the QA/Rule-7 evidence.
- Styling is local utility classes tuned to the design tokens (no typography
  plugin), so the rendered Markdown reads calmly inside builder/wizard cards.
- Deps are caret-ranged (`^10`/`^6`/`^4`), matching the project's library
  convention; `frontend` owns these dependency edits. The hardened
  `SANITIZE_SCHEMA` lives beside the component — changes to what HTML is allowed
  are a deliberate, reviewable edit in one place.
