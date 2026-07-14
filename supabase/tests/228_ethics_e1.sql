-- =============================================================================
-- ETH·E1 — Ethics access spine (ADR 0072). The m2-flip GATE file.
--
-- Grows per BE task (BE-2..BE-7); the whole ordered suite re-runs on a FRESH reset
-- (memory pgtap-needs-fresh-reset-vs-e2e-leftovers). Proves, end to end against the
-- hermetic bootstrap fixture, the confidentiality/visibility snapshot (BE-2), the
-- recusal/COI tables + RLS (BE-3), the modified access predicates incl. the
-- respondent/recusal hard-deny + explicit_grants_only suppression + doc ceiling
-- (BE-4), the participant/recusal write authority (BE-5), the IV2 fold-in (BE-6),
-- and the modified reads/audit (BE-7).
--
-- Personas (test_helpers.bootstrap): admin, sa_x (staff_admin of comm_x), st_x /
-- st_x2 (plain members of comm_x), sa_y (staff_admin of comm_y). claims_for(uid,
-- is_admin) sets auth.uid(); `set local role authenticated` runs a block under RLS.
-- =============================================================================

begin;
select plan(13);

-- cases RPCs need cases_multi_phase; case_types toggled per-test for the snapshot gate.
update app.feature_flags set enabled = true
  where key in ('cases_multi_phase');
update app.feature_flags set enabled = false where key = 'case_types';

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
         (v->>'ver_u')::uuid  as ver_u,
         app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

-- ===========================================================================
-- BE-2 — confidentiality + visibility snapshot (ADR 0072 D1).
-- ===========================================================================

-- Build a published 1-phase template in comm_x for create_case_from_template.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'Denúncia Ética', null)).id as tid;
reset role;
grant select on tpl to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_template_phase((select tid from tpl), (select form_u from k), 'Fase 1');
select public.publish_process_template((select tid from tpl));
reset role;

-- (1)+(2) a case created WITHOUT a case_type snapshots today's defaults.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table c_default on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso padrão')).id as cid;
reset role;
grant select on c_default to authenticated;

select is(
  (select visibility_policy from public.cases where id = (select cid from c_default)),
  'commission_default',
  'a case without a case_type defaults visibility_policy = commission_default');
select is(
  (select confidentiality_level from public.cases where id = (select cid from c_default)),
  'non_phi_internal',
  'a case without a case_type defaults confidentiality_level = non_phi_internal');

-- (3)+(4) the CHECK constraints reject out-of-vocabulary values (direct insert).
select throws_ok(
  format($$ insert into public.cases (commission_id, case_number, created_by, visibility_policy)
            values (%L, 99001, %L, 'bogus') $$,
          (select comm_x from k), (select sa_x from k)),
  '23514', null,
  'cases.visibility_policy CHECK rejects an out-of-vocabulary value');
select throws_ok(
  format($$ insert into public.cases (commission_id, case_number, created_by, confidentiality_level)
            values (%L, 99002, %L, 'top_secret') $$,
          (select comm_x from k), (select sa_x from k)),
  '23514', null,
  'cases.confidentiality_level CHECK rejects an out-of-vocabulary value');

-- (5) case_types.default_confidentiality_level defaults to non_phi_internal.
insert into public.case_types
  (id, organization_id, key, display_name, primary_subject_kind, default_visibility_policy)
values
  ('00000000-0000-0000-0000-0000000e0001', (select org_x from k), 'plain_type', 'Tipo padrão', 'none', 'commission_default');
select is(
  (select default_confidentiality_level from public.case_types
   where id = '00000000-0000-0000-0000-0000000e0001'),
  'non_phi_internal',
  'case_types.default_confidentiality_level defaults to non_phi_internal');

-- (6) case_access.max_confidentiality CHECK rejects an out-of-vocabulary value.
select throws_ok(
  format($$ insert into public.case_access (case_id, user_id, level, max_confidentiality, granted_by)
            values (%L, %L, 'read', 'bogus', %L) $$,
          (select cid from c_default), (select st_x from k), (select sa_x from k)),
  '23514', null,
  'case_access.max_confidentiality CHECK rejects an out-of-vocabulary value');

-- (7)+(8)+(9) confidentiality_rank is monotonic; unknown label → null.
select ok(
  app.confidentiality_rank('credentialing_sensitive') > app.confidentiality_rank('legal_privileged'),
  'confidentiality_rank: credentialing_sensitive outranks legal_privileged');
select is(app.confidentiality_rank('non_phi_internal'), 0,
  'confidentiality_rank: non_phi_internal is 0 (floor)');
select is(app.confidentiality_rank('nope'), null,
  'confidentiality_rank: an unknown label ranks null');

-- (10)+(11) snapshot APPLIES when a case_type is supplied AND case_types is ON.
update app.feature_flags set enabled = true where key = 'case_types';
insert into public.case_types
  (id, organization_id, key, display_name, primary_subject_kind,
   default_visibility_policy, default_confidentiality_level)
values
  ('00000000-0000-0000-0000-0000000e0002', (select org_x from k), 'ethics', 'Ética',
   'professional', 'explicit_grants_only', 'ethics_investigation');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table c_ethics on commit drop as
  select (public.create_case_from_template(
            (select tid from tpl), 'Caso ética', null, null,
            '00000000-0000-0000-0000-0000000e0002')).id as cid;
reset role;
grant select on c_ethics to authenticated;

select is(
  (select visibility_policy from public.cases where id = (select cid from c_ethics)),
  'explicit_grants_only',
  'snapshot: an ethics case_type sets visibility_policy = explicit_grants_only');
select is(
  (select confidentiality_level from public.cases where id = (select cid from c_ethics)),
  'ethics_investigation',
  'snapshot: an ethics case_type sets confidentiality_level = ethics_investigation');

-- (12) snapshot is SUPPRESSED when case_types is OFF (flag-OFF invariant).
update app.feature_flags set enabled = false where key = 'case_types';
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table c_flagoff on commit drop as
  select (public.create_case_from_template(
            (select tid from tpl), 'Caso flag-off', null, null,
            '00000000-0000-0000-0000-0000000e0002')).id as cid;
reset role;
grant select on c_flagoff to authenticated;
select is(
  (select visibility_policy from public.cases where id = (select cid from c_flagoff)),
  'commission_default',
  'snapshot suppressed with case_types OFF: visibility_policy stays commission_default');

-- (13) a case_type that does not resolve in the case's org is rejected at create
-- (the org-scoped `where … and organization_id = org_of_commission` + `if not found`
-- guard). A non-existent id exercises the same branch org-independently (the bootstrap
-- keeps comm_x and comm_y in one org, so an id is the unambiguous "unresolvable" probe).
update app.feature_flags set enabled = true where key = 'case_types';
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_case_from_template(%L, 'Caso cross', null, null,
            '00000000-0000-0000-0000-0000000e0999') $$, (select tid from tpl)),
  'P0002', null,
  'create_case_from_template rejects a case_type that does not resolve in the case''s org');
reset role;

select * from finish();
rollback;
