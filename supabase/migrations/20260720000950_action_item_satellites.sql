-- Migration: Action-item satellites — reminders, updates-feed, checklists
-- ---------------------------------------------------------------------------
-- AI·sat (plan docs/plans/action-items-satellites.md §2, ADR 0050). Three NEW
-- spoke tables hanging off public.action_items(id), rounding the shared (non-PHI)
-- hub into a usable activity/checklist/reminder surface:
--
--   1. action_item_reminders   — reminder RULES (when to nudge; delivery is N's job)
--   2. action_item_updates     — append-only NARRATIVE feed (human notes)
--   3. action_item_checklists  — lightweight ordered binary SUBTASKS
--
-- Security posture (Architecture Rules 1, 9, 11):
--   * RLS: ONE SELECT policy per table, VERBATIM reuse of the hub's scope-aware
--     read predicate `app.can_read_action_item(action_item_id, auth.uid())` — no
--     new predicate, no new disjunct, no per-satellite scope logic. A satellite
--     row of a `case_restricted` item is invisible to a non-case-reader exactly
--     like the item itself (closes the "leak through a satellite" class ADR 0050
--     closed for the first two satellites, now for three more tables).
--   * NO authenticated INSERT/UPDATE/DELETE policy — every write funnels through a
--     SECURITY DEFINER committee_* RPC (mirrors the two existing satellites).
--   * Audit (Rule 11): one app.trg_audit_* AFTER trigger per table emitting
--     action_item.<satellite>.<verb> via app.audit_write with
--     p_commission := app.commission_of_action_item(action_item_id). The audit
--     diff tracks STRUCTURAL columns only (no free-text body/title) — mirrors the
--     hub's own v_cols allowlist. audit_write-only (non-PHI; no log_audit_access
--     allow-list entry).
--   * Write authority (S0 O-2, STAKEHOLDER-GATED):
--       reminders  -> staff_admin/org_admin of the item's commission (HC0I0);
--       updates    -> reader-with-a-stake (HC0I1);
--       checklists -> reader-with-a-stake (HC0I2).
--     "reader-with-a-stake" = can_read_action_item(item, uid) AND (assigned_to=uid
--     OR active action_item_assignments row OR staff_admin OR org_admin).
--   * Flag gate: every RPC opens with feature_enabled('action_items') (HC000 off).
--
-- Forward-only + additive. Does NOT touch 20260706000000 / 20260707000000.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. action_item_reminders — reminder rules (§2.2)
-- ===========================================================================
create table public.action_item_reminders (
  id uuid primary key default gen_random_uuid(),
  action_item_id uuid not null references public.action_items(id) on delete cascade,

  reminder_type text not null check (
    reminder_type in ('before_due', 'on_due', 'after_due')
  ),
  offset_days integer,              -- interpretation depends on reminder_type; NULL for on_due
  is_active boolean not null default true,

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint action_item_reminders_offset_check check (
    (reminder_type = 'on_due' and offset_days is null)
    or (reminder_type <> 'on_due' and offset_days is not null and offset_days > 0)
  )
);

alter table public.action_item_reminders owner to postgres;

comment on table public.action_item_reminders is
  'Reminder RULES for a shared action item (when to nudge relative to due_date). '
  'Delivery is the Notifications track''s job (the inert plan §3 scan-arm reads '
  'these). RLS: read via can_read_action_item; writes are DEFINER-RPC only '
  '(staff_admin/org_admin of the item''s commission). Audited (non-PHI).';

create index action_item_reminders_item_idx
  on public.action_item_reminders (action_item_id);

-- ===========================================================================
-- 2. action_item_updates — append-only narrative feed (§2.3)
-- ===========================================================================
create table public.action_item_updates (
  id uuid primary key default gen_random_uuid(),
  action_item_id uuid not null references public.action_items(id) on delete cascade,

  author_id uuid references public.profiles(id),
  update_type text not null check (
    update_type in ('note', 'progress', 'blocker', 'deadline_change')
  ),
  body text not null,

  created_at timestamptz not null default now(),

  constraint action_item_updates_body_not_blank check (btrim(body) <> '')
);

alter table public.action_item_updates owner to postgres;

comment on table public.action_item_updates is
  'Append-only NARRATIVE feed for a shared action item (human notes/progress/'
  'blockers/deadline changes) — distinct from the system-authored '
  'action_item_status_history. No update/delete path (a mistaken post is '
  'superseded by a correcting note). RLS: read via can_read_action_item; writes '
  'are DEFINER-RPC only (reader-with-a-stake). Audited (structural cols only).';

create index action_item_updates_item_idx
  on public.action_item_updates (action_item_id);

-- ===========================================================================
-- 3. action_item_checklists — ordered binary subtasks (§2.4)
-- ===========================================================================
create table public.action_item_checklists (
  id uuid primary key default gen_random_uuid(),
  action_item_id uuid not null references public.action_items(id) on delete cascade,

  title text not null,
  is_done boolean not null default false,
  sort_order integer not null default 0,

  completed_at timestamptz,
  completed_by uuid references public.profiles(id),

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint action_item_checklists_title_not_blank check (btrim(title) <> '')
);

alter table public.action_item_checklists owner to postgres;

comment on table public.action_item_checklists is
  'Lightweight ordered binary SUBTASKS scoped to one shared action item. A subtask '
  'needing its own owner/lifecycle should become its own action_item instead. RLS: '
  'read via can_read_action_item; writes are DEFINER-RPC only (reader-with-a-stake). '
  'Audited (structural cols only, no title).';

create index action_item_checklists_item_idx
  on public.action_item_checklists (action_item_id);

-- ===========================================================================
-- 4. Audit triggers (Rule 11) — one per satellite; structural-cols-only diff
-- ===========================================================================
-- Mirrors app.trg_audit_action_item_status_history: AFTER row trigger, resolves
-- the parent commission via app.commission_of_action_item, calls app.audit_write
-- (gated internally by the audit_trail flag). The diff allowlist EXCLUDES the
-- free-text body/title columns (records that + who, never payloads).

-- --- reminders ---
create or replace function app.trg_audit_action_item_reminders()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_cols constant text[] := array['reminder_type', 'offset_days', 'is_active'];
  v_item uuid := coalesce(new.action_item_id, old.action_item_id);
  v_comm uuid := app.commission_of_action_item(v_item);
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('action_item.reminder.created', 'action_item', v_item, v_comm,
      'Lembrete de item de ação criado', app.audit_diff(null, to_jsonb(new), v_cols));
  elsif tg_op = 'UPDATE' then
    perform app.audit_write('action_item.reminder.updated', 'action_item', v_item, v_comm,
      'Lembrete de item de ação atualizado', app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
  else
    perform app.audit_write('action_item.reminder.deleted', 'action_item', v_item, v_comm,
      'Lembrete de item de ação removido', app.audit_diff(to_jsonb(old), null, v_cols));
  end if;
  return null;
end;
$$;

alter function app.trg_audit_action_item_reminders() owner to postgres;

create or replace trigger audit_action_item_reminders_trg
  after insert or update or delete on public.action_item_reminders
  for each row execute function app.trg_audit_action_item_reminders();

-- --- updates (create-only, but guard all ops defensively) ---
create or replace function app.trg_audit_action_item_updates()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_cols constant text[] := array['update_type'];  -- body is free-text; excluded
  v_item uuid := coalesce(new.action_item_id, old.action_item_id);
  v_comm uuid := app.commission_of_action_item(v_item);
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('action_item.update.created', 'action_item', v_item, v_comm,
      'Atualização de item de ação registrada', app.audit_diff(null, to_jsonb(new), v_cols));
  elsif tg_op = 'UPDATE' then
    perform app.audit_write('action_item.update.updated', 'action_item', v_item, v_comm,
      'Atualização de item de ação editada', app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
  else
    perform app.audit_write('action_item.update.deleted', 'action_item', v_item, v_comm,
      'Atualização de item de ação removida', app.audit_diff(to_jsonb(old), null, v_cols));
  end if;
  return null;
end;
$$;

alter function app.trg_audit_action_item_updates() owner to postgres;

create or replace trigger audit_action_item_updates_trg
  after insert or update or delete on public.action_item_updates
  for each row execute function app.trg_audit_action_item_updates();

-- --- checklists ---
create or replace function app.trg_audit_action_item_checklists()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_cols constant text[] := array['is_done', 'sort_order', 'completed_at', 'completed_by'];  -- title excluded
  v_item uuid := coalesce(new.action_item_id, old.action_item_id);
  v_comm uuid := app.commission_of_action_item(v_item);
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('action_item.checklist.created', 'action_item', v_item, v_comm,
      'Item de checklist criado', app.audit_diff(null, to_jsonb(new), v_cols));
  elsif tg_op = 'UPDATE' then
    perform app.audit_write('action_item.checklist.updated', 'action_item', v_item, v_comm,
      'Item de checklist atualizado', app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
  else
    perform app.audit_write('action_item.checklist.deleted', 'action_item', v_item, v_comm,
      'Item de checklist removido', app.audit_diff(to_jsonb(old), null, v_cols));
  end if;
  return null;
end;
$$;

alter function app.trg_audit_action_item_checklists() owner to postgres;

create or replace trigger audit_action_item_checklists_trg
  after insert or update or delete on public.action_item_checklists
  for each row execute function app.trg_audit_action_item_checklists();

-- ===========================================================================
-- 5. RLS — enable + verbatim can_read_action_item SELECT policy + grants
-- ===========================================================================
-- Mirrors the two existing satellites' grant pattern (grant all to authenticated
-- for the RLS-restricted SELECT; writes are DEFINER-RPC only).

alter table public.action_item_reminders enable row level security;
create policy action_item_reminders_select on public.action_item_reminders
  for select to authenticated
  using (app.can_read_action_item(action_item_id, auth.uid()));
grant all on table public.action_item_reminders to authenticated;
grant all on table public.action_item_reminders to service_role;

alter table public.action_item_updates enable row level security;
create policy action_item_updates_select on public.action_item_updates
  for select to authenticated
  using (app.can_read_action_item(action_item_id, auth.uid()));
grant all on table public.action_item_updates to authenticated;
grant all on table public.action_item_updates to service_role;

alter table public.action_item_checklists enable row level security;
create policy action_item_checklists_select on public.action_item_checklists
  for select to authenticated
  using (app.can_read_action_item(action_item_id, auth.uid()));
grant all on table public.action_item_checklists to authenticated;
grant all on table public.action_item_checklists to service_role;

-- ===========================================================================
-- 6. Internal helper — reader-with-a-stake gate (updates + checklists)
-- ===========================================================================
-- O-2 STAKEHOLDER-GATED authority for the updates/checklist write RPCs:
--   can_read_action_item(item, uid) AND (assigned_to=uid OR active assignment
--   OR staff_admin_of OR org_admin_of_commission). Uses the _for(commission, uid)
--   DEFINER-context helper variants exactly as can_read_action_item does.
create or replace function app.can_write_action_item_stake(p_action_item_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission_id uuid;
  v_assigned_to uuid;
begin
  select commission_id, assigned_to
    into v_commission_id, v_assigned_to
  from public.action_items where id = p_action_item_id;
  if v_commission_id is null then
    return false;
  end if;

  if not app.can_read_action_item(p_action_item_id, p_uid) then
    return false;
  end if;

  return (v_assigned_to is not null and v_assigned_to = p_uid)
      or app.is_staff_admin_of_for(v_commission_id, p_uid)
      or app.is_commission_admin_of_for(v_commission_id, p_uid)
      or exists (
        select 1 from public.action_item_assignments a
        where a.action_item_id = p_action_item_id
          and a.user_id = p_uid
          and a.completed_at is null
      );
end;
$$;

alter function app.can_write_action_item_stake(uuid, uuid) owner to postgres;
revoke all on function app.can_write_action_item_stake(uuid, uuid) from public;
grant all on function app.can_write_action_item_stake(uuid, uuid) to authenticated;
grant all on function app.can_write_action_item_stake(uuid, uuid) to service_role;

comment on function app.can_write_action_item_stake(uuid, uuid) is
  'Reader-with-a-stake write gate for the updates/checklist satellites (S0 O-2): '
  'can_read_action_item AND (assigned_to / active assignment / staff_admin / '
  'org_admin). SECURITY DEFINER; uses the _for helper variants.';

-- ===========================================================================
-- 7. RPCs — reminders (staff_admin/org_admin of the item''s commission; HC0I0)
-- ===========================================================================

-- --- create_committee_action_item_reminder --------------------------------
create or replace function public.create_committee_action_item_reminder(
  p_action_item_id uuid,
  p_reminder_type text,
  p_offset_days integer default null
)
returns public.action_item_reminders
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_commission_id uuid := app.commission_of_action_item(p_action_item_id);
  v_result public.action_item_reminders;
begin
  if not app.feature_enabled('action_items') then
    raise exception 'recurso indisponível' using errcode = 'HC000';
  end if;
  if v_commission_id is null then
    raise exception 'item de ação não encontrado' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of_for(v_commission_id, v_uid)
          or app.is_commission_admin_of_for(v_commission_id, v_uid)) then
    raise exception 'você não pode gerenciar lembretes deste item' using errcode = 'HC0I0';
  end if;
  if p_reminder_type not in ('before_due', 'on_due', 'after_due') then
    raise exception 'tipo de lembrete inválido' using errcode = 'check_violation';
  end if;

  insert into public.action_item_reminders
    (action_item_id, reminder_type, offset_days, created_by)
  values
    (p_action_item_id, p_reminder_type, p_offset_days, v_uid)
  returning * into v_result;

  return v_result;
end;
$$;

alter function public.create_committee_action_item_reminder(uuid, text, integer) owner to postgres;
revoke all on function public.create_committee_action_item_reminder(uuid, text, integer) from public;
grant execute on function public.create_committee_action_item_reminder(uuid, text, integer) to authenticated;
grant execute on function public.create_committee_action_item_reminder(uuid, text, integer) to service_role;
comment on function public.create_committee_action_item_reminder(uuid, text, integer) is
  'Create a reminder rule on a shared action item. Authority: staff_admin/org_admin '
  'of the item''s commission (HC0I0). offset_days: NULL for on_due, > 0 otherwise '
  '(CHECK-enforced). Audited (action_item.reminder.created).';

-- --- update_committee_action_item_reminder (toggle is_active only) ---------
create or replace function public.update_committee_action_item_reminder(
  p_id uuid,
  p_is_active boolean
)
returns public.action_item_reminders
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_action_item_id uuid;
  v_commission_id uuid;
  v_result public.action_item_reminders;
begin
  if not app.feature_enabled('action_items') then
    raise exception 'recurso indisponível' using errcode = 'HC000';
  end if;
  select action_item_id into v_action_item_id
  from public.action_item_reminders where id = p_id;
  if v_action_item_id is null then
    raise exception 'lembrete não encontrado' using errcode = 'no_data_found';
  end if;
  v_commission_id := app.commission_of_action_item(v_action_item_id);
  if not (app.is_staff_admin_of_for(v_commission_id, v_uid)
          or app.is_commission_admin_of_for(v_commission_id, v_uid)) then
    raise exception 'você não pode gerenciar lembretes deste item' using errcode = 'HC0I0';
  end if;

  update public.action_item_reminders
  set is_active = p_is_active, updated_at = now()
  where id = p_id returning * into v_result;

  return v_result;
end;
$$;

alter function public.update_committee_action_item_reminder(uuid, boolean) owner to postgres;
revoke all on function public.update_committee_action_item_reminder(uuid, boolean) from public;
grant execute on function public.update_committee_action_item_reminder(uuid, boolean) to authenticated;
grant execute on function public.update_committee_action_item_reminder(uuid, boolean) to service_role;
comment on function public.update_committee_action_item_reminder(uuid, boolean) is
  'Toggle a reminder rule active/inactive (type/offset are immutable — delete + '
  'recreate to change the shape). Authority: staff_admin/org_admin of the item''s '
  'commission (HC0I0). Audited (action_item.reminder.updated).';

-- --- delete_committee_action_item_reminder --------------------------------
create or replace function public.delete_committee_action_item_reminder(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_action_item_id uuid;
  v_commission_id uuid;
begin
  if not app.feature_enabled('action_items') then
    raise exception 'recurso indisponível' using errcode = 'HC000';
  end if;
  select action_item_id into v_action_item_id
  from public.action_item_reminders where id = p_id;
  if v_action_item_id is null then
    raise exception 'lembrete não encontrado' using errcode = 'no_data_found';
  end if;
  v_commission_id := app.commission_of_action_item(v_action_item_id);
  if not (app.is_staff_admin_of_for(v_commission_id, v_uid)
          or app.is_commission_admin_of_for(v_commission_id, v_uid)) then
    raise exception 'você não pode gerenciar lembretes deste item' using errcode = 'HC0I0';
  end if;

  delete from public.action_item_reminders where id = p_id;
end;
$$;

alter function public.delete_committee_action_item_reminder(uuid) owner to postgres;
revoke all on function public.delete_committee_action_item_reminder(uuid) from public;
grant execute on function public.delete_committee_action_item_reminder(uuid) to authenticated;
grant execute on function public.delete_committee_action_item_reminder(uuid) to service_role;
comment on function public.delete_committee_action_item_reminder(uuid) is
  'Hard-delete a reminder rule. Authority: staff_admin/org_admin of the item''s '
  'commission (HC0I0). Audited (action_item.reminder.deleted).';

-- ===========================================================================
-- 8. RPC — updates (reader-with-a-stake; HC0I1). Create-only (append-only feed).
-- ===========================================================================
create or replace function public.create_committee_action_item_update(
  p_action_item_id uuid,
  p_update_type text,
  p_body text
)
returns public.action_item_updates
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_commission_id uuid := app.commission_of_action_item(p_action_item_id);
  v_result public.action_item_updates;
begin
  if not app.feature_enabled('action_items') then
    raise exception 'recurso indisponível' using errcode = 'HC000';
  end if;
  if v_commission_id is null then
    raise exception 'item de ação não encontrado' using errcode = 'no_data_found';
  end if;
  if not app.can_write_action_item_stake(p_action_item_id, v_uid) then
    raise exception 'você não pode adicionar atualizações a este item' using errcode = 'HC0I1';
  end if;
  if p_update_type not in ('note', 'progress', 'blocker', 'deadline_change') then
    raise exception 'tipo de atualização inválido' using errcode = 'check_violation';
  end if;
  if nullif(btrim(p_body), '') is null then
    raise exception 'informe o conteúdo da atualização' using errcode = 'check_violation';
  end if;

  insert into public.action_item_updates
    (action_item_id, author_id, update_type, body)
  values
    (p_action_item_id, v_uid, p_update_type, btrim(p_body))
  returning * into v_result;

  return v_result;
end;
$$;

alter function public.create_committee_action_item_update(uuid, text, text) owner to postgres;
revoke all on function public.create_committee_action_item_update(uuid, text, text) from public;
grant execute on function public.create_committee_action_item_update(uuid, text, text) to authenticated;
grant execute on function public.create_committee_action_item_update(uuid, text, text) to service_role;
comment on function public.create_committee_action_item_update(uuid, text, text) is
  'Post a narrative update to a shared action item''s append-only feed. Authority: '
  'reader-with-a-stake (assignee / active assignment / staff_admin / org_admin; '
  'HC0I1 otherwise). No update/delete path by design. Audited '
  '(action_item.update.created).';

-- ===========================================================================
-- 9. RPCs — checklists (reader-with-a-stake; HC0I2)
-- ===========================================================================

-- --- create_committee_action_item_checklist -------------------------------
create or replace function public.create_committee_action_item_checklist(
  p_action_item_id uuid,
  p_title text,
  p_sort_order integer default null
)
returns public.action_item_checklists
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_commission_id uuid := app.commission_of_action_item(p_action_item_id);
  v_sort integer;
  v_result public.action_item_checklists;
begin
  if not app.feature_enabled('action_items') then
    raise exception 'recurso indisponível' using errcode = 'HC000';
  end if;
  if v_commission_id is null then
    raise exception 'item de ação não encontrado' using errcode = 'no_data_found';
  end if;
  if not app.can_write_action_item_stake(p_action_item_id, v_uid) then
    raise exception 'você não pode gerenciar a checklist deste item' using errcode = 'HC0I2';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe o título do item da checklist' using errcode = 'check_violation';
  end if;

  -- Default sort_order: append after the current max (a stable ordering without
  -- forcing the caller to compute it).
  if p_sort_order is null then
    select coalesce(max(sort_order), -1) + 1 into v_sort
    from public.action_item_checklists where action_item_id = p_action_item_id;
  else
    v_sort := p_sort_order;
  end if;

  insert into public.action_item_checklists
    (action_item_id, title, sort_order, created_by)
  values
    (p_action_item_id, btrim(p_title), v_sort, v_uid)
  returning * into v_result;

  return v_result;
end;
$$;

alter function public.create_committee_action_item_checklist(uuid, text, integer) owner to postgres;
revoke all on function public.create_committee_action_item_checklist(uuid, text, integer) from public;
grant execute on function public.create_committee_action_item_checklist(uuid, text, integer) to authenticated;
grant execute on function public.create_committee_action_item_checklist(uuid, text, integer) to service_role;
comment on function public.create_committee_action_item_checklist(uuid, text, integer) is
  'Create a checklist subtask on a shared action item. Authority: reader-with-a-'
  'stake (HC0I2). p_sort_order null appends after the current max. Audited '
  '(action_item.checklist.created).';

-- --- toggle_committee_action_item_checklist (done-state) -------------------
create or replace function public.toggle_committee_action_item_checklist(
  p_id uuid,
  p_is_done boolean
)
returns public.action_item_checklists
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_action_item_id uuid;
  v_result public.action_item_checklists;
begin
  if not app.feature_enabled('action_items') then
    raise exception 'recurso indisponível' using errcode = 'HC000';
  end if;
  select action_item_id into v_action_item_id
  from public.action_item_checklists where id = p_id;
  if v_action_item_id is null then
    raise exception 'item da checklist não encontrado' using errcode = 'no_data_found';
  end if;
  if not app.can_write_action_item_stake(v_action_item_id, v_uid) then
    raise exception 'você não pode gerenciar a checklist deste item' using errcode = 'HC0I2';
  end if;

  update public.action_item_checklists
  set is_done = p_is_done,
      completed_at = case when p_is_done then coalesce(completed_at, now()) else null end,
      completed_by = case when p_is_done then coalesce(completed_by, v_uid) else null end,
      updated_at = now()
  where id = p_id returning * into v_result;

  return v_result;
end;
$$;

alter function public.toggle_committee_action_item_checklist(uuid, boolean) owner to postgres;
revoke all on function public.toggle_committee_action_item_checklist(uuid, boolean) from public;
grant execute on function public.toggle_committee_action_item_checklist(uuid, boolean) to authenticated;
grant execute on function public.toggle_committee_action_item_checklist(uuid, boolean) to service_role;
comment on function public.toggle_committee_action_item_checklist(uuid, boolean) is
  'Toggle a checklist subtask done/undone; stamps completed_at/completed_by on '
  'true, clears both on false (mirrors the hub''s completed_* pattern). Authority: '
  'reader-with-a-stake (HC0I2). Audited (action_item.checklist.updated).';

-- --- update_committee_action_item_checklist (title/order) ------------------
create or replace function public.update_committee_action_item_checklist(
  p_id uuid,
  p_title text,
  p_sort_order integer default null
)
returns public.action_item_checklists
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_action_item_id uuid;
  v_result public.action_item_checklists;
begin
  if not app.feature_enabled('action_items') then
    raise exception 'recurso indisponível' using errcode = 'HC000';
  end if;
  select action_item_id into v_action_item_id
  from public.action_item_checklists where id = p_id;
  if v_action_item_id is null then
    raise exception 'item da checklist não encontrado' using errcode = 'no_data_found';
  end if;
  if not app.can_write_action_item_stake(v_action_item_id, v_uid) then
    raise exception 'você não pode gerenciar a checklist deste item' using errcode = 'HC0I2';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe o título do item da checklist' using errcode = 'check_violation';
  end if;

  update public.action_item_checklists
  set title = btrim(p_title),
      sort_order = coalesce(p_sort_order, sort_order),
      updated_at = now()
  where id = p_id returning * into v_result;

  return v_result;
end;
$$;

alter function public.update_committee_action_item_checklist(uuid, text, integer) owner to postgres;
revoke all on function public.update_committee_action_item_checklist(uuid, text, integer) from public;
grant execute on function public.update_committee_action_item_checklist(uuid, text, integer) to authenticated;
grant execute on function public.update_committee_action_item_checklist(uuid, text, integer) to service_role;
comment on function public.update_committee_action_item_checklist(uuid, text, integer) is
  'Edit a checklist subtask''s title/order (NOT done-state — use toggle). '
  'Authority: reader-with-a-stake (HC0I2). Audited (action_item.checklist.updated).';

-- --- delete_committee_action_item_checklist -------------------------------
create or replace function public.delete_committee_action_item_checklist(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_action_item_id uuid;
begin
  if not app.feature_enabled('action_items') then
    raise exception 'recurso indisponível' using errcode = 'HC000';
  end if;
  select action_item_id into v_action_item_id
  from public.action_item_checklists where id = p_id;
  if v_action_item_id is null then
    raise exception 'item da checklist não encontrado' using errcode = 'no_data_found';
  end if;
  if not app.can_write_action_item_stake(v_action_item_id, v_uid) then
    raise exception 'você não pode gerenciar a checklist deste item' using errcode = 'HC0I2';
  end if;

  delete from public.action_item_checklists where id = p_id;
end;
$$;

alter function public.delete_committee_action_item_checklist(uuid) owner to postgres;
revoke all on function public.delete_committee_action_item_checklist(uuid) from public;
grant execute on function public.delete_committee_action_item_checklist(uuid) to authenticated;
grant execute on function public.delete_committee_action_item_checklist(uuid) to service_role;
comment on function public.delete_committee_action_item_checklist(uuid) is
  'Hard-delete a checklist subtask. Authority: reader-with-a-stake (HC0I2). '
  'Audited (action_item.checklist.deleted).';
