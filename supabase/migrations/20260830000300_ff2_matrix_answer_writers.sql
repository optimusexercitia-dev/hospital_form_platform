-- FF-2 (ADR 0089) — the matrix ANSWER writers.
--
-- WHY DEFINER (and what that obliges). `answer_matrix_cells` / `answer_risk_matrix`
-- carry SELECT-only grants for `authenticated` (K9, ADR 0089 §E), so no INVOKER
-- path can write them — unlike `answers` / `answer_selected_options`, whose
-- FOR-ALL own-draft policies let `save_section_answers` stay INVOKER. These two
-- helpers therefore run as the owner, which means **RLS does not apply to them**
-- and the gate below IS the security boundary, not a nicety (ADR 0078: a
-- DEFINER's gate REPLACES RLS, and a policy-shaped audit is blind to it).
--
-- They live in `app`, which is not a PostgREST-exposed schema (config.toml
-- exposes `public` + `graphql_public` only), so they are not directly callable
-- over the API. That is defence in depth, NOT the gate — `authenticated` holds
-- EXECUTE on them by necessity, because the INVOKER `save_section_answers` calls
-- them as the caller.

-- ---------------------------------------------------------------------------
-- The gate. Ownership + lifecycle, in the order that keeps a denial
-- indistinguishable from a miss for an unauthorized caller.
-- ---------------------------------------------------------------------------
create or replace function app.assert_matrix_answer_writable(p_response_id uuid)
returns void
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_owner uuid;
  v_status text;
begin
  if not app.feature_enabled('matrix_fields') then
    raise exception 'o recurso de matrizes não está disponível'
      using errcode = 'HC0P2';
  end if;

  select created_by, status into v_owner, v_status
  from public.responses where id = p_response_id;

  -- Creator-only while in_progress — the same rule the `answers` RLS policy
  -- enforces for every other answer shape (Architecture Rule 3). Reconstructed
  -- here because this function runs as the owner and RLS is not consulted.
  if v_owner is null or v_owner is distinct from (select auth.uid()) then
    raise exception 'você não pode editar esta resposta'
      using errcode = '42501';
  end if;

  if v_status <> 'in_progress' then
    raise exception 'esta resposta já foi enviada e não pode mais ser editada'
      using errcode = 'check_violation';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Parent answer rows. A matrix answer's payload lives in the child table with
-- `answers.value` NULL, but the parent row must exist: the child FK points at
-- it, and it is what carries `question_key` + `group_instance_id`.
--
-- Two ON CONFLICT targets because the uniqueness is two partial indexes
-- (top-level vs. per-instance) — the same fork `save_section_answers` and
-- `app.save_instance_answers` already make.
-- ---------------------------------------------------------------------------
create or replace function app.ensure_matrix_answer_rows(
  p_response_id uuid,
  p_item_ids uuid[],
  p_instance_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if p_instance_id is null then
    insert into public.answers
      (response_id, item_id, question_key, value, group_instance_id, answered_at)
    select p_response_id, i.id, i.question_key, null, null, now()
    from public.form_items i
    where i.id = any (p_item_ids)
    on conflict (response_id, item_id) where group_instance_id is null
    do update set answered_at = now();
  else
    insert into public.answers
      (response_id, item_id, question_key, value, group_instance_id, answered_at)
    select p_response_id, i.id, i.question_key, null, p_instance_id, now()
    from public.form_items i
    where i.id = any (p_item_ids)
    on conflict (response_id, item_id, group_instance_id) where group_instance_id is not null
    do update set answered_at = now();
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- `matrix` cells.
--
-- PAYLOAD: { "<item_id>": { "<row_code>": "<col_code>" } }
--
-- Addressed by CODE, never by id — codes are clone-stable and ids are not, the
-- same reason `p_selections` carries option codes. The nested object shape also
-- makes ruling 1 (one column per row) unrepresentable-if-violated on the wire,
-- before the UNIQUE (answer_id, row_id) constraint ever has to catch it.
--
-- REPLACE semantics per item, exactly like selections: an item present in the
-- payload has its whole grid rewritten; an item present with `{}` is cleared; an
-- item absent is left untouched.
-- ---------------------------------------------------------------------------
create or replace function app.save_matrix_answers(
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

  -- Every addressed item must belong to THIS version and be a `matrix`.
  select (e.key)::uuid into v_bad_item
  from jsonb_each(p_payload) e
  where not exists (
    select 1 from public.form_items i
    where i.id = (e.key)::uuid
      and i.form_version_id = p_version_id
      and i.item_type = 'matrix'
  )
  limit 1;

  if v_bad_item is not null then
    raise exception 'o item % não é uma matriz desta versão do formulário', v_bad_item
      using errcode = 'HC0P3';
  end if;

  -- Every row code and every column code must belong to the item it is sent
  -- under. The coherence trigger enforces this at the table too; resolving it
  -- here is what turns a raw trigger raise into an addressable pt-BR error.
  select sel.code into v_bad_code
  from (
    select (e.key)::uuid as item_id, c.key as code
    from jsonb_each(p_payload) e
    cross join lateral jsonb_each(e.value) c
  ) sel
  where not exists (
    select 1 from public.form_matrix_rows r
    where r.item_id = sel.item_id and r.code = sel.code
  )
  limit 1;

  if v_bad_code is not null then
    raise exception 'a linha "%" não pertence a esta matriz', v_bad_code
      using errcode = 'HC0P7';
  end if;

  select sel.code into v_bad_code
  from (
    select (e.key)::uuid as item_id, c.value #>> '{}' as code
    from jsonb_each(p_payload) e
    cross join lateral jsonb_each(e.value) c
  ) sel
  where not exists (
    select 1 from public.form_matrix_columns col
    where col.item_id = sel.item_id and col.code = sel.code
  )
  limit 1;

  if v_bad_code is not null then
    raise exception 'a coluna "%" não pertence a esta matriz', v_bad_code
      using errcode = 'HC0P7';
  end if;

  select array_agg((e.key)::uuid) into v_items from jsonb_each(p_payload) e;
  perform app.ensure_matrix_answer_rows(p_response_id, v_items, p_instance_id);

  -- REPLACE: clear this item's grid, then write the payload's.
  delete from public.answer_matrix_cells c
  using public.answers a
  where c.answer_id = a.id
    and a.response_id = p_response_id
    and a.group_instance_id is not distinct from p_instance_id
    and a.item_id = any (v_items);

  insert into public.answer_matrix_cells (answer_id, row_id, col_id, value)
  select a.id, r.id, col.id, 'true'::jsonb
  from (
    select (e.key)::uuid as item_id, c.key as row_code, c.value #>> '{}' as col_code
    from jsonb_each(p_payload) e
    cross join lateral jsonb_each(e.value) c
  ) sel
  join public.answers a
    on a.response_id = p_response_id
   and a.group_instance_id is not distinct from p_instance_id
   and a.item_id = sel.item_id
  join public.form_matrix_rows r    on r.item_id = sel.item_id   and r.code = sel.row_code
  join public.form_matrix_columns col on col.item_id = sel.item_id and col.code = sel.col_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- `risk_matrix`.
--
-- PAYLOAD: { "<item_id>": { "severity": "<row_code>", "likelihood": "<col_code>" } }
--
-- There is deliberately NO score key. `risk_score` is DERIVED here as
-- severity_row.weight * likelihood_col.weight (ADR 0089 ruling 2). A client that
-- sends one is not rejected — the key is simply never read, which is the
-- stronger property: a payload shape that cannot influence the stored score
-- needs no validation to stay honest.
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

  -- Both halves are mandatory: a risk answer with only a severity has no score,
  -- and `answer_risk_matrix` has both columns NOT NULL. Catch it as HC0P8 rather
  -- than as a raw 23502 from the insert.
  if exists (
    select 1 from jsonb_each(p_payload) e
    where jsonb_typeof(e.value -> 'severity') <> 'string'
       or jsonb_typeof(e.value -> 'likelihood') <> 'string'
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

  -- `answer_risk_matrix` is UNIQUE (answer_id), so REPLACE is an upsert.
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

comment on function app.save_matrix_answers(uuid, uuid, jsonb, uuid) is
  'FF-2 (ADR 0089 ruling 1): writes answer_matrix_cells from a {item_id: {row_code: col_code}} payload. DEFINER because the table is SELECT-only for `authenticated` (K9) — app.assert_matrix_answer_writable IS the security boundary here, not RLS.';
comment on function app.save_risk_matrix_answers(uuid, uuid, jsonb, uuid) is
  'FF-2 (ADR 0089 ruling 2): writes answer_risk_matrix from a {item_id: {severity, likelihood}} payload. risk_score is DERIVED as severity_row.weight * likelihood_col.weight; a client-supplied score key is never read.';
