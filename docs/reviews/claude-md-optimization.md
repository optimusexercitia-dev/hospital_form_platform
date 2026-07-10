# CLAUDE.md optimization — evaluation & change-map

**Date:** 2026-07-09 · **Status:** adopted 2026-07-10 (swapped into `CLAUDE.md`) ·
**Scope:** restructure + extract (not full-ecosystem)

## TL;DR

`CLAUDE.md` is injected into the team lead **and every teammate/subagent** — the role
files literally begin "CLAUDE.md is already in your context." In an Agent-Teams project
where teammates are spawned many times per phase, its weight is paid on **every
delegation**. This pass makes it lean and stable while **losing zero binding rules**.

| File | Before | After | Δ |
|---|---|---|---|
| `CLAUDE.md` (per-spawn cost) | 495 ln / **30,940 B** | 277 ln / **17,172 B** | **−44 % (−13,768 B / ~−3.4k tokens per spawn)** |
| `docs/lead-playbook.md` (lead reads once) | — | 88 ln / 5,188 B | new |

Across a 20+ phase project with repeated teammate spawns, a ~13.8 KB per-spawn saving
compounds into hundreds of thousands of tokens — at **no cost to correctness**, because
the removed material was either duplicated in an authoritative doc or relevant only to
the lead.

## What the audit found

The file is **not inaccurate** — a staleness sweep verified the tech stack (Next.js
16.2.9, Tailwind v4, Recharts, Playwright, Vitest), phase status, all **10** referenced
ADRs, the seed personas, and the npm scripts. This is a **context-cost and structure**
problem, in three parts:

1. **Redundancy with authoritative docs (~90 lines).** §3 "Architecture Rules" restated
   the full rules that live authoritatively in `ARCHITECTURE.md`; §1's
   form-versioning/sections/items detail ≈ `ARCHITECTURE.md §2`; the PHI "three isolated
   modules" story was repeated ~5× (§1 overview, §1 positioning, §1 governance intro,
   Rule 12, §5).
2. **Wrong-audience content.** §4 "Lead protocol" (36 lines) plus the §6/§7 rotation
   mechanics are orchestration-only, yet loaded into all four teammates, who never run
   them. (There is no lead-specific agent file; the lead inherits CLAUDE.md — so the
   right home is a doc the single lead session reads once.)
3. **Minor drift** (undermines reader trust): the §2 tree showed a `docker/` dir (only a
   root `Dockerfile` exists) and `src/middleware.ts` (the only middleware file is
   `src/lib/supabase/middleware.ts`); §6 described a `TaskCompleted` gate hook that is
   **not configured** in `.claude/settings.json`.

The irony the fix resolves: §7 already preaches "keep PROGRESS.md small — every spawn
reads it," a discipline never applied to CLAUDE.md itself.

## Change-map (section by section)

| § | Change | Where the content lives now |
|---|---|---|
| Preamble | Added pointer to the lead-playbook; kept the doc pointers | CLAUDE.md |
| §1 PHI posture | 5 scattered restatements → **one canonical paragraph** ("= Rule 12; cite Rule 12 elsewhere") | CLAUDE.md §1 |
| §1 versioning/sections/items | Compressed to the load-bearing invariants + pointer to ARCHITECTURE.md §2 | CLAUDE.md §1 (detail: ARCHITECTURE.md) |
| §1 governance modules | Trimmed to name + one-liner each | CLAUDE.md §1 (detail: accreditation-track.md) |
| §2 layout tree | **Drift fixed** — root `Dockerfile`; `src/lib/supabase/` noted as middleware home; no phantom `docker/` | CLAUDE.md §2 |
| §3 Architecture Rules | 45-line prose → **12-line numbered index** (number + title), so "Rule N" cross-refs still resolve | CLAUDE.md §3 (detail: ARCHITECTURE.md) |
| §4 Lead protocol | **Moved out** (warm teams, contract-first, plan-approval right-sizing, cleanup) | `docs/lead-playbook.md` §1–3 |
| §5 phase table + deploy narrative | Replaced with the hard-rule + pointers (table duplicated PHASES.md) | CLAUDE.md §5 (detail: PHASES.md / PROGRESS.md) |
| §6 Record-step mechanics | Kept the 5-step gate; moved rotation mechanics out; **removed the unimplemented `TaskCompleted` hook mention** | CLAUDE.md §6 + `docs/lead-playbook.md` §4 |
| §7 rotation/archive rules | Kept the teammate-facing core; moved the rotation discipline out | CLAUDE.md §7 + `docs/lead-playbook.md` §5 |
| §8 / §9 / Loop / graphify | Kept; §9 persona roster compressed to the key set + seed-header pointer | CLAUDE.md |

## Binding-rule preservation — verified ✓

Every invariant either stayed in CLAUDE.md or moved to the lead-playbook; grep-confirmed
in the proposed files:

- Architecture Rules **1–12** — present as a numbered index (cross-refs resolve) ✓
- PHI / Rule 12 (three modules `event_patient`/`referral_patient`/`case_patient`,
  isolation, audit) ✓
- `submit_response` authority · one-draft-per-user · `in_progress`→`submitted` ✓
- Published-version `IMMUTABLE` · `question_key` stability · `visible_when` ✓
- File-ownership + "two teammates never edit the same file" ✓
- pt-BR user text · English code · service-role-key-server-only (§8) ✓
- Phase-Gate order + "no phase starts until prior approved" hard-rule ✓
- Lead protocol · gate Record mechanics · PROGRESS rotation → lead-playbook ✓

## How to adopt (two steps, when you're satisfied)

```bash
# 1. diff the proposal against the current file
git diff --no-index CLAUDE.md CLAUDE.optimized.md

# 2. swap it in (lead-playbook.md is already in place; it becomes live on swap)
mv CLAUDE.optimized.md CLAUDE.md
```

`git` preserves the original for revert. Note: `CLAUDE.md` already had **pre-existing**
uncommitted edits at the start of this session (unrelated to this pass) — reconcile those
before or after the swap as you prefer.

## Out of scope this pass — recommended follow-ups

- **Deduplicate the four `.claude/agents/*.md` role files** (276 ln) against CLAUDE.md;
  they restate tech stack / rules / ownership (drift risk). Replace with pointers +
  genuinely role-specific content only.
- **PROGRESS.md is 82.5 KB** — over its own 60 KB ceiling; `docs/backend-state.md` is
  161 KB. Both warrant the same rotation discipline.
- ~~Decide the `TaskCompleted` gate hook~~ — **resolved 2026-07-10: removed the mention.**
  Running the full Playwright suite inline is a poor fit here (subagents stall on the suite
  watchdog; E2E needs a live server + fresh seed, risking false blocks). The gate stays
  enforced by the tester+lead protocol; a lightweight typecheck/lint/unit variant remains an
  option if a mechanical tripwire is ever wanted.
