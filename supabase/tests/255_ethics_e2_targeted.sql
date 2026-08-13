-- =============================================================================
-- ETH·E2 (ADR 0073 §D13) — BE-3b gate: the respondent targeted-submission door.
--
-- ⛔ NON-VACUITY (the over-grant twin): the door's 3 access conjuncts
-- (removed_at / user_id / link_state) each GATE a different user out. The companion
-- mutation audit (be3b-targeted-door-mutation-audit.sh) widens each conjunct and
-- REQUIRES the matching keystone to go RED — i.e. a DIFFERENT user's response becomes
-- reachable. The "reaches nothing else" block proves the hard-deny holds: the targeted
-- respondent reads ZERO rows of cases/case_participants/ethics_*/case_decisions/
-- case_votes even though the case (and a participant row ABOUT them) exists.
--
-- Personas: sa_x (coordinator of comm_x), st_x / st_x2 (members of comm_x), sa_y (comm_y),
-- st_y (member of comm_y — a NON-MEMBER of comm_x; the LINKED targeted respondent).
-- st_x2 is the UNKNOWN-link target (link_state != 'linked' — cannot use the door).
-- Fresh reset (pgtap-needs-fresh-reset). Setup as superuser; door asserted per persona.
-- =============================================================================

begin;
select plan(26);

update app.feature_flags set enabled = true where key in ('ethics', 'audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'st_y')::uuid   as st_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'form_u')::uuid as form_u,
         (v->>'ver_u')::uuid  as ver_u,
         (v->>'item_mc')::uuid as item_mc,
         app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

-- ---------------------------------------------------------------------------
-- Fixture (superuser): an ethics case (marked) + a NON-ethics case, each with a phase;
-- three targeted responses; a LINKED respondent (st_y) + an UNKNOWN-link target (st_x2);
-- a decision + vote (for the reaches-nothing sweep).
-- ---------------------------------------------------------------------------
reset role;

insert into public.cases (id, commission_id, case_number, created_by, visibility_policy, confidentiality_level)
values
  ('00000000-0000-0000-0000-0000000e2001', (select comm_x from k), 92201, (select sa_x from k),
   'explicit_grants_only', 'ethics_investigation'),
  ('00000000-0000-0000-0000-0000000e2002', (select comm_x from k), 92202, (select sa_x from k),
   'commission_default', 'non_phi_internal');
insert into public.ethics_case_details (case_id) values ('00000000-0000-0000-0000-0000000e2001');

-- Phases (case-phase responses are the access anchor for the door).
insert into public.case_phases (id, case_id, position, form_id, form_version_id)
values
  ('00000000-0000-0000-0000-0000000e2200', '00000000-0000-0000-0000-0000000e2001', 1,
   (select form_u from k), (select ver_u from k)),
  -- Separate phase for resp2 (one response per case_phase).
  ('00000000-0000-0000-0000-0000000e2202', '00000000-0000-0000-0000-0000000e2001', 2,
   (select form_u from k), (select ver_u from k)),
  ('00000000-0000-0000-0000-0000000e2201', '00000000-0000-0000-0000-0000000e2002', 1,
   (select form_u from k), (select ver_u from k));

-- Targeted responses (created by the coordinator, in_progress). resp1 → st_y (linked);
-- resp2 → st_x2 (unknown link); resp3 on the NON-ethics case.
insert into public.responses (id, form_version_id, commission_id, created_by, status, case_phase_id, started_at)
values
  ('00000000-0000-0000-0000-0000000e2300', (select ver_u from k), (select comm_x from k),
   (select sa_x from k), 'in_progress', '00000000-0000-0000-0000-0000000e2200', now()),
  ('00000000-0000-0000-0000-0000000e2301', (select ver_u from k), (select comm_x from k),
   (select sa_x from k), 'in_progress', '00000000-0000-0000-0000-0000000e2202', now()),
  ('00000000-0000-0000-0000-0000000e2302', (select ver_u from k), (select comm_x from k),
   (select sa_x from k), 'in_progress', '00000000-0000-0000-0000-0000000e2201', now());

-- An answer on resp1 (for the respondent-reads-answers + write assertions).
insert into public.answers (id, response_id, item_id, question_key, value)
values ('00000000-0000-0000-0000-0000000e2400', '00000000-0000-0000-0000-0000000e2300',
        (select item_mc from k),
        (select question_key from public.form_items where id = (select item_mc from k)),
        '"sim"'::jsonb);

-- The respondent role + the LINKED respondent (st_y) and the UNKNOWN-link target (st_x2).
insert into public.case_participant_roles
  (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
values ('00000000-0000-0000-0000-0000000e2103', (select org_x from k), 'respondent_doctor',
        'Médico denunciado', array['professional'], true);

insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ('00000000-0000-0000-0000-0000000e2101', (select org_x from k), 'professional', 'professional_identity', 'Dr. Réu Linked'),
       ('00000000-0000-0000-0000-0000000e2121', (select org_x from k), 'professional', 'professional_identity', 'Dr. Réu Unknown');
insert into public.professional_profiles (id, organization_id, user_id, full_name, link_state)
values ('00000000-0000-0000-0000-0000000e2102', (select org_x from k), (select st_y from k),  'Dr. Réu Linked',  'linked'),
       -- NO-ACCOUNT target: user_id NULL. app.guard_professional_linkage enforces
       -- user_id-not-null ⇔ link_state='linked', so the ONLY way to be non-linked is a
       -- NULL user_id — i.e. a respondent with no platform account (responds out-of-band).
       ('00000000-0000-0000-0000-0000000e2122', (select org_x from k), null, 'Dr. Réu Sem Conta', 'no_account');
insert into public.professional_participants (participant_id, professional_profile_id)
values ('00000000-0000-0000-0000-0000000e2101', '00000000-0000-0000-0000-0000000e2102'),
       ('00000000-0000-0000-0000-0000000e2121', '00000000-0000-0000-0000-0000000e2122');
insert into public.case_participants (id, case_id, participant_id, role_id)
values ('00000000-0000-0000-0000-0000000e2110', '00000000-0000-0000-0000-0000000e2001',
        '00000000-0000-0000-0000-0000000e2101', '00000000-0000-0000-0000-0000000e2103'),
       ('00000000-0000-0000-0000-0000000e2130', '00000000-0000-0000-0000-0000000e2001',
        '00000000-0000-0000-0000-0000000e2121', '00000000-0000-0000-0000-0000000e2103'),
       -- A participant on the OTHER case (for the cross-case HC0J0 test).
       ('00000000-0000-0000-0000-0000000e2140', '00000000-0000-0000-0000-0000000e2002',
        '00000000-0000-0000-0000-0000000e2101', '00000000-0000-0000-0000-0000000e2103');

-- A decision + vote (so the reaches-nothing sweep has real rows to be denied).
insert into public.case_decisions (id, case_id, decision_type, summary_md, status)
values ('00000000-0000-0000-0000-0000000e2050', '00000000-0000-0000-0000-0000000e2001', 'ethics_ruling', 'x', 'voted');
insert into public.case_votes (case_id, decision_id, voter_id, vote)
values ('00000000-0000-0000-0000-0000000e2001', '00000000-0000-0000-0000-0000000e2050', (select sa_x from k), 'approve');

-- ===========================================================================
-- Block B — target_case_response authority + validation (coordinator sets the target).
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.target_case_response('00000000-0000-0000-0000-0000000e2300',
                                        '00000000-0000-0000-0000-0000000e2110') $$,
  'target_case_response: a coordinator targets resp1 at the respondent participant');
-- cross-case participant (belongs to e2002) → HC0J0.
select throws_ok(
  $$ select public.target_case_response('00000000-0000-0000-0000-0000000e2300',
                                        '00000000-0000-0000-0000-0000000e2140') $$,
  'HC0J0', null,
  'target_case_response: a participant from another case is refused with HC0J0');
-- a response on a NON-ethics case → HC0J0.
select throws_ok(
  $$ select public.target_case_response('00000000-0000-0000-0000-0000000e2302',
                                        '00000000-0000-0000-0000-0000000e2140') $$,
  'HC0J0', null,
  'target_case_response: a response on a non-ethics case is refused with HC0J0');
reset role;
-- a non-coordinator member → HC0J1.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.target_case_response('00000000-0000-0000-0000-0000000e2300',
                                        '00000000-0000-0000-0000-0000000e2110') $$,
  'HC0J1', null,
  'target_case_response: a non-coordinator is refused with HC0J1');
reset role;

-- ===========================================================================
-- Block C — the LINKED respondent (st_y, a NON-MEMBER of comm_x) reaches ONLY their
-- own response + answers + the form definition, and NOTHING else.
-- ===========================================================================
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.responses where id = '00000000-0000-0000-0000-0000000e2300'), 1,
  'targeted door: the linked respondent reads their own targeted response');
select is((select count(*)::int from public.answers where response_id = '00000000-0000-0000-0000-0000000e2300'), 1,
  'targeted door: the linked respondent reads their response answers');
select lives_ok(
  $$ update public.answers set value = '"nao"'::jsonb where id = '00000000-0000-0000-0000-0000000e2400' $$,
  'targeted door: the respondent WRITES an answer while in_progress');
-- Render the wizard as a NON-MEMBER (member-gated form_* SELECT would otherwise deny).
select is((select count(*)::int from public.form_versions where id = (select ver_u from k)), 1,
  'targeted door: the non-member respondent renders the form_version');
select ok((select count(*)::int from public.form_sections where form_version_id = (select ver_u from k)) >= 1,
  'targeted door: the non-member respondent renders the form_sections');
select ok((select count(*)::int from public.form_items where form_version_id = (select ver_u from k)) >= 1,
  'targeted door: the non-member respondent renders the form_items');
-- reaches NOTHING else — the 0072 hard-deny holds.
select is((select count(*)::int from public.cases where id = '00000000-0000-0000-0000-0000000e2001'), 0,
  'reaches-nothing: the respondent reads ZERO cases rows');
select is((select count(*)::int from public.case_participants where case_id = '00000000-0000-0000-0000-0000000e2001'), 0,
  'reaches-nothing: the respondent reads ZERO case_participants (even the row ABOUT them)');
select is((select count(*)::int from public.ethics_case_details where case_id = '00000000-0000-0000-0000-0000000e2001'), 0,
  'reaches-nothing: the respondent reads ZERO ethics_case_details');
select is((select count(*)::int from public.case_decisions where case_id = '00000000-0000-0000-0000-0000000e2001'), 0,
  'reaches-nothing: the respondent reads ZERO case_decisions');
select is((select count(*)::int from public.case_votes where case_id = '00000000-0000-0000-0000-0000000e2001'), 0,
  'reaches-nothing: the respondent reads ZERO case_votes');
reset role;

-- ⭐ user_id MUTATION keystone: a DIFFERENT user (st_x, a member but not the target) reads
-- ZERO of the targeted response. Widening prof.user_id = p_uid flips this RED.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.responses where id = '00000000-0000-0000-0000-0000000e2300'), 0,
  'over-grant (user_id): a non-target user reads ZERO of the targeted response');
reset role;

-- A non-target NON-member (sa_y) cannot render the form via the targeted arm.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.form_versions where id = (select ver_u from k)), 0,
  'targeted door: a non-target non-member reads ZERO form_versions (arm is targeted, not open)');
reset role;

-- ===========================================================================
-- Block D — a NO-ACCOUNT target (user_id NULL) cannot use the door — NObody can (they
-- respond out-of-band). This is D13's "only a linked profile" requirement, enforced
-- transitively by `prof.user_id = p_uid` (a NULL user_id never equals a caller's uid).
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.target_case_response('00000000-0000-0000-0000-0000000e2301',
                                        '00000000-0000-0000-0000-0000000e2130') $$,
  'target_case_response: the coordinator targets resp2 at the no-account participant');
reset role;
-- The no-account target's response is unreachable by ANY user (no user_id to resolve).
select is(app.can_access_targeted_response('00000000-0000-0000-0000-0000000e2301', (select st_x2 from k)), false,
  'targeted door: a no-account (user_id NULL) target is unreachable — some member cannot use the door');
select is(app.can_access_targeted_response('00000000-0000-0000-0000-0000000e2301', (select sa_x from k)), false,
  'targeted door: a no-account target is unreachable — the coordinator cannot use the door either');

-- ===========================================================================
-- Block E — submit: only the targeted user; then the response is read-only.
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.submit_targeted_case_response('00000000-0000-0000-0000-0000000e2300') $$,
  'HC0J9', null,
  'submit_targeted_case_response: a non-target user is refused with HC0J9');
reset role;
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.submit_targeted_case_response('00000000-0000-0000-0000-0000000e2300') $$,
  'submit_targeted_case_response: the targeted user submits their own defense');
select is((select count(*)::int from public.responses where id = '00000000-0000-0000-0000-0000000e2300'), 1,
  'targeted door: the respondent still READS the response after submit (read-only)');
reset role;
select is(app.can_write_targeted_response('00000000-0000-0000-0000-0000000e2300', (select st_y from k)), false,
  'targeted door: writes are closed once submitted (can_write_targeted_response is false)');

-- ===========================================================================
-- Block F — removed_at: a REMOVED target loses the door.
-- ===========================================================================
reset role;
update public.case_participants set removed_at = now() where id = '00000000-0000-0000-0000-0000000e2110';
-- ⭐ removed_at MUTATION keystone: after removal the ex-target reads ZERO. Widening
-- cp.removed_at is null flips this RED.
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.responses where id = '00000000-0000-0000-0000-0000000e2300'), 0,
  'over-grant (removed_at): a removed target reads ZERO of the response');
reset role;

-- ===========================================================================
-- Block G — flag-OFF: the door raises HC000.
-- ===========================================================================
update app.feature_flags set enabled = false where key = 'ethics';
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.target_case_response('00000000-0000-0000-0000-0000000e2301',
                                        '00000000-0000-0000-0000-0000000e2130') $$,
  'HC000', null,
  'flag-OFF: target_case_response raises HC000 when the ethics flag is off');
reset role;

select * from finish();
rollback;
