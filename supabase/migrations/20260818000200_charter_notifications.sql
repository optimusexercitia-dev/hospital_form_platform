-- Committee Charters & Meeting Cadence (S4·CH, Phase 21) — cadence-overdue N arm (CH-BE-4).
-- Plan docs/plans/charters-cadence.md §6; ADR 0080 D8. A batch/scan arm (X-ζ additive
-- pattern), NOT an authz boundary. No PHI (Rule 12): the body is commission name + a fixed
-- pt-BR string.
--
-- Catalog-verified (live catalog, not migration text — graphify exception):
--   • aggregator            = public.compute_due_notifications() invokes each arm as
--       `v_count := v_count + app.compute_due_<x>_notifications();` before `return`
--       (the ethics arm precedent, 20260817000600). We inject our arm the same way.
--   • dedup insert helper   = app.enqueue_notification(p_user_id, p_commission_id, p_kind,
--       p_milestone, p_is_reminder, p_entity_type, p_entity_id, p_title, p_body, p_dedup_key)
--       → boolean; dedups via `on conflict (user_id, dedup_key) do nothing`; internally
--       gates on feature_enabled('notifications') + per-kind notification_preferences.
--   • CHECK constraints     = notifications_kind_check / notifications_entity_type_check.
--   • staff_admin recipients = memberships where commission_id=X and role='staff_admin'
--       (principal_id) — the signoff-arm precedent.
--   • cadence math          = mirrors the CH-BE-3 §4 window EXACTLY; em_atraso ⟺ charter row
--       AND max(held_at) over held commission_default meetings IS NOT NULL AND now()-max > window
--       (strict > — the complement of the inclusive em_dia). Computed INLINE over base tables
--       (the batch is system-wide, no member context — it must NOT call the HC0K2 RPC).

-- -----------------------------------------------------------------------------
-- 1 · Widen the notifications CHECKs (drop + re-add the named constraints; keep
--     every existing value, add the new one).
-- -----------------------------------------------------------------------------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind = any (array['capa', 'signoff', 'meeting', 'action_item', 'ethics', 'charter']));

alter table public.notifications drop constraint notifications_entity_type_check;
alter table public.notifications add constraint notifications_entity_type_check
  check (entity_type = any (array[
    'capa_action', 'response_section_signoff', 'meeting', 'action_item',
    'ethics_notification', 'commission'
  ]));

-- -----------------------------------------------------------------------------
-- 2 · app.compute_due_charter_notifications() — the cadence-overdue arm.
--     Flag-OFF (charters) → emits nothing (return early, no raise; it is a batch).
--     enqueue_notification additionally no-ops when the notifications flag is off.
-- -----------------------------------------------------------------------------
create or replace function app.compute_due_charter_notifications()
  returns integer
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_count integer := 0;
  v_week text := to_char(now(), 'IYYY-IW');   -- ISO year-week bucket (idempotent per week)
  v_ok boolean;
  r record;
  v_admin uuid;
begin
  if not app.feature_enabled('charters') then
    return 0;
  end if;

  -- Each em_atraso commission (charter row AND a qualifying meeting past its window).
  for r in
    select ch.commission_id, c.name as commission_name
    from public.commission_charters ch
    join public.commissions c on c.id = ch.commission_id
    cross join lateral (
      select max(m.held_at) as last_held
      from public.meetings m
      where m.commission_id = ch.commission_id
        and m.held_at is not null
        and m.visibility_policy = 'commission_default'
    ) lh
    where lh.last_held is not null
      and (now() - lh.last_held) > case ch.meeting_frequency
        when 'semanal'    then interval '1 week'
        when 'quinzenal'  then interval '2 weeks'
        when 'mensal'     then interval '1 month'
        when 'bimestral'  then interval '2 months'
        when 'trimestral' then interval '3 months'
      end
  loop
    -- Recipient = each staff_admin of the commission (signoff-arm precedent).
    for v_admin in
      select principal_id from public.memberships
      where commission_id = r.commission_id and role = 'staff_admin'
    loop
      v_ok := app.enqueue_notification(
        v_admin, r.commission_id, 'charter', 'overdue', true,
        'commission', r.commission_id,
        'Reunião em atraso',
        -- PHI-free (Rule 12): commission name + fixed string; no case/patient data.
        'A comissão ' || r.commission_name || ' está com a cadência de reuniões em atraso.',
        'charter_cadence:' || r.commission_id || ':' || v_week
      );
      if v_ok then v_count := v_count + 1; end if;
    end loop;
  end loop;

  return v_count;
end;
$$;
alter function app.compute_due_charter_notifications() owner to postgres;
revoke all on function app.compute_due_charter_notifications() from public;
grant execute on function app.compute_due_charter_notifications() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3 · Wire the arm into public.compute_due_notifications (additive, alongside the
--     ethics arm). Runtime-rewrite of the LIVE body (the repo pattern; avoids
--     reproducing — and risking drift on — the other arms). Idempotent.
-- -----------------------------------------------------------------------------
do $$
declare d text;
begin
  d := pg_get_functiondef('public.compute_due_notifications()'::regprocedure);
  if position('compute_due_charter_notifications' in d) = 0 then
    d := replace(
      d,
      'v_count := v_count + app.compute_due_ethics_notifications();',
      'v_count := v_count + app.compute_due_charter_notifications();' || chr(10) ||
      '  v_count := v_count + app.compute_due_ethics_notifications();'
    );
    execute d;
  end if;
end $$;
