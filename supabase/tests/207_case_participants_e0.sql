-- case_participants E0 (ADR 0064 / ADR 0065; F1) — the participant-layer keystones.
-- Complements 151_case_patient (the re-keyed patient door) with the invariants NEW in
-- F1. Migrations: 20260716000000_participants_registry / 000100_patient_identifiers_rekey
-- / 000200_disposal_and_flags.
--
-- Proves (ADR 0064 §Consequences gate):
--   K1 subtype↔type composite-FK guard (R5): a `professional` cannot acquire a
--      patient_identifiers/patient_participants row, and a `patient` cannot acquire a
--      professional_participants row. The single most important invariant.
--   K2 sensitivity_class CHECK-derived from participant_type (m1).
--   K3 patient door NULL-out-of-scope WITH N patients (two on one case).
--   K4 professional audited read: case-scoped, NULL out-of-scope, exactly one
--      professional_profile.read (allow-list + C-4 dispatch both wired).
--   K5 primary-subject partial-unique (one live is_primary_subject per case).
--   K6 cross-tenant participant isolation (HC094) + cases.org drift guard (HC095).
--   K7 disposal purges each patient participant's patient_xref row (R3) + redacts the
--      registry display_name + soft-removes the case links (Q4).
--   K8 REVOKE…FROM PUBLIC on the new RPCs (t19 guard).
--   K9 QA phase-F1 MAJOR-1/MINOR-1 regression lock: the SELECT grant + RLS policy pair
--      on the seven new non-PHI tables is actually live for `authenticated` (not just
--      exercised through a DEFINER RPC or the superuser default role), and the catalog
--      write grant + `_admin_write` policy adjudicate correctly.

begin;
-- 30 → 31: ETH·E4 (ADR 0108 D5) splits K4's single "foreign reader gets NULL" into
-- the org-manager arm (now admitted, deliberately) + a plain-member arm (still
-- denied). See the K4 block.
select plan(31);

update app.feature_flags set enabled = true where key = 'case_patient';
update app.feature_flags set enabled = true where key = 'case_access';
update app.feature_flags set enabled = true where key = 'audit_trail';
update app.feature_flags set enabled = true where key = 'case_participants';
update app.feature_flags set enabled = true where key = 'case_types';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid   as admin,
         (v->>'sa_x')::uuid    as sa_x,     -- coordinator of X
         (v->>'st_x')::uuid    as st_x,     -- phase assignee (broad read)
         (v->>'st_x2')::uuid   as st_x2,    -- unrelated member of X
         (v->>'sa_y')::uuid    as sa_y,     -- coordinator of Y — SAME ORG (see K4)
         (v->>'st_y')::uuid    as st_y,     -- ETH·E4: plain member of Y, the truly foreign reader
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'org_b')::uuid   as org_b,
         (v->>'form_u')::uuid  as form_u,
         (v->>'ver_u')::uuid   as ver_u
  from ctx;
grant select on k to authenticated;

-- A patient-enabled case in X with a phase assigned to st_x (broad read).
create temp table cs on commit drop as
  select gen_random_uuid() as case_x, gen_random_uuid() as phase_x;
grant select on cs to authenticated;
insert into public.cases (id, commission_id, case_number, label, created_by, patient_enabled)
  values ((select case_x from cs), (select comm_x from k), 9401, 'Caso Part', (select sa_x from k), true);
insert into public.case_phases
  (id, case_id, position, form_id, form_version_id, status, assigned_to, blocks)
values
  ((select phase_x from cs), (select case_x from cs), 1, (select form_u from k),
   (select ver_u from k), 'active', (select st_x from k), '{}');

-- A role usable for participant links (org-wide; is_primary_subject_candidate).
create temp table roles on commit drop as select gen_random_uuid() as role_patient;
grant select on roles to authenticated;
insert into public.case_participant_roles
  (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
values ((select role_patient from roles), (select org_b from k), 'affected_patient',
        'Paciente afetado', array['patient'], true);

-- =========================================================================
-- K2 · sensitivity_class is CHECK-derived from participant_type (m1).
-- =========================================================================
select throws_ok(
  format($$ insert into public.participants (organization_id, participant_type, sensitivity_class, display_name)
            values (%L, 'patient', 'non_sensitive', 'X') $$, (select org_b from k)),
  '23514', null, 'K2: a patient participant CANNOT carry sensitivity_class=non_sensitive (CHECK)');
select throws_ok(
  format($$ insert into public.participants (organization_id, participant_type, sensitivity_class, display_name)
            values (%L, 'professional', 'patient_phi', 'X') $$, (select org_b from k)),
  '23514', null, 'K2: a professional participant CANNOT carry sensitivity_class=patient_phi (CHECK)');

-- =========================================================================
-- K1 · subtype↔type composite-FK guard (R5). Build a `professional` participant, then
--      try to give it a patient_participants row (must fail on the composite FK), and a
--      `patient` participant, then try a professional_participants row (must fail).
-- =========================================================================
create temp table pt on commit drop as
  select gen_random_uuid() as prof_part, gen_random_uuid() as pat_part,
         gen_random_uuid() as prof_profile;
grant select on pt to authenticated;
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values
  ((select prof_part from pt), (select org_b from k), 'professional', 'professional_identity', 'Dr. Fulano'),
  ((select pat_part from pt),  (select org_b from k), 'patient',      'patient_phi',           'Paciente');
insert into public.professional_profiles (id, organization_id, full_name)
  values ((select prof_profile from pt), (select org_b from k), 'Dr. Fulano de Tal');

-- A professional participant getting a PATIENT subtype row → composite-FK violation.
select throws_ok(
  format($$ insert into public.patient_participants (participant_id) values (%L) $$,
         (select prof_part from pt)),
  '23503', null, 'K1: a `professional` participant CANNOT acquire a patient_participants row (composite FK, R5)');
-- A patient participant getting a PROFESSIONAL subtype row → composite-FK violation.
select throws_ok(
  format($$ insert into public.professional_participants (participant_id, professional_profile_id)
            values (%L, %L) $$, (select pat_part from pt), (select prof_profile from pt)),
  '23503', null, 'K1: a `patient` participant CANNOT acquire a professional_participants row (composite FK, R5)');

-- The MATCHING subtype rows are allowed.
select lives_ok(
  format($$ insert into public.professional_participants (participant_id, professional_profile_id)
            values (%L, %L) $$, (select prof_part from pt), (select prof_profile from pt)),
  'K1: a `professional` participant CAN acquire a professional_participants row (matching type)');
insert into public.case_participants (case_id, participant_id, role_id, added_by)
  values ((select case_x from cs), (select prof_part from pt), (select role_patient from roles), (select sa_x from k));

-- =========================================================================
-- K4 · professional audited read: case reader gets it (+1 audit); foreign → NULL (0).
-- =========================================================================
create temp table pa0 on commit drop as
  select (select count(*) from public.audit_log where action = 'professional_profile.read') as before;
grant select on pa0 to authenticated;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table pr_ok on commit drop as
  select public.get_case_professional((select prof_part from pt)) as j;
reset role;
grant select on pr_ok to authenticated;
select is((select pr_ok.j->>'full_name' from pr_ok), 'Dr. Fulano de Tal',
  'K4: a case reader (coordinator) reads the professional identity');
select is(
  (select count(*) from public.audit_log where action = 'professional_profile.read') - (select before from pa0),
  1::bigint, 'K4: exactly one professional_profile.read audit row for the entitled reader');

-- ⚠ ETH·E4 (ADR 0108 D5) CONSCIOUSLY CHANGED THIS ASSERTION — it is not loosened.
--
-- This block used to assert that sa_y gets NULL, calling her "a foreign reader".
-- She is not foreign: `test_helpers.bootstrap` homes comm_x AND comm_y under ONE
-- org, so sa_y (staff_admin of comm_y) is an ORG MANAGER of the professional's org.
-- ETH·E4 added an `app.can_manage_professional(<org>, p_uid)` disjunct to
-- `app.can_read_professional_profile` — without it the seating picker cannot tell
-- two same-named doctors apart at the moment a respondent is designated — so she
-- now reads. That is the widening, and it is keystoned as one in suite 321 (K3a,
-- proven able to fail by reverting the disjunct).
--
-- The keystone's PROTECTIVE INTENT is preserved by re-pointing it at st_y, a plain
-- member of comm_y: same org, no management role, no case access. If the arm were
-- ever widened from "org managers" to "org members", THAT assertion reds.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table pr_org_manager on commit drop as
  select public.get_case_professional((select prof_part from pt)) as j;
reset role;
grant select on pr_org_manager to authenticated;
select is((select pr_org_manager.j->>'full_name' from pr_org_manager), 'Dr. Fulano de Tal',
  'K4 (ETH·E4 D5): an ORG MANAGER outside the case now reads the professional identity');

select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
create temp table pr_foreign on commit drop as
  select public.get_case_professional((select prof_part from pt)) as j;
reset role;
grant select on pr_foreign to authenticated;
select ok((select j from pr_foreign) is null,
  'K4 ⭐: a plain org member with no case access STILL gets NULL — the D5 arm admits '
  'managers, not the organization');

-- =========================================================================
-- K3 · N patients on one case: write two, both read in-scope, foreign → NULL.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table twop on commit drop as
  select public.set_participant_patient((select case_x from cs), null, 'Paciente A', 'MRN-A') as p1,
         public.set_participant_patient((select case_x from cs), null, 'Paciente B', 'MRN-B') as p2;
reset role;
grant select on twop to authenticated;

select is(
  (select count(*)::int from public.patient_identifiers pi
    join public.case_participants cp on cp.participant_id = pi.participant_id
   where cp.case_id = (select case_x from cs)),
  2, 'K3: the case carries TWO patient_identifiers rows (N-per-case)');

-- ⬅ ADR 0078 defect ① / M3: was the phase ASSIGNEE ("broad-read"), who no longer
-- reaches PHI. K3 asserts the LIST door returns BOTH patients to an in-scope reader —
-- that coverage is preserved by re-pointing to a genuinely in-scope reader.
select test_helpers.claims_for((select sa_x from k), false);   -- entitled reader (coordinator)
set local role authenticated;
create temp table listp on commit drop as
  select public.get_case_patients((select case_x from cs)) as j;
reset role;
grant select on listp to authenticated;
select is((select jsonb_array_length((select j from listp))), 2,
  'K3: get_case_patients returns BOTH patients to an in-scope reader');

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table listp_f on commit drop as
  select public.get_case_patients((select case_x from cs)) as j,
         public.get_participant_patient((select p1 from twop)) as one;
reset role;
grant select on listp_f to authenticated;
select ok((select j from listp_f) is null, 'K3: get_case_patients → NULL out-of-scope with N patients');
select ok((select one from listp_f) is null, 'K3: get_participant_patient → NULL out-of-scope');

-- =========================================================================
-- K5 · primary-subject partial-unique: one LIVE is_primary_subject per case.
-- =========================================================================
update public.case_participants set is_primary_subject = true
  where participant_id = (select p1 from twop) and case_id = (select case_x from cs);
select throws_ok(
  format($$ update public.case_participants set is_primary_subject = true
            where participant_id = %L and case_id = %L $$,
         (select p2 from twop), (select case_x from cs)),
  '23505', null, 'K5: a second LIVE primary subject on one case violates the partial-unique index');

-- =========================================================================
-- K6 · cross-tenant participant isolation (HC094) + cases.org drift (HC095).
-- =========================================================================
create temp table other on commit drop as
  select gen_random_uuid() as org2, gen_random_uuid() as hosp2, gen_random_uuid() as part2;
grant select on other to authenticated;
insert into public.organizations (id, name, slug)
  values ((select org2 from other), 'Org 2', 'org2-' || substr((select org2 from other)::text,1,8));
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
  values ((select part2 from other), (select org2 from other), 'other', 'non_sensitive', 'Entidade Externa');
select throws_ok(
  format($$ insert into public.case_participants (case_id, participant_id, role_id, added_by)
            values (%L, %L, %L, %L) $$,
         (select case_x from cs), (select part2 from other), (select role_patient from roles), (select sa_x from k)),
  'HC094', null, 'K6: a participant of another org CANNOT be linked to this case (HC094)');
select throws_ok(
  format($$ update public.cases set organization_id = %L where id = %L $$,
         (select org2 from other), (select case_x from cs)),
  'HC095', null, 'K6: cases.organization_id cannot drift from the commission-resolved org (HC095)');

-- =========================================================================
-- K7 · disposal purges each patient participant's xref row (R3) + Q4 redaction.
-- =========================================================================
-- patient_key exists for MRN-A / MRN-B ⇒ xref rows present, keyed by participant.
select is(
  (select count(*)::int from public.patient_xref
    where module = 'case' and entity_id in ((select p1 from twop), (select p2 from twop))
      and disposed_at is null),
  2, 'K7 pre: both patient participants have a LIVE case-module patient_xref row');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.dispose_case_phi((select case_x from cs), 'subject_request') $$,
  'K7: the coordinator disposes the case PHI (N patients)');
reset role;

select is(
  (select count(*)::int from public.patient_identifiers
    where participant_id in ((select p1 from twop), (select p2 from twop))),
  0, 'K7: disposal DELETES all patient_identifiers rows of the case');
select is(
  (select count(*)::int from public.patient_xref
    where module = 'case' and entity_id in ((select p1 from twop), (select p2 from twop))
      and disposed_at is not null),
  2, 'K7: disposal STAMPS each patient participant''s patient_xref row disposed (R3)');
select is(
  (select count(distinct display_name)::int from public.participants
    where id in ((select p1 from twop), (select p2 from twop))),
  1, 'K7 (Q4): both patient participant registry rows are redacted to the same sentinel');

-- =========================================================================
-- K8 · REVOKE…FROM PUBLIC on the new public RPCs (t19 guard).
-- =========================================================================
select is(
  (select bool_or(has_function_privilege('public', p.oid, 'EXECUTE'))
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('set_participant_patient', 'get_participant_patient',
                       'get_case_patients', 'get_case_professional')),
  false, 'K8: PUBLIC has NO EXECUTE on any new F1 public RPC (t19)');

-- =========================================================================
-- K9 · QA phase-F1 MAJOR-1/MINOR-1 regression lock. Every direct table read/write
--      above this point runs either as a DEFINER RPC (grant-immune) or at the
--      default superuser role (bypasses GRANT + RLS) — so the `_select` policies on
--      the seven new non-PHI tables were never once exercised AS `authenticated`.
--      Exercise the grant+policy pair for real, `set local role authenticated`.
-- =========================================================================

-- Clear the JWT claim left by the last claims_for() call above (K7): it is a
-- transaction-local GUC (set_config(..., true)), so it survives `reset role` and
-- would otherwise make auth.uid() resolve to a stale persona for the privileged
-- profile writes below, tripping guard_profile_privileged_columns' service-role-only
-- check on home_organization_id. Matches the established 61_answer_model_v2.sql
-- pattern.
select set_config('request.jwt.claims', null, true);

-- A foreign-org reader (K6's org2 has no commission/user yet — mint a user anchored
-- there) to prove "0 rows", NOT a permission error, on the org-scoped catalog tables.
-- `is_org_member`/`is_org_admin_of` key off org_b-scoped grants this user never gets,
-- so they read as a genuine foreign-org caller regardless of org2 having no commission.
create temp table foreign_org on commit drop as select gen_random_uuid() as u_foreign;
grant select on foreign_org to authenticated;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', (select u_foreign from foreign_org),
          'authenticated', 'authenticated',
          (select u_foreign from foreign_org) || '@test', now(), now());
update public.profiles set full_name = 'Foreign Org User',
       home_organization_id = (select org2 from other)
  where id = (select u_foreign from foreign_org);

-- An org_admin persona in org_b (bootstrap has none) to prove the catalog write
-- grant + `_admin_write` policy adjudicate correctly.
create temp table org_admin_p on commit drop as select gen_random_uuid() as u_oa;
grant select on org_admin_p to authenticated;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', (select u_oa from org_admin_p),
          'authenticated', 'authenticated',
          (select u_oa from org_admin_p) || '@test', now(), now());
update public.profiles set full_name = 'Org Admin B',
       home_organization_id = (select org_b from k)
  where id = (select u_oa from org_admin_p);
insert into public.memberships (organization_id, principal_id, role)
  values ((select org_b from k), (select u_oa from org_admin_p), 'org_admin');

-- K9a · case_participants: in-scope reader (sa_x, coordinator of the case's
-- commission) does a PLAIN select and gets the row(s) — proves the SELECT grant is
-- live and RLS admits.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table k9_cp_in on commit drop as
  select count(*)::int as n from public.case_participants where case_id = (select case_x from cs);
reset role;
grant select on k9_cp_in to authenticated;
select ok((select n from k9_cp_in) > 0,
  'K9a: an in-scope reader''s PLAIN select on case_participants (as authenticated) returns rows — SELECT grant is live');

-- K9b · case_participants: out-of-scope reader (sa_y, foreign commission) gets 0
-- rows via RLS filtering, not a permission-denied error.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select lives_ok(
  format($$ select count(*) from public.case_participants where case_id = %L $$, (select case_x from cs)),
  'K9b: an out-of-scope reader''s select on case_participants does not error (no permission denied)');
create temp table k9_cp_out on commit drop as
  select count(*)::int as n from public.case_participants where case_id = (select case_x from cs);
reset role;
grant select on k9_cp_out to authenticated;
select is((select n from k9_cp_out), 0,
  'K9b: an out-of-scope reader''s select on case_participants returns 0 rows (RLS-filtered)');

-- K9c · participants: an org member (sa_x, org_b) reads the registry rows created
-- earlier in this test; a foreign-org reader gets 0.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table k9_part_in on commit drop as
  select count(*)::int as n from public.participants where organization_id = (select org_b from k);
reset role;
grant select on k9_part_in to authenticated;
select ok((select n from k9_part_in) > 0,
  'K9c: an in-scope org member''s PLAIN select on participants (as authenticated) returns rows — SELECT grant is live');

select test_helpers.claims_for((select u_foreign from foreign_org), false);
set local role authenticated;
create temp table k9_part_out on commit drop as
  select count(*)::int as n from public.participants where organization_id = (select org_b from k);
reset role;
grant select on k9_part_out to authenticated;
select is((select n from k9_part_out), 0,
  'K9c: a foreign-org reader''s select on participants returns 0 rows (RLS-filtered, not an error)');

-- K9d · case_types: same in/out-of-scope shape as K9c, on a second catalog table.
insert into public.case_types (organization_id, key, display_name, primary_subject_kind)
  values ((select org_b from k), 'k9_probe', 'Sonda K9', 'none');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table k9_ct_in on commit drop as
  select count(*)::int as n from public.case_types where organization_id = (select org_b from k);
reset role;
grant select on k9_ct_in to authenticated;
select ok((select n from k9_ct_in) > 0,
  'K9d: an in-scope org member''s PLAIN select on case_types (as authenticated) returns rows — SELECT grant is live');

select test_helpers.claims_for((select u_foreign from foreign_org), false);
set local role authenticated;
create temp table k9_ct_out on commit drop as
  select count(*)::int as n from public.case_types where organization_id = (select org_b from k);
reset role;
grant select on k9_ct_out to authenticated;
select is((select n from k9_ct_out), 0,
  'K9d: a foreign-org reader''s select on case_types returns 0 rows (RLS-filtered, not an error)');

-- K9e · catalog write: an org-admin's INSERT on case_types succeeds (grant +
-- `_admin_write` policy adjudicate); the same INSERT by a non-admin authenticated
-- user (sa_x, a staff_admin but not an org_admin) is rejected by RLS.
select test_helpers.claims_for((select u_oa from org_admin_p), false);
set local role authenticated;
select lives_ok(
  format($$ insert into public.case_types (organization_id, key, display_name, primary_subject_kind)
            values (%L, 'k9_admin_write', 'Sonda Admin', 'none') $$, (select org_b from k)),
  'K9e: an org-admin''s INSERT on case_types (as authenticated) succeeds — write grant + _admin_write policy admit');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ insert into public.case_types (organization_id, key, display_name, primary_subject_kind)
            values (%L, 'k9_non_admin_write', 'Sonda Não-Admin', 'none') $$, (select org_b from k)),
  '42501', null,
  'K9e: a non-org-admin''s INSERT on case_types (as authenticated) is rejected by RLS (write grant is live but policy denies)');
reset role;

select * from finish();
rollback;
