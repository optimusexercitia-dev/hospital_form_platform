# QO·B — AUTHOR SELF-AUDIT (⚠ **not** a QA review)

**Date:** 2026-08-08 · **Author:** the session that built QO·B · **Verdict:** none — a
self-audit cannot issue one.

> ⛔ **THIS DOES NOT SATISFY PHASE-GATE STEP 3.** The gate requires `qa` — a reviewer who
> did not write the code — to produce `APPROVED` or `CHANGES REQUESTED`. This document is
> the author's own read, written to make a real review *cheaper*, not to replace one.
>
> The reason matters more than the formality. **Every defect found in this phase was found
> by tooling or by a mechanical re-check, and none by me re-reading my own work:**
>
> | Defect | Found by | Would my re-reading have caught it? |
> |---|---|---|
> | Keystone 1.2 was vacuous (no answers in the fixture) | `b1` mutation audit | No — it looked correct |
> | `answers_select`'s arm is unreachable behind RLS | `b1` mutation audit | No |
> | 3 BLIND gates (`can_read_document_object`, 2 satellites) | ADR 0079 door sweep | No — I believed §5.1's catalog grep covered them |
> | **16 DEFINER doors left uncut** after M1–M4 | a mechanical re-read of the ratified list | Only because I ran the check *as a check* |
> | `\y…\y` cannot match `…_for` | the corrected re-run of that same check | No — the first run looked complete |
> | E2E aimed at a surface that could not discriminate | the E2E going red | No |
>
> Six for six. That is the base rate a reviewer should assume for anything below.

---

## 1. What shipped

Six migrations, `20260915000000`–`20260915000500`, on branch
`feat/quality-office-oversight`, local-only (no push, per standing instruction).

| | Cut |
|---|---|
| **M1** | response plane — `responses_admin_all` dropped outright + the tenancy disjunct off `responses_select`, `answers_select`, 4 answer satellites |
| **M2** | controlled-document policies + the 3 read wrappers (`can_read_document_of_version`, `can_read_document_object`, `can_view_printed_document`) |
| **M3** | indicator **measurements** only — Q3 is a SPLIT; definitions kept |
| **M4** | 18 case-plane write doors, population **derived** from A4-Unit-2's exclusion guard (31 → 23 admitting → 18 cut, 5 ratified KEEP) |
| **M5** | 6 response-plane **doors** (3 row-level dashboards + signoff/supersede/target) |
| **M6** | 10 controlled-document **doors** + `can_write_attachment`'s case arm |

**Evidence:** fresh reset 328 == 328 · pgTAP **175 files / 5553 / PASS** · A/B matrix
**LOST = ratified cells only, GAINED = 0, KEEP-side 0/0** · `b1` **17/17 RED-PROVEN**
(12 under-cut + 5 over-cut), RESTORE byte-identical, CONTROL 49/0 · `ARM=census` +
`ARM=floor` HOLD · diff-scoped door sweeps: 3 BLIND found → keystoned → **re-swept 0
BLIND**; `can_write_attachment` COVERED · E2E **6/6 GATE GREEN** · lint 0/0 · tsc ·
vitest 1194. Closes **BUG-QOB-001** and **BUG-QOB-002**.

## 2. Where I would attack this if I were the reviewer

Ranked by how much I distrust my own work, not by how hard they are to check.

**① Only 4 of the 16 M5/M6 doors have a BEHAVIOURAL keystone.** `dashboard_free_text`,
`dashboard_export_rows`, `list_commission_documents` and `can_write_attachment` are pinned
in `314` §7/§8. The other twelve — `dashboard_completion_by_member`,
`get_response_for_signoff`, `supersede_response`, `target_case_response`, and the nine
remaining document doors — are covered **only by the migrations' structural
postconditions**. This phase proved, twice, that *a structural assertion cannot substitute
for a behavioural one*: §5.1's catalog grep passed happily on policies neutralized to
`using(true)`. **The same argument applies to these twelve, and I did not close it.** This
is the single most likely place a real leak survives.

**② The ratified CUT list was executed by hand, and I got it wrong twice.** M5 and M6
exist because M1–M4 cut tables and left doors. I re-ran the check and it now reports
clean — but the check is a grep I wrote, and its first version was blind to `_for`. A
reviewer should re-derive the population independently rather than re-run mine.

**③ `hospital_admin` is mostly inferred, not measured.** It is asserted at the predicate
(0.2), on responses (1.4), and on `update_case_meta` (4.2). Everywhere else — documents,
indicators, the 16 doors — its denial follows *by shared predicate*, which is sound
reasoning and not a measurement. Q4 ratified "the same wall"; the evidence is thinner than
the ruling.

**④ `storage.objects` policies sit outside the door sweep's `public` population.**
`controlled_documents_obj_insert_writable` was in my diff scope and never ran. Covered by
`314` §5.1's catalog invariant only — see ① for why that is weaker than it looks.

**⑤ The A/B matrix's authority is narrower than its name.** It measures table-row
visibility under RLS. It cannot see DEFINER doors *at all*, which is exactly how the
16-door hole survived a matrix reading `GAINED = 0`. Any future phase citing an A/B matrix
should state that limit explicitly.

**⑥ Four CUT tables hold zero rows in a clean seed** (`answer_matrix_cells`,
`answer_risk_matrix`, `answer_references`, `response_group_instances`, plus
`printed_documents`). Two were BLIND for exactly that reason and now have fixtures; the
others rest on catalog invariants.

## 3. Open, and not mine to close

- **BUG-QOB-003** — the UI still resolves a tenancy admin to `staff_admin`
  ([session.ts:459](../../src/lib/queries/session.ts:459)), so the wall closes underneath
  coordinator affordances that can no longer work. Not a security defect; needs a PO
  ruling (flag / 404 / accept) and frontend work.
- **FUP-QOB-1** — M1 made `response_group_instances_write_own_draft`'s `created_by` term
  unobservable; `270` §J's keystone is annotated vacuous pending a ruling.
- **Human approval** (gate step 4) and **`qa` review** (step 3) — both outstanding.

## 4. Process notes worth keeping

- **A killed sweep leaks a mutation.** A 10-minute tool cap cut the first door sweep
  mid-case and left `indicator_measurements_select` neutralized to `true` in the live
  catalog. The harness restores per case but not through a hard kill. Verify the catalog
  after any aborted gate run; run sweeps detached.
- **A partial sweep overwrites the committed findings file** — a 13-gate diff-scoped run
  would have replaced 356 lines of full-sweep record with 11. Restored each time.
- **The exit code is not the signal.** The E2E wrapper exited **0** while printing
  `FATAL: toolchain drift`.
- **Worktree toolchain drift after a fast-forward** — `git merge` moves `package.json`,
  not `node_modules`. `npm ci` after any fast-forward that crosses a dependency bump.
- **`typecheck` failing in a fresh worktree is not real** — the typed-routes registry is
  generated by `next build`.
