# FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH — a `SET search_path` that silently resolves to nothing passes every gate in the chain

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-03 · status open

**one** function and it is fixed, measured below, so this is a missing gate rather than a live
exposure. Above 🔵 because the class is silent by construction on the authorization path and the
one instance survived pgTAP, the whole `npm run lint` chain, four authz arms and a door sweep.

**What is wrong.** `set search_path to 'app, public, pg_catalog'` — single-quoted — is accepted by
Postgres as **ONE identifier** naming a schema that does not exist, not a three-element list, and a
non-existent schema in `search_path` is skipped rather than erroring. A `SECURITY DEFINER` function
written that way declares a schema resolution order it does not have. **Nothing in this repo
notices.** **No** gate in `package.json`'s `lint` script reads `proconfig`; pgTAP only checks the
functions someone thought to assert, and the assertion that *should* have caught this instead
**pinned it**, because its expected value was hand-typed by copying the broken catalog output.

⛔ **DATED CORRECTION 2026-09-08 — two numerals in this body were stale, and the claim was not.** Both
sites above read *"twelve lint gates"*; two gates were appended to `npm run lint` on 2026-09-08
(`lint:config-schemas`, `lint:budget-anchor`) and **neither reads `proconfig`**, verified by reading
both scripts rather than by counting. ⇒ The clause is restated on the **property** — *no gate in the
chain reads `proconfig`* — because a live count in ungated prose is precisely what rotted here, twice,
in a body whose whole subject is a check bound on a property rather than a symptom. ⚠ Nothing
positional moved: both gates were **appended**, so every by-number reference elsewhere in the tree is
still correct.

**How it was MEASURED.** 2026-09-03, live catalog: `current_schemas(true)` inside
`app.current_professional_read_organizations` returned `{pg_temp_N, pg_catalog}` against its sibling
`app.can_read_professional_profile`'s `{pg_temp_N, app, public, pg_catalog}`. ⭐ **The whole
population was then swept**: `prosecdef` functions in `app`/`public`/`authz` whose `proconfig`
contains a quote, excluding the legitimate empty form `search_path=""` — **0 rows**. So the class is
currently clean and **a gate added today would start green**, which is the cheapest moment to add
one.

**What would close it.** A `lint:*` gate (or a pgTAP catalog assertion, which is cheaper — it needs
no new script and the DB is already the authority) asserting that for every `prosecdef` function
in `app`/`public`/`authz`, `proconfig`'s `search_path` either is the empty form or splits into
schemas that **all exist in `pg_namespace`**. ⛔ Text-matching for a quote is the *symptom*; the
property is *"every named schema resolves"*.

⭐ **THE SWEEP HALF IS DONE — 2026-09-03, pgTAP `414_definer_search_path_resolves.sql`.** It asserts
exactly the property above over **890** `prosecdef` functions in `app`/`public`/`authz` (**0**
offenders; the gate starts green as predicted), tokenizing by *matching* quoted-or-unquoted runs
rather than splitting on `,`, and it carries three proofs it can bite — a planted collapsed DEFINER,
a dead-instrument control (`§1` stays green while `§2a` reds, the VOID-not-PASS reading), and a
naive-comma-split control. This entry stays OPEN for the two halves below.

⛔ **CORRECTION — this entry's own example was mis-measured, and it argued the case backwards.** It
read: *"only the second survives someone writing `set search_path to 'app'` (one identifier, quoted,
and it happens to exist)"*. Measured on the live catalog 2026-09-03, in a rolled-back transaction:
`set search_path to 'app'` stores as `{search_path=app}` — **the quotes are NOT stored**, so a
quote-matcher would never have flagged it, and the case is harmless anyway. The conclusion was right
and its evidence was not. The shape that actually defeats a quote-matcher is the opposite one:
`set search_path to no_such_schema` stores as `{search_path=no_such_schema}` — **no quote, genuinely
broken**, and a quote-matcher misses it entirely. (For completeness, the historical bug shape does
store one: `set search_path to 'app, public, pg_catalog'` → `{search_path="app, public, pg_catalog"}`.)
So the false NEGATIVE, not the false positive, is why the property beats the symptom. `414`'s header
carries the full six-shape measurement table.

**What is still open — two halves.**
1. ⭐ **A DEFINER carrying NO `search_path` at all** is the same hijack shape one step earlier, and it
   leaves the sweep's domain silently rather than failing inside it. `414 §0b` pins the population at
   **890/890 declaring one** today, so this is currently green — but it is a second class this entry
   never named, and it is pinned rather than ruled. Disposition owed.
2. **The value convention.** Supabase guidance is `search_path = ''` with fully-qualified bodies;
   this tree runs **400** `prosecdef` functions in `app` on `app, public, pg_catalog` against **7** on
   `''` (all 10 in `authz` use `''`). Raised by the 2026-09-03 external audit and **deliberately
   deferred** — flipping one function buys no risk reduction, and no application role holds CREATE on
   `app`/`public`/`authz`, so there is no live exposure. It is a platform-wide decision owing an ADR,
   not a one-line fix.

⛔ **What must NOT be mistaken for closing it.** The `20261003007330` fix — that is one function.
⛔ Nor pgTAP `413`'s per-name pins (which replaced the sibling-differential on 2026-09-03): they bound
**two** functions by name, which is still the name-keyed shape that lets the next one through. `414`
is what sweeps the class; `413` is what pins these two.

---

## ⚠ FIGURES STALE IN THREE WAYS, AND THERE ARE FIVE CONVENTIONS NOT TWO — 2026-09-09, pre-AE5 Batch 9

Re-measured over `prosecdef` functions in `app` / `public` / `authz` at head pair
`(20261003007360, 525)`: **890 total, 890 declaring a `search_path`, 0 declaring none** — so `414`
§ 0b's 890/890 still holds. ⛔ But the **distribution this item states is wrong in three ways**, and
the shape of the population is not the two-way split the clause reasons about:

| `search_path` value | count |
| --- | --- |
| `app, public, pg_catalog` | **825** (app 400 · public 425) |
| `""` (the empty form) | **23** (app 7 · authz 10 · **public 6**) |
| `public, pg_catalog` | **39** (app 6 · public 33) |
| `app, pg_catalog` | **2** — `app.derive_patient_key`, `app.feature_enabled` |
| ⭐ `public, app, pg_catalog` | **1** — `public.tenant_orphan_profiles` |

1. ⛔ The item says *"**400** … on `app, public, pg_catalog` against **7** on `''` (all 10 in `authz`
   use `''`)"*. That **omits `public`'s 6 empty-form functions** ⇒ the empty-form population is
   **23, not 17**, and the dominant convention is **825, not 400** (400 is only its `app` half).
2. ⛔ It omits the **middle 42 entirely** — the 39 + 2 + 1 above. There are **five** live conventions,
   not two, so *"the convention"* is a choice among five, not a binary.
3. ⭐ **`public.tenant_orphan_profiles` INVERTS the resolution order** relative to the dominant 825
   (`public, app` instead of `app, public`). That is a **semantic** difference, not a stylistic one —
   a name resolving in both schemas resolves differently there — and it is a **singleton**, which is
   exactly the shape that bites and the shape a count cannot show.

**Two of the item's own premises RE-VERIFIED and still true:** `has_schema_privilege(…, 'CREATE')` on
`app` / `public` / `authz` is **false** for all of `authenticated`, `anon`, `service_role` (so the
no-exposure premise holds); and **no gate in the `npm run lint` chain reads `proconfig`** —
`proconfig` appears in `scripts/` only in `authz-census-ae0.sql` and
`authz-tier1-threat-review-ae1.sql`, **neither of which is in the chain**. Self-tested: the same
search finds 3 script hits for `pg_policies`, so the negative is real.

⚠ **And the item's own gate-count numeral is stale again** — its 2026-09-08 correction says the chain
has 14; it is now larger (`lint:backend-state` and `lint:data-access` were appended after that
correction). ⛔ Do not quote a gate count from this file; count the chain in `package.json`.

**Disposition (PO ruling R7, 2026-09-09):** **ADR 0204** material, **deferred out of Batch 9** — the
convention is not AE5-specific and blocks no role increment. ⛔ **The clause may not be closed on the
two-way framing it was filed with**; a closure reasons from the five-value table above, and must say
explicitly what happens to `public.tenant_orphan_profiles`'s inversion, which is the only member of
the population whose difference is semantic.
