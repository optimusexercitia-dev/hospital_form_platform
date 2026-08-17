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
| 16 | Standards Crosswalk & Readiness v2 [0093](docs/decisions/0093-phase-16-standards-crosswalk-replan.md) · [record](docs/progress/phase-16-standards-crosswalk.md) | ✅ complete | ✅ | ✅ pgTAP **151f/4623** · e2e:prod 962/962, 0 assertion failures · [gate detail](docs/progress/phase-status-archive.md) | ✅ [APPROVED](docs/reviews/phase-16-review.md) | ✅ 2026-08-04 | 2026-08-04 | `484a254` → `main`, pushed |
| 17 | Controlled-Document Lifecycle | ✅ complete | ✅ (tsc/lint 0 · Vitest 206) | ✅ pgTAP 47/47 (full 1717) · phase E2E 14/14 · full regr 588p/10 env-only (0 Phase-17 reg) | ✅ APPROVED (3 MINOR cleared) [review](docs/reviews/phase-17-review.md) | ✅ 2026-07-06 | 2026-07-06 | merge `1152d75` (ff-only from `feat/phase-17-controlled-documents`; pushed) |
| 17-v2 | Controlled-Document Redesign | ✅ complete | ✅ (tsc/lint 0 · Vitest 369) | ✅ tester 25/25 · pgTAP `201` 29/29 · e2e:prod triaged-green (0 redesign reg) | ✅ APPROVED (0/0/0/4 INFO) [review](docs/reviews/document-control-redesign-review.md) | ✅ 2026-07-21 | 2026-07-21 | ff→`main` (branch `feat/document-control-redesign`) |
| 18 | Self-Assessment & Internal Audit | 🔜 not started | – | – | – | – | – | – |
| 19 | Surveyor Access & Evidence Export | 🔜 not started | – | – | – | – | – | – |
| 20 | Notifications & Escalation [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md) | ✅ complete | ✅ | ✅ pgTAP `226` 52/52 (full 2255) + `notifications.spec.ts` 8/8 | ✅ APPROVED (0B/0M/3 MINOR) [review](docs/reviews/s1-n-notifications-review.md) | ✅ 2026-07-13 | 2026-07-13 | `aac7c1c` |
| 21 | Committee Charters & Cadence [0080](docs/decisions/0080-committee-charters-cadence-model.md) | ✅ complete | ✅ | ✅ E2E 10/10 + pgTAP 260/261/262 = 11/29/10 | ✅ APPROVED r1 [review](docs/reviews/phase-CH-review.md) | ✅ 2026-07-20 | 2026-07-20 | BE `458aedb`…`13750b1` · FE `d982401`+`5d366db` · `14c4381`/`cb6a671` |
| 22 | Inter-Committee Case Referrals | ✅ complete | ✅ | ✅ 29/29 + full 276/326 | ✅ APPROVED 2026-06-21 | ✅ 2026-06-21 | 2026-06-21 | `768b9f1` |
| 23 | Patient Identity & Cross-Committee Linkage (MRN/encounter) | ✅ complete | ✅ | ✅ E2E 15/15 + pgTAP 10/10 sweep | ✅ APPROVED 2026-06-22 | ✅ 2026-06-22 | 2026-06-22 | `da4d127` |
| 22-v2 | **Referral Detail Redesign (RDR)** [0109](docs/decisions/0109-referral-registros-and-case-access-summary.md) (⚠ **D2 superseded** by 0110) · [record](docs/progress/referral-detail-redesign.md) | ✅ complete | ✅ Vitest 1254 | ✅ pgTAP **183f/5870** · 3 ARMs HOLD · e2e:prod **1074p/1f** (pre-existing, outside the branch) | ✅ [APPROVED](docs/reviews/referral-detail-redesign-review.md) (0B/2m/3i) | ✅ 2026-08-12 | 2026-08-12 | `81e1dc9` → `main`, ✅ **PUSHED** |
| 22-v3 | **REG·KIND — one Registro vocabulary** [0110](docs/decisions/0110-shared-registro-kind-vocabulary.md) (supersedes [0109](docs/decisions/0109-referral-registros-and-case-access-summary.md) **D2** only) | ⚠ **merged, gates 2–4 UNRUN** | ✅ Vitest 1254 | ⚠ **step 1 only** — pgTAP **183f/5857** · 3 ARMs HOLD · E2E targeted 24/24, **no `e2e:prod`** | ⛔ **not run** (PO direction) | ⛔ not sought | 2026-08-12 | `9a20c8a` → `main`, ✅ PUSHED · ✅ remote `db push` DONE. ⚠ Verified against the **remote catalog** — `migration list --linked` and MCP `list_migrations` were **both wrong** |
| DM | **Document Model Redesign** [0114](docs/decisions/0114-document-model-redesign.md) (+Amdt 1/2) · ADRs [0116](docs/decisions/0116-dm1-substrate-cutover-decisions.md)/[0117](docs/decisions/0117-dm2-s1-confidentiality-ceiling-decisions.md)/[0118](docs/decisions/0118-dm2-s2-command-layer-decisions.md)/[0119](docs/decisions/0119-dm4-referral-document-substrate-decisions.md)/**[0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md)** · [plan](docs/plans/document-model-redesign.md) | ✅ **DM0–DM4 complete** · 🔵 **DM5 OPEN** (S0 ✅ · ~~S1~~ WITHDRAWN · S2 ✅ · **S3 ✅ COMPLETE, r2 APPROVED** · **S4 ✅ COMPLETE 2026-08-17 — all 5 gate steps, QA APPROVED r3** (r1 ⛔ → r2 ⛔ → r3 ✅; every blocking item across three rounds was a RECORD defect — no code change was ever requested); ⚠ **the byte half was a NO-OP** (rehearsal now owned as **S5.R**, still UNREHEARSED) **and the 221 orphan bytes were DESTROYED OUTSIDE THE GATE by a stack recovery** (PO ratified the local volume disposable 2026-08-17; FUP-DM5-STACK-CYCLE-DESTROYS-BYTES stays open) · **S5 🔵 OPEN** (PO-authorized 2026-08-17; operational closure + **S5.R** byte-path rehearsal; step 0 in progress) · S6 remains ) — ⚠ **DM5's phase QA is still owed at S6; S4's is a SLICE verdict** | ✅ DM4: 5 migrations `20260926000100`–`000500` · pgTAP `340` | ✅ DM4: pgTAP **191f/6231** · 391==391 · vitest 1264 · 4 ARMs HOLD · matrix **18/18 RED-PROVEN** · `e2e:prod` **99p/0f** | ✅ DM4 **APPROVED (r2)** [review](docs/reviews/dm4-referrals-review.md), no binding condition | ✅ **2026-08-14** (DM4) | 2026-08-14 | `phase(DM4)` on `main` — ⛔ **NOT pushed**, no `db push`. **All five DM flags OFF.** Records: [DM1](docs/progress/dm1-substrate-cutover.md)·[DM2](docs/progress/dm2-orchestration-wave-a.md)·[DM3](docs/progress/dm3-controlled-documents.md)·[DM4](docs/progress/dm4-referrals.md)·**[DM5](docs/progress/dm5-wave-d-retirement.md)**. Open: 🟠 FUP-DM4-RECUSAL · 🟠 FUP-DM5-STORAGE-ORPHANS (**S4 has run — no longer blocks it**; the manifest-first delete was a NO-OP and the 221 orphans were then destroyed OUTSIDE the gate; now centred on the Cloud half) · 🟠 FUP-DM5-STACK-CYCLE-DESTROYS-BYTES · 🔴 FUP-PGTAP-VACUOUS · FUP-DM4-PRODROW. Census blind class = **141** at HEAD (not 146/150) — cite the query beside the number |
| DLB | **Deliberation & Voting Model** [0115](docs/decisions/0115-deliberation-and-voting-model.md) ([plan](docs/plans/deliberations.md)) | ⛔ **ADR PROPOSED — NOT ratified; nothing built and nothing may start** (the plan's Slice 0 gate). Flag `deliberations` covers all but Slice 1, which replaces live meeting-settings plumbing | – | – | – | ⛔ **not ratified** | – | `a68f179` + renumber `feab771` (drafted as 0112 — **taken**; ⚠ differing filenames merge CLEANLY, so renumber at merge time). ✅ PUSHED (server-verified) |
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
| **ETH·E4** | **Ethics participant seating & professional identity** [0108](docs/decisions/0108-eth-e4-participant-seating.md) · [record](docs/progress/eth-e4-participant-seating.md) | ✅ **complete** | ✅ vitest 1218 · `next build` 0 | ✅ pgTAP **182f/5794** (353==353) · 3 ARMs HOLD · sweep 0 BLIND/0 ERROR · e2e:prod **140/0**. ⛔ **Never cite `ARM=census` for its 3 write doors** (ADR 0079 Am. 5) | ✅ **APPROVED (r3)** [review](docs/reviews/eth-e4-review.md) — r1 ⛔ (1 P0) / r2 ⛔ / r3 ✅ | ✅ 2026-08-11 | 2026-08-11 | → `main`; ✅ remote `db push` DONE. Closes FUP-ETH-1 + FUP-FF5-2 |
| **AUTHZ** | ADR 0078 Gate 1 | ✅ complete | ✅ | ✅ pgTAP 2981 · e2e 0-regress | ✅ APPROVED [review](docs/reviews/authz-b-series-review.md) | ✅ 2026-07-16 | 2026-07-16 | `87858f7` (local) |
| **AUTHZ · Gate 2** | ADR 0078 Gate 2 | ✅ complete | ✅ | ✅ pgTAP 772/772 authz · e2e green | ✅ APPROVED (re-review) | ✅ 2026-07-17 | 2026-07-17 | `f07341f` |
| **case-corrections** | **Case Correction Lifecycle** [0085](docs/decisions/0085-case-correction-lifecycle.md) | ✅ complete | ✅ | ✅ tester 24/24 + full prod E2E feat 7/7 (reds triaged infra/baseline; T-2 clean-stack 76/76) | ✅ APPROVED (0P0/0MAJ/2min) [review](docs/reviews/case-corrections-review.md) | ✅ 2026-07-24 | 2026-07-24 | `6b50abc` → main+origin; **remote `db push` ✅ (flag ON, backfill verified live)** |
| **case-custom-fields** | **Case Custom Fields** [0083](docs/decisions/0083-case-custom-fields.md) | ✅ complete | ✅ lint/tsc/vitest 369 | ✅ E2E 8/8 (3× clean) · pgTAP `188` 28/28 · full `e2e:prod` 735p | ✅ APPROVED (0 P0 · 0 MAJOR · 1 MINOR cleared · 2 INFO) [review](docs/reviews/adr-0083-case-custom-fields-review.md) | ⚠ **unrecorded** | 2026-07-23 | merge `c857193` · flag ON `fde76d3` |
| **bulk-case-create** | **Bulk Case Creation ("Múltiplos casos")** [0084](docs/decisions/0084-bulk-case-creation.md) | ✅ complete | ✅ build/tsc/lint/vitest 390 | ✅ E2E 8/8 prod-standalone · pgTAP 29/29 | ✅ APPROVED (4 MINOR, none blocking; fixed `b948c9f`) [review](docs/reviews/bulk-case-creation-review.md) | ⚠ **unrecorded** | 2026-07-23 | flag ON `255a8e9` |
| **AUDIT-DOOR-BLINDNESS · P0** | ADR 0078 §7.14 | ✅ complete | ✅ | ✅ 50 KS mut-proven · pgTAP 3288 · invariant HOLDS | ✅ APPROVED [review](docs/reviews/authz-door-audit-p0-review.md) | ✅ 2026-07-18 | 2026-07-18 | ff→main |
| **PCI** | **Process/Case integrity audit remediation** [0095](docs/decisions/0095-process-case-integrity-audit-remediation.md) · [detail](docs/progress/process-case-integrity-and-template-versioning.md) | ✅ complete | ✅ | ✅ all gates green → [detail](docs/progress/process-case-integrity-and-template-versioning.md) | ✅ APPROVED r2 [review](docs/reviews/process-integrity-and-template-versioning-review.md) | ✅ 2026-08-05 | 2026-08-05 | `44cd9bb`…`f6c847d` |
| **AFF** | **Hospital affiliation, person identity & the org people directory** [0097](docs/decisions/0097-hospital-affiliation-person-identity.md) · [record](docs/progress/hospital-affiliation-person-identity.md) | ✅ complete | ✅ | ✅ all gates green. ⛔ **never cite `ARM=census` for AFF's write-path doors** (FUP-AFF-1) | ✅ APPROVED [review](docs/reviews/aff-review.md) | ✅ 2026-08-06 | 2026-08-06 | `main` ff + `origin` `cc66483` |
| **MIN** | **Meeting audio → generated ata** [0099](docs/decisions/0099-meeting-audio-minutes.md) · [record](docs/progress/min-audio-minutes.md) — flag `audio_minutes` **OFF** at ship | ✅ **complete** | ✅ | ✅ pgTAP **166f/5181** · MIN 10/10 ×4 · e2e:prod ×2 GREEN | ✅ **APPROVED (r2)** [review](docs/reviews/min-audio-minutes-review.md) — 3 MINOR open | ✅ 2026-08-06 | 2026-08-06 | `feat/meeting-minutes` |
| **TV** | **Process-Template Versioning** [0096](docs/decisions/0096-process-template-versioning.md) (+Amdts 1.1–1.7) · [detail](docs/progress/process-case-integrity-and-template-versioning.md) | ✅ complete | ✅ | ✅ all gates green → [detail](docs/progress/process-case-integrity-and-template-versioning.md) | ✅ APPROVED r2 [review](docs/reviews/process-integrity-and-template-versioning-review.md) | ✅ 2026-08-05 | 2026-08-05 | `6b9314c`…`f6c847d` |
| **QO·A** | **Quality-office oversight — Phase A** [0100](docs/decisions/0100-quality-office-oversight.md) · [record](docs/progress/quality-office-oversight.md) | ✅ **complete** | ✅ | ✅ pgTAP **172f/5355** · `q1` 20/20 RED-proven · census+floor HOLD | ✅ **APPROVED (r3)** [review](docs/reviews/quality-office-oversight-review.md) | ✅ 2026-08-07 | 2026-08-07 | `feat/quality-office-oversight` → `main` |
| **QO·B** | **Quality-office oversight — Phase B** (content wall) [0100](docs/decisions/0100-quality-office-oversight.md) D12 · [record](docs/progress/quality-office-oversight-phase-b.md) | ⬛ **complete** | ✅ | ✅ pgTAP **175f/5616** · `b1` 39/39 RED-PROVEN · 0 BLIND · e2e:prod GREEN 1046/0 | ✅ **APPROVED (r2)** [review](docs/reviews/phase-QO-B-review.md) — r1 ⛔ (M4 cut a PROXY) | ✅ 2026-08-09 | 2026-08-09 | closes BUG-QOB-001/002/003. Open: **BUG-QOB-004** · **FUP-QOB-1/2**. ⛔ Method lesson: a CUT by enumeration diverged from the ratified list **twice** |
| **PDF·P1** | **PDF printing — Forms + full skeleton** [0104](docs/decisions/0104-pdf-document-printing-module.md) (+A1–A6) · [record](docs/progress/pdf-p1-forms-skeleton.md) | ✅ **complete** | ✅ | ✅ pgTAP `312` **73/73** · 7 drills RED-proven · `ARM=policy` 3/3 COVERED · e2e:prod GREEN 1026 | ✅ **APPROVED (r2)** [review](docs/reviews/phase-PDF-P1-review.md) — 3 MINOR deferred | ✅ 2026-08-08 | 2026-08-08 | → `main`; remote `db push` ✅ |
| **PDF·P2** | **PDF printing — Meetings (ata)** [0104](docs/decisions/0104-pdf-document-printing-module.md) **+A7/A8/A9** · [record](docs/progress/pdf-p2-meetings.md) | ✅ **complete** | ✅ | ✅ pgTAP `312`+`313` **128/128** · drills RED-proven · e2e:prod GREEN 1030 | ✅ **APPROVED (r2)** [review](docs/reviews/phase-PDF-P2-review.md) — ⛔ r1 (masking leak + PHI labeling) → Package A | ✅ 2026-08-08 | 2026-08-08 | pushed + remote `db push` ✅ 2026-08-10 |
| **ACT** | **"Act as" strict role assumption** [0106](docs/decisions/0106-act-as-role-assumption.md)/[0107](docs/decisions/0107-act-s4-hat-blind-sweep-and-allowlist.md) · [record](docs/progress/act-as-role-assumption.md) — **no flag: the migration IS the cutover** | ✅ **complete (S0–S4)** | ✅ Vitest 1218 · 345==345 | ✅ pgTAP **180f/5707** · e2e:prod **GREEN 1057/0** · census+floor+**hat** HOLD | ✅ **APPROVED** — S0–S3 (r2) · S4 (r1) [review](docs/reviews/act-as-stage-4-review.md) | ✅ 2026-08-10 | 2026-08-10 | `ff0e76a`+`ac4a270` → `main`, pushed. ✅ remote `db push` + Cloud auth hook — **the remote is cut over** |

> ⚠ PCI/TV shipped with two gate caveats — the un-runnable `ARM=census` (**DISCHARGED 2026-08-05**: the arm landed with the membership-hardening merge and was run against the merged catalog; residue in FUP-PCITV-1 row 1) and the VOID TV-backfill premise (⚠ its mechanism recurs: a backfill is invisible to `db reset` forever — a green reset is *no* evidence). Full caveat text + verbatim gate rows rotated 2026-08-08 → [process-case-integrity-and-template-versioning.md](docs/progress/process-case-integrity-and-template-versioning.md).

## Current Phase Tasks

<!-- Lead recreates this table at the start of each phase. At the §6 Record step the
     completed phase's task detail is archived to docs/progress/phase-N.md (or a
     feature-named file) and replaced here by a one-line pointer (CLAUDE.md §7). -->

### 🔵 IN PROGRESS — **DM5: Wave D + retirement** (opened 2026-08-14) — the program's FINAL phase

> **Full detail → [dm5-wave-d-retirement.md](docs/progress/dm5-wave-d-retirement.md)** · **next-session
> brief → [dm5-handoff.md](docs/progress/dm5-handoff.md) §§9–11** (S3's record + **S4's authorization gate**) ·
> plan [dm5-wave-d-retirement-plan.md](docs/plans/dm5-wave-d-retirement-plan.md) · ADR
> **[0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md)** (D1–D18) · step 0
> [dm5-surface-verification.md](docs/progress/dm5-surface-verification.md).
> Window `20260927000100`+ · flag `documents_wave_d` · pgTAP **`341`** (S2) + **`342`** (S3).
> ⚠ The phase narrative — the three mis-pinned catalog facts, the six enumeration-boundary repeats and
> the S2 close-then-reopen history — rotated to the record **2026-08-14**. **Those lessons are the
> phase's most valuable artifact; the record, not this section, is where they live.**
>
> **Slices:** **S0 ✅** manifest tool (`0e85cbe7`, `9d37ad79`; baseline self-labels **DEGENERATE**, not
> S4 input) · ~~S1~~ ⛔ **WITHDRAWN, never built** (D3/D4/D5 struck → **D11**) · **S2 ✅** NSP RCA/CAPA
> evidence · **S3 ✅ COMPLETE — all four gate steps** (2026-08-14) · **S4 ✅ COMPLETE — all five gate
> steps** (built 2026-08-16 **PO-authorized on the day**, closed 2026-08-17; QA r1 ⛔ → r2 ⛔ → **r3 ✅**)
> · **S5 🔵 OPEN — PO-authorized 2026-08-17**, operational closure, and it carries **S5.R**, the
> byte-path rehearsal (PO-directed same day); **step 0 in progress, no build started** · S6 canon +
> exit sweep.
>
> ### 🔵 S5 — operational closure — **OPENED 2026-08-17, PO-authorized. Step 0 in progress.**
>
> **Scope** ([plan](docs/plans/dm5-wave-d-retirement-plan.md) § S5): name the operational **owner and
> execution mechanism** (pg_cron / scheduled job / manual runbook) for the disposal job and the
> reconciliation command · one **backup/restore drill of DB + Storage TOGETHER** · baseline `EXPLAIN` +
> latency for document **list / open / sign** as the pilot's comparison point · and **S5.R**, the
> byte-path rehearsal (PO-directed 2026-08-17).
>
> ⚠ **S5 names owners and mechanisms; it does NOT invent values.** ADR 0114 **O1** (retention) and
> **O2** (scanner + `unscanned_accepted` expiry) stay with the PO. ⛔ ADR 0120 assigned this to "S4"
> until 2026-08-17 — S4 closed cleanly without it, which is how *a deliverable assigned to the wrong
> slice disappears.* Corrected in the ADR.
>
> **Binding inputs:** 🟠 **FUP-DM5-FINALIZE-ATOMIC** (finalize is FOUR round-trips; a failure after
> byte-verification orphans the document) · 🟠 **FUP-DM5-MANIFEST-FLAG** (`capture --out` vs
> `delete --manifest`; the wrong flag silently overwrote the committed S0 baseline) · 🟠
> **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES** (a stack cycle destroys the storage volume — the drill above
> is what would have caught it) · 🟠 **FUP-DM5-STORAGE-ORPHANS** (Cloud half only).
>
> **Step 0 — surface verification, running.** → `docs/progress/dm5-s5-surface-verification.md`. This
> program has twice paid for skipping it: DM4's step 0 found **6 surfaces the plan never named**, and
> **S1 was WITHDRAWN ENTIRELY** because a capability was believed absent when it had shipped renamed.
> **No S5 build starts until step 0 lands.**
>
> #### backend — S5.D + drill + baselines, delivered 2026-08-17 → [record](docs/progress/dm5-s5-operational-closure.md)
>
> ⚠ *(The S5 header above still reads "Step 0 in progress" — stale: step 0 landed `8bbf61aa`, S5.R
> landed `e5a1418e`. Left for the lead, who owns that line.)*
>
> - ✅ **Inherited artifacts reviewed as someone else's, and BOTH carried real defects.** The pgTAP
>   keystone **had never been executed**: `plan(11)` vs 12 was the smaller half — **the detector
>   detected ITSELF** (its `pg_temp` helpers carry the door's name in their own bodies; `pg_temp_N`
>   rows are ordinary `pg_proc` rows), so K2/K3a/K4 were RED **for a reason that is not the property**,
>   whose natural "fix" is to relax the assertion. Its header also asserted a **red-first observation
>   that had not happened** — *made true* (real caller in `public` → K4 RED naming it → reverted →
>   catalog verified → 12/12) rather than deleted, and an unverifiable "FIVE instances" count softened.
>   `plan(N)` → **`no_plan()`**, with the cost disclosed in-file: it does **not** catch silent
>   assertion loss, and the compensating control is a **lead-side** gate figure, not an in-file guard.
> - ✅ **S5.D (PO: document the gap, do NOT build the job).** `actions.ts:277-278`'s present-tense
>   claim that *"the disposal job + service-only completion door do the verified deletion"* corrected —
>   false in **both** halves. Gap pinned on both sides (`343_dm5_s5_disposal_gap.sql` +
>   `disposal-gap.test.ts`), **both observed RED against real mutations**; the TS pin's red names the
>   file *and* the function. Runbook: **`docs/deployment/phi-disposal-runbook.md`** — ⚠ **owner +
>   periodicity are PROPOSED and OWED BY THE PO**; until named, the procedure exists but the mitigation
>   does not, and the reconciler's "the completion door is its owner" premise stays false in practice.
> - ⛔ **A 4th fix to `storage-manifest.mjs`, lead-ratified: the INDETERMINATE branch was UNREACHABLE
>   in the state that needs it.** `.list('')` on a bucket whose **row is gone** returns
>   `{data: [], error: null}` — so *"I could not ask"* and *"I asked and there is nothing"* were the
>   same value, and the classifier printed the **reassuring** arm (no `DO NOT PROCEED`) **on the
>   destructive path** for a bucket it never interrogated. Per the lead: **that is the state all eight
>   retired buckets are in** — not a corner case. Found only because a control (R3d) was built for a
>   state nobody had observed. `rehearse` **16/16** (14 originals intact), `selftest` **13/13**.
> - ⛔ **Drill finding — a restore can report SUCCESS and silently lose 67% of RLS.** Replaying
>   `supabase db dump` into a bare Postgres: `psql` **exit 0**, **490** true errors, **90 of 274
>   policies** restored, 161 of 165 tables — a database that *looks* restored, missing two thirds of
>   the security boundary. Confirmed by a 2nd measurement (pre-create 3 empty schemas + 2 stub fns ⇒
>   errors 490→10, tables and policies to **full parity**). ⚠ **Two false signals aligned**: `psql`
>   exits 0 without `ON_ERROR_STOP`, and `grep -c '^ERROR'` matches nothing (psql prefixes
>   `psql:file:line:`) — only the **catalog comparison** exposed it. Byte half executed via `docker cp`
>   (**245 files / 2,456,666 bytes**, per-bucket parity, **no stack cycle**); an API-based Storage
>   backup would today capture **0 of 245** files, because it enumerates from `storage.objects` (0
>   rows). ⚠ **A Storage backup is a PHI export** — 68 PHI-tier files in plaintext, undocumented
>   anywhere; my copy was deleted after verification.
> - ✅ **Baselines at a stated N** (`documents=3`, `file_objects=0`; synthetic arm +2000 rolled back),
>   measured as `authenticated` with real JWT claims because a plan taken as `postgres` bypasses RLS.
>   **P2 (per-resource panel) 1.3 ms → 364 ms**: Seq Scan with `app.can_read_document(id, uid)`
>   evaluated **per row** (24 201 buffers / 2001 rows) and **`public.documents` has only its PK index —
>   nothing on `home_resource_id`.** ⚠ P1's two numbers are **NOT a volume curve** (rows=2 at both;
>   the synthetic rows are not in the register's population — the drop is cache warming).
>   **P4 `open_document_version` NOT MEASURED** — `file_objects=0` and the write path is guarded
>   (*must be born reserved*; `reserved → verifying` rejected); stopped after two attempts rather than
>   guessing at a state machine.
> - ✅ **Gate:** pgTAP **194f/6363 PASS** (was 193/6351 — +1 file/+12 = exactly `343`) · vitest
>   **89f/1304** (was 88/1294 — +1/+10 = exactly the new pin) · lint **5/5 exit 0** · tsc **0**.
>   ⚠ **The lint baseline was stale — the gate was ALREADY RED at `e5a1418e`** (unused `cap7`,
>   verified via `git show`); ⭐ and that dead binding was a **missing control**, not a style nit — it
>   was R6-capture's **sighted twin**, unasserted, so the arm was satisfiable by a tool that verdicts
>   UNVERIFIED for *every* input. Now pinned. **Authz sweep: NOT APPLICABLE** (no RLS policy, no
>   `prosecdef` gate, no migration ⇒ no diff to derive a list from) — recorded as that, **not** "clean".
> - 📋 **Filed, not fixed:** 🔴 **FUP-DM5-NO-ANSWER-VS-NOTHING** (a **CLASS**; 🟠→🔴 on instance 3) ·
>   🔴 **FUP-DM5-BACKUP-IS-PHI-EXPORT** · 🟠 **FUP-DM5-CLOUD-ORPHAN-SURFACE** (a **promotion**, kept
>   promoted) · 🟠 **FUP-DM5-DISPOSAL-JOB**. ⛔ **13 NOT-COVERED items** in the record — read before S6.
> - ⚖️ **Three lead rulings recorded 2026-08-17** (record §6b): ① the door's metadata-only absence check
>   **IS** the NO-ANSWER class and **escalates to 🔴** — on Cloud `disposed` is not merely unchecked but
>   **unverifiable**, so it can never mean more than "metadata gone" there; filing it *undecided* was
>   ruled the correct call · ② the S3 promotion **stands** — cross-link, do not merge · ③ the PHI-export
>   finding is **filed 🔴 and changes the runbook** (new §6b, four values awaiting the PO).
> - 🔒 **Two gaps adopted as BINDING — S6 may not close over them:** **P4 `open_document_version`
>   NOT MEASURED** (stopping rather than guessing at a state machine was ruled correct — *a fabricated
>   baseline is worse than a missing one*) · **the runbook sequence is UNREHEARSED** (*naming an owner
>   is not a rehearsal, and writing a runbook is not running it*).
>
> ### ✅ S4 CLOSED 2026-08-17 — legacy bucket retirement — steps 1 ✅ · 2 ✅ · 3 ✅ **APPROVED (r3)** · 4 ✅ PO
>
> **All five gate steps closed.** QA r1 ⛔ → r2 ⛔ → **r3 ✅ APPROVED** (0 P0 · 0 MAJOR); PO approved the
> slice 2026-08-17. ⚠ **A SLICE verdict — DM5's phase QA is still owed at S6, and it authorizes no part
> of S5.** Detail rotated to **[the DM5 record](docs/progress/dm5-wave-d-retirement.md) § S4** and
> **[the handoff](docs/progress/dm5-handoff.md) §§11–12**; reviews:
> [r3](docs/reviews/dm5-s4-review-r3.md) · [r2](docs/reviews/dm5-s4-review-r2.md) ·
> [r1](docs/reviews/dm5-s4-review.md). ⛔ **Not relieved by the approval: Cloud is UNVERIFIED in all
> three rounds, and the deploy-time byte path is UNREHEARSED (owned as S5.R).**

> **QA r1 verdict 2026-08-17: ⛔ CHANGES REQUESTED** — 0 P0 · **2 MAJOR (both blocking)** · 7 MINOR ·
> 4 INFO. [review](docs/reviews/dm5-s4-review.md). ⭐ **The BUILD is sound — no code change requested**:
> the migration, its byte-first guard and **every** successor assertion were re-proved by neutralization
> (8 rolled-back mutations, `app.can_write_document` md5 identical before/after, degenerate bodies 0
> after each). **Both blocking items are record/coverage defects, and both are mine.**
> - **B1** — the 221 orphan files **no longer exist** (volume recreated `01:06:02Z` by the lead's own
>   stack recovery); I reported them as present and had the PO rule on them **3h11m after they were
>   gone**. A disposal without evidence inside the slice that ratified D9. → corrected everywhere +
>   **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES**.
> - **B2 — ✅ CODE FIX LANDED** (`140ffd8c`), **but the gate figure is NOT re-established (see below).**
>   R15 DELETEd `nsp-evidence` and asserted only `not 200 / not 204`; the retired bucket,
>   `documents-phi` **and** `form-assets` all answer `400 {"statusCode":"404"}` — **indistinguishable**.
>   Rewritten to plant a REAL object via the product corridor and make the discriminating fact the
>   object's **survival** (service-role re-fetch + byte compare), status codes demoted to "weak signal
>   only". **Proven able to fail** (service-role bearer ⇒ RED). ⛔ **RE-CORRECTED 2026-08-17 by QA r2
>   (MAJOR-3): the "codebase-wide assumption" this claimed to correct was itself INVERTED.** It said
>   `storage.protect_objects_delete` *"fires before RLS and is the operative guard"*. On the **HTTP
>   path — the one R15 attacks — the trigger never fires at all**: `protect_delete()` is role-agnostic
>   and tests only `storage.allow_delete_query`, and the Storage API sets that GUC itself (its own HINT
>   **exception message** ends *"Use the Storage API instead."* — corroboration, not the proof, and the
>   HINT is a different string; QA r3 MINOR-10). **The operative locks are the two ABSENT policies, SELECT and
>   DELETE, and both are ours** — opened together, the same authenticated HTTP DELETE returned
>   `200 Successfully deleted` and destroyed the object. The trigger guards **direct SQL DML only**,
>   which is the context `…000400` needs it for. ⭐ The earlier probe opened **one** of two locks *and*
>   ran at the raw-SQL layer — the single path where the trigger IS unconditional, so the only path that
>   could not see the RLS lock. `143`'s label restored to its original substance (assertion unchanged,
>   38 == 38). ⚠ Domain: LOCAL stack, both paths; **not verified against Cloud**. And `storage.objects`
>   grants `arwdDxtm` to `authenticated` **and `anon`** — no grant-level fallback, so every storage
>   protection here is exactly **one permissive policy wide**.
>
> ### ✅ RESOLVED 2026-08-17 04:49 — the E2E figure is ESTABLISHED at **1121**; this block is now HISTORY
>
> ✅ **The blocker below is discharged.** Re-run on a **freshly-rebooted** machine (uptime 0.0 h):
> **`1121 passed · 0 failed · 0 infra · 2 flaky · 6 skipped · 0 did-not-run · 18 batches`**, and pgTAP
> **193 / 6351 PASS with 0 deadlocks** — the 17-suite `Bad plan … ran 0` storm gone too. ⭐ **The
> diagnosis below (the machine, not the code) is now CONFIRMED BY MEASUREMENT rather than inferred**;
> the same suite that was unrunnable four times completed 18/18 batches untouched. Restatement +
> the three individually-verified claims: the DM5 record § "Gate step 2".
>
> ⛔ **The ~~1118~~ figure remains SUPERSEDED** — it predated the R15 fix and counted a vacuous
> security pin. It is replaced by 1121, not revived. The table below is kept because *"nothing failed"
> and *"nothing ran"* being different facts is the lesson, not the attempt count:
>
> **Rotated at step 5** — the four-attempt table, the five environment traps, and the `193 files / 5900`
> HANDOFF-1 deadlock analysis were **copied verbatim** into
> **[the DM5 record](docs/progress/dm5-wave-d-retirement.md) § "The four dead gate attempts"** before
> being cut here. ⚠ They were also in the handoff, but the handoff **dies with DM5** and these outlive
> it — so the record, not the handoff, is the destination. The two lessons in one line:
> **`TaskStop` does not reap the gate's process tree — verify with `Get-Process`, never from a
> notification**, and **"nothing failed" is not "nothing ran."**
> - QA also **solved** the `SET LOCAL` puzzle I had recorded as unexplained, and **corrected two of my
>   claims about it**: it is *not* e2e-path-specific (a plain reset emits **six** `25P01`; I had read my
>   own run through `tail -25`), and my "the guard refuses" probe was taken at the **wrong grain**
>   (post-reset live DB ≠ migration-apply time). The fix stands; the causal story did not.
> - ⚠ **INFO-3, worth carrying forward:** `p0-authz-invariant.sh:295` bounds the census at
>   `nspname='public'`, so the four dropped `storage.objects` policies were **never in any arm's
>   domain**. "Four arms HOLD" is true and is **zero coverage of this diff**.
> - ⚠ QA did **not** re-run `e2e:prod` — the 1118 / print-corridor figures were inherited, not
>   re-measured, and B2 lives in exactly that layer.
>
> **PO authorized S4 explicitly on the day** (separately from S3's approval, per the handoff §11 gate);
> **FUP-DM5-D11 deferred — "decide later"**, and nothing in S4 depended on it. Full detail:
> [the record](docs/progress/dm5-wave-d-retirement.md) § S4.
>
> **Built:** migration **`20260927000400`** — drops the last 4 retirement-bucket policies (all
> `nsp-evidence`) + the **8** bucket rows, behind a guard that **refuses** to retire a bucket still
> holding `storage.objects` rows (D9's byte-first ordering encoded executably) · pgTAP **`325` 5 → 8**
> (t6/t7 retirement pins **proved RED-FIRST against the real pre-migration catalog**, naming every
> survivor; **t8** = the survivor positive control, because a sweep that retired *everything* would
> satisfy t7) · successor assertions in `200`/`142`/`143`/`341` · dead bucket constants removed from
> `src/lib/attachments/constants.ts`. Survivors: `documents-standard`/`documents-phi` (core, D8) +
> `form-assets`/`meeting-audio` (out of scope, D13).
>
> ⛔ **THE BYTE HALF WAS A NO-OP, AND IS RECORDED AS THAT — NOT AS "RETIREMENT PROVEN".** Measured
> first: `storage.objects` **0 rows in all 12 buckets** vs **866 files / 9.9 MB / 235 PHI** on the
> volume (**221 / 6.93 MB / 15 PHI** in the 8 retirement buckets — reproducing S0's figure exactly).
> Every retirement-bucket byte is **already an orphan with no metadata row**, so the Storage API — the
> D9 *gate* — cannot address one of them; `capture` returned its `DEGENERATE BASELINE` verdict by
> design and **`delete --execute` never ran**. What S4 closed is the metadata/schema half, and it
> **stays** closed across `db reset` — which six historical migrations would otherwise undo.
> ⚠ **So the deploy-time byte sequence remains UNREHEARSED end-to-end** (ADR 0120 D9 now carries an
> inline EXECUTION NOTE saying so); its correctness still rests on S0's 8/8 self-test.
> ✅ **OWNED 2026-08-17 — PO directed the rehearsal into S5 as `S5.R`**
> ([plan](docs/plans/dm5-wave-d-retirement-plan.md) § S5.R): the **with-metadata** path (the condition
> production is in, and the one S4's no-op skipped) on a purpose-made disposable bucket, all four
> acceptance items proven able to FAIL. ⚠ **Still UNREHEARSED until S5.R runs** — naming an owner is not
> a rehearsal.
>
> | gate step 1 | figure |
> |---|---|
> | registry · pgTAP | **407 == 407** · **193 files / 6351 PASS** (S3's 6348 + 3 new `325` pins) |
> | tsc · lint · vitest | 0 · **5/5** · **1294** (unchanged — the removed TS had no test, which is *why* it was removable) |
> | four ARMs, exit codes captured **unpiped** | **all HOLD** — census live **546** / verdicts **570** (identical to S3's close: S4 added no gate, so no census entry is owed) · hat 3 allowlisted, self-test 6/6 · floor allowlisted · `FROMFINDINGS=1` wrapper BLIND **41** ⊆ allowlist |
> | diff-scoped `ARM=policy` | **NOT APPLICABLE — recorded as that, never as clean.** The diff *drops* 4 policies, adds/modifies none, touches no `prosecdef` body ⇒ empty domain. *A dropped policy has no gate to open.* |
> | **step 2 — `e2e:prod`** | ✅ **GATE GREEN, RESTATED 2026-08-17: `1121 passed · 0 failed · 0 infra · 2 flaky · 6 skipped · 0 did-not-run · 18 batches`** (2 infra re-runs, batches 6+11, both clean on re-run). Per-batch **1129/1129 accounted, 0 did-not-run in every batch**; 1121+2+6 = 1129 collected — the summary's `1123 of 1129` excludes skips. ⭐ Reconciles to the suspended 1118 **exactly**: collected and skips unchanged, so +3 = the 3 tests flaky then and clean now (5→2 flaky); R15 was one test replaced by one test. `pdf-printing` **9/9** + `pdf-printing-meetings` **6/6** verified individually; **0 `not ok`** across the 18 logs the runner itself named. The ~~1118~~ figure is SUPERSEDED, not merely unquotable |
>
> ⭐ **The check S4 owed the most, because it deleted the bucket S3's corridor was proven against:**
> `pdf-printing` **9/9** + `pdf-printing-meetings` **6/6**, identical to S3, **zero** non-ok in any
> print/document/evidence spec. **The corridor still mints real `%PDF-` bytes with `printed-documents`
> deleted** — independent confirmation that S3's re-pointing onto the core substrate is real.
>
> 🔒 **The defect S4 nearly shipped to the REMOTE.** The first version used `set local
> storage.allow_delete_query = 'true'` (copying `20260921000300`), which is a **silent no-op** —
> `WARNING (25P01): SET LOCAL can only be used in transaction blocks` — against a step whose refusal
> (`42501` from `storage.protect_delete`) is real. Fixed by moving opt-in + DELETE into **one `do`
> block**. → **FUP-DM5-SETLOCAL-MIGRATION** (`20260921000300` still carries the old idiom).
>
> ⛔ **This paragraph carried BOTH of QA r1's MINOR-1 and MINOR-2 errors until 2026-08-17, and three QA
> rounds did not catch this copy** — it surfaced only while rotating the block at step 5. It claimed the
> warning appeared when *"the E2E gate's own reset"* ran after *"a standalone reset"* passed (**false —
> a plain `db reset` emits SIX, one from `20260921000300`; the path was never load-bearing**), and that
> the opt-in was *"probed"* as load-bearing (**that probe was taken at the wrong grain** — a post-reset
> live DB, not migration-apply time). r2 recorded MINOR-1 closed in two files with a residual in the
> handoff; **this was a sixth location nobody enumerated.** ⭐ *The fix stands; only its explanation was
> wrong — so state it as a property of `set local` in a migration, never of a runner.*
> → [[a-predicate-quoted-at-the-wrong-grain]].
>
> ⭐⭐ **Two lessons worth more than the slice.** (1) **My reference sweep was bounded by ONE property
> and the breakage lived in another** — I swept `storage.buckets` reads and `storage.objects` inserts,
> found exactly one breakage, and pgTAP then returned **4 reds**, every one an assertion that the
> *policies I was dropping* still exist. (2) **Those broken assertions failed in OPPOSITE directions
> and only one direction announces itself:** three went RED, but two Rule 6 *"NO update/delete policy"*
> pins went **VACUOUS** — zero policies satisfies them forever, silently, sitting in the passing column
> of a green suite. **Had I fixed only what the suite reported, S4 would have left two dead pins
> reading as coverage.** Both replaced; `341`'s BUG-DM5-CAPA-1 pin re-keyed off the retired policy NAME
> onto the live `can_write_document` arm — and tightened to the **call** form after neutralization
> showed the bare-name form was satisfied by the body's own **comment**.
>
> ### ✅ S3 CLOSED 2026-08-14 — steps 1 ✅ · 2 ✅ · 3 ✅ **APPROVED (r2)** · 4 ✅ PO
>
> QA r1 = **CHANGES REQUESTED** (0 P0 · 2 MAJOR blocking · 6 MINOR · 2 INFO); `backend` discharged both
> blockers + four MINORs (`af9a894e`); **r2 = ✅ APPROVED** (`801a2589`,
> [review](docs/reviews/dm5-s3-review.md)) — **every blocking item re-proved by neutralization, not read.**
> ⭐ r2 did what r1 could not: with guard 4 deleted from the live body, the new **`S3k2` goes RED
> (`caught: no exception / wanted: P0002`) while `S3f4` stays GREEN** — the pair now *discriminates*, which
> is exactly what MAJOR-1 said it could not. ⭐ **r2 refused to inherit the lead's own correction of r1's
> MAJOR-2 premise and re-derived it**, then applied the declined `REVOKE` in-transaction and showed the
> `home_resource_id`-only walk yields the coordinate **before and after** — the revoke is *effective and
> closes nothing*, so declining it was right. r2 also proved red-first the two assertions `backend` had
> **not** (`t51c`/`t51d`). Safety: **8 mutation-bearing runs, every one a rolled-back transaction**,
> degenerate bodies **0** after each, and `begin_document_upload`'s md5 **byte-identical to r1's**.
> **Step 4:** PO instruction *"run the QA and conclude S3"* — approval delegated in advance, **contingent
> on an APPROVED r2**; had r2 reddened, this would have looped to step 1 instead. ⛔ **A slice verdict, not
> the phase gate** — DM5 phase QA is still owed at S6, and **r2 authorizes no part of S4.**
>
> #### Gate at HEAD `801a2589` — fresh reset, lead-verified from the catalog (2026-08-14)
>
> | check | figure |
> |---|---|
> | registry · pgTAP | **406 == 406** · **193 files / 6348 PASS** |
> | tsc · lint · vitest | 0 · **5/5** (0 warnings) · **1294** |
> | four ARMs — **re-measured by the lead at `801a2589`**, because `…000360` rewrites a `prosecdef = t` body and **`ARM=census` is the one arm that catches a gate you just added** (r2 had accepted step 1 as *reported*) | **all four HOLD**, exit 0, never piped: `ARM=census` *has anything ever asked?* → live **546** / verdicts **570** (570 ≥ 546 is the invariant; the surplus is verdicts for gates no longer live = FUP-AUTHZ-ALLOWLIST-ROT, **not** a defect) · `ARM=hat` *does a door read `memberships` without the caller's hat?* → 3 reasoned-allowlisted, self-test **6/6** · `ARM=floor` *is every door called?* → **74** never-called, all allowlisted · `FROMFINDINGS=1 ARM=wrapper` → BLIND **41** ⊆ allowlist |
> | diff sweep · degenerate bodies · findings file | BLIND 0 · ERROR 0 · **0** · **595** untouched |
> | `e2e:prod` — the FIRST full run in DM5 | **1120 passed · 0 failed · 0 did-not-run · 3 flaky · 18 batches**; `next build` compiled |
>
> ⭐ **The corridor EXECUTES — the one thing no static gate could say.** `pdf-printing` **9/9** and
> `pdf-printing-meetings` **6/6**: real `%PDF-` bytes, mint → download → public verify → revoke →
> overlay → re-verify. **S2 passed every static gate while its feature did not work at all; S3 has been
> run.** ⚠ Requires the **Gotenberg sidecar** (`docker start gotenberg-pdf`, `/health` 200 on :3010)
> **and `--workers=1`** against `next dev`.
>
> #### ↩ S3's detail ROTATED at closure (2026-08-14) — §6 step 5
>
> Now that S3 is closed, its narrative lives in **[the record](docs/progress/dm5-wave-d-retirement.md)**
> (§ "S3 … COMPLETE", incl. steps 3–4 and the safety record) and **[the handoff](docs/progress/dm5-handoff.md)
> §§9–11**. Cut from here, each preserved there first: the lead's direct catalog verifications · the
> **"still open, NOT to be assumed"** list (`case`/`interview` prints **unmintable**, so D6 holds at the
> *type* level only · `add_referral_shared_item` never driven end-to-end · the smoke file **not
> gate-resident** · `ARM=policy` **not applicable** to this diff, *recorded as such, never as clean*) ·
> the **D18 post-implementation correction** (the filter landed on an unimported `getDocument`; the
> reachable one excludes prints **structurally**). ⚠ **An `APPROVED` slice is not an absence of gaps** —
> r2 restated that list as its own "not re-verified" section, so **rotation moved it, it did not settle it.**
>
> **Open follow-ups this phase must NOT assume closed:** 🔴 **FUP-AUTHZ-HARNESS-TRANSACTIONAL** (**a live
> authz gate was left OPEN on the shared stack — read the record's incident section before running any
> mutation harness**) · 🟠 **FUP-DM5-STORAGE-ORPHANS** (⚠ **NOT closed by S4** — S4 demonstrated the local
> half rather than clearing it: the manifest-first delete was a **no-op** because all 221 retirement-bucket
> files are already metadata-less orphans, unreachable through the D9 gate **by definition**; ⛔⛔ **CORRECTED 2026-08-17 by QA
> B1 — the 221 files are GONE and did NOT go through the gate: the lead's own `supabase stop`/`start`
> stack recovery recreated the volume at `01:06:02Z`. A disposal of 15 PHI-tier objects with no
> manifest, no count comparison, no audit — inside the slice that ratified D9. The PO ruling to "leave
> them" was MOOT when given, 3h11m after the fact.** ✅ **RE-PUT AND RULED 2026-08-17, on a measurement
> taken at decision time — the CURRENT ruling, superseding "leave them": 0 files in all 8 retired
> buckets, and the PO ratified the local volume as NON-DURABLE DISPOSABLE TEST RESIDUE** (no cleanup
> step, no gate, no local manifest discipline). The retirement-scope question closes **empty by
> measurement**; ⭐ the survivor-bucket files are **not** retirement residue but E2E/print artifacts the
> reset orphans as it runs, so local orphan accumulation is a standing byproduct of `db reset`. **Item
> stays OPEN on its Cloud half ONLY** → new **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES** (undischarged — S5.R
> governs the *deliberate* path, not the accidental one); and `delete --execute` has still never run
> against a populated bucket — ✅ **now owned as `S5.R`**, though naming an owner is not a rehearsal)
> · 🟠 **FUP-DM5-SETLOCAL-MIGRATION** (**new, S4** — `set local` in a migration is
> not guaranteed transactional; `20260921000300` still relies on it) · 🟡 **FUP-DM5-MANIFEST-FLAG** (**new,
> S4** — `capture` takes `--out`; passing `delete`'s `--manifest` silently overwrote the committed S0
> baseline) · 🔴 FUP-PGTAP-VACUOUS · 🟠 FUP-DM4-RECUSAL (**DM5 does NOT close it**) · 🟠
> FUP-DM5-FINALIZE-ATOMIC (**binding input to S5**) · 🟠 **FUP-DM5-330-WRITE-BLIND** (⚠ **do not close it
> on `342`'s coverage** — door-level lifting ≠ arm-level coverage, and the "covered by `341`"
> reassurance pointed at **S2's own suite**) · 🟠 FUP-DM5-SIBLING-GUARD-DIFF · 🟡 FUP-DM5-GRANTS ·
> 🟡 FUP-AUTHZ-ALLOWLIST-ROT · 🟡 FUP-DM5-DVF-FILEOBJ · 🟡 FUP-PGTAP-WORKER-DEADLOCK · 🟡 FUP-DM4-PRODROW.
>
> ⛔ **State:** branch `main`, **NOT pushed**, no `db push`. All DM flags ship **OFF**
> (`documents_wave_d` is ON in the **local seed only** — catalog-verified: migration default `false`,
> seed enables a–d). graphify ✅ `02cec1a0`.

### ⬛ DM4 — Wave C: referrals — ✅ PO-approved 2026-08-14, rotated at the DM5 open

> `phase(DM4)` = `7b6896eb`. Gate: pgTAP **191f/6231** · registry 391==391 · lint 5/5 · vitest 1264 ·
> arms 4/4 HOLD · matrix **18/18 RED-PROVEN** · `e2e:prod` **99p/0f/0 did-not-run**, baseline 89/89 ·
> QA **APPROVED r2**, no binding condition. ⭐ The byte round trip + the DERIVATION proof are the
> phase's real artifacts. **Detail → [dm4-referrals.md](docs/progress/dm4-referrals.md)**.
>
> **Still open, do not assume closed:** 🟠 **FUP-DM4-RECUSAL** (an open SECURITY obligation whose
> deadline is the `documents_wave_c` **FLAG-ON date**; PO-deferred to Phase 19 D16 — ⛔ a widening-only
> plane cannot close it, and **DM5 does not close it either**) · 🔴 **FUP-PGTAP-VACUOUS** ·
> 🟡 FUP-DM4-PRODROW. Census blind class: ⚠ the figure is **141** at HEAD / 142 pre-DM4 — **neither
> 146 nor 150 reproduces**; cite the query beside the number.
### ⬛ DM3 + DM2 — rotated 2026-08-14 (the DM4 Record step); detail in `docs/progress/`

> Both phases are ✅ COMPLETE and PO-approved; their summary blocks lived here after their own
> Record steps and are rotated now that DM4 has closed. **The linked records are the authority.**
>
> - **DM3 — Wave B: controlled documents** · PO-approved 2026-08-14 · `phase(DM3)` = `1f5156e` ·
> 11 migrations `20260925000100`–`001100` · pgTAP `330` · gate: pgTAP **190f/6152** · all four arms
> HOLD · `e2e:prod` GREEN · QA **APPROVED r2** → [dm3-controlled-documents.md](docs/progress/dm3-controlled-documents.md)
> - **DM2 — orchestration + Wave A** · PO-approved 2026-08-13 · `phase(DM2)` = `4c6f7d9` ·
> migrations `20260924000100`–`000800` · ADRs **0117** (+Amdt 1) / **0118** · gate: pgTAP **189f/6097** ·
> `e2e:prod` GREEN · QA **APPROVED r2** → [dm2-orchestration-wave-a.md](docs/progress/dm2-orchestration-wave-a.md)
>
> ⚠ Two DM3 findings that are **not** DM4-superseded and must not be re-learned: the M1 **backfill
> that masked a broken CREATE path** (every create raised 23503 for a whole phase, invisible to every
> incremental run — only the mandatory fresh reset saw it), and the flag that **gated the last step
> of a corridor instead of the corridor** (flag OFF still PUT real bytes). ⚠ **Ethics letters home on
> the `case` securable resource, NEVER `controlled_document`** — else `HC0D6` refuses the enforcing
> label and the D15 ceiling silently vanishes.
### ⬛ Recently completed — detail in `docs/progress/`; verbose form rotated 2026-08-14

One line each. Gate numbers are in the **Phase Status** table above; the linked record carries the task
table, findings and narrative. The verbose "Still open" prose rotated **verbatim** →
[phase-status-archive.md](docs/progress/phase-status-archive.md) § B; every id below is live in this
file's **Bug Log** / **Follow-ups**.

| Work | Done | Record | Still open |
| --- | --- | --- | --- |
| **REG·KIND** — one Registro vocabulary for cases and referrals; `referral_note_types` (table + policies + trigger + reorder RPC + 4 actions + dialog) **DROPPED**, type REQUIRED default `note`, one source `src/lib/cases/registro-kinds.ts`. **No flag — structural** | 2026-08-12 | ADR [0110](docs/decisions/0110-shared-registro-kind-vocabulary.md) · `20260920000100`+`…000200` | ⚠ **NO tester pass, NO QA review** (steps 2–4 unrun by PO direction). ✅ PUSHED + `db push` DONE |
| **RDR** — referral detail page redesign (minimal header + fact rail, Registros internos, messenger Diálogo, 5-group case-access door) · QA APPROVED r1 | 2026-08-12 | [record](docs/progress/referral-detail-redesign.md) · ADR [0109](docs/decisions/0109-referral-registros-and-case-access-summary.md) | 🔴 **A11 corrected by mutation: the Rule 7 defense is the ABSENCE of `rehype-raw`**, not `rehype-sanitize` · the door-sweep harness skips `_`-prefixed names (`p0-authz-door-audit.sh:176`) ⇒ swept 4-of-5; affects every future phase |
| **ETH·E4** — ethics participant seating & professional identity (participants-lane writers, roster UI, T5 vocabulary admin) · QA APPROVED r3 | 2026-08-11 | [record](docs/progress/eth-e4-participant-seating.md) · ADR [0108](docs/decisions/0108-eth-e4-participant-seating.md) | Closes FUP-ETH-1 + FUP-FF5-2 + FUP-ETH-CPF-1. Open: FUP-ETH-A11Y-1 · FUP-E2E-SERVER-DEAD-1 · FUP-ETH-ROLES-1 |
| **ACT** — "act as" strict role assumption S0–S4 (hat bound to the session via the `active_role` JWT claim; **unflagged**) · QA APPROVED | 2026-08-10 | [record](docs/progress/act-as-role-assumption.md) · ADRs [0106](docs/decisions/0106-act-as-role-assumption.md)/[0107](docs/decisions/0107-act-s4-hat-blind-sweep-and-allowlist.md) | ✅ both deploy debts discharged (remote `db push` + Cloud auth hook); the remote is cut over. FUP-ACT-DISPOSE-UI (pilot gate, item 0) · FUP-ACT-CAPA-ASSIGN · FUP-ACT-HATLESS-AUDIT |
| **PDF·P2** — PDF printing: Meetings (ata); A7 full-sight conjunction + A8 presence-derived PHI labeling came from QA's r1 BLOCKER → the PO "Package A" ruling · QA APPROVED r2 | 2026-08-08 | [record](docs/progress/pdf-p2-meetings.md) · ADR [0104](docs/decisions/0104-pdf-document-printing-module.md) A7/A8/A9 | FUP-PDF-2..4 · **Gotenberg up, `document_printing` ON permanently** (PO, supersedes 0104's ships-OFF clause). Scope HELD: kind-sites = exactly 3 (the A8 trio) — a 4th = leak |
| **QO·B** — Quality-office oversight, Phase B (content wall + UI coherence) · QA APPROVED r2 | 2026-08-09 | [record](docs/progress/quality-office-oversight-phase-b.md) | BUG-QOB-004 · FUP-QOB-1 + FUP-QOB-2 (PO ratification package, parked) |
| **PDF·P1** — PDF printing: Forms + full skeleton · QA APPROVED r2 | 2026-08-08 | [record](docs/progress/pdf-p1-forms-skeleton.md) | FUP-PDF-2..4 |
| **QO·FUP** — FUP-QO close-out (F1–F9) · QA APPROVED r2 | 2026-08-07 | [record](docs/progress/qo-fup-close-out.md) · ADRs 0101/0102/0103 | FUP-QO-6 · FUP-QO-9 |
| **QO·A** — Quality-office oversight, Phase A · QA APPROVED r3 | 2026-08-07 | [record](docs/progress/quality-office-oversight.md) · ADR [0100](docs/decisions/0100-quality-office-oversight.md) | FUP-QO-1…6. ⚠ Phase **C** not started — **read the record's closing rule first**: *conferring a capability bit requires enumerating its consumers* |
| **MIN** — Meeting audio → generated ata; flag `audio_minutes` **OFF** (`seed.sql` forces ON locally, so a flag-OFF spec must toggle it itself) · QA APPROVED r2 | 2026-08-06 | [record](docs/progress/min-audio-minutes.md) | FUP-MIN-CUTOVER |
| **AFF** — Hospital affiliation, person identity & the org people directory · QA APPROVED r2 | 2026-08-06 | [record](docs/progress/hospital-affiliation-person-identity.md) · ADRs [0097](docs/decisions/0097-hospital-affiliation-person-identity.md)/[0098](docs/decisions/0098-aff-w1-substrate-shape-decisions.md) | FUP-AFF-1…4 (**FUP-AFF-1 = the standing trap: never cite `ARM=census` for AFF's doors**) · BUG-BOOTSTRAP-001 |
| **Membership hardening + Diretor Técnico** (ADR 0094) — W1→W4, DT flag ON | 2026-08-05 | [record](docs/progress/membership-hardening-technical-director.md) | — |
| **Case-type assignment** (ADR 0088) | 2026-08-05 | [record](docs/progress/case-type-assignment.md) | — |
| **PCI + TV** — Process/Case Integrity & Template Versioning · QA APPROVED r2 | 2026-08-05 | [record](docs/progress/process-case-integrity-and-template-versioning.md) | FUP-PCITV-1 |

### 📋 Remaining pre-pilot work

Scope: ADR [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md) (12 initiatives), re-expanded
by [0086](docs/decisions/0086-flexible-forms-pre-pilot.md) (FF-1…FF-5), re-gated by
[0093](docs/decisions/0093-phase-16-standards-crosswalk-replan.md) and
[0097](docs/decisions/0097-hospital-affiliation-person-identity.md). **All complete**, as are the ACT
cutover and both pushes. Completed items are not re-listed. What is actually left:

**0. 🔴 PILOT-GATE CHECK — the LGPD Art. 18 referral-erasure path must have a working UI route
(FUP-ACT-DISPOSE-UI).** A **gate check, not a follow-up entry**, on the Stage-3 QA reviewer's explicit
recommendation — *"'standing in prose alone' once meant a thing ran once in three weeks"* (the failure
ADR 0079 was written about). **Stated so it can be run and can fail:** name a persona who can (a) reach
the surface hosting the dispose affordance AND (b) pass `dispose_referral_phi`'s own gate. Today **no
such persona exists** — the two sets are disjoint (catalog-verified), so subject-erasure is API-only.
**Decision owner: PO** — *where* it mounts is a product call; *whether* it must work before pilot is
not. ⚠ Precedent: `20260917000400` restored this door's tenancy-admin arm specifically to un-strand
this obligation after QO·B cut it. Mechanism → [follow-ups.md](docs/progress/follow-ups.md).

---

### Completed work (archived to docs/progress/)

> Phases with their own Phase Status row are NOT re-listed — that row + its `docs/progress/*.md` link is
> the durable pointer. This list holds only ad-hoc/out-of-phase work with no row of its own. Verbose
> form rotated 2026-08-14 → [phase-status-archive.md](docs/progress/phase-status-archive.md) § C.

- **AUDIT-INVOKER-WRAPPER + BUG-REFNOTE-001** (ad-hoc; ADR [0113](docs/decisions/0113-referral-door-return-shape.md) · [0079](docs/decisions/0079-authz-door-blindness-standing-invariant.md) **Am. 7**) — REFNOTE filed as 4 doors, the catalog said **23**; ARM 5 added because all prior sweeps begin `and p.prosecdef`, leaving 88 `public` INVOKER functions in **no arm's domain** — census **452 → 540**. ⚠ **BLIND ≠ vulnerable in that class.** ✅ 2026-08-12. ⚠ **Not QA-reviewed.** → [record](docs/progress/authz-invoker-wrapper.md)
- **Case-corrections relocation + process-builder layout** (ad-hoc, pure frontend) — ✅ 2026-08-03, `2613120`+`0c1ae4c`. ⚠ **Not QA-reviewed**; spec-locator re-scoping needs `tester` sign-off; the process-builder half has **no E2E coverage at all** (pre-existing). _This line is the durable record._
- **MEM — single `memberships` collapse** (ADR [0075](docs/decisions/0075-memberships-collapse-write-path-split.md)) — ✅ 2026-07-13 → [record](docs/progress/s1-substrate.md)
- **SUP — supersession correction engine** (ADR [0074](docs/decisions/0074-supersession-correction-model.md)) — ✅ 2026-07-13 → [record](docs/progress/s1-substrate.md)
- **Case "Reuniões" panel** (ad-hoc, pure frontend) — ✅ 2026-07-12, `fbe215f`. _This line is the durable record._
- **BUG-AMV2-002 — choice-default publish regression** — ✅ 2026-07-11, `c8e951b` → [record](docs/progress/answer-model-v2.md)
- **UI/layout fixes batch + base-branch triage** — ✅ 2026-07-08 → [record](docs/progress/ui-batch-2026-07.md)
- **Meeting actual-occurrence time** (ADR [0062](docs/decisions/0062-meeting-actual-occurrence-time.md)) — ✅ 2026-07-08, QA APPROVED → [record](docs/progress/meeting-held-time.md)
- **Form-Builder Enhancements batch** — ✅ 2026-07-07, QA APPROVED; BUG-FBE-005…009 fixed → [record](docs/progress/adjustments-batch.md)
- **Shared Action-Items Hub** (ADR 0050) — ✅ 2026-07-02, all three QA-APPROVED → [record](docs/progress/action-items-hub.md)
- **Layout-adjustments batch** — ✅ 2026-07-02 → [record](docs/progress/layout-adjustments-2026-07.md)
- **`case_phase_results`** — ✅ 2026-06-23 → [record](docs/progress/case-phase-results.md)
- **Form Builder Enhancements** — ✅ 2026-06-23 → [record](docs/progress/form-builder-enhancements.md)
- **`case_patient`** (third PHI module; ADR 0038) — ✅ 2026-06-22 → [record](docs/progress/case-patient.md)
- **Case Access Control & "Meus Casos"** — ✅ 2026-06-19 → [record](docs/progress/case-access.md)
- **Case Narratives** — QA CHANGES REQUESTED 2026-06-19 → [record](docs/progress/case-narratives.md)

---


## Bug Log

<!-- OPEN bugs only. Resolved/closed rows rotate to docs/progress/bug-log-archive.md (or the
     owning phase's record) at each §6 Record step. -->

### 🔴 OPEN — the three live bugs

⚠ **Heading added 2026-08-14.** These three sat between two "Closed" headings with no heading of their
own, so an open production blocker (BUG-BOOTSTRAP-001) read as filed under *Closed*. Open bugs use bold
markers rather than headings, which is exactly why a rotation bounded by heading syntax would have
archived them — **derive the boundary by the PROPERTY (is this CLOSED?), never by markup.**

🟠 **BUG-DM5-S3-INACTIVE-PRINT-1 — a DEACTIVATED user keeps print-download authority; the same
user is refused every content document.** Filed 2026-08-14 (lead) during the S3 contract review.
**Latent, not live:** `document_printing` **ships OFF** (only `seed.sql:2401` forces it on), so
nothing is exposed in production today — it goes live the day printing is enabled.
**Mechanism:** `app.can_read_document` guards `app.is_active(p_uid)` **above** its type dispatch,
so every content document refuses a deactivated caller. `app.can_view_printed_document` has **no
`is_active` term anywhere in its transitive closure that bites** — its `form_response` arm's
**first disjunct is the bare column comparison `v_resp.created_by = p_uid`**, so no callee can
supply the check (`is_staff_admin_of_for` does carry it, but it sits behind an `or`).
`public.open_printed_document` is `SECURITY DEFINER` — RLS never runs — and its only authorization
is that one call, so the print's bytes are reachable at `POST /rest/v1/rpc/open_printed_document`
with a still-valid JWT (`EXECUTE` is granted to `authenticated`; verified from `proacl`).
**Evidence** (one rolled-back transaction, `7aa170bf`): control with the creator **active** →
print door `t` (so the probe is not vacuous); deactivate that one profile, change nothing else →
print door **still `t`**; the core door for the same uid → `f`. Rollback verified afterwards —
`00000000-…-003` back to `is_active = t`, and the single remaining inactive profile is the seed's
own `desativado.conta@test.local`. Degenerate-body sweep `0` after the run.
⭐ **Why it was invisible:** the gap is a *missing* term, and every authz arm asks whether a gate
is reached or noticed — none asks whether a door omits a check its siblings all make. It is not a
BLIND-door finding and no arm would ever have raised it.
**Fix:** ADR 0120 **D12**'s composition (byte door = core door **AND** print door) closes it, which
is why D12's "strict narrowing" claim is load-bearing rather than decorative. Owned by DM5·S3
(migration `…000340`); keystone **S3c** is exactly this probe, and it must be **red-first**.

🔵 **BUG-DM5-S3-ENV-FIXTURE-POOL-1 — ENVIRONMENT, not a product defect; no code fix owed.** Filed
2026-08-14 (tester-s3) during the S3 gate-step-2 sweep. `e2e/pdf-printing.spec.ts`'s **full
lifecycle** test (`submittedResponseIds(page, 1)`, deterministic id-ascending index 0) failed:
"Panel starts empty for this fresh fixture" found an existing `Anulado` article instead
(short code `3PDK6XFZML`, download `/api/documents/670b309c-9330-4e76-a563-380459ef7cd2`).
**Mechanism:** the stack was not actually pristine at run time. `printed_documents` already carried
9 rows before this session ran anything (verified against the very first catalog query this
session issued) — `minted_at` **23:22:20–23:23:32**, `revoked_reason` on the earliest row reading
*"Emissão de teste automatizado — anulação administrativa (sem dados de paciente)"* verbatim from
this spec's own revoke step, and **zero** `printed_documents` inserts in `seed.sql`. This matches
PROGRESS.md's own S3 step-2 note directly above ("lead ran the print specs... `pdf-printing` 9/9
and `pdf-printing-meetings` 4/5") — that prior verification run is what populated the pool, and no
`supabase db reset` ran between it and this session. The deterministic pool assumes a clean slate;
a second full run against the same DB generation reuses index 0 and finds it already minted+revoked.
**Not caused by Task 1's `storage_path` fix or the new D18 test** — this spec file is untouched, and
the contaminating rows' timestamps precede this session's own mint activity. **Evidence it is not a
regression:** the same spec's other 8 tests (which claim indices 1–5 plus dedicated fixtures) all
passed; only the index-0 "starts empty" precondition was violated. **Remediation:** a fresh
`supabase db reset --local` before the next full run of `pdf-printing.spec.ts` (or before
`e2e:prod`) clears it; not filed against `backend`, no re-run owed from them. Left OPEN only as a
record — re-verify (not re-fix) on the next fresh-reset run.

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

**Rotated 2026-08-14** — the five bugs closed this phase, each with full repro + mechanism in the
archive: **BUG-DM5-S2-STUB-1** (11 TS bodies still `throw`; the whole RCA/CAPA workspace 500'd) ·
**BUG-DM5-S2-WRITE-ARM-1** (`can_write_document` had no `rca`/`capa_action` arm ⇒ `P0002` for
**everyone**; ⚠ its first probe is **not** valid fix evidence — it ran while the gate was neutralized) ·
**BUG-DM5-S2-CITATION-TARGETS-1** · **BUG-DM5-CAPA-1** (CAPA evidence upload broken for every user
since it shipped) · **BUG-DM4-DUP-1** (⚠ it stayed marked 🟠 OPEN here until 2026-08-14 — *a fix commit
is not a status edit*). Also archived earlier: **BUG-DM2-001/-002/-003** and **BUG-CASEKIND-001**.

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
> **Retention: the most recent gate only.** Rotated **2026-08-14** →
> [test-run-archive.md](docs/progress/test-run-archive.md): the DM3 Wave-B tester row and all three
> DM5·S2 tester rows (the two REDs superseded by their own GREEN re-run). Prior rotations: 2026-08-12,
> -11, -10, -07. ⚠ The `e2e:prod` row below had been recorded **only** inside the phase section and
> never in this table — added here at the rotation.

| Date | Run | Result |
| --- | --- | --- |
| 2026-08-14 | **DM5 S3 · LEAD · `npm run e2e:prod`** — prod-standalone, fresh reset, batched. The **FIRST** full gate run in DM5, at any point in the phase | **GATE GREEN — 1120 passed · 0 failed · 0 infra · 3 flaky · 0 did-not-run · 18 batches.** Accounted **1123 of 1129** collected; the other 6 are pre-existing skips. **Read the accounting, not the verdict:** every batch reported `0 failed`, `0 did-not-run` **and** its own `accounted N/N`, so none dropped out of the denominator the way a reset-failed batch does. ⭐ `next build` compiled — S3's first production build, the only gate that catches a client value-import from a server query module. ⭐ **All 15 print tests passed IN THE PROD BUILD** (batch 9), incl. the new D18 test and the full mint→download→verify→revoke→overlay→re-verify lifecycle — RED for `tester` on the shared stack, green here under `RESET=1`, confirming **BUG-DM5-S3-ENV-FIXTURE-POOL-1** as environment. 3 flaky = **FUP-E2E-REPEAT-FLAKY**. ⚠ 3 against a baseline of ~18–27 is **better than baseline and therefore NOT evidence flakiness is fixed** |

## QA Verdicts

<!-- ONE LINE per phase/feature: verdict + date + link. The full analysis lives in
     docs/reviews/*.md — never restate rationale here or in the archive.
     Struck-through rows are superseded rounds, kept only to show a phase looped.
     Retention: current milestone only. Older concluded rows move VERBATIM to
     qa-verdicts-archive.md's "Collapsed one-line index" (the index is not rationale —
     it preserves the feature-name → review-file mapping). -->

| Phase / Feature | Verdict | Date | Report |
| --- | --- | --- | --- |
| **DM5 · S4 — legacy storage-bucket retirement** (ADR [0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md) D8/D9) — ⚠ **SLICE review; DM5 phase QA still owed at S6** — r1 ⛔ → r2 ⛔ → **r3 ✅** | ✅ **APPROVED (r3)** — B1/B2 discharged at r2, **B3 discharged at `977f1d71`**. The corrected mechanism was checked clause-by-clause against my own probes + fresh catalog reads, not read for plausibility: `protect_delete()` role-agnostic, API sets the GUC, the two ABSENT policies (SELECT+DELETE) are the operative lock, and the lead's own extra fix — *"the service role succeeds by **bypassing RLS**, not via the GUC"* — is catalog-true (`service_role rolbypassrls=t`; `authenticated`/`anon` `f`). His S5.R consequence (*"nothing platform-level stops the rehearsal's deletes"*) is **correct**: the tool uses `SUPABASE_SERVICE_ROLE_KEY` + `rolbypassrls`. New at r3: **0 P0 · 0 MAJOR · 4 MINOR · 3 INFO**, all evidence-level — ⚠ *"its own **HINT**"* quotes the exception **MESSAGE** (4 places) · the *"4,402,266 B with nothing writing"* datum is a **`du`-scope artifact** (re-measured byte-identical to r2) · `200:16`'s `Asserts:` index still contradicts its own §7 (**3rd** iteration of that sweep boundary) · **MINOR-4 is 5 of 6, reported closed twice** (`follow-ups.md:753`). ⛔ Cloud UNVERIFIED; S5.R UNREHEARSED | 2026-08-17 | [r3](docs/reviews/dm5-s4-review-r3.md) · [r2](docs/reviews/dm5-s4-review-r2.md) · [r1](docs/reviews/dm5-s4-review.md) |
| **DM5 · S3 — printed renditions onto the core substrate** (ADR [0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md) D1/D6/D7/D11/D12/D13/D17/D18) — ⚠ **SLICE review, not the phase gate; DM5 phase QA is still owed at S6** — r1 ⛔ → r2 ✅ | ✅ **APPROVED (r2)** — r1's 2 MAJOR + 6 MINOR + 2 INFO all discharged at `af9a894e`, each blocking item **re-proved by neutralization** (guard 4 deleted ⇒ `S3k2` RED / `S3f4` GREEN); new at r2: **0 P0 · 0 MAJOR · 1 MINOR · 3 INFO**, all record-level. ⚠ r1's **MAJOR-2 premise was FALSE** and the corrected record is TRUE (verified independently). Does **not** authorize S4 — PO authorization owed on the day | 2026-08-14 | [dm5-s3-review](docs/reviews/dm5-s3-review.md) |
| **DM4 — Wave C: referrals** (ADR [0119](docs/decisions/0119-dm4-referral-document-substrate-decisions.md) D1–D10) — r1 ⛔ → r2 ✅ | ✅ **APPROVED (r2)** — 0 P0 · 0 MAJOR open · 8 MINOR carried · 2 new · 5 INFO. **No binding pre-merge condition.** ⚠ MAJOR-3 was **PO-deferred to Phase 19 as an ACCEPTED OPEN GAP, not resolved** → FUP-DM4-RECUSAL, whose deadline is the flag-on date | 2026-08-14 | [dm4-referrals](docs/reviews/dm4-referrals-review.md) |
| **DM3 — Wave B: controlled documents** (ADR 0114 Amdt 1 + **Amdt 2 / D17**) — r1 ⛔ → r2 ✅ | ✅ **APPROVED (r2)** — 0 P0 · 0 MAJOR · 3 MINOR carried · 6 INFO. **No binding pre-merge condition.** ⚠ `can_write_document`'s sweep verdict is **ERROR**-resolved-by-runlog and **must not later be cited as COVERED** | 2026-08-13 | [dm3-controlled-documents](docs/reviews/dm3-controlled-documents-review.md) |
| _Verbose form of the 5 rows above, incl. both struck r1 rounds_ — rotated 2026-08-14 (§5: never restate rationale here) | — | — | [archive](docs/progress/qa-verdicts-archive.md) |
| _Phase 0 → FUP batch 2026-08-12_ — **105 concluded rows** (81 rotated 2026-08-06 + 18 rotated 2026-08-10 + 6 rotated 2026-08-13: QO·B · PDF·P2 · PDF·P1 · QO·FUP · QO·A · MIN · AFF · PCI · TV · Phase 16, incl. struck loop rows) | — | — | [collapsed index](docs/progress/qa-verdicts-archive.md) |

## Decisions

<!-- One line per decision; full rationale in docs/decisions/ (ADR) + docs/progress/decisions-log.md -->

| Date | Decision | Ref |
| --- | --- | --- |
| 2026-08-14 | **DM5 designs for a RESET remote — ADR 0120 D17** (PO). A full reset is available local **and** remote, so S3 builds the correct D7/D11/D13 shape directly and drops the copy→verify→switch ceremony. ⚠ **Not "no data migration"** — a fresh reset still produces `printed_documents` rows from the seed + `312`/`313`/`323`. ⭐ **No backfill is a SAFETY property**: with none, the create path is the only path, so an untaught create path fails **loudly** — DM3's P0 exactly. ⛔ **A LOCAL reset creates storage orphans** (it recreates the DB while the Docker volume survives, so `storage.objects` is empty while the bytes remain — measured 0 rows vs 699 objects) — binding order, the reverse of the intuitive one: **delete-by-manifest via the Storage API FIRST, then reset**. ⚠ **CORRECTED 2026-08-14: the REMOTE half of this was false** — it generalised the local measurement by *"the same mechanism class"*; the remote mechanism was one line in the CLI's `drop.sql`, reverted [cli#3359](https://github.com/supabase/cli/pull/3359), grep-verified **absent** at v2.105.0 with an `auth` positive control. The **ordering stands on the local rationale alone**. D17 closes **NO** follow-up, and authorizes **no** `db push` or remote reset | ADR [0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md) **D17** · [plan S3/S4](docs/plans/dm5-wave-d-retirement-plan.md) |
| 2026-08-13 | **DM3 ethics depth RULED — plumbing to writable, NO UI** (PO). Adds discharge condition 5: `p_decision_letter_document_id` on the RPC + forwarded from TS (it was accepted then **silently dropped**). ⚠ Fix `issue_ethics_notification` in the **body**, never DROP+CREATE — that discards the ACL. No attach-a-letter UI in DM3 is a **decision, not an omission** → FUP-DM3-ETHICS-UI | ADR [0114](docs/decisions/0114-document-model-redesign.md) **Amdt 2 / D17** |
| 2026-08-13 | **Q1 RULED — the two orphaned ethics document seams join Wave B (DM3)** (PO). A scope gap, not a deferral. **Four binding discharge conditions; partial ≠ discharged** (real FK · `p_related_document_id` restored · fail-closed rejection removed · **keystone K8 removed** — a keystone pinning a refusal the product no longer wants is a test asserting a bug). ⚠ Lifecycle is shared, the **READER SET is not** — ethics reads run on the ADR 0072/ETH·E1 spine; negative twin required | ADR [0114](docs/decisions/0114-document-model-redesign.md) **Amdt 2 / D17** · [plan](docs/plans/document-model-redesign.md) |
| 2026-08-12 | **The referral's "Registros internos" files under the CASE Registro vocabulary; `referral_note_types` is deleted** (PO — full replacement, and REQUIRED-with-default-`note`). Six shared kinds; **no snapshot column replaces `type_label`** (a fixed platform-wide list cannot be renamed). One source, `src/lib/cases/registro-kinds.ts`, import-free **so a `"use client"` component and a server module can both read it**. ⚠ Both writers changed SIGNATURE (`uuid`→`text`) ⇒ DROP+CREATE ⇒ **the ACL is discarded**; all four grants re-issued and catalog-verified | ADR [0110](docs/decisions/0110-shared-registro-kind-vocabulary.md) (supersedes [0109](docs/decisions/0109-referral-registros-and-case-access-summary.md) D2) |
| 2026-08-10 | **`document_printing` is ON PERMANENTLY in production; the Gotenberg Coolify resource is active** (PO) — **supersedes ADR 0104's "ships OFF" clause** (the flag guarded a missing sidecar that now exists). P3/P4 must not re-assert the OFF posture. ⚠ Recorded on operational confirmation — the renderer is external infra the catalog cannot attest | [0104](docs/decisions/0104-pdf-document-printing-module.md) · [runbook](docs/deployment/pdf-renderer.md) |
| 2026-08-10 | **ACT S3 — classify a hat-blind gate by CALL-SITE BINDING, not signature shape.** A gate that *receives* a caller uid can still be caller-bound; derive the population as a property over the call graph, never off signatures | [0079 Am. 6](docs/decisions/0079-authz-door-blindness-standing-invariant.md) · [0106](docs/decisions/0106-act-as-role-assumption.md) |
| 2026-08-09 | **ACT S0 — the role enum lands in `public.platform_role`, not `app`** (LEAD, measured) — `config.toml` exposes only `public`, so an `app` enum is invisible to `gen:types`, and exposing `app` would put ~281 DEFINER doors on PostgREST | [0106](docs/decisions/0106-act-as-role-assumption.md) |
| 2026-08-09 | **`is_commission_admin_of` → `is_tenancy_admin_of` RENAMED** (PO; no shim) — the old name asserted the opposite of its meaning. ⚠ `pg_policy` stores the function by **OID**, so all 54 policies followed with no policy edits | [0105](docs/decisions/0105-rename-is-tenancy-admin-of.md) |
| 2026-08-09 | **QO·B PO RATIFICATION — the FUP-QOB-2 package, item by item**, each verdict taken against a live-catalog measurement rather than the doc's claim. Ratified ①②④ + FUP-QOB-1's J1c pin; ruled BUG-QOB-004 = CUT-the-arms | [follow-ups](docs/progress/follow-ups.md) · [0100](docs/decisions/0100-quality-office-oversight.md) D12 |
| 2026-08-09 | **QO·B BUG-QOB-003 presentation rulings** (LEAD) — fix = flag + KEEP-scoped UI; `manage/audit/**` + CSV KEEP; `manage/charter` NOT KEEP; `manage/acreditacao/**` stays membership-gated | [Bug Log](#bug-log) · B.11/B.12 |
| 2026-08-08 | **QO·B content-wall classification RATIFIED (PO, Q1–Q9)** — configuration KEEP / content CUT (*"the admin shapes the containers, never reads what goes in them"*); indicator DEFINITIONS keep, MEASUREMENTS cut; hospital_admin gets the SAME wall; `dispose_case_phi` CUT | [0100](docs/decisions/0100-quality-office-oversight.md) D12 |
| 2026-08-08 | **`revoke_printed_document` KEEPS the tenancy arm — the older ruling overrules the newer draft** (0104 D11: revocation is a *governance* act revealing no content). Pinned by keystone `314` 8.5 + mutation case so a later wall-finishing sweep reds instead of silently reversing it | [0104](docs/decisions/0104-pdf-document-printing-module.md) D11 |
| 2026-08-05 | **AFF — hospital affiliation, CPF identity & the org people directory** (PO) — affiliation becomes a **row** and is a **visibility input, never a capability input** (amends 0048 D7); `profiles.cpf` = the person key; org-wide roster disclosure ratified (amends 0048 D1) | [0097](docs/decisions/0097-hospital-affiliation-person-identity.md) |
| 2026-08-04 | **The authz door-blindness invariant becomes a PHASE STEP, diff-scoped** — §6 step 1 gains ARM 2 every phase + a diff-scoped ARM 1 whenever a phase touches an RLS policy or `prosecdef` gate; step 5 must **name the ARM, not the script**. The full ~5 h sweep stays a periodic audit | [0079 Am. 1](docs/decisions/0079-authz-door-blindness-standing-invariant.md) |
| 2026-08-04 | **Membership-hardening + Diretor Técnico: the four open items closed** (PO) — T1.0 = atomic replace; **platform_admin may NOT appoint a DT**; build W1→W4 on one branch; `technical_director` ships ON | [0094 Am. 1](docs/decisions/0094-membership-hardening-and-technical-director.md) |
| 2026-08-03 | **Phase 16 build plan + 4 planning rulings** (PO) — CAPA evidence arm = hospital-match + `can_read_capa`; commission-owned frameworks commission-scoped SELECT; visible hospital nav entry; ONA skeleton PO-validated | [0093 Am. 1](docs/decisions/0093-phase-16-standards-crosswalk-replan.md) |
| 2026-08-03 | **Phase 16 replanned + re-gates the pilot** (PO) — skeleton-only framework packs (licensing); ONA `level` dimension; evidence enum +`charter`+`ethics_procedure`; worst-wins rollup; `hospital_readiness` re-gated off `is_admin` (the noun rule) | [0093](docs/decisions/0093-phase-16-standards-crosswalk-replan.md) |
| 2026-07-27 | **Flexible-Forms FF-1…FF-5 pulled pre-pilot** (PO) — all five gate the pilot deploy | [0086](docs/decisions/0086-flexible-forms-pre-pilot.md) |
| 2026-07-27 | **FF-1 Repeating Groups rulings** (PO) — nesting **capped at depth 1, schema-enforced**; conditions resolve **inside-out** | [0087](docs/decisions/0087-ff1-repeating-groups.md) |
| 2026-07-23 | **Case custom fields** — template-defined, **non-PHI** administrative descriptors on cases | [0083](docs/decisions/0083-case-custom-fields.md) |
| 2026-07-16 | **`manage_case_access` — KEEP (confirmed, PO)** | [0078 D1/A16](docs/decisions/0078-authorization-capability-model.md) |
| 2026-07-16 | **Meeting family — ACCEPT AS-IS (exclusion-perimeter residual)** — a coordinator recused from case X can conclude a multi-case meeting discussing X | [handoff §5](docs/progress/authz-handoff.md) |
| 2026-07-16 | **ADR 0078 A5 perf gate PASSED — no migration.** Resolver parity-or-faster + strictly linear on realistic (2005-case) data | [0078 D2/A5](docs/decisions/0078-authorization-capability-model.md) |
| 2026-07-12 | **Pre-pilot release scope expansion** — pulled 12 initiatives (Phases 20–21, Referrals v2, Interviews v2, Ethics E1–E3, action-items …) | [0071](docs/decisions/0071-pre-pilot-release-scope-expansion.md) |
| 2026-07-12 | **Referrals v2 — Dialogue & Governance** — adopt the two-way `referral_messages` thread + defer 12 items | [0037-A1](docs/decisions/0037-inter-committee-case-referrals.md) |
| 2026-07-10 | **Pre-Pilot Foundations Program** — one collision-free plan sequencing F0→F1→F2→F3→F-cleanup | [program](docs/plans/pre-pilot-foundations-program.md) |
| 2026-07-09 | **Case subject generalization → participants/roles/professional-registry/case-types** (E0 foundation for Ethics) | [0064](docs/decisions/0064-case-subject-generalization-participants.md) |
| 2026-07-09 | **Centralized-attachments substrate refinement** (14e) — single authorizing owner + `attachment_references`/`_subjects` | [0063](docs/decisions/0063-centralized-attachments-substrate.md) |
| 2026-07-08 | **Administrativo delegated-capability role** — per-commission appointment + a curated, finite capability menu | [0061](docs/decisions/0061-administrativo-delegated-role.md) |
| 2026-07-06 | **Coolify as the pre-Phase-9 dev/staging deployment target** — Dockerfile-only (Traefik replaces the planned Caddy/compose) | [0059](docs/decisions/0059-coolify-deployment-target.md) |
| 2026-07-05 | **Phase 15/17 revision + pre-pilot re-sequencing** — build order **15 → 17 → 16**; 18–21 post-pilot | [0057](docs/decisions/0057-indicators-doc-control-replan.md) |
| 2026-07-06 | **Phase 15 derived-measurement compute** — `compute_derived_measurement` replicates the `dashboard_distributions` mechanics | [0058](docs/decisions/0058-derived-measurement-compute.md) |
| 2026-07-02 | **Action-items fold + `visibility_scope` + case-access expiry** — scope-aware hub `SELECT` via `can_read_action_item` | [0050](docs/decisions/0050-action-items-fold-visibility-scope-case-access-expiry.md) |
| 2026-07-01 | **Answer-Model v2** — uniform answer row + typed scalar cols + instance-ready answer key | [0045](docs/decisions/0045-answer-model-v2.md) |
| 2026-07-01 | **Forward-compat form capabilities** — `form_items.parent_item_id` + reserved hooks | [0046](docs/decisions/0046-forward-compat-form-capabilities.md) |
| _pre-2026-07_ | **35 earlier decision rows (Phases 0–14, 2026-06-11 → 2026-06-25) rotated 2026-08-04** — one line each, plus the verbose form of every one. ⚠ The full pre-compaction form of the 32 rows above is archived there too (2026-08-14) | [decisions-log.md](docs/progress/decisions-log.md) |

## Follow-ups / Deferred Items

_Full bodies of OPEN items rotated 2026-08-08 → **[follow-ups.md](docs/progress/follow-ups.md)** — update BOTH (the body there, the line here) when an item changes state. Resolved items → [follow-ups-archive.md](docs/progress/follow-ups-archive.md). One line per item: severity · id · title · owner._

⚠ **Six lines below are NEW index entries, not new items** (2026-08-14): FUP-AUTHZ-HARNESS-TRANSACTIONAL ·
FUP-AUTHZ-ALLOWLIST-ROT · FUP-DM5-GRANTS · FUP-DM5-FINALIZE-ATOMIC · FUP-DM5-DVF-FILEOBJ ·
FUP-VACUOUS-COVERAGE-1 — each was OPEN but named **only** inside the DM5 phase section or a Bug Log
pointer, so compressing those would have dropped it from the index entirely.

- 🔴 **FUP-ACT-DISPOSE-UI** — LGPD Art. 18 referral-erasure has no UI route (authorized ∩ reachable = ∅); **PILOT-GATE CHECK, item 0 above** — PO
- 🔴 **FUP-AUTHZ-HARNESS-TRANSACTIONAL** — the door-audit harness neutralizes **outside** a transaction, so process death leaves an authz gate **OPEN** (it happened). ⛔ Read the DM5 record's incident section before running any mutation harness — lead/backend
- 🔴 **FUP-PGTAP-VACUOUS** — `lint:vacuous` scans TS specs only; ~6348 pgTAP assertions unscanned, live specimen in a PHI-boundary suite. The sweep must be **proven able to fail** first — lead/backend
- 🔴 **FUP-AFF-1** — the census is BLIND to write-path doors (ADR 0079 Am. 5); ⛔ cite `302`'s keystones, **never `ARM=census`** — backend/harness
- 🔴 **FUP-PCITV-1** — what QA APPROVED **over**, ranked: 5 open (TRUNCATE revoke residue · audit-mesh 2/7 arms · unexercised org-admin disjunct · resolver/GUC semantics · 10 bare `for select` policies) — unassigned
- 🔴 **FUP-ETH-ROLES-1** — no production bootstrap of `case_participant_roles`; the bundle lives only in `seed.sql` and `role_id` is NOT NULL, so a real org starts with zero roles and every participant type dead-ends. Decide before a second org onboards — product/backend
- ⬛ **FUP-QOB-3 — RESOLVED 2026-08-09 (PO), corrected here 2026-08-15.** ⚠ This line sat **🔴 OPEN for six days** describing a live Rule-12 gap that had already been ruled — caught by diffing every severity marker in this file against its follow-up body heading. The ruling **inverted the finding**: `dispose_event_phi` **KEEPS** its tenancy arm because *event was the one that got it right*, and referral disposal gets the same backstop back (a hospital can have **zero** NSP operators — measured — so NSP-only disposal would strand an LGPD Art. 18 erasure request on the *controlador*). Full ruling: [follow-ups.md](docs/progress/follow-ups.md) § FUP-QOB-3
- 🔴 **FUP-FF5-1** — patient-lane sublabel degenerate on the READ path (PO DEFERRED; resolve before the lane reaches a real committee) — backend
- 🟠 **FUP-DM5-STORAGE-ORPHANS** — a **LOCAL** reset wipes `storage.objects` but not the bytes, and the Storage API lists *from* that table. ✅ **S4 HAS RUN** (no longer "blocks S4"): it measured **866 files / 9.9 MB / 235 PHI** (221 / 6.93 MB / 15 PHI in the 8 retirement buckets) — superseding the old 699/7.02 MB/198 figure — and the manifest-first delete was a **NO-OP**, every retirement byte being a metadata-less orphan. ⛔⛔ **Those 221 files were then DESTROYED OUTSIDE THE GATE** by the lead's `supabase stop`/`start` recovery (`01:06:02Z`); retirement buckets now read **0**. ✅ **RE-PUT AND RULED 2026-08-17** (B1's requirement), on a measurement taken **at decision time**: **0 files in all 8 retired buckets** (the durable half — nothing writes to a bucket that does not exist), and 166 files in the 4 survivors *at that moment* — ⛔ **a timestamped observation, not a count: 245 after the same session's gate** (QA r2 INFO-5). **PO ratified the local volume as non-durable disposable test residue** (no cleanup step, no gate, no local manifest discipline). The retirement-scope question closes **empty by measurement**. ⭐ Survivor bytes are **not** retirement residue but E2E/print artifacts the reset orphans as it runs — local orphan accumulation is a **standing byproduct of `db reset`**, not an S4 artifact, which is why the PO ratified a **class** and not a number. **Quote the mechanism; do not refresh the figure.** The item stays OPEN on its **Cloud** half ONLY (no customer-accessible tool may be able to SEE an orphan; S3-protocol endpoint UNPROBED). ⛔ The remote-reset half was a stale inference (CLI line reverted #3359; absent at v2.105.0, `auth` control). ⭐ A property living in a **dependency's source** regresses on `npm update` — lead/backend
- 🟠 **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES** — a `supabase stop`/`start` recovery destroyed 221 storage objects (**15 PHI-tier**) with no manifest, no count comparison, no audit — the event ADR 0120 D9 exists to prevent, inside the slice that ratified it. **D9 governs the deliberate path; the accidental one is ungoverned and silent.** Live question for Cloud (`db:reset:linked` + 20-yr LGPD/ANVISA) — lead/backend
- 🟠 **FUP-DM5-D9-NO-ARM-SEES-A-BYTE-POST-RETIREMENT** — once `…000400` applies, `capture` prints `CAPTURE CLEAN` and the **only** arm that can still see a surviving byte is the volume `walk`, which is `STORAGE_BACKEND=file` **local-only** ⇒ on Cloud, post-migration, the retirement tooling has **no** such arm. ⭐ And the migration's guard ("no `storage.objects` rows") is satisfied *perfectly* by an **orphaned** bucket — **it is real, and it is not a proof of emptiness.** Input to S5/S6 + the deploy runbook — backend
- 🔴 **FUP-DM5-NO-ANSWER-VS-NOTHING** (🟠→🔴 **lead ruling 2026-08-17**, escalated on instance 3) — *"I could not look"* is not distinguished from *"I looked and found nothing"*. ⛔ **Instance 3 is the worst and is why this is 🔴:** `complete_document_disposal` verifies absence against `storage.objects` (**metadata**), so a `disposed` row means *"metadata absent, bytes unknown"* — a **false compliance assertion** to a regulator under LGPD/ANVISA/CFM 1821 at 20-yr retention. Unlike instances 1–2 (tool output an operator can second-guess) this one is **persisted**. ⛔ **It compounds with S5.R: on Cloud there is no volume proof, so "bytes gone" is not merely unchecked but UNVERIFIABLE by the method we have — `disposed` can never mean more than "metadata gone" on Cloud** until FUP-DM5-CLOUD-ORPHAN-SURFACE settles it or the door's contract is amended. ⭐ Lead ruled that filing it **undecided** rather than merging it on backend's judgement was the correct call. **Filed as a CLASS, two further instances:** `--allow-orphans` mutes both facts in one flag (**unfixed — the remaining surface**; a usable Cloud exit code costs blindness to real orphan verdicts), and `.list('')` on a bucket whose **row is gone** returns `{data: [], error: null}` — so the post-deletion classifier took the **reassuring** branch, no `DO NOT PROCEED`, **on the destructive path**, for a bucket it never interrogated (**FIXED `d2b19808`**, pinned by rehearsal **R3d**). ⭐ Found ONLY because a control was built for a state nobody had observed — and per the lead it is **not a corner case: it is the state all 8 retired buckets are in.** (instance 3 is the escalation above) — backend/lead
- 🔴 **FUP-DM5-BACKUP-IS-PHI-EXPORT** (filed on **lead ruling 2026-08-17 — filing ruled not optional**) — a Storage backup is an **unmanaged plaintext PHI export**, and ⛔ **not hypothetical: the S5 drill created one** (`docker cp`, 245 files incl. **68 PHI-tier**, no RLS, no audited door, no TTL, no encryption beyond the host FS; deleted after verification, the mechanism remains). It is the **widest PHI egress path the system has** — a volume snapshot is Supabase-unaware *by design*, which is why it is also the only mechanism that captures orphans. ⛔ **The disposal runbook would instruct a human to create it:** *a procedure whose correct execution produces an undocumented plaintext PHI copy is not a complete procedure.* Runbook now carries **§6b** with four values **awaiting the PO** (location · permitted reader set · retention · destruction), stating as present-tense fact — not a TODO — that until they are set, executing the backup half creates an unmanaged PHI copy — PO, then backend/lead
- 🟠 **FUP-DM5-CLOUD-ORPHAN-SURFACE** — UNSETTLED whether Cloud exposes **any** orphan-visible surface; the **S3-compatible endpoint is UNPROBED** and is the named measurement that would settle it (an S3 `ListObjectsV2` enumerates the backing store, so if it lists an object whose metadata row is gone, D9's byte-side controls are recoverable on Cloud). ⚠ **A PROMOTION, not a new question** — it was a parenthetical inside FUP-DM5-STORAGE-ORPHANS' Cloud half, under a headline reading *"closes empty by measurement"*. ✅ **LEAD-RULED 2026-08-17: the promotion is RIGHT — KEEP promoted, CROSS-LINK, do NOT merge downward** (the earlier "merge downward" option is withdrawn; both bodies now cross-link). Reasoning worth reusing: *an item that can change a verdict does not live inside the parentheses of the verdict it would change* — same defect as ADR 0120 root-cause #3 and the S2 reopen-banner. **Neither item closes the other.** ⛔ **Blocks FUP-DM5-NO-ANSWER-VS-NOTHING instance 3 (🔴)**: until settled, `disposed` cannot mean more than "metadata gone" on Cloud. Measured basis: with local proof forced off, an under-count delete exits **0 while a real file survives** (R6); over-count refusal survives (R6b) ⇒ 2 of D9's 4 controls are lost, both byte-side — backend/lead
- 🟠 **FUP-DM5-DISPOSAL-JOB** — `disposal_pending` has **three inflow doors and zero automated outflow**: `complete_document_disposal` (the only writer of `disposed`, EXECUTE to `service_role`/`postgres` only — **built** for an operational caller) has exactly ONE repo caller, `reclassifyDocument`, on an unrelated copy-then-retire lane. No `pg_cron`, no `cron` schema, no workflows, single-process Dockerfile. **PO ruled: document, do NOT build** — mitigation is `docs/deployment/phi-disposal-runbook.md`, whose **owner + periodicity are PROPOSED and still OWED by the PO** (until named, the procedure exists but the mitigation does not). Pinned both sides (`343_dm5_s5_disposal_gap.sql` + `disposal-gap.test.ts`), both observed RED against real mutations. ⭐ **Composes with FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES — do not resolve either alone:** D11 is the missing *inflow*, this is the missing *outflow*, so **fixing D11 alone destroys nothing and merely grows a pile of `disposal_pending` rows** while D11 reads as honoured — PO, then backend
- 🟡 **FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN** — `supabase/tests/mutation/q1-quality-mutation-audit.sh:140-153` targets `attachments_obj_select_readable`, dropped by **DM1** (`20260923000100`). Its no-op guard tests `v_qual !~ …`, which is **NULL** when the policy is absent, so the guard never fires and control reaches `alter policy` on a nonexistent policy → **`42704`**. ⭐ *A guard written to announce "MUTATION NO-OP" fails OPEN into an error instead.* Pre-existing, **not S4's doing** — backend
- 🟠 **FUP-DM4-RECUSAL** — `add_referral_shared_item` checks referral-**source** authority but never `can_read_case`/`can_read_document` ⇒ a **RECUSED** coordinator can freeze a case's PHI into a referral. PO-deferred to Phase 19 (D16). ⛔ **A security obligation whose deadline is the flag-on date; it must NEVER be absorbed into "Phase 19 delivered an access plane"** — lead/PO/backend
- 🟠 **FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES** — D11 says superseded print bytes retire via `disposal_state`; **measured, both stay `none` and nothing schedules it**. Build retirement or amend D11 — PO, then backend. ✅ ADR 0120 D11 now carries an inline `⏳ CONTESTED` pointer (r2-MINOR-1) — a pointer, **not** an amendment, so the PO's build-vs-strike choice stays open
- 🔵 **FUP-DM5-342-PLAN-COMMENT** — `342`'s header comment declares plan **44** for a `plan(59)` suite; cosmetic, filed as a pure instance of the comment-goes-stale class that once shipped a live bug — backend
- 🟠 **FUP-DM5-SIBLING-GUARD-DIFF** — **no authz arm can see a door that OMITS a check its siblings all make**; all five test gates that *are* there. Specimen: BUG-DM5-S3-INACTIVE-PRINT-1. Wants a transitive catalog guard-set diff with a positive control — lead/backend
- 🟠 **FUP-DM5-330-WRITE-BLIND** — `330` notices nothing when `can_write_document` is neutralized. ⚠ **Do not close on `342`'s coverage**: door-level lifting ≠ arm-level coverage, and "covered by `341`" pointed at **S2's own suite** — backend
- 🟠 **FUP-DM5-FINALIZE-ATOMIC** — the finalize path is four round-trips; a failure after byte-verification orphans the document. **Binding input to S5** — backend/lead
- 🟡 **FUP-DM5-DANGLING-PRINT-ON-DELETED-DRAFT** — a print minted from a **draft** outlives the deleted response: dangling `securable_resources` row, no UI surface, bytes persist — PO, then backend
- 🟡 **FUP-DM5-DEAD-CORE-PROJECTION** — `queries/documents.ts`'s `getDocument` has **zero importers**; a same-named export is what every route calls, so the D18 detail ruling landed on the unreachable one. ⛔ Do not strip the filter and keep the function — frontend/backend
- 🟡 **FUP-DM5-GRANTS** — `rca_evidence`/`capa_action_evidence` RPCs are NOT single doors — backend
- 🟡 **FUP-DM5-DVF-FILEOBJ** — latent: the mint creates a **fresh** `file_object` and never binds a pre-existing one; live only if a later slice binds an existing row. Re-check at S4/S5 — backend
- 🟡 **FUP-ACL-APP-POPULATION** — the DROP+CREATE → PUBLIC-EXECUTE mechanism has fired **3×**, and the **`app`** schema has no generic net (`100` t19 is `public`-bounded; `320`'s is an 8-name allowlist) — backend
- 🟡 **FUP-AUTHZ-ALLOWLIST-ROT** — nothing validates that floor-allowlist entries name a **live** door — lead/backend
- 🟡 **FUP-PGTAP-WORKER-DEADLOCK** — `test:db` intermittently deadlocks a `pg_prove` worker; **assurance, not correctness** (a dropped suite is not a passed suite). ⛔ Never pipe the run through `tail` — backend
- 🟡 **FUP-PGTAP-SAVEPOINT** — ⚠ **DOWNGRADED 🔴→🟡: the original claim was WRONG.** TAP output cannot be rolled back; real only in the degenerate all-assertions-inside case — lead
- 🟡 **FUP-VACUOUS-COVERAGE-1** ⚠ **THIS LINE IS THE ONLY RECORD — it has no body in `follow-ups.md`** (verified 2026-08-15; the rotation banner's claim that all seven body-less follow-ups "were written first" was true for six, **not** for this one). ⛔ Do not compress or cut this line believing a body exists. — `phi-remediation` REM-8/REM-9 are honest `test.skip()`s, **outside** the vacuity property, so `lint:vacuous` will never catch them — tester/backend
- 🟡 **FUP-329-ABORT-SHAPE** — a `329` keystone whose failure **aborts the file** (drops 41 assertions), making a mutation sweep over those gates unclassifiable — backend
- 🟡 **FUP-DM4-PRODROW** — the dangling frozen-snapshot PRODUCTION row + 3 unreferenced objects: reconcile at push/deploy (PO R2). ⚠ Must NOT delete DM4's M3/M4 guards — lead/backend
- 🟡 **FUP-E2E-REPEAT-FLAKY** — `act-role-assumption:157` + `phase2-auth-shell:268` + `dm5-nsp-evidence:347` flaked across **four** gate runs ⇒ established. All focus/navigation-timing shaped, suggesting **one** root cause — lead/tester
- 🟡 **FUP-E2E-SERVER-DEAD-1** — the prod-standalone server dies under load in ~3 of 17 batches; `BATCH_TESTS=22` rescues. Infra, never an assertion failure — **but a batch with no verdict is not a pass** — unassigned
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
