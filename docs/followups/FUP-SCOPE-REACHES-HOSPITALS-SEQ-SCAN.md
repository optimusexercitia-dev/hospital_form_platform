# FUP-SCOPE-REACHES-HOSPITALS-SEQ-SCAN — `authz.scope_reaches` seq-scans the whole `hospitals` table on every call, and it is the only authz cost that grows with tenant count

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

`authz.scope_reaches`'s organization-from-commission ascent plans as an **InitPlan Hash Join that
sequentially scans and hashes the entire `hospitals` table per call**, then joins it to a single
commission row — instead of two primary-key lookups.

```
InitPlan 1
  ->  Hash Join   Hash Cond: (h.id = c.hospital_id)   Buffers: shared hit=5
        ->  Seq Scan on hospitals h  (rows=124)       Buffers: shared hit=2
```

The term is `O(protected_rows × M × |hospitals|)` — **the only part of the authorization chain that
scales with TENANT COUNT.**

**How it was measured.** Nested `EXPLAIN` plans over a scaled ANALYZEd fixture (12 000 users, 10 000
`professional_profiles`, 16 000 form items, 48 800 memberships): **8 240** `Seq Scan on hospitals`,
against **zero** sequential scans on `memberships`, `profiles` or `commissions` (`memberships` takes
429 *index* scans). Attribution is by planted-cost control, not inference: ~50× cost planted into
`authz.assignment_facts` moved the statement **1.52×**, the same plant into `scope_reaches` moved it
**14.17×** — and that split was **predicted in writing before the run that confirmed it**. Artifacts:
`../design/authz-ae4-perf-run-passB.txt`, protocol `../design/authz-ae4-performance-acceptance.md`.

⛔ **What this overturns.** Audit finding IA-F9's premise was that the non-inlinable DEFINER
set-returning function evaluated per row was the regression. It is real, it is per-row, and it is
**cheap** — ~1–3 % of per-protected-row cost. Do not re-adopt that premise.

**What would close it.** A migration re-planning the ascent as PK lookups, with its own plan approval,
its own keystone, and the diff-scoped door sweep on both arms — it is a `SECURITY DEFINER` function on
the authorization path. Then the acceptance re-run against it.

⛔ **What must NOT be mistaken for closing it.** The fix landing without the acceptance re-run: P5 is
the condition, and only a re-run can say whether the seam reaches ≤4×. ⛔ Nor a P5 that improves but
stays above 4× — that is a partial result, and the threshold does not move to meet it.
