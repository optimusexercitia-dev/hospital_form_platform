-- ============================================================================
-- AE4 PERFORMANCE ACCEPTANCE — FIXTURE TEARDOWN
--
--   Pairs with:  scripts/authz-ae4-perf-fixture.sql
--   Acceptance:  docs/design/authz-ae4-performance-acceptance.md
--
-- RUN IT:
--   docker exec -i supabase_db_azkbbhskturikxpgmafq \
--     psql -U postgres -d postgres -X -f - \
--     < scripts/authz-ae4-perf-teardown.sql
--
-- ============================================================================
-- ⛔ DELETION IS BY IDENTITY, NEVER POSITIONAL.  Every DELETE below enumerates
--    the SAME deterministic ids the loader minted (ae4perf.pid(kind, n) over
--    the same ordinal ranges, read back from ae4perf.fixture_meta).  There is
--    no `order by created_at desc limit N`, no uuid range predicate and no
--    "delete the newest rows": a positional cleanup eats seed rows that ~900
--    E2E tests depend on.
--
-- ⛔ `supabase db reset --local` is the OTHER valid teardown, and it is the
--    STRONGER one — it also restores the never-ANALYZEd condition the AE0.2
--    baselines are defined on, which this file CANNOT restore (dropping rows
--    does not un-analyze a table; this file re-ANALYZEs instead, leaving the
--    database statistics-bearing).  Prefer a reset unless you need the seed
--    state preserved in place.
--
-- ⛔ Audit + profile-delete guards are disabled for the delete, inside the
--    transaction (ALTER TABLE is transactional — an abort rolls the disable
--    back).  `public.audit_log` must be BYTE-IDENTICAL in count before and
--    after; section 9 raises if it is not.  That is the whole reversibility
--    claim: the hash-chained audit trail never learns this fixture existed.
-- ============================================================================

\set ON_ERROR_STOP on
\timing on
\pset pager off

do $$
begin
  if to_regnamespace('ae4perf') is null then
    raise exception 'AE4 perf fixture is NOT loaded (schema ae4perf absent) — nothing to tear down.';
  end if;
end $$;

-- Pre-teardown audit census, kept outside the transaction so section 9 can
-- compare against it even if the transaction is retried.
drop table if exists pg_temp.ae4_teardown_before;
create temp table ae4_teardown_before as
select 'audit_log' as t, count(*)::bigint n from public.audit_log
union all select 'memberships',           count(*) from public.memberships
union all select 'profiles',              count(*) from public.profiles
union all select 'auth.users',            count(*) from auth.users
union all select 'commissions',           count(*) from public.commissions
union all select 'professional_profiles', count(*) from public.professional_profiles
union all select 'form_items',            count(*) from public.form_items;

select * from pg_temp.ae4_teardown_before order by t;


begin;

-- Read the scale back from the manifest, so the enumerations below cannot
-- drift from what was actually loaded.
create temp table ae4_scale on commit drop as
select (select v::int from ae4perf.fixture_meta where k = 'n_org')  as n_org,
       (select v::int from ae4perf.fixture_meta where k = 'n_hosp') as n_hosp,
       (select v::int from ae4perf.fixture_meta where k = 'n_comm') as n_comm,
       (select v::int from ae4perf.fixture_meta where k = 'n_user') as n_user,
       (select v::int from ae4perf.fixture_meta where k = 'n_prof') as n_prof,
       (select v::int from ae4perf.fixture_meta where k = 'n_form') as n_form;

-- --------------------------------------------------------------------------
-- 1. Triggers off (same set the loader disabled, plus the profile-delete
--    guard, which blocks profile deletion unconditionally by design).
-- --------------------------------------------------------------------------
alter table public.memberships   disable trigger trg_audit_memberships;
alter table public.commissions   disable trigger audit_commissions_trg;
alter table public.forms         disable trigger audit_forms_trg;
alter table public.form_versions disable trigger audit_form_versions_trg;
alter table public.form_sections disable trigger audit_form_sections_trg;
alter table public.form_items    disable trigger audit_form_items_trg;
alter table public.profiles      disable trigger guard_profile_no_delete_trg;

-- --------------------------------------------------------------------------
-- 2. The form tree.  Deleting `forms` cascades to versions -> sections ->
--    items.  The three structural guards (guard_published_version,
--    guard_published_structure, guard_default_section_delete) stay ENABLED:
--    each explicitly permits the cascade case (parent already gone) and
--    permits drafts, so leaving them on proves the fixture versions really
--    were drafts.  If one of them raises here, the fixture was malformed and
--    the abort is the correct outcome.
-- --------------------------------------------------------------------------
delete from public.forms
 where id in (select ae4perf.pid('form', g) from ae4_scale, generate_series(1, n_form) g);

-- --------------------------------------------------------------------------
-- 3. Professionals.
-- --------------------------------------------------------------------------
delete from public.professional_profiles
 where id in (select ae4perf.pid('prof', g) from ae4_scale, generate_series(1, n_prof) g);

-- --------------------------------------------------------------------------
-- 4. Memberships — every fixture membership has a fixture principal, so the
--    principal enumeration is exhaustive over them.
-- --------------------------------------------------------------------------
delete from public.memberships
 where principal_id in (select ae4perf.pid('user', g) from ae4_scale, generate_series(1, n_user) g);

-- --------------------------------------------------------------------------
-- 5. Tenancy, leaf-first (commissions_hospital_id_fkey is ON DELETE RESTRICT).
-- --------------------------------------------------------------------------
delete from public.commissions
 where id in (select ae4perf.pid('comm', g) from ae4_scale, generate_series(1, n_comm) g);

delete from public.hospitals
 where id in (select ae4perf.pid('hosp', g) from ae4_scale, generate_series(1, n_hosp) g);

delete from public.organizations
 where id in (select ae4perf.pid('org', g) from ae4_scale, generate_series(1, n_org) g);

-- --------------------------------------------------------------------------
-- 6. People — profiles before auth.users (profiles_id_fkey is ON DELETE
--    RESTRICT, so the reverse order fails).
-- --------------------------------------------------------------------------
delete from public.profiles
 where id in (select ae4perf.pid('user', g) from ae4_scale, generate_series(1, n_user) g);

delete from auth.users
 where id in (select ae4perf.pid('user', g) from ae4_scale, generate_series(1, n_user) g);

-- --------------------------------------------------------------------------
-- 7. Residue check BEFORE the manifest is dropped — if anything survived, the
--    enumeration was wrong and the abort keeps the fixture intact and
--    diagnosable rather than half-removed.
-- --------------------------------------------------------------------------
do $$
declare
  v_n_user int; v_n_comm int; v_n_prof int; v_n_form int; v_n_org int; v_n_hosp int;
  v_bad text := '';
  v_c bigint;
begin
  select v::int into v_n_user from ae4perf.fixture_meta where k = 'n_user';
  select v::int into v_n_comm from ae4perf.fixture_meta where k = 'n_comm';
  select v::int into v_n_prof from ae4perf.fixture_meta where k = 'n_prof';
  select v::int into v_n_form from ae4perf.fixture_meta where k = 'n_form';
  select v::int into v_n_org  from ae4perf.fixture_meta where k = 'n_org';
  select v::int into v_n_hosp from ae4perf.fixture_meta where k = 'n_hosp';

  select count(*) into v_c from auth.users
   where id in (select ae4perf.pid('user', g) from generate_series(1, v_n_user) g);
  if v_c > 0 then v_bad := v_bad || format('auth.users=%s ', v_c); end if;

  select count(*) into v_c from public.profiles
   where id in (select ae4perf.pid('user', g) from generate_series(1, v_n_user) g);
  if v_c > 0 then v_bad := v_bad || format('profiles=%s ', v_c); end if;

  select count(*) into v_c from public.memberships
   where principal_id in (select ae4perf.pid('user', g) from generate_series(1, v_n_user) g);
  if v_c > 0 then v_bad := v_bad || format('memberships=%s ', v_c); end if;

  select count(*) into v_c from public.commissions
   where id in (select ae4perf.pid('comm', g) from generate_series(1, v_n_comm) g);
  if v_c > 0 then v_bad := v_bad || format('commissions=%s ', v_c); end if;

  select count(*) into v_c from public.hospitals
   where id in (select ae4perf.pid('hosp', g) from generate_series(1, v_n_hosp) g);
  if v_c > 0 then v_bad := v_bad || format('hospitals=%s ', v_c); end if;

  select count(*) into v_c from public.organizations
   where id in (select ae4perf.pid('org', g) from generate_series(1, v_n_org) g);
  if v_c > 0 then v_bad := v_bad || format('organizations=%s ', v_c); end if;

  select count(*) into v_c from public.professional_profiles
   where id in (select ae4perf.pid('prof', g) from generate_series(1, v_n_prof) g);
  if v_c > 0 then v_bad := v_bad || format('professional_profiles=%s ', v_c); end if;

  select count(*) into v_c from public.forms
   where id in (select ae4perf.pid('form', g) from generate_series(1, v_n_form) g);
  if v_c > 0 then v_bad := v_bad || format('forms=%s ', v_c); end if;

  if v_bad <> '' then
    raise exception 'AE4 teardown INCOMPLETE — surviving fixture rows: %', v_bad;
  end if;
  raise notice 'AE4 teardown: zero fixture rows survive.';
end $$;

-- --------------------------------------------------------------------------
-- 8. Triggers back on, then the bookkeeping schema goes.
-- --------------------------------------------------------------------------
alter table public.memberships   enable trigger trg_audit_memberships;
alter table public.commissions   enable trigger audit_commissions_trg;
alter table public.forms         enable trigger audit_forms_trg;
alter table public.form_versions enable trigger audit_form_versions_trg;
alter table public.form_sections enable trigger audit_form_sections_trg;
alter table public.form_items    enable trigger audit_form_items_trg;
alter table public.profiles      enable trigger guard_profile_no_delete_trg;

do $$
declare v_off text;
begin
  select string_agg(c.relname || '.' || t.tgname, ', ')
    into v_off
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and not t.tgisinternal and t.tgenabled = 'D'
     and c.relname in ('memberships','commissions','forms','form_versions','form_sections','form_items','profiles');
  if v_off is not null then
    raise exception 'AE4 teardown would leave triggers DISABLED: %', v_off;
  end if;
end $$;

drop schema ae4perf cascade;

commit;


-- ============================================================================
-- 9. Statistics + the reversibility assertion.
-- ============================================================================
analyze public.memberships;
analyze public.profiles;
analyze public.commissions;
analyze public.hospitals;
analyze public.organizations;
analyze public.professional_profiles;
analyze public.forms;
analyze public.form_versions;
analyze public.form_sections;
analyze public.form_items;

do $$
declare v_before bigint; v_after bigint;
begin
  select n into v_before from pg_temp.ae4_teardown_before where t = 'audit_log';
  select count(*) into v_after from public.audit_log;
  if v_before <> v_after then
    raise exception
      'AE4 teardown MUTATED THE HASH-CHAINED AUDIT LOG: % -> % rows. The chain cannot be un-appended; a `supabase db reset --local` is now the only clean state.',
      v_before, v_after;
  end if;
  raise notice 'AE4 teardown: audit_log unchanged at % rows.', v_after;
end $$;

\echo ''
\echo '=== Post-teardown census (compare against the seed-only baseline) ==='
select 'memberships' as t, count(*) from public.memberships
union all select 'profiles',              count(*) from public.profiles
union all select 'auth.users',            count(*) from auth.users
union all select 'organizations',         count(*) from public.organizations
union all select 'hospitals',             count(*) from public.hospitals
union all select 'commissions',           count(*) from public.commissions
union all select 'professional_profiles', count(*) from public.professional_profiles
union all select 'forms',                 count(*) from public.forms
union all select 'form_versions',         count(*) from public.form_versions
union all select 'form_sections',         count(*) from public.form_sections
union all select 'form_items',            count(*) from public.form_items
union all select 'audit_log',             count(*) from public.audit_log
order by 1;

\echo ''
\echo '⚠ The database is now ANALYZEd. The AE0.2 baselines require a'
\echo '  never-ANALYZEd database — run `supabase db reset --local` before any'
\echo '  AE0 re-comparison.'
\echo '=== AE4 perf fixture removed ==='
