# FUP-ZERO-ARG-APP-PREDICATES-NOT-HOISTED — the advisor's initplan rule is blind to `app.*()`, so zero-argument RLS predicates are still evaluated per row (owner: backend; filed 2026-08-27 by `backend` at the AE1.5 triage, PO-scoped the same day)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-27 · status open

> **What the advisor does not see.** Supabase's `auth_rls_initplan` rule flags **only**
> `auth.uid()` / `auth.jwt()` / `auth.role()` / `auth.email()`. AE1.5 fixed all 113 of those it
> was scoped to. But this codebase's RLS predicates are mostly `app.*()` helpers, and the
> **zero-argument** ones are hoistable on exactly the same argument the advisor's rule rests on —
> yet nothing flags them, so they are invisible to every gate and every advisor run.
>
> **The criterion, stated so the sweep is a property and not a taste:** a call is hoistable iff it
> is `STABLE` (or `IMMUTABLE`), takes **no arguments**, and references **no `Var`**. Then
> `( select app.f() )` is an *uncorrelated* subquery and the planner evaluates it **once per
> statement** instead of once per row. ⛔ A call taking a row column — `app.is_member_of(commission_id)`
> — is **not** in this class: wrapping it produces a *correlated* `SubPlan`, still once per row,
> no gain and a plan-shape change for nothing.
>
> **Measured 2026-08-27** (`explain` under a real `authenticated` context, local stack):
> unwrapped `app.is_admin()` renders as a per-call `One-Time Filter: app.is_admin()`; wrapped it
> becomes `One-Time Filter: (InitPlan 1).col1` with an `InitPlan 1 -> Result`. **Inside an `OR`
> it is worse than the top-level case** — it sits in a per-row disjunction with no one-time
> treatment at all.
>
> ⚠ **`organizations` is the strongest single entry and should be prioritised.** Its read filter is
> an **eight-term OR** containing `app.is_admin()` **TWICE**:
> `app.is_admin() OR app.is_org_admin_of(id) OR app.is_org_member(id) OR app.is_pqs_operator_in_org(id) OR app.is_nsp_org_admin_of(id) OR app.is_org_level_admin_within(id) OR app.is_quality_reviewer_in_org(id) OR app.is_admin()`
> — so a `SECURITY DEFINER` plpgsql function that reads the claims GUC and, on its fallback branch,
> **queries `public.profiles`**, is evaluated **twice per row** on the table at the top of the
> tenancy tree that every tenant-scoped read touches. `hospitals`, `case_types` and
> `case_participant_roles` carry the same doubled `app.is_admin()`.
>
> **Population.** Derive it, never hand-list it: `pg_policies` joined to `pg_proc` on the helper
> names appearing in `qual`/`with_check`, keeping those with `pronargs = 0` and
> `provolatile in ('s','i')`. The duplicated-arm census in
> `FUP-READ-ACCESS-RIDES-ON-A-WRITE-POLICY` (26 tables) is a **starting point, not the
> population** — the two items overlap but neither contains the other.
>
> ⛔ **Why AE1.5 did not do it.** Out of the advisor's 113 and out of AE1.5's approved 52, and
> AE1.5's binding acceptance rule is a **before/after plan diff per touched table** — riding these
> along on another phase's diff would mean claiming evidence that was never captured for them.
> PO-ruled 2026-08-27: file separately.
>
> ⚠ **Set expectations from AE1.5's own result before sizing this.** AE1.5 measured a
> **structurally** smaller plan (11 filter arms → 7, 9 SubPlans → 5, cost estimate halved) with
> **no measurable runtime change** at seed size — because the arms it removed read `never
> executed`. *A plan node that exists is not a plan node that runs.* Whoever takes this item must
> measure `loops=` / `never executed`, not arm counts, and must be prepared for the honest answer
> that the win is small until the tables are large.
