-- =====================================================================================
-- authz-census-ae0.sql -- the deriving instrument for AE0.1 (ADR 0155, plan docs/plans/authz-evolution.md)
--
-- PURPOSE
--   Re-derive every "Measured figure" the authorization-evolution program depends on,
--   from the LIVE CATALOG, with the predicate visible beside each number.
--   Recorded output: docs/design/authz-evolution-census-ae0.md
--
-- CONTRACT
--   * READ-ONLY. SELECT only. No DDL, no DML, no SET/set role, no temp objects.
--     Safe to run against the linked production project.
--   * Every result set is self-labelling: (figure, value) or a named detail table.
--   * Run it whole, or copy one numbered block. Block order is stable; cite blocks by number.
--
-- HOW TO RUN
--   local :  docker exec -i supabase_db_<ref> psql -U postgres -d postgres -f - < scripts/authz-census-ae0.sql
--            (or paste a single block into psql -c)
--   remote:  paste a block into the Supabase MCP execute_sql tool (read-only), one block at a time.
--            psql meta-commands are deliberately NOT used so every block runs in both places.
--
-- BINDING METHOD RULES ENCODED HERE (each is scar tissue -- do not "simplify" them away)
--   1. prosrc is ALWAYS comment-stripped: regexp_replace(prosrc, '--[^\n]*', '', 'g').
--      An uncommented census counts `--` comments as live code (ADR 0078, three strikes).
--   2. Helper names are probed UNANCHORED. \y cannot match the `_for` variant
--      (`\yis_staff_admin_of\y` misses `is_staff_admin_of_for`): policies call the bare form,
--      functions call the `_for` form. No single anchored regex finds both.
--   3. EXECUTE / grant figures are asserted POSITIVELY via has_function_privilege /
--      has_column_privilege / has_schema_privilege. A NULL proacl includes PUBLIC, so
--      "the ACL column looks empty" is not evidence of absence (this mistake has fired 4x).
--   4. prosecdef is reported beside pg_policies everywhere: a DEFINER function's own gate
--      REPLACES RLS, so a policy-only census is structurally blind.
--   5. Every zero-valued figure ships with a positive control in the same block -- the same
--      predicate shown returning non-zero on a case known to exist.
--   6. Decomposed figures are PARTITIONS whose parts sum to the total; the arithmetic is
--      printed, not asserted in prose.
-- =====================================================================================


-- -------------------------------------------------------------------------------------
-- BLOCK 0 -- Stack identity. Run FIRST. Every figure below is only meaningful at this head.
-- -------------------------------------------------------------------------------------
select 'migration_head'          as figure, (select max(version) from supabase_migrations.schema_migrations) as value
union all
select 'migrations_registered',        (select count(*)::text from supabase_migrations.schema_migrations)
union all
select 'server_version',               (select current_setting('server_version'))
union all
select 'measured_at_utc',              (select to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'));


-- -------------------------------------------------------------------------------------
-- BLOCK 1 -- RLS baseline and the policy population.
--   Partitions printed: zero-policy vs policied tables; permissive vs restrictive.
--   Zero positive-controlled: restrictive_policies = 0 is shown against permissive = 278.
-- -------------------------------------------------------------------------------------
with t as (
  select c.oid, c.relname, c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
p as (
  select pol.polrelid, pol.polpermissive, pol.polcmd
  from pg_policy pol join t on t.oid = pol.polrelid
)
select 'public_tables'                                as figure, count(*)::text as value from t
union all select 'public_tables_with_rls',                  count(*) filter (where relrowsecurity)::text from t
union all select 'rls_tables_with_at_least_one_policy',     (select count(*)::text from t where relrowsecurity and exists (select 1 from p where p.polrelid = t.oid))
union all select 'rls_tables_with_zero_policies',           (select count(*)::text from t where relrowsecurity and not exists (select 1 from p where p.polrelid = t.oid))
union all select 'public_policies',                         (select count(*)::text from p)
union all select 'policies_permissive',                     (select count(*) filter (where polpermissive)::text from p)
union all select 'policies_restrictive_POSITIVE_CONTROLLED_ZERO', (select count(*) filter (where not polpermissive)::text from p)
union all select 'policies_for_all_permissive',             (select count(*) filter (where polpermissive and polcmd = '*')::text from p);


-- -------------------------------------------------------------------------------------
-- BLOCK 2 -- Role-helper-calling policies, BOTH published predicates, side by side.
--
--   ADR 0155 published 131; the audit published 117. Neither is wrong: the PREDICATE differs.
--   The ADR's term list is quoted verbatim below. Removing exactly one term -- `is_admin`,
--   the platform-admin helper app.is_admin() -- reproduces the audit's 117 on both stacks.
--   Publish BOTH numbers WITH their predicates or publish neither.
-- -------------------------------------------------------------------------------------
with pol as (
  select tablename, policyname,
         coalesce(qual, '') || ' ' || coalesce(with_check, '') as expr
  from pg_policies where schemaname = 'public'
)
select 'policies_total' as figure, count(*)::text as value, '(none)' as predicate from pol
union all
select 'role_helper_ADR0155_wide', count(*) filter (where expr ~ 'has_role|is_admin|is_org_admin|is_hospital_admin|is_staff_admin|is_member_of|is_nsp_|is_commission_admin')::text,
       'qual||with_check ~ ''has_role|is_admin|is_org_admin|is_hospital_admin|is_staff_admin|is_member_of|is_nsp_|is_commission_admin'''
from pol
union all
select 'role_helper_AUDIT_narrow', count(*) filter (where expr ~ 'has_role|is_org_admin|is_hospital_admin|is_staff_admin|is_member_of|is_nsp_|is_commission_admin')::text,
       'same list MINUS the bare ''is_admin'' term (reconstructed -- the audit did not publish its regex)'
from pol
union all
select 'delta_is_admin_only', count(*) filter (where expr ~ 'is_admin' and expr !~ 'has_role|is_org_admin|is_hospital_admin|is_staff_admin|is_member_of|is_nsp_|is_commission_admin')::text,
       'policies whose ONLY role-helper term is ''is_admin'' -- exactly the wide-minus-narrow difference'
from pol;


-- -------------------------------------------------------------------------------------
-- BLOCK 2a -- The partition behind BLOCK 2. Parts MUST sum to the policy total.
--   n_terms = how many of the ADR's 8 terms a policy matches. n_terms >= 1 is the wide set.
-- -------------------------------------------------------------------------------------
with pol as (
  select tablename, policyname, coalesce(qual, '') || ' ' || coalesce(with_check, '') as expr
  from pg_policies where schemaname = 'public'
),
terms as (
  select unnest(array['has_role','is_admin','is_org_admin','is_hospital_admin',
                      'is_staff_admin','is_member_of','is_nsp_','is_commission_admin']) as t
),
hits as (
  select p.tablename, p.policyname,
         (select count(*) from terms where p.expr ~ terms.t) as n_terms
  from pol p
)
select n_terms, count(*) as policies from hits group by n_terms order by n_terms;


-- -------------------------------------------------------------------------------------
-- BLOCK 2b -- Per-term match count and EXCLUSIVE contribution.
--   exclusive_contribution = policies the wide set would LOSE if that one term were dropped.
--   A term with 0 matches is a term that names a helper the catalog does not have;
--   BLOCK 2c positive-controls those zeros.
-- -------------------------------------------------------------------------------------
with pol as (
  select tablename, policyname, coalesce(qual, '') || ' ' || coalesce(with_check, '') as expr
  from pg_policies where schemaname = 'public'
),
terms as (
  select unnest(array['has_role','is_admin','is_org_admin','is_hospital_admin',
                      'is_staff_admin','is_member_of','is_nsp_','is_commission_admin']) as t
)
select t.t as term,
       (select count(*) from pol where pol.expr ~ t.t) as matches_term,
       (select count(*) from pol
         where pol.expr ~ 'has_role|is_admin|is_org_admin|is_hospital_admin|is_staff_admin|is_member_of|is_nsp_|is_commission_admin'
           and pol.expr !~ (select string_agg(t2.t, '|') from terms t2 where t2.t <> t.t)
       ) as exclusive_contribution
from terms t
order by 3 desc, 1;


-- -------------------------------------------------------------------------------------
-- BLOCK 2c -- POSITIVE CONTROLS for BLOCK 2b's zeros.
--   `has_role` matches 0 POLICIES -- correct and structural: policies call the is_*_of layer,
--   which calls has_role, which reads memberships. The same probe against pg_proc is non-zero,
--   which is what makes the policy zero believable rather than an instrument failure.
--   `is_commission_admin` matches 0 policies AND 0 function names AND 0 function bodies:
--   the helper does not exist under that name (it is app.is_tenancy_admin_of now).
--   A term naming a non-existent helper is a finding about the PREDICATE, not about the surface.
-- -------------------------------------------------------------------------------------
with f as (
  select n.nspname as sch, p.proname as nm,
         regexp_replace(p.prosrc, '--[^\n]*', '', 'g') as src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('app', 'public')
)
select 'proc_named_has_role_prefix'                 as control, count(*)::text as value from f where nm ~ '^has_role'
union all select 'proc_bodies_calling_has_role',           count(*)::text from f where src ~ 'has_role'
union all select 'proc_named_is_commission_admin',         count(*)::text from f where nm ~ 'is_commission_admin'
union all select 'proc_bodies_mentioning_is_commission_admin', count(*)::text from f where src ~ 'is_commission_admin'
union all select 'proc_named_is_nsp_prefix',               count(*)::text from f where nm ~ '^is_nsp_'
union all select 'proc_bodies_calling_is_tenancy_admin_of', count(*)::text from f where src ~ 'is_tenancy_admin_of';


-- -------------------------------------------------------------------------------------
-- BLOCK 3 -- The role-helper VOCABULARY, derived from the catalog instead of hand-listed.
--   Every app./public. function actually referenced by a public policy whose name carries a
--   role-ish token. This table -- not any regex -- is the real population; the BLOCK 2
--   predicates are then auditable against it.
--   Note app.is_tenancy_admin_of: 53 policies, named by NEITHER published predicate.
-- -------------------------------------------------------------------------------------
with pol as (
  select tablename, policyname, coalesce(qual, '') || ' ' || coalesce(with_check, '') as expr
  from pg_policies where schemaname = 'public'
),
calls as (
  select distinct pol.tablename, pol.policyname, m[1] as fn
  from pol, regexp_matches(pol.expr, '((?:app|public)\.[a-z0-9_]+)\s*\(', 'g') as m
)
select fn, count(distinct tablename || '.' || policyname) as policies
from calls
where fn ~ 'admin|role|member|nsp|staff'
group by fn
order by 2 desc, 1;


-- -------------------------------------------------------------------------------------
-- BLOCK 4 -- Policies reading `memberships` DIRECTLY (ADR 0155's load-bearing assumption).
--   Case-insensitive on purpose; the detail rows are printed because "4" without names is
--   not re-verifiable.
-- -------------------------------------------------------------------------------------
select tablename, policyname, cmd, permissive
from pg_policies
where schemaname = 'public'
  and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~* 'memberships'
order by tablename, policyname;


-- -------------------------------------------------------------------------------------
-- BLOCK 5 -- Functions reading `memberships`, comment-stripped, public + app.
-- -------------------------------------------------------------------------------------
with f as (
  select n.nspname as sch, p.proname as nm, p.prosecdef, p.prokind,
         regexp_replace(p.prosrc, '--[^\n]*', '', 'g') as src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('app', 'public')
)
select 'functions_reading_memberships'            as figure, count(*)::text as value from f where src ~ '\mmemberships\M'
union all select 'of_which_security_definer',           count(*) filter (where prosecdef)::text from f where src ~ '\mmemberships\M'
union all select 'of_which_security_invoker',           count(*) filter (where not prosecdef)::text from f where src ~ '\mmemberships\M'
union all select 'CONTROL_uncommented_would_report',   (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                                          where n.nspname in ('app','public') and p.prosrc ~ '\mmemberships\M');


-- -------------------------------------------------------------------------------------
-- BLOCK 5a -- TRANSITIVE memberships dependency (the figure the flat counts do not give).
--   A policy calls app.is_staff_admin_of -> which calls app.has_role -> which reads memberships.
--   A flat "policies mentioning memberships" reads 4; a flat role-helper regex reads 131.
--   The closure answers the question D6 actually asks: how much of the enforcement surface
--   would a memberships change move?
--   LIMITS, stated: the call graph is built by matching a captured callee NAME against
--   app/public pronames, so it ignores overloads and cannot distinguish a same-named function
--   in another schema. It over-includes rather than under-includes; treat it as an upper bound.
-- -------------------------------------------------------------------------------------
with recursive fns as (
  select n.nspname || '.' || p.proname as fq, p.proname as nm,
         regexp_replace(p.prosrc, '--[^\n]*', '', 'g') as src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('app', 'public') and p.prokind = 'f'
),
edges as (
  select distinct f.fq as caller, m[1] as callee_nm
  from fns f, regexp_matches(f.src, '(?:app\.|public\.)?([a-z0-9_]+)\s*\(', 'g') as m
),
closure as (
  select fq, nm from fns where src ~ '\mmemberships\M'
  union
  select f.fq, f.nm
  from closure c
  join edges e on e.callee_nm = c.nm
  join fns f on f.fq = e.caller
),
pol as (
  select tablename, policyname, coalesce(qual, '') || ' ' || coalesce(with_check, '') as expr
  from pg_policies where schemaname = 'public'
),
pcalls as (
  select distinct pol.tablename, pol.policyname, m[1] as fq
  from pol, regexp_matches(pol.expr, '((?:app|public)\.[a-z0-9_]+)\s*\(', 'g') as m
)
select 'functions_transitively_reaching_memberships' as figure, count(distinct fq)::text as value from closure
union all
select 'policies_transitively_depending_on_memberships',
       (select count(distinct p.tablename || '.' || p.policyname)::text
        from pcalls p where p.fq in (select fq from closure));


-- -------------------------------------------------------------------------------------
-- BLOCK 6 -- SECURITY DEFINER census and EFFECTIVE EXECUTE.
--   Every privilege figure uses has_function_privilege / has_schema_privilege, never proacl
--   inspection: a NULL proacl includes PUBLIC and reads as "nobody has it".
--   Note the two `anon` rows: 167 is the DEFINER-scoped count, 237 is the all-functions count.
--   They are the SAME instant on the SAME head -- a predicate difference, not growth.
--   Zero positive-controlled: public_anon_executable = 0 against app_anon_executable = 237.
-- -------------------------------------------------------------------------------------
with f as (
  select p.oid, n.nspname as sch, p.prosecdef, p.proconfig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('app', 'public')
)
select 'definer_public'                  as figure, count(*) filter (where sch = 'public' and prosecdef)::text as value from f
union all select 'definer_app',                count(*) filter (where sch = 'app'    and prosecdef)::text from f
union all select 'definer_total_SUM_CHECK',    count(*) filter (where prosecdef)::text from f
union all select 'definer_public_authenticated_EXECUTE', count(*) filter (where sch = 'public' and prosecdef and has_function_privilege('authenticated', oid, 'EXECUTE'))::text from f
union all select 'definer_app_authenticated_EXECUTE',    count(*) filter (where sch = 'app'    and prosecdef and has_function_privilege('authenticated', oid, 'EXECUTE'))::text from f
union all select 'definer_app_anon_EXECUTE',             count(*) filter (where sch = 'app'    and prosecdef and has_function_privilege('anon', oid, 'EXECUTE'))::text from f
union all select 'app_anon_EXECUTE_all_functions',       count(*) filter (where sch = 'app'    and has_function_privilege('anon', oid, 'EXECUTE'))::text from f
union all select 'public_anon_EXECUTE_all_functions_POSITIVE_CONTROLLED_ZERO', count(*) filter (where sch = 'public' and has_function_privilege('anon', oid, 'EXECUTE'))::text from f
union all select 'anon_USAGE_on_schema_app',        has_schema_privilege('anon', 'app', 'USAGE')::text
union all select 'anon_USAGE_on_schema_public',     has_schema_privilege('anon', 'public', 'USAGE')::text
union all select 'authenticated_USAGE_on_schema_app', has_schema_privilege('authenticated', 'app', 'USAGE')::text
union all select 'definer_WITHOUT_pinned_search_path_POSITIVE_CONTROLLED_ZERO',
       count(*) filter (where prosecdef and not exists (select 1 from unnest(coalesce(proconfig, '{}'::text[])) cfg where cfg like 'search\_path=%'))::text from f
union all select 'CONTROL_definer_WITH_pinned_search_path',
       count(*) filter (where prosecdef and exists (select 1 from unnest(coalesce(proconfig, '{}'::text[])) cfg where cfg like 'search\_path=%'))::text from f
union all select 'CONTROL_invoker_WITHOUT_pinned_search_path',
       count(*) filter (where not prosecdef and not exists (select 1 from unnest(coalesce(proconfig, '{}'::text[])) cfg where cfg like 'search\_path=%'))::text from f
union all select 'app_can_star_functions', (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname like 'can\_%');


-- -------------------------------------------------------------------------------------
-- BLOCK 7 -- FK census: profiles, and commission_administrativos (F7).
--   `93 FKs` must be stated as 93 TABLES; there are 145 constraints. Both are printed.
-- -------------------------------------------------------------------------------------
select 'tables_with_fk_to_profiles' as figure,
       (select count(distinct c.conrelid)::text
        from pg_constraint c
        join pg_class rt on rt.oid = c.confrelid
        join pg_namespace rn on rn.oid = rt.relnamespace
        where c.contype = 'f' and rn.nspname = 'public' and rt.relname = 'profiles') as value
union all
select 'fk_constraints_to_profiles',
       (select count(*)::text
        from pg_constraint c
        join pg_class rt on rt.oid = c.confrelid
        join pg_namespace rn on rn.oid = rt.relnamespace
        where c.contype = 'f' and rn.nspname = 'public' and rt.relname = 'profiles')
union all
select 'commission_administrativos_fk_constraints',
       (select count(*)::text
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where c.contype = 'f' and n.nspname = 'public' and t.relname = 'commission_administrativos');

-- BLOCK 7a -- every constraint on commission_administrativos, with its definition.
select c.conname, c.contype, pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public' and t.relname = 'commission_administrativos'
order by c.contype, c.conname;

-- BLOCK 7b -- AE1.1 orphan preflight, with the zero's positive control in the same result set.
--   The control row proves the NOT EXISTS shape returns 1 for an id that is genuinely absent.
select 'commission_administrativos_rows' as figure, (select count(*)::text from public.commission_administrativos) as value
union all
select 'orphan_commission_id',
       (select count(*)::text from public.commission_administrativos a
        where not exists (select 1 from public.commissions c where c.id = a.commission_id))
union all
select 'orphan_user_id',
       (select count(*)::text from public.commission_administrativos a
        where not exists (select 1 from public.profiles p where p.id = a.user_id))
union all
select 'CONTROL_orphan_shape_on_a_known_absent_id',
       (select count(*)::text
        from (select '00000000-0000-0000-0000-000000000000'::uuid as cid) x
        where not exists (select 1 from public.commissions c where c.id = x.cid));


-- -------------------------------------------------------------------------------------
-- BLOCK 8 -- The withheld-column grants on public.profiles (D4 / AE3 input).
--   Asserted positively per column via has_column_privilege. The 11 non-withheld columns
--   ARE the positive control: the same call returns true for them and false for the three.
--   REFERENCES stays granted on the withheld columns -- that is what keeps the 145 FK
--   constraints valid; a census that only asked about SELECT would miss it.
-- -------------------------------------------------------------------------------------
select a.attname as column_name,
       has_column_privilege('authenticated', 'public.profiles', a.attname, 'SELECT')     as authenticated_select,
       has_column_privilege('authenticated', 'public.profiles', a.attname, 'UPDATE')     as authenticated_update,
       has_column_privilege('authenticated', 'public.profiles', a.attname, 'REFERENCES') as authenticated_references,
       has_column_privilege('anon',          'public.profiles', a.attname, 'SELECT')     as anon_select
from pg_attribute a
where a.attrelid = 'public.profiles'::regclass and a.attnum > 0 and not a.attisdropped
order by a.attnum;


-- -------------------------------------------------------------------------------------
-- BLOCK 9 -- Data-state census. NOT a catalog figure -- kept separate on purpose.
--   Present because AE3's G2 premise ("the pilot has not loaded data") is a DATA question,
--   and because docs/backend-state.md's REMOTE CENSUS 2026-08-18 recorded the remote as EMPTY.
--   `@test.local` is the discriminator between the E2E seed fixture and real persons.
-- -------------------------------------------------------------------------------------
select 'auth_users'                as figure, (select count(*)::text from auth.users) as value
union all select 'auth_users_test_local', (select count(*) filter (where email like '%@test.local')::text from auth.users)
union all select 'profiles',              (select count(*)::text from public.profiles)
union all select 'organizations',         (select count(*)::text from public.organizations)
union all select 'hospitals',             (select count(*)::text from public.hospitals)
union all select 'commissions',           (select count(*)::text from public.commissions)
union all select 'organization_affiliations', (select count(*)::text from public.organization_affiliations)
union all select 'cases',                 (select count(*)::text from public.cases)
union all select 'audit_log',             (select count(*)::text from public.audit_log);
