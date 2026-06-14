# ADR 0019 — The default (anchor) section may carry a title

- **Status:** Accepted
- **Date:** 2026-06-13
- **Supersedes (in part):** "lead refinement #2" (the default-section lock)

## Context

Every form version has ≥1 section; creating a form auto-creates a *default*
section (`is_default = true`, `title = null`). A version whose only section is
the default renders flat, with no section chrome — this is how "a form may or
may not have sections" is modelled without a nullable `section_id` (CLAUDE.md
§1, ARCHITECTURE.md §2).

A later refinement ("lead refinement #2") additionally **locked** the default
section to carry *no* title, condition, or sign-off, enforced by the DB CHECK
`form_sections_default_shape` and by the builder UI hiding its rename control.
Consequence: in a multi-section form the first section could never be named,
while every other section could — an inconsistent, surprising builder UX (the
reported issue).

## Decision

Allow the default section to carry a **title**, while still forbidding a
visibility condition and a sign-off on it:

- **DB** (migration `20260613090010_default_section_allow_title.sql`): relax
  `form_sections_default_shape` from `(title is null and visible_when is null
  and requires_signoff = false)` to `(visible_when is null and requires_signoff
  = false)`. The anchor section is always first, so it can never reference an
  earlier answer (no `visible_when`); sign-off on the anchor stays out of scope.
- **Action** (`updateSection`): the default-section branch now persists an
  **optional** title (blank → `null`, no `sectionTitleRequired` error; non-default
  sections still require a title). `visible_when` / `requires_signoff` are left
  untouched for it.
- **UI**: the builder surfaces the rename affordance for the default section
  (which only ever renders in sectioned mode), keeping its condition/sign-off
  and delete controls hidden. The unified heading rule across all surfaces is:
  show `section.title` when present, else the existing per-surface placeholder
  ("Seção inicial" in the builder; chrome-less in the flat wizard render;
  "Respostas" in the review/phase-answers summaries).

## Consequences

- **Flat-render invariant unchanged.** A lone default section still renders
  chrome-less regardless of any stored title; `isFlat` logic is untouched.
- Relaxing is backward-compatible: every existing default row (`title = null`)
  still satisfies the weaker predicate — no data migration, no row invalidated.
- No generated-type change (`title` was already `string | null`); cloning is
  unaffected (`clone_form_version` already copies `title` for every section).
- The condition/sign-off portion of "lead refinement #2" still stands; only the
  title lock is lifted.
- Builder E2E specs that assumed the default section had no "Renomear seção"
  button were updated (the default section now has one).
