# ADR 0127 — standing rules get a path-scoped home, and a staleness gate

- **Status:** accepted (PO, 2026-08-19)
- **Context.** PROGRESS.md carried three categories with different lifetimes, and the
  rotation predicate (`is it resolved?`) only handled one. **State** rotates on
  *"did it merge?"* — working. **Backlog** is open but not actionable, so the predicate
  never fires. **Rules** — *"never fix FUP-42501 by granting INSERT"*, *"before touching
  `buildAnswerMaps` read BUG-FF4-001"* — have **no resolution event at all**, so they can
  only accumulate. § Bug Log's "Closed" subsection had stopped being a bug list and become
  a rule list. Rules do not belong in a state file.
- **Decision.**
  1. **Standing rules live in `.claude/rules/*.md`, always with `paths:` frontmatter**, so
     they load when Claude touches the files they govern. A rule **without** `paths:` loads
     on every session and every teammate spawn — the cost this directory exists to avoid,
     reached by omission — so the gate reds on it.
  2. **Admission filter.** A rule is admitted only if it (a) declares machine-checkable
     `anchors:` and (b) is not already enforced by a gate or by code. Applied to the nine
     candidates, **five were rejected**: three already enforced (the minutes
     `MINUTES_SERVICE_URL` precondition fails fast in the spec itself; `lint:set-local`;
     pgTAP `320`'s ACL census), one with a **dead anchor** (*"date a log before citing it"*
     names `batch-9-unrun.log`, which is untracked), and one with no tight glob
     (supersession spans 8+ files, so the rule would fire everywhere or nowhere). A rule a
     gate already enforces is a downgrade dressed as a cleanup.
  3. **`lint:rules` is gate 8** (`scripts/check-rules-staleness.mjs`, self-red-proving).
     Keystone: **a rule whose own `paths:` glob matches zero files is orphaned** — its
     subject was renamed or deleted, so it can never fire again. Anchors resolve as `path`
     or `path#literal`. Retirement → `docs/progress/rules-archive.md`, verbatim, never
     deletion.
  4. **The Stop hook's domain widens to `.claude/rules/`.** `lint:rules` catches a rule
     whose *subject* vanished; a rule whose *claim* went false while its subject still
     exists has **no gate at all**, and the only witness is a human contradicting it
     mid-session.
- **Consequences.** *"Can this be shown stale?"* is now a precondition for writing a rule.
  ⛔ **Correction (2026-08-19, same day):** an earlier draft of this line claimed the anchor
  requirement *"caps the population."* **It does not.** Anchors bound what is **admissible**,
  never **how many** admissible rules accumulate — every anchor keeps resolving as the
  directory grows, so the gate stays green all the way to a second CLAUDE.md. Path-scoping
  likewise bounds **when** a rule loads, never **how many** load together: ten rules over one
  subtree all fire on a single file touch. Volume needed its own bounds, added below.
  ⚠ **Bounded, stated:** DB anchors (`prosecdef`, ACLs, RLS policies) are **not** checkable
  in `lint`, which runs without Docker — those belong in pgTAP, and the gate says so rather
  than reporting a pass that reads wider than its domain.
- **Open risk, unresolved at acceptance.** `.claude/rules/` path-scoping is gated by a
  runtime feature flag (`claudemd_rule_globs`). A rule file created mid-session did **not**
  load when a matching file was touched, which is consistent with either session-start
  enumeration *or* the flag being off for this account — the two cannot be distinguished
  from inside a session. **The rule files are therefore unproven, not proven.** An
  `InstructionsLoaded` hook is installed to measure it: the next session that opens
  PROGRESS.md either logs a `path_glob_match` load or does not. Until then the source prose
  remains reachable in the archives, and PROGRESS.md's pointer names both homes — so an
  inert rule costs a hop, not a fact.

## Amendment 1 — volume bounds, and the first retirement (2026-08-19)

- **Status:** accepted (PO, 2026-08-19), same day as the ADR.
- **Why so soon.** The admission filter was applied by *reading* globs, not measuring them.
  Measuring the first population showed `print-door.md`'s globs matched **659 files**
  (`supabase/migrations/**` 423 + `supabase/tests/**` 236) — it would have loaded on
  essentially every backend task. The supersession candidate had been **rejected** at
  admission for spanning 8. The same criterion, applied by eye, admitted a rule 80× wider.
  *A breadth criterion enforced by reading is not a criterion.*
- **Three volume bounds in `lint:rules`**, the analogue of PROGRESS.md's cell caps:
  **≤ 40 files matched per rule** (soft — waivable by declaring `broad: <why this subtree IS
  the subject>`, so breadth becomes a choice made in writing rather than an accident),
  **≤ 2048 bytes per rule file**, **≤ 12 rules total**. Each self-red-proves, and the
  breadth waiver is proven to both waive and to reject an empty reason.
- **`print-door.md` RETIRED** to `docs/progress/rules-archive.md` — the first use of the
  disposition this ADR defined. It failed both admission criteria once measured: too broad,
  and **already enforced** (pgTAP `342` S3c3 reds if anyone adds `is_active`). Its glob could
  not be narrowed *in principle* — the audience is whoever next edits the print door, which
  happens in a migration whose filename does not yet exist. The prohibition survives where it
  was always enforced: pgTAP `342` S3c3, plus the BUG-ACT-ACL-1 closure notes.
- **Population: 3** (`progress-contract` — `broad:` declared, the tracker genuinely is its
  subject · `answer-maps` 4 files · `radix-dialogs` 3 files).
- **The intake path is deliberately NOT written yet.** `.claude/rules/` has a staleness gate,
  volume bounds, and an exit — but no documented way in, because a session that learns a
  standing lesson is in *source code*, where the only file describing the three-way test
  (`progress-contract.md`, scoped to the tracker) does not load. Adding that line to CLAUDE.md
  §8 is the fix, and it is **held until `.claude/instructions-loaded.log` shows a
  `path_glob_match`**: publishing an intake into a directory that may never load would route
  every future standing lesson into a black hole, which is strictly worse than leaving those
  lessons in PROGRESS.md where a human can grep them.

## Amendment 2 — retirement has a precondition, and "too broad" has four exits (2026-08-19)

- **Status:** accepted (PO, 2026-08-19).
- **The omission.** Amendment 1 recorded the `print-door.md` retirement without stating the
  condition that made it *safe*: pgTAP `342` S3c3 already reds on the thing it prohibited, so
  the lesson survived the rule. Written without that condition, the breadth finding read as
  though **retire to `rules-archive.md`** were a general escape hatch for any too-wide rule.
  It is not. **Nothing reads the archive.** Retiring a rule that is still true and enforced
  nowhere does not file the lesson, it deletes it — and `lint:rules` goes green either way,
  so no gate can tell the two apart. *An instruction that reads complete while carrying an
  unstated precondition is this repo's recurring defect, and this was another one.*
- **Decision — the breadth finding now offers four dispositions, ordered**, with retirement
  as a conditional fifth:
  1. **Narrow the glob**, if the real subject is a few files.
  2. **Build a gate** — a gate beats a rule; the rule is then retirable under (5).
  3. **Declare `broad: <why this subtree IS the subject>`**, only when it really is
     (`progress-contract` over the tracker and its archives).
  4. **Promote to CLAUDE.md / ARCHITECTURE.md.** A rule matching most of a subtree **is**
     always-on; the honest home for always-on content is the always-loaded file, where the
     Stop-hook queue, `/review-claude-md` and the ask-before-editing rule reach it. Declaring
     `broad:` instead keeps always-on content in a path-scoped costume, with none of that
     review discipline.
  5. ⛔ **Retire to `docs/progress/rules-archive.md` ONLY once something else carries the
     lesson** — a gate, a test, or CLAUDE.md — or once the subject itself is gone.
- **Consequence.** *"Too broad but still needed"* is **not a retirement**. It is a gate
  waiting to be built, or content that belongs one level up. The precondition is stated in
  the gate's own finding text and as step 0 of the archive's retirement procedure, so it is
  reachable from both directions a session can arrive from.
