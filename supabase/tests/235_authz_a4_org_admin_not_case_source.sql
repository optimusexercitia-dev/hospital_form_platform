-- =============================================================================
-- AUTHZ · A4 — Organization administration ceases to be a Case Content source.
-- ADR 0078 D4, A21 (D4·1's true scope), A22/A23, A24·2, A25 keystone 23, A36·2.
--
-- ⛔ A4 IS A **NARROWING**, so §7.7 inverts the risk: a narrowing that denies everyone
-- passes its negative keystone BY CONSTRUCTION. THE POSITIVE TWIN IS THE REVIEW. Every
-- negative below ("the org_admin reads ZERO …") is paired with a positive proving the
-- fixture is a REAL, live org_admin who CAN still read the things A4 leaves him
-- (configuration, the grant door) — else "reads zero" is faked by any unrelated denial
-- (§7.1·3: the missing-precondition trap; §7.1·6: the permissive-sibling trap).
--
-- ⭐⭐ THE FIXTURE IS THE TRAP. The org_admin here is MADE (org_admin of org_x, NOT a
-- member and NOT a coordinator of comm_x) — never a borrowed seed persona whose role on
-- THIS case might differ (the lead's A4 fixture came back is_case_excluded=FALSE on a
-- borrowed persona and would have FALSELY CONFIRMED the storage finding). Purity is
-- ASSERTED before any reach is measured.
--
-- ⭐ §7.1·6 — THE PERMISSIVE SIBLING. Postgres ORs permissive policies, so "reads zero"
-- is true only when EVERY policy on the table denies. Each ROWS assertion below is a
-- count under `set local role` — the OR of all policies — so it enumerates them by
-- construction: if ANY policy admitted the org_admin the count would be > 0. `cases`
-- carries a FOR ALL write policy (the very shape that faked A2's K1/K9); A4 removes its
-- org arm, so the count now measures the whole table honestly.
--
-- Falsifiability proven separately, ONE ARM AT A TIME, by
-- supabase/tests/mutation/a4-mutation-audit.sh: restore each removed arm and the
-- matching keystone must go RED. A test that cannot fail is not evidence (§7.1).
-- =============================================================================
begin;
-- 33 → 42: Gate-2 wave fixes a GATE-1 ESCAPE. K1 was policy-shaped (base tables only)
-- and its title claimed more than it proved — `list_cases_board`'s DEFINER fast-path
-- falsified it. +2 K1·DOOR, +7 K1·DENY (the coordinator/hard-deny arm).
select plan(42);

update app.feature_flags set enabled = true
  where key in ('case_access', 'case_referrals', 'case_patient', 'case_participants',
                'meetings', 'cases_multi_phase', 'case_narratives');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,      -- coordinator of comm_x (also MADE org_admin -> K5)
         (v->>'st_x')::uuid   as st_x,      -- plain member of comm_x (K8 positive)
         (v->>'st_x2')::uuid  as st_x2,     -- plain member + narrative assignee (K8 positive)
         (v->>'sa_y')::uuid   as sa_y,      -- foreign coordinator -> made read-grantee (K8 positive)
         (v->>'st_y')::uuid   as st_y,      -- foreign staff -> made org_admin of org_x (THE A4 TARGET)
         (v->>'admin')::uuid  as u_nsp,     -- ⚠ NAME TRAP (§7.2·4): is_admin = FALSE. Made org_admin + NSP operator (K6)
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         app.org_of_commission((v->>'comm_x')::uuid)      as org_x,
         app.hospital_of_commission((v->>'comm_x')::uuid) as hosp_x
  from ctx;
grant select on k to authenticated;

select is((select exists (select 1 from app.feature_flags where key = 'case_access')), false,
  'B4: the case_access flag is RETIRED — assert the state, never claim it (§7.3)');
select is(app.feature_enabled('case_referrals'), true,
  'FLAG: case_referrals is ON — the NSP arm K6 leans on is LIVE');

-- ===========================================================================
-- FIXTURE
--   c1 = commission_default, PHI-bearing
--   c2 = explicit_grants_only, PHI-bearing  ← the ethics shape: org arm defeating this
--        is the sharp harm A4 exists to end.
-- ===========================================================================
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy, patient_enabled)
values ('00000000-0000-0000-0000-0000000a4001', (select comm_x from k), 95001, (select sa_x from k),
        'commission_default', true),
       ('00000000-0000-0000-0000-0000000a4002', (select comm_x from k), 95002, (select sa_x from k),
        'explicit_grants_only', true);

-- PHI through the real coordinator door.
select test_helpers.claims_for((select sa_x from k), false, 'staff_admin');
set local role authenticated;
select public.set_participant_patient('00000000-0000-0000-0000-0000000a4001', null, 'Paciente A4', 'MRN-A4-001');
select public.set_participant_patient('00000000-0000-0000-0000-0000000a4002', null, 'Paciente A4 Etica', 'MRN-A4-002');
reset role;

-- st_y is MADE a PURE org_admin of org_x (bootstrap ships none). NOT a member of comm_x.
insert into public.memberships (principal_id, organization_id, role)
values ((select st_y from k), (select org_x from k), 'org_admin');

-- sa_x (the coordinator) is ADDITIONALLY made org_admin — the K5 principal: a person who
-- holds a Committee role AND the org role keeps case content THROUGH the committee role
-- (D4: "If such a person must participate clinically they hold a Committee role").
insert into public.memberships (principal_id, organization_id, role)
values ((select sa_x from k), (select org_x from k), 'org_admin');

-- u_nsp is MADE org_admin AND an NSP operator; c1 is MADE referral-touched — the K6
-- principal: content+PHI survive A4 through the NSP arm, proving A4 bound ONLY the org
-- arm (§7.7: keep the axes separate; the survivor is the proof the cut was surgical).
insert into public.memberships (principal_id, organization_id, role)
values ((select u_nsp from k), (select org_x from k), 'org_admin');
insert into public.memberships (principal_id, organization_id, hospital_id, role)
values ((select u_nsp from k), (select org_x from k), (select hosp_x from k), 'nsp_coordinator');
insert into public.case_referral
  (id, code, source_case_id, source_commission_id, target_commission_id, type_label,
   subject, status, response_expected, has_patient, created_by)
values ('00000000-0000-0000-0000-0000000a4020', 'REF-A4-1',
        '00000000-0000-0000-0000-0000000a4001', (select comm_x from k), (select comm_y from k),
        'Notificação', 'Assunto A4', 'sent', false, false, (select sa_x from k));

-- sa_y is MADE a READ grantee on c1 (foreign coordinator, so the grant is his ONLY arm).
select test_helpers.grant_ca('00000000-0000-0000-0000-0000000a4001', (select sa_y from k), 'read', (select sa_x from k), null, null, true);

-- Config the org_admin STILL governs (the positive twins) — rows in comm_x.
insert into public.case_tags (id, commission_id, name)
values ('00000000-0000-0000-0000-0000000a4030', (select comm_x from k), 'Tag A4');
insert into public.case_outcomes (id, commission_id, label, position)
values ('00000000-0000-0000-0000-0000000a4031', (select comm_x from k), 'Desfecho A4', 1);
insert into public.case_narrative_types (id, commission_id, label, position)
values ('00000000-0000-0000-0000-0000000a4032', (select comm_x from k), 'Tipo Narrativa A4', 1);

-- A narrative on c1 ASSIGNED to st_x2 — his ONLY arm (K8 positive: assignment reach
-- is untouched by A4; the removal bound the org arm, nobody else's).
insert into public.case_narratives (id, case_id, narrative_type_id, type_label, display_position, assigned_to)
values ('00000000-0000-0000-0000-0000000a4033', '00000000-0000-0000-0000-0000000a4001',
        '00000000-0000-0000-0000-0000000a4032', 'Relato A4', 1, (select st_x2 from k));

-- A meeting + committee action item (the K3 positive twin) and a case_restricted item
-- (the K3 negative). guard_action_item FORCES case_restricted for source_type='case'.
insert into public.meetings (id, commission_id, meeting_number, title, scheduled_start)
values ('00000000-0000-0000-0000-0000000a4040', (select comm_x from k), 9501, 'Reunião A4', now());
insert into public.meeting_cases (meeting_id, case_id) values
  ('00000000-0000-0000-0000-0000000a4040', '00000000-0000-0000-0000-0000000a4001'),
  ('00000000-0000-0000-0000-0000000a4040', '00000000-0000-0000-0000-0000000a4002');
insert into public.action_items
  (id, commission_id, source_type, source_meeting_id, title, visibility_scope, created_by, status_id, urgency_id)
values ('00000000-0000-0000-0000-0000000a4050', (select comm_x from k), 'meeting',
        '00000000-0000-0000-0000-0000000a4040', 'Item de comitê A4', 'committee', (select sa_x from k),
        (select id from public.action_item_statuses limit 1),
        (select id from public.action_item_urgency_levels limit 1));
insert into public.action_items
  (id, commission_id, source_type, source_case_id, title, visibility_scope, created_by, status_id, urgency_id)
values ('00000000-0000-0000-0000-0000000a4051', (select comm_x from k), 'case',
        '00000000-0000-0000-0000-0000000a4002', 'Notificar o Dr. X da decisão do processo A4',
        'case_restricted', (select sa_x from k),
        (select id from public.action_item_statuses limit 1),
        (select id from public.action_item_urgency_levels limit 1));

-- An interview on c2 with a subject (the K2 case material).
insert into public.case_interviews (id, commission_id, case_id, title, status, created_by, interview_category)
values ('00000000-0000-0000-0000-0000000a4060', (select comm_x from k), '00000000-0000-0000-0000-0000000a4002',
        'Oitiva A4', 'scheduled', (select sa_x from k), 'respondent');
insert into public.case_interview_subjects (interview_id, external_name, external_org, relationship_to_case)
values ('00000000-0000-0000-0000-0000000a4060', 'Dr. Fulano (denunciado)', 'Hospital A', 'respondent');

-- A case-document storage object under comm_x / c2 (the K4 byte-level case material)
-- on the legacy `case-documents` bucket — ⛔ RETIRED: DM4 re-pointed the referral
-- snapshot boundary onto the document substrate and DM5·S4 deleted the bucket row
-- itself, so this fixture is a bare `storage.objects` insert naming a bucket that no
-- longer exists (it still exercises the A4 assertion, which is about the ORG arm, not
-- about the bucket). Was: "still live until DM4 — its SELECT policy is the
-- frozen-snapshot boundary". Corrected 2026-08-17, QA r2 MINOR-4.
-- DM1 (ADR 0114 D5/D8): the second anchor (the `attachments` store, where the
-- coordinator twin read bytes) was dropped WITH its SELECT policy — and the document
-- buckets deliberately have NO SELECT policy for anyone (D8), so "an entitled
-- principal reads the bytes directly" is no longer a satisfiable twin ANYWHERE by
-- design. K4's non-vacuity is asserted as a superuser census instead (below).
insert into storage.buckets (id, name) values
  ('case-documents','case-documents') on conflict (id) do nothing;
insert into storage.objects (bucket_id, name, owner)
values ('case-documents',
        (select comm_x from k)::text || '/00000000-0000-0000-0000-0000000a4002/laudo-sigiloso.pdf',
        (select sa_x from k));

-- ===========================================================================
-- ⭐ PRE-FLIGHT — the org_admin is REAL and holds ONLY the org arm on comm_x.
-- Without this, every "reads zero" below could be a nobody reading zero (§7.1·3).
-- ===========================================================================
select is(app.is_tenancy_admin_of_for((select comm_x from k), (select st_y from k)), true,
  'PRE ⭐: st_y IS a live org_admin of comm_x — his zeros below are a REMOVED arm, not a missing one');
select is(app.is_member_of_for((select comm_x from k), (select st_y from k)), false,
  'PRE ⭐: …and is NOT a member of comm_x — no member arm confounds the measurement');
select is(app.is_staff_admin_of_for((select comm_x from k), (select st_y from k)), false,
  'PRE ⭐: …and is NOT a coordinator — the org arm is his ONLY case arm');

-- ===========================================================================
-- K1 — the org_admin reads ZERO case content (the eight FOR ALL tables + the resolver).
-- POSITIVE TWIN: he STILL reads the configuration he governs. Both halves required.
-- ===========================================================================
select is(app.can_read_case('00000000-0000-0000-0000-0000000a4002', (select st_y from k)), false,
  'K1 ⭐ (D4·1): the org_admin no longer reads the explicit_grants_only case — the org arm is GONE from the resolver');
select is(app.can_read_case('00000000-0000-0000-0000-0000000a4001', (select st_y from k)), false,
  'K1 ⭐: …and not the commission_default case either — content, not just the ethics shape');

select test_helpers.claims_for((select st_y from k), false, 'org_admin');
set local role authenticated;
-- ⚠ TITLE CORRECTED (Gate-2 wave). This assertion previously claimed the org_admin
-- "no longer reads the explicit_grants_only case" — but it only proves the BASE
-- TABLE denies him. That claim was FALSIFIED THROUGH THE DOOR: `list_cases_board`
-- (prosecdef = t ⇒ RLS never runs) returned him all 5 cases, including the
-- explicit_grants_only ethics case, while this line read 0. The base-table
-- assertion is kept as the TWIN; the door is asserted immediately below. A
-- policy-shaped test over a DEFINER-door surface is not a keystone.
select is((select count(*)::int from public.cases where id = '00000000-0000-0000-0000-0000000a4002'), 0,
  'K1 ⭐ ROWS (BASE TABLE twin): reads ZERO `cases` rows — through the FOR ALL write policy A21 found (the permissive sibling), now narrowed');
-- ⭐⭐ K1·DOOR — THE PATH THE PRODUCT ACTUALLY USES.
-- `list_cases_board` computed a "coordinator fast-path" boolean and used it to
-- SHORT-CIRCUIT the per-row `app.can_read_case` filter, so it never called the
-- resolver and was outside the perimeter by construction (D4's "general form").
-- A Gate-1 escape (A4/D4·1) that shipped to `main`; found by the Gate-2 sweep.
select is((select count(*)::int from public.list_cases_board((select comm_x from k))
           where case_id = '00000000-0000-0000-0000-0000000a4002'), 0,
  'K1·DOOR ⭐⭐ (D4·1): the org_admin reads ZERO of the explicit_grants_only case THROUGH list_cases_board — the fast-path no longer short-circuits can_read_case');
select is((select count(*)::int from public.list_cases_board((select comm_x from k))), 0,
  'K1·DOOR ⭐⭐: …and ZERO cases on the board at all (was: 5, incl. the ethics case + another case''s adverse outcome)');
select is((select count(*)::int from public.case_narratives where case_id = '00000000-0000-0000-0000-0000000a4002'), 0,
  'K1 ⭐ ROWS: ZERO case_narratives');
select is((select count(*)::int from public.case_phases where case_id = '00000000-0000-0000-0000-0000000a4002'), 0,
  'K1 ⭐ ROWS: ZERO case_phases');
-- POSITIVE TWIN — the fixture is a REAL org_admin: configuration still works.
select is((select count(*)::int from public.case_tags where id = '00000000-0000-0000-0000-0000000a4030'), 1,
  'K1 ⭐ POSITIVE TWIN: …but he STILL reads case_tags — A4 removed CASE reach, not commission configuration');
select is((select count(*)::int from public.case_outcomes where id = '00000000-0000-0000-0000-0000000a4031'), 1,
  'K1 ⭐ POSITIVE TWIN: …and case_outcomes');
select is((select count(*)::int from public.case_narrative_types where id = '00000000-0000-0000-0000-0000000a4032'), 1,
  'K1 ⭐ POSITIVE TWIN: …and case_narrative_types — the org_admin configures and staffs; he does not touch cases');
reset role;

-- ===========================================================================
-- K2 — the org_admin reads ZERO interview case material (A22 is WRONG that action_items
-- was the single missed place; the interview family carried the org arm too).
-- ===========================================================================
select test_helpers.claims_for((select st_y from k), false, 'org_admin');
set local role authenticated;
select is((select count(*)::int from public.case_interview_subjects
           where interview_id = '00000000-0000-0000-0000-0000000a4060'), 0,
  'K2 ⭐ ROWS: the org_admin reads ZERO interview subjects — case-linked PHI-capable material');
select is((select count(*)::int from public.case_interviews
           where id = '00000000-0000-0000-0000-0000000a4060'), 0,
  'K2 ⭐ ROWS: …and ZERO interviews');
reset role;

-- ===========================================================================
-- K3 — SCOPED narrowing. The org_admin reads ZERO case_restricted action items, but the
-- POSITIVE TWIN — `committee` items STILL readable — IS the review: deleting the arm
-- outright (trap 2) would strike commission governance.
-- ===========================================================================
select test_helpers.claims_for((select st_y from k), false, 'org_admin');
set local role authenticated;
select is((select count(*)::int from public.action_items where id = '00000000-0000-0000-0000-0000000a4051'), 0,
  'K3 ⭐ ROWS: the org_admin reads ZERO case_restricted action items (A11''s own example string)');
-- ⭐ UPDATED for ADR 0078 C7/A11 (Q2 reconciliation): A4/K23 kept the org_admin's
-- `committee` action-item arm as commission governance; Amendment 2 (A11/K19)
-- supersedes it for the meeting-ADJACENT action-item channel — the Organization
-- User loses `committee` and `assignees_only` too. K23 still protects the case
-- CONFIG tables (case_tags/outcomes/narrative_types — asserted elsewhere here).
select is((select count(*)::int from public.action_items where id = '00000000-0000-0000-0000-0000000a4050'), 0,
  'K3 → C7/A11: the org_admin reads ZERO `committee` action items too (Amendment 2 supersedes A4 for this channel)');
reset role;

-- ===========================================================================
-- K4 — byte-level case material. The org_admin reads ZERO case-document bytes.
-- (The `is_member_of` bypass on the LEGACY `case-documents` bucket is now CLOSED by the
-- Exclusion Perimeter Unit 1 — 236. The coordinator twin therefore moved to the live
-- `attachments` store, where product case documents actually live post-F2 and where the
-- coordinator legitimately reads via `can_read_attachment` → `can_read_case`.)
-- ===========================================================================
select test_helpers.claims_for((select st_y from k), false, 'org_admin');
set local role authenticated;
select is((select count(*)::int from storage.objects
           where bucket_id = 'case-documents'
             and name = (select comm_x from k)::text || '/00000000-0000-0000-0000-0000000a4002/laudo-sigiloso.pdf'), 0,
  'K4 ⭐ ROWS: the org_admin reads ZERO case-document BYTES — D4·2 is NOT "fixed for free" at the storage layer, and A4 fixes it');
reset role;
-- DM1 (ADR 0114 D8): the old twin (coordinator reads bytes in the live
-- `attachments` store) died with that store's SELECT policy, and by design NO
-- principal reads document-bucket bytes directly anymore (byte access = the
-- audited door, DM2). Non-vacuity is therefore pinned as a superuser census:
-- the object the org_admin reads ZERO of is REAL.
select is((select count(*)::int from storage.objects
           where bucket_id = 'case-documents'
             and name = (select comm_x from k)::text || '/00000000-0000-0000-0000-0000000a4002/laudo-sigiloso.pdf'), 1,
  'K4 ⭐ NON-VACUITY (superuser census): the case-document object is REAL — the org_admin zero above is a removed arm, not an empty bucket');

-- ===========================================================================
-- K5 — D4's own sentence, made live: an org_admin who ALSO holds a Committee role keeps
-- case content THROUGH that role. (sa_x is coordinator AND org_admin.) The removal is of
-- the ORG arm, not of the person.
-- ===========================================================================
select is(app.can_read_case('00000000-0000-0000-0000-0000000a4002', (select sa_x from k)), true,
  'K5 ⭐ POSITIVE: the org_admin-who-is-coordinator KEEPS content — via the committee role, exactly as D4 intends');
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000a4002', (select sa_x from k)), true,
  'K5 ⭐ POSITIVE: …and PHI');
select is(app.can_write_case_content('00000000-0000-0000-0000-0000000a4002', (select sa_x from k)), true,
  'K5 ⭐ POSITIVE: …and write — A4 removed an arm, not this person''s clinical reach');

-- ===========================================================================
-- K6 — A4 bound ONLY the org arm. u_nsp is org_admin AND a PQS operator on a
-- referral-touched case: CONTENT survives through the NSP arm (S6). The S6 PHI half was
-- removed at D8/N1, so PHI does NOT survive here — but that removal is orthogonal to A4
-- (S6 content, the point of this keystone, is untouched by both A4 and N1).
-- ===========================================================================
select is(app.is_tenancy_admin_of_for((select comm_x from k), (select u_nsp from k)), true,
  'K6 PRE ⭐: u_nsp IS an org_admin (so his surviving reach is NOT the org arm — that would confound the point)');
select is(app.can_read_case('00000000-0000-0000-0000-0000000a4001', (select u_nsp from k)), true,
  'K6 ⭐ POSITIVE: content SURVIVES on the referral-touched case — A4 removed the org arm, the NSP arm (S6) is untouched');
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000a4001', (select u_nsp from k)), false,
  'K6 ⭐ (D8/N1 LANDED): PHI does NOT survive — the S6 arm no longer confers it; this is N1''s removal, orthogonal to A4 (S6 content above is what A4 leaves intact)');

-- ===========================================================================
-- K7 — the grant door STILL works (keystone 23) and cannot grant itself (A18 bound).
-- ===========================================================================
select test_helpers.claims_for((select st_y from k), false, 'org_admin');
set local role authenticated;
select lives_ok(
  $$ select public.grant_case_access('00000000-0000-0000-0000-0000000a4001',
       (select st_x from k), 'read', null, 'A4 K7') $$,
  'K7 ⭐ POSITIVE (keystone 23): the org_admin STILL administers the grant door — granting to a MEMBER succeeds');
select throws_ok(
  $$ select public.grant_case_access('00000000-0000-0000-0000-0000000a4001',
       (select st_y from k), 'read', null, 'A4 K7 self') $$,
  'HC021', null,
  'K7 ⭐ A18 BOUND: …and CANNOT grant to itself — the grantee must be a commission member (HC021), and the org_admin is not one');
reset role;

-- ===========================================================================
-- K8 — everyone else's reach is UNCHANGED (the narrowing bound ONLY the org arm).
-- ===========================================================================
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000a4001', (select sa_y from k)), true,
  'K8 ⭐ POSITIVE: a read_standard_phi grantee still reaches PHI — untouched by A4');
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.meeting_cases where case_id = '00000000-0000-0000-0000-0000000a4001'), 1,
  'K8 ⭐ POSITIVE: the ordinary member still reads the ata section (read_case_deliberation) — untouched');
reset role;
select is(app.can_read_case('00000000-0000-0000-0000-0000000a4001', (select st_x2 from k)), true,
  'K8 ⭐ POSITIVE: the narrative assignee still reads content — untouched');

-- ===========================================================================
-- K9 — F1/A21: with the org arm gone, can_read_case_or_admin collapsed to can_read_case
-- and has now been RETIRED (Stage G) — its call sites are repointed to can_read_case. The
-- underlying truths still hold: the org_admin reads NOTHING (D2), the coordinator reads.
-- ===========================================================================
select is(app.can_read_case('00000000-0000-0000-0000-0000000a4002', (select st_y from k)),
          app.can_read_case('00000000-0000-0000-0000-0000000a4002', (select st_y from k)),
  'K9 ⭐ (A21): repointed to can_read_case for the org_admin (both FALSE — the private deny is now the resolver''s own)');
select is(app.can_read_case('00000000-0000-0000-0000-0000000a4002', (select st_y from k)), false,
  'K9 ⭐: …and that answer is FALSE — the org_admin does not get the case D2 exists to prevent');
select is(app.can_read_case('00000000-0000-0000-0000-0000000a4002', (select sa_x from k)),
          app.can_read_case('00000000-0000-0000-0000-0000000a4002', (select sa_x from k)),
  'K9 ⭐ non-vacuous: repointed to can_read_case for the COORDINATOR too (both TRUE — a genuine identity, not both-false)');

-- ===========================================================================
-- K1·DENY ⭐⭐ — THE BOARD'S *OTHER* BROKEN ARM: the coordinator fast-path also
-- skipped ADR 0072 D2's HARD DENY. This is the half that proves cutting only the
-- org arm would have been INSUFFICIENT.
--
-- `app._case_caps` carries `-- STEP 4 — HARD DENY, before every positive arm`,
-- with `if app.is_case_respondent(...)` at STEP 4 and
-- `v_coord := app.is_staff_admin_of_for(...)` a POSITIVE ARM at STEP 5, AFTER it.
-- `list_cases_board` recomputed coordinator-ness itself and never called the
-- resolver, so STEP 4 never ran. Measured before the fix:
--     is_staff_admin_of = t · is_case_respondent = t
--     app.can_read_case = FALSE        ← the deny WORKS at the resolver
--     cases base-table RLS = 0 rows    ← and the policy honours it
--     list_cases_board  → RETURNED HIS OWN RESPONDENT CASE
-- Deliberately placed at the END of the file: it mutates sa_x's participation, so
-- running it earlier would perturb every coordinator assertion above.
-- ===========================================================================
reset role;
-- respondent_doctor is org-scoped; bootstrap's org ships none (the same-org guard
-- trg_assert_participant_same_org_as_case rejects the seed org's role).
insert into public.case_participant_roles (id, organization_id, key, display_name, allowed_participant_types)
values ('00000000-0000-0000-0000-0000000a4090', (select org_x from k), 'respondent_doctor',
        'Denunciado', array['professional'])
on conflict do nothing;
insert into public.professional_profiles (id, organization_id, full_name, user_id)
values ('00000000-0000-0000-0000-0000000a4091', (select org_x from k), 'Dr. Coordenador', (select sa_x from k));
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ('00000000-0000-0000-0000-0000000a4092', (select org_x from k), 'professional',
        'professional_identity', 'Dr. Coordenador');
insert into public.professional_participants (participant_id, professional_profile_id)
values ('00000000-0000-0000-0000-0000000a4092', '00000000-0000-0000-0000-0000000a4091');
-- sa_x (the COORDINATOR) becomes the RESPONDENT of the commission_default case.
insert into public.case_participants (case_id, participant_id, role_id)
values ('00000000-0000-0000-0000-0000000a4001', '00000000-0000-0000-0000-0000000a4092',
        '00000000-0000-0000-0000-0000000a4090');

-- PRECONDITIONS — prove which arms are live before measuring.
select is(app.is_staff_admin_of_for((select comm_x from k), (select sa_x from k)), true,
  'K1·DENY PRE ⭐: sa_x IS the commission''s coordinator — the arm the fast-path trusted');
select is(app.is_case_respondent('00000000-0000-0000-0000-0000000a4001', (select sa_x from k)), true,
  'K1·DENY PRE ⭐: …and IS the respondent of his own case');
select is(app.can_read_case('00000000-0000-0000-0000-0000000a4001', (select sa_x from k)), false,
  'K1·DENY PRE ⭐⭐: …so app.can_read_case is FALSE — _case_caps'' STEP-4 hard deny beats the STEP-5 coordinator arm (ADR 0072 D2)');

select test_helpers.claims_for((select sa_x from k), false, 'staff_admin');
set local role authenticated;
select is((select count(*)::int from public.cases where id = '00000000-0000-0000-0000-0000000a4001'), 0,
  'K1·DENY (BASE TABLE twin): …and the base table denies him his own respondent case');
-- BASE-TABLE no-over-reach twin (BUG-GATE2-235-PLANCOUNT: the intended 42nd assertion —
-- pairs the base layer with the board no-over-reach below, exactly as the base DENY above
-- pairs with the board DENY; without it the plan counted 42 but only 41 ran).
select is((select count(*)::int from public.cases where id = '00000000-0000-0000-0000-0000000a4002'), 1,
  'K1·DENY NO-OVER-REACH (BASE TABLE twin): …while the SAME coordinator still reads the OTHER case at the base table — the hard deny is scoped to HIS case, not a board lockout');
select is((select count(*)::int from public.list_cases_board((select comm_x from k))
           where case_id = '00000000-0000-0000-0000-0000000a4001'), 0,
  'K1·DENY ⭐⭐ THE BOARD: a COORDINATOR reads ZERO of his OWN RESPONDENT case through list_cases_board — the fast-path no longer skips the hard deny (was: it returned it)');
-- NO-OVER-REACH twin: the deny is scoped to HIS case, not a lockout of the board.
select is((select count(*)::int from public.list_cases_board((select comm_x from k))
           where case_id = '00000000-0000-0000-0000-0000000a4002'), 1,
  'K1·DENY NO-OVER-REACH ⭐: …while the SAME coordinator still reads the OTHER case on the board (a scoped deny, not a lockout)');
reset role;

select * from finish();
rollback;
