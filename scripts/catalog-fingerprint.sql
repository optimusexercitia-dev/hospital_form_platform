-- CATALOG FINGERPRINT -- the chain-vs-stack positive control.
--
-- WHY THIS EXISTS: FUP-AE2-CATALOG-SUPERSET-OF-CHAIN. Applying a migration by hand
-- (psql -f) instead of through `supabase db reset` leaves its objects in the catalog
-- WITHOUT the chain having produced them. Combined with `create or replace`, the live
-- catalog becomes a SUPERSET of what the chain builds: a statement REMOVED from a
-- migration file (the measured case was a `grant` line) SURVIVES in the catalog.
--
-- Every gate in this repo -- lint, the ARM arms, pgTAP, the door sweep -- reads the LIVE
-- CATALOG, which is exactly the artefact that has drifted. There is nothing to compare
-- against without rebuilding. ONLY A RESET CAN. `supabase migration list` compares
-- VERSIONS, not CONTENTS, so it is green here too (measured: 496 files = 496 rows while
-- the question was still open).
--
-- HOW TO RUN IT: scripts/catalog-chain-drift.sh  (capture -> reset -> capture -> diff)
--
-- DOMAIN, STATED SO ABSENCE IS NOT READ AS COVERAGE -- nine sections:
--   PROC (incl. prosecdef + proacl + body hash) . POLICY . RELACL . COLACL . TRIGGER
--   . NSPACL . COLUMN . CONSTRAINT . INDEX
-- Schemas: public, app (+ auth, storage for PROC only).
-- NOT covered: row DATA, sequences, types/enums, view bodies, extensions, storage
-- buckets, auth config. A superset in THOSE is invisible here.
--
-- ⚠ ACL ARRAYS AND POLICY ROLES ARE SORTED BEFORE HASHING. Postgres preserves GRANT
-- ORDER in an aclitem[], so two catalogs holding the IDENTICAL privileges hash
-- differently when the grants were applied in a different sequence -- which is exactly
-- what separates a chain applied incrementally (the remote) from one applied by a fresh
-- reset. Measured 2026-08-29 on the first real use: PROC and RELACL reported DRIFT while
-- every privilege multiset matched (417+285 local = 222+480 remote = 702). An
-- order-sensitive digest makes this instrument cry wolf, and a control that cries wolf
-- gets ignored on the day it is right.
--
-- ALWAYS run with -v ON_ERROR_STOP=1. Without it psql skips a failing section and
-- still exits 0 -- the fingerprint silently narrows and the diff reads clean.

-- Catalog fingerprint: pg_proc + pg_policies + ACLs (+ triggers).
-- Discharges FUP-AE2-CATALOG-SUPERSET-OF-CHAIN item (a): compare the WORKING STACK
-- against a FRESHLY RESET catalog (= what the migration chain actually produces).
\pset tuples_only on
\pset format unaligned
\pset footer off

-- 1. FUNCTIONS: identity, security context, ACL, body hash
select 'PROC|' || n.nspname || '|' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
       || '|secdef=' || p.prosecdef
       || '|acl=' || coalesce((select string_agg(x::text, ',' order by x::text) from unnest(p.proacl) x), '<NULL=PUBLIC>')
       || '|body=' || md5(coalesce(p.prosrc, ''))
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','app','auth','storage')
order by 1;

-- 2. POLICIES: full text of both clauses
select 'POLICY|' || schemaname || '|' || tablename || '|' || policyname
       || '|cmd=' || cmd
       || '|permissive=' || permissive
       || '|roles=' || (select string_agg(x::text, ',' order by x::text) from unnest(roles) x)
       || '|using=' || md5(coalesce(qual, '<null>'))
       || '|check=' || md5(coalesce(with_check, '<null>'))
from pg_policies
where schemaname in ('public','app','storage')
order by 1;

-- 3. RELATION ACLs + RLS flag
select 'RELACL|' || n.nspname || '|' || c.relname
       || '|rls=' || c.relrowsecurity
       || '|force=' || c.relforcerowsecurity
       || '|acl=' || coalesce((select string_agg(x::text, ',' order by x::text) from unnest(c.relacl) x), '<NULL=OWNER-ONLY>')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public','app') and c.relkind in ('r','v','m','p')
order by 1;

-- 4. COLUMN-LEVEL ACLs (the mechanism AE3 retires -- must be captured)
select 'COLACL|' || n.nspname || '|' || c.relname || '|' || a.attname
       || '|acl=' || (select string_agg(x::text, ',' order by x::text) from unnest(a.attacl) x)
from pg_attribute a
join pg_class c on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public','app') and a.attacl is not null and a.attnum > 0
order by 1;

-- 5. TRIGGERS (non-internal)
select 'TRIGGER|' || n.nspname || '|' || c.relname || '|' || t.tgname
       || '|enabled=' || t.tgenabled::text
       || '|def=' || md5(pg_get_triggerdef(t.oid))
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal and n.nspname in ('public','app')
order by 1;

-- 6. SCHEMA USAGE grants
select 'NSPACL|' || n.nspname || '|acl=' || coalesce((select string_agg(x::text, ',' order by x::text) from unnest(n.nspacl) x), '<NULL=PUBLIC>')
from pg_namespace n where n.nspname in ('public','app')
order by 1;

-- 7. COLUMNS: type, nullability, default (AE3 moves three columns -- a fingerprint
--    blind to columns cannot see the phase's own subject)
select 'COLUMN|' || n.nspname || '|' || c.relname || '|' || a.attname
       || '|type=' || format_type(a.atttypid, a.atttypmod)
       || '|notnull=' || a.attnotnull::text
       || '|default=' || md5(coalesce(pg_get_expr(d.adbin, d.adrelid), '<none>'))
from pg_attribute a
join pg_class c on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
where n.nspname in ('public','app') and c.relkind in ('r','p')
  and a.attnum > 0 and not a.attisdropped
order by 1;

-- 8. CONSTRAINTS: CHECK / FK / UNIQUE / PK, by definition (AE3 MOVES a CPF CHECK)
select 'CONSTRAINT|' || n.nspname || '|' || c.relname || '|' || con.conname
       || '|type=' || con.contype::text
       || '|def=' || md5(pg_get_constraintdef(con.oid))
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public','app')
order by 1;

-- 9. INDEXES (AE3 MOVES a unique index "with its collation/normalization intact")
select 'INDEX|' || n.nspname || '|' || c.relname || '|' || i.relname
       || '|def=' || md5(pg_get_indexdef(x.indexrelid))
from pg_index x
join pg_class i on i.oid = x.indexrelid
join pg_class c on c.oid = x.indrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public','app')
order by 1;
