-- =============================================================================
-- 352 — `dispose_event_phi`'s AUTHORIZATION GATE, keystoned.
--
-- Closes FUP-DISPOSE-EVENT-DOOR-GATE-BLIND.
--
-- ⭐ WHY THIS FILE EXISTS. Measured 2026-08-19 by neutralization on a fresh reset:
-- rewriting this door's authz raise to `perform 1;` — so ANY caller passes the gate —
-- left the FULL suite GREEN (6550/6550). A PHI-erasure door on the patient-safety
-- module whose gate no keystone exercises is door-blind in the ADR 0079 sense. Two of
-- the four PHI-disposal doors were blind; `dispose_meeting_minutes` was closed by
-- `348` t7, and this is the other one.
--
-- ⚠ BLIND ≠ VULNERABLE. The gate is present and correct today. What was missing is the
-- test that goes RED if a refactor drops it.
--
-- ⛔ WHY THE STANDING ARMS CANNOT SEE THIS, so nobody re-derives it:
--   · `ARM=floor` asks whether the DOOR is called — it is; its happy path is tested.
--     "The door is exercised" is true and does not bound "the door's GATE is exercised".
--   · `ARM=census` is bounded to bool/set-returning DEFINERs; this door returns `void`
--     (Critical FUP C2 — 407 command doors outside every arm's domain).
--   · ADR 0079 Amdt 1's diff-scoped recipe filters to `^(is_|can_|has_)` function names
--     and RLS policies. This gate is a plain `if not (...)` INSIDE a door and matches no
--     filter. The enumeration boundary is a SYNTAX; the property is "an authorization
--     decision no test can see change".
--
-- ⚠ ASSERT THE MESSAGE, NOT THE SQLSTATE ALONE. `42501` is both the RLS-refusal code and
-- Postgres's generic *permission denied for table/function* — so a bare
-- `throws_ok(..., '42501')` here would also pass if `authenticated` merely lacked EXECUTE,
-- and would keep passing with the gate deleted (FUP-42501-CONFLATES-GRANT-WITH-RLS,
-- measured on 2 of 12 P0-isolation assertions). Every refusal below pins the door's own
-- message text, so the refusal is attributable to THE GATE.
--
-- ⚠ THE CONTROLS ASK THE DOOR'S PREDICATE, NOT A MEMBERSHIPS ROW (QA r3 · N13). Holding a
-- membership is not passing `app.has_role`, whose final conjunct also demands the caller's
-- ACTIVE hat — and the predicate only tells the truth when asked under the caller's own
-- claims: probed as superuser it short-circuits on `p_user_id is distinct from auth.uid()`
-- and answers a DIFFERENT question, reassuringly. t1/t2 therefore run under `claims_for`
-- + `set local role authenticated`, exactly as the door will see them.
--
-- ⚠ THE ALLOW LEG IS NOT DECORATION (t5/t6, the shape `345_previa_audit_door.sql` models).
-- Without it, t4 would pass just as well if the feature flag were off, the fixture event
-- did not exist, or `authenticated` could not execute the function at all — a refusal
-- proves nothing unless the same door, same transaction, ADMITS someone. t6 pins that the
-- admitted call really erased, so t5 cannot pass on a door that returns without working.
--
-- ⛔ DO NOT "fix" a red here by widening the gate.
-- =============================================================================

begin;
select plan(6);

-- The door opens with `app.assert_patient_safety_enabled()`; without this the keystone
-- SKIPS into a green (pgtap-fixture-flag-gaps). `audit_trail` is needed by the
-- `app.audit_write` at the end of the door's allow leg (t5).
update app.feature_flags set enabled = true
 where key in ('patient_safety', 'audit_trail');

-- ── FIXTURE ─────────────────────────────────────────────────────────────────────────
create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,  (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,   (v->>'comm_x')::uuid as comm_x,
         (v->>'hosp_b')::uuid as hosp_b, (v->>'org_b')::uuid  as org_b
  from ctx;
grant select on k to authenticated;

-- `st_x` is a PLAIN `staff` member of comm_x: the tightest discriminator available. It
-- holds ordinary commission membership on the event's own commission, so a refusal cannot
-- be attributed to tenancy isolation — only to the ROLE the gate demands.
create temp table ev on commit drop as select gen_random_uuid() as event;
grant select on ev to authenticated;

insert into public.patient_safety_event
  (id, code, reporting_commission_id, discovered_at, title, status, current_owner_kind, reported_by)
values ((select event from ev), 'EV-352', (select comm_x from k), current_date,
        'Evento 352', 'acknowledged', 'pqs', (select sa_x from k));
insert into public.event_patient (event_id, name, mrn, sex)
  values ((select event from ev), 'PACIENTE-352', 'MRN-352', 'female');
update public.patient_safety_event set has_patient = true where id = (select event from ev);

-- ── CONTROLS: the persona fails BOTH arms, asked as the door asks ───────────────────
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;

select ok(not app.is_tenancy_admin_of((select comm_x from k)),
  't1 ⭐ CONTROL: the persona fails the gate''s FIRST arm under its OWN claims — is_tenancy_admin_of is false. Asked as superuser this predicate short-circuits its hat conjunct and answers a different question (QA r3 N13)');
select ok(not app.is_pqs_operator_of((select hosp_b from k)),
  't2 ⭐ CONTROL: …and its SECOND arm — is_pqs_operator_of is false. Both arms pinned separately, so a gate that later loses ONE disjunct still reds here rather than passing on the survivor');

reset role;

select is((select count(*)::int from public.event_patient ep, ev
            where ep.event_id = ev.event), 1,
  't3 CONTROL: the fixture event really HAS patient PHI and is NOT yet disposed — without this t4 could pass on `HC056 já descartados` or a missing event, i.e. for the wrong reason entirely');

-- ── THE KEYSTONE (the blind gate) ───────────────────────────────────────────────────
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;

select throws_ok(
  format('select public.dispose_event_phi(%L::uuid, %L)', (select event from ev), 'subject_request'),
  '42501',
  'apenas um administrador da organização ou o NSP pode descartar dados do paciente',
  't4 ⭐⭐ KEYSTONE: an ordinary commission member CANNOT erase a patient-safety event''s PHI — mutation-proven blind before this test existed (gate opened alone, 6550/6550 still PASSED). Pins the door''s own MESSAGE, so a missing EXECUTE grant cannot satisfy it');

reset role;

-- ── ALLOW LEG: the same door, same transaction, ADMITS a hatted caller ───────────────
insert into public.memberships (organization_id, hospital_id, principal_id, role, granted_by)
values ((select org_b from k), (select hosp_b from k), (select sa_x from k), 'pqs_member',
        (select admin from k))
on conflict (principal_id, role, organization_id, hospital_id, commission_id) do nothing;

select test_helpers.claims_for((select sa_x from k), false, 'pqs_member');
set local role authenticated;

select lives_ok(
  format('select public.dispose_event_phi(%L::uuid, %L)', (select event from ev), 'subject_request'),
  't5 ⭐ ALLOW-LEG DIFFERENTIAL: a PQS operator IS admitted by the same gate, in the same transaction. Without this leg t4 would pass equally well with the flag off, the event absent, or EXECUTE revoked — a refusal is only evidence when the door demonstrably admits someone');

reset role;

select is((select count(*)::int from public.event_patient ep, ev where ep.event_id = ev.event), 0,
  't6 ⭐ …and the admitted call really ERASED: event_patient is gone. t5 alone would be satisfied by a door that returns without doing anything, which is how an allow leg goes vacuous');

select * from finish();
rollback;
