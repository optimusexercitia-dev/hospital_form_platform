-- Migration: Fold case action items into the shared action_items hub
-- ---------------------------------------------------------------------------
-- The shared (non-PHI) `public.action_items` hub (migration 20260706000000)
-- unified the MEETING + MANUAL sources but deliberately left the parallel
-- `public.case_action_items` table alone. This migration folds the CASE source
-- into the hub too, closing two gaps identified in a partner-team handoff:
--
--   1. Existence leak — the hub's optional `case_id` cross-link was visible to
--      every commission member (flat-membership SELECT), revealing a restricted
--      case's existence/title even though `cases` itself is gated by
--      app.can_read_case. This migration adds a per-row `visibility_scope` and a
--      scope-aware SELECT so a case-sourced (or coordinator-restricted) row is
--      only visible to those who can read its case.
--   2. Parallel schema — `case_action_items` duplicated the hub concept with a
--      weaker feature set (no status history, no multi-role assignments, no
--      urgency, NO audit triggers) and a different read predicate. It is DROPPED
--      at the end of this migration; the CASE source now plugs into the hub via
--      `source_type = 'case'` with the same satellites, audit, and RPC family.
--
-- Pre-launch: no users, no seeded case_action_items rows (verified) — this is a
-- clean drop-and-recreate, no data migration.
--
-- Security posture (Architecture Rules 1, 9, 11, 12):
--   * `visibility_scope` (committee | case_restricted | assignees_only) drives a
--     per-row read predicate via app.can_read_action_item. Case-sourced rows are
--     HARD-FORCED to `case_restricted` by the guard trigger so they never leak;
--     the disjuncts are ordered so the cheap `visibility_scope = '<x>'` equality
--     guards each helper call (supabase-postgres-best-practices
--     security-rls-performance).
--   * The case-source authority branches mirror the OLD case RPCs exactly:
--     create/update -> app.can_write_case_content (ADR 0033 D4); advance/complete
--     -> assignee OR content-writer (HC027); delete -> staff_admin/org_admin
--     (all sources). The case branch is additionally gated by
--     assert_extras_enabled() (the `cases_extras` flag; Q8).
--   * The hub audit trigger (Rule 11) now tracks source_case_id,
--     source_case_phase_id, visibility_scope — so case items finally gain the
--     audit coverage `case_action_items` never had.
--   * All writes still funnel through the SECURITY DEFINER committee_* RPCs; no
--     new authenticated write policy is introduced.
--
-- This migration must NOT edit 20260706000000 (it may already be applied
-- locally; remote-history rules). It is forward-only and additive.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. action_items — new columns (visibility_scope + case cross-links)
-- ===========================================================================
alter table public.action_items
  add column if not exists visibility_scope text not null default 'committee',
  add column if not exists source_case_id uuid,
  add column if not exists source_case_phase_id uuid;

-- visibility_scope: 3 values. `committee` (flat membership) is the default;
-- `case_restricted` follows app.can_read_case; `assignees_only` is the tightest.
alter table public.action_items
  add constraint action_items_visibility_scope_check check (
    visibility_scope = any (array['committee', 'case_restricted', 'assignees_only'])
  );

-- Extend source_type to add 'case'. (Drop the old 2-value CHECK, add the 3-value.)
alter table public.action_items
  drop constraint if exists action_items_source_type_check;
alter table public.action_items
  add constraint action_items_source_type_check check (
    source_type = any (array['meeting', 'manual', 'case'])
  );

-- Case cross-links: mirror the meeting pattern. source_case_id CASCADE (the item
-- dies with the case); source_case_phase_id SET NULL (survives phase deletion).
alter table public.action_items
  add constraint action_items_source_case_fkey
    foreign key (source_case_id) references public.cases (id) on delete cascade;
alter table public.action_items
  add constraint action_items_source_case_phase_fkey
    foreign key (source_case_phase_id) references public.case_phases (id) on delete set null;

-- Link CHECK. The OLD `action_items_meeting_link_check` (migration 20260706)
-- only covered source_type in (meeting, manual) and would reject every 'case'
-- row, so it is DROPPED and folded into ONE complete link CHECK covering all
-- three sources:
--   * case    -> source_case_id NOT NULL; NO meeting cols; NO cross-link case_id
--                (case linkage lives in source_case_id, not case_id);
--   * meeting -> source_meeting_id NOT NULL; NO source_case_* cols;
--   * manual  -> NO meeting cols AND NO source_case_* cols.
alter table public.action_items
  drop constraint if exists action_items_meeting_link_check;
alter table public.action_items
  add constraint action_items_case_link_check check (
    (
      source_type = 'case'
      and source_case_id is not null
      and source_meeting_id is null
      and source_agenda_item_id is null
      and case_id is null
    )
    or (
      source_type = 'meeting'
      and source_meeting_id is not null
      and source_case_id is null
      and source_case_phase_id is null
    )
    or (
      source_type = 'manual'
      and source_meeting_id is null
      and source_agenda_item_id is null
      and source_case_id is null
      and source_case_phase_id is null
    )
  );

comment on column public.action_items.visibility_scope is
  'Per-row read scope: committee (flat membership — the default), case_restricted '
  '(follows app.can_read_case on coalesce(source_case_id, case_id)), or '
  'assignees_only (active assignment / assigned_to, plus staff_admin/org_admin). '
  'HARD-FORCED to case_restricted for source_type=''case'' by guard_action_item; '
  'for meeting/manual rows the committee_* RPCs compute the default '
  '(case_restricted when cross-linked) with an explicit ''committee'' override.';
comment on column public.action_items.source_case_id is
  'The case this item was raised from (source_type=''case'' only; ON DELETE '
  'CASCADE). Distinct from `case_id`, which is the optional same-commission '
  'cross-link on meeting/manual rows.';
comment on column public.action_items.source_case_phase_id is
  'The case phase whose review generated this case-sourced item, if any '
  '(ON DELETE SET NULL). NULL for meeting/manual rows.';

-- Index both new FKs (per-row parent lookups in the read helper + audit).
create index if not exists action_items_source_case_idx
  on public.action_items (source_case_id);
create index if not exists action_items_source_case_phase_idx
  on public.action_items (source_case_phase_id);

-- ===========================================================================
-- 2. Guard trigger — extend for case-sourced rows
-- ===========================================================================
-- Adds, on top of the meeting/case_id/status/urgency integrity already there:
--   * case-sourced -> the source case is same-commission (HC032 pattern) and the
--     source_case_phase (if set) belongs to that case;
--   * HARD-FORCE visibility_scope := 'case_restricted' for source_type='case'
--     (INSERT + UPDATE) so a case item can never be made committee-visible.
create or replace function app.guard_action_item()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_meeting_commission uuid;
  v_case_commission uuid;
  v_source_case_commission uuid;
  v_status_commission uuid;
  v_urgency_commission uuid;
begin
  -- Meeting-sourced rows: the meeting (and agenda item) must belong to
  -- commission_id (the CHECK already forced source_meeting_id present).
  if new.source_type = 'meeting' then
    select commission_id into v_meeting_commission
    from public.meetings where id = new.source_meeting_id;
    if v_meeting_commission is null then
      raise exception 'reunião não encontrada' using errcode = 'no_data_found';
    end if;
    if new.commission_id <> v_meeting_commission then
      raise exception 'a comissão do item de ação não corresponde à reunião'
        using errcode = 'check_violation';
    end if;
    if new.source_agenda_item_id is not null and not exists (
      select 1 from public.meeting_agenda_items
      where id = new.source_agenda_item_id and meeting_id = new.source_meeting_id
    ) then
      raise exception 'o item de pauta de origem não pertence a esta reunião'
        using errcode = 'check_violation';
    end if;
  end if;

  -- Case-sourced rows: the source case must be same-commission (HC032), and the
  -- source phase (if any) must belong to that case. Then FORCE case_restricted.
  if new.source_type = 'case' then
    select commission_id into v_source_case_commission
    from public.cases where id = new.source_case_id;
    if v_source_case_commission is null then
      raise exception 'caso de origem não encontrado' using errcode = 'no_data_found';
    end if;
    if v_source_case_commission is distinct from new.commission_id then
      raise exception 'este caso pertence a outra comissão' using errcode = 'HC032';
    end if;
    if new.source_case_phase_id is not null and not exists (
      select 1 from public.case_phases
      where id = new.source_case_phase_id and case_id = new.source_case_id
    ) then
      raise exception 'a fase de origem não pertence a este caso'
        using errcode = 'check_violation';
    end if;
    -- Hard-force: a case item is ALWAYS case_restricted, on INSERT and UPDATE.
    new.visibility_scope := 'case_restricted';
  end if;

  -- An optional case cross-link (meeting/manual rows) must be same-commission.
  if new.case_id is not null then
    select commission_id into v_case_commission
    from public.cases where id = new.case_id;
    if v_case_commission is distinct from new.commission_id then
      raise exception 'este caso pertence a outra comissão' using errcode = 'HC032';
    end if;
  end if;

  -- The status must be global OR belong to this commission.
  select commission_id into v_status_commission
  from public.action_item_statuses where id = new.status_id;
  if v_status_commission is not null and v_status_commission <> new.commission_id then
    raise exception 'este estado pertence a outra comissão' using errcode = 'check_violation';
  end if;

  -- The urgency (if set) must be global OR belong to this commission.
  if new.urgency_id is not null then
    select commission_id into v_urgency_commission
    from public.action_item_urgency_levels where id = new.urgency_id;
    if v_urgency_commission is not null and v_urgency_commission <> new.commission_id then
      raise exception 'esta urgência pertence a outra comissão' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

alter function app.guard_action_item() owner to postgres;

-- ===========================================================================
-- 3. Helper — can_read_action_item (scope-aware per-row read predicate)
-- ===========================================================================
-- Q5 predicate. SECURITY DEFINER (bypasses RLS to consult cases/assignments):
--   committee       -> is_member_of / is_org_admin_of_commission
--   case_restricted -> can_read_case(coalesce(source_case_id, case_id))
--   assignees_only  -> active assignment OR assigned_to = uid,
--                       PLUS staff_admin / org_admin always
-- Disjuncts are ordered so the cheap `visibility_scope = '<x>'` equality guards
-- each (potentially per-row) helper call (security-rls-performance). An unknown
-- scope value is unreadable (fail-closed). EXPLAIN latitude: the satellites call
-- this per-row via commission_of_action_item today; the FK columns are indexed.
create or replace function app.can_read_action_item(p_action_item_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission_id uuid;
  v_scope text;
  v_source_case_id uuid;
  v_case_id uuid;
  v_assigned_to uuid;
begin
  select commission_id, visibility_scope, source_case_id, case_id, assigned_to
    into v_commission_id, v_scope, v_source_case_id, v_case_id, v_assigned_to
  from public.action_items where id = p_action_item_id;
  if v_commission_id is null then
    return false;
  end if;

  if v_scope = 'committee' then
    return app.is_member_of_for(v_commission_id, p_uid)
        or app.is_org_admin_of_commission_for(v_commission_id, p_uid);

  elsif v_scope = 'case_restricted' then
    return app.can_read_case(coalesce(v_source_case_id, v_case_id), p_uid);

  elsif v_scope = 'assignees_only' then
    return app.is_staff_admin_of_for(v_commission_id, p_uid)
        or app.is_org_admin_of_commission_for(v_commission_id, p_uid)
        or (v_assigned_to is not null and v_assigned_to = p_uid)
        or exists (
          select 1 from public.action_item_assignments a
          where a.action_item_id = p_action_item_id
            and a.user_id = p_uid
            and a.completed_at is null
        );
  end if;

  return false;
end;
$$;

alter function app.can_read_action_item(uuid, uuid) owner to postgres;
revoke all on function app.can_read_action_item(uuid, uuid) from public;
grant all on function app.can_read_action_item(uuid, uuid) to authenticated;
grant all on function app.can_read_action_item(uuid, uuid) to service_role;

comment on function app.can_read_action_item(uuid, uuid) is
  'Scope-aware per-row read predicate for the shared action_items hub. '
  'committee -> membership/org-admin; case_restricted -> can_read_case on '
  'coalesce(source_case_id, case_id); assignees_only -> active assignment / '
  'assigned_to plus staff_admin/org_admin. Disjuncts guarded by the cheap '
  'visibility_scope equality first (security-rls-performance). Used by the hub + '
  'both satellite SELECT policies.';

-- ===========================================================================
-- 4. Policies — scope-aware SELECT (hub + both satellites)
-- ===========================================================================
-- Hub: inline the scope disjuncts (row columns are available — same authority as
-- the helper, one fewer function call). Write policy is UNCHANGED.
drop policy if exists action_items_select on public.action_items;
create policy action_items_select on public.action_items
  for select to authenticated
  using (
    (
      visibility_scope = 'committee'
      and (app.is_member_of(commission_id) or app.is_org_admin_of_commission(commission_id))
    )
    or (
      visibility_scope = 'case_restricted'
      and app.can_read_case(coalesce(source_case_id, case_id), auth.uid())
    )
    or (
      visibility_scope = 'assignees_only'
      and (
        app.is_staff_admin_of(commission_id)
        or app.is_org_admin_of_commission(commission_id)
        or (assigned_to is not null and assigned_to = auth.uid())
        or exists (
          select 1 from public.action_item_assignments a
          where a.action_item_id = action_items.id
            and a.user_id = auth.uid()
            and a.completed_at is null
        )
      )
    )
  );

-- Satellites: call the helper (their parent row's columns aren't in scope here).
drop policy if exists action_item_assignments_select on public.action_item_assignments;
create policy action_item_assignments_select on public.action_item_assignments
  for select to authenticated
  using (app.can_read_action_item(action_item_id, auth.uid()));

drop policy if exists action_item_status_history_select on public.action_item_status_history;
create policy action_item_status_history_select on public.action_item_status_history
  for select to authenticated
  using (app.can_read_action_item(action_item_id, auth.uid()));

-- ===========================================================================
-- 5. Audit — add the new tracked columns to the hub audit trigger
-- ===========================================================================
create or replace function app.trg_audit_action_items()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_cols constant text[] := array[
    'source_type', 'status_id', 'urgency_id', 'due_date', 'assigned_to', 'case_id',
    'source_case_id', 'source_case_phase_id', 'visibility_scope'
  ];
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('action_item.created', 'action_item', new.id, new.commission_id,
      'Item de ação criado', app.audit_diff(null, to_jsonb(new), v_cols));
    return null;
  elsif tg_op = 'UPDATE' then
    perform app.audit_write('action_item.updated', 'action_item', new.id, new.commission_id,
      'Item de ação atualizado', app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
    return null;
  else
    perform app.audit_write('action_item.deleted', 'action_item', old.id, old.commission_id,
      'Item de ação removido', app.audit_diff(to_jsonb(old), null, v_cols));
    return null;
  end if;
end;
$$;

alter function app.trg_audit_action_items() owner to postgres;

-- ===========================================================================
-- 6. RPCs — extend the committee_* family for the CASE source
-- ===========================================================================
-- Adds p_source_case_phase_id + p_visibility_scope to create/update, and the
-- case-source authority branches per Q6. The `assert_extras_enabled()` gate
-- (cases_extras) additionally guards the case branch (Q8). HC021 member check +
-- owner-assignment mirroring apply to case rows too.

-- --- create_committee_action_item -----------------------------------------
create or replace function public.create_committee_action_item(
  p_commission uuid,
  p_source_type text,
  p_meeting_id uuid default null,
  p_agenda_item_id uuid default null,
  p_case_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_assigned_to uuid default null,
  p_urgency_id uuid default null,
  p_due_date date default null,
  p_source_case_phase_id uuid default null,
  p_visibility_scope text default null
)
returns public.action_items
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_status_id uuid;
  v_scope text;
  v_result public.action_items;
begin
  if not app.feature_enabled('action_items') then
    raise exception 'recurso indisponível' using errcode = 'HC000';
  end if;
  if p_source_type not in ('meeting', 'manual', 'case') then
    raise exception 'origem de item inválida' using errcode = 'check_violation';
  end if;

  -- Authority + case-source flag gate.
  if p_source_type = 'case' then
    perform app.assert_extras_enabled();  -- the case arm is gated by cases_extras (Q8)
    if p_case_id is null then
      raise exception 'informe o caso de origem' using errcode = 'check_violation';
    end if;
    -- Case create authority: content-writer of the case (ADR 0033 D4). The
    -- source case is validated same-commission by guard_action_item (HC032).
    if not app.can_write_case_content(p_case_id, v_uid) then
      raise exception 'você não pode criar itens de ação neste caso' using errcode = '42501';
    end if;
  else
    if not (app.is_staff_admin_of(p_commission) or app.is_org_admin_of_commission(p_commission)) then
      raise exception 'você não pode criar itens de ação nesta comissão' using errcode = '42501';
    end if;
    if p_source_type = 'meeting' and p_meeting_id is null then
      raise exception 'informe a reunião de origem' using errcode = 'check_violation';
    end if;
  end if;

  if nullif(btrim(p_title), '') is null then
    raise exception 'informe o título do item' using errcode = 'check_violation';
  end if;
  if p_assigned_to is not null and not app.is_member_of_for(p_commission, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  -- Resolve visibility_scope. For a case source the guard trigger hard-forces
  -- 'case_restricted' regardless, so we do not fight it here. For meeting/manual:
  -- an explicit value is validated; the default is 'case_restricted' when a case
  -- cross-link (p_case_id) is present, else 'committee'.
  if p_source_type = 'case' then
    v_scope := 'case_restricted';
  elsif p_visibility_scope is not null then
    if p_visibility_scope not in ('committee', 'case_restricted', 'assignees_only') then
      raise exception 'visibilidade inválida' using errcode = 'check_violation';
    end if;
    v_scope := p_visibility_scope;
  elsif p_case_id is not null then
    v_scope := 'case_restricted';
  else
    v_scope := 'committee';
  end if;

  v_status_id := app.action_item_initial_status(p_commission);
  if v_status_id is null then
    raise exception 'nenhum estado inicial configurado' using errcode = 'no_data_found';
  end if;

  -- Same-commission integrity (meeting/agenda/case/source-case/status/urgency) is
  -- enforced by guard_action_item (HC032 / check_violation) on the INSERT below.
  insert into public.action_items
    (commission_id, source_type, source_meeting_id, source_agenda_item_id, case_id,
     source_case_id, source_case_phase_id, visibility_scope,
     title, description, status_id, urgency_id, due_date, assigned_to, created_by)
  values
    (p_commission, p_source_type,
     case when p_source_type = 'meeting' then p_meeting_id else null end,
     case when p_source_type = 'meeting' then p_agenda_item_id else null end,
     case when p_source_type = 'case' then null else p_case_id end,
     case when p_source_type = 'case' then p_case_id else null end,
     case when p_source_type = 'case' then p_source_case_phase_id else null end,
     v_scope,
     btrim(p_title), nullif(btrim(p_description), ''),
     v_status_id, p_urgency_id, p_due_date, p_assigned_to, v_uid)
  returning * into v_result;

  -- Mirror assigned_to as the single active `owner` assignment.
  if p_assigned_to is not null then
    insert into public.action_item_assignments (action_item_id, user_id, role, assigned_by)
    values (v_result.id, p_assigned_to, 'owner', v_uid);
  end if;

  return v_result;
end;
$$;

alter function public.create_committee_action_item(uuid, text, uuid, uuid, uuid, text, text, uuid, uuid, date, uuid, text) owner to postgres;
revoke all on function public.create_committee_action_item(uuid, text, uuid, uuid, uuid, text, text, uuid, uuid, date, uuid, text) from public;
grant execute on function public.create_committee_action_item(uuid, text, uuid, uuid, uuid, text, text, uuid, uuid, date, uuid, text) to authenticated;
grant execute on function public.create_committee_action_item(uuid, text, uuid, uuid, uuid, text, text, uuid, uuid, date, uuid, text) to service_role;
comment on function public.create_committee_action_item(uuid, text, uuid, uuid, uuid, text, text, uuid, uuid, date, uuid, text) is
  'Create a shared action item (source_type meeting|manual|case). meeting/manual: '
  'staff_admin/org_admin, visibility computed (case_restricted when cross-linked, '
  'else committee; explicit p_visibility_scope overrides). case: content-writer of '
  'the case (ADR 0033 D4), gated by cases_extras, hard-forced case_restricted. '
  'Sets the initial status and writes an owner assignment mirroring assigned_to. '
  'Same-commission integrity via guard_action_item. Audited (action_item.created).';

-- Drop the OLD 10-arg signature (superseded by the 12-arg one above).
drop function if exists public.create_committee_action_item(uuid, text, uuid, uuid, uuid, text, text, uuid, uuid, date);

-- --- update_committee_action_item -----------------------------------------
create or replace function public.update_committee_action_item(
  p_id uuid,
  p_title text,
  p_description text default null,
  p_assigned_to uuid default null,
  p_urgency_id uuid default null,
  p_due_date date default null,
  p_visibility_scope text default null
)
returns public.action_items
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_commission_id uuid;
  v_source_type text;
  v_source_case_id uuid;
  v_result public.action_items;
begin
  if not app.feature_enabled('action_items') then
    raise exception 'recurso indisponível' using errcode = 'HC000';
  end if;
  select commission_id, source_type, source_case_id
    into v_commission_id, v_source_type, v_source_case_id
  from public.action_items where id = p_id;
  if v_commission_id is null then
    raise exception 'item de ação não encontrado' using errcode = 'no_data_found';
  end if;

  -- Authority per source.
  if v_source_type = 'case' then
    perform app.assert_extras_enabled();  -- Q8
    -- Case update authority: content-writer of the case (ADR 0033 D4).
    if not app.can_write_case_content(v_source_case_id, v_uid) then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
  else
    if not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
  end if;

  if nullif(btrim(p_title), '') is null then
    raise exception 'informe o título do item' using errcode = 'check_violation';
  end if;
  if p_assigned_to is not null and not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  -- visibility_scope: meaningful only for meeting/manual. For a case row the
  -- guard trigger re-forces case_restricted, so an incoming value is ignored.
  -- NULL leaves it unchanged (COALESCE). An explicit value is validated.
  if p_visibility_scope is not null
     and p_visibility_scope not in ('committee', 'case_restricted', 'assignees_only') then
    raise exception 'visibilidade inválida' using errcode = 'check_violation';
  end if;

  update public.action_items
  set title = btrim(p_title),
      description = nullif(btrim(p_description), ''),
      assigned_to = p_assigned_to,
      urgency_id = p_urgency_id,
      due_date = p_due_date,
      visibility_scope = coalesce(p_visibility_scope, visibility_scope),
      updated_at = now()
  where id = p_id returning * into v_result;

  -- Sync the single active `owner` assignment with assigned_to.
  update public.action_item_assignments
  set completed_at = now(), updated_at = now()
  where action_item_id = p_id and role = 'owner' and completed_at is null
    and (p_assigned_to is null or user_id <> p_assigned_to);

  if p_assigned_to is not null and not exists (
    select 1 from public.action_item_assignments
    where action_item_id = p_id and role = 'owner' and completed_at is null
      and user_id = p_assigned_to
  ) then
    insert into public.action_item_assignments (action_item_id, user_id, role, assigned_by)
    values (p_id, p_assigned_to, 'owner', v_uid);
  end if;

  return v_result;
end;
$$;

alter function public.update_committee_action_item(uuid, text, text, uuid, uuid, date, text) owner to postgres;
revoke all on function public.update_committee_action_item(uuid, text, text, uuid, uuid, date, text) from public;
grant execute on function public.update_committee_action_item(uuid, text, text, uuid, uuid, date, text) to authenticated;
grant execute on function public.update_committee_action_item(uuid, text, text, uuid, uuid, date, text) to service_role;
comment on function public.update_committee_action_item(uuid, text, text, uuid, uuid, date, text) is
  'Edit a shared action item (title/description/assignee/urgency/due/visibility). '
  'meeting/manual: staff_admin/org_admin. case: content-writer of the case '
  '(ADR 0033 D4), gated by cases_extras. p_visibility_scope null leaves it '
  'unchanged; a case row is re-forced to case_restricted by the guard. Re-syncs '
  'the single active owner assignment. Audited (action_item.updated).';

-- Drop the OLD 6-arg signature (superseded by the 7-arg one above).
drop function if exists public.update_committee_action_item(uuid, text, text, uuid, uuid, date);

-- --- advance_committee_action_item (writes status_history) -----------------
create or replace function public.advance_committee_action_item(
  p_id uuid,
  p_to_status_id uuid,
  p_comment text default null
)
returns public.action_items
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_commission_id uuid;
  v_source_type text;
  v_source_case_id uuid;
  v_assigned_to uuid;
  v_from_status_id uuid;
  v_is_terminal boolean;
  v_status_commission uuid;
  v_result public.action_items;
begin
  if not app.feature_enabled('action_items') then
    raise exception 'recurso indisponível' using errcode = 'HC000';
  end if;
  select commission_id, source_type, source_case_id, assigned_to, status_id
    into v_commission_id, v_source_type, v_source_case_id, v_assigned_to, v_from_status_id
  from public.action_items where id = p_id;
  if v_commission_id is null then
    raise exception 'item de ação não encontrado' using errcode = 'no_data_found';
  end if;

  -- The target status must exist and be global OR of this commission.
  select is_terminal, commission_id into v_is_terminal, v_status_commission
  from public.action_item_statuses where id = p_to_status_id and archived = false;
  if v_is_terminal is null then
    raise exception 'estado de item inválido' using errcode = 'check_violation';
  end if;
  if v_status_commission is not null and v_status_commission <> v_commission_id then
    raise exception 'este estado pertence a outra comissão' using errcode = 'check_violation';
  end if;

  -- Authority per source. case: the assignee OR a content-writer of the case
  -- (HC027 — mirrors the old advance_action_item_core, ADR 0033 D4); gated by
  -- cases_extras. meeting/manual: assignee OR staff_admin/org_admin (HC037).
  if v_source_type = 'case' then
    perform app.assert_extras_enabled();  -- Q8
    if not (
      (v_assigned_to is not null and v_assigned_to = v_uid)
      or app.can_write_case_content(v_source_case_id, v_uid)
    ) then
      raise exception 'você não pode alterar este item de ação' using errcode = 'HC027';
    end if;
  else
    if not (
      (v_assigned_to is not null and v_assigned_to = v_uid)
      or app.is_staff_admin_of(v_commission_id)
      or app.is_org_admin_of_commission(v_commission_id)
    ) then
      raise exception 'você não pode alterar este item de ação' using errcode = 'HC037';
    end if;
  end if;

  update public.action_items
  set status_id = p_to_status_id,
      completed_at = case when v_is_terminal then coalesce(completed_at, now()) else null end,
      completed_by = case when v_is_terminal then coalesce(completed_by, v_uid) else null end,
      updated_at = now()
  where id = p_id returning * into v_result;

  -- Log the transition (fires the status-history audit trigger).
  if v_from_status_id is distinct from p_to_status_id then
    insert into public.action_item_status_history
      (action_item_id, from_status_id, to_status_id, changed_by, comment)
    values
      (p_id, v_from_status_id, p_to_status_id, v_uid, nullif(btrim(p_comment), ''));
  end if;

  return v_result;
end;
$$;

alter function public.advance_committee_action_item(uuid, uuid, text) owner to postgres;
revoke all on function public.advance_committee_action_item(uuid, uuid, text) from public;
grant execute on function public.advance_committee_action_item(uuid, uuid, text) to authenticated;
grant execute on function public.advance_committee_action_item(uuid, uuid, text) to service_role;
comment on function public.advance_committee_action_item(uuid, uuid, text) is
  'Advance a shared action item to another status. Authority per source: case -> '
  'the assignee OR a content-writer of the case (HC027; ADR 0033 D4; gated by '
  'cases_extras); meeting/manual -> the assignee OR a staff_admin/org_admin '
  '(HC037). Stamps completed_* on a terminal status and writes an '
  'action_item_status_history row. Audited (action_item.status_changed).';

-- --- complete_committee_action_item (advance to `done`) --------------------
create or replace function public.complete_committee_action_item(p_id uuid)
returns public.action_items
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission_id uuid;
  v_done_id uuid;
begin
  if not app.feature_enabled('action_items') then
    raise exception 'recurso indisponível' using errcode = 'HC000';
  end if;
  select commission_id into v_commission_id from public.action_items where id = p_id;
  if v_commission_id is null then
    raise exception 'item de ação não encontrado' using errcode = 'no_data_found';
  end if;
  v_done_id := app.action_item_status_by_key(v_commission_id, 'done');
  if v_done_id is null then
    raise exception 'nenhum estado "concluído" configurado' using errcode = 'no_data_found';
  end if;
  -- Authority (per-source, incl. the case content-writer branch) is enforced by
  -- advance_committee_action_item.
  return public.advance_committee_action_item(p_id, v_done_id, null);
end;
$$;

alter function public.complete_committee_action_item(uuid) owner to postgres;
revoke all on function public.complete_committee_action_item(uuid) from public;
grant execute on function public.complete_committee_action_item(uuid) to authenticated;
grant execute on function public.complete_committee_action_item(uuid) to service_role;
comment on function public.complete_committee_action_item(uuid) is
  'Mark a shared action item done (resolves the commission/global `done` status '
  'and delegates to advance_committee_action_item, which enforces the per-source '
  'authority gate).';

-- --- delete_committee_action_item (hard delete, audited) -------------------
create or replace function public.delete_committee_action_item(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission_id uuid;
  v_source_type text;
begin
  if not app.feature_enabled('action_items') then
    raise exception 'recurso indisponível' using errcode = 'HC000';
  end if;
  select commission_id, source_type into v_commission_id, v_source_type
  from public.action_items where id = p_id;
  if v_commission_id is null then
    raise exception 'item de ação não encontrado' using errcode = 'no_data_found';
  end if;
  -- Delete authority is staff_admin/org_admin for ALL sources (Q6). A case row's
  -- delete is additionally gated by cases_extras (Q8).
  if v_source_type = 'case' then
    perform app.assert_extras_enabled();
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- Cascades to assignments + status_history; fires the delete audit trigger.
  delete from public.action_items where id = p_id;
end;
$$;

alter function public.delete_committee_action_item(uuid) owner to postgres;
revoke all on function public.delete_committee_action_item(uuid) from public;
grant execute on function public.delete_committee_action_item(uuid) to authenticated;
grant execute on function public.delete_committee_action_item(uuid) to service_role;
comment on function public.delete_committee_action_item(uuid) is
  'Hard-delete a shared action item (staff_admin/org_admin, all sources; a case '
  'row is additionally gated by cases_extras). Cascades to assignments + '
  'status_history. Audited (action_item.deleted). To CANCEL, advance to the '
  '`cancelled` status instead.';

-- ===========================================================================
-- 7. Readers repointed — collapse the case arm onto the hub
-- ===========================================================================

-- --- list_my_action_items -------------------------------------------------
-- The case arm now reads the hub via source_type='case' (gated by cases_extras),
-- joining `cases` through source_case_id for case_number/label; the meeting/manual
-- arm is unchanged. Return shape UNCHANGED: status KEY, source 'case'|'meeting'|
-- 'manual'. The two arms differ only by the flag that gates them.
create or replace function public.list_my_action_items(p_commission uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;

  select coalesce(
           jsonb_agg(
             row_obj
             order by (due_date is null), due_date asc, created_at desc
           ),
           '[]'::jsonb
         )
    into v_result
  from (
    -- CASE-sourced hub items assigned to the caller (gated by `cases_extras`).
    select
      ai.due_date,
      ai.created_at,
      jsonb_build_object(
        'id', ai.id,
        'source', 'case',
        'title', ai.title,
        'description', ai.description,
        'status', st.key,
        'due_date', ai.due_date,
        'created_at', ai.created_at,
        'created_by_name', ab.full_name,
        'case_id', c.id,
        'case_number', c.case_number,
        'case_label', c.label,
        'meeting_id', null,
        'meeting_number', null,
        'meeting_scheduled_start', null
      ) as row_obj
    from public.action_items ai
    join public.action_item_statuses st on st.id = ai.status_id
    join public.cases c on c.id = ai.source_case_id
    left join public.profiles ab on ab.id = ai.created_by
    where app.feature_enabled('cases_extras')
      and ai.source_type = 'case'
      and ai.assigned_to = v_uid
      and ai.commission_id = p_commission

    union all

    -- MEETING/MANUAL hub items assigned to the caller (gated by `action_items`).
    -- Meeting-sourced rows emit source='meeting' (+ meeting labels); manual rows
    -- emit source='manual'. Status is the joined status KEY (client-compatible).
    select
      ai.due_date,
      ai.created_at,
      jsonb_build_object(
        'id', ai.id,
        'source', ai.source_type,
        'title', ai.title,
        'description', ai.description,
        'status', st.key,
        'due_date', ai.due_date,
        'created_at', ai.created_at,
        'created_by_name', ab.full_name,
        'case_id', null,
        'case_number', null,
        'case_label', null,
        'meeting_id', m.id,
        'meeting_number', m.meeting_number,
        'meeting_scheduled_start', m.scheduled_start
      ) as row_obj
    from public.action_items ai
    join public.action_item_statuses st on st.id = ai.status_id
    left join public.meetings m on m.id = ai.source_meeting_id
    left join public.profiles ab on ab.id = ai.created_by
    where app.feature_enabled('action_items')
      and ai.source_type in ('meeting', 'manual')
      and ai.assigned_to = v_uid
      and ai.commission_id = p_commission
  ) rows;

  return v_result;
end;
$$;

alter function public.list_my_action_items(uuid) owner to postgres;
revoke all on function public.list_my_action_items(uuid) from public;
grant execute on function public.list_my_action_items(uuid) to authenticated;
grant execute on function public.list_my_action_items(uuid) to service_role;
comment on function public.list_my_action_items(uuid) is
  'Self-scoped (assigned_to = auth.uid()) union of the caller''s action items for '
  'one commission, ALL statuses, ALL now on the shared action_items hub. The '
  'case-sourced arm (source_type=''case'') is gated by cases_extras and carries '
  'case labels; the meeting/manual arm is gated by action_items and carries '
  'meeting labels. Returns the status KEY. PHI-free; no audit row.';

-- --- get_member_overview (pending action-item count) -----------------------
-- The pending-action-items union collapses to ONE hub source: case-sourced rows
-- gated by cases_extras, meeting/manual rows gated by action_items; pending =
-- the status is_terminal false. Everything else is unchanged.
create or replace function public.get_member_overview(p_commission uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_cases_flag boolean := app.feature_enabled('cases_extras');
  v_case_access_flag boolean := app.feature_enabled('case_access');
  v_meetings_flag boolean := app.feature_enabled('meetings');
  v_action_items_flag boolean := app.feature_enabled('action_items');

  v_cases_not_concluded int := 0;
  v_pending_action_items int := 0;
  v_pending_overdue int := 0;
  v_meetings_not_concluded int := 0;
  v_next_meeting_start timestamptz := null;
  v_pending_signatures int := 0;
  v_in_progress_responses int := 0;
begin
  if v_uid is null then
    return jsonb_build_object(
      'cases_not_concluded', 0,
      'pending_action_items', 0,
      'pending_action_items_overdue', 0,
      'meetings_not_concluded', 0,
      'next_meeting_start', null,
      'pending_signatures', 0,
      'in_progress_responses', 0
    );
  end if;

  -- (1) Cases not concluded — PERSONAL interpretation (ADR: the human spec).
  -- NB: the case_access grant leg gains the expiry filter in migration 20260708
  -- (which redefines this function once the expires_at column exists) — do NOT
  -- reference case_access.expires_at here; that column is added by 20260708.
  if v_cases_flag then
    select count(*) into v_cases_not_concluded
    from public.cases c
    where c.commission_id = p_commission
      and c.status not in ('concluido', 'cancelado')
      and (
        exists (
          select 1 from public.case_phases cp
          where cp.case_id = c.id and cp.assigned_to = v_uid
        )
        or exists (
          select 1 from public.case_narratives cn
          where cn.case_id = c.id and cn.assigned_to = v_uid
        )
        or (
          v_case_access_flag
          and exists (
            select 1 from public.case_access ca
            where ca.case_id = c.id and ca.user_id = v_uid
          )
        )
      );
  end if;

  -- (2) Pending action items assigned to the caller (non-terminal status), plus
  -- how many are overdue (due_date < today). ONE hub source now: case-sourced
  -- rows gated by cases_extras, meeting/manual rows by action_items. A flag that
  -- is off contributes nothing.
  select
    count(*),
    count(*) filter (where due_date is not null and due_date < current_date)
    into v_pending_action_items, v_pending_overdue
  from (
    select ai.due_date
    from public.action_items ai
    join public.action_item_statuses st on st.id = ai.status_id
    where ai.assigned_to = v_uid
      and ai.commission_id = p_commission
      and st.is_terminal = false
      and (
        (ai.source_type = 'case' and v_cases_flag)
        or (ai.source_type in ('meeting', 'manual') and v_action_items_flag)
      )
  ) pend;

  -- (3) Meetings not concluded the caller ATTENDS, + the next upcoming start.
  if v_meetings_flag then
    select
      count(*),
      min(m.scheduled_start) filter (where m.scheduled_start >= now())
      into v_meetings_not_concluded, v_next_meeting_start
    from public.meeting_attendees a
    join public.meetings m on m.id = a.meeting_id
    where a.user_id = v_uid
      and m.commission_id = p_commission
      and m.status in ('agendada', 'realizada', 'em_assinatura');
  end if;

  -- (4) Pending meeting-minute signatures.
  if v_meetings_flag then
    select count(*) into v_pending_signatures
    from public.meeting_attendees a
    join public.meetings m on m.id = a.meeting_id
    where a.user_id = v_uid
      and m.commission_id = p_commission
      and a.attendance = 'presente'
      and m.status = 'em_assinatura'
      and not exists (
        select 1 from public.meeting_signatures s
        where s.attendee_id = a.id and s.status = 'signed'
      );
  end if;

  -- (5) The caller's own in_progress form responses (drafts) in this commission.
  select count(*) into v_in_progress_responses
  from public.responses r
  where r.created_by = v_uid
    and r.commission_id = p_commission
    and r.status = 'in_progress';

  return jsonb_build_object(
    'cases_not_concluded', v_cases_not_concluded,
    'pending_action_items', v_pending_action_items,
    'pending_action_items_overdue', v_pending_overdue,
    'meetings_not_concluded', v_meetings_not_concluded,
    'next_meeting_start', v_next_meeting_start,
    'pending_signatures', v_pending_signatures,
    'in_progress_responses', v_in_progress_responses
  );
end;
$$;

alter function public.get_member_overview(uuid) owner to postgres;
revoke all on function public.get_member_overview(uuid) from public;
grant execute on function public.get_member_overview(uuid) to authenticated;
grant execute on function public.get_member_overview(uuid) to service_role;
comment on function public.get_member_overview(uuid) is
  'Self-scoped per-member "Visão Geral" for one commission: 5 counts + 2 hints '
  'in one round-trip. Flag-dependent counts return 0/null when off. Pending '
  'action items count the SHARED action_items hub (non-terminal status): the '
  'case-sourced arm gated by cases_extras, the meeting/manual arm by action_items. '
  'No audit row (reads the caller''s own aggregates).';

-- --- case_action_items_kpis (repointed to the hub, still staff_admin-gated) -
-- Q7: open = the status is_terminal false; completed_ytd = category 'completed'
-- this calendar year; overdue = open + past due. Reads case-sourced hub rows
-- (source_type='case'), joined to their case for the commission scope.
create or replace function public.case_action_items_kpis(p_commission_id uuid)
returns table(open bigint, overdue bigint, completed_ytd bigint)
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if not (app.is_staff_admin_of(p_commission_id) or app.is_org_admin_of_commission(p_commission_id)) then
    return query select 0::bigint, 0::bigint, 0::bigint;
    return;
  end if;

  return query
  select
    count(*) filter (where st.is_terminal = false) as open,
    count(*) filter (
      where st.is_terminal = false
        and ai.due_date is not null
        and ai.due_date < current_date
    ) as overdue,
    count(*) filter (
      where st.category = 'completed'
        and ai.completed_at is not null
        and date_trunc('year', ai.completed_at) = date_trunc('year', now())
    ) as completed_ytd
  from public.action_items ai
  join public.action_item_statuses st on st.id = ai.status_id
  where ai.source_type = 'case'
    and ai.commission_id = p_commission_id;
end;
$$;

alter function public.case_action_items_kpis(uuid) owner to postgres;
revoke all on function public.case_action_items_kpis(uuid) from public;
grant execute on function public.case_action_items_kpis(uuid) to authenticated;
grant execute on function public.case_action_items_kpis(uuid) to service_role;
comment on function public.case_action_items_kpis(uuid) is
  'Open / overdue / completed-YTD counts for a commission''s CASE-sourced action '
  'items, now read from the shared action_items hub (source_type=''case''). open = '
  'status is_terminal false; completed_ytd = status category ''completed'' this '
  'year (Q7). staff_admin/org_admin-gated (zeroed otherwise; no leak).';

-- ===========================================================================
-- 8. Drops — the old case-action-item surface (readers repointed above)
-- ===========================================================================
drop function if exists public.create_action_item(uuid, text, text, uuid, date, uuid);
drop function if exists public.update_action_item(uuid, text, text, uuid, date);
drop function if exists public.advance_action_item(uuid, text);
drop function if exists public.complete_action_item(uuid);
drop function if exists app.advance_action_item_core(uuid, text);
drop table if exists public.case_action_items cascade;

-- ===========================================================================
-- 9. Feature-flag descriptions — record the new topology (Q8)
-- ===========================================================================
-- `action_items` is the MASTER gate over the whole hub (all sources); `cases_extras`
-- additionally gates the case-sourced arms (RPC branch, KPIs, reader arm).
insert into app.feature_flags (key, enabled, description) values
  ('action_items', true,
   'Master gate over the shared (non-PHI) action_items hub (all sources — '
   'meeting, manual, case). When true the unified committee_* RPCs run and the '
   'meeting/manual arm of list_my_action_items / get_member_overview reads the '
   'hub. The CASE source was folded in (migration 20260707): case action items '
   'now live on the hub (source_type=''case'', hard-forced case_restricted) and '
   'the case-sourced arms are ADDITIONALLY gated by cases_extras. The old '
   'case_action_items + meeting_action_items tables are dropped. CAPA action '
   'items stay separate (PHI, Rule 12).')
on conflict (key) do update set enabled = excluded.enabled, description = excluded.description;

insert into app.feature_flags (key, enabled, description) values
  ('cases_extras', true,
   'When true, the Cases-Extras write RPCs (configurable case status set + '
   'set_case_status, documents/events, tags) are live. Case ACTION ITEMS were '
   'folded into the shared action_items hub (migration 20260707): the '
   'case-sourced arms of the committee_* RPCs, case_action_items_kpis, and the '
   'case arm of list_my_action_items / get_member_overview are gated by BOTH '
   'action_items (master) AND cases_extras. The modified core phase RPCs keep '
   'gating only cases_multi_phase.')
on conflict (key) do update set enabled = excluded.enabled, description = excluded.description;
