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
| ff-program | **Flexible-Forms Program (FF-1…FF-5)** *(umbrella — five feature phases pulled pre-pilot 2026-07-27; ADR [0086](docs/decisions/0086-flexible-forms-pre-pilot.md); plan [flexible-forms-program](docs/plans/flexible-forms-program.md))* — FF-1 repeating groups (instance RPCs + instance-aware evaluation) → FF-2 matrix/risk → FF-3 validation engine (+`required_if` + operator authorability) → FF-5 entity reference (participant+commission+user lanes, PHI door) → FF-4 power authoring (library + dynamic defaults; calculated fields stay post-pilot). Each phase: own ADR (0087+ at authoring) + flag OFF-until-gate + Phase Gate. **All five gate the pilot deploy.** | ▶ **in progress — FF-1** (ADR [0087](docs/decisions/0087-ff1-repeating-groups.md) accepted 2026-07-27) | – | – | – | – | – | – |
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

▶ **ACTIVE: FF-1 — Repeating Groups** (Flexible-Forms Program, ADR
[0086](docs/decisions/0086-flexible-forms-pre-pilot.md) → [program plan](docs/plans/flexible-forms-program.md)).
Phase ADR **[0087](docs/decisions/0087-ff1-repeating-groups.md)** accepted 2026-07-27 (6 PO rulings; grilling
interview). Flag `repeating_groups` (seeded OFF → enable migration at the gate). Worktree
`worktrees/ff/flexible-forms-program`, branch `ff/flexible-forms-program`.

> ⚠ **ADR 0087 §Substrate supersedes the program plan's FF-1 text in 6 places** (live-catalog audit at phase
> start). Binding for every teammate: per-item config is **`form_items.config`**, *not* `behavior_config`
> (that column is on `form_versions`) · `response_group_instances` is **already directly writable** (the K9
> "DML denied" rule covers the six read-only tables only) → writers are **INVOKER**, RLS stays the boundary,
> and the plan's `rls_group_instances_reader_non_writer` keystone is **retired as not-applicable** ·
> a second CHECK, `form_items_conditional_not_required`, blocks conditional+required and **FF-1 drops it
> globally** · `form_items.section_id` is NOT NULL for group children, so the completeness dispatch must
> exclude `parent_item_id IS NOT NULL` from the flat arm · `app.answer_map` silently collides across
> instances · `save_section_answers` has **no** instance arm (only `null` literals) and its
> `p_clear_item_ids` delete is unscoped by instance. SQLSTATE high-water **HC098** → allocate **HC099+**.

| # | Task | Owner | Status |
|---|---|---|---|
| BE-0 | **Contract-first:** post typed stubs `frontend` depends on (instance RPC signatures, group-aware wizard/builder types in `src/lib/queries/forms.ts` + `submissions.ts`) before implementing | backend | ✅ `cd9f42b` — `ContainerItemType`/`Item.children`/`flattenItem` · `ItemConfig.min/maxInstances` · `GroupInstance` + `.instances` on `ResponseForFill`/`SubmissionDetail` · `overlayAnswerMap` · 3 instance-action stubs + `SaveSectionInput.instances`. ⚠ **9 intentional typecheck errors in `src/components/**` — FE-1's first move** (see the note under this table) |
| BE-1 | Migration wave 1: flag seeded OFF · relax the `group`/`repeating_group` arms of `form_items_input_vs_display` · **drop `form_items_conditional_not_required`** (ruling 4) · depth-1 container cap (ruling 1) · children-contiguous-after-parent enforcement | backend | ✅ `20260828000000` — flag OFF · CHECK dropped · container arm re-cut (`question_key IS NULL`) · depth cap **declarative** (2 generated cols + composite self-FK, same name + `form_items_no_nested_container`) · `rgi` unique → DEFERRABLE · `app.validate_group_layout` wired into `publish_form_version`. 8/8 smoke assertions verified live |
| BE-1a | Additions routed mid-wave: `feature-flags.ts` `repeating_groups` + `repeatingGroupsEnabled()` · `toConfig()` now parses `minInstances`/`maxInstances` (was dropping them field-by-field) · `seed.sql` flips the flag ON for local/E2E | backend | ✅ |
| BE-2 | Instance-aware **`app.answer_map`** — 2-tier overlay (top-level ⊕ instance-*I*, same-instance wins, sibling-absent never falls back) + SQL golden vectors (`20_conditions.sql`) | backend | ✅ `20260828000100` — `app.overlay_answer_map` (pure/IMMUTABLE, the parity seam) · `app.answer_map_scoped(response, instance)` = the ONE body · `app.answer_map` rewrapped **and fixed** (it had no instance filter at all — substrate 5, affecting 9 call sites) · `app.instance_answer_map`. Golden vectors land in BE-7 |
| BE-3 | INVOKER RPCs `add_/remove_/reorder_group_instances` — atomic `max(position)+1`, collision-free reorder against the non-deferrable unique, `max_instances` (ruling 5) | backend | – |
| BE-4 | `save_section_answers` instance arm (`on conflict (response_id,item_id,group_instance_id) where group_instance_id is not null`) + **fix `p_clear_item_ids` instance scoping** | backend | – |
| BE-5 | **Dispatch-by-`item_type` refactor** of `app.response_required_complete` + group arm (min_instances, per-instance children, **empty-instance skip**) + `submit_response` **prune-then-check** (ruling 3) | backend | – |
| BE-6 | `validate_visible_when` — reject outside-in conditions targeting a *repeating*-group child, pt-BR `check_violation` (ruling 2); plain `group` children stay legal targets | backend | – |
| BE-7 | TS evaluator twin (`conditions.ts` instance-aware map) + `condition-vectors.json` new dimension — **SQL↔TS parity is phase-blocking (Rule 3)** | backend | – |
| BE-8 | `dashboard.ts` explode-by-child-`question_key` + supersession-tolerant read predicate (`group_instance_id` stays **out** of the aggregation key) | backend | – |
| BE-9 | pgTAP: 209 §B/§C re-pin + the ADR-0087 §Gate keystones, **each mutation-proven** (revert the guard → keystone goes red) | backend | – |
| FE-1 | Builder: enable both container types in `add-block-menu.tsx` / `item-type-meta.tsx` (flag-gated); child authoring; min/max into **`form_items.config`** | frontend | ✅ `633e688` — "Estrutura" picker group (flag-gated) + CHILD mode (never offers a container — depth cap) · nested `BlockCard` children with sibling-bounded reorder · container arm in `ItemEditorDialog` (título/apoio/condição + min-max repetições) · `parseItemConfig` → `minInstances`/`maxInstances` · `addItem` `parentItemId` + descending-shift placement · **`moveItem` is now BLOCK-aware** (a plain `reorder_item` swap put a container behind its own first child) · ruling-2 condition scoping, **mutation-proven**. Typecheck handoff cleared in `44949e8`. |
| BE-1a | **`toConfig()` (`src/lib/queries/forms.ts:525`) drops `minInstances`/`maxInstances`** — builds its return field-by-field and never reads them, so cardinality round-trips to nothing. The `ItemConfig` interface and its parser disagree. **Gates FE-1 acceptance** | backend | – |
| BE-4a | **`buildAnswerMaps()` indexes `itemsById` from `section.items` only** — no `children` descent, and the consumer does `if (!item) continue`, so a plain `group`'s (top-level-answering, ruling 6) children are silently dropped from both maps. Use `flattenItem` | backend | – |
| BE-6a | **`conditionTargets()` walks `s.items` flat** — client-side mirror of BE-6's publish ban; must **keep** plain-`group` children and **drop** *repeating*-group children. Open contract question: the `(sectionId)` signature cannot express "authoring for *this child* inside *this group*", so it cannot offer the same-instance siblings ruling 2 permits | backend | – |
| FE-2 | Wizard: instance add/remove/reorder controls, per-instance rendering, resume across navigation | frontend | – |
| FE-3 | Wizard: `group` as a plain nested sub-section (no instance chrome) + grouped review/summary rendering | frontend | – |
| FE-4 | Conditional+required UX now that the CHECK is gone — *obrigatório* offered beside a condition, pt-BR errors | frontend | ✅ `633e688` — `form_items_conditional_not_required` verified GONE from `pg_constraint`; the required checkbox is no longer disabled/forced-off beside a condition, and the copy states the resolved semantics (*obrigatória apenas quando aparecer*) instead of the old prohibition. Editor test rewritten to assert the reversal (old prohibition asserted ABSENT, not merely hidden). |
| FE-5 | Keyboard-only pass over instance controls (add/remove/reorder), visible focus, labels | frontend | – |

**Lead file-ownership ruling (2026-07-27, FF-1 only):** `src/lib/forms/actions.ts` + `src/lib/forms/parse-config.ts`
→ **`frontend`**. They fall outside both written scopes (CLAUDE.md §4 gives `backend` `src/lib/{supabase,queries,types}`;
`src/lib/forms/` is neither that nor `src/app`/`src/components`), no BE task touches them, and FE-1 cannot write
min/max without them. Both teammates were told, so the fence binds in both directions. The read/write seam is now
split across teammates, so **the config key names are the contract**: `frontend` writes `minInstances`/`maxInstances`
into `form_items.config` exactly as backend's `ItemConfig` declares them; neither side renames unilaterally.

**Known handoff, not a regression:** BE-0 hands `frontend` a red typecheck (9 errors, all in FE-owned files — 8 test
fixtures needing `children: []`/`instances: []` + `item-type-meta.tsx`). `children`/`instances` are **required by
design**; optional would invite the skip-the-children bug class that BE-1a/BE-4a/BE-6a all are. FE fixes them by
supplying the empty arrays, **never** by widening the type back.

> ⚠ **BE-0 hands over a RED typecheck — by design, 9 errors, all in `src/components/**` (frontend-owned).**
> Widening `ItemType` and adding the required `Item.children` / `ResponseForFill.instances` fields is the
> compile-time signal the repo relies on ("adding a member forces every consumer to handle it"). Not a
> regression; **`src/lib/**` is clean and lint is 0/0.** The 9 sites, each a one-line fix:
> `item-type-meta.tsx:25` (add `group` + `repeating_group` to `ITEM_TYPE_META` — FE-1 anyway) and 8
> test-fixture builders needing `children: []` / `instances: []` —
> `forms/describe-visibility.test.ts:19` · `forms/item-editor-dialog.test.tsx:186` ·
> `wizard/input-item.test.tsx:17` · `wizard/others-fill.test.tsx:36` · `wizard/others-persist.test.tsx:23` ·
> `wizard/prepare.test.ts:16,60` · `wizard/use-wizard.test.ts:20`.

> 🔴 **ADR 0087 §Implementation-notes SQLSTATE line is WRONG — do not allocate `HC099`.** The live
> `pg_proc` high-water is **`HC0M9`**, not `HC098` (the `HC09x` digit lane was exhausted and the
> convention moved to letter lanes `HC0A0`…`HC0M9`; `L` is skipped). FF-1 allocates the next free lane,
> **`HC0N0`+**. `HC098` is the last *digit-lane* code, which is what backend-state's table recorded.

> 🔴 **Two latent bugs FF-1 ACTIVATES** (live-catalog, not in ADR 0087): `start_correction_draft` and
> `supersede_response` copy `answers.group_instance_id` **verbatim from the predecessor** without copying
> `response_group_instances`, so a corrected response's answers would point at the *predecessor's*
> instances (frozen by `guard_submitted_group_instances_trg`; cascade-deleted with the predecessor).
> Inert today (0 instance rows) — must be fixed in the BE-3/BE-4 wave. Also `app.assert_item_bounds`
> does an unscoped `select … where response_id and item_id`, silently picking ONE instance's answer.

Every concluded phase/track lives as a **row in the
[Phase Status](#phase-status) table above**, with its full record under `docs/progress/`; the remaining
pre-pilot work — the FF program, then the **pilot deploy** (origin push + Coolify + remote `db push`) — is
tracked in **Remaining pre-pilot work** below. Phases 18–19 stay post-pilot.

**Recently concluded** (S-track; all human-approved — detail in the linked records + the Phase Status rows):
S5 [ETH·E3a](docs/progress/eth-e3a-surfacing.md) · [Case Corrections](docs/progress/case-corrections.md) ·
[Controlled-Doc Redesign 17-v2](docs/progress/document-control-redesign.md) ·
[AUDIT-DOOR-BLINDNESS P0](docs/progress/authz-p0-door-blindness.md) · [AUTHZ Gate 1+2](docs/progress/authz-handoff.md) ·
S4 [ETH·E2](docs/progress/eth-e2-procedure.md) · [RV2 R2–R5](docs/progress/rv2-r2-r5-governance.md) ·
[CH](docs/progress/ch-charters-cadence.md) · S3 [ETH·E1](docs/progress/eth-e1-access-spine.md) ·
S2 [IV2](docs/progress/iv2-interviews.md) / [RV2·R1](docs/progress/rv2-r1-referrals.md) / [AI](docs/progress/ai-satellites.md) ·
S1 [substrate (MEM/SUP/N)](docs/progress/s1-substrate.md) · [S0 gate](docs/plans/pre-pilot-release-s0-ratification.md).

> ⚕️ **Suite-health** (deferred, non-blocking) — the `e2e:prod` gate carries a ~18–31 pre-existing flaky-red
> baseline (memory [[e2e-prod-build-flaky-baseline]]); pay-down = per-test DB isolation / `retries=0` / a
> known-flaky allowlist → [s1-substrate.md](docs/progress/s1-substrate.md).

### 📋 Remaining pre-pilot work

Expanded 2026-07-12 — ADR [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md); **re-expanded
2026-07-27 — ADR [0086](docs/decisions/0086-flexible-forms-pre-pilot.md)** (Flexible-Forms FF-1…FF-5 pulled
pre-pilot). **FF-1 is now active** (see Current Phase Tasks); this is the standing backlog — remaining
pre-pilot = the **FF program (five gated phases)**, the FUP-AI-1 workstream, then the **pilot deploy**.

· **S4 ✅ COMPLETE 2026-07-20** — ✅ **ETH·E2** (2026-07-18) + ✅ **Referrals v2 R2–R5** (2026-07-19) + ✅ **CH** Charters (Phase 21, 2026-07-20 — ADR [0080](docs/decisions/0080-committee-charters-cadence-model.md) / [detail](docs/progress/ch-charters-cadence.md)), all → `main`
· ✅ **S5 ETH·E3a COMPLETE 2026-07-27** — terminology/UX + auto-derived procedural timeline + ethics dashboard (E3b still needs Phase 16) → [eth-e3a-surfacing.md](docs/progress/eth-e3a-surfacing.md)
· Phase 16 — Standards Crosswalk (🔜 **deferred** 2026-07-11, needs replanning; blocks E3b)
· **BUG-AIF-001 / FUP-AI-1** (PO-directed pre-pilot; own workstream, not yet started)
· ✅ **BUG-PROD-ACTIONS — RESOLVED (environment drift, not a code defect).** `node_modules/next` had silently drifted to **16.2.9** (the pre-BUG-AIF-001 version) while `package.json`/lockfile pinned **16.3.0-preview.5**; `npm ci` → 16.3 + a `REBUILD=1` full run collapsed the 21–31s action-hang **and** the "~18–27 prod flaky baseline" to ~1. Confirmed in the Gate-2 version-drift audit (`2698696`); PO-approved at the Gate-2 close. Full investigation detail → [bug-log-archive.md](docs/progress/bug-log-archive.md).
· ✅ **P0 · AUDIT-DOOR-BLINDNESS — RESOLVED 2026-07-18, human-approved.** The door-level re-audit (292 gate neutralizations across every `authenticated`-reachable DEFINER door) found no live leak — platform-wide test-coverage debt, not a Gate-1 breach. Closed with a standing invariant (ADR [0079](docs/decisions/0079-authz-door-blindness-standing-invariant.md)) + 50 mutation-proven keystones; qa APPROVED. Full detail → [authz-p0-door-blindness.md](docs/progress/authz-p0-door-blindness.md).
· **Flexible-Forms Program FF-1 → FF-2 → FF-3 → FF-5 → FF-4** (🔜 pulled pre-pilot 2026-07-27, ADR [0086](docs/decisions/0086-flexible-forms-pre-pilot.md); all five gate the pilot deploy; per-phase ADRs 0087+ authored at each phase start) → [flexible-forms-program.md](docs/plans/flexible-forms-program.md)
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

## Bug Log

<!-- Filed by tester; status updated ONLY by tester after re-verification.
     Resolved/closed bugs are archived at phase close → docs/progress/bug-log-archive.md. -->

**0 open bugs.** The 3 most recent (BUG-CORR-001 · BUG-E3A-001 · BUG-E3A-002, closed 2026-07-24/27) were
rotated to [bug-log-archive.md](docs/progress/bug-log-archive.md) at the 2026-07-27 cleanup; full history
lives there. Table header kept below for the next filing.

| ID | Phase | Severity | Description / repro | Expected | Actual | Spec | Owner | Status |
| -- | ----- | -------- | ------------------- | -------- | ------ | ---- | ----- | ------ |

## Test Run Summary

<!-- Full historical run log (Phases 0 → S2, 133 rows) archived → docs/progress/test-run-archive.md.
     Keep only the most recent gate's rows here; rotate the rest to the archive at each §6 Record. -->

| Date | Phase | Specs | Passed | Failed | Notes |
| ---- | ----- | ----- | ------ | ------ | ----- |
| 2026-07-27b | ETH·E3a (T-1) — post-fix-loop re-verification of BUG-E3A-001/002 (chromium, dev server; NOT the full suite — `e2e:prod` gate is the lead's to run) | `e2e/ethics-e3a-surfacing.spec.ts` (all 21) | **21/21**, run on 2 independent fresh resets (deterministic) | **0** | **Both bugs re-verified fixed, marked RESOLVED in the Bug Log.** FE `ef5c38b` (BUG-E3A-001) + BE `1ce0876` (BUG-E3A-002) landed since the round-1 report; re-ran the full spec twice from a clean `supabase db reset` each time — same 21/21 both times. TERM-3 (case-term heading "Denúncia …") and EVT-2/EVT-3 (coordinator_only badge, auto-derived + manual) now pass outright. **TERM-4 needed a spec-only selector fix, not a re-file**: the new `CasePrimarySubjectPanel`'s heading and the seeded respondent's `case_participant_roles.display_name` are BOTH the literal string "Médico denunciado" (ADR 0064 D4's own example reuses the words for both the term and the role), so my original `page.getByText('Médico denunciado')` hit a Playwright strict-mode violation (2 matches) rather than a real failure — retargeted to `getByRole('region', {name:'Médico denunciado'})` scoped to the panel + a non-vacuous check that the actual respondent ("Dra. Denunciada") resolves inside it, not just an empty-state placeholder. Confirmed the other 17 tests are unaffected by the new primary-subject card / heading change (no regression). **Housekeeping**: BE-8 (`1173900`) renumbered the E3a pgTAP files `260`-`263` → `266`-`269` (resolved the CH/case-corrections numbering collision) — fixed the two stale `263_ethics_e3a_dashboard.sql` references in my own spec (`DASH-SETUP`'s title + comment, ~line 545) to `269_...`; confirmed no other stale `26[0-3]_ethics_e3a` references remain. Lint (`eslint --max-warnings=0`) + `tsc --noEmit` clean. **▶ Next: QA.** |
| 2026-07-27 | ETH·E3a (T-1) — pgTAP re-confirm (fresh reset, `supabase test db`) + new E2E spec (chromium, dev server; NOT the full suite — `e2e:prod` gate is the lead's to run) | pgTAP: `260_ethics_e3a_surfacing.sql` + `261_ethics_e3a_autoderive.sql` + `262_ethics_e3a_terminology_reads.sql` + `263_ethics_e3a_dashboard.sql` (full suite `supabase test db`, 135 files) · E2E: `ethics-e3a-surfacing.spec.ts` (new, 21 tests) | **pgTAP 63/63** (20+20+9+14; full suite `Files=135, Tests=3848, Result: PASS`) · **E2E 17/21** (run 3× on independent fresh resets, fully deterministic — same 4 fail every time) | **pgTAP 0** · **E2E 4** (2 real bugs, 2 failing tests each) | **pgTAP independently confirmed** — do not trust a self-reported total; re-ran the FULL ordered suite myself on a clean reset per protocol. **E2E coverage**: terminology (TERM-1/2/5 pass: ethics case → "Cronologia processual" tab; non-ethics case → unchanged "Linha do tempo" + "Casos" board heading) · kind-widen/visibility floor + auto-derive (EVT-1/4/5/6 pass: 3 real E2 RPCs — `decide_admissibility`/`add_ethics_allegation`/`record_ethics_finding` — correctly auto-emit labeled `case_events`; an ordinary granted reader sees the 2 `case_readers` events and NOT the `coordinator_only` one; a respondent AND a recused reader are denied the case route entirely, RLS-floor-correct) · dashboard confidentiality keystone (DASH-0a/ROLE-GATE/0e/SETUP/1/EXCLUDE-SETUP/EXCLUDE/5, all pass: coordinator's count rises by exactly the fixture (+3 total, +1 pending, +2 admissible, +2 issued, +1 each sanction); **discovered mid-run that `/dashboard/ethics` is gated `staff_admin`-only at the PAGE level** — a plain granted `staff` member cannot reach it at all (verified via live source + `notFound()`), so redesigned the "excluded viewer" scenario around the coordinator themselves made respondent/recused on throwaway cases — proves the deny-terms bind even the commission's OWN staff_admin, a stronger form of acceptance #6/#7 than the original design; foreign-commission coordinator, same org, unaffected) · keyboard-only (KBD-1/2 pass: board → tab-to-case-link → Enter → tab-to-"Cronologia processual" → Enter lands on `/timeline`; the dashboard page itself has no in-app nav link yet — O-2 follow-up, already tracked in PROGRESS.md, not a new finding — so its keyboard check starts from a direct URL nav and confirms no focus trap). **2 bugs filed** (BUG-E3A-001 MAJOR terminology, BUG-E3A-002 MINOR visibility badge — see Bug Log for full repro/evidence). **3 own-harness bugs found+fixed during the write-up (spec-only, 0 app fixes)**: (1) a one-shot `.count()` check in my dashboard reader raced the server-streamed render and read "0 cases" on a page that hadn't finished painting — fixed by waiting for the stat-card-or-empty-state region first (the same class of bug `e2e-networkidle-purged` warns about, web-first assertions only); (2) `new RegExp(rowLabel)` on a sanction label containing literal parentheses ("Advertência (E3a Dash)") silently elided the required parens — the exact trap `ethics-e1-access-spine.spec.ts`'s own AC-9 comment documents for a document title — fixed by using Playwright's plain-string substring match instead; (3) fixture creation initially lived in `beforeAll` (which runs before EVERY test including the "before" baseline capture), collapsing every delta to ~0/nonsensical — fixed by moving fixture creation into an explicit mid-sequence test. **Also flagged (non-blocking, INFO)**: the E3a pgTAP files are numbered `260`–`263`, colliding with the ALREADY-SHIPPED `260_charters.sql`/`261_charters_rpcs.sql`/`262_charter_notifications.sql` (CH, Phase 21) and `263_correction_readers.sql` (case-corrections) — no functional collision (`supabase test db` runs by full filename, not numeric prefix; confirmed both sets ran and passed independently), but the numeric echo is confusing across PROGRESS.md phase rows and worth a rename (e.g. `266`–`269`) at the next convenient touch. Lint (`eslint --max-warnings=0`) + `tsc --noEmit` clean on the new spec. Commit `2956aaf`. **Update:** BE-8 (`1173900`) did the rename → `266`-`269` right after this row; the 2 bugs were fixed + re-verified 21/21 → see the **2026-07-27b** row above. |

> **Most recent gate: S5 · ETH·E3a** (2026-07-27) — the 2 rows above are the tester's clean-reset
> re-verification + the pgTAP/E2E gate run. The lead's full `e2e:prod` declaration (triaged **GREEN, 0
> deterministic regression**) is recorded in the ETH·E3a summary above + [eth-e3a-surfacing.md](docs/progress/eth-e3a-surfacing.md).
>
> **Prior closed gate: AUTHZ Gate 2** (2026-07-17, 0 regressions → [authz-gate-2-review.md](docs/reviews/authz-gate-2-review.md)).
> That row + the Case-Correction T-1/T-2 (2026-07-24 / 24b), case-custom-fields (2026-07-23), and
> stale-spec-drift (2026-07-23b) rows rotated → [test-run-archive.md](docs/progress/test-run-archive.md) at
> the 2026-07-27 cleanup. Full run history (Phases 0 → S4) lives there.

## QA Verdicts

<!-- One row per phase/feature, ONE LINE only: verdict + date + link to docs/reviews/*.md
     (the full analysis already lives there — do not restate rationale here, and do not
     copy it to docs/progress/qa-verdicts-archive.md either, that's redundant with the
     review file). Legacy rows predating this rule may still point at qa-verdicts-archive.md. -->

| Phase / Feature | Verdict | Report | Notes |
| --------------- | ------- | ------ | ----- |
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
