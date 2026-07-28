-- FF-3 (ADR 0090) — B6a: publish-time validation of required_if.
--
-- A MISSING ARM, found while writing the keystones. public.validate_visible_when
-- (called by publish_form_version) validated only visible_when: existence of the
-- referenced key, the earlier-question rule, FF-1 outside-in ban, operator/target
-- coherence and choice-code existence. required_if is evaluated by the SAME
-- evaluator against the SAME maps and inherited NONE of them.
--
-- The consequence is fail-open and invisible: a top-level item whose required_if
-- points at a repeating-group child resolves that key against the top-level map,
-- where it is ABSENT, so eval_condition returns false and the item is never
-- required. Nothing raises, nothing logs, and a test that only checks "does an
-- unmet required_if block a submit" passes.
--
-- Everything here is the shipped body with the item loop generalised over
-- (visible_when, required_if). The pt-BR text of every pre-existing failure is
-- unchanged: v_ctx reproduces the shipped subject byte-for-byte for the
-- visible_when arm, so the shipped pgTAP message assertions still pass.

begin;

CREATE OR REPLACE FUNCTION public.validate_visible_when(p_form_version_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  r record;            -- section with a condition
  ri record;           -- item with a condition
  rc record;           -- one sub-condition (jsonb)
  v_first_position integer;
  v_ref_min_position integer;
  v_op text;
  v_target_type text;  -- the referenced input's item_type
  v_dep_section integer;
  v_dep_item integer;
  v_ref_section integer;
  v_ref_item integer;
  v_ref_key text;
  v_ref_group uuid;    -- FF-1: the REPEATING group owning the referenced key, or null
  v_dep_group uuid;    -- FF-1: the REPEATING group owning the referencing item, or null
  v_ref_label text;
  v_ctx text;          -- FF-3: the pt-BR subject of every message in the item loop
begin
  select min(position) into v_first_position
  from public.form_sections
  where form_version_id = p_form_version_id;

  -- ---- SECTION conditions (single OR group). ----
  for r in
    select id, position, title, visible_when
    from public.form_sections
    where form_version_id = p_form_version_id
      and visible_when is not null
    order by position
  loop
    if r.position = v_first_position then
      raise exception
        'a primeira seção não pode ter condição de visibilidade (seção "%")',
        coalesce(r.title, '(padrão)')
        using errcode = 'check_violation';
    end if;

    for rc in select cond from app.visibility_conditions(r.visible_when) cond loop
      v_op := rc.cond ->> 'op';
      v_ref_key := rc.cond ->> 'question_key';

      select min(s.position), max(i.item_type)
        into v_ref_min_position, v_target_type
      from public.form_items i
      join public.form_sections s on s.id = i.section_id
      where i.form_version_id = p_form_version_id
        and i.question_key = v_ref_key;

      if v_ref_min_position is null then
        raise exception
          'a condição da seção "%" referencia a pergunta "%", que não existe nesta versão',
          coalesce(r.title, '(padrão)'), v_ref_key
          using errcode = 'check_violation';
      end if;

      if v_ref_min_position >= r.position then
        raise exception
          'a condição da seção "%" deve referenciar uma pergunta de uma seção anterior',
          coalesce(r.title, '(padrão)')
          using errcode = 'check_violation';
      end if;

      -- FF-1 (ruling 2): a section is never inside a repeating group, so it can
      -- never be the "same group" — every repeating-group child is out of scope.
      select rg.id, coalesce(i.label, i.question_key)
        into v_ref_group, v_ref_label
      from public.form_items i
      join public.form_items rg on rg.id = i.parent_item_id
      where i.form_version_id = p_form_version_id
        and i.question_key = v_ref_key
        and rg.item_type = 'repeating_group'
      limit 1;

      if v_ref_group is not null then
        raise exception
          'a condição da seção "%" não pode depender de "%", que está dentro de um bloco repetível',
          coalesce(r.title, '(padrão)'), coalesce(v_ref_label, v_ref_key)
          using errcode = 'check_violation';
      end if;

      perform app.assert_condition_op_target(
        v_op, v_target_type, rc.cond -> 'value',
        format('a condição da seção "%s"', coalesce(r.title, '(padrão)'))
      );

      -- form-model-normalization: choice-target value codes must exist.
      perform app.assert_condition_value_codes(
        p_form_version_id, v_ref_key, v_target_type, rc.cond -> 'value',
        format('a condição da seção "%s"', coalesce(r.title, '(padrão)'))
      );
    end loop;
  end loop;

  -- ---- ITEM conditions: visible_when AND (FF-3) required_if. ----
  --
  -- FF-3 (ADR 0090 ruling 4) folded required_if into THIS loop rather than adding
  -- a second one, because every check below applies to it identically and the cost
  -- of missing one is silent: a required_if that references a repeating-group
  -- child from OUTSIDE the group resolves against a map where that key is absent,
  -- so eval_condition returns false and the item is simply NEVER required. It
  -- fails OPEN, and no test that only counts blocked submits would ever see it.
  -- visible_when has been protected from that since FF-1; a new conditional
  -- column must inherit the same arm.
  --
  -- kind orders visible_when (1) before required_if (2) so the pt-BR text of every
  -- pre-existing failure is byte-identical to what shipped.
  for ri in
    select i.id, i.label, i.question_key, x.rule, x.kind,
           s.position as section_position, i.position as item_position,
           case when p.item_type = 'repeating_group' then p.id else null end
             as repeating_group_id
    from public.form_items i
    join public.form_sections s on s.id = i.section_id
    left join public.form_items p on p.id = i.parent_item_id
    cross join lateral (
      values (i.visible_when, 1), (i.required_if, 2)
    ) as x(rule, kind)
    where i.form_version_id = p_form_version_id
      and x.rule is not null
    order by s.position, i.position, x.kind
  loop
    v_dep_section := ri.section_position;
    v_dep_item := ri.item_position;
    v_dep_group := ri.repeating_group_id;
    v_ctx := case
      when ri.kind = 1
        then format('a condição da pergunta "%s"', coalesce(ri.label, '(sem rótulo)'))
        else format('a condição de obrigatoriedade da pergunta "%s"',
                    coalesce(ri.label, '(sem rótulo)'))
    end;

    for rc in select cond from app.visibility_conditions(ri.rule) cond loop
      v_op := rc.cond ->> 'op';
      v_ref_key := rc.cond ->> 'question_key';

      select s.position, i.position, i.item_type
        into v_ref_section, v_ref_item, v_target_type
      from public.form_items i
      join public.form_sections s on s.id = i.section_id
      where i.form_version_id = p_form_version_id
        and i.question_key = v_ref_key
      order by s.position, i.position
      limit 1;

      if v_ref_section is null then
        raise exception '% referencia a pergunta "%", que não existe nesta versão',
          v_ctx, v_ref_key
          using errcode = 'check_violation';
      end if;

      if not (v_ref_section < v_dep_section
              or (v_ref_section = v_dep_section and v_ref_item < v_dep_item)) then
        raise exception '% deve referenciar uma pergunta anterior no formulário', v_ctx
          using errcode = 'check_violation';
      end if;

      -- FF-1 (ruling 2): inside-out resolves, outside-in is forbidden.
      select rg.id, coalesce(i.label, i.question_key)
        into v_ref_group, v_ref_label
      from public.form_items i
      join public.form_items rg on rg.id = i.parent_item_id
      where i.form_version_id = p_form_version_id
        and i.question_key = v_ref_key
        and rg.item_type = 'repeating_group'
      limit 1;

      if v_ref_group is not null and v_ref_group is distinct from v_dep_group then
        if v_dep_group is null then
          raise exception '% não pode depender de "%", que está dentro de um bloco repetível',
            v_ctx, coalesce(v_ref_label, v_ref_key)
            using errcode = 'check_violation';
        else
          raise exception '% só pode depender de perguntas do mesmo bloco repetível', v_ctx
            using errcode = 'check_violation';
        end if;
      end if;

      perform app.assert_condition_op_target(
        v_op, v_target_type, rc.cond -> 'value', v_ctx
      );

      -- form-model-normalization: choice-target value codes must exist.
      perform app.assert_condition_value_codes(
        p_form_version_id, v_ref_key, v_target_type, rc.cond -> 'value', v_ctx
      );
    end loop;
  end loop;

  return true;
end;
$function$;

commit;
