-- =====================================================================================
-- authz-tier1-threat-review-ae1.sql -- the deriving instrument for AE1 close condition #3
--   (PA-F11 tiered DEFINER threat review; plan docs/plans/authz-evolution.md AE1.2 step 1)
--
-- PURPOSE
--   PA-F11 asks for ten threat columns over every remotely reachable function. Written by
--   hand that is 500+ rows of prose, and the honest failure mode -- named in the phase
--   record before this was started -- is a shallow pass that fills the rows thinly and
--   reports the condition as met.
--   This script instead DECIDES every column the catalog can decide, and partitions the
--   rest into named REVIEW buckets. The residue is then a MEASURED number, not an estimate,
--   and the review that follows is bounded by a property rather than by patience.
--   Recorded output: docs/design/authz-ae1-tier1-threat-review.md
--
-- CONTRACT
--   * Non-mutating: SELECT plus session-local TEMP tables. No DDL on persistent objects,
--     no DML, no SET ROLE. Safe against the linked project.
--   * ⚠ Unlike scripts/authz-census-ae0.sql this DOES create temp tables (the call closure
--     is reused by six blocks and recomputing it per block is not worth the duplication).
--     Consequence, stated: run it through psql (local or `psql "$DB_URL" -f`), NOT through
--     the read-only MCP execute_sql tool, which rejects CREATE TEMP.
--   * Every bucket is a PARTITION whose parts sum to the population; the arithmetic is
--     printed, never asserted in prose.
--   * Every REVIEW bucket names the property that put a row in it, so the row can be
--     re-derived rather than remembered.
--
-- HOW TO RUN
--   docker exec -i supabase_db_<ref> psql -U postgres -d postgres -f - < scripts/authz-tier1-threat-review-ae1.sql
--
-- BINDING METHOD RULES ENCODED HERE (each cost something to learn -- do not "simplify")
--   1. prosrc is ALWAYS comment-stripped (line AND block comments). An uncommented sweep
--      counts `--` comments as live code (ADR 0078, three strikes).
--   2. ⛔ IDENTITY BINDING AND AUTHORITY ARE COMPUTED OVER THE CALL CLOSURE, NEVER THE BODY.
--      A one-level regex reports a DELEGATING WRAPPER as unbound. Measured here: the first
--      version of BLOCK 4 flagged 27 doors as taking an arbitrary principal with no identity
--      binding; all 27 delegate to a gate one level down (`assign_org_admin` -> `grant_role`
--      -> `auth.uid()`), and the closure-based figure is ZERO. This is the same grain error
--      ADR 0079 Amendment 7 exists for -- a wrapper whose gate lives elsewhere.
--   3. The closure is computed by TWO instruments differing in KIND (qualified-only edges,
--      and qualified+bare edges). Bare-name matching over-joins across schemas, and
--      over-inclusion is the UNSAFE direction here: it claims safety that may not be there.
--      BLOCK 3 prints both so the disagreement is a number rather than a caveat.
--   4. EXECUTE figures are asserted POSITIVELY via has_function_privilege. A NULL proacl
--      INCLUDES PUBLIC, so an empty-looking ACL column is not evidence of absence
--      (this mistake has fired 4x in this repo; BLOCK 8 prints the NULL count for that reason).
--   5. prosecdef is reported beside every verdict: a DEFINER's read BYPASSES RLS, so the
--      same body shape is a finding as DEFINER and a non-finding as INVOKER. BLOCK 6 splits
--      on exactly this and it changes 14 rows from finding to non-finding.
--   6. Every REVIEW bucket ships with the non-review buckets beside it, so a small residue
--      cannot be read as small coverage.
-- =====================================================================================

set search_path to pg_catalog, public;


-- -------------------------------------------------------------------------------------
-- BLOCK 0 -- Stack identity. Run FIRST. Every figure below is only meaningful at this head.
-- -------------------------------------------------------------------------------------
select 'migration head'   as figure, max(version)::text as value from supabase_migrations.schema_migrations
union all
select 'migrations applied', count(*)::text from supabase_migrations.schema_migrations
union all
select 'exposed schemas (config.toml is the authority; this is the reachability premise)',
       'public, graphql_public';


-- -------------------------------------------------------------------------------------
-- BLOCK 1 -- The universe, and the TIER 1 population.
--
-- ⛔ TIER 1 IS 523, NOT 432. PA-F11 defines Tier 1 as "remotely reachable functions
--    (exposed schema per config.toml + authenticated/anon effective EXECUTE)". The phase's
--    432 is the DEFINER SUBSET of that -- it inherits AE1.2's DEFINER-only population and
--    silently drops 90 `public` INVOKER functions plus graphql_public.graphql. Those 91 are
--    precisely the class ADR 0079 Amendment 7 was written for: a `public` INVOKER wrapper
--    in front of an `app` DEFINER body, which was in NO arm's domain at all.
-- -------------------------------------------------------------------------------------
create temp table allfn as
select p.oid,
       n.nspname                                   as sch,
       p.proname,
       pg_get_function_identity_arguments(p.oid)   as args,
       pg_get_function_result(p.oid)               as rettype,
       p.prosecdef, p.provolatile, p.proretset,
       p.pronargs, p.pronargdefaults, p.proconfig, p.proacl,
       pg_get_userbyid(p.proowner)                 as owner,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as x_auth,
       has_function_privilege('anon',          p.oid, 'EXECUTE') as x_anon,
       has_function_privilege('service_role',  p.oid, 'EXECUTE') as x_svc,
       has_function_privilege('public',        p.oid, 'EXECUTE') as x_public,
       regexp_replace(regexp_replace(p.prosrc, '/\*.*?\*/', ' ', 'gs'),
                      '--[^\n]*', ' ', 'g')        as src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('app', 'public', 'graphql_public');

create temp table t1 as
select * from allfn
 where sch in ('public', 'graphql_public')
   and (x_auth or x_anon);

select 'TIER 1 -- remotely reachable (exposed schema + effective EXECUTE)' as figure,
       count(*)::text as value from t1
union all
select '  of which SECURITY DEFINER (= the phase-record figure "432")',
       count(*)::text from t1 where prosecdef
union all
select '  of which SECURITY INVOKER (dropped by the DEFINER-only sizing)',
       count(*)::text from t1 where not prosecdef
union all
select 'TIER 2 -- app schema, authenticated-executable DEFINER (anon holds no USAGE on app)',
       count(*)::text from allfn where sch = 'app' and prosecdef and x_auth;

-- the partition, printed
select sch, prosecdef as definer, count(*) from t1 group by 1, 2 order by 1, 2;


-- -------------------------------------------------------------------------------------
-- BLOCK 2 -- C1 owner + BYPASSRLS · C2 PostgREST exposure · C6 overload/default reach
--            · C8 output shape · C10 exact grants.  All fully decided by the catalog.
--
-- ⚠ C1 corrects a premise the classification rests on. authz-definer-classification-ae1.md
--    §1 says "a SECURITY DEFINER runs as a superuser, so its callees need no authenticated
--    EXECUTE". Measured: `postgres` is rolsuper = FALSE on this stack (Supabase de-superusers
--    it) and rolbypassrls = TRUE. The CONCLUSION survives -- via OWNERSHIP, since postgres
--    owns all of them and an owner holds EXECUTE -- but the stated mechanism is wrong, and
--    BYPASSRLS is the half that actually matters for authorization.
-- -------------------------------------------------------------------------------------
select 'C1 owner' as col, t1.owner, r.rolsuper, r.rolbypassrls, count(*)
  from t1 join pg_roles r on r.rolname = t1.owner
 group by 2, 3, 4 order by 5 desc;

select 'C2 PostgREST callable' as col,
       count(*) filter (where rettype <> 'trigger')  as callable,
       count(*) filter (where rettype =  'trigger')  as trigger_returning_not_callable
  from t1;

select 'C6 overload / default-arg reach' as col,
       (select count(*) from (select sch, proname from t1 group by 1, 2 having count(*) > 1) o) as overloaded_names,
       count(*) filter (where pronargdefaults > 0) as with_default_args
  from t1;

select 'C8 output shape' as col,
       case when not prosecdef                     then 'INVOKER -- RLS applies to the caller'
            when rettype = 'trigger'               then 'trigger -- not PostgREST-callable'
            when proretset                         then 'DEFINER setof/TABLE -- ENUMERATION REVIEW'
            when rettype in ('boolean', 'void')    then 'DEFINER bool/void -- minimal output'
            else                                        'DEFINER scalar/composite' end as shape,
       count(*)
  from t1 group by 1, 2 order by 3 desc;

select 'C10 exact grants' as col,
       count(*) filter (where proacl is null) as null_acl_would_mean_PUBLIC,
       count(*) filter (where x_public)       as public_executable,
       count(*) filter (where x_anon)         as anon_executable,
       count(*) filter (where x_auth)         as authenticated_executable,
       count(*) filter (where x_svc)          as service_role_executable
  from t1;

select 'C10 detail -- every PUBLIC/anon-executable Tier 1 function, named' as col,
       sch || '.' || proname as fn, rettype, prosecdef
  from t1 where x_anon or x_public order by 2;


-- -------------------------------------------------------------------------------------
-- BLOCK 3 -- The call closure, by TWO instruments (method rule 3).
--            Edge sets differ in kind: qualified-only cannot over-join; qualified+bare can.
-- -------------------------------------------------------------------------------------
create temp table edge_q as                              -- conservative
select distinct c.oid as caller, f.oid as callee
  from allfn c
  join lateral regexp_matches(c.src, '(app|public)[[:space:]]*\.[[:space:]]*([a-z_][a-z0-9_]*)[[:space:]]*\(', 'g') m on true
  join allfn f on f.sch = m[1] and f.proname = m[2]
 where c.oid <> f.oid;

create temp table edge_b as                              -- permissive (adds bare-name edges)
select * from edge_q
union
select distinct c.oid, f.oid
  from allfn c
  join lateral regexp_matches(c.src, '(?:^|[^a-zA-Z0-9_."$])([a-z_][a-z0-9_]*)[[:space:]]*\(', 'g') m on true
  join allfn f on f.proname = m[1]
 where c.oid <> f.oid;

-- direct per-body signals, evaluated once
create temp table sig as
select oid,
       (src ~* 'auth\.uid\(|auth\.jwt\(|current_setting\s*\(\s*''request\.|app\.current_')
         as id_direct,
       (src ~* '\yhas_role\y|\yis_[a-z_]+_of\y|\ycan_[a-z_]+\y|\yassert_[a-z_]+\y|\yauthoriz[a-z_]*\y|\yenforce_[a-z_]+\y|_impl\s*\(|\yraise\y')
         as gate_direct,
       (src ~* 'audit_write|log_audit_access|log_cpf_probe|log_document_previa')
         as audit_direct
  from allfn;

create temp table reach_q as
with recursive r as (
  select a.oid as root, a.oid as node, 0 as depth from allfn a
  union
  select r.root, e.callee, r.depth + 1 from r join edge_q e on e.caller = r.node where r.depth < 8)
select root, bool_or(s.id_direct) as id_reach, bool_or(s.gate_direct) as gate_reach,
       bool_or(s.audit_direct) as audit_reach
  from r join sig s on s.oid = r.node group by root;

create temp table reach_b as
with recursive r as (
  select a.oid as root, a.oid as node, 0 as depth from allfn a
  union
  select r.root, e.callee, r.depth + 1 from r join edge_b e on e.caller = r.node where r.depth < 8)
select root, bool_or(s.id_direct) as id_reach, bool_or(s.gate_direct) as gate_reach
  from r join sig s on s.oid = r.node group by root;

select 'closure instrument agreement' as figure,
       (select count(*) from edge_q) as edges_qualified_only,
       (select count(*) from edge_b) as edges_qualified_plus_bare,
       (select count(*) from t1 join reach_q q on q.root = t1.oid where not q.id_reach) as no_identity_conservative,
       (select count(*) from t1 join reach_b b on b.root = t1.oid where b.id_reach is not true) as no_identity_permissive;


-- -------------------------------------------------------------------------------------
-- BLOCK 4 -- C3 caller-identity binding · C4 arbitrary-principal parameters.
--
-- ⛔ THE HEADLINE, and the reason method rule 2 exists: computed per-body, C3xC4 reads 27
--    doors "taking a principal with nothing binding it to the session". Computed over the
--    closure it reads ZERO. The per-body number is an artifact of the instrument's grain.
-- -------------------------------------------------------------------------------------
select 'C3 identity binding' as col,
       count(*) filter (where s.id_direct)      as bound_in_own_body,
       count(*) filter (where q.id_reach)       as bound_somewhere_in_closure,
       count(*) filter (where not q.id_reach)   as NO_identity_in_closure
  from t1 join reach_q q on q.root = t1.oid join sig s on s.oid = t1.oid;

select 'C4 principal-named uuid parameter' as col,
       count(*) filter (where args ~* '(actor|user_id|principal|profile_id|member_id|target_user|p_user|_uid)[^,]*\yuuid\y') as takes_principal,
       count(*) as tier1_total
  from t1;

select 'C3xC4 -- takes a principal AND binds no identity anywhere in the closure' as col,
       count(*) as findings
  from t1 join reach_q q on q.root = t1.oid
 where not q.id_reach
   and args ~* '(actor|user_id|principal|profile_id|member_id|target_user|p_user|_uid)[^,]*\yuuid\y';

-- the C3 review set, named, with the second signal beside it
select 'C3 REVIEW SET -- no identity AND no authority anywhere in the closure' as col,
       t1.sch || '.' || t1.proname as fn, t1.prosecdef as definer, t1.provolatile as vol, t1.rettype,
       (b.id_reach is true or b.gate_reach is true) as rescued_by_permissive_edges
  from t1 join reach_q q on q.root = t1.oid join reach_b b on b.root = t1.oid
 where not q.id_reach and not q.gate_reach
 order by 2;


-- -------------------------------------------------------------------------------------
-- BLOCK 5 -- C7 dynamic SQL and search_path pinning.
--
-- ⚠ A MATCH HERE IS A CANDIDATE, NEVER A FINDING. The comment-strip removes comments; it
--   does NOT remove STRING LITERALS, and this codebase's literals are pt-BR prose. All
--   three 2026-08-27 hits were false positives on exactly that: two `format()` calls
--   building a pt-BR message, and -- the sharp one -- `complete_dsr_task` matching
--   `\yexecute\y\s` inside the error text "... execute o descarte antes de concluir a
--   tarefa", where `execute` is a Portuguese imperative verb. The discriminator is reading
--   the match in context, which is why BLOCK 5 prints the named rows and not just a count.
--
-- ⛔ And when you print that context: regexp_matches returns captures at index 1. `m[0]` is
--   NULL for every match, so a context probe reading it reports "no matches" on a body full
--   of them -- which agreed with the expectation being tested and nearly recorded three real
--   candidates as dispositioned-by-nothing.
-- -------------------------------------------------------------------------------------
select 'C7 search_path' as col,
       count(*) filter (where array_to_string(proconfig, ',') ~* 'search_path') as pinned,
       count(*) filter (where proconfig is null or array_to_string(proconfig, ',') !~* 'search_path') as NOT_pinned
  from t1;

select 'C7 detail -- dynamic SQL or unpinned search_path, named' as col,
       sch || '.' || proname as fn, prosecdef as definer,
       (src ~* '\yexecute\y\s')     as dynamic_execute,
       (src ~* '\yformat\s*\(')     as uses_format,
       coalesce(array_to_string(proconfig, ','), 'UNPINNED') as proconfig
  from t1
 where src ~* '\yexecute\y\s' or src ~* '\yformat\s*\(' or proconfig is null
    or array_to_string(proconfig, ',') !~* 'search_path'
 order by 2;


-- -------------------------------------------------------------------------------------
-- BLOCK 6 -- C5 authority-before-existence ordering.
--
-- The mechanical proxy is POSITIONAL: where does the first authority token appear in the
-- body relative to the first table read? That alone over-flags, so the flagged set is split
-- twice more, and both splits change the verdict:
--   (a) does the pre-authority lookup RAISE a not-found error the caller can tell apart
--       from a permission denial?  A silent/uniform deny discloses nothing.
--   (b) is the function DEFINER?  An INVOKER's lookup is RLS-filtered, so its "not found"
--       ALREADY means "not visible to you" -- the correct uniform answer, not a leak.
-- -------------------------------------------------------------------------------------
create temp table c5 as
select oid, sch || '.' || proname as fn, prosecdef,
       coalesce(nullif(position(substring(src from '(?i)(has_role|is_[a-z_]+_of|can_[a-z_]+|assert_[a-z_]+|authoriz[a-z_]*)') in src), 0), 999999) as gate_at,
       coalesce(nullif(position(substring(src from '(?i)(from\s+(app|public)\.|into\s+v_|select\s+.*\s+from\s)') in src), 0), 999999) as read_at,
       coalesce(nullif(position(substring(src from '(?i)raise\s+exception\s+''[^'']*(inexistent|not\s+found|não\s+encontrad|nao\s+encontrad|inválid|invalid)') in src), 0), 999999) as notfound_raise_at
  from t1;

select 'C5 positional pass' as col,
       case when gate_at = 999999 and read_at = 999999 then 'N/A -- neither gate nor read'
            when gate_at = 999999                      then 'N/A here -- no gate token (see C3 review set)'
            when read_at = 999999                      then 'N/A -- gate, no table read'
            when gate_at < read_at                     then 'authority FIRST -- ok'
            else                                            'read before authority -> split below' end as verdict,
       count(*)
  from c5 group by 1, 2 order by 3 desc;

select 'C5 split (a)+(b) over the read-before-authority set' as col,
       case when notfound_raise_at <> 999999 and notfound_raise_at < gate_at and prosecdef
              then 'DEFINER + distinguishable not-found raise -> CONFIRMATION ORACLE'
            when notfound_raise_at <> 999999 and notfound_raise_at < gate_at and not prosecdef
              then 'INVOKER + not-found raise -> RLS-filtered read, not-found == not-authorized'
            else 'deny is silent/uniform -> no disclosure' end as verdict,
       count(*)
  from c5 where read_at < gate_at and gate_at <> 999999 group by 1, 2 order by 3 desc;

select 'C5 FINDING SET -- DEFINER doors that confirm existence before checking authority' as col,
       fn
  from c5
 where prosecdef and notfound_raise_at <> 999999 and notfound_raise_at < gate_at
   and read_at < gate_at and gate_at <> 999999
 order by 2;


-- -------------------------------------------------------------------------------------
-- BLOCK 7 -- C9 audit emission.
--
-- ⚠ A door that never calls audit_write may still be fully audited: this platform audits at
--    the TABLE level via trg_audit_* triggers. Counting only direct calls reports 162 gaps
--    where there are 62. The table-trigger path is the second half of the instrument.
-- -------------------------------------------------------------------------------------
create temp table audited_tbl as
select distinct c.relname
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_proc  p on p.oid = t.tgfoid
 where p.proname ~ '^(trg_)?audit' and not t.tgisinternal;

create temp table mut as
select t1.oid, t1.sch || '.' || t1.proname as fn, q.audit_reach,
       array(select distinct m[2]
               from regexp_matches(t1.src, '(?i)(insert\s+into|update|delete\s+from)\s+(?:app\.|public\.)?([a-z_][a-z0-9_]*)', 'g') m) as tables
  from t1 join reach_q q on q.root = t1.oid
 where t1.prosecdef and t1.rettype <> 'trigger'
   and t1.src ~* '\y(insert\s+into|update\s+(app|public)\.|delete\s+from)\y';

select 'C9 audit path for mutating DEFINER doors' as col,
       count(*) as mutating,
       count(*) filter (where audit_reach) as via_closure_call,
       count(*) filter (where not audit_reach and exists (select 1 from unnest(tables) u where u in (select relname from audited_tbl))) as via_table_trigger,
       count(*) filter (where not audit_reach and not exists (select 1 from unnest(tables) u where u in (select relname from audited_tbl))) as NO_AUDIT_PATH_REVIEW,
       (select count(*) from audited_tbl) as tables_carrying_an_audit_trigger
  from mut;


-- -------------------------------------------------------------------------------------
-- BLOCK 8 -- THE RESIDUE, as a partition. This is the number that scopes the human review.
--            Buckets overlap by design (a function may be flagged twice); the union is the
--            population that needs a judgment, and it is printed beside the Tier 1 total so
--            a small residue cannot be misread as small coverage.
-- -------------------------------------------------------------------------------------
create temp table review as
  select oid, 'C3 no identity anywhere in the call closure'          as bucket from t1 join reach_q q on q.root = t1.oid where not q.id_reach
  union
  select oid, 'C5 DEFINER confirms existence before authority'       from c5 where prosecdef and notfound_raise_at <> 999999 and notfound_raise_at < gate_at and read_at < gate_at and gate_at <> 999999
  union
  select oid, 'C7 dynamic SQL or unpinned search_path'               from t1 where src ~* '\yexecute\y\s' or src ~* '\yformat\s*\(' or proconfig is null or array_to_string(proconfig, ',') !~* 'search_path'
  union
  select oid, 'C8 DEFINER setof/TABLE -- enumeration surface'        from t1 where prosecdef and proretset and rettype <> 'trigger'
  union
  select oid, 'C9 mutating DEFINER with no audit path'               from mut where not audit_reach and not exists (select 1 from unnest(tables) u where u in (select relname from audited_tbl))
  union
  select oid, 'C10 PUBLIC or anon executable'                        from t1 where x_anon or x_public;

select bucket, count(*) from review group by 1
union all select '*** UNION -- distinct functions needing a judgment ***', count(distinct oid) from review
union all select '*** DECIDED mechanically (Tier 1 minus the union) ***',
                 (select count(*) from t1) - (select count(distinct oid) from review)
union all select '*** TIER 1 TOTAL ***', (select count(*) from t1)
order by 2 desc;

-- one row per residue function, with every bucket it lands in -- the review worklist
select t1.sch || '.' || t1.proname as fn, t1.prosecdef as definer, t1.rettype,
       string_agg(r.bucket, ' | ' order by r.bucket) as buckets
  from review r join t1 on t1.oid = r.oid
 group by 1, 2, 3 order by 1;

-- -------------------------------------------------------------------------------------
-- BLOCK 9 -- THE PUBLIC COMMAND DOORS, isolated as a POPULATION.
--
-- PA-F11 asks that public command doors be INDIVIDUALLY JUSTIFIED. Until 2026-08-27 this
-- instrument had no notion of a command door at all -- they were dissolved into the 523
-- with everything else, and the review's domain sentence cited 407, which is C2's
-- public+app figure, while the classification's public command-door class is 384. Three
-- populations, one sentence (QA finding M1).
--
-- Derived here as a PROPERTY, so the count moves with the catalog instead of with a list:
--   public + prosecdef + authenticated-executable + rettype <> 'trigger'
-- That is the UPPER BOUND. The classification's 384 is its subset actually reached from
-- src/ at tier rpc|code-literal -- a fact only the app sweep can establish, so the two
-- numbers are different questions and neither is wrong. Print both bounds, never one.
--
-- WHY EACH NEEDS EXECUTE is the classification's per-row src/ evidence (that file's SS12);
-- WHAT ITS RISK IS is the threat columns above, per row. The justification is the JOIN of
-- those two, which is why it is derived and not written out 384 times.
-- -------------------------------------------------------------------------------------
select 'command doors -- catalog upper bound (public, DEFINER, auth-exec, non-trigger)' as figure,
       count(*)::text as value
  from t1 where sch = 'public' and prosecdef and x_auth and rettype <> 'trigger'
union all
select '  ...also client-callable but NOT in that class: public INVOKER, auth-exec, non-trigger',
       count(*)::text from t1 where sch = 'public' and not prosecdef and x_auth and rettype <> 'trigger';

-- per-door risk row: the threat columns that apply to a command door, one line each
select t1.sch || '.' || t1.proname as door,
       t1.rettype,
       (q.id_reach)                                  as identity_bound_in_closure,
       (t1.args ~* '(actor|user_id|principal|profile_id|member_id|target_user|p_user|_uid)[^,]*\yuuid\y') as takes_principal,
       t1.proretset                                  as returns_rows,
       (t1.pronargdefaults > 0)                      as has_default_args,
       coalesce(array_to_string(t1.proconfig, ','), 'UNPINNED') as search_path
  from t1 join reach_q q on q.root = t1.oid
 where t1.sch = 'public' and t1.prosecdef and t1.x_auth and t1.rettype <> 'trigger'
 order by 1;

-- -------------------------------------------------------------------------------------
-- BLOCK 10 -- C8's gate-token split, which the review stated as '41 of 47' with no block
-- behind it (QA finding M1). Derived here so the figure has a deriver.
-- -------------------------------------------------------------------------------------
select case when src ~* '\yhas_role\y|\yis_[a-z_]+_of\y|\ycan_[a-z_]+\y|\yassert_[a-z_]+\y|\yauthoriz[a-z_]*\y'
            then 'gate token in body' else 'NO gate token in body -- read the body' end as split,
       count(*)
  from t1 where prosecdef and proretset and rettype <> 'trigger' group by 1 order by 2 desc;
