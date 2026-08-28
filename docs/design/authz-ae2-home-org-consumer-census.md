# AE2.1 — Consumer census of `profiles.home_organization_id`

> **Derived 2026-08-27** against the local catalog at migration head `20261003005300`
> (484 applied == 484 on disk). Plan task **AE2.1** of
> [authz-evolution.md](../plans/authz-evolution.md); ruling that consumes it: ADR
> [0163](../decisions/0163-offboarded-person-lifecycle-authority.md).
>
> ⭐ **Every load-bearing count below was re-derived independently by the lead before this
> file was committed**, on the same catalog, with the queries shown in each section — 3 RLS
> legs (0 in `with_check`), 13 comment-stripped functions (14 raw), 12 DEFINER + 1 INVOKER,
> 0 views, 0 matviews, 1 FK, **0 indexes**, `attnotnull = f`, 36 profiles / 1 NULL / that 1
> `is_admin`. Both derivations agree. ⚠ That makes them *reproducible*, not permanent:
> **re-derive, never quote** — this census is a photograph of one migration head.
>
> ⛔ **A count without its predicate is not admissible here**, which is why each section
> carries its query. The AFF4-era claim *"the RLS legs and the tenant trigger stay"* names
> **classes**; this file is the **count**, and the two are not interchangeable.

## ⛔ The trap AE2.2 must not walk into — found while verifying this census

`assert_profile_tenant_has_org` (the tenant-containment trigger, class 2) is
**`prosecdef = f` — SECURITY INVOKER** — and today that is completely harmless, because its
body reads **no table at all**:

```
if new.home_organization_id is null and not new.is_admin then raise …
```

It is a pure NULL check on `new`. **AE2.2 changes exactly that.** Re-predicating containment
onto "an active org affiliation" makes this trigger read `public.organization_affiliations`,
whose SELECT policy is

```
(principal_id = (SELECT auth.uid())) OR app.is_org_admin_of(organization_id)
```

— **no hospital tier, by design** (ADR 0151 D1). An INVOKER trigger reading that under a
`hospital_admin`'s RLS cannot see the row, raises a false positive, and reproduces
`BUG-D5-REHIRE-HOSPADMIN-001` — the AFF4 regression that broke one-step rehire for **every**
`hospital_admin`, unconditionally.

⚠ **The plan points at this lesson with the wrong function.** Its AE2.2 sentence reads *"the
AFF4 D4 backstop is already SECURITY DEFINER per ADR 0159 — extend, don't fork"*. That
names `app.assert_hospital_affiliation_has_org`, which is indeed `prosecdef = t`. **The
trigger AE2.2 actually re-predicates is the other one, and it is INVOKER.** Read literally,
the plan's reassurance is true of a function this phase does not touch.

**Binding consequence:** the re-predication must make `assert_profile_tenant_has_org`
SECURITY DEFINER with a pinned `search_path` **in the same migration that gives it a table
read** — never as a follow-up — and AE2.3's differential must carry a `hospital_admin`
containment-accept cell, which is exactly the cell ADR 0159 says nothing else would catch.

---

## Class 0 — The column itself

```sql
select table_schema, table_name, column_name, data_type, is_nullable,
       column_default, is_generated, generation_expression
from information_schema.columns
where column_name = 'home_organization_id'
order by 1,2;
```

| schema | table | type | is_nullable | default | generated |
|---|---|---|---|---|---|
| public | profiles | uuid | **YES** | *(none)* | NEVER |

**Predicate:** `information_schema.columns.column_name = 'home_organization_id'`,
unqualified by schema — so this is every column of that name in the database.
**Count = 1.** The column exists on exactly one relation, `public.profiles`.

---

## Class 1 — `pg_policies` (RLS)

```sql
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where coalesce(qual,'')       ~ 'home_organization_id'
   or coalesce(with_check,'') ~ 'home_organization_id'
order by schemaname, tablename, policyname;
```

**Predicate:** unanchored regex `~ 'home_organization_id'` over **both** `qual` and
`with_check` (the helper-name-pair trap: an anchored or word-bounded match would miss
a `home_organization_id_for`-style variant. None exists — every match below is the bare
column — but the predicate is unanchored so that claim is *measured*, not assumed).

**Count = 3.** All three are `SELECT`; **no policy references the column in `with_check`**
(all `with_check` are `<none>`), i.e. the column is a read-gate input only, never a
write-gate input.

| # | table | policy | cmd | matching fragment |
|---|---|---|---|---|
| 1 | `public.professional_credentials` | `professional_credentials_select` | SELECT | `EXISTS (SELECT 1 FROM profiles p WHERE p.id = professional_credentials.user_id AND p.`**`home_organization_id`**` IS NOT NULL AND app.is_org_admin_of(p.`**`home_organization_id`**`))` |
| 2 | `public.profiles` | `profiles_admin_select` | SELECT | `((`**`home_organization_id`**` IS NOT NULL) AND app.is_org_admin_of(`**`home_organization_id`**`))` |
| 3 | `public.profiles` | `profiles_select_self_or_admin` | SELECT | `((`**`home_organization_id`**` IS NOT NULL) AND app.is_org_admin_of(`**`home_organization_id`**`))` |

In all three the column appears as **one disjunctive leg** (`OR`) among several — the
org-admin leg. Sibling legs on the same policies key on `hospital_affiliations`,
`memberships`, `app.is_admin()`, and self-identity, and are untouched by this column.

---

## Class 2 — `pg_proc.prosrc`, schemas `public` + `app`

```sql
select n.nspname, p.proname, p.prosecdef,
       (p.prosrc ~ 'home_organization_id')                                as raw_hit,
       (regexp_replace(p.prosrc,'--[^\n]*','','g') ~ 'home_organization_id') as stripped_hit
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','app')
  and p.prosrc ~ 'home_organization_id'
order by 1,2;
```

**Predicate:** unanchored regex over `prosrc`, **after stripping `--` line comments**
(`regexp_replace(prosrc,'--[^\n]*','','g')`). Comment stripping is done on the whole
body at once, not line-filtered, so a multiline guard is not under-reported.

**Raw count = 14. Real (comment-stripped) count = 13.**
The differential is the point: **`public.list_org_people` is a comment-only reference**
(`raw=true`, `stripped=false`) — it mentions the column in a comment explaining that it
*no longer* filters on it. It is **not a consumer** and must not be re-predicated.

Matching lines, comment-stripped (`match #`, not source line number):

| # | function | `prosecdef` | matching line(s) |
|---|---|---|---|
| 1 | `app.affiliate_person_impl` | **t** | `select home_organization_id, is_active into v_person_org, v_person_active` |
| 2 | `app.affiliate_person_to_org_impl` | **t** | `select home_organization_id, is_active into v_person_org, v_person_active` |
| 3 | `app.can_administer_person_for` | **t** | `select pr.home_organization_id into v_org` |
| 4 | `app.delete_credential_impl` | **t** | `select pr.home_organization_id into v_org from public.profiles pr where pr.id = v_user;` |
| 5 | `app.finalize_invited_person_impl` | **t** | `select pr.home_organization_id into v_org from public.profiles pr where pr.id = p_user;` |
| 6 | `app.set_person_active_impl` | **t** | `select pr.home_organization_id into v_org from public.profiles pr where pr.id = p_user;` |
| 7 | `app.suspend_person_impl` | **t** | `select pr.home_organization_id into v_org from public.profiles pr where pr.id = p_user;` |
| 8 | `app.update_person_fields_impl` | **t** | `select pr.home_organization_id, pr.full_name, pr.professional_category_id,` / `v_org := v_cur.home_organization_id;` |
| 9 | `app.upsert_credential_impl` | **t** | `select pr.home_organization_id into v_org from public.profiles pr where pr.id = p_user;` |
| 10 | **`public.assert_profile_tenant_has_org`** | **f** | `if new.home_organization_id is null and not new.is_admin then` / `raise exception 'a non-admin profile must have home_organization_id (tenant anchor)'` |
| 11 | `public.guard_profile_privileged_columns` | **t** | `or new.home_organization_id is distinct from old.home_organization_id` |
| 12 | `public.handle_new_user` | **t** | `insert into public.profiles (id, full_name, email, home_organization_id, is_admin, email_confirmed_at)` / `nullif(new.raw_user_meta_data ->> 'home_organization_id','')::uuid,` |
| 13 | `public.list_addable_commission_members` | **t** | `where pr.home_organization_id = v_org_id` |
| — | ~~`public.list_org_people`~~ | t | **comment-only — NOT a consumer** |

**The tenant-containment trigger body is #10, `public.assert_profile_tenant_has_org`**
(`prosecdef = f` — it runs as the invoker; it is a constraint-trigger body, not a gate).

12 of the 13 are `prosecdef = t`. Nine of those (#1–#9) share one shape: read the
subject's home org into `v_org`, then gate on it — the AFF2 person-administration
family. Their gate is `app.can_administer_person_for` (#3), which is itself in the set,
so #1–#2 and #4–#9 consume the column both directly and transitively.

---

## Class 3 — App side, `src/`

```
rg -n "home_organization_id" src/
```

**Predicate:** literal, unanchored substring over every file under `src/`.
**Count = 50 lines across 14 files** — 28 in production modules, 22 in colocated
`*.test.ts`.

### 3a. Production modules — 28 lines

| file:line | reference | class |
|---|---|---|
| `src/lib/members/actions.ts:210` | `.select('id, home_organization_id, is_active')` | **read** |
| `src/lib/members/actions.ts:215` | `profile.home_organization_id !== orgId` (defense-in-depth authz gate) | **read** |
| `src/lib/members/invite.ts:52` | `.select('id, home_organization_id')` | **read** |
| `src/lib/members/invite.ts:70` | `existing.home_organization_id !== homeOrganizationId` | **read** |
| `src/lib/members/invite.ts:79` | `inviteUserByEmail(email, { data: { home_organization_id } })` | **write (indirect)** |
| `src/lib/users/person-footprint.ts:499` | `.select('home_organization_id, date_of_birth, phone, cpf')` | **read** |
| `src/lib/users/person-footprint.ts:502` | `home_organization_id: string \| null` | **type-only** |
| `src/lib/users/person-footprint.ts:508` | `profile?.home_organization_id ?? undefined` | **read** |
| `src/lib/users/actions.ts:382` | `.select('home_organization_id')` | **read** |
| `src/lib/users/actions.ts:385` | `data?.home_organization_id ?? undefined` | **read** |
| `src/lib/users/actions.ts:421` | `.select('home_organization_id')` | **read** |
| `src/lib/users/actions.ts:424` | `data?.home_organization_id ?? undefined` | **read** |
| `src/lib/users/actions.ts:620` | `const metadata = { full_name, home_organization_id: input.homeOrganizationId }` | **write (indirect)** |
| `src/lib/queries/members.ts:243` | `.eq('home_organization_id', organizationId)` on `profiles` | **read (filter)** |
| `src/lib/queries/org-users.ts:55` | column in the `PROFILE_SELECT` string | **read** |
| `src/lib/queries/org-users.ts:61` | `home_organization_id: string \| null` | **type-only** |
| `src/lib/queries/org-users.ts:761` | `homeOrganizationId: profile.home_organization_id ?? ''` | **read** |
| `src/lib/types/database.ts:8622` | `profiles.Row.home_organization_id: string \| null` | **type-only** |
| `src/lib/types/database.ts:8638` | `profiles.Insert.home_organization_id?: string \| null` | **type-only** |
| `src/lib/types/database.ts:8654` | `profiles.Update.home_organization_id?: string \| null` | **type-only** |
| `src/lib/types/database.ts:8665-8666` | `profiles_home_organization_id_fkey` relationship entry (2 lines) | **type-only** |
| `src/lib/queries/affiliations.ts:227` | prose comment | **comment-only** |
| `src/lib/users/actions.ts:478` | prose comment | **comment-only** |
| `src/lib/users/actions.ts:737` | comment: the column is *deliberately* not in the update column list | **comment-only** |
| `src/lib/queries/org-users.ts:33` | prose comment (cites the RLS leg) | **comment-only** |
| `src/lib/queries/org-users.ts:478,483` | prose comments (the B6a move away from this filter) | **comment-only** |

Production tally: **read 13 · write 2 · type-only 6 · comment-only 7** = 28.

**Finding on the write class.** There is **no direct write to `profiles.home_organization_id`
anywhere in `src/`** — no `.insert()` and no `.update()` names the column. Both "write"
sites write it into **`auth` user metadata**, which `public.handle_new_user` (Class 2 #12)
then copies into the row on signup. The column is set exactly once, by the DB, at
account creation. This is corroborated by `src/lib/users/actions.ts:737` and by pgTAP
`385_person_doors_authority_and_audit.sql:371`, which assert the person-doors' column
list deliberately omits it.

### 3b. Colocated unit tests — 22 lines

`invite.test.ts` (4: L30 type, L54/69/80 fixture) · `staff-ops-mirror.test.ts` (1) ·
`person-footprint-reads.test.ts` (1) · `person-admin-view.test.ts` (6) ·
`d14-person-level.test.ts` (2) · `org-roster-predicate.test.ts` (8).

All are **fixture rows** except `org-roster-predicate.test.ts:167/174/183/186/206`,
which is a **negative assertion** — it reds if `listOrgUsers` ever filters
`home_organization_id` again:

```ts
expect(calls.some((c) => c.args[0] === 'home_organization_id')).toBe(false)
```

That spec is a consumer of the column's *absence*, not its presence.

---

## Class 4 — Fixtures

```
grep -n  "home_organization_id" supabase/seed.sql
grep -rn "home_organization_id" supabase/tests
grep -rn "home_organization_id" supabase/demo supabase/snippets supabase/templates
```

**Predicate:** literal substring, fixture trees only. `supabase/migrations/**` is
**deliberately excluded** — migration text is stale by design (bodies are rewritten at
runtime via `pg_get_functiondef()` + `replace()` + `execute`), so the catalog classes
above are the truth for SQL, not the files.

| tree | files | lines |
|---|---|---|
| `supabase/seed.sql` | 1 | **6** |
| `supabase/tests/**` | **37** | **67** |
| `supabase/demo/**` | 1 | 2 |
| `supabase/snippets/**`, `supabase/templates/**` | 0 | **0** |

### `supabase/seed.sql` — 6 lines

| line | reference | class |
|---|---|---|
| 77, 111 | prose comments (the FK / tenant anchor) | comment-only |
| 257 | `'home_organization_id', u ->> 'org'` in the `auth.users` metadata builder | **write (indirect, via `handle_new_user`)** |
| 379 | prose comment | comment-only |
| 405 | `select pr.id, pr.home_organization_id, ...` | **read** |
| 407 | `where pr.home_organization_id is not null` | **read (filter)** |

### `supabase/tests/**` — 67 lines, 37 files

Dominant shape (≈50 of 67): `update public.profiles set home_organization_id = <org> where id = <persona>`
— a **fixture write** that re-anchors a seeded persona into a foreign org to build the
cross-tenant arm of a differential. Files: `144, 200, 205, 207, 225, 260, 261, 262,
270_authz_dashboard, 270_ff1, 276, 277, 278, 281, 284, 290, 295, 301, 306, 307, 308,
309, 310, 311, 313, 314, 356, 359, 360, 371, 372, 373, 385` and `00_setup.sql:170`.

Non-fixture references worth naming:

| file:line | reference | class |
|---|---|---|
| `180_user_registration.sql:47` | `has_column('public','profiles','home_organization_id', …)` | **schema assertion** |
| `180_user_registration.sql:88` | `count(*) … where home_organization_id is null and not is_admin` → asserts **0** | **assertion on the trigger's invariant** |
| `180_user_registration.sql:93` | `count(*) … where home_organization_id is null and is_admin` | **assertion on the admin exemption** |
| `301_hospital_affiliation_substrate.sql:448` | column in a probe `select` list | read |
| `385_person_doors_authority_and_audit.sql:369,371` | asserts the person door **leaves the column untouched**, naming `profiles_tenant_has_org_trg` | **negative assertion** |
| `374_c5_voided_affiliation_read_differential.sql:80,181` | asserts the org-admin RLS leg **keys on this column** and is untouched by B3 | **assertion on Class-1 policy** |
| `381_containment_actor_dimension.sql:51` | comment: the tenant anchor is this column, not an active org affiliation | comment-only |
| `00_setup.sql:174`, `207:295`, `284:35,40` | prose comments | comment-only |

### `supabase/demo/**` — 2 lines
`seed-revisao-prontuario.sql:157` (comment), `:203` (metadata write, same indirect shape as seed.sql:257).

---

## Views and materialized views

```sql
select schemaname, viewname   from pg_views    where definition ~ 'home_organization_id'
union all
select schemaname, matviewname from pg_matviews where definition ~ 'home_organization_id';
```

**Count = 0 views, 0 matviews.** Zero rows. No view definition anywhere in the database
references the column.

---

## Constraints, indexes, defaults, generated columns

```sql
-- constraints: by attnum membership OR by expression text
with a as (select attnum from pg_attribute
           where attrelid='public.profiles'::regclass and attname='home_organization_id')
select con.conname, con.contype, pg_get_constraintdef(con.oid)
from pg_constraint con, a
where con.conrelid='public.profiles'::regclass
  and (a.attnum = any(con.conkey) or pg_get_constraintdef(con.oid) ~ 'home_organization_id');

-- database-wide: any constraint / any index mentioning it
select count(*) from pg_constraint where pg_get_constraintdef(oid) ~ 'home_organization_id';
select count(*) from pg_indexes    where indexdef                 ~ 'home_organization_id';
select count(*) from pg_constraint where contype='c' and pg_get_constraintdef(oid) ~ 'home_organization_id';
```

| artefact | count | detail |
|---|---|---|
| Foreign key | **1** | `profiles_home_organization_id_fkey`: `FOREIGN KEY (home_organization_id) REFERENCES organizations(id) ON DELETE RESTRICT` |
| CHECK constraint | **0** | zero rows, database-wide |
| Index (any, incl. expression/partial) | **0** | zero rows, database-wide — **the column is unindexed** |
| Column default | **0** | `column_default` is NULL |
| Generated column | **0** | `is_generated = NEVER` |

⚠ The FK is the **only** declarative artefact. `ON DELETE RESTRICT` means an
`organizations` row cannot be deleted while any profile is anchored to it — that is a
consumer of the column in the write path of a *different* table.

⚠ **The unindexed FK is a live cost of the Class-1 policies**: three RLS `SELECT`
policies and `list_addable_commission_members` filter/join on it with no index behind it.

---

## NOT NULL: state and enforcement — **the plan's claim is CONFIRMED, with a qualifier**

```sql
select attnotnull from pg_attribute
where attrelid='public.profiles'::regclass and attname='home_organization_id';
-- → false

select t.tgname, pg_get_triggerdef(t.oid), t.tgenabled
from pg_trigger t join pg_class c on c.oid=t.tgrelid
where not t.tgisinternal and c.relname='profiles';
```

**Declarative state: `attnotnull = false`.** The column is **NULLABLE at the catalog
level**, and `information_schema` agrees (`is_nullable = YES`). There is no `NOT NULL`
and no CHECK.

**Enforcement is entirely by trigger**, and the trigger is:

```
profiles_tenant_has_org_trg
  CREATE CONSTRAINT TRIGGER profiles_tenant_has_org_trg
    AFTER INSERT OR UPDATE OF home_organization_id, is_admin
    ON public.profiles
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION assert_profile_tenant_has_org()
  -- tgenabled = 'O' (enabled, origin)
```

body (`public.assert_profile_tenant_has_org`, `prosecdef = f`):

```sql
if new.home_organization_id is null and not new.is_admin then
  raise exception 'a non-admin profile must have home_organization_id (tenant anchor)' …
```

So the enforced rule is **conditional NOT NULL**, not NOT NULL:
> *non-admin* profiles must have a home org; **`is_admin` profiles may have NULL.**

Three properties of this enforcement that a plain `NOT NULL` would not have, and that
any re-predication must preserve or consciously drop:

1. **It is a CONSTRAINT TRIGGER, `DEFERRABLE INITIALLY DEFERRED`** — it fires at
   COMMIT, not at statement time. A transaction may transiently leave a non-admin
   profile org-less and still succeed, provided it repairs the row before commit.
2. **It is `UPDATE OF home_organization_id, is_admin`** — scoped to those two columns,
   so unrelated profile updates never pay for it.
3. **It is `prosecdef = f`** — it is not a gate and replaces no RLS; it is a data
   integrity assertion only.

**Live data corroborates the exemption** (`select count(*) …` on `public.profiles`):

| total profiles | `home_organization_id IS NULL` | …and `is_admin` | …and NOT `is_admin` |
|---|---|---|---|
| 36 | 1 | **1** | **0** |

The single NULL is the platform admin. `180_user_registration.sql:88` pins the
`not is_admin` figure at **0** and `:93` pins the admin figure — so the invariant has a
keystone already.

There is also a **second, independent write-side guard**:
`guard_profile_privileged_columns_trg` (`BEFORE UPDATE`, body `prosecdef = t`) lists
`new.home_organization_id is distinct from old.home_organization_id` among the
privileged-column changes it intercepts. Combined with the absence of any direct write
in `src/` (Class 3a), the column is effectively **write-once at signup**.

---

## Summary of counts

| class | predicate | count |
|---|---|---|
| Column definitions | `information_schema.columns.column_name = 'home_organization_id'` | 1 |
| RLS policies | `pg_policies` `qual` OR `with_check` `~ 'home_organization_id'`, unanchored | **3** (all SELECT; 0 in `with_check`) |
| Functions ⚠ **schema-bounded** | `pg_proc.prosrc` **in `public`+`app`** (see the note below), `--`-stripped, `~ 'home_organization_id'` | **13** (14 raw − 1 comment-only) |
| — of which `prosecdef = t` | same, `and p.prosecdef` | 12 |
| — of which `prosecdef = f` | same, `and not p.prosecdef` | 1 (`assert_profile_tenant_has_org`) |
| Views | `pg_views.definition ~ …` | **0** |
| Matviews | `pg_matviews.definition ~ …` | **0** |
| Triggers referencing it in their definition | `pg_get_triggerdef ~ …`, `not tgisinternal` | 1 (`profiles_tenant_has_org_trg`) |
| Foreign keys | `pg_constraint`, `contype='f'` | 1 |
| CHECK constraints | `pg_constraint`, `contype='c'` | **0** |
| Indexes | `pg_indexes.indexdef ~ …` | **0** |
| `src/` lines | `rg -n 'home_organization_id' src/` | **50** in 14 files (28 prod / 22 test) |
| — prod read / write / type-only / comment | manual classification of the 28, shown above | 13 / 2 / 6 / 7 |
| `supabase/seed.sql` | `grep -n` | 6 |
| `supabase/tests/**` | `grep -rn` | **67** in 37 files |
| `supabase/demo/**` | `grep -rn` | 2 |
| `supabase/snippets/**`, `supabase/templates/**` | `grep -rn` | **0** |

⚠ The AFF4-era framing *"the RLS legs and the tenant trigger stay"* names **classes**.
This census is the **count**: 3 policy legs, 13 function bodies (**in `public`+`app`** — see
the bound below), 1 trigger, 1 FK, 28 production TS lines, 73 fixture lines. That framing is
not inherited here.

### ⛔ THE FUNCTION CLASS IS SCHEMA-BOUNDED WHILE EVERY OTHER CLASS IS DATABASE-WIDE

QA finding M13. Class 0, Class 1 (`pg_policies`), views, matviews, constraints and indexes
are all derived database-wide; Class 2 alone carries `where n.nspname in ('public','app')`.
The query was always shown, so the bound was visible — but the **summary row and the closing
tally** were quoted downstream as "the consumer count", and a namespace list is a **syntax
boundary, not a property**. The bound now travels with the number, in both places.

**Re-derived without the schema filter, 2026-08-28, at head `20261003005800`** (measured, not
argued):

- database-wide, `--`-stripped: **3** — `public.guard_profile_privileged_columns`,
  `public.handle_new_user`, `test_helpers.bootstrap`
- `public`+`app` only: **2** — the same two `public` ones

**The delta is exactly one, and it is `test_helpers.bootstrap`** — a pgTAP fixture created by
`supabase/tests/00_setup.sql`, which is **not in the migration chain and does not exist on a
fresh `supabase db reset`**. So the filter has never hidden a production consumer.
⚠ Recorded as a MEASUREMENT, not as an all-clear: the reason it hid nothing is that no
extension, no `storage`/`auth` function and no view outside `public`/`app` happens to name the
column *today*. That is a fact about the current database, not a property of the predicate, and
it is the difference between "the bound is safe" and "the bound was checked". **CNV-3 (re-derive
at the drop) stands, and this is its first data point rather than its answer.**
