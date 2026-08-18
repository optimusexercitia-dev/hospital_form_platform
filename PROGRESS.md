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
| DM | **Document Model Redesign** [0114](docs/decisions/0114-document-model-redesign.md) (+Amdt 1/2) · ADRs [0116](docs/decisions/0116-dm1-substrate-cutover-decisions.md)/[0117](docs/decisions/0117-dm2-s1-confidentiality-ceiling-decisions.md)/[0118](docs/decisions/0118-dm2-s2-command-layer-decisions.md)/[0119](docs/decisions/0119-dm4-referral-document-substrate-decisions.md)/**[0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md)**/**[0121](docs/decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md)**/**[0122](docs/decisions/0122-recusal-case-read-arm-at-the-referral-freeze-door.md)** · [plan](docs/plans/document-model-redesign.md) | ✅✅ **PROGRAM COMPLETE — DM0–DM5 all closed; DM5 (the FINAL phase) closed 2026-08-18, all five gate steps.** ⛔ **Completion did NOT discharge two obligations — [§ Critical FUP](#-critical-fup--the-must-not-be-forgotten-list) C1 (UNREHEARSED PHI-disposal runbook) + C2 (407-door Tier 1).** ↩ Phase detail rotated 2026-08-18 → the DM5 record · S0 ✅ · ~~S1~~ WITHDRAWN · S2 ✅ · S3 ✅ · S4 ✅ · **S5 ✅ CLOSED 2026-08-17, all five gate steps** (step 4 PO-ruled: the batch's approval closes S5 too) · **follow-up batch ✅ gate green, PO-approved** · **S6 ✅ steps 1–3 COMPLETE (2026-08-17): build + canon + exit sweep · `e2e:prod` **GREEN 1121p/0f** · slice QA ✅ r2 · **DM5 PHASE QA ✅ APPROVED r2** — ✅ **step 4: all SEVEN PO decisions RULED 2026-08-18** (§ Decisions, the eight `2026-08-18` rows). ⛔ **Two rulings are WORK, not completions** — the runbook rehearsal (**C1**) and the 407-door Tier 1 (**C2**) now live in **§ Critical FUP**; the collision is ruled as (b) but its rebuild is gated on C1. ✅ `FUP-DM5-BACKEND-STATE-SLICE-SECTIONS` **RESOLVED 2026-08-18** (S2/S3/S5 sections written, catalog-derived) — ⚠ it surfaced **4 wrong figures in the DM END STATE stamps**, incl. a trigger on `responses` that **does not exist** (lead-verified). ⚠ DM5 still owes **§6 step 5 (record/rotation)**; `db push` ✅ done** | ✅ DM4: 5 migrations `20260926000100`–`000500` · pgTAP `340` | ✅ DM4: pgTAP **191f/6231** · 391==391 · vitest 1264 · 4 ARMs HOLD · matrix **18/18 RED-PROVEN** · `e2e:prod` **99p/0f**. Batch gate (`4f16ea5f`): pgTAP **194f/6392** · registry 412==412 · lint 5/5 · tsc 0 · vitest 1304 · 4 ARMs HOLD · `e2e:prod` **1118p/0f/0 did-not-run** | ✅ DM4 **APPROVED (r2)** [review](docs/reviews/dm4-referrals-review.md), no binding condition. ⚠ The batch was PO-approved with **gate step 3 (QA) NOT RUN** — stated before approval, accepted, recorded as a deviation | ✅ **2026-08-14** (DM4) · batch **2026-08-17** | 2026-08-14 | `phase(DM4)` = `7b6896eb` · `phase(DM5-followups)` = `fd69d4be`. ⛔ **Read § "State" (a TOP-LEVEL section since 2026-08-18) for the measured remote/push facts** — the "NOT pushed / no `db push`" claim that used to live in this cell was **false in both halves**. ✅ **RESOLVED 2026-08-18: the five local-only migrations were PUSHED** — remote at **`20260928000500`**, **4** buckets (the 8 retired ones **gone**, catalog-verified), and **FUP-DM4-RECUSAL's PHI fix is LIVE on the remote** (`pg_get_functiondef`, not migration text). **Zero local-only migrations remain, so nothing at or below `20260928000500` may be edited in place.** ⚠ **"Flags ship OFF" is NOT a security boundary** (0 RLS policies read a flag). Records: [DM1](docs/progress/dm1-substrate-cutover.md)·[DM2](docs/progress/dm2-orchestration-wave-a.md)·[DM3](docs/progress/dm3-controlled-documents.md)·[DM4](docs/progress/dm4-referrals.md)·**[DM5](docs/progress/dm5-wave-d-retirement.md)**·[S5](docs/progress/dm5-s5-operational-closure.md). Open items + PO decisions owed: § Current Phase Tasks › "Open follow-ups". ↩ This cell's 11.5 KB of narrative rotated **2026-08-17** → the DM5 record § "Rotated from PROGRESS.md 2026-08-17 — the Phase Status DM row", preserved verbatim before the cut |
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

## 🛑 START HERE — **the seven PO decisions are ✅ ANSWERED (2026-08-18). Two of the answers are WORK, not completions.**

> **Status 2026-08-18: all seven gate-step-4 decisions are ruled and recorded** — in their ADRs, in
> § Decisions, and in the follow-up bodies + index lines. The docket that blocked the Document Model
> program's final phase is discharged. Full rulings: **§ Decisions, the eight `2026-08-18` rows.**
>
> ⛔ **DO NOT READ "ANSWERED" AS "DONE".** Two rulings created obligations that outlive this phase and
> now live in **[§ Critical FUP](#-critical-fup--the-must-not-be-forgotten-list)**:
> - **C1** — the PHI-disposal runbook must run **end-to-end before any real patient record is
>   loaded**. The pilot risk acceptance is *bounded by that rehearsal* and does not survive without it.
> - **C2** — Tier 1 of the 407-door sweep (PHI / tenancy-crossing) is **sized but not yet counted**;
>   deriving its population is step one.
>
> ⚠ **The docket was over-wide by one item and that is worth remembering, not just fixing.** It listed
> ADR 0114 **O4** as owed; O4 was **ruled 2026-08-13** (ADR 0118 — 120 s / 300 s signed-URL TTLs), and
> ADR 0120's open-items section — the phase review's **own cited source** — named only O1 and O2. The
> review widened its source, PROGRESS.md inherited it, and a PO was asked to decide something already
> decided. ⭐ *An over-wide list of what is owed costs the same round as an under-wide one.*
>
> ↩ **The docket as it stood 2026-08-17 — all seven rows with their "why it blocks" reasoning —
> rotated 2026-08-18 → [dm5-wave-d-retirement.md](docs/progress/dm5-wave-d-retirement.md)**
> § "the SEVEN-DECISION DOCKET as it stood before the rulings", verbatim, `cmp`-verified.
> **The answers are below and in § Decisions; that archive holds the questions.**
>
> ### ✅ Step 1 DONE — where each answer was recorded
>
> | # | ruling | recorded in |
> |---|---|---|
> | 1 | D9 ratified **accepted-unverified on Cloud** + runbook HARD STOP | ADR 0120 D9 · [runbook §6](docs/deployment/phi-disposal-runbook.md) |
> | 2 | O1 **20 yr clinical / 5 yr governance** · O2 expiry = *"any external user can upload"* | ADR 0114 Open items · ADR 0120 open/deferred |
> | 3 | Uploader visibility **NOT added**; S1-O3 **closed** | ADR 0117 § S1-O3 · ADR 0116 §11 |
> | 4 | Supersede collision → **(b)**, trigger moves to retention expiry | ADR 0121 **Amdt 2** · ADR 0120 D11 |
> | 5 | 407-door triage → **two tiers** | **Critical FUP C2** · FUP-AUTHZ-COMMAND-DOOR-UNSWEPT |
> | 6 | S2/S3/S5 `backend-state.md` sections → **backend, one task** | **FUP-DM5-BACKEND-STATE-SLICE-SECTIONS** (filed 08-18; it had no ID) |
> | 7 | Pilot risk **accepted, bounded by one rehearsal** | ADR 0121 **Amdt 3** · **Critical FUP C1** |
>
> ### What the next session works in, in order
>
> 1. ~~**#6's task**~~ ✅ **DONE 2026-08-18** — `backend` wrote the S2/S3/S5 `backend-state.md` sections
>    (`FUP-DM5-BACKEND-STATE-SLICE-SECTIONS`), catalog-derived; **S4 added on the PO's ruling** in the
>    same pass. ⚠ **It surfaced 4 wrong figures in the DM END STATE stamps** — chief among them a
>    trigger on `responses` that **does not exist** (lead-verified: 5 user triggers, none touches
>    `securable_resources`; the securable is minted lazily inside `mint_printed_document`, and ADR 0120
>    **D17.2** rejected the trigger **by name**). ⭐ *The stamp did not lag the design — it asserted the
>    mechanism the design wrote a paragraph to refuse.*
> 2. ~~**§6 step 5 — Record + rotation**~~ ✅ **DONE 2026-08-18.** Rotated per the phase QA's guidance
>    **plus** the phase rotation the Record step itself requires: **Test Run Summary** → 1 row (the
>    declaring-green run); the two **QA Verdicts** rows compressed to their contractual one line; and
>    **the entire 34.5 KB DM5 phase section + the answered docket** → the DM5 record. **146 KB → ~111
>    KB.** Every move: appended **before** the cut, `cmp`-verified, links repointed, **0 broken links
>    across all four files** (verified, not assumed). ⛔ Follow-up index lines **not** rotated (R3);
>    § Critical FUP **not** rotated. ⚠ **Still ~111 KB against §7's "well under 60 KB"** — the residue
>    is structural, not phase detail: **Follow-ups 27 KB · Phase Status 26 KB · Decisions 17 KB · Bug
>    Log 15 KB**. Closing that gap means rotating *those*, which is a separate decision with its own
>    R3-shaped risk, not a leftover of this pass.
>    ⭐ **Found while doing it: `test-run-archive.md` carried 18 links already broken at HEAD**, from
>    earlier rotations that skipped the repoint step. Fixed. *A verbatim rotation that does not repoint
>    is this repo's standing rotation defect, not a one-off — the check belongs in the recipe.*
> 3. ~~**THEN the `db push` question**~~ ✅ **DONE 2026-08-18** — PO-authorized and executed to carry out
>    decision #1. All five migrations applied; remote at `20260928000500`; **8 buckets retired, 4
>    survive; the recusal PHI fix is live.** Measured facts in § "State". ⭐ **The mechanism finding is
>    worth keeping:** the sanctioned way to retire the buckets **was** migration `20260927000400`, which
>    also drops four `storage.objects` policies — *the Storage-API route would have deleted the buckets
>    and left the policies behind.* **The noun "retire eight buckets" was materially narrower than the
>    act that performs it**, and the narrower-looking route was the less complete one.
>
> **Full reasoning → [dm5-phase-review.md](docs/reviews/dm5-phase-review.md) §§5–6 and
> [follow-ups.md](docs/progress/follow-ups.md).**

### ✅ COMPLETE — **DM5: Wave D + retirement** (2026-08-14 → 2026-08-18) — the Document Model program's FINAL phase

> **All five §6 gate steps passed.** Steps 1–3 on 2026-08-17 (pgTAP **194f/6392** · `e2e:prod`
> **GREEN 1121p/0f/0 did-not-run** · slice QA ✅ r2 · **DM5 PHASE QA ✅ APPROVED r2**); **step 4 (PO)
> 2026-08-18** — all seven docket decisions ruled (§ Decisions, the eight `2026-08-18` rows); step 5
> (Record + rotation) 2026-08-18.
>
> ↩ **Full phase detail — 34.5 KB, every slice, both incidents and the enumeration-boundary lessons —
> rotated 2026-08-18 → [dm5-wave-d-retirement.md](docs/progress/dm5-wave-d-retirement.md)**
> § "Rotated from PROGRESS.md 2026-08-18", **verbatim, `cmp`-verified, 19 links repointed.**
> Slice records: [S5](docs/progress/dm5-s5-operational-closure.md) ·
> [surface verification](docs/progress/dm5-surface-verification.md) ·
> [plan](docs/plans/dm5-wave-d-retirement-plan.md). ADRs
> **[0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md)** (D1–D18) ·
> **[0121](docs/decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md)** (+**Amdt 2/3**, the
> two 2026-08-18 rulings) ·
> **[0122](docs/decisions/0122-recusal-case-read-arm-at-the-referral-freeze-door.md)**.
>
> **Slices:** S0 ✅ · ~~S1~~ ⛔ WITHDRAWN, never built · S2 ✅ · S3 ✅ · S4 ✅ · S5 ✅ · follow-up batch ✅ · S6 ✅.
>
> ⛔⛔ **CLOSING THE PHASE DID NOT CLOSE ITS OBLIGATIONS — and this is the sentence the rotation exists
> to protect.** Two survive in **[§ Critical FUP](#-critical-fup--the-must-not-be-forgotten-list)**:
> **C1** (the PHI-disposal runbook is **UNREHEARSED**; the pilot risk acceptance is *bounded* by that
> rehearsal) and **C2** (the 407-door Tier 1 sweep). ⚠ Also still open and NOT discharged by
> completion: **D11's rebuild** (ruled, gated on C1 by ADR 0121 D1) and the `superseded`-vs-
> `retention_expired` build-time detail. ⭐ *A deliverable assigned to a phase disappears when that
> phase closes cleanly* — which is exactly why C1/C2 live in a section that is never rotated.

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
| 2026-08-17 | **DM5 S6 · LEAD · `npm run e2e:prod`** (`REBUILD=1`) — the DECLARING-GREEN run, after the EVID-KBD-1 fix. ⭕ **Added at the phase QA (R5): this table's rule is "most recent gate only" and BOTH 2026-08-17 gates were missing — including the run the phase QA itself rests on** | **GATE GREEN — 1121 passed · 0 failed · 0 infra · 2 flaky · 6 skipped · 0 did-not-run · 18 batches.** Parts sum to **1129 collected**, reconciled **per batch** (`accounted N/N`), so no unrun tests. Batch 4 = **64/0** (was 63/1). The 2 flaky are exactly the two remaining `FUP-E2E-REPEAT-FLAKY` members |

## QA Verdicts

<!-- ONE LINE per phase/feature: verdict + date + link. The full analysis lives in
     docs/reviews/*.md — never restate rationale here or in the archive.
     Struck-through rows are superseded rounds, kept only to show a phase looped.
     Retention: current milestone only. Older concluded rows move VERBATIM to
     qa-verdicts-archive.md's "Collapsed one-line index" (the index is not rationale —
     it preserves the feature-name → review-file mapping). -->

| Phase / Feature | Verdict | Date | Report |
| --- | --- | --- | --- |
| **DM5 — PHASE QA** (Wave D + retirement) — ⚠ **the PHASE verdict; the S3/S4/S5/S6 slice verdicts authorize no part of it** | ✅ **APPROVED (r2)** — r1 ⛔ 0 P0 · 4 BLOCKING · 4 MINOR · 7 INFO, **all record defects, no code change requested**; 3 MINOR carried, none blocking. ⚠ **Approved OVER** 🔒 the unrehearsed runbook and 🔴 the supersede collision — **both PO-ruled 2026-08-18** (§ Decisions); the rehearsal is now **Critical FUP C1** | 2026-08-17 | [dm5-phase-review](docs/reviews/dm5-phase-review.md) |
| **DM5 · S6 — canon rewrite + program exit sweep** — ⚠ **SLICE review; superseded in scope by the PHASE QA above** | ✅ **APPROVED (r2)** — r1 ⛔ six findings, **all record defects** | 2026-08-17 | [dm5-s6-review](docs/reviews/dm5-s6-review.md) |
| _Verbose form of the two rows above_ — rotated **2026-08-18** → [qa-verdicts-archive.md](docs/progress/qa-verdicts-archive.md) § "Rotated from PROGRESS.md 2026-08-18", verbatim (6 links repointed, `cmp`-verified) | – | – | – |
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
| 2026-08-18 | **DM5 GATE STEP 4 — ALL SEVEN DOCKET ITEMS RULED** (PO), closing the docket that blocked the Document Model program's final phase. Rows below carry each. ⚠ **The docket was over-wide by one**: it listed ADR 0114 **O4** as owed, but O4 was **ruled 2026-08-13** (0118; 120 s/300 s TTLs) and ADR 0120's open-items list — the phase review's own cited source — named only O1/O2. *An over-wide list of what is owed costs the same round as an under-wide one.* ⛔ **Two items are RULINGS, not completions**: C1's rehearsal and C2's Tier 1 are **work**, now carried in the new § Critical FUP | [phase review](docs/reviews/dm5-phase-review.md) §§5–6 · § Critical FUP |
| 2026-08-18 | ✅ **`db push` EXECUTED — all five local-only migrations applied to the remote** (PO-authorized at the docket, to carry out decision #1). Remote `20260927000360` → **`20260928000500`**; **8 legacy buckets retired** (4 survive: `documents-phi`/`documents-standard`/`form-assets`/`meeting-audio`), **0 objects**, the four `nsp_evidence`/`capa_evidence` policies **gone**, and **FUP-DM4-RECUSAL's PHI fix is LIVE** (verified via `pg_get_functiondef`, not migration text). ⭐ **The mechanism finding:** retiring the buckets *required* `20260927000400`, which also drops those four policies — **the narrower-looking Storage-API route would have deleted the buckets and orphaned the policies.** ⛔ **Zero local-only migrations remain: nothing at or below `20260928000500` may be edited in place** — the editable window did not move forward, it closed | § "State" (a TOP-LEVEL section since 2026-08-18) |
| 2026-08-18 | **#4 SUPERSEDE COLLISION RULED as (b) — supersession no longer marks bytes; the trigger moves to RETENTION EXPIRY** (PO). The widening of `app.resolve_document_version_bytes` was **declined**. ⭐ **The collision is not adjudicated, it stops occurring** — the two ratified decisions only ever touched at the supersession *instant*, so the PHI byte-serving gate is **untouched** and no diff-scoped door sweep is owed against it. D3's vocabulary survives (the `duplicate` trap is still real), its trigger is struck; D5's principle survives, its timing moves. ⚠ **One build-time detail left OPEN on purpose**: `superseded` vs `retention_expired` as the reason recorded at expiry — both true, different to a regulator. ⛔ Rebuild gated by **D1's outflow**, not by a decision | ADR [0121](docs/decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md) **Amdt 2** · ADR [0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md) D11 |
| 2026-08-18 | 🔒 **#7 PILOT RISK ACCEPTED, BOUNDED BY ONE REHEARSAL** (PO) — the pilot may proceed over the manual-only PHI-disposal path **on the condition that `phi-disposal-runbook.md` runs end-to-end against test data BEFORE any real patient record is loaded**. ⭐ **The condition is the substance, not a caveat**: the mitigation was never missing, it had never been *observed to work* — a procedure only ever read is a claim about a procedure. ⚠ `disposal_state` = **INTENT, not a destruction guarantee**, now ratified as such; nothing user/regulator/export-facing may call it destruction. **Inverts ADR 0099 D10** — for PHI the stale row IS the harm. ⛔ D2 is **not** ratified; `343`'s K6b stays a false pin the day a scheduler lands | ADR [0121](docs/decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md) **Amdt 3** · **Critical FUP C1** |
| 2026-08-18 | **#2 ADR 0114 O1 + O2 RULED** (PO). **O1** — **20-yr floor on anything clinical, 5-yr default on governance metadata**; the tiering rule is *does this evidence care, or evidence process*. ⛔ **Trigger events, per-type tier assignment, and erasure-vs-retention reconciliation stay OPEN** — an implementer may not infer them, and a retention row is still **provisional** (D5-class `HC0DR` blocking still applies). **O2** — the `unscanned_accepted` acceptance now expires *"the day any external user can upload"*. ⭐ **An event, not a date, on purpose**: a calendar deadline for a risk acceptance expires while the risk is unchanged, and gets extended. Scanner selection stays open, but becomes blocking at the same moment | ADR [0114](docs/decisions/0114-document-model-redesign.md) Open items |
| 2026-08-18 | **#1 ADR 0120 D9 — the under-count class is RATIFIED AS ACCEPTED-UNVERIFIED on Cloud; no verification step is added** (PO), **+ a HARD STOP in the runbook**: never run `capture` against Cloud from a machine with a local stack up; never read exit 0 / `CAPTURE CLEAN` as a byte result; never record a Cloud deletion as *verified* (record **asserted**). ⭐ The Cloud danger is a **FAKE proof, not a missing one** — `locateVolume()` has no project affinity, and the configuration that produces it is the *normal* posture of anyone who can run this repo's gates. ⚠ **What made it safe to ratify does NOT generalise**: remote holds **0 objects in all 12 buckets** (re-measured 2026-08-18) and the under-count class needs objects to under-count. **Expires when the pilot loads data.** ⛔ S3 endpoint still **UNPROBED** | ADR [0120](docs/decisions/0120-dm5-wave-d-retirement-decisions.md) **D9** · [runbook](docs/deployment/phi-disposal-runbook.md) §6 |
| 2026-08-18 | **#5 THE 407-DOOR TRIAGE IS SIZED — TWO TIERS** (PO). **Tier 1** = the subset touching **PHI or crossing a tenant boundary**, swept next as its own workstream, each door getting a **recorded verdict** so a new door cannot pass by absence. **Tier 2** = the remainder, **deferred to after the pilot ships**. ⛔ **Tier 1's population is derived from the catalog AS A PROPERTY, never hand-listed** — this item was itself filed on an inferred premise that measured false, and a hand-picked "PHI-looking" list reproduces the phase's dominant failure class exactly. **Its size is not yet known; deriving it is step one.** ⚠ The 3-door sample may close nothing; `assume_role` is **ERROR-shaped, not COVERED** | **Critical FUP C2** · FUP-AUTHZ-COMMAND-DOOR-UNSWEPT |
| 2026-08-18 | **#3 UPLOADER VISIBILITY IS NOT ADDED — S1-O3 CLOSED** (PO). An unplaced file object stays invisible to everyone including its uploader; DM1 MAJOR-1's removal is the **permanent** shape. ⭐ The known cost is narrow and **unobserved** — an interrupted upload leaves an orphan the user cannot see or retry — and the pilot is what would surface one; adding a visibility path to a PHI-capable substrate to pre-empt it is the wrong trade. ⛔ If ever revisited, a future arm goes **INSIDE the kernel chain**, never beside it — outside is not a smaller version of the feature, it is the defect that was removed. `328` K13 is now a pin on a **decided** state; do not "fix" it as over-narrow | ADR [0117](docs/decisions/0117-dm2-s1-confidentiality-ceiling-decisions.md) § S1-O3 · [0116](docs/decisions/0116-dm1-substrate-cutover-decisions.md) §11 |
| 2026-08-18 | **#6 THE S2/S3/S5 `backend-state.md` SECTIONS ARE STILL WANTED — `backend` writes all three as ONE task before DM5 closes** (PO). ⛔ **Filed as `FUP-DM5-BACKEND-STATE-SLICE-SECTIONS` the same day because it had no ID** — it lived only in the S6 QA, the phase QA and the `🛑 START HERE` block, every one of which expires on answering the docket. ⭐ *Naming a thing in the document that expires is not naming it* — phase-QA finding **R3**, re-earned one docket item later, by the obligation whose stated purpose was that it *"cannot die quietly when DM5 closes"* | FUP-DM5-BACKEND-STATE-SLICE-SECTIONS |
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

## ⛔⛔ State — **THIS BLOCK WAS FALSE IN BOTH HALVES UNTIL 2026-08-17. Re-measured; do not restore the old wording.**

_(It read: **"branch `main`, NOT pushed, no `db push`."** Both halves were wrong, and it sat in the
line a new session reads to decide whether the remote is safe to touch. →
[[a-records-claim-about-an-external-system-goes-stale-silently]].)_

| fact | measured — **2026-08-18** unless the row says otherwise | how |
|---|---|---|
| branch | `main`, tree clean | `git status` |
| git pushed? | ✅ **YES** — ⭕ **re-measured 2026-08-17 after the PO pushed**: `origin/main` = **`cd6b9b43`** (the S6 slice-QA commit); HEAD `211a1e65` is **4 ahead**. *(This row said `23b1d9cf` / "33 ahead" until the push — a claim about an EXTERNAL system, stale within hours.)* | `git rev-list --left-right --count origin/main...HEAD` |
| `db push`? | ✅ **DONE THROUGH `20260928000500` — the five local-only migrations were PUSHED 2026-08-18** (PO-authorized at the gate-step-4 docket, to execute decision #1). **411 applied.** ⛔ The prior value of this row — *"DONE through `20260927000360`, 406 applied"* — is **superseded**, not merely dated | `select max(version) from supabase_migrations.schema_migrations` |
| local-only migrations | ✅ **NONE.** All five are now on the remote: `20260927000400` (S4 retirement) · `20260928000100` (recusal) · `20260928000200` (evidence revoke) · `20260928000400` (D4 contract) · `20260928000500` (finalize-atomic). ⚠ `…0928000300` **does not exist** — reverted D11 inflow (`5b40d62b`). ⛔ **All five are now APPLIED and therefore NO LONGER EDITABLE in place** | `supabase db push --dry-run` (empty) |
| remote storage buckets | ✅ **4** — `documents-phi`, `documents-standard`, `form-assets`, `meeting-audio`. The **eight** retired buckets are **GONE** (migration reported *"retired 8 legacy bucket row(s) of 8 named"*; catalog-verified after). **0 objects**, and **0** of the four `nsp_evidence`/`capa_evidence` policies survive — the policy drop is what the Storage-API route would have missed | `storage.buckets` + `pg_policies` |
| recusal PHI fix, remote | ✅ **LIVE** — `public.add_referral_shared_item`, `prosecdef = t`, `can_read_case` present in the body read from **`pg_get_functiondef`** (not from migration text) | `pg_proc` |
| DM flags, local | all six **ON** — `documents_foundation`/`wave_a`/`b`/`c`/`d` + `document_printing` | `select key, enabled from app.feature_flags` |
| DM flags, shipped | **OFF** — the local ONs come from `seed.sql`, which `db push` never applies; remote measured all-OFF 2026-08-17 | remote read |

✅✅ **THE `db push` HAPPENED 2026-08-18 — this section's central warning is DISCHARGED, and that is
why it is rewritten rather than annotated.** All five migrations applied cleanly in one run; the
remote is at `20260928000500`, holds **4** buckets, and carries the recusal fix. **Every claim in
this block that began "the remote does not have…" is now false and has been replaced above.**

<details><summary>Superseded — the 2026-08-17 warning, kept because the distinction it draws is permanent even though its facts are not</summary>

> ⛔⛔ **A GIT PUSH IS NOT A `db push`, and 2026-08-17 is the day that distinction became easy to
> misread.** The PO pushed 33 commits, so the code — including S4's retirement, the recusal fix and
> every S6 canon change — is **on `origin/main`**. **None of it is on the DATABASE.** The remote is
> still at `20260927000360` with the **same five** migrations local-only, independently confirmed by
> the phase QA (406 applied; 12 buckets, *including all 8 supposedly-retired ones*; 0 storage objects;
> 0 rows sampled). **Anyone reading "pushed ✅" as "the remote has the retirement" is wrong.**
>
> 2. **The recusal fix is NOT on the remote.** `FUP-DM4-RECUSAL` is ⬛ closed against the *local*
>    catalog only, so the recused-coordinator PHI path is **still open remotely** until `db push`.

</details>

⛔ **THE ONE CONSEQUENCE THAT SURVIVES, and it is now WIDER than before.** **Applied migrations may
NOT be edited in place** — that is the drift that blocks a future `db push`. ⚠ **The five that were
still editable yesterday are applied today**, so **nothing at or below `20260928000500` may be
touched.** The editable window did not move forward; it closed.

⭐ **What the push cost and bought, stated together so neither is quoted alone.** It **retired the 8
buckets** (decision #1) and **closed the recused-coordinator PHI path on the remote** — which the
phase review flagged as *"harmless only because the remote is empty, and it stops being harmless the
moment the pilot loads data."* ⛔ **It did NOT make the remote pilot-ready**: `disposal_state` is
still an intent (**Critical FUP C1**), and the remote's safety still rests on holding no data.

⚠ **"Flags ship OFF" is NOT a security boundary and must stop being cited as one.** ✅ **The
load-bearing half is RE-VERIFIED 2026-08-18: ZERO RLS policies read a flag** (0 rows over
`pg_policies` matching `feature_flag|documents_wave|documents_foundation|document_printing|assert_document`).
**The conclusion stands on that half alone** — it is an **app-layer** gate.
⛔ **The function-count half — "51 of 52" — is CONTESTED and must not be quoted until re-derived.**
Four figures are in play: this line says 51/52; the **DM5 phase QA measured 75/6 LOCAL and 74/6
REMOTE** (its R1 finding — *"reproduces on neither catalog"*; that row's verbose form rotated
2026-08-18, which is why the numbers are restated here rather than left to it);
`docs/backend-state.md`'s DM END STATE block also says **75/6** (independently reproduced
2026-08-18); and a lead spot-derivation the same day returned
**90** document-family functions, of which **0** read `app.feature_flags` directly, **10** call an
`app.assert_*_enabled` helper, and **5** *are* those helpers. ⭐ **They disagree because each uses a
different BOUND, not because one is a typo** — the denominator depends on how "document function" is
delimited and the numerator on whether "reads a flag" means a direct table read, a helper call, or
being the helper. → [[enumeration-boundary-is-a-syntax-not-a-property]]. **Whoever re-derives it
states the predicate beside the number**, per the convention the DM END STATE block already uses. The
load-bearing reason the remote is safe today is that **it holds no data and no users** (0 orgs / 0
profiles / 0 commissions / 0 cases) — a stronger reason, and one that **expires the moment the pilot
loads data**. graphify ✅ `02cec1a0`.

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
| **C1** | 🔒 **`FUP-DM5-DISPOSAL-JOB`** — the PHI-disposal path is **manual and UNREHEARSED**. `disposal_state` records an **intent, not a destruction guarantee**: **4 SET-form writers** put rows into `disposal_pending` — 3 `authenticated`-reachable (`request_document_disposition`, `dispose_case_phi`, `dispose_referral_phi`) **plus `complete_document_reclassification`, service-role-only** — against **exactly ONE** outflow door, and **nothing automated calls it** (no `pg_cron`, no cron schema, single-process Dockerfile). ⚠ *Corrected 2026-08-18: this said "three inflow doors", which is right only bounded to JWT-reachable doors — **the queue is fed wider than the item said**.* | **Execute [`phi-disposal-runbook.md`](docs/deployment/phi-disposal-runbook.md) end-to-end against test data, once**, and record the run. Only then is the mitigation real in practice rather than on paper. ⚠ The run also produces the first **destination path** for `FUP-DM5-BACKUP-IS-PHI-EXPORT`, which is owed at first execution. | ⛔ **BEFORE ANY REAL PATIENT RECORD IS LOADED.** PO-accepted 2026-08-18 as a pilot risk **bounded by this rehearsal** (ADR 0121 **Amdt 3**) — the acceptance is not open-ended, and the pilot may not admit real PHI ahead of it. | PO (executor = whoever holds service-role reach — an ACL fact, not a choice) |
| **C2** | 🟠 **`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`** — **407** reachable command doors sit outside **every** authz arm's domain (`ARM=census` is bounded to `bool`/set-returning; these return `jsonb`/`void`). ⚠ **Covered-but-UNPINNED, not blind** — a 3-door neutralization sample found all three COVERED. ⛔ **The sample may NOT be used to close it.** | **Tier 1 — sweep the subset that touches PHI or crosses a tenant boundary**, derived as a property over the catalog, never hand-listed ([[enumeration-boundary-is-a-syntax-not-a-property]]). **Tier 2 — the remainder is DEFERRED.** Each swept door gets a recorded verdict, so a regression reds and a **new** door cannot pass by absence. | **Tier 1: next, as its own scoped workstream** — sizing is step one and is not yet done. **Tier 2: after the pilot ships, once there are real customers.** | lead + backend |

## Follow-ups / Deferred Items

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

- ⬛ **FUP-DM5-BACKEND-STATE-SLICE-SECTIONS** — ✅ **RESOLVED 2026-08-18 (backend).** The **four** `##` sections (`DM5·S5` · **`DM5·S4`** · `DM5·S3` · `DM5·S2`) — **S4 added the same day on the PO's ruling**, so the scope is wider than the item's title are in `docs/backend-state.md`, between the DM5 follow-up-batch and DM4 sections; every figure carries its deriving query, all from the LIVE catalog (`schema_migrations` intervals · `pg_proc` incl. `prosecdef`/`proacl` · `pg_constraint` · `pg_attribute`+`attacl` · `pg_class.relacl` · `pg_trigger` · `pg_policy` · `pg_extension`/`pg_namespace`). **Every DM END STATE aggregate figure re-derived and reproduces** (411==411 · 13×1 policy · 38 doors/5 service-role-only · 4 buckets · 4 `storage.objects` policies · 165/165 RLS · flags 75/6); none retired. ⛔ **The write found FOUR catalog-false claims in the aggregate block's `###` stamps, corrected in place** — S3's *"6 migrations"* (registry says **7**), S3's *"a trigger on `responses` mints its securable"* (**there is none**; minted lazily in `mint_printed_document`, and D17.2 refuses the trigger *by name*), S2's *"NULL commission"* (the CHECK constrains only org+hospital), S2's *"8 types"* (**9** since S3). ⚠ Three more were right only under an unstated bound, now written down: disposal inflow is **4** SET-form writers (3 `authenticated`-reachable), the evidence-table ACL is **`rm`** not `r`, and S3's *"five write guards"* is curated — the property-bounded union is **7** (`HC0DA` sits outside the `HC0D[KLN]` family). ⚠ **S4 has no `##` section** (out of scope; its delta stays in the aggregate stamp) — named in the S3 section so it cannot read as a silent omission. ⚠ **The § Phase Status DM row still says DM5 "owes" this item** — lead's cell to update — backend
- 🟠 **FUP-DM5-BYTE-PROOF-NOT-ATTEMPTED** — `complete_document_disposal`'s `p_byte_proof` DEFAULTs to `'not_attempted'` and its **only** production caller (`reclassifyDocument`) omits it — **three lines after successfully deleting the bytes**. The one lane that can honestly claim a byte proof is the one that disclaims it, in the ADR 0121 D4 evidence a regulator reads. Errs conservatively, so no gate catches it. Nothing pins what any lane writes — backend
- 🟡 **FUP-DM5-ATTACHMENTS-MODULE-SURVIVED-RETIREMENT** — `src/lib/attachments/` survives the retirement phase with 6 dead `'use server'` exports whose comments say *"until DM2 retires it"*. Dead app code, **not** a live byte path (catalog clean: 0/0/0/0). ⭐ Invisible to the S6 exit sweep because that sweep is bounded by **identifier** — *"does anything still point at the retired thing?"* and *"is the thing that pointed at it gone?"* are different questions, and DM5 only asked the first — frontend + backend
- 🟠 **FUP-DM5-SUPERSEDE-SERVING-COLLISION** — ✅ **PO-RULED 2026-08-18 as option (b): supersession no longer marks bytes; the trigger moves to RETENTION EXPIRY** (ADR 0121 **Amdt 2**). ⭐ The collision is not adjudicated, it **stops occurring** — the two ratified decisions only ever touched at the supersession instant, so `resolve_document_version_bytes` is **untouched** and no PHI byte-serving gate is widened. D3's vocabulary survives, its trigger is struck; D5's principle survives, its timing moves. ⚠ **One build-time detail left OPEN on purpose**: `superseded` vs `retention_expired` as the recorded reason at expiry. ⛔ Rebuild still gated — by **D1's outflow**, no longer by a decision (**Critical FUP C1**) — backend
- 🟠 **FUP-AUTHZ-COMMAND-DOOR-UNSWEPT** — ⭐ **CRITICAL FUP C2.** `ARM=census`'s DEFINER clause is bounded to `bool`/set-returning, so **407** reachable non-trigger command doors (326 RPC-callable) sit outside **every** arm's domain. ⭕ Re-scoped 2026-08-17: a 3-door neutralization sample found all three **COVERED**, so the class is **covered-but-UNPINNED, not blind** — nothing records the coverage, so nothing notices if it regresses and a NEW door passes by absence. ✅ **PO-SIZED 2026-08-18 — TWO TIERS**: Tier 1 = the PHI / tenancy-crossing subset, swept next as its own workstream, population **derived from the catalog as a property, never hand-listed**; Tier 2 = the remainder, **deferred to after the pilot ships**. ⛔ Tier 1's size is **not yet known** — deriving it is step one. ⚠ `assume_role` is **ERROR-shaped, not COVERED**, and resolves inside Tier 1 — lead + backend
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
- 🟠 **FUP-DM5-DISPOSAL-JOB** — ⭐ **CRITICAL FUP C1.** `disposal_pending` has **three inflow doors and zero automated outflow**; no `pg_cron`, no cron schema, single-process Dockerfile. PO ruled *document, do not build* → `docs/deployment/phi-disposal-runbook.md`; owner = the PO, executor = whoever holds service-role reach, **monthly + on a data-subject request**. ✅ **PO 2026-08-18: pilot risk ACCEPTED, BOUNDED — the runbook must run end-to-end against test data BEFORE any real patient record is loaded** (ADR 0121 **Amdt 3**). ⚠ `disposal_state` = **INTENT, not a destruction guarantee**, now ratified as such; **inverts ADR 0099 D10** — for PHI the stale row IS the harm. The decision is discharged; the **REHEARSAL is the deliverable** — PO, then backend
- 🔵 **FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN** — ⚠ **HALF RESOLVED 2026-08-17 (`24cee179`)**: the fail-open half is fixed and proven; the arm is still a no-op pending a **NAMED** successor (deliberately not re-pointed — a successor must be named, not guessed). ⭐ *A guard written to announce "MUTATION NO-OP" failed OPEN into an error instead* — backend
- ⬛ **FUP-DM4-RECUSAL** — ✅ RESOLVED 2026-08-17 (`32054942`, `20260928000100`, ADR 0122): a `can_read_case` arm **above** the `p_kind` dispatch, covering both arms; `340` 76→82 red-first. ✅✅ **AND NOW LIVE ON THE REMOTE — pushed 2026-08-18**, verified against `pg_get_functiondef` (`prosecdef = t`, arm present), not against migration text. ⭕ *This line read "LOCAL ONLY — the PHI path is still open there" for a day; the fix's own follow-up was the last place still saying so* — lead/PO/backend
- 🟠 **FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES** — ✅ **DECIDED 2026-08-18: BUILD IT, at retention expiry** (ADR 0121 **Amdt 2**). D11's clause stands; only its trigger moves. ⛔ **Still not startable, and this is its THIRD distinct blocker** — not "unbuilt" (08-16), not "an undecided collision" (08-17), but **ADR 0121 D1**: inflow and outflow ship together, and the outflow is the manual runbook whose rehearsal is **Critical FUP C1**. ⭐ *A stale blocker reads exactly like a live one* — name the current one whenever this is quoted. Original: D11 says superseded print bytes retire via `disposal_state`; measured, both stay `none` and nothing schedules it — backend
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
