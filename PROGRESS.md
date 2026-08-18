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
| DM | **Document Model Redesign** [0114](docs/decisions/0114-document-model-redesign.md) (+Amdt 1/2) · ADRs [0116](docs/decisions/0116-dm1-substrate-cutover-decisions.md)/[0117](docs/decisions/0117-dm2-s1-confidentiality-ceiling-decisions.md)/[0118](docs/decisions/0118-dm2-s2-command-layer-decisions.md)/[0119](docs/decisions/0119-dm4-referral-document-substrate-decisions.md)/**[0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md)**/**[0121](docs/decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md)**/**[0122](docs/decisions/0122-recusal-case-read-arm-at-the-referral-freeze-door.md)** · [plan](docs/plans/document-model-redesign.md) | ✅ **DM0–DM4 complete** · 🔵 **DM5 OPEN** — S0 ✅ · ~~S1~~ WITHDRAWN · S2 ✅ · S3 ✅ · S4 ✅ · **S5 ✅ CLOSED 2026-08-17, all five gate steps** (step 4 PO-ruled: the batch's approval closes S5 too) · **follow-up batch ✅ gate green, PO-approved** · **S6 not started — PO directed the PROGRESS.md rotation first**. ⚠ **DM5's PHASE QA is owed at S6 — S3/S4/S5 verdicts are SLICE verdicts** | ✅ DM4: 5 migrations `20260926000100`–`000500` · pgTAP `340` | ✅ DM4: pgTAP **191f/6231** · 391==391 · vitest 1264 · 4 ARMs HOLD · matrix **18/18 RED-PROVEN** · `e2e:prod` **99p/0f**. Batch gate (`4f16ea5f`): pgTAP **194f/6392** · registry 412==412 · lint 5/5 · tsc 0 · vitest 1304 · 4 ARMs HOLD · `e2e:prod` **1118p/0f/0 did-not-run** | ✅ DM4 **APPROVED (r2)** [review](docs/reviews/dm4-referrals-review.md), no binding condition. ⚠ The batch was PO-approved with **gate step 3 (QA) NOT RUN** — stated before approval, accepted, recorded as a deviation | ✅ **2026-08-14** (DM4) · batch **2026-08-17** | 2026-08-14 | `phase(DM4)` = `7b6896eb` · `phase(DM5-followups)` = `fd69d4be`. ⛔ **Read § Current Phase Tasks › "State" for the measured remote/push facts** — the "NOT pushed / no `db push`" claim that used to live in this cell was **false in both halves**; DM1–DM5·S3 are **LIVE ON THE REMOTE** and **five** migrations are local-only. ⚠ **"Flags ship OFF" is NOT a security boundary** (0 RLS policies read a flag). ⚠⚠ **FUP-DM4-RECUSAL is closed against the LOCAL catalog only — the PHI path is still open on the remote until `db push`.** Records: [DM1](docs/progress/dm1-substrate-cutover.md)·[DM2](docs/progress/dm2-orchestration-wave-a.md)·[DM3](docs/progress/dm3-controlled-documents.md)·[DM4](docs/progress/dm4-referrals.md)·**[DM5](docs/progress/dm5-wave-d-retirement.md)**·[S5](docs/progress/dm5-s5-operational-closure.md). Open items + PO decisions owed: § Current Phase Tasks › "Open follow-ups". ↩ This cell's 11.5 KB of narrative rotated **2026-08-17** → the DM5 record § "Rotated from PROGRESS.md 2026-08-17 — the Phase Status DM row", preserved verbatim before the cut |
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
> brief → [dm5-handoff.md](docs/progress/dm5-handoff.md) §13** — ⚠ **this pointer read "§§9–11" until
> 2026-08-17, and the handoff's own §0 says those are DISCHARGED HISTORY**; §13 is the resume point ·
> plan [dm5-wave-d-retirement-plan.md](docs/plans/dm5-wave-d-retirement-plan.md) · ADRs
> **[0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md)** (D1–D18) +
> **[0121](docs/decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md)** (disposal lifecycle,
> ACCEPTED) + **[0122](docs/decisions/0122-recusal-case-read-arm-at-the-referral-freeze-door.md)**
> (recusal arm) · step 0 [dm5-surface-verification.md](docs/progress/dm5-surface-verification.md).
> Window `20260927000100`+ · flag `documents_wave_d` · pgTAP **`341`** (S2) + **`342`** (S3) +
> **`343`** (S5 disposal gap — ⚠ its **K6b asserts "no scheduler exists at all"**, TRUE today and a
> **false pin** the day the D2 job lands; rewrite `343` in the same slice, not after).
> ⚠ The phase narrative — the three mis-pinned catalog facts, the six enumeration-boundary repeats and
> the S2 close-then-reopen history — rotated to the record **2026-08-14**. **Those lessons are the
> phase's most valuable artifact; the record, not this section, is where they live.**
>
> **Slices:** **S0 ✅** manifest tool (`0e85cbe7`, `9d37ad79`; baseline self-labels **DEGENERATE**, not
> S4 input) · ~~S1~~ ⛔ **WITHDRAWN, never built** (D3/D4/D5 struck → **D11**) · **S2 ✅** NSP RCA/CAPA
> evidence · **S3 ✅ COMPLETE — all four gate steps** (2026-08-14) · **S4 ✅ COMPLETE — all five gate
> steps** (built 2026-08-16 **PO-authorized on the day**, closed 2026-08-17; QA r1 ⛔ → r2 ⛔ → **r3 ✅**)
> · **S5 ✅ COMPLETE — all five gate steps** (2026-08-17) — operational closure, carrying **S5.R**
> (byte-path rehearsal, PO-directed same day), **S5.D** (disposal runbook + the gap pinned on both
> sides), the backup/restore drill and the EXPLAIN baselines. **Step 2 ✅ discharged** by the follow-up
> batch's `e2e:prod`, which the PO ruled would ride S5's owed run; **step 4 ✅ PO-RULED 2026-08-17 —
> the batch's approval closes S5 too** · **FOLLOW-UP BATCH ✅ gate green, PO-approved 2026-08-17**
> (`fd69d4be`) · **S6 🔵 IN PROGRESS** — opened 2026-08-17 after the pre-S6 follow-up batch
> (`496fd135`). Build work **done**; **step 3 QA ✅ r2 APPROVED 2026-08-17** (r1 ⛔ → fixes → r2);
> gate steps 2 + 4 **owed**.
>
> ### 🔵 S6 — canon rewrite + program exit sweep (opened 2026-08-17) — **steps 1–3 ✅ COMPLETE · step 4 (PO) OWED** — slice QA ✅ r2 · **DM5 PHASE QA ✅ APPROVED r2**
>
> **Preceded by a pre-S6 follow-up batch (`496fd135`)** — census re-scoped, P4 measured, 478 links
> repointed. Detail in the follow-ups register and the S5 record.
>
> **Built:**
> - **ARCHITECTURE.md Rule 1** — the RLS count read *"146/146 as of 2026-07-27"* and was **stale by
>   19 tables**; now **165/165 measured**, with the deriving SQL inline. Plus **D8's Rule-1
>   sharpening** as the rule's **fourth** pattern (ADR 0114 D8, owed to the canon since DM1):
>   **RLS is the boundary for document METADATA; for BYTES it is not the boundary at all** — the two
>   document buckets carry INSERT policies only, and `open_document_version` is the whole boundary.
>   *A policy-shaped audit reads "no read policy ⇒ unreadable", which is exactly backwards.*
> - **ARCHITECTURE.md §2** — the **document model was entirely absent from the canonical schema**
>   though the program had shipped it. 13 tables added, columns derived from `pg_attribute`, not
>   migration text.
> - **ARCHITECTURE.md Rule 9** — the missing documents-module exception, owed since **DM2 QA r1
>   INFO-4** and carried across four slices. Until now the canon and QA-accepted practice
>   **contradicted each other**.
> - **`docs/backend-state.md`** — the currency stamp (*"stale by three slices … registry 391→407"*,
>   itself stale) replaced by a measured **DM END STATE** block: registry **411==411**, 13 tables /
>   1 policy each, **38** document doors (5 service-role-only), 4 buckets, `storage.objects` **3
>   INSERT + 1 SELECT**. The **"census 146 vs 141"** disagreement is resolved — it was a **missing
>   SCHEMA BOUND**, not a wrong number (**141** `public`, **145** `app`+`public`); the old
>   *"(273 signatures)"* does not reproduce and is retired. Every figure carries its query.
>
> **Exit sweep — bounded by IDENTIFIER (`storage_path`, `storage_bucket`, bucket literals,
> `createSignedUrl`), never by directory or call syntax: ✅ CLEAN.** All 28 retired-bucket literals
> in `src/`+`e2e/` are **comments**; the one apparent live hit is `domId: "interview-attachments"`,
> an HTML anchor, not a bucket. The only live hardcoded bucket literal is `.from('form-assets')`×2 —
> surviving and out of scope (D13). Every document-model bucket reference is **derived** from
> `storage_bucket`. ⛔ **Not covered:** `supabase/` SQL was not swept by this pass.
> ⚠ **Bound disclosure (S6 QA F4):** the 28 reproduces **only** over the 7 hyphenated retired-bucket
> names — the bare name `attachments` was excluded (it is also a feature-flag key and a module name)
> and appears **live ×3** as `featureEnabled('attachments')`, which are flag keys, not bucket
> references (the `case_patient` collision class). The exclusion was right; its silence was the
> defect. ✅ **The `supabase/` hole was closed by QA at the catalog layer** (the only layer that
> executes): quote-bounded retired-bucket literals in `pg_get_functiondef` over every `app`+`public`
> function and in `pg_policies` → **0 and 0**.
>
> ⭐⭐ **THE SWEEP'S REAL YIELD — it falsified a canon sentence I had written an hour earlier.**
> Rule 9's first draft said the exception was **ONE** module and that *"a second would break ADR 0114
> D8's singularity"*. **Both halves were false.** There are **TWO** signers — `documents/actions.ts`
> and `referrals/actions.ts` (DM4, ADR-cited in its own header) — and **D8's singularity is a
> DB-KERNEL property, not a TS-module one**: `open_document_version` and `open_printed_document`
> both delegate to `app.resolve_document_version_bytes` (D12 composition), while
> `open_referral_snapshot_document` deliberately does **not**. Conflating the two layers is what
> produced the false sentence. ⚠ **Consequence that outlives S6:** the referral door sits **outside
> the byte kernel**, so kernel-level gates do **not** automatically cover it — directly relevant to
> 🔴 `FUP-DM5-SUPERSEDE-SERVING-COLLISION`, which is a `resolve_document_version_bytes` finding.
> A **third** signer now needs a ruling; the list is exhaustive by intent.
>
> **Gate step 1 — ✅ GREEN (2026-08-17), on a fresh `db reset`:**
>
> | check | result |
> |---|---|
> | pgTAP | **194 files / 6392 PASS**, exit 0 |
> | vitest | **89 files / 1304 passed**, exit 0 |
> | lint (5 chained) | **exit 0** — eslint 0/0, css-vars, memberships-door, client-server-imports, vacuous (185 spec files, 0 findings) |
> | typecheck | **exit 0** |
> | `next build` | **exit 0** — compiled, **19/19** static pages |
> | authz, **named by ARM** | `ARM=census` *has anything ever asked?* **546 live / 570 verdicts** · `ARM=hat` *does a door read `memberships` hatless?* **3, all reasoned-allowlisted** · `ARM=floor` *is every door called?* **74 never-called, all allowlisted, every entry resolves** · `FROMFINDINGS=1 ARM=wrapper` **BLIND 41 ⊆ allowlist** — all four **HOLD** |
> | diff-scoped `ARM=policy` | **NOT APPLICABLE — measured, not asserted**: **0** migrations, **0** policy statements, **0** `prosecdef` changes in the S6 diff |
>
> ⚠ **S6 changed ZERO `src/` files** (diff = `ARCHITECTURE.md` · `PROGRESS.md` · `docs/backend-state.md`),
> so `next build` could not be affected — **it was run anyway rather than argued away**, because
> *an omission that happens to be harmless is still an omission* (the S5 QA r1 MINOR-1 lesson).
>
> **Gate step 3 — ✅ QA r2 APPROVED 2026-08-17**
> ([review](docs/reviews/dm5-s6-review.md)). **r1 ⛔ CHANGES REQUESTED: six findings,
> ALL record defects** (the DM5 pattern unbroken — no code change requested in any round):
> **F1** the END STATE block **INVERTED** its source measurement ("51 of 52 read a flag" — the
> source says 51 do NOT; fixed in all THREE places it sat) · **F2** §2 ended the `upload_state`
> machine at `active`, a state the CHECK has **never contained** (`'active'` is `documents.status`) ·
> **F3** the "servable predicate" claimed `deleted_at is null` — enforced **nowhere** on the byte
> path · **F4** the sweep's undisclosed bound (above) · **F5** Rule 9's "doors return IDs only" is
> false for `open_printed_document` since ADR 0120 D7/D12 · **F6** the "full document-surface
> rewrite" promise left contradicting the delivered END-STATE-block scope. All six **fixed
> same-day**; QA **re-measured gate step 1 in full** on a fresh reset (pgTAP 194f/6392 · vitest
> 89f/1304 · lint 5/5 · tsc 0 · census 546/570 · hat 3 · floor 74 · wrapper 41 ⊆ allowlist — every
> figure reproduced) and independently re-derived **every** measured claim in the S6 diff against
> the live catalog (all reproduced; census table in the review). ⚠ **The r2 APPROVED is the S6
> SLICE verdict only.**
>
> **Gate step 2 — ✅ GREEN 2026-08-17** (second full `e2e:prod`, `REBUILD=1`, after the fix):
> **1121 passed · 0 failed · 0 infra · 2 flaky · 6 skipped · 0 did-not-run · 18 batches**, the parts
> summing to exactly **1129 collected** — reconciled **per batch** (`accounted N/N`, `0 did-not-run`
> in all 18), so **no unrun tests**; the [[gate-summary-can-hide-unrun-tests]] shape was looked for and
> is absent. **Batch 4 = 64 passed / 0 failed** (was 63/1) and `ok 13 … dm5-nsp-evidence.spec.ts:388:5
> › EVID-KBD-1`. The **2 flaky are exactly the two remaining `FUP-E2E-REPEAT-FLAKY` members**
> (`act-role-assumption:157`, `phase2-auth-shell:268`) — EVID-KBD-1 is **not** among them, so it did
> not merely degrade from failed to flaky. 3 INFRA re-runs, final **0 infra**.
>
> ⛔ **The FIRST full run was RED, and that is kept rather than overwritten** — 1120p / **1f** /
> 2 flaky / 0 did-not-run, failing on **BUG-DM5-S6-EVID-KBD-1** (Bug Log, now ⬛ closed with its root
> cause). It was characterised over 4 runs at `RETRIES=0` — reproducible **2/2** at batch-4
> composition, green alone (8/8) and paired (18/18) — which is what proved it a real
> composition-dependent defect rather than the flake it was filed as. **Not an S6 regression:** 0
> `src/` files and 0 migrations separated that red run from the preceding green one.
> ⚠⚠ **Two traps from this step, both worth keeping.** (1) **The harness exit code lied**: the
> background job reported **exit 0** because the invocation ended in an `echo`, while the gate printed
> **GATE RED** with `E2E_PROD_EXIT=1` — *read the gate's own verdict, never the wrapper's status.*
> (2) **A line-keyed grep went stale mid-slice**: the fix moved the test `:347` → `:388`, so searching
> `:347` in the green log returns **nothing**, which reads exactly like *"the test did not run."*
>
> ⛔ **Step 4 OWED; DM5's PHASE QA not run** — and
> S3/S4/S5/**S6** verdicts are SLICE verdicts authorizing no part of it. 🔒 **The UNREHEARSED runbook still
> binds and S6 may not close over it.** 🔴 The supersede-serving collision is **deferred, not
> closed**. **ADR 0120 D9's Cloud question was PO-deferred "to when S6 reaches it" — S6 has now
> reached it: it MUST be put to the PO at step 4** (with ADR 0114 O1/O2/O4, S1-O3, FUP-DM5-D11,
> and the two new QA hand-offs: F6's per-slice-sections ownership question and F3's unmeasured
> `active`+`deleted_at` corner).
>
> ### ✅ FOLLOW-UP BATCH — gate GREEN, PO-approved 2026-08-17 (`fd69d4be`) — **added here 2026-08-17; the section had no record of it at all**
>
> ⛔ **This block is the section's own headline defect, caught one more time.** 22 commits
> (`c9c0fb3a`…`fd69d4be`) landed a follow-up batch, a full gate ran GREEN, and the PO approved it —
> while every marker in this section still read *"S5 ⏸ NOT CLOSED: step 2 PO-DEFERRED, step 4 owed."*
> The warning six lines below, added the same day, says **a marker moves while the status line does
> not**; it was written and then immediately re-earned. → [[progress-md-record-step-rotation-is-chronically-skipped]].
>
> **Gate at `4f16ea5f`** — ✅ **still valid at HEAD `fd69d4be`: the only commits after it are
> docs-only** (`git diff --name-only 4f16ea5f..HEAD` = `PROGRESS.md` + 2 `docs/` files, verified, not assumed).
>
> | step | figure |
> |---|---|
> | 1 — build | registry **412 == 412** · pgTAP **194 files / 6392 PASS** (fresh reset) · lint **5/5** · tsc **0** · vitest **89 files / 1304** |
> | 1 — authz, **named by ARM, never by script** | `ARM=census` *has anything ever asked?* **546 live / 570 verdicts** · `ARM=hat` *does a door read `memberships` without the caller's hat?* **3, all reasoned-allowlisted** · `ARM=floor` *is every door called?* **74 never-called, all allowlisted, every entry resolves** · `FROMFINDINGS=1 ARM=wrapper` **BLIND 41 ⊆ allowlist** |
> | 1 — diff-scoped `ARM=policy` | **NOT APPLICABLE — argued and MEASURED, never "clean"**: policies **274** unchanged, no migration in the diff contains a policy statement |
> | 2 — `e2e:prod` | ✅ **GATE GREEN: 1118 passed · 0 failed · 0 did-not-run · 5 flaky · 6 skipped · 18 batches** |
> | 3 — QA | ⛔ **NOT RUN** |
> | 4 — PO | ✅ **APPROVED**, with the step-3 deviation stated *before* the approval and accepted |
> | 5 — record | ✅ `docs/backend-state.md` updated (the backend surface **did** change) |
>
> ⭐ **The coverage line read `1123 of 1129` and was CHECKED, not accepted** — all 18 batches reconcile
> `accounted N/N` and sum to 1129; the 6 are skips, which the pass/fail/flaky tally excludes. **No
> unrun tests**; the [[gate-summary-can-hide-unrun-tests]] shape was looked for and is absent.
> ⚠ **4 INFRA re-runs, one a NEW shape worth the name: batch 8 crashed with exit 127 and no summary
> at all — 40 tests unrun.** Exit 127 is *command not found*, not a test failure; re-run to 40/40.
>
> **Closed by the batch:** ⬛ FUP-DM4-RECUSAL (ADR 0122) · ⬛ FUP-DM5-FINALIZE-ATOMIC · ⬛
> FUP-DM5-330-WRITE-BLIND · ⬛ FUP-DM5-GRANTS · ⬛ FUP-AUTHZ-ALLOWLIST-ROT · ⬛ FUP-DM5-MANIFEST-FLAG ·
> ⬛ FUP-DM5-DEAD-CORE-PROJECTION · ⬛ FUP-DM5-342-PLAN-COMMENT. **Reverted:** the D11 inflow
> (`5b40d62b`). **Two new findings:** 🔴 **FUP-DM5-SUPERSEDE-SERVING-COLLISION** · 🟠
> **FUP-AUTHZ-COMMAND-DOOR-UNSWEPT**.
>
> ⚠ **`ARM=census` PASSED while a brand-new DEFINER door was absent from the findings file.** Its
> DEFINER clause is bounded to **`bool`** returns and `complete_evidence_upload_verification` returns
> **`jsonb`**, so the door was in no arm's domain — the *door sweep's* domain includes exactly that
> shape. Coverage gap, **not** a vulnerability (service_role-only; `341` J7 pins it). This is
> [[enumeration-boundary-is-a-syntax-not-a-property]] again, and it is why the gate row above names
> the ARM's **question** rather than the script.
>
> ✅ **THE ONE THING THE BATCH LEFT UNSETTLED — ASKED AND RULED 2026-08-17.** The PO ruled the
> follow-ups be grouped into **one** gate *riding S5's already-owed `e2e:prod`*, so S5's step 2 is
> discharged by the run above; but the step-4 approval was recorded against **the batch**
> (`phase(DM5-followups): complete`) and said nothing about S5. Put to the PO rather than assumed in
> either direction — **ruling: the batch's approval closes S5 as well.** S5 is therefore **COMPLETE,
> all five gate steps** (1 ✅ · 2 ✅ · 3 ✅ r2 · 4 ✅ · 5 ✅).
> ⭐ *Worth keeping as method: the ambiguity was invisible from either document alone — the batch
> record was complete about the batch and silent about what else the approval reached. **An approval's
> SCOPE is a fact about the approval, and it has to be written down like any other.***
>
> ### ✅ S5 CLOSED 2026-08-17 — operational closure — all five gate steps, QA **APPROVED (r2)**
>
> **Gate: step 1 ✅ · step 2 ✅** (discharged by the follow-up batch's shared `e2e:prod`, which the PO
> ruled would ride S5's owed run) **· step 3 ✅ APPROVED (r2) · step 4 ✅ PO-RULED 2026-08-17** — the
> batch's approval closes S5 too (asked, not assumed; see the ✅ note at the end of the batch block).
> ⚠ **A SLICE closure — DM5's PHASE QA is still owed at S6**, and S5's r2 authorizes no part of it.
>
> **Delivered:** **S5.R** byte-path rehearsal · **S5.D** disposal runbook
> (`docs/deployment/phi-disposal-runbook.md`; owner = **the PO**, executor = whoever holds
> service-role reach, **monthly + out-of-band on a data-subject request**) with the gap pinned on
> **both** sides (`343` + `disposal-gap.test.ts`, both observed RED) · backup/restore drill of DB +
> Storage together · EXPLAIN baselines. Full record →
> **[dm5-s5-operational-closure.md](docs/progress/dm5-s5-operational-closure.md)**; QA r2 review
> `docs/reviews/dm5-s5-review-r2.md`.
>
> 🔒 **Two gaps were adopted as BINDING — ⭕ 2026-08-17 (pre-S6) ONE IS DISCHARGED, ONE STILL BINDS:**
> ⬛ **P4 `open_document_version` — MEASURED 2026-08-17**, by *meeting* the prerequisite rather than
> fabricating the row the write path refused: the real `begin → finalize → complete_verification`
> corridor, then EXPLAIN in a rolled-back transaction. **8.2 ms cold · 3.8–4.0 ms warm · 121 buffers
> warm**, single-row at stated N, no residue. The original ruling (*a fabricated baseline is worse
> than a missing one*) is what made this close cleanly. ⚠ **Baseline only — NO volume arm**, so
> nothing here says how it scales. · 🔒 **The runbook sequence is UNREHEARSED — STILL BINDING, S6
> may NOT close over it.** *Naming an owner is not a rehearsal, and writing a runbook is not running
> it* — it needs the PO (its owner) plus service-role reach, so it was never the lead's to discharge.
> ⛔ **20 NOT-COVERED items** (⭕ **not 13 — recounted at the phase QA 2026-08-17; the "13" was right
> when written, never updated as r2 residuals were appended, and the appends landed out of numeric
> order so the tail does not look like a tail**) are enumerated in the record under its binding heading — **read them
> before S6**, because a close that omits them reads as completeness.
>
> ⭐ **The three findings worth more than the slice**, kept here because they are cross-phase and the
> record is where the detail lives: a **restore onto a bare Postgres reported SUCCESS while losing 67%
> of RLS** (psql exit 0 · 490 true errors · **90 of 274 policies** — two false signals aligned, and
> only a *catalog comparison* exposed it) · **a Storage backup IS a PHI export** (68 PHI-tier files in
> plaintext) · and **`capture` called a destroyed-bytes bucket CLEAN**, non-monotonically — partial
> byte loss dirty, **total** byte loss clean.
>
> ### ✅ S4 CLOSED 2026-08-17 — legacy bucket retirement — all five gate steps, QA **APPROVED (r3)**
>
> QA r1 ⛔ → r2 ⛔ → **r3 ✅** (0 P0 · 0 MAJOR); PO approved the slice on the day. ⚠ **A SLICE verdict —
> DM5's phase QA is still owed at S6, and it authorizes no part of S5.** Built: migration
> **`20260927000400`** (drops the last 4 retirement-bucket policies + the 8 bucket rows, behind a
> guard that **refuses** to retire a bucket still holding `storage.objects` rows — D9's byte-first
> ordering encoded executably) · pgTAP **`325`** 5 → 8. Survivors: `documents-standard`/`documents-phi`
> + `form-assets`/`meeting-audio`. Detail → **[the DM5 record](docs/progress/dm5-wave-d-retirement.md)
> § S4**; reviews [r3](docs/reviews/dm5-s4-review-r3.md) · [r2](docs/reviews/dm5-s4-review-r2.md) ·
> [r1](docs/reviews/dm5-s4-review.md).
>
> ⛔ **THE BYTE HALF WAS A NO-OP, AND IS RECORDED AS THAT — NOT AS "RETIREMENT PROVEN".** Every
> retirement-bucket byte was already an orphan with no metadata row, so the Storage API — the D9
> *gate* — could not address one of them; `delete --execute` never ran. What S4 closed is the
> metadata/schema half. ⛔ **Not relieved by the approval: Cloud is UNVERIFIED in all three rounds,
> and the deploy-time byte path is UNREHEARSED.**
>
> ⭐⭐ **The lesson that outlived the slice: broken assertions fail in OPPOSITE directions and only one
> direction announces itself.** A reference sweep bounded by one property missed a breakage living in
> another; pgTAP then returned 4 reds — but **two Rule 6 *"NO update/delete policy"* pins went
> VACUOUS**, satisfied forever by zero policies, sitting in the passing column of a green suite.
> **Fixing only what the suite reports would have left two dead pins reading as coverage.**
> → [[removing-a-subject-breaks-its-assertions-in-two-directions]]
>
> ### ✅ S3 CLOSED 2026-08-14 — printed renditions onto the substrate — all four gate steps, QA **APPROVED (r2)**
>
> QA r1 ⛔ (2 MAJOR blocking) → **r2 ✅** (`801a2589`, [review](docs/reviews/dm5-s3-review.md)) — **every
> blocking item re-proved by neutralization, not read.** Safety: 8 mutation-bearing runs, every one a
> rolled-back transaction, degenerate bodies **0** after each. ⛔ **A slice verdict, not the phase
> gate.** Detail → **[the DM5 record](docs/progress/dm5-wave-d-retirement.md) § S3**.
>
> ⭐ **The corridor EXECUTES — the one thing no static gate could say.** `pdf-printing` **9/9** and
> `pdf-printing-meetings` **6/6**: real `%PDF-` bytes, mint → download → public verify → revoke →
> overlay → re-verify. **S2 passed every static gate while its feature did not work at all.**
> ⚠ Requires the **Gotenberg sidecar** (`docker start gotenberg-pdf`, `/health` 200 on :3010) **and
> `--workers=1`** — without it the corridor specs fail as uniform login errors that read as product
> defects. → [[print-corridor-needs-a-sidecar-no-gate-starts]]
>
> ### 📌 Open follow-ups — refreshed 2026-08-17, **this list is the live one**
>
> Full text + why each matters: **[follow-ups.md](docs/progress/follow-ups.md)**; prioritised order
> with reasoning: **[handoff §13.2](docs/progress/dm5-handoff.md)**.
>
> **🔴** **FUP-DM5-SUPERSEDE-SERVING-COLLISION** — ⏸ **PO RULED 2026-08-17: decide later, the D11 inflow
> STAYS REVERTED.** Both options declined for now (widen `app.resolve_document_version_bytes` for
> `superseded`, or reinterpret ADR 0121 D3/D5). ⛔ **A deferral is not a closure: the item stays 🔴, S6
> may NOT close over it, and D11 cannot be rebuilt until it is decided.** ⚠ **`FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES`
> is this same deferral from the other side** — not independent work. The reverted state is coherent
> (no inflow without outflow, no unservable prints); *a narrowing can be wrong and safe, a widening
> cannot* ·
> **FUP-DM5-NO-ANSWER-VS-NOTHING** (a **CLASS**, 6 instances; *an observable proxy substituted for the
> property that matters, always failing in the reassuring direction* — instances 4, 5 and 6 were each
> found **inside the fix for an earlier one**) · **FUP-DM5-BACKUP-IS-PHI-EXPORT** ·
> **FUP-PGTAP-VACUOUS** (`lint:vacuous` scans TS only; ~6000 pgTAP assertions unscanned, live specimen
> found) · **FUP-AUTHZ-HARNESS-TRANSACTIONAL** (⛔ **read the record's incident section before running
> ANY mutation harness** — a live authz gate was left OPEN on the shared stack).
>
> **🟠** **FUP-DM5-DISPOSAL-JOB** (**the job does not exist**; blocking pre-pilot; ADR 0121 **D2**'s
> obvious design does not work — the Storage API is unreachable from SQL, so a pure-SQL `pg_cron` job
> automates only the half that was never the gap) · **FUP-DM5-CLOUD-ORPHAN-SURFACE** +
> **FUP-DM5-D9-NO-ARM-SEES-A-BYTE-POST-RETIREMENT** (the pair deciding whether the deploy path can be
> certified at all; **the S3 endpoint is UNPROBED and probing it is the single measurement that could
> change this**) · **FUP-AUTHZ-COMMAND-DOOR-UNSWEPT** (⭕ **RE-SCOPED 2026-08-17 pre-S6 — its filed
> premise was FALSE and the finding is bigger than filed.** No jsonb/void command door carries a
> verdict *anywhere*: the two names cited as proof of a "wider door-sweep domain" occur only in
> **prose**, which `verdicts_from_findings` — a **table-row** scraper — never reads. Measured:
> **407** reachable non-trigger command doors sit outside **every** arm's domain, **326** of them
> RPC-callable. ⭐ **A 3-door neutralization sample found all three COVERED**, so the class is
> **covered-but-UNPINNED, not blind** — the coverage is real, nothing records it, so nothing
> notices if it regresses and a NEW door in the class passes by absence. `ARM=census`'s printed
> claim was narrowed to its true domain. **Sizing the 407-door triage is a PO decision**; ⛔ the
> 3-door sample may NOT be used to close it) · FUP-DM5-STACK-CYCLE-DESTROYS-BYTES (mechanism still undetermined) · FUP-DM5-STORAGE-ORPHANS
> (**Cloud half only** — local closed *empty by measurement*) · FUP-DM5-SETLOCAL-MIGRATION (⛔ in-place
> fix **blocked**, the files are remote-applied; remaining remedy = a lint gate = **a PO decision**) ·
> FUP-DM5-SIBLING-GUARD-DIFF · FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES (**superseded by** the collision
> above).
>
> **🟡** FUP-ACL-APP-POPULATION (re-scoped: assertion **built**, the 237-function triage remains) ·
> FUP-DM5-DVF-FILEOBJ (latency rests on **caller discipline, not the schema** — nothing makes
> `file_object_id` unique) · FUP-DM5-DANGLING-PRINT-ON-DELETED-DRAFT · FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN
> (fail-open half fixed; arm still a no-op pending a **NAMED** successor) · FUP-PGTAP-WORKER-DEADLOCK ·
> FUP-DM4-PRODROW (deferred to deploy).
>
> **PO decisions owed, easy to lose:** ADR 0114 **O1** (retention values) · **O2** (scanner +
> `unscanned_accepted` expiry) · **O4** (signed-URL TTL) · **S1-O3** (uploader visibility) ·
> **FUP-DM5-D11** ("decide later") · and whether **ADR 0120 D9** needs a Cloud-verification amendment
> (open in the ADR, for S6). ⛔ **None of these may be invented by an implementer.**
>
> ↩ **S5 / S4 / S3 narrative detail rotated 2026-08-17** (§6 step 5) → **[the DM5 record](docs/progress/dm5-wave-d-retirement.md)
> § "Rotated from PROGRESS.md 2026-08-17"**, appended and **`cmp`-verified byte-for-byte before the
> cut** (371 lines) — ⚠ **then one mechanical transform applied after that check: relative links
> `](docs/…)` → `](../…)`, because a root-relative link 404s from `docs/progress/`. Prose verbatim,
> link targets repointed.** ⚠ **An `APPROVED` slice is not an absence of gaps** — rotation *moved* the
> open lists, it did not settle them.
>
> ### ⛔⛔ State — **THIS BLOCK WAS FALSE IN BOTH HALVES UNTIL 2026-08-17. Re-measured; do not restore the old wording.**
>
> _(It read: **"branch `main`, NOT pushed, no `db push`."** Both halves were wrong, and it sat in the
> line a new session reads to decide whether the remote is safe to touch. →
> [[a-records-claim-about-an-external-system-goes-stale-silently]].)_
>
> | fact | measured 2026-08-17 | how |
> |---|---|---|
> | branch | `main`, tree clean | `git status` |
> | pushed? | ✅ **YES** — `origin/main` = `23b1d9cf`, itself a DM5·S5 commit. HEAD `fd69d4be` is **33 ahead** | `git rev-list --left-right --count origin/main...HEAD` |
> | `db push`? | ✅ **DONE through `20260927000360`** ⇒ **DM1–DM5·S3 are LIVE ON THE REMOTE** | `supabase migration list --linked` |
> | local-only migrations | **FIVE**: `20260927000400` (S4 retirement) · `20260928000100` (recusal) · `20260928000200` (evidence revoke) · `20260928000400` (D4 contract) · `20260928000500` (finalize-atomic). ⚠ `…0928000300` **does not exist** — reverted D11 inflow (`5b40d62b`) | same |
> | DM flags, local | all six **ON** — `documents_foundation`/`wave_a`/`b`/`c`/`d` + `document_printing` | `select key, enabled from app.feature_flags` |
> | DM flags, shipped | **OFF** — the local ONs come from `seed.sql`, which `db push` never applies; remote measured all-OFF 2026-08-17 | remote read |
>
> ⛔ **Two consequences that outrank everything else in this section.**
> 1. **Applied migrations may NOT be edited in place** — that is the drift that blocks `db push`. The
>    five local-only ones above *are* still editable; nothing at or below `…0927000360` is.
> 2. **The recusal fix is NOT on the remote.** `FUP-DM4-RECUSAL` is ⬛ closed against the *local*
>    catalog only, so the recused-coordinator PHI path is **still open remotely** until `db push`.
>
> ⚠ **"Flags ship OFF" is NOT a security boundary and must stop being cited as one.** Measured: **51
> of 52** document functions and **ZERO** RLS policies read a flag — it is an **app-layer** gate. The
> load-bearing reason the remote is safe today is that **it holds no data and no users** (0 orgs / 0
> profiles / 0 commissions / 0 cases) — a stronger reason, and one that **expires the moment the pilot
> loads data**. graphify ✅ `02cec1a0`.

### ⬛ Closed work — DM4 · DM3 · DM2 · the "Recently completed" index · ad-hoc completed work

> ↩ **All five blocks rotated 2026-08-17** (§6 step 5) → **[phase-status-archive.md](docs/progress/phase-status-archive.md)
> § "Rotated from PROGRESS.md 2026-08-17"**, preserved **verbatim before the cut** (85 lines,
> `cmp`-verified). § Current Phase Tasks is for the **current** phase; every one of these is closed
> and has its own record.
>
> **Where each lives now** — the Phase Status table above keeps a row for each, forever:
> **DM4** (Wave C, referrals) → [dm4-referrals.md](docs/progress/dm4-referrals.md) ·
> **DM3** (Wave B, controlled documents) → [dm3-controlled-documents.md](docs/progress/dm3-controlled-documents.md) ·
> **DM2** (orchestration + Wave A) → [dm2-orchestration-wave-a.md](docs/progress/dm2-orchestration-wave-a.md) ·
> **REG·KIND / RDR / ETH·E4 / ACT / PDF·P1+P2 / QO·A+B / MIN / AFF / PCI+TV** and the ad-hoc items →
> their `docs/progress/*.md` records, linked from the archive block and from the Phase Status rows.
>
> ⚠ **Two DM3 findings that are NOT superseded and must not be re-learned** — kept here rather than
> rotated, because both describe how a *green gate* can be wrong: the M1 **backfill that masked a
> broken CREATE path** (every create raised `23503` for a whole phase, invisible to every incremental
> run — **only the mandatory fresh reset saw it**), and the flag that **gated the last step of a
> corridor instead of the corridor** (flag OFF still PUT real bytes).
> ⚠ **Ethics letters home on the `case` securable resource, NEVER `controlled_document`** — else
> `HC0D6` refuses the enforcing label and the D15 ceiling silently vanishes.
>
> ⚠ **Open items from closed work do NOT close with the work.** Still live, and tracked in
> § Follow-ups rather than in the rotated cells: **BUG-QOB-004** · **FUP-QOB-1/2** ·
> **BUG-BOOTSTRAP-001** · **FUP-QO-6/9** · **FUP-PDF-2..4** · **FUP-MIN-CUTOVER** ·
> **FUP-AFF-1…4** · **FUP-PCITV-1** · **FUP-ETH-A11Y-1** · **FUP-ETH-ROLES-1** ·
> **FUP-E2E-SERVER-DEAD-1** · **FUP-ACT-DISPOSE-UI** · **FUP-ACT-CAPA-ASSIGN** ·
> **FUP-ACT-HATLESS-AUDIT**.
> ⛔ **REG·KIND shipped with NO tester pass and NO QA review** (steps 2–4 unrun by PO direction) and
> **AUDIT-INVOKER-WRAPPER was never QA-reviewed** — neither gap is closed by rotation.

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

**1. 🔴 PILOT-GATE CHECK — DM5 exits with a KNOWN, runbook-mitigated PHI-DISPOSAL GAP, and it must be
carried here, not only in the phase record.** ⭕ **Added 2026-08-17 at the DM5 phase QA (R4): the DM5
plan (S5.D.4) required this to appear "in S6's canon sweep AND in the pilot gate, never only here",
and it was absent from both.** This section read *"All complete … What is actually left:"* followed by
a single item, so two PHI-tier obligations were invisible at exactly the place a pilot decision is made.

- 🟠 **FUP-DM5-DISPOSAL-JOB — nothing completes a disposal automatically.** `complete_document_disposal`
  exists but its only production caller is `reclassifyDocument`; **the job does not exist.** Filed by
  the plan (S5.D.3) as *"a 🔴 BLOCKING pre-pilot follow-up — not a nice-to-have."* A
  `disposal_pending` row that never completes means **bytes that should have been destroyed still
  exist** — ⭐ which is why ADR 0099 **D10**'s rationale (*"a stale row nobody looks at harms nobody"*)
  **inverts for PHI**, and overturning D10 needs its own ADR. ⚠ D2's obvious design does not work: the
  Storage API is unreachable from SQL, so a pure-SQL `pg_cron` job automates only the half that was
  never the gap.
- 🔴 **FUP-DM5-BACKUP-IS-PHI-EXPORT** — the runbook's backup half produces **68 PHI-tier files**
  (Rule 12 / LGPD). The PO-decided values are in the runbook; what remains is the per-machine
  destination path.
- 🔒 **The runbook sequence is UNREHEARSED** — a binding DM5 gap, still open. *Naming an owner is not
  a rehearsal, and writing a runbook is not running it.*

**Decision owner: PO** — whether the pilot may proceed over a manual-only disposal path is a risk
acceptance, not an engineering call. Detail → [S5 record](docs/progress/dm5-s5-operational-closure.md)
§ 6 (**20** NOT-COVERED items) + the [disposal runbook](docs/deployment/phi-disposal-runbook.md).

---

## Bug Log

<!-- OPEN bugs only. Resolved/closed rows rotate to docs/progress/bug-log-archive.md (or the
     owning phase's record) at each §6 Record step. -->

### 🔴 OPEN — the live bugs

**⬛ BUG-DM5-S6-EVID-KBD-1 — ✅ FIXED + VERIFIED GREEN 2026-08-17** (filed and closed the same day,
S6 gate step 2; `tester`) — *it was never a flake; the readiness helper was lying one layer above the test*

> **Root cause — a readiness check that could not distinguish the skeleton from the page.**
> `expectRcaWorkspaceRendered` / `expectCapaWorkspaceRendered` (local to the spec) treated
> `getByRole('main')` as proof the workspace had rendered. But `<main>` is rendered by the
> **ancestor layout** ([`nsp/layout.tsx:108`](src/app/o/[org]/nsp/layout.tsx)), which **persists
> across the `loading.tsx` → `page.tsx` Suspense swap** — so it is already visible while the route
> still shows bare `<Skeleton>` placeholders with almost nothing focusable. `focusByTabbing` has
> **no auto-retry** (it is a fixed count of blind Tab presses), so it began counting against a
> skeleton and exhausted its budget. Every *other* caller in the file is mouse-driven and was
> immune, because `.click()` auto-retries until its target is actionable — which is why exactly one
> keyboard-only test was ever hit.
> ⭐ **This explains all four measurements**: the race is lost only when the data fetch is still
> pending, so it is load-dependent, not random — green alone, green paired, red once four more files
> shared the run. The spec's own comment already warned *"never `.focus()` — races RSC streaming"*;
> the identical race sat one layer up, inside the check that decides when it is safe to start.
> → [[playwright-focus-is-not-auto-waiting]]
>
> **Fix** (`e2e/dm5-nsp-evidence.spec.ts` only — `e2e/helpers/documents.ts` has **zero** net diff):
> both helpers now also wait for the evidence panel's own heading — a signal the skeleton cannot
> produce — raced via `.or()` against the existing error boundary so a genuine stub regression still
> fails fast with its specific message instead of a generic timeout.
> ⛔ **It strengthens a PRECONDITION; it does not weaken an assertion.** `focusByTabbing`, the tab
> budget, and the keyboard-reachability contract are untouched. **Measured before changing anything:
> real tab counts were 34 / 1 / 2 / 36 against a budget of 60** — so "the budget was too tight" was
> *excluded by measurement*, not assumed, and the budget was deliberately not raised. The CAPA twin
> got the same fix: identical mechanism, no keyboard test yet to expose it, and leaving it is a
> landmine for whoever writes one.
>
> **Verified — lead-run, not accepted from the report.** Diff inspected (one file); the three
> structural claims re-checked independently (`<main>` is in the layout; both `loading.tsx`
> boundaries exist; the skeleton renders **no** `<main>` of its own); the **five-gate** `npm run
> lint` run — the tester had only run `npx eslint` + `tsc`, and *that exact gap has produced a false
> green in this project before*. Then the full `e2e:prod`: **GATE GREEN**, batch 4 **64 passed / 0
> failed** (was 63/1), `ok 13 … dm5-nsp-evidence.spec.ts:388:5 › EVID-KBD-1`.
> ⚠ **The test moved `:347` → `:388`** (the fix added helper lines above it), so a line-keyed grep
> for `:347` returns nothing — which reads exactly like *"the test did not run."*
>
> **`FUP-E2E-REPEAT-FLAKY`: EVID-KBD-1 is REMOVED** — it has an identified, fixed root cause, not an
> unexplained flake. The other two members remain, and this run's 2 flaky are exactly those two
> (`act-role-assumption:157`, `phase2-auth-shell:268`), so EVID-KBD-1 did not merely degrade from
> failed to flaky. ⭐ **New lead, explicitly unverified:** `phase2-auth-shell.spec.ts` calls a bare
> `.focus()` shortly after a navigation — the same anti-pattern, and `:268` is one of the two
> survivors. Possibly the same root cause; **not investigated, offered as a lead, not a finding.**

- **Spec:** `e2e/dm5-nsp-evidence.spec.ts:347` — *"EVID-KBD-1: keyboard-only — Tab to «Enviar
  arquivo», fill the dialog by keyboard, submit with Enter, and Tab+Enter to open the result"*.
  Failure: `keyboard: target element was never focused within the tab budget`
  (`focusByTabbing`, spec `:293`), then the follow-on `toBeVisible` at `:409`.
- **The S6 gate run went RED on this one test:** 1120 passed · **1 failed** · 2 flaky · 6 skipped ·
  **0 did-not-run** · 18 batches. It failed **through** its retry (`RETRIES=1`).
- ⭐ **Why the existing label must not be reused.** `EVID-KBD-1` is a recorded member of
  `FUP-E2E-REPEAT-FLAKY`, added at S3's gate and flaky again at S4's — **both times it passed on
  retry.** It no longer does. *A test that used to be rescued by a retry and now is not has changed
  behaviour, and "known flaky" would file that change as nothing.*
- **Measured, 4 runs, `RETRIES=0` throughout — it is composition-dependent, not random:**

  | run | specs | tests | result |
  |---|---|---|---|
  | alone | `dm5-nsp-evidence` | 8 | ✅ 8 passed |
  | pair | `dm4-referral-documents` + `dm5-nsp-evidence` | 18 | ✅ 18 passed |
  | **batch-4 composition** | the gate's actual 6 | 65 | ⛔ **63 passed, 1 failed** |
  | **batch-4 composition, again** | same 6 | 65 | ⛔ **63 passed, 1 failed** |

- **Not an S6 regression, and that is measured, not assumed:** the last green run and this red one
  are separated by **0 `src/` files and 0 migrations** (S6 and the QA commit are both docs-only).
  Something in *batch composition*, not in the product, moved it over the line.
- **Leads for whoever takes it** (none verified — offered as starting points, not conclusions):
  `playwright.config.ts` sets **`fullyParallel: true`**, so scheduling is not strictly file-bound;
  and the preceding spec's `DM4-TTL-1` **sleeps ~2.1 min by design** (it proves byte doors survive a
  delay that would expire a render-time credential), which is the kind of thing a tab budget or a
  cached session can be sensitive to. Shape matches the standing
  [[playwright-focus-is-not-auto-waiting]] class — *reads like a11y, is timing.*
- ⛔ **S6 gate step 2 is RED until this is resolved.** Do not re-declare green on the isolated
  8/8 pass: it does not reproduce the failing condition.

⚠ **Heading added 2026-08-14** (and re-titled 2026-08-17 when a fourth bug landed — *the count was in
the heading, which is a figure that goes stale the moment it is right*). These sat between two
"Closed" headings with no heading of their
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
| 2026-08-17 | **DM5 S6 · LEAD · `npm run e2e:prod`** (`REBUILD=1`) — the DECLARING-GREEN run, after the EVID-KBD-1 fix. ⭕ **Added at the phase QA (R5): this table's rule is "most recent gate only" and BOTH 2026-08-17 gates were missing — including the run the phase QA itself rests on** | **GATE GREEN — 1121 passed · 0 failed · 0 infra · 2 flaky · 6 skipped · 0 did-not-run · 18 batches.** Parts sum to **1129 collected**, reconciled **per batch** (`accounted N/N`), so no unrun tests. Batch 4 = **64/0** (was 63/1). The 2 flaky are exactly the two remaining `FUP-E2E-REPEAT-FLAKY` members |
| 2026-08-17 | **DM5 S6 · LEAD · `npm run e2e:prod`** (`REBUILD=1`) — the FIRST full run, kept because it is why the fix exists | ⛔ **GATE RED — 1120 passed · 1 failed** · 2 flaky · 6 skipped · 0 did-not-run · 18 batches. Failure: **BUG-DM5-S6-EVID-KBD-1**, which **failed through its retry**; characterised over 4 runs at `RETRIES=0` as **composition-dependent (2/2), not the flake it was filed as**. ⚠ The harness reported **exit 0** while the gate printed **GATE RED** — *read the gate's verdict, never the wrapper's* |
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
| **DM5 — PHASE QA** (Wave D + retirement; ADRs [0114](docs/decisions/0114-document-model-redesign.md)+Amdt 1/2 · [0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md)/[0121](docs/decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md)/[0122](docs/decisions/0122-recusal-case-read-arm-at-the-referral-freeze-door.md)) — ⚠ **the PHASE verdict; S3/S4/S5/S6 slice verdicts authorize no part of it** | ✅ **APPROVED (r2)** — r1 ⛔ 0 P0 · 4 BLOCKING · 4 MINOR · 7 INFO, **all record defects, no code change requested** (the 7th such round); all 8 fixed same-day, **3 MINOR carried, none blocking**. ⚠ **Closes over NEITHER** 🔒 the unrehearsed runbook NOR 🔴 the supersede-serving collision. ⭐ **R1 is the S6 QA's own F1 defect recurring INSIDE F1's fix**: the flag census reproduces on neither catalog (**75/6** local, **74/6** remote vs *"52 / exactly one"*), carrying no query in the block that promises one — *correcting a claim's DIRECTION is not verifying its MAGNITUDE*. Build sound: retirement clean at every executing layer on a **wider** bound than S6 used; PHI unreachable at the **ACL** layer, not merely RLS | 2026-08-17 | [dm5-phase-review](docs/reviews/dm5-phase-review.md) |
| **DM5 · S6 — canon rewrite + program exit sweep** — ⚠ **SLICE review; superseded in scope by the PHASE QA above** | ✅ **APPROVED (r2)** — r1 ⛔ six findings, **all record defects**; the blocking pair were an END-STATE block that **INVERTED its source measurement** into three records at once, and a §2 `upload_state` (`active`) that **does not exist** in the CHECK — a state borrowed from `documents.status`, in the slice whose purpose was canon-vs-catalog fidelity. QA re-measured gate step 1 in full rather than arguing it unaffected | 2026-08-17 | [dm5-s6-review](docs/reviews/dm5-s6-review.md) |
| **DM5 · S5 — operational closure** — ⚠ **SLICE review; DM5 phase QA still owed at S6** | ✅ **APPROVED (r2)** — 0 P0 · 0 MAJOR · 6 MINOR · 6 INFO; r1's 2 MAJOR re-proved by neutralization. ⭐ **Both claims QA was asked to test HOLD, and the Cloud position is WORSE than r1 concluded**: the count comparison — the only control surviving on Cloud — **passed over a both-ways-diverged bucket and left a real byte behind** | 2026-08-17 | [r2](docs/reviews/dm5-s5-review-r2.md) · [r1](docs/reviews/dm5-s5-review.md) |
| **DM5 · S4 — legacy storage-bucket retirement** ([0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md) D8/D9) — ⚠ **SLICE review** | ✅ **APPROVED (r3)** — 0 P0 · 0 MAJOR · 4 MINOR · 3 INFO; r1 ⛔ → r2 ⛔ → r3 ✅, every blocking item a RECORD defect (no code change ever requested). ⛔ **Cloud UNVERIFIED in all three rounds; the deploy-time byte path UNREHEARSED** | 2026-08-17 | [r3](docs/reviews/dm5-s4-review-r3.md) · [r2](docs/reviews/dm5-s4-review-r2.md) · [r1](docs/reviews/dm5-s4-review.md) |
| **DM5 · S3 — printed renditions onto the core substrate** ([0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md) D1/D6/D7/D11/D12/D13/D17/D18) — ⚠ **SLICE review** | ✅ **APPROVED (r2)** — 0 P0 · 0 MAJOR · 1 MINOR · 3 INFO; r1's blockers each **re-proved by neutralization** (guard 4 deleted ⇒ `S3k2` RED / `S3f4` GREEN). ⚠ r1's MAJOR-2 premise was FALSE and the correction verified independently | 2026-08-14 | [dm5-s3-review](docs/reviews/dm5-s3-review.md) |
| _Full analysis of the three rows above_ — rotated **2026-08-17** → [qa-verdicts-archive.md](docs/progress/qa-verdicts-archive.md) § "Rotated from PROGRESS.md 2026-08-17", verbatim | – | – | – |
| **DM4 — Wave C: referrals** (ADR [0119](docs/decisions/0119-dm4-referral-document-substrate-decisions.md) D1–D10) — r1 ⛔ → r2 ✅ | ✅ **APPROVED (r2)** — 0 P0 · 0 MAJOR open · 8 MINOR carried · 2 new · 5 INFO. **No binding pre-merge condition.** ⚠ MAJOR-3 was **PO-deferred to Phase 19 as an ACCEPTED OPEN GAP, not resolved** → FUP-DM4-RECUSAL, whose deadline is the flag-on date | 2026-08-14 | [dm4-referrals](docs/reviews/dm4-referrals-review.md) |
| **DM3 — Wave B: controlled documents** (ADR 0114 Amdt 1 + **Amdt 2 / D17**) — r1 ⛔ → r2 ✅ | ✅ **APPROVED (r2)** — 0 P0 · 0 MAJOR · 3 MINOR carried · 6 INFO. **No binding pre-merge condition.** ⚠ `can_write_document`'s sweep verdict is **ERROR**-resolved-by-runlog and **must not later be cited as COVERED** | 2026-08-13 | [dm3-controlled-documents](docs/reviews/dm3-controlled-documents-review.md) |
| _Verbose form of the 5 rows above, incl. both struck r1 rounds_ — rotated 2026-08-14 (§5: never restate rationale here) | — | — | [archive](docs/progress/qa-verdicts-archive.md) |
| _Phase 0 → FUP batch 2026-08-12_ — **105 concluded rows** (81 rotated 2026-08-06 + 18 rotated 2026-08-10 + 6 rotated 2026-08-13: QO·B · PDF·P2 · PDF·P1 · QO·FUP · QO·A · MIN · AFF · PCI · TV · Phase 16, incl. struck loop rows) | — | — | [collapsed index](docs/progress/qa-verdicts-archive.md) |

## Decisions

<!-- One line per decision; full rationale in docs/decisions/ (ADR) + docs/progress/decisions-log.md -->

| Date | Decision | Ref |
| --- | --- | --- |
| 2026-08-17 | **DM5·S5 step 4 — the follow-up batch's PO approval CLOSES S5 TOO** (PO). Asked rather than assumed: the approval was recorded against `phase(DM5-followups)` and said nothing about S5, which had step 2 discharged by the same shared `e2e:prod`. ⭐ **An approval's SCOPE is a fact about the approval and has to be written down like any other.** S5 = COMPLETE, all five gate steps | PROGRESS.md § Current Phase Tasks |
| 2026-08-17 | **FUP-DM5-SUPERSEDE-SERVING-COLLISION — DECIDE LATER; the D11 inflow STAYS REVERTED** (PO). Both options declined for now: widening `app.resolve_document_version_bytes` to serve `disposal_pending` bytes whose reason is `superseded`, or reinterpreting ADR 0121 D3/D5. ⭐ *A narrowing can be wrong and safe; a widening cannot* — a PHI byte-serving gate is not widened unilaterally. ⛔ **A deferral is not a closure: the item stays 🔴, D11 cannot be rebuilt until decided, and S6 may not close over it** | ADR [0121](docs/decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md) Amdt 1 |
| 2026-08-17 | **FUP-DM4-RECUSAL — the Phase-19 deferral is OVERTURNED; close it now with a NARROWING arm** (PO). The deadline was always the `documents_wave_c` flag-on date, and **a plane that only WIDENS cannot close an under-inclusive gate** | ADR [0122](docs/decisions/0122-recusal-case-read-arm-at-the-referral-freeze-door.md) |
| 2026-08-17 | **ADR 0121 ACCEPTED — D2 (cron outflow) + D4 (what `disposed` asserts) ratified as proposed** (PO). D4 in its *record-what-was-verified* form, not the stronger *block-disposal-without-byte-proof* variant. ⚠ **Only D4 shipped**; D3/D5 built then reverted, D2 never built | ADR [0121](docs/decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md) |
| 2026-08-17 | **The PHI-disposal runbook's five open values SET** (PO): encryption **at creation** · location outside the repo **and** every sync root · reader set = the owner alone · retention until the next backup verifies good, **max 30 days** · destruction **key first**. ⭐ Short backup retention is a **SAFETY** property — the 20-yr duty belongs to the system of record, not to backups | `docs/deployment/phi-disposal-runbook.md` §6b |
| 2026-08-17 | **The local Storage volume is NON-DURABLE DISPOSABLE TEST RESIDUE** (PO) — no cleanup step, no gate, no local manifest discipline. Ratified as a **class**, not a number, because orphan accumulation is a standing byproduct of `db reset` | FUP-DM5-STORAGE-ORPHANS |
| 2026-08-17 | **Finish the PROGRESS.md rotation before opening DM5·S6** (PO) — the record pass takes priority over the phase's final slice | PROGRESS.md § Current Phase Tasks |
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

> ↩ **23 rows dated 2026-08-05 and older rotated 2026-08-17** → **[decisions-log.md](docs/progress/decisions-log.md)** § "Rotated from PROGRESS.md 2026-08-17", preserved verbatim before the cut (`cmp`-verified). This table is the **head** of the log, not the log.
| _pre-2026-07_ | **35 earlier decision rows (Phases 0–14, 2026-06-11 → 2026-06-25) rotated 2026-08-04** — one line each, plus the verbose form of every one. ⚠ The full pre-compaction form of the 32 rows above is archived there too (2026-08-14) | [decisions-log.md](docs/progress/decisions-log.md) |

## Follow-ups / Deferred Items

_Full bodies of OPEN items rotated 2026-08-08 → **[follow-ups.md](docs/progress/follow-ups.md)** — update BOTH (the body there, the line here) when an item changes state. Resolved items → [follow-ups-archive.md](docs/progress/follow-ups-archive.md). One line per item: severity · id · title · owner._

⚠ **Six lines below are NEW index entries, not new items** (2026-08-14): FUP-AUTHZ-HARNESS-TRANSACTIONAL ·
FUP-AUTHZ-ALLOWLIST-ROT · FUP-DM5-GRANTS · FUP-DM5-FINALIZE-ATOMIC · FUP-DM5-DVF-FILEOBJ ·
FUP-VACUOUS-COVERAGE-1 — each was OPEN but named **only** inside the DM5 phase section or a Bug Log
pointer, so compressing those would have dropped it from the index entirely.

⚠ **Two MORE lines added 2026-08-17 (phase QA R3), and the 2026-08-14 warning above was written and
then immediately re-earned — this time by the highest-severity item in the phase.** Both were
announced as new by the follow-up batch, given full bodies in `follow-ups.md`, and named repeatedly in
the phase narrative — **but neither ever got an index line**, so the next rotation would have dropped
them. ⭐ *A body plus a narrative mention is not an index entry; the index is what a reader greps.*

- 🟠 **FUP-DM5-BYTE-PROOF-NOT-ATTEMPTED** — `complete_document_disposal`'s `p_byte_proof` DEFAULTs to `'not_attempted'` and its **only** production caller (`reclassifyDocument`) omits it — **three lines after successfully deleting the bytes**. The one lane that can honestly claim a byte proof is the one that disclaims it, in the ADR 0121 D4 evidence a regulator reads. Errs conservatively, so no gate catches it. Nothing pins what any lane writes — backend
- 🟡 **FUP-DM5-ATTACHMENTS-MODULE-SURVIVED-RETIREMENT** — `src/lib/attachments/` survives the retirement phase with 6 dead `'use server'` exports whose comments say *"until DM2 retires it"*. Dead app code, **not** a live byte path (catalog clean: 0/0/0/0). ⭐ Invisible to the S6 exit sweep because that sweep is bounded by **identifier** — *"does anything still point at the retired thing?"* and *"is the thing that pointed at it gone?"* are different questions, and DM5 only asked the first — frontend + backend
- 🔴 **FUP-DM5-SUPERSEDE-SERVING-COLLISION** — marking a superseded print's bytes for disposal makes the print UNSERVABLE (`resolve_document_version_bytes` refuses on ANY non-`none` `disposal_state`); two ratified ADR 0121 decisions collide. ⏸ **PO-RULED 2026-08-17: decide later, the D11 inflow STAYS REVERTED.** ⛔ A deferral is not a closure — **D11 cannot be rebuilt until decided, and DM5·S6 may not close over it** — PO
- 🟠 **FUP-AUTHZ-COMMAND-DOOR-UNSWEPT** — `ARM=census`'s DEFINER clause is bounded to `bool`/set-returning, so **407** reachable non-trigger command doors (326 RPC-callable) sit outside **every** arm's domain. ⭕ Re-scoped 2026-08-17: a 3-door neutralization sample found all three **COVERED**, so the class is **covered-but-UNPINNED, not blind** — nothing records the coverage, so nothing notices if it regresses and a NEW door passes by absence. Sizing the 407-door triage is a **PO decision** — lead + backend
- 🔴 **FUP-ACT-DISPOSE-UI** — LGPD Art. 18 referral-erasure has no UI route (authorized ∩ reachable = ∅); **PILOT-GATE CHECK, item 0 above** — PO
- 🟠 **FUP-AUTHZ-HARNESS-TRANSACTIONAL** — the door-audit harness neutralizes OUTSIDE a transaction, so process death leaves an authz gate OPEN. ⚠ **PARTIALLY RESOLVED 2026-08-17 (`4102149b`); the filed remedy was WITHDRAWN as unbuildable** (a rolled-back txn is invisible to `run_suite` — a separate process — so every case would classify COVERED: 100% green, 100% vacuous). Shipped a degenerate-gate preflight instead; the guards *detect*, nothing *repairs*. ⛔ **Read the incident section before running ANY mutation harness** — lead/backend
- 🔴 **FUP-PGTAP-VACUOUS** — `lint:vacuous` scans TS specs only; ~6348 pgTAP assertions unscanned, live specimen in a PHI-boundary suite. The sweep must be **proven able to fail** first — lead/backend
- 🔴 **FUP-AFF-1** — the census is BLIND to write-path doors (ADR 0079 Am. 5); ⛔ cite `302`'s keystones, **never `ARM=census`** — backend/harness
- 🔴 **FUP-PCITV-1** — what QA APPROVED **over**, ranked: 5 open (TRUNCATE revoke residue · audit-mesh 2/7 arms · unexercised org-admin disjunct · resolver/GUC semantics · 10 bare `for select` policies) — unassigned
- 🔴 **FUP-ETH-ROLES-1** — no production bootstrap of `case_participant_roles`; the bundle lives only in `seed.sql` and `role_id` is NOT NULL, so a real org starts with zero roles and every participant type dead-ends. Decide before a second org onboards — product/backend
- ⬛ **FUP-QOB-3** — ✅ RESOLVED 2026-08-09 (PO): `dispose_event_phi` KEEPS its tenancy arm and referral disposal gets the same backstop back. ⚠ This line sat 🔴 OPEN for six days describing a gap already ruled — PO
- 🔴 **FUP-FF5-1** — patient-lane sublabel degenerate on the READ path (PO DEFERRED; resolve before the lane reaches a real committee) — backend
- 🟠 **FUP-DM5-STORAGE-ORPHANS** — a LOCAL reset wipes `storage.objects` but not the bytes. ✅ **Local half CLOSED empty by measurement 2026-08-17**; PO ratified the local volume as non-durable disposable test residue. ⭐ Survivor bytes are E2E/print artifacts, so local orphan accumulation is a **standing byproduct of `db reset`** — quote the mechanism, do **not** refresh the figure. **OPEN on the Cloud half only** — lead/backend
- 🟠 **FUP-DM5-STACK-CYCLE-DESTROYS-BYTES** — a `supabase stop`/`start` recovery destroyed 221 storage objects (**15 PHI-tier**) with no manifest, no count comparison, no audit — the event ADR 0120 D9 exists to prevent, inside the slice that ratified it. **D9 governs the deliberate path; the accidental one is ungoverned and silent.** Live question for Cloud (`db:reset:linked` + 20-yr LGPD/ANVISA) — lead/backend
- 🟠 **FUP-DM5-D9-NO-ARM-SEES-A-BYTE-POST-RETIREMENT** — once `…000400` applies, `capture` prints `CAPTURE CLEAN` and the **only** arm that can still see a surviving byte is the volume `walk`, which is `STORAGE_BACKEND=file` **local-only** ⇒ on Cloud, post-migration, the retirement tooling has **no** such arm. ⭐ And the migration's guard ("no `storage.objects` rows") is satisfied *perfectly* by an **orphaned** bucket — **it is real, and it is not a proof of emptiness.** Input to S5/S6 + the deploy runbook — backend
- 🔴 **FUP-DM5-NO-ANSWER-VS-NOTHING** — ⭐ **THE CLASS: an observable PROXY is substituted for the property that actually matters.** (⭕ This line printed the **withdrawn** headline *"an ACTION PERFORMED is recorded as the STATE ACHIEVED"* until 2026-08-17; QA showed it fits instances 3/4/5 but **not** 1/2 — *"I could not look"* is not an action performed — so the covering sentence was promoted in the body and *action → state* kept as a named sub-class. The index kept the retired headline, which is the version most readers see.) Every instance substitutes an observable proxy for the property that matters, and every one fails in the **reassuring** direction; 6 instances, and 4/5/6 were each found *inside the fix for an earlier one*. ⛔ **Instance 3 is why this is 🔴 and is PERSISTED, not just tool output:** `disposed` means "metadata absent, bytes unknown" — a false compliance assertion under LGPD/ANVISA/CFM 1821. On Cloud it is **unverifiable**, not merely unchecked — backend/lead
- 🔴 **FUP-DM5-BACKUP-IS-PHI-EXPORT** — a Storage backup is an unmanaged plaintext PHI export, and **the S5 drill created one** (245 files, **68 PHI-tier**, no RLS, no audited door, no TTL). The widest PHI egress path the system has. ✅ **All five values PO-SET in runbook §6b** (encryption AT CREATION · outside every sync root · owner-only · ≤30 days · key-first destruction). ⭐ Short backup retention is a **SAFETY** property — the 20-yr duty belongs to the system of record. ⚠ Remains **UNREHEARSED** — PO, then backend/lead
- 🟠 **FUP-DM5-CLOUD-ORPHAN-SURFACE** — UNSETTLED whether Cloud exposes **any** orphan-visible surface; the **S3-compatible endpoint is UNPROBED** and is the single measurement that would settle it. ⛔ **Blocks NO-ANSWER instance 3:** until settled, `disposed` cannot mean more than "metadata gone" on Cloud. Measured: with local proof off, an under-count delete **exits 0 while a real file survives** — 2 of D9's 4 controls lost, both byte-side — backend/lead
- 🟠 **FUP-DM5-DISPOSAL-JOB** — `disposal_pending` has **three inflow doors and zero automated outflow**; no `pg_cron`, no cron schema, single-process Dockerfile. PO ruled *document, do not build* → `docs/deployment/phi-disposal-runbook.md`; owner = the PO, executor = whoever holds service-role reach, **monthly + on a data-subject request**. ⚠ Real on paper; the sequence is **UNREHEARSED**. ⭐ **Composes with D11-SUPERSEDED and SUPERSEDE-SERVING-COLLISION — do not resolve any alone** — PO, then backend
- 🔵 **FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN** — ⚠ **HALF RESOLVED 2026-08-17 (`24cee179`)**: the fail-open half is fixed and proven; the arm is still a no-op pending a **NAMED** successor (deliberately not re-pointed — a successor must be named, not guessed). ⭐ *A guard written to announce "MUTATION NO-OP" failed OPEN into an error instead* — backend
- ⬛ **FUP-DM4-RECUSAL** — ✅ RESOLVED 2026-08-17 (`32054942`, `20260928000100`, ADR 0122): a `can_read_case` arm **above** the `p_kind` dispatch, covering both arms; `340` 76→82 red-first. ⚠⚠ **LOCAL ONLY — not on the remote, so the PHI path is still open there until `db push`** — lead/PO/backend
- 🟠 **FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES** — ⏸ **RE-RULED 2026-08-17: still DECIDE LATER, but the reason CHANGED.** ⛔ No longer "not yet built" — it **was** built (`6181557e`) and the build **failed the gate**, reverted `5b40d62b`: marking a superseded print `disposal_pending` made **every superseded print unservable**. The blocker is now a collision between two ratified ADRs (0121 D3/D5 vs 0120 D6/D8) at one value. ⭐ **Read with `FUP-DM5-SUPERSEDE-SERVING-COLLISION` (the decision) and `FUP-DM5-DISPOSAL-JOB` (the outflow) as ONE deferral — do not resolve any alone.** Original: D11 says superseded print bytes retire via `disposal_state`; measured, both stay `none` and nothing schedules it — PO, then backend
- ⬛ **FUP-DM5-342-PLAN-COMMENT** — ✅ RESOLVED 2026-08-17 (`24cee179`); ⭐ the itemisation **already summed to 59** — only the leading total was stale, so the comment disagreed with *itself* — backend
- 🟠 **FUP-DM5-SIBLING-GUARD-DIFF** — **no authz arm can see a door that OMITS a check its siblings all make**; all five test gates that *are* there. Specimen: BUG-DM5-S3-INACTIVE-PRINT-1. Wants a transitive catalog guard-set diff with a positive control — lead/backend
- ⬛ **FUP-DM5-330-WRITE-BLIND** — ✅ RESOLVED 2026-08-17 (`67cac33b`), `330` 57→62. ⭐ Closed **on its own terms**: blindness re-derived from the live catalog and still real — **not** closed on `342`'s coverage, as the item's warning forbade — backend
- ⬛ **FUP-DM5-FINALIZE-ATOMIC** — ✅ RESOLVED 2026-08-17 (`20260928000500`): bytes + evidence row commit in ONE transaction; `341` 57→67. ⭐ **The obvious keystone was VACUOUS** — one RPC call is one transaction, so any raise rolls back whatever the check order is — backend/lead
- 🟡 **FUP-DM5-DANGLING-PRINT-ON-DELETED-DRAFT** — a print minted from a **draft** outlives the deleted response: dangling `securable_resources` row, no UI surface, bytes persist — PO, then backend
- ⬛ **FUP-DM5-DEAD-CORE-PROJECTION** — ✅ RESOLVED 2026-08-17 (`24cee179`) by DELETION; verified at every **import site**, not by grepping the symbol — frontend/backend
- ⬛ **FUP-DM5-GRANTS** — ✅ CLOSED 2026-08-17 (`20260928000200`): direct write revoked, the RPCs are now the only writers; `341` 53→57. ⭐ **The fix would have made TWO P0 policies silently BLIND** — `252` now restores the grant in its own rolled-back txn to keep them mutation-proven — backend
- 🟡 **FUP-DM5-DVF-FILEOBJ** — ⚠ **RE-CHECKED 2026-08-17**: still latent, but latency rests on **CALLER DISCIPLINE, not the schema** — `document_version_files`'s only unique constraint is `(document_version_id, rendition_kind)`; **nothing makes `file_object_id` unique**, so byte-sharing across versions is structurally permitted. ⛔ Binding input to ADR 0121's disposal lifecycle — backend
- 🟡 **FUP-ACL-APP-POPULATION** — the DROP+CREATE → PUBLIC-EXECUTE mechanism has fired **3×**, and the **`app`** schema has no generic net (`100` t19 is `public`-bounded; `320`'s is an 8-name allowlist) — backend
- ⬛ **FUP-AUTHZ-ALLOWLIST-ROT** — ✅ RESOLVED 2026-08-17 (`4102149b`): `ARM=floor` now anti-joins every allowlist signature against `pg_proc`. **Red-first — it found SIX stale entries where this item named one** — lead/backend
- 🟡 **FUP-PGTAP-WORKER-DEADLOCK** — `test:db` intermittently deadlocks a `pg_prove` worker; **assurance, not correctness** (a dropped suite is not a passed suite). ⛔ Never pipe the run through `tail` — backend
- 🟡 **FUP-PGTAP-SAVEPOINT** — ⚠ **DOWNGRADED 🔴→🟡: the original claim was WRONG.** TAP output cannot be rolled back; real only in the degenerate all-assertions-inside case — lead
- 🟡 **FUP-ROTATION-BREAKS-LINKS** — **474 broken relative links across the four rotation destinations, measured 2026-08-17.** Structural, not careless: PROGRESS.md is at the repo root so its links are root-relative, every destination is in `docs/progress/`, and §6 step 5 says copy **verbatim** — so a correct rotation 404s its own links. ⛔ **Fix the recipe first** (a `](docs/` → `](../` pass after the append, before the cut — lead-playbook §§4–5), then sweep. **Do NOT rewrite PROGRESS.md's links — they are correct there** — lead
- 🟡 **FUP-VACUOUS-COVERAGE-1** — `phi-remediation` REM-8/REM-9 are honest `test.skip()`s that never run, so they are **outside the vacuity property** and `lint:vacuous` can never catch them. ✅ **Body written 2026-08-17** (it had none for its entire life — found by a pre-rotation check of all 54 head entries) — tester/backend
- 🟡 **FUP-329-ABORT-SHAPE** — a `329` keystone whose failure **aborts the file** (drops 41 assertions), making a mutation sweep over those gates unclassifiable — backend
- 🟡 **FUP-DM4-PRODROW** — the dangling frozen-snapshot PRODUCTION row + 3 unreferenced objects: reconcile at push/deploy (PO R2). ⚠ Must NOT delete DM4's M3/M4 guards — lead/backend
- 🟡 **FUP-E2E-REPEAT-FLAKY** — ⭕ **TWO members: `act-role-assumption:157` + `phase2-auth-shell:268`** (both flaked again at S6's green gate). ~~`dm5-nsp-evidence:347`~~ **REMOVED 2026-08-17 — root-caused and fixed (BUG-DM5-S6-EVID-KBD-1); it was never a flake.** ⭐ Its mechanism **evidences the long-standing "one root cause, not N flaky tests" guess** — and it sat one layer *above* where the class was being looked for: a readiness check that accepted the ancestor layout's `<main>` as proof of content while the route still showed its `loading.tsx` skeleton. Reproduce at **batch composition** (they pass in isolation — the isolated run is the trap), `RETRIES=0`, and fix the **precondition**, not the budget — lead/tester
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
