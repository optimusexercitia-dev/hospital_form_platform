-- BUG-CAPA-AUDIT-SCOPE-1 (Architecture Rule 11) — app.trg_audit_capa_plan and
-- app.trg_audit_capa_effectiveness resolved audit scope ONLY via
-- `event_of_capa(new.id) -> commission_of_event(...)`, which is NULL for a CAPA
-- whose `source` is 'manual' / 'meeting' / 'indicator' / 'audit_finding' (4 of 6
-- values — `event_of_capa`'s own body only resolves 'event' and 'rca'). Every
-- such CAPA's audit rows (`capa.opened`, `capa.status_changed`,
-- `capa.effectiveness_recorded`, etc.) landed in the all-NULL platform-tier audit
-- chain, even though `capa_plan.hospital_id` is a real, NOT NULL column on the
-- same row.
--
-- Escalated from predicted to observed (`tester`): AC-3f-platform confirmed RED
-- standalone against a contaminated state (empty-state text times out — the
-- exact failure shape, not inferred from row counts), plus a SECOND independent
-- reproduction (`phase15-indicators.spec.ts` AC-5b, indicator-sourced,
-- `capa.opened: 2` in the platform-null bucket with no involvement from the
-- manual-source spec).
--
-- Fix: when the event chain doesn't resolve a commission, fall back to the
-- CAPA's own `hospital_id` (`app.org_of_hospital` derives the organization).
-- `capa_plan.hospital_id` is `NOT NULL` (verified: `information_schema.columns`),
-- so the fallback is unconditionally available — no further NULL-handling case is
-- reachable. This NARROWS the audit trail (moves rows out of the platform-tier
-- bucket into their correct tenant); it grants nothing and authorizes nothing —
-- a correctness fix to the audit trail (Rule 11), not a widening.
--
-- Sibling-trigger sweep (bounded by the PROPERTY — a trg_audit_* function whose
-- scope resolution can itself evaluate to NULL — not by name): two independent
-- catalog greps over all 49 `trg_audit_*` functions (`prosrc like '%event_of_%'`
-- and the broader `prosrc like '%else null end%'`) converge on exactly these two.
-- Four near-miss candidates matched the narrower grep alone
-- (`trg_audit_event_custody`, `trg_audit_event_patient`, `trg_audit_event_triage`,
-- `trg_audit_rca`) but do NOT share the vulnerable shape: each calls
-- `app.commission_of_event(new.event_id)` UNCONDITIONALLY (no null-check branch
-- at all), and `event_id` is `NOT NULL` on all four tables (`event_custody`,
-- `event_patient`, `event_triage`, `rca` — verified via
-- `information_schema.columns`), while `commission_of_event` reads
-- `patient_safety_event.reporting_commission_id`, itself `NOT NULL`. The chain
-- can never actually return NULL for these four; only `capa_plan.source` makes
-- the event genuinely OPTIONAL. No other function among the 49 matched either
-- pattern. Reported, not fixed beyond the two named here.
--
-- Keystone (red-first): `supabase/tests/317_act_capa_audit_scope.sql` — confirmed
-- RED against the unfixed triggers for `capa.opened`/`capa.status_changed`
-- (manual-source) and `capa.effectiveness_recorded`, GREEN after; a CONTROL case
-- (event-sourced CAPA) proves the fallback does not disturb the already-working
-- commission-chain path.
create or replace function app.trg_audit_capa_plan()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_cols constant text[] := array['status', 'classification', 'source'];
  v_comm uuid;
  v_event uuid;
  v_org uuid;
  v_action text;
  v_summary text;
begin
  v_event := app.event_of_capa(new.id);
  v_comm := case when v_event is not null then app.commission_of_event(v_event) else null end;
  -- ACT/Rule 11 (BUG-CAPA-AUDIT-SCOPE-1): the event chain resolves a commission
  -- for 'event'/'rca'-sourced CAPAs only. For the other four sources, fall back
  -- to the CAPA's own hospital_id (NOT NULL) rather than leaving the row
  -- unscoped. Harmless to also compute when v_comm IS set: audit_write derives
  -- org+hospital FROM the commission in that case and ignores these.
  v_org := app.org_of_hospital(new.hospital_id);

  if tg_op = 'INSERT' then
    perform app.audit_write('capa.opened', 'capa_plan', new.id, v_comm,
      'Plano de ação ' || new.code || ' aberto',
      app.audit_diff(null, to_jsonb(new), v_cols),
      v_org, new.hospital_id);
    return null;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'completed' then
      v_action := 'capa.closed';
      v_summary := 'Plano de ação ' || new.code || ' encerrado';
    elsif new.status = 'cancelled' then
      v_action := 'capa.cancelled';
      v_summary := 'Plano de ação ' || new.code || ' cancelado';
    elsif old.status = 'completed' and new.status = 'in_execution' then
      v_action := 'capa.reopened';
      v_summary := 'Plano de ação ' || new.code || ' reaberto';
    else
      v_action := 'capa.status_changed';
      v_summary := 'Plano de ação ' || new.code || ': ' || old.status || ' → ' || new.status;
    end if;
    perform app.audit_write(v_action, 'capa_plan', new.id, v_comm,
      v_summary, app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols),
      v_org, new.hospital_id);
  end if;
  return null;
end;
$function$;

create or replace function app.trg_audit_capa_effectiveness()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_event uuid;
  v_comm uuid;
  v_code text;
  v_hospital uuid;
  v_org uuid;
begin
  v_event := app.event_of_capa(new.capa_id);
  v_comm := case when v_event is not null then app.commission_of_event(v_event) else null end;
  -- ACT/Rule 11 (BUG-CAPA-AUDIT-SCOPE-1): same fallback as trg_audit_capa_plan.
  -- capa_effectiveness.capa_id is NOT NULL with an FK to capa_plan(id) ON DELETE
  -- CASCADE, so this SELECT always finds the parent row, and capa_plan.hospital_id
  -- is itself NOT NULL -- v_hospital cannot be null here.
  select code, hospital_id into v_code, v_hospital from public.capa_plan where id = new.capa_id;
  v_org := app.org_of_hospital(v_hospital);
  perform app.audit_write('capa.effectiveness_recorded', 'capa_plan', new.capa_id, v_comm,
    'Eficácia do plano ' || coalesce(v_code, '') || ' verificada: ' || new.verdict,
    jsonb_build_object('verdict', jsonb_build_object('old', null, 'new', new.verdict)),
    v_org, v_hospital);
  return null;
end;
$function$;
