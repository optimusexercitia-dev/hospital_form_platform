# Pre-Pilot DB Hardening Program — Consolidated Remediation Plan

**Status:** PROPOSED (planning; not started) · **Date:** 2026-07-04 · **Owner:** platform lead →
`backend` (+ `frontend` for P1/P3/P4 app-side).
**Posture:** pre-launch, **reset-OK** — no live data, so we fix the *correct* shape, not back-compat
(see memory `prelaunch-db-reset-ok`).
**Sources:** `../reviews/external-db-audit-2026-07.md` (audit) ·
`../reviews/external-db-audit-2026-07-evaluation.md` (full triage) ·
`../reviews/external-db-audit-2026-07-perf-datamodel-analysis.md` (§4/§5 table).
**Absorbs:** `./membership-write-path-lockdown.md` as **WS-1** (do not duplicate — it stays the
authoritative detail for C-3).

This is the umbrella program for everything the platform agreed to remediate from the 2026-07 audit:
the critical set **C-1…C-6 + H-8**, and the §4/§5 performance and data-model table (**P1–P10, D1–D12**).
It sequences those ~30 items into waves mapped to migration windows and the CLAUDE.md §6 Phase Gate,
and defers three genuinely phase-sized refactors to their own scoped plans.

---

## 0. What this covers (and what it doesn't)

**In scope (this program):**
- Critical set: **C-1** (audit_log TRUNCATE/DML), **C-2** (default GRANT ALL), **C-3** (membership
  self-escalation → WS-1), **C-4** (forgeable audit rows), **C-5** (`answers` no form FK), **C-6** (PHI
  disposal incomplete), **H-8** (cross-hospital CAPA write).
- §4 performance: **P1–P10**.
- §5 data model: **D1–D4, D6-flip, D7, D9** (do-now) and **D8, D10, D11, D12** (calibrated).

**Deferred to their own scoped plans (each sized like the WS-1 plan; tracked in Wave 3):**
- **D5 / §6.2** — hospital-scoped patient master (also the single LGPD-erasure door for C-6).
- **D6 / §6.3** — the *full* metadata-driven `form_item_types` refactor (the one-line `ELSE false`
  safety flip ships now in WS-3; the lookup-table refactor is the deferred track).
- **§6.1** — the full single-`memberships` collapse (WS-1 ships the *minimum-viable* lockdown that makes
  C-3/H-6/H-7 structurally impossible; the table collapse remains a separate future project).

**Explicitly not doing:** anything that assumes live data or back-compat migrations (we reset).

---

## 1. Workstreams

Each workstream lists its items, the concrete change (with verified line refs), files touched, and the
per-item test. **Plan-review level** per CLAUDE.md §6: 🔴 full plan review (novel RLS shape / DEFINER
read path / privilege model / immutability triggers) · 🟢 one-line plan + ack (routine additive /
mechanical / mirrors an approved pattern).

### WS-1 · Membership write-path lockdown — **C-3** (H-6, H-7) 🔴
**Authoritative detail:** `./membership-write-path-lockdown.md` (already written). In one line: revoke
direct `INSERT/UPDATE/DELETE` on `organization_members` + `pqs_members`, drop the `FOR ALL` write
policies, funnel every grant through guarded `SECURITY DEFINER` RPCs with a shared
`app._deny_self_grant()` self-exclusion, add the missing `assign_org_admin`/`revoke_org_admin` (+
anti-lockout on the last org_admin), patch `add_pqs_member`'s missing self-check, and add blanket
`AFTER` audit triggers on both tables. pgTAP-locked. **This is item #1 of the whole program.**

### WS-2 · Grant hardening — **C-1, C-2, C-4** (the REVOKE/guard cluster) 🔴 (C-4) / 🟢 (C-1, C-2)

| # | Change | Refs / mechanism | Test |
|---|---|---|---|
| C-1 | `REVOKE TRUNCATE, DELETE, UPDATE, INSERT ON public.audit_log FROM authenticated` (leave `SELECT`); add a `BEFORE TRUNCATE ON audit_log` arm to the immutability guard | `GRANT ALL` at baseline:24779; `guard_audit_immutable_trg` (baseline:19923) has no TRUNCATE arm; `guard_audit_immutable` raises `HC042` (baseline:2079) | pgTAP: `authenticated` TRUNCATE/DELETE/UPDATE all raise; `SELECT` still works; `audit_write` (DEFINER) still inserts |
| C-2 | Flip `ALTER DEFAULT PRIVILEGES … GRANT ALL ON TABLES/FUNCTIONS TO authenticated` to **revoke-and-grant-per-object** (drop the blanket default; grant explicitly per new table/function) | baseline:24935–24946 | pgTAP: a freshly-created table has **no** `authenticated` privilege until explicitly granted |
| **C-4** | **NOT a blanket revoke** (see box). Add an **entitlement guard** inside `public.log_audit_access`: the caller (`auth.uid()`) must have standing in `p_commission` before `audit_write` runs; optionally derive `p_commission` server-side from `(p_entity_type, p_entity_id)` and ignore the caller's value | wrapper at baseline:11982 (SECURITY DEFINER, validates *only* the action verb); actor is server-derived in `audit_write` (baseline:1020, `v_actor := auth.uid()`) | pgTAP: a member of commission A calling with `p_commission = B` raises; the 6 legit callers still succeed. E2E: audit-export + a PHI-view still emit their rows |

> **C-4 correction surfaced during planning (important):** the audit — and my own earlier triage —
> said "revoke the public `authenticated` grant." **That would break six legitimate call sites** that
> invoke `log_audit_access` *from app code as `authenticated`*: `meetings.ts:575`, `interviews.ts:388`,
> `safety-events.ts:237`, `submissions.ts:343`, `dashboard/export/route.ts:74`,
> `manage/audit/export/route.ts:87`. The forgery vector is **caller-supplied `p_commission`/`p_entity`
> with no standing check**, not the grant itself. Because `audit_write` derives the actor from
> `auth.uid()`, a forger **cannot frame another user** — the real (and only cross-tenant) risk is
> injecting a chain-valid row into a commission they have no relationship with. The fix is therefore an
> **entitlement guard in the wrapper**, which closes the cross-tenant vector while preserving every
> legit caller. Residual after the fix: a user can still emit a false `*.viewed` row *about their own
> reads within a commission they already belong to* — low severity, same-actor, same-scope. The fuller
> design (emit the audit row from inside each read DEFINER door, never from the client) is noted as
> deferred hardening, not required pre-pilot.

### WS-3 · Data-model integrity & correctness — **C-5, D1, D2, D3, D4/H-8, D6-flip, D7, D9**

| # | Change | Refs / nuance | Review | Test |
|---|---|---|---|---|
| **C-5** | Add `form_version_id uuid` to `answers`; composite FK/unique tying `(form_version_id, question_key)` to a real item in that version; keep deriving `question_key` server-side | `answers.question_key` baseline:17896; `save_section_answers` defends only procedurally | 🔴 | pgTAP: insert with a foreign/absent `question_key` for the version raises; valid save unaffected |
| D1 | `capa_plan_source_shape` / `rca_evidence` shape: `SET NULL`→`RESTRICT`, **or** add a "detached" state to the CHECK | mitigated today by `guard_event_status_trg` (blocks raw deletes of triaged/closed events) — narrow but real | 🟢 | pgTAP that **actually deletes** a parent event and asserts a clean outcome (not an opaque abort) |
| D2 | `UNIQUE(id, organization_id)` on `hospitals` + composite FK on `commissions(hospital_id, organization_id)` + a guard trigger on `hospitals` org-repoint | commissions-only derive trigger today; **skip `profiles.home_*`** (descriptive, not an access boundary) | 🔴 | pgTAP: `UPDATE hospitals SET organization_id` either cascades correctly or is blocked — never silently desyncs children |
| D3 | Move FK-bearing data out of jsonb/arrays into junction tables (pattern: `case_phase_offered_results` exists): `case_phases.allowed_result_ids`, `result_ruleset` result-ids, `blocks integer[]` | shipped `reorder_template_phase` already remaps `blocks` atomically — this normalizes *future* paths, not a live bug | 🔴 | pgTAP: deleting a `phase_results` row is visible to the DB (no dangling UUIDs); reorder still valid |
| **D4/H-8** | `NOT NULL hospital_id` on `capa_plan`; scope `can_write_capa` non-event branch to that hospital (replaces `is_pqs_member_of_any`); scope `mint_capa_code`'s code + lock per hospital (also closes **P8** for CAPA) | non-event branch = `is_pqs_member_of_any` at nsp_per_hospital:673; global lock key `'pqs:capa_code'` | 🔴 | pgTAP: PQS member of hospital A cannot `PATCH` hospital B's manual CAPA; code sequence is per-hospital |
| D6-flip | `form_items_input_vs_display` CHECK: `ELSE NULL::boolean` → `ELSE false` (close the silent validation hole) | baseline:18268; NULL CHECK result = "satisfied" | 🟢 | pgTAP: an unlisted `item_type` now **fails** the input-vs-display CHECK instead of passing |
| D7 | Dual-scope (`action_item_statuses` pattern: nullable `hospital_id` + partial uniques) for `pqs_event_types` + `pqs_sentinel_criteria` only | **do not** touch `referral_types`/`reply_outcomes` (super-admin `is_admin()`-gated — a different, non-bug) | 🟢 | pgTAP: a single-hospital PQS member can no longer edit vocab another hospital sees |
| D9 | A dozen lifecycle-state CHECKs: `responses` (`submitted` ⇒ `submitted_at NOT NULL`), `cases.closed_at` paired to status, `case_referral` `*_at`/`*_by` pairs | all confirmed unconstrained | 🟢 | pgTAP: each impossible state (e.g. `submitted` + null `submitted_at`) raises |

### WS-4 · PHI disposal completion — **C-6** (+ §6.4 path-leak) 🔴
LGPD Art. 18 "patient erased" is not truthful today. `dispose_case_phi` (baseline:10282) today only:
deletes `case_patient`, nulls `case_narratives.body_md`, redacts `case_events.body`, flips
`cases.phi_disposed_*`. It **leaves intact**: form `answers` on the case's phases, interview summaries,
**meeting minutes (no disposal path exists at all)**, `cases.label` (self-labeled PHI-bearing),
`case_documents` metadata, and every **Storage object**.

- **Audit all three `dispose_*` bodies** for full closure: `dispose_case_phi` (baseline:10282),
  `dispose_event_phi` (nsp_per_hospital:1250), `dispose_referral_phi` (nsp_per_hospital:2286).
- **Extend each** to reach every PHI-bearing satellite it owns (answers, interview summaries, minutes,
  `label`, `case_documents` metadata).
- **Add a meeting-minutes disposal path** (none exists).
- **Storage objects:** either delete the bucket objects inside dispose (preferred), or **narrow the
  erasure claim in writing** (ADR) — the current claim must become truthful one way or the other.
- **§6.4 leak:** stop `get_referral_detail` (baseline ~10991) returning `frozen_storage_path` to
  metadata-only readers.
- **Review:** 🔴 (touches the PHI trust boundary + Storage). **Test:** pgTAP asserting each PHI table is
  empty/redacted post-dispose; E2E that a disposed case/event/referral leaks no residual PHI field.

### WS-5 · Performance — cheap pre-launch wins — **P1, P7, P9, P10**

| # | Change | Refs | Review |
|---|---|---|---|
| P1 | `export const getSessionContext = cache(async …)` (React `cache`) | uncached at `session.ts:123`; siblings cached :345/:444 | 🟢 (app-side; `frontend`/`backend` on `src/lib`) |
| P7 | Declaratively range-partition `audit_log` by month **while empty** | none today; guard trigger makes late re-partition painful | 🔴 (touches the immutability-guarded table) |
| P9 | Composite indexes `commission_members(commission_id, user_id)`, `organization_members(user_id, role, hospital_id)`, `pqs_members(hospital_id, user_id)`, `audit_log(hospital_id, occurred_at DESC)`; wrap hot policy predicates in `(select auth.uid())` | 0 `(select auth.uid())` today; only single-column membership indexes; no hospital-tier audit index | 🟢 (additive indexes) / 🔴 (policy-predicate edits) |
| P10 | `CREATE INDEX` the unindexed cascade/lookup FKs (`answers.group_instance_id`, `responses.last_section_id`, `case_phases.result_id`, `commission_members.title_id`, …) | all spot-checked unindexed | 🟢 |

### WS-6 · Performance — pilot-window sweep — **P2, P3, P4, P5, P8**
Not blockers; real at scale. **P2** — replace the `listAuditFilterActors` full-scan (audit.ts:596)
with a `SELECT DISTINCT`/view/RPC. **P3** — keyset pagination on `listSubmissions` (first),
`listCasesBoard`, `listMeetings`, `listCommissionReferrals`, `pqsInbox`. **P4** — `count: 'exact',
head: true` badges + one cached `get_feature_flags()`. **P5** — push the `listSubmissions` form filter
to the DB (`.eq('form_versions.form_id', …)`; fix the wrong "not filterable" comment at
submissions.ts:253). **P8** — per-scope CAPA counter (folded into D4). Review 🟢 (query-shape); test:
pagination + count E2E, and a regression check that filtered lists match pre-change results.

### WS-7 · Deferred structural tracks (own scoped plans) — **D5/§6.2, D6/§6.3, D12, P6**
Not built here; each gets a WS-1-style plan when scheduled. **D5/§6.2** patient master (+ single LGPD
door) · **D6/§6.3** full `form_item_types` metadata refactor · **D12** pick the one polymorphism dialect
**before Phase 16** adds a fifth · **P6** checkpointed `verify_audit_chain` (with the §6.5 evidence work,
pre-Phase-19).

### WS-8 · Optional / opportunistic — **D8, D10, D11**
Do only when an adjacent sweep is open. **D8** guard the forward-compat UUID-no-FK columns when
Phases 15/18 land (or exclude from the CHECK now). **D10** uniform `updated_at` touch trigger
(`cases`/`commissions`/`forms` lack the column). **D11** harmonize status-enum keys to English (internal
keys — **not** a Rule-10 breach).

---

## 2. Sequencing — waves

```
Wave 1  PRE-PILOT BLOCKER  ── one migration window + the Phase Gate ──────────────
        WS-1 (C-3)   WS-2 (C-1,C-2,C-4)   WS-3 (C-5,D1,D2,D3,D4,D6-flip,D7,D9)
        WS-4 (C-6)   WS-5 (P1,P7,P9,P10)
        └─ gate: build → full E2E green → qa → human approval → remote push

Wave 2  PILOT WINDOW        WS-6 (P2,P3,P4,P5,P8)      (perf; non-blocking)

Wave 3  STRUCTURAL TRACKS   WS-7: patient master (D5/§6.2) → metadata item types (D6/§6.3)
        (each its own scoped plan; sequence after Wave 1 lands)

Wave 4  PRE-PHASE-16 / OPP  D12, P6, then WS-8 opportunistically
```

**Dependency notes:** WS-1 is #1 and gates nothing else technically, but its audit-trigger + DEFINER-RPC
patterns are the templates WS-2/WS-4 reuse — land it first. D4 and P8 share the `mint_capa_code` change —
do them in one commit. P9's index pass and P10 belong in the same migration. D5/§6.2 subsumes part of
C-6 (single erasure door), so **do C-6 now for truthfulness** and let §6.2 *simplify* it later — don't
block C-6 on §6.2.

---

## 3. Migration batching & ownership

Under reset-OK, batch by review-sensitivity and table-domain to keep the gate legible and avoid two
teammates touching one file (CLAUDE.md §4). Proposed Wave-1 migrations (timestamps assigned at author
time; all `backend`-owned):

1. `…_membership_write_lockdown.sql` — WS-1 (per its own plan).
2. `…_grant_hardening.sql` — WS-2 (C-1 REVOKE + TRUNCATE guard; C-2 default-privileges flip; C-4
   entitlement guard).
3. `…_answers_form_fk.sql` — C-5 (isolated; it reshapes the hottest table).
4. `…_schema_integrity.sql` — D1, D2, D3, D6-flip, D7, D9 (the additive-CHECK / junction / dual-scope
   cluster).
5. `…_capa_tenant_anchor.sql` — D4/H-8 + P8 (`capa_plan.hospital_id`, scoped `can_write_capa`, per-hospital
   code/lock).
6. `…_phi_disposal_closure.sql` — WS-4 (C-6 + the `get_referral_detail` path-leak).
7. `…_perf_indexes_partition.sql` — P7, P9 (indexes + predicate wraps), P10.

**App-side (P1)** is a `src/lib/queries/session.ts` one-liner — `frontend` or `backend`, not a migration.
Generated types (`src/lib/types/database.ts`) are regenerated by `backend` after every migration (Rule 8).

---

## 4. Testing strategy

- **pgTAP is the lock** for every security/integrity item — each row above names its assertion. The rule
  is *the hole must not be able to silently reopen*: a negative test (the forbidden write raises) plus a
  positive test (the legit path still works). Re-run the **full ordered** `supabase test db` after a fresh
  reset — never trust a self-reported subset (memory `pgtap-fixture-flag-gaps`).
- **The D1 test must actually `DELETE`** a parent event — the current gap is precisely a test that never
  exercised the cascade.
- **E2E (Playwright):** C-4 (audit-export + a PHI view still write their rows; a direct cross-commission
  `log_audit_access` POST is rejected), WS-1 (a direct membership-table `POST` bypass attempt 401/403s),
  C-6 (post-dispose, no PHI field surfaces anywhere), P3 (pagination), P5 (filtered list parity).
- **Gate discipline (memory `subagent-cannot-run-full-e2e`, `e2e-foreground-run-recipe`):** the LEAD runs
  the full suite as a background command against a **prod build / standalone server** (memory
  `e2e-standalone-server-not-next-start`, `e2e-gate-prod-build`); triage failures against the flaky
  baseline (memory `e2e-prod-build-flaky-baseline`) before calling regression.

---

## 5. Rollout & gates

1. **Plan review** — the 🔴 items (WS-1, C-4, C-5, D2, D3, D4, WS-4, P7, P9-predicates) get a full plan
   review before code; the 🟢 items get a one-line plan + ack (CLAUDE.md §6 right-sized review).
2. **Build → gate** — Wave 1 goes through one Phase Gate: lint/typecheck/unit → tester full-suite green →
   qa review (`docs/reviews/…`) → human approval.
3. **Remote deploy** — `supabase db push` (or `db reset --linked` under reset-OK) is **user-authorized**;
   background agents are auto-denied (memory `remote-db-push-needs-user-auth`,
   `app-reads-local-migrations-push-remote`). Local first (`supabase migration up`), then the user runs the
   remote push.
4. **ADRs** — at least: C-4 entitlement-guard design; C-6 disposal-closure + the Storage
   delete-vs-narrow-the-claim decision; D2 tenant-composite-FK; D4 CAPA tenant anchor. 5–10 lines each in
   `docs/decisions/`.
5. **Record** — `PROGRESS.md` + `docs/backend-state.md` updated; this program's row flips per wave.

---

## 6. Corrections carried from the analysis (so implementers don't re-introduce them)

- **C-4 is an entitlement guard, not a revoke** (breaks 6 callers; actor is server-derived) — §1/WS-2 box.
- **C-1/C-2 are latent** (not app-reachable — no raw-SQL door, TRUNCATE isn't a PostgREST verb) — harden
  because it's free, not because it's live.
- **D2:** fix commissions/hospitals; **do not** extend to `profiles.home_*` (not an access boundary).
- **D3:** the shipped `reorder_template_phase` is already atomic — normalize for *future* paths, don't
  "fix" a reorder that isn't broken.
- **D7:** only `pqs_event_types`/`pqs_sentinel_criteria` — `referral_types`/`reply_outcomes` are
  super-admin-gated and out of scope.
- **D6:** ship the `ELSE false` flip now; the metadata refactor is Wave 3.
- Perf multipliers in the audit are estimates; the flag RPCs already run concurrently — chase payload and
  repeated-invocation cost, not round-trip counts.

---

## 7. Effort & risk

- **Wave 1 ≈ 5–8 backend days** + the gate: WS-1 (~1–2d, planned) · WS-2 (~0.5–1d) · WS-3 (~2–3d, C-5 and
  D3 are the heaviest) · WS-4 (~1–2d) · WS-5 (~0.5d). Frontend P1 ~15 min.
- **Risk is low and front-loaded to the gate**, not production: reset-OK means no data migration; the
  danger is a missed RLS/entitlement regression, which the pgTAP negative tests + the full-suite gate are
  designed to catch. The one behavioural-change-with-teeth is **D4** (a previously-allowed cross-hospital
  CAPA write now 403s) and **WS-1/C-4** (previously-allowed direct writes / forged rows now rejected) —
  all intended, all covered by E2E.
- **Rollback:** each migration is independent and, pre-launch, a `db reset` reverts cleanly; no
  online/back-compat concerns.

**Bottom line:** Wave 1 is the pre-pilot blocker and should land as one gated push, WS-1 first. Waves 2–4
follow on the pilot clock. The three deferred tracks (patient master, metadata item types, memberships
collapse) are the platform's structural-hardening backlog and each earns its own plan when scheduled.
