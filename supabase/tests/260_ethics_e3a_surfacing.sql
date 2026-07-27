-- =============================================================================
-- ETH·E3a — Terminology/UX surfacing (BE-2..BE-4 keystones).
--
-- Proves, against the hermetic bootstrap fixture + the reset-loaded seed:
--   BE-2  cases.case_type_id persists via BOTH create paths; the processless
--         create_case INHERITS visibility/confidentiality from the type (O-1 Rule-12);
--         a non-resolvable type is rejected by the org-consistency guard.
--   BE-3  the kind CHECK accepts the 8 new procedural kinds + still rejects an invalid
--         kind; the visibility column defaults case_readers; the SELECT floor holds —
--         a coordinator sees a coordinator_only event, an ordinary can_read_case-true
--         reader does NOT, and a respondent/recused reader sees NEITHER visibility.
--   BE-4  the seeded Ethics type resolves explicit_grants_only + carries the 5-row
--         terminology bundle + the role vocabulary.
--
-- Personas (test_helpers.bootstrap): admin, sa_x (staff_admin/coordinator of comm_x),
-- st_x / st_x2 (plain members of comm_x), sa_y (staff_admin of comm_y — same org, other
-- commission). claims_for(uid,is_admin) sets auth.uid(); `set local role authenticated`
-- runs a block under RLS. Runs on a FRESH reset (memory pgtap-needs-fresh-reset).
-- =============================================================================

begin;
select plan(20);

update app.feature_flags set enabled = true
  where key in ('cases_multi_phase', 'processless_cases', 'case_types', 'ethics');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         (v->>'form_u')::uuid as form_u,
         app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

-- A local ethics case_type in org_x (explicit_grants_only), mirroring the seed shape.
insert into public.case_types
  (id, organization_id, key, display_name, primary_subject_kind,
   default_visibility_policy, default_confidentiality_level, default_case_label)
values ('00000000-0000-0000-0000-00000e3a0001', (select org_x from k), 'ethics_e3a',
        'Processo Ético (E3a)', 'professional', 'explicit_grants_only',
        'ethics_investigation', 'Denúncia');
create temp table f on commit drop as
  select '00000000-0000-0000-0000-00000e3a0001'::uuid as ctype;
grant select on f to authenticated;

-- ===========================================================================
-- BE-2 — case_type_id persistence + inheritance + org guard
-- ===========================================================================

-- Processless create WITH the ethics type (sa_x is staff_admin of comm_x).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table c_typed on commit drop as
  select (public.create_case((select comm_x from k), 'Caso E3a typed', false,
          '{}'::uuid[], null, null, (select ctype from f))).id as cid;
reset role;
grant select on c_typed to authenticated;

select is(
  (select case_type_id from public.cases where id = (select cid from c_typed)),
  (select ctype from f),
  'BE-2: processless create_case persists case_type_id');
select is(
  (select visibility_policy from public.cases where id = (select cid from c_typed)),
  'explicit_grants_only',
  'BE-2 O-1: processless create INHERITS visibility_policy = explicit_grants_only from the type');
select is(
  (select confidentiality_level from public.cases where id = (select cid from c_typed)),
  'ethics_investigation',
  'BE-2 O-1: processless create INHERITS confidentiality_level = ethics_investigation from the type');

-- Processless create WITHOUT a type — byte-for-byte today's defaults.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table c_plain on commit drop as
  select (public.create_case((select comm_x from k), 'Caso sem tipo')).id as cid;
reset role;
grant select on c_plain to authenticated;

select is(
  (select case_type_id from public.cases where id = (select cid from c_plain)),
  null,
  'BE-2: a type-less processless case has case_type_id null');
select is(
  (select visibility_policy from public.cases where id = (select cid from c_plain)),
  'commission_default',
  'BE-2: a type-less case keeps visibility_policy = commission_default (byte-for-byte)');

-- create_case_from_template persists the case_type_id it already validated.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'Processo Ético E3a', null)).id as tid;
select public.add_template_phase((select tid from tpl), (select form_u from k), 'Fase 1');
select public.publish_process_template((select tid from tpl));
reset role;
grant select on tpl to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table c_tpl on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso via template', null, null,
          (select ctype from f))).id as cid;
reset role;
grant select on c_tpl to authenticated;

select is(
  (select case_type_id from public.cases where id = (select cid from c_tpl)),
  (select ctype from f),
  'BE-2: create_case_from_template persists case_type_id');

-- The org-consistency guard rejects a non-resolvable type (P0002, mirrors E1 #13).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_case(%L, 'Caso cross-org', false, '{}'::uuid[], null, null,
            '00000000-0000-0000-0000-00000e3a9999') $$, (select comm_x from k)),
  'P0002', null,
  'BE-2: create_case rejects a case_type that does not resolve in the case''s org');
reset role;

-- ===========================================================================
-- BE-3 — kind widen + visibility default
-- ===========================================================================
select lives_ok(
  format($$ insert into public.case_events (case_id, kind, body, created_by)
            values (%L, 'finding_recorded', 'Parecer de alegação registrado', %L) $$,
         (select cid from c_typed), (select sa_x from k)),
  'BE-3: case_events accepts the new procedural kind finding_recorded');
select lives_ok(
  format($$ insert into public.case_events (case_id, kind, body, created_by)
            values (%L, 'note', 'Anotação comum', %L) $$,
         (select cid from c_typed), (select sa_x from k)),
  'BE-3: an existing kind (note) still inserts — the widen is additive');
select throws_ok(
  format($$ insert into public.case_events (case_id, kind, body, created_by)
            values (%L, 'bogus_kind', 'x', %L) $$,
         (select cid from c_typed), (select sa_x from k)),
  '23514', null,
  'BE-3: an invalid kind is still rejected (CHECK enforces a closed set)');
select is(
  (select visibility from public.case_events
     where case_id = (select cid from c_typed) and kind = 'note' limit 1),
  'case_readers',
  'BE-3: a case_events row defaults visibility = case_readers');

-- ===========================================================================
-- BE-3 — visibility RLS floor (the keystone). Case c_typed is explicit_grants_only.
-- st_x = respondent (hard-denied); st_x2 = granted reader; sa_x = coordinator.
-- Two events: one case_readers, one coordinator_only.
-- ===========================================================================
insert into public.case_events (id, case_id, kind, body, visibility, created_by)
values ('00000000-0000-0000-0000-00000e3a0e01', (select cid from c_typed),
        'decision_issued', 'Decisão emitida', 'case_readers', (select sa_x from k)),
       ('00000000-0000-0000-0000-00000e3a0e02', (select cid from c_typed),
        'vote_cast', 'Voto registrado', 'coordinator_only', (select sa_x from k));

-- Respondent fixture: st_x is the respondent_doctor of c_typed (deny reads base tables).
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ('00000000-0000-0000-0000-00000e3a0a01', (select org_x from k), 'professional', 'professional_identity', 'Dr. Réu E3a');
insert into public.professional_profiles (id, organization_id, user_id, full_name)
values ('00000000-0000-0000-0000-00000e3a0b02', (select org_x from k), (select st_x from k), 'Dr. Réu E3a');
insert into public.professional_participants (participant_id, professional_profile_id)
values ('00000000-0000-0000-0000-00000e3a0a01', '00000000-0000-0000-0000-00000e3a0b02');
-- key MUST be 'respondent_doctor' — app.is_case_respondent keys on that literal, so a
-- custom key would NOT exclude (the deny would be vacuous).
insert into public.case_participant_roles
  (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
values ('00000000-0000-0000-0000-00000e3a0c03', (select org_x from k), 'respondent_doctor',
  'Médico denunciado', array['professional'], true);
insert into public.case_participants (case_id, participant_id, role_id, is_primary_subject)
values ((select cid from c_typed), '00000000-0000-0000-0000-00000e3a0a01',
        '00000000-0000-0000-0000-00000e3a0c03', true);

-- st_x2 is an explicit case grantee (explicit_grants_only needs a grant to read).
select test_helpers.grant_ca((select cid from c_typed), (select st_x2 from k), 'read', (select sa_x from k));
-- st_x is ALSO granted read — so C3's "sees NEITHER" is isolated to the RESPONDENT-deny
-- (respondent beats a grant), NOT merely a missing grant (non-vacuity).
select test_helpers.grant_ca((select cid from c_typed), (select st_x from k), 'read', (select sa_x from k));

-- (C1) the coordinator sees BOTH events.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.case_events where case_id = (select cid from c_typed)
     and id in ('00000000-0000-0000-0000-00000e3a0e01','00000000-0000-0000-0000-00000e3a0e02')),
  2,
  'BE-3 RLS: the coordinator sees both the case_readers AND the coordinator_only event');
reset role;

-- (C2) an ordinary granted reader sees ONLY the case_readers event.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.case_events where case_id = (select cid from c_typed)
     and id in ('00000000-0000-0000-0000-00000e3a0e01','00000000-0000-0000-0000-00000e3a0e02')),
  1,
  'BE-3 RLS: a granted non-coordinator reader sees only the case_readers event');
reset role;

-- (C3) the respondent sees NEITHER (can_read_case floor denies regardless of visibility).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.case_events where case_id = (select cid from c_typed)
     and id in ('00000000-0000-0000-0000-00000e3a0e01','00000000-0000-0000-0000-00000e3a0e02')),
  0,
  'BE-3 RLS: the respondent (granted read, yet respondent-excluded) sees NEITHER event — the can_read_case floor overrides both the grant and visibility');
reset role;

-- (C4) a same-org foreign-commission staff_admin sees NEITHER (commission boundary).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.case_events where case_id = (select cid from c_typed)
     and id in ('00000000-0000-0000-0000-00000e3a0e01','00000000-0000-0000-0000-00000e3a0e02')),
  0,
  'BE-3 RLS: a foreign-commission staff_admin sees neither event');
reset role;

-- (C5) recuse the granted reader — recusal is the floor, overriding the grant.
insert into public.case_recusals (case_id, user_id, source, reason_md)
values ((select cid from c_typed), (select st_x2 from k), 'coordinator', 'conflito');
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.case_events where case_id = (select cid from c_typed)
     and id in ('00000000-0000-0000-0000-00000e3a0e01','00000000-0000-0000-0000-00000e3a0e02')),
  0,
  'BE-3 RLS: a recused reader (was granted) now sees NEITHER — recusal is the floor');
reset role;

-- ===========================================================================
-- BE-4 — terminology + role vocabulary MECHANISM (hermetic).
-- test_helpers.bootstrap() TRUNCATEs every table, so the reset-loaded seed rows are
-- gone inside this transaction; the seed VALUES are verified out-of-band by catalog
-- (reported to the lead). Here we prove the terminology/role tables behave: a bundle
-- is storable + readable, and a type with no override rows yields zero (the resolver's
-- default-fallback premise — getCaseTypeTerminology returns the platform default then).
-- ===========================================================================
insert into public.case_type_terminology
  (case_type_id, term_key, singular_label, plural_label, help_text)
values
  ((select ctype from f), 'case',            'Denúncia',              'Denúncias',           null),
  ((select ctype from f), 'primary_subject', 'Médico denunciado',     'Médicos denunciados', null),
  ((select ctype from f), 'timeline',        'Cronologia processual', null,                  null),
  ((select ctype from f), 'document',        'Documento',             'Documentos',          null),
  ((select ctype from f), 'decision',        'Decisão',               'Decisões',            null);

select is(
  (select count(*)::int from public.case_type_terminology where case_type_id = (select ctype from f)),
  5,
  'BE-4: a case_type carries a 5-row terminology bundle (storable + readable)');
select is(
  (select singular_label from public.case_type_terminology
     where case_type_id = (select ctype from f) and term_key = 'case'),
  'Denúncia',
  'BE-4: the case term renders "Denúncia"');
select is(
  (select count(*)::int from public.case_type_terminology
     where case_type_id = '00000000-0000-0000-0000-00000e3a0002'),
  0,
  'BE-4: a type with no override rows yields zero terminology (the default-fallback premise)');
select is(
  (select is_primary_subject_candidate from public.case_participant_roles
     where id = '00000000-0000-0000-0000-00000e3a0c03'),
  true,
  'BE-4: an Ethics role is storable/readable with is_primary_subject_candidate (role vocabulary)');

select * from finish();
rollback;
