# ADR 0180 — `authz.scope_reaches`: the commission→organization ascent reads `commissions.organization_id`

**Status:** accepted
**Date:** 2026-09-02

## Context

The AE4 performance acceptance (`docs/design/authz-ae4-performance-acceptance.md`, obligation
`FUP-AE4-PERFORMANCE-EVIDENCE-ON-THE-FINAL-PATH` / audit finding IA-F9) ran four times and
localized its failing condition to one function. Run 4's controls passed — DC1b moved the
measured statement **14.17× / 15.92×** when cost was planted in `authz.scope_reaches`, against
**1.52×** for `authz.assignment_facts` — so the term is attributed by measurement, not inference.
⛔ IA-F9's founding premise (the non-inlinable DEFINER SRF evaluated per row *is* the regression)
does not survive: that SRF is real, is per-row, and is **1–3 %** of per-protected-row cost.

Measured on the live catalog against the ANALYZEd perf fixture (12 000 users / 10 000
`professional_profiles` / 48 800 `memberships`), 2026-09-02:

- The organization-from-commission ascent plans as an **InitPlan Hash Join** — `Seq Scan on
  hospitals h (rows=124)` probed against a hash of the single commission row, **5 buffers**.
- ⭐ **The 8 240 `Seq Scan on hospitals` split 4 120 / 4 120 across TWO InitPlans**, not one. The
  acceptance doc attributes all of them to the join; InitPlan 2, the organization-from-**hospital**
  arm, seq-scans independently (`Filter: (id = $2)`, width 16, **2 buffers**). Executed counts
  3 417 / 603 — a 5.67:1 ratio matching the measured principal's 17 commission-scope vs 3
  hospital-scope memberships.
- The mechanism is not exotic: `public.hospitals` is **124 rows in 2 pages**, so a full scan costs
  `3.24` and a `hospitals_pkey` descent costs `8.29`. The planner is locally correct.

⚠ **A claim in the acceptance record does not survive measurement and is corrected here.** §§10.3
and 11.4 call this term `O(protected_rows × M × |hospitals|)` — *"the only part of the chain that
scales with tenant count"*. Measured against `ANALYZE`d copies of `hospitals` at 124 / 620 / 1 984
/ 19 964 rows carrying identical indexes: the join flips to `Nested Loop` + `Index Only Scan` by
~2 000 rows, and the hospital arm flips at **620 rows / 9 pages**. The seq scan is a **small-table
artifact the planner corrects on its own** as tenants are onboarded, not a tenant-count term.

What *is* a defect at every cardinality: the join fetches `h.organization_id` when
`public.commissions` already carries `organization_id`, and `commissions_hospital_org_fkey —
FOREIGN KEY (hospital_id, organization_id) REFERENCES hospitals(id, organization_id)` makes the
two provably the same value. The ascent was paying a table scan and a 124-row hash build per call
to re-derive a column it already had.

## Decision

1. **The organization-from-commission arm reads `commissions.organization_id` directly**
   (`20261003007310`). One arm changes; signature, volatility, `SECURITY DEFINER`, empty
   `search_path` and ACL are re-emitted unchanged. Measured 5 buffers → **3**, and the hash build
   disappears.
2. **The equivalence is grounded in constraints, not observation**, and both ends assert it: the
   migration's **preflight refuses to apply** if `commissions_hospital_org_fkey` or either `NOT
   NULL` is absent, and pgTAP **412 §1** pins the same three catalog facts so a later migration
   cannot remove the ground under the body silently.
3. **NULL-vs-FALSE semantics are preserved exactly.** The scalar-subquery shape is kept rather
   than rewritten to `exists`, which would return FALSE where the shipped body returns NULL. Both
   callers (`authz.entailed_grants`, `authz.explain_permission`) use the result inside a `WHERE`,
   where the difference is invisible — which is *why* it is pinned (412 §5) rather than relied on.
4. ⛔ **The organization-from-hospital arm is left alone.** Forcing it onto `hospitals_id_org_uq`
   was measured **buffer-neutral** (2 vs 2), so it would move no cost. The only available lever is
   `ALTER FUNCTION … SET enable_seqscan = off`, a planner override baked into a `SECURITY DEFINER`
   authorization function that would make condition P1 pass for a reason unrelated to P1's purpose.
   **Rejected: that is greening a condition by deleting its subject.**
5. **P1 is therefore expected to keep FAILING, and is reported as FAILING.** The threshold is not
   re-derived and the wording is not relaxed. The specification gap is filed as
   `FUP-AE4-P1-BOUNDS-A-SYNTAX-NOT-A-PROPERTY` for the PO to rule on separately, with the measured
   crossover as its evidence.

## Consequences

- The acceptance re-runs against this body as **run 5**. P5's threshold (≤ 4×) is unchanged;
  a same-session A/B measured the permission arm at **24 890 ms → 14 589 ms**, which is a
  reduction, not a predicted verdict — the run decides.
- ⛔ `authz.scope_reaches` acquires its first direct test coverage. Before **412**, no pgTAP
  assertion anywhere called it: the organization-from-hospital and hospital-from-commission arms
  were asserted in **neither polarity**, and the absent-id NULL behaviour nowhere. That gap was
  found by putting the function under review, and it was not created by this change.
- 412 §3 plants a wrong ascent and requires the differential to go **RED**, then restores from
  `pg_get_functiondef()` captured from the catalog — not from a copy written in the test.
- The AE4 hold stands: no merge, no `db:push`, no `git push`.
