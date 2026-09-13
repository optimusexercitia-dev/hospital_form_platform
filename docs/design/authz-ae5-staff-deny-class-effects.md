# AE5 increment 1 — the `staff` deny-class effect table

**Phase:** AE5 increment 1 (`staff`) · **unit:** [`AE5-STAFF`](../features/ae5-staff.md) ·
**plan:** [`docs/plans/authz-evolution.md`](../plans/authz-evolution.md) § Phase AE5 ·
**owner:** backend · **status:** ⛔ **PROVISIONAL — NOT PO-APPROVED.** The nine EFFECTS below are
the oracle's second input and are worthless until ruled (AC-2) ·
**derived:** 2026-09-13 · **stack:** local, fresh reset, `authz.roles` = 11 rows, `staff` `legacy`,
`staff_admin` `authoritative` · **sibling:** [`authz-ae5-staff-permission-matrix.md`](authz-ae5-staff-permission-matrix.md).

> ⭐ **THE PROVISIONAL MARKER IS REUSED FROM AE4.5 DELIBERATELY.** Until the PO rules, every cell
> the generator emits from this table must carry `expectedSource = 'deny-class:PROVISIONAL'`, so an
> unapproved input cannot be mistaken for an approved one *inside the artifact that becomes the
> oracle* (AE4.5's own lesson; [`authz-ae45-deny-class-effects.md`](authz-ae45-deny-class-effects.md)).
>
> ⛔ **THIS IS ONE OF THE ORACLE'S ONLY TWO INPUTS, AND THE ONE WITH NO INDEPENDENT SOURCE BEHIND
> IT.** `424` will assert `is(catalog, approved-value)`. That half is meaningful only if the
> expected value is derived **independently of the resolver**. Expected values therefore come from
> exactly two hand-encoded sources: (1) the approved `staff` matrix row — does `staff` hold code X;
> (2) this table — what each deny class must produce. **Errors here become the oracle's errors.**

---

## 0. Method, and what is different for `staff`

Every effect below is **measured on the live catalog**, not inherited from AE4.5. The subject
predicate differs between the two increments and that difference is the reason a fresh measurement
was required rather than a copy:

| | AE4.5 (`staff_admin`) | AE5 increment 1 (`staff`) |
| --- | --- | --- |
| legacy predicate | `app.is_staff_admin_of(_for)` → `authz.holds_role(…, 'staff_admin', …)` | `app.is_member_of(_for)` → `app.has_role_any('commission', …)` |
| keying of the legacy predicate | single role code | **role SET** — any commission-tier role in the scope |
| catalog predicate | `authz.candidate_has_permission` | `authz.candidate_has_permission` (identical) |

⛔ **The legacy side of the `staff` differential is a SET predicate, and that is the single most
consequential fact in this file.** `app.has_role_any('commission', C, u)` is satisfied by a
`staff_admin` row as readily as by a `staff` row. Every effect below was therefore measured on a
principal who holds **`staff` and nothing else** in the scope, and the fixture note in § 4 says why
that is harder to arrange in the seed than it sounds.

**Queries.** Effects were produced with `docker exec supabase_db_azkbbhskturikxpgmafq psql -U
postgres -d postgres -At -v ON_ERROR_STOP=1`, each in a transaction that was **rolled back**; the
rollback was verified by re-reading `authz.roles.state` and the affected `memberships` rows
afterwards. Personas: `staff4.ccih@test.local` (uncontaminated `staff` of CCIH — see § 4),
`suspenso.temp@test.local`, `desativado.conta@test.local`, `novato.pendente@test.local`.

---

## 1. The table

Coordinates are the axis values declared in `supabase/tests/vectors/authz-matrix-axes.json`
§ `denyClasses`, quoted verbatim so the generator can label each cell mechanically rather than by
prose.

| # | deny class | axis coordinates | expected effect | reason | source |
| --- | --- | --- | --- | --- | --- |
| 0 | *(base — no deny fires)* | `persona=subject_holder` · `scope=own_commission` · `activeContext=matching` · `principalState=active` | **GRANTED** | The matrix row says `staff` holds the code and the assignment scope **is** the permission's resolution scope (`staff` is commission-scoped by `memberships_scope_shape`; every code it holds resolves at `commission`). | matrix row |
| 1 | `wrong_scope` — a sibling commission, same org | `scope=[sibling_commission]` | **DENIED** | ✅ **MEASURED**: `app.is_member_of_for('b0000000-…-b1', staff4) = false`. The grant is keyed on `commission_id`; a sibling is a different `scope_id`. | measured |
| 2 | `cross_org` — a commission in another organization | `scope=[foreign_org_commission]` · `persona=[cross_org_actor]` | **DENIED** | ✅ **MEASURED**: `app.is_member_of_for('c0000000-…-c1', staff4) = false`. ⚠ **But this is the same non-property AE4.5 § 6.1 recorded, and it is WIDER for `staff`, not narrower** — see § 2. The catalog expresses **no** org term, and neither does `app.has_role_any`, whose whole scope test is `m.commission_id = p_scope_id`. This row records the *required* answer, ⛔ never a property either side guarantees. | measured + § 2 |
| 3 | `inactive` — `profiles.is_active = false` | `principalState=[deactivated]` | **DENIED** | ✅ **MEASURED** *with a constructed grant* (§ 4): `app.is_active(desativado.conta) = false`, and `is_member_of_for(CCIH, desativado.conta) = false` **even after a `staff` membership row is inserted**. The gate is `app.is_active`, called explicitly by `is_member_of(_for)` and again inside `authz.assignment_facts`. | measured |
| 4 | `suspended` — `suspended_until` in the future | `principalState=[suspended]` | **DENIED** | ✅ **MEASURED**: `suspenso.temp` has `profiles.is_active = true` and `suspended_until = 2026-10-13T21:31:05Z`; `app.is_active(suspenso.temp) = false` and `is_member_of_for(CCIH, suspenso.temp) = false`. ⛔ **NOT independently observable from row 3** — restated by measurement in § 3, not inherited. | measured |
| 5 | `pending` — `profiles.email_confirmed_at is null` | `principalState=[pending]` | ⭐ **GRANTED** | ✅ **MEASURED, and the measurement had to be CONSTRUCTED** (§ 4): with a `staff` membership inserted for `novato.pendente`, `app.is_active(novato.pendente) = true`, `is_member_of_for(CCIH, novato.pendente) = true`, and the SELF form under a matching hat is **`true`**. `app.is_active` never reads `email_confirmed_at`. ⛔ Without the constructed grant the raw reading is `false` **for the wrong reason** — see § 4. | measured |
| 6 | `wrong_active_context` — **SELF** (`principal = auth.uid()`) | `activeContext=[other_role, absent]` | **DENIED** | ⭐ ✅ **MEASURED, AND THIS REFUTES THE UNIT'S OPENING PREMISE.** With `staff4` as the caller: `active_role='staff'` → `is_member_of(CCIH) = true`; `active_role='staff_admin'` → **`false`**; **no** `active_role` claim → **`false`** (`app.active_role()` is NULL and `is not distinct from` fails closed). The hat gate **already fires** for `staff` today — it lives one level down, in `app.has_role_any`'s `(p_user_id is distinct from auth.uid() or m.role is not distinct from app.active_role())` term. See the matrix § 6A and record § R-2. | measured |
| 7 | `wrong_active_context` — **THIRD-PARTY** (`principal <> auth.uid()`) | `activeContext=[other_role, absent]` | ⭐ **GRANTED** | ✅ **MEASURED**: caller `staff4` with `active_role='staff_admin'`, and again with **no** `active_role` claim, asking `is_member_of_for(CCIH, dr.john)` → **`true`** both times. The first disjunct short-circuits the hat entirely. ⛔ **Both polarities are required** — a suite emitting only row 6 passes while pinning the uniform-apply bug, which would break all **33** `is_member_of_for` call sites. | measured |
| 8 | `unauthenticated` | `persona=[anonymous]` | **DENIED** | ✅ **MEASURED, and it denies EARLIER than the predicate.** As `anon`, `select app.is_member_of(…)` raises **`42501 permission denied for schema app`**: `pg_namespace.nspacl` for `app` is `postgres=UC/postgres , authenticated=U/postgres , service_role=U/postgres` — **`anon` holds no USAGE**. The predicate is never evaluated. ⚠ See § 3 for why that is a *different* limitation from AE4.5's row 8. | measured |

**9 rows: 1 base + 8 deny-class effects** — `wrong_active_context` splits by polarity, which is the
whole point of the matrix § 6A. The seven `denyClasses` keys in the axes file plus the base plus the
polarity split = 9; the parts sum with no residue.

---

## 2. `cross_org` is WIDER here than it was for `staff_admin`, and the widening is measurable

AE4.5's approved limitation says cross-org "asserts the REQUIRED answer" because isolation rides
the UUID id-space rather than an org term in the resolver. That limitation is **inherited in full**
and one clause must be **added** for `staff`:

- On the `staff_admin` side the legacy predicate is `authz.holds_role(…, 'staff_admin', …)`, whose
  scope test is `af.scope_id = p_scope_id` over `authz.assignment_facts`.
- On the `staff` side the legacy predicate is `app.has_role_any('commission', p_scope_id, …)`,
  whose scope test is `m.commission_id = p_scope_id`.

Neither carries an org term, so the *reason* is the same. What differs is the **population that
would be admitted if a commission id were ever guessable or reused**: `has_role_any` admits **any
commission-tier role**, so a cross-org leak on this predicate would leak to the union of `staff` ∪
`staff_admin` ∪ any future commission role, not to one role. ⛔ **The cell asserts the right outcome
for a reason neither the catalog nor the legacy predicate expresses**, and the gate record must not
read as *"the resolver enforces tenant isolation for `staff`"*.

---

## 3. The two approved limitations, RESTATED BY MEASUREMENT — and one that changes

`supabase/tests/403_ae45_differential_oracle.sql:29-34` carries two approved limitations. The brief
required them restated or refuted **by measurement**, not quoted. Result: **both survive; one gains
a `staff`-specific clause and one gains a different mechanism.**

**Limitation A — `suspended` is NOT independently observable. ✅ RESTATED, unchanged.** Verbatim
from `403:31-32`: *"`suspended` is NOT independently observable — app.is_active folds it with
`inactive`, so no site distinguishes them."* Measured for `staff`: `app.is_active` is one function
with one return value —

```
suspenso.temp    : profiles.is_active = true , suspended_until = 2026-10-13… , app.is_active = false
desativado.conta : profiles.is_active = false, suspended_until = <null>      , app.is_active = false
```

— and `app.is_member_of_for` consumes only that boolean. Measured over the comment-stripped
catalog, `suspended_until` is read by **6** functions in `app`/`public` — `app.is_active`,
`app.set_person_active_impl`, `app.suspend_person_impl`, `public.guard_profile_privileged_columns`,
`public.session_context`, `public.suspend_person_for` — and by **0** policies. Of those six, only
`app.is_active` sits on an authorization path, and it is precisely the function that folds the two
states; the other five are the two admin write impls, a column guard, and a read-back surface. ⛔ Any
claim that this suite covers suspension **separately** is false for `staff` exactly as it was for
`staff_admin`.

**Limitation B — `cross_org` asserts the REQUIRED answer. ✅ RESTATED, with the § 2 widening
clause added.**

**Limitation C — NEW, and it belongs to `staff` alone: the `unauthenticated` row is satisfied by a
GRANT, not by the predicate.** AE4.5's row 8 noted the analogous fact for `authz` (*"no application
role holds USAGE on `authz`"*). For `staff` the same shape sits one schema over and is **not**
identical: `anon` holds no USAGE on **`app`**, so the legacy predicate is unreachable, while
`authenticated` does hold USAGE. ⚠ Additionally measured, and worth a line because it is the second
member of a class the authorization seam currently records as a singleton:

```
app.is_member_of      proacl = {=X/postgres, postgres=X/…, authenticated=X/…, service_role=X/…}   ← PUBLIC EXECUTE present
app.is_member_of_for  proacl = {postgres=X/…, authenticated=X/…, service_role=X/…}                 ← PUBLIC EXECUTE absent
```

`app.is_member_of` carries an **unreachable PUBLIC EXECUTE** entry that its own `_for` twin does
not. It is unreachable today for exactly the reason the row-8 deny is unreachable — no PUBLIC schema
USAGE gets to it — which means **the row-8 deny and the stray ACL are held up by the same single
fact**, and granting `anon` USAGE on `app` would move both at once. `docs/backend-state/authorization-and-audit.md`
§ Open edges records this shape for `app.is_admin()` as one of three Batch-10 items *filed, not
fixed*; this is a second member. ⛔ Filed here as an observation with its measurement — **not**
fixed in this unit, and **not** a licence to REVOKE (a revoke we are not entitled to make is a
silent no-op, and a revoke also removes a function from `ARM=floor`'s domain).

---

## 4. ⛔ THE FIXTURE CANNOT REACH TWO OF THESE STATES, AND ONE OF THEM READS AS A PASS

This is the sharpest thing in this file and it is a **T4 / T13 work item**, not a caveat.

**(a) `pending` and `inactive` have no `staff` membership in the seed.** `novato.pendente` and
`desativado.conta` hold **0** `memberships` rows (measured; already recorded against
`seed.sql:632-637`). So a differential cell for row 5 measured on the seed as it stands reads:

```
is_member_of_for(CCIH, novato.pendente) = false        ← reads as "pending DENIES"
```

⛔ **That `false` is the absence of a grant, not the effect of `pending`.** With one `staff`
membership row inserted inside a rolled-back transaction the same call returns **`true`**, and the
SELF form under a matching hat returns `true`. Row 5's expected effect is **GRANTED**, and a suite
run against today's fixture would score a **DENIED** expectation green while measuring nothing about
`pending` at all — the *"a green gate can mean the FIXTURE cannot reach the failing state"* shape,
and here it is worse than usual because the wrong answer is the intuitive one. ⇒ **T4 must seed a
`staff` membership for the pending and deactivated personas** before `424` emits rows 3 and 5, and
⛔ **not by reusing an id another case depends on**.

**(b) Only 3 of the 9 seeded `staff` personas of CCIH are usable as an uncontaminated
`subject_holder`.** Measured over `app._case_caps(case, uid)` for every `staff` of
`a0000000-…-a1` on `visibility_policy = 'commission_default'` cases:

| persona | caps observed | non-role source present |
| --- | --- | --- |
| `ativo.registro@test.local` | `2` | — ✅ clean |
| `dr.john@test.local` | `2` | — ✅ clean (also `staff` of Comissão de Ética — a same-org two-commission holder) |
| `staff4.ccih@test.local` | `2` | — ✅ clean |
| `staff1.ccih@test.local` | `2, 6` | phase assignment **and** a case grant |
| `staff2.ccih@test.local` | `6` | the full `administrativo` capability bundle **and** a narrative assignment |
| `staff3.ccih@test.local` | `2, 38` | a case grant conferring `write_case_content` |
| `multi@test.local` | `2, 6` | a case grant |
| `pqsdual.a@test.local` | `2, 6` | the S6 PQS/NSP arm (a second role) |
| `suspenso.temp@test.local` | `0` | the `is_active` gate (this one is the row-4 fixture, correctly) |

⛔ **`staff1.ccih@test.local` is the name a reader reaches for first and it is the worst choice** —
its extra reach comes from a phase assignment, which the `staff_admin` matrix already ruled *not
role-derived*. A cell keyed on it attributes an assignment's reach to the role. ⇒ the `424` driver's
`subject_holder` for `staff` must be one of the three clean personas, named in the suite, with the
contamination of the others recorded beside the choice so a later edit cannot silently swap them.

---

## 5. Two consequences the PO should see with the table

1. ⭐ **Row 5 (`pending`) is GRANTED, and for `staff` the fixture actively hides it.** The generator
   must emit those cells expecting **GRANTED**, and T4 must make the coordinate constructible. Both
   halves are needed: expecting GRANTED against an unfillable fixture is still a cell that cannot
   fail.
2. ⚠ **Row 4 cannot be tested apart from row 3** (Limitation A). The generator names `inactive` and
   `suspended` separately and the fixtures construct them separately, but no `staff` enforcement site
   distinguishes them. Encode that as an exclusion rule carrying this reason, ⛔ not as prose.

---

## 6. ⚠ Row 7 will look like a bug — the mechanism travels WITH the assertion

A third-party check carrying the **wrong hat**, or **no hat at all**, is **GRANTED**. To a reader who
does not know the § 6A asymmetry that is a defect, and the first instinct of a future reviewer will
be to "fix" it. The mechanism, verbatim from `app.has_role_any` on the live catalog:

```sql
and (p_user_id is distinct from auth.uid() or m.role is not distinct from app.active_role())
```

When `p_user_id <> auth.uid()` the first disjunct is true and the hat is never evaluated. ⛔ **Both
polarities are required**: a suite emitting only the self-check passes while pinning the
uniform-apply bug, which would break every third-party `is_member_of_for` site. ⚠ **Two grains, and
they are not interchangeable**: **39** call sites live in **33** distinct functions. Of the 39
sites, **35** pass a genuine third party (an assignee, a corrector, a reader, an appointee) and
**4** pass `auth.uid()` (or a variable bound to it) and are therefore **caller-keyed at the site**
despite using the `_for` form. Of the 33 functions, 4 contain a caller-keyed site and 30 contain a
third-party one — `public.create_referral_internal_note` contains both, so 4 + 30 − 1 = 33 and the
partition sums (matrix § 3.2). This
paragraph is to be duplicated into the `424` assertion itself, deliberately: the design doc is not
where someone about to "fix" it is looking.

---

## 7. § For PO approval

The PO is asked to rule **nine values** — the `expected effect` column of § 1, rows 0–8 — plus the
three limitation statements in § 3 (A restated, B restated with the § 2 widening, **C new**).

⛔ Nothing in this file may be cited as approved until that ruling is recorded in
[`docs/progress/ae5-staff.md`](../progress/ae5-staff.md), and until then every emitted cell carries
`expectedSource = 'deny-class:PROVISIONAL'`.

⚠ **Two items are ruled elsewhere and are NOT part of this approval**: the fixture work in § 4 is
T4/T13's, and the `app.is_member_of` PUBLIC-EXECUTE observation in § 3 Limitation C is filed as an
observation only — ⛔ no revoke in this unit.
