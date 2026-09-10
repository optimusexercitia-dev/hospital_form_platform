---
name: to-plan
description: Turn what a session has decided — a /grill-with-docs run, an ordinary session that wrote ADRs or settled a design along the way, or a spec / ADR path passed as the argument — into this repo's two plan artifacts: docs/plans/<slug>.md in the house section shape, and a `status: planned` hub in docs/features/, after one quiz round that settles test seams, file ownership, blocking edges and whatever the session left open. Synthesis, not an interview. Run it when decisions exist but no build order does, and before any teammate is spawned.
disable-model-invocation: true
---

# To Plan

A session that has settled a design — a `/grill-with-docs` run, or an ordinary session that
wrote ADRs or reached decisions along the way — ends with the *decisions* recorded, in ADRs
and glossary entries. Nothing yet says **what gets built, by whom, in what order, and how each
step is proven**. That is the plan, and it has exactly two
homes here: the plan file `docs/plans/<slug>.md` (approach, never status — docs/INDEX.md) and
the unit's hub `docs/features/<code>.md` at `status: planned`, which is its registration in
the live list.

This skill writes both from what is already in context, or from the spec / ADR path passed
as the argument. **Do not interview the user about what the session settled** — re-opening
settled branches is how a plan goes stale before it is written. What the session left open is
put to the user once, inside step 3's single round, never assumed and never grown into a
second interview. If nothing in context decided anything and no argument was passed, there is
nothing to plan from: say so.

## What a plan is not

| It is not | That lives in |
| --- | --- |
| a decision with its rationale | an ADR in `docs/decisions/` — the plan *cites* it by number |
| a status word (done, in progress, blocked) | the hub's `## Current state`, which a planned hub may not even carry |
| a witness (a SHA, an exit code, a file:line that proves something) | the progress record's `## Session log`, opened when the unit starts |
| a list of user stories | nowhere — this repo's unit of acceptance is a criterion the tester can spec |
| a ticket on a tracker | nowhere — the lead hands steps out, and the plan's step table IS the queue |

## Process

### 1. Inherit, never re-derive

Read the ADRs and `CONTEXT.md` entries the session produced, or the ones the argument names.
Every decision the plan rests on is a pointer (`ADR 0NNN D3`), not a restatement: a restated
decision drifts from its ADR within a week, and then two texts disagree. A ruling the user
made in conversation that did not become an ADR is listed once, verbatim, with its date.

A session that was not grilled settles things unevenly: some decisions were made in passing,
some were assumed and never said. Keep a running list of both as you read. The ones the cut
depends on go into step 3's round; the rest go to § 7 with a recommendation. If one of them
has the weight of an ADR — it would surprise a later reader, or it changes an earlier
decision — name it in the closing report; writing it belongs to `/domain-modeling`, not here.

### 2. Facts from the environment, never from memory

Finding facts is your job, not the user's (delegation floor, CLAUDE.md §4). Dispatch an
**Explore** subagent for whatever in the codebase the plan depends on: what already ships,
which `docs/backend-state/` seam file owns the area, which E2E personas reach it. For anything
**schema / RLS / RPC / authorization**, the live catalog is the sole truth — `pg_proc` with
`prosecdef`, `pg_policies`, `pg_trigger`, the ACLs — read through
`docker exec -i supabase_db_<ref> psql`. Never quote migration text and never graphify it
(ADR 0078). Each such fact goes into § 0 stamped `verified YYYY-MM-DD`: a plan is read for
weeks, and the reader must know how old its ground is.

### 3. Cut the steps, then one quiz round

Cut the work under these rules, then put the cut to the user **before writing a line of the
plan** — granularity and ownership are decisions, and decisions are the user's:

- **One owner per step.** A step lands entirely inside one teammate's file set (`backend`:
  migrations, RLS, `src/lib/{supabase,queries,types}`, route handlers; `frontend`: `src/app`,
  `src/components`; `tester`: `e2e/`). Two teammates never edit the same file in a phase and
  shared types change only via `backend`, so a behaviour that needs schema *and* UI is a
  **chain**, not one step: backend posts the contract first (types, RPC signature, stubs),
  frontend builds against the frozen contract, tester specs the behaviour. The edges make the
  chain visible.
- **Verifiable alone.** Each step names its proof — a pgTAP file number, a Vitest file, a
  Playwright spec title, or a catalog query — at the highest seam that observes the
  behaviour. Playbook §3 rejects a plan without a testing note; a step without a proof is not
  finished being cut.
- **Sized for one teammate session.** A step that will not fit a fresh context is two steps.
- **Prefactor first.** When a change is easier after a small reshaping, the reshaping is its
  own step, blocked by nothing.
- **Wide refactors go expand → migrate → contract**, never one step. Applied migrations are
  forward-only and never edited (`.claude/rules/migrations-forward-only.md`); anything that
  reaches the remote pushes schema before code (`.claude/rules/push-schema-before-code.md`),
  and that ordering is a step in the plan, not a footnote.
- **Files are named.** Generic ticketing advice omits file paths; here they are required,
  because ownership is binding and the lead checks it at hand-out. Code snippets are not,
  except a shape (a type, a state machine, an RPC signature) that encodes a decision more
  precisely than prose can.
- **Review tier pre-tagged** from playbook §3: `ack` for a step that follows an
  already-approved pattern; `full` for a new RLS shape, a `SECURITY DEFINER` read path, a
  service-role route handler, the condition evaluator, the immutability triggers, or a
  genuinely new UI pattern.

Ask the whole frontier in one round, in the `/grilling` format (numbered `❓ Q` with a `➡️`
recommended answer): the seams, the owner per step, the edges, whether any step should merge
or split — and, for a session that was not grilled, each decision from step 1 that the cut
depends on, asked once with a recommendation rather than assumed. Wait for the answers. A
second round only if the answers reshaped the cut. If the list is long enough that the round
would itself be a grill, say so before asking and let the user choose between answering here
and running `/grill-with-docs` first.

### 4. Write `docs/plans/<slug>.md`

Use these sections in this order, numbered as shown. The existing plans in `docs/plans/`
converge on this shape, and a reader who has seen one should be able to read the next:

```
# <Title> — plan (ADR 0NNN[, …])

## 0. What already shipped — read before building, do not re-derive
## 1. Goal
### Deliberately not in scope
## 2. Decisions this plan inherits
## 3. Contract
## 4. Steps
## 5. Acceptance criteria
## 6. Assurance
## 7. Open decisions and risks
```

- **§ 0** — the verified facts from step 2, each with its date. The *next* plan in this area
  starts reading here.
- **§ 1** — the problem and the outcome from the user's side, in the glossary's terms. The
  not-in-scope subsection is mandatory even when short: it is what stops scope from growing
  silently during the build.
- **§ 2** — ADR pointers and dated PO rulings, one line each.
- **§ 3** — the frozen interface every downstream step builds against: schema shape, RPC
  signatures, typed contract. Contract-first is how `backend` runs a phase ahead without
  `frontend` waiting on it.
- **§ 4** — one row per step: `id · owner · delivers · files · blocked by · proof · tier`.
  `delivers` is the behaviour from the user's side, not a layer list. A step with no blockers
  can start immediately.
- **§ 5** — checkbox criteria phrased as the tester will spec them. These are copied into the
  hub, so write them once, here.
- **§ 6** — the gates this unit must pass beyond the standard chain: `npm run test:db` on a
  fresh reset; the authz arms and the diff-scoped door sweep when any step touches RLS or a
  DEFINER function, and then `docs/learning/LESSONS.md` is on that step's reading list;
  `npm run e2e:prod` to declare green.
- **§ 7** — the decisions the session left to the PO, each with a recommended answer; the risks,
  named; sizing only if asked for, and then labelled
  `inferred, not measured — do not quote as commitments`.

### 5. Open the hub

Create `docs/features/<code>.md` with `status: planned`. The registers gate requires the keys
`id`, `title`, `status`, `kind`, `program`, `branch`, `plan`, `progress`, `reviews`, `adrs`,
`handoff`; `id` matches `^[A-Z0-9][A-Z0-9-]*$` and the file is named by its lowercase form.
Set `plan: ../plans/<slug>.md`; leave `branch: ~`, `progress: ~`, `reviews: []` until the unit
starts; `adrs:` lists the numbers from § 2, each of which must have a file. Body: the
`# <ID> — <title>` heading and an `## Acceptance criteria` section pointing at plan § 5 with
its open checkboxes. **No `## Current state`** — a planned unit has a plan, not a state, and
the gate reds on it.

Then run `npm run features:index` and `npm run lint:registers`, and fix what they say.

### 6. Stop

The plan is the lead's hand-out sheet and the human's approval object. Do not spawn a
teammate, cut a branch, or start a step. Report the two paths and the open decisions from § 7.
