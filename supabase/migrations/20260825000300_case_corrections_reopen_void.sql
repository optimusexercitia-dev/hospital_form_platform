-- Case Correction Lifecycle — BE-4 voided blocks-sweep + reopen_case + retire reopen_narrative.
--
-- Final DB unit. Makes the terminal `voided` phase state settle blocking phases,
-- adds the reopen_case door (the composition the correction design promises: a
-- concluded case can be reopened, then corrected), and retires the in-place
-- reopen_narrative door that the narrative revision/void flow replaces.
--
-- All prior bodies authored from the LIVE catalog (activate_phase, guard_case_status),
-- never migration file text.

-- ---------------------------------------------------------------------------
-- 1. Blocks sweep — a `voided` blocking phase is SETTLED (does not block).
--    activate_phase holds the only "blocking phase settled" predicate; close_case /
--    cancel_case use the (pending|active) unsettled set (voided already passes) and
--    recompute_case_status ignores voided (neither active nor completed) — both
--    correct as-is, verified against the live bodies.
-- ---------------------------------------------------------------------------
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
      -- BE-4: a `voided` blocking phase is settled, exactly like completed / not_required.
      and status not in ('completed', 'not_required', 'voided');
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

  return v_result;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. guard_case_status — allow the reopen transition (completed → open) under a
--    scoped app.in_reopen_rpc flag; cancelled stays terminal-forever. Everything
--    else byte-identical to the live body.
-- ---------------------------------------------------------------------------
create or replace function app.guard_case_status()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_case_rpc', true), 'off') = 'on';
begin
  if tg_op = 'DELETE' then
    if old.status in ('completed', 'cancelled') then
      raise exception 'cases in a terminal state are immutable (delete blocked)'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- A status change is only permitted inside a vetted RPC / the recompute trigger.
  if new.status is distinct from old.status then
    if not v_in_rpc then
      raise exception 'case status changes must go through the case RPCs'
        using errcode = 'check_violation';
    end if;
    -- A terminal case is frozen — EXCEPT a `completed` case being reopened through
    -- reopen_case (app.in_reopen_rpc). `cancelled` is terminal-forever.
    if old.status = 'cancelled'
       or (old.status = 'completed'
           and coalesce(current_setting('app.in_reopen_rpc', true), 'off') <> 'on') then
      raise exception 'este caso está em um estado final e não pode mais ser alterado'
        using errcode = 'HC025';
    end if;
    -- Validity of the NEW value is the column CHECK's job (no transition matrix).
    return new;
  end if;

  -- A non-status update is forbidden once the case is terminal.
  if old.status in ('completed', 'cancelled') and not v_in_rpc then
    raise exception 'cases in a terminal state are immutable (update blocked)'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. reopen_case — reopen a COMPLETED case so it can be corrected. cancelled is
--    terminal-forever (HC0M8). Recompute trap: set a non-terminal placeholder
--    FIRST (recompute_case_status early-returns on a terminal status), then settle
--    the real derived status. outcome_id preserved. Reason is a mandatory input
--    but NOT persisted (see the BE-4 report — Rule 11 + PHI-free `cases` posture).
-- ---------------------------------------------------------------------------
create or replace function public.reopen_case(p_case_id uuid, p_reason text)
returns cases
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_status text; v_commission uuid; v_reason text; v_result public.cases;
begin
  perform app.assert_case_corrections_enabled();

  v_commission := app.commission_of_case(p_case_id);
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  perform app.assert_not_case_excluded(p_case_id);
  if not app.is_active(auth.uid()) then
    raise exception 'sua conta está inativa ou suspensa' using errcode = 'HC0F4';
  end if;

  select status into v_status from public.cases where id = p_case_id;
  if v_status = 'cancelled' then
    raise exception 'caso cancelado é definitivo' using errcode = 'HC0M8';
  end if;
  if v_status <> 'completed' then
    raise exception 'apenas casos concluídos podem ser reabertos' using errcode = 'check_violation';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'informe o motivo da reabertura' using errcode = 'check_violation';
  end if;

  -- Placeholder (non-terminal) so recompute_case_status will run; clear closed_*.
  perform set_config('app.in_case_rpc', 'on', true);
  perform set_config('app.in_reopen_rpc', 'on', true);
  update public.cases
    set status = 'pending', closed_at = null, closed_by = null
    where id = p_case_id;
  perform set_config('app.in_reopen_rpc', 'off', true);
  perform set_config('app.in_case_rpc', 'off', true);

  -- Settle the real derived status from the phases (in_review / pending / not_started).
  perform app.recompute_case_status(p_case_id);

  select * into v_result from public.cases where id = p_case_id;

  -- Structured audit only; the free-text reason is NOT logged (Rule 11).
  perform app.audit_write('case.reopened', 'case', p_case_id, v_commission,
    'Caso reaberto', jsonb_build_object('previous_status', 'completed'));

  return v_result;
end;
$function$;

revoke all on function public.reopen_case(uuid, text) from public;
grant execute on function public.reopen_case(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Retire reopen_narrative — the in-place narrative rewrite door is replaced by
--    the correction revision/void flow (BE-3). No pg_proc / RLS references remain.
--    The `reopenNarrative` TS action removal is BE-5 (contracts unit) so lint does
--    not break mid-unit; the RPC name is a string, so typecheck is unaffected.
-- ---------------------------------------------------------------------------
drop function if exists public.reopen_narrative(uuid);

-- ---------------------------------------------------------------------------
-- 5. Fix a BE-1 defect: the case_correction_requests / case_narrative_revisions
--    RLS SELECT policies were DEAD — `authenticated` was never granted SELECT (the
--    BE-1 `revoke insert/update/delete` left the tables with zero authenticated
--    privileges; unlike sibling case tables, no default-privilege grant applied).
--    Grant SELECT so the read policies (can_read_case-scoped) actually serve rows;
--    writes stay DEFINER-door-only (no write grant + the write guard).
-- ---------------------------------------------------------------------------
grant select on public.case_correction_requests to authenticated;
grant select on public.case_narrative_revisions to authenticated;
