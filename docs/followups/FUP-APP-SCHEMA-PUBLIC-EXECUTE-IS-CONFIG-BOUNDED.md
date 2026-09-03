# FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED — half of `app` is PUBLIC-executable, and the only thing bounding it is one config line (owner: backend; filed 2026-08-22, found while deriving an ACL by property for ADR 0134 Amdt 6)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-22 · status open

**Found while doing something else** — the ADR 0134 Amendment 6 condition "derive `member_can_for`'s ACL
from the catalog by property, do not invent one". The derivation surfaced an asymmetry, and the
asymmetry turned out to be the small end of a much larger measured fact.

**Filed as 🟢 informational, deliberately.** It is **not** a live hole, and it must not be reported as
one — see the bound below. It is filed because the bound is a *config line*, not the ACLs, and nothing
in the tree says so.

**Measured 2026-08-22 from the live catalog** (property + count for each):

| property | count |
|---|---|
| functions in schema `app` (`prokind='f'`) | **467** |
| of those, **`anon` holds EXECUTE** (`has_function_privilege`) | **237** |
| `proacl IS NULL` — the *permissive default*, which includes PUBLIC | **228** |
| an **explicit** `=X/postgres` PUBLIC entry in `proacl` | **9** |

The nine explicit ones: `answer_map`, `can_read_correction_response`, `commission_of_version`,
`eval_condition`, `is_admin`, **`is_member_of`**, `is_org_admin_of`, **`is_staff_admin_of`**,
`latest_published_version`. Four of those nine are **authorization predicates**.

⛔ **THE BOUND, and it is the whole severity argument.** Schema `app` is **not exposed to PostgREST** —
`supabase/config.toml:13` is `schemas = ["public", "graphql_public"]`. An `anon` caller cannot reach
`app.*` over the API at all (this repo has already recorded that `app.*` RPCs are 404). So these grants
confer nothing today. ⇒ **defense-in-depth gap, not a vulnerability.** If that one line ever gains
`"app"`, 237 functions become directly callable by `anon` in the same edit — the ACLs are not the thing
holding the line, and a reader auditing the ACLs would conclude they were.

⭐ **How this was nearly filed wrong, which is the reusable part.** It was first reported as
*"`app.is_member_of` carries a PUBLIC EXECUTE grant while its `_for` twin and the whole `_for` family do
not — `is_member_of` is wider than every sibling."* Every clause of that is **true**, and the framing is
**wrong in the way this repo keeps being wrong**: it names the instance found instead of the class. Run
by property, the class is 237 of 467, `is_staff_admin_of` is a second explicit member the sentence
missed, and the dominant mechanism is not a deliberate grant at all but **`proacl IS NULL`** — the
default nobody wrote. A one-outlier framing invites a one-function fix that would change nothing.

**To close** — this needs a *decision*, not a patch, and the decision is not this increment's:
1. Rule whether `app` should be default-`REVOKE`d from PUBLIC at all (a sweeping ACL change across 228
   functions, each of which must still work for `authenticated` / `service_role` / the DEFINER chains).
2. If yes, the honest gate is a **pgTAP** assertion (⚠ DB anchors are not checkable in `npm run lint` —
   ADR 0127's stated bound), and it must be **red-first**: create a throwaway `app` function with a NULL
   `proacl` and require the gate to catch it, or the gate proves only that today's 228 were listed.
3. Whatever is decided, `supabase/config.toml:13` should carry a comment saying that 237 `app` functions
   are anon-executable and this line is what makes that safe. Right now the load-bearing line looks
   routine.

⛔ **Do not "fix" this by adding `REVOKE` to the ADR 0134 migration.** It is outside that ruling's
approval scope, it is unrelated to the case surface split, and a sweeping privilege change smuggled into
a feature migration is how the next reader loses the reasoning.
