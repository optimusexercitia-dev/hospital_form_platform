-- BUG-CAPA-AUDIT-SCOPE-1 (Architecture Rule 11) — app.trg_audit_capa_plan /
-- app.trg_audit_capa_effectiveness resolved audit scope ONLY via
-- `event_of_capa(new.id) -> commission_of_event(...)`, which is null for every
-- CAPA whose source is NOT 'event'/'rca' (manual, meeting, indicator,
-- audit_finding — 4 of 6 source types) — even though `capa_plan.hospital_id`
-- is a real, NOT NULL column on the SAME row, unused by the trigger. Every such
-- CAPA's audit rows landed in the all-NULL platform-tier chain.
--
-- Escalated from "predicted" (found auditing the ACT P0 assume_role fix) to
-- "observed": `tester` confirmed AC-3f-platform RED standalone against a
-- contaminated state, and found a SECOND independent reproduction
-- (phase15-indicators.spec.ts AC-5b, indicator-sourced) with no involvement
-- from the manual-source spec at all.
--
-- Fix: fall back to the CAPA's own `hospital_id` (-> `app.org_of_hospital`)
-- when the event chain doesn't resolve a commission. This NARROWS — moves rows
-- out of the platform-tier bucket into their correct tenant. It grants nothing;
-- it is a correctness fix to the audit trail, not an authorization change.
--
-- Sibling-trigger sweep (bounded by the PROPERTY: a trg_audit_* function whose
-- scope resolution can itself evaluate to NULL, not by name): two independent
-- catalog greps (`prosrc like '%event_of_%'` and the broader
-- `prosrc like '%else null end%'`) converge on the SAME two functions
-- (`trg_audit_capa_plan`, `trg_audit_capa_effectiveness`) out of all 49
-- `trg_audit_*` functions. Four near-miss candidates matched the narrower
-- `event_of_` grep alone (`trg_audit_event_custody`, `trg_audit_event_patient`,
-- `trg_audit_event_triage`, `trg_audit_rca`) but do NOT share the vulnerable
-- shape: each calls `app.commission_of_event(new.event_id)` UNCONDITIONALLY
-- (no null-check branch), and `event_id` is `NOT NULL` on all four tables
-- (`event_custody`, `event_patient`, `event_triage`, `rca`) — confirmed via
-- `information_schema.columns`, not assumed — while `commission_of_event`
-- reads `patient_safety_event.reporting_commission_id`, itself `NOT NULL`. The
-- chain can never actually return NULL for these four; only CAPA's `source`
-- column makes the event genuinely OPTIONAL (4 of 6 values have none).

begin;
select plan(9);

update app.feature_flags set enabled = true where key = 'patient_safety';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid as admin, (v->>'org_b')::uuid as org_b,
         (v->>'hosp_b')::uuid as hosp_b from ctx;
grant select on k to authenticated;

-- A MANUAL-source capa_plan — the exact shape that never had an event to chain
-- through. Inserted directly (as postgres, bypassing the guard/RPC layer) so
-- this keystone tests the TRIGGER itself, not `open_capa_plan`'s own gate
-- (already covered by 316's keystone).
insert into public.capa_plan (source, hospital_id, opened_by)
values ('manual', (select hosp_b from k), (select admin from k));
create temp table cp on commit drop as
  select id, code from public.capa_plan
  where hospital_id = (select hosp_b from k) and source = 'manual'
  order by created_at desc limit 1;
grant select on cp to authenticated;

-- ── capa.opened (INSERT) ─────────────────────────────────────────────────
select is(
  (select organization_id from public.audit_log
    where action = 'capa.opened' and entity_id = (select id from cp)),
  (select org_b from k),
  'capa.opened: organization_id resolves to the CAPA''s own hospital''s org (Rule 11), not the platform bucket');
select is(
  (select hospital_id from public.audit_log
    where action = 'capa.opened' and entity_id = (select id from cp)),
  (select hosp_b from k),
  'capa.opened: hospital_id is the CAPA''s own hospital_id, not NULL');
select ok(
  (select commission_id is null from public.audit_log
    where action = 'capa.opened' and entity_id = (select id from cp)),
  'capa.opened: commission_id correctly stays NULL — a manual-source CAPA has no commission, only a hospital');

-- ── capa.status_changed (UPDATE), via the real state-machine bypass the RPC
--    itself uses — proves the fix isn't INSERT-only. ────────────────────────
select set_config('app.in_safety_rpc', 'on', true);
update public.capa_plan set status = 'in_execution' where id = (select id from cp);
select set_config('app.in_safety_rpc', 'off', true);

select is(
  (select hospital_id from public.audit_log
    where action = 'capa.status_changed' and entity_id = (select id from cp)),
  (select hosp_b from k),
  'capa.status_changed: also scoped to the CAPA''s own hospital, not NULL');

-- ── capa.effectiveness_recorded (a SIBLING table, capa_effectiveness, whose
--    trigger resolves scope by looking the CAPA back up via capa_id) ────────
insert into public.capa_effectiveness (capa_id, verdict)
values ((select id from cp), 'eficaz');

select is(
  (select organization_id from public.audit_log
    where action = 'capa.effectiveness_recorded' and entity_id = (select id from cp)),
  (select org_b from k),
  'capa.effectiveness_recorded: organization_id resolves via capa_plan.hospital_id, not the platform bucket');
select is(
  (select hospital_id from public.audit_log
    where action = 'capa.effectiveness_recorded' and entity_id = (select id from cp)),
  (select hosp_b from k),
  'capa.effectiveness_recorded: hospital_id is the CAPA''s own hospital_id, not NULL');
select ok(
  (select commission_id is null from public.audit_log
    where action = 'capa.effectiveness_recorded' and entity_id = (select id from cp)),
  'capa.effectiveness_recorded: commission_id correctly stays NULL');

-- ── CONTROL: an EVENT-sourced CAPA still resolves via the commission chain,
--    unaffected by the fallback (proves the fix doesn't override a working
--    path — the fallback only fires when v_comm IS null). Bootstrap's fixture
--    set has no commission under org_b yet — create one so the CONTROL case
--    has a real commission to chain through. ────────────────────────────────
insert into public.commissions (name, slug, organization_id, hospital_id)
values ('Comissão B (capa scope control)', 'comissao-b-capa-scope', (select org_b from k), (select hosp_b from k));
create temp table cb on commit drop as
  select id from public.commissions where slug = 'comissao-b-capa-scope';
grant select on cb to authenticated;

insert into public.patient_safety_event (title, reporting_commission_id, reported_by)
values ('Evento de teste (capa audit scope, control)', (select id from cb), (select admin from k));
create temp table ev on commit drop as
  select id from public.patient_safety_event where title = 'Evento de teste (capa audit scope, control)';
grant select on ev to authenticated;

insert into public.capa_plan (source, source_event_id, hospital_id, opened_by)
values ('event', (select id from ev), (select hosp_b from k), (select admin from k));
create temp table cpe on commit drop as
  select id from public.capa_plan where source_event_id = (select id from ev);
grant select on cpe to authenticated;

select is(
  (select commission_id from public.audit_log
    where action = 'capa.opened' and entity_id = (select id from cpe)),
  (select id from cb),
  'CONTROL: an EVENT-sourced CAPA still resolves commission_id via the event chain, unaffected by the fallback');
select ok(
  (select organization_id = (select org_b from k) and hospital_id = (select hosp_b from k)
   from public.audit_log
    where action = 'capa.opened' and entity_id = (select id from cpe)),
  'CONTROL: org_id/hospital_id are populated via audit_write''s OWN commission-derivation (unaffected by the fallback -- both happen to agree here since the control commission belongs to org_b/hosp_b)');

select * from finish();
rollback;
