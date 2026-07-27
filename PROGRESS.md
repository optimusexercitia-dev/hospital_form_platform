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

_No active build phase._ **FF-1 (Repeating Groups) ✅ COMPLETE 2026-07-27** — QA APPROVED r2,
human-approved, flag `repeating_groups` **ON** (gate flip `20260828000900`). Full record →
[ff-1-repeating-groups.md](docs/progress/ff-1-repeating-groups.md) (tasks, 5 bugs, test runs,
the full `e2e:prod` gate triage). **FF-2 (Matrix & Risk Matrix) is IN FLIGHT since 2026-07-27** —
PO hold released, ADR [0089](docs/decisions/0089-ff2-matrix-risk-matrix.md) accepted (0088 was
taken the same day by the case-type assignment fix below). Detail → the FF-2 block.

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

### 🚦 FF-2 — Matrix & Risk Matrix · IN FLIGHT (started 2026-07-27)

Worktree `worktrees/ff/flexible-forms-program`, branch `ff/flexible-forms-program`, forked from
`main` at `b656ad4`. Flag `matrix_fields` — **not seeded yet** (FF-2 creates it, OFF).
**Migration window `20260830000000+`** (`20260829…` is ADR 0088's).

**✅ ADR [0089](docs/decisions/0089-ff2-matrix-risk-matrix.md) — accepted 2026-07-27.** Four PO
rulings settled the §3 FF-2 open questions:

1. **Cell contract = radio grid** — columns *are* the options; each row takes exactly one column,
   `value = 'true'::jsonb`. Enforced by a new `UNIQUE (answer_id, row_id)`. Typed cells stay
   reachable later as a constraint drop + config key (no answer-table migration).
2. **Risk score** — new nullable `weight numeric` on **both** axis tables;
   `risk_score = severity.weight * likelihood.weight`, derived server-side, never client-supplied;
   bands as ordered thresholds in `form_items.config.riskBands` (derived for display, not stored).
   ⚠ `form_item_options.risk_weight` is the *options* lane and is unrelated despite the name.
3. **`required` = every row answered** (row-complete), in the flat **and** per-instance loops.
   Item visibility still wins — hidden matrix requires nothing.
4. **Axis `code`s immutable** — relabel/reorder/add/remove yes, re-key never, via a `BEFORE UPDATE`
   trigger that does not consult version status.

**Live-catalog audit at phase start** (200/200 registered, max `20260829000100` = last file; read
from `pg_proc`/`pg_policies`/`pg_constraint`, never migration text) confirmed the plan's scope and
found **one hazard the plan does not record**:

> 🔴 **`app.instance_is_empty` is blind to the matrix tables** (ADR 0089 §A — NEW). It decides
> presence from `answers.value` and `answer_selected_options` only. A matrix answer's payload lives
> in `answer_matrix_cells`/`answer_risk_matrix` with `answers.value` **null**, so the moment FF-2
> ships writers, a repeating-group instance holding *only* a filled matrix is judged empty and
> **pruned by `submit_response` — silently destroying the answer**, cells cascading after it. Same
> class as FF-1's P0-1. Needs two more arms + a **mutation-proven** keystone
> (`instance_not_empty_with_matrix_only`). **FF-5 inherits the identical blindness for
> `answer_references`.**

Also confirmed live: `clone_form_version` copies options but **neither axis table** (INFO-1 matrix
half — publishing a matrix then editing it loses the grid); and neither correction RPC copies the
two matrix tables (the inherited P0-1 obligation below). Full keystone table → ADR 0089.

**Shared-stack hazards from the previous handoff are CLEARED** — ADR 0088's two migrations landed
on `main` at `b656ad4`; `registered == files == 200`, no drift. The `20260830000000+` window and
the file-contention note (`feature-flags.ts`, `seed.sql`, `database.ts`) still stand.

#### 🔵 PO rulings 2026-07-27 (post-E2E) — three decisions, all binding on the gate

1. **FUP-FF2-1 AND FUP-FF2-2 are both pulled IN, before the gate.** FF-2 does not gate while two
   pieces of its own ADR 0089 scope are unbuilt. Rationale accepted: without FUP-FF2-2 a filled
   matrix is **write-only** — grids that appear in no dashboard, on a platform whose stated purpose
   (CLAUDE.md §1) is that statistics come from dashboards — and its absence is also why
   `supersession_matrix_excluded` has no keystone and the plan's "author → fill → dashboard golden"
   E2E cannot be written. FUP-FF2-1 is smaller but sharper: a signer reviewing a section containing
   a matrix currently sees every other answer and an **empty grid**, then signs. Both move from the
   follow-up table into FF-2's build scope. Ownership: `backend` (`dashboard.ts`, `signoffs.ts` +
   the RPC payload), `frontend` (the sign-off view + the (row, col) picker UX).
2. **BUG-FF2-004 — fix `slugifyLabel` now** (`src/lib/forms/option-code.ts`, backend-owned):
   NFD-normalize and strip combining marks so `Higienização das mãos` mints
   `higienizacao_das_maos`, not `higienizac_a_o_das_ma_os`. Changes minted keys **platform-wide
   going forward** for every item type, not just FF-2 axis codes. Ruled in because we are pre-pilot
   with no live users, existing codes are immutable and untouched, and the repo's standing position
   is to design correctly now rather than carry back-compat ([[prelaunch-db-reset-ok]] reasoning).
3. **A `-\[--` guard joins the lint gate.** The Tailwind-v4 dead-class bug class (BUG-FF2-003) was
   invisible to tsc, lint, unit tests, `next build` **and** code review, surfacing only as an
   unreachable feature; nine sibling sites were silently dead motion tokens nobody would ever have
   reported. The pattern is *always* wrong under v4, so the guard has no false-positive surface.
   Lead-owned (lint config), and it lands **after** `tester` rewords the phantom-minting comment at
   `e2e/builder-dialog-ui.spec.ts:229` — otherwise the guard fails on that comment.

**Two things worth doing before or during FF-2** (both from FF-1's QA, neither blocking):
**INFO-4** — the SQL↔TS parity vectors have **no drift detector**, and FF-3 adds a *second*
evaluator pair; a real detector is cheapest now. **MINOR-1/2/3** — three pgTAP corrections that
could ride FF-2's gate. Detail in **FUP-FF1-2** below.

> 🔴 **FF-2 / FF-5 inherit a binding obligation from FF-1's P0-1** — `answer_matrix_cells`,
> `answer_risk_matrix` and `answer_references` all hang off **`answer_id`** and are copied by
> **neither** correction RPC. Correct only while write-inert. Each phase's writer needs a copy
> block **with the instance remap**: a correction gives the successor its own
> `response_group_instances` rows, so any join matching `new.group_instance_id` to
> `old.group_instance_id` is unsatisfiable by construction. That exact bug shipped in FF-1 as a
> P0 (a correction silently destroyed every choice answer inside a repeating group, proven live
> 2 → 0). FF-1's K4 covers **selections only** — nothing existing catches a repeat. Stated in
> [flexible-forms-program.md](docs/plans/flexible-forms-program.md) §3 FF-2/FF-5 with named keystones.

#### `backend` — Wave 1 (schema + contract) ✅ COMPLETE 2026-07-27

Eight migrations, `20260830000000`–`…000700`; `registered == files == 208`, max
`20260830000700`. Applied + full `db reset` replay clean.

| # | Migration | Lands |
|---|---|---|
| 000000 | `ff2_matrix_schema` | `weight` on both axis tables · `UNIQUE (answer_id, row_id)` · code-immutability triggers · cross-item coherence triggers · submitted-immutability on both answer tables (REUSES `app.guard_submitted_selections` — answer_id-generic, not selection-specific) · `form_items_input_vs_display` relaxed for matrix/risk_matrix (**`reference` stays pinned until FF-5**) |
| 000100 | `ff2_matrix_flag` | `matrix_fields`, inserted **disabled**; no gate flip in this wave |
| 000200 | `ff2_upsert_matrix_axes` | `upsert_matrix_axes` (DEFINER, draft-only, authority-first, audited) + `app.validate_matrix_axes` wired into `publish_form_version` |
| 000300 | `ff2_matrix_answer_writers` | `app.save_matrix_answers` / `app.save_risk_matrix_answers` (DEFINER; `risk_score` derived, client score never read) + the ownership gate |
| 000400 | `ff2_save_section_matrix_arm` | `save_section_answers` gains `p_matrix_cells` / `p_risk_matrix`; `app.save_instance_answers` gains the same two entry keys |
| 000500 | `ff2_completeness_matrix` | `app.instance_is_empty` +2 arms (§A) · **`app.item_required_satisfied`** — the four inlined presence tests collapsed into ONE predicate · `response_required_complete` + `submit_response` dispatch to it |
| 000600 | `ff2_clone_deep_copy` | `app.copy_version_children` extracted (INFO-1) + axes copied with codes/weights |
| 000700 | `ff2_correction_matrix_copy` | the **four** correction copy blocks, instance-resolving join |

**Decisions worth flagging.** (a) Matrix answers **extend `save_section_answers`** rather than
landing as siblings — the cell FK needs its parent `answers` row in the same transaction, and FF-1
already settled "one payload, one round trip". (b) The four duplicated required-presence blocks
were **collapsed into `app.item_required_satisfied`**: adding a matrix arm to three of four is a
bug no test distinguishes from the fix. (c) `clone_form_version` stays INVOKER (its RLS-gated
`form_versions` INSERT is the authority proof); the DEFINER helper **re-checks the displaced
`form_*_staff_admin_write` predicate on BOTH endpoints**, because a DEFINER's gate replaces RLS.

**K9 re-verified live after the writers shipped:** all four matrix tables still `SELECT`-only for
`authenticated`; direct INSERT/UPDATE denied (42501). Grants are **table-level** (only
`case_referral` is column-level), so `weight` inherited SELECT.

⚠ **Constraint relaxation swept:** `supabase/tests/209_flexible_forms.sql` §B1 pinned
"required=true matrix rejected" and was rewritten (B1a/B1b accept matrix + risk_matrix, **B1c keeps
`reference` pinned**); plan 38 → 40.

**Green bar:** typecheck clean · `npm run lint` 0 errors / 0 warnings · Vitest **497/497** (38 files)
· `npx next build` **succeeded**.

One frontend-owned file touched mechanically: `src/components/forms/item-type-meta.tsx`
(exhaustive `Record<ItemType, …>` + unguarded lookups → a missing entry is a runtime crash, not
cosmetics).

#### 🔴 BUG-FF2-001 — the matrix writers were UNREACHABLE from the authoring path (found + fixed)

Found by `frontend` and confirmed live by the lead immediately after Wave 1. **`addItem` /
`updateItem` could not create or edit a `matrix` / `risk_matrix` item**, so `upsert_matrix_axes`
had no caller in the product:

- `ALL_ITEM_TYPES = [...INPUT_TYPES, ...DISPLAY_TYPES, ...CONTAINER_TYPES]` — neither matrix type
  was in any of the three, so `addItem` rejected with `itemTypeInvalid`.
- `parseItemFields` dispatched on the same three sets and fell through to `itemTypeInvalid`.
- `question_key` was minted only when `isInput`, but a matrix **is** answerable and the aggregation
  contract is `(question_key, row_code, col_code)` — and `form_items_input_vs_display` *requires* a
  key for both types.

**Class: `declared-param-no-caller` — third instance in this repo** (after ETH·E3a's
`p_case_type_id`). Fails **CLOSED** (`addItem` rejects; no bad data reached the DB), and was
invisible to lint, typecheck, `next build`, the unit suite and every pgTAP keystone — because none
of them crosses the seam between the builder form and the database. Wave 1's live proofs were real
but drove the writer *directly* and through *seeded* rows, never through the authoring path.

**Fixed:** `MATRIX_TYPES` (imported from `item-tree`, not a fourth spelling) folded into
`ALL_ITEM_TYPES`; a `parseItemFields` matrix arm (label required, `required` via `parseRequired`
per ruling 3, `config` via `parseItemConfig`, options/default_value/content null); the `isInput`
question-key gate widened to `ANSWERABLE_TYPES` at **both** sites (mint + collision-retry);
`configRiskBands` parsing added to `parse-config.ts`.

**Covered by a new seam test** — `src/lib/forms/actions.test.ts` drives the ACTIONS with a mocked
client, the same shape FF-1's BUG-FF1-001 forced. **Mutation-proven:** removing `...MATRIX_TYPES`
from `ALL_ITEM_TYPES` turns 6 of 12 red; reverting the question-key gate to `INPUT_TYPES` turns the
`question_key` assertion red. Both restored.

**Reachability sweep of every Wave 1 surface** (lead-requested, post-fix): `upsert_matrix_axes` ←
`upsertMatrixAxes` ← `matrix-axes-editor.tsx`; `p_matrix_cells`/`p_risk_matrix` ← `saveSection` ←
`matrix-grid.tsx` / `risk-matrix-picker.tsx`; `ResponseForFill.matrixCellsByItemId` /
`riskMatrixByItemId` and `Item.matrixRows`/`matrixColumns` ← the same two wizard components;
`config.riskBands` ← `risk-bands-editor.tsx`. **`matrixFieldsEnabled()` has no caller yet** — owned
by `frontend` for the picker/wizard gate. No surface fails open.

#### `backend` — Wave 2 (pgTAP keystones) ✅ COMPLETE 2026-07-27

`supabase/tests/271_ff2_matrix_fields.sql` — **79 assertions**, every keystone in ADR 0089's
§Consequences table except `supersession_matrix_excluded` (see FUP-FF2-2 — deliberately absent
rather than written against a path that does not exist).

**Full ordered `supabase test db` from a clean `db reset`: 137 files, 4006 tests, `Result: PASS`**
(baseline before FF-2 was 3925). Sections: §0 flags asserted-not-forced · §A K9 after the writers
shipped (denial *and* the door working) · §B code immutability + publish validation · §C one column
per row · §D coherence · §E server-derived score · §F row-complete · §G deadlock-negative **with an
anti-vacuity twin** · §H clone + gate parity · §I submitted-immutability · §J/§K the two
mutation-proven ones · §L the collapsed predicate on all four paths.

**Mutation proofs performed (ADR 0079), red output observed:**

| Keystone | Mutation | Observed |
|---|---|---|
| `instance_not_empty_with_matrix_only` (§J) | both matrix arms removed from `app.instance_is_empty` | **6 red** — J1 false; J4 instance count `have: 0 want: 1`; J5 cells `have: NULL want: i1->ic_a,i2->ic_b`; K4/K5/K6 collateral (§K's instances pruned too) |
| `correction_copies_matrix_answers` (§K) | the instance-resolving subquery in `supersede_response`'s cells block → `new_a.group_instance_id is not distinct from old_a.group_instance_id` | **exactly 2 red** — K4 `have: NULL want: i1->ic_a`, K5 `have: NULL want: i2->ic_b`. **K2 (top-level) and K3 (risk) stayed GREEN**, which is the proof that a top-level-only keystone is structurally blind to this defect — FF-1's K4 blindness, generalised |

Both restored; a clean `db reset` + full suite re-run confirms the migrations alone produce green.

#### 🔴 Two further Wave-1 defects, found BY the Wave-2 run and fixed (`20260830000800`)

1. **SQL-NULL trap in three "reject a missing key" guards — the guard failed OPEN.**
   `x -> 'weight'` on an object with no `weight` key is SQL NULL, and `jsonb_typeof(NULL)` is NULL,
   so `jsonb_typeof(x -> 'weight') <> 'number'` evaluated to NULL rather than TRUE and the EXISTS
   never matched. The guard rejected a weight of the wrong *type* and waved through a weight that
   was *absent* — exactly the case it existed for. Caught by keystone **A13** (`caught: no
   exception`) and **E5**. Blast radius was larger than the missed error: `upsert_matrix_axes` then
   REPLACED the risk axes with the weightless payload, so publish failed HC0P6, `risk_score` came
   back NULL, and an axis code vanished — **six further keystones red from one root cause**. Fixed
   with `coalesce(jsonb_typeof(...), 'missing')`.
2. **`app.copy_version_children`'s gate was STRICTER than the RLS it displaced** — it broke
   `61_answer_model_v2`, `203_others_and_length` and `209_flexible_forms`, all of which drive
   `clone_form_version` with **no JWT** (as the owner, for whom RLS is bypassed). The rule a DEFINER
   gate must satisfy is *neither weaker nor stronger* than the policy it replaces; the check is now
   scoped to callers that have an authenticated identity. Not a hole — `app` is not PostgREST-exposed
   and `clone_form_version` is still INVOKER, so an anonymous caller is refused by the RLS-gated
   `form_versions` INSERT first. **Both arms are keystoned (H5 live-gate / H6 no-JWT parity).**

Also swept: **`184_hospital_admin_isolation` §11 counted CCIH's seed forms (1)** and my seed demo
form made it 2 — the same "when you add data, grep for the test that counted it" class as the
§B1 CHECK sweep. Expectation updated; the isolation proof (0 rows from the sibling hospital / other
org) is untouched.

#### `frontend` — Builder + Wizard UI ✅ COMPLETE 2026-07-27

Nine new files, twenty-six touched. Built against `backend`'s posted signatures (`a2fbe35`
+ `1a173a5` + `3edfe02`), never against a guessed shape.

**Builder.** `MatrixConfigDialog` (`src/components/forms/matrix-config-dialog.tsx`) is the only
writer of the axes — deliberately NOT part of the item editor's `<form action={addItem}>`, because
`upsertMatrixAxes` is keyed on an item id that does not exist in "add" mode, and because REPLACE
semantics are only honest if one piece of state owns the COMPLETE axis. `MatrixAxesEditor` offers
relabel / reweigh / reorder / add / remove and **no re-key affordance anywhere**; the immutable
`code` is shown read-only (mono, muted) so an author can see why relabelling is free and removal is
not. `RiskBandsEditor` authors `config.riskBands` as THRESHOLDS and previews the derived ranges
("Alto a partir de 27") rather than making the author keep two ends in sync. Both matrix types are
offered in "Adicionar bloco" under a new **Matrizes** group, gated on `matrix_fields`.

**Wizard.** `matrix` renders a radio grid, `risk_matrix` a severity × likelihood picker with the
score computed live from the axis weights and the band derived from `config.riskBands` — **display
only; no score is ever sent** (the write contract has no field for one). Both work per-instance
inside a repeating group, and the review screen renders the filled grid and the score + band
through the SAME components, read-only, so author preview / fill / review can never drift.

**Three decisions worth flagging.** (a) Matrix answers live in their OWN state slices, never in
`AnswerState` — a matrix has `answers.value` NULL by design, so merging it would put a non-value in
the derived `AnswerMap` and corrupt every condition evaluated after it. (b) `isInputItem` stays
FALSE for matrix (it means "scalar in `answers.value`" and a dozen call sites depend on that); a new
`isAnswerableItem` carries the widened meaning, mirroring backend's `ANSWERABLE_ITEM_TYPES` vs
`INPUT_ITEM_TYPES` split. (c) `collectScope` / `validateSection` now take the whole SCOPE object
instead of positional slices, so FF-5's references cannot produce a call site that forgets to pass
them — the FBE-004 / FBE-008 failure mode, closed by construction. Related: the builder's flags moved
from a boolean drilled through six components into a `BuilderFlagsProvider`, so FF-3/FF-4 add a flag
in one place instead of four.

**`app.instance_is_empty` has a client twin now.** `isEmptyInstance` counts matrix content, matching
the SQL arms ADR 0089 §A added. Without it the review screen would hide a repetition the server is
about to keep.

**Verified in a running app**, not just compiled — a real Chromium against a worktree dev server,
because the agent Browser pane never composites and therefore never hydrates (a stale-looking UI
there is a harness artifact, not a defect; worth knowing before someone re-debugs it). Fill: 3 cells
persisted one-per-row + `risk_score = 27` **derived server-side** from 9 × 3, response `submitted`.
Builder: clone → axes deep-copied with codes and weights (INFO-1 confirmed live), relabel kept
`higienizacao`, an added column minted `parcial_6w7jwu` client-side, bands persisted sorted, publish
→ fill shows the relabelled row, the added column and "Pontuação: 27 · Alto". **A matrix authored
from scratch through "Adicionar bloco" was driven end to end** after `3edfe02` landed — the seam
BUG-FF2-001 had made unreachable.

**Keyboard/a11y proven against the real DOM**, not asserted in a comment: `<caption>`, `th[scope]`
both ways, `headers` on every cell, ONE native radio group per row (Tab walks rows, arrows walk the
scale — the platform's behaviour, not a hand-rolled roving `tabIndex`), and each control announces
both coordinates ("Higienização das mãos, Conforme"); a risk cell adds its score and band. The
risk grid is ONE `radiogroup` because it is one choice.

**Green bar:** typecheck clean · `npm run lint` **0 errors / 0 warnings** · Vitest **553/553**
(41 files; +36 in `src/lib/forms/matrix.test.ts` and
`src/components/responses/wizard/matrix-wizard.test.ts`) · `npx next build` **succeeded**.

> 🔴 **BUG-FF2-002 — `backend`'s file, reported not fixed.** `publishVersion`
> (`src/lib/forms/actions.ts:1752`) maps only `23514` and `HC080`; every other code falls to
> `MESSAGES.generic`. So publishing a version whose matrix has **no axes** — a real and expected
> authoring state, which `app.validate_matrix_axes` refuses with **`HC0P5`** (and `HC0P6` for a
> missing risk weight) — tells the author only "Não foi possível concluir. Tente novamente." with
> no hint which block is at fault. **Reproduced live**: publish failed; deleting the axis-less
> matrix made the same publish succeed. Needs `HC0P5` → `MESSAGES.axisInvalid` and `HC0P6` →
> `MESSAGES.riskWeightRequired` (both strings already exist in that file). Violates Rule 10 / §8.

#### 🔴 BUG-FF2-002 — `publishVersion` swallowed every FF-2 publish error (found + fixed)

Found by `frontend` by hand, verified by the lead. `publishVersion` mapped only
`23514`/`HC080`; everything else fell to `MESSAGES.generic`. So publishing a version whose matrix
had **no axes** — a *normal* authoring state, since `upsert_matrix_axes` is a separate call and a
matrix block exists with an empty grid from the moment it is added — reported only *"Não foi
possível concluir. Tente novamente."*: not transient, not retryable, and naming no block. The only
way out was deleting matrices until publish succeeded. `upsertMatrixAxes` already mapped these two
codes, so the inconsistency was **within one file**. Violates Rule 10 / §8.

**Fixed:** `HC0P5` / `HC0P6` cases added, preferring the DB message because it NAMES the offending
item (`a matriz "X" precisa de ao menos uma linha e uma coluna`) — the difference between an
actionable error and a dead end — with `MESSAGES.axisInvalid` / `riskWeightRequired` as fallback.

**Sweep for siblings** (lead-requested — this was found the slow, human way, so siblings were
likely). All four RPC call sites that can surface an `HC0P*` were audited against every raise site:

| Path | Codes reachable | Before | Now |
|---|---|---|---|
| `publishVersion` | HC0P5, HC0P6 | generic | mapped (the reported bug) |
| **`saveSection`** | **HC0P1, HC0P2, HC0P3, HC0P7, HC0P8, 42501** | **all generic** | **mapped** |
| `startEditFromPublished` | 42501 from `app.copy_version_children` | generic | mapped → `forbidden` |
| `upsertMatrixAxes` | HC0P2–HC0P6, 42501 | already mapped | unchanged |

`HC0P0` is unreachable from any app path (the only UPDATE of an axis row is `upsert_matrix_axes`,
which matches on `code` and never changes it; direct DML is denied by K9). `HC0P4` cannot surface
through the clone path (a clone's target is always a fresh draft).

**The most consequential sibling was `HC0P8` in `saveSection`** — reachable by ORDINARY USE: a
respondent who picks a severity but not a likelihood got "tente novamente" instead of "informe a
severidade e a probabilidade". Same defect as the reported one, on the fill path rather than the
builder path, and it would have been found the same slow way.

Covered by unit tests in `src/lib/forms/actions.test.ts` + `src/lib/responses/actions.test.ts`
(each asserts the raw SQLSTATE and Postgres text never reach the UI). **Mutation-proven:** removing
the two `case`s from `publishVersion` turns 4 red; restored. Vitest **565/565**, lint 0/0,
typecheck clean, `next build` succeeded. **Code-only — no DB verification run, per the lead's
stack-ownership hold.**

> ⚠ **Adjacent finding, NOT fixed (FF-1 scope, needs the lead's call):** `saveSection`'s chain also
> drops FF-1's **`HC0N2`** (`app.save_instance_answers`: "item do bloco não encontrado nesta
> resposta") into the same generic bucket. Identical class, shipped phase — reported rather than
> silently widened.

#### ⚠ OUT-OF-PHASE FIX — BUG-FF1-006 (`HC0N2`), attributed to **FF-1**, riding FF-2's gate

**Not FF-2 scope.** Surfaced by the BUG-FF2-002 sweep, reported rather than fixed, and **ruled in
by the lead** on the merits: same chain, same file, ~3 lines, purely an error-message mapping with
no behaviour change — and a **live user-facing pt-BR defect in a shipped phase**, so deferring it
would ship a known-bad message to the pilot and orphan the item against FF-3. Precedent: ADR 0088
was itself an out-of-phase fix. `qa` should read this as a deliberate scoped exception, not FF-2
scope creep.

`app.save_instance_answers` raises `HC0N2` for two distinct conditions — *"entrada de bloco
repetível sem identificador"* and *"item do bloco não encontrado nesta resposta"* — and
`saveSection` dropped **both** into `MESSAGES.generic`. `mapGroupError` (used by the three instance
RPCs) has mapped `HC0N2` since FF-1; `saveSection` simply never consulted it, making this the same
within-one-file inconsistency as BUG-FF2-002.

**Fixed** by preferring the DB message (the two raise sites say different things and the single
constant can only say one), falling back to `MESSAGES.groupInstanceMissing`.
**Mutation-proven:** removing the case turns 3 red — all three assertions report
`Received: "Não foi possível concluir. Tente novamente."`; restored. Committed separately as
`fix(ff-1): …` so its diff is reviewable on its own. Vitest **568/568**, lint 0/0, typecheck clean,
`next build` succeeded. Code-only — no DB verification (`tester` owns the stack).

#### Why two FF-2 codes are deliberately UNMAPPED (recorded so nobody "completes" the gap)

`HC0P0` and `HC0P4`-via-clone have **no `case`** in `src/lib/forms/actions.ts`, on purpose, and the
reasoning is in a code comment beside the constants — not only here:

- **`HC0P0`** (axis code immutable) fires from a `BEFORE UPDATE` trigger. The only UPDATE any app
  path issues is inside `upsert_matrix_axes`, which matches rows **on** `code` and never writes it;
  direct DML is denied to `authenticated` by K9. Unreachable.
- **`HC0P4`** cannot surface through `startEditFromPublished` — `clone_form_version` creates the
  target itself, so it is always a fresh draft. It *is* reachable through `upsertMatrixAxes`, where
  it **is** mapped.

A `case` for an unreachable code is not free: it reads as reachable to the next person and invites
a unit test that can never fail — a vacuous keystone by construction (ADR 0079).

#### `backend` — Wave 3 (PO rulings) ✅ COMPLETE 2026-07-27

Migrations `20260830000900`–`…001000`; `registered == files == 211`. Full ordered
`supabase test db` **from a clean reset: 137 files, 4013 tests, `Result: PASS`**. Vitest
**587/587** · lint 0/0 · typecheck clean · `next build` succeeded · types regenerated with pgtap
absent (`0` pollution matches, +41 lines).

**FUP-FF2-2 — dashboard aggregation.** `dashboard_matrix_cells` (cell unit
`(question_key, row_code, col_code)`) + `dashboard_risk_scores` (one row per
(severity, likelihood) pair carrying `risk_score` as a NUMBER, plus per-key n/avg/min/max). Both
built on `app.submitted_form_responses`, so the supersession rule is the *same object* the four
existing aggregations use rather than a fifth copy. Aggregation resolves through **`code`**, never
`row_id`/`col_id`.

**`supersession_matrix_excluded` written and MUTATION-PROVEN** (§M of 271). Designed on `tester`'s
close-out lesson — *assert the property that changed, not the number that moved*: predecessor and
successor get **different columns and different weights**, so a count-only assertion (also `1` if
the SUCCESSOR were wrongly excluded, or if neither registered) cannot pass by accident. M1/M2 pin
the other half first — a merely `in_progress` successor must NOT blank the metric. Dropping the
supersession arm turns four red: `M3 have: mc_no,mc_yes want: mc_no` · `M4 have: 2 want: 1` ·
`M5 have: 27 want: 3` · `M6 have: altaxfreq=27,baixaxraro=3`.

**FUP-FF2-1 — the signer sees the grid.** `get_response_for_signoff` gains `matrix_cells_by_item` /
`risk_matrix_by_item` at top level and per instance, via two scope-parameterised `app` helpers
(one definition, not four inline expressions). `risk_score` is projected, never recomputed — it is
the durable fact the signer attests to.

> 🔎 **A THIRD instance of the same blindness, swept:** `getSubmissionDetail` calls the same
> `buildGroupInstances` and likewise never populated the grids, so the **primary read of a submitted
> response** showed an empty matrix too. Wired through `buildMatrixAnswers`.
>
> **Optionality question — answered: YES, tightened.** With all three producers (fill, sign-off
> door, submission detail) populating, `GroupInstance.matrixCellsByItemId`/`riskMatrixByItemId` are
> now **required**. They were optional only because of the sign-off path; leaving them optional
> would now only hide a producer that forgot.

**BUG-FF2-004 — `slugifyLabel`.** NFD marks are now stripped, not collapsed into `_`. All four call
sites swept: every one **mints forward** and none re-derives a slug to look an existing code up, so
**no stored code moves and no migration rewrites keys** — `question_key` / option `code` / axis
`code` are the joins the dashboards aggregate on. Mutation-proven; unit-tested across
ç ã õ á é í ó ú â ê ô à ü plus the collision paths.

> 🔴 **BLOCKER FOR `tester`, not fixable by me (`e2e/**` is tester-owned).**
> `e2e/ff2-matrix.spec.ts:507-510` **pins the buggy slug** —
> `/^higienizac_a_o_das_ma_os_[a-z0-9]{6}$/` and `/^na_o_conforme_[a-z0-9]{6}$/` — with a comment
> deliberately preserving it as "long-standing behaviour, not something FF-2 introduced". The PO has
> now ruled it a bug, so those two regexes must become `higienizacao_das_maos_…` /
> `nao_conforme_…`. **This is `tester`'s own close-out lesson pointing the other way: a guard that
> pins the old symptom blocks the correct fix.** The E2E suite will fail on these two until updated.

> ⚠ **Reported, NOT fixed (pre-existing, FF-1):** the per-instance `observations_by_item` /
> `other_text_by_item` filters inside `get_response_for_signoff` compare against `''''` — a literal
> apostrophe, not the empty string — so an empty-string observation is not filtered out. Carried
> **byte-identical** through the FF-2 re-declaration so that migration has no undeclared behaviour
> change. Lead's call whether it rides this gate.

#### ⚠ OUT-OF-PHASE FIX — BUG-FF1-007 (`<> ''''`), attributed to **FF-1**, riding FF-2's gate

**Not FF-2 scope.** Surfaced while re-declaring `get_response_for_signoff` for FUP-FF2-1, carried
**byte-identical** so that migration had no undeclared behaviour change, reported — and then **ruled
in by the lead**, on the same reasoning as BUG-FF1-006: unambiguous, four characters, already in the
function this wave, and *"a known-wrong comparison left in place becomes folklore"*.

`a.observation <> ''''` in SQL source compares against a string literal containing **one
apostrophe**. The two per-instance filters therefore excluded observations equal to `'` and let
**empty-string observations through** — the precise opposite of their intent, and inconsistent with
the top-level filter three lines away (`btrim(a.observation) <> ''`), which is what makes it a
quoting slip rather than a design choice. Fixed in `20260830001100`.

**Sweep (lead-requested — a quoting slip is rarely unique).** Across **all** schemas,
`prosrc like '%''''%'` matches exactly two functions:

| Function | Occurrences | Verdict |
|---|---|---|
| `public.get_response_for_signoff` | 2 | **the bug** — plain expression; fixed |
| `storage.list_multipart_uploads_with_delimiter` | 3 | **correct** — inside a dynamic-SQL string passed to `EXECUTE` (note the `$4`/`$6` placeholders), where `''''` legitimately renders as `''`. Vendor code, different construct. |

No RLS policy `qual`/`with_check` contains the pattern. The storage hit is exactly why this was
fixed by reading each site rather than by a blind replace.

> **FUP-FF2-3 — DEFERRED by the lead, deliberately, 2026-07-27.** Fixing `''''` exposed a remaining
> asymmetry in the same function: the per-instance filters now compare `<> ''` while the top-level
> one uses `btrim(...) <> ''`, so a **whitespace-only** observation is still filtered at top level
> but not per instance. `backend` reported it rather than folding it in — correct, since it is a
> **different defect** from the one ruled in.
>
> **Not ruled in, and the reason is scope discipline rather than merit.** This is the third
> out-of-phase fix this wave (BUG-FF1-006, BUG-FF1-007), the phase is at its gate, and each one
> costs another migration, another clean-reset pgTAP run, and another re-serialization of three
> teammates on one DB. The impact is cosmetic — a blank observation block renders inside a group
> instance. A lead who never says no is how a gate stops meaning anything, so this one waits.
> **`qa` should see it as a stated deferral, not an oversight.**

**Keystone §N of 271** pins BOTH directions — an empty observation must be ABSENT and a real one
PRESENT (one direction alone is satisfied by a filter that drops everything, or nothing), plus N1
asserting the fixture really holds an empty string so N2 cannot pass vacuously.
**Mutation-proven:** restoring `<> ''''` in the two per-instance filters turns N2 and N4 red with
`have: <empty string> want: NULL`, while N1/N3 stay green. Restored via a clean `db reset`.

> ⚠ **Adjacent, NOT fixed (reported):** the per-instance filters compare `a.observation <> ''`
> while the top-level one uses `btrim(a.observation) <> ''`, so a whitespace-only observation is
> still filtered at top level but not per instance. A *different* defect from the one ruled in —
> reported rather than silently widened.

#### `frontend` — Wave 3 view halves (FUP-FF2-1 + FUP-FF2-2) ✅ COMPLETE 2026-07-27

Two commits, `4f65711` (reads) + `cbe4657` (dashboard), against `backend`'s Wave-3 contract.

**FUP-FF2-1 — the sign-off + submission reads.** The empty grid had **two** causes, which is why
it read as merely blank rather than broken: the door did not project the matrix tables (backend,
`08e02eb`), **and** both read views filtered blocks with `isInputItem`, which is FALSE for a matrix
— so a VISIBLE matrix fell through to the display branch and rendered nothing while a HIDDEN one
sailed past the visibility gate. Both now use `isAnswerableItem`. No second renderer was written:
the wizard's read-only `MatrixGrid`/`RiskMatrixPicker` serve all three surfaces via `AnswerSummary`,
and `InstanceAnswersReadonly` (already shared by both views) forwards the per-instance grids.
`ClientResponseForSignoff`'s two new fields are **required**, exactly as FF-1 made `instances`
required — an optional field here is how a future caller silently reintroduces a blind signature.

> **The stored score is never recomputed.** `RiskMatrixPicker` gained `storedScore`, which wins over
> the computed product wherever a durable `risk_score` exists. The product is the wizard's preview of
> a score that does not exist yet; once it is a recorded fact, re-deriving it from today's axis
> weights would let a re-weighting restate what a historical response — or a signature over it —
> appears to say.

**FUP-FF2-2 — the dashboard.** `MatrixDistributionCard` + `RiskDistributionCard`, joining the
existing section→item ordering. **Rendered as real tables rather than Recharts figures, deliberately:**
Recharts has no heatmap, so forcing one through it yields an `aria-hidden` SVG *plus* a duplicate
table as its text alternative. Here the grid IS the data's natural form, so one `<table>` is chart
and accessible alternative at once, with nothing to keep in sync. **Colour is never the channel** —
every cell prints its number (count + row share; count + stored score) and each card states in words
what the tint means. Risk tint follows the score **relative to the observed range**, because
`config.riskBands` is per-item authoring config and not part of this aggregate; claiming an absolute
"Alto" the data cannot support would be worse than saying nothing. Identity is `rowCode`/`colCode`
throughout — a `*Label` can change under a relabel (ruling 4) and keying on it would split the series.

**Verified in a running app** (own server on :3100; never :3000) against three submissions with
deliberately different cells: heatmap read **2/1, 1/2, 2/0/1** exactly; risk summary read
**média 36,33 · mínima 1 · máxima 81** — the stored 1/27/81, not values re-derived from weights.
Screenshots `ff2-15-submission-detail.png`, `ff2-16-dashboard-matrix.png`.

**One defect found in the browser and fixed** (no test would have caught it): the submission detail
printed `question_explanation` above the block while the grid rendered its own — the line appeared
twice and was announced twice.

**Green bar:** typecheck clean · `npm run lint` **0 errors / 0 warnings** (incl. the new `[--var]`
guard) · Vitest **593/593** (42 files; +25) · `npx next build` **succeeded**.

**Mutation-proven**, 6 new tests in `src/components/signoffs/signoff-matrix.test.tsx` rendering the
REAL `ReviewAndSign`: reverting the filter to `isInputItem` turns **4 red** (the original empty
grid); dropping the stored-score override turns **2 red** — the fixture's stored `99` deliberately
disagrees with the `9 × 3 = 27` the weights would give, so a recomputing implementation cannot pass.

> ⚠ **NOT verified in a browser: the sign-off screen itself.** No seeded published form has both a
> `staff_admin` sign-off section **and** a matrix (`…b001` has the sign-off, the matrix form has no
> sign-off section), and manufacturing one means cloning + publishing a v2 — structural drift into a
> seed `tester` is about to write specs against. The renderer and the data threading are covered by
> the 6 mutation-proven tests above and the door by backend's pgTAP, so what is unproven is
> specifically **their composition on that route**. → a spec for `tester`.

#### FF-2 follow-ups — ✅ BOTH CLOSED in Wave 3 (PO ruled them into gate scope)

Kept for the audit trail; neither is outstanding.

| id | Gap | Why deferred |
|---|---|---|
| **FUP-FF2-1** | `get_response_for_signoff` does not project `answer_matrix_cells` / `answer_risk_matrix`, so a signer reviewing a section containing a matrix sees the other answers but an **empty grid**. `GroupInstance.matrixCells/riskMatrix` are optional ONLY because of this path (commented at the call site in `src/lib/queries/signoffs.ts`). | Needs the RPC's JSON payload widened + the sign-off view; read-only display, no data risk. |
| **FUP-FF2-2** | Dashboard **cell-unit aggregation** — `(question_key, row_code, col_code)` counts and `risk_score`-as-number in `dashboard.ts`, each with its own supersession-tolerant predicate (ADR 0089 §Consequences). | Not built, so ADR 0089's `supersession_matrix_excluded` keystone is **deliberately absent** from `271_ff2_matrix_fields.sql` rather than written against a non-existent path. |

### 📋 Remaining pre-pilot work

Expanded 2026-07-12 — ADR [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md); **re-expanded
2026-07-27 — ADR [0086](docs/decisions/0086-flexible-forms-pre-pilot.md)** (Flexible-Forms FF-1…FF-5 pulled
pre-pilot). **FF-1 is ✅ COMPLETE (2026-07-27)**; this is the standing backlog — remaining
pre-pilot = the **FF program (five gated phases)**, the FUP-AI-1 workstream, then the **pilot deploy**.

· **S4 ✅ COMPLETE 2026-07-20** — ✅ **ETH·E2** (2026-07-18) + ✅ **Referrals v2 R2–R5** (2026-07-19) + ✅ **CH** Charters (Phase 21, 2026-07-20 — ADR [0080](docs/decisions/0080-committee-charters-cadence-model.md) / [detail](docs/progress/ch-charters-cadence.md)), all → `main`
· ✅ **S5 ETH·E3a COMPLETE 2026-07-27** — terminology/UX + auto-derived procedural timeline + ethics dashboard (E3b still needs Phase 16) → [eth-e3a-surfacing.md](docs/progress/eth-e3a-surfacing.md)
· Phase 16 — Standards Crosswalk (🔜 **deferred** 2026-07-11, needs replanning; blocks E3b)
· **BUG-AIF-001 / FUP-AI-1** (PO-directed pre-pilot; own workstream, not yet started)
· ✅ **BUG-PROD-ACTIONS — RESOLVED (environment drift, not a code defect).** `node_modules/next` had silently drifted to **16.2.9** (the pre-BUG-AIF-001 version) while `package.json`/lockfile pinned **16.3.0-preview.5**; `npm ci` → 16.3 + a `REBUILD=1` full run collapsed the 21–31s action-hang **and** the "~18–27 prod flaky baseline" to ~1. Confirmed in the Gate-2 version-drift audit (`2698696`); PO-approved at the Gate-2 close. Full investigation detail → [bug-log-archive.md](docs/progress/bug-log-archive.md).
· ✅ **P0 · AUDIT-DOOR-BLINDNESS — RESOLVED 2026-07-18, human-approved.** The door-level re-audit (292 gate neutralizations across every `authenticated`-reachable DEFINER door) found no live leak — platform-wide test-coverage debt, not a Gate-1 breach. Closed with a standing invariant (ADR [0079](docs/decisions/0079-authz-door-blindness-standing-invariant.md)) + 50 mutation-proven keystones; qa APPROVED. Full detail → [authz-p0-door-blindness.md](docs/progress/authz-p0-door-blindness.md).
· **Flexible-Forms Program — ✅ FF-1 (Repeating Groups) COMPLETE 2026-07-27** (ADR [0087](docs/decisions/0087-ff1-repeating-groups.md) + Amendment 1; QA APPROVED r2; flag `repeating_groups` **ON** via gate flip `20260828000900`; record → [ff-1-repeating-groups.md](docs/progress/ff-1-repeating-groups.md)). **Remaining: FF-2 → FF-3 → FF-5 → FF-4** (ADR [0086](docs/decisions/0086-flexible-forms-pre-pilot.md); all five gate the pilot deploy; per-phase ADRs 0088+ at each phase start). **FF-2 NOT started — PO-held 2026-07-27.** ⚠ FF-2/FF-5 inherit FF-1 P0-1's correction-copy obligation → [flexible-forms-program.md](docs/plans/flexible-forms-program.md)
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

FF-1's five (BUG-FF1-001…005 — three blockers, one critical, one blocker; all closed and
re-verified) are recorded with full repro/fix detail in
[ff-1-repeating-groups.md](docs/progress/ff-1-repeating-groups.md).

#### ✅ BUG-FF2-003 — the "Adicionar bloco" menu overflows the viewport with **no scroll**, so both new Matrix types are UNREACHABLE at 1280×720 · P1 · owner `frontend` · **CLOSED 2026-07-27, re-verified by `tester`**

> **Fix `98176d5` (cap) + `9d103d1` (nine-site sweep). Re-verified — the root cause was not what
> the symptom suggested.** The cap class was **present in the markup and silently dead**: Tailwind
> **3.4**'s bare `[--var]` shorthand (auto-wrapped in `var()`) was **removed in v4**, so the utility
> emitted a `max-height` whose value was the property *name*, which the CSS parser dropped —
> leaving `max-height: none`. The measurement below was right; the declaration never did anything.
>
> **`tester` verification, independent of `frontend`'s:** (a) the **built production CSS bundle**
> now carries `max-height:var(--radix-dropdown-menu-content-available-height)` with **zero**
> remaining bare `prop:--radix…` declarations; (b) at 1280×720 the cap resolves to a px value, the
> menu box ends within the window, `scrollHeight > clientHeight` so it genuinely scrolls, and every
> one of the 14 items is brought into view when focused; (c) `ff1-repeating-groups.spec.ts` is
> **9/9** — FF1-2 went **3.3 min timeout → 6.3 s**, FF1-7 **3.7 min → 7.1 s**, the file **8.2 min →
> 57 s**.
>
> **Guarded so it cannot return silently: `e2e/ff2-matrix.spec.ts` FF2-11**, which asserts the
> **computed** `max-height`, the geometry at 1280×720, real internal scrolling, and
> focus-brings-into-view across all 14 items — then opens a Matrix item by mouse.
> **Mutation-proven:** neutralising the declaration in the built CSS bundle turns FF2-11 red
> (`max-height nunca resolveu para um valor`); bundle restored byte-for-byte, green again.
> `e2e/builder-dialog-ui.spec.ts` did **not** catch this and now says why: it asserted
> `overflow-y` (genuinely present — and inert without a cap) plus last-item clickability at a tall
> viewport where the menu happened to fit. **Asserting a class is present is not asserting it
> works** — this bug's whole shape was a correct-looking class emitting nothing.
>
> ⚠ **Lesson recorded for `qa` and for FF-3+: Tailwind v4 scans `e2e/` as source, comments
> included.** A utility class named in a comment mints a real selector into the production bundle —
> the old comment at `e2e/builder-dialog-ui.spec.ts:229` was shipping ~90 bytes of dead
> `max-h-[--radix-…]` CSS and would read to a grep as an unfixed site. Both that comment and
> `frontend`'s fix comment are now prose with no code sample. **No utility-class literal belongs in
> a comment anywhere under `src/` or `e2e/`.**

*Original report, kept for the record:*

**Filed by `tester` 2026-07-27** (FF-2 test pass). Found by triaging two FF-1 specs that turned red
under FF-2, not by a spec that was looking for it.

*Repro (measured, not inferred — `matrix_fields` ON, staff_admin, a new empty form,
viewport 1280×720):* open **Adicionar bloco**. The `[role="menu"]` renders **909 px tall with
`max-height: none`**, from `y=273` to `y=1182` — **462 px past the bottom of the window**.

| Fact | Measured |
|---|---|
| items whose `bottom > innerHeight` | **7 of 14** — Hora · Texto explicativo · Imagem · **Matriz** · **Matriz de risco** · Grupo · Grupo repetível |
| page scroll while the menu is open | **locked** — `body{overflow:hidden}`, `data-scroll-locked="1"`, `window.scrollBy(0,400)` moves `scrollY` by **0** |
| menu's own scroll | **none** — `overflow-y:auto` but `scrollHeight <= clientHeight`, because nothing constrains the height |
| keyboard escape hatch | **none** — 14×`ArrowDown` lands focus on an item at `bottom 728` with `withinViewport: false`; nothing scrolls it in |

So the two block types FF-2 exists to ship cannot be selected at all on a common laptop viewport,
by mouse **or** by keyboard (violates CLAUDE.md §8's keyboard-accessibility bar).

*Expected:* every offered block type is reachable — the menu is bounded (e.g.
`max-h-[var(--radix-dropdown-menu-content-available-height)]` + `collisionPadding`) and scrolls.
*Actual:* the menu grows unbounded past the viewport and neither it nor the page will scroll.

*Attribution, stated precisely.* The missing `max-height` is **pre-existing** — with
`matrix_fields` **OFF** the same menu is **760 px / 12 items** and already puts 5 items off a
720-px viewport. FF-2 adds **+149 px** (a separator, the "Matrizes" label and 2 items), which is
what pushes the bottom group past viewports that previously fit. **FF-2 is the trigger, not the
root cause**, and both halves need the same fix.

*Regression evidence (deterministic, flag-toggled on the live DB, three flips):*
`e2e/ff1-repeating-groups.spec.ts` **FF1-2** and **FF1-7** fail on
`locator.click … element is outside of the viewport` (retry-until-timeout, 3.3 min / 3.7 min) with
the flag **ON**, and **FF1-2 passes in 17.6 s** with it **OFF**. Both are FF-1 specs at their own
1280×1400 viewport — the menu clears 1400 px only until the trigger sits lower on a page that
already has blocks. `e2e/phase5-wizard.spec.ts` is unaffected (12/12).

> ⚠ **This will surface in the full `e2e:prod` gate as two FF-1 reds with zero connection errors** —
> i.e. NOT the infra class the standing caveat covers. Triage them here, not against the flaky
> baseline.

#### 🟢 BUG-FF2-005 — two source files carry RAW NUL BYTES, so git treats them as BINARY and their diffs are unreviewable · MINOR/review-blindness · owner `frontend` · OPEN

**Filed by `tester` 2026-07-27**, found while orienting on the new dashboard surface — `git diff
--stat` reported `matrix-distribution-card.tsx | Bin 0 -> 7486 bytes` instead of a diff.

*Cause:* a composite map key is built with a **literal NUL byte** typed into the source rather
than the escape ` `:

```
const countAt = new Map(cells.map((c) => [`${c.rowCode}<NUL>${c.colCode}`, c.count]));
…
const count = countAt.get(`${row.code}<NUL>${col.code}`) ?? 0;
```

*Not a live defect* — both sites carry the same byte, so the lookup works, and choosing NUL as a
separator is sound (an axis code is a `[a-z0-9_]` slug and can never contain one). **Three
consequences make it worth fixing anyway:**

1. **`qa` cannot review this file.** Git classifies it as binary, so the phase diff shows
   `Bin 0 -> 7486 bytes` — a file that renders the FF-2 dashboard is structurally invisible to
   diff review. This repo has a documented history of review-blind defects.
2. **It fails SILENTLY if it degrades.** The separator must be byte-identical at both sites; an
   editor, a copy-paste or a lint autofix that strips control characters would break only ONE and
   every lookup would return `?? 0` — a distribution table of all zeros, with no error anywhere.
3. Text tooling (grep, `file`, patch) mis-handles it — `file` reports `data`, and the `Read` tool
   renders the NUL as a **space**, so reading the file suggests the separator is `" "`. Only a
   byte-level check shows what is really there.

*Fix:* write the escape (` `) instead of the raw byte — identical at runtime, file stays text,
diff stays reviewable.

⚠ **Not FF-2's invention: `src/components/safety/rca/whys-panel.tsx` has the same idiom**
(`.join("<NUL>")`, from `c4e20b3`, Phase 14) and is likewise binary to git. Both are the only
non-`favicon.ico` files under `src/` or `e2e/` containing a NUL, so the sweep is complete. Worth a
one-line convention rather than two point fixes.

#### ✅ BUG-FF2-004 — an axis code minted from an accented label renders mangled in the editor that deliberately SHOWS it · MINOR/cosmetic · **PO-ruled a bug; fixed in `fbada14`** · **CLOSED 2026-07-27, re-verified by `tester`**

> **Re-verified and closed.** `ff2-matrix.spec.ts` is **11/11** against a prod-standalone build of
> committed HEAD, with the five repinned regexes now asserting the folded ASCII slugs
> (`higienizacao_das_maos_…`, `nao_conforme_…`, `provavel_…`). The pins are the guard: a future
> change to the shared slugger is now a deliberate one.

> **Status, precisely.** The PO overruled the "pre-existing, so pinned as-is" disposition below and
> ruled it a bug; `fbada14` makes `slugifyLabel` **delete** NFD combining marks instead of
> collapsing them to `_`, so `Higienização das mãos` mints `higienizacao_das_maos`. My five pins in
> `e2e/ff2-matrix.spec.ts` are updated to the new output (**four in FF2-1, plus a fifth in FF2-2 —
> `prova_vel` → `provavel` — that was not in the hand-off list and would have gone red**). Swept
> `e2e/`, `src/`, `supabase/seed.sql` and `supabase/tests/` for other mangled-slug expectations:
> **none**, and `option-code.test.ts`'s remaining `c_a_o…` strings are correct (its underscores come
> from spaces, and its `resolveOptionCodes` case deliberately preserves a LEGACY code verbatim).
> **Status stays OPEN until I have re-run the specs** — a bug closes only after re-verification, and
> the DB is `backend`'s during Wave 3.
>
> 🔑 **The lesson, recorded because it cuts against my own instinct.** Pinning current behaviour
> *because it is pre-existing* is a bet that the behaviour is **correct**, and that bet can be lost
> to a **ruling** just as easily as to a regression. This is the mirror image of FF2-11's first
> draft, which pinned the old *symptom* (`no item's rect outside the viewport`) and went red on the
> **fixed** build. Same failure mode, opposite direction: a test can be wrong about the past as
> easily as about the future. The pin was not the mistake — the comment is what made this a
> two-minute edit instead of a red-bar mystery. **Pinning silently would have been the mistake.**

*Original report, kept for the record:*

*Repro:* author a matrix, add a row labelled `Higienização das mãos`. `MatrixAxesEditor` prints the
immutable identity as `código: higienizac_a_o_das_ma_os_yi4a1c`.

*Cause:* `slugifyLabel` NFD-decomposes, then collapses every non-`[a-z0-9]` run to `_` — so an
accent's combining mark becomes a `_` rather than being dropped (`ção` → `c_a_o`). Shared with
option codes and `question_key`s, so it is **pre-existing behaviour, not an FF-2 bug** — but FF-2 is
the first surface that **shows a code to the author on purpose** (ADR 0089 ruling 4: "the code is
SHOWN … because an author who can see the identity understands why relabelling is free"). A
mangled identity undercuts the reason it is shown.

*No data risk* — codes are opaque and stable; only legibility suffers. Fixing it means stripping
combining marks before the `_` collapse, which **changes minted codes platform-wide** and so is a
PO call, not a tester call. Pinned as-is by `e2e/ff2-matrix.spec.ts` (FF2-1, FF2-2) so a future
change to the slugger is a deliberate one.

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

### ▶ Case custom fields — BUILT + E2E ✅, QA + human approval pending (ADR 0083, branch `worktree-adr-0083-case-custom-fields`)

Template-defined, non-PHI administrative descriptor fields, defined per process template and
captured in "Novo caso". Design: [ADR 0083](docs/decisions/0083-case-custom-fields.md).
**Not yet merged to `main`.**

- [x] **Backend** (`9108b02`) — `process_template_custom_fields` + `case_custom_field_values`
  (RLS mirrored from the live `case_offered_outcomes`/`process_template_outcomes` predicates,
  incl. the `is_case_excluded` arm), `create_case_from_template` extended with `p_custom_fields`
  (re-emitted from the live body), `update_case_custom_field_values` RPC (`HC068` required),
  the `case_custom_fields` flag, types, query layer, pgTAP `188` (28/28).
- [x] **Def-authoring actions** (`8e5aea3`) — create/update/delete/reorder in
  `process-templates/actions.ts`; draft-only enforced action-side (D5).
- [x] **Frontend** (`613680c`) — builder authoring card, "Novo caso" reveal + PHI warning +
  required-gating, case-detail display + edit, opt-in list column/search. Browser-verified
  end-to-end.
- [x] **E2E seed fixtures** (`2365f1f`) — published template "Descritores de Óbito", 2 defs
  (`numero_declaracao_obito` required, `turno_obito` dropdown), 1 seeded case (label "Óbito
  enfermaria leito 3"), deterministic fixed UUIDs.
- [x] lint / typecheck / vitest (369) green.
- [x] **E2E specs** (`c298215`, tester) — `e2e/case-custom-fields.spec.ts`, 8 tests covering
  AC-1..AC-7 + AC-8 best-effort. **8/8, run 3× clean** (serial, `--repeat-each=2`→16/16, default
  parallel workers). 0 app bugs. Detail → [test-run-archive.md](docs/progress/test-run-archive.md) (2026-07-23).
- [x] **`e2e:prod` full-suite gate** (lead, `REBUILD=1`, prod standalone, 11 batches) —
  **735 passed / 7 failed / 2 flaky**. Feature spec **8/8 green on the prod build** (batch-2).
  Triage: **1 regression (mine, fixed) + 6 pre-existing** (all in specs byte-identical to `main`,
  i.e. red on `main` too — this full gate had not been run clean since several schema/UI changes):
  - `case-access.spec.ts:483` — **my** seed inserted the CF case before the outcomes block, taking
    CCIH `case_number 2` and bumping "Óbito UTI leito 3" (2→3), breaking its "caso 0002" assert.
    **Fixed `e5d9a34`** (reorder seed blocks → leito3=2, CF case=3; others unchanged); re-verified.
  - `charters-cadence.spec.ts` — stale `action_items.case_id` (renamed → `linked_case_id`, mig
    `20260818000300`). **Fixed `a54ad23`** (tester); lead re-verified 10/10.
  - `action-items-satellites.spec.ts` — **REAL app bug BUG-AISAT-002** (not stale): the one call
    site the rename missed — `listMeetingActionItems()` (`src/lib/queries/meeting-action-items.ts`)
    selected dead `case_id` → 400 swallowed → meeting "Itens de ação" panel empty on **every**
    meeting on `main`. Filed (Bug Log, `95ae651`). **RESOLVED `a9af7a7`** (`case_id`→`linked_case_id`
    + loud error-guard); `action-items-satellites.spec.ts` 9/9 green on fresh reset.
  - `documents-changes-requested.spec.ts` + `documents-redesign.spec.ts` — `Tipo` expects
    `protocol`, gets `sop` (ADR 0082 dropdown). Task-chipped (stale-spec-or-bug, off `main`).
  - `phase22-referrals.spec.ts:428` — ENC-0001 subject not in hub. Task-chipped (off `main`).
  - `ethics-e2-procedure.spec.ts` FLOW-7 — known keyboard-vote flake (already a filed follow-up).
  Final lead verification on a fresh reset: **charters + case-access + case-custom-fields = 41/41**.
- [x] **QA review** (`qa`, 2026-07-23) — ✅ **APPROVED** (0 P0 · 0 MAJOR · 1 MINOR · 2 INFO)
  [review](docs/reviews/adr-0083-case-custom-fields-review.md). Direct-table write-bypass closed at the
  table (live-catalog `pg_policies` verified; pgTAP `188` re-run green 28/28); both RPCs `SECURITY DEFINER`
  + PUBLIC-revoked; `create_case_from_template` rebuilt from live def with no lost logic; edit path
  authority-gated/exclusion-aware/terminal-safe/audited (Rule 11); Rule 12 holds (non-PHI by design);
  D1–D10 all met. MINOR-1 **cleared** (`857ed38`): `HC0F1` on the edit path now surfaces the RPC's
  specific pt-BR "impedido" message (mirrors `case-recusals`). INFO: D5 draft-freeze is action-layer (matches the outcomes sibling);
  the branch migration was applied forward to the local DB to obtain live-catalog truth (was absent from
  the prior reset). ⚠ Note: local DB state changed (ADR-0083 objects now present; a `db reset` recreates them).
- [ ] **human approval** + **merge to `main`**. Owned by lead.
  (Blockers to a fully-green gate are the 4 tracked pre-existing reds above — all off-branch, on `main`.)

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
