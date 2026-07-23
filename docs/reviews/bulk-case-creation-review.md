# QA Review — Bulk Case Creation ("Múltiplos casos", ADR 0084)

**Branch:** `feat/bulk-case-creation` · **Reviewer:** `qa` · **Date:** 2026-07-23
**Verdict:** ✅ **APPROVED** (4 MINOR/OBSERVATION items below — none blocking)

Scope reviewed: ADR 0084 (10 decisions + E1), the plan, `git diff main...feat/bulk-case-creation`
(commits `91b32d7 … 142b798`). Security dimension verified against the **live local catalog**
(`docker exec … psql`, freshly-reset stack) per ADR 0078 — not migration text. Automated-gate
evidence (pgTAP 29/29, E2E 8/8 prod-standalone, build/typecheck/lint/vitest green) audited for
coverage, not re-run.

---

## 1. Requirements — MET

All 10 decisions, E1, and the 8 acceptance criteria are implemented **and exercised**:

- **D1 (atomic composing RPC):** `public.bulk_create_cases` (catalog: `prosecdef=t`, 4 args) loops
  per row over `create_case_from_template` → `activate_phase` → guarded downstream update →
  `assign_narrative` → `set_case_patient`; per-row failures re-raise `linha N:` with SQLSTATE
  preserved; hard cap ≤ 200. pgTAP 7 (atomicity + `linha 2:` + 0 created) and 4 (cap) pin it.
- **D2 (client deal / server validates):** `distribute.ts::balancedDeal` is pure + RNG-injected
  (gap ≤ 1 by cyclic construction); the RPC writes the submitted owner map verbatim after
  validating authority + membership (pgTAP "owner map verbatim" L2→st_x2; E2E AC6 manual override).
- **D3 (pending + assigned_to):** `all_phases` pre-assigns downstream **pending** phases via a
  guarded `assigned_to`-only UPDATE under `app.in_case_rpc`; verified benign (see §3).
- **D4/D5 (deadline / activation):** deadline rides the first phase's `due_date` only, in both
  scopes (pgTAP 5/6; E2E AC4). First phase → `active`, case → `in_review` via
  `recompute_case_status` trigger (pgTAP "L1 transitioned to in_review").
- **D6/D8/E1 (PHI single door + selectable columns):** no new PHI table; `set_case_patient`
  composed per row; floor server-enforced (§3). E1 is frontend-only — `phiSelectionValid` +
  `phiFloorSatisfied` + serialization all mirror the server floor (`bulk-grid-model.ts:77,323,522`).
- **D7 (full-page wizard + grid + paste):** route + 4 steps + net-new grid; E2E AC2 exercises paste.
- **D9 (concurrency):** `pg_advisory_xact_lock(hashtextextended(commission))` at batch start.
- **D5 access + D10 flag:** staff_admin-only gate (§3); `cases_bulk_create` typed, seeded on
  (`seed.sql:2081`), catalog `enabled=t`.

E2E AC1–AC8 assert **DB truth via service-role reads** (phase status/assignee/due, narrative
assignees, `patient_identifiers.name` through the participant join) — not UI-only. Coverage is real.

## 2. Code quality — GOOD

- Route + board are Server Components; the action (`bulk-actions.ts`) uses the server-only
  supabase client and is passed to the client wizard as a prop — no service-role reachable client-side.
- pt-BR user text / English code (Rule 10). No bare `any` in any new file.
- Data access via queries/action layers (Rule 9). Board button and route independently gate on
  `staff_admin + flag + eligibleTemplates>0` (defense in depth over the RPC authority).

## 3. Security / RLS / PHI — SOUND (catalog-verified)

- **Authority gate (Rule 1):** `bulk_create_cases` raises `42501` unless
  `app.is_staff_admin_of(commission) OR app.is_commission_admin_of(commission)`. Neither helper
  consults the `create_cases` Administrativo capability, so the gate is **genuinely stricter** than
  `create_case_from_template` (Decision #5) **by construction**. GRANTs: `EXECUTE` to
  `authenticated` + `service_role` only; PUBLIC absent from the ACL. pgTAP 1/2 (plain member +
  foreign coordinator → 42501) are load-bearing (neutralizing the gate makes both create → RED).
- **PHI (Rule 12):** no fourth at-rest store; the composed `set_participant_patient` enforces, in
  order, `assert_case_patient_enabled` → **coordinator-only** (`is_staff_admin_of`, 42501) →
  `patient_enabled` → disposal → **name-or-MRN floor** (`…:39`). PHI cannot persist unless the
  atomic commit succeeds (per-row work rolls the whole batch back). **E1 cannot bypass the floor** —
  it is server-side and independent of the client column selection. pgTAP 8 proves write-through +
  batch-rollback rejection on a non-PHI template.
- **`pending` + `assigned_to` (D3) grants no unauthorized read:** `app._case_caps` S4 arm grants
  `read_case_content`/`read_case_deliberation` (NOT `read_standard_phi`) for `assigned_to = uid`
  **regardless of phase status**. Because `all_phases` assigns downstream pending phases to the
  **same owner** who already owns the active first phase, **no new reader** is introduced, and no
  PHI is conferred by assignment. The arm's semantics are unchanged by this feature.
- **The `app.in_case_rpc` GUC is not an escalation vector:** it is a session-settable custom GUC,
  but the real boundary is RLS — `case_phases_staff_admin_write` (FOR ALL) requires
  `is_staff_admin_of(...) AND NOT is_case_excluded(...)`. A non-coordinator cannot UPDATE
  `case_phases` even by setting the GUC themselves; a staff_admin gains nothing beyond what the RPCs
  already permit. The guarded write is safe.
- **Audit (Rule 11):** one batch row `cases.bulk_created` with `{count, template_id, phase_scope,
  deadline}` — **no identifiers**; per-case + per-PHI audits emit inside the composed doors.

## 4. Keystone / over-grant assessment — PASS

Authority (`42501`), membership (`HC021`), validation/cap (`23514`), and required-field (`HC068`)
use **distinct SQLSTATEs**, and authority is checked **first** (before the row loop). This makes the
authority/atomicity keystones vacuity-resistant per the memory lessons — a neutralized gate turns
pgTAP 1/2 red, and the atomicity test's `linha 2:` + count-unchanged assertions cannot pass a
partial commit. The keystones are genuinely load-bearing.

---

## Findings

**MINOR-1 (code quality) — stale `as never` casts + false comment.**
`src/lib/cases/bulk-actions.ts:157-167` casts the RPC name and args to `never`, justified by a
comment stating `database.ts` "is regenerated by the lead after this migration applies; until then
the RPC is absent from the generated types union." That is **stale** — `src/lib/types/database.ts:9535`
already carries `bulk_create_cases` (regenerated in `8ecf6c7`). The casts now defeat type-checking of
the RPC args against the generated signature. *Fix:* use the typed `.rpc('bulk_create_cases', {…})`
call and remove the casts + stale comment.

**MINOR-2 (test coverage) — the Decision-#5 distinguishing keystone is unpinned.**
pgTAP proves a plain member and a foreign coordinator are denied, but **not** that a member holding
the `create_cases` **Administrativo** capability is denied bulk creation — the exact delta between
this gate and `create_case_from_template`'s looser one. The exclusion is correct in the catalog (the
gate calls no administrativo helper), but a future refactor to an administrativo-aware helper would
pass every existing test. *Fix:* add a pgTAP arm — administrativo-granted `create_cases` member →
`42501`.

**MINOR-3 (Rule 8 robustness) — `mapError` prefers the raw message for non-42501 codes.**
`bulk-actions.ts:115-120` returns `error.message` verbatim for any code other than `42501`. The RPC
and its doors raise pt-BR, but an unexpected low-level Postgres error (e.g. a cast/overflow inside a
composed door) would surface **raw English** to the UI — unlike `actions.ts::mapCaseError`, which
maps by SQLSTATE with a generic fallback. Low likelihood given upstream validation, and the `linha N:`
prefix is preserved. *Consider:* mapping unknown non-pt-BR SQLSTATE classes to `GENERIC_ERROR`.

**OBSERVATION (not a defect) — commission-admin + PHI rows.**
The bulk gate admits `is_commission_admin_of` (org/hospital admin), but the PHI door is
`is_staff_admin_of`-only. An org/hospital admin bulk-creating a batch that includes PHI rows will hit
`42501` mid-row and the whole batch rolls back (fails **closed**). Consistent with the single-door
model; worth noting for UX (commission-admins can bulk-create non-PHI batches only).

---

**No blocking issue.** No RLS hole, no immutability/PHI leak, no client-reachable service-role key,
authority + PHI-floor keystones are load-bearing. The three MINOR items are quality/coverage
hardening and may be addressed pre-merge or tracked as follow-ups at the lead's discretion.
