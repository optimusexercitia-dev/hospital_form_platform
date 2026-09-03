# FUP-W1-STALE-GRANTROLE-MUTANTS — three mutants pinned to a signature that no longer exists: a harness that CANNOT FAIL, reported as one that cannot run (owner: backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

- 🟠 **FUP-W1-STALE-GRANTROLE-MUTANTS** — filed 2026-08-28, found while repairing `w1`'s control for
  ADR 0167 and **verified pre-existing** (reproduced independently of that change).

`supabase/tests/mutation/w1-membership-mutation-audit.sh`'s mutants `revert_replacement_arm`,
`revert_outgoing_authority` and `naive_delete_insert` call
`pg_get_functiondef('public.grant_role(text,uuid,text,uuid,uuid)')` — **a 5-argument signature that
does not exist** (live is 6-arg). The cast throws and the file aborts: **`ABSENT(aborted)`, 3 of 9
mutants.** They also needle the **pre-`_for` spelling** (`app.is_admin()`,
`app.is_tenancy_admin_of(p_scope_id)`, `granted_by = (select auth.uid())`), superseded when ADR 0094
W3/T3.3 moved the logic into `app.grant_role_impl` with an explicit `p_actor`.

⛔ **The failure mode is the dangerous one and is why this is filed rather than fixed in passing:**
a mutant pinned to a signature that no longer exists is **a harness that cannot fail, reported as a
harness that cannot run.** `ABSENT` reads like an infrastructure note; it is an **unproven
keystone**. Three of nine keystones in this file have been proving nothing, and nothing reds.

**Owed:** re-point all three at `app.grant_role_impl` and the current spelling, then **prove each RED**
before accepting the file's verdict again. ⚠ Do not merely make them run — a mutant that runs and
holds is exactly what the current state already claims.
