-- ADR 0134 — B1 (QA BLOCKING): close the platform_admin PHI-write path that
-- 20261003000600 opened in `public.create_case`. Local only; no push, no merge.
--
-- WHAT WAS WRONG. `create_case`'s authority gate is
--     is_staff_admin_of(commission) OR app.is_admin() OR member_can(commission,'create_cases')
-- and 20261003000600 added an UNCONDITIONAL `p_patient` write once past it. Measured on the
-- live catalog, `create_case` is the SOLE outlier of the three creation doors:
--     create_case                | is_admin arm = TRUE  | writes PHI = true
--     create_case_from_template  | is_admin arm = false | writes PHI = true
--     bulk_create_cases          | is_admin arm = false | writes PHI = true
-- ⇒ a hatted platform_admin could write patient_identifiers + patient_participants in ANY
-- commission of ANY tenant, firing trg_xref_maintain_patient_identifiers into the
-- cross-module patient index (Amdt 2 M4 / §A2.4 risk 1).
--
-- ⭐ IT IS NEW, NOT PRE-EXISTING. Before 20261003000600 the identifiers went out in a
-- SECOND call — set_case_patient -> set_participant_patient — whose single authority
-- branch is is_staff_admin_of, so a platform_admin was refused. Turning the payload into a
-- parameter moved the write INSIDE the door carrying is_admin(). The delivery even wrote
-- the correct reasoning nine lines long, one function away, for bulk_create_cases.
--
-- THE FIX IS NARROW AND DELIBERATELY SO. The `is_admin()` disjunct on case CREATION is
-- untouched — it is pre-existing, outside this increment's authorization, and a noun-rule
-- question for the PO. Only the PHI branch is gated down to the principal class option D
-- actually names.
--
-- CONTRIBUTING CAUSE, recorded because the fix does not remove it: supabase/tests/357
-- §8.2 asserted the membership negative against the PREDICATE (`member_can_for(...)=false`)
-- rather than against the DOOR. A door-level assertion would have had to reckon with the
-- full disjunct set, and the extra arm would have been visible. §8.2 is re-anchored on the
-- door in the same delivery.

CREATE OR REPLACE FUNCTION public.create_case(p_commission_id uuid, p_label text DEFAULT NULL::text, p_patient_enabled boolean DEFAULT false, p_outcome_ids uuid[] DEFAULT '{}'::uuid[], p_department_id uuid DEFAULT NULL::uuid, p_department_other text DEFAULT NULL::text, p_case_type_id uuid DEFAULT NULL::uuid, p_patient jsonb DEFAULT NULL::jsonb)
 RETURNS cases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_case public.cases;
  v_attempt integer := 0;
  v_bad uuid;
  v_dept_other text := nullif(btrim(p_department_other), '');
  -- O-1: default to today's column defaults; a supplied case_type overrides them.
  v_visibility text := 'commission_default';
  v_confidentiality text := 'non_phi_internal';
begin
  perform app.assert_cases_enabled();
  perform app.assert_processless_cases_enabled();

  if not exists (select 1 from public.commissions where id = p_commission_id) then
    raise exception 'comissão % não encontrada', p_commission_id using errcode = 'no_data_found';
  end if;

  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()
          or app.member_can(p_commission_id, 'create_cases')) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- ⛔ THE PHI PAYLOAD REQUIRES THE OPTION-D PRINCIPAL CLASS, WHICH THE GATE ABOVE DOES
  -- NOT. This door's authority gate carries a third disjunct — `app.is_admin()` — that its
  -- two sibling creation doors do not. That disjunct is PRE-EXISTING and is deliberately
  -- left alone here (whether platform_admin should create commission content at all is a
  -- noun-rule question for the PO, filed separately). What is NOT pre-existing is PHI
  -- travelling through it: before 20261003000600 the identifiers went out in a SECOND
  -- call to set_case_patient -> set_participant_patient, whose single authority branch is
  -- `app.is_staff_admin_of`, so a platform_admin was REFUSED. Making the payload a
  -- parameter of this door moved the write from one call away to zero, and handed the
  -- is_admin arm a patient-identifier write it never had.
  -- ⛔ CLAUDE.md §1 noun rule (ADR 0078 A35): platform_admin may administer tenancy,
  -- identity, vocabulary and audit, and may NOT touch commission content or PHI. ADR 0134
  -- §A2.1 names the principal class as "a member holding the create_cases capability";
  -- a platform-admin PHI write was never put to the PO (§A2.7).
  -- ⚠ REFUSED AT THE GATE, BEFORE THE CASE IS MINTED, and never by silently dropping
  -- p_patient — a dropped payload is data loss wearing a success, and it would rebuild
  -- the M10 half-state this increment removed.
  if p_patient is not null
     and not (app.is_staff_admin_of(p_commission_id)
              or app.member_can(p_commission_id, 'create_cases')) then
    raise exception 'apenas a coordenação da comissão ou um Administrativo autorizado a criar casos pode registrar dados do paciente'
      using errcode = '42501';
  end if;

  -- O-1 Rule-12 inheritance: a supplied case_type must resolve in the case's org
  -- (mirrors create_case_from_template's guard) AND sets visibility/confidentiality
  -- from the type (an Ethics type resolves explicit_grants_only). Guarded by the
  -- case_types flag so the path is inert until E3a is live.
  if p_case_type_id is not null and app.feature_enabled('case_types') then
    select default_visibility_policy, default_confidentiality_level
      into v_visibility, v_confidentiality
    from public.case_types
    where id = p_case_type_id
      and organization_id = app.org_of_commission(p_commission_id);
    if not found then
      raise exception 'tipo de caso não encontrado para esta organização'
        using errcode = 'no_data_found';
    end if;
  end if;

  if p_department_id is not null and v_dept_other is not null then
    raise exception 'informe um setor da lista OU um valor personalizado, não ambos'
      using errcode = '23514';
  end if;
  if p_department_id is not null
     and not app.department_belongs_to_commission(p_department_id, p_commission_id) then
    raise exception 'este setor não pertence ao hospital deste caso'
      using errcode = 'HC030';
  end if;

  if cardinality(p_outcome_ids) > 0 then
    perform app.assert_extras_enabled();

    select oid into v_bad
    from unnest(p_outcome_ids) as oid
    where not exists (
      select 1 from public.case_outcomes o
      where o.id = oid
        and o.commission_id = p_commission_id
        and o.archived = false
    )
    limit 1;
    if found then
      raise exception 'este desfecho não pertence à comissão deste caso'
        using errcode = 'HC030';
    end if;
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.cases
        (commission_id, template_version_id, case_type_id, label, created_by, patient_enabled,
         department_id, department_other, visibility_policy, confidentiality_level)
      values
        (p_commission_id, null, p_case_type_id, nullif(btrim(p_label), ''), auth.uid(),
         coalesce(p_patient_enabled, false), p_department_id, v_dept_other,
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

  if cardinality(p_outcome_ids) > 0 then
    insert into public.case_offered_outcomes (case_id, outcome_id)
    select v_case.id, oid from unnest(p_outcome_ids) as oid
    on conflict do nothing;
  end if;

  perform set_config('app.in_case_rpc', 'off', true);

  -- ADR 0061 (revised): a NON-coordinator (capability-arm) creator self-grants a
  -- case_access READ — just enough to SEE the case they opened. Coordinators/commission
  -- admins already see the whole board — skip them. (Flag branch collapsed — B4.)
  if not (app.is_staff_admin_of(p_commission_id)) then
    perform app._grant_case_access_unchecked(v_case.id, auth.uid(), 'read', null, null, 'creator_self_grant');
  end if;

  -- ADR 0134 Amendment 2 option D — CREATION-SCOPED PHI WRITE. The authority question
  -- ("may you create cases here?") was answered above; this is the same act, not a
  -- second one. Participant id is NULL by the STRUCTURAL property in the header: the
  -- helper is the ONLY surface in the database that can create a patient participant,
  -- so a case cannot already have one here.
  if p_patient is not null then
    perform app._set_participant_patient_unchecked(
      v_case.id, null,
      nullif(btrim(p_patient ->> 'name'), ''),
      nullif(btrim(p_patient ->> 'mrn'), ''),
      nullif(p_patient ->> 'date_of_birth', '')::date,
      nullif(p_patient ->> 'age_years', '')::integer,
      coalesce(nullif(btrim(p_patient ->> 'sex'), ''), 'unknown'),
      nullif(btrim(p_patient ->> 'encounter_ref'), ''),
      nullif(btrim(p_patient ->> 'unit'), ''),
      nullif(btrim(p_patient ->> 'attending'), ''),
      null);
  end if;

  return v_case;
end;
$function$;
