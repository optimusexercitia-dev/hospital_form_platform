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
| 16 | Standards Crosswalk & Readiness v2 [0093](docs/decisions/0093-phase-16-standards-crosswalk-replan.md) · [record](docs/progress/phase-16-standards-crosswalk.md) | ✅ complete | ✅ (lint 0 · tsc · Vitest 901 · real `next build`) | ✅ pgTAP **151 files / 4623** on fresh reset · **e2e:prod 962/962 accounted, 0 assertion failures** · `p0-authz-invariant.sh` INVARIANT HOLDS | ✅ [APPROVED](docs/reviews/phase-16-review.md) (0 blocker/0 major; 2 MINOR + 1 INFO all closed) | ✅ 2026-08-04 | 2026-08-04 | `484a254` on **`main`**, pushed — ✅ `origin/main` (branch `phase-16-standards-crosswalk` fast-forwarded + deleted 2026-08-04) |
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
| ff-program | **Flexible-Forms Program (FF-1…FF-5)** — umbrella; [0086](docs/decisions/0086-flexible-forms-pre-pilot.md) · per-phase index → [program outcome](docs/plans/flexible-forms-program.md) | ✅ **5 of 5 COMPLETE** — the program is closed and no longer gates the pilot | ✅ FF-4 (lint 0/0 · tsc · Vitest **873** · `next build`) | ✅ FF-4 — spec 7/7 · pgTAP **4301/4301** fresh reset · `e2e:prod` 901p, coverage 926/931, **0 FF-4 defects** | ✅ FF-4 **APPROVED** [review](docs/reviews/phase-FF-4-review.md) — 0 P0 / 0 MAJOR | ✅ **2026-08-03** | 2026-08-03 | FF-4 `4df14d7`…`aa77b0d` (13 commits) |
| **ETH·E1** | **Ethics Access Spine [0072](docs/decisions/0072-ethics-access-spine.md) | ✅ complete | ✅ Vitest 369/369 | ✅ pgTAP 91f/2537 · E2E 13/13+1 skip · e2e:prod triaged | ✅ APPROVED (R3) [review](docs/reviews/phase-ETH-E1-review.md) | ✅ 2026-07-14 | 2026-07-14 | 14 commits `167b269`…`02bd2db` (remote deferred) |
| **ETH·E2** | **Ethics disciplinary procedure** [0073](docs/decisions/0073-ethics-procedure-model.md) | ✅ complete | ✅ | ✅ E2E 20/20 · pgTAP `253`–`259` | ✅ APPROVED [review](docs/reviews/eth-e2-review.md) | ✅ 2026-07-18 | 2026-07-18 | `ada4c97`…`2adb169` |
| **ETH·E3a** | **Ethics terminology/UX surfacing** [0072](docs/decisions/0072-ethics-access-spine.md) | ✅ complete | ✅ | ✅ E2E 21/21 · pgTAP `266`–`269`/3852 | ✅ APPROVED r2 [review](docs/reviews/phase-E3a-review.md) | ✅ 2026-07-27 | 2026-07-27 | `e61fa3c`…`38db4c9` |
| **AUTHZ** | ADR 0078 Gate 1 | ✅ complete | ✅ | ✅ pgTAP 2981 · e2e 0-regress | ✅ APPROVED [review](docs/reviews/authz-b-series-review.md) | ✅ 2026-07-16 | 2026-07-16 | `87858f7` (local) |
| **AUTHZ · Gate 2** | ADR 0078 Gate 2 | ✅ complete | ✅ | ✅ pgTAP 772/772 authz · e2e green | ✅ APPROVED (re-review) | ✅ 2026-07-17 | 2026-07-17 | `f07341f` |
| **case-corrections** | **Case Correction Lifecycle** [0085](docs/decisions/0085-case-correction-lifecycle.md) | ✅ complete | ✅ | ✅ tester 24/24 + full prod E2E feat 7/7 (reds triaged infra/baseline; T-2 clean-stack 76/76) | ✅ APPROVED (0P0/0MAJ/2min) [review](docs/reviews/case-corrections-review.md) | ✅ 2026-07-24 | 2026-07-24 | `6b50abc` → main+origin; **remote `db push` ✅ (flag ON, backfill verified live)** |
| **case-custom-fields** | **Case Custom Fields** [0083](docs/decisions/0083-case-custom-fields.md) | ✅ complete | ✅ lint/tsc/vitest 369 | ✅ E2E 8/8 (3× clean) · pgTAP `188` 28/28 · full `e2e:prod` 735p (feat 8/8 on prod build) | ✅ APPROVED (0 P0 · 0 MAJOR · 1 MINOR cleared · 2 INFO) [review](docs/reviews/adr-0083-case-custom-fields-review.md) | ⚠ **unrecorded** — see detail | 2026-07-23 | merge `c857193` · flag ON `fde76d3` |
| **bulk-case-create** | **Bulk Case Creation ("Múltiplos casos")** [0084](docs/decisions/0084-bulk-case-creation.md) | ✅ complete | ✅ build/tsc/lint/vitest 390 | ✅ E2E 8/8 prod-standalone · pgTAP 29/29 | ✅ APPROVED (4 MINOR/OBSERVATION, none blocking; fixed `b948c9f`) [review](docs/reviews/bulk-case-creation-review.md) | ⚠ **unrecorded** — see detail | 2026-07-23 | flag ON `255a8e9` |
| **AUDIT-DOOR-BLINDNESS · P0** | ADR 0078 §7.14 | ✅ complete | ✅ | ✅ 50 KS mut-proven · pgTAP 3288 · invariant HOLDS | ✅ APPROVED [review](docs/reviews/authz-door-audit-p0-review.md) | ✅ 2026-07-18 | 2026-07-18 | ff→main |
| **PCI** | **Process/Case integrity audit remediation** [0095](docs/decisions/0095-process-case-integrity-audit-remediation.md) · [audit](docs/reviews/process-case-integrity-audit.md) · [detail](docs/progress/process-case-integrity-and-template-versioning.md) | ✅ complete | ✅ lint 0/0 · tsc · vitest 945 | ✅ pgTAP **158f/4860** fresh reset · 4 guards neutralization-proven · `ARM=floor` HOLDS · diff-scoped `ARM=policy` **0 BLIND** · `e2e:prod` **GATE GREEN 965p** (shared with TV) | ✅ **APPROVED** r2 [review](docs/reviews/process-integrity-and-template-versioning-review.md) (r1 CHANGES REQUESTED → BUG-TV-001 fixed) | ✅ 2026-08-05 | 2026-08-05 | `44cd9bb`…`f6c847d` → ff `main` |
| **AFF** | **Hospital affiliation, person identity & the org people directory** [0097](docs/decisions/0097-hospital-affiliation-person-identity.md) · [plan](docs/plans/hospital-affiliation-person-identity.md) · [audit](docs/reviews/aff-adr-0097-external-audit.md) — **gates the pilot deploy** (D19) | ✅ **complete** | ✅ lint 0/0 · tsc · Vitest **1023** · `db reset` **298=298** | ✅ pgTAP **165f/5060** fresh reset · `ARM=census` + `ARM=floor` HOLD · `e2e:prod` **GATE GREEN — 985 passed · 0 failed · 0 infra · 1 flaky · 0 did-not-run · 16 batches (no gaps) · 0 `reset FAILED` · accounted 986/991** | ✅ **APPROVED** [review](docs/reviews/aff-review.md) — 0 blocker; 6 non-blocking follow-ups, **all 6 since remediated** (`202c3db` · `8dde312` · `8111fc9`) | ✅ **2026-08-06** | 2026-08-06 | branch `feat/hospital-affiliation-person-identity`; `main` fast-forwarded + pushed to `origin` at `cc66483` (pre-remediation) |
| **MIN** | **Meeting audio → generated ata** [0099](docs/decisions/0099-meeting-audio-minutes.md) (+Amdt 1) · [record](docs/progress/min-audio-minutes.md) — flag `audio_minutes` **OFF** at ship | ✅ **complete** | ✅ lint 0/0 · tsc · Vitest **1158** · `db reset` 301=301 | ✅ pgTAP **166f/5181** fresh reset · MIN spec 10/10 ×4 · `e2e:prod` ×2 **GREEN (triaged, 0 code failures)** · census+floor HOLD · diff-scoped policy 0 BLIND | ✅ **APPROVED (r2)** [review](docs/reviews/min-audio-minutes-review.md) — r1 BLOCKER (apply never reclaimed audio) fixed+proven; 3 MINOR open (R1–R3) | ✅ 2026-08-06 | 2026-08-06 | branch `feat/meeting-minutes` |
| **TV** | **Process-Template Versioning** [0096](docs/decisions/0096-process-template-versioning.md) (+ Amendments 1.1–1.7) — PO-directed full remodel · [detail](docs/progress/process-case-integrity-and-template-versioning.md) | ✅ complete | ✅ lint 0/0 · tsc · vitest 945 · `db reset` 284=284 | ✅ pgTAP **158f/4860 PASS** · `297` 37 assertions all mutation-proven · `ARM=floor` HOLDS · diff-scoped `ARM=policy` **6 COVERED / 0 BLIND** (was 6 BLIND) · `e2e:prod` **GATE GREEN — 965 passed · 0 failed · 0 infra · 0 flaky · 0 did-not-run · 16 batches · 0 reset FAILED · accounted 965/970** | ✅ **APPROVED** r2 [review](docs/reviews/process-integrity-and-template-versioning-review.md) | ✅ 2026-08-05 | 2026-08-05 | `6b9314c`…`f6c847d` → ff `main` |
| **QO·A** | **Quality-office oversight — Phase A** (classification + `quality_reviewer` + UI) [0100](docs/decisions/0100-quality-office-oversight.md) · [plan](docs/plans/quality-office-oversight.md) — **pilot-blocking** | ✅ **complete** | ✅ lint 0/0 · tsc · Vitest **1158** · `db reset` 313=313 | ✅ pgTAP **172f/5355** fresh reset · `q1` **20/20 RED-proven** (7 controls) · `ARM=census` + `ARM=floor` **HOLD** · `e2e:prod` QO **18/19 + 1 cold-start flaky**, 0 QO failures suite-wide, all 97 did-not-run covered | ✅ **APPROVED (r3)** [review](docs/reviews/quality-office-oversight-review.md) — r1 ⛔ / r2 ⛔ / r3 ✅; 5 real findings, all closed structurally | ✅ 2026-08-07 | 2026-08-07 | branch `feat/quality-office-oversight` → `main` |

> ⚠ **Two PCI/TV caveats survive the ✅ above — read them before treating this as deployable.**
>
> 1. **`ARM=census` was never run, and could not be.** The script on this branch supports only
>    `policy|floor|all`; the census arm — the one that catches a *newly added* gate, which passes
>    `ARM=policy` vacuously by being in no BLIND set — exists solely as uncommitted work in the
>    `feat/membership-hardening-technical-director` session, as does the CLAUDE.md §6 text requiring
>    it. QA covered the substance by hand (all 6 new policies carry ALLOW **and** DENY arms; the
>    apparent 7th gap traces to suite `188`). **Re-run `ARM=census` over these two workstreams once
>    that branch lands** — this is the one gate arm this phase's record cannot claim.
> 2. ~~**The TV backfill has never been exercised and structurally cannot be, locally** — rehearsal
>    + remote snapshot blocking before `db push`.~~ **VOID (PO, 2026-08-05): the remote database is
>    EMPTY.** The backfill therefore runs against zero rows there too — the same path `db reset` has
>    exercised green on every local run — so `scripts/verify-tv-backfill.sh` and the snapshot are
>    **no longer blocking**. ⚠ Keep the *mechanism* though, because it recurs: `db reset` applies
>    migrations **then** `seed.sql`, so a backfill is invisible to local testing **forever** (ADR
>    0096 A1.3) — a green reset is not weak evidence of a backfill, it is *no* evidence. The
>    rehearsal script stays in the repo for the first `db push` that ever meets populated data.
>
>    ⚠ **The error to learn from is mine, not the code's.** ADR 0096 justified the whole
>    backfill-not-reset strategy with one clause — *"the remote carries demo/pilot-prep data"* — and
>    it was **never verified**. It then propagated into the ADR, the migration design, this table,
>    and a lead risk assessment that called it "the largest residual risk on this branch". One
>    unchecked premise, restated four times, reads as four confirmations. **Ask what is actually in
>    an environment before designing around it** — the check took one question.
>
> *Historical:* PCI's first `e2e:prod` exited **0** while reporting `GATE RED (UNRUN)` — 655 of 962
> tests never ran, because TV migration files landed on disk mid-gate and the gate resets per batch.
> Superseded by the 965/965 run above. The lesson lives in `docs/testing/e2e-prod-build-gate.md`:
> **authoring a migration during a gate is not inert, and the exit code is not the signal.**

## Current Phase Tasks

<!-- Lead recreates this table at the start of each phase. At the §6 Record step the
     completed phase's task detail is archived to docs/progress/phase-N.md (or a
     feature-named file) and replaced here by a one-line pointer (CLAUDE.md §7). -->

### 🟦 QO·FUP — FUP-QO-1…6 close-out (started 2026-08-07, branch `feat/quality-office-oversight`)

PO rulings 2026-08-07 (asked before work started; each pre-empted a recorded deferral):

- **D-FUP-1 (closes the FUP-QO-1 question):** implement **extend-on-regrant now** — an identical
  re-grant with a new `p_expires_at` UPDATES the existing row's expiry, and the commission-tier
  atomic-replace path WRITES the new expiry. pgTAP `306` §4 pins recut to the new contract; ADR
  amendment required (0100 D9 seam). Phase C break-glass then rides a seam that already extends.
- **D-FUP-4 (closes FUP-QO-4):** KPI strip **stays the global aggregate**; the shipped scope label
  (`quality-kpi-strip.tsx`, renders only when >1 commission is visible) is the resolution. A.9's
  constancy assertion stands. **RESOLVED — records-only.**
- **D-FUP-6:** QO-6 reproduction runs **under load** (full `e2e:prod` with the out-of-process DB
  poller attached), per the follow-up's own next-step note.

| # | Task | Owner | Status |
| - | ---- | ----- | ------ |
| F1 | FUP-QO-1 — extend-on-regrant migration + `306` §4 recut + ADR | backend | ✅ 2026-08-07 (`20260912000000`, ADR 0102) — `306` 37→45, red-first observed 6/43; `f1-expiry-seam-audit.sh` **6/6 RED-PROVEN** |
| F2 | FUP-QO-5 — `100_dashboard` t19 excludes extension-owned functions (pg_depend→pg_extension) + prove-can-find-something control | backend | ✅ 2026-08-07 (`bac7821`) |
| F3 | FUP-QO-3 — retarget vacuous `a2` K8/Kv cases; a2 back to 12/12 RED-PROVEN | backend | ✅ 2026-08-07 (`bac7821`) |
| F4 | FUP-QO-2 — catalog-derived role→landing guard (enumerate `memberships_role_check` from the catalog; every role must resolve to a landing route) | backend (+frontend if `page.tsx` must change) | ✅ 2026-08-07 (`49883c2`, ADR 0101) — **guard fired on its first run: `nsp_coordinator` + `pqs_member` are instances 4 and 5; fix needs `page.tsx` (frontend)** |
| F5 | FUP-QO-4 — records-only close (ruling above) | lead | ✅ 2026-08-07 |
| F6 | FUP-QO-6 — full `e2e:prod` under load with DB poller; classify stale-UI vs lost-write | tester | ✅ 2026-08-07 — **NOT REPRODUCED under load** (see Test Run Summary row); D9/D10 toggle tests all passed clean (1.3–1.9s), poller (continuous, ~12,100 samples) caught the flip too fast to sample (aliasing) but no failure to classify. Streak extended, question still formally open |
| F7 | FUP-QO-2 close — route `nsp_coordinator` + `pqs_member` (the guard's catch, instances 4+5) | backend (filter) + frontend (`page.tsx` branch) | ✅ 2026-08-07 — backend half (`c5b9dca`, `nspOperatorOf`); **frontend half `11d60ad`**: `page.tsx` NSP-operator branch (first of the three office branches) + `KNOWN_UNROUTED` emptied. Guard 14/14 green — both roles resolve to `/o/<org>/nsp` (URL asserted via a throwaway probe, deleted); lint + typecheck clean; vitest **1172** |
| F8 | `list_my_nsp_hospitals()` lacks the `is_active` + unexpired filters every sibling carries; direct caller `capa-operator-gate.ts:26` sits outside the org-read cover | backend | ✅ 2026-08-07 (`20260912000100`) — `145` §I red-first I2/I3/I6, 42/42 after; door dropped from the floor allowlist (6 recorded calls). **Fresh-reset gates PARKED** pending "stack is yours" |

Lead acceptances 2026-08-07: **F1's audit-trigger amendment ACCEPTED** (`trg_audit_memberships`
role-change arm now carries `expires_at_before/_after` when the expiry moves — Rule 11; keystoned
4.13c, mutation-proven E6). **ARCHITECTURE.md Rule 12 `pqs_members` line corrected by the lead**
(no such table; roster = hospital-scoped `memberships`).

### ⬛ QO·A — Quality-office oversight, Phase A · **COMPLETE 2026-08-07**

Full record (task table, the five findings, the M8→M11 narrative, perf numbers, gate detail) rotated →
[quality-office-oversight.md](docs/progress/quality-office-oversight.md). ADR
[0100](docs/decisions/0100-quality-office-oversight.md) · QA **APPROVED (r3)**
[review](docs/reviews/quality-office-oversight-review.md). Gate: 11 migrations · pgTAP **172 files /
5355** · `q1` **20/20 RED-proven** · census+floor **HOLD** · vitest **1158** · `quality-oversight.spec.ts`
**18/19 + 1 cold-start flaky**, no QO failures in the suite.

**The rule this phase produced, and the reason to read the record:** *conferring a capability bit
requires enumerating its **consumers**, not just its producers.* Three of the five findings were that
one mistake in different clothes. **Phase B is the larger instance** — it subtracts a bit from a
principal with far more consumers than S7 ever had. Corollary: *a guard whose boundary is a literal
list cannot close a family — derive the set, assert over the derivation, twin it against the empty set.*

Still open, none blocking: **FUP-QO-1…6** (Follow-ups below). Phases **B** (org_admin content wall) and
**C** (lifecycle + break-glass) are **not** in this phase.

### ⬛ MIN — Meeting audio → generated ata (`audio_minutes`) · **COMPLETE 2026-08-06**

Full record (task table, gate narrative, neutralization audits, PO decisions, QA loop) →
[docs/progress/min-audio-minutes.md](docs/progress/min-audio-minutes.md). QA **APPROVED (r2)**
[review](docs/reviews/min-audio-minutes-review.md). Flag `audio_minutes` ships **OFF**
(`seed.sql` forces ON for local/E2E — a flag-OFF spec must toggle it itself). Pre-enable
gates live in Follow-ups → FUP-MIN-CUTOVER.

**2026-08-06 — N1's out-of-scope original fixed.** Review N1 noted the unlabeled span-caption
file input it fixed in `minutes-upload-dialog.tsx` was *copied* from the pre-existing
`meetings/attachment-upload.tsx:115-117`, left out of MIN's scope. A repo sweep of
`type="file"` found the pattern in **5** components — that one plus `interviews/attachment-upload`,
`cases/case-document-upload`, `safety/rca/rca-evidence-forms`, `safety/capa/capa-evidence-forms`
(all other file inputs already labeled or `aria-hidden` behind a labeled trigger). All five now
use the N1 fix (`<label htmlFor>` + `id` + `aria-describedby` → hint). Lint + typecheck green;
meetings dialog verified in-browser (input's `labels` = "Arquivo", hint resolves).

### ⬛ AFF — Hospital affiliation, person identity & the org people directory · **COMPLETE 2026-08-06**

Detail + completion record (final gate, the three retro lessons, the open-at-close index, and why AFF
was built) rotated → [hospital-affiliation-person-identity.md](docs/progress/hospital-affiliation-person-identity.md).
ADR [0097](docs/decisions/0097-hospital-affiliation-person-identity.md) + [0098](docs/decisions/0098-aff-w1-substrate-shape-decisions.md);
backend surface → `docs/backend-state.md` (AFF section). QA **APPROVED** r1 + **APPROVED final** r2
[review](docs/reviews/aff-review.md). PO-approved **2026-08-06**. Gate: pgTAP **165 files / 5066** ·
Vitest **1026/1026** · `e2e:prod` **985 passed / 0 failed** · `ARM=census` + `ARM=floor` **HOLDS**.

Still open, none blocking: **FUP-AFF-1…4** (Follow-ups section below — FUP-AFF-1 carries the standing
trap: **never cite `ARM=census` for AFF's doors**) and **BUG-BOOTSTRAP-001** (Bug Log below). The
remote `db push` this work made mandatory is *Remaining pre-pilot work* item 2.


### ⬛ Membership hardening + Diretor Técnico (ADR 0094) — COMPLETE, rotated 2026-08-05

Detail → [membership-hardening-technical-director.md](docs/progress/membership-hardening-technical-director.md).
W1→W4 complete and merged to `main`; DT flag ON (`20260905000600`). Gate on the merged tree, fresh
reset: pgTAP **160 files / 4903 · PASS** · lint 0/0 · typecheck · Vitest **954/954** · real
`next build` · `ARM=census` and `ARM=floor` both **INVARIANT HOLDS**.

Both programs that previously gated the pilot are closed: **Flexible-Forms 5/5** (ADR
[0086](docs/decisions/0086-flexible-forms-pre-pilot.md) → [program outcome](docs/plans/flexible-forms-program.md))
and **Phase 16** (ADR [0093](docs/decisions/0093-phase-16-standards-crosswalk-replan.md) →
[record](docs/progress/phase-16-standards-crosswalk.md)). Case-type assignment (ADR 0088) shipped
alongside → [case-type-assignment.md](docs/progress/case-type-assignment.md).


### ▶ PCI + TV — Process/Case Integrity & Template Versioning · **COMPLETE 2026-08-05**

Detail rotated to [process-case-integrity-and-template-versioning.md](docs/progress/process-case-integrity-and-template-versioning.md).
Status + gate record: Phase Status table above (and its two standing caveats). QA r2 APPROVED.

### 📋 Remaining pre-pilot work

Scope was set by ADR [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md) (12 initiatives)
and re-expanded by ADR [0086](docs/decisions/0086-flexible-forms-pre-pilot.md) (FF-1…FF-5); ADR
[0093](docs/decisions/0093-phase-16-standards-crosswalk-replan.md) then re-gated Phase 16 in front of
the pilot. **That block is complete — but ADR [0097](docs/decisions/0097-hospital-affiliation-person-identity.md)
(AFF) re-gated the pilot on 2026-08-05; see item 1.** Completed items are not re-listed here; the Phase
Status table above is the index. What is actually left:

**1. ✅ AFF — COMPLETE and PO-APPROVED 2026-08-06.** No longer gates the pilot deploy (item 2 is now
next). Pointer under *Current Phase Tasks* above; record + the five findings that drove it →
[hospital-affiliation-person-identity.md](docs/progress/hospital-affiliation-person-identity.md);
ADR [0097](docs/decisions/0097-hospital-affiliation-person-identity.md).

**2. 🔴 The pilot deploy itself — user-gated, NOT started. This is the next thing.** ✅ The **git**
half is done: `main` == `origin/main` (verified by a live `git fetch`, not by reading this file — the
row here claimed "not merged/pushed" for a day after it was both). **What remains is the deploy
proper:** the **Coolify** app deploy + the remote **`db push`** of every local-only migration (the
S1–S3 batch onward — every S-phase built local-first by design). **This is when the ETH·E1 m2 flag
flip reaches production.** ⚠ The remote `db push` needs the **user's own auth** — background agents
are auto-denied.
⚠ **AFF raised this from a chore to a blocker: the remote database has NONE of the AFF migrations.**
`main` carries code expecting `hospital_affiliations`, `profiles.cpf` and the ten doors while the
remote still has `home_hospital_id` / `hospital_employee_id`. **A deploy from `main` without the
`db push` first would fail at runtime**, not degrade gracefully.

**3. ⬛ ~~BUG-AUTHZ-002 — two hospital-tier DEFINER doors still carry the forbidden `is_admin()` arm.~~**
**FIXED 2026-08-05** (`20260908000100`, held by `299_hospital_content_door_noun_rule.sql` 11/11) — no
longer gates the pilot deploy. Full entry → [bug-log-archive.md](docs/progress/bug-log-archive.md)
(rotated 2026-08-06), including why the parity test this row prescribed had to be written differently:
enumerated live, the property returns **four** doors, and `verify_audit_chain` must NOT return zero
rows (its `is_admin()` is the platform tier, and audit is platform_admin's own noun).

**4. 🔴 AUDIT-INVOKER-WRAPPER — a structural blind spot in the ADR
[0079](docs/decisions/0079-authz-door-blindness-standing-invariant.md) standing sweep.** Found in FF-3
(QA M-2); **not an FF-3 defect and not a known leak** — PO decision on scheduling. The sweep floors
`prosecdef = t` **public** doors. The shape it cannot see is an **INVOKER wrapper whose own hand-written
RLS probe is the only gate in front of a DEFINER body** — a `prosecdef = f` function whose security rests
entirely on an `if not exists (…)`. FF-3's `get_response_validation_errors` is one instance: deleting its
existence probe reds **0 assertions across six files**, while a commission-Y staff then reads
commission-X rule messages **and item labels** (proven live; keystone `§O` added, mutation-proven).
**It is a pattern, not an accident** — it is the natural way to front an `app.` DEFINER helper, and
**130 of 281 `app` DEFINER functions carry `EXECUTE` to `PUBLIC`**, so the wrapper is the whole boundary
each time. Proposed scope: enumerate `public` `prosecdef = f` functions calling an `app` `prosecdef = t`
function, and require a keystone per wrapper that reds when its guard is removed. Relates to
ARCHITECTURE.md Rule 1.

**5. BUG-AIF-001 / FUP-AI-1 — the platform-wide `router.refresh()`-in-`startTransition` deferred-flush
stall.** PO-directed pre-pilot as its own workstream (2026-07-14), not started. ⚠ **Verify the premise
before scheduling it:** BUG-AIF-001's own root cause was an upstream Next.js bug, fixed by the
`next` 16.3.0-preview.5 bump already in `package.json`, so the remaining platform-wide instances
(`useSatelliteAction`, `useCaseAction`, `useMeetingAction`) may already be discharged. Scope →
[ai-satellites.md](docs/progress/ai-satellites.md).

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

⬛ **BUG-QO-001 — the oversight reviewer reached case attachment BYTES; CLOSED in-phase by M8+M9
(2026-08-06, backend; found by frontend post-M8).** Filed with an honest amendment to the M8
record because M8's first close-out overstated it. **Mechanism:** S7 (the `quality_reviewer`
content arm) propagated to two byte surfaces no threading list named — (1) the direct storage
policy `attachments_obj_select_readable` (user-JWT `createSignedUrl`), and (2) `public.open_attachment`
(`prosecdef`), whose app action signs the resolved path with the **service role**, which does NOT
consult `storage.objects` policies at all. **The M8 record was wrong for ~one wave:** it said "the
reviewer reaches zero object rows," true only of surface (1); surface (2) stayed open until M9,
and `frontend` caught it by refusing to infer the door's gate from M8. **Impact:** latent, never
shipped — case attachments can carry PHI and the byte fetch had no audit emit (Rule 11), but the
console offers no download affordance (`bf0f824`) and the reviewer has no product path to the door;
severity was byte-reachability in the DB, not a live UI leak. **Fix:** M8 (`20260911000700`, storage
policy) + M9 (`20260911000800`, in-body `open_attachment` cut) both require `read_case_deliberation`
for case/interview bytes — the bit every content source confers except S7 (D4). Metadata stays
reviewer-visible; an S3-granted reviewer still reads (capability-shaped). **Live-probed both
directions** (reviewer 0 / coordinator 1 on `open_attachment` and `storage.objects`); pinned by
`308` §5 (5.2 + 5.5 each observed RED pre-fix) + q1 `open_bytes_cut` / `open_resolver_door`.
**Lesson (the reason it's logged not silently fixed):** "reads 0 rows through RLS" says nothing
about what a `SECURITY DEFINER` door signs with the service role — the exact BUG-AUTHZ-001 shape,
one surface over. A `createAdminClient()` app-layer sweep (2026-08-06) confirmed `open_attachment`
was the ONLY service-role storage sign reachable by a signed-in user through a per-item door; the
minutes-audio service-role signs are service-to-service / upload, admin-role-gated, not
reviewer-reachable.

🔴 **BUG-BOOTSTRAP-001 — there is no in-app path to create the FIRST `platform_admin`; production
onboarding has an undocumented manual SQL step.** Filed 2026-08-06 (lead) when the AFF completion
narrative was rotated — **this was the one open item in it that existed in no other tracked place**,
which is why it is here rather than in Follow-ups. Surfaced during AFF, **not caused by it**.
**Mechanism:** `is_admin` is set only by direct SQL, and the promote guard requires an **existing**
admin to promote another — so the set is closed under the product. On a fresh production database it
starts empty and nothing in the app can open it. **Impact:** the first production `platform_admin` is
a manual `update profiles set is_admin = true …` that **appears in no runbook** — not in
`docs/deployment/`, not in the pilot-deploy checklist (*Remaining pre-pilot work* item 2). Whoever
runs the pilot deploy hits this with no written instruction.
⚠ **Not a security defect — the closure is deliberate** (it is what stops self-promotion, and the
guard is correct). The defect is that the bootstrap is undocumented and unautomated, so do **not**
"fix" it by weakening the guard.
**Status:** OPEN, unassigned. Two candidate dispositions, PO's call: (a) document it as an explicit
step in the pilot-deploy runbook — cheapest, and sufficient for one pilot tenant; (b) a
seed/CLI-driven bootstrap that mints the first admin idempotently. **Blocks nothing today** (local +
E2E get `platform@test.local` from `seed.sql`, which is exactly why the gap is invisible to every
gate), but it is on the critical path of the **first production deploy**.

### Closed → [bug-log-archive.md](docs/progress/bug-log-archive.md)

All closed rows (incl. the one-line table, the 2026-08-03 batch’s method notes, and the
earlier-era pointers) rotated 2026-08-06; each bug’s full entry — repro, fix, lessons — is in
the archive. ⚠ Before touching `buildAnswerMaps`, read BUG-FF4-001 there (the obvious one-line
fix breaks Rule 3 SQL↔TS evaluator parity).

## Test Run Summary

<!-- Most recent gate only, ONE ROW each. The narrative — triage, dispositions, mutation proofs —
     rotates to docs/progress/test-run-archive.md at each §6 Record (full history, Phases 0 →
     PCI/TV, already there). -->

> Older rows (MIN · AFF · MEM · PCI/TV and everything before) rotated **2026-08-07** at the QO·A
> Record → [test-run-archive.md](docs/progress/test-run-archive.md).

| Date | Run | Result |
| --- | --- | --- |
| 2026-08-07 | **QO·FUP F6 · `tester` · full `e2e:prod` under load (`REBUILD=1`, defaults) + the out-of-process DB poller, for FUP-QO-6** — main gate: 1019 collected, 17 batches, `--` no `reset FAILED`, batches 1–17 present/no gaps. **Plus a scoped `SPECS=` resume** (`REBUILD=0`, build intact) covering exactly the 3 batches the main gate could not prove clean: b4 (5 specs, crashed exit127/0 tests), b12 (6 specs, 1 failed + 6 did-not-run), b17 (1 spec, 1 failed + 6 did-not-run) — plus a confirmatory solo re-run of `phase14b-triage` (b11's failing spec) | **GATE RED on the main run, but every red re-proven GREEN on isolated fresh-reset re-run — no deterministic regression found.** Main gate: **924 passed · 5 failed · 0 infra · 5 flaky · 12 did-not-run · accounted 946/1019**. Root cause of all 5 real failures + the b4 crash: a **PGRST002 schema-cache-not-ready race right after `db reset`**, filed separately as **FUP-QO-9** (classifier gap, owner backend/`scripts/e2e-prod-gate.sh` — not re-litigated here). Resume run: **155 passed · 0 failed · 0 flaky · 0 did-not-run · accounted 155/156** — b4's 69 tests (ethics-e1/e2/e3a, ff1, ff2) **69/69 clean**, b12's 67 tests (phase16-accreditation ×4, phase17-documents, phase2-auth-shell) **67/67 clean**, b17's `wizard-others-ux` **7/7 clean**, `phase14b-triage` T1–T9 **13/13 clean** (matches the ALREADY-documented order-dependent baseline flake from the prior QO·A gate row above — same exact signature, re-confirmed, not new). **Combined: every one of the 1019 originally-collected tests is now accounted for and green** (either clean in the main run or clean in the isolated resume). ⚠ **Process note, corrected mid-run**: the lead flagged the main gate as "dead, not running" based on a static `batch-17.log` + idle host — verified from evidence (output-file mtime exactly matching the printed `GATE SUMMARY`/`GATE RED` line, zero live processes, batches 1–17 timestamped in unbroken sequence) that the run had actually **completed normally**; batch 17 wasn't retried because its failure (PGRST002) doesn't match the classifier's connection-error signature, not because anything hung. **FUP-QO-6 classification (the task's actual question): NOT REPRODUCED under load.** `quality-oversight.spec.ts` ran once in the main gate (batch 16, 11:48–11:51) with **all D9/D10 toggle tests passing cleanly** — WRITE PATH 1.5s, READ PATH 1.6s, D10 WRITE 1.3s, D10 READ 1.9s, no failure/no near-timeout anywhere near the previously-seen ~11.5s pattern. **Poller had continuous coverage** (13:52:44–16:12:5x UTC across two overlapping segments, ~12,100 total samples, 0 gaps) but **caught zero `excluded` samples for `ccih`** in the batch-16 window — the WRITE-PATH flip+revert (`finally`-block restore) completes in under the poller's ~1.6s interval, i.e. sampling aliasing, not a lost-write signal; consistent with (not proof against) the write landing correctly and fast. **What this run adds to the FUP-QO-6 record**: one additional trial under genuine full-suite load with zero reproduction, extending the prior 15/15-isolated streak; the honest read given the ~20–25% base rate is that either the failure mode is rarer than believed or clusters with a specific contention shape this run's timing didn't hit — **still not established**, and this tester is not manufacturing a classification where none exists. Poller logs kept at `oversight-samples.log` / `oversight-samples-resume.log` (scratchpad, not committed) for anyone re-opening FUP-QO-6 |
| 2026-08-07 | **QO·A · LEAD · FINAL `e2e:prod` gate on the post-M11 tree (`bcbda01`)** — `REBUILD=1`, defaults; 1019 collected, 17 batches. Stack pre-flighted with a **settle window (two samples, 20 s apart)**, not a single glance — 0 runners / 0 servers / port clear / 0 chrome shells both times. **Plus 3 follow-on runs** to close what the gate could not prove: (a) re-run of every spec in the 4 affected batches (b3/b6/b12/b13, 270 tests, `BATCH_TESTS=25`), (b) a 3-spec run to close the 9 that cascaded (23 tests, `BATCH_TESTS=12`), (c) `phase14b-triage` alone on a fresh reset (13 tests) | **QO IS GREEN. Suite green modulo the documented order-dependent flaky baseline.** Main gate: **905 passed · 6 failed · 0 infra · 6 flaky · 97 did-not-run · accounted 1014/1019**, `reset FAILED` = **1**. ⚠ **The 97 unrun are the headline, not the 6 failures** — 69 of them because **batch 13's `db reset` failed outright**, dropping that batch from the gate's own arithmetic; `1014/1019` would otherwise have read as near-complete coverage. Batches 1–17 present, no gaps. **`quality-oversight.spec.ts`: 18/19 passed outright + 1 flaky** (`:275` root landing, failed once at **15.9 s** then passed on retry at **1.3 s** — cold start on the first test after a fresh server, not a defect). Every substantive QO assertion passed: both D9/D10 write-path/read-path splits, D6 lockdown + coordinator control, cross-org isolation + own-console control, excluded-commission 404 + Farmácia-coordinator control, keyboard-only flow. **NONE of the 6 failures is QO** — and **every one is order-dependent, proven by cross-validation**: `case-phase-result` · `form-builder-enhancements` · `phase16-accreditation-core` all **failed in the main gate and PASSED in run (a)**; `charters-cadence` **passed in the main gate, failed in (a), then PASSED in (b)**; `phase14b-triage` T1–T3 failed in-batch but pass **13/13 alone on a fresh reset** (run c). No deterministic failure survives two runs. **All 97 unrun are now covered**: run (a) accounted **270/270** with 0 `reset FAILED` (incl. `phase22-referrals` **40 ok / 0 failed**, the 69 lost to the failed reset), run (b) **GATE GREEN 23/23**. ⚠ **Lead process failures recorded**: (1) an earlier gate survived `TaskStop` — it kills the wrapper, **not** the gate script's tree — and a **single port-3000 sample** "verifying" the kill landed between per-batch server restarts, so the zombie ran on through batches 5→9 and collided with `backend`'s resets **in both directions** (that run is VOID; see the collision note). (2) Two further unscoped-detector errors: a watcher keyed on `batch-3.log` fired while batch 4 still ran, and a `grep` across **all** `batch-*.log` (incl. stale files from prior runs) reported "33 QO failures" that did not exist. **Scope every detector to the run under test, and never verify a kill with one sample** |
| 2026-08-07 | **QO·A · `tester` · scoped 7-spec re-run (NOT a full gate)** — `processless-cases` + both `process-template-*` + 4 siblings + `quality-oversight`, `BATCH_TESTS=25`, fresh build | **70 passed · 0 failed · 0 infra · 0 flaky · 0 did-not-run · 2 skipped of 72 collected**, 4 batches, self-terminated 05:28:36→05:33:54. `quality-oversight.spec.ts` **18/18** in batch 4. Independently reconciled by the lead against `spec-counts.txt` before the collision was diagnosed. ⚠ Recorded as a **scoped verification, not a Phase-Gate suite run** — `tester` declined to write it into this table for exactly that reason, which was the correct call |
| 2026-08-07 | **QO·A · LEAD · full `e2e:prod` gate #1 (pre-D7-fix baseline)** — `REBUILD=1`, defaults otherwise (`BATCH_TESTS=70`, `RESET=1`, `RETRIES=1`, `INFRA_RETRY=1`); HEAD `9bb789b` **plus one comment-only uncommitted diff** in `e2e/quality-oversight.spec.ts` (stable throughout — the gate runs files on disk, not HEAD; recorded rather than claimed as a clean freeze). 87 spec files → 16 batches, fresh server + fresh DB per batch | **GATE RED — 992 passed · 8 failed · 0 infra · 4 flaky · 8 did-not-run · 3 INFRA re-runs · accounted 1012/1017.** Structural checks clean **first**: `reset FAILED` = **0**, batches 1–16 present with **no gaps**. ⚠ **Two reading traps hit, both the lead's:** (1) the task notification reported **exit 0** while the gate's own exit was **1** — the wrapper ended in `tail`, so `$?` was `tail`'s; *the exit code is not the signal*. (2) A first triage grep for the spec name AND `fail` **on the same line** returned "quality-oversight: NO failures" — impossible to match, since Playwright prints them on separate lines; a detector scoped to the wrong property, whose silence read as good news. Re-extracted per batch for real attribution. **Attribution: 3 of 8 are QO** (`quality-oversight.spec.ts` b15 — `Casos visíveis` expected `5`, received **`15`**: batch 15 runs `processless-cases` + both `process-template-*` specs before it on the shared DB and they create CCIH cases. **Spec defect, not product** — `Comissões` still 1, locked case still invisible; the reviewer correctly saw the extra cases). **5 are unrelated baseline flake**: `nsp-per-hospital:120` · `phase14b-triage` T1–T3 · `recommend-result` RR-1a. `nsp-per-hospital` was **not** written off — it asserts cross-hospital isolation next to M6's widened `hospitals_select`/`organizations_select`, so `backend` probed it live: populations 3/1/1 disjoint, `pqs.a` sees exactly central-a's 3, `is_quality_reviewer_of(secundario-a)` and `is_quality_reviewer_in_org(rede-a)` both **false**, `hospitals_select` yields zero for `pqs.a` → **isolation HOLDS, M6 exonerated** (its own first two probes read `0/0` with a zero control and were discarded — a hospital UUID had been passed into `pqs_inbox`'s `p_status text`). **8 did-not-run in b16 — nothing proven for them; must be covered in the re-run.** Gate #2 follows the D7 cut wave + the tester's contamination fix |
| 2026-08-07 | **QO·A · `tester` · multi-commission extension + 2 locator fixes for concurrent `frontend` commits (7ca0207)** — `e2e/quality-oversight.spec.ts` grew to 16 tests (new `QO·A — multi-commission board (D10 cross-committee)` test, lead-ruled: flip Farmácia visible at spec time via the real `set_commission_oversight` door rather than a seed change); fixed both `Indicadores da supervisão`→`Visão geral` region-name call sites and rewrote `kpiValue()` (the KPI grid moved one level deeper into a wrapper `<div>`, which would have made the old `hasText`-filtered `div` search match the wrapper too) before running, per the lead's swept-in-one-pass instruction. Fresh `npm run build` + standalone restart to pick up `frontend`'s + `backend`'s concurrent commits, `--project=chromium --workers=1` | **16/16, run twice.** Mutation-checked the new test before trusting the green: inverted the Farmácia-selected chip assertion to expect CCIH's case (the wrong commission) — RED for the right reason (`element(s) not found`) — reverted, re-ran, 16/16 again. Independently confirmed the `finally`-block restore held even through that deliberate failure (`select quality_oversight from commissions where id=…` re-queried directly against the DB: `excluded`). `/manage/comissoes` sweep (83 tests) re-run against the same fresh build: **83/83, 0 regressions.** lint + `tsc --noEmit` clean. `git branch --show-current` verified `feat/quality-office-oversight` before staging; `e2e/**` + `PROGRESS.md` only |
| 2026-08-07 | **QO·A · `tester` · new spec `e2e/quality-oversight.spec.ts`** (15 tests) + `/manage/comissoes` locator-regression sweep (`hospital-admin-tier.spec.ts` + `phase-multitenancy.spec.ts` + `phase3-admin-members.spec.ts`), `--project=chromium --workers=1`, prod-standalone server on a live (non-reset) local DB | **quality-oversight.spec.ts: 15/15, run twice (no flakiness).** `/manage/comissoes` sweep: **83/83 — 0 regressions** from the `OrgCommissionList` un-nesting (none of the three specs key on the whole-card accessible name the restructuring narrowed). 3 spec-authoring bugs found+fixed on the first run (not product defects — see A.9 row for detail): 2 Playwright strict-mode multi-match locators + 1 wrong not-found-boundary assumption. lint (`e2e/quality-oversight.spec.ts`, `--max-warnings=0`) and `tsc --noEmit` both clean. `git branch --show-current` verified `feat/quality-office-oversight` before staging; `e2e/**` + `PROGRESS.md` only |

## QA Verdicts

<!-- ONE LINE per phase/feature: verdict + date + link. The full analysis lives in
     docs/reviews/*.md — never restate rationale here or in the archive.
     Struck-through rows are superseded rounds, kept only to show a phase looped.
     Retention: current milestone only. Older concluded rows move VERBATIM to
     qa-verdicts-archive.md's "Collapsed one-line index" (the index is not rationale —
     it preserves the feature-name → review-file mapping). -->

| Phase / Feature | Verdict | Date | Report |
| --- | --- | --- | --- |
| **QO·FUP** — follow-up close-out (F1–F8; ADRs 0101/0102) | ✅ **APPROVED (r2)** — `6b6f894` closes **R1** at all three record sites with **visible corrections** (not silent rewrites); **FUP-QO-7 re-scoped to the true finding, re-graded PHI-grade, and correctly NOT declared a defect** (blank expiry may legitimately mean "permanent" — needs its own property-bounded caller sweep + PO ruling + an executable pin either way; door untouched). Its new reachability claim re-verified from the catalog (`grant_case_access` / `create_case` / `create_case_from_template` — exactly those three). Recorded root cause is the reusable half: **a fixed-width `substring(… for N)` is a WINDOW, not a delimiter — absence inside it is not absence**, and it failed in the urgency-suppressing direction. **R2** recut onto the property "reaches `app.grant_role_impl`" — doors + SQL tier match my sweep exactly. **R3** both `platform/actions.ts` sites fixed *with the why*, plus a real bonus catch (`pqs/actions.ts` named a `(hospital,user)` PK that does not exist). Lint/typecheck/vitest 1172 re-run green after the `src/` edits. **2 MINOR carried forward, non-blocking:** the recut TS list is short by 3 (`org/actions.ts:238`/`:320`/`:385` — the callers of three SQL functions it does name; 9 → 12, none passes `p_expires_at`, ruling unaffected) + 3 line numbers drifted inside the same commit; and the R3 sweep covered `src/` only, leaving `145_pqs_membership.sql:112` + `224_memberships_collapse.sql:435` — both residuals are the same class as the finding they correct (a property's transitive closure; the union of scoped sweeps). Plus r1's R4–R6 INFO. | 2026-08-07 | [r2](docs/reviews/qo-fup-review.md#round-2--re-review-of-the-6b6f894-corrections) |
| ~~**QO·FUP** — round 1 (R1 case-door divergence recorded backwards)~~ | ⛔ CHANGES REQUESTED (r1) — **no shipped code needs to change**; every behavioural deliverable re-derived from the live catalog and correct, all gates green on a fresh reset (pgTAP 5371, `ARM=census` + `ARM=floor` hold, f1-seam **6/6**, a2 **12/12** with both controls, vitest 1172, lint/typecheck clean — this also discharges F8's PARKED fresh-reset gates). **R1 MAJOR (blocking):** ADR 0102 + FUP-QO-7 + backend-state.md state as *catalog-verified* that `app._grant_case_access_unchecked` "omits `expires_at`" / "keeps the do-nothing seam" — the catalog shows `expires_at = excluded.expires_at` **present and uncoalesced**, i.e. the opposite and worse: a blank-expiry re-grant **clears** a time-boxed PHI grant to permanent (reproduced through the real door), and FUP-QO-7 as filed points away from it. **R2 MINOR:** the caller sweep carrying the NULL ruling names 3 callers; the real set is 3 doors / 8+ sites (`grant_role_for` and 5 SQL callers unlisted) — conclusion survives, re-swept. **R3 MINOR:** 4 prose sites still assert the pre-F1 `on conflict do nothing`. 3 INFO. | 2026-08-07 | [qo-fup](docs/reviews/qo-fup-review.md) |
| **QO·A** — Quality-office oversight, Phase A (ADR 0100 D1–D11) | ✅ **APPROVED (r3)** — R1 + R2 closed by M11 (`20260911001000`) at the level that generalises. **R1:** interview family re-derived independently by **FK closure to `case_interviews`** (a structural property, not text) = 8 tables + the `attachments` `'interview'` dispatcher arm — **zero** still route the widened `can_read_case`; behaviourally reviewer **0** / coordinator **1** on both former leaks; the `'case'` arm survives and is guarded by an **inverted postcondition** (fails if it is ever changed). **R2:** 8 lattice assertions present, S3/S4 twins genuinely non-vacuous (each proves the antecedent), all 8 green pre-M11 on a true 312 catalog — pinned an invariant, did not repair a break. **§5.1** is a real derivation with an empty-set twin and mirrored as a migration postcondition. **PO ruling** pinned in the catalog (both `COMMENT ON POLICY`, in-migration so they survive a reset) and by `311` §5.2c, which reds on re-point/delete/rename. **Carried forward, non-blocking:** 1 MINOR (§6's S3/S4 fixtures also hold `staff`, so S5 supplies the deliberation half — the assertions cannot isolate the arm they name; one-line fix, **land before Phase B**) + 2 INFO (§5.1's anchor is a token so DEFINER doors fall outside it; 6.4/6.5 lack positive twins and 6.6 is a marker not a proof) + r1's m3. | 2026-08-07 | [r3](docs/reviews/quality-office-oversight-review.md#9-round-3--re-review-of-the-m11-closure) |
| ~~**QO·A** — round 2 (R1 interview family incomplete; R2 lattice invariant unpinned)~~ | ⛔ CHANGES REQUESTED (r2) — r1's B1/M1/M2/m1/m2 + the perf record all **CLOSED** by M10 (`20260911000900`) and closed well. **2 new, both in the remediation:** **R1 BLOCKER** — the interview-family cut is incomplete: `case_interview_links_select` and `can_read_attachment`'s `'interview'` arm still route the raw `can_read_case`, so the reviewer reads the interview's **external audio-recording URL** (`external_url` is column-granted; seeded value is a `.mp3`) and its transcript's title while `can_read_interview` is **false** — M10 cut 7 of the family's 8 tables because the enumeration boundary was a *predicate name*, and `311` §5.1's hardcoded table count cannot detect a member never in the list. **R2 MAJOR** — the lattice invariant M8+M9+M10 all rest on ("content without deliberation ⟺ S7") is pinned by no keystone; a future content-conferring arm silently over-cuts ~20 surfaces with LOST ≠ 0 and nothing reds. Consumer enumeration **independently re-derived** (71 fns / 46 policies) — agrees with M10 everywhere except R1; `case_participants` chased and cleared (`is_org_member` needs `commission_id NOT NULL`). §6 disarming sweep: **no further instance.** | 2026-08-07 | [r2](docs/reviews/quality-office-oversight-review.md#8-round-2--re-review-of-the-m10-remediation) |
| ~~**QO·A** — round 1 (B1 three write doors on `can_read_case`; M1 Class-2 identity; M2 interviews)~~ | ⛔ CHANGES REQUESTED — 1 BLOCKER (B1: D7 breached — `file_correction_request` / `declare_conflict` / `record_recusal` gate on `can_read_case` alone, which S7 satisfies; live-probed reachable, unpinned by any suite, and `308` 1.4 is vacuous w.r.t. them), 2 MAJOR (M1 Class-2 `professional_profiles` reachable vs. D5; M2 interviews DB-open / UI-hidden vs. Rule 1), 3 MINOR | 2026-08-07 | [r1](docs/reviews/quality-office-oversight-review.md) |
| **MIN** — Meeting audio → generated ata (ADR 0099 D1–D18) | ✅ **APPROVED (r2)** — BLOCKER + both MAJORs closed & independently re-verified (sweep door probed, detector proven able to find an orphan; authz probe re-run unregressed); 3 MINOR open (R1 N3 name ambiguity, R2 undiagnosed click anomaly, R3 duplicated `signCallbackBody`) | 2026-08-06 | [r2](docs/reviews/min-audio-minutes-review.md#round-2--re-review-of-the-remediation-delta) |
| ~~**MIN** — round 1 (B1 apply never deletes the audio; M1 the O3 sweep does not exist; M2 lazy TTL)~~ | ⛔ CHANGES REQUESTED — 1 BLOCKER, 2 MAJOR, 7 MINOR, 6 INFO | 2026-08-06 | [r1](docs/reviews/min-audio-minutes-review.md) |
| **AFF** — Hospital affiliation, person identity & the org people directory (ADR 0097 D1–D19 + ADR 0098) | ✅ **APPROVED (r2)** — F1–F7 closed & re-verified; 2 MINOR open (N1, N2) | 2026-08-06 | [r2](docs/reviews/aff-review.md#8-round-2--re-review-of-the-remediation-delta-86ce0d15b4b1df) |
| ~~**AFF** — round 1 (F1–F7 filed: Rule 10 string, detector blind to named conditions, audit-arm & CPF-probe gaps)~~ | ✅ APPROVED — 6 non-blocking follow-ups, all open at sign-off | 2026-08-06 | [r1](docs/reviews/aff-review.md) |
| **PCI** — Process/Case Integrity audit remediation (ADR 0095) | ✅ APPROVED (r2) | 2026-08-05 | [r2](docs/reviews/process-integrity-and-template-versioning-review.md#round-2--re-review-head-f6c847d) |
| **TV** — Process-Template Versioning (ADR 0096 + Amendments 1.1–1.7) | ✅ APPROVED (r2) | 2026-08-05 | [r2](docs/reviews/process-integrity-and-template-versioning-review.md#round-2--re-review-head-f6c847d) |
| ~~**PCI + TV** — round 1 (BUG-TV-001: dead narrative-slot edit/remove)~~ | ⛔ CHANGES REQUESTED | 2026-08-05 | [review](docs/reviews/process-integrity-and-template-versioning-review.md) |
| **Phase 16** — Standards Crosswalk & Readiness/Gap Engine v2 (ADR 0093 D1–D10 + Amendments 1–3) | ✅ APPROVED | 2026-08-04 | [review](docs/reviews/phase-16-review.md) |
| _Phase 0 → FF-4_ — **81 concluded rows rotated 2026-08-06** (one line each, verbatim, incl. struck loop rows) | — | — | [collapsed index](docs/progress/qa-verdicts-archive.md) |

## Decisions

<!-- One line per decision; full rationale in docs/decisions/ (ADR) + docs/progress/decisions-log.md -->

| Date | Decision | Ref |
| 2026-08-05 | **AFF — hospital affiliation, CPF identity & the org people directory** (PO, grilling interview) — hospital affiliation becomes a **row** (`hospital_affiliations`, soft-ended, matrícula per employment) and is a **visibility input, never a capability input** (amends 0048 D7: hospital *is* now a read boundary); `profiles.home_hospital_id` + `hospital_employee_id` **dropped**; **`profiles.cpf`** platform-unique = the person key (nullable column, required at the action layer); the already-shipping org-wide roster disclosure **ratified** via `list_org_people` gated on `is_org_admin_of OR is_org_level_admin_within` (amends 0048 D1), CPF **exact-match input only, never in the payload**; one **identifier-first** registration flow (`registerUser` keeps its collision block as backstop — amends 0048 D9); `professional_profiles` gains `cpf` but linking is **deferred and only ever from inside a case** (a registration-side match would disclose ethics-case subjecthood); person-level fields **`org_admin`-only**, account deactivation unreachable by hospital admins; single-hospital tenants seat `org_admin` + `hospital_admin` at **provisioning** (no model change, no self-grant relaxation) behind a new **dominance grid** + 2 live gap fixes. **All pre-pilot** — the schema is free only while the reset is | [0097](docs/decisions/0097-hospital-affiliation-person-identity.md) · [plan](docs/plans/hospital-affiliation-person-identity.md) |
| 2026-08-04 | **The authz door-blindness invariant becomes a PHASE STEP, diff-scoped** — §6 step 1 gains ARM 2 (~1 min) every phase + a **diff-scoped** ARM 1 whenever a phase touches an RLS policy or `prosecdef` gate (case list derived from the migration diff, never by hand); step 5 must **name the ARM, not the script**. The full ~5 h sweep stays a **periodic** audit — mandating it per phase would reproduce the failure it fixes, and a diff-scoped gate is adoptable today against the open 15-violation backlog | [0079 Amendment 1](docs/decisions/0079-authz-door-blindness-standing-invariant.md) · [CLAUDE.md §6](CLAUDE.md) |
| 2026-08-04 | **Membership-hardening + Diretor Técnico: the four open items closed** (PO) — T1.0 = **atomic replace**; **platform_admin may NOT appoint a DT** (tenant governance, not tenancy administration — the only kernel grant arm with no `is_admin_for` branch); build **W1→W4 straight through** on one branch; `technical_director` flag **ships ON** at T4.9 | [0094 Amendment 1](docs/decisions/0094-membership-hardening-and-technical-director.md) · [plan](docs/plans/membership-hardening-technical-director.md) |
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
| _pre-2026-07_ | **35 earlier decision rows (Phases 0–14, 2026-06-11 → 2026-06-25) rotated 2026-08-04** — one line each, plus the verbose form of every one | [decisions-log.md](docs/progress/decisions-log.md) |

## Follow-ups / Deferred Items

### ▶ FUP-MIN-CUTOVER — audio-minutes pre-enable gates (feature merged, flag OFF)

Owner: lead + human. Before the pilot flag flips (runbook §6 checklist is authoritative):
- [x] **Remote `db push`** — ✅ DONE (discovered already applied; catalog-verified 2026-08-06:
      302/302 migrations incl. AFF `20260909*` + MIN `20260910000100–400`, all 13 MIN functions
      in remote `pg_proc` with expected `prosecdef`, `meeting-audio` bucket cap 524288000).
      The deployed-`main`-breaks warning is closed.
- [ ] **Cloud storage upload cap** — ⛔ **BLOCKED, human decision**: org `Rede Madre` is on the
      **Free plan** (checked 2026-08-06) → 50 MB hard cap; 500 MB needs a **Pro upgrade**, then
      raise the dashboard storage limit and record it in runbook §2 (blocker recorded there).
- [ ] **T5 manual smoke** — plumbing ✅ DONE 2026-08-06: `minute_generator/.env` + platform
      `.env.local` `MINUTES_*` share minted secrets; smoke doc authored
      (`docs/testing/audio-minutes-smoke.md` — was referenced by runbook §6 but never existed);
      §3 webhook probe → 401 ✓; local storage container live-verified at 512 MiB. **Run blocked
      on human**: fill `ANTHROPIC_API_KEY` + `ASSEMBLYAI_API_KEY` in `minute_generator/.env`,
      supply a 1–3 min non-medical pt-BR audio, flip `MINUTES_SERVICE_URL` :8891→:8000 for the
      session (smoke doc has the full recipe).
- [x] **QA r2 residuals R1 + R3** — ✅ fixed 2026-08-06. R1: accessible name is now
      `Anexar a um item: "<resolução>" a "<item>"` — unique per card AND the visible label is
      the prefix (closes the pre-existing WCAG 2.5.3 gap QA's prescribed format would have kept).
      R3: `server-only` reverted on `src/lib/audio-jobs/hmac.ts`; E2E helper imports the real
      `signCallbackBody` (D16 restored); `docs/backend-state.md` updated. MIN spec 10/10 green
      (chromium, fresh reset).
- [ ] **R2** — the ≥8-tests click-delivery anomaly: did NOT reproduce on the 2026-08-06 rerun
      (10/10 first-attempt); still owed one look on different hardware before the pilot.
- [ ] Env vars on the deploy target: `MINUTES_SERVICE_URL/_API_KEY`, `MINUTES_CALLBACK_HMAC_SECRET`,
      `MINUTES_CALLBACK_BASE_URL` (runbook §3) — mint NEW production secrets, never the local
      smoke pair; plus the service itself deployed (`docker-compose.coolify.yml`) with its DPA
      gates closed (runbook §6).

<!-- OPEN backlog only (reviewed at each phase start). Resolved [x] items archived →
     docs/progress/follow-ups-archive.md (full snapshot). -->

### ✅ FUP-QO-8 — RESOLVED 2026-08-07 (backend, F8) — `list_my_nsp_hospitals()` ignored `is_active` and expiry (2026-08-07, backend; lead-scoped)

Found while grounding F7's landing-surface check — i.e. by reading the door I was about to route
users through, not by looking for it. The NSP console-entry door read `public.memberships` **raw**:
no `app.is_active` gate and no `expires_at is null or expires_at > now()` filter, while **every**
sibling in the same lane carries both (`is_pqs_member_of_for`, `is_pqs_member_of_any`,
`is_pqs_operator_in_org_for`).

⚠ **The reason it survived is the interesting part.** In the console path the org read
(`organizations_select` → `app.is_pqs_operator_in_org`) applies the correct filters, so the shell
was saved by the **org read**, not by the door — the laxity was invisible exactly where anyone
would look for it. `src/components/indicators/capa-operator-gate.ts:26` calls it **directly**,
outside that cover, so an expired or deactivated `pqs_member` kept the "Abrir plano de ação (CAPA)"
affordance. Display-only (`open_capa_plan` re-gates, 42501), so no data leak — but a DEFINER door
whose own gate is weaker than its siblings' is invisible to a policy-shaped audit by construction
(`prosecdef` REPLACES RLS), and it becomes a leak the first time someone reads data from it.

⚠ **It had NO pgTAP caller at all** — it sat on `authz-neverclled-door-allowlist.txt`, which is
precisely how its gate drifted below its siblings' unnoticed. That is the floor arm reporting a real
blind spot rather than a bookkeeping nit.

**Fix — migration `20260912000100`.** `app.is_active` moved into a `me` CTE (an inactive caller
yields no rows, both union arms collapse, and the existing `coalesce(..., '[]')` returns the
documented safe default — no second exit path to keep in sync); expiry filter + `hospital_id is not
null` on **both** arms. `create or replace`, unchanged signature: BEFORE/AFTER catalog snapshots
identical property-for-property, **including the `authenticated=X/postgres` ACL that IS this door's
reachability**.

**Caller sweep before writing a line:** SQL callers **ZERO** (comment-stripped `prosrc` scan +
`pg_policies` scan); TS callers exactly one RPC site (`pqs.ts:223`) with two consumers
(`getNspAccessByOrg`, `capa-operator-gate`). Both ask "may this caller operate here NOW" — **the
laxity was not load-bearing for anyone**, so no STOP-and-report was warranted.

**Evidence.** `145` §I (I1–I7), **red-first observed before the migration: I2 / I3 / I6 red
(`have: 1, want: 0`), 42/42 ran**. Positive twins on both sides (I1/I5) and a both-ways probe (I4 —
reactivating restores the row, so I3's zero came from `is_active` and not a broken fixture); I6
exists because the coordinator arm is a **separate union branch** and a one-arm fix passes I1–I4.
`jsonb_array_length`, never `count(*)` — the door returns scalar jsonb, so `count(*)` is always 1
and would read the same on both sides of the fix. I7 pins the ACL structurally. Post-fix 42/42.
Door **removed from the floor allowlist** — verified with `track_functions='all'` that pgTAP now
records **6 calls**, so `ARM=floor` will see it as genuinely called.

### 🔴 FUP-QO-7 — the case-access PHI door NULL-CLEARS expiry on re-grant, UI-reachable (2026-08-07; **RE-SCOPED 2026-08-07 after QA R1 — the original entry was BACKWARDS**)

⛔ **Read this entry, not its first version.** It originally said the case door "omits `expires_at`",
i.e. that it kept the seam limit F1 removed from the role door — and told this follow-up's future
owner to consider **adding** a capability the door **already has**, pointing them away from a live
widening. QA reproduced from the live catalog and through the real door and inverted it.

**The actual finding.** `app._grant_case_access_unchecked`'s `on conflict (case_id, principal_id,
source, source_entity_id) where revoked_at is null do update set …` list **ENDS with
`expires_at = excluded.expires_at` — uncoalesced**. So the case-access door **already extends on
re-grant, and NULL-CLEARS**: as case coordinator, re-granting an existing 7-day grant with a blank
expiry sets `expires_at = null`. It is **UI-reachable** — `src/lib/case-access/actions.ts:181` sends
`p_expires_at: expiry ?? undefined`. This is the exact silent-privilege-widening shape ADR 0102 §2
**refused** for the role door, on a door that carries **`read_standard_phi` / `read_restricted_phi`**.
Reachable through `public.grant_case_access` (and `create_case` / `create_case_from_template`).

**Severity: PHI-grade.** Not "a divergence to tidy up".

⚠ **NOT a defect until the PO says so, and the door must NOT be changed on that assumption.** An
admin re-granting case access with a blank expiry may legitimately mean "make this permanent" — the
role door's ruling turned on the fact that *no* caller passes the argument, and the case door has a
UI that deliberately sends it. What this needs: **(1)** its own caller sweep bounded by the property
"reaches `app._grant_case_access_unchecked`", **(2)** a PO ruling on the intended NULL semantics,
**(3)** whichever way it goes, an executable pin so the behaviour stops being discoverable only by
reading. `306` 4.4's "mirrors `grant_case_access` verbatim" refers to the **past-expiry refusal** and
is still true — only the re-grant gloss was wrong.

⭐ **How the mis-reading happened — the reusable half.** The probe was
`substring(prosrc from position('on conflict' in prosrc) for 600)`. The `do update` list is longer
than 600 characters and `expires_at` sat just past the cut, so the **window's edge was read as the
statement's end**. **A fixed-width `substring(… for N)` is a WINDOW, not a delimiter — the absence of
a token inside it is not absence.** It is the "text is not truth" family one level down: the catalog
*was* the source, and the *framing* of the query still produced a confident inversion. Note the
direction — it under-reported a live widening, i.e. it failed in the urgency-suppressing direction,
which is the same direction as the `case_referrals` flag-description scar. Ask of any extraction
probe: *could my answer be an artifact of where I cut?*

### ✅ FUP-QO-1 — RESOLVED 2026-08-07 (backend, F1; PO ruling D-FUP-1) — `p_expires_at` seam limits, deferred to Phase C (2026-08-06, backend; consumer: **D14 break-glass**)

**Resolution — migration `20260912000000`, ADR [0102](docs/decisions/0102-extend-on-regrant-expiry-seam.md).**
Both limits closed inside `app.grant_role_impl`: the targeted `on conflict … do nothing` became
`do update set expires_at = coalesce(excluded.expires_at, memberships.expires_at)`, and the
commission-tier atomic replace now writes `expires_at = coalesce(p_expires_at, expires_at)`. The
value is **absolute, not a ratchet** (a shorter argument shortens — D14 must be able to close a
window early). **NULL = LEAVE UNCHANGED**, decided by a caller sweep rather than symmetry: **no
production caller passes the argument**, so "NULL clears" would have made every ordinary member-add
and promotion silently strip a deliberately-set expiry.

⚠ **The recorded sweep was RE-CUT 2026-08-07 (QA R2), and the ruling SURVIVED.** It first read
"all three production callers" and named `admin/actions.ts:285`, `members/actions.ts:235`,
`org/actions.ts:618` — the output of a `rpc('grant_role'` grep, a boundary drawn by **syntax**, which
missed the `_for` twin entirely. Bounded by the PROPERTY "reaches `app.grant_role_impl`" the set is:
**3 public doors** (`grant_role`, `grant_role_for`, `appoint_technical_director`); **5 further SQL
functions** through them (`add_pqs_member`, `assign_org_admin`, `assign_hospital_admin`,
`assign_nsp_org_admin`, `assign_nsp_coordinator`); **9 TS RPC sites** — `admin/actions.ts:285` ·
`members/actions.ts:235` · `org/actions.ts:581` + `:618` · `platform/actions.ts:210` + `:247` ·
`pqs/actions.ts:65` · `users/actions.ts:714` + `:949`. **None of the 9 passes `p_expires_at`.** The
ruling therefore holds on a population 3× larger — and now includes the two platform-provisioning
sites, which would have been the worst place to clear an expiry silently. Third instance this
workstream of the recorded rule: **an enumeration's boundary must be the property, not a syntax**
(the others: F2's error-code detector, the case-sensitive diff-derivation grep).

**Rule 11 companion, and it is the part worth reading.** `app.trg_audit_memberships`'s UPDATE branch
is if/**elsif** and `role_changed` **wins** over `expiry_changed`. Harmless until now, because the
replace path never touched `expires_at` — the change to that path is precisely what turned a dormant
asymmetry into an unaudited write of a security control. `role_changed` now carries
`expires_at_before`/`expires_at_after` when (and only when) the expiry also moved. Metadata only.

**Evidence.** `306` recut 37 → 45; the six new/flipped keystones were **observed RED before the
migration** (6 of 43, all 43 ran — no abort). `supabase/tests/mutation/f1-expiry-seam-audit.sh`:
**6/6 RED-PROVEN**, control all green (45 ran). Three of those six (`ratchet`,
`drop_insert_coalesce`, `drop_replace_coalesce`) leave the headline assertions 4.6/4.13 GREEN — the
NULL semantics and the not-a-ratchet property would have been unpinned without them.
`292` §2.1's singleton **survives unrecut** (re-verified: the `string_agg` still reads exactly
`app.grant_role_impl`); §2.2 was **honestly recut** — the door now matches the `set expires_at` half
too, so the positive twin asserts the NAMED SET rather than `count = 1`, since `2` would also be
satisfied by an unrelated third writer. BEFORE/AFTER catalog snapshots identical property-for-property
(`create or replace`, unchanged signature). Divergence from the sibling PHI door filed as **FUP-QO-7**.

<details><summary>Original entry (the two deferred limits, for the record)</summary>

M3 (`20260911000200`) added the D9 expiry SETTER to the grant chain; enforcement was already
universal. Two behaviors are **deliberately deferred**, lead-acked at plan approval, and — because
Phase C's break-glass (ADR 0100 D14) will ride this exact seam — each is pinned **executably** in
pgTAP `306` §4 rather than in prose (a changed behavior must red the suite, not surprise D14):

- **Re-grant does not extend expiry.** An identical (principal, role, org, hospital, commission)
  grant with a NEW `p_expires_at` hits the **targeted** `ON CONFLICT … DO NOTHING` and leaves the
  existing row's expiry untouched (`306` 4.5/4.6). Break-glass "extend the window" therefore needs
  its own door decision in Phase C (revoke+regrant, or a widen of the conflict clause).
- **The commission-tier atomic-replace UPDATE path does not write `expires_at`** (`306` 4.13) —
  a role change keeps the ORIGINAL expiry and ignores the new argument.

Also recorded: `292` §2.1 now pins `app.grant_role_impl` as the **only** `expires_at` writer
(singleton set, both directions).

</details>

### ✅ FUP-QO-3 — RESOLVED 2026-08-07 (backend, F3, `bac7821`) — two vacuous `a2` mutation cases: the audit's coverage claim is overstated (2026-08-06, backend; lead-ratified file-don't-fix)

**Resolution.** Neither case deleted; both RETARGETED onto `241` (the summary-masking lane, where
`read_case_deliberation` is still the gate — `app._project_meeting_case` masks `summary`) plus `241`'s
direct `has_case_capability` PRE probe, on the m5/m6 precedent. `run_case` now takes a per-case source
file, and the CONTROL runs once per targeted suite (a red in a file whose control never ran is not
evidence). **`a2` reads 12/12 RED-PROVEN**, and each retarget was inspected line by line rather than
trusted from the verdict column: `drop_member_default` → `have: false / want: true` (the capability
genuinely vanished) **and** `have: NULL / want: RESUMO_CD` (the masking surface genuinely masked);
`member_ignores_visibility` → `have: true / want: false` **and** `have: RESUMO_EG / want: NULL` (the
over-grant genuinely leaks the sub-group summary to a plain member). 16/16 tests ran under both
mutations — no abort; controls all green (234: 54, 241: 16).

Found while re-running the sibling audits after QO·A M4. `a2-mutation-audit.sh` reads
**10/12 RED-PROVEN**; the two others are **stale since Gate 2 C1** (2026-07-17,
`456d008` — zero diff on the QO·A branch, proven):

- **`K8 member_default` is VACUOUS**: its expected-red positive reads `meeting_cases`,
  which C1 made **member-wide** — the read no longer routes S5's
  `read_case_deliberation`, so dropping the member arm reds nothing. A detector
  reporting coverage it does not have (same class as "a detector that finds nothing
  must be proven able to find something").
- **`Kv member_ignores_visibility` is UNANCHORED**: its expected-red string
  ("reads NO ata section for the explicit_grants_only case") no longer exists
  anywhere in `supabase/tests/` — C1's rewrite of `234` deleted the K8-twin it
  targeted. The harness reports ABSENT, which is the tri-state doing its job.

**Until retargeted, read `a2`'s coverage claim as 10/12, not 12/12.** Needs its own
retarget unit on the m5/m6 precedent (relocate the discriminating power — e.g. the
S5 deliberation proof onto a surface that is still deliberation-gated post-C1, such
as the `241` summary-masking lane or a direct `has_case_capability` probe) — never
delete the cases without replacing what they proved.

### 🟡 FUP-QO-6 — the oversight toggle intermittently fails to confirm within 10 s; DB-vs-UI **unclassified** (2026-08-07)

Found by `tester` once its restore check stopped trusting optimistic client state. **Pre-existing —
not introduced by QO·A, and invisible until now BY CONSTRUCTION**: the previous check read
`CommissionOversightToggle`'s optimistic value, which updates synchronously before the server action
starts, so it reported success every time regardless of what the server did. Making the check honest
is what surfaced this.

**Signature (consistent, ~3 failures in ~13 early attempts, ≈23%):** a failing run takes **~11.5 s**
against **~2.5–3.0 s** on a pass — the reload-based assertion burning its full 10 s timeout. So the
confirmation is *not* being read too early; the state genuinely is not observable within the window.

⚠ **The decisive fact is NOT established.** At the moment of failure, is the DB correct with the page
stale, or **did the write never land**? That distinction is the whole severity question: stale UI is a
known annoyance here, but an intermittent write failure means **D9's governance control silently
no-ops ~1 in 4 times** and an admin would believe a committee is under oversight when it is not.

A bounded diagnostic (15 isolated runs + an out-of-process ~1.4 s DB poller, 216 samples) came back
**15/15 PASS — unreproduced**. The only `excluded` readings were the expected mid-test transients of
passing runs. `tester` stopped at the bound rather than extending, and reported the absence of the
fact instead of manufacturing one.

**The streak is itself evidence.** P(0 failures in 15 trials) at a constant 20–25 % rate is ~1.3–3.5 %.
The likeliest reading is that failures **cluster with environmental contention** rather than being
independent per-trial draws — the diagnostic ran isolated and unloaded. Consequence for the gate:
`RETRIES=1` retries moments after the first attempt, i.e. under the *same* conditions, so the naive
~6 % residual-spurious-red figure is an **optimistic floor, not a ceiling**.

⛔ **Do not "fix" this by raising the timeout** — that hides precisely the question above. Next step is
to reproduce under **load** (during a full `e2e:prod` run, not in isolation) with the out-of-process
poller attached, then classify. In-browser instrumentation is useless here: it perturbed the measurement
(6/6 green with logging on, recurrence once removed).

**F6 result (2026-08-07, tester, under real full-gate load): still NOT REPRODUCED.** `quality-oversight.spec.ts`
ran once inside the full `e2e:prod` gate (batch 16, 87-file suite, `RESET=1`); all 4 D9/D10 toggle tests
passed clean — WRITE PATH 1.5s, READ PATH 1.6s, D10 WRITE 1.3s, D10 READ 1.9s, none near the ~11.5s
failure signature. The out-of-process DB poller (docker-exec psql against `commissions.quality_oversight`,
~1.2–1.6s interval, continuous 13:52:44–16:12:5x UTC, ~12,100 samples, 0 gaps) recorded **zero `excluded`
samples for `ccih`** across the whole batch-16 window — the WRITE-PATH test's flip + `finally`-block revert
completes faster than the poller's sampling interval, so this is aliasing (too fast to catch), not a
failed-to-flip signal; the DB row that WAS sampled around the test window read `visible` with a fresh
`updated_at` consistent with a clean, fast round-trip. Extends the non-reproduction streak to 15 isolated
+ 1 full-load run, 0 failures. **The severity question remains formally open** — this run did not supply
a failure to classify, and no classification is manufactured in its absence. Evidence + poller logs:
`docs/../PROGRESS.md` Test Run Summary (2026-08-07, "QO·FUP F6"); raw poller logs are in the tester's
scratchpad (not committed — out-of-band per the task's own instruction), `oversight-samples.log` /
`oversight-samples-resume.log`.

### ✅ FUP-QO-5 — RESOLVED 2026-08-07 (backend, F2) — t19 could MASK a real `anon` EXECUTE leak (2026-08-07)

Found by `backend` during QO·A's final estate run, surfaced rather than self-filed. **Out of scope for
QO·A; not a product defect; not caused by M10.**

The pgTAP estate first came back **FAIL** on `100_dashboard` t19 — *"no public function is
anon-executable"*, **have 1079, want 0**. On a **fresh `supabase db reset --local` the count is 0** and
everything passes. Something in the mutation-harness / door-sweep machinery leaves broad `anon` EXECUTE
grants behind in the session.

⚠ **The dangerous direction is the second one.** A spurious red is merely expensive. But the same
contamination means t19 — the invariant that **no public function is anon-executable** — can **PASS on a
genuinely regressed catalog** whenever it runs after a sweep, because the grants it would flag are
indistinguishable from the ones the harness left. An anon-executable door is close to the worst outcome
this codebase has; its guard is currently **sensitive to run order**, which is the same property that
makes a keystone vacuous.

Note the shape: this is a **test-environment side effect disarming a later assertion** — the identical
class as the QO·A finding where `record_recusal` succeeding earlier in a pgTAP file recused the principal,
flipped `is_case_excluded`, and made a later D7 keystone refuse through the *exclusion* arm while
returning the same SQLSTATE as the gate under test (see the `308` §6 header). Both are "the thing that
ran before quietly changed what the next assertion means."

⭐ **MECHANISM IDENTIFIED 2026-08-07 (`backend`) — it is NOT the sweep machinery.** Installing **`pgtap`
into `public`** is what does it: `create extension pgtap` (which the standalone single-file run workflow
performs) leaves **~1079 extension-owned functions anon-executable**, and t19 then fails. Measured both
ways: pgtap present → **1079**; after a reset that drops it → **0**.

That turns a vague hygiene item into a precise, cheap fix — **install pgtap into its own schema**, or have
t19 **exclude extension-owned functions** (join `pg_depend` → `pg_extension`). The latter is the more
honest invariant: t19 means "no *first-party* public function is anon-executable", and it should say so
rather than counting a number that a test dependency can move.

✅ **RESOLVED 2026-08-07 (backend, F2, `bac7821`).** t19 now counts **first-party** functions only,
excluding extension-owned ones by PROPERTY (`pg_depend.deptype = 'e'` → `pg_extension`), never by name —
a `proname not like 'pg_tap%'` filter would be a syntax boundary and would go stale on the next
extension. The verdict no longer depends on run order in either direction. New **19c CONTROL** plants a
first-party anon-executable function and requires the SAME expression to move **0 → 1** (both share one
`pg_temp` helper, so the control cannot drift away from the assertion it proves); it plants-asserts-drops
rather than using a savepoint, because `rollback to savepoint` would rewind pgTAP's transaction-local
test counter. Verified BOTH directions: **22/22 with pgtap installed into `public`** (raw count 1079,
first-party 0) and **PASS via `supabase test db` on a fresh reset**. The "never trust a t19 result that
did not run on a fresh reset" caveat is retired.

### ✅ FUP-QO-4 — RESOLVED 2026-08-07 (PO ruling D-FUP-4: strip stays global; shipped scope label is the fix; A.9 stands) — KPI-strip scope vs. the chip filter

Found by `tester` while writing the A.9 chip-row extension — **by reading the source rather than writing the
assertion the lead's brief asked for.** The lead's coverage bullet ("the KPI strip and locked count recompute
per filter") does not match what ships, and the code is the thing that was right.

`QualityKpiStrip` and the locked-count note in `qualidade/page.tsx` are computed **server-side from the full
`commissions` array** and rendered as *siblings* of `QualityBoardView`, which is where the chip-selection
`useState` lives. No path exists for a chip click to reach either. Selecting a chip narrows **only the table
rows**; the strip stays the global aggregate over every oversight-visible commission. `QualityKpiStrip`'s own
docstring agrees ("derived entirely from `quality_board_summary` rows already loaded by the page").

**Ruled NOT a bug.** The strip is a context header ("how much do I oversee in total"); the chips are a table
filter. Making the strip recompute means lifting client state above a Server Component — an architecture
change — and **no ADR 0100 decision settles which scope is correct**. D10 specifies a cross-committee board
and PHI-free aggregates; it is silent on filter interaction.

⚠ The user-visible consequence, and the reason this is logged rather than dropped: once two commissions are
oversight-visible, a reviewer can see **"Casos visíveis: 6" directly above a table showing one row.** Both
numbers are correct; together they read as contradictory. A presentational label clarifying the strip's scope
was explored as a near-zero-cost mitigation (lead → `frontend`, 2026-08-07) with a hard instruction to stop
if it needed anything beyond a text change.

Pinned executably: A.9 asserts the strip and locked count stay **constant** across chip selections. That is
deliberate — if someone later makes the strip recompute, the test notices. **Post-pilot PO decision**; if the
ruling flips, that assertion is the thing to update, not delete.

### 🔴 FUP-QO-2 — a non-commission-scoped role lands on "sem acesso": THIRD recurrence (2026-08-06, lead)

Found by `frontend` during QO·A planning, **verified by the lead against the live code**, and in scope
for QO·A only as a one-instance fix — **the class is open.**

`src/app/page.tsx` routes a signed-in user through platform_admin → org_admin → hospital_admin →
nsp_org_admin → `context.memberships` (commission-scoped) → technical_director → `NoAccess`. Any
principal whose authority is **hospital- or org-scoped with `commission_id NULL`** is stepped over by
every branch and lands on "Você ainda não tem acesso" — an account that looks unprovisioned while
being fully provisioned. `quality_reviewer` is exactly that shape.

⚠ **This is the third instance of one failure.** The first was BUG-HAT-001; the second was the Diretor
Técnico, patched after the fact by ADR 0094 W4 — and that patch's own comment, still in the file at
`src/app/page.tsx:103-111`, states the mechanism outright: *"The office confers no membership, so every
branch above steps over it and the account looked unprovisioned."* The lesson was written down, in the
right file, and did not prevent recurrence three months later. **Prose in a comment is not a guard.**

Note the near-miss: QO·A's own plan (§A.3) did not list `src/app/page.tsx`. Had the teammate not read
the routing chain unprompted, `quality_reviewer` would have shipped as recurrence three *undetected* —
the pilot's primary daily user, unable to log in to anything.

Proposed scope (post-A): a guard that cannot be forgotten — e.g. a test that enumerates
`memberships_role_check`'s role list from the catalog and asserts each role resolves to a landing route,
so a **newly added role with no home fails the suite** rather than failing the user. The enumeration's
boundary must be the role list itself, not a remembered list of routes. Same class as FUP-AFF-3 below;
relates to ADR [0079](docs/decisions/0079-authz-door-blindness-standing-invariant.md)'s
standing-invariant discipline.

**GUARD BUILT 2026-08-07 (backend, F4, `49883c2`; ADR
[0101](docs/decisions/0101-role-landing-guard.md)) — `src/lib/queries/session-grants.test.ts`.** It
enumerates `memberships_role_check` from `pg_constraint` at test time (the derivation `292` §3 already
uses) and drives **both** seams for real: the role partition, extracted behaviour-identical into a pure
`src/lib/queries/session-grants.ts` so it can load without `next/headers`, and then the **unmodified
default export of `src/app/page.tsx`** (only `getSessionContext` / `signOut` / `next/navigation.redirect`
stubbed; `@/lib/routing` stays real). Nothing is re-implemented. Red-proven: neutralising the
`quality_reviewer` arm of `partitionGrants` reds exactly that role's case; restoring it returns 12/12.
Two vacuity controls ship with it — a synthetic role the catalog does not admit must report NoAccess, and
the routed roles must not collapse onto a single landing URL. It **fails loud** when the stack is down
rather than skipping.

⛔ **THE GUARD FIRED ON ITS FIRST RUN — the class is at FIVE instances, not three.**
**`nsp_coordinator` and `pqs_member`** are hospital-scoped with `commission_id NULL`, have **no
`partitionGrants` filter at all**, and are therefore stepped over by every branch in `page.tsx`: a
principal holding only one of them gets an all-empty `SessionContext` and lands on "Você ainda não tem
acesso". Pre-existing, not introduced here. Held in the test's `KNOWN_UNROUTED` **ledger**, which is
asserted in BOTH directions — an unlisted unrouted role reds, and a listed role that starts landing also
reds — so it cannot be silenced by leaving it alone. **The remaining fix spans `src/app/page.tsx`
(frontend-owned) and one `partitionGrants` filter (backend); it is NOT done.** Needs a lead/PO call on
where a pure `nsp_coordinator` / `pqs_member` should land (the NSP console under `/o/<org>/nsp` is the
obvious candidate) before either half is written.

### 🟡 FUP-QO-9 — the e2e:prod gate's infra classifier misses two PGRST002 shapes (2026-08-07, tester→lead; owner: backend / `scripts/e2e-prod-gate.sh`)

Found during the QO·FUP F6 gate run (2026-08-07, GATE RED 924/5/5/12). A **PGRST002
schema-cache-not-ready race right after `db reset`** hit batches 3 (self-healed), 12 and 17
(each failed + cascaded 6 did-not-run); batch 4 crashed outright at 42 s / exit 127 / **0 tests**.
Two classifier gaps, neither a product defect: (a) PGRST002 ("Could not query the database for
the schema cache") is not recognized as INFRA, so those batches are not auto-retried; (b) the
infra check requires `failed>0`, so a zero-test crash slips past both the auto-retry and the
connection-error counter — an unrun batch that only the denominator check catches. Fix shape:
teach the classifier both signatures (and/or have the reset path wait for PostgREST schema-cache
readiness before starting a batch). The lead relayed the diagnosis; tester deliberately did not
edit the script (not its file).

### 🟡 FUP-AFF-3 — pin door ACLs by DERIVING the door set, not by remembering it (2026-08-06)

Raised by `backend` at AFF close-out, and it is the **class** behind QA's N2. `302` §1's ACL
assertions covered "the doors that existed when §1 was written"; `log_cpf_probe_for` arrived two
commits later and **inherited nothing** — its ACL is its *entire* boundary (it fronts nothing, it
writes one audit row), so the one property most worth pinning was the one unpinned. Fixed for that
instance in `304` §9; the class is open.

⚠ **This is the third and fourth instance of the same failure inside one workstream** — the others
being F2's error-code detector (bounded by a 5-char syntax, so it could not see `check_violation`)
and `backend`'s own case-sensitive diff-derivation grep (which listed 1 of 4 changed gates, because
`pg_get_functiondef` emits uppercase — ADR 0079 Amendment 5a). Every instance is the recorded rule:
**an enumeration's boundary must be the property, not a syntax and not a remembered list.**

Proposed scope: one assertion that derives the door set from `pg_proc` — every `public` `prosecdef`
function granted to `service_role` must **not** be executable by `authenticated` — replacing the
per-door transcription. Needs its own allowlist discussion (legitimate dual-audience doors exist),
which is why it was flagged rather than widened into AFF unasked.

### 🟡 FUP-AFF-4 — make the membership-role list a Postgres ENUM (2026-08-06)

Raised by `backend`, and it is the durable fix for N1. `memberships_role_check` is a `CHECK` over
`text`, so the role list reaches **no** generated type (`grep technical_director_deputy
src/lib/types/database.ts` → 0 hits) and **no unit test can see the authority**. N1's remedy is a
committed fixture with a gate at each end (pgTAP `304` §10 ↔ fixture ↔ the pt-BR label test) — which
closes the drift hole, but is a **build-time gate, not a guard**: widen the CHECK, never regenerate
the fixture, ship without `npm run test:db`, and an English snake_case identifier still reaches a
pt-BR `role="alert"` through `roleLabel`'s `?? role` fallback.

As an **enum**, the list lands in `database.ts` and `tsc` enforces exhaustiveness — the check moves
from "a suite someone must run" to "the build". Deferred because it is a schema change with real
blast radius (`memberships_scope_shape`, every `role` comparison, the ADR-0094 completeness grid).
Decide before the role set next changes, not after.

### 🟡 FUP-AFF-2 — D7's "documented escape for a foreign professional" is unreachable (2026-08-06)

Raised by `backend` at W3 close-out. ADR 0097 **D7** makes `profiles.cpf` nullable *specifically* so a
foreign professional without a CPF can be registered "without a later schema change" — and then
requires CPF **at the action layer**. W3 implemented the requirement (correctly: without it the
identifier-first flow creates people no later CPF lookup can find, and the feature is inert on exactly
the population it exists for). **Net effect: the nullable column's escape has no product path.**

That is D7's own design, not a defect, and it is the right default — but it is recorded here because
the day the first customer has one foreign professional it becomes a real gap, and the fix should be a
**deliberate "sem CPF" affordance** (audited, org_admin-only, with the person still findable by name)
rather than a panicked schema change. Blocks nothing. Decide before the pilot onboards clinical staff,
not after.

### 🔴 FUP-AFF-1 — the authz census is BLIND to write-path doors (2026-08-06, lead)

Recorded as ADR [0079](docs/decisions/0079-authz-door-blindness-standing-invariant.md) **Amendment 5**.
**Does not block AFF** — but AFF's gate record must **not** cite `ARM=census` as coverage for its
affiliation doors; it must cite `302_affiliation_doors.sql`'s mutation-proven keystones, which do
cover them in substance.

Found when `backend` noticed a diff-scoped `ARM=policy` run reporting **0 BLIND over five brand-new
DEFINER doors having swept none of them** — the boolean arm printed empty because they return
`uuid`, not `boolean`. The hole is wider than the observation, measured from the live catalog:

- **ARM 3's LIVE domain** is `prosecdef` functions that return `bool` **or** are set-returning +
  `authenticated`-executable, plus all RLS policies. A **scalar/void-returning write-path door is in
  none of those sets** — so `ARM=census` reports HOLDS **because the door is invisible, not because
  it is accounted.** That is Amendment 3's vacuity, recurring in a shape its own filter cannot express.
- **ARM 1's write-path sweep exists and is the right harness**, but its domain is **two frozen
  enumerations** — a hand-written list of **7** named raise-guards and a **captured snapshot** of 33
  write policies embedded in the script. Nothing added since has ever entered it. ("A remembered-doors
  allowlist is blind in exactly the case that matters" — now at the harness level.)
- **Measured blast radius:** filtering by the *property* instead of the return type — `prosecdef`,
  `authenticated`-reachable, scalar/void, comment-stripped `prosrc` both naming an identity primitive
  **and** raising `42501`/`HC*` — yields **201** functions. **6** are named in any findings report.

⚠ **Not a claim that 201 leak.** Most are covered in substance by keystones asserting through them.
The claim is narrower and worse: they carry **no sweep verdict**, and the arm whose whole job is to
detect a missing verdict cannot see that one is missing. Two caveats so the fix doesn't inherit a
false premise: the 201 is a regex *candidate* set, not a classification (`--` comments stripped,
`/* */` not), and the class is **not per-function** — AFF's gate lives in an owner-only kernel
(`app.*_impl`, ACL `postgres=X`) while reachability lives in its `authenticated` wrapper, whose body
names no identity primitive, so a per-function domain misses that door **from both ends**. The domain
has to follow the call edge, which is why this is harness work and not a filter tweak.

Scope when scheduled: derive the write-path domain from the catalog by the property (following the
wrapper→kernel call edge), fold it into ARM 3's LIVE set, and give `p0-authz-writepath-audit.sh` a
derived worklist in place of its two frozen enumerations. ⚠ **Dry-run the detector against a
hand-classified sample before believing it** — Amendment 4's harness reported 0 guards in all 45
doors and was completely wrong, and "no write-path door needs a verdict" is exactly as coherent a
false result.

_Closed 2026-08-04, rotated → [follow-ups-archive.md](docs/progress/follow-ups-archive.md):_
**FUP-P16-1** (14 never-called doors failing the ADR 0079 floor — RESOLVED; `ARM=floor` now reports
`INVARIANT HOLDS`, nothing was allowlisted, and writing the positive twins found **3 doors whose
AUTHORIZED path could never succeed**. ⚠ Keep the mechanic: `pg_stat_user_functions` does not count a
call that raises, so **a deny-only keystone cannot clear the floor** and a permanently-throwing door
reads as *never called* rather than *failing*) · **FUP-P16-3** (`copy_version_children` temp-table
concern — INVESTIGATED, **not a bug**; ⚠ confirming a *pattern* is present is not confirming the
*defect* is present).

### 🔴 FUP-PCITV-1 — PCI + TV: what QA APPROVED **over**, ranked (2026-08-05)

QA r2 approved with 7 items open. None blocks the merge; **two block a clean deploy story** and are
called out in the Phase Status caveats above. Owner: unassigned unless noted.

| # | Sev | Item |
| - | --- | ---- |
| 1 | ⬛ | ~~**`ARM=census` never run**~~ **CLOSED 2026-08-05** — the arm landed with the membership-hardening merge and was run against the merged catalog. It found real debt, not nothing: `process_template_versions_{select,staff_admin_write}` carry **no verdict from any sweep**. TV swept and keystoned the six CHILD policies on `process_template_{phases,narratives,outcomes}` (`dcc5a4d`) and not its own PARENT table's two — *a new door must inherit every sibling arm*, one level up. Registered as `gate:` debt in `authz-unswept-backlog.txt`. The ghost-check also named all five `validate_template_*` signatures ADR 0096 re-keyed to `p_template_version_id`. |
| 2 | ⬛ | ~~**TV backfill never exercised** — rehearsal + snapshot blocking before `db push`.~~ **CLOSED (PO, 2026-08-05): the remote is EMPTY**, so the backfill meets 0 rows there exactly as it does locally. Not blocking. See the Phase Status caveat for the mechanism (which recurs) and for the unverified-premise error that produced this row. |
| 3 | 🟡 | **Revoke residue** — `authenticated` still holds `TRUNCATE` on **66 tables**; TRUNCATE bypasses RLS entirely. Unreachable via PostgREST *today*. ⚠ This phase set its own standard by **refusing the "unreachable" argument** in `20260906000600`, so it should be swept or accepted **in writing** — not left implicit. |
| 4 | ⬛ | ~~**BUG-RCA-001**~~ **CLOSED 2026-08-05** — PO ruled the interview's date is the **earliest session's `scheduled_start`**; fixed, PostgREST-verified, and the ruling pinned by `rca.test.ts` (5 cases, mutation-proven per arm). See the Bug Log. |
| 5 | 🟢 | Audit mesh **2 of 7** trigger arms keystoned (`20260906000200`). |
| 6 | 🟢 | The `is_commission_admin_of` disjunct in the 6 new tenant-isolation keystones is **unexercised** — no org-admin persona exists in the test bootstrap. Adding one lifts several suites at once. |
| 7 | 🟢 | `compute_case_phase_result` / `sync_case_phase_on_submit` still force the `in_case_rpc` GUC off (fails **closed**). · Resolver error semantics: helpers now log, but still collapse "not found" and "query failed" into one return — the discriminated-union refactor was deliberately deferred as too risky post-green. |
| 8 | 🟢 | **A FIFTH rebuild-property-loss, inside the migration written to close that class.** `20260907000700` recreated 10 policies on the 5 re-keyed relations **without the `TO authenticated` clause the originals carried** (`20260821000000` wrote `for select to authenticated`; the swap wrote bare `for select`). Platform split is **256 `{authenticated}` vs 11 `{public}` — and 10 of the 11 are these** (the 11th, `case_referral_delete_draft_source`, pre-dates the phase). `20260907001200` caught the ACL and `DEFERRABLE` losses and missed this one. **Verified INERT, twice:** `anon` holds **0 table grants on the 5** — and **0 anywhere in `public`** — so a bare policy still only ever evaluates for roles that either carry `BYPASSRLS` or cannot reach the table. Not a vulnerability; a latent widening if `anon` is ever granted anything. Normalize when one of these policies is next touched. ⚠ Same standard-consistency point as row 3: this phase refused the "unreachable" argument in `20260906000600`. |

| 9 | ⬛ | ~~**`296` suite-number COLLISION between branches.**~~ **CLOSED 2026-08-05** — resolved during the merge, not before it: the branch had committed by then, so it came through as a two-file collision on one number. Renumbered to `supabase/tests/298_authz_p0_isolation.sql`, with the Batch-4 runner in `p0b-isolation-mutation-audit.sh` following it. (A third collision was then created and caught in the same session — `299_hospital_content_door_noun_rule.sql` was first written as `284_`, which `284_accreditation_hospital_readiness.sql` already held. Check the directory before picking a number.) |
| 10 | 🟢 | **PROGRESS.md is 105 KB against the <60 KB target** (CLAUDE.md §7 — every spawn pays for it). This phase's rotation took it from 111.6 KB, so the trend is right but the gap is not closed. Next rotation should take the `📋 Remaining pre-pilot work` and closed-bug sections. |

**Landed, no longer a recommendation:** the PostgREST **embed sweep** built during this phase now
lives in the repo at **`scripts/extract-embeds.mjs`** + **`scripts/probe-embeds.mjs`** (moved out of
a session scratchpad that was about to be deleted — the earlier revision of this line pointed at a
path that would not have existed, which reads as "saved" when it is not). It found BUG-TV-001 *and*
BUG-RCA-001 mechanically across 284+ call sites. **Still needs a `package.json` entry point** — it
cannot join `npm run lint` because it requires a live local Supabase, and `probe-embeds.mjs` refuses
any non-local URL by design.

The generalisation that justifies keeping it: **ADR 0096 A1.5's grep sweep could not have caught
BUG-TV-001, because that site names no dropped column — it names a relation that is no longer
*reachable*. After a column drop, sweep the embeds the column ENABLED, not just the column.**

⚠ **Deferred by decision, not oversight** (ADR 0095 §3): `blocks[]` → join table; the
`case_phase_offered_results` rename.

### 🔴 FUP-ETH-1 — NOTHING can seat a professional: "Médico denunciado" is an unfillable panel (2026-08-05)

ETH·E3a shipped the primary-subject rail card ([`case-primary-subject-panel.tsx`](src/components/cases/case-primary-subject-panel.tsx),
rendered by [`case-detail-view.tsx:352`](src/components/cases/case-detail-view.tsx:352) when
`case_types.primary_subject_kind ∈ {professional, entity}`). With `ethics` + `case_participants` +
`case_types` all flag-ON, **an Ethics case in production will show that panel in its empty state
forever** — no product path fills it. Found by the PO asking how a professional gets included; the
answer is that they cannot. Verified against the **live catalog** (`pg_proc` / `pg_policies` / grants /
`pg_trigger`), not migration text.

Seating a respondent needs four rows. **Two have doors; two have none:**

| Row | Door | |
| --- | ---- | - |
| `professional_profiles` | `create_professional_profile` (DEFINER) | ✅ |
| `participants` (`participant_type='professional'`) | — | ❌ **no writer exists** |
| `professional_participants` (the link) | — | ❌ **no writer exists** |
| `case_participants` | `add_case_participant` (DEFINER) | ✅ |

**This is a hole in the substrate, not just missing UI.** A `pg_proc` sweep for `insert into
participants` returns **exactly one** function — `set_participant_patient`, the patient lane;
`create_professional_profile` writes `professional_profiles` **only** (no `participants` row, no
trigger creating one — `professional_profiles` carries one trigger, `guard_professional_linkage`,
unrelated); nothing anywhere INSERTs `professional_participants` outside [`seed.sql:2592`](supabase/seed.sql:2592).
All four tables are **SELECT-only** for `authenticated` (no INSERT grant, no INSERT policy), so there
is no direct-DML fallback. `add_case_participant` therefore demands a `participants.id` that no door
can mint for a professional.

⚠ **The TS layer is still the BE-1 contract stub, and its docblock says otherwise.**
[`src/lib/participants/actions.ts`](src/lib/participants/actions.ts) — all 7 actions
(`addCaseParticipant`, `removeCaseParticipant`, `setPrimarySubject`, `setCaseParticipantRole`,
`createProfessionalProfile`, `updateProfessionalProfile`, `setProfessionalLinkState`) call
`notImplemented()`. The file says *"Bodies land in BE-5"*; **BE-5 (`9180a27`) shipped the SQL RPCs +
regenerated `database.ts` and never touched it** — the file has two commits ever, both stub-authoring.
The E1 review's ✅ on D6 is about the RPCs, and is correct at that scope. **Zero callers** of any of
the 7 exist in `src/` or `e2e/`; there is no `src/components/participants/`. The panel's own docblock
is honest (*"the full participants roster … not built here"*), as is [`queries/cases.ts:450`](src/lib/queries/cases.ts:450)
(`[]` until BE-7). Sequencing debt, not a regression — but **`grep` for the RPC name says "built" and
the product says "unreachable"**, which is the §7 "text is not truth" shape.

**Corroboration that no path exists:** [`ethics-e3a-surfacing.spec.ts`](e2e/ethics-e3a-surfacing.spec.ts:298)
seats every respondent with raw `dbInsert('case_participants', …)` — three sites. A spec that must
bypass the product to reach a shipped panel is the tell.

**To close (backend-owned; contract-first):** ① a DEFINER door minting `participants` +
`professional_participants` for a professional, mirroring `set_participant_patient` (⚠ it must preserve
the surrogate-label property ADR 0091 §O pins) · ② fill the 7 action bodies, reads via `src/lib/queries/`
(Rule 9) · ③ a roster surface on the case detail page (add / remove / set-role / set-primary) · ④ **the
link-state flow, or ③ dead-ends**: `app.assert_respondent_linkage_resolved` rejects an `unknown`-linkage
profile from `respondent_doctor` with `HC0F0`, and `setProfessionalLinkState` — the only remedy — is
one of the stubs.

**Two adjacent seed-only gaps, same shape** (both plausibly in scope): `case_participant_roles` has an
admin-write RLS policy but **no RPC and no UI** — the 7 roles, incl. `respondent_doctor` → "Médico
denunciado", exist only because `seed.sql` wrote them; `case_type_terminology` has **no writer at all**,
so the 5 label slots cannot be edited in-app on any tenant.

▶ **Feeds FUP-FF5-2.** That row asks for an assertion pinning the `participants` writer set by count
*and* name. Today's catalog answers **one** (`set_participant_patient`) against ADR 0091's prose claim of
*"exactly two functions"* — so the assertion should be written from the catalog, and the discrepancy
resolved as part of writing it, **not** from the ADR's number.

### ⬛ Resolved — rotated 2026-08-06 → [follow-ups-archive.md](docs/progress/follow-ups-archive.md)

FUP-MEM-1 (indicator doors: not a defect) · FUP-MEM-2 (`assignOrgAdmin` door) · FUP-AUTHZ-2
(15 BLIND gates) · FUP-BULK-1 (suspended members) · FUP-MEM-3/3b (DT referral plane + inbox) ·
FUP-A11Y-1 (`useFieldIds` → `useId()`) · FUP-AUTHZ-3 (45 row-returning DEFINER doors swept) ·
FUP-AUTHZ-4 (BLIND allowlist pruned). Full resolution bodies in the archive.

### 🟡 FUP-P16-4 — 10 files carry the pluralization pattern that shipped two bugs (latent, safe today)

Found 2026-08-04 while closing QA's INFO. Outside `src/components/accreditation/**`, ten files still
build plurals by suffix concatenation (`? "" : "s"`): `manage/cases/page.tsx`, `bulk-step-deal.tsx`,
`bulk-step-members.tsx`, `case-bulk-grid.tsx`, `create-wizard.tsx`, `checklist-section.tsx`,
`notification-bell-client.tsx`, `cases-kpi-strip.tsx`, `triage-queue.tsx`,
`orphan-warning-dialog.tsx`.

**Every word each one pluralizes was checked individually and all are regular pt-BR** (concluído,
linha, coluna, selecionado, caso, lida, atrasado, novo) — a bare `s` is correct for all of them, so
**there is no live defect**. Left untouched deliberately: Phase 16 was at its gate, and the risk is
structural, not present.

⚠ **The risk is the shape, not today's words.** This is exactly how `padrãoes` and `em atençãos`
shipped — the pattern was correct until someone added a word ending in `-ão`. Migrating these to
`plural(count, one, many)` (`src/components/accreditation/format.ts`) removes the trap rather than
relying on every future author noticing it. An ESLint rule banning `+ "s"` was **considered and
rejected** for now: it false-positives heavily against ordinary string concatenation and would need
real tuning — shipping it half-tuned for an INFO-level item would be worse than the JSDoc steering
the helper already carries.

### 🟡 FUP-P16-2 — two accreditation reads live in `actions.ts`, not `queries/` (Rule 9)

`getStandardAssessmentDetail` and `searchEvidenceCandidates` are **reads** in
`src/lib/accreditation/actions.ts`. This is debt from **BUG-P16-002**, not a design choice:
`src/lib/queries/accreditation.ts` was still throwing `not implemented` when frontend needed them,
and frontend correctly refused to edit a backend-owned file. Now that the query layer is real,
route both through `src/lib/queries/` per **Architecture Rule 9**. Backend owns the move; frontend
must not do it unilaterally.

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

Three **known gaps** + two QA Minors, all the same class — *pre-existing scope decisions E1 does not own*, made
**visible** by E1's stricter access model. QA and `backend` independently judged each out of E1's scope; the PO
agreed and routed all of them to **ETH·E2**. **Full reasoning, measurements and the QA quotes →
[eth-e1-access-spine.md §4](docs/progress/eth-e1-access-spine.md)** (detail rotated there 2026-08-04; titles +
owners kept live here).

- [ ] **GAP-E1-1 — `action_items` `assignees_only` arm never consults `can_read_case`** (a respondent who is also
  an `org_admin` could see an assignees-only item on their own case). `backend` at E2.
- [ ] **GAP-E1-2 — `patient_safety_event` has no case arm**; residual is **link-existence inference only** (the
  event carries its own incident narrative, not case deliberation). Gating it would rewrite the NSP/PHI-module-1
  model E1 doesn't own. `backend` at E2.
- [ ] **GAP-E1-3 — privileged-doc ceiling has no coordinator arm** (UX, not security: the coordinator who uploads
  a privileged doc must self-grant clearance to reopen it — correct per ADR 0072 D5). `frontend` at E2/E3.
- [ ] **MINOR-A — the generic leak sweep can pass VACUOUSLY** (10/14 covered, 4/14 vacuous). Fix: report zero-row
  tables as **uncovered** rather than silently passing them. `backend` at E2.
- [ ] **MINOR-B — `action_items` passes the sweep by FIXTURE ACCIDENT, not documented exclusion** — the moment
  someone seeds an `assignees_only` item it fails and reads as a regression. **Make it a decision, not an
  accident.** `backend` at E2.
- [ ] **participant-roles M2M (ADR 0072 D7·4) deferred to E2** — no §4 gate criterion covers it and its shape
  depends on E2's decision model; QA verified nothing half-built was left behind. `backend`.


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
