-- FF-2 (ADR 0089 §A + ruling 3) — completeness and emptiness learn about matrices.
--
-- Two distinct problems, deliberately in one migration because fixing either
-- alone leaves the feature broken in a different direction:
--
--   §A  `app.instance_is_empty` decides presence from exactly two facts — a
--       non-null `answers.value`, or an `answer_selected_options` row. A matrix
--       answer's payload lives in `answer_matrix_cells` / `answer_risk_matrix`
--       with `answers.value` NULL. So the moment the writers ship, a
--       repeating-group instance whose only content is a filled matrix is judged
--       EMPTY, `submit_response` DELETES it, and the cells follow through
--       ON DELETE CASCADE. That is silent data destruction, not a missing
--       nicety, and it is the same class as FF-1's P0-1.
--
--   ruling 3  A required matrix means ROW-COMPLETE. Without the arm below the
--       relaxed CHECK from ...000000 would be a trap: `required = true` becomes
--       legal, and then can NEVER be satisfied, because the presence test only
--       looks for a scalar value or a selection.
--
-- ⚠ THE FOUR-COPY PROBLEM. The presence test was written out inline FOUR times:
-- flat + per-instance in `submit_response`, flat + per-instance in
-- `app.response_required_complete`. Adding a matrix arm to three of the four is
-- an entirely plausible way to ship a bug that no test distinguishes from the
-- fix. So the four copies collapse into ONE predicate,
-- `app.item_required_satisfied`, and the callers dispatch to it. For the eight
-- scalar/choice types the new predicate is behaviour-identical to the code it
-- replaces (`is not distinct from` covers both the `is null` top-level probe and
-- the `= instance_id` per-instance probe).

-- ---------------------------------------------------------------------------
-- §A · emptiness. Two new arms, matching the shape of the two that exist.
-- ---------------------------------------------------------------------------
create or replace function app.instance_is_empty(p_response_id uuid, p_instance_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
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
    -- FF-2 (ADR 0089 §A): a matrix answer is content. Without this arm
    -- submit_response prunes the instance and cascades the cells away.
    or exists (
      select 1
      from public.answer_matrix_cells c
      join public.answers a on a.id = c.answer_id
      where a.response_id = p_response_id
        and a.group_instance_id = p_instance_id
    )
    or exists (
      select 1
      from public.answer_risk_matrix rm
      join public.answers a on a.id = rm.answer_id
      where a.response_id = p_response_id
        and a.group_instance_id = p_instance_id
    )
    -- FF-5 must add the identical arm for `answer_references`; the blindness is
    -- structural, not matrix-specific.
  );
$function$;

-- ---------------------------------------------------------------------------
-- The single presence/completeness predicate.
--
-- SECURITY DEFINER + STABLE, matching its siblings (`instance_is_empty`,
-- `answer_map`, `instance_answer_map`). It is a read-only predicate over one
-- response; running it as the owner makes the verdict independent of which
-- read policy the caller happens to satisfy, so `submit_response` (INVOKER) and
-- `response_required_complete` (DEFINER) can never disagree about the same
-- response — which is exactly the drift this consolidation exists to kill.
-- No authority is conferred: it returns a boolean and reveals nothing a caller
-- could not already read about their own draft.
-- ---------------------------------------------------------------------------
create or replace function app.item_required_satisfied(
  p_response_id uuid,
  p_item_id uuid,
  p_item_type text,
  p_instance_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select case
    -- ROW-COMPLETE (ADR 0089 ruling 3): every row of the grid has a cell. The
    -- weaker "at least one cell anywhere" reading would let a 20-row checklist
    -- satisfy `required` with a single tick.
    --
    -- Axis rows carry no visibility conditions, so "every VISIBLE row" reduces
    -- to "every row". Item visibility still wins, and is applied by the CALLERS
    -- before they ever reach this predicate.
    --
    -- The `exists (rows)` guard is load-bearing: without it a grid with zero
    -- rows would vacuously satisfy `not exists (row without a cell)` and report
    -- complete. (validate_matrix_axes prevents publishing one, so this is the
    -- draft-fill belt to that braces.)
    when p_item_type = 'matrix' then (
      exists (
        select 1 from public.form_matrix_rows r where r.item_id = p_item_id
      )
      and not exists (
        select 1
        from public.form_matrix_rows r
        where r.item_id = p_item_id
          and not exists (
            select 1
            from public.answer_matrix_cells c
            join public.answers a on a.id = c.answer_id
            where a.response_id = p_response_id
              and a.item_id = p_item_id
              and a.group_instance_id is not distinct from p_instance_id
              and c.row_id = r.id
          )
      )
    )

    -- A risk_matrix is complete when its single answer row exists (ADR 0089
    -- ruling 3, final clause).
    when p_item_type = 'risk_matrix' then exists (
      select 1
      from public.answer_risk_matrix rm
      join public.answers a on a.id = rm.answer_id
      where a.response_id = p_response_id
        and a.item_id = p_item_id
        and a.group_instance_id is not distinct from p_instance_id
    )

    -- The eight scalar/choice types — byte-for-byte the test that was inlined
    -- in four places before this migration.
    else (
      exists (
        select 1 from public.answers a
        where a.response_id = p_response_id
          and a.item_id = p_item_id
          and a.group_instance_id is not distinct from p_instance_id
          and a.value is not null
          and a.value <> 'null'::jsonb
      )
      or exists (
        select 1
        from public.answer_selected_options s
        join public.answers a on a.id = s.answer_id
        where a.response_id = p_response_id
          and a.item_id = p_item_id
          and a.group_instance_id is not distinct from p_instance_id
      )
    )
  end;
$function$;

comment on function app.item_required_satisfied(uuid, uuid, text, uuid) is
  'FF-2 (ADR 0089 ruling 3): the ONE definition of "this required item is answered", for both the flat and the per-instance loops of submit_response and app.response_required_complete. matrix = row-complete; risk_matrix = its answer row exists; every other type = a non-null scalar value or at least one selection. Callers apply visibility BEFORE calling — a hidden item is never asked.';

-- ---------------------------------------------------------------------------
-- `app.response_required_complete` — flat arm + per-instance arm dispatch to the
-- predicate. Everything else is the current catalog body verbatim.
-- ---------------------------------------------------------------------------
create or replace function app.response_required_complete(p_response_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
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
      -- FF-2: one predicate for all types, including the matrix row-complete arm.
      and not app.item_required_satisfied(p_response_id, i.id, i.item_type, null);

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
          -- FF-2: same predicate, scoped to THIS instance.
          and not app.item_required_satisfied(p_response_id, c.id, c.item_type, r_instance.id);

        if v_missing > 0 then
          return false;
        end if;
      end loop;
    end loop;
  end loop;

  return true;
end;
$function$;

-- ---------------------------------------------------------------------------
-- `submit_response` — the AUTHORITY (Architecture Rule 3). Its two required
-- checks dispatch to the same predicate.
--
-- Note this function is where the deadlock-negative rule actually holds: a
-- hidden section `continue`s before any item is examined, a hidden container
-- adds itself to v_hidden_containers, and a hidden item is deleted and skipped —
-- so a required matrix inside any of them is never asked for. That is inherited
-- structure, not new code, but ADR 0089 ruling 3 requires it be re-proven per
-- arm rather than assumed, which is what the deadlock-negative keystone does.
--
-- Body is the current catalog text verbatim apart from the two dispatch sites.
-- ---------------------------------------------------------------------------
create or replace function public.submit_response(p_response_id uuid)
returns public.responses
language plpgsql
set search_path to 'public', 'pg_catalog'
as $function$
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
      -- AND matrix cells cascade via the answer_id FK) + any group instances,
      -- then drop its keys.
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
        --
        -- FF-2 (ADR 0089 §A): `instance_is_empty` now counts matrix answers, so an
        -- instance holding ONLY a filled matrix survives this delete.
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
              -- FF-2: one predicate, scoped to THIS instance.
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
        -- Hidden item: clear its answer (selections + matrix cells cascade) +
        -- drop its key.
        delete from public.answers a
        where a.response_id = p_response_id and a.item_id = r_item.id;
        v_eff := v_eff - r_item.question_key;
        continue;
      end if;

      -- Visible & required: dispatch to the one presence/completeness predicate.
      if r_item.required then
        select not app.item_required_satisfied(
                 p_response_id, r_item.id, r_item.item_type, null)
          into v_missing;

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
$function$;
