# Documentation index

What lives where under `docs/`, and **which source outranks which** when two disagree. Every
top-level entry of `docs/` must appear here — `npm run lint:registers` reds when one does not
(ADR 0185 D8). The four root trackers (`CLAUDE.md`, `ARCHITECTURE.md`, `PHASES.md`,
`PROGRESS.md`) stay at the root by decision; CLAUDE.md is the only document loaded into every
session, and it points here.

## Authority order

When two records disagree, the higher one wins. A lower record that contradicts a higher one
is **stale**, not an alternative.

| Rank | Source | What it is truth about |
|---|---|---|
| 1 | **The live catalog** — `pg_proc` (incl. `prosecdef`), `pg_policies`, `pg_trigger`, ACLs | every fact about schema, RLS, functions and grants. ⛔ Migration file text is stale by design (CLAUDE.md § graphify); graphify does not index SQL |
| 2 | **The code** — `src/`, `supabase/tests/`, `e2e/`, `scripts/` | what the application and its gates actually do |
| 3 | [`ARCHITECTURE.md`](../ARCHITECTURE.md) | the binding rules and the canonical-schema **list**; each rule names its enforcer or says `prose only` |
| 4 | [`decisions/`](decisions/INDEX.md) (ADRs) | **why** we arrived here; the index and back-pointers are generated (gate 9) |
| 5 | Trackers — [`PROGRESS.md`](../PROGRESS.md), [`features/`](features/INDEX.md), [`bugs/BUGS.md`](bugs/BUGS.md), [`followups/follow-ups-open.md`](followups/follow-ups-open.md) | live state; each is gated for presence and resolution, never for truth |
| 6 | Generated files — `decisions/INDEX.md`, `features/INDEX.md`, the PROGRESS.md roll-up | derived; never edit by hand |
| 7 | Historical — `progress/` archives, `design/temp/`, `reviews/`, `handoffs/` | what was true when written; **a handoff may not be cited** |

Three verbs, never interchanged: **architecture** documents describe what is true now; **ADRs**
describe why we arrived there; **git** describes what changed.

## Map

| Entry | Purpose | Kind |
|---|---|---|
| [`backend-state.md`](backend-state.md) | the backend surface map — tables, doors, flags, per feature area; reference it instead of re-deriving the backend | reference |
| [`bugs/`](bugs/BUGS.md) | **the** bug register (`BUGS.md`, one row per bug, status is a column) + per-bug documents + `README.md` template + `archive.md` (the historical bodies). ADR 0185 D3 | tracker |
| [`followups/`](followups/follow-ups-open.md) | the follow-up register: `follow-ups-open.md` (one entry per item, open or **parked** — parked ones carry **Revisit when** — ⭐⭐ Critical pinned at the top, bodies over ten lines split into `FUP-*.md` files), `follow-ups-archive.md` (resolved), `legacy-codes.md` (id-prefix legend, moved from `features/`, read by the CODES arm). ADR 0179 + 0185 D5 + 0186 D4 | tracker |
| [`decisions/`](decisions/INDEX.md) | ADRs, `NNNN-slug.md`, bold-label headers; `INDEX.md` generated | decisions |
| [`deploy-coolify.md`](deploy-coolify.md) | Coolify / Docker deploy recipe (ADR 0059) | reference |
| [`deployment/`](deployment/) | runbooks and run logs (PHI disposal, backups) | reference |
| [`design/`](design/) | design notes and audits; `design/temp/` holds historical audits and pre-skill handoffs; `Pictures/` binaries | historical / design |
| [`features/`](features/INDEX.md) | **feature hubs** — one per unit with its own branch or gate; frontmatter status, links, acceptance criteria, `## Current state`; `INDEX.md` generated. ADR 0185 D1 | tracker |
| [`handoffs/`](handoffs/) | resume pointers only — written when a session pauses mid-task, `branch:` or `expires:` mandatory, ≤ 24 KB, deleted on resume or at landing; state lives in the hub, witnesses in the record (ADR 0186 D3) | ephemeral |
| [`lead-playbook.md`](lead-playbook.md) | lead-only orchestration protocol | process |
| [`learning/`](learning/LESSONS.md) | `LESSONS.md` (one row per lesson, with its **enforcer**) and `postmortems/` for failures that earn a file. ADR 0185 D7 | knowledge |
| [`lint-gates.md`](lint-gates.md) | why each `npm run lint` gate exists, and the trap in reading each | reference |
| [`phases/`](phases/) | phase specs + acceptance criteria for the accreditation track (13–21) and other multi-phase tracks | plan |
| [`plans/`](plans/) | feature plans and build notes (approach, not status) | plan |
| [`progress/`](progress/) | phase and program records, and the archives (`phase-ledger.md`, the quarterly archives of the retired Now section, `decisions-log.md`, `test-run-archive.md`, `qa-verdicts-archive.md`). The follow-up register and the bug archive left for `followups/` and `bugs/` on 2026-09-03 | tracker / historical |
| [`quality-track-context.md`](quality-track-context.md) | orientation for the accreditation track — read first when working in phases 13–21 | reference |
| [`reviews/`](reviews/) | QA and gate reviews, `<subject>-review.md`, verdict `APPROVED` / `CHANGES REQUESTED` | historical |
| [`testing/`](testing/) | E2E gate mechanics (`e2e-prod-build-gate.md`) | reference |
| [`worktrees.md`](worktrees.md) | parallel sessions on this repo; `scripts/worktree-setup.sh` | process |

## Where a line belongs

The one table (ADR 0186 D5; the mechanical checks are gates 7 and 13, not this text):

| A line that is… | goes to |
|---|---|
| a phase's status | PROGRESS.md § Phase Status — nothing else lives in that file but § State and pointers |
| a unit's **state** (done, in progress, next, blocked) | its hub `docs/features/<code>.md` § Current state: six sections, replaced never appended, ≤ 60 lines |
| a unit's **witness** (a command, a SHA, a file:line, an exit code, a dead end) | its record `docs/progress/<code>.md` § Session log, one dated entry per session, appended |
| a bug | one row in `docs/bugs/BUGS.md`; status is a cell, there is no rotation; a `docs/bugs/<ID>.md` file when severity ≥ high |
| a follow-up | one entry in `docs/followups/follow-ups-open.md` with Filed · Owner · Severity · Closes when · Status; parked = `Status: parked` + Revisit when; a body over ten lines in `docs/followups/<FUP-ID>.md`; resolved → `follow-ups-archive.md`. `PO to rule` is the honest value; an invented one is not |
| a lesson | one row in `docs/learning/LESSONS.md` with its enforcer or `prose only`; a postmortem file when it earns one |
| a decision | an ADR in `decisions/`, numbered highest-on-any-live-branch + 1, then `npm run adr:index` |
| a standing prohibition with no resolution event | `.claude/rules/`, under ADR 0127's admission bar |
| a paused session's resume pointer | `handoffs/`, `branch:` or `expires:`, deleted on resume or landing |

**Rotation at the Record step:** the completed phase row → `progress/phase-ledger.md` verbatim ·
the completed hub → `status: complete`, its block appended to its record, `npm run
features:index` · the resolved entry → the archive · the handoff deleted. Repoint links in the
same edit: root-relative `docs/…` becomes `../…` from a subdirectory.

Root files that are not under `docs/` but belong to the same apparatus: [`CONTEXT.md`](../CONTEXT.md)
(the glossary — the only home for term definitions), `.claude/rules/` (path-scoped standing rules,
gated by `lint:rules`), `.claude/skills/` (repeatable procedures).
