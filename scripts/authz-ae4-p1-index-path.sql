-- AE4 / IA-F9 — P1's INSTRUMENT, as re-specified by ADR 0181 (PO ruling 2026-09-02).
--
-- P1 asks whether any of four tables on the authorization chain is reached by a sequential
-- scan whose cost grows with the table. Its ORIGINAL form bound the token `Seq Scan`, which
-- is a different predicate: on a 2-page table a sequential scan is what a correct planner
-- chooses, and it self-corrects to an index as the table grows. Both wordings are in the
-- acceptance doc §6.1; the measured crossover that separates them is §12.2.
--
-- THE PROPERTY, and why enable_seqscan=off measures it. `enable_seqscan=off` does not FORBID
-- a sequential scan, it prices one punitively. So a scan that SURVIVES it is one the planner
-- has no alternative to — no index can serve the predicate — and it can NEVER self-correct,
-- however large the table becomes. That is the regression F9 predicts. A scan that disappears
-- under it is a size-driven CHOICE the planner will revisit on its own as rows accumulate.
--
-- ⚠ WHAT THIS DOES NOT PROVE, stated rather than left implicit: that an index path EXISTS is
-- not that the planner will CHOOSE it at production scale. Those come apart in principle. For
-- `public.hospitals` they were measured separately and do not come apart in fact — the arm
-- flips to the index at 620 rows / 9 pages (§12.2). For any NEW table this instrument clears,
-- that crossover is owed as its own measurement and may not be inherited from this one.
--
-- ⛔ THE VACUITY CONTROL IS PART OF THE CHECK, not an optional extra. A probe that can only
-- ever print CLEAR is worth nothing, and "no scan survived" and "the probe is broken" are the
-- same string. §0 builds a deliberately index-less copy and REQUIRES a surviving scan; if it
-- does not fire, §1 raises VOID and no verdict below it may be read.
--
-- Run:  docker exec -i supabase_db_azkbbhskturikxpgmafq \
--         psql -U postgres -d postgres -X -f - < scripts/authz-ae4-p1-index-path.sql
-- Exit: 0 = every probe CLEAR (P1 passes) · 3 = a scan SURVIVED (P1 fails), or the control
--       did not fire (VOID). ⛔ Read the exit code DIRECTLY; a pipe erases it.

\set ON_ERROR_STOP on
\pset pager off
\timing off

create temp table p1_result(section text, subject text, node_type text, verdict text);

-- The probe. Returns the plan captured under enable_seqscan=off, as JSON, so the verdict is
-- read off a structured "Node Type" rather than scraped out of formatted text.
create function pg_temp.p1_probe(p_section text, p_subject text, p_sql text)
returns void language plpgsql as $probe$
declare
  v_plan json;
  v_top  text;
  v_seq  boolean;
begin
  execute 'explain (generic_plan, format json) ' || p_sql into v_plan;
  v_top := v_plan->0->'Plan'->>'Node Type';
  -- Search the WHOLE tree, not just the root: a sequential scan can sit under a subplan.
  v_seq := v_plan::text like '%"Node Type": "Seq Scan"%';
  insert into p1_result values (
    p_section, p_subject, v_top,
    case
      when p_section = '0 control' and v_seq then 'SURVIVES (control FIRED — the probe is live)'
      when p_section = '0 control'           then 'no scan (⛔ CONTROL DID NOT FIRE — §1 is VOID)'
      when v_seq                             then 'SURVIVES — no index path (P1 FAIL)'
      else                                        'CLEAR — an index path exists'
    end);
end
$probe$;

set enable_seqscan = off;

-- ============================================================================
-- §0 — VACUITY CONTROL. An exact copy of public.hospitals carrying NO index at all.
-- The probe MUST report a surviving Seq Scan here, or it cannot report one anywhere.
-- (A temp copy rather than dropping the real constraints: hospitals_pkey cascades to 13
-- foreign keys, and a control should not need a 13-object blast radius to prove a grep.
-- ⭐ The stronger form — dropping the REAL indexes in a rolled-back transaction — was run
-- once by hand on 2026-09-02 and also produced a surviving Seq Scan; ADR 0181.)
-- ============================================================================
create temp table p1_noindex as select * from public.hospitals;
analyze p1_noindex;
select pg_temp.p1_probe('0 control', 'p1_noindex (no index by construction)',
  'select organization_id from p1_noindex where id = $1');

-- ============================================================================
-- §1 — THE FOUR TABLES P1 NAMES, on the access predicates the chain actually uses.
-- ⚠ These predicates are transcribed from run 5's nested region (acceptance doc §12):
--   hospitals   authz.scope_reaches, organization<-hospital arm ...... where h.id = $1
--   commissions authz.scope_reaches, the ascent + hospital<-commission  where c.id = $1
--   memberships authz.assignment_facts .............................. where principal_id = $1
--   profiles    authz.assignment_facts, platform_admin arm ........... where p.id = $1
-- If the chain's access shape changes, these are owed a re-derivation from the nested
-- region — they are a transcription of a measurement, not a standing list.
-- ============================================================================
select pg_temp.p1_probe('1 hospitals',   'scope_reaches organization<-hospital',
  'select h.organization_id from public.hospitals h where h.id = $1');
select pg_temp.p1_probe('1 commissions', 'scope_reaches ascent / hospital<-commission',
  'select c.organization_id from public.commissions c where c.id = $1');
select pg_temp.p1_probe('1 memberships', 'assignment_facts by principal',
  'select m.role from public.memberships m where m.principal_id = $1');
select pg_temp.p1_probe('1 profiles',    'assignment_facts platform_admin arm',
  'select p.is_admin from public.profiles p where p.id = $1');

reset enable_seqscan;

\echo ''
\echo '=================== P1 INDEX-PATH PROBE (ADR 0181) ==================='
select section, subject, node_type, verdict from p1_result order by section, subject;

do $verdict$
declare
  v_control_fired boolean;
  v_survivors     text;
begin
  select verdict like 'SURVIVES%' into v_control_fired from p1_result where section = '0 control';

  if v_control_fired is not true then
    raise exception
      'P1 PROBE VOID — the vacuity control did not fire, so a CLEAR verdict is indistinguishable from a broken probe.'
      using hint = 'Nothing in section 1 may be read as a pass. Fix the probe, then re-run.';
  end if;

  select string_agg(subject, ', ') into v_survivors
    from p1_result where section <> '0 control' and verdict like 'SURVIVES%';

  if v_survivors is not null then
    raise exception 'P1 FAIL — a Seq Scan survives enable_seqscan=off (no index path) on: %', v_survivors;
  end if;

  raise notice
    'P1 PASS — the control FIRED, and each of the four chain tables has an index path for its measured predicate.';
end
$verdict$;
