# FUP-ETHICS-CASE-DELETE-CASCADE — a commission `staff_admin` can `DELETE` an in-flight ethics case over PostgREST, cascading all SEVEN `ethics_*` tables, with ZERO audit rows naming any ethics entity (owner: backend + PO; found 2026-08-21 answering the PO's "were any doors opened?", ADR 0132)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

~~**⛔ PO-ruled RECORD-ONLY 2026-08-21 (ADR
[0132](../decisions/0132-ethics-proceedings-carry-no-erasure-entitlement.md)) — accepted and OPEN,
not fixed and not absent.**~~ Closing it is an RLS/gate change owing migrations, pgTAP keystones and
an ADR 0079 diff-scoped door sweep; it was deliberately not slipped into a documentation change.

### ⭕ RECORD-ONLY **LIFTED** 2026-08-31 (PO) → ADR [0170](../decisions/0170-case-deletion-is-not-a-client-capability.md)

**Remedy: `revoke delete on public.cases from authenticated`.** All four measurements above were
re-confirmed against the live catalog at head `20261003006800` and stand unchanged. Two new ones
decided the shape:

- ⭐ **Nothing deletes a case row.** No client `.delete()` on `cases` in `src/` or `e2e/`, and
  **zero** DB functions whose comment-stripped `prosrc` matches `delete\s+from\s+(public\.)?cases`.
  The capability is unused, so a total revoke costs no product regression.
- ⭐ **The grant was never a decision** — one of **158** identical `GRANT ALL ON TABLE … TO
  "authenticated"` lines emitted alphabetically by the squashed baseline
  (`20260620000000_baseline.sql:23322`); no `grant delete on public.cases` and no revoke exists in
  any of the 499 migrations. ADRs 0036/0037/0038/0064 each **explicitly** revoke DML on PHI tables;
  `cases` was simply never in that set.

**Its own gated increment, landing BEFORE AE4.3's `staff_admin` matrix** (PA-F8 **a**) — otherwise
AE4 derives a `staff_admin` case-delete permission from current behaviour and makes a capability an
accepted ADR forbids into the new system's regression oracle.

⛔ **Two traps the increment must carry:**
1. The revoke **pre-empts** `cases_staff_admin_write`'s DELETE arm — the
   `FUP-EVENT-PATIENT-POLICY-PREEMPTED` shape, where a `FOR ALL` policy still *reads* as the control
   while an absent grant is doing the work. **Pin the absence executably** so a future `grant`
   cannot silently re-arm a predicate nobody has re-evaluated.
2. pgTAP `110` §9 asserts `23514` as `authenticated`; post-revoke the refusal is `42501` **from a
   different arm** (`FUP-AE2-397-DENY-CELLS-SQLSTATE-ONLY`). **Re-base, do not retune:** keep the
   terminal-state guard under test at a privileged role **and** add a separate grant-absence
   assertion. One assertion may not carry both claims. (`296` and `328` delete as `postgres` and are
   unaffected.)

⚠ **Narrowed, not discharged:** the *"zero audit rows naming any ethics entity"* half. The general
case-deletion audit gap on privileged paths, and the absence of audit triggers on the `ethics_*`
tables, both stay open.

**Measured against the live catalog at head `20261003000300`, 2026-08-21, and confirmed BY
EXECUTION in a transaction — rolled back, pre-state re-verified byte-for-byte.**

⭐ **The finding is not "cases can be deleted". It is that the ethics lane's deliberate
write-lockdown is defeated by a parent that was never locked down.** Each of the nine `ethics_*`
tables is granted `select` **and nothing else** to `authenticated` (verified: three `grant select`
statements in the E2 intake migrations, no `insert`/`update`/`delete` anywhere), carries only a
SELECT RLS policy, and is written exclusively by **14 DEFINER RPCs none of which contains a
`DELETE`**. That is a real, intentional hardening — and the FK cascade walks straight through it.

| probe (same JWT: `chefe.ccih`, `active_role=staff_admin`) | result |
|---|---|
| `DELETE /rest/v1/ethics_case_details?case_id=eq.…` | ⛔ **403** `42501` permission denied |
| `DELETE /rest/v1/cases?id=eq.…` | ✅ **200** |

- **The cascade:** all seven case-scoped tables (`ethics_allegations`, `ethics_appeals`,
  `ethics_case_details`, `ethics_decision_details`, `ethics_findings`, `ethics_hearings`,
  `ethics_notifications`) carry `case_id … REFERENCES cases(id) ON DELETE CASCADE`.
- **The grant + policy:** `cases` grants `authenticated` DELETE; `cases_staff_admin_write` is
  `FOR ALL` to any commission `staff_admin` (`is_staff_admin_of(commission_id) AND NOT
  is_case_excluded(...)`). Both predicates measured TRUE for the seed persona.
- **The only bound is too narrow:** `app.guard_case_status`' DELETE arm raises only for
  `old.status in ('completed','cancelled')`. The CHECK admits five values, so `not_started`,
  `pending` and `in_review` — **every in-flight proceeding** — are deletable. ⭐ That is exactly
  the window in which a party has the strongest incentive to want the record gone.
- **Executed differential:** ethics case + details `1 → 1` before, `0 → 0` after the DELETE,
  `1 → 1` again after `rollback`. The probe MOVED state and the restore brought it BACK.
- ⛔ **Rule 11 gap on this path:** the statement emits **3** audit rows — 2 `case_access.revoked`
  + 1 `case.deleted` — and **none names any ethics entity**, because **no `ethics_*` table carries
  an audit trigger** (measured: 2 triggers across all nine, both document-scope guards, neither on
  DELETE). The proceeding's content vanishes leaving a row that says only *"Caso nº N excluído"*.

⚠ **Bounded, stated:** this is a structural finding about reachability. It does **not** claim
anyone has done it, and it does **not** enumerate the other case-composition children that share
the cascade — the sweep was scoped to the ethics lane the PO asked about. ⛔ A future reader must
not treat "ethics is the only lane affected" as measured; it was not asked.
