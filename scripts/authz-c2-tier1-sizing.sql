-- authz-c2-tier1-sizing.sql — Critical FUP C2, step one: DERIVE the Tier-1 predicate
-- and COUNT what it returns.  Read-only against the schema; creates and drops `c2` as scratch.
--
-- Run:  docker cp scripts/authz-c2-tier1-sizing.sql <db>:/tmp/c2s.sql
--       docker exec <db> psql -U postgres -d postgres -tA -P pager=off -f //tmp/c2s.sql
--       (<db> = supabase_db_azkbbhskturikxpgmafq; the //tmp double slash defeats MSYS path mangling)
--
-- BINDING METHOD RULES (PO ruling 2026-08-18, docs/progress/follow-ups.md:946-990)
--  1. Tier 1's population is DERIVED FROM THE CATALOG AS A PROPERTY, never hand-listed.
--     A hand-picked "PHI-looking" list reproduces the failure class the item was filed on.
--  2. The PARENT population (the "427") is re-derived here every run, never quoted. It must
--     agree with ARM=census's banner in p0-authz-invariant.sh:373 — the same five conjuncts.
--  3. Every candidate is scored against POSITIVE CONTROLS (section 6). A candidate that drops
--     a known PHI door is FALSIFIED, however much cheaper it is.
--  4. Variants B* / D* contain a HAND-LIST (four infra relations) and are SENSITIVITY PROBES
--     ONLY. They may not be adopted as the ruled predicate until the PO restates that
--     exclusion as a property. They are reported because they are the only variants under
--     which the PHI arm discriminates at all.

drop schema if exists c2 cascade;
create schema c2;

-- ---------------------------------------------------------------- 1. function bodies
-- `--` comments stripped first: a line-filtered prosrc under-reports multiline guards.
create table c2.fns as
select p.oid, n.nspname as sch, p.proname as nm,
       n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as label,
       regexp_replace(p.prosrc, '--[^\n]*', '', 'g') as body
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('app','public');
create index on c2.fns(oid);

-- --------------------------------------- 2. parent population (ARM=census's five conjuncts)
create table c2.roots as
select f.oid, f.label, f.sch
from c2.fns f join pg_proc p on p.oid = f.oid
where p.prosecdef
  and p.prorettype <> 'pg_catalog.trigger'::regtype
  and not p.proretset
  and p.prorettype <> 'pg_catalog.bool'::regtype
  and (has_function_privilege('authenticated', p.oid, 'EXECUTE')
    or has_function_privilege('anon', p.oid, 'EXECUTE'));

-- ---------------------------------------------------------------- 3. call graph + closure
create table c2.edges as
select distinct a.oid as caller, b.oid as callee
from c2.fns a join c2.fns b
  on a.oid <> b.oid and a.body ~ ('\m' || b.nm || '\M\s*\(');
create index on c2.edges(caller);

create table c2.rels as
select c.oid as reloid, n.nspname || '.' || c.relname as label, c.relname as nm
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public','app') and c.relkind in ('r','p','v','m');

create table c2.fn_rel as
select distinct f.oid as fnoid, r.reloid
from c2.fns f join c2.rels r on f.body ~ ('\m' || r.nm || '\M');
create index on c2.fn_rel(fnoid);

create table c2.closure as
with recursive w(root, fn, depth) as (
  select r.oid, r.oid, 0 from c2.roots r
  union
  select w.root, e.callee, w.depth + 1 from w join c2.edges e on e.caller = w.fn where w.depth < 8
) select distinct root, fn from w;

create table c2.root_rel as
select distinct cl.root, fr.reloid from c2.closure cl join c2.fn_rel fr on fr.fnoid = cl.fn;
create index on c2.root_rel(root);

-- depth-0 variant: the door's OWN body only, no call subtree
create table c2.root_rel0 as
select distinct fr.fnoid as root, fr.reloid from c2.fn_rel fr
where fr.fnoid in (select oid from c2.roots);

-- ---------------------------------------------------------------- 4. marker sets
-- (a) PHI by comment convention.  UNSOUND ALONE: the convention is prose, and prose polarity
--     is not machine-decidable — "is NOT a PHI store" and "ZERO PHI in columns" both match a
--     positive regex, and 50 base tables carry no comment at all.  Reported, never used alone.
create table c2.m_phicomment as
select distinct c.oid as reloid
from pg_class c join pg_namespace n on n.oid = c.relnamespace
join pg_description d on d.objoid = c.oid
where n.nspname in ('public','app') and c.relkind in ('r','p','v','m')
  and ( (d.objsubid > 0 and d.description ~* 'phi[- ]bearing|isolated phi')
     or (d.objsubid = 0 and d.description ~* 'isolated phi|phi[- ]bearing|class[- ]1 phi') );

-- (b) door-only relations: a HARD catalog fact (no table-level SELECT for `authenticated`),
--     so a DEFINER door is the only access path.  Captures 6/6 canonical PHI stores.
create table c2.m_dooronly as
select c.oid as reloid from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public','app') and c.relkind in ('r','p')
  and not has_table_privilege('authenticated', c.oid, 'SELECT');

-- (c) tenancy-anchored relations: carries an org / hospital / commission anchor column.
create table c2.m_tenancy as
select distinct c.oid as reloid
from pg_class c join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
where n.nspname in ('public','app') and c.relkind in ('r','p')
  and a.attname in ('organization_id','hospital_id','commission_id');

-- (b*) SENSITIVITY ONLY — see method rule 4.  This is a hand-list.
create table c2.m_dooronly_star as
select reloid from c2.m_dooronly
where reloid not in ('public.profiles'::regclass, 'app.feature_flags'::regclass,
                     'app.active_role_selections'::regclass, 'app.app_secrets'::regclass);

create table c2.m_phi        as select reloid from c2.m_phicomment union select reloid from c2.m_dooronly;
create table c2.m_phi_star   as select reloid from c2.m_phicomment union select reloid from c2.m_dooronly_star;
create table c2.m_literal    as select reloid from c2.m_phi        union select reloid from c2.m_tenancy;

-- ---------------------------------------------------------------- 5. the numbers
\echo ''
\echo '=== PARENT POPULATION (re-derived this run; must equal the ARM=census banner) ==='
select sch, count(*) from c2.roots group by 1 order by 1;
select count(*) as total_parent_population from c2.roots;

\echo ''
\echo '=== MARKER SET SIZES (relations) ==='
select 'phi_comment' as marker, count(*) from c2.m_phicomment
union all select 'door_only', count(*) from c2.m_dooronly
union all select 'door_only* (hand-list)', count(*) from c2.m_dooronly_star
union all select 'tenancy_anchor', count(*) from c2.m_tenancy;

\echo ''
\echo '=== TIER 1 CANDIDATES — CLOSURE grain (door + transitive callees), doors / pct of parent ==='
select 'A  PHI by comment' as candidate, count(distinct root) as doors,
       round(100.0 * count(distinct root) / (select count(*) from c2.roots), 1) as pct
  from c2.root_rel where reloid in (select reloid from c2.m_phicomment)
union all select 'B  reaches a door-only relation', count(distinct root),
       round(100.0 * count(distinct root) / (select count(*) from c2.roots), 1)
  from c2.root_rel where reloid in (select reloid from c2.m_dooronly)
union all select 'C  reaches a tenancy anchor', count(distinct root),
       round(100.0 * count(distinct root) / (select count(*) from c2.roots), 1)
  from c2.root_rel where reloid in (select reloid from c2.m_tenancy)
union all select 'D  A or B  (PHI, either marker)', count(distinct root),
       round(100.0 * count(distinct root) / (select count(*) from c2.roots), 1)
  from c2.root_rel where reloid in (select reloid from c2.m_phi)
union all select 'E  A or B or C  (THE LITERAL RULING)', count(distinct root),
       round(100.0 * count(distinct root) / (select count(*) from c2.roots), 1)
  from c2.root_rel where reloid in (select reloid from c2.m_literal)
union all select 'B* B minus 4 infra  [HAND-LIST]', count(distinct root),
       round(100.0 * count(distinct root) / (select count(*) from c2.roots), 1)
  from c2.root_rel where reloid in (select reloid from c2.m_dooronly_star)
union all select 'D* A or B*          [HAND-LIST]', count(distinct root),
       round(100.0 * count(distinct root) / (select count(*) from c2.roots), 1)
  from c2.root_rel where reloid in (select reloid from c2.m_phi_star);

\echo ''
\echo '=== SAME at DEPTH-0 grain (door body only) — cheaper, and FALSIFIED in section 6 ==='
select 'D0 PHI, depth 0' as candidate, count(distinct root) as doors,
       round(100.0 * count(distinct root) / (select count(*) from c2.roots), 1) as pct
  from c2.root_rel0 where reloid in (select reloid from c2.m_phi)
union all select 'E0 literal ruling, depth 0', count(distinct root),
       round(100.0 * count(distinct root) / (select count(*) from c2.roots), 1)
  from c2.root_rel0 where reloid in (select reloid from c2.m_literal);

\echo ''
\echo '=== WHY the tenancy arm cannot discriminate: most-reached relations ==='
select r.label, count(distinct rr.root) as roots_reaching
from c2.root_rel rr join c2.rels r on r.reloid = rr.reloid
group by 1 order by 2 desc limit 8;

-- ---------------------------------------------------------------- 6. POSITIVE CONTROLS
\echo ''
\echo '=== POSITIVE CONTROLS — a candidate returning f for any row is FALSIFIED ==='
\echo '    assume_role is in Tier 1 BY CONSTRUCTION (platform_role crosses every tenancy boundary)'
select left(r.label, 56) as control,
       (r.oid in (select root from c2.root_rel  where reloid in (select reloid from c2.m_phi)))      as "D closure",
       (r.oid in (select root from c2.root_rel0 where reloid in (select reloid from c2.m_phi)))      as "D0 depth0",
       (r.oid in (select root from c2.root_rel  where reloid in (select reloid from c2.m_phi_star))) as "D* handlist",
       (r.oid in (select root from c2.root_rel  where reloid in (select reloid from c2.m_literal)))  as "E literal"
from c2.roots r
where r.label ~ 'set_event_patient|get_referral_patient|set_participant_patient\(|dispose_case_phi|create_case\(|assume_role'
order by 1;

\echo ''
\echo '=== RESIDUE: doors OUTSIDE the literal ruling (sanity check on the instrument) ==='
select r.label from c2.roots r
where r.oid not in (select root from c2.root_rel where reloid in (select reloid from c2.m_literal))
order by 1;

drop schema c2 cascade;
