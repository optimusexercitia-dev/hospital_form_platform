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
   below): task detail, resolved follow-up index lines, closed bugs, concluded
   gate/QA/decision rows — each to its archive, leaving pointers only where a live
   item still references them.
3. Archives the phase's task detail to `docs/progress/phase-N.md` (or a feature-named
   file).
4. Updates `docs/backend-state.md` if the backend surface changed.
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
   The Record step is the queue's trigger: a cadence with no trigger is the
   "standing in prose alone" failure ADR 0079 documents.

**Gate step-1 note (authz sweeps):** derive the case list with
`scripts/door-sweep-cases.sh <phase-base>` — never by hand, and never from the old prose
one-liner (ADR 0079 § The recipe; exit 1 means *migrations touched, zero gates derived*,
which is an obligation to rule on, not a pass). ⛔ **Do NOT `git checkout --` the findings
file afterwards** — that instruction is retired (ADR 0153): a subset run now writes to
scratch under `$WORK` and never opens the committed baseline for write. Verify by
**measurement**, which stays right whether or not the guard is ever reverted:
`git diff --stat -- docs/reviews/authz-door-audit-findings.md` — empty means untouched.

## 5. PROGRESS.md rotation & archive discipline

**PROGRESS.md is live state only, and the contract is machine-enforced** —
`npm run lint:progress` (`scripts/check-progress-doc.mjs`, gate 7 of `npm run lint`)
reds on: the file over 80 KB, a `✅ complete` row in § Phase Status, a resolved line in
the § Follow-ups index, a broken relative link, an OPEN `FUP-*` index line with no body
in `follow-ups.md`, a missing required section, or CRLF. So the discipline below is not
a memory exercise; the gate tells you when it has been skipped. At the Record step, move:

- **Phase row** → `docs/progress/phase-ledger.md`, **verbatim** (append-only; rows
  never leave *there*). Byte-compare the moved row before deleting the live one.
- **Phase task detail + per-phase notes** → `docs/progress/phase-N.md` (or a
  feature-named file); leave a one-line pointer only if a live item references it.
- **Concluded § Now bullets / narrative fragments** → the current quarter's
  `docs/progress/<YYYY>-Q<n>.md` (e.g. `2026-Q3.md`), **verbatim**, links repointed —
  keyed to the **rotation date**, not the conclusion date (ADR 0139). `lint:progress`
  discovers quarterly archives by pattern and link-checks them, with a zero-match
  control. The pre-convention destination `now-concluded-2026-08.md` is **frozen**
  (inbound name- and line-keyed references make a rename or merge lossy) — never
  append to it. Per-topic narrative files stay per-topic; only the § Now cut itself
  goes quarterly.
- **Bug Log** → keep only **OPEN** bugs live; move resolved/closed rows to
  `docs/progress/bug-log-archive.md`.
- **Test Run Summary** → keep only the **most recent gate's** row live; move the rest to
  `docs/progress/test-run-archive.md`.
- **QA Verdicts** → **one line only**: verdict + date + link to
  `docs/reviews/phase-N-review.md` (which holds the full analysis). Keep only the
  **current milestone's** rows live; move older concluded rows **verbatim** to
  `docs/progress/qa-verdicts-archive.md`'s "Collapsed one-line index" section. Never
  restate rationale in either file — the index exists only to preserve the
  feature-name → review-file mapping and the struck loop rows.
- **Decisions** → **one line per decision** + ADR link; rationale lives in
  `docs/decisions/` (verbose pre-collapse history in `docs/progress/decisions-log.md`).
  Move concluded rows to `decisions-log.md` at the Record step (append verbatim first).
  `docs/decisions/INDEX.md` is **generated** navigation over the ADR corpus — never a
  rotation destination, never edited by hand; the log is the register's archive and
  holds what the INDEX structurally cannot (amendment-grain refs, ADR-less rulings).
  Take a **new ADR's number from `docs/decisions/INDEX.md`** (it states the next free one),
  never from the directory listing — two sessions eyeballing the listing on 2026-07-02 both
  filed an "ADR 0050", and the collision survived seven weeks and 87 further ADRs.
- **Follow-ups / Deferred** → PROGRESS.md carries a **one-line index only** (severity ·
  id · title · owner); full bodies of OPEN items live in `docs/progress/follow-ups.md`
  (update BOTH on any state change — the gate checks the body exists). Move resolved
  items' index lines to `docs/progress/follow-ups-archive.md` verbatim; NEVER compress
  or drop an OPEN index line at any file size (§ Critical FUP never rotates at all).

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
already provides lives in **`docs/backend-state.md`** (the lead keeps it current) so
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
