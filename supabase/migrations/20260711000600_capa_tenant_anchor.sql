-- =============================================================================
-- WS-3c · D4/H-8 + P8 — CAPA tenant anchor
-- =============================================================================
-- Pre-pilot DB hardening. This is the one §5 item that is a genuinely REACHABLE
-- cross-tenant WRITE hole — treated as security. Detail:
--   docs/plans/pre-pilot-db-hardening-program.md §1 WS-3 (D4/H-8 row);
--   docs/reviews/external-db-audit-2026-07-evaluation.md §3 (H-8);
--   docs/reviews/external-db-audit-2026-07-perf-datamodel-analysis.md §2 (D4, P8);
--   docs/decisions/0055-capa-tenant-anchor.md.
--
-- The hole (D4/H-8): capa_plan has no tenant anchor; can_write_capa's non-event branch
-- falls back to is_pqs_member_of_any, so a PQS member of hospital A can PATCH hospital
-- B's manual (source='manual') CAPA — and the SAME predicate gates capa_action /
-- capa_action_task / capa_action_evidence / capa_effectiveness / capa_measure /
-- capa_measure_result, so the blast radius is the whole non-event CAPA action tree.
-- P8: mint_capa_code serializes EVERY hospital on the literal lock 'pqs:capa_code' with
-- an unfiltered MAX scan.
--
-- Fix: anchor every CAPA to a hospital (NOT NULL), collapse can_write_capa to a single
-- hospital-scoped predicate over that column, make the code sequence + lock per-hospital
-- (mirroring mint_event_code / EV-####), and flip the code UNIQUE to (hospital_id, code).
--
-- Reset-OK (pre-launch): add-nullable -> backfill -> set-NOT-NULL (WS-3a pattern).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · capa_plan.hospital_id (NOT NULL) + per-hospital code uniqueness.
-- -----------------------------------------------------------------------------
alter table public.capa_plan
  add column hospital_id uuid references public.hospitals(id) on delete restrict;

-- Backfill from each CAPA's source. Event/rca -> hospital_of_event; meeting ->
-- hospital_of_commission(commission_of_meeting). manual/indicator/audit_finding have no
-- derivable parent — pre-launch there are none besides the seed's single rca CAPA, so
-- this resolves everything; the NOT NULL below would fail loudly on any unresolved row.
update public.capa_plan p set hospital_id = case
  when p.source = 'event' then app.hospital_of_event(p.source_event_id)
  when p.source = 'rca'   then app.hospital_of_event(app.event_of_rca(p.source_rca_id))
  when p.source = 'meeting' then app.hospital_of_commission(app.commission_of_meeting(p.source_meeting_id))
  else null
end
where p.hospital_id is null;

alter table public.capa_plan
  alter column hospital_id set not null;

-- Must-check (per-hospital numbering): the code UNIQUE must be per-hospital, else two
-- hospitals both minting CAPA-0001 collide against the global unique. Flip it.
alter table public.capa_plan drop constraint capa_plan_code_key;
alter table public.capa_plan
  add constraint capa_plan_hospital_code_key unique (hospital_id, code);

create index if not exists capa_plan_hospital_idx on public.capa_plan (hospital_id);

-- BEFORE INSERT derive trigger (mirrors WS-3a derive_answer_version): when hospital_id
-- is not supplied, fill it from the source for the DERIVABLE kinds (event/rca/meeting).
-- This makes hospital_id robust for ANY insert path (open_capa_plan sets it explicitly;
-- a direct insert — seed, tests, a future forgetful RPC — gets it auto-derived), and
-- keeps a manual/indicator/audit_finding direct-insert with no hospital failing the
-- NOT NULL loudly (those MUST specify a hospital, e.g. via open_capa_plan's HC083 path).
-- Runs before mint_capa_code (name order) so the code is minted against the derived id.
create or replace function app.derive_capa_hospital() returns trigger
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  if new.hospital_id is null then
    new.hospital_id := case
      when new.source = 'event'   then app.hospital_of_event(new.source_event_id)
      when new.source = 'rca'     then app.hospital_of_event(app.event_of_rca(new.source_rca_id))
      when new.source = 'meeting' then app.hospital_of_commission(app.commission_of_meeting(new.source_meeting_id))
      else null  -- non-derivable: NOT NULL will reject if still unset (must be supplied).
    end;
  end if;
  return new;
end;
$function$;
alter function app.derive_capa_hospital() owner to postgres;
comment on function app.derive_capa_hospital() is
  'WS-3c D4/H-8: BEFORE INSERT on capa_plan — auto-fill hospital_id from the source '
  '(event/rca/meeting) when not supplied, so the tenant anchor is robust across all '
  'insert paths. Non-derivable sources must supply it (NOT NULL rejects otherwise).';

-- Name sorts before mint_capa_code so hospital_id is set before the code is minted.
drop trigger if exists derive_capa_hospital_trg on public.capa_plan;
create trigger derive_capa_hospital_trg
  before insert on public.capa_plan
  for each row execute function app.derive_capa_hospital();

comment on column public.capa_plan.hospital_id is
  'WS-3c D4/H-8: the CAPA''s tenant anchor (NOT NULL). Derived server-side from the '
  'source (event/rca/meeting) or supplied for a manual CAPA. Gates every CAPA-tree '
  'write via can_write_capa = is_pqs_operator_of(hospital_id). Code is per-hospital.';

-- -----------------------------------------------------------------------------
-- 2 · Collapse can_write_capa to the single hospital-scoped predicate.
-- -----------------------------------------------------------------------------
-- hospital_id is now authoritative. For an EVENT-sourced CAPA, hospital_id =
-- hospital_of_event(event), so the collapsed predicate EQUALS the old event branch
-- (provably equivalent — the 196 event-path positive control confirms it). For a
-- non-event CAPA it replaces the leaky is_pqs_member_of_any with the proper scope.
create or replace function app.can_write_capa(p_capa_id uuid, p_uid uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.is_pqs_operator_of_for(
    (select hospital_id from public.capa_plan where id = p_capa_id), p_uid);
$function$;
alter function app.can_write_capa(uuid, uuid) owner to postgres;
comment on function app.can_write_capa(uuid, uuid) is
  'WS-3c D4/H-8: a CAPA (and its whole action tree) is writable only by a PQS operator '
  'of the CAPA''s hospital. Collapsed from the old event/non-event branch — the '
  'non-event branch''s is_pqs_member_of_any was the reachable cross-hospital write hole.';

-- can_read_capa: resolve via the CAPA's hospital_id too. The OLD definition resolved
-- ONLY via event_of_capa -> hospital_of_event, so a MANUAL (or indicator/audit/meeting)
-- CAPA — which has no event — was invisible to EVERYONE, including its own hospital's
-- operator. Now: a PQS operator of the CAPA's hospital may read it (works for every
-- source), OR the broad event-custody read for the event-sourced case (preserved so a
-- non-operator case-worker with event access keeps their existing read).
create or replace function app.can_read_capa(p_capa_id uuid, p_user_id uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select
    app.is_pqs_operator_of_for(
      (select hospital_id from public.capa_plan where id = p_capa_id), p_user_id)
    or app.can_read_event(app.event_of_capa(p_capa_id), p_user_id);
$function$;
alter function app.can_read_capa(uuid, uuid) owner to postgres;
comment on function app.can_read_capa(uuid, uuid) is
  'WS-3c D4/H-8: a CAPA is readable by a PQS operator of its hospital_id (works for '
  'manual/indicator/audit/meeting CAPAs — the old event-only resolution left those '
  'invisible), OR via broad event-custody read for the event-sourced case (preserved).';

-- -----------------------------------------------------------------------------
-- 3 · mint_capa_code: per-hospital lock + per-hospital MAX (closes P8). Mirrors
--     mint_event_code. Keeps the CAPA-#### format (per-hospital-numbered, not prefixed).
-- -----------------------------------------------------------------------------
create or replace function app.mint_capa_code() returns trigger
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_next integer;
begin
  -- Per-hospital advisory lock so two hospitals mint concurrently without serializing.
  perform pg_advisory_xact_lock(
    hashtextextended('pqs:capa_code:' || coalesce(new.hospital_id::text, ''), 0));

  -- Highest existing CAPA-#### suffix + 1, FILTERED to this hospital (so a hospital
  -- cannot infer another's CAPA volume from gaps, and codes never collide per-hospital).
  v_next := coalesce(
    (select max((substring(code from 6))::integer)
     from public.capa_plan
     where code ~ '^CAPA-[0-9]+$' and hospital_id = new.hospital_id),
    0
  ) + 1;

  new.code := 'CAPA-' || lpad(v_next::text, 4, '0');
  return new;
end;
$function$;
alter function app.mint_capa_code() owner to postgres;

-- -----------------------------------------------------------------------------
-- 4 · open_capa_plan: derive/supply hospital_id + hospital-scoped authority.
-- -----------------------------------------------------------------------------
-- Adds p_hospital_id (DEFAULT NULL) for non-derivable sources. For derivable sources
-- (event/rca/meeting) the hospital is derived server-side and p_hospital_id is IGNORED
-- (a caller cannot misattribute an event-CAPA). For manual/indicator/audit_finding:
-- use p_hospital_id if supplied; else AUTO-DERIVE when the caller is a PQS operator of
-- exactly ONE hospital; else raise HC083. Authority = is_pqs_operator_of(the resolved
-- hospital) uniformly (replaces the old is_pqs_member_of_any else-branch).
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

  -- Resolve the CAPA's hospital.
  v_hospital := case
    when p_source = 'event'   then app.hospital_of_event(v_event)
    when p_source = 'rca'     then app.hospital_of_event(app.event_of_rca(v_rca))
    when p_source = 'meeting' then app.hospital_of_commission(app.commission_of_meeting(v_meeting))
    else null  -- manual / indicator / audit_finding: not derivable from a parent.
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

-- Drop the old 3-arg signature (open_capa_plan GAINED a param -> CREATE OR REPLACE made
-- a NEW overload; the old one, with the leaky is_pqs_member_of_any authority, would stay
-- callable). The FE call (p_source/p_classification/p_source_id) still resolves to the
-- new 4-arg via the p_hospital_id default.
drop function if exists public.open_capa_plan(text, text, uuid);

-- -----------------------------------------------------------------------------
-- 5 · t19 grant hygiene: the recreated / new-signature RPC resets grants to
--     PUBLIC-executable — re-assert authenticated/service_role-only.
-- -----------------------------------------------------------------------------
revoke all on function public.open_capa_plan(text, text, uuid, uuid) from public;
grant execute on function public.open_capa_plan(text, text, uuid, uuid) to authenticated, service_role;
revoke all on function app.can_write_capa(uuid, uuid) from public;
grant execute on function app.can_write_capa(uuid, uuid) to authenticated, service_role;
revoke all on function app.can_read_capa(uuid, uuid) from public;
grant execute on function app.can_read_capa(uuid, uuid) to authenticated, service_role;
