# FUP-PERF-ANALYZE-ENDS-AE0-COMPARABILITY — the AE4 performance acceptance and the AE0.2 baselines cannot coexist on one instance

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

The AE4 performance acceptance requires a **scaled, `ANALYZE`d** fixture. The AE0.2 baselines are defined
on a **never-`ANALYZE`d** database and their own document forbids analysing before a re-run. Running the
AE4 acceptance therefore **ends AE0 comparability until the next `supabase db reset --local`**, with no
artifact recording that it happened.

**How it was measured.** Read from the AE0.2 baseline document's own preconditions and from the AE4
acceptance protocol in `../design/authz-ae4-performance-acceptance.md`.

**What would close it.** Sequence the DB window so no AE0 comparison is owed after the perf run, and say
so in the window's plan; or re-base AE0.2 onto an analysed instance, which is its own decision.

⛔ **What must NOT be mistaken for closing it.** Running the perf acceptance and then "remembering" to
reset: the reset restores the *state*, not the knowledge that an intervening AE0 comparison was invalid.
