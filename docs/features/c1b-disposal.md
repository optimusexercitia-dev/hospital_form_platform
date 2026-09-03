---
id: C1B-DISPOSAL
title: PHI-disposal Cloud rehearsal (C1b)
status: planned
kind: feature
program: DM5
phase: "DM5 · Critical FUP C1 — C1b (Cloud rehearsal), pilot-risk bound"
branch: ~
plan: ~
progress: ~
reviews: []
adrs: ["0120", "0121", "0099"]
handoff: ~
fup: ~
---

# C1B-DISPOSAL — PHI-disposal Cloud rehearsal

## Acceptance criteria

Full ruling: `FUP-DM5-DISPOSAL-JOB` / Critical FUP C1 (docs/followups/follow-ups-open.md, PO ruling
2026-08-18) and [phi-disposal-runbook.md](../deployment/phi-disposal-runbook.md). Still open:

- [ ] "[phi-disposal-runbook.md] must be executed end-to-end, once, against test data, BEFORE any
      real patient record is loaded" — on Cloud (C1b); a green C1a (local) does not release the
      pilot (docs/followups/follow-ups-open.md `FUP-DM5-DISPOSAL-JOB`, PO ruling 2026-08-18)
- [ ] "The pilot-risk acceptance is bounded by C1b" — not yet run; "C1b (Cloud) NOT discharged —
      the byte proof is local-only by construction; column PHI is a different procedure"
      (docs/followups/follow-ups-open.md; PROGRESS.md § Now)

## Current state

**Updated:** 2026-09-03

### Objective

Execute the Storage-bytes PHI-disposal runbook (§3 steps A–D) end-to-end against the linked Cloud
project, once, against test data, before any real patient record loads — the pilot-risk condition
bounding Critical FUP C1 (PO ruling 2026-08-18).

### Done since start

- C1a (local) DISCHARGED 2026-08-31: §3 steps A–D ran end-to-end twice (`standard` + `phi` tier)
  via the `subject_request` lane; byte proof earned (−168 B per run) (PROGRESS.md § Now).
- Backup half (§6b) executed once locally, 2026-08-19; six findings (F1–F6) folded back into the
  runbook, including F5 (below).

### In progress

None — no Cloud run has been attempted; nothing is currently scheduled.

### Next

- Run the local rehearsal's 22 controls fresh, then §3 steps A–D against Cloud, before any real
  patient record loads (runbook § "Practical consequence for a Cloud disposal run").
- Resolve F6 (🟠 the DB half's own artifacts are ungoverned) first, per the runbook's own ordering
  warning: "do not let a C1b run be the first execution of an ungoverned procedure."

### Blockers

- **F5 — structural, not a scheduling gap:** "The procedure has NO Cloud form, and Cloud has no
  Storage backup at all" — Cloud offers no streaming/encrypted-backup mechanism equivalent to the
  local `docker exec` path (runbook §6b F5).
- The byte-level claim is "not provable from any surface probed so far" on Cloud (runbook §4) — a
  `disposed` state on Cloud is an assertion, never a verified one.
- No branch or session is currently assigned to run C1b.
