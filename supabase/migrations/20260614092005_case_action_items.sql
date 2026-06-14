-- Cases-Extras batch / R4: case ACTION ITEMS (systemic improvements).
--
-- A case has ONE macro status (R2) AND MANY action-item rows — distinct concerns.
-- One child table with a light status lifecycle (a simple CHECK, no full state
-- machine). Commission is derived via the case (not denormalized), matching
-- case_phases.
--
-- public.case_action_items — title/description, status (open/in_progress/done/
--   cancelled), assigned_to, due_date, source_case_phase_id (the phase whose
--   review generated it, ON DELETE SET NULL), created_by/at, updated_at,
--   completed_at/by.
--
-- RLS: members READ; staff_admin FULL write. Assignees advance THEIR OWN items
-- via a narrow RPC route (advance/complete_action_item — definer, internal
-- assigned_to=auth.uid() OR is_staff_admin_of gate, HC027 otherwise) rather than
-- a broad UPDATE policy — column control + the "mutations go through vetted RPCs"
-- ethos. Authoring (create/update/cancel) is staff_admin via RPCs. Both gate
-- cases_extras.
--
-- Reads: list_case_action_items is a plain RLS-scoped TABLE read (members read) —
-- done in the query layer, no RPC. case_action_items_kpis is definer + gated.
--
-- New SQLSTATE:
--   HC027 not entitled to update this action item.

-- ===========================================================================
-- public.case_action_items
-- ===========================================================================
create table public.case_action_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  -- The phase whose review generated this item (optional). ON DELETE SET NULL:
  -- deleting/detaching a phase never deletes the follow-up it produced.
  source_case_phase_id uuid references public.case_phases (id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'done', 'cancelled')),
  assigned_to uuid references public.profiles (id),
  due_date date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references public.profiles (id),
  constraint case_action_items_title_not_blank check (btrim(title) <> '')
);

alter table public.case_action_items enable row level security;
create index case_action_items_case_idx on public.case_action_items (case_id);
create index case_action_items_assigned_to_idx on public.case_action_items (assigned_to);

-- ===========================================================================
-- RLS — members read, staff_admin full write
-- ===========================================================================
-- Members READ (the per-case panel + the assignee seeing their own items). The
-- broad WRITE policy is staff_admin-only; an ASSIGNEE who is a plain staff member
-- does NOT get UPDATE here — they advance their item through the narrow definer
-- RPC below (which has its own assigned_to/staff_admin gate). This keeps column
-- control (an assignee can only move status, not reassign/retitle).
create policy case_action_items_select on public.case_action_items
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_case(case_id)) or app.is_admin()
  );

create policy case_action_items_staff_admin_write on public.case_action_items
  for all to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_admin()
  )
  with check (
    app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_admin()
  );

-- ===========================================================================
-- Authoring RPCs (staff_admin) — create / update / cancel
-- ===========================================================================
-- SECURITY INVOKER; RLS staff_admin-write is the authority + an explicit
-- is_staff_admin_of gate for a clean pt-BR forbidden. Gate cases_extras.

-- create_action_item(case, title, description, assigned_to, due_date, source_phase)
create function public.create_action_item(
  p_case_id uuid,
  p_title text,
  p_description text default null,
  p_assigned_to uuid default null,
  p_due_date date default null,
  p_source_case_phase_id uuid default null
)
returns public.case_action_items
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_result public.case_action_items;
begin
  perform app.assert_extras_enabled();

  v_commission_id := app.commission_of_case(p_case_id);
  if v_commission_id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe o título do item' using errcode = 'check_violation';
  end if;

  -- If assigned, the assignee must be a member of the case's commission.
  if p_assigned_to is not null and not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  -- A source phase, if given, must belong to THIS case.
  if p_source_case_phase_id is not null and not exists (
    select 1 from public.case_phases where id = p_source_case_phase_id and case_id = p_case_id
  ) then
    raise exception 'a fase de origem não pertence a este caso' using errcode = 'check_violation';
  end if;

  insert into public.case_action_items
    (case_id, source_case_phase_id, title, description, assigned_to, due_date, created_by)
  values
    (p_case_id, p_source_case_phase_id, btrim(p_title), nullif(btrim(p_description), ''),
     p_assigned_to, p_due_date, auth.uid())
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.create_action_item(uuid, text, text, uuid, date, uuid)
  to authenticated, service_role;
revoke all on function public.create_action_item(uuid, text, text, uuid, date, uuid)
  from public, anon;

-- update_action_item(id, title, description, assigned_to, due_date) — staff_admin
-- edits the editable fields (NOT status — that goes through advance/complete).
create function public.update_action_item(
  p_action_item_id uuid,
  p_title text,
  p_description text default null,
  p_assigned_to uuid default null,
  p_due_date date default null
)
returns public.case_action_items
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_case_id uuid;
  v_commission_id uuid;
  v_result public.case_action_items;
begin
  perform app.assert_extras_enabled();

  select case_id into v_case_id from public.case_action_items where id = p_action_item_id;
  if v_case_id is null then
    raise exception 'item % não encontrado', p_action_item_id using errcode = 'no_data_found';
  end if;
  v_commission_id := app.commission_of_case(v_case_id);
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe o título do item' using errcode = 'check_violation';
  end if;
  if p_assigned_to is not null and not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  update public.case_action_items
  set title = btrim(p_title),
      description = nullif(btrim(p_description), ''),
      assigned_to = p_assigned_to,
      due_date = p_due_date,
      updated_at = now()
  where id = p_action_item_id
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.update_action_item(uuid, text, text, uuid, date)
  to authenticated, service_role;
revoke all on function public.update_action_item(uuid, text, text, uuid, date)
  from public, anon;

-- ===========================================================================
-- Lifecycle RPCs — assignee OR staff_admin (narrow gate, HC027)
-- ===========================================================================
-- app.advance_action_item_core(id, status) — the shared gated mutation. SECURITY
-- DEFINER so it can bypass the (staff_admin-only) UPDATE RLS for a legitimate
-- ASSIGNEE; the internal gate is the authority: the caller must be the item's
-- assignee OR a staff_admin/admin of the case's commission (HC027 otherwise). It
-- stamps completed_at/by when entering 'done' and clears them when leaving it.
create function app.advance_action_item_core(
  p_action_item_id uuid,
  p_status text
)
returns public.case_action_items
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_case_id uuid;
  v_assigned_to uuid;
  v_commission_id uuid;
  v_uid uuid := auth.uid();
  v_result public.case_action_items;
begin
  if p_status not in ('open', 'in_progress', 'done', 'cancelled') then
    raise exception 'estado de item inválido' using errcode = 'check_violation';
  end if;

  select case_id, assigned_to into v_case_id, v_assigned_to
  from public.case_action_items where id = p_action_item_id;
  if v_case_id is null then
    raise exception 'item % não encontrado', p_action_item_id using errcode = 'no_data_found';
  end if;
  v_commission_id := app.commission_of_case(v_case_id);

  -- Authority: the assignee, or a staff_admin/admin of the case's commission.
  if not (
    (v_assigned_to is not null and v_assigned_to = v_uid)
    or app.is_staff_admin_of(v_commission_id)
    or app.is_admin()
  ) then
    raise exception 'você não pode alterar este item de ação' using errcode = 'HC027';
  end if;

  update public.case_action_items
  set status = p_status,
      completed_at = case when p_status = 'done' then coalesce(completed_at, now()) else null end,
      completed_by = case when p_status = 'done' then coalesce(completed_by, v_uid) else null end,
      updated_at = now()
  where id = p_action_item_id
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function app.advance_action_item_core(uuid, text) from public;
grant execute on function app.advance_action_item_core(uuid, text) to authenticated, service_role;

-- advance_action_item(id, status) -> item (public entry; gates cases_extras)
create function public.advance_action_item(
  p_action_item_id uuid,
  p_status text
)
returns public.case_action_items
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
begin
  perform app.assert_extras_enabled();
  return app.advance_action_item_core(p_action_item_id, p_status);
end;
$$;

grant execute on function public.advance_action_item(uuid, text) to authenticated, service_role;
revoke all on function public.advance_action_item(uuid, text) from public, anon;

-- complete_action_item(id) -> item. Convenience over advance(... 'done'); same gate.
create function public.complete_action_item(p_action_item_id uuid)
returns public.case_action_items
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
begin
  perform app.assert_extras_enabled();
  return app.advance_action_item_core(p_action_item_id, 'done');
end;
$$;

grant execute on function public.complete_action_item(uuid) to authenticated, service_role;
revoke all on function public.complete_action_item(uuid) from public, anon;

-- NOTE on CANCEL vs DELETE: there is no dedicated cancel_action_item RPC.
--   * CANCEL (set status='cancelled', keeping the audit row) flows through
--     advance_action_item(id,'cancelled') — assignee OR staff_admin (HC027 gate).
--   * HARD-DELETE (remove a mistakenly-created item) is a direct DELETE on
--     case_action_items, authorized by the staff_admin-write RLS policy (the
--     deleteActionItem server action). This keeps the posted frontend stub
--     signatures stable (createActionItem/updateActionItem/deleteActionItem +
--     advanceActionItem/completeActionItem) without a redundant cancel path.

-- ===========================================================================
-- case_action_items_kpis(commission) -> open / overdue / completed_ytd
-- ===========================================================================
-- SECURITY DEFINER, internally is_staff_admin_of/admin-gated (mirror the
-- dashboard KPIs). Returns zeroed counts (a single row) to a non-staff_admin —
-- the caller reads .open/.overdue/.completed_ytd directly. open = open +
-- in_progress; overdue = those with a past due_date; completed_ytd = done with
-- completed_at in the current calendar year. Reads do NOT gate cases_extras.
create function public.case_action_items_kpis(p_commission_id uuid)
returns table (
  open bigint,
  overdue bigint,
  completed_ytd bigint
)
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    return query select 0::bigint, 0::bigint, 0::bigint;
    return;
  end if;

  return query
  select
    count(*) filter (where ai.status in ('open', 'in_progress')) as open,
    count(*) filter (
      where ai.status in ('open', 'in_progress')
        and ai.due_date is not null
        and ai.due_date < current_date
    ) as overdue,
    count(*) filter (
      where ai.status = 'done'
        and ai.completed_at is not null
        and date_trunc('year', ai.completed_at) = date_trunc('year', now())
    ) as completed_ytd
  from public.case_action_items ai
  join public.cases c on c.id = ai.case_id
  where c.commission_id = p_commission_id;
end;
$$;

grant execute on function public.case_action_items_kpis(uuid) to authenticated, service_role;
revoke all on function public.case_action_items_kpis(uuid) from public, anon;
