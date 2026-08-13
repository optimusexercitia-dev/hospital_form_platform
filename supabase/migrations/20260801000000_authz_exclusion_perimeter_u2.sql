-- =============================================================================
-- AUTHZ · EXCLUSION PERIMETER — Unit 2 (CONTENT-WRITE half). ADR 0078.
--
-- THE DEFECT (Unit 1 restated for the write side). A `SECURITY DEFINER` RPC runs
-- with RLS OFF. A DEFINER RPC that mutates a case-content table gated only on
-- `is_staff_admin_of`/`is_commission_admin_of` bypasses the `NOT is_case_excluded`
-- the table's RLS already carries. A recused/respondent coordinator — who cannot
-- read one byte of the case — could WRITE it. Proven by execution: a recused
-- coordinator (is_case_excluded=t, can_read_case=f) renamed a case via
-- update_case_meta, created/assigned/concluded narratives, activated a phase,
-- set offered outcomes, and deleted a case-restricted action item.
--
-- POPULATION — closed BEHAVIOURALLY per-RPC (a structural sweep false-positived on
-- the entire interview family — guarded via can_write_interview — and could not
-- see the action_items RLS gap). The IN set is exactly 11 bare-admin, single-case
-- DEFINER content writers. Everything else is OUT with a proven reason:
--   • interview/session family  -> routes assert_interview_writable -> can_write_interview
--     (carries `NOT is_case_excluded` before every arm) — GUARDED.
--   • assign_case_tag / *_committee_action_item (create/update/advance) / save_narrative_body
--     -> route can_write_case_content / can_write_case_narrative — GUARDED.
--   • declare_conflict / get_case_detail -> route can_read_case — GUARDED (get_case_detail's
--     read deny degrades to "não encontrado" before its lazy write; a DENY, not a leak).
--   • *_committee_action_item_checklist -> can_write_action_item_stake -> can_read_action_item
--     (carries the deny where a case anchor exists) — GUARDED.
--   • create_case / create_case_from_template / notify_safety_event — CREATION (no prior
--     recusal can exist).
--   • compute_case_phase_result / recompute_case_status — `app`-schema, not PostgREST-served.
--   • sync_case_phase_on_submit — a trigger function, not independently callable.
--   • already carry assert_not_case_excluded — create_interview (U1), set_case_visibility (M6),
--     set_case_confidentiality, set_participant_patient, dispose_case_phi, delete_ad_hoc_*.
--
-- OUT of Unit 2, recorded as residuals (lead ruling):
--   • recompute_recommendations — reachable + ungated. The contract proposed REVOKE
--     ("0 client callers"), but execution falsified it: two INVOKER SQL callers
--     (add_ad_hoc_phase, skip_phase) call it directly, so authenticated must keep
--     EXECUTE. Fixed by GUARD instead (§③) — closes the direct recused-call leak,
--     leaves every legitimate caller untouched.
--   • meeting family (conclude/reopen/dispose/sign_meeting) — `meetings` is COMMISSION-scoped
--     (no case_id); per-linked-case exclusion would block a coordinator recused from ONE case
--     in a multi-case meeting from concluding it (§7.7 bind-too-much). A commission-governance
--     scope question for the PO, recorded in the handoff — NOT a uniform-guard target here.
--
-- WHAT SHIPS:
--   ①  §2a — 10 uniform guards. `assert_not_case_excluded(<resolved case>)` IMMEDIATELY
--          after the 42501 authority raise, before any HC0xx state check. Placement is
--          load-bearing: activate_phase reaches HC020/HC019 PAST authority. The 10 tables'
--          RLS already carries the deny, so this restores parity on the DEFINER path (M6/U1).
--          Bodies re-emitted from LIVE pg_get_functiondef + the guard line (+ a case-id
--          SELECT where the body didn't already resolve one). `create or replace` keeps ACLs.
--   ②  §2b — delete_committee_action_item BOTH LAYERS (the A4-flagged C7 gap). action_items'
--          write RLS did NOT carry the case-exclusion AND `authenticated` holds direct DELETE,
--          so a raw PostgREST DELETE of a case_restricted item by a recused staff_admin leaks
--          past the RPC entirely (BUG-SUP-002 shape). Fix: conditional RPC guard (only when a
--          case anchor exists) AND the case-exclusion term on action_items_staff_admin_write
--          for case-anchored rows. Non-case-anchored rows (source_case_id/case_id both null:
--          committee/manual items) stay unrestricted — the §7.7 twin.
--   ③  §③ — GUARD recompute_recommendations (assert_not_case_excluded at the top). NOT a
--          revoke: it has live INVOKER callers, so authenticated must keep EXECUTE.
--
-- Forward-only. LOCAL. pgTAP keystones: supabase/tests/237_authz_exclusion_perimeter_u2.sql.
-- Mutation audit: supabase/tests/mutation/u2-mutation-audit.sh (each guard + the RLS term +
-- the revoke proven RED when reverted, individually).
-- =============================================================================

-- ① ── §2a · UNIFORM CONTENT-WRITE GUARDS (10) ───────────────────────────────

-- ── PHASES ───────────────────────────────────────────────────────────────────

create or replace function public.activate_phase(p_case_phase_id uuid, p_assigned_to uuid, p_due_date date default null::date)
 returns case_phases
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case_id uuid;
  v_status text;
  v_case_status text;
  v_commission_id uuid;
  v_blocks integer[];
  v_blocking integer;
  v_result public.case_phases;
begin
  perform app.assert_cases_enabled();

  select cp.case_id, cp.status, cp.blocks, c.status, c.commission_id
    into v_case_id, v_status, v_blocks, v_case_status, v_commission_id
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_phase_id;

  if v_case_id is null then
    raise exception 'fase % não encontrada', p_case_phase_id using errcode = 'no_data_found';
  end if;
  -- Authority (DEFINER now bypasses RLS -> explicit gate): coordinator/commission-
  -- admin OR an Administrativo with assign_case_phases.
  if not (app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)
          or app.member_can(v_commission_id, 'assign_case_phases')) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- EXCLUSION PERIMETER (Unit 2): AFTER authority, BEFORE the HC020/HC019 state
  -- checks a recused coordinator would otherwise reach past authority.
  perform app.assert_not_case_excluded(v_case_id);
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'este caso não está aberto' using errcode = 'HC020';
  end if;
  if v_status <> 'pending' then
    raise exception 'esta fase não está pendente' using errcode = 'HC019';
  end if;

  if v_blocks is not null and cardinality(v_blocks) > 0 then
    select count(*) into v_blocking
    from public.case_phases
    where case_id = v_case_id
      and position = any(v_blocks)
      and status not in ('completed', 'not_required');
    if v_blocking > 0 then
      raise exception 'conclua ou marque as fases que bloqueiam esta antes de ativá-la'
        using errcode = 'HC018';
    end if;
  end if;

  if not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set status = 'active',
      assigned_to = p_assigned_to,
      due_date = p_due_date,
      activated_at = now(),
      updated_at = now()
  where id = p_case_phase_id
  returning * into v_result;
  perform set_config('app.in_case_rpc', 'off', true);

  -- ADR 0061 (revised): assignment grants the assignee phase-form write (via
  -- assigned_to + answers_write_own_draft) and case READ (via can_read_case's
  -- assignee arm) — NO case_access WRITE auto-grant. Case-content write stays the
  -- coordinator's explicit grant_case_access. (DEFINER + the assign_case_phases gate
  -- are still required: the update bypasses case_phases_staff_admin_write, so the
  -- internal gate is the authority admitting an Administrativo to assign.)
  return v_result;
end;
$function$;

create or replace function public.reassign_phase(p_case_phase_id uuid, p_new_assignee uuid, p_due_date date default null::date)
 returns case_phases
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case_id uuid;
  v_case_status text;
  v_commission_id uuid;
  v_has_response boolean;
  v_result public.case_phases;
begin
  perform app.assert_cases_enabled();

  -- (Unit 2: resolve cp.case_id for the exclusion guard.)
  select cp.case_id, c.status, c.commission_id
    into v_case_id, v_case_status, v_commission_id
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_phase_id;

  if v_commission_id is null then
    raise exception 'fase % não encontrada', p_case_phase_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)
          or app.member_can(v_commission_id, 'assign_case_phases')) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- EXCLUSION PERIMETER (Unit 2).
  perform app.assert_not_case_excluded(v_case_id);
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'este caso não está aberto' using errcode = 'HC020';
  end if;

  select exists (
    select 1 from public.responses where case_phase_id = p_case_phase_id
  ) into v_has_response;
  if v_has_response then
    raise exception 'não é possível redefinir o responsável após o início do preenchimento'
      using errcode = 'HC019';
  end if;

  if not app.is_member_of_for(v_commission_id, p_new_assignee) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set assigned_to = p_new_assignee,
      due_date = p_due_date,
      updated_at = now()
  where id = p_case_phase_id
  returning * into v_result;
  perform set_config('app.in_case_rpc', 'off', true);

  return v_result;
end;
$function$;

create or replace function public.set_case_phase_result_override(p_case_phase_id uuid, p_result_id uuid, p_reason text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case_id uuid;
  v_commission_id uuid;
  v_phase_status text;
  v_case_status text;
  v_assigned_to uuid;
  v_position integer;
  v_is_staff_admin boolean;
  v_ruleset jsonb;
  v_emits boolean;
  v_is_manual boolean;
begin
  perform app.assert_phase_results_enabled();

  select cp.case_id, cp.status, cp.assigned_to, cp.position, c.commission_id, c.status,
         cp.result_ruleset, cp.emits_result
    into v_case_id, v_phase_status, v_assigned_to, v_position, v_commission_id, v_case_status,
         v_ruleset, v_emits
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_phase_id;

  if v_case_id is null then
    raise exception 'fase % não encontrada', p_case_phase_id using errcode = 'no_data_found';
  end if;

  v_is_staff_admin := app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id);
  v_is_manual := coalesce(v_emits, false) and v_ruleset is null;

  if v_phase_status not in ('active', 'completed') then
    raise exception 'o resultado só pode ser ajustado em uma fase ativa ou concluída'
      using errcode = 'HC057';
  end if;

  if v_phase_status = 'active' then
    if not (v_assigned_to = auth.uid() or v_is_staff_admin) then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
  else
    if not v_is_staff_admin then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
    if v_case_status in ('completed', 'cancelled') then
      raise exception 'este caso está em um estado final e não pode mais ser alterado'
        using errcode = 'HC060';
    end if;
  end if;

  -- EXCLUSION PERIMETER (Unit 2): after BOTH authority branches resolve (the active
  -- branch also admits the assignee — a recused assignee is denied here too),
  -- before the result-option validation.
  perform app.assert_not_case_excluded(v_case_id);

  -- MANUAL phase: the result is the filler's pick over the ALLOWED subset, so it
  -- is MANDATORY (cannot be cleared) and must be one of the allowed options. An
  -- AUTOMATIC phase's override is a staff adjustment with full flexibility (any
  -- active result, clearable → revert to the computed result).
  if v_is_manual then
    if p_result_id is null then
      raise exception 'o resultado desta fase é obrigatório e não pode ser removido'
        using errcode = 'HC062';
    end if;
    -- D3: the allowed subset now lives in case_phase_allowed_results (was
    -- case_phases.allowed_result_ids jsonb). Empty set ⇒ no allowed restriction.
    if exists (
         select 1 from public.case_phase_allowed_results
         where case_phase_id = p_case_phase_id
       )
       and not exists (
         select 1 from public.case_phase_allowed_results
         where case_phase_id = p_case_phase_id and result_id = p_result_id
       ) then
      raise exception 'o resultado escolhido não está entre as opções permitidas para esta fase'
        using errcode = 'HC058';
    end if;
  end if;

  -- A non-null result must resolve to a NON-ARCHIVED option in the commission.
  if p_result_id is not null and not exists (
    select 1 from public.phase_results
    where id = p_result_id and commission_id = v_commission_id and archived = false
  ) then
    raise exception 'opção de resultado inválida para esta comissão'
      using errcode = 'HC058';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set result_override_id = p_result_id,
      result_override_by = case when p_result_id is null then null else auth.uid() end,
      result_override_at = case when p_result_id is null then null else now() end,
      result_override_reason = case when p_result_id is null then null else nullif(btrim(p_reason), '') end,
      updated_at = now()
  where id = p_case_phase_id;
  perform set_config('app.in_case_rpc', 'off', true);

  perform app.audit_write(
    'case_phase.result_override_set', 'case_phase', p_case_phase_id, v_commission_id,
    'Resultado da fase ' || v_position || ' ajustado manualmente',
    jsonb_build_object('result_override_id', p_result_id));

  if v_phase_status = 'completed' then
    perform app.compute_case_phase_result(p_case_phase_id);
    -- ADR 0043: the concluded phase's EFFECTIVE result just changed/cleared —
    -- re-flip downstream result-based recommendations against it.
    perform public.recompute_recommendations(v_case_id);
  end if;
end;
$function$;

-- ── NARRATIVES ─────────────────────────────────────────────────────────────

create or replace function public.add_ad_hoc_narrative(p_case_id uuid, p_narrative_type_id uuid default null::uuid, p_new_type_label text default null::text, p_title text default null::text, p_instructions text default null::text, p_assigned_to uuid default null::uuid)
 returns case_narratives
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
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
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'este caso não está aberto' using errcode = 'HC020';
  end if;

  -- Coordinator gate.
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- EXCLUSION PERIMETER (Unit 2): after authority (which here follows the HC020
  -- state check — placement is per-RPC).
  perform app.assert_not_case_excluded(p_case_id);

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
     false, true, 'open', auth.uid(), p_assigned_to)
  returning * into v_result;
  perform set_config('app.in_narrative_rpc', 'off', true);

  return v_result;
end;
$function$;

create or replace function public.assign_narrative(p_narrative uuid, p_assignee uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case_id uuid;
  v_commission uuid;
  v_case_status text;
  v_status text;
begin
  perform app.assert_case_access_enabled();

  select cn.case_id, c.commission_id, c.status, cn.status
    into v_case_id, v_commission, v_case_status, v_status
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_case_id is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- EXCLUSION PERIMETER (Unit 2).
  perform app.assert_not_case_excluded(v_case_id);
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;
  if v_status <> 'open' then
    raise exception 'a narrativa não está no estado necessário para esta ação'
      using errcode = 'HC055';
  end if;
  if not app.is_member_of_for(v_commission, p_assignee) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives set assigned_to = p_assignee, updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$function$;

create or replace function public.conclude_narrative(p_narrative uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case_id uuid;
  v_commission uuid;
  v_case_status text;
  v_status text;
  v_assigned uuid;
begin
  perform app.assert_case_access_enabled();

  -- (Unit 2: resolve cn.case_id for the exclusion guard.)
  select cn.case_id, c.commission_id, c.status, cn.status, cn.assigned_to
    into v_case_id, v_commission, v_case_status, v_status, v_assigned
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_status is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  -- The assignee OR a coordinator/admin may conclude.
  if not (v_assigned = auth.uid()
          or app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- EXCLUSION PERIMETER (Unit 2): a recused assignee/coordinator cannot conclude.
  perform app.assert_not_case_excluded(v_case_id);

  -- <- M5b defect 3. AFTER the authority check, never before: a deactivated
  -- NON-assignee must still fail on 42501, so a wrong-arm fixture cannot pass
  -- this gate's keystone by accident (A33).
  if not app.is_active(auth.uid()) then
    raise exception 'sua conta está inativa ou suspensa' using errcode = 'HC0F4';
  end if;
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;
  if v_status <> 'open' then
    raise exception 'a narrativa não está no estado necessário para esta ação'
      using errcode = 'HC055';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives
  set status = 'completed', concluded_at = now(), concluded_by = auth.uid(),
      updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$function$;

create or replace function public.reopen_narrative(p_narrative uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case_id uuid;
  v_commission uuid;
  v_case_status text;
  v_status text;
begin
  perform app.assert_case_access_enabled();

  -- (Unit 2: resolve cn.case_id for the exclusion guard.)
  select cn.case_id, c.commission_id, c.status, cn.status
    into v_case_id, v_commission, v_case_status, v_status
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_status is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- EXCLUSION PERIMETER (Unit 2).
  perform app.assert_not_case_excluded(v_case_id);
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;
  if v_status <> 'completed' then
    raise exception 'a narrativa não está no estado necessário para esta ação'
      using errcode = 'HC055';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives
  set status = 'open', concluded_at = null, concluded_by = null, updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$function$;

create or replace function public.unassign_narrative(p_narrative uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case_id uuid;
  v_commission uuid;
  v_case_status text;
begin
  perform app.assert_case_access_enabled();

  select cn.case_id, c.commission_id, c.status
    into v_case_id, v_commission, v_case_status
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_case_id is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- EXCLUSION PERIMETER (Unit 2).
  perform app.assert_not_case_excluded(v_case_id);
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives set assigned_to = null, updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$function$;

-- ── CASE META / OUTCOMES ─────────────────────────────────────────────────────

create or replace function public.update_case_meta(p_case_id uuid, p_label text default null::text, p_department_id uuid default null::uuid, p_department_other text default null::text)
 returns cases
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_commission uuid;
  v_status text;
  v_case public.cases;
  v_dept_other text := nullif(btrim(p_department_other), '');
begin
  perform app.assert_cases_enabled();

  select commission_id, status into v_commission, v_status
  from public.cases where id = p_case_id;
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;

  -- Authority: coordinator/commission-admin (flag-independent), OR an Administrativo
  -- with create_cases (flag-gated — the cap arm asserts the feature).
  if app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission) then
    null;
  elsif app.member_can(v_commission, 'create_cases') then
    perform app.assert_administrativo_enabled();
  else
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- EXCLUSION PERIMETER (Unit 2): after the authority block resolves, before HC025.
  perform app.assert_not_case_excluded(p_case_id);

  -- A terminal case is frozen (HC025) — no meta edits after conclude/cancel.
  if v_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC025';
  end if;

  -- Department shape + hospital ownership (same rules as create_case).
  if p_department_id is not null and v_dept_other is not null then
    raise exception 'informe um setor da lista OU um valor personalizado, não ambos'
      using errcode = '23514';
  end if;
  if p_department_id is not null
     and not app.department_belongs_to_commission(p_department_id, v_commission) then
    raise exception 'este setor não pertence ao hospital deste caso'
      using errcode = 'HC030';
  end if;

  update public.cases
  set label = nullif(btrim(p_label), ''),
      department_id = p_department_id,
      department_other = v_dept_other
  where id = p_case_id
  returning * into v_case;

  return v_case;
end;
$function$;

create or replace function public.set_case_offered_outcomes(p_case_id uuid, p_outcome_ids uuid[])
 returns void
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_commission uuid;
  v_status text;
  v_assigned uuid;
  v_bad uuid;
begin
  perform app.assert_cases_enabled();
  perform app.assert_extras_enabled();

  select commission_id, status, outcome_id
    into v_commission, v_status, v_assigned
  from public.cases where id = p_case_id;
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;

  if not (app.is_staff_admin_of(v_commission) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- EXCLUSION PERIMETER (Unit 2): after authority, before HC025. (is_admin() =
  -- platform_admin, who is never a case participant, so the guard is a no-op for
  -- that arm and fires only for a recused/respondent staff_admin.)
  perform app.assert_not_case_excluded(p_case_id);

  if v_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC025';
  end if;

  -- Same-commission + non-archived validation (the HC030 idiom).
  if cardinality(p_outcome_ids) > 0 then
    select oid into v_bad
    from unnest(p_outcome_ids) as oid
    where not exists (
      select 1 from public.case_outcomes o
      where o.id = oid
        and o.commission_id = v_commission
        and o.archived = false
    )
    limit 1;
    if found then
      raise exception 'este desfecho não pertence à comissão deste caso'
        using errcode = 'HC030';
    end if;
  end if;

  -- EDGE: the outcome currently ASSIGNED to the case cannot be dropped from the
  -- offered list — change the case's outcome first.
  if v_assigned is not null and not (v_assigned = any(p_outcome_ids)) then
    raise exception 'o desfecho atualmente atribuído a este caso não pode ser removido da lista de desfechos disponíveis; altere o desfecho do caso antes'
      using errcode = 'HC029';
  end if;

  -- Delete-then-insert (no in_case_rpc guard — this touches the join table, not
  -- cases). '{}' clears the set.
  delete from public.case_offered_outcomes where case_id = p_case_id;

  insert into public.case_offered_outcomes (case_id, outcome_id)
  select p_case_id, oid from unnest(p_outcome_ids) as oid
  on conflict do nothing;

  -- One PHI-free mutation audit row (no-ops while audit_trail is off).
  perform app.audit_write(
    'case.offered_outcomes_set', 'case', p_case_id, v_commission,
    'Desfechos disponíveis do caso atualizados',
    jsonb_build_object('count', cardinality(p_outcome_ids))
  );
end;
$function$;

-- ② ── §2b · delete_committee_action_item — BOTH LAYERS (C7 gap) ──────────────

-- RPC layer: conditional guard — case-anchored items only. Committee/manual items
-- (no case anchor) keep bare-admin authority (the §7.7 twin).
create or replace function public.delete_committee_action_item(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_commission_id uuid;
  v_source_type text;
  v_source_case_id uuid;
  v_case_id uuid;
  v_anchor_case uuid;
begin
  if not app.feature_enabled('action_items') then
    raise exception 'recurso indisponível' using errcode = 'HC000';
  end if;
  select commission_id, source_type, source_case_id, case_id
    into v_commission_id, v_source_type, v_source_case_id, v_case_id
  from public.action_items where id = p_id;
  if v_commission_id is null then
    raise exception 'item de ação não encontrado' using errcode = 'no_data_found';
  end if;
  -- Delete authority is staff_admin/org_admin for ALL sources (Q6). A case row's
  -- delete is additionally gated by cases_extras (Q8).
  if v_source_type = 'case' then
    perform app.assert_extras_enabled();
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- EXCLUSION PERIMETER (Unit 2, §2b): case-anchored items only. A recused/respondent
  -- coordinator cannot delete an action item belonging to the case she is excluded
  -- from. Non-case-anchored (committee/manual) items are unaffected — the §7.7 twin.
  v_anchor_case := coalesce(v_source_case_id, v_case_id);
  if v_anchor_case is not null then
    perform app.assert_not_case_excluded(v_anchor_case);
  end if;

  -- Cascades to assignments + status_history; fires the delete audit trigger.
  delete from public.action_items where id = p_id;
end;
$function$;

-- Table layer (BUG-SUP-002): `authenticated` holds direct DELETE and the write RLS
-- did NOT carry the case-exclusion, so a raw PostgREST DELETE walked around the RPC.
-- Add the exclusion term for case-anchored rows to BOTH USING (governs DELETE) and
-- WITH CHECK (governs INSERT/UPDATE). Anchor = coalesce(source_case_id, case_id),
-- mirroring can_read_action_item. Null-anchor rows stay unrestricted.
alter policy action_items_staff_admin_write on public.action_items
  using (
    (app.is_staff_admin_of(commission_id)
     or (app.is_commission_admin_of(commission_id) and (visibility_scope is distinct from 'case_restricted')))
    and (
      coalesce(source_case_id, case_id) is null
      or not app.is_case_excluded(coalesce(source_case_id, case_id), (select auth.uid()))
    )
  )
  with check (
    (app.is_staff_admin_of(commission_id)
     or (app.is_commission_admin_of(commission_id) and (visibility_scope is distinct from 'case_restricted')))
    and (
      coalesce(source_case_id, case_id) is null
      or not app.is_case_excluded(coalesce(source_case_id, case_id), (select auth.uid()))
    )
  );

-- ③ ── §③ · recompute_recommendations — GUARD (NOT revoke — premise corrected) ─
-- The contract proposed REVOKE on a "door-to-nowhere" (0 client .rpc() callers). That
-- premise was FALSIFIED by execution: recompute_recommendations has TWO live INVOKER
-- SQL callers — public.add_ad_hoc_phase and public.skip_phase (prosecdef=f) — which
-- call it directly, so `authenticated` MUST retain EXECUTE (a revoke aborts them with
-- "permission denied for function recompute_recommendations"; proven, breaks 178/90/…).
-- The "0 callers" count saw client callers, not SQL invoker callers (§7.13 in the
-- revoke's own premise). So the door is NOT unused, and the correct fix is the GUARD
-- the contract reasoned away: `assert_not_case_excluded` at the top closes the
-- direct recused-call leak while every legitimate caller (the two invokers + the
-- DEFINER callers: set_case_phase_result_override / sync_case_phase_on_submit /
-- create_case_from_template / delete_ad_hoc_case_phase) runs as a NON-excluded user
-- and passes untouched. auth.uid() is unchanged by SECURITY DEFINER, so the guard
-- reads the original caller throughout.
--
-- Re-emitted from the LIVE definition via pg_get_functiondef + a single injected guard
-- (the codebase idiom; forward-only, captures the applied-migration body, never stale
-- migration text). Anchor: the sole `in_case_rpc 'on'` set_config at the body head.
do $wrap$
declare d text;
begin
  d := pg_get_functiondef('public.recompute_recommendations(uuid)'::regprocedure);
  d := replace(
    d,
    E'begin\n  perform set_config(\'app.in_case_rpc\', \'on\', true);',
    E'begin\n  -- EXCLUSION PERIMETER (Unit 2, §3): a recused/respondent coordinator cannot\n'
    || E'  -- trigger a recompute on the case she is excluded from. No-op for every\n'
    || E'  -- legitimate caller (all run as a non-excluded user); fires only on a direct\n'
    || E'  -- recused call.\n'
    || E'  perform app.assert_not_case_excluded(p_case_id);\n'
    || E'  perform set_config(\'app.in_case_rpc\', \'on\', true);');
  if position('assert_not_case_excluded' in d) = 0 then
    raise exception 'U2 §3: guard injection anchor not found — recompute body changed';
  end if;
  execute d;
end $wrap$;
