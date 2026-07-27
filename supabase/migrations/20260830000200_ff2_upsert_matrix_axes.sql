-- FF-2 (ADR 0089) — `upsert_matrix_axes`: the builder-side axis writer, plus the
-- publish-time re-check of the invariants a CHECK cannot express.
--
-- WHY A DEFINER DOOR. K9 (ADR 0089 §E): all four matrix tables keep SELECT-only
-- grants for `authenticated` and stay direct-DML-denied AFTER the writers ship.
-- That makes this RPC the security boundary for axis writes, not a convenience
-- wrapper — so it carries its own authority check FIRST, before it discloses
-- anything about the item's state (a DEFINER's gate REPLACES RLS; a
-- policy-shaped audit is structurally blind to it — ADR 0078).
--
-- Contrast with FF-1's instance RPCs, which are INVOKER: `response_group_instances`
-- carries full DML for `authenticated` under a FOR ALL own-draft policy, so RLS
-- remains the boundary there and those RPCs are correctness doors. Same phase
-- family, opposite posture, because the GRANTS differ. Read the ACL, not the
-- neighbouring migration.

-- ---------------------------------------------------------------------------
-- Payload parser. Kept separate and IMMUTABLE so the three write statements
-- below share one definition of "what an axis entry is" — the shape is
-- validated on the RAW jsonb first (below), so the casts here cannot raise
-- 22P02 in place of a pt-BR HC0P5.
--
-- Output columns are prefixed (`axis_position`, not `position`) because bare
-- `position` collides with the SQL POSITION() construct inside plpgsql.
-- ---------------------------------------------------------------------------
create or replace function app.matrix_axis_entries(p_payload jsonb)
returns table (axis_code text, axis_label text, axis_position integer, axis_weight numeric)
language sql
immutable
as $$
  select btrim(e.value ->> 'code'),
         btrim(e.value ->> 'label'),
         (e.value ->> 'position')::integer,
         case when jsonb_typeof(e.value -> 'weight') = 'number'
              then (e.value ->> 'weight')::numeric
              else null end
  from jsonb_array_elements(coalesce(p_payload, '[]'::jsonb)) e;
$$;

-- ---------------------------------------------------------------------------
-- Publish-time re-check (ADR 0089 ruling 2: "re-checked at publish, since a
-- cross-row invariant is not expressible as a CHECK").
--
-- `upsert_matrix_axes` enforces these per call, but an author can leave a grid
-- half-built between calls — a draft is allowed to be incomplete, a PUBLISHED
-- version is not. Mirrors the shape of `validate_group_layout` (FF-1) and the
-- existing "a pergunta precisa de ao menos uma opção" check.
-- ---------------------------------------------------------------------------
create or replace function app.validate_matrix_axes(p_form_version_id uuid)
returns void
language plpgsql
stable
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_bad text;
begin
  -- Every matrix/risk_matrix item needs at least one row AND one column: a grid
  -- with an empty axis renders nothing and can never satisfy `required`.
  select coalesce(i.label, i.question_key) into v_bad
  from public.form_items i
  where i.form_version_id = p_form_version_id
    and i.item_type in ('matrix', 'risk_matrix')
    and (
      not exists (select 1 from public.form_matrix_rows r where r.item_id = i.id)
      or not exists (select 1 from public.form_matrix_columns c where c.item_id = i.id)
    )
  limit 1;

  if v_bad is not null then
    raise exception 'a matriz "%" precisa de ao menos uma linha e uma coluna', v_bad
      using errcode = 'HC0P5';
  end if;

  -- Every risk_matrix axis entry needs a weight — risk_score is their product,
  -- and a null factor would silently produce a null score.
  select coalesce(i.label, i.question_key) into v_bad
  from public.form_items i
  where i.form_version_id = p_form_version_id
    and i.item_type = 'risk_matrix'
    and (
      exists (select 1 from public.form_matrix_rows r
              where r.item_id = i.id and r.weight is null)
      or exists (select 1 from public.form_matrix_columns c
                 where c.item_id = i.id and c.weight is null)
    )
  limit 1;

  if v_bad is not null then
    raise exception
      'a matriz de risco "%" exige um peso em todas as linhas e colunas', v_bad
      using errcode = 'HC0P6';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- The writer. REPLACE semantics keyed on `code`:
--   · an entry whose code already exists  -> UPDATE label/position/weight
--     (the code itself never changes, so the immutability trigger passes);
--   · an entry with a new code            -> INSERT;
--   · an existing code absent from the payload -> DELETE.
--
-- Codes are MINTED BY THE CLIENT and honoured verbatim, exactly as
-- `form_item_options` settled it (a server that re-mints discards the client's
-- code for new rows — that was BUG-AMV2-002). The server validates them; it does
-- not invent them.
--
-- Draft-only, so the DELETE arm's cascade into `answer_matrix_cells` can only
-- ever reach answers of a draft version.
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

  -- This function reads without RLS, so "found" here means "exists". The
  -- authority check immediately below is what gates who may act on it.
  if v_version_id is null then
    raise exception 'pergunta % não encontrada', p_item_id
      using errcode = 'HC0P3';
  end if;

  v_commission := app.commission_of_version(v_version_id);

  -- AUTHORITY FIRST — before any further precondition, so an unauthorized caller
  -- never learns the item's type or its version's status (ADR 0079). '42501',
  -- never an HC0P code: authority and domain preconditions must be
  -- distinguishable by SQLSTATE alone.
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

  -- ---- payload shape ----
  if p_rows is null or jsonb_typeof(p_rows) <> 'array'
     or p_columns is null or jsonb_typeof(p_columns) <> 'array' then
    raise exception 'lista de linhas/colunas da matriz inválida'
      using errcode = 'HC0P5';
  end if;

  if exists (
    select 1
    from (
      select value as e from jsonb_array_elements(p_rows)
      union all
      select value from jsonb_array_elements(p_columns)
    ) x
    where jsonb_typeof(x.e) <> 'object'
       or jsonb_typeof(x.e -> 'code') <> 'string'  or btrim(x.e ->> 'code') = ''
       or jsonb_typeof(x.e -> 'label') <> 'string' or btrim(x.e ->> 'label') = ''
       or jsonb_typeof(x.e -> 'position') <> 'number'
       or ((x.e ? 'weight') and jsonb_typeof(x.e -> 'weight') not in ('number', 'null'))
  ) then
    raise exception 'lista de linhas/colunas da matriz inválida'
      using errcode = 'HC0P5';
  end if;

  -- Duplicate codes or duplicate positions WITHIN an axis. `unique(item_id, code)`
  -- would catch the code case as a raw 23505 mid-write; catching it here keeps
  -- the message pt-BR and the transaction clean. Position has no DB uniqueness,
  -- so this is its only guard — two entries at the same ordinal render in an
  -- arbitrary order, which is a silent authoring bug.
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

  -- A risk_matrix needs a weight on EVERY entry of BOTH axes: risk_score is
  -- their product (ADR 0089 ruling 2).
  if v_item_type = 'risk_matrix' and exists (
    select 1
    from (
      select value as e from jsonb_array_elements(p_rows)
      union all
      select value from jsonb_array_elements(p_columns)
    ) x
    where jsonb_typeof(x.e -> 'weight') <> 'number'
  ) then
    raise exception 'a matriz de risco exige um peso em todas as linhas e colunas'
      using errcode = 'HC0P6';
  end if;

  -- ---- rows ----
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

  -- ---- columns ----
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

  -- Rule 11: counts only. Axis LABELS are author free text and never enter the
  -- un-erasable chain.
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

revoke all on function public.upsert_matrix_axes(uuid, jsonb, jsonb) from public;
grant execute on function public.upsert_matrix_axes(uuid, jsonb, jsonb) to authenticated;

comment on function public.upsert_matrix_axes(uuid, jsonb, jsonb) is
  'FF-2 (ADR 0089): DEFINER axis writer for matrix/risk_matrix items. Draft-only, staff_admin/commission-admin of the version''s commission, audited. REPLACE semantics keyed on the client-minted, immutable `code`. K9: the four matrix tables stay SELECT-only for `authenticated`, so this RPC is the security boundary for axis writes.';

-- ---------------------------------------------------------------------------
-- Wire the publish-time re-check in.
--
-- Re-declared IN FULL rather than patched by a runtime pg_get_functiondef() +
-- replace() rewrite. Those rewrites are why this repo's migration text is stale
-- by design and why the live catalog is the sole truth here; adding another one
-- for a single `perform` would deepen a problem that has already produced a
-- confident false P0. The body below is the CURRENT catalog body verbatim (read
-- from pg_get_functiondef at authoring time) plus the one new line, including
-- the pre-existing `parent''s` quoting artifact, kept byte-identical so any
-- LF-anchored rewrite downstream still matches.
-- ---------------------------------------------------------------------------
create or replace function public.publish_form_version(
  p_form_version_id uuid,
  p_approved_by uuid default null::uuid,
  p_effective_date date default null::date,
  p_review_cycle_months integer default null::integer,
  p_review_due_date date default null::date
)
returns public.form_versions
language plpgsql
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_form_id uuid;
  v_status text;
  v_result public.form_versions;
  v_bad_item text;
  v_bad_default text;
  v_bad_flagged text;
  v_review_due date;
begin
  select form_id, status into v_form_id, v_status
  from public.form_versions
  where id = p_form_version_id
  for update;

  if v_form_id is null then
    raise exception 'versão % não encontrada', p_form_version_id
      using errcode = 'no_data_found';
  end if;

  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser publicadas'
      using errcode = 'check_violation';
  end if;

  perform public.validate_visible_when(p_form_version_id);

  -- FF-1 (ADR 0087): container layout — children in the parent''s section,
  -- contiguously immediately after it.
  perform app.validate_group_layout(p_form_version_id);

  -- FF-2 (ADR 0089): every matrix has both axes; every risk_matrix axis entry
  -- carries the weight risk_score is derived from.
  perform app.validate_matrix_axes(p_form_version_id);

  select coalesce(i.label, i.question_key) into v_bad_item
  from public.form_items i
  where i.form_version_id = p_form_version_id
    and i.item_type in ('multiple_choice', 'dropdown', 'checkbox')
    and not exists (
      select 1 from public.form_item_options o where o.item_id = i.id
    )
  limit 1;

  if v_bad_item is not null then
    raise exception
      'a pergunta "%" precisa de ao menos uma opção de resposta', v_bad_item
      using errcode = 'check_violation';
  end if;

  select coalesce(i.label, i.question_key) into v_bad_default
  from public.form_items i
  where i.form_version_id = p_form_version_id
    and i.default_value is not null
    and (
      case
        when i.item_type in ('multiple_choice','dropdown') then
          jsonb_typeof(i.default_value) <> 'string'
          or not app.version_has_option_code(
               p_form_version_id, i.question_key, i.default_value #>> '{}')
        when i.item_type = 'checkbox' then
          jsonb_typeof(i.default_value) <> 'array'
          or exists (
            select 1
            from jsonb_array_elements(i.default_value) c
            where jsonb_typeof(c) <> 'string'
               or not app.version_has_option_code(
                    p_form_version_id, i.question_key, c #>> '{}')
          )
        when i.item_type = 'number' then
          jsonb_typeof(i.default_value) <> 'number'
        when i.item_type in ('date','time','short_text','free_text') then
          jsonb_typeof(i.default_value) <> 'string'
        else true
      end
    )
  limit 1;

  if v_bad_default is not null then
    raise exception 'o valor padrão da pergunta "%" é inválido', v_bad_default
      using errcode = 'HC080';
  end if;

  -- flagged-scoring (form-builder-enhancements): every item carrying a
  -- config.flaggedWhen must be a well-shaped single condition for its type.
  select coalesce(i.label, i.question_key) into v_bad_flagged
  from public.form_items i
  where i.form_version_id = p_form_version_id
    and i.config is not null
    and (i.config ? 'flaggedWhen')
    and not app.is_valid_flagged_when(i.config, i.item_type)
  limit 1;

  if v_bad_flagged is not null then
    raise exception
      'a condição "marcado se" da pergunta "%" é inválida', v_bad_flagged
      using errcode = 'HC046';
  end if;

  v_review_due := coalesce(
    p_review_due_date,
    case when p_review_cycle_months is not null
         then (coalesce(p_effective_date, current_date) + make_interval(months => p_review_cycle_months))::date
         else null end);

  perform set_config('app.in_publish_rpc', 'on', true);

  update public.form_versions
  set status = 'archived'
  where form_id = v_form_id
    and status = 'published';

  update public.form_versions
  set status = 'published',
      published_at = now(),
      approved_by = p_approved_by,
      approved_at = case when p_approved_by is not null then now() else null end,
      effective_date = p_effective_date,
      review_due_date = v_review_due
  where id = p_form_version_id
  returning * into v_result;

  perform set_config('app.in_publish_rpc', 'off', true);

  return v_result;
end;
$function$;
