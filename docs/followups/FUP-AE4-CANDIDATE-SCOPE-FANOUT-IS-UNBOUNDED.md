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

---

## ⚠ CLAUSE PREMISE REFUTED, AND THE CENSUS DELIVERED — 2026-09-09, pre-AE5 Batch 9 (`AE5-OPENING-ADR`)

⛔ **This item's *"nothing in the schema bounds either"* is half wrong, and the wrong half is the
load-bearing one.** Measured from the live catalog at head pair `(20261003007360, 525)`:

**1. `D ≤ M` STRUCTURALLY.** `authz.authorized_scope_ids`' body derives `candidate` as
`select distinct <one CASE expression> from authz.assignment_facts(p_principal)` — **exactly one
candidate id per assignment fact, deduplicated before confirmation.** So
`(1 + D) × O(M) ≤ (1 + M) × O(M)`: **`D` is not an independent unbounded term** and the cost shape
is quadratic in **`M` alone**. Any ceiling stated for `M` is therefore also a ceiling for `D`.

**2. `M` is bounded by the TENANT TREE, not by the principal.** From three `memberships`
constraints, read from the catalog:
`memberships_one_commission_role_uq` — `UNIQUE (principal_id, commission_id) WHERE commission_id IS
NOT NULL` ⇒ ≤ 1 commission membership per commission per principal ·
`memberships_grant_uq` — `UNIQUE (principal_id, role, organization_id, hospital_id, commission_id)
NULLS NOT DISTINCT` ⇒ ≤ 1 row per (principal, role, scope triple) ·
`memberships_scope_shape` CHECK + `memberships_role_scope_kind_fkey … MATCH FULL` to
`authz.roles(code, allowed_scope_kind)` ⇒ a role cannot be seated at two scope kinds.
⇒ **`M ≤ |commissions| + 6·|hospitals| + 2·|orgs| + 1`** (6 hospital-scoped roles, 2 org-scoped,
`+1` for the `profiles.is_admin` `none` fact), and **`D_k ≤ min(M, |scopes of kind k|)`**.
⚠ The audit's condemning reading needed ~80 **synthetic** organizations — one human seated in 80
tenants.

**3. THE CENSUS this clause asks for** (product seed, fresh `supabase db reset --local`; ⛔ re-run it
if the DB is reset, because its whole value is that it describes the **product seed** rather than the
perf fixture):

| measure | value |
| --- | --- |
| tenancy | **3** orgs · **4** hospitals · **6** commissions · 36 profiles · 43 memberships · 1 admin |
| `M` over **33** seated principals | min **1** · max **3** · avg **1.30** |
| `D_organization` max | **1** |
| `D_hospital` max | **2** |
| `D_commission` max | **2** |
| ⭐ distinct orgs per principal | **1 for all 33** — the distribution has a single bucket |

```sql
with af as (select m.principal_id, coalesce(m.organization_id,
    (select c.organization_id from commissions c where c.id=m.commission_id),
    (select h.organization_id from hospitals h where h.id=m.hospital_id)) org
  from memberships m where (m.expires_at is null or m.expires_at>now()) and m.scope_kind is not null)
select org_count, count(*) from (select principal_id, count(distinct org) org_count from af group by 1) t
group by 1 order by 1;   -- → (1, 33)
```

⚠ **This is a DIFFERENT population from the perf fixture** (`max M = 20`, `max D = 5` over 13 orgs /
12,036 principals), and ⛔ **both belong in the ADR**: the product fixture says every real persona is
single-org; the perf fixture says the loaded ceiling is 5.

**4. No instrument watches `D` or `M`.** `grep -rn "candidate_scope\|scope_fanout\|max_D\|D_proposed\|assignment_fact_count" scripts supabase/tests docs/testing`
= **0 rows** — self-tested: the same pattern **does** find `D_proposed` in this file, so the negative
is real for `scripts/` + `supabase/tests/` and not a dead census.

**Disposition (PO ruling R7, 2026-09-09):** this item is **ADR 0204** material and is **deferred out
of Batch 9** — it is not AE5-specific and blocks no role increment. ⛔ **It may NOT be closed on the
figures it was filed with**; the census above is what a closure reasons from, and the clause's
*"nothing bounds either"* premise must be corrected before anything closes on it. ⚠ When the ceiling
is stated, note that `npm run lint` **cannot** host a live-catalog count (no Docker), so a pgTAP
mirror buys *"the next Phase Gate noticed"*, never *"the next commit noticed"* (ADR 0195) — the ADR
must say which it delivered.
