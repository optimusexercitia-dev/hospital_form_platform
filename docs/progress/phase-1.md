# PROGRESS archive — Phase 1

> Archived from `PROGRESS.md` to keep the live file small. Cross-phase logs
> (Bug Log, Test Run Summary, QA Verdicts, Decisions, Follow-ups) remain in
> `PROGRESS.md`. This file is the detailed record of Phase 1's tasks.

<details><summary>Phase 1 tasks (completed 2026-06-12)</summary>

| Task | Owner | Status | Depends on | Notes |
| ---- | ----- | ------ | ---------- | ----- |
| Core schema migrations (profiles trigger, commissions, members, forms, versions, sections, items, admin claim) | backend | done | – | Migrations 100001–100003. Admin claim via custom access token hook (ADR 0002). |
| Response lifecycle migrations (responses, answers, signoffs, immutability triggers, display-item rejection) | backend | done | core schema | Migration 100004. Published + submitted immutability + display-item rejection triggers. |
| Condition evaluator + `submit_response` RPC + publish validation, with SQL unit tests | backend | done | lifecycle | Migration 100005. Sign-off check feature-flagged OFF (ADR 0004). pgTAP `20`/`30`/`50` green. |
| Full RLS policy set + `is_member_of`/`is_staff_admin_of` helpers + `form-assets` bucket policies | backend | done | lifecycle | Migrations 100006–100007. Deny-by-default; pgTAP `40` green. Fixed a profiles-policy RLS recursion (now a privileged-column trigger). |
| Seed: personas, 2 commissions, unsectioned + sectioned sample forms, ~10 responses | backend | done | RPC + RLS | `seed.sql`: 7 users, 2 commissions, 2 published forms, 10 submitted + 1 in_progress. Survives `db reset`. |
| RLS/RPC test suite (pgTAP or SQL) + regenerate types | backend | done | seed | pgTAP suite 56/56 via `npx supabase test db` (ADR 0003). Types regenerated; `typecheck` + Vitest evaluator (18/18) green. |
| QA Phase 1 loop-back: RLS hardening (MAJOR-1, MINOR-1/2/3) + signoff-immutability test (MAJOR-2) | backend | done | RLS/RPC suite | Migration 100008. staff_admin UPDATE role-restricted; eval_condition search_path pinned; profiles no-delete (policy + trigger); response version↔commission guard. pgTAP **65/65**; typecheck + Vitest green. INFO-1 deferred to Phase 8. |

</details>
