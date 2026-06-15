-- Phase 11 / B2 (1 of 4): Interviews — CORE schema, children, minting, lifecycle
-- + child-lock + link guards, the RLS resolver + participant-write predicate, the
-- case_events kind alter, and the feature flag.
--
-- Hospital committees (e.g. M&M) INTERVIEW healthcare professionals about a
-- specific case — who was involved in a patient's care, what happened. Interviews
-- are a CASE-SCOPED sibling of Phase-10 Meetings (ADR 0026): they clone the proven
-- meetings patterns (status state-machine + trigger guard + app.in_*_rpc session
-- flag; participant user_id XOR external_name; per-commission number minting;
-- private immutable Storage bucket + soft-delete; commission-scoped RLS via a
-- SECURITY DEFINER resolver). The one genuinely NEW piece is a ROW-LEVEL
-- PARTICIPANT WRITE GRANT: a registered interviewer (a platform user added as an
-- interviewer of that interview) may write it, not just staff_admin — modelled on
-- app.can_sign_meeting and implemented as the SECURITY DEFINER app.can_write_interview.
--
-- NO patient-identifiable data: an interview carries a system-minted per-commission
-- interview_number, an optional title, scheduling, a free-text summary, the
-- professionals interviewed, and evidence — never patient records.
--
-- This migration lands the data model + guards + the two RLS helpers + the
-- case_events.kind alter + the feature flag. The RLS POLICIES land in
-- …091002_interviews_rls.sql; the bucket in …091003; the RPCs in …091001.
--
-- New SQLSTATEs (user-defined HC0xx class, continuing after Phase-10's HC037;
-- HC021 assignee/interviewer-not-a-member is REUSED):
--   HC038 interview in the wrong state for the requested lifecycle operation.
--   HC039 not entitled to write this interview (not staff_admin/admin nor a
--         registered interviewer of it).
--   HC040 invalid attachment (storage_path XOR external_url violated, or a
--         non-https external link).
--   HC041 cannot conclude — the interview has no interviewee (subject).

-- ===========================================================================
-- case_interviews — header + lifecycle authority
-- ===========================================================================
-- interview_number is a PER-COMMISSION counter (set by the BEFORE INSERT trigger;
-- the insert omits it), backstopped by unique(commission_id, interview_number) —
-- create_interview wraps the insert in a one-shot unique_violation retry. The
-- 5-state lifecycle is enforced by app.guard_interview_status (below). Once the
-- status reaches concluida (or cancelada) the content is frozen except under the
-- app.in_interview_rpc flag (set by the …091001 RPCs).
--
-- commission_id is DENORMALIZED (= the case's commission) so per-commission
-- numbering, app.commission_of_interview, and the child RLS use a direct column;
-- app.guard_interview_links keeps it honest and validates the optional
-- case_phase_id belongs to the case. title is OPTIONAL (the UI falls back to
-- "Entrevista nº N"). summary_md is sanitized Markdown (Architecture Rule 7,
-- enforced in the data layer). form_version_id is a NULLABLE forward hook (a
-- structured interview script in a future iteration; unused in v1).
-- registry_event_id links to the case_events row written on conclude, so a
-- re-conclude after reopen UPDATEs the SAME timeline row (no duplicate).
create table public.case_interviews (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  case_phase_id uuid references public.case_phases (id) on delete set null,
  interview_number integer not null,
  title text,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'agendada', 'em_andamento', 'concluida', 'cancelada')),
  modality text not null default 'presencial'
    check (modality in ('presencial', 'remoto', 'hibrido')),
  location_text text,
  meeting_url text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  -- When the interview was actually conducted (set by start_interview); flows to
  -- case_events.occurred_at on conclude (fallback current_date).
  conducted_at timestamptz,
  summary_md text,
  -- Forward hook: a form version that may back a structured script later; unused in v1.
  form_version_id uuid references public.form_versions (id),
  -- The case_events row written at conclusion (the registry link); reused on re-conclude.
  registry_event_id uuid references public.case_events (id) on delete set null,
  concluded_at timestamptz,
  concluded_by uuid references public.profiles (id),
  cancelled_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_interviews_commission_number_key unique (commission_id, interview_number),
  constraint case_interviews_schedule_range check (
    scheduled_end is null or scheduled_start is null or scheduled_end >= scheduled_start
  )
);

alter table public.case_interviews enable row level security;
create index case_interviews_commission_idx on public.case_interviews (commission_id);
create index case_interviews_case_idx on public.case_interviews (case_id);
create index case_interviews_case_phase_idx on public.case_interviews (case_phase_id);
create index case_interviews_status_idx on public.case_interviews (commission_id, status);

-- ===========================================================================
-- case_interview_subjects — interviewees (the professionals interviewed)
-- ===========================================================================
-- A platform user (user_id) XOR an external person (external_name). clinical_role
-- is FREE TEXT (resolved decision 5; e.g. "Enfermeira da UTI") — clinical roles
-- vary too widely for an enum. **No patient data** — subjects are STAFF, never
-- patients.
create table public.case_interview_subjects (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.case_interviews (id) on delete cascade,
  user_id uuid references public.profiles (id),
  external_name text,
  external_org text,
  clinical_role text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A platform member XOR an external person: exactly one identity source
  -- (clone meeting_attendees_identity_xor).
  constraint case_interview_subjects_identity_xor check (
    (user_id is not null and external_name is null)
    or (user_id is null and nullif(btrim(external_name), '') is not null)
  )
);

alter table public.case_interview_subjects enable row level security;
create index case_interview_subjects_interview_idx
  on public.case_interview_subjects (interview_id);
-- A platform member appears at most once per interview (external people unconstrained).
create unique index case_interview_subjects_interview_user_key
  on public.case_interview_subjects (interview_id, user_id)
  where user_id is not null;

-- ===========================================================================
-- case_interview_interviewers — committee members conducting the interview
-- ===========================================================================
-- user_id XOR external_name (resolved decision 6). A REGISTERED interviewer
-- (user_id) gains row-level WRITE on the interview (app.can_write_interview) and
-- MUST be a member of the commission (enforced in the add RPC → HC021). role is a
-- FIXED enum (resolved decision 7).
create table public.case_interview_interviewers (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.case_interviews (id) on delete cascade,
  user_id uuid references public.profiles (id),
  external_name text,
  external_org text,
  role text not null default 'entrevistador'
    check (role in ('entrevistador_principal', 'entrevistador', 'observador', 'anotador')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_interview_interviewers_identity_xor check (
    (user_id is not null and external_name is null)
    or (user_id is null and nullif(btrim(external_name), '') is not null)
  )
);

alter table public.case_interview_interviewers enable row level security;
create index case_interview_interviewers_interview_idx
  on public.case_interview_interviewers (interview_id);
create index case_interview_interviewers_user_idx
  on public.case_interview_interviewers (user_id);
-- A platform interviewer appears at most once per interview.
create unique index case_interview_interviewers_interview_user_key
  on public.case_interview_interviewers (interview_id, user_id)
  where user_id is not null;

-- ===========================================================================
-- case_interview_attachments — unified evidence (stored file XOR external link)
-- ===========================================================================
-- kind is the EVIDENCE taxonomy (resolved decision 8), ORTHOGONAL to the
-- file-vs-link distinction: any kind may be a stored file (storage_path) OR an
-- external link (external_url). gravacao_audio is typically a LINK (audio BYTES
-- are never stored in the bucket — resolved decision 8); transcricao_assinada is
-- typically a stored PDF. The storage_path XOR external_url CHECK enforces exactly
-- one (resolved decision 9). SOFT-DELETE only (deleted_at/deleted_by); the Storage
-- object is NEVER removed (Architecture Rule 6), reads filter deleted_at IS NULL.
create table public.case_interview_attachments (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.case_interviews (id) on delete cascade,
  kind text not null default 'outro'
    check (kind in ('gravacao_audio', 'transcricao_assinada', 'evidencia', 'outro')),
  title text not null,
  -- The immutable Storage path in the interview-attachments bucket
  -- ({commission_id}/{interview_id}/{uuid}.{ext}); unique so a path is referenced once.
  storage_path text unique,
  -- An external https link (e.g. an audio-recording URL); audio bytes are never stored.
  external_url text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id),
  constraint case_interview_attachments_title_not_blank check (btrim(title) <> ''),
  constraint case_interview_attachments_size_nonneg check (size_bytes is null or size_bytes >= 0),
  -- Exactly ONE source: a stored file XOR an external link (resolved decision 9).
  constraint case_interview_attachments_source_xor check (
    (storage_path is not null and external_url is null)
    or (storage_path is null and external_url is not null)
  ),
  -- An external link must be https (defence in depth; the action validates too).
  constraint case_interview_attachments_link_https check (
    external_url is null or external_url like 'https://%'
  )
);

alter table public.case_interview_attachments enable row level security;
create index case_interview_attachments_interview_idx
  on public.case_interview_attachments (interview_id);
create index case_interview_attachments_interview_live_idx
  on public.case_interview_attachments (interview_id)
  where deleted_at is null;

-- ===========================================================================
-- app.commission_of_interview(interview_id) -> uuid    (RLS resolver)
-- ===========================================================================
-- SECURITY DEFINER + pinned search_path so it resolves the commission for a child
-- table's RLS regardless of the caller's RLS. Reads the DENORMALIZED commission_id
-- column directly — no recursion into case_interviews' own SELECT policy. Mirrors
-- app.commission_of_meeting / commission_of_case.
create function app.commission_of_interview(p_interview_id uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select commission_id from public.case_interviews where id = p_interview_id;
$$;

revoke all on function app.commission_of_interview(uuid) from public;
grant execute on function app.commission_of_interview(uuid) to authenticated, service_role;

-- ===========================================================================
-- app.is_staff_admin_of_for(commission, uid) / app.is_admin_for(uid)
-- ===========================================================================
-- uid-PURE mirrors so app.can_write_interview can be a two-arg, pgTAP-testable
-- predicate. is_staff_admin_of_for is the arbitrary-user twin of is_staff_admin_of
-- (mirror is_member_of_for). is_admin_for checks profiles.is_admin DIRECTLY (the
-- DB fallback only — the JWT 'is_admin' claim is per-SESSION, so it cannot be read
-- for an arbitrary uid; the policies always pass auth.uid(), and the current
-- session's JWT-claim admin path is preserved by the policies also OR-ing in the
-- claim-aware app.is_admin()).
create function app.is_staff_admin_of_for(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select exists (
    select 1 from public.commission_members
    where commission_id = p_commission_id
      and user_id = p_user_id
      and role = 'staff_admin'
  );
$$;

revoke all on function app.is_staff_admin_of_for(uuid, uuid) from public;
grant execute on function app.is_staff_admin_of_for(uuid, uuid) to authenticated, service_role;

create function app.is_admin_for(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select exists (
    select 1 from public.profiles where id = p_user_id and is_admin = true
  );
$$;

revoke all on function app.is_admin_for(uuid) from public;
grant execute on function app.is_admin_for(uuid) to authenticated, service_role;

-- ===========================================================================
-- app.can_write_interview(interview_id, uid) -> boolean
-- ===========================================================================
-- THE NEW RLS SHAPE: the row-level participant write grant (resolved decision 13).
-- uid may write the interview (+ all its children) iff, in the interview's
-- commission, uid is a staff_admin/admin OR is a REGISTERED interviewer on this
-- interview. SECURITY DEFINER (modelled on app.can_sign_meeting) so the inner
-- reads of case_interviews / case_interview_interviewers BYPASS RLS — the
-- case_interviews UPDATE/DELETE policy and every child WRITE policy can call this
-- without re-entering any RLS policy (no recursion). uid-pure → pgTAP-testable.
-- A staff member who is added as an interviewer thereby gains write on JUST this
-- interview (documented spread; all members already read — ADR 0026 risk note).
create function app.can_write_interview(p_interview_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select exists (
    select 1
    from public.case_interviews i
    where i.id = p_interview_id
      and (
        app.is_staff_admin_of_for(i.commission_id, p_uid)
        or app.is_admin_for(p_uid)
        or exists (
          select 1 from public.case_interview_interviewers iv
          where iv.interview_id = i.id and iv.user_id = p_uid
        )
      )
  );
$$;

revoke all on function app.can_write_interview(uuid, uuid) from public;
grant execute on function app.can_write_interview(uuid, uuid) to authenticated, service_role;

-- ===========================================================================
-- Interview-number minting — per-commission counter
-- ===========================================================================
-- BEFORE INSERT on case_interviews. Advisory-lock copy of app.mint_meeting_number:
-- serialized PER COMMISSION via pg_advisory_xact_lock(hashtextextended(
-- commission_id, 0)) — parallel across commissions, serial within one — backstopped
-- by unique(commission_id, interview_number) (create_interview adds the one-shot
-- unique_violation retry on top).
create function app.mint_interview_number()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.commission_id::text, 0));

  new.interview_number := coalesce(
    (select max(interview_number) from public.case_interviews where commission_id = new.commission_id),
    0
  ) + 1;

  return new;
end;
$$;

create trigger mint_interview_number_trg
  before insert on public.case_interviews
  for each row execute function app.mint_interview_number();

-- ===========================================================================
-- app.guard_interview_links — commission honesty + phase-in-case guard
-- ===========================================================================
-- BEFORE INSERT/UPDATE on case_interviews. SECURITY DEFINER so it reads the case
-- regardless of RLS. (1) the denormalized commission_id must equal the case's
-- commission (the create RPC sets it; defend here). (2) an optional case_phase_id
-- must belong to THIS case (no cross-case phase links). Mirrors
-- guard_meeting_action_item's honesty check.
create function app.guard_interview_links()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_case_commission uuid;
  v_phase_case uuid;
begin
  select commission_id into v_case_commission
  from public.cases where id = new.case_id;
  if v_case_commission is null then
    raise exception 'caso não encontrado' using errcode = 'no_data_found';
  end if;
  if new.commission_id <> v_case_commission then
    raise exception 'a comissão da entrevista não corresponde ao caso'
      using errcode = 'check_violation';
  end if;

  if new.case_phase_id is not null then
    select case_id into v_phase_case
    from public.case_phases where id = new.case_phase_id;
    if v_phase_case is distinct from new.case_id then
      raise exception 'a fase selecionada não pertence a este caso'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_interview_links_trg
  before insert or update on public.case_interviews
  for each row execute function app.guard_interview_links();

-- ===========================================================================
-- Interview lifecycle state-machine + content-freeze guard
-- ===========================================================================
-- Mirrors guard_meeting_status. Every legitimate mutation happens inside a
-- …091001 RPC that sets app.in_interview_rpc = 'on'; a DIRECT client UPDATE/DELETE
-- (even one RLS allows) is rejected unless the flag is on. This funnels every
-- status change AND every content edit of a concluded interview through the
-- vetted RPCs.
--
-- Legal transitions (only under app.in_interview_rpc):
--   rascunho      -> agendada | cancelada
--   agendada      -> em_andamento | cancelada
--   em_andamento  -> concluida | cancelada
--   concluida     -> em_andamento (reopen)
--   cancelada is TERMINAL (NOT reopenable).
--
-- Content-freeze: once status in (concluida, cancelada) the header is frozen
-- except under the flag (conclude/cancel locks the record; reopen unlocks it by
-- moving back to em_andamento). The child tables (subjects/interviewers) are
-- frozen by the sibling app.guard_interview_child_lock; attachments are NOT
-- child-locked (the late signed-transcript case).
create function app.guard_interview_status()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_interview_rpc', true), 'off') = 'on';
begin
  if tg_op = 'DELETE' then
    -- A locked interview (concluida/cancelada) cannot be deleted outside an RPC.
    -- (Cascade deletes from the case/commission run as the owner and bypass this.)
    if not v_in_rpc and old.status in ('concluida', 'cancelada') then
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
      (old.status = 'rascunho' and new.status in ('agendada', 'cancelada'))
      or (old.status = 'agendada' and new.status in ('em_andamento', 'cancelada'))
      or (old.status = 'em_andamento' and new.status in ('concluida', 'cancelada'))
      or (old.status = 'concluida' and new.status = 'em_andamento')
    ) then
      raise exception 'transição de estado de entrevista inválida: % -> %', old.status, new.status
        using errcode = 'HC038';
    end if;

    return new;
  end if;

  -- No status change. Under the flag any field edit is allowed (the RPCs are the
  -- authority). Outside the flag, freeze a LOCKED interview (concluida/cancelada).
  if v_in_rpc then
    return new;
  end if;

  if old.status in ('concluida', 'cancelada') then
    raise exception 'entrevistas concluídas ou canceladas são imutáveis (edição bloqueada)'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger guard_interview_status_trg
  before update or delete on public.case_interviews
  for each row execute function app.guard_interview_status();

-- ===========================================================================
-- app.guard_interview_child_lock — freeze subjects/interviewers once locked
-- ===========================================================================
-- Sibling of app.guard_interview_status (which freezes the header). This freezes
-- the SUBJECT + INTERVIEWER child tables once the parent interview is locked
-- (status in concluida/cancelada): any direct INSERT/UPDATE/DELETE on a child of
-- a locked interview is rejected. ATTACHMENTS are DELIBERATELY NOT guarded here —
-- the signed transcript / late evidence is uploaded after conclusion (resolved
-- with the lead). Like guard_meeting_child_lock it keys PURELY on the parent
-- status (NOT app.in_interview_rpc) so the authoring RPCs — which set the flag for
-- their own writes — STILL cannot edit a locked interview's parties. The
-- legitimate locked-state op (reopen) moves the parent back to em_andamento, which
-- unlocks the children again. A parent already gone (cascade delete) is a no-op.
create function app.guard_interview_child_lock()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_interview_id uuid;
  v_status text;
begin
  v_interview_id := case when tg_op = 'DELETE' then old.interview_id else new.interview_id end;
  select status into v_status from public.case_interviews where id = v_interview_id;

  if v_status is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if v_status in ('concluida', 'cancelada') then
    raise exception 'o conteúdo desta entrevista está bloqueado (%)', v_status
      using errcode = 'check_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger guard_interview_child_lock_subjects_trg
  before insert or update or delete on public.case_interview_subjects
  for each row execute function app.guard_interview_child_lock();

create trigger guard_interview_child_lock_interviewers_trg
  before insert or update or delete on public.case_interview_interviewers
  for each row execute function app.guard_interview_child_lock();

-- ===========================================================================
-- updated_at maintenance (the children + header share one bump fn)
-- ===========================================================================
create function app.touch_interview_updated_at()
returns trigger
language plpgsql
set search_path = app, public, pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_case_interviews_updated_at
  before update on public.case_interviews
  for each row execute function app.touch_interview_updated_at();
create trigger touch_case_interview_subjects_updated_at
  before update on public.case_interview_subjects
  for each row execute function app.touch_interview_updated_at();
create trigger touch_case_interview_interviewers_updated_at
  before update on public.case_interview_interviewers
  for each row execute function app.touch_interview_updated_at();

-- ===========================================================================
-- case_events.kind — add 'interview'
-- ===========================================================================
-- The conclusion of an interview writes a case_events row (resolved decision 1).
-- Widen the inline CHECK (exact name confirmed in the live DB: case_events_kind_check,
-- from 20260614092002). Additive — existing rows all satisfy the wider set.
alter table public.case_events drop constraint case_events_kind_check;
alter table public.case_events add constraint case_events_kind_check
  check (kind in ('note', 'meeting', 'decision', 'interview', 'other'));

-- ===========================================================================
-- Feature flag — interviews (default OFF)
-- ===========================================================================
-- Every Phase-11 RPC gates app.assert_interviews_enabled() at entry, and the
-- server actions gate public.interviews_enabled() in the TS layer, so the feature
-- is dark until …091004 flips it ON at phase completion (mirroring the meetings
-- flag). Tests + the interviews seed run with the flag ON (flipped in-phase).
insert into app.feature_flags (key, enabled, description) values
  ('interviews', false,
   'When true, the Interviews feature (case-scoped interviews of healthcare '
   || 'professionals: scheduling, lifecycle, interviewees + interviewers, '
   || 'evidence attachments, conclusion writing a case_events registry row) is '
   || 'live. Enabled at Phase 11 completion.');

create function app.assert_interviews_enabled()
returns void
language plpgsql
stable
set search_path = app, public, pg_catalog
as $$
begin
  if not app.feature_enabled('interviews') then
    raise exception 'o recurso de entrevistas não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;

revoke all on function app.assert_interviews_enabled() from public;
grant execute on function app.assert_interviews_enabled() to authenticated, service_role;

-- public.interviews_enabled() — TS-layer gate for the server actions. Thin
-- SECURITY DEFINER boolean read of the flag (which lives in the locked-down app
-- schema). Mirrors public.meetings_enabled / public.cases_extras_enabled.
create function public.interviews_enabled()
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select app.feature_enabled('interviews');
$$;

grant execute on function public.interviews_enabled() to authenticated, service_role;
revoke all on function public.interviews_enabled() from public, anon;
