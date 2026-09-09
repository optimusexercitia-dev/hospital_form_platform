---
id: BACKEND-STATE-CURRENT-STATE
title: Backend seams get a replaceable current-state layer — a projection above the frozen history, gated in four checks (ADR 0198)
status: gated
kind: feature
program: DOCS
phase: "ADR 0198 D1–D7 — no product phase; closes the first of the three P1/P2 items ADR 0196's external review left open"
branch: backend-state-current-state   # cut from data-access-generation @ 50af6915, which is main + ADR 0197
plan: ~
progress: ../progress/backend-state-current-state.md
reviews: []
adrs: ["0198", "0197", "0196", "0186", "0078"]
handoff: ~
fup: ~
---

# BACKEND-STATE-CURRENT-STATE — the map answers "what is", not only "what happened"

The decision is ADR
[0198](../decisions/0198-backend-state-seams-get-a-replaceable-current-state-layer.md), which amends
[0196](../decisions/0196-backend-state-split-on-the-module-seam-axis.md). No plan document: scoped,
executed and recorded in one session. It discharges the first item of the three the external review
filed against `BACKEND-STATE-SPLIT` — *"no seam has a replaceable current-state layer (57 of 67
sections are still slice-coded)"* — which had been sitting in that unit's session log with no
register entry.

## Acceptance criteria

Baselines, queries, the citation-verification run and the mutation table are in the record's
session-log entry.

- [x] **The finding re-derived before acting, not quoted.** `node scripts/measure-state-layer.mjs
      e4ac95e5` reproduces 67 sections / 57 slices (85%) / 10 axis-free, and the 8 files with no
      axis-free section reconcile with the reported "7 of 11 seam files" — the eighth is the
      pre-split archive. Marker counts reproduce too: 49 `SUPERSEDED`, 68 `STALE`, 17 `HISTORICAL`.
- [x] A replaceable `## Current state` block on **all 11 domain seams**, first among each file's `##`
      sections: five fixed sections, a dated stamp, a line ratchet. Shape and cap reused from gate
      13's hub block (`CURRENT_STATE_MAX_LINES` **imported**, not re-declared); seam vocabulary
      deliberately different (ADR 0198 D2).
- [x] **The frozen history is untouched, proven BY BYTES.** Strip this unit's additions from every file
      and **16 of 17 compare byte-identical to `git show HEAD:`**; the seventeenth is `README.md`,
      changed on purpose. ⚠ The weaker witness — slice count 57 before / 57 after — was true throughout
      and MISSED a real defect (the block boundary swallowing pre-existing prose — see the record), so it is
      recorded as corroboration, never as the proof.
- [x] Gate 16 grows **four checks** — G present/shaped/capped · H projection-not-log · I not-staler-
      than-its-history · J exemptions declared, proven, printed, ratcheted — with a **79-arm**
      self-test (39 pre-existing + 40 new, nine of them near-miss discrimination halves) and a
      **12-mutation run against the REAL corpus**, every mutation asserted to have applied and to
      have rolled back byte-for-byte.
- [x] The historical/current RATIO was **considered and rejected as a gate**, with the reason
      recorded (it degrades as append-only history grows correctly, so its only remedy is forbidden);
      it is REPORTED on every run instead.
- [x] **Deployment status ruled out of the state layer** (ADR 0198 D5) and gated in both polarities;
      the frozen dated claims stay where they are, and `conventions.md` § Remote discipline remains
      the home for the measurement.
- [x] Every block drafted against a per-bullet citation map; **409 quoted source fragments
      mechanically verified, 0 fabrications**, with a vacuity control proving the verifier could see
      one.
- [x] **The standard is written down once and cannot drift from the checker** (ADR 0198 D8):
      `--scaffold` emits the canonical block from the same constant checks G and H read, with
      self-test arms asserting what it prints passes G/H/I; `README.md` § Writing and refreshing a
      current-state block is the ONE procedure; CLAUDE.md §7, the lead-playbook Record step and
      `docs/INDEX.md` point at it and state only what is local to them. ⛔ `.claude/rules/` rejected
      — ADR 0127's admission filter bars a rule a gate already enforces.
- [x] `npm run lint` rc=0 · `npm run typecheck` rc=0, both **taken bare, not through a pipe**.

## Current state

**Updated:** 2026-09-09

### Objective

Give every domain seam in `docs/backend-state/` an explicit, replaceable "what is true now" layer
above its append-only history, and gate it so it cannot rot back into a log (ADR 0198).

### Done since start

All of the above. Eleven blocks installed, gate 16 at eleven checks, ADR 0198 accepted and indexed,
README maintenance rules 7–8 added, `scripts/measure-state-layer.mjs` added so the figure is
reproducible rather than quoted.

### In progress

Nothing. The unit is code-complete and awaiting §6 step 3.

### Next

A read-only QA review. On APPROVED this hub goes to `complete` with the block cut into the record
(ADR 0186 D3).

### Blockers

⛔ Status is `gated`, not `complete`, because **no QA review has been run** — this ran as a direct PO
instruction, not as a phase. Gate 13 refuses `complete` without an APPROVED verdict line, which is
the gate behaving correctly.

## Findings this unit surfaced but did NOT fix

⚠ Each is a defect in FROZEN text, so ADR 0196 D5 makes its fix an APPEND somebody must still write —
not something this unit could repair. ⛔ They are filed in
[follow-ups-open.md](../followups/follow-ups-open.md), not here: a hub is CUT when the unit completes
(ADR 0186 D3), so a finding that outlives the unit must not live only in one.

- 🟠 `FUP-BACKEND-STATE-CURRENT-STATE-AUTHZ-FILE-CONTRADICTS-ITSELF-TWICE-UNGATED`
- 🟠 `FUP-BACKEND-STATE-CURRENT-STATE-ARCHITECTURE-MD-STALE-AGAINST-TWO-SEAMS`
- 🟡 `FUP-BACKEND-STATE-CURRENT-STATE-FROZEN-DEPLOYMENT-VERDICTS-AND-A-DANGLING-POINTER`
- 🟢 `FUP-BACKEND-STATE-CURRENT-STATE-SPLIT-HUB-BLOCK-NOT-REPLACED`
