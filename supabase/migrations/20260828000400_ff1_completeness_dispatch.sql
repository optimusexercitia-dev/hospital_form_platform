-- FF-1 · BE-5 — the dispatch-by-item_type refactor of BOTH completeness
--                authorities, plus ruling 3 (prune-then-check).
--
-- THERE ARE TWO AUTHORITIES, AND THEY ARE SEPARATE IMPLEMENTATIONS.
-- `submit_response` INLINES its own required-check; it does NOT call
-- `app.response_required_complete`. Confirmed live at phase start. So both must
-- be refactored together, and their AGREEMENT is itself a gate keystone
-- (`completeness_authorities_agree`) — `list_signoff_queue` and
-- `compute_due_notifications` gate on the shared one, `submit_response` on its
-- own, and a drift between them means the wizard offers a submit that then fails
-- (or worse, hides one that would have succeeded).
--
-- THE FLAT-ARM PREDICATE (ADR 0087 Amendment 1.2). Substrate correction 4 said
-- to exclude `parent_item_id IS NOT NULL` from the flat arm. That is TOO BROAD:
-- ruling 6 makes a plain `group`'s children TOP-LEVEL answerers, so excluding
-- every child would stop enforcing `required` on them entirely — a silent
-- under-enforcement that raises no error and that no keystone in the original
-- §Gate would have caught. The correct predicate is "has no `repeating_group`
-- ancestor", which under the depth-1 cap (ruling 1) is exactly
--   parent_item_id IS NULL OR parent.item_type = 'group'
-- and `plain_group_child_required_blocks` is the keystone that pins it.
--
-- RULING 3 — a fully-empty instance is NOT incomplete, it is NOT THERE.
--   · `submit_response` PRUNES zero-answer instances, then re-packs positions,
--     then enforces `minInstances` on WHAT REMAINS. Submitted data therefore
--     carries no phantom rows, and none reach FF-1's explode-by-child-key
--     aggregation (where each would become an empty row in every dashboard).
--   · `app.response_required_complete` is STABLE and CANNOT write, so it SKIPS
--     empty instances instead. Same verdict, different mechanism — which is
--     precisely why the two need a shared emptiness definition
--     (`app.instance_is_empty`) rather than two copies of the test.
--
-- SQLSTATE: HC0N5 for unmet `minInstances`, DELIBERATELY DISTINCT from HC011
-- ("há perguntas obrigatórias sem resposta"). Distinct codes are what stop a
-- keystone from passing for the wrong reason: "submit was blocked" is not
-- evidence unless it was blocked by the rule under test.

-- ---------------------------------------------------------------------------
-- 1 · The ONE emptiness definition, shared by both authorities.
--     Reuses the exact test app.response_required_complete already applies to a
--     single item: no answers row with a non-null, non-'null'::jsonb value, and
--     no answer_selected_options row.
-- ---------------------------------------------------------------------------
create or replace function app.instance_is_empty(
  p_response_id uuid,
  p_instance_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select not (
    exists (
      select 1 from public.answers a
      where a.response_id = p_response_id
        and a.group_instance_id = p_instance_id
        and a.value is not null
        and a.value <> 'null'::jsonb
    )
    or exists (
      select 1
      from public.answer_selected_options s
      join public.answers a on a.id = s.answer_id
      where a.response_id = p_response_id
        and a.group_instance_id = p_instance_id
    )
  );
$$;

comment on function app.instance_is_empty(uuid, uuid) is
  'FF-1 (ADR 0087 ruling 3): true when a repeating-group instance holds no answer at all. The SINGLE emptiness definition — submit_response PRUNES on it, app.response_required_complete (STABLE, cannot write) SKIPS on it. Two mechanisms, one test, so the two authorities cannot disagree about what "empty" means.';

-- ---------------------------------------------------------------------------
-- 2 · assert_item_bounds gains instance scoping (ADR 0087 Amendment 1.3).
--     It selected by (response_id, item_id) alone, so with N instances the
--     `select … into` silently bounds-checked ONE arbitrary instance's answer.
--     Signature changes → DROP + CREATE (a defaulted extra arg would leave two
--     overloads and make the 5-arg call ambiguous). Sole caller is
--     submit_response, recreated in §4 below.
-- ---------------------------------------------------------------------------
drop function if exists app.assert_item_bounds(uuid, uuid, text, jsonb, text);

create function app.assert_item_bounds(
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
  v_min jsonb;
  v_max jsonb;
  v_text text;
  v_len integer;
  v_min_len jsonb;
  v_max_len jsonb;
begin
  if p_config is null then
    return;
  end if;

  -- ---- free_text / short_text length bounds ----
  if p_item_type = any (array['free_text', 'short_text']) then
    v_min_len := p_config -> 'minLength';
    v_max_len := p_config -> 'maxLength';
    if v_min_len is null and v_max_len is null then
      return;
    end if;

    select a.value #>> '{}' into v_text
    from public.answers a
    where a.response_id = p_response_id and a.item_id = p_item_id
      and a.group_instance_id is not distinct from p_group_instance_id;

    -- Only enforce when an answer is present (a blank non-required field is owned
    -- by the required check, not bounds).
    if v_text is null or btrim(v_text) = '' then
      return;
    end if;
    v_len := char_length(v_text);

    if v_min_len is not null and jsonb_typeof(v_min_len) = 'number'
       and v_len < (v_min_len)::text::integer then
      raise exception 'a pergunta "%" exige ao menos % caractere(s)',
        coalesce(p_label, '(sem rótulo)'), (v_min_len #>> '{}')
        using errcode = 'HC061';
    end if;
    if v_max_len is not null and jsonb_typeof(v_max_len) = 'number'
       and v_len > (v_max_len)::text::integer then
      raise exception 'a pergunta "%" aceita no máximo % caractere(s)',
        coalesce(p_label, '(sem rótulo)'), (v_max_len #>> '{}')
        using errcode = 'HC061';
    end if;
    return;
  end if;

  if p_item_type <> all (array['number','date']) then
    return;
  end if;

  select a.value into v_value
  from public.answers a
  where a.response_id = p_response_id and a.item_id = p_item_id
    and a.group_instance_id is not distinct from p_group_instance_id;

  if v_value is null or v_value = 'null'::jsonb then
    return;
  end if;

  v_min := p_config -> 'min';
  v_max := p_config -> 'max';

  if p_item_type = 'number' then
    if v_min is not null and jsonb_typeof(v_min) = 'number'
       and jsonb_typeof(v_value) = 'number'
       and (v_value)::text::numeric < (v_min)::text::numeric then
      raise exception 'a pergunta "%" exige um valor maior ou igual a %',
        coalesce(p_label, '(sem rótulo)'), (v_min #>> '{}')
        using errcode = 'HC061';
    end if;
    if v_max is not null and jsonb_typeof(v_max) = 'number'
       and jsonb_typeof(v_value) = 'number'
       and (v_value)::text::numeric > (v_max)::text::numeric then
      raise exception 'a pergunta "%" exige um valor menor ou igual a %',
        coalesce(p_label, '(sem rótulo)'), (v_max #>> '{}')
        using errcode = 'HC061';
    end if;
  else -- 'date' — text compare on ISO YYYY-MM-DD
    if v_min is not null and jsonb_typeof(v_min) = 'string'
       and (v_value #>> '{}') < (v_min #>> '{}') then
      raise exception 'a pergunta "%" exige uma data a partir de %',
        coalesce(p_label, '(sem rótulo)'), (v_min #>> '{}')
        using errcode = 'HC061';
    end if;
    if v_max is not null and jsonb_typeof(v_max) = 'string'
       and (v_value #>> '{}') > (v_max #>> '{}') then
      raise exception 'a pergunta "%" exige uma data até %',
        coalesce(p_label, '(sem rótulo)'), (v_max #>> '{}')
        using errcode = 'HC061';
    end if;
  end if;
end;
$$;

comment on function app.assert_item_bounds(uuid, uuid, text, jsonb, text, uuid) is
  'Config min/max + length bounds for one answered item. FF-1 adds p_group_instance_id: the read was unscoped, so with repeating groups it bounds-checked one arbitrary instance (ADR 0087 Amendment 1.3).';

-- ---------------------------------------------------------------------------
-- 3 · app.response_required_complete — dispatch refactor + group arm.
-- ---------------------------------------------------------------------------
create or replace function app.response_required_complete(p_response_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_version_id uuid;
  v_answers jsonb;
  r_section record;
  r_group record;
  r_instance record;
  v_missing integer;
  v_kept integer;
  v_min integer;
  v_imap jsonb;
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

    -- ---- FLAT ARM: top-level items + PLAIN-`group` children (ruling 6), which
    -- answer at top level exactly like flat items. Items under a REPEATING group
    -- are excluded here and handled per-instance in the group arm below. ----
    select count(*) into v_missing
    from public.form_items i
    left join public.form_items p on p.id = i.parent_item_id
    where i.section_id = r_section.id
      and i.required = true
      and i.question_key is not null
      and (i.parent_item_id is null or p.item_type = 'group')
      -- A per-item visibility condition can hide a required item; honour it.
      -- (Reachable for the first time in FF-1: the CHECK that made this
      -- combination unconstructible was dropped by ruling 4.)
      and app.eval_visibility(i.visible_when, v_answers)
      -- A child of a hidden PLAIN group is hidden with it.
      and (i.parent_item_id is null
           or app.eval_visibility(p.visible_when, v_answers))
      and not (
        exists (
          select 1 from public.answers a
          where a.response_id = p_response_id
            and a.item_id = i.id
            and a.group_instance_id is null
            and a.value is not null
            and a.value <> 'null'::jsonb
        )
        or exists (
          select 1
          from public.answer_selected_options s
          join public.answers a on a.id = s.answer_id
          where a.response_id = p_response_id
            and a.item_id = i.id
            and a.group_instance_id is null
        )
      );

    if v_missing > 0 then
      return false;
    end if;

    -- ---- GROUP ARM: each REPEATING group of this section. ----
    for r_group in
      select i.id, i.visible_when, i.config
      from public.form_items i
      where i.section_id = r_section.id
        and i.item_type = 'repeating_group'
      order by i.position
    loop
      -- A hidden group requires nothing — visibility wins (ruling 3, settled by
      -- precedent). minInstances is NOT checked for a group the author cannot see.
      if not app.eval_visibility(r_group.visible_when, v_answers) then
        continue;
      end if;

      -- Ruling 3: count only NON-EMPTY instances. This function is STABLE and
      -- cannot prune, so it skips what submit_response deletes — same verdict.
      select count(*) into v_kept
      from public.response_group_instances gi
      where gi.response_id = p_response_id
        and gi.group_item_id = r_group.id
        and not app.instance_is_empty(p_response_id, gi.id);

      v_min := app.item_cardinality(r_group.config, 'minInstances');
      if v_min is not null and v_kept < v_min then
        return false;
      end if;

      for r_instance in
        select gi.id
        from public.response_group_instances gi
        where gi.response_id = p_response_id
          and gi.group_item_id = r_group.id
          and not app.instance_is_empty(p_response_id, gi.id)
        order by gi.position
      loop
        -- Ruling 2: the resolved map for THIS instance — top-level ⊕ instance,
        -- instance wins, a sibling this instance did not answer stays ABSENT.
        v_imap := app.instance_answer_map(p_response_id, r_instance.id);

        select count(*) into v_missing
        from public.form_items c
        where c.parent_item_id = r_group.id
          and c.required = true
          and c.question_key is not null
          and app.eval_visibility(c.visible_when, v_imap)
          and not (
            exists (
              select 1 from public.answers a
              where a.response_id = p_response_id
                and a.item_id = c.id
                and a.group_instance_id = r_instance.id
                and a.value is not null
                and a.value <> 'null'::jsonb
            )
            or exists (
              select 1
              from public.answer_selected_options s
              join public.answers a on a.id = s.answer_id
              where a.response_id = p_response_id
                and a.item_id = c.id
                and a.group_instance_id = r_instance.id
            )
          );

        if v_missing > 0 then
          return false;
        end if;
      end loop;
    end loop;
  end loop;

  return true;
end;
$$;

comment on function app.response_required_complete(uuid) is
  'Whether every required, VISIBLE input of a response is answered. FF-1: dispatch-by-item_type — a flat arm (top-level + plain-`group` children, ruling 6) and a repeating-group arm (minInstances over NON-EMPTY instances, then per-instance children against the instance-resolved map). Must agree with submit_response''s inlined check; they are separate implementations and `completeness_authorities_agree` pins them.';

-- ---------------------------------------------------------------------------
-- 4 · submit_response — the same dispatch, plus ruling 3's PRUNE.
-- ---------------------------------------------------------------------------
create or replace function public.submit_response(p_response_id uuid)
returns public.responses
language plpgsql
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_response public.responses;
  v_eff jsonb;          -- effective answer map (question_key -> value), forward pass
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

  -- Effective map starts from the saved TOP-LEVEL answers (app.answer_map is
  -- instance-free as of FF-1); we DROP hidden items'/sections' keys as we walk in
  -- document order. Repeating-group child keys are never in here — they are
  -- instance-scoped and resolved per instance below.
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

    v_hidden_containers := '{}';

    -- FF-1: iterate EVERY item of the section in position order and dispatch by
    -- item_type. The old loop filtered `question_key is not null`, which now
    -- excludes containers entirely (they carry a NULL key by BE-1's shape CHECK)
    -- — a hidden group's instances would never be cleaned and minInstances would
    -- never be checked. Contiguity (app.validate_group_layout) guarantees a
    -- container is visited BEFORE its children, which is what makes the
    -- v_hidden_containers propagation below sound.
    for r_item in
      select i.id, i.position, i.item_type, i.question_key, i.label,
             i.required, i.config, i.visible_when, i.parent_item_id,
             p.item_type as parent_type
      from public.form_items i
      left join public.form_items p on p.id = i.parent_item_id
      where i.section_id = r_section.id
      order by i.position
    loop
      -- ---- children of a REPEATING group: handled inside the container's own
      -- branch, never as flat items. ----
      if r_item.parent_type = 'repeating_group' then
        continue;
      end if;

      -- ---- a child of a container we already found hidden ----
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
          -- A hidden repeating group loses its instances (answers cascade); a
          -- hidden plain group's children are cleaned as they are visited.
          delete from public.response_group_instances gi
          where gi.response_id = p_response_id and gi.group_item_id = r_item.id;
          continue;
        end if;

        -- A plain `group` is a pure visual container (ruling 6): nothing more to
        -- do — its children answer top-level and are visited as flat items.
        if r_item.item_type = 'group' then
          continue;
        end if;

        -- ---- REPEATING GROUP: prune, then check. ----
        -- Ruling 3: a fully-empty instance is not incomplete, it is NOT THERE.
        -- Pruning FIRST is what turns "campo obrigatório" pointing into a blank
        -- row the user never meant to create (whose real fix is "remove the row",
        -- which is not what the message says) into an accurate "adicione ao menos
        -- N" — and keeps phantom rows out of the explode-by-child-key aggregation.
        delete from public.response_group_instances gi
        where gi.response_id = p_response_id
          and gi.group_item_id = r_item.id
          and app.instance_is_empty(p_response_id, gi.id);

        -- Re-pack the survivors to a contiguous 0..n-1 (the constraint is
        -- deferrable as of BE-1; force the check back before leaving).
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
                   c.config, c.visible_when
            from public.form_items c
            where c.parent_item_id = r_item.id
              and c.question_key is not null
            order by c.position
          loop
            if not app.eval_visibility(r_child.visible_when, v_imap) then
              -- Hidden IN THIS INSTANCE: clear only this instance's answer.
              delete from public.answers a
              where a.response_id = p_response_id
                and a.item_id = r_child.id
                and a.group_instance_id = r_instance.id;
              continue;
            end if;

            if r_child.required then
              select not (
                exists (
                  select 1 from public.answers a
                  where a.response_id = p_response_id
                    and a.item_id = r_child.id
                    and a.group_instance_id = r_instance.id
                    and a.value is not null
                    and a.value <> 'null'::jsonb
                )
                or exists (
                  select 1
                  from public.answer_selected_options s
                  join public.answers a on a.id = s.answer_id
                  where a.response_id = p_response_id
                    and a.item_id = r_child.id
                    and a.group_instance_id = r_instance.id
                )
              ) into v_missing;

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
        -- Hidden item: clear its answer (selections cascade) + drop its key.
        delete from public.answers a
        where a.response_id = p_response_id and a.item_id = r_item.id;
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
              and a.group_instance_id is null
              and a.value is not null
              and a.value <> 'null'::jsonb
          )
          or exists (
            select 1
            from public.answer_selected_options s
            join public.answers a on a.id = s.answer_id
            where a.response_id = p_response_id
              and a.item_id = r_item.id
              and a.group_instance_id is null
          )
        ) into v_missing;

        if v_missing then
          raise exception 'há perguntas obrigatórias sem resposta'
            using errcode = 'HC011';
        end if;
      end if;

      -- Visible number/date: enforce config min/max (present answer only).
      perform app.assert_item_bounds(
        p_response_id, r_item.id, r_item.item_type, r_item.config, r_item.label, null
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

comment on function public.submit_response(uuid) is
  'The submission authority (Rule 3). FF-1: dispatch-by-item_type over EVERY item of a section (containers carry a NULL question_key, so the old key-filtered loop would have skipped them), prune-then-check for repeating groups (ruling 3), per-instance child evaluation against the instance-resolved map (ruling 2), and HC0N5 for unmet minInstances — distinct from HC011 so a keystone cannot pass for the wrong reason.';
