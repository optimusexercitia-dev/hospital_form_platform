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
| **PCI** | **Process/Case integrity audit remediation** [0095](docs/decisions/0095-process-case-integrity-audit-remediation.md) · [audit](docs/reviews/process-case-integrity-audit.md) · [detail](docs/progress/process-case-integrity-and-template-versioning.md) | ✅ complete | ✅ | ✅ all gates green — full gate record rotated → [detail](docs/progress/process-case-integrity-and-template-versioning.md) | ✅ APPROVED r2 [review](docs/reviews/process-integrity-and-template-versioning-review.md) (r1 → BUG-TV-001 fixed) | ✅ 2026-08-05 | 2026-08-05 | `44cd9bb`…`f6c847d` → ff `main` |
| **AFF** | **Hospital affiliation, person identity & the org people directory** [0097](docs/decisions/0097-hospital-affiliation-person-identity.md) · [record](docs/progress/hospital-affiliation-person-identity.md) · [audit](docs/reviews/aff-adr-0097-external-audit.md) | ✅ complete | ✅ | ✅ all gates green — full gate record rotated → [record](docs/progress/hospital-affiliation-person-identity.md). ⚠ never cite `ARM=census` for AFF's write-path doors (FUP-AFF-1) | ✅ APPROVED [review](docs/reviews/aff-review.md) — 0 blocker; 6 non-blocking follow-ups all remediated | ✅ 2026-08-06 | 2026-08-06 | `main` ff + pushed to `origin` at `cc66483` (pre-remediation) |
| **MIN** | **Meeting audio → generated ata** [0099](docs/decisions/0099-meeting-audio-minutes.md) (+Amdt 1) · [record](docs/progress/min-audio-minutes.md) — flag `audio_minutes` **OFF** at ship | ✅ **complete** | ✅ lint 0/0 · tsc · Vitest **1158** · `db reset` 301=301 | ✅ pgTAP **166f/5181** fresh reset · MIN spec 10/10 ×4 · `e2e:prod` ×2 **GREEN (triaged, 0 code failures)** · census+floor HOLD · diff-scoped policy 0 BLIND | ✅ **APPROVED (r2)** [review](docs/reviews/min-audio-minutes-review.md) — r1 BLOCKER (apply never reclaimed audio) fixed+proven; 3 MINOR open (R1–R3) | ✅ 2026-08-06 | 2026-08-06 | branch `feat/meeting-minutes` |
| **TV** | **Process-Template Versioning** [0096](docs/decisions/0096-process-template-versioning.md) (+ Amendments 1.1–1.7) — PO-directed full remodel · [detail](docs/progress/process-case-integrity-and-template-versioning.md) | ✅ complete | ✅ | ✅ all gates green — full gate record rotated → [detail](docs/progress/process-case-integrity-and-template-versioning.md) | ✅ APPROVED r2 [review](docs/reviews/process-integrity-and-template-versioning-review.md) | ✅ 2026-08-05 | 2026-08-05 | `6b9314c`…`f6c847d` → ff `main` |
| **QO·A** | **Quality-office oversight — Phase A** (classification + `quality_reviewer` + UI) [0100](docs/decisions/0100-quality-office-oversight.md) · [plan](docs/plans/quality-office-oversight.md) — **pilot-blocking** | ✅ **complete** | ✅ lint 0/0 · tsc · Vitest **1158** · `db reset` 313=313 | ✅ pgTAP **172f/5355** fresh reset · `q1` **20/20 RED-proven** (7 controls) · `ARM=census` + `ARM=floor` **HOLD** · `e2e:prod` QO **18/19 + 1 cold-start flaky**, 0 QO failures suite-wide, all 97 did-not-run covered | ✅ **APPROVED (r3)** [review](docs/reviews/quality-office-oversight-review.md) — r1 ⛔ / r2 ⛔ / r3 ✅; 5 real findings, all closed structurally | ✅ 2026-08-07 | 2026-08-07 | branch `feat/quality-office-oversight` → `main` |
| **QO·B** | **Quality-office oversight — Phase B** (org_admin/hospital_admin content wall + the BUG-QOB-003 UI-coherence close-out) [0100](docs/decisions/0100-quality-office-oversight.md) D12 · [inventory + PO rulings + findings](docs/plans/quality-office-oversight-phase-b-inventory.md) | ⬛ **complete** | ✅ `db reset` **329=329** · pgTAP **175f/5616** fresh reset · **7 migrations** (`20260915000000`–`000500` + `20260916000000` M7) · lint 0/0 · tsc · vitest **1194** | ✅ **A/B matrix** clean-seed: **LOST = ratified cells only · GAINED = 0 · KEEP 0/0** · `b1` mutation audit **39/39 RED-PROVEN**, RESTORE byte-identical, controls 111+53 · **`ARM=census` + `ARM=floor` HOLD** · **diff-scoped door sweeps 0 BLIND** (M5/M6 wave + M7's `case_events`) · **E2E** qob spec **19/19 ×2** + full `e2e:prod` **GATE GREEN 1046 passed / 0 failed / 1 flaky / 0 did-not-run** (B.16, post-M7 tree) | ✅ **APPROVED (r2)** [review](docs/reviews/phase-QO-B-review.md) — r1 ⛔ (BLOCKER: M4 cut a PROXY, §4.4 unexecuted) → M7 → r2 ✅ re-proved on the reviewer's own fixtures | ✅ 2026-08-09 | 2026-08-09 | Closes **BUG-QOB-001** · **BUG-QOB-002** (re-opened by QA r1 — M4's proxy left it live — re-closed by M7, r2-confirmed) · **BUG-QOB-003** (both halves). ⛔ Twice this phase a CUT executed by enumeration diverged from the ratified list (M1–M4's 16 doors → M5/M6; M4's §4.4 proxy → M7) — **the end-of-phase check is: re-read the ratified list against the catalog, item by item**. Open (PO, parked for a future session): **BUG-QOB-004** · **FUP-QOB-1** · **FUP-QOB-2** (ratification package). branch `feat/quality-office-oversight` → `main` LOCAL-ONLY; remote `db push` pending with the PO. Record: [quality-office-oversight-phase-b.md](docs/progress/quality-office-oversight-phase-b.md) |
| **PDF·P1** | **PDF document printing — Forms + full skeleton** [0104](docs/decisions/0104-pdf-document-printing-module.md) (+Amdts A1–A6) · [plan](docs/plans/pdf-document-printing.md) · [record](docs/progress/pdf-p1-forms-skeleton.md) — flag `document_printing` **OFF**; P2–P4 follow | ✅ **complete** | ✅ lint 0/0 (purity gate red-teamed) · tsc · Vitest **1190** · real `next build` · mint smoke **sha-256 === registry hash** vs live Gotenberg 8.24.0 | ✅ pgTAP `312` **73/73** + full **173f/5444+** fresh reset · **7 neutralization drills RED-proven** · `ARM=census` + `ARM=floor` **HOLD** · diff-scoped `ARM=policy` **3/3 COVERED, 0 BLIND** · feature E2E 7/7 ×2 · `e2e:prod` **GATE GREEN — 0 real failures / 1026** (PGRST002 infra triaged; affected specs re-run 87/87) | ✅ **APPROVED (r2)** [review](docs/reviews/phase-PDF-P1-review.md) — r1 0 blocker / 2 MAJOR (guard gaps) → fix wave → r2 both MAJORs + 6 MINORs closed; 3 MINORs deferred open (FUP-PDF-2..4) | ✅ 2026-08-08 | 2026-08-08 | worktree branch `worktree-pdf-printing-p1` → `main`; **remote `db push` ✅ 2026-08-08 (user-authorized, remote-catalog-verified — doors/dispatch DEFINER, lookup service_role-only, bucket private 0 policies, flag OFF)** |
| **PDF·P2** | **PDF printing — Meetings (ata)** [0104](docs/decisions/0104-pdf-document-printing-module.md) **+Amdts A7/A8/A9** (the PO Package-A ruling) · [plan](docs/plans/pdf-document-printing.md) §3 · [record](docs/progress/pdf-p2-meetings.md) | ✅ **complete** | ✅ lint 0/0 · tsc · Vitest **1194** · real `next build` · smoke 3/3 (complete banded ata `phi/` + hash match; respondent refused mint AND open) | ✅ pgTAP `312`+`313` **128/128** + full **174f/5502** fresh reset · drills D2/D5/D8/D9 (+D1) **RED-proven** · diff-scoped `ARM=policy` dispatch+helper **COVERED 0 BLIND** · `ARM=census`+`floor` **HOLD** · tester 12/12 ×2 + A7 respondent-denial ×3 · `e2e:prod` **GREEN — 0 real failures / 1030** | ✅ **APPROVED (r2)** [review](docs/reviews/phase-PDF-P2-review.md) — ⛔ r1 (BLOCKER-1 per-caller-masking leak + MAJOR-1 PHI labeling) → PO Package A → r2 closure re-proven by constructed exploit class; scope question HELD (kind-sites = 3, the A8 trio) | ✅ 2026-08-08 | 2026-08-08 | branch `feat/pdf-p2-meetings` → `main` **LOCAL-ONLY (PO: no push)** — origin/main still at `9373ce8`; remote DB lacks `20260914*` |

> ⚠ PCI/TV shipped with two gate caveats — the un-runnable `ARM=census` (**DISCHARGED 2026-08-05**: the arm landed with the membership-hardening merge and was run against the merged catalog; residue in FUP-PCITV-1 row 1) and the VOID TV-backfill premise (⚠ its mechanism recurs: a backfill is invisible to `db reset` forever — a green reset is *no* evidence). Full caveat text + verbatim gate rows rotated 2026-08-08 → [process-case-integrity-and-template-versioning.md](docs/progress/process-case-integrity-and-template-versioning.md).

## Current Phase Tasks

<!-- Lead recreates this table at the start of each phase. At the §6 Record step the
     completed phase's task detail is archived to docs/progress/phase-N.md (or a
     feature-named file) and replaced here by a one-line pointer (CLAUDE.md §7). -->

### 🟡 ACT — "act as" strict role assumption (ADR [0106](docs/decisions/0106-act-as-role-assumption.md)) · **S3 GATE GREEN 2026-08-10 — awaiting QA review (step 3) + human approval (step 4)**

> ## ✅ S3 CLOSED BY THE LEAD AUDIT SESSION 2026-08-10 (resume after the pause)
>
> **State:** S0/S1/S2 ✅ · **S3 ✅ built + gate GREEN** (evidence below) · S4 ⬜ not
> started (explicitly out of scope for the audit session). **QA review (Phase Gate step 3)
> and human approval (step 4) are STILL PENDING** — the next session starts there.
> ⛔ Local-only throughout; nothing pushed, no `db push`. Remote cutover additionally
> needs the auth hook ENABLED on Supabase Cloud (a step `db push` does not cover).
>
> **Gate evidence (all 2026-08-10, HEAD `81a72d1`):**
> - Full `RESET=1 REBUILD=1 e2e:prod`: **996 passed · 0 failed · 2 flaky (known
>   baseline, green on retry) · 61 never-ran** — batch 8's mid-gate `db reset` failed
>   transiently (its stale `batch-8.log` still shows run-1 content; the reset passed
>   immediately on manual retry). Per the gate's own instruction the 61 were re-run as a
>   scoped prod-standalone gate (`SPECS=` the 4 batch-8 files, fresh reset): **61/61
>   GREEN**. Net accounting: 1057 passed + 2 flaky-then-green + 5 pre-existing skips
>   = 1064 collected; **zero assertion failures anywhere**.
> - pgTAP on a fresh reset: **Files=178, Tests=5679, PASS** (the post-`20260918002700`
>   baseline). `ARM=census`: 450 live gates / 461 verdicts, no unswept newcomer.
>   `ARM=floor`: 80 never-called doors, all allowlisted. (No RLS policy or boolean
>   `prosecdef` gate changed after the S3 backend's own diff-scoped sweep — the audit
>   session's fixes were spec-side plus one frontend serialization fix.)
> - lint 0/0 · `tsc --noEmit` · Vitest **1194**.
>
> **What the first full gate (RED: 9) actually found — two causes, both closed:**
> 1. **A REAL S3 security regression** caught by `phase2-auth-shell`'s "404 body names no
>    commission" assertion: the D9 hint mount serialized the caller's full grant objects
>    (commission ids/names/slugs) into the RSC payload of EVERY signed-in 404 —
>    `RoleSwitchHint` is a client component, so props ship even when it renders nothing.
>    Fixed in `81a72d1`: `getRoleSwitchOptions` pre-computes each option's landing route
>    server-side; only `{role, count, landing}` strings cross the client boundary; all 7
>    `not-found.tsx` mounts updated. Hint behavior unchanged (act-role-assumption 9/9).
> 2. **Eight environmental reds** (both PDF specs): the `gotenberg-pdf` sidecar
>    (`PDF_RENDERER_URL`) had exited when Docker restarted — it carries **no restart
>    policy**, so any Docker restart silently kills PDF minting. Restarted (health 200),
>    14/14 green. ⚠ Candidate hardening: `docker update --restart unless-stopped
>    gotenberg-pdf` (not done — infra change, PO's call).
>
> The six pre-pause findings + `notifications` N-1/N-3 were all resolved in `169668d`
> (detail: Bug Log). The 74 pre-pause never-ran tests are fully accounted: they ran in
> the two runs above (the only unrun set, run-2's 61, was re-run green).
>
> ⚠ Still-open program items (NOT S3 blockers): **FUP-ACT-DISPOSE-UI** +
> **FUP-ACT-CAPA-ASSIGN** (PO ratification — same family as the two ADR 0106 accepted
> losses) · `BUG-VACUOUS-ASSERT-1` (pre-existing, repo-wide audit is its own pass) ·
> `BUG-ACT-EXPIRY-1` (latent; S4 or standalone) · `BUG-ACT-ACL-1` (folded into
> AUDIT-INVOKER-WRAPPER) · the `navScope="member-and-configuration"` dead branch +
> the endorsed standing-sweep candidate (both carried into S4's list).

Branch `feat/act-as-role-assumption` (worktree, based on `main` @ `7b7a99c`). Plan
[act-as-role-assumption.md](docs/plans/act-as-role-assumption.md) — **QA APPROVED r2**
([review](docs/reviews/act-as-plan-review.md)); PO-locked P1–P6: **before pilot**, hat bound to the
auth session, **NO feature flag** (the migration IS the cutover — do not re-propose one), D9 v1 =
choke-point guards + indicator. Build notes + sweep inventories accumulate in
[act-as-buildnotes.md](docs/plans/act-as-buildnotes.md). ⛔ Local-only: no `git push`, no `db push`.

| Stage | Owner | Status | Record |
| --- | --- | --- | --- |
| **S0** — the role enum | backend | ✅ 2026-08-09 · `8acebed` (+ placement fix) | `20260918000000`; **11 labels = the 10 `memberships_role_check` values + `platform_admin`** (D11 break-glass hat / audit stamp). pgTAP 5636 PASS · ARM=census + ARM=floor HOLD |
| **S1** — harness first | backend + tester | ✅ 2026-08-10 · `f87bfe6`·`d7e4ae5`·`d2bbc7a` · **gate CLOSED: e2e:prod 1049 pass + 1 known flaky + 5 pre-existing skips = 1055/1055, 0 failures** (batches 1–17 all present, no `reset FAILED`, 2 infra reruns accounted). ⚠ The gate's own "COVERAGE 1050 of 1055" line excludes skips from its numerator — it is NOT 5 unrun tests; reconcile per-batch before ever reading it as a gap | `claims_for` gains `p_active_role` (null ⇒ no claim, suites stay vacuously green) · `request.jwt.claims` sweep bounded by the **property** not by filename: 166 sites = 140 resets + 1 canonical + **21 routed** + 4 structurally unreachable (`test_helpers` is minted by `00_setup.sql`, so `seed.sql`/demo can never reach it) · additive `dualhat.a@` persona · `loginFresh`/`cachedSignIn` `actAs` seam · seed-sensitivity sweep (7 candidate specs, 125 pass + 1 known skip, 0 regressions). ⚠ **S1 is not signed off until the full suite is green** — the scoped 126 is not the plan's "full suites green" |
| **S2** — behaviour-preserving normalisation | backend | ✅ 2026-08-10 · `c7b3fb6`+`7972441` · **gate CLOSED: e2e:prod 1050 pass + 5 skips = 1055/1055, 0 failures, 0 flaky** (batch 4's 15 reds correctly classified INFRA — `server_dead=1, conn_errors=29` — and green on rerun) | 8 direct `memberships` readers re-based onto `has_role`/`has_role_any`, `CREATE OR REPLACE` only. The "8" was **re-derived from the catalog** (149 boolean gates, comment-stripped `prosrc`) and *happened* to reconcile with the census — a stronger claim than using it. Proof is a **61-case equivalence matrix** (TRUE/FALSE/cross-tenant/null-scope + a synthetic expired-membership fixture), captured before and after: **0/61 deltas, byte-identical**. Lead re-verified post-migration from the catalog: the `DIRECT-ONLY` bucket now holds exactly `has_role`+`has_role_any` themselves. pgTAP 5636 PASS **twice, second run without a reset** · ARM=census + ARM=floor HOLD · diff-scoped sweep 7 COVERED / 0 BLIND / 1 ERROR closed by a hand-run dual-direction mutation proof. Found + fixed BUG-ACT-CLAIMSFOR-1; opened BUG-ACT-EXPIRY-1 + BUG-ACT-ACL-1 (Bug Log) |
| **S3** — THE ATOM (the only red window) | backend + frontend + tester + lead audit | ✅ **GATE GREEN 2026-08-10** · `81a72d1` · full `e2e:prod` 996p+0f+2 baseline-flaky, + the transiently-unrun batch 8 re-run **61/61** (zero assertion failures across all 1064 collected; 5 pre-existing skips) · pgTAP fresh-reset **178/5679 PASS** · ARM=census 450/461 HOLD · ARM=floor 80 HOLD · lint 0/0 · tsc · Vitest 1194 — see the close-out box above for the two first-gate causes (the D9-hint RSC grant-serialization leak, fixed; the gotenberg sidecar down, environmental). **QA review + human approval PENDING.** | DB layer landed: `active_role_selections` + `assume_role` (in `public`, not `app` — PostgREST) + hook claim (D11/D5) + `has_role`/`has_role_any` caller-only condition (fixed a live NULL-propagation fail-open the plan's literal text carried — `IS NOT DISTINCT FROM`, not `=`) + `member_can` D13 + `audit_write` D8 + raw-policy sweep (`profiles_select_self_or_admin` co-member arm, 5 sibling arms reasoned-exempt) + the post-auth destination sweep (**`resolveLanding` DELETED**, not patched — was a second hand-rolled partition covering only 4/11 roles; `getSessionContext` gains `activeRole`/`needsRoleSelection` for `page.tsx`'s one-line dependency) + the revert-twin keystone (`315`, also closes the `assume_role` ARM=floor gap). pgTAP: **Files=176, Tests=5644, PASS ×2** (fresh + no-reset) — reached only after triaging ~60 genuine reds down from 657 (auto-derivation in `claims_for` + a `SECURITY DEFINER` fix + per-file hat triage; full account in buildnotes). `ARM=census` (451/461, unchanged — `active_role()` returns `text`, not in the boolean-gate population) + `ARM=floor` (80, HOLD) + diff-scoped sweep over the 8 changed functions + the 1 policy — verdicts in buildnotes. **Picker route = `/selecionar-perfil` (PO, 2026-08-10).** **Frontend `feat(act): stage 3 UI` (commit below):** picker page + form, `UserMenu` hat indicator + "Trocar papel" (threaded to all 9 render sites), D9 hint (`RoleSwitchHint`), `page.tsx`'s one-line gate, new `direcao-tecnica` shell. ⚠ **Live-verified finding that overrides the design note's §5.4 mounting plan**: a choke-point guard's own `notFound()` (thrown inside its `layout.tsx`) is caught by the GLOBAL `src/app/not-found.tsx`, never a same-segment sibling `not-found.tsx` — confirmed on a real production standalone build, not just dev. The 6 area-specific `not-found.tsx` files (2 pre-existing + 4 new) only catch a narrower within-shell page-level `notFound()`; the D9 hint's PRIMARY mount is now the global boundary (session-gated, no cost for an anonymous 404). Full derivation + the live persona walkthroughs (`dualhat.a@`/`chefe.ccih@`/`multi@`): `docs/plans/act-as-buildnotes.md` Stage 3 — frontend half. Tester half: seams flipped + picker/switch/D9 specs (9/9) + the threading/close-out rows below; the full-gate close is the lead-audit evidence in the status cell + box above. |
| **S4** — D14 arm audit + record | backend + qa | ⬜ not started | `_case_caps` arm-by-arm from the catalog; the two DESIGNED hat-blind doors allowlisted. ⚠ Also carry in: the **endorsed standing-sweep candidate** — "raw `memberships … principal_id = auth.uid()` with no adjacent hat condition" belongs in the ADR 0079 door audit, because `capa_kpis` was found with a safe arm and a raw arm side by side, i.e. this population accreted from different authors over time and a one-off sweep will not hold |

**⏸ S3 — what was found AFTER the stage was declared "built" (the reason it is still open).**
Three independent classes of hat-blindness, none in the plan, because **S2 normalised only the
BOOLEAN gates** and everything else stayed hat-blind by omission:
1. **Application guards** — `BUG-ACT-GUARD-HATBLIND-1`, **P0**, tester-found, live-reproduced
   twice (`dualhat.a@` hatted `quality_reviewer` got the full org-admin console at `/manage`;
   hatted `org_admin` got the full quality console). `partitionGrants()` derived every role list
   from the *designed* hat-blind `session_context` with **zero `activeRole` reference**; 88 call
   sites across 29 files read them as access decisions. Fixed **centrally** in
   `getSessionContext()` (`535e4e2`) — a 29-file patch sweep would have missed one.
   `getRawGrants()` remains the single **named** hat-blind accessor, its consumer set proven to
   be exactly {picker, D9 hint}. The same fix closed an **unreported** variant: `page.tsx`'s
   landing chain read the same fields, so picking `quality_reviewer` bounced you to `/manage` —
   the picker was fighting itself.
2. **`context.isAdmin`** — read the raw JWT claim, bypassing D11 entirely; ~23 consumers of the
   `if (context.isAdmin) return true` shape, **two of which run on the service-role client, where
   there is no RLS backstop at all.**
3. **31 non-boolean DEFINER doors** (`7320b87`) — classified by the §2 caller-vs-third-party
   property: **6 caller-gating** (5 real defects + 1 defensive), **24 correctly LEFT hat-blind**
   (roster enumerations — one user's hat must never change what the system concludes about
   *another*), 1 already-ruled (`session_context`). No mixed-shape function. Each of the 5 carries
   a **red-first** keystone (`316`) confirmed RED against the unfixed catalog.
Residuals closed from the catalog by the lead: **no** view/matview reads `memberships`, and only
3 functions read `request.jwt.claims` (`active_role`, `is_admin`, `assume_role`) — all hat-aware.

**S3 — the hat-blindness sweep (THREE separate classes, none in the plan):**
The atom surfaced hat-blindness in three independent layers. Stage 2 normalised only the
**boolean** gates, so everything else stayed hat-blind by omission:
1. **Application guards** (`BUG-ACT-GUARD-HATBLIND-1`, P0, tester-found, live-reproduced twice) —
   `partitionGrants()` derived every role list from the *designed* hat-blind `session_context`,
   with zero `activeRole` reference; 88 call sites across 29 files read them as access decisions.
   Fixed **centrally** in `getSessionContext()` (`535e4e2`), not guard-by-guard — a 29-file patch
   sweep would have missed one. `getRawGrants()` remains the single **named** hat-blind accessor;
   its consumer set is proven to be exactly {picker, D9 hint}.
   ⚠ Same fix closed an **unreported** variant: `page.tsx`'s landing chain read the same fields, so
   picking `quality_reviewer` bounced you to `/manage` — the picker was fighting itself.
2. **The TS admin entitlement** — `context.isAdmin` read the raw JWT claim, bypassing D11 entirely.
   ~23 consumers of the `if (context.isAdmin) return true` shape, **two of which run on the
   service-role client — no RLS backstop at all.** Now mirrors `app.is_admin()`'s own condition.
3. **Non-boolean DEFINER doors** (`7320b87`) — the population Stage 2 scoped out. Lead sweep found
   **31**; classified by the §2 caller-vs-third-party property: **6 caller-gating** (5 real defects
   + 1 defensive), **24 third-party, correctly left hat-blind** (roster enumerations — one user's
   hat must never change what the system concludes about *another*), 1 already-ruled
   (`session_context`). **No mixed-shape function.** Each of the 5 carries a **red-first** keystone
   (`316_act_p0_caller_gate_sweep.sql`) confirmed RED against the unfixed catalog.
   Fixed: `commission_overview` · `list_org_people` (hospital_admin arm) · `quality_board_summary`
   (42501 entry gate) · `capa_kpis` (nsp_coordinator arm) · `pqs_inbox`.
**Residuals backend flagged, closed by the lead from the catalog:** no view or matview in
`app`/`public` reads `memberships` (0), and only 3 functions read `request.jwt.claims` directly
(`active_role`, `is_admin`, `assume_role`) — all hat-aware by construction. The sweep criterion
(direct `memberships` reference) was therefore sufficient, not merely convenient.
⚠ **Standing-sweep candidate** (backend's suggestion, endorsed, NOT actioned): `capa_kpis` had a
safe arm and a raw arm side by side, so this population accreted from different authors over time.
"Raw `memberships … principal_id = auth.uid()` with no adjacent hat condition" belongs in the
ADR 0079 standing sweep, not as a one-off — same lesson that ADR's own history teaches.

**Lead correction:** I cited `open_capa_plan` to backend as an evidenced caller-gating defect,
reading the tester's AC-5b note as an over-permission. **It is the opposite** — the test expected
authorization to SUCCEED and it failed, i.e. a hatless token being correctly *denied* (D5 working).
Backend caught the misreading instead of building on it, could construct no red-then-green proof,
and said so rather than claiming a vacuous keystone. It hardened the function anyway as
defence-in-depth — recorded as a **non-regression change, not a security fix**.

**S3 lead notes — rulings and finds during the build:**
- **D11's `is_admin()` clause was MISSING from the plan** (backend flagged it; ADR 0106 D11 requires it —
  "`is_admin()` gains the same active-role condition"). **PO ruled 2026-08-10: implement in S3, not S4.**
  Sized first: 26 RLS policies + 17 functions + ~30 TS sites, but **provably a no-op today** (0
  platform_admins hold a membership ⇒ all single-role ⇒ hat derived implicitly). Proof required a
  **synthetic multi-role platform_admin** — the only fixture that can distinguish the two
  implementations; without it the no-op claim is vacuous. A **tripwire** now reds if any
  platform_admin ever gains a membership, because the whole argument rests on that set being empty.
- ⚠ **`assume_role` had a chicken-and-egg bug, caught before shipping:** its `platform_admin` branch
  called `is_admin()` to test eligibility to *acquire* the hat — circular once `is_admin()` requires the
  hat already active. Proven live, fixed against raw `profiles.is_admin`. **This is the break-glass
  path the ADR explicitly protects** ("must never depend on the picker").
- **The 3-arg `has_role` came back BLIND and was DROPPED, not keystoned.** It was a pure delegation to
  the 4-arg, so S3 changed *what it meant* without changing its text — the recurring shape here. Zero
  callers proven across four surfaces (928-function corpus · `pg_policies` all schemas · seed/demo ·
  TypeScript), so it was unreachable rather than unguarded. `ARM=census` live gates 451→450 confirms.
- **Plan correction:** `ARM=census` did **not** grow for `active_role()` — census counts **boolean**
  gates and `active_role()` returns `text`. The plan predicted census would be the arm that sees it.
  Real coverage for the hat is the **revert-twin keystone**, not census.
- **`BUG-ACT-NULLHAT-1`:** the plan's own literal `p_role = app.active_role()` is NULL for a hatless
  caller, so `IF NOT has_role(…)` never fired — **the prescribed fix was a fail-open**. Fixed with
  `IS NOT DISTINCT FROM`. It cannot reintroduce a both-NULL hole: a NULL `p_role` can never satisfy
  `m.role = p_role` in the membership test that runs ahead of the hat condition.
- ⚠ **Where a D9 hint actually renders:** a guard's `notFound()` thrown in `layout.tsx` is caught by an
  **ancestor** boundary, **never** by a `not-found.tsx` sibling in its own directory — here the
  **global `src/app/not-found.tsx`**, as neither `[org]/` nor `o/` has an intervening layout. Disproved
  the design note's assumption three ways incl. on a real `next build`. The 6 area boundaries are kept
  for the narrower page-level case.
- **Keyboard-only is the tester's proof, not frontend's** — the frontend engineer could not drive
  trusted keyboard events (browser pane not compositing) and said so rather than claiming it.

**Lead notes / decisions taken during the build:**
- **S0 placement — the enum lands in `public`, not `app`** (lead ruling 2026-08-09, on a real S0
  finding). `config.toml` exposes `["public","graphql_public"]`, so an `app`-schema enum is invisible
  to `gen:types` — which silently breaks the plan's "the picker (via generated types)". Exposing `app`
  was rejected outright (it would put every `app` DEFINER door on PostgREST); a hand-kept TS mirror is
  a stale-assertion generator. A bare enum TYPE in `public` is not a relation — no endpoint, no RLS
  surface — and `public.audio_job_status` is the existing precedent. Schema placement was never one of
  the PO-locked P1–P6 decisions.
- **S1 scope reversal — the 20 `224_memberships_collapse.sql` sites ARE routed** (lead, 2026-08-09,
  overriding a "disproportionate for a harness-only stage" deferral). That file is the program's
  epicentre, not its periphery: its own header calls it *"the lock"*, §5 asserts
  `grant_role → wrapper true` and §7 is a 27-wrapper truth table — all resolving through `has_role`,
  the exact function S3 amends. Those sites hand-mint the JWT with `jsonb_build_object`, so they
  **bypass `custom_access_token_hook`** and the implicit single-role derive (which happens at
  token-mint) can never rescue them: at S3 `active_role()` returns null and every wrapper-true
  assertion flips red *inside* the one red window. Routing with `p_active_role => null` is inert today
  and makes S3 a one-argument flip per site.
- **S3 obligation — `accessToken` (the raw-JWT E2E helper) has NO seam, and the reason matters.**
  It performs a genuine password grant, so unlike the pgTAP sites it passes **through** the hook.
  That inverts the exposure: single-role personas get an implicitly-derived hat and keep working;
  a **multi-role** persona opens a new session with no selection row ⇒ no claim ⇒ **stranger**. Safe
  today only by construction (`dualhat.a@` is the sole multi-role principal and no spec uses it yet).
  ⚠ A raw grant has its **own `session_id`** and cannot inherit a hat chosen in a browser context —
  one seam does not cover both. Full obligation + why it is also S3's best "hatless ⇒ stranger"
  probe: [act-as-buildnotes.md](docs/plans/act-as-buildnotes.md) (Stage 1 tester-half section).
- **Migration window:** `20260918000000`+ (above the highest registered `20260917000400`). S2 owns
  `20260918001000`+, S3 `20260918002000`+ — a shared local stack is in play.
- ⚠ **S2 must not start while a full e2e:prod gate is running** — authoring a migration FILE mid-gate
  applies on the next batch and has voided a run here while still exiting 0.
- `.next/types` was never generated in this fresh worktree, so the first `npm run typecheck` failed on
  an untouched route file. `npm run build` once populates it. **Not a defect** — do not chase it.

### ⬛ PDF·P2 — PDF printing: Meetings (ata) · **COMPLETE 2026-08-08** · QA **APPROVED (r2)**

Full record (task table M-B1…M-Q1, lead notes, gate detail, the BLOCKER→Package-A narrative)
rotated → [pdf-p2-meetings.md](docs/progress/pdf-p2-meetings.md). ADR
[0104](docs/decisions/0104-pdf-document-printing-module.md) **Amendments A7/A8/A9** (the
PO "Package A" ruling) · review [phase-PDF-P2-review.md](docs/reviews/phase-PDF-P2-review.md)
(⛔ r1 → ✅ r2) · migrations `20260914000000`+`…000100` · pgTAP `312`+`313` **128/128** ·
tester 12/12 ×2 + A7 respondent-denial ×3 · e2e:prod GREEN 0 real failures/1030 · the binding
scope question **HELD** (kind-sites = exactly 3, the A8 trio; a 4th = leak).
**⚠ NOT pushed anywhere (PO instruction 2026-08-08): `main` merge is LOCAL-ONLY — no `git push`,
no remote `db push` of the two P2 migrations. The PO is handling the pending items below.**

**📌 PDF program — ALL open items (registered for the PO, 2026-08-08):**
- `[x]` **FUP-PDF-1 — RESOLVED 2026-08-08** (creator mint surface shipped: new respondent route
  `…/c/[commission]/respostas/[responseId]`; entry archived → follow-ups-archive.md). Carried a
  pre-existing find, **BUG-RESP-001**, fixed with it — Bug Log below.
- `[ ]` **FUP-PDF-2..4** — full entries under [Follow-ups](#follow-ups--deferred-items) below.
- `[x]` **BUG-PDF2-002** — RESOLVED BY-DESIGN 2026-08-08 (Next's streamed-notFound contract; no app change; contract pinned in E2E — Bug Log below + bug-log-archive.md for the full record). The session task chip was withdrawn.
- `[ ]` **Remote `db push`** of `20260914000000` + `20260914000100` — NOT done (PO instruction); local + remote catalogs now DIFFER on the meeting arm until pushed.
- `[ ]` **`git push origin main`** — the P2 merge is local-only; origin/main is at the P1 state (`9373ce8`).
- `[ ]` **Gotenberg Coolify resource** — runbook [docs/deployment/pdf-renderer.md](docs/deployment/pdf-renderer.md); flag `document_printing` stays OFF in prod until this + both pushes exist.
- P3 build carry-forwards (not user actions): `can_read_full_meeting_content` is fail-open STANDALONE — never reuse without the `can_reach_meeting` conjunct; becomes `COMMENT ON FUNCTION` in P3's first migration · P4 repoints the relocated fail-closed keystones again (noted in-file in `312`/`313`).

### ⬛ Recently completed — rotated 2026-08-08; detail in `docs/progress/`

One line each. Gate numbers live in the **Phase Status** table above; the linked record carries the
task table, findings and narrative. "Still open" points at the live sections further down this file.

| Work | Done | Record | Still open (none blocking, tracked below) |
| --- | --- | --- | --- |
| **QO·B** — Quality-office oversight, Phase B (content wall + UI coherence) · QA APPROVED (r2) | 2026-08-09 | [quality-office-oversight-phase-b.md](docs/progress/quality-office-oversight-phase-b.md) · ADR [0100](docs/decisions/0100-quality-office-oversight.md) D12 · [review](docs/reviews/phase-QO-B-review.md) | **BUG-QOB-004** (Bug Log) · **FUP-QOB-1 + FUP-QOB-2** (Follow-ups — the PO ratification package, parked for a future session) |
| **PDF·P1** — PDF printing: Forms + full skeleton · QA APPROVED (r2) | 2026-08-08 | [pdf-p1-forms-skeleton.md](docs/progress/pdf-p1-forms-skeleton.md) · ADR [0104](docs/decisions/0104-pdf-document-printing-module.md) A1–A6 | FUP-PDF-2..4 (Follow-ups); deploy prereqs + push status in the **PDF·P2** block above |
| **QO·FUP** — FUP-QO close-out (F1–F9) · QA APPROVED (r2) | 2026-08-07 | [qo-fup-close-out.md](docs/progress/qo-fup-close-out.md) · ADRs 0101/0102/0103 | FUP-QO-6 (accepted-provisional, LOW) · FUP-QO-9 |
| **QO·A** — Quality-office oversight, Phase A · QA APPROVED (r3) | 2026-08-07 | [quality-office-oversight.md](docs/progress/quality-office-oversight.md) · ADR [0100](docs/decisions/0100-quality-office-oversight.md) | FUP-QO-1…6. ⚠ Phases **B** (org_admin content wall) and **C** (lifecycle + break-glass) are **not started**; **read the record's closing rule before B** — *conferring a capability bit requires enumerating its consumers* |
| **MIN** — Meeting audio → generated ata; flag `audio_minutes` ships **OFF** (`seed.sql` forces ON for local/E2E, so a flag-OFF spec must toggle it itself) · QA APPROVED (r2) | 2026-08-06 | [min-audio-minutes.md](docs/progress/min-audio-minutes.md) | FUP-MIN-CUTOVER (the pre-enable gates) |
| **AFF** — Hospital affiliation, person identity & the org people directory · QA APPROVED (r2), PO-approved | 2026-08-06 | [hospital-affiliation-person-identity.md](docs/progress/hospital-affiliation-person-identity.md) · ADRs [0097](docs/decisions/0097-hospital-affiliation-person-identity.md)/[0098](docs/decisions/0098-aff-w1-substrate-shape-decisions.md) · `docs/backend-state.md` (AFF) | FUP-AFF-1…4 — **FUP-AFF-1 carries the standing trap: never cite `ARM=census` for AFF's doors** · BUG-BOOTSTRAP-001 (Bug Log) · the remote `db push` it made mandatory = *Remaining pre-pilot work* item 2 |
| **Membership hardening + Diretor Técnico** (ADR 0094) — W1→W4 merged, DT flag ON (`20260905000600`) | 2026-08-05 | [membership-hardening-technical-director.md](docs/progress/membership-hardening-technical-director.md) | — |
| **Case-type assignment** (ADR 0088) — shipped alongside the above | 2026-08-05 | [case-type-assignment.md](docs/progress/case-type-assignment.md) | — |
| **PCI + TV** — Process/Case Integrity & Template Versioning · QA APPROVED (r2) | 2026-08-05 | [process-case-integrity-and-template-versioning.md](docs/progress/process-case-integrity-and-template-versioning.md) | FUP-PCITV-1 |

### 📋 Remaining pre-pilot work

Scope was set by ADR [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md) (12 initiatives)
and re-expanded by ADR [0086](docs/decisions/0086-flexible-forms-pre-pilot.md) (FF-1…FF-5); ADR
[0093](docs/decisions/0093-phase-16-standards-crosswalk-replan.md) then re-gated Phase 16 in front of
the pilot. **That block is complete — but ADR [0097](docs/decisions/0097-hospital-affiliation-person-identity.md)
(AFF) re-gated the pilot on 2026-08-05; see item 1.** Completed items are not re-listed here; the Phase
Status table above is the index. What is actually left:

**1. ✅ AFF — COMPLETE and PO-APPROVED 2026-08-06**, no longer gates the pilot deploy. Row in the
*Recently completed* table above.

**1b. 🟡 ACT — "act as" strict role assumption (ADR [0106](docs/decisions/0106-act-as-role-assumption.md))
— IN PROGRESS, and it sits in FRONT of item 2.** PO decision 2026-08-09: **before the pilot**. D10's
big-bang justification depends on that ordering — **if the pilot moves first, D10 must be
re-litigated.** Stage table + lead notes in *Current Phase Tasks* above. Note the cutover is
**unflagged by decision** (P4) and forces re-login: stale pre-cutover sessions see stranger-level
nothing until they sign in again, which is acceptable only because it lands pre-pilot.

**2. 🔴 The pilot deploy itself — user-gated, NOT started. This is the next thing *after* 1b.** Two halves,
both now **behind** `main`, per the PO's 2026-08-08 hold on PDF·P2:
- **`git push origin main`** — ⚠ **NOT done.** Live `git fetch` 2026-08-08: local `main` `970fc68`,
  `origin/main` `9373ce8` (three commits ahead — the P2 merge + FUP-PDF-1 + this rotation). *This row
  previously claimed `main == origin/main`; that was true only until the P2 merge landed locally.*
- **Remote `db push`** — the AFF batch (2026-08-06) and the five PDF·P1 migrations (2026-08-08) are
  **pushed and remote-catalog-verified** (Phase Status rows AFF / PDF·P1). What is **not** pushed:
  `20260914000000` + `20260914000100` (PDF·P2), held by PO instruction — so local and remote catalogs
  currently differ on the meeting arm. ⚠ The push needs the **user's own auth**; background agents are
  auto-denied.
- Then the **Coolify** app deploy — **this is when the ETH·E1 m2 flag flip reaches production**, and
  when `document_printing` can be turned on (after the Gotenberg resource, PDF·P2 block above).
⚠ Verify both halves live (`git fetch` + the remote catalog) before acting on this row — it has been
stale in both directions before.

**3. ⬛ ~~BUG-AUTHZ-002~~ — FIXED 2026-08-05** (`20260908000100`, held by
`299_hospital_content_door_noun_rule.sql` 11/11); no longer gates the deploy. Full entry, including
why the parity test this row prescribed had to be written differently (the property returns **four**
doors; `verify_audit_chain` must NOT return zero rows) →
[bug-log-archive.md](docs/progress/bug-log-archive.md).

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

⬛ **BUG-ACT-RAWGRANT-HATLESS-1 — RESOLVED same-session 2026-08-10 (`tester`, coordinator-
authorized follow-up).** Re-bounded by the property, not the name, per the coordinator's own
correction of their earlier "accessToken has zero callers, nothing for you" check (which was
itself name-bounded — the exact mistake this repo has logged before): **58 files** in `e2e/`
perform a raw password grant (`grep -l grant_type=password`); of those, **22** (not the
coordinator's provisional 20, not the tester's own first-pass 20 either — see below) intersect one
of the 6 multi-role personas, once traced past every layer of indirection:
- **19** by literal string (matches the coordinator's 20 minus the tester's own new file):
  `case-patient`, `charters-cadence`, `ff3-validations`, `helpers/accreditation.ts`,
  `mem-memberships-collapse`, `notifications`, `patient-index`, `perf-sweep-wave2`,
  `phase10-meetings`, `phase13-audit`, `phase14a-safety-events`, `phase14b-triage`,
  `phase14c-rca`, `phase14d-capa`, `phase15-indicators`, `phase22-referrals`, `phase7-cases`,
  `phase8-dashboard`, `phi-remediation`.
- **+3 found only by tracing transitive imports / dynamic queries**, invisible to any name or
  literal-string sweep: `phase16-accreditation-clone.spec.ts` + `phase16-accreditation-hospital
  .spec.ts` (both import `getToken`/`ORGADMIN_B`/`STAFF1_QUAL_B` from the SHARED
  `helpers/accreditation.ts` — the risky VALUE lives in a different file than the risky CALL);
  `ethics-e2-procedure.spec.ts` (a `computeEligibleVoters()` roster query resolves CCIH's real
  `memberships`, which includes pqsdual.a@ as a genuine `staff` row — the persona arrives via a
  DB round-trip, not a constant at all).
- Of the 19 literal-string files, **4 turned out to be false positives on re-verification**
  (`case-patient`, `phase10-meetings`, `phase7-cases`, `phase8-dashboard` — the persona name
  appears only in a header-comment persona list; every actual `getOwnerToken`/`getToken` call
  in each file uses an unrelated single-role persona, confirmed by enumerating every call site,
  not just grepping the risky string). **1 more (`perf-sweep-wave2`) had its helper converted for
  consistency but had no actually-risky call site** (only ever calls with `chefe.ccih@`).
- **Self-correction recorded, not hidden:** the tester's own FIRST pass over this list missed
  `phase14c-rca.spec.ts` and `phase14d-capa.spec.ts` (13 raw-grant sites each, 26 total) — both
  appeared in the same `grep` output as every other hit, but the tester's initial read concluded
  "comment-only" without checking their ACTUAL `getOwnerToken(request, ADMIN_EMAIL)` call sites,
  the same class of gap the coordinator's own correction was about, one layer further in. Caught
  by a maximally-thorough final sweep (per-file, not globally-deduplicated) before declaring done.

**Fix, as specified:** built the hatted `accessToken(target, email, password?, actAs?)` in
`e2e/helpers/auth.ts` (grant → `assume_role` against THAT grant's own session → refresh → return
the hatted token; cache partitioned by `email::actAs`, mirroring `cachedSignIn`; accepts either a
`Page` or a bare `APIRequestContext` so every local helper's existing call shape works
unchanged). Smoke-tested directly before converting any consumer (hatless → `active_role:
undefined`; hatted → correct claim; cache/partition both verified). All ~13 local
`getOwnerToken`/`getToken`/`ownerToken`-style helpers across the 22 files now delegate to it
(none needed to stay independent — delegation was possible everywhere). `actAs` threaded per
call site under the SAME union-vs-single-hat test used for the cookie surface — verified live
per file after threading (not assumed), which caught 3 real misclassifications before they
shipped: `phase22-referrals.spec.ts` Flow 4c needed `org_admin` (a coordinator-equivalent
stand-in), not `pqs_member`; the `nsp-per-hospital.spec.ts` AC-7 dispose tests and
`phase22-referrals.spec.ts` Flow 3d/5a needed `staff` for ROUTE ENTRY (a commission-scoped URL —
`is_pqs_operator_of` admits the bare `commissions` RLS row but not the referral-hub page itself,
confirmed by a live 404 under `pqs_member`); `ethics-e2-procedure.spec.ts`'s dynamic voter loop
needed each voter's OWN role from `computeEligibleVoters()` (extended to carry it through) rather
than one blanket hat, since the roster mixes `staff` and `staff_admin` CCIH members.

**Findings from raw-grant verification — both since RE-SCOPED per PO ruling 2026-08-10 (see
"ACT — union tests re-scoped" below), no longer left red:**
- `phase15-indicators.spec.ts` AC-5b and `phase22-referrals.spec.ts` Flow 3d, both originally
  filed here as accepted "union" losses, were rewritten (not deleted) once the PO ruled on them —
  each half now passes under its own correct hat, PLUS an explicit new assertion proving the
  specific combined-single-session flow is genuinely gone. Detail in the ACT union-tests entry
  below; both green as of this commit.

**Also found and fixed en route (same bug class, blocking verification of the above, not a new
class):** two MORE instances of `BUG-ACT-NOTFOUND-COPY-1` (below), in `ethics-e2-procedure.spec.ts`
(`assertRouteDenied`, cascading via `test.describe.configure({mode:'serial'})` — blocked FLOW-7,
the test actually exercising the pqsdual.a@ dynamic-role fix, until corrected) and

⬛ **RESOLVED via rewrite 2026-08-10 (`tester`) — `phase22-referrals.spec.ts` Flow 5a was a
THIRD instance of the exact shape the PO ruled on for AC-5b/Flow 3d,** found re-running the
touched specs after that first rewrite, not caused by it: its `signInAs(page,
'pqsdual.a@test.local', undefined, 'staff')` is unchanged from the tester's EARLIER commit
(`a8da28d`) — confirmed via `git log -p`. First flagged (not rewritten) respecting that round's
"then stop" boundary, since the PO had not reviewed this specific test. **The PO has since
reviewed it and extended the ruling; rewritten this round.** Detail in the ACT union-tests entry
below. **Compounding finding, now corrected in the rewrite:** the test's old `else` branch ended
"if PHI doesn't appear at all, the lazy door works correctly — nothing to assert" — a SILENT
vacuous-pass fallback for exactly the case that's now structurally permanent, meaning the
tester's earlier "3 passed" report for this test (BUG-ACT-RAWGRANT-HATLESS-1 close-out) almost
certainly reported a vacuous pass, not a real one. That fallback does not survive the rewrite —
every branch now asserts unconditionally.

**Bounded vacuous-branch check, `phase22-referrals.spec.ts` ONLY, per the coordinator's explicit
request (2026-08-10, `tester`) — do not sweep the repo; report even a null result.** Read every
conditional in the file (not just around Flow 5a). Findings filed below as their own durable
entry, not left as a chat-only note. Checked and confirmed NOT vacuous (both branches, or an
unconditional fallback, always assert) — recorded so this reads as a real audit, not a
cherry-picked one: Flow 1c/2c (`if/else`, each arm asserts a shape of "no access"); Flow 5b
(inner `if (resp.ok())` is optional, but an unconditional audit-row-count check always runs after
it); Flow 7c (an unconditional `not.toBeNull()` precedes the only conditional, so the branch is
unreachable-false by construction); Flow 8b (either arm — `sendBtn` visible or not — contains at
least one unconditional `toBeFocused()` before any further nested, optional checks).

🟡 **BUG-VACUOUS-ASSERT-1 — OPEN, pre-existing, unrelated to ACT (`tester`, found 2026-08-10 via
a coordinator-requested bounded check of ONE file — see above). Filed, NOT fixed: every "small"
fix attempted in this program turned into an investigation; these four are each their own test,
not the union-gate shape ADR 0106 is ruling on, and fixing test logic without the file owner's
review is exactly the boundary a tester holds.**

**The general shape, which is what makes this actionable later, not just these four instances:**
a conditional whose branches do not all assert is a test that reports confidence it never earned.
`if (cond) { assert } ` with no `else`, or an `else` whose own assertion is itself optional, lets
the test go GREEN having checked nothing — indistinguishable in the report from a test that
verified the real thing. This is not the "vacuous pass" this program already fixed twice
(Flow 5a's old `else { /* nothing to assert */ }`, and the tester's own near-miss — a tautological
`else { expect(revealBtnCount).toBe(0) }`, true by the very condition selecting the branch); it is
the SAME defect class, general enough that it will recur anywhere a conditional exists without a
matching unconditional or exhaustive-branch assertion.

**Four confirmed instances, `phase22-referrals.spec.ts`, none fixed:**
- **Flow 4c** (`response_expected=false` referral) — `if (!draftResp.ok()) { return }` exits the
  whole test with **zero** assertions if that fires; even past it, a second guard `if (refId) {
  …only assertion here… }` means a truthy-`ok()`-but-falsy-`refId` response also asserts nothing.
  Two independent silent-pass exits in one test.
- **Flow 5c** (plain B member, PHI bodies null) — the ENTIRE test body is `if (resp.ok()) { if
  (body !== null) { asserts } }`; if `resp.ok()` is false OR `body === null`, the test completes
  with zero assertions. No unconditional fallback anywhere in the test.
- **Flow 5d** (direct SELECT denial) — `if (resp.ok()) { if (rows.length > 0) { assert } } else {
  assert }`. The `else` always asserts, but if `resp.ok()` is true AND RLS returns zero rows
  (rather than an explicit error), the `if` branch asserts nothing and the `else` never runs —
  same silent-pass shape as Flow 5c, gated one level deeper.
- **Flow 8c, called out specifically — keyboard-only, reply form.** Two independent, un-elsed
  `if (isVisible) { assert }` blocks (reveal button, back link), **no unconditional assertion
  anywhere in the test**. If neither element is visible when the page loads, the test passes
  having asserted nothing at all. This one is not just another instance: **its own title claims
  to verify keyboard accessibility** — a house requirement (CLAUDE.md §8: "every form input
  accessible... the tester includes at least one keyboard-only flow per phase") — so a green here
  actively asserts a compliance property that, in the all-elements-absent case, was never checked.
  A misleading vacuous pass on an accessibility test is worse than one on a data assertion: it is
  the exact artifact the house rule exists to prevent, reporting satisfied when it is silent.

**Why this is worth a dedicated pass, not opportunistic per-file fixes (recorded per the
coordinator's instruction):** this shape is invisible to every gate in the project — lint doesn't
flag it, typecheck doesn't either (both branches are valid TypeScript), and a passing Playwright
run reports exactly the same GREEN whether the meaningful branch ran or not. It surfaced here only
because ADR 0106 made one specific branch (the `staff`-hat entry into this exact commission-scoped
route) permanent for the first time — before that, no run had ever forced `if (revealBtn.isVisible)`
down the non-vacuous path for this persona. The other four instances were not caused by any
structural change; they have presumably been silently skipping their meaningful branch, or
silently taking it, for as long as they've existed — nobody knows which, because nothing recorded
which branch ran. **Candidate follow-up, not undertaken here:** a repo-wide vacuous-pass audit —
grep every `if` inside a `test()` body for a branch with no `expect()`/`await expect()` call
reachable from it, by AST or by careful regex, and check whether an unconditional assertion
elsewhere in the same test would still catch a regression if that branch's logic silently broke.
That is real, standalone work, and belongs in its own pass. **This bounded check covered exactly
ONE file** (`phase22-referrals.spec.ts`, per explicit scope) out of `e2e/`'s full spec count —
**the four found here are a lower bound on the shape's prevalence, not a count of it.**

**Also found, same re-run, FIXED this round (authorised):** `phase15-indicators.spec.ts` AC-8a
and AC-8b both pinned `getByRole('heading', { name: /encontramos esta página|Erro 404/i })` —
the SAME `BUG-ACT-NOTFOUND-COPY-1` shape (a boundary-copy alternation that doesn't include
"Página não encontrada"). Fixed with the established `/não encontr/i` pattern, matching the 5
already-fixed instances (incl. `phase13-audit.spec.ts` AC-3e).

⬛ **ACT — union tests re-scoped, PO ruling accepted 2026-08-10 (`tester`, backend traced both
mechanisms, PO ruled "accept both losses").** `phase15-indicators.spec.ts` AC-5b and
`phase22-referrals.spec.ts` Flow 3d rewritten in place, not deleted — each asserts what is now
TRUE under its own hat, plus an explicit proof of the specific thing that's genuinely gone.
- **AC-5b — the inherited mechanism comment was WRONG, corrected as part of the rewrite.** The
  pre-ACT comment (never independently re-verified until now) described `open_capa_plan`'s gate
  as `is_tenancy_admin_of(source_commission) OR is_pqs_operator_of(hospital)`. Read live from
  `pg_get_functiondef`: for `p_source = 'indicator'`, `v_hospital` resolves unconditionally from
  the indicator's own commission, so the function's only membership-fallback branch (the sole
  place any tenancy-admin check could live) never executes — the ONLY authorization check is
  `app.is_pqs_operator_of(v_hospital)`. There never was a two-armed OR; it is TWO SEPARATE
  SEQUENTIAL gates (PAGE ENTRY = `canConfigureCommission`, staff_admin/tenancy-admin; the RPC
  itself = `is_pqs_operator_of` alone) that a hatless session used to satisfy together and no
  session can anymore. Rewrite: UI half stays `org_admin` (unchanged, already passing); RPC half
  now correctly hatted `pqs_member` (an independent raw-grant session — it was ALREADY a separate
  credential from the UI's cookie session, only the hat was missing, so nothing about the
  operator-tier authorization/data-contract proof was actually lost); NEW assertion added —
  `pqs_member` gets 404'd on the indicator page itself, proving the single-session "view this page
  and click a button here" journey is structurally gone. All three pieces green.
- **Flow 3d — same two-gates shape** (`staff` for commission entry, `pqs_member` for
  `can_read_referral_phi`, verified live: `is_pqs_operator_of_for(...) OR is_staff_admin_of_for(...)
  OR <target arms>` — pqsdual.a@ is plain `staff`, not `staff_admin`, at CCIH). Rewrite: `staff`
  half now asserts the PHI result is POSITIVELY withheld ("Sem resultado registrado", the real
  result text confirmed absent) rather than expecting it visible; NEW assertion — `pqs_member`
  gets 404'd on the same commission-scoped route, proving the combined flow is gone. Per the PO's
  own reasoning (the NSP surface is deliberately PHI-free / has no deep link here, by design, not
  by this gap) — not independently re-tested here (would expand scope beyond the two named tests;
  flagged as a candidate follow-up if that NSP-surface behavior itself ever needs its own spec).
- **Flow 5a — EXTENDED to this test 2026-08-10, same session, after the PO reviewed it.** Same
  predicate as Flow 3d (`get_referral_patient` is gated by the identical `can_read_referral_phi`
  that withholds `result_md`), same incompatibility (`staff` passes entry/fails PHI, `pqs_member`
  passes PHI/404s entry — the 404 proof reused directly from Flow 3d's own live run, per the
  coordinator's "same-shape edit, not a new investigation," not re-verified as a fresh
  experiment). Rewrite: `staff` half now asserts the reveal control discloses nothing and no
  `referral_patient.read` audit row fires, with NO silent-fallback branch (see the bounded
  vacuous-branch check above — the tautology risk in the naive "else { expect(count).toBe(0) }"
  shape was caught and removed before landing: that assertion is true by the very condition that
  selects the branch, so the real proof was moved to an unconditional block that runs regardless
  of which way the conditional goes); `pqs_member` 404s the same route. **Unlike Flow 3d** —
  where the underlying "an entitled reader sees the PHI" fact stays covered elsewhere (chefe.ccih,
  Flow 1b) — this WAS the only test in the file exercising the `referral_patient.read`
  AUDIT-WRITE mechanism itself (row appears on reveal, PHI-free metadata, source-commission
  attribution — Rule 11), and that mechanism was not re-proven by the first rewrite for ANY
  persona, because the original test's only actor was a QPS-operator-only identity. First round:
  flagged rather than added, since "same shape as Flow 3d" was the instruction and a third
  persona/track went beyond that literal shape.
- **RESTORED 2026-08-10, coordinator's explicit call, same session: "your flag was right and the
  answer is yes... losing a PHI-audit proof as collateral from ACT is a genuine regression in the
  platform's compliance posture, not tidy-up."** Added a Part A block ahead of the union-gate
  rewrite, using `chefe.ccih` (staff_admin CCIH, the source coordinator) exactly as flagged —
  already proven live (Flow 1b) to pass the identical `can_read_referral_phi` gate; always could
  reach this route and reveal PHI, pre- and post-ACT alike, no hat ever involved for her; NOT a
  widening. Asserts the MECHANISM, not the journey: PHI visible on screen (a real positive
  control — see below), a `referral_patient.read` row appears, its metadata carries no PHI, and
  `commission_id` is the source commission.
- **Non-vacuousness, established four ways, not just asserted green (per the coordinator's
  explicit "say how"):**
  1. **A REAL, unplanned failure caught it before this was even finished.** The first draft used
     `revealBtn.isVisible({ timeout: 5_000 })` to gate the click — Playwright's `isVisible()` does
     NOT auto-wait (confirmed from the docs and from the failure itself: the error-context
     snapshot showed the button still unclicked, "Exibir identificação," 10+ seconds after
     navigation), so the check raced the panel's render and skipped the click. The test FAILED
     for exactly this reason on the first real run — not manufactured, an actual defect in the
     tester's own draft, caught by the assertion doing its job. Fixed with a genuine
     `locator.waitFor({ state: 'visible' })` before the plain `isVisible()` check.
  2. **Positive control on the PHI-visibility assertion itself**: `expect(getByText(PHI_NAME))
     .toBeVisible()` is not conditional on anything — if the reveal mechanism silently broke, this
     is what would catch it, and finding #1 above is direct proof it does.
  3. **Live inspection of the actual audit row, not just its shape**: `select metadata,
     commission_id from audit_log where action='referral_patient.read' order by occurred_at desc
     limit 1` → `metadata = {"acting_as": "staff_admin"}`, `commission_id = COMM_A`. Real,
     non-empty, non-trivial content — rules out the "assertion is vacuously true because the field
     is always empty" failure mode for the metadata check.
  4. **Deliberate mutation, isolated one at a time, each confirmed RED for the right reason, then
     reverted**: (a) `toBeGreaterThan` → `toBe` (claims no new row) — RED, `Expected: 1, Received:
     2`; (b) `not.toContain(PHI_NAME)` → `toContain(PHI_NAME)` (claims PHI IS in metadata) — RED,
     the error printed the REAL metadata (`{"acting_as":"staff_admin"}`) failing to contain it;
     (c) `commission_id` expected value flipped `COMM_A` → `COMM_B` — RED, `Expected: …b1,
     Received: …a1`. All three reverted; final state re-verified green
     (`git diff` shows zero `TEMP MUTATION` markers remaining).
- **Both re-verified green** after rewrite (`npx playwright test ... -g "AC-5b|AC-6"` and
  `-g "Flow 3d"`, chromium, `--workers=1`); **Flow 5a re-verified green** standalone, after each
  mutation revert, AND as part of a full-file run on a fresh `db reset`
  (`phase22-referrals.spec.ts` 40/40).
- **Tester's view on "assert absence" as the shape:** right for all three. It's not just the
  least-bad option — it's a STRICTLY STRONGER test than the one it replaces: the original only
  ever proved "a hatless admin@/pqsdual.a can do X", conflating two gates that happened to both be
  reachable by coincidence of one persona's total membership set. The rewrite proves each gate
  individually AND proves they no longer compose, which is the actual ADR 0106 claim (D5) — the
  old test never asserted that composition was even meaningful, let alone gone.

⬛ **BUG-ACT-AUDIT-PLATFORM-TIER-1 — RESOLVED by `backend` (migration
`20260918002600_act_assume_role_audit_scope.sql`), re-verified by `tester` 2026-08-10.**
Originally: `phase13-audit.spec.ts` AC-3f-platform (`platform@`, untouched by any ACT work)
asserts the audit_log "platform-tier chain" (organization_id AND commission_id both NULL) is
permanently empty; `assume_role`'s own audit action, `active_role.assumed`, wrote with BOTH null
unconditionally, so any earlier picker/switch use in the same database populated the bucket.
**Fix, re-verified live via `pg_get_functiondef(assume_role)` on the current migration head:**
`assume_role` now looks up the actual `memberships` row backing the role being assumed (`select
organization_id, hospital_id, commission_id from memberships where principal_id = v_uid and role
= p_role::text …`) and passes THAT tenant into `audit_write`, instead of always passing null.
Only `p_role = 'platform_admin'` still stamps all-null — an explicit, commented, correct
carve-out ("No tenant to stamp — the ruling's own carve-out"), since a platform_admin genuinely
has no tenant. **Confirmed empirically, not just by reading the function**: ran
`phase22-referrals.spec.ts` (40/40) + `phase15-indicators.spec.ts` (12/12) on a fresh reset — both
exercise multiple `assume_role` hat-switches — then queried `audit_log` directly: **zero**
`active_role.assumed` rows with org+commission both null; every row carries the real tenant of
the assumed role. See BUG-CAPA-AUDIT-SCOPE-1 below — the second, independent, pre-existing
mechanism that pollutes the same bucket remains open; this one's resolution does not close that.

⬛ **BUG-CAPA-AUDIT-SCOPE-1 — RESOLVED 2026-08-10 (`backend`, migration
`20260918002700_act_capa_audit_scope_fallback.sql` + red-first keystone
`supabase/tests/317_act_capa_audit_scope.sql`, commits `bf85bce`+`55f4759`; this entry was
stale-OPEN — the lead audit session reconciled it against the live catalog:
`trg_audit_capa_plan` now falls back to `new.hospital_id`, verified via `pg_get_functiondef`,
sibling-trigger sweep + catalog property diff in the buildnotes' own section).** The
batch-packing red it could inflict on `phase13-audit` AC-3f-platform is therefore closed at
the mechanism, not by loosening the assertion. Original finding preserved below:
~~🟡 BUG-CAPA-AUDIT-SCOPE-1 — OPEN, pre-existing, NOT caused by ACT (`backend` traced the~~
mechanism; `tester` independently verified against the live catalog + confirmed live in this
database, 2026-08-10; filed per the coordinator's explicit instruction — not fixed).**
`app.trg_audit_capa_plan` (verified live via `pg_get_functiondef`) resolves audit scope ONLY via
`v_comm := case when v_event is not null then app.commission_of_event(v_event) else null end` —
i.e., only `source='event'` CAPAs ever get a commission. For `manual`/`meeting`/`indicator`/
`audit_finding`-sourced CAPAs, `v_event` is null, so `v_comm` is null, and `audit_write(...,
p_commission => null, ...)` is called with NO `p_organization`/`p_hospital` override either —
landing the row in `audit_write`'s own documented "platform chain (all NULL)" bucket (verified
live from `audit_write`'s `pg_get_functiondef`), even though `capa_plan.hospital_id` is a REAL,
POPULATED column on the very same row (`open_capa_plan` always sets it, for every source type)
that the trigger simply never reads. **Confirmed live in this database**:
`phase14d-capa.spec.ts` opens 5 manual-source plans (`p_source: 'manual'` at 5 call sites); `select
action, organization_id, commission_id, hospital_id, count(*) from audit_log where
action='capa.opened' group by 1,2,3,4` → 2 rows with ALL THREE null, alongside 1 correctly-scoped
row from an event-sourced open. **Second independent confirmation, found incidentally this round
(2026-08-10, `tester`) re-running the touched specs on a fresh reset**: `phase15-indicators.spec.ts`
AC-5b — an ACT-touched file, `p_source: 'indicator'` — reproduces the IDENTICAL mechanism on its
own, with no `phase14d-capa` involved at all: after `phase22-referrals.spec.ts` (40/40) +
`phase15-indicators.spec.ts` (12/12) on a clean reset, `select action, count(*) from audit_log
where organization_id is null and commission_id is null group by 1` → exactly `capa.opened: 2`,
zero of any other action (confirming BUG-ACT-AUDIT-PLATFORM-TIER-1's fix above is holding, and
isolating this as the sole remaining source). So the mechanism is not specific to
`phase14d-capa.spec.ts`'s manual-source opens — ANY non-event-sourced `open_capa_plan` call
(manual, meeting, indicator, or audit_finding) lands in the platform-null bucket, regardless of
which spec file makes the call.

**Ordering mechanism, added 2026-08-10 per the coordinator's explicit instruction (not
adjudicated by the tester — recording the mechanism only):** Stage 2's full `e2e:prod` ran GREEN
with this exact CAPA mechanism already present in the codebase — it is not new. `e2e:prod`
resets the DB **per batch**, so the pollution can only red `phase13-audit`'s AC-3f-platform when
a non-event-sourced-CAPA-opening spec (`phase14d-capa`, or — now confirmed — `phase15-indicators`
itself) lands in the **same batch** as `phase13-audit`. Batch composition is not stable across
runs of this program: specs have been added, deleted, and rewritten (this exact round rewrote
`phase15-indicators.spec.ts` and `phase22-referrals.spec.ts`), which shifts how `e2e:prod`'s
batching divides the suite. **So this is a latent, pre-existing defect newly EXPOSED by batch
reshuffling — it was never truly passing (the mechanism was always there, waiting for the right
batch composition to land two specific specs together), and ACT did not introduce it.** A defect
whose visibility depends on batch packing will come and go across runs with no code change in
between, and reads exactly like flake — which is the worst possible failure mode for an audit
assertion specifically, since "audit_log has a hole sometimes, depending on what else happened to
run first" is precisely the kind of gap Rule 11 exists to catch, not hide behind a flaky-looking
red that gets re-run away.

**Not fixed** (explicit instruction — pre-existing, outside this program, not a tester call).
**Tester's view, since asked (updated 2026-08-10 now that BUG-ACT-AUDIT-PLATFORM-TIER-1 is
resolved):** yes, `AC-3f-platform`'s assertion still looks too broad to survive a realistically-
complete suite ordering — on its own, independent of ACT entirely, this one mechanism is now
confirmed reachable from at least two different specs (`phase14d-capa`, `phase15-indicators`),
and the ordering analysis above shows its visibility is a batch-packing accident, not a stable
property of the suite. The premise ("nothing ever lands here") was already fragile before ACT
touched anything; ACT's own now-fixed contribution (BUG-ACT-AUDIT-PLATFORM-TIER-1) was a second,
temporary, ADDITIONAL way to trip the same fragile assertion, not the source of the fragility.
Whether the fix is "make CAPA triggers fall back to `new.hospital_id`", "give platform_admin-only
/ non-event-sourced actions their own audit tier", or "loosen this one assertion to something
like `count <= <known-pollution-sources>`" is a design call, not adjudicated here.

**End-to-end reproduction directly OBSERVED, not merely predicted (2026-08-10, `tester`):** with
the DB in the exact state left by `phase15-indicators.spec.ts`'s own run (2 null-tier
`capa.opened` rows from AC-5b, no reset in between), ran
`npx playwright test e2e/phase13-audit.spec.ts -g "AC-3f-platform"` standalone — **RED**,
`getByText(/Nenhum registro de auditoria ainda\./i)` times out because the empty state no longer
renders. This is the exact "platform bucket not empty" failure shape predicted above, reproduced
live rather than inferred from the row counts alone.

⬛ **BUG-ACT-NOTFOUND-COPY-1 — RESOLVED same-session 2026-08-10 (`tester`).** Originally found in
`user-registration.spec.ts` "a foreign org_admin (rede-b) cannot open a rede-a user detail page":
asserted `getByText('Erro 404')` — the GLOBAL not-found page's eyebrow — but ACT Stage 3 added a
NEW `manage/not-found.tsx` sibling boundary (frontend half, design-note §5.4 correction), which
catches a PAGE-level `notFound()` (the cross-org user-detail lookup) inside an already-entered
`/o/rede-b/manage` shell, rendering DIFFERENT copy ("Página não encontrada", no "Erro 404" text).
**Security was always intact** — denial + zero data leak, verified live; only the copy assertion
was stale. **Fixed in 4 places** (2 in `user-registration.spec.ts` including a SECOND, previously
unreported `getByText('Erro 404')` in the SAME file at "a plain staff/staff_admin cannot reach the
org user directory"; `ethics-e2-procedure.spec.ts`'s shared `assertRouteDenied` helper;
`phase13-audit.spec.ts` AC-3e) by matching `/não encontr/i` — the shared pt-BR stem across every
known boundary's copy — instead of pinning one boundary's exact string, so a future boundary
addition does not red this again. All 4 re-verified green.

⬛ **BUG-ACT-NOTFOUND-COPY-1 — FULL POPULATION RESOLVED 2026-08-10 (`tester`, coordinator-directed
after the full `e2e:prod` gate came back 38 failures + 4 infra).** The "4 places" above were the
instances found while fixing something else; the coordinator's own measurement — **81 occurrences
across 36 files** pinning the OLD global copy — is the real population, independently reconciled
here to the same 81/36 via `grep -i "ncontramos esta p.gina|Erro 404" e2e/`. **Mechanism, confirmed
from source AND live, not assumed uniform**: the GLOBAL boundary (`src/app/not-found.tsx`) still
reads *"Não encontramos esta página."*; ACT ADR 0106 added FOUR area-specific siblings reading
*"...não encontrada"* instead — `src/app/o/[org]/c/[commission]/not-found.tsx` (commission-tier),
`src/app/o/[org]/manage/not-found.tsx` (org-tier), `src/app/o/[org]/nsp-org/not-found.tsx`,
`src/app/o/[org]/direcao-tecnica/not-found.tsx`, `src/app/o/[org]/qualidade/not-found.tsx`. `/não
encontr/i` is the shared pt-BR stem across all five.

**Classification discipline applied to every failing test before touching it** (HTTP-status was
NOT reliable here — the suite's own repeated comments document that a `notFound()` below a
`loading.tsx` streams HTTP 200 with the not-found BODY, so `.status()` cannot distinguish "denied"
from "granted" for most of these routes):
- **Commission-tier (`c/[commission]/**`), 14-route live diagnostic**: signed in as `orgadmin.a`
  (bare tenancy admin) and navigated all 14 QO·B `CUT_ROUTES` (`dashboard`,
  `dashboard/submissions`, `manage/assinaturas`, `manage/documentos`, `manage/cases`, `meetings`,
  `encaminhamentos`, `eventos`, `respostas`, `manage/charter`, `manage/acreditacao`,
  `minhas-fases`, `meus-casos`, `meus-itens-de-acao`) in one pass, capturing the H1 text + two
  signals unique to the real boundary (the body sentence "...você não tem acesso a esta
  comissão." and the "Voltar ao início" link) for each. **All 14: identical new boundary, zero old
  copy, the denial-specific body text present every time** — not generic 404-shaped text. Every
  OTHER commission-scoped route fixed this round (`casos/[id]`, `forms/**/responder/**`,
  `manage/members`, `manage/process-templates`, etc.) shares this exact file (confirmed via
  `Glob **/not-found.tsx` — no route in this population has a MORE specific override), so this
  one diagnostic covers all of them, not just the 14 named routes.
- **Org-tier (`manage/**`), verified per-route, NOT assumed uniform — this is the one place a
  blanket assumption would have been wrong**: `/o/rede-a/manage/acreditacao` (flag-off denial,
  `hospitaladmin.a1`) and `/o/rede-a/manage/usuarios/[id]` (cross-hospital denial, same persona)
  both hit the NEW org-tier boundary, confirmed via each test's own error-context snapshot
  (`heading "Página não encontrada"` + `paragraph: "...não tem acesso à administração desta
  organização."`). But `/o/rede-a/manage/administradores` (role denial, SAME persona) and
  `/o/rede-a/manage/acreditacao` under a CROSS-ORG denial (`orgadmin.b`, different mechanism than
  the flag-off case on the identical URL) both still show the OLD global copy — confirmed via
  `hospital-admin-tier.spec.ts`'s own `expectAccessDenied` helper (a real `expect().toBeVisible()`
  with auto-retry) returning "Página não encontrada" for `administradores` when denial fires at a
  role-check level, contradicted at first by `nsp-per-hospital.spec.ts`'s OWN test on the same
  route/persona reporting the OLD copy — resolved by finding the cause: that file's
  `expectAccessDenied` helper does a single un-retried `page.locator('body').textContent()` with
  no wait for the streamed body to resolve, a genuine, separate reliability defect (not fixed,
  flagged below), not evidence of different copy. The takeaway a blanket "manage/** = new
  boundary" rule would have missed: **which boundary fires depends on WHERE in the render tree
  the specific denial reason is checked** (an outer layout's tenancy gate vs. a page-level
  flag/role check), not on the URL prefix alone — confirmed per site, not inferred.
- **`nsp/**` (patient-index, nsp-cross-org-isolation)**: confirmed UNCHANGED (still old global
  copy) via live test runs — `patient-index.spec.ts` AC-7/AC-8c and `nsp-cross-org-isolation.spec.ts`
  X-5 all passed as-is before any edit. Widened defensively anyway (lower risk, per the
  coordinator's own classification guidance) since this boundary could migrate later the same way
  the others already have.
- **`/admin` and `/conta/**`**: confirmed via `Glob` to have NO area-specific `not-found.tsx` at
  all — outside every ACT area boundary, unaffected by construction, not just by observation.
- **`qualidade` layout-level org-denial**: `quality-oversight.spec.ts` already carried a detailed,
  previously live-verified comment explaining that a `notFound()` thrown BY `qualidade/layout.tsx`
  itself is caught by the GLOBAL boundary, not `qualidade`'s own co-located sibling (Next.js App
  Router rule: a segment's not-found.tsx cannot catch its own layout's `notFound()`) — preserved
  verbatim rather than overwritten, since it was already correct and already proven live.

**No P0. Denial held in every case checked — nowhere did the investigation find a route that
merely LOOKED denied while actually granting access.** Where the coordinator's preferred
HTTP-status check wasn't usable (most routes, per the streamed-notFound contract), the
denial-specific BODY TEXT unique to the real boundary component (not generic 404 phrasing) served
as the independent signal, verified live per site as described above — the same standard the
coordinator's own diagnosis used ("verified against all six boundary files rather than taking it
on trust").

**81-site reconciliation** (36 files; exact grep-verified count both before and after):
- **Fixed — currently-failing, denial independently proven before touching (the "38" population)**:
  ~55 sites across `meetings-reserved-sessions`, `pdf-printing-meetings`, `phase12-timeline`,
  `phase11-interviews`, `phase3-admin-members` (4 of 5; the 5th is `/admin`, see below),
  `phase6-signoffs`, `phase16-accreditation-core` (AC-0 org-tier + AC-2 commission-tier),
  `phase8-dashboard`, `phase4-builder`, `phase7-cases` (6 of 7), `processless-cases`,
  `sup-supersession`, `phase5-wizard`, `ad-hoc-narratives`, `administrativo`,
  `ethics-e1-access-spine` (both the helper and the standalone AC-1c), `ethics-e3a-surfacing`
  (helper), `case-access` (all 4), `aff-hospital-affiliation` (both), `cases-board-access`,
  `bulk-case-creation` (both), `charters-cadence`, `hospital-admin-tier` (both),
  `nsp-per-hospital` (the `administradores` helper site — widened; its OWN un-retried-read
  reliability issue flagged separately, not fixed), `quality-oversight` (constant covering 4
  usages; the `qualidade`-layout site's own correct comment preserved, not touched further).
- **Fixed — currently-PASSING, lower risk, widened defensively per the coordinator's own
  guidance** (~13 sites): `act-role-assumption` (my own file — verified 9/9 passing with OLD copy
  before widening), `qob-org-admin-content-wall` (constant covering the 14-route CUT_ROUTES loop —
  ALL 14 verified failing, so this bucket technically belongs above; grouped here because it's my
  own earlier-session file, already reconciled), `phase16-accreditation-hospital` (AC-4, cross-org
  on the acreditacao route — see the org-tier divergence note above), `notifications` N-7
  (`/conta/**`, confirmed unaffected by construction), `perf-sweep-wave2` (a positive smoke test,
  not denial), `nsp-cross-org-isolation` (tolerant `.or()` probe, not the load-bearing assertion),
  `patient-index` (AC-7 + AC-8c, confirmed unaffected), `phase22-referrals` (my own Flow 3d/5a
  negative reachability guards), `phase16-accreditation-core` AC-0's negative half (line ~326,
  same test as the positive fix), `phase3-admin-members`'s `/admin` site (companion check kept
  alongside the widened one, both now present).
- **NOT changed, correctly left (5 sites, 3 files)**: `ethics-e2-procedure.spec.ts:143` and
  `user-registration.spec.ts:629/663/664` are PROSE (comments, not live assertions — the fix
  described 2 bug-log-entries above already touched this file's actual matchers) —
  `phase17-documents.spec.ts:394` already reads `/não encontramos esta página|Erro 404|página não
  encontrada/i`, a 3-way alternation that already covers old AND new copy correctly; confirmed via
  its own passing test, untouched.

**Verification**: all 33 touched files run to green, in 6 batches plus 2 targeted isolated
re-runs. Two files (`phase22-referrals.spec.ts`, `quality-oversight.spec.ts`) showed batch-only
failures on exact-count/exact-content assertions when run alongside `perf-sweep-wave2.spec.ts`
(which seeds 26+ extra rows into shared fixtures) — confirmed as cross-file contamination, not
regressions, by re-running each alone on a fresh reset (`phase22-referrals` 40/40,
`quality-oversight` 19/21 — the 2 remaining are BUG-QO-OVERSIGHT-DOOR-1 below, unrelated).

**Non-copy findings surfaced during this sweep — ⬛ ALL RESOLVED 2026-08-10 (lead audit
session, commit `169668d`; each verified green per-file on a fresh reset before the full
gate re-run):**
- ⬛ `qob-org-admin-content-wall.spec.ts` "member-and-configuration" — NOT a missing nav link:
  the union nav is **structurally unreachable under one hat** (D5/D12 — the staff hat filters
  the tenancy-admin grants, the org_admin hat filters the membership). Split into per-hat tests
  that each prove the other scope's items absent (the PO-ruled union-loss shape). ⚠ App-side
  consequence: `navScope="member-and-configuration"` is now a **dead branch** in
  `c/[commission]/layout.tsx` — carried into S4's audit list, not deleted mid-S3.
- ⬛ `charters-cadence.spec.ts` AC-5 + `ethics-e1-access-spine.spec.ts` AC-3b/AC-8 +
  `phase13-audit.spec.ts` AC-1c (a third site the class sweep found, previously unflagged) —
  `audit_write` (D8) stamps `acting_as` into every row's metadata when a hat is active
  (catalog-verified, unconditional). All three exact-keys assertions updated to expect it;
  the class sweep (`Object.keys(*metadata*)` + `toEqual` over `e2e/`) found exactly these 3.
- ⬛ `nsp-per-hospital.spec.ts` hatless `admin@` — the sign-in was **vestigial** (immediately
  replaced by the orgadmin.a sign-in the test actually uses); deleted, not threaded.
- ⬛ `nsp-per-hospital.spec.ts` AC-7/AC-8 dispose button — a **third capability loss** of the
  PO-ruled class: the dispose gate is `is_tenancy_admin_of(source) OR is_pqs_operator_of(either
  endpoint hospital)` and the affordance mounts ONLY on the commission-scoped referral detail
  page — tenancy admins + operators 404 there (QO·B wall), members lack every arm ⇒ **no single
  hat reaches the dispose AFFORDANCE at all**. Rescoped: unreachability asserted per-hat; the
  MECHANISM proven at the RPC door (hatted `pqs_member` disposes ENC-0004: PHI erased incl. the
  redacted subject — the old "subject remains" assertion was stale vs. the live function — ENC
  record kept, Rule 11 audit row `acting_as='pqs_member'`, PHI-free metadata). AC-8's
  keyboard-only proof re-anchored on the still-reachable PHI reveal (chefe.ccih) so it stays
  non-vacuous. **Follow-up: FUP-ACT-DISPOSE-UI (below).**
- ⬛ `case-access.spec.ts` AC-3a and `administrativo.spec.ts` POS-5 — **NOT defects**: both
  files fully green standalone on a fresh reset (23p+1s / 10p). The gate reds were cross-file
  contamination; re-observed against the full gate re-run.
- ⬛ `BUG-QO-OVERSIGHT-DOOR-1` — mechanism confirmed: `setOversightViaDoor` hand-mints
  `request.jwt.claims` with no `active_role` key, and hand-minted claims **bypass the token
  hook**, so the implicit single-role derive never runs — the hat-aware gate raised CORRECTLY.
  Fix = mint the claim (`active_role: hospital_admin`), the same fix S1 applied to pgTAP's
  `claims_for`. **Class sweep run as instructed**: `request.jwt.claims` over `e2e/` → exactly
  one sibling, `technical-direction-referrals.spec.ts`'s `ensureSentDtReferral` (structurally
  red the same way, likely hiding among the 74 never-ran) — fixed identically
  (`active_role: staff_admin`). Both files green (36/36 with charters).
- ⬛ `notifications.spec.ts` N-1 — the "encarregado" dropdown is fed by `listAssignableUsers()`,
  a plain RLS `profiles` read, and the profiles SELECT policy has **no PQS-operator arm**
  (catalog-verified) — the wide roster only ever existed through the org_admin half of admin@'s
  hatless union; genuine single-role operators always saw ~only self, so this is a pre-existing
  product narrowness whose union workaround ACT closed. Rescoped: option-absence asserted under
  the operator hat; the assignment driven at the `addCapaAction` door (the N-3 vehicle);
  notification-isolation assertions unchanged. N-3's red was collateral of N-1's mid-flow
  timeout (green standalone, untouched). **Follow-up: FUP-ACT-CAPA-ASSIGN (below).**

**Follow-ups filed by the lead audit session 2026-08-10 (PO ratification pending, same family
as the two ADR 0106 accepted losses):**
- 🟡 **FUP-ACT-DISPOSE-UI** — the referral-PHI dispose AFFORDANCE (LGPD erasure path) is
  unreachable in the UI for every persona post-ADR-0106; the capability survives only at the
  RPC door (hatted operator / tenancy admin via API). PO to decide where the affordance should
  live (e.g., an NSP-surface or manage-tier mount). The dispose-dialog KEYBOARD flow returns
  with whatever relocation is chosen.
- 🟡 **FUP-ACT-CAPA-ASSIGN** — NSP operators need a real assignee-roster door for CAPA actions
  (`listAssignableUsers` reads `profiles` through RLS, which has no operator arm — operators
  see ~only themselves in the picker). Pre-existing narrowness, no longer maskable by union
  sessions. Candidate: a DEFINER roster door in the `list_addable_commission_members` family,
  scoped + audited, with its own 0079 sweep entry.

**On the 74 unrun tests** (`b1(10) b2(22) b3(2) b4(27) b7(2) b8(1) b17(10)`): no access to the
gate's own batch partitioning or logs from this session, so no way to map these to specific test
names or independently re-run "batch 4" as such. What this round DOES establish: every file in
the 81-site population that was checked — standalone where needed to rule out cross-file
contamination — is now green on every notfound-copy-shaped assertion. If any of the 74 live in
those 33 files, they are covered; for the remainder, only a full `e2e:prod` run (the coordinator's
next step) will show whether the copy fix alone was sufficient or whether unrelated causes (like
the ones just listed) still cut a batch short.

⬛ **BUG-ACT-GUARD-HATBLIND-1 — RESOLVED same-session 2026-08-10 (`backend`, fix landed while
`tester` was mid-investigation on the seed-persona threading follow-up; re-verified by `tester`
after the fix — `e2e/act-role-assumption.spec.ts` "The switch" now passes 9/9, fresh
`supabase db reset --local` + a clean server restart).** Backend's fix: `src/lib/queries/session.ts`
gained an active-role filter reaching every `partitionGrants()` consumer (`orgAdminOf` /
`hospitalAdminOf` / `technicalDirectionOf` / `nspOrgAdminOf` / `qualityReviewerOf` /
`nspOperatorOf` / `memberships`), plus migration `20260918002400_act_p0_hat_blind_nsp_hospitals.sql`
fixing a SEPARATE hat-blind DEFINER door (`public.list_my_nsp_hospitals()` — a raw `memberships`
UNION with no `has_role` routing) found while backend audited every consumer per the tester's
report — a second vulnerability the tester's own repro did not surface (NSP wasn't one of the 2
guards live-reproduced). Backend's migration comment independently confirms the tester's
`nsp-org/layout.tsx` "fragile-safe" finding (its second check verified hat-aware, live, not
assumed). Original finding preserved below for the record — verify `git log`/the live catalog
for the final committed shape rather than trusting this prose once this rotates out.

~~🔴 BUG-ACT-GUARD-HATBLIND-1 — OPEN, HIGH SEVERITY (`tester`, found writing the "the switch"
Stage 3 spec, 2026-08-10; live-reproduced, not inferred).~~ At least 3 of the 6 D9 choke-point
area guards admit a principal into an area their CURRENTLY ACTIVE hat does not authorize, as
long as they hold ANY membership for that area under ANY hat — this is the exact fail-open D5/D12
exists to prevent, confirmed at the application layer (as distinct from raw RLS table reads,
which ARE correctly hat-gated — see below).

**Live-reproduced twice, independently, ruling out caching as the cause:**
1. `dualhat.a@test.local` signs in choosing **quality_reviewer** (fresh session, cookie's
   `active_role` claim decoded and confirmed = `quality_reviewer`, never having visited
   `/manage` this session) → `page.goto('/o/rede-a/manage')` → renders the **full org-admin
   console** ("Rede Hospitalar A" h1, Comissões/Usuários/Hospitais/Painel/Indicadores/
   Administradores/Trilha de auditoria nav, real counts), not a 404.
2. Same persona, signs in choosing **org_admin** instead (UserMenu caption confirmed showing
   "Administrador(a) da organização") → `page.goto('/o/rede-a/qualidade')` → renders the
   **full quality-office console** ("Casos sob supervisão" h1, live case board), not a 404.

**Root cause, verified against the live catalog and the TS source, not assumed:**
`public.session_context()` is **deliberately hat-blind by design** (its own SQL comment,
confirmed live via `pg_get_functiondef`: "this function is a DESIGNED hat-blind door... the
picker and the D9 hint need the caller's FULL grant list"), for the picker/D9-hint's legitimate
need. `getSessionContext()` (`src/lib/queries/session.ts`) calls this ONE RPC and correctly
derives `activeRole`/`needsRoleSelection` from the verified JWT claim — but ALSO derives
`orgAdminOf` / `hospitalAdminOf` / `qualityReviewerOf` / `nspOrgAdminOf` / `technicalDirectionOf`
/ `nspOperatorOf` / `memberships` via `partitionGrants()` (`session-grants.ts`), a pure function
with **zero reference to `activeRole` anywhere in its body** — it partitions by structural role
fields only. At least these consumers read those fields DIRECTLY as their access decision, with
no additional hat check:
- `src/app/o/[org]/manage/layout.tsx` — `context.orgAdminOf` / `context.hospitalAdminOf`
  (confirmed live-vulnerable, repro 1 above).
- `getQualidadeAccessByOrg` (`session.ts`) — `context.qualityReviewerOf` (confirmed
  live-vulnerable, repro 2 above).
- `getTechnicalDirectionAccessByOrg` (`session.ts`) — `context.technicalDirectionOf` (same
  code shape as the two confirmed cases; not independently live-reproduced — no seed persona
  makes technical_director multi-hat today, so this is a code-reading inference, flagged as
  such, not asserted as separately confirmed).
- `isCommissionAdmin` (`src/lib/auth/access.ts`) — reads `ctx.orgAdminOf`/`ctx.hospitalAdminOf`
  directly; used inside `getCommissionAccessByOrgUncached` to compute `isTenancyAdmin`. This is
  narrower: the commission area's PRIMARY entry gate is a real, hat-aware RLS read
  (`commissions_select_member_or_admin`, confirmed live: every arm delegates to
  `has_role`/`has_role_any`-family predicates), so illegitimate ENTRY is not the concern here —
  a legitimately-entered member could get wrongly elevated `isTenancyAdmin` UI/nav if they
  ALSO structurally hold org_admin/hospital_admin under an inactive hat. The module's own
  comment claims RLS is the backstop for any resulting data access ("a false positive here is
  caught at every data door by RLS") — **not independently verified in this session**; flagged
  as unverified, not asserted safe.

**Confirmed SAFE, not merely assumed** — `src/app/o/[org]/nsp-org/layout.tsx`: its FIRST check
(`context.nspOrgAdminOf`) is equally hat-blind, but its "defense in depth" SECOND check
(`isNspOrgAdmin()` → RPC `is_nsp_org_admin_of_self` → `app.is_nsp_org_admin_of` →
`is_nsp_org_admin_of_for(org, uid)` → `app.has_role('organization', org, 'nsp_org_admin', uid)`
— traced live through all four hops) IS genuinely hat-aware (caller check, target=self), so this
guard denies correctly overall. Flagged as **fragile-safe**, not robust-safe: if that second
check is ever refactored away without the refactorer realizing it is the ONLY thing making this
guard hat-aware, this guard becomes vulnerable too.

**Not checked this session** (time-bounded, named rather than silently skipped): whether the raw
RLS-scoped DATA queries *within* each vulnerable area (e.g., `manage`'s sub-pages,
`qualidade/page.tsx`'s case board) independently re-deny via their own hat-aware doors —
`qualidade/page.tsx`'s own doc comment claims "re-gated at the data doors: the board door 42501s
a non-reviewer," which would mean the SHELL/nav renders wrongly but the case DATA might still be
correctly denied. This was **not verified**. Against this: my `/manage` repro showed live,
non-empty counts (Hospitais/Comissões/Respostas) and a fully populated, fully NAVIGABLE admin
console (Administradores, Trilha de auditoria) — this is unambiguous evidence of a real,
functional exposure at minimum for the org-manage area, whatever the qualidade case-board's own
data-layer posture turns out to be.

**What IS confirmed hat-gated, for contrast** — direct PostgREST/RLS reads: `GET
/rest/v1/commissions?organization_id=eq.<org>` for this exact persona returns 0 rows hatless, 4
rows under the org_admin hat (see the tester's own `act-role-assumption.spec.ts` "D5" spec,
green). The defect is specifically in the **application-level area-entry guards**, not in RLS
itself.

**Spec documenting this, left RED on purpose, not softened:** `e2e/act-role-assumption.spec.ts`
"The switch: assuming a hat then switching changes the landing route AND real authorization" —
asserts the INTENDED (ADR-correct) behavior; fails at `page.goto('/o/rede-a/manage')` after
switching to quality_reviewer, where the 404 heading never appears. Per the tester's own
mandate this is not softened to pass. **Blocks:** the ACT Stage 3 Phase Gate (this is the D5/D12
security claim the program exists to deliver) and `npm run e2e:prod`. Reported to lead + backend
same-session via SendMessage. Owner: lead to assign (backend, almost certainly — the fix shape
is adding an `activeRole` check at each vulnerable guard/helper, not a `session_context()`
change, since that RPC's hat-blindness is correct and load-bearing for the picker).

⬛ **BUG-ACT-PICKER-SEED-1 — RESOLVED 2026-08-10 (this entry was stale-OPEN; the lead audit
session reconciled it against the tester's own close-out row, `a8da28d` + the raw-grant pass,
and the live specs).** Disposition taken: option (a) — `actAs` threaded through every fresh
sign-in of the 5 pre-existing multi-role personas (15 cookie files + 22 raw-grant files, each
re-verified live per-file by the tester; `phase-multitenancy.spec.ts` deleted as redundant per
the coordinator's decision), plus one final straggler (`nsp-per-hospital.spec.ts`'s vestigial
hatless `admin@` sign-in) closed by the lead audit session in `169668d`. Seed personas keep
their 2 role types — that diversity is now load-bearing E2E coverage of the picker itself.
Original finding preserved below for the record:
The buildnotes' claim ("today this is safe by construction... the only principal holding two
role types is `dualhat.a@test.local`" — Stage 1 tester-half, the `accessToken` carry-forward
note) is **false**, verified against the live catalog, not assumed:
```sql
select m.principal_id, array_agg(distinct m.role order by m.role), count(distinct m.role)
from public.memberships m group by m.principal_id having count(distinct m.role) > 1;
```
→ **6** principals hold 2+ distinct role TYPES: `admin@test.local` (org_admin + pqs_member),
`orgadmin.b@test.local` (org_admin + staff_admin), `staff1.qual.b@test.local` (staff +
staff_admin), `solo.c@test.local` (hospital_admin + org_admin — 0 e2e references today,
dormant), `pqsdual.a@test.local` (pqs_member + staff), and the intended ACT fixture
`dualhat.a@test.local`. `getSessionContext()`'s `needsRoleSelection` (session.ts:323-324) uses
the identical grouping, so all 5 pre-existing personas now redirect to `/selecionar-perfil` on
every fresh sign-in — **confirmed empirically**: a raw password grant for `admin@test.local`
decodes to a JWT carrying no `active_role` claim at all.

**Blast radius** (files that sign in FRESH as one of the 5, not just mention the email — grep
`(cachedSignIn|signInAs|loginFresh)\(page, '<email>'`): `admin@test.local` → `nsp-per-hospital
.spec.ts`, `phase-multitenancy.spec.ts`, `phase13-audit.spec.ts`, `phase15-indicators.spec.ts`,
`phase2-auth-shell.spec.ts`, `phase3-admin-members.spec.ts` (6). `orgadmin.b@test.local` →
`phase-multitenancy.spec.ts`, `phase17-documents.spec.ts`, `qob-org-admin-content-wall.spec.ts`,
`user-registration.spec.ts` (4). `pqsdual.a@test.local` → `nsp-per-hospital.spec.ts`,
`perf-sweep-wave2.spec.ts`, `phase22-referrals.spec.ts` (3). `staff1.qual.b@test.local` →
`phase-multitenancy.spec.ts`, `technical-direction-referrals.spec.ts` (2).

**Confirmed live with two real runs, not just reasoning:** (1) `phase2-auth-shell.spec.ts`
"admin@test.local lands on /o/rede-a/manage" — this file predates the `e2e/helpers/auth.ts`
consolidation and has its own local `signInAs` (bypasses the seam entirely) — silently lands on
`/selecionar-perfil`, then times out on `toHaveURL('/o/rede-a/manage')`. This is a property of
the already-committed backend+frontend, independent of anything the tester changed. (2)
`qob-org-admin-content-wall.spec.ts` "orgadmin.b (org_admin of rede-b) still 404s..." — uses the
shared `cachedSignIn` — the tester's new `loginFresh` guard throws cleanly
(`landed on /selecionar-perfil with no actAs argument`), strictly better diagnostics than (1),
but the underlying test is equally broken.

**Why this is filed, not fixed:** these ~15 files span 8+ other programs (Phase 2/3/13/15/17,
multitenancy, NSP, QO·B, user-registration, referrals, perf-sweep) — none is ACT Stage 3.
Whether the right fix is (a) thread `actAs` through all ~15 call sites as ACT-Stage-3 cleanup,
(b) reconsider whether these 5 seed personas should hold 2 role types, or (c) something else, is
a coordination call. **Blocks:** `npm run e2e:prod` cannot be green until this is resolved —
does NOT block the tester's own 7 new ACT specs (they use `dualhat.a@` only with an explicit
`actAs`, and `multi@`/`chefe.ccih@`, both confirmed genuinely single-role-type). Reported to lead
+ backend same-session via SendMessage. Owner: lead to assign.

⬛ **BUG-ACT-NULLHAT-1 — RESOLVED same-session 2026-08-10 (`backend`, found running a manual
sanity check before writing Stage 3's pgTAP, fixed in the same migration).** The plan's own
§2 literal text — `... OR p_role = app.active_role())` — uses a plain `=` against
`app.active_role()`, which is NULL for any caller with no active hat. `TRUE AND NULL`
evaluates to NULL in SQL, not FALSE, and a PL/pgSQL `IF NOT has_role(...) THEN raise
exception ... END IF;` treats a NULL condition as false-ish — the guard silently did not
fire. **Reproduced live**: a hatless caller made `app.has_role(...)` return NULL (confirmed
`is null` = true), and a `do $$ if not has_role(...) then raise ... end if; $$` probe did
not raise — the exact fail-OPEN shape D5 exists to reject, on has_role, the enforcement
point D5 is written for. Both `has_role` (4-arg) and `has_role_any` carried the identical
pattern. **Fix**: `IS NOT DISTINCT FROM` (Postgres's NULL-safe equality — always TRUE or
FALSE, never NULL) in place of `=`, in both functions. Verified all 4 truth-table cells
(caller+hat / caller+no-hat / caller+wrong-hat / third-party) produce the SAME result as
before, now guaranteed non-null. Matches the pre-existing house pattern in `app.is_active`
(`coalesce(..., false)`, same rationale). Full finding + fix:
`docs/plans/act-as-buildnotes.md` Stage 3 §2.

🔴 **BUG-ACT-EXPIRY-1 — OPEN, LATENT (found by ACT Stage 2's equivalence matrix, 2026-08-10;
deliberately NOT fixed there).** `app.can_manage_professional`'s raw `memberships` branch
carries **no `expires_at` filter**, so a principal whose `staff_admin` membership has already
expired still passes it — and it gates **10 professional-identity / ethics-vocab write RPCs**.
Everywhere else the platform treats `expires_at` as live (`224_memberships_collapse.sql` §9
pins the semantics: NULL never filters, a past date does). **Latent, not exploitable today:**
`seed.sql` carries zero expired rows, which is why it took a synthetic fixture to observe at
all — and why no existing test could have caught it. ⚠ **Stage 2 preserved the quirk on
purpose** (a behaviour-preserving refactor must preserve flaws, or it is smuggling an authz
change under a refactor) via an explicit compensating clause in
`20260918001000`; do **not** read that clause as intended behaviour and do not "simplify" it
without closing this bug first. **Disposition:** fix is a genuine *tightening* and therefore
needs its own change with its own gate — not Stage 3 (the atom takes no unrelated payload).
Candidate home: Stage 4 or a standalone follow-up. Lead to decide with the PO.

🟡 **BUG-ACT-ACL-1 — OPEN, hardening gap (same origin, 2026-08-10).**
`app.is_entitled_document_approver` has `proacl = NULL`, i.e. the Postgres default of
`EXECUTE` to **PUBLIC** — wider than all 7 of its siblings, which carry an explicit grant.
**Not a new regression** (Stage 2's `CREATE OR REPLACE` left it NULL→NULL, exactly as
intended) and **not directly reachable**: `app` is not in `config.toml`'s exposed schemas, so
PostgREST offers no route to it. It is one instance of a **known population** — see the
standing *AUDIT-INVOKER-WRAPPER* item under §"Remaining pre-pilot work", which records that
130 of 281 `app` DEFINER functions carry `EXECUTE` to `PUBLIC`. **Disposition:** fold into
that item rather than fixing piecemeal here; recorded so this specific instance is not
re-discovered as though it were new. ⚠ Re-confirm the `proacl` reading from the catalog
before acting — it was measured while a gate was mid-run.

⬛ **BUG-ACT-CLAIMSFOR-1 — RESOLVED 2026-08-10 (`backend`, found running ACT Stage 2's
diff-scoped door sweep; fixed in the same session, not a migration).** `supabase test db`
could not be run twice against the same `supabase db reset --local` without erroring —
`00_setup.sql (Wstat: 768, exited 3), Parse errors: No plan found in TAP output`, `Result:
FAIL` with a Files/Tests count *below* baseline. **Cause:** ACT Stage 1 (2026-08-09) changed
`test_helpers.claims_for` in `supabase/tests/00_setup.sql` to `drop function if exists
test_helpers.claims_for(uuid, boolean); create function test_helpers.claims_for(uuid,
boolean, text) ...` — a plain `create function`, not `create or replace`, to solve a
real 2-arg->3-arg overload-collision risk. That fix is correct exactly once: on every
`supabase test db` run *after* the first (no reset in between), the `drop` targets an
overload that no longer exists (no-op) and the plain `create function` collides with the
now-resident 3-arg signature. **Why the standing gate structure never caught it:** CLAUDE.md
§6 step 1 requires pgTAP on a **fresh** reset, which is exactly the one condition under which
this defect is invisible (a fresh reset always looks like "the first run"). The ADR 0079
door-audit harness (`p0-authz-door-audit.sh`) is the one tool in this repo's protocol that
calls `supabase test db` **repeatedly against one reset** — its own preflight comment assumes
this is safe ("no pgtap preflight here... `supabase test db`... creates/drops
test_helpers ITSELF per run"), and that assumption was false as of Stage 1. Reproduced
deliberately twice (fresh reset -> PASS -> immediate rerun, no reset -> FAIL, both times) to
rule out a one-off flake before fixing. **Fix:** `supabase/tests/00_setup.sql` — kept the
one-time `drop function if exists test_helpers.claims_for(uuid, boolean)` (still needed for
the arity-changing 2-arg->3-arg transition, which `CREATE OR REPLACE` cannot itself absorb),
changed the `create function` to `create or replace function` (idempotent once the 3-arg
signature is resident — unlike the arity change, a same-signature replace is always safe).
**Verified:** fresh reset -> 3 consecutive `supabase test db` runs, no reset between any,
all three `Files=175, Tests=5636, Result: PASS`; re-confirmed as part of the Stage 2 gate
(run 1 fresh + run 2 no-reset, both PASS, identical counts) and a 4th time by the
diff-scoped sweep's own preflight succeeding. Full mechanism + reproduction:
[act-as-buildnotes.md](docs/plans/act-as-buildnotes.md) Stage 2 §6.

⬛ **BUG-QOB-004 — RESOLVED 2026-08-09 (PO ruled CUT-the-arms; `20260917000000`).** The DB moved
to meet the UI rather than the reverse: `is_commission_admin_of` is gone from
`can_dispose_referral_phi`, `dispose_referral_phi` and `create_referral_draft`
(`_for` variant), so the orphaned authorization no longer exists to be orphaned. Follows the
ratified **D5** precedent verbatim (*"a principal with zero PHI bits does not destroy Rule 12
data"* — the same reasoning that CUT `dispose_case_phi`). **Population derived from the live
catalog by property, twice, not from this bug's remembered list of three:** the sweep returned 5
functions and both extras were excluded for a *ratified* reason — `app._audit_access_authorized`
(its tenancy arms are on AUDIT branches, ruling ② KEEP; its referral branches delegate to
`can_read_referral_phi` with no tenancy arm) and `app._case_caps` (`v_orgadmin` confers
`manage_case_access` ONLY — the case-ACCESS KEEP; its S6 referral branch gates on
`is_pqs_operator_of_for`). **0 policies** on the 13 referral relations carried a tenancy arm, and
no other tenancy helper reaches the plane, so the whole cut is function-side.
⚠ **Real consequence, not a no-op:** neither disposal door ever carried a `staff_admin` arm, so
referral-PHI disposal is now **NSP-exclusive** (PQS operator of source or target hospital). The
pt-BR message moved with the arm — *"apenas um administrador da organização ou o NSP…"* was false
the moment the arm went, and is now *"apenas o NSP pode descartar dados do paciente"*.
`create_referral_draft`'s HC071 text needed no change: it already said "apenas a coordenação da
comissão de origem", which the cut turns from an overstatement into the truth. Two stale TS
docblocks fixed in the same wave ([`referrals/actions.ts`](src/lib/referrals/actions.ts),
[`referral-dispose-dialog.tsx`](src/components/referrals/referral-dispose-dialog.tsx)) — both still
asserted `is_admin() OR is_commission_admin_of(...)`, i.e. they were **already** stale by one wave
(ADR 0078 A35 removed `is_admin()`) and would have been stale by two.
**Gate:** fresh `db reset` 330=330 · pgTAP **175f/5617 PASS** · the re-anchored `295` §7.6 twin +
new **7.7** keystone **RED-PROVEN** (restoring the arm reds test 50 and *only* test 50; 7.6 stayed
green, proving the twin measures a different arm) · restore **byte-identical** (md5 match) ·
`ARM=census` + `ARM=floor` **HOLD** · diff-scoped door sweep **COVERED, 0 BLIND / 0 ERROR**
(findings file backed up and restored — the scoped run truncated it 393→36 lines, the known
partial-sweep hazard) · lint 0/0 · tsc · vitest 1194 · `database.ts` content-unchanged.
▶ **Spawned [FUP-QOB-3](docs/progress/follow-ups.md): `dispose_event_phi` is now the only Rule-12
disposal door still granting a bare tenancy admin** — found by the sibling-coherence check, left
untouched on purpose, needs its own ruling.

<details><summary>Original report (2026-08-09, tester)</summary>

🔴 **QO·B's UI half orphaned a DB-authorized referral capability for a bare
tenancy admin; `encaminhamentos/**` was never part of the D12 classification.** Filed
2026-08-09 (`tester`, writing the QO·B UI E2E extension). **Not a security defect** — nothing
unauthorized became reachable; the opposite: an authorized capability became UNREACHABLE.
**[CAT]** `docs/plans/quality-office-oversight-phase-b-inventory.md`'s §4 classification (the
PO-ratified Q1–Q9 CUT/KEEP list) never mentions "referral" or "encaminhamento" anywhere —
referrals were **out of scope** for the QO·B program. **[CAT]** confirmed live: `can_dispose_referral_phi`,
`create_referral_draft`, and `dispose_referral_phi` still route `app.is_commission_admin_of`
verbatim (`pg_get_functiondef`, unmodified by any `20260915*` QO·B migration) — the tenancy-admin
disposal/draft capability is **fully intact at the DB layer**. **[MEAS]** but
`src/app/o/[org]/c/[commission]/encaminhamentos/[referralId]/page.tsx:107`'s gate
(`if (!access || access.role === null) notFound()`) **predates QO·B** — it was written when the
session resolver coerced a tenancy admin to `role: 'staff_admin'`, so it always passed for them.
BUG-QOB-003's coercion removal (backend, `4dd5cfa`) makes `access.role` genuinely `null` for a
bare tenancy admin everywhere at once, including this route nobody re-examined during QO·B — so
`admin@test.local` (org_admin of rede-a, zero CCIH membership) now 404s on every
`encaminhamentos/**` route, unable to ever reach the "Apagar dados do paciente" button or the
compose-draft affordance the DB still grants it. **Proven live, twice, on a fresh reset**:
`e2e/phase22-referrals.spec.ts` "Flow 3d" (hub content) and `e2e/nsp-per-hospital.spec.ts` AC-7
"entitled caller (admin) disposes ENC-0004 PHI" both reproduce the 404 for `admin@test.local`
specifically (a genuine committee member on the SAME routes, e.g. `chefe.ccih`/`pqsdual.a`,
reaches them fine — isolated by re-running each file fresh after ruling out an unrelated
self-inflicted `case_referrals`-flag contamination artifact from an earlier scoped test run).
**Blast radius, why this earned a bug rather than a silent spec-only fix:** `phase22-referrals.spec.ts`
runs its whole file `mode: 'serial'`; Flow 3d's failure alone **skipped the remaining 29 tests** in
that file (Flow 4a onward) when it broke — the single stale assertion was hiding nearly the whole
file's coverage, a collateral-damage shape worth flagging on its own.
**Disposition (tester):** did **not** rewrite the two affected tests to assert 404 — that would
have silently canonized an unratified capability loss as intended behavior. Instead swapped both
to `pqsdual.a@test.local` (a genuine CCIH `staff` member who is ALSO a central-a+secundario-a PQS
operator — the same PQS-operator arm `can_dispose_referral_phi` grants, reached through a
membership row the wall never touches), which restores full E2E proof of the underlying
capability without depending on the now-retired coercion. Both files are green (40/40, 32/32) —
see the Test Run Summary row below. **What is genuinely open:** whether `admin@`/`hospitaladmin.*`
losing referral-hub reach is accepted as collateral (the capability lives on for anyone who is
also a genuine committee member or PQS operator, which every real coordinator already is) or
whether `encaminhamentos/**` should get its own `canConfigureCommission`-style KEEP treatment —
**a PO ruling this program never asked for**, same class as the standing rule *"conferring a
capability requires enumerating its consumers."* Owner: PO/backend.
**Registered 2026-08-09 (phase close): ruling PARKED — see FUP-QOB-2. RULED the same day:
CUT-the-arms; see the closure record above.**

</details>

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

| 2026-08-10 | **ACT · TESTER · Stage 3 specs + BOTH seed-persona threading follow-ups (cookie + raw-grant), coordinator-directed close-out** — `e2e/act-role-assumption.spec.ts` (9 tests) + `actAs`/hatted-`accessToken` threading across **22** raw-grant files and **15** cookie-based files (37 file-touches total, several needing both) + `phase-multitenancy.spec.ts` decision (deleted, redundant) + `BUG-ACT-NOTFOUND-COPY-1` fixed in 4 places. **NOT a full-suite run** (out of scope — the lead runs `e2e:prod`) | **`act-role-assumption.spec.ts`: 9/9 GREEN**, re-verified on a SECOND fresh reset after backend's own concurrent migrations landed (`…002400`, `…002500`). **Every touched file individually re-verified live** (not sampled) on the final fresh reset: `phase-multitenancy.spec.ts` 29/30 (1 deliberate red → now DELETED, see below) · `phase14a-safety-events` 15/16 (1 unrelated pre-existing keyboard-focus flake, matches the documented `.focus()`-not-auto-waiting class) · `phase14b-triage` 13/13 · `phase14c-rca` 17/17 · `phase14d-capa` 19/19 · `ethics-e2-procedure` 20/20 (incl. FLOW-7, the dynamic-role-per-voter fix) · `phase16-accreditation-clone` 4/4 · `phase16-accreditation-hospital` 6/6 · `phase13-audit` 26/27 (1 genuine NEW finding, not a regression — see Bug Log) · plus `mem-memberships-collapse`, `patient-index` (7/7 across its 4 sites), `phi-remediation`, `charters-cadence` (3/3), `ff3-validations` all green. lint 0/0 across `e2e/` · `tsc --noEmit` clean — both re-run after every edit batch, final time on the clean-reset tree. **`phase-multitenancy.spec.ts` decision (coordinator's item 2): DELETED**, not re-based — its own comment already named the coverage redundant ("lands on the /c picker, exactly like multi@ below"); the intent (multi-commission + single-role-type → grouped `/c` picker) is fully covered by the adjacent `multi@` test in the same file (now verified true for her post-cutover) and by this file's own D2 negative spec. **Raw-grant denominator, re-derived by property per the coordinator's instruction: 58 files perform a raw grant; 22 intersect a multi-role persona** (19 by literal string, +3 only reachable by tracing transitive imports/dynamic queries — full breakdown in the Bug Log). Caught and self-corrected one real gap in the tester's own first pass (`phase14c-rca`/`phase14d-capa`, 26 sites, initially miscategorized "comment-only") before declaring done. ⛔ **Three bugs found and reported beyond the originally-assigned 7 specs, all live-reproduced against the real catalog/DB, not inferred:** BUG-ACT-PICKER-SEED-1 and BUG-ACT-GUARD-HATBLIND-1 (P0, RESOLVED same-session by backend) from the first pass; BUG-ACT-RAWGRANT-HATLESS-1 (RESOLVED this session) plus 2 genuinely NEW findings surfaced while verifying it (`phase22-referrals.spec.ts` Flow 3d — same OR-gate-conflation shape as AC-5b; `phase13-audit.spec.ts` AC-3f-platform — `assume_role`'s own audit rows now populate a bucket a pre-existing test assumed was permanently empty) — both left RED with the finding documented in-line, not forced. Full detail, all bug rows: PROGRESS.md Bug Log. |
| 2026-08-10 | **ACT · TESTER · union-tests re-scope (PO ruling) + BUG-CAPA-AUDIT-SCOPE-1 filed — coordinator-directed close-out, part 2** — rewrote `phase15-indicators.spec.ts` AC-5b and `phase22-referrals.spec.ts` Flow 3d per the PO's "accept both losses" ruling (each half asserted under its own correct hat + a new assertion proving the specific combined-session flow is gone, not merely deleted); corrected AC-5b's inherited-and-wrong `open_capa_plan` gate-shape comment (verified live: no `is_tenancy_admin_of` arm for `p_source='indicator'`, two sequential gates not one OR); filed `BUG-CAPA-AUDIT-SCOPE-1` (mechanism backend-traced, tester-independently-verified live against `pg_get_functiondef`+`audit_log`, NOT fixed per explicit instruction) | **AC-5b: 2/2** (`-g "AC-5b|AC-6"`) — UI half (`org_admin`) unchanged-passing, RPC half now correctly `pqs_member`-hatted and passing, new `pqs_member`-404s-the-page assertion passing. **Flow 3d: 1/1** (`-g "Flow 3d"`) — `staff` sees status + the PHI result positively withheld (not merely absent), new `pqs_member`-404s-the-route assertion passing. Both chromium, `--workers=1`, re-verified after rewrite. lint 0/0, `tsc --noEmit` clean. ⛔ **Re-running the two touched files whole (not just `-g`-scoped) surfaced 3 more reds, NONE fixed this round, respecting the coordinator's "then stop":** `phase15-indicators.spec.ts` AC-8a/AC-8b — same already-known `BUG-ACT-NOTFOUND-COPY-1` shape, trivial same-pattern fix, left alone. `phase22-referrals.spec.ts` Flow 5a — a THIRD, previously-undetected instance of the identical two-gate shape the PO just ruled on, pre-existing (traced to the tester's own earlier commit `a8da28d` via `git log -p`, not caused by today's Flow 3d rewrite), reasoned from facts already verified live this session (no new experiment run), and compounded by a silent vacuous-pass fallback in the test's own `else` branch — meaning the tester's earlier "3 passed" report for this exact test in the BUG-ACT-RAWGRANT-HATLESS-1 close-out was almost certainly non-probative, corrected here rather than left standing. Not extended to match the PO's ruling unilaterally; flagged in the Bug Log for an explicit decision, mechanism fully pre-verified so a fix (if directed) is a same-shape rewrite, not a new investigation. |
| 2026-08-10 | **ACT · TESTER · BUG-ACT-NOTFOUND-COPY-1 full population — coordinator-directed after full `e2e:prod` RED (38 real + 4 infra)** — enumerated the true population (**81 occurrences / 36 files**, matching the coordinator's own count exactly, re-derived independently via `grep -i`), classified every failing site's denial independently of copy (live diagnostic across the 14 QO·B `CUT_ROUTES` + per-site error-context snapshots for the org-tier/ambiguous cases — HTTP-status wasn't usable for most routes, streamed-notFound), fixed 33 of 36 files to the shared `/não encontr/i` stem, left 3 correctly untouched (2 comment-only, 1 already a 3-way OR covering both copies) | **NO P0 — denial held everywhere checked, confirmed via each real boundary's own distinctive body text + recovery link, not generic 404 phrasing.** All 33 touched files run to green across 6 batches + 2 targeted isolated re-runs (`phase22-referrals` 40/40, `quality-oversight` 19/21 solo — the 2 remaining are the new BUG-QO-OVERSIGHT-DOOR-1, unrelated); both files' batch-run failures were cross-file fixture contamination from `perf-sweep-wave2.spec.ts`'s 26+-row fixtures, not regressions, confirmed by isolation. lint 0/0, `tsc --noEmit` clean. ⛔ **A blanket "manage/\*\* = new boundary" rule would have been wrong**: `/o/rede-a/manage/acreditacao` (flag-off denial) and `/o/rede-a/manage/usuarios/[id]` (cross-hospital denial) hit the NEW org-tier boundary, but `/o/rede-a/manage/administradores` (role denial, same persona) and the SAME acreditacao route under a cross-org denial both still show the OLD global copy — which boundary fires depends on WHERE in the render tree the specific denial reason is checked, not the URL prefix; verified per site, never inferred. Also diagnosed (not fixed): `nsp-per-hospital.spec.ts`'s own `expectAccessDenied` helper does a single un-retried `textContent()` read with no wait for the streamed body, a genuine reliability defect that produced a misleading false-pass on first read. **6 non-copy findings surfaced and flagged, none fixed** (full detail + exact mechanism/error text: Bug Log) — 2 already known from the prior round (`qob-org-admin-content-wall.spec.ts` missing nav link; `charters-cadence.spec.ts` AC-5 `acting_as`-in-audit-metadata, possibly recurring in `ethics-e1-access-spine.spec.ts` AC-3b, not confirmed); 4 new (`nsp-per-hospital.spec.ts` missing `actAs` on `admin@` — same class as the closed BUG-ACT-RAWGRANT-HATLESS-1; `nsp-per-hospital.spec.ts` AC-7/AC-8 dispose-PHI button not found; `case-access.spec.ts` AC-3a + `administrativo.spec.ts` POS-5 unrelated content-visibility failures, the former cascading 20 skipped tests; **BUG-QO-OVERSIGHT-DOOR-1** — `quality-oversight.spec.ts`'s `setOversightViaDoor` helper now gets a real app-level `RAISE` rejection from `set_commission_oversight`, confirmed via 2 clean isolated reproductions). **On the 74 unrun tests**: no access to the gate's own batch partitioning/logs from this session — every file in the 81-site population is independently confirmed green where checked; whether that alone clears the 74 (vs. one of the findings above cutting a batch short elsewhere) is only answerable by the next full `e2e:prod` run. |

| 2026-08-09 | **BACKSTOP · LEAD · wave-5 gate (referral disposal backstop + stale messages)** — 1 migration `20260917000400`, **334 registered == 334 files** on a fresh reset | **ALL GREEN.** pgTAP **175 files / 5636 / PASS** (+2 ruling guards) · **RED-PROOF:** re-cutting the restored arm reds **exactly `295` 7.7 (behavioural) + `314` 8.6 (catalog)** and nothing else; restore **byte-identical** · E2E **91/91** (`phase22-referrals` 40, `nsp-per-hospital` 51, `qob-org-admin-content-wall`), 0 did-not-run · lint 0/0 · tsc · vitest **1194**. ⛔ **This PARTIALLY REVERSES `20260917000000` the same day, deliberately.** BUG-QOB-004 was ruled CUT on D5; examining the sibling `dispose_event_phi` afterwards surfaced two facts that were not in front of the PO: **a hospital can have ZERO NSP operators** (`Hospital Unico C`), so NSP-only disposal strands an **LGPD Art. 18** erasure obligation that belongs to the *controlador*; and this platform **already rules the other way for the identical shape** — ADR 0104 D11 keeps the tenancy arm on `revoke_printed_document` because revocation *reveals no content*. Disposal discloses nothing; it destroys. Restored on the two DISPOSAL doors only — **drafting stays cut, the UI wall stays** — and guarded by `314` 8.6/8.7 so a future "finish the disposal wall" sweep reds instead of silently reopening the gap. ⚠ **Three stale pt-BR messages fixed, one per direction:** `dispose_case_phi` **promised** an org-admin arm QO·B removed; `revoke_printed_document` **hid** the tenancy arm it carries. The class — *every arm that moved left its sentence behind* — is invisible to every gate here, because no test reads prose. ⚠ **The gate's first run was RED (UNRUN):** both batches' `db reset` failed with a **502 from the stack gateway** mid-restart, 91 tests never ran. Recorded remedy applied (`supabase stop` → `start` → reset → **verify a real token POST returns 200**, which it did) and the gate re-run clean. |
| 2026-08-09 | **CADENCE · LEAD · wave-4 gate (registry cadence overview)** — 1 migration `20260917000300`, **333 registered == 333 files** on a fresh reset | **ALL GREEN.** pgTAP **175 files / 5634 / PASS** (+10: `261` §CAD) · **RED-PROOF:** neutralizing the door's tenancy filter to `where true` reds **exactly tests 33–34** (CAD-4 cross-org, CAD-5 plain member) and nothing else — the positive arms stay green, as they must; restore **byte-identical** · `ARM=census` + `ARM=floor` **HOLD** · E2E **21/21** (`quality-oversight`, incl. 3 new CAD tests), 0 did-not-run · lint 0/0 · tsc · vitest **1194** · **UI verified live in the browser**, not just built: all four Rede-A committees render the badge and the statuses match the DB probe exactly (Farmácia `em_dia`, the other three `sem_regimento`). ⛔ **A REAL DEFECT I INTRODUCED AND CAUGHT:** the extracted helper was first declared **IMMUTABLE** while reading `now()` — the planner may fold such a call to a constant or cache it across rows, so it would have been wrong intermittently and only under load. Fixed to `STABLE` **and pinned by the migration's own postcondition** (`provolatile = 's'`), because every test passes under either marking until the planner decides to fold. ⚠ **A boundary test that looked like a bug and was not:** `now() - interval '1 month'` walks back a CALENDAR month (31 days in a 31-day month) while `interval '1 month'` COMPARES as 30 days, so the "exactly one period old" probe landed `em_atraso`. The door's semantics are unchanged from the original; the test was wrong. Re-pinned on `semanal` (exactly 7 days both ways) and the month behaviour documented executably as CAD-8b rather than left as a surprise. ⚠ **The census/sweep domain gap fired again:** the new door is set-returning, so `ARM=census` demands a verdict while the door-audit's boolean-only predicate arm **cannot produce one** (swept 0 cases). Verdict recorded as COVERED on the **hand-run mutation evidence**, per the AFF precedent — never cite the census as coverage. Durable fix stays FUP-AFF-1. |
| 2026-08-09 | **RENAME · LEAD · wave-3 FULL gate (`is_tenancy_admin_of`)** — 1 migration `20260917000200`, **332 registered == 332 files** on a fresh reset; ADR 0105 | **FULL GATE GREEN.** `npm run e2e:prod` **1047 passed · 0 failed · 0 flaky · 0 did-not-run · 17 batches · `reset FAILED` = 0** · pgTAP **175 files / 5624 / PASS** · `ARM=census` + `ARM=floor` **HOLD** · lint 0/0 · tsc · vitest **1194**. **Denominator independently reconciled from the raw logs, not read off the summary: 1047 passed + 5 skipped = 1052 accounted = 1052 collected (`spec-counts.txt`), batches 1–17 with no gaps.** Batches 7 and 12 failed their FIRST attempt (42 + 18) with **83 and 35 connection errors** — infra by the documented rule (conn>0 ⇒ infra), auto-retried, **63/63 and 56/56 clean on rerun**. ⚠ **The stale-log hazard fired against my own reconciliation**: a naive "prefer `batch-N-rerun.log`" tally read `batch-5-rerun.log` **dated 08-08** and reported *33 failed* for a batch that actually passed 56/56 — the recorded "an aborted gate leaves a STALE batch-N.log" trap, hit while checking for exactly that class. Age-filter every gate log against the run's own start time before summing. ⚠ Two `-unrun` logs present (`batch-2`, `batch-13`) are likewise **stale** (17:43 today's wave-1 run, and 08-07) — **this run produced none**. |
| 2026-08-09 | **QOB-Q2 · LEAD · wave-2 gate (process-template door tenancy arm)** — 1 migration `20260917000100`, **331 registered == 331 files** on a fresh reset; ADR 0088 Amendment 1 | **ALL GREEN.** pgTAP **175 files / 5624 / PASS** (+7: `314` §12) · **RED-PROOF:** stripping the arm from both doors reds **exactly tests 112–114** (12.1/12.2/12.3) and nothing else — 12.4 coordinator, 12.5 over-grant twin and 12.6/12.7 D12 control all stay green, so each measures an independent arm; restore **byte-identical** on both doors · `ARM=census` + `ARM=floor` **HOLD** · E2E **27/27** (`process-template-versioning`, `process-template-narrative-slot-crud`, `qob-org-admin-content-wall`), 0 did-not-run · lint 0/0 · tsc · vitest **1194**. ⛔ **The finding that changes the item's framing: this was NOT a widening.** Measured on a bare tenancy admin — a direct `UPDATE` on `process_template_versions` **wrote the row through RLS** while BOTH doors answered 42501. All 16 `process_template*` policies already carry the tenancy arm and `authenticated` holds column UPDATE, so RLS (the Rule-1 boundary) already admitted the principal; only the two DEFINER doors refused, because **a DEFINER's gate replaces RLS**. ⚠ **The follow-up named ONE door; the plane had TWO** — `set_template_collects_patient` is the identical shape on the identical table, found by sweeping by property rather than acting on the remembered name. ⚠ **The diff-scoped door sweep swept ZERO cases and that is not a pass:** both doors return `void`, so they are outside the harness's boolean/set-returning domain — **FUP-AFF-1 exactly** ("HOLDS because the door is invisible, not because it is accounted"). Coverage for these two is the mutation-proven keystones, and the record cites those, not the sweep. ⚠ Two fixture traps cost a red round each: `create_case_from_template` takes a TEMPLATE id (not a version id) and raises **P0002 by design** (no existence leak) rather than 42501; and `throws_ok` treats a second argument that is not exactly 5 characters as the expected MESSAGE, so `'no_data_found'` silently became a pt-BR string comparison. |
| 2026-08-09 | **QOB-004 · LEAD · wave-1 gate (referral tenancy-arm CUT)** — 1 migration `20260917000000`, **330 registered == 330 files** on a fresh reset; pgTAP + mutation red-proof + both ARM gates + diff-scoped door sweep + `SPECS=`-scoped `e2e:prod` on the two referral specs | **ALL GREEN.** pgTAP **175 files / 5617 / PASS** (5616 → 5617: the new `295` §7.7 keystone) · **RED-PROOF:** restoring the tenancy arm reds test 50 **and only test 50** — the re-anchored 7.6 NSP twin stays green, which is the point: it proves the twin measures a *different* arm rather than mirroring 7.7. Restore **byte-identical** (md5 `ee400ef1…` both sides) · **`ARM=census`** (450 gates / 460 verdicts) **+ `ARM=floor`** (80 never-called, all allowlisted) **HOLD** · diff-scoped door sweep on `can_dispose_referral_phi` → **COVERED, 0 BLIND / 0 harness ERROR** · E2E **72/72** (`phase22-referrals` 40/40, `nsp-per-hospital` 32/32), 0 failed, 0 flaky, **0 did-not-run** · lint 0/0 · tsc · vitest **1194** · `database.ts` **content-unchanged** (the `git status` M was line-endings only — `--numstat` empty). ⚠ **The gate's first run was RED (UNRUN), not green:** batch 2's `db reset` failed, so `nsp-per-hospital`'s 32 tests never executed — **while the wrapper exited 0**. The summary named it (`32 test(s) NEVER RAN`) and the batch was re-run to 32/32; a run that only checked the exit code would have banked 40/40 as the whole answer. ⚠ **Findings-file hazard recurred exactly as recorded:** the scoped door sweep truncated `authz-door-audit-findings.md` **393 → 36 lines**; backed up before and restored after, git-verified byte-identical. ⛔ **The finding the ruling did not ask for:** the sibling-coherence check run right after the cut shows `dispose_event_phi` is now the **only Rule-12 disposal door still granting a bare tenancy admin** — D5's own reasoning applies to it identically, so the split exists purely because of ruling order. Left untouched on purpose → **FUP-QOB-3**. |
| 2026-08-08 | **QO·B · LEAD · full build + gate battery on a fresh reset** — 6 migrations (`20260915000000`–`…000500`), **328 registered == 328 files**; A/B equivalence matrix rebuilt on a CLEAN seed (928-cell pre-image, 5 personas × 41 tables); `b1` mutation audit; both ARM gates; 3 diff-scoped door sweeps; `SPECS=`-scoped `e2e:prod` | **ALL GREEN.** pgTAP **175 files / 5553 / PASS** · A/B **LOST = the 2 tenancy admins on the ratified tables ONLY · GAINED = 0 · KEEP-side 0/0**, `staff_admin`+`staff` controls unchanged, `orgadmin.b` 0 CUT-cells both images (cross-org control) · `b1` **17/17 RED-PROVEN** (12 under-cut + **5 over-cut**), RESTORE byte-identical, CONTROL 49 ok/0 · **`ARM=census`** (450 gates / 460 verdicts) **+ `ARM=floor`** (82 never-called, all allowlisted) **HOLD** · door sweeps: 15 diff-derived → 13 ran → **3 BLIND** → keystoned → **re-swept 3/3 COVERED**; `can_write_attachment` **COVERED**; 0 harness ERROR · E2E **6/6 GATE GREEN**, accounted 6/6, `reset FAILED` = 0 · lint 0/0 · tsc · vitest **1194**. ⛔ **The headline is NOT the green table: M1–M4 cut the TABLES and left 16 DEFINER DOORS open** — `orgadmin.a` still read **6 free-text answers** via `dashboard_free_text` while `responses` returned 0. Closed by M5+M6. **Four green gates were each blind to it in a different way** (A/B sees only tables · the 0079 sweep neutralizes only BOOLEAN gates · `ARM=floor` asks *called*, not *correct* · `314` asserted tables). Found by re-reading the ratified CUT list against the catalog — a check **no harness performs**. ⚠ **And that check was wrong on its first run**: `\yis_commission_admin_of\y` cannot match `…_for` (10 findings → 12 corrected). ⚠ **Process:** a **killed sweep LEAKS a mutation** — a 10-min tool cap cut run #1 mid-case and left `indicator_measurements_select` neutralized to `true` in the LIVE catalog (found by checking the catalog, not by trusting the harness's restore; fixed by a reset). A **partial sweep also overwrites the committed findings file** (would have replaced 356 lines with 11) — restored each time. The **E2E wrapper exited 0 while printing `FATAL: toolchain drift`** (worktree `node_modules` next 16.3.0-preview.5 vs declared 16.3.0 after the fast-forward; `npm ci`). |

| Date | Run | Result |
| --- | --- | --- |
| 2026-08-10 | **ACT S1 · `tester` · `actAs` seam + seed-sensitivity sweep** (plan §4 Stage 1) — landed the harness seam in `e2e/helpers/auth.ts`: `loginFresh` gains `_actAs?: string` (doc'd no-op, ADR 0106-referenced — Stage 3's ONE edit site, dropping the underscore); `cachedSignIn` gains `actAs?: string`, threaded through to `loginFresh` AND partitioning the session-cookie cache key (`` `${email}::${actAs}` `` when set, else plain `email` — byte-identical for every existing caller, none of which pass it) so a future per-hat cache collision can't happen without Stage 3 touching the caching logic at all. `signInAs`/67 call sites: zero changes (additive optional param). Then swept `e2e/` for specs perturbable by the new `dualhat.a@test.local` persona (org_admin, Rede A org-tier + quality_reviewer, Hospital Central A hospital-tier — both rows `commission_id IS NULL`). **Property swept by:** an assertion whose truth depends on the SIZE/unfiltered CONTENTS of an org- or hospital-tier roster/directory/candidate-list touching Rede A or Hospital Central A, where the enumeration is NOT pinned to one named identity via a search filter or a `(commission_id, principal_id)`-scoped query. Architecture Rule 2's scope-exclusivity CHECK rules out every COMMISSION-tier roster a priori, by construction, not by inspection — `dualhat.a`'s two rows can never appear on a `commission_id`-scoped query, which excludes `administrativo.spec.ts`'s "Membros" roster, `phase10-meetings.spec.ts`'s "Preencher com membros" autofill, and `views-labels-participants.spec.ts`'s "N membros convocados" meeting-invitee count. **7 files identified** as reaching the exposed org/hospital-tier surfaces (org people-directory `/manage/usuarios`, `AddMemberPicker`/`list_addable_commission_members`, the D9 admin-toggle no-lockout controls, the org_admin content wall): `aff-hospital-affiliation.spec.ts`, `phase3-admin-members.spec.ts`, `user-registration.spec.ts`, `hospital-admin-tier.spec.ts`, `quality-oversight.spec.ts`, `qob-org-admin-content-wall.spec.ts`, `mem-memberships-collapse.spec.ts` (126 tests). **Excluded, with reasoning, not run:** `platform-org-admin-provisioning.spec.ts` (targets `ORG_B` = Rede B exclusively + a dedicated non-seed invitee, by the file's own header comment); `charters-cadence.spec.ts` / `phase-multitenancy.spec.ts` (swept, no roster-count assertions found — `org_admin` used only as a login persona); `ethics-e2-procedure.spec.ts` / `phase10-meetings.spec.ts` / `views-labels-participants.spec.ts` (commission-tier scoped, Rule 2 excludes them by construction, see above). Ran the 7 identified files via `REBUILD=1 SPECS="…" npm run e2e:prod` (chromium, fresh DB + fresh server per batch, 3 batches) per `docs/testing/e2e-prod-build-gate.md`. | **GREEN — 125 passed · 0 failed · 0 flaky · 0 infra · 0 did-not-run · 1 known skip** (`user-registration.spec.ts` AC2 invite-mode — `test.skip`, server-env-gated by the file's own design, pre-existing) **· accounted 126/126 collected · 3/3 batches green.** Batch 1 (aff-hospital-affiliation + phase3-admin-members + user-registration): 40/40 + 1 skip. Batch 2 (hospital-admin-tier + quality-oversight): 59/59. Batch 3 (qob-org-admin-content-wall + mem-memberships-collapse): 26/26. **ZERO regressions — every candidate spec's roster/directory/picker assertion turned out already immune BY CONSTRUCTION**, confirmed by measurement rather than by the reading alone: search-filtered to a named identity before assertion (`AddMemberPicker` in both aff-hospital-affiliation + phase3-admin-members), a `(commission_id, principal_id)`-scoped diff (`countCommissionMembership`), a negative cross-org check unaffected by an added same-org row (`hospital-admin-tier.spec.ts`'s unfiltered-directory and `?search=qualidade` tests), or — per `user-registration.spec.ts`'s own header comment — already hardened against roster growth from a **prior, named incident** ("this was the AC1/AC7 full-suite-contamination cause"). No bug filed; no spec edited. `npm run lint` clean (eslint 0/0 + `lint:css-vars` + `lint:memberships-door`) · `npm run typecheck` clean. Full suite NOT run here (lead's step, per task scope) — see the `e2e:prod` GATE SUMMARY line in the run log for this scoped subset: `125 passed · 0 failed · 0 infra · 0 flaky · 0 did-not-run · 3 batches` / `GATE GREEN`. |
| 2026-08-09 | **QO·B · `tester` · BUG-QOB-003 UI-half gate step 2** — extended `e2e/qob-org-admin-content-wall.spec.ts` (6→19 tests: 7-item KEEP nav, configuration landing, indicator Q3 split, all CUT routes, coordinator no-regression, cross-org, keyboard-only, the manufactured `"member-and-configuration"` case) + swept 32 e2e files for stale org_admin/hospital_admin assumptions (an Explore sub-agent + direct catalog checks), fixing 4 confirmed-stale files. Prod-standalone server built + run from THIS worktree (cwd verified via `Get-CimInstance Win32_Process`); each touched file run to green on its own fresh `db reset` (case_referrals-flag cross-file contamination from an earlier scoped grep run was diagnosed and is not a product defect — full-file/fresh-reset runs are the ones reported below) | **All touched specs GREEN.** `qob-org-admin-content-wall.spec.ts` **19/19, run twice (0 flake)**. `phase15-indicators.spec.ts` **12/12** (AC-5b rewritten: UI now proves the withheld-CAPA-region contract instead of a since-impossible operator-button click; DB-level authorization proven via the real `open_capa_plan` door, mirroring AC-6). `hospital-admin-tier.spec.ts` **38/38** (1 test retired — "hospital-wide response reads" was pinning the exact over-reach QO·B removed; now asserts the ratified 404). `phase22-referrals.spec.ts` **40/40** (2 tests — Flow 3d/5a — swapped `admin@` → `pqsdual.a`; Flow 5a's old `if (isVisible) … else { if includes(PHI) … }` had gone silently VACUOUS post-QO·B, now asserts reach explicitly). `nsp-per-hospital.spec.ts` **32/32** (AC-7's disposal test swapped `admin@` → `pqsdual.a`; also corrected a false "`is_admin` arm" claim in a stale comment — catalog-verified `can_dispose_referral_phi` has no such arm). `meetings-reserved-sessions.spec.ts` Deliverable-3 **2/2** (comment-only fix, mechanism corrected, assertions were already right). `cases-board-access.spec.ts` **2/2, unmodified** (already-correct precedent, confirmed). **1 new bug filed: BUG-QOB-004** (encaminhamentos/** — a route never in QO·B's ratified scope — now 404s a bare tenancy admin who still holds live DB authorization there; not a security defect, a capability-reach regression). Lint 0/0 + `tsc --noEmit` clean on every touched file. `git branch --show-current` verified `feat/quality-office-oversight` before staging; `e2e/**` + `PROGRESS.md` only, no app code. **Full `e2e:prod` is the lead's step, not run here** |
| 2026-08-08 | **Next 16.3.0-stable upgrade · solo session · FULL `e2e:prod` gate** (`npm run e2e:prod` from Git Bash, fresh build + per-batch `supabase db reset`, 17 batches) + BUG-PDF2-002 investigation probes, all on the prod-standalone build | **ZERO assertion failures on Next 16.3.0 stable.** Gate: **991 passed · 0 failed · 33 infra-unproven + 2 did-not-run (batch 5 only)**; the batch-5 spec set (ff2-matrix · ff3-validations · ff4-power-authoring · ff5-references · flagged-aggregate-result, 56 tests) then re-run foreground on a fresh reset → **56/56 GREEN**, so coverage is complete and the run is materially cleaner than the documented ~18–27 flaky baseline. Batch-5's infra event was the known Windows mid-run server-death class (its in-run Playwright retry re-created a `phase_results` fixture → cascading 23505s — fixture symptom, not defect). Also green on 16.3.0: tsc · lint · vitest 1194/1194 · both PDF suites 12/12 incl. the newly pinned BUG-PDF2-002 streamed-notFound contract assertions. Upgrade commit `39bf5ac`; resolution commit `2789b75` |
| 2026-08-08 | **PDF·P2 · `tester` · QA r1 fix-wave (A7/A8) regression re-run + new A7 UI test** (`npx playwright test e2e/pdf-printing-meetings.spec.ts` and `e2e/pdf-printing.spec.ts --project=chromium --workers=1`, prod-standalone server, fresh `supabase db reset --local` per run, 322 migrations) — **NOT the full-suite `e2e:prod` gate** (lead's step) | **12/12 GREEN across two full runs (24/24 total)** — the existing fixtures (no case-linked agenda items) are unaffected by the A7/A8 conjunction, as predicted. **New test ("A7: the linked case respondent cannot mint or download the ata"): 3/3 GREEN** (1 solo + 2 in the full runs) — composed via real RPCs against the SEEDED ETH·E1 ethics case, no participants-chain fixture of its own needed; coordinator mints fine (contains_phi=true, phi/ storage, DB-truth checked) and downloads 200; respondent reaches the meeting (200, not a BUG-PDF2-002 repeat) but sees no panel entry, gets the door's verbatim 42501 on mint, and 404s probing the coordinator's download path directly. **0 new bugs.** One infra event (Windows prod-standalone server collapse mid-12-test-run, matches the documented flaky-baseline class) triaged by splitting into per-file runs, not filed. Detail: M-T1 row above |
| 2026-08-08 | **PDF·P2 · `tester` · scoped run of the new phase spec + the P1 no-regression check** (`npx playwright test e2e/pdf-printing-meetings.spec.ts --project=chromium --workers=1`, prod-standalone server, fresh `supabase db reset --local` per run; then one UNMODIFIED run of `e2e/pdf-printing.spec.ts`) — **NOT the full-suite `e2e:prod` gate** (lead's step) | **New spec: 4/4 GREEN, run twice on independent fresh resets (8/8 total).** **P1 no-regression check: 7/7 GREEN** (first attempt hit the documented PGRST002 post-reset race — 2 spurious, retried once clean per house rule, not a regression). **2 bugs filed** (BUG-PDF2-001 LOW copy, BUG-PDF2-002 MEDIUM status-code-not-leak, both pre-existing/non-blocking — see Bug Log). Detail: M-T1 row above |
| 2026-08-07 | **PDF·P1 · `tester` · scoped run of the new phase spec** (`npx playwright test e2e/pdf-printing.spec.ts --project=chromium --workers=1`, prod-standalone server, fresh `supabase db reset --local` before each run) — **NOT the full-suite `e2e:prod` gate** (that is the lead's step per this task's scope) | **7/7 GREEN, run twice on independent fresh resets (14/14 total) — 0 flakes, 0 bugs filed.** Covers the P1 §2.8 acceptance chain: full lifecycle, supersession recency wording, public `/verificar`+`/api/documents` reachability boundary, keyboard-only mint flow, `platform_admin` UI exclusion, not-recognised-vs-unavailable state distinction. Detail: T1 row above |
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
| **ACT** — act-as role assumption, PRE-BUILD plan review (ADR 0106) | ✅ **APPROVED (pre-build, r2)** — `d80d4a3` (docs-only; nothing built yet) closes **all 9** r1 findings, re-verified against the actual diff plus a fresh live-catalog check where a fix asserted a number (127 `app` boolean gates and the `can_manage_professional` 10-caller count both re-confirmed unchanged). Both BLOCKERs closed: Stage 2 now covers **8** direct `memberships` readers incl. `can_manage_professional`, with the sweep boundary re-specified as the PROPERTY (comment-stripped direct read, no `has_role*` call, over all ~127 `app`/`public` boolean gates) rather than one more name on a list — closing the root cause, not just the symptom; Stage 0's enum gains `'platform_admin'` alongside `memberships_role_check`'s values, with the D11/audit-stamp consequence threaded. All 4 MAJORs closed: ADR census corrected to 127/80 **with a second-correction provenance note** (the first fix attempt itself mis-published the outside-prefix count as the total — named, not silently overwritten); `session_context`'s `has_role_any` claim corrected (comment-only regex-hit trap named) and plan §1 reworded from an action to a no-op confirmation incl. a re-diff-the-comment step; the `profiles` co-member RLS arm gets an explicit Stage-3 raw-`pg_policies` sweep bullet with a sound fix shape (caller side hat-aware via `is_member_of`, target side unchanged) and a sibling-arm disposition rule; Stages 0/1 gates now name `ARM=census`+`ARM=floor` per 0079 Amendment 1. Both INFOs (permissive-sibling keystone guard; page.tsx role→route table) incorporated verbatim. 1 residual non-blocking note for the Stage 3 reviewer: confirm the co-member fix's final predicate calls `is_member_of(them.commission_id, auth.uid())` (or equivalent) rather than a looser approximation. No PO decision re-litigated. r1 verdict + full findings below. | 2026-08-09 | [act-as-plan (r2)](docs/reviews/act-as-plan-review.md#round-2--re-review-of-the-d80d4a3-fixes) |
| ~~**ACT** — act-as role assumption, PRE-BUILD plan review, round 1~~ | ⛔ **CHANGES REQUESTED (pre-build, r1)** — 2 BLOCKER: **(1)** `app.can_manage_professional` is an 8th direct `memberships` reader (`m.role = 'staff_admin'`, bypasses `has_role`), outside Stage 2's enumerated "7 direct readers" and outside the `is_*` prefix boundary both censuses used — gates 10 write RPCs (professional-profile + ethics-vocab + case-assignment-role management) that will stay hat-independent after cutover, D13's own "fails OPEN, looks normal" shape recurring on a second, un-enumerated door. **(2)** Stage 0's enum-derivation instruction ("source: `memberships_role_check`") omits `platform_admin` — confirmed absent from the live CHECK constraint — yet D11 requires it be representable for the implicit break-glass derivation and the `metadata.acting_as` audit stamp. 4 MAJOR: the ADR's own "measured, not assumed" boolean-gate census undercounts the live catalog (127 `app` boolean gates, not 80; 80 outside `is_*`, not 33 — the gap that hid finding 1); ADR §3's claim that `public.session_context` calls `app.has_role_any` is false (it independently duplicates the filter, comment-only "verbatim" claim never verified) so Stage 3's "rewired OFF `has_role_any`" task rests on a wrong premise; an RLS arm on `profiles` (`profiles_select_self_or_admin`'s co-member visibility) joins `memberships` directly with no role predicate, unreached by any stage, leaking membership-adjacent visibility across a suppressed hat (D4); Stages 0/1's gate bullets omit `ARM=census`/`ARM=floor` (CLAUDE.md §6 step 1, the exact omission ADR 0079 Amendment 1 was written to close). 1 MINOR (D12's "~30 functions already use this `current_setting` pattern" — actually 1, `is_admin`; 32 others read unrelated RPC-context GUCs) + 2 INFO (revert-twin keystone well-specified, note the permissive-sibling guard explicitly; page.tsx's 8-branch precedence → picker mapping not enumerated). The `is_*` census itself (47 total, 12/2/7/14/12 split, the 7 named readers) verifies **exactly** against the catalog; storage policies, `proxy.ts`, `has_role`/`has_role_any`/`member_can`/`_case_caps` bodies, and the JWT-claims consumption path all verified clean. No PO decision needs re-litigating — all fixes are plan/ADR completeness corrections before Stage 0 starts. | 2026-08-09 | [act-as-plan (r1)](docs/reviews/act-as-plan-review.md) |
| **QO·B** — org_admin/hospital_admin content wall | ✅ **APPROVED (r2)** — *(recorded by the lead from QA's committed r2, `93b0dfb`; QA's review file is authoritative)* BLOCKER-1 **closed and re-proved on the reviewer's own fixtures**: correspondence re-derived from the inventory §4.4 TEXT (not M7's array) — 27 CUT-side names armless + all present (non-vacuity), 5 ratified KEEPs still armed, `case_events` policies 0; M7's postcondition enumerates NAMES with an existence check and its regex is bare (matches `_for`). Behaviourally the r1 polarity is **inverted**: both tenancy tiers now stop at the authority code (`remove_case_participant` HC0E4/NOT-REMOVED · `record_recusal` P0002/0 rows · `case_viewer_capabilities` `can_manage_lifecycle:false`) while the coordinator twin reaches the later gate. MAJOR-1 closed **and r1's four-door set narrowed correctly**: only `cancel_case`/`close_case` had the silent-success shape (RLS-exempt `commission_of_case` lookup) — verified via a manufactured excluded-`staff_admin` instance, all four raise P0002 with a clean-coordinator control; backend's two declined-as-vacuous red-proofs judged honest (`314` §11d pins the denial, only mechanism attribution unproven). Keystones spot-neutralized independently (`remove_case_participant` + `case_viewer_capabilities` → 7 tests RED incl. both Q4 hospital_admin arms + the correspondence invariant; restore byte-identical, 0 residual). pgTAP independently reproduced **175f/5616/PASS**; no over-cut (93→73 token carriers = exactly M7's 20 edits); the `229` re-anchor's lost positive property re-homed to `314` 11.25 (verified); findings file back at 393 lines. **BUG-QOB-002 re-closure CONFIRMED.** Two self-corrections recorded: r1's MAJOR-1 was one measurement too broad; r1's `lift_recusal` INFO was the reviewer's own fixture bug (id resolved under the tested role → NULL passed into the door — *a probe whose fixture lookup runs under the role being tested measures the fixture, not the gate*). NEW MINOR-3 (stale Phase Status row + gate-evidence block) fixed by the lead in this same commit wave. | 2026-08-09 | [r2](docs/reviews/phase-QO-B-review.md) |
| ~~**QO·B** — round 1 (§4.4 CUT list unexecuted)~~ | ⛔ **CHANGES REQUESTED (r1)** — **1 BLOCKER: the ratified §4.4 case-plane CUT list was never executed, and BUG-QOB-002 is recorded CLOSED while still live.** M4 cut a **proxy population** — its header asserts *"the case-content mutators are exactly the functions carrying A4-Unit-2's exclusion guard"*, which is **false**; ~17 §4.4 doors carry no `assert_not_case_excluded` and so were never in the population. **MEASURED** on a fresh reset under `set local role authenticated`, fixture asserted real (`is_commission_admin_of_for`=t, `is_staff_admin_of_for`=f, **`can_read_case`=f**): `remove_case_participant` **ADMITTED, `removed_at` SET** · `record_recusal` **wrote `case_recusals` 0→1** · `set_case_participant_role`/`add_case_participant`/`schedule_ethics_hearing` pass authority and reach a LATER gate while the **`orgadmin.b` control is stopped at the authority code** (HC0E4/HC0J1) · `case_viewer_capabilities` answers **`can_read:false` + `can_manage_lifecycle:true`**. Reproduces at the **hospital_admin** tier (Q4 unfulfilled symmetrically). **Every gate was blind for a nameable reason:** M4's postcondition validates the proxy's SIZE not its CORRESPONDENCE to the ratified list; `b1` 31/31 is true but its case list inherited the same wrong population; `314` has no case-door keystone; the A/B matrix sees tables and `cases` was already A4-walled. **This is §6.3 recurring one level up** — the "re-read the CUT list against the catalog" check that produced M5/M6 was run on the response + document planes and **never on §4.4**. **MAJOR-1:** `close_case`/`cancel_case`/`set_case_outcome`/`update_case_narrative_body` are INVOKER — authority admits, RLS stops the DML, so they **return SUCCESS while writing nothing** (`close_case` also skips the HC031 gate that stops the real coordinator). ⚠ My own first probe ran as `postgres` (RLS-exempt) and over-reported these — **the role is the measurement**. **2 MINOR** (masked-but-live tenancy arms on `case_events`/`get_case_detail`/`list_my_cases`; **B.14's gate artifacts are no longer reconcilable — `spec-counts.txt` was overwritten by the scoped PDF re-runs**, the same "partial sweep overwrites the findings file" hazard, on the E2E gate) + **2 INFO** (`bulk_create_cases`/`create_case_from_template` and `lift_recusal` **unmeasured**, not cleared). **VERIFIED SOUND, re-proved not read:** M1–M3 table cuts clean in `pg_policies` (`responses_admin_all` gone; `is_member_of` is commission-scope only, so the doc/measurement policies do NOT readmit) · M5 doors `dashboard_free_text` **0 / 6** twin, export 0/6, completion 0/2 · M6 `list_commission_documents` 0/2, `documents_due_for_review` 0/1 · **storage clean (self-audit ④ closes)** · **B.8 keystones non-vacuous — I neutralized `list_commission_documents` + `supersede_response` myself, `314` tests 45+51 went RED, restore byte-identical, residual-mutation check 0** · **hospital_admin parity MEASURED (self-audit ③ closes on the walled surfaces)** · no over-cut on KEEP (17/13/1) · session contract flag-not-role with no stale consumer · guard routing splits mixed files per-function, **no CUT action gained a tenancy arm** · UI allowlist is fail-closed, `role !== null` hardened, Q3 split withholds at the READ · **BUG-QOB-004's catalog claims verified accurate** · J1c honestly provisional. | 2026-08-09 | [qo-b](docs/reviews/phase-QO-B-review.md) |
| **PDF·P2** — PDF document printing, Meetings (ata) | ✅ **APPROVED (r2)** — Package A wave verified by **re-probing, not by reading**. **BLOCKER-1 CLOSED and independently re-proven:** the seed contains no persona with `reach=t ∧ full_sight=f`, so t40 could not be confirmed from outside the test txn and a never-firing conjunct would have closed the blocker vacuously — I therefore built the class myself in a **rolled-back transaction** (4-row participants chain making `chefe.ccih`, a full member who reaches the meeting, the `respondent_doctor` of the linked case): `reach` **stays t** while `full_sight`→**f** and the arm→**f**. `app.can_read_full_meeting_content` diffed term-by-term against the LIVE `_project_meeting_agenda_item`: respondent term mirrors exactly; capability term adds a **presence guard** (declines to refuse where masking would null nothing — more permissive only where no content is at stake); unlinked items contribute nothing. Explicit-uid DEFINER, `search_path=''`. **MAJOR-1 CLOSED** by A8's presence-derived label — all four catalog-`PHI-BEARING` columns covered plus the process-number term; t45/t46 pin `phi/` bifurcation, t50 the clean case, **t49 that `form_response` still refuses `contains_phi=true`**. Notably **A8's correctness DEPENDS on A7** (presence-testing is only meaningful because the provider now always runs unmasked) — reasoned explicitly in-code, not a coincidence. **All 7 MINORs closed**, incl. the revoke asymmetry pinned in **both** directions (t52–t54) with the D11 citation, so it is now a decision. Kind-conditional sites re-counted from the live door body = **exactly 3** (A8 trio supersedes "exactly 2"; a 4th is the leak signal). Property diff vs my own r1 baseline byte-identical across three re-emits; `lookup_` still service_role-only. Lint 0 · tsc 0 · 22 unit tests. Keystones non-vacuous: t39 pins the participants chain is real, t40 asserts the predicate **discriminates**, **t42 is the over-grant twin** (same persona passes on the un-linked meeting — the assertion that makes t41 mean its label). **2 new INFO:** helper is fail-open **standalone** (`not exists` over zero agenda rows → `t`; safe only because `can_reach_meeting` is the first conjunct — P3/P4 must not reuse it alone) · `template-fingerprints.ts` still calls `final_signed` the "quorum line" variant after MINOR-6 set `quorum: null`. Carried forward unchanged: FUP-PDF-1..4, BUG-PDF2-002. **r1 baseline below.** | 2026-08-08 | [pdf-p2](docs/reviews/phase-PDF-P2-review.md) |
| ~~**PDF·P2** — round 1~~ | ⛔ CHANGES REQUESTED (r1) — **the plan §3 binding question is answered YES: P2 stayed inside provider + template + arm + tests, and the P1 abstraction absorbed a second kind with no pipeline surgery.** Both lead rulings re-derived independently, not read: the mint door has **2** semantic kind-conditional sites (every other `p_source_kind` is a pass-through arg or a column comparison), and BUG-PDF2-001 is **copy-only** (`sourceKind` was already a prop; the sole structural edit is a JSX rewrap). Property-diff vs my own P1-recorded baseline: `prosecdef`/`proacl`/`proconfig` **byte-identical** on both re-emitted functions. Meeting arm is one-line delegation to `app.can_reach_meeting` (explicit-uid DEFINER, `search_path=''`, no `auth.uid()` inside); `case`/`interview` have **no arm** and fall to the fail-closed ELSE — stronger than literal-false. I probed the NULL-propagation fail-open (`if not NULL` skips the raise): nonexistent meeting returns **false, not NULL** ✅. No-admin-arm delta proven **behaviourally on seed data** — the same org_admin is denied `meeting`, passes `form_response`, and `is_commission_admin_of_for` is genuinely true, so the denial is the missing arm and not a powerless persona. P1's 2 form fingerprints + version byte-identical to `main`. **BLOCKER-1:** the ata bakes in the **minter's** per-caller projection (`app._project_meeting_agenda_item` masks title for a case respondent and the 3 free-text fields without `read_case_deliberation`) and then re-serves it under `can_reach_meeting` = *member ∧ (commission_default ∨ attendee)*, which has no capability or respondent term — and the masked columns have **no SELECT grant to `authenticated`** at all, so the projection is the real boundary, not a UI nicety. A respondent who is a commission member downloads his own process number. Violates D11's load-bearing sentence; untested by 312/313/E2E. Not a P2 authoring defect — it is the first kind the P1 abstraction cannot fully describe, which is exactly what §3's question exists to surface. **MAJOR-1:** `minutes_md` + the 3 agenda free-text columns are catalog-classed `PHI-BEARING (Rule 11/12)` yet the payload hardcodes `containsPhi:false` → `std/` storage, no non-suppressible band; `answers`/`responses` carry **zero** such comments, so meetings really are asymmetric — PO ruling needed per D9's own "upstream ADR" clause. **7 MINOR** (unpinned `hospital_admin` control; revoke-without-sight now asymmetric + untested; t45 type-confused fixture; t30 mislabeled "minter"; watermark derivation duplicated in TSX; 4 unpinned template branches; raw enum key could print onto permanent paper) + **3 INFO**. Sound: Rule 7 **23/23** escaped incl. all 4 `formatDateTime` sites (the P1 MINOR-5 lesson carried forward), FINAL⇔`signed\|distributed` total over 6 catalog statuses and fails safe, signature filter an **allowlist**, Rule 9 clean, UI gate a strict subset of the door, and 313's fingerprint + fail-closed keystones carry real preconditions and bidirectional vacuity controls. | 2026-08-08 | [pdf-p2](docs/reviews/phase-PDF-P2-review.md) |
| **PDF·P1** — PDF document printing, Forms + full skeleton (ADR 0104 D1–D15) | ✅ **APPROVED (r2)** — fix wave verified by **re-probing, not by reading commits**: both r1 MAJORs CLOSED (purity gate now cuts on the PROPERTY — my r1 escapes `../supabase/server` and `../../queries/…` plus a bare-directory shape all error now, alias form unregressed; fingerprint gained `FINAL_PHI_LOGO` **with a vacuity control** proving canonical and variant cover *disjoint* branches, asserted on markup forms because bare class tokens would be vacuous) and MINOR-4/5/6/7/8/9 CLOSED. Revoke door re-read from `pg_get_functiondef`: not-found merged into the 42501 authority raise, `P0002` gone from the **live** surface, and the re-emit lost **no** property (`prosecdef`/`proconfig`/`proacl` byte-identical — the DROP+CREATE hazard checked, not assumed). t73 pins the one-active index at table level with the derived-path trap correctly threaded; t72 picks the persona that makes the flag-off assertion falsifiable. Migrations 320==320, lint + `tsc --noEmit` exit 0, PDF unit tests 18 pass. **3 MINOR deferred by agreement, still OPEN:** returns-row re-exposure · limiter granularity (+ stale "verbatim" comment) · SQLSTATE-allowlist text mapping. 2 new one-line INFO (dead `'P0002'` allowlist entry; `backend-state.md:1801` still says 69, now 73). **r1 baseline below.** 0 BLOCKER. Every security claim re-derived from the **live catalog**, none from migration text: one policy on `printed_documents` (so no permissive sibling can fake a row-assertion), zero DML grants to `authenticated`, the four withheld columns confirmed, `anon` reach **provably nil** (`has_function_privilege` + `table_privileges` both empty), `printed-documents` bucket private with **zero** storage policies, `lookup_printed_document` `proacl` service_role-ONLY, and the `form_response` arm mirroring the live `responses` read surface term-for-term (incl. `responses_admin_all` being a `FOR ALL` ⇒ read policy) via the correct `_for` helpers. **D11 noun rule proven structurally**, not just by test: a comment-stripped `prosrc` probe shows neither delegated arm (`can_read_correction_response`, `can_access_targeted_response`) nor either admin helper carries an `is_admin`/platform branch. **D8 survives a whole-repo sweep** — 0 `getPublicUrl`, 0 `createSignedUrl` naming this bucket, one column-listed `select`. Rule 7 escaping exhaustive at every payload-string interpolation. pgTAP independently mutation-audited against the §7.1 trap list (personas verified real; t1 **asserts** the flag rather than setting it); E2E has **zero** defensive branching and a real Tab/Enter flow with no `.focus()`. qa re-ran `ARM=census` (**HOLDS**), lint, `tsc --noEmit`, PDF unit tests — all green. **2 MAJOR carried forward, non-blocking, close before P2:** the D14 purity gate is bypassable by *relative* import (red-teamed via `eslint --stdin`: alias form errors, `../supabase/server` passes — an enumeration bounded by a syntax, not the property; nothing violates it today), and the D4 fingerprint fixture pins only the `draft`/no-PHI/no-logo branch, leaving the `final` chip (**the branch most real documents use**), the PHI band and the logo editable without a version bump. Plus 9 MINOR (generic-SQLSTATE allowlist can surface English Postgres text; mint/revoke composite return re-opens the 2 withheld columns; global in-process rate limiter is a DoS lever; revoke checks existence before authority; `format*` fallback unescaped at 4 sites; ADR 0104 unamended for the 4 ratified deviations; one-active index untested; 2 door-coverage gaps; raw reason-class identifier in the pt-BR UI) + 6 INFO. | 2026-08-07 | [pdf-p1](docs/reviews/phase-PDF-P1-review.md) |
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
| 2026-08-09 | **ACT S0 — the role enum lands in `public.platform_role`, not `app.platform_role`** (LEAD, on a measured Stage-0 finding; schema placement was never one of the PO-locked P1–P6). `supabase/config.toml` exposes `["public","graphql_public"]`, so an `app`-schema enum is **invisible to `gen:types`** — silently voiding the plan's "the picker (via generated types)". Rejected alternatives, named so a later sweep does not "fix the inconsistency": **exposing `app`** would put all ~281 `app` DEFINER doors on PostgREST (an attack-surface change, not a typing fix); a **hand-kept TS mirror** is exactly the stale-assertion shape this repo keeps getting burned by. A bare enum TYPE in `public` is **not a relation** — no endpoint, no RLS surface — and `public.audio_job_status` is the standing precedent that a `public` enum emits a proper literal union. **11 labels = the 10 `memberships_role_check` values + `platform_admin`** (D11: not a `memberships` value, it lives in `profiles.is_admin`, but must be representable for the break-glass hat, the selections row and the `metadata.acting_as` stamp). | [0106](docs/decisions/0106-act-as-role-assumption.md) · [plan](docs/plans/act-as-role-assumption.md) |
| 2026-08-09 | **`is_commission_admin_of` → `is_tenancy_admin_of` RENAMED (PO; no shim; historical docs NOT rewritten).** The predicate resolves org_admin/hospital_admin and is FALSE for `staff_admin`, so the name asserted the opposite of its meaning — the repo's standing stale-claim hazard spelled in an identifier. **PO rulings:** ① **no backward-compatible shim** — anything missed fails loudly at migration time rather than resolving quietly (this codebase's recurring failure is a stale name that keeps working); ② **living docs only** — `backend-state.md` updated + carries the mapping note, while ADRs/reviews/plans/progress keep the old name because they record what was decided when it was called that, the same reason migrations are immutable here. ⚠ **Mechanism finding, measured not assumed:** `pg_policy` stores a PARSED tree referencing the function by **OID**, so **all 54 policies followed with zero edits**; only `pg_proc.prosrc` (text) needed rewriting (75 bodies). **The D11 lesson does NOT transfer** — that was an *enum* re-key where labels are string literals inside predicates, so policies did *not* follow. Same-shaped task, opposite substrate. | ADR [0105](docs/decisions/0105-rename-is-tenancy-admin-of.md) |
| 2026-08-09 | **QO·B PO RATIFICATION SESSION — the FUP-QOB-2 package worked item by item.** The PO declined a block ratification and asked to be walked through each ruling with its evidence, so every verdict below was taken against a **live-catalog measurement**, not the doc's own claim. **RATIFIED:** ① fix shape (tenancy admin = session FLAG, never a coerced role — decisive point: coercion is the direct cause of BUG-QOB-004 and makes every `role`-based gate silently wrong one route at a time) · ② `manage/audit/**` + CSV = KEEP (`audit_log_select` carries the tenancy arm verbatim — the UI is being made to agree, not widened) · ④ `manage/acreditacao/**` membership-gated (all four accreditation-plane policies measured, tenancy arm = **false** on every one; reversing would be a WIDENING) · **FUP-QOB-1's J1c pin** as the standing guard (the behavioural surface *collapsed*, so a structural pin is the strongest thing that still exists; the alternatives measure an invented grant or leave no guard at all). **LEFT OPEN BY CHOICE, not pending:** ③ `manage/charter` (status quo NOT-KEEP stands; the live argument FOR keeping it is that a charter defines the committee's scope = a *container* under D12 — but KEEP would be a widening, not a restoration) · ⑤ dual-hat precedence (measured: 3 `quality_reviewer` principals exist, **none** holds a tenancy role — unfalsifiable today; the PO declined to set a default in the abstract). **RULED:** BUG-QOB-004 = **CUT-the-arms**; `setTemplateCaseType` Q2-consistency **approved**; the `is_tenancy_admin_of` rename **re-confirmed** and sequenced LAST so it sweeps a settled catalog once (measured blast radius **77 functions + 54 policies + 318 files**). | [FUP-QOB-2](docs/progress/follow-ups.md) · [0100](docs/decisions/0100-quality-office-oversight.md) D12 |
| 2026-08-09 | **QO·B BUG-QOB-003 presentation rulings (LEAD, catalog/precedent-backed — PO ratification listed for step 4).** *(→ ①②④ RATIFIED, ③⑥ left open, ⑦ approved as its own wave — see the ratification row above.)* ① Fix shape = **flag + KEEP-scoped UI** (Phase A's quality_reviewer flag-not-role precedent + the cases-board 404 precedent; options (a)+(b) of the bug record). ② **`manage/audit/**` + its CSV export = KEEP** (`audit_log` is on the ratified §4.5 KEEP list). ③ **`manage/charter` = NOT KEEP** — catalog: `upsert_commission_charter` is staff_admin-only by explicit design (HC0K0), the charter plane never carried a tenancy arm. ④ **`manage/acreditacao/**` stays membership-gated** — catalog: no accreditation-plane policy carries a tenancy arm (`evidence_links`/`standard_assessments`/commission-owned frameworks are all `is_member_of`); pre-fix visibility was the coercion showing an empty shell, not access. ⑤ **staff-member-who-is-also-tenancy-admin gets configuration nav** (nav mirrors the `canConfigureCommission` seam). ⑥ **Dual-hat quality_reviewer+tenancy-admin keeps reviewer-shell precedence** — latent (no persona holds both), recorded for the PO rather than re-ruled mid-phase. ⑦ `setTemplateCaseType` NOT routed to the config seam — its DB door is staff_admin-only (ADR 0088); Q2-consistency would be a DB wave, PO's call. | [BUG-QOB-003](#bug-log) · B.11/B.12 |
| 2026-08-08 | **QO·B content-wall classification RATIFIED (PO, Q1–Q9)** — **KEEP as configuration:** form definitions, `process_template_*`, committee taxonomy + meeting settings (*"the admin shapes the containers, never reads what goes in them"*). **SPLIT:** indicator DEFINITIONS keep, MEASUREMENTS cut. **hospital_admin gets the SAME wall** as org_admin (identical measured reach; walling only org_admin leaves a documented bypass). **Case-ACCESS doors KEEP** (A4 scope ruling + self-escalation independently blocked — an org_admin holds no membership row so its self-grant raises *"o responsável deve ser membro da comissão"*). **Classification doors KEEP** (`set_case_visibility`/`set_case_confidentiality` — mirrors `set_commission_oversight`); **`dispose_case_phi` CUT** (a principal with zero PHI bits does not destroy Rule 12 data — D5). **Both live defects filed as bugs AND fixed** (BUG-QOB-001/002). **`is_commission_admin_of` → `is_tenancy_admin_of` rename APPROVED but DEFERRED to its own wave AFTER QO·B**, so it cannot confound the equivalence matrix. | [0100](docs/decisions/0100-quality-office-oversight.md) D12 · [inventory §6](docs/plans/quality-office-oversight-phase-b-inventory.md) |
| 2026-08-08 | **`revoke_printed_document` KEEPS the tenancy arm — the older ruling overrules the newer draft.** QO·B's §4.3 draft listed it CUT; **ADR 0104 D11** (QA MINOR-2, lead-ruled) already held revocation a **governance** act that reveals no content — the admin chain may revoke an ata print it cannot download. Per-door judgement beat the list. Pinned by a migration postcondition, keystone `314` 8.5, and mutation case `overcut_revoke_ruling`, so a future "finish the printed-doc wall" sweep reds instead of silently reversing a decision it never read. | [0104](docs/decisions/0104-pdf-document-printing-module.md) D11 |
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

_Full bodies of OPEN items rotated 2026-08-08 → **[follow-ups.md](docs/progress/follow-ups.md)** — update BOTH (the body there, the line here) when an item changes state. Resolved items → [follow-ups-archive.md](docs/progress/follow-ups-archive.md). One line per item: severity · id · title · owner._

- 🔴 **FUP-AFF-1** — the authz census is BLIND to write-path doors (ADR 0079 Amendment 5; AFF gate records must cite `302`'s keystones, not `ARM=census`) — backend/harness
- 🔴 **FUP-PCITV-1** — PCI + TV: what QA APPROVED over, ranked (open: `TRUNCATE` revoke residue · audit-mesh 2/7 arms · unexercised org-admin disjunct · resolver/GUC semantics · 10 bare `for select` policies · embed-sweep needs a `package.json` entry) — unassigned
- 🔴 **FUP-ETH-1** — NOTHING can seat a professional: "Médico denunciado" is an unfillable panel (two `participants`-lane writers missing, 7 stub actions, no roster UI) — backend, contract-first
- 🔴 **FUP-FF5-1** — patient-lane sublabel is degenerate on the READ path (PO DEFERRED 2026-07-28; resolve before the lane reaches a real committee) — backend
- 🟡 FUP-PDF-2 — SQLSTATE allowlist can surface English Postgres text (QA P1 MINOR-1; latent) — backend
- 🟡 FUP-PDF-3 — mint/revoke `returns printed_documents` re-exposes withheld columns (QA P1 MINOR-2; the token is the real widening) — backend
- 🟡 FUP-PDF-4 — verification rate limiter is global + in-process (QA P1 MINOR-3) — backend
- ⬛ **FUP-QOB-1 — CLOSED 2026-08-09: J1c RATIFIED by the PO as the standing guard.** The `270` §J
  catalog pin (policy existence + `created_by = auth.uid()` in BOTH qual/with_check, red-proven via
  b1 `fup_qob1_drop_created_by`) is now the permanent answer. Accepted *because* the behavioural
  surface collapsed rather than weakened — post-M1 no reader-non-writer principal exists to probe
  with, and both alternatives are worse (an invented persona measures the invented grant; retiring
  J1b+J1c leaves the term unguarded). J1b stays annotated-not-deleted. → [body](docs/progress/follow-ups.md)
- 🟡 **FUP-QOB-2 — MOSTLY DISCHARGED 2026-08-09** (worked with the PO item by item, each against a live-catalog measurement). **Ratified:** ① fix shape · ② audit KEEP · ④ acreditação membership-gated · FUP-QOB-1's J1c pin. **Ruled:** BUG-QOB-004 = CUT-the-arms (executed, `20260917000000`); `setTemplateCaseType` Q2-consistency approved; `is_tenancy_admin_of` rename re-confirmed + sequenced last. **Now resolved:** ③ `manage/charter` **RULED NOT-KEEP** 2026-08-09 + the oversight need served by a read-only cadence column on the registry (`20260917000300`) · ⑤ dual-hat precedence **SUPERSEDED** — ⛔ the recorded ruling was **FALSE**: it claimed reviewer-shell precedence, but `src/app/page.tsx` branches `orgAdminOf` at line 64 and `qualityReviewerOf` at line 152, so **tenancy wins** and the console is reachable only by URL (its sidebar entry is gated to the COMMITTEE-MEMBER shell). Being replaced by an explicit **"act as" role picker** (PO 2026-08-09; design interview first, ADR pending) — a precedence chain guesses, a picker asks, and DERIVED entries kill the ADR-0101 dead-end class structurally. → [body](docs/progress/follow-ups.md) — PO
- 🔴 **FUP-QOB-3 — `dispose_event_phi` is now the ONLY Rule-12 disposal door still granting a bare tenancy admin** (found 2026-08-09 by the sibling-coherence check run right after the BUG-QOB-004 cut, *not* by anything in that ruling's scope). D5's ratified reasoning — "a principal with zero PHI bits does not destroy Rule 12 data" — applies to patient-safety identically to case + referral, so two of the three PHI modules now deny the tenancy tier and one still grants it, purely because of ruling order. Tell: it still carries the same pt-BR message `dispose_referral_phi` had to shed. **Deliberately not acted on** — outside the ruling, and removing a live capability unasked is the standing trap in the other direction. `dispose_meeting_minutes` is a *separate* question (not a PHI module, probably a genuine KEEP) — do not sweep it in reflexively. → [body](docs/progress/follow-ups.md) — PO, then backend
- 🟡 FUP-QO-9 — the e2e:prod gate's infra classifier misses two PGRST002 shapes — backend / `scripts/e2e-prod-gate.sh`
- 🟡 FUP-AFF-3 — pin door ACLs by DERIVING the door set from `pg_proc`, not by remembering it — backend
- 🟡 FUP-AFF-4 — make the membership-role list a Postgres ENUM (decide before the role set next changes) — backend
- 🟡 FUP-AFF-2 — D7's foreign-professional (no-CPF) escape is unreachable; decide before the pilot onboards clinical staff — product + backend
- 🟡 FUP-P16-4 — 10 files carry the `+ "s"` pluralization pattern that shipped two bugs (latent, safe today) — frontend
- 🟡 FUP-P16-2 — two accreditation reads live in `actions.ts`, not `queries/` (Rule 9) — backend
- 🟢 FUP-QO-6 — oversight-toggle slow-confirm: annoyance severity ACCEPTED provisionally (PO 2026-08-07); LOW, DB-vs-UI formally unclassified — tester
- ▶ FUP-MIN-CUTOVER — audio-minutes pre-enable gates (open: storage cap ⛔ BLOCKED on a Pro-plan decision · T5 smoke run · R2 different-hardware look · deploy env vars) — lead + human
- ▶ FUP-FF5-2 — §O pins the door's behaviour, not the closure of the `participants` writer set (assert count AND name; `\y` not `\b`) — backend
- ▶ FUP-E2E-1 — RE-BASELINE `e2e:prod`: a named failure list, not a count (PO-ruled 2026-07-27; blocks nothing) — tester
- ▶ FUP-FF2-3 — whitespace-only observation filtered top-level but not per instance (deferred; legacy rows only) — backend
- ▶ FUP-FF1-2 — FF-1 QA non-blocking items: 4 MINOR / 3 INFO still open — backend
- ▶ FUP-FF1-1 — coherent fill-path hardening: decide DEFINER + per-mutation audit for the fill-path set as one change (post-pilot; ADR 0087 ruling 5) — backend
- ▶ AUTHZ Gate-2 MINOR-1 — reserved-session door returns the respondent's own `case_id` (the A7-vs-A26 call; fold at pilot close) — backend
- ▶ ETH E1→E2 inheritance — GAP-E1-1/2/3 + MINOR-A/B + participant-roles M2M, all PO-routed to E2 (2026-07-14) — backend + frontend

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
