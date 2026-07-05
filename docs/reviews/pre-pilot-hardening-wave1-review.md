# QA Review — Pre-Pilot DB Hardening, Wave 1

**Reviewer:** `qa` (final-gate) · **Date:** 2026-07-05 · **Branch:** `feat/pre-pilot-hardening` · **HEAD:** `68b393b`
**Scope:** WS-1…WS-5 (critical set C-1…C-6 + H-8; §5 do-now D1/D2/D4/D6-flip/D7/D9; §4 perf P1/P9/P10). D3 + P7 DEFERRED (recorded).
**Method:** static review of all 8 migrations + 9 pgTAP suites + 4 ADRs + the 2 gate-fix diffs, plus **independent live-DB verification** against the seeded local Postgres (RLS-simulated as each seeded persona). Full ordered pgTAP (Files=65/Tests=1616) and full E2E triage owned by the lead — not re-run here.

---

## Verdict

**APPROVED.**

Wave 1 closes the full critical set (C-1…C-6 + H-8) and the scoped §4/§5 do-now items as designed. Every blocking invariant was verified to hold on the live database, not merely asserted by passing tests. The deferrals (D3, P7) are properly recorded with rationale. No BLOCKER or MAJOR findings. Five INFO/MINOR observations are logged below for hygiene and Wave-2 follow-up; none gates the pre-pilot push.

---

## Dimension 1 — Requirements audit (C-1…C-6 + H-8 closed as scoped?)

Every critical is closed, and — the QA bar — the tests test the *right thing* (the hole is structurally shut, not just the happy path green). Confirmed against the live DB:

| Item | Requirement | Live-DB proof | Status |
|------|-------------|---------------|--------|
| **C-1** | audit_log DML/TRUNCATE locked; immutability intact | authenticated TRUNCATE → `permission denied`; superuser TRUNCATE → HC042; row DELETE/UPDATE → HC042 (guard untouched); GUC-gated maintenance TRUNCATE allowed | ✅ |
| **C-2** | default `GRANT ALL … authenticated` revoked forward | `pg_default_acl` for role `postgres` shows authenticated revoked on TABLES/FUNCTIONS/SEQUENCES; all 86 tables + 292 functions are `postgres`-owned (the migration path) | ✅ |
| **C-3** (H-6,H-7) | membership write-path locked to DEFINER RPCs | direct INSERT to `organization_members` / `pqs_members` as org_admin/nsp_org_admin → `permission denied`; self-grant via RPC → 42501; anti-lockout → HC081; blanket audit fires on every path incl. service-role | ✅ |
| **C-4** | audit-access forgery closed via entitlement guard | allow-list ⊆ dispatch map (14/14 mapped); cross-tenant forgery → 42501; null-uid → 42501; fail-closed ELSE | ✅ |
| **C-5** | answers tied to a real item-in-version | foreign item_id → FK 23503; mismatched question_key → FK 23503; `form_version_id NOT NULL` | ✅ |
| **C-6** | all DB-side PHI disposed; claim narrowed | `dispose_case_phi` clears/redacts every PHI column in the case graph (verified below); audit row PHI-free; double-dispose HC056; §6.4 leak closed | ✅ |
| **H-8** | cross-hospital CAPA write closed | `can_write_capa(pqs.B, hospitalA-CAPA)` = false; pqs.B direct UPDATE → `UPDATE 0` | ✅ |

**Deferrals correctly recorded (not silently dropped):** D3 (junction-table normalization) is HELD per the 2026-07-05 user scope call, documented in the W1-T4 PROGRESS row and the program plan §0/WS-7. P7 (audit_log range-partitioning) is DEFERRED with a *correct* technical rationale inline in `20260711000800_perf_indexes.sql:9-17` — time-partitioning would force `occurred_at` into every per-chain-seq unique index and break the monotonic-per-chain-seq tamper-evidence invariant; the right axis is `chain_key` LIST/HASH. This is a sound call, not a punt.

---

## Dimension 2 — RLS / privilege security

**Membership write lockdown (C-3 / WS-1) — no residual direct-write path.** Live catalog confirms:
- `organization_members`: only `organization_members_select` (SELECT) policy; no INSERT/UPDATE/DELETE grant to `authenticated`.
- `pqs_members`: **zero** policies (the intended "no policy = DEFINER-door-only" posture, mirroring `case_access`); no DML grant.
- Both self-escalation vectors (C-3a org_admin→nsp_coordinator; C-3b nsp_org_admin→pqs_members) are shut *by construction* (grant + policy both removed), verified live.
- The blanket `AFTER` audit triggers emit `organization_member.granted/role_changed/revoked` and `pqs_member.enrolled/removed` on **any** write path — I confirmed the service-role provisioning write (`platform/actions.ts:197`) IS audited (audit_before 10 → after 11, `organization_member.granted`), so H-6's "grants audited inconsistently" is fully closed.

**New DEFINER RPCs are correctly hardened.** For all of `assign_org_admin`, `revoke_org_admin`, `add_pqs_member`, the 8 vocab RPCs, `open_capa_plan`, the 4 `dispose_*`, `get_referral_detail`, `log_audit_access`: `SECURITY DEFINER` = true, owner = `postgres`, `search_path` pinned (`app, public, pg_catalog`), and `anon` EXECUTE = **false**. `_deny_self_grant` is correctly a non-DEFINER raise-helper called under the DEFINER's context. Self-grant exclusion (HC081 anti-lockout, `_deny_self_grant`) verified to actually hold.

**C-4 entitlement guard — allow-list ⊆ dispatch is complete.** All 14 allow-listed actions have a dispatch arm keyed on the entity's own `can_read_*` predicate; the ELSE fail-closes; `_audit_access_authorized` is `STABLE SECURITY DEFINER` and resolves `auth.uid()` from the request GUC. No action logs "authorized" without a real read check. The two coarse export actions (`response.exported`, `audit.exported`) correctly fall back to a `p_commission` staff_admin/commission_admin standing check — the ADR-0053 residual (same-actor/same-scope) is documented and accepted, and the cross-tenant vector is closed (verified: a plain staff forging `referral.viewed` for a referral they can't read → 42501).

---

## Dimension 3 — PHI (Rule 12) + C-6 narrowed claim

**`dispose_case_phi` walked end-to-end on the live DB** (case #1, "Óbito UTI leito 7", has_patient=t). Before → after (verified as superuser, since the `authenticated` reader is correctly PHI-blind):

| PHI-bearing column/table | before | after |
|---|---|---|
| `case_patient` row | 1 | 0 (deleted) |
| case-phase `answers` | 2 | 0 (deleted — full erasure, not redact-in-place) |
| `case_narratives.body_md` | 2 non-null | 0 non-null |
| `case_events.{title,body}` | 2 | all `[PHI removido]` |
| `case_interviews.summary_md` | 1 | 0 non-null |
| `case_interview_subjects.note` | 0 | (n/a) redact path present |
| `case_documents.{title,description}` | 2 | title redacted, description null |
| `meeting_cases.{summary,decision}` | 1 | redacted |
| `cases.label` | "Óbito UTI leito 7" | `[PHI removido]` |
| `has_patient` | true | false |

The governance skeleton is preserved (`case_phases.result_id` is not recomputed on answer-delete — the only recompute trigger is `sync_case_phase_on_submit` on responses UPDATE). The audit row (`case_patient.disposed`) carries **no PHI** — summary uses `case_number` (governance metadata), metadata is only `{"reason":"retention_expired"}` (Rule 11 upheld). Double-dispose → HC056. The `dispose_event_phi` / `dispose_referral_phi` gap-fills (`rca_evidence.*`, `rca_why_chains.root_text`, `referral_reply_attachment.title`) and the new `dispose_meeting_minutes` were reviewed statically and are consistent with the same pattern (scoped `set local` GUC bypasses, one-shot HC056, PHI-free audit verb).

**§6.4 leak closed** (verified live): `get_referral_detail` as a broad-but-non-PHI reader (`staff1.ccih`: `can_read_referral`=t, `can_read_referral_phi`=f) returns `frozen_storage_path`=null, `frozen_body_md`=null, `decline_note`=null, `description_md`=null; the source coordinator sees the real path + body. The gate is discriminating, not blanket-nulling.

**ADR 0056's narrowed claim is truthful and consistent** with the code and Rule 6. Storage objects are deliberately retained (immutable per Rule 6, encrypted at rest, under the 20-yr LGPD/ANVISA/CFM retention regime); the DB-side claim ("every PHI-classified column/table empty or redacted post-dispose") matches what I observed. This reconciles LGPD Art. 18 erasure with CFM retention correctly.

---

## Dimension 4 — Integrity invariants

- **C-5 composite FK** `answers(item_id, form_version_id, question_key) → form_items(id, form_version_id, question_key)`: forces both "item ∈ version" AND "key is the item's real key". Verified: a foreign item_id and a poisoned question_key both raise 23503. `derive_answer_version` BEFORE-INSERT correctly auto-fills `form_version_id` from the response (ignoring any client value), and BEFORE-INSERT-only means the on-conflict UPDATE path preserves it.
- **D2 tenant composite FK** + `guard_hospital_org_repoint` (HC082): a populated-hospital org-repoint is blocked live with a clean pt-BR message; the composite FK backstops it. The single-column FKs are kept for their ON DELETE RESTRICT. ADR 0054 accurate.
- **Audit hash-chain (Rule 11) intact:** the WS-1 blanket triggers route via `audit_write`'s existing 8-arg org/hospital form (chain-key precedence: hospital_id set → hospital chain, null → org chain), so tier assignment is correct and no PHI is copied into the log (verified in the disposal audit row and the membership-grant rows). C-1's TRUNCATE guard is a *separate* statement-level function; the row-level DELETE/UPDATE immutability guard is unconditional and untouched.
- **CAPA trigger ordering** (D4): live `pg_trigger` confirms BEFORE-INSERT fires `derive_capa_hospital_trg` → `guard_capa_status_trg` → `mint_capa_code_trg` (alphabetical), so `hospital_id` is set before the per-hospital code is minted. `mint_capa_code` filters MAX + advisory lock per hospital; UNIQUE flipped to `(hospital_id, code)`.
- **D6-flip** live: `form_items_input_vs_display` CHECK now has `ELSE false`.
- **D9** live: submitted response with null `submitted_at` → CHECK violation; the other lifecycle pairs (cases.closed_at, case_referral *_at/*_by) are present.
- **D1** RESTRICT: all 6 SET-NULL-×-shape-CHECK FKs flipped to `confdeltype='r'`. (The seeded delete-path test hit the pre-existing `guard_event_status` first — expected defense-in-depth layering; the FK is the deeper backstop for the cited-artifact delete paths that the status guard doesn't cover. pgTAP 193 exercises the actual cascade.)

---

## Dimension 5 — Architecture rules

- **Rule 5/6 immutability untouched:** published-structure guard and storage immutability are preserved; C-6 explicitly retains Storage objects.
- **Rule 9 (no inline supabase-js):** both gate fixes stay in the query layer — `listHospitalsForOrg` (`src/lib/queries/org.ts:120`) pins the embed to `commissions!commissions_hospital_id_fkey` (closes the D2-induced PGRST201 ambiguity); the P1 `cache()` wrap is in `src/lib/queries/session.ts` (`import { cache } from 'react'` confirmed). No direct write to `organization_members`/`pqs_members` from `src/lib` (the only membership writes are the RPCs, plus the platform-admin-gated service-role provisioning door — see INFO-1).
- **Rule 2 canonical schema not contradicted:** all changes are additive columns / constraints / RPC re-gates; no canonical shape reversed. Generated types regenerated (per the PROGRESS rows; tsc/eslint 0).
- **Rule 10 (pt-BR):** every new user-facing raise carries a pt-BR message (HC081/HC082/HC083/HC042/HC056 all pt-BR; no raw Postgres error surfaced by the RPCs).

---

## Dimension 6 — Perf changes (WS-5)

The 9 `(select auth.uid())` InitPlan wraps on the hot answers/answer_selected_options/responses/cases/organization_members policies are **meaning-preserving**: `(select auth.uid())` is an equivalent scalar (auth.uid() is STABLE), evaluated once per query instead of per row. The recreated policies are `for select`/`for all`/`for insert`/`for update` with identical `using`/`with check` predicates (only the `auth.uid()` → `(select auth.uid())` substitution) — I diffed each against its purpose and none changed the access decision. The recreated `organization_members_select` remains SELECT-only (no write capability re-introduced) and preserves the self-read arm (`user_id = (select auth.uid())`) that getSessionContext depends on. The RLS pgTAP suites (40/70/80/30/172/184/189) passing on the green run are the behavioral proof; the P9/P10 indexes and P1 cache() are additive and correct.

---

## Findings (all non-blocking)

- **INFO-1 — service-role membership provisioning door.** `src/lib/platform/actions.ts:197` upserts `organization_members` via the admin client rather than `assign_org_admin`. Verified acceptable: gated by `requireAdmin()` (platform admin), service_role is RLS-exempt by WS-1's explicit design, and the write IS audited by the blanket trigger (confirmed live). *Optional* uniformity improvement: route the first-org_admin provision through `assign_org_admin` (platform admin passes its `is_admin()` authority). Not required for Wave 1.
- **INFO-2 — `open_capa_plan` FE call omits `p_hospital_id`.** `src/lib/safety/capa-actions.ts` doesn't pass `p_hospital_id`. Backward-compatible by design: single-hospital operators auto-derive; multi-hospital operators get a clean HC083 pt-BR raise. Documented FE follow-up (ADR 0055 / W1-T5 row). Not a Wave-1 blocker.
- **INFO-3 — `dispose_meeting_minutes` has no FE wiring.** The RPC + audit path are correct and tested; the action/UI is a logged FE follow-up (ADR 0056 (a)). The disposal-copy narrowing (ADR 0056 (b)) and the non-PHI "motivo da recusa" field (ADR 0056 (c)) are the product-facing follow-ups to track before the pilot exposes disposal UI.
- **INFO-4 — C-2 scope is the `postgres`-owned default only.** The flip correctly targets role `postgres` (which owns all app objects). The `supabase_admin`-owned platform default still grants `authenticated` on future `supabase_admin`-created objects — outside the app migration path, and consistent with the migration's stated intent. Worth a one-line note in `docs/backend-state.md` so a future author knows a table must be created as `postgres` for the C-2 posture to apply.
- **MINOR-5 — TRUNCATE not revoked from the two membership tables.** WS-1 revoked `insert, update, delete` (not TRUNCATE) from `authenticated` on `organization_members`/`pqs_members`; C-1 additionally revoked TRUNCATE on `audit_log`. TRUNCATE is not reachable via PostgREST (no REST verb maps to it) and `authenticated` cannot cascade-truncate into these tables from a granted parent, so this is latent, not reachable — but by C-1's own "close it because it's free on a security-relevant table" reasoning, a `revoke truncate on organization_members, pqs_members from authenticated` would be a cheap consistency win. Non-blocking; suitable for the Wave-2 sweep.

---

## Gate posture

- Build-complete: tsc 0 · eslint 0-err · Vitest 193/193 · full ordered pgTAP Files=65 / Tests=1616 PASS (lead-confirmed, independent fresh reset).
- Full E2E (standalone prod, rerun #2): 531 pass / 21 fail — all 21 lead-triaged to the documented BUG-AIF-001 / prod-flaky baseline (Windows-prod-standalone RSC server-action truncation; empirically green on `next dev`). The two genuine regressions (D2 embed PGRST201, D7 vocab persona) are fixed and green.
- The full E2E suite remains the lead's to run; this review did not re-run it.

**Recommendation: APPROVED — proceed to human approval and the user-authorized remote deploy.**
