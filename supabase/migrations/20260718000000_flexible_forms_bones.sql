-- =============================================================================
-- F3 (ADR 0060 / ADR 0065 / Pre-Pilot Foundations Program §3) — Flexible-Forms
-- Foundation, part 1 of 3: the create-now BONES.
--
-- Reset-OK / pre-launch: additive, forward-only, correct shape landed ONCE. NO
-- feature flag (structural). NO file/upload item type, NO form_items.phi_policy
-- (program §1 C-ζ). Keeps the CHECK-enum (D6/§6.3 catalog CANCELLED; ADR 0065 §5).
--
-- This migration lands:
--   1. Widen form_items.item_type CHECK (+group, repeating_group, matrix, risk_matrix,
--      reference) on BOTH constraints — the value enum AND the input-vs-display shape
--      CHECK (the D6-flip ELSE false rejects the new types until they get a shape arm).
--   2. form_item_options.is_exclusive + risk_weight (cheap columns; UX deferred to FF-2).
--   3. form_versions.behavior_config jsonb (reserved staging area; Rec F — anything
--      promoted OUT of it later earns a typed column).
--   4. response_group_instances position-uniqueness within a parent (shape only;
--      write RPCs → FF-1).
--   5. Reserve inert form_item_validations (unread until FF-3).
--   6. clone_form_version: carry behavior_config + the two new option columns forward
--      (Rule 5 — editing clones; a future writer's config must survive the clone).
--
-- SQLSTATE high-water is HC098 (F2 attachments); this migration allocates none.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · form_items.item_type — widen BOTH constraints.
-- -----------------------------------------------------------------------------
-- (a) The value-enum CHECK: add the five reserved types.
alter table public.form_items drop constraint form_items_item_type_check;
alter table public.form_items add constraint form_items_item_type_check check (
  item_type = any (array[
    -- 8 scalar input types (live)
    'multiple_choice','dropdown','checkbox','free_text','short_text','number','date','time',
    -- 2 display types (live)
    'section_text','image',
    -- 5 F3 reserved types (inert per type until its FF phase)
    'group','repeating_group','matrix','risk_matrix','reference'
  ])
);

-- (b) The input-vs-display SHAPE CHECK: the D6-flip ELSE false (20260711000300) rejects
-- any type not in an arm, so the five new types are NOT insertable until shaped here.
-- Three new arms, shaped to eventual role:
--   * matrix/risk_matrix/reference are ANSWERABLE (carry question_key + label, no content)
--     but their completeness/aggregation wiring lands with their FF phase — so force
--     required = false. This is the Flag-5 correctness invariant BY CONSTRUCTION:
--     app.response_required_complete counts `required = true AND question_key IS NOT NULL`
--     with no item-type filter, and these answers live in the new answer-shape tables (not
--     answers.value / answer_selected_options), so a `required` one would be unsatisfiable
--     -> submission deadlock. Forbidding required=true now closes it; FF-2/FF-5 relax the
--     CHECK together with the completeness path (relaxing a CHECK is the cheap direction).
--   * group/repeating_group are CONTAINERS (collect no direct answer; response_group_instances
--     keys on the container item, children carry answers). Least-restrictive arm that still
--     rejects genuine garbage: content must be NULL; question_key/label left free for
--     FF-1/FF-2. required = false for the same completeness reason (a container is never a
--     directly-answered required item; FF-1 min-items cardinality is config-driven, not this
--     boolean).
alter table public.form_items drop constraint form_items_input_vs_display;
alter table public.form_items add constraint form_items_input_vs_display check (
  case
    when item_type = any (array['multiple_choice','dropdown','checkbox','free_text',
                                'short_text','number','date','time'])
      then (question_key is not null and label is not null and content is null)
    when item_type = any (array['matrix','risk_matrix','reference'])
      then (question_key is not null and label is not null and content is null
            and required = false)
    when item_type = any (array['group','repeating_group'])
      then (content is null and required = false)
    when item_type = any (array['section_text','image'])
      then (content is not null and question_key is null and label is null
            and question_explanation is null and required = false)
    else false
  end
);

comment on constraint form_items_input_vs_display on public.form_items is
  'Shape gate per item_type. Scalar inputs (8) carry question_key+label, no content. F3 '
  'answerable-complex (matrix/risk_matrix/reference) same, PLUS required=false until their '
  'FF phase wires app.response_required_complete (Flag-5 invariant — their answers live in '
  'the F3 answer-shape tables, not answers.value). F3 containers (group/repeating_group) '
  'only require content NULL + required=false (children carry the answers). Display (2) '
  'carry content, nothing else. ELSE false rejects garbage (D6-flip).';

-- -----------------------------------------------------------------------------
-- 2 · form_item_options — cheap columns (ADR 0060 Gap 34).
-- -----------------------------------------------------------------------------
-- is_exclusive: a selected exclusive option server-clears the others (enforced by the
-- future FF-2 writer, not here). risk_weight: per-option numeric weight feeding
-- risk_matrix / calculated-field seams. Both reserved — no builder UX yet (inert columns
-- on a live table, cheap to add now, expensive after data).
alter table public.form_item_options
  add column if not exists is_exclusive boolean not null default false,
  add column if not exists risk_weight numeric;

comment on column public.form_item_options.is_exclusive is
  'ADR 0060 Gap 34 (F3, reserved). true => selecting this option clears the other '
  'selections (server-enforced by the FF-2 writer; no builder UX / reconcile handling yet).';
comment on column public.form_item_options.risk_weight is
  'ADR 0060 Gap 34 (F3, reserved). Optional per-option numeric weight for risk_matrix / '
  'calculated-field aggregation. No writer this phase.';

-- -----------------------------------------------------------------------------
-- 3 · form_versions.behavior_config — reserved staging area (ADR 0060 Gap 7 / Rec F).
-- -----------------------------------------------------------------------------
-- A STAGING bag, NOT a permanent untyped column: anything promoted out of it later earns
-- a typed column/contract (Rec F). No writer this phase.
alter table public.form_versions
  add column if not exists behavior_config jsonb;
alter table public.form_versions
  add constraint form_versions_behavior_config_shape
  check (behavior_config is null or jsonb_typeof(behavior_config) = 'object');

comment on column public.form_versions.behavior_config is
  'ADR 0060 Gap 7 (F3, reserved staging area). Per-version behavior settings bag; object '
  'or NULL. NOT a permanent untyped bag (Rec F) — promoted keys earn a typed column later. '
  'No writer this phase; clone_form_version carries it verbatim.';

-- -----------------------------------------------------------------------------
-- 4 · response_group_instances — position-uniqueness within a parent (ADR 0060 Rec C).
-- -----------------------------------------------------------------------------
-- The only cheap-now / expensive-post-data piece of the repeating-group storage (the rest
-- of the bones already exist, ADR 0045/0046). Siblings share
-- (response_id, group_item_id, parent_instance_id); position must be unique among them.
-- NULLS NOT DISTINCT (PG15+) so top-level siblings (parent_instance_id IS NULL) are also
-- constrained. Inert (no writer until FF-1), so this cannot fail on existing rows.
alter table public.response_group_instances
  add constraint response_group_instances_parent_position_uniq
  unique nulls not distinct (response_id, group_item_id, parent_instance_id, position);

comment on constraint response_group_instances_parent_position_uniq on public.response_group_instances is
  'ADR 0060 Rec C (F3, shape only). Repeating-group instance positions are unique among '
  'siblings (same response + group item + parent instance). NULLS NOT DISTINCT constrains '
  'top-level (NULL-parent) siblings too. Write RPCs (add/remove/reorder) land in FF-1.';

-- -----------------------------------------------------------------------------
-- 5 · form_item_validations — reserved inert table (ADR 0060 Gap 21; unread until FF-3).
-- -----------------------------------------------------------------------------
-- FREEZE-PRINCIPLE NOTE (ADR 0065 §6): a validation-DEFINITION table binds no historical
-- answer, so strictly it is additive-anytime. It is landed now per the explicit program
-- §3/§6 create-now list (authored WITH the freeze principle in view — a deliberate
-- reservation). rule_type is left an OPEN text (not a tight enum) so FF-3 defines the real
-- vocabulary + config shape without a wrong-shape lock-in. No writer this phase.
create table if not exists public.form_item_validations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.form_items(id) on delete cascade,
  form_version_id uuid not null references public.form_versions(id) on delete cascade,
  position integer not null default 0,
  rule_type text not null,                    -- OPEN vocabulary (FF-3 defines it)
  config jsonb,
  severity text not null default 'error'
    check (severity in ('error','warn')),     -- warn-don't-block is an FF-3 capability
  message text,                               -- pt-BR (Rule 10)
  created_at timestamptz not null default now(),
  constraint form_item_validations_rule_type_not_blank check (btrim(rule_type) <> ''),
  constraint form_item_validations_config_shape
    check (config is null or jsonb_typeof(config) = 'object')
);
comment on table public.form_item_validations is
  'ADR 0060 Gap 21 (F3, RESERVED INERT — unread until FF-3). Per-item validation rules '
  '(regex / min-max items / unique-within-group / datetime-order / required_if, etc). '
  'rule_type is intentionally an OPEN text — FF-3 pins the vocabulary + config shape. '
  'Freeze-principle note (ADR 0065 §6): binds no historical answer, so it is a deliberate '
  'reservation, not a reset-OK necessity. No writer this phase; RLS is scoped-read + '
  'write-inert (writes land with the FF-3 DEFINER writer).';

alter table public.form_item_validations enable row level security;

-- Scoped read (mirror form_item_options) + matching grant (K9: a policy without a grant is
-- an inert boundary that denies reads). NO write policy, NO write grant -> write-inert.
create policy form_item_validations_select on public.form_item_validations
  for select to authenticated
  using (app.is_member_of(app.commission_of_version(form_version_id))
         or app.is_commission_admin_of(app.commission_of_version(form_version_id)));
grant select on public.form_item_validations to authenticated;

-- -----------------------------------------------------------------------------
-- 6 · clone_form_version — carry behavior_config + the two new option columns (Rule 5).
-- -----------------------------------------------------------------------------
-- Editing a published version CLONES to a new draft (Rule 5), preserving config. The new
-- form_versions row must carry behavior_config, and cloned option rows must carry
-- is_exclusive/risk_weight, or a future writer's settings silently vanish on the first
-- edit. No-op today (both are always default/NULL), latent bug prevented. Forward-only
-- re-creation of the 20260713000800 authority with only these additions.
create or replace function public.clone_form_version(p_source_version_id uuid)
returns uuid
language plpgsql
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_form_id uuid;
  v_next_number integer;
  v_new_version_id uuid;
  v_uid uuid := auth.uid();
  v_existing_draft uuid;
  v_behavior_config jsonb;
begin
  select form_id, behavior_config into v_form_id, v_behavior_config
  from public.form_versions
  where id = p_source_version_id;

  if v_form_id is null then
    raise exception 'versão % não encontrada', p_source_version_id
      using errcode = 'no_data_found';
  end if;

  select id into v_existing_draft
  from public.form_versions
  where form_id = v_form_id and status = 'draft'
  limit 1;

  if v_existing_draft is not null then
    return v_existing_draft;
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next_number
  from public.form_versions
  where form_id = v_form_id;

  insert into public.form_versions (form_id, version_number, status, created_by, behavior_config)
  values (v_form_id, v_next_number, 'draft', v_uid, v_behavior_config)
  returning id into v_new_version_id;

  create temp table _clone_section_map (old_id uuid, new_id uuid) on commit drop;
  create temp table _clone_item_map (old_id uuid, new_id uuid) on commit drop;

  with src as (
    select id, position, title, description, is_default,
           visible_when, requires_signoff, signoff_role
    from public.form_sections
    where form_version_id = p_source_version_id
  ),
  ins as (
    insert into public.form_sections (
      form_version_id, position, title, description, is_default,
      visible_when, requires_signoff, signoff_role
    )
    select v_new_version_id, position, title, description, is_default,
           visible_when, requires_signoff, signoff_role
    from src
    order by position
    returning id, position
  )
  insert into _clone_section_map (old_id, new_id)
  select src.id, ins.id
  from src
  join ins on ins.position = src.position;

  with src as (
    select i.id, m.new_id as new_section_id, i.position, i.item_type,
           i.question_key, i.label, i.question_explanation, i.config,
           i.visible_when, i.required, i.content, i.default_value, i.parent_item_id
    from public.form_items i
    join public.form_sections s on s.id = i.section_id
    join _clone_section_map m on m.old_id = i.section_id
    where s.form_version_id = p_source_version_id
  ),
  ins as (
    insert into public.form_items (
      section_id, position, item_type,
      question_key, label, question_explanation, config, visible_when,
      required, content, default_value
    )
    select new_section_id, position, item_type,
           question_key, label, question_explanation, config, visible_when,
           required, content, default_value
    from src
    returning id, section_id, position
  )
  insert into _clone_item_map (old_id, new_id)
  select src.id, ins.id
  from src
  join ins on ins.section_id = src.new_section_id and ins.position = src.position;

  update public.form_items c
  set parent_item_id = pm.new_id
  from public.form_items src
  join _clone_item_map im on im.old_id = src.id
  join _clone_item_map pm on pm.old_id = src.parent_item_id
  where c.id = im.new_id
    and src.parent_item_id is not null;

  -- Copy option rows preserving code/label/color_token/score/analytics_code/
  -- FLAGGED/IS_OTHER/position VERBATIM, plus F3 is_exclusive/risk_weight.
  insert into public.form_item_options (
    item_id, position, code, label, color_token, score, analytics_code, flagged, is_other,
    is_exclusive, risk_weight
  )
  select m.new_id, o.position, o.code, o.label, o.color_token, o.score,
         o.analytics_code, o.flagged, o.is_other, o.is_exclusive, o.risk_weight
  from public.form_item_options o
  join _clone_item_map m on m.old_id = o.item_id;

  drop table _clone_section_map;
  drop table _clone_item_map;

  return v_new_version_id;
end;
$$;
alter function public.clone_form_version(uuid) owner to postgres;
