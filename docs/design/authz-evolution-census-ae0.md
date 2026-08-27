# AE0.1 — Catalog census, recorded with predicates

- **Task:** AE0.1 of `docs/plans/authz-evolution.md` (authority: ADR
  [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md)).
- **Measured:** 2026-08-27 (UTC), by `backend`.
- **Instrument:** [`scripts/authz-census-ae0.sql`](../../scripts/authz-census-ae0.sql) — read-only,
  block-numbered. Every figure below cites the block that derives it. The script ran end-to-end
  against local under `ON_ERROR_STOP=1`, exit 0.
- **Stacks, both at the SAME head:**

  | stack | head | migrations registered | server | how reached |
  | --- | --- | --- | --- | --- |
  | local | `20261003004300` | 475 | PostgreSQL 17.6 | `docker exec supabase_db_azkbbhskturikxpgmafq psql` |
  | linked remote (`azkbbhskturikxpgmafq`) | `20261003004300` | 475 | — | Supabase MCP `execute_sql`, SELECT only |

  Derivation (BLOCK 0): `select max(version), count(*) from supabase_migrations.schema_migrations`.

> **How to read this file.** A number here is admissible only with its predicate. Where a published
> figure and this census disagree, the disagreement is recorded as a **delta** and explained — no
> predicate was adjusted to make a number agree with prose. Comparison figures are ADR 0155
> § *Measured figures* (local, head `20261003004300`) and
> [the audit](authorization-model-evolution-audit-2026-08-26.md) § *Measured catalog snapshot*
> (local, head `20261003003800`).

---

## 0. Summary of deltas

| # | Subject | Verdict |
| --- | --- | --- |
| D1 | 131 vs 117 role-helper policies | **Explained and reproduced.** Both are exact on both stacks; the whole difference is the term `is_admin`. See §3. |
| D2 | ADR's `anon` row: "237 (was 167 at the audit's snapshot)" | **Delta — the growth claim is false.** 167 and 237 are two different predicates measured at the *same* instant on the *same* head. See §6. |
| D3 | Audit's "SECURITY DEFINER functions in `public` + `app` = 842" | **Delta of 1.** Its own component rows (454 + 389) sum to 843, which is what both stacks measure. See §6. |
| D4 | ADR's role-helper regex names `is_commission_admin` | **Delta — the term matches nothing anywhere.** No function of that name exists; the helper is `app.is_tenancy_admin_of`. See §3.4. |
| D5 | ADR's role-helper regex omits `is_tenancy_admin_of` (53 policies) | **Delta in the predicate, not in the count.** Zero coverage is lost — every such policy also matches another term. See §3.4. |
| D6 | `docs/backend-state.md` § REMOTE CENSUS 2026-08-18: "the production DB is EMPTY" | **Stale.** The linked remote now holds the E2E seed fixture plus activity. See §9. |
| — | every other figure | local = remote = published value. |

**Catalog drift local vs remote: zero.** Every catalog figure in §§1–8 is identical on both stacks.
The only local/remote divergence is **row data** (§9).

---

## 1. RLS baseline and the policy population (BLOCK 1)

| figure | local | remote | ADR 0155 | audit |
| --- | ---: | ---: | ---: | ---: |
| `public` tables | 170 | 170 | — | — |
| …with RLS enabled | 170 | 170 | 170/170 | 170/170 |
| …RLS-enabled with ≥1 policy | 163 | 163 | — | — |
| …RLS-enabled with **zero** policies | 7 | 7 | — | 7 (advisor findings) |
| `public` policies | **278** | **278** | 278 | 278 |
| …PERMISSIVE | 278 | 278 | — | — |
| …RESTRICTIVE | **0** | **0** | — | — |
| …`FOR ALL` PERMISSIVE | 62 | 62 | — | — |

```sql
-- tables / RLS
select count(*), count(*) filter (where c.relrowsecurity)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';

-- policies, permissive/restrictive/FOR ALL
select count(*),
       count(*) filter (where pol.polpermissive),
       count(*) filter (where not pol.polpermissive),
       count(*) filter (where pol.polpermissive and pol.polcmd = '*')
from pg_policy pol
join pg_class c on c.oid = pol.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public';
```

**Partitions sum:** 163 + 7 = 170 tables. 278 permissive + 0 restrictive = 278 policies.

**Zero positive-controlled:** `policies_restrictive = 0` is the `not polpermissive` half of a
predicate whose other half returns **278** in the same result set — the instrument is proven able
to return non-zero.

**The 7 zero-policy RLS tables** (AE1.6's input; door-only / default-deny by design):
`case_print_revisions`, `meeting_closed_session_item_readers`, `meeting_closed_session_items`,
`patient_identifiers`, `patient_participants`, `referral_patient`, `verification_lookups`.
Three of those are the Rule 12 patient-PHI tables.

**62 `FOR ALL` PERMISSIVE policies** is recorded because it is the size of
`authz-handoff.md` §7.1's single most persistent structural blind spot: a positive row-assertion on
any of those 62 tables is vacuous until mutation-proven.

---

## 2. Policies reading `memberships` directly (BLOCK 4)

**Local 4 / remote 4 / ADR 4 / audit 4.** Identical rows on both stacks:

| table | policy | cmd | permissive |
| --- | --- | --- | --- |
| `hospital_affiliations` | `hospital_affiliations_select` | SELECT | PERMISSIVE |
| `professional_credentials` | `professional_credentials_select` | SELECT | PERMISSIVE |
| `profiles` | `profiles_admin_select` | SELECT | PERMISSIVE |
| `profiles` | `profiles_select_self_or_admin` | SELECT | PERMISSIVE |

```sql
select tablename, policyname, cmd, permissive
from pg_policies
where schemaname = 'public'
  and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~* 'memberships'
order by tablename, policyname;
```

The names are printed because "4" without them is not re-verifiable by the next reader.

---

## 3. Role-helper-calling policies — the two predicates, side by side

### 3.1 The wider figure — **131** (local = remote = ADR 0155)

ADR 0155's predicate, verbatim, applied to `qual || ' ' || with_check` over `public` policies:

```
has_role|is_admin|is_org_admin|is_hospital_admin|is_staff_admin|is_member_of|is_nsp_|is_commission_admin
```

### 3.2 The narrower figure — **117** (local = remote = the audit)

The audit **did not publish its regex**. It is reconstructed here as the ADR's list minus exactly
one term, and that reconstruction reproduces 117 exactly on both stacks:

```
has_role|is_org_admin|is_hospital_admin|is_staff_admin|is_member_of|is_nsp_|is_commission_admin
```

```sql
with pol as (
  select coalesce(qual, '') || ' ' || coalesce(with_check, '') as expr
  from pg_policies where schemaname = 'public'
)
select count(*) filter (where expr ~ 'has_role|is_admin|is_org_admin|is_hospital_admin|is_staff_admin|is_member_of|is_nsp_|is_commission_admin') as wide,   -- 131
       count(*) filter (where expr ~ 'has_role|is_org_admin|is_hospital_admin|is_staff_admin|is_member_of|is_nsp_|is_commission_admin')            as narrow, -- 117
       count(*) filter (where expr ~ 'is_admin'
                          and expr !~ 'has_role|is_org_admin|is_hospital_admin|is_staff_admin|is_member_of|is_nsp_|is_commission_admin') as delta   -- 14
from pol;
```

### 3.3 What the wider one includes — as a sentence

> **The wider predicate additionally counts the 14 policies whose only role-helper call is
> `app.is_admin()` — the platform-admin helper, which reads `profiles.is_admin` (or the JWT
> `is_admin` claim) and `app.active_role()`, and never touches `memberships` at all.**

That is the whole difference: `131 − 14 = 117`. The two numbers answer two different questions —
131 is *"policies gated on any role vocabulary"*, 117 is *"policies gated on scoped membership
roles"*. For D6/D7 blast-radius reasoning the **117** figure is the relevant one, because the 14
platform-admin policies are unaffected by anything that happens to `memberships`; for the AE5.7
`platform_admin` noun-rule work the **131** figure is the relevant one.

### 3.4 The predicate is not the vocabulary — two findings

The role helpers actually referenced by `public` policies, derived from the catalog rather than
hand-listed (BLOCK 3; identical local and remote):

| function called by a policy | policies |
| --- | ---: |
| `app.is_staff_admin_of` | 62 |
| **`app.is_tenancy_admin_of`** | **53** |
| `app.is_member_of` | 39 |
| `app.is_admin` | 26 |
| `app.is_org_admin_of` | 19 |
| `app.is_hospital_admin_of` | 13 |
| `app.is_org_member` | 8 |
| `app.is_nsp_org_admin_of` | 3 |
| `app.member_can` | 3 |
| `app.is_hospital_member_of` | 2 |
| `app.is_staff_admin_of_for` | 2 |
| `app.is_org_level_admin_within` | 1 |

```sql
with pol as (
  select tablename, policyname, coalesce(qual,'')||' '||coalesce(with_check,'') as expr
  from pg_policies where schemaname = 'public'
),
calls as (
  select distinct pol.tablename, pol.policyname, m[1] as fn
  from pol, regexp_matches(pol.expr, '((?:app|public)\.[a-z0-9_]+)\s*\(', 'g') as m
)
select fn, count(distinct tablename || '.' || policyname) as policies
from calls where fn ~ 'admin|role|member|nsp|staff'
group by fn order by 2 desc, 1;
```

**D4 — `is_commission_admin` names a helper that does not exist.** It matches 0 policies, **0
function names, and 0 function bodies** in `app` + `public`. The helper it refers to was renamed;
`app.is_tenancy_admin_of` is called by 77 function bodies and 53 policies. Carrying a dead term in a
published predicate costs nothing numerically and is exactly the *"a rename orphans a name-keyed
verdict"* shape — a future reader sweeping for `is_commission_admin` will find nothing and may
conclude the surface is gone.

**D5 — `is_tenancy_admin_of` is named by neither published predicate**, yet is the second-largest
helper by policy count. It is **not** a coverage gap: `0` of its 53 policies fail the wide
predicate (they all also call `is_staff_admin_of` / `is_member_of` / `is_org_admin_of`). It is a
predicate-quality finding, not a number finding.

```sql
select count(*) from pg_policies where schemaname='public'
  and (coalesce(qual,'')||' '||coalesce(with_check,'')) ~ 'is_tenancy_admin_of'
  and (coalesce(qual,'')||' '||coalesce(with_check,'')) !~ 'has_role|is_admin|is_org_admin|is_hospital_admin|is_staff_admin|is_member_of|is_nsp_|is_commission_admin';
-- 0 (local and remote)
```

### 3.5 The partition — the parts sum (BLOCK 2a)

Policies by how many of the ADR's 8 terms they match:

| terms matched | policies |
| ---: | ---: |
| 0 | 147 |
| 1 | 112 |
| 2 | 9 |
| 3 | 6 |
| 4 | 4 |

`147 + 112 + 9 + 6 + 4 = 278` (the policy total) and `112 + 9 + 6 + 4 = 131` (the wide set).
19 policies match two or more terms, which is why per-term counts do not add to 131 on their own.

### 3.6 Per-term contribution and its zeros (BLOCK 2b/2c)

| term | policies matching | exclusive contribution |
| --- | ---: | ---: |
| `is_staff_admin` | 64 | 62 |
| `is_member_of` | 39 | 35 |
| `is_admin` | 26 | **14** |
| `is_org_admin` | 19 | 1 |
| `is_hospital_admin` | 13 | 0 |
| `is_nsp_` | 3 | 0 |
| `has_role` | **0** | 0 |
| `is_commission_admin` | **0** | 0 |

*Exclusive contribution* = policies the wide set would lose if that single term were dropped;
`62 + 35 + 14 + 1 = 112`, matching the `n_terms = 1` row above.

**Zeros positive-controlled (BLOCK 2c):**

| zero | why it is real | the control |
| --- | --- | --- |
| `has_role` matches 0 **policies** | two-layer design: policies call the `is_*_of` layer; that layer calls `app.has_role` / `app.has_role_any`; only that layer reads `memberships` | the same probe over `pg_proc` returns **2** functions named `has_role*` and **24** bodies calling `has_role` |
| `is_commission_admin` matches 0 policies | the name does not exist in the catalog at all | same probe returns **6** for `^is_nsp_` and **77** bodies for `is_tenancy_admin_of` — the instrument finds names when they exist |

Evidence for the two-layer claim, read from the catalog (comment-stripped `prosrc`):

```
app.is_staff_admin_of  :  select app.is_active((select auth.uid()))
                            and app.has_role('commission', p_commission_id, 'staff_admin', (select auth.uid()));
app.is_tenancy_admin_of:  select app.is_tenancy_admin_of_for(p_commission_id, (select auth.uid()));
```

This is the `X` / `X_for` pair trap in the catalog: **policies call the bare form, functions call
the `_for` form.** `app.is_staff_admin_of_for` appears in 2 policies and `app.is_staff_admin_of` in
62 — an anchored sweep for either alone misses the other.

---

## 4. Functions reading `memberships` (BLOCK 5)

| figure | local | remote | ADR 0155 | audit |
| --- | ---: | ---: | ---: | ---: |
| functions reading `memberships` (`public` + `app`, comment-stripped) | **41** | **41** | 41 | 41 |
| …`SECURITY DEFINER` | 37 | 37 | — | — |
| …`SECURITY INVOKER` | 4 | 4 | — | — |
| control: what the **uncommented** `prosrc` would report | 41 | 41 | — | — |

```sql
select count(*) filter (where prosecdef)     as definer,
       count(*) filter (where not prosecdef) as invoker,
       count(*)                              as total
from (
  select p.prosecdef, regexp_replace(p.prosrc, '--[^\n]*', '', 'g') as src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('app', 'public')
) f
where f.src ~ '\mmemberships\M';
```

Comment-stripping is applied because it is non-negotiable method, **and the control says so
honestly: for this particular target it changes nothing.** Stripping can only remove matches, so
`41 == 41` means **zero functions match `memberships` only inside a `--` comment** — the figure is
the same with or without the strip. (It does *not* prove no comment anywhere mentions the word; it
proves no comment inflates the count.) Recording the control is the point; assuming it would have
been the error.

The 37/4 DEFINER split is recorded because `prosecdef` belongs beside `pg_policies`: 37 of the 41
`memberships` readers are functions whose own gate **replaces** RLS, so the 4-policy figure in §2
is not a measure of reachability.

### 4.1 Transitive `memberships` dependency — the figure the flat counts do not give (BLOCK 5a)

| figure | local | remote | published anywhere |
| --- | ---: | ---: | --- |
| `app`/`public` functions transitively reaching a `memberships` reader | **573** | **573** | not previously measured |
| `public` policies transitively depending on `memberships` | **233** of 278 | **233** of 278 | not previously measured |

```sql
-- see scripts/authz-census-ae0.sql BLOCK 5a for the full recursive CTE
```

**Why it matters:** the two published figures read *"4 policies mention `memberships`"* and
*"131 policies call a role helper"*. Neither is the D6 blast radius. **233 of 278 policies (84%)
evaluate a predicate that transitively reads `memberships`.** Any change to that table's shape or
semantics is felt by five sixths of the policy surface, not by four policies.

**Limits, stated:** the call graph matches a captured callee *name* against `app`/`public`
pronames, so it ignores overloads and cannot distinguish a same-named function in another schema.
It **over-includes rather than under-includes** — treat 573/233 as an upper bound, and re-derive
before using either number as an acceptance threshold.

---

## 5. `app.can_*` functions (BLOCK 6)

**Local 51 / remote 51 / ADR 51 / audit 51.**

```sql
select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app' and p.proname like 'can\_%';
```

---

## 6. SECURITY DEFINER counts and effective EXECUTE (BLOCK 6)

Every privilege figure is asserted **positively** via `has_function_privilege` /
`has_schema_privilege`. A NULL `proacl` includes PUBLIC, so ACL-column inspection is never used.

| figure | local | remote | ADR 0155 | audit |
| --- | ---: | ---: | ---: | ---: |
| DEFINER in `public` | **454** | **454** | 454 | — |
| DEFINER in `app` | **389** | **389** | 389 | — |
| DEFINER total | **843** | **843** | (454+389 = 843, not stated) | **842** ← D3 |
| DEFINER in `public` executable by `authenticated` | **432** | **432** | 432 | 432 |
| DEFINER in `app` executable by `authenticated` | **320** | **320** | 320 | 320 |
| DEFINER in `app` executable by `anon` | **167** | **167** | — | 167 |
| **all** `app` functions executable by `anon` | **237** | **237** | 237 | — |
| **all** `public` functions executable by `anon` | **0** | **0** | — | 0 "effectively" |
| `anon` has USAGE on schema `app` | **false** | **false** | (asserted, not shown) | asserted |
| `anon` has USAGE on schema `public` | true | true | — | — |
| `authenticated` has USAGE on schema `app` | true | true | — | — |
| DEFINER without a pinned `search_path` | **0** | **0** | — | 0 |

```sql
with f as (
  select p.oid, n.nspname as sch, p.prosecdef, p.proconfig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('app', 'public')
)
select count(*) filter (where sch='public' and prosecdef)                                                     as definer_public,
       count(*) filter (where sch='app'    and prosecdef)                                                     as definer_app,
       count(*) filter (where sch='public' and prosecdef and has_function_privilege('authenticated', oid, 'EXECUTE')) as pub_auth,
       count(*) filter (where sch='app'    and prosecdef and has_function_privilege('authenticated', oid, 'EXECUTE')) as app_auth,
       count(*) filter (where sch='app'    and prosecdef and has_function_privilege('anon', oid, 'EXECUTE'))   as app_anon_definer,
       count(*) filter (where sch='app'    and has_function_privilege('anon', oid, 'EXECUTE'))                 as app_anon_all,
       count(*) filter (where sch='public' and has_function_privilege('anon', oid, 'EXECUTE'))                 as public_anon_all
from f;

select has_schema_privilege('anon','app','USAGE'),
       has_schema_privilege('anon','public','USAGE'),
       has_schema_privilege('authenticated','app','USAGE');
```

### 6.1 D3 — the audit's DEFINER total does not sum

The audit publishes `842` as the `public` + `app` DEFINER total while its own component row reads
`432 in public, 320 in app` for the executable subset and ADR 0155 publishes `454` + `389` = **843**
for the totals. Both stacks measure **843** right now. The audit measured at head
`20261003003800` and the ADR at `20261003004300`, so a one-function difference is possible — but the
audit's own two rows are internally inconsistent at any single head, so `842` should not be quoted.
**Quote 843, or quote 454 + 389 with the head attached.**

### 6.2 D2 — the `anon` "167 → 237 growth" is a predicate change, not growth

ADR 0155's row reads *"237 (was 167 at the audit's snapshot)"* and the AE1.2 plan text builds on it
(*"This stops the 167→237 `anon`-residue growth at its source"*). Measured **right now, at one head,
in one query**:

- `app` functions that are `SECURITY DEFINER` **and** `anon`-executable: **167**
- `app` functions that are `anon`-executable, **any security type**: **237**
- difference: **70 `SECURITY INVOKER` `app` functions**

The audit's `167` sits in a table whose two neighbouring rows are DEFINER-scoped and whose
`432 / 320` split reproduces exactly under a DEFINER-scoped predicate — so `167` is DEFINER-scoped
and `237` is not. **There is no measured growth between the two snapshots; there are two
predicates.** AE1.2's premise text should be corrected before the default-privilege work is planned
against it, and the residue should be stated as *"237 `anon`-executable `app` functions, of which
167 are DEFINER"*.

**Inertness is unchanged and still holds:** `anon` lacks `USAGE` on schema `app`, so all 237 are
unreachable. That is a *schema-grant* fact, and it is the only thing standing between the residue
and reachability — which is precisely why `FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED` exists.

### 6.3 Zeros positive-controlled

| zero | control run in the same result set |
| --- | --- |
| `public` functions `anon`-executable = **0** | the identical `has_function_privilege('anon', …)` predicate returns **237** for schema `app` — the instrument returns non-zero when the grant exists |
| DEFINER without pinned `search_path` = **0** | the same `proconfig`-scan returns **843** for the WITH half, and **6** for `SECURITY INVOKER` functions WITHOUT a pinned path — both the predicate and its negation are shown able to be non-zero |

Note the 6 invoker functions without a pinned `search_path`: outside every published figure, and a
candidate for AE1.2's classification pass. Not a finding here, a pointer.

---

## 7. FK census (BLOCK 7)

| figure | local | remote | ADR 0155 | audit |
| --- | ---: | ---: | ---: | ---: |
| **tables** with an FK to `profiles` | **93** | **93** | 93 | 93 |
| FK **constraints** pointing to `profiles` | **145** | **145** | (145) | 145 |
| `commission_administrativos` FK constraints | **1** | **1** | 1 | 1 (F7) |

```sql
select count(distinct c.conrelid) as tables, count(*) as constraints
from pg_constraint c
join pg_class rt on rt.oid = c.confrelid
join pg_namespace rn on rn.oid = rt.relnamespace
where c.contype = 'f' and rn.nspname = 'public' and rt.relname = 'profiles';
```

Every constraint on `commission_administrativos` (BLOCK 7a), identical on both stacks:

| name | type | definition |
| --- | --- | --- |
| `commission_administrativos_appointed_by_fkey` | f | `FOREIGN KEY (appointed_by) REFERENCES profiles(id)` |
| `commission_administrativos_pkey` | p | `PRIMARY KEY (commission_id, user_id)` |

**F7 confirmed exactly:** the only FK is `appointed_by`. Neither `commission_id` nor `user_id`
carries one, although both are in the primary key. That is AE1.1's work item.

### 7.1 AE1.1 orphan preflight, positive-controlled (BLOCK 7b)

| figure | local | remote |
| --- | ---: | ---: |
| `commission_administrativos` rows | 1 | 1 |
| orphaned `commission_id` | **0** | **0** |
| orphaned `user_id` | **0** | **0** |
| control: same `not exists` shape against a known-absent uuid | **1** | — |

The zero is believable because the identical `not exists` shape returns **1** when pointed at
`00000000-0000-0000-0000-000000000000`. Both stacks are clean; AE1.1's FKs can be added
`NOT VALID` → `VALIDATE` with no repair decision pending.

---

## 8. The withheld `profiles` column grants (BLOCK 8)

Identical on both stacks. `has_column_privilege`, asserted positively, per column:

| column | `authenticated` SELECT | `authenticated` UPDATE | `authenticated` REFERENCES | `anon` SELECT |
| --- | :---: | :---: | :---: | :---: |
| `id` | t | t | t | f |
| `full_name` | t | t | t | f |
| `is_admin` | t | t | t | f |
| `is_active` | t | t | t | f |
| `created_at` | t | t | t | f |
| `email` | t | t | t | f |
| `home_organization_id` | t | t | t | f |
| `professional_category_id` | t | t | t | f |
| `email_confirmed_at` | t | t | t | f |
| `suspended_until` | t | t | t | f |
| `must_change_password` | t | t | t | f |
| **`cpf`** | **f** | **f** | **t** | f |
| **`date_of_birth`** | **f** | **f** | **t** | f |
| **`phone`** | **f** | **f** | **t** | f |

```sql
select a.attname,
       has_column_privilege('authenticated','public.profiles',a.attname,'SELECT'),
       has_column_privilege('authenticated','public.profiles',a.attname,'UPDATE'),
       has_column_privilege('authenticated','public.profiles',a.attname,'REFERENCES'),
       has_column_privilege('anon','public.profiles',a.attname,'SELECT')
from pg_attribute a
where a.attrelid = 'public.profiles'::regclass and a.attnum > 0 and not a.attisdropped
order by a.attnum;
```

**Withheld columns: 3** (`cpf`, `date_of_birth`, `phone`) — matches ADR 0155 exactly.

**The 11 non-withheld columns are the positive control**: the same call returns `true` for them,
so `false` on the three is a measured refusal, not an instrument that always says no.

**Two things AE3 must carry forward, both visible only because the census asked about more than
SELECT:**

1. **`REFERENCES` remains granted on all three withheld columns.** That is not decoration — a
   column-level `SELECT` revoke that also revoked `REFERENCES` would break FK validation. Whatever
   AE3 does when the columns move to `profile_private_details`, the mechanism being retired is
   `SELECT`/`UPDATE` withholding, not `REFERENCES`.
2. **`authenticated` holds column-level `UPDATE` on `is_admin`, `is_active` and `suspended_until`.**
   The grant layer does not stop those writes; the `guard_profile_privileged_columns` trigger and
   RLS do. Any AE1.3 / AE3 reasoning that treats the column grant as the lifecycle protection is
   reading the wrong layer.

`anon` holds nothing on `profiles` — every column `false`; the control is the `authenticated`
column of the same table.

---

## 9. Data-state census (BLOCK 9) — the one local/remote divergence

**Not a catalog figure.** Recorded because the plan requires every local/remote divergence to be
explained in writing, and because `docs/backend-state.md` § REMOTE CENSUS 2026-08-18 states the
production DB is empty. **It is not.**

| figure | local | remote |
| --- | ---: | ---: |
| `auth.users` | 36 | **36** |
| …with an `@test.local` address | 36 | **36** |
| `profiles` | 36 | 36 |
| `organizations` | 3 | 3 |
| `hospitals` | 4 | 4 |
| `commissions` | 6 | 6 |
| `organization_affiliations` | 35 | 35 |
| `cases` | 8 | **15** |
| `audit_log` | 264 | **538** |

**Reading:** the linked remote holds the **E2E seed fixture** — all 36 accounts are `@test.local`,
and organizations / hospitals / commissions / affiliations match the local seed row-for-row. It also
holds **more `cases` (15 vs 8) and more `audit_log` rows (538 vs 264)** than a fresh seed produces,
i.e. activity was run against it after the seeding. This is the known
*"a remote reset seeds PRODUCTION with the E2E fixture"* shape.

**Consequences, stated so they are not re-derived:**

- **D6:** `docs/backend-state.md` § REMOTE CENSUS 2026-08-18's "the production DB is EMPTY" is stale
  and should be re-recorded by whoever owns that file (not this task's scope — the lead is told).
- **AE3's G2 premise still holds, and must still be re-measured at branch-cut, never quoted from
  here:** zero non-`@test.local` accounts exist today, so no real personal data has loaded. The
  discriminator is `email like '%@test.local'`, and it is in BLOCK 9 so it can be re-run in one
  statement.
- **AE0.2's `EXPLAIN` baselines are local-only and stay local-only.** The remote's cardinalities are
  seed-sized too, so nothing about it makes it a production-latency reference.

---

## 10. Figures NOT derived by this task

Named rather than approximated, per the plan's rule that an underivable figure is a finding:

| figure | why it is not here |
| --- | --- |
| App-side raw service-role DML sites (ADR: **12**, of which 9 person-authority) | **AE0.4**, owned by a sibling agent this phase. It is a source-tree sweep, not a catalog figure, and deriving it twice with two instruments would produce two numbers with one label. |
| Supabase security / performance advisor findings (7 RLS-no-policy, 9 mutable search_path, 113 `auth_rls_initplan`, 96 multiple-permissive, 202 unindexed FK) | **AE0.3**. §1 records the catalog half of the first (7 zero-policy tables) and §6.3 the catalog half of the second (6 invoker functions without a pinned path); the advisor's own output is AE0.3's artifact. |
| `EXPLAIN (ANALYZE, BUFFERS)` plans | **AE0.2**. |
| Whether the audit's `842` was true at head `20261003003800` | **Not derivable.** Neither stack is at that head, and no stack may be moved to it to find out. Recorded as unresolved in D3 rather than reconstructed. |
| The audit's actual role-helper regex | **Not recorded anywhere.** §3.2's is a *reconstruction* that reproduces 117 on both stacks; it is not the audit's text. Anyone citing 117 should cite §3.2's regex, not "the audit's". |

---

## 11. Method notes — what this census did to avoid the known failures

- **Catalog only.** `pg_policies`, `pg_policy`, `pg_proc` (with `prosecdef`), `pg_constraint`,
  `pg_class`, `pg_attribute`, and the `has_*_privilege` family. No migration file was read, and no
  figure here was taken from one.
- **`prosrc` comment-stripped everywhere**, with the strip's effect measured rather than assumed
  (§4: it is a no-op for `memberships`, and that is recorded, not hidden).
- **Helper names probed unanchored**, then disambiguated by reading the catalog (§3.4/§3.6). `\y`
  would have missed `is_staff_admin_of_for`.
- **All grant figures asserted positively** with `has_function_privilege` /
  `has_column_privilege` / `has_schema_privilege`; `proacl` was never inspected.
- **`prosecdef` reported beside every policy figure** (§4's 37/4 split, §6 throughout).
- **Every zero carries a positive control** in the same result set: §1 restrictive policies, §3.6
  `has_role` and `is_commission_admin`, §6.3 `public`/`anon` EXECUTE and pinned `search_path`, §7.1
  orphans, §8 the withheld columns.
- **Every decomposition sums** and the arithmetic is printed: §1 (163+7=170, 278+0=278), §3.5
  (147+112+9+6+4=278; 112+9+6+4=131), §3.6 (62+35+14+1=112), §6 (454+389=843).
- **No predicate was tuned to match prose.** §3.2's reconstruction was derived from the per-term
  exclusive-contribution table (§3.6) — `is_admin` contributes exactly 14, so dropping it gives 117 —
  and only then compared against the audit's published number. The agreement is a result, not a target.
