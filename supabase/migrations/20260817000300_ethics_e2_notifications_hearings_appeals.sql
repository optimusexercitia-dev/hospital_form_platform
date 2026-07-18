-- =============================================================================
-- ETH·E2 (ADR 0073 D5/D8/D-appeals) — BE-4: notifications + hearings + appeals +
--   the reconciled participants_only hearing door (window 20260817000300).
--
-- Three case-child tables (verbatim can_read_case SELECT + DEFINER-write shape, the
-- BE-2/3 pattern) + the O-7a "Audiência" meeting-type seed + schedule_ethics_hearing.
--
-- ⭐ D14 reconciled onto Stage C (ADR 0073 Amendment §2): a hearing is a
-- `participants_only` MEETING whose attendee roster is the eligible panel
-- (app.eligible_voters — members minus recused minus respondent). Stage C's
-- can_reach_meeting (member AND on-roster) then isolates it: a non-attendee (recused /
-- respondent / non-member) reads NOTHING of the meeting row, agenda, attendees, or
-- minutes. This door touches NO meeting-child policy, NO restricted_to_case_id, NO
-- can_read_meeting — those are WITHDRAWN; Stage C already ships the isolation.
--
-- ⛔ trg_meetings_roster fires BEFORE INSERT OR UPDATE OF visibility_policy and requires a
-- non-empty roster when visibility_policy='participants_only'. A direct participants_only
-- INSERT would fail (no attendees yet). So the door: INSERT as commission_default (the
-- roster check is skipped) → INSERT the eligible-panel roster → UPDATE to
-- participants_only (the BEFORE-UPDATE arm now sees the populated roster). The
-- visibility-only UPDATE on a freshly-scheduled (unlocked) meeting passes
-- guard_meeting_status; the door sets app.in_meeting_rpc='on' regardless (belt).
--
-- SQLSTATEs (ADR 0073 D11): HC0J0 (non-ethics / invalid state), HC0J1 (coordinator
-- authority), HC0J6 (notification lifecycle — status CHECK here; the acknowledge/cancel
-- "already acknowledged" guard is RPC-translated in BE-6, like BE-2's HC0J0/2/3), HC000
-- (flag OFF).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · ethics_notifications (D5) — formal notices with deadlines. due_at feeds the N
--     scan arm (X-ζ, BE-7).
-- -----------------------------------------------------------------------------
create table if not exists public.ethics_notifications (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  recipient_participant_id uuid references public.case_participants(id) on delete set null,
  recipient_user_id uuid references public.profiles(id) on delete set null,
  notification_type text not null check (notification_type in
    ('complaint_acknowledgement', 'respondent_notification', 'request_for_response',
     'hearing_notice', 'decision_notice', 'appeal_notice', 'external_reporting_notice', 'other')),
  delivery_method text not null
    check (delivery_method in ('email', 'letter', 'in_person', 'system', 'phone', 'other')),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'acknowledged', 'failed', 'cancelled')),   -- HC0J6
  sent_at timestamptz,
  acknowledged_at timestamptz,
  due_at timestamptz,                                       -- the prazo — feeds the N scan arm
  related_document_id uuid references public.attachments(id),
  notes_md text,                                            -- sanitized Markdown (Rule 7); PHI-free (Rule 12)
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.ethics_notifications is
  'ADR 0073 D5 — formal ethics notices with deadlines. due_at feeds the N scan arm '
  '(X-ζ, BE-7). SELECT gated by can_read_case; writes DEFINER-RPC-only (issue/acknowledge/'
  'cancel_ethics_notification — BE-6). PHI-free (Rule 12): notes/labels are notice metadata.';

create index ethics_notifications_case_idx on public.ethics_notifications (case_id);
-- The N scan-arm hot path (BE-7): due, unacknowledged notices.
create index ethics_notifications_due_idx
  on public.ethics_notifications (due_at)
  where due_at is not null and acknowledged_at is null;

alter table public.ethics_notifications enable row level security;
create policy ethics_notifications_select on public.ethics_notifications
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()));
grant select on public.ethics_notifications to authenticated;

-- -----------------------------------------------------------------------------
-- 2 · ethics_hearings (D8) — hearing-specific metadata riding a meetings row.
-- -----------------------------------------------------------------------------
create table if not exists public.ethics_hearings (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  meeting_id uuid references public.meetings(id) on delete set null,
  hearing_type text not null check (hearing_type in
    ('initial_hearing', 'evidence_hearing', 'deliberation_hearing', 'appeal_hearing', 'other')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  respondent_present boolean,
  complainant_present boolean,
  legal_representative_present boolean,
  summary_md text,                                          -- sanitized Markdown (Rule 7)
  outcome_md text,                                          -- sanitized Markdown (Rule 7)
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.ethics_hearings is
  'ADR 0073 D8 — hearing-specific metadata on top of a generic meetings row (D14→Stage C: '
  'the meeting is participants_only, panel-rostered). SELECT gated by can_read_case; writes '
  'DEFINER-RPC-only (schedule/complete_ethics_hearing). The meeting''s OWN isolation is '
  'Stage C''s can_reach_meeting, not this table''s RLS.';

create index ethics_hearings_case_idx on public.ethics_hearings (case_id);

alter table public.ethics_hearings enable row level security;
create policy ethics_hearings_select on public.ethics_hearings
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()));
grant select on public.ethics_hearings to authenticated;

-- -----------------------------------------------------------------------------
-- 3 · ethics_appeals (D-appeals).
-- -----------------------------------------------------------------------------
create table if not exists public.ethics_appeals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  decision_id uuid not null references public.case_decisions(id) on delete cascade,
  submitted_by_participant_id uuid references public.case_participants(id) on delete set null,
  submitted_at timestamptz not null default now(),
  appeal_reason_md text not null,                           -- sanitized Markdown (Rule 7)
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'accepted', 'rejected', 'withdrawn', 'closed')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  outcome text,
  outcome_rationale_md text,                                -- sanitized Markdown (Rule 7)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.ethics_appeals is
  'ADR 0073 D-appeals — an appeal against an issued decision; affects case finality + '
  'carries its own review deadline. SELECT gated by can_read_case; writes DEFINER-RPC-only '
  '(submit/review_ethics_appeal — BE-6).';

create index ethics_appeals_case_idx on public.ethics_appeals (case_id);
create index ethics_appeals_decision_idx on public.ethics_appeals (decision_id);

alter table public.ethics_appeals enable row level security;
create policy ethics_appeals_select on public.ethics_appeals
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()));
grant select on public.ethics_appeals to authenticated;

-- -----------------------------------------------------------------------------
-- 4 · O-7a — the "Audiência" meeting type. Add it to the per-commission default seed
--     (every NEW commission gets it) + backfill EXISTING commissions (0 rows on a fresh
--     reset — commissions are created by seed.sql AFTER migrations). NO meetings column
--     is added: the ethics_hearings.meeting_id link IS the "this meeting is a hearing"
--     fact; the catalog row is the cosmetic label (X-η stays seed-only).
-- -----------------------------------------------------------------------------
create or replace function app.seed_default_meeting_types(p_commission_id uuid)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  insert into public.commission_meeting_types (commission_id, name, color_token, position)
  values
    (p_commission_id, 'Ordinária', 'blue', 1),
    (p_commission_id, 'Extraordinária', 'amber', 2),
    (p_commission_id, 'Audiência', 'red', 3)               -- ETH·E2 O-7a
  on conflict (commission_id, name) do nothing;

  insert into public.commission_meeting_settings (commission_id, quorum_rule_type, quorum_value)
  values (p_commission_id, 'maioria_simples', null)
  on conflict (commission_id) do nothing;
end;
$$;
alter function app.seed_default_meeting_types(uuid) owner to postgres;

-- Backfill any commission that already exists (next free position, name-idempotent).
insert into public.commission_meeting_types (commission_id, name, color_token, position)
select c.id, 'Audiência', 'red',
       coalesce((select max(t.position) from public.commission_meeting_types t
                 where t.commission_id = c.id), 0) + 1
from public.commissions c
on conflict (commission_id, name) do nothing;

-- -----------------------------------------------------------------------------
-- 5 · schedule_ethics_hearing — the participants_only hearing door.
-- -----------------------------------------------------------------------------
create or replace function public.schedule_ethics_hearing(
  p_case_id uuid, p_hearing_type text,
  p_meeting_id uuid default null, p_scheduled_at timestamptz default null
) returns uuid
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
  v_type_id uuid;
  v_meeting_id uuid := p_meeting_id;
  v_hearing_id uuid;
begin
  perform app.assert_ethics_enabled();

  v_commission := app.commission_of_case(p_case_id);
  if v_commission is null then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;
  -- Coordinator authority.
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'apenas a coordenação pode gerenciar este processo ético'
      using errcode = 'HC0J1';
  end if;
  -- Ethics-typed (Lead ruling 1).
  if not exists (select 1 from public.ethics_case_details d where d.case_id = p_case_id) then
    raise exception 'ação inválida para o status atual do processo ético'
      using errcode = 'HC0J0';
  end if;
  if p_hearing_type not in
     ('initial_hearing', 'evidence_hearing', 'deliberation_hearing', 'appeal_hearing', 'other') then
    raise exception 'tipo de audiência inválido' using errcode = 'check_violation';
  end if;

  -- Create the hearing meeting (participants_only, panel-rostered) unless one is supplied.
  if v_meeting_id is null then
    v_type_id := (select id from public.commission_meeting_types
                  where commission_id = v_commission and name = 'Audiência' and not archived
                  order by position limit 1);

    perform set_config('app.in_meeting_rpc', 'on', true);
    -- (a) INSERT as commission_default so trg_meetings_roster skips the empty-roster check.
    insert into public.meetings (commission_id, title, scheduled_start, meeting_type_id, visibility_policy)
    values (v_commission, 'Audiência do processo ético', coalesce(p_scheduled_at, now()),
            v_type_id, 'commission_default')
    returning id into v_meeting_id;
    -- (b) Roster = the eligible panel (members − recused − respondent). PHI-free.
    insert into public.meeting_attendees (meeting_id, user_id)
    select v_meeting_id, ev from app.eligible_voters(p_case_id) ev;
    -- (c) UPDATE to participants_only — the roster is now non-empty, so the guard passes.
    update public.meetings set visibility_policy = 'participants_only' where id = v_meeting_id;
    perform set_config('app.in_meeting_rpc', 'off', true);
  end if;

  insert into public.ethics_hearings (case_id, meeting_id, hearing_type, scheduled_at, created_by)
  values (p_case_id, v_meeting_id, p_hearing_type, coalesce(p_scheduled_at, now()), auth.uid())
  returning id into v_hearing_id;

  perform app.audit_write('ethics.hearing_scheduled', 'case', p_case_id, v_commission,
    'Audiência agendada no processo ético',
    jsonb_build_object('hearing_id', v_hearing_id, 'meeting_id', v_meeting_id,
                       'hearing_type', p_hearing_type));
  return v_hearing_id;
end;
$$;
alter function public.schedule_ethics_hearing(uuid, text, uuid, timestamptz) owner to postgres;
revoke all on function public.schedule_ethics_hearing(uuid, text, uuid, timestamptz) from public;
grant execute on function public.schedule_ethics_hearing(uuid, text, uuid, timestamptz) to authenticated, service_role;
