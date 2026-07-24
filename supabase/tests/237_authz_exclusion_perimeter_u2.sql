-- =============================================================================
-- AUTHZ · EXCLUSION PERIMETER — Unit 2 keystones. ADR 0078.
-- Migration: 20260801000000_authz_exclusion_perimeter_u2.sql
--
-- WHAT THIS PROVES. The CONTENT-WRITE half of the exclusion perimeter is closed: a
-- recused/respondent coordinator can no longer WRITE case content through the 11
-- bare-admin DEFINER RPCs (10 uniform + delete_committee_action_item), and the
-- action_items table gap is closed at BOTH layers (RPC + RLS, BUG-SUP-002).
--
-- ⛔ §7.7 — a NARROWING passes its negative BY CONSTRUCTION, so the POSITIVE TWIN is
-- the review: every deny (excluded coordinator → HC0F1) is paired with the clean
-- coordinator who MUST still perform the write, and the §2b non-case-anchored item
-- (committee/manual) MUST stay deletable by a coordinator excluded from some OTHER case.
--
-- ⛔ §7.2·6 — assert the DENIAL by its SEMANTIC, never by an SQLSTATE alone. The
-- negatives assert the exact HC0F1 the guard raises; the twins assert the write
-- LANDED (row changed), not merely "no HC0F1".
--
-- ⛔ §7.1 #3 — THE FIXTURE IS THE TRAP. No seeded persona is both EXCLUDED and
-- AUTHORIZED. Both excluded principals are MADE staff_admins, and BOTH legs
-- (respondent st_x AND recused st_x2) are asserted (PRE ⭐) before any door is called.
-- The world is bootstrapped (truncates) — every entity is MADE here, none borrowed.
-- =============================================================================
begin;
select plan(44);

update app.feature_flags set enabled = true
  where key in ('case_access', 'cases', 'narratives', 'extras', 'phase_results',
                'action_items', 'case_participants', 'audit_trail', 'interviews', 'meetings');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,   -- clean coordinator (positive twin)
         (v->>'st_x')::uuid   as st_x,   -- respondent + made staff_admin
         (v->>'st_x2')::uuid  as st_x2,  -- recused    + made staff_admin
         (v->>'comm_x')::uuid as comm_x,
         (v->>'form_u')::uuid as form_u,
         (v->>'ver_u')::uuid  as ver_u,
         app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

-- ── PRECONDITION FIXTURE ─────────────────────────────────────────────────────
-- The two excluded principals ALSO hold staff_admin so the doors reach the
-- EXCLUSION gate (HC0F1) rather than dying on authority (42501).
insert into public.memberships (principal_id, commission_id, role)
values ((select st_x from k),  (select comm_x from k), 'staff_admin'),
       ((select st_x2 from k), (select comm_x from k), 'staff_admin');

-- One open case in comm_x.
insert into public.cases (id, organization_id, commission_id, case_number, created_by, status, visibility_policy)
values ('00000000-0000-0000-0000-0000000c8001', (select org_x from k), (select comm_x from k), 98001,
        (select sa_x from k), 'in_review', 'explicit_grants_only');

-- respondent chain for st_x (leg 1 — is_case_respondent).
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ('00000000-0000-0000-0000-0000000c8101', (select org_x from k), 'professional', 'professional_identity', 'Dr. Réu');
insert into public.professional_profiles (id, organization_id, user_id, full_name)
values ('00000000-0000-0000-0000-0000000c8102', (select org_x from k), (select st_x from k), 'Dr. Réu');
insert into public.professional_participants (participant_id, professional_profile_id)
values ('00000000-0000-0000-0000-0000000c8101', '00000000-0000-0000-0000-0000000c8102');
insert into public.case_participant_roles
  (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
values ('00000000-0000-0000-0000-0000000c8103', (select org_x from k), 'respondent_doctor',
        'Médico denunciado', array['professional'], true);
insert into public.case_participants (id, case_id, participant_id, role_id, is_primary_subject)
values ('00000000-0000-0000-0000-0000000c8104', '00000000-0000-0000-0000-0000000c8001',
        '00000000-0000-0000-0000-0000000c8101', '00000000-0000-0000-0000-0000000c8103', true);

-- recusal for st_x2 (leg 2 — is_recused_from_case).
insert into public.case_recusals (case_id, user_id, source)
values ('00000000-0000-0000-0000-0000000c8001', (select st_x2 from k), 'coordinator');

-- CONTENT — one entity per twin so twins don't collide.
--   narratives
insert into public.case_narratives (id, case_id, type_label, display_position, status, assigned_to, created_by)
values ('00000000-0000-0000-0000-0000000c8201','00000000-0000-0000-0000-0000000c8001','N assign', 1,'open', null, (select sa_x from k)),
       ('00000000-0000-0000-0000-0000000c8202','00000000-0000-0000-0000-0000000c8001','N conclude',2,'open',(select sa_x from k),(select sa_x from k)),
       ('00000000-0000-0000-0000-0000000c8203','00000000-0000-0000-0000-0000000c8001','N reopen', 3,'completed',null,(select sa_x from k)),
       ('00000000-0000-0000-0000-0000000c8204','00000000-0000-0000-0000-0000000c8001','N unassign',4,'open',(select sa_x from k),(select sa_x from k));
--   phases (form_u/ver_u belong to comm_x)
insert into public.case_phases (id, case_id, position, form_id, form_version_id, status, emits_result)
values ('00000000-0000-0000-0000-0000000c8301','00000000-0000-0000-0000-0000000c8001',1,(select form_u from k),(select ver_u from k),'pending',false),
       ('00000000-0000-0000-0000-0000000c8302','00000000-0000-0000-0000-0000000c8001',2,(select form_u from k),(select ver_u from k),'pending',false),
       ('00000000-0000-0000-0000-0000000c8303','00000000-0000-0000-0000-0000000c8001',3,(select form_u from k),(select ver_u from k),'active', false),
       ('00000000-0000-0000-0000-0000000c8305','00000000-0000-0000-0000-0000000c8001',5,(select form_u from k),(select ver_u from k),'completed', false);
--   phase result option for the override twin
insert into public.phase_results (id, commission_id, label, position)
values ('00000000-0000-0000-0000-0000000c8401',(select comm_x from k),'Procedente',1);
--   case outcomes for the offered-outcomes twin
insert into public.case_outcomes (id, commission_id, label, position)
values ('00000000-0000-0000-0000-0000000c8501',(select comm_x from k),'Arquivado',1),
       ('00000000-0000-0000-0000-0000000c8502',(select comm_x from k),'Advertência',2);
--   action items: a case-anchored (case_restricted) + a committee (no anchor)
insert into public.action_items (id, commission_id, source_type, title, status_id, source_case_id, visibility_scope, created_by)
values ('00000000-0000-0000-0000-0000000c8601',(select comm_x from k),'case','AI case',
        (select id from public.action_item_statuses where key='open' and commission_id is null limit 1),
        '00000000-0000-0000-0000-0000000c8001','case_restricted',(select sa_x from k)),
       ('00000000-0000-0000-0000-0000000c8602',(select comm_x from k),'manual','AI committee',
        (select id from public.action_item_statuses where key='open' and commission_id is null limit 1),
        null,'committee',(select sa_x from k));

-- ── PRE-FLIGHT (assert the fixture, never assume it) ─────────────────────────
select is((select exists (select 1 from app.feature_flags where key = 'case_access')), false, 'B4: case_access flag RETIRED');
select is(app.is_case_excluded('00000000-0000-0000-0000-0000000c8001', (select st_x from k)), true,
  'PRE ⭐ leg 1/2: st_x EXCLUDED via RESPONDENT leg');
select is(app.is_staff_admin_of_for((select comm_x from k), (select st_x from k)), true,
  'PRE ⭐ leg 1/2: st_x ALSO staff_admin (reaches HC0F1, not 42501)');
select is(app.is_case_excluded('00000000-0000-0000-0000-0000000c8001', (select st_x2 from k)), true,
  'PRE ⭐ leg 2/2: st_x2 EXCLUDED via RECUSAL leg');
select is(app.is_staff_admin_of_for((select comm_x from k), (select st_x2 from k)), true,
  'PRE ⭐ leg 2/2: st_x2 ALSO staff_admin');
select is(app.is_case_excluded('00000000-0000-0000-0000-0000000c8001', (select sa_x from k)), false,
  'PRE: sa_x is a CLEAN coordinator (not excluded) — the positive twin');

-- ===========================================================================
-- §2a NEGATIVES — the RECUSED coordinator (st_x2) is DENIED (HC0F1) on all 10
-- ===========================================================================
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok($$select public.activate_phase('00000000-0000-0000-0000-0000000c8301', (select sa_x from k), null)$$, 'HC0F1', null, '2a·recused activate_phase → HC0F1');
select throws_ok($$select public.reassign_phase('00000000-0000-0000-0000-0000000c8302', (select sa_x from k), null)$$, 'HC0F1', null, '2a·recused reassign_phase → HC0F1');
select throws_ok($$select public.set_case_phase_result_override('00000000-0000-0000-0000-0000000c8303', '00000000-0000-0000-0000-0000000c8401', 'x')$$, 'HC0F1', null, '2a·recused set_case_phase_result_override → HC0F1');
select throws_ok($$select public.add_ad_hoc_narrative('00000000-0000-0000-0000-0000000c8001', null, 'T', 'Ti', 'In', null)$$, 'HC0F1', null, '2a·recused add_ad_hoc_narrative → HC0F1');
select throws_ok($$select public.assign_narrative('00000000-0000-0000-0000-0000000c8201', (select sa_x from k))$$, 'HC0F1', null, '2a·recused assign_narrative → HC0F1');
select throws_ok($$select public.conclude_narrative('00000000-0000-0000-0000-0000000c8202')$$, 'HC0F1', null, '2a·recused conclude_narrative → HC0F1');
select throws_ok($$select public.unassign_narrative('00000000-0000-0000-0000-0000000c8204')$$, 'HC0F1', null, '2a·recused unassign_narrative → HC0F1');
select throws_ok($$select public.update_case_meta('00000000-0000-0000-0000-0000000c8001', 'HACK', null, null)$$, 'HC0F1', null, '2a·recused update_case_meta → HC0F1');
select throws_ok($$select public.set_case_offered_outcomes('00000000-0000-0000-0000-0000000c8001', array['00000000-0000-0000-0000-0000000c8501']::uuid[])$$, 'HC0F1', null, '2a·recused set_case_offered_outcomes → HC0F1');
reset role;

-- ===========================================================================
-- §2a NEGATIVES — the RESPONDENT coordinator (st_x) is DENIED (HC0F1) on all 10
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok($$select public.activate_phase('00000000-0000-0000-0000-0000000c8301', (select sa_x from k), null)$$, 'HC0F1', null, '2a·respondent activate_phase → HC0F1');
select throws_ok($$select public.reassign_phase('00000000-0000-0000-0000-0000000c8302', (select sa_x from k), null)$$, 'HC0F1', null, '2a·respondent reassign_phase → HC0F1');
select throws_ok($$select public.set_case_phase_result_override('00000000-0000-0000-0000-0000000c8303', '00000000-0000-0000-0000-0000000c8401', 'x')$$, 'HC0F1', null, '2a·respondent set_case_phase_result_override → HC0F1');
select throws_ok($$select public.add_ad_hoc_narrative('00000000-0000-0000-0000-0000000c8001', null, 'T', 'Ti', 'In', null)$$, 'HC0F1', null, '2a·respondent add_ad_hoc_narrative → HC0F1');
select throws_ok($$select public.assign_narrative('00000000-0000-0000-0000-0000000c8201', (select sa_x from k))$$, 'HC0F1', null, '2a·respondent assign_narrative → HC0F1');
select throws_ok($$select public.conclude_narrative('00000000-0000-0000-0000-0000000c8202')$$, 'HC0F1', null, '2a·respondent conclude_narrative → HC0F1');
select throws_ok($$select public.unassign_narrative('00000000-0000-0000-0000-0000000c8204')$$, 'HC0F1', null, '2a·respondent unassign_narrative → HC0F1');
select throws_ok($$select public.update_case_meta('00000000-0000-0000-0000-0000000c8001', 'HACK', null, null)$$, 'HC0F1', null, '2a·respondent update_case_meta → HC0F1');
select throws_ok($$select public.set_case_offered_outcomes('00000000-0000-0000-0000-0000000c8001', array['00000000-0000-0000-0000-0000000c8501']::uuid[])$$, 'HC0F1', null, '2a·respondent set_case_offered_outcomes → HC0F1');
reset role;

-- ===========================================================================
-- §2a TWINS — the CLEAN coordinator (sa_x) STILL performs every write (§7.7)
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok($$select public.activate_phase('00000000-0000-0000-0000-0000000c8301', (select sa_x from k), null)$$, '2a·TWIN activate_phase: clean coordinator still activates');
select lives_ok($$select public.reassign_phase('00000000-0000-0000-0000-0000000c8302', (select sa_x from k), null)$$, '2a·TWIN reassign_phase: clean coordinator still reassigns');
select lives_ok($$select public.set_case_phase_result_override('00000000-0000-0000-0000-0000000c8303', '00000000-0000-0000-0000-0000000c8401', 'x')$$, '2a·TWIN set_case_phase_result_override: clean coordinator still overrides');
select lives_ok($$select public.add_ad_hoc_narrative('00000000-0000-0000-0000-0000000c8001', null, 'T', 'Ti', 'In', null)$$, '2a·TWIN add_ad_hoc_narrative: clean coordinator still adds');
select lives_ok($$select public.assign_narrative('00000000-0000-0000-0000-0000000c8201', (select sa_x from k))$$, '2a·TWIN assign_narrative: clean coordinator still assigns');
select lives_ok($$select public.conclude_narrative('00000000-0000-0000-0000-0000000c8202')$$, '2a·TWIN conclude_narrative: clean coordinator still concludes');
select lives_ok($$select public.unassign_narrative('00000000-0000-0000-0000-0000000c8204')$$, '2a·TWIN unassign_narrative: clean coordinator still unassigns');
select lives_ok($$select public.update_case_meta('00000000-0000-0000-0000-0000000c8001', 'legit rename', null, null)$$, '2a·TWIN update_case_meta: clean coordinator still edits');
select lives_ok($$select public.set_case_offered_outcomes('00000000-0000-0000-0000-0000000c8001', array['00000000-0000-0000-0000-0000000c8501','00000000-0000-0000-0000-0000000c8502']::uuid[])$$, '2a·TWIN set_case_offered_outcomes: clean coordinator still sets');
select is((select label from public.cases where id='00000000-0000-0000-0000-0000000c8001'), 'legit rename',
  '2a·TWIN update_case_meta LANDED (row changed — semantic, not just no-throw)');
reset role;

-- ===========================================================================
-- §2b — action_items BOTH LAYERS (C7 gap)
-- ===========================================================================
-- (a) RLS layer: the RECUSED coordinator's RAW DELETE of a case_restricted item is
--     silently blocked (0 rows) — the DEFINER bypass is not the only door.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select lives_ok($$delete from public.action_items where id='00000000-0000-0000-0000-0000000c8601'$$,
  '2b·RLS raw DELETE by recused coordinator does not error (RLS silently filters)');
reset role;
select is((select count(*)::int from public.action_items where id='00000000-0000-0000-0000-0000000c8601'), 1,
  '2b·RLS the case-restricted action item SURVIVES the raw DELETE (USING term blocks it)');

-- (b) RPC layer: recused + respondent → HC0F1 on the case-anchored item.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok($$select public.delete_committee_action_item('00000000-0000-0000-0000-0000000c8601')$$, 'HC0F1', null, '2b·RPC recused delete case-anchored → HC0F1');
-- §7.7 NON-ANCHOR TWIN: a coordinator excluded from the CASE can still delete a
-- COMMITTEE item (no case anchor) — the `is null` guard must NOT over-bind.
select lives_ok($$select public.delete_committee_action_item('00000000-0000-0000-0000-0000000c8602')$$, '2b·TWIN recused-from-case coordinator STILL deletes a committee (no-anchor) item');
reset role;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok($$select public.delete_committee_action_item('00000000-0000-0000-0000-0000000c8601')$$, 'HC0F1', null, '2b·RPC respondent delete case-anchored → HC0F1');
reset role;
-- CLEAN-coordinator twin: deletes the case-anchored item (LAST — it mutates).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok($$select public.delete_committee_action_item('00000000-0000-0000-0000-0000000c8601')$$, '2b·TWIN clean coordinator STILL deletes the case-anchored item');
reset role;
select is((select count(*)::int from public.action_items where id='00000000-0000-0000-0000-0000000c8601'), 0,
  '2b·TWIN the clean delete LANDED (row gone)');

-- ===========================================================================
-- §③ — recompute_recommendations GUARDED (NOT revoked — it has live INVOKER callers)
-- ===========================================================================
-- authenticated MUST retain EXECUTE (add_ad_hoc_phase / skip_phase call it directly).
select is(has_function_privilege('authenticated', 'public.recompute_recommendations(uuid)', 'EXECUTE'), true,
  '§3 authenticated STILL holds EXECUTE (the two INVOKER callers need it — revoke would break them)');
-- NEGATIVE: a recused coordinator calling it DIRECTLY is denied by the new guard.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok($$select public.recompute_recommendations('00000000-0000-0000-0000-0000000c8001')$$, 'HC0F1', null,
  '§3 recused coordinator calling recompute_recommendations DIRECTLY → HC0F1');
reset role;
-- TWIN: the internal path still works — a CLEAN coordinator overriding a COMPLETED
-- phase internally calls recompute_recommendations, which passes the guard.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok($$select public.set_case_phase_result_override('00000000-0000-0000-0000-0000000c8305', '00000000-0000-0000-0000-0000000c8401', 'x')$$,
  '§3 the internal recompute path still works (clean coordinator triggers it past the guard)');
reset role;

select * from finish();
rollback;
