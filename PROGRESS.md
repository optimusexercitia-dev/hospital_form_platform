# PROGRESS.md — Project Status Tracker

> Single source of truth for project status. Update IMMEDIATELY when state
> changes. The lead owns the Phase Status table; each teammate owns their own
> rows in the other sections. Never report status that isn't written here.

## Phase Status

| Phase | Name                          | Status | Build | Tests | QA | Human ✓ | Completed | Commit |
| ----- | ----------------------------- | ------ | ----- | ----- | -- | ------- | --------- | ------ |
| 0 | Scaffolding & Environment | ✅ complete | ✅ | ✅ 5/5 | ✅ APPROVED | ✅ 2026-06-11 | 2026-06-11 | `d64281e` |
| 1 | Schema, Auth & RLS | ✅ complete | ✅ | ✅ 88/88 | ✅ APPROVED | ✅ 2026-06-12 | 2026-06-12 | `691662f` |
| 2 | Authentication & App Shell | ✅ complete | ✅ | ✅ 49/49 + load | ✅ APPROVED + re-review | ✅ 2026-06-12 | 2026-06-12 | `5773b4a` |
| 3 | Admin Area & User Management | ✅ complete | ✅ | ✅ 43/43 | ✅ APPROVED | ✅ 2026-06-12 | 2026-06-12 | `cb28ef3` |
| 4 | Form Builder & Versioning | ✅ complete | ✅ | ✅ 8/8 | ✅ APPROVED | ✅ 2026-06-12 | 2026-06-12 | `d32e7e9` |
| 5 | Wizard Filling, Conditional Sections & Resume | ✅ complete | ✅ | ✅ 63/63 | ✅ APPROVED | ✅ 2026-06-13 | 2026-06-13 | `8418991` |
| 6 | Section Sign-offs & Submission Lifecycle | ✅ complete | ✅ | ✅ 70/70 | ✅ APPROVED | ✅ 2026-06-13 | 2026-06-13 | `94566f2` |
| 7 | Multi-Phase Cases | ✅ complete | ✅ | ✅ 81/81 | ✅ APPROVED | ✅ 2026-06-13 | 2026-06-13 | `28e0405` |
| 8 | Dashboards & Submissions Browser | ✅ complete | ✅ | ✅ 106/106 | ✅ APPROVED | ✅ 2026-06-14 | 2026-06-14 | `a50e0e0` |
| 9 | Deployment | 🔜 not started | – | – | – | – | – | – |
| 10 | Meetings | ✅ complete | ✅ | ✅ 141/141 | ✅ APPROVED | ✅ 2026-06-15 | 2026-06-15 | `5e2780c` |
| 11 | Interviews | ✅ complete | ✅ | ✅ 152/152 | ✅ APPROVED | ✅ 2026-06-15 | 2026-06-15 | `3d7376b` |
| 12 | Case Timeline | ✅ complete | ✅ | ✅ 169/169 | ✅ APPROVED | ✅ 2026-06-16 | 2026-06-16 | `0feaa9a` |
| 13 | Audit Trail | ✅ complete | ✅ | ✅ 195/195 | ✅ APPROVED | ✅ 2026-06-18 | 2026-06-18 | `a8739b5` |
| 14 | Patient-Safety / NSP (Triage, RCA & CAPA, 14a–14d) | ✅ complete | ✅ | ✅ E2E 65/65 + pgTAP 516 | ✅ APPROVED | ✅ 2026-06-18 | 2026-06-18 | 14a `984e787` · 14b–d `c4e20b3` |
| 14e | **Centralized Attachment Substrate** [Pre-Pilot Foundations Program](docs/plans/pre-pilot-foundations-program.md) | ✅ complete | ✅ | ✅ pgTAP **1957** · F2 E2E **24/24** (audited PHI door proven) · full **590p/24f** (F2-owned 14/14 green; 0 F2 reg, ≈ F1 baseline) | ✅ **APPROVED** (0B/0M/3m/4i, all closed) [review](docs/reviews/phase-F2-review.md) | ✅ 2026-07-11 | 2026-07-11 | `37057c0` local · **remote ✓ 2026-07-12 (pilot reset)** |
| 15 | Quality Indicators [0057](docs/decisions/0057-indicators-doc-control-replan.md) | ✅ complete | ✅ | ✅ 12/12 (prod-standalone) | ✅ APPROVED (3 MINOR fixed) [review](docs/reviews/phase-15-review.md) | ✅ 2026-07-06 | 2026-07-06 | merge `26187dc` (pushed; **remote deployed via pilot reset ✓ 2026-07-12**) |
| 16 | Standards Crosswalk & Readiness | 🔜 not started | – | – | – | – | – | – |
| 17 | Controlled-Document Lifecycle | ✅ complete | ✅ (tsc/lint 0 · Vitest 206) | ✅ pgTAP 47/47 (full 1717) · phase E2E 14/14 · full regr 588p/10 env-only (0 Phase-17 reg) | ✅ APPROVED (3 MINOR cleared) [review](docs/reviews/phase-17-review.md) | ✅ 2026-07-06 | 2026-07-06 | merge `1152d75` (ff-only from `feat/phase-17-controlled-documents`; pushed) |
| 17-v2 | Controlled-Document Redesign | ✅ complete | ✅ (tsc/lint 0 · Vitest 369) | ✅ tester 25/25 · pgTAP `201` 29/29 · e2e:prod triaged-green (0 redesign reg) | ✅ APPROVED (0/0/0/4 INFO) [review](docs/reviews/document-control-redesign-review.md) | ✅ 2026-07-21 | 2026-07-21 | ff→`main` (branch `feat/document-control-redesign`) |
| 18 | Self-Assessment & Internal Audit | 🔜 not started | – | – | – | – | – | – |
| 19 | Surveyor Access & Evidence Export | 🔜 not started | – | – | – | – | – | – |
| 20 | Notifications & Escalation [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md) | ✅ complete | ✅ | ✅ pgTAP `226` 52/52 (full 2255) + `notifications.spec.ts` 8/8 | ✅ APPROVED (0B/0M/3 MINOR) [review](docs/reviews/s1-n-notifications-review.md) | ✅ 2026-07-13 | 2026-07-13 | `aac7c1c` |
| 21 | Committee Charters & Cadence [0080](docs/decisions/0080-committee-charters-cadence-model.md) | ✅ complete | ✅ | ✅ E2E 10/10 + pgTAP 260/261/262 = 11/29/10 | ✅ APPROVED r1 [review](docs/reviews/phase-CH-review.md) | ✅ 2026-07-20 | 2026-07-20 | BE `458aedb`…`13750b1` · FE `d982401`+`5d366db` · `14c4381`/`cb6a671` |
| 22 | Inter-Committee Case Referrals | ✅ complete | ✅ | ✅ 29/29 + full 276/326 | ✅ APPROVED 2026-06-21 | ✅ 2026-06-21 | 2026-06-21 | `768b9f1` |
| 23 | Patient Identity & Cross-Committee Linkage (MRN/encounter) | ✅ complete | ✅ | ✅ E2E 15/15 + pgTAP 10/10 sweep | ✅ APPROVED 2026-06-22 | ✅ 2026-06-22 | 2026-06-22 | `da4d127` |
| MT | **Multi-Tenancy** [0041](docs/decisions/0041-multi-tenancy-organizations-hospitals.md) | ✅ complete | ✅ | ✅ pgTAP 1029 + E2E 292/0 | ✅ APPROVED 2026-06-25 [review](docs/reviews/multitenancy-review.md) | ✅ 2026-06-25 | 2026-06-25 | `ee35299…82ea157` |
| NSP-per-org | **NSP-per-org** [0042](docs/decisions/0042-nsp-per-org.md) | ✅ complete | ✅ | ✅ pgTAP 1102/1102 + full E2E 421/0 | ✅ APPROVED A [core](docs/reviews/nsp-per-org-a-review.md) + B [whole](docs/reviews/nsp-per-org-b-review.md) | ✅ 2026-06-25 | 2026-06-25 | `b0e15f4…9c53035` |
| result-rec | **Result-based phase recommendation** [0043](docs/decisions/0043-phase-result-based-recommendation.md) | ✅ complete | ✅ | ✅ pgTAP 1122 + Vitest 164 + E2E 431/0 | ✅ APPROVED 2026-06-26 [review](docs/reviews/result-rec-review.md) | ✅ 2026-06-26 | 2026-06-26 | `6c5baeb…` · ✅ remote re-baselined 2026-07-01 |
| processless-cases | **"Sem processo" (process-less cases)** [0044](docs/decisions/0044-processless-cases.md) | ✅ complete | ✅ | ✅ pgTAP 1153 + E2E 8/8 + full 439/0 | ✅ APPROVED 2026-06-30 [review](docs/reviews/processless-cases-review.md) | ✅ 2026-06-30 | 2026-06-30 | `cdf26d0` · ✅ remote re-baselined 2026-07-01 |
| form-model-norm | **Form data-model normalization** [form-model-normalization.md](docs/progress/form-model-normalization.md) | ✅ complete | ✅ | ✅ T-1 green | ✅ APPROVED 2026-07-01 [review](docs/reviews/form-model-normalization-review.md) | ✅ 2026-07-01 | 2026-07-01 | squash `ffc0ea5`; baseline `20260620000000`; merged → main |
| answer-model-v2 | **Answer-Model v2 + forward-compat** [0045](docs/decisions/0045-answer-model-v2.md) | ✅ complete | ✅ | ✅ pgTAP 1205 / Vitest 176 / E2E 6/6 + 456p (0 reg) | ✅ APPROVED 2026-07-01 [report](docs/reviews/answer-model-v2-review.md) | ✅ 2026-07-01 | 2026-07-01 | baseline `20260620000000` · ✅ remote re-baselined 2026-07-01 |
| ad-hoc-narratives | **Ad-hoc Case Narratives** [0047](docs/decisions/0047-ad-hoc-case-narratives.md) | ✅ complete | ✅ | ✅ pgTAP 1219 · Vitest 176 · E2E 5/5 + 461p (0 reg) | ✅ APPROVED 2026-07-01 [review](docs/reviews/ad-hoc-narratives-review.md) | ✅ 2026-07-01 | 2026-07-01 | branch `feat/ad-hoc-case-narratives` |
| user-reg | **User Registration & Identity Management** [user-registration.md](docs/progress/user-registration.md) | ✅ complete | ✅ | ✅ feat 12/12 · pgTAP 1257 · full 467p/10-contam (0 reg) | ✅ APPROVED | ✅ 2026-07-02 | 2026-07-02 | `117319d` |
| hospital-admin | **Phase A [detail](docs/progress/hospital-admin-tier.md) | ✅ complete | ✅ | ✅ 38/38 · pgTAP 1454 · 0 Phase-A reg | ✅ APPROVED [review](docs/reviews/hospital-admin-tier-review.md) | ✅ 2026-07-03 | 2026-07-03 | `99e2d09` |
| DB-hardening | **Pre-pilot DB hardening (Waves 1+2)** [W1](docs/progress/pre-pilot-hardening-wave1.md) | ✅ complete | ✅ | ✅ pgTAP 1644 · Vitest 206 · 0 reg | ✅ APPROVED [W1](docs/reviews/pre-pilot-hardening-wave1-review.md)·[W2](docs/reviews/pre-pilot-hardening-wave2-review.md) | ✅ 2026-07-05 | 2026-07-05 | W1 `68b393b` · W2 `a2a7fab` · merged `27d9e5f` |
| flexible-forms | **Flexible-Forms Foundation (F3)** [0060](docs/decisions/0060-flexible-forms-foundation.md) | ✅ complete | ✅ | ✅ pgTAP 2023 · Vitest 356 · 0 F3 reg | ✅ APPROVED [review](docs/reviews/phase-F3-review.md) | ✅ 2026-07-12 | 2026-07-12 | `94f03c3` (remote ✓) |
| case-participants | **Case-Participants E0 (F1)** [0064](docs/decisions/0064-case-subject-generalization-participants.md) | ✅ complete | ✅ | ✅ pgTAP 1913 · E2E 54/54 · Vitest 294 | ✅ APPROVED [review](docs/reviews/phase-F1-review.md) | ✅ 2026-07-10 | 2026-07-10 | `ef66b0a`+`6805bd9` (remote ✓) |
| pre-pilot-foundations | **Pre-Pilot Foundations Program** [plan](docs/plans/pre-pilot-foundations-program.md) | ✅ complete | – | – | – | ✅ 2026-07-13 | 2026-07-13 | see F0–F-cleanup rows |
| nsp-per-hospital | **Phase B [0052](docs/decisions/0052-nsp-per-hospital.md) | ✅ complete | ✅ pgTAP 1446 | ✅ feature 32/32 · prod-PHI 86/86 · 0 Phase-B reg | ✅ APPROVED [review](docs/reviews/nsp-per-hospital-review.md) | ✅ 2026-07-03 | 2026-07-03 | 9 commits → [detail](docs/progress/nsp-per-hospital.md) |
| administrativo | **Administrativo delegated-capability role** [0061](docs/decisions/0061-administrativo-delegated-role.md) | ✅ complete | ✅ | ✅ pgTAP 50/50 · E2E 10/10 · 0 reg | ✅ APPROVED [review](docs/reviews/administrativo-review.md) | ✅ 2026-07-08 | 2026-07-08 | `75c903f`+`3956b32`→`1010f07`; flag `5a6c668` |
| f-cleanup | **F-cleanup [0068](docs/decisions/0068-result-engine-fk-junctions.md) | ✅ complete | ✅ | ✅ pgTAP 2100 · E2E 51/51 · 0 reg | ✅ APPROVED [review](docs/reviews/f-cleanup-review.md) | ✅ 2026-07-12 | 2026-07-12 | merged `5f81286` (remote ✓) |
| referrals-v2 | **Referrals v2 [0037](docs/decisions/0037-inter-committee-case-referrals.md) | ✅ complete | ✅ | ✅ R1 E2E 40/40 + R2–R5 E2E 29/29 · pgTAP `150_referrals` 217/217 | ✅ APPROVED [R1](docs/reviews/rv2-r1-referrals-review.md) + [R2–R5 r2](docs/reviews/rv2-r2-r5-review.md) | ✅ 2026-07-19 | 2026-07-19 | R1 `33dbc09` · R2–R5 `223ed17` (ff→main `a61aae3`) |
| interviews-v2 | **Interviews v2 [0070](docs/decisions/0070-interview-data-model-v2-sessions.md) | ✅ complete | ✅ | ✅ pgTAP `121` 60/60 (full 2287) + phase E2E 13/13 | ✅ APPROVED [review](docs/reviews/iv2-interviews-review.md) | ✅ 2026-07-14 | 2026-07-14 | `b015815`+`da7c219`+`77daa90` (`00a93dd`) |
| pre-pilot-release | **Pre-Pilot Release Scope Expansion** [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md) | ✅ complete | – | – | – | – | – | – |
| ff-program | **Flexible-Forms Program (FF-1…FF-5)** — umbrella; [0086](docs/decisions/0086-flexible-forms-pre-pilot.md) | ▶ **4 of 5 complete** — FF-1 ✅ · FF-2 ✅ · FF-3 ✅ · **FF-5 ✅ 2026-07-28** (ADR [0091](docs/decisions/0091-ff5-entity-reference.md) + Amendments 1–2; migrations `20260902000000`–`…000900`; flag `entity_refs` ON via `…000600`; **record → [ff-5-entity-reference.md](docs/progress/ff-5-entity-reference.md)**). ▶ **FF-4 is the last phase before the pilot deploy** (ADR 0086: all five gate it). | ✅ FF-5 (lint 0/0 · tsc · Vitest **851** · `next build`) | ✅ FF-5 — spec **10/10** ×2 · neighbours 21/21 · pgTAP **4240/4240** fresh reset · full `e2e:prod` 863p, **0 real failures** (the 53 raw reds were ONE dead server in batch 5 — all 106 errors `ERR_CONNECTION_REFUSED`, zero assertion failures; identical 63 re-ran 63/63) | ✅ FF-5 **APPROVED** r2 [review](docs/reviews/phase-FF-5-review.md) (r1 CHANGES REQUESTED — both blockers keystone-only, **no code defect, no security hole**) | ✅ **2026-07-28** | 2026-07-28 | FF-5 `f0cc3ac`…`598447e` (23 commits) |
| **ETH·E1** | **Ethics Access Spine [0072](docs/decisions/0072-ethics-access-spine.md) | ✅ complete | ✅ Vitest 369/369 | ✅ pgTAP 91f/2537 · E2E 13/13+1 skip · e2e:prod triaged | ✅ APPROVED (R3) [review](docs/reviews/phase-ETH-E1-review.md) | ✅ 2026-07-14 | 2026-07-14 | 14 commits `167b269`…`02bd2db` (remote deferred) |
| **ETH·E2** | **Ethics disciplinary procedure** [0073](docs/decisions/0073-ethics-procedure-model.md) | ✅ complete | ✅ | ✅ E2E 20/20 · pgTAP `253`–`259` | ✅ APPROVED [review](docs/reviews/eth-e2-review.md) | ✅ 2026-07-18 | 2026-07-18 | `ada4c97`…`2adb169` |
| **ETH·E3a** | **Ethics terminology/UX surfacing** [0072](docs/decisions/0072-ethics-access-spine.md) | ✅ complete | ✅ | ✅ E2E 21/21 · pgTAP `266`–`269`/3852 | ✅ APPROVED r2 [review](docs/reviews/phase-E3a-review.md) | ✅ 2026-07-27 | 2026-07-27 | `e61fa3c`…`38db4c9` |
| **AUTHZ** | ADR 0078 Gate 1 | ✅ complete | ✅ | ✅ pgTAP 2981 · e2e 0-regress | ✅ APPROVED [review](docs/reviews/authz-b-series-review.md) | ✅ 2026-07-16 | 2026-07-16 | `87858f7` (local) |
| **AUTHZ · Gate 2** | ADR 0078 Gate 2 | ✅ complete | ✅ | ✅ pgTAP 772/772 authz · e2e green | ✅ APPROVED (re-review) | ✅ 2026-07-17 | 2026-07-17 | `f07341f` |
| **case-corrections** | **Case Correction Lifecycle** [0085](docs/decisions/0085-case-correction-lifecycle.md) | ✅ complete | ✅ | ✅ tester 24/24 + full prod E2E feat 7/7 (reds triaged infra/baseline; T-2 clean-stack 76/76) | ✅ APPROVED (0P0/0MAJ/2min) [review](docs/reviews/case-corrections-review.md) | ✅ 2026-07-24 | 2026-07-24 | `6b50abc` → main+origin; **remote `db push` ✅ (flag ON, backfill verified live)** |
| **case-custom-fields** | **Case Custom Fields** [0083](docs/decisions/0083-case-custom-fields.md) | ✅ complete | ✅ lint/tsc/vitest 369 | ✅ E2E 8/8 (3× clean) · pgTAP `188` 28/28 · full `e2e:prod` 735p (feat 8/8 on prod build) | ✅ APPROVED (0 P0 · 0 MAJOR · 1 MINOR cleared · 2 INFO) [review](docs/reviews/adr-0083-case-custom-fields-review.md) | ⚠ **unrecorded** — see detail | 2026-07-23 | merge `c857193` · flag ON `fde76d3` |
| **bulk-case-create** | **Bulk Case Creation ("Múltiplos casos")** [0084](docs/decisions/0084-bulk-case-creation.md) | ✅ complete | ✅ build/tsc/lint/vitest 390 | ✅ E2E 8/8 prod-standalone · pgTAP 29/29 | ✅ APPROVED (4 MINOR/OBSERVATION, none blocking; fixed `b948c9f`) [review](docs/reviews/bulk-case-creation-review.md) | ⚠ **unrecorded** — see detail | 2026-07-23 | flag ON `255a8e9` |
| **AUDIT-DOOR-BLINDNESS · P0** | ADR 0078 §7.14 | ✅ complete | ✅ | ✅ 50 KS mut-proven · pgTAP 3288 · invariant HOLDS | ✅ APPROVED [review](docs/reviews/authz-door-audit-p0-review.md) | ✅ 2026-07-18 | 2026-07-18 | ff→main |
## Current Phase Tasks

<!-- Lead recreates this table at the start of each phase. At the §6 Record step the
     completed phase's task detail is archived to docs/progress/phase-N.md (or a
     feature-named file) and replaced here by a one-line pointer (CLAUDE.md §7). -->

▶ **ACTIVE: FF-4 (Power Authoring)** — started 2026-08-03, ADR
[0092](docs/decisions/0092-ff4-power-authoring.md). The Flexible-Forms program is **4 of 5
complete**; **FF-4 is the last phase before the pilot deploy** (ADR 0086 — all five gate it).

| Phase | Flag | Record |
| --- | --- | --- |
| **FF-1** Repeating Groups ✅ 2026-07-27 | `repeating_groups` ON | [ff-1-repeating-groups.md](docs/progress/ff-1-repeating-groups.md) |
| **FF-2** Matrix & Risk Matrix ✅ 2026-07-27 | `matrix_fields` ON | [ff-2-matrix-risk-matrix.md](docs/progress/ff-2-matrix-risk-matrix.md) |
| **FF-3** Validation Engine ✅ 2026-07-28 | `item_validations` ON | [ff-3-validation-engine.md](docs/progress/ff-3-validation-engine.md) |
| **FF-5** Entity Reference ✅ 2026-07-28 | `entity_refs` ON | [ff-5-entity-reference.md](docs/progress/ff-5-entity-reference.md) |

**Case-type assignment (ADR 0088) ✅** — template declares → case inherits; record →
[case-type-assignment.md](docs/progress/case-type-assignment.md).

### ▶ FF-4 (Power Authoring, `power_authoring`) — ACTIVE, started 2026-08-03

ADR **[0092](docs/decisions/0092-ff4-power-authoring.md)** authored at phase start (9 rulings);
scope + gate keystones there. Reusable block/question library (jsonb snapshot of the item subtree)
+ dynamic defaults; **calculated fields stay post-pilot** (ADR 0086 ruling 6). It is last
*structurally* — the library must snapshot every shipped item shape: options, matrix axes,
validations, reference config.

**PO rulings 2026-08-03** — ① library is **commission-only** (one RLS arm; org-visible deferred as
additive) · ② `question_key` collisions **auto-suffix + a visible rename list** in the draft
builder, never silent · ③ dynamic-default vocabulary v1 = **five PHI-free tokens** (`today`, `now`,
`current_user_name`, `current_user_email`, `commission_name`); **case context deferred**.

**Substrate pinned at phase start (live catalog, 235/235 registered, max `20260902000900`):** the
deep-copy authority is **`app.copy_version_children`** — its insert list (`form_items` recursive ·
`form_item_options` · `form_matrix_rows`/`_columns` · `form_item_validations` **last**, after the
`parent_item_id` re-link) is the complete child set a snapshot must carry; FF-5 reference config
rides in `form_items.config`, so there is no sixth table. SQLSTATE high-water **HC0Q5** → FF-4
allocates from **HC0Q6**. Migration window **`20260903000000`–`20260903000900`**.

> 🔴 **ADR 0092 ruling 3 is the sharpest risk in this phase and the plan did not anticipate it.**
> A snapshot must be **closed under its own conditions**: `visible_when`/`required_if` are written
> over `question_key`s, so a block whose condition points *outside* the subtree either dangles or
> silently binds to an unrelated question sharing that key. Save **refuses** (`HC0Q6`); insert
> **rewrites conditions with the rename map**. Renaming keys without rewriting conditions passes
> every structural test and surfaces only as a question that never appears.

| # | Task | Owner | Depends on |
| --- | --- | --- | --- |
| BE-1 | Contract-first: post typed signatures for the library queries/actions before implementing | backend | — |
| BE-2 | `…000000` `form_block_library` + RLS (ruling 1) + `power_authoring` seeded **OFF** + grants | backend | BE-1 |
| BE-3 | `…000100` `form_items.default_source` + XOR CHECK + token↔type CHECK (ruling 6) | backend | — |
| BE-4 | `…000200` `save_block_to_library` DEFINER door — subtree snapshot + ruling-3 closure (`HC0Q6`) + revokes | backend | BE-2 |
| BE-5 | `…000300` `insert_block_from_library` DEFINER door — deep copy over the `copy_version_children` child set, key suffix + **condition rewrite**, returns rename map | backend | BE-2, BE-4 |
| BE-6 | Draft-start default resolution (idempotent) · `gen:types` · pgTAP for all 9 keystones incl. over-grant twin | backend | BE-3, BE-5 |
| BE-7 | ✅ `…000500` `update_block_library_entry` / `delete_block_library_entry` DEFINER doors (ruling 2 metadata edit + delete) | backend | BE-4 |
| FE-1 | ✅ Builder: library browser + save-to-library (flag-gated) | frontend | BE-1 |
| FE-2 | ✅ Insert flow + the **rename review list** (ruling 4) — shipped READ-ONLY (ADR 0092 Amendment 1: no rename door exists anywhere; `question_key` is immutable post-creation, confirmed independently by both frontend and backend) | frontend | BE-1 |
| FE-3 | ✅ `default-value-editor.tsx`: dynamic-source selector, type-gated to the 5 tokens — literal/dynamic/none modeled as one discriminated union (`DefaultConfig`), so ruling 6's exclusivity is a type invariant, not a convention | frontend | BE-1 |
| FE-4 | ✅ Wizard prefill wiring in `prepare.ts` / `use-wizard.ts` — `today`/`now` resolve from `responses.started_at` (added to `ResponseForFill` by backend on request), not a live clock, so a resumed draft never drifts | frontend | BE-1 |
| FE-5 | ✅ Library entry rename/re-describe + delete (ruling 2) in `block-library-picker.tsx` + new `edit-library-entry-dialog.tsx`. Delete confirm names the safety property (materialized copies, not links); both keyboard-operable, announced via a picker-level `aria-live` region (a per-card region would unmount with a deleted card before being read). All 4 doors + the browse read exercised directly against the local RPC/REST endpoint (save → browse → insert-with-forced-collision → rename → delete → browse), since this environment's browser pane has no compositing surface for a spawned subagent (confirmed: `document.visibilityState` stuck `"hidden"`, `getBoundingClientRect` zero on interactive elements) — see the phase record for detail | frontend | BE-7 |
| T-1 | ⚠ E2E: save rich block → insert → rename list → publish → fill → submit + keyboard-only — **6/7, BUG-FF4-001 filed** (dynamic-default clear-then-resume re-seeds; see Bug Log) | tester | FE-1…5 |
| QA-1 | Phase review → `docs/reviews/phase-FF-4-review.md` | qa | T-1 green |

> 🔴 **What FF-4 inherits. Read before designing the library — each line is a defect that already
> shipped once.**
>
> 1. **`app.copy_response_answers` is THE single correction-copy surface** (FF-5 extracted it from
>    six hand-written copies). A new answer shape adds **one insert there** and nowhere else. That
>    join failing silently copies *nothing* — which is exactly how FF-1's P0-1 destroyed real data,
>    proven live 2 selections → 0.
> 2. **The sign-off projection is owed at BOTH scopes — four misses running.** instances (FF-1),
>    grids (FF-2), references *and* top-level `other_text` (FF-5). pgTAP `276 §N` pins the
>    projection's **key set**, not one key, precisely because a single-key test would have passed
>    for all three earlier misses. A signer attesting to content the screen never showed them is
>    the sharp end.
> 3. **Type sets live once**, in `src/lib/forms/item-tree.ts`, pinned to the DB CHECK by
>    `item-type-sets.test.ts` + pgTAP `276 §M`. BUG-FF5-001 was three hand-written copies drifting:
>    the builder could not create a reference item **at all** while pgTAP, Vitest, tsc, lint and
>    `next build` were green. ⚠ `ItemType` is still a **hand-written** union (`gen:types` renders a
>    CHECK-constrained `text` column as `string`), so DB→TS remains a convention with a test under it.
> 4. **An optional prop with a default is a type-system opt-out.** BUG-FF5-002 blanked every
>    reference on the durable submitted record because tsc cannot object to an *omitted optional*
>    prop. All six answer-payload props are now required; keep new ones required. Note the shape:
>    components taking a whole typed object inherit new fields automatically, components taking a
>    destructured prop list do not.
> 5. **Check that your predicate could have failed for the reason you claim it passed.** FF-5
>    produced **eight** checks that were vacuous by construction — review found none, mutation
>    found all. The list is worth reading before writing keystones →
>    [ff-5-entity-reference.md §4](docs/progress/ff-5-entity-reference.md).
> 6. **`git commit -- <paths>`, not `git add <dir>`.** `commit` commits the whole index, so a
>    concurrent teammate's staged files ride along however carefully your *add* was scoped. This
>    mis-attributed a commit during FF-5.

### 📋 Remaining pre-pilot work

Expanded 2026-07-12 — ADR [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md); **re-expanded
2026-07-27 — ADR [0086](docs/decisions/0086-flexible-forms-pre-pilot.md)** (Flexible-Forms FF-1…FF-5 pulled
pre-pilot). **FF-1 · FF-2 · FF-3 · FF-5 are all ✅ COMPLETE (2026-07-27/28)**; this is the standing
backlog — remaining pre-pilot = **FF-4** (one gated phase), the FUP-AI-1 workstream, then the
**pilot deploy**.

· **S4 ✅ COMPLETE 2026-07-20** — ✅ **ETH·E2** (2026-07-18) + ✅ **Referrals v2 R2–R5** (2026-07-19) + ✅ **CH** Charters (Phase 21, 2026-07-20 — ADR [0080](docs/decisions/0080-committee-charters-cadence-model.md) / [detail](docs/progress/ch-charters-cadence.md)), all → `main`
· ✅ **S5 ETH·E3a COMPLETE 2026-07-27** — terminology/UX + auto-derived procedural timeline + ethics dashboard (E3b still needs Phase 16) → [eth-e3a-surfacing.md](docs/progress/eth-e3a-surfacing.md)
· Phase 16 — Standards Crosswalk (🔜 **deferred** 2026-07-11, needs replanning; blocks E3b)
· **BUG-AIF-001 / FUP-AI-1** (PO-directed pre-pilot; own workstream, not yet started)
· 🔴 **AUDIT-INVOKER-WRAPPER — a structural blind spot in the ADR [0079](docs/decisions/0079-authz-door-blindness-standing-invariant.md) standing sweep. Found in FF-3 (QA M-2), NOT an FF-3 defect, NOT a known leak; PO decision on scheduling.** The sweep floors `prosecdef = t` **public** doors. The shape it cannot see is an **INVOKER wrapper whose own hand-written RLS probe is the only gate in front of a DEFINER body** — a `prosecdef = f` function whose security rests entirely on an `if not exists (…)`. FF-3's `get_response_validation_errors` is one instance: deleting its existence probe reds **0 assertions across six files**, while a commission-Y staff then reads commission-X rule messages **and item labels** (proven live, `have: 3 want: 0`; keystone `§O` added, mutation-proven). **This is a pattern, not an accident** — it is the natural way to front an `app.` DEFINER helper, and **130 of 281 `app` DEFINER functions carry `EXECUTE` to `PUBLIC`**, so the wrapper is the whole boundary each time. Proposed scope: enumerate `public` `prosecdef = f` functions calling an `app` `prosecdef = t` function, and require a keystone per wrapper that reds when its guard is removed. Not started. Relates to ARCHITECTURE.md Rule 1.
· ✅ **BUG-PROD-ACTIONS — RESOLVED (environment drift, not a code defect).** `node_modules/next` had silently drifted to **16.2.9** (the pre-BUG-AIF-001 version) while `package.json`/lockfile pinned **16.3.0-preview.5**; `npm ci` → 16.3 + a `REBUILD=1` full run collapsed the 21–31s action-hang **and** the "~18–27 prod flaky baseline" to ~1. Confirmed in the Gate-2 version-drift audit (`2698696`); PO-approved at the Gate-2 close. Full investigation detail → [bug-log-archive.md](docs/progress/bug-log-archive.md).
· ✅ **P0 · AUDIT-DOOR-BLINDNESS — RESOLVED 2026-07-18, human-approved.** The door-level re-audit (292 gate neutralizations across every `authenticated`-reachable DEFINER door) found no live leak — platform-wide test-coverage debt, not a Gate-1 breach. Closed with a standing invariant (ADR [0079](docs/decisions/0079-authz-door-blindness-standing-invariant.md)) + 50 mutation-proven keystones; qa APPROVED. Full detail → [authz-p0-door-blindness.md](docs/progress/authz-p0-door-blindness.md).
· **Flexible-Forms Program — ✅ FF-1 (Repeating Groups) COMPLETE 2026-07-27** (ADR [0087](docs/decisions/0087-ff1-repeating-groups.md) + Amendment 1; QA APPROVED r2; flag `repeating_groups` **ON** via gate flip `20260828000900`; record → [ff-1-repeating-groups.md](docs/progress/ff-1-repeating-groups.md)). **✅ FF-2 (Matrix & Risk Matrix) COMPLETE 2026-07-27** (ADR [0089](docs/decisions/0089-ff2-matrix-risk-matrix.md); QA APPROVED r2; flag `matrix_fields` **ON** via gate flip `20260830001200`; record → [ff-2-matrix-risk-matrix.md](docs/progress/ff-2-matrix-risk-matrix.md)) — it discharged FF-1's P0-1 correction-copy obligation and pulled **both** its own follow-ups (dashboard aggregation + sign-off grid) into gate scope by PO ruling. **✅ FF-3 (Validation Engine) COMPLETE 2026-07-28** (ADR [0090](docs/decisions/0090-ff3-validation-engine.md) + Amendments 1–4; flag `item_validations` **ON** via `20260901000800`) and **✅ FF-5 (Entity Reference) COMPLETE 2026-07-28** (ADR [0091](docs/decisions/0091-ff5-entity-reference.md) + Amendments 1–2; flag `entity_refs` **ON** via `20260902000600`; record → [ff-5-entity-reference.md](docs/progress/ff-5-entity-reference.md)) — between them they discharged **both** obligations FF-2 handed on: the missing targeted / `can_read_correction_response` policy arms, and the **door-parity rule** (`272_ff2_door_parity.sql`). **Remaining: FF-4 only** (ADR **0092+** at phase start; all five gate the pilot deploy) → [flexible-forms-program.md](docs/plans/flexible-forms-program.md)
· the **Coolify app deploy** + the **remote `db push`** of the S1–S3 local-only migrations — deferred to the pilot by design (every S-phase builds local-first; **now follows the FF program's last gate**). **This is when the ETH·E1 m2 flag flip reaches production.**

_Shipped from this backlog:_ **S1** N (Phase 20) · MEM (§6.1 collapse) · SUP (supersession engine, ADR 0060 Gap 38) — 2026-07-13 · **S2** IV2 · RV2·R1 · AI satellites+cross-link — 2026-07-14 · **S3** ETH·E1 access-spine — 2026-07-14. Detail in the phase table + `docs/progress/`.

<!-- DEDUPE (continued 2026-07-14, at the S3·ETH·E1 Record):
     Removed the ✅-COMPLETE blockquotes for F3 · F2 · F1 · F0 and the Pre-Pilot Foundations
     Program block. Each was duplicated by its own row in "Completed work" below (the canonical
     index) and/or by its Phase Status row above, with the durable detail already in
     docs/progress/*.md. Same rationale as the earlier pass in this file, which removed:
     UI-batch · Administrativo · meeting-held-time · form-builder-batch · Phase 17.
     Durable records unchanged in docs/progress/. This section is the FORWARD backlog only —
     completed work belongs in "Completed work (archived)" below, one line each. -->

---

### Completed work (archived to docs/progress/)

> Numbered/named phases with their own Phase Status table row (F3, Administrativo, Phase 17, Phase 15,
> DB-hardening W1+2, Phase B, Phase A, User Registration, Ad-hoc Case Narratives, Answer-Model v2,
> Form-model-norm, Result-rec, NSP-per-org, Processless-cases, Phase 23, Phase 22) are NOT re-listed
> here — the phase table row + its `docs/progress/*.md` link is the durable pointer. This list holds
> only ad-hoc/out-of-phase work that has no Phase Status row of its own.

- **Case-corrections relocation + process-builder layout** (ad-hoc, out-of-phase; pure frontend — **no migration/RLS/route**) — ADR 0085's case-wide "Solicitações de correção" cockpit card becomes a per-target list at the bottom of each phase/narrative card (`CaseCorrectionsPanel` → `CaseCorrectionsList`; filing moves to each card's header cluster); the process-template builder gains a two-column workspace with a feature-gated 320px rail, and outcome selection moves from an inline whole-vocabulary checkbox list into a dialog that persists once on save. — ✅ 2026-08-03, `main` `2613120` + `0c1ae4c` (+ graph `ec6e49a`). Bar: lint 0/0 · tsc · Vitest 851 · `next build` EXIT=0 · targeted `e2e:prod` **51/51, 0 infra/0 flaky** (the 4 correction specs + `processless-cases`, fresh reset, 235==235). ⚠ **Not QA-reviewed, and the spec-locator re-scoping still needs `tester` sign-off (§6).** ⚠ The process-builder half has **no E2E coverage at all** — pre-existing gap, not introduced here. _No separate docs/progress record: this line is the durable one._
- **MEM — single `memberships` collapse** (S1 substrate; ADR [0075](docs/decisions/0075-memberships-collapse-write-path-split.md); `HC0G*`) — three role tables → one `memberships` + `grant_role`/`revoke_role` DEFINER door + one `has_role` family. Structural, no flag. QA APPROVED (0B/0M/3 minor cleared); pgTAP 2161/0 · E2E 586p/0f. — ✅ 2026-07-13, `pre-pilot-release-s0`. Detail → [s1-substrate.md](docs/progress/s1-substrate.md).
- **SUP — supersession correction engine** (S1 substrate; ADR [0074](docs/decisions/0074-supersession-correction-model.md); `HC0H*`) — `responses.supersedes_id` + `supersede_response` DEFINER RPC; flag `response_correction` ON. QA APPROVED (BUG-SUP-002 blocker found+fixed); pgTAP 2203/0 · SUP E2E 5/5 + phase8 24/24. — ✅ 2026-07-13, `pre-pilot-release-s0`. Detail → [s1-substrate.md](docs/progress/s1-substrate.md).
- **Case "Reuniões" panel** (ad-hoc, out-of-phase; pure frontend — **no migration/RLS/route**) — read-only rail card on the Case **Detalhes** tab listing every meeting the case was discussed in (reverse of the meeting's "Casos discutidos" `CaseLinker`); reuses `listCaseMeetings`. Human-approved decisions: read-only · right rail · all meetings · gated on `meetingsEnabled()`. — ✅ 2026-07-12, merged → `main` `fbe215f`. _No separate docs/progress record: this line is the durable one._
- **BUG-AMV2-002 — choice-default publish regression** (ad-hoc, pre-F3; publishing a choice "Valor padrão" rejected HC080 — `reconcileOptionRows` regenerated the client-minted option `code` for new rows, orphaning the stored default) — ✅ **COMPLETE 2026-07-11**, merged → main `c8e951b`. App-code only, no migration. Detail → [answer-model-v2.md](docs/progress/answer-model-v2.md); memory [[choice-default-publish-regression]].
- **UI/layout fixes batch + base-branch triage** (ad-hoc, frontend + backend — F1–F9 UI fixes · B1 discard-draft RPC · B2 fresh-add "Outro" · 6-test base-branch triage) — ✅ **COMPLETE 2026-07-08**, scoped E2E 81/81 GREEN. Detail → [ui-batch-2026-07.md](docs/progress/ui-batch-2026-07.md).
- **Meeting actual-occurrence time** (`held_at`/`held_end`; ADR [0062](docs/decisions/0062-meeting-actual-occurrence-time.md); nullable occurrence window captured at the `→ realizada` transition, coordinator-correctable, `meeting.held_changed` audit) — ✅ **COMPLETE 2026-07-08**, QA APPROVED (2 MINOR). pgTAP 21/21 · E2E 33 pass. Detail → [meeting-held-time.md](docs/progress/meeting-held-time.md).
- **Form-Builder Enhancements batch** (ad-hoc, out-of-phase — Departments · Flagged + aggregate result criteria · form-builder dialog redesign · "Others" open option · wizard UX · views/labels · meeting participants) — ✅ **COMPLETE 2026-07-07**, QA APPROVED. Batch E2E 29/29. 5 bugs (BUG-FBE-005…009) found+fixed. Detail → [adjustments-batch.md](docs/progress/adjustments-batch.md).
- **Shared Action-Items Hub** (Option A unification of non-PHI action-item sources → fold `case_action_items` into the hub with `visibility_scope` + case-access expiry [ADR 0050] → member "Meus itens de ação" + "Visão Geral" dashboard) — ✅ **COMPLETE 2026-07-02**, all three QA-APPROVED → [action-items-hub.md](docs/progress/action-items-hub.md).
- **Layout-adjustments batch** (5 scoped UI/UX adjustments — respostas list, status pills, Narrativas→Construtor move, wizard textarea height, registered-user member picker) — ✅ **COMPLETE 2026-07-02** → [layout-adjustments-2026-07.md](docs/progress/layout-adjustments-2026-07.md).
- **`case_phase_results`** (per-phase categorical result + manual override; flag ON) — ✅ QA APPROVED 2026-06-23, pgTAP 45/45 + E2E 7/7 → [case-phase-results.md](docs/progress/case-phase-results.md).
- **Form Builder Enhancements** (new question types · option colors · per-question conditions · observations) — ✅ 2026-06-23 → [form-builder-enhancements.md](docs/progress/form-builder-enhancements.md). BUG-FBE-004 RESOLVED.
- **`case_patient`** (third PHI module; ADR 0038) — ✅ 2026-06-22 → [case-patient.md](docs/progress/case-patient.md)
- **Case Access Control & "Meus Casos"** (flag `case_access`) + dialog/attribution refinement — ✅ 2026-06-19 → [case-access.md](docs/progress/case-access.md)
- **Case Narratives** (feature-flagged) — QA CHANGES REQUESTED 2026-06-19 → [case-narratives.md](docs/progress/case-narratives.md)


---


## Bug Log

<!-- OPEN bugs only. Resolved/closed rows rotate to docs/progress/bug-log-archive.md (or the
     owning phase's record) at each §6 Record step. -->

**FF-3-era bugs — all closed and rotated** → [bug-log-archive.md](docs/progress/bug-log-archive.md): BUG-E2E-001 (the seed-eating cleanup behind the gate's b7 cascade), BUG-FF3-002 (unary operators offered but unsavable — `CONDITION_OPS` still the pre-F3 seven), BUG-FF3-001 (stale peer `aria-invalid` on the symmetric rule), and **BUG-FF1-008, closed by FF-3's Amendment 3**.

**FF-5-era bugs — both closed, verified and rotated** → [bug-log-archive.md](docs/progress/bug-log-archive.md): **BUG-FF5-001** (the builder could not author a `reference` item at all — three sites: `ALL_ITEM_TYPES`, `ANSWERABLE_TYPES`, `parseItemFields`; `updateItem` was broken independently) and **BUG-FF5-002** (every top-level reference rendered "Sem resposta" on the durable submitted record — the page never passed `referencesByItemId` and the prop was optional-with-default, so tsc could not object). Both passed pgTAP 4240 + Vitest 851 + tsc + lint + `next build`; **only E2E found them.**

#### 🔴 BUG-FF4-001 — clearing a dynamic-default answer and resuming the draft RE-SEEDS it, violating ADR 0092 ruling 5's idempotency contract · owner **backend** · **OPEN** (filed 2026-08-03)

**Spec:** `e2e/ff4-power-authoring.spec.ts` FF4-4 (acceptance criterion 4's idempotency clause). **Repro**
(deterministic — 3 consecutive runs, prod standalone, fresh state each time): author a `date` item with
a `today` dynamic default, publish, fill as a respondent (the field correctly prefills). Click the
field's own **"Limpar"** clear button (the real per-field affordance, not a raw `.fill('')`), confirm it
reads empty, **"Salvar e sair"**, then **"Continuar preenchimento"** back into the same draft.

**Expected** (ADR [0092](docs/decisions/0092-ff4-power-authoring.md) ruling 5 — *"a filler who clears a
field does not have it refilled behind them"*; pgTAP keystone `default_prefill_idempotent` — *"re-entering
the draft does not overwrite an edited or cleared answer"*): the field resumes **empty**.

**Actual:** the field resumes prefilled with `today` again (`2026-08-03`), indistinguishable from a
field that was never touched.

**Not a save-path defect** — DB truth (asserted in the spec, immediately after "Salvar e sair") proves
the clear DID persist: `select value from answers where response_id=… and item_id=…` returns exactly
**one row**, `value = 'null'::jsonb` — an explicit "answered as empty" row, not a missing one. The defect
is entirely on the READ/resume side.

**Root cause, traced to one line:** `buildAnswerMaps` in `src/lib/queries/responses.ts:429`:
```ts
for (const a of scalarAnswers) {
  if (a.value === null) continue   // ← drops the row instead of keeping "answered: null"
  ...
  answersByItemId[a.item_id] = a.value
}
```
unconditionally skips any scalar answer row whose `value` is JSON `null`, so `answersByItemId` never gets
a key for it. `toAnswerState` (`src/components/responses/wizard/prepare.ts:42-54`) then reads
`response.answersByItemId[item.id]` as `undefined`, and — since `observation`/`otherText` are also
`undefined` for this item — `continue`s past it, so it never lands in `initialAnswers`. `withDefaults`
(`src/components/responses/wizard/use-wizard.ts:406`, `if (item.id in initialAnswers) continue`)
therefore sees no saved answer at all and re-seeds the default. The line-429 filter predates FF-4 — its
comment explains a different, still-valid concern (ignoring a stray non-null value on a CHOICE item,
whose real answer lives in `answer_selected_options`) — but nobody revisited it for the new "explicit
null = deliberately cleared" semantic FF-4's idempotency ruling depends on.

**Broader blast radius, NOT directly exercised by this spec:** `withDefaults` seeds from a LITERAL
`default_value` before falling to `defaultSource` (rulings 5/6 share the one function), so the same root
cause very likely also re-seeds a plain, pre-FF-4 (answer-model-v2) literal default after it is cleared
and the draft resumed — FF4-4 only exercises the two FF-4 dynamic tokens; worth the owning engineer's own
check before calling the fix's scope closed.

**Not filed as a fix suggestion** (tester scope): `buildAnswerMaps` needs to represent "answered, value is
`null`" as distinct from "no row" rather than dropping the row — how to do that without disturbing the
CHOICE-item exclusion sharing the same loop is backend's call.

#### 🔴 BUG-AUTHZ-001 — `platform_admin` reads response-level content through DEFINER dashboard functions, invisible to a policy audit of `responses` · owner **AUTHZ** · **OPEN** (filed 2026-07-27, PO's call)

**Not FF-2's defect** — FF-2 correctly inherited its sibling's arm (lead-ruled; deviating would have
been the inconsistency). The pre-existing question is what got filed.

| Surface | `prosecdef` | `is_admin()` arm |
|---|---|---|
| `dashboard_distributions` · `dashboard_export_rows` · `dashboard_matrix_cells` · `dashboard_matrix_risk_scores` | ✅ | ✅ |
| **`responses` — every policy** | — | ❌ **none** |

**`dashboard_export_rows` is the sharp one: it returns `TABLE(response_id, member_name, submitted_at,
version_number, answers jsonb, signoffs jsonb)` — one row per response with its answers and the
member's name, not an aggregate.** Verified live.

CLAUDE.md's noun rule says `platform_admin` may **not** touch commission content, and ADR 0078 A35
rests on a census finding it reads *0 cases / 0 responses / 0 narratives / 0 meetings*. That census
is consistent with the `responses` policies **and structurally blind to the four DEFINER rows** —
ADR 0078's own documented blind spot (*`prosecdef` belongs beside `pg_policies`*). **So the census
may have understated `platform_admin`'s reach across every dashboard function.** Spans far more than
FF-2 and re-opens an ADR 0078 finding → PO decides, not a phase.

#### 🟡 BUG-P22-001 — the referrals hub does not render a seeded `completed` referral · owner Phase 22 · **OPEN** (filed 2026-07-27)

ENC-0001 **is** seeded (`status = completed`, subject matches the spec's locator exactly) and
`referrals-list.tsx` gates both hub sections behind a **status filter**. **Possibly a live
user-facing defect** — a committee would not see its own concluded encaminhamento. Needs triage:
product bug vs stale spec. Deterministic (fails every run on a clean stack, 0 connection errors).

#### 🟡 BUG-P22-002 — `phase22-referrals-governance.spec.ts:1187` R5-6 keyboard-only internal note fails · owner Phase 22 · **OPEN** (filed 2026-07-27)

Same module, same triage round; not characterized further. Deterministic.

#### 🟡 BUG-E2EISO-001 — `orgadmin.a` loses org-admin affordances when 4 specs share a prod batch · owner **tester** · **OPEN** (filed 2026-07-28)

Three tests fail **only when batched**, each passing when its file runs alone:

| Test | Symptom |
|---|---|
| `hospital-admin-tier.spec.ts:243` HA-2 appoint/revoke | `getByRole('button', {name:'Nomear administrador(a)'})` never appears (30s timeout) |
| `hospital-admin-tier.spec.ts:291` HA-2 no self-delegation | same button, same timeout |
| `phase-multitenancy.spec.ts:205` MT-6 hospital selector | `toBeVisible()` fails on the populated selector |

**Repro** (deterministic — 3 consecutive runs, fresh `db reset` each):
```
SPECS="e2e/phase-multitenancy.spec.ts e2e/hospital-admin-tier.spec.ts \
       e2e/administrativo.spec.ts e2e/cases-board-access.spec.ts" \
  RESET=0 REBUILD=0 RETRIES=0 bash scripts/e2e-prod-gate.sh     # 77 passed / 3 failed
```
`hospital-admin-tier` alone → **38/38**. `phase-multitenancy` + `hospital-admin-tier` on a dev
server → **68/68**.

**Pre-existing, NOT caused by the auth-cache change** — proven by an A/B on unmodified code
through the identical batch: **77 passed / 3 failed, byte-identical outcome** (only the GoTrue
login count differs, 91 → 32). Do not attribute this to `e2e/helpers/auth.ts`.

All three involve `orgadmin.a@test.local` losing org-level UI affordances, so the likely cause is
a membership/roster mutation by an earlier spec in the batch (bucket C-4, shared-seed isolation —
same family as P13-004/005/006). Needs a probe-commission/probe-user fixture rather than mutating
the seeded rede-a org. Not a product defect until that is ruled out.


## Test Run Summary

<!-- Most recent gate's rows only; rotate the rest to docs/progress/test-run-archive.md at each
     §6 Record (full historical log, Phases 0 → FF-3, already there). -->

**FF-4 · `tester` targeted spec, NOT the full gate (2026-08-03).** New file:
`e2e/ff4-power-authoring.spec.ts` (7 tests, covers ADR 0092 rulings 1–9 + both amendments —
FF4-1 headline round trip, FF4-2 collision/rename-list, FF4-3 closure refusal, FF4-4 dynamic
defaults, FF4-5 cross-commission security, FF4-6 rename/delete metadata, FF4-7 keyboard-only).
Run against a prod standalone build (`npm run build` + `.next/standalone/server.js` on :3000,
per `docs/testing/e2e-prod-build-gate.md`'s manual recipe), `--project=chromium --workers=1`.

| Surface | Result |
| --- | --- |
| `tester` — FF-4 spec | **6 / 7**, deterministic across 3 consecutive runs (same 1 failure, same values, every time) |
| lint (`e2e/ff4-power-authoring.spec.ts`) | 0 errors / 0 warnings |
| typecheck | clean (`tsc --noEmit`, no errors in the new file) |

**1 failure = 1 real bug, filed as BUG-FF4-001 above — not a flake, not a stale selector.** FF4-1,
FF4-2, FF4-3, FF4-5, FF4-6, FF4-7 all pass, including the mandatory keyboard-only flow (FF4-7) and
the security negative (FF4-5, UI + RPC + direct REST). **Full `e2e:prod` gate NOT run by tester**
(a subagent's foreground cap does not cover the full suite, per role scope) — the lead runs that
before declaring the phase green; this is the acceptance-criteria pass, not the regression gate.

**Side finding while debugging cleanup (not a product defect, a TEST-INFRA one — flagged, not
fixed here in other files' specs):** `session_replication_role = replica` — the exact idiom
ff1/ff2/ff3/ff5's own `purge()` helpers use to bypass `guard_submitted_response` before deleting a
form — **disables Postgres's FK-CASCADE triggers too**, not merely the app-level guard it targets.
A bare `delete from forms … ` under `replica` mode deletes the `forms` row while leaving
`form_versions`/`form_items`/… **orphaned** (no parent, unreachable by any app query, but still
occupying rows). Proven live: a database-wide sweep during this session's debugging found **46
pre-existing orphaned draft versions plus 2 orphaned PUBLISHED versions with real
`responses`/`answers` under them**, all cleaned up as part of this run (verified: 0 orphans
remain in `form_versions`/`form_items`/`form_sections`/`answers` after cleanup). Confirmed by a
controlled test: deleting the identical row under a **normal** (non-`replica`) session cascades
correctly. `e2e/ff4-power-authoring.spec.ts`'s own `purge()` works around it (explicit,
table-by-table deletes, never relying on the FK-cascade trigger); the other FF specs' `purge()`
functions still carry the original one-line pattern and will keep leaking orphans on every run
until someone applies the same fix there. Not blocking FF-4 (this file's own state is hermetic),
but worth a follow-up task against ff1/ff2/ff3/ff5's shared `purge()` idiom.

**FF-5 · final bar at `598447e` (2026-07-28)** — full detail, every triage and every mutation
proof → [ff-5-entity-reference.md](docs/progress/ff-5-entity-reference.md); the FF-2 and FF-3
run-by-run rows → [test-run-archive.md](docs/progress/test-run-archive.md).

| Surface | Result |
| --- | --- |
| pgTAP (fresh reset) | **4240 / 4240 PASS** (suite `276` = 73 assertions) |
| Vitest | **851 / 851** (51 files) |
| lint · typecheck · `next build` | **0/0** · clean · **EXIT=0** |
| migrations | **235 == 235** (max `20260902000900`) |
| `tester` — FF-5 spec | **10 / 10**, 2 consecutive runs |
| `tester` — neighbours | **21 / 21** (ff1 9 · ff2-views 5 · phase6-signoffs 7) |
| full `e2e:prod` (`RESET=1 REBUILD=1`) | **863 passed · 0 real failures** |

**Gate triage (the standing method, and it settled this in two steps).** All 53 raw reds were in
**one batch**, and **every one of the 106 errors in it was `net::ERR_CONNECTION_REFUSED` — not one
assertion failure**; `server.log` showed `The destination stream closed early` after test 8. Batch 5
held the six heaviest FF specs in a single server lifetime. Re-running the identical 63 at
`BATCH_SIZE=2` (fresh server per pair) → **63/63**. Same shape as FF-3's gate (140 raw, 2 real).

> Count connection errors per batch **first**, then look for any non-connection error kind. Two
> tells worth keeping: a **0 ms** duration is not an assertion failure (libuv crash), and a collapse
> run can fail test 1, recover, then die later — so the first failure is *not* the collapse point.

⚠ **pgTAP needs a FRESH `supabase db reset`.** A second suite run against the same DB gives
**4200 + a hard abort in `161_recommend_result_source`** (that file mutates feature flags). That is
contamination, not a defect — the lead tripped over it once and it reads exactly like a real red.
## QA Verdicts

<!-- ONE LINE per phase/feature: verdict + date + link. The full analysis lives in
     docs/reviews/*.md — never restate rationale here, and don't copy it to
     docs/progress/qa-verdicts-archive.md either (redundant with the review file).
     Struck-through rows are superseded rounds, kept only to show a phase looped. -->

| Phase / Feature | Verdict | Date | Report |
| --- | --- | --- | --- |
| **FF-5** — Entity Reference (ADR 0091 + Amendments 1–2) | ✅ APPROVED | 2026-07-28 | [r2](docs/reviews/phase-FF-5-review.md#ff-5--qa-review-r2) |
| ~~**FF-5** — Entity Reference (ADR 0091 + Amendments 1–2)~~ | ⛔ CHANGES REQUESTED | 2026-07-28 | [review](docs/reviews/phase-FF-5-review.md) |
| **FF-3** — Validation Engine (ADR 0090 + Amendments 1–4) | ✅ APPROVED | 2026-07-28 | [r2](docs/reviews/ff-3-review.md#ff-3--qa-review-r2) |
| ~~**FF-3** — Validation Engine (ADR 0090 + Amendments 1–3)~~ | ⛔ CHANGES REQUESTED | 2026-07-28 | [review](docs/reviews/ff-3-review.md) |
| **FF-2** — Matrix & Risk Matrix (ADR 0089) | ✅ APPROVED | 2026-07-27 | [r2](docs/reviews/ff-2-review-r2.md) |
| ~~**FF-2** — Matrix & Risk Matrix (ADR 0089)~~ | ⛔ CHANGES REQUESTED | 2026-07-27 | [review](docs/reviews/ff-2-review.md) |
| **FF-1** — Repeating Groups (ADR 0087 + Amendment 1) | ✅ APPROVED | 2026-07-27 | [review](docs/reviews/phase-FF-1-review.md) |
| S5 · **ETH·E3a** — Ethics terminology/UX surfacing (ADR 0064 D4 / 0072 / 0073) | ✅ APPROVED | 2026-07-27 | [review](docs/reviews/phase-E3a-review.md) |
| **Case Correction Lifecycle** (ADR 0085, branch `case-corrections`) | ✅ APPROVED | 2026-07-24 | [review](docs/reviews/case-corrections-review.md) |
| **Controlled-Document Redesign** (Phase 17 v2, ADR 0081) | ✅ APPROVED | 2026-07-21 | [review](docs/reviews/document-control-redesign-review.md) |
| S4 · **CH** — Committee Charters & Meeting Cadence (ADR 0080; Phase 21) | ✅ APPROVED | 2026-07-20 | [review](docs/reviews/phase-CH-review.md) |
| RV2 · **R2–R5** referral governance (triage/SLA · resolution lifecycle · assignment | ✅ APPROVED | 2026-07-19 | [review](docs/reviews/rv2-r2-r5-review.md) |
| AUTHZ · **AUDIT-DOOR-BLINDNESS P0** (ADR 0078 §7.14 / ADR 0079) | ✅ APPROVED | 2026-07-18 | [review](docs/reviews/authz-door-audit-p0-review.md) |
| S4 · ETH·E2 — Ethics disciplinary procedure (ADR 0073; 0078-reconciled) | ✅ APPROVED | 2026-07-18 | [review](docs/reviews/eth-e2-review.md) |
| AUTHZ · **Gate 2** (Stage C · F1 · N1) | ✅ APPROVED | 2026-07-17 | [review](docs/reviews/authz-gate-2-review.md#re-review-2026-07-17--verdict--approved) |
| ~~AUTHZ · **Gate 2** (round 1)~~ | ⛔ CHANGES REQUESTED | 2026-07-17 | [review](docs/reviews/authz-gate-2-review.md) |
| AUTHZ · Stage B — `case_access → case_access_grants` hard cut (B1→B5) | ✅ APPROVED | 2026-07-16 | [review](docs/reviews/authz-b-series-review.md) |
| AUTHZ · Exclusion Perimeter (U1+U2) — the hard deny at every door | ✅ APPROVED | 2026-07-16 | [review](docs/reviews/authz-exclusion-perimeter-review.md) |
| AUTHZ · A4 — org admin ceases to be a Case Content source | ✅ APPROVED | 2026-07-16 | [review](docs/reviews/authz-a4-review.md) |
| AUTHZ · A2 — the capability resolver (`_case_caps` + projections) | ✅ APPROVED | 2026-07-16 | [review](docs/reviews/authz-a2-review.md) |
| AUTHZ · M6 — `cases.visibility_policy` guarded door (ADR 0078 A1/A27; PO Q1–Q4) | ✅ APPROVED | 2026-07-16 | [review](docs/reviews/authz-m6-review.md) |
| AUTHZ · M5 — defect ③: the `is_active` outer gate | ⛔ CHANGES REQUESTED | 2026-07-15 | [review](docs/reviews/authz-m5-review.md) |
| AUTHZ · M3 — defect ① narrowing: assignment ⇏ PHI | ✅ APPROVED | 2026-07-15 | [review](docs/reviews/authz-m3-review.md) |
| AUTHZ · M2 — A30 bucket C: platform_admin loses PHI | ✅ APPROVED | 2026-07-15 | [review](docs/reviews/authz-m2-review.md) |
| AUTHZ · M1 — Exclusion durability (ADR 0078 Gate 1) | ✅ APPROVED | 2026-07-15 | [review](docs/reviews/authz-m1-review.md#re-review--the-b1b2-delta) |
| ~~AUTHZ · M1 (round 1)~~ | ⛔ CHANGES REQUESTED |  | [review](docs/reviews/authz-m1-review.md) |
| AUTHZ · A0 — Catalog-driven capability inventory | ✅ APPROVED |  | [review](docs/reviews/authz-a0-inventory-review.md#v3-review--the-final-a0-round) |
| S3·ETH·E1 — Ethics access spine + m2 gate release (ADR 0072) | ✅ APPROVED | 2026-07-14 | [review](docs/reviews/phase-ETH-E1-review.md) |
| AI track — Action-Items Satellites + Cross-Link UI (ADR 0050) | ✅ APPROVED | 2026-07-14 | [report](docs/reviews/phase-AI-review.md) |
| AI track — BE-6·N reminder→N scan arm (delta; ADR 0076 × 0050) | ✅ APPROVED | 2026-07-14 | [report](docs/reviews/phase-AI-review.md#be-6n-delta-review--remindern-scan-arm-2026-07-14) |
| S2·RV2·R1 — Referrals v2: dialogue core (ADR 0037 Amendment 1) | ✅ APPROVED | 2026-07-14 | [report](docs/reviews/rv2-r1-referrals-review.md) |
| S2·IV2 — Interviews v2: sessions + reporting/confidentiality (ADR 0070) | ✅ APPROVED | 2026-07-13 | [report](docs/reviews/iv2-interviews-review.md) |
| S1·MEM — Single `memberships` collapse (ADR 0071/0075; S0 §I) | ✅ APPROVED | 2026-07-13 | [report](docs/reviews/memberships-collapse-review.md) |
| F3 — Flexible-Forms Foundation (ADR 0060/0065) | ✅ APPROVED | 2026-07-12 | [report](docs/reviews/phase-F3-review.md) |
| F2 — Centralized Attachments (ADR 0063) | ✅ APPROVED | 2026-07-11 | [report](docs/reviews/phase-F2-review.md) |
| F1 — Case-Participants E0 (ADR 0064/0066) | ✅ APPROVED | 2026-07-10 | [report](docs/reviews/phase-F1-review.md) |
| Meeting actual-occurrence time `held_at`/`held_end` (ADR 0062) | ✅ APPROVED | 2026-07-08 | [report](docs/reviews/meeting-held-time-review.md) |
| Administrativo delegated-capability role (ADR 0061) | ✅ APPROVED | 2026-07-08 | [report](docs/reviews/administrativo-review.md) |
| Form-Builder Enhancements batch (Departments · Flagged/aggregate results · Others · w | ✅ APPROVED | 2026-07-07 | [report](docs/reviews/adjustments-batch-review.md) |
| 17 — Controlled-Document Lifecycle (Gestão de Documentos Controlados) | ✅ APPROVED | 2026-07-06 | [report](docs/reviews/phase-17-review.md) |
| 15 — Quality Indicators (Indicadores de Qualidade) | ✅ APPROVED | 2026-07-06 | [report](docs/reviews/phase-15-review.md) |
| Pre-Pilot DB Hardening — Wave 2 (WS-6 perf sweep: P2/P3/P4/P5) | ✅ APPROVED | 2026-07-05 | [report](docs/reviews/pre-pilot-hardening-wave2-review.md) |
| Pre-Pilot DB Hardening — Wave 1 (C-1…C-6, H-8; D1/D2/D4/D6-flip/D7/D9; P1/P9/P10) | ✅ APPROVED | 2026-07-05 | [report](docs/reviews/pre-pilot-hardening-wave1-review.md) |
| Phase B — NSP-per-hospital + `nsp_org_admin` (ADR 0052) | ✅ APPROVED | 2026-07-03 | [report](docs/reviews/nsp-per-hospital-review.md) |
| Phase A — Hospital-admin tier, 4-tier audit & committee titles (ADR 0051) | ⛔ CHANGES REQUESTED | 2026-07-03 | [report](docs/reviews/hospital-admin-tier-review.md) |
| Action-Items Fold + `visibility_scope` + Case-Access Expiry (ADR 0050) | ✅ APPROVED | 2026-07-02 | [report](docs/reviews/action-items-fold-review.md) |
| Shared (non-PHI) `action_items` table (Option A) | ✅ APPROVED | 2026-07-02 | [report](docs/reviews/shared-action-items-review.md) |
| Member Overview & "Meus itens de ação" | ✅ APPROVED | 2026-07-02 | [report](docs/reviews/member-overview-action-items-review.md) |
| User Registration & Identity Management | ✅ APPROVED | 2026-07-01 | [report](docs/reviews/user-registration-review.md) |
| ad-hoc-narratives | ✅ APPROVED | 2026-07-01 | [report](docs/reviews/ad-hoc-narratives-review.md) |
| answer-model-v2 | ✅ APPROVED | 2026-07-01 | [report](docs/reviews/answer-model-v2-review.md) |
| form-model-norm | ✅ APPROVED | 2026-07-01 | [report](docs/reviews/form-model-normalization-review.md) |
| result-rec | ✅ APPROVED | 2026-06-26 | [report](docs/reviews/result-rec-review.md) |
| NSP-per-org | ✅ APPROVED | 2026-06-25 | [core](docs/reviews/nsp-per-org-a-review.md) |
| Multi-Tenancy | ✅ APPROVED | 2026-06-25 | [report](docs/reviews/multitenancy-review.md) |
| Form Builder Enhancements | ✅ APPROVED | 2026-06-23 | [report](docs/reviews/form-builder-enhancements-review.md) |
| `case_phase_results` | ✅ APPROVED | 2026-06-23 | [report](docs/reviews/phase-results-review.md) |
| 23 — Patient Identity | ✅ APPROVED | 2026-06-22 | [report](docs/reviews/phase-23-review.md) |
| `case_patient` (ADR 0038) | ✅ APPROVED | 2026-06-22 | [report](docs/reviews/case-patient-review.md) |
| 22 — Inter-Committee Referrals | ✅ APPROVED | 2026-06-21 | [report](docs/reviews/phase-22-review.md) |
| PHI/HIPAA Remediation (WS0–E) | ✅ APPROVED | 2026-06-20 | [report](docs/reviews/phi-remediation-review.md) |
| 14b–14d — Triage/RCA/CAPA | ✅ APPROVED | 2026-06-18 | [report](docs/reviews/phase-14-review.md) |
| 14a — NSP Foundation | ✅ APPROVED | 2026-06-18 | [report](docs/reviews/phase-14a-review.md) |
| 13 — Audit Trail | ✅ APPROVED | 2026-06-18 |  |
| 12 — Case Timeline | ✅ APPROVED | 2026-06-16 | [report](docs/reviews/phase-12-review.md) |
| 11 — Interviews | ✅ APPROVED | 2026-06-15 | [report](docs/reviews/phase-11-review.md) |
| 10 — Meetings | ✅ APPROVED | 2026-06-15 | [report](docs/reviews/phase-10-review.md) |
| Case Access Control | ✅ APPROVED | 2026-06-19 | [report](docs/reviews/case-access-control-review.md) |
| Case Narratives | ⛔ CHANGES REQUESTED | 2026-06-19 | [report](docs/reviews/case-narratives-review.md) |
| Case data-model (D1–D15) | ✅ APPROVED | 2026-06-14 | [report](docs/reviews/case-model-adjustments-review.md) |
| Cases-Extras (R1–R5) | ✅ APPROVED | 2026-06-14 | [report](docs/reviews/cases-extras-review.md) |
| 8 — Dashboards | ✅ APPROVED | 2026-06-14 | [report](docs/reviews/phase-8-review.md) |
| 7 — Multi-Phase Cases | ✅ APPROVED | 2026-06-13 | [report](docs/reviews/phase-7-review.md) |
| 6 — Sign-offs | ✅ APPROVED | 2026-06-13 | [report](docs/reviews/phase-6-review.md) |
| 5 — Wizard | ✅ APPROVED | 2026-06-13 | [report](docs/reviews/phase-5-review.md) |
| 4 — Form Builder | ✅ APPROVED | 2026-06-12 | [report](docs/reviews/phase-4-review.md) |
| 3 — Admin/Users | ✅ APPROVED | 2026-06-12 | [report](docs/reviews/phase-3-review.md) |
| 2 — Auth & Shell | ✅ APPROVED | 2026-06-12 | [report](docs/reviews/phase-2-review.md) |
| 1 — Schema/RLS | ✅ APPROVED | 2026-06-12 | [report](docs/reviews/phase-1-review.md) |
| 0 — Scaffolding | ✅ APPROVED |  | [report](docs/reviews/phase-0-review.md) |

## Decisions

<!-- One line per decision; full rationale in docs/decisions/ (ADR) + docs/progress/decisions-log.md -->

| Date | Decision | Ref |
| 2026-07-27 | **Flexible-Forms FF-1…FF-5 pulled pre-pilot** (PO) — all five feature phases build before the pilot and gate the pilot deploy; order … | [0086](docs/decisions/0086-flexible-forms-pre-pilot.md) · [program](docs/plans/flexible-forms-program.md) |
| 2026-07-27 | **FF-1 Repeating Groups rulings** (PO, grilling interview) — nesting **capped at depth 1, schema-enforced**; conditions resolve **inside-out** … | [0087](docs/decisions/0087-ff1-repeating-groups.md) |
| 2026-07-23 | **Case custom fields** — template-defined, **non-PHI** administrative descriptors on cases (e.g. M&M "Número da Declaração de Óbito"); … | [0083](docs/decisions/0083-case-custom-fields.md) |
| 2026-07-16 | **`manage_case_access` — KEEP (confirmed, PO).** The resolver computes `v_orgadmin` (`is_commission_admin_of_for`, ~19% of per-row cost) solely to … | [ADR 0078 D1/A16](docs/decisions/0078-authorization-capability-model.md) |
| 2026-07-16 | **Meeting family — ACCEPT AS-IS (exclusion-perimeter residual).** A coordinator recused from case X can conclude a multi-case meeting discussing X, … | [handoff §5](docs/progress/authz-handoff.md) |
| 2026-07-16 | **ADR 0078 A5 perf gate PASSED — no migration.** Resolver parity-or-faster + strictly linear on realistic (2005-case) data; qa MAJOR-1 ~10× was vs … | [ADR 0078 D2/A5](docs/decisions/0078-authorization-capability-model.md) · [handoff §5](docs/progress/authz-handoff.md) |
| 2026-07-12 | **Pre-pilot release scope expansion** — pulled 12 initiatives (Phases 20–21, Referrals v2, Interviews v2, Ethics E1–E3, action-items … | [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md) |
| 2026-07-12 | **Referrals v2 — Dialogue & Governance** — adopt the missing two-way dialogue (`referral_messages` thread) + defer 12 items (triage/SLA, … | [0037-A1](docs/decisions/0037-inter-committee-case-referrals.md) · [plan](docs/plans/referrals-v2-dialogue-governance.md) |
| 2026-07-10 | **Pre-Pilot Foundations Program** — one collision-free plan sequencing F0→F1 participants→F2 attachments→F3 flexible-forms→F-cleanup for … | [program](docs/plans/pre-pilot-foundations-program.md) |
| 2026-07-09 | **Case subject generalization → participants/roles/professional-registry/case-types** (E0 foundation for Ethics + other non-patient-centered … | [0064](docs/decisions/0064-case-subject-generalization-participants.md) |
| 2026-07-09 | **Centralized-attachments substrate refinement** (14e) — single authorizing owner + `attachment_references`, `attachment_subjects`, … | [0063](docs/decisions/0063-centralized-attachments-substrate.md) |
| 2026-07-08 | **Administrativo delegated-capability role** — per-commission appointment + curated, finite capability menu … | [0061](docs/decisions/0061-administrativo-delegated-role.md) |
| 2026-07-06 | **Coolify as the pre-Phase-9 dev/staging deployment target** — Dockerfile-only (Coolify's Traefik replaces the Phase-9-planned Caddy/compose … | [0059](docs/decisions/0059-coolify-deployment-target.md) |
| 2026-07-05 | **Phase 15/17 revision + pre-pilot re-sequencing** — build order **15 → 17 → 16** (documents pulled pre-pilot; pilot after 16; 18–21 … | [0057](docs/decisions/0057-indicators-doc-control-replan.md) |
| 2026-07-06 | **Phase 15 derived-measurement compute** — `compute_derived_measurement` replicates the `dashboard_distributions` mechanics (submitted spine, … | [0058](docs/decisions/0058-derived-measurement-compute.md) |
| 2026-07-02 | **Action-items fold + `visibility_scope` + case-access expiry** — scope-aware hub `SELECT` via `can_read_action_item`; fold `case_action_items` → … | [0050](docs/decisions/0050-action-items-fold-visibility-scope-case-access-expiry.md) |
| 2026-07-01 | **Answer-Model v2** (planned) — uniform answer row + typed scalar cols (`value_number/date/time`) + instance-ready answer key … | [0045](docs/decisions/0045-answer-model-v2.md) |
| 2026-07-01 | **Forward-compat form capabilities** (planned) — `form_items.parent_item_id` + reserved hooks for repeating groups / file-signature-matrix answers … | [0046](docs/decisions/0046-forward-compat-form-capabilities.md) |
| 2026-06-25 | **NSP-per-org** — bind the PQS roster + every PHI door to an organization (per-org `pqs_members`/`pqs_department`, `nsp_coordinator` grant via the … | [0042](docs/decisions/0042-nsp-per-org.md) |
| 2026-06-25 | **Multi-Tenancy** — pooled single-DB (organizations → hospitals → commissions); vendor `platform_admin` vs customer `org_admin`; RLS rewrite + … | [0041](docs/decisions/0041-multi-tenancy-organizations-hospitals.md) |
| 2026-06-20 | **PHI-remediation Round 3** — RCA-write severance (drop `is_admin` from 7 `rca_*_write`) + WS B audited free-text reads/PHI classification + WS E … | plan §A4/B/E; ADR 0030/0031 |
| 2026-06-20 | **PHI-remediation WS C** — PHI retention & disposal (`dispose_event_phi`, one-shot HC056, constrained reason enum) | plan §C; ADR 0030/0031 |
| 2026-06-20 | **PHI-remediation WS A** — structured-identifier lockdown: real `pqs_members` roster, tight `can_read_event_patient`, single audited door, sever … | plan §A; ADR 0030/0031 |
| 2026-06-20 | **Migration squash** → domain-partitioned dump-based baseline (replaced 86 incremental migrations; WS0) | plan §WS0 |
| 2026-06-19 | **Case Access Control** — per-case read/write ACL + attribution-driven full-case read; restrictive `can_read_case`; narrative lifecycle | [0033](docs/decisions/0033-case-access-control.md) |
| 2026-06-11 | Scaffolding & toolchain: Next 16/React 19, shadcn (radix/neutral), vitest ESM, Supabase CLI devDep, Chromium-only | [0001](docs/decisions/0001-scaffolding-and-toolchain.md) |
| 2026-06-11 | `jsdom` pinned `^25` (jsdom@27 ESM dep crashes Vitest forks on Node 20) | – |
| 2026-06-12 | Admin claim via custom access-token hook reading `profiles.is_admin`; RLS helper DB-read fallback | [0002](docs/decisions/0002-admin-claim-access-token-hook.md) |
| 2026-06-12 | DB tests via pgTAP (`npx supabase test db`) | [0003](docs/decisions/0003-pgtap-for-db-tests.md) |
| 2026-06-12 | Sign-off enforcement gated by an `app.feature_flags` row read by `submit_response` | [0004](docs/decisions/0004-signoff-feature-flag.md) |
| 2026-06-12 | `visible_when` v1 = single condition (no AND/OR), CHECK-enforced shape + publish-time validation | [0005](docs/decisions/0005-visible-when-shape.md) |
| 2026-06-12 | Keep legacy env-var names while accepting new publishable/secret CLI keys | [0006](docs/decisions/0006-supabase-api-key-naming.md) |
| 2026-06-12 | Phase 2: `multi@test.local` as staff of both ccih+farmacia (commission-picker E2E); seed 8 users/8 memberships | – |
| 2026-06-12 | Middleware is a coarse auth gate; role-aware landing deferred to root `/` Server Component | [0007](docs/decisions/0007-middleware-coarse-gate-root-landing.md) |
| 2026-06-12 | GSAP 3.15.0 pinned for the auth-hero animation (dynamic import, aria-hidden, reduced-motion) | [0008](docs/decisions/0008-gsap-animation-dependency.md) |
| 2026-06-12 | Auth identity on the request hot path via LOCAL JWT verification (`getClaims()`, ES256/JWKS) | [0009](docs/decisions/0009-jwt-local-verification-gate.md) |
| 2026-06-12 | Phase 3: denormalize `email` (nullable citext) onto `public.profiles` (trigger-populated) | [0010](docs/decisions/0010-denormalize-email-on-profiles.md) |
| 2026-06-12 | Phase 4: position reorder via DEFERRABLE INITIALLY IMMEDIATE unique constraints + CASE swap | [0011](docs/decisions/0011-position-reorder-deferrable-swap.md) |
| 2026-06-12 | Phase 4: `clone_form_version` returns the existing draft when one exists (idempotent edit) | [0012](docs/decisions/0012-clone-returns-existing-draft.md) |
| 2026-06-12 | Phase 4: fixed latent Phase-1 RLS defect in `form_versions_staff_admin_write` WITH CHECK | [0013](docs/decisions/0013-form-versions-insert-rls-fix.md) |
| 2026-06-12 | Phase 5: response-fill via two security-invoker RPCs (`save_section_answers`, `start_or_resume_response`) | [0015](docs/decisions/0015-response-fill-rpcs.md) |
| 2026-06-13 | Phase 7 (P7-002): custom SQLSTATE class `P00xx` → `HC0xx` (HC010–HC022) | [0018](docs/decisions/0018-custom-sqlstate-class.md) |
| 2026-06-13 | Phase 7: Multi-phase cases — 4 new tables (process_templates/phases; cases/case_phases) | [0017](docs/decisions/0017-multi-phase-cases.md) |
| 2026-06-13 | Maintenance: the default (anchor) section may carry a title once a form has ≥2 sections | [0019](docs/decisions/0019-default-section-may-carry-title.md) |
| 2026-06-13 | Phase 8: dashboard-countable responses exclude case-phase responses (`case_phase_id IS NULL`) | [0020](docs/decisions/0020-dashboard-countable-responses.md) |
| 2026-06-14 | Cases-Extras R2: configurable per-committee case status (no longer fixed 3-state CHECK) | [0023](docs/decisions/0023-configurable-case-status.md) |
| 2026-06-14 | Cases-Extras R1 documents+events, R3 tags, R4 action items | [0023](docs/decisions/0023-configurable-case-status.md) |
| 2026-06-14 | Post-Phase-8: due dates for case phases (`default_due_days` + `case_phases.default_due_*`) | [0021](docs/decisions/0021-phase-due-dates.md) |
| 2026-06-14 | Case data-model adjustments — phase blocking, FIXED statuses, outcomes (supersedes R2) | plan `the-current-case-data-bright-hartmanis.md` |
| 2026-06-13 | Phase 6: staff_admin sign-off read via two narrow security-definer RPCs (`list_signoff_queue`, `get_response_for_signoff`) | [0016](docs/decisions/0016-signoff-definer-read-path.md) |
| 2026-06-16 | Phase 12: Case Timeline (read-only viz; no migration, reuses table RLS) | [0027](docs/decisions/0027-case-timeline.md) |
| 2026-06-15 | Phase 10: Meetings (B1–B5) — 8 migrations; 6-state lifecycle | [0025](docs/decisions/0025-meetings.md) |
| 2026-06-18 | Phase 14 batch: build 14b (Triage) → 14c (RCA) → 14d (CAPA) in dependency order as one build | accred-track §14b–14d |

## Follow-ups / Deferred Items

<!-- OPEN backlog only (reviewed at each phase start). Resolved [x] items archived →
     docs/progress/follow-ups-archive.md (full snapshot). -->

### 🔴 FUP-FF5-1 — patient-lane sublabel is degenerate on the READ path (**PO DEFERRED 2026-07-28**)

The picker shows `Paciente / Paciente afetado`; the **durable submitted record** and wizard resume
show `Paciente / Paciente`. `buildReferenceAnswers`' input row carries no case data, so it resolves
the participant **type** while `reference_candidates` and `app.references_by_item` resolve the case
**role**. Every patient's `display_name` is the surrogate `'Paciente'` by construction, so **two
patient references in one case are indistinguishable in the permanent record**.

QA r1: **MAJOR, but ship** — every disambiguator that would work is PHI and would reverse ADR 0091
ruling 1 (which is why Rule 12 stays at three modules). The only mitigation that does not undo the
ruling is a **workflow rule**: require distinct `case_participant_roles` per patient per case.
Code fix (giving `buildReferenceAnswers` case scope) is a three-level PostgREST embed with PGRST201
exposure — both engineers independently judged it not gate-time work.

⚠ **The PO deferred the decision, not the risk.** The patient lane is live behind `entity_refs` the
moment FF-5 deploys, and ruling 2 makes that lane work **only** on case-bound forms — so this is
100% of real patient-lane usage, unexercised rather than unlikely. **Resolve before the lane is
offered to a real committee.**

### ▶ FUP-FF5-2 — `r2-m-1`: §O pins the door's behaviour, not the closure of the writer set

ADR 0091's substrate paragraph claims *"an exhaustive `pg_proc` sweep for writers of `participants`
returns exactly two functions"*. §O proves the two known doors behave (the surrogate holds) and O5
proves no writer is invoker-rights — but neither pins that the set is **closed**, so a third
DEFINER writer taking a caller-supplied label satisfies every assertion. QA r2: MINOR, not blocking
(the runtime property is held by the mutation-proven O4, and a new writer arrives with its own
migration and ADR). **Close:** one assertion pinning the writer set by **count *and* name**,
matching `(public\.)?participants\y`. Two specifics — O5's current regex is
`insert\s+into\s+public\.participants`, which matches only `public.`-qualified writes (exactly why
a rogue *unqualified* writer probe stayed green), and use `\y`, **not `\b`** (backspace in Postgres
regex).

### ▶ FUP-E2E-1 — RE-BASELINE `e2e:prod` (cross-phase, PO-ruled 2026-07-27) — **blocks nothing**

Replace the *"~18–27 expected failures"* folklore with a **named list**: run the suite on a clean
stack and classify **every** failure as `infra` / `deterministic-real` / `genuinely-flaky`, each with
an owner.

*Why:* **a count-shaped baseline is a hiding place, not a known-issues list.** FF-2's gate ran
762 passed / 55 failed; splitting by connection errors showed **52 were infra** (the
`supabase_vector` crash-loop class) and **3 were real and deterministic** — one of which
(**BUG-FF1-008**) had been red on every run since FF-1 and written off as baseline noise.

Make the triage step itself documented rather than reinvented per lead: **conn errors `> 0` = infra ·
`= 0` = real.** Also establish why batches terminate early — two reported "did not run" (11 and 39),
so raw totals misstate coverage in **both** directions.

### ▶ FUP-FF2-3 — whitespace-only observation, per-instance (DEFERRED by the lead 2026-07-27)

After BUG-FF1-007 fixed the `<> ''''` quoting slip, the per-instance filters compare `<> ''` while the
top-level one uses `btrim(...) <> ''` — so a **whitespace-only** observation is filtered at top level
but not per instance.

**Deliberately deferred, on scope discipline rather than merit:** it is a *different* defect from the
one ruled in, it is cosmetic (a blank observation block renders inside a group instance), and it
would have been the third out-of-phase fix of a wave already at its gate. **`tester` independently
confirmed the deferral is safe** — both canonical writers normalise with `nullif(btrim(...), '')`, so
the whitespace case is reachable only for **legacy rows**, the same population BUG-FF1-007 defends.

### ▶ FUP-FF1-2 — FF-1 QA non-blocking items (review r2: 4 MINOR / 6 INFO) — **7 still open**

All ruled non-blocking by `qa`. Detail rotated 2026-07-28 →
[ff-1-repeating-groups.md](docs/progress/ff-1-repeating-groups.md); canonical analysis →
[phase-FF-1-review.md](docs/reviews/phase-FF-1-review.md) (the playbook's rule: never restate a
review's rationale here).

Open: **MINOR-1** `completeness_authorities_agree` is one-directional in pgTAP · **MINOR-2** the
suite header documents a keystone that does not exist · **MINOR-3** MUTATION F3 names the wrong
mutation · **MINOR-4** stale-comment asymmetry in `supersede_response` · **INFO-2** no coherence
guard on the direct-DML path · **INFO-3** · **INFO-4** the parity vectors have no drift detector.
Closed: INFO-1 (superseded by MINOR-4) · INFO-5 (discharged at Record) · INFO-6 (carried forward as
a binding FF-2/FF-5 requirement — **both phases have since discharged it**).

> ⚠ MINOR-2 and MINOR-3 are the same family FF-5 hit eight more times: a comment or a test name
> asserting something that is not true. Cheap to fix, invisible to every gate.
### ▶ FUP-FF1-1 — coherent fill-path hardening (post-pilot; ADR 0087 ruling 5)

- [ ] Revisit **DEFINER + per-mutation audit for the whole fill path** — `answers`,
  `answer_selected_options`, `response_group_instances` **together**, as one change. Today all three
  are direct-DML-under-RLS with no per-row audit (Rule 11 is satisfied for filling at the *response*
  level via `audit_responses_trg`); FF-1 deliberately matched that convention rather than hardening
  one table piecemeal. Decide the target posture for the set, not for a member of it.

### ▶ AUTHZ Gate-2 deferred (PO-noted 2026-07-17, non-blocking — Gate 2 shipped)

- [ ] **MINOR-1 — reserved-session door returns the respondent's own `case_id`.** `get_reserved_session_items`
  now masks times + process number on `NOT is_case_respondent`, but a respondent still receives their **own**
  `case_id` (no cross-case / cross-patient re-identification). Whether the respondent should see even their own
  linkage on the reserved door is the unresolved **A7-vs-A26** call — **fold the reconciliation at pilot close**.
  Owned by `backend`.

### ▶ ETH·E1 → ETH·E2 inheritance (PO-directed 2026-07-14: "log for E2, don't act now")

Three **known gaps**, all the same class — *pre-existing scope decisions E1 does not own*, made **visible** by
E1's stricter access model. QA and `backend` independently judged each out of E1's scope; the PO agreed and
routed all three to **ETH·E2**. Detail + reasoning → [eth-e1-access-spine.md](docs/progress/eth-e1-access-spine.md) §4.

- [ ] **GAP-E1-1 — `action_items` `assignees_only` arm never consults `can_read_case`.** A respondent who is also
  an `org_admin` could see an assignees-only item on the case investigating them. AI's shipped item-visibility
  model (org_admin-only, no case content), not MAJOR-1's shape. Owned by `backend` at E2.
- [ ] **GAP-E1-2 — `patient_safety_event` has no case arm.** `can_read_event` grants via three **event**-dimension
  arms (owner-commission / reporting-commission / NSP-operator) and **zero** case arm, so an ethics-case respondent
  who is an NSP operator reaches the linked event. QA verified it carries the event's **own** incident narrative,
  not case deliberation — *"the decisive contrast with MAJOR-3"*; residual = **link-existence inference only**.
  Gating it would rewrite the NSP/PHI-module-1 model E1 doesn't own. Owned by `backend` at E2.
- [ ] **GAP-E1-3 — privileged-doc ceiling has no coordinator arm (UX, not security).** A `staff_admin` needs a
  `case_access.max_confidentiality` clearance to open a `legal_privileged`/`credentialing_sensitive` doc — so the
  coordinator who *uploads* one must self-grant clearance to reopen it. **Correct per ADR 0072 D5's grant-based
  model**; the affordance (self-clearance-on-upload, or an explicit "grant myself clearance" flow) is E2/E3's.
  Owned by `frontend` at E2/E3.

Two **QA Minors** (non-blocking, **test-coverage only** — neither touches the security property):

- [ ] **MINOR-A — the generic leak sweep can pass VACUOUSLY.** Measured **10/14 covered, 4/14 vacuous**
  (`action_items`, `case_phase_offered_results`, `case_tag_assignments`, and **E1's own
  `case_conflict_declarations`** — safe by construction but *unproven* by the sweep). Fix: report zero-row tables
  as **uncovered** rather than silently passing them. Owned by `backend` at E2.
- [ ] **MINOR-B — `action_items` passes the sweep by FIXTURE ACCIDENT, not by documented exclusion.** It's the
  GAP-E1-1 accepted-gap class but isn't in the sweep's exclusion list; the moment someone seeds an
  `assignees_only` item the sweep fails and reads as a regression. **Make it a decision, not an accident.** Owned
  by `backend` at E2.

- [ ] **ETH·E1 — participant-roles M2M (ADR 0072 D7·4) deferred to E2.** No build-plan §4 gate criterion covers
  it and its shape depends on E2's decision model. QA verified nothing half-built was left behind. Owned by `backend`.


_Parked / deferred backlog — full detail (owner, rationale, repro) relocated to **[deferred-backlog.md](docs/progress/deferred-backlog.md)** to keep this tracker scannable; titles + pointers kept live below._

- [ ] **Ethics Committee track — E2 (procedure) + E3 (terminology/UX) remain; E0 (case-participants, ADR 0064) and E1 (access spine, ADR 0072) are COMPLETE** → [detail](docs/progress/deferred-backlog.md)

- [ ] **P7 — `audit_log` range-partitioning DEFERRED (lead decision 2026-07-05, pre-pilot hardening WS-5)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **D3 — jsonb/array → junction-table normalization DEFERRED to its own scoped plan (user decision 2026-07-05, pre-pilot hardening WS-3b)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **D7 — thread `p_hospital_id` for hospital-scoped NSP vocab. RE-SCOPED 2026-07-07: NOT backend-only — needs FE + a product decision (deferred)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **WS-3c FE follow-up — manual-CAPA UI should pass `p_hospital_id` for MULTI-hospital operators (backend, non-breaking). BLOCKED — confirmed 2026-07-07 (Batch B)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **WS-4 C-6 FE follow-ups — PHI-disposal UI + copy (backend + frontend; before the pilot exposes disposal UI)** → [detail](docs/progress/deferred-backlog.md)

- [ ] **Action-items hub — REMAINING satellites, adopt-on-demand (partner-handoff Phases 2–4; ADR [0050](docs/decisions/0050-action-items-fold-visibility-scope-case-access-expiry.md)). ⚠ NARROWED 2026-07-28: the S2·AI track shipped reminders + updates + checklists 2026-07-14 ([ai-satellites](docs/progress/ai-satellites.md)); only evidence, formal reviews, dependencies, per-committee custom fields, status/urgency management UI + effectiveness checks remain** → [detail](docs/progress/deferred-backlog.md)
- [ ] **Break-glass access (logged, reasoned, time-boxed emergency access to restricted cases / PHI)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **User Registration — Phase-9 email-template deploy dependency (feature COMPLETE; deploy-time task)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **Broader org-member-role-management UI (multi-tenancy gap; surfaced building NSP-per-org B3)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **NSP appoint-picker: annotate/exclude current org_admins (minor UX, NSP-per-org B3)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **`appointNspCoordinator` TOCTOU hardening (optional, NSP-per-org B3)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **Multi-tenancy — org_admin TS-gate gap in the invoker `authorize*` helpers (QA INFO / lead #15, non-blocking)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **Pre-existing full-serial-suite contamination (NOT a form-builder regression)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **Harden `e2e/form-builder-enhancements.spec.ts` to a throwaway commission (QA INFO-4, nice-to-have)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **`case_patient` disposal UI — "Descartar dados do paciente" (frontend, not blocking; mirrors the NSP WS C item below)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **WS A FE — PQS-membership management UI (frontend, not blocking)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **WS A FE — `/admin/nsp` gating + patient-panel affordance (frontend/tester, surfaced by WS A trace 2026-06-20)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **WS E / M2 — per-vocabulary reorder/archive RPC consolidation DEFERRED (backend, 2026-06-20)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **WS B — authoritative PHI-bearing free-text column list (for ARCHITECTURE.md Rule 11/12 + ADR alignment, lead-owned). FINAL count = 22 columns** → [detail](docs/progress/deferred-backlog.md)
- [ ] **WS C FE — "Descartar dados do paciente" disposal UI (frontend, not blocking)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **WS B/C FE — discourage PHI in `*.title` / structured short fields (frontend, not blocking; surfaced 2026-06-20)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **E2E regression suite is NOT reliably green against a PROD build (test-harness debt, surfaced 2026-06-18; NOT a Phase-14 defect)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **E2E `case-narratives` AC-1b spec-isolation (tester-owned; surfaced 2026-06-19 during the case-access refinement triage)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **Phase 14a deferred (QA re-verify INFO):** → [detail](docs/progress/deferred-backlog.md)
- [ ] **Interviews — "Minhas entrevistas" discovery surface for plain-`staff` interviewers (Phase 11, deferred per lead)** → [detail](docs/progress/deferred-backlog.md)
- [ ] **Phase 8 deploy checklist — production Supabase Cloud MUST use asymmetric (ES256/RS256) JWT signing keys** → [detail](docs/progress/deferred-backlog.md)
