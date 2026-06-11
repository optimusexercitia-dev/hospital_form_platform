# PROGRESS.md — Project Status Tracker

> Single source of truth for project status. Update IMMEDIATELY when state
> changes. The lead owns the Phase Status table; each teammate owns their own
> rows in the other sections. Never report status that isn't written here.

## Phase Status

| Phase | Name                          | Status | Build | Tests | QA | Human ✓ | Completed | Commit |
| ----- | ----------------------------- | ------ | ----- | ----- | -- | ------- | --------- | ------ |
| 0     | Scaffolding & Environment     | ✅ complete | ✅ | ✅ 5/5 | ✅ APPROVED | ✅ 2026-06-11 | 2026-06-11 | `effae88` |
| 1     | Schema, Auth & RLS            | 🔜 not started | – | – | – | – | – | – |
| 2     | Authentication & App Shell    | 🔜 not started | – | – | – | – | – | – |
| 3     | Admin Area & User Management  | 🔜 not started | – | – | – | – | – | – |
| 4     | Form Builder & Versioning     | 🔜 not started | – | – | – | – | – | – |
| 5     | Wizard Filling, Conditional Sections & Resume | 🔜 not started | – | – | – | – | – | – |
| 6     | Section Sign-offs & Submission Lifecycle | 🔜 not started | – | – | – | – | – | – |
| 7     | Dashboards & Submissions Browser | 🔜 not started | – | – | – | – | – | – |
| 8     | Deployment                    | 🔜 not started | – | – | – | – | – | – |

Status legend: 🔜 not started · 🏗️ in progress · 🧪 testing · 🔍 QA review · ⏸️ awaiting human approval · ✅ complete · ❌ blocked

## Current Phase Tasks

<!-- Lead recreates this table at the start of each phase -->

| Task | Owner | Status | Depends on | Notes |
| ---- | ----- | ------ | ---------- | ----- |
| Bootstrap scaffold + toolchain (Next 16, Tailwind v4, shadcn, Vitest, Playwright, Supabase init) | lead | done | – | ADR 0001. `lint`/`typecheck`/`build`/`test` green. |
| Agent definitions + `.claude/settings.json` (Agent Teams flag) | lead | done | – | 4 agents written. |
| Empty initial migration + `supabase start` verified from clean clone | backend | done | scaffold | `20260611234112_initial.sql` (empty). Stack boots; REST + Auth return 200. Local API `http://127.0.0.1:54321`. |
| Type generation wired (`gen types` → `src/lib/types/database.ts`) | backend | done | initial migration | `gen:types` npm script added; `database.ts` generated, typechecks in isolation (empty `public` schema, expected pre-Phase 1). |
| Smoke tests: 1 Vitest + 1 Playwright (home renders) | tester | done | scaffold | `--passWithNoTests` removed; jsdom downgraded to ^25 to resolve ESM compat. |
| Client factories `src/lib/supabase/{browser,server}` | backend | done | env wired | `browser.ts` + `server.ts` typed with `Database`, anon/publishable key only (no service-role). `.env.local` repointed at local stack. Lint clean; backend files typecheck clean. |

## Bug Log

<!-- Filed by tester; status updated ONLY by tester after re-verification -->

| ID | Phase | Severity | Description / repro | Expected | Actual | Spec | Owner | Status |
| -- | ----- | -------- | ------------------- | -------- | ------ | ---- | ----- | ------ |
|    |       |          |                     |          |        |      |       |        |

## Test Run Summary

<!-- Tester appends one row per full-suite run -->

| Date | Phase | Specs | Passed | Failed | Notes |
| ---- | ----- | ----- | ------ | ------ | ----- |
| 2026-06-11 | 0 | Vitest: 1 file / 2 tests; Playwright: 1 file / 3 tests | 5 | 0 | First full run. jsdom downgraded ^27→^25 (ESM compat). |

## QA Verdicts

| Phase | Verdict | Report | Blockers/Majors | Follow-ups carried |
| ----- | ------- | ------ | --------------- | ------------------ |
| 0 | APPROVED | [phase-0-review.md](docs/reviews/phase-0-review.md) | None | MINOR-1: set lang="pt-BR" in layout.tsx (Phase 2); MINOR-2: close stale supabase-start follow-up; INFO: update ADR 0001 to note --passWithNoTests removed |

## Decisions

<!-- One line per decision; details in docs/decisions/ -->

| Date | Decision | ADR |
| ---- | -------- | --- |
| 2026-06-11 | Scaffolding & toolchain: Next 16/React 19, shadcn (radix/neutral), `vitest.config.mts` (ESM), Supabase CLI pinned as devDep, Chromium-only Playwright | [0001](docs/decisions/0001-scaffolding-and-toolchain.md) |
| 2026-06-11 | `jsdom` pinned to `^25` (jsdom@27 pulls an ESM-only transitive dep that crashes Vitest's forks pool on Node 20) — revisit when vitest/jsdom resolve the incompatibility | – |

## Follow-ups / Deferred Items

- [ ] (minor QA findings, nice-to-haves, tech debt — reviewed at each phase start)
- [ ] Choose the sanitizing Markdown renderer library (ARCHITECTURE.md Rule 7) — deferred from scaffold; needs its own ADR before Phase 4/5.
- [x] Run `supabase start` to confirm the local stack boots from a clean clone (Phase 0 acceptance). — Done 2026-06-11 (backend task #1; REST + Auth healthy).
- [ ] Set `lang="pt-BR"` in `src/app/layout.tsx` (QA Phase 0 MINOR-1) — frontend, due before Phase 2 ships user-facing content.
- [ ] Consider a short ADR on the new Supabase CLI publishable/secret key scheme (env var names kept as ANON/SERVICE_ROLE) — before Phase 1.
