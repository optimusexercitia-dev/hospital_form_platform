-- Phase 10 / B1: Meetings — CORE schema, minting, lifecycle guard, feature flag.
--
-- Hospital committees hold MEETINGS and need to register what comes out of them
-- (minutes/ata, agenda, attendance/quorum, cases discussed, action plans,
-- attachments) with internal electronic signatures. Meetings are the third
-- pillar alongside forms and cases. NO patient data: a meeting carries a
-- system-minted per-commission meeting_number, a title, schedule, and free-text
-- minutes — never patient-identifiable information.
--
-- This migration (B1) lands the CORE data model only:
--   * commission_meeting_types — per-commission meeting-category vocabulary
--     (mirror case_outcomes / case_tags; archive, never delete).
--   * commission_meeting_settings — one row per commission; the configurable
--     quorum rule (maioria_simples / fixed_count / percentage) + future defaults.
--   * meetings — the header + lifecycle AUTHORITY (agendada → realizada →
--     em_assinatura → assinada → distribuida, plus cancelada), the conclusion
--     quorum SNAPSHOT columns, and the audit timestamps.
--   * app.mint_meeting_number — per-commission counter (advisory-lock copy of
--     app.mint_case_number).
--   * app.guard_meeting_status — the lifecycle state machine + content-freeze
--     once status >= em_assinatura, gated by the app.in_meeting_rpc session flag
--     (mirror guard_case_status; the B3 RPCs set the flag).
--   * the meetings feature flag (default OFF) + app.assert_meetings_enabled()
--     (RPC gate) + public.meetings_enabled() (TS-layer gate, mirror
--     public.cases_extras_enabled).
--   * app.commission_of_meeting() — the RLS resolver (mirror commission_of_case).
--
-- Children (agenda/attendees/cases/action_items/signatures/attachments), RLS,
-- RPCs, storage, and the seed-on-commission trigger land in B2/B3.
--
-- New SQLSTATEs (user-defined HC0xx class, continuing after the cases batch's
-- HC031; HC021 assignee-not-a-member is REUSED), introduced across Phase 10:
--   HC032 commission mismatch (a meeting_cases / action-item case-link whose
--         case is in another commission).
--   HC033 meeting in the wrong state for the requested operation.
--   HC034 cannot conclude — no present attendee.
--   HC035 already signed (a second active signature for the same attendee).
--   HC036 not entitled to sign (not a present platform attendee of an
--         em_assinatura meeting in the caller's commission).
--   HC037 not entitled to update this action item.

-- ===========================================================================
-- commission_meeting_types — per-commission meeting category vocabulary
-- ===========================================================================
-- Mirror case_outcomes: a plain (commission_id, position) ordering with a
-- DEFERRABLE INITIALLY IMMEDIATE unique so a future reorder swap tolerates the
-- transient duplicate; color_token uses the shared 7-token palette; archive
-- (not delete) is the retire path (meetings.meeting_type_id is ON DELETE SET
-- NULL so a referenced type can still be archived without orphaning meetings).
create table public.commission_meeting_types (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions (id) on delete cascade,
  name text not null,
  color_token text not null default 'slate'
    check (color_token in ('muted', 'slate', 'blue', 'amber', 'green', 'red', 'violet')),
  position integer not null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commission_meeting_types_commission_name_key unique (commission_id, name),
  constraint commission_meeting_types_commission_position_key
    unique (commission_id, position) deferrable initially immediate,
  constraint commission_meeting_types_name_not_blank check (btrim(name) <> '')
);

alter table public.commission_meeting_types enable row level security;
create index commission_meeting_types_commission_idx
  on public.commission_meeting_types (commission_id);

-- ===========================================================================
-- commission_meeting_settings — one row per commission (the quorum rule)
-- ===========================================================================
-- PK is commission_id (exactly one settings row per commission). The quorum
-- rule is configurable; quorum_value is interpreted PER RULE and shape-checked:
--   * maioria_simples : quorum_value MUST be null (denominator = all members)
--   * fixed_count     : quorum_value MUST be a positive integer (member count)
--   * percentage      : quorum_value MUST be in (0, 100]
-- The rule + counts are SNAPSHOTTED onto the meeting at conclusion (the columns
-- on public.meetings below), so changing this row later never rewrites history.
create table public.commission_meeting_settings (
  commission_id uuid primary key references public.commissions (id) on delete cascade,
  quorum_rule_type text not null default 'maioria_simples'
    check (quorum_rule_type in ('maioria_simples', 'fixed_count', 'percentage')),
  quorum_value numeric,
  updated_at timestamptz not null default now(),
  constraint commission_meeting_settings_value_shape check (
    (quorum_rule_type = 'maioria_simples' and quorum_value is null)
    or (quorum_rule_type = 'fixed_count'
        and quorum_value is not null and quorum_value >= 1
        and quorum_value = trunc(quorum_value))
    or (quorum_rule_type = 'percentage'
        and quorum_value is not null and quorum_value > 0 and quorum_value <= 100)
  )
);

alter table public.commission_meeting_settings enable row level security;

-- ===========================================================================
-- meetings — header + lifecycle authority
-- ===========================================================================
-- meeting_number is a PER-COMMISSION counter (set by the BEFORE INSERT trigger;
-- the insert omits it), backstopped by unique(commission_id, meeting_number) —
-- create_meeting wraps the insert in a one-shot unique_violation retry. The
-- 6-state lifecycle is enforced by app.guard_meeting_status (below); once the
-- status reaches em_assinatura the content (minutes_md + header fields + the
-- child tables, the latter via app.guard_meeting_child_lock in B2) is frozen
-- except under the app.in_meeting_rpc flag.
--
-- Conclusion SNAPSHOT columns (quorum_rule_type / quorum_value / present_count /
-- eligible_member_count) freeze the quorum math at conclusion so editing the
-- commission settings or attendance later cannot rewrite a concluded meeting's
-- history (resolved design decision 7). quorum_met is the secretary's verdict
-- (computed at conclusion, overridable). modality/location/url are scheduling
-- detail; minutes_md is sanitized Markdown (Architecture Rule 7, enforced in the
-- data layer like section_text).
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions (id) on delete cascade,
  meeting_number integer not null,
  meeting_type_id uuid references public.commission_meeting_types (id) on delete set null,
  title text not null,
  status text not null default 'agendada'
    check (status in ('agendada', 'realizada', 'em_assinatura', 'assinada', 'distribuida', 'cancelada')),
  scheduled_start timestamptz not null,
  scheduled_end timestamptz,
  modality text not null default 'presencial'
    check (modality in ('presencial', 'remoto', 'hibrido')),
  location_text text,
  meeting_url text,
  minutes_md text,
  quorum_met boolean,
  -- Conclusion snapshots (null until concluded).
  quorum_rule_type text
    check (quorum_rule_type is null
           or quorum_rule_type in ('maioria_simples', 'fixed_count', 'percentage')),
  quorum_value numeric,
  present_count integer,
  eligible_member_count integer,
  concluded_at timestamptz,
  concluded_by uuid references public.profiles (id),
  distributed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meetings_commission_number_key unique (commission_id, meeting_number),
  constraint meetings_title_not_blank check (btrim(title) <> ''),
  constraint meetings_schedule_range check (
    scheduled_end is null or scheduled_end >= scheduled_start
  )
);

alter table public.meetings enable row level security;
create index meetings_commission_idx on public.meetings (commission_id);
create index meetings_type_idx on public.meetings (meeting_type_id);
create index meetings_status_idx on public.meetings (commission_id, status);

-- ===========================================================================
-- app.commission_of_meeting(meeting_id) -> uuid    (RLS resolver)
-- ===========================================================================
-- SECURITY DEFINER + pinned search_path so it resolves the commission for a
-- child table's RLS regardless of the caller's RLS. Mirrors commission_of_case /
-- commission_of_version.
create function app.commission_of_meeting(p_meeting_id uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select commission_id from public.meetings where id = p_meeting_id;
$$;

revoke all on function app.commission_of_meeting(uuid) from public;
grant execute on function app.commission_of_meeting(uuid) to authenticated, service_role;

-- ===========================================================================
-- Meeting-number minting — per-commission counter
-- ===========================================================================
-- BEFORE INSERT on meetings. Advisory-lock copy of app.mint_case_number:
-- serialized PER COMMISSION via pg_advisory_xact_lock(hashtextextended(
-- commission_id, 0)) — parallel across commissions, serial within one — and
-- backstopped by unique(commission_id, meeting_number) (create_meeting adds the
-- one-shot unique_violation retry on top).
create function app.mint_meeting_number()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.commission_id::text, 0));

  new.meeting_number := coalesce(
    (select max(meeting_number) from public.meetings where commission_id = new.commission_id),
    0
  ) + 1;

  return new;
end;
$$;

create trigger mint_meeting_number_trg
  before insert on public.meetings
  for each row execute function app.mint_meeting_number();

-- ===========================================================================
-- Meeting lifecycle state-machine + content-freeze guard
-- ===========================================================================
-- Mirrors guard_case_status / guard_case_phase_status. Every legitimate
-- mutation happens inside a B3 RPC that sets app.in_meeting_rpc = 'on'; a DIRECT
-- client UPDATE/DELETE (even one RLS allows a staff_admin) is rejected unless
-- the flag is on. This funnels every status change AND every content edit of a
-- locked meeting through the vetted RPCs.
--
-- Legal transitions (only under app.in_meeting_rpc):
--   agendada      -> realizada | cancelada
--   realizada     -> em_assinatura | cancelada
--   em_assinatura -> assinada | realizada (reopen) | cancelada
--   assinada      -> distribuida | realizada (reopen)
--   distribuida / cancelada are TERMINAL.
--
-- Content-freeze: once status >= em_assinatura, the minutes/header columns are
-- frozen except under the flag (conclusion locks the record; reopen unlocks it
-- by moving back to realizada). The child tables are frozen by the sibling
-- app.guard_meeting_child_lock (B2). A status change at/above em_assinatura
-- (e.g. the sign auto-flip em_assinatura->assinada) is permitted under the flag.
create function app.guard_meeting_status()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_meeting_rpc', true), 'off') = 'on';
  v_locked_rank constant int := 3;  -- em_assinatura and beyond are "locked"
  v_old_rank int;
begin
  v_old_rank := case old.status
    when 'agendada' then 1
    when 'realizada' then 2
    when 'em_assinatura' then 3
    when 'assinada' then 4
    when 'distribuida' then 5
    when 'cancelada' then 5
    else 0
  end;

  if tg_op = 'DELETE' then
    -- A terminal / locked meeting cannot be deleted outside an RPC. (Cascade
    -- deletes from the commission run as the owner and bypass RLS/guards.)
    if not v_in_rpc and old.status in ('em_assinatura', 'assinada', 'distribuida', 'cancelada') then
      raise exception 'reuniões assinadas ou finalizadas não podem ser excluídas'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- Status transition.
  if new.status is distinct from old.status then
    if not v_in_rpc then
      raise exception 'mudanças de estado da reunião devem passar pelas RPCs de reunião'
        using errcode = 'check_violation';
    end if;

    if not (
      (old.status = 'agendada' and new.status in ('realizada', 'cancelada'))
      or (old.status = 'realizada' and new.status in ('em_assinatura', 'cancelada'))
      or (old.status = 'em_assinatura' and new.status in ('assinada', 'realizada', 'cancelada'))
      or (old.status = 'assinada' and new.status in ('distribuida', 'realizada'))
    ) then
      raise exception 'transição de estado de reunião inválida: % -> %', old.status, new.status
        using errcode = 'check_violation';
    end if;

    return new;
  end if;

  -- No status change. Under the flag any field edit is allowed (the RPCs are the
  -- authority). Outside the flag, freeze a LOCKED meeting (>= em_assinatura) —
  -- a direct content edit of a meeting awaiting signature / signed / distributed
  -- is rejected. An unlocked meeting (agendada/realizada) permits direct
  -- non-status edits the RLS already allows (e.g. a future direct quorum_met
  -- override) — but the B3 RPCs use the flag anyway.
  if v_in_rpc then
    return new;
  end if;

  if v_old_rank >= v_locked_rank then
    raise exception 'reuniões a partir de "em assinatura" são imutáveis (edição bloqueada)'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger guard_meeting_status_trg
  before update or delete on public.meetings
  for each row execute function app.guard_meeting_status();

-- ===========================================================================
-- Feature flag — meetings (default OFF)
-- ===========================================================================
-- Every Phase-10 RPC gates app.assert_meetings_enabled() at entry, and the
-- direct-table server actions gate public.meetings_enabled() in the TS layer, so
-- the feature is dark until a separate one-line migration flips this ON at phase
-- completion (mirroring 20260613090001 / the cases flags). Tests + the meetings
-- seed run with the flag temporarily ON (or seed via direct inserts).
insert into app.feature_flags (key, enabled, description) values
  ('meetings', false,
   'When true, the Meetings feature (scheduling, minutes/ata registry, '
   || 'attendance/quorum, cases discussed, action plans, attachments, internal '
   || 'electronic signatures, pending-signatures) is live. Enabled at Phase 10 '
   || 'completion.');

-- app.assert_meetings_enabled() — shared RPC entry gate. check_violation (23514)
-- maps to a generic "feature unavailable" in the data layer.
create function app.assert_meetings_enabled()
returns void
language plpgsql
stable
set search_path = app, public, pg_catalog
as $$
begin
  if not app.feature_enabled('meetings') then
    raise exception 'o recurso de reuniões não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;

revoke all on function app.assert_meetings_enabled() from public;
grant execute on function app.assert_meetings_enabled() to authenticated, service_role;

-- public.meetings_enabled() — TS-layer gate for the direct-table writes. Thin
-- SECURITY DEFINER boolean read of the flag (which lives in the locked-down app
-- schema, invisible to PostgREST). Mirrors public.cases_extras_enabled.
create function public.meetings_enabled()
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select app.feature_enabled('meetings');
$$;

grant execute on function public.meetings_enabled() to authenticated, service_role;
revoke all on function public.meetings_enabled() from public, anon;
