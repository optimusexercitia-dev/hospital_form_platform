-- =============================================================================
-- ETH·E3a BE-6 — terminology/subject reads + the manual visibility write-gate.
--
-- The pure merge/fallback (null→default, missing term_key→default) is proven in the
-- vitest src/lib/cases/terminology.test.ts; here we prove the DB facts the resolver +
-- projections rely on: case_type_terminology / case_types are member-SELECTable (RLS);
-- a full bundle has its 5 keys; a partial bundle exposes only its present keys (so the
-- resolver falls back for the rest); the cases→case_types join yields primary_subject_kind
-- (or null for a type-less case); and the manual visibility write is coordinator-gated —
-- a coordinator may set coordinator_only, a granted non-coordinator writer may NOT.
--
-- Fresh reset (pgtap-needs-fresh-reset). Fixtures inserted as superuser.
-- =============================================================================

begin;
select plan(9);

update app.feature_flags set enabled = true
  where key in ('cases_multi_phase', 'case_access', 'case_types');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'comm_x')::uuid as comm_x,
         app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

reset role;
-- Type T: full 5-key bundle, primary_subject_kind = professional.
insert into public.case_types
  (id, organization_id, key, display_name, primary_subject_kind, default_visibility_policy)
values ('00000000-0000-0000-0000-00000e3a6001', (select org_x from k), 'e3a_full',
        'Tipo completo', 'professional', 'explicit_grants_only');
insert into public.case_type_terminology (case_type_id, term_key, singular_label, plural_label, help_text)
values
  ('00000000-0000-0000-0000-00000e3a6001', 'case',            'Denúncia',              'Denúncias',           null),
  ('00000000-0000-0000-0000-00000e3a6001', 'primary_subject', 'Médico denunciado',     'Médicos denunciados', null),
  ('00000000-0000-0000-0000-00000e3a6001', 'timeline',        'Cronologia processual', null,                  null),
  ('00000000-0000-0000-0000-00000e3a6001', 'document',        'Documento',             'Documentos',          null),
  ('00000000-0000-0000-0000-00000e3a6001', 'decision',        'Decisão',               'Decisões',            null);
-- Type T2: PARTIAL bundle (only case + decision; timeline/primary_subject/document absent).
insert into public.case_types
  (id, organization_id, key, display_name, primary_subject_kind)
values ('00000000-0000-0000-0000-00000e3a6002', (select org_x from k), 'e3a_partial', 'Tipo parcial', 'entity');
insert into public.case_type_terminology (case_type_id, term_key, singular_label, plural_label, help_text)
values
  ('00000000-0000-0000-0000-00000e3a6002', 'case',     'Processo', 'Processos', null),
  ('00000000-0000-0000-0000-00000e3a6002', 'decision', 'Parecer',  'Pareceres', null);
-- A typed case E (→ T) and a type-less commission_default case C.
insert into public.cases (id, commission_id, case_number, case_type_id, created_by, visibility_policy)
values ('00000000-0000-0000-0000-00000e3a6003', (select comm_x from k), 96003,
        '00000000-0000-0000-0000-00000e3a6001', (select sa_x from k), 'explicit_grants_only');
insert into public.cases (id, commission_id, case_number, created_by)
values ('00000000-0000-0000-0000-00000e3a6004', (select comm_x from k), 96004, (select sa_x from k));
-- st_x becomes a granted WRITE content-writer of C (non-coordinator).
select test_helpers.grant_ca('00000000-0000-0000-0000-00000e3a6004', (select st_x from k), 'write', (select sa_x from k));

-- --- Terminology data + RLS SELECT-ability -----------------------------------
-- (1) an ordinary org member reads a type's terminology bundle (RLS is_org_member).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_type_terminology
             where case_type_id = '00000000-0000-0000-0000-00000e3a6001'),
  5, 'RLS: an ordinary org member reads the type''s 5-key terminology bundle');
select is((select singular_label from public.case_type_terminology
             where case_type_id = '00000000-0000-0000-0000-00000e3a6001' and term_key = 'case'),
  'Denúncia', 'the case term renders its override "Denúncia"');
reset role;

-- (3)+(4) the partial bundle exposes ONLY its present keys (resolver falls back for the rest).
select is((select count(*)::int from public.case_type_terminology
             where case_type_id = '00000000-0000-0000-0000-00000e3a6002'),
  2, 'a partial bundle has exactly its 2 present keys');
select ok((select count(*)::int from public.case_type_terminology
             where case_type_id = '00000000-0000-0000-0000-00000e3a6002' and term_key = 'timeline') = 0,
  'the partial bundle has NO timeline row (resolver falls back to default for that key)');

-- --- primary_subject_kind projection (cases→case_types join) -----------------
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select ct.primary_subject_kind
             from public.cases c join public.case_types ct on ct.id = c.case_type_id
             where c.id = '00000000-0000-0000-0000-00000e3a6003'),
  'professional', 'a typed case projects its type''s primary_subject_kind (professional)');
select is((select case_type_id from public.cases where id = '00000000-0000-0000-0000-00000e3a6004'),
  null, 'a type-less case has case_type_id null (resolver defaults primarySubjectKind to patient)');
reset role;

-- --- manual visibility write-gate --------------------------------------------
-- (7) a coordinator (staff_admin) may write a coordinator_only manual event.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ insert into public.case_events (case_id, kind, body, visibility, created_by)
     values ('00000000-0000-0000-0000-00000e3a6004', 'note', 'Nota reservada', 'coordinator_only', null) $$,
  'coordinator may write a coordinator_only manual event');
reset role;

-- (8)+(9) a granted NON-coordinator writer is refused coordinator_only, allowed case_readers.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ insert into public.case_events (case_id, kind, body, visibility, created_by)
     values ('00000000-0000-0000-0000-00000e3a6004', 'note', 'Tentativa', 'coordinator_only', null) $$,
  '42501', null,
  'a granted non-coordinator writer is REFUSED coordinator_only (WITH CHECK gate)');
select lives_ok(
  $$ insert into public.case_events (case_id, kind, body, visibility, created_by)
     values ('00000000-0000-0000-0000-00000e3a6004', 'note', 'Nota comum', 'case_readers', null) $$,
  'a granted non-coordinator writer MAY write a case_readers event');
reset role;

select * from finish();
rollback;
