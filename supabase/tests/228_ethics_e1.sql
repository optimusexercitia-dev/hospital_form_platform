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
-- 125 → 132: Gate-2 fix wave. Proof 2 (was 2 row-count tests) is rewritten COLUMN-LEVEL
-- as 9 (4 preconditions + row + summary-mask + decision-visible + column-REVOKE + sweep)
-- and becomes A26/K16's only pin. See the Proof-2 block for the full rationale.
select plan(127);

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
  select (public.create_process_template((select comm_x from k), 'Denúncia Ética', null)).id as tid, null::uuid as vid;
-- ADR 0096: resolve the v1 draft in a SEPARATE statement. The helper is
-- STABLE, so inside the CREATE ... AS above it would see the pre-statement
-- snapshot and return NULL.
update tpl set vid = app.draft_version_of_template(tid);
reset role;
grant select on tpl to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_template_phase((select vid from tpl), (select form_u from k), 'Fase 1');
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

-- (6) case_access_grants.max_confidentiality CHECK rejects an out-of-vocabulary value.
select throws_ok(
  format($$ insert into public.case_access_grants (case_id, principal_id, read_case_content, max_confidentiality)
            values (%L, %L, true, 'bogus') $$,
          (select cid from c_default), (select st_x from k)),
  '23514', null,
  'case_access_grants.max_confidentiality CHECK rejects an out-of-vocabulary value');

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

-- ===========================================================================
-- BE-3 — case_conflict_declarations + case_recusals RLS (ADR 0072 D4).
-- Uses c_default (a commission_default case in comm_x). Setup rows inserted as
-- superuser (bypassing RLS); SELECT visibility asserted under each persona.
-- ===========================================================================
reset role;
insert into public.case_conflict_declarations (case_id, declarant_id, conflict_type, description_md)
values ((select cid from c_default), (select st_x from k), 'professional_relationship', 'conheço o denunciado');
insert into public.case_recusals (case_id, user_id, source, reason_md)
values ((select cid from c_default), (select st_x from k), 'coordinator', 'impedido pela coordenação');

-- (14)+(15) conflict declaration: a case reader (coordinator) sees it; a foreign
-- coordinator does not.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_conflict_declarations
           where case_id = (select cid from c_default)), 1,
  'a case coordinator SELECTs the conflict declaration (can_read_case arm)');
reset role;
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_conflict_declarations
           where case_id = (select cid from c_default)), 0,
  'a foreign coordinator does NOT see the conflict declaration');
reset role;

-- (16)+(17)+(18) recusal: coordinator sees it; foreign does not; the RECUSED user
-- sees their OWN recusal (self-arm).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_recusals
           where case_id = (select cid from c_default)), 1,
  'a case coordinator SELECTs the recusal (staff_admin coordinator arm)');
reset role;
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_recusals
           where case_id = (select cid from c_default)), 0,
  'a foreign coordinator does NOT see the recusal');
reset role;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_recusals
           where case_id = (select cid from c_default) and user_id = (select st_x from k)), 1,
  'the recused user SELECTs their OWN recusal row (self-arm)');
reset role;

-- (19)+(20) DIRECT authenticated writes are denied (no write policy / grant — DEFINER-only).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ insert into public.case_conflict_declarations (case_id, declarant_id, conflict_type)
            values (%L, %L, 'other') $$, (select cid from c_default), (select sa_x from k)),
  '42501', null,
  'a direct authenticated INSERT into case_conflict_declarations is denied (DEFINER-only)');
select throws_ok(
  format($$ insert into public.case_recusals (case_id, user_id, source)
            values (%L, %L, 'self') $$, (select cid from c_default), (select sa_x from k)),
  '42501', null,
  'a direct authenticated INSERT into case_recusals is denied (DEFINER-only)');
reset role;

-- (21) one declaration per (case, declarant) — unique_violation.
select throws_ok(
  format($$ insert into public.case_conflict_declarations (case_id, declarant_id, conflict_type)
            values (%L, %L, 'other') $$, (select cid from c_default), (select st_x from k)),
  '23505', null,
  'a second conflict declaration for the same (case, declarant) is rejected (unique)');

-- (22) one LIVE recusal per (case, user) — partial unique_violation.
select throws_ok(
  format($$ insert into public.case_recusals (case_id, user_id, source)
            values (%L, %L, 'self') $$, (select cid from c_default), (select st_x from k)),
  '23505', null,
  'a second LIVE recusal for the same (case, user) is rejected (partial unique)');

-- (23) a LIFTED recusal + a fresh LIVE recusal for the same (case, user) coexist.
update public.case_recusals set lifted_at = now(), lifted_by = (select sa_x from k)
  where case_id = (select cid from c_default) and user_id = (select st_x from k) and lifted_at is null;
select lives_ok(
  format($$ insert into public.case_recusals (case_id, user_id, source)
            values (%L, %L, 'coordinator') $$, (select cid from c_default), (select st_x from k)),
  'a fresh LIVE recusal is allowed once the prior one is lifted (partial unique)');

-- ===========================================================================
-- BE-4 — access predicates: respondent/recusal hard-deny, explicit_grants_only
-- suppression, document ceiling (ADR 0072 D2/D3/D5). Predicate truth-table
-- assertions call the DEFINER predicates directly (explicit p_uid); RLS-surface
-- assertions (self-arm SELECT, attachment list/open) use claims + role.
-- ===========================================================================
reset role;

-- Respondent fixture: st_x becomes the respondent_doctor of c_default (a
-- commission_default case). Flag-independent (the deny helper reads base tables).
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ('00000000-0000-0000-0000-0000000e0101', (select org_x from k), 'professional', 'professional_identity', 'Dr. Réu');
insert into public.professional_profiles (id, organization_id, user_id, full_name)
values ('00000000-0000-0000-0000-0000000e0102', (select org_x from k), (select st_x from k), 'Dr. Réu');
insert into public.professional_participants (participant_id, professional_profile_id)
values ('00000000-0000-0000-0000-0000000e0101', '00000000-0000-0000-0000-0000000e0102');
insert into public.case_participant_roles
  (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
values ('00000000-0000-0000-0000-0000000e0103', (select org_x from k), 'respondent_doctor',
  'Médico denunciado', array['professional'], true);
insert into public.case_participants (case_id, participant_id, role_id, is_primary_subject)
values ((select cid from c_default), '00000000-0000-0000-0000-0000000e0101',
        '00000000-0000-0000-0000-0000000e0103', true);

update app.feature_flags set enabled = false where key = 'case_access';

-- ADR 0078 Stage B: the flag-OFF member-read model is gone (member arm = deliberation
-- ONLY). st_x2 is made a case GRANTEE so the read-based assertions below (24, 31, and
-- the declare_conflict/recusal block) hold under the always-on model.
select test_helpers.grant_ca((select cid from c_default), (select st_x2 from k), 'read', (select sa_x from k));

-- (24) a case grantee reads the case (commission_default).
select is(app.can_read_case((select cid from c_default), (select st_x2 from k)), true,
  'commission_default: a case grantee reads the case');
-- (25)+(26)+(27) the respondent is HARD-DENIED on read, PHI door, and write.
select is(app.can_read_case((select cid from c_default), (select st_x from k)), false,
  'respondent-exclusion: the respondent_doctor cannot read their own case');
select is(app.can_read_case_patient((select cid from c_default), (select st_x from k)), false,
  'respondent-exclusion: the respondent cannot reach the PHI door');
select is(app.can_write_case_content((select cid from c_default), (select st_x from k)), false,
  'respondent-exclusion: the respondent cannot write case content');

-- (28) respondent beats a POSITIVE arm: even holding a case_access grant (case_access
-- ON), the respondent is denied — the deny-terms precede every grant arm.
update app.feature_flags set enabled = true where key = 'case_access';
select test_helpers.grant_ca((select cid from c_default), (select st_x from k), 'read', (select sa_x from k));
select is(app.can_read_case((select cid from c_default), (select st_x from k)), false,
  'respondent-exclusion beats a grant: a respondent with a case_access grant is still denied');

-- Recusal block (case_access OFF; st_x2 is a plain member who could otherwise read).
update app.feature_flags set enabled = false where key = 'case_access';
insert into public.case_recusals (case_id, user_id, source, reason_md)
values ((select cid from c_default), (select st_x2 from k), 'coordinator', 'conflito');
-- (29) a live recusal denies read via RLS.
select is(app.can_read_case((select cid from c_default), (select st_x2 from k)), false,
  'recusal: a live recusal denies case read');
-- (30) the recused user STILL sees their own recusal row (self-arm) despite the deny.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_recusals
           where case_id = (select cid from c_default) and user_id = (select st_x2 from k) and lifted_at is null), 1,
  'D4 asymmetry: a recused user reads their OWN recusal row while denied case read');
reset role;
-- (31) lifting restores read (also: commission_default unchanged for a clean member).
update public.case_recusals set lifted_at = now() where case_id = (select cid from c_default)
  and user_id = (select st_x2 from k) and lifted_at is null;
select is(app.can_read_case((select cid from c_default), (select st_x2 from k)), true,
  'recusal lift restores read (the grant is intact — the lift removes only the deny)');

-- explicit_grants_only block on c_ethics (case_access ON).
update app.feature_flags set enabled = true where key = 'case_access';
-- (32) a member with NO grant/attribution sees nothing.
select is(app.can_read_case((select cid from c_ethics), (select st_x2 from k)), false,
  'explicit_grants_only: a member without a grant cannot read the ethics case');
-- (33) a coordinator grant opens it.
select test_helpers.grant_ca((select cid from c_ethics), (select st_x2 from k), 'read', (select sa_x from k));
select is(app.can_read_case((select cid from c_ethics), (select st_x2 from k)), true,
  'explicit_grants_only: a case_access grant opens the ethics case');

-- ADR 0078 Stage B: the "flag-OFF belt" is gone. The grant from (33) applies at every
-- policy now, so (34) the grantee READS the ethics case and (35) the coordinator too.
update app.feature_flags set enabled = false where key = 'case_access';
select is(app.can_read_case((select cid from c_ethics), (select st_x2 from k)), true,
  'explicit_grants_only: the grant applies regardless of the retired flag — the grantee reads');
select is(app.can_read_case((select cid from c_ethics), (select sa_x from k)), true,
  'explicit_grants_only: the coordinator keeps read');

-- ===========================================================================
-- Document confidentiality ceiling (tests 36–40) — RETIRED WITH ITS SUBSTRATE
-- (DM1, ADR 0114 D5). ⚠ NAMED COVERAGE LOSS, deliberately parked, NOT quietly
-- absorbed: the ADR 0063 confidentiality_label ceiling (legal_privileged gated
-- ABOVE ordinary case-read via attachment_confidentiality_ok + the HC0E6 open
-- door; ethics_investigation stays visible — the O2 pair) has NO DM1 successor
-- surface: the document model defers per-document access semantics to the
-- access_policy_id seam (ADR 0114 D6/O3) and its tables carry no label column.
-- Reachability today: zero documents exist anywhere; the max_confidentiality
-- grant column itself is untouched (its carrier keystones live in 144/238).
-- The ceiling's RETURN VEHICLE (Wave A/B design or the O3 plane) is a PO/lead
-- decision recorded in docs/progress/dm1-substrate-cutover.md §triage ledger —
-- whoever builds it must restore all FIVE pins: absent-from-list, refused-open,
-- O2-stays-visible, clearance-admits-list, clearance-admits-open.
--
-- The retired block's clearance grant was FIXTURE, not assertion — the
-- interview-confidentiality tests below (set_interview_confidentiality
-- enforcing pair) still need sa_x to hold legal_privileged clearance on
-- c_default. Kept:
-- ===========================================================================
select test_helpers.grant_ca((select cid from c_default), (select sa_x from k), 'read', (select sa_x from k), null, 'legal_privileged');

-- ===========================================================================
-- BE-5 — DEFINER write authority (ADR 0072 D6/D8). The ethics write spine gates
-- on the case_participants flag + audit_trail for the audit assertions.
-- ===========================================================================
reset role;
update app.feature_flags set enabled = true where key in ('case_participants', 'audit_trail');
update app.feature_flags set enabled = false where key = 'case_access';

-- (t19) anon must NOT execute any of the 10 new RPCs.
select is(has_function_privilege('anon', 'public.add_case_participant(uuid,uuid,uuid,boolean,text)', 'EXECUTE'), false, 't19: anon cannot EXECUTE add_case_participant');
select is(has_function_privilege('anon', 'public.remove_case_participant(uuid)', 'EXECUTE'), false, 't19: anon cannot EXECUTE remove_case_participant');
select is(has_function_privilege('anon', 'public.set_primary_subject(uuid)', 'EXECUTE'), false, 't19: anon cannot EXECUTE set_primary_subject');
select is(has_function_privilege('anon', 'public.set_case_participant_role(uuid,uuid)', 'EXECUTE'), false, 't19: anon cannot EXECUTE set_case_participant_role');
select is(has_function_privilege('anon', 'public.create_professional_profile(uuid,text,text,text,text,text,text,uuid)', 'EXECUTE'), false, 't19: anon cannot EXECUTE create_professional_profile');
select is(has_function_privilege('anon', 'public.update_professional_profile(uuid,text,text,text,text,text,text)', 'EXECUTE'), false, 't19: anon cannot EXECUTE update_professional_profile');
select is(has_function_privilege('anon', 'public.set_case_confidentiality(uuid,text)', 'EXECUTE'), false, 't19: anon cannot EXECUTE set_case_confidentiality');
select is(has_function_privilege('anon', 'public.declare_conflict(uuid,text,text)', 'EXECUTE'), false, 't19: anon cannot EXECUTE declare_conflict');
select is(has_function_privilege('anon', 'public.record_recusal(uuid,uuid,text,uuid)', 'EXECUTE'), false, 't19: anon cannot EXECUTE record_recusal');
select is(has_function_privilege('anon', 'public.lift_recusal(uuid,text)', 'EXECUTE'), false, 't19: anon cannot EXECUTE lift_recusal');

-- (t19) authenticated MUST execute each (the grant lives).
select is(has_function_privilege('authenticated', 'public.add_case_participant(uuid,uuid,uuid,boolean,text)', 'EXECUTE'), true, 't19: authenticated can EXECUTE add_case_participant');
select is(has_function_privilege('authenticated', 'public.remove_case_participant(uuid)', 'EXECUTE'), true, 't19: authenticated can EXECUTE remove_case_participant');
select is(has_function_privilege('authenticated', 'public.set_primary_subject(uuid)', 'EXECUTE'), true, 't19: authenticated can EXECUTE set_primary_subject');
select is(has_function_privilege('authenticated', 'public.set_case_participant_role(uuid,uuid)', 'EXECUTE'), true, 't19: authenticated can EXECUTE set_case_participant_role');
select is(has_function_privilege('authenticated', 'public.create_professional_profile(uuid,text,text,text,text,text,text,uuid)', 'EXECUTE'), true, 't19: authenticated can EXECUTE create_professional_profile');
select is(has_function_privilege('authenticated', 'public.update_professional_profile(uuid,text,text,text,text,text,text)', 'EXECUTE'), true, 't19: authenticated can EXECUTE update_professional_profile');
select is(has_function_privilege('authenticated', 'public.set_case_confidentiality(uuid,text)', 'EXECUTE'), true, 't19: authenticated can EXECUTE set_case_confidentiality');
select is(has_function_privilege('authenticated', 'public.declare_conflict(uuid,text,text)', 'EXECUTE'), true, 't19: authenticated can EXECUTE declare_conflict');
select is(has_function_privilege('authenticated', 'public.record_recusal(uuid,uuid,text,uuid)', 'EXECUTE'), true, 't19: authenticated can EXECUTE record_recusal');
select is(has_function_privilege('authenticated', 'public.lift_recusal(uuid,text)', 'EXECUTE'), true, 't19: authenticated can EXECUTE lift_recusal');

-- Fixtures: an external_person participant + a role that admits it.
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ('00000000-0000-0000-0000-0000000e0111', (select org_x from k), 'external_person', 'non_sensitive', 'Testemunha');
insert into public.case_participant_roles
  (id, organization_id, key, display_name, allowed_participant_types)
values ('00000000-0000-0000-0000-0000000e0112', (select org_x from k), 'witness', 'Testemunha', array['external_person']);

-- add_case_participant: coordinator OK; reader HC0E4; type/role mismatch HC0E3.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.add_case_participant(%L, '00000000-0000-0000-0000-0000000e0111',
            '00000000-0000-0000-0000-0000000e0112') $$, (select cid from c_default)),
  'add_case_participant: a coordinator links a participant');
select throws_ok(
  format($$ select public.add_case_participant(%L, '00000000-0000-0000-0000-0000000e0111',
            '00000000-0000-0000-0000-0000000e0103') $$, (select cid from c_default)),
  'HC0E3', null,
  'add_case_participant: a role incompatible with the participant type raises HC0E3');
reset role;
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_case_participant(%L, '00000000-0000-0000-0000-0000000e0111',
            '00000000-0000-0000-0000-0000000e0112') $$, (select cid from c_default)),
  'HC0E4', null,
  'add_case_participant: a non-coordinator reader is denied (HC0E4)');
-- case_participants stays SELECT-only: a direct authenticated INSERT is denied.
select throws_ok(
  format($$ insert into public.case_participants (case_id, participant_id, role_id)
            values (%L, '00000000-0000-0000-0000-0000000e0111', '00000000-0000-0000-0000-0000000e0112') $$,
          (select cid from c_default)),
  '42501', null,
  'case_participants stays SELECT-only: a direct authenticated INSERT is denied');
reset role;

-- set_case_confidentiality: coordinator OK; reader HC0E4; invalid level HC0E5.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.set_case_confidentiality(%L, 'ethics_investigation') $$, (select cid from c_default)),
  'set_case_confidentiality: a coordinator reclassifies the case');
select throws_ok(
  format($$ select public.set_case_confidentiality(%L, 'bogus') $$, (select cid from c_default)),
  'HC0E5', null,
  'set_case_confidentiality: an invalid level raises HC0E5');
reset role;
select is((select confidentiality_level from public.cases where id = (select cid from c_default)),
  'ethics_investigation', 'set_case_confidentiality persisted the new ceiling');
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_confidentiality(%L, 'legal_privileged') $$, (select cid from c_default)),
  'HC0E4', null,
  'set_case_confidentiality: a non-coordinator is denied (HC0E4)');

-- declare_conflict: a case reader self-declares; a duplicate raises HC0E2.
select lives_ok(
  format($$ select public.declare_conflict(%L, 'personal_relationship', 'conheço o denunciado') $$,
          (select cid from c_default)),
  'declare_conflict: a case reader self-declares a conflict');
select throws_ok(
  format($$ select public.declare_conflict(%L, 'other', 'de novo') $$, (select cid from c_default)),
  'HC0E2', null,
  'declare_conflict: a second declaration by the same user raises HC0E2');
reset role;

-- record_recusal: coordinator recuses st_x2 → st_x2 immediately loses read; duplicate HC0E0.
select is(app.can_read_case((select cid from c_default), (select st_x2 from k)), true,
  'baseline: st_x2 can read c_default before the recusal');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.record_recusal(%L, %L, 'conflito confirmado') $$,
          (select cid from c_default), (select st_x2 from k)),
  'record_recusal: a coordinator records a recusal');
select throws_ok(
  format($$ select public.record_recusal(%L, %L, 'de novo') $$,
          (select cid from c_default), (select st_x2 from k)),
  'HC0E0', null,
  'record_recusal: a second LIVE recusal for the same user raises HC0E0');
reset role;
select is(app.can_read_case((select cid from c_default), (select st_x2 from k)), false,
  'record_recusal takes effect immediately: st_x2 loses read via the deny-term');

-- lift_recusal: coordinator lifts → read restored; a second lift raises HC0E1.
create temp table rec on commit drop as
  select id from public.case_recusals
  where case_id = (select cid from c_default) and user_id = (select st_x2 from k) and lifted_at is null;
grant select on rec to authenticated;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.lift_recusal(%L, 'esclarecido') $$, (select id from rec)),
  'lift_recusal: a coordinator lifts the recusal');
select throws_ok(
  format($$ select public.lift_recusal(%L, 'de novo') $$, (select id from rec)),
  'HC0E1', null,
  'lift_recusal: lifting an already-lifted recusal raises HC0E1');
reset role;
select is(app.can_read_case((select cid from c_default), (select st_x2 from k)), true,
  'lift_recusal restores read for st_x2');

-- create/update_professional_profile: coordinator OK; a plain member is denied (42501).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table prof on commit drop as
  select public.create_professional_profile((select org_x from k), 'Dr. Teste', 'medico') as pid;
grant select on prof to authenticated;
select ok((select pid from prof) is not null,
  'create_professional_profile: a coordinator creates a profile');
select lives_ok(
  format($$ select public.update_professional_profile(%L, 'Dr. Teste Corrigido') $$, (select pid from prof)),
  'update_professional_profile: a coordinator corrects a profile');
reset role;
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_professional_profile(%L, 'Dr. Intruso') $$, (select org_x from k)),
  '42501', null,
  'create_professional_profile: a plain member (non-coordinator) is denied (42501)');
reset role;

-- audit: each mutation emitted exactly ONE PHI-free row; the professional row has no payload.
select is((select count(*)::int from public.audit_log
           where action = 'case.participant_added' and entity_id = (select cid from c_default)), 1,
  'audit: participant-add emitted exactly one row');
select is((select count(*)::int from public.audit_log
           where action = 'case.recusal_recorded' and entity_id = (select cid from c_default)), 1,
  'audit: recusal-record emitted exactly one row');
select is((select count(*)::int from public.audit_log
           where action = 'case.confidentiality_changed' and entity_id = (select cid from c_default)), 1,
  'audit: confidentiality-change emitted exactly one row');
select ok(
  not exists (select 1 from public.audit_log
              where action = 'professional_profile.created' and metadata::text ilike '%Teste%'),
  'audit (Rule 11): the professional_profile.created row carries NO identity payload');

-- ===========================================================================
-- BE-6 — IV2 fold-in (ADR 0072 D7): participant FK, enforcing confidentiality
-- (O3 remap), per-session attendance. Interviews + case_participants + case_access
-- + audit_trail ON.
-- ===========================================================================
reset role;
update app.feature_flags set enabled = true
  where key in ('interviews', 'case_participants', 'case_access', 'audit_trail');

-- (t19) grants on the 5 fold-in RPCs.
select is(has_function_privilege('anon', 'public.set_interview_participant(uuid,uuid)', 'EXECUTE'), false, 't19: anon cannot EXECUTE set_interview_participant');
select is(has_function_privilege('anon', 'public.set_interview_subject_participant(uuid,uuid)', 'EXECUTE'), false, 't19: anon cannot EXECUTE set_interview_subject_participant');
select is(has_function_privilege('anon', 'public.set_interview_interviewer_participant(uuid,uuid)', 'EXECUTE'), false, 't19: anon cannot EXECUTE set_interview_interviewer_participant');
select is(has_function_privilege('anon', 'public.set_interview_confidentiality(uuid,text)', 'EXECUTE'), false, 't19: anon cannot EXECUTE set_interview_confidentiality');
select is(has_function_privilege('anon', 'public.record_session_attendance(uuid,uuid,text,text)', 'EXECUTE'), false, 't19: anon cannot EXECUTE record_session_attendance');
select is(has_function_privilege('authenticated', 'public.set_interview_participant(uuid,uuid)', 'EXECUTE'), true, 't19: authenticated can EXECUTE set_interview_participant');
select is(has_function_privilege('authenticated', 'public.set_interview_subject_participant(uuid,uuid)', 'EXECUTE'), true, 't19: authenticated can EXECUTE set_interview_subject_participant');
select is(has_function_privilege('authenticated', 'public.set_interview_interviewer_participant(uuid,uuid)', 'EXECUTE'), true, 't19: authenticated can EXECUTE set_interview_interviewer_participant');
select is(has_function_privilege('authenticated', 'public.set_interview_confidentiality(uuid,text)', 'EXECUTE'), true, 't19: authenticated can EXECUTE set_interview_confidentiality');
select is(has_function_privilege('authenticated', 'public.record_session_attendance(uuid,uuid,text,text)', 'EXECUTE'), true, 't19: authenticated can EXECUTE record_session_attendance');

-- Fixtures: a plain (no-clearance) read grant for st_x2 on c_default; a case
-- participant on c_default; another on c_ethics (for the cross-case validation).
select test_helpers.grant_ca((select cid from c_default), (select st_x2 from k), 'read', (select sa_x from k));
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ('00000000-0000-0000-0000-0000000e0121', (select org_x from k), 'external_person', 'non_sensitive', 'Entrevistado');
insert into public.case_participants (id, case_id, participant_id, role_id)
values ('00000000-0000-0000-0000-0000000e0122', (select cid from c_default),
        '00000000-0000-0000-0000-0000000e0121', '00000000-0000-0000-0000-0000000e0112');
insert into public.case_participants (id, case_id, participant_id, role_id)
values ('00000000-0000-0000-0000-0000000e0123', (select cid from c_ethics),
        '00000000-0000-0000-0000-0000000e0121', '00000000-0000-0000-0000-0000000e0112');

-- Create an interview on c_default + two sessions.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table iv on commit drop as
  select id from public.create_interview((select cid from c_default), 'Entrevista E1', null, 'witness', 'standard');
grant select on iv to authenticated;
select public.schedule_session((select id from iv));
select public.schedule_session((select id from iv));
reset role;
grant select on iv to authenticated;

-- normalization: legacy 'standard' → non_phi_internal.
select is((select confidentiality_level from public.case_interviews where id = (select id from iv)),
  'non_phi_internal', 'O3 remap: create_interview(''standard'') normalizes to non_phi_internal');

-- set_interview_participant: sets the FK; a cross-case participant is rejected.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.set_interview_participant(%L, '00000000-0000-0000-0000-0000000e0122') $$,
          (select id from iv)),
  'set_interview_participant: coordinator ties the interview to a case participant');
select throws_ok(
  format($$ select public.set_interview_participant(%L, '00000000-0000-0000-0000-0000000e0123') $$,
          (select id from iv)),
  '23514', null,
  'set_interview_participant: a participant from another case is rejected');
reset role;
select is((select participant_id from public.case_interviews where id = (select id from iv)),
  '00000000-0000-0000-0000-0000000e0122'::uuid,
  'set_interview_participant persisted the FK');

-- record_session_attendance: same participant across the two sessions.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.record_session_attendance(s.id, '00000000-0000-0000-0000-0000000e0122')
            from (select id from public.interview_sessions where interview_id = %L order by sequence_number) s $$,
          (select id from iv)),
  'record_session_attendance: records attendance across the interview''s sessions');
select throws_ok(
  format($$ select public.record_session_attendance(
              (select id from public.interview_sessions where interview_id = %L order by sequence_number limit 1),
              '00000000-0000-0000-0000-0000000e0123') $$, (select id from iv)),
  '23514', null,
  'record_session_attendance: a participant from another case is rejected');
reset role;
select is(
  (select count(distinct participant_id)::int from public.interview_session_attendance a
   join public.interview_sessions s on s.id = a.session_id
   where s.interview_id = (select id from iv)
     and a.participant_id = '00000000-0000-0000-0000-0000000e0122'), 1,
  'the SAME participant resolves across the interview''s two sessions');
select is(
  (select count(*)::int from public.interview_session_attendance a
   join public.interview_sessions s on s.id = a.session_id
   where s.interview_id = (select id from iv)), 2,
  'attendance recorded on both sessions');

-- set_interview_confidentiality: enforcing. legal_privileged hides the interview from
-- a below-clearance reader; a cleared reader still sees it; invalid + non-writer errors.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.set_interview_confidentiality(%L, 'legal_privileged') $$, (select id from iv)),
  'set_interview_confidentiality: coordinator raises the interview to legal_privileged');
select throws_ok(
  format($$ select public.set_interview_confidentiality(%L, 'bogus') $$, (select id from iv)),
  'HC0E5', null,
  'set_interview_confidentiality: an invalid level raises HC0E5');
reset role;
select is(app.can_read_interview((select id from iv), (select st_x2 from k)), false,
  'enforcing: a below-clearance reader (plain grant) no longer sees the legal_privileged interview');
select is(app.can_read_interview((select id from iv), (select sa_x from k)), true,
  'enforcing: a cleared reader (legal_privileged clearance) still sees the interview');
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_interview_confidentiality(%L, 'phi_standard') $$, (select id from iv)),
  'HC039', null,
  'set_interview_confidentiality: a non-writer is denied (HC039)');
reset role;
select is((select count(*)::int from public.audit_log
           where action = 'interview.confidentiality_changed' and entity_id = (select id from iv)), 1,
  'audit: interview.confidentiality_changed emitted one row');

-- ===========================================================================
-- BE-7 — modified reads: list_my_cases respondent/recusal exclusion (ADR 0072 §2.3).
-- st_x2 holds a case_access grant on c_default (from BE-6); st_x is the respondent
-- (BE-4) and also holds a grant (BE-4). case_access ON.
-- ===========================================================================
reset role;
update app.feature_flags set enabled = true where key in ('case_access', 'case_participants');

-- (1) baseline: a granted, non-respondent, non-recused member sees the case in Meus Casos.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is(
  (select count(*)::int from jsonb_array_elements(public.list_my_cases((select comm_x from k))) e
   where (e->>'case_id')::uuid = (select cid from c_default)), 1,
  'list_my_cases: a granted member sees the case');
reset role;

-- (2) recusing st_x2 removes the case from their personal list.
insert into public.case_recusals (case_id, user_id, source, reason_md)
values ((select cid from c_default), (select st_x2 from k), 'coordinator', 'impedido');
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is(
  (select count(*)::int from jsonb_array_elements(public.list_my_cases((select comm_x from k))) e
   where (e->>'case_id')::uuid = (select cid from c_default)), 0,
  'list_my_cases: a recused member no longer sees the case (explicit exclusion)');
reset role;

-- (3) the respondent (also a grant-holder) is excluded from their personal list.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from jsonb_array_elements(public.list_my_cases((select comm_x from k))) e
   where (e->>'case_id')::uuid = (select cid from c_default)), 0,
  'list_my_cases: the respondent is excluded even though granted (respondent exclusion)');
reset role;

-- ===========================================================================
-- QA fix loop (review phase-ETH-E1) — the two Majors. These assert at the LAYER
-- the defects live in, which the predicate-only assertions above could not reach:
--   MAJOR-1: a real table-level `select` under `set local role authenticated`, with
--            the respondent/recused persona ALSO an org_admin (the admin OR-arm the
--            consuming policies applied OUTSIDE the DEFINER out-voted the hard-deny).
--   MAJOR-2: record_recusal's self-arm had no reach gate (cross-tenant write + oracle).
-- State here: st_x = respondent_doctor of c_default (BE-4); st_x2 = LIVE recusal on
-- c_default (BE-7); sa_y = foreign coordinator with NO reach into c_default.
-- ===========================================================================
reset role;

-- (MAJOR-2) a caller with NO reach cannot self-recuse into a foreign case, and gets the
-- not-found posture (record_recusal must not be a case-existence oracle).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.record_recusal(%L, %L, 'sonda') $$,
          (select cid from c_default), (select sa_y from k)),
  'P0002', null,
  'QA MAJOR-2: a no-reach user cannot self-recuse into a foreign case (P0002 — no oracle)');
reset role;

-- ===========================================================================
-- QA MAJOR-3 (round 2) — meeting_cases leaks case deliberation (summary/decision).
-- Its policies key ONLY on the meeting dimension, with no case predicate at any layer.
-- Run BEFORE the org_admin grants below, so st_x / st_x2 are still PLAIN STAFF — QA's
-- canonical persona ("even though they are a commission member").
--
-- The three properties are in tension, which is the whole difficulty here:
--   Proof 1  a plain-staff RESPONDENT must not read deliberation about their own case;
--   Proof 2  a NON-GRANTED member must not read an explicit_grants_only case's
--            deliberation (no respondent involved — a different reach path);
--   NO-OP    a plain member MUST still read an ORDINARY (commission_default) linked
--            case's deliberation — meetings routinely discuss ordinary cases.
-- ===========================================================================
reset role;

-- A meeting in comm_x linking three cases: the respondent's (c_default), the ethics
-- case (c_ethics, explicit_grants_only) and an ordinary one (c_flagoff, the no-op guard).
insert into public.meetings (id, commission_id, meeting_number, title, scheduled_start)
values ('bb000000-0000-0000-0000-0000000000e1', (select comm_x from k), 9001,
        'Reunião de deliberação', now());
insert into public.meeting_cases (meeting_id, case_id, summary, decision) values
  ('bb000000-0000-0000-0000-0000000000e1', (select cid from c_default),
   'Conduta do Dr. Respondente analisada pelo comitê', 'Encaminhar para sindicância'),
  ('bb000000-0000-0000-0000-0000000000e1', (select cid from c_ethics),
   'Deliberação ética confidencial sobre o Dr. X', 'Sanção proposta: advertência'),
  ('bb000000-0000-0000-0000-0000000000e1', (select cid from c_flagoff),
   'Discussão de caso comum', 'Arquivar');
-- Proof-2 persona: a member of comm_x with NO grant on the ethics case.
delete from public.case_access_grants
  where case_id = (select cid from c_ethics) and principal_id = (select st_x2 from k);

-- Generic leak sweep (QA round-2 process note): enumerate every case_id-bearing base
-- table FROM THE CATALOG (never a hand-maintained list) + `cases` itself, and report any
-- table the caller can read rows from for a given case. SECURITY INVOKER ⇒ RLS applies
-- under the assumed role. A table the role cannot select at all is not a leak (0).
-- NOTE: case_recusals' self-arm (D4) is intentional — the personas below deliberately
-- hold no self-recusal on the case they sweep, so it must still read 0.
-- p_licensed_tables — tables whose ROW is deliberately readable for this persona, so the
-- row-count sweep would report a false leak. Passing a table here is a CLAIM that its
-- payload is closed by COLUMN masking instead, and every use below pairs it with explicit
-- masking assertions. The sweep stays fail-closed for every table not named.
create or replace function public._e1_sweep_case_leaks(p_case_id uuid, p_uid uuid,
                                                       p_licensed_tables text[])
  returns table(tbl text, n bigint)
  language plpgsql security invoker
as $$
declare r record; c bigint;
begin
  for r in
    select t.table_name as tn
    from information_schema.tables t
    join information_schema.columns col
      on col.table_schema = t.table_schema and col.table_name = t.table_name
    where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
      and col.column_name = 'case_id'
      -- DOCUMENTED EXCLUSION (the sweep is otherwise FAIL-CLOSED: anything not listed
      -- here must read ZERO, so a future table with the wrong shape fails automatically
      -- without anyone predicting it).
      --   patient_safety_event — governed by app.can_read_event, whose arms are
      --     owner-commission / reporting-commission / NSP-operator ONLY: there is no case
      --     arm by design. An NSP event is its OWN record (own lifecycle, own content)
      --     that merely LINKS to a case; a CCIH member could read it before E1 and
      --     independently of any case. It carries no case deliberation. Gating it on
      --     case-read would rewrite the NSP (PHI module 1) access model, which E1 does
      --     not own — the same disposition as action_items' assignees_only arm, which the
      --     PO is carrying as a known gap. Flagged to the lead, NOT silently dropped.
      and t.table_name not in ('patient_safety_event')
      -- DOCUMENTED PER-CALL LICENCE (see p_licensed_tables). Used for meeting_cases at
      -- Proof 2: A6 rules meeting LINKAGE a procedural record — a member may know a case
      -- was on the pauta — and A26 (PO) makes the `decision` tier MEMBER-WIDE. The row is
      -- therefore legitimately readable and its payload is closed by column masking
      -- (`summary` via read_case_deliberation) + the base-table column REVOKE, not by
      -- hiding the row. Asserted explicitly at the call site rather than assumed here.
      and not (t.table_name = any (p_licensed_tables))
    union all select 'cases'
    order by 1
  loop
    begin
      if r.tn = 'cases' then
        execute 'select count(*) from public.cases where id = $1' into c using p_case_id;
      elsif r.tn = 'case_recusals' then
        -- DOCUMENTED SELF-ARM (not a leak): a user may always see their OWN recusal row
        -- (ADR 0072 D4 — so a recused member can be shown "você está impedido" without
        -- gaining case read). Count only rows the persona does NOT own.
        execute 'select count(*) from public.case_recusals where case_id = $1 and user_id <> $2'
          into c using p_case_id, p_uid;
      elsif r.tn = 'case_access_grants' then
        -- DOCUMENTED SELF-ARM (ADR 0078 Stage B): a principal may see their OWN grant
        -- (case_access_grants_select_own; principal_id, not user_id). Everything else must
        -- read zero — an excluded respondent must not see OTHER principals' grants.
        execute 'select count(*) from public.case_access_grants where case_id = $1 and principal_id <> $2'
          into c using p_case_id, p_uid;
      else
        execute format('select count(*) from public.%I where case_id = $1', r.tn)
          into c using p_case_id;
      end if;
    exception when insufficient_privilege then c := 0;
    end;
    if c > 0 then tbl := r.tn; n := c; return next; end if;
  end loop;
end;
$$;
grant execute on function public._e1_sweep_case_leaks(uuid, uuid, text[]) to authenticated;

-- NO-OP GUARD (must hold BEFORE and AFTER the fix): a plain member with NO grant and NO
-- attribution still reads an ORDINARY linked case's deliberation. This is the regression
-- QA's suggested `can_read_case_or_admin` conjunct would have caused.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.meeting_cases where case_id = (select cid from c_flagoff)), 1,
  'MAJOR-3 NO-OP: a plain member still reads an ORDINARY (commission_default) linked case''s deliberation');
reset role;
-- …and this is WHY a bare can_read_case_or_admin conjunct would have broken it: that
-- predicate is false for an ordinary member of an ordinary case (no member arm on the
-- case_access-ON path). Locks the reasoning behind the member-surface predicate.
select is(app.can_read_case((select cid from c_flagoff), (select st_x2 from k)), false,
  'MAJOR-3: can_read_case is FALSE for a plain member of an ordinary case (why the member-surface predicate exists — A21 retired the can_read_case_or_admin wrapper, byte-equivalent here)');

-- PROOF 1 — a plain-staff RESPONDENT must not read deliberation about their own case.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
-- ⭐ PROOF 1 STANDS AS WRITTEN — the CODE was wrong (qa `authz-gate-2-review.md` §4).
-- meeting_cases_select was `can_reach_meeting(...)` alone, so the respondent read the
-- linkage for his own case. summary/decision were masked, so the PAYLOAD was safe — but
-- meeting_cases has no stub role: its unmasked columns ARE the linkage (case_id /
-- meeting_id / agenda_item_id), the process number's UUID equivalent, and agenda_item_id
-- walked to that item's then-unmasked `description` (MAJOR-1). A7/O6 gives the respondent
-- the bare stub only. Fixed by 20260816000300 with `AND NOT app.is_case_respondent(...)`
-- — NOT is_case_excluded, which would blind every RECUSED member (keystone 10).
select is((select count(*)::int from public.meeting_cases where case_id = (select cid from c_default)), 0,
  'QA MAJOR-3 Proof 1: a plain-staff respondent reads NO meeting_cases deliberation of their own case');
-- No licence for the respondent: meeting_cases stays IN the sweep and must read 0, so the
-- fail-closed design still covers him.
select is((select coalesce(string_agg(tbl || '=' || n, ', ' order by tbl), '') from public._e1_sweep_case_leaks((select cid from c_default), (select st_x from k), '{}'::text[])), '',
  'QA MAJOR-3 SWEEP: an excluded respondent reads ZERO rows from EVERY case_id-bearing table');
reset role;

-- PROOF 2 — REWRITTEN COLUMN-LEVEL. ⭐ THE TEST WAS WRONG, NOT THE CODE
-- (qa `authz-gate-2-review.md` §4; PO-ruled).
--
-- This test used to assert a non-granted member reads ZERO meeting_cases rows for an
-- explicit_grants_only case. A26 (the later PO ruling), A5's decision tier, A6 and
-- KEYSTONE 16 all say the opposite — K16: "a member without substance reach on a
-- sub-group case STILL READS THE DECISION." If the old assertion were satisfied, K16
-- would necessarily fail. Two keystones from one ADR cannot both hold; A26 wins.
--
-- ⭐⭐ THESE ASSERTIONS ARE A26/K16's ONLY PIN. Nothing else in the suite pins the
-- member-wide widening. Without them a future reviewer reads the same "leak", "fixes" it,
-- and SILENTLY REVERSES A PO RULING (qa open risk 2). The row being visible here is
-- CORRECT AND DELIBERATE. Do not "tidy" it into a zero-row assertion — if this test ever
-- looks like a leak to you, read A26 and A6 first.
--
-- ⚠ Persona hygiene (§7.1, the falsely-CONFIRMING direction): qa's first probe used a
-- persona carrying a SEEDED RECUSAL on this exact case, so it measured the RECUSAL arm
-- (is_case_excluded) and read decision = NULL — apparent confirmation that the code
-- already denied. It did not. st_x2 is the clean persona; his preconditions are asserted
-- immediately below so this can never silently happen again.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
-- PRECONDITIONS — prove which arm we are measuring before we measure it.
select is(app.is_case_respondent((select cid from c_ethics), (select st_x2 from k)), false,
  'Proof 2 PRE ⭐: st_x2 is NOT the respondent — his cell measures the NON-GRANTED MEMBER arm');
select is(app.is_case_excluded((select cid from c_ethics), (select st_x2 from k)), false,
  'Proof 2 PRE ⭐: …and NOT excluded (no seeded recusal — the trap that poisoned qa''s first probe)');
select is(app.has_case_capability((select cid from c_ethics), (select st_x2 from k), 'read_case_deliberation'), false,
  'Proof 2 PRE ⭐: …and holds NO read_case_deliberation — so `summary` MUST mask');
select is(app.is_member_of_for((select comm_x from k), (select st_x2 from k)), true,
  'Proof 2 PRE ⭐: …but IS a member — the principal A26 licenses');

-- The ROW is readable — A6 (linkage is a procedural record) + A26 (decision member-wide).
select is((select count(*)::int from public.meeting_cases where case_id = (select cid from c_ethics)), 1,
  'QA MAJOR-3 Proof 2 ⭐ A26/K16 PIN: a non-granted member DOES read the meeting_cases ROW of an ethics case (A6: linkage is procedural, not substance)');
-- …and the PAYLOAD is closed by COLUMN masking, not by hiding the row.
select is((select summary from public.get_meeting_cases('bb000000-0000-0000-0000-0000000000e1')
            where case_id = (select cid from c_ethics)), null,
  'QA MAJOR-3 Proof 2 ⭐: …with `summary` MASKED (A15/C1 — substance needs read_case_deliberation)');
select isnt((select decision from public.get_meeting_cases('bb000000-0000-0000-0000-0000000000e1')
              where case_id = (select cid from c_ethics)), null,
  'QA MAJOR-3 Proof 2 ⭐ A26/K16 PIN: …and `decision` VISIBLE — the member-wide outcome tier is a DELIBERATE PO widening, not a leak');
-- Defence in depth: the row is readable, the columns are not — the base table REVOKEs both.
select is(has_column_privilege('authenticated', 'public.meeting_cases', 'summary', 'select'), false,
  'QA MAJOR-3 Proof 2: `meeting_cases.summary` is REVOKEd from authenticated (column REVOKE + RPC projection)');
-- The sweep, with meeting_cases licensed (documented in _e1_sweep_case_leaks) — EVERY
-- other case_id-bearing table must still read ZERO.
select is((select coalesce(string_agg(tbl || '=' || n, ', ' order by tbl), '') from public._e1_sweep_case_leaks((select cid from c_ethics), (select st_x2 from k), '{meeting_cases}'::text[])), '',
  'QA MAJOR-3 SWEEP: a non-granted member reads ZERO rows from EVERY case_id-bearing table of an ethics case (meeting_cases licensed by A6/A26, masking asserted above)');
reset role;

-- (MAJOR-1) Make the respondent + the recused user org_admins, so the policies'
-- commission-admin OR-arm would out-vote the hard-deny. sa_y becomes a CLEAN org_admin —
-- the control proving the admin arm still works for everyone not excluded.
insert into public.memberships (organization_id, principal_id, role) values
  ((select org_x from k), (select st_x from k),  'org_admin'),
  ((select org_x from k), (select st_x2 from k), 'org_admin'),
  ((select org_x from k), (select sa_y from k),  'org_admin')
on conflict do nothing;
-- BE-6 left c_default's interview at legal_privileged; drop it back to a NON-gated label
-- so the interview assertions below prove the deny (not merely the clearance ceiling).
update public.case_interviews set confidentiality_level = 'non_phi_internal'
  where id = (select id from iv);

-- The respondent who is ALSO an org_admin reads NOTHING of their own case.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.cases where id = (select cid from c_default)), 0,
  'QA MAJOR-1 (policy layer): a respondent who is org_admin reads NO cases row');
select is((select count(*)::int from public.case_phases where case_id = (select cid from c_default)), 0,
  'QA MAJOR-1 (policy layer): a respondent who is org_admin reads NO case_phases rows');
select is((select count(*)::int from public.case_interviews where case_id = (select cid from c_default)), 0,
  'QA MAJOR-1 (policy layer): a respondent who is org_admin reads NO case_interviews rows');
reset role;

-- The RECUSED user who is ALSO an org_admin reads NOTHING of that case.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.cases where id = (select cid from c_default)), 0,
  'QA MAJOR-1 (policy layer): a recused user who is org_admin reads NO cases row');
select is((select count(*)::int from public.case_phases where case_id = (select cid from c_default)), 0,
  'QA MAJOR-1 (policy layer): a recused user who is org_admin reads NO case_phases rows');
select is((select count(*)::int from public.case_interviews where case_id = (select cid from c_default)), 0,
  'QA MAJOR-1 (policy layer): a recused user who is org_admin reads NO case_interviews rows');
reset role;

-- CONTROL (⛔ UPDATED BY A4, 20260730): pre-A4 a clean org_admin (neither respondent nor
-- recused) STILL read the case — the control that the recusal/respondent deny did not
-- collaterally break the legitimate commission-admin arm. A4 (D4·1/A21) has now REMOVED
-- that arm entirely: an Organization User ceases to be a Case Content source, so a CLEAN
-- org_admin reads ZERO too. The MAJOR-1 pair now converges — respondent-org-admin AND
-- clean-org-admin both read 0 — for DIFFERENT reasons (the deny vs the removed arm). The
-- deny's INDEPENDENT proof now lives in 234 K9 (a respondent who is coordinator AND
-- grantee — non-org arms — still resolves to 0): post-A4 the respondent-org-admin blocks
-- above are over-determined (0 from the deny OR the removed arm), so they no longer
-- ISOLATE the deny. They remain correct (0 either way); the isolation moved to K9.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.cases where id = (select cid from c_default)), 0,
  'QA MAJOR-1 control (A4): a clean org_admin now reads ZERO cases — the commission-admin arm was REMOVED by A4 (was 1 pre-A4)');
reset role;

select * from finish();
rollback;
