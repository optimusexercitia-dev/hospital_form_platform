-- pgTAP — BE-4 voided blocks-sweep + reopen_case + retire reopen_narrative.
--
-- K1 a voided phase SETTLES a blocking dependency (activate downstream succeeds).
--    (MUTATION: revert activate_phase's blocks predicate → K1 red.)
-- K2 voided is terminal — no transition out (guard rejects even under in_case_rpc).
-- K3 reopen_case: completed → recomputed open status; closed_* nulled; outcome
--    preserved; the case becomes correctable (file_correction_request succeeds).
-- K4 reopen edges: cancelled HC0M8, non-admin 42501, blank reason (23514), excluded
--    HC0F1, flag-off HC000 (distinct from the 23514 invalid-state paths — MINOR-2).
-- K5 case_narrative_revisions append-only (UPDATE/DELETE blocked).
--    (MUTATION: drop guard_case_narrative_revisions_append_only_trg → K5 red.)
-- K6 reopen_narrative is gone.
--
-- Fixture-flag lesson: case_corrections enabled explicitly.
--
-- Assertion count: 21

begin;
select plan(21);

update app.feature_flags set enabled = true
  where key in ('case_corrections', 'cases_multi_phase', 'cases_extras',
                'case_phase_results', 'case_narratives', 'audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid  as sa_x,  (v->>'st_x')::uuid  as st_x,
         (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

create temp table fx on commit drop as
  select gen_random_uuid() as form_id, gen_random_uuid() as ver_id,
         gen_random_uuid() as sec_id, gen_random_uuid() as chk_id;
grant select on fx to authenticated;
do $$
declare v_form uuid; v_ver uuid; v_sec uuid; v_chk uuid; v_comm uuid; v_sa uuid;
begin
  select form_id, ver_id, sec_id, chk_id into v_form, v_ver, v_sec, v_chk from fx;
  select comm_x, sa_x into v_comm, v_sa from k;
  insert into public.forms (id, commission_id, title, created_by) values (v_form, v_comm, 'Reopen', v_sa);
  insert into public.form_versions (id, form_id, version_number, status) values (v_ver, v_form, 1, 'draft');
  insert into public.form_sections (id, form_version_id, position, is_default) values (v_sec, v_ver, 0, true);
  insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
    values (v_chk, v_sec, 0, 'checkbox', 'chk', 'Marque', false);
  insert into public.form_item_options (item_id, position, code, label) values (v_chk, 0, 'a', 'A');
  perform public.publish_form_version(v_ver);
end $$;

-- Helpers: a fresh in_review case; a completed phase (active→submit → sync completes it).
create function pg_temp.mk_case(p_num int) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into public.cases (id, commission_id, case_number, status, created_by)
    values (v_id, (select comm_x from k), p_num, 'in_review', (select sa_x from k));
  return v_id;
end $$;

create function pg_temp.mk_completed_phase(p_case uuid, p_pos int, p_blocks int[]) returns uuid
language plpgsql as $$
declare v_ph uuid := gen_random_uuid(); v_r uuid := gen_random_uuid();
begin
  insert into public.case_phases
    (id, case_id, position, form_id, form_version_id, title, status, assigned_to, is_ad_hoc, emits_result, blocks)
    values (v_ph, p_case, p_pos, (select form_id from fx), (select ver_id from fx), 'Fase '||p_pos,
            'active', (select st_x from k), true, false, coalesce(p_blocks, '{}'));
  insert into public.responses (id, form_version_id, commission_id, created_by, status, case_phase_id)
    values (v_r, (select ver_id from fx), (select comm_x from k), (select st_x from k), 'in_progress', v_ph);
  perform test_helpers.add_selection(v_r, (select chk_id from fx), array['a']);
  update public.responses set status = 'submitted', submitted_at = now() where id = v_r;  -- sync completes
  return v_ph;
end $$;

-- ===========================================================================
-- K1 · a voided phase SETTLES a blocking dependency.
-- ===========================================================================
create temp table c1 on commit drop as select pg_temp.mk_case(950001) as case_id;
grant select on c1 to authenticated;
create temp table c1p on commit drop as
  select pg_temp.mk_completed_phase((select case_id from c1), 1, null) as phase_a;
grant select on c1p to authenticated;
-- phase B (pending) at position 2 blocked on A (position 1; blocks are 1-based).
create temp table c1b on commit drop as select gen_random_uuid() as phase_b;
grant select on c1b to authenticated;
do $$ begin
  insert into public.case_phases
    (id, case_id, position, form_id, form_version_id, title, status, is_ad_hoc, emits_result, blocks)
    values ((select phase_b from c1b), (select case_id from c1), 2, (select form_id from fx),
            (select ver_id from fx), 'Fase B', 'pending', true, false, array[1]);
end $$;
-- Void A via the door flow.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.file_correction_request('void', (select phase_a from c1p), null, 'anular', 'substantive', null);
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.approve_correction(
  (select id from public.case_correction_requests where case_phase_id = (select phase_a from c1p)), null);
reset role;
select is((select status from public.case_phases where id = (select phase_a from c1p)), 'voided',
  'K1: phase A is voided via the door');
-- Activate B: A being voided settles the block (MUTATION: revert the sweep → HC018).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.activate_phase(%L, %L, null) $$, (select phase_b from c1b), (select st_x from k)),
  'K1: a voided blocking phase lets the downstream phase activate (sweep works)');
reset role;

-- ===========================================================================
-- K2 · voided is terminal — no transition out (guard rejects even under in_case_rpc).
-- ===========================================================================
select throws_ok($$
  do $inner$ begin
    perform set_config('app.in_case_rpc','on',true);
    update public.case_phases set status = 'active' where id = (select phase_a from c1p);
    perform set_config('app.in_case_rpc','off',true);
  end $inner$; $$,
  '23514', null, 'K2: a voided phase cannot transition back (un-void impossible)');

-- ===========================================================================
-- K3 · reopen_case: completed → open, closed_* nulled, outcome preserved, correctable.
-- ===========================================================================
create temp table c3 on commit drop as select pg_temp.mk_case(950003) as case_id;
grant select on c3 to authenticated;
create temp table c3p on commit drop as
  select pg_temp.mk_completed_phase((select case_id from c3), 0, null) as phase_a;
grant select on c3p to authenticated;
-- set an outcome (direct: a real case_outcomes row + outcome_id on the open case).
create temp table oc on commit drop as select gen_random_uuid() as oid;
grant select on oc to authenticated;
do $$ begin
  insert into public.case_outcomes (id, commission_id, label, color_token, requires_action_plan, is_adverse, position)
    values ((select oid from oc), (select comm_x from k), 'Desfecho', 'green', false, false, 0);
  update public.cases set outcome_id = (select oid from oc) where id = (select case_id from c3);
end $$;
-- close it.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.close_case((select case_id from c3));
reset role;
-- reopen it.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.reopen_case((select case_id from c3), 'nova evidência');
reset role;
select ok((select status from public.cases where id = (select case_id from c3)) not in ('completed','cancelled'),
  'K3: reopen_case moves the case out of the terminal state');
select is((select closed_at from public.cases where id = (select case_id from c3)), null,
  'K3: reopen_case nulls closed_at');
select is((select closed_by from public.cases where id = (select case_id from c3)), null,
  'K3: reopen_case nulls closed_by');
select is((select outcome_id from public.cases where id = (select case_id from c3)), (select oid from oc),
  'K3: reopen_case preserves outcome_id');
-- the case is now correctable.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.file_correction_request('correction', %L, null, 'corrigir', 'clerical', null) $$,
    (select phase_a from c3p)),
  'K3: a reopened case is correctable (file_correction_request succeeds)');
reset role;

-- ===========================================================================
-- K4 · reopen edges.
-- ===========================================================================
-- cancelled → HC0M8.
create temp table c4x on commit drop as select pg_temp.mk_case(950004) as case_id;
grant select on c4x to authenticated;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.cancel_case((select case_id from c4x));
select throws_ok(
  format($$ select public.reopen_case(%L, 'x') $$, (select case_id from c4x)),
  'HC0M8', null, 'K4: reopen_case on a cancelled case is refused (HC0M8 terminal-forever)');
reset role;

-- a completed case reused for the non-mutating negatives.
create temp table c4c on commit drop as select pg_temp.mk_case(950005) as case_id;
grant select on c4c to authenticated;
select pg_temp.mk_completed_phase((select case_id from c4c), 0, null);
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.close_case((select case_id from c4c));
reset role;
-- non-admin → 42501.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.reopen_case(%L, 'x') $$, (select case_id from c4c)),
  '42501', null, 'K4: a non-admin cannot reopen (42501)');
reset role;
-- blank reason → error.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.reopen_case(%L, '   ') $$, (select case_id from c4c)),
  '23514', null, 'K4: a blank reason is refused');
reset role;
-- flag OFF → HC000 (feature-disabled sentinel; distinct from the blank-reason 23514
-- just above — MINOR-2).
update app.feature_flags set enabled = false where key = 'case_corrections';
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.reopen_case(%L, 'x') $$, (select case_id from c4c)),
  'HC000', null, 'K4: reopen_case refused (HC000) when the flag is OFF');
reset role;
update app.feature_flags set enabled = true where key = 'case_corrections';
-- excluded admin → HC0F1 (sa_x still holds staff_admin → reaches the exclusion gate).
insert into public.case_recusals (case_id, user_id, source)
  select case_id, (select sa_x from k), 'coordinator' from c4c;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.reopen_case(%L, 'x') $$, (select case_id from c4c)),
  'HC0F1', null, 'K4: an excluded coordinator cannot reopen (HC0F1)');
reset role;

-- ===========================================================================
-- K5 · case_narrative_revisions is append-only (UPDATE/DELETE blocked).
-- ===========================================================================
create temp table c5 on commit drop as select pg_temp.mk_case(950006) as case_id, gen_random_uuid() as narr_id,
       gen_random_uuid() as rev_id;
grant select on c5 to authenticated;
do $$ begin
  perform set_config('app.in_narrative_rpc','on',true);
  insert into public.case_narratives (id, case_id, type_label, display_position, is_expected, is_ad_hoc,
    body_md, assigned_to, status, created_by)
    values ((select narr_id from c5), (select case_id from c5), 'Relato', 0, true, false,
            'corpo', (select st_x from k), 'completed', (select sa_x from k));
  perform set_config('app.in_narrative_rpc','off',true);
  -- append a revision (guard requires app.in_correction_rpc for INSERT).
  perform set_config('app.in_correction_rpc','on',true);
  insert into public.case_narrative_revisions (id, case_narrative_id, revision_number, body_md, snapshotted_by)
    values ((select rev_id from c5), (select narr_id from c5), 1, 'corpo antigo', (select sa_x from k));
  perform set_config('app.in_correction_rpc','off',true);
end $$;
select throws_ok(
  format($$ update public.case_narrative_revisions set body_md = 'hack' where id = %L $$, (select rev_id from c5)),
  '23514', null, 'K5: UPDATE on a narrative revision is blocked (append-only)');
select throws_ok(
  format($$ delete from public.case_narrative_revisions where id = %L $$, (select rev_id from c5)),
  '23514', null, 'K5: DELETE on a narrative revision is blocked (append-only)');

-- ===========================================================================
-- K6 · reopen_narrative is gone.
-- ===========================================================================
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'reopen_narrative'),
  0, 'K6: public.reopen_narrative no longer exists');

-- ===========================================================================
-- K7 · case_reopenings: durable reason persisted; append-only; door-only writes.
-- ===========================================================================
-- K3 reopened c3 with reason 'nova evidência' — it must be recorded.
select is(
  (select reason from public.case_reopenings where case_id = (select case_id from c3)),
  'nova evidência', 'K7: reopen_case persists the durable reason into case_reopenings');

-- a direct INSERT as an authenticated case reader is refused (no write grant).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ insert into public.case_reopenings (case_id, reason, reopened_by) values (%L, 'x', %L) $$,
    (select case_id from c3), (select sa_x from k)),
  '42501', null, 'K7: a direct INSERT by an authenticated user is refused (no write grant)');
reset role;

-- a service-role INSERT WITHOUT the reopen flag is refused by the write guard.
select throws_ok(
  format($$ insert into public.case_reopenings (case_id, reason, reopened_by) values (%L, 'x', null) $$,
    (select case_id from c3)),
  '23514', null, 'K7: a service-role INSERT without app.in_reopen_rpc is refused (write guard)');

-- append-only: UPDATE and DELETE are blocked (service-role).
select throws_ok(
  format($$ update public.case_reopenings set reason = 'hack' where case_id = %L $$, (select case_id from c3)),
  '23514', null, 'K7: UPDATE on a reopening record is blocked (append-only)');
select throws_ok(
  format($$ delete from public.case_reopenings where case_id = %L $$, (select case_id from c3)),
  '23514', null, 'K7: DELETE on a reopening record is blocked (append-only)');

select * from finish();
rollback;
