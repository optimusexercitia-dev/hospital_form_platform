-- Case data-model adjustments (2 of 4): the FIXED five-value case status +
-- auto-recompute trigger + guard rewrite + the dropped-helper re-replacements
-- (decisions D6, D7, the status precedence, and the 092001 liveness-sweep
-- landmine).
--
-- 093000 dropped the configurable status system. This migration installs the
-- replacement:
--   1. Defensive normalization of cases.status (so the additive CHECK applies on
--      the remote dev DB), then the fixed CHECK + 'nao_iniciado' default.
--   2. app.recompute_case_status(case) + an AFTER trigger on case_phases that
--      auto-derives the three non-terminal statuses from phase state; the two
--      terminal statuses (concluido/cancelado) stay MANUAL (D6).
--   3. app.guard_case_status rewritten to the fixed model (no case_status_defs /
--      case_status_is_terminal; validity delegated to the column CHECK).
--   4. THE LANDMINE: every function the 092001 liveness sweep pointed at the
--      now-dropped app.case_status_is_terminal must be re-CREATE-OR-REPLACEd with
--      a plain fixed-enum terminal check, or it fails at runtime. The functions
--      finalized HERE: sync_case_phase_on_submit, skip_phase, add_ad_hoc_phase,
--      reassign_phase, cancel_case.
--      activate_phase + create_case_from_template are ALSO on that list but are
--      additionally touched by phase blockers (093002) / outcomes (093003), so
--      to keep ONE final definition per function they are restated in their final
--      form there (093002 for activate_phase; 093003 for create_case_from_template
--      and the D3-gated close_case). They are intentionally ABSENT from this file.
--
-- The 'aberto' macro status was already renamed away in R2; the keys that survive
-- into the fixed model are concluido / cancelado / em_revisao (kept) plus the new
-- nao_iniciado / pendente. ADDITIVE / forward-only; no edits to pushed files.
--
-- ACL hazard (ADR 0020 / 090012-15 / 092001): `CREATE OR REPLACE` RESETS a
-- function's ACL to the default (which re-grants PUBLIC), so every public function
-- restated here is re-revoked from anon + public at the end.

-- ===========================================================================
-- 0. Rewrite guard_case_status FIRST so the normalization UPDATE below doesn't
--    crash: the old guard body calls app.case_status_is_terminal which was
--    dropped by 093000. Replace it with the fixed-enum version before any row
--    is touched. (The full comment block for §3 stays below at its original
--    position for readability; this is just an early CREATE OR REPLACE.)
-- ===========================================================================
create or replace function app.guard_case_status()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_case_rpc', true), 'off') = 'on';
begin
  if tg_op = 'DELETE' then
    if old.status in ('concluido', 'cancelado') then
      raise exception 'cases in a terminal state are immutable (delete blocked)'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if new.status is distinct from old.status then
    if not v_in_rpc then
      raise exception 'case status changes must go through the case RPCs'
        using errcode = 'check_violation';
    end if;
    if old.status in ('concluido', 'cancelado') then
      raise exception 'este caso está em um estado final e não pode mais ser alterado'
        using errcode = 'HC025';
    end if;
    return new;
  end if;

  if old.status in ('concluido', 'cancelado') and not v_in_rpc then
    raise exception 'cases in a terminal state are immutable (update blocked)'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- ===========================================================================
-- 1. cases.status — defensive normalization, then the fixed CHECK + default
-- ===========================================================================
-- Runs BEFORE the CHECK is added. On a fresh `db reset` no row violates the new
-- set (the seed leaves the default), so this is a harmless no-op; on the remote
-- dev DB a case may still hold an old R2 key (em_andamento / rascunho) or the
-- legacy 'aberto', which would make the additive CHECK fail — normalize them to
-- 'nao_iniciado' first. (A terminal concluido/cancelado or an em_revisao row is
-- already valid and untouched.)
set local app.in_case_rpc = 'on';
update public.cases
set status = 'nao_iniciado'
where status not in ('nao_iniciado', 'pendente', 'em_revisao', 'concluido', 'cancelado');
reset app.in_case_rpc;

-- The default flips to the fixed initial 'nao_iniciado' (a fresh case with no
-- phase activity). 092000 had DROPPED cases_status_check; re-add it here under the
-- same name with the fixed five-value set.
alter table public.cases alter column status set default 'nao_iniciado';

alter table public.cases
  add constraint cases_status_check
  check (status in ('nao_iniciado', 'pendente', 'em_revisao', 'concluido', 'cancelado'));

-- ===========================================================================
-- 2. app.recompute_case_status(case_id) + the AFTER trigger on case_phases
-- ===========================================================================
-- The single authority for the THREE auto-computed statuses (D7 + the
-- precedence). SECURITY DEFINER so it can write cases under a pinned search_path
-- regardless of the caller's RLS (it is fired from the phase-status trigger).
--
-- Rules:
--   * EARLY-RETURN if the case is already terminal (concluido/cancelado) — the
--     manual D6 actions are never overridden by recompute.
--   * else: any phase 'ativa'      -> 'em_revisao'
--           else >=1 phase 'concluida' -> 'pendente'
--           else                    -> 'nao_iniciado'   (skip-only stays here, D7)
--   * write ONLY when the value actually changes (avoids needless trigger churn).
--
-- The write runs under app.in_case_rpc='on' so the rewritten guard_case_status
-- permits a status change. It touches ONLY status (never closed_at/closed_by —
-- those belong to the manual terminal actions).
create function app.recompute_case_status(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_old_status text;
  v_new_status text;
  v_has_active boolean;
  v_has_concluded boolean;
begin
  select status into v_old_status from public.cases where id = p_case_id;
  if v_old_status is null then
    return;  -- case gone (e.g. mid-cascade); nothing to do.
  end if;

  -- Never override a manual terminal status.
  if v_old_status in ('concluido', 'cancelado') then
    return;
  end if;

  select bool_or(status = 'ativa'), bool_or(status = 'concluida')
    into v_has_active, v_has_concluded
  from public.case_phases
  where case_id = p_case_id;

  if coalesce(v_has_active, false) then
    v_new_status := 'em_revisao';
  elsif coalesce(v_has_concluded, false) then
    v_new_status := 'pendente';
  else
    v_new_status := 'nao_iniciado';
  end if;

  if v_new_status is distinct from v_old_status then
    perform set_config('app.in_case_rpc', 'on', true);
    update public.cases set status = v_new_status where id = p_case_id;
    perform set_config('app.in_case_rpc', 'off', true);
  end if;
end;
$$;

revoke all on function app.recompute_case_status(uuid) from public;
grant execute on function app.recompute_case_status(uuid) to authenticated, service_role;

-- The thin trigger function: recompute the parent case whenever a phase's status
-- changes (or a phase is inserted). INSERT + UPDATE OF status ONLY — deliberately
-- NO DELETE event: when a case is deleted its phases cascade-delete, and a
-- DELETE-fired recompute would query a half-deleted case (the cascade hazard).
-- recompute_case_status itself early-returns when the case row is gone, but
-- omitting the DELETE event avoids the work + the edge entirely. Writes cases
-- only -> depth-1, no recursion (the cases AFTER side has no trigger writing
-- case_phases).
create function app.trg_recompute_case_status()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  perform app.recompute_case_status(new.case_id);
  return new;
end;
$$;

create trigger recompute_case_status_trg
  after insert or update of status on public.case_phases
  for each row execute function app.trg_recompute_case_status();

-- ===========================================================================
-- 3. app.guard_case_status — rewritten to the FIXED model
-- ===========================================================================
-- Same chokepoint shape as before (every status change funnels through a vetted
-- path that sets app.in_case_rpc), but the data-driven case_status_defs lookups
-- are gone:
--   * DELETE only while the case is NON-terminal.
--   * A status change requires in_case_rpc='on'; a terminal (concluido/cancelado)
--     case is frozen (HC025); the NEW value's validity is delegated to the column
--     CHECK (no transition matrix). Permitted writers: recompute_case_status (the
--     three auto statuses) and close_case/cancel_case (the two terminal actions).
--   * A non-status update (e.g. label, or set_case_outcome writing outcome_id) is
--     allowed while the case is non-terminal, and frozen once terminal (unless
--     under the flag). set_case_outcome pre-checks HC025 for a clean error, and
--     its bare outcome_id write on a live case falls through this branch (returns
--     new) — no app.in_case_rpc needed for a non-status column.
create or replace function app.guard_case_status()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_case_rpc', true), 'off') = 'on';
begin
  if tg_op = 'DELETE' then
    if old.status in ('concluido', 'cancelado') then
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
    -- A terminal case is frozen.
    if old.status in ('concluido', 'cancelado') then
      raise exception 'este caso está em um estado final e não pode mais ser alterado'
        using errcode = 'HC025';
    end if;
    -- Validity of the NEW value is the column CHECK's job (no transition matrix).
    return new;
  end if;

  -- A non-status update is forbidden once the case is terminal.
  if old.status in ('concluido', 'cancelado') and not v_in_rpc then
    raise exception 'cases in a terminal state are immutable (update blocked)'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- ===========================================================================
-- 4. THE LANDMINE — re-replace the liveness-sweep functions (fixed-enum check)
-- ===========================================================================
-- Each below is its CURRENT (post-092001) definition restated VERBATIM, with the
-- SOLE change being the case-liveness test:
--   app.case_status_is_terminal(commission_id, status)  ->  status in ('concluido','cancelado')
-- (activate_phase + create_case_from_template are finalized in 093002/093003.)

-- ---------------------------------------------------------------------------
-- sync_case_phase_on_submit — submit->advance trigger (fixed-enum liveness)
-- ---------------------------------------------------------------------------
-- A phase response flipping in_progress -> submitted advances the phase to
-- concluida, but only while the case is LIVE (not terminal). The ativa->concluida
-- UPDATE fires recompute_case_status_trg synchronously INSIDE this function's
-- app.in_case_rpc='on' window, so the cases write the recompute performs is
-- permitted by the guard; the macro status moves to 'pendente' (or stays
-- 'em_revisao' if another phase is still ativa) automatically. We no longer need
-- the commission_id for a terminal helper, but keep selecting it is harmless; to
-- minimise churn we drop it from the select and test the status directly.
create or replace function public.sync_case_phase_on_submit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_case_id uuid;
  v_case_status text;
begin
  -- Only react to a phase response transitioning to submitted.
  if new.case_phase_id is null
     or new.status <> 'submitted'
     or old.status = 'submitted' then
    return new;
  end if;

  select cp.case_id, c.status
    into v_case_id, v_case_status
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = new.case_phase_id;

  -- Stranded draft on a TERMINAL case: leave the phase as-is (inert).
  if v_case_status in ('concluido', 'cancelado') then
    return new;
  end if;

  -- Advance the phase under our OWN session flag (submit_response only set
  -- app.in_submit_rpc, which the phase guard does not honour). The phase UPDATE
  -- fires recompute_case_status_trg while this flag is on -> the macro status
  -- auto-advances.
  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set status = 'concluida', completed_at = now(), updated_at = now()
  where id = new.case_phase_id and status = 'ativa';
  perform set_config('app.in_case_rpc', 'off', true);

  -- Recompute downstream recommendations against the newly-submitted answers.
  perform public.recompute_recommendations(v_case_id);

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- skip_phase(case_phase) — fixed-enum liveness
-- ---------------------------------------------------------------------------
create or replace function public.skip_phase(p_case_phase_id uuid)
returns public.case_phases
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_case_id uuid;
  v_status text;
  v_case_status text;
  v_result public.case_phases;
begin
  perform app.assert_cases_enabled();

  select cp.case_id, cp.status, c.status
    into v_case_id, v_status, v_case_status
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_phase_id;

  if v_case_id is null then
    raise exception 'fase % não encontrada', p_case_phase_id using errcode = 'no_data_found';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'este caso não está aberto' using errcode = 'HC020';
  end if;
  if v_status <> 'pendente' then
    raise exception 'apenas fases pendentes podem ser marcadas como não necessárias'
      using errcode = 'HC019';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set status = 'nao_necessaria', skipped_at = now(), updated_at = now()
  where id = p_case_phase_id
  returning * into v_result;
  perform set_config('app.in_case_rpc', 'off', true);

  perform public.recompute_recommendations(v_case_id);

  return v_result;
end;
$$;

grant execute on function public.skip_phase(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- add_ad_hoc_phase(case, form, title, recommend_when, assigned_to) — fixed-enum
-- ---------------------------------------------------------------------------
create or replace function public.add_ad_hoc_phase(
  p_case_id uuid,
  p_form_id uuid,
  p_title text default null,
  p_recommend_when jsonb default null,
  p_assigned_to uuid default null
)
returns public.case_phases
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_case_status text;
  v_commission_id uuid;
  v_position integer;
  v_version uuid;
  v_from_phase integer;
  v_source_version uuid;
  v_result public.case_phases;
begin
  perform app.assert_cases_enabled();

  select status, commission_id into v_case_status, v_commission_id
  from public.cases where id = p_case_id;
  if v_case_status is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'este caso não está aberto' using errcode = 'HC020';
  end if;

  if not exists (
    select 1 from public.forms where id = p_form_id and commission_id = v_commission_id
  ) then
    raise exception 'o formulário não pertence a esta comissão' using errcode = 'check_violation';
  end if;

  v_version := app.published_version_of_form(p_form_id);
  if v_version is null then
    raise exception 'este formulário ainda não foi publicado' using errcode = 'HC017';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.case_phases where case_id = p_case_id;

  -- Validate recommend_when against the existing (earlier) phases' pinned versions.
  if p_recommend_when is not null then
    v_from_phase := (p_recommend_when ->> 'from_phase')::integer;
    if v_from_phase is null or v_from_phase < 1 or v_from_phase >= v_position then
      raise exception 'a recomendação deve referenciar uma fase anterior'
        using errcode = 'HC016';
    end if;
    select form_version_id into v_source_version
    from public.case_phases where case_id = p_case_id and position = v_from_phase;
    if v_source_version is null then
      raise exception 'a recomendação referencia uma fase inexistente'
        using errcode = 'HC016';
    end if;
    if not app.version_has_input_key(v_source_version, p_recommend_when ->> 'question_key') then
      raise exception 'a recomendação referencia uma pergunta inexistente no formulário de origem'
        using errcode = 'HC016';
    end if;
  end if;

  if p_assigned_to is not null and not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  insert into public.case_phases
    (case_id, position, form_id, form_version_id, title, recommend_when, is_ad_hoc, assigned_to)
  values
    (p_case_id, v_position, p_form_id, v_version, nullif(btrim(p_title), ''),
     p_recommend_when, true, p_assigned_to)
  returning * into v_result;
  perform set_config('app.in_case_rpc', 'off', true);

  perform public.recompute_recommendations(p_case_id);

  return v_result;
end;
$$;

grant execute on function public.add_ad_hoc_phase(uuid, uuid, text, jsonb, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- reassign_phase(case_phase, new_assignee, due_date) — fixed-enum liveness
-- ---------------------------------------------------------------------------
create or replace function public.reassign_phase(
  p_case_phase_id uuid,
  p_new_assignee uuid,
  p_due_date date default null
)
returns public.case_phases
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_case_status text;
  v_commission_id uuid;
  v_has_response boolean;
  v_result public.case_phases;
begin
  perform app.assert_cases_enabled();

  select c.status, c.commission_id
    into v_case_status, v_commission_id
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_phase_id;

  if v_commission_id is null then
    raise exception 'fase % não encontrada', p_case_phase_id using errcode = 'no_data_found';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
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
$$;

grant execute on function public.reassign_phase(uuid, uuid, date) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- cancel_case(case_id) — MANUAL terminal (anytime), fixed-enum, terminal-FIRST
-- ---------------------------------------------------------------------------
-- Replaces the 092001 thin wrapper (which called the now-dropped
-- app.apply_case_status/case_terminal_key). Cancellable anytime EXCEPT when the
-- case is already terminal (HC025). TERMINAL-FIRST ordering: set cases.status =
-- 'cancelado' + closed_* FIRST, THEN flip residual open phases to nao_necessaria
-- — so each phase flip fires recompute_case_status, which now sees a terminal
-- case and early-returns (the manual status is never clobbered). Keeps gating
-- ONLY cases_multi_phase. RLS cases_staff_admin_write is the authority (SECURITY
-- INVOKER; a non-staff_admin's status UPDATE is denied -> 0 rows -> not-found).
create or replace function public.cancel_case(p_case_id uuid)
returns public.cases
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_status text;
  v_result public.cases;
begin
  perform app.assert_cases_enabled();

  select status into v_status from public.cases where id = p_case_id;
  if v_status is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if v_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC025';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  -- Terminal FIRST: freeze the case, then the phase flips' recompute no-ops.
  update public.cases
  set status = 'cancelado', closed_at = now(), closed_by = auth.uid()
  where id = p_case_id
  returning * into v_result;

  update public.case_phases
  set status = 'nao_necessaria', skipped_at = coalesce(skipped_at, now()), updated_at = now()
  where case_id = p_case_id and status in ('pendente', 'ativa');

  perform set_config('app.in_case_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.cancel_case(uuid) to authenticated, service_role;

-- ===========================================================================
-- Re-revoke anon/PUBLIC EXECUTE on every public function CREATE-OR-REPLACEd above
-- ===========================================================================
-- `CREATE OR REPLACE` resets the ACL (re-granting PUBLIC); re-close it (pgTAP
-- 100_dashboard test 19 enforces zero anon-executable public functions).
-- sync_case_phase_on_submit is a trigger function (no direct EXECUTE grant), but
-- revoking PUBLIC on it is harmless and keeps the sweep uniform.
revoke execute on function public.sync_case_phase_on_submit() from anon, public;
revoke execute on function public.skip_phase(uuid) from anon, public;
revoke execute on function public.add_ad_hoc_phase(uuid, uuid, text, jsonb, uuid) from anon, public;
revoke execute on function public.reassign_phase(uuid, uuid, date) from anon, public;
revoke execute on function public.cancel_case(uuid) from anon, public;
