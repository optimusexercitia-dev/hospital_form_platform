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
| 5 | Trackers — [`PROGRESS.md`](../PROGRESS.md), [`planning/CURRENT.md`](planning/CURRENT.md), [`features/`](features/INDEX.md), [`bugs/BUGS.md`](bugs/BUGS.md), [`followups/follow-ups-open.md`](followups/follow-ups-open.md) | live state; each is gated for presence and resolution, never for truth |
| 6 | Generated files — `decisions/INDEX.md`, `features/INDEX.md`, the PROGRESS.md roll-up | derived; never edit by hand |
| 7 | Historical — `progress/` archives, `design/temp/`, `reviews/`, `handoffs/` | what was true when written; **a handoff may not be cited** |

Three verbs, never interchanged: **architecture** documents describe what is true now; **ADRs**
describe why we arrived there; **git** describes what changed.

## Map

| Entry | Purpose | Kind |
|---|---|---|
| [`backend-state.md`](backend-state.md) | the backend surface map — tables, doors, flags, per feature area; reference it instead of re-deriving the backend | reference |
| [`bugs/`](bugs/BUGS.md) | **the** bug register (`BUGS.md`, one row per bug, status is a column) + per-bug documents + `README.md` template + `archive.md` (the historical bodies). ADR 0185 D3 | tracker |
| [`followups/`](followups/follow-ups-open.md) | the follow-up register: `follow-ups-open.md` (one entry per open item, ⭐⭐ Critical pinned at the top), `deferred-backlog.md` (parked, every entry with **Revisit when**), `follow-ups-archive.md` (resolved). ADR 0179 + 0185 D5 | tracker |
| [`decisions/`](decisions/INDEX.md) | ADRs, `NNNN-slug.md`, bold-label headers; `INDEX.md` generated | decisions |
| [`deploy-coolify.md`](deploy-coolify.md) | Coolify / Docker deploy recipe (ADR 0059) | reference |
| [`deployment/`](deployment/) | runbooks and run logs (PHI disposal, backups) | reference |
| [`design/`](design/) | design notes and audits; `design/temp/` holds historical audits and pre-skill handoffs; `Pictures/` binaries | historical / design |
| [`features/`](features/INDEX.md) | **feature hubs** — one per unit with its own branch or gate; frontmatter status, links, acceptance criteria, `## Current state`; `INDEX.md` generated; `legacy-codes.md` legend. ADR 0185 D1 | tracker |
| [`handoffs/`](handoffs/) | on-demand session handoffs, one per branch, ≤ 24 KB, deleted at the branch's Record step; written by the `handoff` skill | ephemeral |
| [`lead-playbook.md`](lead-playbook.md) | lead-only orchestration protocol | process |
| [`learning/`](learning/LESSONS.md) | `LESSONS.md` (one row per lesson, with its **enforcer**) and `postmortems/` for failures that earn a file. ADR 0185 D7 | knowledge |
| [`lint-gates.md`](lint-gates.md) | why each `npm run lint` gate exists, and the trap in reading each | reference |
| [`phases/`](phases/) | phase specs + acceptance criteria for the accreditation track (13–21) and other multi-phase tracks | plan |
| [`planning/`](planning/CURRENT.md) | `CURRENT.md` — the in-flight units, one line each; the working state is in each hub. ADR 0185 D2 | tracker |
| [`plans/`](plans/) | feature plans and build notes (approach, not status) | plan |
| [`progress/`](progress/) | phase and program records, and the archives (`phase-ledger.md`, the quarterly archives of the retired Now section, `decisions-log.md`, `test-run-archive.md`, `qa-verdicts-archive.md`). The follow-up register and the bug archive left for `followups/` and `bugs/` on 2026-09-03 | tracker / historical |
| [`quality-track-context.md`](quality-track-context.md) | orientation for the accreditation track — read first when working in phases 13–21 | reference |
| [`reviews/`](reviews/) | QA and gate reviews, `<subject>-review.md`, verdict `APPROVED` / `CHANGES REQUESTED` | historical |
| [`testing/`](testing/) | E2E gate mechanics (`e2e-prod-build-gate.md`) | reference |
| [`worktrees.md`](worktrees.md) | parallel sessions on this repo; `scripts/worktree-setup.sh` | process |

Root files that are not under `docs/` but belong to the same apparatus: [`CONTEXT.md`](../CONTEXT.md)
(the glossary — the only home for term definitions), `.claude/rules/` (path-scoped standing rules,
gated by `lint:rules`), `.claude/skills/` (repeatable procedures).
