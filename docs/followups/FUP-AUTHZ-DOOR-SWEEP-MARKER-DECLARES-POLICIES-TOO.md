# FUP-AUTHZ-DOOR-SWEEP-MARKER-DECLARES-POLICIES-TOO — a `door-sweep-targets:` line naming a POLICY is parsed as if it named a function, and the TABLE name is what gets derived

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-05 · status open

ADR [0173](../decisions/0173-door-sweep-deriver-blind-to-runtime-rewrite-migrations.md) § 2
defines `-- door-sweep-targets:` as a list of **functions**. Two migrations use it to declare
**policies**, in a `schema.table / policyname` form the grammar does not cover —
`20261003007340:6-7`:

```
-- door-sweep-targets: public.form_item_options / form_item_options_staff_admin_write
--                     public.form_item_validations / form_item_validations_staff_admin_write
```

The parser extracts every `(app|public|authz).<name>` token, so what it derives is
`form_item_options` and `form_item_validations` — the **table** names. Measured 2026-09-05: both
resolve to no `pg_proc` row and no `pg_policies` row, and land in the deriver's UNRESOLVED
block. The policy names themselves (`form_item_options_staff_admin_write`, …) are derived by a
different path entirely — the `create policy` grep — so the declaration contributes nothing but
two false names.

⚠ **Not a live hole.** The policies ARE derived, by the policy branch, and the two table names
are named loudly as UNRESOLVED rather than silently entering `CASES` (that is what the tier
split in ADR [0190](../decisions/0190-the-door-sweep-deriver-selects-by-property-and-a-full-run-merges.md)
D1/D3 changed). What is wrong is that the notation and the parser disagree, and the migration
author had every reason to believe the declaration was read.

⭐ **The class:** a notation used for something its grammar does not define, where the parser
answers anyway instead of saying it cannot. The same family as
`FUP-DOOR-SWEEP-MARKER-BLIND-TO-CONTINUATION-LINES`, but the opposite failure: there the parser
read less than the notation, here it reads something the notation never meant.

**How it was found.** While measuring the deriver's over-selection during the
DOOR-SWEEP-DERIVER plan step, by asking why `form_item_options` — a table — was in a case list.

**Closes when:** ADR 0173 § 2's grammar either gains a policy form (`schema.table /
policyname`, parsed as a policy and routed to the policy branch) or explicitly rejects one, with
a named parse error the deriver prints — and `20261003007340`'s declaration stops producing two
UNRESOLVED table names. ⛔ Not closed by rewriting that one migration: migrations are
forward-only, and the next author who declares a policy reproduces it exactly.
