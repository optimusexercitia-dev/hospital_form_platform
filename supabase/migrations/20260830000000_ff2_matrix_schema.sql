-- FF-2 (ADR 0089) — matrix & risk-matrix SCHEMA shape.
--
-- One concern: the table shape + the invariants that must be true of the TABLE,
-- not merely of the writer. The writers themselves land in ...000200/...000300.
--
-- ERROR-CODE BLOCK. FF-2 owns HC0P0..HC0P9 (HC0N* is FF-1's; HC0O is skipped
-- deliberately — `O` vs `0` in a five-character SQLSTATE is a support-ticket
-- generator). Authority failures use the platform's '42501', never an HC0P code,
-- so an authority denial can never be confused with a domain precondition
-- (ADR 0079: distinct SQLSTATEs for authority vs. everything else).
--   HC0P0  axis `code` is immutable
--   HC0P1  cell/axis coherence — a row/col that does not belong to the item
--   HC0P2  matrix_fields flag is off
--   HC0P3  item not found, or not a matrix/risk_matrix item
--   HC0P4  the version is not a draft
--   HC0P5  invalid axis payload (blank/duplicate code, bad shape)
--   HC0P6  risk_matrix axis entry without a weight
--   HC0P7  unknown row/column code in an answer payload
--   HC0P8  incomplete risk_matrix answer (needs BOTH severity and likelihood)

-- ---------------------------------------------------------------------------
-- 1 · `weight` on both axis tables (ADR 0089 ruling 2).
--
-- Nullable: a plain `matrix` has no use for a weight. A `risk_matrix` requires
-- one on EVERY axis entry — a cross-row invariant, so it is not expressible as
-- a CHECK; `upsert_matrix_axes` enforces it (HC0P6).
--
-- GRANTS: all four matrix tables carry TABLE-level grants for `authenticated`
-- (verified against pg_attribute.attacl — only `case_referral` in this schema is
-- column-level), so the new column inherits SELECT and needs no explicit GRANT.
-- Do not copy this line into a `case_referral` change: there, every new column
-- needs its own GRANT or reads fail 42501.
-- ---------------------------------------------------------------------------
alter table public.form_matrix_rows    add column weight numeric;
alter table public.form_matrix_columns add column weight numeric;

comment on column public.form_matrix_rows.weight is
  'FF-2 (ADR 0089 ruling 2): risk-matrix SEVERITY weight. risk_score = severity_row.weight * likelihood_col.weight, derived server-side by the answer writer and never accepted from the client. Nullable — a plain `matrix` has none; a `risk_matrix` requires one on every row (upsert_matrix_axes, HC0P6). NOT `position`: real ONA/NBR scales are 1/3/9/27, and reordering an axis must never change what a code means. Unrelated to form_item_options.risk_weight, which belongs to the options lane.';
comment on column public.form_matrix_columns.weight is
  'FF-2 (ADR 0089 ruling 2): risk-matrix LIKELIHOOD weight. See form_matrix_rows.weight.';

-- ---------------------------------------------------------------------------
-- 2 · One column per row (ADR 0089 ruling 1).
--
-- The cell contract is a RADIO GRID: the cell row IS the selection and `value`
-- carries no payload of its own. The existing UNIQUE (answer_id, row_id, col_id)
-- is deliberately KEPT so that admitting typed cells later is a constraint DROP
-- plus a config key — no migration of the answer table, no change to the
-- aggregation contract.
-- ---------------------------------------------------------------------------
alter table public.answer_matrix_cells
  add constraint answer_matrix_cells_answer_id_row_id_key unique (answer_id, row_id);

comment on constraint answer_matrix_cells_answer_id_row_id_key on public.answer_matrix_cells is
  'FF-2 (ADR 0089 ruling 1): each matrix row takes exactly ONE column. Belt-and-braces behind the DEFINER writer — it makes the invariant true of the TABLE, which is what a later fixture, seed, or library-insert actually collides with.';

-- ---------------------------------------------------------------------------
-- 3 · Axis codes are immutable (ADR 0089 ruling 4).
--
-- Deliberately stricter than "immutable once published": the trigger does NOT
-- consult version status. A code is the cross-version aggregation key exactly as
-- `question_key` is for items; re-keying breaks the one join the dashboard
-- aggregates on, and breaks it silently and retroactively. An author who
-- mistypes deletes the entry and adds the correct one.
-- ---------------------------------------------------------------------------
create or replace function app.guard_matrix_axis_code_immutable()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
begin
  if new.code is distinct from old.code then
    raise exception 'o código de um item da matriz não pode ser alterado; remova-o e crie outro'
      using errcode = 'HC0P0';
  end if;
  return new;
end;
$$;

comment on function app.guard_matrix_axis_code_immutable() is
  'FF-2 (ADR 0089 ruling 4): refuses any UPDATE that changes form_matrix_rows.code / form_matrix_columns.code, on draft and published alike. Relabel/reorder/add/remove stay legal.';

create trigger guard_matrix_row_code_trg
  before update on public.form_matrix_rows
  for each row execute function app.guard_matrix_axis_code_immutable();

create trigger guard_matrix_column_code_trg
  before update on public.form_matrix_columns
  for each row execute function app.guard_matrix_axis_code_immutable();

-- ---------------------------------------------------------------------------
-- 4 · Cross-item coherence (ADR 0089 INFO-4).
--
-- The FKs prove a cell's row/col exist; they do NOT prove they belong to the
-- ITEM the answer is for. Without this a writer bug (or a future direct-DML
-- path) could staple item A's row onto item B's answer, and the
-- (question_key, row_code, col_code) aggregation unit would silently mix grids.
-- ---------------------------------------------------------------------------
create or replace function app.guard_matrix_cell_coherent()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_item uuid;
begin
  select a.item_id into v_item from public.answers a where a.id = new.answer_id;

  if not exists (
    select 1 from public.form_matrix_rows r where r.id = new.row_id and r.item_id = v_item
  ) then
    raise exception 'a linha da matriz não pertence a esta pergunta'
      using errcode = 'HC0P1';
  end if;

  if not exists (
    select 1 from public.form_matrix_columns c where c.id = new.col_id and c.item_id = v_item
  ) then
    raise exception 'a coluna da matriz não pertence a esta pergunta'
      using errcode = 'HC0P1';
  end if;

  return new;
end;
$$;

create or replace function app.guard_risk_matrix_coherent()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_item uuid;
begin
  select a.item_id into v_item from public.answers a where a.id = new.answer_id;

  if not exists (
    select 1 from public.form_matrix_rows r
    where r.id = new.severity_row_id and r.item_id = v_item
  ) then
    raise exception 'a linha de severidade não pertence a esta pergunta'
      using errcode = 'HC0P1';
  end if;

  if not exists (
    select 1 from public.form_matrix_columns c
    where c.id = new.likelihood_col_id and c.item_id = v_item
  ) then
    raise exception 'a coluna de probabilidade não pertence a esta pergunta'
      using errcode = 'HC0P1';
  end if;

  return new;
end;
$$;

create trigger guard_matrix_cell_coherent_trg
  before insert or update on public.answer_matrix_cells
  for each row execute function app.guard_matrix_cell_coherent();

create trigger guard_risk_matrix_coherent_trg
  before insert or update on public.answer_risk_matrix
  for each row execute function app.guard_risk_matrix_coherent();

-- ---------------------------------------------------------------------------
-- 5 · Submitted-response immutability for the two matrix ANSWER tables
--     (Architecture Rule 3).
--
-- Both hang off `answer_id` — the exact shape `app.guard_submitted_selections`
-- already resolves (answer_id -> answers.response_id -> responses.status, with
-- the `app.in_submit_rpc` escape hatch submit_response needs for its stray
-- cleanup). It is REUSED rather than copied: a fourth near-identical guard body
-- is a drift source, and this one was never selection-specific in fact.
--
-- These tables shipped write-inert in F3, so they never needed the guard before.
-- A writer landing is exactly when a table stops being covered by "nobody can
-- write it anyway".
-- ---------------------------------------------------------------------------
create trigger guard_submitted_matrix_cells_trg
  before insert or update or delete on public.answer_matrix_cells
  for each row execute function app.guard_submitted_selections();

create trigger guard_submitted_risk_matrix_trg
  before insert or update or delete on public.answer_risk_matrix
  for each row execute function app.guard_submitted_selections();

comment on function app.guard_submitted_selections() is
  'Submitted-response immutability for the answer_id-keyed answer children: answer_selected_options (form-model-normalization) and, as of FF-2, answer_matrix_cells + answer_risk_matrix. Name kept for migration-history stability; the body was never selection-specific.';

-- ---------------------------------------------------------------------------
-- 6 · `required = true` becomes legal for matrix / risk_matrix
--     (ADR 0089 ruling 3 + §D).
--
-- `reference` STAYS pinned to `required = false` until FF-5 wires its own
-- completeness arm — a type whose required-ness nothing checks is a deadlock
-- waiting to happen, which is precisely why the pin exists.
--
-- matrix/risk_matrix keep their OWN arm rather than folding into the scalar-input
-- arm, so FF-3 (validations) and FF-5 can add matrix-specific column rules
-- without touching the eight-type arm.
--
-- ⚠ The constraint this relaxes was PINNED by supabase/tests/209_flexible_forms.sql
-- §B1 ("required=true matrix rejected"). That assertion is rewritten in the same
-- change — dropping a constraint without grepping for the test that defended it
-- is how a green bar turns into a false negative.
-- ---------------------------------------------------------------------------
alter table public.form_items drop constraint form_items_input_vs_display;

alter table public.form_items add constraint form_items_input_vs_display check (
  case
    when item_type = any (array[
      'multiple_choice', 'dropdown', 'checkbox', 'free_text',
      'short_text', 'number', 'date', 'time'
    ]) then (question_key is not null and label is not null and content is null)

    -- FF-2: answerable, and now legitimately requirable (row-complete for
    -- `matrix`; the single answer row for `risk_matrix`).
    when item_type = any (array['matrix', 'risk_matrix'])
      then (question_key is not null and label is not null and content is null)

    -- FF-5 will relax this arm the same way, once answer_references has a
    -- completeness arm and an instance_is_empty arm of its own.
    when item_type = 'reference'
      then (question_key is not null and label is not null and content is null
            and required = false)

    when item_type = any (array['group', 'repeating_group'])
      then (content is null and required = false and question_key is null
            and label is not null and default_value is null)

    when item_type = any (array['section_text', 'image'])
      then (content is not null and question_key is null and label is null
            and question_explanation is null and required = false)

    else false
  end
);
