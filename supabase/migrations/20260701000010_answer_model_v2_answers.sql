-- Answer-Model v2 — BE-2/BE-3/BE-4: the answer-side core (ADR 0045).
--
-- Uniform answer row (every answered item — scalar OR choice — gets one answers
-- row per (response, item, instance)); selections re-keyed to answer_id; typed
-- scalar columns derived by a BEFORE trigger; instance-ready key
-- (group_instance_id). The evaluator (app.eval_condition / eval_visibility + TS
-- twins) is UNTOUCHED; only the rehydration sources change. answer_map /
-- answer_map_by_item / case_phase_answer_map output stays byte-for-byte identical
-- (Rule 3) — proven by the golden-parity pgTAP.
--
-- Forward-only additive on baseline 20260620000000. Pre-launch: no data backfill
-- (the selections re-key drops the old columns after clearing the — empty — table).

-- ===========================================================================
-- BE-2 (schema): answers new columns + partial-unique replacement.
-- ===========================================================================
alter table public.answers
  add column group_instance_id     uuid references public.response_group_instances(id) on delete cascade,
  add column value_number          numeric,
  add column value_date            date,
  add column value_time            time,
  add column answered_at           timestamptz not null default now(),
  add column confidentiality_level text not null default 'standard';

comment on column public.answers.group_instance_id is
  'answer-model-v2 (ADR 0045): repeating-group instance this answer belongs to (NULL = top-level; the ONLY value written until repeating groups ship).';
comment on column public.answers.value_number is
  'answer-model-v2 (ADR 0045): typed denormalization of value for number items, derived by app.sync_answer_typed_values. value jsonb stays the CANONICAL evaluator input; this is analytics/indexing only.';
comment on column public.answers.value_date is
  'answer-model-v2 (ADR 0045): typed denormalization of value for date items (trigger-derived; analytics only).';
comment on column public.answers.value_time is
  'answer-model-v2 (ADR 0045): typed denormalization of value for time items (trigger-derived; analytics only).';
comment on column public.answers.answered_at is
  'answer-model-v2 (ADR 0045): contemporaneous per-answer timestamp (ALCOA+); set on insert, refreshed by save_section_answers when the answer changes.';
comment on column public.answers.confidentiality_level is
  'answer-model-v2 (ADR 0045/0046): RESERVED + UNENFORCED field-level confidentiality hook; default ''standard''. No RLS predicate keys on it yet.';

-- Replace unique(response_id,item_id) with two PARTIAL unique indexes: a plain
-- composite-with-nullable-column would treat NULLs as distinct and silently
-- permit duplicate top-level answers.
alter table public.answers drop constraint answers_response_id_item_id_key;
create unique index answers_uq_top
  on public.answers (response_id, item_id)
  where group_instance_id is null;
create unique index answers_uq_inst
  on public.answers (response_id, item_id, group_instance_id)
  where group_instance_id is not null;

-- ===========================================================================
-- BE-2 (schema): answer_selected_options re-key to answer_id.
-- Pre-launch, the table is empty; clear defensively, then swap the key.
-- ===========================================================================
delete from public.answer_selected_options;

alter table public.answer_selected_options
  add column answer_id uuid;

-- The existing RLS policies reference response_id; drop them before the column
-- drop, then recreate re-keyed via answer_id -> answers (below).
drop policy if exists "answer_selected_options_select" on public.answer_selected_options;
drop policy if exists "answer_selected_options_write_own_draft" on public.answer_selected_options;

alter table public.answer_selected_options
  drop constraint answer_selected_options_pkey,
  drop constraint answer_selected_options_response_id_fkey,
  drop constraint answer_selected_options_item_id_fkey;

alter table public.answer_selected_options
  drop column response_id,
  drop column item_id;

alter table public.answer_selected_options
  alter column answer_id set not null,
  add constraint answer_selected_options_answer_id_fkey
    foreign key (answer_id) references public.answers(id) on delete cascade,
  add constraint answer_selected_options_pkey primary key (answer_id, option_id);

-- Response/commission index no longer applies; index the new FK.
drop index if exists public.answer_selected_options_response_idx;
create index answer_selected_options_answer_idx
  on public.answer_selected_options (answer_id);

-- Re-key the RLS policies via answer_id -> answers -> responses (the answers
-- policies inline the same responses predicate; we reach responses one hop
-- further, through the parent answer).
create policy "answer_selected_options_select"
  on public.answer_selected_options
  for select to authenticated
  using (exists (
    select 1
    from public.answers a
    join public.responses r on r.id = a.response_id
    where a.id = answer_selected_options.answer_id
      and (
        r.created_by = auth.uid()
        or app.is_org_admin_of_commission(r.commission_id)
        or (r.status = 'submitted' and app.is_staff_admin_of(r.commission_id))
      )
  ));

create policy "answer_selected_options_write_own_draft"
  on public.answer_selected_options
  for all to authenticated
  using (exists (
    select 1
    from public.answers a
    join public.responses r on r.id = a.response_id
    where a.id = answer_selected_options.answer_id
      and r.created_by = auth.uid()
      and r.status = 'in_progress'
  ))
  with check (exists (
    select 1
    from public.answers a
    join public.responses r on r.id = a.response_id
    where a.id = answer_selected_options.answer_id
      and r.created_by = auth.uid()
      and r.status = 'in_progress'
  ));

comment on table public.answer_selected_options is
  'answer-model-v2 (ADR 0045): choice-answer selections hang off the parent answers row (answer_id -> answers). Response / item / instance are inherited via answer_id; PK (answer_id, option_id) — the nullable-key trap is avoided by construction. RLS + submitted-immutability re-derive the response through answer_id.';

-- Supabase grants are table-wide and survive column changes; assert them anyway
-- (idempotent) so the re-keyed table keeps authenticated DML.
grant all on table public.answer_selected_options to authenticated;
grant all on table public.answer_selected_options to service_role;

-- ===========================================================================
-- BE-2: typed-value derivation trigger. value jsonb is the canonical evaluator
-- input and MUST always persist — derivation NEVER fails a save: every cast is
-- guarded so a malformed scalar leaves the typed column NULL.
-- ===========================================================================
create or replace function app.sync_answer_typed_values() returns trigger
  language plpgsql
  set search_path to 'public', 'pg_catalog'
  as $$
declare
  v_type text;
begin
  select item_type into v_type from public.form_items where id = new.item_id;

  new.value_number := null;
  new.value_date   := null;
  new.value_time   := null;

  if new.value is not null and jsonb_typeof(new.value) is distinct from 'null' then
    if v_type = 'number' and jsonb_typeof(new.value) = 'number' then
      begin
        new.value_number := (new.value #>> '{}')::numeric;
      exception when others then
        new.value_number := null;
      end;
    elsif v_type = 'date' and jsonb_typeof(new.value) = 'string' then
      begin
        new.value_date := (new.value #>> '{}')::date;
      exception when others then
        new.value_date := null;
      end;
    elsif v_type = 'time' and jsonb_typeof(new.value) = 'string' then
      begin
        new.value_time := (new.value #>> '{}')::time;
      exception when others then
        new.value_time := null;
      end;
    end if;
  end if;

  return new;
end;
$$;

alter function app.sync_answer_typed_values() owner to postgres;
revoke all on function app.sync_answer_typed_values() from public;
grant all on function app.sync_answer_typed_values() to authenticated;
grant all on function app.sync_answer_typed_values() to service_role;

comment on function app.sync_answer_typed_values() is
  'answer-model-v2 (ADR 0045): BEFORE INS/UPD on answers — derives value_number/value_date/value_time from (value, item_type). Every cast is exception-guarded so a malformed scalar leaves the typed column NULL and NEVER blocks the save (value jsonb stays canonical).';

create trigger sync_answer_typed_values_trg
  before insert or update on public.answers
  for each row execute function app.sync_answer_typed_values();

-- ===========================================================================
-- BE-2: submitted-immutability. response_group_instances is covered by BE-1's
-- guard_submitted_group_instances_trg (row has response_id). answer_selected_
-- options no longer has response_id, so its guard must resolve the response via
-- answer_id -> answers. A dedicated twin keeps guard_submitted_children (used by
-- answers / signoffs / group_instances) unchanged.
-- ===========================================================================
create or replace function app.guard_submitted_selections() returns trigger
  language plpgsql security definer
  set search_path to 'public', 'pg_catalog'
  as $$
declare
  v_answer_id uuid;
  v_response_id uuid;
  v_status text;
begin
  v_answer_id := case when tg_op = 'DELETE' then old.answer_id else new.answer_id end;

  select a.response_id into v_response_id
  from public.answers a where a.id = v_answer_id;

  select status into v_status from public.responses where id = v_response_id;

  if v_status = 'submitted'
     and coalesce(current_setting('app.in_submit_rpc', true), 'off') <> 'on' then
    raise exception '% on a submitted response is blocked (immutable)', tg_op
      using errcode = 'check_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

alter function app.guard_submitted_selections() owner to postgres;
revoke all on function app.guard_submitted_selections() from public;
grant all on function app.guard_submitted_selections() to authenticated;
grant all on function app.guard_submitted_selections() to service_role;

comment on function app.guard_submitted_selections() is
  'answer-model-v2 (ADR 0045): submitted-immutability for answer_selected_options — resolves the response via answer_id -> answers (the table no longer carries response_id). Twin of guard_submitted_children.';

-- Swap the selections guard trigger to the answer_id-aware twin.
drop trigger if exists guard_submitted_selections_trg on public.answer_selected_options;
create trigger guard_submitted_selections_trg
  before insert or delete or update on public.answer_selected_options
  for each row execute function app.guard_submitted_selections();

-- ===========================================================================
-- BE-2: reject_invalid_selection re-keyed — item_id/item_type now resolve via
-- answer_id -> answers.item_id (the table no longer carries item_id).
-- ===========================================================================
create or replace function public.reject_invalid_selection() returns trigger
  language plpgsql security definer
  set search_path to 'public', 'pg_catalog'
  as $$
declare
  v_item_id uuid;
  v_item_type text;
  v_option_item uuid;
begin
  select a.item_id into v_item_id
  from public.answers a where a.id = new.answer_id;

  if v_item_id is null then
    raise exception 'answer_selected_options.answer_id % has no answers row', new.answer_id;
  end if;

  select item_type into v_item_type
  from public.form_items
  where id = v_item_id;

  if v_item_type is null then
    raise exception 'answer % references item % which does not exist', new.answer_id, v_item_id;
  end if;

  if v_item_type = any (array['section_text','image']) then
    raise exception 'cannot record a selection for display item % (type %)',
      v_item_id, v_item_type
      using errcode = 'check_violation';
  end if;

  -- The selected option must belong to THIS item (defence; the FK only proves the
  -- option exists, not that it belongs to the answer's item).
  select item_id into v_option_item
  from public.form_item_options
  where id = new.option_id;

  if v_option_item is distinct from v_item_id then
    raise exception 'a opção % não pertence ao item %', new.option_id, v_item_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

alter function public.reject_invalid_selection() owner to postgres;

-- ===========================================================================
-- BE-3: rehydration. answer_map / answer_map_by_item / case_phase_answer_map
-- re-source selections via answer_id -> answers; scalars from answers.value.
-- OUTPUT byte-for-byte unchanged (single -> scalar code, checkbox -> ordered
-- code array, scalars -> raw). Proven by the golden-parity pgTAP.
-- ===========================================================================

CREATE OR REPLACE FUNCTION "app"."answer_map"("p_response_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  with
  -- (a) Scalar answers — non-choice input items only.
  scalars as (
    select a.question_key, a.value
    from public.answers a
    join public.form_items i on i.id = a.item_id
    where a.response_id = p_response_id
      and a.value is not null
      and i.item_type = any (array['free_text','short_text','number','date','time'])
  ),
  -- The selected option codes of this response, sourced through the parent answer
  -- (answer_id -> answers), with the item's question_key + type, ordered by
  -- option.position for the checkbox array.
  selected as (
    select i.question_key,
           i.item_type,
           o.code,
           o.position
    from public.answer_selected_options s
    join public.answers a on a.id = s.answer_id
    join public.form_items i on i.id = a.item_id
    join public.form_item_options o on o.id = s.option_id
    where a.response_id = p_response_id
      and i.item_type = any (array['multiple_choice','dropdown','checkbox'])
  ),
  -- (b) Single-select — exactly one code per question_key as a jsonb string.
  single as (
    select question_key, to_jsonb(min(code)) as value
    from selected
    where item_type = any (array['multiple_choice','dropdown'])
    group by question_key
  ),
  -- (c) Checkbox — a jsonb array of codes ordered by option.position.
  multi as (
    select question_key, jsonb_agg(to_jsonb(code) order by position) as value
    from selected
    where item_type = 'checkbox'
    group by question_key
  ),
  merged as (
    select question_key, value from scalars
    union all
    select question_key, value from single
    union all
    select question_key, value from multi
  )
  select coalesce(jsonb_object_agg(question_key, value), '{}'::jsonb)
  from merged;
$$;

ALTER FUNCTION "app"."answer_map"("p_response_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."answer_map_by_item"("p_response_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  with
  scalars as (
    select a.item_id, a.value
    from public.answers a
    join public.form_items i on i.id = a.item_id
    where a.response_id = p_response_id
      and a.value is not null
      and i.item_type = any (array['free_text','short_text','number','date','time'])
  ),
  selected as (
    select a.item_id, i.item_type, o.code, o.position
    from public.answer_selected_options s
    join public.answers a on a.id = s.answer_id
    join public.form_items i on i.id = a.item_id
    join public.form_item_options o on o.id = s.option_id
    where a.response_id = p_response_id
      and i.item_type = any (array['multiple_choice','dropdown','checkbox'])
  ),
  single as (
    select item_id, to_jsonb(min(code)) as value
    from selected
    where item_type = any (array['multiple_choice','dropdown'])
    group by item_id
  ),
  multi as (
    select item_id, jsonb_agg(to_jsonb(code) order by position) as value
    from selected
    where item_type = 'checkbox'
    group by item_id
  ),
  merged as (
    select item_id, value from scalars
    union all select item_id, value from single
    union all select item_id, value from multi
  )
  select coalesce(jsonb_object_agg(item_id::text, value), '{}'::jsonb)
  from merged;
$$;

ALTER FUNCTION "app"."answer_map_by_item"("p_response_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."case_phase_answer_map"("p_case_phase_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  with
  -- The case phase's SUBMITTED response (Phase-7 invariant: in-progress -> {}).
  resp as (
    select r.id
    from public.responses r
    where r.case_phase_id = p_case_phase_id
      and r.status = 'submitted'
  ),
  scalars as (
    select a.question_key, a.value
    from public.answers a
    join resp on resp.id = a.response_id
    join public.form_items i on i.id = a.item_id
    where a.value is not null
      and i.item_type = any (array['free_text','short_text','number','date','time'])
  ),
  selected as (
    select i.question_key, i.item_type, o.code, o.position
    from public.answer_selected_options s
    join public.answers a on a.id = s.answer_id
    join resp on resp.id = a.response_id
    join public.form_items i on i.id = a.item_id
    join public.form_item_options o on o.id = s.option_id
    where i.item_type = any (array['multiple_choice','dropdown','checkbox'])
  ),
  single as (
    select question_key, to_jsonb(min(code)) as value
    from selected
    where item_type = any (array['multiple_choice','dropdown'])
    group by question_key
  ),
  multi as (
    select question_key, jsonb_agg(to_jsonb(code) order by position) as value
    from selected
    where item_type = 'checkbox'
    group by question_key
  ),
  merged as (
    select question_key, value from scalars
    union all select question_key, value from single
    union all select question_key, value from multi
  )
  select coalesce(jsonb_object_agg(question_key, value), '{}'::jsonb)
  from merged;
$$;

ALTER FUNCTION "app"."case_phase_answer_map"("p_case_phase_id" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- BE-3: save_section_answers. For EVERY answered item (scalar OR choice) the
-- parent answers row is upserted first (group_instance_id = null for now;
-- answered_at refreshed on change); scalars set value (trigger derives the typed
-- columns); choices then REPLACE their selections BY answer_id. Orphan-clear
-- deletes answers rows (selections cascade via answer_id FK). HC013 cross-version
-- + code-existence guards + the in_progress guard are preserved verbatim.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."save_section_answers"("p_response_id" "uuid", "p_section_id" "uuid", "p_answers" "jsonb" DEFAULT '{}'::"jsonb", "p_clear_item_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_observations" "jsonb" DEFAULT NULL::"jsonb", "p_selections" "jsonb" DEFAULT NULL::"jsonb") RETURNS "public"."responses"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_version_id uuid;
  v_status text;
  v_result public.responses;
  v_bad_item uuid;
  v_section_version uuid;
  v_bad_code text;
begin
  select form_version_id, status into v_version_id, v_status
  from public.responses
  where id = p_response_id;

  if v_version_id is null then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  if v_status <> 'in_progress' then
    raise exception 'esta resposta já foi enviada e não pode mais ser editada'
      using errcode = 'check_violation';
  end if;

  -- Cross-version section guard (the saved section becomes last_section_id).
  select form_version_id into v_section_version
  from public.form_sections
  where id = p_section_id;

  if v_section_version is null or v_section_version <> v_version_id then
    raise exception 'a seção % não pertence a esta versão do formulário', p_section_id
      using errcode = 'HC013';
  end if;

  -- ---- Scalar answers. The answers upsert targets the top-level partial-unique
  -- (group_instance_id is null). answered_at refreshed on change. ----
  if p_answers is not null and p_answers <> '{}'::jsonb then
    select (e.key)::uuid into v_bad_item
    from jsonb_each(p_answers) e
    where not exists (
      select 1 from public.form_items i
      where i.id = (e.key)::uuid
        and i.form_version_id = v_version_id
    )
    limit 1;

    if v_bad_item is not null then
      raise exception 'o item % não pertence a esta versão do formulário', v_bad_item
        using errcode = 'HC013';
    end if;

    insert into public.answers (response_id, item_id, question_key, value, group_instance_id, answered_at)
    select p_response_id, i.id, i.question_key, e.value, null, now()
    from jsonb_each(p_answers) e
    join public.form_items i on i.id = (e.key)::uuid
    on conflict (response_id, item_id) where group_instance_id is null
    do update set value = excluded.value,
                  question_key = excluded.question_key,
                  answered_at = now();
  end if;

  -- ---- Choice selections (REPLACE semantics). For each item: upsert the PARENT
  -- answers row, delete its existing selection rows (via answer_id), then insert
  -- one row per code resolved to the option row of THAT item. Cross-version +
  -- code-existence are HC013. ----
  if p_selections is not null and p_selections <> '{}'::jsonb then
    select (e.key)::uuid into v_bad_item
    from jsonb_each(p_selections) e
    where not exists (
      select 1 from public.form_items i
      where i.id = (e.key)::uuid
        and i.form_version_id = v_version_id
    )
    limit 1;

    if v_bad_item is not null then
      raise exception 'o item % não pertence a esta versão do formulário', v_bad_item
        using errcode = 'HC013';
    end if;

    select sel.code into v_bad_code
    from (
      select (e.key)::uuid as item_id, c.value #>> '{}' as code
      from jsonb_each(p_selections) e
      cross join lateral jsonb_array_elements(e.value) c
    ) sel
    where not exists (
      select 1 from public.form_item_options o
      where o.item_id = sel.item_id and o.code = sel.code
    )
    limit 1;

    if v_bad_code is not null then
      raise exception 'a opção "%" não pertence a este item do formulário', v_bad_code
        using errcode = 'HC013';
    end if;

    -- Upsert the parent answers row for every choice item (value stays null;
    -- answered_at refreshed) so each selection has an answer_id to hang off.
    insert into public.answers (response_id, item_id, question_key, value, group_instance_id, answered_at)
    select p_response_id, i.id, i.question_key, null, null, now()
    from jsonb_each(p_selections) e
    join public.form_items i on i.id = (e.key)::uuid
    on conflict (response_id, item_id) where group_instance_id is null
    do update set answered_at = now();

    -- Replace: delete every keyed item's existing selections (via answer_id).
    delete from public.answer_selected_options s
    using public.answers a
    where s.answer_id = a.id
      and a.response_id = p_response_id
      and a.group_instance_id is null
      and a.item_id in (select (e.key)::uuid from jsonb_each(p_selections) e);

    insert into public.answer_selected_options (answer_id, option_id)
    select a.id, o.id
    from (
      select (e.key)::uuid as item_id, c.value #>> '{}' as code
      from jsonb_each(p_selections) e
      cross join lateral jsonb_array_elements(e.value) c
    ) sel
    join public.answers a
      on a.response_id = p_response_id
     and a.group_instance_id is null
     and a.item_id = sel.item_id
    join public.form_item_options o
      on o.item_id = sel.item_id and o.code = sel.code;
  end if;

  -- ---- Observation upsert (touches ONLY answers.observation). ----
  if p_observations is not null and p_observations <> '{}'::jsonb then
    select (e.key)::uuid into v_bad_item
    from jsonb_each(p_observations) e
    where not exists (
      select 1 from public.form_items i
      where i.id = (e.key)::uuid
        and i.form_version_id = v_version_id
    )
    limit 1;

    if v_bad_item is not null then
      raise exception 'o item % não pertence a esta versão do formulário', v_bad_item
        using errcode = 'HC013';
    end if;

    insert into public.answers (response_id, item_id, question_key, observation, group_instance_id)
    select p_response_id, i.id, i.question_key,
           nullif(btrim(e.value #>> '{}'), ''), null
    from jsonb_each(p_observations) e
    join public.form_items i on i.id = (e.key)::uuid
    on conflict (response_id, item_id) where group_instance_id is null
    do update set observation = excluded.observation;
  end if;

  -- ---- Orphan-clear: delete answers of now-hidden items (selections cascade). ----
  if p_clear_item_ids is not null and array_length(p_clear_item_ids, 1) is not null then
    delete from public.answers
    where response_id = p_response_id
      and item_id = any (p_clear_item_ids);
  end if;

  update public.responses
  set last_section_id = p_section_id,
      updated_at = now()
  where id = p_response_id
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."save_section_answers"("p_response_id" "uuid", "p_section_id" "uuid", "p_answers" "jsonb", "p_clear_item_ids" "uuid"[], "p_observations" "jsonb", "p_selections" "jsonb") OWNER TO "postgres";

-- ===========================================================================
-- BE-3: submit_response. "answered" = scalar value non-null OR (choice >= 1
-- selection) — semantics IDENTICAL. Selection existence re-keyed via
-- answer_id -> answers. Hidden-cleanup deletes answers rows (selections cascade
-- via the answer_id FK) AND any response_group_instances of the hidden items.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."submit_response"("p_response_id" "uuid") RETURNS "public"."responses"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_response public.responses;
  v_eff jsonb;          -- effective answer map (question_key -> value), forward pass
  r_section record;
  r_item record;
  v_visible boolean;
  v_missing boolean;
  v_signoff_exists boolean;
  v_result public.responses;
begin
  select * into v_response
  from public.responses
  where id = p_response_id;

  if v_response.id is null then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  if v_response.status = 'submitted' then
    raise exception 'esta resposta já foi enviada'
      using errcode = 'HC010';
  end if;

  perform 1 from public.responses
  where id = p_response_id and status = 'in_progress'
  for update;

  -- Effective map starts from the saved answers (rebuilt by the normalized
  -- app.answer_map — single->code, checkbox->array of codes, scalars->raw); we DROP
  -- hidden items'/sections' keys as we walk in document order.
  v_eff := app.answer_map(p_response_id);

  perform set_config('app.in_submit_rpc', 'on', true);

  for r_section in
    select s.id, s.position, s.visible_when, s.requires_signoff
    from public.form_sections s
    where s.form_version_id = v_response.form_version_id
    order by s.position
  loop
    v_visible := app.eval_visibility(r_section.visible_when, v_eff);

    if not v_visible then
      -- Stray cleanup for the whole section: delete the answers rows (selections
      -- cascade via answer_id FK) + any group instances, then drop its keys.
      delete from public.answers a
      using public.form_items i
      where a.response_id = p_response_id
        and a.item_id = i.id
        and i.section_id = r_section.id;

      delete from public.response_group_instances gi
      using public.form_items i
      where gi.response_id = p_response_id
        and gi.group_item_id = i.id
        and i.section_id = r_section.id;

      v_eff := v_eff - (
        select coalesce(array_agg(i.question_key), '{}')
        from public.form_items i
        where i.section_id = r_section.id
          and i.question_key is not null
      );
      continue;
    end if;

    for r_item in
      select i.id, i.position, i.item_type, i.question_key, i.label,
             i.required, i.config, i.visible_when
      from public.form_items i
      where i.section_id = r_section.id
        and i.question_key is not null   -- input items only
      order by i.position
    loop
      if not app.eval_visibility(r_item.visible_when, v_eff) then
        -- Hidden item: clear its answer (selections cascade) + group instances +
        -- drop its key.
        delete from public.answers a
        where a.response_id = p_response_id and a.item_id = r_item.id;
        delete from public.response_group_instances gi
        where gi.response_id = p_response_id and gi.group_item_id = r_item.id;
        v_eff := v_eff - r_item.question_key;
        continue;
      end if;

      -- Visible & required: must have a non-null SCALAR answer OR >= 1 selection.
      if r_item.required then
        select not (
          exists (
            select 1 from public.answers a
            where a.response_id = p_response_id
              and a.item_id = r_item.id
              and a.value is not null
              and a.value <> 'null'::jsonb
          )
          or exists (
            select 1
            from public.answer_selected_options s
            join public.answers a on a.id = s.answer_id
            where a.response_id = p_response_id
              and a.item_id = r_item.id
          )
        ) into v_missing;

        if v_missing then
          raise exception 'há perguntas obrigatórias sem resposta'
            using errcode = 'HC011';
        end if;
      end if;

      -- Visible number/date: enforce config min/max (present answer only).
      perform app.assert_item_bounds(
        p_response_id, r_item.id, r_item.item_type, r_item.config, r_item.label
      );
    end loop;

    -- Sign-off check (feature-flagged).
    if r_section.requires_signoff and app.feature_enabled('signoff_enforcement') then
      select exists (
        select 1 from public.response_section_signoffs so
        where so.response_id = p_response_id
          and so.section_id = r_section.id
      ) into v_signoff_exists;

      if not v_signoff_exists then
        raise exception 'há seções pendentes de assinatura'
          using errcode = 'HC012';
      end if;
    end if;
  end loop;

  update public.responses
  set status = 'submitted', submitted_at = now(), updated_at = now()
  where id = p_response_id
  returning * into v_result;

  perform set_config('app.in_submit_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."submit_response"("p_response_id" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- BE-3: response_required_complete. Same "answered" semantics; the choice
-- existence check re-keys via answer_id -> answers.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."response_required_complete"("p_response_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_version_id uuid;
  v_answers jsonb;
  r_section record;
  v_missing integer;
begin
  select form_version_id into v_version_id
  from public.responses
  where id = p_response_id;

  if v_version_id is null then
    return false;
  end if;

  v_answers := app.answer_map(p_response_id);

  for r_section in
    select s.id, s.visible_when
    from public.form_sections s
    where s.form_version_id = v_version_id
    order by s.position
  loop
    -- Hidden sections require nothing (group-aware visibility).
    if not app.eval_visibility(r_section.visible_when, v_answers) then
      continue;
    end if;

    select count(*) into v_missing
    from public.form_items i
    where i.section_id = r_section.id
      and i.required = true
      and i.question_key is not null
      -- A per-item visibility condition can hide a required item; honour it.
      and app.eval_visibility(i.visible_when, v_answers)
      and not (
        exists (
          select 1 from public.answers a
          where a.response_id = p_response_id
            and a.item_id = i.id
            and a.value is not null
            and a.value <> 'null'::jsonb
        )
        or exists (
          select 1
          from public.answer_selected_options s
          join public.answers a on a.id = s.answer_id
          where a.response_id = p_response_id
            and a.item_id = i.id
        )
      );

    if v_missing > 0 then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

ALTER FUNCTION "app"."response_required_complete"("p_response_id" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- BE-4: dashboards re-key the choice-selection join via answer_id -> answers.
-- Aggregates are IDENTICAL (proven by the dashboard pre/post pgTAP).
-- ===========================================================================

CREATE OR REPLACE FUNCTION "public"."dashboard_distributions"("p_form_id" "uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date") RETURNS TABLE("question_key" "text", "label" "text", "section_title" "text", "section_position" integer, "item_position" integer, "item_type" "text", "option_code" "text", "option_label" "text", "option_count" bigint, "denominator" bigint, "n" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_latest uuid;
begin
  select commission_id into v_commission_id from public.forms where id = p_form_id;
  if v_commission_id is null or not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    return;
  end if;

  v_latest := app.latest_published_version(p_form_id);

  return query
  with
  resp as (
    select sr.id, sr.form_version_id
    from app.submitted_form_responses(p_form_id) sr
    where (p_from is null or sr.submitted_at::date >= p_from)
      and (p_to   is null or sr.submitted_at::date <= p_to)
  ),
  -- Every CHOICE selection of those responses, sourced through the parent answer
  -- (answer_id -> answers), joined to its authoring item + selected option.
  sel as (
    select a.response_id,
           fi.question_key,
           fi.item_type,
           fi.section_id,
           o.code as option_code
    from public.answer_selected_options s
    join public.answers a on a.id = s.answer_id
    join resp on resp.id = a.response_id
    join public.form_items fi on fi.id = a.item_id
    join public.form_item_options o on o.id = s.option_id
    where fi.item_type in ('multiple_choice', 'dropdown', 'checkbox')
  ),
  section_answered as (
    select distinct response_id, section_id from sel
  ),
  key_section as (
    select distinct fi.question_key, fi.section_id
    from sel af
    join public.form_items fi on fi.question_key = af.question_key
    where fi.form_version_id in (select distinct form_version_id from resp)
      and fi.item_type in ('multiple_choice', 'dropdown', 'checkbox')
  ),
  denom as (
    select ks.question_key,
           count(distinct sa.response_id) as denominator
    from key_section ks
    join section_answered sa on sa.section_id = ks.section_id
    group by ks.question_key
  ),
  tally as (
    select e.question_key,
           e.option_code,
           count(*) as option_count
    from sel e
    group by e.question_key, e.option_code
  ),
  n_per_key as (
    select sel.question_key as qk, count(distinct sel.response_id) as cnt
    from sel
    group by sel.question_key
  ),
  meta as (
    select fi.question_key,
           fi.label,
           fs.title as section_title,
           fs.position as section_position,
           fi.position as item_position,
           fi.item_type
    from public.form_items fi
    join public.form_sections fs on fs.id = fi.section_id
    where fi.form_version_id = v_latest
      and fi.item_type in ('multiple_choice', 'dropdown', 'checkbox')
  ),
  code_label as (
    select fi.question_key, o.code, o.label
    from public.form_items fi
    join public.form_item_options o on o.item_id = fi.id
    where fi.form_version_id = v_latest
      and fi.item_type in ('multiple_choice', 'dropdown', 'checkbox')
  )
  select t.question_key,
         coalesce(m.label, t.question_key) as label,
         m.section_title,
         coalesce(m.section_position, 0) as section_position,
         coalesce(m.item_position, 0) as item_position,
         coalesce(m.item_type, 'multiple_choice') as item_type,
         t.option_code,
         coalesce(cl.label, t.option_code) as option_label,
         t.option_count,
         coalesce(d.denominator, 0) as denominator,
         coalesce(np.cnt, 0) as n
  from tally t
  left join meta m on m.question_key = t.question_key
  left join code_label cl on cl.question_key = t.question_key and cl.code = t.option_code
  left join denom d on d.question_key = t.question_key
  left join n_per_key np on np.qk = t.question_key
  order by coalesce(m.section_position, 0),
           coalesce(m.item_position, 0),
           t.question_key,
           coalesce(cl.label, t.option_code);
end;
$$;

ALTER FUNCTION "public"."dashboard_distributions"("p_form_id" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."dashboard_export_rows"("p_form_id" "uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date") RETURNS TABLE("response_id" "uuid", "member_name" "text", "submitted_at" timestamp with time zone, "version_number" integer, "answers" "jsonb", "signoffs" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_latest uuid;
begin
  select commission_id into v_commission_id from public.forms where id = p_form_id;
  if v_commission_id is null or not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    return;
  end if;

  v_latest := app.latest_published_version(p_form_id);

  return query
  select r.id,
         pr.full_name as member_name,
         r.submitted_at,
         fv.version_number,
         (
           select coalesce(jsonb_object_agg(qk, txt), '{}'::jsonb)
           from (
             -- scalar answers
             select a.question_key as qk, a.value #>> '{}' as txt
             from public.answers a
             join public.form_items fi on fi.id = a.item_id
             where a.response_id = r.id and a.value is not null
               and fi.item_type in ('free_text','short_text','number','date','time')
             union all
             -- choice answers: selections sourced via answer_id -> answers; each
             -- selected code -> current label, aggregated per key.
             select fi.question_key as qk,
                    string_agg(
                      coalesce(cur.label, own.label, o.code), '; '
                      order by o.position
                    ) as txt
             from public.answer_selected_options s
             join public.answers a on a.id = s.answer_id
             join public.form_items fi on fi.id = a.item_id
             join public.form_item_options o on o.id = s.option_id
             -- current label from the latest published version (by code)
             left join public.form_items cfi
               on cfi.form_version_id = v_latest and cfi.question_key = fi.question_key
             left join public.form_item_options cur
               on cur.item_id = cfi.id and cur.code = o.code
             -- own-version label (the option row itself)
             left join public.form_item_options own on own.id = s.option_id
             where a.response_id = r.id
               and fi.item_type in ('multiple_choice','dropdown','checkbox')
             group by fi.question_key
           ) m
         ) as answers,
         coalesce(
           (select jsonb_object_agg(
              coalesce(s.title, 'Seção ' || s.position::text),
              case when exists (
                select 1 from public.response_section_signoffs so
                where so.response_id = r.id and so.section_id = s.id
              ) then 'Assinada' else 'Pendente' end)
            from public.form_sections s
            where s.form_version_id = r.form_version_id
              and s.requires_signoff = true),
           '{}'::jsonb) as signoffs
  from app.submitted_form_responses(p_form_id) r
  join public.form_versions fv on fv.id = r.form_version_id
  left join public.profiles pr on pr.id = r.created_by
  where (p_from is null or r.submitted_at::date >= p_from)
    and (p_to   is null or r.submitted_at::date <= p_to)
  order by r.submitted_at desc;
end;
$$;

ALTER FUNCTION "public"."dashboard_export_rows"("p_form_id" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";

-- ===========================================================================
-- BE-4: clone_form_version copies default_value verbatim and remaps
-- parent_item_id to the new item ids (all NULL today; remap is inert but
-- correct). Option copy + everything else unchanged.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."clone_form_version"("p_source_version_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_form_id uuid;
  v_next_number integer;
  v_new_version_id uuid;
  v_uid uuid := auth.uid();
  v_existing_draft uuid;
begin
  select form_id into v_form_id
  from public.form_versions
  where id = p_source_version_id;

  if v_form_id is null then
    raise exception 'versão % não encontrada', p_source_version_id
      using errcode = 'no_data_found';
  end if;

  -- ADR 0012: at most one draft per form — return the existing draft if present.
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

  insert into public.form_versions (form_id, version_number, status, created_by)
  values (v_form_id, v_next_number, 'draft', v_uid)
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

  -- Copy items into the remapped sections, capturing the old->new item id map
  -- (keyed by the remapped section + position, unique per version) so the option
  -- copy can rewrite item_id and the parent_item_id remap can run. config +
  -- visible_when + default_value copy verbatim (all reference clone-stable ids:
  -- question_key + option code, both preserved). parent_item_id is copied here as
  -- the OLD id, then remapped below.
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

  -- Remap parent_item_id from the source item id to the newly-cloned item id.
  -- All values are NULL today, so this is inert but keeps the model coherent for
  -- when repeating groups ship.
  update public.form_items c
  set parent_item_id = pm.new_id
  from public.form_items src
  join _clone_item_map im on im.old_id = src.id
  join _clone_item_map pm on pm.old_id = src.parent_item_id
  where c.id = im.new_id
    and src.parent_item_id is not null;

  -- Copy option rows into the remapped items, preserving code/label/color_token/
  -- score/analytics_code/position VERBATIM (the sync trigger refills
  -- form_version_id from the item).
  insert into public.form_item_options (
    item_id, position, code, label, color_token, score, analytics_code
  )
  select m.new_id, o.position, o.code, o.label, o.color_token, o.score, o.analytics_code
  from public.form_item_options o
  join _clone_item_map m on m.old_id = o.item_id;

  drop table _clone_section_map;
  drop table _clone_item_map;

  return v_new_version_id;
end;
$$;

ALTER FUNCTION "public"."clone_form_version"("p_source_version_id" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- BE-4: publish_form_version validates default_value (type matches the item;
-- choice defaults reference existing option codes) -> HC080.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."publish_form_version"("p_form_version_id" "uuid") RETURNS "public"."form_versions"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_form_id uuid;
  v_status text;
  v_result public.form_versions;
  v_bad_item text;
  v_bad_default text;
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

  -- form-model-normalization: every CHOICE item must carry >= 1 option.
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

  -- answer-model-v2 (HC080): validate each item's default_value against its type.
  --   * choice (multiple_choice/dropdown): a single string code that exists;
  --   * checkbox: an array of string codes, each existing;
  --   * number: a JSON number; date/time/short_text/free_text: a JSON string;
  --   * display items already blocked from carrying a default by CHECK.
  -- A code that does not exist on the item, or a type mismatch, is HC080.
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
        else true   -- any other type must not carry a default
      end
    )
  limit 1;

  if v_bad_default is not null then
    raise exception 'o valor padrão da pergunta "%" é inválido', v_bad_default
      using errcode = 'HC080';
  end if;

  perform set_config('app.in_publish_rpc', 'on', true);

  update public.form_versions
  set status = 'archived'
  where form_id = v_form_id
    and status = 'published';

  update public.form_versions
  set status = 'published', published_at = now()
  where id = p_form_version_id
  returning * into v_result;

  perform set_config('app.in_publish_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."publish_form_version"("p_form_version_id" "uuid") OWNER TO "postgres";
