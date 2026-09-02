-- authz-c2-tier1-sizing.sql — Critical FUP C2: DERIVE the Tier-1 predicate and COUNT it.
-- Read-only against the schema; creates and drops `c2` as scratch.
--
-- Run:  docker cp scripts/authz-c2-tier1-sizing.sql <db>:/tmp/c2s.sql
--       docker exec <db> psql -U postgres -d postgres -tA -P pager=off -f //tmp/c2s.sql
--       (<db> = supabase_db_azkbbhskturikxpgmafq; the //tmp double slash defeats MSYS mangling)
--
-- ============================================================================
-- THE RE-GRAINED PREDICATE (PO-ruled 2026-08-31, after the first sizing returned
-- 405/427 and did not partition):
--
--   Tier 1 = a command door whose GATE-AWARE call closure reaches a PHI-MARKED relation.
--
--   · GATE-AWARE closure — descend through callees, but NEVER into a boolean-returning
--     one. A predicate that CHECKS whether you may read PHI is not itself a PHI-touching
--     door; only code that READS the relation is. Return type is a catalog fact.
--   · PHI-MARKED relation — (a) `authenticated` holds no table-level SELECT (a hard
--     `has_table_privilege` fact: a DEFINER door is the only access path), UNION
--     (b) a positive-polarity PHI comment on the table or any column.
--
--   ⛔ The TENANCY disjunct of the 2026-08-18 ruling is DROPPED, not re-grained — see
--     "Why tenancy is gone" below. It is a domain tautology, not a filter.
-- ============================================================================
--
-- BINDING METHOD RULES (PO ruling 2026-08-18; entry FUP-AUTHZ-COMMAND-DOOR-UNSWEPT in
--   docs/progress/follow-ups-open.md. ⛔ Keyed on the ENTRY ID, not a line range: the old
--   citation read :946-990 and had ALREADY drifted off its subject before the file moved.)
--  1. Derived from the catalog AS A PROPERTY, never hand-listed. Every component below is
--     a catalog fact: return type, `has_table_privilege`, `pg_description`, `pg_constraint`.
--     No relation and no door is named by hand anywhere in this file.
--  2. The PARENT population (the "427") is re-derived every run, never quoted. It must agree
--     with ARM=census's banner in p0-authz-invariant.sh:373 — the same five conjuncts.
--  3. Every candidate is scored against POSITIVE CONTROLS (§ 6). A candidate that drops a
--     known PHI door is FALSIFIED, however much cheaper it is.
--  4. Marker (b) is UNSOUND ALONE — prose polarity is not machine-decidable, so it admits
--     false positives ("is NOT a PHI store" matches a positive regex). It is used only in
--     UNION with the hard fact (a), where it can only widen. Erring WIDE is the safe
--     direction for deciding sweep membership; it is not safe for excluding.

drop schema if exists c2 cascade;
create schema c2;

-- ---------------------------------------------------------------- 1. function bodies
-- `--` comments stripped first: a line-filtered prosrc under-reports multiline guards.
-- `is_gate` is the property the closure turns on.
create table c2.fns as
select p.oid, n.nspname as sch, p.proname as nm,
       n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as label,
       regexp_replace(p.prosrc, '--[^\n]*', '', 'g') as body,
       (p.prorettype = 'pg_catalog.bool'::regtype) as is_gate
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

-- ---------------------------------------------------------------- 3. call graph
create table c2.edges as
select distinct a.oid as caller, b.oid as callee, b.is_gate
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

-- ------------------------------------------------- 4. the two closures (grain comparison)
create table c2.clo_all as              -- every edge: the FIRST sizing's grain
with recursive w(root, fn, d) as (
  select r.oid, r.oid, 0 from c2.roots r
  union select w.root, e.callee, w.d + 1 from w join c2.edges e on e.caller = w.fn where w.d < 8
) select distinct root, fn from w;

create table c2.clo_gate as             -- ⭐ GATE-AWARE: never descend into a predicate
with recursive w(root, fn, d) as (
  select r.oid, r.oid, 0 from c2.roots r
  union select w.root, e.callee, w.d + 1 from w join c2.edges e on e.caller = w.fn
        where w.d < 8 and not e.is_gate
) select distinct root, fn from w;

create table c2.rr_all  as select distinct c.root, fr.reloid from c2.clo_all  c join c2.fn_rel fr on fr.fnoid = c.fn;
create table c2.rr_gate as select distinct c.root, fr.reloid from c2.clo_gate c join c2.fn_rel fr on fr.fnoid = c.fn;
create index on c2.rr_gate(root);

-- ---------------------------------------------------------------- 5. marker sets
create table c2.m_phicomment as         -- (b) positive-polarity PHI comment — widen-only
select distinct c.oid as reloid
from pg_class c join pg_namespace n on n.oid = c.relnamespace
join pg_description d on d.objoid = c.oid
where n.nspname in ('public','app') and c.relkind in ('r','p','v','m')
  and ( (d.objsubid > 0 and d.description ~* 'phi[- ]bearing|isolated phi')
     or (d.objsubid = 0 and d.description ~* 'isolated phi|phi[- ]bearing|class[- ]1 phi') );

create table c2.m_dooronly as           -- (a) hard fact: a DEFINER door is the only path
select c.oid as reloid from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public','app') and c.relkind in ('r','p')
  and not has_table_privilege('authenticated', c.oid, 'SELECT');

create table c2.m_phi as
select reloid from c2.m_phicomment union select reloid from c2.m_dooronly;

-- The retired tenancy arm, kept so its vacuity stays MEASURED rather than asserted.
create table c2.m_tenancy as
select distinct c.oid as reloid from pg_class c join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
where n.nspname in ('public','app') and c.relkind in ('r','p')
  and a.attname in ('organization_id','hospital_id','commission_id');
create table c2.m_auditsink as          -- property: the hash-chained sink, not a name
select c.oid as reloid from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public','app') and c.relkind in ('r','p')
  and (select count(*) from pg_attribute a where a.attrelid = c.oid and not a.attisdropped
        and a.attname in ('prev_hash','row_hash','seq')) = 3;
create table c2.m_tenroot as            -- property: target of a tenancy-anchor FK
select distinct fc.oid as reloid
from pg_constraint k join pg_class c on c.oid = k.conrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_class fc on fc.oid = k.confrelid
join pg_attribute a on a.attrelid = c.oid and a.attnum = k.conkey[1]
where k.contype = 'f' and n.nspname in ('public','app')
  and a.attname in ('organization_id','hospital_id','commission_id');
create table c2.m_ten2 as
select reloid from c2.m_tenancy
where reloid not in (select reloid from c2.m_tenroot)
  and reloid not in (select reloid from c2.m_auditsink);

-- ---------------------------------------------------------------- 6. output
\echo ''
\echo '=== PARENT POPULATION (re-derived; must equal the ARM=census banner) ==='
select sch, count(*) from c2.roots group by 1 order by 1;
select count(*) as total_parent_population from c2.roots;

\echo ''
\echo '=== ⭐ TIER 1 — THE RE-GRAINED PREDICATE ==='
select count(distinct root) as tier1_doors,
       round(100.0 * count(distinct root) / (select count(*) from c2.roots), 1) as pct,
       (select count(*) from c2.roots) - count(distinct root) as tier2_doors
from c2.rr_gate where reloid in (select reloid from c2.m_phi);

\echo ''
\echo '=== GRAIN + ARM COMPARISON — why this shape and not another ==='
select 'PHI · all-edges      (first sizing)' as variant, count(distinct root) n,
       round(100.0*count(distinct root)/(select count(*) from c2.roots),1) pct
  from c2.rr_all where reloid in (select reloid from c2.m_phi)
union all select 'PHI · GATE-AWARE     <<< ADOPTED', count(distinct root),
       round(100.0*count(distinct root)/(select count(*) from c2.roots),1)
  from c2.rr_gate where reloid in (select reloid from c2.m_phi)
union all select 'TENANCY · all-edges  (retired)', count(distinct root),
       round(100.0*count(distinct root)/(select count(*) from c2.roots),1)
  from c2.rr_all where reloid in (select reloid from c2.m_tenancy)
union all select 'TENANCY · gate-aware (retired)', count(distinct root),
       round(100.0*count(distinct root)/(select count(*) from c2.roots),1)
  from c2.rr_gate where reloid in (select reloid from c2.m_tenancy)
union all select 'TENANCY · minus roots+audit sink', count(distinct root),
       round(100.0*count(distinct root)/(select count(*) from c2.roots),1)
  from c2.rr_gate where reloid in (select reloid from c2.m_ten2)
union all select 'LITERAL 2026-08-18 ruling (PHI or TEN, all-edges)', count(distinct root),
       round(100.0*count(distinct root)/(select count(*) from c2.roots),1)
  from c2.rr_all where reloid in (select reloid from c2.m_phi union select reloid from c2.m_tenancy);

\echo ''
\echo '=== WHY TENANCY IS GONE — its top drivers are ordinary business tables ==='
select r.label, count(distinct rr.root) as roots_reaching
from c2.rr_gate rr join c2.rels r on r.reloid = rr.reloid
where rr.reloid in (select reloid from c2.m_ten2)
group by 1 order by 2 desc limit 6;

\echo ''
\echo '=== WHAT DRIVES TIER 1 — reach per PHI-marked relation ==='
select r.label, count(distinct rr.root) as roots_reaching,
       (r.reloid in (select reloid from c2.m_dooronly)) as door_only,
       (r.reloid in (select reloid from c2.m_phicomment)) as phi_comment
from c2.rr_gate rr join c2.rels r on r.reloid = rr.reloid
where rr.reloid in (select reloid from c2.m_phi)
group by 1, r.reloid order by 2 desc limit 15;

-- ---------------------------------------------------------------- 7. POSITIVE CONTROLS
\echo ''
\echo '=== POSITIVE CONTROLS — any f FALSIFIES the candidate ==='
\echo '    assume_role is in Tier 1 BY CONSTRUCTION per the 2026-08-18 ruling.'
select left(r.label, 50) as control,
  (r.oid in (select root from c2.rr_gate where reloid in (select reloid from c2.m_phi))) as "ADOPTED",
  (r.oid in (select root from c2.rr_all  where reloid in (select reloid from c2.m_phi))) as "all-edges",
  (r.oid in (select root from (select distinct fnoid root, reloid from c2.fn_rel) z
              where reloid in (select reloid from c2.m_phi))) as "depth-0"
from c2.roots r
where r.label ~ 'set_event_patient|get_referral_patient|set_participant_patient\(|dispose_case_phi|create_case\(|assume_role'
order by 1;

\echo ''
\echo '=== TIER 1 WORKLIST (the sweep consumes this; regenerate, never edit) ==='
select r.label from c2.roots r
where r.oid in (select root from c2.rr_gate where reloid in (select reloid from c2.m_phi))
order by 1;

drop schema c2 cascade;
