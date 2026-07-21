# Worktrees — parallel Claude Code sessions on this repo

How to run more than one line of work on this codebase at once — you plus the
agent team, or two unrelated fixes — without one session's uncommitted files,
dev server, or branch stepping on another's. Referenced from the top of
[CLAUDE.md](../CLAUDE.md).

## 1. When to reach for one

The standard **Agent Team** phase workflow (CLAUDE.md §4) already runs
`frontend`/`backend`/`tester`/`qa` **in one shared tree** and avoids collisions
socially — "file ownership is binding: two teammates never edit the same file
in a phase" (CLAUDE.md §4, mechanics in
[lead-playbook.md](./lead-playbook.md)). Don't wrap routine phase work in a
worktree; that machinery already exists and worktrees would just add overhead.

Reach for a worktree when work needs to happen **beside** the phase, not as
part of it:

- A quick fix or spike while the primary tree has phase work in progress and
  you don't want to stash/interrupt it.
- Running you + Claude Code on two genuinely unrelated things at once (e.g.
  you're reviewing/testing on `main` in one terminal while a second session
  builds a feature branch in another).
- Trying something you might throw away (a library upgrade, a UI spike)
  without touching the primary checkout.
- A subagent that genuinely needs to mutate files in parallel with other
  in-flight work — pass `isolation: "worktree"` to that `Agent`/`Workflow`
  call (see §5). This is **not** for the routine `frontend`/`backend`/`tester`/`qa`
  teammates, which already share the tree by design.

## 2. Two ways to create one

### 2a. In-session, via Claude Code's built-in tool

Ask the session you're already in — e.g. *"start a worktree for the header
alignment bug"*. Claude Code calls `EnterWorktree`, which:

- Creates a new git worktree under **`.claude/worktrees/<name>/`** on a new
  branch (gitignored — see `.gitignore` / `.git/info/exclude`; don't create
  files there by hand).
- By default branches off `origin/main` (the `worktree.baseRef` setting
  controls this — the alternative branches off your current local HEAD
  instead; unset in this repo, so the default applies).
- Switches **that session's** working directory into the new worktree. The
  session is now looking at the worktree, not the primary tree, until you
  exit.

When done, ask it to exit: *"exit the worktree and keep it"* (branch + files
stay on disk, e.g. to resume later) or *"...and remove it"* (deletes both).
`ExitWorktree` only ever touches worktrees `EnterWorktree` created **in that
same session** — it won't discover or clean up one from a prior session (see
§4, this repo already had one leak that way).

Because it repoints your *current* session, this path suits a short, focused
detour. If you want to keep watching/driving the primary tree's work at the
same time, use 2b instead — a second, independent session.

### 2b. Manually, for a second parallel session

This is the day-to-day pattern for genuinely parallel work: two terminals,
two independent `claude` processes, each on its own branch and directory,
sharing only the same `.git` object database and the same local Supabase
stack.

```bash
# from the primary checkout
scripts/worktree-setup.sh fix/header-alignment      # new branch off origin/main
scripts/worktree-setup.sh fix/header-alignment origin/develop   # ...off a different base
scripts/worktree-setup.sh already-local-branch      # reuses an existing local branch, no new branch
```

`scripts/worktree-setup.sh` does what plain `git worktree add` doesn't, for
this repo specifically:

1. Creates the worktree under **`worktrees/<branch-name>/`** (top-level,
   gitignored — distinct from `.claude/worktrees/`, which is reserved for
   Claude Code's own tool-managed worktrees; don't mix manual worktrees into
   that directory).
2. Copies `.env.local` from the primary checkout (or seeds it from
   `.env.example` if the primary checkout doesn't have one yet) — worktrees
   don't inherit gitignored files, only committed history.
3. Runs `npm install` — `node_modules` is likewise per-worktree.
4. Picks a free port and writes a `./dev.sh` wrapper in the new worktree that
   runs `npm run dev` on it, so parallel worktrees never fight over `:3000`
   (Next's `PORT` can only be set via the environment, not `.env` files —
   `dev.sh` sets it correctly).

Then:

```bash
cd worktrees/fix/header-alignment
claude
```

That's a fully independent Claude Code session. It can itself run its own
Agent Team if the work warrants it — worktrees and Agent Teams compose; they
just isolate different things (filesystem vs. within-tree coordination).

## 3. Gotchas specific to this repo

- **Local Supabase is one shared resource, not per-worktree.** `supabase
  start`, `db reset`, and migrations all act on the single Docker stack keyed
  by `project_id` in `supabase/config.toml` — identical in every worktree
  because it's committed. The schema/data reflect whichever worktree last ran
  `db reset`; there's no per-worktree database isolation. Don't run schema
  work in two worktrees expecting separate databases, and don't run
  `supabase db reset --linked` (remote, destructive) casually from a worktree
  — it hits the same Supabase Cloud project regardless of which checkout ran
  it.
- **Worktrees isolate files, not the database.** A worktree protects your
  *uncommitted code* while you run something heavy or risky; it does not
  sandbox local or remote Supabase state.
- **E2E/pgTAP get flakier under parallel worktrees, not more isolated.**
  Known local gotchas already documented for this repo — GoTrue rate-limiting
  under repeated resets, pgTAP needing a fresh reset vs. leftover E2E state,
  a Kong DNS cache blip right after a reset — all get *more* likely if two
  worktrees run DB-mutating suites (`e2e`, `e2e:prod`, pgTAP) at the same
  time against the shared stack. Code edits can happen in parallel; serialize
  the actual test runs.
- **`.env.local` and `node_modules` never carry over automatically** — only
  committed history is shared across worktrees. `scripts/worktree-setup.sh`
  handles both; a plain `git worktree add` will not.
- **Dev server ports collide by default** — every worktree's `next dev`
  defaults to `:3000`. Use the `./dev.sh` the setup script generates instead
  of `npm run dev` directly when more than one worktree might run at once.
- **Clean up when you're done.** An abandoned worktree just sits on disk
  holding a branch/commit. This repo already accumulated one
  (`.claude/worktrees/form-question-block-error-32c0c0`, from a prior
  session that never called `ExitWorktree`) — harmless once its commits are
  merged, but worth clearing out rather than letting them pile up.

## 4. Cleaning up

```bash
# a worktree EnterWorktree created in your CURRENT session
# → ask Claude: "exit the worktree and remove it"

# any other worktree (manual, or left over from a past session)
git worktree list                              # see what exists
git worktree remove worktrees/fix/header-alignment
git branch -d fix/header-alignment              # -D if it has unmerged commits you're sure you want to drop
```

`git worktree remove` refuses if the worktree has modified/untracked files
(including a generated `node_modules`, `.env.local`, `dev.sh`) — pass
`--force` once you've confirmed there's nothing worth keeping in there.

## 5. Isolating a spawned subagent (lead-only, advanced)

The `Agent` and `Workflow` tools accept `isolation: "worktree"` per call: the
subagent works in a fresh git worktree instead of the shared tree, auto-removed
if it made no changes. This is for a subagent that must mutate files
concurrently with other in-flight work and can't use the social file-ownership
contract §4 of CLAUDE.md relies on for the standard teammates — it's
expensive (a fresh worktree + install per call), so reach for it only when
genuine parallel mutation is required, not as a default for spawning agents.
