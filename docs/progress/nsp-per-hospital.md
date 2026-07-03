# Phase B — NSP-per-hospital + `nsp_org_admin` — completed phase record

✅ **COMPLETE 2026-07-03** · QA APPROVED (CHANGES REQUESTED → APPROVED same day) ·
branch `feat/nsp-per-hospital` (off Phase-A merge `8d22a32`) · ADR
[0052](../decisions/0052-nsp-per-hospital.md) · design
[nsp-per-hospital-design.md](nsp-per-hospital-design.md).

**Gate metrics:** pgTAP **1446/1446** · Vitest 193 · tsc 0 · eslint 0 · `next build` ✓ ·
feature E2E `nsp-per-hospital.spec.ts` **32/32** · prod-standalone PHI/NSP surface **86/86** ·
full regression **0 Phase-B regressions**. Review →
[nsp-per-hospital-review.md](../reviews/nsp-per-hospital-review.md).

**Commits:** BE `4ab7618`+`7a4ffa6`+`12888b1`+`c186954`+`693ea60` · FE `ccb6bc3`+`6eab3d1` ·
E2E `8ddc3b9`+`a323750`. Migrations `20260710000000_nsp_per_hospital.sql` +
`20260710000100_nsp_per_hospital_fixups.sql`.

## What was built

Security-critical re-key of the PQS roster + every PHI door from **per-org → per-hospital**,
mirroring the ADR 0042 per-door inventory one hop further (`org_of_* → hospital_of_*`), plus
net-new: `nsp_org_admin` (org-level zero-PHI aggregates + roster curation + coordinator
appointment), full-operator local `nsp_coordinator`, dual-hospital same-org referral reads,
`dispose_referral_phi`.

| # | Owner | Task | Outcome |
| - | ----- | ---- | ------ |
| B0 | backend | PLAN + contract-first signatures — live-catalog per-door inventory, `nsp_org_admin` PHI-free aggregate-door list, migration order + catalog-sweep assertion, typed FE stubs | ✅ APPROVED (full plan review); stubs @ `7de6caf` |
| B1 | backend | Schema re-key — `pqs_department` per-hospital (`hospital_id` FK + `UNIQUE`); `pqs_members` PK `(organization_id,user_id)`→`(hospital_id,user_id)`; predicate primitives + `hospital_of_*` helpers | ✅ `20260710000000` §1-3 |
| B2 | backend | Door re-key + catalog sweep — `org→hospital` transform on every read predicate, write gate/policy, NSP lifecycle RPC, DEFINER door, storage + patient_index door; coordinator = full local operator | ✅ §4-8; catalog sweep = zero residual per-org PQS symbols |
| B3 | backend | `nsp_org_admin` gates + PHI-free aggregate doors — `is_nsp_org_admin_of(org)`; per-hospital rollup DEFINER doors (event/CAPA/roster) with provably PHI-free SELECT lists, scoped to org's hospitals | ✅ §7; 189 asserts no patient/code/title/narrative key |
| B4 | backend | Appointment/roster/config RPCs + dual-referral + disposal — three-tier chain (no self-delegation); `pqs_members` RLS curator; dual-hospital `can_read_referral_phi`; new `dispose_referral_phi` | ✅ §9-10; dual-hospital gate, full-PHI-graph null, HOSPITAL-tier audit |
| B5 | backend | Seed + pgTAP + types — org-A 2nd hospital + commission + cross-hospital PHI fixtures; personas; `189_nsp_per_hospital_isolation` suite; types regen | ✅ full pgTAP green; `173` deleted (superseded); 7 single-hospital suites byte-identical |
| B6 | frontend | NSP hospital switcher + local console — `/o/[org]/nsp` hospital-scoped from grants; switcher when NSP roles span several; `?hospital=` deep link; coordinator = full operator UI | ✅ `nsp-hospital-switcher` + tamper-safe `nsp-hospital-scope.ts` |
| B7 | frontend | Coordinator appointment + per-hospital roster curation UI | ✅ `equipe`/`configuracoes` re-keyed; retired `manage/equipe-nsp` + dead `NspCoordinatorManager` (decision 3) |
| B8 | frontend | Org NSP-admin console (PHI-free) — per-hospital rollups + coordinator management, zero PHI; `dispose_referral_phi` wired | ✅ new `/o/[org]/nsp-org/**` group + `ReferralDisposeDialog`; root-landing discoverability branch |

## Key lead decisions (durable)

- **B-decisions (backend's 5 open Qs):** (1) `is_pqs_operator_of(hospital)` helper — YES (DRY across ~20 doors). (2) Fresh commission under Hospital Secundário A hosts the A2 event/referral (leave Ética untouched). (3) `nsp_org_admin` rollup doors are `nsp_org_admin`-gated ONLY (preserves NSP-chain independence). (4) `dispose_referral_phi` nulls the FULL PHI graph (LGPD completeness), mirroring `dispose_event_phi`'s reason enum + audit shape, keeping the referral record + non-PHI provenance. (5) `patient_access_audit` filter tightened to HOSPITAL tier.
- **DISPOSE-GATE RULING — dual-hospital dispose ACCEPTED (ADR 0052 §6 amended).** `dispose_referral_phi` widened from source-only to **either endpoint hospital's operator**, symmetric with the dual-hospital READ (decision 14): LGPD erasure follows custody; low-risk (erases only the PHI graph, preserves the non-PHI referral record → CFM 20-yr retention intact); audited at hospital tier; cross-org still forbidden so "either endpoint" is always intra-org. **Surfaced to human; not vetoed (2026-07-03).**
- **NPH-002 RULING — do NOT widen the destructive RPC.** A plain commission `staff_admin` is intentionally NOT entitled to erase PHI (ADR 0052 §6); fix = read-only `can_dispose_referral_phi` probe + FE gates the affordance on it.
- **Seam:** `getNspAccessByOrg` KEPT + hospital-aware (returns `.hospitals: NspHospitalGrant[]`); FE consumes for the switcher.

## Bugs found + fixed en route

- **BUG-NPH-001** (`12888b1`) — `nsp_org_admin` couldn't appoint/revoke a coordinator: `hospitals_select` RLS lacked an `nsp_org_admin` arm → the action's org-resolve `hospitals` SELECT returned zero rows → forbidden before the DEFINER RPC (same class as HAT-003). Fix = narrow `is_nsp_org_admin_of(org)` arm (deliberately NOT `is_org_level_admin_within`, which would leak sibling hospitals to hospital_admin).
- **BUG-NPH-002** (`12888b1`+`6eab3d1`) — dispose-PHI affordance shown to a non-entitled source `staff_admin`; gated on the new `canDisposeReferralPhi` probe.
- **BUG-NPH-003** (`c186954`) — `pqs_members`'s new `hospitals` FK made every un-hinted `profiles↔hospitals` embed ambiguous → PGRST201 crashing the user directory/registration. Fix = `PROFILE_SELECT` pinned to `hospital:hospitals!profiles_home_hospital_id_fkey(name)`. Found by the lead's full-regression (initially mis-read as auth rate-limit).
- **QA-B-1** (`693ea60`) — the handed-off "pgTAP 1445/1445" was actually 1443/1445: suite `189` never enabled the `case_referrals` flag, so the `dispose_referral_phi` keystone tests died on `assert_referrals_enabled` before their gate (disposal keystone uncovered). Fix = flag-enable line + N-2 disposal-skeleton assertion → 1446/1446.

## Full-regression triage (lead, 2026-07-03)

Run on `next dev` surfaced BUG-NPH-003 (the one real regression, fixed). Post-fix #2: 560p/10f.
All 10 residuals proven **non-Phase-B**: 7 = `next dev` instability (sign-in/nav timeouts on specs
running last; features Phase-B-untouched per `8d22a32…HEAD` diff), 3 = deterministic **pre-existing**
(`hospital-admin-tier` HA-4 titles-reorder, `phase10-meetings` AC2, `phase11-interviews` AC2a) —
**proven pre-existing: identical 3 fail on the pre-Phase-B base `8d22a32`** (3f/60p; feature code +
seed both Phase-B-untouched). Prod-standalone gate on the Phase-B PHI/NSP surface = 86/86 green (no
prod-only dialog-refresh regression in the new PHI dialogs). The 3 pre-existing failures were
**human-deferred 2026-07-03** (à la BUG-AIF-001) — see Follow-ups / Deferred in PROGRESS.md.
