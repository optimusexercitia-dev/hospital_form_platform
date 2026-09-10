# Lead Playbook — orchestration protocol (lead only)

Extracted from CLAUDE.md so the **single lead/orchestrator session** reads it once and
teammates don't carry it in every spawn. Teammates receive task-specific prompts and
never execute this protocol. See CLAUDE.md §4 (Agent Team), §6 (Phase Gate), §7
(Progress Tracking) for the shared parts.

## 1. Team lifecycle

- **Keep `frontend` and `backend` warm across phases.** Spawn each **once** (their first
  phase) and **reuse** the same teammate later with a new task-specific prompt — they
  retain the ARCHITECTURE + codebase context they built, which removes the per-phase
  re-read and shrinks the "lead notes" you write. Teammates do **not** share your
  conversation, so each phase's prompt must still include that phase's context, file
  paths, and acceptance criteria — but they already hold ARCHITECTURE.md and the code
  they wrote. Spawn a **fresh** teammate only if one is genuinely stuck or
  context-poisoned.
- Spawn `tester` only when the phase's features are implemented and the dev server runs.
  Spawn `qa` only after the tester reports green.
- **Keep the team warm between phases; do the full cleanup at PROJECT end** (or when a
  teammate is genuinely done). The **lead** runs cleanup, never a teammate. Spinning the
  team down each phase only to rebuild it throws away context you then pay to re-inject.

**The delegation floor, measured.** 2026-08-24: a session that skipped CLAUDE.md §4's floor
(spawn Explore before reading more than ~3 files to answer one question) climbed 79k → 489k
tokens by accumulation of small reads and loop chatter, with no single big read. The floor is
cheap; the alternative is not.

## 2. Sequencing & task breakdown

- **Contract-first.** At phase start, have `backend` post the typed query/action
  **signatures** `frontend` depends on (typed stubs in `src/lib/queries/**` and the
  relevant `actions.ts`) **before** implementing them, so `frontend` builds against real
  types in parallel instead of inventing a provisional shape that later mismatches (this
  caused rework in Phase 6). Backend then fills in the implementations.
- Break each phase into **5–6 tasks per teammate**; mark dependencies (e.g., the
  frontend form-builder task depends on the backend versioning-API task).
  ⛔ **Teammates cannot see a shared task list** — `TaskList`/`TaskGet`/`TaskUpdate`
  do not resolve in a teammate's tool environment (measured 2026-08-18 by `backend`
  and `frontend` independently). **Relay each task verbatim in the spawn prompt or
  by `SendMessage`**, acceptance criteria included; a teammate that has to
  reconstruct criteria from the ADRs will get them wrong, because criteria that came
  out of *your* planning are not in the ADR. Teammates reach the lead as **`main`**,
  not `team-lead`.
- Enforce file ownership (CLAUDE.md §4): two teammates never edit the same file in a
  phase; shared types change only via `backend`.

## 3. Plan-approval right-sizing

Require plan approval for `backend` on any task touching **migrations or RLS**, and for
`frontend` on any task introducing a **new page/route group** — but right-size it:

- **One-line plan + your ack** for work that follows an already-approved pattern: a
  routine additive migration, a new RPC mirroring an existing one, a flag flip, a
  standard coordinator-gated route group.
- **Full plan review** for **novel or security-sensitive** work: a new RLS *shape*, a
  `SECURITY DEFINER` read path, a service-role route handler, anything touching the
  condition evaluator or the immutability triggers, or a genuinely new UI pattern.
- **Reject** any plan (fast-tracked or full) that lacks a testing note or violates file
  ownership.

## 4. Phase Gate — Record step (§6 step 5) mechanics

When a phase passes human approval, the lead:

1. Writes the phase's final row (date, commit hash, gate headlines, review link) and
   **appends it to `docs/progress/phase-ledger.md`** — the row does NOT stay in
   PROGRESS.md (`lint:progress` reds on a completed row there).
2. **Moves everything the phase concluded out of PROGRESS.md in the same edit** (§5
   below): task detail — to its archive, leaving a pointer only where a live item
   still references it; a closed bug — flip its `docs/bugs/BUGS.md` status cell in
   place, no rotation and no archive file (ADR 0185 D3). In the same pass, resolved
   follow-up **entries** move `docs/followups/follow-ups-open.md` →
   `docs/followups/follow-ups-archive.md` (they no longer pass through PROGRESS.md at
   all — ADR [0179](./decisions/0179-follow-up-register-consolidation.md)).
3. Archives the phase's task detail to `docs/progress/phase-N.md` (or a feature-named
   file).
4. Updates `docs/backend-state/` (the ONE seam file its README routes you to -- never a new file)
   **if the backend surface changed — OR if the phase RULED on that seam's subject without changing
   it** (widened 2026-09-10, PO ruling at the CLAUDE.md review-queue pass; ⚠ this step read *"if the
   backend surface changed"* alone, which `CLAUDE.md` §7's unconditional *"a new phase APPENDS its
   slice"* contradicted). ⭐ **A decision-only phase changes what the projection should SAY even with
   zero DDL** — and the justification is measured, not theoretical: pre-AE5 Batch 9 changed **no**
   surface (empty pathspec, no migration) and refreshing this layer is what surfaced **two false
   statements** already sitting in it — a `hardDenyClasses` claim contradicted at **3 of 43** rows,
   and a follow-up id present in **neither** register. ⛔ Neither had any gate: gate 13's
   retired-citation scan covers retired **files**, not follow-up **ids** inside seam files.
   — **TWO edits to that one file, not one** (ADR 0198): **append**
   the slice at the bottom, **REPLACE** the `## Current state` block at the top and re-stamp its
   `**Updated:**` date. Gate 16 check I reds if a heading below is newer than the stamp above. How:
   `node scripts/check-backend-state.mjs --scaffold` prints the form;
   `docs/backend-state/README.md` § Writing and refreshing a current-state block is the procedure,
   including the four rules no gate can enforce.
5. **If the phase produced or amended an ADR** — runs `npm run adr:index`. That regenerates
   `docs/decisions/INDEX.md` **and** the `<!-- adr-backpointers -->` banner inside every
   amended ADR, so the row and the back-pointer both take care of themselves. The one thing
   left to *check* by eye: if the new ADR changed an earlier one, its header block must carry
   a `**Supersedes:**` / `**Amends:**` label naming that ADR's number. Without the label there
   is no edge, so the earlier ADR gains no banner and a future session reads a superseded rule
   with nothing in the file able to contradict it. **⚠ Voice matters** — `**Amends:**` is a
   claim about another ADR; `**Amended:**` records that *this* one was changed and is
   deliberately not an edge. Measured 2026-08-24 across 136 ADRs: 42 source→target pairs over
   30 amended ADRs, of which only **5** had a back-pointer anyone had written by hand.
   `npm run lint:adr-index` (gate 9) catches a missing row, a stale banner, or a duplicate
   number; **nothing can catch a missing label** — this step is the only place it is checked.
6. Runs `npm run lint:progress` (it verifies the contract mechanically) and commits
   with `phase(N): complete — <summary>`. The team stays warm for the next phase.
7. Checks `.claude/claude-md-review-queue.md` — if it is non-empty, run
   `/review-claude-md` (or schedule it with the human) before the next phase opens.
8. ⭐ **RECONCILES RULINGS TAKEN AGAINST RULINGS LANDED IN THE ARTEFACT** (added 2026-09-10 at
   pre-AE5 Batch 9, which had no such step and paid **two QA BLOCKs** for it). For every PO ruling
   the phase took, name the **non-log artefact** that now carries it — an ADR decision, a register
   clause, a gate, a migration. ⛔ **A ruling recorded in the progress log is NOT a ruling landed in
   the corpus.** Batch 9 recorded rulings R11 and R12, the lead stated in writing that it was
   sending them to the drafting turn, and did not; the ADRs then asserted the **opposite** — 0203
   still read *"D3 is `PO to rule`"* inside the very commit whose message named R11 — and one of the
   documents still denying a ruling was the batch's own **hand-off routing** for the next batch.
   ⚠ Cheap check: `grep -n "R[0-9]\+" docs/decisions/<the phase's ADRs>` returning **no matches**
   is the smell.
9. ⚠ **A follow-up carries its clause in TWO places** — the register entry **and** the body file's
   own `**Closes when:**` field. Correcting one is **not** correcting the item, and the body is what
   a reader reaches from a citation. Batch 9 widened the entry and appended a correction *section*
   to the body while leaving the body's **field** naming one site of three.
10. ⛔ **NAME SETS; DO NOT SIZE THEM.** Three counts went wrong in Batch 9 the same way — *"eight
   candidate files"* over nine names, *"exactly two qualify"*, and *"four discharged inline"* over
   five — and the third **dropped a finding out of the Record list entirely**. A count is a claim a
   single counter-example kills, and a list is not. ⚠ Where a set was dispatched two different ways
   (some filed, some discharged inline), ⛔ **no single number describes it** — say both halves.
12. ⛔ **A REVIEW FINDING YOU RELAY IS YOURS THE MOMENT YOU ACT ON IT** (added 2026-09-10, LEARN-099;
   the enforcer that named this file did not yet carry the rule — found at the documentation second
   pass). A claim is **not** made safer by being attributed to someone else. Batch 9 twice passed a
   reviewer's words through as measured: *"the watching relation is INVERTED"* went into a build brief
   (the direction actually matched the tree — only the attribution was wrong), and *"all 12 anchors
   verified byte-for-byte"* was credited to a report containing **neither** that count nor that
   phrase. ⭐ The symmetry is the lesson: **the reviewer's own anchors for its blocking finding were
   also miscited** — quoted text verbatim right, pointers wrong. ⇒ **a LOCATION is a measurement, from
   any role including the reviewer**: `sed -n` it before you repeat it, and ⚠ a `grep` is not enough
   either — a sentence split across a SQL string concatenation is invisible to a whole-sentence search.

11. ⭐ **THE HUB'S `## Current state` IS THE LAST EDIT OF A ROUND, NOT AN EARLY ONE.** Step 4 (human
   approval) reads it. Batch 9's block went stale **twice inside one fix loop** — written before the
   round's final commit, so it asserted two blockers open that were already discharged at that tip.
   ⚠ It is `replace, never append`, capped at **60 lines**, and gate 13 reds on both — cut a
   **paraphrase** and point at the record, ⛔ never a bound.
   The Record step is the queue's trigger: a cadence with no trigger is the
   "standing in prose alone" failure ADR 0079 documents.

⛔ **WHILE ANY AGENT HOLDS THE TREE, STAGE BY PATH — NEVER `git add -A`** (added 2026-09-10,
LEARN-097; QA MINOR-2 at pre-AE5 Batch 9). The lead and its teammates share **one** working tree and
the race runs **both** ways, but only one direction was ever guarded:

| direction | what happens | guarded before this line? |
| --- | --- | --- |
| agent → lead | a build agent's `git stash` / failed pop **reverts** the lead's uncommitted docs | ✅ every rulings file forbids tree-mutating git commands |
| ⛔ lead → agent | the lead's **`git add -A`** commits an agent's **in-flight** work — unreviewed, and undescribed by its own commit message | ❌ **no** |

**Measured:** commit `354fd6b0`, message *"docs(batch9): PO R13/R14; playbook line, two lessons, one
new rule"*, contains **seven** files — the four it describes **plus three harness files at +8 lines
each**. The lead had written the outward-facing prohibition itself one turn earlier, then committed
its mirror. ⇒ `git add -A`, `git add .` and `git commit -a` are **forbidden while a subagent is
running**; stage the paths this turn wrote, and ⭐ **read `git status --short` before every commit,
reconciling it against what you believe you changed — a line you cannot account for is someone
else's work, not a stray.** ⚠ If an agent's work is already committed under the wrong message, ⛔ do
**not** amend once the sha has been reported to anyone: correct it in the unit record and in the next
commit message, the way this repo corrects everything else.

**Gate step-1 note (authz sweeps):** derive the case list with
`scripts/door-sweep-cases.sh <phase-base>` — never by hand, and never from the old prose
one-liner (ADR 0079 § The recipe; exit 1 means *migrations touched, zero gates derived*,
which is an obligation to rule on, not a pass).

⛔ **READ THE DERIVER'S EXIT CODE BEFORE YOU SUBSTITUTE ITS STDOUT.** ⛔ Never
`CASES="$(bash scripts/door-sweep-cases.sh <base>)" bash <sweep>` in one breath: command
substitution **discards the exit code that IS the claim**, and on the exit-1 FINDING the deriver
correctly prints **no case list** — so `CASES` becomes the empty string. Two steps, always:

```sh
CASELIST="$(bash scripts/door-sweep-cases.sh <phase-base>)"; rc=$?   # ⛔ rc read BARE, no pipe
case $rc in
  0) CASES="$CASELIST" bash supabase/tests/mutation/p0-authz-door-audit.sh ;;  # sweep the list
  1) : ;;   # FINDING — doors derived but none sweepable here. RULE on it; do NOT sweep.
  2) : ;;   # ABORT   — the deriver could not run. Fix it; a missing list is not an empty one.
  3) : ;;   # NOT-APPLICABLE — no migration in the diff.
esac
```

Since 2026-09-08 an empty `CASES` is refused rather than silently widened: all four sweeps read
`CASES` on **set-ness**, so `CASES=""` is *a selection that came back empty* and exits **3
UNPROVEN**. That converts the old silent full sweep into a loud stop — it does **not** make the
one-liner safe, because a run that exits 3 has still measured nothing. ⛔ **Do NOT `git checkout --` the findings
file afterwards** — that instruction is retired (ADR 0153): a subset run now writes to
scratch under `$WORK` and never opens the committed baseline for write. Verify by
**measurement**, which stays right whether or not the guard is ever reverted:
`git diff --stat -- docs/reviews/authz-door-audit-findings.md` — empty means untouched.
⚠ On a **FULL** run (no `CASES=`/`SUITE=`), since ADR 0190 the harness legitimately rewrites
the committed baseline through a MERGE that preserves hand-authored lines — so an empty diff
there must be read **together with the harness exit code**: `RESULT: ERROR` / exit 2 means the
merge aborted and wrote nothing, which also leaves the diff empty (QA F-MAJOR-5, DOOR-SWEEP-DERIVER).

**Since DOOR-SWEEP-DERIVER (ADR 0190, 2026-09-05), two more step-1 obligations:**
- **Quote the deriver's `SCOPE:` line verbatim into the gate record** — file counts by
  provenance (committed-range · worktree · untracked), the filter, and the
  `derivation:` mode (`catalog` vs `PROVISIONAL (no catalog)`). It is printed on **every** exit
  (0/1/2/3); a record that says "N cases derived" without it cannot attribute the sweep to an
  increment, and a `PROVISIONAL` derivation is text heuristics, not a property (LEARN: a
  hand-widened list is otherwise indistinguishable from a derived one). Exit 1 now names its
  sub-case — *no doors at all* / *doors identified, none sweepable by this arm* / *rewrite
  targets unreadable*; the second one lists the doors that owe a **targeted** case and must not
  be put in `CASES=` (ADR 0079 hazard 4).
- **Run `SELFTEST=1 bash scripts/door-sweep-cases.sh` beside the four authz arms** and record
  `PASS · FAIL · SKIPPED` with the bare exit code, **plus the three `--- GROUP …` lines the
  harness prints** — deriver · merge helper · audit startup capture. ⛔ **Do not restate the
  per-group scenario counts here.** This line used to read *"the deriver's 16 scenarios and the
  merge helper's 18"*, and adding the third group on 2026-09-08 made it stale the same day —
  which is exactly `FUP-WRITEPATH-BASELINE-HARDCODED-COUNTS-IN-HARNESS-BANNERS`, and re-typing a
  corrected literal would be the same defect with a newer number. The counts are now **derived**
  by the harness from the scenarios that actually ran; quote what it printed. It is deliberately
  **not** in `npm run lint` (it needs a fake repo and, for catalog scenarios, the stack); a
  `SKIPPED > 0` result over catalog scenarios is a stack-down run, not a pass.
  - ⭐ **QUOTE THE `bash --version` THAT PRODUCED THE SELFTEST RESULT** (added 2026-09-10, PO ruling
    R14 at pre-AE5 Batch 9). ⛔ **This step's verdict is SHELL-DEPENDENT and nothing else says so.**
    Measured: `/bin/bash` on macOS is **3.2.57**, whose `$( … )` parser closes the substitution at
    the `)` in a `case` **pattern** — which broke one assertion row in three of the four audit
    harnesses and returned `PASS 40 · FAIL 6`, while the *same commit* returns `33/33 ok` under a
    bash ≥ 4. Two earlier unit records quote `SELFTEST TOTAL: 33/33 ok, 0 failed` as a witness and
    ⛔ **both were TRUE where they ran** — they are **not** back-edited. ⇒ a SELFTEST figure without
    its shell is uninterpretable: a reader on macOS reproducing a quoted `33/33` sees a regression
    that is not one, and a reader on Linux calls a macOS red unreproducible. ⚠ The parse defect
    itself was fixed at Batch 9; **this line survives the fix**, because the class is *a gate whose
    verdict depends on the operator's machine*, not that one row.
- ⛔ **A parent script asking a sweep for a FULL run writes `unset CASES && bash <sweep>`, never
  `CASES= bash <sweep>`** (2026-09-08). `VAR= cmd` sets `VAR` to the **empty string** in the
  child, and all four sweeps now read `CASES` on **set-ness**: an empty string is the third
  state — *a selection that came back empty* — which selects nothing and exits **3 UNPROVEN**.
  ⭐ `CASES=` was introduced in `p0-authz-invariant.sh` as a **defence** against an exported
  `CASES` narrowing a child into a silent subset; re-predicating the children inverted the
  parent's failure mode, and the defence became the defect.

**Since PRED-DOMAIN (ADR 0191, 2026-09-07), two more:**
- **Set-valued authz resolvers** — `bash supabase/tests/mutation/authz-setvalued-targeted-cases.sh`
  (detached, ~10 min, exit code read BARE: 0 CLEAN / 1 DIRTY / 2 ABORT / 3 UNPROVEN) is owed at
  **every phase gate that runs the door sweep**, and additionally whenever a migration creates or
  replaces a `prosecdef` `SETOF uuid` function in `app`/`public`/`authz` — the door arm cannot
  select that family at all (ADR 0191 D3; ADR 0079 hazard 4), and the harness's own §4b
  cardinality control reds if a sixth such function appears. Quote its `ARM-DOMAIN setvalued=`
  line, never the script name.
- **`NOTICED` is a fourth door-sweep outcome and it is EVIDENCE, not a verdict** (PO ruling
  2026-09-07, ADR 0191): the mutated suite FAILED — something noticed — but a domain file aborted
  before finishing its plan (a value assertion whose subject raises, LEARN-083), so the harness
  cannot say *which* assertion noticed. The RESULT line names the three classes apart — `BLIND
  (blocks)` · `NOTICED (disclosed, non-blocking)` · `ERROR (not a pass)`; a run with 0 BLIND, 0
  ERROR and >0 NOTICED exits 0 **with the disclosure printed**. A gate record quotes the NOTICED
  count and the `DOMAIN-STATEMENT` block beside the arm figures; ⛔ NOTICED is never written as
  COVERED, and its remedy is capture-then-assert in the aborting file
  (`FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE`'s work-list), never a relabel.

## 5. PROGRESS.md rotation & archive discipline

**PROGRESS.md is live state only, and the contract is machine-enforced** —
`npm run lint:progress` (`scripts/check-progress-doc.mjs`, gate 7 of `npm run lint`)
reds on: the file over its **30 KB hard cap** (and *warns*, non-fatally, once it passes
the **20 KB target** — rotate then, not at the cap; ADR 0185 D6), a `✅ complete` row in
§ Phase Status, a broken relative link, a missing required section, or CRLF — **plus
the register checks (ADR 0179):** a RESOLVED entry still sitting in
`follow-ups-open.md`, a duplicate follow-up id, an id held by both that register and
`follow-ups-archive.md`; the old `deferred-backlog.md` cross-check retired with the
file (ADR 0186 D4) — a parked entry now lives in the same register, caught by the
ordinary duplicate-id check.
`npm run lint:registers` (gate 13)'s RETIRED arm separately reds on a **citation** of a
section ADR 0185 D6 cut out of this file — `§ Now`, `§ Bug Log`, `§ Critical FUP`,
`§ Test Run Summary`, `§ QA Verdicts`, or PROGRESS.md's former Decisions/Follow-ups
sections — appearing in any living file outside `docs/progress/`, `docs/decisions/`,
`docs/reviews/`. None of those sections come back by rotating INTO them — they no
longer exist here, so there is nothing left to keep small. At the Record step, move:

- **Phase row** → `docs/progress/phase-ledger.md`, **verbatim** (append-only; rows
  never leave *there*). Byte-compare the moved row before deleting the live one.
- **Phase task detail + per-phase notes** → `docs/progress/phase-N.md` (or a
  feature-named file); leave a one-line pointer only if a live item references it.
- **A completed hub** → `status: complete`; append its `## Current state` block, as a
  dated `### YYYY-MM-DD` entry under `## Session log`, into its progress record
  (`docs/progress/<code>.md`, ADR 0186 D3), then delete the block from the hub —
  `complete` FORBIDS it (gate 13 HUBS arm). Run `npm run features:index`.
- **A closed bug** → flip the status cell in `docs/bugs/BUGS.md` in place, in the same
  commit. No rotation, no archive file, ever (ADR 0185 D3).
- **A resolved follow-up entry** → move it, verbatim, from
  `docs/followups/follow-ups-open.md` to `docs/followups/follow-ups-archive.md`. A
  **parked** one gets `**Status:** parked` + **Revisit when**, in place — it stays in
  `follow-ups-open.md` (ADR 0186 D4). The register has
  **no size cap**, so length is never a reason to compress or drop an open item. The
  pinned ⭐⭐ Critical list lives at the top of the open register — never in
  PROGRESS.md.
- **ADR numbering** → number it per CLAUDE.md §8 (highest number on ANY live branch +
  1; gate 9 catches a duplicate at rebase), never the index's next-free alone.
  `docs/decisions/INDEX.md` is **generated** navigation over the ADR corpus — never a
  rotation destination, never edited by hand.
- **The branch's handoff** → deleted. Nothing rotates out of it: any witness worth
  keeping already lives in the progress record's `## Session log`, written as the
  session ran (ADR 0186 D3), not cut in at the end.

**Rotation mechanics that have failed before, now standing rules:** move content by
extracting the original bytes (sed/script), never by retyping; byte-compare (`cmp`)
at the destination before cutting the source; when a file moves into `docs/progress/`,
rewrite link prefixes mechanically (`](docs/progress/` → `](`, `](docs/X/` → `](../X/`)
and verify the inverse transform reproduces the original — a verbatim move 404s every
relative link (474 measured, FUP-ROTATION-BREAKS-LINKS); verify every index entry HAS
a body before compressing anything; derive what rotates by the PROPERTY (is it
CLOSED?), never by markup or hand-listing.

Archive files under `docs/progress/` are append-only and never loaded by spawns — detail
goes there to stay out of every teammate's context. The durable map of what the backend
already provides lives in **`docs/backend-state/` (the ONE seam file its README routes you to -- never a new file)** (the lead keeps it current) so
per-phase lead notes reference it instead of re-deriving it each phase.

## 6. graphify refresh (lead-only)

Refresh the graph **once per phase, after the phase merges to `main`, in its own
`chore(graphify):` commit** — never after each change, never on a side branch.
`graphify update .` is AST-only (no API cost) but rebuilds the **whole** graph: a
one-function fix once produced a **12,729-line** diff in `graphify-out/`. With parallel
sessions the norm here (`docs/worktrees.md`), a side-branch refresh is a near-certain
conflict in a generated file nobody can meaningfully review or resolve — which is why
the regeneration never rides along with reviewable code, and why teammates are told
never to run it (CLAUDE.md, graphify section).
