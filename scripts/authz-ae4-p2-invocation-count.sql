-- AE4 / IA-F9 — P2's INSTRUMENT, as re-specified by ADR 0183 (amends ADR 0182; acceptance
-- doc §16). Companion to `scripts/authz-ae4-p1-index-path.sql`, and written to the same shape.
--
-- P2 asks how many times `authz.assignment_facts` is entered to serve ONE statement on the
-- converted read path. Its previous form (acceptance doc §9.7, stage 2) scraped an auto_explain
-- region for `Function Scan on assignment_facts af .*loops=[0-9]+`, counted the `loops` VALUES,
-- and scored *"every node loops=1"* as the pass. That property is invariant to the number of
-- candidate scopes: each nested `has_permission` emits its own plan carrying its own node at
-- `loops=1`, so the criterion is true for every D and **cannot fail**. Run 6 recorded SEVEN
-- invocations against a condition reading *"once per STATEMENT"* and scored it **PASS**.
--
-- THE PROPERTY, and why these three numbers measure it. `authz.authorized_scope_ids` is
-- one `assignment_facts` (a `materialized` CTE that PROPOSES candidate scope ids) plus one
-- `authz.has_permission` per proposal, each of which re-enters `entailed_grants` ->
-- `assignment_facts` to CONFIRM. Both are `SECURITY DEFINER`, so Postgres never inlines them and
-- every entry is a real fmgr invocation. The bound is therefore
--
--     A = 1 + U        A = `assignment_facts` invocations, U = candidate confirmations
--
-- and what makes that a STATEMENT-scoped bound rather than a row-scoped one is measured, not
-- asserted: A must not move with the protected-row count N (§2, P2a), and it must move
-- one-for-one with U (§1, P2b).
--
-- ⛔ P2's SUBJECT IS THE RESOLVER'S OWN RE-ENTRY. `authz.holds_role` and the policy's `ELSE`
-- arm also enter `assignment_facts`, and on an UNFILTERED statement they do. Those contributions
-- are reported as a decomposition (§4) and are NEVER folded into the bound. Folding them in is
-- exactly what made run 6's `7` look like a pass worth writing down: 3 of the 7 were the resolver
-- (1 + U, U = 2) and 4 were its neighbours. A criterion that cannot tell its own subject from its
-- neighbours is the same defect as one whose observable cannot move.
--
-- ⚠ WHAT THIS DOES NOT PROVE, stated rather than left implicit:
--   1. It is an INVOCATION count, not a cost. `A = 1 + U` says nothing about what one invocation
--      costs; the cost axis is P4/P5 and the fitted `(1+D)*(96+5.7*M)` model in ADR 0183.
--   2. It bounds ONE statement shape on ONE principal at the loaded fixture's `D`. It is not a
--      statement about the fixture-wide maximum of `1 + D`, which is a separate census.
--   3. §1 calls the resolver DIRECTLY (as `postgres`), where `auth.uid()` is NULL and
--      `entailed_grants`' hat conjunct therefore takes its third-party arm. That is correct for
--      an invocation count — neither the `candidate` CTE nor the call count consults the hat —
--      but it is not the self-check context the policy uses. §2 and §4 do run under the hat.
--
-- ⛔ THE INSTRUMENT, and the three ways it lies if you do not calibrate it.
--   `pg_stat_get_function_calls(oid)` under a per-session `track_functions = 'all'`, keyed by
--   OID via `::regprocedure` — no text scraping, no queryid matching, no plan parsing.
--   (a) `track_functions` is a per-SESSION superuser GUC whose cluster default here is `none`.
--       Counters are database-wide, but they only accumulate in backends that turned tracking
--       ON, so a concurrent session contaminates this run only if it also set the GUC. The
--       preflight reports how many other backends are active in this database anyway.
--   (b) Pending function stats are NOT visible inside a transaction block, and are NOT flushed
--       immediately after one (`PGSTAT_MIN_INTERVAL`, 1 s). ⭐ MEASURED 2026-09-03: reading the
--       counter right after a rolled-back probe WITHOUT a forced flush returns a delta of ZERO —
--       precisely the dead-instrument shape §0 exists to catch. Every read here is therefore
--       preceded by its own top-level `pg_stat_force_next_flush()`, as a separate statement.
--   (c) For a `language sql` SRF, fmgr may be entered once per invocation or once per returned
--       row. §0 calls `authz.assignment_facts` once directly, over M rows, and REQUIRES Δ = 1.
--       Δ = M means the counter is counting rows and every number below is wrong by a factor of
--       M; that is reported VOID with a remedy, never as a number.
--   Counters survive ROLLBACK. That is a feature: every mutation below is planted inside
--   `begin … rollback` and the count it caused is still readable afterwards.
--
-- ⛔ U IS NOT READABLE OFF THE RESOLVER'S PLAN, and that is a catalog fact, not a preference.
--   `authz.authorized_scope_ids` is `SECURITY DEFINER` => never inlined => `EXPLAIN (ANALYZE)` of
--   any statement that calls it stops at `Function Scan on authz.authorized_scope_ids`. The
--   `candidate` CTE / `Unique` nodes exist ONLY in the auto_explain nested-statement log, which
--   ADR 0183 rejects as a verdict instrument (it cannot carry an exit code and it cannot attribute
--   a node to its caller — which is how three `holds_role` nodes became P2 evidence). U is
--   therefore MEASURED on the same OID instrument, as `authz.has_permission` invocations: the
--   resolver's confirmations, one per proposal. ⛔ It is NOT the `SubPlan -> ProjectSet rows=`
--   reading (that is the GRANTED count, a different quantity — §1 arm C separates them by
--   construction), and it is NOT a hand-copy of the resolver's candidate `CASE`, which no gate
--   would protect from drifting away from the body it duplicates.
--
-- PRECONDITION: the AE4 perf fixture must be loaded (`ae4perf.fixture_meta`). The preflight says
-- so in one sentence if it is not. Requires superuser (`track_functions`, `alter policy`).
--
-- Run:  docker exec -i supabase_db_azkbbhskturikxpgmafq \
--         psql -U postgres -d postgres -X -f - < scripts/authz-ae4-p2-invocation-count.sql
-- Exit: 0 = every section CLEAR (P2/P2a/P2b pass) · 3 = a bound was violated (FAIL), or a
--       control did not fire / the instrument was not calibrated (VOID). ⛔ Read the exit code
--       DIRECTLY; a pipe erases it.

\set ON_ERROR_STOP on
\pset pager off
\timing off

set track_functions = 'all';

-- ============================================================================
-- PREFLIGHT — the precondition, the baseline the postflight will compare against, and the
-- one environmental fact that could contaminate a database-wide counter.
-- ============================================================================
do $pre$
begin
  if to_regclass('ae4perf.fixture_meta') is null then
    raise exception 'P2 CHECKER PRECONDITION UNMET — the AE4 perf fixture is not loaded (ae4perf.fixture_meta is absent).'
      using hint = 'Load the fixture (harness section 0) and re-run. This is not a P2 verdict.';
  end if;
  if current_setting('track_functions') <> 'all' then
    raise exception 'P2 CHECKER PRECONDITION UNMET — track_functions is %, not all.', current_setting('track_functions')
      using hint = 'Requires superuser. Without it every counter below reads 0 and nothing is measured.';
  end if;
end
$pre$;

create temp table p2_result(section text, subject text, measured text, verdict text);
create temp table p2_baseline(k text primary key, v text);

-- ⛔ ONE definition of "the bodies this checker must not have mutated", so the preflight baseline
--    and the postflight comparison cannot drift apart. (They did, on the first run: two hand-written
--    copies of the same predicate, and the md5 moved for a reason that was not a mutation.)
--    `assignment_facts` itself does NOT contain its own name, so it is named explicitly — the
--    `like` alone would leave the one body this whole checker is about unprotected.
create temp view p2_chain as
  select p.oid, p.prosrc
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('authz','app')
     and (p.prosrc like '%assignment_facts%'
          or p.prosrc like '%entailed_grants%'
          or p.oid = 'authz.assignment_facts(uuid)'::regprocedure);

insert into p2_baseline
select 'memberships', count(*)::text from public.memberships
union all select 'profiles',      count(*)::text from public.profiles
union all select 'organizations', count(*)::text from public.organizations
union all select 'policy_qual_md5',
       md5(pg_get_expr(polqual, polrelid))
  from pg_policy
 where polrelid = 'public.professional_profiles'::regclass
   and polname  = 'professional_profiles_select'
union all select 'prosrc_md5', md5(string_agg(prosrc, '|' order by oid)) from p2_chain;

\echo ''
\echo '--- preflight: the tree this run is measured over ---'
select k, v from p2_baseline where k in ('memberships','profiles','organizations') order by k;
select count(*) as other_active_backends_in_this_db
  from pg_stat_activity
 where datname = current_database() and pid <> pg_backend_pid() and state <> 'idle';

-- The five functions whose OIDs are snapshotted below. §4 proves this set is COMPLETE against
-- the catalog rather than trusting that it still is.
create temp table p2_covered(sig regprocedure primary key);
insert into p2_covered values
  ('authz.authorized_scope_ids(uuid,text,text)'),
  ('authz.candidate_authorized_scope_ids(uuid,text,text)'),
  ('authz.entailed_grants(uuid,text,uuid,text)'),
  ('authz.explain_permission(uuid,text,uuid,text)'),
  ('authz.holds_role(uuid,text,text,uuid)');

-- ============================================================================
-- THE SNAPSHOT MECHANISM. One row per named point in time. `granted` / `rows_seen` carry the
-- SEMANTIC result of the probe that preceded the snapshot, so a verdict can ask whether the
-- count moved WITHOUT the answer moving (§1 arm C) — the difference between counting proposals
-- and counting grants.
-- ============================================================================
create temp table p2_snap(
  tag text primary key,
  af bigint, hp bigint, eg bigint, hr bigint, asi bigint,
  cas bigint, chp bigint, xp bigint, crp bigint, cmp bigint, cwo bigint,
  granted bigint, rows_seen bigint);

create procedure pg_temp.p2_take(p_tag text, p_granted bigint default null, p_rows bigint default null)
language plpgsql as $snap$
begin
  -- Counters are transaction-snapshot cached; without this every read after the first returns
  -- the same numbers and every delta is 0.
  perform pg_stat_clear_snapshot();
  -- ⛔ COALESCE IS LOAD-BEARING, and it was added after a measured VOID (run 7, 2026-09-03).
  -- `pg_stat_get_function_calls` returns **NULL**, not 0, for a function with no stats row yet —
  -- and on a freshly `db reset` stack under a per-session `track_functions='all'`, NOTHING has a
  -- stats row at the moment the baseline snapshot is taken. Every baseline read NULL, so every
  -- delta computed as `new - NULL` = NULL, and §0 correctly refused the run.
  -- ⚠ The reason this survived development: the checker had already been run three times against
  -- a long-lived stack, so the stats rows it needed had been created BY ITS OWN EARLIER RUNS.
  -- The instrument only worked once it had already been used — a primed-cache defect that is
  -- invisible to any amount of re-running and visible on the first cold start.
  insert into p2_snap select p_tag,
    coalesce(pg_stat_get_function_calls('authz.assignment_facts(uuid)'::regprocedure), 0),
    coalesce(pg_stat_get_function_calls('authz.has_permission(uuid,text,uuid,text)'::regprocedure), 0),
    coalesce(pg_stat_get_function_calls('authz.entailed_grants(uuid,text,uuid,text)'::regprocedure), 0),
    coalesce(pg_stat_get_function_calls('authz.holds_role(uuid,text,text,uuid)'::regprocedure), 0),
    coalesce(pg_stat_get_function_calls('authz.authorized_scope_ids(uuid,text,text)'::regprocedure), 0),
    coalesce(pg_stat_get_function_calls('authz.candidate_authorized_scope_ids(uuid,text,text)'::regprocedure), 0),
    coalesce(pg_stat_get_function_calls('authz.candidate_has_permission(uuid,text,uuid,text)'::regprocedure), 0),
    coalesce(pg_stat_get_function_calls('authz.explain_permission(uuid,text,uuid,text)'::regprocedure), 0),
    coalesce(pg_stat_get_function_calls('app.can_read_professional_profile(uuid,uuid)'::regprocedure), 0),
    coalesce(pg_stat_get_function_calls('app.can_manage_professional(uuid,uuid)'::regprocedure), 0),
    coalesce(pg_stat_get_function_calls('app.current_professional_read_organizations()'::regprocedure), 0),
    p_granted, p_rows;
end
$snap$;

create temp table p2_pair(arm text primary key, t0 text, t1 text);
create temp view p2_delta as
select p.arm,
       s1.af - s0.af as d_af, s1.hp - s0.hp as d_hp, s1.eg - s0.eg as d_eg,
       s1.hr - s0.hr as d_hr, s1.asi - s0.asi as d_asi, s1.cas - s0.cas as d_cas,
       s1.chp - s0.chp as d_chp, s1.xp - s0.xp as d_xp, s1.crp - s0.crp as d_crp,
       s1.cmp - s0.cmp as d_cmp, s1.cwo - s0.cwo as d_cwo,
       s1.granted as granted, s1.rows_seen as rows_seen
  from p2_pair p
  join p2_snap s0 on s0.tag = p.t0
  join p2_snap s1 on s1.tag = p.t1;

-- The measured principal and the statement's organization come from the fixture, never from a
-- literal typed here.
select v as p2_principal from ae4perf.fixture_meta where k = 'principal_id' \gset
select v as p2_org       from ae4perf.fixture_meta where k = 'target_org_id' \gset
select json_build_object('sub', :'p2_principal', 'role', 'authenticated',
                         'is_admin', false, 'active_role', 'staff_admin')::text as p2_claims \gset

-- ============================================================================
-- §0 — LIVENESS CALIBRATION. ⛔ A GATE, NOT A FORMALITY. One direct invocation of
-- `authz.assignment_facts` over M rows must move the counter by EXACTLY 1. Δ = 0 means the
-- counter is not accumulating or the flush did not happen; Δ = M means it is counting ROWS and
-- every number below is inflated M-fold. Both are VOID with a named remedy, never a number.
-- ============================================================================
do $$ begin perform pg_stat_force_next_flush(); end $$;
call pg_temp.p2_take('cal0');

select count(*) as p2_m_rows from authz.assignment_facts(:'p2_principal'::uuid) \gset

do $$ begin perform pg_stat_force_next_flush(); end $$;
call pg_temp.p2_take('cal1', null, :p2_m_rows);
insert into p2_pair values ('0 calibration', 'cal0', 'cal1');

insert into p2_result
select '0 calibration', 'authz.assignment_facts, one direct call over M rows',
       format('delta=%s over M=%s rows', d.d_af, d.rows_seen),
       case
         when d.d_af = 1                then format('CALIBRATED — the counter counts INVOCATIONS (delta=1 while M=%s)', d.rows_seen)
         when d.d_af = 0                then 'VOID — the counter did not move. REMEDY: the forced flush did not land, or track_functions is not on in THIS session. Nothing below may be read.'
         when d.d_af = d.rows_seen      then format('VOID — the counter moved by M (%s). It is counting ROWS, not invocations. REMEDY: re-key the instrument (pg_stat_statements with track=all, accepting that its reset is not transactional) or abandon the OID counter. ⛔ Do NOT divide by M.', d.rows_seen)
         else                                format('VOID — delta=%s, neither 1 nor M. The instrument is not understood; no number below may be read.', d.d_af)
       end
  from p2_delta d where d.arm = '0 calibration';

-- ============================================================================
-- §1 — DISCRIMINATION: THE CANDIDATE DIFFERENTIAL. ⛔ MUST FIRE.
-- Three arms, each a membership planted in a rolled-back transaction, each measured on a DIRECT
-- resolver call so the resolver is the only caller in the window:
--   A · a seat in an organization the principal does not yet reach, in an AUTHORIZING role
--       => one more proposal.        ΔU > 0, and the GRANTED count must move too.
--   B · a seat in an organization the principal ALREADY reaches
--       => the `distinct` collapses it.  ΔU = 0, so ΔA must be 0.
--       ⛔ Without this arm an instrument counting FACTS rather than INVOCATIONS passes anyway:
--          a fact was added, so a fact-counter moves, and `ΔA = ΔU` would still hold if U were
--          also fact-shaped. This is the arm where those two instruments disagree.
--   C · a seat in a THIRD organization in a NON-AUTHORIZING role (`staff` entails no
--       `org.professionals.read`) => ΔU > 0 while the GRANTED count does NOT move. This is what
--       proves the count tracks PROPOSALS, not grants.
-- Plus a plant-only control: the INSERT's own trigger cost is MEASURED and required to be zero,
-- never assumed, so the differential is attributable to the resolver and not to `trg_audit_memberships`.
--
-- The arm targets are selected from the live tree, not typed here. The selection query uses
-- `commissions.organization_id` to LOCATE a fixture; the verdict never assumes what ΔU will be —
-- it measures ΔU and requires both polarities to have actually occurred.
-- ============================================================================
create temp view p2_principal_orgs as
  select distinct o from (
    select c.organization_id as o
      from public.memberships m join public.commissions c on c.id = m.commission_id
     where m.principal_id = :'p2_principal'::uuid
    union all
    select m.organization_id
      from public.memberships m
     where m.principal_id = :'p2_principal'::uuid and m.organization_id is not null
  ) s where o is not null;

select
  (select c.id from public.commissions c
    where c.organization_id not in (select o from p2_principal_orgs)
    order by c.organization_id, c.id limit 1) as p2_arm_a,
  (select c.id from public.commissions c
    where c.organization_id in (select o from p2_principal_orgs)
      and c.id not in (select commission_id from public.memberships
                        where principal_id = :'p2_principal'::uuid and commission_id is not null)
    order by c.id limit 1) as p2_arm_b,
  (select c.id from public.commissions c
    where c.organization_id not in (select o from p2_principal_orgs)
    order by c.organization_id desc, c.id limit 1) as p2_arm_c
\gset

do $$ begin perform pg_stat_force_next_flush(); end $$;
call pg_temp.p2_take('s1_base0');
select count(*) as p2_g_base
  from authz.authorized_scope_ids(:'p2_principal'::uuid, 'organization', 'org.professionals.read') \gset
do $$ begin perform pg_stat_force_next_flush(); end $$;
call pg_temp.p2_take('s1_base1', :p2_g_base);
insert into p2_pair values ('1 baseline', 's1_base0', 's1_base1');

-- Plant-only control: the same INSERT, no resolver call.
begin;
  insert into public.memberships(id, principal_id, commission_id, role)
  values (gen_random_uuid(), :'p2_principal'::uuid, :'p2_arm_a'::uuid, 'staff_admin');
rollback;
do $$ begin perform pg_stat_force_next_flush(); end $$;
call pg_temp.p2_take('s1_plant');
insert into p2_pair values ('1 plant-only control', 's1_base1', 's1_plant');

-- Arm A — new organization, authorizing role.
begin;
  insert into public.memberships(id, principal_id, commission_id, role)
  values (gen_random_uuid(), :'p2_principal'::uuid, :'p2_arm_a'::uuid, 'staff_admin');
  select count(*) as p2_g_a
    from authz.authorized_scope_ids(:'p2_principal'::uuid, 'organization', 'org.professionals.read') \gset
rollback;
do $$ begin perform pg_stat_force_next_flush(); end $$;
call pg_temp.p2_take('s1_a', :p2_g_a);
insert into p2_pair values ('1a new org, authorizing', 's1_plant', 's1_a');

-- Arm B — organization already proposed; the `distinct` must absorb it.
do $$ begin perform pg_stat_force_next_flush(); end $$;
call pg_temp.p2_take('s1_b0');
begin;
  insert into public.memberships(id, principal_id, commission_id, role)
  values (gen_random_uuid(), :'p2_principal'::uuid, :'p2_arm_b'::uuid, 'staff_admin');
  select count(*) as p2_g_b
    from authz.authorized_scope_ids(:'p2_principal'::uuid, 'organization', 'org.professionals.read') \gset
rollback;
do $$ begin perform pg_stat_force_next_flush(); end $$;
call pg_temp.p2_take('s1_b', :p2_g_b);
insert into p2_pair values ('1b same org, delta-U must be 0', 's1_b0', 's1_b');

-- Arm C — new organization, NON-authorizing role.
do $$ begin perform pg_stat_force_next_flush(); end $$;
call pg_temp.p2_take('s1_c0');
begin;
  insert into public.memberships(id, principal_id, commission_id, role)
  values (gen_random_uuid(), :'p2_principal'::uuid, :'p2_arm_c'::uuid, 'staff');
  select count(*) as p2_g_c
    from authz.authorized_scope_ids(:'p2_principal'::uuid, 'organization', 'org.professionals.read') \gset
rollback;
do $$ begin perform pg_stat_force_next_flush(); end $$;
call pg_temp.p2_take('s1_c', :p2_g_c);
insert into p2_pair values ('1c new org, NON-authorizing', 's1_c0', 's1_c');

-- Scoring. ⛔ VERDICT PRECEDENCE: `ΔU > 0 and ΔA = 0` is VOID (a dead instrument), not FAIL —
-- the two are different findings and collapsing them loses the one that matters.
do $s1$
declare
  v_a_base bigint; v_u_base bigint; v_g_base bigint;
  r record; v_dda bigint; v_ddu bigint;
  v_pos int := 0; v_zero int := 0; v_propsonly int := 0;
begin
  select d_af, d_hp, granted into v_a_base, v_u_base, v_g_base from p2_delta where arm = '1 baseline';

  insert into p2_result values ('1 baseline',
    'direct resolver call, unplanted',
    format('A=%s  U=%s  granted=%s', v_a_base, v_u_base, v_g_base),
    case when v_a_base = 1 + v_u_base then 'CLEAR — A = 1 + U holds unplanted'
         else format('FAIL — A = %s but 1 + U = %s', v_a_base, 1 + v_u_base) end);

  select d_af, d_hp into v_dda, v_ddu from p2_delta where arm = '1 plant-only control';
  insert into p2_result values ('1 control',
    'the INSERT alone (trg_audit_memberships), no resolver call',
    format('dA=%s  dU=%s', v_dda, v_ddu),
    case when v_dda = 0 and v_ddu = 0
         then 'CLEAR — the plant itself moves NOTHING, so every arm delta below is the resolver''s'
         else format('VOID — the plant alone moved the counters (dA=%s, dU=%s); no arm delta is attributable to the resolver.', v_dda, v_ddu) end);

  for r in select * from p2_delta where arm ~ '^1[abc] ' order by arm loop
    v_dda := r.d_af - v_a_base;
    v_ddu := r.d_hp - v_u_base;
    if v_ddu > 0 then v_pos := v_pos + 1; else v_zero := v_zero + 1; end if;
    if v_ddu > 0 and r.granted = v_g_base then v_propsonly := v_propsonly + 1; end if;

    insert into p2_result values ('1 discrimination', r.arm,
      format('A=%s (ddA=%s)  U=%s (ddU=%s)  granted=%s (base %s)',
             r.d_af, v_dda, r.d_hp, v_ddu, r.granted, v_g_base),
      case
        when v_ddu > 0 and v_dda = 0
          then 'VOID — the candidate count moved and the invocation count did not. That is a DEAD INSTRUMENT, not a pass.'
        when v_dda <> v_ddu
          then format('FAIL — ddA (%s) <> ddU (%s): invocations are not one-for-one with proposals.', v_dda, v_ddu)
        when r.d_af <> 1 + r.d_hp
          then format('FAIL — the bound broke under the plant: A=%s, 1+U=%s.', r.d_af, 1 + r.d_hp)
        when v_ddu = 0 then 'CLEAR — no new proposal, no new invocation (the candidate `distinct` absorbed the fact)'
        when r.granted = v_g_base then 'CLEAR — one more PROPOSAL, one more invocation, and the GRANTED count did not move'
        else 'CLEAR — one more proposal, one more invocation, one more grant'
      end);
  end loop;

  insert into p2_result values ('1 coverage', 'both polarities of the differential must occur',
    format('arms with ddU>0: %s · arms with ddU=0: %s · arms proving proposals-not-grants: %s',
           v_pos, v_zero, v_propsonly),
    case
      when v_pos = 0    then 'VOID — no arm produced a new proposal; the differential never fired and §1 discriminates nothing.'
      when v_zero = 0   then 'VOID — no arm produced ddU = 0; an instrument counting FACTS rather than INVOCATIONS is not excluded.'
      when v_propsonly = 0 then 'VOID — no arm added a proposal WITHOUT adding a grant; the count is not shown to track proposals rather than grants.'
      else 'CLEAR — the differential fired in both directions and separated proposals from grants'
    end);
end
$s1$;

-- ============================================================================
-- §2 — N-DIFFERENTIAL (P2a). ΔA must not move when the protected-row count goes 200 -> 400.
-- ⛔ Measured on the ORG-FILTERED statement, so the policy's `ELSE` arm is `never executed` BY
-- CONSTRUCTION and cannot contaminate the count — and that is asserted here
-- (`d_crp = 0`), not assumed. Run 6's evidence came from the UNFILTERED `limit 200` statement,
-- where the ELSE arm did fire, four times.
-- ⛔ AND §2 SHIPS ITS OWN CONTROL, because "ΔA is the same at both N" is precisely the shape that
-- reads as a pass when nothing ran. The control re-installs the PRE-CHANGE per-row predicate in a
-- rolled-back transaction; there ΔA MUST differ between the two N. If it does not, §2 is VOID.
-- ============================================================================
do $$ begin perform pg_stat_force_next_flush(); end $$;
call pg_temp.p2_take('s2_200_0');
begin;
  set local role authenticated;
  set local request.jwt.claims = :'p2_claims';
  select count(*) as p2_n200 from (
    select id from public.professional_profiles where organization_id = :'p2_org'::uuid limit 200) t \gset
rollback;
do $$ begin perform pg_stat_force_next_flush(); end $$;
call pg_temp.p2_take('s2_200_1', null, :p2_n200);
insert into p2_pair values ('2 live N=200', 's2_200_0', 's2_200_1');

do $$ begin perform pg_stat_force_next_flush(); end $$;
call pg_temp.p2_take('s2_400_0');
begin;
  set local role authenticated;
  set local request.jwt.claims = :'p2_claims';
  select count(*) as p2_n400 from (
    select id from public.professional_profiles where organization_id = :'p2_org'::uuid limit 400) t \gset
rollback;
do $$ begin perform pg_stat_force_next_flush(); end $$;
call pg_temp.p2_take('s2_400_1', null, :p2_n400);
insert into p2_pair values ('2 live N=400', 's2_400_0', 's2_400_1');

-- CONTROL — the pre-change predicate, installed and rolled back, at both N.
do $$ begin perform pg_stat_force_next_flush(); end $$;
call pg_temp.p2_take('s2c_200_0');
begin;
  -- Shared local stack: fail fast rather than block another session's work indefinitely.
  set local lock_timeout = '15s';
  alter policy professional_profiles_select on public.professional_profiles
    using (app.can_read_professional_profile(id, ( select auth.uid() )));
  set local role authenticated;
  set local request.jwt.claims = :'p2_claims';
  select count(*) as p2_c200 from (
    select id from public.professional_profiles where organization_id = :'p2_org'::uuid limit 200) t \gset
rollback;
do $$ begin perform pg_stat_force_next_flush(); end $$;
call pg_temp.p2_take('s2c_200_1', null, :p2_c200);
insert into p2_pair values ('2 control N=200', 's2c_200_0', 's2c_200_1');

do $$ begin perform pg_stat_force_next_flush(); end $$;
call pg_temp.p2_take('s2c_400_0');
begin;
  -- Shared local stack: fail fast rather than block another session's work indefinitely.
  set local lock_timeout = '15s';
  alter policy professional_profiles_select on public.professional_profiles
    using (app.can_read_professional_profile(id, ( select auth.uid() )));
  set local role authenticated;
  set local request.jwt.claims = :'p2_claims';
  select count(*) as p2_c400 from (
    select id from public.professional_profiles where organization_id = :'p2_org'::uuid limit 400) t \gset
rollback;
do $$ begin perform pg_stat_force_next_flush(); end $$;
call pg_temp.p2_take('s2c_400_1', null, :p2_c400);
insert into p2_pair values ('2 control N=400', 's2c_400_0', 's2c_400_1');

-- Restoration proof for the policy, before anything is scored on it.
do $$
declare v_now text; v_was text;
begin
  select md5(pg_get_expr(polqual, polrelid)) into v_now from pg_policy
   where polrelid = 'public.professional_profiles'::regclass and polname = 'professional_profiles_select';
  select v into v_was from p2_baseline where k = 'policy_qual_md5';
  if v_now is distinct from v_was then
    raise exception 'AE4 P2 ROLLBACK FAILED: professional_profiles_select is NOT the shipped predicate (md5 % vs %). FIX THIS BEFORE ANYTHING ELSE.', v_now, v_was;
  end if;
  raise notice 'P2 §2 rollback OK — professional_profiles_select is the shipped predicate again.';
end $$;

do $s2$
declare a200 bigint; a400 bigint; u200 bigint; u400 bigint; crp200 bigint; crp400 bigint;
        r200 bigint; r400 bigint; c200 bigint; c400 bigint;
begin
  select d_af, d_hp, d_crp, rows_seen into a200, u200, crp200, r200 from p2_delta where arm = '2 live N=200';
  select d_af, d_hp, d_crp, rows_seen into a400, u400, crp400, r400 from p2_delta where arm = '2 live N=400';
  select d_af into c200 from p2_delta where arm = '2 control N=200';
  select d_af into c400 from p2_delta where arm = '2 control N=400';

  insert into p2_result values ('2 control',
    'pre-change per-row predicate: dA MUST move with N',
    format('dA(N=200)=%s  dA(N=400)=%s', c200, c400),
    case when c200 <> c400 then 'CONTROL FIRED — the probe is proven able to report an N-dependent count'
         else format('VOID — the control did not discriminate (both %s). "dA is flat" and "the probe is dead" are the same string here.', c200) end);

  insert into p2_result values ('2 row-independence (P2a)',
    'org-filtered statement, N = 200 -> 400',
    format('dA %s -> %s · U %s -> %s · rows %s -> %s · can_read_professional_profile %s / %s',
           a200, a400, u200, u400, r200, r400, crp200, crp400),
    case
      when r200 <> 200 or r400 <> 400
        then format('VOID — the fixture did not present the two row counts (%s / %s); N was never varied.', r200, r400)
      when crp200 <> 0 or crp400 <> 0
        then format('VOID — the ELSE arm executed (%s / %s calls). The measurement is contaminated by the row authorizer and is not about the resolver.', crp200, crp400)
      when a200 = a400 then 'CLEAR — invocations are independent of the protected-row count'
      else format('FAIL — dA moved with N (%s -> %s): the resolver is being re-entered per row.', a200, a400)
    end);
end
$s2$;

-- ============================================================================
-- §3 — THE BOUND, A = 1 + U. Evaluated on the direct call (§1's baseline) and on BOTH
-- org-filtered statements, where `authorized_scope_ids` must additionally have been entered
-- exactly ONCE (`d_asi = 1`) — the statement-scoped half of the claim.
-- ============================================================================
insert into p2_result
select '3 bound', d.arm,
       format('A=%s  U=%s  1+U=%s  authorized_scope_ids=%s', d.d_af, d.d_hp, 1 + d.d_hp, d.d_asi),
       case
         when d.d_asi <> 1
           then format('FAIL — the resolver was entered %s times, not once per statement.', d.d_asi)
         when d.d_af = 1 + d.d_hp
           then 'CLEAR — A = 1 + U'
         else format('FAIL — A = %s, 1 + U = %s.', d.d_af, 1 + d.d_hp)
       end
  from p2_delta d
 where d.arm in ('2 live N=200', '2 live N=400')
 order by d.arm;

-- ============================================================================
-- §4 — DECOMPOSITION. Run 6's `7` was seven real invocations of which only three were the
-- resolver. This section reproduces that statement (UNFILTERED `limit 200`, which is what run 6
-- captured) and closes the identity
--
--    ΔA = Δauthorized_scope_ids + Δentailed_grants + Δholds_role
--           + Δcandidate_authorized_scope_ids + Δexplain_permission
--
-- — the five catalog functions that enter `assignment_facts`. Any residual is reported as a
-- NAMED UNEXPLAINED TERM, never absorbed. ⛔ The identity is only as complete as that caller
-- list, so the list is checked against the catalog rather than trusted.
-- ============================================================================
do $$ begin perform pg_stat_force_next_flush(); end $$;
call pg_temp.p2_take('s4_0');
begin;
  set local role authenticated;
  set local request.jwt.claims = :'p2_claims';
  select count(*) as p2_unf from (select id from public.professional_profiles limit 200) t \gset
rollback;
do $$ begin perform pg_stat_force_next_flush(); end $$;
call pg_temp.p2_take('s4_1', null, :p2_unf);
insert into p2_pair values ('4 unfiltered limit 200', 's4_0', 's4_1');

insert into p2_result
select '4 caller completeness',
       'every catalog function that enters authz.assignment_facts is snapshotted',
       coalesce('uncovered: ' || string_agg(f, ', ' order by f), 'none uncovered'),
       case when count(*) = 0
            then 'CLEAR — the decomposition identity is complete against the catalog'
            else 'VOID — a caller of assignment_facts is outside the snapshot, so the residual below cannot be attributed.'
       end
  from (
    -- ⛔ Bounded on the PROPERTY (a persistent function whose body enters assignment_facts), not
    --    on a schema list, so a caller added in ANY persistent schema shows up. Temp schemas are
    --    excluded because this checker's own snapshot procedure names the function it counts —
    --    found by running it, first run 2026-09-03.
    select n.nspname || '.' || p.proname as f
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where p.prosrc like '%assignment_facts%'
       and n.nspname not like 'pg_temp%'
       and n.nspname not like 'pg_toast%'
       and p.oid <> 'authz.assignment_facts(uuid)'::regprocedure
       and p.oid not in (select sig::oid from p2_covered)
  ) t;

insert into p2_result
select '4 decomposition', d.arm,
       format('A=%s = asi %s + entailed_grants %s + holds_role %s + candidate_asi %s + explain_permission %s'
              ' || witnesses: has_permission %s · can_read_professional_profile %s · can_manage_professional %s'
              ' · current_professional_read_organizations %s',
              d.d_af, d.d_asi, d.d_eg, d.d_hr, d.d_cas, d.d_xp,
              d.d_hp, d.d_crp, d.d_cmp, d.d_cwo),
       case when d.d_af - (d.d_asi + d.d_eg + d.d_hr + d.d_cas + d.d_xp) = 0
            then format('CLEAR — residual 0. P2''s subject is the %s resolver entry plus its own confirmations; the remaining %s invocation(s) — the ELSE arm''s has_permission and holds_role — are REPORTED here and never folded into the bound.',
                        d.d_asi, d.d_af - d.d_asi - (select dd.d_hp from p2_delta dd where dd.arm = '2 live N=200'))
            else format('FAIL — UNEXPLAINED TERM of %s invocation(s): A=%s but the named callers account for %s.',
                        d.d_af - (d.d_asi + d.d_eg + d.d_hr + d.d_cas + d.d_xp),
                        d.d_af, d.d_asi + d.d_eg + d.d_hr + d.d_cas + d.d_xp)
       end
  from p2_delta d where d.arm = '4 unfiltered limit 200';

-- ============================================================================
-- REPORT
-- ============================================================================
\echo ''
\echo '=================== P2 INVOCATION-COUNT CHECKER (ADR 0183) ==================='
select section, subject, measured, verdict from p2_result order by section, subject;

\echo ''
\echo '--- raw deltas, as evidence ---'
select arm, d_af, d_hp, d_eg, d_hr, d_asi, d_crp, d_cmp, d_cwo, granted, rows_seen
  from p2_delta order by arm;

-- ============================================================================
-- POSTFLIGHT — every mutation above ran inside `begin … rollback`. Prove it.
-- ============================================================================
\echo ''
\echo '--- postflight: the stack must be unmutated ---'
do $post$
declare v_bad text := '';
begin
  if (select count(*) from public.memberships)::text
       is distinct from (select v from p2_baseline where k = 'memberships')
    then v_bad := v_bad || 'memberships count moved; '; end if;
  if (select count(*) from public.profiles)::text
       is distinct from (select v from p2_baseline where k = 'profiles')
    then v_bad := v_bad || 'profiles count moved; '; end if;
  if (select count(*) from public.organizations)::text
       is distinct from (select v from p2_baseline where k = 'organizations')
    then v_bad := v_bad || 'organizations count moved; '; end if;
  if (select md5(pg_get_expr(polqual, polrelid)) from pg_policy
       where polrelid = 'public.professional_profiles'::regclass
         and polname = 'professional_profiles_select')
       is distinct from (select v from p2_baseline where k = 'policy_qual_md5')
    then v_bad := v_bad || 'professional_profiles_select predicate NOT restored; '; end if;
  if (select md5(string_agg(prosrc, '|' order by oid)) from p2_chain)
       is distinct from (select v from p2_baseline where k = 'prosrc_md5')
    then v_bad := v_bad || 'a body on the assignment_facts chain was MUTATED and not restored; '; end if;

  if v_bad <> '' then
    raise exception 'AE4 P2 POSTFLIGHT FAILED: %. FIX THIS BEFORE ANYTHING ELSE — the local stack is not as this run found it.', v_bad;
  end if;
  raise notice 'P2 postflight OK — row counts, the policy predicate and every chain body are as this run found them.';
end
$post$;

-- ============================================================================
-- VERDICT. ⛔ VOID outranks FAIL: if a control did not fire, no bound below it may be read as a
-- pass, and reporting the bound's FAIL first would hide that nothing was measured.
-- ============================================================================
do $verdict$
declare v_void text; v_fail text;
begin
  select string_agg(format('[%s / %s] %s', section, subject, verdict), chr(10) || '  ')
    into v_void from p2_result where verdict like 'VOID%';
  if v_void is not null then
    raise exception E'P2 CHECKER VOID — nothing below the failed control may be read as a pass:\n  %', v_void
      using hint = 'Fix the instrument or the control, then re-run. A VOID run is re-run; it is never recorded as a pass.';
  end if;

  select string_agg(format('[%s / %s] %s', section, subject, verdict), chr(10) || '  ')
    into v_fail from p2_result where verdict like 'FAIL%';
  if v_fail is not null then
    raise exception E'P2 FAIL — the statement-scoped invocation bound does not hold:\n  %', v_fail;
  end if;

  raise notice 'P2 PASS — calibration Δ=1; the candidate differential fired in BOTH directions and separated proposals from grants; the N-differential control fired and A did not move with N; A = 1 + U at both N; the decomposition closes with residual 0.';
end
$verdict$;

reset track_functions;
