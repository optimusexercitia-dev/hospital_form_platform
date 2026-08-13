-- =============================================================================
-- ETH·E1 (ADR 0072 D1) — BE-2: case confidentiality + visibility snapshot.
--
-- Adds the ONE confidentiality taxonomy (the F2 7-value label set) + the access
-- MODEL as base-table columns on `cases`, snapshotted at create from `case_types`.
-- Additive, reset-OK, forward-only; every column DEFAULTS to today's behaviour so
-- the flag-OFF invariant is byte-for-byte (ADR 0072 §Consequences).
--
-- Snapshot wiring (lead ruling, BE-2 §b): case creation is template-driven and no
-- `case_type_id` link exists on `cases`/`process_templates`, so `create_case_from_template`
-- gains an OPTIONAL `p_case_type_id`. When supplied AND the `case_types` flag is on, the
-- case snapshots that type's default visibility/confidentiality; otherwise it defaults.
-- Existing 4-arg callers are unaffected (the new arg defaults null).
--
-- New SQLSTATEs (ADR 0072 D9): HC0E5 (invalid confidentiality level — raised by the
-- BE-5 set_case_confidentiality RPC), HC0E7 (>1 live primary subject — the BE-5
-- surface). Reserved here as documentation; no raise site in this migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · cases — the resolved-at-create confidentiality ceiling + access model.
-- -----------------------------------------------------------------------------
alter table public.cases
  add column if not exists visibility_policy text not null default 'commission_default'
    check (visibility_policy in ('commission_default', 'explicit_grants_only')),
  add column if not exists confidentiality_level text not null default 'non_phi_internal'
    check (confidentiality_level in (
      'non_phi_internal', 'phi_standard', 'phi_restricted',
      'peer_review_confidential', 'legal_privileged', 'ethics_investigation',
      'credentialing_sensitive'));

comment on column public.cases.visibility_policy is
  'ADR 0072 D1 · E1 — the case ACCESS MODEL, snapshotted at create from '
  'case_types.default_visibility_policy. commission_default = today''s member reach; '
  'explicit_grants_only = grant/attribution-only (ethics). Read by can_read_case''s '
  'flag-OFF suppression term + the member-facing reach surfaces (list_my_cases/board). '
  'Base-table column ⇒ R6-safe, no join.';
comment on column public.cases.confidentiality_level is
  'ADR 0072 D1 · E1 — the case CONFIDENTIALITY ceiling on the single 7-value taxonomy '
  '(= attachments.confidentiality_label). Snapshotted at create; raised/lowered only via '
  'the DEFINER set_case_confidentiality RPC (audited case.confidentiality_changed). '
  'Immutable-by-default; never a direct write.';

-- -----------------------------------------------------------------------------
-- 2 · case_types — the default ceiling create_case snapshots (companion to the
--     E0 default_visibility_policy already on this table).
-- -----------------------------------------------------------------------------
alter table public.case_types
  add column if not exists default_confidentiality_level text not null default 'non_phi_internal'
    check (default_confidentiality_level in (
      'non_phi_internal', 'phi_standard', 'phi_restricted',
      'peer_review_confidential', 'legal_privileged', 'ethics_investigation',
      'credentialing_sensitive'));

comment on column public.case_types.default_confidentiality_level is
  'ADR 0072 D1 · E1 — the confidentiality ceiling a new case of this type snapshots '
  '(companion to default_visibility_policy). Non-ethics types keep non_phi_internal.';

-- -----------------------------------------------------------------------------
-- 3 · case_access — the clearance grade (O1 ruling: a nullable orthogonal column,
--     NOT widening level''s 2-value CHECK). The highest label this grant may open.
-- -----------------------------------------------------------------------------
alter table public.case_access
  add column if not exists max_confidentiality text
    check (max_confidentiality is null or max_confidentiality in (
      'non_phi_internal', 'phi_standard', 'phi_restricted',
      'peer_review_confidential', 'legal_privileged', 'ethics_investigation',
      'credentialing_sensitive'));

comment on column public.case_access.max_confidentiality is
  'ADR 0072 D5 · E1 — the confidentiality CLEARANCE this grant carries (the highest '
  'label it may open at the document ceiling). NULL = ordinary case-read only (no '
  'clearance above peer-review). Orthogonal to level (read/write). Read by the attachment '
  'confidentiality ceiling (open_attachment + the list query, BE-4).';

-- -----------------------------------------------------------------------------
-- 4 · app.confidentiality_rank — a monotonic ordering of the 7 labels so the BE-4
--     document ceiling can express "a grant clears any label at or below its rank".
--     Only legal_privileged + credentialing_sensitive gate (O2); ranking the rest
--     is future-proofing + keeps the ceiling term a single comparison.
-- -----------------------------------------------------------------------------
create or replace function app.confidentiality_rank(p_label text)
  returns integer
  language sql immutable
  set search_path to 'pg_catalog'
as $$
  select case p_label
    when 'non_phi_internal'         then 0
    when 'phi_standard'             then 1
    when 'phi_restricted'           then 2
    when 'peer_review_confidential' then 3
    when 'ethics_investigation'     then 4
    when 'legal_privileged'         then 5
    when 'credentialing_sensitive'  then 6
    else null
  end;
$$;
comment on function app.confidentiality_rank(text) is
  'ADR 0072 D5 · E1 — monotonic sensitivity rank of the 7-value confidentiality '
  'taxonomy. A case_access.max_confidentiality grant clears an attachment label iff '
  'rank(grant) >= rank(label). Only legal_privileged(5)+credentialing_sensitive(6) '
  'actually gate (O2).';
alter function app.confidentiality_rank(text) owner to postgres;

-- -----------------------------------------------------------------------------
-- 5 · create_case_from_template — snapshot type→case (lead ruling BE-2 §b).
--     Signature changes (4→5 args) ⇒ DROP the old signature then recreate; existing
--     4-arg callers resolve to the 5-arg overload via the p_case_type_id default.
-- -----------------------------------------------------------------------------
drop function if exists public.create_case_from_template(uuid, text, uuid, text);

create or replace function public.create_case_from_template(
  p_template_id uuid, p_label text default null,
  p_department_id uuid default null, p_department_other text default null,
  p_case_type_id uuid default null
) returns public.cases
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission_id uuid;
  v_status text;
  v_collects boolean;
  v_case public.cases;
  r_slot record;
  v_version uuid;
  v_case_phase_id uuid;
  v_attempt integer := 0;
  v_narratives_on boolean := app.feature_enabled('case_narratives');
  v_dept_other text := nullif(btrim(p_department_other), '');
  -- E1 snapshot defaults reproduce today's behaviour; overwritten only when a
  -- case_type is supplied AND the case_types flag is on.
  v_visibility text := 'commission_default';
  v_confidentiality text := 'non_phi_internal';
begin
  perform app.assert_cases_enabled();

  select commission_id, status, collects_patient
    into v_commission_id, v_status, v_collects
  from public.process_templates where id = p_template_id;

  if v_commission_id is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  if not (app.is_staff_admin_of(v_commission_id)
          or app.member_can(v_commission_id, 'create_cases')) then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  if v_status <> 'active' then
    raise exception 'apenas processos publicados podem iniciar casos'
      using errcode = 'check_violation';
  end if;

  if p_department_id is not null and v_dept_other is not null then
    raise exception 'informe um setor da lista OU um valor personalizado, não ambos'
      using errcode = '23514';
  end if;
  if p_department_id is not null
     and not app.department_belongs_to_commission(p_department_id, v_commission_id) then
    raise exception 'este setor não pertence ao hospital deste caso'
      using errcode = 'HC030';
  end if;

  -- ADR 0072 D1 snapshot: resolve the type's defaults iff supplied AND the case_types
  -- feature is on. A type outside the case's org is rejected (mirrors the not-found
  -- posture). Flag OFF / no type ⇒ commission_default / non_phi_internal (today).
  if p_case_type_id is not null and app.feature_enabled('case_types') then
    select default_visibility_policy, default_confidentiality_level
      into v_visibility, v_confidentiality
    from public.case_types
    where id = p_case_type_id
      and organization_id = app.org_of_commission(v_commission_id);
    if not found then
      raise exception 'tipo de caso não encontrado para esta organização'
        using errcode = 'no_data_found';
    end if;
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.cases
        (commission_id, template_id, label, created_by, patient_enabled,
         department_id, department_other, visibility_policy, confidentiality_level)
      values
        (v_commission_id, p_template_id, nullif(btrim(p_label), ''), auth.uid(),
         coalesce(v_collects, false), p_department_id, v_dept_other,
         v_visibility, v_confidentiality)
      returning * into v_case;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 3 then
          raise;
        end if;
    end;
  end loop;

  for r_slot in
    select id, position, form_id, title, recommend_when, default_due_days, blocks,
           display_position, result_ruleset, emits_result
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

    if r_slot.recommend_when is not null then
      perform app.validate_template_recommend_when(
        p_template_id, r_slot.position, r_slot.recommend_when
      );
    end if;

    insert into public.case_phases
      (case_id, position, form_id, form_version_id, title, recommend_when,
       is_ad_hoc, default_due_days, blocks, display_position, result_ruleset,
       emits_result)
    values
      (v_case.id, r_slot.position, r_slot.form_id, v_version, r_slot.title,
       r_slot.recommend_when, false, r_slot.default_due_days, r_slot.blocks,
       coalesce(r_slot.display_position, r_slot.position), r_slot.result_ruleset,
       r_slot.emits_result)
    returning id into v_case_phase_id;

    insert into public.case_phase_allowed_results (case_phase_id, result_id, position)
    select v_case_phase_id, tar.result_id, tar.position
    from public.process_template_phase_allowed_results tar
    where tar.template_phase_id = r_slot.id
      and r_slot.emits_result;
  end loop;

  insert into public.case_offered_outcomes (case_id, outcome_id)
  select v_case.id, pto.outcome_id
  from public.process_template_outcomes pto
  where pto.template_id = p_template_id;

  insert into public.case_phase_offered_results (case_id, result_id)
  select distinct v_case.id, ids.rid
  from (
    select (r ->> 'result_id')::uuid as rid
    from public.case_phases cp
    cross join lateral jsonb_array_elements(coalesce(cp.result_ruleset -> 'rules', '[]'::jsonb)) as r
    where cp.case_id = v_case.id
    union
    select (cp.result_ruleset ->> 'default_result_id')::uuid
    from public.case_phases cp
    where cp.case_id = v_case.id
    union
    select cpar.result_id
    from public.case_phase_allowed_results cpar
    join public.case_phases cp on cp.id = cpar.case_phase_id
    where cp.case_id = v_case.id
  ) ids
  where ids.rid is not null
  on conflict do nothing;

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

  perform public.recompute_recommendations(v_case.id);

  -- ADR 0061 (revised): self-grant the non-coordinator (capability-arm) creator
  -- case_access READ (see create_case — read-only, not write).
  if app.feature_enabled('case_access')
     and not (app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)) then
    perform app._grant_case_access_unchecked(v_case.id, auth.uid(), 'read');
  end if;

  return v_case;
end;
$$;
alter function public.create_case_from_template(uuid, text, uuid, text, uuid) owner to postgres;
revoke all on function public.create_case_from_template(uuid, text, uuid, text, uuid) from public;
grant execute on function public.create_case_from_template(uuid, text, uuid, text, uuid) to authenticated, service_role;
