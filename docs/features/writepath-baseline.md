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
      > ⚠ **CORRECTION 2026-09-07 (`backend`, build turn).** The plan predicted all three would land
      > `ERROR — must be owner of table objects`, because `postgres` is `rolsuper=f` and
      > `pg_has_role('postgres', relowner,'USAGE')` = false for `storage.objects`. **Measured: all
      > three sweep and verdict COVERED as plain `postgres`** — `supautils.policy_grants` grants
      > POLICY DDL on Supabase-managed tables outside `pg_class.relowner`. Ownership was a PROXY,
      > not the property. No privilege change is needed for this clause. (`p3-storage-3case`,
      > bare rc 0, `SWEPT: 3 COVERED: 3 BLIND: 0 ERROR: 0`; restores byte-exact, degenerate
      > NON-SELECT = 0.) The clause still needs these verdicts recorded through the FULL run's merge.
- [ ] `FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` 🟠 (Parts 2–4; Part 1 landed as deriver ruling 4) —
      "either a documented recovery step ('if you kill a run, do X'), or a restore that does not depend
      on a signal-catchable trap." Plus, from the plan: the write arm's exit over an EMPTY case set
      is a FINDING, not exit 0; the nine policies Part 3 names are re-measured against the widened
      domain (in, or the hole is stated); the crash behaviour Batch 0 built is re-verified on THIS
      harness, never assumed inherited.
      > ⚠ **CORRECTION 2026-09-07 (`backend`, build turn; lead rulings R1/R2/R13).** The criterion
      > *"the write arm's exit over an EMPTY case set is a FINDING, not exit 0"* named a state that
      > was ALREADY handled and was not this item's defect. Two states share the name "empty" and
      > behave oppositely: (a) `CASES` set to tokens matching nothing already reached
      > `exit 3 UNPROVEN` (built by the 2026-08-29 REPAIR); (b) **`CASES` set to the EMPTY STRING was
      > indistinguishable from `CASES` unset** — a full 120-case run opening the COMMITTED baseline,
      > with (a)'s door unreachable from the caller that produces it. (b) is the real defect and is
      > FIXED here (ADR 0192); (a) is PROVEN, not re-built. ⛔ The item's only live clause is
      > **Part 4** (the recovery step) plus the nine policies actually being swept — Parts 1–3 are
      > already discharged. `FUP-WRITEPATH-BASELINE-CASES-EMPTY-STRING-DEGRADES-TO-A-FULL-RUN` files the identical
      > defect against `p0-authz-door-audit.sh`, which is deliberately not touched here.
- [ ] **The findings baseline re-earned through the merge** — ONE full write-arm run over the
      widened domain: detached, `RESET_EVERY` bounded (port Batch 0's design first if the writepath
      harness lacks it — it has 0 `RESET_EVERY` hits at open), hand-authored material preserved
      (2 `## Note` sections, 1 blockquote, **11** annotated rows — ⚠ corrected 2026-09-07 from "~9";
      the 9 came from a decorative-token pattern (`⭐ ⚠ ⛔ ** [merged`) that cannot see the two hand
      notes written in plain prose, at `authz-writepath-audit-findings.md:60` and `:61`. The merge
      classifier uses no pattern at all and protects all 11 — verified verbatim, delta 0), a `---`),
      the `CARRIED` block enumerated
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
Make the write arm's committed baseline cover every write-capable policy the widened domain selects
(**107** policies + **13** guards = 120 cases; the committed file verdicts **51 of 120** — 39 of 107
policies and 12 of 13 guards, `public.set_primary_subject(uuid)` never verdicted), record a verdict
for the three `storage.objects` INSERT policies, and make the arm's empty-set and killed-run
behaviour findings rather than silence — before AE5 re-keys write policies eleven times against it.

### Done since start
- Harness built (uncommitted at time of writing): `CASES` set-ness fix, `RESET_EVERY` port with a
  retry net, an owner-aware connection role, a `SELFTEST` arm (the file had none), the DRYRUN
  banner's count derived. Every change proven with a planted reproducer at its **bare** exit code,
  a clean negative control and a discrimination half; each self-test table shown able to go RED
  before its green was believed.
- The three `storage.objects` INSERT policies **swept and verdicted COVERED** as plain `postgres`.
- Merge protected set emitted and reconciled against the reader-visible inventory: **delta 0**.
- `npm run lint` 0/0, `npm run typecheck`, and `npm run test:db` on a fresh reset all green
  (Files=262, Tests=8876 — shape unmoved). No production change: the `main...` diff over
  `supabase/migrations`, `seed.sql`, `src` is EMPTY.

### In progress
- **STOPPED at the pre-launch checklist, before the full run** (ruling R12: a failed item means do
  not launch). One item cannot pass as written — see Blockers.

### Next
- Lead/PO rules on the owner-aware role → launch the full run (**derived window ≈ 3.6–5.0 h**, from
  measured per-case 99 s × 120 + 5 resets × 165 s + retries) → CARRIED enumeration → re-file →
  closures → ADR 0192 → gate → QA → PO → Record.

### Blockers
- ⛔ **R11's premise is refuted by measurement.** The owner-aware escalation was approved to rescue
  three `storage.objects` policies predicted to fail as `postgres`. They do not fail: `supautils`
  grants POLICY DDL outside `pg_class.relowner`, so ownership was a proxy, not the property. Under
  the corrected predicate **0 of 107** policies need the escalated role, so R11.2's "prove the
  escalated direction on a storage policy" is unsatisfiable without building a case to fit the test.
  Needs a ruling: keep the (dormant) branch, or remove it.
- ⚠ Batch 4 runs on a separate machine in parallel; merge order is Batch 3 FIRST.
