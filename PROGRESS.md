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
| DM | **Document Model Redesign** [0114](docs/decisions/0114-document-model-redesign.md) (+**Amendment 1** D15/D16, ratified 2026-08-13; supersedes [0063](docs/decisions/0063-centralized-attachments-substrate.md)) · plan [DM0–DM5](docs/plans/document-model-redesign.md) · [record](docs/progress/dm1-substrate-cutover.md) | ✅ **DM0 + DM1 complete** — 🟢 **DM2 IN FLIGHT** (opened 2026-08-13; S1 = the D15 ceiling, the Wave A prerequisite) | ✅ 6 migrations `20260923000100`–`…000600` · ADR **0116** · lint 5-gate 0/0 · tsc · vitest 1254 | ✅ pgTAP **188f/5927 PASS** (suite `328`, 88 keystones) · `ARM=census`+`hat`+`floor`+`FROMFINDINGS=1 wrapper` **all HOLD** · diff-scoped sweep 13/16 reconciled, 12 COVERED + 1 BLIND (real, keystoned K12 → COVERED) + 0 ERROR · `e2e:prod` **1073p/1f/3flaky, 0 did-not-run**, every batch `accounted N/N`; the 1 failure is a proven `server_dead` INFRA flake (isolation 13/13 + identical-batch 68/68, `RETRIES=0`) · [gate detail](docs/progress/dm1-substrate-cutover.md) | ✅ **APPROVED (r1)** [review](docs/reviews/dm1-substrate-cutover-review.md) — 0 P0 · 1 MAJOR **fixed not deferred** (`can_read_file_object`'s uploader arm short-circuited the kernel chain; K13 red-first) · 5 MINOR · 4 INFO | ✅ **2026-08-13** | 2026-08-13 | ⚠ **branch `docs/dm1-plan-amendments` — NOT merged to `main`, nothing pushed** (PO directive; `main`/`origin/main` still `f84c6b6`). `phase(DM1)` = `bd45246`. Open → DM2: **FUP-DM1-CEILING/D15** (build before Wave A), FUP-DM1-E2E, FUP-DM1-DISPOSE, MINOR-2, plan **Q1** (ethics seams have no wave), O4 |
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

### ⏸ PAUSED — **DM2: orchestration + Wave A** (opened 2026-08-13, paused 2026-08-13 by PO)

> **⛔ DM2 has NOT passed its gate.** QA r1 = **CHANGES REQUESTED** (1 P0 · 3 MAJOR · 6 MINOR · 4 INFO). **Do not flip the flags, do not seek approval, do not merge.** Paused because the backend agent was killed **four consecutive times by transient API 529s** (twice resumed, then replaced by a fresh lightweight agent that failed identically — disproving the context-size hypothesis; the API was broadly degraded while the lead's own session kept working, which is why the recorded state is verified rather than assumed).
> **Safe checkpoint:** HEAD `56e3989`, 374 on disk == 374 registered, nothing half-applied, all five DM flags **OFF** in production defaults, nothing pushed (`main`/`origin/main` = `f84c6b6`).
> **The P0 is FIXED and verified from two independent directions** (lead catalog + planted-row probe; tester red-then-green through the door via REST). What remains is proof discipline and two MAJORs.
> ▶ **Resuming? Read the handoff first:** [dm2-orchestration-wave-a.md § *DM2 PAUSED — resumption handoff*](docs/progress/dm2-orchestration-wave-a.md) — it carries the 8 remaining items in order, the PO-owned questions, and two method findings that must not be lost (an uncommitted migration is applied by anyone's `db reset` and silently fixes the defect before the test meant to catch it runs; and a sweep boundary drawn on a return-type *syntax* cannot enforce a *property* — 536 functions share that class).

> Program: Document Model Redesign — plan [DM0–DM5](docs/plans/document-model-redesign.md) §DM2 ·
> ADR [0114](docs/decisions/0114-document-model-redesign.md) (+Amendment 1 D15/D16) · DM1 record
> [dm1-substrate-cutover.md](docs/progress/dm1-substrate-cutover.md).
> Branch: `docs/dm1-plan-amendments` (continues DM1's branch — `main` does not carry DM1; PO
> directive stands: **nothing to `main`, nothing remote**). Migration window: **`20260924000100`+**
> (highest registered = `20260923000600`; 367 registered == 367 files, catalog-verified 2026-08-13).

**Sequencing — S1 is a hard prerequisite, not a preference.** ADR 0114 Amdt 1 D15: the ceiling must
land *before* Wave A re-points any case / meeting / interview document, because that is the phase in
which a formerly gated document would silently become readable by every ordinary case reader.

| # | Slice | Owner | Status | Depends on |
|---|-------|-------|--------|-----------|
| S1 | **D15 confidentiality ceiling** — nullable label column on `documents` + kernel arm in `app.can_read_document`; restores pgTAP `228` t36–40 | backend | ✅ **done 2026-08-13** — migrations `20260924000100`+`…000200` (AMEND 1 two-step, behavioral reds observed on the real pre-arm catalog: 228 t36/t38 + 328 K14d1–d4 all `have: 1, want: 0`); seam guard **HC0D6** (HC0D5 taken by `revoke_printed_document`) + fail-closed kernel backstop; `228` 131/131 + `328` 109/109 (K14, 21 asserts); twins A+B rollback-verified; full pgTAP **188f/5952 PASS** fresh; 4 arms HOLD; diff-scoped sweep `can_read_document` 1 case COVERED/0 BLIND/0 ERROR; gen:types +3; **AMEND 3 = PARITY** (finding DM2-F1); open-door pins → S2 (S1-O1) · [record](docs/progress/dm2-orchestration-wave-a.md) · ADR [0117](docs/decisions/0117-dm2-s1-confidentiality-ceiling-decisions.md) | — |
| S2 | Command layer + `src/lib/documents/` + reconciliation script. **Head task: the Phase-17 rename** (plan amendment 2026-08-13) | backend | 🟢 **built 2026-08-13 except S2.8** — rename ✅ · contract (+10 amendments) ✅ · migrations `20260924000300`+`…000400` ✅ (FINDING 1a removal; dispose arm = FUP-DM1-DISPOSE ✅; S1-O1 ✅; MINOR-2 ✅) · keystones 329 66/66 · 228 135/135 · 328 109/109 · 191 27/27 · full pgTAP **189f/6023 PASS** fresh · 4 arms HOLD (census zero-delta, doors registered as findings note) · 5 per-state twins · TS layer + reconcile script ✅ · O4 measured (sign 10 ms; file-chain ~3.7 ms/row watch item) · ADR [0118](docs/decisions/0118-dm2-s2-command-layer-decisions.md) · **S2.8 ✅ built 2026-08-13** (lead-approved; 3 conditions discharged; `20260924000500`; 329 92/92; suite **189f/6049 PASS** fresh; census required-FAIL captured→HOLDS 549/569; O4 + list-perf PO-ruled — [record](docs/progress/dm2-orchestration-wave-a.md) §S2.8) — **S2 CLOSED** | S1 ✅ |
| S3 | Wave A UI — case / meeting / interview panels re-pointed; upload states in pt-BR; D12 dialog copy | frontend | 🟢 building 2026-08-13 — plan acked; shared `src/components/documents/` module (3 homes, one byte-corridor client). **Contract-first paid: 10 gaps found in the S2 stubs before either side hardened**, 3 of them visible F2 regressions (`kind` unsettable so the badge ships dead · `occurredAt` dropped · `underLegalHold` absent from the list, so per-row delete would offer an action HC0D3 refuses) — all routed to `backend`. Upload island unblocked once item 5 (PUT transport) was specified. **Gates green** (5-gate lint 0/0 · typecheck exit 0 via `PIPESTATUS` · vitest 1254 · real `next build` exit 0). **Lead-run browser verification 2026-08-13** — see the block below | S2 contracts ✅ `92d7e8a` |
| S4 | E2E — **priority 1: the unexercised write path** (see the red block above), then rewrite the 6 parked specs (FUP-DM1-E2E) incl. the M8 bytes-cut contract, AC-4a–d/AC-9 (the last of FUP-DM1-CEILING), + a keyboard-only flow; mutation list | tester | ✅ **done 2026-08-13** — **PRIORITY 1 ANSWERED: the write path is NOT broken** (real browser PUT → signed URL → finalize → verification → `available`, genuinely fetchable download, audited exactly once; retry + expiry hold functionally). 6 parked specs restored per ADR 0114 D5 (rewritten, never deleted) + new `e2e/helpers/document-model.ts`. **3 real bugs found, all fixed in-phase** (001/002/003). Final: **77 collected · 76 passed · 1 pre-existing unrelated skip · 0 unexpected failures · zero `test.fail()` pins remaining**. ⚠ **Method note worth keeping:** the tester independently applied the lead's BUG-DM2-002 pin-reasoning to **003** — the fix had *moved* the mechanism to reconciliation rather than repairing the inline UPDATE, so un-pinning as literally written would have left a permanently-red test **for a different reason than it was filed for**. Rewritten as `DM2-RECONCILE-EXPIRY`, which asserts `reserved` immediately after the HC0DE refusal (proving the synchronous marking is *gone*, not hidden) and then runs the **real** reconciliation script. It also re-audited every `audit_log` read across the five touched files after the F3 fixture-fragility warning — all already `action`+`entity` scoped — and deliberately avoided global drift counts in the new reconciliation assertions | S3 ✅ · seed `01134b1` ✅ |
| S5 | QA review + full §6 gate + flag choreography | qa / lead | ⛔ **CHANGES REQUESTED (r1) 2026-08-13** — **1 P0 · 3 MAJOR · 6 MINOR · 4 INFO** [review](docs/reviews/dm2-orchestration-wave-a-review.md). **The phase does NOT pass gate step 3; the flags must NOT flip.** See the P0 block below | S4 ✅ · `e2e:prod` GREEN |

**Carried in from DM1 (do not re-derive — bodies in the DM1 record §"Carried into DM2"):**
FUP-DM1-CEILING/D15 (= S1) · FUP-DM1-E2E (= S4) · FUP-DM1-DISPOSE (S2, before the flag flips) ·
QA MINOR-2 (`open_document_version` must gate **before** recording — the registry inherits an
`is_admin()` short-circuit) · plan **Q1** (ethics seams still have no wave — PO; blocks DM3, not DM2) ·
**O4** (signed-URL TTL per sensitivity — decide with the PO against real DM2 latency).

**Flag posture during DM2** (seed `01134b1`): `seed.sql` forces `documents_foundation` +
`documents_wave_a` **ON for local/E2E** (the MIN `audio_minutes` pattern); **production defaults stay
OFF** until the S5 choreography. ⚠ Consequence, noted at the flip site because that is where a spec
author looks: a spec pinning the deliberate **flag-OFF** contract (affordances **absent, not
disabled**; every door raises HC0D7) must toggle the flags **itself** and restore them.
**`attachments` is seed-retired only** — the key row, the `FeatureFlags` entry and
`attachmentsEnabled()` retire in the **S5 migration**, deliberately: production never runs `seed.sql`,
so a seed `DELETE` would fork local from prod on the key's *existence* (local "no such flag" vs prod
`false`) — the exact drift class two prior programs were spent killing. A migration is the only
honest instrument for a change production must also see.
⚠ Ripple caught before it reached the tester: pgTAP `328` **K9** pinned all five DM flags OFF and
would have gone red on the tester's **first** fresh reset — a red with no defect behind it, arriving
exactly when the tester is calibrating what "normal" looks like. Rewritten to assert the *seeded*
state with the prod-default caveat in the pin name. Suite re-run **189f/6051 PASS** (6049 + 2).

**🛑 P0-1 (QA r1, 2026-08-13) — THE OVERSIGHT QUALITY REVIEWER IS SERVED PHI BYTES; the only control is a React prop.** Lead-reproduced independently before routing, twice over:
- Catalog: `app.can_read_document`'s case arm is a **bare `app.can_read_case`** — `prosrc ~ 'read_case_deliberation'` is **false** — and `open_document_version` carries **no** byte discrimination of its own (`prosrc ~ 'deliberation|oversight|quality_reviewer'` = false).
- Live probe: `app.case_capabilities(case, quality.a@test.local)` = `["read_case_content","view_case_overview"]` — **no `read_case_deliberation`** — yet `app.can_read_document(...)` on a document homed on that case returns **true**. QA's own matrix went further: `open_document_version` → **SERVED tier=phi**, with a non-vacuous outsider control raising `P0002`.
**The QO·B M8/M9 byte-discrimination cut was never re-expressed in the new corridor.** The only shipped control is `case-detail-view.tsx` `canDownload={!isOversight}` — **Architecture Rule 1 inverted** ("never rely on UI hiding"), and `document-row.tsx`'s own comment claiming it "suppresses the audited door outright; there is no second byte path" is **false in both clauses**.
⚠ **Why the green bar certified it:** the restored E2E asserts the **button** has count 0 (`quality-oversight.spec.ts:502`), so it pins the UI-only control — [[green-bar-misses-the-wired-seam]] exactly. And **why four green authz arms missed it**: the M8 cut used to live in a *storage policy*, inside `ARM=census`'s domain; D8 deliberately deleted the SELECT policies and moved the boundary into a **`jsonb`-returning DEFINER**, which is in **no** arm's domain. QA checked the domain predicate rather than the claim and confirmed the lead's census reasoning was correct — `proretset` is why `document_delete_affordances` was caught and the jsonb doors were not. **The carried lesson: clause 2's boundary is a return-type *syntax* while its stated principle is a *property*, and 536 pre-existing functions share the class.** Not a DM2 regression — DM2 is just where the first defect landed in the new location. ⚠ `supabase/tests/308_case_caps_s7.sql:291-303` **states this obligation verbatim** ("That door's keystones MUST re-express all six pins") and **ran green this phase**; the DM2 record contains zero occurrences of "oversight", "quality reviewer" or "ADR 0100".

**Tester re-verification (2026-08-13, P0-1):** `e2e/quality-oversight.spec.ts`'s two M8 tests
strengthened to hit the door, not the button — three additions per the lead's spec: (1) metadata
visibility kept as-is (must not over-narrow — the reviewer is *supposed* to see titles), (2) the
button-absence check kept as-is, (3) `quality.a`'s test now calls `open_document_version` **directly**
via REST (bypassing the UI entirely) and asserts it **REFUSES**, (4) a **non-vacuous positive
control** in "no-lockout control": chefe.ccih calls the SAME door on the SAME document and is
**served** — so a blanket door failure or a broken fixture cannot make the negative pass for the
wrong reason. **Red-first OBSERVED, not inferred:** backend's fix (`supabase/migrations/
20260924000700_dm2_qa1_byte_deliberation_cut.sql`) was already applied locally but **uncommitted**
when this run started, so the strengthened test passed immediately — not proof enough on its own.
Set the migration file aside, fresh-reset, re-ran: **genuine RED** — `open_document_version` returned
`ok=true` with the full title/mime/size/tier payload to quality.a, reproducing QA's P0-1 exactly, byte
for byte. Restored the migration, fresh-reset, re-ran: **GREEN**, and the positive control held
throughout (never a blanket refusal). Regression sweep: all 6 S4 files, fresh reset — **77 collected,
76 passed, 1 pre-existing unrelated skip, 0 collateral damage** — the new `read_case_deliberation`
conjunct on `open_document_version` does not touch the meeting/action_item arm (`v_case` stays null
there) and every case/interview persona the other 8 restored tests use already holds
`read_case_deliberation`, so nothing else regressed. Lint/tsc/`lint:vacuous` all clean.
**Re-scan requested by the lead** (any restored assertion whose subject is a rendered control rather
than a server answer, carrying an authorization claim): AC-4a–d/AC-9, `DM2-CEILING-NOONE` and
`DM2-FLAGOFF` were already door-level (the last one explicitly demonstrates+documents the
`documents_wave_a`-vs-`documents_foundation` split, routed to backend for S5). Two **coverage gaps**
(not confirmed vulnerabilities — the door was independently read from `pg_proc` and does enforce both,
just not exercised by these specs end-to-end): `phase11-interviews.spec.ts` IV2-11 only exercises the
CLIENT-SIDE MIME block (`begin_document_upload`'s own `HC0DG` server check, confirmed present in the
live body, is untested by any bypass path); `phase-f2-attachments.spec.ts` `DM2-STATES`' `pending` row
asserts a *disabled* button (never clickable, so no live corridor to bypass there) but does not
independently probe `open_document_version` on an unbound version (confirmed via `pg_proc`: raises
`HC0D8`, untested by E2E). **Spot-checked, not assumed:** the pre-existing (not S4-authored)
`notFound()`-page-based denial tests this file and `ethics-e1-access-spine.spec.ts` share (AC-1a
respondent-exclusion, AC-2a explicit-grants-only) — direct REST reads of `cases`/`case_phases` for
both personas returned `200 []`, genuine RLS-level filtering, not a page-level-only check — **not**
the same shape as P0-1.

**🔴 THE SHARPEST OPEN RISK IN DM2 — the write path has never moved a byte** (raised by `frontend`
at S3 close; lead-confirmed). `begin_document_upload` is **proven reachable and correctly shaped**
(lead called it directly under `set local role authenticated` with real `sub`+`active_role` claims:
it authorized, minted document+version+file_object+session, and returned **IDs only, no bucket or
path** — so the ADR 0118 §1 door topology holds *behaviourally*, not just by construction; rolled
back, 0 rows). But **nothing has ever exercised browser → server action → RPC → Storage PUT under
the reserved-path INSERT policy → finalize → verification.** Every upload-island state
(`preparing`/`uploading`/`finalizing`, the `upload_incomplete` retry that reuses the reservation,
`upload_expired` dropping it) is **unexercised code**, and the retry branch is the kind that looks
right and isn't. 329's 92 pins cover the *doors*; they do not cover the *seam*. This is the
[[green-bar-misses-the-wired-seam]] class — three live bugs once survived a full green bar there and
only E2E caught them. **S4's first priority, not something to treat as covered.**

⚠ **Tooling note that nearly produced a false regression report.** Mid-verification the case page's
entire content sat in a `div[hidden]`, buttons had no React fiber props and zero bounding rects, and
clicks did nothing — which read exactly like a hydration regression from the preceding commit. It was
not: **the Browser pane was not displayed, so the page was not compositing frames** (the screenshot
call is what surfaced it). Consequence for method: `javascript_tool` text/DOM reads stay valid without
compositing — the copy, option lists and badge assertions above are sound — but **layout, real
clicks, and hydration-dependent behaviour are not observable with the pane hidden**, and their
absence must never be read as a defect. Take a screenshot early; its failure message names the
condition when nothing else does.

**✅ S3 BROWSER VERIFICATION — lead-run 2026-08-13** (the agent stalled twice on a **denied**
`preview_start`; PO approved it, and the lead ran it rather than risk a third stall — full stall
mechanics in the S3 record). Dev preview on **:57449** (3000 held a stale bind). Method that made
this worth doing: **the agent wrote its per-affordance flag-OFF prediction down BEFORE any
observation**, so the run could falsify it. It held everywhere except the two items the agent had
itself flagged as *unverified deviations* — a prediction that survives contact is evidence; one
written afterwards is not.

- **Flag OFF (ship state), all three homes:** heading renders · read-only empty copy · upload
  trigger **absent, not disabled** · open + delete absent · **console clean**. Interview links
  behaved per the lead ruling (count shown, existing row still readable, "Adicionar" absent).
- **Flag ON:** trigger appears · empty copy switches to the writable variant · **console clean —
  no RSC server-fn-as-prop crash** (BUG-QI-001 class), only HMR + benign font-preload warnings.
- **🔒 The D15 ceiling's UI half is CORRECT END-TO-END** — the highest-value check of the set. On a
  **case** home all 7 levels are offered; on a **meeting** home `legal_privileged` +
  `credentialing_sensitive` are **absent from the option list** while all 5 non-enforcing levels
  remain. It narrows exactly where HC0D6 refuses and **nowhere else** (no over-narrowing).
  ⚠ **Scope of that claim, stated because the lead overstated it verbally and to `tester`:** what was
  verified is the **write-side option list**. The **read-side** denial affordance was *inferred*, and
  the inference was **wrong** — see BUG-DM2-002: denial is **row-absence**, so the "Restrito" badge is
  unreachable. The lead confirmed what rendered and assumed what did not. *An affordance nobody has
  seen render is a claim, not a fact* — the same trap `frontend`'s write-the-prediction-first habit
  avoided in the other direction.
- **D12 copy renders verbatim** on case + meeting, incl. the Título help that carries the actual
  reason ("visíveis para toda a comissão, inclusive para quem não pode abrir o arquivo").
- **The kind-slug drift fix is live:** case emits `other|Outro`, meeting emits `outro|Outro` — the
  deliberate quirk preserved, slug from the contract, wording from the UI.
- **A document ROW was rendered for the first time** (lead planted a temporary row, since nothing
  had verified one; removed after, 0 rows and flags restored to OFF). It proved the **kind badge is
  live, not dead** — the exact regression contract-first caught at stub time.
- Two defects found + fixed in-phase: the interview heading promised "gravações" a panel no longer
  contained; and the count badge was missing (then rendered `0` where every sibling hides at zero).
- **INFO for QA (not a defect):** with `latestVersion` null a row asserts both "Sem arquivo" and
  "o arquivo contém dados de paciente". `containsPhi` falls back to the home rule when no file
  exists — the **correct fail-safe** (over-warn, never under-warn) — and the state is unreachable
  via `begin_document_upload`. Fallback deliberately left alone.
- **Recorded decision, so it is not later read as an oversight:** `DocumentsPanel` awaits its list
  alongside the flag read in `Promise.all` rather than streaming under Suspense — needed for the
  header count, consistent with every sibling section, ~1.6 ms/row against a 45-object census.
  Remedy if volume ever changes that: a `cache()`-wrapped query sharing one round trip.

**⚠ METHOD FINDING — the census caught the AUTHOR'S OWN domain misprediction (2026-08-13, S2.8).**
Worth carrying past this program. Backend's S2.7 findings note *predicted* that SETOF doors stay
outside the census domain — a reasoned claim, written into the findings file, and **wrong for
`document_delete_affordances`**: `ARM=census` FAILED naming exactly that door (549 live gates). Two
consequences the phase handled correctly and a third to remember: (a) the required-fail is not
ceremony — it is the only thing standing between a reasoned domain claim and a silently
unregistered gate; (b) the prescribed diff-scoped sweep then printed **`BLIND: 0` over ZERO executed
cases** (the ARM-1 `^(is_|can_|has_)` matcher cannot run that name) and was **not cited**, coverage
coming instead from a targeted mutation (door forced `true` → a plain member gains the affordance,
A2/A3 would red; restore catalog-verified) — the case-count rule applied as intended; (c) **the wrong
prediction was corrected IN PLACE in the findings file**, not merely superseded, so it cannot mislead
a later reader. A stale reasoned claim inside the artifact that records coverage is worse than no
claim — [[a-comment-is-an-assertion-that-goes-stale-silently]], census edition.

**✅ PO RULINGS 2026-08-13 (DM2).** **O4 CLOSED** — signed-URL TTL **PHI 120 s / standard 300 s**,
**no streaming proxy** (sign median measured **10 ms**). The tier split is deliberate and must not be
"simplified" to one number: a signed URL is a bearer token, so PHI bytes carry a strictly smaller
exposure window. Lands in ADR 0114 (O4's closure) + ADR 0118. · **List perf** — the file-chain costs
~3.7 ms/row (a 200-doc panel ≈ 2 s); **keep `containsPhi` + `availability`, do NOT trim the embed** —
the prod census is 45 objects total and real panels hold single digits, so the trim would spend two
live projection fields on a load that does not exist. Filed as a **named pilot watch-item** with the
measured numbers attached, not a pre-ship fix.

**✅ RULED — S2.8 `reclassify_document_file` (lead, 2026-08-13): option 1 + an evidence-gated
duplicate-retirement exemption, with 3 conditions.**
The re-derivation confirmed the fork was real — `document_version_files_version_rendition_uniq
UNIQUE (document_version_id, rendition_kind)` does block the originally recommended
"second `source` binding" shape (backend had checked the table's *triggers* but never listed its
*constraints*; owned and corrected). **Shape:** reclassification mints a **new `document_version`**
whose binding points at the copied file — fully append-only, **zero DM1-invariant edits**, and the
visible version history is honest (the bytes genuinely changed bucket, audited via
`document.reclassified`). **The hole option 1 alone left:** the old file stays *bound* to its
immutable old version, so retiring it hits the provisional-retention gate HC0DR — and the urgent
reclassify case is precisely mis-tiered PHI that must leave the wrong bucket. **The amendment:**
`complete_document_disposal` honors reason `duplicate` **only when the door itself verifies** a live,
servable **same-sha256** file bound to the same document — retention protects the *record*, and a
same-content sibling proves the record survives. Caller-asserted duplication is never accepted.
**Conditions:** (1) the last-copy invariant is keystoned as a **differential pair** — dispose A while
B is live → permitted, then B with no sibling → **refused by retention** — because "the last copy is
protected" is the entire safety claim and an inductive argument must be executable, not reasoned;
(2) the exemption as described is **wider than its use case** and symmetric (nothing in
sha/live/same-document distinguishes the correct-tier copy from the mis-tiered one, so it would
equally permit retiring the *new* copy) → narrow its reachability to the reclassification path, or
keep it general and pin that a `duplicate` disposition of a **non**-duplicated file is refused;
(3) it lands as an **ADR decision, not a state-only note** — it creates a new retention-exemption
class, and a future reader hitting HC0DR must find its bounds without reconstructing them.
Standing rule: *DM1 invariants may be amended, never widened as a side effect of making a command
compile.*

<!-- superseded fork text kept below for the reasoning trail -->
**🔶 (RULED — see above) design fork — S2.8 `reclassify_document_file`.**
D10's copy→verify→commit→retire-source has no legal expression on the DM1 substrate as built, and
the recommended shape does not survive the catalog:
- `document_version_files_version_rendition_uniq UNIQUE (document_version_id, rendition_kind)` —
  so **"add a second `source` binding, door picks newest" is not buildable**; it requires altering
  that constraint, i.e. it does *not* avoid a DM1-invariant edit as its proposal claimed.
- `guard_document_version_file_immutable BEFORE DELETE OR UPDATE` — so a liveness column cannot be
  set without a guard exception either.
- **Mutating the binding is ruled OUT on ADR grounds, not cost:** ADR 0114 **D10** says
  *"never a pointer update (F-03)"*, and F-03 is one of the audit defects this program exists to
  kill by construction. Relaxing the guard to allow it re-opens a closed finding.
Live option space (backend re-deriving against the catalog): **(1)** a new `document_version` whose
binding points at the new file object, old file retired through the *mutable, already-guarded*
`file_objects` state machine — fully append-only, zero invariant edits, but a tier change becomes
visible version history (honest for audit? or pollutes the prior-version semantics DM3 needs?);
**(2)** a partial UNIQUE over a liveness predicate **plus** a narrow keystoned guard exception;
**(3)** unseen. Standing rule set for it: **DM1 invariants may be amended, never widened as a side
effect of making a command compile** — any amendment lands as an ADR decision with the amended guard
mutation-proven. ⚠ Reclassify has **no Wave A UI consumer** (both classification commands are
surface-less by lead ruling), so there is room to get it right; deferring to a named slice with the
DM1 ledger obligation carried forward is an acceptable outcome.

**Lead findings handed to S1 (catalog-verified 2026-08-13, not read from migration text):**
- `app.confidentiality_clearance_ok(p_case_id, p_label, p_uid)` and `app.confidentiality_rank(text)`
  **SURVIVED DM1** — only the attachment-specific wrapper `app.attachment_confidentiality_ok` was
  dropped. D15 **reuses** them (program invariant: reuse the domain predicates, never reimplement).
- Only `legal_privileged` + `credentialing_sensitive` are ENFORCING; the other five labels return
  true. Clearance = `case_access_grants.max_confidentiality` outranking the label.
- ⚠ **The clearance helper is CASE-scoped.** `documents.home_resource_id` resolves to case ·
  meeting · interview · action_item. Only `case` (direct) and `interview` (via
  `app.case_of_interview`) yield a case id; **meeting and action_item do not** — S1 must rule that
  seam explicitly and fail closed, not silently skip the ceiling.
- ⚠ **Name-collision trap:** the Phase-17 controlled-document module owns a different
  `%document%` family (`commission_of_document`, `is_document_approver_of`,
  `guard_document_transition`, `trg_audit_controlled_documents`, …) on `controlled_documents`. A
  `%document%` sweep hits both substrates. Enumerate by table, never by name substring.

Most recent completed phase: **DM1 — substrate cutover**, PO-approved 2026-08-13 (record linked
above). Before it: **REG·KIND** (ADR 0110) merged 2026-08-12 — one Registro
vocabulary for cases and referrals. ⚠ **It ran gate step 1 ONLY** (no tester pass, no QA review, no
`e2e:prod`) by PO direction. It is ✅ **pushed, and the remote `db push` IS done** (corrected
2026-08-12) — but that changes nothing about the gate: treat it as
merged-but-ungated, not as complete. Before it, **RDR** (referral detail redesign) completed, merged
and rotated the same day — task detail, the final gate record and the method lessons are in
[referral-detail-redesign.md](docs/progress/referral-detail-redesign.md) (⚠ its type-vocabulary
sections are **history**: REG·KIND deleted `referral_note_types`); ETH·E4 before that is in
[eth-e4-participant-seating.md](docs/progress/eth-e4-participant-seating.md). What is left before
the pilot is § *Remaining pre-pilot work*.

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

✅ **BUG-DM2-001 — FIXED 2026-08-13** (backend, migration `20260924000600`, 373 registered; lead-verified from `pg_proc`): the `p_verified = false` branch now **inserts the `document_version_files` binding** alongside marking the file `failed`, so the failure becomes part of the version's record, the chain policies make it reader-observable, and the projection derives **`failed`** rather than eternal `pending`. No UNIQUE collision is reachable — the proven retry contract is the **pre-finalize** one (re-PUT to the same reserved URL); a post-failure retry is `begin` again, minting a new version with its own binding slot. The immutable-binding guard is untouched. Keystones assert the **projection's substrate, not only the column**: B1 red-first (`have: 0 / want: 1`), **B2 reads the failed state through the chain under `set local role authenticated`** (pre-fix: invisible), B4 message-matches the corridor refusing on *state* rather than as merely-unbound.
**Tester re-verification (2026-08-13):** un-pinned. `e2e/phase-f2-attachments.spec.ts`'s `test.fail()` pin (`DM2-BUG-1`) flipped to an unexpected PASS on the FIRST re-run after the fix (confirmed not a flake — 2 further isolated runs, same result), so it is rewritten as a positive regression pin, **`DM2-VERIFY-FAILED`**: asserts the DB truth (the binding + `upload_state='failed'`) before the UI text ("Falha no envio"). Green on a fresh reset alongside the other 5 restored files (77 collected / 76 passed / 1 pre-existing unrelated skip).

<!-- original filing retained below -->
🟠 **BUG-DM2-001 (as filed) — a verification FAILURE never binds `document_version_files`, so the row reads
"Processando envio" (pending) forever instead of "Falha no envio" (failed).** Filed 2026-08-13
(tester, DM2·S4 write-path testing). Severity: MAJOR (silent data-loss-adjacent UX — no path exists
for the user to ever learn the upload failed, or to retry, once this branch is hit).
**Repro:** `begin_document_upload` → PUT real bytes to Storage (succeeds) → `finalize_document_upload`
(transitions `file_objects.upload_state` to `verifying`) → `complete_document_upload_verification`
called with `p_verified: false` (the documented branch for "the service's own re-download of the
just-uploaded object failed") → `file_objects.upload_state = 'failed'`, but **no**
`document_version_files` row is ever inserted for that version (only the SUCCESS branch of
`complete_document_upload_verification` inserts one). **Expected:** the row's availability reads
`failed` (`AVAILABILITY_PRESENTATION.failed` — "Falha no envio... Remova este item e envie o arquivo
novamente"), per `src/components/documents/document-labels.ts`. **Actual:** `versionAvailability`
(`src/lib/queries/documents.ts`) finds no `document_version_files` binding for the version, so it
falls through to `pending` regardless of the underlying `file_objects.upload_state` — the row is
indistinguishable from a merely slow, still-in-flight upload, forever. **Violates:** the DM2 Wave-A
5-state availability contract (task brief: "`failed` and `disposed` are deliberately distinct on
four axes"); pinned RED via `test.fail()` in `e2e/phase-f2-attachments.spec.ts` (`DM2-BUG-1`), which
will flip to a hard failure the moment this is fixed. **Owner:** backend.

✅ **BUG-DM2-002 — FIXED 2026-08-13** (frontend, `18d08e9`): the unreachable branch,
`DocumentRestrictedBadge` and the `DOCUMENT_RESTRICTED` strings are removed, and the false comment is
replaced in **both** files with the true mechanism — denial is *absence*, `app.can_read_document`
behind the `documents_select` policy is why, an uncleared reader gets zero rows including the
creator, this is **stricter** than the UI assumed, and **ADR 0114 D16** is the named trigger that
would bring the affordance back. `canOpen` deliberately **left alone** (it is correct), and
`version.canOpen` is deliberately **kept** in the `showOpen` condition despite being currently
redundant — inlining today's equivalence would bake a coincidence into the UI, and D16 may tighten
the definition. ⚠ **Its `test.fail()` pin must be REWRITTEN, not un-pinned** (unlike 001/003): the
defect was a *false claim*, not broken behaviour, so nothing will ever flip that pin — a
`test.fail()` that can never flip is a test asserting behaviour the product deliberately does not
have, the same trap the plan's Q1 discharge condition warns about ("a keystone left pinning a
rejection the product no longer wants is a test asserting a bug"). Row-absence is already covered by
the restored AC-4a–d/AC-9.
**Tester re-verification (2026-08-13):** rewritten, not un-pinned, per the lead's ruling — a
`test.fail()` asserting the (now-removed) badge would sit as a permanent expected-failure forever, so
that is not the right closure shape. `e2e/phase-f2-attachments.spec.ts`'s `DM2-BUG-2` is replaced with
**`DM2-CEILING-NOONE`** (`test.fail()` removed): a positive, non-redundant pin — a case with **zero**
`case_access_grants` rows denies an enforcing-labeled document to its own creator/coordinator too, not
just a third-party grantee (AC-4a/b's scenario). Green on a fresh reset alongside the other 5 restored
files.

<!-- original filing retained below for the evidence trail -->
🟡 **BUG-DM2-002 (as filed) — the D15 ceiling's "Restrito" badge is unreachable dead code; `canOpen` can never
be `false` on a rendered document row.** Filed 2026-08-13 (tester, DM2·S4 ceiling testing). Severity:
MINOR/documentation (the underlying SECURITY property is intact and arguably stronger — see below —
this is a dead-code / stale-doc-comment finding, not an access-control hole).
**Repro/evidence:** `app.can_read_document` (read live from `pg_proc`) embeds the D15 ceiling as a
ROW-level AND-conjunct — an uncleared reader gets **zero rows** for an enforcing-labeled document (the
`documents_select`/`document_versions_select` RLS policies both gate on this same predicate), not a
visible row with `canOpen: false`. Confirmed live via a real `begin_document_upload` + PostgREST
probe: even the document's own creator/coordinator got `[]` back for her own just-created
`legal_privileged` document on a case with no `case_access_grants` clearance row (the S1 "fail-closed
— readable by NO ONE" backstop, working as designed). Separately, `DocumentVersionSummary.canOpen`
(`src/lib/queries/documents.ts`) is defined purely as `availability === 'available'`, with **no**
separate door call — so for any row that DOES pass RLS, `canOpen` is unconditionally `true`.
**Expected** (per `src/components/documents/document-row.tsx`'s own doc comment): "The interesting
cell is `available && !canOpen` — the D15 ceiling denying an ordinary case reader. It renders a
NON-INTERACTIVE 'Restrito' badge... E2E AC-9 asserts exactly that." **Actual:** that branch cannot be
reached by any caller today — the denial is 100% row-absence, never a visible Restrito badge.
**Violates:** `document-row.tsx`'s own doc comment (a false claim about observable behavior) and the
original DM2 task brief's framing of the AC-9 contract. Pinned RED via `test.fail()` in
`e2e/phase-f2-attachments.spec.ts` (`DM2-BUG-2`). **Restored `e2e/ethics-e1-access-spine.spec.ts`
AC-4a/b/AC-9 assert the TRUE (row-absence) shape**, matching the pre-DM1 test's own historical
behavior ("O2: hidden from the LIST") — not blocked on this bug. **Owner:** backend/frontend (either
fix the comment to describe row-absence, or wire a genuine row-visible-but-ceiling-denied state if
Phase 19's general access plane wants one later).

✅ **BUG-DM2-003 — FIXED 2026-08-13** (backend; lead-verified from `pg_proc`: the dead `update … set state = 'expired'` is gone from `finalize_document_upload`). The refusal stays **predicate-based** (`expires_at < now()`) — unchanged and still correct — and the **marking moved to reconciliation**, which now sweeps lapsed reserved sessions → `expired` and their still-reserved files → `abandoned`, both counted in its report. Rationale, worth keeping: *a refusal that must also persist state is fighting its own transaction*; reconciliation already existed to sweep exactly this. ⚠ **The sweep validated the bug with real data on first contact** — its smoke run caught **3** lapsed sessions: one planted, plus **two genuine reservations left by the tester's own E2E runs**, i.e. precisely the rows nothing would ever have marked before.
**Tester re-verification (2026-08-13):** un-pinned, rewritten as **`DM2-RECONCILE-EXPIRY`** in
`e2e/phase-f2-attachments.spec.ts` (`test.fail()` removed) — a deliberate choice between the two honest
contracts the marking-moved fix admits (picked, not assumed): asserts `state` stays `reserved`
immediately after the HC0DE refusal (no synchronous marking), then runs the REAL reconciliation script
(`node scripts/document-reconciliation.mjs`, not simulated) and asserts `state='expired'` +
`file_objects.upload_state='abandoned'` afterward. The script's own exit code / global drift count is
deliberately NOT asserted (only this test's own entity is checked) — the pgTAP `329` F3 shared-fixture
lesson the lead flagged applies equally to E2E: a bare count over an append-only/shared table is a
fragility this file's own `auditRows` helper already avoids by always scoping to one `entity_id`
(re-audited across all 5 touched files: every `audit_log` read is action+entity-scoped, none global).
Green on a fresh reset alongside the other 5 restored files.

<!-- original filing retained below -->
🟡 **BUG-DM2-003 (as filed) — `upload_sessions.state` never actually becomes `'expired'`; the UPDATE is rolled
back by its own `RAISE EXCEPTION` in the same statement.** Filed 2026-08-13 (tester, DM2·S4 expiry
testing). Severity: MINOR (the functional refusal is correct and unaffected — only the persisted
`state` column is wrong).
**Repro:** `finalize_document_upload`'s expiry branch: `update public.upload_sessions set state =
'expired' where id = v_s.id; raise exception … using errcode = 'HC0DE';` — no `BEGIN/EXCEPTION`
block, no autonomous transaction; a single PostgREST RPC call is one implicit transaction, so the
`UPDATE` is unconditionally undone when the `RAISE` aborts it. **Expected:** `upload_sessions.state =
'expired'` after an expired-reservation retry attempt (the CHECK-enumerated vocabulary includes
`'expired'` as a distinct member; pinned by pgTAP `329` U12 per the DM2·S2 record). **Actual:** the
row is left in `state = 'reserved'` forever (confirmed by a live E2E run before this was filed — the
functional HC0DE refusal and the UI's "Feche e comece o envio novamente" message both fire correctly
on EVERY subsequent retry attempt, since the check re-evaluates `expires_at < now()` rather than
`state`, but the column itself never reflects reality). **Impact:** any future code that queries
`upload_sessions.state = 'expired'` directly (an abandoned-upload cleanup sweep, an admin report)
will find nothing, even though the refusal-by-timestamp behavior keeps working. Pinned RED via
`test.fail()` in `e2e/phase-f2-attachments.spec.ts` (`DM2-BUG-3`). **Owner:** backend.

✅ **BUG-CASEKIND-001 — `case_events.kind` was enforced in TypeScript ONLY; a forged `kind` insert
succeeded. FIXED 2026-08-12** (migration `20260921000400_case_events_kind_write_authority.sql`).
Found 2026-08-12 by `qa` during the same review; PRE-EXISTING, did not block that batch.

**Mechanism, catalog-verified:** a 16-value `CHECK` on the column, **zero triggers**, and **no `kind`
arm in either INSERT policy**. The vocabulary's real authority was `src/lib/cases/registro-kinds.ts`
— application code. A forged `kind='decision_issued'` insert **succeeded** as an ordinary committee
writer, i.e. a user could mint an event the UI presents as a governance decision. This is the
recorded *"a correct predicate ≠ correct policies"* family: the CHECK constrains the **domain** of
`kind`; nothing constrained **who may write which value**.

**The fix.** `app.is_manual_case_event_kind(text)` — the SQL mirror of the six-value manual
vocabulary — is appended as a `kind` arm to **all four** user-role write policies. The ten system
kinds stay writable only by the eleven `SECURITY DEFINER` RPCs that emit them: they are owned by
`postgres`, which owns `case_events`, and the table is **not** `force row level security`, so they
bypass RLS and are unaffected (`relowner`/`relforcerowsecurity`/`proowner` read from the catalog,
not inferred). ⚠ **The arm is on both INSERTs AND both UPDATEs** — an INSERT-only arm is defeated by
insert-then-update (`note` → `decision_issued`), the recorded *"an exclusion is only as strong as its
weakest mutator"* shape. Policies were amended with `alter policy … with check (<existing catalog
expr> and <arm>)`, never DROP+CREATE, so the E3a `coordinator_only` narrowing and the
`is_case_excluded` arm survive verbatim.

**Proved live as a real persona, `staff3.ccih@test.local`** (a plain `staff` holding a case write
grant — the exact "ordinary committee writer" of the report), rolled back, with controls:

| Check | Result |
| --- | --- |
| Control A — is the persona `staff_admin` of the case's commission? | `false` |
| Control B — a MANUAL kind insert, same session | **succeeds** (capability genuinely intact) |
| F — forged `kind='decision_issued'` INSERT | **refused `42501`** |
| G — insert `note`, then UPDATE to `decision_issued` | **refused `42501`** |
| Oracle — neutralize the arm (`… returns true`), re-run F and G | **both succeed again** |

**Keystones:** `supabase/tests/111_case_docs_events.sql` grows 5 → 9 (forged INSERT refused ·
manual-kind positive control · UPDATE-to-system-kind refused · all four policies carry the arm).
Proved able to fail: neutralizing the helper reds tests 6 and 8. Full pgTAP **5886/5886 PASS** on a
fresh reset; `lint` (5 gates) + `typecheck` clean; authz `ARM=census` / `ARM=hat` / `ARM=floor` all
INVARIANT HOLDS.

**NOT closed by this (deliberate, separate obligations, no minting path):** a case writer can still
`DELETE` a procedural event, and no audit row distinguishes a forged kind from an authentic one.


🟠 **FUP-AUTHZ-WP-SNAPSHOT — the write-path sweep's policy arm silently ran ZERO cases for a valid
subset.** Filed 2026-08-12 while gating BUG-CASEKIND-001. A diff-scoped
`CASES="case_events_writer_insert case_events_staff_admin_insert case_events_writer_update
case_events_staff_admin_update" p0-authz-writepath-audit.sh` printed `BLIND: 0 ERROR: 0 SKIPPED: 0`
and **exercised nothing** — its ARM-2 domain is the 33-row worklist hardcoded at
`p0-authz-writepath-audit.sh:388`, embedded 2026-07-18 and never grown; it contains **zero**
`case_events` rows. ADR 0079 Amendment 3 already names the stale snapshot as a structural gap; what
is new is that a **subset run over policies outside it is indistinguishable from a clean pass**.
The Phase-Gate step-1 "diff-scoped ARM=policy" is therefore a no-op for any policy the snapshot
misses — the recorded *"a detector that finds nothing must be proven able to find something"* class.
⚠ Also re-confirms hazard 1: the run **overwrote** `docs/reviews/authz-writepath-audit-findings.md`
with its empty report (restored via `git checkout --`). Fix: derive ARM 2's worklist from
`pg_policies` at run time, and make a subset that matches no case a non-zero exit.


🟡 **FUP-VACUOUS-COVERAGE-1 — OPEN, spun out of the audit: two tests that NEVER RUN.**
`phi-remediation.spec.ts` REM-8 and REM-9 skip on every run — there is no seeded RCA for
EV-0001, and the only CAPA has a NULL `source_event_id` (both catalog-verified). They are
honest `test.skip()`s, not silent greens, so they are outside the vacuity property and the gate
will never catch them. Closing them means new fixture work against `seed.sql`, which is a
contract with ~900 tests — hence its own item rather than a drive-by.


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
| 2026-08-13 | **DM2 · LEAD · FULL `e2e:prod` GATE (`REBUILD=1`)** — branch `docs/dm1-plan-amendments`; the whole-suite run for the document command layer + Wave A UI | **GATE GREEN.** **1088 passed · 0 failed · 0 infra · 3 flaky · 0 did-not-run · 17 batches**, every batch `accounted N/N`. **Coverage fully reconciled:** 1091 accounted of **1097 collected**, the 6 unaccounted being **exactly the 6 skips** (b2·1 + b4·1 + b8·1 + b15·2 + b17·1) — checked by arithmetic, not assumed, because *a batch whose reset fails drops out of the gate's own denominator while the summary still reads green*. ⚠ **Batch 17's first attempt died `server_dead=1 / conn_errors=9` with 5 failed + `12 did not run`**; the classifier called it INFRA and re-ran it on a fresh server → **61 passed · 0 failed · 0 did-not-run · accounted 62/62**. That intermediate `12 did not run` is in the log and is **not** a residual gap — the re-run's own accounting closes it. **All 3 flaky are pre-existing and unrelated to DM2** (`act-role-assumption` ACT-switch · `charters-cadence` AC-1a · `phase2-auth-shell` logout). **Every DM2 spec passed on the prod build**, incl. `DM2-U2` (retry reuses the SAME reservation) and `DM2-VERIFY-FAILED` (the BUG-DM2-001 fix, reading "Falha no envio") — so the three in-phase fixes hold under a real standalone build, not only in the quick loop |
| 2026-08-13 | **DM2·S4 · TESTER · quick-loop, chromium, `--workers=1`, fresh `supabase db reset`.** ⚠ **NOT `e2e:prod`** — only the 6 files this slice touched (new + restored specs), not the full ~92-file suite; the lead runs `e2e:prod` next. Wrote `e2e/phase-f2-attachments.spec.ts` (rewrite, PRIORITY 1 write-path: real browser upload/retry/expiry/audit-exactness) + `e2e/helpers/document-model.ts` (new); restored the parked FUP-DM1-E2E blocks in `e2e/ethics-e1-access-spine.spec.ts` (AC-4a-d/AC-9, the D15 ceiling), `e2e/quality-oversight.spec.ts` (M8 bytes-cut), `e2e/phase11-interviews.spec.ts` (IV2-4/IV2-11), `e2e/cases-extras.spec.ts` (AC-Docs); verified `e2e/meeting-audio-minutes.spec.ts` needs no change | **GREEN.** **77 collected, 76 passed, 1 skipped (pre-existing AC-6, unrelated), 0 unexpected failures.** 3 of the 76 "passed" are `test.fail()`-marked genuine bugs found and filed this run (BUG-DM2-001/2/3 above) — the suite reports them as passing because they fail exactly as documented; Playwright will flip them to hard failures the moment each is fixed. **PRIORITY 1 finding: the write path is NOT broken** — `begin_document_upload` → real browser file PUT to the signed Storage URL → `finalize_document_upload` → `complete_document_upload_verification` → `available`, real fetchable download, exact audit rows (`document.upload_started`/`document.uploaded`/`document.opened`, the D11 floor's same-creator-standard-tier-unlogged conditional confirmed live), all pass. The `upload_incomplete` retry (reuses the SAME `document_version`/`file_object`, proven via DB counts before/after) and the `upload_expired` drop (session cleared, "Tentar novamente" reverts to "Enviar") both pass functionally — only `upload_sessions.state`'s own persisted value is wrong (BUG-DM2-003). Ceiling (D15): confirmed LIVE via a direct RPC+RLS probe that denial is 100% row-absence (not a visible "Restrito" badge — BUG-DM2-002, filed, not blocking); AC-4a-d/AC-9 restored against that TRUE shape, matching the pre-DM1 test's own historical behavior. **UPDATE 2026-08-13, same day, post-fix re-verification (still quick-loop, NOT `e2e:prod`):** all three bugs fixed (backend `f164938` for 001/003, frontend `18d08e9` for 002) — re-ran the six files fresh-reset. `DM2-BUG-1` flipped to an unexpected PASS on first re-run (confirmed not a flake, 2 more isolated runs) and is rewritten as a positive pin (`DM2-VERIFY-FAILED`); `DM2-BUG-3` did NOT flip on its original assertion (the fix moved marking to an out-of-band reconciliation sweep rather than repairing the inline UPDATE), rewritten deliberately as `DM2-RECONCILE-EXPIRY` (asserts `reserved` immediately post-refusal, then runs the REAL sweep script and asserts `expired`/`abandoned`); `DM2-BUG-2` rewritten per the lead's explicit ruling as `DM2-CEILING-NOONE` (a `test.fail()` pin for a now-removed affordance would never flip — "a keystone pinning a rejection the product no longer wants is a test asserting a bug"). **Final: 77 collected, 76 passed, 1 pre-existing unrelated skip, ZERO `test.fail()` pins remaining, 0 unexpected failures.** Lint (eslint 0/0) + `lint:vacuous` (178 files, 0 findings) + `tsc --noEmit` all clean on every touched file. Audited all 5 touched spec files for the pgTAP-329-F3-style global-count fragility the lead flagged: every `audit_log` read is `action`+`entity_id`-scoped (`ethics-e1-access-spine.spec.ts` additionally scopes by `actor_id`), none global. |
| 2026-08-13 | **DM1 · LEAD · FULL `e2e:prod` GATE (`REBUILD=1`)** — branch `docs/dm1-plan-amendments`; the whole-suite run for the attachments-substrate drop + inert document model | **GREEN (triaged).** **1073 passed · 1 failed · 3 flaky · 17 batches · 0 did-not-run**, every batch `accounted N/N`; of 1092 collected the 15 unaccounted are **exactly the 15 skips** (the FUP-DM1-E2E parks + 5 pre-existing). The sole failure (`case-narratives` AC-10) is a **proven `server_dead` INFRA flake below the classifier threshold**, not a regression — isolation **13/13** and an identical batch-2 re-run **68/68**, both `RETRIES=0`, and the re-run's own first attempt reproduced the mechanism (`server_dead=1`, 14 conn errors). pgTAP **188f/5927 PASS**; `ARM=census`/`hat`/`floor`/`wrapper` all HOLD. [detail](docs/progress/dm1-substrate-cutover.md) |
| 2026-08-12 | **REFNOTE + ARM 5 · LEAD · FULL gate** (branch `authz-wrapper-refnote`, commits `297d3e2` + `f22ddab`). pgTAP + `e2e:prod` on a **fresh `supabase db reset`** | **GREEN.** `typecheck` **0 errors** (⚠ the lone `RouteContext` error in a fresh worktree is the absent `.next/types/routes.d.ts`, not a defect — it clears once `next build` runs; do not chase it) · vitest **1254/1254** · all **five** lint gates · pgTAP **5906 pass, 188 files** (+13 suite 326, +7 suite 327). **Authz: `ARM=census` HOLDS at 540 live gates** — up from 452, the +88 being the `public` INVOKER surface ARM 5 brought into the enumeration — **· `ARM=hat` HOLDS** (3 pre-existing allowlisted) **· `ARM=floor` HOLDS** (79 never-called, all allowlisted) **· the new `ARM=wrapper` HOLDS** (41 BLIND ⊆ allowlist). **No diff-scoped `ARM=policy` is owed**: the 23 rebuilt doors are `prosecdef` but **not** set-returning and **not** boolean, so they fall in no sweep's domain — verified against the three worklist queries, not assumed; no RLS policy and no boolean gate was touched. **`e2e:prod`: 1046 passed · 0 failed · 17 batches**, then **GATE RED (UNRUN)** — batch 4 (the four ethics specs) died `server_dead=1, conn_errors=5` **twice**, stranding 32 tests. ⚠ **Zero assertion failures anywhere in the run**; the gate is right to refuse green, because unrun ≠ passed. Batch 4 re-run standalone on a fresh server: **67 passed · 0 failed · 0 did-not-run · 68/68 accounted · GATE GREEN**, so every collected test now carries a result. ⚠ Method note: the background-task notice reported **"exit code 0"** for a run that exited **5** — `cmd > log; echo $?` makes the compound status `echo`'s. Read the printed code, never the notification |
| 2026-08-12 | **REG·KIND · LEAD · gate step 1 ONLY.** ⚠ **NOT a tester pass and NOT `e2e:prod`** — no full-suite run was made, so this row is evidence for step 1 and for two targeted specs, nothing more. pgTAP on a **fresh `supabase db reset`**; E2E on a dev server, chromium, `--workers=1` | **Step 1 GREEN.** `typecheck` 0 errors · vitest **1254/1254** · eslint over `src`+`e2e` **0/0** + `lint:css-vars` · pgTAP **5857 pass, 183 files** (`322` re-planned 72→63 as §1 retired with the table; `298` 36→32 as GROUP G retired with its two policies). **Authz: `ARM=census` HOLDS** (452 live gates, all carry a verdict — the arm that catches a newcomer, and the two writers' signature change is what made it load-bearing here) **· `ARM=hat` HOLDS** (3 findings, all pre-existing allowlisted) **· `ARM=floor` HOLDS** (79 never-called doors, all allowlisted). **Diff-scoped door sweep** (`CASES="can_read/can_edit/can_manage_referral_internal_note referral_internal_notes_select"`) → 3 COVERED + 1 **pre-existing** `ERROR\|run-shape!=baseline` on `can_read_referral_internal_note`, verbatim the verdict it carried at HEAD — a harness class (§7.15), not a regression. The partial run TRUNCATED `docs/reviews/authz-door-audit-findings.md` (496 lines → 5); restored from HEAD, per lead-playbook §4. **E2E (targeted): `referral-registros` 16/16 · `cases-extras` 8/8.** New assertions pin the picker's **EXACT** six options on the case dialog AND on both referral sides (a subset assertion cannot catch the two surfaces drifting, which is the entire point of the change), the `note` default, the absence of the retired manage dialog **asserted for a coordinator** — the one viewer it was ever shown to, so its absence is attributable to removal and not to a permission gate — and a real `follow_up` round trip rendering "Acompanhamento". ⚠ Method note: browser-pane verification was ABANDONED, not skipped-silently — the pane was not compositing, so `getBoundingClientRect` returned zeros and programmatic clicks never reached React; Playwright against the dev server was used instead because it actually hydrates. ⚠ One self-inflicted red found and fixed in the loop: the new §2.6 default-kind probe inserted a note on `r1`, which pushed the concluded note past the index `4.18`'s open-before-concluded ordering contract asserts on — moved to `r2` rather than weakening the assertion |
| 2026-08-11 | **LEAD · FULL `e2e:prod` GATE (`REBUILD=1`)** — the prod-standalone full-suite run for the branch closing BUG-ACT-EXPIRY-1 / BUG-ACT-ACL-1 / BUG-VACUOUS-ASSERT-1 / FUP-VACUOUS-AUDIT-1. 17 batches, fresh build + fresh server + fresh DB per batch. | **GREEN after triage. 1055 passed · 1 failed · 2 flaky · 6 skipped · 0 did-not-run · 17 batches.** ✅ **COVERAGE IS COMPLETE — the summary's "accounted for 1058 of 1064" is NOT a hole:** 1055+1+2 = 1058 accounted, and the 6 skipped make up the difference exactly (batches 1r/2/4/8/15/17). Checked per the standing traps *before* trusting the number: **no `reset FAILED`**, **no batch-number gaps** (1–17 all present), denominator reconciled against `spec-counts.txt`. **The 1 failure — `phase7-cases.spec.ts` AC-HappyPath (batch 15) — is a NON-REPRODUCING FLAKE, not a regression.** Evidence, in order: (a) its two attempts failed at **different** lines — attempt 1 at L752 (`Concluído` badge), retry #1 at L564 (`Fase 2 recomendada`), and the retry failing EARLIER is the signature of attempt 1's own partial run having mutated the shared case, so the retry is not independent evidence; (b) `phase7-cases.spec.ts` alone on a fresh DB → **15/15**; (c) batch 15's **exact spec list in its original order** on a fresh DB → **67 passed / 2 skipped / 0 failed** (same 69 denominator); (d) re-run through the gate itself against the **prod standalone build** (`SPECS=… REBUILD=0`) → **GATE GREEN, 67/69**. Not in the blast radius either: the branch touches none of batch 15's four specs, and its only behavioural change (`can_manage_professional` expiry) gates 10 professional-identity/ethics-vocab write RPCs — `close_case` is not among them (catalog-derived). **Batch 1's first attempt (12 failed) was infra** — `ERR_CONNECTION_REFUSED`, the server not yet up; the gate auto-classified and re-ran it → 64 passed, 1 flaky. **The 2 flaky:** `act-role-assumption.spec.ts:157` (the hat switch) and `phase2-auth-shell.spec.ts:268` (logout redirect), both green on retry #1. Far below the documented ~18–27 flaky baseline. ⚠ The gate output also makes **FUP-VACUOUS-COVERAGE-1** visible: `phi-remediation` REM-8/REM-9 render as `-` (skipped) in every batch — they never run. |

## QA Verdicts

<!-- ONE LINE per phase/feature: verdict + date + link. The full analysis lives in
     docs/reviews/*.md — never restate rationale here or in the archive.
     Struck-through rows are superseded rounds, kept only to show a phase looped.
     Retention: current milestone only. Older concluded rows move VERBATIM to
     qa-verdicts-archive.md's "Collapsed one-line index" (the index is not rationale —
     it preserves the feature-name → review-file mapping). -->

| Phase / Feature | Verdict | Date | Report |
| --- | --- | --- | --- |
| **DM2 — orchestration + Wave A** (ADR 0114 Amdt 1 / 0117 / 0118) | ⛔ **CHANGES REQUESTED (r1)** — **1 P0** · 3 MAJOR · 6 MINOR · 4 INFO. **P0-1: DM2 obligation 2 (the M8/M9 byte-discrimination cut) was never re-expressed in `open_document_version`** — no `read_case_deliberation` conjunct anywhere in the corridor, so the ADR-0100 quality reviewer is **SERVED PHI-tier bytes** (probed live: `SERVED tier=phi`, outsider control `P0002`); the only shipped control is `canDownload={!isOversight}`, a React prop — Architecture **Rule 1** inverted. The restored E2E asserts the *button* is absent, so the green bar now certifies a UI-only control; the record says "incl. the M8 bytes-cut contract" and contains **zero** mentions of oversight/ADR 0100. Invisible to all four arms because D8 moved the boundary from a census-covered storage policy into a `jsonb` DEFINER outside every domain (INFO-1). MAJOR: S1-O4 — a doc on a `legal_privileged` interview is readable **and its PHI bytes servable** by members who cannot see the interview (parity, but Wave A makes it live — needs a PO ruling); reconciliation is blind by construction to `failed`/`abandoned` files that DO hold bytes (undisposable PHI under a `RECONCILIATION CLEAN`); "Tentar novamente" after a verification failure is a guaranteed-fail loop, each iteration an unaudited service-role full-object download. **Verified sound and re-derived from the live catalog, not accepted:** the D15 ceiling both directions + no over-narrowing + row-absence through the whole chain + creator/staff_admin/platform_admin all denied + rank genuinely consulted; the meeting/action_item seam at **both** layers (HC0D6 write-side incl. relabel; kernel fail-closed for everyone, with a `true` control); the corridor's D9/D10 state matrix exactly; the **D11 floor exactly** (creator+standard = 0 rows, denials 0, no duplicates, sole minter in the catalog); D8's zero SELECT policies on both buckets; R6/R7/R8 as a real differential + vacuity pin. **Gate figures independently reproduced on a fresh reset:** pgTAP **189f/6059 PASS** (0 `not ok`, 0 bad plans), lint 5-gate exit 0, tsc **0 errors**, vitest 1254, `ARM=census`/`hat`/`wrapper` all HOLD (569 verdicts, BLIND 41) | 2026-08-13 | [dm2-orchestration-wave-a](docs/reviews/dm2-orchestration-wave-a-review.md) |
| **DM1 — substrate cutover** (ADR 0114/0116) | ✅ **APPROVED (r1)** 2026-08-13 — 0 P0 · 1 MAJOR (fixed) · 5 MINOR · 4 INFO | [review](docs/reviews/dm1-substrate-cutover-review.md) · [gate detail](docs/progress/dm1-substrate-cutover.md) |
| **FUP batch 2026-08-12** (BUG-RDR-001 · FUP-ETH-A11Y-1 m3/m4 · FUP-ETH-KBD-1 · FUP-PDF-3 · narrative reorder 23505 · FUP-F2-BUCKETS · BUG-MIN-E2E-1 · BUG-BOOTSTRAP-001) **+ REG·KIND (ADR 0110), reviewed for the first time** | ✅ **APPROVED (r1)** — 0 BLOCKER; 6 findings, none in scope. Every claim re-derived from the **live catalog** (359 registered == 359 files) + rolled-back probes under `set local role` with real hats, never from migration text. FUP-PDF-3's DROP+CREATE doors diffed **property-by-property** — `prosecdef`/owner/volatility/leakproof/strict/`search_path`/**ACL** all intact, `returns` the only change; the `anon`-no-EXECUTE control is the right ACL-trap guard. Both "corrected premises" independently verified (**4** withheld columns, not 2; constraint was ALREADY `DEFERRABLE INITIALLY IMMEDIATE` — real cause is archived rows retaining a NOT NULL `position`). REG·KIND's table DROP is **clean: 0 orphaned policy/trigger/proc/grant/FK/type/constraint** across a full catalog sweep, 0 source refs. Bucket retirement leaves **0 reachable doors** (general `pg_policies` sweep, not by-name). §2.5's self-promotion-closure claim **tested and TRUE** (refused by `guard_profile_privileged_columns_trg`). ⚠ Two **CONFIRMED-LIVE but PRE-EXISTING** defects surfaced, outside both scopes → **FUP-REF-NOTE-1** (P2: `redact_referral_note`'s `[redigido]` masking is bypassed by 4 sibling DEFINER doors that `RETURNS referral_internal_notes` — proved as a plain `staff` **assignee**: read door serves `[redigido]`, `conclude_…` returns the real `body_md`, same txn/role/hat, plus a Rule 11 read-audit gap; the 2 doors REG·KIND rebuilt are NOT the exploitable ones) and **FUP-CASEEV-KIND-1** (P2: `case_events.kind` guarded only in TS — 16-value CHECK, no trigger, no `kind` arm in either INSERT policy; forged `decision_issued` insert **succeeded** live). Also **FUP-LINT-TEMP-1** (`npm run lint` exits 1 on gitignored-but-not-eslint-ignored `supabase/.temp/**`, so gates 2–5 **never run**; all five verified passing individually — `lint:vacuous` 178/0) + `FUP-PDF-3a` (the "can never diverge" invariant is prose-only; 323 pins today's names, not the composite ≡ GRANT set) + `FUP-RDR-001a` (all 6 alert-dialog sites structurally wired — verified each, and FocusScope's passive-effect timing confirmed in the installed source — but 3 confirm-path restores remain unmeasured, where the documented `isConnected` fall-through bites) | 2026-08-12 | [fup-batch-2026-08-12](docs/reviews/fup-batch-2026-08-12-review.md) |
| **ETH·E4** — ethics participant seating & professional identity (ADR 0108) | ✅ **APPROVED (r3)** — the 3 r2 blockers verified closed **at the source**, not from commit messages. ⚠ **r2’s MAJOR-1 was WRONG and its remedy would have REGRESSED the UI:** the catalog shows **six doors raise `P0002` deliberately in pt-BR** ("papel inválido", "organização não informada") and the engine cannot reach it (zero `INTO STRICT` in `public`/`app`) — `error.message` KEPT there, the measured reason recorded in-file so it is not re-filed a third time. The real §8 leak was the arm r2 bundled with it: **23514 is MIXED** (measured live — the engine yields `new row for relation "…" violates check constraint "…"`) → constant always; nothing user-visible lost, both pt-BR raises are pre-empted before the RPC. Also closed: the new gate’s **400-byte fail-open** window (measured 0 live — an unanchored grep says 16, all comment mentions), **two vacuous E2E assertions** — one of which my own first fix left **DEAD**, since no caller passed `assertLinkageGating` on that arm — plus **m1** (a pure read published as a Server-Action endpoint without `authorizeOrg`) and **m10**. P0-1 re-verified from the catalog (12/17 granted, projection ≡ granted set). Open items filed as **FUP-ETH-A11Y-1** + **FUP-E2E-SERVER-DEAD-1**; m2/m5 → PO | 2026-08-11 | [eth-e4](docs/reviews/eth-e4-review.md) |
| **ACT** — act-as role assumption, **STAGE 4** (D14 arm audit · standing `ARM=hat` sweep · reasoned hat-blind allowlist; ADR 0107) | ✅ **APPROVED (r1)** — 0 BLOCKER / 0 MAJOR / 6 MINOR / 3 INFO; completeness re-derived mechanically from `prosrc` as a property, both keystone mutation twins neutralized and observed red | 2026-08-10 | [act-as-stage-4](docs/reviews/act-as-stage-4-review.md) |
| **ACT** — act-as role assumption, **STAGE 3 build review** (ADR 0106) | ✅ **APPROVED (r2)** — r1 was ⛔ on 1 BLOCKER + 2 MAJOR (hat-blind caller gates on the membership-grant door and `can_manage_professional`), fixed in `20260918002800` + keystone `318`; r2 re-derived the population **by property** (61 caller-bound pairs, no third member) rather than accepting the two-instance fix. MAJOR-2 promoted to the pilot-gate check (*Remaining pre-pilot work* item 0). Verbose row + the three lead errors it recorded → archive | 2026-08-10 | [act-as-stage-3 (r1+r2)](docs/reviews/act-as-stage-3-review.md) |
| **ACT** — act-as role assumption, PRE-BUILD plan review (ADR 0106) | ✅ **APPROVED (r2)** — verbose row → archive | 2026-08-09 | [act-as-plan (r2)](docs/reviews/act-as-plan-review.md) |
| ~~**ACT** — act-as role assumption, PRE-BUILD plan review, round 1~~ | ⛔ CHANGES REQUESTED — verbose row → archive | 2026-08-09 | [act-as-plan (r1)](docs/reviews/act-as-plan-review.md) |
| _Phase 0 → Phase 16_ — **99 concluded rows** (81 rotated 2026-08-06 + 18 rotated 2026-08-10: QO·B · PDF·P2 · PDF·P1 · QO·FUP · QO·A · MIN · AFF · PCI · TV · Phase 16, incl. struck loop rows) | — | — | [collapsed index](docs/progress/qa-verdicts-archive.md) |

## Decisions

<!-- One line per decision; full rationale in docs/decisions/ (ADR) + docs/progress/decisions-log.md -->

| Date | Decision | Ref |
| --- | --- | --- |
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
- 🟢 **FUP-DM1-CEILING** — **DB HALF DISCHARGED 2026-08-13 by DM2·S1** (`5dbeb76`; migrations `20260924000100`+`…000200`, ADR [0117](docs/decisions/0117-dm2-s1-confidentiality-ceiling-decisions.md), record [dm2-orchestration-wave-a.md](docs/progress/dm2-orchestration-wave-a.md)). The ceiling is live and **lead-verified against the catalog, not from the report**: on one case with one reader, label as the sole variable → plain `t` / `legal_privileged` `f` while `can_read_case` stays `t`, so the denial is the ceiling and not lost home access; the seam guard admits `ethics_investigation` on a meeting home and refuses `legal_privileged` (HC0D6, pt-BR). **Remaining to close:** pgTAP `228` **t40** + the two open-door pins (S1-O1) ride S2's `open_document_version`, and E2E **AC-4a–d / AC-9** ride S4. — **RULED 2026-08-13 (ADR [0114](docs/decisions/0114-document-model-redesign.md) Amendment 1 D15/D16)**: option 1 — re-express the ADR 0072 D7 ceiling as a nullable confidentiality column on `documents` + a `can_read_document` kernel arm, **interim**; the general access plane is **scheduled at Phase 19** (landing point `documents.access_policy_id`). No longer a blocker — now a **DM2 Wave A PREREQUISITE** (build before Wave A re-points any document). Option 3 rejected. Discharge = D15 shipped + pgTAP `228` t36–40 and E2E AC-4a–d/AC-9 restored as an ADR 0114 amendment — PO/lead → [body](docs/progress/follow-ups.md)
- 🟠 **FUP-DM1-E2E** — ✅ **parking DONE 2026-08-12** (tester): 6+1 attachment-touching E2E specs/blocks PARKED by the DM1 substrate drop (`20260923000100`) and verified green on a fresh reset — corrected 3 of the 6 file predictions + found 1 unlisted test (IV2-11); discharge = DM2/Wave A rewrites them against the document model per ADR 0114 D5 (rewritten, never merely deleted) — tester (park ✅) + DM2 (rewrite) → [body](docs/progress/follow-ups.md)
- 🟠 **FUP-DM1-DISPOSE** — `dispose_case_phi` lost its attachment-redaction step in DM1 (a PHI erasure path losing a step; no-op today, zero rows carried bytes); discharge = DM2 wires case PHI erasure to document disposition (D10) with a mutation-proven keystone, before Wave A's flag flips ON — backend (DM2) → [body](docs/progress/follow-ups.md)
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
