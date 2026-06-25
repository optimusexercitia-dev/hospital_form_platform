-- Phase 14b: Patient-Safety / NSP — Triage & Disposition. ADR 0030/0032.
-- Covers (per the track-doc acceptance list):
--   * fixed reach (5) / harm (6) CHECK enums reject invalid values;
--   * save_triage cross-field rules fire (non-harmful reach -> harm 'none' + clears
--     natural_course; sentinel reach -> harm FLOORED to 'severe', keeping permanent/death);
--   * sentinel_determination auto-compute via BOTH paths (general-criteria: reached +
--     severe + natural_course=false; designated-category: any flagged criterion);
--   * confirm_triage: sentinel forces RCA (HC046 if a non-rca pathway given) + mints the
--     45-day RCA shell; non-PSE records the closure reason + routes the event to 'closed';
--   * freeze: a confirmed worksheet rejects edits (HC045); reopen unfreezes + audits;
--   * is_pqs_member write enforcement (a staff_admin of the reporting committee who is
--     NOT PQS gets 42501 on save_triage);
--   * config vocab: any-authenticated READ; is_pqs_member-gated CRUD; the configurable
--     checklist scopes the designated path; the flag SNAPSHOT survives a vocab edit;
--   * PHI-free triage-audit rows (no disposition_notes_md in the diff);
--   * set_pqs_rca_due_window: is_pqs_member-gated + range-validated (HC046).

begin;
select plan(44);

update app.feature_flags set enabled = true where key = 'patient_safety';
update app.feature_flags set enabled = true where key = 'audit_trail';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- NSP-per-org (ADR 0042): pqs_members now has composite PK (organization_id, user_id).
-- Enroll admin into the bootstrap org's PQS roster + seed a pqs_department row for
-- set_pqs_rca_due_window(org, days) assertions below.
insert into public.pqs_members (organization_id, user_id, added_by)
  select (v->>'org_b')::uuid, (v->>'admin')::uuid, (v->>'admin')::uuid from ctx;
insert into public.pqs_department (organization_id, name, rca_default_due_days)
  select (v->>'org_b')::uuid, 'NSP Bootstrap', 45 from ctx
  on conflict (organization_id) do nothing;

-- ===========================================================================
-- Config vocab: defaults seeded; any-authenticated READ; is_pqs_member CRUD.
-- ===========================================================================
select ok(
  (select count(*) from public.pqs_sentinel_criteria where is_active) >= 10,
  'the JC designated-category checklist is seeded (>= 10 criteria)');
select ok(
  (select count(*) from public.pqs_event_types where is_active) >= 5,
  'the NSP/WHO event-type vocabulary is seeded');

-- A plain staff member (st_x) can READ the config vocab (any-authenticated).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select ok(
  (select count(*) from public.pqs_sentinel_criteria) > 0,
  'any authenticated user reads the sentinel checklist');
-- ...but CANNOT create a criterion (not PQS).
select throws_ok(
  $$ select public.create_sentinel_criterion('test_crit', 'Critério de teste', null) $$,
  '42501', null, 'a non-PQS user cannot create a sentinel criterion (42501)');
reset role;

-- Admin (PQS today) creates a CUSTOM designated criterion (for the config-path test).
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
create temp table crit on commit drop as
  select id from public.create_sentinel_criterion('custom_designated', 'Categoria designada personalizada', null);
reset role;
grant select on crit to authenticated;
select isnt((select id from crit), null, 'PQS creates a custom designated criterion');

-- ===========================================================================
-- Set up three acknowledged events to triage (admin/NSP is the custodian).
-- ===========================================================================
-- Multi-tenancy Phase B: notify_safety_event dropped its admin term (NSP module
-- is org-orthogonal). A reporting-commission member registers the events;
-- downstream NSP triage continues as the PQS-enrolled admin.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table ev on commit drop as
  select
    (public.notify_safety_event((select comm_x from k), 'Evento sentinela', null, 'severe', null, null, null, current_date)).id as sentinel_ev,
    (public.notify_safety_event((select comm_x from k), 'Quase-erro', null, 'none', null, null, null, current_date)).id as near_ev,
    (public.notify_safety_event((select comm_x from k), 'Reclamação', null, 'none', null, null, null, current_date)).id as nonpse_ev;
reset role;
grant select on ev to authenticated;

-- Acknowledge all three (NSP).
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.acknowledge_event((select sentinel_ev from ev));
select public.acknowledge_event((select near_ev from ev));
select public.acknowledge_event((select nonpse_ev from ev));
reset role;

-- ===========================================================================
-- Fixed reach / harm CHECK enums reject invalid values (defensive HC046 in the RPC).
-- ===========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select throws_ok(
  $$ select public.save_triage((select near_ev from ev), true, null, 'bogus_reach', null, null, null, null, '{}') $$,
  'HC046', null, 'an invalid reach value is rejected (HC046)');
select throws_ok(
  $$ select public.save_triage((select near_ev from ev), true, null, 'adverse', 'bogus_harm', null, null, null, '{}') $$,
  'HC046', null, 'an invalid harm value is rejected (HC046)');
reset role;

-- ===========================================================================
-- is_pqs_member write enforcement: a staff_admin of the REPORTING committee who is
-- NOT PQS cannot save_triage (triage is an NSP activity → 42501).
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.save_triage((select near_ev from ev), true, null, 'near_miss', null, null, null, null, '{}') $$,
  '42501', null, 'a non-PQS reporting-committee staff_admin cannot triage (42501)');
reset role;

-- ===========================================================================
-- Cross-field rule #1: non-harmful reach (near_miss) -> harm 'none', natural_course null.
-- ===========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.save_triage((select near_ev from ev), true, null, 'near_miss', 'severe', true, null, null, '{}');
reset role;
select is((select harm_severity from public.event_triage where event_id = (select near_ev from ev)),
  'none', 'non-harmful reach forces harm_severity = none');
select is((select natural_course from public.event_triage where event_id = (select near_ev from ev)),
  null, 'non-harmful reach clears natural_course');
select is((select sentinel_determination from public.event_triage where event_id = (select near_ev from ev)),
  false, 'a near-miss is not sentinel');

-- ===========================================================================
-- Cross-field rule #2: sentinel reach FLOORS harm to 'severe' when below the tier,
-- but KEEPS a higher set value (permanent/death).
-- ===========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
-- below the tier (moderate) -> floored to severe
select public.save_triage((select sentinel_ev from ev), true, null, 'sentinel', 'moderate', false, null, null, '{}');
reset role;
select is((select harm_severity from public.event_triage where event_id = (select sentinel_ev from ev)),
  'severe', 'sentinel reach floors harm to severe when below the tier');

select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
-- already higher (death) -> kept
select public.save_triage((select sentinel_ev from ev), true, null, 'sentinel', 'death', false, null, null, '{}');
reset role;
select is((select harm_severity from public.event_triage where event_id = (select sentinel_ev from ev)),
  'death', 'sentinel reach KEEPS a higher harm value (death)');

-- ===========================================================================
-- Sentinel determination — GENERAL-CRITERIA path: reached + severe + natural_course=false.
-- ===========================================================================
select is((select sentinel_determination from public.event_triage where event_id = (select sentinel_ev from ev)),
  true, 'sentinel via the general-criteria path (reached + severe + unrelated)');

-- compute helper, both paths, asserted directly.
select is(app.compute_sentinel_determination('adverse', 'death', false, false), true,
  'compute: general-criteria path true');
select is(app.compute_sentinel_determination('adverse', 'death', true, false), false,
  'compute: natural course = true defeats the general-criteria path');
select is(app.compute_sentinel_determination('no_harm', 'none', null, true), true,
  'compute: designated-category path true regardless of harm');

-- ===========================================================================
-- Sentinel determination — DESIGNATED-CATEGORY path: a flagged criterion auto-qualifies
-- even with a below-tier harm. Use an ADVERSE/mild worksheet + a custom designated flag.
-- ===========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.save_triage((select near_ev from ev), true, null, 'adverse', 'mild', false, null, null,
  array[(select id from crit)]::uuid[]);
reset role;
select is((select sentinel_determination from public.event_triage where event_id = (select near_ev from ev)),
  true, 'sentinel via the CONFIGURABLE designated-category path (a custom criterion)');
select is(
  (select count(*)::int from public.event_triage_sentinel_flags where event_id = (select near_ev from ev)),
  1, 'the flagged designated criterion is recorded');

-- The flag SNAPSHOTS the label — survives a later vocab rename (viewable-forever).
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.update_sentinel_criterion((select id from crit), 'Rótulo renomeado', null);
reset role;
select is(
  (select criteria_label from public.event_triage_sentinel_flags where event_id = (select near_ev from ev)),
  'Categoria designada personalizada',
  'the flag snapshot keeps the ORIGINAL label after a vocab rename (viewable-forever)');

-- ===========================================================================
-- HC046: confirm_triage on a sentinel event with a non-rca pathway is rejected.
-- ===========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
-- set a deliberately-wrong pathway on the sentinel worksheet
select public.save_triage((select sentinel_ev from ev), true, null, 'sentinel', 'death', false, 'peer_review', null, '{}');
select throws_ok(
  $$ select public.confirm_triage((select sentinel_ev from ev)) $$,
  'HC046', null, 'a sentinel event with a non-rca pathway is rejected at confirm (HC046)');
reset role;

-- ===========================================================================
-- confirm_triage (sentinel): forces rca, freezes the worksheet, mints the RCA shell
-- with a 45-day due date.
-- ===========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
-- clear the bad pathway, then confirm
select public.save_triage((select sentinel_ev from ev), true, null, 'sentinel', 'death', false, null, null, '{}');
select public.confirm_triage((select sentinel_ev from ev));
reset role;

select is((select status from public.patient_safety_event where id = (select sentinel_ev from ev)),
  'triaged', 'confirm flips the event acknowledged -> triaged');
select is((select review_pathway from public.event_triage where event_id = (select sentinel_ev from ev)),
  'rca', 'confirm forces review_pathway = rca on a sentinel event');
select is(
  (select count(*)::int from public.rca where event_id = (select sentinel_ev from ev)),
  1, 'confirm mints exactly one RCA shell for the sentinel event');
select is(
  (select due_date from public.rca where event_id = (select sentinel_ev from ev)),
  current_date + 45,
  'the RCA shell due date = event date + 45 (configurable window)');

-- ===========================================================================
-- triage_disposition (the derived-verdict READ): must return a row WITHOUT raising
-- 42702 (the RETURNS TABLE output column `event_id` previously collided with the
-- event_triage column in the body — BUG-14B-001). Assert the RPC's OWN return values
-- for the confirmed sentinel event, which the E2E T1 path cannot reach.
-- ===========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
create temp table disp on commit drop as
  select * from public.triage_disposition((select sentinel_ev from ev));
reset role;
grant select on disp to authenticated;
select is(
  (select count(*)::int from disp),
  1, 'triage_disposition returns exactly one row WITHOUT raising 42702 (BUG-14B-001)');
select is((select is_sentinel from disp), true,
  'triage_disposition reports is_sentinel = true for the sentinel event');
select is((select verdict from disp), 'rca',
  'triage_disposition derives verdict = rca for the sentinel event');
select is((select review_pathway from disp), 'rca',
  'triage_disposition derives review_pathway = rca for the sentinel event');
select is((select rca_due_date from disp), current_date + 45,
  'triage_disposition previews the RCA due date = event date + 45');

-- ===========================================================================
-- Freeze: a confirmed worksheet rejects edits (HC045) — both via save_triage and a
-- direct UPDATE (the guard fires regardless of role; run as table owner).
-- ===========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select throws_ok(
  $$ select public.save_triage((select sentinel_ev from ev), true, null, 'adverse', 'mild', false, null, null, '{}') $$,
  'HC045', null, 'a confirmed worksheet rejects save_triage (HC045 — event not acknowledged)');
reset role;
select throws_ok(
  $$ update public.event_triage set disposition_notes_md = 'hack' where event_id = (select sentinel_ev from ev) $$,
  'HC045', null, 'a direct UPDATE of a frozen worksheet is rejected by the guard (HC045)');

-- ===========================================================================
-- reopen_triage: triaged -> acknowledged; unfreezes; emits an audit row.
-- ===========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.reopen_triage((select sentinel_ev from ev));
reset role;
select is((select status from public.patient_safety_event where id = (select sentinel_ev from ev)),
  'acknowledged', 'reopen flips triaged -> acknowledged');
select is((select triaged_at from public.event_triage where event_id = (select sentinel_ev from ev)),
  null, 'reopen clears triaged_at (unfreezes)');
select is(
  (select count(*)::int from public.audit_log
   where entity_id = (select sentinel_ev from ev) and action = 'triage.reopened'),
  1, 'reopen emits a triage.reopened audit row');

-- ===========================================================================
-- Non-PSE path: confirm records the closure reason + routes the event to 'closed'.
-- ===========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.save_triage((select nonpse_ev from ev), false, 'nonclinical', null, null, null, null, null, '{}');
select public.confirm_triage((select nonpse_ev from ev));
reset role;
select is((select status from public.patient_safety_event where id = (select nonpse_ev from ev)),
  'closed', 'a non-PSE confirm routes the event to closed');
select is((select pse_closure_reason from public.event_triage where event_id = (select nonpse_ev from ev)),
  'nonclinical', 'the closure reason is recorded on the worksheet');
select is(
  (select count(*)::int from public.rca where event_id = (select nonpse_ev from ev)),
  0, 'a non-PSE event mints no RCA shell');

-- ===========================================================================
-- PHI-free audit: the triage diff carries NO disposition_notes_md (free text).
-- ===========================================================================
select ok(
  not exists (
    select 1 from public.audit_log
    where action in ('triage.saved', 'triage.confirmed', 'triage.reopened')
      and metadata ? 'disposition_notes_md'),
  'no triage audit row copies disposition_notes_md (PHI/free-text-free, Rule 11)');
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'triage.confirmed' and entity_id = (select nonpse_ev from ev)),
  'confirm emits a triage.confirmed audit row');

-- ===========================================================================
-- set_pqs_rca_due_window(org, days): NSP-per-org (ADR 0042); coordinator OR enrolled
-- member gate; range-validated (HC046). Signature changed to (p_org_id, p_days).
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_pqs_rca_due_window(%L::uuid, 30) $$, (select (v->>'org_b')::uuid from ctx)),
  '42501', null, 'a non-PQS, non-coordinator user cannot set the RCA due-window (42501)');
reset role;

select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select throws_ok(
  format($$ select public.set_pqs_rca_due_window(%L::uuid, 0) $$, (select (v->>'org_b')::uuid from ctx)),
  'HC046', null, 'an out-of-range RCA due-window is rejected (HC046)');
select throws_ok(
  format($$ select public.set_pqs_rca_due_window(%L::uuid, 400) $$, (select (v->>'org_b')::uuid from ctx)),
  'HC046', null, 'an over-range RCA due-window is rejected (HC046)');
select public.set_pqs_rca_due_window((select (v->>'org_b')::uuid from ctx), 60);
reset role;
select is(
  (select rca_default_due_days from public.pqs_department
   where organization_id = (select (v->>'org_b')::uuid from ctx)),
  60, 'PQS sets the RCA due-window to 60 days (per-org)');

select * from finish();
rollback;
