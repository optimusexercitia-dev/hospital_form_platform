-- Migration: Shared (non-PHI) action_items hub — Option A unification
-- ---------------------------------------------------------------------------
-- Unifies the two NON-PHI, membership-gated action-item sources — meetings +
-- manual — into ONE shared `public.action_items` hub, modeled on a partner
-- team's hub-and-spoke design but adapted to this platform (identity =
-- profiles.id / auth.uid(); tenancy anchor = commission_id NOT NULL; hard,
-- audited deletes — no soft-delete). New sources plug in via `source_type` with
-- zero schema change. Deliberately LEFT ALONE: `case_action_items` (its per-case
-- can_read_case access model is a later step) and CAPA (isolated, PHI, Rule 12).
--
-- No users exist yet, so this is a CLEAN drop-and-recreate — no data migration.
-- The old `public.meeting_action_items` table + its 4 RPCs + guard/core helpers
-- are DROPPED at the END of this migration (after the cross-source readers are
-- repointed).
--
-- Security posture (Architecture Rules 1, 9, 11):
--   * RLS ENABLED on all 5 new tables (Supabase best practice — every public
--     table). The hub uses FLAT membership (Option A) — identical to the old
--     meeting_action_items: members read; staff_admin/org_admin write.
--   * Satellites (assignments, status_history) + the config lookups are read
--     via SELECT policies; ALL writes funnel through SECURITY DEFINER RPCs
--     (no authenticated write policy on those tables).
--   * Every new public.* RPC: REVOKE ALL FROM PUBLIC then GRANT EXECUTE to
--     authenticated + service_role (dashboard t19 anon-exec guard); search_path
--     pinned; owned by postgres.
--   * Audit: this ADDS audit coverage the old meeting_action_items never had
--     (Rule 11 win) — every mutation emits one hash-chained audit_log row, gated
--     by feature_enabled('audit_trail').
--
-- Config vocabularies (statuses/urgency): configurable per-commission with a
-- normalized `category`; GLOBAL defaults (commission_id NULL) are seeded IN this
-- migration. Status keys are EXACTLY open/in_progress/done/cancelled so the
-- existing client label/style maps keep working unchanged.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. Config lookups — statuses + urgency levels (configurable; global defaults)
-- ===========================================================================

-- --- action_item_statuses -------------------------------------------------
create table if not exists public.action_item_statuses (
  id uuid default gen_random_uuid() not null,
  commission_id uuid,                        -- NULL = global default
  key text not null,
  label text not null,                       -- pt-BR
  category text not null,
  is_initial boolean default false not null,
  is_terminal boolean default false not null,
  sort_order integer default 0 not null,
  archived boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint action_item_statuses_pkey primary key (id),
  constraint action_item_statuses_key_not_blank check (btrim(key) <> ''),
  constraint action_item_statuses_label_not_blank check (btrim(label) <> ''),
  constraint action_item_statuses_category_check check (
    category = any (array[
      'draft', 'open', 'in_progress', 'blocked',
      'waiting_review', 'completed', 'cancelled'
    ])
  ),
  constraint action_item_statuses_commission_fkey
    foreign key (commission_id) references public.commissions (id) on delete cascade
);

alter table public.action_item_statuses owner to postgres;

comment on table public.action_item_statuses is
  'Configurable action-item lifecycle statuses (shared action_items hub). '
  'commission_id NULL = a GLOBAL default; a per-commission row (commission_id '
  'set) overrides/extends. category is the normalized bucket (open/in_progress/'
  'completed/cancelled/...); is_terminal drives "active/pending" (= is_terminal '
  'false). Global keys open/in_progress/done/cancelled are seeded here and the '
  'client label maps depend on them. Non-PHI; any-authenticated READ, '
  'DEFINER-RPC writes.';

-- Dual-unique: a global key is unique among globals; a per-commission key is
-- unique within its commission.
create unique index action_item_statuses_global_key_uidx
  on public.action_item_statuses (key) where commission_id is null;
create unique index action_item_statuses_commission_key_uidx
  on public.action_item_statuses (commission_id, key) where commission_id is not null;
create index action_item_statuses_commission_idx
  on public.action_item_statuses (commission_id);

-- --- action_item_urgency_levels -------------------------------------------
create table if not exists public.action_item_urgency_levels (
  id uuid default gen_random_uuid() not null,
  commission_id uuid,                        -- NULL = global default
  key text not null,
  label text not null,                       -- pt-BR
  rank integer default 0 not null,           -- higher = more urgent
  sort_order integer default 0 not null,
  archived boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint action_item_urgency_levels_pkey primary key (id),
  constraint action_item_urgency_levels_key_not_blank check (btrim(key) <> ''),
  constraint action_item_urgency_levels_label_not_blank check (btrim(label) <> ''),
  constraint action_item_urgency_levels_commission_fkey
    foreign key (commission_id) references public.commissions (id) on delete cascade
);

alter table public.action_item_urgency_levels owner to postgres;

comment on table public.action_item_urgency_levels is
  'Configurable action-item urgency levels (shared action_items hub). '
  'commission_id NULL = a GLOBAL default. rank orders severity (higher = more '
  'urgent). Global keys low/normal/high/critical are seeded here. Non-PHI; '
  'any-authenticated READ, DEFINER-RPC writes.';

create unique index action_item_urgency_levels_global_key_uidx
  on public.action_item_urgency_levels (key) where commission_id is null;
create unique index action_item_urgency_levels_commission_key_uidx
  on public.action_item_urgency_levels (commission_id, key) where commission_id is not null;
create index action_item_urgency_levels_commission_idx
  on public.action_item_urgency_levels (commission_id);

-- ===========================================================================
-- 2. Core hub — action_items
-- ===========================================================================
create table if not exists public.action_items (
  id uuid default gen_random_uuid() not null,
  commission_id uuid not null,               -- tenancy anchor (RLS predicate)
  source_type text not null,                 -- 'meeting' | 'manual'
  -- Meeting cross-links (present only when source_type = 'meeting'):
  source_meeting_id uuid,
  source_agenda_item_id uuid,
  case_id uuid,                              -- optional same-commission cross-link
  title text not null,
  description text,
  status_id uuid not null,
  urgency_id uuid,
  due_date date,
  assigned_to uuid,                          -- fast, indexed primary-owner pointer
  created_by uuid,
  completed_at timestamptz,
  completed_by uuid,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint action_items_pkey primary key (id),
  constraint action_items_title_not_blank check (btrim(title) <> ''),
  constraint action_items_source_type_check check (source_type = any (array['meeting', 'manual'])),
  -- A meeting-sourced item MUST carry its meeting; a manual item must NOT.
  constraint action_items_meeting_link_check check (
    (source_type = 'meeting' and source_meeting_id is not null)
    or (source_type = 'manual' and source_meeting_id is null and source_agenda_item_id is null)
  ),
  constraint action_items_commission_fkey
    foreign key (commission_id) references public.commissions (id) on delete cascade,
  constraint action_items_source_meeting_fkey
    foreign key (source_meeting_id) references public.meetings (id) on delete cascade,
  constraint action_items_source_agenda_item_fkey
    foreign key (source_agenda_item_id) references public.meeting_agenda_items (id) on delete set null,
  constraint action_items_case_fkey
    foreign key (case_id) references public.cases (id) on delete set null,
  constraint action_items_status_fkey
    foreign key (status_id) references public.action_item_statuses (id),
  constraint action_items_urgency_fkey
    foreign key (urgency_id) references public.action_item_urgency_levels (id),
  constraint action_items_assigned_to_fkey
    foreign key (assigned_to) references public.profiles (id),
  constraint action_items_created_by_fkey
    foreign key (created_by) references public.profiles (id),
  constraint action_items_completed_by_fkey
    foreign key (completed_by) references public.profiles (id)
);

alter table public.action_items owner to postgres;

comment on table public.action_items is
  'Shared (non-PHI) action-item hub (Option A). One membership-gated to-do row '
  'per commission; source_type in (meeting, manual) — new sources plug in with '
  'zero schema change. commission_id is the tenancy anchor + RLS predicate. '
  'assigned_to is the fast primary-owner pointer (mirrored by an owner row in '
  'action_item_assignments). Status via status_id -> action_item_statuses; '
  '"active/pending" = the status is_terminal false. RLS: flat membership read, '
  'staff_admin/org_admin write; mutations go through the committee_* DEFINER '
  'RPCs and are audited. Case + CAPA action items are deliberately NOT here.';

-- Index every FK + the active/overdue partial index.
create index action_items_commission_idx on public.action_items (commission_id);
create index action_items_assigned_to_idx on public.action_items (assigned_to);
create index action_items_source_meeting_idx on public.action_items (source_meeting_id);
create index action_items_source_agenda_item_idx on public.action_items (source_agenda_item_id);
create index action_items_case_idx on public.action_items (case_id);
create index action_items_status_idx on public.action_items (status_id);
create index action_items_urgency_idx on public.action_items (urgency_id);
create index action_items_created_by_idx on public.action_items (created_by);
create index action_items_completed_by_idx on public.action_items (completed_by);

-- Active/overdue KPI helper: only non-terminal rows, keyed by (commission, due).
create index action_items_active_due_idx
  on public.action_items (commission_id, due_date)
  where completed_at is null;

-- ===========================================================================
-- 3. Satellite — action_item_assignments (multi-role; one active owner)
-- ===========================================================================
create table if not exists public.action_item_assignments (
  id uuid default gen_random_uuid() not null,
  action_item_id uuid not null,
  user_id uuid not null,
  role text not null,
  assigned_by uuid,
  assigned_at timestamptz default now() not null,
  completed_at timestamptz,
  note text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint action_item_assignments_pkey primary key (id),
  constraint action_item_assignments_role_check check (
    role = any (array['owner', 'contributor', 'reviewer', 'approver', 'observer'])
  ),
  constraint action_item_assignments_item_fkey
    foreign key (action_item_id) references public.action_items (id) on delete cascade,
  constraint action_item_assignments_user_fkey
    foreign key (user_id) references public.profiles (id),
  constraint action_item_assignments_assigned_by_fkey
    foreign key (assigned_by) references public.profiles (id),
  constraint action_item_assignments_unique_role unique (action_item_id, user_id, role)
);

alter table public.action_item_assignments owner to postgres;

comment on table public.action_item_assignments is
  'Multi-role assignment satellite of action_items. The create/assign RPC writes '
  'an `owner` row mirroring action_items.assigned_to; a partial unique index '
  'enforces at most ONE active (completed_at NULL) owner per item. RLS: read via '
  'commission_of_action_item membership; writes are DEFINER-RPC only.';

create index action_item_assignments_item_idx on public.action_item_assignments (action_item_id);
create index action_item_assignments_user_idx on public.action_item_assignments (user_id);
create index action_item_assignments_assigned_by_idx on public.action_item_assignments (assigned_by);

-- One ACTIVE owner per item (a completed owner row does not block a new one).
create unique index action_item_assignments_one_active_owner_uidx
  on public.action_item_assignments (action_item_id)
  where role = 'owner' and completed_at is null;

-- ===========================================================================
-- 4. Satellite — action_item_status_history (append-only status log)
-- ===========================================================================
create table if not exists public.action_item_status_history (
  id uuid default gen_random_uuid() not null,
  action_item_id uuid not null,
  from_status_id uuid,
  to_status_id uuid not null,
  changed_by uuid,
  comment text,
  metadata jsonb default '{}'::jsonb not null,
  changed_at timestamptz default now() not null,
  constraint action_item_status_history_pkey primary key (id),
  constraint action_item_status_history_item_fkey
    foreign key (action_item_id) references public.action_items (id) on delete cascade,
  constraint action_item_status_history_from_fkey
    foreign key (from_status_id) references public.action_item_statuses (id),
  constraint action_item_status_history_to_fkey
    foreign key (to_status_id) references public.action_item_statuses (id),
  constraint action_item_status_history_changed_by_fkey
    foreign key (changed_by) references public.profiles (id)
);

alter table public.action_item_status_history owner to postgres;

comment on table public.action_item_status_history is
  'Append-only status-transition log for action_items, written by '
  'advance_committee_action_item. RLS: read via commission_of_action_item '
  'membership; writes are DEFINER-RPC only.';

create index action_item_status_history_item_idx on public.action_item_status_history (action_item_id);
create index action_item_status_history_from_idx on public.action_item_status_history (from_status_id);
create index action_item_status_history_to_idx on public.action_item_status_history (to_status_id);
create index action_item_status_history_changed_by_idx on public.action_item_status_history (changed_by);

-- ===========================================================================
-- 5. Helper — commission_of_action_item (mirrors commission_of_case)
-- ===========================================================================
create or replace function app.commission_of_action_item(p_action_item_id uuid)
returns uuid
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select commission_id from public.action_items where id = p_action_item_id;
$$;

alter function app.commission_of_action_item(uuid) owner to postgres;
revoke all on function app.commission_of_action_item(uuid) from public;
grant all on function app.commission_of_action_item(uuid) to authenticated;
grant all on function app.commission_of_action_item(uuid) to service_role;

comment on function app.commission_of_action_item(uuid) is
  'The commission a shared action_item belongs to (for satellite RLS + audit). '
  'Mirrors app.commission_of_case.';

-- Resolve a commission/global status by key (for RPC status lookups). Prefers a
-- per-commission override, then the global default.
create or replace function app.action_item_status_by_key(p_commission_id uuid, p_key text)
returns uuid
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select id from public.action_item_statuses
  where key = p_key
    and archived = false
    and (commission_id = p_commission_id or commission_id is null)
  order by (commission_id is not null) desc
  limit 1;
$$;

alter function app.action_item_status_by_key(uuid, text) owner to postgres;
revoke all on function app.action_item_status_by_key(uuid, text) from public;
grant all on function app.action_item_status_by_key(uuid, text) to authenticated;
grant all on function app.action_item_status_by_key(uuid, text) to service_role;

comment on function app.action_item_status_by_key(uuid, text) is
  'Resolve an action_item_statuses id by key for a commission, preferring a '
  'per-commission override over the global default. Used by the committee_* RPCs.';

-- The commission/global INITIAL status (for create).
create or replace function app.action_item_initial_status(p_commission_id uuid)
returns uuid
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select id from public.action_item_statuses
  where is_initial = true
    and archived = false
    and (commission_id = p_commission_id or commission_id is null)
  order by (commission_id is not null) desc, sort_order asc
  limit 1;
$$;

alter function app.action_item_initial_status(uuid) owner to postgres;
revoke all on function app.action_item_initial_status(uuid) from public;
grant all on function app.action_item_initial_status(uuid) to authenticated;
grant all on function app.action_item_initial_status(uuid) to service_role;

comment on function app.action_item_initial_status(uuid) is
  'The initial (is_initial) action_item status for a commission, preferring a '
  'per-commission override over the global default. Used by create_committee_action_item.';

-- ===========================================================================
-- 6. Guard trigger — same-commission integrity (mirrors guard_meeting_action_item)
-- ===========================================================================
create or replace function app.guard_action_item()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_meeting_commission uuid;
  v_case_commission uuid;
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

  -- An optional case cross-link must be in the same commission (HC032).
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

create or replace trigger guard_action_item_trg
  before insert or update on public.action_items
  for each row execute function app.guard_action_item();

-- ===========================================================================
-- 7. Audit triggers (Rule 11) — gated inside app.audit_write by audit_trail
-- ===========================================================================

-- Core hub audit: INSERT/UPDATE/DELETE -> action_item.<verb>.
create or replace function app.trg_audit_action_items()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_cols constant text[] := array[
    'source_type', 'status_id', 'urgency_id', 'due_date', 'assigned_to', 'case_id'
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

create or replace trigger audit_action_items_trg
  after insert or update or delete on public.action_items
  for each row execute function app.trg_audit_action_items();

-- Status-history audit: each transition row -> action_item.status_changed.
create or replace function app.trg_audit_action_item_status_history()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_comm uuid := app.commission_of_action_item(new.action_item_id);
begin
  perform app.audit_write('action_item.status_changed', 'action_item', new.action_item_id, v_comm,
    'Estado do item de ação alterado',
    app.audit_diff(
      jsonb_build_object('status_id', new.from_status_id),
      jsonb_build_object('status_id', new.to_status_id),
      array['status_id']
    ));
  return null;
end;
$$;

alter function app.trg_audit_action_item_status_history() owner to postgres;

create or replace trigger audit_action_item_status_history_trg
  after insert on public.action_item_status_history
  for each row execute function app.trg_audit_action_item_status_history();

-- ===========================================================================
-- 8. RLS — enable + policies + grants
-- ===========================================================================

-- --- Lookups: any-authenticated READ; no authenticated write (DEFINER RPCs) ---
alter table public.action_item_statuses enable row level security;
create policy action_item_statuses_select on public.action_item_statuses
  for select to authenticated using (true);
grant all on table public.action_item_statuses to authenticated;
grant all on table public.action_item_statuses to service_role;

alter table public.action_item_urgency_levels enable row level security;
create policy action_item_urgency_levels_select on public.action_item_urgency_levels
  for select to authenticated using (true);
grant all on table public.action_item_urgency_levels to authenticated;
grant all on table public.action_item_urgency_levels to service_role;

-- --- Hub: flat membership read; staff_admin/org_admin write (mirror old table) ---
alter table public.action_items enable row level security;
create policy action_items_select on public.action_items
  for select to authenticated
  using (app.is_member_of(commission_id) or app.is_org_admin_of_commission(commission_id));
create policy action_items_staff_admin_write on public.action_items
  to authenticated
  using (app.is_staff_admin_of(commission_id) or app.is_org_admin_of_commission(commission_id))
  with check (app.is_staff_admin_of(commission_id) or app.is_org_admin_of_commission(commission_id));
grant all on table public.action_items to authenticated;
grant all on table public.action_items to service_role;

-- --- Satellites: read via commission_of_action_item membership; DEFINER writes ---
alter table public.action_item_assignments enable row level security;
create policy action_item_assignments_select on public.action_item_assignments
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_action_item(action_item_id))
    or app.is_org_admin_of_commission(app.commission_of_action_item(action_item_id))
  );
grant all on table public.action_item_assignments to authenticated;
grant all on table public.action_item_assignments to service_role;

alter table public.action_item_status_history enable row level security;
create policy action_item_status_history_select on public.action_item_status_history
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_action_item(action_item_id))
    or app.is_org_admin_of_commission(app.commission_of_action_item(action_item_id))
  );
grant all on table public.action_item_status_history to authenticated;
grant all on table public.action_item_status_history to service_role;

-- ===========================================================================
-- 9. Seed — GLOBAL default statuses + urgency levels (commission_id NULL)
-- ===========================================================================
-- Status keys are EXACTLY open/in_progress/done/cancelled (client label maps).
insert into public.action_item_statuses
  (commission_id, key, label, category, is_initial, is_terminal, sort_order)
values
  (null, 'open',        'Aberto',        'open',        true,  false, 1),
  (null, 'in_progress', 'Em andamento',  'in_progress', false, false, 2),
  (null, 'done',        'Concluído',     'completed',   false, true,  3),
  (null, 'cancelled',   'Cancelado',     'cancelled',   false, true,  4)
on conflict do nothing;

insert into public.action_item_urgency_levels
  (commission_id, key, label, rank, sort_order)
values
  (null, 'low',      'Baixa',   1, 1),
  (null, 'normal',   'Normal',  2, 2),
  (null, 'high',     'Alta',    3, 3),
  (null, 'critical', 'Crítica', 4, 4)
on conflict do nothing;

-- ===========================================================================
-- 10. Feature flag
-- ===========================================================================
insert into app.feature_flags (key, enabled, description) values
  ('action_items', true,
   'When true, the shared (non-PHI) action_items hub is live: the unified '
   'committee_* RPCs run, the meeting arm of list_my_action_items / '
   'get_member_overview reads the shared table, and the meetings UI writes to it. '
   'Replaces the old meeting_action_items table (dropped in this migration). '
   'Case + CAPA action items stay separate.')
on conflict (key) do update set enabled = excluded.enabled, description = excluded.description;

-- Public flag-reader RPC (mirrors cases_extras_enabled / meetings_enabled) so the
-- app layer can gate the shared action-items surface (e.g. the sidebar item)
-- without touching the locked-down app.feature_flags table directly.
create or replace function public.action_items_enabled()
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.feature_enabled('action_items');
$$;

alter function public.action_items_enabled() owner to postgres;
revoke all on function public.action_items_enabled() from public;
grant execute on function public.action_items_enabled() to authenticated;
grant execute on function public.action_items_enabled() to service_role;
comment on function public.action_items_enabled() is
  'Whether the shared action_items feature flag is ON. Public flag-reader over '
  'app.feature_enabled(''action_items''); mirrors cases_extras_enabled / '
  'meetings_enabled. Used by the app layer to gate the shared action-items surface.';

-- ===========================================================================
-- 11. RPCs — committee_* (SECURITY DEFINER; mirror the old meeting RPCs)
-- ===========================================================================

-- --- create_committee_action_item ----------------------------------------
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
  p_due_date date default null
)
returns public.action_items
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_status_id uuid;
  v_result public.action_items;
begin
  if not app.feature_enabled('action_items') then
    raise exception 'recurso indisponível' using errcode = 'HC000';
  end if;
  if p_source_type not in ('meeting', 'manual') then
    raise exception 'origem de item inválida' using errcode = 'check_violation';
  end if;
  if not (app.is_staff_admin_of(p_commission) or app.is_org_admin_of_commission(p_commission)) then
    raise exception 'você não pode criar itens de ação nesta comissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe o título do item' using errcode = 'check_violation';
  end if;
  if p_assigned_to is not null and not app.is_member_of_for(p_commission, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;
  if p_source_type = 'meeting' and p_meeting_id is null then
    raise exception 'informe a reunião de origem' using errcode = 'check_violation';
  end if;

  v_status_id := app.action_item_initial_status(p_commission);
  if v_status_id is null then
    raise exception 'nenhum estado inicial configurado' using errcode = 'no_data_found';
  end if;

  -- The meeting/agenda/case same-commission integrity is enforced by
  -- guard_action_item (HC032 / check_violation) on the INSERT below.
  insert into public.action_items
    (commission_id, source_type, source_meeting_id, source_agenda_item_id, case_id,
     title, description, status_id, urgency_id, due_date, assigned_to, created_by)
  values
    (p_commission, p_source_type,
     case when p_source_type = 'meeting' then p_meeting_id else null end,
     case when p_source_type = 'meeting' then p_agenda_item_id else null end,
     p_case_id, btrim(p_title), nullif(btrim(p_description), ''),
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

alter function public.create_committee_action_item(uuid, text, uuid, uuid, uuid, text, text, uuid, uuid, date) owner to postgres;
revoke all on function public.create_committee_action_item(uuid, text, uuid, uuid, uuid, text, text, uuid, uuid, date) from public;
grant execute on function public.create_committee_action_item(uuid, text, uuid, uuid, uuid, text, text, uuid, uuid, date) to authenticated;
grant execute on function public.create_committee_action_item(uuid, text, uuid, uuid, uuid, text, text, uuid, uuid, date) to service_role;
comment on function public.create_committee_action_item(uuid, text, uuid, uuid, uuid, text, text, uuid, uuid, date) is
  'Create a shared action item (source_type meeting|manual). staff_admin/'
  'org_admin of the commission. Sets the commission/global initial status and '
  'writes an owner assignment mirroring assigned_to. Same-commission integrity '
  'is enforced by guard_action_item. Audited (action_item.created).';

-- --- update_committee_action_item -----------------------------------------
create or replace function public.update_committee_action_item(
  p_id uuid,
  p_title text,
  p_description text default null,
  p_assigned_to uuid default null,
  p_urgency_id uuid default null,
  p_due_date date default null
)
returns public.action_items
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_commission_id uuid;
  v_result public.action_items;
begin
  if not app.feature_enabled('action_items') then
    raise exception 'recurso indisponível' using errcode = 'HC000';
  end if;
  select commission_id into v_commission_id
  from public.action_items where id = p_id;
  if v_commission_id is null then
    raise exception 'item de ação não encontrado' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe o título do item' using errcode = 'check_violation';
  end if;
  if p_assigned_to is not null and not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  update public.action_items
  set title = btrim(p_title),
      description = nullif(btrim(p_description), ''),
      assigned_to = p_assigned_to,
      urgency_id = p_urgency_id,
      due_date = p_due_date,
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

alter function public.update_committee_action_item(uuid, text, text, uuid, uuid, date) owner to postgres;
revoke all on function public.update_committee_action_item(uuid, text, text, uuid, uuid, date) from public;
grant execute on function public.update_committee_action_item(uuid, text, text, uuid, uuid, date) to authenticated;
grant execute on function public.update_committee_action_item(uuid, text, text, uuid, uuid, date) to service_role;
comment on function public.update_committee_action_item(uuid, text, text, uuid, uuid, date) is
  'Edit a shared action item (title/description/assignee/urgency/due). '
  'staff_admin/org_admin. Re-syncs the single active owner assignment. Status '
  'changes go through advance_committee_action_item. Audited (action_item.updated).';

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
  v_assigned_to uuid;
  v_from_status_id uuid;
  v_is_terminal boolean;
  v_status_commission uuid;
  v_result public.action_items;
begin
  if not app.feature_enabled('action_items') then
    raise exception 'recurso indisponível' using errcode = 'HC000';
  end if;
  select commission_id, assigned_to, status_id
    into v_commission_id, v_assigned_to, v_from_status_id
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

  -- Assignee OR staff_admin/org_admin (mirror advance_meeting_action_item_core).
  if not (
    (v_assigned_to is not null and v_assigned_to = v_uid)
    or app.is_staff_admin_of(v_commission_id)
    or app.is_org_admin_of_commission(v_commission_id)
  ) then
    raise exception 'você não pode alterar este item de ação' using errcode = 'HC037';
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
  'Advance a shared action item to another status. Authority: the assignee OR a '
  'staff_admin/org_admin of the commission (HC037 otherwise). Stamps completed_* '
  'on a terminal status and writes an action_item_status_history row. Audited '
  '(action_item.status_changed via the history trigger).';

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
  return public.advance_committee_action_item(p_id, v_done_id, null);
end;
$$;

alter function public.complete_committee_action_item(uuid) owner to postgres;
revoke all on function public.complete_committee_action_item(uuid) from public;
grant execute on function public.complete_committee_action_item(uuid) to authenticated;
grant execute on function public.complete_committee_action_item(uuid) to service_role;
comment on function public.complete_committee_action_item(uuid) is
  'Mark a shared action item done (resolves the commission/global `done` status '
  'and delegates to advance_committee_action_item). Same assignee-or-staff_admin '
  'gate (HC037).';

-- --- delete_committee_action_item (hard delete, audited) -------------------
create or replace function public.delete_committee_action_item(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission_id uuid;
begin
  if not app.feature_enabled('action_items') then
    raise exception 'recurso indisponível' using errcode = 'HC000';
  end if;
  select commission_id into v_commission_id from public.action_items where id = p_id;
  if v_commission_id is null then
    raise exception 'item de ação não encontrado' using errcode = 'no_data_found';
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
  'Hard-delete a shared action item (staff_admin/org_admin). Cascades to '
  'assignments + status_history. Audited (action_item.deleted). To CANCEL, '
  'advance to the `cancelled` status instead.';

-- ===========================================================================
-- 12. Repoint the two cross-source read RPCs (meeting arm -> shared table)
-- ===========================================================================
-- Both keep the CASE arm unchanged and keep returning the status `key`
-- (open/in_progress/done/cancelled) so the client is unaffected.

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
    -- CASE action items assigned to the caller (gated by `cases_extras`).
    select
      cai.due_date,
      cai.created_at,
      jsonb_build_object(
        'id', cai.id,
        'source', 'case',
        'title', cai.title,
        'description', cai.description,
        'status', cai.status,
        'due_date', cai.due_date,
        'created_at', cai.created_at,
        'created_by_name', cb.full_name,
        'case_id', c.id,
        'case_number', c.case_number,
        'case_label', c.label,
        'meeting_id', null,
        'meeting_number', null,
        'meeting_scheduled_start', null
      ) as row_obj
    from public.case_action_items cai
    join public.cases c on c.id = cai.case_id
    left join public.profiles cb on cb.id = cai.created_by
    where app.feature_enabled('cases_extras')
      and cai.assigned_to = v_uid
      and c.commission_id = p_commission

    union all

    -- SHARED action items assigned to the caller (gated by `action_items`).
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
  'Self-scoped (assigned_to = auth.uid()) union of the caller''s case + shared '
  '(meeting|manual) action items for one commission, ALL statuses. Case arm '
  'gated by cases_extras; shared arm by action_items — a source whose flag is '
  'off is OMITTED. Meeting-sourced rows carry meeting labels; manual rows carry '
  'none. Returns the status KEY. PHI-free; no audit row (reads the caller''s own items).';

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

  -- (2) Pending action items assigned to the caller (non-terminal status),
  -- plus how many are overdue (due_date < today). The case source is gated by
  -- cases_extras (status in open/in_progress); the shared source by action_items
  -- (pending = the status is_terminal false). A source whose flag is off
  -- contributes nothing.
  select
    count(*),
    count(*) filter (where due_date is not null and due_date < current_date)
    into v_pending_action_items, v_pending_overdue
  from (
    select cai.due_date
    from public.case_action_items cai
    join public.cases c on c.id = cai.case_id
    where v_cases_flag
      and cai.assigned_to = v_uid
      and c.commission_id = p_commission
      and cai.status in ('open', 'in_progress')

    union all

    select ai.due_date
    from public.action_items ai
    join public.action_item_statuses st on st.id = ai.status_id
    where v_action_items_flag
      and ai.assigned_to = v_uid
      and ai.commission_id = p_commission
      and st.is_terminal = false
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
  'action items now count the SHARED action_items (non-terminal status, gated by '
  'action_items) + case_action_items (open/in_progress). No audit row (reads the '
  'caller''s own aggregates).';

-- ===========================================================================
-- 13. Drop the old meeting_action_items surface (readers repointed above)
-- ===========================================================================
drop function if exists public.create_meeting_action_item(uuid, text, text, uuid, date, uuid, uuid);
drop function if exists public.update_meeting_action_item(uuid, text, text, uuid, date);
drop function if exists public.advance_meeting_action_item(uuid, text);
drop function if exists public.complete_meeting_action_item(uuid);
drop function if exists app.advance_meeting_action_item_core(uuid, text);
drop trigger if exists guard_meeting_action_item_trg on public.meeting_action_items;
drop function if exists app.guard_meeting_action_item();
drop table if exists public.meeting_action_items cascade;
