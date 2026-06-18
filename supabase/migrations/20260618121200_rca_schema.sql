-- Phase 14c / B1: Patient-Safety / NSP — RCA WORKSPACE schema. ADR 0030 umbrella;
-- the 14c backend decision in ADR 0033 (this sub-phase). Builds on the forward-safe
-- `rca` SHELL that 14b's confirm_triage mints when a triage mandates an RCA
-- (migration …121100; the seed EV-0003 already has one).
--
-- The RCA is the structured investigation a sentinel triage mandates
-- (docs/design/README_rca.md): a TEAM frames the problem (stage 1), builds an
-- Ishikawa fishbone + 5-Whys drill (stage 2), and distils classified ROOT CAUSES
-- (stage 3). (README stage 4 / PDCA corrective actions is Phase 14d's capa_* — NOT
-- here; this migration delivers the causal model that 14d's capa_action.root_cause_id
-- FKs into.) This migration lands:
--   * the `rca` ALTER — NULLABLE-ONLY columns added to the existing shell (the shell
--     rows from 14b's confirm_triage / the seed must survive: never a bare NOT NULL).
--   * the six child tables: rca_members, rca_timeline_entries, rca_evidence,
--     rca_factors, rca_why_chains, rca_root_causes (all with fixed CHECK enums).
--   * app.event_of_rca — the RLS resolver (mirror commission_of_interview).
--   * app.can_write_rca — THE participant write grant (DEFINER, uid-pure; mirror
--     app.can_write_interview): PQS/admin OR a NON-OBSERVER assigned team member.
--   * app.guard_rca_status — lifecycle state machine + freeze-at-completed, gated by
--     the EXISTING 14a app.in_safety_rpc GUC (confirm_triage mints the shell under it,
--     so the guard MUST honor the same flag).
--   * app.guard_rca_child_lock — freezes ALL FIVE child tables once the parent rca is
--     'completed' (keys on parent status, NOT the GUC; mirror guard_interview_child_lock).
--
-- The RLS + the nsp-evidence bucket land in B2 (…121201); the RPCs + audit trigger in
-- B3 (…121202). No flag flip — patient_safety is already ON (14a's umbrella flag).
--
-- New SQLSTATEs (ADR 0030 reserves HC043–HC053 for Phase 14; 14c takes the next two):
--   HC047 RCA in the wrong state / frozen (raised by the guards + lifecycle RPCs).
--   HC048 not entitled to write the RCA (raised by the RPCs' can_write_rca gate).

-- ===========================================================================
-- rca — EXTEND the 14b shell (nullable-only; existing rows must survive)
-- ===========================================================================
-- The shell already has: id, event_id (unique → the 1:1), status (CHECK already
-- covers draft/in_progress/in_review/completed), due_date, created_by, created_at,
-- updated_at, and a can_read_event SELECT policy. We add the stage-1 problem fields,
-- the findings summary, and the lifecycle stamps — ALL nullable / defaulted so the
-- existing draft shells (confirm_triage + seed EV-0003) remain valid.
-- *_md columns are SANITIZED Markdown (Rule 7); clinical free text — NEVER copied
-- into the audit log (Rule 11).
alter table public.rca
  add column what_md text,
  add column expected_md text,
  add column detected text,
  add column impact text,
  add column scope text,
  add column summary_md text,
  add column submitted_by uuid references public.profiles (id),
  add column submitted_at timestamptz,
  add column completed_by uuid references public.profiles (id),
  add column completed_at timestamptz;

comment on column public.rca.what_md is
  'Problem statement (what happened) — SANITIZED Markdown (Rule 7). Clinical free '
  'text; NEVER copied into the audit log (Rule 11).';
comment on column public.rca.summary_md is
  'Findings narrative — SANITIZED Markdown (Rule 7). NEVER audited as a body.';

-- ===========================================================================
-- rca_members — the RCA team (user XOR external; fixed role)
-- ===========================================================================
-- A platform user (user_id) XOR an external participant (external_name). A
-- platform-user member with ANY role EXCEPT 'observer' gains row-level write on the
-- whole RCA (app.can_write_rca); an observer is read-only. Partial-unique on user_id
-- per rca (a user appears at most once); externals may repeat by name.
create table public.rca_members (
  id uuid primary key default gen_random_uuid(),
  rca_id uuid not null references public.rca (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  external_name text,
  role text not null
    check (role in ('lead', 'facilitator', 'sme', 'reviewer', 'executive_sponsor', 'observer')),
  created_at timestamptz not null default now(),
  -- Exactly one of user_id / external_name (mirror the interviews participant shape).
  constraint rca_members_identity_shape check (
    (user_id is not null and external_name is null)
    or (user_id is null and external_name is not null and btrim(external_name) <> '')
  )
);

alter table public.rca_members enable row level security;

create index rca_members_rca_idx on public.rca_members (rca_id);
-- A platform user appears at most once per RCA.
create unique index rca_members_user_key on public.rca_members (rca_id, user_id)
  where user_id is not null;

comment on table public.rca_members is
  'RCA team (Phase 14c). user_id XOR external_name; a non-observer platform-user '
  'member gains row-level write via app.can_write_rca (the interviews participant grant).';

-- ===========================================================================
-- rca_timeline_entries — the incident chronology
-- ===========================================================================
create table public.rca_timeline_entries (
  id uuid primary key default gen_random_uuid(),
  rca_id uuid not null references public.rca (id) on delete cascade,
  occurred_at timestamptz not null,
  description text not null,
  position integer not null,
  created_at timestamptz not null default now(),
  constraint rca_timeline_description_not_blank check (btrim(description) <> ''),
  constraint rca_timeline_position_key unique (rca_id, position) deferrable initially immediate
);

alter table public.rca_timeline_entries enable row level security;

create index rca_timeline_rca_idx on public.rca_timeline_entries (rca_id, position);

-- ===========================================================================
-- rca_evidence — upload XOR external link XOR citation (soft-delete; immutable file)
-- ===========================================================================
-- kind = document → storage_path set (a file in the immutable nsp-evidence bucket).
-- kind = link     → external_url set (https; mirror the interviews HC040 shape).
-- kind = citation → exactly one cited_*_id set (typed nullable FKs) + a citation_label
--                   SNAPSHOT (viewable-forever across the target's later change).
-- The three-way XOR is a table CHECK; the RPC ALSO pre-validates the shape and raises
-- check_violation with a DISTINCT pt-BR message (so the user never sees a raw
-- constraint name — the Phase-5 MINOR-2 lesson). Soft-delete via deleted_at/_by; the
-- object is never removed (Rule 6).
create table public.rca_evidence (
  id uuid primary key default gen_random_uuid(),
  rca_id uuid not null references public.rca (id) on delete cascade,
  kind text not null check (kind in ('document', 'link', 'citation')),
  title text not null,
  storage_path text,
  external_url text,
  -- citation targets (exactly one set when kind = 'citation'):
  cited_interview_id uuid references public.case_interviews (id) on delete set null,
  cited_meeting_id uuid references public.meetings (id) on delete set null,
  cited_document_id uuid references public.case_documents (id) on delete set null,
  citation_label text,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint rca_evidence_title_not_blank check (btrim(title) <> ''),
  constraint rca_evidence_https check (external_url is null or external_url like 'https://%'),
  -- Exactly one mode populated, matching `kind`.
  constraint rca_evidence_shape check (
    (kind = 'document'
       and storage_path is not null and external_url is null
       and cited_interview_id is null and cited_meeting_id is null and cited_document_id is null)
    or (kind = 'link'
       and external_url is not null and storage_path is null
       and cited_interview_id is null and cited_meeting_id is null and cited_document_id is null)
    or (kind = 'citation'
       and storage_path is null and external_url is null
       and citation_label is not null
       -- exactly one citation target:
       and (cited_interview_id is not null)::int
         + (cited_meeting_id is not null)::int
         + (cited_document_id is not null)::int = 1)
  )
);

alter table public.rca_evidence enable row level security;

create index rca_evidence_rca_idx on public.rca_evidence (rca_id);
-- A stored object's path is unique (immutable-path invariant; mirror case_documents).
create unique index rca_evidence_storage_path_key on public.rca_evidence (storage_path)
  where storage_path is not null;

comment on table public.rca_evidence is
  'RCA evidence (Phase 14c): an uploaded file (immutable nsp-evidence bucket) XOR an '
  'https link XOR a citation (snapshot label) to an existing interview/meeting/document. '
  'Soft-delete only; objects are never removed (Rule 6).';

-- ===========================================================================
-- rca_factors — the fishbone (Ishikawa) factors
-- ===========================================================================
create table public.rca_factors (
  id uuid primary key default gen_random_uuid(),
  rca_id uuid not null references public.rca (id) on delete cascade,
  category text not null
    check (category in ('people', 'communication', 'process', 'equipment', 'environment', 'policy')),
  text text not null,
  is_key boolean not null default false,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rca_factors_text_not_blank check (btrim(text) <> ''),
  constraint rca_factors_position_key unique (rca_id, position) deferrable initially immediate
);

alter table public.rca_factors enable row level security;

create index rca_factors_rca_idx on public.rca_factors (rca_id, position);

-- ===========================================================================
-- rca_why_chains — the 5-Whys drill (one per KEY factor; lazily created)
-- ===========================================================================
-- steps is an ordered jsonb array of up to 5 "because…" strings ('' = unanswered).
-- 1:1 with a key factor (unique factor_id). The set-step / set-root RPCs upsert by
-- factor_id, lazily creating the row.
create table public.rca_why_chains (
  id uuid primary key default gen_random_uuid(),
  rca_id uuid not null references public.rca (id) on delete cascade,
  factor_id uuid not null references public.rca_factors (id) on delete cascade,
  steps jsonb not null default '[]'::jsonb,
  root_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rca_why_chains_factor_key unique (factor_id),
  constraint rca_why_chains_steps_is_array check (jsonb_typeof(steps) = 'array'),
  constraint rca_why_chains_steps_max5 check (jsonb_array_length(steps) <= 5)
);

alter table public.rca_why_chains enable row level security;

create index rca_why_chains_rca_idx on public.rca_why_chains (rca_id);

-- ===========================================================================
-- rca_root_causes — the distilled root causes (stage 3)
-- ===========================================================================
-- The `id` PK is the STABLE FK target for Phase-14d's capa_action.root_cause_id —
-- do NOT repurpose it. category is nullable (a root cause may not map to a single
-- fishbone rib); classification + type are fixed enums.
create table public.rca_root_causes (
  id uuid primary key default gen_random_uuid(),
  rca_id uuid not null references public.rca (id) on delete cascade,
  text text not null,
  category text
    check (category is null
      or category in ('people', 'communication', 'process', 'equipment', 'environment', 'policy')),
  classification text not null default 'system'
    check (classification in ('system', 'human', 'environment', 'external')),
  type text not null default 'root'
    check (type in ('root', 'contributing')),
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rca_root_causes_text_not_blank check (btrim(text) <> ''),
  constraint rca_root_causes_position_key unique (rca_id, position) deferrable initially immediate
);

alter table public.rca_root_causes enable row level security;

create index rca_root_causes_rca_idx on public.rca_root_causes (rca_id, position);

comment on table public.rca_root_causes is
  'Distilled RCA root causes (Phase 14c, stage 3). The `id` PK is the STABLE FK '
  'target for Phase-14d capa_action.root_cause_id — do not repurpose it.';

-- ===========================================================================
-- app.event_of_rca(rca_id) -> uuid    (RLS resolver — the RCA's event)
-- ===========================================================================
-- Resolves the RCA's event id for child-table RLS / the access predicate, bypassing
-- the caller's RLS. Mirrors app.commission_of_interview.
create function app.event_of_rca(p_rca_id uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select event_id from public.rca where id = p_rca_id;
$$;

revoke all on function app.event_of_rca(uuid) from public;
grant execute on function app.event_of_rca(uuid) to authenticated, service_role;

-- ===========================================================================
-- app.can_write_rca(rca_id, uid) -> boolean    (THE participant write grant)
-- ===========================================================================
-- uid may write the RCA (+ all its children) iff: app.is_pqs_member(uid) (PQS/admin —
-- the NSP runs RCAs) OR uid is an assigned NON-OBSERVER team member of this RCA.
-- SECURITY DEFINER (modelled on app.can_write_interview) so the inner reads of rca /
-- rca_members BYPASS RLS — every WRITE policy + the RPC gate can call this without
-- re-entering any RLS policy (no recursion). uid-pure → pgTAP-testable. An OBSERVER
-- is in rca_members but excluded here, so they stay READ-ONLY (they read via
-- can_read_event). READS use app.can_read_event (event scope), NOT this predicate —
-- so any committee member who can see the event reads the RCA; only the team writes.
create function app.can_write_rca(p_rca_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select exists (
    select 1
    from public.rca r
    where r.id = p_rca_id
      and (
        app.is_pqs_member(p_uid)
        or exists (
          select 1 from public.rca_members m
          where m.rca_id = r.id
            and m.user_id = p_uid
            and m.role <> 'observer'
        )
      )
  );
$$;

revoke all on function app.can_write_rca(uuid, uuid) from public;
grant execute on function app.can_write_rca(uuid, uuid) to authenticated, service_role;

-- ===========================================================================
-- app.guard_rca_status — lifecycle state machine + freeze-at-completed
-- ===========================================================================
-- BEFORE UPDATE OR DELETE on rca. Gated by the EXISTING 14a app.in_safety_rpc GUC
-- (confirm_triage mints the shell under it; every RCA RPC sets it). Legal transitions
-- (only under the flag):
--   draft        -> in_progress | completed? NO (must pass review) ; -> in_progress
--   in_progress  -> in_review | completed (allow direct complete for a small team) — NO:
--                   keep it explicit: in_progress -> in_review
--   in_review    -> completed | in_progress (send back)
--   completed    -> in_progress (reopen)
-- Mirrors guard_meeting_status / guard_event_triage. Once 'completed' the header is
-- frozen except under the flag (the RPCs are the authority). A DELETE of a completed
-- RCA outside the flag is rejected.
create function app.guard_rca_status()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_safety_rpc', true), 'off') = 'on';
begin
  if tg_op = 'DELETE' then
    if not v_in_rpc and old.status = 'completed' then
      raise exception 'uma análise concluída não pode ser excluída' using errcode = 'HC047';
    end if;
    return old;
  end if;

  if new.status is distinct from old.status then
    if not v_in_rpc then
      raise exception 'mudanças de estado da análise devem passar pelas RPCs do NSP'
        using errcode = 'HC047';
    end if;
    if not (
      (old.status = 'draft' and new.status = 'in_progress')
      or (old.status = 'in_progress' and new.status = 'in_review')
      or (old.status = 'in_review' and new.status in ('completed', 'in_progress'))
      or (old.status = 'completed' and new.status = 'in_progress')
    ) then
      raise exception 'transição de estado de análise inválida: % -> %', old.status, new.status
        using errcode = 'HC047';
    end if;
    return new;
  end if;

  -- No status change. Under the flag any field edit is allowed (the RPCs are the
  -- authority). Outside the flag, a 'completed' RCA's header is frozen.
  if v_in_rpc then
    return new;
  end if;
  if old.status = 'completed' then
    raise exception 'uma análise concluída é imutável (reabra para editar)'
      using errcode = 'HC047';
  end if;
  return new;
end;
$$;

create trigger guard_rca_status_trg
  before update or delete on public.rca
  for each row execute function app.guard_rca_status();

-- ===========================================================================
-- app.guard_rca_child_lock — freeze ALL FIVE child tables once rca is 'completed'
-- ===========================================================================
-- BEFORE INSERT/UPDATE/DELETE on every RCA child. Keys PURELY on the parent rca
-- status (NOT app.in_safety_rpc) so even the authoring RPCs — which set the flag for
-- their own writes — CANNOT edit a completed RCA's children (mirror
-- guard_interview_child_lock). reopen_rca (-> in_progress) unlocks them again. Unlike
-- interviews (which carved out attachments for the late transcript), RCA evidence IS
-- locked too — README_rca has no post-complete evidence flow; reopen is the escape.
create function app.guard_rca_child_lock()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_rca_id uuid := case when tg_op = 'DELETE' then old.rca_id else new.rca_id end;
  v_status text;
begin
  select status into v_status from public.rca where id = v_rca_id;
  if v_status is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if v_status = 'completed' then
    raise exception 'o conteúdo desta análise está bloqueado (concluída)'
      using errcode = 'HC047';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger guard_rca_child_lock_members_trg
  before insert or update or delete on public.rca_members
  for each row execute function app.guard_rca_child_lock();

create trigger guard_rca_child_lock_timeline_trg
  before insert or update or delete on public.rca_timeline_entries
  for each row execute function app.guard_rca_child_lock();

create trigger guard_rca_child_lock_evidence_trg
  before insert or update or delete on public.rca_evidence
  for each row execute function app.guard_rca_child_lock();

create trigger guard_rca_child_lock_factors_trg
  before insert or update or delete on public.rca_factors
  for each row execute function app.guard_rca_child_lock();

create trigger guard_rca_child_lock_why_trg
  before insert or update or delete on public.rca_why_chains
  for each row execute function app.guard_rca_child_lock();

create trigger guard_rca_child_lock_roots_trg
  before insert or update or delete on public.rca_root_causes
  for each row execute function app.guard_rca_child_lock();
