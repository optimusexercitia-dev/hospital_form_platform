-- QO·B M7 — the case-plane doors the ratified §4.4 list names and M4 never saw.
-- QA r1 BLOCKER-1 remediation (docs/reviews/phase-QO-B-review.md).
--
-- ADR 0100 D12; inventory §4.4, PO-ratified 2026-08-08 (KEEP exceptions per
-- rulings Q8/Q9: grant/revoke/list_case_access + set_case_visibility +
-- set_case_confidentiality; dispose_case_phi is explicitly CUT by Q9 and was
-- already cut by M4).
--
-- ⛔ WHY THIS EXISTS: M4 cut a PROXY population — "the functions carrying
-- app.assert_not_case_excluded" — and stated the substitution as fact. The
-- premise was false: that guard was applied by a DIFFERENT wave (A4 Unit 2) to
-- ITS enumeration, so every §4.4-listed door without it stayed armed. QA r1
-- proved the consequence by execution at BOTH tenancy tiers: orgadmin.a and
-- hospitaladmin.a1 each REMOVED a case participant (removed_at set) and WROTE a
-- case_recusals row; case_viewer_capabilities reported can_manage_lifecycle=true
-- over a case whose contents the principal cannot read. This session re-measured
-- before cutting: lift_recusal ADMITTED on a live recusal (QA's INFO-2 resolved
-- as a live leak, not an unknown), bulk_create_cases passes authority (23514 at
-- validation vs the cross-org control's 42501), create_case_from_template
-- correctly denies at its own gate (no tenancy arm there — its token is the
-- self-grant skip).
--
-- THE POPULATION IS THE RATIFIED LIST ITSELF, item by item — no proxy, no
-- inherited enumeration — plus two same-family doors the list's own text
-- omitted but QA measured live (add_case_participant, the sibling of the three
-- participant doors the list DOES name; bulk_create_cases, which composes
-- create_case_from_template and is on the wall's CUT side per D12). The
-- postcondition below asserts CORRESPONDENCE to the enumerated names, not a
-- count over a derivation.
--
-- ALSO IN THIS MIGRATION (QA r1 MAJOR-1): close_case / cancel_case /
-- set_case_outcome / update_case_narrative_body are INVOKER doors whose
-- authority admitted and whose DML then ran under RLS — for a principal who
-- passes authority but cannot SEE the row, they returned SUCCESS having written
-- NOTHING (measured: cancel_case as orgadmin.a → no exception, status
-- unchanged). Independent of the arm cut, each now RAISES its own not-found
-- (same message/code as its lookup — no existence oracle) when the terminal DML
-- touches zero rows. The reachable instance post-cut is an EXCLUDED
-- staff_admin: authority passes via the staff arm, RLS hides the row
-- (NOT is_case_excluded), and pre-M7 the door confirmed an action that never
-- happened.
--
-- MASKED TOKENS (QA r1 MINOR-1) are stripped rather than annotated:
-- get_case_detail's audit-branch coordinator test, list_my_cases' my_role
-- display chip, and the three case_events policy arms — every one sits inside a
-- conjunction with can_read_case / can_write_case_content, which A4 already
-- denies the tenancy admin, so each strip is behaviourally VOID today and
-- removes the token a future outer-predicate widening would silently arm. The
-- self-grant-skip tokens in create_case / create_case_from_template are cut for
-- the same reason (a bare tenancy admin never passes those doors' authority
-- gates, so the skip's tenancy disjunct is unreachable; the one behavioural
-- delta — a member-creator who is ALSO an org_admin now receives the same
-- creator self-grant as any other non-coordinator creator — is the CORRECT
-- post-wall behaviour: without it they would create a case they cannot read).
--
-- NOT touched, deliberately:
--   · the five Q8/Q9 KEEP doors (postcondition (b) pins each by name);
--   · create_case's authority gate (already staff/admin/member_can — QA method
--     note 1: its token was never the gate);
--   · reassign_phase, conclude_narrative, unassign_narrative,
--     update_case_custom_field_values, set_case_phase_result_override,
--     update_case_meta, reopen_case, create_interview, dispose_case_phi —
--     verified armless in the live catalog (M4 or born clean); the
--     postcondition covers them as part of the named CUT-side enumeration.

begin;

-- ---------------------------------------------------------------------------
-- 1. Cut the tenancy disjunct — BOTH variants (`is_commission_admin_of` and
--    `…_of_for`; the word-boundary lesson, §6.3) — from every armed door.
-- ---------------------------------------------------------------------------
do $$
declare
  r      record;
  v_src  text;
  v_new  text;
  v_cut  int := 0;
  v_targets text[] := array[
    -- §4.4-listed, armed at authority (QA r1 BLOCKER-1 population):
    'remove_case_participant','set_case_participant_role','set_primary_subject',
    'record_recusal','lift_recusal','schedule_ethics_hearing',
    'delete_ad_hoc_case_narrative','delete_ad_hoc_case_phase',
    'case_tag_report','case_viewer_capabilities',
    'close_case','cancel_case','set_case_outcome','update_case_narrative_body',
    -- same-family doors the list's text omitted, measured live:
    'add_case_participant','bulk_create_cases',
    -- masked tokens, stripped (MINOR-1 + the self-grant skips):
    'get_case_detail','list_my_cases','create_case','create_case_from_template'];
begin
  for r in
    select p.oid, p.proname from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
      and p.proname = any(v_targets)
    order by p.proname
  loop
    v_src := pg_get_functiondef(r.oid);
    v_new := regexp_replace(v_src,
      '\s+or\s+app\.is_commission_admin_of(_for)?\((?:[^()]|\([^()]*\))*\)', '', 'g');
    v_new := regexp_replace(v_new,
      'app\.is_commission_admin_of(_for)?\((?:[^()]|\([^()]*\))*\)\s+or\s+', '', 'g');
    if v_new = v_src then
      raise exception 'QO·B M7: removal matched NOTHING in %() — refusing to no-op silently.', r.proname;
    end if;
    if regexp_replace(regexp_replace(v_new, '/\*.*?\*/', ' ', 'gs'), '--[^'||chr(10)||']*', ' ', 'g')
       ~ 'is_commission_admin_of' then
      raise exception 'QO·B M7: %() still routes the tenancy admin — the cut is partial.', r.proname;
    end if;
    execute v_new;
    v_cut := v_cut + 1;
  end loop;
  if v_cut <> 20 then
    raise exception 'QO·B M7: expected to edit 20 functions, edited % — a target is missing from the catalog.', v_cut;
  end if;
  raise notice 'QO·B M7: tenancy disjunct removed from % case-plane functions', v_cut;
end $$;

-- ---------------------------------------------------------------------------
-- 2. MAJOR-1 — the four INVOKER doors raise their own not-found when the
--    terminal DML touches zero rows (RLS hid the row from an authority-passing
--    caller). Message/code copied from each door's lookup raise: not-found and
--    not-visible stay ONE indistinguishable denial.
-- ---------------------------------------------------------------------------
do $$
declare
  v_src text;
  v_new text;
begin
  -- cancel_case + close_case share the cases-update → case_phases-update shape.
  v_src := pg_get_functiondef('public.cancel_case(uuid)'::regprocedure);
  v_new := replace(v_src,
    E'  returning * into v_result;\n\n  update public.case_phases',
    E'  returning * into v_result;\n  if v_result.id is null then\n'
    || E'    raise exception ''caso % não encontrado'', p_case_id using errcode = ''no_data_found'';\n'
    || E'  end if;\n\n  update public.case_phases');
  if v_new = v_src then
    raise exception 'QO·B M7: cancel_case zero-row guard anchor not found — re-read the body.';
  end if;
  execute v_new;

  v_src := pg_get_functiondef('public.close_case(uuid)'::regprocedure);
  v_new := replace(v_src,
    E'  returning * into v_result;\n\n  update public.case_phases',
    E'  returning * into v_result;\n  if v_result.id is null then\n'
    || E'    raise exception ''caso % não encontrado'', p_case_id using errcode = ''no_data_found'';\n'
    || E'  end if;\n\n  update public.case_phases');
  if v_new = v_src then
    raise exception 'QO·B M7: close_case zero-row guard anchor not found — re-read the body.';
  end if;
  execute v_new;

  v_src := pg_get_functiondef('public.set_case_outcome(uuid,uuid)'::regprocedure);
  v_new := replace(v_src,
    E'  returning * into v_result;\n\n  return v_result;',
    E'  returning * into v_result;\n  if v_result.id is null then\n'
    || E'    raise exception ''caso % não encontrado'', p_case_id using errcode = ''no_data_found'';\n'
    || E'  end if;\n\n  return v_result;');
  if v_new = v_src then
    raise exception 'QO·B M7: set_case_outcome zero-row guard anchor not found — re-read the body.';
  end if;
  execute v_new;

  v_src := pg_get_functiondef('public.update_case_narrative_body(uuid,text)'::regprocedure);
  v_new := replace(v_src,
    E'  returning * into v_result;\n  perform set_config(''app.in_narrative_rpc'', ''off'', true);',
    E'  returning * into v_result;\n  perform set_config(''app.in_narrative_rpc'', ''off'', true);\n'
    || E'  if v_result.id is null then\n'
    || E'    raise exception ''narrativa % não encontrada'', p_narrative_id using errcode = ''no_data_found'';\n'
    || E'  end if;');
  if v_new = v_src then
    raise exception 'QO·B M7: update_case_narrative_body zero-row guard anchor not found — re-read the body.';
  end if;
  execute v_new;

  raise notice 'QO·B M7: zero-row not-found guards installed on the 4 INVOKER doors';
end $$;

-- ---------------------------------------------------------------------------
-- 3. case_events — strip the masked tenancy arm from the three policies that
--    carry it (each sits behind can_read_case / can_write_case_content, so the
--    strip is void today and disarms a future widening).
-- ---------------------------------------------------------------------------
do $$
declare
  v_expr text;
  v_new  text;
begin
  select pg_get_expr(polqual, polrelid) into v_expr
    from pg_policy where polname = 'case_events_select';
  v_new := replace(v_expr, ' OR app.is_commission_admin_of(app.commission_of_case(case_id))', '');
  if v_new = v_expr then
    raise exception 'QO·B M7: case_events_select arm not found — re-read the qual.';
  end if;
  execute format('alter policy case_events_select on public.case_events using (%s)', v_new);

  select pg_get_expr(polwithcheck, polrelid) into v_expr
    from pg_policy where polname = 'case_events_writer_insert';
  v_new := replace(v_expr, ' OR app.is_commission_admin_of(app.commission_of_case(case_id))', '');
  if v_new = v_expr then
    raise exception 'QO·B M7: case_events_writer_insert arm not found — re-read the with_check.';
  end if;
  execute format('alter policy case_events_writer_insert on public.case_events with check (%s)', v_new);

  select pg_get_expr(polwithcheck, polrelid) into v_expr
    from pg_policy where polname = 'case_events_writer_update';
  v_new := replace(v_expr, ' OR app.is_commission_admin_of(app.commission_of_case(case_id))', '');
  if v_new = v_expr then
    raise exception 'QO·B M7: case_events_writer_update arm not found — re-read the with_check.';
  end if;
  execute format('alter policy case_events_writer_update on public.case_events with check (%s)', v_new);

  raise notice 'QO·B M7: masked tenancy arm stripped from 3 case_events policies';
end $$;

-- ---------------------------------------------------------------------------
-- 4. Postconditions — CORRESPONDENCE TO THE RATIFIED LIST, names enumerated.
--    (QA r1: M4's count-shaped postcondition validated the proxy, not the
--    list; a count cannot fail on a wrong population.)
-- ---------------------------------------------------------------------------
do $$
declare
  v_bad  text;
  v_n    int;
  -- §4.4 as ratified, MINUS the five Q8/Q9 KEEPs, PLUS the two measured
  -- same-family doors. Every name on this list must exist and carry NO
  -- tenancy token (either variant) in its comment-stripped body.
  v_cutside text[] := array[
    'update_case_meta','create_case','create_case_from_template','close_case',
    'cancel_case','reopen_case','update_case_custom_field_values',
    'conclude_narrative','unassign_narrative','update_case_narrative_body',
    'delete_ad_hoc_case_narrative','delete_ad_hoc_case_phase','reassign_phase',
    'set_case_phase_result_override','set_case_participant_role',
    'remove_case_participant','set_primary_subject','set_case_outcome',
    'record_recusal','lift_recusal','create_interview','schedule_ethics_hearing',
    'get_case_detail','list_my_cases','case_viewer_capabilities',
    'case_tag_report','dispose_case_phi',
    'add_case_participant','bulk_create_cases'];
  v_keeps text[] := array[
    'grant_case_access','revoke_case_access','list_case_access',
    'set_case_visibility','set_case_confidentiality'];
begin
  -- (a) CUT side: no name may carry the token.
  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
    and p.proname = any(v_cutside)
    and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
        ~ 'is_commission_admin_of';
  if v_bad is not null then
    raise exception 'QO·B M7 postcondition (a): §4.4 CUT-side door still carries the tenancy token: %', v_bad;
  end if;

  -- (b) NON-VACUITY: all 29 CUT-side names exist (a renamed door would make (a)
  --     pass over its absence).
  select count(distinct p.proname) into v_n from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
     and p.proname = any(v_cutside);
  if v_n <> 29 then
    raise exception 'QO·B M7 postcondition (b) VACUOUS: expected 29 CUT-side doors in the catalog, found %', v_n;
  end if;

  -- (c) KEEP side: every ratified KEEP still carries its arm (over-cut guard).
  select string_agg(k.name, ', ') into v_bad
  from unnest(v_keeps) as k(name)
  where not exists (
    select 1 from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = k.name
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ 'is_commission_admin_of');
  if v_bad is not null then
    raise exception 'QO·B M7 postcondition (c): ratified KEEP door LOST its tenancy arm (over-cut): %', v_bad;
  end if;

  -- (d) case_events: no policy on the table carries the token any more.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'case_events'
      and coalesce(qual,'') || ' ' || coalesce(with_check,'') ~ 'is_commission_admin_of'
  ) then
    raise exception 'QO·B M7 postcondition (d): a case_events policy still carries the tenancy arm.';
  end if;

  -- (e) MAJOR-1 guards present: each INVOKER door carries the zero-row raise.
  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname in ('close_case','cancel_case','set_case_outcome','update_case_narrative_body')
    and p.prosrc !~ 'v_result\.id is null';
  if v_bad is not null then
    raise exception 'QO·B M7 postcondition (e): zero-row guard missing on: %', v_bad;
  end if;
end $$;

commit;
