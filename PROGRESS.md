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
| 16 | Standards Crosswalk & Readiness | 🔜 not started | – | – | – | – | – | – |
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
| ff-program | **Flexible-Forms Program (FF-1…FF-5)** — umbrella; [0086](docs/decisions/0086-flexible-forms-pre-pilot.md) | ▶ **3 of 5 complete; FF-5 in gate** — FF-1 ✅ · FF-2 ✅ · **FF-3 ✅ 2026-07-28**. **FF-5 🏗️ build complete** (ADR [0091](docs/decisions/0091-ff5-entity-reference.md); migrations `20260902000000`–`…000600`; flag `entity_refs` flipped ON by `…000600`) — gate step 1 in progress, then tester → qa. Then FF-4. | ✅ FF-3 · ✅ FF-5 build (lint 0/0 · tsc · Vitest 817 · `next build`) | ✅ FF-3 — spec 25/25 · neighbours 62/62 · pgTAP 4167 · Vitest 814 · ⏳ FF-5 pgTAP + E2E pending | ✅ FF-3 **APPROVED** r2 [review](docs/reviews/ff-3-review.md) · ⏳ FF-5 pending | ✅ 2026-07-28 | 2026-07-28 | FF-3 `20260901000000`–`…000800` · FF-5 `f0cc3ac`+`4e584f3`+`f124749` |
| **ETH·E1** | **Ethics Access Spine [0072](docs/decisions/0072-ethics-access-spine.md) | ✅ complete | ✅ Vitest 369/369 | ✅ pgTAP 91f/2537 · E2E 13/13+1 skip · e2e:prod triaged | ✅ APPROVED (R3) [review](docs/reviews/phase-ETH-E1-review.md) | ✅ 2026-07-14 | 2026-07-14 | 14 commits `167b269`…`02bd2db` (remote deferred) |
| **ETH·E2** | **Ethics disciplinary procedure** [0073](docs/decisions/0073-ethics-procedure-model.md) | ✅ complete | ✅ | ✅ E2E 20/20 · pgTAP `253`–`259` | ✅ APPROVED [review](docs/reviews/eth-e2-review.md) | ✅ 2026-07-18 | 2026-07-18 | `ada4c97`…`2adb169` |
| **ETH·E3a** | **Ethics terminology/UX surfacing** [0072](docs/decisions/0072-ethics-access-spine.md) | ✅ complete | ✅ | ✅ E2E 21/21 · pgTAP `266`–`269`/3852 | ✅ APPROVED r2 [review](docs/reviews/phase-E3a-review.md) | ✅ 2026-07-27 | 2026-07-27 | `e61fa3c`…`38db4c9` |
| **AUTHZ** | ADR 0078 Gate 1 | ✅ complete | ✅ | ✅ pgTAP 2981 · e2e 0-regress | ✅ APPROVED [review](docs/reviews/authz-b-series-review.md) | ✅ 2026-07-16 | 2026-07-16 | `87858f7` (local) |
| **AUTHZ · Gate 2** | ADR 0078 Gate 2 | ✅ complete | ✅ | ✅ pgTAP 772/772 authz · e2e green | ✅ APPROVED (re-review) | ✅ 2026-07-17 | 2026-07-17 | `f07341f` |
| **case-corrections** | **Case Correction Lifecycle** [0085](docs/decisions/0085-case-correction-lifecycle.md) | ✅ complete | ✅ | ✅ tester 24/24 + full prod E2E feat 7/7 (reds triaged infra/baseline; T-2 clean-stack 76/76) | ✅ APPROVED (0P0/0MAJ/2min) [review](docs/reviews/case-corrections-review.md) | ✅ 2026-07-24 | 2026-07-24 | `6b50abc` → main+origin; **remote `db push` ✅ (flag ON, backfill verified live)** |
| **case-custom-fields** | **Case Custom Fields** [0083](docs/decisions/0083-case-custom-fields.md) | ✅ complete | ✅ lint/tsc/vitest 369 | ✅ E2E 8/8 (3× clean) · pgTAP `188` 28/28 · full `e2e:prod` 735p (feat 8/8 on prod build) | ✅ APPROVED (0 P0 · 0 MAJOR · 1 MINOR cleared · 2 INFO) [review](docs/reviews/adr-0083-case-custom-fields-review.md) | ⚠ **unrecorded** — see detail | 2026-07-23 | merge `c857193` · flag ON `fde76d3` |
| **bulk-case-create** | **Bulk Case Creation ("Múltiplos casos")** [0084](docs/decisions/0084-bulk-case-creation.md) | ✅ complete | ✅ build/tsc/lint/vitest 390 | ✅ E2E 8/8 prod-standalone · pgTAP 29/29 | ✅ APPROVED (4 MINOR/OBSERVATION, none blocking; fixed `b948c9f`) [review](docs/reviews/bulk-case-creation-review.md) | ⚠ **unrecorded** — see detail | 2026-07-23 | flag ON `255a8e9` |
| **AUDIT-DOOR-BLINDNESS · P0** | ADR 0078 §7.14 | ✅ complete | ✅ | ✅ 50 KS mut-proven · pgTAP 3288 · invariant HOLDS | ✅ APPROVED [review](docs/reviews/authz-door-audit-p0-review.md) | ✅ 2026-07-18 | 2026-07-18 | ff→main |
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

**FF-3 (Validation Engine) ✅ COMPLETE 2026-07-28** — ADR
[0090](docs/decisions/0090-ff3-validation-engine.md) (+ Amendments 1–4), QA **APPROVED** r2,
human-approved, flag `item_validations` **ON** (gate flip `20260901000800`); record →
[ff-3-validation-engine.md](docs/progress/ff-3-validation-engine.md).

**FF-5 (Entity Reference, `entity_refs`) is the next build phase — NOT started.** Its ADR is
**0091+**; scope, dependencies and gate keystones →
[flexible-forms-program.md](docs/plans/flexible-forms-program.md) §3 FF-5.

> 🔴 **FF-5 inherits four obligations. The first three are the standing ones; the fourth is new
> and was found by writing FF-3's documentation, not its code.**
> 1. **`answer_references` is missing the targeted and `can_read_correction_response` policy arms**
>    — deliberately unfixed while write-inert. **FF-5's writer landing is when that stops being true.**
> 2. **Correction-copy with the instance remap** — `answer_references` hangs off `answer_id` and is
>    copied by **neither** correction RPC. Resolve old→new *through* the instance rows.
> 3. **The door-parity rule** — every arm its sibling carries, proven as a **table** against
>    `pg_policies` **and the ACLs**, not asserted. Where siblings disagree, the **tighter** posture wins.
> 4. **`reference` pins BOTH `required = false` AND `required_if IS NULL`** in
>    `form_items_input_vs_display`. **Relax one without the other and the deadlock reopens by the
>    other door.**
>
> Also worth reading before FF-5 designs its picker: FF-3's `app.response_validation_errors` is an
> **INVOKER wrapper whose hand-written probe is its only gate** — the shape the ADR-0079 standing
> sweep is structurally blind to (**AUDIT-INVOKER-WRAPPER**, tracked below). FF-5's participant lane
> is a PHI read surface, so it will want the same scrutiny and cannot rely on that sweep to supply it.

**FF-5 · `frontend` build — ✅ COMPLETE 2026-07-28** (commit `4e584f3`, branch
`ff/flexible-forms-program`). Builder: `reference` type behind `entity_refs`, lane picker +
participant-type narrowing, case-scoped-patient authoring note; `reference` added to the dialog's
`isQuestion` gate (that gate wraps the whole two-column body, so `required` / `required_if` /
`visibleWhen` were otherwise unreachable for the type ADR 0086 ruling 4 had just released them for).
Wizard: ARIA 1.2 combobox typeahead (debounced, single-select, clearable, full keyboard,
`aria-required` = effective required-ness), two distinguished empty states, per-instance arm inside
repeating groups. Sibling arms carried to every `isMatrixItem`/`isInputItem` dispatch site: collect,
validation (flat + per-instance), instance emptiness (ruling 6), orphan detection, visibility, and
the six read-only consumers. Green: lint 0/0 · typecheck · Vitest 817 · a real `next build` · the
running app (builder + wizard + resume-by-label + per-instance picker, driven live).
> ⚠ Two notes for the gate, both found by RUNNING it rather than by review:
> 1. **`main` now 500s on the FF-5 seed form.** `read-only-tree.tsx` does an unguarded
>    `ITEM_TYPE_META[item.itemType]`, and the seed form D lives in the shared local DB. Resolves on
>    merge; until then the main checkout cannot render that form.
> 2. ~~**`reference_candidates` returns the raw `participant_type` identifier as `sublabel`**~~
>    — **RESOLVED at source, backend `3c997eb`.** Live now: `Centro Cirúrgico :: Setor`. My
>    render-layer guard was **removed**, not kept: it covered the picker's tree only, so it could
>    never have caught the site that mattered, and on a future regression it would have made the
>    picker look correct while the sign-off view showed raw identifiers — masking a shared defect
>    asymmetrically. The sublabel is now rendered raw and the source is the single authority
>    (rationale recorded in `reference-vocabulary.ts`). Verified end-to-end with no client-side map.
>    **Worth carrying into the review:** it was **three** sites, not the one I reported — the
>    typeahead, `app.references_by_item` (the **sign-off projection**), and `buildReferenceAnswers`.
>    The sign-off one is the site that mattered and renders through a **different component tree**,
>    so my render-layer map never covered it. Found by sweeping `pg_proc` for `participant_type`,
>    not by reviewing the reported site. SQL↔TS label parity is now pinned both ways (pgTAP 276 §L +
>    `participant-type-labels.test.ts`), so changing one alone reds a suite.
> 3. 🟠 **KNOWN LIMITATION — the patient lane's sublabel degenerates on the READ path.** Surfaced by
>    `backend` re-sweeping the `sublabel` producers after (2) removed the client-side net; verified
>    independently here against the code and the live DB. **Not a regression and not blocking — but
>    it should be a PO/lead decision, not a code comment, and I do not think "cosmetic" is right.**
>    - The three producers all normalize, but they resolve the participant sublabel DIFFERENTLY:
>      `reference_candidates` (picker) and `app.references_by_item` (sign-off) emit the
>      **case-participant role**; `buildReferenceAnswers` emits the **type label only** — provably,
>      since `ScopedReferenceRow.participants` carries `{display_name, participant_type}` and no case
>      data at all, so it *cannot* resolve a role.
>    - `buildReferenceAnswers` feeds **`getResponseForFill`** (wizard resume + the review screen after
>      a reload) and **`getSubmissionDetail`** (the durable submitted record). The sign-off surface is
>      unaffected.
>    - A patient's `display_name` can only ever be one of **two constants** — established from the
>      live catalog, so it is structural rather than a property of today's rows: `authenticated`
>      holds **no INSERT/UPDATE/DELETE grant** on `participants` (only `postgres` / `service_role`),
>      and exactly two SECURITY DEFINER functions write the column, each writing a **literal**:
>      `set_participant_patient` inserts `'Paciente'`, and `dispose_case_phi` updates disposed
>      patients to `'[PHI removido]'`. There is no path by which a patient's `display_name` becomes a
>      distinguishing value.
>      **State it that way, not as "the door accepts no name" — that form is refutable at a glance
>      and would discredit the whole claim.** `set_participant_patient` DOES take a `p_name text`
>      (verified via `pg_get_function_identity_arguments`): a real patient name crosses that door and
>      is routed to `patient_identifiers`, while the `participants` INSERT writes the literal
>      `'Paciente'` and never `p_name`. The surrogate holds *despite* a name being supplied, which is
>      the strong version and the one ADR 0091 ruling 1 actually needs.
>      ⚠ Correction to a figure quoted mid-thread: "other writers of `display_name`: 0" is **wrong** —
>      `dispose_case_phi` assigns it (`prosrc` line ~48, comments stripped). It does not weaken the
>      finding, it widens it: the post-disposal label is *also* a shared constant, so the degeneracy
>      holds in both states. Recorded because the claim was nearly copied into this file unverified,
>      and a `prosrc` match for `display_name =` cannot by itself tell an assignment from a WHERE
>      comparison — it had to be read.
>    - So on those paths a patient reference renders **`Paciente / Paciente`** — zero information, in
>      the one field whose entire purpose is to disambiguate identical labels. Two patient references
>      in one form become indistinguishable at the confirm-before-submit moment and in the permanent
>      record.
>    - **Why "latent" understates it:** it needs a case-bound response carrying a patient reference,
>      which no fixture has — but that is precisely the patient lane's *primary intended use* (ADR 0091
>      ruling 2 exists to make patient references work on case-linked forms). The first real case-phase
>      form with one hits it. It is unexercised, not unlikely.
>    - Closing it means giving `buildReferenceAnswers` case scope — a new query and new risk. **I agree
>      with `backend` that that is not a gate-time change**; recording it so the call is made
>      deliberately rather than by default.
>    - Frontend deliberately does **nothing** here: suppressing the duplicate when `label === sublabel`
>      would make the degenerate case *look* intentional, which is the same asymmetric-masking mistake
>      that got the render-layer guard deleted in (2). The ugly duplicate is the honest signal.
>    - 🔴 **Gap identified, no keystone asserts it** (`backend` is proposing one to the lead; noted here
>      so it survives if that thread is missed). **ADR 0091 ruling 1 — "the participant lane reads no
>      PHI, so FF-5 adds no PHI read surface and Rule 12 stays at three modules" — rests ENTIRELY on
>      the surrogate invariant above, and nothing currently tests it.** A third writer, or a change
>      letting `set_participant_patient` pass `p_name` through to `display_name`, would silently turn
>      the picker and every reference label into a PHI surface with no suite going red — the frontend
>      cannot detect it, because from here a name and a surrogate are both just a string. The
>      assertion is ~2 lines over `pg_proc` + `role_table_grants`. Cheap, and it is the only thing
>      standing between ruling 1 and a silent falsification.


**Case-type assignment (ADR 0088) ✅** — template declares → case inherits; record → [case-type-assignment.md](docs/progress/case-type-assignment.md). **FF-2 ✅** — record → [ff-2-matrix-risk-matrix.md](docs/progress/ff-2-matrix-risk-matrix.md); its two binding rules (door parity as a **table**; the targeted/correction arms owed by `answer_references`) are restated in the FF-5 handoff above.

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
· 🔴 **AUDIT-INVOKER-WRAPPER — a structural blind spot in the ADR [0079](docs/decisions/0079-authz-door-blindness-standing-invariant.md) standing sweep. Found in FF-3 (QA M-2), NOT an FF-3 defect, NOT a known leak; PO decision on scheduling.** The sweep floors `prosecdef = t` **public** doors. The shape it cannot see is an **INVOKER wrapper whose own hand-written RLS probe is the only gate in front of a DEFINER body** — a `prosecdef = f` function whose security rests entirely on an `if not exists (…)`. FF-3's `get_response_validation_errors` is one instance: deleting its existence probe reds **0 assertions across six files**, while a commission-Y staff then reads commission-X rule messages **and item labels** (proven live, `have: 3 want: 0`; keystone `§O` added, mutation-proven). **This is a pattern, not an accident** — it is the natural way to front an `app.` DEFINER helper, and **130 of 281 `app` DEFINER functions carry `EXECUTE` to `PUBLIC`**, so the wrapper is the whole boundary each time. Proposed scope: enumerate `public` `prosecdef = f` functions calling an `app` `prosecdef = t` function, and require a keystone per wrapper that reds when its guard is removed. Not started. Relates to ARCHITECTURE.md Rule 1.
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

**FF-3-era bugs — all closed and rotated** → [bug-log-archive.md](docs/progress/bug-log-archive.md): BUG-E2E-001 (the seed-eating cleanup behind the gate's b7 cascade), BUG-FF3-002 (unary operators offered but unsavable — `CONDITION_OPS` still the pre-F3 seven), BUG-FF3-001 (stale peer `aria-invalid` on the symmetric rule), and **BUG-FF1-008, closed by FF-3's Amendment 3**.

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
     §6 Record (full historical log, Phases 0 → FF-3, already there). -->

**FF-3 · final bar at `9557d1f` (2026-07-28)** — full detail, every triage and every mutation
proof → [ff-3-validation-engine.md](docs/progress/ff-3-validation-engine.md); the FF-2 and FF-3
run-by-run rows → [test-run-archive.md](docs/progress/test-run-archive.md).

| Surface | Result |
| --- | --- |
| pgTAP (fresh reset) | **141 files / 4167 / PASS** |
| Vitest | **814 / 814** |
| lint · typecheck · `next build` | **0/0** · clean · **EXIT=0** |
| migrations | **225 == 225** |
| `tester` — FF-3 spec | **25 / 25** (two halves, separate servers, `expected == reported`) |
| `tester` — neighbours | **62 / 62** (builder 8 · builder-enh 15 · ff1 9 · wizard 12 · others-ux 7 · matrix 11) |
| full `e2e:prod` (`BATCH_SIZE=4`) | **794 passed · 16 of 19 batches clean · every batch `accounted N/N`** |

**Gate triage (the standing method).** Failures track connection-error density, so count that
first: the three failing batches were b7 = **90**, b14 = **84**, b2 = 4 conn errors, and b2's two
failures were `ERR_CONNECTION_REFUSED` on `page.goto` — **zero real failures**. Two tells worth
keeping: a **0 ms** duration is not an assertion failure (libuv crash), and one collapse run
**failed test 1, recovered for 14, then died at 16** — so the first failure is *not* the collapse
point. Known ceiling: the suite has outgrown one gate process, and `ff3-validations.spec.ts` has
outgrown one standalone server (see the two 🔴 PO findings above).

## QA Verdicts

<!-- ONE LINE per phase/feature: verdict + date + link. The full analysis lives in
     docs/reviews/*.md — never restate rationale here, and don't copy it to
     docs/progress/qa-verdicts-archive.md either (redundant with the review file).
     Struck-through rows are superseded rounds, kept only to show a phase looped. -->

| Phase / Feature | Verdict | Date | Report |
| --- | --- | --- | --- |
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
| 2026-06-25 | **NSP-per-org** — bind the PQS roster + every PHI door to an organization (per-org `pqs_members`/`pqs_department`, `nsp_coordinator` grant via the … | [0042](docs/decisions/0042-nsp-per-org.md) |
| 2026-06-25 | **Multi-Tenancy** — pooled single-DB (organizations → hospitals → commissions); vendor `platform_admin` vs customer `org_admin`; RLS rewrite + … | [0041](docs/decisions/0041-multi-tenancy-organizations-hospitals.md) |
| 2026-06-20 | **PHI-remediation Round 3** — RCA-write severance (drop `is_admin` from 7 `rca_*_write`) + WS B audited free-text reads/PHI classification + WS E … | plan §A4/B/E; ADR 0030/0031 |
| 2026-06-20 | **PHI-remediation WS C** — PHI retention & disposal (`dispose_event_phi`, one-shot HC056, constrained reason enum) | plan §C; ADR 0030/0031 |
| 2026-06-20 | **PHI-remediation WS A** — structured-identifier lockdown: real `pqs_members` roster, tight `can_read_event_patient`, single audited door, sever … | plan §A; ADR 0030/0031 |
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
