-- FF-1 · BE-6 — the outside-in condition ban (ADR 0087 ruling 2), at publish.
--
-- THE RULE, stated once:
--   A condition may target a REPEATING-group child's `question_key` ONLY if the
--   REFERENCING item is a child of the SAME repeating group.
--
-- Corollaries that fall out of it:
--   · a SECTION condition may never target one (a section is never inside a group);
--   · a top-level item may never target one (outside-in — rejected);
--   · a child of group A may not target a child of group B (outside-in w.r.t. B);
--   · a child of group A targeting its own sibling is FINE (inside-out — ruling 2's
--     same-instance resolution, which app.instance_answer_map implements);
--   · a PLAIN `group`'s children are unaffected (ruling 6): they answer top-level,
--     so their keys are unambiguous and remain legal targets everywhere.
--
-- WHY FORBID rather than pick a semantic: with N instances there is no single
-- value, and every candidate — any / all / first / absent — is defensible and
-- surprising in a different way. Decisively, FORBIDDING IS THE REVERSIBLE
-- DIRECTION: relaxing later is a validator change plus additive vectors, whereas
-- shipping existential semantics and later restricting them would break
-- published, immutable versions (Rule 5). Back-compat cost today is zero — no
-- form in existence contains a group.
--
-- WHERE: `public.validate_visible_when`, the publish-time gate called by
-- `publish_form_version`. It is already structure-aware and already raises pt-BR
-- `check_violation`s for the "pergunta anterior" rules, so the new rule sits
-- beside its siblings and keeps their SQLSTATE rather than minting an HC0N* code
-- (per ADR 0087, publish-time gates raise check_violation).
--
-- The ordinal "pergunta anterior" comparison keeps working across the container
-- boundary because children occupy contiguous positions immediately after their
-- parent in the flat (section_id, position) space — enforced by
-- app.validate_group_layout (BE-1).
--
-- MIRROR: `isConditionTargetInScope` in src/lib/queries/conditions.ts narrows what
-- the builder OFFERS to exactly this rule. The server stays the authority; the TS
-- side exists so an author is never offered a target that then fails publish.

create or replace function public.validate_visible_when(p_form_version_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $$
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

  -- ---- ITEM conditions (single OR group). ----
  for ri in
    select i.id, i.label, i.question_key, i.visible_when,
           s.position as section_position, i.position as item_position,
           -- FF-1: the REPEATING group owning this item, or null (top-level, or a
           -- plain-`group` child — which is top-level for answer purposes).
           case when p.item_type = 'repeating_group' then p.id else null end
             as repeating_group_id
    from public.form_items i
    join public.form_sections s on s.id = i.section_id
    left join public.form_items p on p.id = i.parent_item_id
    where i.form_version_id = p_form_version_id
      and i.visible_when is not null
    order by s.position, i.position
  loop
    v_dep_section := ri.section_position;
    v_dep_item := ri.item_position;
    v_dep_group := ri.repeating_group_id;

    for rc in select cond from app.visibility_conditions(ri.visible_when) cond loop
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
        raise exception
          'a condição da pergunta "%" referencia a pergunta "%", que não existe nesta versão',
          coalesce(ri.label, '(sem rótulo)'), v_ref_key
          using errcode = 'check_violation';
      end if;

      if not (v_ref_section < v_dep_section
              or (v_ref_section = v_dep_section and v_ref_item < v_dep_item)) then
        raise exception
          'a condição da pergunta "%" deve referenciar uma pergunta anterior no formulário',
          coalesce(ri.label, '(sem rótulo)')
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
          raise exception
            'a condição da pergunta "%" não pode depender de "%", que está dentro de um bloco repetível',
            coalesce(ri.label, '(sem rótulo)'), coalesce(v_ref_label, v_ref_key)
            using errcode = 'check_violation';
        else
          raise exception
            'a condição da pergunta "%" só pode depender de perguntas do mesmo bloco repetível',
            coalesce(ri.label, '(sem rótulo)')
            using errcode = 'check_violation';
        end if;
      end if;

      perform app.assert_condition_op_target(
        v_op, v_target_type, rc.cond -> 'value',
        format('a condição da pergunta "%s"', coalesce(ri.label, '(sem rótulo)'))
      );

      -- form-model-normalization: choice-target value codes must exist.
      perform app.assert_condition_value_codes(
        p_form_version_id, v_ref_key, v_target_type, rc.cond -> 'value',
        format('a condição da pergunta "%s"', coalesce(ri.label, '(sem rótulo)'))
      );
    end loop;
  end loop;

  return true;
end;
$$;

comment on function public.validate_visible_when(uuid) is
  'Publish-time validation of every section/item visible_when. FF-1 adds ADR 0087 ruling 2: a condition may target a REPEATING-group child only if the referencing item is a child of the SAME repeating group (inside-out resolves; outside-in is rejected in pt-BR). Plain-`group` children answer top-level and stay legal targets everywhere.';
