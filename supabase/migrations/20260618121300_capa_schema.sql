-- Phase 14d / B1: Patient-Safety / NSP — CAPA schema (Corrective Action Plan,
-- Effectiveness & Closure). ADR 0030 umbrella; the 14d backend decision in ADR 0034.
-- The FINAL Phase-14 sub-phase: it closes the PDCA/CAPA loop a finding drives.
--
-- capa_plan is the REUSABLE PRIMITIVE Phases 15/18 also reach (the `source`
-- polymorphism): a plan is opened FROM an RCA root cause, a safety event, a meeting,
-- (Phase-15) an indicator, (Phase-18) an audit finding, or manually. capa_action.
-- root_cause_id FKs the stable public.rca_root_causes(id) PK delivered in 14c.
--
-- This migration lands:
--   * public.capa_plan — source polymorphism (6 nullable source cols + the
--     exactly-one CHECK; real FKs for rca/event/meeting, FK-LESS forward hooks for
--     indicator [Phase 15] / audit_finding [Phase 18], like 14a's event_type_id),
--     per-NSP minted code, classification, lifecycle, lessons_learned_md.
--   * the 6 child tables: capa_action (owner free-text + assignee_user_id split),
--     capa_action_task, capa_action_evidence, capa_measure (indicator_id FK-less hook),
--     capa_measure_result, capa_effectiveness (1:1).
--   * app.event_of_capa / app.can_read_capa — RLS resolvers (event/rca-sourced →
--     can_read_event scope; else PQS/admin).
--   * app.mint_capa_code — per-NSP CAPA-%04d (advisory-lock copy of mint_event_code).
--   * app.guard_capa_status / app.guard_capa_child_lock — state machine + freeze,
--     reusing the app.in_safety_rpc GUC (mirror guard_rca_*).
--   * app.advance_capa_action_core — the assignee-OR-PQS narrow advance path (mirror
--     app.advance_action_item_core; → HC050).
--   * app.event_capa_fully_settled — the close→event-closure predicate.
--
-- The RLS + the CAPA-scoped nsp-evidence object policies land in B2 (…121301); the
-- RPCs + audit trigger in B3 (…121302). No flag flip — patient_safety is already ON
-- (14a's umbrella flag covers 14a–14d; it supersedes the once-reserved `capa` flag).
--
-- New SQLSTATEs (ADR 0030 reserved HC043–HC053 for Phase 14; 14d takes the LAST five,
-- consuming the range): HC049 wrong CAPA state / frozen; HC050 advance not entitled
-- (assignee-or-PQS); HC051 close — unsettled actions; HC052 close — no effectiveness
-- verdict; HC053 cancel — already terminal.

-- ===========================================================================
-- public.capa_plan — the reusable CAPA primitive (source polymorphism)
-- ===========================================================================
-- `code` is a PER-NSP minted human reference (CAPA-0001…), set by the BEFORE INSERT
-- trigger (the insert omits it), backstopped by unique(code); open_capa_plan wraps the
-- insert in a one-shot unique_violation retry (mirror notify_safety_event).
-- lessons_learned_md is SANITIZED Markdown (Rule 7); written at closure; NEVER audited.
--
-- Source polymorphism: exactly one source column matches `source` (the CHECK). REAL
-- FKs now: source_rca_id / source_event_id / source_meeting_id (on delete set null —
-- a CAPA is an enduring record, never orphan-deleted with its source). FK-LESS forward
-- hooks (their target tables land later, exactly like 14a's event_type_id):
-- source_indicator_id (Phase 15 — public.indicators), source_audit_finding_id
-- (Phase 18 — public.audit_findings). `manual` → all six null.
create table public.capa_plan (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  source text not null
    check (source in ('rca', 'event', 'indicator', 'audit_finding', 'meeting', 'manual')),
  source_rca_id uuid references public.rca (id) on delete set null,
  source_event_id uuid references public.patient_safety_event (id) on delete set null,
  source_meeting_id uuid references public.meetings (id) on delete set null,
  -- FK-LESS forward hooks (FK added in Phase 15 / 18):
  source_indicator_id uuid,
  source_audit_finding_id uuid,
  classification text not null default 'corretiva'
    check (classification in ('corretiva', 'preventiva', 'melhoria')),
  status text not null default 'aberto'
    check (status in ('aberto', 'em_execucao', 'em_verificacao', 'concluido', 'cancelado')),
  lessons_learned_md text,
  opened_by uuid references public.profiles (id),
  closed_by uuid references public.profiles (id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint capa_plan_code_key unique (code),
  -- Exactly one source column matches `source` (and the others are null).
  constraint capa_plan_source_shape check (
    (source = 'rca'
       and source_rca_id is not null and source_event_id is null and source_meeting_id is null
       and source_indicator_id is null and source_audit_finding_id is null)
    or (source = 'event'
       and source_event_id is not null and source_rca_id is null and source_meeting_id is null
       and source_indicator_id is null and source_audit_finding_id is null)
    or (source = 'meeting'
       and source_meeting_id is not null and source_rca_id is null and source_event_id is null
       and source_indicator_id is null and source_audit_finding_id is null)
    or (source = 'indicator'
       and source_indicator_id is not null and source_rca_id is null and source_event_id is null
       and source_meeting_id is null and source_audit_finding_id is null)
    or (source = 'audit_finding'
       and source_audit_finding_id is not null and source_rca_id is null and source_event_id is null
       and source_meeting_id is null and source_indicator_id is null)
    or (source = 'manual'
       and source_rca_id is null and source_event_id is null and source_meeting_id is null
       and source_indicator_id is null and source_audit_finding_id is null)
  )
);

alter table public.capa_plan enable row level security;

create index capa_plan_source_event_idx on public.capa_plan (source_event_id);
create index capa_plan_source_rca_idx on public.capa_plan (source_rca_id);
create index capa_plan_status_idx on public.capa_plan (status);

comment on table public.capa_plan is
  'The reusable CAPA primitive (Phase 14d; ADR 0034). source polymorphism: rca/event/'
  'meeting have real FKs; indicator (Phase 15) / audit_finding (Phase 18) are FK-less '
  'forward hooks. lessons_learned_md is sanitized Markdown — NEVER audited (Rule 11).';
comment on column public.capa_plan.source_indicator_id is
  'FK-LESS forward hook (Phase 15 — public.indicators). Add the FK then (cf. 14a event_type_id).';
comment on column public.capa_plan.source_audit_finding_id is
  'FK-LESS forward hook (Phase 18 — public.audit_findings). Add the FK then.';

-- ===========================================================================
-- public.capa_action — corrective actions (owner free-text + assignee_user_id split)
-- ===========================================================================
-- `owner` is the DISPLAYED free-text responsible party (README "owner"); assignee_user_id
-- is the platform user the NARROW advance gate keys on (nullable). root_cause_id FKs the
-- 14c rca_root_causes(id) PK (the structured causal link). action_strength is the fixed
-- JC hierarchy.
create table public.capa_action (
  id uuid primary key default gen_random_uuid(),
  capa_id uuid not null references public.capa_plan (id) on delete cascade,
  title text not null,
  owner text,
  assignee_user_id uuid references public.profiles (id) on delete set null,
  due_date date,
  action_strength text not null default 'intermediaria'
    check (action_strength in ('forte', 'intermediaria', 'fraca')),
  success_measure text,
  root_cause_id uuid references public.rca_root_causes (id) on delete set null,
  status text not null default 'pendente'
    check (status in ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  position integer not null,
  completed_at timestamptz,
  completed_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint capa_action_title_not_blank check (btrim(title) <> ''),
  constraint capa_action_position_key unique (capa_id, position) deferrable initially immediate
);

alter table public.capa_action enable row level security;

create index capa_action_capa_idx on public.capa_action (capa_id, position);
create index capa_action_assignee_idx on public.capa_action (assignee_user_id);
create index capa_action_root_cause_idx on public.capa_action (root_cause_id);

comment on table public.capa_action is
  'CAPA corrective actions (Phase 14d). owner = displayed free-text party; '
  'assignee_user_id = the platform user the narrow advance gate keys on. '
  'root_cause_id FKs the 14c rca_root_causes(id).';

-- ===========================================================================
-- public.capa_action_task — execution steps
-- ===========================================================================
create table public.capa_action_task (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.capa_action (id) on delete cascade,
  description text not null,
  is_done boolean not null default false,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint capa_action_task_desc_not_blank check (btrim(description) <> ''),
  constraint capa_action_task_position_key unique (action_id, position) deferrable initially immediate
);

alter table public.capa_action_task enable row level security;

create index capa_action_task_action_idx on public.capa_action_task (action_id, position);

-- ===========================================================================
-- public.capa_action_evidence — implementation evidence (file XOR link; soft-delete)
-- ===========================================================================
-- A file in the immutable nsp-evidence bucket (CAPA path {capa_id}/{action_id}/{uuid})
-- XOR an https link. NO citation kind here (implementation proof, not cross-refs).
create table public.capa_action_evidence (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.capa_action (id) on delete cascade,
  kind text not null check (kind in ('document', 'link')),
  title text not null,
  storage_path text,
  external_url text,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint capa_action_evidence_title_not_blank check (btrim(title) <> ''),
  constraint capa_action_evidence_https check (external_url is null or external_url like 'https://%'),
  constraint capa_action_evidence_shape check (
    (kind = 'document' and storage_path is not null and external_url is null)
    or (kind = 'link' and external_url is not null and storage_path is null)
  )
);

alter table public.capa_action_evidence enable row level security;

create index capa_action_evidence_action_idx on public.capa_action_evidence (action_id);
create unique index capa_action_evidence_storage_path_key on public.capa_action_evidence (storage_path)
  where storage_path is not null;

-- ===========================================================================
-- public.capa_measure — measures of success (indicator_id = Phase-15 FK-less hook)
-- ===========================================================================
create table public.capa_measure (
  id uuid primary key default gen_random_uuid(),
  capa_id uuid not null references public.capa_plan (id) on delete cascade,
  name text not null,
  target text,
  definition text,
  -- FK-LESS Phase-15 hook (public.indicators):
  indicator_id uuid,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint capa_measure_name_not_blank check (btrim(name) <> ''),
  constraint capa_measure_position_key unique (capa_id, position) deferrable initially immediate
);

alter table public.capa_measure enable row level security;

create index capa_measure_capa_idx on public.capa_measure (capa_id, position);

comment on column public.capa_measure.indicator_id is
  'FK-LESS forward hook (Phase 15 — public.indicators). Add the FK then.';

-- ===========================================================================
-- public.capa_measure_result — recorded results over periods
-- ===========================================================================
create table public.capa_measure_result (
  id uuid primary key default gen_random_uuid(),
  measure_id uuid not null references public.capa_measure (id) on delete cascade,
  period text not null,
  value numeric,
  note text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint capa_measure_result_period_not_blank check (btrim(period) <> '')
);

alter table public.capa_measure_result enable row level security;

create index capa_measure_result_measure_idx on public.capa_measure_result (measure_id);

-- ===========================================================================
-- public.capa_effectiveness — the 1:1 verdict (close precondition; revoked on reopen)
-- ===========================================================================
create table public.capa_effectiveness (
  capa_id uuid primary key references public.capa_plan (id) on delete cascade,
  verdict text not null check (verdict in ('eficaz', 'parcial', 'ineficaz')),
  method_md text,
  verified_by uuid references public.profiles (id),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.capa_effectiveness enable row level security;

comment on table public.capa_effectiveness is
  'The 1:1 CAPA effectiveness verdict (Phase 14d). Required before close (HC052); '
  'revoked by reopen_capa_plan. method_md is sanitized Markdown — NEVER audited.';

-- ===========================================================================
-- app.event_of_capa(capa_id) -> uuid    (event scope of an event/rca-sourced plan)
-- ===========================================================================
-- The event a CAPA is scoped to: event-sourced → source_event_id; rca-sourced →
-- the RCA's event; else NULL (meeting/indicator/audit/manual have no event scope yet).
create function app.event_of_capa(p_capa_id uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select case
    when p.source = 'event' then p.source_event_id
    when p.source = 'rca' then app.event_of_rca(p.source_rca_id)
    else null
  end
  from public.capa_plan p
  where p.id = p_capa_id;
$$;

revoke all on function app.event_of_capa(uuid) from public;
grant execute on function app.event_of_capa(uuid) to authenticated, service_role;

-- ===========================================================================
-- app.can_read_capa(capa_id, uid) -> boolean    (the source-scoped READ predicate)
-- ===========================================================================
-- READ = the SOURCE's scope: event/rca-sourced → can_read_event of the plan's event
-- (NSP + reporting/holding committee); meeting/indicator/audit/manual-sourced →
-- PQS/admin only (the non-event source scopes arrive in Phases 15/18 — forward item).
-- SECURITY DEFINER + uid-pure (bypasses RLS internally → no recursion; pgTAP-testable).
create function app.can_read_capa(p_capa_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select
    app.is_pqs_member(p_user_id)
    or app.can_read_event(app.event_of_capa(p_capa_id), p_user_id);
$$;

revoke all on function app.can_read_capa(uuid, uuid) from public;
grant execute on function app.can_read_capa(uuid, uuid) to authenticated, service_role;

-- ===========================================================================
-- app.mint_capa_code() — per-NSP (global) CAPA-%04d counter
-- ===========================================================================
-- BEFORE INSERT on capa_plan. Advisory-lock copy of app.mint_event_code (global chain,
-- distinct lock key). Format CAPA-%04d, backstopped by unique(code).
create function app.mint_capa_code()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_next integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('pqs:capa_code', 0));

  v_next := coalesce(
    (select max((substring(code from 6))::integer)
     from public.capa_plan
     where code ~ '^CAPA-[0-9]+$'),
    0
  ) + 1;

  new.code := 'CAPA-' || lpad(v_next::text, 4, '0');
  return new;
end;
$$;

create trigger mint_capa_code_trg
  before insert on public.capa_plan
  for each row execute function app.mint_capa_code();

-- ===========================================================================
-- app.guard_capa_status — lifecycle state machine + freeze-at-terminal
-- ===========================================================================
-- BEFORE UPDATE OR DELETE on capa_plan. Gated by the app.in_safety_rpc GUC. Legal:
--   aberto         -> em_execucao | cancelado
--   em_execucao    -> em_verificacao | cancelado
--   em_verificacao -> concluido | em_execucao (back) | cancelado
--   concluido      -> em_execucao (reopen)
--   cancelado is TERMINAL.
-- Once concluido/cancelado the header is frozen except under the flag. Mirror
-- guard_rca_status.
create function app.guard_capa_status()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_safety_rpc', true), 'off') = 'on';
begin
  if tg_op = 'DELETE' then
    if not v_in_rpc and old.status in ('concluido', 'cancelado') then
      raise exception 'um plano de ação encerrado ou cancelado não pode ser excluído'
        using errcode = 'HC049';
    end if;
    return old;
  end if;

  if new.status is distinct from old.status then
    if not v_in_rpc then
      raise exception 'mudanças de estado do plano devem passar pelas RPCs do NSP'
        using errcode = 'HC049';
    end if;
    if not (
      (old.status = 'aberto' and new.status in ('em_execucao', 'cancelado'))
      or (old.status = 'em_execucao' and new.status in ('em_verificacao', 'cancelado'))
      or (old.status = 'em_verificacao' and new.status in ('concluido', 'em_execucao', 'cancelado'))
      or (old.status = 'concluido' and new.status = 'em_execucao')
    ) then
      raise exception 'transição de estado de plano inválida: % -> %', old.status, new.status
        using errcode = 'HC049';
    end if;
    return new;
  end if;

  if v_in_rpc then
    return new;
  end if;
  if old.status in ('concluido', 'cancelado') then
    raise exception 'um plano de ação em estado final é imutável (reabra para editar)'
      using errcode = 'HC049';
  end if;
  return new;
end;
$$;

create trigger guard_capa_status_trg
  before update or delete on public.capa_plan
  for each row execute function app.guard_capa_status();

-- ===========================================================================
-- app.guard_capa_child_lock — freeze ALL child tables once the plan is terminal
-- ===========================================================================
-- BEFORE INSERT/UPDATE/DELETE on every CAPA child. Keys PURELY on the parent plan
-- status ∈ terminal (NOT the GUC) so even the authoring RPCs cannot edit a terminal
-- plan's children (mirror guard_rca_child_lock). reopen_capa_plan unlocks. The child
-- tables hang off capa_action (task/evidence) OR capa_plan (measure/effectiveness), so
-- the resolver walks to the plan.
create function app.guard_capa_child_lock()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_capa_id uuid;
  v_action_id uuid;
  v_measure_id uuid;
  v_status text;
begin
  -- Resolve the owning plan id from whichever child fired.
  if tg_table_name = 'capa_action' then
    v_capa_id := case when tg_op = 'DELETE' then old.capa_id else new.capa_id end;
  elsif tg_table_name = 'capa_measure' then
    v_capa_id := case when tg_op = 'DELETE' then old.capa_id else new.capa_id end;
  elsif tg_table_name = 'capa_effectiveness' then
    v_capa_id := case when tg_op = 'DELETE' then old.capa_id else new.capa_id end;
  elsif tg_table_name = 'capa_action_task' then
    v_action_id := case when tg_op = 'DELETE' then old.action_id else new.action_id end;
    select capa_id into v_capa_id from public.capa_action where id = v_action_id;
  elsif tg_table_name = 'capa_action_evidence' then
    v_action_id := case when tg_op = 'DELETE' then old.action_id else new.action_id end;
    select capa_id into v_capa_id from public.capa_action where id = v_action_id;
  elsif tg_table_name = 'capa_measure_result' then
    v_measure_id := case when tg_op = 'DELETE' then old.measure_id else new.measure_id end;
    select capa_id into v_capa_id from public.capa_measure where id = v_measure_id;
  end if;

  select status into v_status from public.capa_plan where id = v_capa_id;
  if v_status is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if v_status in ('concluido', 'cancelado') then
    raise exception 'o conteúdo deste plano de ação está bloqueado (%)' , v_status
      using errcode = 'HC049';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger guard_capa_child_lock_action_trg
  before insert or update or delete on public.capa_action
  for each row execute function app.guard_capa_child_lock();

create trigger guard_capa_child_lock_task_trg
  before insert or update or delete on public.capa_action_task
  for each row execute function app.guard_capa_child_lock();

create trigger guard_capa_child_lock_evidence_trg
  before insert or update or delete on public.capa_action_evidence
  for each row execute function app.guard_capa_child_lock();

create trigger guard_capa_child_lock_measure_trg
  before insert or update or delete on public.capa_measure
  for each row execute function app.guard_capa_child_lock();

create trigger guard_capa_child_lock_result_trg
  before insert or update or delete on public.capa_measure_result
  for each row execute function app.guard_capa_child_lock();

create trigger guard_capa_child_lock_effectiveness_trg
  before insert or update or delete on public.capa_effectiveness
  for each row execute function app.guard_capa_child_lock();

-- ===========================================================================
-- app.advance_capa_action_core(action_id, status) — the assignee-OR-PQS narrow path
-- ===========================================================================
-- The shared gated mutation (mirror app.advance_action_item_core). SECURITY DEFINER so
-- it bypasses the PQS-only child write RLS for a legitimate ASSIGNEE; the internal gate
-- is the authority: the caller must be the action's assignee_user_id OR is_pqs_member
-- (HC050 otherwise). Stamps completed_at/by on entering 'concluida', clears on leaving.
-- The child-lock still applies (a terminal plan rejects the status write).
create function app.advance_capa_action_core(p_action_id uuid, p_status text)
returns public.capa_action
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_assignee uuid;
  v_capa_id uuid;
  v_uid uuid := auth.uid();
  v_result public.capa_action;
begin
  if p_status not in ('pendente', 'em_andamento', 'concluida', 'cancelada') then
    raise exception 'estado de ação inválido' using errcode = 'check_violation';
  end if;

  select assignee_user_id, capa_id into v_assignee, v_capa_id
  from public.capa_action where id = p_action_id;
  if v_capa_id is null then
    raise exception 'ação % não encontrada', p_action_id using errcode = 'no_data_found';
  end if;

  if not (
    (v_assignee is not null and v_assignee = v_uid)
    or app.is_pqs_member(v_uid)
  ) then
    raise exception 'você não pode alterar esta ação corretiva' using errcode = 'HC050';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.capa_action
  set status = p_status,
      completed_at = case when p_status = 'concluida' then coalesce(completed_at, now()) else null end,
      completed_by = case when p_status = 'concluida' then coalesce(completed_by, v_uid) else null end,
      updated_at = now()
  where id = p_action_id
  returning * into v_result;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_result;
end;
$$;

revoke all on function app.advance_capa_action_core(uuid, text) from public;
grant execute on function app.advance_capa_action_core(uuid, text) to authenticated, service_role;

-- ===========================================================================
-- app.event_capa_fully_settled(event_id) -> boolean   (the close→event predicate)
-- ===========================================================================
-- TRUE when an event is ready to auto-close after a CAPA closes:
--   * if the event has an RCA, that RCA is 'completed'; AND
--   * every capa_plan scoped to the event (event-sourced OR rca-sourced) is terminal
--     (concluido/cancelado).
-- close_capa_plan calls this and, when true + the event is 'triaged', flips it to
-- 'closed' under the GUC (guard_event_status already permits triaged->closed).
create function app.event_capa_fully_settled(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select
    -- RCA (if any) must be completed.
    not exists (
      select 1 from public.rca r
      where r.event_id = p_event_id and r.status <> 'completed'
    )
    -- and no non-terminal CAPA plan scoped to this event remains.
    and not exists (
      select 1 from public.capa_plan p
      where app.event_of_capa(p.id) = p_event_id
        and p.status not in ('concluido', 'cancelado')
    );
$$;

revoke all on function app.event_capa_fully_settled(uuid) from public;
grant execute on function app.event_capa_fully_settled(uuid) to authenticated, service_role;
