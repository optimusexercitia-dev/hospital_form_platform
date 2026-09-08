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
adrs: ["0079", "0153", "0173", "0189", "0190", "0191", "0192"]
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

- [x] `FUP-WRITEPATH-FINDINGS-FILE-COVERS-33-OF-107` 🟠 — "One full write-path sweep over the
      widened domain, with its rows merged into the committed findings file — not replacing it, since
      the 33 carry hand-merged annotations." ⛔ Not closed by a green `FROMFINDINGS=1` run before the
      merge (green *because* the absent rows are absent), nor by the 2026-09-02 domain fix (repaired,
      not measured), nor by the 37-of-107 subset merge.
- [x] `FUP-STORAGE-OBJECTS-INSERT-POLICIES-NEWLY-IN-DOMAIN` 🟠 — "Sweep them and record a verdict per
      policy." A BLIND is a real finding to keystone. ⛔ Never allowlist one.
      > ⚠ **CORRECTION 2026-09-07 (`backend`, build turn).** The plan predicted all three would land
      > `ERROR — must be owner of table objects`, because `postgres` is `rolsuper=f` and
      > `pg_has_role('postgres', relowner,'USAGE')` = false for `storage.objects`. **Measured: all
      > three sweep and verdict COVERED as plain `postgres`** — `supautils.policy_grants` grants
      > POLICY DDL on Supabase-managed tables outside `pg_class.relowner`. Ownership was a PROXY,
      > not the property. No privilege change is needed for this clause. (`p3-storage-3case`,
      > bare rc 0, `SWEPT: 3 COVERED: 3 BLIND: 0 ERROR: 0`; restores byte-exact, degenerate
      > NON-SELECT = 0.) The clause still needs these verdicts recorded through the FULL run's merge.
- [x] `FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` 🟠 (Parts 2–4; Part 1 landed as deriver ruling 4) —
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
- [x] **The findings baseline re-earned through the merge** — ONE full write-arm run over the
      widened domain: detached, `RESET_EVERY` bounded (port Batch 0's design first if the writepath
      harness lacks it — it has 0 `RESET_EVERY` hits at open), hand-authored material preserved
      (2 `## Note` sections, 1 blockquote, **11** annotated rows — ⚠ corrected 2026-09-07 from "~9";
      the 9 came from a decorative-token pattern (`⭐ ⚠ ⛔ ** [merged`) that cannot see the two hand
      notes written in plain prose, at `authz-writepath-audit-findings.md:60` and `:61`. The merge
      classifier uses no pattern at all and protects all 11 — verified verbatim, delta 0), a `---`),
      the `CARRIED` block enumerated
      for a PO ruling and re-filed by hand with each re-filing justified; the four authz arms' figures
      re-derived at the new row count.
      > ⚠ **QA finding B1, fixed 2026-09-08.** The merge emitted the run's one `BLIND -> COVERED`
      > improvement (`responses.responses_delete_own_draft`) **COVERED inside the `## BLIND` table**,
      > so `blind_from_findings` returned **16** labels where the run measured 15. Row relocated by
      > hand; the writer half filed against
      > `FUP-AUTHZ-BLIND-SET-READ-FROM-THE-SECTION-NOT-THE-VERDICT`. ⛔ Census, not sample: **1 of
      > 120** rows disagreed with its section, **0** on `main`, and the detector was proven able to
      > find both polarities.
- [x] Every detector and exit path proven **able to fire** on a planted reproducer with the observed
      exit code, paired with a clean negative control and a discrimination half; every widening or
      port proven by **selection** on the live catalog; every restore verified in the catalog.
- [x] Gate: `npm run lint` 0/0; `npm run test:db` on a fresh reset green (shape unmoved); the four
      authz arms hold with domains quoted; `SELFTEST=1` on the deriver and the door harness; the
      diff-scoped sweep derived by the deriver over `main...HEAD` with its `SCOPE:` line quoted; and
      `git diff --name-only main... -- supabase/migrations supabase/seed.sql src` EMPTY (a harness
      change, not a gate change — state which).

## Current state

**Updated:** 2026-09-08

### Objective
Make the write arm's committed baseline cover every write-capable policy the widened domain selects (**107** policies +
**13** guards = 120 cases; at open the committed file verdicted **51 of 120** — 39 of 107 policies, 12 of 13 guards,
`set_primary_subject` never verdicted), record a verdict for the three `storage.objects` INSERT policies, and make the
arm's empty-set and killed-run behaviour findings rather than silence — before AE5 re-keys write policies eleven times.

### Done since start
- Harness built, each part proven with a planted reproducer at its **bare** exit code, a clean negative control and a
  discrimination half: `CASES` set-ness fix, `RESET_EVERY` port (retry net + an Arm-1 post-reset OID check the door's
  design does not cover), a first `SELFTEST` arm, the DRYRUN banner derived from `GUARD_KEYS`.
- ⭐ **The superuser escalation was built, then REMOVED** (PO R23): ownership was a **proxy**, not the property —
  `supautils.policy_grants` grants POLICY DDL outside `pg_class.relowner`. One role for all 120 cases; the corrected
  predicate kept as a **DETECTOR** that leaves a policy UNVERDICTED rather than routing around it — dormant on 0 of 107,
  so proven able to fire by a plant. The three `storage.objects` INSERT policies **swept COVERED** as plain `postgres`;
  `RECOVER=1` re-earned on a **storage** policy with a discrimination half. **ADR 0192** written and indexed.
- ⭐ **THE FULL RUN IS DONE** (2026-09-07 20:11 → 2026-09-08 00:04, **3.88 h**, inside the derived 3.2–4.6 h window).
  `guard=13/13 policy=107/107` · **SWEPT 120 · COVERED 102 · BLIND 15 · ERROR 3 · SKIPPED 0** · `resets=8` · bare
  **rc 1 (DIRTY)**. Coverage **51 of 120 → 120 of 120 measured**, 117 carrying a verdict; the guard arm is now **13 of
  13**. Health: 117/120 runlogs at the exact baseline shape, longest off-baseline run **1** (VOID threshold 3), **0**
  aborts/contamination/restore failures, no sentinel. R20: **all 13 retired door rows PRESENT and COVERED, 0 missing**.
- ⭐ **The CARRIED disposition is APPLIED** (PO ruling R30): 9 re-filed, 36 deleted, line 27's stale tail deleted; the
  file went 401 → **256** lines (⛔ *"251" corrected 2026-09-08, QA N1 — the gap was the 5 lines that same turn added and
  never re-measured*), CARRIED replaced by a dated `## Note`. **Condition 1 caught 0 rows** — for all 45 the carried
  citations are a subset of the live row's, and the matcher was proven able to find one before its zero was believed.
  **R14 re-asserted by byte comparison: 15 protected strings, all present, bare rc 0**, three mutations proving red.
  ⚠ **Finding inside it:** for 6 of the 9 the "hand commentary" was a *superseded provenance* stamp, false of the live
  verdict — re-filed verbatim but **attributed** (PO R33: keep as built; reducing 9 → 3 is a disposition CHANGE, not an
  application of one). Third instance of *decoration read as authorship*. Merge **51 / 2 / 6** reconciled: three derived
  counters, three populations (`63 − 10 − 2 = 51`), which also explains why line 27's stale tail survived.
- ⭐ **The three follow-ups are CLOSED and archived** (2026-09-08), each against its own quoted `Closes when`, entry +
  body moved verbatim (byte-diffed at the destination before the source was cut). **R27 FIXED**: the reset banner prints
  the DELTA, proven at the **second** reset — at the first, cumulative and delta coincide. A **third** instance of that
  class was found while fixing it (`READ ALL FIVE STEPS` above six) and repaired by deleting the numeral.
- ⭐ **Gate at the tip GREEN**, every code read **bare**: `lint` **0** (eslint 0/0) · `typecheck` **0** · `test:db` on a
  fresh reset **0** at **`Files=262, Tests=8876`** (⭐ shape unmoved) · deriver `SELFTEST` **0** (34/34) · door harness
  `SELFTEST` **0** (23/23) · set-valued targeted home **0** (CLEAN, 3/3 COVERED) · production diff **EMPTY**. The
  diff-scoped deriver is **rc 3 NOT-APPLICABLE** over both `main..HEAD` and `23ec1fa5..HEAD` (0 migration files), its
  counter proven live by a positive control.

### In progress
- QA **CHANGES REQUESTED** → fix loop **iteration 1 of ≤5 applied 2026-09-08**: B1 (a COVERED row
  inside the `## BLIND` table — a live gate input, fixed + census 1/120, 0 on `main`), B2, B3, B4 and
  N1–N5, plus one new follow-up (proofs cited by records are not reproducible from the repo).
- ⚠ **DISCLOSED, since no gate can register it:** this baseline takes `FROMFINDINGS=1 ARM=policy`'s write-arm BLIND set
  **3 → 15** and its off-allowlist offenders **0 → 5** (`cases`, `commission_member_titles`, `commissions`,
  `phase_results`, `process_template_versions` — each `*_admin_write`/`*_staff_admin_write`). ⛔ **Zero allowlist entries
  added**; the arm is red pre-existing, so the 5 is **derived from committed artifacts, not observed from a run**. Then
  re-review → PO → Record; the four authz arms are the lead's to run at the tip, not the builder's.

### Next
- Deferred to their own units by design: keystones for the 15 BLINDs (⛔ never allowlist), and the
  `297_process_template_versioning.sql` repair — ⭐ fixing 297 moves `Tests=`, and `Tests=` **is**
  the shape this run asserted 120 times, so fix and run cannot coexist in one unit (R31).

### Blockers
- ⚠ Batch 4 runs on a separate machine in parallel; merge order is Batch 3 FIRST.
