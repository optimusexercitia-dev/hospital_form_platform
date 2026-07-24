-- Case Correction Lifecycle — BE-1 schema (ADR pending).
--
-- Introduces the correction-workflow substrate for case phases and case
-- narratives: the `case_correction_requests` workflow table, the append-only
-- `case_narrative_revisions` snapshot table, the `voided` terminal state for
-- phases + narratives, and the `case_phases.current_response_id` current-revision
-- pointer (DEAD in BE-1 — no reader/writer maintains it yet; BE-2 wires it).
--
-- Writes to both new tables are DEFINER-door-only (BE-3/BE-4). RLS exposes SELECT
-- only, via the broad case-content reader `app.can_read_case`. A guard trigger
-- gated on `app.in_correction_rpc` makes the write-door invariant mutation-provable
-- (it blocks even the service role, which bypasses RLS but not triggers).
--
-- All prior-object definitions below (guard_case_phase_status, the responses
-- indexes, the status CHECKs) were authored from the LIVE local catalog, never
-- from migration file text (stale by design — CLAUDE.md graphify exception).

-- ---------------------------------------------------------------------------
-- 1. Feature flag + gate helper (mirrors app.assert_response_correction_enabled)
-- ---------------------------------------------------------------------------

insert into app.feature_flags (key, enabled, description)
values ('case_corrections', false,
  'Case correction lifecycle — phase revision/void + narrative revision/void requests. Ships OFF; flipped at the phase gate.')
on conflict (key) do nothing;

create or replace function app.assert_case_corrections_enabled()
returns void
language plpgsql
stable
set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  if not app.feature_enabled('case_corrections') then
    raise exception 'o recurso de correção de casos não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. case_correction_requests — the correction workflow table
-- ---------------------------------------------------------------------------

create table public.case_correction_requests (
  id                      uuid primary key default gen_random_uuid(),
  case_id                 uuid not null references public.cases(id) on delete cascade,
  commission_id           uuid not null references public.commissions(id),   -- denorm
  kind                    text not null,
  -- Polymorphic target: exactly one of phase / narrative (dialect 1: named-FK + shape CHECK).
  case_phase_id           uuid references public.case_phases(id) on delete cascade,
  case_narrative_id       uuid references public.case_narratives(id) on delete cascade,
  status                  text not null default 'requested',
  reason                  text not null,
  classification          text not null,
  requested_by            uuid not null references public.profiles(id),
  requested_at            timestamptz not null default now(),
  -- Explicit audited grant; defaults to the original assignee (set by the door).
  permitted_corrector     uuid references public.profiles(id),
  predecessor_response_id uuid references public.responses(id),
  draft_response_id       uuid references public.responses(id),   -- phase kinds only
  draft_body_md           text,                                    -- narrative kinds only
  last_rejected_by        uuid references public.profiles(id),
  last_rejected_at        timestamptz,
  last_rejected_reason    text,
  resolved_by             uuid references public.profiles(id),
  resolved_at             timestamptz,
  self_approved           boolean not null default false,
  impact_snapshot         jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint case_correction_requests_kind_check
    check (kind in ('correction', 'addendum', 'void')),
  constraint case_correction_requests_status_check
    check (status in ('requested', 'in_progress', 'resubmitted', 'under_review',
                      'rejected', 'approved', 'withdrawn')),
  constraint case_correction_requests_classification_check
    check (classification in ('clerical', 'factual', 'interpretative',
                              'substantive', 'compliance_related')),
  constraint case_correction_requests_reason_not_blank
    check (btrim(reason) <> ''),
  -- Exactly one target (phase XOR narrative).
  constraint case_correction_requests_target_xor
    check ((case_phase_id is not null) <> (case_narrative_id is not null)),
  -- void ⇒ no draft of either kind.
  constraint case_correction_requests_void_no_draft
    check (kind <> 'void' or (draft_response_id is null and draft_body_md is null)),
  -- draft_response_id belongs to phase kinds; draft_body_md to narrative kinds.
  constraint case_correction_requests_draft_response_phase_only
    check (draft_response_id is null or case_phase_id is not null),
  constraint case_correction_requests_draft_body_narrative_only
    check (draft_body_md is null or case_narrative_id is not null)
);

comment on table public.case_correction_requests is
  'Case-phase / case-narrative correction workflow (kind=correction|addendum|void). '
  'Writes are DEFINER-door-only (app.in_correction_rpc guard); RLS exposes SELECT '
  'via app.can_read_case. draft_body_md is PHI-bearing free text (Rule 12), served '
  'under the same broad case-reader posture as case_narratives.body_md.';

-- Open-slot partial uniques: one live request per target. Open statuses =
-- requested / in_progress / resubmitted / under_review / rejected (rejected is a
-- resting state; terminals approved/withdrawn free the slot). Backstop for the
-- pt-BR pre-check HC0M2, mirroring responses_one_successor_per_superseded.
create unique index case_correction_requests_one_open_per_phase_idx
  on public.case_correction_requests (case_phase_id)
  where case_phase_id is not null
    and status in ('requested', 'in_progress', 'resubmitted', 'under_review', 'rejected');

create unique index case_correction_requests_one_open_per_narrative_idx
  on public.case_correction_requests (case_narrative_id)
  where case_narrative_id is not null
    and status in ('requested', 'in_progress', 'resubmitted', 'under_review', 'rejected');

create index case_correction_requests_case_id_idx
  on public.case_correction_requests (case_id);

create index case_correction_requests_permitted_corrector_open_idx
  on public.case_correction_requests (permitted_corrector)
  where status in ('requested', 'in_progress', 'resubmitted', 'under_review', 'rejected');

-- updated_at touch (platform convention).
create or replace function app.touch_case_correction_request_updated_at()
returns trigger
language plpgsql
set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

create trigger touch_case_correction_requests_updated_at
  before update on public.case_correction_requests
  for each row execute function app.touch_case_correction_request_updated_at();

-- Write guard: mutations only under app.in_correction_rpc (DEFINER doors set it).
-- DELETE also permitted when the parent case is gone (case cascade), mirroring the
-- app.guard_case_narrative_frozen cascade convention.
create or replace function app.guard_case_correction_request_write()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_correction_rpc', true), 'off') = 'on';
begin
  if tg_op = 'DELETE' then
    if v_in_rpc then
      return old;
    end if;
    -- Parent gone → cascade delete, allow.
    if not exists (select 1 from public.cases where id = old.case_id) then
      return old;
    end if;
    raise exception 'as solicitações de correção só podem ser alteradas pelas rotinas de correção'
      using errcode = 'check_violation';
  end if;

  -- INSERT / UPDATE.
  if not v_in_rpc then
    raise exception 'as solicitações de correção só podem ser alteradas pelas rotinas de correção'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

create trigger guard_case_correction_request_write_trg
  before insert or update or delete on public.case_correction_requests
  for each row execute function app.guard_case_correction_request_write();

-- Audit trigger (PHI-free; mirrors app.trg_audit_case_phases). INSERT is audited
-- by the creating door (case_correction.requested); this trigger records status
-- transitions + deletes. Free-text (reason, draft_body_md, last_rejected_reason)
-- is NEVER copied into the diff (Rule 11).
create or replace function app.trg_audit_case_correction_requests()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_comm uuid;
begin
  if tg_op = 'DELETE' then
    v_comm := app.commission_of_case(old.case_id);
    if v_comm is null then
      return null;  -- case cascade; nothing to attribute
    end if;
    perform app.audit_write('case_correction.deleted', 'case_correction_request', old.id, v_comm,
      'Solicitação de correção (' || old.kind || ') excluída',
      app.audit_diff(to_jsonb(old), null,
        array['kind', 'status', 'classification', 'case_phase_id', 'case_narrative_id',
              'permitted_corrector', 'self_approved']));
    return null;
  end if;

  if new.status is distinct from old.status then
    v_comm := app.commission_of_case(new.case_id);
    perform app.audit_write('case_correction.status_changed', 'case_correction_request', new.id, v_comm,
      'Status da correção (' || new.kind || '): ' || old.status || ' → ' || new.status,
      app.audit_diff(to_jsonb(old), to_jsonb(new),
        array['kind', 'status', 'classification', 'case_phase_id', 'case_narrative_id',
              'permitted_corrector', 'self_approved']));
  end if;
  return null;
end;
$function$;

create trigger audit_case_correction_requests_trg
  after update or delete on public.case_correction_requests
  for each row execute function app.trg_audit_case_correction_requests();

-- RLS: SELECT only, via the broad case-content reader. No write policies —
-- writes are DEFINER-door-only (guard above).
alter table public.case_correction_requests enable row level security;

revoke insert, update, delete, truncate on public.case_correction_requests from authenticated;

create policy case_correction_requests_select on public.case_correction_requests
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. case_narrative_revisions — append-only snapshot of superseded narrative text
-- ---------------------------------------------------------------------------

create table public.case_narrative_revisions (
  id                    uuid primary key default gen_random_uuid(),
  case_narrative_id     uuid not null references public.case_narratives(id) on delete cascade,
  correction_request_id uuid references public.case_correction_requests(id) on delete set null,
  revision_number       integer not null,
  body_md               text not null,   -- the OLD (superseded) narrative body
  snapshotted_at        timestamptz not null default now(),
  snapshotted_by        uuid references public.profiles(id),

  constraint case_narrative_revisions_number_unique
    unique (case_narrative_id, revision_number)
);

comment on table public.case_narrative_revisions is
  'Append-only snapshots of superseded case-narrative bodies. body_md is PHI-bearing '
  'free text (Rule 12). Written only inside correction doors (app.in_correction_rpc); '
  'UPDATE/DELETE blocked except parent-cascade delete.';

create index case_narrative_revisions_narrative_idx
  on public.case_narrative_revisions (case_narrative_id);

-- Append-only guard: INSERT only under app.in_correction_rpc; UPDATE always blocked;
-- DELETE only via parent-narrative cascade (mirrors guard_case_narrative_frozen).
create or replace function app.guard_narrative_revision_append_only()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_correction_rpc', true), 'off') = 'on';
begin
  if tg_op = 'UPDATE' then
    raise exception 'as revisões de narrativa são imutáveis (somente inserção)'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    -- Parent narrative gone → cascade delete, allow. Otherwise blocked.
    if not exists (select 1 from public.case_narratives where id = old.case_narrative_id) then
      return old;
    end if;
    raise exception 'as revisões de narrativa são imutáveis (exclusão bloqueada)'
      using errcode = 'check_violation';
  end if;

  -- INSERT.
  if not v_in_rpc then
    raise exception 'as revisões de narrativa só podem ser criadas pelas rotinas de correção'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

create trigger guard_case_narrative_revisions_append_only_trg
  before insert or update or delete on public.case_narrative_revisions
  for each row execute function app.guard_narrative_revision_append_only();

-- RLS: SELECT only, via can_read_case resolved through the parent narrative.
alter table public.case_narrative_revisions enable row level security;

revoke insert, update, delete, truncate on public.case_narrative_revisions from authenticated;

create policy case_narrative_revisions_select on public.case_narrative_revisions
  for select to authenticated
  using (app.can_read_case(
           (select cn.case_id from public.case_narratives cn where cn.id = case_narrative_id),
           auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. Terminal `voided` state — case_phases + case_narratives CHECK widen
-- ---------------------------------------------------------------------------

alter table public.case_phases drop constraint case_phases_status_check;
alter table public.case_phases add constraint case_phases_status_check
  check (status = any (array['pending', 'active', 'completed', 'not_required', 'voided']));

alter table public.case_narratives drop constraint case_narratives_status_check;
alter table public.case_narratives add constraint case_narratives_status_check
  check (status = any (array['open', 'completed', 'voided']));

-- ---------------------------------------------------------------------------
-- 5. app.guard_case_phase_status — allow completed→voided; block voided delete
--    (authored from the live catalog body; only the two marked lines change)
-- ---------------------------------------------------------------------------

create or replace function app.guard_case_phase_status()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_case_rpc', true), 'off') = 'on';
begin
  if tg_op = 'DELETE' then
    -- Phases are only deleted via the case cascade (handled there) or while the
    -- case is being built under the flag; a direct terminal-phase delete is
    -- blocked.
    if not v_in_rpc and old.status in ('completed', 'not_required', 'voided') then  -- +voided
      raise exception 'terminal case phases are immutable (delete blocked)'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- Status transition.
  if new.status is distinct from old.status then
    if not v_in_rpc then
      raise exception 'case phase status changes must go through the case RPCs'
        using errcode = 'check_violation';
    end if;

    if not (
      (old.status = 'pending' and new.status in ('active', 'not_required'))
      or (old.status = 'active' and new.status in ('completed', 'not_required'))
      or (old.status = 'completed' and new.status = 'voided')  -- correction void
    ) then
      raise exception 'invalid case phase transition % -> %', old.status, new.status
        using errcode = 'check_violation';
    end if;

    return new;
  end if;

  -- No status change. Permit the recommended-flag toggle while pendente; permit
  -- any non-status field change under the RPC flag (activate/reassign metadata);
  -- otherwise freeze a non-pendente phase.
  if v_in_rpc then
    return new;
  end if;

  if old.status = 'pending'
     and new.recommended is distinct from old.recommended
     and new.status = old.status
     and new.assigned_to is not distinct from old.assigned_to
     and new.activated_at is not distinct from old.activated_at
     and new.completed_at is not distinct from old.completed_at
     and new.skipped_at is not distinct from old.skipped_at then
    return new;
  end if;

  raise exception 'case phase changes must go through the case RPCs'
    using errcode = 'check_violation';
end;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Responses index swap — allow a correction chain (one root + one open draft)
-- ---------------------------------------------------------------------------

drop index public.responses_one_per_case_phase_idx;

-- One ROOT (non-superseding) response per phase — chain linearity beyond the root
-- is held by responses_one_successor_per_superseded.
create unique index responses_one_root_per_case_phase_idx
  on public.responses (case_phase_id)
  where case_phase_id is not null and supersedes_id is null;

-- At most one open (in_progress) draft per phase.
create unique index responses_one_open_draft_per_phase_idx
  on public.responses (case_phase_id)
  where case_phase_id is not null and status = 'in_progress';

-- ---------------------------------------------------------------------------
-- 7. case_phases.current_response_id — current-revision pointer (DEAD in BE-1)
--    Backfilled from existing submitted rows; wired by BE-2 (sync + approve).
-- ---------------------------------------------------------------------------

alter table public.case_phases
  add column current_response_id uuid references public.responses(id) on delete set null;

comment on column public.case_phases.current_response_id is
  'Pointer to the current (approved) response revision for this phase. Set by '
  'sync_case_phase_on_submit on first submit and re-pointed by approve_correction '
  '(BE-2). Readers resolve this pointer rather than walking the supersession chain.';

-- The backfill MUTATES existing case_phases rows, which guard_case_phase_status
-- blocks (SQLSTATE 23514, "case phase changes must go through the case RPCs")
-- unless app.in_case_rpc is set — exactly as every case RPC does before touching
-- case_phases. On a fresh local `db reset` this ran against ZERO rows (migrations
-- precede seed), so the guard never fired and the gap stayed invisible; a
-- data-bearing environment (remote) trips it. Wrap the backfill in the same
-- transaction-local flag the guard expects. (set_config(...,true) is txn-scoped;
-- the migration runs in one transaction.)
select set_config('app.in_case_rpc', 'on', true);

update public.case_phases cp
   set current_response_id = r.id
  from public.responses r
 where r.case_phase_id = cp.id
   and r.status = 'submitted'
   and r.supersedes_id is null;

select set_config('app.in_case_rpc', 'off', true);
