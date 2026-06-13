-- Phase 7 / B1: Multi-Phase Cases — schema, bridge, minting + state-machine guards.
--
-- A CASE groups several form-fills (responses) into an ordered sequence of
-- PHASES, so a commission can run a multi-step evaluation (e.g. Mortality &
-- Morbidity). Each phase reuses the existing response / answer / sign-off /
-- wizard machinery UNCHANGED — a phase IS a response (bridged by a nullable
-- responses.case_phase_id). NO patient data: a case is a system-minted
-- per-commission case_number + an optional non-identifying label.
-- Full design + rationale in docs/decisions/0017-multi-phase-cases.md.
--
-- This migration (B1) lands the DATA MODEL only:
--   * process_templates / process_template_phases — the per-commission blueprint
--     (draft -> active -> archived; NO form_versions-style cloning/immutability,
--     because snapshot-at-creation means template edits never reach live cases).
--   * cases / case_phases — the AUTHORITY. case_phases carries STATUS + ASSIGNEE
--     + RECOMMENDED ONLY — NEVER answers (the Phase-7 in_progress-answers
--     invariant, ADR 0016: a coordinator reads phase status here, but another
--     member's in-progress answers reach them by NO path; the only cross-member
--     answer surface is app.case_phase_answer_map / get_case_detail, both
--     SUBMITTED-ONLY, added in B3).
--   * responses.case_phase_id bridge + reworked unique indexes.
--   * case-number minting trigger (per-commission counter).
--   * case / case-phase state-machine guard triggers (mirror
--     guard_submitted_response; gated by the app.in_case_rpc session flag set by
--     the B3 RPCs/trigger).
--   * the cases_multi_phase feature flag, default OFF (every Phase-7 RPC gates
--     it; flipped ON in a separate one-line migration at phase completion,
--     mirroring 20260613090001 for signoff_enforcement).
--
-- RPCs, the condition-evaluator REUSE (recommend_when), RLS policies, and the
-- definer board reads land in later Phase-7 migrations / the same family.
--
-- New SQLSTATEs (user-defined class), continuing the submit_response /
-- sign_section family (HC010-HC015), introduced across Phase 7:
--   HC016 invalid_template / invalid recommend_when (from_phase >= position, or
--         the referenced question_key is absent from the source published
--         version; or a removed slot is still referenced).
--   HC017 form has no published version (snapshot/ad-hoc cannot pin a version).
--   HC018 phase not sequentially activatable (an earlier phase is neither
--         concluida nor nao_necessaria).
--   HC019 phase in the wrong state for the requested operation.
--   HC020 case not open (aberto).
--   HC021 assignee is not a member of the commission.
--   HC022 caller is not the phase's assignee.
-- (HC010-HC013 are reused unchanged for the phase fill/submit path, since a
-- phase is filled/submitted via the existing save_section_answers /
-- submit_response RPCs.)

-- ===========================================================================
-- process_templates — per-commission blueprint
-- ===========================================================================
-- A plain draft -> active -> archived lifecycle. NO version machinery: editing
-- or archiving a template never touches in-flight cases (cases snapshot the
-- phases + pin form versions at creation). RLS (members read / staff_admin
-- write) is added in B4.
create table public.process_templates (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions (id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.process_templates enable row level security;
create index process_templates_commission_idx on public.process_templates (commission_id);

-- ===========================================================================
-- process_template_phases — ordered phase-slots, each bound to a whole form
-- ===========================================================================
-- recommend_when is a SUPERSET of a section's visible_when: it adds a from_phase
-- qualifier (which earlier phase's answers the condition reads). The CHECK below
-- mirrors form_sections_visible_when_shape and adds the from_phase number leg.
-- Deep validity (from_phase >= 1 and < position; the referenced question_key
-- exists as an input item in the source form's PUBLISHED version) is enforced by
-- the B2 add/update/reorder/publish RPCs and RE-validated at snapshot (B3).
--
-- The (template_id, position) unique is DEFERRABLE INITIALLY IMMEDIATE so the
-- single-statement reorder swap (mirror reorder_section, ADR 0011) tolerates the
-- transient duplicate within the statement.
create table public.process_template_phases (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.process_templates (id) on delete cascade,
  position integer not null,
  form_id uuid not null references public.forms (id),
  title text,
  recommend_when jsonb,
  created_at timestamptz not null default now(),
  constraint process_template_phases_position_key
    unique (template_id, position) deferrable initially immediate,
  constraint process_template_phases_recommend_when_shape check (
    recommend_when is null
    or (
      jsonb_typeof(recommend_when) = 'object'
      and recommend_when ? 'from_phase'
      and jsonb_typeof(recommend_when -> 'from_phase') = 'number'
      and recommend_when ? 'question_key'
      and jsonb_typeof(recommend_when -> 'question_key') = 'string'
      and recommend_when ? 'op'
      and (recommend_when ->> 'op') in ('equals', 'not_equals', 'in')
      and recommend_when ? 'value'
    )
  )
);

alter table public.process_template_phases enable row level security;
create index process_template_phases_template_idx on public.process_template_phases (template_id);
create index process_template_phases_form_idx on public.process_template_phases (form_id);

-- ===========================================================================
-- cases
-- ===========================================================================
-- case_number is a PER-COMMISSION counter (not a global sequence) so "Caso 0042"
-- is meaningful per commission and global case volume does not leak. It is set
-- by the BEFORE INSERT trigger (the insert omits it). template_id is nullable
-- and ON DELETE SET NULL: the snapshot detaches the case from its blueprint, so
-- archiving/deleting a template never affects live cases.
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions (id) on delete cascade,
  template_id uuid references public.process_templates (id) on delete set null,
  case_number integer not null,
  label text,
  status text not null default 'aberto' check (status in ('aberto', 'concluido', 'cancelado')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references public.profiles (id),
  -- Minting correctness backstop; create_case_from_template wraps the insert in
  -- a one-shot unique_violation retry (same idiom as start_or_resume_response).
  constraint cases_commission_number_key unique (commission_id, case_number)
);

alter table public.cases enable row level security;
create index cases_commission_idx on public.cases (commission_id);
create index cases_template_idx on public.cases (template_id);

-- ===========================================================================
-- case_phases — the AUTHORITY (status + assignee + recommended ONLY)
-- ===========================================================================
-- INVARIANT (Phase-7, ADR 0016): this table carries STATUS, ASSIGNEE and the
-- RECOMMENDED flag — NEVER answers. A coordinator's board reads phase status
-- from here / list_cases_board. Another member's in-progress answers reach a
-- coordinator by NO path: the responses/answers RLS is unchanged (staff_admin
-- sees SUBMITTED only), and the only cross-member answer surface is
-- app.case_phase_answer_map / get_case_detail (both SUBMITTED-ONLY, B3).
--
-- form_version_id is the PINNED snapshot of the form's published version at case
-- creation; fill/submit key off this pin, even once it is archived (so a new
-- form version never disturbs an in-flight phase). recommended is a SEPARATE
-- boolean from status: a phase can be pendente AND recommended. Status slugs are
-- ASCII (concluida, nao_necessaria); pt-BR labels live in the data layer.
create table public.case_phases (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  position integer not null,
  form_id uuid not null references public.forms (id),
  form_version_id uuid not null references public.form_versions (id),
  title text,
  status text not null default 'pendente'
    check (status in ('pendente', 'ativa', 'concluida', 'nao_necessaria')),
  recommended boolean not null default false,
  recommend_when jsonb,
  assigned_to uuid references public.profiles (id),
  is_ad_hoc boolean not null default false,
  activated_at timestamptz,
  completed_at timestamptz,
  skipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_phases_position_key unique (case_id, position),
  -- Identical shape to process_template_phases.recommend_when (copied at
  -- snapshot, with from_phase resolved to a case-phase position).
  constraint case_phases_recommend_when_shape check (
    recommend_when is null
    or (
      jsonb_typeof(recommend_when) = 'object'
      and recommend_when ? 'from_phase'
      and jsonb_typeof(recommend_when -> 'from_phase') = 'number'
      and recommend_when ? 'question_key'
      and jsonb_typeof(recommend_when -> 'question_key') = 'string'
      and recommend_when ? 'op'
      and (recommend_when ->> 'op') in ('equals', 'not_equals', 'in')
      and recommend_when ? 'value'
    )
  )
);

alter table public.case_phases enable row level security;
create index case_phases_case_idx on public.case_phases (case_id);
create index case_phases_assigned_to_idx on public.case_phases (assigned_to);

-- ===========================================================================
-- responses bridge — a phase IS a response
-- ===========================================================================
-- A nullable case_phase_id links a response to its phase. Standalone responses
-- (the existing wizard) keep case_phase_id null. The one-draft-per-user index is
-- re-scoped to standalone responses, and a new index gives exactly one response
-- per phase (across all statuses), so an assignee can hold MANY phase-drafts at
-- once (different cases/phases) yet a single phase has one response.
alter table public.responses
  add column case_phase_id uuid references public.case_phases (id);

create index responses_case_phase_idx on public.responses (case_phase_id);

-- One resumable STANDALONE draft per (version, user). Phase drafts are excluded
-- (a member may resume several phase-drafts simultaneously).
drop index public.responses_one_draft_per_user_idx;
create unique index responses_one_draft_per_user_idx
  on public.responses (form_version_id, created_by)
  where status = 'in_progress' and case_phase_id is null;

-- Exactly one response per phase (any status). The double-click race in
-- start_or_resume_phase (B3) is resolved against this index.
create unique index responses_one_per_case_phase_idx
  on public.responses (case_phase_id)
  where case_phase_id is not null;

-- ===========================================================================
-- Case-number minting — per-commission counter
-- ===========================================================================
-- BEFORE INSERT on cases. SECURITY DEFINER + pinned search_path so it can read
-- the max case_number regardless of the caller's RLS. Serialized PER COMMISSION
-- with pg_advisory_xact_lock(hashtextextended(commission_id, 0)) — parallel
-- across commissions, serial within one — and backstopped by the
-- unique(commission_id, case_number) index (create_case_from_template adds the
-- one-shot unique_violation retry on top, mirroring start_or_resume_response).
create function app.mint_case_number()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  -- Serialize concurrent inserts for the SAME commission; other commissions are
  -- unaffected (distinct advisory-lock keys).
  perform pg_advisory_xact_lock(hashtextextended(new.commission_id::text, 0));

  new.case_number := coalesce(
    (select max(case_number) from public.cases where commission_id = new.commission_id),
    0
  ) + 1;

  return new;
end;
$$;

create trigger mint_case_number_trg
  before insert on public.cases
  for each row execute function app.mint_case_number();

-- ===========================================================================
-- Case state-machine guard
-- ===========================================================================
-- Mirrors guard_submitted_response: terminal states (concluido / cancelado) are
-- frozen, and the legitimate transitions (aberto -> concluido | cancelado) run
-- only inside close_case / cancel_case, which set app.in_case_rpc = 'on' for the
-- duration. This is belt-and-suspenders alongside RLS: RLS lets a staff_admin
-- write the row, but this guard funnels every status change through the vetted
-- RPCs (just like published-version immutability funnels status through the
-- publish RPC).
create function app.guard_case_status()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'aberto' then
      raise exception 'cases in a terminal state are immutable (delete blocked)'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- A status change is only permitted inside close_case / cancel_case.
  if new.status is distinct from old.status then
    if coalesce(current_setting('app.in_case_rpc', true), 'off') <> 'on' then
      raise exception 'case status changes must go through close_case() / cancel_case()'
        using errcode = 'check_violation';
    end if;
    -- The only legal status transitions out of aberto.
    if old.status <> 'aberto'
       or new.status not in ('concluido', 'cancelado') then
      raise exception 'invalid case status transition % -> %', old.status, new.status
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- A non-status update (e.g. label) is forbidden once the case is terminal.
  if old.status <> 'aberto'
     and coalesce(current_setting('app.in_case_rpc', true), 'off') <> 'on' then
    raise exception 'cases in a terminal state are immutable (update blocked)'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger guard_case_status_trg
  before update or delete on public.cases
  for each row execute function app.guard_case_status();

-- ===========================================================================
-- Case-phase state-machine guard
-- ===========================================================================
-- Enforces the phase state machine. Every legitimate mutation happens inside a
-- B3 RPC or the submit trigger, which set app.in_case_rpc = 'on'; so any DIRECT
-- client UPDATE (even by a staff_admin RLS allows) is rejected unless it is the
-- recommended-flag toggle while still pendente. The submit trigger
-- sync_case_phase_on_submit (B3) sets app.in_case_rpc itself around its
-- ativa -> concluida flip (submit_response only sets app.in_submit_rpc, which
-- this guard does not honour).
--
-- Legal transitions (only under app.in_case_rpc):
--   pendente -> ativa            (activate_phase)
--   pendente -> nao_necessaria   (skip_phase, or close_case)
--   ativa    -> concluida        (sync_case_phase_on_submit)
--   ativa    -> nao_necessaria   (close_case, flipping a still-open phase)
-- concluida / nao_necessaria are terminal. assigned_to / activated_at /
-- recommend_when changes ride along with these flag-on transitions
-- (activate_phase, reassign_phase). The recommended flag may toggle WITHOUT the
-- session flag, but ONLY while the phase is pendente (recompute_recommendations
-- runs under the flag anyway; this leg keeps the guard from blocking a future
-- direct recompute and documents that recommended is frozen once a phase leaves
-- pendente).
create function app.guard_case_phase_status()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_case_rpc', true), 'off') = 'on';
begin
  if tg_op = 'DELETE' then
    -- Phases are only deleted via the case cascade (handled there) or while the
    -- case is being built under the flag; a direct terminal-phase delete is
    -- blocked.
    if not v_in_rpc and old.status in ('concluida', 'nao_necessaria') then
      raise exception 'terminal case phases are immutable (delete blocked)'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- Status transition.
  if new.status is distinct from old.status then
    if not v_in_rpc then
      raise exception 'case phase status changes must go through the case RPCs'
        using errcode = 'check_violation';
    end if;

    if not (
      (old.status = 'pendente' and new.status in ('ativa', 'nao_necessaria'))
      or (old.status = 'ativa' and new.status in ('concluida', 'nao_necessaria'))
    ) then
      raise exception 'invalid case phase transition % -> %', old.status, new.status
        using errcode = 'check_violation';
    end if;

    return new;
  end if;

  -- No status change. Permit the recommended-flag toggle while pendente; permit
  -- any non-status field change under the RPC flag (activate/reassign metadata);
  -- otherwise freeze a non-pendente phase.
  if v_in_rpc then
    return new;
  end if;

  if old.status = 'pendente'
     and new.recommended is distinct from old.recommended
     and new.status = old.status
     and new.assigned_to is not distinct from old.assigned_to
     and new.activated_at is not distinct from old.activated_at
     and new.completed_at is not distinct from old.completed_at
     and new.skipped_at is not distinct from old.skipped_at then
    return new;
  end if;

  raise exception 'case phase changes must go through the case RPCs'
    using errcode = 'check_violation';
end;
$$;

create trigger guard_case_phase_status_trg
  before update or delete on public.case_phases
  for each row execute function app.guard_case_phase_status();

-- ===========================================================================
-- Feature flag — cases_multi_phase (default OFF)
-- ===========================================================================
-- Every Phase-7 RPC gates app.feature_enabled('cases_multi_phase') at entry, so
-- the feature is dark until this flag is flipped ON by a separate one-line
-- migration at phase completion (mirroring 20260613090001 for
-- signoff_enforcement). Tests / the multi-phase seed run with the flag
-- temporarily ON (or seed via direct inserts).
insert into app.feature_flags (key, enabled, description) values
  ('cases_multi_phase', false,
   'When true, the multi-phase cases RPCs (template lifecycle, case creation, '
   || 'phase activation/skip/ad-hoc/reassign/fill, close/cancel, board reads) '
   || 'are live. Enabled at Phase 7 completion.');
