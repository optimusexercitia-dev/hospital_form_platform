# FUP-UI-AUTHZ-WRAPPERS-DUPLICATE-THE-ENFORCING-PREDICATE — six `public` authz wrappers mirror an `app.*` rule that RLS calls directly, and nothing pins that the two agree (owner: backend + PO; filed 2026-08-24, found while keystoning `rca_writer_can_write`)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-24 · status open

_**Detail rotated VERBATIM from the Follow-ups section of PROGRESS.md (retired 2026-09-03, ADR 0185) on 2026-08-26**, restoring that index line to
its declared one-line form (severity · id · title · owner) during a size rotation. Nothing was
summarised away — the text below is the removed substring exactly as it stood:_

> measured 2026-08-24, all six have **ZERO** catalog references (no policy/trigger/function body), so the second copy is enforced by nothing. ⛔ NOT redundant — `app` is not PostgREST-exposed (`config.toml:13`), so the UI needs the bridge; do not "simplify" them away. ⚠ **Not a live hole** (all six still delegate, verified) — the item is that **no gate can see them stop**: the door sweep cannot (neutralizing one leaves RLS intact — why `rca_writer_can_write` swept BLIND across 218 files) and the RLS keystones cannot (they never call the wrapper). Coverage: 2 keystoned, **4 `is_*_self` wrappers have none at all**; and neither existing keystone pins the **differential** against the predicate RLS enforces

**The shape.** A handful of `public` `prosecdef` SQL bool functions exist whose entire body delegates to an
`app.*` predicate — e.g. `public.rca_writer_can_write(p_rca_id)` is exactly
`select app.can_write_rca(p_rca_id, auth.uid())`.

⛔ **They are NOT redundant, and must not be "simplified" away.** Measured: `app` is **not a
PostgREST-exposed schema** (`supabase/config.toml:13` → `schemas = ["public", "graphql_public"]`), so the UI
cannot call the enforcing predicate over the API *even though* `authenticated` does hold EXECUTE on
`app.can_write_rca`. The wrapper is a necessary bridge. ⭐ Recorded because the first reading of the grant
alone said "redundant" and was wrong — the exposure, not the grant, is what makes them load-bearing.

**Population, measured in the catalog 2026-08-24** — 18 such wrappers, of which 12 are `*_enabled`
feature-flag delegations (`select app.feature_enabled('x')`, low risk). **Six are authorization predicates:**

| wrapper | delegates to | pgTAP coverage |
| --- | --- | --- |
| `rca_writer_can_write` | `app.can_write_rca` | ✅ `300_rowdoor_gate_keystones.sql` §1.10/2.10 (added 2026-08-24, mutation-proven) |
| `interview_viewer_can_write` | `app.can_write_interview` | ✅ `121_interviews.sql:117-124` (two-sided `is()`) |
| `is_nsp_coordinator_of_self` | `app.is_nsp_coordinator_of` | ⛔ **none — 0 files** |
| `is_nsp_org_admin_of_self` | `app.is_nsp_org_admin_of` | ⛔ **none — 0 files** |
| `is_pqs_member_of_self` | `app.is_pqs_member_of` | ⛔ **none — 0 files** |
| `is_pqs_member_self` | `app.is_pqs_member_of_any` | ⛔ **none — 0 files** |

**All six have ZERO catalog references** — no policy, no trigger, no other function body. Enforcement bypasses
them entirely: all **eight** rca write policies (`rca_update` · `rca_delete` · `rca_evidence_write` ·
`rca_factors_write` · `rca_members_write` · `rca_root_causes_write` · `rca_timeline_write` ·
`rca_why_chains_write`) call `app.can_write_rca(id, auth.uid())` directly.

**The hazard: two copies of one authorization rule, and only one of them is enforced.** Today they agree
*because* the wrapper delegates — and **nothing pins that it keeps delegating**. Inline the logic, or "fix" one
side, and the UI silently disagrees with the database: write affordances offered that the DB then refuses, or
hidden that it would have allowed. ⚠ **No existing gate can see it.** The door sweep cannot — neutralize a
wrapper and RLS is unaffected, which is precisely why `rca_writer_can_write` swept BLIND across 218 files. The
RLS keystones cannot — they never call the wrapper.

⚠ **NOT a live hole, and do not report it as one:** verified 2026-08-24 that every wrapper still delegates, so
UI and DB agree today. The item is the absence of anything that would notice if they stopped.

⭐ **What the two existing keystones still do NOT pin.** Both assert the wrapper's output against a
**hardcoded expectation** (`is(..., false)` / `is(..., true)`). That catches a wrapper that breaks alone; it
does **not** catch wrapper and predicate drifting apart, because nothing compares them. The assertion that
would is the **differential**, evaluated as one principal:

```sql
select is(public.rca_writer_can_write(<rca>), app.can_write_rca(<rca>, auth.uid()),
  'wrapper agrees with the predicate RLS actually enforces');
```

**Decide between:**
- **(a)** differential assertions for all six, plus first-ever coverage for the four `is_*_self` wrappers; or
- **(b)** a structural fix that removes the second copy — generate the wrappers from the predicate, or expose
  one definition both the UI and RLS consult, so agreement is not a thing anyone has to test.

**Owner:** backend + PO decision.

---
