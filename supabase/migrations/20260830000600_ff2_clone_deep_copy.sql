-- FF-2 (ADR 0089 §C / INFO-1) — the extracted deep-copy helper, and the matrix
-- half of the clone gap it closes.
--
-- THE BUG. `clone_form_version` copies sections, items, the parent-item remap
-- and `form_item_options` — and NEITHER axis table. Publishing a matrix and then
-- editing it produces a draft whose grid has silently vanished. Confirmed live
-- against the catalog, not inferred from migration text.
--
-- THE SHAPE. ADR 0089 asks for the shared deep-copy helper to be EXTRACTED
-- rather than a fifth copy block pasted in: FF-3 (validations) and FF-4 (library
-- insert) are both queued behind this extraction, and each would otherwise add
-- another place to forget.
--
-- ⚠ THE AUTHORITY TRANSFER. `clone_form_version` is INVOKER and has no explicit
-- authority check — it never needed one, because every one of its INSERTs was
-- RLS-gated (form_versions/form_sections/form_items all carry
-- `is_staff_admin_of(...) OR is_commission_admin_of(...)` FOR ALL policies).
-- Moving those INSERTs into a DEFINER helper would silently DELETE that gate:
-- a DEFINER's gate REPLACES RLS, and a policy-shaped audit is structurally blind
-- to the difference (ADR 0078). The helper must be DEFINER, because the axis
-- tables are SELECT-only for `authenticated` (K9) and no INVOKER path can write
-- them at all. So the gate is reconstructed inside, mirroring the very policy it
-- displaces — on BOTH endpoints, since the helper takes two version ids and a
-- one-sided check would let a caller copy a form they may not read into a draft
-- they may write.

create or replace function app.copy_version_children(
  p_source_version_id uuid,
  p_target_version_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_source_commission uuid;
  v_target_commission uuid;
  v_target_status text;
begin
  v_source_commission := app.commission_of_version(p_source_version_id);
  v_target_commission := app.commission_of_version(p_target_version_id);

  if v_source_commission is null or v_target_commission is null then
    raise exception 'versão de formulário não encontrada'
      using errcode = 'no_data_found';
  end if;

  -- The displaced RLS predicate, verbatim, on BOTH endpoints. Checked FIRST and
  -- before anything about either version is disclosed.
  if not (
    (app.is_staff_admin_of(v_source_commission) or app.is_commission_admin_of(v_source_commission))
    and
    (app.is_staff_admin_of(v_target_commission) or app.is_commission_admin_of(v_target_commission))
  ) then
    raise exception 'você não pode editar formulários nesta comissão'
      using errcode = '42501';
  end if;

  -- Never write into a published/archived version (Architecture Rule 5). The
  -- guard_published_structure trigger would also refuse, but only for the two
  -- tables that carry it — the axis tables do not, so this check is the one that
  -- covers all four.
  select status into v_target_status
  from public.form_versions where id = p_target_version_id;

  if v_target_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser editadas'
      using errcode = 'HC0P4';
  end if;

  create temp table _clone_section_map (old_id uuid, new_id uuid) on commit drop;
  create temp table _clone_item_map (old_id uuid, new_id uuid) on commit drop;

  -- ---- sections ----
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
    select p_target_version_id, position, title, description, is_default,
           visible_when, requires_signoff, signoff_role
    from src
    order by position
    returning id, position
  )
  insert into _clone_section_map (old_id, new_id)
  select src.id, ins.id
  from src
  join ins on ins.position = src.position;

  -- ---- items (form_version_id is derived by the form_items_sync_version
  -- trigger from section_id — do not set it here) ----
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

  -- ---- container remap (FF-1) ----
  update public.form_items c
  set parent_item_id = pm.new_id
  from public.form_items src
  join _clone_item_map im on im.old_id = src.id
  join _clone_item_map pm on pm.old_id = src.parent_item_id
  where c.id = im.new_id
    and src.parent_item_id is not null;

  -- ---- choice options ----
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

  -- ---- FF-2: matrix axes. `code` is copied VERBATIM — it is the cross-version
  -- aggregation key (ADR 0089 ruling 4), exactly as the option `code` above is,
  -- and re-minting it here would break every dashboard series across the clone
  -- boundary. `weight` rides along so a cloned risk_matrix still scores.
  -- `form_version_id` is set explicitly: these tables have no sync trigger.
  insert into public.form_matrix_rows (
    item_id, form_version_id, position, code, label, weight
  )
  select m.new_id, p_target_version_id, r.position, r.code, r.label, r.weight
  from public.form_matrix_rows r
  join _clone_item_map m on m.old_id = r.item_id;

  insert into public.form_matrix_columns (
    item_id, form_version_id, position, code, label, weight
  )
  select m.new_id, p_target_version_id, c.position, c.code, c.label, c.weight
  from public.form_matrix_columns c
  join _clone_item_map m on m.old_id = c.item_id;

  drop table _clone_section_map;
  drop table _clone_item_map;
end;
$$;

comment on function app.copy_version_children(uuid, uuid) is
  'FF-2 (ADR 0089 INFO-1): the ONE deep copy of a form version''s children — sections, items, the container remap, choice options and (new) the matrix axes. Extracted from clone_form_version so FF-3 validations and FF-4 library-insert extend one definition instead of adding a fifth copy block. DEFINER because the axis tables are SELECT-only for `authenticated` (K9); it therefore re-checks the form_*_staff_admin_write predicate itself, on BOTH endpoints.';

-- ---------------------------------------------------------------------------
-- `clone_form_version` keeps its INVOKER posture and its RLS-gated
-- `form_versions` INSERT — which is what proves the caller may create a draft on
-- this form — and delegates the children to the helper.
-- ---------------------------------------------------------------------------
create or replace function public.clone_form_version(p_source_version_id uuid)
returns uuid
language plpgsql
set search_path to 'public', 'pg_catalog'
as $function$
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

  -- RLS-gated (form_versions_staff_admin_write). This INSERT is the authority
  -- proof for the clone; the helper re-checks the same predicate for its own
  -- writes because it runs as the owner.
  insert into public.form_versions (form_id, version_number, status, created_by, behavior_config)
  values (v_form_id, v_next_number, 'draft', v_uid, v_behavior_config)
  returning id into v_new_version_id;

  perform app.copy_version_children(p_source_version_id, v_new_version_id);

  return v_new_version_id;
end;
$function$;
