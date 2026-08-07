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
| **QO·A** | **Quality-office oversight — Phase A** (classification + `quality_reviewer` + UI) [0100](docs/decisions/0100-quality-office-oversight.md) · [plan](docs/plans/quality-office-oversight.md) — **pilot-blocking** | ▶ **in progress** (started 2026-08-06) | – | – | – | – | – | branch `feat/quality-office-oversight` (worktree) |

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

### ▶ QO·A — Quality-office oversight, Phase A · **IN PROGRESS (started 2026-08-06)**

ADR [0100](docs/decisions/0100-quality-office-oversight.md) (D1–D14 PO-ratified — **do not
re-litigate**) · plan [quality-office-oversight.md](docs/plans/quality-office-oversight.md)
(catalog-verified detail; **re-read every quoted body from `pg_get_functiondef` at authoring
time**). Built in the **worktree** `worktrees/feat/quality-office-oversight` on branch
`feat/quality-office-oversight`, based on `main` @ `13d8f5d`. **Migration window: allocate above
`20260910000400`** (302 registered == 302 files at branch time). **pgTAP window: `306`+.**

| # | Task | Owner | Status |
| - | ---- | ----- | ------ |
| A.0 | Catalog re-verification pass + migration plan (the plan's [V-CAT]/[INF] markers re-proven against the live catalog) | backend | ✅ 2026-08-06 — [buildnotes](docs/plans/quality-office-oversight-buildnotes.md): 34-row discrepancy table (2 plan claims **CHANGED**: dashboard deny = empty `return;` not 42501; pgTAP 270 does NOT go red under M5 — rewrite is a strengthening), HC0G0 fail-closed RED-proven by execution, M1–M7 versions `20260911000000`–`000600`, rebuild-loss strategy + 6 mutation cases + ~140-assertion testing note. **Awaiting lead plan approval before any migration** |
| A.1 | M1–M2 — `quality_reviewer` role substrate + `commissions.quality_oversight` + `set_commission_oversight` door + guard trigger | backend | ✅ 2026-08-06 — `20260911000000`/`000100` applied; red-first aborts/reds observed pre-apply; pgTAP `306` 37/37 + `307` 22/22. INSERT residual **CLOSED by lead ruling 2026-08-06** (M2 amended, local-only branch): the guard is now BEFORE INSERT OR UPDATE — outside the bracket a commission may only be born `'excluded'`; `307` 1.3–1.5 pin both directions; q1 `insert_arm_noop` REDs 1.3. **M8 `20260911000700` (post-probe lead ruling): the BYTES cut** — live-probed that S7 reached standard-tier case attachment BYTES via `attachments_obj_select_readable` → `can_read_case` (un-audited, PHI-capable, un-enumerated surface; `attachments-phi` probed CLOSED — zero SELECT policies); ONE policy arm: case/interview bytes additionally require `read_case_deliberation` (which every content source EXCEPT S7 confers — the pinned lattice invariant), so the reviewer keeps metadata (panel names) and reaches ZERO object rows while every pre-existing reader and the S3-granted-reviewer graduation path are untouched; `308` §5 pins all four directions, **5.2 observed RED on the pre-M8 catalog** (the gap as a failing keystone). **M9 `20260911000800`** closes the door-shaped hole M8 left (found by `frontend`): `open_attachment` is `prosecdef` and its action signs with the **service role**, so storage RLS never runs on that mint — the same conjunct now sits in-body (BUG-QO-001, Bug Log, with the honest M8-record amendment). **Referral doors probed, not read** — all four (2 RPCs + 2 storage policies) deny the reviewer with discriminating coordinator twins; one twin initially read 0/0 from a wrong fixture path (attachment-id in the referral-id slot) and was re-probed to 0/1. `createAdminClient()` sweep: `open_attachment` was the only user-reachable service-role sign. **`310` §4 adds the cross-committee board coverage IN-TRANSACTION** (lead ruling: the seed stays untouched — every route to a second seeded visible commission moves `171`/`189` isolation counts; the E2E half drives the real `set_commission_oversight` onboarding flow). **M10 `20260911000900` — the READ-ONLY PERIMETER (QA B1/M1/M2; PO ruling: exclude all three write doors, no carve-out).** Root cause, now a STANDING RULE in the migration header + ADR: *conferring a capability bit requires enumerating its CONSUMERS, not just its producers* — plan §A.2 had no such axis, which is why S7 leaked three times (M8 bytes, M9 door, M10 write+read families). Derived by PROPERTY (transitive closure over comment-stripped prosrc + pg_policies from `can_read_case(`/'read_case_content'/'view_case_overview' = 60 functions + 50 policies) then classified PER DOOR — load-bearing, since **11 of the 14** authenticated DML doors in the closure are safe for reasons only visible individually, so a blanket predicate would have broken eleven working doors. **Cut:** 3 write doors get an EXPLICIT `is_oversight_only_reader` exclusion (a read predicate is not automatically right for a write path); read families get `can_read_case_committee` (= can_read_case as it meant pre-S7) — Class-2 `professional_profiles`/`professional_participants` (Rule 12/D5), `can_read_interview` (7 tables), `can_read_action_item`, and **10** SELECT policies (votes + decisions + 7 ethics + `action_items`, whose case_restricted arm routes `can_read_case` DIRECTLY — a gap the migration first MISSED and keystone `311` §3.4 caught). `cases_select` deliberately NOT re-pointed (postcondition-pinned — that would revoke the feature). **§6.3 WAS VACUOUS — caught by the lead from my own tell** (`open_write_doors` reddened two doors but not the correction door; a keystone that does not red under its own cut is not pinning it). ⚠ The mechanism was NOT the corrector-designation path: my call already defaulted `p_permitted_corrector` to NULL. **`record_recusal` SUCCEEDED pre-cut and recused the reviewer FROM THE CASE**, flipping `is_case_excluded`, so every later assertion refused through the EXCLUSION arm and returned the SAME 42501 — state contamination between assertions in one file. Fixed: the correction door runs FIRST and the self-excluding door LAST; the target carries a completed status AND an assignee (a NULL assignee raises HC0M4 — a workflow refusal that never reaches the D7 gate); assertions pin the MESSAGE because the door raises 42501 at TWO sites; new 6.5 pins the OTHER raise (a non-admin content-reader designating a corrector) so the two paths cannot collapse unnoticed. **Behaviourally proven both directions on the seed:** pre-cut the reviewer FILED a real correction request; post-cut `42501 "você não pode solicitar correções neste caso"`. **RED-FIRST: `311` showed 11 REDs and `308` §6 2 REDs against the pre-M10 catalog** — every family leaks today, each on a fixture placed on a reviewer-readable oversight-VISIBLE case (not the locked one where the seed happens to put the profile — that placement is what hid the bug), every negative twinned. `308` 1.4 (the vacuous D7 pin — it asserted a bit NO admitting door consults) replaced by §6: per-door, refused-per-door, twinned. **PERF (§A.5 gate item — RECORDED HERE because a gate item that lives only in a chat message is not recorded; QA could not find it):** measured on the seeded fixture, fresh reset, as `authenticated` — `list_cases_board` reviewer **5.8 ms / 5 rows** vs coordinator 14.4 ms / 6 rows · `quality_board_summary` **10.6 ms** · member `cases_select`-shaped scan **5.4 ms** · reviewer `storage.objects` scan with the M8 per-row deliberation probe **35.7 ms / 18 case objects (0 visible)**. S7's cost is one `memberships_hospital_idx` probe + one `commissions` PK read per non-matching row, placed after the `not v_eg` short-circuit — inside the ~44 ms `list_cases_board` in-body baseline envelope. **FINAL ESTATE:** pgTAP **172 files / 5340 / PASS** fresh reset · q1 **17/17 RED-PROVEN** (restore md5 across 3 policy quals + 6 doors; **7 controls green**) · `ARM=census` + `ARM=floor` **HOLD** · typecheck ✅ lint ✅ vitest **1158/1158** · `database.ts` no diff (policy/body-only) · 311 migrations registered == 311 files |
| A.2 | M3 — `grant_role_impl`/`revoke_role_impl` quality arm + `p_expires_at` setter plumbing | backend | ✅ 2026-08-06 — `20260911000200`; DROP+CREATE ACLs re-established byte-identical (catalog-diffed); `292`/`293` recut to the new contract (expiry-writer singleton + grant-door-only expiry arg + role grid); w3/w4 harness signatures updated; FUP-QO-1 pins the two deferred seam limits executably (`306` §4) |
| A.3 | M4 — `_case_caps` S7 arm (+ BOTH stale comments incl. `_cap_bit`) · M5 — six aggregate dashboard doors + pgTAP `270` two-class rewrite | backend | ✅ 2026-08-06 — `20260911000300`/`000400`; needle-rewrite with single-replacement proof + 6/3 catalog postcondition; `308` 21/21 · `309` 15/15 · `270` 13/13 (two-class invariant + rebuild guard) |
| A.4 | M6 — three tenancy SELECT policy arms · M7 — `quality_board_summary` door · `gen:types` | backend | ✅ 2026-08-06 — `20260911000500`/`000600` (ALTER POLICY, quals diffed: one disjunct each; `is_org_level_admin_within` untouched, postcondition-pinned); `310` 16/16 (disjoint counts per ruling g; PHI-free shape pinned); `database.ts` regenerated (+22 lines, additive) |
| A.5 | Seed personas + oversight fixtures · pgTAP `306`–`310` · `q1-quality-mutation-audit.sh` (7 RED-proven incl. `arm_seventh_door`) · ARM gates + diff-scoped door sweep | backend | ✅ 2026-08-06 — seed: quality.a/.a2/.b + CCIH→visible (0-row-guarded DO bracket; first placement no-opped silently and now fails loudly); full pgTAP fresh-reset **171 files / 5297 / 1 red → fixed** (`304` §10 role-census tripwire → fixture chain extended: 304 + `membership-roles.json`); **q1 7/7 RED-PROVEN, RESTORE md5-verified, 5 controls green**; **`ARM=census` HOLDS** (445 gates / 454 verdicts — the 5 newcomers red-flagged first, exactly Amendment 3, then closed by the diff-scoped sweeps) · **`ARM=floor` HOLDS** (nothing added to any allowlist) · **diff-scoped sweeps, all hand-merged into the findings files per the MIN precedent:** door-audit 4 predicates + 2 policies COVERED, `commissions_select_member_or_admin` ERROR at whole-policy neutralization → covered ARM-SCOPED by q1 case 8 · writepath `set_commission_oversight` scoped into the frozen list (Amendment 5) + COVERED · rowdoor `quality_board_summary` + six armed doors COVERED · w3 8/8 + w4 8/8 RED-PROVEN post-M3 · a2 10/12 (**2 stale cases PRE-DATE this branch** — Gate 2 C1's member-wide meeting rewrite vacated K8-positive + deleted Kv's target string; 234 untouched here, reported to lead) · perf (A5-style, seeded fixture): reviewer board 5.8 ms/5 rows · board summary 10.6 ms · member scan 5.4 ms — inside the ~44 ms in-body baseline envelope |
| A.6 | `src/lib/queries/quality.ts` + `session.ts` `isQualityViewer` branch (contract-first: signatures posted before impl) | backend | ✅ 2026-08-06 — `quality.ts` (`getQualityBoardSummary` → `QualityBoardCommission[]`), `src/lib/quality/actions.ts` (`setCommissionOversight`), `session.ts` (`qualityReviewerOf` filter block, cached `getQualidadeAccessByOrg`, `CommissionAccess.isQualityViewer` flag — `CommissionRole` union untouched). typecheck ✅ lint ✅ vitest 1157/1158 — the 1 red is the DESIGNED hand-off: `ROLE_LABELS` (frontend-owned `affiliations-panel.tsx`) needs `quality_reviewer: "Revisão da qualidade"` |
| A.7 | `/o/[org]/qualidade` route group (layout/board/dashboards) — `frontend-design` skill first | frontend | ✅ **built 2026-08-06** (`c4e36e1`) — layout + board + dashboards + loading/error/not-found, 11 components in `src/components/quality/`. Board fans out `listCasesBoard` per visible commission (`allSettled` → per-commission degradation). D6 locked count = KPI value + chip suffix + one line, non-clickable, tone `plain`. Dashboards reuse `DashboardCharts`; **not** `DashboardFilters` (its CSV export hits the closed `dashboard_export_rows`), and the page **strips** `freeTextSamples`/`completionByMember` locally rather than relying on those doors denying-by-empty. typecheck + lint + 1158 vitest + **real `next build`** green; both routes registered. ⏳ **authenticated in-browser render NOT yet verified — see A.8 note** |
| A.8 | Case-page viewer branch + write-affordance suppression · oversight toggle in `/o/[org]/manage/comissoes` · nav/`qualidadeHref` | frontend | ✅ **built 2026-08-06** (`ae48b41` `c8379bd` `6ee5f47`) — gates widened at the **layout**, case page and narrative page; reduced `QualityViewerShell` returns before the member branch (the member sidebar never renders, so `role === null`'s show-everything branch is unreachable). 3 flag-gated write affordances closed via one `viewerKind` discriminator + host-side resolution: `NotifyEventDialog`, `correctionCaps.canFile`, `CasePatientPanel`. **Q3** → referral list kept, wizard fuel emptied by construction (`buildCaseReferralsModuleReadOnly`); **Q4** → interviews + meetings omitted; **Q1** → documents panel renders metadata, **no download affordance at all** (`bf0f824`). Standard-tier bytes are DB-denied at the storage policy by **M8**; reopening is Phase B+ with an audit emit. ⚠ **Two findings worth carrying forward:** ① `signedUrl: null` is **overloaded** — it meant only "PHI tier → audited door", and M8 added "storage refused to sign for you", so both nulls hit the same else-branch and the reviewer was being offered `OpenAttachmentButton` on *every* document (an affordance, not an absence). ② **M8's storage policy did not govern that door** — `openAttachment` resolves bucket+path via the `open_attachment` RPC then signs with the **service-role** client, which never consults `storage.objects`. ✅ **RESOLVED — the bypass was REAL, not theoretical** (`BUG-QO-001`): a live-catalog probe under `set local role authenticated` returned **1 row** from `open_attachment` for `quality.a` pre-fix (coordinator twin also 1 → the probe discriminated). **M9** (`20260911000800`) mirrors M8's `read_case_deliberation` conjunct **in-body in `open_attachment` only** — `can_read_attachment` deliberately untouched, since pushing it into the shared helper is how a fix becomes the next vulnerability. Post-M9: reviewer **0**, coordinator **1**. Pinned by keystone `308` §5.5 (+ §5.7 non-vacuity twin), observed RED against the pre-M9 catalog; `q1` case `open_resolver_door` reds it on demand. The four sibling referral doors were enumerated and probed (all closed, discriminating twins) and every `createAdminClient()` storage sign swept — `open_attachment` was the only reachable one. *Probe + fix by lead/`backend`; `frontend` verified the artifacts exist.* The panel's missing links are now a **consequence** of a DB boundary, not the boundary (Rule 1). Oversight toggle + `OrgCommissionList` un-nested (card was one `<Link>`). `ROLE_LABELS` label landed, role-label chain green. ⏳ **authenticated in-browser render not verified by `frontend`** — entering a password is outside this agent's permitted actions; needs a human sign-in or tester's A.9 run |
| A.9 | E2E `e2e/quality-oversight.spec.ts` + keyboard-only flow | tester | ✅ 2026-08-07 — **16/16 GREEN** (chromium/prod-standalone, fresh build). History: first pass shipped 15/15 (2 consecutive runs) with the reach-not-row-count discipline throughout (every negative paired against a real coordinator/org_admin on the SAME URL); 3 spec-authoring bugs found+fixed in that pass (not product defects) — 2 Playwright strict-mode multi-match locators (the case page has TWO "Escritório da Qualidade" back-links; "Editar" also matches 4 per-narrative buttons, scoped to `header`) + 1 wrong not-found assumption (a `notFound()` thrown by `qualidade/layout.tsx` itself is caught by the GLOBAL `not-found.tsx`, not the console's own — a segment's co-located not-found.tsx can't catch its own layout's notFound()). Migration-count question (did M9 land before or during the run) answered from the DDL log, not inference: M9 applied 01:39:04 UTC, all three spec invocations postdate it by 12+ min — settled catalog throughout. **Extended to 16 with a new `QO·A — multi-commission board (D10 cross-committee)` test** (lead ruling: no seed change — flip Farmácia visible via the real `set_commission_oversight` door at spec time, mirroring the existing D9 toggle test, restored by name-keyed locator in `finally`, restore itself asserted). Live-probed ground truth via the real RPC path before writing assertions (CCIH 5/4/1 unchanged, Farmácia 1/1/0 once visible). Caught and fixed 2 real locator regressions from concurrent `frontend` commits before running — not asked to rerun-and-discover: `Indicadores da supervisão` → `Visão geral` (`aria-label` replaced by `aria-labelledby` pointing at a visible `<h2>`, commit 7ca0207) at both KPI-region call sites, and the `kpiValue()` helper rewritten (the grid moved one level deeper into a wrapper `<div>`, so the old `div.filter({hasText}).locator('p').nth(1)` shape would have matched the wrapper too — now walks from the exact label text node to its own parent instead, immune to ancestor wrapping). Added the FUP-QO-4 scope-note assertion pair (absent for 1 commission, present for 2). **Did not bank the first green**: deliberately inverted one chip-selection assertion (Farmácia-selected → assert CCIH's case visible) and confirmed it REDs for the right reason, then reverted and re-confirmed 16/16; independently confirmed the restore-in-`finally` held even through that deliberate mid-test failure (`quality_oversight='excluded'` re-queried directly). `/manage/comissoes` locator sweep (`hospital-admin-tier.spec.ts` + `phase-multitenancy.spec.ts` + `phase3-admin-members.spec.ts`, 83 tests) re-run against the final build: **0 regressions**, twice. 2 findings reported to lead as candidate follow-ups, not filed as bugs (no security/functional impact): (1) the qualidade-scoped `not-found.tsx` copy is effectively unreachable (its only caller, the layout, always resolves the same `cache()`-wrapped check first); (2) the KPI strip / locked-count note do not recompute per chip-filter selection — always the global aggregate across every oversight-visible commission — confirmed a design question rather than a defect and tracked as **FUP-QO-4**. |
| A.10 | Phase review | qa | ⛔ **CHANGES REQUESTED 2026-08-07** — [report](docs/reviews/quality-office-oversight-review.md). **B1 (BLOCKER, D7):** `public.file_correction_request` / `declare_conflict` / `record_recusal` are `authenticated`-executable DEFINER **write** doors whose ONLY authority predicate is `app.can_read_case` — which S7 now satisfies. Live-probed read-only: `quality.a` has `_case_caps = 5` on the 5 seeded CCIH cases, `case_corrections` flag ON, **7** completed-phase correction targets reachable. No pgTAP / `q1` / E2E covers any of the three; `308` 1.4 (`not can_write_case_content`) is **vacuous** w.r.t. them — none consults that bit. Root cause: plan §A.2's threading list enumerates arms that must *change*, never *who already consumes the bit being conferred* — BUG-QO-001 one layer up. **M1:** Class-2 `professional_profiles`/`professional_participants` reachable via `can_read_professional_profile → can_read_case` (0 rows today only because the one profile-bearing CCIH participant sits on a locked case — a data coincidence) vs. D5 "never enters the Rule 12 modules". **M2:** `can_read_interview` = true for the reviewer on the seeded CCIH interview (7 tables); Q4 closed it in the UI only — Rule 1 inversion; same shape for `case_votes`/`case_decisions` (0 seeded rows, so invisible to every gate). **3 MINOR** (m1 stale `isQualityViewer` invariant for a dual-hatted pqs/nsp principal, m2 `HC0Q0`→`HC0L0` buildnotes drift, m3 stale `canDownload` comment). ✅ **Verified clean:** M8+M9 bytes cut (enumeration independently re-derived from a property, not a list — complete), M3 ACLs incl. no-PUBLIC, six/three dashboard split, allowlists byte-identical to `main` with 0 `quality` tokens, guard trigger both branches, must-NOT-change set. ⚠ Ran **no** tests (stack constraint — lead's gate): pgTAP/`q1`/ARM/E2E figures are **read, not reproduced**; §A.5's perf measurement is **unrecorded**. |

**Lead notes.** Phases **B** (org_admin content wall) and **C** (lifecycle + break-glass) are
**out of scope for this branch** — A is the pilot-blocking slice. Ownership: `backend` owns
`supabase/**` + `src/lib/{queries,types,supabase}`; `frontend` owns `src/app/**` +
`src/components/**`; they never edit the same file. The reviewer is a **flag** on
`CommissionAccess` (`isQualityViewer`), **never** a member role — mapping it to `'staff_admin'`
opens write gates (ADR 0100 D10).

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

<!-- Most recent gates only, ONE ROW each. The narrative — triage, dispositions, mutation proofs —
     rotates to docs/progress/test-run-archive.md at each §6 Record (full history, Phases 0 →
     Phase 16, already there). -->

| Date | Run | Result |
| --- | --- | --- |
| 2026-08-07 | **QO·A · LEAD · full `e2e:prod` gate #1 (pre-D7-fix baseline)** — `REBUILD=1`, defaults otherwise (`BATCH_TESTS=70`, `RESET=1`, `RETRIES=1`, `INFRA_RETRY=1`); HEAD `9bb789b` **plus one comment-only uncommitted diff** in `e2e/quality-oversight.spec.ts` (stable throughout — the gate runs files on disk, not HEAD; recorded rather than claimed as a clean freeze). 87 spec files → 16 batches, fresh server + fresh DB per batch | **GATE RED — 992 passed · 8 failed · 0 infra · 4 flaky · 8 did-not-run · 3 INFRA re-runs · accounted 1012/1017.** Structural checks clean **first**: `reset FAILED` = **0**, batches 1–16 present with **no gaps**. ⚠ **Two reading traps hit, both the lead's:** (1) the task notification reported **exit 0** while the gate's own exit was **1** — the wrapper ended in `tail`, so `$?` was `tail`'s; *the exit code is not the signal*. (2) A first triage grep for the spec name AND `fail` **on the same line** returned "quality-oversight: NO failures" — impossible to match, since Playwright prints them on separate lines; a detector scoped to the wrong property, whose silence read as good news. Re-extracted per batch for real attribution. **Attribution: 3 of 8 are QO** (`quality-oversight.spec.ts` b15 — `Casos visíveis` expected `5`, received **`15`**: batch 15 runs `processless-cases` + both `process-template-*` specs before it on the shared DB and they create CCIH cases. **Spec defect, not product** — `Comissões` still 1, locked case still invisible; the reviewer correctly saw the extra cases). **5 are unrelated baseline flake**: `nsp-per-hospital:120` · `phase14b-triage` T1–T3 · `recommend-result` RR-1a. `nsp-per-hospital` was **not** written off — it asserts cross-hospital isolation next to M6's widened `hospitals_select`/`organizations_select`, so `backend` probed it live: populations 3/1/1 disjoint, `pqs.a` sees exactly central-a's 3, `is_quality_reviewer_of(secundario-a)` and `is_quality_reviewer_in_org(rede-a)` both **false**, `hospitals_select` yields zero for `pqs.a` → **isolation HOLDS, M6 exonerated** (its own first two probes read `0/0` with a zero control and were discarded — a hospital UUID had been passed into `pqs_inbox`'s `p_status text`). **8 did-not-run in b16 — nothing proven for them; must be covered in the re-run.** Gate #2 follows the D7 cut wave + the tester's contamination fix |
| 2026-08-07 | **QO·A · `tester` · multi-commission extension + 2 locator fixes for concurrent `frontend` commits (7ca0207)** — `e2e/quality-oversight.spec.ts` grew to 16 tests (new `QO·A — multi-commission board (D10 cross-committee)` test, lead-ruled: flip Farmácia visible at spec time via the real `set_commission_oversight` door rather than a seed change); fixed both `Indicadores da supervisão`→`Visão geral` region-name call sites and rewrote `kpiValue()` (the KPI grid moved one level deeper into a wrapper `<div>`, which would have made the old `hasText`-filtered `div` search match the wrapper too) before running, per the lead's swept-in-one-pass instruction. Fresh `npm run build` + standalone restart to pick up `frontend`'s + `backend`'s concurrent commits, `--project=chromium --workers=1` | **16/16, run twice.** Mutation-checked the new test before trusting the green: inverted the Farmácia-selected chip assertion to expect CCIH's case (the wrong commission) — RED for the right reason (`element(s) not found`) — reverted, re-ran, 16/16 again. Independently confirmed the `finally`-block restore held even through that deliberate failure (`select quality_oversight from commissions where id=…` re-queried directly against the DB: `excluded`). `/manage/comissoes` sweep (83 tests) re-run against the same fresh build: **83/83, 0 regressions.** lint + `tsc --noEmit` clean. `git branch --show-current` verified `feat/quality-office-oversight` before staging; `e2e/**` + `PROGRESS.md` only |
| 2026-08-07 | **QO·A · `tester` · new spec `e2e/quality-oversight.spec.ts`** (15 tests) + `/manage/comissoes` locator-regression sweep (`hospital-admin-tier.spec.ts` + `phase-multitenancy.spec.ts` + `phase3-admin-members.spec.ts`), `--project=chromium --workers=1`, prod-standalone server on a live (non-reset) local DB | **quality-oversight.spec.ts: 15/15, run twice (no flakiness).** `/manage/comissoes` sweep: **83/83 — 0 regressions** from the `OrgCommissionList` un-nesting (none of the three specs key on the whole-card accessible name the restructuring narrowed). 3 spec-authoring bugs found+fixed on the first run (not product defects — see A.9 row for detail): 2 Playwright strict-mode multi-match locators + 1 wrong not-found-boundary assumption. lint (`e2e/quality-oversight.spec.ts`, `--max-warnings=0`) and `tsc --noEmit` both clean. `git branch --show-current` verified `feat/quality-office-oversight` before staging; `e2e/**` + `PROGRESS.md` only |
| 2026-08-06 | **MIN — all gates (lead-run on the settled tree)** — pgTAP 166f/**5181** fresh reset · Vitest **1158** · lint/tsc clean · MIN spec **10/10 ×4** · full `e2e:prod` ×2 GREEN after signature triage (**0 code failures**; run 1: 963+14+21, run 2: 876+172) · arms: census/floor HOLD, diff-scoped policy 0 BLIND. Full narrative (incl. the batched-load triage + harness traps) → [min-audio-minutes.md](docs/progress/min-audio-minutes.md) | **ALL GREEN** |
| 2026-08-06 | **AFF post-gate remediation · `tester`** — (1) hermetic fix for `phase16-accreditation-core.spec.ts` AC-4's cross-clock flake (`markerT0` now `sqlOne('select clock_timestamp()::text;')`, DB clock on both sides of the `occurred_at >=` comparison, not a host `new Date().toISOString()`); property-derived sweep of all of `e2e/` for the same shape (a JS-minted timestamp compared against a DB timestamp column in a filtering predicate) found **zero** additional instances — every other `audit_log`/timestamp read in the suite filters by identity (`action=eq….&entity_id=eq….`) or orders without a time-window predicate; the two near-misses inspected (`charters-cadence.spec.ts`'s `nowIso`, `phase14c-rca.spec.ts`'s `p_occurred_at`) are both WRITE-side values, not comparison markers. (2) Two new `e2e/aff-hospital-affiliation.spec.ts` AFF-6 tests for HC0R1 (D5's `endAffiliation` blockers list, previously reached by NO E2E) — commission-tier (`dr.john`, names `Membro — Comissão de Controle de Infecção Hospitalar`) and hospital-tier (`hospitaladmin.a1` — corrected fixture; the lead's first pointer, `dt.a`, was verified against the live catalog to have 0 active affiliations, so it cannot reach the refusal at all; `hospitaladmin.a1` is the one seed persona both affiliated to a hospital and holding a hospital-tier seat there — `hospital_admin`, no commission, at central-a — names `Administração do hospital — cargo do hospital`). Both assert via `getByRole('alert')` (not `getByText`), which is what pins `frontend`'s second fix (the confirm dialog now closes on refusal too, not only on success — previously the alert rendered `aria-hidden` behind a still-open Radix dialog). Both tests are READ-ONLY / self-reverting (the door refuses the end in both cases, so nothing in the seed changes and no cleanup is needed) | **AC-4 (isolated `phase16-accreditation-core.spec.ts`, `--workers=1`): 3 consecutive clean runs — 7/7, 7/7, then the AC-4 test alone 1/1.** Full load could not be reproduced locally (that is the lead's `e2e:prod` to re-run), but the fix removes the cross-clock comparison the diagnosis identified as the sole cause. `e2e/aff-hospital-affiliation.spec.ts`: **13/13, run twice.** Combined with `phase16-accreditation-core.spec.ts`: **20/20.** `phase3-admin-members.spec.ts` (untouched by this task) showed 2 DIFFERENT failing tests across 2 consecutive isolated runs — non-reproducible, consistent with concurrent `qa`/`frontend`/`backend` activity in the same tree/DB, not attributed to this task's changes. lint (`e2e/` scope, `--max-warnings=0`) and `tsc --noEmit` both clean. `git branch --show-current` verified `feat/hospital-affiliation-person-identity` before staging; `e2e/**` + `PROGRESS.md` only |
| 2026-08-06 | **AFF T3.6 · `tester` · BUG-AFF-1 fix re-verification** — repro inverted (ALLOW: `hospitaladmin.dual` seats the person on Comissão de Ética AS THEMSELVES, seat confirmed by a service-role `memberships` row read, not the toast; DENY: a sibling hospital's admin still refused, row count asserted unchanged) against `8155be2`. `e2e/aff-hospital-affiliation.spec.ts` (now 11 tests) + the 3 sibling specs, `--project=chromium --workers=1`, dev server, live (non-reset) local DB | **New spec run independently TWICE, 11/11 both times.** Combined targeted set (4 files, 77 tests incl. 1 deliberate skip): **76 passed · 0 failed** on the final run. **2 more pre-existing directory-pagination fragilities found and fixed in `hospital-admin-tier.spec.ts`** during re-runs (accumulated E2E-registered users from repeated same-session runs pushed a fixed seeded name off an unfiltered page-1 default) — "sees ONLY central-a users" and "CANNOT deactivate" both rescoped to `?search=`, the same fix already applied to their sibling earlier; the negative-only assertions were untouched (immune by construction). `npm run lint` (scope `e2e/`) and `tsc --noEmit` both clean, 0 warnings — the `CENTRAL_A_ID` unused-var warning is gone, used in the ALLOW arm's cross-hospital-untouched check. `git branch --show-current` verified `feat/hospital-affiliation-person-identity` before staging; `e2e/**` + `PROGRESS.md` only |
| 2026-08-06 | **AFF T3.6 · `tester` · targeted run** — new `e2e/aff-hospital-affiliation.spec.ts` (11 tests) + repaired `e2e/{user-registration,hospital-admin-tier,phase3-admin-members}.spec.ts` (locator/CPF-step fixes), `--project=chromium --workers=1`, dev server, on the live (non-reset) local DB | **76 passed · 0 failed · 1 deliberate skip (env-gated invite-mode) · 77 collected.** New spec run independently TWICE, 11/11 both times. `--workers=1` required — full parallelism (`fullyParallel`'s default worker count) reproducibly timed out every `page.goto('/login')` even though the server answered curl/direct-hit fine (concurrent-login contention under this sandboxed shell, not a product issue); serialized runs were reliable across ~6 repeats. **1 bug filed: BUG-AFF-1** (pre-existing `addStaff` authorization gap, not AFF-caused — full repro in [bug-log-archive.md](docs/progress/bug-log-archive.md), rotated 2026-08-06). **1 pre-existing spec fragility fixed in passing** (`hospital-admin-tier.spec.ts` HA-6's "registers a new user" test asserted against a fixed, non-unique display name on an UNFILTERED directory page — luck-dependent once enough same-session registrations accumulated; now scoped to `?search=<unique email>` like its siblings). **1 test rewritten for a ratified ADR decision, not a regression**: HA-6's "can deactivate" assumed the pre-AFF (ADR 0051) contract; ADR 0097 D14 / ADR 0098 §W3.2 deliberately made account deactivation `org_admin`-only, so the test now asserts the controls are ABSENT for a hospital_admin (mirrors the "281 D1 inverted, not deleted" convention) |
| 2026-08-05 | **MEM follow-ups + BUG-AUTHZ-002 · FULL `e2e:prod`** (RESET+REBUILD, 84 specs / 16 batches) | **970 passed · 1 failed · 0 flaky · 2 did-not-run** — denominator reconciled, no batch gaps, no `reset FAILED`. **2 infra re-runs** (batch 8 `server_dead=1 conn_errors=64`; batch 15 `server_dead=1 conn_errors=22`), both cleared — twin server deaths matching the known `supabase_vector` auth-gateway crash-loop, and both dead batches are login-heavy. **The 1 real failure was MEM2-1, and it was a PRODUCT DEFECT rather than a test bug** → BUG-A11Y-001, in [bug-log-archive.md](docs/progress/bug-log-archive.md) (rotated 2026-08-06). FUP-BULK-1's `bulk-case-creation.spec.ts` GREEN; the new `technical-direction-referrals.spec.ts` GREEN against the prod build. ⚠ The 2 did-not-run are MEM2-2/2-3, skipped by serial mode after MEM2-1 failed — accounted, not lost |
| 2026-08-05 | **MEM follow-ups + BUG-AUTHZ-002 · pgTAP full suite** on a fresh `db reset` of the MERGED tree (285 migrations) | **PASS — Files=160 / Tests=4903.** Includes `298_authz_p0_isolation.sql` **32/32 on its first-ever execution** — and against `main`'s rewritten `seed.sql`, which the fixtures are pinned to by id, so that was luck rather than design — plus `299_hospital_content_door_noun_rule.sql` **11/11**. ⚠ An earlier run on the **non-reset** DB showed 4 failures (`100_dashboard` #19 "1079 anon-executable", `252` Bad-plan abort, + the 2 real ones): the first two were pgtap-in-catalog / leftover-state artifacts and vanished on the reset. CLAUDE.md's "fresh reset" instruction is load-bearing, not hygiene |
| 2026-08-05 | **FUP-AUTHZ-2 · `p0b-isolation-mutation-audit.sh` Batch 4** — the 15 keystones | **15/15 RED-PROVEN**; controls green in all four files (250 14 ok · 251 40 · 252 48 · 298 32, 0 not-ok). Each keystone reddens when ITS policy opens, so none is vacuous |
| 2026-08-05 | **BUG-AUTHZ-002 · live row-count probe, red→green** (the evidence the bug asked for and nobody had) | **RED:** platform@ read **3** documents / **2** rollups from Hospital Central A. **GREEN after `20260908000100`: 0 / 0.** **Twins:** hospital_admin.a1 and orgadmin.a still read 3 / 2 (not fixed-by-breaking). **Mutation-proven per arm** (ADR 0079 A2 FORK): restoring the disjunct on one door reds only that door's assertion |
| 2026-08-05 | **`ARM=census` (ARM 3)** — first runs, against the merged catalog | **HOLDS at 436 live gates.** Earned it twice before holding: found `process_template_versions_{select,staff_admin_write}` unswept (TV keystoned the six CHILD policies, not its own PARENT table's two), and the ghost check named 5 `validate_template_*` signatures ADR 0096 re-keyed — plus 3 policy names I had entered from a commit message instead of the catalog. Domain extended mid-session to row-returning DEFINERs (+45) after BUG-AUTHZ-002 proved the boolean-only domain could not see it |
| 2026-08-05 | **`ARM=floor`** on a fresh reset of the merged tree → **FUP-MEM-1's missing baseline** | **INVARIANT HOLDS.** The three indicator doors now register calls: `hospital_indicator_rollup` 5 · `indicator_kpis` 1 · `record_indicator_measurement` 1. The first is over-determined (`299` calls it); the evidence is the other two, untouched by this session, going 0→1. **Disproves** the 08-04 hypothesis that `pg_stat_user_functions` drops rolled-back pgTAP stats |
| 2026-08-05 | **PostgREST embed probe** (`scripts/{extract,probe}-embeds.mjs`) over 286 select sites, after the FUP-BULK-1 embed change | **1 real defect: BUG-RCA-001** (`case_interviews.scheduled_start`, already logged); my new `memberships→profiles` embed resolves 200/OK under a service-role replay. ⚠ **228 of 286 sites returned `42501`** — the probe runs as `anon`, so PostgREST stopped at permissions and never resolved those embeds. They are **unvalidated, not validated**; read the tool's output accordingly |
| 2026-08-05 | **PCI + TV · FINAL `e2e:prod` gate** (lead) — post-fix, on `f6c847d` | **GATE GREEN — 965 passed · 0 failed · 0 infra · 0 flaky · 0 did-not-run · 16 batches.** ⚠ Read in this order, because the summary alone is not evidence: `reset FAILED` **0** · batches **1–16 contiguous, no gaps** · **no `*-unrun.log` stubs** · `accounted 965 of 970` collected. The 5-test gap is deliberate `test.skip` with documented reasons. Cross-check: collected 968→970 and passed 963→965 is exactly tester's **+2**, so the delta is fully attributed. 18 stale batch logs from the 10:46–11:32 run were cleared first — an aborted gate leaves the *previous* run's logs in place and they read as current |
| 2026-08-05 | **TV · tester · new spec, RED-proven before any fix** — `e2e/process-template-narrative-slot-crud.spec.ts` (2 tests, chromium, dev server) — covers QA finding F-2 (zero prior coverage of narrative-slot edit/remove) | **0/2 — both RED for the intended reason (BUG-TV-001 / F-1: PGRST200 embed break in `commissionOfTemplateNarrative`).** EDIT fails at "edit dialog closed" (stays open showing `status: Narrativa não encontrada.`); REMOVE fails at "no not-found banner" (banner present, DOM snapshot shows the slot card survived). Each test builds its own fresh draft template — no shared/seeded fixture. ~~Not rerun after a fix yet — backend has not been spawned~~ → **lead 2026-08-05: superseded. `c557a32` landed the fix; spec re-run 2/2 GREEN, unmodified, and mutation-checked (reverting only the select string reds it again)** |
| 2026-08-05 | **TV · diff-scoped ARM `policy` re-sweep** over the six BLIND template-child policies (branch `db/process-case-integrity`) | **6 COVERED · 0 BLIND · 0 ERROR** — closes the `process_template_{phases,narratives,outcomes}_{select,staff_admin_write}` finding. Baseline captured green at Files=158/Tests=4860. No allowlist entry added (a tenant-isolation policy may not be allowlisted) |
| 2026-08-05 | **TV · pgTAP full suite** on a fresh `db reset` (adds `297`'s TI section) | **PASS — Files=158 / Tests=4860** (baseline 4839 + 21). All **21/21 new assertions mutation-proven RED** across 12 policy probes (p3–p14, open **and** close per policy); every probe ran the full denominator (21), catalog restore byte-verified on all six |
| _≤ 2026-08-04_ | **Older gate rows (FF-5 · ad-hoc batch · FF-4 · Phase 16 · MEM W1–W4), rotated 2026-08-06** — one line each, verbatim | [test-run-archive.md](docs/progress/test-run-archive.md) |

Full narrative for every row — triage, dispositions, mutation proofs, and the FF-2/FF-3 and Phase 0→16
history — → [test-run-archive.md](docs/progress/test-run-archive.md).

**Standing gate-triage method — it has settled every collapse so far.** Count **connection errors per
batch FIRST**: `> 0` = infra, `= 0` = real. FF-5's gate showed 53 raw reds in one batch of which *every*
error was `ERR_CONNECTION_REFUSED` — zero assertion failures; FF-3's was 140 raw, 2 real. Two tells worth
keeping: a **0 ms** duration is a libuv crash, not an assertion failure, and a collapse run can fail test
1, recover, then die later — **the first failure is not the collapse point**. Then check the batch
numbering for gaps and the `COVERAGE: n of m` denominator against `spec-counts.txt` (BUG-GATE-001).

⚠ **pgTAP needs a FRESH `supabase db reset`.** A second suite run against the same DB gives **4200 + a
hard abort in `161_recommend_result_source`** (that file mutates feature flags). That is contamination,
not a defect — it reads exactly like a real red.

## QA Verdicts

<!-- ONE LINE per phase/feature: verdict + date + link. The full analysis lives in
     docs/reviews/*.md — never restate rationale here or in the archive.
     Struck-through rows are superseded rounds, kept only to show a phase looped.
     Retention: current milestone only. Older concluded rows move VERBATIM to
     qa-verdicts-archive.md's "Collapsed one-line index" (the index is not rationale —
     it preserves the feature-name → review-file mapping). -->

| Phase / Feature | Verdict | Date | Report |
| --- | --- | --- | --- |
| **QO·A** — Quality-office oversight, Phase A (ADR 0100 D1–D11) | ⛔ **CHANGES REQUESTED** — 1 BLOCKER (B1: D7 breached — `file_correction_request` / `declare_conflict` / `record_recusal` gate on `can_read_case` alone, which S7 satisfies; live-probed reachable, unpinned by any suite, and `308` 1.4 is vacuous w.r.t. them), 2 MAJOR (M1 Class-2 `professional_profiles` reachable vs. D5; M2 interviews DB-open / UI-hidden vs. Rule 1), 3 MINOR | 2026-08-07 | [r1](docs/reviews/quality-office-oversight-review.md) |
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

### 🟡 FUP-QO-1 — `p_expires_at` seam limits, deferred to Phase C (2026-08-06, backend; consumer: **D14 break-glass**)

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

### 🟡 FUP-QO-3 — two vacuous `a2` mutation cases: the audit's coverage claim is overstated (2026-08-06, backend; lead-ratified file-don't-fix)

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

### 🔴 FUP-QO-5 — the authz sweep machinery leaves `anon` EXECUTE grants that can MASK a real leak (2026-08-07)

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

Proposed scope: make the harness restore the ACLs it perturbs (it already byte-compares function bodies —
extend that discipline to `proacl`), **or** have t19 assert against a baseline captured on a clean reset
rather than an absolute zero. Until then: **never trust a `100_dashboard` t19 result that did not run on a
fresh reset**, in either direction.

### 🟡 FUP-QO-4 — KPI-strip scope vs. the chip filter: a design ambiguity, NOT a defect (2026-08-07, lead)

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
