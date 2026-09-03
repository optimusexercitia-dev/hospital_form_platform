# FUP-PROFESSIONAL-PARTICIPANTS-SELECT-STILL-PER-ROW — the second policy on the same authorizer was NOT converted, and it cannot serve as a control either

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-03 · status open

driving it. Not 🟠 because the product input is small and the policy is correct; above 🔵 because
"the per-row authorizer was fixed" is now true of one of its **two** policies and reads as true of
both.

**What is wrong.** `app.can_read_professional_profile` is the predicate of TWO policies —
`professional_profiles_select` and `professional_participants_select`. `20261003007320` converted
only the first to the statement-scoped set arm. The second still evaluates the full layer-3 → 2 → 1
chain once per protected row.

**How it was MEASURED.** `pg_policies` where `qual like '%can_read_professional_profile%'` returns
exactly those two rows (2026-09-03, live catalog). The product flow performs the org-filtered
profile search first and then queries `professional_participants` for the returned profile ids,
bounded to **≤ 20** by the page size in `src/lib/queries/participants.ts` — which is why this is a
residual and not the same severity as the 10 000-row read that failed P5.

**What would close it.** Either convert it to the same statement-scoped arm (it needs its own
candidate map, because the policy's column is `professional_profile_id`, not `organization_id` —
the set would have to be a set of profile ids or the predicate would need a join), **or** rule
explicitly that a ≤ 20-row per-row evaluation is accepted and record the bound as a product
invariant with something that reds when the page size grows.

⛔ **What must NOT be mistaken for closing it.** `20261003007320`'s green does not make this
covered: pgTAP `413` asserts the *converted* policy's surface and asserts nothing about this one.
⚠ **And do not reach for this policy as a measurement subject without filling the table first** —
acceptance §13.5 records the attempt: DC1 was briefly re-aimed here and the re-aim was killed on
measurement, because `professional_participants` holds **1** row on a fresh reset and
`scripts/authz-ae4-perf-fixture.sql` `analyze`s it without ever inserting into it. Any future
conversion or measurement of this policy owes a fixture that actually populates it.
