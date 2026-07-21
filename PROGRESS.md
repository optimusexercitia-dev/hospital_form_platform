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

### 🏗️ IN PROGRESS — Controlled-Document Redesign (Phase 17 v2) — branch `feat/document-control-redesign` (worktree)

Redesign of the shipped Phase-17 controlled-docs UI to the "Document Control" handoff, translated onto the
platform design system, + 4 functional gaps + enum-key anglicization (controlled-docs only). PO scope locked
2026-07-21. **Plan** → [docs/plans/document-control-redesign.md](docs/plans/document-control-redesign.md) ·
**ADR** [0081](docs/decisions/0081-controlled-document-redesign.md) (extends [0069](docs/decisions/0069-status-key-anglicization.md)).
Flag `controlled_docs`, prod-OFF till pilot (unchanged). PHI-free (Rule 12 N/A).

**Locked:** all-in-one create wizard (chained action + Save-as-draft) · approver notifications+Remind (Phase-20
wiring) · version compare (metadata+summary) · category+tags · retired-vs-superseded (`obsolete_kind`) · register
full-adopt (KPI+chips+search+table) · anglicize `doc_type`/`decision` (politica→policy, pop→sop, protocolo→protocol,
regimento→bylaws, manual→manual, outro→other; aprovado→approved, rejeitado→rejected — **labels stay pt-BR**) · full §6 gate.

**Wave 1 (backend) — ✅ complete** (`5752aa9`): B0 anglicization + B1 schema + B2 RPCs + B3 chained
`createAndSubmitDocument`/`createDraftOnly` + B4 reads/filters + §4 notifications + staff_admin-gated
`remind_document_approver`. Gates: tsc/lint 0 · new pgTAP `201` 21/21 · `200`/`226`/`261`/`262` green · types
regenerated. Keystone traps handled (stale-local-DB DEFINER re-emit → repo's runtime-rewrite pattern; 2 extra B0
couplings `upsert_commission_charter` + `trg_audit_document_approvals` swept in lockstep). **Lead-verified the 8
full-suite pgTAP reds are pre-existing/base-branch, not this wave** — 7 on non-document tables; the 1
`document_approvals` assertion in `252` reads a hardcoded id `0a218158` present in **no** seed/migration on `main`
either (a dead keystone predating this wave; filed for base-branch triage — see Bug Log). Contract frozen → FE.

**Wave 2 (frontend) — ✅ complete** (`7f55f76`…`a1a5cdb`, 7 commits; tsc/lint 0, in-browser verified as chefe.ccih +
staff2.ccih): 6 shared composites + register (KPI/chips/search/table + `in_approval` approval mini-bar) + 4-step create
wizard (create→submit **and** Save-as-draft, both verified: DOC-0003 `in_approval`, DOC-0004 `draft`) + detail
(right-rail cards + focus-trapped CompareModal + Remind) + notification deep-links (`routing.ts` + `resolveHrefs`) +
emerald→`success` cleanup. Fixed a latent **data-loss bug** (`update_controlled_document` overwrites category/tags →
`DocumentEditor` now posts both). **Flagged for PO/lead:** (1) register derives "Em revisão" + the approval mini-bar via a
bounded `getDocument` **N+1** — needs an additive list field (lead will fold the fix into Wave 2.5); (2) **new-version
wizard deferred** — the frozen contract has no chained supersede-submit action (the functional detail-based new-version
flow is built + verified); PO decision pending; (3) no **"description"** field (no column) — PO decision. Test residue
(DOC-0003/0004, DOC-0001 superseded) cleared by `db reset` before the gate.

**Wave 2.5 — 🏗️ in progress** (PO decided 2026-07-21: build the new-version wizard + add a `description` field).
- **2.5a backend:** `supersedeAndSubmitDocument` chained action (create-flow parity, same partial-failure semantics)
  + additive `controlled_documents.description` column (wired into create/update RPCs + actions + types) + register
  list fields (`latestVersionNumber`/`hasOpenRevision` + approval signed/total counts) to kill the getDocument N+1.
  Regen types + extend pgTAP.
- **2.5b frontend:** new-version **wizard mode** (locked identity + callout) wired to `supersedeAndSubmitDocument`
  + Descrição field (create wizard + detail header) + consume the new list fields (drop the N+1 fan-out).

→ **Wave 3 = §6 gate** (tester E2E + qa + human).

<!-- backend-owned ledger (backend teammate updates ONLY this sub-block) -->
**backend — Wave 1 build ✅ COMPLETE (contract frozen for Wave 2).** Migrations
`20260819000000`–`000300` (B1 schema · notification-enum superset · B0+B2 RPC re-emit · §4
producers+remind). Types regenerated; `tsc` 0 · `lint` 0.
- **B0** (this module only): `doc_type` politica→policy/pop→sop/protocolo→protocol/regimento→bylaws/manual/outro→other;
  `decision` aprovado→approved/rejeitado→rejected. CHECK swaps + all writer/comparator bodies re-emitted from
  **live** `pg_get_functiondef`. Keystone-2 couplings caught + fixed in lockstep: `upsert_commission_charter`
  (`doc_type='bylaws'` filter), `trg_audit_document_approvals` (decision branch). FE value-literal sweep (typed
  arrays/filters/comparisons in `documentos*`/`charter`/`document-editor`/`approvals-panel`/`approval-sign-form`) +
  seed + pgTAP fixtures (200/261). `sem_regimento` cadence key + indicator `'manual'` source left untouched (out of scope).
- **B1/B2/B3/B4/§4** built per plan; `remind_document_approver` REVOKE-FROM-PUBLIC + body-enforced staff_admin authority.
- **pgTAP:** new `201_documents_redesign.sql` **21/21**; `200` **47/47**, `226` **69/69**, `261`/`262` green. Full suite
  **3644 tests / 3636 pass**; the **8 failures are pre-existing** in `250`/`251`/`252` (case_phase / meeting-attendee /
  agenda / professional_profiles RLS + one assertion on a `document_approvals` id created in no seed/migration) —
  **zero overlap with this wave's surface**; flagged for lead/base-branch triage.
- **Contract summary** for `frontend` posted with this commit (see the commit body / backend report).

**backend — Wave 2.5a (additive PO follow-up) ✅ COMPLETE.** Migration `20260819000400`
(description column + create/update re-emit +`p_description` + `list_commission_documents`
DEFINER register read). `tsc` 0 · `lint` 0; types regenerated.
- **`supersedeAndSubmitDocument`** action — new-version chained analogue of `createAndSubmitDocument`
  (`supersede → upload → set_file → submit`); identity locked; partial-failure returns `documentId`.
- **`description`** free-text column (overwrite semantics, out of the audit payload) wired through
  create/update RPCs + all four create/update actions + `ControlledDocument` type + `getDocument`.
- **Register N+1 removed:** `listDocuments` now sources `list_commission_documents` (member-gated
  DEFINER, REVOKE-FROM-PUBLIC) returning DB-side `hasOpenRevision` + `approvalsSignedCount/TotalCount`;
  filters applied in TS over the small per-commission set.
- **pgTAP:** `201` extended to **29/29** (supersede-and-submit precondition-fail HC089; description
  create/update round-trip + NOT in audit payload; register `has_open_revision` + approval counts).
  Full suite **3652 / 3644 pass**; same 8 pre-existing `250`/`251`/`252` reds, no new regressions.

<!-- frontend-owned ledger (frontend teammate updates ONLY this sub-block) -->
**frontend — Wave 2 build ✅ substantially complete** (branch `feat/document-control-redesign`, 6 commits `7f55f76…dda3a4b`).
Built against the frozen contract (`@/lib/documents/*`, `@/lib/queries/*`); zero backend-contract files touched
(only the delegated `routing.ts` + `queries/notifications.ts` resolveHrefs). `tsc` 0 · `lint` 0 throughout.
Composites → F-A → F-B(create) → F-C → F-D → F-E all done + verified in-browser. **Remaining:** the dedicated
new-version *wizard* (deferred — functional path exists; contract-gap reasoning in the FE report).
- **Shared composites ✅** — `Stepper`, `Dropzone`, `TagField`, `Segmented` (`src/components/ui/**`) +
  `ReviewerPicker`, `ChecklistRail` (`src/components/documents/**`). Token-based, keyboard-first,
  reduced-motion-safe; `role=radiogroup`/`checkbox`/`progressbar`, roving tabindex, drag-drop over a real
  file input (DataTransfer sync). tsc 0.
- **F-A register ✅** — KPI strip (FE-computed) · filter chips (incl. derived "Em revisão" = effective+open-draft, "Arquivados" = obsolete) · debounced title/code search + category combobox (datalist autocomplete, O1) · URL-driven table with the `in_approval` approval mini-bar (signed/total), category + tags, truncation. Derived-status/approval extras via a **bounded `getDocument` fan-out** over non-terminal docs (the list contract carries neither — see contract-gap note). Removed dead `document-filter-bar`/`document-register-list`; loading skeleton updated. Verified in-browser (chips/search/KPIs/mini-bar, 0 console errors).
- **F-E (partial)** — emerald→`success` on the effective status chip (`document-badges.tsx`). approvals-panel spot pending (bundled with F-C/F-D).
- **F-B create wizard ✅** — 4-step `CreateWizard` (Detalhes · Documento · Aprovadores · Confirmação) + sticky `ChecklistRail`, WizardRunner boundary (server `novo/page.tsx` loads candidates + categories, binds actions; client imports `@/lib/**` type-only). Terminal `createAndSubmitDocument`; **Salvar rascunho** = `createDraftOnly` (available from any step once titled); partial-failure routes to detail + `?aviso`. Committee implicit. Verified in-browser end-to-end: create→upload→submit → DOC-0003 `in_approval` (category+tags+2 approvers w/ Cargo persisted) AND Save-as-draft → DOC-0004 `draft`. 0 console errors. Also fixed a **data-loss bug**: `DocumentEditor` (edit) now posts category+tags (the RPC overwrites both — omitting wiped them).
  - Reconciled vs handoff (contract-driven): no doc "description" field (dropped); integer versions (no semver Major/Minor Segmented).
- **F-B new-version wizard** — pending (detail "Nova versão" entry).
- **F-C detail ✅** — two-column: left = lifecycle affordances (add-version / submit / publish / supersede / obsolete, preserved) + version-history spine; right rail = *Detalhes do documento* + *Documento controlado* cards. Header uses the derived status chip (`Em revisão` when effective + open draft). `VersionCard` spine (current accent-bordered, obsolete-kind chip), compare-select → focus-trapped `VersionCompareModal` (metadata side-by-side, changed "Depois" cells flagged *alterado*, Radix focus-trap). **Remind** wired into `ApprovalsPanel` (pending approvers of the version under approval → `remindDocumentApprover`, surfaces `remindSent`/`remindSkipped`). `?aviso` banner (`DetailNotice`). Verified in-browser: rail/approvals/Remind on DOC-0003; supersede DOC-0001 → derived "Em revisão" + revisão banner; compare v1→v2 shows correct diff + focus-trap + close. Replaced `DocumentVersionsList` (dead).
- **F-E (partial→more)** — 2nd emerald spot fixed: `approvals-panel.tsx` aprovado badge → `text-success`. Both F-E spots now done.
- **F-D sign/queue + notification deep-links ✅** — wired `notificationHref` (routing.ts) + the `resolveHrefs` branch (queries/notifications.ts, delegated) for the two new entity types: `controlled_document_version` → the org-level **sign page** (`documentos-pendentes/{documentId}`, resolving version→document via a batched `.in()` lookup + commission→org slug); `controlled_document` → the commission **detail** page. Verified end-to-end in-browser as the approver (staff2.ccih): bell shows the DOC-0003 notification + Remind, both deep-linking to `/o/rede-a/documentos-pendentes/{docId}`; the sign page + queue render (code aligned to `text-primary`). 0 console errors.
- **F-B new-version wizard** — detail retains the (restyled, two-column) supersede → add-version → submit affordances as the functional new-version path; a dedicated new-version *wizard* is the one remaining plan item (see report). 
- ⚠ **Contract-gap note (non-blocking, reported to lead):** `ControlledDocumentListItem`/`listDocuments` expose neither a `latestVersionNumber`/`hasOpenRevision` flag (for the derived "Em revisão") nor per-doc approval counts (for the `in_approval` mini-bar). F-A derives both in-contract via a bounded `getDocument` fan-out over effective+in_approval docs. A small additive list field would remove the N+1.

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
| BUG-MAIO-001 | NOT AUTHZ — found during Stage-B dev validation | LOW — test-only; app behavior is a deliberate, documented UX improvement | Local commit `4f23558` ("layout adjustments", on this branch, not yet on main) added a title self-link (`itens-de-acao/{id}`) to EVERY action-item row in `ItemRow` (`src/components/action-items/action-items-table.tsx`) — every source, incl. `manual`, now links to its own detail page (closes a documented "used to be a dead end" gap). This broke two pre-existing assertions in `member-action-items-overview.spec.ts` that assumed exactly one link per row: AC-2/3 (`manualRow.getByRole('link')).toHaveCount(0)` now finds 1) and AC-7 (`.getByRole('link').first()` now resolves to the new title link, not the "Gerado de" source link). Repro: `npx playwright test e2e/member-action-items-overview.spec.ts --project=chromium --workers=1 -g "AC-2/3\|AC-7"`. | Assertions scoped to the "Gerado de" column specifically. | Assertions count/target ANY link in the row. | `e2e/member-action-items-overview.spec.ts:452,602,610` | tester (spec-side; flagged via spawn_task `task_b6e6d55d`, not yet actioned) | **OPEN — non-blocking for AUTHZ Stage B.** Not caused by, and does not affect, the `case_access_grants` hard cut. |
| BUG-AISAT-001 | NOT AUTHZ — found during Stage-B dev validation | LOW — reproducible timeout; app-vs-test-timing root cause undetermined | `action-items-satellites.spec.ts` §7.4 (reminder CRUD) hangs 30s inside the `openSatellites` helper waiting for the "Acompanhamento de AISAT-E2E Item de lembretes" disclosure toggle on a freshly-created MEETING-sourced item. Reproduced 4/4 (isolated ×2 via `-g`, full-file ×2, both cold and warm dev-server state). Ruled out: stale/duplicate `action_items` rows (0 found via direct query before each attempt); not a cold-compile effect (fails identically warm). My only edit to this file was removing 2 no-op `setFeatureFlag('case_access', …)` lines (the flag no longer exists) — unrelated to this test's logic. Repro: `npx playwright test e2e/action-items-satellites.spec.ts --project=chromium --workers=1 -g "§7.4"`. | Disclosure opens; the "Lembretes" region renders. | 30s timeout; `getAttribute('aria-expanded')` never resolves. | `e2e/action-items-satellites.spec.ts:575` (test) / `:306` (helper) | unassigned (flagged via spawn_task `task_c952a222`, not yet actioned) | **OPEN — non-blocking for AUTHZ Stage B.** Not caused by, and does not affect, the `case_access_grants` hard cut. |
| BUG-F3E2E-002 | F3 gate (pre-existing test-infra, NOT F3) | LOW — test isolation/harness; no product impact | **Full-suite-only** failures that ALL pass on a fresh-reset isolated batch → cross-spec seed contamination + the Windows prod-standalone monolith backlog-collapse (memory `e2e-prod-build-flaky-baseline`). (a) `case-access` AC-2:297 staff4 Meus-Casos not empty (earlier spec's case grant persisted) → PASS 1.4s isolated; (b) `ui-batch-2026-07` S1:725 seeded meeting badge not "Realizada" (earlier meetings spec concluded it) → PASS 2.2s; (c) `views-labels-participants` AC-4:359 convoked members 11 vs 9 (earlier user-registration/hospital-admin specs added 2 CCIH members) → PASS 2.7s (=9); (d) `perf-sweep-wave2` P2-b:250 setup `expect(referralsOn).toBe(true)` false (transient flag-enable) → PASS 2.0s. The 31 "did-not-run" are serial-`describe` siblings of the 6 failures — all RUN+PASS once the blocker clears. NOT F3 (surface untouched). | Each passes under proper isolation. | Fails only under full-suite ordering / monolith backlog. | `case-access:297` · `ui-batch:725` · `views-labels:359` · `perf-sweep-wave2:250` | tester/infra | **OPEN — non-blocking for F3.** Durable fix: per-test DB isolation + `reducedMotion` in playwright.config + chunked-batch gate. |
> **The 2 flagged-not-filed findings are RESOLVED too (2026-07-17, tester, re-verified):** `184_hospital_admin_isolation.sql` (25/25, was 24/25) and `229_authz_m1_exclusion_durability.sql` (89/89, was 87/89) both fully green on the same fresh-reset full pgTAP run. `backend-authz` confirmed my read was right — both were stale pre-Stage-C assertions (184's `ha1`/hospital_admin and 229's `sa_y`/org_admin "clean coordinator" twins) superseded by C7's deliberate org-admin-arm removal — and updated the two test files' expectations accordingly, no app-code change. Matches the 228/A26 adjudication pattern.
> **1 OPEN — test-only, NON-BLOCKING, NOT F3** (BUG-F3E2E-002 full-suite contamination + Windows monolith backlog — see row; no product defect, F3 surface untouched). **BUG-F3E2E-001 RESOLVED 2026-07-12** (tester) — the nsp `networkidle` spec-fragility; the 2 timeouts + all 23 non-deliberate `networkidle` waits in the spec converted to web-first assertions, verified 32/32 on a fresh-reset prod-standalone run. **BUG-AIF-001 RESOLVED 2026-07-11 + verified** — root cause was an upstream Next.js bug (fix `next` 16.2.9 → 16.3.0-preview.5, PR #95391), regression gate passed (608p/12f, 0 new regressions). **BUG-ADM-001 RESOLVED + verified.** **BUG-MEM-001 RESOLVED + verified 2026-07-13** (tester) — ambiguous `profiles` embed (2 FKs on `memberships`) qualified with the explicit FK hint in `members.ts` + a 2nd latent embed in `commissions.ts`; 87/87 across 4 specs, 0 failures. All four archived → [bug-log-archive.md](docs/progress/bug-log-archive.md).

## Test Run Summary

<!-- Full historical run log (Phases 0 → S2, 133 rows) archived → docs/progress/test-run-archive.md.
     Keep only the most recent gate's rows here; rotate the rest to the archive at each §6 Record. -->

| Date | Phase | Specs | Passed | Failed | Notes |
| ---- | ----- | ----- | ------ | ------ | ----- |
| 2026-07-20 | S4·CH (Committee Charters & Cadence, Phase 21) — tester scoped run (chromium; NOT the full `e2e:prod` gate — lead's to run for the green declaration) | `charters-cadence.spec.ts` (new, 10 tests) | **10/10, run twice** (fresh `db reset` + a same-DB re-run) | **0** | 0 bugs filed. Covers plan §9 in full: cadence indicator × 4 states, regimento render (live-fetched review-due date, not the stale "REG-0001" code), foreign-commission HC0K2 + 404, charter save round-trip incl. keyboard-only + audit row, carry-forward agenda copy round-trip (DB-verified originals untouched), and the confidentiality filter exercised via the `case_restricted`+`case_id` branch (CH-BE-3's pgTAP only covered `assignees_only`) — absent for a denied plain member, present as a positive twin for a readable item. Schema/RPC shapes verified against the live local Postgres catalog, not migration-file text. |
| 2026-07-18 | S4·ETH·E2 (procedure) — tester scoped run (chromium; NOT the full `e2e:prod` gate — lead's to run for the green declaration) | `ethics-e2-procedure.spec.ts` (new, 20 tests) + `ethics-e1-access-spine.spec.ts` (regression cross-check, run on the SAME post-run DB, no reset between) | **20/20 + 13/13 (+1 skip)** | **0** | 0 product bugs. **CAVEAT A resolved (environmental)** — case-detail routes hydrate + a real dialog opens on click under Chromium prod-standalone, on both `/manage/cases/[id]` and `.../etica`. **CAVEAT B resolved** — this is the authoritative interactive/visual pass. Full §4 lifecycle driven as real writes incl. the keyboard-only vote + a dynamically-computed eligible-voter set for quorum (not hardcoded); M2 retention-pin + HC0J7 redaction-bar verified; `visibility_policy`/`confidentiality_level` round-tripped back to seed values, confirmed by re-running E1's spec clean on the same DB. Detail → the ETH·E2 task table above. |
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

## QA Verdicts

<!-- One row per phase/feature, ONE LINE only: verdict + date + link to docs/reviews/*.md
     (the full analysis already lives there — do not restate rationale here, and do not
     copy it to docs/progress/qa-verdicts-archive.md either, that's redundant with the
     review file). Legacy rows predating this rule may still point at qa-verdicts-archive.md. -->

| Phase / Feature | Verdict | Report | Notes |
| --------------- | ------- | ------ | ----- |
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
