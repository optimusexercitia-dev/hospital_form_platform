-- Phase 14b / B1: Patient-Safety / NSP — TRIAGE schema. ADR 0030 umbrella; the 14b
-- backend decision recorded in ADR 0032 (this sub-phase). Builds on 14a's event +
-- isolated PHI + custody ledger (migrations …121000–121005).
--
-- The triage worksheet is the platform's front door: a committee reports an event to
-- the NSP (14a), which TRIAGES it through the Joint Commission patient-safety-event
-- framework (docs/design/README_triage.md) to a disposition — culminating in whether
-- a Root Cause Analysis (RCA) is mandated. This migration lands:
--   * public.pqs_event_types — CONFIGURABLE event-type vocab (NSP/WHO defaults seeded
--     in …121103). 14a's patient_safety_event.event_type_id was a deferred-nullable
--     hook with NO FK; we WIRE it to this table here (on delete set null — an archived
--     type must never orphan an event).
--   * public.pqs_sentinel_criteria — the CONFIGURABLE always-review checklist (JC
--     "designated categories"; defaults seeded in …121103). Selecting any active
--     criterion on a worksheet auto-qualifies the event as sentinel regardless of harm.
--   * public.event_triage — the 1:1 triage worksheet (PK = event_id). Reach (5) +
--     harm (6) are FIXED CHECK enums (JC / NCC-MERP); only the sentinel checklist +
--     event types are configurable.
--   * public.event_triage_sentinel_flags — the permanent record of WHICH designated
--     criteria were flagged, SNAPSHOTTING the criterion key+label at flag time so the
--     record stays "viewable forever" even if the vocab is later renamed/archived.
--   * public.rca — a minimal FORWARD-SAFE shell (1:1 with the event via unique
--     event_id) created by confirm_triage when pathway = rca. 14c EXTENDS this table
--     (problem fields, members, freeze guard, can_write_rca) — its ALTERs must tolerate
--     pre-existing shell rows (add columns nullable / with defaults, never bare NOT
--     NULL). The shell carries only what confirm_triage needs + 14c is guaranteed to
--     keep: id, event_id, status, due_date, created_by/at.
--
-- The freeze guard (app.guard_event_triage) + the RLS land in B2 (…121101); the RPCs
-- + audit triggers in B3 (…121102); the vocab/triage seed in B4 (…121103). No flag
-- flip — patient_safety is already ON (14a's umbrella flag covers 14a–14d).
--
-- New SQLSTATEs (ADR 0030 reserves HC043–HC053 for Phase 14; 14b takes the next two):
--   HC045 triage in the wrong state / frozen worksheet (raised by the guard + RPCs).
--   HC046 invalid disposition (reach/harm/pathway/pse inconsistency; raised by RPCs).

-- ===========================================================================
-- public.pqs_event_types — CONFIGURABLE event-type vocabulary (non-PHI)
-- ===========================================================================
-- Reporter-supplied at intake, refined by the NSP at triage. `key` is a stable ASCII
-- slug (unique); `label` is the pt-BR display. Reorderable via a DEFERRABLE unique
-- position (mirror the meeting-type / case-tag vocab tables). Archived (is_active =
-- false), never hard-deleted (events reference it).
create table public.pqs_event_types (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  label text not null,
  description text,
  position integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pqs_event_types_key_not_blank check (btrim(key) <> ''),
  constraint pqs_event_types_label_not_blank check (btrim(label) <> ''),
  constraint pqs_event_types_key_key unique (key),
  constraint pqs_event_types_position_key unique (position) deferrable initially immediate
);

alter table public.pqs_event_types enable row level security;

comment on table public.pqs_event_types is
  'Configurable event-type vocabulary (Phase 14b). Non-PHI; any-authenticated READ, '
  'is_pqs_member-gated CRUD. FK target of patient_safety_event.event_type_id.';

-- WIRE 14a's deferred-nullable hook to the vocab table (on delete set null so an
-- archived/removed type never orphans an event — though archive, not delete, is the
-- norm). 14a left event_type_id a plain nullable uuid with no FK precisely for this.
alter table public.patient_safety_event
  add constraint patient_safety_event_event_type_fk
  foreign key (event_type_id) references public.pqs_event_types (id) on delete set null;

-- ===========================================================================
-- public.pqs_sentinel_criteria — CONFIGURABLE always-review checklist (non-PHI)
-- ===========================================================================
-- The JC "designated categories" (README_triage §1.4) seeded as defaults; the NSP may
-- add/rename/archive. Selecting any ACTIVE criterion on a worksheet auto-qualifies the
-- event as sentinel regardless of harm tier (the designated-category path).
create table public.pqs_sentinel_criteria (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  label text not null,
  description text,
  position integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pqs_sentinel_criteria_key_not_blank check (btrim(key) <> ''),
  constraint pqs_sentinel_criteria_label_not_blank check (btrim(label) <> ''),
  constraint pqs_sentinel_criteria_key_key unique (key),
  constraint pqs_sentinel_criteria_position_key unique (position) deferrable initially immediate
);

alter table public.pqs_sentinel_criteria enable row level security;

comment on table public.pqs_sentinel_criteria is
  'Configurable always-review sentinel checklist (Phase 14b; JC designated categories). '
  'Any active criterion flagged on a worksheet auto-qualifies the event as sentinel.';

-- ===========================================================================
-- public.event_triage — the 1:1 triage worksheet (PK = event_id)
-- ===========================================================================
-- One worksheet per event. Reach (5 levels) + harm (6 tiers) are FIXED CHECK enums
-- (JC / NCC-MERP — NOT configurable). sentinel_determination is AUTO-computed by the
-- RPCs (app.compute_sentinel_determination) — the general-criteria path
-- (reached + severe + natural_course = false) OR any designated-category flag.
-- disposition_notes_md is SANITIZED Markdown (Rule 7); clinical free text — NEVER
-- copied into the audit log (Rule 11).
create table public.event_triage (
  event_id uuid primary key references public.patient_safety_event (id) on delete cascade,
  -- Step 1 gate: is this a patient-safety event?
  is_pse boolean,
  -- The closure reason when is_pse = false (README_triage §1.5).
  pse_closure_reason text
    check (pse_closure_reason in ('natural', 'expected', 'nonclinical', 'duplicate')),
  -- Step 2: the FIXED reach-and-harm spectrum (README_triage §1.2).
  reach text
    check (reach in ('unsafe', 'near_miss', 'no_harm', 'adverse', 'sentinel')),
  -- Step 3: the FIXED NCC-MERP / JC harm scale (README_triage §1.3).
  harm_severity text
    check (harm_severity in ('none', 'mild', 'moderate', 'severe', 'permanent', 'death')),
  -- Step 4: related to the natural course of illness? (one of the three general
  -- sentinel criteria — the checkmark lights only when "unrelated", i.e. = false).
  natural_course boolean,
  -- Auto-computed (general-criteria OR designated-category path); never null.
  sentinel_determination boolean not null default false,
  -- The disposition pathway (forced 'rca' when sentinel; chosen freely otherwise).
  review_pathway text
    check (review_pathway in ('rca', 'peer_review', 'mm', 'fmea', 'tracking_only')),
  -- Sanitized Markdown (Rule 7); clinical free text — NEVER audited as a body.
  disposition_notes_md text,
  triaged_by uuid references public.profiles (id),
  triaged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A non-PSE worksheet must name the closure reason and carry no spectrum/harm; a
  -- PSE worksheet must NOT carry a closure reason. (reach/harm may still be null
  -- mid-flow on a PSE worksheet; the RPCs enforce completeness at confirm via HC046.)
  constraint event_triage_pse_shape check (
    is_pse is null
    or (is_pse = false and pse_closure_reason is not null and reach is null and harm_severity is null)
    or (is_pse = true and pse_closure_reason is null)
  )
);

alter table public.event_triage enable row level security;

comment on table public.event_triage is
  'The 1:1 triage worksheet (Phase 14b). PHI-FREE governance metadata. Reach/harm are '
  'FIXED CHECK enums; sentinel_determination is auto-computed. Frozen once the parent '
  'event reaches "triaged" (app.guard_event_triage). disposition_notes_md is clinical '
  'free text — NEVER copied into the audit log (Rule 11).';
comment on column public.event_triage.disposition_notes_md is
  'Disposition notes — SANITIZED Markdown (Rule 7). Clinical free text; NEVER audited.';

-- ===========================================================================
-- public.event_triage_sentinel_flags — the permanent designated-criteria record
-- ===========================================================================
-- WHICH designated criteria were flagged on the worksheet. SNAPSHOTS the criterion
-- key + label at flag time so the permanent record survives a later vocab rename /
-- archive (the "viewable-forever" requirement). FK to the live criterion is RESTRICT-
-- free via the snapshot: we keep criteria_id (on delete set null) for provenance but
-- never depend on it for display.
create table public.event_triage_sentinel_flags (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_triage (event_id) on delete cascade,
  criteria_id uuid references public.pqs_sentinel_criteria (id) on delete set null,
  -- Snapshot (viewable-forever): the criterion as it was when flagged.
  criteria_key text not null,
  criteria_label text not null,
  created_at timestamptz not null default now(),
  constraint event_triage_sentinel_flags_event_criteria_key unique (event_id, criteria_id)
);

alter table public.event_triage_sentinel_flags enable row level security;

create index event_triage_sentinel_flags_event_idx
  on public.event_triage_sentinel_flags (event_id);

comment on table public.event_triage_sentinel_flags is
  'The permanent record of which designated sentinel criteria were flagged on a '
  'worksheet (Phase 14b). criteria_key/label are SNAPSHOTTED at flag time so the '
  'record stays viewable-forever across vocab edits.';

-- ===========================================================================
-- public.rca — the minimal FORWARD-SAFE shell (1:1 with the event; pathway = rca)
-- ===========================================================================
-- Created by confirm_triage when the resolved pathway is 'rca' (ADR 0030/0032). This
-- is a SEAM: 14c extends it (problem statement, members, timeline, fishbone, freeze).
-- 14c's ALTER TABLE must tolerate these pre-existing shell rows — add columns nullable
-- or with defaults, NEVER a bare NOT NULL. The shell holds only what confirm_triage
-- needs + 14c is guaranteed to keep. unique(event_id) enforces the 1:1.
create table public.rca (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.patient_safety_event (id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'in_progress', 'in_review', 'completed')),
  due_date date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rca_event_key unique (event_id)
);

alter table public.rca enable row level security;

create index rca_event_idx on public.rca (event_id);

comment on table public.rca is
  'FORWARD-SAFE RCA shell (Phase 14b seam; ADR 0032). Created by confirm_triage when '
  'pathway = rca, with the configurable 45-day due_date. Phase 14c EXTENDS this table '
  '(its ALTERs must tolerate pre-existing rows: nullable/defaulted columns only).';
