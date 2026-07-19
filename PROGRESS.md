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
| 20    | Notifications & Escalation *(**pulled pre-pilot** 2026-07-12 — ADR [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md))* | 🔜 not started (pre-pilot) | – | – | – | – | – | – |
| 21    | Committee Charters & Cadence *(**pulled pre-pilot** 2026-07-12 — ADR [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md))* | 🔜 not started (pre-pilot) | – | – | – | – | – | – |
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
| referrals-v2 | **Referrals v2 — Dialogue & Governance** *(pre-pilot expansion of Phase 22; ADR [0037](docs/decisions/0037-inter-committee-case-referrals.md) Amendment 1)* — adopts the missing two-way dialogue (`referral_messages` thread, R1) + defers triage/SLA/assignments/etc. across R2–R5; extends (never contradicts) the Phase-22 core. R1 shipped — see S2·RV2·R1 below. Plan: [referrals-v2-dialogue-governance](docs/plans/referrals-v2-dialogue-governance.md). | 🔜 **planned (design accepted 2026-07-12; not implemented)** | – | – | – | – | – | – |
| interviews-v2 | **Interviews v2 — Sessions + Reporting/Confidentiality** *(pre-pilot revision of Phase 11; ADR [0070](docs/decisions/0070-interview-data-model-v2-sessions.md))* — adopts `interview_sessions` 1:N (hard-cut of the 5 scheduling cols), `interview_category`, non-enforcing `confidentiality_level`; defers enforcement + participant-registry wiring to E1. Extends (never contradicts) the Phase-11 core. Shipped — see S2·IV2 below. Plan: [interviews-v2-sessions](docs/plans/interviews-v2-sessions.md). | 🔜 **planned (design accepted 2026-07-12; not implemented)** | – | – | – | – | – | – |
| pre-pilot-release | **Pre-Pilot Release Scope Expansion** *(umbrella — 12 initiatives pulled into the pilot release 2026-07-12; ADR [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md); plan [pre-pilot-release-scope-expansion](docs/plans/pre-pilot-release-scope-expansion.md))* — S0 design gate → S1 substrate (N/MEM/SUP) → S2 cores (RV2·R1/IV2/AI) → S3 ETH·E1 (releases the m2 gate) → S4 ETH·E2/RV2 R2–R5/CH → S5 ETH·E3. Only Phases 18–19 stay post-pilot. Pilot follows this whole block + Coolify deploy + origin push. | 🏗️ **in progress — AUTHZ ✅ COMPLETE (Gate 1 + Gate 2, 2026-07-17); ▶ next S4** (branch `pre-pilot-release-s0`, **local ahead of origin**; **S0 ✅** + **S1 substrate ✅** [→ [s1-substrate](docs/progress/s1-substrate.md)]; **S2 cores ✅ ALL 2026-07-14**: **IV2 ✅** [`phase(11-v2)`] · **RV2·R1 ✅** [`phase(rv2-r1)`] · **AI ✅** [`phase(ai)`]; **S3 · ETH·E1 ✅ COMPLETE 2026-07-14** [`phase(E1)`; **m2 gate RELEASED**; → [eth-e1-access-spine](docs/progress/eth-e1-access-spine.md)]; **✅ AUTHZ COMPLETE 2026-07-17** (ADR [0078](docs/decisions/0078-authorization-capability-model.md); own gate unit) — **Gate 1** (Stage A/B: `_case_caps` resolver + `case_access → case_access_grants` hard cut) + **Gate 2** (Stage C meeting-confidentiality · F1 referral split · N1 NSP-PHI · G-cleanup) both **human-approved**; qa APPROVED re-review [review](docs/reviews/authz-gate-2-review.md) (P0 + 3 MAJOR behaviourally closed, mutation-proven; MINOR-1 rides noted). **▶ then S4 = ETH·E2 · RV2 R2–R5 · CH**) | – | – | – | – | – | – |
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

### ✅ AUDIT-DOOR-BLINDNESS · P0 — COMPLETE (human-approved 2026-07-18) — record rotated → [authz-p0-door-blindness.md](docs/progress/authz-p0-door-blindness.md)

**Outcome:** exhaustive catalog-driven door-audit (292 gate neutralizations) found **no live leak** — door-blindness
was platform-wide *coverage* debt. Closed with a standing invariant (ADR [0079](docs/decisions/0079-authz-door-blindness-standing-invariant.md);
INVARIANT HOLDS) + **50 mutation-proven isolation keystones** (250/251/252) + FIX-A (26 core-predicate ERRORs →
all COVERED). qa ✅ APPROVED (0 P0/0 MAJOR/2 MINOR); baseline PASS 3288. Pre-req eol fix (`a32be9c`) also unblocked
the pilot reset. **72 low-severity gates allowlisted = tracked follow-up burn-down** (invariant-surfaced). Full
detail: [record](docs/progress/authz-p0-door-blindness.md) · [triage](docs/reviews/authz-door-audit-triage.md) ·
[qa](docs/reviews/authz-door-audit-p0-review.md). **▶ S4 (ETH·E2 · RV2 R2–R5 · CH) is now UNBLOCKED.**

<details><summary>archived working notes (build detail — see the rotated record for the clean version)</summary>

**Pre-req FIXED (2026-07-17, `a32be9c`):** clean `supabase db reset` was aborting on
`20260801000000_authz_exclusion_perimeter_u2` — `core.autocrlf=true` checked out 140/146 migrations CRLF,
storing `\r` into `prosrc`, so its LF-anchored `pg_get_functiondef()+replace()` guard injection matched
nothing. Fix: `*.sql text eol=lf` in `.gitattributes` (mirrors the existing `*.sh` rule); working tree
re-materialized LF; **146/146 reset clean.** Also unblocks the pilot reset.

**Population (live catalog, post-reset):** **294** `authenticated`-reachable `public` DEFINER doors (the
surfaces the product `.rpc()`s) · 231 `app` DEFINER (internal, PostgREST-unexposed — reachable only
transitively) · **212** RLS policies on 125 tables · 112 pgTAP files + 7 mutation harnesses.

**Units (planned):**
- **P0-U0 (lead):** catalog-driven coverage floor — instrument the ordered pgTAP run (`track_functions=all` +
  `pg_stat_user_functions`) to compute every reachable `public` door NEVER called by a test (the blind-door
  work-list) + a static scan for the policy arm (each policy needs a base-table keystone under `set local
  role`). Close the set, don't enumerate (§7.5). Floor catches "never exercised"; U2/qa handle "called-but-not-
  asserted-through".
- **P0-U1:** the standing invariant as a final pgTAP file — FAILS if any reachable `public` DEFINER door has 0
  test calls, or any policy lacks a base-table keystone. Codifies §7.14 against regression.
- **P0-U2 (backend):** re-assert each blind keystone through the surface the PRODUCT calls (keep the base-table
  twin); fix any real leak the door-audit surfaces. Mutation-test each (§7.1) — a keystone that can't go RED is
  not one.
- **P0-U3 (qa, independent):** door-level verification; every fix reverted must turn a keystone RED.

**Gate:** full pgTAP green on a fresh reset (incl. the new invariant) · a mutation proof for every new/altered
keystone · qa APPROVED · human approval → Record.

**✅ P0-U0 SWEEP DONE (2026-07-17) — 292 neutralization cases, oracle proven (neutralize gate → suite `FAIL`=asserted-through / `PASS`=BLIND). Harnesses: `supabase/tests/mutation/p0-authz-{door,writepath}-audit.sh`; data → scratchpad `authz-audit/`.**
- **Read/door arm (252):** 135 COVERED · **93 BLIND** (13 predicate + 80 policy) · 24 ERROR. Reachability triage: only 2 (`event_patient`,`patient_xref`) door-only (grant revoked = backstop); ~52 SELECT policies `authenticated`-reachable = live boundary **but gated by correct-looking, separately-COVERED predicates** (untested-not-leaking); rest low-severity config/catalog.
- **Write arm (40):** 9 COVERED · **29 BLIND** (26 write policy + 3 guards `assert_session_writable`/`assert_referral_draft_writable`/`assert_referral_target_acts`) · 2 ERROR. **13/14 write-blind tables DIRECT-DML reachable** (live boundary — higher risk: subtler `with_check`, [[d11]]-class staleness history).
- **26 ERROR total** = the highest-usage predicates (`is_commission_admin_of`=67 doors, `is_member_of`, `is_active`, `is_admin`, `is_staff_admin_of`, `has_role`, `is_org_admin_of`…) where blunt `→true` aborted a fixture (§7.15 run-shape guard) = **UNDETERMINED**, need bespoke neutralization.
- **No live leak surfaced.** Door-blindness = platform-wide coverage debt, not just Gate-1. **FIX-A ✅** (26 ERROR reclassified via runlogs → **all COVERED**; every neutralized run was `Result: FAIL` with keystone failures — zero blind core predicates; `can_sign_meeting` thin-1-keystone nit). Full triage + fix brief → **[authz-door-audit-triage.md](docs/reviews/authz-door-audit-triage.md)**.
- **PO-scoped fix (2026-07-18):** standing invariant + high-risk keystones (26 direct-DML write policies + 3 write-guards + 5 read-predicates + PHI-adjacent read reps, each **mutation-proven**) + low-severity config/catalog **allowlisted** (invariant surfaces them as follow-up, no silent drop). **▶ FIX-B/C building (`backend`, DB single-owner).**
  - **FIX-B ✅ (backend, 2026-07-18) — the standing invariant.** `supabase/tests/mutation/p0-authz-invariant.sh`: ARM 1 asserts sweep BLIND ⊆ `authz-blind-allowlist.txt` (116 entries = 122 committed blinds − the 6 Batch-1 fixes; new blind ⇒ non-zero exit; `FROMFINDINGS=1` fast mode); ARM 2 never-called-door floor (`track_functions=all` + full suite) asserts every authenticated-reachable `public prosecdef` door has calls>0 except `authz-neverclled-door-allowlist.txt` (93-door E2E-only baseline). **ARM 2 HOLDS.** ADR 0079.
  - **FIX-C Batch 1 ✅ (backend, 2026-07-18, committed `ecc5ac3`) — 3 write-guards + `case_referral` write family.** `supabase/tests/250_authz_p0_isolation.sql` (14/14 green) covers `assert_session_writable` (HC039), `assert_referral_draft_writable` (HC071), `assert_referral_target_acts` (HC072) + `case_referral_insert_source_coord`/`_update_coord`/`_delete_draft_source`. All 6 mutation-proven RED; BLIND→**COVERED**. [[d11]] fail-closed term verified live. Key finding: write-policy keystones need a *reader-non-writer* principal — ADR 0079. **Lead-verified.**
  - **FIX-C Batch 2 ✅ (backend, 2026-07-18) — remaining direct-DML write policies.** `supabase/tests/251_authz_p0_isolation.sql` (40 assertions, 40/40 green) keystones **20** policies, each DENY+POSITIVE twin, reader-non-writer for every UPDATE/DELETE (ADR 0079): meeting family (`meetings`/`meeting_cases`/`meeting_attendees` insert+update+delete, `meeting_agenda_items` update+delete, `meeting_signatures` insert), `rca` update+delete, `capa_plan` update+delete, `case_interviews` update+delete, `response_section_signoffs` insert, `profiles_admin_insert`. **All 20 mutation-proven RED** (`p0b`, now 26 keystones total across 250+251). Full suite **114/3240 PASS**. **No leak found.** Allowlist 116→**96** (−20). **Finding:** 2 own-row policies the batch reviewed are BACKSTOPPED, not force-keystoned — `responses_delete_own_draft` (status term enforced by `guard_submitted_response` trigger; created_by SELECT-masked) and `notification_preferences_update_own` (reassign blocked by `select_own`, not its WITH CHECK); both kept in the allowlist with justification. **2 write-arm ERRORs resolved via runlogs** (per lead): `profiles_admin_update`/`profiles_update_self` are **COVERED** by `188_hospital_user_mgmt.sql` §5 (a hospital_admin direct profile-write asserts 0-change) — opening either policy lets the write pass RLS and trip the `identity/lifecycle service-role-only` column-guard, aborting 188 = `Result: FAIL` (run-shape artifact, not a genuine PASS-with-fewer-tests); no keystone needed. **Lead-verified (`46539ad`).**
  - **FIX-C Batch 3 ✅ (backend, 2026-07-18, FINAL) — clinical/case-content write families + read reps.** `supabase/tests/252_authz_p0_isolation.sql` (48 assertions, 48/48 green) keystones **24** policies, each DENY+POSITIVE twin, reader-non-writer for every FOR-ALL/`_write` (ADR 0079): rca `_write` ×6 (evidence/factors/members/root_causes/timeline/why_chains), capa `_write` ×6 (action/action_evidence/action_task/measure/measure_result/effectiveness), case_participant_roles/`case_phase_allowed`/`case_phase_offered`/`case_tag` `_write`, `interview_sessions_write`, `meeting_agenda_items_insert`, + one read rep per predicate-group (event_custody/capa_action/professional_profiles/interview_sessions/case_participant_roles/document_approvals `_select`). **All 24 mutation-proven RED** (`p0b` now **50 keystones** across 250/251/252, all RED-PROVEN, 3 controls green 14/40/48). Full suite **115/3288 PASS**. **No leak found** — every foreign/reader denied, every writer allowed. Allowlist 96→**74** (−22). Allowlisted-with-rationale: represented-by-group selects (rca_*/capa_*/… same predicate as a keystoned rep), backstopped/unreachable writes (`notifications_update_own` no DML grant; the 2 own-row from B2), read-predicate backstops (`can_read_referral` RPC-only, `can_read_document_object` Storage, `can_read_xref_row` patient_xref door-only; `can_sign_section`/`can_read_document_of_version` now COVERED), benign predicate wrappers, low-severity config/catalog. **▶ FIX-C COMPLETE — lead-verified + authoritative invariant sweep run (INVARIANT HOLDS).**

</details>

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

### 🏗️ ACTIVE — S4 · RV2·R2–R5 (Referrals v2 governance) — opened 2026-07-18

**PO decisions (2026-07-18):** build **FULL R2→R5 now** · **R3 = full `answered`/`resolved` lifecycle**
(governance-correct; amends ADR 0037 D4/D5) · R5 trims to **notes + receipts + redaction** (context-versions
**deferred** — overlaps 0078's reserved post-pilot F-full) · QPS does **not** read internal notes (default).
R1 dialogue core already shipped (S2). Plan: [referrals-v2-dialogue-governance.md](docs/plans/referrals-v2-dialogue-governance.md) §3.

**Reconciled to ADR 0078 (F1 five-way referral-predicate split) — catalog-verified 2026-07-19 on the live stack:**
R2 metadata fields project through **`can_read_referral_metadata`** (`can_read_referral` is now a thin wrapper over it);
R3 resolve/reopen are **SOURCE-coordinator** actions → **`can_manage_referral_source`** (the banner's `can_write_referral_response`
was wrong — that = `can_manage_referral_target`, target side; corrected); R4 `referral_target_analyst` re-anchored on
`case_access_grants`; SQLSTATE `HC0A·` (authority `42501`-first, distinct from state codes); flag `case_referrals` (OFF till pilot).

| Increment | Scope | Owner | Status |
|---|---|---|---|
| R2 · Triage/SLA (PHI-free) | priority · requested-action vocab · due/overdue · non-PHI decline-reason | backend+FE | ✅ **ACCEPTED** `8d2125b` — keystone live-verified (metadata-tier reader sees 5 triage fields; `decline_note` denied under `set local role`); pgTAP 111/111 |
| R3 · Resolution cycles 🔴 | `answered`/`resolved` lifecycle · reopen · parent lineage | backend+FE | ✅ **ACCEPTED** `dd5d090` — authority-first (`42501` before `HC0A5`) verified in-body; `summary_md` PHI-revoked; close-gate `+answered`/`−draft`; pgTAP 139/139 (K1/K3/K4 mutation-proven). ⚠ FE follow-up: add `answered`/`resolved` to `referral-chips.tsx:53` |
| R4 · Responsibility/multi-link | `referral_assignments` + `referral_case_links` (assignment ≠ access) | backend+FE | ✅ **ACCEPTED** `b9cad33` — both keystones mutation-proven (assign≠access test 166; link≠access test 164) + **no residue** (all 4 read predicates catalog-clean); 42501-first; pgTAP 174/174 |
| R5 · Private notes/disclosure | internal-notes (source≠target keystone) + receipts + redaction | backend+FE | ✅ **ACCEPTED** `c301a14` — keystone LIVE-proven (source↔target cross-side denied; QPS reads referral but DENIED notes, non-vacuous); no-PQS-arm predicate; `body` PHI-revoked; pgTAP 212/212 (K-R5-1 5 tests mutation-proven) |
| FE (R2–R5 UI) | 7 new panels/pages (assignment · internal-notes · related-cases · resolutions · lineage · redact-dialog · thread-item · "Minhas atribuições") + chips fix | frontend | ✅ **VERIFIED** `027db02` — 20 files, tsc 0 · lint 0/0 · `next build` green |
| E2E gate | R1 40/40 + governance 29/29 (prod-standalone) · full-suite = **0 RV2 regression** (33 reds all flaky-baseline: server-collapse ×24 + GoTrue login ×7 + RV2-unrelated patient-index ×1 + AC-7 dispose **confirmed-flake** via 32/32 isolation) | tester/lead | ✅ **PASSED** |
| QA review | r1 → **CHANGES REQUESTED** (1 MAJOR note-read audit gap + 1 MINOR a11y; 0 P0) → both FIXED (`1885159` PHI-free `referral.note_viewed` audit; `1893cb6` checkbox `aria-describedby`) + lead-verified (catalog+live+pgTAP 217/217+**E2E gov 29/29**) → **r2 re-review** | qa | 🏗️ r2 |

**Progress:** ALL 4 backend increments accepted (git+catalog+live): **R2** `8d2125b` · **R3** `dd5d090` · **R4** `b9cad33` · **R5** `c301a14` (source≠target≠QPS notes keystone live-proven). Backend contract COMPLETE + frozen. **FE VERIFIED** (`027db02`; tsc 0 · lint 0/0 · `next build` green — the FE process exited before reporting but the commit is complete + clean-scoped). **E2E GATE PASSED** (referrals R1 40 + gov 29 green; full-suite 0 RV2 regression — 33 reds all flaky-baseline + AC-7 dispose confirmed-flake via isolation). **▶ Next: QA** (`docs/reviews/rv2-r2-r5-review.md`) → PO approval → ff-merge. Local only, not pushed.

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

| # | Task | Owner | Plan review | Status |
|---|------|-------|-------------|--------|
| BE-1 | Post §2 typed contract (queries + `ethics/actions.ts` + types) as stubs; commit early | backend | one-line ack | ✅ `ada4c97` (5 gaps surfaced → [lead rulings](docs/phases/ethics-e2-procedure.md); tsc/lint clean) |
| BE-2 | Mig: `ethics` flag OFF; `ethics_case_details`/`ethics_allegations`(+cat)/`ethics_findings` + RLS/grants | backend | **full** ✅ approved | ✅ `d4f47ba` (mig `20260817000000`; pgTAP `253` 23/23 fresh reset; catalog RLS ⟵ `case_participant_roles`) |
| BE-3 | Mig: `case_decisions`/`ethics_decision_details`(+`ethics_sanction_types` catalog)/`case_votes`; `cast_case_vote` recusal+respondent gate `HC0J4/5` + `eligible_voters` | backend | **full** ✅ approved (E1-consumption keystone; non-vacuity-critical) | ✅ `d40672e` (mig `20260817000100`; pgTAP `254` 25/25; **mutation RED-PROVEN** — exclusion red, authority green, separable) |
| BE-3b | **NEW (D13):** `can_access_targeted_response` + `responses`/`answers`(+form-version) OR-arms + `target_case_response`/`submit_targeted_case_response` `HC0J9` | backend | **full** ✅ approved | ✅ `5ff03e1` (mig `20260817000200`; pgTAP `255` 26/26; **mutation RED-PROVEN**; 2 findings blessed — vacuous link conjunct dropped, phase-sync guarded) |
| BE-4 | Mig: `ethics_notifications`/`ethics_hearings`/`ethics_appeals`; **`schedule_ethics_hearing` = `participants_only` meeting door** (D14→Stage C; roster-then-flip per `trg_meetings_roster`); "Audiência" seed | backend | **full** ✅ approved | ✅ `54ce537` (mig `20260817000300`; pgTAP `256` 21/21; hearing-roster mutation RED-PROVEN; O-7a seeded, no meetings DDL) |
| BE-5 | M2 retention-pin trigger + `redact_professional_profile` (`link_state`-aware, B7) `HC0J7` | backend | **full** (novel trigger) ✅ approved | ✅ `04d9f62` (mig `20260817000400`; pgTAP `257` 18/18; mutation RED-PROVEN; `guard_professional_linkage` verified — pin untouched, redaction via `app.in_redaction_rpc` GUC, freeze intact) |
| BE-6 | RPCs: admissibility/allegations/findings/decision/issue/notifications/hearings/appeals/assignment-role; t19 | backend | **full** | ✅ `8b8e68d` (mig `20260817000500`; pgTAP `258` 28/28; **authority-first HC0J1**, quorum HC0J8 fires the M2 pin; lead-spot-checked catalog: all DEFINER/owner postgres/anon-revoked; mutation RED-PROVEN) |
| BE-7 | N scan arm (`ethics_notice_due`) — additive, idempotent, PHI-free | backend | one-line ack | ✅ `2c9314e` (mig `20260817000600`; pgTAP `259` 9/9; `app.compute_due_ethics_notifications`, flag-gated, PHI-free — title/body = notice TYPE only) |
| BE-8 | Modified read `get_case_detail` (or `get_ethics_case_procedure`); hub (X-ε) + referral (§D7) consumption | backend | one-line ack | ✅ `2c9314e` (`get_ethics_case_procedure` can_read_case-gated, null when unreadable/off; `assign_ethics_remediation`+`open_ethics_external_referral` consumption) |
| BE-10 | **NEW:** wire the 5 ethics coordinator app-actions to the live DEFINER doors (pt-BR `HC0*` mapping; no new SQL) | backend | one-line ack | ✅ `2c9314e` (5 actions in `case-recusals/actions.ts` + `mapCoordinatorError`; **`setCaseVisibility` created** → live `set_case_visibility` door, verified L178/L183) |
| BE-9 | Flag flip `ethics`→ON + `FeatureFlags` + regen types + pgTAP fresh reset + seed | backend | one-line ack | ✅ **ACCEPTED** `22e7d34` — flip **seed-only** (`seed.sql:1989`; lead-verified no migration enables it → remote/prod OFF till pilot); PHI-free fixtures on case `…-e1`; full suite **3438t / 8f** (all 8 lead-proven pre-existing, see note); ethics 253–259 RAN flag-ON (254's 25 keystones incl. HC0J5 exclusion) |
| BE-11 | **NEW (contract gap I missed):** wire the 27 procedure actions in `ethics/actions.ts` → RPCs + `mapEthicsError`; add `listEthicsSanctionTypes` + `listCaseRecusals` | backend | one-line ack | ✅ `0972ed0` (lead-verified: 25 RPC-backed actions, 0 stubs; scope src/lib only; mig `20260817000700` nullable phase-role arg; `decisionLetterDocumentId`→Stage-E no-op) |
| FE | Coordinator controls (recusal/COI/visibility/confidentiality) + minimal procedure UI (off §2 contract; `frontend-design`) | frontend | — | ✅ `c1f2e33`+`3d1315a` — "Processo ético" tab (ethics-typed only) + 8 panels; Part-1 write verified live (declareConflict→DB→cleanup); Part-2 render-verified (pt-BR, seeded data); **2 env caveats → tester** (screenshot svc down; mcp-preview React-19 Suspense stuck → Part-2 live writes deferred to Playwright) |
| E2E | Acceptance §4 (minus the Stage-E `legal_privileged` item) + one keyboard flow | tester | — | ✅ **COMPLETE 2026-07-18** — `e2e/ethics-e2-procedure.spec.ts` (new, 20 tests) **20/20 chromium**, prod-standalone, 2× fresh-reset runs both green. **0 product bugs filed** — every failure during authoring was a spec-selector/assumption bug, fixed in the spec (see file header + commit). **CAVEAT A RESOLVED — environmental, not a product bug**: GATE-C/GATE-D open a real dialog (state + handler) after navigating to both `/manage/cases/[id]` (Detalhes) and `.../etica` under real Chromium — the React tree hydrates and is interactive on the exact route frontend's mcp-browser preview reported stuck. **CAVEAT B resolved** — this run is the authoritative interactive+visual pass (frontend's screenshot tool was down). Full §4 lifecycle driven as REAL writes (admissibility → 2 allegations/finding[+HC0J3 dup-negative] → decision → details[sanction/remediation/external-CFM/appeal deadline] → votes[chefe via **keyboard-only**, quorum satisfied via a DYNAMICALLY-COMPUTED live eligible-voter set — not hardcoded — for 100% turnout regardless of the actual HC0J8 threshold; HC0J5×2 + HC0J4 negatives via direct RPC] → issue[Emitida; M2 retention-pin fires on the respondent's `professional_profiles`; `redact_professional_profile` HC0J7-barred while pinned] → hearing[participants_only meeting verified] → notification[+cancel] → appeal[submit + review]). Part 1 coordinator controls (declare conflict, record+lift recusal via the roster incl. the SEEDED entry, set confidentiality, set visibility) all pass; `cases.confidentiality_level`/`visibility_policy` round-tripped back to seed values through the SAME UI door + an `afterAll` service-role safety net — **re-verified `ethics-e1-access-spine.spec.ts` 13/13 (+1 skip) on the SAME post-run DB, no reset between** → zero cross-spec contamination. Stage-E `legal_privileged` decision-letter item correctly NOT exercised (unbuilt). |
| QA | Requirements + RLS conformance (`set local role`, not "revert `can_read_case`") | qa | — | ✅ **APPROVED** (2026-07-18, r1) — 0 P0/0 MAJOR/1 min(doc)/3 info; crux verified live ([review](docs/reviews/eth-e2-review.md)) |

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

· **S4** — **ETH·E2** procedure (ADR [0073](docs/decisions/0073-ethics-procedure-model.md); ⚠ has uncommitted out-of-session edits — reconcile first) · **Referrals v2 R2–R5** governance ([plan](docs/plans/referrals-v2-dialogue-governance.md)) · **CH** Charters (Phase 21)
· **S5** — **ETH·E3a** terminology/UX (E3b needs Phase 16)
· Phase 16 — Standards Crosswalk (🔜 **deferred** 2026-07-11, needs replanning; blocks E3b)
· **BUG-AIF-001 / FUP-AI-1** (PO-directed pre-pilot; own workstream, not yet started)
· ✅ **BUG-PROD-ACTIONS — RESOLVED (environment drift, not a code defect).** `node_modules/next` had silently drifted to **16.2.9** (the pre-BUG-AIF-001 version) while `package.json`/lockfile pinned **16.3.0-preview.5**; `npm ci` → 16.3 + a `REBUILD=1` full run collapsed the 21–31s action-hang **and** the "~18–27 prod flaky baseline" to ~1. Confirmed in the Gate-2 version-drift audit (`2698696`); PO-approved at the Gate-2 close. Full investigation detail → [bug-log-archive.md](docs/progress/bug-log-archive.md).
· 🔴 **P0 · AUDIT-DOOR-BLINDNESS — keystones test a surface the product doesn't call.** PO-directed 2026-07-17, own pre-pilot unit. Three confirmed instances (two inside gates recorded PASSED): a `prosecdef=t` DEFINER door bypasses the base-table/policy the keystone checks (C7 K17/`245`, `241` K10, `235` K1). Root cause is methodological — a policy/base-table audit is structurally blind to a DEFINER door and vice-versa. **Scope:** door-level re-audit of Gate 1 + every amendment; re-assert each keystone through the door the product calls (base-table twin kept); consider a standing pgTAP invariant (every `authenticated`-reachable `prosecdef=t` fn needs ≥1 keystone that CALLS it). Full detail → [handoff §7](docs/progress/authz-handoff.md).
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
| RV2 · **R2–R5** referral governance (triage/SLA · resolution lifecycle · assignments/links · notes/receipts/redaction) | ⛔ **CHANGES REQUESTED** (2026-07-19, r1) — 0 P0 / **1 MAJOR** / 1 min / 1 info. Security core proven live: R4 residue-free (assignment≠access, link≠access), R5 source≠target≠QPS keystone (QPS=0), PHI REVOKEs, R3 authority-first non-vacuous (target 42501 / source HC0A5), t19 grants clean. MAJOR = `list_referral_internal_notes` serves PHI note bodies with **no read audit** (`referral.note_viewed` wired nowhere) → Rule 11 + plan §2.1 audited-door invariant. | [review](docs/reviews/rv2-r2-r5-review.md) | |
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
- [ ] **AUDIT-DOOR-BLINDNESS (pre-pilot P0) — program-wide `prosecdef` door audit.** Gate 2 verified the
  *meeting-surface* DEFINER doors specifically; the whole-platform sweep of every `security definer` function
  reachable by `authenticated` (a DEFINER gate *replaces* RLS, so a policy-shaped audit is structurally blind to
  it) is tracked in [authz-handoff.md](docs/progress/authz-handoff.md) §7 (~line 632). **Must clear before pilot.**
  Owned by `backend` / `qa`.

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
