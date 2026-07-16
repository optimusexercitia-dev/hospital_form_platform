-- =============================================================================
-- AUTHZ · M5 — defect ③: the `is_active` OUTER GATE.
-- ADR 0078 Context·3 / D3 / A24·5. `app.is_active(uuid)` resolves
--   profiles.is_active AND (suspended_until is null or now() >= suspended_until)
-- and fails closed on an absent profile. It was NEVER called inline by any case
-- predicate — it was reached ONLY transitively, through the role wrappers
-- (is_staff_admin_of_for / is_commission_admin_of_for / is_member_of_for, and
-- is_pqs_operator_of_for via both its legs).
--
-- Consequence: every RAW TABLE ARM — a case_access grant, a phase assignment, a
-- narrative assignment, an action-item assignment — was UNGATED. A deactivated or
-- suspended user holding a live grant or a surviving assignment still read case
-- content, AND still read PATIENT IDENTIFIERS (Rule 12) through the grant arm.
--
-- ⚠⚠ THIS IS A NARROWING, NOT A DENIAL (§7.7). It removes reach people HAVE
-- TODAY. A narrowing that denies EVERYONE passes its negative BY CONSTRUCTION, so
-- the POSITIVE TWIN is the whole risk and is mandatory on every arm. Every
-- negative below is paired with (a) the active twin proving the arm reaches at
-- all, and (b) a RESTORE proving the denial was is_active and not some other arm.
--
-- ⛔ FIXTURE NOTE — why this suite is hermetic and does NOT use seed personas.
-- The seed's two inactive personas (`desativado.conta`, `suspenso.temp`) hold ZERO
-- grants and ZERO assignments and read ZERO cases. A keystone written against them
-- PASSES WHILE ASSERTING NOTHING — they are already denied by having no arm at
-- all. That is §7.1·1 (wrong-arm fixture) and §7.1·3 (missing precondition) at the
-- same time. This suite therefore BUILDS a principal whose ONLY reach is the raw
-- arm under test, proves he reaches, and then deactivates him.
-- =============================================================================

begin;
select plan(79);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid as admin, (v->>'sa_x')::uuid as sa_x,
         (v->>'st_x')::uuid as st_x, (v->>'st_x2')::uuid as st_x2,
         (v->>'sa_y')::uuid as sa_y, (v->>'st_y')::uuid as st_y,
         (v->>'comm_x')::uuid as comm_x, (v->>'comm_y')::uuid as comm_y,
         (v->>'form_u')::uuid as form_u, (v->>'ver_u')::uuid as ver_u,
         (v->>'form_y')::uuid as form_y, (v->>'ver_y')::uuid as ver_y
  from ctx;
grant select on k to authenticated;

update app.feature_flags set enabled = true
  where key in ('cases_multi_phase', 'case_access', 'case_participants', 'case_patient', 'audit_trail');
update app.feature_flags set enabled = false where key in ('case_types', 'case_referrals');

insert into public.cases (id, commission_id, case_number, created_by, visibility_policy, patient_enabled)
values ('00000000-0000-0000-0000-0000000a5001', (select comm_x from k), 95001, (select sa_x from k),
        'commission_default', true);

-- The PHI itself, through the real coordinator door.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.set_participant_patient('00000000-0000-0000-0000-0000000a5001', null,
       'Paciente M5', 'MRN-M5-001');
reset role;
-- ⛔ auth.uid() survives `reset role` (claims_for uses set_config(..., local)), and
-- guard_profile_privileged_columns raises for ANY signed-in caller touching
-- suspended_until. Clearing the claims restores the trusted (service-role) path.
-- Without this every profile mutation below ABORTS the suite instead of asserting —
-- and an aborted suite is not a red one (§7.1).
select set_config('request.jwt.claims', '', true);

-- st_x  = plain member of comm_x, reach = a PHASE assignment ONLY.
-- st_x2 = plain member of comm_x, reach = a NARRATIVE assignment ONLY.
-- st_y  = member of comm_y (NOT comm_x), reach = a case_access grant ONLY.
-- sa_y  = staff_admin of comm_y (NOT comm_x), reach = a WRITE grant ONLY.
insert into public.case_narrative_types (id, commission_id, label, position)
values ('00000000-0000-0000-0000-0000000a5002', (select comm_x from k), 'Relato', 1);
insert into public.case_narratives
  (id, case_id, narrative_type_id, type_label, display_position, assigned_to)
values ('00000000-0000-0000-0000-0000000a5003', '00000000-0000-0000-0000-0000000a5001',
        '00000000-0000-0000-0000-0000000a5002', 'Relato', 1, (select st_x2 from k));
insert into public.case_phases (id, case_id, position, title, form_id, form_version_id, assigned_to)
select '00000000-0000-0000-0000-0000000a5004', '00000000-0000-0000-0000-0000000a5001', 1,
       'Apuração', (select form_u from k), (select ver_u from k), (select st_x from k);
insert into public.case_access (case_id, user_id, level, granted_by)
values ('00000000-0000-0000-0000-0000000a5001', (select st_y from k), 'read', (select sa_x from k)),
       ('00000000-0000-0000-0000-0000000a5001', (select sa_y from k), 'write', (select sa_x from k));

-- ===========================================================================
-- FLAGS — asserted, never assumed (§7.3: a reading is not a fact until pinned to
-- the state you claim about). The shared stack is reset constantly and an e2e
-- teardown has driven these into a state no environment ships.
-- ===========================================================================
select is(app.feature_enabled('case_access'), true,
  'FLAG ⭐: case_access is ON — this is today''s LIVE branch, the one carrying the raw arms');
select is(app.feature_enabled('case_referrals'), false,
  'FLAG: case_referrals is OFF here — pins out the LIVE PQS referral arm so ONLY the raw arm is measured');
select is(app.feature_enabled('case_patient'), true,
  'FLAG: case_patient is ON — else set_participant_patient rejects and the PHI fixture is empty');
select is((select count(*)::int from public.patient_identifiers), 1,
  'PRE: the PHI exists — there is something to read');

-- ===========================================================================
-- PRE-FLIGHT — the fixture must ISOLATE the raw arm. If any principal below held
-- a role arm too, deactivating him would deny through the ROLE wrapper (already
-- is_active-gated since long before M5) and the keystone would assert NOTHING.
-- This is the exact trap the seed sets: chefe.ccih and orgadmin.b hold raw arms
-- AND are coordinators, so they cannot isolate anything.
-- ===========================================================================
select is(app.is_staff_admin_of_for((select comm_x from k), (select st_x from k)), false,
  'PRE ⭐: the phase assignee is NOT staff_admin of the case commission');
select is(app.is_commission_admin_of_for((select comm_x from k), (select st_x from k)), false,
  'PRE ⭐: …nor commission_admin — the phase assignment is his ONLY arm');
select is(app.is_staff_admin_of_for((select comm_x from k), (select st_x2 from k)), false,
  'PRE ⭐: the narrative assignee is NOT staff_admin of the case commission');
select is(app.is_commission_admin_of_for((select comm_x from k), (select st_x2 from k)), false,
  'PRE ⭐: …nor commission_admin — the narrative assignment is his ONLY arm');
select is(app.is_staff_admin_of_for((select comm_x from k), (select st_y from k)), false,
  'PRE ⭐: the READ grantee is NOT staff_admin of the case commission');
select is(app.is_commission_admin_of_for((select comm_x from k), (select st_y from k)), false,
  'PRE ⭐: …nor commission_admin');
select is(app.is_member_of_for((select comm_x from k), (select st_y from k)), false,
  'PRE ⭐: …nor even a member — the grant is his ONLY arm');
select is(app.is_staff_admin_of_for((select comm_x from k), (select sa_y from k)), false,
  'PRE ⭐: the WRITE grantee is NOT staff_admin of the case commission (he is staff_admin of the OTHER one)');
select is(app.is_commission_admin_of_for((select comm_x from k), (select sa_y from k)), false,
  'PRE ⭐: …nor commission_admin — the write grant is his ONLY arm');
-- The principals start ACTIVE. Without this the negatives below could be measuring
-- a fixture that was never active in the first place (§7.1·3).
select is(app.is_active((select st_x from k)), true, 'PRE: the phase assignee starts ACTIVE');
select is(app.is_active((select st_x2 from k)), true, 'PRE: the narrative assignee starts ACTIVE');
select is(app.is_active((select st_y from k)), true, 'PRE: the read grantee starts ACTIVE');
select is(app.is_active((select sa_y from k)), true, 'PRE: the write grantee starts ACTIVE');

-- ===========================================================================
-- can_read_case · the PHASE-ASSIGNMENT raw arm. Both halves of is_active.
-- ===========================================================================
select is(app.can_read_case('00000000-0000-0000-0000-0000000a5001', (select st_x from k)), true,
  'M5 TWIN ⭐: the ACTIVE phase assignee reads the case — the raw arm reaches (without this the negative proves nothing)');

update public.profiles set is_active = false where id = (select st_x from k);
select is(app.can_read_case('00000000-0000-0000-0000-0000000a5001', (select st_x from k)), false,
  'M5 ⭐ defect ③: a DEACTIVATED phase assignee no longer reads the case (today: true)');

update public.profiles set is_active = true where id = (select st_x from k);
select is(app.can_read_case('00000000-0000-0000-0000-0000000a5001', (select st_x from k)), true,
  'M5 RESTORE ⭐: reactivating restores the read — the denial was is_active, not some other arm');

-- The SUSPENSION half. is_active is a conjunction; a gate that honours only the
-- flag would pass every test above and still leak to every suspended user.
update public.profiles set suspended_until = now() + interval '1 day' where id = (select st_x from k);
select is(app.can_read_case('00000000-0000-0000-0000-0000000a5001', (select st_x from k)), false,
  'M5 ⭐ defect ③: a SUSPENDED phase assignee no longer reads the case (the second half of is_active)');
update public.profiles set suspended_until = now() - interval '1 day' where id = (select st_x from k);
select is(app.can_read_case('00000000-0000-0000-0000-0000000a5001', (select st_x from k)), true,
  'M5 ⭐: an EXPIRED suspension reads again — the gate honours the expiry, it does not just test for NULL');
update public.profiles set suspended_until = null where id = (select st_x from k);

-- ===========================================================================
-- can_read_case · the NARRATIVE-ASSIGNMENT raw arm (the sibling — both go, or the
-- fix is half-done).
-- ===========================================================================
select is(app.can_read_case('00000000-0000-0000-0000-0000000a5001', (select st_x2 from k)), true,
  'M5 TWIN ⭐: the ACTIVE narrative assignee reads the case');
update public.profiles set is_active = false where id = (select st_x2 from k);
select is(app.can_read_case('00000000-0000-0000-0000-0000000a5001', (select st_x2 from k)), false,
  'M5 ⭐ defect ③: a DEACTIVATED narrative assignee no longer reads the case');

-- ⛔ THE DELEGATION FENCE. can_read_case_or_admin and
-- can_reach_case_on_member_surface get NO gate of their own: every arm they carry
-- delegates to an already-gated predicate (catalog-verified — see the migration).
-- These four assert that delegation actually holds, in BOTH directions, so a
-- future raw arm on either wrapper shows up as a failure here.
select is(app.can_read_case_or_admin('00000000-0000-0000-0000-0000000a5001', (select st_x2 from k)), false,
  'M5 ⭐ DELEGATION: the wrapper denies the deactivated assignee too — it inherits the gate, it does not bypass it');
select is(app.can_reach_case_on_member_surface('00000000-0000-0000-0000-0000000a5001', (select st_x2 from k)), false,
  'M5 ⭐ DELEGATION: the member surface denies him as well — no ungated path around the gate');

update public.profiles set is_active = true where id = (select st_x2 from k);
select is(app.can_read_case('00000000-0000-0000-0000-0000000a5001', (select st_x2 from k)), true,
  'M5 RESTORE ⭐: the narrative assignee reads again once reactivated');
select is(app.can_read_case_or_admin('00000000-0000-0000-0000-0000000a5001', (select st_x2 from k)), true,
  'M5 DELEGATION TWIN: …and the wrapper grants him again (the fence is not a blanket deny)');
select is(app.can_reach_case_on_member_surface('00000000-0000-0000-0000-0000000a5001', (select st_x2 from k)), true,
  'M5 DELEGATION TWIN: …and so does the member surface');

-- ===========================================================================
-- can_read_case + can_read_case_patient · the case_access GRANT raw arm.
-- ⚠ RULE 12 lives here: this is the arm through which a deactivated user read
-- PATIENT IDENTIFIERS.
-- ===========================================================================
select is(app.can_read_case('00000000-0000-0000-0000-0000000a5001', (select st_y from k)), true,
  'M5 TWIN ⭐: the ACTIVE read-grantee reads the case');
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000a5001', (select st_y from k)), true,
  'M5 TWIN ⭐ + SCOPE FENCE: the ACTIVE read-grantee reaches the PHI door — defect ①''s second half is DELIBERATELY still open (B1 owns it; 230 pins it). M5 must NOT close it here.');
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is((select (public.get_case_patient('00000000-0000-0000-0000-0000000a5001'))->>'mrn'), 'MRN-M5-001',
  'M5 TWIN ⭐ RULE 12: …and ACTUALLY READS the MRN through the audited door while active');
reset role;
select set_config('request.jwt.claims', '', true);

update public.profiles set is_active = false where id = (select st_y from k);
select is(app.can_read_case('00000000-0000-0000-0000-0000000a5001', (select st_y from k)), false,
  'M5 ⭐ defect ③: a DEACTIVATED grantee no longer reads the case');
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000a5001', (select st_y from k)), false,
  'M5 ⭐⭐ defect ③ / RULE 12: a DEACTIVATED grantee no longer reaches the PHI door (today: true — he reads patient identifiers)');
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is((select (public.get_case_patient('00000000-0000-0000-0000-0000000a5001')) is null), true,
  'M5 ⭐⭐ RULE 12: …and the audited door returns NULL — he reads ZERO identifier rows (asserted as ROWS, not as a predicate''s return value)');
reset role;
select set_config('request.jwt.claims', '', true);

update public.profiles set is_active = true where id = (select st_y from k);
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000a5001', (select st_y from k)), true,
  'M5 RESTORE ⭐: reactivating restores the PHI reach — the denial was is_active, not the grant');

update public.profiles set suspended_until = now() + interval '1 day' where id = (select st_y from k);
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000a5001', (select st_y from k)), false,
  'M5 ⭐ RULE 12: a SUSPENDED grantee reaches no PHI either (the suspension half, on the PHI door)');
update public.profiles set suspended_until = null where id = (select st_y from k);

-- An EXPIRED grant still confers nothing — the pre-existing expiry term must
-- survive the edit untouched.
update public.case_access set expires_at = now() - interval '1 day'
 where case_id = '00000000-0000-0000-0000-0000000a5001' and user_id = (select st_y from k);
select is(app.can_read_case('00000000-0000-0000-0000-0000000a5001', (select st_y from k)), false,
  'M5: an EXPIRED grant still confers nothing — the expiry term is intact after the edit');
update public.case_access set expires_at = null
 where case_id = '00000000-0000-0000-0000-0000000a5001' and user_id = (select st_y from k);

-- ===========================================================================
-- can_write_case_content · the WRITE-grant raw arm.
-- ===========================================================================
select is(app.can_write_case_content('00000000-0000-0000-0000-0000000a5001', (select sa_y from k)), true,
  'M5 TWIN ⭐: the ACTIVE write-grantee writes case content');
update public.profiles set is_active = false where id = (select sa_y from k);
select is(app.can_write_case_content('00000000-0000-0000-0000-0000000a5001', (select sa_y from k)), false,
  'M5 ⭐ defect ③: a DEACTIVATED write-grantee no longer writes case content (today: true)');
update public.profiles set suspended_until = now() + interval '1 day', is_active = true
  where id = (select sa_y from k);
select is(app.can_write_case_content('00000000-0000-0000-0000-0000000a5001', (select sa_y from k)), false,
  'M5 ⭐: a SUSPENDED write-grantee cannot write either');
update public.profiles set suspended_until = null where id = (select sa_y from k);
select is(app.can_write_case_content('00000000-0000-0000-0000-0000000a5001', (select sa_y from k)), true,
  'M5 RESTORE ⭐: lifting both restores the write — the denial was is_active');

-- ===========================================================================
-- can_read_action_item · A24·5 — THE ARM NO FUTURE RESOLVER CAN EVER REACH.
-- The `assignees_only` arms have NO case to resolve, so a case-scoped resolver
-- can never gate them. They need their OWN gate. This is why A24·5 is binding.
--
-- ⛔ FIXTURE BUILT HERE, DELIBERATELY. The seed has exactly ONE action item, it is
-- `committee`-scoped, and action_item_assignments is EMPTY — so the assignees_only
-- arms are entirely unexercised by the seed. A keystone on the seeded item would
-- measure the `committee` arm, whose is_member_of_for is ALREADY gated, and would
-- pass while asserting nothing (§7.1·1).
--
-- ⛔ AND: guard_action_item HARD-FORCES visibility_scope := 'case_restricted' for
-- source_type = 'case' — which would silently redirect this test onto can_read_case,
-- the WRONG ARM. `manual` is used precisely to avoid that, and the scope is
-- ASSERTED below rather than assumed. (§7.1·2 was exactly this trigger shape.)
-- ===========================================================================
insert into public.action_items (id, commission_id, source_type, title, status_id, visibility_scope, assigned_to, created_by)
select '00000000-0000-0000-0000-0000000a5005', (select comm_x from k), 'manual', 'Item M5',
       (select id from public.action_item_statuses where commission_id is null and key = 'open'),
       'assignees_only', (select st_x2 from k), (select sa_x from k);
insert into public.action_item_assignments (action_item_id, user_id, role, assigned_by)
values ('00000000-0000-0000-0000-0000000a5005', (select st_x from k), 'contributor', (select sa_x from k));

select is((select visibility_scope from public.action_items where id = '00000000-0000-0000-0000-0000000a5005'),
  'assignees_only',
  'PRE ⭐: the item really IS assignees_only — the guard trigger did not rewrite the scope out from under the test');
select is((select source_case_id is null and case_id is null from public.action_items
           where id = '00000000-0000-0000-0000-0000000a5005'), true,
  'PRE ⭐ A24·5: the item has NO case anchor — this is precisely the arm a case-scoped resolver could never gate');

select is(app.can_read_action_item('00000000-0000-0000-0000-0000000a5005', (select st_x2 from k)), true,
  'M5 TWIN ⭐: the ACTIVE assignee reads his action item');
update public.profiles set is_active = false where id = (select st_x2 from k);
select is(app.can_read_action_item('00000000-0000-0000-0000-0000000a5005', (select st_x2 from k)), false,
  'M5 ⭐ A24·5: a DEACTIVATED assignee no longer reads the action item (today: true)');
update public.profiles set is_active = true where id = (select st_x2 from k);
select is(app.can_read_action_item('00000000-0000-0000-0000-0000000a5005', (select st_x2 from k)), true,
  'M5 RESTORE ⭐: reactivating restores it');
update public.profiles set suspended_until = now() + interval '1 day' where id = (select st_x2 from k);
select is(app.can_read_action_item('00000000-0000-0000-0000-0000000a5005', (select st_x2 from k)), false,
  'M5 ⭐ A24·5: a SUSPENDED assignee cannot read it either');
update public.profiles set suspended_until = null where id = (select st_x2 from k);

-- The satellite arm (action_item_assignments) is a SECOND raw arm on the same
-- branch — gating only `assigned_to` would leave it wide open.
select is(app.can_read_action_item('00000000-0000-0000-0000-0000000a5005', (select st_x from k)), true,
  'M5 TWIN ⭐: the ACTIVE satellite assignee reads the action item');
update public.profiles set is_active = false where id = (select st_x from k);
select is(app.can_read_action_item('00000000-0000-0000-0000-0000000a5005', (select st_x from k)), false,
  'M5 ⭐ A24·5: a DEACTIVATED satellite assignee no longer reads it — BOTH assignees_only arms are gated');
update public.profiles set is_active = true where id = (select st_x from k);
select is(app.can_read_action_item('00000000-0000-0000-0000-0000000a5005', (select st_x from k)), true,
  'M5 RESTORE ⭐: the satellite assignee reads again');

-- ===========================================================================
-- can_write_case_narrative · ⭐ NOT IN THE BRIEF — M1's OWN migration flagged this
-- arm and deferred it BY NAME to "the Stage-A/G sweep rather than smuggled in".
-- This is that sweep. arm 2 is a raw `v_assigned_to = p_uid`, and body_md is
-- PHI-bearing free text by its own column comment — so a deactivated assignee was
-- WRITING PHI.
-- ===========================================================================
select is(app.can_write_case_narrative('00000000-0000-0000-0000-0000000a5003', (select st_x2 from k)), true,
  'M5 TWIN ⭐: the ACTIVE narrative assignee writes his narrative (D10 assignment arm reaches)');
update public.profiles set is_active = false where id = (select st_x2 from k);
select is(app.can_write_case_narrative('00000000-0000-0000-0000-0000000a5003', (select st_x2 from k)), false,
  'M5 ⭐ defect ③: a DEACTIVATED narrative assignee no longer WRITES the narrative (M1 flagged this arm and left it for M5)');
update public.profiles set suspended_until = now() + interval '1 day', is_active = true where id = (select st_x2 from k);
select is(app.can_write_case_narrative('00000000-0000-0000-0000-0000000a5003', (select st_x2 from k)), false,
  'M5 ⭐: a SUSPENDED narrative assignee cannot write it either');
update public.profiles set suspended_until = null where id = (select st_x2 from k);
select is(app.can_write_case_narrative('00000000-0000-0000-0000-0000000a5003', (select st_x2 from k)), true,
  'M5 RESTORE ⭐: restoring him restores the write — the denial was is_active');

-- ===========================================================================
-- can_write_attachment · ⭐ NOT IN THE BRIEF. Its `action_item` arm carries the
-- same two raw assignee arms as can_read_action_item and — unlike
-- can_write_action_item_stake, which returns false unless can_read_action_item
-- passes first — it gates on NOTHING. So it was independently ungated.
-- ===========================================================================
select is(app.can_write_attachment('action_item', '00000000-0000-0000-0000-0000000a5005', (select st_x2 from k)), true,
  'M5 TWIN ⭐: the ACTIVE action-item assignee attaches to his item');
update public.profiles set is_active = false where id = (select st_x2 from k);
select is(app.can_write_attachment('action_item', '00000000-0000-0000-0000-0000000a5005', (select st_x2 from k)), false,
  'M5 ⭐ defect ③: a DEACTIVATED action-item assignee no longer attaches (an arm can_write_action_item_stake''s read-check never covered)');
update public.profiles set is_active = true where id = (select st_x2 from k);
select is(app.can_write_attachment('action_item', '00000000-0000-0000-0000-0000000a5005', (select st_x2 from k)), true,
  'M5 RESTORE ⭐: reactivating restores the attach');

-- ===========================================================================
-- referral_target_analyst · ⭐ NOT IN THE BRIEF'S FUNCTION LIST — but named in its
-- DEFECT STATEMENT ("referral analyst"). RULE 12: all THREE arms are raw and it
-- carries NO role wrapper, so it never reached is_active by any path. Its only
-- caller is can_read_referral_phi, whose other four arms are all gated — making
-- this the SINGLE ungated route to REFERRAL PHI.
--
-- The referral is inserted directly (status 'sent' — a draft has no target case,
-- and the arm is only reachable non-draft).
-- ⚠ `case_referral_distinct_commissions` FORCES source <> target, so the TARGET
-- case must live in the OTHER commission. A same-commission referral is not merely
-- unrealistic here — the CHECK rejects it and the suite ABORTS (which reports
-- "Failed: 0" and is NOT a pass, §7.1). Hence a real comm_y target case below.
-- ⚠ can_read_referral_phi does NOT consult the case_referrals flag (catalog-checked:
-- its body has no feature_enabled call), so no flag flip is needed or asserted here —
-- claiming otherwise would be prose, not a fact.
-- ===========================================================================
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy)
values ('00000000-0000-0000-0000-0000000a5007', (select comm_y from k), 95007, (select sa_y from k),
        'commission_default');
-- st_x is a member of comm_X only; on the comm_Y target case his ONLY reach is this
-- raw phase assignment. No role arm can confound the measurement.
insert into public.case_phases (id, case_id, position, title, form_id, form_version_id, assigned_to)
select '00000000-0000-0000-0000-0000000a5008', '00000000-0000-0000-0000-0000000a5007', 1,
       'Análise', (select form_y from k), (select ver_y from k), (select st_x from k);
insert into public.case_referral
  (id, code, source_case_id, source_commission_id, target_commission_id, target_case_id,
   type_label, subject, status)
values ('00000000-0000-0000-0000-0000000a5006', 'REF-M5-1',
        '00000000-0000-0000-0000-0000000a5001', (select comm_x from k), (select comm_y from k),
        '00000000-0000-0000-0000-0000000a5007', 'Parecer', 'Referral M5', 'sent');

select is(app.is_staff_admin_of_for((select comm_y from k), (select st_x from k)), false,
  'PRE ⭐: the target-case assignee is NOT staff_admin of the TARGET commission');
select is(app.is_staff_admin_of_for((select comm_x from k), (select st_x from k)), false,
  'PRE ⭐: …nor of the SOURCE commission — the target-case assignment is his ONLY referral arm');
select is(app.referral_target_analyst('00000000-0000-0000-0000-0000000a5006', (select st_x from k)), true,
  'M5 TWIN ⭐: the ACTIVE target-case phase assignee IS the referral analyst — the raw arm reaches');
select is(app.can_read_referral_phi('00000000-0000-0000-0000-0000000a5006', (select st_x from k)), true,
  'M5 TWIN ⭐ RULE 12: …and therefore reaches the REFERRAL PHI door while active');
update public.profiles set is_active = false where id = (select st_x from k);
select is(app.referral_target_analyst('00000000-0000-0000-0000-0000000a5006', (select st_x from k)), false,
  'M5 ⭐ defect ③: a DEACTIVATED assignee is no longer the referral analyst (today: true)');
select is(app.can_read_referral_phi('00000000-0000-0000-0000-0000000a5006', (select st_x from k)), false,
  'M5 ⭐⭐ RULE 12: …and no longer reaches REFERRAL PHI — this arm was the ONLY ungated route to it');
update public.profiles set suspended_until = now() + interval '1 day', is_active = true where id = (select st_x from k);
select is(app.can_read_referral_phi('00000000-0000-0000-0000-0000000a5006', (select st_x from k)), false,
  'M5 ⭐ RULE 12: a SUSPENDED assignee reaches no referral PHI either');
update public.profiles set suspended_until = null where id = (select st_x from k);
select is(app.can_read_referral_phi('00000000-0000-0000-0000-0000000a5006', (select st_x from k)), true,
  'M5 RESTORE ⭐: restoring him restores the referral-PHI reach — M5 gated the arm, it did not remove it (the B3 split is a different axis)');

-- ===========================================================================
-- ⛔ NO OVER-REACH — the whole risk of a narrowing (§7.7). Every ACTIVE principal
-- keeps EXACTLY the reach he had before M5. If M5 bound too much, these fail.
-- ===========================================================================
select is(app.can_read_case('00000000-0000-0000-0000-0000000a5001', (select sa_x from k)), true,
  'M5 NO OVER-REACH ⭐: the ACTIVE coordinator still reads the case');
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000a5001', (select sa_x from k)), true,
  'M5 NO OVER-REACH ⭐: …still reaches the PHI door');
select is(app.can_write_case_content('00000000-0000-0000-0000-0000000a5001', (select sa_x from k)), true,
  'M5 NO OVER-REACH ⭐: …and still writes case content');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select (public.get_case_patient('00000000-0000-0000-0000-0000000a5001'))->>'mrn'), 'MRN-M5-001',
  'M5 NO OVER-REACH ⭐ RULE 12: …and ACTUALLY READS the MRN — M5 did not deny everyone');
reset role;
select set_config('request.jwt.claims', '', true);
select is(app.can_read_action_item('00000000-0000-0000-0000-0000000a5005', (select sa_x from k)), true,
  'M5 NO OVER-REACH ⭐: the ACTIVE coordinator still reads the assignees_only action item (staff_admin arm intact)');

-- ===========================================================================
-- STRUCTURAL — catalog facts, so a refactor cannot silently drop the gate.
--
-- ⚠ COMMENTS ARE STRIPPED BEFORE THE MATCH. A prosrc regex COUNTS `--` comments
-- (§7.2·2), and this is the PRESENCE direction of that trap, which is the
-- dangerous one: the migration's own header explains the gate, so an unstripped
-- match would go GREEN on the COMMENT while the gate itself was absent. That is a
-- keystone that cannot fail. Strip first, then match.
-- ===========================================================================
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'app' and p.proname = 'can_read_case'
             and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'is_active'), 1,
  'M5 STRUCTURAL ⭐: can_read_case calls is_active in CODE (comments stripped — a comment match would be a vacuous green)');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'app' and p.proname = 'can_read_case_patient'
             and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'is_active'), 1,
  'M5 STRUCTURAL ⭐: can_read_case_patient calls is_active in CODE');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'app' and p.proname = 'can_write_case_content'
             and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'is_active'), 1,
  'M5 STRUCTURAL ⭐: can_write_case_content calls is_active in CODE');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'app' and p.proname = 'can_read_action_item'
             and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'is_active'), 1,
  'M5 STRUCTURAL ⭐ A24·5: can_read_action_item calls is_active in CODE');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'app' and p.proname in
                 ('can_write_case_narrative', 'can_write_attachment', 'referral_target_analyst')
             and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'is_active'), 3,
  'M5 STRUCTURAL ⭐: the three functions BEYOND the brief''s list call is_active in CODE too');

-- ⛔ SCOPE FENCE — M3 must survive M5 untouched. can_read_case KEEPS its two
-- assignment arms (assignment is CONTENT reach, D10); can_read_case_patient must
-- NOT regain them.
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'app' and p.proname = 'can_read_case'
             and p.prosrc ~ 'case_phases' and p.prosrc ~ 'case_narratives'), 1,
  'M5 SCOPE FENCE ⭐: can_read_case KEEPS both assignment arms — M5 gated them, it did not remove them (M3/D10 intact)');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'app' and p.proname = 'can_read_case_patient'
             and p.prosrc ~ 'case_phases'), 0,
  'M5 SCOPE FENCE ⭐: M3 survives — the PHI door still has no phase arm');

-- ⛔ SCOPE FENCE — the two pure-delegating wrappers get NO gate of their own.
-- Their arms all resolve to gated predicates, so a gate there would be a provable
-- no-op that A33 could never mutation-falsify, and a wasted per-row profiles
-- lookup on the member surface (A5 is a hard per-row-cost criterion). Asserted so
-- that "add it everywhere" is a visible change rather than a silent one.
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'app' and p.proname in ('can_read_case_or_admin', 'can_reach_case_on_member_surface')
             and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'is_active'), 0,
  'M5 SCOPE FENCE ⭐: the two pure-delegating wrappers carry NO redundant gate — they inherit it (asserted behaviourally above)');

select * from finish();
rollback;
