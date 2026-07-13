-- =============================================================================
-- Interviews v2 (IV2) · I1 — schema, RLS, helpers, guard update.
-- =============================================================================
-- Pre-pilot revision of the Phase-11 Interviews module (ADR 0070; plan
-- docs/plans/interviews-v2-sessions.md). Reset-OK HARD-CUT / forward-only: the
-- five scheduling columns move OFF `case_interviews` onto a new 1:N
-- `interview_sessions` child; `conducted_at` becomes per-session
-- `actual_start`/`actual_end`. No back-compat (no live interview data; the seed is
-- rewritten). Interviews stay STAFF-ONLY, non-PHI (Rule 12): `relationship_to_case`
-- excludes patient/family; `confidentiality_level` is a NON-ENFORCING tag (E1 wires
-- enforcement). Binding rules 1/2/9/10/11/12. SQLSTATE block HC0B0-HC0B9 (I2);
-- transition guards reuse HC038.
--
-- Enum convention (ADR 0069): all new enums use ENGLISH keys + pt-BR label maps in
-- the UI. `modality` keeps its pt-BR keys (presencial/remoto/hibrido) and moves
-- verbatim to the session (now NULLABLE — a written_response/async session leaves
-- it null). `case_interviews.status` gains `awaiting_follow_up`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. interview_sessions — the 1:N encounter child of case_interviews.
-- -----------------------------------------------------------------------------
create table if not exists public.interview_sessions (
  id                  uuid primary key default gen_random_uuid(),
  interview_id        uuid not null references public.case_interviews(id) on delete cascade,
  sequence_number     integer not null,
  session_type        text not null,
  status              text not null default 'scheduled',
  modality            text,
  scheduled_start     timestamptz,
  scheduled_end       timestamptz,
  actual_start        timestamptz,
  actual_end          timestamptz,
  location_text       text,
  meeting_url         text,
  cancellation_reason text,
  created_at          timestamptz not null default now(),
  created_by          uuid references public.profiles(id),
  updated_at          timestamptz not null default now(),
  constraint interview_sessions_type_check
    check (session_type = any (array['initial', 'follow_up', 'clarification',
                                     'written_response', 'supplementary', 'closing'])),
  constraint interview_sessions_status_check
    check (status = any (array['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'])),
  constraint interview_sessions_modality_check
    check (modality is null or modality = any (array['presencial', 'remoto', 'hibrido'])),
  constraint interview_sessions_schedule_range
    check (scheduled_end is null or scheduled_start is null or scheduled_end >= scheduled_start),
  constraint interview_sessions_actual_range
    check (actual_end is null or actual_start is null or actual_end >= actual_start),
  constraint interview_sessions_completed_has_start
    check (status <> 'completed' or actual_start is not null),
  constraint interview_sessions_interview_seq_key
    unique (interview_id, sequence_number)
);
alter table public.interview_sessions owner to postgres;

create index interview_sessions_interview_seq_idx
  on public.interview_sessions using btree (interview_id, sequence_number);

-- Table privileges (RLS is the row-level boundary; the role still needs table
-- grants to attempt access at all — mirrors the sibling case_interview_* tables).
grant all on table public.interview_sessions to authenticated;
grant all on table public.interview_sessions to service_role;

comment on table public.interview_sessions is
  'IV2 (ADR 0070): the 1:N encounter child of case_interviews. Carries scheduling '
  '(moved off the interview) + a per-session lifecycle; the interview stays the '
  'lifecycle coordinator. Staff-only, non-PHI (Rule 12). RLS = the interview-child '
  'pattern resolved through interview_id.';

-- -----------------------------------------------------------------------------
-- 2. Thin session helpers (resolve through interview_id; wrap the interview
--    equivalents so policies/RPCs stay readable). No new security surface.
-- -----------------------------------------------------------------------------
create or replace function app.commission_of_session(p_session_id uuid)
  returns uuid
  language sql
  stable
  security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.commission_of_interview(s.interview_id)
  from public.interview_sessions s
  where s.id = p_session_id;
$$;
alter function app.commission_of_session(uuid) owner to postgres;
revoke all on function app.commission_of_session(uuid) from public;
grant execute on function app.commission_of_session(uuid) to authenticated, service_role;

-- Resolves the session's interview, asserts writability via the interview
-- equivalent (→ HC039 when the caller cannot write), and returns the commission id.
create or replace function app.assert_session_writable(p_session_id uuid)
  returns uuid
  language plpgsql
  stable
  security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_interview_id uuid;
begin
  select interview_id into v_interview_id
  from public.interview_sessions where id = p_session_id;
  if v_interview_id is null then
    raise exception 'sessão de entrevista % não encontrada', p_session_id using errcode = 'no_data_found';
  end if;
  return app.assert_interview_writable(v_interview_id);
end;
$$;
alter function app.assert_session_writable(uuid) owner to postgres;
revoke all on function app.assert_session_writable(uuid) from public;
grant execute on function app.assert_session_writable(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. RLS — mirror the LIVE case_interview_subjects policies (resolved through the
--    session's interview_id → its case). SELECT = the case-scope read
--    (`20260713001200`); WRITE = participant-write OR commission-admin. Both use
--    the InitPlan `(select auth.uid())` form (WS-5) and `is_commission_admin_of`
--    (ADR 0051 — the live helper; is_org_admin_of_commission was dropped). No new
--    security surface: a session is exactly as reachable as its interview.
-- -----------------------------------------------------------------------------
alter table public.interview_sessions enable row level security;

create policy "interview_sessions_select" on public.interview_sessions
  for select to authenticated
  using (
    app.can_read_case(app.case_of_interview(interview_id), (select auth.uid()))
    or app.is_commission_admin_of(app.commission_of_interview(interview_id))
  );

create policy "interview_sessions_write" on public.interview_sessions
  for all to authenticated
  using (
    app.can_write_interview(interview_id, (select auth.uid()))
    or app.is_commission_admin_of(app.commission_of_interview(interview_id))
  )
  with check (
    app.can_write_interview(interview_id, (select auth.uid()))
    or app.is_commission_admin_of(app.commission_of_interview(interview_id))
  );

-- -----------------------------------------------------------------------------
-- 4. Triggers on interview_sessions — mirror the incumbent interview-child
--    pattern: updated_at touch (reuses the generic app.touch_interview_updated_at)
--    + the terminal content-freeze (guard_interview_child_lock blocks direct
--    session writes once the interview is completed/cancelled; the cancel cascade
--    runs BEFORE flipping the parent, so it is not self-blocked).
-- -----------------------------------------------------------------------------
create or replace trigger touch_interview_sessions_updated_at
  before update on public.interview_sessions
  for each row execute function app.touch_interview_updated_at();

create or replace trigger guard_interview_child_lock_sessions_trg
  before insert or update or delete on public.interview_sessions
  for each row execute function app.guard_interview_child_lock();

-- -----------------------------------------------------------------------------
-- 5. case_interviews — hard-cut of the moved scheduling columns; new reporting +
--    confidentiality columns; widened status CHECK (+ awaiting_follow_up).
--    Dropping a column auto-drops the single-column CHECKs on it
--    (case_interviews_modality_check, case_interviews_schedule_range).
-- -----------------------------------------------------------------------------
alter table public.case_interviews drop column if exists scheduled_start;
alter table public.case_interviews drop column if exists scheduled_end;
alter table public.case_interviews drop column if exists conducted_at;
alter table public.case_interviews drop column if exists location_text;
alter table public.case_interviews drop column if exists meeting_url;
alter table public.case_interviews drop column if exists modality;

alter table public.case_interviews
  add column interview_category text not null,
  add column confidentiality_level text not null default 'standard';

alter table public.case_interviews add constraint case_interviews_category_check
  check (interview_category = any (array['witness', 'subject', 'clinical_team', 'expert',
                                         'complainant', 'respondent', 'administrative', 'other']));
alter table public.case_interviews add constraint case_interviews_confidentiality_check
  check (confidentiality_level = any (array['standard', 'restricted', 'highly_restricted']));

alter table public.case_interviews drop constraint if exists case_interviews_status_check;
alter table public.case_interviews add constraint case_interviews_status_check
  check (status = any (array['draft', 'scheduled', 'in_progress', 'completed',
                             'cancelled', 'awaiting_follow_up']));

comment on column public.case_interviews.interview_category is
  'IV2 (ADR 0070 N1): dashboard classification of the interview. Required at create '
  '(RPC-enforced). English key; pt-BR label in the UI.';
comment on column public.case_interviews.confidentiality_level is
  'IV2 (ADR 0070): NON-ENFORCING classification tag (standard/restricted/'
  'highly_restricted). Does NOT gate access yet — enforcement lands with E1. The UI '
  'labels it as not-yet-gating.';

-- -----------------------------------------------------------------------------
-- 6. guard_interview_status — reproduce the LIVE (English-key) guard, extended for
--    the IV2 state machine (§4): + awaiting_follow_up. Transitions are driven by
--    the session commands + interview-level acts; direct out-of-RPC status changes
--    stay blocked; invalid transitions raise HC038.
-- -----------------------------------------------------------------------------
create or replace function app.guard_interview_status() returns trigger
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_interview_rpc', true), 'off') = 'on';
begin
  if tg_op = 'DELETE' then
    if not v_in_rpc and old.status in ('completed', 'cancelled') then
      raise exception 'entrevistas concluídas ou canceladas não podem ser excluídas'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- Status transition.
  if new.status is distinct from old.status then
    if not v_in_rpc then
      raise exception 'mudanças de estado da entrevista devem passar pelas RPCs de entrevista'
        using errcode = 'check_violation';
    end if;

    if not (
      (old.status = 'draft' and new.status in ('scheduled', 'cancelled'))
      or (old.status = 'scheduled' and new.status in ('in_progress', 'cancelled'))
      or (old.status = 'in_progress' and new.status in ('awaiting_follow_up', 'completed', 'cancelled'))
      or (old.status = 'awaiting_follow_up' and new.status in ('in_progress', 'completed', 'cancelled'))
      or (old.status = 'completed' and new.status = 'in_progress')
    ) then
      raise exception 'transição de estado de entrevista inválida: % -> %', old.status, new.status
        using errcode = 'HC038';
    end if;

    return new;
  end if;

  -- No status change. Under the flag any field edit is allowed (the RPCs are the
  -- authority). Outside the flag, freeze a LOCKED interview (completed/cancelled).
  if v_in_rpc then
    return new;
  end if;

  if old.status in ('completed', 'cancelled') then
    raise exception 'entrevistas concluídas ou canceladas são imutáveis (edição bloqueada)'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
alter function app.guard_interview_status() owner to postgres;

-- -----------------------------------------------------------------------------
-- 7. case_interview_subjects — required relationship_to_case (N2). Staff-only:
--    NO patient/family_member values (Rule 12). clinical_role (free text) stays.
-- -----------------------------------------------------------------------------
alter table public.case_interview_subjects
  add column relationship_to_case text not null;

alter table public.case_interview_subjects add constraint case_interview_subjects_relationship_check
  check (relationship_to_case = any (array['attending_physician', 'consulting_physician', 'nurse',
                                           'other_professional', 'witness', 'complainant', 'respondent',
                                           'subject', 'expert', 'committee_member', 'other']));

comment on column public.case_interview_subjects.relationship_to_case is
  'IV2 (ADR 0070 N2): the subject''s relationship to the case. Required at add '
  '(RPC-enforced). Staff-only — NO patient/family_member (Rule 12). English key; '
  'pt-BR label in the UI. Free-text clinical_role is kept alongside.';
