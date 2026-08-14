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
| 22-v2 | **Referral Detail Redesign (RDR)** [0109](docs/decisions/0109-referral-registros-and-case-access-summary.md) (⚠ **D2 superseded** by 0110 — see 22-v3) · [record](docs/progress/referral-detail-redesign.md) | ✅ complete | ✅ (tsc 0 · lint 0/0 · Vitest **1254**) | ✅ pgTAP **183f/5870** · `ARM=census`/`hat`/`floor` HOLD · e2e:prod **1074p/1f** (sole failure = pre-existing BUG-MIN-E2E-1, outside the branch; referral batch 62/62, 0 did-not-run) | ✅ [APPROVED](docs/reviews/referral-detail-redesign-review.md) (0B/2 MINOR/3 INFO) | ✅ 2026-08-12 | 2026-08-12 | merge `81e1dc9` → `main`. ✅ **PUSHED** — `81e1dc9` is an ancestor of `origin/main` (corrected 2026-08-12; the cell read "local only, NOT pushed", true when written) · graphify `dfc3e35` |
| 22-v3 | **REG·KIND — one Registro vocabulary for cases and referrals** [0110](docs/decisions/0110-shared-registro-kind-vocabulary.md) (supersedes [0109](docs/decisions/0109-referral-registros-and-case-access-summary.md) **D2** only) | ⚠ **merged, gates 2–4 UNRUN** | ✅ (tsc 0 · Vitest **1254** · eslint 0/0 first-party) | ⚠ **step 1 only** — pgTAP **183f/5857** (`322` 72→63, `298` 36→32 as the retired table's tests retired with it) · `ARM=census`/`hat`/`floor` HOLD · diff-scoped sweep 3 COVERED + 1 **pre-existing** `ERROR` · E2E **targeted 24/24** (`referral-registros` 16 + `cases-extras` 8) — **no `e2e:prod`** | ⛔ **not run** (PO direction) | ⛔ not sought | 2026-08-12 | merge `9a20c8a` → `main`. ✅ **PUSHED** (`9a20c8a` is an ancestor of `origin/main`) and ✅ **remote `db push` DONE** — both `20260920000100`/`…000200` are registered on the linked project, `referral_note_types` is gone from the remote catalog. **Corrected 2026-08-12**; this cell previously read "local only, NOT pushed" + "`db push` NOT done", which had been true when written and was overtaken by a later push. ⚠ Verified against the REMOTE CATALOG, not the CLI: `supabase migration list --linked` showed a **blank Remote column for all 354** rows and the MCP `list_migrations` returned a **truncated 84** — both wrong. Only `select … from supabase_migrations.schema_migrations` on the linked project agreed with the objects actually present |
| DM | **Document Model Redesign** [0114](docs/decisions/0114-document-model-redesign.md) (+**Amendment 1** D15/D16, ratified 2026-08-13; supersedes [0063](docs/decisions/0063-centralized-attachments-substrate.md)) · plan [DM0–DM5](docs/plans/document-model-redesign.md) · [record](docs/progress/dm1-substrate-cutover.md) | ✅ **DM0 + DM1 + DM2 complete** (DM2 PO-approved 2026-08-13, `phase(DM2)` = `4c6f7d9`; r2-1 closed) — 🟢 **DM3 (Wave B: controlled documents) OPENING 2026-08-13**, unblocked by the **Q1 ruling** (ADR 0114 **Amendment 2 / D17**: the two ethics seams join Wave B). Flags still **OFF**; nothing merged, nothing pushed | ✅ 6 migrations `20260923000100`–`…000600` · ADR **0116** · lint 5-gate 0/0 · tsc · vitest 1254 | ✅ pgTAP **188f/5927 PASS** (suite `328`, 88 keystones) · `ARM=census`+`hat`+`floor`+`FROMFINDINGS=1 wrapper` **all HOLD** · diff-scoped sweep 13/16 reconciled, 12 COVERED + 1 BLIND (real, keystoned K12 → COVERED) + 0 ERROR · `e2e:prod` **1073p/1f/3flaky, 0 did-not-run**, every batch `accounted N/N`; the 1 failure is a proven `server_dead` INFRA flake (isolation 13/13 + identical-batch 68/68, `RETRIES=0`) · [gate detail](docs/progress/dm1-substrate-cutover.md) | ✅ **APPROVED (r1)** [review](docs/reviews/dm1-substrate-cutover-review.md) — 0 P0 · 1 MAJOR **fixed not deferred** (`can_read_file_object`'s uploader arm short-circuited the kernel chain; K13 red-first) · 5 MINOR · 4 INFO | ✅ **2026-08-13** | 2026-08-13 | ⚠ **branch `docs/dm1-plan-amendments` — NOT merged to `main`, nothing pushed** (PO directive; `main`/`origin/main` still `f84c6b6`). `phase(DM1)` = `bd45246`. Handed to DM2 and now ✅ **discharged**: FUP-DM1-CEILING/D15 (S1), FUP-DM1-E2E (S4), FUP-DM1-DISPOSE (S2), MINOR-2. **Q1 ✅ RULED 2026-08-13 — Wave B (DM3)**, ADR 0114 Amdt 2 / D17; four binding discharge conditions, K8 removal included. **Still open with the PO:** **S1-O3** (uploader visibility), O1/O2/O4. **DM2 gate detail:** [dm2-orchestration-wave-a.md](docs/progress/dm2-orchestration-wave-a.md) |
| DLB | **Deliberation & Voting Model** [0115](docs/decisions/0115-deliberation-and-voting-model.md) (plan [Slices 0–6](docs/plans/deliberations.md)) | ⛔ **ADR PROPOSED — NOT ratified; nothing built and nothing may start** (the plan's own Slice 0 gate). Drafted 2026-08-12 from a 20-question PO grilling (D1–D20): first-class commission-scoped `deliberations` + explicit `deliberation_seatings`; versioned `commission_governance_policies` **subsumes `commission_meeting_settings`** (table dropped); append-only ballots with the vote arithmetic owned by Postgres; append-only `committee_decisions` with supersession; `meeting_cases.decision` dropped. Flag `deliberations` (prod OFF) covers everything **except Slice 1**, which replaces live meeting-settings plumbing and so must land flag-independent + regression-safe. Slice 6 (D14, resolution promotion) is conditional on the [0114](docs/decisions/0114-document-model-redesign.md) document substrate — that ADR is ratified but **unbuilt**, and the plan recommends shipping v1 without it | – | – | – | ⛔ **not ratified** | – | ADR merge `a68f179` + renumber `feab771` — drafted as 0112, renumbered because **0112 was already taken** by [case-event kind write authority](docs/decisions/0112-case-event-kind-write-authority.md). ⚠ **Differing filenames merge CLEANLY**, so an ADR-number collision announces itself nowhere — renumber at merge time, not draft time. Same commit retargeted the draft's stale `0109` cross-refs (both the ADR and the plan) → `0114`. ✅ **PUSHED** — verified against the server (`git ls-remote origin refs/heads/main` = `a68f179`), not a cached remote-tracking ref. ⚠ This cell first read "NOT pushed", true when written and overtaken by a push minutes later — the third row in this table to need that correction |
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
| **ETH·E4** | **Ethics participant seating & professional identity** [0108](docs/decisions/0108-eth-e4-participant-seating.md) · [record](docs/progress/eth-e4-participant-seating.md) — closes FUP-ETH-1 + FUP-FF5-2 | ✅ **complete** | ✅ lint 0/0 · typecheck · vitest 1218/1218 · `next build` exit 0 | ✅ pgTAP **182f/5794** on a fresh reset (353 registered == 353 files) · `ARM=census`+`hat`+`floor` HOLD · diff-scoped door sweep 0 BLIND/0 ERROR · the 3 write doors **COVERED** in the standing write-path harness (⛔ never `ARM=census` — ADR 0079 Am. 5) · e2e:prod **GATE GREEN 140/0**, accounted 140/141 · [gate detail](docs/progress/eth-e4-participant-seating.md) | ✅ **APPROVED (r3)** [review](docs/reviews/eth-e4-review.md) — r1 ⛔ (1 P0) / r2 ⛔ (narrow) / r3 ✅ | ✅ 2026-08-11 | 2026-08-11 | `worktree-ethics-committee-completion` → `main`. Open: **FUP-ETH-A11Y-1** · **FUP-E2E-SERVER-DEAD-1**; m2/m5 → PO. ✅ remote `db push` **DONE** — `20260919000100`–`…000600` registered; the `professional_profile_id` duplicate check is moot (see the rotated row) |
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

### 🟢 IN PROGRESS — **DM3: Wave B — controlled documents** (opened 2026-08-13)

Plan: **[dm3-controlled-documents-plan.md](docs/plans/dm3-controlled-documents-plan.md)**
(`dc6ae9b`) — **APPROVED by the lead 2026-08-13** with two binding conditions (R1, R2).
Window `20260925000100`–`000800` (8 migrations); new pgTAP suite **`330`**, plus a
**K8c-only** edit to `328`. Census: 375 registered == 375 files.

| Slice | Owner | Status |
| --- | --- | --- |
| S1 — M1–M7 migrations + suite `330` | backend | ✅ applied — `330` **44/44**, `328` **128/128**; **M8 dropped with evidence** (its premise was false: no projection door ever projected `storage_path`) |
| S1b — backend side of the §7 contract (TS) | backend | ✅ landed (`d75883b`) — 3 lead-approved §7 corrections; `typecheck` 14 = **10 frontend** (the contract boundary, by design) + **4 backend** (composite verbs, held for frontend's signal) |
| S1c — keystones `DM3·B4` + `DM3·X3` | backend | ✅ green (`47e37ed`) — neither could be red-first (both pin existing behaviour), so **both twins were RUN**: twin 1 reds `X3a`+`B4` (2/50), twin 2 reds `X3b` **alone** (1/50) |
| S1d — composite deletion + §7 process note | backend | ✅ landed (`9167497`) — **typecheck 0**, lint 5/5, `330` **50/50**, `328` **128/128** |
| S2 — frontend: upload + download cutover, field swap, charter gate, dead-component removal | frontend | ✅ landed (`ef62e1b` + `de21b87`) — all 3 wizard modes orchestrate client-side; lint 5/5, vitest **1258/1258**. ⚠ **`createDraftOnly` SURVIVES** (minus its `if (hasFile)` block) — it is the wizard's step 1 and the only verb returning `{documentId, versionId}`; **3 verbs die, not 4** |
| S1e — P0 remediation: M8/M9/M10 + `DM3·R3` twins + repo-wide removal sweep | backend | ✅ landed (`5a7c684`) — pgTAP **190f/6150 PASS** |
| S1f — register the 4 new DEFINER doors (census domain + findings file) | backend | 🟢 in progress — **lead runs the arms**, not the registrar (an arm run by the hand that registered the door is not independent) |
| S3 — tester: the BYTE ROUND TRIP + lifecycle + prior-version E2E | tester | ✅ **GREEN** (`0c10b9b`+`ce85b4c`, ancestors verified) — **47 collected / 47 ran / 47 passed / 0 skipped** on a fresh reset; **NO bug filed, no application defect found** (all 9 baseline reds tester-owned: 7 stale locators + 2 worker interference) |
| S3b — full `e2e:prod` gate (lead-run) | lead | ✅ **GATE GREEN** — 1102 passed · 0 failed · 0 infra · 2 flaky · **0 did-not-run** · 18 batches; **accounting closes exactly**: 1102+0+2 = 1104 accounted, +6 skipped = **1110 = collected**, every batch `accounted N/N` |
| S4 — QA review r1 | qa | ⛔ **CHANGES REQUESTED** — 0 P0 · **1 MAJOR (blocking)** · 4 MINOR · 5 INFO. [review](docs/reviews/dm3-controlled-documents-review.md) |
| S4b — MAJOR-1 remediation (M11) | backend | ✅ landed (`5b35003`) — assert moved to `begin_document_upload`, **home-type-scoped**; `DM3·T3` **red-first** ("caught: no exception"), twin reds `T3` **and only** `T3`; `T3b` control keeps Wave A alive |
| S4c — re-gate (lead) | lead | 🟢 in progress |
| S4 — QA review | qa | ⬜ not started |
| S5 — gate + approval | lead | ⬜ not started |

**Rulings made at plan approval** (detail: ADR 0114 Amdt 2, corrected `57da0ce`):
- **Ethics letters home on the `case` securable resource, never `controlled_document`** —
  three catalog facts each force it alone. Lead-ruled, not sent to the PO, because it
  follows necessarily from the ratified Amendment-2 text and the alternative is
  affirmatively unsafe (it silently deletes the D15 ceiling via `HC0D6`).
- Backfill fileless core versions **1:1**; the domain-side pointer is **outside D10**
  (which governs the core *file binding*) — **conditional on R2**; **both**
  `controlled_documents_obj_*` policies dropped (the INSERT one bypasses
  `begin_document_upload` entirely); production **not** re-measured during DM3, with
  re-measurement a **precondition of DM5's manifest and any `db push`**; charter screen
  gates on `charters && controlled_docs`.

**Lead's two binding conditions on the plan:**
- **R1** — `330` reuses the labels **K8a/K8b/K8c**, which already mean *referral / RCA /
  ethics seam* in `328` and which **DM4 and Wave D still cite by name**. Renumber `330`'s
  trio. (The plan diagnoses this exact class one section later.)
- **R2** — Q3's approval is conditional on a keystone pinning that the domain pointer
  **cannot move once the version leaves draft**, proven able to fail. Unpinned, "mutable
  while draft" is an intention, and the failure mode is swapping the file under an
  already-approved document — the class D10 exists to prevent, re-entering through the
  door just ruled open.

⚠ **Corrections the census forced in binding text the LEAD authored** — both verified
independently before amending: (1) "remove keystone K8" named **three** sub-keystones and
would have deleted DM4's and Wave D's parked-seam pins; (2) conditions 2 and 5 need
**opposite** treatments — `issue_ethics_notification` keeps its 8-arg identity
(`CREATE OR REPLACE`, ACL preserved) while `set_ethics_decision_details` has 11 args with
**10 `DEFAULT NULL`**, so `CREATE OR REPLACE` mints an **overload** and the live 11-arg
call becomes ambiguous (`42725`) — it needs `DROP`+`CREATE`+**re-GRANT**.
⚠ **A lead over-claim was corrected by backend and the correction adopted:** "exactly one
audit row per download" is wrong — the D11 floor does not log a creator's own
standard-tier open. Contract: non-creator → 1, creator → **0 deliberately**, denial → 0.

**Build findings so far (S1):**
- **Two real holes caught red-first, both "caught: no exception"** — `reclassify_document(<controlled doc>, 'phi')` genuinely **succeeded** (`DM3·T1`), and a direct `INSERT` linking *another case's* document into `ethics_notifications` genuinely **succeeded** (`DM3·E2`). T1 is the direct payoff of the M2/M6 split: merged, that keystone would have been **born green**.
- **M4 absorbed two routines a column drop would have broken at RUNTIME, silently** — `submit_document_for_approval`'s has-a-file precondition and `decide_document_approval_core`'s **e-signature hash basis**. A column drop does not fail a function that references it. The hash stays bound to an immutable storage path rather than `file_objects.sha256`: changing the basis of an existing e-signature is a **semantic change to a signing artifact**, not a refactor → **FUP-DM3-SIGBASIS**.
- **Three vacuity/false-positive finds in the backend's OWN work**, all the same shape — *a check that passes for a reason unrelated to the property*: `proacl::text like '%=X/postgres,%'` matches **every** ordinary grant (failed closed here; the identical shape fails **open** just as easily) · `prosrc like '%in_controlled_docs_rpc%'` returns **true because the comment saying it deliberately does NOT read the GUC contains the string** · a clearance-destroying probe ordered before `DM3·E5`, so E5 failed for the **fixture's** reason, not the product's.
- **M3 failed first run on `HC089`** — a migration runs *outside* the RPC corridor, so the sibling guard was armed against the backfill. The bypass the backfill must use is the one the new freeze trigger **deliberately refuses to inherit**; that reads like an inconsistency and is the whole design. A future "harmonizing" edit would silently reopen D10.
- ⚠ `seed.sql`'s `documents_wave_b` line and `328` K9b/K9c are **one artifact**. K8a/K8b **survive** for DM4/Wave D with their reasoning left in place. `app.can_write_document` diverges between session claims and a literal uid (act-as, ADR 0106/0107) — a manual psql probe is **not** representative of `test_helpers.claims_for`.
- ⚠ The M7 trigger fix was hand-applied to local, then re-applied byte-exact from the migration file. **A fresh `supabase db reset` at gate step 1 is still required** to prove the chain end-to-end — it is also where `193`/`194` get measured for FUP-PGTAP-SAVEPOINT.

### ⛔→✅ QA MAJOR-1 — the flag gated the LAST STEP of the corridor, not the corridor

**The untested arm held the defect.** `documents_wave_b` was checked by exactly **one** function
(`attach_controlled_document_version_file`), and `documentsWaveBEnabled()` — added by DM3 — had
**zero callers** in `src/`. QA's live probe with the flag OFF (rolled-back txn, as `chefe.ccih`):
`create_controlled_document` **ACCEPTED** · `begin_document_upload` **ACCEPTED** · `attach_…`
**REFUSED HC0D7**. So a coordinator still created the document, reserved a path, **PUT real bytes
into `documents-standard`**, and finalized — leaving **orphaned bytes + an orphaned core version
+ a draft whose file never appears**. Lead- and backend-confirmed from the catalog independently
before the fix.

**Not an authz hole** (QA verified authority unchanged: outside approver reads but cannot write,
`42501` at the door; plain member and outside approver both `P0002` at `begin`). A **flag-contract**
defect — and the tree **asserted the opposite in two places**, `seed.sql` and
`src/lib/documents/actions.ts:87` (*"which every DM3 door calls (HC0D7)"*).

⚠ **The sharpest stale-comment instance of the phase, and the author named why:** *"I wrote
'every DM3 door calls it' while having added the assert to exactly one door, in the same phase.
**The claim was general where my knowledge was specific.**"* Both comments now name the two
asserting doors **and** record that "every door" is not the target state either — the gate is
deliberately scoped so Wave A keeps working. *A claim kept narrow enough to stay true is the
correction; a more emphatic claim is not.*

**Fix (M11) — placed by argument, not by convenience.** The assert went to
**`begin_document_upload`**, because reserving the path is **the first step that produces
residue**: before it nothing exists; after it a file object, an upload session and a signed PUT
credential all do. Gating `finalize` is too late (bytes have landed); gating only `create` leaves
the corridor open to anyone holding a document id. **Scoped to the home type, not blanket** —
`begin_document_upload` serves every home, so a top-of-door assert would satisfy the new keystone
while **silently killing Wave A**; `DM3·T3b` is the control that catches exactly that. `DM3·T3`
authored **red-first** ("caught: no exception"); its twin reds `T3` **and only** `T3`.

⚠ **Stated choice, not an assumption** (backend raised it; lead ruling): the `documents_wave_b`-OFF
arm is covered by **pgTAP `DM3·T3`/`T3b` only**, not by E2E — exercising it in E2E means flipping a
shared-stack flag mid-run, which would race every other spec. **This is the second finding that
gap has produced**, so it is recorded as a decision rather than left implicit.

### ✅ DIFF-SCOPED DOOR SWEEP — `BLIND: 0`; the one `ERROR` resolved by reading the runlog

Case list **derived from the migration diff, never by hand** (ADR 0079 Amdt 1 recipe over
`4c6f7d9..HEAD`): exactly two gates, `can_read_document` and `can_write_document`; **no policies
created** by the diff. Baseline green before mutating (`Files=190 Tests=6150 PASS`).

| gate | verdict |
| --- | --- |
| `app.can_read_document` | **COVERED** — noticed by 9 suites (`144`,`171`,`228`,`229`,`311`,`314`,`328`,`329`,`330`) |
| `app.can_write_document` | `ERROR run-shape!=baseline (Files=190 Tests=6109)` → **substantively COVERED** |

⚠ **`ERROR` is not a pass (§6), so it was resolved rather than recorded.** Reading the runlog —
per *[`ERROR|run-shape!=baseline` ≠ unswept — read the runlog]* — neutralizing
`can_write_document` produced **14 failures across 5 suites**: `229` (48, 62, 67–68), `231`
(57, 77), `314` (47), `328` (52–53), `329` (13–14, 59, 61, 72). **The suite noticed loudly.** The
`ERROR` is a *harness classification* artifact: `329` **aborted** (`exit 3`, `Bad plan: planned
115 but ran 74`), so the run shape differed from baseline and the harness could not compare
like-for-like. Blindness was never in question — `BLIND: 0`.

⚠ **New follow-up — `FUP-329-ABORT-SHAPE`:** `329` carries a keystone whose failure **ends the
file**, dropping **41** subsequent assertions. It cost nothing here (the gate was still seen), but
it is what makes a mutation run over these gates **unclassifiable** rather than COVERED, and it
will do so on every future sweep. Same class as the B4 lesson the backend fixed in `330` — *a
keystone whose red takes the rest of the suite with it is one you cannot read* — one suite over,
and now with a measured cost.

⚠ **The documented sweep hazard recurred and was handled:** the subset run **overwrote the
committed findings md, truncating it 594 → 38 lines**. Restored via `git checkout --` per
lead-playbook §4; tree verified clean afterwards. Every phase that skips that restore silently
destroys the audit record and makes the next full sweep read as a mass regression.

### ⭐ THE BYTE ROUND TRIP IS PROVEN — the one thing DM3 had never established

`DM3B-1` drives the **real browser corridor** and asserts **byte equality**, not "a file
downloads": an object exists at the reserved coordinate with `storage.objects` metadata size ==
the uploaded length → `finalize` **derived** `size_bytes`/`mime_type`/`sha256` from what landed
(`unscanned_accepted`, `standard` tier, `documents-standard`) → the door signs it back →
**`Buffer.compare(returned, uploaded) === 0`** plus sha256 and a unique marker.

**Derivation is proven, not assumed:** `DM3B-2` **declares a lie at `begin`** (1 byte,
`text/plain`), PUTs a real PDF, and requires the truth to win. Everything before this slice was a
DB-layer proof or an **absence** proof; this is the first evidence the replacement corridor
*works* rather than that the old one is gone.

**Where the tester refused a green** (the standard this phase has held throughout):
- ⚠ **`DM3B-8` first passed for the WRONG reason** — a `created_by` NOT NULL fired **before** the
  UNIQUE ever ran. The insert now copies every other column from the incumbent row, so the
  duplicated coordinate is the only thing wrong with it, and it names
  `file_objects_bucket_path_uniq`. (*wanted X, caught `<code>` ⇒ chase the fixture.*)
- **`DM3B-4` takes a BEFORE-SHOT**: the same non-member is refused `P0002` **before** being named
  approver and served **after** — which makes the arm the *cause* rather than a coincidence. Its
  negative twin (approver on a *different* document) pins exact SQLSTATE + message and asserts
  no leakage; her own document refuses with a **different** code (`HC0D8`), proving the first
  denial was authorization and not a generic no.
- **AC-7 re-pointed but labelled in-file as green BY CONSTRUCTION**; the falsifiable version is
  `DM3B-8`. **AC-11 kept but NOT credited** — its `storage_path` clause is now vacuous on the new
  door.

**Two observations, neither a DM3 regression:** `open_document_version` refusals surface as
**HTTP 500, not 404** (measured `{"code":"P0002"}` / `HTTP_STATUS=500`) — pre-existing DM2
transport behaviour, so the spec pins code+message and only `status >= 400`, since encoding 500
would make a PostgREST detail into a DM3 contract. And **AC-13's keyboard assertion is a
positional Tab count coupled to REGISTER ROW COUNT** — red at 56 accumulated documents against a
60-press budget; raised to 240, but **a green AC-13 is meaningful only on a fresh reset** and will
drift again the moment the seed gains a document.

**Gaps the tester stated rather than reported around:** the **`documents_wave_b`-OFF arm** of the
charter affordance (Q6) was not exercised (flipping a shared-stack flag mid-run would have raced
the other specs) · the 47 are a **scoped quick loop, not the gate** (`e2e:prod` is lead-run) ·
the new spec adds **~14 documents per run** to commission A, feeding the AC-13 accumulation.

### ✅ AUTHZ ARMS — all four HOLD (lead-run 2026-08-13, registration by backend: the split was deliberate)

`ARM=census` **HOLDS** (569 gates carry a verdict; no unswept newcomer) · `ARM=hat` **HOLDS**
(3 findings, all reasoned-allowlisted) · `FROMFINDINGS=1 ARM=wrapper` **HOLDS** (BLIND 41, all
allowlisted) · `ARM=floor` **HOLDS** (every never-called door on the floor allowlist).

⛔ **READ THE SCOPE BEFORE CITING THESE.** A green census is **SILENT** on DM3's principal new
door, not supportive. Lead-verified from the catalog:
`attach_controlled_document_version_file` is **`prosecdef=t`, NOT `proretset`, returns the
composite `controlled_document_versions`, lives in `public`, and carries EXECUTE to
`authenticated`** — PostgREST-reachable, and **in no BLINDNESS-DETECTING arm's domain**.
⚠ **Corrected by QA (MINOR-1), verified by the lead:** *"in no arm's domain"* is **measurably
false** — `ARM=floor`'s domain is every `public` `prosecdef` function EXECUTE-able by
`authenticated`, **411 signatures**, and it contains **both** this door and
`open_document_version`. But ARM 2 asks only *"is the door called?"*, never *"does anything
notice when it is opened?"* — so **the conclusion below stands and only the reason was wrong.**
The same imprecision is inherited from DM2 (ADR 0118 §12) and appears in `backend-state.md` and
the DM3 plan; corrected there too. Its own
`app.is_staff_admin_of` check **is** the entire boundary. It is pinned **behaviourally**
(`330 DM3·P1/P1b/P1c`, `314 §10.3`) — **by keystones, not by any arm.**

### 🔴 THE CENSUS DOMAIN'S THIRD MEASURED EDGE — **146 DEFINER doors no arm can see** (PO decision)

Lead-verified count: **146** functions that are `prosecdef`, composite-returning, non-`proretset`,
and EXECUTE-able by `authenticated`. The census domain is **273 signatures and DM3 contributes 0**
— the domain's clauses are bounded by **return type** (`bool`, or `proretset` + auth-EXECUTE, or
`public` INVOKER plpgsql), so a composite-returning DEFINER is outside all of them. **Not a DM3
regression — the class predates it (ADR 0118 §12) — but DM3 added one to it**, inherited from
`set_document_version_file`, which was in the same class.

⚠ **This is the THIRD measured edge on that file**, after the INVOKER-wrapper class and the
row-returning doors BUG-AUTHZ-002 exposed — **and each previous edge was found by a live leak
rather than by counting.** That is the argument for scheduling the widening: this one was found by
counting, which is the cheap way to find it. **PO decision, not a phase decision** — widening the
domain admits ~146 previously-unswept doors to the LIVE set at once, none carrying a verdict, so
`ARM=census` would red on ~145 pre-existing doors immediately. A backlog to schedule, not a gate to
trip mid-phase.

⚠ **A fourth `enumeration-bounded-by-location` instance, same phase:** `ARM=wrapper`'s INVOKER
clause is bounded by `nspname = 'public'`, so `app.assert_documents_wave_b_enabled` (INVOKER,
schema `app`, auth-EXECUTE — lead-verified) is invisible to it.

**Backend refused two shortcuts, and both refusals were right.** (1) **No findings-md row** — a
findings verdict means *a neutralization sweep ran and this is what it said*; none has, so a row
would be **a verdict nobody earned**, which is the exact fabrication the census exists to prevent
and worse than an admitted gap. (2) **No domain widening mid-phase.** All six new functions went
into `authz-unswept-backlog.txt` (*"we have never swept it, so we do not know"*) and **not** the
BLIND allowlist (*"we swept it and nothing noticed"*) — the same distinction that made the stale
allowlist entry below dangerous.
⚠ **It was SIX new functions, not the four backend first reported** — the first list came from
recall rather than the catalog, and the two missed included the INVOKER one. Same class as the
four short counts in the frontend thread, now six landings this phase.

### 🔴 A STALE ALLOWLIST ENTRY PRE-EXCUSES A FUTURE DOOR — found by the repo-wide removal sweep

`supabase/tests/mutation/authz-blind-allowlist.txt` still named **`app.can_read_document_object`**,
which **M5 dropped** along with the policy it served. **The allowlist is where a door is *excused*
from the BLIND check** — so an entry naming a dropped function **pre-excuses any future function
that reclaims the name.** A hole that opens silently, years later, for whoever picks the natural
name, and invisible in every direction: no test fails, no gate reds, the entry reads as
maintained configuration. Pruned.

⚠ **This is the payoff for widening the sweep, and it settles that argument empirically.** The
lead predicted only the mutation-script chore; **neither lead nor backend listed the allowlist**.
A removal-set sweep bounded by `src/**` — the boundary actually used earlier in the phase — would
have missed **the only finding that had teeth**. Fifth landing of *an enumeration bounded by a
location cannot enforce a property*, and the first where the miss was dangerous rather than
untidy.

**`DM3·R3` is now falsifiable — and twin B's construction is itself a finding.** Twin A (kill the
door's core-document minting) reds `R3c`+`X1`, 2/55. Twin B had to neutralize registry minting on
**both** sides — the M9 trigger *and* the M8 door's belt-and-braces insert — because **with either
alone neutralized `R3` stays green**: two sufficient mechanisms, only both-off reproduces the P0.
Third appearance of *two barriers, one behaviour* this phase; a single twin would have certified a
keystone that cannot fail. Twin B's own first draft **failed its own `if mutated = src then raise`
guard** on whitespace drift — the guard earning its keep on the twin that needed it. `R3e` added as
`R3d`'s positive control (*"one row with a null pointer" is otherwise satisfiable by counting
nothing*).

### ✅ GATE STEP 1 — **GREEN**, lead-verified independently (2026-08-13)

Re-ran `supabase db reset --local` + the full pgTAP suite myself rather than accepting the
report: **`RESET_EXIT=0` · `PGTAP_EXIT=0` · `Files=190, Tests=6149` · 0 `not ok` · 0 bad plans ·
`All tests successful` · `Result: PASS`.** Backend's figures reproduce exactly.
This run is also the **FUP-PGTAP-SAVEPOINT measurement** — `193` **ok**, `194` **ok** — which
**refuted** the lead's own 🔴 filing (see the Follow-ups index).

Still outstanding for the phase gate: the four authz arms + the diff-scoped door sweep, then
tester (step 2) and QA (step 3).

### 🔴 P0-DM3-1 — the CREATE door never satisfied M1's own FK. **The seed failure was the symptom, not the defect**

**Found by the mandatory fresh-reset gate step**, and it is the strongest argument for that step
the program has produced. M1 added
`controlled_documents_securable_resource_fk (id, securable_type) → securable_resources(id, resource_type)`
**and backfilled the existing rows — but never taught the CREATE path to satisfy it.** So **since
M1, every attempt to create a controlled document has raised 23503** — *the product's create
wizard*, not merely `seed.sql`. Fixed by **M8**
(`20260925000800_dm3_create_door_mints_registry.sql`): the create door now mints the registry row.

⚠ **The lead's own RED diagnosis was one level too shallow** — recorded because the shallow
version reads as complete. "Three raw insert sites in `seed.sql` lack registry rows" is *true*
and would have produced a *fix that works*: patch the seed, reset goes green, gate passes, and
**the create wizard stays broken in production**. The seed was simply the first caller to run
after the FK existed. **When a fixture violates a new constraint, ask what else writes that
table before patching the fixture** — a fixture is a caller, and callers come in families.

### ⚠ LEAD ERROR — `git add -A` swept backend's in-progress work into three docs commits

`94fc3f0`, `f7265bd` and `0b6706d` carry `docs(dm3):` subjects but **also contain backend's live
work**: the new **M8 migration** (119 lines), the `seed.sql` rewrite (~170 lines across the
three), and `330` edits (90 lines). Nothing is lost or broken — the work is committed and the
tip is correct — but **three commit messages materially misdescribe their contents**.

⛔ **History is NOT rewritten** (other sessions live on this branch; standing rule). This entry
is the correction of record.

**This is the same class the lead had just written up twice** — *a commit's own output is not a
safe report of what it committed* — and the same standing rule the lead had just issued to
frontend after the 613-file incident: **stage explicitly; never `git add -A`**. Issuing a rule
is not applying it. Cf. [the proposal you author is the one you don't test] — the rule you write
for others is the one you exempt yourself from. **Lead practice changed: explicit path staging
only.**

### ⛔ GATE STEP 1 — **RED**. `supabase db reset` FAILS (2026-08-13, lead-run)

```
RESET_EXIT=1 · Seeding data from supabase/seed.sql...
ERROR: insert or update on table "controlled_documents" violates foreign key
constraint "controlled_documents_securable_resource_fk" (SQLSTATE 23503)
```
**Fails at SEEDING, not migration** — all 7 DM3 migrations applied cleanly. Three raw insert
sites in `seed.sql` (**`:2582`, `:2612`, `:2864`**) create controlled documents with **no
`securable_resources` row**, against
`FK (id, securable_type) REFERENCES securable_resources(id, resource_type)`.

⚠ **Why nothing caught it: M3's BACKFILL MASKED IT.** Migrations were applied incrementally to
a DB that *already held* the seeded rows, so the backfill minted their registry rows. A fresh
reset inverts that — migrations hit an **empty** DB (backfill finds nothing), then `seed.sql`
inserts **new** documents that must satisfy the FK unaided. **The backfill and the seed can
each be correct while the pair is broken.** The recorded rule, earned again: *the migration
chain and `seed.sql` are ONE artifact* — and `seed.sql` is a contract with ~900 tests.
Returned to backend with the instruction **not to stop at the constraint that fired** — the FK
is the first invariant to reject the row, not necessarily the only one DM3 added.

⚠ **The pgTAP numbers from that run are VOID** — the suite ran against a half-seeded DB, so its
fifteen `planned N but ran 0` lines are **artifacts of the failed seed** and are **NOT**
evidence for FUP-PGTAP-SAVEPOINT. That measurement remains outstanding.

**Two gate lessons from the composite deletion (`9167497`):**
- ⚠ **`typecheck` hit 0 with three dead symbols still present** — `uploadDocumentFile`,
  `MAX_DOCUMENT_BYTES` and the MIME→extension map, all mirroring the retired bucket. **eslint
  caught them, typecheck did not.** "0 typecheck errors" is not a safe stopping point for a
  deletion; the five-gate `npm run lint` is what closes it.
- ⚠ **The deletion set was verified from the CODE, not from the lead's message — and the
  message was wrong.** Enumerating every caller of all 16 exported verbs showed the three
  doomed verbs had **6 references, all comments, zero call sites**, while `createDraftOnly`
  had a real import. It also showed *why* "four" was wrong: `supersedeDocument` **and**
  `supersedeAndSubmitDocument` both exist and frontend calls the former — **two names
  collapsed into one is how a live verb gets deleted.**

**S2 findings (frontend, `ef62e1b` · `de21b87` · `7cbe6b7`):**
- ⚠ **A real defect caught only by a RUNTIME check — no gate would have seen it.** Moving the
  wizard chain client-side made step *ordering* frontend's responsibility, and the size/MIME
  validation ended up **inside `attachFile`** — i.e. **after** create/supersede had already
  run. The retired server action validated **up front** precisely to avoid orphan drafts, so
  an oversized file would have left a created document plus an empty draft. Fixed in
  `7cbe6b7`. *A responsibility that moves layers does not announce that it moved.*
- ⚠ **A label reversed on evidence — and the first reasoning was wrong for a subtle reason.**
  Frontend had declined to reword Wave A's `pending`, arguing one state should not carry two
  names across waves; backend agreed. The screens then showed both seeded documents rendering
  `pending` with a **non-null** pointer, because **M3's backfill binds every version to a
  deliberately fileless core version** — so "Processando envio" told coordinators to wait for
  an upload that never happened. Wave A's `pending` can arise **only** from a real upload;
  Wave B's also covers backfilled versions, **a state Wave A cannot reach**. Two state *sets*
  sharing one label, not one state with two names → **"Aguardando arquivo"**.
- A page header claiming the **storage SELECT policy carried the approver arm** was rewritten —
  false since M5; that access moved to the kernel. Another instance of the class below.
- Submit affordance gates on **`availability === 'available'`** — the only state meaning the
  door will hand over bytes, read from the **shared** predicate rather than a parallel opinion,
  and pinned executably by `DM3·X3b`.
- ⚠ **Not verified: the byte round trip.** No seeded version has bytes, so every controlled
  document renders `pending`; upload/download success paths are **tester's**, with
  `documents_wave_b` on.

⚠ **STALE-COMMENT CLASS — 5th, 6th … instance this phase; the deletion alone stranded 8.**
Two were backend's (fixed): `supersedeDocument`'s doc told the frontend to upload *"via
`addDocumentVersion`"* — **a deleted verb, in the doc of a verb they actively call** — and a
section header still described the full retired chain. Six are in frontend's page/wizard
headers (list handed over, not edited across the ownership line). **The pattern is now stable
enough to name: a deletion strands every comment that referenced it, and NO gate sees any of
them.** → **FUP-LINT-STALE-SYMBOL-COMMENT**.

### ⚠ INCIDENT (2026-08-13) — `supabase/` left the index; 613 files deleted from HEAD, all recovered

**Recovered in full, lead-verified rather than accepted.** Counts of tracked files under
`supabase/`: `226bfb9`/`d75883b` **613** → **`ef62e1b` 0** → `47e37ed` 1 → `d53d083` **613** →
HEAD **613**. All 7 DM3 migrations present at HEAD; `git status` clean; and
`git diff --stat c055e41 HEAD -- supabase/` is **exactly one** changed file — `330` at
+114/−1, precisely the intended B4/X3 addition. **Nothing was lost and nothing drifted:** the
working tree was intact throughout (files showed `??`, never deleted).

⛔ **ATTRIBUTION CORRECTED — `d53d083`'s commit message is WRONG and cannot be edited.** It
says *"612 files were dropped by `47e37ed`"*. `47e37ed` is where the absence became **visible**
(it re-added 1 file, its own `330`). The commit that dropped them is **`ef62e1b`**, and its
author identified and reported it. History is deliberately **not** rewritten — other sessions
are active on this branch, and amending another session's commit is a recorded scar. This
entry is the correction of record; a reader auditing the branch from commit messages alone
would otherwise start from a false premise about the wrong teammate's work.

**Cause — now KNOWN** (it was reported as "not established", which was true of the reporter):
staging a slice, `git add -A src/components src/app` was followed by
`git rm --cached -r --ignore-unmatch supabase` intending to keep one file out of the commit.
Two things made that catastrophic:
1. ⚠ **`git rm --cached -r <dir>` does NOT "unstage" — it stages a DELETION of every tracked
   file under that directory.** `git commit` then reads the index and commits all 613.
   (The target file was already unstaged — ` M`, not `M ` — so the command was unnecessary
   as well as wrong.)
2. **Its output was piped to `/dev/null`**, discarding the 613 lines that would have said so.

⚠ **The reusable lesson: a commit's own output is not a safe report of what it committed.**
`ef62e1b`'s `--stat` read as an ordinary 3-file change while silently carrying 612 deletions.
Only `git status --short` exposed it, and only because it happened to be appended to that
command. **Standing rule: stage explicitly (`git add <paths>`), never send a `git rm` through
`/dev/null`, and check `git ls-tree -r --name-only HEAD | wc -l` after any commit that touched
the index broadly.**

**Three §7 corrections, all lead-approved** (`d75883b`) — none moved a signature frontend was
already building against:
1. ⚠ **`beginControlledVersionUpload` had to return `uploadSessionId`.** `finalize` is keyed on
   the **session**, not the version, so **§7 as approved was not merely incomplete — it was
   UNCALLABLE.** Neither the lead nor the plan review caught it; it surfaced only because
   backend tried to *use* the contract rather than just implement it. **Process note for the
   next phase's contract review: trace one full call chain through the posted signatures.**
2. `finalize` returns `AddVersionState` + `terminal?: boolean`, carrying DM2's MAJOR-3 through
   so the dialog cannot offer a retry on a spent reservation.
3. **`ControlledDocument.coreDocumentId` DROPPED** — `list_commission_documents` is a DEFINER
   rollup that does not return the column, so every list row would have carried `null`, reading
   as *"this document has no core document"* rather than *"this projection doesn't carry it."*
   Same false-for-an-unrelated-reason shape as the vacuity finds — but this one would have been
   read by a **human**, not a test.

**Availability is ONE shared predicate, not a Wave-B copy.** Backend extracted Wave A's
`documentVersionAvailability` and wrote it to match `open_document_version` branch for branch,
so `availability === 'available'` means *"the door would serve these bytes right now"* — the
value frontend gates the submit affordance on. Two copies drift **silently, because both still
typecheck**; no gate catches a UI predicate that has diverged from the door it mirrors. That is
exactly why `DM3·X3` (projection ↔ door agreement) was ordered written **now**: it is currently
asserted in a **comment**, and prose cannot fail. `DM3·B4` was ordered now for a different
reason — it pins a **DM3 exit criterion** (prior-version download), and an exit criterion
deferred behind another teammate's landing is one that can be lost.

⚠ **Stale-comment class: the instance count was 2, not 1.** Frontend flagged
`SupersedeDocumentButton` in `src/lib/responses/actions.ts`; backend found
`queries/controlled-documents.ts`'s header still advertising *"Storage reads are signed-URL
only, minted server-side (`createSignedDownloadUrl`)"* — **describing the exact byte path M5
deleted**. A found-instance list from whoever tripped over it is a starting point, never the
population (cf. `328`'s eleven collisions vs three; `193` alongside `194`).

**Lead ruling — the create-wizard's terminal step (frontend escalation, Q-A/B/C).** Plan §7
posted a contract for **one** upload path, but M4 kills **five** `p_storage_path` call sites;
the other four are the wizard's composites. They cannot survive: `begin` needs
`{commissionId, documentId, versionId}`, so **"create + upload + submit" is not expressible
atomically on the DM2 substrate**, whichever layer orchestrates it. Ruled: the wizard moves to
a **client-orchestrated chain**; backend adds `versionId?` to `CreateDocumentState` (verified
first — `create_controlled_document` returns the whole row, `controlled_documents` carries
`current_version_id`, and `actions.ts:609-610` already reads and **discards** it); the three
composite verbs are then **deleted**. Rejected: keeping them alive on an `uploadSessionId`
param — still not atomic, so it preserves four byte-adjacent verbs that only *look* like a
transaction and that DM5's exit sweep would have to reason about.
⚠ **Named so it is not later discovered as a regression:** partial failure is *already* a
designed, recoverable state (server returns `documentId` + banner), so client orchestration
does **not** introduce it. What widens is the **abandonment** surface — closing the tab between
`begin` and `finalize` leaves a created draft + an unfinalized upload session. That is the DM2
`failed`/`abandoned` state: **new to this surface, not to the platform, already reconciled.**
Tester covers it; QA should not file it as new.
Q-B: the partial-failure banner decision moves to the component layer, on four conditions —
the `aviso` value set stays **enumerated** (growing it is a lead call) · branch on the failed
step + `DocumentActionErrorCode`, **never message text** · ⛔ no comment claiming a client
branch is a control (the DM2 P0 / r2-1 class) · the failure message must actually **render**
(Radix `AlertDialogAction` unmounts on click).
Q-C: the wizard stays in S2, **sequenced** after backend's field, with standing latitude for
frontend to stop at that boundary and split if it proves larger than the ruling assumes.

**Lead ruling — the TS cutover crosses a file-ownership boundary: option 1 (contract-first).**
The five `set_document_version_file` call sites change *shape*, not just call: server-side
`FormData` upload → the DM2 client-upload flow, which changes the component contract.
Backend posts + lands the signatures in `src/lib/**`; **frontend** does the component
cutover; `typecheck` stays RED at 6 until S2 lands, deliberately. **Option 3 (a thin
server-side compat path) was rejected** — it would install a **second byte-writing path
beside the DM2 corridor in the phase whose purpose is collapsing them to one**: a temporary
red bar is a schedule cost, a second write path is an architecture cost that outlives the
phase. Option 2 (backend takes frontend's files) breaks §4 ownership for speed — the exact
trade the contract-first rule exists to prevent.

### ✅ COMPLETE — **DM2: orchestration + Wave A** (opened + completed 2026-08-13)

> ✅ **PO-APPROVED 2026-08-13 — all five §6 gate steps passed.** QA **r2 = APPROVED**
> (0 P0 · 0 MAJOR · 1 MINOR · 4 INFO) after r1's ⛔ CHANGES REQUESTED (1 P0 · 3 MAJOR ·
> 6 MINOR · 4 INFO) was fully discharged. The binding pre-merge condition **r2-1 is
> closed** (`d46bb87` + `36deda5`).
> **Gate:** pgTAP **189f/6097** · lint 5-gate · tsc 0 · vitest 86/1258 · `ARM=census`
> (*has anything ever asked?*) / `ARM=hat` (*any door reading `memberships` hatless?*) /
> `ARM=floor` (*is every door called?*) / `FROMFINDINGS=1 ARM=wrapper` — **all HOLD** ·
> diff-scoped door sweep `app.can_read_document` **COVERED** (case list derived from the
> diff; 1 case actually run) · `e2e:prod` **GREEN** (1091 passed · 0 did-not-run ·
> coverage 1093/1099 = the 6 skips).
> ⚠ **`open_document_version` is in NO authz arm's domain** (it returns `jsonb`) — that is
> ADR 0118 §12's standing blind spot, not a DM2 regression. Its assurance is pgTAP `329`
> P0a–P0f + the `308` 5.2s sentinel, **not** the sweep. Do not read the sweep as covering it.
> ⚠ **`e2e:prod` run 1 was RED** on `pdf-printing.spec.ts:38` — ruled **not
> phase-attributable** (outside the DM2 diff; three `RETRIES=0` passes), but the
> **mechanism is UNPROVEN** and both evidence artifacts were destroyed by re-running →
> **FUP-GATE-PDFP1-FLAKE**.
> ⛔ **State:** branch `docs/dm1-plan-amendments` — **NOT merged to `main`, nothing
> pushed, no `db push`** (standing PO directive; `main`/`origin/main` = `f84c6b6`).
> **All five DM flags ship OFF** (migration `20260923000600`; `seed.sql` forces
> `documents_foundation` + `documents_wave_a` ON for local/E2E only). graphify refresh
> deliberately **SKIPPED** — it fires after a merge to `main`, which has not happened.
>
> **Full detail rotated →
> [dm2-orchestration-wave-a.md](docs/progress/dm2-orchestration-wave-a.md)** (slice table
> S1–S5, all three remediation sessions, the re-gate record, and the browser-verification
> block). Program: plan [DM0–DM5](docs/plans/document-model-redesign.md) · ADR
> [0114](docs/decisions/0114-document-model-redesign.md) +Amdt 1 · **0117** +Amdt 1
> (interview ceiling) · **0118** (command layer; §10 predicate pin, §12 blind spot).
>
> **Open with the PO — do not assume:** ~~plan **Q1**~~ ✅ **RULED 2026-08-13 — Wave B
> (DM3)**, ADR 0114 **Amdt 2 / D17** · **S1-O3** uploader visibility · ADR 0114
> O1/O2/O4 · **S2.8** `reclassify_document_file` still has no legal expression on the DM1
> substrate (no Wave A UI consumes it, so deferring stays legitimate).

### ⬛ Recently completed — rotated 2026-08-12; detail in `docs/progress/`

One line each. Gate numbers live in the **Phase Status** table above; the linked record carries the
task table, findings and narrative. "Still open" points at the live sections further down this file.

| Work | Done | Record | Still open (none blocking, tracked below) |
| --- | --- | --- | --- |
| **REG·KIND** — one Registro vocabulary for cases and referrals (PO-directed, post-RDR). Adds `update`/`follow_up` to `case_events.kind`; **replaces the referral's per-commission `referral_note_types` with the SAME six-value `kind`** — table + 2 policies + audit trigger + `reorder_referral_note_types` + 4 server actions + the "Tipos de registro" dialog all DROPPED. Type is now REQUIRED (default `note`). One TS source, `src/lib/cases/registro-kinds.ts`. **No flag — structural** | 2026-08-12 | ADR [0110](docs/decisions/0110-shared-registro-kind-vocabulary.md) (supersedes [0109](docs/decisions/0109-referral-registros-and-case-access-summary.md) **D2** only) · migrations `20260920000100`+`…000200` · `docs/backend-state.md` (referral R5 lines) | ⚠ **NO tester pass and NO QA review** — gate steps 2–4 are unrun by PO direction; the E2E evidence is 2 targeted specs, not `e2e:prod`. ✅ **PUSHED and `db push` DONE** — corrected 2026-08-12 (this read "Committed LOCALLY only — not pushed … remote `db push` is NOT done"; true when written, overtaken by a later push). `9a20c8a` is an ancestor of `origin/main`, and both `20260920000100`/`…000200` are registered on the linked project with `referral_note_types` absent from the remote catalog. Two PRE-EXISTING, not from this work: the door-sweep `ERROR\|run-shape!=baseline` on `can_read_referral_internal_note` (same verdict at HEAD) · `npm run lint` reds on `supabase/.temp/start-secrets/**`, a CLI artifact that is gitignored but not eslint-ignored (first-party scope is 0/0) |
| **RDR** — referral detail page redesign (minimal header + fact rail, Registros internos with ~~per-commission type vocabulary~~ **→ superseded 2026-08-12 by REG·KIND / ADR 0110: the fixed case-Registro `kind` list**, messenger Diálogo with synthesized inline events, 5-group case-access door; **no new flag — reuses `case_referrals`**) · QA APPROVED (r1) · human-approved | 2026-08-12 | [referral-detail-redesign.md](docs/progress/referral-detail-redesign.md) · plan + amendments **A1–A12** [plan](docs/plans/referral-detail-redesign.md) · ADR [0109](docs/decisions/0109-referral-registros-and-case-access-summary.md) · [review](docs/reviews/referral-detail-redesign-review.md) · [locator survey](docs/testing/referral-detail-redesign-locator-survey.md) · `docs/backend-state.md` (RDR) | Fixed 2 pre-existing defects in passing (a NULL-hole authoring gate on DT referrals; a rename orphan that would have silently broken `dispose_referral_phi`'s LGPD path). Open: ~~**MINOR-1** reorder `23505` after archiving a non-last type~~ — **MOOT on the referral side 2026-08-12**: REG·KIND deleted `referral_note_types` and its reorder RPC outright, so the "ONE platform-wide fix" now has only ONE site left, `case_narrative_types`. ✅ **FIXED 2026-08-12** in `20260921000200` + pgTAP `324` (A6's reason was gone once the sibling was deleted). ⚠ The recorded cause was WRONG: the constraint was **already** `DEFERRABLE INITIALLY IMMEDIATE`, so it already shielded intra-statement shuffles — the real defect was an **archived row retaining its `position`** outside `p_ordered_ids`. Fixed by compacting archived rows in the same UPDATE; no schema change · ~~**BUG-RDR-001**~~ ✅ **FIXED 2026-08-12** at the shared layer (`dialog.tsx` + `alert-dialog.tsx`): Radix's `onCloseAutoFocus` calls `preventDefault()` **and** `triggerRef.current?.focus()`, and the `preventDefault()` also cancels `FocusScope`'s own restore — so a null `triggerRef` (every controlled call site) drops focus to `<body>` and BOTH halves must be replaced together. The `test.fail()` pin on KB-3 is dropped in the same batch · ~~**BUG-MIN-E2E-1**~~ ✅ **CLOSED 2026-08-12 — not a defect**: `.env.local`'s `MINUTES_SERVICE_URL` pointed at `:8000` while the spec's own stub binds `127.0.0.1:8891` (`STUB_SERVICE_PORT`), left over from the FUP-MIN-CUTOVER T5 smoke flip and never reverted. Spec now asserts the precondition. · the **door-sweep harness blind spot** (`^(is_\|can_\|has_…)` at `p0-authz-door-audit.sh:176` skips `_`-prefixed names ⇒ swept 4-of-5; affects every future phase). ✅ **Merged and PUSHED** (`81e1dc9`, an ancestor of `origin/main`; corrected 2026-08-12 — this read "Merged LOCALLY only — not pushed"). 🔴 **A11 was CORRECTED by mutation**: the Rule 7 defense is the **absence of `rehype-raw`**, not `rehype-sanitize` |
| **ETH·E4** — ethics participant seating & professional identity (the `participants`-lane writers, the roster UI, T5 org vocabulary admin; **no flag — the seating panel was already mounted and unfillable**) · QA APPROVED (r3) · human-approved | 2026-08-11 | [eth-e4-participant-seating.md](docs/progress/eth-e4-participant-seating.md) · ADR [0108](docs/decisions/0108-eth-e4-participant-seating.md) (+ the D5 amendment) · [review](docs/reviews/eth-e4-review.md) · `docs/backend-state.md` (ETH·E4) | Closes **FUP-ETH-1** + **FUP-FF5-2**; **FUP-ETH-CPF-1** closed in-phase by the P0 column-list grant + DEFINER projection. Open: **FUP-ETH-A11Y-1** · **FUP-E2E-SERVER-DEAD-1** · new **FUP-ETH-ROLES-1**; the two **PO** items (Class-2 audit posture · the three role-less external types) are ✅ **RATIFIED + APPLIED 2026-08-11** — detail in the record's § *Open at completion*. ✅ **Remote `db push` DONE** (verified 2026-08-12 against `azkbbhskturikxpgmafq`): `20260919000100`–`…000600` are registered in `supabase_migrations.schema_migrations` and `professional_participants_profile_uniq` exists in `pg_indexes`. The `professional_profile_id` duplicate check (plan §6 step 3) is **moot** — a unique index that BUILT on the live data is stronger evidence than the pre-check it was gating. A confirming read found 0 duplicate groups over 1 row (non-vacuous: 1 non-null id, 0 nulls) |
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

---

### Completed work (archived to docs/progress/)

> Numbered/named phases with their own Phase Status table row (F3, Administrativo, Phase 17, Phase 15,
> DB-hardening W1+2, Phase B, Phase A, User Registration, Ad-hoc Case Narratives, Answer-Model v2,
> Form-model-norm, Result-rec, NSP-per-org, Processless-cases, Phase 23, Phase 22) are NOT re-listed
> here — the phase table row + its `docs/progress/*.md` link is the durable pointer. This list holds
> only ad-hoc/out-of-phase work that has no Phase Status row of its own.

- **AUDIT-INVOKER-WRAPPER + BUG-REFNOTE-001** (ad-hoc, out-of-phase; backend + test tooling — ADR [0113](docs/decisions/0113-referral-door-return-shape.md) · ADR [0079](docs/decisions/0079-authz-door-blindness-standing-invariant.md) **Amendment 7**) — **(a)** REFNOTE filed as 4 doors, catalog said **23**: narrowed every referral-module door's RETURN to a named composite mirroring its column GRANT (migration `20260922000100`, pgTAP 326). **(b)** ARM 5 — all three prior sweeps begin `and p.prosecdef`, so the 88 `public` INVOKER functions were in **no arm's domain**; new sweep `p0-authz-invoker-audit.sh` + `ARM=wrapper` + census widened **452 → 540** live gates. ⚠ **BLIND ≠ vulnerable in that class** (26 of 47 are RLS-backstopped); the one real leak is the meeting verbs vs an ADR-0061 `schedule_meetings` delegate, keystoned by pgTAP 327. — ✅ **2026-08-12**, `authz-wrapper-refnote` `297d3e2` + `f22ddab` + `a8d457c`. Gate: pgTAP **188 files / 5906** · `census`/`hat`/`floor`/`wrapper` all HOLD · `e2e:prod` 1046p/0f (batch 4 stranded by `server_dead`, re-run 67/67 GREEN). ⚠ **Not QA-reviewed** (§6 step 3 not run — ad-hoc work). Detail → [authz-invoker-wrapper.md](docs/progress/authz-invoker-wrapper.md).
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

ℹ️ **DM3 Wave B gate step 2 filed NO bug** (tester, 2026-08-13) — stated explicitly because a silent
absence and a clean result look identical. All 9 baseline reds were **tester-owned**: 7 stale locators
(the DM3 substrate/affordance move) and 2 worker interference. See the Test Run Summary row for the
per-red triage and for the two non-regression observations (`open_document_version` refusals surface as
**HTTP 500, not 404** — pre-existing DM2 transport behaviour; and **AC-13's Tab budget is coupled to
register row count**, so a green AC-13 is only meaningful on a fresh reset).

✅ **BUG-DM2-001 / -002 / -003** (DM2·S4, all FIXED 2026-08-13) and **BUG-CASEKIND-001**
(pre-existing, FIXED 2026-08-12) — rotated with their full "as filed" bodies →
[bug-log-archive.md](docs/progress/bug-log-archive.md).

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

All closed rows (incl. the one-line table, the 2026-08-03 batch’s method notes, and the
earlier-era pointers) rotated 2026-08-06; each bug’s full entry — repro, fix, lessons — is in
the archive. ⚠ Before touching `buildAnswerMaps`, read BUG-FF4-001 there (the obvious one-line
fix breaks Rule 3 SQL↔TS evaluator parity).

**Rotated 2026-08-12 (the FUP batch):** **BUG-MIN-E2E-1** — closed as **NOT a product defect**: a
stale per-worktree `.env.local` `MINUTES_SERVICE_URL` (`:8000` vs the spec stub's `127.0.0.1:8891`),
left over from the `FUP-MIN-CUTOVER` T5 smoke flip. ⚠ Read it before diagnosing any minutes E2E
failure — the durable fix is the mutation-proven `beforeAll` precondition guard, not the value. ·
**BUG-RDR-001** — fixed at the shared layer for **both** dialog primitives
(`dialog-focus-restore.tsx`). ⚠ Read it before touching Radix dialog focus: it records that
`onCloseAutoFocus`'s `preventDefault()` **also cancels `FocusScope`'s own restore**, so the two
halves must be replaced together — and it carries the honest per-call-site count (1 measured, 3
structural, 1 tester-measured, **1 that was never broken**), which is not six.

**Rotated 2026-08-12:** **BUG-ETHE4-FOCUS-1** (ETH·E4, fixed `8e5ebcd`) → the archive's closing
section. ⚠ Before touching `TypeaheadField` or any Radix dialog focus behaviour, read it there:
it carries the only written record of the `@radix-ui/react-focus-scope` `handleMutations`
mechanism behind the 3-element tab loop, and of why a bubble-phase `stopPropagation()` cannot
beat `DismissableLayer`'s capture-phase Escape. Its untested residual is live as **FUP-ETH-KBD-1**.

**Also 2026-08-12:** the **BUG-VACUOUS-ASSERT-1 · BUG-ACT-EXPIRY-1 · BUG-ACT-ACL-1** summary block
— a residual duplicate; the record itself was rotated at closure 2026-08-10 and every claim in the
summary was verified present in the archive before deletion. ⚠ **BUG-ACT-ACL-1 closed one instance,
not the population** — that population is now swept: **AUDIT-INVOKER-WRAPPER closed 2026-08-12**
(ARM 5; *Completed work* above → [authz-invoker-wrapper.md](docs/progress/authz-invoker-wrapper.md)),
and `FROMFINDINGS=1 ARM=wrapper` is a standing §6 step-1 gate over it.

**Also 2026-08-12:** **FUP-VACUOUS-AUDIT-1** (closed 2026-08-10) → closing line in
[follow-ups-archive.md](docs/progress/follow-ups-archive.md); its full record was already
[docs/reviews/vacuous-assertion-audit.md](docs/reviews/vacuous-assertion-audit.md) and the live
block duplicated it. ⚠ Its output, `lint:vacuous`, is a **standing member of `npm run lint`** —
see CLAUDE.md §8. **FUP-VACUOUS-COVERAGE-1 stays OPEN above**: REM-8/REM-9 are honest
`test.skip()`s, outside the vacuity property, so this gate will never catch them.

## Test Run Summary

<!-- Most recent gate only, ONE ROW each. The narrative — triage, dispositions, mutation proofs —
     rotates to docs/progress/test-run-archive.md at each §6 Record (full history, Phases 0 →
     ACT, already there). -->

> **The last whole-suite green is now the 2026-08-13 DM1 row** (top). The **REG·KIND** step-1 row
> stays live because it is *not* a whole-suite run and must not be read as one — REG·KIND remains
> merged-but-ungated. The 2026-08-11 row, previously kept as the last whole-suite green, is
> superseded by the DM1 row and rotates at the next Record.
> Rotated **2026-08-12** → [test-run-archive.md](docs/progress/test-run-archive.md): the two RDR·4
> tester rows, the ETH·E4 final-gate row, and all four ACT tester rows (all milestones complete +
> recorded). Prior rotations: 2026-08-11 (ETH·E4 in-flight), 2026-08-10 (QO·B wave-1…5, QO·B, the
> Next 16.3.0 upgrade gate, both PDF·P2 runs, PDF·P1, QO·FUP F6, QO·A), 2026-08-07 (MIN · AFF ·
> MEM · PCI/TV and everything before).

| Date | Run | Result |
| --- | --- | --- |
| 2026-08-13 | **DM3 Wave B · TESTER · quick-loop, chromium, `--workers=1`, fresh `supabase db reset`.** ⚠ **NOT `e2e:prod`** — the full gate is lead-run. Scope: the new `e2e/dm3-wave-b-documents.spec.ts` (11 tests) + the four specs §7b flagged (`phase17-documents`, `documents-redesign`, `documents-changes-requested`, `charters-cadence`). Commit `0c10b9b` | **GREEN. `47 collected, 47 ran, 47 passed, 0 skipped`** (run shape, not just the pass count). ⭐ **THE BYTE ROUND TRIP IS PROVEN, AND IT IS BYTE EQUALITY, NOT "a file downloads"**: DM3B-1 uploads a real PDF through the browser's client corridor, asserts an object exists at the reserved coordinate whose `storage.objects` metadata size equals the uploaded length, asserts `finalize` **derived** `size_bytes`/`mime_type`/`sha256` from what landed (`unscanned_accepted`, `standard` tier, `documents-standard` bucket), then clicks the door-backed control, fetches the signed URL and asserts `Buffer.compare(out, in) === 0`. **This is the first byte to cross the new corridor in the entire phase** — everything prior was a DB-layer proof (pgTAP `DM3·X3a`'s fixture is SQL-built) or an absence proof. **DM3B-2** proves derivation is not coincidence: it DECLARES a lie at `begin` (1 byte, `text/plain`), PUTs a real PDF, and requires the truth to win. **DM3B-3 discharges the prior-version exit criterion** with two *distinct* payloads — after supersede+publish, v1 still serves v1's bytes (v2's marker asserted ABSENT), so serving the wrong version cannot pass. **DM3B-4 pins the approver arm AT THE DOOR** (the DM2 P0 lesson — a rendered control carries no authz claim): a non-member approver is refused `P0002`/`versão de documento não encontrada` **BEFORE** being named and served **after** (the before-shot is what makes the arm the cause, not a coincidence), while an outsider who is an approver on a *different* document is refused with the exact SQLSTATE + message and **no leakage** (title/marker/bucket all asserted absent) — and her own DOC-0001 refuses with a *different* code (`HC0D8`), proving the first denial was authorization, not a generic no. **DM3B-8** re-observes Rule 6 red on purpose: a deliberately reused `(bucket, path)` must raise `23505` naming `file_objects_bucket_path_uniq` (first attempt passed for the WRONG reason — a `created_by` NOT NULL fired before the UNIQUE ever ran; the insert now copies every other column from the incumbent row). Also: **DM3B-5** abandonment (mid-PUT navigation → resumable draft, reservation left `reserved`, **zero** objects written), **DM3B-6** validation ordering (oversized + wrong-MIME refused BEFORE create — pins `7cbe6b7`, zero orphan documents), **DM3B-7** `Aguardando arquivo` not `Processando envio` on a backfilled fileless version, **DM3B-9** keyboard-only Tab→Enter download with byte comparison, **DM3B-10** the D11 three-way audit split (non-creator = exactly 1, creator = 0, denial = 0), **DM3B-11** the ethics seams as catalog facts incl. the post-DROP+CREATE ACL. **NO BUG FILED — no application defect was found.** All 9 baseline reds triaged: **7 stale locators** in tester-owned specs (downloads moved `role=link`→`role=button`; `controlled_document_versions.storage_path` dropped by M4 → re-pointed onto the core model via new shared helpers `coreFileOfVersion`/`waitForVersionFile`/`versionHasFile` in `e2e/helpers/documents.ts`) and **2 pure worker interference** (RW-4/RW-5/RW-8 pass serially; these specs are documented `--workers=1`). Two further reds appeared only after re-pointing and were also tester-side: RW-2's bare `getByRole('status')` became ambiguous because DM3 correctly added sr-only live regions to the upload surfaces (now scoped), and AC-7 outgrew the 30 s default because the upload is now a three-leg client chain (now 90 s). ⚠ **Two observations, neither a DM3 regression:** (1) **`open_document_version` refusals surface as HTTP 500, not 404** — measured directly against PostgREST (`{"code":"P0002",…}` with `HTTP_STATUS=500`); pre-existing DM2 transport behaviour, so DM3B-4 pins code+message and asserts only `status >= 400` rather than encoding a PostgREST detail as a DM3 contract. (2) **AC-13's keyboard assertion is keyed to a positional Tab count and is therefore coupled to REGISTER ROW COUNT** — it went red at 56 accumulated documents (seed ships 2) with a 60-press budget; raised to 240 and commented in-spec, but it is deterministic **only on a fresh reset** and will drift again the moment the seed gains a document. ⚠ **Could not exercise:** the ethics seams have **no UI by ruling** (ADR 0114 Am. 2 / FUP-DM3-ETHICS-UI), so DM3B-11 is DB-level only; and the `documents_wave_b`-OFF arm of the charter download affordance (Q6) was not driven — flipping a shared-stack flag mid-run would have raced the other specs |
| 2026-08-13 | **DM2 · TESTER · quick-loop, chromium, `--workers=1`, fresh `supabase db reset`.** ⚠ **NOT `e2e:prod`.** Post-pause resumption: (1) confirmed the two gap-closure probes committed in `4644cef` (`HC0DG` in `phase11-interviews.spec.ts`, `HC0D8` `DM2-STATES` in `phase-f2-attachments.spec.ts`) — their final confirmation had been left mid-run at the pause; (2) added `DM2-VERIFY-FAILED-TERMINAL-UI` (pins QA r1 MAJOR-3: no retry affordance survives a terminal verification failure) and `DM2-DELETE-HOLD-REFUSED` (pins QA r1 MINOR-4: a delete refused by a legal hold says so, `role=alert`); (3) fixed a stale `⛔ PARKED — FUP-DM1-E2E` header comment in `quality-oversight.spec.ts:39` that contradicted its own (already-restored-and-strengthened) M8 assertion. Files: `e2e/phase-f2-attachments.spec.ts`, `e2e/phase11-interviews.spec.ts`, `e2e/quality-oversight.spec.ts` (comment-only). Commit `f7cc733` | **GREEN.** `47 collected, 47 ran, 47 passed, 0 skipped` (run shape checked, not just the pass count) across all three files on a fresh reset. **The two probes are now CONFIRMED**, not merely committed: `HC0DG` passes (server refuses `audio/mpeg` with `HC0DG`, then accepts a `.pdf` control on the same interview) and `HC0D8`'s `DM2-STATES` passes on a single clean run — the double `[removido]` row the paused session observed is **confirmed to be the documented re-run artifact** (running the disposal step twice without a reset), not a regression from either probe: this run shows exactly one `[removido]` row. **Two build issues found and fixed while authoring the new tests, both harness bugs in the new specs, not app defects:** (a) the terminal-failure route needed `execSync docker exec … rm` on the Storage file backend's on-disk leaf file (one directory level below `storage_path`, confirmed against the running container) rather than the Storage REST `DELETE`, which also drops the `storage.objects` metadata row and makes `finalize` read `upload_incomplete` (PUT-never-landed) instead of the terminal `failed` the test targets; (b) the dialog's built-in close icon shares the `aria-label="Fechar"` with the terminal footer's own "Fechar" button, so the positive control is scoped to `[data-slot="dialog-footer"]`; (c) `DM2-DELETE-HOLD-REFUSED`'s row-survives assertion had to move to AFTER closing the dialog — Radix marks the rest of the page `aria-hidden` while the modal is open, so `getByRole('region', …)` cannot re-resolve `docPanel` mid-dialog. `lint:vacuous`: 179 spec files, 0 findings. No bug filed — both new pins confirm fixes already shipped (backend `797d55b`, frontend `7cc833a`/`0acdd0d`) rather than finding new defects |
| 2026-08-13 | **DM2 RE-GATE · LEAD · FULL `e2e:prod`, run TWICE** — branch `docs/dm1-plan-amendments`, at HEAD `9de4a39` after every QA-r1 remediation landed. Supersedes the pre-P0-1 DM2 gate row (rotated) | **RUN 1 = GATE RED · RUN 2 = GATE GREEN.** Run 1: 1090 passed · **1 failed** · 2 flaky · 0 did-not-run · 17 batches. Run 2: **1091 passed · 0 failed · 2 flaky · 0 did-not-run**; both runs `accounted 1093 of 1099 collected`, the 6 unaccounted being **exactly the 6 skips**. The run-1 failure is `pdf-printing.spec.ts:38`, failing its **pre-mint** empty-state assertion — **outside the DM2 diff** (`src/components/printing/labels.ts` untouched; the expected string intact in source). **Three independent disproofs, all `RETRIES=0`:** isolation **9/9** · identical-batch re-run (same 4 specs, same order) **60 passed/1 skipped/0 failed** · full-suite run 2, batch 8 **60/0**. ⚠ **Mechanism UNPROVEN** — the batch-8 log carries **no** infra signal (`server_dead=0`, no conn errors), so this is *not* the DM1 precedent where the flake was proven. "Non-reproducible" is what was measured; "flake" is an inference. ⚠ **Both evidence artifacts were destroyed by the re-runs** (`test-results/` AND `/tmp/e2e-prod-gate/batch-8.log`) → **FUP-GATE-PDFP1-FLAKE**, whose real fix is that `e2e-prod-gate.sh` archives a failing batch **before** re-running. ⚠ The gate's own retry re-hit the same **pre-condition** assertion, so "failed twice" was **one observation plus a dependent retry**, not two. Run 2 also carried 2 auto-classified infra events, both re-run clean: batch 16 the documented Windows prod-standalone collapse (`server_dead=1`, 46 conn errors → 69/69) and batch 5 a **crash to exit 127 with no summary** while `server_dead=0` (→ 70/70). QA r2 narrowed the residue further: the gate resets the DB **before each batch** and batch 8 ran **1 worker**, and the failing test is the *first* in its file (pool index 0) — which near-refutes the shared-fixture-pool hypothesis and leaves an ordinary `toBeVisible` timing flake. **Rest of the gate:** pgTAP **189f/6097** · lint 5-gate · tsc 0 · vitest 86/1258 · `ARM=census`/`hat`/`floor`/`FROMFINDINGS=1 wrapper` **all HOLD** · diff-scoped sweep `app.can_read_document` **COVERED** (1 case actually run; BLIND 0/ERROR 0) · [detail](docs/progress/dm2-orchestration-wave-a.md) |

## QA Verdicts

<!-- ONE LINE per phase/feature: verdict + date + link. The full analysis lives in
     docs/reviews/*.md — never restate rationale here or in the archive.
     Struck-through rows are superseded rounds, kept only to show a phase looped.
     Retention: current milestone only. Older concluded rows move VERBATIM to
     qa-verdicts-archive.md's "Collapsed one-line index" (the index is not rationale —
     it preserves the feature-name → review-file mapping). -->

| Phase / Feature | Verdict | Date | Report |
| --- | --- | --- | --- |
| **DM3 — Wave B: controlled documents** (ADR 0114 Amdt 1 + **Amdt 2 / D17**) | ⛔ **CHANGES REQUESTED (r1)** — **0 P0** · **1 MAJOR (blocking)** · 4 MINOR · 5 INFO. **MAJOR-1: `documents_wave_b` gates the LAST step of the corridor, not the corridor — and the tree asserts the opposite twice.** Catalog: **exactly one** function calls `app.assert_documents_wave_b_enabled` (`attach_controlled_document_version_file`). Probed live with the flag OFF: `create_controlled_document` **ACCEPTED**, `begin_document_upload` **ACCEPTED** — so a coordinator creates the doc, reserves a path, **PUTs real bytes into `documents-standard`** and finalizes; only the domain pointer refuses (HC0D7). Residue: orphaned bytes + orphaned core version + a draft whose file never appears. `documentsWaveBEnabled()` (added by DM3) is **called from nowhere** in `src/`; the UI gates on `controlled_docs` alone. Violates the phase's OWN stated contract (`seed.sql` "with it OFF every DM3 door answers HC0D7"; `documents/actions.ts:87` "every DM3 door calls (HC0D7), so a stale client cannot reach past this") and the Wave-A MIN pattern it cites ("ABSENT, not disabled"). **Not an authz hole** — authority unchanged and verified (approver reads/cannot write; plain member + outside approver both refused P0002/42501). Lands in the deploy's OWN expected interim state (plan §10: local vs prod flags "disagree"); the arm the Test Run Summary already records as **not exercised**. **Verified by QA, not accepted:** both R3 twins re-run (trigger-only → OK, door-only → OK, **both → 23503** — the two-sufficient-mechanisms finding reproduced) · the A4 widening twin genuinely reds · all **five** D17 conditions incl. the 12-arg identity with **no surviving 11-arg overload** and the re-GRANT read from `pg_proc.proacl` · D15 ceiling narrows on a case home and **fails closed** on a Wave-B home (HC0D6 + `else null`), incl. under `set local role authenticated` · zero `controlled-documents` Storage policies · `set_document_version_file`/`can_read_document_object`/`storage_path` all **0 rows** in the catalog · the trigger fix is unbypassable (BEFORE INSERT + `securable_type NOT NULL` + no INSERT policy → 42501) · DM3B-1 is real `Buffer.compare === 0` through the door-signed URL. **Gate figures independently reproduced:** tsc **0** · lint **5/5** · vitest **86f/1258** · `ARM=census` **HOLDS** (548 live/569 accounted; 273+275 re-derived exactly) · `ARM=hat` **HOLDS** · `FROMFINDINGS=1 ARM=wrapper` **HOLDS** (BLIND 41) · 385 files = 385 registered. **MINOR-1: "in no authz arm's domain" is false for ARM 2** (domain = every `public` prosecdef auth-EXECUTE fn, **411** sigs, contains both named functions) — the conclusion stands, the reason does not. Accepted not re-run: `e2e:prod`, the fresh-reset pgTAP run, `ARM=floor`, and the sweep's `can_write_document` **ERROR**-resolved-by-runlog (⚠ must not later be cited as COVERED) | 2026-08-13 | [dm3-controlled-documents](docs/reviews/dm3-controlled-documents-review.md) |
| **DM2 — orchestration + Wave A** (ADR 0114 Amdt 1 / 0117 / 0118) | ✅ **APPROVED (r2)** [review](docs/reviews/dm2-orchestration-wave-a-review.md) — r1's 1 P0 · 3 MAJOR · 6 MINOR · 4 INFO all discharged; **P0-1's proof re-executed by QA, not accepted** (three mutations reproduced in rolled-back txns, restores md5-verified; `308` 5.2s observed RED under cut-removal with its control green; `can_read_document` coverage re-derived as 18 reds in `328` under kernel neutralization). MAJOR-1 catalog-confirmed unable to over-narrow. Two QA findings were **corrected by the engineers and the corrections adopted** (MAJOR-2's classifier contract; MINOR-4 was worse than filed). r2: **0 P0 · 0 MAJOR · 1 MINOR · 4 INFO**. ⛔ **Binding pre-merge condition (r2-1):** three sites still assert a React prop suppresses the byte corridor (`document-row.tsx:75`, `case-detail-view.tsx:727`, `quality-oversight.spec.ts:509`) — comment-only, no re-gate required, **must land before merge or any flag flip**. `e2e:prod` run-1 red ruled **not phase-attributable** (→ FUP-GATE-PDFP1-FLAKE). **Gate:** pgTAP 189f/6097 · lint 5-gate · tsc 0 · vitest 86/1258 · `ARM=census`/`hat`/`floor`/`FROMFINDINGS=1 wrapper` HOLD · diff-scoped sweep `can_read_document` COVERED (`open_document_version` out of every arm's domain by return-type syntax — ADR 0118 §12; assurance is `329` P0a–P0f + the `308` sentinel) · `e2e:prod` GREEN run 2; run-1 red triaged as non-attributable, **mechanism explicitly unproven** | 2026-08-13 | [dm2-orchestration-wave-a](docs/reviews/dm2-orchestration-wave-a-review.md) |
| ~~**DM2 — orchestration + Wave A**, round 1~~ | ⛔ **CHANGES REQUESTED (r1)** — **1 P0** · 3 MAJOR · 6 MINOR · 4 INFO. **P0-1: DM2 obligation 2 (the M8/M9 byte-discrimination cut) was never re-expressed in `open_document_version`** — no `read_case_deliberation` conjunct anywhere in the corridor, so the ADR-0100 quality reviewer is **SERVED PHI-tier bytes** (probed live: `SERVED tier=phi`, outsider control `P0002`); the only shipped control is `canDownload={!isOversight}`, a React prop — Architecture **Rule 1** inverted. The restored E2E asserts the *button* is absent, so the green bar now certifies a UI-only control; the record says "incl. the M8 bytes-cut contract" and contains **zero** mentions of oversight/ADR 0100. Invisible to all four arms because D8 moved the boundary from a census-covered storage policy into a `jsonb` DEFINER outside every domain (INFO-1). MAJOR: S1-O4 — a doc on a `legal_privileged` interview is readable **and its PHI bytes servable** by members who cannot see the interview (parity, but Wave A makes it live — needs a PO ruling); reconciliation is blind by construction to `failed`/`abandoned` files that DO hold bytes (undisposable PHI under a `RECONCILIATION CLEAN`); "Tentar novamente" after a verification failure is a guaranteed-fail loop, each iteration an unaudited service-role full-object download. **Verified sound and re-derived from the live catalog, not accepted:** the D15 ceiling both directions + no over-narrowing + row-absence through the whole chain + creator/staff_admin/platform_admin all denied + rank genuinely consulted; the meeting/action_item seam at **both** layers (HC0D6 write-side incl. relabel; kernel fail-closed for everyone, with a `true` control); the corridor's D9/D10 state matrix exactly; the **D11 floor exactly** (creator+standard = 0 rows, denials 0, no duplicates, sole minter in the catalog); D8's zero SELECT policies on both buckets; R6/R7/R8 as a real differential + vacuity pin. **Gate figures independently reproduced on a fresh reset:** pgTAP **189f/6059 PASS** (0 `not ok`, 0 bad plans), lint 5-gate exit 0, tsc **0 errors**, vitest 1254, `ARM=census`/`hat`/`wrapper` all HOLD (569 verdicts, BLIND 41) | 2026-08-13 | [dm2-orchestration-wave-a](docs/reviews/dm2-orchestration-wave-a-review.md) |
| **DM1 — substrate cutover** (ADR 0114/0116) | ✅ **APPROVED (r1)** 2026-08-13 — 0 P0 · 1 MAJOR (fixed) · 5 MINOR · 4 INFO | [review](docs/reviews/dm1-substrate-cutover-review.md) · [gate detail](docs/progress/dm1-substrate-cutover.md) |
| _Phase 0 → FUP batch 2026-08-12_ — **105 concluded rows** (81 rotated 2026-08-06 + 18 rotated 2026-08-10 + 6 rotated 2026-08-13: QO·B · PDF·P2 · PDF·P1 · QO·FUP · QO·A · MIN · AFF · PCI · TV · Phase 16, incl. struck loop rows) | — | — | [collapsed index](docs/progress/qa-verdicts-archive.md) |

## Decisions

<!-- One line per decision; full rationale in docs/decisions/ (ADR) + docs/progress/decisions-log.md -->

| Date | Decision | Ref |
| --- | --- | --- |
| 2026-08-13 | **DM3 ethics depth RULED — plumbing to writable, NO UI** (PO). Raised because the four Q1 discharge conditions were **incomplete**: catalog-verified, `set_ethics_decision_details` takes **11 params, none a document id**, and `src/lib/ethics/actions.ts:393` accepts `decisionLetterDocumentId` then **silently drops it** — so an FK alone would have swapped "a column pointing at nothing" for "a column pointing at documents nothing can create". Adds **condition 5**: add `p_decision_letter_document_id` to the RPC + forward it from TS. ⚠ `issue_ethics_notification`'s `p_related_document_id` **still exists** (arg 7/8) — the refusal is in the **body**, so a body change, NOT a DROP+CREATE that would discard the ACL. **No attach-a-letter UI in DM3** — a decision, not an omission: none has ever existed (verified across the ethics dialogs, every `type="file"` site, and the absence of any reader of either field), and a decision letter is the archetypal `legal_privileged` document whose UI needs the ETH·E1 spine + D15 ceiling designed as a feature → **FUP-DM3-ETHICS-UI** | ADR [0114](docs/decisions/0114-document-model-redesign.md) **Amdt 2 / D17** |
| 2026-08-13 | **Q1 RULED — the two orphaned ethics document seams join Wave B (DM3)** (PO). `ethics_decision_details.decision_letter_document_id` + `ethics_notifications.related_document_id` were a **scope gap, not a deferral**: ADR 0114 D13's four waves named ethics in none. A disciplinary decision letter is a *governed* document with an approval/effective lifecycle — the controlled-document shape — so it reuses Wave B's machinery. Wave A was foreclosed (DM2 closed + approved; adopting there = reopening a completed phase); a post-DM5 follow-up was rejected because it closes the retirement manifest with two columns pointing at nothing. **Four binding discharge conditions, partial ≠ discharged:** real FK to `documents(id)` · `issue_ethics_notification`'s `p_related_document_id` restored to working · fail-closed rejection removed · **keystone K8 removed** (a keystone pinning a refusal the product no longer wants is a test asserting a bug). ⚠ **Lifecycle is shared, the READER SET is not** — ethics reads run on the ADR 0072/ETH·E1 spine (`case_access_grants` + `max_confidentiality` + recusal); negative twin required | ADR [0114](docs/decisions/0114-document-model-redesign.md) **Amendment 2 / D17** · [plan DM3 step 5](docs/plans/document-model-redesign.md) |
| 2026-08-12 | **The referral's "Registros internos" file under the CASE Registro vocabulary; `referral_note_types` is deleted** (PO, both calls taken explicitly: full replacement over keep-the-table, and REQUIRED-with-default-`note` over keep-optional). Adds `update`/`follow_up`, so the shared list is six. **No snapshot column replaces `type_label`** — it existed to survive a user rename, and a fixed platform-wide list cannot be renamed, so the label resolves at render from one source. That source (`src/lib/cases/registro-kinds.ts`) is import-free and side-effect-free **so a `"use client"` component and a server data-access module can both read it** — which is the only reason one source of truth is possible; it narrows `referrals/types.ts`'s "ZERO imports" contract to "one inert import", stated in both files. ⚠ The two writers changed SIGNATURE (`uuid`→`text`) ⇒ DROP+CREATE ⇒ **the ACL is discarded**; all four grants re-issued and re-verified against the catalog | ADR [0110](docs/decisions/0110-shared-registro-kind-vocabulary.md) (supersedes [0109](docs/decisions/0109-referral-registros-and-case-access-summary.md) D2) |
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
- 🟢 ~~FUP-DM1-CEILING · FUP-DM1-E2E · FUP-DM1-DISPOSE~~ — all three ✅ **DISCHARGED by DM2** (S1 / S4 / S2), each verified independently rather than accepted from a report → rotated out of both live files to [follow-ups-archive.md](docs/progress/follow-ups-archive.md)
- 🟡 **FUP-329-ABORT-SHAPE** — `329_dm2_document_commands.sql` holds a keystone whose failure **aborts the file** (`exit 3`, `Bad plan: planned 115 but ran 74`), dropping **41** subsequent assertions. Measured in DM3's diff-scoped sweep: it is what turned `can_write_document`'s verdict into `ERROR run-shape!=baseline` instead of COVERED — the gate *was* noticed (14 reds across 5 suites), but the harness could not classify it. **Costs nothing in a green run; costs classifiability on every future mutation sweep over these gates.** Same class as the B4 fix already applied in `330` (route the door call through a catching wrapper so a refusal reads as a red assertion, not a transaction abort) — backend
- 🟡 **FUP-LINT-STALE-SYMBOL-COMMENT** — propose a **6th lint gate**: flag a comment naming an identifier that no longer exists. Every existing gate was added after its class shipped a live defect; this class hit **~6× in DM3 alone** (plus 4 historically, one shipping a live bug). Worst specimen: `supersedeDocument`'s doc telling the frontend to upload *"via `addDocumentVersion`"* — **a deleted verb, in the doc of a verb they actively call**. Invisible to typecheck, eslint and all five gates. ⚠ **Lead-ruled: deliberate TOMBSTONES stay** — silence sends a reader who remembers `X` to the wrong file. 🔻 **LEAD RECOMMENDATION: do NOT build the gate** (PO decides; it is a lint-gate change). Four findings killed it: the same identifier holds **three truth values in ONE file** (`actions.ts` `:119` tombstone · **`:309` LIVE** · `:693` tombstone), so **file scoping fails too** and classification must be per-occurrence, separable only by **adjacent prose** · module resolution reaches **3 of 7 (43%)** — the rest name a Postgres function/column, a TS *property*, and a Postgres policy · the DB arm needs a **running database** (live catalog is sole truth; migration text is stale by design), but all five current gates are **stateless** · and the proposed convention-only gate's exemption is **inverted** (it would flag `:309`, not spare it) and still needs a diff base, so it is a CI check, not a grep. **Instead: adopt the marker as an authoring convention and keep the DELETION-DISCIPLINE STEP that actually worked** — derive the removal set from the diff ∪ the migrations' `drop` statements and sweep it (that found 7; three recall-built lists found 6/3/4, each bounded by a different unstated key). Body: [follow-ups.md](docs/progress/follow-ups.md) — lead/PO
- 🟡 **FUP-PGTAP-SAVEPOINT** — ⚠ **DOWNGRADED 🔴→🟡 2026-08-13: the original claim was WRONG.** Measured on the clean reset it demanded: **`193` ok · `194` ok · ZERO bad plans across 190 files / 6149 tests**. **pg_prove parses the TAP stream, and TAP output is emitted at execution and cannot be rolled back** — so the assertion **does** count and the gate's tally is correct; only pgTAP's *internal* counter under-counts, emitting a `#` diagnostic pg_prove ignores. Real only in the **degenerate** case (every assertion inside the rolled-back region → `finish()` raises `# No tests run!`, which fails the file). ⚠ **Lead error: I generalized from the degenerate case** — the original repro was `plan(1)` with its one assertion inside, the single shape where the under-count reaches zero, and I filed a 🔴 gate-integrity item on a configuration the live suites don't use. Stays open at 🟡 for the misleading diagnostic + the hazardous shape; **nothing is uncovered, no prior gate record is invalidated.** Full correction: [follow-ups.md](docs/progress/follow-ups.md) — lead
- ~~🔴 FUP-PGTAP-SAVEPOINT (as originally filed)~~ — a pgTAP assertion between `savepoint` and `rollback to savepoint` **prints `ok` but is DISCARDED from the tally** (lead-reproduced twice: same assertion, `finish()` → `# No tests run!` with the savepoint, clean without). The pgTAP twin of the `lint:vacuous` class, with **no equivalent gate for SQL**. Lead sweep: **`193_schema_integrity.sql:89-99` AFFECTED** (a *mutation twin* — missed by the original report, which flagged only `194`) · **`194:87-95` AFFECTED** · `330` and `100_dashboard` clean. ⚠ **`100_dashboard.sql:411` already documented the hazard as a local comment** — and two suites shipped the shape anyway; knowledge in one file's comment does not propagate. Blast radius NOT yet measured (suites need the harness; `194`'s dirty-DB `planned 8 but ran 0` is **not** attributed to this). **Discharge = measure on a fresh reset · rewrite both to `330`'s captured-definition pattern · ADD the missing gate** — lead + backend
- 🟡 **FUP-DM3-ETHICS-UI** — no affordance exists to attach a decision letter to an ethics case; DM3 ships the seams **writable via the API only** (PO ruling 2026-08-13, ADR 0114 Amdt 2 scope boundary). **Deliberate, not an oversight** — a decision letter is the archetypal `legal_privileged` document, so the UI needs the ETH·E1 spine + D15 ceiling designed as a feature, with E2E that does not exist today (`ethics-e2-procedure.spec.ts:55` already declares it unbuilt) — PO (feature phase)
- 🟡 **FUP-GATE-PDFP1-FLAKE** — `e2e/pdf-printing.spec.ts:38` failed its **pre-mint** empty-state assertion once in the DM2 re-gate's `e2e:prod` run 1, then passed **three** independent ways at `RETRIES=0` (isolation 9/9 · identical-batch re-run 60/61 · full-suite run 2, batch 8 60/0). **Not phase-attributable** — the printing module is outside the DM2 diff and the expected string is intact in source (QA r2). ⚠ **The mechanism is UNPROVEN**: no infra signal (`server_dead=0`, no conn errors), unlike DM1's proven `server_dead` flake. QA narrowed it further — the gate resets the DB **before each batch** and batch 8 ran **1 worker**, and the failing test is the *first* in its file (pool index 0), which near-refutes the shared-fixture-pool hypothesis and leaves an ordinary `toBeVisible` timing flake. ⚠ **Both evidence artifacts are gone**: `test-results/` AND `/tmp/e2e-prod-gate/batch-8.log` were overwritten by the re-runs. **Discharge = catch it once with artifacts preserved, or pin the timing.** Related and arguably the real fix: `scripts/e2e-prod-gate.sh` resolves "re-run to see if it recurs" vs "preserve the evidence" the **wrong way** — a failing batch's log and `test-results/` should be archived before any re-run (QA r2 carry-forward) — lead/tester
- 🟡 **FUP-ACT-CAPA-ASSIGN** — NSP operators see ~only themselves in the CAPA assignee picker (`profiles` RLS has no operator arm; the hatless union used to mask it) — backend
- 🟡 **FUP-ACT-HATLESS-AUDIT** — `audit_write` omits the `acting_as` KEY when hatless, so absence conflates *no hat* / *pre-ACT row* / *service-role path* (S4 QA MINOR-6; Rule 11 is met, this is legibility) — backend, travels with the A13 ruling
- 🔴 **FUP-AFF-1** — the authz census is BLIND to write-path doors (ADR 0079 Amendment 5; AFF gate records must cite `302`'s keystones, not `ARM=census`) — backend/harness
- 🔴 **FUP-PCITV-1** — PCI + TV: what QA APPROVED over, ranked — **5 open** (`TRUNCATE` revoke residue · audit-mesh 2/7 arms · unexercised org-admin disjunct · resolver/GUC semantics · 10 bare `for select` policies); the embed-sweep entry point closed 2026-08-11 (`npm run sweep:embeds`, named baseline in the body) — unassigned
- 🟡 **FUP-SILENT-READ-1** — ~207 of 773 PostgREST reads never destructure `error`; an empty result is then indistinguishable from a failure. All 3 ETH·E4-authored instances fixed (`7e55f01`); the residue is pre-existing style and needs per-call-site triage, **not** a bulk fix — unassigned → [body](docs/progress/follow-ups.md)
- 🔴 **FUP-ETH-ROLES-1** — **no production bootstrap of `case_participant_roles`.** The ethics role bundle lives ONLY in `supabase/seed.sql`; the sole role-insert in any migration is the lazy `affected_patient` mint inside the patient path. A real org therefore starts with **zero** roles, and since `case_participants.role_id` is NOT NULL, EVERY participant type is a dead end until an org admin authors the vocabulary in T5 — the three role-less external types ratified on 2026-08-11 are one visible instance, not the shape. Decide before the pilot onboards a second org: bootstrap-on-org-create vs. a first-run prompt vs. accept-and-document (found 2026-08-11 while ratifying the PO items; the add-dialog empty state now at least names the remedy) — product + backend
- 🟡 **FUP-ETH-KBD-1** — the **professional** lane's `TypeaheadField` mount was never keyboard-navigated (`PROF-PICK`/`PROF-CREATE` drive it by mouse), so whether it shares the closed BUG-ETHE4-FOCUS-1 defect is **untested, not ruled out**. Carried out of that bug at its 2026-08-12 rotation so a green ✅ would not bury it. Same shape as QA's **m8** (`evidence-picker.tsx` has both root causes, unverified) — frontend + tester → [body](docs/progress/follow-ups.md)
- 🟡 **FUP-ETH-A11Y-1** — ETH·E4 dialogs: `aria-describedby` never reaches the error id (m3), and the typeahead announces neither loading nor result count (m4). Filed rather than fixed in-phase because m4's only two routes both collide with `pickFromTypeahead`'s locators, so it needs a coordinated **tester-owned** spec change — frontend + tester → [body](docs/progress/follow-ups.md)
- 🟡 **FUP-E2E-SERVER-DEAD-1** — the prod-standalone server dies under load in ~3 of 17 batches (was 1 of 17 the same morning); `BATCH_TESTS=22` has rescued two different dead groups. Infra characteristic, **never** an assertion failure — but a batch with no verdict is not a pass — unassigned → [body](docs/progress/follow-ups.md)
- 🔴 **FUP-FF5-1** — patient-lane sublabel is degenerate on the READ path (PO DEFERRED 2026-07-28; resolve before the lane reaches a real committee) — backend
- ⬛ **FUP-F2-BUCKETS — RESOLVED 2026-08-12** (backend): `meeting-attachments` retired in `20260921000300` (both policies + bucket, behind a guard that REFUSES a non-empty bucket at apply time — ⚠ the remote count could NOT be measured, background-agent remote SQL is auto-denied, so the guard IS the remote evidence at push time); pgTAP `325` pins the absence from `pg_policies` + a case-documents positive control. `interview-attachments`/`referral-attachments` untouched by design; `case-documents` retirement travels with the open `getReferralDocumentUrl` item → [archive](docs/progress/follow-ups-archive.md)
- ⬛ FUP-PDF-3 — **RESOLVED 2026-08-12** (backend): both doors now `RETURNS public.printed_document_public`, the composite mirroring the column-list GRANT exactly (ADR 0111; migration `20260921000100`; pgTAP `323` red-first keystones + DROP+CREATE property controls; catalog before/after diff = `returns` only) → [archive](docs/progress/follow-ups-archive.md)
- 🟡 **FUP-PDF-4** — `/verificar` rate limiter: comment fixed 2026-08-11, **availability lever still open and RE-SCOPED** — ⛔ the filed premise was wrong (per-credential limiting already shipped in `e1daba9`; the prescribed fix is a no-op). The real gap is the exhaustible **global** arm + per-process state; needs a trusted client identity + shared store, i.e. decisions, not code — backend
- 🔴 **FUP-QOB-3 — `dispose_event_phi` is now the ONLY Rule-12 disposal door still granting a bare tenancy admin** (found 2026-08-09 by the sibling-coherence check run right after the BUG-QOB-004 cut, *not* by anything in that ruling's scope). D5's ratified reasoning — "a principal with zero PHI bits does not destroy Rule 12 data" — applies to patient-safety identically to case + referral, so two of the three PHI modules now deny the tenancy tier and one still grants it, purely because of ruling order. Tell: it still carries the same pt-BR message `dispose_referral_phi` had to shed. **Deliberately not acted on** — outside the ruling, and removing a live capability unasked is the standing trap in the other direction. `dispose_meeting_minutes` is a *separate* question (not a PHI module, probably a genuine KEEP) — do not sweep it in reflexively. → [body](docs/progress/follow-ups.md) — PO, then backend
- 🟡 FUP-AFF-3 — pin door ACLs by DERIVING the door set from `pg_proc`, not by remembering it — backend
- 🟡 FUP-AFF-4 — make the membership-role list a Postgres ENUM (decide before the role set next changes) — backend
- 🟡 FUP-AFF-2 — D7's foreign-professional (no-CPF) escape is unreachable; decide before the pilot onboards clinical staff — product + backend
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
