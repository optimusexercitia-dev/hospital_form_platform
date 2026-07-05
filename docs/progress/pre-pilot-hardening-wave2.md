# Pre-Pilot DB Hardening — Wave 2 (WS-6 perf sweep) — archived task detail

**Status:** ✅ COMPLETE + deployed to remote (`supabase db reset --linked`) — **2026-07-05.**
**Branch:** `feat/pre-pilot-hardening` · **Wave-2 commit:** `a2a7fab` (on top of Wave-1 `68b393b`).
**QA:** APPROVED (Sonnet, live-DB-verified) — 0 BLOCKER · 0 MAJOR *(1 found + fixed pre-deploy)* · 1 MINOR · INFO →
[pre-pilot-hardening-wave2-review.md](../reviews/pre-pilot-hardening-wave2-review.md).
**Program plan:** [pre-pilot-db-hardening-program.md](../plans/pre-pilot-db-hardening-program.md) §WS-6.

Wave 2 = the **P2/P3/P4/P5** performance sweep (WS-6). **P8 was already shipped in Wave 1**
(folded into D4, `capa_plan` per-hospital counter/lock, migration `…000600`). One additive migration
`20260711000900` + pgTAP `199` + E2E `perf-sweep-wave2.spec.ts`. All 🟢 query-shape / FE wiring, no new
RLS shape, pre-pilot reset-OK.

## Task detail (W2-T0 … W2-T3 + gate)

| Task | Owner | Verdict |
| -- | -- | ------ |
| **W2-T0 — contract-first** | backend | ✅ Signatures posted + lead-ACKED. `Page<T> = { rows, nextCursor }` + optional `page?: PageParams` in `src/lib/types/pagination.ts` (opaque base64url keyset cursor, decode-fail → page 1, default limit **25**). `listCasesBoard` **capped** (kanban ≠ flat list; `nextCursor` always null). |
| **W2-T1 — backend query layer** | backend | ✅ Migration `20260711000900_perf_sweep_wave2.sql`: **P2** `list_audit_filter_actors` (INVOKER, RLS-scoped, replaces full audit_log fetch-and-dedup); **P3** `pqs_inbox` keyset params `(p_cursor_reported_at,p_cursor_id,p_limit)` [operator-hospital gate preserved from `…000710`, ADR 0052] + `list_cases_board` `p_limit` cap + 5 keyset indexes; **P4** `get_feature_flags()` DEFINER + `src/lib/queries/feature-flags.ts` `getFeatureFlags = cache()` w/ 13 per-flag wrappers delegating (7-round-trips→1/request, automatic) + `count_open_cases_for_board(commission)` DEFINER mirroring the board's EXACT `is_staff_admin_of` visibility (a direct `cases` RLS count can't — `cases_select` = `can_read_case OR is_commission_admin_of` ≠ `is_staff_admin_of`); **P5** submissions form filter pushed server-side (`.eq('form_versions.form_id',…)`, wrong comment removed). pgTAP `199` (28 assn incl. board-count parity). Types regenerated. |
| **W2-T2 — frontend UI** | frontend | ✅ Part A: reusable `CursorPagination` (URL-driven `?cursor=`, `push` so browser-Back works, `null` on last page — **AIF-001-safe**, no data-returning action). Part B: wired into the 4 flat keyset lists (submissions, referrals, meetings, `/o/[org]/nsp` inbox); 8 `.rows` call-site rewires + 2 paired fallbacks + `layout.tsx` badge flip to `countOpenCasesForBoard`; cases board left **capped** (no control); filter bars reset `cursor` on change. **Post-review revisions:** (1) triage workstation reverted to a **full-backlog capped** load (`TRIAGE_QUEUE_CAP=200`, no control) so its topbar counts (awaiting/sentinel/rca) stay accurate over the whole backlog, not a page; (2) deleted unused `count-badge.tsx` (dead code). |
| **W2-T3 — acceptance specs** | tester | ✅ **13/13 green** (`e2e/perf-sweep-wave2.spec.ts`). P2 distinct-actor set + narrowing; P3 keyset on 4 lists via >25-row service-role/RPC fixtures (zero overlap + zero gap across pages, control hidden on true last page, browser-Back) + **`P3-submissions-tamper`** (crafted valid-JSON injection cursor → schema-rejected → byte-identical page-1 degrade); P4 flag-neutrality smoke + `countOpenCasesForBoard` badge parity; P5 form-filter exact-set parity. 12 non-tamper tests also 12/12 on prod-standalone (not dialog flows → no AIF-001). 2 spec-harness bugs fixed during authoring (spec-only). |

## Gate record

- **Build-complete:** tsc **0 (whole project)** · eslint **0** · Vitest **206/206** · full ordered pgTAP **66 files / 1644 tests PASS** (fresh reset).
- **Full E2E (standalone prod, lead):** **546p / 16f + 4 flaky** — **0 Wave-2 regressions.** Triaged by failure MODE (read the actual errors): all 16 = the BUG-AIF-001 dialog-refresh baseline (`toHaveCount(0)`/`not.toBeVisible()` after a write); **zero** Wave-2 signatures (no PGRST embed error, no `TypeError`/undefined from a `Page<T>` destructure, no count/cursor error); every Wave-2-touched screen that could regress (`phase8-dashboard`, `phase22-referrals`, `nsp`/`phase14b-triage`) **passed** on prod. Fewer failures than Wave-1's 21f baseline. Baseline dev-confirm: `phase3-admin-members` 15/15 + `phase10-meetings` 15/15 green on `next dev`.
- **QA APPROVED** (live-verified): `count_open_cases_for_board` parity **29 == 29** for the coordinator / **0** for a foreign staff_admin; `pqs_inbox` gate byte-for-byte unchanged (foreign-hospital caller sees nothing); P2 INVOKER + foreign-actor isolation; C-2 grant posture intact on all 5 new/changed objects (owner=postgres, anon denied); types regenerated; pt-BR + a11y on the control; no new mutation paths; no PHI exposure change.
- **QA MAJOR — cursor injection — found + FIXED pre-deploy.** The 3 flat-list keyset sites (`submissions`/`meetings`/`referrals`) interpolated client-round-tripped cursor fields into raw PostgREST `.or()` filter strings. Fix: `decodeCursor(cursor, schema)` strictly validates each field as ISO-timestamp / UUID (forms that structurally exclude `,()`) before interpolation; any tampered field → cursor rejected → page 1. Centralized in `src/lib/types/pagination.ts`; Vitest lock `src/lib/types/pagination.test.ts` (13 cases) + E2E `P3-submissions-tamper`. `pqsInbox` was already safe (binds typed RPC params). Query-layer only, valid cursors byte-identical → happy path unaffected.
- **Remote deploy:** `supabase db reset --linked --yes` 2026-07-05 — all migrations `…000000`–`…000900` applied + seed; `migration list --linked` confirms `20260711000900` present in Local **and** Remote (parity). Warnings (`25P01 SET LOCAL`, idempotent-drop NOTICEs) benign, identical to the Wave-1 deploy.

## QA findings (Wave 2)

- **MAJOR (cursor injection)** — FIXED pre-deploy (see gate record). Was bounded (couldn't escape `or=`, bypass RLS, or the `.eq()` scoping — worst case a user defeating their own pagination ordering within already-accessible data), fixed anyway because this is a hardening wave.
- **MINOR / INFO** — recorded in the review; the design decisions (board cap; workstation cap; user-scoped badges left un-counted) are documented as intentional pilot-scope calls (a hospital exceeding 200 open cases / 200 open triage items would want a dedicated count RPC — out of pilot scope).
