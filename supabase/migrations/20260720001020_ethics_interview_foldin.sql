-- =============================================================================
-- ETH·E1 (ADR 0072 D7 · X-γ) — BE-6: Interviews-v2 fold-in (enforcement + wiring).
--
-- IV2 (20260720000800) shipped confidentiality_level / interview_category /
-- relationship_to_case INERT. E1 makes confidentiality ENFORCING, remaps it to the
-- single 7-value taxonomy (O3), wires participant_id FKs → case_participants, and adds
-- the per-session attendance + topics/summaries satellites. No re-migration of IV2:
-- all changes are additive (columns/tables) or in-place (the confidentiality remap +
-- the SELECT-policy ceiling). Depends on BE-4 (the clearance mechanism).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · participant_id FK (nullable) → case_participants(id) on the interview family,
--     so the SAME case participant resolves across an interview's sessions (D7·1).
-- -----------------------------------------------------------------------------
alter table public.case_interviews
  add column if not exists participant_id uuid references public.case_participants(id) on delete set null;
alter table public.case_interview_subjects
  add column if not exists participant_id uuid references public.case_participants(id) on delete set null;
alter table public.case_interview_interviewers
  add column if not exists participant_id uuid references public.case_participants(id) on delete set null;

-- -----------------------------------------------------------------------------
-- 2 · confidentiality_level: remap IV2's 3-value tag → the 7-value taxonomy (O3)
--     and make it ENFORCING. A normalization trigger keeps legacy 3-value RPC callers
--     (create_interview/update_interview) working WITHOUT reproducing those RPCs.
-- -----------------------------------------------------------------------------
alter table public.case_interviews drop constraint if exists case_interviews_confidentiality_check;

-- O3 remap of any existing rows.
update public.case_interviews set confidentiality_level = case confidentiality_level
  when 'standard'         then 'non_phi_internal'
  when 'restricted'       then 'peer_review_confidential'
  when 'highly_restricted' then 'ethics_investigation'
  else confidentiality_level end;

alter table public.case_interviews alter column confidentiality_level set default 'non_phi_internal';
alter table public.case_interviews
  add constraint case_interviews_confidentiality_check
  check (confidentiality_level in (
    'non_phi_internal', 'phi_standard', 'phi_restricted', 'peer_review_confidential',
    'legal_privileged', 'ethics_investigation', 'credentialing_sensitive'));

comment on column public.case_interviews.confidentiality_level is
  'ADR 0072 D7 · E1 — now ENFORCING on the single 7-value taxonomy (was IV2''s inert '
  '3-value tag). A below-clearance reader no longer sees the interview (the SELECT '
  'ceiling). legal_privileged + credentialing_sensitive gate above ordinary case-read.';

-- Legacy 3-value → 7-value normalization (BEFORE write) so create_interview /
-- update_interview (which still pass IV2''s {standard,restricted,highly_restricted})
-- keep working through the FE transition — no RPC reproduction needed.
create or replace function app.normalize_interview_confidentiality()
  returns trigger language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  new.confidentiality_level := case new.confidentiality_level
    when 'standard'          then 'non_phi_internal'
    when 'restricted'        then 'peer_review_confidential'
    when 'highly_restricted' then 'ethics_investigation'
    else new.confidentiality_level end;
  return new;
end;
$$;
alter function app.normalize_interview_confidentiality() owner to postgres;
drop trigger if exists trg_normalize_interview_confidentiality on public.case_interviews;
create trigger trg_normalize_interview_confidentiality
  before insert or update of confidentiality_level on public.case_interviews
  for each row execute function app.normalize_interview_confidentiality();

-- -----------------------------------------------------------------------------
-- 3 · Confidentiality clearance + the unified interview read predicate.
-- -----------------------------------------------------------------------------

-- The pure clearance check given an already-resolved case (shared by the interview
-- ceiling; mirrors the attachment ceiling's clearance logic, D5/O2).
create or replace function app.confidentiality_clearance_ok(p_case_id uuid, p_label text, p_uid uuid)
  returns boolean language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if p_uid is null then
    return false;
  end if;
  if p_label is null
     or p_label not in ('legal_privileged', 'credentialing_sensitive') then
    return true;
  end if;
  if coalesce(app.is_admin(), false) then
    return true;
  end if;
  return exists (
    select 1 from public.case_access ca
    where ca.case_id = p_case_id and ca.user_id = p_uid
      and (ca.expires_at is null or ca.expires_at > now())
      and ca.max_confidentiality is not null
      and app.confidentiality_rank(ca.max_confidentiality) >= app.confidentiality_rank(p_label)
  );
end;
$$;
alter function app.confidentiality_clearance_ok(uuid, text, uuid) owner to postgres;
revoke all on function app.confidentiality_clearance_ok(uuid, text, uuid) from public;
grant execute on function app.confidentiality_clearance_ok(uuid, text, uuid) to authenticated, service_role;

-- The unified interview read predicate: the existing case-scoped read (+ the
-- commission-admin arm) AND the confidentiality ceiling. For a non-gated interview
-- (confidentiality not in the 2 gating labels) this reduces to today's behaviour
-- exactly (clearance_ok = true) — zero regression for existing IV2 interviews.
create or replace function app.can_read_interview(p_interview_id uuid, p_uid uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select p_uid is not null and exists (
    select 1 from public.case_interviews ci
    where ci.id = p_interview_id
      and (app.can_read_case(ci.case_id, p_uid)
           or app.is_commission_admin_of_for(app.commission_of_case(ci.case_id), p_uid))
      and app.confidentiality_clearance_ok(ci.case_id, ci.confidentiality_level, p_uid)
  );
$$;
alter function app.can_read_interview(uuid, uuid) owner to postgres;
revoke all on function app.can_read_interview(uuid, uuid) from public;
grant execute on function app.can_read_interview(uuid, uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4 · Rewrite the interview-family SELECT policies onto can_read_interview (adds the
--     ceiling; identical to today for non-gated interviews).
-- -----------------------------------------------------------------------------
drop policy if exists case_interviews_select on public.case_interviews;
create policy case_interviews_select on public.case_interviews
  for select to authenticated
  using (app.can_read_interview(id, auth.uid()));

drop policy if exists case_interview_subjects_select on public.case_interview_subjects;
create policy case_interview_subjects_select on public.case_interview_subjects
  for select to authenticated
  using (app.can_read_interview(interview_id, auth.uid()));

drop policy if exists case_interview_interviewers_select on public.case_interview_interviewers;
create policy case_interview_interviewers_select on public.case_interview_interviewers
  for select to authenticated
  using (app.can_read_interview(interview_id, auth.uid()));

drop policy if exists interview_sessions_select on public.interview_sessions;
create policy interview_sessions_select on public.interview_sessions
  for select to authenticated
  using (app.can_read_interview(interview_id, auth.uid()));

-- -----------------------------------------------------------------------------
-- 5 · Per-session attendance (D7·3) + topics/summaries satellites (D7·4). Additive,
--     RLS mirroring the interview-child pattern (can_read_interview); DEFINER/write
--     via can_write_interview at the RPC layer; SELECT grant (RLS narrows a grant).
-- -----------------------------------------------------------------------------
create table if not exists public.interview_session_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  participant_id uuid not null references public.case_participants(id) on delete cascade,
  attendance_status text not null default 'present'
    check (attendance_status in ('present', 'absent', 'excused', 'late')),
  role_at_session text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (session_id, participant_id)
);
comment on table public.interview_session_attendance is
  'ADR 0072 D7·3 · E1 — who attended each interview session (participant_id → the '
  'unified case participant). RLS via can_read_interview; writes DEFINER-only.';
alter table public.interview_session_attendance enable row level security;
create policy interview_session_attendance_select on public.interview_session_attendance
  for select to authenticated
  using (app.can_read_interview(
    (select s.interview_id from public.interview_sessions s where s.id = session_id),
    auth.uid()));
grant select on public.interview_session_attendance to authenticated;

create table if not exists public.interview_topics (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.case_interviews(id) on delete cascade,
  topic text not null,
  display_position integer not null default 0,
  created_at timestamptz not null default now()
);
comment on table public.interview_topics is
  'ADR 0072 D7·4 · E1 — an interview''s topic list. Additive scaffolding (FE write '
  'RPCs land in E2/E3); RLS via can_read_interview.';
alter table public.interview_topics enable row level security;
create policy interview_topics_select on public.interview_topics
  for select to authenticated
  using (app.can_read_interview(interview_id, auth.uid()));
grant select on public.interview_topics to authenticated;

create table if not exists public.interview_summaries (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.case_interviews(id) on delete cascade,
  audience text not null default 'committee'
    check (audience in ('committee', 'subject', 'external')),
  version integer not null default 1,
  summary_md text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (interview_id, audience, version)
);
comment on table public.interview_summaries is
  'ADR 0072 D7·4 · E1 — versioned, per-audience interview summaries. Additive '
  'scaffolding (FE write RPCs land in E2/E3); RLS via can_read_interview.';
alter table public.interview_summaries enable row level security;
create policy interview_summaries_select on public.interview_summaries
  for select to authenticated
  using (app.can_read_interview(interview_id, auth.uid()));
grant select on public.interview_summaries to authenticated;

-- -----------------------------------------------------------------------------
-- 6 · Fold-in RPCs (gate on can_write_interview → HC039; set in_interview_rpc).
-- -----------------------------------------------------------------------------

-- Validate a case_participant belongs to the interview's case, then set the FK.
create or replace function public.set_interview_participant(p_interview_id uuid, p_participant_id uuid)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case_id uuid;
begin
  perform app.assert_interviews_enabled();
  if not app.can_write_interview(p_interview_id, auth.uid()) then
    raise exception 'sem permissão para editar esta entrevista' using errcode = 'HC039';
  end if;
  v_case_id := app.case_of_interview(p_interview_id);
  if p_participant_id is not null and not exists (
    select 1 from public.case_participants cp
    where cp.id = p_participant_id and cp.case_id = v_case_id and cp.removed_at is null
  ) then
    raise exception 'participante não pertence ao caso desta entrevista' using errcode = 'check_violation';
  end if;
  perform set_config('app.in_interview_rpc', 'on', true);
  update public.case_interviews set participant_id = p_participant_id where id = p_interview_id;
  perform set_config('app.in_interview_rpc', 'off', true);
end;
$$;
alter function public.set_interview_participant(uuid, uuid) owner to postgres;
revoke all on function public.set_interview_participant(uuid, uuid) from public;
grant execute on function public.set_interview_participant(uuid, uuid) to authenticated, service_role;

create or replace function public.set_interview_subject_participant(p_subject_id uuid, p_participant_id uuid)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_interview_id uuid;
  v_case_id uuid;
begin
  perform app.assert_interviews_enabled();
  select interview_id into v_interview_id from public.case_interview_subjects where id = p_subject_id;
  if v_interview_id is null then
    raise exception 'sujeito não encontrado' using errcode = 'P0002';
  end if;
  if not app.can_write_interview(v_interview_id, auth.uid()) then
    raise exception 'sem permissão para editar esta entrevista' using errcode = 'HC039';
  end if;
  v_case_id := app.case_of_interview(v_interview_id);
  if p_participant_id is not null and not exists (
    select 1 from public.case_participants cp
    where cp.id = p_participant_id and cp.case_id = v_case_id and cp.removed_at is null
  ) then
    raise exception 'participante não pertence ao caso desta entrevista' using errcode = 'check_violation';
  end if;
  perform set_config('app.in_interview_rpc', 'on', true);
  update public.case_interview_subjects set participant_id = p_participant_id where id = p_subject_id;
  perform set_config('app.in_interview_rpc', 'off', true);
end;
$$;
alter function public.set_interview_subject_participant(uuid, uuid) owner to postgres;
revoke all on function public.set_interview_subject_participant(uuid, uuid) from public;
grant execute on function public.set_interview_subject_participant(uuid, uuid) to authenticated, service_role;

create or replace function public.set_interview_interviewer_participant(p_interviewer_id uuid, p_participant_id uuid)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_interview_id uuid;
  v_case_id uuid;
begin
  perform app.assert_interviews_enabled();
  select interview_id into v_interview_id from public.case_interview_interviewers where id = p_interviewer_id;
  if v_interview_id is null then
    raise exception 'entrevistador não encontrado' using errcode = 'P0002';
  end if;
  if not app.can_write_interview(v_interview_id, auth.uid()) then
    raise exception 'sem permissão para editar esta entrevista' using errcode = 'HC039';
  end if;
  v_case_id := app.case_of_interview(v_interview_id);
  if p_participant_id is not null and not exists (
    select 1 from public.case_participants cp
    where cp.id = p_participant_id and cp.case_id = v_case_id and cp.removed_at is null
  ) then
    raise exception 'participante não pertence ao caso desta entrevista' using errcode = 'check_violation';
  end if;
  perform set_config('app.in_interview_rpc', 'on', true);
  update public.case_interview_interviewers set participant_id = p_participant_id where id = p_interviewer_id;
  perform set_config('app.in_interview_rpc', 'off', true);
end;
$$;
alter function public.set_interview_interviewer_participant(uuid, uuid) owner to postgres;
revoke all on function public.set_interview_interviewer_participant(uuid, uuid) from public;
grant execute on function public.set_interview_interviewer_participant(uuid, uuid) to authenticated, service_role;

-- set_interview_confidentiality — now ENFORCING; 7-value; audited (interview.confidentiality_changed).
create or replace function public.set_interview_confidentiality(p_interview_id uuid, p_level text)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_old text;
  v_commission uuid;
begin
  perform app.assert_interviews_enabled();
  if not app.can_write_interview(p_interview_id, auth.uid()) then
    raise exception 'sem permissão para editar esta entrevista' using errcode = 'HC039';
  end if;
  if app.confidentiality_rank(p_level) is null then
    raise exception 'nível de confidencialidade inválido' using errcode = 'HC0E5';
  end if;
  select confidentiality_level, commission_id into v_old, v_commission
  from public.case_interviews where id = p_interview_id;
  if v_old is null then
    raise exception 'entrevista não encontrada' using errcode = 'P0002';
  end if;
  perform set_config('app.in_interview_rpc', 'on', true);
  update public.case_interviews set confidentiality_level = p_level where id = p_interview_id;
  perform set_config('app.in_interview_rpc', 'off', true);
  if p_level is distinct from v_old then
    perform app.audit_write('interview.confidentiality_changed', 'interview', p_interview_id, v_commission,
      'Confidencialidade da entrevista alterada',
      jsonb_build_object('old', v_old, 'new', p_level));
  end if;
end;
$$;
alter function public.set_interview_confidentiality(uuid, text) owner to postgres;
revoke all on function public.set_interview_confidentiality(uuid, text) from public;
grant execute on function public.set_interview_confidentiality(uuid, text) to authenticated, service_role;

-- record_session_attendance — upsert a participant's attendance on a session.
create or replace function public.record_session_attendance(
  p_session_id uuid, p_participant_id uuid, p_attendance_status text default 'present',
  p_role_at_session text default null
) returns uuid
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_interview_id uuid;
  v_case_id uuid;
  v_id uuid;
begin
  perform app.assert_interviews_enabled();
  select interview_id into v_interview_id from public.interview_sessions where id = p_session_id;
  if v_interview_id is null then
    raise exception 'sessão não encontrada' using errcode = 'P0002';
  end if;
  if not app.can_write_interview(v_interview_id, auth.uid()) then
    raise exception 'sem permissão para editar esta entrevista' using errcode = 'HC039';
  end if;
  if p_attendance_status not in ('present', 'absent', 'excused', 'late') then
    raise exception 'situação de presença inválida' using errcode = 'check_violation';
  end if;
  v_case_id := app.case_of_interview(v_interview_id);
  if not exists (
    select 1 from public.case_participants cp
    where cp.id = p_participant_id and cp.case_id = v_case_id and cp.removed_at is null
  ) then
    raise exception 'participante não pertence ao caso desta entrevista' using errcode = 'check_violation';
  end if;
  insert into public.interview_session_attendance
    (session_id, participant_id, attendance_status, role_at_session, created_by)
  values (p_session_id, p_participant_id, p_attendance_status, nullif(btrim(p_role_at_session), ''), auth.uid())
  on conflict (session_id, participant_id) do update
    set attendance_status = excluded.attendance_status,
        role_at_session = excluded.role_at_session
  returning id into v_id;
  return v_id;
end;
$$;
alter function public.record_session_attendance(uuid, uuid, text, text) owner to postgres;
revoke all on function public.record_session_attendance(uuid, uuid, text, text) from public;
grant execute on function public.record_session_attendance(uuid, uuid, text, text) to authenticated, service_role;
