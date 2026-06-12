# PROGRESS.md — Project Status Tracker

> Single source of truth for project status. Update IMMEDIATELY when state
> changes. The lead owns the Phase Status table; each teammate owns their own
> rows in the other sections. Never report status that isn't written here.

## Phase Status

| Phase | Name                          | Status | Build | Tests | QA | Human ✓ | Completed | Commit |
| ----- | ----------------------------- | ------ | ----- | ----- | -- | ------- | --------- | ------ |
| 0     | Scaffolding & Environment     | ✅ complete | ✅ | ✅ 5/5 | ✅ APPROVED | ✅ 2026-06-11 | 2026-06-11 | `d64281e` |
| 1     | Schema, Auth & RLS            | ✅ complete | ✅ | ✅ 88/88 | ✅ APPROVED | ✅ 2026-06-12 | 2026-06-12 | `691662f` |
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
| Core schema migrations (profiles trigger, commissions, members, forms, versions, sections, items, admin claim) | backend | done | – | Migrations 100001–100003. Admin claim via custom access token hook (ADR 0002). |
| Response lifecycle migrations (responses, answers, signoffs, immutability triggers, display-item rejection) | backend | done | core schema | Migration 100004. Published + submitted immutability + display-item rejection triggers. |
| Condition evaluator + `submit_response` RPC + publish validation, with SQL unit tests | backend | done | lifecycle | Migration 100005. Sign-off check feature-flagged OFF (ADR 0004). pgTAP `20`/`30`/`50` green. |
| Full RLS policy set + `is_member_of`/`is_staff_admin_of` helpers + `form-assets` bucket policies | backend | done | lifecycle | Migrations 100006–100007. Deny-by-default; pgTAP `40` green. Fixed a profiles-policy RLS recursion (now a privileged-column trigger). |
| Seed: personas, 2 commissions, unsectioned + sectioned sample forms, ~10 responses | backend | done | RPC + RLS | `seed.sql`: 7 users, 2 commissions, 2 published forms, 10 submitted + 1 in_progress. Survives `db reset`. |
| RLS/RPC test suite (pgTAP or SQL) + regenerate types | backend | done | seed | pgTAP suite 56/56 via `npx supabase test db` (ADR 0003). Types regenerated; `typecheck` + Vitest evaluator (18/18) green. |
| QA Phase 1 loop-back: RLS hardening (MAJOR-1, MINOR-1/2/3) + signoff-immutability test (MAJOR-2) | backend | done | RLS/RPC suite | Migration 100008. staff_admin UPDATE role-restricted; eval_condition search_path pinned; profiles no-delete (policy + trigger); response version↔commission guard. MAJOR-2 now covers existing sign-off rows rejecting UPDATE+DELETE after submission (guard_submitted_signoffs_trg already fires on INSERT/UPDATE/DELETE; no schema change). pgTAP now **65/65**; typecheck + Vitest green. INFO-1 deferred to Phase 8. |

<details><summary>Phase 0 tasks (completed 2026-06-11)</summary>

| Task | Owner | Status | Notes |
| ---- | ----- | ------ | ----- |
| Bootstrap scaffold + toolchain | lead | done | ADR 0001. |
| Agent definitions + settings | lead | done | 4 agents. |
| Empty initial migration + `supabase start` | backend | done | Stack boots; REST + Auth 200. |
| Type generation wired | backend | done | `gen:types` script. |
| Smoke tests (1 Vitest + 1 Playwright) | tester | done | jsdom pinned ^25. |
| Client factories `src/lib/supabase/{browser,server}` | backend | done | Typed, anon key only. |

</details>

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
| 2026-06-12 | 1 | Vitest: 2 files / 20 tests; Playwright: 1 file / 3 tests; pgTAP: 6 files / 56 tests (run twice: pre- and post-reset) | 79 | 0 | Phase 1 gate run. Seed verified: 7 auth users, 2 commissions, 6 members, 2 published versions, 10 submitted + 1 in_progress responses. Auth sanity: admin@test.local, chefe.ccih@test.local, staff1.ccih@test.local all return access_token. Reset+pgTAP cycle stable. |
| 2026-06-12 | 1 | Vitest: 2 files / 20 tests; Playwright: 1 file / 3 tests; pgTAP: 6 files / 65 tests | 88 | 0 | QA loop-back re-run after migration 100008 (RLS hardening). All suites green. Seed counts unchanged: 7 users, 2 commissions, 6 members, 2 published versions, 10 submitted + 1 in_progress. |

## QA Verdicts

| Phase | Verdict | Report | Blockers/Majors | Follow-ups carried |
| ----- | ------- | ------ | --------------- | ------------------ |
| 0 | APPROVED | [phase-0-review.md](docs/reviews/phase-0-review.md) | None | MINOR-1: set lang="pt-BR" in layout.tsx (Phase 2); MINOR-2: close stale supabase-start follow-up; INFO: update ADR 0001 to note --passWithNoTests removed |
| 1 | APPROVED (re-verified 2026-06-12) | [phase-1-review.md](docs/reviews/phase-1-review.md) | All resolved in M8: MAJOR-1 (USING clause fix + demotion test); MAJOR-2 (3 sign-off immutability tests added); MINOR-1 (eval_condition search_path); MINOR-2 (profiles never-deleted: policy split + trigger); MINOR-3 (version/commission guard trigger) | INFO-1: consider revoking anon DML/EXECUTE grants in Phase 8 hardening |

## Decisions

<!-- One line per decision; details in docs/decisions/ -->

| Date | Decision | ADR |
| ---- | -------- | --- |
| 2026-06-11 | Scaffolding & toolchain: Next 16/React 19, shadcn (radix/neutral), `vitest.config.mts` (ESM), Supabase CLI pinned as devDep, Chromium-only Playwright | [0001](docs/decisions/0001-scaffolding-and-toolchain.md) |
| 2026-06-11 | `jsdom` pinned to `^25` (jsdom@27 pulls an ESM-only transitive dep that crashes Vitest's forks pool on Node 20) — revisit when vitest/jsdom resolve the incompatibility | – |
| 2026-06-12 | Admin claim via a custom access token hook reading `profiles.is_admin` (not `app_metadata`); RLS helper falls back to a DB read so correctness never depends on the hook | [0002](docs/decisions/0002-admin-claim-access-token-hook.md) |
| 2026-06-12 | Database tests use pgTAP via `npx supabase test db` (richer assertions, native runner, per-file txn isolation) | [0003](docs/decisions/0003-pgtap-for-db-tests.md) |
| 2026-06-12 | Sign-off enforcement gated by an `app.feature_flags` row read by `submit_response`; OFF in Phase 1, flipped on by a one-line Phase 6 migration | [0004](docs/decisions/0004-signoff-feature-flag.md) |
| 2026-06-12 | `visible_when` v1 is a single condition (no AND/OR), CHECK-enforced shape + publish-time structural validation; documented extension point for AND/OR | [0005](docs/decisions/0005-visible-when-shape.md) |
| 2026-06-12 | Keep legacy env var names (`..._ANON_KEY`/`..._SERVICE_ROLE_KEY`) while accepting new-style publishable/secret CLI keys | [0006](docs/decisions/0006-supabase-api-key-naming.md) |

## Follow-ups / Deferred Items

- [ ] (minor QA findings, nice-to-haves, tech debt — reviewed at each phase start)
- [ ] Choose the sanitizing Markdown renderer library (ARCHITECTURE.md Rule 7) — deferred from scaffold; needs its own ADR before Phase 4/5.
- [x] Run `supabase start` to confirm the local stack boots from a clean clone (Phase 0 acceptance). — Done 2026-06-11 (backend task #1; REST + Auth healthy).
- [ ] Set `lang="pt-BR"` in `src/app/layout.tsx` (QA Phase 0 MINOR-1) — frontend, due before Phase 2 ships user-facing content.
- [x] ADR on the new Supabase CLI publishable/secret key scheme (env var names kept) — Done 2026-06-12, ADR 0006.
- [ ] Register the custom access token hook in the production Supabase dashboard (ADR 0002) — Phase 8 deploy checklist.
