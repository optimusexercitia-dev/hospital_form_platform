# PROGRESS.md — Project Status Tracker

> Single source of truth for project status. Update IMMEDIATELY when state
> changes. The lead owns the Phase Status table; each teammate owns their own
> rows in the other sections. Never report status that isn't written here.

> ### ⚠ ROTATED 2026-08-14 — 154.4 KB → 83.5 KB (**85.4 KB now**). §7's <60 KB target is **NOT met**
>
> ⛔ **This banner previously claimed "→ ~55 KB", which was FALSE and read as *target met*.** Measured
> with `git show <rev>:PROGRESS.md | wc -c`: pre-rotation **154,418** B · post-rotation **83,509** B ·
> at HEAD **85,408** B. The ~55 KB was the *sum of the cuts as projected*, never measured against the
> resulting file — the rotation commit's own message said 82 KB, so the two disagreed from the start.
> ⭐ **A size claim is a measurement, not an arithmetic result**; the projection ignored everything the
> cuts did not touch. Corrected 2026-08-15 when the PO asked whether this file was actually correct.
>
> **Residual, and owned:** ~25 KB over target. The remaining bulk is `## Phase Status` (~24 KB of rows
> that per §5 **never leave**) and `## Remaining pre-pilot work`. Getting under 60 KB means a
> different decision than rotation — a schema for the Phase Status table, or moving it out entirely —
> and that is a PO call, not a cleanup. **Do not "fix" it by trimming rows.**
>
> Every teammate spawn reads this file, so §7 targets "well under 60 KB". The three cuts the earlier
> banner named were taken, plus five more — **each preserved verbatim in its archive first**, so this is
> rotation, not loss: `## QA Verdicts` (24 KB → one line per verdict, the §5 rule it had stopped
> following) · `## Phase Status` verbose cell prose (⚠ **rows never leave**) · DM5·S3 detail ·
> Follow-ups → one-line index · Decisions → one line + ADR · Test Run → most-recent gate only ·
> the closed Bug Log rows · the two completed-work tables.
> Archives: [phase-status](docs/progress/phase-status-archive.md) ·
> [qa-verdicts](docs/progress/qa-verdicts-archive.md) · [test-run](docs/progress/test-run-archive.md) ·
> [decisions-log](docs/progress/decisions-log.md) · [bug-log](docs/progress/bug-log-archive.md) ·
> [follow-ups](docs/progress/follow-ups.md) · [DM5 record](docs/progress/dm5-wave-d-retirement.md).
>
> ⚠ **Two things the banner's own instructions would have gotten wrong** — both caught by asserting in
> BOTH directions before writing, which is exactly why that rule was in the banner:
> 1. The banner said DM5·S3's detail was "now fully carried by" the record + handoff. **It was not.**
>    The *"three catalog facts the lead pinned were WRONG"* table and the S2 close-then-reopen history
>    existed **only here**. Copied to the record before the cut, not summarized. *A claim that content
>    is duplicated is itself a claim to verify.*
> 2. **Seven OPEN follow-ups had no body in `follow-ups.md` at all** — `FUP-ACT-DISPOSE-UI`, the 🔴
>    pilot-gate check, even pointed *there* for its "full mechanism". Compressing those lines to the
>    prescribed one-liner would have **destroyed** the items. Their bodies were written first
>    ([§ Bodies moved here](docs/progress/follow-ups.md)). **A pointer is not evidence its target exists.**

## Phase Status

<!-- THE INDEX: every phase keeps a row here, forever. What rotates out is verbose cell text, not
     rows — a missing row would break the many places that point here. -->

> Gate **headlines** (pgTAP counts, e2e:prod result, ARM verdicts, QA verdict + review link) stay in
> this table; the **verbose** Build/Tests/QA/Commit prose rotates. Rotated **2026-08-10** (11 rows:
> Phase 16 · ff-program · PCI · AFF · MIN · TV · QO·A · QO·B · PDF·P1 · PDF·P2 · ACT) and again
> **2026-08-14** (15 rows: 14e · 22-v2 · 22-v3 · DM · DLB · ETH·E4 · case-custom-fields ·
> bulk-case-create, plus the nine re-trimmed) — all verbatim →
> [phase-status-archive.md](docs/progress/phase-status-archive.md). Each phase's `docs/progress/`
> record remains the authority for how the work was done.

> ↩ **18 rows with verbose Build/Tests/QA cells trimmed 2026-08-18** (the size rotation) — full cell text verbatim → **[phase-status-archive.md](docs/progress/phase-status-archive.md)** § "Verbose rows trimmed 2026-08-18". ⛔ *Rows are never removed — a missing row breaks the many places that point here.*

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
| 14e | **Centralized Attachment Substrate** [program](docs/plans/pre-pilot-foundations-program.md) | ✅ complete | ✅ | ✅ pgTAP **1957** · F2 E2E **24/24** (audited PHI door proven) · full 590p/24f (0 F2 reg) | ✅ **APPROVED** (0B/0M/3m/4i, all closed) [review](docs/reviews/phase-F2-review.md) | ✅ 2026-07-11 | 2026-07-11 | `37057c0` · **remote ✓ 2026-07-12 (pilot reset)** |
| 15 | Quality Indicators [0057](docs/decisions/0057-indicators-doc-control-replan.md) | ✅ complete | ✅ | ✅ 12/12 (prod-standalone) | ✅ APPROVED (3 MINOR fixed) [review](docs/reviews/phase-15-review.md) | ✅ 2026-07-06 | 2026-07-06 | merge `26187dc` (pushed; **remote deployed via pilot reset ✓ 2026-07-12**) |
| 16 | Standards Crosswalk & Readiness v2 [0093](docs/decisions/0093-phase-16-standards-crosswalk-replan.md) · [record](docs/progress/phase-16-standards-crosswalk.md) | ✅ complete | ✅ | 151f/4623 | ✅ [APPROVED](docs/reviews/phase-16-review.md) | ✅ 2026-08-04 | 2026-08-04 | `484a254` → `main`, pushed |
| 17 | Controlled-Document Lifecycle | ✅ complete | ✅ (tsc/lint 0 · Vitest 206) | ✅ pgTAP 47/47 (full 1717) · phase E2E 14/14 · full regr 588p/10 env-only (0 Phase-17 reg) | ✅ APPROVED (3 MINOR cleared) [review](docs/reviews/phase-17-review.md) | ✅ 2026-07-06 | 2026-07-06 | merge `1152d75` (ff-only from `feat/phase-17-controlled-documents`; pushed) |
| 17-v2 | Controlled-Document Redesign | ✅ complete | ✅ (tsc/lint 0 · Vitest 369) | ✅ tester 25/25 · pgTAP `201` 29/29 · e2e:prod triaged-green (0 redesign reg) | ✅ APPROVED (0/0/0/4 INFO) [review](docs/reviews/document-control-redesign-review.md) | ✅ 2026-07-21 | 2026-07-21 | ff→`main` (branch `feat/document-control-redesign`) |
| 18 | Self-Assessment & Internal Audit | 🔜 not started | – | – | – | – | – | – |
| 19 | Surveyor Access & Evidence Export | 🔜 not started | – | – | – | – | – | – |
| 20 | Notifications & Escalation [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md) | ✅ complete | ✅ | ✅ pgTAP `226` 52/52 (full 2255) + `notifications.spec.ts` 8/8 | ✅ APPROVED (0B/0M/3 MINOR) [review](docs/reviews/s1-n-notifications-review.md) | ✅ 2026-07-13 | 2026-07-13 | `aac7c1c` |
| 21 | Committee Charters & Cadence [0080](docs/decisions/0080-committee-charters-cadence-model.md) | ✅ complete | ✅ | ✅ E2E 10/10 + pgTAP 260/261/262 = 11/29/10 | ✅ APPROVED r1 [review](docs/reviews/phase-CH-review.md) | ✅ 2026-07-20 | 2026-07-20 | BE `458aedb`…`13750b1` · FE `d982401`+`5d366db` · `14c4381`/`cb6a671` |
| 22 | Inter-Committee Case Referrals | ✅ complete | ✅ | ✅ 29/29 + full 276/326 | ✅ APPROVED 2026-06-21 | ✅ 2026-06-21 | 2026-06-21 | `768b9f1` |
| 23 | Patient Identity & Cross-Committee Linkage (MRN/encounter) | ✅ complete | ✅ | ✅ E2E 15/15 + pgTAP 10/10 sweep | ✅ APPROVED 2026-06-22 | ✅ 2026-06-22 | 2026-06-22 | `da4d127` |
| 22-v2 | **Referral Detail Redesign (RDR)** [0109](docs/decisions/0109-referral-registros-and-case-access-summary.md) (⚠ **D2 superseded** by 0110) · [record](docs/progress/referral-detail-redesign.md) | ✅ complete | ✅ Vitest 1254 | ✅ pgTAP **183f/5870** · 3 ARMs HOLD · e2e:prod **1074p/1f** (pre-existing, outside the branch) | ✅ [APPROVED](docs/reviews/referral-detail-redesign-review.md) (0B/2m/3i) | ✅ 2026-08-12 | 2026-08-12 | `81e1dc9` → `main`, ✅ **PUSHED** |
| 22-v3 | **REG·KIND — one Registro vocabulary** [0110](docs/decisions/0110-shared-registro-kind-vocabulary.md) (supersedes [0109](docs/decisions/0109-referral-registros-and-case-access-summary.md) **D2** only) | ⚠ **merged, gates 2–4 UNRUN** | ✅ Vitest 1254 | ⚠ **step 1 only** — pgTAP **183f/5857** · 3 ARMs HOLD · E2E targeted 24/24, **no `e2e:prod`** | ⛔ **not run** (PO direction) | ⛔ not sought | 2026-08-12 | remote catalog |
| DM | **Document Model Redesign** [0114](docs/decisions/0114-document-model-redesign.md) (+Amdt 1/2) · ADRs [0116](docs/decisions/0116-dm1-substrate-cutover-decisions.md)/[0117](docs/decisions/0117-dm2-s1-confidentiality-ceiling-decisions.md)/[0118](docs/decisions/0118-dm2-s2-command-layer-decisions.md)/[0119](docs/decisions/0119-dm4-referral-document-substrate-decisions.md)/**[0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md)**/**[0121](docs/decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md)**/**[0122](docs/decisions/0122-recusal-case-read-arm-at-the-referral-freeze-door.md)** · [plan](docs/plans/document-model-redesign.md) | PROGRAM COMPLETE — DM0–DM5 all closed; DM5 (the FINAL phase) closed 2026-08-18, all five gate steps. | ✅ DM4: 5 migrations `20260926000100`–`000500` · pgTAP `340` | 191f/6231 | APPROVED (r2) | ✅ **2026-08-14** (DM4) · batch **2026-08-17** | 2026-08-14 | Read § "State" (a TOP-LEVEL section since 2026-08-18) for the measured remote/push facts |
| DLB | **Deliberation & Voting Model** [0115](docs/decisions/0115-deliberation-and-voting-model.md) ([plan](docs/plans/deliberations.md)) | ADR PROPOSED — NOT ratified; nothing built and nothing may start | – | – | – | ⛔ **not ratified** | – | taken |
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
| ff-program | **Flexible-Forms Program (FF-1…FF-5)** — umbrella; [0086](docs/decisions/0086-flexible-forms-pre-pilot.md) · [program outcome](docs/plans/flexible-forms-program.md) | ✅ **5 of 5 COMPLETE** — closed, no longer gates the pilot | ✅ | 4301/4301 | ✅ [APPROVED](docs/reviews/phase-FF-4-review.md) | ✅ 2026-08-03 | 2026-08-03 | FF-4 `4df14d7`…`aa77b0d` (13 commits) |
| **ETH·E1** | **Ethics Access Spine [0072](docs/decisions/0072-ethics-access-spine.md) | ✅ complete | ✅ Vitest 369/369 | ✅ pgTAP 91f/2537 · E2E 13/13+1 skip · e2e:prod triaged | ✅ APPROVED (R3) [review](docs/reviews/phase-ETH-E1-review.md) | ✅ 2026-07-14 | 2026-07-14 | 14 commits `167b269`…`02bd2db` (remote deferred) |
| **ETH·E2** | **Ethics disciplinary procedure** [0073](docs/decisions/0073-ethics-procedure-model.md) | ✅ complete | ✅ | ✅ E2E 20/20 · pgTAP `253`–`259` | ✅ APPROVED [review](docs/reviews/eth-e2-review.md) | ✅ 2026-07-18 | 2026-07-18 | `ada4c97`…`2adb169` |
| **ETH·E3a** | **Ethics terminology/UX surfacing** [0072](docs/decisions/0072-ethics-access-spine.md) | ✅ complete | ✅ | ✅ E2E 21/21 · pgTAP `266`–`269`/3852 | ✅ APPROVED r2 [review](docs/reviews/phase-E3a-review.md) | ✅ 2026-07-27 | 2026-07-27 | `e61fa3c`…`38db4c9` |
| **ETH·E4** | **Ethics participant seating & professional identity** [0108](docs/decisions/0108-eth-e4-participant-seating.md) · [record](docs/progress/eth-e4-participant-seating.md) | ✅ **complete** | ✅ vitest 1218 · `next build` 0 | 182f/5794 | ✅ **APPROVED (r3)** [review](docs/reviews/eth-e4-review.md) — r1 ⛔ (1 P0) / r2 ⛔ / r3 ✅ | ✅ 2026-08-11 | 2026-08-11 | → `main`; ✅ remote `db push` DONE. Closes FUP-ETH-1 + FUP-FF5-2 |
| **AUTHZ** | ADR 0078 Gate 1 | ✅ complete | ✅ | ✅ pgTAP 2981 · e2e 0-regress | ✅ APPROVED [review](docs/reviews/authz-b-series-review.md) | ✅ 2026-07-16 | 2026-07-16 | `87858f7` (local) |
| **AUTHZ · Gate 2** | ADR 0078 Gate 2 | ✅ complete | ✅ | ✅ pgTAP 772/772 authz · e2e green | ✅ APPROVED (re-review) | ✅ 2026-07-17 | 2026-07-17 | `f07341f` |
| **case-corrections** | **Case Correction Lifecycle** [0085](docs/decisions/0085-case-correction-lifecycle.md) | ✅ complete | ✅ | ✅ tester 24/24 + full prod E2E feat 7/7 (reds triaged infra/baseline; T-2 clean-stack 76/76) | ✅ APPROVED (0P0/0MAJ/2min) [review](docs/reviews/case-corrections-review.md) | ✅ 2026-07-24 | 2026-07-24 | `6b50abc` → main+origin; **remote `db push` ✅ (flag ON, backfill verified live)** |
| **case-custom-fields** | **Case Custom Fields** [0083](docs/decisions/0083-case-custom-fields.md) | ✅ complete | ✅ lint/tsc/vitest 369 | ✅ E2E 8/8 (3× clean) · pgTAP `188` 28/28 · full `e2e:prod` 735p | ✅ APPROVED (0 P0 · 0 MAJOR · 1 MINOR cleared · 2 INFO) review | ⚠ **unrecorded** | 2026-07-23 | merge `c857193` · flag ON `fde76d3` |
| **bulk-case-create** | **Bulk Case Creation ("Múltiplos casos")** [0084](docs/decisions/0084-bulk-case-creation.md) | ✅ complete | ✅ build/tsc/lint/vitest 390 | ✅ E2E 8/8 prod-standalone · pgTAP 29/29 | ✅ APPROVED (4 MINOR, none blocking; fixed `b948c9f`) [review](docs/reviews/bulk-case-creation-review.md) | ⚠ **unrecorded** | 2026-07-23 | flag ON `255a8e9` |
| **AUDIT-DOOR-BLINDNESS · P0** | ADR 0078 §7.14 | ✅ complete | ✅ | ✅ 50 KS mut-proven · pgTAP 3288 · invariant HOLDS | ✅ APPROVED [review](docs/reviews/authz-door-audit-p0-review.md) | ✅ 2026-07-18 | 2026-07-18 | ff→main |
| **PCI** | **Process/Case integrity audit remediation** [0095](docs/decisions/0095-process-case-integrity-audit-remediation.md) · [detail](docs/progress/process-case-integrity-and-template-versioning.md) | ✅ complete | ✅ | ✅ all gates green → [detail](docs/progress/process-case-integrity-and-template-versioning.md) | ✅ APPROVED r2 [review](docs/reviews/process-integrity-and-template-versioning-review.md) | ✅ 2026-08-05 | 2026-08-05 | `44cd9bb`…`f6c847d` |
| **AFF** | **Hospital affiliation, person identity & the org people directory** [0097](docs/decisions/0097-hospital-affiliation-person-identity.md) · [record](docs/progress/hospital-affiliation-person-identity.md) | ✅ complete | ✅ | ✅ all gates green. ⛔ **never cite `ARM=census` for AFF's write-path doors** (FUP-AFF-1) | ✅ APPROVED [review](docs/reviews/aff-review.md) | ✅ 2026-08-06 | 2026-08-06 | `main` ff + `origin` `cc66483` |
| **MIN** | **Meeting audio → generated ata** [0099](docs/decisions/0099-meeting-audio-minutes.md) · [record](docs/progress/min-audio-minutes.md) — flag `audio_minutes` **OFF** at ship | ✅ **complete** | ✅ | ✅ pgTAP **166f/5181** · MIN 10/10 ×4 · e2e:prod ×2 GREEN | ✅ **APPROVED (r2)** [review](docs/reviews/min-audio-minutes-review.md) — 3 MINOR open | ✅ 2026-08-06 | 2026-08-06 | `feat/meeting-minutes` |
| **TV** | **Process-Template Versioning** [0096](docs/decisions/0096-process-template-versioning.md) (+Amdts 1.1–1.7) · [detail](docs/progress/process-case-integrity-and-template-versioning.md) | ✅ complete | ✅ | ✅ all gates green → [detail](docs/progress/process-case-integrity-and-template-versioning.md) | ✅ APPROVED r2 [review](docs/reviews/process-integrity-and-template-versioning-review.md) | ✅ 2026-08-05 | 2026-08-05 | `6b9314c`…`f6c847d` |
| **QO·A** | **Quality-office oversight — Phase A** [0100](docs/decisions/0100-quality-office-oversight.md) · [record](docs/progress/quality-office-oversight.md) | ✅ **complete** | ✅ | ✅ pgTAP **172f/5355** · `q1` 20/20 RED-proven · census+floor HOLD | ✅ **APPROVED (r3)** [review](docs/reviews/quality-office-oversight-review.md) | ✅ 2026-08-07 | 2026-08-07 | `feat/quality-office-oversight` → `main` |
| **QO·B** | **Quality-office oversight — Phase B** (content wall) [0100](docs/decisions/0100-quality-office-oversight.md) D12 · [record](docs/progress/quality-office-oversight-phase-b.md) | ⬛ **complete** | ✅ | ✅ pgTAP **175f/5616** · `b1` 39/39 RED-PROVEN · 0 BLIND · e2e:prod GREEN 1046/0 | ✅ **APPROVED (r2)** [review](docs/reviews/phase-QO-B-review.md) — r1 ⛔ (M4 cut a PROXY) | ✅ 2026-08-09 | 2026-08-09 | BUG-QOB-004 |
| **PDF·P1** | **PDF printing — Forms + full skeleton** [0104](docs/decisions/0104-pdf-document-printing-module.md) (+A1–A6) · [record](docs/progress/pdf-p1-forms-skeleton.md) | ✅ **complete** | ✅ | ✅ pgTAP `312` **73/73** · 7 drills RED-proven · `ARM=policy` 3/3 COVERED · e2e:prod GREEN 1026 | ✅ **APPROVED (r2)** [review](docs/reviews/phase-PDF-P1-review.md) — 3 MINOR deferred | ✅ 2026-08-08 | 2026-08-08 | → `main`; remote `db push` ✅ |
| **PDF·P2** | **PDF printing — Meetings (ata)** [0104](docs/decisions/0104-pdf-document-printing-module.md) **+A7/A8/A9** · [record](docs/progress/pdf-p2-meetings.md) | ✅ **complete** | ✅ | ✅ pgTAP `312`+`313` **128/128** · drills RED-proven · e2e:prod GREEN 1030 | APPROVED (r2) | ✅ 2026-08-08 | 2026-08-08 | pushed + remote `db push` ✅ 2026-08-10 |
| **ACT** | **"Act as" strict role assumption** [0106](docs/decisions/0106-act-as-role-assumption.md)/[0107](docs/decisions/0107-act-s4-hat-blind-sweep-and-allowlist.md) · [record](docs/progress/act-as-role-assumption.md) — **no flag: the migration IS the cutover** | ✅ **complete (S0–S4)** | ✅ Vitest 1218 · 345==345 | ✅ pgTAP **180f/5707** · e2e:prod **GREEN 1057/0** · census+floor+**hat** HOLD | ✅ **APPROVED** — S0–S3 (r2) · S4 (r1) [review](docs/reviews/act-as-stage-4-review.md) | ✅ 2026-08-10 | 2026-08-10 | `ff0e76a`+`ac4a270` → `main`, pushed. ✅ remote `db push` + Cloud auth hook — **the remote is cut over** |

> ⚠ PCI/TV shipped with two gate caveats — the un-runnable `ARM=census` (**DISCHARGED 2026-08-05**: the arm landed with the membership-hardening merge and was run against the merged catalog; residue in FUP-PCITV-1 row 1) and the VOID TV-backfill premise (⚠ its mechanism recurs: a backfill is invisible to `db reset` forever — a green reset is *no* evidence). Full caveat text + verbatim gate rows rotated 2026-08-08 → [process-case-integrity-and-template-versioning.md](docs/progress/process-case-integrity-and-template-versioning.md).

## Current Phase Tasks

<!-- Lead recreates this table at the start of each phase. At the §6 Record step the
     completed phase's task detail is archived to docs/progress/phase-N.md (or a
     feature-named file) and replaced here by a one-line pointer (CLAUDE.md §7). -->

## 🛑 START HERE — **DM5's seven decisions are ANSWERED; a DM FOLLOW-UP TRIAGE then ruled eight more and shipped four. Both blocks below are live.**

> ## ⭐ LATEST — DM follow-up triage, 2026-08-18 (read this before the DM5 block)
>
> The 18 open DM follow-ups were grouped and triaged. **Eleven rulings** — § Decisions, the
> `DM-FUP TRIAGE #N` rows — and **five items built and gate-green**. ⚠ *There were 18, not 17:*
> `FUP-DM5-SETLOCAL-MIGRATION` had a body and five doc mentions but **no index line**, so `grep`
> could not see it and the next rotation would have dropped it. It has one now.
>
> **✅ Shipped** — `BYTE-PROOF-NOT-ATTEMPTED` · `ATTACHMENTS-MODULE` (⚠ `actions.ts` only —
> `constants.ts` is live) · `DVF-FILEOBJ` (`20260928000600`) · `DANGLING-PRINT` **prevention**
> (`20260928000700`) · ⬛ **`SETLOCAL-MIGRATION`** — `lint:set-local`, the **6th** lint gate, validated
> against Postgres's own `25P01` ground truth (4 files / 6 sites, line numbers included).
> Gates: pgTAP **194f/6397** · lint **6/6** · tsc 0 · vitest **1305** · 4 authz ARMs HOLD.
> ⛔ **`e2e:prod` NOT run.** All work is **committed** (8 commits, `main`, **unpushed**).
>
> ## ⛔⛔ THE BIG ONE — THE PRODUCTION DB IS EMPTY, AND IT WAS RESET ON 2026-08-17 11:37:35Z
> Read-only census + logs. Head `20260928000500` / 411 migrations; **every table 0 rows**, `auth.users`
> 0, all **4** buckets (was 12 — S4's retirement IS deployed) hold **0 objects**. Log signature:
> `CREATE TABLE IF NOT EXISTS schema_migrations` → all `CREATE EXTENSION` → migrations from `20260711…`
> **re-applied** (old migrations only re-run on an empty history table; a `db push` skips them).
> ⭐ **It EXONERATES everyone and indicts the RECORD: the reset preceded TRIAGE #6 by ~14 h, so #6 was
> ruled on STALE FACTS** — it sequenced "reset last, it would destroy the surface" against a remote where
> that surface was already gone. 🔴 **`storage.objects` 96 ins / 47 del / 0 live ⇒ ~49 objects vanished
> with no DELETE**, bytes likely orphaned (CLI-version dependent), unenumerable. Census + deriving
> queries: `docs/backend-state.md` § REMOTE CENSUS 2026-08-18.
>
> **⛔ Three things a next session must not trip over:**
> 1. **`20260928000600`/`…000700` are HELD, not blocked** (TRIAGE #11). The census lifted the *safety*
>    bar — 0 rows, 0 duplicate groups, so `UNIQUE` applies cleanly — but `e2e:prod` has not run and the
>    remote is empty, so there is no drift pressure. *A bar lifting is not a reason to act.*
> 2. **`DANGLING-PRINT` stays 🟡 OPEN.** Prevention shipped; **pre-existing orphans are unrepaired and
>    the dangling `securable_resources` row is untouched**. Closing it on the guard alone is the
>    "a partial fix reads as a complete one" class.
> 3. **`C1` is now `C1a` (local) + `C1b` (Cloud)**, and **the pilot bound is C1b** — the runbook says
>    a local rehearsal cannot exercise the Cloud paths.
>
> **▶ Next, in order:** the **Cloud constructed-orphan probe** (needs S3 keys minted in the dashboard;
> it settles FIVE items — and **`PRODROW` now blocks on it** by PO ruling, with ~49 real likely-orphaned
> objects as its subject) → **C1a** →
> **C2 Tier 1 sizing** (which now absorbs `Q1-OPEN-BYTES-CUT` and `SIBLING-GUARD-DIFF`).
>
> ⚠ **Two lessons from this batch that cost real rounds.** A ruling was **withdrawn before
> implementation** because the follow-up's own option list carried a justification ADR 0104 D7 had
> already refuted — *an option list is an assertion, and one authored inside its item is the least
> likely to be re-derived.* And this batch's own migration shipped a **PUBLIC-executable
> `SECURITY DEFINER`** function, caught by pgTAP `320` U1 at **237→238** — invisible in the diff, in
> review, and in a fully green `312`.

## 🛑 DM5 gate step 4 — the seven PO decisions: ✅ **ALL ANSWERED 2026-08-18** (docket discharged)

> Full docket rotated 2026-08-18 → **[dm5-po-decisions.md](docs/progress/dm5-po-decisions.md)**.
> Rulings are one line each in § Decisions (the `2026-08-18` rows); verbose forms in
> [decisions-log.md](docs/progress/decisions-log.md).
>
> ⛔ **DO NOT READ "ANSWERED" AS "DONE".** Two rulings created obligations that outlive the
> phase and stay live in **[§ Critical FUP](#-critical-fup--the-must-not-be-forgotten-list)**:
> **C1** the PHI-disposal runbook must run end-to-end **before any real patient record is loaded**
> (the pilot risk acceptance is *bounded by that rehearsal*), and **C2** Tier 1 of the 407-door
> sweep is **sized but not counted**.

## Bug Log

<!-- OPEN bugs only. Resolved/closed rows rotate to docs/progress/bug-log-archive.md (or the
     owning phase's record) at each §6 Record step. -->

### 🔴 OPEN — the live bugs

⚠ **Heading added 2026-08-14** (and re-titled 2026-08-17 when a fourth bug landed — *the count was in
the heading, which is a figure that goes stale the moment it is right*). These sat between two
"Closed" headings with no heading of their
own, so an open production blocker (BUG-BOOTSTRAP-001) read as filed under *Closed*. Open bugs use bold
markers rather than headings, which is exactly why a rotation bounded by heading syntax would have
archived them — **derive the boundary by the PROPERTY (is this CLOSED?), never by markup.**
⭕ **Rotated out of here on 2026-08-18 — each one closed well before its row said so.** A LIST, not a
count: append to it, and nothing already written goes stale.

- **BUG-DM5-S6-EVID-KBD-1** — fixed 2026-08-17, never marked.
- **BUG-DM5-S3-INACTIVE-PRINT-1** — fixed by DM5·S3, in the slice that filed it, never marked.
- **BUG-DM5-S3-ENV-FIXTURE-POOL-1** — met its own "re-verify on the next fresh-reset run" criterion
  on 2026-08-17, never marked.

⛔ **No live bug count appears in this section, deliberately.** Two attempts already went stale inside
a single day — first the heading, then a note saying "back to three" — in the one paragraph of this
file whose whole subject is that a count is wrong the moment after it is right. Count the rows below.

🔴 **BUG-BOOTSTRAP-001 — there is no in-app path to create the FIRST `platform_admin`; production
onboarding has an undocumented manual SQL step.** Filed 2026-08-06 (lead) when the AFF completion
narrative was rotated — **this was the one open item in it that existed in no other tracked place**,
which is why it is here rather than in Follow-ups. Surfaced during AFF, **not caused by it**.
**Mechanism:** `is_admin` is set only by direct SQL, and the promote guard requires an **existing**
admin to promote another — so the set is closed under the product. On a fresh production database it
starts empty and nothing in the app can open it. **Impact:** the first production `platform_admin` is
a manual `update profiles set is_admin = true …` that **appears in no runbook** — not in
`docs/deployment/`, and not in any pre-pilot checklist. Whoever runs the pilot deploy hits this
with no written instruction.
⚠ **Not a security defect — the closure is deliberate** (it is what stops self-promotion, and the
guard is correct). The defect is that the bootstrap is undocumented and unautomated, so do **not**
"fix" it by weakening the guard.
**Status:** OPEN, unassigned. Two candidate dispositions, PO's call: (a) document it as an explicit
step in the pilot-deploy runbook — cheapest, and sufficient for one pilot tenant; (b) a
seed/CLI-driven bootstrap that mints the first admin idempotently. **Blocks nothing today** (local +
E2E get `platform@test.local` from `seed.sql`, which is exactly why the gap is invisible to every
gate), but it is on the critical path of the **first production deploy**.

### Closed → [bug-log-archive.md](docs/progress/bug-log-archive.md)

**Rotated 2026-08-18 (3)** — **BUG-DM5-S3-ENV-FIXTURE-POOL-1** · **BUG-DM5-S3-INACTIVE-PRINT-1** ·
**BUG-DM5-S6-EVID-KBD-1** — all three *closed well before their rows said so*; full repro, mechanism
and closure evidence → [archive § "Rotated 2026-08-18"](docs/progress/bug-log-archive.md). Verbose
narratives rotated 2026-08-18 → [archive § "Bug Log closure narratives"](docs/progress/bug-log-archive.md).

**Rotated 2026-08-14 (5 + earlier)** — BUG-DM5-S2-STUB-1 · -WRITE-ARM-1 · -CITATION-TARGETS-1 ·
BUG-DM5-CAPA-1 · BUG-DM4-DUP-1, plus BUG-DM2-001/-002/-003 and BUG-CASEKIND-001 → same archive.

⛔ **Three warnings from those closures that must NOT be lost with the narrative:**
- **Do NOT add `is_active` to `app.can_view_printed_document`.** The print door admits a deactivated
  account **by decision**, pgTAP `342` S3c3 pins it, and a second copy of the same predicate is the
  *two-locks-that-are-one-lock* trap. The authority is the **conjunction**.
- **Date a log before citing it.** The gate's directory holds a `batch-9-unrun.log` ("BATCH 9 DID NOT
  RUN") naming the very spec used as pass evidence; reading it as the passing run inverts the verdict.
- ⚠ *A fix commit is not a status edit* — BUG-DM4-DUP-1 and BUG-DM5-S6-EVID-KBD-1 each sat marked
  OPEN for days after their fix shipped.

**Earlier eras** (rotated 2026-08-06 → 2026-08-12) — each bug's full entry, repro and lessons are in
the archive. The navigation hooks worth keeping live:

- ⚠ Before touching `buildAnswerMaps`, read **BUG-FF4-001** — the obvious one-line fix breaks Rule 3
  SQL↔TS evaluator parity.
- ⚠ Before diagnosing any minutes E2E failure, read **BUG-MIN-E2E-1** — closed as **NOT a product
  defect** (a stale per-worktree `.env.local` `MINUTES_SERVICE_URL`, `:8000` vs the stub's
  `127.0.0.1:8891`). The durable fix is the mutation-proven `beforeAll` precondition guard, not the value.
- ⚠ Before touching Radix dialog focus, read **BUG-RDR-001** + **BUG-ETHE4-FOCUS-1** — `onCloseAutoFocus`'s
  `preventDefault()` **also cancels `FocusScope`'s own restore**, so both halves must be replaced
  together; and a bubble-phase `stopPropagation()` cannot beat `DismissableLayer`'s capture-phase
  Escape. Untested residual: **FUP-ETH-KBD-1**.
- ⚠ **BUG-ACT-ACL-1 closed one instance, not the population** — that population is now swept by
  AUDIT-INVOKER-WRAPPER, with `FROMFINDINGS=1 ARM=wrapper` standing as a §6 step-1 gate over it.
- **FUP-VACUOUS-COVERAGE-1 stays OPEN**: `phi-remediation` REM-8/REM-9 are honest `test.skip()`s,
  outside the vacuity property, so `lint:vacuous` will never catch them.

## Test Run Summary

<!-- Most recent gate only, ONE ROW each. The narrative — triage, dispositions, mutation proofs —
     rotates to docs/progress/test-run-archive.md at each §6 Record (full history, Phases 0 →
     ACT, already there). -->
> **Retention: the most recent gate only.** Rotated **2026-08-18** (DM5 Record) →
> [test-run-archive.md](docs/progress/test-run-archive.md) § "Rotated from PROGRESS.md 2026-08-18":
> the DM5·S6 **RED** first run (superseded by its own GREEN re-run) and the DM5·S3 gate row — 2 rows,
> **`cmp`-verified byte-identical before the cut**, and checked for `](docs/…)` links needing a
> repoint (**there were none** — verified, not assumed). Prior rotations: 2026-08-17, -14, -12, -11,
> -10, -07.
>
> ⭐ **The table now holds exactly ONE row, which is what "most recent gate only" has always meant** —
> the 2026-08-17 DECLARING-GREEN run the DM5 phase QA rests on. *This section has been over-retained
> at every prior Record; one row is the contract, not a minimum.*

| Date | Run | Result |
| --- | --- | --- |
| 2026-08-18 | **DM follow-up triage · LEAD** — the four shipped items (#2 byte proof · #4 DVF 1:1 · #8b draft-print delete guard · attachments deletion). Two fresh `supabase db reset --local` cycles; both new pgTAP arms authored **red-first** | **pgTAP 194 files / 6397 PASS** (6392 baseline **+2** `328` K17a/b **+3** `312` t74/75/76 — the parts sum) · **lint 5/5** · **typecheck 0** · **vitest 1305/1305** (+1) · authz **`census` / `hat` / `floor` / `FROMFINDINGS=1 wrapper` all INVARIANT HOLDS**. ⛔ **`e2e:prod` NOT RUN — this row is not a phase gate.** ⚠ One RED en route was a real defect in this batch's own migration, caught by pgTAP `320` U1 at **237→238** (PUBLIC-executable `SECURITY DEFINER`), **not** by review — `312` was fully green with the door open |

## QA Verdicts

<!-- ONE LINE per phase/feature: verdict + date + link. The full analysis lives in
     docs/reviews/*.md — never restate rationale here or in the archive.
     Struck-through rows are superseded rounds, kept only to show a phase looped.
     Retention: current milestone only. Older concluded rows move VERBATIM to
     qa-verdicts-archive.md's "Collapsed one-line index" (the index is not rationale —
     it preserves the feature-name → review-file mapping). -->

| Phase / Feature | Verdict | Date | Report |
| --- | --- | --- | --- |
| DM5 — PHASE QA | APPROVED (r2) | 2026-08-17 | [dm5-phase-review](docs/reviews/dm5-phase-review.md) |
| DM5 · S6 — canon rewrite + program exit sweep | APPROVED (r2) | 2026-08-17 | [dm5-s6-review](docs/reviews/dm5-s6-review.md) |
| 2026-08-18 | – | – | – |
| DM5 · S5 — operational closure | APPROVED (r2) | 2026-08-17 | [r2](docs/reviews/dm5-s5-review-r2.md) · [r1](docs/reviews/dm5-s5-review.md) |
| DM5 · S4 — legacy storage-bucket retirement | APPROVED (r3) | 2026-08-17 | [r3](docs/reviews/dm5-s4-review-r3.md) · [r2](docs/reviews/dm5-s4-review-r2.md) · [r1](docs/reviews/dm5-s4-review.md) |
| DM5 · S3 — printed renditions onto the core substrate | APPROVED (r2) | 2026-08-14 | [dm5-s3-review](docs/reviews/dm5-s3-review.md) |
| 2026-08-17 | – | – | – |
| DM4 — Wave C: referrals | APPROVED (r2) | 2026-08-14 | [dm4-referrals](docs/reviews/dm4-referrals-review.md) |
| DM3 — Wave B: controlled documents | APPROVED (r2) | 2026-08-13 | [dm3-controlled-documents](docs/reviews/dm3-controlled-documents-review.md) |
| _Verbose form of the 5 rows above, incl. both struck r1 rounds_ — rotated 2026-08-14 (§5: never restate rationale here) | — | — | [archive](docs/progress/qa-verdicts-archive.md) |
| 105 concluded rows | — | — | [collapsed index](docs/progress/qa-verdicts-archive.md) |

## Decisions

<!-- One line per decision; full rationale in docs/decisions/ (ADR) + docs/progress/decisions-log.md -->

| Date | Decision | Ref |
| --- | --- | --- |
| 2026-08-18 | **DM-FUP TRIAGE #1 — the Cloud orphan measurement must CONSTRUCT an orphan, not probe for one** (PO) | FUP-DM5-CLOUD-ORPHAN-SURFACE |
| 2026-08-18 | **DM-FUP TRIAGE #2 — `reclassifyDocument` writes `unavailable_on_platform`** (PO) | FUP-DM5-BYTE-PROOF-NOT-ATTEMPTED |
| 2026-08-18 | **DM-FUP TRIAGE #3 — Critical FUP C1 SPLITS into C1a (local) + C1b (Cloud); C1 does NOT close on C1a** (PO) | ADR [0121](docs/decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md) **Amdt 3** (amended) · **Critical FUP C1** |
| 2026-08-18 | **DM-FUP TRIAGE #4 — `document_version_files` gets `UNIQUE (file_object_id)`** (PO) | FUP-DM5-DVF-FILEOBJ |
| 2026-08-18 | **DM-FUP TRIAGE #5 — the Q1 arm's NAMED successor is `app.resolve_document_version_bytes`, and the arm moves into C2 Tier 1** (PO) | FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN · **Critical FUP C2** |
| 2026-08-18 | **DM-FUP TRIAGE #6 — PRODROW is SEQUENCED, and the remote is NOT reset first** (PO) | FUP-DM4-PRODROW · FUP-DM5-STACK-CYCLE-DESTROYS-BYTES |
| 2026-08-18 | **DM-FUP TRIAGE #9 — PRODROW STAYS OPEN, blocked on the C1b constructed-orphan probe** (PO; both closure options declined) | FUP-DM4-PRODROW |
| 2026-08-18 | **DM-FUP TRIAGE #10 — CLAUDE.md §8 updated FIVE → SIX lint gates** (PO-approved; CLAUDE.md edits require it) | FUP-DM5-SETLOCAL-MIGRATION |
| 2026-08-18 | **DM-FUP TRIAGE #11 — HOLD the `db push` of `20260928000600`/`…000700`** (PO) | FUP-DM5-DVF-FILEOBJ |
| 2026-08-18 | **DM-FUP TRIAGE #6 — PRODROW is SEQUENCED, and the remote is NOT reset first** (PO) | FUP-DM4-PRODROW · FUP-DM5-STACK-CYCLE-DESTROYS-BYTES |
| 2026-08-18 | **DM-FUP TRIAGE #7 — BUILD the `set local` lint gate, bounded by the FROZEN WATERMARK, not by an allowlist** (PO instrument; the lead had proposed an allowlist and was wrong) | FUP-DM5-SETLOCAL-MIGRATION |
| 2026-08-18 | ✅ **DM-FUP TRIAGE #8b — RE-RULED AND BUILT: refuse to DELETE a response that has an ACTIVE printed document** (PO), replacing the withdrawn #8. Migration `20260 | ADR [0104](docs/decisions/0104-pdf-document-printing-module.md) D7 (preserved) · `20260928000700` |
| 2026-08-18 | ⚠ **THE #8b MIGRATION SHIPPED A PUBLIC-EXECUTABLE `SECURITY DEFINER` FUNCTION, AND A GATE CAUGHT IT — not review, and not foresight.** Created without an explicit ACL,… | FUP-ACL-APP-POPULATION · pgTAP `320` U1 |
| 2026-08-18 | ⛔ **DM-FUP TRIAGE #8 IS WITHDRAWN THE SAME DAY — it reverses a ratified decision, and NOTHING WAS BUILT.** | ADR [0104](docs/decisions/0104-pdf-document-printing-module.md) D7 · FUP-DM5-DANGLING-PRINT-ON-DELETED-DRAFT |
| 2026-08-18 | ~~**DM-FUP TRIAGE #8 — refuse a print mint from a non-`submitted` response**~~ ⛔ **WITHDRAWN — see the row above.** (PO). The narrowest of the three filed options, and the standing principle applies:… | FUP-DM5-DANGLING-PRINT-ON-DELETED-DRAFT |
| 2026-08-18 | **DM5 GATE STEP 4 — ALL SEVEN DOCKET ITEMS RULED** (PO) | [phase review](docs/reviews/dm5-phase-review.md) §§5–6 · § Critical FUP |
| 2026-08-18 | ✅ **`db push` EXECUTED — all five local-only migrations applied to the remote** (PO-authorized at the docket, to carry out decision #1) | § "State" (a TOP-LEVEL section since 2026-08-18) |
| 2026-08-18 | **#4 SUPERSEDE COLLISION RULED as (b) — supersession no longer marks bytes; the trigger moves to RETENTION EXPIRY** (PO) | ADR [0121](docs/decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md) **Amdt 2** · ADR [0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md) D11 |
| 2026-08-18 | 🔒 **#7 PILOT RISK ACCEPTED, BOUNDED BY ONE REHEARSAL** (PO) — the pilot may proceed over the manual-only PHI-disposal path **on the condition that `phi-disposal-runbook.md` runs end-to-end against… | ADR [0121](docs/decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md) **Amdt 3** · **Critical FUP C1** |
| 2026-08-18 | **#2 ADR 0114 O1 + O2 RULED** (PO) | ADR [0114](docs/decisions/0114-document-model-redesign.md) Open items |
| 2026-08-18 | **#1 ADR 0120 D9 — the under-count class is RATIFIED AS ACCEPTED-UNVERIFIED on Cloud; no verification step is added** (PO) | ADR [0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md) **D9** · [runbook](docs/deployment/phi-disposal-runbook.md) §6 |
| 2026-08-18 | **#5 THE 407-DOOR TRIAGE IS SIZED — TWO TIERS** (PO) | **Critical FUP C2** · FUP-AUTHZ-COMMAND-DOOR-UNSWEPT |
| 2026-08-18 | **#3 UPLOADER VISIBILITY IS NOT ADDED — S1-O3 CLOSED** (PO) | ADR [0117](docs/decisions/0117-dm2-s1-confidentiality-ceiling-decisions.md) § S1-O3 · [0116](docs/decisions/0116-dm1-substrate-cutover-decisions.md) §11 |
| 2026-08-18 | **#6 THE S2/S3/S5 `backend-state.md` SECTIONS ARE STILL WANTED — `backend` writes all three as ONE task before DM5 closes** (PO) | FUP-DM5-BACKEND-STATE-SLICE-SECTIONS |
| 2026-08-17 | **DM5·S5 step 4 — the follow-up batch's PO approval CLOSES S5 TOO** (PO) | PROGRESS.md § Current Phase Tasks |
| 2026-08-17 | **FUP-DM5-SUPERSEDE-SERVING-COLLISION — DECIDE LATER; the D11 inflow STAYS REVERTED** (PO) | ADR [0121](docs/decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md) Amdt 1 |
| 2026-08-17 | **FUP-DM4-RECUSAL — the Phase-19 deferral is OVERTURNED; close it now with a NARROWING arm** (PO) | ADR [0122](docs/decisions/0122-recusal-case-read-arm-at-the-referral-freeze-door.md) |
| 2026-08-17 | **ADR 0121 ACCEPTED — D2 (cron outflow) + D4 (what `disposed` asserts) ratified as proposed** (PO) | ADR [0121](docs/decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md) |
| 2026-08-17 | **The PHI-disposal runbook's five open values SET** (PO) | `docs/deployment/phi-disposal-runbook.md` §6b |
| 2026-08-17 | **The local Storage volume is NON-DURABLE DISPOSABLE TEST RESIDUE** (PO) | FUP-DM5-STORAGE-ORPHANS |
| 2026-08-17 | **Finish the PROGRESS.md rotation before opening DM5·S6** (PO) | PROGRESS.md § Current Phase Tasks |

> ↩ **23 rows dated 2026-08-05 and older rotated 2026-08-17** → **[decisions-log.md](docs/progress/decisions-log.md)** § "Rotated from PROGRESS.md 2026-08-17", preserved verbatim before the cut (`cmp`-verified). This table is the **head** of the log, not the log.
| _pre-2026-07_ | **35 earlier decision rows (Phases 0–14, 2026-06-11 → 2026-06-25) rotated 2026-08-04** | [decisions-log.md](docs/progress/decisions-log.md) |

> ↩ **12 rows dated 2026-08-08 → 2026-08-14, and the VERBOSE form of the 32 rows above, rotated 2026-08-18** → **[decisions-log.md](docs/progress/decisions-log.md)** § "Rotated from PROGRESS.md 2026-08-18". ⛔ *The live rows are deliberately one-line — every warning they carried has a body in [follow-ups.md](docs/progress/follow-ups.md); verified before compressing.*

## ⛔⛔ State — re-measured **2026-08-18**. This block has now gone stale THREE times; measure, never quote.

_(It has twice carried a confident falsehood in the line a new session reads to decide whether the
remote is safe to touch — first "NOT pushed, no `db push`" when both were done, then "0 ahead /
local-only: NONE" while commits and migrations accumulated. →
[[a-records-claim-about-an-external-system-goes-stale-silently]])_

| fact | measured **2026-08-18** | how |
|---|---|---|
| branch | `main`, tree clean, **13 commits AHEAD of `origin/main` — UNPUSHED** | `git rev-list --count origin/main..HEAD` |
| `db push`? | ✅ through **`20260928000500`**, **411** applied | `supabase_migrations.schema_migrations` |
| local-only migrations | ⚠ **2** — `20260928000600` (DVF unique) · `20260928000700` (active-print guard). **HELD, not blocked** (TRIAGE #11) | `ls` vs remote count |
| 🔴 remote DATA | **EMPTY** — every table 0 rows, `auth.users` 0, **0** storage objects in all **4** buckets | census → `docs/backend-state.md` |
| 🔴 why | **A REMOTE RESET AT `2026-08-17 11:37:35Z`** — `CREATE TABLE IF NOT EXISTS schema_migrations` → all `CREATE EXTENSION` → migrations from `20260711…` **re-applied**. No `TRUNCATE`/`DROP SCHEMA` in the window | `query_logs` |
| remote buckets | **4** (was 12) — the 8 legacy buckets are **GONE**; S4's retirement IS deployed | `storage.buckets` |
| recusal PHI fix | ✅ **LIVE** — `prosecdef = t`, `can_read_case` in the body read from `pg_get_functiondef` | `pg_proc` |
| DM flags | local **all six ON** (from `seed.sql`); **shipped OFF** — `db push` never applies the seed | flag table + remote read |

⛔ **THE CONSEQUENCE THAT SURVIVES:** applied migrations may **NOT** be edited in place — that is the
drift that blocks a future `db push`. **Nothing at or below `20260928000500` may be touched.** The
editable window did not move forward; it closed.

⚠ **"Flags ship OFF" is NOT a security boundary.** ✅ The load-bearing half is re-verified 2026-08-18:
**ZERO RLS policies read a flag** (0 rows over `pg_policies` matching
`feature_flag|documents_wave|documents_foundation|document_printing|assert_document`). The conclusion
stands on that half alone — it is an **app-layer** gate. ⛔ The function-count half is **CONTESTED**:
**6 of 75** document functions read a flag (the DM5 phase QA + `docs/backend-state.md`, independently
reproduced) — *not* the "51 of 52" this block carried for weeks. ⭐ **The figures disagree because each
uses a different BOUND, not because one is a typo** → [[enumeration-boundary-is-a-syntax-not-a-property]];
whoever re-derives it **states the predicate beside the number**.

⭐ **The load-bearing reason the remote is safe today is that it holds no data and no users** — a
stronger reason than any flag argument, and one that **expires the moment the pilot loads data**.

## ⭐⭐ Critical FUP — the must-not-be-forgotten list

_**PO-curated. Entries land here ONLY on the PO's explicit instruction.** No implementer, reviewer or
lead may promote an item into this section, and nothing arrives here as a side effect of a review
round. It is the short list of follow-ups whose loss would be materially costly, kept **separate from
the general register precisely so that register's length cannot bury them**._

⛔ **NEVER ROTATE THIS SECTION — at any file size.** The general § Follow-ups index is
rotation-eligible under the §7 size discipline; this one is not. ⚠ An entry leaves only when the work
has **landed**, which is not the same as the phase it was filed in closing — *a deliverable assigned
to a slice disappears when that slice closes cleanly* (ADR 0120's own O1/O2 correction, and the reason
this section exists). Full bodies stay in
[follow-ups.md](docs/progress/follow-ups.md); these lines are the standing index.

| # | item | what must happen | trigger — the point it can no longer wait | owner |
|---|---|---|---|---|
| **C1** | 🔒 **`FUP-DM5-DISPOSAL-JOB`** — the PHI-disposal path is **manual and UNREHEARSED**. `disposal_state` records an **intent, not a destruction guarantee**: **4 SET-form writers** put rows into `disposal_pending` — 3 `authenticated`-reachable (`request_document_disposition`, `dispose_case_phi`, `dispose_referral_phi`) **plus `complete_document_reclassification`, service-role-only** — against **exactly ONE** outflow door, and **nothing automated calls it** (no `pg_cron`, no cron schema, single-process Dockerfile). ⚠ *Corrected 2026-08-18: this said "three inflow doors", which is right only bounded to JWT-reachable doors — **the queue is fed wider than the item said**.* | ⭕ **SPLIT IN TWO 2026-08-18 (DM-FUP TRIAGE #3) — and C1 does NOT close on C1a.** **C1a (local)** — execute [`phi-disposal-runbook.md`](docs/deployment/phi-disposal-runbook.md) end-to-end against local test data, once, and record the run; it debugs the procedure and produces the first **destination path** for `FUP-DM5-BACKUP-IS-PHI-EXPORT`, owed at first execution. **C1b (Cloud)** — the same run against the linked project. ⛔ **Why the split is not bookkeeping:** the runbook itself says a local rehearsal *"runs against a local stack by construction, so it cannot exercise the Cloud paths"* (§6) — so a local-only run discharges this row's **wording** while leaving its **purpose** undischarged, which is [[a-predicate-quoted-at-the-wrong-grain]] in the highest-severity item in the register. | ⛔ **BEFORE ANY REAL PATIENT RECORD IS LOADED.** PO-accepted 2026-08-18 as a pilot risk **bounded by this rehearsal** (ADR 0121 **Amdt 3**) — the acceptance is not open-ended, and the pilot may not admit real PHI ahead of it. ⭐ **The bound is C1b, not C1a**: the pilot runs on Cloud, so a green local rehearsal does **not** release it. | PO (executor = whoever holds service-role reach — an ACL fact, not a choice) |
| **C2** | 🟠 **`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`** — **407** reachable command doors sit outside **every** authz arm's domain (`ARM=census` is bounded to `bool`/set-returning; these return `jsonb`/`void`). ⚠ **Covered-but-UNPINNED, not blind** — a 3-door neutralization sample found all three COVERED. ⛔ **The sample may NOT be used to close it.** | **Tier 1 — sweep the subset that touches PHI or crosses a tenant boundary**, derived as a property over the catalog, never hand-listed ([[enumeration-boundary-is-a-syntax-not-a-property]]). **Tier 2 — the remainder is DEFERRED.** Each swept door gets a recorded verdict, so a regression reds and a **new** door cannot pass by absence. ⭕ **Tier 1 ABSORBED TWO ITEMS 2026-08-18** — `FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN` (successor named: `app.resolve_document_version_bytes`) and `FUP-DM5-SIBLING-GUARD-DIFF`. All three want the same door-mutation machinery over `prosecdef` gates; building it three times was declined. ⚠ **Absorption is not closure** — each keeps its own index line and its own verdict. | **Tier 1: next, as its own scoped workstream** — sizing is step one and is not yet done. **Tier 2: after the pilot ships, once there are real customers.** | lead + backend |

## Follow-ups / Deferred Items

<!-- ONE-LINE INDEX ONLY (severity · id · claim · owner). Full bodies of OPEN items live in
     docs/progress/follow-ups.md; resolved items in follow-ups-archive.md. Compressed
     2026-08-18 at the size rotation — every entry was verified to HAVE a body first. -->
_Full bodies of OPEN items rotated 2026-08-08 → **[follow-ups.md](docs/progress/follow-ups.md)** — update BOTH (the body there, the line here) when an item changes state. Resolved items → [follow-ups-archive.md](docs/progress/follow-ups-archive.md). One line per item: severity · id · title · owner._

⭐ **Two items also carry a [§ Critical FUP](#-critical-fup--the-must-not-be-forgotten-list) entry** — `FUP-DM5-DISPOSAL-JOB` (C1) and `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (C2). Their lines below stay put; the Critical entry adds a **trigger and a deadline**, it does not replace the index line.

⚠ **Six lines below are NEW index entries, not new items** (2026-08-14): FUP-AUTHZ-HARNESS-TRANSACTIONAL ·
FUP-AUTHZ-ALLOWLIST-ROT · FUP-DM5-GRANTS · FUP-DM5-FINALIZE-ATOMIC · FUP-DM5-DVF-FILEOBJ ·
FUP-VACUOUS-COVERAGE-1 — each was OPEN but named **only** inside the DM5 phase section or a Bug Log
pointer, so compressing those would have dropped it from the index entirely.

⚠ **Two MORE lines added 2026-08-17 (phase QA R3), and the 2026-08-14 warning above was written and
then immediately re-earned — this time by the highest-severity item in the phase.** Both were
announced as new by the follow-up batch, given full bodies in `follow-ups.md`, and named repeatedly in
the phase narrative — **but neither ever got an index line**, so the next rotation would have dropped
them. ⭐ *A body plus a narrative mention is not an index entry; the index is what a reader greps.*

- ⬛ **FUP-DM5-BACKEND-STATE-SLICE-SECTIONS** — ✅ **✅ RESOLVED 2026-08-18 (backend). The four `##` sections (`DM5·S5` · `DM5·S4` · `DM5·S3` · `DM5·S2`) — S4 added the same day on the PO's ruling, so the scope is wider than the item's title…** — backend
- ⬛ **FUP-DM5-BYTE-PROOF-NOT-ATTEMPTED** — ✅ **✅ RESOLVED 2026-08-18 (`src/lib/documents/actions.ts`): the one lane that deletes bytes now declares `'unavailable_on_platform'` instead of riding the DEFAULT. ⭐ The pin was PROVEN ABLE TO…** — backend
- ⬛ **FUP-DM5-ATTACHMENTS-MODULE-SURVIVED-RETIREMENT** — ✅ **✅ RESOLVED 2026-08-18: `src/lib/attachments/actions.ts` DELETED (6 dead exports, zero importers) and the stale `openAttachment` reference in `queries/case-documents.ts` repointed to the…** — frontend + backend
- 🟠 **FUP-DM5-SUPERSEDE-SERVING-COLLISION** — ✅ **PO-RULED 2026-08-18 as option (b): supersession no longer marks bytes; the trigger moves to RETENTION EXPIRY** — backend
- 🟠 **FUP-AUTHZ-COMMAND-DOOR-UNSWEPT** — ⭐ **⭐ CRITICAL FUP C2. `ARM=census`'s DEFINER clause is bounded to `bool`/set-returning, so 407 reachable non-trigger command doors (326 RPC-callable) sit outside every arm's domain. ⭕…** — lead + backend
- 🔴 **FUP-ACT-DISPOSE-UI** — LGPD Art. 18 referral-erasure has no UI route (authorized ∩ reachable = ∅); **PILOT-GATE CHECK, item 0 above** — PO
- 🟠 **FUP-AUTHZ-HARNESS-TRANSACTIONAL** — **PARTIALLY RESOLVED 2026-08-17 (`4102149b`); the filed remedy was WITHDRAWN as unbuildable** — lead/backend
- 🔴 **FUP-PGTAP-VACUOUS** — `lint:vacuous` scans TS specs only; ~6348 pgTAP assertions unscanned, live specimen in a PHI-boundary suite. The sweep must be **proven able to fail** first — lead/backend
- 🔴 **FUP-AFF-1** — the census is BLIND to write-path doors (ADR 0079 Am. 5); ⛔ cite `302`'s keystones, **never `ARM=census`** — backend/harness
- 🔴 **FUP-PCITV-1** — what QA APPROVED **over**, ranked: 5 open (TRUNCATE revoke residue · audit-mesh 2/7 arms · unexercised org-admin disjunct · resolver/GUC semantics · 10 bare `for select` policies) — unassigned
- 🔴 **FUP-ETH-ROLES-1** — no production bootstrap of `case_participant_roles`; the bundle lives only in `seed.sql` and `role_id` is NOT NULL, so a real org starts with zero roles and every participant type dead-ends. Decide before a second org onboards — product/backend
- ⬛ **FUP-QOB-3** — ✅ RESOLVED 2026-08-09 (PO): `dispose_event_phi` KEEPS its tenancy arm and referral disposal gets the same backstop back. ⚠ This line sat 🔴 OPEN for six days describing a gap already ruled — PO
- 🔴 **FUP-FF5-1** — patient-lane sublabel degenerate on the READ path (PO DEFERRED; resolve before the lane reaches a real committee) — backend
- 🟠 **FUP-DM5-STORAGE-ORPHANS** — ✅ **Local half CLOSED empty by measurement 2026-08-17** — lead/backend
- 🟠 **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES** — **a `supabase stop`/`start` recovery destroyed 221 storage objects (15 PHI-tier) with no manifest, no count comparison, no audit — the event ADR 0120 D9 exists to prevent, inside the slice tha** — lead/backend
- 🟠 **FUP-DM5-D9-NO-ARM-SEES-A-BYTE-POST-RETIREMENT** — **once `…000400` applies, `capture` prints `CAPTURE CLEAN` and the only arm that can still see a surviving byte is the volume `walk`, which is `STORAGE_BACKEND=file` local-only ⇒ on Cloud, pos** — backend
- 🔴 **FUP-DM5-NO-ANSWER-VS-NOTHING** — ⭐ **THE CLASS: an observable PROXY is substituted for the property that actually matters.** — backend/lead
- 🔴 **FUP-DM5-BACKUP-IS-PHI-EXPORT** — **a Storage backup is an unmanaged plaintext PHI export, and the S5 drill created one (245 files, 68 PHI-tier, no RLS, no audited door, no TTL). The widest PHI egress path the system has. ✅ Al**
- 🔴 **FUP-DM5-CLOUD-ORPHAN-SURFACE** — ⭕ **ESCALATED 2026-08-18: `FUP-DM4-PRODROW` NOW BLOCKS ON THIS PROBE (PO), and the probe has a REAL subject.** — backend/lead
- 🟠 **FUP-DM5-DISPOSAL-JOB** — ⭐ **CRITICAL FUP C1, split into C1a (local) + C1b (Cloud) on 2026-08-18; the pilot bound is C1b.**
- 🔵 **FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN** — **⚠ HALF RESOLVED 2026-08-17 (`24cee179`): the fail-open half is fixed and proven; the arm is still a no-op pending a NAMED successor (deliberately not re-pointed — a successor must be named,…** — backend
- ⬛ **FUP-DM4-RECUSAL** — ✅ **✅ RESOLVED 2026-08-17 (`32054942`, `20260928000100`, ADR 0122): a `can_read_case` arm above the `p_kind` dispatch, covering both arms; `340` 76→82 red-first. ✅✅ AND NOW LIVE ON THE REMOTE — **
- 🟠 **FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES** — ✅ **DECIDED 2026-08-18: BUILD IT, at retention expiry** — backend
- ⬛ **FUP-DM5-342-PLAN-COMMENT** — ✅ RESOLVED 2026-08-17 (`24cee179`); ⭐ the itemisation **already summed to 59** — only the leading total was stale, so the comment disagreed with *itself* — backend
- 🟠 **FUP-DM5-SIBLING-GUARD-DIFF** — **no authz arm can see a door that OMITS a check its siblings all make** — lead/backend
- ⬛ **FUP-DM5-330-WRITE-BLIND** — ✅ RESOLVED 2026-08-17 (`67cac33b`), `330` 57→62. ⭐ Closed **on its own terms**: blindness re-derived from the live catalog and still real — **not** closed on `342`'s coverage, as the item's warning forbade — backend
- ⬛ **FUP-DM5-FINALIZE-ATOMIC** — ✅ RESOLVED 2026-08-17 (`20260928000500`): bytes + evidence row commit in ONE transaction; `341` 57→67. ⭐ **The obvious keystone was VACUOUS** — one RPC call is one transaction, so any raise rolls back whatever the check order is — backend/lead
- 🟡 **FUP-DM5-DANGLING-PRINT-ON-DELETED-DRAFT** — ⭕ **PREVENTION SHIPPED 2026-08-18, ITEM STAYS OPEN ON TWO REMAINDERS** — backend
- ⬛ **FUP-DM5-DEAD-CORE-PROJECTION** — ✅ RESOLVED 2026-08-17 (`24cee179`) by DELETION; verified at every **import site**, not by grepping the symbol — frontend/backend
- ⬛ **FUP-DM5-GRANTS** — ✅ CLOSED 2026-08-17 (`20260928000200`): direct write revoked, the RPCs are now the only writers; `341` 53→57. ⭐ **The fix would have made TWO P0 policies silently BLIND** — `252` now restores the grant in its own rolled-back txn to keep them mutation-proven — backend
- ⬛ **FUP-DM5-DVF-FILEOBJ** — ✅ **✅ RESOLVED 2026-08-18 (`20260928000600`): `UNIQUE (file_object_id)` makes the 1:1 binding structural instead of a property of caller discipline; pgTAP `328` 128→130, red-first (K17b's…** — backend
- ⬛ **FUP-DM5-SETLOCAL-MIGRATION** — ✅ **RESOLVED 2026-08-18: the gate is BUILT + WIRED.** — backend
- 🟡 **FUP-ACL-APP-POPULATION** — the DROP+CREATE → PUBLIC-EXECUTE mechanism has fired **3×**, and the **`app`** schema has no generic net (`100` t19 is `public`-bounded; `320`'s is an 8-name allowlist) — backend
- ⬛ **FUP-AUTHZ-ALLOWLIST-ROT** — ✅ RESOLVED 2026-08-17 (`4102149b`): `ARM=floor` now anti-joins every allowlist signature against `pg_proc`. **Red-first — it found SIX stale entries where this item named one** — lead/backend
- 🟡 **FUP-PGTAP-WORKER-DEADLOCK** — `test:db` intermittently deadlocks a `pg_prove` worker; **assurance, not correctness** (a dropped suite is not a passed suite). ⛔ Never pipe the run through `tail` — backend
- 🟡 **FUP-PGTAP-SAVEPOINT** — ⚠ **DOWNGRADED 🔴→🟡: the original claim was WRONG.** TAP output cannot be rolled back; real only in the degenerate all-assertions-inside case — lead
- 🟡 **FUP-ROTATION-BREAKS-LINKS** — **474 broken relative links across the four rotation destinations, measured 2026-08-17.** — lead
- 🟡 **FUP-VACUOUS-COVERAGE-1** — **`phi-remediation` REM-8/REM-9 are honest `test.skip()`s that never run, so they are outside the vacuity property and `lint:vacuous` can never catch them. ✅ Body written 2026-08-17 (it had no** — tester/backend
- 🟡 **FUP-329-ABORT-SHAPE** — a `329` keystone whose failure **aborts the file** (drops 41 assertions), making a mutation sweep over those gates unclassifiable — backend
- 🔴 **FUP-DM4-PRODROW** — ⛔ **CENSUS RUN 2026-08-18: THE SUBJECT IS GONE — AND IT WAS ERASED, NOT RECONCILED.** — lead/backend
- 🟡 **FUP-E2E-REPEAT-FLAKY** — ⭕ **TWO members: `act-role-assumption:157` + `phase2-auth-shell:268`** — lead/tester
- 🟡 **FUP-E2E-SERVER-DEAD-1** — the prod-standalone server dies under load in ~3 of 17 batches; `BATCH_TESTS=22` rescues. Infra, never an assertion failure — **but a batch with no verdict is not a pass** — unassigned
- 🟡 **FUP-E2E-PRINT-POOL-DEVLOOP** — **`submittedResponseIds` claims the print fixture pool by POSITION (`order=id.asc`), so a second `npx playwright test e2e/pdf-printing.spec.ts` without a reset reds at `:47`. Mechanism PROVEN…** — tester
- 🟡 **FUP-GATE-PDFP1-FLAKE** — `pdf-printing.spec.ts:38` empty-state flake; ⚠ mechanism **UNPROVEN** and both evidence artifacts were overwritten by the re-runs. Real fix: the gate script must archive a failing batch's log + `test-results/` **before** any re-run — lead/tester
- 🟡 **FUP-LINT-STALE-SYMBOL-COMMENT** — a 6th lint gate for comments naming deleted identifiers. ⚠ **Lead recommendation: do NOT build** (43% coverage ceiling) — lead/PO
- 🟡 **FUP-DM3-ETHICS-UI** — no affordance attaches an ethics decision letter; DM3 ships the seams API-writable only. Deliberate scope boundary — PO
- 🟡 **FUP-ACT-CAPA-ASSIGN** — NSP operators see ~only themselves in the CAPA assignee picker (`profiles` RLS has no operator arm) — backend
- 🟡 **FUP-ACT-HATLESS-AUDIT** — `audit_write` omits the `acting_as` KEY when hatless, conflating three meanings (Rule 11 met; legibility) — backend
- 🟡 **FUP-SILENT-READ-1** — ~207 of 773 PostgREST reads never destructure `error`, so empty is indistinguishable from failure. Per-call-site triage, **not** a bulk fix — unassigned
- 🟡 **FUP-ETH-KBD-1** — the professional lane's `TypeaheadField` was never keyboard-navigated, so BUG-ETHE4-FOCUS-1's defect is **untested, not ruled out** there — frontend/tester
- 🟡 **FUP-ETH-A11Y-1** — ETH·E4 dialogs: `aria-describedby` never reaches the error id; the typeahead announces neither loading nor result count — frontend/tester
- 🟡 **FUP-PDF-4** — `/verificar` rate limiter: ⛔ the filed premise was wrong (per-credential limiting already shipped); the real gap is the exhaustible **global** arm + per-process state — backend
- 🟡 **FUP-AFF-3** — pin door ACLs by DERIVING the door set from `pg_proc`, not by remembering it — backend
- 🟡 **FUP-AFF-4** — make the membership-role list a Postgres ENUM (decide before the role set next changes) — backend
- 🟡 **FUP-AFF-2** — D7's foreign-professional (no-CPF) escape is unreachable; decide before clinical staff onboard — product/backend
- 🟢 **FUP-QO-6** — oversight-toggle slow-confirm: annoyance severity ACCEPTED provisionally (PO); LOW, DB-vs-UI unclassified — tester
- ▶ **FUP-MIN-CUTOVER** — audio-minutes pre-enable gates (storage cap ⛔ BLOCKED on a Pro-plan decision · T5 smoke · R2 hardware look · deploy env vars) — lead + human
- ▶ **FUP-FF5-2** — §O pins the door's behaviour, not the closure of the `participants` writer set (assert count AND name; `\y` not `\b`) — backend
- ▶ **FUP-E2E-1** — RE-BASELINE `e2e:prod`: a named failure list, not a count (PO-ruled; blocks nothing) — tester
- ▶ **FUP-FF2-3** — whitespace-only observation filtered top-level but not per instance (legacy rows only) — backend
- ▶ **FUP-FF1-2** — FF-1 QA non-blocking items: 4 MINOR / 3 INFO — backend
- ▶ **FUP-FF1-1** — coherent fill-path hardening as one change (post-pilot; ADR 0087 ruling 5) — backend
- ▶ **AUTHZ Gate-2 MINOR-1** — reserved-session door returns the respondent's own `case_id` (fold at pilot close) — backend
- ▶ **ETH E1→E2 inheritance** — GAP-E1-1/2/3 + MINOR-A/B + participant-roles M2M, PO-routed to E2 — backend/frontend

_Resolved, rotated out of both live files → [follow-ups-archive.md](docs/progress/follow-ups-archive.md):
**FUP-DM1-CEILING · FUP-DM1-E2E · FUP-DM1-DISPOSE** (discharged by DM2 S1/S4/S2) · **FUP-F2-BUCKETS**
(`meeting-attachments` retired in `20260921000300`, pinned by pgTAP `325`) · **FUP-PDF-3** (both doors
now `RETURNS public.printed_document_public`; ADR 0111, pgTAP `323`)._

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
