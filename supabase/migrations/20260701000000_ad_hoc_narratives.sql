-- Ad-hoc Narratives on an open Case.
--
-- Mirrors the ad-hoc Phase mechanism (add_ad_hoc_phase / case_phases.is_ad_hoc):
-- a coordinator of an OPEN case may append a narrative whose type is either an
-- existing commission narrative-type or an inline create-or-reuse of a new type.
-- Additive, feature-flagged behind `case_narratives`. See plan
-- validated-sprouting-lake.md / ADR 0032 v2.

-- a. Provenance column + audit allow-list ------------------------------------

alter table public.case_narratives
  add column if not exists "is_ad_hoc" boolean not null default false;

-- Add the structural flag to the audit diff allow-list. body_md/title/
-- instructions stay OUT of the log (Rule 11).
create or replace function "app"."trg_audit_case_narratives"() returns "trigger"
    language "plpgsql" security definer
    set "search_path" to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_cols constant text[] := array['type_label', 'display_position', 'is_expected',
                                  'status', 'assigned_to', 'is_ad_hoc'];
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('case_narrative.created', 'case_narrative', new.id,
      app.commission_of_case(new.case_id),
      'Narrativa do caso criada: ' || coalesce(new.type_label, ''),
      app.audit_diff(null, to_jsonb(new), v_cols));
  else
    perform app.audit_write('case_narrative.updated', 'case_narrative', new.id,
      app.commission_of_case(new.case_id),
      'Narrativa do caso atualizada: ' || coalesce(new.type_label, ''),
      app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
  end if;
  return null;
end;
$$;

alter function "app"."trg_audit_case_narratives"() owner to "postgres";

-- b. RPC: add_ad_hoc_narrative -----------------------------------------------

create or replace function "public"."add_ad_hoc_narrative"(
    "p_case_id" "uuid",
    "p_narrative_type_id" "uuid" default null,
    "p_new_type_label" "text" default null,
    "p_title" "text" default null,
    "p_instructions" "text" default null,
    "p_assigned_to" "uuid" default null) returns "public"."case_narratives"
    language "plpgsql" security definer
    set "search_path" to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_case_status text;
  v_commission uuid;
  v_new_label text;
  v_type_id uuid;
  v_source_label text;
  v_type_label text;
  v_display_position integer;
  v_result public.case_narratives;
begin
  perform app.assert_narratives_enabled();

  select status, commission_id into v_case_status, v_commission
  from public.cases where id = p_case_id;
  if v_case_status is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'este caso não está aberto' using errcode = 'HC020';
  end if;

  -- Coordinator gate.
  if not (app.is_staff_admin_of(v_commission) or app.is_org_admin_of_commission(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- Resolve the narrative type (atomic create-or-reuse for inline new types).
  v_new_label := nullif(btrim(p_new_type_label), '');
  if v_new_label is not null then
    insert into public.case_narrative_types (commission_id, label, position)
    select v_commission, v_new_label,
           coalesce(max(position), 0) + 1
    from public.case_narrative_types where commission_id = v_commission
    on conflict (commission_id, label)
      -- Reuse the existing type AND un-archive it: a silently-archived reuse would
      -- produce a narrative whose type is absent from the (non-archived) picker.
      do update set label = excluded.label, archived = false
    returning id, label into v_type_id, v_source_label;
  else
    if p_narrative_type_id is null then
      raise exception 'informe o tipo da narrativa' using errcode = 'check_violation';
    end if;
    select id, label into v_type_id, v_source_label
    from public.case_narrative_types
    where id = p_narrative_type_id and commission_id = v_commission;
    if v_type_id is null then
      raise exception 'este tipo de narrativa não pertence à comissão deste caso'
        using errcode = 'HC054';
    end if;
  end if;

  -- Effective snapshot label: title override wins, else the resolved type label.
  v_type_label := coalesce(nullif(btrim(p_title), ''), v_source_label);

  -- Display slot: next position in the merged phases+narratives interleave.
  -- Verbatim from add_ad_hoc_phase: phases fall back to `position`.
  select coalesce(max(dp), 0) + 1 into v_display_position
  from (
    select coalesce(display_position, position) as dp
    from public.case_phases where case_id = p_case_id
    union all
    select display_position as dp
    from public.case_narratives where case_id = p_case_id
  ) s;

  if p_assigned_to is not null and not app.is_member_of_for(v_commission, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  insert into public.case_narratives
    (case_id, narrative_type_id, type_label, display_position, title, instructions,
     is_expected, is_ad_hoc, status, created_by, assigned_to)
  values
    (p_case_id, v_type_id, v_type_label, v_display_position,
     nullif(btrim(p_title), ''), nullif(btrim(p_instructions), ''),
     false, true, 'aberta', auth.uid(), p_assigned_to)
  returning * into v_result;
  perform set_config('app.in_narrative_rpc', 'off', true);

  return v_result;
end;
$$;

alter function "public"."add_ad_hoc_narrative"("p_case_id" "uuid", "p_narrative_type_id" "uuid", "p_new_type_label" "text", "p_title" "text", "p_instructions" "text", "p_assigned_to" "uuid") owner to "postgres";

revoke all on function "public"."add_ad_hoc_narrative"("p_case_id" "uuid", "p_narrative_type_id" "uuid", "p_new_type_label" "text", "p_title" "text", "p_instructions" "text", "p_assigned_to" "uuid") from public;
grant all on function "public"."add_ad_hoc_narrative"("p_case_id" "uuid", "p_narrative_type_id" "uuid", "p_new_type_label" "text", "p_title" "text", "p_instructions" "text", "p_assigned_to" "uuid") to "authenticated";
grant all on function "public"."add_ad_hoc_narrative"("p_case_id" "uuid", "p_narrative_type_id" "uuid", "p_new_type_label" "text", "p_title" "text", "p_instructions" "text", "p_assigned_to" "uuid") to "service_role";

-- c. get_case_detail: expose narrative provenance -----------------------------
-- Reproduced verbatim from baseline.sql:10595 with a single added field
-- ('is_ad_hoc', cn.is_ad_hoc) in the narratives jsonb_build_object.
CREATE OR REPLACE FUNCTION "public"."get_case_detail"("p_case_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_case public.cases;
  v_outcome jsonb;
  v_is_coordinator boolean;
  v_result jsonb;
begin
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if app.feature_enabled('case_access') then
    if not app.can_read_case(p_case_id, auth.uid()) then
      raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
    end if;
  else
    if not app.is_staff_admin_of(v_case.commission_id) then
      raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
    end if;
  end if;

  v_is_coordinator :=
    app.is_staff_admin_of(v_case.commission_id) or app.is_org_admin_of_commission(v_case.commission_id);

  if app.feature_enabled('case_access') and not v_is_coordinator then
    perform public.log_audit_access(
      'case.opened', 'case', p_case_id, v_case.commission_id,
      'Caso aberto por participante/concedido', '{}'::jsonb);
  end if;

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
    'has_patient', v_case.has_patient,
    'patient_enabled', v_case.patient_enabled,
    'viewer_capabilities', jsonb_build_object(
      'can_read', true,
      'can_write_content', app.can_write_case_content(p_case_id, auth.uid()),
      'can_manage_lifecycle', v_is_coordinator
    ),
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
          'submitted_at', sub.submitted_at,
          -- phase-results: the effective result id/stamp + a LIVE-resolved object.
          'result_id', cp.result_id,
          'result_computed_at', cp.result_computed_at,
          'result', case when prr.id is null then null else jsonb_build_object(
            'id', prr.id,
            'label', prr.label,
            'color_token', prr.color_token,
            'is_adverse', prr.is_adverse,
            'source', cp.result_source
          ) end
        ) order by cp.position)
       from public.case_phases cp
       join public.forms f on f.id = cp.form_id
       left join public.profiles pr on pr.id = cp.assigned_to
       left join public.phase_results prr on prr.id = cp.result_id
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
    'narratives', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', cn.id,
          'narrative_type_id', cn.narrative_type_id,
          'type_label', cn.type_label,
          'display_position', cn.display_position,
          'title', cn.title,
          'instructions', cn.instructions,
          'is_expected', cn.is_expected,
          'is_ad_hoc', cn.is_ad_hoc,
          'body_md', cn.body_md,
          'assigned_to', cn.assigned_to,
          'assignee_name', npr.full_name,
          'status', cn.status,
          'concluded_at', cn.concluded_at,
          'concluded_by', cn.concluded_by,
          'updated_at', cn.updated_at
        ) order by cn.display_position)
       from public.case_narratives cn
       left join public.profiles npr on npr.id = cn.assigned_to
       where cn.case_id = p_case_id),
      '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."get_case_detail"("p_case_id" "uuid") OWNER TO "postgres";
