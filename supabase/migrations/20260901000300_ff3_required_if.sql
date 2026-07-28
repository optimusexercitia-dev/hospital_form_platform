-- FF-3 (ADR 0090) — B4a: `required_if` composed into BOTH arms of the
-- completeness dispatch.
--
-- An item is required when `required = true` OR `required_if` evaluates true
-- against THE MAP IN SCOPE — the response's top-level map in the flat arm,
-- `app.instance_answer_map` in the group arm, so per-instance `required_if`
-- works by construction (ADR 0086 ruling 8) with no instance-specific code.
--
-- ⚠ VISIBILITY WINS, UNCONDITIONALLY. A hidden item is never required, whatever
-- `required_if` says. This is the phase's deadlock-negative property and it is
-- structural here, not a check that could be forgotten: both arms already FILTER
-- by `app.eval_visibility` before the required test, and `required_if` composes
-- as another conjunct INSIDE that filter — never around it. An item excluded for
-- invisibility is never reached by the requirement test at all.
--
-- FLAG-GATED. `required_if` is only consulted when `item_validations` is on, so
-- the flag is a real kill switch for the whole phase and not just for its writer.
-- The gating happens at the CALL SITE (`case when v_flag then ... else null end`)
-- rather than inside the predicate, so `app.item_is_required` stays IMMUTABLE and
-- can be mirrored in TS as a pure function.

begin;

create or replace function app.item_is_required(
  p_required boolean,
  p_required_if jsonb,
  p_answers jsonb
)
returns boolean
language sql
immutable
set search_path to 'app', 'pg_catalog'
as $$
  -- Total by construction: every caller uses this inside a WHERE conjunct or an
  -- IF, where a NULL would silently mean "not required" (fail open).
  select coalesce(
    coalesce(p_required, false)
      or (p_required_if is not null and app.eval_visibility(p_required_if, p_answers)),
    false
  );
$$;

comment on function app.item_is_required(boolean, jsonb, jsonb) is
  'FF-3 (ADR 0090 ruling 4): required = the static flag OR the required_if condition '
  'against the map IN SCOPE. Visibility is NOT consulted here — the callers filter by '
  'app.eval_visibility BEFORE reaching this, which is what makes "visibility wins" '
  'structural. TS mirror: itemIsRequired in src/lib/queries/validations.ts.';

-- ---------------------------------------------------------------------------
-- app.response_required_complete — both arms.
-- Everything not marked FF-3 is byte-identical to the shipped FF-2 body.
-- ---------------------------------------------------------------------------

create or replace function app.response_required_complete(p_response_id uuid)
returns boolean
language plpgsql
stable security definer
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
  v_validations_on boolean;
begin
  select form_version_id into v_version_id
  from public.responses
  where id = p_response_id;

  if v_version_id is null then
    return false;
  end if;

  v_answers := app.answer_map(p_response_id);
  -- FF-3: read the flag ONCE — this function is called on every save.
  v_validations_on := app.feature_enabled('item_validations');

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
      and i.question_key is not null
      and (i.parent_item_id is null or p.item_type = 'group')
      -- A per-item visibility condition can hide a required item; honour it.
      and app.eval_visibility(i.visible_when, v_answers)
      -- A child of a hidden PLAIN group is hidden with it.
      and (i.parent_item_id is null
           or app.eval_visibility(p.visible_when, v_answers))
      -- FF-3: required = the static flag OR required_if against the TOP-LEVEL
      -- map. Placed AFTER the visibility conjuncts on purpose — a hidden item is
      -- already excluded by them and this can never resurrect it.
      and app.item_is_required(
            i.required,
            case when v_validations_on then i.required_if else null end,
            v_answers)
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
      -- A hidden group requires nothing — visibility wins (ruling 3).
      if not app.eval_visibility(r_group.visible_when, v_answers) then
        continue;
      end if;

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
        -- Ruling 2: the resolved map for THIS instance — top-level (+) instance,
        -- instance wins, a sibling this instance did not answer stays ABSENT.
        v_imap := app.instance_answer_map(p_response_id, r_instance.id);

        select count(*) into v_missing
        from public.form_items c
        where c.parent_item_id = r_group.id
          and c.question_key is not null
          and app.eval_visibility(c.visible_when, v_imap)
          -- FF-3: required_if against THIS INSTANCE's map, so "obrigatório
          -- quando o irmão desta repetição disser X" works with no extra code.
          and app.item_is_required(
                c.required,
                case when v_validations_on then c.required_if else null end,
                v_imap)
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
$$;

-- `public.submit_response` gets the SAME two arms, but its body is replaced ONCE
-- in the next migration (20260901000400) together with the HC0P9 error gate —
-- writing that 250-line body twice in one wave would be two chances for the two
-- copies to disagree.

commit;
