-- ============================================================================
-- S1·N · Notifications engine — core (Phase 20; ADR 0076; build plan:
-- docs/plans/notifications-s1.md §1). One vertical deep for the pilot: in-app
-- notifications for CAPA action · section sign-off · meeting, actionable-to-me
-- only. The engine + schema are kind-agnostic (ADR 0076 decision 4) so later
-- surfaces (docs/indicator/RCA/case/referral scan arms, email) are additive.
--
-- This migration:
--   1. public.notifications — the per-user notification row. Own-row
--      SELECT/UPDATE(read_at) RLS; deliberately NO authenticated INSERT
--      policy and NO DELETE policy (BUG-SUP-002 lesson — a broad
--      authenticated write + attacker-controlled entity_type/entity_id/title
--      is a low-harm-but-real forgery vector even scoped to the caller's own
--      user_id). The ONLY write door is app.enqueue_notification.
--   2. public.notification_preferences — per-(user, surface) reminder
--      toggle, default on. Plain own-row RLS (SELECT/INSERT/UPDATE) — unlike
--      notifications, a forged own-row preference has zero security impact
--      (it only affects whether the caller gets reminded), so no DEFINER-only
--      door is warranted here; set_notification_preferences is a thin
--      validating upsert wrapper, not the sole write path.
--   3. app.assert_notifications_enabled() — the assert_*_enabled pattern.
--   4. app.enqueue_notification(...) — the single INSERT door (DEFINER).
--      Idempotent via ON CONFLICT (user_id, dedup_key) DO NOTHING. Silently
--      no-ops (returns false) when the notifications flag is OFF, the
--      recipient disabled that reminder surface (is_reminder = true only —
--      ADR 0076 decision 6: assignments are never suppressed), or a required
--      arg is null — callers are unrelated primary mutations (CAPA
--      assignment, meeting convocation, ...) that must never fail because
--      the notification side-channel is unavailable.
--   5. app.resolve_notifications_for(entity_type, entity_id) — auto-resolve
--      unresolved REMINDERS for an entity (assignments persist as history,
--      ADR 0076 decision 9). Also a silent no-op when the flag is OFF.
--   6. Public RPCs: mark_notification_read / mark_all_notifications_read /
--      set_notification_preferences (own-row, flag-asserting) and
--      compute_due_notifications (DEFINER batch scan; flag-OFF -> returns 0
--      rather than raising, so a scheduled pg_cron call is harmless while
--      OFF). HC0C0 = invalid surface, HC0C1 = notification not found/owned.
--   7. Feature flag `notifications`, inserted OFF (flips ON in the companion
--      migration 20260720000720 at the S1·N gate; seed.sql forces it ON for
--      local/E2E).
--
-- N sits OUTSIDE the Rule-11 audit trail by design (ADR 0076 decision 13 —
-- own-data, source events already audited, the notifications rows
-- self-evidence the reminder history). Ordinary own-row table, not
-- append-only; no app.audit_write calls in this migration.
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1 · public.notifications
-- -----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  commission_id uuid null references public.commissions(id) on delete cascade,
  kind text not null,
  milestone text not null,
  is_reminder boolean not null,
  entity_type text not null,
  entity_id uuid not null,
  title text not null,
  body text null,
  dedup_key text not null,
  read_at timestamptz null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint notifications_kind_check check (kind in ('capa', 'signoff', 'meeting')),
  constraint notifications_milestone_check check (milestone in (
    'assigned', 'requested', 'convoked', 'due_soon', 'overdue', 'pending', 'still_open', 'upcoming'
  )),
  constraint notifications_entity_type_check check (entity_type in (
    'capa_action', 'response_section_signoff', 'meeting'
  )),
  constraint notifications_title_not_blank check (btrim(title) <> ''),
  constraint notifications_user_dedup_key_uq unique (user_id, dedup_key)
);

comment on table public.notifications is
  'S1·N (ADR 0076): per-user in-app notification. commission_id is nullable — CAPA notifications carry NULL (capa_action has no commission, only a hospital via capa_plan). title/body are pt-BR SNAPSHOTS from config-level fields only (action title, form+section name, meeting title/date) — PHI-free by construction (Rule 12); never a live join, never answer/event/patient content. Own-row RLS; NO authenticated INSERT/DELETE policy — the only write door is app.enqueue_notification. Outside the Rule-11 audit trail by design (ADR 0076 decision 13).';

comment on column public.notifications.dedup_key is
  'Idempotency key, e.g. capa:{action_id}:overdue, signoff:{response_id}:still_open:2026-W29. Unique per (user_id, dedup_key) — a re-run of compute_due_notifications or a repeated event-driven call is always ON CONFLICT DO NOTHING.';

create index notifications_user_unread_idx on public.notifications (user_id, read_at)
  where read_at is null;
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_entity_unresolved_idx on public.notifications (entity_type, entity_id)
  where resolved_at is null and is_reminder = true;

alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

-- UPDATE own-row; column-level GRANT below further restricts writers to
-- read_at only (a client cannot re-target entity_type/title/etc via update).
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Deliberately NO insert / delete policy (BUG-SUP-002 posture — see header).

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- -----------------------------------------------------------------------------
-- 2 · public.notification_preferences
-- -----------------------------------------------------------------------------
create table public.notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  surface text not null,
  reminders_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_surface_check check (surface in ('capa', 'signoff', 'meeting')),
  constraint notification_preferences_pkey primary key (user_id, surface)
);

comment on table public.notification_preferences is
  'S1·N (ADR 0076): per-(user, surface) reminder toggle, default ON — absence of a row means enabled. Suppresses ONLY the reminder stream (is_reminder = true); assignments always deliver (decision 6). Plain own-row RLS (SELECT/INSERT/UPDATE) — unlike notifications, a forged own-row preference has no security impact.';

alter table public.notification_preferences enable row level security;

create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;

-- -----------------------------------------------------------------------------
-- 3 · Feature flag (OFF) — flips ON in the companion migration …000720.
-- -----------------------------------------------------------------------------
insert into app.feature_flags (key, enabled, description)
values (
  'notifications', false,
  'Central de notificações in-app (S1·N, ADR 0076): CAPA + assinatura de seção + reunião, orientado a evento + varredura agendada (compute_due_notifications), apenas lembretes, somente in-app. Desligado por padrão; ligado na migração …000720 no gate.'
)
on conflict (key) do update set description = excluded.description;

-- -----------------------------------------------------------------------------
-- 4 · app.assert_notifications_enabled() — mirrors assert_response_correction_enabled.
-- -----------------------------------------------------------------------------
create or replace function app.assert_notifications_enabled() returns void
  language plpgsql stable
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if not app.feature_enabled('notifications') then
    raise exception 'o recurso de notificações não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;
alter function app.assert_notifications_enabled() owner to postgres;

revoke all on function app.assert_notifications_enabled() from public;
grant execute on function app.assert_notifications_enabled() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5 · app.enqueue_notification(...) — the single write door (internal, not
--     public; called from event-hook mutations + compute_due_notifications).
--     Returns true iff a new row was inserted (false on suppression / dedup
--     conflict / missing arg / flag OFF) so compute_due_notifications can
--     report an accurate count.
-- -----------------------------------------------------------------------------
create or replace function app.enqueue_notification(
  p_user_id uuid,
  p_commission_id uuid,
  p_kind text,
  p_milestone text,
  p_is_reminder boolean,
  p_entity_type text,
  p_entity_id uuid,
  p_title text,
  p_body text,
  p_dedup_key text
) returns boolean
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_rows integer;
begin
  if p_user_id is null or p_entity_id is null or p_dedup_key is null
     or nullif(btrim(coalesce(p_title, '')), '') is null then
    return false;
  end if;

  if not app.feature_enabled('notifications') then
    return false;
  end if;

  -- ADR 0076 decision 6: reminders are per-kind suppressible; assignments
  -- (is_reminder = false) are never suppressed.
  if p_is_reminder and exists (
    select 1 from public.notification_preferences
    where user_id = p_user_id and surface = p_kind and reminders_enabled = false
  ) then
    return false;
  end if;

  insert into public.notifications (
    user_id, commission_id, kind, milestone, is_reminder,
    entity_type, entity_id, title, body, dedup_key
  ) values (
    p_user_id, p_commission_id, p_kind, p_milestone, p_is_reminder,
    p_entity_type, p_entity_id, btrim(p_title), nullif(btrim(coalesce(p_body, '')), ''), p_dedup_key
  )
  on conflict (user_id, dedup_key) do nothing;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;
alter function app.enqueue_notification(uuid, uuid, text, text, boolean, text, uuid, text, text, text) owner to postgres;

comment on function app.enqueue_notification(uuid, uuid, text, text, boolean, text, uuid, text, text, text) is
  'S1·N (ADR 0076): the SOLE insert door for public.notifications. SECURITY DEFINER, idempotent (ON CONFLICT (user_id, dedup_key) DO NOTHING), silently no-ops (returns false, never raises) when the flag is OFF, a required arg is missing, or the recipient disabled that reminder surface (reminders only — assignments never suppressed). Called from event-hook mutations (CAPA assignment, sign-off requested, meeting convocation) and from compute_due_notifications.';

revoke all on function app.enqueue_notification(uuid, uuid, text, text, boolean, text, uuid, text, text, text) from public;
grant execute on function app.enqueue_notification(uuid, uuid, text, text, boolean, text, uuid, text, text, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6 · app.resolve_notifications_for(entity_type, entity_id) — auto-resolve.
-- -----------------------------------------------------------------------------
create or replace function app.resolve_notifications_for(p_entity_type text, p_entity_id uuid) returns void
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if not app.feature_enabled('notifications') then
    return;
  end if;

  update public.notifications
  set resolved_at = now()
  where entity_type = p_entity_type
    and entity_id = p_entity_id
    and is_reminder = true
    and resolved_at is null;
end;
$$;
alter function app.resolve_notifications_for(text, uuid) owner to postgres;

comment on function app.resolve_notifications_for(text, uuid) is
  'S1·N (ADR 0076 decision 9): clears (resolved_at = now()) every unresolved REMINDER for an entity on task completion — assignments (is_reminder = false) are never touched, they persist as history. Called from CAPA-close, sign-off-sign, and meeting-conclude mutations. Silent no-op when the flag is OFF.';

revoke all on function app.resolve_notifications_for(text, uuid) from public;
grant execute on function app.resolve_notifications_for(text, uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7 · public.mark_notification_read(p_id) — own-row; HC0C1 not found/owned.
--     "Already read" is an idempotent success, not an error.
-- -----------------------------------------------------------------------------
create or replace function public.mark_notification_read(p_id uuid) returns void
  language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_rows integer;
begin
  perform app.assert_notifications_enabled();

  update public.notifications
  set read_at = now()
  where id = p_id and user_id = auth.uid() and read_at is null;
  get diagnostics v_rows = row_count;

  if v_rows = 0 and not exists (
    select 1 from public.notifications where id = p_id and user_id = auth.uid()
  ) then
    raise exception 'notificação não encontrada' using errcode = 'HC0C1';
  end if;
end;
$$;
alter function public.mark_notification_read(uuid) owner to postgres;

revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8 · public.mark_all_notifications_read() — own unread -> read.
-- -----------------------------------------------------------------------------
create or replace function public.mark_all_notifications_read() returns void
  language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  perform app.assert_notifications_enabled();

  update public.notifications
  set read_at = now()
  where user_id = auth.uid() and read_at is null;
end;
$$;
alter function public.mark_all_notifications_read() owner to postgres;

revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 9 · public.set_notification_preferences(p_surface, p_enabled) — own-row
--     upsert; HC0C0 invalid surface.
-- -----------------------------------------------------------------------------
create or replace function public.set_notification_preferences(p_surface text, p_enabled boolean) returns void
  language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  perform app.assert_notifications_enabled();

  if p_surface not in ('capa', 'signoff', 'meeting') then
    raise exception 'superfície de notificação inválida' using errcode = 'HC0C0';
  end if;

  insert into public.notification_preferences (user_id, surface, reminders_enabled)
  values (auth.uid(), p_surface, coalesce(p_enabled, true))
  on conflict (user_id, surface)
  do update set reminders_enabled = excluded.reminders_enabled, updated_at = now();
end;
$$;
alter function public.set_notification_preferences(text, boolean) owner to postgres;

revoke all on function public.set_notification_preferences(text, boolean) from public;
grant execute on function public.set_notification_preferences(text, boolean) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 10 · public.compute_due_notifications() — DEFINER batch scan (ADR 0076
--      decision 8: no manual "run now" — wired to pg_cron at the pilot-reset
--      deploy, not exposed to authenticated). Flag OFF -> returns 0 (a
--      scheduled cron call must never error just because the flag is off).
--      CAPA: due_soon (<=3d) / overdue / weekly still_open while overdue.
--      Sign-off: pending (>=3d since the first 'requested' notification for
--        that response) / weekly still_open while pending — the response's
--        own "became pending" timestamp doesn't exist on the schema, so this
--        anchors on our own event-driven notification history instead of
--        introducing new state (a deliberate S1 simplification).
--      Meeting: upcoming (scheduled for tomorrow, non-excused platform attendees).
-- -----------------------------------------------------------------------------
create or replace function public.compute_due_notifications() returns integer
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_count integer := 0;
  v_ok boolean;
  v_week text;
  r record;
  v_signers uuid[];
  v_signer uuid;
  v_first_requested timestamptz;
begin
  if not app.feature_enabled('notifications') then
    return 0;
  end if;

  v_week := to_char(now(), 'IYYY"-W"IW');

  -- ---- CAPA: due_soon / overdue / weekly still_open ----
  for r in
    select ca.id, ca.assignee_user_id, ca.title, ca.due_date
    from public.capa_action ca
    where ca.assignee_user_id is not null
      and ca.status in ('pending', 'in_progress')
      and ca.due_date is not null
  loop
    if r.due_date < current_date then
      v_ok := app.enqueue_notification(
        r.assignee_user_id, null, 'capa', 'overdue', true, 'capa_action', r.id,
        'Ação CAPA atrasada', r.title, 'capa:' || r.id || ':overdue'
      );
      if v_ok then v_count := v_count + 1; end if;

      v_ok := app.enqueue_notification(
        r.assignee_user_id, null, 'capa', 'still_open', true, 'capa_action', r.id,
        'Ação CAPA ainda em aberto', r.title, 'capa:' || r.id || ':still_open:' || v_week
      );
      if v_ok then v_count := v_count + 1; end if;

    elsif r.due_date <= current_date + 3 then
      v_ok := app.enqueue_notification(
        r.assignee_user_id, null, 'capa', 'due_soon', true, 'capa_action', r.id,
        'Ação CAPA vence em breve', r.title, 'capa:' || r.id || ':due_soon'
      );
      if v_ok then v_count := v_count + 1; end if;
    end if;
  end loop;

  -- ---- Sign-off: pending / weekly still_open (staff_admin-role sections only,
  -- mirrors list_signoff_queue's CTE shape). One response -> one representative
  -- reminder per authorized signer (not one per pending section). ----
  for r in
    with candidate as (
      select c.id as response_id, c.commission_id, c.form_version_id,
             app.answer_map(c.id) as answers
      from public.responses c
      where c.status = 'in_progress'
        and app.response_required_complete(c.id)
    )
    select distinct cd.response_id, cd.commission_id
    from candidate cd
    join public.form_sections s
      on s.form_version_id = cd.form_version_id
     and s.requires_signoff = true
     and s.signoff_role = 'staff_admin'
    where app.eval_condition(s.visible_when, cd.answers)
      and not exists (
        select 1 from public.response_section_signoffs so
        where so.response_id = cd.response_id and so.section_id = s.id
      )
  loop
    select min(created_at) into v_first_requested
    from public.notifications
    where entity_type = 'response_section_signoff'
      and entity_id = r.response_id
      and milestone = 'requested';

    if v_first_requested is not null and now() - v_first_requested >= interval '3 days' then
      select coalesce(array_agg(principal_id), '{}'::uuid[]) into v_signers
      from public.memberships
      where commission_id = r.commission_id and role = 'staff_admin';

      foreach v_signer in array v_signers
      loop
        v_ok := app.enqueue_notification(
          v_signer, r.commission_id, 'signoff', 'pending', true,
          'response_section_signoff', r.response_id,
          'Assinatura pendente', null, 'signoff:' || r.response_id || ':pending'
        );
        if v_ok then v_count := v_count + 1; end if;

        v_ok := app.enqueue_notification(
          v_signer, r.commission_id, 'signoff', 'still_open', true,
          'response_section_signoff', r.response_id,
          'Assinatura ainda pendente', null, 'signoff:' || r.response_id || ':still_open:' || v_week
        );
        if v_ok then v_count := v_count + 1; end if;
      end loop;
    end if;
  end loop;

  -- ---- Meeting: upcoming (scheduled for tomorrow) ----
  for r in
    select m.id, m.commission_id, m.title, ma.user_id
    from public.meetings m
    join public.meeting_attendees ma on ma.meeting_id = m.id
    where m.status = 'scheduled'
      and m.scheduled_start::date = current_date + 1
      and ma.user_id is not null
      and ma.attendance <> 'excused'
  loop
    v_ok := app.enqueue_notification(
      r.user_id, r.commission_id, 'meeting', 'upcoming', true, 'meeting', r.id,
      'Reunião amanhã', r.title, 'meeting:' || r.id || ':upcoming'
    );
    if v_ok then v_count := v_count + 1; end if;
  end loop;

  return v_count;
end;
$$;
alter function public.compute_due_notifications() owner to postgres;

comment on function public.compute_due_notifications() is
  'S1·N (ADR 0076 decision 8): DEFINER batch scan over CAPA + sign-off + meeting due/pending state, enqueueing via app.enqueue_notification (idempotent, prefs-aware). Returns the count of NEWLY inserted rows. No manual "run now" — wired to pg_cron at the pilot-reset deploy, NOT granted to authenticated (service_role/cron only). Flag OFF -> returns 0 without raising.';

revoke all on function public.compute_due_notifications() from public;
grant execute on function public.compute_due_notifications() to service_role;
