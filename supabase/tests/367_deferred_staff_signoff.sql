-- ADR 0136 — deferred `staff_admin` sign-off: attest a FROZEN response, block the
-- PHASE not the SUBMIT.
--
-- Plan: docs/plans/deferred-staff-admin-signoff.md. Migration: 20261003001900.
--
-- ⚠ WHY `80_signoffs.sql` IS UNTOUCHED, AND WHY THAT CONTRADICTS THE ADR.
-- ADR 0136 § Size warns "the test surface dominates, not the doors —
-- 80_signoffs.sql's central assertions INVERT for the staff_admin arm". Measured:
-- 80_signoffs.sql contains ZERO references to case phases. It is entirely the
-- STANDALONE lane, which D2 deliberately leaves at today's behaviour, so not one
-- of its assertions inverts. The delivery is this NEW suite, and §1.4 below is the
-- assertion that keeps the ADR's claim honest by pinning the standalone refusal.
--
-- ⚠ `deferred_staff_signoff` arrives ON — flipped by its gate migration
-- `20261003002100` (2026-08-24), with seed.sql belt-and-suspendering it. §1
-- therefore turns it OFF ITSELF and restores it. ⛔ That section is now the ONLY
-- coverage of the flag-OFF path anywhere: it stopped being "what ships to
-- production" the day of the flip, and became the rollback contract instead —
-- which is exactly when a suite quietly loses the arm it is not looking at.

begin;
select plan(79);

-- ---------------------------------------------------------------------------
-- Flags. ⚠ A missing flag-enable does not fail — it SILENTLY SKIPS the keystone
-- behind it, so each one is asserted, not assumed.
-- ---------------------------------------------------------------------------
update app.feature_flags set enabled = true
where key in ('cases_multi_phase', 'cases_extras', 'signoff_enforcement',
              'deferred_staff_signoff', 'case_corrections', 'case_phase_results');

select is(app.feature_enabled('signoff_enforcement'), true,
  '0.1 PRECONDITION: signoff_enforcement is ON — every HC012 assertion below is vacuous without it');
select is(app.feature_enabled('deferred_staff_signoff'), true,
  '0.2 PRECONDITION: deferred_staff_signoff is ON — every deferral assertion below is vacuous without it');
select is(app.feature_enabled('cases_multi_phase'), true,
  '0.3 PRECONDITION: cases_multi_phase is ON — activate_phase/close_case/cancel_case all assert_cases_enabled first');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
select (v->>'comm_x')::uuid as comm_x, (v->>'org_b')::uuid as org_b,
       (v->>'form_s')::uuid as form_s, (v->>'ver_s')::uuid as ver_s,
       (v->>'sa_x')::uuid as sa_x, (v->>'st_x')::uuid as st_x, (v->>'st_x2')::uuid as st_x2,
       -- §13's OUTSIDER: staff_admin of commission Y, same org and hospital as X.
       (v->>'sa_y')::uuid as sa_y,
       (v->>'sec_signoff_r')::uuid as sec_r, (v->>'sec_signoff_a')::uuid as sec_a,
       (v->>'sec_s1')::uuid as sec_s1,
       (v->>'it_gate')::uuid as it_gate, (v->>'it_req')::uuid as it_req
from ctx;
grant select on k to authenticated;

-- ---------------------------------------------------------------------------
-- Fixture builder: one case, one ACTIVE phase 1 on form S assigned to st_x, one
-- PENDING phase 2 blocked by phase 1, and a submit-ready in_progress response on
-- phase 1 with the RESPONDENT section already signed. Returns the response id.
--
-- `s_gate = 'nao'` hides the conditional section (so its required item is not
-- owed); `s_req = 'sim'` satisfies the respondent section's required item. The
-- staff_admin section (position 4) is unconditionally visible and UNSIGNED —
-- that is the whole subject of this suite.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.mk(p_case_no int, p_resp uuid, p_phase1 uuid, p_phase2 uuid,
                                      p_case uuid, p_sign_respondent boolean default true)
returns void language plpgsql as $mk$
declare kk record;
begin
  select * into kk from k;

  insert into public.cases (id, commission_id, organization_id, case_number, label, created_by)
  values (p_case, kk.comm_x, kk.org_b, p_case_no, 'Caso 0136/' || p_case_no, kk.sa_x);

  insert into public.case_phases (id, case_id, position, title, form_id, form_version_id,
                                  status, assigned_to, activated_at)
  values (p_phase1, p_case, 1, 'Fase 1', kk.form_s, kk.ver_s, 'active', kk.st_x, now());

  if p_phase2 is not null then
    insert into public.case_phases (id, case_id, position, title, form_id, form_version_id,
                                    status, blocks)
    values (p_phase2, p_case, 2, 'Fase 2', kk.form_s, kk.ver_s, 'pending', array[1]);
  end if;

  insert into public.responses (id, form_version_id, commission_id, created_by, status,
                                started_at, case_phase_id)
  values (p_resp, kk.ver_s, kk.comm_x, kk.st_x, 'in_progress', now(), p_phase1);

  perform test_helpers.add_selection(p_resp, kk.it_gate, array['nao']);
  perform test_helpers.add_selection(p_resp, kk.it_req, array['sim']);

  if p_sign_respondent then
    insert into public.response_section_signoffs (response_id, section_id, signed_by)
    values (p_resp, kk.sec_r, kk.st_x);
  end if;
end;
$mk$;

-- =============================================================================
-- §1 — FLAG OFF: today's behaviour is byte-for-byte intact.
--     ⛔ This is what ships to production. It is asserted FIRST because a suite
--     that only exercises the new arm proves the feature and not the flag.
-- =============================================================================
select pg_temp.mk(910001, '00000000-0000-0000-0000-000000001301'::uuid,
                  '00000000-0000-0000-0000-000000001311'::uuid, null,
                  '00000000-0000-0000-0000-000000001321'::uuid);

update app.feature_flags set enabled = false where key = 'deferred_staff_signoff';

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.submit_response('00000000-0000-0000-0000-000000001301'::uuid) $$,
  'HC012', null,
  '1.1 ⭐ FLAG OFF: an unsigned staff_admin section still BLOCKS the submit of a case-phase response');
reset role;

update app.feature_flags set enabled = true where key = 'deferred_staff_signoff';

-- Sign it, then submit under the flag-OFF path: the phase must go straight to
-- `completed`, never through `awaiting_signoff`.
insert into public.response_section_signoffs (response_id, section_id, signed_by)
select '00000000-0000-0000-0000-000000001301'::uuid, sec_a, sa_x from k;

update app.feature_flags set enabled = false where key = 'deferred_staff_signoff';
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.submit_response('00000000-0000-0000-0000-000000001301'::uuid) $$,
  '1.2 FLAG OFF: submit succeeds once every section is signed');
reset role;
update app.feature_flags set enabled = true where key = 'deferred_staff_signoff';

select is(
  (select status from public.case_phases where id = '00000000-0000-0000-0000-000000001311'::uuid),
  'completed',
  '1.3 ⭐ FLAG OFF: the phase goes STRAIGHT to completed — awaiting_signoff is unreachable with the flag off');

-- §1.4 — D2: a STANDALONE response (no case_phase_id) keeps HC012 even with the
-- flag ON. Deferring where there is no phase would downgrade the attestation to
-- advisory, which is precisely what the PO ruled against.
insert into public.responses (id, form_version_id, commission_id, created_by, status, started_at)
select '00000000-0000-0000-0000-000000001302'::uuid, ver_s, comm_x, st_x2, 'in_progress', now() from k;
select test_helpers.add_selection('00000000-0000-0000-0000-000000001302'::uuid,
                                  (select it_gate from k), array['nao']);
select test_helpers.add_selection('00000000-0000-0000-0000-000000001302'::uuid,
                                  (select it_req from k), array['sim']);
insert into public.response_section_signoffs (response_id, section_id, signed_by)
select '00000000-0000-0000-0000-000000001302'::uuid, sec_r, st_x2 from k;

select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.submit_response('00000000-0000-0000-0000-000000001302'::uuid) $$,
  'HC012', null,
  '1.4 ⭐ D2: a STANDALONE response still raises HC012 with the flag ON — the deferral is case-phase-scoped');
reset role;

-- =============================================================================
-- §2 — D1/D3: the deferral itself.
-- =============================================================================
select pg_temp.mk(910002, '00000000-0000-0000-0000-000000001303'::uuid,
                  '00000000-0000-0000-0000-000000001312'::uuid,
                  '00000000-0000-0000-0000-000000001313'::uuid,
                  '00000000-0000-0000-0000-000000001322'::uuid);

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.submit_response('00000000-0000-0000-0000-000000001303'::uuid) $$,
  '2.1 ⭐ D1: the submit SUCCEEDS with the staff_admin section unsigned');
reset role;

select is(
  (select status from public.responses where id = '00000000-0000-0000-0000-000000001303'::uuid),
  'submitted',
  '2.2 ⭐ D4: responses.status is the unchanged two-value set — a submitted-but-unattested response COUNTS');

select is(
  (select status from public.case_phases where id = '00000000-0000-0000-0000-000000001312'::uuid),
  'awaiting_signoff',
  '2.3 ⭐ D3: the PHASE carries the attestation state, not the response');

select is(
  (select current_response_id from public.case_phases where id = '00000000-0000-0000-0000-000000001312'::uuid),
  '00000000-0000-0000-0000-000000001303'::uuid,
  '2.4 the phase points at the frozen response — the signature is owed on THIS one');

select is(
  (select result_computed_at is null from public.case_phases where id = '00000000-0000-0000-0000-000000001312'::uuid),
  true,
  '2.5 ⭐ D5: the phase RESULT is NOT computed at submit — it moves onto the signature');

-- D1's surviving arm: an unsigned RESPONDENT section still blocks.
select pg_temp.mk(910003, '00000000-0000-0000-0000-000000001304'::uuid,
                  '00000000-0000-0000-0000-000000001314'::uuid, null,
                  '00000000-0000-0000-0000-000000001323'::uuid,
                  p_sign_respondent => false);

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.submit_response('00000000-0000-0000-0000-000000001304'::uuid) $$,
  'HC012', null,
  '2.6 ⭐ D1: the RESPONDENT arm of HC012 SURVIVES — the filler is present, so there is no coordination cost');
reset role;

-- =============================================================================
-- §3 — D3's mechanism: `awaiting_signoff` is NOT settled, and the guarantee does
--      not stop at the case boundary.
-- =============================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.activate_phase(%L, %L) $$,
    '00000000-0000-0000-0000-000000001313'::uuid, (select st_x from k)),
  'HC018', null,
  '3.1 ⭐ D3: a downstream phase blocked by an awaiting phase CANNOT be activated — zero new gating logic');

reset role;

-- ⚠ 3.2 NEEDS ITS OWN CASE. Run against case 910002 it is VACUOUS: that case
-- also carries a `pending` phase 2, and HC031 counts THAT — so the throw happens
-- with or without the widening, and a red-proof neutralization of close_case
-- leaves the suite GREEN (measured: it did). A single-phase parked case is the
-- only fixture that can reach the failing state.
select pg_temp.mk(910009, '00000000-0000-0000-0000-00000000132a'::uuid,
                  '00000000-0000-0000-0000-00000000131a'::uuid, null,
                  '00000000-0000-0000-0000-00000000132b'::uuid);
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.submit_response('00000000-0000-0000-0000-00000000132a'::uuid);
reset role;

select is(
  (select count(*)::int from public.case_phases
   where case_id = '00000000-0000-0000-0000-00000000132b'::uuid
     and status <> 'awaiting_signoff'),
  0,
  '3.2a PRECONDITION ⭐: the parked phase is this case''s ONLY phase — without this, 3.2b throws for the pending sibling and proves nothing');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.close_case('00000000-0000-0000-0000-00000000132b'::uuid) $$,
  'HC031', null,
  '3.2b ⭐ close_case refuses to conclude over an unattested phase (the one hole that would be SILENT)');
reset role;

select is(
  (select status from public.cases where id = '00000000-0000-0000-0000-000000001322'::uuid),
  'in_review',
  '3.3 ⭐ recompute_case_status counts awaiting_signoff as LIVE work — the case stays visible to its coordinator');

select is(
  (select prosrc like '%awaiting_signoff%' from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'activate_phase'),
  false,
  '3.4 ⭐ KEYSTONE: awaiting_signoff is ABSENT from activate_phase — adding it there would UNBLOCK every downstream phase');

-- =============================================================================
-- §4 — D5: the LAST signature completes the phase.
-- =============================================================================
select is(
  (select count(*)::int from app.pending_staff_signoffs('00000000-0000-0000-0000-000000001303'::uuid)),
  1,
  '4.1 exactly one visible staff_admin section is still owed');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.sign_section(%L, %L, %L) $$,
    '00000000-0000-0000-0000-000000001303'::uuid, (select sec_a from k), 'conferido'),
  '4.2 ⭐ a staff_admin CAN sign a FROZEN response while its phase awaits attestation');
reset role;

select is(
  (select status from public.case_phases where id = '00000000-0000-0000-0000-000000001312'::uuid),
  'completed',
  '4.3 ⭐ D5: the last signature COMPLETES the phase');

select is(
  (select completed_at is not null from public.case_phases where id = '00000000-0000-0000-0000-000000001312'::uuid),
  true,
  '4.4 the completion timestamp is stamped by the signature, not by the submit');

select is(
  (select count(*)::int from public.response_section_signoffs
   where response_id = '00000000-0000-0000-0000-000000001303'::uuid),
  2,
  '4.5 both signatures are recorded on the frozen response (respondent pre-submit + staff_admin post-submit)');

-- ⚠ Phase 2 of this case is still `pending`, and HC031 counts that too — so the
-- release below is attributable to the attestation ONLY once the pending sibling
-- is settled. Skipping it is setup, not an assertion.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.skip_phase('00000000-0000-0000-0000-000000001313'::uuid);
select lives_ok(
  $$ select public.close_case('00000000-0000-0000-0000-000000001322'::uuid) $$,
  '4.6 the case can now be concluded — the HC031 gate releases with the attestation (and nothing else was unsettled)');
reset role;

-- =============================================================================
-- §5 — the widening is BOUNDED. An unbounded one lets a staff_admin sign a
--      completed phase forever.
-- =============================================================================
select is(
  app.is_signoff_deferral_open('00000000-0000-0000-0000-000000001303'::uuid),
  false,
  '5.1 ⭐ the window CLOSES the moment the phase completes');

select is(
  app.can_sign_section('00000000-0000-0000-0000-000000001303'::uuid,
                       (select sec_a from k), (select sa_x from k)),
  false,
  '5.2 ⭐ can_sign_section (the signoffs_insert WITH CHECK) refuses a COMPLETED phase');

-- (the SUPERSEDED-response half of the bound is proven end-to-end in §8.)

-- =============================================================================
-- §6 — the immutability carve-out is INSERT-only, signoff-only, and the SHARED
--      guard is provably untouched.
-- =============================================================================
select pg_temp.mk(910005, '00000000-0000-0000-0000-000000001307'::uuid,
                  '00000000-0000-0000-0000-000000001316'::uuid, null,
                  '00000000-0000-0000-0000-000000001325'::uuid);
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.submit_response('00000000-0000-0000-0000-000000001307'::uuid);
reset role;

select throws_ok(
  $$ update public.response_section_signoffs set note = 'alterado'
     where response_id = '00000000-0000-0000-0000-000000001307'::uuid $$,
  '23514', null,
  '6.1 ⭐ UPDATE of a recorded signature on a submitted response is still BLOCKED — the attestation is as immutable as what it attests to');

select throws_ok(
  $$ delete from public.response_section_signoffs
     where response_id = '00000000-0000-0000-0000-000000001307'::uuid $$,
  '23514', null,
  '6.2 ⭐ DELETE is still BLOCKED');

select throws_ok(
  format($$ insert into public.answers (response_id, item_id) values (%L, %L) $$,
    '00000000-0000-0000-0000-000000001307'::uuid, (select it_gate from k)),
  '23514', null,
  '6.3 ⭐ ANSWERS on a submitted response are still blocked — guard_submitted_children is untouched');

select is(
  (select tgfoid::regproc::text from pg_trigger
   where tgname = 'guard_submitted_signoffs_trg'
     and tgrelid = 'public.response_section_signoffs'::regclass),
  'guard_submitted_signoffs',
  '6.4 the signoff trigger runs a SEPARATE function — not a branch of the shared guard');

select is(
  (select prosrc ~ 'signoff|awaiting' from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'guard_submitted_children'),
  false,
  '6.5 ⭐ KEYSTONE: the carve-out did NOT leak into guard_submitted_children, which also backs answers AND response_group_instances');

-- =============================================================================
-- §7 — BUG-SIGNOFF-GROUPCOND-001. A `requires_signoff` section may carry the
--      GROUP condition shape; five doors evaluated it with `app.eval_condition`,
--      which RAISES on that shape. Unifying on `app.eval_visibility` is the fix.
-- =============================================================================
select is(
  app.is_valid_visibility('{"match":"all","conditions":[{"question_key":"g_gate","op":"equals","value":"nao"}]}'::jsonb),
  true,
  '7.1 PRECONDITION: the GROUP shape is AUTHORABLE on a section (is_valid_visibility accepts it, and the section CHECK calls exactly this)');

select throws_ok(
  $$ select app.eval_condition('{"match":"all","conditions":[{"question_key":"g_gate","op":"equals","value":"nao"}]}'::jsonb, '{"g_gate":"nao"}'::jsonb) $$,
  null, null,
  '7.2 ⭐ POSITIVE CONTROL: app.eval_condition STILL RAISES on the group shape — so §7.4''s survival is attributable to the swap, not to the shape being unreachable');

select is(
  app.eval_visibility('{"match":"all","conditions":[{"question_key":"g_gate","op":"equals","value":"nao"}]}'::jsonb,
                      '{"g_gate":"nao"}'::jsonb),
  true,
  '7.3 app.eval_visibility handles the group shape');

-- A form whose staff_admin sign-off section carries the GROUP shape, built by hand
-- on a DRAFT version. ⚠ It has to be built rather than patched onto `ver_s`:
-- Rule 5 makes a PUBLISHED version's structure immutable. That is also precisely
-- why this defect reaches production untouched — the shape is authored at BUILD
-- time, on a draft, by the ordinary section-settings condition builder, and
-- nothing downstream of publish can take it back out.
insert into public.forms (id, commission_id, title, created_by)
select '00000000-0000-0000-0000-0000000013a0'::uuid, comm_x, 'Form G (grouped)', sa_x from k;
insert into public.form_versions (id, form_id, version_number, status)
values ('00000000-0000-0000-0000-0000000013a1'::uuid, '00000000-0000-0000-0000-0000000013a0'::uuid, 1, 'draft');
insert into public.form_sections (id, form_version_id, position, is_default)
values ('00000000-0000-0000-0000-0000000013a2'::uuid, '00000000-0000-0000-0000-0000000013a1'::uuid, 0, true);
insert into public.form_sections (id, form_version_id, position, title)
values ('00000000-0000-0000-0000-0000000013a3'::uuid, '00000000-0000-0000-0000-0000000013a1'::uuid, 1, 'Gate G');
insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
values ('00000000-0000-0000-0000-0000000013a4'::uuid, '00000000-0000-0000-0000-0000000013a3'::uuid, 0,
        'multiple_choice', 'g_gate', 'Gate G?', true);
insert into public.form_item_options (item_id, position, code, label) values
  ('00000000-0000-0000-0000-0000000013a4'::uuid, 0, 'sim', 'Sim'),
  ('00000000-0000-0000-0000-0000000013a4'::uuid, 1, 'nao', 'Não');
insert into public.form_sections (id, form_version_id, position, title, requires_signoff, signoff_role, visible_when)
values ('00000000-0000-0000-0000-0000000013a5'::uuid, '00000000-0000-0000-0000-0000000013a1'::uuid, 2,
        'Assinatura (condição agrupada)', true, 'staff_admin',
        '{"match":"all","conditions":[{"question_key":"g_gate","op":"equals","value":"nao"}]}'::jsonb);

insert into public.cases (id, commission_id, organization_id, case_number, label, created_by)
select '00000000-0000-0000-0000-000000001326'::uuid, comm_x, org_b, 910006, 'Caso 0136/G', sa_x from k;
insert into public.case_phases (id, case_id, position, title, form_id, form_version_id, status, assigned_to, activated_at)
values ('00000000-0000-0000-0000-000000001317'::uuid, '00000000-0000-0000-0000-000000001326'::uuid, 1, 'Fase G',
        '00000000-0000-0000-0000-0000000013a0'::uuid, '00000000-0000-0000-0000-0000000013a1'::uuid,
        'active', (select st_x from k), now());
insert into public.responses (id, form_version_id, commission_id, created_by, status, started_at, case_phase_id)
select '00000000-0000-0000-0000-000000001308'::uuid, '00000000-0000-0000-0000-0000000013a1'::uuid,
       comm_x, st_x, 'in_progress', now(), '00000000-0000-0000-0000-000000001317'::uuid from k;
select test_helpers.add_selection('00000000-0000-0000-0000-000000001308'::uuid,
                                  '00000000-0000-0000-0000-0000000013a4'::uuid, array['nao']);

select lives_ok(
  $$ select count(*) from app.pending_staff_signoffs('00000000-0000-0000-0000-000000001308'::uuid) $$,
  '7.4 ⭐ the ONE pending-set definition survives a group-shaped section condition');

select is(
  (select count(*)::int from app.pending_staff_signoffs('00000000-0000-0000-0000-000000001308'::uuid)),
  1,
  '7.5 …and evaluates it CORRECTLY (g_gate = nao ⇒ the section is visible ⇒ still owed)');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select count(*) from public.list_signoff_queue(%L) $$, (select comm_x from k)),
  '7.6 ⭐ list_signoff_queue no longer raises for the whole commission');
reset role;

select lives_ok(
  format($$ select public.save_section_answers(%L, %L, '{}'::jsonb, null, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb) $$,
    '00000000-0000-0000-0000-000000001308'::uuid, '00000000-0000-0000-0000-0000000013a3'::uuid),
  '7.7 ⭐ save_section_answers no longer raises — this defect made EVERY save on such a form fail, not just the sign-off surfaces');

-- ⚠ No restore is owed: `ver_s` was never touched. Patching the shared published
-- fixture would have leaked a grouped condition into every section below.

-- =============================================================================
-- §8 — D7 END TO END: the coordinator DECLINES to sign, routes through the
--      correction/supersession machinery, and the CORRECTED content is what gets
--      attested. ⚠ This whole path is unreachable without the M19 patch — the
--      target-status gate admitted `completed` only, so a declined phase would be
--      stuck forever behind M16's widened HC031. Not the "heavier for a typo in
--      field 3" cost D7 accepted: a deadlock.
-- =============================================================================
select pg_temp.mk(910004, '00000000-0000-0000-0000-000000001305'::uuid,
                  '00000000-0000-0000-0000-000000001315'::uuid, null,
                  '00000000-0000-0000-0000-000000001324'::uuid);
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.submit_response('00000000-0000-0000-0000-000000001305'::uuid);
reset role;

create temp table d7 on commit drop as select null::uuid as req, null::uuid as succ;
grant select, update on d7 to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ update d7 set req = public.file_correction_request('correction', %L, null, 'assinatura recusada', 'substantive') $$,
    '00000000-0000-0000-0000-000000001315'::uuid),
  '8.1 ⭐ D7: an AWAITING_SIGNOFF phase IS a correctable target — the declining coordinator''s only path');
reset role;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  $$ update d7 set succ = public.start_correction_draft((select req from d7)) $$,
  '8.2 the designated corrector opens a successor draft over the frozen response');

-- ⚠ The respondent signature is owed on the SUCCESSOR too — D1 keeps HC012 for
-- that arm, and `start_correction_draft` copies answers but never signatures.
select public.sign_section((select succ from d7), (select sec_r from k), null);
-- `resubmit_correction` calls submit_response itself; submitting here first would
-- make it raise HC010 on an already-sent response.
select public.resubmit_correction((select req from d7));
reset role;

select is(
  (select status from public.case_phases where id = '00000000-0000-0000-0000-000000001315'::uuid),
  'awaiting_signoff',
  '8.3 ⭐ the SUCCESSOR''s submit takes ZERO phase effect — the phase is still parked, not silently re-completed');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.approve_correction((select req from d7), null) $$,
  '8.4 the coordinator approves the correction');
reset role;

select is(
  (select current_response_id from public.case_phases where id = '00000000-0000-0000-0000-000000001315'::uuid),
  (select succ from d7),
  '8.5 the phase now points at the SUCCESSOR');

select is(
  app.is_signoff_deferral_open('00000000-0000-0000-0000-000000001305'::uuid),
  false,
  '8.6 ⭐ the SUPERSEDED response drops OUT of the signing window — signing it must neither be admitted nor complete the phase');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.sign_section((select succ from d7), %L, 'agora sim') $$, (select sec_a from k)),
  '8.7 ⭐ the coordinator attests the CORRECTED content');
reset role;

select is(
  (select status from public.case_phases where id = '00000000-0000-0000-0000-000000001315'::uuid),
  'completed',
  '8.8 ⭐ …and THAT signature completes the phase — the full D7 loop closes');

select throws_ok(
  $$ do $x$ begin
       perform set_config('app.in_case_rpc', 'on', true);
       update public.case_phases set status = 'active'
       where id = '00000000-0000-0000-0000-000000001316'::uuid;
     end $x$ $$,
  '23514', null,
  '8.9 ⭐ D7 rejected shape (b): there is NO awaiting_signoff → active transition — a submitted response never returns to in_progress');

select is(
  (select prosrc like '%''awaiting_signoff'' and new.status in (''active%' from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'guard_case_phase_status'),
  false,
  '8.10 …and the state machine says so structurally, not only by outcome');

select is(
  (select prosrc like '%DO NOT ADD%new.status must be ''pending''%' from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'guard_case_phase_status'),
  true,
  '8.11 the INSERT arm''s standing ⚠ comment (an assertion written and reverted once) survived the re-emission');

-- =============================================================================
-- §9 — cancel_case sweeps the parked phase. ⛔ close_case's HC031 gate means its
--      OWN sweep is unreachable for this status; cancel_case has NO gate, so this
--      is the sweep that actually runs — and the transition must be admitted.
-- =============================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.cancel_case('00000000-0000-0000-0000-000000001325'::uuid) $$,
  '9.1 ⭐ cancel_case succeeds over a parked phase (it would RAISE if the transition were unadmitted)');
reset role;

select is(
  (select status from public.case_phases where id = '00000000-0000-0000-0000-000000001316'::uuid),
  'not_required',
  '9.2 ⭐ the sweep reaches awaiting_signoff — adding the status to the gate but not the sweeps leaves the hole');

-- =============================================================================
-- §10 — the HC061 precondition stays on the SUBMIT (plan §1.5). Moved onto the
--       signature it would land on the coordinator, for something only the filler
--       can fix and can no longer fix — a deadlock, not a nuisance.
-- =============================================================================
select pg_temp.mk(910007, '00000000-0000-0000-0000-000000001309'::uuid,
                  '00000000-0000-0000-0000-000000001318'::uuid, null,
                  '00000000-0000-0000-0000-000000001327'::uuid);
set local app.in_case_rpc = 'on';
update public.case_phases set emits_result = true, result_ruleset = null, result_override_id = null
where id = '00000000-0000-0000-0000-000000001318'::uuid;
set local app.in_case_rpc = 'off';

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.submit_response('00000000-0000-0000-0000-000000001309'::uuid) $$,
  'HC061', null,
  '10.1 ⭐ a manual-result phase with no result raises HC061 on the SUBMIT — never later, on the coordinator''s signature');
reset role;

select is(
  (select status from public.case_phases where id = '00000000-0000-0000-0000-000000001318'::uuid),
  'active',
  '10.2 …and the phase never parked — the submit was refused whole');

select is(
  (select prosrc like '%assert_phase_result_ready%' from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'compute_case_phase_result'),
  true,
  '10.3 ⭐ ONE definition of "result ready" — compute_case_phase_result delegates to the same assertion the submit path calls');

-- =============================================================================
-- §11 — the widened READS. A coordinator who cannot find the frozen response
--       cannot attest to it, so these are part of the feature, not polish.
-- =============================================================================
select pg_temp.mk(910008, '00000000-0000-0000-0000-000000001310'::uuid,
                  '00000000-0000-0000-0000-000000001319'::uuid, null,
                  '00000000-0000-0000-0000-000000001328'::uuid);
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.submit_response('00000000-0000-0000-0000-000000001310'::uuid);
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.list_signoff_queue((select comm_x from k)) q
   where q.response_id = '00000000-0000-0000-0000-000000001310'::uuid),
  1,
  '11.1 ⭐ the FROZEN response appears in the sign-off queue — it is invisible there without the widening');

select is(
  (select q.case_phase_id from public.list_signoff_queue((select comm_x from k)) q
   where q.response_id = '00000000-0000-0000-0000-000000001310'::uuid),
  '00000000-0000-0000-0000-000000001319'::uuid,
  '11.2 …and the queue says WHICH lane it is — the reviewer must know they are signing a frozen record');

select lives_ok(
  $$ select public.get_response_for_signoff('00000000-0000-0000-0000-000000001310'::uuid) $$,
  '11.3 ⭐ the review-to-sign door serves the frozen response');

select is(
  (public.get_response_for_signoff('00000000-0000-0000-0000-000000001310'::uuid)) ->> 'status',
  'submitted',
  '11.4 …and reports it as SUBMITTED, so the screen can say so rather than implying a live draft');
reset role;

select is(
  (select (public.get_case_detail('00000000-0000-0000-0000-000000001328'::uuid) -> 'phases' -> 0 ->> 'response_id')),
  '00000000-0000-0000-0000-000000001310',
  '11.5 get_case_detail emits the response deep-link for a parked phase — the case surface is where a coordinator lands to review');

-- =============================================================================
-- §12 — the ONE-DEFINITION claim, structurally. The ADR predicted 2 copies + the
--       trigger; measured, there were SIX. Assert none of them came back.
-- =============================================================================
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('app', 'public')
     and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'eval_condition\s*\(\s*s2?\.visible_when'),
  0,
  '12.1 ⭐ KEYSTONE: NO routine evaluates a SECTION''s visible_when with eval_condition any more — that predicate is what BUG-SIGNOFF-GROUPCOND-001 was');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('app', 'public')
     and p.prosrc like '%pending_staff_signoffs%'),
  7,
  '12.2 the helper has exactly SEVEN callers — sign_section, list_signoff_queue, get_response_for_signoff, compute_due_notifications, save_section_answers, sync_case_phase_on_submit, trg_complete_phase_on_signoff. An 8th means a copy came back; a 6th means one was reverted');

-- =============================================================================
-- §13 — FUP-DSS-PENDING-SIGNOFFS-WALKTHROUGH-KEYSTONE: the per-principal WALK
--       THROUGH the door, which is a different question from §§1-12's behaviour.
--
-- `app.pending_staff_signoffs` is a `SECURITY DEFINER` set-returning function with
-- NO identity predicate at all. `ARM=census` flagged it never-swept the day it
-- landed; `p0-authz-rowdoor-audit.sh` answered **UNSUPPORTED** — "no
-- statement-level identity guard" — which is structurally exact, and it is filed
-- under the UNSUPPORTED block of authz-unswept-backlog.txt rather than under
-- `helper:`, because a `helper:` line claims "not an authorization decision" and
-- this one IS an input to one: `get_response_for_signoff` gate 3 uses its
-- EMPTINESS as the read right ("the read right is scoped to the act of signing").
--
-- ⛔ THE USUAL KEYSTONE SHAPE CANNOT PASS HERE, and saying so is the point. The
-- eleven siblings in that block owe "the outsider reads 0 rows through this door".
-- This door has no gate, so it returns the SAME rows to everyone by construction —
-- an outsider-reads-0 assertion would be FALSE, and writing one would have meant
-- bolting a gate onto a helper whose four callers each already gate. So the
-- boundary is walked where it actually lives: §13.1-13.3 PIN the caller-blindness
-- as designed (so a gate added later without updating the record reds here), and
-- §13.4-13.9 walk every principal through the two doors that consume it.
--
-- ⚠ EVERY ASSERTION IS A ROW COUNT / A REFUSAL THROUGH THE DOOR, never a predicate
-- call: a correct predicate is not a correct door.
-- ⚠ AND EVERY DENIAL HAS A NON-VACUITY TWIN. "sa_y reads 0" is also true of a door
-- returning 0 to EVERYONE, so sa_x's positive read sits beside each zero; and
-- §13.10-13.12 re-read the helper AFTER the section is signed, so §13.1-13.3's
-- "1" is proven to track the projection rather than being a constant.
--
-- THE OUTSIDER IS `sa_y` — staff_admin of commission Y under the SAME org and
-- hospital, deliberately not an org-B user: a fully foreign principal can be denied
-- by the tenant boundary before this door's own gate is reached, and the keystone
-- would then be exercising cross-org isolation while claiming to pin the
-- commission gate. THE RESPONDENT `st_x` is the second denial and the sharper one:
-- they own the response and still may not reach the signing door.
-- =============================================================================
update app.feature_flags set enabled = true where key = 'deferred_staff_signoff';

select pg_temp.mk(910013, '00000000-0000-0000-0000-0000000013a1'::uuid,
                  '00000000-0000-0000-0000-0000000013a2'::uuid, null,
                  '00000000-0000-0000-0000-0000000013a3'::uuid);

-- Freeze it: submit with the staff_admin section unsigned (the whole ADR).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.submit_response('00000000-0000-0000-0000-0000000013a1'::uuid);
select test_helpers.reset_role_and_claims();

select is(
  (select status from public.case_phases where id = '00000000-0000-0000-0000-0000000013a2'::uuid),
  'awaiting_signoff',
  '13.0 FIXTURE PRECONDITION: the phase is PARKED — every assertion below is about a frozen record owing a signature, and none of them can reach that state if this is wrong');

-- ---------------------------------------------------------------------------
-- §13.1-13.3 — CALLER-BLINDNESS, ASSERTED RATHER THAN ASSUMED.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from app.pending_staff_signoffs('00000000-0000-0000-0000-0000000013a1'::uuid)),
  1,
  '13.1 the helper returns the 1 pending section to the COORDINATOR');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from app.pending_staff_signoffs('00000000-0000-0000-0000-0000000013a1'::uuid)),
  1,
  '13.2 ⭐ …and the IDENTICAL row to the RESPONDENT — this door carries no identity gate BY DESIGN; if this ever reds, a gate was added and the backlog record must move');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from app.pending_staff_signoffs('00000000-0000-0000-0000-0000000013a1'::uuid)),
  1,
  '13.3 ⭐ …and to a NON-MEMBER staff_admin. The projection is not the boundary — 13.4-13.9 are');
select test_helpers.reset_role_and_claims();

-- ---------------------------------------------------------------------------
-- §13.4-13.6 — THE WALK-THROUGH: `get_response_for_signoff`, the door whose gate 3
--              consumes this helper's emptiness. It RAISES no_data_found rather
--              than returning empty, so the denial is asserted as a refusal.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (public.get_response_for_signoff('00000000-0000-0000-0000-0000000013a1'::uuid) ->> 'response_id'),
  '00000000-0000-0000-0000-0000000013a1',
  '13.4 THE TWIN: the coordinator walks through and gets THIS response — without which every zero below is unfalsifiable');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  $probe$ select public.get_response_for_signoff('00000000-0000-0000-0000-0000000013a1'::uuid) $probe$,
  'P0002', null,
  '13.5 a same-tenant staff_admin of ANOTHER commission is refused the signing door');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $probe$ select public.get_response_for_signoff('00000000-0000-0000-0000-0000000013a1'::uuid) $probe$,
  'P0002', null,
  '13.6 ⭐ the RESPONDENT — who owns this very response — is refused it too: the read right is the act of SIGNING, not authorship');
select test_helpers.reset_role_and_claims();

-- ---------------------------------------------------------------------------
-- §13.7-13.9 — THE WALK-THROUGH: `list_signoff_queue`, the second consumer. This
--              one returns an EMPTY SET rather than raising, so it is counted.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.list_signoff_queue((select comm_x from k))
   where response_id = '00000000-0000-0000-0000-0000000013a1'::uuid),
  1,
  '13.7 THE TWIN: the frozen record IS in the coordinator''s queue');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.list_signoff_queue((select comm_x from k))),
  0,
  '13.8 a non-member staff_admin reads an EMPTY queue for commission X — not merely "not this row", nothing at all');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.list_signoff_queue((select comm_x from k))),
  0,
  '13.9 the respondent reads an EMPTY queue for their OWN commission — filling is not countersigning');
select test_helpers.reset_role_and_claims();

-- ---------------------------------------------------------------------------
-- §13.10-13.12 — THE DIFFERENTIAL. Sign the section, then re-read the helper as all
--                three principals. If 13.1-13.3's "1" were a constant rather than
--                the live projection, these would stay 1 and this file would be
--                asserting nothing about the door's contents.
-- ---------------------------------------------------------------------------
insert into public.response_section_signoffs (response_id, section_id, signed_by)
select '00000000-0000-0000-0000-0000000013a1'::uuid, sec_a, sa_x from k;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from app.pending_staff_signoffs('00000000-0000-0000-0000-0000000013a1'::uuid)),
  0,
  '13.10 DIFFERENTIAL: once signed, the coordinator reads 0 — 13.1 tracked the projection');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from app.pending_staff_signoffs('00000000-0000-0000-0000-0000000013a1'::uuid)),
  0,
  '13.11 DIFFERENTIAL: …and so does the respondent — 13.2 tracked it too');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from app.pending_staff_signoffs('00000000-0000-0000-0000-0000000013a1'::uuid)),
  0,
  '13.12 DIFFERENTIAL: …and the non-member — 13.3 tracked it too, so all three zeros above are about the GATE and not about an empty projection');
select test_helpers.reset_role_and_claims();

-- =============================================================================
-- §14 — FUP-DSS-SIGN-SECTION-INVOKER-VERDICT-STALE: walk the DOOR, not the predicate.
--
-- `p0-authz-invoker-audit.sh` re-run over the SHIPPED body on 2026-08-24 returned
-- **BLIND** — `open-guard(g1=0,g2=0,g3=1)`. The pre-ADR-0136 findings row said
-- `open-guard(g1=1,g2=0,g3=0) | COVERED | ⚠ PROVISIONAL`, so BOTH halves of that row
-- were stale: the verdict AND the guard class the verdict was about. (`FROMFINDINGS=1
-- ARM=wrapper` compares a committed file to an allowlist and re-measures nothing, so a
-- changed body is invisible to it by construction.)
--
-- ⛔ WHY IT WAS BLIND, MEASURED RATHER THAN REASONED. The guard ADR 0136 rewrote is
--        if v_status <> 'in_progress' and not app.is_signoff_deferral_open(...) then raise
-- and §5 above pins exactly that bound — by calling `app.is_signoff_deferral_open` and
-- `app.can_sign_section` DIRECTLY. A predicate call is not a walk through the door: open
-- the door's own guard and §5.1/§5.2 stay green, because neither ever goes through it.
-- That is this repo's standing lesson ("a correct predicate is not a correct door") landing
-- on the one function ADR 0136 changed.
--
-- ⚠ HAND-CLASSIFICATION, which the PROVISIONAL row asked for and nobody had done:
-- **none of `sign_section`'s `if` guards is the authorization gate.** They are a domain
-- probe (does this response/section pair exist), a LIFECYCLE window (is it still
-- signable), and two shape checks. `sign_section` is INVOKER, so the authorization
-- decision is the RLS `WITH CHECK` on `response_section_signoffs.signoffs_insert` —
-- `signed_by = auth.uid() AND app.can_sign_section(...)` — which the INSERT reaches as the
-- caller. That gate is swept elsewhere and COVERED in both places: the write-path sweep
-- (`251_authz_p0_isolation.sql`) and the predicate arm (`app.can_sign_section`).
-- ⛔ AND THE FIRST VERSION OF §14.1 DID NOT FIX THE BLIND — measured, not assumed. It
-- asserted `throws_ok(..., '23514', null, ...)`, and with the wrapper guard opened
-- (`if false then`) the sweep still returned BLIND: the suite stayed PASS. The reason is
-- THE SECOND LOCK. `public.guard_submitted_signoffs` — the INSERT trigger on
-- `response_section_signoffs`, which shares the very same
-- `app.is_signoff_deferral_open` window — refuses with `errcode = 'check_violation'`,
-- i.e. **23514, the identical SQLSTATE the wrapper raises**. A matcher keyed on the code
-- alone therefore passes whichever lock fires, and cannot notice the first one being
-- removed. So 14.1 is pinned to the wrapper's own MESSAGE, which is the only thing that
-- distinguishes them. ⚠ Two locks are a good thing; a keystone that cannot say which one
-- held is not, and this one read as coverage while proving nothing about its subject.
-- ==============================================================================

-- 14.1 — THE DENIAL, THROUGH THE DOOR. Response …1303 sits on a COMPLETED phase, so the
-- deferral window is shut (§5.1) and `can_sign_section` already refuses it (§5.2). What
-- nothing asserted is that `sign_section` ITSELF refuses, with its own lifecycle error.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $probe$ select public.sign_section('00000000-0000-0000-0000-000000001303'::uuid,
                                     (select sec_a from k), null) $probe$,
  '23514', 'esta resposta já foi enviada e não pode mais ser assinada',
  '14.1 ⭐ KEYSTONE: sign_section REFUSES a window-closed response with ITS OWN message — asserted through the DOOR (§5 calls the predicates and cannot) and pinned to the message because the SQLSTATE alone cannot say WHICH lock fired');
select test_helpers.reset_role_and_claims();

-- 14.2/14.3 — THE NON-VACUITY TWIN. "the door refuses" is also true of a door that
-- refuses EVERYONE, so the same door, the same signer and the same section must SUCCEED
-- on a response whose window is OPEN — and conclude the phase.
select pg_temp.mk(910014, '00000000-0000-0000-0000-0000000014a1'::uuid,
                  '00000000-0000-0000-0000-0000000014a2'::uuid, null,
                  '00000000-0000-0000-0000-0000000014a3'::uuid);

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  $probe$ select public.submit_response('00000000-0000-0000-0000-0000000014a1'::uuid) $probe$,
  '14.2 the twin''s fixture freezes (submit succeeds with the staff_admin section unsigned)');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $probe$ select public.sign_section('00000000-0000-0000-0000-0000000014a1'::uuid,
                                     (select sec_a from k), null) $probe$,
  '14.3 ⭐ THE TWIN: the SAME door, signer and section SUCCEED while the window is open — so 14.1 pins the window, not a door that refuses everything');
select test_helpers.reset_role_and_claims();

-- =============================================================================
-- §15 — THE LANE THE RESUME QUERY FORGOT (ADR 0136 /
--       FUP-DSS-STANDALONE-ROUTE-DISABLES-SUBMIT, the route guard's other half).
--
-- `responses_one_draft_per_user_idx` is
--     unique (form_version_id, created_by) where status = 'in_progress'
--                                            AND case_phase_id IS NULL
-- — i.e. the "one draft per user per version" rule is a STANDALONE-LANE rule, and the
-- index says so explicitly. `start_or_resume_response`'s own resume query did NOT carry
-- that conjunct: it selected any `in_progress` response for (version, caller). So a user
-- holding a CASE-PHASE draft on version V, pressing "Preencher" on the standalone form V,
-- was handed **the case-phase draft** — which the standalone responder route now refuses
-- outright (it serves the standalone lane only). Before that guard existed the same path
-- rendered a wizard whose submit button was dead. Both are wrong; the guard is what made
-- it visible.
--
-- ⚠ THE STATE HAD TO BE CONSTRUCTED. `seed.sql` contains no `in_progress` case-phase
-- response at all, so no existing test could have met this, and nothing here would have
-- reddened on its own. (The two such rows visible on a working stack earlier were E2E
-- leftovers, not seed rows — a measurement that goes stale the moment someone resets.)
--
-- ⚠ ASSERTED ON THE LANE, NOT ON AN ID: the contract is "this door yields a STANDALONE
-- draft", which stays true whether it resumed one or created one.
-- =============================================================================

-- Deterministic start: st_x holds exactly ONE in_progress response on ver_s, and it is a
-- case-phase draft. Without this the resume could pick a leftover standalone draft from
-- an earlier section and pass while the defect is still there.
delete from public.responses r
where r.form_version_id = (select ver_s from k)
  and r.created_by = (select st_x from k)
  and r.status = 'in_progress';

select pg_temp.mk(910015, '00000000-0000-0000-0000-0000000015a1'::uuid,
                  '00000000-0000-0000-0000-0000000015a2'::uuid, null,
                  '00000000-0000-0000-0000-0000000015a3'::uuid);

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table resumed on commit drop as
  select * from public.start_or_resume_response((select ver_s from k));
select test_helpers.reset_role_and_claims();

select is(
  (select case_phase_id is null from resumed),
  true,
  '15.1 ⭐ KEYSTONE: start_or_resume_response hands back a STANDALONE draft even when the caller holds a case-phase draft on the same version — the resume query must carry the same `case_phase_id is null` conjunct its own unique index does');

select is(
  (select status from public.responses where id = '00000000-0000-0000-0000-0000000015a1'::uuid),
  'in_progress',
  '15.2 THE TWIN: the case-phase draft is left alone — the fix must ADD a standalone lane, never hijack or close the phase draft');

rollback;
