-- =============================================================================
-- WS-3b · D7 — dual-scope PQS vocab (pqs_event_types + pqs_sentinel_criteria)
-- =============================================================================
-- Pre-pilot DB hardening. Detail: docs/plans/pre-pilot-db-hardening-program.md §1 WS-3;
--   docs/reviews/external-db-audit-2026-07-perf-datamodel-analysis.md §2 (D7).
--
-- The gap: pqs_event_types / pqs_sentinel_criteria are PLATFORM-GLOBAL (UNIQUE(key),
-- UNIQUE(position)) yet their CRUD RPCs gate on is_pqs_member_of_any(auth.uid()) — so a
-- PQS member of ANY single hospital can rename/reorder the vocab EVERY hospital sees.
--
-- Fix (mirror the action_item_statuses dual-scope pattern, hospital-keyed): add a
-- nullable hospital_id (NULL = global, platform-managed), replace the global uniques
-- with partial uniques (global WHERE hospital_id IS NULL + per-hospital WHERE NOT NULL),
-- and re-gate the 8 CRUD RPCs: a GLOBAL row is is_admin()-only; a HOSPITAL row is
-- is_pqs_operator_of(hospital)-only. save_triage reads global ∪ the event's hospital.
--
-- ✋ Do NOT touch referral_types / reply_outcomes (is_admin()-gated super-admin vocab —
-- a different, non-bug). All existing/seeded rows default to GLOBAL (hospital_id NULL),
-- preserving current behavior.
-- Reset-OK (pre-launch): no back-compat data migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Schema: nullable hospital_id + dual-scope partial uniques.
-- -----------------------------------------------------------------------------
alter table public.pqs_event_types
  add column hospital_id uuid references public.hospitals(id) on delete cascade;
alter table public.pqs_sentinel_criteria
  add column hospital_id uuid references public.hospitals(id) on delete cascade;

-- Drop the GLOBAL uniques (key + position) — they conflate the two scopes.
alter table public.pqs_event_types drop constraint pqs_event_types_key_key;
alter table public.pqs_event_types drop constraint pqs_event_types_position_key;
alter table public.pqs_sentinel_criteria drop constraint pqs_sentinel_criteria_key_key;
alter table public.pqs_sentinel_criteria drop constraint pqs_sentinel_criteria_position_key;

-- Partial uniques: global scope (hospital_id IS NULL) and per-hospital scope.
-- key uniqueness:
create unique index pqs_event_types_global_key_uidx
  on public.pqs_event_types (key) where hospital_id is null;
create unique index pqs_event_types_hospital_key_uidx
  on public.pqs_event_types (hospital_id, key) where hospital_id is not null;
create unique index pqs_sentinel_criteria_global_key_uidx
  on public.pqs_sentinel_criteria (key) where hospital_id is null;
create unique index pqs_sentinel_criteria_hospital_key_uidx
  on public.pqs_sentinel_criteria (hospital_id, key) where hospital_id is not null;
-- position uniqueness (deferrable, mirroring the dropped ones so reorder's
-- negate-then-renumber still works within a scope):
create unique index pqs_event_types_global_pos_uidx
  on public.pqs_event_types (position) where hospital_id is null;
create unique index pqs_event_types_hospital_pos_uidx
  on public.pqs_event_types (hospital_id, position) where hospital_id is not null;
create unique index pqs_sentinel_criteria_global_pos_uidx
  on public.pqs_sentinel_criteria (position) where hospital_id is null;
create unique index pqs_sentinel_criteria_hospital_pos_uidx
  on public.pqs_sentinel_criteria (hospital_id, position) where hospital_id is not null;

-- Index the new scope column.
create index pqs_event_types_hospital_idx on public.pqs_event_types (hospital_id);
create index pqs_sentinel_criteria_hospital_idx on public.pqs_sentinel_criteria (hospital_id);

comment on column public.pqs_event_types.hospital_id is
  'WS-3b D7: NULL = platform-global vocab (is_admin-managed); set = a hospital''s own '
  'vocab (curated by that hospital''s PQS operator). Dual-scope partial uniques.';
comment on column public.pqs_sentinel_criteria.hospital_id is
  'WS-3b D7: NULL = platform-global vocab (is_admin-managed); set = a hospital''s own '
  'vocab (curated by that hospital''s PQS operator). Dual-scope partial uniques.';

-- -----------------------------------------------------------------------------
-- 2 · Shared scope-authority helper: may auth.uid() curate a vocab row of this scope?
--     GLOBAL (p_hospital_id NULL) -> platform admin only. HOSPITAL -> that hospital's
--     PQS operator (coordinator ∪ enrolled member).
-- -----------------------------------------------------------------------------
create or replace function app.can_curate_pqs_vocab(p_hospital_id uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select case
    when p_hospital_id is null then coalesce(app.is_admin(), false)
    else app.is_pqs_operator_of(p_hospital_id)
  end;
$$;
alter function app.can_curate_pqs_vocab(uuid) owner to postgres;
comment on function app.can_curate_pqs_vocab(uuid) is
  'WS-3b D7: vocab-curation authority — global rows (NULL) are is_admin-only; a '
  'hospital row is that hospital''s PQS operator only. Closes the any-hospital-member '
  'edits-global-vocab hole.';
revoke all on function app.can_curate_pqs_vocab(uuid) from public;
grant execute on function app.can_curate_pqs_vocab(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3 · Re-gate the 8 CRUD RPCs to the dual scope (+ p_hospital_id on create/reorder;
--     resolve the row's scope on update/archive). Positions + key uniqueness are now
--     per-scope, so max()/negate-renumber are scoped to the same hospital partition.
-- -----------------------------------------------------------------------------

-- DROP the old-arity signatures first — create_event_type/reorder_* GAIN a param, so
-- CREATE OR REPLACE makes a NEW overload rather than replacing; the old 3-arg/1-arg
-- versions (gated on the leaky is_pqs_member_of_any) would otherwise stay callable and
-- reopen the hole. update/archive keep their arity (CREATE OR REPLACE replaces them).
drop function if exists public.create_event_type(text, text, text);
drop function if exists public.reorder_event_types(uuid[]);
drop function if exists public.create_sentinel_criterion(text, text, text);
drop function if exists public.reorder_sentinel_criteria(uuid[]);

-- create_event_type(key, label, description, hospital_id=NULL)
create or replace function public.create_event_type(
  p_key text, p_label text, p_description text default null, p_hospital_id uuid default null)
  returns public.pqs_event_types language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_row public.pqs_event_types;
begin
  perform app.assert_patient_safety_enabled();
  if not app.can_curate_pqs_vocab(p_hospital_id) then
    raise exception 'apenas o NSP pode gerenciar tipos de evento' using errcode = '42501';
  end if;
  if btrim(coalesce(p_key, '')) = '' or btrim(coalesce(p_label, '')) = '' then
    raise exception 'informe um identificador e um rótulo' using errcode = 'check_violation';
  end if;
  insert into public.pqs_event_types (key, label, description, position, hospital_id)
  values (btrim(p_key), btrim(p_label), p_description,
          coalesce((select max(position) from public.pqs_event_types
                    where hospital_id is not distinct from p_hospital_id), 0) + 1,
          p_hospital_id)
  returning * into v_row;
  return v_row;
end;
$function$;
alter function public.create_event_type(text, text, text, uuid) owner to postgres;

-- update_event_type(id, label, description) — resolve the row's scope, gate on it.
create or replace function public.update_event_type(
  p_id uuid, p_label text, p_description text default null)
  returns public.pqs_event_types language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_row public.pqs_event_types;
  v_scope uuid;
  v_found boolean;
begin
  perform app.assert_patient_safety_enabled();
  select hospital_id into v_scope from public.pqs_event_types where id = p_id;
  get diagnostics v_found = row_count;
  if not v_found then
    raise exception 'tipo de evento não encontrado' using errcode = 'P0002';
  end if;
  if not app.can_curate_pqs_vocab(v_scope) then
    raise exception 'apenas o NSP pode gerenciar tipos de evento' using errcode = '42501';
  end if;
  if btrim(coalesce(p_label, '')) = '' then
    raise exception 'informe um rótulo' using errcode = 'check_violation';
  end if;
  update public.pqs_event_types
  set label = btrim(p_label), description = p_description, updated_at = now()
  where id = p_id
  returning * into v_row;
  return v_row;
end;
$function$;
alter function public.update_event_type(uuid, text, text) owner to postgres;

-- archive_event_type(id) — resolve scope, gate.
create or replace function public.archive_event_type(p_id uuid)
  returns public.pqs_event_types language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_row public.pqs_event_types;
  v_scope uuid;
  v_found boolean;
begin
  perform app.assert_patient_safety_enabled();
  select hospital_id into v_scope from public.pqs_event_types where id = p_id;
  get diagnostics v_found = row_count;
  if not v_found then
    raise exception 'tipo de evento não encontrado' using errcode = 'P0002';
  end if;
  if not app.can_curate_pqs_vocab(v_scope) then
    raise exception 'apenas o NSP pode gerenciar tipos de evento' using errcode = '42501';
  end if;
  update public.pqs_event_types
  set is_active = false, updated_at = now()
  where id = p_id
  returning * into v_row;
  return v_row;
end;
$function$;
alter function public.archive_event_type(uuid) owner to postgres;

-- reorder_event_types(ordered_ids, hospital_id=NULL) — scoped negate-then-renumber.
create or replace function public.reorder_event_types(
  p_ordered_ids uuid[], p_hospital_id uuid default null)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  perform app.assert_patient_safety_enabled();
  if not app.can_curate_pqs_vocab(p_hospital_id) then
    raise exception 'apenas o NSP pode gerenciar tipos de evento' using errcode = '42501';
  end if;
  -- All ids must belong to the named scope (no cross-scope reorder).
  if exists (
    select 1 from unnest(p_ordered_ids) as id
    left join public.pqs_event_types t on t.id = id
    where t.id is null or t.hospital_id is distinct from p_hospital_id
  ) then
    raise exception 'itens fora do escopo informado' using errcode = 'check_violation';
  end if;
  update public.pqs_event_types
  set position = -position
  where hospital_id is not distinct from p_hospital_id;
  update public.pqs_event_types t
  set position = ord.rn, updated_at = now()
  from (select id, row_number() over () as rn from unnest(p_ordered_ids) as id) ord
  where t.id = ord.id;
end;
$function$;
alter function public.reorder_event_types(uuid[], uuid) owner to postgres;

-- create_sentinel_criterion(key, label, description, hospital_id=NULL)
create or replace function public.create_sentinel_criterion(
  p_key text, p_label text, p_description text default null, p_hospital_id uuid default null)
  returns public.pqs_sentinel_criteria language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_row public.pqs_sentinel_criteria;
begin
  perform app.assert_patient_safety_enabled();
  if not app.can_curate_pqs_vocab(p_hospital_id) then
    raise exception 'apenas o NSP pode gerenciar critérios de evento sentinela' using errcode = '42501';
  end if;
  if btrim(coalesce(p_key, '')) = '' or btrim(coalesce(p_label, '')) = '' then
    raise exception 'informe um identificador e um rótulo' using errcode = 'check_violation';
  end if;
  insert into public.pqs_sentinel_criteria (key, label, description, position, hospital_id)
  values (btrim(p_key), btrim(p_label), p_description,
          coalesce((select max(position) from public.pqs_sentinel_criteria
                    where hospital_id is not distinct from p_hospital_id), 0) + 1,
          p_hospital_id)
  returning * into v_row;
  return v_row;
end;
$function$;
alter function public.create_sentinel_criterion(text, text, text, uuid) owner to postgres;

-- update_sentinel_criterion(id, label, description)
create or replace function public.update_sentinel_criterion(
  p_id uuid, p_label text, p_description text default null)
  returns public.pqs_sentinel_criteria language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_row public.pqs_sentinel_criteria;
  v_scope uuid;
  v_found boolean;
begin
  perform app.assert_patient_safety_enabled();
  select hospital_id into v_scope from public.pqs_sentinel_criteria where id = p_id;
  get diagnostics v_found = row_count;
  if not v_found then
    raise exception 'critério não encontrado' using errcode = 'P0002';
  end if;
  if not app.can_curate_pqs_vocab(v_scope) then
    raise exception 'apenas o NSP pode gerenciar critérios de evento sentinela' using errcode = '42501';
  end if;
  if btrim(coalesce(p_label, '')) = '' then
    raise exception 'informe um rótulo' using errcode = 'check_violation';
  end if;
  update public.pqs_sentinel_criteria
  set label = btrim(p_label), description = p_description, updated_at = now()
  where id = p_id
  returning * into v_row;
  return v_row;
end;
$function$;
alter function public.update_sentinel_criterion(uuid, text, text) owner to postgres;

-- archive_sentinel_criterion(id)
create or replace function public.archive_sentinel_criterion(p_id uuid)
  returns public.pqs_sentinel_criteria language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_row public.pqs_sentinel_criteria;
  v_scope uuid;
  v_found boolean;
begin
  perform app.assert_patient_safety_enabled();
  select hospital_id into v_scope from public.pqs_sentinel_criteria where id = p_id;
  get diagnostics v_found = row_count;
  if not v_found then
    raise exception 'critério não encontrado' using errcode = 'P0002';
  end if;
  if not app.can_curate_pqs_vocab(v_scope) then
    raise exception 'apenas o NSP pode gerenciar critérios de evento sentinela' using errcode = '42501';
  end if;
  update public.pqs_sentinel_criteria
  set is_active = false, updated_at = now()
  where id = p_id
  returning * into v_row;
  return v_row;
end;
$function$;
alter function public.archive_sentinel_criterion(uuid) owner to postgres;

-- reorder_sentinel_criteria(ordered_ids, hospital_id=NULL) — scoped.
create or replace function public.reorder_sentinel_criteria(
  p_ordered_ids uuid[], p_hospital_id uuid default null)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  perform app.assert_patient_safety_enabled();
  if not app.can_curate_pqs_vocab(p_hospital_id) then
    raise exception 'apenas o NSP pode gerenciar critérios de evento sentinela' using errcode = '42501';
  end if;
  if exists (
    select 1 from unnest(p_ordered_ids) as id
    left join public.pqs_sentinel_criteria t on t.id = id
    where t.id is null or t.hospital_id is distinct from p_hospital_id
  ) then
    raise exception 'itens fora do escopo informado' using errcode = 'check_violation';
  end if;
  update public.pqs_sentinel_criteria
  set position = -position
  where hospital_id is not distinct from p_hospital_id;
  update public.pqs_sentinel_criteria t
  set position = ord.rn, updated_at = now()
  from (select id, row_number() over () as rn from unnest(p_ordered_ids) as id) ord
  where t.id = ord.id;
end;
$function$;
alter function public.reorder_sentinel_criteria(uuid[], uuid) owner to postgres;

-- -----------------------------------------------------------------------------
-- 4 · save_triage: read sentinel criteria from global ∪ the event's hospital only
--     (a cross-hospital criterion id is silently ignored, not flagged).
-- -----------------------------------------------------------------------------
-- VERBATIM from 20260710000000_nsp_per_hospital.sql:687 — the ONLY changes are the added
-- `v_hospital` local (set once) and the sentinel-criteria SELECT's scope filter. Every
-- other line (PSE-closure logic, reach/harm normalization, compute_sentinel_determination,
-- the event_triage column list) is preserved exactly.
create or replace function public.save_triage(p_event_id uuid, p_is_pse boolean DEFAULT NULL::boolean, p_pse_closure_reason text DEFAULT NULL::text, p_reach text DEFAULT NULL::text, p_harm_severity text DEFAULT NULL::text, p_natural_course boolean DEFAULT NULL::boolean, p_review_pathway text DEFAULT NULL::text, p_disposition_notes_md text DEFAULT NULL::text, p_sentinel_criteria_ids uuid[] DEFAULT '{}'::uuid[])
returns event_triage
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_triage public.event_triage;
  v_reach text := p_reach;
  v_harm text := p_harm_severity;
  v_natural boolean := p_natural_course;
  v_has_designated boolean := coalesce(array_length(p_sentinel_criteria_ids, 1), 0) > 0;
  v_sentinel boolean;
  v_hospital uuid;  -- WS-3b D7: the event's hospital, for the vocab-scope filter below.
begin
  perform app.assert_patient_safety_enabled();

  if not app.can_read_event(p_event_id, auth.uid()) then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;
  -- Triage is an NSP activity (per-hospital operator).
  v_hospital := app.hospital_of_event(p_event_id);
  if not app.is_pqs_operator_of(v_hospital) then
    raise exception 'apenas o NSP pode triar eventos' using errcode = '42501';
  end if;

  if (select status from public.patient_safety_event where id = p_event_id) <> 'acknowledged' then
    raise exception 'o evento precisa estar reconhecido pelo NSP para ser triado'
      using errcode = 'HC045';
  end if;

  if v_reach is not null and v_reach not in ('unsafe', 'near_miss', 'no_harm', 'adverse', 'sentinel') then
    raise exception 'alcance inválido' using errcode = 'HC046';
  end if;
  if v_harm is not null and v_harm not in ('none', 'mild', 'moderate', 'severe', 'permanent', 'death') then
    raise exception 'gravidade de dano inválida' using errcode = 'HC046';
  end if;
  if p_review_pathway is not null
     and p_review_pathway not in ('rca', 'peer_review', 'mm', 'fmea', 'tracking_only') then
    raise exception 'desfecho inválido' using errcode = 'HC046';
  end if;

  if p_is_pse is false then
    if p_pse_closure_reason is null
       or p_pse_closure_reason not in ('natural', 'expected', 'nonclinical', 'duplicate') then
      raise exception 'selecione o motivo de encerramento (não é evento de segurança)'
        using errcode = 'HC046';
    end if;
    v_reach := null;
    v_harm := null;
    v_natural := null;
    v_has_designated := false;
    p_sentinel_criteria_ids := '{}';
  end if;

  if coalesce(p_is_pse, true) and v_reach is not null then
    if v_reach in ('unsafe', 'near_miss', 'no_harm') then
      v_harm := 'none';
      v_natural := null;
    elsif v_reach = 'sentinel' then
      if v_harm is null or v_harm in ('none', 'mild', 'moderate') then
        v_harm := 'severe';
      end if;
    end if;
  end if;

  v_sentinel := app.compute_sentinel_determination(v_reach, v_harm, v_natural, v_has_designated);

  perform set_config('app.in_safety_rpc', 'on', true);

  insert into public.event_triage (
    event_id, is_pse, pse_closure_reason, reach, harm_severity, natural_course,
    sentinel_determination, review_pathway, disposition_notes_md, updated_at
  ) values (
    p_event_id, p_is_pse,
    case when p_is_pse is false then p_pse_closure_reason else null end,
    v_reach, v_harm, v_natural, v_sentinel, p_review_pathway, p_disposition_notes_md, now()
  )
  on conflict (event_id) do update
  set is_pse = excluded.is_pse,
      pse_closure_reason = excluded.pse_closure_reason,
      reach = excluded.reach,
      harm_severity = excluded.harm_severity,
      natural_course = excluded.natural_course,
      sentinel_determination = excluded.sentinel_determination,
      review_pathway = excluded.review_pathway,
      disposition_notes_md = excluded.disposition_notes_md,
      updated_at = now()
  returning * into v_triage;

  delete from public.event_triage_sentinel_flags where event_id = p_event_id;
  if v_has_designated then
    insert into public.event_triage_sentinel_flags (event_id, criteria_id, criteria_key, criteria_label)
    select p_event_id, c.id, c.key, c.label
    from public.pqs_sentinel_criteria c
    where c.id = any (p_sentinel_criteria_ids)
      -- WS-3b D7: only global ∪ the event's-hospital criteria are flaggable.
      and (c.hospital_id is null or c.hospital_id = v_hospital);
  end if;

  perform set_config('app.in_safety_rpc', 'off', true);
  return v_triage;
end;
$function$;
alter function public.save_triage(uuid, boolean, text, text, text, boolean, text, text, uuid[]) owner to postgres;

-- -----------------------------------------------------------------------------
-- 5 · t19 grant hygiene: CREATE OR REPLACE / new-signature RPCs reset grants to
--     PUBLIC-executable — re-assert authenticated/service_role-only. The old-arity
--     create_event_type/reorder_* signatures no longer exist (widened), so nothing to
--     revoke there; grant the new signatures.
-- -----------------------------------------------------------------------------
revoke all on function public.create_event_type(text, text, text, uuid) from public;
revoke all on function public.update_event_type(uuid, text, text) from public;
revoke all on function public.archive_event_type(uuid) from public;
revoke all on function public.reorder_event_types(uuid[], uuid) from public;
revoke all on function public.create_sentinel_criterion(text, text, text, uuid) from public;
revoke all on function public.update_sentinel_criterion(uuid, text, text) from public;
revoke all on function public.archive_sentinel_criterion(uuid) from public;
revoke all on function public.reorder_sentinel_criteria(uuid[], uuid) from public;
revoke all on function public.save_triage(uuid, boolean, text, text, text, boolean, text, text, uuid[]) from public;
grant execute on function public.create_event_type(text, text, text, uuid) to authenticated, service_role;
grant execute on function public.update_event_type(uuid, text, text) to authenticated, service_role;
grant execute on function public.archive_event_type(uuid) to authenticated, service_role;
grant execute on function public.reorder_event_types(uuid[], uuid) to authenticated, service_role;
grant execute on function public.create_sentinel_criterion(text, text, text, uuid) to authenticated, service_role;
grant execute on function public.update_sentinel_criterion(uuid, text, text) to authenticated, service_role;
grant execute on function public.archive_sentinel_criterion(uuid) to authenticated, service_role;
grant execute on function public.reorder_sentinel_criteria(uuid[], uuid) to authenticated, service_role;
grant execute on function public.save_triage(uuid, boolean, text, text, text, boolean, text, text, uuid[]) to authenticated, service_role;
