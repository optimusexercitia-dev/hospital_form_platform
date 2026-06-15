-- Phase 10 / B2 (1 of 3): Meetings CHILDREN — agenda, attendees, cases,
-- action items + the child-lock guard + same-commission guards.
--
-- Four child tables of a meeting, each ON DELETE CASCADE from the parent. RLS
-- for all of them lands in the consolidated RLS migration (…090003); this
-- migration creates the tables, indexes, constraints, the child-content-lock
-- guard, and the same-commission BEFORE INSERT guards. meeting_signatures +
-- meeting_attachments land in their own migrations.
--
--   * meeting_agenda_items — ordered agenda/minutes items (planned description +
--     discussion notes + resolution). Deferrable-unique (meeting_id, position)
--     for the reorder swap.
--   * meeting_attendees — attendance + quorum. A platform user (user_id) XOR an
--     external guest (external_name / external_org), enforced by a CHECK +
--     partial-unique on (meeting_id, user_id) where user_id is not null (a
--     member appears at most once; guests are unconstrained).
--   * meeting_cases — the cases-discussed junction. Unique (meeting_id, case_id);
--     a BEFORE INSERT guard asserts the case is in the meeting's commission
--     (HC032). agenda_item_id optionally attaches the discussion to an item.
--   * meeting_action_items — the action plan (mirror case_action_items) with a
--     DENORMALIZED commission_id (for a direct RLS predicate, per the plan),
--     source_agenda_item_id (ON DELETE SET NULL) and an optional case_id
--     cross-link (same-commission guard, HC032).

-- ===========================================================================
-- meeting_agenda_items
-- ===========================================================================
create table public.meeting_agenda_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  position integer not null,
  title text not null,
  description text,
  discussion_notes text,
  resolution text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meeting_agenda_items_position_key
    unique (meeting_id, position) deferrable initially immediate,
  constraint meeting_agenda_items_title_not_blank check (btrim(title) <> '')
);

alter table public.meeting_agenda_items enable row level security;
create index meeting_agenda_items_meeting_idx on public.meeting_agenda_items (meeting_id);

-- ===========================================================================
-- meeting_attendees — platform user XOR external guest
-- ===========================================================================
-- role: presidente / secretario / membro / convidado.
-- attendance: convocado -> presente / ausente / justificado.
-- Only a PRESENT PLATFORM attendee (user_id not null, attendance='presente') may
-- e-sign (enforced by app.can_sign_meeting in the RLS migration).
create table public.meeting_attendees (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  user_id uuid references public.profiles (id),
  external_name text,
  external_org text,
  role text not null default 'membro'
    check (role in ('presidente', 'secretario', 'membro', 'convidado')),
  attendance text not null default 'convocado'
    check (attendance in ('convocado', 'presente', 'ausente', 'justificado')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A platform member XOR an external guest: exactly one identity source.
  constraint meeting_attendees_identity_xor check (
    (user_id is not null and external_name is null)
    or (user_id is null and nullif(btrim(external_name), '') is not null)
  )
);

alter table public.meeting_attendees enable row level security;
create index meeting_attendees_meeting_idx on public.meeting_attendees (meeting_id);
create index meeting_attendees_user_idx on public.meeting_attendees (user_id);
-- A platform member appears at most once per meeting (guests are unconstrained —
-- two guests may share a name). Partial so the XOR's null user_id rows are free.
create unique index meeting_attendees_meeting_user_key
  on public.meeting_attendees (meeting_id, user_id)
  where user_id is not null;

-- ===========================================================================
-- meeting_cases — cases discussed (junction)
-- ===========================================================================
create table public.meeting_cases (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  agenda_item_id uuid references public.meeting_agenda_items (id) on delete set null,
  summary text,
  decision text,
  created_at timestamptz not null default now(),
  constraint meeting_cases_meeting_case_key unique (meeting_id, case_id)
);

alter table public.meeting_cases enable row level security;
create index meeting_cases_meeting_idx on public.meeting_cases (meeting_id);
create index meeting_cases_case_idx on public.meeting_cases (case_id);
create index meeting_cases_agenda_item_idx on public.meeting_cases (agenda_item_id);

-- ===========================================================================
-- meeting_action_items — action plan (mirror case_action_items)
-- ===========================================================================
-- commission_id is DENORMALIZED (the meeting's commission) so RLS uses a direct
-- predicate rather than a meeting join (per the plan). The B3 create RPC sets it
-- from the meeting; a same-commission guard keeps it honest and validates the
-- optional case_id cross-link (HC032).
create table public.meeting_action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  commission_id uuid not null references public.commissions (id) on delete cascade,
  source_agenda_item_id uuid references public.meeting_agenda_items (id) on delete set null,
  case_id uuid references public.cases (id) on delete set null,
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
  constraint meeting_action_items_title_not_blank check (btrim(title) <> '')
);

alter table public.meeting_action_items enable row level security;
create index meeting_action_items_meeting_idx on public.meeting_action_items (meeting_id);
create index meeting_action_items_commission_idx on public.meeting_action_items (commission_id);
create index meeting_action_items_assigned_to_idx on public.meeting_action_items (assigned_to);
create index meeting_action_items_case_idx on public.meeting_action_items (case_id);

-- ===========================================================================
-- app.guard_meeting_cases — BEFORE INSERT/UPDATE: case & meeting share a
-- commission, and the optional agenda_item belongs to the same meeting (HC032)
-- ===========================================================================
-- SECURITY DEFINER so it reads both parents regardless of the caller's RLS (the
-- B3 link RPC has already confirmed staff_admin rights). Mirrors
-- guard_process_template_outcome.
create function app.guard_meeting_cases()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_meeting_commission uuid;
  v_case_commission uuid;
  v_agenda_meeting uuid;
begin
  select commission_id into v_meeting_commission
  from public.meetings where id = new.meeting_id;
  select commission_id into v_case_commission
  from public.cases where id = new.case_id;

  if v_meeting_commission is null or v_case_commission is null
     or v_meeting_commission <> v_case_commission then
    raise exception 'este caso pertence a outra comissão'
      using errcode = 'HC032';
  end if;

  -- An attached agenda item, if given, must belong to THIS meeting.
  if new.agenda_item_id is not null then
    select meeting_id into v_agenda_meeting
    from public.meeting_agenda_items where id = new.agenda_item_id;
    if v_agenda_meeting is distinct from new.meeting_id then
      raise exception 'o item de pauta não pertence a esta reunião'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_meeting_cases_trg
  before insert or update on public.meeting_cases
  for each row execute function app.guard_meeting_cases();

-- ===========================================================================
-- app.guard_meeting_action_item — BEFORE INSERT/UPDATE: denormalized
-- commission_id matches the meeting, and any case cross-link shares it (HC032)
-- ===========================================================================
create function app.guard_meeting_action_item()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_meeting_commission uuid;
  v_case_commission uuid;
begin
  select commission_id into v_meeting_commission
  from public.meetings where id = new.meeting_id;
  if v_meeting_commission is null then
    raise exception 'reunião não encontrada' using errcode = 'no_data_found';
  end if;

  -- Keep the denormalized commission honest (the RPC sets it; defend here).
  if new.commission_id <> v_meeting_commission then
    raise exception 'a comissão do item de ação não corresponde à reunião'
      using errcode = 'check_violation';
  end if;

  -- An optional case cross-link must be in the same commission.
  if new.case_id is not null then
    select commission_id into v_case_commission
    from public.cases where id = new.case_id;
    if v_case_commission is distinct from v_meeting_commission then
      raise exception 'este caso pertence a outra comissão' using errcode = 'HC032';
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_meeting_action_item_trg
  before insert or update on public.meeting_action_items
  for each row execute function app.guard_meeting_action_item();

-- ===========================================================================
-- app.guard_meeting_child_lock — freeze child rows once the meeting is locked
-- ===========================================================================
-- Sibling of app.guard_meeting_status (which freezes the meeting header/minutes
-- once status >= em_assinatura). This freezes the CHILD content tables
-- (agenda items, attendees, case links) the same way: any direct INSERT /
-- UPDATE / DELETE on a child of a locked meeting (>= em_assinatura) is rejected
-- unless app.in_meeting_rpc = 'on'. The B3 conclude/reopen RPCs set the flag
-- for the legitimate lock/unlock writes; reopen moves the meeting back to
-- realizada, which unlocks the children again.
--
-- NOTE: meeting_signatures is DELIBERATELY NOT guarded here — signing happens
-- WHILE the meeting is em_assinatura (locked), so the signatures table is the
-- one child that is written in the locked state. Its own sign-own-row RLS +
-- partial-unique + the sign_meeting RPC are its authority. meeting_action_items
-- is also excluded: action items have their own lifecycle and may be advanced
-- after the meeting is signed/distributed (a meeting being signed must not
-- freeze its follow-up plan).
--
-- DELIBERATELY does NOT honour app.in_meeting_rpc: unlike guard_meeting_status
-- (which the lifecycle RPCs legitimately bypass to flip the meeting's OWN
-- status), the child content lock keys PURELY on the parent meeting's status, so
-- that the authoring-child RPCs (which set the flag to satisfy the deferrable
-- ordering / their own writes) can STILL never edit a locked meeting's agenda /
-- attendees / case-links. The legitimate locked-state operations — conclude
-- (reads children only), reopen (writes signatures + the meeting row, never the
-- locked child tables) — touch none of these three tables, so they are
-- unaffected. Commission-cascade child deletes run as the table owner (triggers
-- on a cascade still fire, but the parent meeting is being deleted in the same
-- statement; a guarded child of a soon-deleted meeting is tolerated because the
-- meeting row delete went through guard_meeting_status under no flag only when
-- non-locked — locked meetings are blocked from deletion there too).
create function app.guard_meeting_child_lock()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_meeting_id uuid;
  v_status text;
begin
  v_meeting_id := case when tg_op = 'DELETE' then old.meeting_id else new.meeting_id end;
  select status into v_status from public.meetings where id = v_meeting_id;

  -- The parent meeting may already be gone (a cascade delete of the meeting also
  -- cascades its children); nothing to lock in that case.
  if v_status is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if v_status in ('em_assinatura', 'assinada', 'distribuida', 'cancelada') then
    raise exception 'o conteúdo desta reunião está bloqueado (%)', v_status
      using errcode = 'check_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger guard_meeting_child_lock_agenda_trg
  before insert or update or delete on public.meeting_agenda_items
  for each row execute function app.guard_meeting_child_lock();

create trigger guard_meeting_child_lock_attendees_trg
  before insert or update or delete on public.meeting_attendees
  for each row execute function app.guard_meeting_child_lock();

create trigger guard_meeting_child_lock_cases_trg
  before insert or update or delete on public.meeting_cases
  for each row execute function app.guard_meeting_child_lock();
