-- ADR 0078 D8 / N1 — Drop the NSP automatic patient-identifier arm from the CASE
-- capability resolver (app._case_caps, branch S6 nsp_referral_touched). N1 removes ONLY
-- the read_standard_phi bit from S6; read_case_content + read_case_deliberation stay, so
-- an NSP operator KEEPS Case Content reach on a referral-touched case but LOSES the
-- automatic patient-identifier arm (D8). Until Stage D, NSP obtains case PHI only through
-- an explicit read_standard_phi grant (the S1 coordinator / S3 manual_grant arms).
--
-- Mutation-falsifiable: K-N1a/K-N1d go RED if the S6 read_standard_phi bit is re-added.
-- The exploit is proven REAL (§7.1): the operator IS a PQS operator AND the case IS
-- referral-touched, so S6 fires — its content half is retained (K-N1a/K-N1b), only the
-- PHI half is gone (K-N1d). K-N1e proves N1 did NOT over-remove (referral/event PHI kept).

begin;
select plan(14);

update app.feature_flags set enabled = true
  where key in ('case_referrals', 'case_patient', 'case_participants', 'case_narratives');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as u_nsp,   -- ⚠ NAME TRAP: `admin` persona, is_admin=FALSE;
                                           --   used as a plain user MADE an NSP operator.
         (v->>'sa_x')::uuid   as sa_x,     -- coordinator of comm_x (writes PHI via the door)
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         app.org_of_commission((v->>'comm_x')::uuid)      as org_x,
         app.hospital_of_commission((v->>'comm_x')::uuid) as hosp_x
  from ctx;
grant select on k to authenticated;

-- FIXTURE: c1 = a referral-touched, PHI-bearing case in comm_x.
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy, patient_enabled)
values ('00000000-0000-0000-0000-0000000f1001', (select comm_x from k), 94701, (select sa_x from k),
        'commission_default', true);

-- PHI written through the real coordinator door.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.set_participant_patient('00000000-0000-0000-0000-0000000f1001', null, 'Paciente N1', 'MRN-N1-001');
reset role;

-- u_nsp is MADE an NSP coordinator at hosp_x; c1 is MADE referral-touched.
insert into public.memberships (principal_id, organization_id, hospital_id, role)
values ((select u_nsp from k), (select org_x from k), (select hosp_x from k), 'nsp_coordinator');
insert into public.case_referral
  (id, code, source_case_id, source_commission_id, target_commission_id, type_label,
   subject, status, response_expected, has_patient, created_by)
values ('00000000-0000-0000-0000-0000000f1020', 'REF-N1-1',
        '00000000-0000-0000-0000-0000000f1001', (select comm_x from k), (select comm_y from k),
        'Notificação', 'Assunto N1', 'sent', false, false, (select sa_x from k));

-- ===========================================================================
-- PRE-FLIGHT — the operator's reach comes ONLY through the NSP/S6 arm, and S6 fires.
-- ===========================================================================
select is(app.is_pqs_operator_of_for((select hosp_x from k), (select u_nsp from k)), true,
  'PRE ⭐: the operator IS a PQS operator of the case''s hospital (the OLD arm''s trigger — exploit was real)');
select is(app.is_member_of_for((select comm_x from k), (select u_nsp from k)), false,
  'PRE ⭐: …and is NOT a member of comm_x — his reach comes ONLY through the NSP arm');
select is(app.is_staff_admin_of_for((select comm_x from k), (select u_nsp from k)), false,
  'PRE ⭐: …and is NOT a coordinator — so no S1 PHI arm confounds the measurement');
select is((select count(*)::int from public.case_referral
           where source_case_id = '00000000-0000-0000-0000-0000000f1001'), 1,
  'PRE ⭐: the case IS referral-touched — S6 (nsp_referral_touched) genuinely fires');

-- ===========================================================================
-- K-N1a — content retained, PHI removed. (Re-adding the S6 read_standard_phi bit flips a2/a3 RED.)
-- ===========================================================================
select is(app.can_read_case('00000000-0000-0000-0000-0000000f1001', (select u_nsp from k)), true,
  'K-N1a ⭐: the NSP operator STILL reads case CONTENT on the referral-touched case (S6 content arm retained)');
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000f1001', (select u_nsp from k)), false,
  'K-N1a ⭐: …but NO LONGER reads patient identifiers — the S6 read_standard_phi arm was removed (D8/N1)');
select test_helpers.claims_for((select u_nsp from k), false);
set local role authenticated;
select is(public.get_case_patients('00000000-0000-0000-0000-0000000f1001') is null, true,
  'K-N1a ⭐ ROWS / Rule 12: …and the audited door returns NULL (out of scope) — ZERO identifier rows');
reset role;

-- ===========================================================================
-- K-N1b — content-retention twin (no-regression): the oversight reach survives.
-- ===========================================================================
select is(app.has_case_capability('00000000-0000-0000-0000-0000000f1001', (select u_nsp from k), 'read_case_content'), true,
  'K-N1b ⭐: read_case_content RETAINED (NSP oversight reach on referral-touched cases is untouched)');
select is(app.has_case_capability('00000000-0000-0000-0000-0000000f1001', (select u_nsp from k), 'read_case_deliberation'), true,
  'K-N1b ⭐: read_case_deliberation RETAINED');

-- ===========================================================================
-- K-N1d — removal complete: the resolver confers NO read_standard_phi via the NSP arm.
-- ===========================================================================
select is(app.has_case_capability('00000000-0000-0000-0000-0000000f1001', (select u_nsp from k), 'read_standard_phi'), false,
  'K-N1d ⭐: the NSP-only operator gets read_standard_phi = FALSE (the S6 PHI bit is gone)');

-- ===========================================================================
-- K-N1e — scope intact: N1 removed the CASE arm ONLY. The SAME operator keeps REFERRAL
-- PHI (the PQS arm on can_read_referral_phi is untouched), and event PHI still rides is_pqs.
-- ===========================================================================
select is(app.can_read_referral_phi('00000000-0000-0000-0000-0000000f1020', (select u_nsp from k)), true,
  'K-N1e ⭐: referral PHI RETAINED for the same PQS operator — N1 removed CASE PHI only, not referral PHI');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'app' and p.proname = 'can_read_event_patient'
             and p.prosrc ilike '%is_pqs_operator_of_for%'), 1,
  'K-N1e ⭐ STRUCTURAL: can_read_event_patient STILL rides is_pqs_operator_of_for — the NSP''s own event PHI (Rule 12) is untouched');

-- ===========================================================================
-- K-N1c — the explicit-grant path is intact: an explicit read_standard_phi grant
-- restores case PHI (D8: NSP obtains PHI through a grant until Stage D).
-- ===========================================================================
select test_helpers.grant_ca('00000000-0000-0000-0000-0000000f1001', (select u_nsp from k), 'read',
       (select sa_x from k), null, null, true);
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000f1001', (select u_nsp from k)), true,
  'K-N1c ⭐: an explicit read_standard_phi grant RESTORES case PHI (the S3 grant arm is untouched)');
select test_helpers.claims_for((select u_nsp from k), false);
set local role authenticated;
select is(jsonb_array_length(public.get_case_patients('00000000-0000-0000-0000-0000000f1001')), 1,
  'K-N1c ⭐ ROWS: …and the audited door now returns the identifier row');
reset role;

select * from finish();
rollback;
