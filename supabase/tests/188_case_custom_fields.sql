-- =============================================================================
-- Case custom fields (ADR 0083). Migration: 20260821000000_case_custom_fields.sql
--
-- WHAT THIS PROVES.
--   * Both new tables have RLS enabled.
--   * DEFINITIONS table: staff_admin of the template's commission may write; a
--     cross-commission staff_admin cannot INSERT (42501); a member reads, a
--     cross-commission member cannot.
--   * create_case_from_template SNAPSHOTS defs onto the case, writes values with
--     JSON typing preserved (a number stays a number), and REJECTS a missing
--     required field (HC068).
--   * VALUES table: SELECT gated by can_read_case; WRITE gated by staff_admin AND
--     NOT case-excluded (the ADR-0078 exclusion perimeter).
--   * update_case_custom_field_values self-gates (plain staff → 42501), updates,
--     rejects blanking a required field (HC068), and never creates new rows.
--   * The DIRECT-table write path is NOT bypassable: a plain member cannot INSERT
--     a value and their raw UPDATE is silently filtered; an EXCLUDED staff_admin
--     is denied by the RPC (HC0F1) AND by the raw-DML path (RLS filters).
--
-- ⛔ The fixture is the trap (ADR 0078 §7.1): the excluded principal is MADE both
-- staff_admin AND recused, and BOTH facts are asserted (PRE) before the door is
-- called, so the deny lands on the EXCLUSION gate, not on authority.
-- =============================================================================
begin;
select plan(28);

update app.feature_flags set enabled = true
  where key in ('cases_multi_phase', 'cases_extras', 'case_custom_fields');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'st_y')::uuid   as st_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         (v->>'form_u')::uuid as form_u
  from ctx;
grant select on k to authenticated;

-- =========================================================================
-- 0) RLS is enabled on both tables.
-- =========================================================================
select is((select relrowsecurity from pg_class where relname = 'process_template_custom_fields'),
  true, 'process_template_custom_fields has RLS enabled');
select is((select relrowsecurity from pg_class where relname = 'case_custom_field_values'),
  true, 'case_custom_field_values has RLS enabled');

-- =========================================================================
-- Template in comm_x with two custom-field defs (a REQUIRED short_text and an
-- optional number), authored by staff_admin sa_x, then published.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl_x on commit drop as
  select (public.create_process_template((select comm_x from k), 'Campos X', null)).id as tid;
reset role;
grant select on tpl_x to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_template_phase((select tid from tpl_x), (select form_u from k), 'F1');
insert into public.process_template_custom_fields
  (template_id, key, label, field_type, options, required, show_in_list, position)
values
  ((select tid from tpl_x), 'do_number', 'Nº DO', 'short_text', '[]'::jsonb, true,  true, 0),
  ((select tid from tpl_x), 'idade',     'Idade', 'number',     '[]'::jsonb, false, false, 1);
reset role;

-- 3) staff_admin write LANDED (2 defs).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.process_template_custom_fields
           where template_id = (select tid from tpl_x)),
  2, 'staff_admin can write defs (2 landed)');
reset role;

-- 4) cross-commission staff_admin (sa_y) cannot INSERT a def (RLS WITH CHECK → 42501).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ insert into public.process_template_custom_fields
              (template_id, key, label, field_type)
            values (%L, 'evil', 'Evil', 'short_text') $$, (select tid from tpl_x)),
  '42501', null,
  'cross-commission staff_admin cannot INSERT a def (RLS)');
reset role;

-- 5) cross-commission member cannot READ defs.
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.process_template_custom_fields
           where template_id = (select tid from tpl_x)),
  0, 'cross-commission member cannot read defs');
reset role;

-- 6) member of comm_x can READ defs.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select ok((select count(*)::int from public.process_template_custom_fields
           where template_id = (select tid from tpl_x)) >= 1,
  'member of the commission can read defs');
reset role;

-- Publish the template.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.publish_process_template((select tid from tpl_x));
reset role;

-- =========================================================================
-- 7) create_case_from_template REJECTS a missing required field (HC068).
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_case_from_template(%L, 'Sem DO') $$, (select tid from tpl_x)),
  'HC068', null,
  'create rejects a missing required custom field (HC068)');
reset role;

-- Create the case WITH the required value + a numeric value.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse_x on commit drop as
  select (public.create_case_from_template(
    (select tid from tpl_x), 'Com DO', null, null, null,
    jsonb_build_array(
      jsonb_build_object('key', 'do_number', 'value', 'DO-123'),
      jsonb_build_object('key', 'idade',     'value', 42)
    )
  )).id as cid;
reset role;
grant select on cse_x to authenticated;

-- 9-13) Snapshot + typing assertions (read as staff_admin).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select value #>> '{}' from public.case_custom_field_values
           where case_id = (select cid from cse_x) and key = 'do_number'),
  'DO-123', 'required value snapshotted onto the case');
select is((select label from public.case_custom_field_values
           where case_id = (select cid from cse_x) and key = 'do_number'),
  'Nº DO', 'label frozen on the value row');
select is((select field_type from public.case_custom_field_values
           where case_id = (select cid from cse_x) and key = 'do_number'),
  'short_text', 'field_type frozen on the value row');
select is((select jsonb_typeof(value) from public.case_custom_field_values
           where case_id = (select cid from cse_x) and key = 'idade'),
  'number', 'a number value is stored as a JSON number (not a string)');
select is((select count(*)::int from public.case_custom_field_values
           where case_id = (select cid from cse_x)),
  2, 'both defs snapshotted (2 value rows)');
reset role;

-- =========================================================================
-- 14-15) VALUES SELECT scoping (can_read_case).
-- =========================================================================
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_custom_field_values
           where case_id = (select cid from cse_x)),
  0, 'a non-reader cannot read the case values');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select ok((select count(*)::int from public.case_custom_field_values
           where case_id = (select cid from cse_x)) >= 1,
  'a case reader (staff_admin) reads the values');
reset role;

-- =========================================================================
-- 16-21) update_case_custom_field_values.
-- =========================================================================
-- 16) plain staff → 42501 (RPC self-gate).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.update_case_custom_field_values(%L,
             jsonb_build_array(jsonb_build_object('key','do_number','value','X'))) $$,
         (select cid from cse_x)),
  '42501', null,
  'plain staff cannot update custom-field values (42501)');
reset role;

-- 17-18) staff_admin updates + it lands.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.update_case_custom_field_values(%L,
             jsonb_build_array(jsonb_build_object('key','do_number','value','DO-999'))) $$,
         (select cid from cse_x)),
  'staff_admin updates a value');
reset role;
select is((select value #>> '{}' from public.case_custom_field_values
           where case_id = (select cid from cse_x) and key = 'do_number'),
  'DO-999', 'update LANDED (row changed)');

-- 19) blanking a required field → HC068.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.update_case_custom_field_values(%L,
             jsonb_build_array(jsonb_build_object('key','do_number','value',''))) $$,
         (select cid from cse_x)),
  'HC068', null,
  'cannot blank a required field (HC068)');
reset role;

-- 20-21) an unknown key no-ops and never creates a new row.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.update_case_custom_field_values(%L,
             jsonb_build_array(jsonb_build_object('key','ghost','value','x'))) $$,
         (select cid from cse_x)),
  'an unknown key no-ops (does not raise)');
reset role;
select is((select count(*)::int from public.case_custom_field_values
           where case_id = (select cid from cse_x)),
  2, 'the snapshot set did not grow (still 2 rows)');

-- =========================================================================
-- 22-24) DIRECT-TABLE exploit — a plain member cannot write values.
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ insert into public.case_custom_field_values
              (case_id, key, label, field_type, options, value, position)
            values (%L, 'hack', 'H', 'short_text', '[]'::jsonb, to_jsonb('x'::text), 9) $$,
         (select cid from cse_x)),
  '42501', null,
  'plain member cannot INSERT a value row directly (RLS WITH CHECK)');
select lives_ok(
  format($$ update public.case_custom_field_values set value = to_jsonb('HACK'::text)
            where case_id = %L and key = 'do_number' $$, (select cid from cse_x)),
  'plain member raw UPDATE does not error (RLS silently filters)');
reset role;
select is((select value #>> '{}' from public.case_custom_field_values
           where case_id = (select cid from cse_x) and key = 'do_number'),
  'DO-999', 'value UNCHANGED by the plain-member raw UPDATE');

-- =========================================================================
-- 25-29) EXCLUDED staff_admin — denied by BOTH the RPC and the raw-DML path.
-- st_x2 is MADE a staff_admin of comm_x AND recused from the case.
-- =========================================================================
insert into public.memberships (principal_id, commission_id, role)
values ((select st_x2 from k), (select comm_x from k), 'staff_admin');
insert into public.case_recusals (case_id, user_id, source)
values ((select cid from cse_x), (select st_x2 from k), 'coordinator');

select is(app.is_case_excluded((select cid from cse_x), (select st_x2 from k)), true,
  'PRE: st_x2 is EXCLUDED (recused) from the case');
select is(app.is_staff_admin_of_for((select comm_x from k), (select st_x2 from k)), true,
  'PRE: st_x2 is ALSO a staff_admin (the door reaches the exclusion gate, not 42501)');

select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.update_case_custom_field_values(%L,
             jsonb_build_array(jsonb_build_object('key','do_number','value','EVIL'))) $$,
         (select cid from cse_x)),
  'HC0F1', null,
  'an EXCLUDED staff_admin is denied by the RPC (HC0F1)');
select lives_ok(
  format($$ update public.case_custom_field_values set value = to_jsonb('EVIL'::text)
            where case_id = %L and key = 'do_number' $$, (select cid from cse_x)),
  'an EXCLUDED staff_admin raw UPDATE does not error (RLS silently filters)');
reset role;
select is((select value #>> '{}' from public.case_custom_field_values
           where case_id = (select cid from cse_x) and key = 'do_number'),
  'DO-999', 'value UNCHANGED by the excluded staff_admin (both doors closed)');

select * from finish();
rollback;
