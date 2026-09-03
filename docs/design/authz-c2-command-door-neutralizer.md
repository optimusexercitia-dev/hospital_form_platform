# The command-door neutralizer — closing C2's long pole

**Date:** 2026-08-31 · **Status:** BUILT and PROVEN on a subset; the full sweep has **not** run ·
**Owner:** lead + backend
**Instrument:** [`supabase/tests/mutation/c2-command-door-neutralizer.sh`](../../supabase/tests/mutation/c2-command-door-neutralizer.sh)
**Sizing it serves:** [authz-c2-tier1-sizing.md](authz-c2-tier1-sizing.md) §8b (Tier 1 = 237 doors)

---

## 1 · Why nothing existing could do this

Every prior authz sweep neutralizes a **boolean** gate — `p0-authz-door-audit.sh` rewrites a
predicate body to `select true`, or opens a policy with `USING (true)`. C2's command doors return
`jsonb` / `uuid` / `void` / a composite. **There is no boolean to flip**, which is exactly why they
sat outside every arm's domain (ADR 0079; `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`). The sizing could
name 237 doors and still not sweep one of them.

## 2 · ⭐ The unit of work is the ENFORCER, not the door

Measured over the 237 Tier-1 doors: their delegation closures contain **243 distinct enforcers**,
of which **72** are already inside the bool arm's domain and **171 are not**. Those 171 are the
worklist. **The door list is the ATTRIBUTION map, not the work list** — sweeping per door would
re-run the same mutation dozens of times (`app.assert_rca_writable` alone is depended on by 22
Tier-1 doors).

This reframing is what makes the sweep affordable at all: 171 mutations instead of 237, each
carrying a "doors depending" count so a BLIND verdict states its own blast radius.

## 3 · The mutation: neutralize the GUARD, never the EFFECT

An authz `raise` becomes `null;`. The guard stops firing; everything the function actually *does*
survives.

⛔ **This distinction is the whole design.** The obvious alternative — stub the door's body — is
wrong in a way that produces a confident false verdict. `public.grant_role`'s entire body is
`perform app.grant_role_impl(...)`: stubbing it removes the **work** along with the **guard**, the
suite fails because nothing happened, and that reads as **COVERED** for entirely the wrong reason.
A mutation must isolate the property under test.

**Anchor:** `raise exception … using errcode = '42501'|'HC0xx';`. Measured across the 171: **458**
authz raises, **457** matching the anchor. ⛔ The harness **refuses a verdict it cannot fully
neutralize** — if a target's anchored count differs from its total, it records **ERROR ·
UNMUTABLE** rather than mutating some raises and reporting on a function that still guards. (The
one outlier today is `public.save_block_to_library`, 5 raises / 4 anchored.)

## 4 · Verdicts

| verdict | meaning |
| --- | --- |
| **COVERED** | mutated run FAILS **and** the restored run comes back GREEN — a keystone asserts through this guard |
| **BLIND** | mutated run PASSES — nothing in the suite noticed the guard vanish |
| **ERROR** | run shape changed, mutation did not land, rollback failed, or the target is unmutable. ⛔ **ERROR IS NOT A PASS.** |

⭐ **Red alone is not COVERED.** The baseline is captured once, at the top of the run; if the tree
drifts afterwards a later failure is drift, not the mutation. **The red-then-GREEN pair carries the
verdict**, which is why a COVERED case costs two suite runs and a BLIND one costs one.

## 5 · Safety properties, and why each is there

- **Prove the harness before trusting it** (`SELFTEST=1`): the probe must **move** the definition
  hash and the restore must bring it **back exactly**. A harness that silently fails to mutate
  reports BLIND for everything and reads like a thorough sweep.
- **Assert the mutation landed** — hash compared before/after; an unchanged hash is ERROR, never a
  verdict.
- **Prove the rollback** — hash must return to its pre-mutation value; if it does not, the run
  **aborts** rather than continuing against a tree it has left open.
- **Crash safety** — the restore SQL is written to a fixed-path `INFLIGHT` sentinel *before* the
  mutation and replayed on `EXIT`/`INT`/`TERM`/`HUP`, and at the *start* of the next run. ⛔ The
  sentinel is deliberately **not** under `$WORK`, which is per-run and would hide it from the run
  that needs it.
- **Preflight** — refuses to start if any `app`/`public` function already has a degenerate body,
  because every verdict would then be measured against a tree that is already open.
- **Red-baseline abort** — if the suite is failing before any mutation, no verdict is attributable.
- **Subset runs write to SCRATCH** (ADR 0153) and the committed baseline is `cksum`-verified
  unchanged on exit.
- ⛔ **A run that swept ZERO exits 2.** Without this, a `CASES=` typo finds 0 BLIND and 0 ERROR and
  exits 0 — a green that reads like a clean sweep. An unmatched `CASES` token is named, never
  silently ignored.

⚠ **Never kill a running sweep** — [`.claude/rules/mutation-harnesses-are-not-killable.md`](../../.claude/rules/mutation-harnesses-are-not-killable.md).
Let a contaminated run finish and discard its verdicts. ⛔ And never pipe it through `head`/`tail`:
that can SIGPIPE it mid-mutation, and the exit code you read is the pipe's.

## 6 · ⚠ Four bugs the proving caught — none of which would have failed loudly

Recorded because each is a *class*, not a typo:

1. **The shape detector matched zero lines.** It grepped for raw TAP (`^ok` / `^not ok`); the
   runner is `prove`-style (`Files=N, Tests=M`). Baseline shape was `0`, so every mutated run would
   also have been `0` and the suite-aborted check would have passed **vacuously for every case**.
2. **`swept 0 of 171`, exit 0.** A `CASES` token that matched nothing produced a clean green. This
   is precisely what `.claude/rules/authz-gate-results-need-a-current-baseline.md` exists for: *an
   arm cannot report that it measured nothing — that IS the failure mode.*
3. **The read loop took 6 TSV columns into 5 variables** — a patch believed applied that had not
   been, shifting every field by one. ⭐ Verify the edit landed; do not trust that it did.
4. **The VERDICTS comment promised a restored re-run the code did not perform.** The doc was right
   and the code was wrong — a comment asserting a property nothing enforced.

⛔ Addressing by **oid**, never by signature: `pg_get_function_identity_arguments` includes
parameter *names* (`p_rca_id uuid`), which `regprocedure` rejects.

## 7 · Cost, and what it is not

**171 enforcers × 1–2 full-suite runs.** The full suite is `Files=248, Tests=8289`. This is a
**periodic audit, never a phase step** — the phase-step equivalent is a `CASES=`-scoped run over
whatever a diff touched.

## 8 · Status — proven on BOTH polarities; the full sweep has NOT run

Proven against the full suite (baseline `Files=248, Tests=8289`, PASS), committed baseline
`cksum`-verified untouched on every run:

| enforcer | doors depending | verdict |
| --- | ---: | --- |
| `public.withdraw_correction` | 1 | COVERED |
| `app.assert_rca_writable` | 22 | COVERED |
| `app.assert_referral_due_future` | 4 | COVERED |
| `app.assert_documents_wave_c_enabled` | 2 | COVERED |
| `app.assert_charters_enabled` | 2 | COVERED |
| `public.nsp_org_capa_rollup` | 1 | **BLIND** |
| `public.cancel_session` | 1 | **BLIND** |
| `public.cancel_event` | 1 | **BLIND** |

⭐ **The detector is proven able to return BOTH verdicts.** After the first five all came back
COVERED it was, on that evidence, indistinguishable from a detector that can only ever say
COVERED — so the BLIND polarity was proven deliberately rather than waited for.

⭐ **The BLIND candidates were DERIVED, not guessed**: enforcers whose dependent doors appear in
`authz-neverclled-door-allowlist.txt`, where nothing calls the door and so nothing can notice its
guard vanish. 3 of 3 came back BLIND. ⚠ That cross-reference is a candidate generator, **not** a
predictor — the allowlist's own header records that a deny-only `throws_ok` never registers as a
call, so some never-called doors will still be COVERED.

### ⛔ These three are REAL FINDINGS, not controls

| enforcer | pgTAP files mentioning it | reading |
| --- | ---: | --- |
| `public.nsp_org_capa_rollup` | **0** | no test touches it at all |
| `public.cancel_event` | **0** | no test touches it at all |
| `public.cancel_session` | **1** | ⚠ **a test exists and still does not notice the guard vanish** — the sharper case of the two shapes |

`cancel_session` is the one worth reading twice: coverage existed and was not a keystone. *Presence
of coverage is not a verdict.* Each needs a keystone; ⛔ **BLIND is never allowlisted away**, and an
allowlist entry here would make the floor arm and this arm AGREE while both measure nothing.

### What is still owed

✅ **THE FULL SWEEP RAN 2026-09-02 — 171 of 171: COVERED 109 · BLIND 40 · ERROR 22**, against a
`Files=259, Tests=8685, PASS` baseline at **53 s/run, ~5 h**. ⛔ **This §'s cost figure of ~23 s/run
(~2.2 h) was WRONG by more than 2×** — measure, do not extrapolate.

⛔ **C2 REMAINS OPEN, and the reason is this instrument, not the doors.** The anchor
`errcode = '(42501|HC0[A-Z0-9]{2})'` is a **syntax, not a property**
(`FUP-C2-NEUTRALIZER-ANCHOR-BLIND-TO-HCDS-AND-28000`): it excludes `HCDS*` + `28000` from the
worklist entirely (the gate-fn filter shares it), sweeps in non-authz **state** guards (`HC038`,
`HC043`), and cannot span a `;` inside a message (35 raises; ✅ fix validated 2294/2294, 0
regressions). ⛔ **A verdict from this harness is `HC0*`-coded-guard coverage, NOT authorization
coverage** (ADR 0180 point 5). 22 doors carry no verdict at all.

⚠ **A wrapper's trailing `echo` erases the harness's exit code** — hit while proving this: the
background job reported exit 0 while the harness itself returned 1 for `BLIND=3`. Read the verdict
counts in the report, never the shell's status.
