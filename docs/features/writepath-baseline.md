---
id: WRITEPATH-BASELINE
title: Write-arm baseline — the committed write-path findings file re-earned over the widened 107-policy domain through the merge, the three storage.objects INSERT policies verdicted, and the write arm's empty-set exit made a FINDING (pre-AE5 Batch 3)
status: in_progress
kind: feature
program: AUTHZ
phase: "Pre-AE5 remediation — Batch 3 of the follow-up batches ruled 2026-09-04"
branch: authz-writepath-baseline
plan: ../plans/pre-ae5-remediation.md
progress: ../progress/writepath-baseline.md
reviews: []
adrs: ["0079", "0153", "0173", "0189", "0190", "0191"]
handoff: ~
fup: ~
---

# WRITEPATH-BASELINE — the write arm's baseline

## Acceptance criteria

The unit closes **three** open follow-ups in `docs/followups/follow-ups-open.md`, each on its own
`Closes when` clause — quoted there, not paraphrased here. Nothing else counts as closure. The
subject is `supabase/tests/mutation/p0-authz-writepath-audit.sh` (the write arm) and its committed
baseline `docs/reviews/authz-writepath-audit-findings.md`, re-earned through
`scripts/lib/merge-findings-baseline.sh` exactly as Batch 2 did for the door file.

- [ ] `FUP-WRITEPATH-FINDINGS-FILE-COVERS-33-OF-107` 🟠 — "One full write-path sweep over the
      widened domain, with its rows merged into the committed findings file — not replacing it, since
      the 33 carry hand-merged annotations." ⛔ Not closed by a green `FROMFINDINGS=1` run before the
      merge (green *because* the absent rows are absent), nor by the 2026-09-02 domain fix (repaired,
      not measured), nor by the 37-of-107 subset merge.
- [ ] `FUP-STORAGE-OBJECTS-INSERT-POLICIES-NEWLY-IN-DOMAIN` 🟠 — "Sweep them and record a verdict per
      policy." A BLIND is a real finding to keystone. ⛔ Never allowlist one.
- [ ] `FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` 🟠 (Parts 2–4; Part 1 landed as deriver ruling 4) —
      "either a documented recovery step ('if you kill a run, do X'), or a restore that does not depend
      on a signal-catchable trap." Plus, from the plan: the write arm's exit over an EMPTY case set
      is a FINDING, not exit 0; the nine policies Part 3 names are re-measured against the widened
      domain (in, or the hole is stated); the crash behaviour Batch 0 built is re-verified on THIS
      harness, never assumed inherited.
- [ ] **The findings baseline re-earned through the merge** — ONE full write-arm run over the
      widened domain: detached, `RESET_EVERY` bounded (port Batch 0's design first if the writepath
      harness lacks it — it has 0 `RESET_EVERY` hits at open), hand-authored material preserved
      (2 `## Note` sections, 1 blockquote, ~9 annotated rows, a `---`), the `CARRIED` block enumerated
      for a PO ruling and re-filed by hand with each re-filing justified; the four authz arms' figures
      re-derived at the new row count.
- [ ] Every detector and exit path proven **able to fire** on a planted reproducer with the observed
      exit code, paired with a clean negative control and a discrimination half; every widening or
      port proven by **selection** on the live catalog; every restore verified in the catalog.
- [ ] Gate: `npm run lint` 0/0; `npm run test:db` on a fresh reset green (shape unmoved); the four
      authz arms hold with domains quoted; `SELFTEST=1` on the deriver and the door harness; the
      diff-scoped sweep derived by the deriver over `main...HEAD` with its `SCOPE:` line quoted; and
      `git diff --name-only main... -- supabase/migrations supabase/seed.sql src` EMPTY (a harness
      change, not a gate change — state which).

## Current state

**Updated:** 2026-09-07

### Objective
Make the write arm's committed baseline cover every write-capable policy the widened domain
selects (107 at filing, 37 verdicted), verdict the three `storage.objects` INSERT policies for the
first time, and make the arm's empty-set and killed-run behaviour findings rather than silence —
before AE5 re-keys write policies eleven times against this arm.

### Done since start
- Unit opened; branch `authz-writepath-baseline` cut off `main`.

### In progress
- `backend` plans FULL before touching the harness (the protocol's step 2).

### Next
- Lead rules on the plan → build with proofs → the one full run (detached, ~13 h) → CARRIED
  enumeration to the PO → re-file → closures → gate → QA → PO → Record.

### Blockers
- None. ⚠ Batch 4 runs on a separate machine in parallel; merge order is Batch 3 FIRST.
