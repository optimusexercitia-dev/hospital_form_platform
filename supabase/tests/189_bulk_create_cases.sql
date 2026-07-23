-- =============================================================================
-- Bulk case creation ("Múltiplos casos"). Migration: 20260823000000_bulk_create_cases.sql
--
-- WHAT THIS PROVES.
--   * AUTHORITY: staff_admin of the template's commission may bulk-create; a plain
--     member (staff) and a FOREIGN coordinator are denied (42501).
--   * MEMBERSHIP: a row assigned to a non-member is rejected (HC021) and NOTHING is
--     created (the pre-validation fails before minting).
--   * ATOMICITY: one bad row (missing required custom field → HC068) rolls back the
--     WHOLE batch — 0 cases created — and the error is ROW-INDEXED ("linha N:").
--   * SCOPE SHAPE: first_only activates the lowest-position phase (assigned +
--     due-dated) and leaves downstream phases pending + UNASSIGNED; all_phases
--     ALSO pre-assigns downstream pending phases to the same owner, WITHOUT a due
--     date (the deadline rides the FIRST phase only).
--   * OWNER MAP honored verbatim (each case's owner is exactly the submitted one).
--   * CAP: > 200 rows is rejected (check_violation).
--   * PHI (Rule 12): a patient row is written through the audited single door for a
--     PHI-collecting template, and REJECTED (whole batch rolls back) when the
--     template does not collect patient identifiers.
--
-- ⛔ FLAG TRAP (ADR 0078 §7.1, pgtag fixture-flag gaps): the fixture MUST enable
-- every flag the RPC + its composed doors gate on, or the flag-guarded assertions
-- silently SKIP. Enable them explicitly up-front and never trust a self-reported
-- pass count.
-- =============================================================================
begin;
select plan(31);

-- The bulk RPC composes doors gated by ALL of these; assert_bulk_create_enabled
-- gates the RPC itself; set_participant_patient gates on case_patient;
-- administrativo powers the create_cases-holder keystone (Decision #5).
update app.feature_flags set enabled = true
  where key in (
    'cases_multi_phase', 'cases_bulk_create', 'case_custom_fields',
    'case_narratives', 'case_patient', 'audit_trail', 'administrativo'
  );

-- Sanity: the fixture actually enabled the bulk flag (guards the silent-skip trap).
select is(app.feature_enabled('cases_bulk_create'), true,
  'fixture enabled cases_bulk_create (flag-guarded assertions will run)');

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

create temp table cnt on commit drop as select 0::bigint as n;
grant select on cnt to authenticated;

-- =========================================================================
-- Templates in comm_x, authored by sa_x.
--   tpl_multi : 2 phases (both on form_u, no blocks), published — scope tests.
--   tpl_req   : 1 phase + a REQUIRED custom field, published — rollback test.
--   tpl_phi   : 1 phase, collects_patient = true, published — PHI tests.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl_multi on commit drop as
  select (public.create_process_template((select comm_x from k), 'Lote Multi', null)).id as tid;
select public.add_template_phase((select tid from tpl_multi), (select form_u from k), 'Fase 1');
select public.add_template_phase((select tid from tpl_multi), (select form_u from k), 'Fase 2');
select public.publish_process_template((select tid from tpl_multi));

create temp table tpl_req on commit drop as
  select (public.create_process_template((select comm_x from k), 'Lote Req', null)).id as tid;
select public.add_template_phase((select tid from tpl_req), (select form_u from k), 'Fase 1');
insert into public.process_template_custom_fields
  (template_id, key, label, field_type, options, required, show_in_list, position)
values ((select tid from tpl_req), 'do_number', 'Nº DO', 'short_text', '[]'::jsonb, true, true, 0);
select public.publish_process_template((select tid from tpl_req));

create temp table tpl_phi on commit drop as
  select (public.create_process_template((select comm_x from k), 'Lote PHI', null)).id as tid;
reset role;

grant select on tpl_multi to authenticated;
grant select on tpl_req to authenticated;
grant select on tpl_phi to authenticated;

-- collects_patient is set out-of-band (as the owner, RLS-bypassing) — mirrors 151's
-- direct fixture writes; the create-dialog/builder path is not under test here.
update public.process_templates set collects_patient = true
  where id = (select tid from tpl_phi);

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_template_phase((select tid from tpl_phi), (select form_u from k), 'Fase 1');
select public.publish_process_template((select tid from tpl_phi));
reset role;

-- =========================================================================
-- 1) AUTHORITY — a plain member (st_x) is denied (42501).
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.bulk_create_cases(%L, null, 'first_only',
    jsonb_build_array(jsonb_build_object(
      'label','X','assigned_to',(select st_x from k),'custom_fields','[]'::jsonb,'patient',null))) $$,
    (select tid from tpl_multi)),
  '42501', null,
  'a plain member cannot bulk-create (42501)');
reset role;

-- 2) AUTHORITY — a FOREIGN coordinator (sa_y, admin of comm_y) is denied (42501).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.bulk_create_cases(%L, null, 'first_only',
    jsonb_build_array(jsonb_build_object(
      'label','X','assigned_to',(select st_x from k),'custom_fields','[]'::jsonb,'patient',null))) $$,
    (select tid from tpl_multi)),
  '42501', null,
  'a foreign coordinator cannot bulk-create the other commission (42501)');
reset role;

-- =========================================================================
-- 2b) AUTHORITY KEYSTONE (Decision #5) — an Administrativo holding ONLY
--     create_cases is STILL denied: bulk is DELIBERATELY stricter than
--     create_case_from_template (whose gate DOES admit a create_cases holder).
--
-- ⛔ Fixture-trap discipline (ADR 0078 §7.1): PROVE the holder HAS create_cases
--     (member_can → true) FIRST, so the 42501 lands on the stricter bulk gate, not
--     on a missing capability — otherwise this keystone would be vacuous.
-- st_x2 (a staff member of comm_x) is appointed + granted create_cases as the table
-- owner (bypasses the guarded appoint/grant doors, like the seed; those doors are
-- tested in 205).
-- =========================================================================
insert into public.commission_administrativos (commission_id, user_id, appointed_by)
  values ((select comm_x from k), (select st_x2 from k), (select sa_x from k));
insert into public.commission_administrativo_capabilities (commission_id, user_id, capability, granted_by)
  values ((select comm_x from k), (select st_x2 from k), 'create_cases', (select sa_x from k));

select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is(app.member_can((select comm_x from k), 'create_cases'), true,
  'PRE: the Administrativo st_x2 HAS create_cases (the door reaches the stricter bulk gate, not a missing-capability deny)');
select throws_ok(
  format($$ select public.bulk_create_cases(%L, null, 'first_only',
    jsonb_build_array(jsonb_build_object(
      'label','X','assigned_to',(select st_x from k),'custom_fields','[]'::jsonb,'patient',null))) $$,
    (select tid from tpl_multi)),
  '42501', null,
  'a create_cases Administrativo is STILL denied bulk creation (Decision #5: stricter than create_case_from_template)');
reset role;

-- =========================================================================
-- 3) MEMBERSHIP — a row assigned to a NON-member (st_y) → HC021, 0 created.
-- =========================================================================
update cnt set n = (select count(*) from public.cases where commission_id = (select comm_x from k));
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.bulk_create_cases(%L, null, 'first_only',
    jsonb_build_array(jsonb_build_object(
      'label','X','assigned_to',(select st_y from k),'custom_fields','[]'::jsonb,'patient',null))) $$,
    (select tid from tpl_multi)),
  'HC021', null,
  'a row assigned to a non-member is rejected (HC021)');
reset role;
select is((select count(*) from public.cases where commission_id = (select comm_x from k)),
  (select n from cnt), 'nothing created when an assignee is not a member');

-- =========================================================================
-- 4) VALIDATION — invalid phase scope + the 200 cap.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.bulk_create_cases(%L, null, 'bogus',
    jsonb_build_array(jsonb_build_object(
      'label','X','assigned_to',(select st_x from k),'custom_fields','[]'::jsonb,'patient',null))) $$,
    (select tid from tpl_multi)),
  '23514', null,
  'an invalid phase scope is rejected (check_violation)');

select throws_ok(
  format($$ select public.bulk_create_cases(%L, null, 'first_only',
    (select jsonb_agg(jsonb_build_object(
       'label','C'||g,'assigned_to',(select st_x from k),'custom_fields','[]'::jsonb,'patient',null))
     from generate_series(1, 201) g)) $$,
    (select tid from tpl_multi)),
  '23514', null,
  'more than 200 rows is rejected (check_violation)');
reset role;

-- =========================================================================
-- 5) HAPPY PATH first_only — 2 rows dealt to st_x and st_x2.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  public.bulk_create_cases((select tid from tpl_multi), '2026-12-31'::date, 'first_only',
    jsonb_build_array(
      jsonb_build_object('label','L1','assigned_to',(select st_x from k),'custom_fields','[]'::jsonb,'patient',null),
      jsonb_build_object('label','L2','assigned_to',(select st_x2 from k),'custom_fields','[]'::jsonb,'patient',null))),
  2, 'first_only returns createdCount = 2');
reset role;

select is((select count(*)::int from public.cases
           where commission_id = (select comm_x from k) and label in ('L1','L2')),
  2, 'two cases created (L1, L2)');

-- L1: first phase active + assigned to st_x + due-dated; second phase pending + unassigned.
select is((select cp.status from public.case_phases cp
           join public.cases c on c.id = cp.case_id
           where c.label = 'L1' order by cp.position asc limit 1),
  'active', 'L1 first phase is active');
select is((select cp.assigned_to from public.case_phases cp
           join public.cases c on c.id = cp.case_id
           where c.label = 'L1' order by cp.position asc limit 1),
  (select st_x from k), 'L1 first phase assigned to the submitted owner (st_x)');
select is((select cp.due_date from public.case_phases cp
           join public.cases c on c.id = cp.case_id
           where c.label = 'L1' order by cp.position asc limit 1),
  '2026-12-31'::date, 'L1 first phase carries the deadline');
select is((select cp.status from public.case_phases cp
           join public.cases c on c.id = cp.case_id
           where c.label = 'L1' order by cp.position desc limit 1),
  'pending', 'L1 downstream phase stays pending (first_only)');
select is((select cp.assigned_to from public.case_phases cp
           join public.cases c on c.id = cp.case_id
           where c.label = 'L1' order by cp.position desc limit 1),
  null, 'L1 downstream phase is UNASSIGNED (first_only)');

-- Owner map honored verbatim: L2's owner is st_x2 (not st_x).
select is((select cp.assigned_to from public.case_phases cp
           join public.cases c on c.id = cp.case_id
           where c.label = 'L2' order by cp.position asc limit 1),
  (select st_x2 from k), 'L2 first phase assigned to st_x2 (owner map verbatim)');

-- Activating the first phase moved the case to in_review.
select is((select status from public.cases where label = 'L1'),
  'in_review', 'L1 case transitioned to in_review');

-- =========================================================================
-- 6) all_phases — downstream pending phase pre-assigned to the SAME owner, no due.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  public.bulk_create_cases((select tid from tpl_multi), '2026-12-31'::date, 'all_phases',
    jsonb_build_array(
      jsonb_build_object('label','A1','assigned_to',(select st_x from k),'custom_fields','[]'::jsonb,'patient',null))),
  1, 'all_phases returns createdCount = 1');
reset role;

select is((select cp.status from public.case_phases cp
           join public.cases c on c.id = cp.case_id
           where c.label = 'A1' order by cp.position asc limit 1),
  'active', 'A1 first phase is active');
select is((select cp.status from public.case_phases cp
           join public.cases c on c.id = cp.case_id
           where c.label = 'A1' order by cp.position desc limit 1),
  'pending', 'A1 downstream phase stays pending (never auto-activated)');
select is((select cp.assigned_to from public.case_phases cp
           join public.cases c on c.id = cp.case_id
           where c.label = 'A1' order by cp.position desc limit 1),
  (select st_x from k), 'A1 downstream pending phase pre-assigned to the same owner (all_phases)');
select is((select cp.due_date from public.case_phases cp
           join public.cases c on c.id = cp.case_id
           where c.label = 'A1' order by cp.position desc limit 1),
  null, 'A1 downstream phase carries NO deadline (first phase only)');

-- =========================================================================
-- 7) ATOMICITY — one bad row (missing required field) rolls back the WHOLE batch.
-- =========================================================================
update cnt set n = (select count(*) from public.cases where commission_id = (select comm_x from k));
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.bulk_create_cases(%L, null, 'first_only',
    jsonb_build_array(
      jsonb_build_object('label','R1','assigned_to',(select st_x from k),
        'custom_fields', jsonb_build_array(jsonb_build_object('key','do_number','value','DO-1')),'patient',null),
      jsonb_build_object('label','R2','assigned_to',(select st_x from k),
        'custom_fields','[]'::jsonb,'patient',null))) $$,
    (select tid from tpl_req)),
  'HC068', null,
  'a missing required field aborts the batch (HC068)');
select throws_like(
  format($$ select public.bulk_create_cases(%L, null, 'first_only',
    jsonb_build_array(
      jsonb_build_object('label','R1','assigned_to',(select st_x from k),
        'custom_fields', jsonb_build_array(jsonb_build_object('key','do_number','value','DO-1')),'patient',null),
      jsonb_build_object('label','R2','assigned_to',(select st_x from k),
        'custom_fields','[]'::jsonb,'patient',null))) $$,
    (select tid from tpl_req)),
  '%linha 2:%',
  'the error is ROW-INDEXED to the offending row (linha 2)');
reset role;
select is((select count(*) from public.cases where commission_id = (select comm_x from k)),
  (select n from cnt), 'the whole batch rolled back — 0 cases created (incl. the valid row 1)');

-- =========================================================================
-- 8) PHI — written for a collecting template; rejected otherwise.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  public.bulk_create_cases((select tid from tpl_phi), null, 'first_only',
    jsonb_build_array(jsonb_build_object(
      'label','P1','assigned_to',(select st_x from k),'custom_fields','[]'::jsonb,
      'patient', jsonb_build_object('name','Paciente Um','mrn','MRN-1','sex','female')))),
  1, 'PHI template: bulk create returns 1');
reset role;

select is((select has_patient from public.cases where label = 'P1'),
  true, 'P1 case has_patient = true (PHI written)');
select is((select pi.name
           from public.patient_identifiers pi
           join public.case_participants cp on cp.participant_id = pi.participant_id
           join public.cases c on c.id = cp.case_id
           where c.label = 'P1' limit 1),
  'Paciente Um', 'the patient identifier was written through the single door');

-- PHI rejected when the template does NOT collect patient identifiers → batch aborts.
update cnt set n = (select count(*) from public.cases where commission_id = (select comm_x from k));
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.bulk_create_cases(%L, null, 'first_only',
    jsonb_build_array(jsonb_build_object(
      'label','NP1','assigned_to',(select st_x from k),'custom_fields','[]'::jsonb,
      'patient', jsonb_build_object('name','Não Deve','mrn','X')))) $$,
    (select tid from tpl_multi)),
  '23514', null,
  'a patient on a non-PHI template is rejected (check_violation)');
reset role;
select is((select count(*) from public.cases where commission_id = (select comm_x from k)),
  (select n from cnt), 'the PHI-rejected batch rolled back — 0 cases created');

select * from finish();
rollback;
