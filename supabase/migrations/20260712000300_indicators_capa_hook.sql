-- =============================================================================
-- Phase 15 — Quality Indicators · task B6  (two-tier CAPA hook + flag flip)
--
-- CAPA WRITE stays PQS-operator-gated (can_write_capa UNTOUCHED — the WS-3c
-- hardened posture). This migration only:
--   1. gives the FK-less forward hooks capa_plan.source_indicator_id +
--      capa_measure.indicator_id real FKs to public.indicators;
--   2. moves 'indicator' into open_capa_plan's DERIVABLE branch — hospital_id is
--      derived from the indicator's commission (no manual p_hospital_id for this
--      source; the PQS-operator authority check is unchanged);
--   3. adds an indicator arm to can_read_capa so the indicator's COMMISSION
--      MEMBERS can read the resulting plan (mirror of the event-source
--      reporting-committee rule);
--   4. flips the quality_indicators flag ON (the Phase-15 ship state).
--
-- Plan §4 · ADR 0057 dec. 4. Additive, forward-only.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Real FKs on the forward hooks. ON DELETE SET NULL — an indicator delete
--     must NOT cascade-destroy a CAPA plan/measure (the improvement record
--     outlives the metric).
-- -----------------------------------------------------------------------------
alter table public.capa_plan
  add constraint capa_plan_source_indicator_id_fkey
  foreign key (source_indicator_id) references public.indicators(id) on delete set null;

alter table public.capa_measure
  add constraint capa_measure_indicator_id_fkey
  foreign key (indicator_id) references public.indicators(id) on delete set null;

comment on column public.capa_plan.source_indicator_id is
  'FK → public.indicators (Phase 15). The indicator an indicator-sourced CAPA was '
  'opened from; ON DELETE SET NULL (the plan outlives the metric).';
comment on column public.capa_measure.indicator_id is
  'FK → public.indicators (Phase 15). Links a CAPA effectiveness measure to a '
  'quality indicator so a later measurement can close the improvement loop.';

-- -----------------------------------------------------------------------------
-- 2 · open_capa_plan: move 'indicator' into the derivable branch (hospital from
--     the indicator's commission). Only the v_hospital CASE gains one arm; the
--     authority check and everything else are BYTE-FOR-BYTE the live body.
-- -----------------------------------------------------------------------------
create or replace function public.open_capa_plan(
  p_source text, p_classification text default 'corretiva', p_source_id uuid default null,
  p_hospital_id uuid default null)
  returns capa_plan language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_plan public.capa_plan;
  v_attempts int := 0;
  v_rca uuid;
  v_event uuid;
  v_meeting uuid;
  v_indicator uuid;
  v_audit uuid;
  v_hospital uuid;
  v_op_hospitals uuid[];
begin
  perform app.assert_patient_safety_enabled();

  if p_source not in ('rca', 'event', 'indicator', 'audit_finding', 'meeting', 'manual') then
    raise exception 'origem de plano inválida' using errcode = 'check_violation';
  end if;
  if coalesce(p_classification, 'corretiva') not in ('corretiva', 'preventiva', 'melhoria') then
    raise exception 'classificação inválida' using errcode = 'check_violation';
  end if;

  if p_source = 'manual' then
    if p_source_id is not null then
      raise exception 'um plano manual não tem origem vinculada' using errcode = 'check_violation';
    end if;
  elsif p_source_id is null then
    raise exception 'informe a origem do plano de ação' using errcode = 'check_violation';
  else
    case p_source
      when 'rca' then v_rca := p_source_id;
      when 'event' then v_event := p_source_id;
      when 'meeting' then v_meeting := p_source_id;
      when 'indicator' then v_indicator := p_source_id;
      when 'audit_finding' then v_audit := p_source_id;
    end case;
  end if;

  -- Resolve the CAPA's hospital. NEW: 'indicator' derives from the indicator's
  -- commission (Phase 15) — no manual p_hospital_id for this source.
  v_hospital := case
    when p_source = 'event'     then app.hospital_of_event(v_event)
    when p_source = 'rca'       then app.hospital_of_event(app.event_of_rca(v_rca))
    when p_source = 'meeting'   then app.hospital_of_commission(app.commission_of_meeting(v_meeting))
    when p_source = 'indicator' then app.hospital_of_commission(
                                       (select commission_id from public.indicators where id = v_indicator))
    else null  -- manual / audit_finding: not derivable from a parent.
  end;

  if v_hospital is null then
    -- Non-derivable source: use the supplied hospital, or auto-derive when the caller
    -- is a PQS operator of exactly one hospital, else HC083.
    if p_hospital_id is not null then
      v_hospital := p_hospital_id;
    else
      -- Hospitals the caller is a PQS OPERATOR of (enrolled member ∪ coordinator),
      -- filtered by is_pqs_operator_of so it is a hospital they can actually operate.
      select array_agg(distinct h) into v_op_hospitals
      from (
        select hospital_id as h from public.pqs_members where user_id = auth.uid()
        union
        select hospital_id from public.organization_members
        where user_id = auth.uid() and role = 'nsp_coordinator' and hospital_id is not null
      ) s
      where app.is_pqs_operator_of(h);

      if array_length(v_op_hospitals, 1) = 1 then
        v_hospital := v_op_hospitals[1];
      else
        raise exception 'informe o hospital do plano de ação' using errcode = 'HC083';
      end if;
    end if;
  end if;

  -- Authority: a PQS operator of the resolved hospital (uniform across all sources).
  if v_hospital is null or not app.is_pqs_operator_of(v_hospital) then
    raise exception 'apenas o NSP pode abrir planos de ação' using errcode = '42501';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  loop
    begin
      insert into public.capa_plan (
        source, source_rca_id, source_event_id, source_meeting_id,
        source_indicator_id, source_audit_finding_id, classification, opened_by, hospital_id
      ) values (
        p_source, v_rca, v_event, v_meeting, v_indicator, v_audit,
        coalesce(p_classification, 'corretiva'), auth.uid(), v_hospital
      )
      returning * into v_plan;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts >= 5 then raise; end if;
    end;
  end loop;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_plan;
end;
$function$;
alter function public.open_capa_plan(text, text, uuid, uuid) owner to postgres;

-- t19 grant hygiene (CREATE OR REPLACE resets grants to PUBLIC-executable).
revoke all on function public.open_capa_plan(text, text, uuid, uuid) from public;
grant execute on function public.open_capa_plan(text, text, uuid, uuid)
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3 · can_read_capa: add the INDICATOR arm. The indicator's commission members
--     read an indicator-sourced plan (mirror of the event reporting-committee
--     rule). Uses the uid-pure app.is_member_of_for. The first two arms are
--     BYTE-FOR-BYTE the live body.
-- -----------------------------------------------------------------------------
create or replace function app.can_read_capa(p_capa_id uuid, p_user_id uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select
    app.is_pqs_operator_of_for(
      (select hospital_id from public.capa_plan where id = p_capa_id), p_user_id)
    or app.can_read_event(app.event_of_capa(p_capa_id), p_user_id)
    or exists (
      -- Phase 15: an indicator-sourced plan is readable by the indicator's
      -- commission members (the two-tier escalation read arm).
      select 1
      from public.capa_plan cp
      join public.indicators i on i.id = cp.source_indicator_id
      where cp.id = p_capa_id and cp.source = 'indicator'
        and app.is_member_of_for(i.commission_id, p_user_id)
    );
$function$;
alter function app.can_read_capa(uuid, uuid) owner to postgres;
comment on function app.can_read_capa(uuid, uuid) is
  'A CAPA is readable by a PQS operator of its hospital, OR via broad event-custody '
  'read for an event-sourced case, OR (Phase 15) by the indicator''s commission '
  'members for an indicator-sourced plan (the two-tier escalation read arm).';

-- -----------------------------------------------------------------------------
-- 4 · Flip the quality_indicators flag ON — the Phase-15 ship state (mirror of
--     the …090008 flag-flip pattern). CRUD + compute + reads + the CAPA hook are
--     all live now.
-- -----------------------------------------------------------------------------
update app.feature_flags set enabled = true where key = 'quality_indicators';
