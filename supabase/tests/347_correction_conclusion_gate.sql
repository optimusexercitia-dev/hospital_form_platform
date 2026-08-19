-- pgTAP — the correction conclusion gate (HC0T0) + corrector attribution on
-- `list_my_cases`. Covers the two doors rewritten by
-- `20260930000000_correction_conclusion_gate_and_attribution.sql`.
--
-- The shape of this suite is deliberate. A gate that refuses is worth nothing until
-- you have also shown it PERMITS: "close_case threw" is equally consistent with
-- "the fixture was never closable in the first place". So the sweep is DIFFERENTIAL
-- throughout —
--   K0  closes the identical fixture with NO request      (the fixture is closable),
--   K1  flips ONE column (the request's status) through the five open statuses and
--       requires red each time, then flips it to `withdrawn` and requires green on
--       THE SAME case, phases untouched,
--   K2  requires green on `approved`,
--   K5  turns the flag off and requires green with the request still open.
-- The request status is therefore the only thing that ever varies, which is what
-- makes the reds attributable to it.
--
-- `rejected` is asserted RED on purpose: it is a RESTING state the corrector
-- resumes from, not a resolution. The only two resolutions are `approved` and
-- `withdrawn`, and they are the two the suite requires green.
--
-- Fixture-flag lesson (263/264): `case_corrections` and `cases_multi_phase` are
-- enabled explicitly — a missing flag-enable SKIPS keystones silently.
--
-- Assertion count: 15

begin;
select plan(15);

update app.feature_flags set enabled = true
  where key in ('case_corrections', 'cases_multi_phase', 'cases_extras',
                'case_phase_results', 'audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x, (v->>'st_x')::uuid as st_x,
         (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- Shared published form (one optional checkbox — the content is irrelevant here;
-- what matters is that a phase can reach `completed` with a submitted response).
create temp table fx on commit drop as
  select gen_random_uuid() as form_id, gen_random_uuid() as ver_id,
         gen_random_uuid() as sec_id, gen_random_uuid() as chk_id;
grant select on fx to authenticated;
do $$
declare v_form uuid; v_ver uuid; v_sec uuid; v_chk uuid; v_comm uuid; v_sa uuid;
begin
  select form_id, ver_id, sec_id, chk_id into v_form, v_ver, v_sec, v_chk from fx;
  select comm_x, sa_x into v_comm, v_sa from k;
  insert into public.forms (id, commission_id, title, created_by)
    values (v_form, v_comm, 'Conclusão x Correção', v_sa);
  insert into public.form_versions (id, form_id, version_number, status)
    values (v_ver, v_form, 1, 'draft');
  insert into public.form_sections (id, form_version_id, position, is_default)
    values (v_sec, v_ver, 0, true);
  insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
    values (v_chk, v_sec, 0, 'checkbox', 'chk', 'Marque', false);
  insert into public.form_item_options (item_id, position, code, label) values
    (v_chk, 0, 'a', 'A'), (v_chk, 1, 'b', 'B');
  perform public.publish_form_version(v_ver);
end $$;

-- Fixture: a case whose ONLY phase is `completed` (so the HC031 unsettled-phase gate
-- is already satisfied) with no offered outcomes (so HC028 is too). Mirrors 264's
-- mk_phase: insert the phase ACTIVE and submit the root through the real UPDATE path,
-- so sync_case_phase_on_submit completes it and sets current_response_id.
create function pg_temp.mk_case(p_case_num int, p_assignee uuid)
returns table(case_id uuid, phase_id uuid, root_id uuid)
language plpgsql as $$
declare v_comm uuid; v_form uuid; v_ver uuid; v_chk uuid; v_sa uuid;
begin
  select comm_x, sa_x into v_comm, v_sa from k;
  select form_id, ver_id, chk_id into v_form, v_ver, v_chk from fx;
  case_id := gen_random_uuid(); phase_id := gen_random_uuid(); root_id := gen_random_uuid();
  insert into public.cases (id, commission_id, case_number, status, created_by)
    values (case_id, v_comm, p_case_num, 'in_review', v_sa);
  insert into public.case_phases
    (id, case_id, position, form_id, form_version_id, title, status, assigned_to,
     is_ad_hoc, emits_result)
    values (phase_id, case_id, 0, v_form, v_ver, 'Fase Um', 'active', p_assignee,
            true, false);
  insert into public.responses
    (id, form_version_id, commission_id, created_by, status, case_phase_id)
    values (root_id, v_ver, v_comm, p_assignee, 'in_progress', phase_id);
  perform test_helpers.add_selection(root_id, v_chk, array['a']);
  update public.responses set status = 'submitted', submitted_at = now() where id = root_id;
  return next;
end $$;

-- Flip a request's status through the write guard (the trigger refuses any write
-- outside the correction routines). A plain `do` block, never an SRF — set_config
-- is unreliable inside one (264's note).
create function pg_temp.set_request_status(p_request uuid, p_status text)
returns void language plpgsql as $$
begin
  perform set_config('app.in_correction_rpc', 'on', true);
  update public.case_correction_requests set status = p_status where id = p_request;
  perform set_config('app.in_correction_rpc', 'off', true);
end $$;

-- ===========================================================================
-- K0 · CONTROL — the fixture is closable. Without this, every HC0T0 below is
--      consistent with "close_case refuses this shape of case for some other
--      reason entirely" and proves nothing about the new gate.
-- ===========================================================================
create temp table c0 on commit drop as select * from pg_temp.mk_case(947000, (select st_x from k));
grant select on c0 to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.close_case(%L) $$, (select case_id from c0)),
  'K0 (control): the same fixture with NO correction request closes');
reset role;

-- ===========================================================================
-- K1 · the gate FIRES for each of the five OPEN statuses, and STOPS firing the
--      moment the request is withdrawn — same case, same phases, one column.
-- ===========================================================================
create temp table cA on commit drop as select * from pg_temp.mk_case(947001, (select st_x from k));
grant select on cA to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table rA on commit drop as select public.file_correction_request(
  'correction', (select phase_id from cA), null, 'motivo', 'clerical', null) as id;
reset role;
grant select on rA to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

-- `requested` is the status the door itself just wrote — asserted as-is.
select throws_ok(
  format($$ select public.close_case(%L) $$, (select case_id from cA)),
  'HC0T0', null, 'K1a: an open request in `requested` blocks conclusion');
reset role;

select pg_temp.set_request_status((select id from rA), 'in_progress');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.close_case(%L) $$, (select case_id from cA)),
  'HC0T0', null, 'K1b: `in_progress` blocks conclusion');
reset role;

select pg_temp.set_request_status((select id from rA), 'resubmitted');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.close_case(%L) $$, (select case_id from cA)),
  'HC0T0', null, 'K1c: `resubmitted` blocks conclusion');
reset role;

select pg_temp.set_request_status((select id from rA), 'under_review');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.close_case(%L) $$, (select case_id from cA)),
  'HC0T0', null, 'K1d: `under_review` blocks conclusion');
reset role;

-- The one most likely to be mis-modelled as "resolved": a rejected request is
-- RESTING (the corrector's next edit flips it back to in_progress), not finished.
select pg_temp.set_request_status((select id from rA), 'rejected');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.close_case(%L) $$, (select case_id from cA)),
  'HC0T0', null, 'K1e: `rejected` is a RESTING state, so it still blocks conclusion');
reset role;

-- The differential: nothing about the case changed except this column.
select pg_temp.set_request_status((select id from rA), 'withdrawn');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.close_case(%L) $$, (select case_id from cA)),
  'K1f: withdrawing the request unblocks the SAME case');
reset role;

select is(
  (select status from public.cases where id = (select case_id from cA)),
  'completed',
  'K1g: and the case really reached `completed` (K1f was not a silent no-op)');

-- ===========================================================================
-- K2 · `approved` — the other legitimate exit.
-- ===========================================================================
create temp table cB on commit drop as select * from pg_temp.mk_case(947002, (select st_x from k));
grant select on cB to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table rB on commit drop as select public.file_correction_request(
  'correction', (select phase_id from cB), null, 'motivo', 'clerical', null) as id;
reset role;
grant select on rB to authenticated;

select pg_temp.set_request_status((select id from rB), 'approved');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.close_case(%L) $$, (select case_id from cB)),
  'K2: an APPROVED request does not block conclusion');
reset role;

-- ===========================================================================
-- K3 · list_my_cases emits the correction item for the corrector, ALONGSIDE the
--      phase item — it does not replace it.
-- ===========================================================================
create temp table cC on commit drop as select * from pg_temp.mk_case(947003, (select st_x from k));
grant select on cC to authenticated;

-- Corrector defaults to the target's assignee (st_x), who is also the phase's.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table rC on commit drop as select public.file_correction_request(
  'correction', (select phase_id from cC), null, 'motivo', 'factual', null) as id;
reset role;
grant select on rC to authenticated;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  -- Parenthesised on purpose: `->>` and `||` share a precedence level and associate
  -- left, so `i->>'id' || '|'` parses as `i ->> ('id' || '|')` — a lookup of a key
  -- that does not exist, which is a type error here but would silently be NULL in
  -- other shapes.
  (select (i->>'id') || '|' || (i->>'status') || '|' || (i->>'title') || '|'
            || (i->>'case_phase_id')
     from jsonb_array_elements(public.list_my_cases((select comm_x from k))) r,
          jsonb_array_elements(r->'items') i
    where r->>'case_id' = (select case_id::text from cC)
      and i->>'kind' = 'correction'),
  (select id::text from rC) || '|requested|Fase Um|' || (select phase_id::text from cC),
  'K3a: the corrector sees a `correction` item keyed on the REQUEST, titled + pointed at its TARGET');

select is(
  (select count(*)::int
     from jsonb_array_elements(public.list_my_cases((select comm_x from k))) r,
          jsonb_array_elements(r->'items') i
    where r->>'case_id' = (select case_id::text from cC)
      and i->>'kind' = 'phase' and i->>'id' = (select phase_id::text from cC)),
  1,
  'K3b: the phase item is still emitted too — the correction is an extra row, not a swap');
reset role;

-- ===========================================================================
-- K4 · the VISIBILITY widening. sa_x holds the corrector slot and NOTHING else on
--      this case: no phase assignment (st_x has it), no narrative, no grant. Before
--      the change `list_my_cases` had no arm that admitted them, so the case
--      carrying their own pending correction was invisible to them.
-- ===========================================================================
create temp table cD on commit drop as select * from pg_temp.mk_case(947004, (select st_x from k));
grant select on cD to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table rD on commit drop as select public.file_correction_request(
  'correction', (select phase_id from cD), null, 'motivo',
  'factual', (select sa_x from k)) as id;

select is(
  (select count(*)::int
     from jsonb_array_elements(public.list_my_cases((select comm_x from k))) r
    where r->>'case_id' = (select case_id::text from cD)),
  1,
  'K4a: a corrector with NO assignment and NO grant now sees the case at all');

select is(
  (select count(*)::int
     from jsonb_array_elements(public.list_my_cases((select comm_x from k))) r,
          jsonb_array_elements(r->'items') i
    where r->>'case_id' = (select case_id::text from cD)
      and i->>'kind' = 'correction'),
  1,
  'K4b: ...carrying exactly the one correction item they are the corrector of');
reset role;
grant select on rD to authenticated;

-- ===========================================================================
-- K5 · flag OFF — both arms go inert. Runs LAST: it disables the flag the whole
--      suite above depends on.
-- ===========================================================================
create temp table cE on commit drop as select * from pg_temp.mk_case(947005, (select st_x from k));
grant select on cE to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table rE on commit drop as select public.file_correction_request(
  'correction', (select phase_id from cE), null, 'motivo', 'clerical', null) as id;
reset role;
grant select on rE to authenticated;

update app.feature_flags set enabled = false where key = 'case_corrections';

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.close_case(%L) $$, (select case_id from cE)),
  'K5a: flag OFF — the gate is inert and the open request no longer blocks');
reset role;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int
     from jsonb_array_elements(public.list_my_cases((select comm_x from k))) r,
          jsonb_array_elements(r->'items') i
    where i->>'kind' = 'correction'),
  0,
  'K5b: flag OFF — no correction item is emitted anywhere in the list');
reset role;

select * from finish();
rollback;
