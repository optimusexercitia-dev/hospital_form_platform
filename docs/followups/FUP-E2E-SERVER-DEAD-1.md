# FUP-E2E-SERVER-DEAD-1 — the prod-standalone server dies under load in ~3 of 17 batches, and `BATCH_TESTS=22` is the known rescue (owner: unassigned)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-19 · status parked

Filed from the ETH·E4 handoff §3, where it was called out but never given an id. In one
`e2e:prod` run, batches **5, 16 and 17 all hit `server_dead=1`**; 5 and 17 recovered on the
automatic `INFRA_RETRY`, **16's retry died too**, leaving 69 tests with no verdict and turning
a run with **zero assertion failures** into a RED gate. The rate is drifting: 1 of 17 earlier
the same day, 3 of 17 by evening.

Known-good workaround, used successfully **twice** on two different dead groups: re-run the
group alone at `BATCH_TESTS=22` (smaller batches ⇒ more frequent server restarts). The
Flexible-Forms group (`ff1`–`ff5` + `flagged-aggregate-result`) stresses it regardless of
batching — its own sub-batches hit `server_dead` and recovered.

**This is an infrastructure characteristic, not a product defect** — no assertion has ever
failed in one of these batches. It is filed because it costs a full gate re-run each time it
bites, and because "infra is not a pass": a batch that never produced a verdict must not be
read as green.
**⭕ NEW DATA POINT — ADR 0137 batch, 2026-08-24: 4 of 20 batches.** `REBUILD=1 npm run e2e:prod`,
batches **5, 6, 9, 12** each `server_dead=1` (conn_errors 1 / 38 / 72 / 64). **All four recovered on
`INFRA_RETRY`**, so the run finished `GATE GREEN`, exit 0 — 1221 passed, 0 failed, 0 infra,
0 did-not-run.

⚠ **The rate is still drifting: 1/17 → 3/17 → 4/20.** And the run IMMEDIATELY before this one
(same tree, same day) is the counter-example that makes this expensive rather than cosmetic:
batch 6 died, **its retry did not recover**, and a run with **zero assertion failures** exited
**5 (UNRUN)** with 10 tests never executed. Recovery is luck, not a property.

⭐ The gate is doing its job — clean/unproven/dirty stay partitioned, so a stack death never reads
as a regression. What it cannot do is make an unrun test proven. `BATCH_TESTS=22` remains the
recorded rescue and is still unapplied.

⭐⭐ **A MECHANISM, 2026-09-02 (AE4.9 gate runs) — this entry previously had only a symptom.**
The dying server is not gone: it **binds :3000 and answers `/login` with HTTP 404 in 13 ms**,
having logged `✓ Ready in 0ms`. That "0ms" is the tell — a real prod-standalone boot is not
instant, so this is a boot that **never completed** while still taking the port. Every test in
the batch then burns its full 30 s timeout, and `pg_stat_activity` shows **zero** query activity
for the whole window. ⛔ **Consequence for diagnosis: the batch is not hung and the log is not
frozen** — it is grinding through timeouts, so "no output for N minutes" reads identically to a
stall. Check the *batch* log and `curl` the port, never the gate's top-level log alone.

⚠ **ATTRIBUTION CORRECTED, and it changes the fix.** A reading that "the harness degrades over
the run" was formed from one run (deaths at batches 14/18/19) and is **retracted** — this
entry's own history has 5·6·9·12·16·17, i.e. scattered. **PO input: a second workload was
running on the machine throughout, including a second Supabase stack (`supabase_*_escalume`,
ten more containers).** Resource contention explains both the scatter and that run's clustering;
a time-based leak explains neither. ⛔ So the first question on any future occurrence is *what
else is running*, not *which specs*.

⛔ **AND THE FF FAMILY WAS NEVER SPECIAL.** The prior record's *"batch 7 was auto-re-run once and
got WORSE, 56→62"* invited a "those seven spec files stress it" reading. Measured 2026-09-02 on a
quieter machine: batch 7 = **70 passed, 0 failed, accounted 70/70, `pw_exit 0`**. The deaths land
wherever the machine is loaded.

⚠ **Two operational traps, both paid for on 2026-09-02:** (1) **never kill the gate while it is
mid-`supabase db reset`** — the DB is left half-applied and the gate's own recovery reset then
dies on `CREATE SCHEMA IF NOT EXISTS "app"` (already exists), aborting `GATE_EXIT=4` *"stack
unrecoverable — NOT a test result: nothing was proven"*; recovery is a plain
`supabase db reset --local` once nothing holds the DB. (2) When clearing leftovers, **scope the
process match to this repo's path** — an unscoped match on `playwright` / `supabase.js db reset`
killed a *different project's* Playwright run on the same machine.

⭐ `BATCH_TESTS=22` **was applied** on 2026-09-02 and the run completed with 0 assertion failures —
but it is **not evidence the knob works**: the machine was freed and the stack repaired in the
same change. Three variables moved at once; the confound is recorded rather than resolved.
