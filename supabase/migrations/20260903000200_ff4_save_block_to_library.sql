-- =============================================================================
-- FF-4 (ADR 0092) — Power Authoring, part 3 of 5: `save_block_to_library`.
--
-- DEFINER door (ruling 7): it enforces the ruling-1 write perimeter and the
-- ruling-3 CLOSURE CHECK itself, since form_block_library is K9 and RLS gives
-- `authenticated` no write path at all.
--
-- `p_item_id` must be a TOP-LEVEL item (ruling 8: a single input item, or one
-- container with its children — never a child of a container). The source may
-- be ANY version status of the caller's commission (draft, published, or
-- archived) — there is no "source must be a draft" rule, unlike the target of
-- `insert_block_from_library`.
--
-- RULING 3 — closure. `visible_when` / `required_if` are written over
-- `question_key`s. A condition inside the subtree that references a key
-- OUTSIDE it is refused (HC0Q6), naming every offending (referenced,
-- out-of-subtree) key via the exception DETAIL — a comma-joined list, since
-- the TS contract's `offendingKeys: string[]` needs to name them individually
-- in pt-BR, not just re-display one sentence (BE-1, `src/lib/forms/actions.ts`
-- SaveBlockToLibraryState.offendingKeys).
--
-- SQLSTATEs allocated: HC0Q6 (closure violation, PINNED by ADR ruling 3),
-- HC0Q7 (power_authoring off), HC0Q8 (empty name / item is not a valid root).
-- High-water was HC0Q5.
-- =============================================================================

create or replace function public.save_block_to_library(
  p_item_id uuid,
  p_name text,
  p_description text default null
)
returns public.form_block_library
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_version_id uuid;
  v_parent_item_id uuid;
  v_commission_id uuid;
  v_form_title text;
  v_version_number integer;
  v_actor uuid := (select auth.uid());
  v_actor_name text;
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_snapshot jsonb;
  v_keys text[];
  v_offending text[];
  v_result public.form_block_library;
begin
  if not app.feature_enabled('power_authoring') then
    raise exception 'a biblioteca de blocos não está disponível'
      using errcode = 'HC0Q7';
  end if;

  if v_name = '' then
    raise exception 'informe um nome para o bloco'
      using errcode = 'HC0Q8';
  end if;

  select i.form_version_id, i.parent_item_id
    into v_version_id, v_parent_item_id
  from public.form_items i
  where i.id = p_item_id;

  if v_version_id is null then
    raise exception 'pergunta % não encontrada', p_item_id
      using errcode = 'no_data_found';
  end if;

  -- Ruling 8: the unit is a TOP-LEVEL item. A child of a container is not "one
  -- item subtree" in ruling 8's sense — its container is.
  if v_parent_item_id is not null then
    raise exception 'apenas um item de nível superior pode ser salvo na biblioteca'
      using errcode = 'HC0Q8';
  end if;

  v_commission_id := app.commission_of_version(v_version_id);

  -- AUTHORITY FIRST (ADR 0079): a DEFINER's gate replaces RLS for its callers,
  -- so this must be checked before anything below discloses the item's shape.
  if not (
    app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)
  ) then
    raise exception 'você não pode editar formulários nesta comissão'
      using errcode = '42501';
  end if;

  select f.title, v.version_number into v_form_title, v_version_number
  from public.form_versions v
  join public.forms f on f.id = v.form_id
  where v.id = v_version_id;

  select coalesce(p.full_name, '') into v_actor_name
  from public.profiles p where p.id = v_actor;

  -- ---------------------------------------------------------------------------
  -- Materialize the subtree: a flat jsonb array, root first (is_child=false),
  -- then children in position order (is_child=true). Every child-table shape
  -- app.copy_version_children copies rides inline per entry — options, matrix
  -- axes, validations — so the array is self-contained (library_insert_deep_copy
  -- pins this against the SAME child-table set, derived from the catalog).
  -- ---------------------------------------------------------------------------
  -- jsonb_strip_nulls is LOAD-BEARING, not cosmetic: jsonb_build_object encodes
  -- a SQL NULL field as the jsonb value `null` (a real, non-SQL-NULL member of
  -- the jsonb type) — round-tripped back out with `->` in
  -- insert_block_from_library, that reads as "this item HAS a required_if /
  -- default_value / etc of literal JSON null", which then fails the very
  -- `xxx IS NULL` CHECKs (form_items_input_vs_display, the ruling-6 XOR) that
  -- a genuinely-null column always satisfied. Stripping null-valued keys here
  -- makes them ABSENT instead, and `->` on an absent key returns true SQL
  -- NULL, restoring the round-trip. Caught by insert_block_from_library
  -- raising 23514 on a plain repeating_group child during BE-4/5 smoke testing.
  select jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'position', x.position, 'is_child', x.is_child, 'item_type', x.item_type,
      'question_key', x.question_key, 'label', x.label,
      'question_explanation', x.question_explanation,
      'config', x.config, 'visible_when', x.visible_when,
      'required', x.required, 'required_if', x.required_if,
      'content', x.content, 'default_value', x.default_value,
      'default_source', x.default_source,
      'options', x.options, 'matrix_rows', x.matrix_rows,
      'matrix_columns', x.matrix_columns, 'validations', x.validations
    ))
    order by x.is_child, x.position
  )
  into v_snapshot
  from (
    select
      i.id, i.position, (i.id <> p_item_id) as is_child, i.item_type,
      i.question_key, i.label, i.question_explanation, i.config,
      i.visible_when, i.required, i.required_if, i.content, i.default_value,
      i.default_source,
      (select jsonb_agg(jsonb_build_object(
         'position', o.position, 'code', o.code, 'label', o.label,
         'color_token', o.color_token, 'score', o.score,
         'analytics_code', o.analytics_code, 'flagged', o.flagged,
         'is_other', o.is_other, 'is_exclusive', o.is_exclusive,
         'risk_weight', o.risk_weight
       ) order by o.position)
       from public.form_item_options o where o.item_id = i.id) as options,
      (select jsonb_agg(jsonb_build_object(
         'position', r.position, 'code', r.code, 'label', r.label, 'weight', r.weight
       ) order by r.position)
       from public.form_matrix_rows r where r.item_id = i.id) as matrix_rows,
      (select jsonb_agg(jsonb_build_object(
         'position', c.position, 'code', c.code, 'label', c.label, 'weight', c.weight
       ) order by c.position)
       from public.form_matrix_columns c where c.item_id = i.id) as matrix_columns,
      (select jsonb_agg(jsonb_build_object(
         'position', vv.position, 'rule_type', vv.rule_type, 'config', vv.config,
         'severity', vv.severity, 'message', vv.message
       ) order by vv.position)
       from public.form_item_validations vv where vv.item_id = i.id) as validations
    from public.form_items i
    where i.id = p_item_id or i.parent_item_id = p_item_id
  ) x;

  -- ---------------------------------------------------------------------------
  -- Ruling 3: closure check. Every question_key the subtree ITSELF carries
  -- (root + children); every question_key referenced by a visible_when /
  -- required_if ANYWHERE in the subtree (app.visibility_conditions normalizes
  -- both the single-condition and the {match,conditions[]} group shape, so
  -- this covers both without re-deriving the shape here). Any referenced key
  -- absent from the subtree's own key set is offending.
  -- ---------------------------------------------------------------------------
  select array_agg(distinct qk.question_key) into v_keys
  from public.form_items qk
  where (qk.id = p_item_id or qk.parent_item_id = p_item_id)
    and qk.question_key is not null;

  select array_agg(distinct refs.ref) into v_offending
  from (
    select (c ->> 'question_key') as ref
    from public.form_items i,
         lateral app.visibility_conditions(i.visible_when) c
    where i.id = p_item_id or i.parent_item_id = p_item_id
    union
    select (c ->> 'question_key') as ref
    from public.form_items i,
         lateral app.visibility_conditions(i.required_if) c
    where i.id = p_item_id or i.parent_item_id = p_item_id
  ) refs
  where refs.ref is not null
    and not (refs.ref = any (coalesce(v_keys, array[]::text[])));

  if v_offending is not null and array_length(v_offending, 1) > 0 then
    raise exception
      'este bloco tem condições que dependem de perguntas fora dele: %',
      array_to_string(v_offending, ', ')
      using errcode = 'HC0Q6', detail = array_to_string(v_offending, ',');
  end if;

  insert into public.form_block_library (
    commission_id, name, description, snapshot,
    saved_by_id, saved_by_name, source_form_title, source_version_number
  ) values (
    v_commission_id, v_name, v_description, coalesce(v_snapshot, '[]'::jsonb),
    v_actor, v_actor_name, v_form_title, v_version_number
  )
  returning * into v_result;

  -- Rule 11: counts + provenance metadata only. The snapshot itself (author
  -- free text, labels, condition shapes) never enters the un-erasable chain.
  perform app.audit_write(
    'form_block_library.saved', 'form_block_library', v_result.id, v_commission_id,
    'Bloco salvo na biblioteca',
    jsonb_build_object(
      'item_count', jsonb_array_length(coalesce(v_snapshot, '[]'::jsonb)),
      'source_item_id', p_item_id,
      'source_version_id', v_version_id
    )
  );

  return v_result;
end;
$$;

revoke all on function public.save_block_to_library(uuid, text, text) from public;
grant execute on function public.save_block_to_library(uuid, text, text) to authenticated;

comment on function public.save_block_to_library(uuid, text, text) is
  'FF-4 (ADR 0092): DEFINER door — snapshots one item subtree (ruling 8) into '
  'the caller''s commission block library. Enforces the ruling-1 write '
  'perimeter and the ruling-3 closure check (HC0Q6, naming offending keys via '
  'the exception DETAIL) itself, since form_block_library is K9 (SELECT-only '
  'for authenticated).';
