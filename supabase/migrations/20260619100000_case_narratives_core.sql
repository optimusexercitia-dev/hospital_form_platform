-- Case Narratives (1 of 4): CORE schema — tables, the phase-table column adds +
-- backfill, the type-commission guard, the freeze-on-close guard, RLS, and the
-- feature flag. ADR 0032.
--
-- A Case is, on screen, an ordered stack of PHASES. Committees want a place for
-- the unstructured PROSE that frames a case — a "Resumo Clínico", "Achados e
-- Discussão", "Conclusão do Comitê" — interleaved with the phases, so a case
-- reads `Resumo Clínico -> Fase 1 -> Fase 2 -> Conclusão`. This mirrors three
-- settled patterns: a per-commission vocabulary (case_outcomes), template slots
-- (process_template_phases), and a per-case sanitized-Markdown body frozen on
-- close (case_interviews.summary_md).
--
-- The three tables mirror the OUTCOMES triad (20260614093003):
--   * case_narrative_types         — the per-commission vocabulary (mirror
--                                    case_outcomes; archived-only, NO is_active).
--   * process_template_narratives  — the per-template SLOTS, interleaved with the
--                                    phase-slots by display_position.
--   * case_narratives              — the PER-CASE snapshot + content (analogue of
--                                    case_phases): snapshot type_label + body_md.
--
-- KEY DESIGN (ADR 0032):
--   * ADDITIVE — the phase tables are untouched except a nullable display_position
--     column on each (process_template_phases + case_phases). position stays the
--     immutable phase NUMBER (referenced by blocks / recommend_when.from_phase);
--     display_position is a SEPARATE ordering across BOTH kinds.
--   * The interleave is RPC-GUARANTEED, not a cross-table unique: each table keeps
--     its own deferrable unique(parent, display_position), and the reorder RPC
--     (…100001) renumbers BOTH 1..N. The read side sorts defensively.
--   * body_md is de-identified GOVERNANCE prose (like case_events.body); it is
--     returned to the coordinator by get_case_detail but kept OUT of the audit
--     metadata (…100003). PHI posture: ADR 0032.
--
-- This migration lands the data model + guards + RLS + flag (default OFF). The
-- RPCs land in …100001 (template) / …100002 (case + the two CREATE OR REPLACEs);
-- the audit triggers in …100003; the flag flip in …100009 at completion.
--
-- New SQLSTATE (continuing after HC053, consumed/reserved by Phase 14):
--   HC054  case-narrative violation: a narrative type / template mismatch
--          (commission), a frozen-case body write, or an incomplete reorder set.

-- ===========================================================================
-- public.case_narrative_types — per-commission vocabulary (mirror case_outcomes)
-- ===========================================================================
-- (commission_id, position) is DEFERRABLE INITIALLY IMMEDIATE so the reorder swap
-- tolerates a transient duplicate (mirror reorder_case_outcomes). archive (not
-- delete) is the retire path; case_narratives snapshots type_label, so a retired
-- type never disturbs an opened case. NO colour token (library-only), NO
-- is_active — archived only, matching case_outcomes.
create table public.case_narrative_types (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions (id) on delete cascade,
  label text not null,
  description text,
  archived boolean not null default false,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_narrative_types_commission_label_key unique (commission_id, label),
  constraint case_narrative_types_commission_position_key
    unique (commission_id, position) deferrable initially immediate,
  constraint case_narrative_types_label_not_blank check (btrim(label) <> '')
);

alter table public.case_narrative_types enable row level security;
create index case_narrative_types_commission_idx
  on public.case_narrative_types (commission_id);

-- ===========================================================================
-- public.process_template_narratives — the per-template narrative SLOTS
-- ===========================================================================
-- A template slot bound to a narrative type, interleaved with the phase-slots by
-- display_position. title overrides the type label per slot (the EFFECTIVE label
-- snapshotted onto cases); instructions is optional authoring guidance;
-- is_expected is the advisory close flag (decision 7). narrative_type_id is
-- ON DELETE RESTRICT (a type referenced by a template slot cannot be deleted —
-- the vocabulary archives instead). The (template_id, display_position) unique is
-- DEFERRABLE so the cross-table reorder (…100001) tolerates transient duplicates.
-- Draft-only editing is enforced in the RPCs.
create table public.process_template_narratives (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.process_templates (id) on delete cascade,
  narrative_type_id uuid not null references public.case_narrative_types (id) on delete restrict,
  display_position integer not null,
  title text,
  instructions text,
  is_expected boolean not null default false,
  created_at timestamptz not null default now(),
  constraint process_template_narratives_position_key
    unique (template_id, display_position) deferrable initially immediate
);

alter table public.process_template_narratives enable row level security;
create index process_template_narratives_template_idx
  on public.process_template_narratives (template_id);
create index process_template_narratives_type_idx
  on public.process_template_narratives (narrative_type_id);

-- ===========================================================================
-- public.case_narratives — the PER-CASE snapshot + content (analogue case_phases)
-- ===========================================================================
-- Snapshotted at case creation from process_template_narratives ⋈
-- case_narrative_types (type_label := coalesce(slot.title, type.label) — the
-- EFFECTIVE label, frozen so later vocabulary edits never rewrite an opened
-- case). body_md is the authored de-identified sanitized-Markdown body (Rule 7),
-- frozen once the parent case is terminal (the guard below). narrative_type_id is
-- ON DELETE SET NULL — provenance only; type_label is the authority on the case.
-- The (case_id, display_position) unique is DEFERRABLE (defence; the case layout
-- is RPC-built). updated_at is bumped by the touch trigger.
create table public.case_narratives (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  narrative_type_id uuid references public.case_narrative_types (id) on delete set null,
  type_label text not null,
  display_position integer not null,
  title text,
  instructions text,
  is_expected boolean not null default false,
  body_md text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  constraint case_narratives_position_key
    unique (case_id, display_position) deferrable initially immediate,
  constraint case_narratives_type_label_not_blank check (btrim(type_label) <> '')
);

alter table public.case_narratives enable row level security;
create index case_narratives_case_idx on public.case_narratives (case_id);
create index case_narratives_type_idx on public.case_narratives (narrative_type_id);

-- ===========================================================================
-- display_position column adds — the ONLY change to the phase tables (nullable)
-- ===========================================================================
-- position stays the immutable phase NUMBER (referenced by blocks /
-- recommend_when.from_phase); display_position is a SEPARATE ordering that
-- interleaves phases with narrative-slots. Both nullable; the read layer + the
-- merge fall back to position when null (legacy rows).
alter table public.process_template_phases add column display_position integer;
alter table public.case_phases            add column display_position integer;

-- Backfill existing rows: display_position := position, so every pre-existing
-- phase keeps its current order in the merged list.
--
-- process_template_phases is UNGUARDED → a plain UPDATE is fine.
update public.process_template_phases set display_position = position
where display_position is null;

-- ⚠️ case_phases is GUARDED: app.guard_case_phase_status rejects a bare UPDATE on
-- a non-pendente phase (concluida / nao_necessaria / ativa) unless
-- app.in_case_rpc = 'on' (it raises check_violation at its final branch). Wrap the
-- backfill in the flag so terminal phases of existing cases are updated too.
do $$
begin
  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases set display_position = position
  where display_position is null;
  perform set_config('app.in_case_rpc', 'off', true);
end;
$$;

-- ===========================================================================
-- app.guard_template_narrative_type — BEFORE INSERT: type & template share a
-- commission (HC054)
-- ===========================================================================
-- Cheaper than a composite FK; clean HC054. SECURITY DEFINER so it reads both
-- parents regardless of the caller's RLS (the add RPC has already confirmed
-- staff_admin rights). Mirrors app.guard_process_template_outcome.
create function app.guard_template_narrative_type()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_template_commission uuid;
  v_type_commission uuid;
begin
  select commission_id into v_template_commission
  from public.process_templates where id = new.template_id;
  select commission_id into v_type_commission
  from public.case_narrative_types where id = new.narrative_type_id;

  if v_template_commission is null or v_type_commission is null
     or v_template_commission <> v_type_commission then
    raise exception 'este tipo de narrativa não pertence à comissão deste processo'
      using errcode = 'HC054';
  end if;

  return new;
end;
$$;

create trigger guard_template_narrative_type_trg
  before insert on public.process_template_narratives
  for each row execute function app.guard_template_narrative_type();

-- ===========================================================================
-- app.guard_case_narrative_frozen — freeze the body once the parent case is
-- terminal
-- ===========================================================================
-- BEFORE INSERT/UPDATE/DELETE on case_narratives, keyed on the PARENT case status
-- (mirror app.guard_interview_child_lock, which keys purely on the parent status,
-- NOT on the RPC flag — so even an authoring RPC cannot edit a frozen case's
-- narratives, except via the dedicated app.in_narrative_rpc window the body-save
-- RPC opens). If the case is concluido/cancelado and app.in_narrative_rpc is not
-- on → reject. The snapshot INSERTs run inside create_case_from_template while the
-- case is still 'aberto', so they pass; close_case never writes narratives, so no
-- flag plumbing into it is needed. A parent already gone (cascade delete) is a
-- no-op.
create function app.guard_case_narrative_frozen()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_narrative_rpc', true), 'off') = 'on';
  v_case_id uuid;
  v_status text;
begin
  v_case_id := case when tg_op = 'DELETE' then old.case_id else new.case_id end;
  select status into v_status from public.cases where id = v_case_id;

  -- Parent gone (cascade) or open → allow. The flag overrides the freeze for the
  -- vetted body-save RPC.
  if v_status is null or v_in_rpc then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if v_status in ('concluido', 'cancelado') then
    raise exception 'as narrativas deste caso estão bloqueadas'
      using errcode = 'HC054';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger guard_case_narrative_frozen_trg
  before insert or update or delete on public.case_narratives
  for each row execute function app.guard_case_narrative_frozen();

-- ===========================================================================
-- updated_at maintenance — reuse the interviews touch idiom
-- ===========================================================================
-- case_narrative_types + case_narratives bump updated_at on every UPDATE. (The
-- template-slots table has no updated_at — it is draft-only and replaced in place
-- like process_template_phases.)
create function app.touch_case_narrative_updated_at()
returns trigger
language plpgsql
set search_path = app, public, pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_case_narrative_types_updated_at
  before update on public.case_narrative_types
  for each row execute function app.touch_case_narrative_updated_at();
create trigger touch_case_narratives_updated_at
  before update on public.case_narratives
  for each row execute function app.touch_case_narrative_updated_at();

-- ===========================================================================
-- RLS — members read, staff_admin write (reuse existing helpers; no new helper)
-- ===========================================================================
-- Pattern per table mirrors case_outcomes / process_template_outcomes /
-- case_offered_outcomes: select using is_member_of(<commission>) or is_admin();
-- for all using/with check is_staff_admin_of(<commission>) or is_admin(). The
-- commission is resolved via the existing app.commission_of_template /
-- app.commission_of_case definer helpers.
create policy case_narrative_types_select on public.case_narrative_types
  for select to authenticated
  using (app.is_member_of(commission_id) or app.is_admin());

create policy case_narrative_types_staff_admin_write on public.case_narrative_types
  for all to authenticated
  using (app.is_staff_admin_of(commission_id) or app.is_admin())
  with check (app.is_staff_admin_of(commission_id) or app.is_admin());

create policy process_template_narratives_select on public.process_template_narratives
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_template(template_id)) or app.is_admin()
  );

create policy process_template_narratives_staff_admin_write on public.process_template_narratives
  for all to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_template(template_id)) or app.is_admin()
  )
  with check (
    app.is_staff_admin_of(app.commission_of_template(template_id)) or app.is_admin()
  );

create policy case_narratives_select on public.case_narratives
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_case(case_id)) or app.is_admin()
  );

create policy case_narratives_staff_admin_write on public.case_narratives
  for all to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_admin()
  )
  with check (
    app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_admin()
  );

-- ===========================================================================
-- Feature flag — case_narratives (default OFF)
-- ===========================================================================
-- Every Case-Narratives RPC gates app.assert_narratives_enabled() at entry, and
-- the server actions gate public.case_narratives_enabled() in the TS layer, so the
-- feature is dark until …100009 flips it ON at completion (mirroring the
-- interviews flag). Tests + the narratives seed run with the flag ON (flipped
-- in-phase).
insert into app.feature_flags (key, enabled, description) values
  ('case_narratives', false,
   'When true, the Case Narratives feature (per-commission narrative TYPES, '
   || 'per-template narrative SLOTS interleaved with phases, and per-case '
   || 'de-identified Markdown prose authored inline and frozen on case close) is '
   || 'live. Enabled at Case Narratives completion.');

create function app.assert_narratives_enabled()
returns void
language plpgsql
stable
set search_path = app, public, pg_catalog
as $$
begin
  if not app.feature_enabled('case_narratives') then
    raise exception 'o recurso de narrativas do caso não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;

revoke all on function app.assert_narratives_enabled() from public;
grant execute on function app.assert_narratives_enabled() to authenticated, service_role;

-- public.case_narratives_enabled() — TS-layer gate for the server actions. Thin
-- SECURITY DEFINER boolean read of the flag (which lives in the locked-down app
-- schema). Mirrors public.interviews_enabled.
create function public.case_narratives_enabled()
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select app.feature_enabled('case_narratives');
$$;

grant execute on function public.case_narratives_enabled() to authenticated, service_role;
revoke all on function public.case_narratives_enabled() from public, anon;
