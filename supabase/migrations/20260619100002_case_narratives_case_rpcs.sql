-- Case Narratives (3 of 4): the per-case BODY save, the narrative-type VOCABULARY
-- CRUD, and the two CREATE OR REPLACEs (create_case_from_template +
-- get_case_detail) that snapshot + expose narratives. ADR 0032.
--
-- ⚠️ The two replaced functions BUILD ON THE FINAL BODIES IN 20260614093003
-- (outcomes + blocks logic), NOT the …090006 originals. Every prior step is kept
-- verbatim; the narrative logic is ADDED inside the existing windows. close_case
-- is intentionally NOT touched (decision 7 is advisory; close_case never writes
-- narratives).
--
-- All public functions gate app.assert_narratives_enabled() (the two REPLACEs gate
-- it only around the NEW narrative work, since they must keep working with the
-- flag OFF for existing cases — see below) and are re-revoked from anon/public.
--
-- HC054 — a body write on a terminal case (the freeze).

-- ===========================================================================
-- update_case_narrative_body(narrative_id, body_md) -> case_narratives
-- ===========================================================================
-- Persist ONLY body_md (the inline Markdown editor save). SECURITY INVOKER + an
-- explicit is_staff_admin_of/admin gate (42501 on deny) — mirror
-- update_interview_summary, but keyed on the PARENT CASE status: a terminal case
-- (concluido/cancelado) → HC054. Sets app.in_narrative_rpc='on' so
-- app.guard_case_narrative_frozen permits this one legitimate write, updates
-- body_md + updated_by (the touch trigger bumps updated_at), clears the flag,
-- returns the row. No per-case create/remove (narratives are template-fixed in v1).
create function public.update_case_narrative_body(
  p_narrative_id uuid,
  p_body_md text
)
returns public.case_narratives
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_case_id uuid;
  v_commission_id uuid;
  v_status text;
  v_result public.case_narratives;
begin
  perform app.assert_narratives_enabled();

  select n.case_id, c.commission_id, c.status
    into v_case_id, v_commission_id, v_status
  from public.case_narratives n
  join public.cases c on c.id = n.case_id
  where n.id = p_narrative_id;

  if v_case_id is null then
    raise exception 'narrativa % não encontrada', p_narrative_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_status in ('concluido', 'cancelado') then
    raise exception 'as narrativas deste caso estão bloqueadas' using errcode = 'HC054';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives
  set body_md = p_body_md, updated_by = auth.uid()
  where id = p_narrative_id
  returning * into v_result;
  perform set_config('app.in_narrative_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.update_case_narrative_body(uuid, text) to authenticated, service_role;

-- ===========================================================================
-- Narrative-type VOCABULARY CRUD (SECURITY INVOKER; RLS + explicit gate)
-- ===========================================================================
-- Follows case_outcomes CRUD exactly: create / update / reorder / archive. Edits
-- propagate to the vocabulary + template slots but NOT to opened cases (they
-- snapshot type_label). Library is ARCHIVE-ONLY (no delete), matching
-- case_outcomes (a type referenced by a template slot is RESTRICT-protected from
-- deletion anyway).

-- create_case_narrative_type(commission, label, description)
create function public.create_case_narrative_type(
  p_commission_id uuid,
  p_label text,
  p_description text default null
)
returns public.case_narrative_types
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_position integer;
  v_result public.case_narrative_types;
begin
  perform app.assert_narratives_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_label), '') is null then
    raise exception 'informe o nome da narrativa' using errcode = 'check_violation';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.case_narrative_types where commission_id = p_commission_id;

  insert into public.case_narrative_types
    (commission_id, label, description, position)
  values
    (p_commission_id, btrim(p_label), nullif(btrim(p_description), ''), v_position)
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.create_case_narrative_type(uuid, text, text)
  to authenticated, service_role;

-- update_case_narrative_type(type_id, label, description) — propagates (shared row)
create function public.update_case_narrative_type(
  p_narrative_type_id uuid,
  p_label text,
  p_description text
)
returns public.case_narrative_types
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_result public.case_narrative_types;
begin
  perform app.assert_narratives_enabled();

  select commission_id into v_commission_id
  from public.case_narrative_types where id = p_narrative_type_id;
  if v_commission_id is null then
    raise exception 'narrativa não encontrada' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_label), '') is null then
    raise exception 'informe o nome da narrativa' using errcode = 'check_violation';
  end if;

  update public.case_narrative_types
  set label = btrim(p_label),
      description = nullif(btrim(p_description), '')
  where id = p_narrative_type_id
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.update_case_narrative_type(uuid, text, text)
  to authenticated, service_role;

-- reorder_case_narrative_types(commission, ordered_ids[]) -> void (deferrable swap)
create function public.reorder_case_narrative_types(
  p_commission_id uuid,
  p_ordered_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
begin
  perform app.assert_narratives_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.case_narrative_types d
  set position = o.ord
  from (
    select id, ordinality::integer as ord
    from unnest(p_ordered_ids) with ordinality as t(id, ordinality)
  ) o
  where d.commission_id = p_commission_id and d.id = o.id;
end;
$$;

grant execute on function public.reorder_case_narrative_types(uuid, uuid[])
  to authenticated, service_role;

-- archive_case_narrative_type(type_id) -> type
create function public.archive_case_narrative_type(p_narrative_type_id uuid)
returns public.case_narrative_types
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_result public.case_narrative_types;
begin
  perform app.assert_narratives_enabled();

  select commission_id into v_commission_id
  from public.case_narrative_types where id = p_narrative_type_id;
  if v_commission_id is null then
    raise exception 'narrativa não encontrada' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.case_narrative_types set archived = true
  where id = p_narrative_type_id returning * into v_result;
  return v_result;
end;
$$;

grant execute on function public.archive_case_narrative_type(uuid) to authenticated, service_role;

-- ===========================================================================
-- create_case_from_template(template, label) -> cases   (REPLACE — 093003 + narratives)
-- ===========================================================================
-- Identical to the 20260614093003 final body, with TWO additions inside the
-- existing app.in_case_rpc='on' window:
--   (a) each new case_phases.display_position := coalesce(template phase
--       display_position, position);
--   (b) after the phase loop, snapshot process_template_narratives ⋈
--       case_narrative_types into case_narratives, writing
--       type_label := coalesce(ptn.title, cnt.label) (the EFFECTIVE label),
--       display_position, title, instructions, is_expected, created_by.
-- The snapshot runs while the case is still 'aberto', so guard_case_narrative_frozen
-- passes. The narrative snapshot is GUARDED by the flag: with case_narratives OFF
-- it is skipped, so existing cases keep working exactly as before (the feature is
-- dark until …100009). No timeline event, no extra recompute.
create or replace function public.create_case_from_template(
  p_template_id uuid,
  p_label text default null
)
returns public.cases
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_status text;
  v_case public.cases;
  r_slot record;
  v_version uuid;
  v_from_phase integer;
  v_source_version uuid;
  v_qkey text;
  v_attempt integer := 0;
  v_narratives_on boolean := app.feature_enabled('case_narratives');
begin
  perform app.assert_cases_enabled();

  select commission_id, status into v_commission_id, v_status
  from public.process_templates where id = p_template_id;

  if v_commission_id is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  -- Internal gate (DEFINER): only a staff_admin of the template's commission may
  -- open a case. Mirrors the definer board self-gate.
  if not app.is_staff_admin_of(v_commission_id) then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  if v_status <> 'active' then
    raise exception 'apenas processos publicados podem iniciar casos'
      using errcode = 'check_violation';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  -- Insert the case; the minting trigger sets case_number. status defaults to
  -- 'nao_iniciado' (no explicit status -> the column default applies). Bounded
  -- unique_violation retry for the per-commission number race.
  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.cases (commission_id, template_id, label, created_by)
      values (v_commission_id, p_template_id, nullif(btrim(p_label), ''), auth.uid())
      returning * into v_case;
      exit;  -- success
    exception
      when unique_violation then
        if v_attempt >= 3 then
          raise;
        end if;
        -- loop and let the minting trigger recompute on the next attempt
    end;
  end loop;

  -- Materialize the template slots into case_phases, pinning published versions
  -- and snapshotting recommend_when, default_due_days, blocks AND display_position
  -- verbatim.
  for r_slot in
    select position, form_id, title, recommend_when, default_due_days, blocks,
           display_position
    from public.process_template_phases
    where template_id = p_template_id
    order by position
  loop
    v_version := app.published_version_of_form(r_slot.form_id);
    if v_version is null then
      raise exception
        'o formulário da fase % ainda não foi publicado', r_slot.position
        using errcode = 'HC017';
    end if;

    -- Re-validate recommend_when against the PINNED source version.
    if r_slot.recommend_when is not null then
      v_from_phase := (r_slot.recommend_when ->> 'from_phase')::integer;
      v_qkey := r_slot.recommend_when ->> 'question_key';

      v_source_version := app.published_version_of_form(
        (select form_id from public.process_template_phases
         where template_id = p_template_id and position = v_from_phase)
      );
      if v_source_version is null then
        raise exception
          'o formulário da fase % (origem da recomendação) não está publicado',
          v_from_phase using errcode = 'HC017';
      end if;
      if not app.version_has_input_key(v_source_version, v_qkey) then
        raise exception
          'a recomendação da fase % referencia a pergunta "%", ausente no formulário publicado',
          r_slot.position, v_qkey using errcode = 'HC016';
      end if;
    end if;

    -- Snapshot the slot (ADR 0017 + blocks + ADR 0032 display_position). due_date
    -- null. The blocks shape trigger re-asserts earlier-only on this insert.
    insert into public.case_phases
      (case_id, position, form_id, form_version_id, title, recommend_when,
       is_ad_hoc, default_due_days, blocks, display_position)
    values
      (v_case.id, r_slot.position, r_slot.form_id, v_version, r_slot.title,
       r_slot.recommend_when, false, r_slot.default_due_days, r_slot.blocks,
       coalesce(r_slot.display_position, r_slot.position));
  end loop;

  -- Freeze the OFFERED outcome set for this case (D15) from the template's live
  -- offering. The conclude gate + selector read THIS, not process_template_outcomes.
  insert into public.case_offered_outcomes (case_id, outcome_id)
  select v_case.id, pto.outcome_id
  from public.process_template_outcomes pto
  where pto.template_id = p_template_id;

  -- Snapshot the NARRATIVE slots (ADR 0032) — only when the feature is on. The
  -- EFFECTIVE label (coalesce(slot.title, type.label)) is frozen into type_label.
  -- Runs while the case is 'aberto', so guard_case_narrative_frozen passes.
  if v_narratives_on then
    insert into public.case_narratives
      (case_id, narrative_type_id, type_label, display_position, title,
       instructions, is_expected, created_by)
    select v_case.id, ptn.narrative_type_id,
           coalesce(nullif(btrim(ptn.title), ''), cnt.label),
           ptn.display_position, ptn.title, ptn.instructions, ptn.is_expected,
           auth.uid()
    from public.process_template_narratives ptn
    join public.case_narrative_types cnt on cnt.id = ptn.narrative_type_id
    where ptn.template_id = p_template_id;
  end if;

  perform set_config('app.in_case_rpc', 'off', true);

  -- Initial recommendation pass (no submitted phases yet; uniform path).
  perform public.recompute_recommendations(v_case.id);

  return v_case;
end;
$$;

grant execute on function public.create_case_from_template(uuid, text) to authenticated, service_role;

-- ===========================================================================
-- get_case_detail(case) — REPLACE: add per-phase display_position + a narratives[]
-- ===========================================================================
-- Identical to the 20260614093003 final body (header + outcome + offered set +
-- phases with blocks), with TWO additions:
--   * each phase object gains 'display_position' := coalesce(cp.display_position,
--     cp.position). Phases are STILL ordered by cp.position (blocks/recommend stay
--     correct); the client computes the merged interleave from display_position.
--   * a new top-level 'narratives' array (jsonb_agg over case_narratives ordered
--     by display_position), exposing id, narrative_type_id, type_label,
--     display_position, title, instructions, is_expected, body_md, updated_at.
-- body_md IS returned here — de-identified governance prose for the coordinator,
-- consistent with case_events.body already in this envelope. Only the AUDIT LOG
-- excludes body_md (…100003); that is a different concern. Signature UNCHANGED.
-- Independent of the case_narratives flag: with the flag off no narratives exist,
-- so the array is simply '[]'.
create or replace function public.get_case_detail(p_case_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_case public.cases;
  v_outcome jsonb;
  v_result jsonb;
begin
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if not app.is_staff_admin_of(v_case.commission_id) then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;

  -- The assigned outcome, resolved LIVE (or null).
  select case when o.id is null then null else jsonb_build_object(
           'id', o.id,
           'label', o.label,
           'color_token', o.color_token,
           'requires_action_plan', o.requires_action_plan,
           'is_adverse', o.is_adverse
         ) end
    into v_outcome
  from (select v_case.outcome_id as oid) s
  left join public.case_outcomes o on o.id = s.oid;

  select jsonb_build_object(
    'id', v_case.id,
    'commission_id', v_case.commission_id,
    'template_id', v_case.template_id,
    'case_number', v_case.case_number,
    'label', v_case.label,
    'status', v_case.status,
    'outcome_id', v_case.outcome_id,
    'outcome', v_outcome,
    -- The FROZEN offered set (case_offered_outcomes), resolved to label/flags.
    'offered_outcomes', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', o.id,
          'label', o.label,
          'color_token', o.color_token,
          'requires_action_plan', o.requires_action_plan,
          'is_adverse', o.is_adverse
        ) order by o.position)
       from public.case_offered_outcomes coo
       join public.case_outcomes o on o.id = coo.outcome_id
       where coo.case_id = p_case_id),
      '[]'::jsonb),
    'created_at', v_case.created_at,
    'closed_at', v_case.closed_at,
    'phases', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', cp.id,
          'position', cp.position,
          'form_id', cp.form_id,
          'form_version_id', cp.form_version_id,
          'form_title', f.title,
          'title', cp.title,
          'status', cp.status,
          'recommended', cp.recommended,
          'assigned_to', cp.assigned_to,
          'assignee_name', pr.full_name,
          'is_ad_hoc', cp.is_ad_hoc,
          'blocks', cp.blocks,
          'recommend_when', cp.recommend_when,
          'due_date', cp.due_date,
          'default_due_days', cp.default_due_days,
          'display_position', coalesce(cp.display_position, cp.position),
          'response_id', sub.response_id,
          'submitted_at', sub.submitted_at
        ) order by cp.position)
       from public.case_phases cp
       join public.forms f on f.id = cp.form_id
       left join public.profiles pr on pr.id = cp.assigned_to
       left join lateral (
         select r.id as response_id, r.submitted_at
         from public.responses r
         where r.case_phase_id = cp.id
           and r.status = 'submitted'
           and cp.status = 'concluida'
         limit 1
       ) sub on true
       where cp.case_id = p_case_id),
      '[]'::jsonb),
    -- The case's NARRATIVES (ADR 0032), ordered by display_position. body_md IS
    -- returned (coordinator read path); only the audit log excludes it.
    'narratives', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', cn.id,
          'narrative_type_id', cn.narrative_type_id,
          'type_label', cn.type_label,
          'display_position', cn.display_position,
          'title', cn.title,
          'instructions', cn.instructions,
          'is_expected', cn.is_expected,
          'body_md', cn.body_md,
          'updated_at', cn.updated_at
        ) order by cn.display_position)
       from public.case_narratives cn
       where cn.case_id = p_case_id),
      '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_case_detail(uuid) to authenticated, service_role;

-- ===========================================================================
-- Re-revoke anon/PUBLIC EXECUTE on every public function created/replaced above
-- ===========================================================================
revoke execute on function public.update_case_narrative_body(uuid, text) from anon, public;
revoke execute on function public.create_case_narrative_type(uuid, text, text) from anon, public;
revoke execute on function public.update_case_narrative_type(uuid, text, text) from anon, public;
revoke execute on function public.reorder_case_narrative_types(uuid, uuid[]) from anon, public;
revoke execute on function public.archive_case_narrative_type(uuid) from anon, public;
revoke execute on function public.create_case_from_template(uuid, text) from anon, public;
revoke execute on function public.get_case_detail(uuid) from anon, public;
