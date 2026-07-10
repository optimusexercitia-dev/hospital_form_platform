-- patient_index — Patient Identity & Cross-Committee Linkage (Phase 23; ADR 0039).
-- migration 20260620019000_patient_index.sql. Mirrors 151_case_patient.sql.
--
-- Proves:
--   * derive_patient_key: deterministic (same MRN -> same key), NULL value -> NULL,
--     conservative normalization makes ' prt-1 ' and 'PRT-1' collide.
--   * keys are derived by the ALWAYS-ON BEFORE trigger on the 3 PHI tables EVEN WHILE
--     patient_index is OFF (the flag gates only RPC/UI exposure): a case_patient in X
--     and one in Y sharing an MRN end up with ONE shared patient_key; a name-only row
--     gets NULL keys and is ABSENT from patient_xref. The xref-maintenance trigger
--     resolves its entity-id GENERICALLY from TG_TABLE_NAME (not a static column).
--   * exposure gate: with the flag OFF, search_patient_xref RAISES (23514) even for
--     PQS — the data exists but is not reachable; flipping the flag ON is all it takes.
--   * patient_xref direct SELECT is REVOKED from authenticated; the SELECT policy is
--     QPS-only (a non-PQS authenticated caller sees zero rows even via the policy).
--   * search_patient_xref: PQS sees the cross-committee trajectory (PHI-free: codes /
--     commission names / dates only, NO raw MRN/name); a non-PQS caller gets the
--     empty bundle; a zero-match search returns empty.
--   * audit: a matching search emits exactly one patient.searched on the GLOBAL chain
--     (commission_id NULL) with TRUNCATED key metadata + NO raw MRN; a zero-match
--     search emits NOTHING. The deep-link get_patient_trajectory_for_entity emits
--     patient.viewed (not searched). patient_access_audit does NOT re-audit.
--   * patient_xref_count (the one non-QPS door): an entitled referral reader gets the
--     cross-link count (excluding self); a foreign non-PQS caller gets 0.
--   * disposal: dispose_case_phi deletes the identifiers but RETAINS the xref row,
--     stamped disposed_at + the real reason; the disposed row is excluded from the
--     count.
-- (Flag-OFF UI invisibility — the QPS page notFound — is covered by the E2E suite;
--  this hermetic file proves the flag-OFF data layer stays consistent + the RPC gate.)
--
-- The audit rows are asserted directly: the DEFINER doors emit them server-side, so
-- a DB-side test observes them (like 150/151).

begin;
select plan(43);

-- patient_index stays OFF through the data-layer assertions below — the triggers are
-- ALWAYS-ON (ADR 0039), so keys + xref must be derived even with the flag OFF (the
-- flag gates only the RPC/UI exposure). It is flipped ON later, just before the
-- RPC/search assertions. The other flags are ON throughout (audit_trail so the
-- patient.searched/viewed rows are written; case_* so the fixtures behave).
update app.feature_flags set enabled = false where key = 'patient_index';
update app.feature_flags set enabled = true where key = 'case_patient';
update app.feature_flags set enabled = true where key = 'case_referrals';
update app.feature_flags set enabled = true where key = 'audit_trail';

-- The pepper lives in app.app_secrets (the migration seeds a dev value). Upsert a
-- known test pepper so the test is hermetic regardless of provisioning; the
-- begin/rollback wrapper reverts it. derive_patient_key reads this row.
insert into app.app_secrets (key, value) values ('mrn_pepper', 'pgtap-test-pepper')
  on conflict (key) do update set value = excluded.value, updated_at = now();

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid   as admin,   -- the QPS/PQS operator (enrolled below)
         (v->>'sa_x')::uuid    as sa_x,    -- coordinator of X
         (v->>'st_x')::uuid    as st_x,
         (v->>'sa_y')::uuid    as sa_y,    -- coordinator of Y
         (v->>'st_y')::uuid    as st_y,    -- foreign member (no PHI entitlement)
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'comm_y')::uuid  as comm_y,
         (v->>'hosp_b')::uuid  as hosp_b   -- NSP-per-hospital: bootstrap hospital for search scope
  from ctx;
grant select on k to authenticated;

-- NSP-per-org (ADR 0042): pqs_members has composite PK (organization_id, user_id).
-- admin = the PQS roster. Only PQS may reassemble a trajectory.
insert into public.pqs_members (hospital_id, user_id, added_by)
  select (v->>'hosp_b')::uuid, (v->>'admin')::uuid, (v->>'admin')::uuid from ctx;
insert into public.pqs_department (hospital_id, name, rca_default_due_days)
  select (v->>'hosp_b')::uuid, 'NSP Bootstrap', 30 from ctx
  on conflict (hospital_id) do nothing;

-- ---------------------------------------------------------------------------
-- Fixture: the SYNTHETIC CROSS-COMMITTEE TEST PATIENT (MRN 'PRT-9'), touching
-- THREE entities across TWO commissions:
--   * case_x   (commission X) — case_patient, MRN 'PRT-9', encounter 'ENC-9'
--   * case_y   (commission Y) — case_patient, MRN ' prt-9 ' (normalizes to PRT-9)
--   * ref_xy   (X -> Y)       — referral_patient, MRN 'PRT-9'
-- Plus a NAME-ONLY case (no MRN/encounter) that must stay ABSENT from the index.
-- ---------------------------------------------------------------------------
create temp table cs on commit drop as
  select gen_random_uuid() as case_x,
         gen_random_uuid() as case_y,
         gen_random_uuid() as case_nameonly,
         gen_random_uuid() as src_case,   -- referral source case (X)
         gen_random_uuid() as ref_xy;
grant select on cs to authenticated;

insert into public.cases (id, commission_id, case_number, label, created_by, patient_enabled)
values
  ((select case_x from cs),        (select comm_x from k), 9401, 'Caso X',         (select sa_x from k), true),
  ((select case_y from cs),        (select comm_y from k), 9402, 'Caso Y',         (select sa_y from k), true),
  ((select case_nameonly from cs), (select comm_x from k), 9403, 'Caso nome-só',   (select sa_x from k), true),
  ((select src_case from cs),      (select comm_x from k), 9404, 'Caso origem',    (select sa_x from k), true);

-- Patient participants + patient_identifiers (re-keyed, ADR 0064 E0 / F1). The case
-- module now contributes one xref row PER PATIENT PARTICIPANT (ADR 0066 / Q1=A). Built
-- directly as owner; the BEFORE trigger derives the keys, the AFTER trigger maintains
-- the participant-keyed xref. Capture each participant id for the case-module reads.
create temp table pp on commit drop as
  select gen_random_uuid() as p_x, gen_random_uuid() as p_y, gen_random_uuid() as p_none,
         gen_random_uuid() as role_x, gen_random_uuid() as role_y, gen_random_uuid() as role_n;
grant select on pp to authenticated;

-- A patient role per org (X→org_b, Y→comm_y's org; both may be org_b in this seed's
-- single-org tenancy — resolve per-commission).
insert into public.case_participant_roles (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
values ((select role_x from pp), app.org_of_commission((select comm_x from k)), 'affected_patient', 'Paciente afetado', array['patient'], true)
on conflict (organization_id, key) where case_type_id is null do nothing;
insert into public.case_participant_roles (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
values ((select role_y from pp), app.org_of_commission((select comm_y from k)), 'affected_patient', 'Paciente afetado', array['patient'], true)
on conflict (organization_id, key) where case_type_id is null do nothing;

-- Resolve the actual (possibly pre-existing) role ids.
create temp table roleids on commit drop as
  select (select id from public.case_participant_roles
            where organization_id = app.org_of_commission((select comm_x from k))
              and key = 'affected_patient' and case_type_id is null) as rx,
         (select id from public.case_participant_roles
            where organization_id = app.org_of_commission((select comm_y from k))
              and key = 'affected_patient' and case_type_id is null) as ry;
grant select on roleids to authenticated;

-- case_x patient (MRN PRT-9 + encounter ENC-9).
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ((select p_x from pp), app.org_of_commission((select comm_x from k)), 'patient', 'patient_phi', 'Paciente');
insert into public.patient_participants (participant_id) values ((select p_x from pp));
insert into public.case_participants (case_id, participant_id, role_id, added_by)
values ((select case_x from cs), (select p_x from pp), (select rx from roleids), (select sa_x from k));
insert into public.patient_identifiers (participant_id, name, mrn, sex, encounter_ref)
values ((select p_x from pp), 'Paciente Teste', 'PRT-9', 'male', 'ENC-9');

-- case_y patient (MRN ' prt-9 ' normalizes to PRT-9; commission Y).
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ((select p_y from pp), app.org_of_commission((select comm_y from k)), 'patient', 'patient_phi', 'Paciente');
insert into public.patient_participants (participant_id) values ((select p_y from pp));
insert into public.case_participants (case_id, participant_id, role_id, added_by)
values ((select case_y from cs), (select p_y from pp), (select ry from roleids), (select sa_y from k));
insert into public.patient_identifiers (participant_id, name, mrn, sex)
values ((select p_y from pp), 'Paciente Teste', ' prt-9 ', 'male');

-- NAME-ONLY patient participant: no mrn/encounter -> NULL keys -> absent from xref.
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ((select p_none from pp), app.org_of_commission((select comm_x from k)), 'patient', 'patient_phi', 'Paciente');
insert into public.patient_participants (participant_id) values ((select p_none from pp));
insert into public.case_participants (case_id, participant_id, role_id, added_by)
values ((select case_nameonly from cs), (select p_none from pp), (select rx from roleids), (select sa_x from k));
insert into public.patient_identifiers (participant_id, name, sex)
values ((select p_none from pp), 'Sem Identificador', 'unknown');

-- A referral X -> Y carrying the same patient (its isolated referral_patient).
insert into public.case_referral
  (id, code, source_case_id, source_commission_id, target_commission_id, type_label, subject, status)
values
  ((select ref_xy from cs), 'ENC-T001', (select src_case from cs),
   (select comm_x from k), (select comm_y from k), 'Parecer', 'Teste de vínculo', 'enviada');
insert into public.referral_patient (referral_id, name, mrn, sex)
values ((select ref_xy from cs), 'Paciente Teste', 'PRT-9', 'male');

-- =========================================================================
-- Pepper store — app.app_secrets is the locked-down secrets TABLE (not a GUC).
-- =========================================================================
select ok(
  (select value from app.app_secrets where key = 'mrn_pepper') is not null,
  'the mrn_pepper secret row exists in app.app_secrets');
select is(
  has_table_privilege('authenticated', 'app.app_secrets', 'SELECT'),
  false, 'authenticated has NO SELECT on app.app_secrets (secret is server-side only)');

-- =========================================================================
-- derive_patient_key — determinism + normalization + NULL.
-- =========================================================================
select is(app.derive_patient_key('PRT-9'), app.derive_patient_key('PRT-9'),
  'derive_patient_key is deterministic (same MRN -> same key)');
select is(app.derive_patient_key(' prt-9 '), app.derive_patient_key('PRT-9'),
  'conservative normalization: " prt-9 " and "PRT-9" collide');
select ok(app.derive_patient_key('PRT-9') <> app.derive_patient_key('PRT-99'),
  'different MRNs -> different keys');
select ok(app.derive_patient_key(null) is null,
  'derive_patient_key(NULL) -> NULL (name-only rows get no key)');
select ok(app.derive_patient_key('   ') is null,
  'derive_patient_key(blank) -> NULL');
select is(length(app.derive_patient_key('PRT-9')), 64,
  'patient_key is a 64-char hex HMAC-SHA256');

-- =========================================================================
-- Trigger derivation + the shared key across committees. NOTE: patient_index is
-- still OFF here — the triggers are ALWAYS-ON, so keys + xref must already exist.
-- =========================================================================
select is(app.feature_enabled('patient_index'), false,
  'precondition: patient_index is OFF for the data-layer assertions');
select is(
  (select patient_key from public.patient_identifiers where participant_id = (select p_x from pp)),
  app.derive_patient_key('PRT-9'),
  'the BEFORE trigger derived case_x patient.patient_key from the MRN (flag OFF — always-on)');
select is(
  (select patient_key from public.patient_identifiers where participant_id = (select p_x from pp)),
  (select patient_key from public.patient_identifiers where participant_id = (select p_y from pp)),
  'case_x (comm X) and case_y (comm Y) patients share ONE patient_key (cross-committee match)');
select is(
  (select encounter_key from public.patient_identifiers where participant_id = (select p_x from pp)),
  app.derive_patient_key('ENC-9'),
  'encounter_key derived from the encounter_ref');
select ok(
  (select patient_key from public.patient_identifiers where participant_id = (select p_none from pp)) is null,
  'a name-only patient_identifiers has a NULL patient_key');

-- =========================================================================
-- patient_xref maintenance + the name-only absence.
-- =========================================================================
select is(
  (select count(*)::int from public.patient_xref
    where module = 'case' and entity_id = (select p_x from pp)),
  1, 'an xref row exists for the keyed case_x patient participant');
select is(
  (select count(*)::int from public.patient_xref
    where module = 'case' and entity_id = (select p_none from pp)),
  0, 'NO xref row for the name-only patient participant (skip when both keys NULL)');
select is(
  (select commission_id from public.patient_xref
    where module = 'case' and entity_id = (select p_y from pp)),
  (select comm_y from k), 'xref.commission_id resolved via commission_of_case(participant''s case)');

-- =========================================================================
-- REVOKE + RLS: no direct authenticated SELECT; the policy is QPS-only.
-- =========================================================================
select is(
  has_table_privilege('authenticated', 'public.patient_xref', 'SELECT'),
  false, 'authenticated has NO direct table SELECT on patient_xref (REVOKE)');

-- Even though SELECT is revoked at the table level, prove the RLS predicate is
-- QPS-only by reading through it as the QPS admin (who is granted nothing either,
-- so this is belt-and-suspenders: the count comes back via the DEFINER doors).
-- A non-PQS member sees an empty trajectory regardless (asserted below).

-- =========================================================================
-- Exposure gate: while the flag is OFF, the RPC doors raise (even for PQS) — the
-- data exists but is NOT reachable. This is the flag's only job (ADR 0039).
-- =========================================================================
select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
-- NSP-per-org (ADR 0042): new 3-arg signature (mrn, encounter, org_id).
select throws_ok(
  format($$ select public.search_patient_xref('PRT-9', null, %L::uuid) $$, (select hosp_b from k)),
  '23514', null, 'search_patient_xref raises while patient_index is OFF (exposure gate)');
reset role;

-- =========================================================================
-- Flip patient_index ON — the RPC/search doors assert the flag (exposure gate).
-- The data layer above was already consistent with the flag OFF (always-on triggers).
-- =========================================================================
update app.feature_flags set enabled = true where key = 'patient_index';

-- =========================================================================
-- search_patient_xref — PQS trajectory; PHI-free; non-PQS empty; zero-match empty.
-- =========================================================================
select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
create temp table sr on commit drop as
  select public.search_patient_xref('PRT-9', null, (select hosp_b from k)) as j;
reset role;
grant select on sr to authenticated;

select is((select (j->>'matchCount')::int from sr), 3,
  'PQS search by MRN returns all 3 cross-committee/cross-module entities');
select is((select j->>'matchedOn' from sr), 'patient',
  'matchedOn = patient for an MRN-only search');
-- PHI-FREE: the serialized bundle must NOT contain the patient name or raw MRN.
select ok((select j::text from sr) not like '%PRT-9%',
  'the search bundle contains NO raw MRN (PHI-free)');
select ok((select j::text from sr) not like '%Paciente Teste%',
  'the search bundle contains NO patient name (PHI-free)');
-- It DOES carry the PHI-free human codes (e.g. the referral ENC-T001 + a "Caso" code).
select ok((select j::text from sr) like '%ENC-T001%',
  'the trajectory carries the PHI-free referral code');

-- A non-PQS member gets the empty bundle (duty separation).
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
create temp table sr_np on commit drop as
  select public.search_patient_xref('PRT-9', null, (select hosp_b from k)) as j;
reset role;
grant select on sr_np to authenticated;
select is((select (j->>'matchCount')::int from sr_np), 0,
  'a non-PQS caller gets an EMPTY trajectory (matchCount 0)');

-- Encounter pivot: search by encounter returns the entities carrying that encounter.
select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
create temp table sr_enc on commit drop as
  select public.search_patient_xref(null, 'ENC-9', (select hosp_b from k)) as j;
reset role;
grant select on sr_enc to authenticated;
select is((select (j->>'matchCount')::int from sr_enc), 1,
  'search by encounter returns the 1 entity carrying ENC-9 (encounter pivot)');

-- =========================================================================
-- Audit: one patient.searched on the GLOBAL chain for a match; none for zero-match.
-- =========================================================================
create temp table ab on commit drop as
  select (select count(*) from public.audit_log where action = 'patient.searched') as before;
grant select on ab to authenticated;

-- A MATCHING search. (Plain SQL file: a bare SELECT statement runs the door; the
-- result is discarded into a temp table to keep the statement tidy.)
select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
create temp table _s1 on commit drop as select public.search_patient_xref('PRT-9', null, (select hosp_b from k)) as j;
reset role;
select is(
  (select count(*) from public.audit_log where action = 'patient.searched') - (select before from ab),
  1::bigint, 'a matching search emits exactly one patient.searched row');

-- The just-written row: GLOBAL chain (commission_id NULL), TRUNCATED key, NO raw MRN.
create temp table arow on commit drop as
  select * from public.audit_log where action = 'patient.searched'
  order by occurred_at desc limit 1;
grant select on arow to authenticated;
select ok((select commission_id from arow) is null,
  'patient.searched is on the GLOBAL chain (commission_id NULL)');
select ok((select metadata->>'patient_key' from arow) like '%…',
  'the audit metadata patient_key is TRUNCATED (ends with the ellipsis)');
select ok((select metadata::text from arow) not like '%PRT-9%',
  'the audit metadata contains NO raw MRN (Rule 11)');

-- A ZERO-MATCH search emits nothing.
create temp table ab0 on commit drop as
  select (select count(*) from public.audit_log where action = 'patient.searched') as before;
grant select on ab0 to authenticated;
select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
create temp table _s0 on commit drop as select public.search_patient_xref('NO-SUCH-MRN', null, (select hosp_b from k)) as j;
reset role;
select is(
  (select count(*) from public.audit_log where action = 'patient.searched') - (select before from ab0),
  0::bigint, 'a ZERO-MATCH search emits NO patient.searched row');

-- =========================================================================
-- Deep-link: get_patient_trajectory_for_entity emits patient.viewed (not searched).
-- =========================================================================
create temp table avb on commit drop as
  select (select count(*) from public.audit_log where action = 'patient.viewed') as before;
grant select on avb to authenticated;
select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
create temp table dl on commit drop as
  select public.get_patient_trajectory_for_entity('case', (select p_x from pp)) as j;
reset role;
grant select on dl to authenticated;
select is((select (j->>'matchCount')::int from dl), 3,
  'deep-link from the case_x patient participant resolves the same 3-entity trajectory');
select is(
  (select count(*) from public.audit_log where action = 'patient.viewed') - (select before from avb),
  1::bigint, 'the deep-link emits exactly one patient.viewed row (not patient.searched)');

-- =========================================================================
-- patient_xref_count — the one non-QPS door (referral receiver hint).
-- =========================================================================
-- The PQS admin is entitled (can_read_referral_phi) -> counts the OTHER non-disposed
-- rows sharing the key (case_x + case_y) = 2, excluding the referral itself.
select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
create temp table cnt on commit drop as
  select public.patient_xref_count('referral', (select ref_xy from cs)) as n;
reset role;
grant select on cnt to authenticated;
select is((select n from cnt), 2,
  'patient_xref_count excludes self and counts the 2 other entities sharing the key');

-- A foreign, non-PQS, non-coordinator member gets 0 (not entitled).
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
create temp table cnt0 on commit drop as
  select public.patient_xref_count('referral', (select ref_xy from cs)) as n;
reset role;
grant select on cnt0 to authenticated;
select is((select n from cnt0), 0,
  'patient_xref_count returns 0 to a non-entitled caller');

-- =========================================================================
-- Disposal: dispose_case_phi retains the xref row, stamped disposed + reason.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.dispose_case_phi((select case_x from cs), 'subject_request') $$,
  'the coordinator disposes case_x PHI');
reset role;

select ok(
  (select count(*) from public.patient_identifiers where participant_id = (select p_x from pp)) = 0,
  'dispose_case_phi deleted the isolated identifiers');
select is(
  (select disposed_reason from public.patient_xref
    where module = 'case' and entity_id = (select p_x from pp)),
  'subject_request',
  'the xref row is RETAINED and stamped with the REAL disposal reason (not "other")');
select ok(
  (select disposed_at from public.patient_xref
    where module = 'case' and entity_id = (select p_x from pp)) is not null,
  'the retained xref row carries disposed_at');

-- After disposal, the count for the referral drops to 1 (case_y only; case_x disposed).
select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
create temp table cnt_after on commit drop as
  select public.patient_xref_count('referral', (select ref_xy from cs)) as n;
reset role;
grant select on cnt_after to authenticated;
select is((select n from cnt_after), 1,
  'a disposed xref row is EXCLUDED from patient_xref_count');

-- =========================================================================
-- §M1 (NSP-per-org regression guard): app.patient_trajectory_bundle is an INTERNAL
-- helper with NO authorization check of its own — its 3 public DEFINER callers gate
-- on is_pqs_member_of(<org>) BEFORE invoking it. The 2-arg → 3-arg arity change
-- over-granted it to `authenticated` (a non-PQS user holding a patient_key could call
-- it directly and bypass the per-org enrollment gate). It must be service_role-ONLY.
-- These guards FAIL against the pre-fix `authenticated` grant.
-- =========================================================================
-- (M1a) the privilege-level guard: authenticated has NO EXECUTE on the 3-arg helper.
select is(
  has_function_privilege('authenticated', 'app.patient_trajectory_bundle(text, text, uuid)', 'execute'),
  false,
  'M1 GUARD: authenticated has NO EXECUTE on app.patient_trajectory_bundle (service_role-only)');
-- anon likewise cannot execute it.
select is(
  has_function_privilege('anon', 'app.patient_trajectory_bundle(text, text, uuid)', 'execute'),
  false,
  'M1 GUARD: anon has NO EXECUTE on app.patient_trajectory_bundle');

-- (M1b) a plain non-PQS authenticated persona calling the helper DIRECTLY is denied
-- (permission denied = 42501) — the gate cannot be bypassed via the raw helper.
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select app.patient_trajectory_bundle('any-key', null, %L::uuid) $$, (select hosp_b from k)),
  '42501', null,
  'M1 GUARD: a non-PQS persona calling app.patient_trajectory_bundle directly is denied (42501)');
reset role;

-- (M1c) the DEFINER door still returns correct org-scoped results — the entitled PQS
-- member gets a non-empty bundle via search_patient_xref (runs as postgres, so the
-- service_role-only helper grant does NOT regress the door path).
select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
create temp table _m1door on commit drop as
  select public.search_patient_xref('PRT-9', null, (select hosp_b from k)) as j;
reset role;
grant select on _m1door to authenticated;
select ok(
  (select (j->>'matchCount')::int from _m1door) >= 1,
  'M1 GUARD: the DEFINER door (search_patient_xref) still returns org-scoped results for the entitled PQS member');

select * from finish();
rollback;
