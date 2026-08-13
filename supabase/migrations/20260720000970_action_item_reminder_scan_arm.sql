-- ============================================================================
-- BE-6·N · Action-item reminder → Notifications scan arm (AI·sat × S1·N)
-- Plan: docs/plans/action-items-satellites.md §3 (X-ζ scan-arm contract) +
-- §9 Open decision #3 (locked). ADR 0050 (AI·sat) × ADR 0076 (N engine).
--
-- Wires the inert `action_item_reminders` RULES table (migration
-- …000950_action_item_satellites) into N's live batch scan
-- (public.compute_due_notifications, …000700_notifications_core). Additive +
-- forward-only. Touches N's SHARED engine, so lead-plan-approved.
--
-- This migration:
--   1. Widens TWO CHECKs on public.notifications (recreate w/ the new value):
--        notifications_kind_check        += 'action_item'
--        notifications_entity_type_check += 'action_item'
--      NO milestone CHECK change — before_due/on_due reuse the existing
--      'due_soon', after_due reuses 'overdue' (both already allowed).
--   2. Adds the action-item reminder ARM to compute_due_notifications() via
--      CREATE OR REPLACE (never DROP — that would reset its
--      revoke-all/grant-service_role posture). A new `for r in … loop`
--      matching the CAPA/meeting arm style, gated on
--      app.feature_enabled('action_items') (belt-and-suspenders). It:
--        * resolves a SINGLE recipient = coalesce(assigned_to, active owner
--          assignment); unassigned ⇒ emits nothing (no null-user row);
--        * enqueues ONLY if app.can_read_action_item(item, recipient) is true
--          (Open #3, locked — the verbatim read predicate reused as the notify
--          gate; closes the case_restricted-title leak: an assigned_to who
--          cannot read the case must not be notified with its title);
--        * excludes TERMINAL items via action_item_statuses.is_terminal
--          (join st.is_terminal = false — the canonical "active/pending"
--          test, same as get_member_overview; a done/cancelled item never
--          re-fires);
--        * date match: before_due ⇒ due_date = current_date + offset_days;
--          on_due ⇒ due_date = current_date; after_due ⇒ due_date =
--          current_date - offset_days; only is_active rules; due_date not null;
--        * title = a pt-BR heading (due_soon vs overdue); body = the item's
--          own title (PHI-FREE by construction — the hub is a non-PHI surface;
--          NO join to any case/answer/patient content);
--        * dedup_key = 'action_item:'||id||':'||milestone||':'||current_date
--          (one nudge per item/milestone/day; ON CONFLICT is cross-run
--          idempotent). before_due + on_due firing the same day collapse to one
--          due_soon row (desired).
--   3. Resolve-on-complete (N decision 9): CREATE OR REPLACE
--      advance_committee_action_item (BODY-ONLY, signature unchanged) to call
--      app.resolve_notifications_for('action_item', p_id) when the item lands
--      on a TERMINAL status, so its reminders clear from the bell/badge.
--      complete_committee_action_item delegates to advance_ (verified), so this
--      single choke point covers BOTH the complete (→ done) and cancel
--      (→ cancelled) terminal paths.
--
-- DEFERRED (locked, S1): NO 'action_item' preference surface. Deliberately
-- does NOT widen notification_preferences_surface_check or
-- set_notification_preferences — action-item reminders are opt-in-by-config (a
-- staff_admin deliberately creates the rule), so a global per-user mute is
-- low-value and deferred. With no pref row, enqueue_notification's suppression
-- check finds nothing ⇒ delivers.
--
-- No new public RPC ⇒ no t19 change. compute_due_notifications stays
-- service_role-only (CREATE OR REPLACE preserves its grants).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · Widen the two notifications CHECKs (recreate — additive value only)
-- ----------------------------------------------------------------------------
alter table public.notifications
  drop constraint notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('capa', 'signoff', 'meeting', 'action_item'));

alter table public.notifications
  drop constraint notifications_entity_type_check;
alter table public.notifications
  add constraint notifications_entity_type_check
  check (entity_type in (
    'capa_action', 'response_section_signoff', 'meeting', 'action_item'
  ));

-- ----------------------------------------------------------------------------
-- 2 · compute_due_notifications() — add the action-item reminder arm.
--     CREATE OR REPLACE only (do NOT drop — preserves service_role-only grants).
-- ----------------------------------------------------------------------------
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

  -- ---- Action item: due_soon (before_due/on_due) / overdue (after_due) ----
  -- AI·sat × S1·N (plan §3 X-ζ; Open #3). Gated on action_items (belt-and-
  -- suspenders — an OFF flag has no reminder rows anyway). Recipient =
  -- coalesce(assigned_to, active owner assignment); unassigned emits nothing.
  -- The notify gate is the VERBATIM read predicate can_read_action_item
  -- (closes the case_restricted-title leak). Terminal items excluded via
  -- action_item_statuses.is_terminal. Body = the item's own title (PHI-free —
  -- the hub is a non-PHI surface; no case/answer/patient join).
  if app.feature_enabled('action_items') then
    for r in
      select
        a.id                       as item_id,
        a.commission_id            as commission_id,
        a.title                    as item_title,
        coalesce(
          a.assigned_to,
          (select ja.user_id
             from public.action_item_assignments ja
            where ja.action_item_id = a.id
              and ja.role = 'owner'
              and ja.completed_at is null
            limit 1)
        )                          as recipient,
        case when rem.reminder_type in ('before_due', 'on_due')
             then 'due_soon' else 'overdue' end as milestone,
        case when rem.reminder_type in ('before_due', 'on_due')
             then 'Item de ação vence em breve'
             else 'Item de ação atrasado' end   as heading
      from public.action_item_reminders rem
      join public.action_items a on a.id = rem.action_item_id
      join public.action_item_statuses st
        on st.id = a.status_id and st.is_terminal = false
      where rem.is_active = true
        and a.due_date is not null
        and (
          (rem.reminder_type = 'before_due' and a.due_date = current_date + rem.offset_days)
          or (rem.reminder_type = 'on_due'  and a.due_date = current_date)
          or (rem.reminder_type = 'after_due' and a.due_date = current_date - rem.offset_days)
        )
    loop
      -- Unassigned ⇒ no null-user row.
      continue when r.recipient is null;
      -- Open #3 (locked): the read predicate IS the notify gate.
      continue when not app.can_read_action_item(r.item_id, r.recipient);

      v_ok := app.enqueue_notification(
        r.recipient, r.commission_id, 'action_item', r.milestone, true,
        'action_item', r.item_id, r.heading, r.item_title,
        'action_item:' || r.item_id || ':' || r.milestone || ':' || current_date
      );
      if v_ok then v_count := v_count + 1; end if;
    end loop;
  end if;

  return v_count;
end;
$$;
alter function public.compute_due_notifications() owner to postgres;

comment on function public.compute_due_notifications() is
  'S1·N (ADR 0076 decision 8) + AI·sat (ADR 0050): DEFINER batch scan over CAPA + sign-off + meeting + action-item reminder state, enqueueing via app.enqueue_notification (idempotent, prefs-aware). The action-item arm (plan §3 X-ζ; Open #3) resolves a single recipient (assigned_to or active owner), gates on can_read_action_item (the verbatim read predicate — closes the case_restricted-title leak), excludes terminal items (is_terminal), and maps before_due/on_due->due_soon, after_due->overdue. Returns the count of NEWLY inserted rows. No manual "run now" — wired to pg_cron, NOT granted to authenticated (service_role/cron only). Flag OFF -> returns 0 without raising.';

revoke all on function public.compute_due_notifications() from public;
grant execute on function public.compute_due_notifications() to service_role;

-- ----------------------------------------------------------------------------
-- 3 · advance_committee_action_item — BODY-ONLY change: resolve reminders when
--     the item lands on a TERMINAL status (N decision 9). Signature unchanged.
--     complete_committee_action_item delegates here, so this single choke point
--     covers both the complete (→ done) and cancel (→ cancelled) paths.
--
--     The body below is the CURRENT LIVE definition captured verbatim (via
--     pg_get_functiondef) — NOT the stale 000706/000707 source: the
--     000709000200 commission-admin sweep programmatically regenerated this
--     function (is_org_admin_of_commission → is_commission_admin_of) and folded
--     in the source-aware (case vs meeting/manual) authority. The ONLY delta
--     here is the terminal-transition resolve call. Re-copying old migration
--     text would REVERT the sweep and reintroduce a dropped symbol.
-- ----------------------------------------------------------------------------
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
      or app.is_commission_admin_of(v_commission_id)
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

  -- BE-6·N (N decision 9): a terminal transition clears the item's open
  -- reminders from the bell/badge. Silent no-op when notifications is OFF.
  -- complete_committee_action_item delegates here, so this covers done + cancel.
  if v_is_terminal then
    perform app.resolve_notifications_for('action_item', p_id);
  end if;

  return v_result;
end;
$$;

alter function public.advance_committee_action_item(uuid, uuid, text) owner to postgres;
revoke all on function public.advance_committee_action_item(uuid, uuid, text) from public;
grant execute on function public.advance_committee_action_item(uuid, uuid, text) to authenticated;
grant execute on function public.advance_committee_action_item(uuid, uuid, text) to service_role;
comment on function public.advance_committee_action_item(uuid, uuid, text) is
  'Advance a shared action item to another status. Authority per source — case: '
  'assignee OR case content-writer (HC027, gated by cases_extras); meeting/manual: '
  'assignee OR staff_admin/commission_admin (HC037). Stamps completed_* on a '
  'terminal status and writes an action_item_status_history row. On a TERMINAL '
  'transition, resolves the item''s open N reminders (BE-6·N, decision 9) — covers '
  'both complete (→ done, which delegates here) and cancel (→ cancelled). Audited '
  '(action_item.status_changed via the history trigger).';
