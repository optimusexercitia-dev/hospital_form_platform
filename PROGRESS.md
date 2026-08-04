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
| ff-program | **Flexible-Forms Program (FF-1…FF-5)** — umbrella; [0086](docs/decisions/0086-flexible-forms-pre-pilot.md) | ✅ **5 of 5 COMPLETE** — FF-1 ✅ · FF-2 ✅ · FF-3 ✅ · FF-5 ✅ 2026-07-28 · **FF-4 ✅ 2026-08-03** (ADR [0092](docs/decisions/0092-ff4-power-authoring.md) + Amendments 1–2; migrations `20260903000000`–`…000600`; flag `power_authoring` ON via `…000600`; **record → [ff-4-power-authoring.md](docs/progress/ff-4-power-authoring.md)**). ▶ **The program is closed and the pilot deploy is unblocked** (ADR 0086: all five gated it). | ✅ FF-4 (lint 0/0 · tsc · Vitest **873** · `next build`) — lead re-ran, not accepted on report | ✅ FF-4 — spec **7/7** · pgTAP **4301/4301** fresh reset (61 assertions, 12 keystones mutation-proven) · full `e2e:prod` 901p, coverage 926/931, **0 FF-4 defects** (every non-pass dispositioned: 1 non-idempotent spec, 21 batch-11 infra re-run 60/61, BUG-P15-001, 3 flaky, 5 skips) | ✅ FF-4 **APPROVED** [review](docs/reviews/phase-FF-4-review.md) — 0 P0 / 0 MAJOR; QA re-ran pgTAP itself and devised its own over-grant mutation | ✅ **2026-08-03** | 2026-08-03 | FF-4 `4df14d7`…`aa77b0d` (13 commits) |
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

_No active build phase._ **The Flexible-Forms program is 5 of 5 COMPLETE** (ADR 0086) — FF-4 closed
2026-08-03. The pilot deploy is now unblocked: origin push + Coolify + remote `db push`.

| Phase | Flag | Record |
| --- | --- | --- |
| **FF-1** Repeating Groups ✅ 2026-07-27 | `repeating_groups` ON | [ff-1-repeating-groups.md](docs/progress/ff-1-repeating-groups.md) |
| **FF-2** Matrix & Risk Matrix ✅ 2026-07-27 | `matrix_fields` ON | [ff-2-matrix-risk-matrix.md](docs/progress/ff-2-matrix-risk-matrix.md) |
| **FF-3** Validation Engine ✅ 2026-07-28 | `item_validations` ON | [ff-3-validation-engine.md](docs/progress/ff-3-validation-engine.md) |
| **FF-5** Entity Reference ✅ 2026-07-28 | `entity_refs` ON | [ff-5-entity-reference.md](docs/progress/ff-5-entity-reference.md) |
| **FF-4** Power Authoring ✅ 2026-08-03 | `power_authoring` ON | [ff-4-power-authoring.md](docs/progress/ff-4-power-authoring.md) |

**Case-type assignment (ADR 0088) ✅** — template declares → case inherits; record →
[case-type-assignment.md](docs/progress/case-type-assignment.md).

### ▶ FF-4 (Power Authoring) — ✅ COMPLETE 2026-08-03

ADR [0092](docs/decisions/0092-ff4-power-authoring.md) + Amendments 1–2 · flag `power_authoring`
**ON** via gate-flip `20260903000600` · QA ✅ APPROVED [review](docs/reviews/phase-FF-4-review.md) ·
human-approved 2026-08-03. **Full detail, the five defects this phase surfaced, and the non-blocking
items it carried out → [ff-4-power-authoring.md](docs/progress/ff-4-power-authoring.md).**

### 📋 Remaining pre-pilot work

Expanded 2026-07-12 — ADR [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md); **re-expanded
2026-07-27 — ADR [0086](docs/decisions/0086-flexible-forms-pre-pilot.md)** (Flexible-Forms FF-1…FF-5 pulled
pre-pilot). **ALL FIVE FF phases are ✅ COMPLETE — the program closed 2026-08-03 with FF-4**; this is the
standing backlog — remaining pre-pilot = the FUP-AI-1 workstream, then the **pilot deploy** (no gated
phase remains in front of it).

> ⚠ **BUG-P15-001 is a calendar constraint on the pilot deploy.** `seed.sql` dates its `'nao'` responses
> `now()-1d`/`now()-4d` while `phase15-indicators` AC-4 counts within the **current calendar month**, so
> the E2E suite **cannot go fully green on the 1st–4th of any month**. Pre-existing (FF-5's gate ran
> Jul 28, when every offset sat inside July), not an FF-4 defect, and QA did not treat it as blocking —
> but it will red the suite if the deploy lands early in a month. Fix is in `supabase/seed.sql`, whose
> date distribution other specs depend on, so it needs its own verification pass rather than a drive-by.

· **S4 ✅ COMPLETE 2026-07-20** — ✅ **ETH·E2** (2026-07-18) + ✅ **Referrals v2 R2–R5** (2026-07-19) + ✅ **CH** Charters (Phase 21, 2026-07-20 — ADR [0080](docs/decisions/0080-committee-charters-cadence-model.md) / [detail](docs/progress/ch-charters-cadence.md)), all → `main`
· ✅ **S5 ETH·E3a COMPLETE 2026-07-27** — terminology/UX + auto-derived procedural timeline + ethics dashboard (E3b still needs Phase 16) → [eth-e3a-surfacing.md](docs/progress/eth-e3a-surfacing.md)
· 🔵 **Phase 16 — Standards Crosswalk & Readiness/Gap Engine v2 — IN PROGRESS** (branch `phase-16-standards-crosswalk`, started 2026-08-03). Authority: ADR [0093](docs/decisions/0093-phase-16-standards-crosswalk-replan.md) (D1–D10 + **Amendments 1–2**) · plan: [phase-16-standards-crosswalk-program.md](docs/plans/phase-16-standards-crosswalk-program.md) (migrations A–G, pgTAP 278–284, 5 E2E specs). Pre-pilot; **re-gates the pilot deploy**; folds ETH·E3b.
  · ✅ **Wave 0 COMPLETE** — accreditation-track §16 rewritten against 0093; contract landed (`de2404c`, `src/lib/accreditation/types.ts` + `src/lib/queries/accreditation.ts`, typecheck+lint clean) so **frontend is unblocked**; BUG-AUTHZ-002 filed (below, out of scope); build-start facts verified against the live catalog.
  · ⚠ **Wave 0 found three plan assumptions WRONG** (recorded as ADR 0093 Amendment 2): SQLSTATE base is **`HC0Q9`**, not HC0Q7 — live high-water is `HC0Q8` because FF-4 took Q6–Q8 while ADR 0092's prose claimed only Q6, and `docs/backend-state.md` was stale in **two** places (both now corrected); `action_items` has **no status CHECK** (tenant-extensible `action_item_statuses` — the freshness arm must join `category`); `controlled_documents` carries a fifth status **`changes_requested`** D5 never contemplated. Also: `indicator_measurements.status` stores **English**, and `app.feature_flags.enabled` defaults **true** (seeding OFF needs an explicit `false`).
  · ✅ **PO ruling 2026-08-03 — `changes_requested` → `vencida`** (not `atencao`): an approver explicitly refused the document, so as evidence it is absent proof, not weak proof; `atencao` stays reserved for `in_approval`. Recorded as ADR 0093 **A2·3**; unblocks Migration B.
  · 🟡 **Remaining PO blocker** — ONA skeleton CSV validation at Wave 1 end (blocks **Migration F only**; nothing else waits on it).
  · ✅ **Wave 1 part 1 — Migration A** (`8700e66`, `20260903000800_accreditation_schema.sql`): 5 tables + RLS + audit triggers, flag seeded OFF. pgTAP **278** = 84 assertions; full suite **4393/4393** on a fresh reset; types regenerated, typecheck/lint clean; registered==files 244/244. **Lead-verified against the live catalog** (not the report): flag `enabled=false`, `relrowsecurity=true` ×5, all five policies `cmd=SELECT` (no `FOR ALL` write leak), framework predicate is the narrowed PO-ruling-2 form with standards inheriting via `EXISTS` (cloned licensed text stays commission-scoped), DB 10-kind CHECK == `ArtifactKind` with no drift, zero write grants to `authenticated`.
  · 📒 **SQLSTATE ledger note** — the `standard_ownerships` hospital-mismatch *guard trigger* raises plain `check_violation` (23514), not a curated code, matching the `guard_membership_hospital_org` precedent (schema backstop generic; RPC pre-validates and raises the curated pt-BR message first). **`HC0QC` therefore stays free** for `set_standard_ownership`.
  · ✅ **Wave 1 part 2 — Migration B** (`1ab2bbe`, `20260903000900_accreditation_dispatch.sql`): `app.artifact_belongs_to_commission` + `app.evidence_status_of`. pgTAP **279** = 57 assertions (kind list read from the `evidence_links` CHECK **at run time**, so a future kind added without an arm reds on its own); suite **4450/4450** fresh; 245==245. **5 keystones mutation-proven** — K4 (cross-hospital CAPA) and K5 (`changes_requested`) each red **exactly 1 of 57**, i.e. the file is precise, not merely sensitive. Lead-verified: both `prosecdef=t`, `ELSE raise` in both, 8 `coalesce(…, false)` fail-closed wraps.
  · 🪤 **Fail-open trap caught at design time, not review**: `v_owner = p_commission` on a not-found artifact yields SQL `NULL`, and plpgsql treats `if not (null)` as falsy — silently skipping a caller's guard. Every column-lookup arm now wraps in `coalesce(…, false)`. Same family as the standing `jsonb_typeof(x->'missing')` trap.
  · ✅ **PO rulings 2026-08-03 (ADR 0093 Amendment 3)** — D5 named the lifecycle values for `meeting`/`capa_plan` but never assigned them to buckets; backend surfaced the gap instead of quietly picking. **A3·1 `capa_plan`: `open` → `atencao`, split from `cancelled` → `vencida`** (an open CAPA is a tracked live commitment, not an abandoned one; collapsing them under-reports a functioning quality system). **A3·2 `meeting`: `held`/`in_signature` → `atencao`** — *signature is the evidentiary act*; the lenient `held` → valida reading was rejected. Correction migration in flight.
  · 📐 **Design fact for the record** — the indicator arm's "current frequency window" is a **new concept**: `indicator_kpis` (Phase 15) takes the latest measurement regardless of age. Implemented as `current_date − 1/2/3/6/12 months` per `mensal…anual` on `coalesce(period_start, entered_at::date)`. Mirrors no existing helper; D5's "a link is a claim, not proof" is its only authority.
  · ✅ **Wave 1 CLOSED** — capa_plan correction (`1f006d2`, `20260903001000`); ONA + JCI skeleton drafts (`6b7af0d`) delivered to the PO. **A3·3 correction in flight** (`action_item` `open`+`blocked` → `atencao`), with an assertion encoding the A3·1/A3·3 *consistency itself* so a future divergence reds rather than passing quietly.
  · 🔴 **ONA CSV — NOT validatable as drafted; it needs authoring, not correction.** Asked the two structural questions directly, backend answered **"I don't know" to both**, explicitly and correctly rather than reasoning toward something plausible: (a) whether a real ONA manual assigns **distinct codes** to per-level criteria at all, or expresses level as a *facet within* one numbered requirement — the `1.1-N1` codes are a **schema-driven convention it invented** to satisfy `unique(framework_id, code)`, not a mirror of ONA citation practice; (b) whether every subsection genuinely carries all three levels, or some exist only at Nível 1 (or only at 3). Backend's own assessment: **treat the section/leaf text as filler for the PO to overwrite wholesale, not a base to lightly edit.** Migration F stays parked; **nothing else in the phase waits on it**.
  · ⚠ **ONA CSV — the shape, for the record.** The 99 rows are 3 seções + 24 subseções + 72 "leaf standards", but the leaves are **mechanical**: every subsection gets `<title> — Nível 1/2/3`. That encodes "each subsection has criteria at three levels" and nothing more — it is **not** 72 distinct standards. The hierarchy is real work; the leaf rows are a placeholder. Backend was asked to state plainly whether real ONA assigns **distinct codes** to per-level criteria at all, and whether every subsection genuinely carries all three levels — with explicit licence to answer "I don't know" rather than reason toward something plausible. The JCI draft is honest by construction (14 chapters, no invented sub-standard numbering, `nivel` empty).
  · ✅ **A3·3 landed** (`8383edd`, `20260903001100`): pgTAP 279 → **61 assertions**, suite **4454/4454**, 247==247. Includes **C23c**, asserting `open` reports the *same* bucket for `action_item` and `capa_plan` — the ruling encoded executably rather than as prose. K7 mutation-proved (`blocked`→vencida reds exactly C20a; C23c correctly stays green, confirming the two assertions test different things). ⚠ Backend's first mutation attempt via `sed` line-surgery produced a malformed CASE that **raised** on `blocked` instead of misclassifying it — it discarded that and wrote the mutation out in full. A mutation that raises proves nothing about the bucket; **a mutation must fail the way the real defect would.**
  · ✅ **Waves 2 + 3 COMPLETE** (build side). Backend: flag helper · C (framework CRUD/clone) · D (evidence/assessment/candidates) · **E (the three read doors)** · the BUG-P16-001 and BUG-P16-002 fixes. Frontend: rollups (+22 Vitest) · messages · actions · 9 components · 5 routes · evidence picker · Recharts readiness dashboard · hospital surface · nav. Suite **4575/4575** on a fresh reset, 252==252, lint/typecheck/`next build` green.
  · 🏆 **The phase's headline result — the BUG-AUTHZ-001 lesson actually landed.** All four new DEFINERs (`readiness_report`, `readiness_evidence`, `hospital_readiness`, `evidence_candidates`) contain **`is_admin` nowhere in their source at all** — not in a gate, not in a comment (lead-verified via `pg_proc`), and carry no `PUBLIC` in their ACLs. `hospital_readiness` is gated `is_hospital_admin_of OR is_org_admin_of(org_of_hospital)` exactly per D6. **They were cloned from `hospital_document_register`, which still carries the defective `is_admin()` arm as BUG-AUTHZ-002 — the clone deliberately does not.** Copying a precedent's shape without copying its defect is the whole point of D6.
  · 🔬 **platform_admin zero-rows, mutation-proven per door, caught TWICE each.** For each of the three doors, backend reintroduced `or app.is_admin()` — the literal BUG-AUTHZ-001 defect, not an unrelated break — and confirmed **both** a behavioural assertion (calling the door as platform_admin) **and** a structural `pg_proc` census went red simultaneously: `readiness_report` → A1+E1 · `readiness_evidence` → A2+E2 · `hospital_readiness` → A1+G1. The structural regex was **cross-validated against the known BUG-AUTHZ-002 shape in `hospital_document_register` to prove it is not vacuous** — a census that matches nothing passes everywhere.
  · 🚪 **Door-audit floor found a never-called door of our own**: `delete_standard` was "covered" by pgTAP 280 only via a **flag-off negative, which raises *before* reaching the authorization body** — so it never exercised the door. A real successful delete was added (D5/D6) and it now passes the floor. ⚠ **Coverage that raises early is not coverage.** 13 unrelated pre-existing never-called doors remain (ethics vocabulary, case-assignment roles, referral actions) — a real gap in the ADR 0079 standing invariant that **predates this phase**; filed separately, not fixed here.
  · 📋 **As-built inventory (lead-verified, working tree clean):** **9 migrations** `20260903000800`→`001600` · **6 pgTAP files — 278, 279, 280, 281, 283, 284.** ⚠ **There is no `282`**; its planned scope (freshness matrix cell-by-cell) was **absorbed into 279** (61 assertions, C1…C30 — all 10 kinds, both `review_due_date = current_date` boundaries, the frequency-window cutoff, every Amendment 1–3 ruling). Nothing lost, but **"pgTAP 278–284" is not a valid coverage claim** — a range naming a file that does not exist is the same failure family as a gate summary whose denominator hides unrun tests. Plan corrected.
  · 📌 **Coverage gap flagged for QA (not a defect):** the indicator freshness arm maps five frequencies to intervals (`mensal|bimestral|trimestral|semestral|anual` → 1/2/3/6/12 months) but only **`mensal`** is asserted. An *unrecognized* frequency raises (fails closed); a **wrong interval** — `semestral` → 5 months — would pass silently. Four more cells closes it.
  · ✅ **Tester COMPLETE — 5 E2E specs, 31/31 GREEN** (`e2e/phase16-accreditation-{core,freshness,hospital,restricted,clone}.spec.ts` + shared `e2e/helpers/accreditation.ts`). Harness proved it could fail FIRST (AC-0: flag OFF → the commission `not-found.tsx` boundary renders; flag ON → real content — both asserted live before anything else was trusted, per BUG-P16-002's lesson). Found, precisely diagnosed, and got fixed **two blocking product bugs** (BUG-P16-003, BUG-P16-004 — a Server Component forwarding a closure prop across a Client boundary, crashing the framework list and then every framework/standard page; `frontend` fixed both in `3fc40df`, tester re-verified live + via source read and closed both) and filed one **minor** cosmetic pt-BR pluralization defect (BUG-P16-005 — since PO-ruled + fixed by frontend across `c1f098b`/`aad4877` and re-verified/closed by tester with exact-literal assertions; see below). Migration F was correctly never needed — every spec builds its own framework/standard fixtures (`platform@test.local` for the two GLOBAL packs spec 1/3/5 need; commission-owned for spec 2/4), matching the PO-parked status. Full detail: Bug Log + Test Run Summary above.
  · ✅ **BUG-P16-006 CLOSED (tester, 2026-08-04)** — the full `e2e:prod` gate reds the 31/31 above: 4 indicator ids in `core.spec.ts`/`freshness.spec.ts` were hardcoded UUIDs captured live from a non-reset DB session; `seed.sql`'s CCIH indicator inserts have no explicit `id` column, so `gen_random_uuid()` reassigns them on every `supabase db reset`, exactly what the gate's `RESET=1` does. Fixed via a new `lookupIndicatorId(commissionId, name)` natural-key helper, resolved in each file's `beforeAll`. Full 18-UUID hardcoded-literal classification for all 5 specs + the helper, plus a report-only sweep confirming no other spec in `e2e/` has the same defect shape (the codebase already solves it correctly elsewhere via `docIdByCode()`/direct queries), are in the Bug Log. Verified on **two independent `supabase db reset --local` runs, both 31/31 GREEN** — the reproducibility bar the coordinator set, since a single post-fix pass could still ride leftover state. Committed `test(e2e): resolve seeded rows by natural key, not captured ids (BUG-P16-006)`.
  · ✅ **Tester COMPLETE** (`8991ec6`) — 5 specs + `e2e/helpers/accreditation.ts`, **30/30 green** (`--project=chromium --workers=1`). Flag harness self-tested **in both directions first**: OFF → the commission `not-found.tsx` boundary renders; ON → real content — so no assertion was trusted before the harness was shown able to fail (BUG-P16-002's lesson applied).
  · 🧪 **Non-obvious E2E finding worth carrying beyond this phase — `resp.status()` is NOT a valid 404 signal on any route with a sibling `loading.tsx`.** Next.js commits the HTTP response (**200**) as soon as the loading boundary streams, *before* the async `notFound()` resolves. **Only the resolved DOM proves the gate.** Every `manage/acreditacao/**` route has a `loading.tsx`, and so do many others in this codebase — a flag-gate or access-gate assertion written against the status code will pass against a route that is actually rendering fine. **Move to `docs/testing/` at the Record step** so it outlives this phase's rotation.
  · 📌 **Two ADR/plan claims proved untestable through the UI as written** (both handled, neither blocking, both flagged for QA): (1) spec 4's "non-ACL member sees *Evidência restrita*" — **no seeded persona is simultaneously staff_admin-of-CCIH (needed to reach the route) and off the seeded ethics case's ACL**, so it is proven by direct RPC (`readiness_evidence` gates on `is_member_of`, not `is_staff_admin_of`) with the ACL member's UI view as the positive control; (2) spec 5's "editing a global pack fails HC0QD" — framework/standard **CRUD has no wired UI this phase**, so it is RPC-only by necessity, not by shortcut. *A seed roster that cannot express a required negative is a real gap — worth a persona in a future seed revision.*
  · ✅ **BUG-P16-005 CLOSED (minor, pt-BR)** — readiness dashboard rendered "padrãoes"; the sweep for the same string-concatenation pattern also caught a real sibling in `evidence-count-badge.tsx` ("em atenção" → "em atençãos"). The judgement call this left open (whether `conforme{s}` should agree with `padrões` or the count) got a PO ruling: key the noun on `totalStandards`, the verb+adjective on `cleanStandards` (`aad4877`). Tester's deliberately tolerant regex — correct while the wording was open, since it would not encode the wrong spelling — has now been **replaced with the exact PO-ruled literal string** in both cases (`core.spec.ts` AC-1); a loose matcher can't red a regression once the wording is settled. The `evidence-count-badge.tsx` sibling then got its OWN dedicated coverage too (`freshness.spec.ts` `AC-3-plural`, `8bdefe0`) — a real "fixed but unguarded" hole `tester`'s own report had surfaced, closed rather than left for QA. Re-verified 15/15 → 9/9, then **31/31** (all five).
  · ✅ **QA APPROVED 2026-08-04** (0 BLOCKER / 0 MAJOR / 2 MINOR / 1 INFO) → [review](docs/reviews/phase-16-review.md). Re-derived from the live catalog independently (not accepted on report): the noun rule on all 4 new DEFINERs (no `is_admin()`, no `PUBLIC`/`anon` ACL); **3 live mutation tests of my own** (`readiness_report`'s platform_admin zero-rows, `link_evidence`'s `can_read_case` gate, `hospital_readiness`'s worst-wins total order) — each reds precisely on revert, restored byte-identical after. D8 masking/counts-only confirmed from SELECT lists in `prosrc`, not TSX. Arm parity (10/10, both dispatch fns, runtime-derived kind list) confirmed. `prosecdef` census clean on all 5 tables + all new functions. MINOR: the indicator-frequency test-coverage gap (only `mensal` asserted) is real, code is correct as read; the pgTAP runs this review relied on were **not** against a fresh reset (flag-state noise only, no substantive failures) — recommend a fresh-reset `test:db` + full `e2e:prod` before Record. INFO: a shared pt-BR irregular-pluralization helper, given the `-ão→-ões` class hit twice in one phase. BUG-P16-005 confirmed closed correctly (both files read post-fix). Migration F's deferral and the two RPC-only acceptance claims agreed not to be gate blockers.
  · ▶ **Then** — Migration F (PO-parked), Migration G (flag flip at Record), a fresh-reset `test:db` + full `e2e:prod` (lead-run), Record.
  · 🔧 **Plan ownership correction (lead)** — the plan gave the `feature-flags.ts` flag wiring to **frontend**, but `src/lib/queries/` is **backend-owned** (CLAUDE.md §4, binding). **Reassigned to backend** as its first Wave 2 item; frontend imports the helper and sequences routes last so the gate exists when it gets there.
  · ✅ **Frontend Wave 2 track COMPLETE** — `src/lib/accreditation/rollups.ts` (`computeReadinessRollups`: cumulative ONA level gating incl. the "clean level 2 blocked by a dirty level 1" boundary; per-chapter/overall % for non-leveled frameworks; freshness split never collapsed — structurally asserted) + 22-test Vitest suite, all green; `messages.ts` (HC0Q9–HC0QE pt-BR mapping); `actions.ts` (framework/standard CRUD, evidence link/unlink, assessment — `standard_ownership` deliberately deferred to the Wave 3 hospital surface). Components in `src/components/accreditation/`: framework list + clone dialog, the standards tree (semantic nested `<ul>`, no `role=tree`), the standard panel (assessment form with PHI-discouragement copy on `note_md`, evidence list with valida/atenção/vencida chips + "Evidência restrita" masking + unlink). Routes `manage/acreditacao/**` cloned from `manage/indicadores/` (layout flag+role gate, list page, `[framework]` master-detail shell, `padrao/[standard]` detail) + the `app-sidebar.tsx` nav entry (`requiresFeature: 'accreditation'`). `npm run lint` / `typecheck` / `vitest run` (895 passed) / a REAL `next build` all green, all three new routes registered.
  · ⚠️ **Two things frontend flagged rather than silently working around**: (1) Migration C/D (the RPCs `actions.ts` calls) hadn't landed yet at write time, so `supabase.rpc()` can't typecheck against names the generated `Database` type doesn't have — used a single documented `unknown`-cast adapter (`callRpc` in `actions.ts`, never `any`) so call sites keep real argument/return typing against the ADR/plan's described RPC surface; posted the exact assumed names/params to `backend` for Migration C/D alignment (not guessed silently). (2) **Contract gap**: `ReadinessRow` deliberately carries no `note` field (D8), but there's also no OTHER posted query returning a single standard's `standard_assessments.note_md` for prefill — `StandardDetailPage` currently passes `assessmentNoteMd={null}` always (low-risk: resubmitting just overwrites, nothing is lost, but an existing note won't show/prefill until a read path exists). Flagged to backend/lead, not patched with an invented query.
  · 🔴 **BUG-P16-001 — data loss, filed by the lead, fixed both sides.** Frontend's own grading of the note-prefill gap above ("low-risk... resubmitting just overwrites it") restated the harm instead of mitigating it — caught and filed: write a note → change status → save → the note silently vanishes. Backend fixed the RPC (`set_standard_assessment`'s `coalesce(p_note_md, note_md)` now treats `''` as an explicit clear, `NULL`/omitted as leave-alone); frontend fixed the action layer (`914c9a3`→`1d356fe`: added `optionalClearableText`, used ONLY by `setStandardAssessment`'s `noteMd` — every other `optionalString` call site in `actions.ts` unchanged). Prefill itself still waits on Migration E.
  · ✅ **Frontend Wave 2 RPC alignment closed** (`1d356fe`) — Migration C/D landed + `gen:types` regenerated mid-Wave-2; the temporary `callRpc` unknown-cast adapter is gone, every action now calls `supabase.rpc(...)` directly, typed against the real generated signatures. Backend independently confirmed all 4 renamed params (`update_framework: p_id→p_framework`, `delete_standard: p_id→p_standard`, `link_evidence: p_artifact_kind/p_artifact_id→p_kind/p_artifact`, `unlink_evidence: p_id→p_link`) plus the 5 unchanged ones matched their final signatures exactly.
  · ✅ **Frontend Wave 3 track COMPLETE** (`eacb72b`/`f14431d`/`56dce35`) — evidence picker (`evidence-picker.tsx`: kind selector + a low-cardinality `<select>` fallback or a debounced ARIA combobox+listbox adapted from `reference-picker.tsx`, feeding a new `searchEvidenceCandidates` action that routes straight to the `evidence_candidates` RPC since `queries/accreditation.ts`'s sibling is still backend's stub); readiness dashboard (`readiness-chart.tsx`/`-loader.tsx`/`readiness-dashboard.tsx`, a Recharts island per `run-chart-loader.tsx`'s dynamic-import pattern, pure presentation over `computeReadinessRollups()` — now `[framework]/page.tsx`'s landing view); hospital surface (`/o/[org]/manage/acreditacao/page.tsx` + `hospital-readiness-register.tsx` + `ownership-editor.tsx`, cloned from `manage/documentos/`, counts-only — `HospitalReadinessRow` carries no `note` field to leak) + the **visible** `org-manage-sidebar.tsx` entry (Amendment 1 A1·3). `lint`/`typecheck`/`vitest` (895 passed)/a real `next build` all green throughout, including after a transient false alarm (a torn read of `database.ts` mid-`gen:types` from backend's concurrent Migration E work — cleared on re-run, not a regression).
  · ⚠️ **Contract gap (Wave 3)**: no posted query lists global frameworks without a commission context, but the hospital surface's framework picker needs exactly that. Worked around in `manage/acreditacao/page.tsx` by seeding `listFrameworks` with the org's first commission (global rows are identical regardless of which commission id is passed — verified against the RLS predicate) and filtering to `ownerCommissionId === null`; correct today, a dedicated `listGlobalFrameworks()` would remove the indirection. Flagged, not silently patched.
  · 🟡 **Still open, not started this turn**: the assessment-note prefill (waits on Migration E's single-standard read path — `getStandardAssessment` or a `note`-carrying arm).
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

✅ **BUG-P16-006 — CLOSED 2026-08-04, tester-verified (fix + two independent fresh-reset re-runs).**
Root cause: `phase16-accreditation-core.spec.ts` and `phase16-accreditation-freshness.spec.ts` each
hardcoded 2 indicator ids (`INDICATOR_AC1`/`INDICATOR_AC5`; `INDICATOR_ATENCAO`/`INDICATOR_VENCIDA`) as
literal UUIDs captured live from a running DB. Unlike orgs/hospitals/commissions/personas/the demo
form/the ethics case (all seeded with an explicit fixed `id` literal — individually confirmed by
reading their actual `insert`/`v_* uuid :=` statements in `supabase/seed.sql`, not merely grepped),
`seed.sql`'s CCIH indicator block (`insert into public.indicators (...) values (...) returning id into
v_ind_*;`) has NO explicit `id` column, so `gen_random_uuid()` assigns a fresh id on every
`supabase db reset` — the captured literals were only ever valid against the exact DB session they were
read from, and went stale on the very next reset, which is exactly what `npm run e2e:prod`'s `RESET=1`
does every run. The prior 31/31 report was green against the SAME session the ids had been captured
from; nothing in that workflow was positioned to observe the instability.

**Fix:** added `lookupIndicatorId(commissionId, name)` to `e2e/helpers/accreditation.ts` — a thin
wrapper on the existing `sqlOne`, which already fails loudly (quoting the query) on 0 or >1 rows, so a
lookup miss surfaces as a clear fixture error, never a downstream FK violation on whatever insert
consumes the id next. Both spec files now declare the 4 constants as module-level `let`s and resolve
them by NATURAL KEY (`commission_id` + exact seeded `name`) inside `beforeAll`, before first use —
never a hardcoded literal.

**Full sweep, every hardcoded UUID in scope (18 distinct literals across the 5 specs + the helper):**
the 4 indicator ids were the ONLY unstable ones. The other 14 — `ORG_A_ID`, `ORG_B_ID`,
`HOSPITAL_CENTRAL_A`, `HOSPITAL_SECUNDARIO_A2`, `COMMISSION_CCIH`, `COMMISSION_FARMACIA`,
`COMMISSION_ETICA`, `COMMISSION_QUALIDADE_B`, `ETHICS_CASE_ID`, `UID_PLATFORM`, `UID_CHEFE_CCIH`,
`UID_CHEFE_FARM`, `UID_HOSPITALADMIN_A1`, `CCIH_FORM_HIGIENE.id` — were each individually confirmed
safe by reading their actual seed.sql insert/assignment statement (not a grep occurrence count alone),
all `insert into ... (id, ...) values ('<literal>', ...)` or `v_* uuid := '<literal>';` later consumed
as an explicit id. Also swept the wider `e2e/` suite for the same defect shape (report-only, out of
scope to fix): every other seed.sql table seeded via an auto-generated id (`rca_root_causes`; two
`controlled_documents`/`controlled_document_versions` pairs, `DOC-0001`/`DOC-0002`) is ALREADY resolved
by other specs via a live natural-key lookup — `docIdByCode()` in `e2e/helpers/documents.ts`, and a
direct `rca_id`-keyed query in `phase14d-capa.spec.ts` — so no other spec hardcodes an unstable
captured id; Phase 16's 4 indicators were the only instance of this defect, not a systemic pattern.

**Verification (two independent fresh resets, per the coordinator's bar — "a pass on the current DB
proves nothing"):** `supabase db reset --local` → all 5 specs **31/31 GREEN**; reset a second time
(confirmed live: all 4 indicator ids resolved to entirely new values, matching neither the removed
literals nor each other across the two resets) → all 5 specs **31/31 GREEN** again.

Committed `test(e2e): resolve seeded rows by natural key, not captured ids (BUG-P16-006)`.

<details><summary>BUG-P16-006 original report (kept for the record)</summary>

**Repro:** run the full `npm run e2e:prod` gate (resets the DB before running).
`phase16-accreditation-core.spec.ts:124`'s `INDICATOR_AC1 = '6f4e4aa5-df6f-455a-a550-038453a45394'` — a
UUID captured live from the DB as it stood during the tester's authoring session — does not exist in a
freshly-reset DB. Reproducible across two independent runs, including one against a verified-healthy
stack, confirming a real fixture defect, not environment flakiness.

</details>

✅ **BUG-P16-005 — CLOSED 2026-08-04, tester-verified (fix + exact-string re-run + source read).** Landed in two commits: `c1f098b` fixed the noun (`padrão`/`padrões`, literal ternary) and swept for the same string-concatenation pattern, catching a real sibling in `evidence-count-badge.tsx` (`"em atenção"` → `"em atençãos"` whenever an `atencao`-status count exceeded 1 — same irregular `-ão`→`-ões` class, also fixed to literal singular/plural pairs). The PO then ruled on a judgment call `c1f098b` had explicitly left open (verb-vs-noun agreement): `aad4877` keys the noun on `totalStandards` and the verb+adjective on `cleanStandards` — `"{clean} de {total} {padrão|padrões} {está conforme|estão conformes} (não cumulativo)"`.

`tester`'s own `/padr\S+/`-tolerant regexes (deliberate while the wording was open, so the spec would not encode the wrong spelling) were **replaced with exact-literal assertions** citing the PO ruling — `phase16-accreditation-core.spec.ts` AC-1, both the `1 de 2` and `0 de 0` cases — since a tolerant matcher can't red a regression once the correct wording is settled. Swept all 5 specs for any OTHER assertion loosened around this bug or its `evidence-count-badge.tsx` sibling: none found (no spec fixture ever produced an `atencao` count > 1 on the aggregate badge, so no assertion was ever positioned to observe that half of the bug either). Re-verified: `core.spec.ts` + `freshness.spec.ts` 15/15, all 5 specs combined 30/30, `--project=chromium --workers=1`.

⚠ **That last gap was closed as its own follow-up, not left as a permanent caveat** — "fixed but unguarded" for a bug class that shipped twice in one phase is the same shape as the bug itself. `phase16-accreditation-freshness.spec.ts` gained a dedicated `AC-3-plural` test (`8bdefe0`): a new standard with TWO `atencao`-status evidence links (INDICATOR_ATENCAO's existing measurement relinked to a second standard + a new `held` meeting) drives the aggregate badge's `atencao` bucket to 2, and the test asserts the exact literal `"2 evidências — 2 em atenções"` (read from the live `evidence-count-badge.tsx` source, not retyped from memory) **and** that the old buggy spelling (`"atençãos"`) is explicitly absent — so it would genuinely have failed pre-fix, not passed vacuously. Re-verified: `freshness.spec.ts` 9/9, all 5 specs combined **31/31**.

<details><summary>BUG-P16-005 original report (kept for the record)</summary>

**Repro:** view any ONA (leveled) framework's readiness dashboard where a level has `totalStandards !== 1`. Observed live (`level1Card.innerText()`, `totalStandards: 2`): `"1 de 2 padrãoes conforme (não cumulativo)"`.

**Root cause:** `src/components/accreditation/readiness-dashboard.tsx`'s `LevelCard` built the plural by concatenation — `padrão{level.totalStandards === 1 ? "" : "es"}` — which produced `"padrão" + "es" = "padrãoes"`. Portuguese `-ão` nouns pluralize irregularly (three patterns: `-ões`/`-ães`/`-ãos`); "padrão" → **"padrões"**, never "+es". Contrast `hospital-readiness-register.tsx`, which got this right nearby: `{rows.length === 1 ? "padrão" : "padrões"}` — a literal, not a suffix concatenation.

</details>

✅ **BUG-P16-004 — CLOSED 2026-08-03, tester-verified (fix + re-run + source read).** Fixed exactly along the lines flagged: `[framework]/layout.tsx` now passes `org`/`commission`/`frameworkId` (plain strings) to `<StandardsTree>` instead of the `standardHref` closure; `standards-tree.tsx` resolves its own hrefs client-side via the pure `commissionHref` helper (confirmed both files now carry an explicit `BUG-P16-003 (fixed)` comment documenting the shape). Re-verified live: `phase16-accreditation-core.spec.ts` AC-1/AC-3b/AC-5, `-freshness.spec.ts`'s four `-ui` tests, and `-restricted.spec.ts` AC-3b (every test that navigates a `[framework]/**` route) now reach real rendered content — none hit the crash. Two of those re-runs then failed on genuinely NEW, unrelated issues (a tester locator ambiguity in AC-1, a keyboard-race in AC-5's combobox selection) — both are test-authoring bugs on `tester`'s own side, not product defects, and are being fixed there, not here.

<details><summary>BUG-P16-004 original report (kept for the record)</summary>

**This was the more severe of the two.** `src/app/o/[org]/c/[commission]/manage/acreditacao/[framework]/layout.tsx:60` passed an inline closure `standardHref={(standardId) => commissionHref(...)}` straight into `<StandardsTree standardHref={standardHref} .../>` — and `standards-tree.tsx:1` is `"use client"`. Since `FrameworkLayout` wraps the framework overview page AND every `padrao/[standard]` detail page (the sidebar tree renders on both), **this crashed the entire commission-side Accreditação surface below the bare list** — not an edge case gated behind "a global framework exists," it fired on the very first framework a coordinator opened, always. Confirmed live (dev server log, same error shape as BUG-P16-003):
```
⨯ Error: Functions cannot be passed directly to Client Components unless you explicitly expose it by
marking it with "use server". Or maybe you meant to call this function rather than return it.
  <... nodes={[...]} readinessByStandardId=... standardHref={function standardHref}>
                                                            ^^^^^^^^^^^^^^^^^^^^^^^
```
Reproduced both server-side and in the browser console, at `/o/rede-a/c/ccih/manage/acreditacao/{frameworkId}`.

**Swept the rest of the route tree for the identical shape** (every inline `Href={(...) => ...}` prop passed FROM an `src/app/**/acreditacao/**` route file): exactly 3 existed. `manage/acreditacao/page.tsx:49` (→ `FrameworkList`, Server→Client — BUG-P16-003) and this one were broken; `[framework]/page.tsx:38` (→ `ReadinessDashboard`) was SAFE — `ReadinessDashboard` has no `"use client"`, stays a Server Component, and only ever CALLS the closure server-side to produce a plain string for a bare `<Link href=...>` (`GapListSection`, same file) — the function itself never crosses a client boundary there. That safe example turned out to be the model the fix followed.

**Test impact while open**: blocked most UI-layer assertions across all 5 phase16 specs. `tester` kept exercising and reporting on the RPC/DB-truth layer (unaffected — those calls never touch this render path) while frontend fixed this.

</details>

✅ **BUG-P16-003 — CLOSED 2026-08-03, tester-verified (fix + re-run + source read).** `src/components/accreditation/framework-list.tsx` no longer receives a `frameworkHref` closure — it now takes `org`/`commission` (plain strings) and resolves its own hrefs (both for its `<Link>` and for what it hands `CloneFrameworkDialogTrigger`) via the pure `commissionHref` helper; the file carries an explicit `BUG-P16-003 (fixed)` docblock recording the shape. Re-verified live: a staff_admin viewing a global-framework-bearing list (`/o/rede-a/c/ccih/manage/acreditacao`) now renders the real "Acreditação" heading, no crash. Same root cause and same fix shape as BUG-P16-004 (below) — filed and closed together.

<details><summary>BUG-P16-003 original report (kept for the record)</summary>

**Severity: blocking.** This was the route's unconditional happy path, not an edge case — the layout already restricts the whole `manage/acreditacao` area to `staff_admin` (`AcreditacaoLayout`'s `access.role !== "staff_admin"` → `notFound()`), so `AcreditacaoPage` always called `<FrameworkList canManage={true} .../>` for anyone who reached it. Once Migration F seeds the ONA/JCI global packs, this would have fired for **every** staff_admin, every time, everywhere — it only needed one commission-visible global framework to exist, which a single `create_framework(ownerCommission: null)` call produces.

**Repro:** sign in as `chefe.ccih@test.local` (staff_admin, CCIH), ensure at least one GLOBAL framework exists (`owner_commission_id is null`), navigate to `/o/rede-a/c/ccih/manage/acreditacao` with the `accreditation` flag ON.

**Actual (before the fix):** the route crashed to `manage/acreditacao/error.tsx`:
```
⨯ Error: Functions cannot be passed directly to Client Components unless you explicitly expose it by
marking it with "use server". Or maybe you meant to call this function rather than return it.
  <... frameworkId=... frameworkName=... commissionId=... frameworkHref={function frameworkHref}>
                                                                        ^^^^^^^^^^^^^^^^^^^^^^^^
```
Reproduced in the browser console too (`(src/app/o/[org]/c/[commission]/manage/acreditacao/error.tsx:16:13)`), not a server-only artifact.

**Root cause, traced to the exact line:** `framework-list.tsx` (Server Component, no `"use client"`) forwarded its `frameworkHref` closure prop verbatim at line 71 into `<CloneFrameworkDialogTrigger frameworkHref={frameworkHref} .../>`, and `clone-framework-dialog.tsx` is `"use client"` — a plain (non-Server-Action) function cannot cross that boundary. Same bug CLASS as the earlier BUG-QI-001 ("Server fn prop → client = RSC crash").

</details>

✅ **BUG-P16-002 — CLOSED 2026-08-03** (`93a3bf8`). All 7 implemented + `listGlobalFrameworks()` added; lead-verified **0** occurrences of `not implemented` remain. Backend **verified by executing, not compiling**: a standalone probe signed in as real seeded personas (`chefe.ccih`, `hospitaladmin.a1`), flipped the flag **at runtime only** (never committed), seeded a throwaway fixture and called every operation for real — all 9 probes PASS, including `getHospitalReadiness(foreign) → [] not throw`. ⚠ **The probe immediately earned its keep**: `gen:types` had not been re-run after Migration E, so the three new doors weren't in the RPC union and `tsc` failed outright — *another* green-bar-over-dead-code instance, caught only because someone executed the code. **This is the lesson to keep: for a flag-gated phase, "it compiles" and "it works" are unrelated claims.**

<details><summary>BUG-P16-002 original report (kept for the lesson)</summary>

🔴 **Every Phase 16 screen dead on arrival: all 7 query-layer functions `throw new Error('not implemented')`.** Filed 2026-08-03 (lead), **P0.** `src/lib/queries/accreditation.ts` was committed in Wave 0 as the *contract* (`de2404c`) with throwing bodies, and **its implementation was never scheduled** — Wave 2's backend brief covered migrations and RPCs only. Meanwhile all five routes wired themselves to it:
`manage/acreditacao/page.tsx` → `listFrameworks` · `[framework]/layout.tsx` → `getStandardTree` + `listFrameworks` + `getReadinessReport` · `[framework]/page.tsx` → `getStandardTree` + `getReadinessReport` · `[framework]/padrao/[standard]/page.tsx` → `getReadinessEvidence` + `getReadinessReport` + `listStandards` · `o/[org]/manage/acreditacao/page.tsx` → `listFrameworks` + `getHospitalReadiness`. **Every one throws.**
**This is not a frontend defect** — `src/lib/queries/` is backend-owned (CLAUDE.md §4) and frontend correctly refused to touch it, routing `searchEvidenceCandidates` around it instead and saying so. **It is a lead coordination gap**: "commit the contract" was scheduled, "implement the contract" never was.
⚠ **It survived the entire green bar** — lint (0 warnings + css-vars), typecheck, 895 Vitest, and a real `next build`, all green — because the routes gate on `accreditation` which is seeded **OFF**, so they `notFound()` before ever reaching a query. **The bug is invisible until Migration G flips the flag at the Record step, at which point every screen 500s.** This is the standing [green-bar-misses-the-wired-seam](docs/progress/bug-log-archive.md) pattern exactly — FF-1 shipped three live bugs past lint+tsc+build+457 unit+3919 pgTAP, one of them *actions still throwing `not implemented`*, and only E2E caught it. **Corollary: a flag-gated phase cannot be declared green by a build. The tester must run with the flag ON.**
**Fix:** backend implements all 7 against the now-live RPCs, typed off `src/lib/accreditation/types.ts`. Then frontend's prefill (BUG-P16-001) can land.

</details>

✅ **BUG-P16-001 — CLOSED 2026-08-03, lead-verified on all three ends.** Door `public.get_standard_assessment(p_commission, p_standard)` is `prosecdef=t`, gated `app.is_member_of` with empty-deny, **no `is_admin()` arm**, no `PUBLIC` in its ACL. `optionalClearableText` returns `''` for present-but-empty and `undefined` only for absent, so an intentional clear now reaches the RPC. `StandardDetailPage` passes `assessmentDetail?.noteMd`, not `null`. **Both round-trips asserted in pgTAP 281** — **C7b** (status-only re-save preserves the note), **C11** (explicit `''` clears it), plus **C10** (explicit non-null overwrites) as a positive control. ⚠ Either assertion alone passes in a broken world; **the pair is what pins it** — that is the durable lesson from this bug's two-stage failure.
📌 **Follow-up (not a defect — Rule 9 hygiene):** `getStandardAssessmentDetail` and `searchEvidenceCandidates` are **reads living in `src/lib/accreditation/actions.ts`**, because `queries/accreditation.ts` was still throwing when frontend needed them (BUG-P16-002). Once backend's query layer is real, route both through `src/lib/queries/` per Architecture Rule 9. Frontend must not move them unilaterally — `queries/` is backend-owned.

<details><summary>BUG-P16-001 — original report, kept for the lesson</summary>

🔴 **Saving a standard assessment SILENTLY DESTROYED the existing `note_md`.** Filed 2026-08-03 (lead), Phase 16 Wave 2. Traced end to end against the live catalog and the committed code, not inferred:
1. `StandardDetailPage` passes `assessmentNoteMd={null}` — there is **no read path** returning `standard_assessments.note_md` for a single standard (`ReadinessRow` deliberately carries no note per D8, and `getReadinessEvidence` returns evidence links, not the assessment).
2. So the textarea renders **empty** even when a note exists.
3. `setStandardAssessment` reads `optionalString(formData,'noteMd')` → `null`, and passes `p_note_md: null` unconditionally.
4. `public.set_standard_assessment` upserts `on conflict … do update set note_md = excluded.note_md` — **unconditional**.

**Repro (ordinary flow, no edge case):** write a justification note on a standard → later reopen it to change the status `parcial` → `conforme` → submit. **The note is gone.** ⚠ Frontend flagged the gap honestly but graded it "Low-risk (the note is never lost — resubmitting just overwrites it)" — those are *the same thing*; overwriting IS losing it. The self-contradiction is the tell, and it is why the fix was scheduled as polish rather than as a defect.
**Fix — all three halves, in the order they were found:**
- ✅ **RPC half** (`20260903001400`, `ee2e52b`): `note_md = coalesce(excluded.note_md, standard_assessments.note_md)` — NULL leaves the note untouched, a real value (**including `''`**) overwrites. pgTAP C7b, mutation-proven (K9). Backend did this **against the lead's explicit "no coalesce" instruction and was right to** — it was a defect in code it shipped that same turn, and clearing survives at the SQL layer via `''`. A teammate overriding a wrong instruction, and saying so, is the behaviour to keep.
- ✅ **Action half** (`83e3155`): the partial fix had opened a **silent no-op** — `optionalString` (`actions.ts:107`) is `return value || undefined`, so an emptied textarea yielded `undefined`, never `''`, and the coalesce then silently restored the old note. Fixed with `optionalClearableText`, scoped to `setStandardAssessment`'s `noteMd` alone after checking every other `optionalString` call site (`version`, `description`, `descriptionMd`, `parentId`, `note` — none needed the distinction).
- ✅ **Read path** (`3ece65f` + `83e3155`): `public.get_standard_assessment` → `getStandardAssessmentDetail` → `StandardDetailPage`. The textarea prefills; the read-only view stops claiming "Nenhuma observação registrada" when a note exists.
⚠ **The standing lesson: a fix that removes a symptom can hide the defect it was masking.** With the coalesce in, the missing read path no longer destroyed data — so the pressure to build it dropped to zero, and the new "cannot clear" bug was invisible to everything except a test that explicitly clears. **Hence both round-trips are asserted, not one:** C7b (status-only save → note SURVIVES) and C11 (explicit `''` → note is GONE). **Either one alone passes in a broken world.** Relates to ADR 0093 D8.

</details>

🔴 **BUG-P16-006 — the Phase 16 E2E suite was NEVER reproducible on a fresh database.** Filed 2026-08-04 (lead), **gate-blocking**. `phase16-accreditation-core.spec.ts:124` hardcodes `INDICATOR_AC1 = '6f4e4aa5-df6f-455a-a550-038453a45394'`, commented "Adesão à higienização das mãos". **That UUID does not exist and never did** — `grep 6f4e4aa5 supabase/seed.sql` returns **0**; the live row of that name is `4f1e8313-9cb2-4f88-91a1-18241ab491c1`. Cause: `seed.sql:1896` inserts indicators **with no explicit id** (`returning id into v_ind_manual`), so **every `supabase db reset` mints new ids**. A live id was captured mid-session and hardcoded as though it were a seed constant.
Surfaces as `indicator_measurements_indicator_id_fkey` violated at `helpers/accreditation.ts:121`, killing core AC-0 and freshness AC-1.
⚠ **The tester's 31/31 was green against the DB state that already contained the captured id.** Nothing in the authoring workflow was positioned to catch this — **only the gate's `RESET=1` was.** Reproduced across **two independent gate runs**, the second on a stack verified healthy by a real token POST, so it is not infra.
⚠ **Lead self-correction:** the first gate run's two failures were reported here as "almost certainly infra casualties" of the auth 502. **That was wrong.** The 502 was real and did cause the 100 unrun + 32 infra results, but *these two* were this defect throughout. The re-run is what separated them — **a plausible infra explanation for a real failure is the most expensive kind of wrong**, because it retires the symptom without touching the cause.
**Fix:** resolve seeded rows by a **stable natural key** at fixture time (fail loudly if absent), never by a captured id; sweep all 5 specs + the helper classifying every hardcoded UUID as *fixture-created* (keep) vs *seed-captured* (must become a lookup). **Verification requires TWO consecutive fresh-reset runs** — one post-reset pass can still ride leftover state.

🧭 **BUG-P16-003/004 — the AUTHORITATIVE sweep (lead, 2026-08-03). Exactly 2 defects; no third exists.** The tester's sweep was keyed on the `Href={(…) => …}` **shape in route files**; the real property is **"any function-valued prop crossing a server→client boundary"** (an `onSelect`/`formatter`/`render` prop crashes identically and matches no `Href` grep). Re-derived **from the boundary**: classified every component in `src/components/accreditation/` by `"use client"`, then inspected every server→client prop block.
**Client components (8):** `assessment-form` · `clone-framework-dialog` · `evidence-picker` · `ownership-editor` · `readiness-chart-loader` · `readiness-chart` · `standards-tree` · `unlink-evidence-button`.
**Function-valued props reaching one — exactly 2:** `framework-list.tsx:71` → `CloneFrameworkDialogTrigger` (**003**) · `[framework]/layout.tsx:58` → `StandardsTree` (**004**).
**Verified safe** (plain data only): `OwnershipEditor`, `AssessmentForm`, `LinkEvidenceDialogTrigger`, `UnlinkEvidenceButton`, `ReadinessChartLoader`.
✅ **Two independent methods agree** — the tester's shape-keyed sweep and this boundary-derived one both return the same 2. That agreement is the evidence, not either sweep alone.
⚠ **Why `readiness-dashboard.tsx` is the safe model, stated precisely:** not because it "calls the closure first", but because **it is a Server Component** — the closure `[framework]/page.tsx` hands it never crosses a boundary; it resolves hrefs to strings *before* rendering the client `ReadinessChartLoader`. **Resolve to strings on the server side of the boundary.**
⚠ **Third green-bar-over-unreached-code instance this phase.** `tsc` + `lint` + a real `next build` are all green with both crashes live: 003 renders only when a **global** framework exists (none locally; Migration F makes it unconditional) and 004 only below the flag gate. **Red-before-green is mandatory on both** — a fix nobody saw fail is unvouched.

🔴 **BUG-AUTHZ-002 — the BUG-AUTHZ-001 sweep missed two hospital doors (noun-rule violation).**
Filed 2026-08-03 during Phase 16 Wave 0; **NOT in Phase 16 scope** — must not ride a Phase 16
migration. `20260903000700` fixed the five `dashboard_*` DEFINERs but left the identical
`app.is_admin()` OR-arm live in **`public.hospital_document_register`** and
**`public.hospital_indicator_rollup`** — both `prosecdef = t`, both returning commission content
(documents; indicator rollups) that ADR 0078 A35's noun rule forbids platform_admin from reading.
**Verified against the live catalog, not the plan text** — the gate reads literally:
```
if not (app.is_admin()
        or app.is_hospital_admin_of(p_hospital)
        or app.is_org_admin_of(app.org_of_hospital(p_hospital))) then return;
```
So the `is_admin()` arm *is* the gate, not a comment. ⚠ Verified at the **catalog** layer
(gate text + `prosecdef` + return shape); a live platform_admin row-count probe has **not** been
run — do that first when fixing, so the fix has a red-before-green. Fix = own migration dropping
the arm + a `270_authz_dashboard_gate_uniformity.sql`-style **parity** extension asserting
platform_admin gets zero rows from *every* hospital-tier DEFINER, ideally before the pilot deploy.
**The lesson is the sweep's boundary, not the two functions**: `20260903000700` enumerated by
*name prefix* (`dashboard_*`) where the real property is "DEFINER door returning commission
content" — the standing "if your enumeration's boundary is a filename, it's wrong" rule, one
level up. Phase 16's own doors are specified to inherit the correct shape (ADR 0093 D6).

**FF-3-era bugs — all closed and rotated** → [bug-log-archive.md](docs/progress/bug-log-archive.md): BUG-E2E-001 (the seed-eating cleanup behind the gate's b7 cascade), BUG-FF3-002 (unary operators offered but unsavable — `CONDITION_OPS` still the pre-F3 seven), BUG-FF3-001 (stale peer `aria-invalid` on the symmetric rule), and **BUG-FF1-008, closed by FF-3's Amendment 3**.

**FF-5-era bugs — both closed, verified and rotated** → [bug-log-archive.md](docs/progress/bug-log-archive.md): **BUG-FF5-001** (the builder could not author a `reference` item at all — three sites: `ALL_ITEM_TYPES`, `ANSWERABLE_TYPES`, `parseItemFields`; `updateItem` was broken independently) and **BUG-FF5-002** (every top-level reference rendered "Sem resposta" on the durable submitted record — the page never passed `referencesByItemId` and the prop was optional-with-default, so tsc could not object). Both passed pgTAP 4240 + Vitest 851 + tsc + lint + `next build`; **only E2E found them.**

**FF-4-era bugs — BUG-FF4-001 closed, verified and rotated** → [bug-log-archive.md](docs/progress/bug-log-archive.md): **BUG-FF4-001** (clearing a dynamic *or* literal default and resuming RE-SEEDED it — `buildAnswerMaps` collapsed "answered as null" into "never answered"; fixed `b5c505e`, re-verified 7/7 by tester and lead). ⚠ It was a **pre-existing answer-model-v2 bug FF-4 surfaced**, not an FF-4 regression, and **the obvious one-line fix would have broken Rule 3 SQL↔TS evaluator parity** — see the archive entry before touching `buildAnswerMaps`.

**BUG-E2EISO-002 — closed, verified and rotated** → [bug-log-archive.md](docs/progress/bug-log-archive.md): the FF-spec `purge()` **FK-CASCADE orphan leak** (`session_replication_role = replica` disables Postgres’s own cascade triggers, not just the immutability guards). Fixed across **seven** files behind one shared helper, `e2e/helpers/purge-forms.ts` — the four FF specs + `helpers/ff2-matrix.ts`, **plus `answer-model-v2` and `form-model-normalization`, which the original report did not list** and which carried it at **three** sites each. ⚠ Three things to carry forward: **`app.copy_version_children` alone is NOT a sufficient enumeration** (it covers only the authoring half; the response subtree — the half that orphaned real submitted data — comes from `pg_constraint`); the **DV-6 fixed-id collision** on `form_versions_form_id_version_number_key` is fixed too, so those specs are idempotent across runs on one DB; and **production was never affected** — `session_replication_role` is a `superuser`-context GUC that `anon`/`authenticated`/`service_role` are all denied, and a sweep of the linked remote returned **0 orphans on all 15 edges**.

**Ad-hoc bug-fix batch, 2026-08-03 (lead, uncommitted on `main`).** Seven items triaged together, and
the headline finding is about the BUG LOG rather than the code: **four of the seven were not the defect
they were filed as.** Three do not reproduce at all (BUG-P22-001, BUG-E2EISO-003, BUG-E2EISO-001 —
each re-run under its own documented recipe), and BUG-P22-002 was a spec-timing bug filed as a product
defect. Of the three that were real, **two had materially wrong reports**: BUG-AUTHZ-001 named 4
functions when the catalog holds 5, misnamed one relation, and described only half the defect;
BUG-GATE-001's stated mechanism ("would have printed GATE GREEN") was false. Every correction came from
re-running the repro or querying the live catalog — none from re-reading the report.

Fixed: **BUG-GATE-001** (denominator + UNRUN verdict), **BUG-AUTHZ-001** (migration `…000700` +
pgTAP `270`), **BUG-P22-002** (spec timing), **BUG-P15-001** (spec-side derived window — a seed-side
clamp was tried first and reverted for regressing `phase8-dashboard` 8×). Closed not-reproducible:
**BUG-P22-001**, **BUG-E2EISO-003**, **BUG-E2EISO-001**. Already closed before the batch began:
**BUG-E2EISO-002**. Also fixed in passing: `referrals-list.tsx`'s `STATUS_LIFECYCLE_ORDER` was
missing R3's `answered`/`resolved`, so `STATUS_RANK[status]` was `undefined` → **NaN sort comparator**
and neither state was filterable — despite a JSDoc asserting the list "must stay TOTAL"; it now carries
a compile-time totality guard instead of the comment.

#### ✅ BUG-GATE-001 — `scripts/e2e-prod-gate.sh` drops a `reset FAILED` batch from its OWN coverage denominator · owner **lead** · **FIXED 2026-08-03** (filed 2026-08-03, found by the lead during the FF-4 gate)

**Fix:** `abort_batch()` in `scripts/e2e-prod-gate.sh`. `exp` is now collected BEFORE the reset/server
steps (`--list` needs neither a DB nor a server), and both abort paths add it to **`TOTAL_EXPECTED`
and `TOTAL_DNR`** instead of `continue 2`-ing past the tally. A `batch-N.log` stub is written so the
gap shows in `ls`, a per-batch `-> DID NOT RUN` line prints, the summary carries an explicit
`!! N test(s) NEVER RAN` warning, and a new **`GATE RED (UNRUN)`** verdict (exit 5) replaces the
misleading fall-through to `GATE RED — 0 real failure(s)`.

**Verified by fault injection** (PATH-shadowed `supabase` failing every `db reset`, 48 collected
tests): post-fix → `COVERAGE: accounted for 48 of 48` · `48 did-not-run` · stub logs · RED.
**Over-grant twin on the pre-fix script, same injection** → `accounted for 0 of 0` · `0 did-not-run`:
the 48 vanished from *both* sides. That twin is what proves the fix.

**⚠ ONE CORRECTION TO THE ORIGINAL REPORT.** Its headline — "so it can print GATE GREEN over tests
that never ran" — is **wrong**, and was wrong when filed. Both abort paths already appended to
`RED_BATCHES`, and the verdict requires `[ -z "$RED_BATCHES" ]`, so a run with a dead batch could
never print `GATE GREEN`; the pre-fix script prints `GATE RED` (confirmed by the twin above, on the
byte-identical script the FF-4 gate ran — `9d7bc12`, unchanged through `87fbdde`). The real failure
mode is a **lying summary**, not a false green: `860 of 865` reads as ~99% coverage while 66 tests
never executed. Still the only bug here that makes tests *disappear* rather than go red — the
severity call was right even though its stated mechanism was not.

**Observed.** The FF-4 full-suite run printed:
```
COVERAGE: accounted for 860 of 865 collected tests     ← reads as ~99%
```
The true total across all specs is **931**. Batch 4 had died on `reset FAILED`, so its five spec files —
`ethics-e2-procedure` · `ethics-e3a-surfacing` · `ff1-repeating-groups` · `ff2-matrix-views` ·
`ff2-matrix` = **66 tests** — never executed. `931 − 66 = 865`: the script removed the dead batch from
its own denominator rather than counting it as unrun. **Had those 66 contained the only failures, the
script would have printed `GATE GREEN`.**

**Why it evades notice.** The summary looks *better* than a normal run, not worse. `reset FAILED` is a
single unindexed line hundreds of lines up with no batch number on it, no `batch-4.log` is written, and
the per-batch result lines simply have no row for the dead batch — you must spot a **gap in the batch
numbering**, which nothing highlights. `did-not-run` stayed `0` throughout.

**Repro.** Any run where a per-batch `supabase db reset` fails. It happened **twice in one session, on
different batches**, while a manual `supabase db reset` succeeded immediately afterward — so the reset
failure is transient contention (suspects: back-to-back per-batch resets, and `supabase_edge_runtime`
sitting in `exited` state during "Restarting containers"), not a broken migration chain.

**Fix shape (not prescribed — verify first):** the denominator must come from the collected total, and a
batch that never ran must be reported as unrun (and force RED), not subtracted. Consider also emitting a
`batch-N.log` stub on reset failure so the gap is visible in `ls`.

**Interim workaround for whoever runs the next gate — do all three:**
1. `grep -c "reset FAILED" <log>` **before** reading the summary.
2. Check `m` in `COVERAGE: n of m` against `awk '{s+=$1} END {print s}' /tmp/e2e-prod-gate/spec-counts.txt`.
3. Enumerate batches: `grep -oE "BATCH [0-9]+" <log> | sort -k2 -n -u` — a `BATCH N` header with no
   matching `batch N -> …` result line is an unrun batch.

*(In the FF-4 gate the 66 were re-run standalone → **66/66 green**, so no FF-4 regression hid there. That
had to be established, not assumed.)*

#### ⚪ BUG-E2EISO-003 — `bulk-case-creation.spec.ts:344` (AC2) is not idempotent across runs on one DB · owner **tester** · **NOT REPRODUCIBLE 2026-08-03 — recommend CLOSE** (filed 2026-08-03)

**Ran the record's own decisive repro, both ways, on `20260903000700`:**

| Condition | Result |
| --- | --- |
| prod-standalone (`e2e-prod-gate.sh`), fresh `db reset` | **8/8 · GATE GREEN** |
| prod-standalone, **same DB, second run** (`RESET=0`) | **8/8 · GATE GREEN** (27s — no 3× slowdown) |
| `next dev`, fresh reset then immediate re-run | run 1 7/8, run 2 **8/8** |

The AC2 timeout does not occur. Note the dev-server column is *inverted* from the report: the failure
landed on **AC1a** in the cold run and vanished when warm — a first-test-after-cold-compile artifact
(45.8s vs 26.9s), not a data-leftover one. The spec's own fixtures are `Date.now()`-tagged
(`uniquePrefix`, `mrnTag`), so cross-run collisions are not structurally possible.

**Why the original observation still probably happened:** the record says it fired when batch 1 *died
mid-run* and was re-run "against the DB the dead attempt had already mutated". That is a **partially
executed** run's state — not the same thing as a **completed** run's state, which is what "run the same
file again" actually tests and what passes above. So the trigger is the dead-batch interaction, not
per-run idempotency, and the repro written into the record does not exercise it.

**Recommend closing as not-reproducible** rather than as fixed — nothing was changed in this spec. If it
resurfaces, capture whether the preceding attempt *completed*, which is the variable that matters.

**Symptom:** `TimeoutError: page.waitForURL: Timeout 30000ms exceeded` at line 427, waiting for
`/\/manage\/cases\?criados=2\b/` after clicking commit.

**Repro (decisive, run by the lead):** on a **fresh** `supabase db reset` the file is **8/8 pass**
(12.9s). Running the *same file again* against the now-mutated DB → **1 failed / 7 passed** (43.3s — note
the 3× slowdown). So the spec does not tolerate its own prior run's leftovers.

**Why it surfaced in the gate:** the script gives each batch a fresh DB, so this normally never fires.
It fired because batch 1 **died mid-run** (`server_dead=1, conn_errors=24`) and the **rerun executed
against the DB the dead attempt had already mutated**. That also explains why a *different* test in the
same batch failed in the previous full run — batch-1 instability, not a specific defect.

**Not FF-4, not a product defect.** Pre-existing test-isolation weakness. Interacts with BUG-GATE-001:
an unstable batch produces a rerun on dirty state, which surfaces this, which reads as a real failure.

#### ✅ BUG-P15-001 — `phase15-indicators.spec.ts` AC-4 fails on the 1st-4th of any calendar month — seed-data date arithmetic · owner **tester** · **FIXED 2026-08-03** (filed 2026-08-03)

**Fix (spec-side, `e2e/phase15-indicators.spec.ts`):** AC-4 now reads its aggregation window off the
**actual seeded rows** instead of assuming they share the calendar month containing `new Date()`:

```
responses?status=eq.submitted&select=submitted_at,answers!inner(question_key)
  &answers.question_key=eq.dispensador_disponivel&order=submitted_at.asc
```

…then overrides the dialog's label-derived month bounds with `[first, last]` via the
`Início/Fim do período` inputs MINOR-1 added. Nothing constrains the window to the label's month —
`compute_derived_measurement` uses `p_period_start`/`p_period_end` directly — so a span crossing a
month boundary is legal, which is exactly what the 1st–4th needs. The month label stays the current
month; it is only an identifier for the throwaway measurement.

**Verified on 2026-08-03, inside the failing window.** Before: `Numerador derivado: 1 · Valor: 1`.
After: AC-4 passes, full file **12/12**. **Mutation-falsifiable** — narrowing the window to a single
day yields `Numerador derivado: 0` and reds, so the assertion is load-bearing and the window genuinely
drives the result. Also carries a non-vacuity guard: zero source rows fails loudly rather than
silently computing against an empty window.

**Strictly more robust than the old behaviour, not merely boundary-patched.** On a normal day the
derived window sits inside the month and yields the same 2. On the **1st**, where all six fixtures are
in the *previous* month, the old current-month window would have found **0**; the derived one finds
both. It is date-independent by construction.

<details><summary>⚠ A seed-side fix was attempted first and REVERTED — read before re-attempting</summary>

**⚠ The seed-side fix does not work. Do not re-attempt it without reading this.**

Attempt: age both response loops by `least((i || ' days')::interval, v_month_span * i / 7.0)` where
`v_month_span := now() - date_trunc('month', now())`, so the largest age is strictly less than the span
and every response is provably inside the current month. It **did** fix AC-4, and it is byte-identical
to the old values from the 8th onward.

**It regressed `phase8-dashboard.spec.ts` — 8 failures**, caught by the scoped gate
(`GATE RED — 8 real failure(s)`, batch 1). AC-1 read `Expected "6", Received "5"`; AC-1b, AC-1c, AC-2,
AC-3, AC-5a, AC-5b and the Form-B headline all failed the same way. **A/B-confirmed:** revert
`supabase/seed.sql` alone → fresh reset → AC-1 passes. The DB genuinely holds all 6 rows
(verified in-catalog), so the count is lost in the dashboard read path, not in the seed.

**The underlying conflict.** On the 3rd there are only ~2.5 days of month available, so clamping six
fixtures into it collapses a 6-distinct-day spread into ~3 days. `phase8-dashboard` asserts EXACT
counts against the seeded spread; `phase15` AC-4 needs the two `'nao'` responses inside one calendar
month. **Near a month boundary those two requirements cannot both hold in the seed** — there aren't
enough days. So this is not a matter of picking a better clamp expression.

**Recommendation: take the OTHER option the original report offered** — have AC-4 derive its
aggregation window from the actual seeded dates instead of assuming "the calendar month containing
`new Date()`". That is an `e2e/**` change (tester-owned), leaves the seed untouched, and cannot
perturb `phase8-dashboard`. The seed boundary (backend) should be considered closed to this fix.

</details>

Everything below this line is the original diagnosis, which remains correct.

**Repro:** `npx playwright test e2e/phase15-indicators.spec.ts -g "AC-4" --project=chromium --workers=1` on
its own (no neighbours) → **fails identically**: expects derived numerator **2**, gets **1**
(`"Taxa calculada Numerador derivado: 1 · Valor: 1 /1000 pac-dia"`). Ruled out both hypotheses the lead
asked to check:
- **Not FF-4/`seed_default_answers`** — that mechanism only writes answers on a DRAFT's CREATE branch;
  `compute_derived_measurement` counts only `status='submitted'` responses via
  `app.submitted_form_responses`, and both responses this test depends on are long-submitted, pre-existing
  Phase-15-era seed fixtures FF-4 never touches.
- **Not intra-file ordering / neighbour contamination** — reproduces byte-identical run completely alone.

**Root cause, traced and confirmed against live data (today: 2026-08-03):** `supabase/seed.sql`'s Form-A
response-seeding loop (`for i in 1..6`) sets `submitted_at = now() - (i || ' days')::interval`; the
`'nao'`-answered responses (the ones IND-0003's derived numerator counts) land at `i=1` and `i=4`. AC-4
computes its throwaway aggregation period as **the calendar month containing `new Date()` at test-run
time** (by design — see the spec's own MINOR-1 comment). Confirmed live: the `i=1` response is
`2026-08-02` (this month); the `i=4` response is `2026-07-30` (**last** month — `now() - 4 days` crossed
the month boundary because today is only the 3rd). The just-written measurement row proves it exactly:
`period_start=2026-08-01, period_end=2026-08-31, numerator=1` — `compute_derived_measurement`'s own
`sr.submitted_at::date >= v_from` correctly excludes the `2026-07-30` row; the RPC is behaving exactly as
designed. **The defect is that the seed's fixed day-offsets are not guaranteed to stay within the same
calendar month as each other**, which is only ever false on/near a month boundary — i.e. this reproduces
on the 1st–4th of **every** month (the exact window depends on which seeded index answers `'nao'` and its
offset), not just today.

**Verdict: product/seed-data bug, not a spec defect** — the test's assumption ("today's date-relative seed
responses land in the same calendar month") is reasonable and was true when AC-4 was written; the RPC and
the test's own logic are both correct. Left the spec **unmodified** — weakening or rerouting its window
selection to dodge this would hide a real fixture fragility rather than fix it, and the fix boundary
(`supabase/seed.sql`, owned by backend) is outside `e2e/**`. **Not an FF-4 regression** and not blocking
this phase's own acceptance criteria; flagged because it will keep recurring near every month boundary
until the seed's date arithmetic is made month-safe (e.g. an offset that cannot cross `date_trunc('month',
now())`, or the test deriving its window from the actual seeded dates instead of assuming "current
month" — implementation choice is backend's/tester's call, not prescribed here).

#### ✅ BUG-AUTHZ-001 — `platform_admin` reads response-level content through DEFINER dashboard functions, invisible to a policy audit of `responses` · owner **AUTHZ** · **FIXED 2026-08-03** (filed 2026-07-27, PO's call)

**Fix:** migration `20260903000700_authz_dashboard_gate_uniformity.sql` + pgTAP
`270_authz_dashboard_gate_uniformity.sql` (8/8). PO-ruled 2026-08-03: **unify on the 4-fn shape**
— `app.is_admin()` → `app.is_commission_admin_of(v_commission_id)`. All nine `dashboard_*`
functions now carry one identical gate: `is_staff_admin_of(cid) OR is_commission_admin_of(cid)`.
Verified live: pgTAP 4301/4301 + the 8 new keystones; **mutation-tested** (revert the gate → 6 of
the 8 go red, the 2 non-vacuity tests correctly stay green).

**Three corrections to this report, all found against the live catalog:**
1. **It was FIVE functions, not four.** `dashboard_entity_references` (FF-5's reference surface,
   added after the report) carried the same arm and was never listed.
2. **`dashboard_matrix_risk_scores` does not exist** — the relation is `dashboard_risk_scores`.
3. **The report named only half the defect.** The same five functions also **DENIED**
   `is_commission_admin_of`, which the other four ADMIT. Since `getCommissionAccessByOrg` maps an
   `org_admin`/`hospital_admin` into the `staff_admin` branch (ADR 0051 D1), those users *do* reach
   `/dashboard` — and were served populated Totais/Texto-livre/Ao-longo-do-tempo beside **empty**
   Distribuições/Exportar/Matriz/Risco/Referências. A live user-facing gap nobody filed.

**Root cause (found in `docs/reviews/phase-8-review.md`):** at Phase 8 all six original dashboard
functions shared ONE gate — shape A. A later change put the commission-admin mirror on four and
**missed `dashboard_distributions` + `dashboard_export_rows`**. That partial conversion created the
second shape, broke no test, and every door added since copied a sibling in good faith (FF-2 two,
FF-5 one), carrying the stale shape from 2 doors to 5. **A rewrite applied to PART of a function
family is invisible to every check this platform runs.**

Because of (1) the fix enumerates from `pg_proc`, never a hand-written list. The ADR 0078 A35
census is **not** invalidated for `responses` policies — those were correct; the leak was a
`prosecdef` door the policy-shaped census is structurally blind to, which is ADR 0078's own
documented blind spot. Reachable via PostgREST only: a bare `platform_admin` was already 404'd at
the page (`getCommissionAccessByOrg` → `null`).

**Not FF-2's defect** — FF-2 correctly inherited its sibling's arm (lead-ruled; deviating would have
been the inconsistency). The pre-existing question is what got filed.

| Surface | `prosecdef` | `is_admin()` arm |
|---|---|---|
| `dashboard_distributions` · `dashboard_export_rows` · `dashboard_matrix_cells` · ~~`dashboard_matrix_risk_scores`~~ **`dashboard_risk_scores`** · **+ `dashboard_entity_references` (omitted)** | ✅ | ✅ |
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

#### ✅ BUG-P22-001 — the referrals hub does not render a seeded `completed` referral · owner Phase 22 · **CLOSED — NOT REPRODUCIBLE 2026-08-03** (filed 2026-07-27)

**Flow 1a passes**, standalone (2.3s) and in full-file context — `e2e/phase22-referrals.spec.ts` is
**40/40 on a clean `supabase db reset`**. The filed diagnosis is wrong on the mechanism too:
`ReferralsList`'s status filter defaults to `"all"`, so a `completed` referral is never filtered out,
and `listCommissionReferrals` excludes only `draft`. The report's "deterministic, fails every run on
a clean stack" does not hold.

**What that triage round was almost certainly seeing:** run the same file twice on one DB and
`R1-4c/R1-8` fails with `strict mode violation: resolved to 2 elements` — ENC-0033 **and** ENC-0035,
both carrying the R1 fixture's subject, because the file's `beforeAll` mints a referral per run
unconditionally. Serial mode then aborts, leaving **5 tests unrun**. Same defect class as
BUG-E2EISO-003; tracked there, not here.

#### ✅ BUG-P22-002 — `phase22-referrals-governance.spec.ts:1187` R5-6 keyboard-only internal note fails · owner **tester** · **FIXED 2026-08-03** (filed 2026-07-27)

**Spec defect, not a product defect.** The test called `textarea.focus()` immediately after
`page.goto()`. `.focus()` is **not** an auto-waiting action — it resolves the node and fires at once,
so racing RSC streaming makes it silently no-op; only the follow-up `toBeFocused()` reports, as
`Received: inactive`, which reads like a focus-management defect rather than a timing one. The notes
panel renders late (after the related-cases panel).

Proof it was never a product bug: **R1-9 in the sibling R1 file is the same keyboard-only flow
against the message composer and has always passed** — because it awaits
`expect(composer).toBeVisible()` first. R5-6 now uses that same shape (gate on the form, then scope
the textarea/submit to it). Re-verified on a fresh reset: **1/1 pass in 4.5s** (was a 19.5s timeout).

#### ⚪ BUG-E2EISO-001 — `orgadmin.a` loses org-admin affordances when 4 specs share a prod batch · owner **tester** · **NOT REPRODUCIBLE 2026-08-03 — recommend CLOSE** (filed 2026-07-28)

**Ran the record's own repro verbatim** — the same four specs packed into ONE prod-standalone batch
(`BATCH_TESTS=200`, one server, one DB, `RETRIES=0`), on `20260903000700`:

```
batch 1 -> 80 passed, 0 failed, 0 flaky, 0 skipped, 0 did-not-run · accounted 80/80 · pw_exit 0
GATE GREEN
```

**80/80.** Same batch composition as the filed 77 + 3. All three named tests
(`hospital-admin-tier` HA-2 ×2, `phase-multitenancy` MT-6) pass batched.

**Most likely already fixed by BUG-E2EISO-002** (`074cc4d`, 2026-08-03 — the FK-CASCADE orphan leak in
the shared `purge()` helper, where `session_replication_role = replica` disabled Postgres's own cascade
triggers and teardown orphaned rows across 15 edges). This record's own hypothesis was "a
membership/roster mutation by an earlier spec in the batch" — a teardown cascading further than intended
is exactly that mechanism, and E2EISO-002's fix landed after this was filed. Stated as the likely cause,
not proven: no one re-ran this repro between the two.

**Recommend closing as not-reproducible.** If it returns, the variable to capture is which spec in the
batch last purged, not which persona lost affordances.

<details><summary>Original report (retained for the repro recipe)</summary>

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

</details>


## Test Run Summary

<!-- Most recent gate's rows only; rotate the rest to docs/progress/test-run-archive.md at each
     §6 Record (full historical log, Phases 0 → FF-3, already there). -->

**Phase 16 · tester · BUG-P16-006 fix, two independent fresh-reset runs (tester, 2026-08-04,
`--project=chromium --workers=1`)** — the coordinator's explicit reproducibility bar: a single post-fix
pass proves nothing if it rides leftover state from a prior run, so the suite ran twice, each against
its OWN `supabase db reset --local`.

| Run | Result |
| --- | --- |
| Fresh reset #1 → `phase16-accreditation-{core,freshness,hospital,restricted,clone}.spec.ts`, combined | **31 passed · 0 failed · 31/31 · GREEN** |
| Fresh reset #2 (indicator ids confirmed live to differ from both reset #1 and the removed literals) → same 5 files, combined | **31 passed · 0 failed · 31/31 · GREEN** |
| lint (`helpers/accreditation.ts` + 2 changed specs) · tsc | 0 errors/0 warnings · exit 0 |

Full root-cause + fix + the complete 18-UUID classification are in the Bug Log (BUG-P16-006). Committed
`test(e2e): resolve seeded rows by natural key, not captured ids (BUG-P16-006)`.

**Phase 16 · tester · 5 new specs, combined run (tester, 2026-08-03, dev server, `--project=chromium --workers=1`)**
— all 5 phase16 specs together, per each file's own header instruction (avoids the shared
`app.feature_flags` row racing across files under `fullyParallel: true`).

| Run | Result |
| --- | --- |
| `phase16-accreditation-{core,freshness,hospital,restricted,clone}.spec.ts`, combined | **31 passed · 0 failed · 31/31 · GREEN** |
| Same 5 files, run individually (fix-loop / isolation checks) | core 7/7 · freshness 9/9 · hospital 6/6 · restricted 5/5 · clone 4/4 |
| lint (5 specs + `helpers/accreditation.ts`) · tsc | 0 errors/0 warnings · exit 0 |

**Flag-harness self-test (the mandatory pre-check, ADR 0093 / BUG-P16-002's lesson)**: `core.spec.ts`
AC-0 sets `accreditation` OFF and asserts the commission-level `not-found.tsx` boundary
("Não encontramos esta página.") renders — proving the suite CAN fail — then flips it ON and asserts
real content (the hospital surface's "Acreditação" H1; routed there specifically, not the
commission list/framework routes, to keep the proof independent of BUG-P16-003/004 while they were
still open). Both directions verified live before any other assertion was trusted.

**Two blocking product bugs found, fixed, and tester-verified closed in this run** (full detail +
root cause in the Bug Log): **BUG-P16-003** (`framework-list.tsx` forwarding a closure prop across a
Server→Client boundary — crashed the commission framework list for every staff_admin once a global
framework existed) and **BUG-P16-004** (`[framework]/layout.tsx` → `StandardsTree`, the same defect,
crashing every framework/standard-detail page — the larger blast radius of the two). Both fixed by
`frontend` (`3fc40df`) exactly along the reported fix shape (resolve hrefs to strings before the
client boundary); re-verified live via Playwright AND a source read before closing.

**A third, minor bug (BUG-P16-005) also closed this pass.** Filed as "padrãoes" instead of "padrões"
in the readiness dashboard's level card; tester's assertions were deliberately written to TOLERATE
either spelling while the fix was pending, so they would not encode the wrong word. Frontend's sweep
(`c1f098b`) caught a real sibling (`evidence-count-badge.tsx`'s "em atenção" → "em atençãos") and
surfaced a genuine judgment call (noun-vs-verb agreement), which the PO then ruled on
(`aad4877`: noun keyed on `totalStandards`, verb+adjective keyed on `cleanStandards`). With the
wording now final, **tolerance is the wrong call** — it can't red a regression — so tester replaced
both regexes with the exact literal string and swept all 5 specs for any other assertion loosened
around either bug (none found — no fixture anywhere ever drove the aggregate evidence badge's
`atencao` count past 1, so nothing was positioned to observe that half of the bug either). Re-verified
`core.spec.ts` + `freshness.spec.ts` 15/15, then all 5 combined 30/30, `--project=chromium --workers=1`.
Committed `test(e2e): pin the PO-ruled readiness wording (BUG-P16-005)`.

**That coverage hole was then closed as its own follow-up (`8bdefe0`)**, on the lead's read of tester's
own report: "fixed but unguarded" is the weakest state a fix can be in for a bug class that has now
shipped twice in one phase, invisible to lint/typecheck/vitest both times. `freshness.spec.ts` gained
`AC-3-plural` — a dedicated standard with TWO `atencao`-status evidence links (an existing indicator
measurement relinked to a second standard + a new `held` meeting, A3·2) driving the aggregate badge's
bucket to 2 — asserting the exact literal `"2 evidências — 2 em atenções"` (sourced live from
`evidence-count-badge.tsx`, not retyped from memory) **and** that the old buggy spelling ("atençãos")
is absent, so it would genuinely have failed pre-fix. Re-verified `freshness.spec.ts` 9/9, all 5 specs
combined **31/31**, `--project=chromium --workers=1`. Committed
`test(e2e): assert the irregular plural on the evidence badge (BUG-P16-005)`.

**Ad-hoc bug batch · scoped verification (lead, 2026-08-03, `RESET=1 RETRIES=0`)** — scoped rather than
full-suite by design: only the specs covering the changed surfaces were run.

| Run | Result |
| --- | --- |
| `phase8-dashboard` + `phase22-referrals` + `phase22-referrals-governance` | **93 passed · 0 failed · 93/93 · GATE GREEN** |
| 4-spec isolation batch (`phase-multitenancy`/`hospital-admin-tier`/`administrativo`/`cases-board-access`), one batch | **80/80 · GATE GREEN** (BUG-E2EISO-001 does not reproduce) |
| `bulk-case-creation`, fresh DB then **same DB again** | **8/8 · 8/8 · GATE GREEN** (BUG-E2EISO-003 does not reproduce) |
| pgTAP `npm run test:db` | **4301/4301** (+ new `270_…` 8/8, mutation-falsifiable) |
| Vitest · lint · tsc | **873/873** · 0 errors/0 warnings · exit 0 |

⚠ An intermediate run of this same scoped gate was **`GATE RED — 8 real failure(s)`**, all in
`phase8-dashboard`, caused by the BUG-P15-001 seed fix; that fix was A/B-confirmed as the cause and
**reverted**. The green above is on the reverted tree. `phase15-indicators` is therefore still expected
to fail AC-4 today (the 3rd) — see BUG-P15-001.

**FF-4 · DECLARE-GREEN full `npm run e2e:prod` gate (lead, 2026-08-03, on `87fbdde`, `RESET=1 REBUILD=1`)**
— **901 passed · 1 failed · 21 infra · 3 flaky · 0 did-not-run · 15 batches · COVERAGE 926 of 931.**
**All 15 batches ran** (no `reset FAILED`, no gap in the batch numbering — checked by hand per
BUG-GATE-001) and the denominator is the true 931; the 5-test gap reconciles exactly to 5 conditional
self-skips. **Zero FF-4 defects.** Every non-pass dispositioned:

| Non-pass | Disposition |
| --- | --- |
| `bulk-case-creation` AC2 — the 1 "real" failure | **BUG-E2EISO-003** — 8/8 on a fresh DB, fails only on a rerun against state its own dead first attempt mutated. Pre-existing, not FF-4 |
| 21 infra (batch 11: `server_dead=1, conn_errors=42`) | Re-run standalone on a fresh DB → **60/61 pass**; the 1 is BUG-P15-001 |
| 3 flaky | Passed on retry (`phase14c-rca` R1+R2 among them — matches the known baseline) |
| 5 skipped | Conditional self-skips |

⚠ **The suite is therefore NOT literally all-green: BUG-P15-001 fails every run until the 5th of the
month.** Recorded as such deliberately rather than rounded up to "green". QA reviewed it and did not
treat it as blocking; the phase was approved on that basis.

**FF-4 · FIRST full `npm run e2e:prod` gate (lead, 2026-08-03, on `b5c505e`)** — **849 passed · 3 failed · 3
flaky · 15 batches.** Batch 4 hit `reset FAILED` (environmental — `supabase_edge_runtime` state; not a
defect) and never ran 66 tests (`ethics-e2-procedure` · `ethics-e3a-surfacing` · `ff1-repeating-groups` ·
`ff2-matrix-views` · `ff2-matrix`); lead re-ran all five standalone → **66/66**, no FF-4 regression.
`phase14c-rca` R1+R2 flaky, consistent with the known baseline. Both non-flaky failures triaged by
tester below.

| Failure | Verdict | Disposition |
| --- | --- | --- |
| `answer-model-v2.spec.ts` DV-1 (and, once unmasked by fixing DV-1, DV-3 + DV-5 too — `test.describe.configure({mode:'serial'})` was hiding them) | **spec-defect — fixed by tester** | FE-3's segmented Nenhum/Valor fixo/Valor dinâmico control (ADR 0092 ruling 6) replaced the plain "Valor padrão" input for every dynamic-token-eligible type (short_text/free_text/date/time); the old `getByLabel(/Valor padrão/i)` locator now ambiguously matches the new radiogroup's OWN `aria-label="Origem do valor padrão"`. **Verified the literal-default path genuinely still works** before touching anything — full round trip (author via "Valor fixo" → publish → DB truth on `default_value` → wizard pre-fill → edit → submit → DB truth on the submitted value) passes end-to-end, including DV-5's keyboard-only path (ArrowRight to switch segmented modes, Tab to the revealed input — ArrowRight fires the control's own `onChange`+focus per `segmented.tsx`, no Enter/Space needed). `number`/`multiple_choice`/`checkbox`/`dropdown` defaults are UNCHANGED (zero eligible dynamic tokens → the original plain-labelled control renders directly) — confirmed via DV-1's number item and DV-2/DV-4 passing untouched. **6/6, 3 consecutive clean runs** (one interim 5/6 was a shared-DB orphan collision from repeated re-runs during triage — see BUG-P15-related orphan note below — not a real failure; cleaned up, reconfirmed clean). |
| `phase15-indicators.spec.ts` AC-4 | **product/seed-data bug — filed (BUG-P15-001), NOT fixed, NOT FF-4** | Traced to exact root cause: `seed.sql`'s Form-A response loop dates two `'nao'` responses `now()-1d`/`now()-4d`; AC-4 assumes "current calendar month"; today (2026-08-03) is early enough in the month that the `-4d` offset crosses into July. Reproduces standalone (rules out neighbour/ordering contamination, as asked). Confirmed via the actual written row: `period_start=2026-08-01` correctly excludes the `2026-07-30` response per `compute_derived_measurement`'s own (correct) `sr.submitted_at::date >= v_from` filter. Will recur on the 1st-4th of every month until the seed's date arithmetic is fixed. Left the spec untouched — see the Bug Log entry for why rerouting the test would hide, not fix, the fragility. |

**Side note on the shared-DB orphan pattern (see prior FF-4 block below for the original finding):** hit it
again live, in a DIFFERENT file (`answer-model-v2.spec.ts` DV-6, hardcoded fixture id
`99990000-…-0d0e01`) on a repeated re-run during this triage — `delete from forms … ` under
`session_replication_role=replica` left an orphaned `form_versions` row, colliding with DV-6's own
`insert` on its next run (`duplicate key … form_versions_form_id_version_number_key`). Cleaned the one
row blocking re-verification; did not sweep the DB-wide 17 that existed at the time (out of scope for a
triage pass) — reinforces that this is a real, cross-file pattern, not a one-off.

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
| **Phase 16** — Standards Crosswalk & Readiness/Gap Engine v2 (ADR 0093 D1–D10 + Amendments 1–3) | ✅ APPROVED | 2026-08-04 | [review](docs/reviews/phase-16-review.md) |
| **FF-4** — Power Authoring (ADR 0092 + Amendments 1–2) | ✅ APPROVED | 2026-08-03 | [review](docs/reviews/phase-FF-4-review.md) |
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
| 2026-08-03 | **Phase 16 build plan authored + 4 planning rulings** (PO, interview) — CAPA evidence arm = hospital-match + `can_read_capa`; commission-owned frameworks commission-scoped SELECT (narrows D10 — licensed-text leak); visible hospital nav entry; ONA skeleton drafted by backend, PO-validated. Build not started | [0093 Amendment 1](docs/decisions/0093-phase-16-standards-crosswalk-replan.md) · [plan](docs/plans/phase-16-standards-crosswalk-program.md) |
| 2026-08-03 | **Phase 16 replanned + re-gates the pilot** (PO, interview) — pre-pilot again (supersedes 0086's deferral note); skeleton-only framework packs (licensing); ONA `level` dimension + per-level readiness; evidence enum +`charter`+`ethics_procedure` (folds ETH·E3b); worst-wins rollup + `standard_ownerships`; `hospital_readiness` re-gated off `is_admin` (noun rule) | [0093](docs/decisions/0093-phase-16-standards-crosswalk-replan.md) · [audit](docs/reviews/phase-16-external-accreditation-audit.md) |
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

### 🔴 FUP-P16-1 — **14** never-called doors fail the ADR 0079 floor (pre-existing, NOT Phase 16)

> **Lead re-ran it at the gate (2026-08-04, fresh reset): `ARM=floor` reports `=== INVARIANT VIOLATED ===`, 103 authenticated-reachable DEFINER doors with 0 calls, 14 of them off the allowlist.** (Backend's earlier count of 13 was one short.) **Provenance verified, not assumed** — every offender traces to a migration that predates this branch:
> `archive_case_assignment_role`, `create_ethics_allegation_category`, `void_decision` → `20260817000500_ethics_e2_rpcs.sql` · `open_ethics_external_referral` → `20260817000600` · `unlink_referral_case` → `20260817001600` · `set_template_case_type` → `20260829000100`. All ≪ Phase 16's `20260903000800`. `git log main..HEAD -- supabase/tests/mutation/` is **empty** — Phase 16 never touched the audit or its allowlist, and it *removed* an offender (`delete_standard`) rather than adding one.
> ⚠ **So the standing invariant is RED at the Phase 16 gate, and Phase 16 did not make it red.** ARCHITECTURE.md Rule 1 calls this a gate that must keep passing, so **whether to ship Phase 16 (and therefore the pilot, which it gates) over a pre-existing red is a PO decision, not a lead one.** What the red actually means: those 14 doors have **no pgTAP exercising their authorization body** — a *coverage* gap, not a proven vulnerability. It is the same shape as Phase 16's own `delete_standard`, which *looked* covered because its only test was a flag-off negative that raised before reaching the gate.

Surfaced 2026-08-03 while running `ARM=floor bash supabase/tests/mutation/p0-authz-invariant.sh`
during Phase 16. Thirteen `prosecdef` doors — in **ethics vocabulary, case-assignment roles and
referral actions** — are never exercised by any pgTAP suite, so the standing door audit cannot see
whether their authorization bodies work at all. **Predates Phase 16 and is unrelated to it**; all
Phase 16 doors now pass the floor.

⚠ **The mechanism is the reusable part.** Phase 16 had a door of its own in this state —
`delete_standard`, "covered" by pgTAP 280 via a **flag-off negative test that raises *before*
reaching the authorization body**. It looked covered and was not. **Coverage that raises early is
not coverage**, and a `grep` for the function name in the test suite would have said "covered" for
every one of these 13.

**To act on it:** re-run the floor sweep to regenerate the current list (it is derived, not
copied here, precisely so it cannot go stale — the standing "encode load-bearing claims
executably" rule), then add a genuine successful call per door. Relates to ARCHITECTURE.md Rule 1,
ADR [0079](docs/decisions/0079-authz-door-blindness-standing-invariant.md), and the open
**AUDIT-INVOKER-WRAPPER** item, which is the *other* structural blind spot in the same sweep.

### 🟡 FUP-P16-2 — two accreditation reads live in `actions.ts`, not `queries/` (Rule 9)

`getStandardAssessmentDetail` and `searchEvidenceCandidates` are **reads** in
`src/lib/accreditation/actions.ts`. This is debt from **BUG-P16-002**, not a design choice:
`src/lib/queries/accreditation.ts` was still throwing `not implemented` when frontend needed them,
and frontend correctly refused to edit a backend-owned file. Now that the query layer is real,
route both through `src/lib/queries/` per **Architecture Rule 9**. Backend owns the move; frontend
must not do it unilaterally.

### ✅ FUP-P16-3 — `app.copy_version_children` temp-table concern: **INVESTIGATED, NOT A BUG**

Recorded so it is not re-raised. During Phase 16, `clone_framework` genuinely needed a
`drop table if exists` guard (its temp map failed on a second call in one transaction), and the
finding was reported as "the same pattern exists in the precedent I copied it from,
`app.copy_version_children` — confirmed live". **Lead re-checked the live body: it is not the same
pattern.** `copy_version_children` drops **both** temp tables **unconditionally at the end of its
body** (`drop table _clone_section_map; drop table _clone_item_map;`) and has **no exception
block** — so sequential calls in one transaction are fine, and a call that raises aborts the
transaction, leaving no second call to collide with.

⚠ **The lesson, which is why this entry exists at all:** confirming that a *pattern* is present is
not confirming that the *defect* is present. The `on commit drop` line was really there; the
conclusion drawn from it was still wrong. Same family as the standing false-P0 rule — read the
whole body, not the line that matches.

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
