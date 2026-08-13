-- =============================================================================
-- FF-4 (ADR 0092) — Power Authoring, part 4 of 5: `insert_block_from_library`.
--
-- Deep-copies a saved snapshot into a DRAFT version's section, over the SAME
-- child-table set app.copy_version_children copies (options, matrix rows +
-- columns, validations). DEFINER door, same posture as save_block_to_library.
--
-- Two things happen together, and getting the order wrong is the defect ruling
-- 3 exists to prevent:
--   1. Collision suffixing (ruling 4) — every question_key in the snapshot
--      that collides with the TARGET VERSION's existing keys is suffixed
--      deterministically (`peso` -> `peso_2` -> `peso_3`, ...), built into one
--      old->new map BEFORE any row is written.
--   2. Condition rewrite (ruling 3) — every visible_when/required_if INSIDE
--      the copied subtree is rewritten through that SAME map, via
--      app.rewrite_condition_keys (part of this migration). A block inserted
--      with `peso -> peso_2` must have its internal condition rewritten to
--      read `peso_2`, or it silently binds to whatever pre-existing item still
--      owns the literal `peso` key in the target version.
--
-- Returns `{rootItemId, renamedKeys: [{oldKey, newKey}, ...]}` as jsonb —
-- renamedKeys is ALWAYS an array, `[]` when nothing collided (BE-1 contract,
-- InsertBlockFromLibraryState.renamedKeys in src/lib/forms/actions.ts).
--
-- SQLSTATEs: reuses HC0Q7 (power_authoring off, same code as the save door)
-- and HC0P4 (not-draft, same code + same pt-BR copy as upsert_matrix_axes /
-- copy_version_children — "the same condition with the same message shares
-- the code", per the FF-3 precedent). Allocates none new.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The condition rewriter. Preserves the visible_when/required_if SHAPE (single
-- condition, or the {match, conditions:[...]} group) and rewrites ONLY the
-- question_key leaves through p_map. A key absent from the map (should never
-- happen for a subtree that passed the ruling-3 closure check at save time) is
-- left untouched rather than nulled — defensive, not a silent behavior change.
-- -----------------------------------------------------------------------------
create or replace function app.rewrite_condition_keys(p_condition jsonb, p_map jsonb)
returns jsonb
language plpgsql
immutable
set search_path to 'pg_catalog'
as $$
declare
  v_new_conditions jsonb;
begin
  if p_condition is null then
    return null;
  end if;

  if p_condition ? 'conditions' then
    select jsonb_agg(
      jsonb_set(
        c.value, '{question_key}',
        to_jsonb(coalesce(p_map ->> (c.value ->> 'question_key'), c.value ->> 'question_key'))
      )
      order by c.ord
    )
    into v_new_conditions
    from jsonb_array_elements(p_condition -> 'conditions') with ordinality as c(value, ord);

    return jsonb_set(p_condition, '{conditions}', coalesce(v_new_conditions, '[]'::jsonb));
  else
    return jsonb_set(
      p_condition, '{question_key}',
      to_jsonb(coalesce(p_map ->> (p_condition ->> 'question_key'), p_condition ->> 'question_key'))
    );
  end if;
end;
$$;

comment on function app.rewrite_condition_keys(jsonb, jsonb) is
  'FF-4 (ADR 0092 ruling 3) — rewrites the question_key leaves of a visible_when '
  '/ required_if (single OR {match,conditions[]} group shape) through an '
  'old->new key map, preserving op/value/match/order. Used by '
  'insert_block_from_library so a renamed key''s internal condition follows it.';

-- -----------------------------------------------------------------------------
-- The per-item child-row writer (options / matrix axes / validations). Called
-- AFTER the item's own form_items row exists WITH its final parent_item_id
-- already set, so app.guard_item_validation_row always resolves a real parent
-- type — this design never hits the "insert now, relink later" ordering trap
-- app.copy_version_children's comment documents, because each item here is
-- fully formed (parent included) before this runs.
-- -----------------------------------------------------------------------------
create or replace function app._insert_block_child_rows(
  p_item_id uuid,
  p_version_id uuid,
  p_snapshot_item jsonb
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  insert into public.form_item_options (
    item_id, position, code, label, color_token, score, analytics_code,
    flagged, is_other, is_exclusive, risk_weight
  )
  select
    p_item_id, (o ->> 'position')::integer, o ->> 'code', o ->> 'label',
    o ->> 'color_token', (o ->> 'score')::numeric, o ->> 'analytics_code',
    coalesce((o ->> 'flagged')::boolean, false),
    coalesce((o ->> 'is_other')::boolean, false),
    coalesce((o ->> 'is_exclusive')::boolean, false),
    (o ->> 'risk_weight')::numeric
  from jsonb_array_elements(coalesce(p_snapshot_item -> 'options', '[]'::jsonb)) o;

  insert into public.form_matrix_rows (item_id, form_version_id, position, code, label, weight)
  select p_item_id, p_version_id, (r ->> 'position')::integer, r ->> 'code', r ->> 'label',
         (r ->> 'weight')::numeric
  from jsonb_array_elements(coalesce(p_snapshot_item -> 'matrix_rows', '[]'::jsonb)) r;

  insert into public.form_matrix_columns (item_id, form_version_id, position, code, label, weight)
  select p_item_id, p_version_id, (c ->> 'position')::integer, c ->> 'code', c ->> 'label',
         (c ->> 'weight')::numeric
  from jsonb_array_elements(coalesce(p_snapshot_item -> 'matrix_columns', '[]'::jsonb)) c;

  -- FF-3 (ADR 0090): validations. The item's own row (with parent_item_id, if
  -- any) is always inserted before this function is ever called — see the
  -- caller in insert_block_from_library.
  insert into public.form_item_validations (
    item_id, form_version_id, position, rule_type, config, severity, message
  )
  select p_item_id, p_version_id, (v ->> 'position')::integer, v ->> 'rule_type',
         v -> 'config', v ->> 'severity', v ->> 'message'
  from jsonb_array_elements(coalesce(p_snapshot_item -> 'validations', '[]'::jsonb)) v;
end;
$$;

comment on function app._insert_block_child_rows(uuid, uuid, jsonb) is
  'FF-4 — writes one item''s options/matrix-axes/validations from its snapshot '
  'entry. Private helper (leading underscore): only insert_block_from_library '
  'calls it, always after the owning form_items row (parent_item_id included) '
  'already exists.';

-- -----------------------------------------------------------------------------
-- The door.
-- -----------------------------------------------------------------------------
create or replace function public.insert_block_from_library(
  p_library_entry_id uuid,
  p_section_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_entry public.form_block_library;
  v_target_version_id uuid;
  v_target_commission_id uuid;
  v_target_status text;
  v_max_position integer;
  v_next_position integer;
  v_root jsonb;
  v_child jsonb;
  v_root_item_id uuid;
  v_new_child_id uuid;
  v_map jsonb := '{}'::jsonb;
  v_used_keys text[] := array[]::text[];
  v_base text;
  v_candidate text;
  v_suffix integer;
  v_key_row record;
  v_rename_result jsonb;
begin
  if not app.feature_enabled('power_authoring') then
    raise exception 'a biblioteca de blocos não está disponível'
      using errcode = 'HC0Q7';
  end if;

  select s.form_version_id into v_target_version_id
  from public.form_sections s where s.id = p_section_id;

  if v_target_version_id is null then
    raise exception 'seção % não encontrada', p_section_id
      using errcode = 'no_data_found';
  end if;

  v_target_commission_id := app.commission_of_version(v_target_version_id);

  -- AUTHORITY FIRST (ADR 0079).
  if not (
    app.is_staff_admin_of(v_target_commission_id) or app.is_commission_admin_of(v_target_commission_id)
  ) then
    raise exception 'você não pode editar formulários nesta comissão'
      using errcode = '42501';
  end if;

  select status into v_target_status from public.form_versions where id = v_target_version_id;
  if v_target_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser editadas'
      using errcode = 'HC0P4';
  end if;

  -- Ruling 1 tenant scoping, enforced HERE (this is a DEFINER door — it reads
  -- without RLS, so "found" below means "exists AND belongs to this
  -- commission", never merely "exists somewhere"). A cross-commission id
  -- resolves as not-found, matching RLS's own no-row-leaked shape.
  select * into v_entry
  from public.form_block_library
  where id = p_library_entry_id and commission_id = v_target_commission_id;

  if v_entry.id is null then
    raise exception 'bloco % não encontrado', p_library_entry_id
      using errcode = 'no_data_found';
  end if;

  select e into v_root
  from jsonb_array_elements(v_entry.snapshot) e
  where (e ->> 'is_child')::boolean = false
  limit 1;

  -- `position` is a per-SECTION sequence shared by top-level items AND their
  -- children (unique(section_id, position), no parent_item_id scoping) —
  -- mirrors `resolveInsertPosition` in src/lib/forms/actions.ts, which reads
  -- the WHOLE section's layout rather than filtering to top-level rows. Caught
  -- by BE-4/5 smoke testing: filtering to `parent_item_id is null` here made a
  -- SECOND insert of the same block collide with the FIRST insert's children.
  select coalesce(max(position), -1) into v_max_position
  from public.form_items where section_id = p_section_id;

  -- ---------------------------------------------------------------------------
  -- Ruling 4: deterministic collision suffix against the TARGET VERSION's
  -- existing keys, root first then children in position order (stable across
  -- repeated inserts of the same block: `peso` -> `peso_2` -> `peso_3`, ...).
  -- Checked against both the live table AND keys already assigned earlier in
  -- THIS call, so two originally-distinct keys in the same snapshot can never
  -- resolve to the same target key.
  -- ---------------------------------------------------------------------------
  for v_key_row in
    select e ->> 'question_key' as qk
    from jsonb_array_elements(v_entry.snapshot) e
    where e ->> 'question_key' is not null
    order by (e ->> 'is_child')::boolean, (e ->> 'position')::integer
  loop
    v_base := v_key_row.qk;
    v_candidate := v_base;
    v_suffix := 1;
    while exists (
      select 1 from public.form_items
      where form_version_id = v_target_version_id and question_key = v_candidate
    ) or v_candidate = any (v_used_keys)
    loop
      v_suffix := v_suffix + 1;
      v_candidate := v_base || '_' || v_suffix;
    end loop;
    v_used_keys := array_append(v_used_keys, v_candidate);
    v_map := v_map || jsonb_build_object(v_base, v_candidate);
  end loop;

  -- ---- insert the root ----
  insert into public.form_items (
    section_id, position, item_type, question_key, label, question_explanation,
    config, visible_when, required, required_if, content, default_value, default_source
  ) values (
    p_section_id, v_max_position + 1, v_root ->> 'item_type',
    case when v_root ->> 'question_key' is not null
         then v_map ->> (v_root ->> 'question_key') else null end,
    v_root ->> 'label', v_root ->> 'question_explanation', v_root -> 'config',
    app.rewrite_condition_keys(v_root -> 'visible_when', v_map),
    coalesce((v_root ->> 'required')::boolean, false),
    app.rewrite_condition_keys(v_root -> 'required_if', v_map),
    v_root -> 'content', v_root -> 'default_value', v_root ->> 'default_source'
  )
  returning id into v_root_item_id;

  perform app._insert_block_child_rows(v_root_item_id, v_target_version_id, v_root);

  -- ---- children, contiguously after the root (mirrors addItem's container
  --      placement convention — ADR 0087 implementation notes) ----
  v_next_position := v_max_position + 2;
  for v_child in
    select e from jsonb_array_elements(v_entry.snapshot) e
    where (e ->> 'is_child')::boolean = true
    order by (e ->> 'position')::integer
  loop
    insert into public.form_items (
      section_id, position, item_type, question_key, label, question_explanation,
      config, visible_when, required, required_if, content, default_value,
      default_source, parent_item_id
    ) values (
      p_section_id, v_next_position, v_child ->> 'item_type',
      case when v_child ->> 'question_key' is not null
           then v_map ->> (v_child ->> 'question_key') else null end,
      v_child ->> 'label', v_child ->> 'question_explanation', v_child -> 'config',
      app.rewrite_condition_keys(v_child -> 'visible_when', v_map),
      coalesce((v_child ->> 'required')::boolean, false),
      app.rewrite_condition_keys(v_child -> 'required_if', v_map),
      v_child -> 'content', v_child -> 'default_value', v_child ->> 'default_source',
      v_root_item_id
    )
    returning id into v_new_child_id;

    perform app._insert_block_child_rows(v_new_child_id, v_target_version_id, v_child);

    v_next_position := v_next_position + 1;
  end loop;

  select coalesce(
    jsonb_agg(jsonb_build_object('oldKey', kv.key, 'newKey', kv.value) order by kv.key),
    '[]'::jsonb
  )
  into v_rename_result
  from jsonb_each_text(v_map) kv
  where kv.key <> kv.value;

  perform app.audit_write(
    'form_block_library.inserted', 'form_item', v_root_item_id, v_target_commission_id,
    'Bloco inserido a partir da biblioteca',
    jsonb_build_object(
      'library_entry_id', p_library_entry_id,
      'target_version_id', v_target_version_id,
      'renamed_count', jsonb_array_length(v_rename_result)
    )
  );

  return jsonb_build_object('rootItemId', v_root_item_id, 'renamedKeys', v_rename_result);
end;
$$;

revoke all on function public.insert_block_from_library(uuid, uuid) from public;
grant execute on function public.insert_block_from_library(uuid, uuid) to authenticated;

comment on function public.insert_block_from_library(uuid, uuid) is
  'FF-4 (ADR 0092): DEFINER door — deep-copies a library entry''s snapshot into '
  'a DRAFT version''s section, over the same child-table set as '
  'app.copy_version_children. Colliding question_keys are suffixed '
  'deterministically against the target version (ruling 4) and every internal '
  'visible_when/required_if is rewritten through the same map (ruling 3). '
  'Returns {rootItemId, renamedKeys}; renamedKeys is always an array.';
