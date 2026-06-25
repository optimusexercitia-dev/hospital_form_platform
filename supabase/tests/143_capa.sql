-- Phase 14d: Patient-Safety / NSP — CAPA (Corrective Action Plan, Effectiveness &
-- Closure). ADR 0030/0034. The FINAL Phase-14 sub-phase.
-- Covers (per the track-doc acceptance list):
--   * status machine (aberto -> em_execucao -> em_verificacao -> concluido / cancelado /
--     reopen) + child-lock (a terminal plan rejects child writes);
--   * the conclude-gate: close blocked by an unsettled action (HC051) and by a missing
--     effectiveness verdict (HC052);
--   * reopen REVOKES the effectiveness row;
--   * assignee-or-PQS advance gate (HC050): a plain-`staff` assignee advances their
--     action, a non-assignee non-PQS cannot, and the assignee CANNOT broadly edit the plan;
--   * the source CHECK (exactly one source column matches `source`);
--   * source_indicator_id accepts NULL + is FK-LESS / deferred-safe for Phase 15;
--   * the close->event-closure side effect (fires only when fully settled);
--   * RCA-sourced + event-sourced + manual open_capa_plan all work;
--   * the CAPA + RCA nsp-evidence object policies are MUTUALLY EXCLUSIVE by construction;
--   * cancel HC053 on a terminal plan;
--   * PHI-free capa audit rows (status/verdict only — no *_md body).

begin;
select plan(38);

update app.feature_flags set enabled = true where key = 'patient_safety';
update app.feature_flags set enabled = true where key = 'audit_trail';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_y')::uuid   as st_y,
         (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- NSP-per-org (ADR 0042): pqs_members has composite PK (organization_id, user_id).
insert into public.pqs_members (organization_id, user_id, added_by)
  select (v->>'org_b')::uuid, (v->>'admin')::uuid, (v->>'admin')::uuid from ctx;
insert into public.pqs_department (organization_id, name, rca_default_due_days)
  select (v->>'org_b')::uuid, 'NSP Bootstrap', 30 from ctx
  on conflict (organization_id) do nothing;

-- =========================================================================
-- Drive an event -> triage(sentinel) -> RCA(completed with a root cause) so we can
-- open an rca-sourced CAPA and test the close->event side effect.
-- =========================================================================
-- Multi-tenancy Phase B: notify_safety_event dropped its admin term; a
-- reporting-commission member registers the event.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table ev on commit drop as
  select (public.notify_safety_event((select comm_x from k), 'Sentinela CAPA', null, 'death', null, null, null, current_date)).id as id;
reset role;
grant select on ev to authenticated;

select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.acknowledge_event((select id from ev));
select public.save_triage((select id from ev), true, null, 'sentinel', 'death', false, null, null, '{}');
select public.confirm_triage((select id from ev));
reset role;

create temp table r on commit drop as select id as rca_id from public.rca where event_id = (select id from ev);
grant select on r to authenticated;

-- Build a root cause + complete the RCA.
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.update_rca((select rca_id from r), 'x', null, null, null, null, null);
create temp table root on commit drop as
  select (public.add_rca_root_cause((select rca_id from r), 'Causa raiz', 'process', 'system', 'root')).id as root_id;
select public.submit_rca_for_review((select rca_id from r));
select public.complete_rca((select rca_id from r));
reset role;
grant select on root to authenticated;

-- =========================================================================
-- open_capa_plan: rca-sourced, event-sourced, manual all work; code minted.
-- =========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
create temp table c on commit drop as
  select (public.open_capa_plan('rca', 'corretiva', (select rca_id from r))).id as capa_id;
reset role;
grant select on c to authenticated;
select isnt((select capa_id from c), null, 'open_capa_plan (rca-sourced) mints a plan');
select ok(
  (select code from public.capa_plan where id = (select capa_id from c)) like 'CAPA-%',
  'the plan code is minted (CAPA-####)');
select is((select status from public.capa_plan where id = (select capa_id from c)), 'aberto',
  'a new plan starts aberto');

select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
-- event-sourced + manual both work.
select isnt((public.open_capa_plan('event', 'preventiva', (select id from ev))).id, null,
  'open_capa_plan (event-sourced) works');
select isnt((public.open_capa_plan('manual', 'melhoria', null)).id, null,
  'open_capa_plan (manual, no source id) works');
-- a non-manual source without an id is rejected.
select throws_ok(
  $$ select public.open_capa_plan('rca', 'corretiva', null) $$,
  '23514', null, 'a non-manual source without a source id is rejected (check_violation)');
reset role;

-- =========================================================================
-- Source CHECK: exactly one source column matches `source` (probe a bad direct insert
-- as the table owner — RLS aside, the CHECK must fire).
-- =========================================================================
select throws_ok(
  $$ insert into public.capa_plan (source, source_event_id, source_rca_id)
     values ('event', gen_random_uuid(), gen_random_uuid()) $$,
  '23514', null, 'a plan with two source columns set violates the source CHECK');

-- source_indicator_id accepts NULL + is FK-LESS (no FK constraint references indicators).
select is(
  (select count(*)::int from pg_constraint
   where conrelid = 'public.capa_plan'::regclass and contype = 'f'
     and pg_get_constraintdef(oid) like '%source_indicator_id%'),
  0, 'source_indicator_id is FK-LESS (deferred-safe for the Phase-15 wiring)');

-- =========================================================================
-- Add an action assigned to a plain-staff member; assignee-or-PQS advance gate.
-- =========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.update_capa_plan((select capa_id from c), 'corretiva');  -- aberto -> em_execucao
create temp table a on commit drop as
  select (public.add_capa_action((select capa_id from c), 'Ação 1', 'Resp.', (select st_x from k),
          current_date + 30, 'forte', 'medida', (select root_id from root))).id as action_id;
reset role;
grant select on a to authenticated;
select is((select status from public.capa_plan where id = (select capa_id from c)), 'em_execucao',
  'adding an action moves aberto -> em_execucao');
select is((select root_cause_id from public.capa_action where id = (select action_id from a)),
  (select root_id from root), 'the action links to the RCA root cause (the 14c FK)');

-- A plain-staff ASSIGNEE (st_x) CAN advance their action (HC050 path).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.advance_capa_action((select action_id from a), 'em_andamento');
reset role;
select is((select status from public.capa_action where id = (select action_id from a)), 'em_andamento',
  'a plain-staff assignee advances their own action (assignee-or-PQS)');

-- ...but the assignee CANNOT broadly edit the plan (PQS-only write).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.update_capa_action((select action_id from a), 'hack', null, null, null, 'forte', null, null) $$,
  '42501', null, 'the assignee cannot broadly edit the action (PQS-only management)');
reset role;

-- A non-assignee, non-PQS user (st_y) cannot advance the action (HC050).
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.advance_capa_action((select action_id from a), 'concluida') $$,
  'HC050', null, 'a non-assignee non-PQS user cannot advance the action (HC050)');
reset role;

-- =========================================================================
-- Conclude-gate: close blocked by an unsettled action (HC051).
-- =========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
-- record effectiveness first (so HC052 is satisfied and we isolate HC051).
select public.record_capa_effectiveness((select capa_id from c), 'eficaz', 'método');
select throws_ok(
  $$ select public.close_capa_plan((select capa_id from c), 'lições') $$,
  'HC051', null, 'close is blocked while an action is unsettled (HC051)');
reset role;

-- Settle the action, then close succeeds.
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.complete_capa_action((select action_id from a));
select public.close_capa_plan((select capa_id from c), 'Lições aprendidas registradas.');
reset role;
select is((select status from public.capa_plan where id = (select capa_id from c)), 'concluido',
  'close succeeds once actions are settled + effectiveness recorded');

-- =========================================================================
-- Child-lock: a terminal plan rejects child writes (HC049), even via RPC.
-- =========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select throws_ok(
  $$ select public.add_capa_action((select capa_id from c), 'tardia', null, null, null, 'forte', null, null) $$,
  'HC049', null, 'a concluded plan rejects child writes (child-lock HC049)');
reset role;

-- =========================================================================
-- reopen REVOKES the effectiveness row.
-- =========================================================================
select is(
  (select count(*)::int from public.capa_effectiveness where capa_id = (select capa_id from c)),
  1, 'a closed plan has its effectiveness row');
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.reopen_capa_plan((select capa_id from c));
reset role;
select is((select status from public.capa_plan where id = (select capa_id from c)), 'em_execucao',
  'reopen moves concluido -> em_execucao');
select is(
  (select count(*)::int from public.capa_effectiveness where capa_id = (select capa_id from c)),
  0, 'reopen REVOKES the effectiveness verdict (must re-verify before re-closing)');

-- Re-closing now fails on HC052 (effectiveness revoked).
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select throws_ok(
  $$ select public.close_capa_plan((select capa_id from c), 'x') $$,
  'HC052', null, 'after reopen, close is blocked with no effectiveness (HC052)');
reset role;

-- =========================================================================
-- The close->event-closure side effect: when the RCA is completed AND every CAPA plan
-- of the event is terminal, closing the last one closes the event.
-- =========================================================================
-- The event has TWO plans (the rca-sourced `c` + the event-sourced one from earlier).
-- Cancel all plans of the event, then verify the event auto-closed via the predicate.
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
-- settle + close `c` properly again (re-record effectiveness, actions already concluded).
select public.record_capa_effectiveness((select capa_id from c), 'eficaz', 'm');
-- cancel every OTHER non-terminal plan of this event so the predicate can pass.
do $$
declare p record;
begin
  for p in select id from public.capa_plan
           where app.event_of_capa(id) = (select id from ev) and status not in ('concluido','cancelado')
             and id <> (select capa_id from c)
  loop
    perform public.cancel_capa_plan(p.id);
  end loop;
end $$;
select public.close_capa_plan((select capa_id from c), 'Encerrado.');
reset role;
select is((select status from public.patient_safety_event where id = (select id from ev)), 'closed',
  'closing the last plan of a fully-settled event auto-closes the event (triaged -> closed)');

-- the fully-settled predicate is true for the event now.
select is(app.event_capa_fully_settled((select id from ev)), true,
  'event_capa_fully_settled is true when the RCA is completed + all plans terminal');

-- =========================================================================
-- cancel HC053 on a terminal plan.
-- =========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select throws_ok(
  $$ select public.cancel_capa_plan((select capa_id from c)) $$,
  'HC053', null, 'cancelling an already-terminal plan is rejected (HC053)');
reset role;

-- =========================================================================
-- nsp-evidence: the CAPA + RCA object policies are mutually exclusive by construction.
-- A CAPA object policy + an RCA object policy each exist; neither matches the other's
-- path shape. We assert BOTH policy pairs are present (select + insert each).
-- =========================================================================
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname like 'capa_evidence_obj_%'),
  2, 'the CAPA nsp-evidence object policies (select + insert) exist');
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname like 'nsp_evidence_obj_%'),
  2, 'the RCA nsp-evidence object policies (select + insert) still exist (coexist)');
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and (policyname like 'nsp_evidence_obj_%' or policyname like 'capa_evidence_obj_%')
     and cmd in ('UPDATE', 'DELETE')),
  0, 'no update/delete policy on nsp-evidence for either RCA or CAPA (immutable, Rule 6)');

-- =========================================================================
-- PHI-free audit: capa rows carry status/verdict only — no *_md body.
-- =========================================================================
select ok(
  not exists (
    select 1 from public.audit_log
    where action like 'capa.%' and (metadata ? 'lessons_learned_md' or metadata ? 'method_md')),
  'no capa audit row copies lessons_learned_md/method_md (PHI/free-text-free, Rule 11)');
select ok(
  exists (select 1 from public.audit_log where action = 'capa.opened'),
  'open emits a capa.opened audit row');
select ok(
  exists (select 1 from public.audit_log where action = 'capa.closed'),
  'close emits a capa.closed audit row');
select ok(
  exists (select 1 from public.audit_log where action = 'capa.effectiveness_recorded'),
  'recording effectiveness emits a capa.effectiveness_recorded audit row');

-- =========================================================================
-- READ scope: a foreign committee (st_y) cannot read an event-scoped plan.
-- =========================================================================
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.capa_plan where id = (select capa_id from c)),
  0, 'a foreign-committee user reads NO event-scoped CAPA plan (source scope)');
reset role;

-- =========================================================================
-- §M2 (NSP-per-org regression guard): capa_viewer_can_manage + capa_kpis were
-- re-created off the …009000 base that still called the DROPPED is_pqs_writer() /
-- is_pqs_member(uid) symbols — they ERRORED at call time for everyone (the query
-- layer swallowed capa_viewer_can_manage → viewerCanManage silently false for every
-- per-org writer; capa_kpis crashed the NSP dashboard headline). Rebound to
-- can_write_capa / is_pqs_member_of_any. These guards prove they EXECUTE without
-- error and gate correctly. (`admin` is the enrolled per-org PQS writer; § top.)
-- =========================================================================
-- capa_viewer_can_manage: TRUE for the enrolled per-org CAPA writer, no error.
select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
select is(
  public.capa_viewer_can_manage((select capa_id from c)),
  true,
  'M2 GUARD: capa_viewer_can_manage = true for an enrolled per-org CAPA writer (no dropped-symbol error)');
reset role;

-- capa_viewer_can_manage: FALSE for a non-writer (st_y, foreign committee — neither
-- reads nor writes this plan), without erroring.
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is(
  public.capa_viewer_can_manage((select capa_id from c)),
  false,
  'M2 GUARD: capa_viewer_can_manage = false for a non-writer (no error)');
reset role;

-- capa_kpis: executes without error for a PQS member (the dropped is_pqs_member(uid)
-- crash fix). Returns exactly one headline row.
select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.capa_kpis()),
  1,
  'M2 GUARD: capa_kpis() executes without error for a PQS member (returns one headline row)');
reset role;

-- =========================================================================
-- §M3 (NSP-per-org RESULT-SCOPE guard): the M2 rebind fixed capa_kpis's GATE
-- (is_pqs_member_of_any) but its first form left the RESULT SET global — the
-- `where is_pqs_member_of_any(uid)` clause is a non-correlated boolean, so a
-- rede-a-only PQS member's headline counted rede-b's event-sourced plans/actions
-- (cross-org aggregate tenant-isolation leak; QA M3). The fix correlates each
-- event/rca-sourced plan to org_of_event(event_of_capa(p.id)) = any(caller's orgs)
-- (non-event-sourced plans kept any-org, mirroring can_write_capa). This guard
-- reproduces QA's exact scenario INSIDE the rollback: inject ONE event-sourced
-- capa_plan in a SECOND org + an overdue action; the org_b PQS member (admin) must
-- NOT count it, while a PQS member OF that second org DOES.
--
-- The bootstrap world is single-org (its truncate wipes the seed's pqs.a/pqs.b +
-- rede-b event), so we mint the 2nd org + commission + event-sourced plan directly
-- (superuser; reverts with the rollback) — same scenario, bootstrap personas.
-- =========================================================================
-- Baseline: admin's (org_b PQS) headline BEFORE the cross-org injection.
select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
create temp table kpi_before on commit drop as
  select open_count, overdue_actions from public.capa_kpis();
reset role;
grant select on kpi_before to authenticated;

-- A 2nd org + hospital + commission, an event in it, an event-sourced capa_plan
-- (em_execucao → counts toward open_count) + an OVERDUE action, and a PQS member
-- enrolled in that 2nd org (st_y).
create temp table m3 on commit drop as
  select gen_random_uuid() as org_other, gen_random_uuid() as hosp_other,
         gen_random_uuid() as comm_other, gen_random_uuid() as ev_other,
         gen_random_uuid() as capa_other, gen_random_uuid() as action_other;
grant select on m3 to authenticated;
insert into public.organizations (id, name, slug)
  values ((select org_other from m3), 'Org Other M3', 'org-m3-' || substr((select org_other from m3)::text,1,8));
insert into public.hospitals (id, organization_id, name, slug)
  values ((select hosp_other from m3), (select org_other from m3), 'Hosp M3',
          'hosp-m3-' || substr((select hosp_other from m3)::text,1,8));
insert into public.commissions (id, name, slug, created_by, hospital_id)
  values ((select comm_other from m3), 'Comissão Other M3',
          'comm-m3-' || substr((select comm_other from m3)::text,1,8),
          (select admin from k), (select hosp_other from m3));
-- An event in the 2nd org (org_of_event resolves via reporting_commission_id → org).
insert into public.patient_safety_event
  (id, code, reporting_commission_id, discovered_at, title, status,
   current_owner_kind, current_owner_commission_id, reported_by)
values
  ((select ev_other from m3), 'EV-M3-OTHER', (select comm_other from m3), current_date,
   'Evento rede-other', 'acknowledged', 'pqs', null, (select admin from k));
-- An EVENT-SOURCED plan on that event (em_execucao) → event-org = org_other.
insert into public.capa_plan (id, source, source_event_id, classification, status)
  values ((select capa_other from m3), 'event', (select ev_other from m3), 'corretiva', 'em_execucao');
-- An OVERDUE action on it (due in the past, not concluded/cancelled).
insert into public.capa_action (id, capa_id, title, position, due_date, status)
  values ((select action_other from m3), (select capa_other from m3), 'Ação rede-other', 0,
          current_date - 1, 'pendente');
-- Enroll st_y as a PQS member of the 2nd org (so it sees ITS org's KPIs).
insert into public.pqs_members (organization_id, user_id, added_by)
  values ((select org_other from m3), (select st_y from k), (select admin from k));

-- (M3a) admin (org_b PQS) headline is UNCHANGED by the org_other plan — org-scoped.
select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
create temp table kpi_after on commit drop as
  select open_count, overdue_actions from public.capa_kpis();
reset role;
grant select on kpi_after to authenticated;
select is(
  (select open_count from kpi_after),
  (select open_count from kpi_before),
  'M3 GUARD: a rede-a-only PQS member''s open_count is UNCHANGED by a cross-org event-sourced plan (org-scoped, does NOT count it)');
select is(
  (select overdue_actions from kpi_after),
  (select overdue_actions from kpi_before),
  'M3 GUARD: …and overdue_actions is UNCHANGED (the overdue subquery is org-scoped too)');

-- (M3b) the 2nd-org PQS member (st_y) DOES see the org_other plan + overdue action.
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
create temp table kpi_other on commit drop as
  select open_count, overdue_actions from public.capa_kpis();
reset role;
grant select on kpi_other to authenticated;
select ok(
  (select open_count from kpi_other) >= 1,
  'M3 GUARD: the 2nd-org PQS member DOES count the org_other plan in open_count (own-org visibility)');
select ok(
  (select overdue_actions from kpi_other) >= 1,
  'M3 GUARD: the 2nd-org PQS member DOES count the org_other overdue action');

select * from finish();
rollback;
