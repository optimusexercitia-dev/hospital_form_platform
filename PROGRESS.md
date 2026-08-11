# PROGRESS.md — Project Status Tracker

> Single source of truth for project status. Update IMMEDIATELY when state
> changes. The lead owns the Phase Status table; each teammate owns their own
> rows in the other sections. Never report status that isn't written here.

## Phase Status

<!-- THE INDEX: every phase keeps a row here, forever. What rotates out is verbose cell text, not
     rows — a missing row would break the many places that point here. -->

> Gate **headlines** (pgTAP counts, e2e:prod result, ARM verdicts, QA verdict + review link) stay in
> this table. The **verbose** Build/Tests/QA/Commit text of 11 rows — Phase 16 · ff-program · PCI ·
> AFF · MIN · TV · QO·A · QO·B · PDF·P1 · PDF·P2 · ACT — rotated **2026-08-10** verbatim →
> [phase-status-archive.md](docs/progress/phase-status-archive.md). Each phase's `docs/progress/`
> record remains the authority for how the work was done.

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
| 16 | Standards Crosswalk & Readiness v2 [0093](docs/decisions/0093-phase-16-standards-crosswalk-replan.md) · [record](docs/progress/phase-16-standards-crosswalk.md) | ✅ complete | ✅ | ✅ pgTAP **151f/4623** · e2e:prod 962/962, 0 assertion failures · [gate detail](docs/progress/phase-status-archive.md) | ✅ [APPROVED](docs/reviews/phase-16-review.md) | ✅ 2026-08-04 | 2026-08-04 | `484a254` → `main`, pushed |
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
| ff-program | **Flexible-Forms Program (FF-1…FF-5)** — umbrella; [0086](docs/decisions/0086-flexible-forms-pre-pilot.md) · [program outcome](docs/plans/flexible-forms-program.md) | ✅ **5 of 5 COMPLETE** — closed, no longer gates the pilot | ✅ | ✅ FF-4 pgTAP **4301/4301** · e2e:prod 901p, 0 FF-4 defects · [gate detail](docs/progress/phase-status-archive.md) | ✅ [APPROVED](docs/reviews/phase-FF-4-review.md) | ✅ 2026-08-03 | 2026-08-03 | FF-4 `4df14d7`…`aa77b0d` (13 commits) |
| **ETH·E1** | **Ethics Access Spine [0072](docs/decisions/0072-ethics-access-spine.md) | ✅ complete | ✅ Vitest 369/369 | ✅ pgTAP 91f/2537 · E2E 13/13+1 skip · e2e:prod triaged | ✅ APPROVED (R3) [review](docs/reviews/phase-ETH-E1-review.md) | ✅ 2026-07-14 | 2026-07-14 | 14 commits `167b269`…`02bd2db` (remote deferred) |
| **ETH·E2** | **Ethics disciplinary procedure** [0073](docs/decisions/0073-ethics-procedure-model.md) | ✅ complete | ✅ | ✅ E2E 20/20 · pgTAP `253`–`259` | ✅ APPROVED [review](docs/reviews/eth-e2-review.md) | ✅ 2026-07-18 | 2026-07-18 | `ada4c97`…`2adb169` |
| **ETH·E3a** | **Ethics terminology/UX surfacing** [0072](docs/decisions/0072-ethics-access-spine.md) | ✅ complete | ✅ | ✅ E2E 21/21 · pgTAP `266`–`269`/3852 | ✅ APPROVED r2 [review](docs/reviews/phase-E3a-review.md) | ✅ 2026-07-27 | 2026-07-27 | `e61fa3c`…`38db4c9` |
| **AUTHZ** | ADR 0078 Gate 1 | ✅ complete | ✅ | ✅ pgTAP 2981 · e2e 0-regress | ✅ APPROVED [review](docs/reviews/authz-b-series-review.md) | ✅ 2026-07-16 | 2026-07-16 | `87858f7` (local) |
| **AUTHZ · Gate 2** | ADR 0078 Gate 2 | ✅ complete | ✅ | ✅ pgTAP 772/772 authz · e2e green | ✅ APPROVED (re-review) | ✅ 2026-07-17 | 2026-07-17 | `f07341f` |
| **case-corrections** | **Case Correction Lifecycle** [0085](docs/decisions/0085-case-correction-lifecycle.md) | ✅ complete | ✅ | ✅ tester 24/24 + full prod E2E feat 7/7 (reds triaged infra/baseline; T-2 clean-stack 76/76) | ✅ APPROVED (0P0/0MAJ/2min) [review](docs/reviews/case-corrections-review.md) | ✅ 2026-07-24 | 2026-07-24 | `6b50abc` → main+origin; **remote `db push` ✅ (flag ON, backfill verified live)** |
| **case-custom-fields** | **Case Custom Fields** [0083](docs/decisions/0083-case-custom-fields.md) | ✅ complete | ✅ lint/tsc/vitest 369 | ✅ E2E 8/8 (3× clean) · pgTAP `188` 28/28 · full `e2e:prod` 735p (feat 8/8 on prod build) | ✅ APPROVED (0 P0 · 0 MAJOR · 1 MINOR cleared · 2 INFO) [review](docs/reviews/adr-0083-case-custom-fields-review.md) | ⚠ **unrecorded** — see detail | 2026-07-23 | merge `c857193` · flag ON `fde76d3` |
| **bulk-case-create** | **Bulk Case Creation ("Múltiplos casos")** [0084](docs/decisions/0084-bulk-case-creation.md) | ✅ complete | ✅ build/tsc/lint/vitest 390 | ✅ E2E 8/8 prod-standalone · pgTAP 29/29 | ✅ APPROVED (4 MINOR/OBSERVATION, none blocking; fixed `b948c9f`) [review](docs/reviews/bulk-case-creation-review.md) | ⚠ **unrecorded** — see detail | 2026-07-23 | flag ON `255a8e9` |
| **AUDIT-DOOR-BLINDNESS · P0** | ADR 0078 §7.14 | ✅ complete | ✅ | ✅ 50 KS mut-proven · pgTAP 3288 · invariant HOLDS | ✅ APPROVED [review](docs/reviews/authz-door-audit-p0-review.md) | ✅ 2026-07-18 | 2026-07-18 | ff→main |
| **PCI** | **Process/Case integrity audit remediation** [0095](docs/decisions/0095-process-case-integrity-audit-remediation.md) · [audit](docs/reviews/process-case-integrity-audit.md) · [detail](docs/progress/process-case-integrity-and-template-versioning.md) | ✅ complete | ✅ | ✅ all gates green — full record → [detail](docs/progress/process-case-integrity-and-template-versioning.md) | ✅ APPROVED r2 [review](docs/reviews/process-integrity-and-template-versioning-review.md) | ✅ 2026-08-05 | 2026-08-05 | `44cd9bb`…`f6c847d` → ff `main` |
| **AFF** | **Hospital affiliation, person identity & the org people directory** [0097](docs/decisions/0097-hospital-affiliation-person-identity.md) · [record](docs/progress/hospital-affiliation-person-identity.md) | ✅ complete | ✅ | ✅ all gates green → [record](docs/progress/hospital-affiliation-person-identity.md). ⚠ never cite `ARM=census` for AFF's write-path doors (FUP-AFF-1) | ✅ APPROVED [review](docs/reviews/aff-review.md) | ✅ 2026-08-06 | 2026-08-06 | `main` ff + `origin` at `cc66483` |
| **MIN** | **Meeting audio → generated ata** [0099](docs/decisions/0099-meeting-audio-minutes.md) (+Amdt 1) · [record](docs/progress/min-audio-minutes.md) — flag `audio_minutes` **OFF** at ship | ✅ **complete** | ✅ | ✅ pgTAP **166f/5181** · MIN spec 10/10 ×4 · e2e:prod ×2 GREEN · [gate detail](docs/progress/phase-status-archive.md) | ✅ **APPROVED (r2)** [review](docs/reviews/min-audio-minutes-review.md) — 3 MINOR open (R1–R3) | ✅ 2026-08-06 | 2026-08-06 | branch `feat/meeting-minutes` |
| **TV** | **Process-Template Versioning** [0096](docs/decisions/0096-process-template-versioning.md) (+ Amdts 1.1–1.7) — PO-directed full remodel · [detail](docs/progress/process-case-integrity-and-template-versioning.md) | ✅ complete | ✅ | ✅ all gates green — full record → [detail](docs/progress/process-case-integrity-and-template-versioning.md) | ✅ APPROVED r2 [review](docs/reviews/process-integrity-and-template-versioning-review.md) | ✅ 2026-08-05 | 2026-08-05 | `6b9314c`…`f6c847d` → ff `main` |
| **QO·A** | **Quality-office oversight — Phase A** (classification + `quality_reviewer` + UI) [0100](docs/decisions/0100-quality-office-oversight.md) · [record](docs/progress/quality-office-oversight.md) | ✅ **complete** | ✅ | ✅ pgTAP **172f/5355** · `q1` 20/20 RED-proven · census+floor HOLD · [gate detail](docs/progress/phase-status-archive.md) | ✅ **APPROVED (r3)** [review](docs/reviews/quality-office-oversight-review.md) — r1 ⛔ / r2 ⛔ / r3 ✅ | ✅ 2026-08-07 | 2026-08-07 | branch `feat/quality-office-oversight` → `main` |
| **QO·B** | **Quality-office oversight — Phase B** (content wall + BUG-QOB-003 close-out) [0100](docs/decisions/0100-quality-office-oversight.md) D12 · [record](docs/progress/quality-office-oversight-phase-b.md) | ⬛ **complete** | ✅ | ✅ pgTAP **175f/5616** · `b1` 39/39 RED-PROVEN · sweeps 0 BLIND · e2e:prod GATE GREEN 1046/0 · [gate detail](docs/progress/phase-status-archive.md) | ✅ **APPROVED (r2)** [review](docs/reviews/phase-QO-B-review.md) — r1 ⛔ (M4 cut a PROXY) → M7 → r2 ✅ | ✅ 2026-08-09 | 2026-08-09 | 7 migrations; closes BUG-QOB-001/002/003. Open: **BUG-QOB-004** · **FUP-QOB-1/2**. ⛔ Method lesson (a CUT by enumeration diverged from the ratified list **twice**) → [record](docs/progress/quality-office-oversight-phase-b.md) |
| **PDF·P1** | **PDF document printing — Forms + full skeleton** [0104](docs/decisions/0104-pdf-document-printing-module.md) (+A1–A6) · [record](docs/progress/pdf-p1-forms-skeleton.md) | ✅ **complete** | ✅ | ✅ pgTAP `312` **73/73** (full 173f/5444+) · 7 drills RED-proven · `ARM=policy` 3/3 COVERED 0 BLIND · e2e:prod GATE GREEN 0 real failures/1026 · [gate detail](docs/progress/phase-status-archive.md) | ✅ **APPROVED (r2)** [review](docs/reviews/phase-PDF-P1-review.md) — 3 MINORs deferred (FUP-PDF-2..4) | ✅ 2026-08-08 | 2026-08-08 | `worktree-pdf-printing-p1` → `main`; remote `db push` ✅ 2026-08-08 |
| **PDF·P2** | **PDF printing — Meetings (ata)** [0104](docs/decisions/0104-pdf-document-printing-module.md) **+A7/A8/A9** (PO Package A) · [record](docs/progress/pdf-p2-meetings.md) | ✅ **complete** | ✅ | ✅ pgTAP `312`+`313` **128/128** (full 174f/5502) · drills RED-proven · sweeps COVERED 0 BLIND · e2e:prod GREEN 0 real failures/1030 · [gate detail](docs/progress/phase-status-archive.md) | ✅ **APPROVED (r2)** [review](docs/reviews/phase-PDF-P2-review.md) — ⛔ r1 (per-caller-masking leak + PHI labeling) → Package A → r2 | ✅ 2026-08-08 | 2026-08-08 | `feat/pdf-p2-meetings` → `main`, pushed 2026-08-10; remote `db push` ✅ 2026-08-10 |
| **ACT** | **"Act as" strict role assumption** [0106](docs/decisions/0106-act-as-role-assumption.md) · [0107](docs/decisions/0107-act-s4-hat-blind-sweep-and-allowlist.md) (S4) · [record](docs/progress/act-as-role-assumption.md) — **no feature flag: the migration IS the cutover** | ✅ **complete (S0–S4)** | ✅ Vitest **1218** · `next build` · 345 registered == 345 files (re-run on each merged tree) | ✅ pgTAP **180f/5707** · e2e:prod **GATE GREEN** 1057/0 · `ARM=census`+`floor`+**`hat`** all HOLD · [gate detail](docs/progress/phase-status-archive.md) | ✅ **APPROVED** — S0–S3 (r2) · S4 (r1) [review](docs/reviews/act-as-stage-4-review.md) | ✅ 2026-08-10 | 2026-08-10 | merges `ff0e76a`+`ac4a270` → `main`, pushed (`origin/main` = `f3981a5`). ✅ remote `db push` + Cloud auth hook enabled — **the remote is cut over** |

> ⚠ PCI/TV shipped with two gate caveats — the un-runnable `ARM=census` (**DISCHARGED 2026-08-05**: the arm landed with the membership-hardening merge and was run against the merged catalog; residue in FUP-PCITV-1 row 1) and the VOID TV-backfill premise (⚠ its mechanism recurs: a backfill is invisible to `db reset` forever — a green reset is *no* evidence). Full caveat text + verbatim gate rows rotated 2026-08-08 → [process-case-integrity-and-template-versioning.md](docs/progress/process-case-integrity-and-template-versioning.md).

## Current Phase Tasks

<!-- Lead recreates this table at the start of each phase. At the §6 Record step the
     completed phase's task detail is archived to docs/progress/phase-N.md (or a
     feature-named file) and replaced here by a one-line pointer (CLAUDE.md §7). -->

**No phase is in flight.** ACT (S0–S4) and PDF·P2 closed and rotated 2026-08-10; the head of the
table below is the last completed work, and what is actually left before the pilot is
§ *Remaining pre-pilot work*.

### ⬛ Recently completed — rotated 2026-08-10; detail in `docs/progress/`

One line each. Gate numbers live in the **Phase Status** table above; the linked record carries the
task table, findings and narrative. "Still open" points at the live sections further down this file.

| Work | Done | Record | Still open (none blocking, tracked below) |
| --- | --- | --- | --- |
| **ACT** — "act as" strict role assumption, **S0–S4** (hat bound to the auth session via the `active_role` JWT claim; **unflagged — the migration IS the cutover**; S4 = D14 arm audit + the standing `ARM=hat` sweep + the reasoned hat-blind allowlist) · QA APPROVED (S0–S3 r2 · S4 r1) · human-approved | 2026-08-10 | [act-as-role-assumption.md](docs/progress/act-as-role-assumption.md) (incl. § S4 and § *Merge, push & the two deploy debts*) · ADRs [0106](docs/decisions/0106-act-as-role-assumption.md)/[0107](docs/decisions/0107-act-s4-hat-blind-sweep-and-allowlist.md) · [review](docs/reviews/act-as-stage-4-review.md) · [authz-handoff §7.17](docs/progress/authz-handoff.md) · `docs/backend-state.md` (ACT) | ✅ **Both deploy debts DISCHARGED 2026-08-10** — remote `db push` done and `custom_access_token_hook` **enabled on Supabase Cloud** (user-confirmed working; catalog-verified). The remote is cut over. **FUP-ACT-DISPOSE-UI** = pilot-gate check, item **0** · FUP-ACT-CAPA-ASSIGN · FUP-ACT-HATLESS-AUDIT (the A13 consequence) — all in Follow-ups |
| **PDF·P2** — PDF printing: Meetings (ata); the A7 full-sight conjunction + A8 presence-derived PHI labeling came out of QA's r1 BLOCKER → the PO "Package A" ruling · QA APPROVED (r2) | 2026-08-08 | [pdf-p2-meetings.md](docs/progress/pdf-p2-meetings.md) (its § *PDF-program item status* carries the per-item checklist) · ADR [0104](docs/decisions/0104-pdf-document-printing-module.md) **A7/A8/A9** · [review](docs/reviews/phase-PDF-P2-review.md) | FUP-PDF-2..4 (Follow-ups) · `git push` **and** remote `db push` both ✅ done 2026-08-10 (catalogs match on the meeting arm) — **Gotenberg is up and `document_printing` is ON permanently** (PO 2026-08-10 — supersedes ADR 0104's ships-OFF clause). Scope question **HELD**: kind-sites = exactly 3, the A8 trio — a 4th = leak |
| **QO·B** — Quality-office oversight, Phase B (content wall + UI coherence) · QA APPROVED (r2) | 2026-08-09 | [quality-office-oversight-phase-b.md](docs/progress/quality-office-oversight-phase-b.md) · ADR [0100](docs/decisions/0100-quality-office-oversight.md) D12 · [review](docs/reviews/phase-QO-B-review.md) | **BUG-QOB-004** (Bug Log) · **FUP-QOB-1 + FUP-QOB-2** (Follow-ups — the PO ratification package, parked for a future session) |
| **PDF·P1** — PDF printing: Forms + full skeleton · QA APPROVED (r2) | 2026-08-08 | [pdf-p1-forms-skeleton.md](docs/progress/pdf-p1-forms-skeleton.md) · ADR [0104](docs/decisions/0104-pdf-document-printing-module.md) A1–A6 | FUP-PDF-2..4 (Follow-ups); whole-program deploy prereqs + per-item push status → the **PDF·P2** row above and its record's § *PDF-program item status* |
| **QO·FUP** — FUP-QO close-out (F1–F9) · QA APPROVED (r2) | 2026-08-07 | [qo-fup-close-out.md](docs/progress/qo-fup-close-out.md) · ADRs 0101/0102/0103 | FUP-QO-6 (accepted-provisional, LOW) · FUP-QO-9 |
| **QO·A** — Quality-office oversight, Phase A · QA APPROVED (r3) | 2026-08-07 | [quality-office-oversight.md](docs/progress/quality-office-oversight.md) · ADR [0100](docs/decisions/0100-quality-office-oversight.md) | FUP-QO-1…6. ⚠ Phases **B** (org_admin content wall) and **C** (lifecycle + break-glass) are **not started**; **read the record's closing rule before B** — *conferring a capability bit requires enumerating its consumers* |
| **MIN** — Meeting audio → generated ata; flag `audio_minutes` ships **OFF** (`seed.sql` forces ON for local/E2E, so a flag-OFF spec must toggle it itself) · QA APPROVED (r2) | 2026-08-06 | [min-audio-minutes.md](docs/progress/min-audio-minutes.md) | FUP-MIN-CUTOVER (the pre-enable gates) |
| **AFF** — Hospital affiliation, person identity & the org people directory · QA APPROVED (r2), PO-approved | 2026-08-06 | [hospital-affiliation-person-identity.md](docs/progress/hospital-affiliation-person-identity.md) · ADRs [0097](docs/decisions/0097-hospital-affiliation-person-identity.md)/[0098](docs/decisions/0098-aff-w1-substrate-shape-decisions.md) · `docs/backend-state.md` (AFF) | FUP-AFF-1…4 — **FUP-AFF-1 carries the standing trap: never cite `ARM=census` for AFF's doors** · BUG-BOOTSTRAP-001 (Bug Log) · the remote `db push` it made mandatory is ✅ done (2026-08-10) |
| **Membership hardening + Diretor Técnico** (ADR 0094) — W1→W4 merged, DT flag ON (`20260905000600`) | 2026-08-05 | [membership-hardening-technical-director.md](docs/progress/membership-hardening-technical-director.md) | — |
| **Case-type assignment** (ADR 0088) — shipped alongside the above | 2026-08-05 | [case-type-assignment.md](docs/progress/case-type-assignment.md) | — |
| **PCI + TV** — Process/Case Integrity & Template Versioning · QA APPROVED (r2) | 2026-08-05 | [process-case-integrity-and-template-versioning.md](docs/progress/process-case-integrity-and-template-versioning.md) | FUP-PCITV-1 |

### 📋 Remaining pre-pilot work

Scope was set by ADR [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md) (12 initiatives)
and re-expanded by ADR [0086](docs/decisions/0086-flexible-forms-pre-pilot.md) (FF-1…FF-5); ADR
[0093](docs/decisions/0093-phase-16-standards-crosswalk-replan.md) re-gated Phase 16 in front of the
pilot, and ADR [0097](docs/decisions/0097-hospital-affiliation-person-identity.md) (AFF) re-gated it
again on 2026-08-05. **All of those are complete**, as are AFF, the ACT cutover and both pushes
(removed from this list 2026-08-10 — the Phase Status table is their index, and the *Recently
completed* table carries the pointers). Completed items are not re-listed here. What is actually left:

**0. 🔴 PILOT-GATE CHECK — the LGPD Art. 18 referral-erasure path must have a working UI route
(FUP-ACT-DISPOSE-UI).** Placed here, as a **gate check rather than a follow-up-list entry**, on the
Stage-3 QA reviewer's explicit recommendation — *"this program's own record shows 'standing in prose
alone' once meant a thing ran once in three weeks"* (the same failure ADR 0079 was written about).
**The check, stated so it can be run and can fail:** name a persona who can (a) reach the surface
hosting the dispose affordance AND (b) pass `dispose_referral_phi`'s own gate. Today **no such
persona exists** — the two sets are disjoint (catalog-verified; full mechanism in the
`FUP-ACT-DISPOSE-UI` body → [follow-ups.md](docs/progress/follow-ups.md)). Until one does,
subject-erasure is API-only. **Decision owner: PO** —
*where* the affordance mounts is a product call (NSP surface reaches operators; manage-tier reaches
tenancy admins); *whether* it must work before pilot is not. ⚠ Precedent that makes this
non-negotiable: migration `20260917000400` restored this door's tenancy-admin arm specifically to
un-strand this same obligation after QO·B cut it — the platform has already ruled once.

**1. 🟠 The Coolify app deploy** — the last step of the pilot deploy; **both code halves are done**
(`git push` + the remote database, 2026-08-10 — AFF, ACT, QO·B, PDF·P1/P2 all live; catalog-verified
345 == 345, and the `custom_access_token_hook` is enabled, so the ACT cutover is real on the remote).
Deploying the app is **when the ETH·E1 m2 flag flip reaches production**.
✅ **PDF printing is no longer a blocker on this row.** The **Gotenberg Coolify resource is active
and working** (PO, 2026-08-10; runbook [pdf-renderer.md](docs/deployment/pdf-renderer.md)), and
**`document_printing` is ruled ON PERMANENTLY** — see the Decisions row. The flag reads
`enabled = true` on the remote today, which now matches the intended posture instead of contradicting
it. ⚠ ADR 0104's "ships **OFF**" clause is **superseded** for prod, and P3/P4 must not re-assert it.
⚠ The 2026-08-10 remote refresh applied `seed.sql`, which reseeded the remote with the **36
`@test.local` personas** (0 real users) — fine pre-pilot, and it matches the deliberate 2026-07-12
pilot reset, but it must not recur once real users exist. *(That refresh is also what set both flags
ON, `seed.sql:2363`/`2373`; for `document_printing` the ruling has since made that the correct
state — `audio_minutes` is a separate question, still governed by FUP-MIN-CUTOVER.)*
Re-verify live before acting on this row — it has been stale in both directions before.

**2. 🔴 AUDIT-INVOKER-WRAPPER — a structural blind spot in the ADR
[0079](docs/decisions/0079-authz-door-blindness-standing-invariant.md) standing sweep.** Found in FF-3
(QA M-2); **not an FF-3 defect and not a known leak** — PO decision on scheduling. The sweep floors
`prosecdef = t` **public** doors. The shape it cannot see is an **INVOKER wrapper whose own hand-written
RLS probe is the only gate in front of a DEFINER body** — a `prosecdef = f` function whose security rests
entirely on an `if not exists (…)`. FF-3's `get_response_validation_errors` is one instance: deleting its
existence probe reds **0 assertions across six files**, while a commission-Y staff then reads
commission-X rule messages **and item labels** (proven live; keystone `§O` added, mutation-proven).
**It is a pattern, not an accident** — it is the natural way to front an `app.` DEFINER helper, and
**173 of 328 `app` DEFINER functions carry `EXECUTE` to `PUBLIC`** (catalog-measured 2026-08-10;
was 130 of 281 when filed — the population **grows**, so re-measure rather than citing this line),
so the wrapper is the whole boundary each time. Proposed scope: enumerate `public` `prosecdef = f`
functions calling an `app` `prosecdef = t` function, and require a keystone per wrapper that reds
when its guard is removed. Relates to ARCHITECTURE.md Rule 1.

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

> ⚠ **SCOPE NARROWED 2026-08-10 (QA Stage-3 review r2, MINOR-4(1)) — read this before
> working the bug below; its original text now overstates the reach.** After
> `20260918002800` gave the raw arm a caller-only hat condition, the quirk survives **only
> in the cross-org shape**: a principal holding a LIVE `staff_admin` in one org (so the hook
> derives that hat implicitly) **plus** an expired `staff_admin` in the org being asked
> about. An **expired-ONLY** principal can never obtain the `staff_admin` hat at all —
> `assume_role` validates live holding and `custom_access_token_hook` derives only from live
> rows — so for them the arm is already permanently unreachable. That is this bug's own
> tightening arriving early for its **main** population, achieved via the hat rather than via
> expiry, and it narrows in the safe direction (QA: "not asking you to undo it"). Keystone
> `318` assertion 10 pins the surviving cross-org shape against a state a real user can
> actually occupy.

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


🔴 **BUG-BOOTSTRAP-001 — there is no in-app path to create the FIRST `platform_admin`; production
onboarding has an undocumented manual SQL step.** Filed 2026-08-06 (lead) when the AFF completion
narrative was rotated — **this was the one open item in it that existed in no other tracked place**,
which is why it is here rather than in Follow-ups. Surfaced during AFF, **not caused by it**.
**Mechanism:** `is_admin` is set only by direct SQL, and the promote guard requires an **existing**
admin to promote another — so the set is closed under the product. On a fresh production database it
starts empty and nothing in the app can open it. **Impact:** the first production `platform_admin` is
a manual `update profiles set is_admin = true …` that **appears in no runbook** — not in
`docs/deployment/`, not in the pilot-deploy checklist (*Remaining pre-pilot work* item 1). Whoever
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
     ACT, already there). -->

> Live rows = the **ACT** milestone only (2026-08-10). Everything older — the QO·B wave-1…5 gates,
> QO·B, the Next 16.3.0 upgrade gate, both PDF·P2 tester runs, PDF·P1, QO·FUP F6 and the QO·A gates
> — rotated **2026-08-10** → [test-run-archive.md](docs/progress/test-run-archive.md). Prior
> rotation 2026-08-07 (MIN · AFF · MEM · PCI/TV and everything before).

| Date | Run | Result |
| --- | --- | --- |
| 2026-08-10 | **ACT · TESTER · Stage 3 specs + BOTH seed-persona threading follow-ups (cookie + raw-grant), coordinator-directed close-out** — `e2e/act-role-assumption.spec.ts` (9 tests) + `actAs`/hatted-`accessToken` threading across **22** raw-grant files and **15** cookie-based files (37 file-touches total, several needing both) + `phase-multitenancy.spec.ts` decision (deleted, redundant) + `BUG-ACT-NOTFOUND-COPY-1` fixed in 4 places. **NOT a full-suite run** (out of scope — the lead runs `e2e:prod`) | **`act-role-assumption.spec.ts`: 9/9 GREEN**, re-verified on a SECOND fresh reset after backend's own concurrent migrations landed (`…002400`, `…002500`). **Every touched file individually re-verified live** (not sampled) on the final fresh reset: `phase-multitenancy.spec.ts` 29/30 (1 deliberate red → now DELETED, see below) · `phase14a-safety-events` 15/16 (1 unrelated pre-existing keyboard-focus flake, matches the documented `.focus()`-not-auto-waiting class) · `phase14b-triage` 13/13 · `phase14c-rca` 17/17 · `phase14d-capa` 19/19 · `ethics-e2-procedure` 20/20 (incl. FLOW-7, the dynamic-role-per-voter fix) · `phase16-accreditation-clone` 4/4 · `phase16-accreditation-hospital` 6/6 · `phase13-audit` 26/27 (1 genuine NEW finding, not a regression — see Bug Log) · plus `mem-memberships-collapse`, `patient-index` (7/7 across its 4 sites), `phi-remediation`, `charters-cadence` (3/3), `ff3-validations` all green. lint 0/0 across `e2e/` · `tsc --noEmit` clean — both re-run after every edit batch, final time on the clean-reset tree. **`phase-multitenancy.spec.ts` decision (coordinator's item 2): DELETED**, not re-based — its own comment already named the coverage redundant ("lands on the /c picker, exactly like multi@ below"); the intent (multi-commission + single-role-type → grouped `/c` picker) is fully covered by the adjacent `multi@` test in the same file (now verified true for her post-cutover) and by this file's own D2 negative spec. **Raw-grant denominator, re-derived by property per the coordinator's instruction: 58 files perform a raw grant; 22 intersect a multi-role persona** (19 by literal string, +3 only reachable by tracing transitive imports/dynamic queries — full breakdown in the Bug Log). Caught and self-corrected one real gap in the tester's own first pass (`phase14c-rca`/`phase14d-capa`, 26 sites, initially miscategorized "comment-only") before declaring done. ⛔ **Three bugs found and reported beyond the originally-assigned 7 specs, all live-reproduced against the real catalog/DB, not inferred:** BUG-ACT-PICKER-SEED-1 and BUG-ACT-GUARD-HATBLIND-1 (P0, RESOLVED same-session by backend) from the first pass; BUG-ACT-RAWGRANT-HATLESS-1 (RESOLVED this session) plus 2 genuinely NEW findings surfaced while verifying it (`phase22-referrals.spec.ts` Flow 3d — same OR-gate-conflation shape as AC-5b; `phase13-audit.spec.ts` AC-3f-platform — `assume_role`'s own audit rows now populate a bucket a pre-existing test assumed was permanently empty) — both left RED with the finding documented in-line, not forced. Full detail, all bug rows: PROGRESS.md Bug Log. |
| 2026-08-10 | **ACT · TESTER · union-tests re-scope (PO ruling) + BUG-CAPA-AUDIT-SCOPE-1 filed — coordinator-directed close-out, part 2** — rewrote `phase15-indicators.spec.ts` AC-5b and `phase22-referrals.spec.ts` Flow 3d per the PO's "accept both losses" ruling (each half asserted under its own correct hat + a new assertion proving the specific combined-session flow is gone, not merely deleted); corrected AC-5b's inherited-and-wrong `open_capa_plan` gate-shape comment (verified live: no `is_tenancy_admin_of` arm for `p_source='indicator'`, two sequential gates not one OR); filed `BUG-CAPA-AUDIT-SCOPE-1` (mechanism backend-traced, tester-independently-verified live against `pg_get_functiondef`+`audit_log`, NOT fixed per explicit instruction) | **AC-5b: 2/2** (`-g "AC-5b|AC-6"`) — UI half (`org_admin`) unchanged-passing, RPC half now correctly `pqs_member`-hatted and passing, new `pqs_member`-404s-the-page assertion passing. **Flow 3d: 1/1** (`-g "Flow 3d"`) — `staff` sees status + the PHI result positively withheld (not merely absent), new `pqs_member`-404s-the-route assertion passing. Both chromium, `--workers=1`, re-verified after rewrite. lint 0/0, `tsc --noEmit` clean. ⛔ **Re-running the two touched files whole (not just `-g`-scoped) surfaced 3 more reds, NONE fixed this round, respecting the coordinator's "then stop":** `phase15-indicators.spec.ts` AC-8a/AC-8b — same already-known `BUG-ACT-NOTFOUND-COPY-1` shape, trivial same-pattern fix, left alone. `phase22-referrals.spec.ts` Flow 5a — a THIRD, previously-undetected instance of the identical two-gate shape the PO just ruled on, pre-existing (traced to the tester's own earlier commit `a8da28d` via `git log -p`, not caused by today's Flow 3d rewrite), reasoned from facts already verified live this session (no new experiment run), and compounded by a silent vacuous-pass fallback in the test's own `else` branch — meaning the tester's earlier "3 passed" report for this exact test in the BUG-ACT-RAWGRANT-HATLESS-1 close-out was almost certainly non-probative, corrected here rather than left standing. Not extended to match the PO's ruling unilaterally; flagged in the Bug Log for an explicit decision, mechanism fully pre-verified so a fix (if directed) is a same-shape rewrite, not a new investigation. |
| 2026-08-10 | **ACT · TESTER · BUG-ACT-NOTFOUND-COPY-1 full population — coordinator-directed after full `e2e:prod` RED (38 real + 4 infra)** — enumerated the true population (**81 occurrences / 36 files**, matching the coordinator's own count exactly, re-derived independently via `grep -i`), classified every failing site's denial independently of copy (live diagnostic across the 14 QO·B `CUT_ROUTES` + per-site error-context snapshots for the org-tier/ambiguous cases — HTTP-status wasn't usable for most routes, streamed-notFound), fixed 33 of 36 files to the shared `/não encontr/i` stem, left 3 correctly untouched (2 comment-only, 1 already a 3-way OR covering both copies) | **NO P0 — denial held everywhere checked, confirmed via each real boundary's own distinctive body text + recovery link, not generic 404 phrasing.** All 33 touched files run to green across 6 batches + 2 targeted isolated re-runs (`phase22-referrals` 40/40, `quality-oversight` 19/21 solo — the 2 remaining are the new BUG-QO-OVERSIGHT-DOOR-1, unrelated); both files' batch-run failures were cross-file fixture contamination from `perf-sweep-wave2.spec.ts`'s 26+-row fixtures, not regressions, confirmed by isolation. lint 0/0, `tsc --noEmit` clean. ⛔ **A blanket "manage/\*\* = new boundary" rule would have been wrong**: `/o/rede-a/manage/acreditacao` (flag-off denial) and `/o/rede-a/manage/usuarios/[id]` (cross-hospital denial) hit the NEW org-tier boundary, but `/o/rede-a/manage/administradores` (role denial, same persona) and the SAME acreditacao route under a cross-org denial both still show the OLD global copy — which boundary fires depends on WHERE in the render tree the specific denial reason is checked, not the URL prefix; verified per site, never inferred. Also diagnosed (not fixed): `nsp-per-hospital.spec.ts`'s own `expectAccessDenied` helper does a single un-retried `textContent()` read with no wait for the streamed body, a genuine reliability defect that produced a misleading false-pass on first read. **6 non-copy findings surfaced and flagged, none fixed** (full detail + exact mechanism/error text: Bug Log) — 2 already known from the prior round (`qob-org-admin-content-wall.spec.ts` missing nav link; `charters-cadence.spec.ts` AC-5 `acting_as`-in-audit-metadata, possibly recurring in `ethics-e1-access-spine.spec.ts` AC-3b, not confirmed); 4 new (`nsp-per-hospital.spec.ts` missing `actAs` on `admin@` — same class as the closed BUG-ACT-RAWGRANT-HATLESS-1; `nsp-per-hospital.spec.ts` AC-7/AC-8 dispose-PHI button not found; `case-access.spec.ts` AC-3a + `administrativo.spec.ts` POS-5 unrelated content-visibility failures, the former cascading 20 skipped tests; **BUG-QO-OVERSIGHT-DOOR-1** — `quality-oversight.spec.ts`'s `setOversightViaDoor` helper now gets a real app-level `RAISE` rejection from `set_commission_oversight`, confirmed via 2 clean isolated reproductions). **On the 74 unrun tests**: no access to the gate's own batch partitioning/logs from this session — every file in the 81-site population is independently confirmed green where checked; whether that alone clears the 74 (vs. one of the findings above cutting a batch short elsewhere) is only answerable by the next full `e2e:prod` run. |
| 2026-08-10 | **ACT S1 · `tester` · `actAs` seam + seed-sensitivity sweep** (plan §4 Stage 1) — landed the harness seam in `e2e/helpers/auth.ts`: `loginFresh` gains `_actAs?: string` (doc'd no-op, ADR 0106-referenced — Stage 3's ONE edit site, dropping the underscore); `cachedSignIn` gains `actAs?: string`, threaded through to `loginFresh` AND partitioning the session-cookie cache key (`` `${email}::${actAs}` `` when set, else plain `email` — byte-identical for every existing caller, none of which pass it) so a future per-hat cache collision can't happen without Stage 3 touching the caching logic at all. `signInAs`/67 call sites: zero changes (additive optional param). Then swept `e2e/` for specs perturbable by the new `dualhat.a@test.local` persona (org_admin, Rede A org-tier + quality_reviewer, Hospital Central A hospital-tier — both rows `commission_id IS NULL`). **Property swept by:** an assertion whose truth depends on the SIZE/unfiltered CONTENTS of an org- or hospital-tier roster/directory/candidate-list touching Rede A or Hospital Central A, where the enumeration is NOT pinned to one named identity via a search filter or a `(commission_id, principal_id)`-scoped query. Architecture Rule 2's scope-exclusivity CHECK rules out every COMMISSION-tier roster a priori, by construction, not by inspection — `dualhat.a`'s two rows can never appear on a `commission_id`-scoped query, which excludes `administrativo.spec.ts`'s "Membros" roster, `phase10-meetings.spec.ts`'s "Preencher com membros" autofill, and `views-labels-participants.spec.ts`'s "N membros convocados" meeting-invitee count. **7 files identified** as reaching the exposed org/hospital-tier surfaces (org people-directory `/manage/usuarios`, `AddMemberPicker`/`list_addable_commission_members`, the D9 admin-toggle no-lockout controls, the org_admin content wall): `aff-hospital-affiliation.spec.ts`, `phase3-admin-members.spec.ts`, `user-registration.spec.ts`, `hospital-admin-tier.spec.ts`, `quality-oversight.spec.ts`, `qob-org-admin-content-wall.spec.ts`, `mem-memberships-collapse.spec.ts` (126 tests). **Excluded, with reasoning, not run:** `platform-org-admin-provisioning.spec.ts` (targets `ORG_B` = Rede B exclusively + a dedicated non-seed invitee, by the file's own header comment); `charters-cadence.spec.ts` / `phase-multitenancy.spec.ts` (swept, no roster-count assertions found — `org_admin` used only as a login persona); `ethics-e2-procedure.spec.ts` / `phase10-meetings.spec.ts` / `views-labels-participants.spec.ts` (commission-tier scoped, Rule 2 excludes them by construction, see above). Ran the 7 identified files via `REBUILD=1 SPECS="…" npm run e2e:prod` (chromium, fresh DB + fresh server per batch, 3 batches) per `docs/testing/e2e-prod-build-gate.md`. | **GREEN — 125 passed · 0 failed · 0 flaky · 0 infra · 0 did-not-run · 1 known skip** (`user-registration.spec.ts` AC2 invite-mode — `test.skip`, server-env-gated by the file's own design, pre-existing) **· accounted 126/126 collected · 3/3 batches green.** Batch 1 (aff-hospital-affiliation + phase3-admin-members + user-registration): 40/40 + 1 skip. Batch 2 (hospital-admin-tier + quality-oversight): 59/59. Batch 3 (qob-org-admin-content-wall + mem-memberships-collapse): 26/26. **ZERO regressions — every candidate spec's roster/directory/picker assertion turned out already immune BY CONSTRUCTION**, confirmed by measurement rather than by the reading alone: search-filtered to a named identity before assertion (`AddMemberPicker` in both aff-hospital-affiliation + phase3-admin-members), a `(commission_id, principal_id)`-scoped diff (`countCommissionMembership`), a negative cross-org check unaffected by an added same-org row (`hospital-admin-tier.spec.ts`'s unfiltered-directory and `?search=qualidade` tests), or — per `user-registration.spec.ts`'s own header comment — already hardened against roster growth from a **prior, named incident** ("this was the AC1/AC7 full-suite-contamination cause"). No bug filed; no spec edited. `npm run lint` clean (eslint 0/0 + `lint:css-vars` + `lint:memberships-door`) · `npm run typecheck` clean. Full suite NOT run here (lead's step, per task scope) — see the `e2e:prod` GATE SUMMARY line in the run log for this scoped subset: `125 passed · 0 failed · 0 infra · 0 flaky · 0 did-not-run · 3 batches` / `GATE GREEN`. |

## QA Verdicts

<!-- ONE LINE per phase/feature: verdict + date + link. The full analysis lives in
     docs/reviews/*.md — never restate rationale here or in the archive.
     Struck-through rows are superseded rounds, kept only to show a phase looped.
     Retention: current milestone only. Older concluded rows move VERBATIM to
     qa-verdicts-archive.md's "Collapsed one-line index" (the index is not rationale —
     it preserves the feature-name → review-file mapping). -->

| Phase / Feature | Verdict | Date | Report |
| --- | --- | --- | --- |
| **ACT** — act-as role assumption, **STAGE 4** (D14 arm audit · standing `ARM=hat` sweep · reasoned hat-blind allowlist; ADR 0107) | ✅ **APPROVED (r1)** — 0 BLOCKER / 0 MAJOR / 6 MINOR / 3 INFO; completeness re-derived mechanically from `prosrc` as a property, both keystone mutation twins neutralized and observed red | 2026-08-10 | [act-as-stage-4](docs/reviews/act-as-stage-4-review.md) |
| **ACT** — act-as role assumption, **STAGE 3 build review** (ADR 0106) | ✅ **APPROVED (r2)** — r1 was ⛔ on 1 BLOCKER + 2 MAJOR (hat-blind caller gates on the membership-grant door and `can_manage_professional`), fixed in `20260918002800` + keystone `318`; r2 re-derived the population **by property** (61 caller-bound pairs, no third member) rather than accepting the two-instance fix. MAJOR-2 promoted to the pilot-gate check (*Remaining pre-pilot work* item 0). Verbose row + the three lead errors it recorded → archive | 2026-08-10 | [act-as-stage-3 (r1+r2)](docs/reviews/act-as-stage-3-review.md) |
| **ACT** — act-as role assumption, PRE-BUILD plan review (ADR 0106) | ✅ **APPROVED (r2)** — verbose row → archive | 2026-08-09 | [act-as-plan (r2)](docs/reviews/act-as-plan-review.md) |
| ~~**ACT** — act-as role assumption, PRE-BUILD plan review, round 1~~ | ⛔ CHANGES REQUESTED — verbose row → archive | 2026-08-09 | [act-as-plan (r1)](docs/reviews/act-as-plan-review.md) |
| _Phase 0 → Phase 16_ — **99 concluded rows** (81 rotated 2026-08-06 + 18 rotated 2026-08-10: QO·B · PDF·P2 · PDF·P1 · QO·FUP · QO·A · MIN · AFF · PCI · TV · Phase 16, incl. struck loop rows) | — | — | [collapsed index](docs/progress/qa-verdicts-archive.md) |

## Decisions

<!-- One line per decision; full rationale in docs/decisions/ (ADR) + docs/progress/decisions-log.md -->

| Date | Decision | Ref |
| --- | --- | --- |
| 2026-08-10 | **`document_printing` is ON PERMANENTLY in production; the Gotenberg Coolify resource is active** (PO). **Supersedes ADR [0104](docs/decisions/0104-pdf-document-printing-module.md)'s "Flag: `document_printing`, ships **OFF**" clause** — the flag was a deploy-sequencing guard for the missing renderer sidecar, and the sidecar now exists, so the guard has no remaining job. P3/P4 must not re-assert the OFF posture. ⚠ Recorded on the PO's operational confirmation — the renderer is external infrastructure, not something the catalog can attest. | [0104](docs/decisions/0104-pdf-document-printing-module.md) · [runbook](docs/deployment/pdf-renderer.md) |
| 2026-08-10 | **ACT S3 — classify a hat-blind gate by CALL-SITE BINDING, not signature shape.** A gate that *receives* a caller uid can still be caller-bound; the population must be derived as a property (transitive caller-boundness over the call graph), never read off signatures | ADR [0079](docs/decisions/0079-authz-door-blindness-standing-invariant.md) Amendment 6 · [§7.17](docs/progress/authz-handoff.md) · [0106](docs/decisions/0106-act-as-role-assumption.md) |
| 2026-08-09 | **ACT S0 — the role enum lands in `public.platform_role`, not `app`** (LEAD, measured) — `config.toml` exposes only `public`/`graphql_public`, so an `app` enum is invisible to `gen:types`; exposing `app` would put ~281 DEFINER doors on PostgREST. A bare enum TYPE is not a relation. 11 labels | [0106](docs/decisions/0106-act-as-role-assumption.md) · [plan](docs/plans/act-as-role-assumption.md) |
| 2026-08-09 | **`is_commission_admin_of` → `is_tenancy_admin_of` RENAMED** (PO; no shim, living docs only) — the old name asserted the opposite of its meaning. ⚠ `pg_policy` stores the function by **OID**, so all 54 policies followed the rename with no policy edits | ADR [0105](docs/decisions/0105-rename-is-tenancy-admin-of.md) |
| 2026-08-09 | **QO·B PO RATIFICATION — the FUP-QOB-2 package worked item by item**, each verdict taken against a live-catalog measurement rather than the doc's own claim. Ratified ①②④ + FUP-QOB-1's J1c pin; ruled BUG-QOB-004 = CUT-the-arms | [FUP-QOB-2](docs/progress/follow-ups.md) · [0100](docs/decisions/0100-quality-office-oversight.md) D12 |
| 2026-08-09 | **QO·B BUG-QOB-003 presentation rulings** (LEAD, catalog/precedent-backed) — fix shape = flag + KEEP-scoped UI; `manage/audit/**` + CSV KEEP; `manage/charter` NOT KEEP; `manage/acreditacao/**` stays membership-gated | [BUG-QOB-003](#bug-log) · B.11/B.12 |
| 2026-08-08 | **QO·B content-wall classification RATIFIED (PO, Q1–Q9)** — configuration KEEP / content CUT (*"the admin shapes the containers, never reads what goes in them"*); indicator DEFINITIONS keep, MEASUREMENTS cut; hospital_admin gets the SAME wall; case-ACCESS + classification doors KEEP; `dispose_case_phi` CUT | [0100](docs/decisions/0100-quality-office-oversight.md) D12 · [inventory §6](docs/plans/quality-office-oversight-phase-b-inventory.md) |
| 2026-08-08 | **`revoke_printed_document` KEEPS the tenancy arm — the older ruling overrules the newer draft.** ADR 0104 D11 already held revocation a *governance* act revealing no content; pinned by keystone `314` 8.5 + mutation case `overcut_revoke_ruling` so a later wall-finishing sweep reds instead of silently reversing it | [0104](docs/decisions/0104-pdf-document-printing-module.md) D11 |
| 2026-08-05 | **AFF — hospital affiliation, CPF identity & the org people directory** (PO, grilling interview) — affiliation becomes a **row** and is a **visibility input, never a capability input** (amends 0048 D7); `profiles.cpf` = the person key; org-wide roster disclosure ratified (amends 0048 D1); one identifier-first registration flow | [0097](docs/decisions/0097-hospital-affiliation-person-identity.md) · [plan](docs/plans/hospital-affiliation-person-identity.md) |
| 2026-08-04 | **The authz door-blindness invariant becomes a PHASE STEP, diff-scoped** — §6 step 1 gains ARM 2 every phase + a diff-scoped ARM 1 whenever a phase touches an RLS policy or `prosecdef` gate; step 5 must **name the ARM, not the script**. The full ~5 h sweep stays a periodic audit | [0079 Amendment 1](docs/decisions/0079-authz-door-blindness-standing-invariant.md) · [CLAUDE.md §6](CLAUDE.md) |
| 2026-08-04 | **Membership-hardening + Diretor Técnico: the four open items closed** (PO) — T1.0 = atomic replace; **platform_admin may NOT appoint a DT**; build W1→W4 straight through on one branch; `technical_director` ships ON | [0094 Amendment 1](docs/decisions/0094-membership-hardening-and-technical-director.md) · [plan](docs/plans/membership-hardening-technical-director.md) |
| 2026-08-03 | **Phase 16 build plan authored + 4 planning rulings** (PO, interview) — CAPA evidence arm = hospital-match + `can_read_capa`; commission-owned frameworks commission-scoped SELECT; visible hospital nav entry; ONA skeleton PO-validated | [0093 Amendment 1](docs/decisions/0093-phase-16-standards-crosswalk-replan.md) · [plan](docs/plans/phase-16-standards-crosswalk-program.md) |
| 2026-08-03 | **Phase 16 replanned + re-gates the pilot** (PO, interview) — pre-pilot again; skeleton-only framework packs (licensing); ONA `level` dimension + per-level readiness; evidence enum +`charter`+`ethics_procedure`; worst-wins rollup; `hospital_readiness` re-gated off `is_admin` (noun rule) | [0093](docs/decisions/0093-phase-16-standards-crosswalk-replan.md) · [audit](docs/reviews/phase-16-external-accreditation-audit.md) |
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

- 🔴 **FUP-ACT-DISPOSE-UI** — LGPD Art. 18 referral-erasure has **no UI route** (authorized set ∩ reachable set = ∅); **PILOT-GATE CHECK, item 0 of Remaining pre-pilot work** — PO (mount point)
- 🟡 **FUP-ACT-CAPA-ASSIGN** — NSP operators see ~only themselves in the CAPA assignee picker (`profiles` RLS has no operator arm; the hatless union used to mask it) — backend
- 🟡 **FUP-ACT-HATLESS-AUDIT** — `audit_write` omits the `acting_as` KEY when hatless, so absence conflates *no hat* / *pre-ACT row* / *service-role path* (S4 QA MINOR-6; Rule 11 is met, this is legibility) — backend, travels with the A13 ruling
- ⬛ **FUP-GATE-RESET-FLAKE — RESOLVED 2026-08-11** (the diagnosable half): reset stderr is captured (both call sites) + retried ONCE with attempt 1's output always printed, so the retry cannot mask the transient; `renderer_ok()` preflight probe names a dead `gotenberg-pdf` instead of yielding 8 unexplained reds (fault-injected). ⚠ The restart POLICY stays the PO's call — detection only. Still open: the *reader* habit of quoting "COVERAGE: accounted for 1059 of 1064" while a batch never ran. → [body](docs/progress/follow-ups.md)
- 🔴 **FUP-AFF-1** — the authz census is BLIND to write-path doors (ADR 0079 Amendment 5; AFF gate records must cite `302`'s keystones, not `ARM=census`) — backend/harness
- 🔴 **FUP-PCITV-1** — PCI + TV: what QA APPROVED over, ranked (open: `TRUNCATE` revoke residue · audit-mesh 2/7 arms · unexercised org-admin disjunct · resolver/GUC semantics · 10 bare `for select` policies). ⬛ **embed-sweep entry point DONE 2026-08-11 — `npm run sweep:embeds`**, with a NAMED baseline, not a count: 311 sites / 248 pairs → 246 × `42501` (genuine passes; the sweep's own C1–C3 controls re-prove each run that 42501 masks nothing) + **2 × PGRST205 that are extractor false-positives** (`get_meeting_agenda_items`, both `.rpc().select()` chains — do not chase, and do not suppress PGRST205) — unassigned
- 🔴 **FUP-ETH-1** — NOTHING can seat a professional: "Médico denunciado" is an unfillable panel (two `participants`-lane writers missing, 7 stub actions, no roster UI) — backend, contract-first
- 🔴 **FUP-FF5-1** — patient-lane sublabel is degenerate on the READ path (PO DEFERRED 2026-07-28; resolve before the lane reaches a real committee) — backend
- ⬛ **FUP-PDF-2 — RESOLVED 2026-08-11**: allowlist narrowed to the custom `HC*` class only; `42501` now maps to a per-call-site pt-BR message instead of forwarding the DB's text. ⚠ Catalog-measured: `P0002` **and `23514`** are raised by NO door (23514 could only ever leak English), while `42501` is shared between our raises and Postgres's own. **The rule: surfaceable = only WE can raise it, not "we raise it today".** → [body](docs/progress/follow-ups.md)
- 🟡 FUP-PDF-3 — mint/revoke `returns printed_documents` re-exposes withheld columns (QA P1 MINOR-2; the token is the real widening) — backend
- 🟡 **FUP-PDF-4 — comment FIXED, availability lever OPEN + re-scoped 2026-08-11.** ⛔ The filed premise was wrong: per-credential limiting **already shipped** in `e1daba9`, so the prescribed fix was a no-op. Real remaining gap: the **global** 60/min arm is exhaustible by ONE visitor (~12 credentials × 5), throttling all anonymous `/verificar` traffic, and both windows are per-PROCESS. Needs a trusted client identity (proxy/`x-forwarded-for`, ADR 0059) + shared state — decisions, not code. — backend
- ⬛ **FUP-QOB-1 — CLOSED 2026-08-09: J1c RATIFIED by the PO as the standing guard.** The `270` §J
  catalog pin (policy existence + `created_by = auth.uid()` in BOTH qual/with_check, red-proven via
  b1 `fup_qob1_drop_created_by`) is now the permanent answer. Accepted *because* the behavioural
  surface collapsed rather than weakened — post-M1 no reader-non-writer principal exists to probe
  with, and both alternatives are worse (an invented persona measures the invented grant; retiring
  J1b+J1c leaves the term unguarded). J1b stays annotated-not-deleted. → [body](docs/progress/follow-ups.md)
- 🟡 **FUP-QOB-2 — MOSTLY DISCHARGED 2026-08-09** (worked with the PO item by item, each against a live-catalog measurement). **Ratified:** ① fix shape · ② audit KEEP · ④ acreditação membership-gated · FUP-QOB-1's J1c pin. **Ruled:** BUG-QOB-004 = CUT-the-arms (executed, `20260917000000`); `setTemplateCaseType` Q2-consistency approved; `is_tenancy_admin_of` rename re-confirmed + sequenced last. **Now resolved:** ③ `manage/charter` **RULED NOT-KEEP** 2026-08-09 + the oversight need served by a read-only cadence column on the registry (`20260917000300`) · ⑤ dual-hat precedence **SUPERSEDED** — ⛔ the recorded ruling was **FALSE**: it claimed reviewer-shell precedence, but `src/app/page.tsx` branches `orgAdminOf` at line 64 and `qualityReviewerOf` at line 152, so **tenancy wins** and the console is reachable only by URL (its sidebar entry is gated to the COMMITTEE-MEMBER shell). Replaced by an explicit **"act as" role picker** — a precedence chain guesses, a picker asks, and DERIVED entries kill the ADR-0101 dead-end class structurally. ⬛ **⑤ CLOSED 2026-08-11 — FUP-QOB-2 is now FULLY DISCHARGED**: the item still read "ADR pending / NOT YET BUILT" five days after **ACT S0–S4** shipped, was QA- and human-approved, merged, and cut the remote over (ADR 0106/0107; see the ACT row). ⚠ The *"merge status truth is git"* failure mode again — build-status prose ages silently and nothing gates it. → [body](docs/progress/follow-ups.md)
- 🔴 **FUP-QOB-3 — `dispose_event_phi` is now the ONLY Rule-12 disposal door still granting a bare tenancy admin** (found 2026-08-09 by the sibling-coherence check run right after the BUG-QOB-004 cut, *not* by anything in that ruling's scope). D5's ratified reasoning — "a principal with zero PHI bits does not destroy Rule 12 data" — applies to patient-safety identically to case + referral, so two of the three PHI modules now deny the tenancy tier and one still grants it, purely because of ruling order. Tell: it still carries the same pt-BR message `dispose_referral_phi` had to shed. **Deliberately not acted on** — outside the ruling, and removing a live capability unasked is the standing trap in the other direction. `dispose_meeting_minutes` is a *separate* question (not a PHI module, probably a genuine KEEP) — do not sweep it in reflexively. → [body](docs/progress/follow-ups.md) — PO, then backend
- ⬛ **FUP-QO-9 — RESOLVED 2026-08-11**: `pgrst_unready()` teaches the classifier both PGRST002 shapes (a schema-cache race fails ASSERTIONS, so `conn_errors` was blind by construction); a zero-summary crash now classifies INFRA and is auto-retried, reporting the unrun count instead of `infra-unproven(0)`; and `pgrst_ok()` makes preflight WAIT for the schema cache (`reload_pgrst` only NOTIFIES — the rebuild is async and was never awaited), fixing the race rather than only retrying it. ⛔ Premise correction: the zero-test crash was **never a false green** — three checks already redded it; only the RETRY was missing. → [body](docs/progress/follow-ups.md)
- 🟡 FUP-AFF-3 — pin door ACLs by DERIVING the door set from `pg_proc`, not by remembering it — backend
- 🟡 FUP-AFF-4 — make the membership-role list a Postgres ENUM (decide before the role set next changes) — backend
- 🟡 FUP-AFF-2 — D7's foreign-professional (no-CPF) escape is unreachable; decide before the pilot onboards clinical staff — product + backend
- ⬛ **FUP-P16-4 — RESOLVED 2026-08-11**: all 12 sites / 10 files migrated to `plural()`; zero `? "" : "s"` left in `src/`. No behavioural change (every word was regular) — the trap is removed, not a bug. ⚠ Helper moved to a new **`src/lib/text.ts`** (pt-BR *language* primitives, distinct from the per-domain `format.ts` convention) and re-exported from `components/accreditation/format.ts`: the consumers are notifications/safety/documents/cases, and depending on an accreditation module from the notification bell is the wrong edge. → [body](docs/progress/follow-ups.md)
- ⬛ **FUP-P16-2 — RESOLVED 2026-08-11**: `getStandardAssessmentDetail` moved wholesale to `queries/` (its one caller is a Server Component — no action wrapper needed); `searchEvidenceCandidates` stays an action (its caller is a Client Component) with only its data access moved. ⚠ The naive fix was a silent regression: the pre-existing sibling `getEvidenceCandidates` **swallows errors → `[]`**, which would have rendered every picker failure as "no results found". Added `findEvidenceCandidates` returning candidates **and** error, so the list keeps swallowing and the picker keeps its pt-BR error banner. → [body](docs/progress/follow-ups.md)
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
