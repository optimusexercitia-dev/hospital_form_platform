# FUP-AUTHZ-HARNESS-TRANSACTIONAL — the door-audit harness neutralizes OUTSIDE a transaction, so process death leaves an authz gate OPEN (owner: lead + backend; filed 2026-08-14, DM5 S2, after it happened)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-14 · status open

**It happened.** During DM5 S2, `app.can_write_document` — the gate for **every** document write across all
eight home types — sat live with the body `begin return true; end` on the shared stack. **An
unconditional allow.** Found by `tester`, which halted all E2E rather than produce green results against
it; independently confirmed by `backend-assurance`; and traced to a **lead instruction** that said
*"neutralize and confirm your block goes red"* **without saying transactionally**, on a stack two other
teammates were live on.

**The structural defect, which outlives the incident.** `p0-authz-door-audit.sh` restores via an **`EXIT`
trap** plus a re-fetch/byte-compare. That is good design and it is **not enough**: the trap **does not fire
when a subagent's turn ends and the process is killed** — which is the documented failure mode for the
heavy sweep. Because the harness neutralizes **outside** a transaction, **process death = gate left open**,
silently, with no marker in the catalog.

> ## ⛔ AMENDED 2026-08-17 — **THE FILED FIX CANNOT BE BUILT, AND BUILDING IT WOULD BE WORSE THAN THE BUG.**
> **Partially resolved by a different mechanism; the item stays OPEN at 🟠 for the residual.**
>
> The fix below is correct about Postgres and wrong about *this harness*. A rolled-back transaction
> makes DDL invisible **outside the session that issued it** — and `p0-authz-door-audit.sh`'s probe is
> not that session. `run_suite` shells out to **`supabase test db`, a separate process** with its own
> connections; the script's own header says it "mutate[s] the LIVE, COMMITTED catalog". Held in an
> uncommitted txn, every case would run against the **original** gate and classify **COVERED** —
> a sweep that is 100 % green and 100 % **vacuous**. ⭐ *The commit-then-restore design is REQUIRED by
> the probe's process boundary; it was never an oversight.*
>
> **What shipped instead — make the failure LOUD rather than impossible.** Process death can still
> leave a gate open; it can no longer do so unnoticed.
> - **Preflight in `p0-authz-door-audit.sh` (§7.16)** — refuses to start a sweep on a contaminated
>   stack, `exit 2`, naming the function. This is exactly the manual check that caught the original
>   incident. **Proven able to fire** against a planted unreferenced degenerate function.
> - **Preflight before EVERY arm of `p0-authz-invariant.sh`** — so the standing §6 gate step sees it.
>   Deliberately *not* a sixth arm: that would need CLAUDE.md §6 taught a new name, and a left-open
>   gate should fail **all** the arms it invalidates.
>
> ### ⚠⚠ The detector recorded below was blind to TWO of the THREE neutralization forms
> The regex in this item — `^\s*begin\s+return\s+(true|false)\s*;\s*end` — is **plpgsql-only**. The
> harness also emits **`select true`** (`language sql`) and **`begin return; end`** (the `assert_noop`
> void raise-guard). Measured: `app` + `public` hold **182 SECURITY DEFINER `language sql`** functions,
> and `'select true' ~ <that regex>` is **false**. So the query that bounded the original blast radius
> to *"exactly one hit"* — a **correct** result for that incident, which was plpgsql — **could not have
> seen a SQL-language gate at all.** ⭐ *An enumeration bounded by a SYNTAX rather than the PROPERTY,
> living inside the safety net.* All three forms are now covered, and the detector was proven able to
> find 2 constructed instances before being trusted at 0.
>
> **Residual, why this stays open:** nothing yet *restores* automatically after process death — the
> guards detect, they do not repair. A committed marker row written in the same transaction as the
> neutralization (so the two can never disagree) would let the next run self-heal; not built.

**The fix (not built): make neutralize → probe → restore a single rolled-back transaction.** Postgres DDL
is transactional, so a `CREATE OR REPLACE FUNCTION` inside a rolled-back `begin` leaves **no residue** —
`backend-assurance` proved this rather than assuming it: md5 of `pg_get_functiondef` before, gate replaced
in-txn, probe run, `rollback`, re-read → **byte-identical, same md5**. That makes the failure mode
**structurally impossible** instead of trap-dependent.

⚠ **Two forensic properties worth knowing before the next incident:**
- **`pg_proc` carries no mtime**, so a neutralization **cannot be dated from the catalog**. The only lower
  bound here was a `pg_get_functiondef` capture the sweep happened to leave in a scratchpad. **Any result
  produced in the unknown window must be RE-RUN, not re-read.**
- **The detector that found it is worth keeping**: sweep `app` + `public` for any body matching
  `^\s*begin\s+return\s+(true|false)\s*;\s*end` — it is the *property* (a degenerate always-true/false
  door) rather than a list of names. It returned **exactly one** hit, which is also how the blast radius
  was bounded to a single function. ⭐ **Consider making it a standing gate step** — it is one query, and
  a left-open gate is otherwise invisible to every arm, since all four arms test doors that *exist*.

⛔ **Do not read this as "the harness is unsafe to run."** It is safe when its process completes; the gap
is process death mid-run, which subagent turn boundaries make routine. Related:
[[mutation-harness-must-prove-its-rollback-first]] — the same class, previously recorded, where a sweep
left a gate open and `| tail` masked exit 2 as 0.
