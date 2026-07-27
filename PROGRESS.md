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
| pre-pilot-release | **Pre-Pilot Release Scope Expansion** *(umbrella — 12 initiatives pulled into the pilot release 2026-07-12; ADR [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md); plan [pre-pilot-release-scope-expansion](docs/plans/pre-pilot-release-scope-expansion.md))* — S0 design gate → S1 substrate (N/MEM/SUP) → S2 cores (RV2·R1/IV2/AI) → S3 ETH·E1 (releases the m2 gate) → S4 ETH·E2/RV2 R2–R5/CH → S5 ETH·E3. Only Phases 18–19 stay post-pilot. Pilot follows this whole block + Coolify deploy + origin push. | 🏗️ **in progress — AUTHZ ✅ COMPLETE (Gate 1 + Gate 2, 2026-07-17); then S4 (now ✅ complete 2026-07-20)** (branch `pre-pilot-release-s0`, **local ahead of origin**; **S0 ✅** + **S1 substrate ✅** [→ [s1-substrate](docs/progress/s1-substrate.md)]; **S2 cores ✅ ALL 2026-07-14**: **IV2 ✅** [`phase(11-v2)`] · **RV2·R1 ✅** [`phase(rv2-r1)`] · **AI ✅** [`phase(ai)`]; **S3 · ETH·E1 ✅ COMPLETE 2026-07-14** [`phase(E1)`; **m2 gate RELEASED**; → [eth-e1-access-spine](docs/progress/eth-e1-access-spine.md)]; **✅ AUTHZ COMPLETE 2026-07-17** (ADR [0078](docs/decisions/0078-authorization-capability-model.md); own gate unit) — **Gate 1** (Stage A/B: `_case_caps` resolver + `case_access → case_access_grants` hard cut) + **Gate 2** (Stage C meeting-confidentiality · F1 referral split · N1 NSP-PHI · G-cleanup) both **human-approved**; qa APPROVED re-review [review](docs/reviews/authz-gate-2-review.md) (P0 + 3 MAJOR behaviourally closed, mutation-proven; MINOR-1 rides noted). **✅ S4 COMPLETE 2026-07-20 = ETH·E2 (07-18) · RV2 R2–R5 (07-19) · CH (07-20). ▶ Remaining: S5 ETH·E3a + the pilot deploy (origin push + Coolify + remote `db push`).**) | – | – | – | – | – | – |
| **ETH·E1** | **Ethics Access Spine — m2 gate release** *(ADR [0072](docs/decisions/0072-ethics-access-spine.md))* — makes the F1 subject layer safe for real ethics data + releases the m2 gate (`case_participants`+`case_types` ON); respondent-exclusion + recusal hard-denies; `explicit_grants_only` visibility; 7-value confidentiality + doc ceiling; no new UI → [detail](docs/progress/eth-e1-access-spine.md) | ✅ complete | ✅ Vitest 369/369 | ✅ pgTAP 91f/2537 · E2E 13/13+1 skip · e2e:prod triaged | ✅ APPROVED (R3) [review](docs/reviews/phase-ETH-E1-review.md) | ✅ 2026-07-14 | 2026-07-14 | 14 commits `167b269`…`02bd2db` (remote deferred) |
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

### 🏗️ ACTIVE — S5 · ETH·E3a (Ethics terminology/UX surfacing) — kickoff 2026-07-26

Next unstarted track of the [Pre-Pilot Release Scope Expansion](docs/plans/pre-pilot-release-scope-expansion.md)
(S4 complete 2026-07-20). Build plan → [ethics-e3-surfacing.md](docs/phases/ethics-e3-surfacing.md); ADR 0064
Decision 4 owns the terminology model (no new ADR). Reuses flag `ethics` + `case_participants`/`case_types` (E1/E2;
no new flag). Local-first; remote deferred to the pilot deploy.

**PO decisions locked 2026-07-26** (both non-recommended, both expand scope): **O-1 = reopen E1/E2** — add
`cases.case_type_id` as an **E1-surface** amendment (ADR 0064/0072 lineage; the `case_types` "a case snapshots
case_type_id" intent), not a fresh E3a column. **O-3 = auto-derive** — each E2 procedure RPC also inserts a
`case_events` row (Rule-12: PHI-free bodies + per-kind visibility that never leaks deliberation). **O-2** (dashboard
route) + **O-4** (8 pt-BR kind labels) → frontend's call, folded into the FE brief.

**Lead catalog-verified premises (2026-07-26):** `cases` has no `case_type_id` (O-1 real); E1 added
`confidentiality_level`+`visibility_policy`; **contract drift** — E2 shipped `ethics_decision_details.sanction_type_id`
→ `ethics_sanction_types` catalog (not the plan's free-text `sanction_type`); the dashboard sanction distribution
must key off that catalog. Team: backend (contract-first) → frontend → tester → qa.

| Unit | Scope | Owner | Status |
| ---- | ----- | ----- | ------ |
| BE-1 | Catalog re-verify (E2 RPC names · `case_decisions.status` enum · `ethics_sanction_types` shape · confirm `case_type_terminology` has 0 TS consumers) + post the §2 typed-stub contract **reconciled to as-built** (sanction catalog, E1 cases cols) + **design note**: O-1 E1-surface `cases.case_type_id` migration & `create_case` wiring; O-3 per-RPC → kind + visibility + PHI-free-body mapping. Commit stubs+note; **STOP for lead ratification** (no migrations / no E2-RPC edits yet). | backend | ✅ `e61fa3c` — lead-verified (git+catalog); reconciled to as-built |
| BE-2 | E1-surface migration: `cases.case_type_id` nullable FK + `create_case` optional param + org-consistency guard (O-1); amend ADR 0072 + backend-state §E1 | backend | ✅ `fb1abbf` |
| BE-3 | `case_events` kind-CHECK widen (8 procedural kinds) + `visibility` column + narrowing-only RLS (plan §2.4) | backend | ✅ `fb1abbf` |
| BE-4 | Seed: Ethics `case_type` + terminology bundle (5 term_keys) + role bundle (plan §2.2) | backend | ✅ `fb1abbf` (⚠ reconciled onto the **pre-existing** `ethics` type + set `explicit_grants_only` — lands ADR 0078 A1; regression-risk to clear at the full-suite gate) |
| BE-5 | E2-surface reopen (O-3): auto-derive `case_events` inserts across the ~9 E2 procedure RPCs per the ratified mapping (PHI-free bodies · per-kind visibility); amend ADR 0073 + backend-state §E2 | backend | ✅ `79acbfa` — mutation-proven (coordinator_only RED-on-revert); PHI-free + transactionality keystones; `decision_type` excluded (uncontrolled free text — accepted) |
| BE-6 | `getCaseTypeTerminology` (first-ever consumer) + project `caseTypeId`+`terminology`+**`primarySubjectKind`** on `getCaseDetail`/board reads; **+ FE follow-ups: `ethics` → `FeatureFlags` interface (B) · wire the manual case-event `visibility` write-path (C)**; regen types | backend | ✅ `bec5f45` — RLS-read resolver (no service-role); terminology tables member-SELECTable (no gap); `terminology.ts` client-safe split (pre-empts BUG-FBE-005, **`next build` green**); visibility write-gate DB-enforced (`WITH CHECK`); pgTAP `262` 9/9 + vitest 4/4 |
| BE-7 | `getEthicsDashboard` — **RLS-scoped** aggregation (highest-scrutiny; sanction-catalog reconciled; no service-role/DEFINER bypass — plan §6) | backend | ✅ `91e7881` — structurally RLS-scoped (only `createClient()` + `.from().select()` over `can_read_case`-gated tables; no service client/`.rpc()`/DEFINER); pgTAP `263` 14/14 multi-role; unscoped-path mutation-proof; **caught + fixed a vacuous respondent keystone in `260`** (now grant+`respondent_doctor` → respondent-deny is the isolating factor) |
| FE | Terminology-aware components (board/tabs/detail-view; patient-panel conditional-omit) + `case_events` visibility badge + widened kind select + **new ethics dashboard route** (O-2) + 8 pt-BR kind labels (O-4), off the frozen §2 contract | frontend | ✅ FE-1 `355bd06` + FE-2 `1366777` (build-only: tsc·lint·`next build` green; **live-verify pending** — stack was single-owner to backend) |
| T-1 | Re-run FULL E3a pgTAP (`260`/`261`/`262`/`263`, self-reported 63) on a **clean reset** — confirm actual counts, don't trust the total · then E2E (chromium): terminology render vs default · kind-widen + visibility floor (respondent/recused see neither) · **dashboard multi-role keystone #6/#7** (coordinator vs respondent-viewer render DIFFERENT counts) · auto-derived events via E2 RPCs · flag-off-adjacent regression · keyboard path. File bugs, never edit app code. | tester | ✅ **DONE — 21/21 green after the fix loop.** pgTAP independently confirmed 63/63 (`266` 20/20 · `267` 20/20 · `268` 9/9 · `269` 14/14 — renumbered from `260`-`263` per BE-8 `1173900`) on a fresh reset (full suite `Files=135, Tests=3848, Result: PASS`), re-confirmed twice more after the FE/BE fixes landed. `e2e/ethics-e3a-surfacing.spec.ts` round 1 was 17/21 (2 bugs filed); round 2, after FE `ef5c38b` (BUG-E3A-001) + BE `1ce0876` (BUG-E3A-002), is **21/21**, run 2× on independent fresh resets (deterministic) — TERM-3/TERM-4 and EVT-2/EVT-3 now pass, the other 17 unaffected (no regression from the new primary-subject card/heading change). One own-spec fix needed: TERM-4's `getByText('Médico denunciado')` hit a Playwright strict-mode violation (the new panel's heading AND the seeded respondent's `case_participant_roles.display_name` are the same string, so a plain text match is ambiguous) — retargeted to `getByRole('region'/'heading', {name:...})` scoped to the new panel; not an app defect. **Both bugs marked RESOLVED in the Bug Log below** (re-verified by tester, not just re-run). Dashboard keystone #6/#7 GREEN incl. a stronger form not in the original design (coordinator excluded from their OWN commission's cases as respondent/recused — DASH-EXCLUDE); role-gate confirmed (`/dashboard/ethics` is staff_admin-only — plain granted staff get `notFound()`, a page-level gate the design doc didn't call out). Auto-derive (#3/#4) GREEN via real RPC calls. Keyboard (#10) GREEN. **Housekeeping**: fixed the two stale `263_ethics_e3a_dashboard.sql` references in my own spec (→ `269_...`). **▶ Next: QA.** |
| FE-fix | **BUG-E3A-001 (MAJOR)** — wire `terminology.case.singular` into the case-DETAIL heading (board cards stay `formatCaseNumber`) + render the primary-subject term ("Médico denunciado"); root: `format.ts:9` hardcodes "Caso ", detail-view/layout never read `detail.terminology`. Build-verify; tester re-runs TERM-3/4. | frontend | ✅ `ef5c38b` — new `formatCaseNumberWithTerm` + both detail H1s + new read-only primary-subject card ("Médico denunciado"); board/cards untouched; TERM-5 default preserved; integrated tsc·lint·build green |
| BE-fix | **BUG-E3A-002 (MINOR)** — `listCaseEvents()` (`case-documents.ts` ~228-264) must SELECT+project the real `case_events.visibility` (drop hardcoded `case_readers` + stale "BE-5 projects it" comment) so the "Somente coordenação" badge renders; RLS row-boundary already correct (EVT-4/5/6 pass). | backend | ✅ `1ce0876` |
| BE-8 | **pgTAP rename (hygiene)** — E3a `260`–`263` collide numerically with CH (`260`–`262`) + case-corrections (`263`); `git mv` to the next-free block (266+) + full-suite re-run green. | backend | ✅ `1173900` — E3a pgTAP now **`266`–`269`** (was 260-263); full suite 3848/3848 under new names |
| QA | Phase review — focus: (1) independently neutralization/mutation-verify `getEthicsDashboard` RLS-scoping (respondent/recused/non-granted contribute 0) + O-3 auto-derive visibility (finding/vote `coordinator_only`); (2) **re-audit BE-5/BE-7 keystones for vacuity** (backend self-caught one in `260` — confirm `269` multi-role + the fixed `266` genuinely go RED on revert); `prosecdef` + `pg_policies` sweep on the new write-gate | qa | 🔍 in progress |
| LEAD e2e:prod (deferred) | Full `npm run e2e:prod` — **run AFTER QA clears** (stack-serialized; avoid a wasted ~40-min run if QA bounces) | lead | ⏸ after QA |
| LEAD e2e:prod | Full `npm run e2e:prod` suite-green declaration | lead | ⏸ |

**Lead ratification (2026-07-26, git+catalog verified) — BE-1 ✅ `e61fa3c`.** Contract stubs reconciled to as-built
(sanction *catalog* not free-text; enum-typed dashboard Records; `ProceduralCaseEventKind`/`AnyCaseEventKind` split
avoids the frontend `EVENT_KIND_LABEL` collision). **O-1 ruling:** when a `case_type_id` is supplied to the
processless `create_case`, it **inherits `visibility_policy` + `confidentiality_level` from the type** (mirror
`create_case_from_template`) — a Rule-12 requirement (Ethics-via-processless must resolve `explicit_grants_only`), not
just an id snapshot. **O-3 mapping ratified** as posted (`finding_recorded`/`vote_cast` → `coordinator_only`; 8 PHI-free
body templates; recusal/conflict + drafts/edits excluded). **CaseEventKind coordination accepted:** FE grows
`EVENT_KIND_LABEL` → `Record<AnyCaseEventKind,string>` (O-4), BE-5 widens the read type in lockstep (disjoint files).
BE-5 (auto-derive) sits after BE-3. Now **parallel**: backend BE-2→BE-4 (schema+seed) · frontend **build-only** off the
frozen contract (local stack single-owner to backend this phase).

**Progress 2026-07-26 (parallel round 1 landed + lead-verified):** BE-2→BE-4 `fb1abbf` (2 migrations `20260827000000/000100`
+ seed + pgTAP `260` 20/20 on fresh reset) · FE-1 `355bd06` + FE-2 `1366777` (build-only). **Integrated FE+BE tree: tsc 0
· lint 0/0** (contract-first held). Backend reconciliations accepted (see BE-4 note). FE judgment calls accepted: board
heading stays "Casos" (mixed-type board, no per-commission resolver); O-2 route = `/o/[org]/c/[commission]/dashboard/ethics`
(coordinator+`ethics`-gated, no nav entry yet → small FE follow-up). Panel-omit currently gated on `patientEnabled`
(contract lacked `primarySubjectKind`) → BE-6 projects `primarySubjectKind` for defense-in-depth. **▶ Next: BE-5
auto-derive** (own review), then BE-6 (reads + FE follow-ups) → BE-7 (dashboard, crux) → coordinated live-verify → tester → qa.

**BE-5 ✅ `79acbfa` (2026-07-26):** 8 ethics RPCs auto-emit procedural `case_events` (catalog-truth body-only splices,
grants preserved, `database.ts` nil-diff); pgTAP `261` 20/20 (+ `260` 20/20); **coordinator_only keystones
mutation-proven** (RED-on-revert); **PHI-free keystone** (injected `SEGREDOXYZ` absent from all bodies); transactionality
keystone (unauthorized RPC → 0 events). `decision_issued` omits the uncontrolled free-text `decision_type` (Rule-12 —
accepted; optional fast-follow = a controlled decision-type vocabulary).

**BE-6 ✅ `bec5f45` (2026-07-26):** terminology resolver (authenticated RLS read, per-`term_key` fallback, never
throws) + `getCaseDetail`/board project real `caseTypeId`/`terminology`/`primarySubjectKind` (single-FK embed, no
PGRST201) + 3 FE follow-ups (typed `ethics` flag · `primarySubjectKind` · manual `visibility` write-gate, DB-enforced
`WITH CHECK`). Client-safe `src/lib/cases/terminology.ts` split pre-empts BUG-FBE-005. **Lead-verified: integrated FE+BE
`next build` GREEN** (client/server boundary intact after `case-types.ts` → `server-only`), tsc·lint 0/0, pgTAP `262`
9/9 (+ `260`/`261` 20/20), vitest terminology 4/4.

**BE-7 ✅ `91e7881` (2026-07-26) — E3a BACKEND BUILD COMPLETE (BE-1→BE-7).** `getEthicsDashboard` structurally
RLS-scoped (authenticated `createClient()` + `.from().select()` only, over `can_read_case`-gated tables; no
service-role/`.rpc()`/DEFINER); pgTAP `263` 14/14 (coordinator 3 vs respondent/recused 1 vs non-granted/foreign 0);
unscoped-path mutation-proof; **backend self-caught + fixed a vacuous respondent keystone in `260`** (lead-confirmed in
the diff — now grant + `respondent_doctor` role key → respondent-deny isolates). **Lead-verified:** all 7 commits clean
+ backend-only, integrated `next build` GREEN, tsc·lint 0/0. Self-reported E3a pgTAP = 63 (`260`·20 + `261`·20 + `262`·9
+ `263`·14) + vitest 14. **▶ Next: tester (clean-reset pgTAP re-run + E2E §4), then qa (RLS-scoping + keystone-vacuity audit), then lead `e2e:prod` → human approval → Record.**

**Tester gate round 1 + fix loop (2026-07-27):** tester spec `ethics-e3a-surfacing.spec.ts` (`2956aaf`) 17/21, deterministic;
pgTAP independently re-confirmed 63/63 (full 3848). 2 bugs fixed: **BUG-E3A-001** (MAJOR, FE `ef5c38b` — terminology
didn't render on the detail; now does + new primary-subject card) · **BUG-E3A-002** (MINOR, BE `1ce0876` — `listCaseEvents`
now projects real `visibility` so the coordinator badge renders). **BE-8** (`1173900`) renumbered the 4 E3a pgTAP files
**260-263 → 266-269** (they collided with CH/case-corrections) — earlier rows in this section citing 260-263 mean these.
Integrated tsc·lint·build green with all fixes. **Out-of-scope flag (FE):** participants *management* UI (add/remove/
set-primary/COI via `participants/actions.ts`) is unbuilt — E3a ships only the read-only primary-subject display; a pilot
follow-up if coordinators need to manage participants. **▶ Next: tester re-verify TERM-3/4 + EVT-2/3, then QA.**

---

### ✅ Case Correction Lifecycle — COMPLETE + DEPLOYED 2026-07-24 (`f866b69`; phase table row + [review](docs/reviews/case-corrections-review.md))

Design locked via PO grilling (10 decisions) + plan approved — full spec: `~/.claude/plans/agreed-tender-pixel.md`.
Flag `case_corrections`. Errcodes `HC0M0–HC0M9`. Team: backend → frontend → tester → qa.

| Unit | Scope | Owner | Status |
| ---- | ----- | ----- | ------ |
| BE-1 | Schema: `case_correction_requests` + `case_narrative_revisions` + guards, `voided` ×2, responses index swap, `current_response_id` + backfill, flag + assert fn, gen types | backend | ✅ `e6b4691` — pgTAP 3715/3715, lead catalog-verified 2026-07-24 |
| BE-2 | Reader sweep (`answer_map`/`option_aggregates`/`get_case_detail`/`start_or_resume_phase`) + `sync_case_phase_on_submit` supersedes-skip + pointer-set · pgTAP `263` | backend | ✅ `9073ddf` — pgTAP 3729/3729; K3 vacuity self-caught + redesigned (isolated fixture, mutation-proven); guard structural arm only (authenticated case-bound still hard-blocked until BE-3); lead catalog-verified |
| BE-3 | Request doors (file/start/save-body/resubmit/review/approve/reject/withdraw, incl. narrative + void arms) + `guard_supersession_coherent` corrector arm + RLS read arms + audit · pgTAP `264` | backend | ✅ `12ba3f8` — pgTAP 3766/3766 (264 = 37 asserts, K2b/K4/K10 mutation-proven red-on-revert); lead catalog-verified (8 secdef doors, anon revoked, 3 policies carry read arm). **QA note:** free-text reasons deliberately EXCLUDED from audit payloads (Rule 11 + LGPD-erasure vs the hash-chained log) — diverges from `supersede_response` live precedent, which is flagged as its own follow-up chip — **✅ resolved 2026-07-24**: migration `20260826000000` (`1d5b8fe`) swept the free-text reason out of `supersede_response` + `cancel_session`/`no_show_session` audit payloads (all other text payload args catalog-verified enum-guarded; ADR 0074 amended; pgTAP 3782 green; remote `db push` pending). Void decided directly from `requested` (no draft ⇒ no resubmit leg). |
| BE-4 | Blocks sweep (`voided` settles blocks, DB-side) + `reopen_case` + drop `reopen_narrative` · pgTAP `265` *(TS blocked-derive sweep moved to FE-2 — component files are frontend-owned)* | backend | ✅ `2131552` — pgTAP 3776/3776 (K1/K5 mutation-proven); lead catalog-verified. Findings: BE-1 dead-grants defect fixed forward (tables had no `authenticated` SELECT → policies were dead); `guard_case_status` forbids terminal exits ⇒ scoped `app.in_reopen_rpc` exception (completed→open only; cancelled terminal-forever); `activate_phase` was the only DB settled-predicate. |
| BE-5 *(was FE-1)* | Contracts: `queries/corrections.ts` + `caseCorrectionsEnabled()` + `corrections/actions.ts` (HC0M*→pt-BR maps) + `reopenCase`; `reopenNarrative` → deprecated no-op stub (sole caller `case-narrative-card.tsx`; FE-2 removes affordance, BE-6 micro deletes stub — one-file-one-owner). + `case_reopenings` reason table | backend | ✅ `242ff90` — pgTAP 3781/3781 (K7 mutation-proven) · vitest 390 · lead catalog-verified; seed forces flag ON locally (prod stays OFF until gate) |
| FE-2 | Case-detail correction UI (request dialogs, approval panel, voided/Em-correção badges, reopen, narrative revisions) + TS blocked-derive `voided` sweep + remove reopen affordance | frontend | ✅ WIP `f58540f` (crash-preserved) + complete `1eec8f8` — lead-verified. Gate GREEN: typecheck·lint 0/0·vitest 390·**real `next build` OK** (no client/server-boundary break). Live-verified via real DEFINER doors + server-DOM (concluded_at preserved, self-approved badge, one-open-request + reopen gating all proven). **Caveat for T-1: interactive click-path NOT exercised live** (Browser pane didn't composite + Next16-preview Suspense stall → clicks at 0,0); no screenshots. |
| FE-3 | Wizard correction mode (hide override panel, `resubmitCorrection`, predecessor context, chain badge) | frontend | ✅ `1480ea6` — lead-verified green at HEAD (typecheck·lint 0/0·vitest 390·real `next build`). Override panel structurally suppressed in correction mode (no `phaseResultContext` + `phaseResult` forced off); submit branches to `resubmitCorrection`; requestId resolved server-side via `draftResponseId` match (no query param); predecessor banner + "Atual" supersession badge on respostas. Live-verified via server-DOM + real doors (pointer moved to successor, phase stays `completed`). Same click-path env caveat as FE-2 → T-1. |
| BE-6 | Delete orphan `reopenNarrative` stub (`src/lib/case-narratives/actions.ts:838`) — 0 callers after FE-2 | backend | ✅ `5223855` — 0 refs, typecheck·lint 0/0·vitest 390; narrative-reopen retirement fully closed (DB RPC dropped BE-4 · caller removed FE-2 · stub gone). *(nit: one stale `reopen_narrative` mention in an actions.ts comment — QA sweep)* |
| T-1 | `case-corrections.spec.ts` + `case-void-reopen.spec.ts` + narrative/regression extensions | tester | ✅ new specs 7/7 · `case-narratives.spec.ts` extended 13/13 · regression signals (`case-phase-result`/`sup-supersession`) 14/14, 0 regressions · 1 bug filed (BUG-CORR-001, MINOR) — see Bug Log |
| FE-4 | Fix **BUG-CORR-001**: stale "reabri-la depois" dialog string (`conclude-narrative-button.tsx`) + remove vestigial `canReopen` prop/guard (`case-narrative-card.tsx`, `case-phase-list.tsx`) | frontend | ✅ `450d8d5` — reworded confirm copy to the correction flow; removed `canReopen` prop/guard (no-op: only fired in the legacy `!showLifecycle` branch where it was always false); typecheck·lint 0/0·vitest 390 |
| LEAD e2e:prod | Full `npm run e2e:prod` suite-green declaration (after FE-4; lead-owned) | lead | ⚠️ **run 1 triaged: feature GREEN, gate not yet clean.** 700p/70f/6flaky. **All 7 correction specs PASS** (case-corrections AC1–4 batch-2, case-void-reopen AC1–3 batch-3). Reds = infra + baseline + 1 stale spec: **~60 infra** (107 ERR_CONNECTION, batch-10 stack-death 43f/82conn + batch-1 warmup 13); **batch-6 (8) = notifications/nsp baseline flaky** (whole-file, 0-conn, outside cases); **batch-2 real = `case-access.spec.ts` AC-6** ("coordinator reopens narrative" — stale, `reopen_narrative` retired → T-2 fix). Needs: T-2 fix AC-6 + clean-stack re-run of failed-clean specs to confirm baseline → re-declare. |
| T-2 | Fix stale `case-access.spec.ts` AC-6 (drop retired narrative-reopen step) + clean-stack confirm-run of the clean-failed specs (notifications, nsp-per-hospital, case-narratives AC-9, case-access AC-4/6) to separate baseline-flaky from regression | tester | ✅ AC-6 reconciled to the correction lifecycle (also fixed a cascading AC-10 order-dependency it broke) · clean-stack combined re-run 76/76 (1 conditional skip), 0 conn-errors · notifications + nsp-per-hospital confirmed baseline-flaky, not regressions · re-verified BUG-CORR-001 fixed (FE-4 `450d8d5`) — closed |
| QA | Phase review (neutralization-oracle on new guard arms; `prosecdef` + `pg_policies` sweep) | qa | ✅ **APPROVED** (0 P0/0 MAJOR/2 MINOR/5 INFO) — write-path triple-lock neutralization-proven live [review](docs/reviews/case-corrections-review.md). MINOR-1 fixed pre-merge (BE-7); MINOR-2 fixed post-deploy (BE-8); INFO-1 rides as follow-up. |
| BE-7 | MINOR-1 fix — stamp `impact_snapshot` on void approvals + ADR §7 align | backend | ✅ `c6fe28c` — pgTAP 3782/3782, K11 mutation-proven (test 34 red-on-revert) |
| DEPLOY | Merge→origin→remote `db push`→flag ON | lead | ✅ ff-merge → main; `git push origin` ✅; remote `db push` ✅ (2nd attempt). **BUG-CORR-002** caught mid-deploy: BE-1 `current_response_id` backfill wasn't `app.in_case_rpc`-wrapped → passed all gates (local reset = 0 rows) but tripped `guard_case_phase_status` (23514) on data-bearing remote; fixed `6b50abc` (guard-wrap), proven on seeded data (unwrapped→23514, wrapped→ok), remote re-push clean + backfill verified live (1 row). Flag ON in prod. |
| BE-8 | **MINOR-2 fix** (post-deploy follow-up) — flag-off errcode → `HC000` (distinct from the invalid-state `23514` the doors raise) so `mapCorrectionError` + `mapCaseError` (reopen sweep) stop mislabeling a race/stale request as "recurso não disponível" | backend | ✅ gate-green, **commit + remote `db push` pending (user-gated)** — migration `20260826000100` rewrites `assert_case_corrections_enabled` from the live catalog (only errcode changes); `HC000` = the shared feature-off sentinel (mirrors `assert_ethics`/`charters_enabled` + the ethics/case-recusals/action-items TS maps). pgTAP **3783/3783** (264 K8→`HC000` + new **K8b distinctness keystone** flag-ON→`23514`; 265 K4→`HC000`); typecheck·lint 0/0; live-catalog `HC000`-confirmed |

---

### ✅ Controlled-Document Redesign (Phase 17 v2) — COMPLETE (human-approved 2026-07-21) — record → [document-control-redesign.md](docs/progress/document-control-redesign.md)

Rebuild of the Phase-17 controlled-doc UI to the design handoff + 4 gaps + enum-key anglicization (`doc_type`/`decision`
English, pt-BR labels intact) + all-in-one create wizard + new-version wizard + `description`. Flag `controlled_docs`
unchanged (prod-OFF till pilot); PHI-free. **Gate:** tsc/lint 0 · Vitest 369/369 · tester E2E **25/25** · pgTAP `201`
29/29 · full `e2e:prod` triaged-green (8 reds all pre-existing/env, **0 redesign regressions**; documents 12/12 in-suite) ·
**qa APPROVED** (0/0/0/4 INFO). Build fix `4e56efc` (worktree-nested standalone). ff-merged → `main`. Follow-ups
(pre-existing, filed as task chips): hollow `document_approvals` keystone in `252`; `FLOW-7` ethics keyboard-vote flake.
Full detail → [document-control-redesign.md](docs/progress/document-control-redesign.md) · backend surface →
`docs/backend-state.md` § DOC-REDESIGN.

---

### ✅ AUDIT-DOOR-BLINDNESS · P0 — COMPLETE (human-approved 2026-07-18) — record rotated → [authz-p0-door-blindness.md](docs/progress/authz-p0-door-blindness.md)

**Outcome:** exhaustive catalog-driven door-audit (292 gate neutralizations) found **no live leak** — door-blindness
was platform-wide *coverage* debt. Closed with a standing invariant (ADR [0079](docs/decisions/0079-authz-door-blindness-standing-invariant.md);
INVARIANT HOLDS) + **50 mutation-proven isolation keystones** (250/251/252) + FIX-A (26 core-predicate ERRORs →
all COVERED). qa ✅ APPROVED (0 P0/0 MAJOR/2 MINOR); baseline PASS 3288. Pre-req eol fix (`a32be9c`) also unblocked
the pilot reset. **72 low-severity gates allowlisted = tracked follow-up burn-down** (invariant-surfaced). Full
detail: [record](docs/progress/authz-p0-door-blindness.md) · [triage](docs/reviews/authz-door-audit-triage.md) ·
[qa](docs/reviews/authz-door-audit-p0-review.md). **✅ S4 (ETH·E2 · RV2 R2–R5 · CH) COMPLETE 2026-07-20.**

*(Build-detail working notes — sweep methodology, the 292-case oracle, FIX-A/B/C batch-by-batch breakdown —
rotated out; fully preserved in [authz-p0-door-blindness.md](docs/progress/authz-p0-door-blindness.md).)*

---

### ✅ AUTHZ · Gate 1 + Gate 2 — COMPLETE (human-approved 2026-07-17)

**Gate 1 + Gate 2 both human-approved (2026-07-16 / 2026-07-17).** Gate 1 = M1–M6 + A2 `_case_caps` resolver + A4 policy-narrowing + A5 + U1/U2 exclusion perimeter + Stage-B `case_access_grants` hard cut. Gate 2 = Stage C meeting-confidentiality (C0–C8) · F1 referral split · N1 NSP-PHI · G-cleanup. qa **APPROVED** (P0 + 3 MAJOR behaviourally closed, mutation-proven; **MINOR-1 rides noted**). Task detail → [authz-gate1-units.md](docs/progress/authz-gate1-units.md); live state + §7 lessons → [authz-handoff.md](docs/progress/authz-handoff.md); backend surface → [backend-state.md](docs/backend-state.md); verdicts → `docs/reviews/authz-*.md`. **AUDIT-DOOR-BLINDNESS** (program-wide `prosecdef` door audit) is a pre-pilot P0 (Remaining work above). **▶ NEXT: S4** (ETH·E2 · RV2 R2–R5 · CH).

### ✅ S2 + S3·ETH·E1 COMPLETE (2026-07-14) — records rotated out

- **S2** (pilot cores: **IV2** · **RV2·R1** · **AI**, all human-approved + recorded 2026-07-14) → detail in
  [s1-substrate.md](docs/progress/s1-substrate.md) · [iv2-interviews.md](docs/progress/iv2-interviews.md) ·
  [rv2-r1-referrals.md](docs/progress/rv2-r1-referrals.md) · [ai-satellites.md](docs/progress/ai-satellites.md).
  S0 gate → [s0-ratification.md](docs/plans/pre-pilot-release-s0-ratification.md).
- **S3 · ETH·E1** — ✅ **human-approved + recorded 2026-07-14** (`phase(E1)`); **the m2 gate is released**. Full
  track detail → **[eth-e1-access-spine.md](docs/progress/eth-e1-access-spine.md)**; summary row in the phase
  table above; [review](docs/reviews/phase-ETH-E1-review.md) (3 rounds → APPROVED).
- **PO directed:** BUG-AIF-001/FUP-AI-1 → pre-pilot (own workstream, not yet started) · the **three ETH·E1 known
  gaps → ETH·E2** (see Follow-ups).

### ✅ COMPLETE — S4 · CH (Committee Charters & Meeting Cadence, Phase 21) — human-approved 2026-07-20 → `main`

Per-commission charter (meeting frequency + optional link to the commission's regimento, a
`doc_type='regimento'` Phase-17 controlled document) + a computed 4-state cadence indicator
(`em_dia`/`em_atraso`/`sem_reunioes`/`sem_regimento`) + an agenda/action carry-forward suggestion at meeting
scheduling + a cadence-overdue notification arm. SQLSTATE `HC0K·`; flag `charters` seed-ON locally, **prod-OFF**
till pilot. No PHI (Rule 12). Design ratified 2026-07-20 (ADR
[0080](docs/decisions/0080-committee-charters-cadence-model.md); plan
[charters-cadence.md](docs/plans/charters-cadence.md)).

**Gate:** pgTAP `260`/`261`/`262` = 11/29/10 (mutation-proven: KS_AUTHORITY/KS_MEMBER/KS_FILTER all RED-PROVEN) ·
E2E `charters-cadence.spec.ts` 10/10 (prod build, run twice) · full-suite `e2e:prod` triage found 0 CH
regressions — the one real issue was a pre-existing spec-brittleness bug (`phase17-documents.spec.ts` assumed
globally-unique doc codes; CH's valid seed exposed that codes are per-commission; fixed `cb6a671`), the rest was
a `supabase_vector` crash-loop intermittently 502-ing the auth gateway even while `docker ps` showed it healthy
(memory `supabase-vector-crashloop-502`). QA **APPROVED r1** (0 P0/MAJOR/MINOR, 3 info, all accepted/by-design).

Full task ledger (commits CH-BE-1…CH-QA), the backend surface, and the complete gate-triage writeup →
**[ch-charters-cadence.md](docs/progress/ch-charters-cadence.md)**. QA → [phase-CH-review.md](docs/reviews/phase-CH-review.md).

---

### ✅ COMPLETE — S4 · RV2·R2–R5 (Referrals v2 governance) — gate-passed + human-approved 2026-07-19 → `main`

**ff-merged to `main` (`a61aae3`, 2026-07-19); branch `feat/rv2-governance` deleted.** Full detail →
**[docs/progress/rv2-r2-r5-governance.md](docs/progress/rv2-r2-r5-governance.md)**; backend surface → **`docs/backend-state.md` §RV2**.
R2 `8d2125b` · R3 `dd5d090` · R4 `b9cad33` · R5 `c301a14` · FE `027db02` (+ audit fix `1885159`, a11y `1893cb6`).
Each increment git+catalog+**live `set local role`**-verified, keystones mutation-proven (R2 `decline_note` PHI-gate ·
R3 authority-first `42501` · R4 assignment/link≠access **0-residue** · R5 **source≠target≠QPS** notes + Rule 11
note-read audit). Gate: governance E2E **29/29** + R1 40/40 · pgTAP `150_referrals` **217/217** · full-suite **0 RV2
regression** · **QA APPROVED** (0 P0/MAJOR after 1 fix round — QA caught a Rule 11 audit gap, re-proven live).
Local only — origin push + Coolify deploy + pilot reset DEFERRED; `case_referrals` OFF till pilot. Follow-ups
(non-blocking): `189` pgTAP stale-fixture baseline (RV2-unrelated, cleanup flagged) · notes-SSR hardening (INFO).
**▶ Next S4 track: CH (Committee Charters), SQLSTATE `HC0K·`.**

---

### ✅ COMPLETE — S4 · ETH·E2 (procedure) — gate-passed + human-approved 2026-07-18 → `main`

Full ethics disciplinary procedure (intake → admissibility → allegations/findings → decisions → quorum votes →
issue → notifications → `participants_only` hearings → appeals) + 5 coordinator controls + the coordinator-gated
"Processo ético" UI tab. Reconciled to ADR 0078 (`HC0F·`→`HC0J·`; hearings on Stage-C `participants_only`;
`legal_privileged` letter → Stage E; 5 coordinator app-actions wired). **Full per-task ledger, test-gate triage,
and QA verdict rotated → [docs/progress/eth-e2-procedure.md](docs/progress/eth-e2-procedure.md).** Commits
`ada4c97`…`2adb169`; migs `20260817000000`–`…000700`; pgTAP `253`–`259`; E2E 20/20; QA **APPROVED**
([review](docs/reviews/eth-e2-review.md)). Non-blocking follow-ups: **INFO-1** (respondent direct-`PATCH` of own
targeted-response status skips the submit-audit row — self-scoped) · **INFO-2** (org_admin case-phase responses
via the pre-existing `responses` arm).

> **Test-gate triage (66 raw E2E reds → 0 deterministic E2 regression; 8 pre-existing pgTAP), the per-task commit
> ledger, and the QA crux findings are in the rotated record → [docs/progress/eth-e2-procedure.md](docs/progress/eth-e2-procedure.md).**

---

### ✅ COMPLETE — S1 substrate & ✅ SIGNED OFF — S0 gate (records rotated out)

- **S1 substrate** (MEM · SUP · N) — ✅ all recorded 2026-07-13; full track detail → [s1-substrate.md](docs/progress/s1-substrate.md).
- **S0 Design & Sequencing Gate** — ✅ signed off 2026-07-13 (spine + 6 specs + §I ledger block-ratified; PO full sign-off: M2 = minimise/don't-destroy · AI·O-2 = stakeholders-only). Full record → [s0-ratification.md](docs/plans/pre-pilot-release-s0-ratification.md).
- **⚕️ Suite-health track** (parallel, non-blocking) — the `e2e:prod` gate carries a documented ~18–31 pre-existing flaky-red baseline (memory [[e2e-prod-build-flaky-baseline]]); real pay-down = per-test DB isolation / `retries=0` or a known-flaky allowlist. DEFERRED. Detail → [s1-substrate.md](docs/progress/s1-substrate.md).

### 📋 Remaining pre-pilot work

Expanded 2026-07-12 — ADR [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md). The live phase is
tracked under **🏗️ ACTIVE** above; this is the standing backlog behind it.

· **S4 ✅ COMPLETE 2026-07-20** — ✅ **ETH·E2** (2026-07-18) + ✅ **Referrals v2 R2–R5** (2026-07-19) + ✅ **CH** Charters (Phase 21, 2026-07-20 — ADR [0080](docs/decisions/0080-committee-charters-cadence-model.md) / [detail](docs/progress/ch-charters-cadence.md)), all → `main`
· **S5** — **ETH·E3a** terminology/UX (E3b needs Phase 16)
· Phase 16 — Standards Crosswalk (🔜 **deferred** 2026-07-11, needs replanning; blocks E3b)
· **BUG-AIF-001 / FUP-AI-1** (PO-directed pre-pilot; own workstream, not yet started)
· ✅ **BUG-PROD-ACTIONS — RESOLVED (environment drift, not a code defect).** `node_modules/next` had silently drifted to **16.2.9** (the pre-BUG-AIF-001 version) while `package.json`/lockfile pinned **16.3.0-preview.5**; `npm ci` → 16.3 + a `REBUILD=1` full run collapsed the 21–31s action-hang **and** the "~18–27 prod flaky baseline" to ~1. Confirmed in the Gate-2 version-drift audit (`2698696`); PO-approved at the Gate-2 close. Full investigation detail → [bug-log-archive.md](docs/progress/bug-log-archive.md).
· ✅ **P0 · AUDIT-DOOR-BLINDNESS — RESOLVED 2026-07-18, human-approved.** The door-level re-audit (292 gate neutralizations across every `authenticated`-reachable DEFINER door) found no live leak — platform-wide test-coverage debt, not a Gate-1 breach. Closed with a standing invariant (ADR [0079](docs/decisions/0079-authz-door-blindness-standing-invariant.md)) + 50 mutation-proven keystones; qa APPROVED. Full detail → [authz-p0-door-blindness.md](docs/progress/authz-p0-door-blindness.md).
· the **Coolify app deploy** + the **remote `db push`** of the S1–S3 local-only migrations — deferred to the pilot by design (every S-phase builds local-first). **This is when the ETH·E1 m2 flag flip reaches production.**

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
     Resolved/closed bugs are archived at phase close → docs/progress/bug-log-archive.md (~78 rows). --> **Perimeter: U1 DONE (`f4df6f4`) — recused-coord grant closed + dead storage arm removed; U2 (content-write tail) building. Both before pilot.** |
| ID | Phase | Severity | Description / repro | Expected | Actual | Spec | Owner | Status |
| -- | ----- | -------- | ------------------- | -------- | ------ | ---- | ----- | ------ |
| BUG-CORR-001 | case-corrections (T-1) | MINOR (stale user-facing copy + dead code, not a security/data issue) | `ConcludeNarrativeButton`'s confirm dialog (`src/components/cases/conclude-narrative-button.tsx:52-53`) still reads "Ao concluir, o conteúdo desta narrativa é congelado e deixa de ser editável. **A coordenação pode reabri-la depois, se necessário.**" — but `reopen_narrative` was dropped platform-wide (BE-4) and NO "Reabrir narrativa" control exists anywhere in the render tree (grepped every `case-*.tsx`; only live "Reabrir" is the case-level `ReopenCaseButton`, ADR 0085 intended). Repro: sign in `chefe.ccih@test.local`, open any case with an open narrative, click "Concluir" on the narrative card → the confirm dialog text. Related dead code (same root cause, not user-facing but worth cleaning alongside): `case-narrative-card.tsx`'s `canReopen` prop (doc comment L52-53 + the guard at L213) and `case-phase-list.tsx`'s live `canReopen` computation (L160-163, `isOpen && status==='completed' && canManageLifecycle`) are both now VESTIGIAL — computed/threaded but never used to render a control. | The confirm-dialog copy should say the narrative can only be corrected via the correction lifecycle (no more in-place reopen); the dead `canReopen` prop/computation should be removed. | Copy still promises an in-place reopen; dead prop survives BE-6's stub cleanup. | `e2e/case-narratives.spec.ts` AC-9 | frontend | **✅ RESOLVED** — fixed by FE-4 `450d8d5` (copy now points at the correction lifecycle; `canReopen` removed from both files). Re-verified 2026-07-24 (tester, T-2): `e2e/case-narratives.spec.ts` AC-9 updated to assert the NEW copy + absence of the old string, clean-stack re-run green. |
| BUG-E3A-001 | ETH·E3a (T-1) | MAJOR (2 of the phase's 3 terminology strings never render anywhere in the UI, despite the backend fully resolving them — the primary deliverable of E3a is 2/3 unimplemented) | `getCaseDetail` correctly resolves `detail.terminology.case.singular = "Denúncia"` and `detail.terminology.primarySubject.singular = "Médico denunciado"` for the seeded Ethics case (`ca000000-…-e1`) — confirmed live via the passing pgTAP `262`. But NO frontend component reads `detail.terminology.case` or `detail.terminology.primarySubject` anywhere (exhaustive grep of `src/app` + `src/components`: the ONLY consumer of `.terminology.` is `case-tabs.tsx`/`(detail)/layout.tsx`'s `timelineLabel={detail.terminology.timeline.singular}`). `case-detail-view.tsx`'s H1 and the `(detail)/layout.tsx`'s H1 both call `formatCaseNumber(c.caseNumber)` (`src/components/cases/format.ts:9`), which hardcodes the literal string `"Caso "` regardless of case type. The string "Médico denunciado" (the seeded `case_participant_roles.display_name` for `respondent_doctor`) is never rendered by any component — no participants/subject panel exists on the case-detail surface for a `primary_subject_kind='professional'` case (the design doc's own §2.5 touch-list called for `case-detail-view.tsx` to "swap primary_subject-framed copy", but the delivered FE-1/FE-2 build (PROGRESS.md's own reconciliation note) only wired the timeline-tab label). Repro: sign in `chefe.ccih@test.local`, open `/o/rede-a/c/ccih/manage/cases/ca000000-0000-0000-0000-0000000000e1` → H1 reads "Caso 0006" (not "Denúncia …"); "Médico denunciado" does not appear anywhere on the page (confirmed via `page.getByText(...)`, 10s timeout, element not found). | H1/breadcrumb renders "Denúncia" (not "Caso"); "Médico denunciado" appears where the primary-subject label belongs (acceptance §4-1). | H1 = "Caso 0006"; "Médico denunciado" absent from the DOM entirely. | `e2e/ethics-e3a-surfacing.spec.ts` TERM-3, TERM-4 (both fail reproducibly — isolated re-runs + 2 full-file runs on independent fresh resets) | frontend | **✅ RESOLVED** — fixed by FE `ef5c38b` (new `formatCaseNumberWithTerm(detail.terminology.case.singular, caseNumber)` on both detail H1s; new read-only `CasePrimarySubjectPanel` rendering `terminology.primarySubject.singular` + the primary-subject participant, shown when `primarySubjectKind` is `professional`/`entity`). Re-verified 2026-07-27 (tester): TERM-3 passes as-is; TERM-4 needed a spec-only selector fix (see Test Run Summary — the panel legitimately shows "Médico denunciado" twice, as its own heading and as the seeded respondent's role line, so a plain `getByText` strict-mode-failed; retargeted to `getByRole('region'/'heading', {name:...})`). Full spec 21/21 on 2 independent fresh resets, no regression in the other 17. |
| BUG-E3A-002 | ETH·E3a (T-1) | MINOR (cosmetic — the RLS security boundary is unaffected and independently proven correct; only the informational badge fails to render, and only for viewers already authorized to see the row) | `src/lib/queries/case-documents.ts`'s `listCaseEvents()` (the sole reader feeding `CaseEventsTimeline`) never selects the `case_events.visibility` column (its `.select(...)` list at L234-238 omits it) and its row mapper hardcodes `visibility: 'case_readers'` for EVERY returned event (L255), with a stale comment claiming "BE-5 projects it" — it never was. Consequence: the "Somente coordenação" Lock badge (`case-events-timeline.tsx:96-101`, gated on `ev.visibility === "coordinator_only"`) can NEVER render for anyone, even a coordinator legitimately viewing a genuine `coordinator_only` row (confirmed both for an auto-derived `finding_recorded` event AND a manually-created one via the UI's own "Visibilidade → Somente coordenação" toggle — both persist `coordinator_only` correctly in the DB, per direct query, but the client always displays them as if `case_readers`). Row PRESENCE/ABSENCE per viewer is unaffected (proven correct: EVT-4/5/6 pass — an ordinary reader never receives the row at all, RLS-enforced upstream of this bug). Repro: sign in `chefe.ccih@test.local` on any case with a `coordinator_only` event → the event row renders with no "Somente coordenação" badge. | A `coordinator_only` event's row carries the "Somente coordenação" badge for any viewer who can see it (design doc §2.5). | Every event displays as if `case_readers`; the badge never renders regardless of the true value. | `e2e/ethics-e3a-surfacing.spec.ts` EVT-2 (auto-derived), EVT-3 (manual) — both fail reproducibly, isolated + full-file runs | backend | **✅ RESOLVED** — fixed by BE `1ce0876` (`listCaseEvents()` now selects `visibility` and projects the real column instead of the hardcoded `'case_readers'`; stale comment removed). Re-verified 2026-07-27 (tester): EVT-2 (auto-derived `finding_recorded`) and EVT-3 (manually-flagged note) both now show the "Somente coordenação" badge, on 2 independent fresh resets. Row presence/absence (the actual RLS boundary) was already correct throughout and remains unaffected (EVT-4/5/6 still pass). |

**0 open bugs.** BUG-E3A-001 (MAJOR) and BUG-E3A-002 (MINOR) both resolved + re-verified 2026-07-27 (above) — full spec `e2e/ethics-e3a-surfacing.spec.ts` 21/21. BUG-CORR-001 resolved + re-verified (above). All other rows resolved + verified; full detail rotated → [bug-log-archive.md](docs/progress/bug-log-archive.md). Latest close-out (2026-07-23, lead): the 3 remaining OPEN test-only bugs — **BUG-MAIO-001** and **BUG-AISAT-001** (same root cause as the already-fixed BUG-AISAT-002) and **BUG-F3E2E-002** (cross-spec seed contamination) — evaluated, fixed/verified on a fresh `db reset`, and archived; the `document-detail-redesign` branch’s 7 DDR spec regressions (all test-only, doc suite 24/24) archived alongside.

## Test Run Summary

<!-- Full historical run log (Phases 0 → S2, 133 rows) archived → docs/progress/test-run-archive.md.
     Keep only the most recent gate's rows here; rotate the rest to the archive at each §6 Record. -->

| Date | Phase | Specs | Passed | Failed | Notes |
| ---- | ----- | ----- | ------ | ------ | ----- |
| 2026-07-27b | ETH·E3a (T-1) — post-fix-loop re-verification of BUG-E3A-001/002 (chromium, dev server; NOT the full suite — `e2e:prod` gate is the lead's to run) | `e2e/ethics-e3a-surfacing.spec.ts` (all 21) | **21/21**, run on 2 independent fresh resets (deterministic) | **0** | **Both bugs re-verified fixed, marked RESOLVED in the Bug Log.** FE `ef5c38b` (BUG-E3A-001) + BE `1ce0876` (BUG-E3A-002) landed since the round-1 report; re-ran the full spec twice from a clean `supabase db reset` each time — same 21/21 both times. TERM-3 (case-term heading "Denúncia …") and EVT-2/EVT-3 (coordinator_only badge, auto-derived + manual) now pass outright. **TERM-4 needed a spec-only selector fix, not a re-file**: the new `CasePrimarySubjectPanel`'s heading and the seeded respondent's `case_participant_roles.display_name` are BOTH the literal string "Médico denunciado" (ADR 0064 D4's own example reuses the words for both the term and the role), so my original `page.getByText('Médico denunciado')` hit a Playwright strict-mode violation (2 matches) rather than a real failure — retargeted to `getByRole('region', {name:'Médico denunciado'})` scoped to the panel + a non-vacuous check that the actual respondent ("Dra. Denunciada") resolves inside it, not just an empty-state placeholder. Confirmed the other 17 tests are unaffected by the new primary-subject card / heading change (no regression). **Housekeeping**: BE-8 (`1173900`) renumbered the E3a pgTAP files `260`-`263` → `266`-`269` (resolved the CH/case-corrections numbering collision) — fixed the two stale `263_ethics_e3a_dashboard.sql` references in my own spec (`DASH-SETUP`'s title + comment, ~line 545) to `269_...`; confirmed no other stale `26[0-3]_ethics_e3a` references remain. Lint (`eslint --max-warnings=0`) + `tsc --noEmit` clean. **▶ Next: QA.** |
| 2026-07-27 | ETH·E3a (T-1) — pgTAP re-confirm (fresh reset, `supabase test db`) + new E2E spec (chromium, dev server; NOT the full suite — `e2e:prod` gate is the lead's to run) | pgTAP: `260_ethics_e3a_surfacing.sql` + `261_ethics_e3a_autoderive.sql` + `262_ethics_e3a_terminology_reads.sql` + `263_ethics_e3a_dashboard.sql` (full suite `supabase test db`, 135 files) · E2E: `ethics-e3a-surfacing.spec.ts` (new, 21 tests) | **pgTAP 63/63** (20+20+9+14; full suite `Files=135, Tests=3848, Result: PASS`) · **E2E 17/21** (run 3× on independent fresh resets, fully deterministic — same 4 fail every time) | **pgTAP 0** · **E2E 4** (2 real bugs, 2 failing tests each) | **pgTAP independently confirmed** — do not trust a self-reported total; re-ran the FULL ordered suite myself on a clean reset per protocol. **E2E coverage**: terminology (TERM-1/2/5 pass: ethics case → "Cronologia processual" tab; non-ethics case → unchanged "Linha do tempo" + "Casos" board heading) · kind-widen/visibility floor + auto-derive (EVT-1/4/5/6 pass: 3 real E2 RPCs — `decide_admissibility`/`add_ethics_allegation`/`record_ethics_finding` — correctly auto-emit labeled `case_events`; an ordinary granted reader sees the 2 `case_readers` events and NOT the `coordinator_only` one; a respondent AND a recused reader are denied the case route entirely, RLS-floor-correct) · dashboard confidentiality keystone (DASH-0a/ROLE-GATE/0e/SETUP/1/EXCLUDE-SETUP/EXCLUDE/5, all pass: coordinator's count rises by exactly the fixture (+3 total, +1 pending, +2 admissible, +2 issued, +1 each sanction); **discovered mid-run that `/dashboard/ethics` is gated `staff_admin`-only at the PAGE level** — a plain granted `staff` member cannot reach it at all (verified via live source + `notFound()`), so redesigned the "excluded viewer" scenario around the coordinator themselves made respondent/recused on throwaway cases — proves the deny-terms bind even the commission's OWN staff_admin, a stronger form of acceptance #6/#7 than the original design; foreign-commission coordinator, same org, unaffected) · keyboard-only (KBD-1/2 pass: board → tab-to-case-link → Enter → tab-to-"Cronologia processual" → Enter lands on `/timeline`; the dashboard page itself has no in-app nav link yet — O-2 follow-up, already tracked in PROGRESS.md, not a new finding — so its keyboard check starts from a direct URL nav and confirms no focus trap). **2 bugs filed** (BUG-E3A-001 MAJOR terminology, BUG-E3A-002 MINOR visibility badge — see Bug Log for full repro/evidence). **3 own-harness bugs found+fixed during the write-up (spec-only, 0 app fixes)**: (1) a one-shot `.count()` check in my dashboard reader raced the server-streamed render and read "0 cases" on a page that hadn't finished painting — fixed by waiting for the stat-card-or-empty-state region first (the same class of bug `e2e-networkidle-purged` warns about, web-first assertions only); (2) `new RegExp(rowLabel)` on a sanction label containing literal parentheses ("Advertência (E3a Dash)") silently elided the required parens — the exact trap `ethics-e1-access-spine.spec.ts`'s own AC-9 comment documents for a document title — fixed by using Playwright's plain-string substring match instead; (3) fixture creation initially lived in `beforeAll` (which runs before EVERY test including the "before" baseline capture), collapsing every delta to ~0/nonsensical — fixed by moving fixture creation into an explicit mid-sequence test. **Also flagged (non-blocking, INFO)**: the E3a pgTAP files are numbered `260`–`263`, colliding with the ALREADY-SHIPPED `260_charters.sql`/`261_charters_rpcs.sql`/`262_charter_notifications.sql` (CH, Phase 21) and `263_correction_readers.sql` (case-corrections) — no functional collision (`supabase test db` runs by full filename, not numeric prefix; confirmed both sets ran and passed independently), but the numeric echo is confusing across PROGRESS.md phase rows and worth a rename (e.g. `266`–`269`) at the next convenient touch. Lint (`eslint --max-warnings=0`) + `tsc --noEmit` clean on the new spec. Commit `2956aaf`. **Update:** BE-8 (`1173900`) did the rename → `266`-`269` right after this row; the 2 bugs were fixed + re-verified 21/21 → see the **2026-07-27b** row above. |
| 2026-07-24b | Case Correction Lifecycle (ADR 0085, T-2, branch `case-corrections`) — post-`e2e:prod` triage reconciliation: 1 stale spec fixed + baseline confirmation on a clean local stack (prod-standalone, chromium, `--workers=1`; NOT the full suite) | `e2e/case-access.spec.ts` (AC-6 fixed + a cascading AC-10 order-dependency it exposed) + clean-stack combined re-run: `notifications.spec.ts` (7) + `nsp-per-hospital.spec.ts` (20) + `case-narratives.spec.ts` (13) + `case-access.spec.ts` (23, 1 conditional skip) | **76/76** (1 conditional skip, AC-7's "if a safety event is linked" branch — benign) across 3 combined runs as the fix-loop landed | **0** (on the clean stack; conn-errors=0 every run) | **AC-6 fix**: the lead's `e2e:prod` triage (700p/70f/6flaky) found exactly one real (non-infra, non-baseline) red — `case-access.spec.ts` AC-6 asserted the RETIRED narrative-reopen ("coordinator reopens") instead of the new reality. Reconciled per the coordinator's option (b): the second half now proves the coordinator corrects the concluded narrative via the Case Correction Lifecycle (self-designated corrector) instead of an in-place reopen — which ALSO replaces the old reopen-then-restore hygiene step (a concluded narrative can no longer be re-edited in place, HC055, so the correction path is now the only way back to the seeded body). **Cascading fix**: my own AC-6 change left "Resumo Clínico" permanently concluded (no more reopen), which broke the LATER `AC-10` keyboard test (it assumed an editable Resumo for staff2) — retargeted AC-10 to the seeded-unattributed "Achados e Discussão" narrative instead, with a service-role setup/teardown that temporarily reassigns staff2 there (and temporarily un-assigns Resumo, since a blind Tab-to-first-"Abrir" would otherwise still land on Resumo's now-frozen "Abrir" link, which "Meus Casos" still renders as a read-only view link) — both narratives restored to their seeded state afterward so `AC-N1`/`AC-4`/`case-narratives.spec.ts AC-4` keep their preconditions. Also updated `case-narratives.spec.ts` AC-9: BUG-CORR-001's fix (`450d8d5`, landed concurrently by FE-4 while this task ran) changed the confirm-dialog copy AC-9 had captured as stale-copy evidence — re-verified the fix live and flipped the assertion to check the NEW correct copy + absence of the old string; **BUG-CORR-001 marked RESOLVED** in the Bug Log. **Baseline confirmation**: `notifications.spec.ts` (7/7) and `nsp-per-hospital.spec.ts` (20/20, incl. AC-7 `dispose_referral_phi`) are both 100% green on a clean stack, confirming the lead's `e2e:prod` batch-6 reds were infra/whole-file flake, not a regression. **Stack note**: `supabase_vector` WAS actively crash-looping this session (`docker ps` showed `Restarting (0)` every ~10-25s throughout; `docker logs` root cause: its `docker_logs` source gets `Network unreachable` reaching the Docker API from inside the container — a local Docker-networking limitation, not caused by this feature) — `supabase stop && supabase start` did NOT stop the loop, but a real `/auth/v1/token` POST (not just `/health`) returned 200 every time it was checked, and one `db reset` did hit a transient 502 during "Restarting containers" (retried successfully). Did not touch `supabase/config.toml` (`[analytics] enabled=false`, the documented last-resort mitigation) — that's backend's file; flagging it for backend/lead as a candidate if the loop causes further `db reset`/gate friction. Lint (`eslint --max-warnings=0`) + `tsc --noEmit` clean on every file touched. |
| 2026-07-24 | Case Correction Lifecycle (ADR 0085, T-1, branch `case-corrections`) — tester scoped run against a real prod-standalone build (`node .next/standalone/server.js`, `next@16.3.0-preview.5`, `--workers=1`; NOT the full suite — `e2e:prod` gate is the lead's to run) | `case-corrections.spec.ts` (new, 4 tests) + `case-void-reopen.spec.ts` (new, 3 tests) + `case-narratives.spec.ts` (extended +2, full file re-run 13 tests) + regression signals `case-phase-result.spec.ts` (9) + `sup-supersession.spec.ts` (5) | **24/24** (new 7/7 + narratives 13/13 + regression 14/14 — narratives' own 11 pre-existing ACs counted once) | **0** | **0 app-blocking bugs; 1 MINOR filed (BUG-CORR-001).** Full clickable loop proven live: file (default corrector → plain-staff `staff1.ccih`) → "Em correção"/"Continuar correção" → wizard (override panel structurally absent — asserted via `heading:/Resultado da fase/` count 0) → edit → "Enviar para revisão" → approve (self-approved badge, only staff_admin in CCIH) → corrected answer "atual" on the phase respostas page. Reject→re-edit→resubmit→approve loop (AC-2), keyboard-only file + server-proven one-open-slot block (direct `file_correction_request` RPC retry → rejected, not just UI-hidden) + withdraw-frees-slot (AC-3), narrative correction parity preserving `concluded_at/by` + revision history (AC-4). Void spec: anulação clears the result + phase pill "Anulada", downstream `blocks:[1]` phase proven to STAY unblocked after voiding (not merely unblocked by the prior completion — the mutation-sensitive proof), redo via `add_ad_hoc_phase`, `reopen_case` on a concluded case re-enables filing, a cancelled case never offers reopen (server-proven: direct `reopen_case` RPC on the cancelled case also rejected, HC0M8). case-narratives.spec.ts extended with AC-9 (an individually-concluded narrative — the `canReopen` condition's strongest case — shows NO "Reabrir" control anywhere) + AC-10 (correcting a UI-concluded narrative preserves its conclusion stamp byte-for-byte). Fix-loop (own specs, chromium, scoped re-runs — 4 iterations, all spec-only, 0 app fixes): (1) the flat single-item wizard still gates submit behind "Revisar" (my wrong assumption, not app behavior) — added the click+heading wait; (2) my REOPEN case fixture forgot the template always yields 2 phases (Phase 2 `blocks:[1]`), so `close_case` correctly rejected with HC031 until I `skip_phase`'d it first; (3) Radix auto-focuses the dropdown's first item on keyboard-open — my extra `ArrowDown` moved focus to item 2, so `toBeFocused()` failed; (4) two Playwright strict-mode violations from my own imprecise selectors (`/Solicitada/i` also matched the panel's "Solicitada por:" `<dt>`; `/Corrigir/i` also matched the pre-existing "Corrigir resultado" button on a result-emitting phase) — retargeted to exact/anchored matches. **BUG-CORR-001** (MINOR, filed not fixed): `ConcludeNarrativeButton`'s confirm-dialog copy still promises "a coordenação pode reabri-la depois" — `reopen_narrative` was fully dropped and no such control exists; plus a related vestigial `canReopen` prop/computation (3 sites) never wired to any live UI. Keyboard-only flow: AC-3's file step (Tab-focus → Enter-open → keyboard-typed reason → Tab-to-submit → Enter). Lint (`eslint --max-warnings=0`) + `tsc --noEmit` both clean on every file touched. |
| 2026-07-23b | Stale-spec drift repair — 2 pre-existing `main` reds surfaced by a full prod-gate run, NOT caused by the custom-fields feature (lead-assigned, isolated to `e2e/`) — tester scoped run (chromium; NOT the full suite — `e2e:prod` gate is the lead's to run) | `charters-cadence.spec.ts` (10 tests, fix verified) + `action-items-satellites.spec.ts` (investigated only, NOT fixed) | **charters-cadence 10/10 (×2 runs)** | **charters-cadence 0** · **action-items-satellites 1 (§7.2, confirmed real app bug, not further run)** | **`charters-cadence.spec.ts` — FIXED, spec-only, stale-column drift.** AC-7's fixture `dbInsert('action_items', …)` used `case_id`; migration `20260818000300` renamed it to `linked_case_id` platform-wide. Swapped the one insert field + 2 stale doc-comment mentions (`e2e/charters-cadence.spec.ts:30,34,337`). Live catalog confirmed the RLS policies (`action_items_select`/`_staff_admin_write`), `app.can_read_action_item`, and `suggest_carry_forward` were ALL already on `linked_case_id` — only the spec was stale. 10/10 green, run twice back to back, no flakes. Commit `a54ad23`. **`action-items-satellites.spec.ts` — INVESTIGATED, NOT a stale spec: REAL APP BUG found + filed as BUG-AISAT-002 (see Bug Log), spec left UNCHANGED.** §7.2's `itemRow(page, T_TOGGLE)).toBeVisible()` (line 539) fails because `src/lib/queries/meeting-action-items.ts`'s `listMeetingActionItems()` still selects the SAME renamed `case_id` column (line 104) — confirmed via live catalog, a raw REST reproduction of the exact select string (HTTP 400 `42703 column action_items.case_id does not exist`), and a direct `create_committee_action_item` RPC + RLS-scoped-read probe that ruled out RLS/authorization as the cause (the row IS readable). NOT case-link-specific: the query has no conditional branching, so the "Itens de ação" panel is silently empty for EVERY meeting, always, right now (fails closed — the error is swallowed to `[]`, not surfaced). Per the lead's explicit instruction, did not touch `src/`, did not weaken the assertion to mask it. Full evidence chain + exact file/line pointers in the BUG-AISAT-002 row. Debug fixtures (a throwaway meeting + action item used to isolate RLS vs. query-layer) created + deleted via service-role REST, verified clean afterward. |
| 2026-07-23 | Case custom fields (ADR 0083, branch `worktree-adr-0083-case-custom-fields`) — tester scoped run (chromium; NOT the full suite — `e2e:prod` gate is the lead's to run) | `case-custom-fields.spec.ts` (new, 8 tests) | **8/8, run 3× clean** (serial once; `--repeat-each=2` in one invocation → 16/16; default parallel `fullyParallel` workers once → 8/8) | **0** | **0 app bugs.** Covers AC-1..AC-7 in full + AC-8 best-effort: create-dialog reveal + atomic capture (AC-1, keyboard-only fill of both new controls), required-field blocks creation until filled (AC-2), the non-PHI fill-time warning (AC-3), seeded-case detail display incl. dropdown code→label resolution (AC-4, read-only), edit-after-creation persists across reload on a dedicated self-created case so the shared seed stays untouched (AC-5), opt-in list column + search fold (AC-6, read-only), process-less exclusion proven as a true negative (select CF template → block shows; switch to "Sem processo" → block disappears) (AC-7), and best-effort draft-only authoring via `CustomFieldsCard` + the slot dialog on an isolated draft template (AC-8). One fix-loop iteration: my own `dialog.getByText('Campos personalizados')` in AC-7 was a strict-mode trap (case-insensitively substring-matched the template `<option>` text AND the PII-warning sentence too) — retargeted to `getByRole('group', {name:...})` scoped to the fieldset; not an app defect. **Environment note (not a code issue):** this worktree had NO `node_modules` at all (worktrees don't share it — `docs/worktrees.md`); ran `npm install` first. Separately, a cold/never-before-warmed dev server under `fullyParallel` concurrency produced transient login/navigation timeouts (Next dev-mode serializes on-demand compilation across many distinct first-hit routes) — resolved by warming the server once; confirmed NOT a race by re-running with default parallel workers against the warm server (also 8/8). Lint (`eslint --max-warnings=0`) + `tsc --noEmit` both clean. Commit `c298215`. |
| 2026-07-17 | **AUTHZ (ADR 0078) Gate 2 — CONCLUDED** (Stage C · F1 · N1 · G-cleanup; human-approved). The 5 verbose gate rows rotated → [test-run-archive.md](docs/progress/test-run-archive.md). | full `e2e:prod` (59 specs/10 batches, corrected 16.3 env) · full pgTAP (146 mig) · dev regression sweeps | **e2e 719p/2f/1flaky · pgTAP 3186 PASS** (authz 772/772) | **0 Gate-2 regressions** | ✅ **GREEN — qa APPROVED re-review + human-approved.** The 2 e2e fails were cases-board stragglers (shared-DB batch pollution), fixed `ae87f24`, re-verified 108/0/0 in their batches. The "~18–27 flaky baseline" was BUG-AIF-001/16.2.9 drift (collapsed to ~1 on corrected 16.3). Verdict → [authz-gate-2-review.md](docs/reviews/authz-gate-2-review.md). |

> **✅ Env (2026-07-16): local test stack healthy** — the AUTHZ Gate-1 `e2e:prod` run completed all 10 per-batch
> `supabase db reset --local` cleanly (no `reset FAILED`); the pgTAP + dev-isolation resets also returned rc=0.
>
> **Most recent CLOSED gate: AUTHZ Gate 2** (2026-07-17) — Stage C · F1 · N1 · G-cleanup; qa APPROVED re-review +
> human-approved; **0 regressions** → [authz-gate-2-review.md](docs/reviews/authz-gate-2-review.md) ·
> [authz-handoff.md](docs/progress/authz-handoff.md). **Prior: S2·RV2·R1** (Referrals v2, 2026-07-14,
> `phase22-referrals` 40/40, 0 RV2 regressions) → [rv2-r1-referrals.md](docs/progress/rv2-r1-referrals.md).
> Prior S2 gates: **AI** → [ai-satellites.md](docs/progress/ai-satellites.md) · **IV2** →
> [iv2-interviews.md](docs/progress/iv2-interviews.md) · **S1 substrate** →
> [s1-substrate.md](docs/progress/s1-substrate.md).
> Their run rows (2026-07-08 → 07-14, 12 rows) + full history → [test-run-archive.md](docs/progress/test-run-archive.md).
> **Post-Gate-2 scoped runs (2026-07-18 → 07-22e, 8 rows: ETH·E2 · S4·CH · Phase-17-v2 redesign · the document-detail-redesign DDR fix-loop) rotated there verbatim on 2026-07-23** — all their DDR bugs are RESOLVED + archived in the Bug Log; PROGRESS.md keeps only the most recent gate + the 2 newest working rows.

## QA Verdicts

<!-- One row per phase/feature, ONE LINE only: verdict + date + link to docs/reviews/*.md
     (the full analysis already lives there — do not restate rationale here, and do not
     copy it to docs/progress/qa-verdicts-archive.md either, that's redundant with the
     review file). Legacy rows predating this rule may still point at qa-verdicts-archive.md. -->

| Phase / Feature | Verdict | Report | Notes |
| --------------- | ------- | ------ | ----- |
| S5 · **ETH·E3a** — Ethics terminology/UX surfacing (ADR 0064 D4 / 0072 / 0073) | ⛔ **CHANGES REQUESTED** (2026-07-27, r1) — **1 P0** / 0 MAJOR / 0 MINOR / 3 info. P0-1: `coordinator_only` case-events narrowing is defeated for non-coordinator **write**-grantees — `case_events_writer_write` is `cmd=ALL` with bare `USING can_write_case_content(...)`, OR-ed into SELECT (ADR-0079 reader-non-writer blindness), so a write-granted non-coordinator reads `finding_recorded`/`vote_cast` events. Proven live (`leak=1`; st_x `is_staff_admin=false`,`can_write=true`); all four pgTAP miss it (266/267 test only read-grantees, 268 only the write CHECK). Bodies are PHI-free templates so today's leak is metadata, but the gate fails open — blocking in a Rule-12 phase. **Positives (proven, not asserted):** `getEthicsDashboard` scoping load-bearing (neutralize `can_read_case`→true ⇒ respondent totalCases 1→3, 269 keystones RED); 3 dashboard tables single SELECT policy on `can_read_case`, no FOR-ALL read-arm; auth client (no service-role/DEFINER); auto-derive bodies PHI-free (267 token test); full suite 3848 PASS; O-1 inheritance yields `explicit_grants_only`. Fix: close the writer policy's SELECT read-arm + add a mutation-proven write-grantee keystone. | [review](docs/reviews/phase-E3a-review.md) | |
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
  parallel workers). 0 app bugs. Detail → Test Run Summary 2026-07-23.
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
