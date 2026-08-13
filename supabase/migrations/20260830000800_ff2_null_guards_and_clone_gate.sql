-- FF-2 — two Wave-1 defects, both found by the Wave-2 keystones + the existing
-- pgTAP suite. Forward-only: the ...000200/...000300/...000600 migrations are
-- applied and are never edited.
--
-- ============================================================================
-- DEFECT 1 — the SQL-NULL trap in three "reject a missing key" guards.
--
--   `x -> 'weight'` on an object with NO `weight` key yields SQL NULL, and
--   `jsonb_typeof(NULL)` is NULL — so `jsonb_typeof(x -> 'weight') <> 'number'`
--   evaluates to NULL, not TRUE, the EXISTS finds nothing, and the guard never
--   fires. It rejected a weight of the WRONG TYPE and waved through a weight
--   that was ABSENT — precisely the case it was written for.
--
--   Caught by keystone A13 ("caught: no exception") and E5. The blast radius was
--   larger than the missed error: `upsert_matrix_axes` then went on to REPLACE
--   the risk axes with the weightless payload, which made publish fail HC0P6,
--   `risk_score` come back NULL, and a later axis code vanish — six further
--   keystones red from one root cause. A guard that fails OPEN corrupts; this
--   one did, on a draft.
--
--   Fixed with `coalesce(jsonb_typeof(...), 'missing')`, which collapses the
--   absent and wrong-type cases into the same rejection.
--
-- ============================================================================
-- DEFECT 2 — `app.copy_version_children`'s gate was STRICTER than the RLS it
-- displaced, and broke three existing pgTAP files.
--
--   `clone_form_version` was INVOKER: as `postgres` (or `service_role`) RLS is
--   bypassed, so the clone worked with no JWT — which is how 61_answer_model_v2,
--   203_others_and_length and 209_flexible_forms have always driven it. Moving
--   the children into a DEFINER helper with an UNCONDITIONAL
--   `is_staff_admin_of(...)` check made a no-JWT caller fail 42501
--   ("você não pode editar formulários nesta comissão"), a behaviour change I
--   did not intend and no Wave-1 proof covered, because every Wave-1 probe ran
--   under a JWT.
--
--   The rule the helper must satisfy is "no weaker AND no stronger than the RLS
--   it replaces". RLS applies to end users, not to the owner/service role. So
--   the check is scoped to callers that HAVE an authenticated identity. This is
--   not a hole: `app` is not a PostgREST-exposed schema (config.toml exposes
--   `public` + `graphql_public`), and the public entry point
--   `clone_form_version` is still INVOKER, so its `form_versions` INSERT is
--   RLS-gated and an anonymous caller is refused there before ever reaching
--   this helper. Keystone H5/H6 assert BOTH arms.

-- ---------------------------------------------------------------------------
-- 1a · upsert_matrix_axes — the risk-weight guard.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_matrix_axes(
  p_item_id uuid,
  p_rows jsonb,
  p_columns jsonb
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_version_id uuid;
  v_item_type text;
  v_status text;
  v_commission uuid;
begin
  if not app.feature_enabled('matrix_fields') then
    raise exception 'o recurso de matrizes não está disponível'
      using errcode = 'HC0P2';
  end if;

  select i.form_version_id, i.item_type into v_version_id, v_item_type
  from public.form_items i
  where i.id = p_item_id;

  if v_version_id is null then
    raise exception 'pergunta % não encontrada', p_item_id
      using errcode = 'HC0P3';
  end if;

  v_commission := app.commission_of_version(v_version_id);

  -- AUTHORITY FIRST — '42501', never an HC0P code (ADR 0079).
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'você não pode editar formulários nesta comissão'
      using errcode = '42501';
  end if;

  if v_item_type not in ('matrix', 'risk_matrix') then
    raise exception 'esta pergunta não é uma matriz'
      using errcode = 'HC0P3';
  end if;

  select status into v_status from public.form_versions where id = v_version_id;
  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser editadas'
      using errcode = 'HC0P4';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array'
     or p_columns is null or jsonb_typeof(p_columns) <> 'array' then
    raise exception 'lista de linhas/colunas da matriz inválida'
      using errcode = 'HC0P5';
  end if;

  -- Per-entry shape. `coalesce(jsonb_typeof(...), 'missing')` throughout: a key
  -- that is ABSENT must be rejected by the same branch as a key of the wrong
  -- type (defect 1). The `weight` clause keeps its `?` guard because weight is
  -- OPTIONAL here — only a risk_matrix requires it, checked separately below.
  if exists (
    select 1
    from (
      select value as e from jsonb_array_elements(p_rows)
      union all
      select value from jsonb_array_elements(p_columns)
    ) x
    where jsonb_typeof(x.e) <> 'object'
       or coalesce(jsonb_typeof(x.e -> 'code'), 'missing') <> 'string'
       or btrim(coalesce(x.e ->> 'code', '')) = ''
       or coalesce(jsonb_typeof(x.e -> 'label'), 'missing') <> 'string'
       or btrim(coalesce(x.e ->> 'label', '')) = ''
       or coalesce(jsonb_typeof(x.e -> 'position'), 'missing') <> 'number'
       or ((x.e ? 'weight') and jsonb_typeof(x.e -> 'weight') not in ('number', 'null'))
  ) then
    raise exception 'lista de linhas/colunas da matriz inválida'
      using errcode = 'HC0P5';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_rows) e
    group by btrim(e.value ->> 'code') having count(*) > 1
  ) or exists (
    select 1 from jsonb_array_elements(p_columns) e
    group by btrim(e.value ->> 'code') having count(*) > 1
  ) or exists (
    select 1 from jsonb_array_elements(p_rows) e
    group by (e.value ->> 'position') having count(*) > 1
  ) or exists (
    select 1 from jsonb_array_elements(p_columns) e
    group by (e.value ->> 'position') having count(*) > 1
  ) then
    raise exception 'há linhas ou colunas duplicadas na matriz'
      using errcode = 'HC0P5';
  end if;

  -- DEFECT 1, the case that actually escaped: an entry with NO `weight` key at
  -- all. Was `jsonb_typeof(x.e -> 'weight') <> 'number'` -> NULL -> no match.
  if v_item_type = 'risk_matrix' and exists (
    select 1
    from (
      select value as e from jsonb_array_elements(p_rows)
      union all
      select value from jsonb_array_elements(p_columns)
    ) x
    where coalesce(jsonb_typeof(x.e -> 'weight'), 'missing') <> 'number'
  ) then
    raise exception 'a matriz de risco exige um peso em todas as linhas e colunas'
      using errcode = 'HC0P6';
  end if;

  delete from public.form_matrix_rows r
  where r.item_id = p_item_id
    and not exists (
      select 1 from app.matrix_axis_entries(p_rows) a where a.axis_code = r.code
    );

  update public.form_matrix_rows r
  set label = a.axis_label, position = a.axis_position, weight = a.axis_weight
  from app.matrix_axis_entries(p_rows) a
  where r.item_id = p_item_id and r.code = a.axis_code;

  insert into public.form_matrix_rows (item_id, form_version_id, position, code, label, weight)
  select p_item_id, v_version_id, a.axis_position, a.axis_code, a.axis_label, a.axis_weight
  from app.matrix_axis_entries(p_rows) a
  where not exists (
    select 1 from public.form_matrix_rows r
    where r.item_id = p_item_id and r.code = a.axis_code
  );

  delete from public.form_matrix_columns c
  where c.item_id = p_item_id
    and not exists (
      select 1 from app.matrix_axis_entries(p_columns) a where a.axis_code = c.code
    );

  update public.form_matrix_columns c
  set label = a.axis_label, position = a.axis_position, weight = a.axis_weight
  from app.matrix_axis_entries(p_columns) a
  where c.item_id = p_item_id and c.code = a.axis_code;

  insert into public.form_matrix_columns (item_id, form_version_id, position, code, label, weight)
  select p_item_id, v_version_id, a.axis_position, a.axis_code, a.axis_label, a.axis_weight
  from app.matrix_axis_entries(p_columns) a
  where not exists (
    select 1 from public.form_matrix_columns c
    where c.item_id = p_item_id and c.code = a.axis_code
  );

  perform app.audit_write(
    'form_matrix_axes.upserted', 'form_item', p_item_id, v_commission,
    'Eixos da matriz atualizados',
    jsonb_build_object(
      'rows', jsonb_array_length(p_rows),
      'columns', jsonb_array_length(p_columns),
      'item_type', v_item_type
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 1b · save_risk_matrix_answers — the both-halves guard, same NULL trap.
-- ---------------------------------------------------------------------------
create or replace function app.save_risk_matrix_answers(
  p_response_id uuid,
  p_version_id uuid,
  p_payload jsonb,
  p_instance_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_bad_item uuid;
  v_bad_code text;
  v_items uuid[];
begin
  if p_payload is null or p_payload = '{}'::jsonb then
    return;
  end if;

  perform app.assert_matrix_answer_writable(p_response_id);

  select (e.key)::uuid into v_bad_item
  from jsonb_each(p_payload) e
  where not exists (
    select 1 from public.form_items i
    where i.id = (e.key)::uuid
      and i.form_version_id = p_version_id
      and i.item_type = 'risk_matrix'
  )
  limit 1;

  if v_bad_item is not null then
    raise exception 'o item % não é uma matriz de risco desta versão do formulário', v_bad_item
      using errcode = 'HC0P8';
  end if;

  -- DEFECT 1: an ABSENT `severity`/`likelihood` key yielded NULL from
  -- jsonb_typeof, so the guard never fired and the insert failed later with a
  -- raw 23502 instead of this pt-BR error.
  if exists (
    select 1 from jsonb_each(p_payload) e
    where coalesce(jsonb_typeof(e.value -> 'severity'), 'missing') <> 'string'
       or coalesce(jsonb_typeof(e.value -> 'likelihood'), 'missing') <> 'string'
  ) then
    raise exception 'informe a severidade e a probabilidade da matriz de risco'
      using errcode = 'HC0P8';
  end if;

  select sel.code into v_bad_code
  from (
    select (e.key)::uuid as item_id, e.value ->> 'severity' as code
    from jsonb_each(p_payload) e
  ) sel
  where not exists (
    select 1 from public.form_matrix_rows r
    where r.item_id = sel.item_id and r.code = sel.code
  )
  limit 1;

  if v_bad_code is not null then
    raise exception 'a severidade "%" não pertence a esta matriz', v_bad_code
      using errcode = 'HC0P7';
  end if;

  select sel.code into v_bad_code
  from (
    select (e.key)::uuid as item_id, e.value ->> 'likelihood' as code
    from jsonb_each(p_payload) e
  ) sel
  where not exists (
    select 1 from public.form_matrix_columns col
    where col.item_id = sel.item_id and col.code = sel.code
  )
  limit 1;

  if v_bad_code is not null then
    raise exception 'a probabilidade "%" não pertence a esta matriz', v_bad_code
      using errcode = 'HC0P7';
  end if;

  select array_agg((e.key)::uuid) into v_items from jsonb_each(p_payload) e;
  perform app.ensure_matrix_answer_rows(p_response_id, v_items, p_instance_id);

  insert into public.answer_risk_matrix
    (answer_id, severity_row_id, likelihood_col_id, risk_score)
  select a.id, r.id, col.id, r.weight * col.weight
  from (
    select (e.key)::uuid as item_id,
           e.value ->> 'severity'   as sev_code,
           e.value ->> 'likelihood' as lik_code
    from jsonb_each(p_payload) e
  ) sel
  join public.answers a
    on a.response_id = p_response_id
   and a.group_instance_id is not distinct from p_instance_id
   and a.item_id = sel.item_id
  join public.form_matrix_rows r      on r.item_id = sel.item_id   and r.code = sel.sev_code
  join public.form_matrix_columns col on col.item_id = sel.item_id and col.code = sel.lik_code
  on conflict (answer_id) do update
    set severity_row_id   = excluded.severity_row_id,
        likelihood_col_id = excluded.likelihood_col_id,
        risk_score        = excluded.risk_score;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2 · app.copy_version_children — the gate matches the RLS it displaced.
-- ---------------------------------------------------------------------------
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
  v_actor uuid := (select auth.uid());
begin
  v_source_commission := app.commission_of_version(p_source_version_id);
  v_target_commission := app.commission_of_version(p_target_version_id);

  if v_source_commission is null or v_target_commission is null then
    raise exception 'versão de formulário não encontrada'
      using errcode = 'no_data_found';
  end if;

  -- The displaced `form_*_staff_admin_write` predicate, on BOTH endpoints — but
  -- only for callers RLS would actually have applied to. `auth.uid()` is NULL
  -- for `postgres` / `service_role`, which bypass RLS on these tables anyway, so
  -- checking them here would make this helper STRICTER than the tables it
  -- writes — which is what broke 61/203/209. Reachability: `app` is not a
  -- PostgREST-exposed schema, and the public `clone_form_version` is INVOKER, so
  -- an anonymous caller is refused by the RLS-gated form_versions INSERT before
  -- it ever gets here.
  if v_actor is not null and not (
    (app.is_staff_admin_of(v_source_commission) or app.is_commission_admin_of(v_source_commission))
    and
    (app.is_staff_admin_of(v_target_commission) or app.is_commission_admin_of(v_target_commission))
  ) then
    raise exception 'você não pode editar formulários nesta comissão'
      using errcode = '42501';
  end if;

  select status into v_target_status
  from public.form_versions where id = p_target_version_id;

  if v_target_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser editadas'
      using errcode = 'HC0P4';
  end if;

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

  insert into public.form_item_options (
    item_id, position, code, label, color_token, score, analytics_code, flagged, is_other,
    is_exclusive, risk_weight
  )
  select m.new_id, o.position, o.code, o.label, o.color_token, o.score,
         o.analytics_code, o.flagged, o.is_other, o.is_exclusive, o.risk_weight
  from public.form_item_options o
  join _clone_item_map m on m.old_id = o.item_id;

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
