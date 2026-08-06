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
| **AFF** | **Hospital affiliation, person identity & the org people directory** [0097](docs/decisions/0097-hospital-affiliation-person-identity.md) · [plan](docs/plans/hospital-affiliation-person-identity.md) · [audit](docs/reviews/aff-adr-0097-external-audit.md) — **gates the pilot deploy** (D19) | ▶ **in progress** (W1) | – | – | – | ADR ✅ 2026-08-05 | – | branch `feat/hospital-affiliation-person-identity` |
| **TV** | **Process-Template Versioning** [0096](docs/decisions/0096-process-template-versioning.md) (+ Amendments 1.1–1.7) — PO-directed full remodel · [detail](docs/progress/process-case-integrity-and-template-versioning.md) | ✅ complete | ✅ lint 0/0 · tsc · vitest 945 · `db reset` 284=284 | ✅ pgTAP **158f/4860 PASS** · `297` 37 assertions all mutation-proven · `ARM=floor` HOLDS · diff-scoped `ARM=policy` **6 COVERED / 0 BLIND** (was 6 BLIND) · `e2e:prod` **GATE GREEN — 965 passed · 0 failed · 0 infra · 0 flaky · 0 did-not-run · 16 batches · 0 reset FAILED · accounted 965/970** | ✅ **APPROVED** r2 [review](docs/reviews/process-integrity-and-template-versioning-review.md) | ✅ 2026-08-05 | 2026-08-05 | `6b9314c`…`f6c847d` → ff `main` |

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

**▶ ACTIVE: AFF — Hospital affiliation, person identity & the org people directory.**
ADR [0097](docs/decisions/0097-hospital-affiliation-person-identity.md) **Accepted** (PO-approved
2026-08-05) · plan [hospital-affiliation-person-identity.md](docs/plans/hospital-affiliation-person-identity.md)
· external audit [aff-adr-0097-external-audit.md](docs/reviews/aff-adr-0097-external-audit.md)
(BLOCKER-1 / HIGH-1 / MEDIUM-1…5 / MINOR-1 / LOW-1…3 all folded in before build).
Branch **`feat/hospital-affiliation-person-identity`** (cut from `main` @ `f41fc69`).
**Migration window: `20260909000100`+** — highest *registered* version at kickoff `20260908000100`
(285 files = 285 registered, verified against `supabase_migrations.schema_migrations`, not the directory).
**AFF gates the pilot deploy** (ADR 0097 D19).

| WS | Scope | Owner | State |
| -- | ----- | ----- | ----- |
| **W1** | Substrate — `hospital_affiliations` (T1.1) · `profiles.cpf` + column-list grant conversion (T1.2) · drop `home_hospital_id` / `hospital_employee_id` as a refactor (T1.3) · `professional_profiles.cpf` (T1.4) · pgTAP (T1.5) | `backend` | ✅ **done** — migrations `20260909000100`–`000400`; ADR [0098](docs/decisions/0098-aff-w1-substrate-shape-decisions.md) |
| **W2** | Doors, visibility & the dominance grid — `affiliate_person` / `end_affiliation` (T2.1) · `list_org_people` (T2.2) · widened `profiles` SELECT (T2.3) · dominance grid + the 2 live gaps (T2.4) · `grant_role_impl` hospital arm (T2.5) · pgTAP (T2.6) | `backend` | ✅ **done** — migrations `20260909000500`–`000900`; ADR 0098 §W2 |
| **W3** | Product surfaces — identifier-first registration (T3.1) · affiliation-derived roster (T3.2) · affiliation management + field ownership (T3.3) · single-hospital provisioning (T3.4) · seed Rede C (T3.5) · E2E (T3.6) | `frontend` + `backend` | ▶ backend ✅ (migrations `20260909001000`–`001100`; ADR 0098 §W3) · frontend in progress · T3.6 pending `tester` |

**File ownership (binding for this workstream):** `backend` owns `supabase/**` (migrations, pgTAP,
`seed.sql`, **and `supabase/demo/seed-revisao-prontuario.sql` — audit MEDIUM-2, it is in no gate**),
`src/lib/{supabase,queries,types}`, `src/lib/users/actions.ts`, `src/lib/members/invite.ts`.
`frontend` owns `src/app/**` and `src/components/**`. `src/lib/types/database.ts` changes **only**
via `backend` (`npm run gen:types` after every migration — Rule 8).

**The four audit rulings that changed the build** (PO-ruled 2026-08-05, all now binding):
BLOCKER-1 → **T2.5 exists at all** (`grant_role_impl`'s `hospital_admin` branch gains
`app.is_admin_for`; without it T3.4 has *no working path* — the platform admin is denied 42501 and
the fallback hits the self-grant guard) · HIGH-1 → `cpf` is **column-locked**, which converts
`profiles` to column-list grants (**from then on every new `profiles` column needs its own GRANT or
reads 42501** — the standing `case_referral` lesson now applies to `profiles`) · MEDIUM-3 →
`end_affiliation` blocks on memberships of **any tier**, not just commission seats · MEDIUM-5 →
`list_org_people` is gated by an **inline** org_admin-or-hospital_admin predicate, **not**
`app.is_org_level_admin_within` (which also admits `nsp_org_admin` and is a live leg of
`organizations_select`).

> ⚠ **Two runtime landmines this workstream must clear, neither visible to lint/tsc/tests:**
> `guard_profile_privileged_columns` compares both doomed columns and plpgsql is **late-bound** — the
> DROP succeeds and then *every* `profiles` UPDATE fails 42703 (rewrite the trigger in the **same**
> migration, regenerated from live `pg_get_functiondef`); and
> [org.ts:199](src/lib/queries/org.ts)'s embed string `profiles!profiles_home_hospital_id_fkey(count)`
> **typechecks after the drop and fails only at runtime** (the TV dropped-column mechanism — grep is
> the authority for the client layer, the catalog for SQL).

**W1 result (`backend`, 2026-08-06).** Migrations `20260909000100` (`hospital_affiliations` + its
four-leg policy + the `affiliation.created/ended` audit trigger) · `000200` (`app.is_valid_cpf`,
`profiles.cpf`, and the column-list grant conversion — `authenticated` now holds
`SELECT/INSERT/UPDATE` on **11 named columns**, table-level `dDxtm` untouched) · `000300` (the two
policy legs, the `guard_profile_privileged_columns` rewrite, the DROP) · `000400`
(`professional_profiles.cpf`). Gates: **289 registered == 289 files** on a fresh reset · pgTAP
**162 files / 4961 tests PASS** (new suite `301`, **40 assertions**) · Vitest **984/984** · lint
0 errors 0 warnings · typecheck clean · authz **`ARM=census` HOLDS** (the new policy was correctly
flagged UNKNOWN first, then swept) and **`ARM=floor` HOLDS**; the diff-scoped door sweep over
`hospital_affiliations_select` + both altered `profiles` policies returned **3 COVERED, 0 BLIND,
0 ERROR** (the findings report was *merged*, not `git checkout`-ed, so the subset run did not
discard 400+ committed verdicts). **11 mutations were run against `301`; every one went red on its
target** (each of the four policy legs individually, `using(true)` for all four deny arms, the
column lock, the stale trigger body, the partial unique, the composite FK, the CPF validator, the
DML grant). Shape decisions ADR 0097 left open are recorded in ADR
[0098](docs/decisions/0098-aff-w1-substrate-shape-decisions.md).

> ✅ **W1→W2 SEQUENCING HAZARD — CLOSED.** W1's `20260909000300` removed the `home_hospital_id`
> leg and added nothing, so a person registered at a hospital and seated on no committee was
> invisible to their own hospital's admin (seed reach was unchanged at 13/30 and 21/34 — the
> product path was the live case). **T2.3 (`20260909000700`) has landed and `301` §5.1 is
> INVERTED**: it now reads "the hospital admin reads BOTH the affiliation AND the profile of a
> committee-less employee", and the mutation oracle confirms it goes red when the affiliation leg
> is removed. The E2E gate is unblocked on this axis.

**W2 result (`backend`, 2026-08-06).** Migrations `20260909000500` (the affiliation ACTOR KERNEL +
`auth.uid()` wrappers + `_for` service twins + the delete guard + the `affiliation.deleted` audit
arm) · `000600` (`list_org_people`, inline-gated, CPF-audited) · `000700` (the two `profiles` legs)
· `000800` (both dominance gaps) · `000900` (`grant_role_impl`'s `is_admin_for` arm, regenerated
programmatically from live `pg_get_functiondef` with a single anchored replacement). Gates:
**294 registered == 294 files** on a fresh reset · pgTAP **164 files / 5024 tests PASS** (`302` =
**50** assertions, `303` = **12**) · Vitest **988/988** · lint 0/0 (the door gate now covers
`hospital_affiliations`) · typecheck clean · authz **`ARM=census` HOLDS** (it correctly flagged
`list_org_people` UNKNOWN first — swept via the ROW-DOOR arm, since the boolean-gate arm has no
mechanism for a table-returning door) and **`ARM=floor` HOLDS**; the diff-scoped run, derived from
the migration diff, returned **3 policies COVERED + 1 row-door COVERED, 0 BLIND, 0 ERROR**. Both
findings reports were **merged**, not discarded.

> ⚠ **One vacuous keystone was found and fixed — by the mutation oracle, not by review.** `302`
> §4.2 asserted the membership leg using `dt.a` as its subject, but §3's fixture had affiliated
> `dt.a`, so the **affiliation** leg admitted them: removing the membership leg left the assertion
> GREEN. The subject is now `dt.dep.a` (a hospital-tier seat, never affiliated), with §4.2a
> asserting that subject has zero affiliation rows so the arm under test is the only path.
> Thirteen SQL mutations + one TS mutation were run one at a time; every one now goes red on its
> target, and the three that first reported "still green" were **harness** failures (the mutation
> had not landed) — each was re-run with its pre-image asserted.

> ⚠ **`281` D1 was INVERTED (not deleted), and gained a deny twin.** It pinned "org_admin is
> REJECTED by `set_standard_ownership`" as a "D7 asymmetry, verified" — the exact behaviour ADR
> 0097 finding 9 and the external census classify as a real dominance gap, and D18 fixes. A fixed
> bug leaving behind a test that asserts the old behaviour is how the next reader "repairs" the
> code back into the defect.

**W3 backend result (`backend`, 2026-08-06).** Migrations `20260909001000` (the
deactivated-account guard, `HC0R4`) · `001100` (the `update_affiliation` door + the
`affiliation.updated` audit arm). `OrgUserDetail` now carries `affiliations: UserAffiliation[]`
and the three transitional singular fields are gone; D14 is enforced by
`authorizeOrgAdminForUser` across name/CPF/category/credentials AND the account lifecycle;
`registerUser` requires, validates, normalizes and stores `cpf` with a front-loaded collision
block; `lookupOrgPeople` + `updateAffiliation` landed in `src/lib/affiliations/actions.ts`;
T3.4 seats `hospital_admin` alongside `org_admin` when an org has exactly one hospital.
Gates: **296 registered == 296 files** · pgTAP **165 files / 5050 tests PASS** (`304` = **23**)
· Vitest **1003/1003** · lint 0/0 · typecheck clean · `ARM=census` and `ARM=floor` HOLD.

> ⚠ **THE AUTHZ SWEEP EXAMINED NONE OF THE W3 DOORS, AND "0 BLIND" SAYS SO ONLY IF YOU
> KNOW THAT.** The diff-scoped run over `update_affiliation` / `update_affiliation_for` /
> `affiliate_person` printed **PREDICATE ARM: empty, POLICY ARM: empty, BLIND 0, ERROR 0** —
> because W3 changed no policies and these doors return `uuid`, so the boolean arm's
> neutralization (rewrite the body to `select true`) has no meaning and is skipped silently.
> The row-door arm does not apply either. `ARM=census` does not flag them, since void/uuid
> write-path doors are not in its population. **They are covered ONLY by pgTAP `304` §1–§2**
> (ACL split, authority arms, and observed-state assertions). This is a second instance of
> the hole the lead is amending ADR 0079 for.

> ⚠ **T3.5's blast radius, measured.** The seed change reded **11 assertions in 5 files**, all
> traced and fixed at the spec that owned the assumption: `301` §2 (two CPF literals collided
> with newly-seeded values), `302` §2/§5 (a fixture subject the new HC0R4 guard now refuses,
> plus an absolute `audit_log` count that was never hermetic — `frontend`'s dev server hitting
> the same local DB reded it, and the assertions are now baseline-scoped), and `190`/`224`/`293`
> (anti-lockout suites that inherited "the bootstrap has no org_admin"). **No fixture was
> clamped to preserve an old count.**

> ⚠ **`301` §4's fixture is now idempotent by construction** — T3.5 seeds the D2 affiliation, so
> a blind insert duplicated the pair and aborted the file on `hospital_affiliations_active_uq`.

> ⚠ **`seed.sql` is a contract with ~900 pgTAP tests + E2E.** T3.5 adds an org (Rede C), personas and
> affiliation rows; the very constants ADR 0097 cites (21/34 memberships, 13/30 profiles, 6 dangling)
> are the kind of number baked into counting keystones. Budget for updating them — **do not clamp the
> new fixtures to preserve old counts** (the shared-fixture pigeonhole lesson).

**W3 UI result (`frontend`, 2026-08-06) — T3.1 / T3.2 / T3.3 UI halves BUILT and browser-verified.**
Files: `src/app/o/[org]/manage/usuarios/{page,novo/page,[userId]/page}.tsx` · new
`src/components/users/{register-person-flow,cpf-field,affiliations-panel}.tsx` · rewritten
`register-user-form.tsx` / `user-profile-edit-form.tsx` · edited
`user-directory-list.tsx` / `user-lifecycle-actions.tsx`.
**T3.1** — `/usuarios/novo` is now a two-step flow inside the SAME route (a second route would
reintroduce D12's actual defect: the admin having to know in advance which case they are in). CPF
travels in a POST via `lookupOrgPeople`, **never a URL parameter** — a national ID must not land in
history or an access log. All four D12 outcomes verified in a running app, plus a **fifth guard**:
`is_active` gets its own outcome, so a deactivated account is never silently offered for affiliation
(ADR 0098 W2.2 is why the flag is in the payload). Outcome D has no branch of its own **by design** —
a CPF held outside the org is indistinguishable from "not found", and `registerUser`'s block refuses
at submit, verbatim in form. **T3.2** — employment and committees render as separate chips; the
zero-committee affiliated person (`novato.pendente`) shows "Hospital Central A · Sem comissão" in the
hospital roster, legible rather than an empty cell. Empty lists say "none found", **never** "you lack
permission" (`list_org_people` returns `[]` for an unauthorized caller by design). **T3.3** —
person-level fields (nome, CPF, categoria, credenciais) are `org_admin`-only in the UI and the CPF
field is **write-only** (D7 column-lock: no admin surface reads another person's CPF); employment
(matrícula + início, via `update_affiliation`) belongs to the hospital's own admin; account
deactivation is absent for a hospital admin with the reason stated. `endAffiliation` blockers render
the actual seats ("Membro — Comissão de Controle de Infecção Hospitalar"), never "não foi possível".
Every `can*` flag is **UX only** — the server refusals (`MESSAGES.orgAdminOnly`, the doors' SQLSTATEs)
are the boundary (Rule 1). Gates on `frontend`-owned files: typecheck **0 errors** · lint **0/0**
(incl. `lint:css-vars` + the door gate) · Vitest **1003/1003**. Verified by driving the flows in
`next dev` (13 screenshots), incl. a **keyboard-only** pass: the CPF field is reachable by Tab and
focus lands on the outcome heading after the lookup.

> ⚠ **E2E LOCATOR IMPACT — `tester` must re-point these.** `/o/[org]/manage/usuarios/novo` no longer
> renders the create form on load; it renders the CPF step, and the create form appears only after a
> lookup returns nothing. Affected today: `e2e/user-registration.spec.ts` (6 navigations),
> `e2e/hospital-admin-tier.spec.ts` HA-6 (2), `e2e/phase3-admin-members.spec.ts` (1). Also:
> `getByLabel('Hospital de origem')` is **gone** — the hospital is now a read-only display for a
> hospital_admin (label "Hospital") and the concept is "vínculo", not "origem"; the directory row's
> "Sem hospital de origem" became the chip "Sem vínculo hospitalar"; and `getByLabel('CPF')` matches
> **two** nodes (the field and the region "Comece pelo CPF") — use
> `getByRole('textbox', { name: 'CPF' })`.

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

**1. ▶ AFF — Hospital affiliation, person identity & the org people directory. ADR APPROVED and BUILD
STARTED 2026-08-05** — live task table under *Current Phase Tasks* above. ADR
[0097](docs/decisions/0097-hospital-affiliation-person-identity.md) · plan
[hospital-affiliation-person-identity.md](docs/plans/hospital-affiliation-person-identity.md) (W1
substrate → W2 doors/visibility → W3 product surfaces). **Gates the pilot deploy** — it is mostly
schema (a new `hospital_affiliations` table, `profiles.cpf`, two dropped columns, a widened `profiles`
policy, two new DEFINER doors), and every one of those is free while `supabase db reset` is free and
materially more expensive the day after the remote `db push`. Origin: the PO scenario of a professional
hired by a **second hospital of the same organization** — `registerUser` blocks on the email collision
and there is no "this person already exists, vincular" path. **Five catalog-verified findings drive it**
(evidence in the ADR's Context): (a) `list_addable_commission_members` **already** discloses the whole
org roster to a hospital admin — the feature is half-shipped and undeclared; (b) `profiles.home_hospital_id`
is populated on **1 of 30** profiles, so its RLS leg is inert; (c) `memberships` SELECT is **wider** than
`profiles` SELECT — a hospital admin reads **6** membership rows whose principals they cannot name,
including their own `technical_director`; (d) no row expresses "employed at this hospital", and
`hospital_employee_id` (matrícula) is singular on `profiles` though it is per-employment; (e) ADR 0051 D1's
**"org_admin dominates hospital_admin" is false** — `set_standard_ownership` and `standard_ownerships_select`
admit `hospital_admin` with no `org_admin` arm (BUG-AUTHZ-001's shape), both fixed in W2 behind a new
dominance grid. Also settles single-hospital tenants: **no model change** — one principal already holds
`org_admin` + `hospital_admin` (probed live) — but **no product path can seat it** (the self-grant guard
fires on the service path too), so W3 seats both at provisioning.

**2. ▶ The pilot deploy itself — user-gated, NOT started.** ✅ The **git** half is already done: Phase 16
is merged to `main` and `main` == `origin/main` at `484a254` (verified by a live `git fetch` 2026-08-04,
not by reading this file — the row above claimed "not merged/pushed" for a day after it was both).
**What remains is the deploy proper:** the **Coolify** app deploy + the remote **`db push`** of every
local-only migration (the S1–S3 batch onward — every S-phase built local-first by design). **This is
when the ETH·E1 m2 flag flip reaches production.** ⚠ The remote `db push` needs the **user's own auth** —
background agents are auto-denied.

**3. ⬛ ~~BUG-AUTHZ-002 — two hospital-tier DEFINER doors still carry the forbidden `is_admin()` arm.~~**
**FIXED 2026-08-05** (`20260908000100`, held by `299_hospital_content_door_noun_rule.sql` 11/11) — no
longer gates the pilot deploy. Full entry in the Bug Log below, including why the parity test this row
prescribed had to be written differently: enumerated live, the property returns **four** doors, and
`verify_audit_chain` must NOT return zero rows (its `is_admin()` is the platform tier, and audit is
platform_admin's own noun).

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

🔴 **BUG-TV-001 — process-template narrative-slot EDIT and REMOVE are dead end-to-end
(QA finding F-1, `tester`-owned F-2 coverage).** Filed 2026-08-05, TV phase.
**Repro:** as `chefe.ccih@test.local` (staff_admin, CCIH/Rede A), create a draft process
template, add a narrative slot (works), then (a) open its edit dialog, change the title,
submit, or (b) click its trash icon and confirm removal. **Expected:** (a) the dialog
closes and the card shows the new title; (b) the card disappears and the DB row is gone.
**Actual:** both fail with the friendly pt-BR toast "Narrativa não encontrada." — (a) the
edit dialog stays open showing that banner, title unchanged; (b) the confirm dialog closes
(Radix default) but the page-level banner shows the same message and the card/DB row
survive untouched. **Root cause (F-1):** `commissionOfTemplateNarrative`
(`src/lib/case-narratives/actions.ts:232`) selects the PostgREST embed
`process_templates(commission_id)` from `.from('process_template_narratives')`. ADR-0096
dropped `process_template_narratives.template_id` — the FK that embed relied on — so
PostgREST rejects it with `PGRST200` at parse time. The helper discards `error` and
returns `null` from `data?.process_templates?.commission_id ?? null`, so both
`updateTemplateNarrative` and `removeTemplateNarrative` take the `!commissionId`
early-return and answer with `MESSAGES.missingNarrative` ("Narrativa não encontrada.").
Fails CLOSED, not an authz hole, but both actions are fully wired to the UI
(`narrative-slot-dialog.tsx:129` / `template-builder-shell.tsx:243`), so this is a
deterministic dead end for every staff_admin, on their own commission's own template.
**Violates:** PHASES.md TV acceptance for narrative-slot authoring (edit/remove parity
with create); ARCHITECTURE.md Rule 9 data-access-layer correctness (the query no longer
matches the live FK graph). **Spec (RED-proven against current HEAD, before any fix):**
`e2e/process-template-narrative-slot-crud.spec.ts` — two independent tests (own draft
template + own narrative slot each, no shared/seeded fixture), asserting the CORRECT
behavior (edit persists the new title; remove deletes the row), so both currently fail
red for exactly the F-1 reason: `narrative-slot EDIT` fails at the "dialog closed"
assertion (stays open, showing `status: Narrativa não encontrada.`); `narrative-slot
REMOVE` fails at the "no not-found banner" assertion (banner present; DOM snapshot
confirms the slot card `region "Slot Para Remover …"` survived). **Owner:** `backend`
(fix `commissionOfTemplateNarrative` to resolve the commission without the dead FK
embed — e.g. join through `process_template_versions.template_id` in two round trips, or
add a substitute FK/view). **Status:** ✅ **FIXED by `backend` 2026-08-05** — no migration
needed (client-layer only). `commissionOfTemplateNarrative` now selects the nested embed
`process_template_versions(process_templates(commission_id))` — a single round trip along
the live FK path `process_template_narratives.template_version_id →
process_template_versions.template_id → process_templates`, derived from `pg_constraint`
and mirroring `contextOfPhase` (`src/lib/process-templates/actions.ts:179`). **Verified
against PostgREST, not `tsc`:** the old embed returns `PGRST200` ("Could not find a
relationship…", hint: "Perhaps you meant 'process_template_versions'"); the new one
returns the correct `commission_id` for a real slot under an authenticated session.
Both actions' resolver helpers (all 5 in the file) now log the discarded `error` instead
of folding a query failure into an indistinguishable "not found". **Mutation-checked:**
reverting only the select string turns the spec red again (2 failed) and fires the new
log line — so the green is causally attributable to the fix, not to environment.
`e2e/process-template-narrative-slot-crud.spec.ts` 2/2 green locally (chromium); spec
unmodified — final gate verification remains `tester`'s.

⬛ **BUG-RCA-001 — RCA citation targets silently omit ALL interviews. ✅ FIXED 2026-08-05.** Filed 2026-08-05 by `backend`, found by the BUG-TV-001 sibling sweep —
**nobody was looking for this one; it is unrelated to ADR 0096.** `listRcaCitationTargets`
(`src/lib/queries/rca.ts:450`) issues
`.from('case_interviews').select('id, interview_number, title, scheduled_start')`.
**`case_interviews` has no `scheduled_start` column** — per `information_schema`, it lives on
`interview_sessions` (an interview has many sessions). PostgREST/Postgres reject the whole
select with `42703 column case_interviews.scheduled_start does not exist`, so `data` is
`null`, `interviews ?? []` yields `[]`, and **every interview is silently dropped from the RCA
citation-target list** — no error, no toast, just missing options. **Invisible to every
existing gate** for the standard reason: a `.select()` is an opaque string and `.returns<T>()`
is a type *assertion*, so it typechecks, lints, and passes E2E (which has no coverage of this
picker). **Fix is a product decision, deliberately NOT taken unilaterally:** an interview has
N sessions, so "the interview's date" must be defined (earliest session's `scheduled_start`?
the interview's `created_at`?) — needs an owner ruling before the embed is written.
**PO RULING 2026-08-05: "the interview's date" is the EARLIEST session's `scheduled_start`.**
**Fixed** in `listRcaCitationTargets` — the select now embeds `interview_sessions ( scheduled_start )`
and derives via the new exported `earliestSessionStart()`. No migration; client layer only.
**Verified against PostgREST, not `tsc`:** the old select returns `42703 column
case_interviews.scheduled_start does not exist`; the new one returns HTTP 200 with real rows — and the
seeded interview genuinely carries TWO sessions (08-03 and 08-08), so the derivation is exercised rather
than trivially satisfied. A full `probe-embeds.mjs` re-run over 286 sites now shows **zero 42703**.
**The ruling is pinned by a TEST, not a comment** (`rca.test.ts`, 5 cases). The helper is exported and
pure precisely because "its date" is a CHOICE — `created_at` was the live alternative, and a comment
would not have survived the next refactor.
⚠ Deliberately NOT status-filtered like `toNextSession` — that helper answers "what is NEXT", this one
answers "when WAS it", and a concluded interview's sessions are exactly the ones it excludes.
⚠ **Mutation-proven per arm** (ADR 0079 A2): sorting descending reds the earliest-wins case; dropping the
undated filter reds the null-handling case. **My first attempt at the second probe was INERT** — the
replace matched nothing and stayed green, which is indistinguishable from a surviving probe and would
have had me delete a good test as vacuous. Confirm a mutation APPLIED before trusting its verdict.

⬛ **BUG-A11Y-001 — duplicate DOM ids on `/admin` broke label→control association. ✅ FIXED 2026-08-05.**
Found by FUP-MEM-2's spec on its **first ever execution** (written 08-04, never run until the full gate).
`useFieldIds(name)` used `name` as BOTH the form key and the DOM id, so two forms on one page sharing a
field name emitted duplicate ids. `/admin` renders three forms and had **three** collisions: `name` and
`slug` (organization vs hospital create) and `organizationId` (hospital create vs org-admin assign).
`htmlFor` resolves to the FIRST match in document order, so each LATER form's labels pointed at the
EARLIER form's controls — clicking "Organização" in the org-admin section moved focus into the hospital
form, and a screen reader announced the wrong field. **Impact is accessibility + focus, not authorization.**
**Fix:** `useFieldIds` gains an optional `id`; `name` still drives `formData.get(name)`, so no action
contract changed. Applied to the two later forms. The systemic fix (id from `useId()`) was deliberately
NOT taken — that primitive backs **38 components** and rewriting it with no cheap re-verification is how a
regression ships → FUP-A11Y-1.
⚠ **The first fix was INERT.** `controlId` was threaded into `descriptionId`/`errorId` while `controlProps`
still returned `id: name`, so nothing reached the DOM and the re-run failed identically. Caught by dumping
the LIVE DOM — re-reading the diff would only have confirmed my intent, never the behaviour.
⚠ **A green suite is not a working teardown.** This spec's purge fought two invariants
(`guard_profile_no_delete` raises unconditionally; `profiles.id` FKs `auth.users.id` with no cascade) and
had never executed, because MEM2-1 failed BEFORE creating the invitee so the purge always matched zero
rows. A teardown is first exercised when the test it cleans up after starts passing.

⬛ **BUG-AUTHZ-002 — the BUG-AUTHZ-001 sweep missed two hospital doors (noun-rule violation). ✅ FIXED 2026-08-05.**
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
**Status:** ✅ **FIXED 2026-08-05** by `20260908000100`, held by
`299_hospital_content_door_noun_rule.sql` (11/11).
**RED BEFORE GREEN, as this entry asked:** the live probe it was missing was run first —
platform@ read **3 documents / 2 rollups** from Hospital Central A; after the migration, **0 / 0**.
Twins: hospital_admin.a1 and orgadmin.a still read 3 / 2, so the fix did not fail closed.
**Mutation-proven per arm** (ADR 0079 A2's FORK rule): restoring the disjunct on
`hospital_document_register` reds §2.1 only, on `hospital_indicator_rollup` reds §2.2 only —
neither assertion is redundant, and one probe would have made the other look vacuous.
⚠ **This entry's prescribed test was wrong as written.** "Zero rows from *every* hospital-tier
DEFINER" fails on `verify_audit_chain`: enumerating the property live returns **four** doors, and
that one's `app.is_admin()` is its **platform-tier** branch (all args null) — audit is
platform_admin's own noun, so the arm is correct and permanent. Its hospital branch already
excluded platform_admin. Probed both ways (42501 at hospital tier, `ok = t` at platform tier). The
property is commission **content**, not hospital **tier**; `299` §4 derives the door set from
`pg_proc` at run time and reds on any unrecognised member.
⚠ **Two existing tests encoded the OLD behaviour and had to be inverted** — the fix is not
complete without them: `200_controlled_documents.sql` #30 *required* `>= 2` rows for platform_admin
(a test pinning the leak), and `283_accreditation_readiness_report.sql` E3 used this very bug as its
**non-vacuity control**, so fixing the bug removed the control and left E1/E2 unfalsifiable. E3 is
re-anchored on `verify_audit_chain`. **A control anchored on a defect evaporates when the defect is
fixed — anchor it on something correct BY DESIGN.**

### Closed — rotated 2026-08-04 → [bug-log-archive.md](docs/progress/bug-log-archive.md)

| Bug | Summary | Closed |
| --- | --- | --- |
| **BUG-P16-001** | Saving a standard assessment **silently destroyed** the existing `note_md` — no read path, unconditional upsert. Fixed in three halves (RPC `coalesce` + `optionalClearableText` + a real read path). ⚠ **Both** round-trips are asserted (pgTAP 281 C7b *and* C11) because either alone passes in a broken world | 2026-08-03 |
| **BUG-P16-002** | **P0** — all 7 `queries/accreditation.ts` functions still `throw new Error('not implemented')`; every Phase 16 screen dead on arrival. The contract was scheduled, the implementation never was. Survived the whole green bar because the routes sat behind a flag seeded OFF | 2026-08-03 |
| **BUG-P16-003** | `framework-list.tsx` forwarded a `frameworkHref` **closure across a Server→Client boundary** — crashed the commission framework list for every staff_admin as soon as one global framework existed | 2026-08-03 |
| **BUG-P16-004** | Same shape in `[framework]/layout.tsx` → `StandardsTree`; crashed every framework **and** standard-detail page — the larger blast radius of the two | 2026-08-03 |
| **BUG-P16-005** | `"padrãoes"` — a plural built by suffix concatenation on an irregular `-ão` noun. The sweep found a live sibling (`"em atençãos"`); the PO ruled the final wording; tolerant regexes were then replaced with exact literals **plus** a dedicated plural guard test | 2026-08-04 |
| **BUG-P16-006** | 4 indicator ids hardcoded as **captured** UUIDs; `seed.sql` mints fresh ones on every reset, so the gate's `RESET=1` broke them. Fixed by natural-key lookup; verified across two consecutive fresh resets (31/31 → reset → 31/31) | 2026-08-04 |
| **BUG-GATE-001** | `scripts/e2e-prod-gate.sh` dropped a `reset FAILED` batch from its **own** coverage denominator — 66 unrun tests reported as "860 of 865". Fixed + fault-injection-verified, with an over-grant twin on the pre-fix script | 2026-08-03 |
| **BUG-AUTHZ-001** | `platform_admin` read response-level content through **five** `dashboard_*` DEFINER doors, invisible to a policy audit of `responses`. Unified on the 4-fn gate shape (`…000700` + pgTAP `270`). ⚠ **The report was wrong 3×** — 5 functions not 4, one relation misnamed, and only half the defect described | 2026-08-03 |
| **BUG-P15-001** | `phase15-indicators` AC-4 red on the 1st–4th of any month (seed day-offsets crossing the month boundary). Fixed **spec-side** (`93a0f9a`) by deriving the window from the seeded rows. ⚠ A seed-side clamp was tried FIRST and reverted — it regressed `phase8-dashboard` 8× | 2026-08-03 |
| **BUG-P22-002** | R5-6 keyboard-only internal note — a **spec-timing** bug filed as a product defect; `.focus()` is not auto-waiting | 2026-08-03 |
| ⚪ **BUG-P22-001** | **Not reproducible** — 40/40 on a clean reset; the filed mechanism was wrong too | 2026-08-03 |
| ⚪ **BUG-E2EISO-001** | **Not reproducible** — 80/80 on the record's own batch repro; most likely already fixed by BUG-E2EISO-002 | 2026-08-03 |
| ⚪ **BUG-E2EISO-003** | **Not reproducible** — 8/8 fresh and 8/8 again on the same DB; the real trigger is a *partially executed* prior run, which the filed repro never exercises | 2026-08-03 |

⚠ **The 2026-08-03 ad-hoc batch's headline finding was about the bug log itself, not the code: four of
seven items were not the defect they were filed as** — three do not reproduce at all, one was a spec
bug. Of the three that were real, two had materially wrong reports. **Every correction came from
re-running the repro or querying the live catalog; none from re-reading the report.**

⚠ **BUG-P16-003/004 leave a reusable sweep rule.** The tester keyed its sweep on the `Href={(…) => …}`
*shape in route files*; the real property is **any function-valued prop crossing a server→client
boundary** (an `onSelect`/`formatter`/`render` prop crashes identically and matches no `Href` grep).
Re-deriving **from the boundary** — classify components by `"use client"`, then inspect every
server→client prop block — found the same 2, and *that agreement* is the evidence, not either sweep
alone. **Resolve hrefs to strings on the server side of the boundary.**

Earlier eras, all closed and rotated → [bug-log-archive.md](docs/progress/bug-log-archive.md):
**FF-3** (BUG-E2E-001 · BUG-FF3-001/002 · BUG-FF1-008) · **FF-5** (BUG-FF5-001/002 — both passed pgTAP
4240 + Vitest 851 + tsc + lint + `next build`; **only E2E found them**) · **FF-4** (BUG-FF4-001 — a
pre-existing answer-model-v2 bug FF-4 surfaced; ⚠ the obvious one-line fix would break Rule 3 SQL↔TS
evaluator parity, read the entry before touching `buildAnswerMaps`) · **BUG-E2EISO-002** (the
`session_replication_role = replica` FK-CASCADE orphan leak, fixed across seven files behind one shared
`e2e/helpers/purge-forms.ts`; production was never affected — app roles are denied the GUC).

## Test Run Summary

<!-- Most recent gates only, ONE ROW each. The narrative — triage, dispositions, mutation proofs —
     rotates to docs/progress/test-run-archive.md at each §6 Record (full history, Phases 0 →
     Phase 16, already there). -->

| Date | Run | Result |
| --- | --- | --- |
| 2026-08-05 | **MEM follow-ups + BUG-AUTHZ-002 · FULL `e2e:prod`** (RESET+REBUILD, 84 specs / 16 batches) | **970 passed · 1 failed · 0 flaky · 2 did-not-run** — denominator reconciled, no batch gaps, no `reset FAILED`. **2 infra re-runs** (batch 8 `server_dead=1 conn_errors=64`; batch 15 `server_dead=1 conn_errors=22`), both cleared — twin server deaths matching the known `supabase_vector` auth-gateway crash-loop, and both dead batches are login-heavy. **The 1 real failure was MEM2-1, and it was a PRODUCT DEFECT rather than a test bug** → BUG-A11Y-001 in the Bug Log. FUP-BULK-1's `bulk-case-creation.spec.ts` GREEN; the new `technical-direction-referrals.spec.ts` GREEN against the prod build. ⚠ The 2 did-not-run are MEM2-2/2-3, skipped by serial mode after MEM2-1 failed — accounted, not lost |
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
| 2026-08-04 | **MEM W4 · `p0-authz-invariant.sh` `ARM=policy` FULL sweep** (302 door cases + write-path, ~5 h) | **`INVARIANT VIOLATED`** — BLIND set 83, **15 not allowlisted**. ⚠ **none is MEM/W4** (its migration has 0 `create/alter/drop policy`); the 15 are a dated census of every RLS added since 2026-07-18 → FUP-AUTHZ-2. Pruned 4 now-COVERED entries (72→68) |
| 2026-08-04 | **MEM W4 · diff-scoped ARM 1** (4 gates derived from the migration diff, 4m20s) | **3 COVERED · 1 ERROR · 0 BLIND** — `can_read_referral_metadata` / `can_read_referral_phi` / `is_technical_director_of_for` covered; `can_manage_referral_target` unauditable (aborts files) → covered by `295`'s 13/13 mutation audit instead |
| 2026-08-04 | **MEM W1–W4 · FULL `e2e:prod`** (16 batches) | **954 passed · 1 failed · 2 flaky · 5 skips · 962/962 accounted** — denominator reconciled vs `spec-counts.txt`, no batch gaps, no `reset FAILED`; 1 infra re-run (batch 7 server death, 47 setup reds, cleared 61/61). The 1 failure = **FUP-BULK-1**, pre-existing and identical on `main` |
| 2026-08-04 | **MEM W1–W4 · pgTAP on a fresh reset** (+`291` 35, `292` 25, `293` 24, `294` 29) | **155 files / 4736 · PASS** |
| 2026-08-04 | **MEM · mutation audits** — `w1` · `w2` · `w3` · `w4` | **9/9 · 9/9 · 8/8 · 8/8 RED-PROVEN**, every control all-green |
| 2026-08-04 | **MEM W1–W3 · targeted `e2e:prod`** (8 specs, `RESET=1`) — W3 caller migration | **171 passed · 0 failed · 0 flaky · GATE GREEN** |
| 2026-08-04 | **MEM W1+W2 · targeted `e2e:prod`** (7 specs, `RESET=1`) — session bootstrap re-plumb | **160 passed · 0 failed · 1 deliberate skip · GATE GREEN** |
| 2026-08-04 | **MEM · lint · typecheck · Vitest** (lint now chains `lint:memberships-door`) | 0/0 · clean · **901/901** |
| 2026-08-04 | ⚠ **MEM · `p0-authz-invariant.sh` `ARM=floor`** | **`INVARIANT VIOLATED`** — 3 *indicator* doors never-called. NOT attributable to MEM (they read 0 calls with their own suite run ALONE and passing); all 5 MEM doors ARE exercised. Needs a `main` baseline → FUP-MEM-1 |
| 2026-08-04 | **Phase 16 · GATE (declare-green)** — pgTAP on a fresh reset | **151 files / 4623 · PASS** |
| 2026-08-04 | **Phase 16 · GATE** — full `e2e:prod` | **962 of 962 accounted · 0 assertion failures** (2 flaky passed on retry, 12 deliberate skips) |
| 2026-08-04 | **Phase 16 · GATE** — `p0-authz-invariant.sh` `ARM=floor` | **`INVARIANT HOLDS`** — 89 never-called doors, all allowlisted |
| 2026-08-04 | **Phase 16 · GATE** — lint · typecheck · Vitest · real `next build` | 0/0 · clean · **901** · EXIT=0 |
| 2026-08-04 | Phase 16 · tester · BUG-P16-006 fix, fresh reset #1 → the 5 phase16 specs combined | **31/31 GREEN** |
| 2026-08-04 | Phase 16 · tester · **second independent fresh reset** (indicator ids confirmed live to differ from run #1 and from the removed literals) | **31/31 GREEN** |
| 2026-08-03 | Phase 16 · tester · 5 new specs combined (dev server, chromium, workers=1) | **31/31** — core 7 · freshness 9 · hospital 6 · restricted 5 · clone 4 |
| 2026-08-03 | Ad-hoc bug batch · scoped gate (`RESET=1 RETRIES=0`) — phase8-dashboard + both phase22 specs | **93/93 · GATE GREEN** |
| 2026-08-03 | Ad-hoc batch · 4-spec isolation batch (the BUG-E2EISO-001 repro, verbatim) | **80/80 · GATE GREEN** — does not reproduce |
| 2026-08-03 | Ad-hoc batch · `bulk-case-creation` fresh DB, then the **same DB again** (BUG-E2EISO-003 repro) | **8/8 · 8/8** — does not reproduce |
| 2026-08-03 | Ad-hoc batch · pgTAP · Vitest · lint/tsc | **4301/4301** (+ new `270_…` 8/8, mutation-falsifiable) · **873/873** · 0/0 |
| 2026-08-03 | **FF-4 · DECLARE-GREEN** full `e2e:prod` (`87fbdde`, `RESET=1 REBUILD=1`) | **901 passed · coverage 926 of 931 · 0 FF-4 defects** — all 15 batches ran |
| 2026-08-03 | FF-4 · FIRST full `e2e:prod` (`b5c505e`) | 849 passed · batch 4 `reset FAILED` → 66 never ran; re-run standalone **66/66**, no regression |
| 2026-08-03 | FF-4 · tester · `ff4-power-authoring.spec.ts` (prod standalone) | **6/7** deterministic — the 1 was BUG-FF4-001, real |
| 2026-07-28 | **FF-5 · final bar** at `598447e` | pgTAP **4240/4240** · Vitest **851** · `next build` EXIT=0 · full `e2e:prod` **863 passed, 0 real failures** |

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
     docs/reviews/*.md — never restate rationale here, and don't copy it to
     docs/progress/qa-verdicts-archive.md either (redundant with the review file).
     Struck-through rows are superseded rounds, kept only to show a phase looped. -->

| Phase / Feature | Verdict | Date | Report |
| --- | --- | --- | --- |
| **PCI** — Process/Case Integrity audit remediation (ADR 0095) | ✅ APPROVED (r2) | 2026-08-05 | [r2](docs/reviews/process-integrity-and-template-versioning-review.md#round-2--re-review-head-f6c847d) |
| **TV** — Process-Template Versioning (ADR 0096 + Amendments 1.1–1.7) | ✅ APPROVED (r2) | 2026-08-05 | [r2](docs/reviews/process-integrity-and-template-versioning-review.md#round-2--re-review-head-f6c847d) |
| ~~**PCI + TV** — round 1 (BUG-TV-001: dead narrative-slot edit/remove)~~ | ⛔ CHANGES REQUESTED | 2026-08-05 | [review](docs/reviews/process-integrity-and-template-versioning-review.md) |
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

<!-- OPEN backlog only (reviewed at each phase start). Resolved [x] items archived →
     docs/progress/follow-ups-archive.md (full snapshot). -->

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

### ⬛ FUP-MEM-1 — `ARM=floor`'s 3 never-called INDICATOR doors — **RESOLVED 2026-08-05, not a defect**

The baseline this asked for now exists. On the **merged** tree (branch + `main`, 285 migrations) on a
**fresh `supabase db reset`**, `ARM=floor` reports **INVARIANT HOLDS**, and the three doors register
calls: `hospital_indicator_rollup` **5** · `indicator_kpis` **1** · `record_indicator_measurement` **1**.

**The leading hypothesis is DISPROVEN.** This entry proposed that `pg_stat_user_functions` does not
retain stats from the ROLLED-BACK pgTAP transaction for these three. It demonstrably does — the same
rolled-back suite now produces the counts above. ⚠ Note `hospital_indicator_rollup`'s 5 is
**over-determined** (the new `299` suite calls it), so it proves nothing on its own; the evidence is
`indicator_kpis` and `record_indicator_measurement`, which **nothing in this session touches** and
which went 0 → 1.

**The surviving explanation is the date.** The violating run was 2026-08-04 — inside BUG-P15-001's
known date-fragile window for the indicator suite (the 1st–4th of any month), which this entry itself
flagged as a live angle. Today is the 5th. ⚠ Not proven, and cheap to settle: re-run `ARM=floor` on a
1st–4th. Until then, **do not allowlist the three** — the correct fix, if it recurs, is BUG-P15-001's
date fragility, not the floor.

⛔ **The wider lesson:** an `ARM=floor` violation is a claim about the SUITE's coverage, and a
date-fragile suite makes that claim date-dependent. Record the DATE beside any floor result.

_Original entry rotated → [follow-ups-archive.md](docs/progress/follow-ups-archive.md) (2026-08-05)._

### ⬛ FUP-MEM-2 — `assignOrgAdmin` door migration — **RESOLVED 2026-08-05, spec RUN and green (3/3)**

`e2e/platform-org-admin-provisioning.spec.ts` (3 tests) exists. The claim it pins is specific, not
"it works": the action must pass the **platform admin's own uid** as `p_actor`, and `grant_role_impl`
stamps `granted_by = p_actor` — so `granted_by` is the observable separating "the right actor reached
the door" from "something did". Asserting the membership row merely EXISTS would pass in both broken
worlds. Uses a dedicated invitee (never a seed persona — `seed.sql` is a contract ~900 tests read
from), purged by e-mail identity before AND after.

⚠ **Still owed: an actual run.** Writing a spec is not coverage. Folds into the same `e2e:prod` run
FUP-BULK-1 needs.


W3/T3.3 moved `assignOrgAdmin` (`src/lib/platform/actions.ts` — the first-org_admin provisioning
path) off raw `memberships` DML and onto `public.grant_role_for`. **No E2E spec exercises it**: a
sweep of `e2e/` finds nothing driving the platform organisation/org-admin provisioning UI, so the
targeted 8-spec run that validated the other five callers could not have covered this one.

It is not unverified — `293`'s equivalence grid drives the `organization` × `org_admin` cells through
both entry points, and §3.3–3.6 pin the anti-lockout on the service path. But the **wiring** (does the
action pass the right actor and scope from a real request?) is exactly the seam a green DB bar cannot
see — the FF-1 lesson, where three live bugs survived lint + tsc + build + 457 unit + 3919 pgTAP and
only E2E caught them.

**Fix:** either add a spec covering platform org-admin provisioning, or drive the path once manually
before merge and record it. Cheap either way; do it before the full `e2e:prod` declare-green.

### ⬛ FUP-AUTHZ-2 — 15 BLIND authz gates — **RESOLVED 2026-08-05**

All 15 keystoned in `supabase/tests/298_authz_p0_isolation.sql` (**32/32**, DENY + POSITIVE twin
each), **15/15 RED-PROVEN** by `p0b-isolation-mutation-audit.sh` Batch 4, all four controls green.
Verified on a **fresh reset of the merged tree**: full pgTAP **160 files / 4903 / PASS**. Nothing was
allowlisted — these are ordinary tenant-isolation policies. ⚠ The fixtures are pinned to seed ids and
`main` rewrote `seed.sql` by 58 lines between authoring and running; they survived, but that was luck
rather than design.

**The gate that stops the sixteenth is `ARM=census` (ARM 3, ADR 0079 Amendment 3).** ARM 1 asserts
BLIND ⊆ allowlist, and a never-swept gate is in NEITHER set, so it passes vacuously — instantly in
`FROMFINDINGS` mode. That is how 15 policies crossed five phase gates. ARM 3 asserts every live gate
carries a verdict *somewhere*; ~2 s, wired into CLAUDE.md §6 step 1, and proven by deleting a backlog
line (exit 1) and restoring it (holds).

**It has already earned it, twice.** Against the merged catalog it found
`process_template_versions_{select,staff_admin_write}` unswept (FUP-PCITV-1 row 1), and its
ghost-check named five `validate_template_*` signatures ADR 0096 had re-keyed. It also caught **my
own** error: three policy names entered from a commit message instead of the catalog.

⚠ **Two design holes were found in ARM 3 itself and fixed in the same session** — recorded because a
census that looks complete is worse than one that admits its edge:
1. **The verdict had nowhere to land.** ARM 3 reads the committed findings md; the diff-scoped ARM 1
   recipe *ends by discarding that file*. The sweep §6 mandates could not record a verdict, so a
   correctly-swept gate would read UNSWEPT forever. Added a `swept:` section.
2. **Boolean-only domain.** BUG-AUTHZ-002's two doors are `prosecdef` DEFINERs returning `TABLE(...)`,
   so ARM 3 as first written **could not have caught them** — the same enumeration hole it exists to
   close. Domain extended to authenticated-reachable row-returning DEFINERs (**+45**, all registered
   as `gate:` debt); justification is the standing rule that a DEFINER's gate REPLACES RLS.

⛔ **Still outside ARM 3: AUDIT-INVOKER-WRAPPER** (`prosecdef = f` wrappers whose hand-written probe
is the only gate; 130 of 281 `app` DEFINERs are PUBLIC-executable). Named in the backlog header so
ARM 3 holding is not mistaken for evidence about that class.

_Original entry rotated → [follow-ups-archive.md](docs/progress/follow-ups-archive.md) (2026-08-05)._

### ⬛ FUP-BULK-1 — bulk wizard deals to SUSPENDED members — **RESOLVED 2026-08-05**

`listMembers` now carries `isActive`, a TS mirror of `app.is_active`; `activeMembers()` narrows the
bulk wizard's source to members `bulk_create_cases` will accept. **Carried, never pre-filtered** — the
two consumers need opposite answers, since member management is where a suspension gets lifted.
Mutation-proven: removing the suspension term reds 2 of 9 new unit tests. No migration — both columns
already carry a column-level SELECT grant, **re-verified after `main`'s 23 migrations** (the TV phase
did revoke work, so the grant was not assumed).

⚠ **The new embed was probed against PostgREST, not `tsc`** — the change adds two columns to a select
string, which is exactly the shape of BUG-TV-001 and BUG-RCA-001. `scripts/probe-embeds.mjs` resolves
it 200/OK. ⚠ **That tool reports `42501` for 228 of 286 sites** (it runs as `anon`), and a 42501 means
PostgREST stopped at permissions and never resolved the embed — those sites are **unvalidated, not
validated**. Read its output accordingly; the service-role replay is what actually proves a site.

**Owed:** the ~22% red is a probabilistic E2E failure, so only a full `e2e:prod` run can confirm it is
gone. Not yet run.

_Original entry rotated → [follow-ups-archive.md](docs/progress/follow-ups-archive.md) (2026-08-05)._

### ⬛ FUP-MEM-3 — the DT referral plane's product callers — **COMPLETE 2026-08-05**

**Built:** the hospital-detail **appointment panel** (appoint / replace titular / deputies / revoke,
flag-gated) and the send-wizard **target picker**. The titular affordance is *Substituir*, not *Adicionar*
— `appoint_technical_director` revokes and grants in one transaction, and a plain grant over a seated
office is refused (HC0G4), so an "add" button would be an affordance that cannot work. Destination is
modelled as the sum type it is; the action mirrors the RPC's two-sided XOR rather than asking "is a
commission set?", since the one-sided form admits the "both" case.

⚠ `p_target_commission_id` is sent as an **explicit null** on the DT arm. The generated Args type says
`string`; the RPC requires NULL there. The parameter cannot be given a DEFAULT — it is argument 2, and
Postgres refuses a default on a parameter followed by mandatory ones — so expressing the sum type in
the signature needs a **parameter reorder**. Recorded at the call site, not smuggled in.

✅ **The inbox landed the same day** → FUP-MEM-3b below. The office can now be addressed, read AND
acted on; `295` §4's RPC-surface claim is finally wired to a product path.


W4 ships no frontend by plan, so `create_referral_draft`'s new `p_target_hospital_id` parameter has no
caller anywhere in `src/`: nothing in the product can create a `target_type = 'technical_director'`
referral. The flag is ON, so the *audience* half is fully live — a DT would see such a referral if one
existed — but none can exist.

This is the **declared-param-with-no-caller** blind spot in its exact known shape: the branch behind it
passes tsc, lint, unit, pgTAP **and** E2E, because no product code path reaches it. `295` drives the
RPC directly (§2.1–2.7 including the same-hospital refusal), so the DOOR is proven; the **wiring** is
not, and cannot be until the UI exists.

Also un-wired by the same decision: the four `src/lib/org/actions.ts` appointment actions
(`appointTechnicalDirector`, `appointTechnicalDirectorDeputy`, and their revokes) are exported and
typed but called from no component.

**Fix:** carry both into the DT UI phase — a send-wizard target picker (committee | direção técnica) and
a hospital-manage appointment panel — and add the E2E specs there. Until then, treat "DT referrals work"
as proven at the RPC surface only.

### ⬛ FUP-MEM-3b — the DT referral inbox — **BUILT 2026-08-05**

Two routes under `/o/[org]/direcao-tecnica` (list + detail) — ORG level, because the office has no
commission and every commission-scoped gate refuses a DT by construction. Root landing gained a DT
branch placed AFTER the commission branches, so it only changes the outcome for someone who would
otherwise hit "sem acesso" — which is what a pure DT got.

**The detail page is not a fork of the 540-line commission page.** Four of its panels are unreachable
for a DT BY GATE — internal notes (needs the note's own committee), assignments (commission-scoped),
case links/forward (need a case board), draft affordances (a DT can never author a referral). The
office's surface is genuinely smaller.

⚠ **`next build` passed and the page still crashed on first load** — `hrefFor` was a FUNCTION prop
into a `"use client"` component (BUG-QI-001's shape). Typecheck, lint and a real production build all
reported green on code that could not render. Now a string (`hrefBase`), with the reason on the prop.

E2E `e2e/technical-direction-referrals.spec.ts` **5/5**: wizard → sum type; DT lands on the inbox;
titular drives `sent → received`; **deputy** drives `received → accepted` (D1 asserted, not assumed);
foreign-org isolation. Manually walked once too, DB-confirmed.

⚠ **Still owed:** a DT who is ALSO a commission member lands on their commission and has no nav link
to the inbox. Reachable by URL; a nav entry for the dual-hat case is open.

### ⬛ FUP-A11Y-1 — `useFieldIds` derives the DOM id from `useId()`. ✅ DONE 2026-08-05.

BUG-A11Y-001 was fixed by breaking three ties by hand; the CLASS remained (`name` doubled as the DOM id,
so the next two forms sharing a field name on one page reproduced it silently). `useFieldIds` now returns
`` `${name}-${useId()}` `` as the control id and keeps `name` as the form key alone. The three hand-written
`id:` ties on `/admin` are deleted — one mechanism, not two. The `id` option survives, re-purposed: it PINS
an id for a control something addresses, and its JSDoc says so.

**Live-DOM verified on `/admin`**, the page that carried the three collisions: 0 duplicate ids, and all 7
labels resolve to a control **inside their own `<form>`** (the defect was cross-form resolution, so
`sameForm` is the assertion that matters, not mere uniqueness). No console/hydration error — `useId` is
SSR-stable by construction.

⚠⚠ **IT SHIPPED A REGRESSION, AND ONLY THE E2E GATE CAUGHT IT — BUG-A11Y-002.** `ethics-e2-procedure.spec.ts`
FLOW-7 (the required keyboard-only vote flow) tabs until `i.id === 'ethics-vote-value'`. With a generated
id that predicate never matches, `reachedSelect` is false, and FLOW-8…12 then never run because the file is
serial. **My pre-flight sweep looked for `locator('#id')` and quoted `#id` strings — so its boundary was a
SYNTAX, and this is an id EQUALITY comparison.** Same failure as the memory that says *if your enumeration's
boundary is a filename, it's wrong*: here it was a selector shape, and the real property is "anything that
depends on a hook-produced DOM id". The correct sweep — id equality, `getAttribute('id')`,
`getElementById`, `toHaveAttribute('id'|'for')`, and every `tabUntil` predicate — finds **exactly one** such
site, now fixed at the SOURCE with `{ id: "ethics-vote-value" }` rather than by editing the spec (§6 step 2:
engineers never edit specs to pass). Nothing in lint, typecheck, `next build`, 963 unit tests or the live
`/admin` DOM check could see it.

⚠ **The prior entry's safety evidence was wrong on its central claim.** It said "nothing reads the literal
ids — the only hardcoded `-description`/`-error` strings, in `charter-form.tsx`, do not come from the hook."
In fact **fourteen** files build ids by hand (`assessment-form`, `case-access-panel`, `file-correction-control`,
`reopen-case-button`, `correct-submission-button`, `group-block`, `matrix-grid`, `reference-picker`,
`risk-matrix-picker`, `repeating-group-block`, `input-item` ×3 sites, …) and E2E hardcodes 11 `#id`
selectors. The change was safe anyway — but for a DIFFERENT reason, established by enumeration rather than
by trusting the note: **none of those ids is hook-produced.** The hand-built ones are self-consistent pairs
in components that never call the hook, and the wizard's addressed ids (`item-<id>-opt-<i>`, the radio
`name`) come from `fieldScope`, not from `controlProps.id`. Every spec that touches a hook id READS it off
the DOM first (`getAttribute('id')`, splitting `aria-describedby`) and only then builds `#${id}` — so they
bind behaviour, not spelling.

⚠ **`useId()`'s output shape is a moving target and the code now says so.** React 18 emitted `:r0:` — `:` is
not a legal CSS ident — and 19.2.4 emits `_r_0_`. The hook strips to the plain token, because
`required-marker.test.tsx` and `e2e/ff3-validations.spec.ts` both string-build `#${id}` from
`aria-describedby`. **My first comment asserted the wrong format** (`«r0»`) and was corrected against a live
probe, not from memory.

**Pinned by `src/components/ui/field.test.tsx` (4 cases), mutation-proven per arm:** reverting to
`options.id ?? name` reds the duplicate-id case AND the label-resolution case. ⚠ The CSS-ident case is
**deliberately recorded as NOT pinned to the `replace()`** — React 19.2.4's own format already satisfies it,
so deleting that line leaves the test green. It binds the emitted shape, which is what a React upgrade would
break. Saying so beats letting a future reader mistake it for a mutation-proven guard.

`rules-of-hooks` under `--max-warnings=0` is the hook-position gate: it errors on a hook in a non-component
function, so a green `npm run lint` across all **118** call sites IS the proof, and no call site needed
moving. 963 unit tests green.

### ⬛ FUP-AUTHZ-3 — the 45 row-returning DEFINER doors are swept. ✅ DONE 2026-08-05.

The blocker was harness work, and that is what this was: **`supabase/tests/mutation/p0-authz-rowdoor-audit.sh`**,
a THIRD sweep joining ARM 1 (ADR 0079 **Amendment 4**). The boolean sweep opens a gate by rewriting its
body to `select true`; a function returning `TABLE(...)` has no boolean to open. This one opens the
door's **identity guard** — `if <cond> then` → `if false then` — so the door returns the rows it would
have withheld, then reads the suite exactly as the other two do. Wired into ARM 1's BLIND union and
ARM 3's verdict sources.

**Result over all 45: 32 COVERED · 1 BLIND (allowlisted, measured backstop) · 1 ERROR · 11 UNSUPPORTED.**
Nine came back BLIND; **`supabase/tests/300_rowdoor_gate_keystones.sql`** (18 assertions) moved **eight**
to COVERED — proven by re-running the sweep, not by review.

⚠ **The ninth stayed BLIND, and that is the finding worth keeping.** `get_case_meeting_links`'s guard
is backstopped by a second gate inside its own query (`app.can_reach_meeting`). **Measured, not argued:**
with the guard rewritten to `if false then` the outsider **still reads 0** while the legitimate
staff_admin still reads 1 — so no row-count assertion through that door can ever red on the guard.
Allowlisted as a genuine backstop with that experiment as the justification; the assertion stays but
now says in the file that it is **not** a keystone. Writing nine assertions, watching eight red, and
assuming the ninth held would have been the *"7 keystones that could not fail"* error committed inside
the file written to end it.

⚠ **`open_attachment` is ERROR and deliberately NOT upgraded.** Opening its guard lets an unauthorized
principal reach `log_audit_access`, which RAISES → `208_attachments.sql` aborts (planned 50, ran 36) →
run shape ≠ baseline. Something clearly noticed (`228_ethics_e1.sql` failed a real assertion), so in
substance it is covered — but the shape rule exists to stop verdicts awarded by judgement. It owes a
clean verdict.

**11 UNSUPPORTED stay in the backlog, and the word is load-bearing.** Their gate is an identity
conjunct *inside* the query, not a statement guard, so there is nothing to rewrite — the harness
returns **no verdict**, which is neither BLIND nor COVERED. ARM 3 got a row-door-specific extractor
that filters on the verdict column precisely so an UNSUPPORTED row cannot be mistaken for a sweep
result and let a door leave the census on the strength of the harness admitting it could not test it.

⚠ **My first harness reported 0 guards in ALL 45 doors — a complete false negative that reads exactly
like an honest finding** ("no door has an openable guard" is coherent). The tag regex was an E-string
copied from the boolean sweep, which returns NULL when evaluated directly. Caught only by dry-running
the detector against the catalog and comparing to a hand classification of the bodies. **A detector
that finds nothing must be proven able to find something before its silence is believed.** The same
class bit again within the hour: ARM 3's new extractor used `-F' *\| *'`, where awk treats `\|` as
alternation matching the empty string, and printed nothing — ARM 3 would have stayed green while never
parsing the report at all.

⚠ **And the first sweep had a SOUNDNESS bug, not just a broken case.** `\yif\y[^;]*?<authz>[^;]*?\ythen\y`
could span from an OUTER `if … then` across an inner guard (plpgsql puts no `;` between them),
collapsing both into one `if false then`. `verify_audit_chain` failed to compile — **the lucky
outcome**. The same swallow in a door without an `elsif` chain still compiles, opens a condition that
is *not* an authorization decision, and reports whatever the suite then did as a verdict about the
gate: **a false COVERED manufactured by the audit itself.** Blast radius was established by diffing
both regexes over every body — exactly 1 of 45 — and the corrected re-run changed exactly that one
verdict (ERROR → COVERED), confirming the analysis empirically.

**Verified after:** `ARM=census` HOLDS (436 live gates, all carrying a verdict); the ARM 1 offender set
is **byte-identical to HEAD** (the 15 pre-existing FUP-AUTHZ-2 items) — this work introduced zero new
un-keystoned gates. pgTAP 161 files / 4921 tests green.

### ⬛ FUP-AUTHZ-4 — pruned the 6 now-COVERED entries from the BLIND allowlist. ✅ DONE 2026-08-05.

The PCI+TV phase keystoned the six `process_template_{phases,narratives,outcomes}_{select,staff_admin_write}`
policies but left their allowlist lines in place, so ARM 1 reported them as "no longer BLIND — prune".

**Executed in the mandated order**, which was the whole content of the item: a **diff-scoped ARM 1** over
exactly those six (baseline Files=160, Tests=4903) returned **COVERED ×6**, each attributed to
`supabase/tests/297_process_template_versioning.sql` → those verdicts were **hand-merged** from the subset
report into `docs/reviews/authz-door-audit-findings.md` (BLIND table → COVERED table) → *only then* were
the six allowlist lines and the six `swept:` backlog lines deleted, in the same change. The subset report
was discarded with `git checkout --` as Amendment 1 requires.

**Both arms verified after:** `ARM=census` **HOLDS** (436 live gates, all carrying a verdict — the six now
carry theirs from the findings md, which is what makes deleting the `swept:` lines safe), and ARM 1's
"no longer BLIND — prune" note is **gone**.

⚠ **ARM 1 still exits non-zero — 15 offenders, and they are NOT from this change.** Proven, not assumed:
the offender set computed from `git show HEAD:` versions of the findings + allowlist is **byte-identical**
to the set after the prune. They are the known FUP-AUTHZ-2 fifteen (the 2026-07-27 out-of-phase ETH
hotfix's write policies). Recomputing the before/after sets is cheap and is the only thing that separates
"pre-existing" from "I broke it" — a `tail` of the output cannot.

The `swept:` section is now **empty**, and its header carries the ordering trap in full: prune the
allowlist first and ARM 1 fails for an already-fixed condition; delete a `swept:` line with no findings
verdict and ARM 3 reports the gate as an unswept newcomer.

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
