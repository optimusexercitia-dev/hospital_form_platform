# § Now — concluded bullets, rotated 2026-08-21

> **FROZEN 2026-08-24 — ADR [0139](../decisions/0139-quarterly-home-for-concluded-now-rotations.md).**
> This was the ad-hoc destination for concluded § Now rotations before the quarterly convention.
> New rotations go to the current quarter's file, starting with [2026-Q3.md](2026-Q3.md) — never here.
> Renaming or merging would orphan this file's inbound name- and line-keyed references. Adding this
> note shifted every line below it by 7; the one line-keyed citation (in
> `case-surface-split-increment-2.md`) was repointed in the same edit.

Moved **verbatim** out of [PROGRESS.md](../../PROGRESS.md) § Now at the DSR
operational-remediation Record step, under the §7 live-state discipline: both bullets describe work
that **merged and was recorded** days earlier, and their own narratives had already been rotated —
what remained in § Now was a summary of a summary, costing ~3.8 KB in a file whose gate hard-fails
at 80 KB (it stood at 77.5 KB).

> ⛔ **The `cmp` inverse-transform check prescribed by the rotation rules DOES NOT APPLY to this
> move, and saying so is the point.** That check assumes **one** source prefix. These bullets carry
> **two** — `](docs/decisions/…)` and `](docs/progress/…)` — which the rewrite collapses onto
> `](../decisions/…)` and `](…)` respectively. No single inverse can distinguish them, so an inverse
> `cmp` **fails on correct output**, and "make the cmp pass" would mean corrupting a link.
> **Verified by the property the check exists to protect instead: every rewritten link RESOLVES from
> `docs/progress/`.** 5 of 5 OK. ⚠ A mechanical check quoted outside the conditions it assumes is
> [[a-predicate-quoted-at-the-wrong-grain]] — name what you verified, not which ritual you ran.

---

- **✅ CONCLUDED 2026-08-19 — the `Imprimir prévia` / `Emitir documento` split** (ADR
  [0125](../decisions/0125-previa-ephemeral-and-emission-registered.md) +
  [0126](../decisions/0126-print-series-and-derived-currency.md)): shipped, QA **APPROVED** r2,
  **merged and pushed** (`9ed197d5`), branch gone. A locked source yields a registered emission; an
  editable one an **ephemeral prévia** — and the **door** enforces it, not the UI. ⭐ Its lesson,
  kept here because it is not print-specific: *a keystone proves the DOOR works and says nothing
  about whether the ACTION can reach it — the test is a **second caller**, and a second caller can
  satisfy a door the real one cannot even open.* ⚠ ADR 0126 **Amdt 1** carries eleven findings,
  **four of them corrections to claims the ADRs state AS MEASURED**. Full narrative rotated
  2026-08-20 → [previa-split-2026-08-19.md](previa-split-2026-08-19.md); residue
  (commission-level cascade path; `case`/`interview` lock declarations, 0126 D7) stays open there.
- **✅ SHIPPED 2026-08-19 — the documentation-stability refactor** (ADR
  [0127](../decisions/0127-standing-rules-home-and-staleness-gate.md); ADR
  [0124](../decisions/0124-progress-live-state-contract.md) **Amdt 1**). This file
  **56.6 KB → 40 KB**. Standing rules moved to `.claude/rules/` — **4 admitted, 5 of 9
  rejected** (already gate-enforced, dead anchor, or no tight glob). `lint:rules` is
  **gate 8**; `lint:progress` gained cell/bullet shape caps and now link-checks the
  rotation destinations, which immediately found **41 links already broken** in two of
  them plus 3 orphaned anchors.
  ⛔ **The premise the refactor was proposed on was FALSE** — this file is **not** loaded
  by any spawn and never was (no `@`-import has ever existed). Always-loaded is
  CLAUDE.md 32 KB + MEMORY.md 20 KB, so cutting *this* file buys nothing at session start.
  ✅ **MEASURED 2026-08-19 — rules FIRE.** A fresh session touched PROGRESS.md and the probe
  logged `RULE · progress-contract.md · reason=path_glob_match · globs=PROGRESS.md,docs/progress
  · trigger=…\PROGRESS.md`. The feature flag is on; the earlier non-load was the mid-session
  creation, as hypothesised. The CLAUDE.md §8 intake line is **unblocked** (ADR 0127 Amdt 4).
  ✅ **Confirmed twice, incl. a SOURCE glob** (ADR 0127 Amdt 5): a fresh `claude -p` session
  reading `src/lib/queries/responses.ts` loaded `answer-maps.md` by `path_glob_match`. That is
  the case the §8 intake rests on — standing lessons are discovered in source, not in the
  tracker. ⚠ **Bounded: fresh sessions 2/2 fired; the resumed session that built this 0/3.**
  Unexplained, not guessed at. A rule is a strong hint, **never a substitute for a gate**.
  ⭐ Incidental: every `session_start` entry names exactly **two** files — user CLAUDE.md and
  project CLAUDE.md, **no PROGRESS.md**. The harness independently confirms ADR 0124 Amdt 1.
  ✅ **`.claude/rules/` now has a COMPLETE lifecycle** — intake (CLAUDE.md §8, unheld once
  firing was measured), staleness gate, volume bounds, and a **conditional** exit. ⛔ The exit
  is conditional for a reason: **nothing reads `rules-archive.md`**, so retiring a rule that is
  still true and enforced nowhere deletes the lesson, and `lint:rules` goes green either way.
  "Too broad but still needed" is **not** a retirement — it is a gate waiting to be built, or
  content that belongs in CLAUDE.md (ADR 0127 Amdt 2).
  **Filed, not built:** the 42501 gate (15 `throws_ok` sites) · staleness **domain (b)**,
  the docs that make claims about repo mechanics · MEMORY.md compaction (19.6 / 24.4 KB) ·
  a CLAUDE.md context program — the file where cutting bytes actually pays.

---

## Second rotation — 2026-08-22, at the case-surface-split Increment-2 build start

Moved **verbatim** out of [PROGRESS.md](../../PROGRESS.md) § Now. Reason, measured rather than felt:
recording Increment 2's pre-work took the live file to **81 417 bytes — 503 bytes** under the gate's
hard 80 KB cap, so the next status write would have reddened `lint:progress` (gate 7). Every bullet
below describes work that **merged and was recorded** days earlier.

⛔ **Checked before the move, because this is the step that has gone wrong here before:** every
follow-up and bug named in these bullets was verified **by name** to hold its own line in § Follow-ups
or § Bug Log **outside** § Now — nine of them — so removing the bullet orphans nothing. A bullet that
is a follow-up's only live trace must not be rotated (QA finding R3).

⚠ The `Imprimir prévia` stub line was **dropped rather than moved**: its bullet is already the first
entry in this file, and re-appending it would have created the second copy this file exists to prevent.

**Link check, as in the first rotation:** the inverse-`cmp` does not apply (two source prefixes
collapse onto two different rewrites), so the property was verified directly — every rewritten link
target resolves from `docs/progress/`.

- **No phase is active.** The **DM program (DM0–DM5) is COMPLETE** — closed 2026-08-18, all five
  gate steps, phase QA APPROVED r2 ([review](../reviews/dm5-phase-review.md)); its follow-up triage
  ruled eleven items and shipped five. ⛔ *The standing-green E2E figure this bullet used to carry
  (the 2026-08-17 run, 1121p/0f) is **SUPERSEDED** — see the 2026-08-20 gate below, which is RED.*
- **✅ CONCLUDED 2026-08-18 — the Cloud constructed-orphan probe.** Cloud exposes **no orphan-visible surface** (all 5 metadata-bound), so the byte half is structurally unverifiable and the runbook’s *asserted, not verified* posture is evidenced; `FUP-DM4-PRODROW` **unblocked**, its "~49 vanished" figure **withdrawn** (§ State). ⛔ Not reassurance — orphan bytes are **unobservable, not absent**. Narrative rotated 2026-08-20 → [cloud-orphan-probe-2026-08-18.md](cloud-orphan-probe-2026-08-18.md).
- **🆕 Six follow-ups from the ADR 0125/0126 build, none of them its subject** — one ✅ RESOLVED
  (`FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE`, ADR 0129 / DSR Slice 1; ⚠ its "blocks C1a/C1b"
  claim was **wrong in grain**). The other five are now **all carried in § Follow-ups** — ⛔ three
  of them had a body but **no index line**, and this bullet was their only live trace (see below).
- **✅ DSR ("Direitos do Titular") — PROGRAM COMPLETE 2026-08-20.** All four slices built,
  QA APPROVED (S3 r2, S4 r3), **PO-approved, §6 steps 1–5 done, merged and pushed.** Narrative
  rotated verbatim → [dsr-program.md](dsr-program.md); slice detail in
  [dsr-slice-3.md](dsr-slice-3.md). Closing gate on a **fresh reset**: pgTAP
  **6717/6717** (203 files) · lint(8) · `tsc` · vitest **1501/1501** · all four authz ARMs HOLD.
  ⛔ **Step 2 (`e2e:prod`) was NOT re-run for the final increment** — last full run was the S3
  gate (only the 2 pre-existing `quality-oversight` failures, BUG-QO-STALE-CASOS); everything
  since is docs + one pgTAP suite + a dialog **no browser test reaches**
  (`BUG-DISPOSE-DIALOG-NO-BROWSER-COVERAGE`). Stated because a gate record naming only what
  passed reads as full coverage.
  ⛔ **Scope narrowed at close** by ADR [0131](../decisions/0131-phi-erasure-reach-bounded-to-designated-fields.md):
  PHI erasure reaches **designated PHI fields only**. Still open, and NOT descoped by it —
  `FUP-CORRECTION-CORRIDOR-COVERAGE-UNMEASURED` · `FUP-DISPOSE-EVENT-DOOR-GATE-BLIND`
  (keystone `352` landed; closes when cited) · `FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES` ·
  `FUP-RESIDUE-NOTICE-RESTS-ON-TRAINING` (PO copy call) · ~~the **Class-2** professional-identity
  question~~ ✅ **RULED 2026-08-21, ADR [0132](../decisions/0132-ethics-proceedings-carry-no-erasure-entitlement.md)**:
  an ethics proceeding carries **no erasure entitlement at any stage** — no door, no UI, and the
  absence is now a decision rather than a gap. ⛔ **Answering it surfaced two PRE-EXISTING doors
  that DO remove ethics-evaluation data** (`FUP-ETHICS-CASE-DELETE-CASCADE` 🔴 ·
  `FUP-ETHICS-RESPONDENT-PIN-FIRES-TOO-LATE` 🟠) — neither from the DSR program, both **PO-ruled
  record-only**, so the lane is *non-erasable by decision with two known open removal paths*, which
  is a worse state than "no path exists" and must not be summarised as closure.
- **✅ DSR OPERATIONAL REMEDIATION — COMPLETE 2026-08-21.** All five §6 gate steps; QA **APPROVED r2**
  ([review](../reviews/dsr-remediation-review.md)); plan
  [dsr-operational-remediation.md](../plans/dsr-operational-remediation.md); ledger row in
  [phase-ledger.md](phase-ledger.md). ✅ **MERGED to `main` and PUSHED 2026-08-21** — fast-forward,
  `main` = `origin/main` = `96c49da4`, tree clean, lint 8/8 + `tsc` green **on `main`**. `db push` applied
  all 14 pending migrations to the linked project (head `20261003000300`, `dsr` flag **ON**, invariant
  re-derived **on the remote**: 3 setters / 5 readers). ⚠ The branch
  `feat/dsr-operational-remediation` still exists locally and on origin — not deleted.
  ⛔ **What it fixed:** the DSR program closed green on 2026-08-20 and **its LGPD erasure doors did not
  erase** — a child lock raised ~10 statements after the Class-1 DELETE, rolling the whole RPC back.
  **10 statements across 4 guards** (filed as 9/3); PO ruled **FIX THE GUARDS**, rollback under ADR 0131
  D4(b) **declined**. Plus: the dead `notify_scrub_check` gate that blocked every granted close, the
  console's nav reachability, the ADR 0131 helper-text control, the column doors' first operator
  procedure, and drift pin `355`.
  ⛔ **Still open by PO ruling, not by omission** — `FUP-DSR-OUTCOME-RECORD-HAS-NO-DELIVERY` (the
  workflow's one promise to the data subject has no mechanism) and **Class-2** professional-identity
  erasure. Six residuals filed with their bounds named, incl. one **accepted with no mechanism**
  (`FUP-EXIT-CODE-MASKING-HAS-NO-MECHANISM`).

---

## Third rotation — 2026-08-22, concluded material inside live bullets

Two pieces of **concluded narrative that were sitting inside otherwise-live entries**, moved so the live
half stays readable. Trigger, stated honestly: PROGRESS.md was at **69 bytes** under the hard cap and two
new entries (a bug and an instrument finding) had to be filed.

⛔ **Neither move takes anything actionable with it.** C1a itself is still **UN-RUN** and stays in § Now;
what moved is the 2026-08-19 correction explaining that a defect once recorded as blocking it did not.
The migration-hold entry was **RESOLVED** on 2026-08-18; its one still-live instruction — *re-measure
`schema_migrations`, never re-read a recorded figure* — was **kept in § Now**, because that claim has gone
stale five times and it is the reason the entry existed.

### The C1a correction (2026-08-19), rotated from inside the "▶ Next, in order" item

     ⭐ **CORRECTION (2026-08-19, measured):** `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE` was
     recorded as **blocking C1a/C1b**. It did not. C1a is *a run of this runbook*, and the runbook
     is the **`file_objects` / Storage-bytes** completion mechanism (§ 0: it exists because
     `complete_document_disposal` has no automated caller). The two paths are **disjoint** in the
     catalog: `dispose_meeting_minutes` writes **no** `file_objects` row and never sets
     `disposal_pending`; `complete_document_disposal` never touches meetings; the runbook contains
     **zero** occurrences of "meeting", "minutes_md" or `dispose_meeting_minutes`. The child-lock
     defect was real and is **fixed** (ADR [0129](../decisions/0129-meeting-child-lock-disposal-flag.md),
     DSR Slice 1) — it blocked **meeting-minutes erasure**, not this rehearsal. *A real defect was
     cited for a conclusion it did not bound, and the error ran in the reassuring direction: it made
     C1a look blocked-then-released rather than simply never started.*

### The migration-hold resolution (2026-08-18)

- **✅ RESOLVED 2026-08-18 — the migration hold is discharged and the remote is CURRENT.**
  Remote head **`20260928000900`** / **415** applied (verified post-push). `…000600`/`…000700`
  turned out to be on the remote already — the "HELD" line was **stale**, the third time that
  claim has gone stale — and `…000800`/`…000900` were pushed on PO instruction. **0 local-only
  migrations.** ⛔ Re-measure `schema_migrations`; never re-read a sentence about it.

## ↩ Rotated from PROGRESS.md § Now 2026-08-23 — size discipline (79,876 B of an 80,000 B cap)

_Fully concluded: `DANGLING-PRINT` and its third defect are both CLOSED. Kept verbatim; it was fact #2
of the "three facts a session must not trip over" block._

  2. `DANGLING-PRINT` is **CLOSED** (ADR
     [0123](../decisions/0123-discarding-a-draft-that-has-emitted-documents.md));
     a third defect found during closure is now ✅ **CLOSED**
     (`FUP-DM5-DRAFT-PRINT-INVISIBLE-TO-COORDINATION`, resolved 2026-08-19) — and it closed
     by **removing the subject**, not by widening a predicate: under ADR
     [0126](../decisions/0126-print-series-and-derived-currency.md) **D5** a draft no
     longer registers at all (`HC0DP`, DB-enforced), so there is no draft print to be
     invisible. Registration derives from the **lock point**: still-editable ⇒ ephemeral
     prévia; locked ⇒ registered — for meetings that turns at `in_signature`, which
     registers **stamped RASCUNHO**, watermark predicate unchanged.
     ⚠ **HC069 is genuinely unreachable now**, so `312` §9/§10 were rebuilt **table-level**
     with the t76/t80 differentials preserved (a rebuild that dropped them would be equally
     satisfied by a guard refusing every delete).

## Rotated 2026-08-23 at the AFF2 Record step — the § Now build-start bullet

_Verbatim. AFF2 completed its §6 gate the same day it started: PO-approved 2026-08-23, ledger row **AFF2**, detail in [aff2.md](aff2.md). ⛔ What stayed in § Now is the part that is still **live state** — the branch is **unmerged and unpushed**, and 3 migrations exist only locally._

- **▶ IN PROGRESS 2026-08-23 — workstream AFF2 (affiliation-scoped administration +
  user-management redesign): BUILD STARTED on `feat/aff2-user-management`.** Hospital admins gain
  person-level + lifecycle authority over sole-footprint people; CPF-mandatory 3-step
  register wizard (escape hatch removed); the three UM screens rebuilt to the design
  handoff. ADR [0133](../decisions/0133-aff2-affiliation-scoped-administration-um-redesign.md)
  (renumbered from 0129 at the 2026-08-21 reconciliation — main's DSR track had taken
  0129) **+ Amdt 1** (2026-08-21 — capability-split widening, § Decisions) · plan
  [aff2-user-management.md](../plans/aff2-user-management.md). **Both start
  conditions are now DISCHARGED** — `chore/small-optimizations` merged at `df88dced` (in `main`'s
  history), and the PO gave the explicit build go 2026-08-23.
  ⭐ **Five plan premises were re-measured at build start, and TWO of them were STALE** — the
  plan is authority for *intent*, never for *facts about the stack*:
  1. ⛔ **B3's `extensions.citext` instruction is WRONG for this door.** Measured in the catalog:
     `list_org_people(p_org_id uuid, p_search text, p_cpf text)` — **one** overload, all three args
     `pg_catalog.text`, **no `citext` anywhere**. Following the plan literally would `CREATE` a
     **second overload** beside the door instead of replacing it, leaving an ungranted, un-audited
     twin that PostgREST could resolve to. The citext lesson is real; it belongs to a *different* door.
  2. ⚠ **B3 cannot use `CREATE OR REPLACE` at all.** Adding `date_of_birth` changes the RETURN
     TYPE (`TABLE(user_id, full_name, email, professional_category, is_active, affiliations)`), which
     `CREATE OR REPLACE` **refuses**. It must be `DROP` + `CREATE` — and a DROP resets `proacl` to
     **NULL, which means PUBLIC**, the recorded fail-open default. The current ACL
     (`postgres`/`service_role`/`authenticated` = `X`) must be re-GRANTed and then **re-measured from
     the catalog**, not assumed. This also arms `FUP-SIGNATURE-STRING-CALLERS-ABORT-ON-A-DROP-CREATE`.
  3. **Migrations number from `20261003001000`** — the plan's "after `20261003000300`" is stale;
     local **and** remote are both **441 / `20261003000900`** (measured, not read).
  4. ✅ **Three premises HELD exactly:** `profiles` has neither `date_of_birth` nor `phone`;
     `guard_profile_privileged_columns()` exists (SECURITY DEFINER); `professional_credentials_select`
     carries exactly the three legs B2 widens (self / `app.is_admin()` / org_admin-of-home-org) and is
     the table's **only** policy. Code anchors hold too: `authorizeOrgAdminForUser` defined at
     `actions.ts:323` with **six** call sites (773, 839, 903, 1018, 1035, 1059).
  5. ✅ **The `e2e:prod` baseline pin is SATISFIED without a new run** — the plan asks for a pinned
     failing set "on the day AFF2 starts"; the 2026-08-23 run at `d885f621` **is** that pin, and every
     commit since is docs-only (`PROGRESS.md`, `docs/progress/*`), so it holds at HEAD. ⛔ The plan's
     risk bullet naming **BUG-QO-STALE-CASOS** as the thing to resolve first is **stale — it was
     RESOLVED 2026-08-21**; the live baseline residue is
     `FUP-RETRY-CHANGES-THE-FAILURE-MODE-ON-NON-IDEMPOTENT-TESTS` instead.
  **FUP-AFF2-CONTA is registered** (index + body) — the plan's build-start requirement, discharged.
  **Track task detail → [aff2.md](aff2.md)** (per-track sections, teammate-owned).


## Rotated 2026-08-24 at the ADR 0137 Record step — four concluded § Now bullets

_Verbatim, links repointed for this directory (9 of 9 resolve; the inverse-`cmp` caveat at the head
of this file applies here too — two source prefixes collapse onto one). PROGRESS.md stood at
79,174 B of an 80,000 B cap when this cut was made: **3.4 % headroom**._

⛔ **What did NOT rotate, verified by name before the cut:** every follow-up these bullets cite holds
its own line in PROGRESS.md § Follow-ups — `FUP-CS2-QA-RESIDUE`, `FUP-RESET-ROLE`,
`FUP-RETRY-CHANGES-THE-FAILURE-MODE-ON-NON-IDEMPOTENT-TESTS`,
`FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES`. The two standing prohibitions these bullets carried have a
**different** home, because an archive is not loaded and a rule with no resolution event can only
accumulate in the tracker: [`.claude/rules/live-facts-measure-dont-quote.md`](../../.claude/rules/live-facts-measure-dont-quote.md).

⭐ **One premise died between the writing and the cut, and it is the reason the case-split bullet
could go at all:** its item 1 said *"`e2e:prod` is RED and §6 step 2 is NOT satisfied"*. The ADR 0137
batch then ran a **full `e2e:prod` gate GREEN, exit 0 — 1221 p / 0 f** on 2026-08-24, which
post-dates that red. The bullet is rotated as written; the **current** e2e state is stated live in
§ Now, and it is neither this red nor that green: the last full gate was green at `1320d0b0`, and
the two residue increments after it are uncovered.

### The AFF2 bullet

- **✅ AFF2 — COMPLETE, PO-APPROVED, MERGED (`96acec61`, `--no-ff`) and PUSHED 2026-08-23** — schema
  first, then code, both **re-measured rather than accepted on report**. Rotated out of § Now
  2026-08-23; full record → ledger row **AFF2** + [aff2.md](aff2.md).
  ⭐ **One lesson kept here because its subject is THIS file: a commit count and a head sha are LIVE
  FACTS** — `git rev-list --count origin/main..main`, never quoted from here. This bullet once read
  *"39 commits, head `ed125b93`"* and was **already wrong when committed**: the Record commit that
  wrote it was itself commit 40. A count written inside the commit it counts is off by one **by
  construction**.

### The case-surface-split bullet

- **✅ CASE SURFACE SPLIT — COMPLETE (Inc 1+2), MERGED and PUSHED 2026-08-23** (ADR 0134 D1–D7 + Amdt 1–8),
  schema first then code. Compacted in § Now 2026-08-23 — completed-run detail (commit shas, gate counts,
  push ranges) is in the **ledger row** + [inc-1](case-surface-split-increment-1.md) ·
  [inc-2](case-surface-split-increment-2.md) ·
  [assertion-integrity](case-split-assertion-integrity.md). ⛔ Re-measure remote figures
  from § State — never quote a push OUTCOME as the remote's current state.
  ⛔ **What is still LIVE, and the only reason this bullet remains:**
  1. **`e2e:prod` is RED and §6 step 2 is NOT satisfied.** Its 2 failures were retry artifacts on
     non-idempotent tests (GREEN re-run alone) — filed `FUP-RETRY-CHANGES-THE-FAILURE-MODE-ON-NON-IDEMPOTENT-TESTS`.
     ⭕ The PO's 2026-08-23 qualification covers a **test-quality** failure only, and was extended once to a
     *proven-transient infra crash in an untouched file*. ⛔ **RED is still RED — a triage note is never
     licence to accept a red gate.**
  2. **Residue is smaller, not gone** — `FUP-CS2-QA-RESIDUE` **12 → 6**; `FUP-RESET-ROLE`'s **134-file
     sweep OPEN**; ADR [0135](../decisions/0135-authored-refusals-get-their-own-sqlstate.md) **ruled and
     DEFERRED, not built**; B3 filed **two new residues**.

### The rotation inventory carried by the "NO PHASE IS ACTIVE" bullet

_The status line itself stays live in § Now; what moved is the record of which five bullets rotated where, which is a completed rotation describing this file._

- **⚠ NO PHASE IS ACTIVE.** The case-surface-split program above is the most recent, and it is complete.
  Everything else that stood here is done: the **DM program (DM0–DM5)** closed 2026-08-18 (QA APPROVED
  r2), the **DSR** program closed 2026-08-20 and its **operational remediation** 2026-08-21 (both merged
  **and pushed**), and the Cloud constructed-orphan probe concluded 2026-08-18. All five bullets rotated
  **verbatim** 2026-08-22 → [now-concluded-2026-08.md](now-concluded-2026-08.md), which is
  also where the `Imprimir prévia` / `Emitir documento` split already sat. ⛔ **Their open residue did NOT
  rotate** — every follow-up and bug those bullets named was verified by name to hold its own line in
  § Follow-ups / § Bug Log first. ⛔ **Two things there must not be read as closure:** `e2e:prod` was
  **never re-run** for the DSR final increment (last full run was the S3 gate), and the ethics lane is
  *non-erasable by decision with two known open removal paths* — a worse state than "no path exists".

### The documentation-stability-refactor bullet

_A pointer to a pointer: the narrative rotated here 2026-08-21, and this line was what remained in § Now._

- **✅ SHIPPED 2026-08-19 — the documentation-stability refactor** (ADR [0127](../decisions/0127-standing-rules-home-and-staleness-gate.md); ADR [0124](../decisions/0124-progress-live-state-contract.md) Amdt 1): standing rules moved to `.claude/rules/`, `lint:rules` is gate 8, and rules were **measured to fire**. Bullet rotated verbatim 2026-08-21 → [now-concluded-2026-08.md](now-concluded-2026-08.md), which keeps the four filed-not-built items and the ⛔ premise-was-false note.
