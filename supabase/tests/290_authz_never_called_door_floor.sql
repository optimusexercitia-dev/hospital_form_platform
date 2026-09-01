-- =============================================================================
-- ADR 0079 ARM 2 (never-called-door floor) — keystones for 14 `authenticated`-
-- reachable public SECURITY DEFINER doors that the pgTAP suite never called.
--
-- `ARM=floor bash supabase/tests/mutation/p0-authz-invariant.sh` reported these 14
-- with `calls = 0` after a full `supabase test db`. A door no keystone drives is
-- door-blind BY CONSTRUCTION: its gate can be neutralized and the suite stays green.
-- Each is DEFINER, so the `if not <predicate> then raise` in its body IS the whole
-- authorization boundary — RLS never runs. That makes the body's gate the thing
-- under test here.
--
-- None was allowlisted: all 14 carry a real deny case with a distinct errcode, and
-- FOUR of them (create/archive_ethics_sanction_type, assign_ethics_remediation,
-- open_ethics_external_referral) have NO caller anywhere in src/ or e2e/ either, so
-- the allowlist's "door-only / E2E-only" rationale cannot apply to them.
--
-- Discipline (ADR 0079 §2 + docs/progress/authz-handoff.md §7): every negative
-- carries a POSITIVE twin, so a fail-closed regression cannot masquerade as passing
-- isolation. Deny principals are chosen to be reader-non-writers — a member who can
-- SEE the row but must not act on it (st_x/st_x2), or a coordinator of a FOREIGN org
-- (sa_f) — never a principal who simply cannot find the row.
--
-- NOTE ON THE FIXTURE: bootstrap() homes comm_x AND comm_y under ONE org, so `sa_y`
-- is NOT cross-tenant for the org-scoped catalogs (app.can_manage_case_vocabulary would
-- return TRUE for it). This suite builds a genuinely foreign org (org_f/sa_f) for the
-- tenancy arms. ⚠ The gate was `can_manage_professional` until AE4.7c gave rows 31/32
-- their own gates (matrix § 12.3); the POPULATION is unchanged, which is why every
-- assertion in this file is too.
-- =============================================================================

begin;
select plan(40);

update app.feature_flags set enabled = true
  where key in ('ethics', 'audit_trail', 'meetings', 'case_participants',
                'action_items', 'case_referrals', 'case_types', 'cases_extras');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,  (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,   (v->>'st_x2')::uuid  as st_x2,
         (v->>'sa_y')::uuid   as sa_y,   (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y, (v->>'org_b')::uuid  as org_b,
         (v->>'form_u')::uuid as form_u, (v->>'ver_u')::uuid  as ver_u
  from ctx;
grant select on k to authenticated;

reset role;

-- ── A genuinely FOREIGN tenant: its own org, hospital, commission, staff_admin ──
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000f001',
        'authenticated', 'authenticated', 'sa-f@test', now(), now());
insert into public.organizations (id, name, slug)
values ('00000000-0000-0000-0000-00000000f002', 'Org Foreign', 'org-foreign-f002');
insert into public.hospitals (id, organization_id, name, slug)
values ('00000000-0000-0000-0000-00000000f003', '00000000-0000-0000-0000-00000000f002',
        'Hosp Foreign', 'hosp-foreign-f003');
update public.profiles
   set full_name = 'StaffAdmin F'
 where id = '00000000-0000-0000-0000-00000000f001';
insert into public.commissions (id, name, slug, created_by, hospital_id)
values ('00000000-0000-0000-0000-00000000f004', 'Comissão F', 'comm-f-f004',
        (select admin from k), '00000000-0000-0000-0000-00000000f003');
insert into public.memberships (commission_id, principal_id, role)
values ('00000000-0000-0000-0000-00000000f004', '00000000-0000-0000-0000-00000000f001', 'staff_admin');

-- A catalog row owned by the FOREIGN org — the cross-tenant payload for the
-- set_case_phase_assignment_role HC0J0 arm.
insert into public.case_assignment_roles (id, organization_id, key, display_name)
values ('00000000-0000-0000-0000-00000000f010', '00000000-0000-0000-0000-00000000f002',
        'relator_foreign', 'Relator (org estrangeira)');
-- Case types: one in the fixture org, one foreign (the HC0F7 arm).
insert into public.case_types (id, organization_id, key, display_name, primary_subject_kind,
                               default_visibility_policy, default_confidentiality_level)
values ('00000000-0000-0000-0000-00000000f020', (select org_b from k), 'sindicancia_local',
        'Sindicância', 'professional', 'commission_default', 'non_phi_internal'),
       ('00000000-0000-0000-0000-00000000f021', '00000000-0000-0000-0000-00000000f002',
        'sindicancia_foreign', 'Sindicância (estrangeira)', 'professional',
        'commission_default', 'non_phi_internal');

-- An ethics-typed case in commission X + one phase on it.
insert into public.cases (id, commission_id, case_number, created_by,
                          visibility_policy, confidentiality_level)
values ('00000000-0000-0000-0000-0000000f0100', (select comm_x from k), 92901,
        (select sa_x from k), 'explicit_grants_only', 'ethics_investigation');
insert into public.ethics_case_details (case_id) values ('00000000-0000-0000-0000-0000000f0100');
insert into public.case_phases (id, case_id, position, form_id, form_version_id, title)
values ('00000000-0000-0000-0000-0000000f0101', '00000000-0000-0000-0000-0000000f0100', 0,
        (select form_u from k), (select ver_u from k), 'Fase de instrução');

-- =============================================================================
-- GROUP A — the org-scoped vocabulary catalogs (6 doors)
-- Gate: app.can_manage_case_vocabulary(org, auth.uid()) → 42501 (matrix row 32).
-- ⚠ Was can_manage_professional until AE4.7c's family split. `staff_admin` KEEPS this
-- capability — the split exists precisely so the row-30 revoke could not take it.
-- create_* trusts a CALLER-SUPPLIED p_org; archive_* derives the org FROM THE ROW.
-- Both directions are pinned: an attacker must not be able to pick the org, and
-- must not be able to reach a row whose org they cannot manage.
-- =============================================================================

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table voc on commit drop as
  select public.create_ethics_allegation_category((select org_b from k), 'conduta_x', 'Conduta') as cat_id,
         public.create_ethics_sanction_type((select org_b from k), 'advertencia_x', 'Advertência') as sanc_id,
         public.create_case_assignment_role((select org_b from k), 'relator_x', 'Relator') as role_id;
reset role;
grant select on voc to authenticated;

select ok((select cat_id  from voc) is not null,
  'create_ethics_allegation_category: the org staff_admin creates a category (positive twin)');
select ok((select sanc_id from voc) is not null,
  'create_ethics_sanction_type: the org staff_admin creates a sanction type (positive twin)');
select ok((select role_id from voc) is not null,
  'create_case_assignment_role: the org staff_admin creates an assignment role (positive twin)');

-- Deny 1 — a staff_admin of a FOREIGN org may not write this org's catalogs
-- (the caller supplies p_org, so this is the arm that stops org-picking).
select test_helpers.claims_for('00000000-0000-0000-0000-00000000f001', false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_ethics_allegation_category(%L, 'conduta_f', 'X') $$, (select org_b from k)),
  '42501', null, 'create_ethics_allegation_category: a FOREIGN-org staff_admin is refused 42501');
select throws_ok(
  format($$ select public.create_ethics_sanction_type(%L, 'advert_f', 'X') $$, (select org_b from k)),
  '42501', null, 'create_ethics_sanction_type: a FOREIGN-org staff_admin is refused 42501');
select throws_ok(
  format($$ select public.create_case_assignment_role(%L, 'relator_f', 'X') $$, (select org_b from k)),
  '42501', null, 'create_case_assignment_role: a FOREIGN-org staff_admin is refused 42501');
-- …and may not archive a row belonging to this org (org derived from the row).
select throws_ok(
  format($$ select public.archive_ethics_allegation_category(%L) $$, (select cat_id from voc)),
  '42501', null, 'archive_ethics_allegation_category: a FOREIGN-org staff_admin is refused 42501');
select throws_ok(
  format($$ select public.archive_ethics_sanction_type(%L) $$, (select sanc_id from voc)),
  '42501', null, 'archive_ethics_sanction_type: a FOREIGN-org staff_admin is refused 42501');
select throws_ok(
  format($$ select public.archive_case_assignment_role(%L) $$, (select role_id from voc)),
  '42501', null, 'archive_case_assignment_role: a FOREIGN-org staff_admin is refused 42501');
reset role;

-- Deny 2 — a plain member of THIS org (reads the catalog, cannot manage it).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_ethics_allegation_category(%L, 'conduta_s', 'X') $$, (select org_b from k)),
  '42501', null, 'create_ethics_allegation_category: a non-admin member is refused 42501');
select throws_ok(
  format($$ select public.create_ethics_sanction_type(%L, 'advert_s', 'X') $$, (select org_b from k)),
  '42501', null, 'create_ethics_sanction_type: a non-admin member is refused 42501');
select throws_ok(
  format($$ select public.create_case_assignment_role(%L, 'relator_s', 'X') $$, (select org_b from k)),
  '42501', null, 'create_case_assignment_role: a non-admin member is refused 42501');
select throws_ok(
  format($$ select public.archive_ethics_allegation_category(%L) $$, (select cat_id from voc)),
  '42501', null, 'archive_ethics_allegation_category: a non-admin member is refused 42501');
select throws_ok(
  format($$ select public.archive_ethics_sanction_type(%L) $$, (select sanc_id from voc)),
  '42501', null, 'archive_ethics_sanction_type: a non-admin member is refused 42501');
select throws_ok(
  format($$ select public.archive_case_assignment_role(%L) $$, (select role_id from voc)),
  '42501', null, 'archive_case_assignment_role: a non-admin member is refused 42501');
reset role;

-- Positive twins for the archive doors.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.archive_ethics_allegation_category(%L) $$, (select cat_id from voc)),
  'archive_ethics_allegation_category: the org staff_admin archives (positive twin)');
select lives_ok(
  format($$ select public.archive_ethics_sanction_type(%L) $$, (select sanc_id from voc)),
  'archive_ethics_sanction_type: the org staff_admin archives (positive twin)');
select lives_ok(
  format($$ select public.archive_case_assignment_role(%L) $$, (select role_id from voc)),
  'archive_case_assignment_role: the org staff_admin archives (positive twin)');
reset role;

-- =============================================================================
-- GROUP B — the ethics case-scoped doors (4)
-- Gate: app.assert_ethics_coordinator(case_id) → HC0J1 (authority-first).
-- The deny principal is st_x2: a member of the SAME commission, who can read the
-- case but is not its coordinator (ADR 0079 §2 reader-non-writer).
-- =============================================================================

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
-- A decision may only be opened on an ADMISSIBLE ethics case (create_case_decision
-- raises otherwise), so walk the intake step first — same order as suite 258.
select public.upsert_ethics_case_details('00000000-0000-0000-0000-0000000f0100',
  'internal', now(), 'Resumo');
select public.decide_admissibility('00000000-0000-0000-0000-0000000f0100', 'admissible', 'ok');
create temp table de on commit drop as
  select public.create_case_decision('00000000-0000-0000-0000-0000000f0100',
    'ethics_ruling', 'Sumário', 'Motivo') as did;
create temp table no on commit drop as
  select public.issue_ethics_notification('00000000-0000-0000-0000-0000000f0100',
    'respondent_notification', 'letter', null, null, now() + interval '15 days') as nid;
reset role;
grant select on de to authenticated;
grant select on no to authenticated;

-- assign_ethics_remediation
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.assign_ethics_remediation(%L, 'T', 'D', null, null) $$, (select did from de)),
  'HC0J1', null, 'assign_ethics_remediation: a non-coordinator member is refused HC0J1');
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table rem on commit drop as
  select public.assign_ethics_remediation((select did from de), 'Treinamento',
    'Plano de remediação', null, current_date + 30) as aid;
reset role;
grant select on rem to authenticated;
select ok((select aid from rem) is not null,
  'assign_ethics_remediation: the coordinator creates the remediation action (positive twin)');

-- open_ethics_external_referral
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.open_ethics_external_referral(%L, %L, %L, 'Assunto', 'Descrição') $$,
    (select did from de), (select comm_y from k),
    (select id from public.referral_types where is_active order by position limit 1)),
  'HC0J1', null, 'open_ethics_external_referral: a non-coordinator member is refused HC0J1');
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table ext on commit drop as
  select public.open_ethics_external_referral((select did from de), (select comm_y from k),
    (select id from public.referral_types where is_active order by position limit 1),
    'Comunicação externa', 'Descrição') as rid;
reset role;
grant select on ext to authenticated;
select ok((select rid from ext) is not null,
  'open_ethics_external_referral: the coordinator opens the external referral (positive twin)');

-- cancel_ethics_notification
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.cancel_ethics_notification(%L) $$, (select nid from no)),
  'HC0J1', null, 'cancel_ethics_notification: a non-coordinator member is refused HC0J1');
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.cancel_ethics_notification(%L) $$, (select nid from no)),
  'cancel_ethics_notification: the coordinator cancels the notice (positive twin)');
reset role;

-- void_decision
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.void_decision(%L, 'motivo') $$, (select did from de)),
  'HC0J1', null, 'void_decision: a non-coordinator member is refused HC0J1');
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.void_decision(%L, 'anulada por vício') $$, (select did from de)),
  'void_decision: the coordinator voids the decision (positive twin)');
reset role;
select is((select status from public.case_decisions where id = (select did from de)), 'voided',
  'void_decision: the decision status is voided');

-- =============================================================================
-- GROUP C — case-phase / process-template configuration (2 doors)
-- =============================================================================

-- set_case_phase_assignment_role: coordinator gate (HC0J1) + the role must belong
-- to the case's own org (HC0J0) — a cross-tenant catalog row must not be assignable.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_phase_assignment_role(%L, %L) $$,
    '00000000-0000-0000-0000-0000000f0101', (select role_id from voc)),
  'HC0J1', null, 'set_case_phase_assignment_role: a non-coordinator member is refused HC0J1');
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_phase_assignment_role(%L, %L) $$,
    '00000000-0000-0000-0000-0000000f0101', '00000000-0000-0000-0000-00000000f010'),
  'HC0J0', null,
  'set_case_phase_assignment_role: a role from ANOTHER org is rejected HC0J0 (tenancy)');
select lives_ok(
  format($$ select public.set_case_phase_assignment_role(%L, %L) $$,
    '00000000-0000-0000-0000-0000000f0101', (select role_id from voc)),
  'set_case_phase_assignment_role: the coordinator assigns an own-org role (positive twin)');
reset role;

-- set_template_case_type: app.is_staff_admin_of(commission) → 42501, the case type
-- must belong to the commission's org (HC0F7), and an archived template is frozen.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'Processo', 'Descrição')).id as tid, null::uuid as vid;
-- ADR 0096: resolve the v1 draft in a SEPARATE statement. The helper is
-- STABLE, so inside the CREATE ... AS above it would see the pre-statement
-- snapshot and return NULL.
update tpl set vid = app.draft_version_of_template(tid);
reset role;
grant select on tpl to authenticated;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_template_case_type(%L, %L) $$,
    (select vid from tpl), '00000000-0000-0000-0000-00000000f020'),
  '42501', null, 'set_template_case_type: a non-staff_admin member is refused 42501');
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_template_case_type(%L, %L) $$,
    (select vid from tpl), '00000000-0000-0000-0000-00000000f021'),
  'HC0F7', null,
  'set_template_case_type: a case type from ANOTHER org is rejected HC0F7 (tenancy)');
select lives_ok(
  format($$ select public.set_template_case_type(%L, %L) $$,
    (select vid from tpl), '00000000-0000-0000-0000-00000000f020'),
  'set_template_case_type: the staff_admin sets an own-org case type (positive twin)');
reset role;
-- ADR 0096: `status` no longer lives on process_templates — a template counts as
-- archived iff ALL its versions are archived. Archive through the real door so the
-- version-level guard and the publish-RPC GUC are exercised as in production.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.archive_process_template((select tid from tpl));
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
-- ⚠ DELIBERATE BEHAVIOUR CHANGE — do NOT "fix" this back to `status <> 'archived'`.
-- set_template_case_type's gate is now DRAFT-ONLY, not merely not-archived. The old
-- gate let an edit through on a PUBLISHED version, which is a silent immutability
-- hole; draft-only closes it. The archived version below is still refused, and the
-- SQLSTATE is unchanged (23514 / check_violation) — only the gate widened.
select throws_ok(
  format($$ select public.set_template_case_type(%L, null) $$, (select vid from tpl)),
  '23514', null, 'set_template_case_type: a non-draft (archived) version cannot be edited');
reset role;

-- =============================================================================
-- GROUP D — referral doors (2)
-- =============================================================================

-- unlink_referral_case has a BRANCHING gate: a link attributed to the SOURCE
-- commission is removable only by the source coordinator, one attributed to the
-- TARGET only by the target coordinator. Both arms are pinned independently — each
-- side is the other's deny principal, and both can read the referral, so neither
-- passes by simply failing to find the row.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table ref on commit drop as
  select (public.create_referral_draft('00000000-0000-0000-0000-0000000f0100', (select comm_y from k),
    (select id from public.referral_types where is_active order by position limit 1),
    'Encaminhamento', true, 'Descrição')).id as rid;
reset role;
grant select on ref to authenticated;

-- Link attributed to the SOURCE side (created by the source coordinator).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table lnk_s on commit drop as
  select (public.link_referral_related_case((select rid from ref),
    '00000000-0000-0000-0000-0000000f0100', 'related_case')).id as lid;
reset role;
grant select on lnk_s to authenticated;
-- Link attributed to the TARGET side (created by the target coordinator).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table lnk_t on commit drop as
  select (public.link_referral_related_case((select rid from ref),
    '00000000-0000-0000-0000-0000000f0100', 'follow_up_case')).id as lid;
reset role;
grant select on lnk_t to authenticated;

-- BOTH deny arms run first, while BOTH links still exist — otherwise the second
-- deny would pass for the wrong reason ("vínculo não encontrado", P0002) after the
-- positive twin already deleted the row.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.unlink_referral_case(%L) $$, (select lid from lnk_s)),
  '42501', null,
  'unlink_referral_case: the TARGET coordinator cannot remove a SOURCE-side link');
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.unlink_referral_case(%L) $$, (select lid from lnk_t)),
  '42501', null,
  'unlink_referral_case: the SOURCE coordinator cannot remove a TARGET-side link');
-- Positive twins: each side removes the link attributed to it.
select lives_ok(
  format($$ select public.unlink_referral_case(%L) $$, (select lid from lnk_s)),
  'unlink_referral_case: the SOURCE coordinator removes its own link (positive twin)');
reset role;
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.unlink_referral_case(%L) $$, (select lid from lnk_t)),
  'unlink_referral_case: the TARGET coordinator removes its own link (positive twin)');
reset role;

-- update_referral_requested_action edits a GLOBAL, cross-tenant vocabulary, so its
-- gate is app.is_admin() — a tenant coordinator editing it would change what every
-- org sees.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.update_referral_requested_action(%L, 'Sequestrada', null, null, null, null) $$,
    (select id from public.referral_requested_actions order by position limit 1)),
  'HC0A3', null,
  'update_referral_requested_action: a tenant staff_admin is refused HC0A3');
reset role;
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select lives_ok(
  format($$ select public.update_referral_requested_action(%L, 'Parecer técnico', null, null, null, null) $$,
    (select id from public.referral_requested_actions order by position limit 1)),
  'update_referral_requested_action: the platform admin edits the vocabulary (positive twin)');
reset role;

select * from finish();
rollback;
