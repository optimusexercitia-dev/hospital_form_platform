-- FF-3 (ADR 0090) — B4b: the ONE error surface, and the `HC0P9` submit gate
-- built on top of it.
--
-- ADR 0090 §3's contract is that "the list the user sees and the gate that blocks
-- them cannot disagree". That is only true if both read the SAME predicate, so
-- `app.response_validation_errors` is the single walker and `submit_response`
-- gates on it. `public.get_response_validation_errors` is a thin RLS-gated
-- wrapper over the same function.
--
-- ⚠ ONE ADDITION BEYOND THE ADR's LETTER, and the reason is a hole the ADR's
-- substrate audit did not record: `app.assert_item_bounds` has enforced
-- `form_items.config` bounds (`min`/`max` on number+date, `minLength`/`maxLength`
-- on the two text types) at submit since long before FF-3, raising `HC061`. That
-- is a SECOND validation lane over the same fields. Left alone it breaks the
-- contract above in the worst direction: a submit refused with an EMPTY error
-- list, because the wizard's list would only know about `form_item_validations`
-- rows.
--
-- So the bound logic is extracted into `app.item_bound_violations` (pure, one
-- source of truth) and `assert_item_bounds` becomes a thin wrapper over it. Same
-- SQLSTATE, same messages, same first-violation-wins order — the existing HC061
-- pgTAP is the regression net — but the violations are now also ENUMERABLE, so
-- the walker reports them with `rule_id = null` and the list is complete.
--
-- HC061 still raises FIRST (inside the item loop, as today), so a config-bound
-- violation never surfaces as HC0P9. HC0P9 is the authored-rule lane.

begin;

-- ---------------------------------------------------------------------------
-- 1 · The legacy config-bound lane, made enumerable.
--
--     A literal port: every branch, every threshold test and every pt-BR string
--     is the shipped `assert_item_bounds` body, with the answer passed in rather
--     than read. The value passed is the ANSWER MAP value, which for these four
--     item types is exactly `answers.value` (they are all in the `scalars` CTE of
--     `app.answer_map_scoped`), so no behaviour moves.
-- ---------------------------------------------------------------------------

create or replace function app.item_bound_violations(
  p_item_type text,
  p_config jsonb,
  p_label text,
  p_value jsonb
)
returns table (bound_rule_type text, bound_message text)
language sql
immutable
set search_path to 'pg_catalog'
as $$
  -- Declarative on purpose: `ord` makes the emission order EXPLICIT, and
  -- `assert_item_bounds` takes the first row, so this is what preserves the
  -- shipped "min is reported before max" behaviour byte-for-byte.
  with ctx as (
    select
      p_item_type as it,
      p_config as cfg,
      coalesce(p_label, '(sem rótulo)') as lbl,
      p_value as val,
      -- The blank test is `btrim(...) = ''`, but the LENGTH is measured on the
      -- untrimmed text — both exactly as the shipped body did.
      nullif(btrim(coalesce(p_value #>> '{}', '')), '') as present_txt
  ),
  raw as (
    select 1 as ord, 'text_length' as rt,
           format('a pergunta "%s" exige ao menos %s caractere(s)',
                  lbl, cfg -> 'minLength' #>> '{}') as msg
    from ctx
    where cfg is not null
      and it = any (array['free_text','short_text'])
      and present_txt is not null
      and jsonb_typeof(cfg -> 'minLength') = 'number'
      and char_length(val #>> '{}') < (cfg ->> 'minLength')::integer

    union all
    select 2, 'text_length',
           format('a pergunta "%s" aceita no máximo %s caractere(s)',
                  lbl, cfg -> 'maxLength' #>> '{}')
    from ctx
    where cfg is not null
      and it = any (array['free_text','short_text'])
      and present_txt is not null
      and jsonb_typeof(cfg -> 'maxLength') = 'number'
      and char_length(val #>> '{}') > (cfg ->> 'maxLength')::integer

    union all
    select 3, 'number_range',
           format('a pergunta "%s" exige um valor maior ou igual a %s',
                  lbl, cfg -> 'min' #>> '{}')
    from ctx
    where cfg is not null and it = 'number'
      and val is not null and val <> 'null'::jsonb
      and jsonb_typeof(cfg -> 'min') = 'number'
      and jsonb_typeof(val) = 'number'
      and (val)::text::numeric < (cfg ->> 'min')::numeric

    union all
    select 4, 'number_range',
           format('a pergunta "%s" exige um valor menor ou igual a %s',
                  lbl, cfg -> 'max' #>> '{}')
    from ctx
    where cfg is not null and it = 'number'
      and val is not null and val <> 'null'::jsonb
      and jsonb_typeof(cfg -> 'max') = 'number'
      and jsonb_typeof(val) = 'number'
      and (val)::text::numeric > (cfg ->> 'max')::numeric

    -- `date` only. `time` is deliberately NOT here: the shipped
    -- assert_item_bounds never covered it, and widening a legacy lane while
    -- extracting it would hide a behaviour change inside a refactor.
    union all
    select 5, 'date_range',
           format('a pergunta "%s" exige uma data a partir de %s',
                  lbl, cfg -> 'min' #>> '{}')
    from ctx
    where cfg is not null and it = 'date'
      and val is not null and val <> 'null'::jsonb
      and jsonb_typeof(cfg -> 'min') = 'string'
      and (val #>> '{}') < (cfg -> 'min' #>> '{}')

    union all
    select 6, 'date_range',
           format('a pergunta "%s" exige uma data até %s',
                  lbl, cfg -> 'max' #>> '{}')
    from ctx
    where cfg is not null and it = 'date'
      and val is not null and val <> 'null'::jsonb
      and jsonb_typeof(cfg -> 'max') = 'string'
      and (val #>> '{}') > (cfg -> 'max' #>> '{}')
  )
  select rt, msg from raw order by ord;
$$;

comment on function app.item_bound_violations(text, jsonb, text, jsonb) is
  'FF-3: the LEGACY form_items.config bound lane (min/max on number+date, '
  'minLength/maxLength on the text types), as an enumerable set. '
  'app.assert_item_bounds raises HC061 over this; app.response_validation_errors '
  'reports it with rule_id = null so the error LIST cannot omit what the GATE blocks on.';

-- `assert_item_bounds` keeps its exact signature and its exact behaviour: read
-- the answer, take the FIRST violation, raise HC061 with the same message.
create or replace function app.assert_item_bounds(
  p_response_id uuid,
  p_item_id uuid,
  p_item_type text,
  p_config jsonb,
  p_label text,
  p_group_instance_id uuid default null
)
returns void
language plpgsql
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_value jsonb;
  v_message text;
begin
  if p_config is null then
    return;
  end if;

  select a.value into v_value
  from public.answers a
  where a.response_id = p_response_id and a.item_id = p_item_id
    and a.group_instance_id is not distinct from p_group_instance_id;

  select b.bound_message into v_message
  from app.item_bound_violations(p_item_type, p_config, p_label, v_value) b
  limit 1;

  if v_message is not null then
    raise exception '%', v_message using errcode = 'HC061';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2 · The walker — the ONE predicate both the read path and the gate use.
--
--     OUT parameters are prefixed `e_` on purpose: a `returns table (item_id …)`
--     declares a plpgsql variable of that name, and any unqualified column
--     reference to `item_id` inside would be ambiguous. The public wrapper
--     renames them back to the contract's column names.
-- ---------------------------------------------------------------------------

create or replace function app.response_validation_errors(p_response_id uuid)
returns table (
  e_item_id uuid,
  e_group_instance_id uuid,
  e_rule_id uuid,
  e_rule_type text,
  e_severity text,
  e_message text
)
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_version_id uuid;
  v_answers jsonb;
  v_imap jsonb;
  v_maps jsonb;
  v_value jsonb;
  v_peers jsonb;
  v_needs_peers boolean;
  r_section record;
  r_item record;
  r_group record;
  r_instance record;
  r_child record;
  r_rule record;
  r_bound record;
begin
  select r.form_version_id into v_version_id
  from public.responses r where r.id = p_response_id;

  if v_version_id is null then
    return;
  end if;

  v_answers := app.answer_map(p_response_id);

  for r_section in
    select s.id, s.visible_when
    from public.form_sections s
    where s.form_version_id = v_version_id
    order by s.position
  loop
    -- A hidden section reports nothing. Visibility wins here for the same reason
    -- it wins in the completeness dispatch: the wizard never showed these fields.
    if not app.eval_visibility(r_section.visible_when, v_answers) then
      continue;
    end if;

    -- ---- FLAT ARM: top-level items + PLAIN-`group` children. ----
    for r_item in
      select i.id, i.item_type, i.question_key, i.label, i.config, i.visible_when,
             i.parent_item_id, p.visible_when as parent_visible_when
      from public.form_items i
      left join public.form_items p on p.id = i.parent_item_id
      where i.section_id = r_section.id
        and i.question_key is not null
        and (i.parent_item_id is null or p.item_type = 'group')
      order by i.position
    loop
      if not app.eval_visibility(r_item.visible_when, v_answers) then
        continue;
      end if;
      if r_item.parent_item_id is not null
         and not app.eval_visibility(r_item.parent_visible_when, v_answers) then
        continue;
      end if;

      v_value := v_answers -> r_item.question_key;

      for r_bound in
        select b.bound_rule_type as rt, b.bound_message as msg
        from app.item_bound_violations(
          r_item.item_type, r_item.config, r_item.label, v_value) b
      loop
        e_item_id := r_item.id;
        e_group_instance_id := null;
        e_rule_id := null;
        e_rule_type := r_bound.rt;
        e_severity := 'error';
        e_message := r_bound.msg;
        return next;
      end loop;

      for r_rule in
        select v.id, v.rule_type as rt, v.config as cfg,
               v.severity as sev, v.message as msg
        from public.form_item_validations v
        where v.item_id = r_item.id
        order by v.position, v.id
      loop
        -- No peers at top level: `unique_within_group` cannot attach to an item
        -- outside a repeating group (the coverage trigger refuses it).
        if not app.eval_validation(
             r_rule.rt, r_rule.cfg, v_value, v_answers, '[]'::jsonb) then
          e_item_id := r_item.id;
          e_group_instance_id := null;
          e_rule_id := r_rule.id;
          e_rule_type := r_rule.rt;
          e_severity := r_rule.sev;
          e_message := r_rule.msg;
          return next;
        end if;
      end loop;
    end loop;

    -- ---- GROUP ARM: per non-empty instance of each visible repeating group. ----
    for r_group in
      select i.id, i.visible_when
      from public.form_items i
      where i.section_id = r_section.id
        and i.item_type = 'repeating_group'
      order by i.position
    loop
      if not app.eval_visibility(r_group.visible_when, v_answers) then
        continue;
      end if;

      -- One resolved map per SURVIVING instance, keyed by instance id. Built once
      -- per group because `unique_within_group` needs every OTHER instance's
      -- value, and rebuilding the maps per (child, instance) would be quadratic.
      -- Empty instances are excluded: `submit_response` prunes them, so a value
      -- inside one is not "in the group" (keystone K8's negative half).
      select coalesce(
               jsonb_object_agg(gi.id::text,
                 app.instance_answer_map(p_response_id, gi.id)),
               '{}'::jsonb)
        into v_maps
      from public.response_group_instances gi
      where gi.response_id = p_response_id
        and gi.group_item_id = r_group.id
        and not app.instance_is_empty(p_response_id, gi.id);

      for r_instance in
        select gi.id
        from public.response_group_instances gi
        where gi.response_id = p_response_id
          and gi.group_item_id = r_group.id
          and not app.instance_is_empty(p_response_id, gi.id)
        order by gi.position
      loop
        v_imap := coalesce(v_maps -> r_instance.id::text, '{}'::jsonb);

        for r_child in
          select c.id, c.item_type, c.question_key, c.label, c.config, c.visible_when
          from public.form_items c
          where c.parent_item_id = r_group.id
            and c.question_key is not null
          order by c.position
        loop
          if not app.eval_visibility(r_child.visible_when, v_imap) then
            continue;
          end if;

          v_value := v_imap -> r_child.question_key;

          for r_bound in
            select b.bound_rule_type as rt, b.bound_message as msg
            from app.item_bound_violations(
              r_child.item_type, r_child.config, r_child.label, v_value) b
          loop
            e_item_id := r_child.id;
            e_group_instance_id := r_instance.id;
            e_rule_id := null;
            e_rule_type := r_bound.rt;
            e_severity := 'error';
            e_message := r_bound.msg;
            return next;
          end loop;

          select exists (
            select 1 from public.form_item_validations v
            where v.item_id = r_child.id and v.rule_type = 'unique_within_group'
          ) into v_needs_peers;

          if v_needs_peers then
            select coalesce(jsonb_agg(x.pv), '[]'::jsonb) into v_peers
            from (
              select m.value -> r_child.question_key as pv
              from jsonb_each(v_maps) m
              where m.key <> r_instance.id::text
            ) x
            where x.pv is not null and x.pv <> 'null'::jsonb;
          else
            v_peers := '[]'::jsonb;
          end if;

          for r_rule in
            select v.id, v.rule_type as rt, v.config as cfg,
                   v.severity as sev, v.message as msg
            from public.form_item_validations v
            where v.item_id = r_child.id
            order by v.position, v.id
          loop
            -- `v_imap`, not `v_answers`: `datetime_order` must resolve its
            -- sibling IN THIS INSTANCE (FF-1 ruling 2).
            if not app.eval_validation(
                 r_rule.rt, r_rule.cfg, v_value, v_imap, v_peers) then
              e_item_id := r_child.id;
              e_group_instance_id := r_instance.id;
              e_rule_id := r_rule.id;
              e_rule_type := r_rule.rt;
              e_severity := r_rule.sev;
              e_message := r_rule.msg;
              return next;
            end if;
          end loop;
        end loop;
      end loop;
    end loop;
  end loop;
end;
$$;

comment on function app.response_validation_errors(uuid) is
  'FF-3 (ADR 0090 §3): every violation on a response, error and warn alike, in '
  'document order — authored form_item_validations rules AND the legacy '
  'form_items.config bounds (rule_id null). THE predicate: public.'
  'get_response_validation_errors reads it and submit_response gates on it, so the '
  'list the user sees and the gate that blocks them cannot disagree.';

-- ---------------------------------------------------------------------------
-- 3 · The public read path.
--
--     INVOKER, gated by an RLS-evaluated probe on `responses`. That makes it
--     exactly as strong as the `responses` SELECT policy — neither weaker nor
--     stronger, which is the rule a door displacing RLS has to satisfy. Anyone
--     who can read the response can already read its answers and its version's
--     validations, so the DEFINER walker behind it grants nothing extra.
-- ---------------------------------------------------------------------------

create or replace function public.get_response_validation_errors(p_response_id uuid)
returns table (
  item_id uuid,
  group_instance_id uuid,
  rule_id uuid,
  rule_type text,
  severity text,
  message text
)
language plpgsql
stable
set search_path to 'public', 'pg_catalog'
as $$
begin
  -- RLS decides. A caller who cannot see the response gets the empty set, never
  -- another response's errors.
  if not exists (select 1 from public.responses r where r.id = p_response_id) then
    return;
  end if;

  if not app.feature_enabled('item_validations') then
    return;
  end if;

  return query
    select v.e_item_id, v.e_group_instance_id, v.e_rule_id,
           v.e_rule_type, v.e_severity, v.e_message
    from app.response_validation_errors(p_response_id) v;
end;
$$;

revoke all on function public.get_response_validation_errors(uuid) from public;
grant execute on function public.get_response_validation_errors(uuid) to authenticated;

comment on function public.get_response_validation_errors(uuid) is
  'FF-3 (ADR 0090 §3): the error surface the wizard places inline. INVOKER — the '
  'RLS-evaluated probe on responses is the read gate. Empty when the flag is off.';

-- ---------------------------------------------------------------------------
-- 4 · submit_response — `required_if` in both arms (B4a) + the HC0P9 gate.
-- ---------------------------------------------------------------------------

create or replace function public.submit_response(p_response_id uuid)
returns public.responses
language plpgsql
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_response public.responses;
  v_eff jsonb;
  r_section record;
  r_item record;
  r_child record;
  r_instance record;
  v_visible boolean;
  v_missing boolean;
  v_signoff_exists boolean;
  v_result public.responses;
  v_hidden_containers uuid[] := '{}';
  v_kept integer;
  v_min integer;
  v_imap jsonb;
  v_validations_on boolean;
  v_verr text;
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

  v_eff := app.answer_map(p_response_id);
  v_validations_on := app.feature_enabled('item_validations');

  perform set_config('app.in_submit_rpc', 'on', true);

  for r_section in
    select s.id, s.position, s.visible_when, s.requires_signoff
    from public.form_sections s
    where s.form_version_id = v_response.form_version_id
    order by s.position
  loop
    v_visible := app.eval_visibility(r_section.visible_when, v_eff);

    if not v_visible then
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

    v_hidden_containers := '{}';

    for r_item in
      select i.id, i.position, i.item_type, i.question_key, i.label,
             i.required, i.required_if, i.config, i.visible_when, i.parent_item_id,
             p.item_type as parent_type
      from public.form_items i
      left join public.form_items p on p.id = i.parent_item_id
      where i.section_id = r_section.id
      order by i.position
    loop
      if r_item.parent_type = 'repeating_group' then
        continue;
      end if;

      if r_item.parent_item_id is not null
         and r_item.parent_item_id = any (v_hidden_containers) then
        delete from public.answers a
        where a.response_id = p_response_id and a.item_id = r_item.id;
        if r_item.question_key is not null then
          v_eff := v_eff - r_item.question_key;
        end if;
        continue;
      end if;

      -- ---- CONTAINERS ----
      if r_item.item_type = any (array['group','repeating_group']) then
        if not app.eval_visibility(r_item.visible_when, v_eff) then
          v_hidden_containers := v_hidden_containers || r_item.id;
          delete from public.response_group_instances gi
          where gi.response_id = p_response_id and gi.group_item_id = r_item.id;
          continue;
        end if;

        if r_item.item_type = 'group' then
          continue;
        end if;

        delete from public.response_group_instances gi
        where gi.response_id = p_response_id
          and gi.group_item_id = r_item.id
          and app.instance_is_empty(p_response_id, gi.id);

        set constraints public.response_group_instances_parent_position_uniq deferred;
        update public.response_group_instances gi
        set position = packed.new_position
        from (
          select id, (row_number() over (order by position) - 1)::integer as new_position
          from public.response_group_instances
          where response_id = p_response_id and group_item_id = r_item.id
        ) packed
        where gi.id = packed.id and gi.position <> packed.new_position;
        set constraints public.response_group_instances_parent_position_uniq immediate;

        select count(*) into v_kept
        from public.response_group_instances gi
        where gi.response_id = p_response_id and gi.group_item_id = r_item.id;

        v_min := app.item_cardinality(r_item.config, 'minInstances');
        if v_min is not null and v_kept < v_min then
          raise exception 'o bloco "%" exige ao menos % item(ns) preenchido(s)',
            coalesce(r_item.label, '(sem título)'), v_min
            using errcode = 'HC0N5';
        end if;

        for r_instance in
          select gi.id from public.response_group_instances gi
          where gi.response_id = p_response_id and gi.group_item_id = r_item.id
          order by gi.position
        loop
          v_imap := app.instance_answer_map(p_response_id, r_instance.id);

          for r_child in
            select c.id, c.item_type, c.question_key, c.label, c.required,
                   c.required_if, c.config, c.visible_when
            from public.form_items c
            where c.parent_item_id = r_item.id
              and c.question_key is not null
            order by c.position
          loop
            if not app.eval_visibility(r_child.visible_when, v_imap) then
              delete from public.answers a
              where a.response_id = p_response_id
                and a.item_id = r_child.id
                and a.group_instance_id = r_instance.id;
              continue;
            end if;

            -- FF-3: required_if against THIS INSTANCE's map. Unreachable for a
            -- child hidden in this instance — the `continue` above already left.
            if app.item_is_required(
                 r_child.required,
                 case when v_validations_on then r_child.required_if else null end,
                 v_imap) then
              select not app.item_required_satisfied(
                       p_response_id, r_child.id, r_child.item_type, r_instance.id)
                into v_missing;

              if v_missing then
                raise exception 'há perguntas obrigatórias sem resposta'
                  using errcode = 'HC011';
              end if;
            end if;

            perform app.assert_item_bounds(
              p_response_id, r_child.id, r_child.item_type, r_child.config,
              r_child.label, r_instance.id
            );
          end loop;
        end loop;

        continue;
      end if;

      -- ---- FLAT ARM: input items only (display items carry a NULL key). ----
      if r_item.question_key is null then
        continue;
      end if;

      if not app.eval_visibility(r_item.visible_when, v_eff) then
        delete from public.answers a
        where a.response_id = p_response_id and a.item_id = r_item.id;
        v_eff := v_eff - r_item.question_key;
        continue;
      end if;

      -- FF-3: visibility already decided above (the hiding branch `continue`s),
      -- so this is only reached for a VISIBLE item.
      if app.item_is_required(
           r_item.required,
           case when v_validations_on then r_item.required_if else null end,
           v_eff) then
        select not app.item_required_satisfied(
                 p_response_id, r_item.id, r_item.item_type, null)
          into v_missing;

        if v_missing then
          raise exception 'há perguntas obrigatórias sem resposta'
            using errcode = 'HC011';
        end if;
      end if;

      perform app.assert_item_bounds(
        p_response_id, r_item.id, r_item.item_type, r_item.config, r_item.label, null
      );
    end loop;

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

  -- ---- FF-3: the `error`-severity validation gate. ----
  -- Placed AFTER the section loop on purpose: by here every hidden item's answer
  -- is deleted and every empty instance pruned, so the walker's own
  -- `app.answer_map` re-read matches `v_eff` and the two agree on what is
  -- visible. Running it earlier would report violations on fields the loop is
  -- about to clear.
  --
  -- `e_rule_id is not null` restricts the gate to the AUTHORED-rule lane. Config
  -- bounds have already raised HC061 inside the loop above, so they can never
  -- reach here; the filter says so out loud rather than leaving the reader to
  -- deduce it. `warn` never blocks, anywhere (ADR 0090 §3).
  if v_validations_on then
    select ve.e_message into v_verr
    from app.response_validation_errors(p_response_id) ve
    where ve.e_severity = 'error'
      and ve.e_rule_id is not null
    limit 1;

    if v_verr is not null then
      -- The author's own pt-BR message, so the filler is told WHICH rule failed.
      -- Rendered as TEXT by the client (Rule 7 — never as markup).
      raise exception '%', v_verr using errcode = 'HC0P9';
    end if;
  end if;

  update public.responses
  set status = 'submitted', submitted_at = now(), updated_at = now()
  where id = p_response_id
  returning * into v_result;

  perform set_config('app.in_submit_rpc', 'off', true);

  return v_result;
end;
$$;

commit;
