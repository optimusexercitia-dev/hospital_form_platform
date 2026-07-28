# PROGRESS.md — Project Status Tracker

> Single source of truth for project status. Update IMMEDIATELY when state
> changes. The lead owns the Phase Status table; each teammate owns their own
> rows in the other sections. Never report status that isn't written here.

## Phase Status

| Phase | Name                          | Status | Build | Tests | QA | Human ✓ | Completed | Commit |
| ----- | ----------------------------- | ------ | ----- | ----- | -- | ------- | --------- | ------ |
| 0     | Scaffolding & Environment     | ✅ complete | ✅ | ✅ 5/5 | ✅ APPROVED | ✅ 2026-06-11 | 2026-06-11 | `d64281e` |
| 1     | Schema, Auth & RLS            | ✅ complete | ✅ | ✅ 88/88 | ✅ APPROVED | ✅ 2026-06-12 | 2026-06-12 | `691662f` |
| 2     | Authentication & App Shell    | ✅ complete | ✅ | ✅ 49/49 + load | ✅ APPROVED + re-review | ✅ 2026-06-12 | 2026-06-12 | `5773b4a` |
| 3     | Admin Area & User Management  | ✅ complete | ✅ | ✅ 43/43 | ✅ APPROVED | ✅ 2026-06-12 | 2026-06-12 | `cb28ef3` |
| 4     | Form Builder & Versioning     | ✅ complete | ✅ | ✅ 8/8 | ✅ APPROVED | ✅ 2026-06-12 | 2026-06-12 | `d32e7e9` |
| 5     | Wizard Filling, Conditional Sections & Resume | ✅ complete | ✅ | ✅ 63/63 | ✅ APPROVED | ✅ 2026-06-13 | 2026-06-13 | `8418991` |
| 6     | Section Sign-offs & Submission Lifecycle | ✅ complete | ✅ | ✅ 70/70 | ✅ APPROVED | ✅ 2026-06-13 | 2026-06-13 | `94566f2` |
| 7     | Multi-Phase Cases             | ✅ complete | ✅ | ✅ 81/81 | ✅ APPROVED | ✅ 2026-06-13 | 2026-06-13 | `28e0405` |
| 8     | Dashboards & Submissions Browser | ✅ complete | ✅ | ✅ 106/106 | ✅ APPROVED | ✅ 2026-06-14 | 2026-06-14 | `a50e0e0` |
| 9     | Deployment                    | 🔜 not started | – | – | – | – | – | – |
| 10    | Meetings                      | ✅ complete | ✅ | ✅ 141/141 | ✅ APPROVED | ✅ 2026-06-15 | 2026-06-15 | `5e2780c` |
| 11    | Interviews                    | ✅ complete | ✅ | ✅ 152/152 | ✅ APPROVED | ✅ 2026-06-15 | 2026-06-15 | `3d7376b` |
| 12    | Case Timeline                 | ✅ complete | ✅ | ✅ 169/169 | ✅ APPROVED | ✅ 2026-06-16 | 2026-06-16 | `0feaa9a` |
| 13    | Audit Trail                   | ✅ complete | ✅ | ✅ 195/195 | ✅ APPROVED | ✅ 2026-06-18 | 2026-06-18 | `a8739b5` |
| 14    | Patient-Safety / NSP (Triage, RCA & CAPA, 14a–14d) | ✅ complete | ✅ | ✅ E2E 65/65 + pgTAP 516 | ✅ APPROVED | ✅ 2026-06-18 | 2026-06-18 | 14a `984e787` · 14b–d `c4e20b3` |
| 14e   | **Centralized Attachment Substrate** — polymorphic `attachments` core + tiered PHI buckets + audited single-door PHI read; folds in case/meeting/interview docs. = phase F2 of the [Pre-Pilot Foundations Program](docs/plans/pre-pilot-foundations-program.md). ADR [0063](docs/decisions/0063-centralized-attachments-substrate.md) → [f2-attachments.md](docs/progress/f2-attachments.md). | ✅ **complete (F2)** | ✅ | ✅ pgTAP **1957** · F2 E2E **24/24** (audited PHI door proven) · full **590p/24f** (F2-owned 14/14 green; 0 F2 reg, ≈ F1 baseline) | ✅ **APPROVED** (0B/0M/3m/4i, all closed) [review](docs/reviews/phase-F2-review.md) | ✅ 2026-07-11 | 2026-07-11 | `37057c0` local · **remote ✓ 2026-07-12 (pilot reset)** |
| 15    | Quality Indicators *(built 1st of 15 → 17 → 16 — ADR [0057](docs/decisions/0057-indicators-doc-control-replan.md))* | ✅ complete | ✅ | ✅ 12/12 (prod-standalone) | ✅ APPROVED (3 MINOR fixed) [review](docs/reviews/phase-15-review.md) | ✅ 2026-07-06 | 2026-07-06 | merge `26187dc` (pushed; **remote deployed via pilot reset ✓ 2026-07-12**) |
| 16    | Standards Crosswalk & Readiness *(builds 3rd, after 17; pilot follows)* | 🔜 not started | – | – | – | – | – | – |
| 17    | Controlled-Document Lifecycle *(pre-pilot — builds 2nd, before 16; ADR 0057)* | ✅ complete | ✅ (tsc/lint 0 · Vitest 206) | ✅ pgTAP 47/47 (full 1717) · phase E2E 14/14 · full regr 588p/10 env-only (0 Phase-17 reg) | ✅ APPROVED (3 MINOR cleared) [review](docs/reviews/phase-17-review.md) | ✅ 2026-07-06 | 2026-07-06 | merge `1152d75` (ff-only from `feat/phase-17-controlled-documents`; pushed) |
| 17-v2 | Controlled-Document Redesign *(FE rebuild + 4 gaps + anglicization + new-version wizard + description; ADR 0081)* | ✅ complete | ✅ (tsc/lint 0 · Vitest 369) | ✅ tester 25/25 · pgTAP `201` 29/29 · e2e:prod triaged-green (0 redesign reg) | ✅ APPROVED (0/0/0/4 INFO) [review](docs/reviews/document-control-redesign-review.md) | ✅ 2026-07-21 | 2026-07-21 | ff→`main` (branch `feat/document-control-redesign`) |
| 18    | Self-Assessment & Internal Audit | 🔜 not started | – | – | – | – | – | – |
| 19    | Surveyor Access & Evidence Export | 🔜 not started | – | – | – | – | – | – |
| 20    | Notifications & Escalation *(**pulled pre-pilot** 2026-07-12 — ADR [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md); built as S1·N per ADR [0076](docs/decisions/0076-notifications-pilot-scope.md); [detail](docs/progress/s1-substrate.md))* | ✅ complete | ✅ | ✅ pgTAP `226` 52/52 (full 2255) + `notifications.spec.ts` 8/8 | ✅ APPROVED (0B/0M/3 MINOR) [review](docs/reviews/s1-n-notifications-review.md) | ✅ 2026-07-13 | 2026-07-13 | `aac7c1c` |
| 21    | Committee Charters & Cadence *(**pulled pre-pilot**; ADR [0080](docs/decisions/0080-committee-charters-cadence-model.md); [detail](docs/progress/ch-charters-cadence.md))* | ✅ complete | ✅ | ✅ E2E 10/10 + pgTAP 260/261/262 = 11/29/10 | ✅ APPROVED r1 [review](docs/reviews/phase-CH-review.md) | ✅ 2026-07-20 | 2026-07-20 | BE `458aedb`…`13750b1` · FE `d982401`+`5d366db` · `14c4381`/`cb6a671` |
| 22    | Inter-Committee Case Referrals | ✅ complete | ✅ | ✅ 29/29 + full 276/326 | ✅ APPROVED 2026-06-21 | ✅ 2026-06-21 | 2026-06-21 | `768b9f1` |
| 23    | Patient Identity & Cross-Committee Linkage (MRN/encounter) | ✅ complete | ✅ | ✅ E2E 15/15 + pgTAP 10/10 sweep | ✅ APPROVED 2026-06-22 | ✅ 2026-06-22 | 2026-06-22 | `da4d127` |
| MT    | **Multi-Tenancy** — organizations → hospitals → commissions; `platform_admin` vs `org_admin`; RLS rewrite + 3-tier audit + multi-org PHI guard. ADR [0041](docs/decisions/0041-multi-tenancy-organizations-hospitals.md). | ✅ complete | ✅ | ✅ pgTAP 1029 + E2E 292/0 | ✅ APPROVED 2026-06-25 [review](docs/reviews/multitenancy-review.md) | ✅ 2026-06-25 | 2026-06-25 | `ee35299…82ea157` |
| NSP-per-org | **NSP-per-org** — bind the PQS roster + every PHI door to an organization; restores NSP + referral modules under multi-tenancy. ADR [0042](docs/decisions/0042-nsp-per-org.md); design [nsp-per-org-design.md](docs/progress/nsp-per-org-design.md). | ✅ complete | ✅ | ✅ pgTAP 1102/1102 + full E2E 421/0 | ✅ APPROVED A [core](docs/reviews/nsp-per-org-a-review.md) + B [whole](docs/reviews/nsp-per-org-b-review.md) | ✅ 2026-06-25 | 2026-06-25 | `b0e15f4…9c53035` |
| result-rec | **Result-based phase recommendation** — `recommend_when` combinable answer/result group; recommend from an earlier phase's result; suggestion-only, zero evaluator drift. ADR [0043](docs/decisions/0043-phase-result-based-recommendation.md) → [result-rec.md](docs/progress/result-rec.md). | ✅ complete | ✅ | ✅ pgTAP 1122 + Vitest 164 + E2E 431/0 | ✅ APPROVED 2026-06-26 [review](docs/reviews/result-rec-review.md) | ✅ 2026-06-26 | 2026-06-26 | `6c5baeb…` · ✅ remote re-baselined 2026-07-01 |
| processless-cases | **"Sem processo" (process-less cases)** — template-less case + optional offered-outcome set + optional PHI; 2 coordinator-gated DEFINER RPCs, no new RLS shape. ADR [0044](docs/decisions/0044-processless-cases.md) → [processless-cases.md](docs/progress/processless-cases.md). | ✅ complete | ✅ | ✅ pgTAP 1153 + E2E 8/8 + full 439/0 | ✅ APPROVED 2026-06-30 [review](docs/reviews/processless-cases-review.md) | ✅ 2026-06-30 | 2026-06-30 | `cdf26d0` · ✅ remote re-baselined 2026-07-01 |
| form-model-norm | **Form data-model normalization** — `form_items.options` JSONB → normalized `form_item_options` + `answer_selected_options`; evaluator byte-for-byte unchanged via `app.answer_map`; pre-launch squash + full reset. → [form-model-normalization.md](docs/progress/form-model-normalization.md). | ✅ complete | ✅ | ✅ T-1 green | ✅ APPROVED 2026-07-01 [review](docs/reviews/form-model-normalization-review.md) | ✅ 2026-07-01 | 2026-07-01 | squash `ffc0ea5`; baseline `20260620000000`; merged → main |
| answer-model-v2 | **Answer-Model v2 + forward-compat** — uniform answer row + typed scalar cols + instance-ready answer-key scaffolding + question defaults; evaluator unchanged (Rule 3). ADRs [0045](docs/decisions/0045-answer-model-v2.md) · [0046](docs/decisions/0046-forward-compat-form-capabilities.md) → [answer-model-v2.md](docs/progress/answer-model-v2.md). | ✅ complete | ✅ | ✅ pgTAP 1205 / Vitest 176 / E2E 6/6 + 456p (0 reg) | ✅ APPROVED 2026-07-01 [report](docs/reviews/answer-model-v2-review.md) | ✅ 2026-07-01 | 2026-07-01 | baseline `20260620000000` · ✅ remote re-baselined 2026-07-01 |
| ad-hoc-narratives | **Ad-hoc Case Narratives** — coordinator adds a narrative to an OPEN case (`add_ad_hoc_narrative` DEFINER RPC + `case_narratives.is_ad_hoc`); reverses ADR 0032 D7 for open cases. ADR [0047](docs/decisions/0047-ad-hoc-case-narratives.md) → [ad-hoc-narratives.md](docs/progress/ad-hoc-narratives.md). | ✅ complete | ✅ | ✅ pgTAP 1219 · Vitest 176 · E2E 5/5 + 461p (0 reg) | ✅ APPROVED 2026-07-01 [review](docs/reviews/ad-hoc-narratives-review.md) | ✅ 2026-07-01 | 2026-07-01 | branch `feat/ad-hoc-case-narratives` |
| user-reg | **User Registration & Identity Management** — org_admin registers users (professional category + optional council credentials + home hospital/matrícula), verify+activate via invite, searchable org directory + full per-user management (committees/roles, deactivate/suspend/reactivate/resend); **real `is_active` enforcement**; drops DOB (LGPD). Detail → [user-registration.md](docs/progress/user-registration.md); ADR [0048](docs/decisions/0048-user-registration-identity.md). | ✅ complete | ✅ | ✅ feat 12/12 · pgTAP 1257 · full 467p/10-contam (0 reg) | ✅ APPROVED | ✅ 2026-07-02 | 2026-07-02 | `117319d` |
| hospital-admin | **Phase A — Hospital-admin tier** — `hospital_admin` (org_admin-mirrored, hospital-scoped) across ~60 sites; 4-tier audit; per-commission committee titles → [detail](docs/progress/hospital-admin-tier.md) | ✅ complete | ✅ | ✅ 38/38 · pgTAP 1454 · 0 Phase-A reg | ✅ APPROVED [review](docs/reviews/hospital-admin-tier-review.md) | ✅ 2026-07-03 | 2026-07-03 | `99e2d09` |
| DB-hardening | **Pre-pilot DB hardening (Waves 1+2)** — 2026-07 external-audit remediation (C-1…C-6/H-8 critical + P/D perf & data-model); W3+4 → foundations pgm → [W1](docs/progress/pre-pilot-hardening-wave1.md) · [W2](docs/progress/pre-pilot-hardening-wave2.md) | ✅ complete | ✅ | ✅ pgTAP 1644 · Vitest 206 · 0 reg | ✅ APPROVED [W1](docs/reviews/pre-pilot-hardening-wave1-review.md)·[W2](docs/reviews/pre-pilot-hardening-wave2-review.md) | ✅ 2026-07-05 | 2026-07-05 | W1 `68b393b` · W2 `a2a7fab` · merged `27d9e5f` |
| flexible-forms | **Flexible-Forms Foundation (F3)** — item_type reserves group/repeating_group/matrix/risk_matrix/reference; new evaluator operators; schema-only repeating groups (write RPCs → FF-1). ADR [0060](docs/decisions/0060-flexible-forms-foundation.md) → [detail](docs/progress/f3-flexible-forms.md) | ✅ complete | ✅ | ✅ pgTAP 2023 · Vitest 356 · 0 F3 reg | ✅ APPROVED [review](docs/reviews/phase-F3-review.md) | ✅ 2026-07-12 | 2026-07-12 | `94f03c3` (remote ✓) |
| case-participants | **Case-Participants E0 (F1)** *(ADR [0064](docs/decisions/0064-case-subject-generalization-participants.md))* — `participants` + `case_participant_roles` + `case_participants` (typed identity); `professional_profiles` (Class-2); re-keys `case_patient` → `patient_identifiers(participant_id)`; `case_types`. Amends Rules 12+2 → [detail](docs/progress/f1-case-participants.md) | ✅ complete | ✅ | ✅ pgTAP 1913 · E2E 54/54 · Vitest 294 | ✅ APPROVED [review](docs/reviews/phase-F1-review.md) | ✅ 2026-07-10 | 2026-07-10 | `ef66b0a`+`6805bd9` (remote ✓) |
| pre-pilot-foundations | **Pre-Pilot Foundations Program** *(umbrella — ADR 0060+0063+0064+DB-hardening W3/4)* — F0 gate → F1 participants → F2 attachments → F3 flexible-forms → F-cleanup → pilot reset → [plan](docs/plans/pre-pilot-foundations-program.md) | ✅ complete — F0–F-cleanup ✅; pilot reset verified 2026-07-12 | – | – | – | ✅ 2026-07-13 | 2026-07-13 | see F0–F-cleanup rows |
| nsp-per-hospital | **Phase B — NSP-per-hospital + `nsp_org_admin`** — re-keys the PQS roster + every PHI door org→hospital; `nsp_org_admin` (zero-PHI rollups); `nsp_coordinator`; `dispose_referral_phi`. ADR [0052](docs/decisions/0052-nsp-per-hospital.md) → [detail](docs/progress/nsp-per-hospital.md) | ✅ complete | ✅ pgTAP 1446 | ✅ feature 32/32 · prod-PHI 86/86 · 0 Phase-B reg | ✅ APPROVED [review](docs/reviews/nsp-per-hospital-review.md) | ✅ 2026-07-03 | 2026-07-03 | 9 commits → [detail](docs/progress/nsp-per-hospital.md) |
| administrativo | **Administrativo delegated-capability role** — per-commission finite capability menu (schedule/create/assign/view) without full staff_admin; flag ON 2026-07-08. ADR [0061](docs/decisions/0061-administrativo-delegated-role.md) → [detail](docs/progress/administrativo.md) | ✅ complete | ✅ | ✅ pgTAP 50/50 · E2E 10/10 · 0 reg | ✅ APPROVED [review](docs/reviews/administrativo-review.md) | ✅ 2026-07-08 | 2026-07-08 | `75c903f`+`3956b32`→`1010f07`; flag `5a6c668` |
| f-cleanup | **F-cleanup — residual DB-hardening** — D3 result-engine → FK junctions, D10 touch triggers, D8 forward-FK lock, D11 status-key anglicization. ADRs [0068](docs/decisions/0068-result-engine-fk-junctions.md)/[0069](docs/decisions/0069-status-key-anglicization.md) → [detail](docs/progress/f-cleanup.md) | ✅ complete | ✅ | ✅ pgTAP 2100 · E2E 51/51 · 0 reg | ✅ APPROVED [review](docs/reviews/f-cleanup-review.md) | ✅ 2026-07-12 | 2026-07-12 | merged `5f81286` (remote ✓) |
| referrals-v2 | **Referrals v2 — Dialogue & Governance** *(pre-pilot expansion of Phase 22; ADR [0037](docs/decisions/0037-inter-committee-case-referrals.md) Amendment 1)* — two-way dialogue thread (R1) + triage/SLA, resolution lifecycle, assignments/links, notes/receipts/redaction (R2–R5); extends (never contradicts) the Phase-22 core. `case_referrals` flag OFF until pilot. Detail → [R1](docs/progress/rv2-r1-referrals.md) · [R2–R5](docs/progress/rv2-r2-r5-governance.md). | ✅ complete | ✅ | ✅ R1 E2E 40/40 + R2–R5 E2E 29/29 · pgTAP `150_referrals` 217/217 | ✅ APPROVED [R1](docs/reviews/rv2-r1-referrals-review.md) + [R2–R5 r2](docs/reviews/rv2-r2-r5-review.md) | ✅ 2026-07-19 | 2026-07-19 | R1 `33dbc09` · R2–R5 `223ed17` (ff→main `a61aae3`) |
| interviews-v2 | **Interviews v2 — Sessions + Reporting/Confidentiality** *(pre-pilot revision of Phase 11; ADR [0070](docs/decisions/0070-interview-data-model-v2-sessions.md); [detail](docs/progress/iv2-interviews.md))* — `interview_sessions` 1:N (hard-cut of the 5 scheduling cols), `interview_category`, non-enforcing `confidentiality_level`; enforcement + participant-registry wiring landed at ETH·E1. Extends (never contradicts) the Phase-11 core. | ✅ complete | ✅ | ✅ pgTAP `121` 60/60 (full 2287) + phase E2E 13/13 | ✅ APPROVED [review](docs/reviews/iv2-interviews-review.md) | ✅ 2026-07-14 | 2026-07-14 | `b015815`+`da7c219`+`77daa90` (`00a93dd`) |
| pre-pilot-release | **Pre-Pilot Release Scope Expansion** *(umbrella — 12 initiatives pulled into the pilot release 2026-07-12; ADR [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md); plan [pre-pilot-release-scope-expansion](docs/plans/pre-pilot-release-scope-expansion.md))* — S0 design gate → S1 substrate (N/MEM/SUP) → S2 cores (RV2·R1/IV2/AI) → S3 ETH·E1 (releases the m2 gate) → S4 ETH·E2/RV2 R2–R5/CH → S5 ETH·E3. Only Phases 18–19 stay post-pilot. Pilot follows this whole block + Coolify deploy + origin push. | 🏗️ **in progress — AUTHZ ✅ COMPLETE (Gate 1 + Gate 2, 2026-07-17); then S4 (now ✅ complete 2026-07-20)** (branch `pre-pilot-release-s0`, **local ahead of origin**; **S0 ✅** + **S1 substrate ✅** [→ [s1-substrate](docs/progress/s1-substrate.md)]; **S2 cores ✅ ALL 2026-07-14**: **IV2 ✅** [`phase(11-v2)`] · **RV2·R1 ✅** [`phase(rv2-r1)`] · **AI ✅** [`phase(ai)`]; **S3 · ETH·E1 ✅ COMPLETE 2026-07-14** [`phase(E1)`; **m2 gate RELEASED**; → [eth-e1-access-spine](docs/progress/eth-e1-access-spine.md)]; **✅ AUTHZ COMPLETE 2026-07-17** (ADR [0078](docs/decisions/0078-authorization-capability-model.md); own gate unit) — **Gate 1** (Stage A/B: `_case_caps` resolver + `case_access → case_access_grants` hard cut) + **Gate 2** (Stage C meeting-confidentiality · F1 referral split · N1 NSP-PHI · G-cleanup) both **human-approved**; qa APPROVED re-review [review](docs/reviews/authz-gate-2-review.md) (P0 + 3 MAJOR behaviourally closed, mutation-proven; MINOR-1 rides noted). **✅ S4 COMPLETE 2026-07-20 = ETH·E2 (07-18) · RV2 R2–R5 (07-19) · CH (07-20). **S5 ETH·E3a ✅ COMPLETE 2026-07-27** (last pre-pilot build track; E3b deferred/Phase 16). ▶ Remaining: the pilot deploy (origin push + Coolify + remote `db push`) — Phases 18–19 stay post-pilot.**) | – | – | – | – | – | – |
| ff-program | **Flexible-Forms Program (FF-1…FF-5)** *(umbrella — five feature phases pulled pre-pilot 2026-07-27; ADR [0086](docs/decisions/0086-flexible-forms-pre-pilot.md); plan [flexible-forms-program](docs/plans/flexible-forms-program.md))* — FF-1 repeating groups (instance RPCs + instance-aware evaluation) → FF-2 matrix/risk → FF-3 validation engine (+`required_if` + operator authorability) → FF-5 entity reference (participant+commission+user lanes, PHI door) → FF-4 power authoring (library + dynamic defaults; calculated fields stay post-pilot). Each phase: own ADR (0087+ at authoring) + flag OFF-until-gate + Phase Gate. **All five gate the pilot deploy.** | ▶ **1 of 5 complete** — **FF-1 ✅** (ADR [0087](docs/decisions/0087-ff1-repeating-groups.md) + Amendment 1; flag `repeating_groups` **ON**; [record](docs/progress/ff-1-repeating-groups.md)). **FF-2 next — not started, PO-held 2026-07-27** | ✅ FF-1 | ✅ FF-1 — E2E 9/9 prod-build · pgTAP 3925 · Vitest 490 | ✅ FF-1 **APPROVED** r2 [review](docs/reviews/phase-FF-1-review.md) | ✅ FF-1 2026-07-27 | FF-1: 2026-07-27 | FF-1 `20260828000000`–`…000900` |
| **ETH·E1** | **Ethics Access Spine — m2 gate release** *(ADR [0072](docs/decisions/0072-ethics-access-spine.md))* — makes the F1 subject layer safe for real ethics data + releases the m2 gate (`case_participants`+`case_types` ON); respondent-exclusion + recusal hard-denies; `explicit_grants_only` visibility; 7-value confidentiality + doc ceiling; no new UI → [detail](docs/progress/eth-e1-access-spine.md) | ✅ complete | ✅ Vitest 369/369 | ✅ pgTAP 91f/2537 · E2E 13/13+1 skip · e2e:prod triaged | ✅ APPROVED (R3) [review](docs/reviews/phase-ETH-E1-review.md) | ✅ 2026-07-14 | 2026-07-14 | 14 commits `167b269`…`02bd2db` (remote deferred) |
| **ETH·E2** | **Ethics disciplinary procedure** *(S4; ADR [0073](docs/decisions/0073-ethics-procedure-model.md); 0078-reconciled)* — intake → admissibility → allegations/findings → decisions → quorum votes → issue → `participants_only` hearings → appeals; + 5 coordinator controls + coordinator-gated "Processo ético" tab → [detail](docs/progress/eth-e2-procedure.md) | ✅ complete | ✅ | ✅ E2E 20/20 · pgTAP `253`–`259` | ✅ APPROVED [review](docs/reviews/eth-e2-review.md) | ✅ 2026-07-18 | 2026-07-18 | `ada4c97`…`2adb169` |
| **ETH·E3a** | **Ethics terminology/UX surfacing** *(S5; ADR 0064 D4 / [0072](docs/decisions/0072-ethics-access-spine.md) / [0073](docs/decisions/0073-ethics-procedure-model.md))* — case-type terminology + auto-derived procedural `case_events` timeline + RLS-scoped ethics dashboard; **last pre-pilot build track** (E3b → Phase 16) → [detail](docs/progress/eth-e3a-surfacing.md) | ✅ complete | ✅ | ✅ E2E 21/21 · pgTAP `266`–`269`/3852 | ✅ APPROVED r2 [review](docs/reviews/phase-E3a-review.md) | ✅ 2026-07-27 | 2026-07-27 | `e61fa3c`…`38db4c9` |
| **AUTHZ** | ADR 0078 Gate 1 — capability model | ✅ **COMPLETE — human-approved 2026-07-16** (Stage A/B: M1–M6 + A2 `_case_caps` resolver + A4 policy-narrowing + A5 + U1/U2 exclusion perimeter + `case_access → case_access_grants` hard cut). Lead-verified equivalence 196 cells → 2 = intended PHI closure (LOST=0/GAINED=0); pgTAP 2981/2981. State + lessons → [handoff](docs/progress/authz-handoff.md) · [units](docs/progress/authz-gate1-units.md) | ✅ | ✅ pgTAP 2981 · e2e 0-regress | ✅ APPROVED [review](docs/reviews/authz-b-series-review.md) | ✅ 2026-07-16 | 2026-07-16 | `87858f7` (local) |
| **AUTHZ · Gate 2** | ADR 0078 Gate 2 — Stage C (meeting confidentiality) · F1 (referral split) · N1 (NSP PHI arm) · G1 (cleanup) | ✅ **COMPLETE — human-approved 2026-07-17.** qa APPROVED re-review (P0 + 3 MAJOR behaviourally closed, mutation-proven; MINOR-1 rides noted). Version-drift audit: local `next` had drifted to 16.2.9 vs the 16.3 lockfile ⇒ BUG-PROD-ACTIONS + the "~18–27 flaky baseline" were env drift, not Gate-2 defects. Detail → [review](docs/reviews/authz-gate-2-review.md) · [handoff](docs/progress/authz-handoff.md) · [backend-state](docs/backend-state.md) | ✅ | ✅ pgTAP 772/772 authz · e2e green | ✅ APPROVED (re-review) | ✅ 2026-07-17 | 2026-07-17 | `f07341f` |
| **case-corrections** | **Case Correction Lifecycle** — phases + narratives: response-chain revisions (`supersedes_id` case arm), first-class `case_correction_requests` (kind correction/addendum/void, classification, designated corrector, staff_admin approval, self-approval flagged), terminal `voided`, `reopen_case` door, append-only `case_narrative_revisions` (retires `reopen_narrative`), `current_response_id` pointer. Flag `case_corrections`. Plan → `~/.claude/plans/agreed-tender-pixel.md`; ADR [0085](docs/decisions/0085-case-correction-lifecycle.md). | ✅ **complete + DEPLOYED** | ✅ | ✅ tester 24/24 + full prod E2E feat 7/7 (reds triaged infra/baseline; T-2 clean-stack 76/76) | ✅ APPROVED (0P0/0MAJ/2min) [review](docs/reviews/case-corrections-review.md) | ✅ 2026-07-24 | 2026-07-24 | `6b50abc` → main+origin; **remote `db push` ✅ (flag ON, backfill verified live)** |
| **case-custom-fields** | **Case Custom Fields** — template-defined, **non-PHI** administrative descriptors on cases (the M&M "Número da Declaração de Óbito" case); `process_template_custom_fields` → snapshot `case_custom_field_values`, captured atomically in "Novo caso" via `create_case_from_template`, editable + audited; PHI boundary is a fill-time warning, not a schema guarantee (D4). Flag `case_custom_fields` **ON permanently**. ADR [0083](docs/decisions/0083-case-custom-fields.md) → [detail](docs/progress/case-custom-fields.md). | ✅ **complete + merged** | ✅ lint/tsc/vitest 369 | ✅ E2E 8/8 (3× clean) · pgTAP `188` 28/28 · full `e2e:prod` 735p (feat 8/8 on prod build) | ✅ APPROVED (0 P0 · 0 MAJOR · 1 MINOR cleared · 2 INFO) [review](docs/reviews/adr-0083-case-custom-fields-review.md) | ⚠ **unrecorded** — see detail | 2026-07-23 | merge `c857193` · flag ON `fde76d3` |
| **bulk-case-create** | **Bulk Case Creation ("Múltiplos casos")** — one atomic `bulk_create_cases` RPC that **composes existing doors** (`create_case_from_template` + assignment + the audited case-patient door) to deal N cases across committee members in a single transaction; balanced-deal grid wizard; selectable PHI columns (E1) with **no new PHI store** — Rule 12's three-module invariant untouched. Flag `cases_bulk_create` **ON permanently**. ADR [0084](docs/decisions/0084-bulk-case-creation.md) → [detail](docs/progress/bulk-case-creation.md). | ✅ **complete + merged** | ✅ build/tsc/lint/vitest 390 | ✅ E2E 8/8 prod-standalone · pgTAP 29/29 | ✅ APPROVED (4 MINOR/OBSERVATION, none blocking; fixed `b948c9f`) [review](docs/reviews/bulk-case-creation-review.md) | ⚠ **unrecorded** — see detail | 2026-07-23 | flag ON `255a8e9` |
| **AUDIT-DOOR-BLINDNESS · P0** | ADR 0078 §7.14 — door-level re-audit + a standing keystone-coverage invariant; **blocked S4** | ✅ **complete — human-approved 2026-07-18** (ff→main, local) — opened 2026-07-17, branch `fix/authz-audit-door-blindness`. Pre-req eol defect fixed (`a32be9c`: `*.sql text eol=lf` — a CRLF checkout was aborting `db reset` on `20260801000000`; clean 146/146 reset restored, **pilot reset unblocked**). Population (live catalog): **294** auth-reachable `public` DEFINER doors · 231 `app` (internal) · **212** RLS policies / 125 tables. **FIX-A/B/C ✅ + INVARIANT HOLDS** (2026-07-18): 50 mutation-proven keystones (250/251/252), BLIND=72 all-allowlisted, never-called floor OK, baseline PASS 3288. Commits `a32be9c`→`f783f37`. Record → [authz-p0-door-blindness.md](docs/progress/authz-p0-door-blindness.md). | ✅ | ✅ 50 KS mut-proven · pgTAP 3288 · invariant HOLDS | ✅ APPROVED [review](docs/reviews/authz-door-audit-p0-review.md) | ✅ 2026-07-18 | 2026-07-18 | ff→main |

> **Accreditation & Quality-Governance Track (13–21)** — planned 2026-06-17; specs in
> [PHASES.md](PHASES.md) (§ Accreditation track), rationale in ADR
> [0028](docs/decisions/0028-accreditation-governance-roadmap.md). **13 = Audit Trail** and
> **14 = Patient-Safety/NSP (Events, Triage, RCA & CAPA — sub-phases 14a–14d)** are the agreed first two. Each phase is feature-flagged, individually
> testable, and gated by §6. **Deployment plan (revised 2026-07-05, ADR [0057](docs/decisions/0057-indicators-doc-control-replan.md)):
> remaining pre-pilot phases build in order 15 → 17 → 16** (P0 core, now incl. document
> control), **plus the twelve initiatives pulled pre-pilot 2026-07-12 (ADR
> [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md)): Phases 20–21, Referrals v2,
> Interviews v2, Ethics E1–E3, action-items satellites + cross-link, §6.1, supersession engine —
> pilot after that whole block**; Phase 9 stays pending until then (also validates the ADR 0009
> prod-auth gap), and **Phases 18–19** follow the pilot (**20–21 pulled pre-pilot**). Phase 15/17 specs revised against the
> post-hardening platform (option-`code` derived config, hybrid taxa, two-tier CAPA hook,
> hospital rollups, approver read arm) — see the ADR + accreditation-track.md. This track is
> built ahead of Phase 9 (same convention as Phases 10–12).

Status legend: 🔜 not started · 🏗️ in progress · 🧪 testing · 🔍 QA review · ⏸️ awaiting human approval · ✅ complete · ❌ blocked

## Current Phase Tasks

<!-- Lead recreates this table at the start of each phase. At the §6 Record step the
     completed phase's task detail is archived to docs/progress/phase-N.md (or a
     feature-named file) and replaced here by a one-line pointer (CLAUDE.md §7). -->

_No active build phase._ **FF-1 (Repeating Groups) ✅ COMPLETE 2026-07-27** — flag
`repeating_groups` **ON**; record → [ff-1-repeating-groups.md](docs/progress/ff-1-repeating-groups.md).
**FF-2 (Matrix & Risk Matrix) ✅ COMPLETE 2026-07-27** — ADR
[0089](docs/decisions/0089-ff2-matrix-risk-matrix.md), QA APPROVED r2, human-approved, flag
`matrix_fields` **ON** (gate flip `20260830001200`); record →
[ff-2-matrix-risk-matrix.md](docs/progress/ff-2-matrix-risk-matrix.md).

### 🏗️ FF-3 — Validation Engine (`item_validations`) · IN PROGRESS (started 2026-07-28)

ADR [0090](docs/decisions/0090-ff3-validation-engine.md) **accepted** — PO rulings taken
2026-07-28: rule vocabulary = the plan's set · coverage = scalars + repeating-group children
per-instance (matrix cells **out** of v1) · `error` blocks **submit only**, server-side.
Migration window `20260901000000`+ · SQLSTATEs from **`HC0P9`** (live high-water `HC0P8`) ·
pgTAP **274+** (highest today `273`). Worktree `ff/flexible-forms-program`, branch of the same
name, fast-forwarded to `main` @ `5e6b62d`; **216 == 216** at phase start.

> 🔎 **Catalog finding that changed the scope (ADR 0090 ruling 1).** The plan lists "group
> cardinality" as an FF-3 `rule_type`. It is **already shipped by FF-1** — `minInstances` in
> `app.response_required_complete`'s group arm, `maxInstances` in `add_group_instance` (the only
> `prosrc` in the catalog mentioning it), both via `app.item_cardinality(form_items.config, …)`.
> Adding it as a rule would create a second source of truth for one bound. **FF-3 ships six new
> rule types, not seven**, and the seventh is recorded as already-satisfied rather than dropped.

| # | Task | Owner | Status |
| - | ---- | ----- | ------ |
| B1 | Schema wave — `rule_type` allowlist CHECK + `item_type` coverage (a TRIGGER, not a CHECK — a CHECK cannot subquery `form_items`) · `form_items.required_if` (+ `input_vs_display` arm incl. `reference`) · flag seeded **OFF**, `seed.sql` flips it ON for local/E2E | `backend` | ✅ `20260901000000` |
| B2 | Door parity — `set_item_validations` DEFINER writer · targeted SELECT arm · `staff_admin` FOR-ALL write arm · `app.copy_version_children` validations block, same wave. Grant stays SELECT-only so K9 holds by privilege | `backend` | ✅ `20260901000100` |
| B3 | Evaluator pair — `app.eval_validation` + `evalValidation` in `src/lib/queries/validations.ts` + 47 golden vectors, **plus a real drift DETECTOR** (the pgTAP file embeds the fixture bytes; Vitest asserts they parse equal — FF-1 QA's INFO-4) | `backend` | ✅ `20260901000200` |
| B4 | Authority — `required_if` in **both** arms (visibility wins) · `HC0P9` gate in `submit_response` · `get_response_validation_errors`. The gate and the read path share `app.response_validation_errors`; the legacy `assert_item_bounds` lane was extracted into it so the list can never omit what the gate blocks on | `backend` | ✅ `20260901000300/400` |
| B5 | Operator authorability — `app.is_valid_condition` widened to the four F3 operators; the `value` requirement relaxed for the two unary ones BY NAME (not globally) | `backend` | ✅ `20260901000500` |
| B6 | pgTAP `274_ff3_validations.sql` — **70 assertions**, all 8 ADR-0090 keystones, each mutation-proven (23 mutations run, red output recorded). Re-pins: `209` §B **+4** (the `required_if` freeze on containers/display/`reference`, with a positive twin) and `272` **§S +3** (a TARGETED respondent READS validation ROWS — 274 §C can only prove the policy EXISTS, which ETH·E1 established is a different claim). Also **`20260901000600`**: publish-time validation of `required_if` | `backend` | ✅ **4138** tests PASS |
| F1 | Builder — rules editor (type/config/severity/pt-BR message) + `required_if` authoring via the condition builder + the new operator pickers | `frontend` | ✅ **`5c8c14b` + `2254227`** — lint 0/0 · tsc · Vitest 697 · `next build` |
| F2 | Wizard — inline error/warn from the TS twin, per instance; submit blocked on error; warn badges in review | `frontend` | ✅ **`609ae63`** + marker fix **`5b17b4e`** — lint 0/0 · tsc · Vitest **725** · `next build` |

> **F1 ✅ (`5c8c14b` + `2254227`).** Rules editor as a separate dialog off the block card
> (`ValidationsDialog` + `ValidationRulesEditor`), mirroring `MatrixConfigDialog` for the same two
> contract reasons: the writer is keyed on an existing `form_items.id` that "add" mode lacks, and the
> write is **REPLACE and wholesale** with no `code` to match on — so one piece of state owns the whole
> list, seeded from `item.validations`, mounted only while open, with a destructive save surfaced
> explicitly ("N regras serão removidas") instead of just looking like a shorter list. The type picker
> offers only what `isValidationRuleAllowed` permits, and the card resolves the parent's **TYPE** (not
> its `isChild` boolean) so `unique_within_group` is never offered inside a plain `group`.
> `required_if` authoring rides a third `ConditionBuilder` context, `required`, emitting a **single
> bare** condition — a third context rather than a boolean prop on a shared control. The existing
> `required` checkbox wire contract is untouched; the interaction is explained in copy.
>
> **Unary operators now offered on EVERY target type**, after backend fixed both publish assertions.
> Re-verified through `public.validate_visible_when` on a **cloned draft** — a SECTION `visible_when`
> *and* an ITEM `required_if`, both `is_empty`/`is_not_empty` on a **choice** target, the exact arm
> that raised `42883` before — plus a negative control proving a bogus operator is still refused
> (`23514`). Rolled back; nothing mutated. `contains`/`not_contains` remain **deliberately unpickered**
> (lead ruling (A)); the reason is recorded at the picker so it does not read as an oversight.
>
> **F2 ✅ (`609ae63`).** Rules + `required_if` evaluate through the TS twin as a **separate pass**
> beside the existing required/bounds validators — an optional answer-map param on the old signatures
> would have failed **open** (a caller that forgot it stops enforcing `required_if` while still looking
> validated). Feedback is live, derived during render; safe because an empty value is satisfied on both
> sides of the mirror, so an untouched field never accuses anyone. Placement is per instance on the
> existing `${instanceId}:${itemId}` key, so a violation in repetition 2 leaves repetition 1 alone;
> `unique_within_group` takes peers from each peer's **own** instance map, never the overlay, or a blank
> row would collide against an unrelated top-level answer under the same `question_key`. `warn` never
> uses the `error` channel — that channel drives `aria-invalid`, and marking an input invalid for a rule
> the server accepts misinforms assistive tech; warnings are a polite live region inline and a labelled
> badge list in review. An `HC0P9` refusal places `validationErrors` per field/instance **and navigates
> to the first one**; live errors merge UNDER the server's so an authoritative refusal is never
> overwritten by a recomputed one (that would hide a real SQL↔TS disagreement). Author text is rendered
> as TEXT everywhere (Rule 7).
>
> **Mutation-proven guards (4 mutations, file restored byte-for-byte each time).** Coverage filter
> neutralized → 5 red · the every-rule pre-flight loop reverted to its first-draft-only bug → 2 red ·
> the instance dimension dropped from the error key → 3 red · the empty-instance prune removed → 1 red.
> ⚠ That last one was **VACUOUS on first write**: a bounds rule is satisfied by an empty value under
> *both* readings, so it proved nothing. Rewritten around `required_if` — the only rule that fires ON
> emptiness — plus a positive twin so it cannot be vacuous from the other direction either.
>
> ✅ **D1–D5 all landed and independently re-verified** (not taken on backend's word): the pure module
> is genuinely server-free (`next build` is the proof), `Item.requiredIf`/`Item.validations` arrive
> FK-hinted, `requiredIf` rides the item FormData, `validationErrors` is on both submit paths, and
> `itemValidationsEnabled()` exists. The **P0 I filed in `20260901000700` is fixed** — all four call
> sites now pass the operator and the previously-`42883` version validates clean.
>
> ✅ **Marker fix — lead-ruled in scope, done (`5b17b4e`). The frontend surface is now FINAL for `tester`.**
> An item mandatory only through `required_if` showed no marker and announced itself as **optional** —
> the harmful direction of the same argument that kept `warn` off `aria-invalid`. `InputItem` gains
> `requiredNow`, resolved per instance and feeding the SAME `required` variable the static flag fed, so
> the marker's **DOM shape is unchanged** (no selector moves) and only its input became dynamic;
> omitting the prop falls back to `item.required`, so read-only/review/sign-off contexts are untouched.
>
> ⚠ **`aria-required` did not exist anywhere in the wizard before this** — `required` drove only the
> visual asterisk, so required-ness was never announced for ANY item, statically-required ones
> included. That was a pre-existing a11y gap the ruling surfaced. Added via `useFieldIds` (the five
> single-control fields) and on the two group fieldsets. **One arm would have been missed silently:**
> `DateTimeItem`'s TIME branch hands its a11y attributes to `TimeField` individually instead of
> spreading `controlProps`, so `aria-required` alone would have been dropped there — routed through
> react-aria's `isRequired` instead. Found by enumerating all seven controls rather than trusting the
> spread (the "every sibling arm" rule, applied to a render tree instead of a policy set).
>
> Effective required-ness is resolved ONCE, on `RuleFeedback.requiredNow`, in the walk that already
> computes it — recomputing it in the render tree would be a second implementation of the same
> question, free to disagree with the one that blocks submit. **Mutation-proven:** driving the marker
> from the static flag (the exact defect fixed) turns **5** red, including the two that assert the
> marker independently of the error — a required field that IS answered must still be marked, so one
> assertion cannot cover both. Restored byte-for-byte.

> ✅ **Boundary audit — matrix + risk_matrix `required_if` (`45563c7`).** The lead found the marker
> still static on the two render paths outside `input-item.tsx`. It was the **visible symptom of a
> deeper gap**: both walks gated on `isInputItem`, which is deliberately FALSE for the matrix types
> (their answer is not a scalar in `answers.value`), so the two types were skipped **outright** —
> `required_if` on a matrix was never evaluated client-side at all. Meanwhile
> `form_items_input_vs_display` permits it on both (verified from `pg_constraint`, quoted below) and
> `app.response_required_complete` calls `app.item_is_required` with no `item_type` filter, so it
> genuinely blocks submit. Both walks now gate on `isAnswerableItem`; presence uses the ROW-COMPLETE /
> both-halves reading via a shared `itemAnswered`, so `required_if` cannot acquire a second notion of
> "answered".
>
> **The enumeration, derived from the CHECK rather than from a file** — 10 item types permit
> `required_if`; the 5 excluded ones are forced `required_if IS NULL`:
>
> | `item_type` | renders via | reads effective required-ness |
> |---|---|---|
> | `multiple_choice` · `dropdown` · `checkbox` | `ChoiceGroup` / `DropdownItem` / `CheckboxGroup` (`input-item.tsx`) | ✅ |
> | `free_text` · `short_text` · `number` | `FreeTextItem` / `ShortTextItem` / `NumberItem` (`input-item.tsx`) | ✅ |
> | `date` | `DateTimeItem` date branch | ✅ |
> | `time` | `DateTimeItem` **TIME** branch | ✅ (hands a11y attrs over individually — would have dropped `aria-required` alone) |
> | `matrix` | **`matrix-grid.tsx`** | ✅ **(this fix)** |
> | `risk_matrix` | **`risk-matrix-picker.tsx`** | ✅ **(this fix)** |
> | `reference` · `group` · `repeating_group` · `section_text` · `image` | — | n/a — CHECK forces `required_if IS NULL` |
>
> **An a11y correction the lint gate caught, and it was right:** `aria-required` is invalid on
> `role="radio"`, and `matrix-grid`'s wrapper is deliberately `role="group"` (one radio group **per
> row**), which does not support it either. Required-ness is announced through the group's
> **description** instead — said once for the whole grid, driven by the effective value.
> `risk-matrix-picker`'s wrapper IS a `radiogroup`, so `aria-required` is valid there.
>
> **Mutation-proven twice, files restored byte-for-byte:** reverting both walk gates to `isInputItem`
> → **6 red**; reverting all three render fallbacks to the static flag → **11 of 15 red** in the new
> render-level suite, the 4 survivors being exactly the "falls back when the prop is absent" cases
> that must stay green. ⚠ **That render suite exists because the walk-level assertions CANNOT fail if
> a component goes stale** — the same vacuity trap as the prune test, caught before shipping this time.
>
> ⚠ **A NINTH path found, deliberately NOT changed — needs a lead ruling.**
> `src/components/responses/wizard/answer-summary.tsx:98` renders the marker from static
> `item.required`, and the review screen uses it, so a `required_if`-mandatory field shows **unmarked
> on review** while marked during fill. Two reasons I did not just fix it: (a) it cannot mislead into a
> blocked submit — review is only reachable after every section passed `handleNext`, so all required
> fields are answered by then, making this an inconsistency rather than a trap; (b) `AnswerSummary`
> has **six other consumers** — `submission-detail-view`, `phase-answers-readonly`,
> `instance-answers-readonly`, `review-and-sign` and two tests — all **historical read-only views of
> SUBMITTED responses**, where static `item.required` is arguably the *correct* display (the record was
> already accepted, and there is no live answer map). Threading effective required-ness there would put
> a live-fill concept onto historical dashboard views. The optional-prop-with-fallback shape already
> supports fixing only the review call site; it is a scope call, not a guess I should make.

> ⛔ **STILL OWED — a real click-through. Live UI verification was IMPOSSIBLE from this worktree.**
> The Browser preview tool's session is bound to the **primary checkout** (its processes run from
> `hospital_form_platform
ode_modules` + `...\.next`, not from `worktrees/ff/…`), it holds a cached
> `previewId`, and it ignored a `-p 3100` launch config across four stop/start cycles — so `:3000`
> serves the primary checkout on `main`, which does not contain FF-3 at all. Verifying there would have
> been worthless *and* misleading, and starting a server via Bash is disallowed by the role brief, so
> the escalation is deliberate rather than a skipped step. What WAS verified instead: the DB seam
> (gate acceptance of the exact emitted shape with negative controls; both publish arms end-to-end on
> a cloned draft), `next build` (the client/server boundary), and the mutation proofs above. **The
> untested surface is the rendered interaction itself** — the shield button, the dialog's REPLACE
> save, inline error/warn placement, and the HC0P9 navigation. `tester` owns it; FF-1's lesson is that
> exactly this seam is where a green bar misses three live bugs.

> 🔴 **THREE FINDINGS from B1–B6, all fail-OPEN, none catchable by tsc/lint/unit/build.**
>
> 1. **`app.validation_rule_allowed` returned NULL, not false**, for a top-level item
>    (`p_parent_item_type = NULL` → `NULL and true` = NULL). Every caller wrote
>    `if not allowed(...)`, and `not NULL` is NULL, so the `if` never fired and a forbidden
>    rule/item pair was **accepted**. Same family as FF-2 defect 1 — a three-valued predicate
>    read as if it were two-valued. Caught by keystone **B8** on its first run
>    (`caught: no exception`). Fixed with an outer `coalesce(..., false)`; `app.eval_validation`'s
>    regex arm and `app.item_is_required` were hardened the same way.
> 2. **`validate_visible_when` never validated `required_if`.** A top-level item whose
>    `required_if` points at a repeating-group child resolves that key against the top-level map,
>    where it is absent → the item is **silently never required**. Nothing raises, nothing logs,
>    and a test that only asks "does an unmet `required_if` block" passes. Fixed in
>    `20260901000600` by generalising the item loop over both conditional columns; keystones
>    K1–K3.
> 2b. **One VACUOUS keystone of my own, caught by the mutation sweep.** An earlier `I4`
>    claimed the `not app.instance_is_empty(...)` filter on the peer-map query, and stayed GREEN
>    with that filter removed. It cannot be observed: an empty instance holds no non-null value,
>    so it can never be a peer. Replaced by an `I4`/`I5` pair (empty → 0 violations; re-fill the
>    same value → 2 again) that a peers mutation does turn red, and the unobservable filter is
>    now recorded as unobservable in the file instead of being falsely claimed.
>
> 3. **`HC061` is raised by TWO unrelated conditions** — `app.assert_item_bounds` (a field bound)
>    and `app.compute_case_phase_result` (a MANUAL phase with no result) — and `submitResponse`
>    mapped it to *"Selecione o resultado da fase"*. Reachable by ORDINARY USE: type 2 characters
>    into a `minLength: 5` field and you are told about a phase result. Pre-existing; fixed here
>    (prefer the DB message) because FF-3 extracted that very lane. **Adjacent, NOT fixed:
>    `HC0N5`** (FF-1 min-instances) still falls to `MESSAGES.generic` in both submit switches —
>    same class as BUG-FF1-006, reported for the lead's call.
>
> ⚠ **ADR 0090 §6's parity table is wrong on one cell**, corrected against `pg_policies`: the
> matrix tables carry **no** write policy (one SELECT policy each; their boundary is the
> SELECT-only GRANT + the DEFINER door). `form_item_options` is the outlier — it holds a full DML
> grant, so for it the FOR-ALL policy *is* the boundary. FF-3 took the **stricter** shape: both
> arms added per the ADR, grant left SELECT-only, and keystone **C5** pins both facts.

**Lead notes.** Contract-first: `backend` posts the typed stubs for
`get_response_validation_errors` + the TS validation twin before `frontend` starts F1/F2.
File ownership — `backend` owns `src/lib/queries/**` incl. the new evaluator module and
`conditions.ts`; `frontend` owns `src/components/forms/**` + `src/components/responses/**`.

> ⚠ **Session-limit interruption, 2026-07-28 (lead record).** All three teammates were terminated
> mid-work by an API session limit. HEAD at interruption: **`3a2d927`**; everything through F2 is
> committed and unaffected. **Backend died immediately before applying a mutation proof**, so the
> live catalog could not be trusted — the lead ran `supabase db reset` + the full pgTAP suite to
> restore catalog truth from migrations. Nothing was lost; two coherent partial diffs survived
> uncommitted:
> - `src/components/ui/field.tsx` — `frontend`'s `aria-required` plumbing on `useFieldIds`
>   (backward-compatible: omitted → attribute absent). **Caller wiring + the dynamic visual marker
>   are unfinished.**
> - `supabase/tests/274_ff3_validations.sql` — `backend`'s **§M mixed-severity keystone** (plan
>   78 → 81), asked for by `frontend`. Its rationale is the sharp one: narrowing the read path to
>   `severity='error'` already reds E4, and truncating it reds I2/I5, but **no existing assertion
>   sees a MIXED set** — E2's state holds only errors, E4's only warns — so a refactor suppressing
>   warns *while errors exist* passes every one of them. Same class as the `20260901000700` P0.
>   **Written but not yet mutation-proven or committed.**
>
> **Outstanding at interruption:** (1) the dynamic required marker + `aria-required` wiring
> [`frontend`, lead-ruled in scope]; (2) §M's Mutation A/B/C proofs + commit [`backend`];
> (3) **the FF-3 E2E spec — not started** [`tester`; no spec file exists yet]. The rendered
> interaction therefore remains unverified, which is gate step 2's whole purpose.

> 🔴 **FF-3 inherits two obligations from FF-2, both binding.**
> 1. **`form_item_validations` is missing the targeted and correction policy arms** (deliberately
>    unfixed while write-inert). **FF-3's writer landing is when that stops being true** — the same
>    hand-forward FF-1 gave FF-2 for its P0-1 correction-copy obligation, which FF-2 then found had
>    already bitten three surfaces.
> 2. **The door-parity rule:** a new door or policy must carry **every** arm its sibling carries,
>    proven as a **table**, not asserted. FF-2 missed it four times in one phase, each in a different
>    direction. Keystone: `272_ff2_door_parity.sql`.
>
> Also worth reading before FF-3 writes its evaluator: FF-2's **`app.item_required_satisfied`** is now
> the single required-presence predicate for **every** item type platform-wide, and FF-2's QA showed a
> keystone over it needs **both** directions (`select true` must turn the positive arm red, not just
> the blocking one).

### 🔒 Case-type assignment — ETH·E3a O-1 resolved (2026-07-27, out-of-phase fix)

**Found:** a sweep of `.rpc()` call sites vs `pg_proc` showed `p_case_type_id` declared by
`create_case` + `create_case_from_template` and passed by **nobody**. It was the only writer
of `cases.case_type_id`, so every app-created case landed NULL — which made each `case_types`
row's `default_visibility_policy` **inert**. Ethics cases created through the UI were born
`commission_default` (whole-commission visible) instead of `explicit_grants_only`. `seed.sql`
claimed that hole was closed; it was not. Proven live, both directions.

**Root cause:** not a regression — E3a deferred "where does a case get its type" as Open
decision O-1 and the call was never made. ADR 0064 D4's channel
(`process_templates.case_type_id`) was never built.

**Fixed** → ADR [0088](docs/decisions/0088-case-type-assignment-channel.md): template declares
(`process_templates.case_type_id` + `set_template_case_type` + org-consistency trigger `HC0F7`),
`create_case_from_template` inherits, process-less dialog picks, org-admin CRUD at
`/o/[org]/manage/tipos-de-caso`. Migrations `20260829000000` + `20260829000100`.
**Local only — remote `db push` NOT done.** Green: tsc 0 · scoped eslint 0/0 · Vitest 490 ·
`next build` ✅ · 5-case live proof (inherit / process-less / cleared-no-regression /
cross-org `HC0F7` / non-admin `42501`). **Not yet E2E-tested or QA-reviewed.**

> ⚠ `npm run lint` (whole-repo) currently reports ~45.8k problems from the nested
> `worktrees/ff/flexible-forms-program/.next/` build output — `eslint.config.mjs` ignores
> `.claude/**` but not `worktrees/**`. **Pre-existing and unrelated**; needs a one-line ignore.

### ✅ FF-2 — Matrix & Risk Matrix · COMPLETE 2026-07-27 (ADR 0089)

QA **APPROVED** (r2, after CHANGES REQUESTED at r1) · human-approved · flag `matrix_fields` **ON**
(gate flip `20260830001200`) · merged to `main`. **Remote `db push` NOT done** (local only, as every
S-phase — user-gated). **36 commits · 16 migrations `20260830000000`–`20260830001500`.**

**Full record → [ff-2-matrix-risk-matrix.md](docs/progress/ff-2-matrix-risk-matrix.md)** (the four PO
rulings, all 13 defects with repro/fix, the door-parity sweep, every mutation proof, the gate triage).
Reviews: [r1](docs/reviews/ff-2-review.md) · [r2](docs/reviews/ff-2-review-r2.md).

**Final bar:** pgTAP **139 files / 4061 / PASS** (clean reset) · Vitest **593/593** · lint **0/0**
(eslint + the new `[--var]` guard) · `next build` ✅ · migrations **216 == 216** · `e2e:prod` green
for FF-2.

**Shipped:** radio-grid cell contract (`UNIQUE (answer_id, row_id)`), `weight` on both axis tables
with **server-derived** `risk_score`, `required` = every row answered (flat **and** per-instance),
axis `code`s immutable by trigger; builder axes/bands editors; wizard grid + severity×likelihood
picker; sign-off, submission **and** dashboard cell-unit/risk surfaces (both follow-ups were pulled
into gate scope by PO ruling, so the phase ships its full ADR scope).

> ⚠ **Two rules this phase paid for, binding on FF-3 / FF-5.**
> 1. **A new door or policy must carry EVERY arm its sibling carries** — proven as a table, not
>    asserted. Missed **four times in one phase**, each in a different direction (a DEFINER gate
>    *stricter* than the RLS it replaced; a writer door narrower than the `answers` policy; SELECT
>    policies missing the corrector arm; axis tables missing the targeted arm). Keystone:
>    `272_ff2_door_parity.sql`.
> 2. **`form_item_validations` (FF-3) and `answer_references` (FF-5) are missing the targeted and
>    correction arms**, deliberately unfixed while write-inert. **Their writers landing is when that
>    stops being true** — handed forward the way FF-1 handed FF-2 its P0-1 correction-copy obligation.


### 📋 Remaining pre-pilot work

Expanded 2026-07-12 — ADR [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md); **re-expanded
2026-07-27 — ADR [0086](docs/decisions/0086-flexible-forms-pre-pilot.md)** (Flexible-Forms FF-1…FF-5 pulled
pre-pilot). **FF-1 ✅ and FF-2 ✅ are COMPLETE (both 2026-07-27)**; this is the standing backlog —
remaining pre-pilot = **FF-3 → FF-5 → FF-4** (three gated phases), the FUP-AI-1 workstream, then the
**pilot deploy**.

· **S4 ✅ COMPLETE 2026-07-20** — ✅ **ETH·E2** (2026-07-18) + ✅ **Referrals v2 R2–R5** (2026-07-19) + ✅ **CH** Charters (Phase 21, 2026-07-20 — ADR [0080](docs/decisions/0080-committee-charters-cadence-model.md) / [detail](docs/progress/ch-charters-cadence.md)), all → `main`
· ✅ **S5 ETH·E3a COMPLETE 2026-07-27** — terminology/UX + auto-derived procedural timeline + ethics dashboard (E3b still needs Phase 16) → [eth-e3a-surfacing.md](docs/progress/eth-e3a-surfacing.md)
· Phase 16 — Standards Crosswalk (🔜 **deferred** 2026-07-11, needs replanning; blocks E3b)
· **BUG-AIF-001 / FUP-AI-1** (PO-directed pre-pilot; own workstream, not yet started)
· ✅ **BUG-PROD-ACTIONS — RESOLVED (environment drift, not a code defect).** `node_modules/next` had silently drifted to **16.2.9** (the pre-BUG-AIF-001 version) while `package.json`/lockfile pinned **16.3.0-preview.5**; `npm ci` → 16.3 + a `REBUILD=1` full run collapsed the 21–31s action-hang **and** the "~18–27 prod flaky baseline" to ~1. Confirmed in the Gate-2 version-drift audit (`2698696`); PO-approved at the Gate-2 close. Full investigation detail → [bug-log-archive.md](docs/progress/bug-log-archive.md).
· ✅ **P0 · AUDIT-DOOR-BLINDNESS — RESOLVED 2026-07-18, human-approved.** The door-level re-audit (292 gate neutralizations across every `authenticated`-reachable DEFINER door) found no live leak — platform-wide test-coverage debt, not a Gate-1 breach. Closed with a standing invariant (ADR [0079](docs/decisions/0079-authz-door-blindness-standing-invariant.md)) + 50 mutation-proven keystones; qa APPROVED. Full detail → [authz-p0-door-blindness.md](docs/progress/authz-p0-door-blindness.md).
· **Flexible-Forms Program — ✅ FF-1 (Repeating Groups) COMPLETE 2026-07-27** (ADR [0087](docs/decisions/0087-ff1-repeating-groups.md) + Amendment 1; QA APPROVED r2; flag `repeating_groups` **ON** via gate flip `20260828000900`; record → [ff-1-repeating-groups.md](docs/progress/ff-1-repeating-groups.md)). **✅ FF-2 (Matrix & Risk Matrix) COMPLETE 2026-07-27** (ADR [0089](docs/decisions/0089-ff2-matrix-risk-matrix.md); QA APPROVED r2; flag `matrix_fields` **ON** via gate flip `20260830001200`; record → [ff-2-matrix-risk-matrix.md](docs/progress/ff-2-matrix-risk-matrix.md)) — it discharged FF-1's P0-1 correction-copy obligation and pulled **both** its own follow-ups (dashboard aggregation + sign-off grid) into gate scope by PO ruling. **Remaining: FF-3 → FF-5 → FF-4** (ADR [0086](docs/decisions/0086-flexible-forms-pre-pilot.md); all gate the pilot deploy; per-phase ADRs **0090+** at each phase start). ⚠ **FF-3 and FF-5 inherit two obligations from FF-2** — the missing targeted/correction policy arms on `form_item_validations` / `answer_references` (unfixed only because both are write-inert), and the **door-parity rule** (`272_ff2_door_parity.sql`) → [flexible-forms-program.md](docs/plans/flexible-forms-program.md)
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

FF-2's five (BUG-FF2-001…005) and the two out-of-phase fixes it absorbed (BUG-FF1-006 `HC0N2`,
BUG-FF1-007 `<> ''''`) are **all closed and re-verified**, with full repro/fix detail in
[ff-2-matrix-risk-matrix.md](docs/progress/ff-2-matrix-risk-matrix.md). The ETH·E2 targeted-lane fix
(`4ee24c8`) is recorded there too.

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

#### 🟡 BUG-FF1-008 — `form-builder-enhancements.spec.ts:768` AC-4 pins behaviour FF-1 deliberately removed · owner `tester` · **OPEN** (filed 2026-07-27)

Asserts the "obrigatória" toggle is DISABLED beside a visibility condition. `git log -L` blames the
"offered BESIDE a visibility condition" change to **`633e688 feat(ff-1)`**, and FF-1's own
`20260828000000` dropped `form_items_conditional_not_required` (confirmed absent from the live
catalog). ~2 lines to repin. **Red on every run since FF-1 and written off as flaky-baseline noise** —
see FUP-E2E-1.

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
     §6 Record (full historical log, Phases 0 → S2, 133 rows, already there). -->

_FF-1's runs (9/9 E2E on a prod build · pgTAP 3925 · Vitest 490 · and the two full `e2e:prod`
gate runs with their triage) are recorded in
[ff-1-repeating-groups.md](docs/progress/ff-1-repeating-groups.md)._

| Date | Scope | Result | Notes |
|---|---|---|---|
| 2026-07-27 | **FF-2 · `e2e/ff2-matrix.spec.ts`** (10 tests), prod-standalone from the worktree on **:3100** (`:3000` is the primary checkout's), chromium, workers=1 | **10 / 10 PASS** (49.4 s) — the 9-test file passed **3 consecutive** runs before FF2-10 was added, and again on a **rebuild against committed HEAD** after `5d0bc92`/`0bd1f7f` landed mid-pass | ADR 0089 rulings 1–4 + the repeating-group substrate + keyboard-only + the server writer + BUG-FF2-002's fix + resume read-back. Two spec defects fixed before green (see the mutation rows). NOT the full-suite gate — the lead owns `npm run e2e:prod`. |
| 2026-07-27 | **Mutation proof — `app.instance_is_empty`** (ADR 0089 §A, a bold must-mutation-prove keystone) | **RED as required**, then restored | Both matrix arms removed on the live DB → **FF2-6 fails** (submit blocked: both instances pruned, minInstances unmet). Original captured with `pg_get_functiondef` beforehand and restored **byte-for-byte** (`diff` clean). |
| 2026-07-27 | **Mutation proof — `app.item_required_satisfied`** (ruling 3 row-complete weakened to "any cell") | **Exposed a VACUOUS assertion in the spec**, then RED after the fix, then restored | FF2-3 originally called `submit_response` right after a UI-only partial fill — which never flushes, so it was proving "an EMPTY grid is refused" (true under BOTH readings) and **stayed GREEN under the mutation**. Rewritten to persist 2-of-3 rows through `save_section_answers` and assert their presence first; it then fails loudly (`aceitou uma matriz obrigatória com 2 de 3 linhas`). Predicate restored byte-for-byte. |
| 2026-07-27 | **Neighbour regression** — `ff1-repeating-groups.spec.ts` + `phase5-wizard.spec.ts` | **19 / 21** — `phase5-wizard` 12/12; FF1-2 + FF1-7 RED | → **BUG-FF2-003** (the add-block menu overflow). Flag-toggled three times to prove causation, not assumed. |
| 2026-07-27 | FF-2 full-file run **immediately after** a live `CREATE OR REPLACE` restore of two `app.*` functions | 5 / 8, FF2-6/7/8 red (visibility timeouts, no value mismatches) | **Did NOT recur.** Across the whole BUG-FF2-003 fix loop (a further **8 runs**, including two rebuilds and a `db reset`) it never reappeared. Treat as restore-transient. |

**BUG-FF2-003 fix loop — re-run 2026-07-27, prod-standalone rebuilt at committed HEAD (`9d103d1`), :3100, chromium, workers=1:**

| Date | Scope | Result | Notes |
|---|---|---|---|
| 2026-07-27 | `ff1-repeating-groups.spec.ts` — the BUG-FF2-003 verdict | **9 / 9** (57 s) | FF1-2 **3.3 min timeout → 6.3 s**, FF1-7 **3.7 min → 7.1 s**, whole file **8.2 min → 57 s**. Bug closed. |
| 2026-07-27 | `ff2-matrix.spec.ts` (now **11** tests — FF2-11 added as the BUG-FF2-003 guard) | **11 / 11** | Also re-run on a fresh seed: **20/20** together with FF-1. |
| 2026-07-27 | **Mutation proof — FF2-11** (a guard is worthless until shown it can fail) | **RED as required**, then restored | The cap declaration neutralized **in the built CSS bundle** (a build artifact, not source) → FF2-11 red on `max-height nunca resolveu para um valor`. Bundle restored, `diff` clean, green again. |
| 2026-07-27 | **Built-CSS verification**, independent of `frontend`'s | PASS | Production bundle carries the `var()` form; **zero** bare `prop:--radix…` declarations remain; no dead selector minted from the reworded `e2e/` comment. |
| 2026-07-27 | `phase5-wizard.spec.ts` — **AC3 red on the accumulated DB, 12/12 after `db reset`** | **12 / 12** | **NOT a regression.** Triaged rather than assumed: the two fix commits touch only `forms/add-block-menu`, `cases/`, `documents/` and `timeline/` — nothing in the response-wizard path. Cause was **28 stale `in_progress` responses** piled up by ~20 of my own runs with no reset. `tester` ran **`supabase db reset --local`** (migrations `209 == 209`, no drift; real token POST → 200; both feature flags back ON). This is the known per-test-isolation debt, not new. |
| 2026-07-27 | **Final clean-DB run** — `ff2-matrix` + `ff1-repeating-groups` | **20 / 20** (1.7 min) | Green declared on a freshly seeded DB. |

**Wave 3 read surfaces — `tester` pass 2026-07-27, prod-standalone rebuilt at HEAD (`8f6db27`), :3100, chromium, workers=1:**

| Date | Scope | Result | Notes |
|---|---|---|---|
| 2026-07-27 | **NEW `e2e/ff2-matrix-views.spec.ts`** (5 tests) + `e2e/helpers/ff2-matrix.ts` | **5 / 5** | FF2V-1 sign-off route · FF2V-2 `getSubmissionDetail` · FF2V-3 dashboard distribution + risk summary · FF2V-4 code-keyed aggregation · FF2V-5 stored score wins. |
| 2026-07-27 | `ff2-matrix.spec.ts` + `ff2-matrix-views.spec.ts` together | **16 / 16** (1.3 min) | Closes BUG-FF2-004 (the five repinned slug regexes pass). |
| 2026-07-27 | **Mutation proof — the sign-off door's matrix projection** | **RED as required**, then restored | `'matrix_cells_by_item'` renamed in `get_response_for_signoff` → FF2V-1 red (`o door de assinatura precisa projetar as células da matriz`, received `undefined`). Restored byte-for-byte, `diff` clean, green again. |

**Three findings from this pass that are not bugs but change what the tests mean:**

1. 🔑 **An empty-string observation is UNREACHABLE through either canonical writer.** Both
   `save_section_answers` and `app.save_instance_answers` normalize with `nullif(btrim(...), '')`
   (read from `pg_proc`), so `p_observations: {item: ''}` lands as **NULL**. `bf7fae1`'s filter is
   therefore **defence-in-depth over legacy rows**, not a guard on anything today's product can
   write — and FF2V-1 plants the row directly to reproduce it, saying so at the call site. **This
   also supports the FUP-FF2-3 deferral**: the whitespace-only asymmetry between the two arms
   (`observation <> ''` per-instance vs `btrim(observation) <> ''` top-level) is reachable only for
   the same legacy rows. Not specced, per instruction.
2. ⚠ **`psql -tA` cannot distinguish "one row holding `''`" from "no rows".** My first arrange
   asserted a bare `select observation` and read the empty string as an absent row — an arrange
   that silently did nothing would have looked like a passing test. Assertions on a possibly-empty
   column now go through a `case … then 'EMPTY'` **sentinel**, and the helper carries the warning.
3. ⚠ **Two DOM-reading traps, both of which produced a confidently wrong number before I caught
   them.** `innerText` concatenates adjacent spans with no separator, so a distribution cell of
   "2" + "67%" reads as **"267"** — counts are now read from the count's own `<span>`. And
   `innerText` **applies CSS `text-transform`**, so an `uppercase` label really does read "MÍNIMA"
   and a `/Mínima/` regex never matches, while `toContainText('Mínima')` passes (it uses
   textContent). Stats are now read as `<dt>` → sibling `<dd>`.

> ⚠ **Full-gate standing caveat (unchanged, pre-existing).** `npm run e2e:prod` (70 spec files,
> 12 batches) does **not** currently reach a clean green on this machine: the local stack degrades
> faster than the suite completes (4 `db reset` cycles in ~50 min → `reset FAILED`). FF-1's triage
> established the failure classes by experiment — collapses that **move between runs** are infra
> (batch 3 clean in one run, 23-failed in the other; batch 8 the inverse), and the only
> zero-connection-error failures traced to a **pre-existing test-isolation defect** between
> `member-action-items-overview.spec.ts` and `notifications.spec.ts` (the latter is 8/8 alone,
> 3-failed when paired). Recovery per memory `supabase-vector-crashloop-502`: `supabase stop/start`
> + verify a **real token POST returns 200** (a `/health` 200 is insufficient). Pay-down =
> per-test DB isolation → [s1-substrate.md](docs/progress/s1-substrate.md).

## QA Verdicts

<!-- One row per phase/feature, ONE LINE only: verdict + date + link to docs/reviews/*.md
     (the full analysis already lives there — do not restate rationale here, and do not
     copy it to docs/progress/qa-verdicts-archive.md either, that's redundant with the
     review file). Legacy rows predating this rule may still point at qa-verdicts-archive.md. -->

| Phase / Feature | Verdict | Report | Notes |
| --------------- | ------- | ------ | ----- |
| **FF-2** — Matrix & Risk Matrix (ADR 0089) | ✅ **APPROVED** (2026-07-27, r2) — **0 blocking / 0 MAJOR**. All three r1 blockers closed and verified by **re-running qa's own r1 probes**, which now pass (B-1 `T4`/`T5` green — the targeted respondent saves and persists a cell; B-2 `X1`/`X2`/`X3` green — the corrector reads 4 cells + 1 risk row; B-3 proven **independent of the seed** — flag set false, migration `20260830001200` replayed alone → `true`). **All six claimed mutation proofs re-run and confirmed** (M1 O2+O3 · M2 **and** M2b each O3 **independently** · M3 P2 / M3b P3 · M4 **Q3+Q4 red with Q1/Q2 green** · M5 R2–R4 / M5b R5), **plus four qa added**: M2c (targeted arm out of `answer_matrix_cells_select` → O3 red — a third load-bearing half), **M4b** (`item_required_satisfied := true` → **Q1+Q2 red**, proving §Q bidirectional — M4 alone does not), M6 (ARM-1 ownership test removed → O5 red, the widening is bounded), and §J re-proved (6 red) confirming r1's proofs survive the r2 policy rewrites. **Sweep table independently verified against `pg_policies`/`pg_proc` and accurate**, including both "deliberately absent" door entries (`matrix_cells_by_item`/`risk_matrix_by_item` have exactly one caller, the gated `get_response_for_signoff`; `item_required_satisfied`/`instance_is_empty` are reachable only from `app`, not PostgREST-exposed). K9 intact after the second policy round. **Full pgTAP run file-by-file by qa: 4050 ok / 0 not ok** on the committed tree; `255_ethics_e2_targeted` 26/26 is the over-grant twin and holds. ⚠ **PRE-COMMIT CONDITION (tree state, not code)** — the worktree carries **untracked** `20260830001500_eth_targeted_choice_lane.sql` + `273_…sql` (216 files vs 215 registered; `273` red 8/14 until applied). qa applied it temporarily: **14/14, no regression** — sound work, but it contains **two unreviewed `FOR ALL` write policies** and covers a **third** pre-existing gap the brief did not name (`response_group_instances`, which bounds B-1: a matrix inside a repeating group stays unfillable for a targeted respondent until it lands). Stash it or commit it as its own reviewed out-of-phase change before `phase(FF-2): complete`. 5 MINOR + 3 INFO carried; **m-1** (platform_admin reads matrix aggregates via `is_admin()`) and **m-2** (ARCHITECTURE.md still calls matrix "F3-reserved inert") should not reach the pilot unresolved. | [r2](docs/reviews/ff-2-review-r2.md) · [r1](docs/reviews/ff-2-review.md) | qa reset the DB twice; it now sits at **216 == 216** because a reset applies whatever is on disk — every mutation proof was run against the committed 215 state beforehand. |
| ~~**FF-2** — Matrix & Risk Matrix (ADR 0089)~~ | ⛔ **CHANGES REQUESTED** (2026-07-27, r1) — superseded by the r2 approval above — **3 BLOCKING / 2 MAJOR-coverage / 5 MINOR / 2 INFO**. Two blockers **live-proven**, both the same class (FF-2's new doors did not inherit the sibling answer path's second OR-arm): **B-1** `app.assert_matrix_answer_writable` is creator-only while `answers` also grants `can_write_targeted_response`, so an ETH·E2 **targeted respondent cannot save a matrix cell** (`42501`) though a scalar answer saves in the same transaction; **B-2** `answer_matrix_cells_select`/`answer_risk_matrix_select` lack the `can_read_correction_response` arm `answer_selected_options_select` has, so a designated **corrector reads 0 cells / 0 risk rows** of the predecessor (answers: 4). **B-3** no `enable_matrix_fields` gate-flip migration exists (ADR 0089 front matter promises one; 4 prior flags shipped one) — flag is ON only via `seed.sql`, so the phase is **dark after `db push`**. MAJOR-coverage, behaviour verified CORRECT by qa but regressions undetectable: **M-1** ruling 3's per-instance half is unexercised (no fixture has `required=true` on a matrix in a repeating group — reverting BOTH per-instance arms leaves 271/270/209/51 fully green; qa's own probe 7/7, mutation-proven); **M-2** `start_correction_draft`'s 2 matrix copy blocks have zero coverage (deleting both leaves 264 39/39 and 271 90/90; qa's probe 6/6, mutation-proven). **All 4 mandated mutation proofs independently RE-RUN and HOLD** (§J 6 red · §K 2 red with K2/K3 green · §M 4 red property-shaped · §N 2 red **plus** the drop-everything twin 1 red), K9 posture intact, rulings 1/2/4 + code-keyed aggregation confirmed live. | [review](docs/reviews/ff-2-review.md) | Lead's 5 carried gaps: 4 correctly ruled; the `correction_copies` E2E call is under-informed — see M-2. `qa` ran two `db reset`s; stack pristine at `20260830001100`, 212==212. |
| **FF-1** — Repeating Groups (ADR 0087 + Amendment 1) | ✅ **APPROVED** (2026-07-27, r2) — r1 raised **1 P0 + 2 MAJOR**, all fixed at `7e72006` and independently re-proven by qa (13 catalog-verified mutations, incl. that the *arming* assertions genuinely arm). 4 MINOR / 6 INFO ride as non-blocking follow-ups. | [review](docs/reviews/phase-FF-1-review.md) | Full detail + r1 record in the review; phase record → [ff-1-repeating-groups.md](docs/progress/ff-1-repeating-groups.md) |
| S5 · **ETH·E3a** — Ethics terminology/UX surfacing (ADR 0064 D4 / 0072 / 0073) | ✅ **APPROVED** (2026-07-27, r2) — r1 raised **1 P0** (`coordinator_only` case-events leak to write-grantees: `case_events_writer_write` FOR-ALL `USING can_write_case_content` OR-ed into SELECT, ADR-0079); **fixed `a64e61a`** (mig `20260827000400`, reader-non-writer split → `case_events_select` sole SELECT authority) and independently re-verified live: write-grantee `coordinator_only`=**0** (was 1), still reads `case_readers`; keystone non-vacuous (restore leaky arm ⇒ 1/RED, drop ⇒ 0); **no write-authority regression** (SELECT=`_select` only; INSERT/UPDATE/DELETE preserve prior USING/WITH CHECK + coordinator_only insert-gate); full pgTAP **3852 PASS** fresh reset. r1 positives held: `getEthicsDashboard` scoping load-bearing (neutralize `can_read_case`→true ⇒ respondent 1→3), 3 dashboard tables single `can_read_case` SELECT policy no FOR-ALL read-arm, auth client (no service-role/DEFINER), auto-derive bodies PHI-free, O-1 inheritance `explicit_grants_only`. 3 INFO ride as follow-ups. | [review](docs/reviews/phase-E3a-review.md) | |
| **Case Correction Lifecycle** (ADR 0085, branch `case-corrections`) | ✅ **APPROVED** (2026-07-24, r1) — 0 P0 / 0 MAJOR / 2 MINOR (non-blocking) / 5 info. Write-path triple-locked + **live-proven**: 3 guard triggers fire on owner INSERT/UPDATE w/o the RPC GUC, and `authenticated` is denied even with a spoofed `in_correction_rpc` (no write GRANT + no RLS write policy). All 9 doors `prosecdef`/owner-postgres/search_path-pinned/EXECUTE auth+svc only (anon absent); authority-first (42501) before exclusion (`HC0F1`) → distinct SQLSTATEs (no vacuous keystone). `approve_correction` chain-tip + pointer re-point + narrative `concluded_at/by` preserved; `guard_supersession_coherent` case arm corrector-slot gated; `sync_case_phase_on_submit` supersedes-skip; reader sweep resolves `current_response_id` (no double-count), `submitted_form_responses` standalone-only untouched. Rule 12: no free-text/PHI in any audit payload; `can_read_correction_response` scoped to `permitted_corrector` (no over-grant); targeted-response refused (HC0M5). All ADR CHECKs/indexes/blocks-sweep verbatim; `reopen_narrative` dropped. MINOR-1 void arm omits `impact_snapshot` (matches plan, tension w/ ADR §7); MINOR-2 `23514→"unavailable"` copy over-broad. | [review](docs/reviews/case-corrections-review.md) | |
| **Controlled-Document Redesign** (Phase 17 v2, ADR 0081) | ✅ **APPROVED** (2026-07-21, r1) — 0 BLOCKER / 0 MAJOR / 0 MINOR / 4 info. Both new DEFINER doors proven live: `list_commission_documents` `prosecdef`+member/admin gate (empty-set deny)+flag gate+no PUBLIC/anon ACL; `remind_document_approver` staff_admin/commission_admin authority in body (42501)+pending-approver-only+REVOKE-from-PUBLIC. B0 anglicization sound — `publish_document` all-must-approve gate keeps English `decision<>'approved'` (HC090); constraints English (`policy/sop/protocol/bylaws/manual/other`, `approved/rejected`, `superseded/retired`); 0 residual pt-BR literals in controlled-docs bodies (ethics-module literals correctly untouched). Notification producers commission-scoped, enum values accepted by table CHECKs; audit whitelist excludes category/tags/description/title, row still emitted (Rule 11); PHI-free (Rule 12 N/A). Every ADR-0081 locked decision delivered; client boundary type-only, no `any`, chained-action partial-failure returns documentId+pt-BR banner. | [review](docs/reviews/document-control-redesign-review.md) | |
| S4 · **CH** — Committee Charters & Meeting Cadence (ADR 0080; Phase 21) | ✅ **APPROVED** (2026-07-20, r1) — 0 P0 / 0 MAJOR / 0 MINOR / 3 info. Crux proven live under `set local role`: member reads its 1 charter row, foreign-commission + pure non-member read 0; 1 SELECT policy + no write policy + `authenticated` SELECT-only; 3 RPCs `prosecdef`/owner-postgres/search_path-pinned/EXECUTE auth+svc only. Mutation harness re-run: KS_AUTHORITY/KS_MEMBER/KS_FILTER all **RED-PROVEN**, control 29 green. pgTAP 260/261/262 = 11/29/10 green. Authority-first (HC0K0→HC0K1) + member-scope (HC0K2) + `can_read_action_item` filter all in the live bodies. PHI-free (Rule 12). BUG-FBE-005 avoided. phase17 `cb6a671` = sound spec-only fix. | [review](docs/reviews/phase-CH-review.md) | |
| RV2 · **R2–R5** referral governance (triage/SLA · resolution lifecycle · assignments/links · notes/receipts/redaction) | ✅ **APPROVED** (2026-07-19, r2) — 0 P0 / 0 MAJOR / 0 min / 1 info(hardening). r1 MAJOR (`1885159`) + MINOR (`1893cb6`) fixed & re-verified live: `referral.note_viewed` fires on ≥1 note served, PHI-free payload, actor=reader, 0-note/QPS read → 0 audit; dispatch predicate audit-only (0 RLS policies, no PQS arm); K-R5-1 source≠target≠QPS intact. Security core proven live: R4 residue-free, PHI REVOKEs, R3 authority-first non-vacuous (target 42501 / source HC0A5), t19 clean. | [review](docs/reviews/rv2-r2-r5-review.md) | |
| AUTHZ · **AUDIT-DOOR-BLINDNESS P0** (ADR 0078 §7.14 / ADR 0079) | ✅ **APPROVED** (2026-07-18, r1) — 0 P0/0M/2min/1info; baseline PASS 115/3288, 50/50 keystones RED-PROVEN, invariant HOLDS (BLIND=72⊆allowlist, 93 doors floored), PHI door-only grants verified revoked, live foreign-read=0 | [review](docs/reviews/authz-door-audit-p0-review.md) | |
| S4 · ETH·E2 — Ethics disciplinary procedure (ADR 0073; 0078-reconciled) | ✅ **APPROVED** (2026-07-18, r1) — 0 P0 / 0 MAJOR / 1 min (doc) / 3 info | [review](docs/reviews/eth-e2-review.md) | Crux verified live under `set local role`: non-vacuity proven (vote 42501≠HC0J5), D13 respondent reaches only its 1 targeted response, M2 pin/HC0J7 bar hold, 9 tables verbatim `can_read_case`, flag flip seed-only. |
| AUTHZ · **Gate 2** (Stage C · F1 · N1) | ✅ **APPROVED** (2026-07-17, re-review) — 0 P0 / 0 MAJOR / 1 noted MINOR | [review](docs/reviews/authz-gate-2-review.md#re-review-2026-07-17--verdict--approved) | |
| ~~AUTHZ · **Gate 2** (round 1)~~ | ⛔ **CHANGES REQUESTED** (2026-07-17, r1) — superseded by the re-review above — **1 P0** / 2 MAJOR / 1 MAJOR-3 adjudication / 1 min | [review](docs/reviews/authz-gate-2-review.md) | |
| AUTHZ · Stage B — `case_access → case_access_grants` hard cut (B1→B5) | ✅ **APPROVED** (2026-07-16, r1) — 0 P0/0M/2min/1info | [review](docs/reviews/authz-b-series-review.md) | |
| AUTHZ · Exclusion Perimeter (U1+U2) — the hard deny at every door | ✅ **APPROVED** (2026-07-16, r1) — 0 P0/0M/0min/2info | [review](docs/reviews/authz-exclusion-perimeter-review.md) | |
| AUTHZ · A4 — org admin ceases to be a Case Content source | ✅ **APPROVED** (2026-07-16, r1) — 0 P0/0M/0min/2info | [review](docs/reviews/authz-a4-review.md) | |
| AUTHZ · A2 — the capability resolver (`_case_caps` + projections) | ✅ **APPROVED** (2026-07-16, r1) — 0 P0; 1 MAJOR filed against **A5** (per-row cost ~10×, unmeasured pre-image) | [review](docs/reviews/authz-a2-review.md) | |
| AUTHZ · M6 — `cases.visibility_policy` guarded door (ADR 0078 A1/A27; PO Q1–Q4) | ✅ **APPROVED** (2026-07-16, r1) — 0B/0M/3min/2info | [review](docs/reviews/authz-m6-review.md) | |
| AUTHZ · M5 — defect ③: the `is_active` outer gate | ⚠ **CHANGES REQUESTED** (2026-07-15) — 1 P1 ("CLOSED" over-claimed); **resolved by M5b**, which produced §7.9 | [review](docs/reviews/authz-m5-review.md) | |
| AUTHZ · M3 — defect ① narrowing: assignment ⇏ PHI | ✅ **APPROVED** (2026-07-15) | [review](docs/reviews/authz-m3-review.md) | |
| AUTHZ · M2 — A30 bucket C: platform_admin loses PHI | ✅ **APPROVED** (2026-07-15) | [review](docs/reviews/authz-m2-review.md) | |
| AUTHZ · M1 — Exclusion durability (ADR 0078 Gate 1) | ✅ **APPROVED** (2026-07-15, re-review) | [review](docs/reviews/authz-m1-review.md#re-review--the-b1b2-delta) | |
| ~~AUTHZ · M1 (round 1)~~ | ⚠ **CHANGES REQUESTED** — superseded by the re-review above | [review](docs/reviews/authz-m1-review.md) | |
| AUTHZ · A0 — Catalog-driven capability inventory | ✅ **APPROVED** (v3) | [review](docs/reviews/authz-a0-inventory-review.md#v3-review--the-final-a0-round) | |
| S3·ETH·E1 — Ethics access spine + m2 gate release (ADR 0072) | CHANGES→CHANGES→✅ **APPROVED** (2026-07-14, round 3) | [review](docs/reviews/phase-ETH-E1-review.md) | |
| AI track — Action-Items Satellites + Cross-Link UI (ADR 0050) | ✅ **APPROVED** (2026-07-14) | [report](docs/reviews/phase-AI-review.md) | |
| AI track — BE-6·N reminder→N scan arm (delta; ADR 0076 × 0050) | ✅ **APPROVED** (2026-07-14) | [report](docs/reviews/phase-AI-review.md#be-6n-delta-review--remindern-scan-arm-2026-07-14) | |
| S2·RV2·R1 — Referrals v2: dialogue core (ADR 0037 Amendment 1) | ✅ **APPROVED** (2026-07-14) | [report](docs/reviews/rv2-r1-referrals-review.md) | |
| S2·IV2 — Interviews v2: sessions + reporting/confidentiality (ADR 0070) | ✅ **APPROVED** (2026-07-13) | [report](docs/reviews/iv2-interviews-review.md) | |
| S1·MEM — Single `memberships` collapse (ADR 0071/0075; S0 §I) | ✅ **APPROVED** (2026-07-13) | [report](docs/reviews/memberships-collapse-review.md) | |
| F3 — Flexible-Forms Foundation (ADR 0060/0065) | ✅ **APPROVED** (2026-07-12) | [report](docs/reviews/phase-F3-review.md) | |
| F2 — Centralized Attachments (ADR 0063) | ✅ **APPROVED** (2026-07-11) | [report](docs/reviews/phase-F2-review.md) | |
| F1 — Case-Participants E0 (ADR 0064/0066) | ✅ **APPROVED** (CHANGES→APPROVED same day, 2026-07-10) | [report](docs/reviews/phase-F1-review.md) | |
| Meeting actual-occurrence time `held_at`/`held_end` (ADR 0062) | ✅ **APPROVED** (2026-07-08) | [report](docs/reviews/meeting-held-time-review.md) | |
| Administrativo delegated-capability role (ADR 0061) | ✅ **APPROVED** (2026-07-08) | [report](docs/reviews/administrativo-review.md) | |
| Form-Builder Enhancements batch (Departments · Flagged/aggregate results · Others · wizard UX · meeting participants) | ✅ **APPROVED** (2026-07-07) | [report](docs/reviews/adjustments-batch-review.md) | |
| 17 — Controlled-Document Lifecycle (Gestão de Documentos Controlados) | ✅ **APPROVED** (2026-07-06) | [report](docs/reviews/phase-17-review.md) | |
| 15 — Quality Indicators (Indicadores de Qualidade) | ✅ **APPROVED** (2026-07-06) | [report](docs/reviews/phase-15-review.md) | |
| Pre-Pilot DB Hardening — Wave 2 (WS-6 perf sweep: P2/P3/P4/P5) | ✅ **APPROVED** (2026-07-05) | [report](docs/reviews/pre-pilot-hardening-wave2-review.md) | |
| Pre-Pilot DB Hardening — Wave 1 (C-1…C-6, H-8; D1/D2/D4/D6-flip/D7/D9; P1/P9/P10) | ✅ **APPROVED** (2026-07-05) | [report](docs/reviews/pre-pilot-hardening-wave1-review.md) | |
| Phase B — NSP-per-hospital + `nsp_org_admin` (ADR 0052) | ✅ **APPROVED** (2026-07-03; CHANGES→APPROVED same day) | [report](docs/reviews/nsp-per-hospital-review.md) | 1 BLOCKER (RESOLVED) · 0 MAJOR · 1 non-blocking docs note. Security design sound; dual-hospital isolation proven. |
| Phase A — Hospital-admin tier, 4-tier audit & committee titles (ADR 0051) | **CHANGES REQUESTED** (2026-07-03) | [report](docs/reviews/hospital-admin-tier-review.md) | 0 BLOCKER · 2 MAJOR (both fixed) · 3 MINOR. Security core sound (pgTAP 184/187/188). |
| Action-Items Fold + `visibility_scope` + Case-Access Expiry (ADR 0050) | **APPROVED** (2026-07-02) | [report](docs/reviews/action-items-fold-review.md) | |
| Shared (non-PHI) `action_items` table (Option A) | **APPROVED** (2026-07-02) | [report](docs/reviews/shared-action-items-review.md) | |
| Member Overview & "Meus itens de ação" | **APPROVED** (2026-07-02) | [report](docs/reviews/member-overview-action-items-review.md) | |
| User Registration & Identity Management | ✅ APPROVED (CHANGES→APPROVED, re-re-review 2026-07-01) | [report](docs/reviews/user-registration-review.md) | |
| ad-hoc-narratives | **APPROVED** (2026-07-01) | [report](docs/reviews/ad-hoc-narratives-review.md) | |
| answer-model-v2 | **APPROVED** (2026-07-01) | [report](docs/reviews/answer-model-v2-review.md) | |
| form-model-norm | **APPROVED** (2026-07-01) | [report](docs/reviews/form-model-normalization-review.md) | |
| result-rec | **APPROVED** (2026-06-26) | [report](docs/reviews/result-rec-review.md) | |
| NSP-per-org | **APPROVED** (2026-06-25; superseded by NSP-per-hospital) | A [core](docs/reviews/nsp-per-org-a-review.md) · B [whole](docs/reviews/nsp-per-org-b-review.md) | |
| Multi-Tenancy | **APPROVED** (2026-06-25) | [report](docs/reviews/multitenancy-review.md) | |
| Form Builder Enhancements | **APPROVED** (2026-06-23) | [report](docs/reviews/form-builder-enhancements-review.md) | |
| `case_phase_results` | **APPROVED** (2026-06-23) | [report](docs/reviews/phase-results-review.md) | |
| 23 — Patient Identity | **APPROVED** (2026-06-22) | [report](docs/reviews/phase-23-review.md) | |
| `case_patient` (ADR 0038) | **APPROVED** (2026-06-22) | [report](docs/reviews/case-patient-review.md) | |
| 22 — Inter-Committee Referrals | **APPROVED** (2026-06-21) | [report](docs/reviews/phase-22-review.md) | |
| PHI/HIPAA Remediation (WS0–E) | **APPROVED** (2026-06-20) | [report](docs/reviews/phi-remediation-review.md) | |
| 14b–14d — Triage/RCA/CAPA | CHANGES→**APPROVED** (2026-06-18) | [report](docs/reviews/phase-14-review.md) | |
| 14a — NSP Foundation | CHANGES→**APPROVED** (2026-06-18) | [report](docs/reviews/phase-14a-review.md) | |
| 13 — Audit Trail | **APPROVED** (2026-06-18) | inline | |
| 12 — Case Timeline | **APPROVED** (2026-06-16) | [report](docs/reviews/phase-12-review.md) | |
| 11 — Interviews | **APPROVED** (2026-06-15) | [report](docs/reviews/phase-11-review.md) | |
| 10 — Meetings | **APPROVED** (2026-06-15) | [report](docs/reviews/phase-10-review.md) | |
| Case Access Control | **APPROVED** (2026-06-19) | [report](docs/reviews/case-access-control-review.md) | |
| Case Narratives | **CHANGES REQUESTED** (2026-06-19) | [report](docs/reviews/case-narratives-review.md) | |
| Case data-model (D1–D15) | **APPROVED** (2026-06-14) | [report](docs/reviews/case-model-adjustments-review.md) | |
| Cases-Extras (R1–R5) | **APPROVED** (2026-06-14) | [report](docs/reviews/cases-extras-review.md) | |
| 8 — Dashboards | **APPROVED** (2026-06-14) | [report](docs/reviews/phase-8-review.md) | |
| 7 — Multi-Phase Cases | **APPROVED** (2026-06-13) | [report](docs/reviews/phase-7-review.md) | |
| 6 — Sign-offs | **APPROVED** (2026-06-13) | [report](docs/reviews/phase-6-review.md) | |
| 5 — Wizard | **APPROVED** (2026-06-13) | [report](docs/reviews/phase-5-review.md) | |
| 4 — Form Builder | **APPROVED** (2026-06-12) | [report](docs/reviews/phase-4-review.md) | |
| 3 — Admin/Users | **APPROVED** (2026-06-12) | [report](docs/reviews/phase-3-review.md) | |
| 2 — Auth & Shell | **APPROVED** + re-review (2026-06-12) | [report](docs/reviews/phase-2-review.md) | |
| 1 — Schema/RLS | **APPROVED** (2026-06-12) | [report](docs/reviews/phase-1-review.md) | |
| 0 — Scaffolding | **APPROVED** | [report](docs/reviews/phase-0-review.md) | |

## Decisions

<!-- One line per decision; full rationale in docs/decisions/ (ADR) + docs/progress/decisions-log.md -->

| Date | Decision | Ref |
| ---- | -------- | --- |
| 2026-07-27 | **Flexible-Forms FF-1…FF-5 pulled pre-pilot** (PO) — all five feature phases build before the pilot and gate the pilot deploy; order FF-1→FF-2→FF-3→FF-5→FF-4; required-capable per phase; instance-aware evaluation in FF-1; `required_if` in FF-3; FF-5 = 3 reference lanes; FF-4 trimmed (calculated fields stay post-pilot). Full rationale → [decisions-log.md](docs/progress/decisions-log.md). | [0086](docs/decisions/0086-flexible-forms-pre-pilot.md) · [program](docs/plans/flexible-forms-program.md) |
| 2026-07-27 | **FF-1 Repeating Groups rulings** (PO, grilling interview) — nesting **capped at depth 1, schema-enforced**; conditions resolve **inside-out** (2-tier overlay, same-instance wins, sibling-absent never falls back) and **outside-in is rejected at publish** (reversible direction; the ban targets *repeating* groups only); a **fully-empty instance is not incomplete** — skipped, pruned by `submit_response`, `min_instances` checked after pruning; FF-1 **drops `form_items_conditional_not_required` globally** (un-deadens the already-written visibility-wins branch; mutation-proven keystones); instance writers are **INVOKER** correctness doors, **RLS stays the boundary** (the plan's DEFINER/`reader_non_writer` keystone retired as not-applicable) + a post-pilot follow-up to harden the whole fill path coherently; **both** container types ship, `group` as a pure visual container. Also records **6 substrate corrections** to the program plan. | [0087](docs/decisions/0087-ff1-repeating-groups.md) |
| 2026-07-23 | **Case custom fields** — template-defined, **non-PHI** administrative descriptors on cases (e.g. M&M "Número da Declaração de Óbito"); dedicated `process_template_custom_fields` → snapshot `case_custom_field_values` (reuse form input-type vocabulary, minimal subset: short_text/number/date/single-select); captured in "Novo caso" (atomic in `create_case_from_template`), editable+audited; PHI boundary = fill-time warning; process-less excluded; flag `case_custom_fields`. Design only — build is a later gated phase. | [0083](docs/decisions/0083-case-custom-fields.md) |
| 2026-07-16 | **`manage_case_access` — KEEP (confirmed, PO).** The resolver computes `v_orgadmin` (`is_commission_admin_of_for`, ~19% of per-row cost) solely to set this bit, which **nothing consumes** (grant doors gate directly, not via the bit). Dropping it would buy ~19% but spend a reserved capability slot a future grant-doors-through-resolver refactor would need. A5 already cleared perf, so no urgency. Kept for model completeness. | [ADR 0078 D1/A16](docs/decisions/0078-authorization-capability-model.md) |
| 2026-07-16 | **Meeting family — ACCEPT AS-IS (exclusion-perimeter residual).** A coordinator recused from case X can conclude a multi-case meeting discussing X, stamping a boilerplate `case_events` "discussed in" event. Lead-verified she CANNOT read the case via the meeting (`can_reach_case_on_member_surface`=false); only `conclude_meeting` touches case content, and only an auto-generated stamp she does not author. Not guarded because meetings are commission-scoped (per-case guard would block multi-case meetings, §7.7). Low-severity residual, no migration. | [handoff §5](docs/progress/authz-handoff.md) |
| 2026-07-16 | **ADR 0078 A5 perf gate PASSED — no migration.** Resolver parity-or-faster + strictly linear on realistic (2005-case) data; qa MAJOR-1 ~10× was vs a single arm, not the real pre-A2 body. `manage_case_access` drop (~19%, 0 consumers) deferred as a separate PO ruling (reserved bit, needs its own keystone). | [ADR 0078 D2/A5](docs/decisions/0078-authorization-capability-model.md) · [handoff §5](docs/progress/authz-handoff.md) |
| 2026-07-12 | **Pre-pilot release scope expansion** — pulled 12 initiatives (Phases 20–21, Referrals v2, Interviews v2, Ethics E1–E3, action-items satellites+cross-link, §6.1 memberships collapse, supersession engine) into the pilot release; only Phases 18–19 stay post-pilot. Full rationale → [decisions-log.md](docs/progress/decisions-log.md). | [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md) |
| 2026-07-12 | **Referrals v2 — Dialogue & Governance** — adopt the missing two-way dialogue (`referral_messages` thread) + defer 12 items (triage/SLA, parent-referral, etc.) across gated phases R0→R5; R1 pilot-critical. | [0037-A1](docs/decisions/0037-inter-committee-case-referrals.md) · [plan](docs/plans/referrals-v2-dialogue-governance.md) |
| 2026-07-10 | **Pre-Pilot Foundations Program** — one collision-free plan sequencing F0→F1 participants→F2 attachments→F3 flexible-forms→F-cleanup for ADR 0060+0063+0064-E0+DB-hardening W3/4; six resolved collisions (C-α…ζ, closes D12). Full rationale → [decisions-log.md](docs/progress/decisions-log.md). | [program](docs/plans/pre-pilot-foundations-program.md) |
| 2026-07-09 | **Case subject generalization → participants/roles/professional-registry/case-types** (E0 foundation for Ethics + other non-patient-centered committees) — one generalized `cases` model, never a forked root; amends Rule 12. | [0064](docs/decisions/0064-case-subject-generalization-participants.md) |
| 2026-07-09 | **Centralized-attachments substrate refinement** (14e) — single authorizing owner + `attachment_references`, `attachment_subjects`, versioning/redaction, `legal_hold`+disposal; adopted from DMS-handoff evaluation. | [0063](docs/decisions/0063-centralized-attachments-substrate.md) |
| 2026-07-08 | **Administrativo delegated-capability role** — per-commission appointment + curated, finite capability menu (`schedule_meetings`/`create_cases`/`assign_case_phases`/`view_signoffs`) instead of a new role enum; escalation closed by construction (`_deny_self_grant`); phase-assignment auto-grant design REVERTED same day — assignment/creation now grants case READ, not write (coordinator `grant_case_access` stays the sole content-write path) | [0061](docs/decisions/0061-administrativo-delegated-role.md) |
| 2026-07-06 | **Coolify as the pre-Phase-9 dev/staging deployment target** — Dockerfile-only (Coolify's Traefik replaces the Phase-9-planned Caddy/compose stack), points at the existing remote Supabase Cloud project, `NEXT_PUBLIC_*` vars marked build-time. Not Phase-9 completion; runbook [deploy-coolify.md](docs/deploy-coolify.md) | [0059](docs/decisions/0059-coolify-deployment-target.md) |
| 2026-07-05 | **Phase 15/17 revision + pre-pilot re-sequencing** — build order **15 → 17 → 16** (documents pulled pre-pilot; pilot after 16; 18–21 post-pilot *(20–21 later pulled pre-pilot — [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md))*); both phases commission-owned + read-only DEFINER hospital rollups; derived indicators on option `code`s + `value_number`, hybrid taxa one-step; off-target→CAPA = **two-tier escalation** (PQS-operator "Abrir CAPA", hub fallback; CAPA write surface untouched); doc approvers = any active same-hospital user via an approval-row read arm, all-must-sign; forms metadata-only at publish; indicator SQLSTATEs from `HC084` | [0057](docs/decisions/0057-indicators-doc-control-replan.md) |
| 2026-07-06 | **Phase 15 derived-measurement compute** — `compute_derived_measurement` replicates the `dashboard_distributions` mechanics (submitted spine, option-`code` grouping, window) so **derived == dashboard by construction** (parity-by-construction, pgTAP-locked); hybrid taxa one-step (denominator inline) + preserve-on-recompute; comparator-driven classification | [0058](docs/decisions/0058-derived-measurement-compute.md) |
| 2026-07-02 | **Action-items fold + `visibility_scope` + case-access expiry** — scope-aware hub `SELECT` via `can_read_action_item`; fold `case_action_items` → `source_type='case'` (drop old table/RPCs; ADR 0033 D4 preserved); `case_access.expires_at`+`reason` filtered on all 6 consulters (incl. referral-PHI arm, Rule 12) | [0050](docs/decisions/0050-action-items-fold-visibility-scope-case-access-expiry.md) |
| 2026-07-01 | **Answer-Model v2** (planned) — uniform answer row + typed scalar cols (`value_number/date/time`) + instance-ready answer key (`group_instance_id`/`response_group_instances`); evaluator unchanged (Rule 3); plan [answer-model-v2.md](docs/plans/answer-model-v2.md) | [0045](docs/decisions/0045-answer-model-v2.md) |
| 2026-07-01 | **Forward-compat form capabilities** (planned) — `form_items.parent_item_id` + reserved hooks for repeating groups / file-signature-matrix answers / field confidentiality (structure only) + question default values | [0046](docs/decisions/0046-forward-compat-form-capabilities.md) |
| 2026-06-25 | **NSP-per-org** — bind the PQS roster + every PHI door to an organization (per-org `pqs_members`/`pqs_department`, `nsp_coordinator` grant via the role-CHECK seam, org-scoped doors + patient-index 4th surface, forbid cross-org referrals, vendor-walled erasure); lifts ADR 0041 amendment 10's interim multi-org PHI guard; split A (backend, pgTAP-gated) → B (FE + E2E) | [0042](docs/decisions/0042-nsp-per-org.md) |
| 2026-06-25 | **Multi-Tenancy** — pooled single-DB (organizations → hospitals → commissions); vendor `platform_admin` vs customer `org_admin`; RLS rewrite + 3-tier audit + multi-org PHI guard | [0041](docs/decisions/0041-multi-tenancy-organizations-hospitals.md) |
| 2026-06-20 | **PHI-remediation Round 3** — RCA-write severance (drop `is_admin` from 7 `rca_*_write`) + WS B audited free-text reads/PHI classification + WS E efficiency | plan §A4/B/E; ADR 0030/0031 |
| 2026-06-20 | **PHI-remediation WS C** — PHI retention & disposal (`dispose_event_phi`, one-shot HC056, constrained reason enum) | plan §C; ADR 0030/0031 |
| 2026-06-20 | **PHI-remediation WS A** — structured-identifier lockdown: real `pqs_members` roster, tight `can_read_event_patient`, single audited door, sever platform-admin from NSP PHI | plan §A; ADR 0030/0031 |
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

### ▶ FUP-FF1-2 — FF-1 QA non-blocking items (review r2: 4 MINOR / 6 INFO)

All ruled non-blocking by `qa`; [review](docs/reviews/phase-FF-1-review.md). INFO-1 and INFO-5 are
already discharged and are listed only so the numbering reconciles against the report.

- [ ] **MINOR-1 — `completeness_authorities_agree` is one-directional in pgTAP.** Neutralising *every*
  blocking arm of `submit_response` (both `HC011` raises **and** the `HC0N5` minInstances raise) still
  leaves the suite 52/52. H1c is a `lives_ok` (asserts submit *succeeds*), and `HC0N5`'s only occurrence
  in `supabase/tests/` is inside H1c's **description string**, never a `throws_ok`. No live hole — E2E
  FF1-4/FF1-5 carry the blocking direction — but **the fast gate cannot see a submit-side group
  blocking regression.** Fix: one `throws_ok(… 'HC0N5')` at the H4a state.
- [ ] **MINOR-2 — the suite header documents a keystone that does not exist.** *"MUTATION F5: drop the
  re-pack UPDATE from `remove_group_instance` → F5 red"* — there is no F5, and `remove_group_instance`
  is never called in `supabase/tests/`. E2E covers it (FF1-9 removes position 0 of 2, exercising the
  re-pack). Fix: write F5, or delete the claim — a documented mutation for a non-existent keystone is
  worse than no note.
- [ ] **MINOR-3 — MUTATION F3 names the wrong mutation.** Removing `set constraints … deferred` leaves
  the suite green; the real guard is BE-1's `DEFERRABLE` alter (proven both directions in r1:
  non-deferrable ⇒ the naive swap raises `23505`). F3 *is* a keystone — for the alter, not the
  in-function statement. Fix: correct the header.
- [ ] **MINOR-4 — stale-comment asymmetry in `supersede_response`.** The *"…while repeating groups are
  inert"* comment is gone from `start_correction_draft` but survives in `supersede_response`, so two
  sibling functions now carry **contradictory premises about the same join**. Zero functional effect
  (the corrected mechanism is spelled out directly below it). `qa`'s ruling: **do not mint a migration
  whose entire content is a comment rewrite** — that adds another body-rewrite to the chain CLAUDE.md
  §graphify already treats as a hazard. **Let it ride the next migration touching those bodies** — which
  INFO-6 guarantees is coming.
- [ ] **INFO-2 — no coherence guard on the direct-DML path.** Nothing ties
  `response_group_instances.group_item_id` to a `repeating_group` of the response's own `form_version`
  (the FK is only `→ form_items(id)`). The RPC path is fully gated (`assert_group_writable`, `HC0N4`);
  ruling 5 deliberately leaves direct DML open, so the exposure is a user writing junk into **their own**
  draft — no cross-tenant read, no PHI. Belongs with **FUP-FF1-1**.
- [ ] **INFO-3 —** `src/lib/responses/actions.ts:384-390`: the `p_instance_answers` comment block is
  duplicated verbatim.
- [ ] **INFO-4 — the parity vectors have no drift detector.** Hand-mirrored SQL ↔ JSON, byte-equal today
  (21/21), matching the pre-existing `condition-vectors.json` convention — so not an FF-1 regression. But
  **Rule 3 calls evaluator drift phase-blocking and nothing detects it.** Worth a real detector before
  FF-3, which adds a second evaluator pair.
- [x] **INFO-1 — superseded by MINOR-4** (r2: the stale comment was removed from
  `start_correction_draft`; only `supersede_response` retains it).
- [x] **INFO-5 — DISCHARGED at the Record step 2026-07-27**: `20260828000900_enable_repeating_groups.sql`
  written and applied (flag verified `enabled = true`, 198 files = 198 registered), and
  `docs/backend-state.md`'s high-water corrected (**`HC0M9`**, not `HC098`; FF-1 allocated `HC0N0`–`HC0N5`).
- [x] **INFO-6 — CARRIED FORWARD as a binding FF-2/FF-5 requirement**, not left as a note →
  [flexible-forms-program.md](docs/plans/flexible-forms-program.md) §3 FF-2/FF-5, with named keystones
  (`correction_copies_matrix_answers` / `correction_copies_reference_answers`).

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

- [ ] **Action-items hub — deferred satellites (partner-handoff Phases 2–4; ADR [0050](docs/decisions/0050-action-items-fold-visibility-scope-case-access-expiry.md)). PULLED PRE-PILOT 2026-07-12 (ADR [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md))** → [detail](docs/progress/deferred-backlog.md)
- [ ] **Action-items case cross-link UI + `visibility_scope` toggle for meeting/manual items (deferred from ADR 0050 F1). PULLED PRE-PILOT 2026-07-12 (ADR [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md))** → [detail](docs/progress/deferred-backlog.md)
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
