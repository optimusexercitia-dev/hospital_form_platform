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
| DM | **Document Model Redesign** [0114](docs/decisions/0114-document-model-redesign.md) (+**Amdt 1** D15/D16, +**Amdt 2** D17 — ethics seams → Wave B; supersedes [0063](docs/decisions/0063-centralized-attachments-substrate.md)) · plan [DM0–DM5](docs/plans/document-model-redesign.md) | ✅ **DM0 + DM1 + DM2 + DM3 complete** — DM3 (Wave B: controlled documents) PO-approved **2026-08-14**. 🔵 **DM4 (Wave C: referrals) RE-OPENED 2026-08-14** after a same-day hold (the PO shipped referral layout commit `87cd1ddb` first, then released it). **DM0–DM3 are now MERGED to `main`** — merge `17b1516b`, `--no-ff` so the program has one revertable landing point; tree byte-identical to the branch; **still NOT pushed** (`main` is 136 ahead of `origin/main`). Step 0 (the plan's mandatory re-verification) is **✅ DONE** → [dm4-surface-verification.md](docs/progress/dm4-surface-verification.md). **No DM4 code, migration or plan exists yet** | ✅ DM3: **11 migrations** `20260925000100`–`001100` · pgTAP suite **330** · `328` K8c-only edit · ADR 0114 **Amdt 2** | ✅ fresh reset 0 · pgTAP **190f/6152 PASS** · tsc 0 · lint 5/5 · vitest 1258 · `ARM=census`/`hat`/`floor`/`FROMFINDINGS=1 wrapper` **all HOLD** · diff-scoped sweep **BLIND 0** · `e2e:prod` **GATE GREEN** (0 failed, 0 did-not-run, accounting closes exactly) | ✅ **APPROVED (r2)** [review](docs/reviews/dm3-controlled-documents-review.md) — r1 ⛔ 1 MAJOR discharged; **no binding pre-merge condition** | ✅ **2026-08-14** | 2026-08-14 | ⚠ **branch `docs/dm1-plan-amendments` — NOT merged to `main`, nothing pushed** (standing PO directive; `main` = `f84c6b6`). **All DM flags ship OFF.** graphify refresh SKIPPED (fires post-merge). **Records:** [DM1](docs/progress/dm1-substrate-cutover.md) · [DM2](docs/progress/dm2-orchestration-wave-a.md) · [DM3](docs/progress/dm3-controlled-documents.md). **OPEN with the PO:** the **146-function census blind class** (unruled) · S1-O3 · O1/O2/O4 |
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

### 🔵 IN PROGRESS — **DM4: Wave C — referrals** (opened 2026-08-14)

> **Step 0 ✅ — the plan's mandatory surface re-verification is DONE.** Full evidence:
> [dm4-surface-verification.md](docs/progress/dm4-surface-verification.md). Derived from the
> **live catalog**, then diffed against the plan text in *both* directions — the second
> direction is where all three of this program's historical drop-list misses lived.
>
> **Everything the plan names is CONFIRMED live** (DM1's deliberately-spared referral surfaces
> have not drifted), with **one rename**: the plan's `getReferralReplyAttachmentUrl` does not
> exist; the live function is **`getReferralAttachmentUrl`** (`src/lib/queries/referrals.ts:1112`).
>
> **6 UNNAMED-BY-PLAN surfaces.** None match `%attachment%`, so the sweep style that built the
> plan's list could not have found them — the same blind spot that missed
> `case_documents_select_member` the first time. The two load-bearing ones:
> **`get_referral_snapshot_document_path`** (the actual RPC behind `getReferralDocumentUrl` — the
> read seam) and **`add_referral_shared_item`'s `document` arm** (fails closed on `HC0DM` today —
> this *is* the write seam plan step 1 must un-park). Retiring either without naming it leaves
> the seam half-migrated.
> ⚠ **`referral_shared_item.source_document_id` carries NO FK** (verified `NONE`, nullable) —
> DM1 dropped it deliberately (ADR 0116 D1). DM4 **creates** that constraint, it does not migrate one.
>
> 🔴 **NEW, and it changes DM4's assurance plan: both DM4 write seams sit in the UNRULED census
> blind class.** `add_referral_shared_item` and `add_referral_reply_attachment` are both
> `prosecdef=true` returning **composite** types and auth-reachable — so **no §6 step-1 arm can
> see them**; `census`/`hat`/`floor`/`wrapper` will all pass no matter what DM4 does to that door.
> DM4 therefore needs **bespoke pgTAP keystones** for these two, exactly as DM2 did for
> `open_document_version` (blind for returning `jsonb`; ADR 0118 §12). Measured class size **150**
> against the recorded **146** — ⚠ delta **unreconciled**, treat as unexplained, not as growth.
> This turns the long-parked "146-function census blind class" open item from abstract into
> directly load-bearing for the next phase.
>
> ℹ️ `add_referral_reply_attachment` has **zero UI callers** — `referral-reply-dialog.tsx` ships a
> disabled placeholder ("Anexos da resposta poderão ser adicionados após concluir"). The reply
> path is inert in the product today, which makes it cheap for DM4 to re-point.
>
> **Baseline E2E: 🔴 RED → ✅ GREEN, and DM4 wrote none of it.** Before DM4's build opened, the
> 4 referral specs ran `51 passed · 2 failed · 36 did-not-run` (coverage 89/89) — ⚠ *2 was a
> FLOOR, not a total*; batches abort at first failure. Both reds **attributable to `87cd1ddb`**
> (DM3's `e2e:prod` was green across these specs; it is the only change since) and both
> **locator/label drift — no authz or data defect, no `.sql`, no `src/lib/**`**. Fixed by
> `9b0a8d85` (tester, **specs only**). **Lead-verified independently**, `RESET=1 RETRIES=0`:
> `89 passed · 0 failed · 0 infra · 0 flaky · 0 did-not-run`, coverage **89/89** · lint 5/5
> (`lint:vacuous` 0 findings / 180 spec files) · tsc 0.
> ⚠ **The check that matters: 89 collected BEFORE and AFTER** — a suite can be made green by
> deleting tests; this one was not. Net assertions **+6**.
>
> ⭐ **The reusable lesson — a UI-only commit red-lined the suite and every static gate stayed
> green.** No SQL, no `src/lib/**`; a default-closed dialog plus one renamed pt-BR label
> ("Registro" → "Descrição", PO-confirmed intended) was enough, and `registroForm()` was shared by
> 4 tests. tsc + lint 5/5 were green throughout. Three collisions surfaced that nobody predicted:
> the new `Descrição` label collides with the referral's own description `<section>`;
> `NativeSelect` folds **every `<option>`'s text** into the wrapping `<label>`'s accessible name,
> so `exact: true` can *never* match (use `/^Tipo/`); and "Vincular caso" matches both the button
> and its own empty-state hint.
> ⚠ **Assertions were removed against a component DOC COMMENT** (the Detalhes card's "Nothing
> else" note). The comment was accurate *this time* — verified against `thread-events.ts`, which
> genuinely synthesizes `sent`/`received`/`decided_accepted`/`concluded`/`withdrawn` with 11 unit
> tests, and `referral-thread-event.tsx:45` emits `data-thread-event`. **The verification, not the
> comment, is what made the removals safe** ([[a-comment-is-an-assertion-that-goes-stale-silently]]).
> 🔶 **Residual gap, recorded not blocked:** `received` / `concluded` / `withdrawn` have unit
> coverage for *synthesis* but **no E2E assertion that they reach the screen** (E2E asserts 5
> kinds: `assignment`, `case_linked`, `decided_accepted`, `resolution`, `sent`). The old DET tests
> touched `Recebido`/`Concluído`; that is the one thing genuinely thinner now.
>
> ⚠ **Attribution note:** this S4 block was written by `frontend` but was swept into the lead's
> commit `e7b44bea` by a concurrent `git add` — that commit's message describes **only**
> FUP-PGTAP-VACUOUS and understates what it carries. Content is correct; authorship is
> misattributed. **Not amended** (frontend committed on top of it, and rewriting history under a
> live teammate is how HEAD moves out from under someone). Recorded instead, per the standing
> scar: *a commit's own message is not a report of what it committed* — blame by measuring the
> commit, never by reading it. **Two agents sharing one worktree share one index.**
>
> **S4 (frontend) — ✅ BUILT** 2026-08-14, against `backend`'s S0 contract (`67c0fe04`); no
> provisional local shapes. Bar: tsc 0 · lint **5/5** · vitest **1258** · `next build` EXIT=0.
> ⚠ Runtime unproven by design — the S1/S3 action bodies still throw `not implemented`.
> - **R1 discharged**: the disabled placeholder is gone; `referral-reply-attachments.tsx` is a real
>   begin → PUT → finalize control (reusing Wave A/B's `uploadDocumentFile` credential transport,
>   incl. its MAJOR-3 `terminal` no-retry contract). It lives INSIDE the reply dialog because the
>   write authority is `accepted`/`in_review` — the old copy ("após concluir") named the one window
>   the DB refuses.
> - **F-14 discharged**: both detail pages stopped pre-signing at render (a 120 s PHI credential is
>   dead before the reader reaches it, and signing on render hands out bytes with no audited open).
>   Opens are now click-time via `referral-open-file-button.tsx`.
> - **Corridor gate, not last-step**: the whole three-step corridor lives in ONE component with ONE
>   mount site, behind `attachments.enabled` — grep-verifiable. Flag OFF ⇒ no control, no `begin`,
>   no reservation, no bytes; `listReferralReplyDocuments` is **not called**.
> - **`canOpen: false` renders visible + explained + non-interactive** (badge + sentence, never a
>   hidden row, never a probe of the open door). ⚠ Deliberately UNLIKE Wave A, which deleted that
>   branch as unreachable — here visibility and bytes are two DIFFERENT predicates by design, so
>   the state is reachable and hiding the row would misreport the reply's contents.
> - 🔶 **Contract gap for the lead**: `SharedItem` has no `canOpen` twin, so a metadata-tier reader
>   still gets an open affordance on a frozen document that refuses at click time (pt-BR mapped,
>   not raw). Symmetry with `ReferralReplyDocument.canOpen` would close it.
> - 🔶 **Open question**: the DT page offers the upload control (the DT *is* the target side);
>   whether `can_write_document`'s referral arm admits the DT office is backend's to confirm.
>
> **S0–S3 + S5 (backend) — ✅ BUILT** 2026-08-14 (ADR [0119](docs/decisions/0119-dm4-referral-document-substrate-decisions.md);
> M1–M4 lead-approved; both S4 🔶 items above are CLOSED — `SharedItem.canOpen` shipped
> (`5788352e`, door-equivalent predicate, lane-consistent) and the DT office IS admitted
> (catalog-verified: `can_manage_referral_target` carries the `technical_director` arm; the
> legacy gate was predicate-identical — pinned by 340 B5b/B5c).
> - **Migrations `20260926000100`–`000400`** (`72c6c49c`): registry + kernel arms + freeze
>   seam + retirement. M5 DELETED (PO reset ruling — a reconciler no buildable DB needs is
>   born caller-less); its semantics live inline in M3. `frozen_storage_path` DROPPED
>   (21 refs/7 files swept by identifier; 197 §4 re-expressed deliberately, its
>   pass-by-absence hole closed with a positive control).
> - **Red-first record** (`ed759d15`, log `scratchpad/340-red-first-run.log`): 340 authored
>   pre-migration; **44/44 ⭐ keystones observed RED for the right reason** (wrong SQLSTATE /
>   wrong value / arm-denied — not mere object-absence: throws_ok code mismatches and
>   value asserts, with `pg_temp` late-binding + guarded fixtures so the file RAN to
>   completion, 68 executed / 44 red / 24 = only [CONTROL]+[MATRIX] greens).
> - **Neutralization matrix `supabase/tests/mutation/dm4-referral-doors-matrix.sh`** —
>   ⛔ the original "16/16 (`66084b4f`)" verdict was ORPHANED by M5's body rewrite (QA r1
>   MAJOR-1, the a-rename-orphans-a-name-keyed-verdict class). **Rebuilt + re-run at HEAD
>   `f8052575`: 18/18 RED-PROVEN, control green** — every mutation now carries a no-match
>   guard that RAISES; N10b re-pointed at the live M5 body; NEW narrowing cases N14a
>   (source-only gate ⇒ C11d red, C10a measured-green — the ③TWIN polarity, QA MAJOR-2)
>   + N14b (welded shut ⇒ every serve-half red). N10a corrected per QA MINOR-2: ONE
>   predicate (`can_read_referral_phi`) applied at TWO points, not two independent
>   locks — the registry raise proves the audit layer refuses, nothing about the door's
>   gate; N10b bypasses both applications. A matrix verdict is citable only with the
>   HEAD it was measured at.
> - **Gate numbers on a FRESH reset:** registry 390 == disk 390 (max `20260926000400`) ·
>   pgTAP **191 files / 6203 tests — exactly ONE red: `236`** (its `case-documents`
>   boundary + the u1 harness's injection target were retired by M4 — **stop-and-tell filed
>   with the lead; 236/u1 deliberately NOT adapted unilaterally**) · tsc 0 · lint 5/5 ·
>   vitest 1258. Authz arms + diff-scoped sweep: **not yet run — lead sequences them.**
> - **Contract changes relayed:** `SharedItem.frozenStoragePath` REMOVED;
>   `DocumentHomeResourceTypeDb` minted (API = 5 UI homes + `case_referral`) so per-home UI
>   maps stay total; legacy `addReferralReplyAttachment` removed (RPC/table gone); both
>   legacy signed-URL getters neutered to `null` until S4 removes their call sites.
> - HC072's stale message text: NOT touched (outside the diff, per lead ruling).

> ## ✅ GATE STEP 1 (Build complete) — **GREEN, LEAD-VERIFIED** 2026-08-14 @ `48662f64`
>
> ⚠ **Every figure below was re-run by the lead**, not accepted from the teammate report — the
> backend numbers were produced after a session of mutation runs and sweeps against the same
> shared stack, and this project has previously left an authz gate OPEN that way.
>
> | check | result |
> | --- | --- |
> | fresh `supabase db reset --local` | **exit 0**, clean |
> | `npm run test:db` | **Files=191 · Tests=6229 · Result: PASS**, 0 failing files |
> | `npm run typecheck` | 0 |
> | `npm run lint` (5 gates) | 5/5 · `lint:vacuous` 180 files / 0 findings |
> | `npm run test` (vitest) | 86 files · **1258/1258** |
> | `npx next build` | **EXIT=0** (frontend-run — the gate a client→server value-import aborts while tsc/lint/vitest stay green) |
> | `ARM=census` *(has anything ever asked?)* | **HOLDS** — 569 gates carry a verdict, no unswept newcomer |
> | `ARM=hat` *(any door reading `memberships` hatless?)* | **HOLDS** |
> | `FROMFINDINGS=1 ARM=wrapper` | **HOLDS** — BLIND set 41, all allowlisted |
> | `ARM=floor` *(is every door called?)* | **HOLDS** — 74 never-called doors, all on the floor allowlist |
> | diff-scoped door sweep | **2 cases run** (not 0 — the NO-OP trap did not bite): `can_read_document` **COVERED**; `can_write_document` **ERROR**, dispositioned below |
> | neutralization matrix | ⛔ **the 16/16 recorded here was STALE — see the correction below**; now **18/18 RED-PROVEN at `f4d03f44`** |
> | catalog left unmutated? | ✅ verified — neither kernel gate carries a blanket `return true` |
> | findings file restored? | ✅ 594 lines, not the 28-line subset stub |
>
> **⭐ `ARM=floor` was VIOLATED on its first run — a genuine catch, not a formality.**
> `list_referral_reply_documents` shipped with **no keystone caller**. Fixed with a **driving
> keystone (340 E4a/E4b), NOT an allowlist entry** — allowlisting would have turned the arm green
> while the door stayed uncalled, which is precisely the blindness the arm exists to detect.
>
> **The one sweep `ERROR` is dispositioned, not waved through.** `can_write_document`'s blanket
> neutralization **was noticed** (DM1-era keystones M1·4b + DEVIATION-2 went red) but also aborted
> a file (6188 < 6229) ⇒ `run-shape≠baseline`. §6 requires an ERROR be covered by the phase's
> mutation audit: matrix **N4/N5** open its two referral barriers with **targeted** mutations,
> both RED-PROVEN. The runlog was read rather than the verdict taken at face value.
>
> **Red-first evidence, classified rather than counted.** 340 ran against the *unmigrated* catalog:
> **68 assertions, 44 red, 24 green — the 24 greens are exactly the labeled [CONTROL]/[MATRIX] set,
> zero unexplained.** The 44 split into the **strong** class (ran against live code and returned the
> *wrong answer* — registry probes, kernel `else false` arms, `get_referral_detail` missing successor
> keys, `throws_ok` catching a *different* SQLSTATE) and the **weak** class (red merely by *absence*).
> ⚠ Absence-red proves authorship-before, **not falsifiability** — which is why every one of those
> was separately proven post-migration by opening its gate and requiring red.
>
> **Getting to zero surfaced 2 further DM4-caused reds, both fixed at the right layer:** `326 t1`
> refused a precautionary `securable_type` column GRANT (grant-set ≡ view is the pinned invariant —
> the **grant** was removed, the pin was not widened); and `330 DM3·B3`'s positive control had been
> anchored on the very `case-documents` policy DM4 retires — re-anchored, the
> [[vacuity-control-anchored-on-a-defect]] class.
>
> **E2E flag reachability confirmed:** `seed.sql` forces `documents_wave_c = true` for local/E2E
> (prod ships OFF), and both detail pages **server-resolve** it. ⚠ Naming hazard for QA, briefly
> fooled the lead: the dialog prop is named **`attachments`** and its `.enabled` carries
> `documents_wave_c`, while a feature-flag key **literally named `attachments`** sits at `false`.
> Confusing, not defective.
>
> **↻ Re-confirmed at HEAD `91b8b842` after M5 + the E2E commits (backend, exclusive stack):**
> fresh reset → **Files=191 · Tests=6231 · Result: PASS**, 0 failing files, **0 `# Failed test`,
> 0 `deadlock detected`, 0 `Bad plan`**. Arithmetic closes exactly: **6229 + C10c + D8c = 6231**.
> Registry **391 == 391** files on disk, max `20260926000500`. **All four arms HOLD** —
> `ARM=census` re-run *specifically* because `5ac8d849`/`b121740e` landed after the previous arm
> pass, and census is the arm that catches a gate nobody has asked about yet; confirmed, not assumed.
> ⚠ **The earlier `test:db` deadlock aborts (7 then 10 files) are now proven to be contention, in
> both directions:** same tree, same reset discipline — with an 11-connection pool attached they
> abort, with the stack exclusive they vanish. **No real finding behind them.**
>
> ## ⛔ GATE STEP 3 (QA) r1 — **CHANGES REQUESTED**: 0 P0 · 3 MAJOR (2 blocking) · 8 MINOR · 6 INFO
> Review: [dm4-referrals-review.md](docs/reviews/dm4-referrals-review.md). **Both blockers
> discharged in `f4d03f44`**; r2 pending.
>
> ⚠ **MAJOR-1 was the lead's error and is the phase's sharpest lesson.** I recorded "matrix 16/16
> RED-PROVEN", then wrote "↻ Re-confirmed at HEAD" after re-running **pgTAP, the arms and the
> build — but NOT the matrix**, carrying a stale verdict forward under a heading that claimed
> otherwise. QA measured it: `N10b`'s `replace()` needle searched for the **pre-M5** `'{}'::jsonb`
> call, and **M5 itself rewrote that body** to `jsonb_build_object(…)` ⇒ needle dead, N10b silently
> degenerated into N10a, `[C11b]=ABSENT`, exit non-zero. ⭐ *A rename orphans a name-keyed verdict —
> policies follow a rewrite by OID, **`prosrc` does not**.* **M5's own commit message cited that
> lesson while breaking it.** QA bounded the blast radius by measurement (the other 13 needles still
> matched), so the write seam's proofs survived.
> **Structural fix, harness-wide, not just N10b:** every mutation now runs through a guarded `mut()`
> — **a `replace()` matching nothing RAISES** (*"orphaned by a body rewrite — fix the needle against
> the LIVE catalog"*) — and the verdict line now **prints its own HEAD**, because *a matrix verdict
> is citable only with the commit it was measured at*.
>
> **MAJOR-2 — a false coverage claim standing over correctly-deleted proofs.** `u1-mutation-audit.sh`
> asserted the deleted injections were matrix-covered by N10a/N10b/N11; the matrix contained **no
> C10a, no C11d, no D4a — zero of four**, and only C11d carries ③TWIN's polarity (C10a reads as the
> *source* coordinator, the wrong side). Closed by **N14a** (gate narrowed to source-only ⇒ **C11d
> red while C10a stays GREEN**, with must-stay-green patterns so the polarity is *measured*, not
> prose) and **N14b** (door welded shut). Comments now claim only what is measured; retirement pins
> (D4a, 325-t4) are recorded as a **different category**, no longer counted as mutation coverage.
>
> **MAJOR-3 → PO ruling: DEFER to the Phase 19 access plane** (ADR 0114 Amdt 1 **D16**), which must
> cover both widening and narrowing. `add_referral_shared_item` checks referral-**source** authority
> but never `can_read_case` / `can_read_document`, so a **recused** coordinator can freeze a case's
> PHI documents into a referral — QA demonstrated it live in a rolled-back txn (`can_read_case=false`
> **and** `can_read_referral_phi=true` for the same user+case). ⚠ **The gap stands, behind a flag
> that will eventually be turned on** — filed as **FUP-DM4-RECUSAL** and named in Phase 19's scope.
> Not P0 (flag ships OFF). D4 reasoned about this seam for the D15 *clearance* plane and never
> considered the *case-capability* plane.
>
> **Two records corrected by QA — both were mine, both reported to the PO as fact:**
> 1. **Census delta resolved: neither figure reproduces.** The exact recorded definition yields
>    **141** at HEAD (144 allowing `proretset`, 145 including `app`); DM4 removed one member ⇒ **142
>    pre-DM4**. I had reported 150 vs a recorded 146 as "unexplained growth" — *the discrepancy was
>    in the recording, not the population.*
> 2. **N10a is NOT two independent locks.** `app._audit_access_authorized`'s `referral.viewed` arm
>    **IS `can_read_referral_phi`** — **one predicate applied twice**. Same observable behaviour,
>    far less security value: one predicate wrong breaks both checks. I recorded the engineer's
>    reassuring reading without probing the second guard's predicate.
>
> **Still owed:** QA **r2** → step 4 human → step 5 Record (PROGRESS rotation · `docs/backend-state.md`
> · **graphify refresh, outstanding since the DM0–DM3 merge**).

> ## ✅ GATE STEP 2 (Test pass) — **GREEN, LEAD-RUN** 2026-08-14 @ `5ac8d849`
>
> ```
> batch 1 -> 69 passed · 0 failed · 0 flaky · 0 did-not-run · accounted 69/69
> batch 2 -> 30 passed · 0 failed · 0 flaky · 0 did-not-run · accounted 30/30
> GATE SUMMARY: 99 passed · 0 failed · 0 infra · 0 flaky · 0 did-not-run · 2 batches
> COVERAGE: accounted for 99 of 99 collected tests          RESET=1 REBUILD=1 RETRIES=0
> ```
>
> **No regressions:** the 4-spec baseline is **89/89**, identical to the pre-DM4 measurement taken
> before a line of DM4 existed. **0 did-not-run** — the 9 tests hidden behind the earlier failure
> all ran and passed.
>
> ### What the runtime pass proved that nothing before it could
>
> Everything prior was DB-layer, static-gate or **absence** proof. Now:
> - ⭐ **Byte round trip** — real browser file input → client PUT → finalize → **click-time** door,
>   `Buffer.compare(returned, sent) === 0`, sha256 match.
> - ⭐ **Derivation** — a **lie declared at `begin`** (`declaredSize: 1`, `text/plain`) is discarded;
>   the server's derived size / MIME / sha256 win. *A round trip that trusts the client's declared
>   metadata proves far less than it appears to.*
> - **Click-time doors survive a real ~125 s wait past the 120 s PHI TTL** — the regression that
>   design exists to prevent, tested against the actual clock rather than a mock.
> - **`canOpen: false`** renders visible + explained + non-interactive, and **route interception
>   counted 0 calls** to either audited RPC — the UI does not call the door to learn the answer.
> - **Flag-off refuses at `begin_document_upload` (`HC0D7`) before any `documents` row exists**
>   (count unchanged) — the corridor gated at its FIRST residue-producing step, which is exactly
>   the defect DM3 shipped.
> - **DT admission + both negatives**; **R3** (`HC0DC` refuses an enforcing label, 0 rows created),
>   **R4** (a later label does not retract), **R5** (soft-delete keeps, disposal refuses `HC0DD`).
> - **Audit exactness** on the new `metadata->>'kind'` discriminator, exact counts, unweakened.
>
> ### 🐞 One real defect found and fixed — BUG-DM4-DUP-1 (`5ac8d849`)
>
> The reply-attachment list rendered the just-uploaded file **twice** (strict-mode violation, *not* a
> timeout). `finalize` → `revalidatePath` → RSC refetch returns `initialDocuments` **already
> containing** the new row, while the still-mounted dialog holds its optimistic copy of the same
> `documentId`; the list **concatenated** the two. ⚠ **A race, not a condition** — it survived the
> engineer's whole dev loop and surfaced only on **prod-standalone**; a green run had *lost* the
> race, not avoided the bug. Fixed by merging through a `Map` keyed on `documentId`.
> ⭐ **The engineer caught a SIBLING race the lead never asked about:** seeding the map from
> `initialDocuments` would put a fresh upload at the END pre-refetch and the FRONT after (the query
> returns newest-first) — a second timing-dependent DOM change of the same family. Optimistic rows
> are seeded **first** so each already holds its final position. **It flagged this as a deviation
> from the instruction rather than doing it silently.**
> ⛔ **The spec was never weakened.** The tester refused to relax the locator and traced the cause
> into a file it does not own without touching it. **Strict mode doing its job is the feature.**
>
> ### ⚠ Process record: 3 shared-stack collisions, 2 of them the lead's
>
> Multiple agents, **one worktree and one database, with no lock**. (1) A concurrent `git add` swept
> a teammate's PROGRESS.md block into the lead's commit, whose message then understated its content.
> (2) The lead resumed `backend` mid-batch; its migration restarted the DB under a running suite
> (4 timeouts). (3) The lead told `tester` the stack was exclusively its, then ran its own gate on
> it — producing a **contaminated GATE RED (3 failures)** that was discarded. **Every collision was
> caught by artifacts** (container `StartedAt`, row counts, a strict-mode violation), **never by an
> agent reporting it.** ⭐ `tester` refused to hand over a number it could not trust — *"I don't want
> to give you a false green OR a false red"* — and that refusal is what prevented a false report.
> Standing rule for the rest of the phase: **the lead runs every gate, alone; no teammate touches
> the database.**

### ✅ COMPLETE — **DM3: Wave B — controlled documents** (opened + completed; PO-approved 2026-08-14)

> ✅ **PO-APPROVED 2026-08-14 — all five §6 gate steps passed.** QA **r2 = APPROVED**
> (MAJOR-1 discharged, **no binding pre-merge condition**) after r1's ⛔ CHANGES REQUESTED
> (0 P0 · 1 MAJOR · 4 MINOR · 5 INFO).
> **Gate:** fresh `db reset` 0 · pgTAP **190f/6152 PASS** · tsc 0 · lint 5/5 · vitest 1258 ·
> `ARM=census` (*has anything ever asked?*) / `ARM=hat` (*any door reading `memberships`
> hatless?*) / `ARM=floor` (*is every door called?*) / `FROMFINDINGS=1 ARM=wrapper` — **all
> HOLD** · **diff-scoped door sweep `BLIND: 0`** · `e2e:prod` **GATE GREEN** (1101 passed ·
> 0 failed · **0 did-not-run**; accounting closes exactly, every batch `accounted N/N`).
> **11 migrations** `20260925000100`–`001100` · pgTAP suite **`330`** (labels `DM3·<Sec><n>`) ·
> `328` edited (**K8c only** — K8a/K8b survive for DM4/Wave D).
> ⛔ **State:** branch `docs/dm1-plan-amendments` — **NOT merged to `main`, nothing pushed, no
> `db push`** (standing PO directive). **All DM flags ship OFF.** graphify refresh deliberately
> **SKIPPED** — it fires after a merge to `main`, which has not happened.
>
> **The three findings worth carrying forward:**
> 1. ⭐ **P0-DM3-1** — M1 added the registry FK **and backfilled**, but never taught the CREATE
>    path to satisfy it, so **since M1 every attempt to create a controlled document raised
>    23503** — the product's wizard, not just `seed.sql`. **The backfill masked it from every
>    incremental run**; only the mandatory fresh reset could see it. Fixed by M8 (door) + **M9,
>    a `BEFORE INSERT` trigger**, after four more writers were found — *satisfying the FK by
>    construction rather than at N hand-mirrored call sites*.
> 2. ⭐ **QA MAJOR-1** — `documents_wave_b` gated the **last step** of the corridor, not the
>    corridor: flag OFF still created the document, reserved a path, **PUT real bytes**, and
>    finalized. **The one untested arm held the defect.** M11 moved the assert to
>    `begin_document_upload` — *the first step that produces residue* — **scoped to the home
>    type**, with `DM3·T3b` as the control against silently killing Wave A.
> 3. ⭐ **The byte round trip is proven** — byte equality end to end (`Buffer.compare === 0`),
>    with derivation proven by `DM3B-2` **declaring a lie at `begin`** and requiring the truth
>    to win. Everything before it was a DB-layer proof or an **absence** proof.
>
> **Full detail rotated → [dm3-controlled-documents.md](docs/progress/dm3-controlled-documents.md)**
> (the P0, the QA MAJOR, the `supabase/` index incident, the census-domain edge, the stale
> allowlist, all five lead errors, and every gate figure).
>
> **Open with the PO — do not assume:** the **146-function census blind class** (DEFINER,
> composite-returning, auth-reachable — no arm can see them; DM3 added one, the class predates
> it) is **STILL UNRULED**: schedule the domain widening or accept it as a recorded backlog.
> Also open: **S1-O3**, ADR 0114 **O1/O2/O4**, **S2.8** `reclassify_document` (closed in DM2 —
> do not re-open).

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

### 🟠 BUG-DM4-DUP-1 — the reply-attachment list renders the just-uploaded file TWICE (owner: `frontend`)

Filed 2026-08-14 (DM4 gate step 2). Surfaced as a **strict-mode violation, not a timeout** —
`DM4-RT-1`'s row locator resolved to **2 elements** with identical title and size. Mechanism traced
from source by `tester` and **independently verified by the lead**; it is a defect, not a locator fault:

- `src/components/referrals/referral-reply-attachments.tsx:135` builds its row list as a **plain
  concatenation with no dedup**: `[...initialDocuments.map(d => ({key: d.documentId, …})), ...uploaded]`.
- `:181` appends the optimistic entry with `key: finalized.documentId` — **the same id** as the
  server row it just created.
- `src/lib/referrals/actions.ts:521` → `revalidateReferrals()` → `:80`
  `revalidatePath(REFERRAL_DETAIL_PATH, 'page')` on **every** successful finalize.
- `revalidatePath` on a mounted route makes Next refetch the RSC payload; `page.tsx` re-runs
  `listReferralReplyDocuments`, which now **includes** the new attachment, and passes it down as
  `initialDocuments`. The dialog does not unmount, so `uploaded` still holds its copy ⇒ **two `<li>`,
  same React key** (React also logs a duplicate-key warning and renders both anyway).

⚠ **Timing-sensitive, not conditional** — it depends on whether the refetch resolves before the
assertion, which is exactly why it can differ between dev and prod-standalone. **The bug exists
regardless of whether a given run reproduces it**; non-reproduction only means the race was lost.
⛔ **Do NOT fix this by relaxing the locator** — `tester` correctly refused to. Fix is id-based dedup
(merge by `documentId`, e.g. a `Map` with `uploaded` winning ties).

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
| 2026-08-13 | **DM3 Wave B · TESTER · quick-loop, chromium, `--workers=1`, fresh reset.** ⚠ NOT `e2e:prod`. 5 specs re-pointed onto the core model + new `dm3-wave-b-documents.spec.ts` | **GREEN — 47 collected / 47 ran / 47 passed / 0 skipped.** ⭐ Byte round trip proven (`Buffer.compare === 0`; derivation proven by declaring a lie at `begin`). **No bug filed — no application defect**: all 9 baseline reds tester-owned. Detail: [dm3-controlled-documents.md](docs/progress/dm3-controlled-documents.md) |

## QA Verdicts

<!-- ONE LINE per phase/feature: verdict + date + link. The full analysis lives in
     docs/reviews/*.md — never restate rationale here or in the archive.
     Struck-through rows are superseded rounds, kept only to show a phase looped.
     Retention: current milestone only. Older concluded rows move VERBATIM to
     qa-verdicts-archive.md's "Collapsed one-line index" (the index is not rationale —
     it preserves the feature-name → review-file mapping). -->

| Phase / Feature | Verdict | Date | Report |
| --- | --- | --- | --- |
| **DM4 — Wave C: referrals** (ADR [0119](docs/decisions/0119-dm4-referral-document-substrate-decisions.md) D1–D10) | ⛔ **CHANGES REQUESTED (r1)** — **0 P0 · 3 MAJOR (2 blocking) · 8 MINOR · 6 INFO.** **MAJOR-1: "16/16 RED-PROVEN" does not reproduce at HEAD.** Matrix case **N10b**'s second `replace()` is a **silent no-op** — M5 (`726032fc`) rewrote `open_referral_snapshot_document`'s `log_audit_access` call to `jsonb_build_object(…)` and the harness still searches for the `'{}'::jsonb` form; measured live: `N10b_replace_matches = false`. `git log -- …matrix.sh` shows **one commit, `66084b4f`, predating M5**, and the "↻ Re-confirmed at HEAD" pass re-ran pgTAP + arms + build, **not** the matrix. N10b degenerates into N10a → txn aborts → `[C11b]=ABSENT` → the script exits **non-zero**. **Bounded by measurement, not assumed:** I checked all 13 other `replace()` needles against their live bodies — N1/N2/N3/N4/N5/N6/N7/N8/N9a/N9b/N10a-gate/N11/N12/N13 **all still match**, so the write seam keeps valid proofs; what is lost is the C11 family's can-fail proof. ⚠ M5's own commit cites the lesson it broke ("a replace that matches nothing silently no-ops") and guarded the *migration*, not the harness. **MAJOR-2: the retired ③TWIN lost its can-fail proof and the disposition comment claims coverage that does not exist.** `drop_snapshot_arm` + `restore_casedoc_member` were **deleted** (correctly — their target policy is gone), but `u1-mutation-audit.sh:133-140` asserts the successors are "matrix-covered by N10a/N10b/N11"; the matrix's full pattern set contains **no `C10a`, no `C11d`, no `D4a`**, and `C11b`'s only case is the broken N10b ⇒ **zero of four covered**. Polarity gap too: ③TWIN detected **over-narrowing**; only **C11d** carries that (C10a reads as the *source* coordinator — wrong side of the boundary; C11b is a deny, passes by construction; D4a is a retirement pin). **No mutation anywhere narrows the new door** — C10a/C11d are red-first-proven only against door *absence*, the record's own "weak" class. **MAJOR-3 (live, demonstrated): the freeze corridor never checks whether the caller may read the source document.** `add_referral_shared_item` (DEFINER) resolves the doc with `resource_type='case' and home_resource_id=source_case_id and status='active'` — **no `can_read_document`, no `can_read_case`**; its only gate is `is_staff_admin_of_for(source_commission_id)`, and the byte door's gate `can_read_referral_phi` **and** `_audit_access_authorized`'s `referral.viewed` arm are the *same* predicate. Proven on the live stack (rolled-back txn, `chefe.ccih` recused from case `d0000000-…c1`, real referral `efa00000-…a1`): `can_read_case = false` · `can_manage_referral_source = true` · `can_read_referral_phi = true` ⇒ a **recused/respondent** coordinator routes around the `236` exclusion perimeter to PHI-classified bytes, audited as a normal view. Pre-existing in *shape* (the narrative arm is identical) but DM4 is what makes **document bytes** reachable — and ADR 0119 D4 reasons about exactly this seam for the D15 clearance plane while never considering the **case-capability** plane. Not P0: `documents_wave_c` ships **OFF**, actor is a trusted `staff_admin`, no cross-tenant leak. **UPHELD under challenge:** **ADR 0119 D9 is correct** — `documents_select` USING = `can_read_document`, whose `case_referral` arm is `can_read_referral_metadata`, **identical** to the retired `referral_reply_attachment_select_readable`; `list_referral_reply_documents` + `get_referral_detail` gate on the same predicate with `can_open` server-computed; `app._referral_reply_documents` is unreachable (config.toml exposes `public`+`graphql_public` only); `file_objects.storage_path` is metadata-visible but the PHI/standard buckets carry **no SELECT policy at all** (8 storage policies total) ⇒ no bytes. Also verified: sweep **ERROR** disposition **ADEQUATE** (N4/N5 both still match live; the DM1-era keystones that went red cover the other arms); exit criteria **1 ✅ 2 ✅ 3 ✅** (allowlist empty, verified live: 0 `%attachment%` routines/policies/relations/grants), **4 ⛔**, **5 🟡** (the kernel/byte twin *is* proven both directions — N1/N2/N3 → B10c/B1/B4 — it is the retired storage twin that regressed); Rules **1 🟡 · 7 ✅ · 9 ✅ · 10 ✅ · 11 ✅ · 12 ✅** (`admin.ts` is `import 'server-only'`, no client module reaches it; audit carries references, never payloads). **Census reconciled: 146/150 are BOTH wrong — the exact recorded definition yields 141 at HEAD** (144 allowing `proretset`, 145 with `app`); DM4 removed exactly one member ⇒ 142 pre-DM4; the discrepancy is in the *recording*, not the population — record the query beside the number. **MINOR-2: N10a's "two locks" are ONE predicate applied twice** (`_audit_access_authorized`'s `referral.viewed` arm *is* `can_read_referral_phi`) — so with N10b broken, nothing proves 340 reds when it is removed from both. **MINOR-4: yes, the T6 caveat placement matters** — 5/6 lives only in the commit subject while the file header at `:23-25` says "All four were observed RED" in a six-test file; coverage itself is fine. **Discharge:** re-point + re-run N10b recording its HEAD · add a narrowing mutation (or correct the false disposition comments) · a recorded PO ruling on MAJOR-3 in ADR 0119 | 2026-08-14 | [dm4-referrals](docs/reviews/dm4-referrals-review.md) |
| **DM3 — Wave B: controlled documents** (ADR 0114 Amdt 1 + **Amdt 2 / D17**) | ✅ **APPROVED (r2)** [review](docs/reviews/dm3-controlled-documents-review.md) — r1's 1 blocking MAJOR **discharged by M11** (`5b35003`). **r2: 0 P0 · 0 MAJOR · 3 MINOR carried · 5 INFO · 1 new INFO. No binding pre-merge condition.** The assert moved to `begin_document_upload`, scoped `if p_resource_type = 'controlled_document'` — the first residue-producing step; two doors now assert the gate. **QA re-verified the fix AND its invited failure mode by measurement, not by reading the scope:** with the flag OFF and home types **enumerated from `securable_resources`** (not a hand list), `case`/`meeting`/`interview`/`action_item` all **BEGIN ACCEPTED**, `controlled_document` **REFUSED HC0D7**; reserved controlled-home sessions **0**. **Twin re-run, all five types before AND after removing the assert — exactly ONE cell changes** (controlled: REFUSED→ACCEPTED; the four Wave-A arms ACCEPTED both ways), residue **0→1** with a minted session id ⇒ **Wave A is NOT narrowed** and "reds T3 and only T3" is corroborated structurally. Scoping proof against evasion: the assert keys on the declared `p_resource_type`, but the lookup `where s.id=… and s.resource_type=p_resource_type` makes a mis-declared type unreachable (P0002). Both false comments corrected **as retractions**, and `seed.sql` additionally records that "every door" is **not** the target state either — closing the loop a bare correction would leave open. **The lead's "sweep not re-run" scope decision UPHELD, with the reasoning restated on the catalog rather than on the diff** (a migration-file claim is stale by design here): post-M11 `ARM=census` **HOLDS at 548 live / 569 accounted** and `public` policies **275** — both identical to the pre-M11 measurements ⇒ M11 added zero gates and zero policies, and `can_read_document`'s controlled arm is byte-identical to the r1 audit. ⚠ Carried unchanged: `can_write_document`'s sweep verdict is still **ERROR**-resolved-by-runlog and **must not later be cited as COVERED**. **MINOR-1 CLOSED** — corrected at all four sites incl. **its origin in ADR 0118 §12**. **NEW INFO:** `act-role-assumption.spec.ts:157` + `phase2-auth-shell.spec.ts:268` flaked in **both** independent `e2e:prod` runs — a pattern, not noise; not DM3's, but recommend filing now while two runs' signal exists (re-running destroys flake evidence). Re-gate accepted not re-run: `e2e:prod` 1101p/0f/3flaky/0 did-not-run (1104+6 skipped = 1110 = collected), pgTAP 190f/6152 on a fresh reset, `ARM=hat`/`wrapper`/`floor`, tsc 0, lint 5/5 | 2026-08-13 | [dm3-controlled-documents](docs/reviews/dm3-controlled-documents-review.md) |
| ~~**DM3 — Wave B: controlled documents**, round 1~~ | ⛔ **CHANGES REQUESTED (r1)** — **0 P0** · **1 MAJOR (blocking)** · 4 MINOR · 5 INFO. **MAJOR-1: `documents_wave_b` gates the LAST step of the corridor, not the corridor — and the tree asserts the opposite twice.** Catalog: **exactly one** function calls `app.assert_documents_wave_b_enabled` (`attach_controlled_document_version_file`). Probed live with the flag OFF: `create_controlled_document` **ACCEPTED**, `begin_document_upload` **ACCEPTED** — so a coordinator creates the doc, reserves a path, **PUTs real bytes into `documents-standard`** and finalizes; only the domain pointer refuses (HC0D7). Residue: orphaned bytes + orphaned core version + a draft whose file never appears. `documentsWaveBEnabled()` (added by DM3) is **called from nowhere** in `src/`; the UI gates on `controlled_docs` alone. Violates the phase's OWN stated contract (`seed.sql` "with it OFF every DM3 door answers HC0D7"; `documents/actions.ts:87` "every DM3 door calls (HC0D7), so a stale client cannot reach past this") and the Wave-A MIN pattern it cites ("ABSENT, not disabled"). **Not an authz hole** — authority unchanged and verified (approver reads/cannot write; plain member + outside approver both refused P0002/42501). Lands in the deploy's OWN expected interim state (plan §10: local vs prod flags "disagree"); the arm the Test Run Summary already records as **not exercised**. **Verified by QA, not accepted:** both R3 twins re-run (trigger-only → OK, door-only → OK, **both → 23503** — the two-sufficient-mechanisms finding reproduced) · the A4 widening twin genuinely reds · all **five** D17 conditions incl. the 12-arg identity with **no surviving 11-arg overload** and the re-GRANT read from `pg_proc.proacl` · D15 ceiling narrows on a case home and **fails closed** on a Wave-B home (HC0D6 + `else null`), incl. under `set local role authenticated` · zero `controlled-documents` Storage policies · `set_document_version_file`/`can_read_document_object`/`storage_path` all **0 rows** in the catalog · the trigger fix is unbypassable (BEFORE INSERT + `securable_type NOT NULL` + no INSERT policy → 42501) · DM3B-1 is real `Buffer.compare === 0` through the door-signed URL. **Gate figures independently reproduced:** tsc **0** · lint **5/5** · vitest **86f/1258** · `ARM=census` **HOLDS** (548 live/569 accounted; 273+275 re-derived exactly) · `ARM=hat` **HOLDS** · `FROMFINDINGS=1 ARM=wrapper` **HOLDS** (BLIND 41) · 385 files = 385 registered. **MINOR-1: "in no authz arm's domain" is false for ARM 2** (domain = every `public` prosecdef auth-EXECUTE fn, **411** sigs, contains both named functions) — the conclusion stands, the reason does not. Accepted not re-run: `e2e:prod`, the fresh-reset pgTAP run, `ARM=floor`, and the sweep's `can_write_document` **ERROR**-resolved-by-runlog (⚠ must not later be cited as COVERED) | 2026-08-13 | [dm3-controlled-documents](docs/reviews/dm3-controlled-documents-review.md) |
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
- 🔴 **FUP-PGTAP-VACUOUS** — `lint:vacuous` scans **TS spec files only** (180 files, 0 findings); the **~6152 pgTAP assertions are entirely unscanned**. Live specimen found + lead-confirmed in a **PHI-boundary suite**: `197` §4.1's `-> 0 ->> field IS NULL` passes on an **empty array**, asserting nothing. DM4 fixes only its own diff + adds a positive control; a repo-wide sweep is its own audit and must be **proven able to fail** first — lead/backend
- 🔴 **FUP-DM5-STORAGE-ORPHANS** — a DB reset wipes `storage.objects` but **NOT the bytes**, and the Storage API lists *from* that table, so orphans are invisible to it too. Lead-reproduced: **0 metadata rows vs 663 files / 16.5 MB, 162 of them PHI-tier**. **Blocks DM5 step 3** — its "prove empty via the API then delete the bucket" would prove emptiness against a truncated table and report success while PHI bytes persist. DM5 must enumerate at the **backend layer**. ⚠ remote behaviour is an INFERENCE, unverified — lead/backend
- 🟠 **FUP-DM4-RECUSAL** — `add_referral_shared_item` checks referral-**source** authority but never `can_read_case` / `can_read_document`, so a **RECUSED** coordinator can freeze a case's PHI documents into a referral, around the ADR-0072/ETH·E1 exclusion perimeter. **QA-demonstrated live** (rolled-back txn: `can_read_case=false` **and** `can_read_referral_phi=true`, same user + case). **PO ruling 2026-08-14: DEFER to the Phase 19 access plane** (ADR 0114 Amdt 1 **D16** — must cover widening *and* narrowing). ⚠ **The gap STANDS behind a flag that will eventually be ON**; not P0 only because `documents_wave_c` ships OFF. Name it in Phase 19's scope — lead/PO/backend
- 🟡 **FUP-DM4-PRODROW** — the 1 dangling frozen-snapshot PRODUCTION row + the 3 unreferenced controlled-doc objects: reconcile at the push/deploy step, NOT during DM4 (PO ruling R2). ⚠ **Amended same day: a REMOTE reset is available (no active users), which may close this outright** — but must NOT delete DM4's M3/M4 guards, which are correct independent of deploy strategy. 🔶 Open sub-question for **DM5**: a DB reset wipes `storage.objects` metadata but maybe not the BYTES — an emptiness proof from a truncated table is not an emptiness proof — lead/backend
- 🟡 **FUP-E2E-REPEAT-FLAKY** — `act-role-assumption:157` + `phase2-auth-shell:268` flaked in **BOTH** DM3 `e2e:prod` runs ⇒ a pattern, not noise; outside the DM3 diff — lead/tester
- 🟡 **FUP-329-ABORT-SHAPE** — a `329` keystone whose failure **aborts the file** (drops 41 assertions); it is what makes a mutation sweep over these gates unclassifiable — backend
- 🟡 **FUP-LINT-STALE-SYMBOL-COMMENT** — a 6th lint gate for comments naming deleted identifiers. ⚠ **Lead recommendation: do NOT build** (43% coverage ceiling; needs a live DB + a diff base; one identifier held 3 truth values in 1 file). Keep the marker as an authoring convention + the deletion-discipline sweep — lead/PO
- 🟡 **FUP-PGTAP-SAVEPOINT** — ⚠ **DOWNGRADED 🔴→🟡: the original claim was WRONG.** TAP output cannot be rolled back, so pg_prove counts it; real only in the degenerate all-assertions-inside case. Measured: 193 ok, 194 ok, 0 bad plans — lead
- 🟡 **FUP-DM3-ETHICS-UI** — no affordance exists to attach an ethics decision letter; DM3 ships the seams **writable via the API only**. Deliberate (ADR 0114 Amdt 2 scope boundary), not an oversight — PO (a feature phase)
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
