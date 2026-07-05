# Pre-Pilot DB Hardening — Wave 1 (archived task detail)

**Status:** ✅ COMPLETE + deployed to remote (`supabase db reset --linked`) — **2026-07-05.**
**Branch:** `feat/pre-pilot-hardening` · **Gate-fix commit:** `68b393b` (on top of the 7 WS commits).
**QA:** APPROVED (Opus, live-DB-verified) — 0 BLOCKER · 0 MAJOR · 1 MINOR · 4 INFO →
[pre-pilot-hardening-wave1-review.md](../reviews/pre-pilot-hardening-wave1-review.md).
**Program plan:** [pre-pilot-db-hardening-program.md](../plans/pre-pilot-db-hardening-program.md) ·
WS-1 detail [membership-write-path-lockdown.md](../plans/membership-write-path-lockdown.md).

Wave 1 remediates the CRITICAL set (C-1…C-6 + H-8) + §4/§5 do-now (D1/D2/D4/D6-flip/D7/D9,
P1/P9/P10) of the 2026-07 external DB audit ([[external-db-audit-2026-07]]). One gated push.
**Human decisions (2026-07-04):** scope = Waves 1+2; C-6 = narrow the erasure claim via ADR
(keep Rule-6 storage immutability, dispose all DB-side PHI, retain encrypted-at-rest blobs under
the 20-yr LGPD/ANVISA/CFM retention regime). **D3 + P7 DEFERRED** (recorded in PROGRESS Follow-ups).

## Task detail (W1-T1 … W1-T7 + gate)

| Task | WS | Scope | Verdict |
| -- | -- | ----- | ------ |
| W1-T1 | WS-1 | C-3 (+H-6,H-7) membership write-path lockdown — migration #1, RPCs, blanket audit, pgTAP `[gate]` | ✅ commit `e588436`. Full pgTAP Files=57/Tests=1488 PASS (independent ×2). migration `20260711000000` + pgTAP `190`. HC081 anti-lockout; uniform `organization_member.*` verb; onConflict fixed (latent Phase-A bug). 4 stale direct-write tests migrated to the RPC door (+ C-3a vuln now positively encoded as a negative control). |
| W1-T2 | WS-2 | C-1 (audit_log REVOKE+TRUNCATE guard), C-2 (default-priv flip), C-4 (entitlement guard) + ADR 0053 | ✅ pgTAP Files=58/Tests=1512 PASS. migration `20260711000100` + pgTAP `191` + ADR 0053. C-1 revoke DML + statement-level BEFORE TRUNCATE guard (HC042); C-2 flip to revoke-default + grant-per-object (86/86 tables RLS-enabled); C-4 entitlement guard in `log_audit_access` dispatching each allow-listed action to the entity's `can_read_*` (14 arms, fail-closed + completeness pgTAP). TRUNCATE guard is a SEPARATE GUC-gated fn (`app.allow_audit_teardown`, fixture-only); row DELETE/UPDATE immutability untouched. |
| W1-T3 | WS-3a | C-5 `answers.form_version_id` + composite FK/unique | ✅ pgTAP Files=59/Tests=1524 PASS. migration `20260711000200` + pgTAP `192`. 3-col FK `answers(item_id, form_version_id, question_key) → form_items(id, form_version_id, question_key)`; FK-referenceable `form_items_id_version_key_uq`; `answers.form_version_id NOT NULL` auto-filled by BEFORE-INSERT `derive_answer_version`. Zero fixture churn; Rule 3 golden byte-for-byte. |
| W1-T4 | WS-3b | D1 (delete-path RESTRICT), D2 (tenant composite FK + guard) + ADR 0054, D6-flip (`ELSE false`), D7 (dual-scope vocab), D9 (lifecycle CHECKs) — **D3 DEFERRED** | ✅ 5/6 (D3 deferred). pgTAP Files=62/Tests=1557 PASS. 3 migrations `…000300`/`…000400`/`…000500` + ADR 0054. D2 keeps both single+composite FKs (`commissions(hospital_id,org_id)→hospitals(id,org_id)` + `hospitals_id_org_uq` + `guard_hospital_org_repoint` HC082). D7 dual-scope vocab (`hospital_id` nullable + partial uniques + 8 CRUD RPCs re-gated `can_curate_pqs_vocab` [global=is_admin, hospital=operator] + `save_triage` global∪event-hospital). `save_triage` recreated verbatim + hospital-scope filter. |
| W1-T5 | WS-3c | D4/H-8 + P8 — `capa_plan.hospital_id`, scoped `can_write_capa`, per-hospital code/lock + ADR 0055 | ✅ pgTAP Files=63/Tests=1573 PASS. migration `…000600` + pgTAP `196` + ADR 0055. `capa_plan.hospital_id NOT NULL` (derive trigger); `can_write_capa` collapsed to `is_pqs_operator_of_for(hospital_id)` (closes cross-hospital write hole); `mint_capa_code` per-hospital + UNIQUE(hospital_id,code); `open_capa_plan` +`p_hospital_id` (HC083). Latent `can_read_capa` manual-CAPA-invisible bug fixed. |
| W1-T6 | WS-4 | C-6 disposal closure (3× `dispose_*` + meeting-minutes path) + §6.4 `frozen_storage_path` leak + narrow-claim ADR 0056 | ✅ **CRITICAL SET (C-1…C-6 + H-8) CLOSED.** pgTAP Files=64/Tests=1600 PASS. migration `…000700` + pgTAP `197` + ADR 0056. `dispose_case_phi` completed (case-phase answers DELETED + full redaction graph); `dispose_event_phi`/`dispose_referral_phi` gap-fills; NEW `dispose_meeting_minutes` (decoupled, coordinator-gated); `get_referral_detail` hides `frozen_storage_path` AND `decline_note` from non-PHI readers. Storage kept (Rule 6), claim narrowed. |
| W1-T7 | WS-5 | P7 (DEFERRED), P9 (composite indexes + `(select auth.uid())` wraps), P10 (unindexed FKs), P1 session `cache()` | ✅ pgTAP Files=65/Tests=1616 PASS. migration `…000800` + pgTAP `198` + P1 one-liner. P9 +2 indexes + 9 hot-policy `(select auth.uid())` InitPlan wraps (meaning-preserving; RLS suites are the proof); P10 +5 FK indexes; P1 `getSessionContext` React `cache()`. P7 DEFERRED (time-partitioning breaks per-chain-seq tamper-evidence; correct axis = chain_key). |

## Gate record

- **Build-complete:** tsc 0 · eslint 0-err · Vitest 193/193 · full ordered pgTAP **Files=65 / Tests=1616 PASS** (lead-confirmed, independent fresh reset).
- **Full E2E (standalone prod):** rerun #1 528p/23f → lead-triaged to 1 real regression (D2 PGRST201 embed) + 1 intended change (D7 vocab persona) + 21 baseline. Fixes landed → **rerun #2 531p/21f**; both regressions cleared (phase-multitenancy + T4 green); the 21 residual = documented BUG-AIF-001/prod-flaky baseline, empirically **green on `next dev`** (phase3 + cases-extras 23/23).
- **Gate fixes (`68b393b`):** `src/lib/queries/org.ts` `listHospitalsForOrg` embed pinned to `commissions!commissions_hospital_id_fkey` (D2-induced PGRST201 — the new composite FK made the un-hinted `commissions(count)` embed ambiguous; `if (error) return []` swallowed it → empty hospital list → disabled selectors); `e2e/phase14b-triage.spec.ts` T4 repointed to `platform@` (global vocab is is_admin-only under D7).
- **QA APPROVED** (live-DB-verified): PHI-disposal graph walked col-by-col; membership direct-INSERT denied; C-4 14/14 dispatch; H-8 cross-hospital write denied; ADR 0056 narrowed claim truthful; WS-5 wraps meaning-preserving.
- **Remote deploy:** `supabase db reset --linked --yes` 2026-07-05 — all 8 Wave-1 migrations (`20260711000000`–`…000800`) paired Local | Remote; seed applied; remote schema == local (types diff = only the `__InternalSupabase` PostgREST-version metadata block).

## QA findings (all non-blocking; tracked in PROGRESS Follow-ups)

- **MINOR-5** — TRUNCATE not revoked from `organization_members`/`pqs_members` (latent, not PostgREST-reachable) → Wave-2 consistency win.
- **INFO-1** — service-role first-org_admin provisioning door (`platform/actions.ts:197`): platform-admin-gated + audited; optional uniformity via `assign_org_admin`.
- **INFO-2/3** — `open_capa_plan` (`p_hospital_id` for multi-hospital operators) + `dispose_meeting_minutes` FE wiring + disposal-copy narrowing + non-PHI "motivo da recusa" field = FE follow-ups before the pilot exposes disposal UI.
- **INFO-4** — C-2 posture applies to `postgres`-owned objects (the migration path); a table must be created as `postgres` for the revoke-default to apply — noted in `backend-state.md`.
