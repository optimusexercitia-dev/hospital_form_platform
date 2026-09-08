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

**Updated:** 2026-09-08

### Objective
Make the write arm's committed baseline cover every write-capable policy the widened domain selects
(**107** policies + **13** guards = 120 cases; at open the committed file verdicted **51 of 120** —
39 of 107 policies, 12 of 13 guards, `set_primary_subject` never verdicted), record a verdict
for the three `storage.objects` INSERT policies, and make the arm's empty-set and killed-run
behaviour findings rather than silence — before AE5 re-keys write policies eleven times against it.

### Done since start
- Harness built: `CASES` set-ness fix, `RESET_EVERY` port (retry net + an Arm-1-specific post-reset
  OID check the door's design does not cover), a `SELFTEST` arm (the file had none), the DRYRUN
  banner's count derived from `GUARD_KEYS` — each proven with a planted reproducer at its **bare**
  exit code, a clean negative control and a discrimination half.
- ⭐ **The superuser escalation was built, then REMOVED** (PO ruling R23). Its premise — ownership —
  was a **proxy**, not the property: `supautils.policy_grants` grants POLICY DDL outside
  `pg_class.relowner`. One role (`postgres`) for all 120 cases; the corrected predicate is kept as
  a **DETECTOR** leaving a policy UNVERDICTED rather than routing around it — dormant on 0 of 107,
  so **proven able to fire by a plant** against a clean negative control.
- The three `storage.objects` INSERT policies **swept and verdicted COVERED** as plain `postgres`,
  each row carrying `via supautils.policy_grants`. `RECOVER=1` re-earned on a **storage** policy
  with no role sidecar, with a discrimination half proving the catalog verification load-bearing.
  **ADR 0192** written and indexed.
- ⭐ **THE FULL RUN IS DONE** (2026-09-07 20:11 → 2026-09-08 00:04, **3.88 h**, inside the derived
  3.2–4.6 h window). `guard=13/13 policy=107/107` · **SWEPT 120 · COVERED 102 · BLIND 15 · ERROR 3
  · SKIPPED 0** · `resets=8` · bare **rc 1 (DIRTY)**. Coverage moved **51 of 120 → 120 of 120
  measured**, 117 carrying a verdict; the guard arm is now **13 of 13**. Run health: 117/120
  runlogs at the exact baseline shape, longest consecutive off-baseline run **1** (VOID threshold
  3), **0** aborts/contamination/restore failures, no sentinel, `degenerate_NON_SELECT = 0`. R20:
  **all 13 retired door rows PRESENT and COVERED, 0 missing** — no verdict was orphaned.
- ⭐ **The CARRIED disposition is APPLIED** (PO ruling R30): 9 re-filed, 36 deleted, line 27's stale
  tail deleted; the file went 401 → 251 lines, the CARRIED block replaced by a dated `## Note`.
  **Condition 1 caught 0 rows** — for all 45 the carried citations are a subset of the live row's,
  and the matcher was proven able to find one before its zero was believed. **R14 re-asserted by
  byte comparison: 15 protected strings, all present, bare rc 0**, three mutations proving red.
- ⚠ **Finding inside the disposition:** for 6 of the 9 the "hand commentary" was a *superseded
  provenance* stamp, false of the live verdict, whose substantive half was already on the live row.
  Re-filed verbatim but **attributed**. Third instance here of *decoration read as authorship*. The
  merge's **51 / 2 / 6** reconciled: three counters, three populations, each derived
  (`63 − 10 − 2 = 51`); the 6 were carried rows and neither suffix holds that string.
- ⭐ **Gate at the tip GREEN**, every code read **bare**: `lint` **0** (eslint 0/0) · `typecheck`
  **0** · `test:db` on a fresh reset **0** at **`Files=262, Tests=8876`** (⭐ shape unmoved) ·
  deriver `SELFTEST` **0** (34/34) · door harness `SELFTEST` **0** (23/23) · set-valued targeted
  home **0** (CLEAN, 3/3 COVERED, restores byte-exact) · production diff **EMPTY**. The
  diff-scoped deriver is **rc 3 NOT-APPLICABLE** over both `main..HEAD` and `23ec1fa5..HEAD` (0
  migration files), its counter proven live by a positive control. ⚠ The four authz arms are the
  **lead's** to run at the tip, not the builder's.

### In progress
- Lead runs the four authz arms → QA → PO → Record. ⛔ Owed before QA: the 3 follow-up closures.

### Next
- Deferred to their own units by design: keystones for the 15 BLINDs (⛔ never allowlist), and the
  `297_process_template_versioning.sql` repair — ⭐ fixing 297 moves `Tests=`, and `Tests=` **is**
  the shape this run asserted 120 times, so fix and run cannot coexist in one unit (R31).

### Blockers
- ⚠ Batch 4 runs on a separate machine in parallel; merge order is Batch 3 FIRST.
