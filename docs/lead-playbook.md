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
- Break each phase into **5–6 tasks per teammate** on the shared task list; mark
  dependencies (e.g., the frontend form-builder task depends on the backend
  versioning-API task).
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

1. Updates PROGRESS.md (phase → ✅, date, commit hash, link to the review).
2. **Rotates** the just-completed phase's detail out of the live PROGRESS.md into
   `docs/progress/` (§5 below), leaving a one-line pointer behind.
3. Archives the phase's task detail to `docs/progress/phase-N.md` (or a feature-named
   file).
4. Updates `docs/backend-state.md` if the backend surface changed.
5. Commits with `phase(N): complete — <summary>`. The team stays warm for the next phase.

## 5. PROGRESS.md rotation & archive discipline

**Keep PROGRESS.md small — every spawn reads it** (target a few hundred lines / well
under ~60 KB). The live file holds only the Phase Status table, the **current** phase's
task table + lead notes, and the *current head* of each cross-phase log — not the full
history. At the Record step, rotate:

- **Phase task detail + per-phase notes** → `docs/progress/phase-N.md` (or a
  feature-named file); leave a one-line pointer under "Completed work".
- **Bug Log** → keep only **OPEN** bugs live; move resolved/closed rows to
  `docs/progress/bug-log-archive.md`.
- **Test Run Summary** → keep only the **most recent gate's** rows live; move the rest to
  `docs/progress/test-run-archive.md`.
- **QA Verdicts** → **one line only**: verdict + date + link to
  `docs/reviews/phase-N-review.md` (which holds the full analysis). Don't restate the
  rationale in PROGRESS.md, and don't grow `docs/progress/qa-verdicts-archive.md`
  (redundant with the review doc).
- **Decisions** → **one line per decision** + ADR link; rationale lives in
  `docs/decisions/` (verbose pre-collapse history in `docs/progress/decisions-log.md`).
- **Follow-ups / Deferred** → keep only **OPEN** (`[ ]`/`[~]`) items live; move resolved
  `[x]` items to `docs/progress/follow-ups-archive.md`.

Archive files under `docs/progress/` are append-only and never loaded by spawns — detail
goes there to stay out of every teammate's context. The durable map of what the backend
already provides lives in **`docs/backend-state.md`** (the lead keeps it current) so
per-phase lead notes reference it instead of re-deriving it each phase.
