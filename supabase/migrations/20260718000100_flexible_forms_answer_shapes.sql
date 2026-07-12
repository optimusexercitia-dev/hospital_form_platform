-- =============================================================================
-- F3 (ADR 0060 §4 Rec A / ADR 0065 §6 freeze principle / Program §3) — Flexible-Forms
-- Foundation, part 2 of 3: the FROZEN INERT answer-shape set.
--
-- Reset-OK / pre-launch: the answer-DATA shapes the four committed field types need are
-- expensive to add post-data, so they land pre-pilot even though INERT (freeze principle,
-- ADR 0065 §6). Authored against docs/design/f3-question-key-aggregation.md (Rec A,
-- ratified). NO *_snapshot columns — aggregation resolves against the immutable published
-- version (Rule 5), never an answer-row snapshot (ADR 0060 Gap 40 stays rejected).
--
-- Five tables, two shapes:
--   * DEFINITION (version-scoped, mirror form_item_options): form_matrix_rows,
--     form_matrix_columns — carry a clone-stable hidden `code` (the aggregation identity).
--   * ANSWER (hang off answer_id -> answers, mirror answer_selected_options):
--     answer_matrix_cells, answer_risk_matrix, answer_references. FK-to-definition-row by
--     id (the option_id precedent); `on delete cascade` on answer_id means disposing a
--     case-phase answer (dispose_case_phi) auto-cleans these — no disposal edit needed.
--
-- RLS on EVERY table from creation (Rule 1). "Scoped read + write-inert": a `to
-- authenticated` SELECT policy PAIRED with a GRANT SELECT (K9 — a policy without a grant is
-- an inert boundary that denies reads), and NO write policy / NO write grant, so every
-- authenticated write fails 42501. The activating FF phase (FF-2 matrix/risk, FF-5
-- reference) adds the DEFINER writer + its published-frozen / submitted-immutability guards.
--
-- SQLSTATE high-water is HC098; this migration allocates none.
-- =============================================================================

-- =============================================================================
-- DEFINITION tables (version-scoped; clone-with-version; mirror form_item_options).
-- =============================================================================

-- form_matrix_rows — the ROW axis of a matrix / the SEVERITY axis of a risk_matrix.
create table if not exists public.form_matrix_rows (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.form_items(id) on delete cascade,
  form_version_id uuid not null references public.form_versions(id) on delete cascade,
  position integer not null,
  code text not null,                          -- hidden, clone-stable aggregation identity
  label text not null,                         -- pt-BR display (Rule 10)
  created_at timestamptz not null default now(),
  constraint form_matrix_rows_code_not_blank check (btrim(code) <> ''),
  constraint form_matrix_rows_label_not_blank check (btrim(label) <> ''),
  unique (item_id, code)
);
comment on table public.form_matrix_rows is
  'ADR 0060 (F3, RESERVED INERT). Matrix row axis / risk_matrix severity axis. Version-'
  'scoped + cloned/frozen with the version; `code` is the clone-stable aggregation identity '
  '(mirrors form_item_options.code). No writer / no published-frozen trigger this phase '
  '(write-inert). Built by FF-2.';

-- form_matrix_columns — the COLUMN axis of a matrix / the LIKELIHOOD axis of a risk_matrix.
create table if not exists public.form_matrix_columns (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.form_items(id) on delete cascade,
  form_version_id uuid not null references public.form_versions(id) on delete cascade,
  position integer not null,
  code text not null,
  label text not null,
  created_at timestamptz not null default now(),
  constraint form_matrix_columns_code_not_blank check (btrim(code) <> ''),
  constraint form_matrix_columns_label_not_blank check (btrim(label) <> ''),
  unique (item_id, code)
);
comment on table public.form_matrix_columns is
  'ADR 0060 (F3, RESERVED INERT). Matrix column axis / risk_matrix likelihood axis. Same '
  'shape/posture as form_matrix_rows. Built by FF-2.';

-- =============================================================================
-- ANSWER tables (hang off answer_id -> answers; mirror answer_selected_options).
-- =============================================================================

-- answer_matrix_cells — one row per addressed (row x col) cell. Aggregation key
-- (question_key, row_code, col_code) is resolved via the row/col FKs (Rec A §2).
create table if not exists public.answer_matrix_cells (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.answers(id) on delete cascade,
  row_id uuid not null references public.form_matrix_rows(id) on delete cascade,
  col_id uuid not null references public.form_matrix_columns(id) on delete cascade,
  value jsonb,
  created_at timestamptz not null default now(),
  unique (answer_id, row_id, col_id)
);
comment on table public.answer_matrix_cells is
  'ADR 0060 §4 Rec A (F3, RESERVED INERT). One row per matrix cell, addressed (row x col) '
  'by FK to the axis rows (the answer_selected_options.option_id precedent). The parent '
  'answers row (answer_id) carries response/item/instance + question_key. Cross-item '
  'coherence (cell row/col belong to the answer''s item) is an FF-2 writer/trigger concern '
  '(the reject_invalid_selection precedent), not enforced here. Built by FF-2.';

-- answer_risk_matrix — one row per answer: the selected (severity, likelihood) + derived
-- score. risk_score aggregates by question_key like a number answer (Rec A §3).
create table if not exists public.answer_risk_matrix (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.answers(id) on delete cascade,
  severity_row_id uuid not null references public.form_matrix_rows(id) on delete cascade,
  likelihood_col_id uuid not null references public.form_matrix_columns(id) on delete cascade,
  risk_score numeric,
  created_at timestamptz not null default now(),
  unique (answer_id)
);
comment on table public.answer_risk_matrix is
  'ADR 0060 §4 Rec A (F3, RESERVED INERT). One selection per answer: (severity_row, '
  'likelihood_col) + derived risk_score (aggregates by question_key like a number; the '
  'score derivation/weight formula is FF-2''s writer). Built by FF-2.';

-- answer_references — the A/C bridge (ADR 0065 §7): a reference item points at a
-- participant. Aggregates on participant_id, never the label (Rec A §4).
create table if not exists public.answer_references (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.answers(id) on delete cascade,
  reference_kind text not null default 'participant'
    check (reference_kind in ('participant')),
  participant_id uuid references public.participants(id) on delete restrict,
  created_at timestamptz not null default now(),
  -- kind='participant' must carry a participant_id. FF-5 widens the kind CHECK and adds
  -- internal-entity target columns (dept/committee/user), relaxing this shape then.
  constraint answer_references_participant_shape
    check (reference_kind <> 'participant' or participant_id is not null)
);
comment on table public.answer_references is
  'ADR 0060 §4 Rec A + ADR 0065 §7 (F3, RESERVED INERT). Reference-item answer bridging to '
  'the participants registry (participant_id -> participants(id); the A/C bridge). Aggregates '
  'on the stable participant_id, never the label. reference_kind reserves internal-entity '
  'lanes (dept/committee/user) for FF-5 (deferred-but-additive: FF-5 widens the kind CHECK + '
  'adds target columns). on delete restrict is a placeholder — FF-5 finalizes the delete/PHI-'
  'disposal interaction. Built by FF-5.';

-- =============================================================================
-- RLS — scoped read + write-inert on all five (Rule 1 + K9).
-- =============================================================================

alter table public.form_matrix_rows enable row level security;
alter table public.form_matrix_columns enable row level security;
alter table public.answer_matrix_cells enable row level security;
alter table public.answer_risk_matrix enable row level security;
alter table public.answer_references enable row level security;

-- Definition tables: member-read scoped via commission_of_version (mirror form_item_options).
create policy form_matrix_rows_select on public.form_matrix_rows
  for select to authenticated
  using (app.is_member_of(app.commission_of_version(form_version_id))
         or app.is_commission_admin_of(app.commission_of_version(form_version_id)));
grant select on public.form_matrix_rows to authenticated;

create policy form_matrix_columns_select on public.form_matrix_columns
  for select to authenticated
  using (app.is_member_of(app.commission_of_version(form_version_id))
         or app.is_commission_admin_of(app.commission_of_version(form_version_id)));
grant select on public.form_matrix_columns to authenticated;

-- Answer tables: resolve the response through answer_id -> answers -> responses (mirror the
-- answer_selected_options / answers read predicate: creator, org-admin, or submitted+staff_admin).
create policy answer_matrix_cells_select on public.answer_matrix_cells
  for select to authenticated
  using (exists (
    select 1
    from public.answers a
    join public.responses r on r.id = a.response_id
    where a.id = answer_matrix_cells.answer_id
      and (r.created_by = (select auth.uid())
           or app.is_commission_admin_of(r.commission_id)
           or (r.status = 'submitted' and app.is_staff_admin_of(r.commission_id)))
  ));
grant select on public.answer_matrix_cells to authenticated;

create policy answer_risk_matrix_select on public.answer_risk_matrix
  for select to authenticated
  using (exists (
    select 1
    from public.answers a
    join public.responses r on r.id = a.response_id
    where a.id = answer_risk_matrix.answer_id
      and (r.created_by = (select auth.uid())
           or app.is_commission_admin_of(r.commission_id)
           or (r.status = 'submitted' and app.is_staff_admin_of(r.commission_id)))
  ));
grant select on public.answer_risk_matrix to authenticated;

create policy answer_references_select on public.answer_references
  for select to authenticated
  using (exists (
    select 1
    from public.answers a
    join public.responses r on r.id = a.response_id
    where a.id = answer_references.answer_id
      and (r.created_by = (select auth.uid())
           or app.is_commission_admin_of(r.commission_id)
           or (r.status = 'submitted' and app.is_staff_admin_of(r.commission_id)))
  ));
grant select on public.answer_references to authenticated;
