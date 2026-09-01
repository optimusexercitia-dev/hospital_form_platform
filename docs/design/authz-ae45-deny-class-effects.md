# AE4.5 — the deny-class effect table

**Phase:** AE4.5 · **owner:** backend · **status:** 🔴 **PROVISIONAL — NOT APPROVED.** Sent to the
lead 2026-09-01 for PO approval. **derived:** 2026-09-01 · **stack:** local, fresh reset, head
`20261003007180`.

> ⛔ **THIS IS ONE OF THE ORACLE'S ONLY TWO INPUTS, AND THE ONE WITH NO INDEPENDENT SOURCE
> BEHIND IT.** AE4.5 asserts `is(catalog, approved-matrix-value)`. That half is meaningful only if
> the expected value is derived **independently of the resolver** — otherwise the suite proves the
> resolver equals a second implementation of itself. So expected values come from exactly two
> hand-encoded sources and nothing else:
>
>   1. **the approved matrix row** — does `staff_admin` hold code X (a lookup; currently 42 × true);
>   2. **this table** — what each deny class must produce.
>
> ⚠ **Errors in this table become the regression oracle's errors.** That is why it is a
> PO-approved artifact rather than a constant in a generator.

## The table

| # | deny class | expected effect | reason | source |
| --- | --- | --- | --- | --- |
| 0 | *(base — no deny fires)* | **GRANTED** | The matrix row says `staff_admin` holds the code, and the assignment scope reaches the permission's resolution scope. | matrix row |
| 1 | `wrong_scope` — a sibling commission, same org | **DENIED** | The grant is scoped to one commission; a sibling is a different `scope_id`. | derived from the scope axis |
| 2 | `cross_org` — a commission in another organization | **DENIED** | Tenant isolation. ⚠ **But see matrix § 6.1: this is enforced by the UUID id-space, not by any org term in the resolver.** The catalog expresses no org isolation, so this row records the *required* answer, not a property the catalog guarantees. | derived + § 6.1 bound |
| 3 | `inactive` — `profiles.is_active = false` | **DENIED** | ✅ **MEASURED**: `app.is_active(desativado.conta) = false`, and it gates the whole assignment projection. | measured |
| 4 | `suspended` — `suspended_until` in the future | **DENIED** | ✅ **MEASURED**: `app.is_active(suspenso.temp) = false` (`is_active` column is `true`; the suspension is what denies). ⛔ **NOT independently observable from `inactive`** — one predicate folds both, so no site distinguishes them. | measured |
| 5 | `pending` — `email_confirmed_at is null` | ⭐ **GRANTED** | ⛔ **MEASURED, AND IT CONTRADICTS THE AXES FILE**: `app.is_active(novato.pendente) = **true**`. That persona differs from `ativo.registro` **only** by `email_confirmed_at`, and neither `app.is_active` nor the resolver reads that column. **At the resolver layer `pending` is not a deny class.** If pending denies anywhere it denies in auth/middleware, which is outside this oracle's subject. | measured |
| 6 | `wrong_active_context` — **SELF-check** (`principal = auth.uid()`) | **DENIED** | § 6A: the hat gate applies, and the principal must hold the permission through at least one role that is the active role. | matrix § 6A |
| 7 | `wrong_active_context` — **THIRD-PARTY** (`principal <> auth.uid()`) | ⭐ **GRANTED** | § 6A's asymmetry: the filter short-circuits entirely for a third-party check. ⛔ Both polarities are required — a suite emitting only row 6 passes while pinning the uniform-apply bug. | matrix § 6A |
| 8 | `unauthenticated` | **DENIED** | No `auth.uid()`. ⚠ Additionally unreachable: no application role holds USAGE on `authz`, so an anonymous caller cannot invoke the resolver at all (pgTAP 401 § 18). | measured |

**9 rows: 1 base + 8 deny-class effects** (`wrong_active_context` splits by polarity, which is the
whole point of § 6A).

## Two consequences the PO should see with the table

1. ⭐ **Row 5 is a correction, not a judgement call.** `supabase/tests/vectors/authz-matrix-axes.json`
   lists `pending` under `denyClasses`. Measured, it is not one at this layer. **The axes file
   should be corrected**, or the generator will emit 300+ cells expecting a denial the system does
   not produce — and every one of them would red against a *correct* resolver.
2. ⚠ **Row 4 cannot be tested apart from row 3.** The generator names `inactive` and `suspended`
   separately, and the fixtures can construct them separately, but no enforcement site
   distinguishes them. A cell expecting a *distinguishable* answer asserts something the system
   cannot express — encoded as an exclusion rule with that reason, not as prose.

⛔ **Until this table is approved, every `expectedGranted` value the generator emits carries
`expectedSource = 'deny-class:PROVISIONAL'`**, so an unapproved input cannot be mistaken for an
approved one in the artifact that becomes the oracle.
