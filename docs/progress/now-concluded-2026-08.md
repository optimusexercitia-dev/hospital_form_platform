# § Now — concluded bullets, rotated 2026-08-21

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
