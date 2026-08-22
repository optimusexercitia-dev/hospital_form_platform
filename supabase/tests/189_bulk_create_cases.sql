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
select plan(43);

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
         (v->>'form_u')::uuid as form_u,
         (v->>'oa_b')::uuid   as oa_b
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
  select (public.create_process_template((select comm_x from k), 'Lote Multi', null)).id as tid, null::uuid as vid;
-- ADR 0096: resolve the v1 draft in a SEPARATE statement. The helper is
-- STABLE, so inside the CREATE ... AS above it would see the pre-statement
-- snapshot and return NULL.
update tpl_multi set vid = app.draft_version_of_template(tid);
select public.add_template_phase((select vid from tpl_multi), (select form_u from k), 'Fase 1');
select public.add_template_phase((select vid from tpl_multi), (select form_u from k), 'Fase 2');
select public.publish_process_template((select tid from tpl_multi));

create temp table tpl_req on commit drop as
  select (public.create_process_template((select comm_x from k), 'Lote Req', null)).id as tid, null::uuid as vid;
-- ADR 0096: resolve the v1 draft in a SEPARATE statement. The helper is
-- STABLE, so inside the CREATE ... AS above it would see the pre-statement
-- snapshot and return NULL.
update tpl_req set vid = app.draft_version_of_template(tid);
select public.add_template_phase((select vid from tpl_req), (select form_u from k), 'Fase 1');
insert into public.process_template_custom_fields
  (template_version_id, key, label, field_type, options, required, show_in_list, position)
values ((select vid from tpl_req), 'do_number', 'Nº DO', 'short_text', '[]'::jsonb, true, true, 0);
select public.publish_process_template((select tid from tpl_req));

create temp table tpl_phi on commit drop as
  select (public.create_process_template((select comm_x from k), 'Lote PHI', null)).id as tid, null::uuid as vid;
-- ADR 0096: resolve the v1 draft in a SEPARATE statement. The helper is
-- STABLE, so inside the CREATE ... AS above it would see the pre-statement
-- snapshot and return NULL.
update tpl_phi set vid = app.draft_version_of_template(tid);
reset role;

grant select on tpl_multi to authenticated;
grant select on tpl_req to authenticated;
grant select on tpl_phi to authenticated;

-- collects_patient is set out-of-band (as the owner, RLS-bypassing) — mirrors 151's
-- direct fixture writes; the create-dialog/builder path is not under test here.
-- ADR 0096: collects_patient moved to the VERSION. The version is still a draft
-- here (it is published below), so the published-version guard does not fire.
update public.process_template_versions set collects_patient = true
  where id = (select vid from tpl_phi);

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_template_phase((select vid from tpl_phi), (select form_u from k), 'Fase 1');
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
-- 2b) AUTHORITY KEYSTONE — ⛔ INVERTED 2026-08-22, DELIBERATELY.
--
-- WAS: 'a create_cases Administrativo is STILL denied bulk creation (Decision #5:
--      stricter than create_case_from_template)' — a throws_ok on 42501.
-- NOW: they are ADMITTED. ADR 0134 Amendment 1 §A1.2 (PO-ruled 2026-08-21) overruled
--      Design #5: creating many cases carries the same logical responsibility as
--      creating one, so bulk and create_case_from_template now agree.
-- ⚠ This is a REVERSAL of a recorded design decision, not the correction of a defect.
--      Stated here because an inverted keystone with no explanation reads to the next
--      person as a test someone bent to make their change pass.
--
-- ⛔ The PRE-check below is KEPT and still does work after the inversion: it proves the
--     holder really has create_cases, so the lives_ok lands on the WIDENED gate rather
--     than on a lucky fixture. The created-case assertion after it is what stops the
--     positive from passing on a silent no-op.
--
-- ⭐ TWO KEYS, NOT ONE (PO ruling 2026-08-22, option A). Widening bulk's own gate was
--     measured NECESSARY AND NOT SUFFICIENT: bulk COMPOSES activate_phase, gated on
--     `assign_case_phases`, so a create_cases-only delegate passed the gate and was
--     refused INSIDE the per-row loop. The ruling requires BOTH existing keys.
--
-- WHICH ASSERTION BECAME WHICH — stated because a reused fixture reads like dead weight:
--   * the ORIGINAL keystone ('a create_cases Administrativo is STILL denied bulk') is NOT
--     deleted. Its fixture (st_x2 holding ONLY create_cases) and its refusal survive as
--     NEG-A below — it is now the single-key negative, i.e. one of the two over-grant
--     twins in the KEY dimension. Without NEG-A and NEG-C, "requires two keys" would be
--     asserted rather than demonstrated: a single-key positive passing would mean the
--     conjunction is not doing what the ruling says.
--   * the INVERTED positive is the two-key one, and it fires only after the second key is
--     granted, a few lines down.
--   * NEG-B is new and has no predecessor: all_phases is refused AT THE GATE, before any
--     row is minted, because step (c)'s assign_narrative is coordinator-only with NO
--     capability arm — no combination of keys can satisfy it.
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
  'PRE: the Administrativo st_x2 HAS create_cases (so every refusal below lands on the gate under test, not on a missing capability)');

-- ⭐ NEG-A — the FIRST over-grant twin in the KEY dimension. This IS the original
-- keystone's fixture and refusal, kept and re-purposed. create_cases ALONE is not enough.
select throws_ok(
  format($$ select public.bulk_create_cases(%L, null, 'first_only',
    jsonb_build_array(jsonb_build_object(
      'label','NEG-A','assigned_to',(select st_x from k),'custom_fields','[]'::jsonb,'patient',null))) $$,
    (select tid from tpl_multi)),
  '42501', 'sem permissão',
  'NEG-A ⭐ create_cases ALONE is REFUSED (the two-key conjunction is doing work; a pass here would mean it is not)');
reset role;

-- Grant the SECOND key. From here st_x2 is the two-key holder the ruling describes.
insert into public.commission_administrativo_capabilities (commission_id, user_id, capability, granted_by)
  values ((select comm_x from k), (select st_x2 from k), 'assign_case_phases', (select sa_x from k));

select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is(app.member_can((select comm_x from k), 'assign_case_phases'), true,
  'PRE2: and now they hold assign_case_phases too - so the positive below lands on the WIDENED gate, not on a lucky fixture');
select lives_ok(
  format($$ select public.bulk_create_cases(%L, null, 'first_only',
    jsonb_build_array(jsonb_build_object(
      'label','ADM-BULK','assigned_to',(select st_x from k),'custom_fields','[]'::jsonb,'patient',null))) $$,
    (select tid from tpl_multi)),
  '⭐ TWO-KEY POSITIVE (ADR 0134 Amdt 1 A1.2, PO option A): an Administrativo holding create_cases AND assign_case_phases reaches bulk creation');
reset role;
select is((select count(*)::int from public.cases where label = 'ADM-BULK'), 1,
  'and the case actually landed - a lives_ok alone could pass on a silent no-op');

-- ⭐ NEG-B — all_phases is coordinator-only, and it is refused AT THE GATE. The count
-- control is the half that matters: it proves the refusal happened BEFORE any row was
-- minted, which is the whole difference between an honest refusal and the 200-row
-- rollback that ADR 0134 Amdt 1 A1.2 was ruled to eliminate.
update cnt set n = (select count(*) from public.cases where commission_id = (select comm_x from k));
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.bulk_create_cases(%L, null, 'all_phases',
    jsonb_build_array(jsonb_build_object(
      'label','NEG-B','assigned_to',(select st_x from k),'custom_fields','[]'::jsonb,'patient',null))) $$,
    (select tid from tpl_multi)),
  '42501', 'o escopo "todas as fases" é exclusivo da coordenação da comissão',
  'NEG-B ⭐ all_phases is refused for a two-key holder, with a message NAMING THE SCOPE (errcode alone could not tell it from the authority gate)');
reset role;
select is((select count(*) from public.cases where commission_id = (select comm_x from k)),
  (select n from cnt),
  'NEG-B ⭐ AT THE GATE: not one case was minted before the refusal - an honest refusal before work, not a rollback after 200 rows');

-- ⭐ NEG-C — the SECOND over-grant twin: the other key alone is not enough either.
-- Without both NEG-A and NEG-C, "requires two keys" is asserted, not demonstrated.
delete from public.commission_administrativo_capabilities
 where commission_id = (select comm_x from k) and user_id = (select st_x2 from k)
   and capability = 'create_cases';
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.bulk_create_cases(%L, null, 'first_only',
    jsonb_build_array(jsonb_build_object(
      'label','NEG-C','assigned_to',(select st_x from k),'custom_fields','[]'::jsonb,'patient',null))) $$,
    (select tid from tpl_multi)),
  '42501', 'sem permissão',
  'NEG-C ⭐ assign_case_phases ALONE is REFUSED - the conjunction is symmetric, and neither key carries bulk on its own');
reset role;
insert into public.commission_administrativo_capabilities (commission_id, user_id, capability, granted_by)
  values ((select comm_x from k), (select st_x2 from k), 'create_cases', (select sa_x from k));

select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;

-- ⭐ THE SHARP TENANCY PIN. 314 11.14 already asserts bulk refuses the org_admin, but as
-- throws_ok(..., null, null) - it accepts ANY raise, so it stays green under a WRONG
-- widening and cannot say which lock refused. This one names the gate.
select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.bulk_create_cases(%L, null, 'first_only',
    jsonb_build_array(jsonb_build_object(
      'label','OA','assigned_to',(select st_x from k),'custom_fields','[]'::jsonb,'patient',null))) $$,
    (select tid from tpl_multi)),
  '42501', 'sem permissão',
  'the org_admin is refused BY THE AUTHORITY GATE (errcode AND message) - the widening admits commission delegates, not tenancy admins');
reset role;
select is(app.member_can_for((select comm_x from k), 'create_cases', (select oa_b from k)), false,
  'and the reason is structural: member_can is membership-aware and an org_admin is not a member');

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

-- =========================================================================
-- 8b) ⭐ THE ADMINISTRATIVO PHI TWIN (ADR 0134 Amendment 2, option D) - the same bulk
--     PHI write as 8) above, by a create_cases Administrativo instead of a coordinator.
--     This is the whole point of option D: fill up to 200 rows and KEEP them.
-- ⛔ Vacuity: a returned 1 would pass on a batch that wrote no identifiers, so the row
--     is read back. And the Rule-12 half is the one that matters - the writer still
--     cannot READ what they just wrote.
-- =========================================================================
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.bulk_create_cases(%L, null, 'first_only',
    jsonb_build_array(jsonb_build_object(
      'label','ADM-PHI','assigned_to',(select st_x from k),'custom_fields','[]'::jsonb,
      'patient', jsonb_build_object('name','Paciente Adm','mrn','MRN-ADM','sex','male')))) $$,
    (select tid from tpl_phi)),
  '8b: a create_cases Administrativo bulk-creates WITH patient identifiers');
reset role;
select is((select pi.mrn
           from public.patient_identifiers pi
           join public.case_participants cp on cp.participant_id = pi.participant_id
           join public.cases c on c.id = cp.case_id
           where c.label = 'ADM-PHI' limit 1),
  'MRN-ADM', '8b: and the identifiers actually landed (not a silent no-op)');
select is(
  app.can_read_case_patient((select id from public.cases where label = 'ADM-PHI'),
                            (select st_x2 from k)),
  false,
  '8b ⭐ RULE 12: and the writer STILL cannot read what they just wrote - option D grants write, never read');
select is(
  (select count(*)::int from public.patient_participants pp
   join public.case_participants cp on cp.participant_id = pp.participant_id
   where cp.case_id = (select id from public.cases where label = 'ADM-PHI')),
  1,
  '8b REGRESSION GUARD (cannot fail today): exactly one patient participant. The helper is the ONLY surface that can create one (catalog property, migration header), so this guards a future second writer and is NOT evidence about the current path');

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
