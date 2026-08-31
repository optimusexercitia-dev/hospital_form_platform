-- =====================================================================================
-- authz-census-ae3.sql -- the deriving instrument for AE3.1 (ADR 0155 D4,
--                          plan docs/plans/authz-evolution.md "Phase AE3")
--
-- PURPOSE
--   Close the set of everything that touches profiles.cpf / .date_of_birth / .phone,
--   from the LIVE CATALOG, before any DDL is written. AE3 moves those three columns to
--   public.profile_private_details and retires column-level grants as a mechanism; a
--   consumer missed here becomes a runtime break at the column DROP, not a test failure.
--   Recorded output: docs/design/authz-evolution-census-ae3.md
--
-- CONTRACT
--   * READ-ONLY. SELECT only. No DDL, no DML, no SET/set role, no temp objects.
--     Safe to run against the linked production project.
--   * Every result set is self-labelling and carries the matched token, so a
--     false positive (telephone, cpf_lookup, ...) is CLASSIFIED, never silently filtered.
--     Bounding the sweep by a syntax rather than by the property is how a census
--     under-reports.
--   * Run it whole, or copy one numbered block. Block order is stable; cite blocks by number.
--
-- HOW TO RUN
--   local :  docker exec -i supabase_db_<ref> psql -U postgres -d postgres -f - < scripts/authz-census-ae3.sql
--   remote:  paste a block into the Supabase MCP execute_sql tool (read-only), one block at a time.
--            psql meta-commands are deliberately NOT used so every block runs in both places.
--
-- BINDING METHOD RULES ENCODED HERE (inherited from authz-census-ae0.sql -- do not simplify away)
--   1. prosrc is ALWAYS comment-stripped: regexp_replace(prosrc, '--[^\n]*', '', 'g').
--      An uncommented census counts `--` comments as live code (ADR 0078, three strikes).
--   2. Tokens are probed UNANCHORED first (block 3a) and word-bounded second (block 3b).
--      The DIFFERENCE between the two is itself reported (block 3c): it is the set where a
--      human must rule, and collapsing it to either bound alone is the under-report.
--   3. Grants are asserted POSITIVELY via has_column_privilege over every grantee role.
--      A NULL/absent ACL entry includes inherited privilege, so "the ACL looks empty" is
--      not evidence of absence (this mistake has fired 4x in this repo).
--   4. prosecdef is reported beside pg_policies everywhere: a DEFINER function's own gate
--      REPLACES RLS, so a policy census alone cannot see the door.
-- =====================================================================================


-- =====================================================================================
-- BLOCK 1 -- the three columns as they exist today (the thing being moved)
-- =====================================================================================
select
  '1. column definition' as block,
  a.attname                                as column_name,
  format_type(a.atttypid, a.atttypmod)     as data_type,
  a.attnotnull                             as not_null,
  pg_get_expr(d.adbin, d.adrelid)          as default_expr,
  a.attidentity                            as identity,
  a.attgenerated                           as generated
from pg_attribute a
join pg_class c      on c.oid = a.attrelid
join pg_namespace n  on n.oid = c.relnamespace
left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
where n.nspname = 'public'
  and c.relname = 'profiles'
  and a.attname in ('cpf', 'date_of_birth', 'phone')
  and a.attnum > 0 and not a.attisdropped
order by a.attname;


-- =====================================================================================
-- BLOCK 2 -- constraints and indexes that must MOVE, not be re-invented
--   The CPF CHECK expression and the unique index (with its collation / normalization)
--   travel to profile_private_details verbatim. Re-typing them is how semantics drift.
-- =====================================================================================
select
  '2a. constraint' as block,
  con.conname                          as constraint_name,
  con.contype                          as contype,
  pg_get_constraintdef(con.oid)        as definition
from pg_constraint con
join pg_class c     on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'profiles'
  and pg_get_constraintdef(con.oid) ~* '(cpf|date_of_birth|phone)'
order by con.conname;

select
  '2b. index' as block,
  i.relname                            as index_name,
  idx.indisunique                      as is_unique,
  idx.indpred is not null              as is_partial,
  pg_get_indexdef(idx.indexrelid)      as definition
from pg_index idx
join pg_class c     on c.oid = idx.indrelid
join pg_class i     on i.oid = idx.indexrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'profiles'
  and pg_get_indexdef(idx.indexrelid) ~* '(cpf|date_of_birth|phone)'
order by i.relname;


-- =====================================================================================
-- BLOCK 3 -- SQL readers/writers: functions whose COMMENT-STRIPPED body names a token
--   3a unanchored (the wide bound), 3b word-bounded (the narrow bound), 3c the DIFFERENCE.
--   Rule 2: the difference is the ruling set, not noise to drop.
-- =====================================================================================
with fn as (
  select
    n.nspname                                        as schema,
    p.proname                                        as function_name,
    pg_get_function_identity_arguments(p.oid)        as args,
    pg_get_function_result(p.oid)                    as returns,
    p.prosecdef                                      as is_definer,
    regexp_replace(p.prosrc, '--[^\n]*', '', 'g')    as body
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'app', 'authz')
)
select
  '3a. function (unanchored)' as block,
  schema, function_name, args, returns, is_definer,
  concat_ws(',',
    case when body ~* 'cpf'           then 'cpf'           end,
    case when body ~* 'date_of_birth' then 'date_of_birth' end,
    case when body ~* 'phone'         then 'phone'         end
  ) as matched_tokens
from fn
where body ~* '(cpf|date_of_birth|phone)'
order by schema, function_name, args;

with fn as (
  select
    n.nspname                                        as schema,
    p.proname                                        as function_name,
    pg_get_function_identity_arguments(p.oid)        as args,
    p.prosecdef                                      as is_definer,
    regexp_replace(p.prosrc, '--[^\n]*', '', 'g')    as body
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'app', 'authz')
)
select
  '3b. function (word-bounded)' as block,
  schema, function_name, args, is_definer,
  concat_ws(',',
    case when body ~* '\ycpf\y'           then 'cpf'           end,
    case when body ~* '\ydate_of_birth\y' then 'date_of_birth' end,
    case when body ~* '\yphone\y'         then 'phone'         end
  ) as matched_tokens
from fn
where body ~* '\y(cpf|date_of_birth|phone)\y'
order by schema, function_name, args;

-- 3c. THE RULING SET: matched wide but not narrow. Each row needs a human verdict
--     (real consumer via a composed identifier, e.g. cpf_lookup / log_cpf_probe_for /
--     work_phone, vs. an unrelated substring). Never auto-dropped.
--     The identifiers are AGGREGATED: regexp_matches(..., 'g') is set-returning, so an
--     un-aggregated form emits one row per match and a 7-row function reads as 7 findings.
with fn as (
  select
    n.nspname                                        as schema,
    p.proname                                        as function_name,
    pg_get_function_identity_arguments(p.oid)        as args,
    p.prosecdef                                      as is_definer,
    regexp_replace(p.prosrc, '--[^\n]*', '', 'g')    as body
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'app', 'authz')
)
select
  '3c. RULING SET (wide-only)' as block,
  schema, function_name, args, is_definer,
  (
    select string_agg(distinct m[1], ', ' order by m[1])
    from regexp_matches(body, '[A-Za-z0-9_]*(?:cpf|date_of_birth|phone)[A-Za-z0-9_]*', 'gi') as m
  ) as composed_identifiers
from fn
where body ~* '(cpf|date_of_birth|phone)'
  and not (body ~* '\y(cpf|date_of_birth|phone)\y')
order by schema, function_name, args;

-- =====================================================================================
-- 3d. THE QUALIFYING PROPERTY -- token AND the body names `profiles`.
--   Blocks 3a/3b answer "names a token", which is NOT the question. `date_of_birth`
--   is also a column of event_patient / referral_patient / patient_identifiers, and
--   `phone` also appears as work_phone on hospital_affiliations; both are outside AE3's
--   scope entirely. AE3's question is "touches profiles.cpf/.date_of_birth/.phone".
--   plpgsql bodies record no column dependency in the catalog, so text is the only
--   available instrument -- but it can at least be asked at the right GRAIN.
--   ⛔ This narrows; it does not decide. Every row still gets a read-and-rule verdict,
--   and the 3b-minus-3d complement is asserted EMPTY-of-profiles-consumers by that
--   same reading, never by the query's silence.
-- =====================================================================================
with fn as (
  select
    n.nspname                                        as schema,
    p.proname                                        as function_name,
    pg_get_function_identity_arguments(p.oid)        as args,
    p.prosecdef                                      as is_definer,
    regexp_replace(p.prosrc, '--[^\n]*', '', 'g')    as body
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'app', 'authz')
)
select
  '3d. QUALIFYING (token AND names profiles)' as block,
  schema, function_name, args, is_definer,
  concat_ws(',',
    case when body ~* '\ycpf\y'           then 'cpf'           end,
    case when body ~* '\ydate_of_birth\y' then 'date_of_birth' end,
    case when body ~* '\yphone\y'         then 'phone'         end
  ) as matched_tokens
from fn
where body ~* '\y(cpf|date_of_birth|phone)\y'
  and body ~* '\yprofiles\y'
order by schema, function_name, args;

-- 3e. The complement of 3d inside 3b: names a token, does NOT name profiles.
--     Reported so the exclusion is VISIBLE and rulable, never silent.
with fn as (
  select
    n.nspname                                        as schema,
    p.proname                                        as function_name,
    pg_get_function_identity_arguments(p.oid)        as args,
    regexp_replace(p.prosrc, '--[^\n]*', '', 'g')    as body
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'app', 'authz')
)
select
  '3e. EXCLUDED (token, no profiles)' as block,
  schema, function_name, args,
  concat_ws(',',
    case when body ~* '\ycpf\y'           then 'cpf'           end,
    case when body ~* '\ydate_of_birth\y' then 'date_of_birth' end,
    case when body ~* '\yphone\y'         then 'phone'         end
  ) as matched_tokens
from fn
where body ~* '\y(cpf|date_of_birth|phone)\y'
  and not (body ~* '\yprofiles\y')
order by schema, function_name, args;


-- =====================================================================================
-- BLOCK 4 -- RLS policies naming a token (USING and WITH CHECK reported SEPARATELY:
--   they answer different questions -- WITH CHECK gates the NEW row, never WHICH rows
--   may be touched).
-- =====================================================================================
select
  '4. policy' as block,
  schemaname, tablename, policyname, cmd, roles,
  case when coalesce(qual, '')       ~* '(cpf|date_of_birth|phone)' then 'USING' end       as hit_using,
  case when coalesce(with_check, '') ~* '(cpf|date_of_birth|phone)' then 'WITH CHECK' end  as hit_with_check,
  qual, with_check
from pg_policies
where coalesce(qual, '') ~* '(cpf|date_of_birth|phone)'
   or coalesce(with_check, '') ~* '(cpf|date_of_birth|phone)'
order by schemaname, tablename, policyname;


-- =====================================================================================
-- BLOCK 5 -- views / materialized views whose definition selects a token
--   A view is a reader the app never names; it breaks at DROP COLUMN with a dependency
--   error, which is the LOUD failure. The quiet one is a view that reads it via SELECT *.
-- =====================================================================================
select
  '5a. view (by text)' as block,
  n.nspname as schema, c.relname as view_name, c.relkind,
  pg_get_viewdef(c.oid, true) as definition
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('v', 'm')
  and n.nspname not in ('pg_catalog', 'information_schema')
  and pg_get_viewdef(c.oid, true) ~* '(cpf|date_of_birth|phone)'
order by n.nspname, c.relname;

-- 5b. ANY view depending on the three columns, by CATALOG DEPENDENCY rather than by text.
--     Text misses `select *`; dependency does not. This is the authoritative half.
select distinct
  '5b. view dependency (authoritative)' as block,
  dn.nspname   as dependent_schema,
  dc.relname   as dependent_object,
  dc.relkind   as dependent_kind,
  a.attname    as depends_on_column
from pg_depend d
join pg_rewrite r    on r.oid = d.objid and d.classid = 'pg_rewrite'::regclass
join pg_class dc     on dc.oid = r.ev_class
join pg_namespace dn on dn.oid = dc.relnamespace
join pg_class rc     on rc.oid = d.refobjid
join pg_namespace rn on rn.oid = rc.relnamespace
join pg_attribute a  on a.attrelid = d.refobjid and a.attnum = d.refobjsubid
where rn.nspname = 'public'
  and rc.relname = 'profiles'
  and a.attname in ('cpf', 'date_of_birth', 'phone')
order by dependent_schema, dependent_object, depends_on_column;


-- =====================================================================================
-- BLOCK 6 -- triggers on profiles, with the matched half of their function bodies.
--   guard_profile_privileged_columns is a KNOWN member: its IDENTITY half retires with
--   the move, its LIFECYCLE half stays. The census must show both halves exist.
-- =====================================================================================
select
  '6. trigger on profiles' as block,
  t.tgname                                       as trigger_name,
  pn.nspname                                     as function_schema,
  p.proname                                      as function_name,
  p.prosecdef                                    as is_definer,
  pg_get_triggerdef(t.oid)                       as trigger_def,
  regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~* '(cpf|date_of_birth|phone)' as body_names_token
from pg_trigger t
join pg_class c      on c.oid = t.tgrelid
join pg_namespace n  on n.oid = c.relnamespace
join pg_proc p       on p.oid = t.tgfoid
join pg_namespace pn on pn.oid = p.pronamespace
where n.nspname = 'public'
  and c.relname = 'profiles'
  and not t.tgisinternal
order by t.tgname;


-- =====================================================================================
-- BLOCK 7 -- the column-level grants AE3 retires as a mechanism.
--   7a: the ACL as stored.  7b: the SAME question asked POSITIVELY per role (method rule 3)
--   -- an absent ACL entry is not absence of privilege.
-- =====================================================================================
select
  '7a. column ACL (as stored)' as block,
  a.attname as column_name,
  coalesce(a.attacl::text, '(no column ACL -- table-level applies)') as column_acl
from pg_attribute a
join pg_class c     on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'profiles'
  and a.attname in ('cpf', 'date_of_birth', 'phone')
order by a.attname;

select
  '7b. effective column privilege (positive assertion)' as block,
  col                                                     as column_name,
  grantee,
  has_column_privilege(grantee, 'public.profiles', col, 'SELECT') as can_select,
  has_column_privilege(grantee, 'public.profiles', col, 'UPDATE') as can_update,
  has_column_privilege(grantee, 'public.profiles', col, 'INSERT') as can_insert
from unnest(array['cpf', 'date_of_birth', 'phone']) as col
cross join unnest(array['anon', 'authenticated', 'service_role']) as grantee
order by col, grantee;

-- 7c. the same positive assertion for the TABLE, so 7b is readable as a delta.
select
  '7c. effective TABLE privilege' as block,
  grantee,
  has_table_privilege(grantee, 'public.profiles', 'SELECT') as can_select,
  has_table_privilege(grantee, 'public.profiles', 'UPDATE') as can_update,
  has_table_privilege(grantee, 'public.profiles', 'INSERT') as can_insert
from unnest(array['anon', 'authenticated', 'service_role']) as grantee
order by grantee;

-- =====================================================================================
-- 7d. THE MECHANISM ITSELF, over EVERY column -- the withheld set as a DELTA.
--   "Column-level grants retire as a mechanism" (AE3 purpose) is only legible next to
--   what is GRANTED. The pattern is: table-level SELECT/INSERT/UPDATE revoked from
--   authenticated, per-column arw granted to the ordinary columns, and the restricted
--   three withheld by having no column ACL entry at all.
--   ⛔ Read the WITHHELD set as the property (granted = false), never as "the ACL column
--   is empty" -- an empty ACL means "table-level applies", which for a role holding the
--   table grant would mean FULL access. Here it means none only because the table grant
--   was revoked; that is a conjunction, and asserting either half alone is the trap.
-- =====================================================================================
select
  '7d. per-column grant delta (authenticated)' as block,
  a.attname as column_name,
  has_column_privilege('authenticated', 'public.profiles', a.attname, 'SELECT') as can_select,
  has_column_privilege('authenticated', 'public.profiles', a.attname, 'UPDATE') as can_update,
  has_column_privilege('authenticated', 'public.profiles', a.attname, 'INSERT') as can_insert,
  case
    when has_column_privilege('authenticated', 'public.profiles', a.attname, 'SELECT')
      then 'granted'
    else 'WITHHELD'
  end as posture,
  coalesce(a.attacl::text, '(none)') as column_acl
from pg_attribute a
join pg_class c     on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'profiles'
  and a.attnum > 0 and not a.attisdropped
order by posture, a.attnum;


-- =====================================================================================
-- BLOCK 8 -- RLS posture of profiles, so the destination table inherits deliberately
--   rather than by accident.
-- =====================================================================================
select
  '8. profiles RLS posture' as block,
  c.relrowsecurity      as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  (select count(*) from pg_policies pp
    where pp.schemaname = 'public' and pp.tablename = 'profiles') as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'profiles';
