# FUP-AE4-CANDIDATE-SCOPE-FANOUT-IS-UNBOUNDED — the statement-scoped resolver costs `(1 + D) × O(M)` per statement, and nothing states or watches `D`

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-03 · status open

operating point is orders of magnitude inside any concern. Not 🟠 because no product path approaches
it and the shape it replaced was strictly worse at every point measured; above 🔵 because the bound
lives in one migration comment and **no instrument watches either term**.

**What is wrong.** `authz.authorized_scope_ids` scans `authz.assignment_facts` once to propose
candidates, then calls `authz.has_permission` once per DISTINCT candidate scope — and each of those
re-enters `authz.entailed_grants` → `authz.assignment_facts` again. Both functions are
`SECURITY DEFINER`, so Postgres never inlines them and the re-entry is real. Per statement the work is
`(1 + D) × O(M)`, where `M` is the principal's assignment-fact count and `D` the distinct candidate
scopes proposed. `D` and `M` rise together for a principal seated across many organizations, so the
term is quadratic in that direction. Nothing in the schema bounds either, and nothing reports them.

**How it was MEASURED.** 2026-09-03, rolled-back two-factor probes against the loaded AE4 perf fixture
(every probe in `begin … rollback`; `memberships`/`profiles`/`organizations` counts verified restored).
With `D` held at 3, buffers go **409** (M=7) → **1 017** (32) → **1 617** (57) → **2 833** (107) — linear
in `M`. With `D` rising 2→10, **342 → 843** buffers. Fitted `buffers ≈ (1 + D) · (96 + 5.7·M)`. The
fixture's real ceiling across all 12 036 principals is **`max M = 20, max D = 5`** over **13**
organizations (`D_proposed ∈ {1,2,4,5}`; 11 555 principals sit at 4). ⚠ The audit's condemning reading
(100 memberships / 82 candidates / 28 376 buffers) required ~80 **synthetic** organizations and
describes one person as `staff_admin` across 82 tenants — and even there the path is far cheaper than
the `1 001 345`-buffer form it replaced.

**What would close it.** Either a stated ceiling on `D` per principal with something that reds when it
is exceeded, **or** a ruling that the org→hospital→commission tenancy model makes a large `D`
unreachable in practice — recorded together with the census that shows it, so the next reader does not
have to re-measure to find out whether anyone ever checked.

⛔ **What must NOT be mistaken for closing it.** ADR [0183](../decisions/0183-p2-invocation-count-respecification.md)'s
re-specified P2 measures the **slope** (`ΔA = ΔU`) and the row-independence of the invocation count: it
proves the instrument can *see* `D`, it does not *bound* `D`. ⛔ Nor does the migration header's
`⚠ SHAPE BOUND` comment — it states the shape and the fixture's maximum, which is a description, not a
gate. ⛔ Nor does a green P5: P5 is timed at the fixture's `D = 2` principal, which is the cheapest
point on the curve.
