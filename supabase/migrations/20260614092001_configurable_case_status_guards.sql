-- Cases-Extras batch / R2 (2 of 2): configurable-case-status GUARDS, RPCs, and
-- the load-bearing 'aberto'-literal LIVENESS SWEEP.
--
-- 092000 added the case_status_defs vocabulary + app.case_status_is_terminal +
-- the seed trigger + dropped cases_status_check. This migration makes the cases
-- machinery USE the configurable model:
--
--   1. cases.status DEFAULT flips 'aberto' -> 'em_andamento' (the default initial
--      key), kept here with the guard so column-default + validator change atomically.
--   2. app.guard_case_status is rewritten to the configurable model (still gated
--      by app.in_case_rpc; old status non-terminal else HC025; new status a defined
--      key of the case's commission else HC024; any non-terminal -> any defined
--      allowed — NO transition matrix; DELETE only when non-terminal).
--   3. THE LIVENESS SWEEP. The string 'aberto' was the hard-coded "case is live"
--      test in the submit trigger + the phase RPCs. EVERY such check is replaced
--      with `not app.case_status_is_terminal(commission_id, status)`, so a case in
--      a CUSTOM non-terminal status (e.g. em_revisao) still advances phases on
--      submit and accepts phase activation. The objects rewritten here
--      (CREATE OR REPLACE, all logic else verbatim):
--        sync_case_phase_on_submit, activate_phase, skip_phase, add_ad_hoc_phase,
--        reassign_phase, create_case_from_template.
--      (start_or_resume_phase never compared to 'aberto' — it gates on the PHASE
--      being 'ativa', which only holds on a live case — so it is left unchanged.)
--      NOTE on overloads: activate_phase / reassign_phase were given a due_date
--      overload in 091000 / 091001, so we CREATE OR REPLACE THOSE (3-arg) current
--      signatures; create_case_from_template keeps its 091000 (snapshot) body +
--      the initial-key change.
--   4. set_case_status(p_case_id, p_status_key) — the single status-flip RPC
--      (reuses close_case's terminal cleanup: flip open phases to nao_necessaria,
--      stamp closed_at/closed_by when entering a terminal status). close_case /
--      cancel_case become THIN wrappers -> set_case_status(<terminal key>) so the
--      existing buttons keep working unchanged.
--   5. The status-vocabulary CRUD RPCs (create/update/reorder/archive_case_status)
--      + list_case_status_defs (definer, is_staff_admin_of-gated board read).
--   6. The cases_extras feature flag (OFF — flipped ON by a later migration) +
--      app.assert_extras_enabled(); the NEW write RPCs gate it. The MODIFIED core
--      phase RPCs keep gating ONLY cases_multi_phase (so they never break).
--
-- SECURITY: the in_case_rpc chokepoint and the Phase-7 in_progress-answers
-- invariant are PRESERVED — case_phases still carries no answers, no new
-- cross-member answer surface is added, and every status write still funnels
-- through a vetted RPC that sets app.in_case_rpc.
--
-- New SQLSTATEs (continue after HC023; register in src/lib/cases/actions.ts +
-- docs/backend-state.md):
--   HC024 invalid case status key for this commission.
--   HC025 case already in a terminal status (frozen).

-- ===========================================================================
-- cases.status DEFAULT -> the default initial key
-- ===========================================================================
-- The old default 'aberto' no longer exists as a seeded key. New cases created
-- by create_case_from_template set the commission's is_initial key explicitly;
-- this default only backstops a direct INSERT that omits status (e.g. a fixture).
alter table public.cases alter column status set default 'em_andamento';

-- ===========================================================================
-- cases_extras feature flag (default OFF) + assert helper
-- ===========================================================================
-- Mirrors cases_multi_phase (20260613090004). The NEW R2 write RPCs (set_case_status,
-- the status CRUD) and the R1/R3/R4 write RPCs (later migrations) gate this, so the
-- whole Cases-Extras surface is dark until the enable migration flips it ON. The
-- MODIFIED core phase RPCs deliberately keep gating only cases_multi_phase.
insert into app.feature_flags (key, enabled, description) values
  ('cases_extras', false,
   'When true, the Cases-Extras write RPCs (configurable case status set + '
   || 'set_case_status, documents/events, tags, action items) are live. The '
   || 'modified core phase RPCs keep gating only cases_multi_phase. Enabled at '
   || 'the end of the Cases-Extras batch.');

create function app.assert_extras_enabled()
returns void
language plpgsql
stable
set search_path = app, public, pg_catalog
as $$
begin
  if not app.feature_enabled('cases_extras') then
    raise exception 'os recursos adicionais de casos não estão disponíveis'
      using errcode = 'check_violation';
  end if;
end;
$$;

revoke all on function app.assert_extras_enabled() from public;
grant execute on function app.assert_extras_enabled() to authenticated, service_role;

-- ===========================================================================
-- app.guard_case_status — rewritten to the configurable model
-- ===========================================================================
-- Same chokepoint shape as 20260613090004 (every status change funnels through a
-- vetted RPC that sets app.in_case_rpc), but the hard-coded aberto/concluido/
-- cancelado transition rules become data-driven against case_status_defs:
--   * DELETE only while the case is NON-terminal.
--   * A status change requires in_case_rpc='on'; the OLD status must be
--     non-terminal (else HC025 — a terminal case is frozen); the NEW status must
--     be a defined key of the case's commission (else HC024). Any non-terminal ->
--     any defined status is allowed (coordinator board moves; no matrix).
--   * A non-status update is frozen once the case is terminal (unless under the flag).
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
    if app.case_status_is_terminal(old.commission_id, old.status) then
      raise exception 'cases in a terminal state are immutable (delete blocked)'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- A status change is only permitted inside a vetted RPC (set_case_status and
  -- its close_case/cancel_case wrappers).
  if new.status is distinct from old.status then
    if not v_in_rpc then
      raise exception 'case status changes must go through set_case_status()'
        using errcode = 'check_violation';
    end if;
    -- The OLD status must be non-terminal: a terminal case is frozen.
    if app.case_status_is_terminal(old.commission_id, old.status) then
      raise exception 'este caso está em um estado final e não pode mais ser alterado'
        using errcode = 'HC025';
    end if;
    -- The NEW status must be a defined key of THIS case's commission.
    if not exists (
      select 1 from public.case_status_defs
      where commission_id = new.commission_id and key = new.status
    ) then
      raise exception 'estado de caso inválido para esta comissão'
        using errcode = 'HC024';
    end if;
    return new;
  end if;

  -- A non-status update (e.g. label) is forbidden once the case is terminal.
  if app.case_status_is_terminal(old.commission_id, old.status) and not v_in_rpc then
    raise exception 'cases in a terminal state are immutable (update blocked)'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- ===========================================================================
-- app.case_terminal_key(commission_id, p_key) -> text   (internal helper)
-- ===========================================================================
-- Resolve a commission's terminal status key BY its canonical key, asserting it
-- exists AND is terminal. Used by the close_case/cancel_case back-compat wrappers
-- (which target the seeded 'concluido'/'cancelado'). SECURITY DEFINER so it reads
-- the vocabulary regardless of the caller's RLS (the wrappers are invoker and the
-- RLS on cases authorizes the actual write).
create function app.case_terminal_key(p_commission_id uuid, p_key text)
returns text
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_is_terminal boolean;
begin
  select is_terminal into v_is_terminal
  from public.case_status_defs
  where commission_id = p_commission_id and key = p_key and not archived;

  if v_is_terminal is null then
    raise exception 'estado de caso inválido para esta comissão'
      using errcode = 'HC024';
  end if;
  if not v_is_terminal then
    -- Defensive: a wrapper must only ever target a terminal key.
    raise exception 'estado de caso inválido para esta comissão'
      using errcode = 'HC024';
  end if;
  return p_key;
end;
$$;

revoke all on function app.case_terminal_key(uuid, text) from public;
grant execute on function app.case_terminal_key(uuid, text) to authenticated, service_role;

-- ===========================================================================
-- app.apply_case_status(p_case_id, p_status_key) -> cases   (internal core)
-- ===========================================================================
-- The shared status-flip core, factored out so the PUBLIC set_case_status RPC can
-- gate cases_extras while the close_case/cancel_case CORE wrappers keep gating
-- only cases_multi_phase (per the plan: the modified core phase RPCs never gate
-- cases_extras). This function does NO feature-flag check (its two callers do) and
-- NO authorization (the callers' RLS / invoker context is the authority).
--
-- SECURITY DEFINER so it can set app.in_case_rpc + write under the same trusted
-- context as the rest of the case machinery; it never widens access because the
-- public/wrapper callers are the gated entry points. Validates the key (HC024) and
-- rejects an already-terminal case (HC025). When ENTERING a terminal status it
-- reuses close_case's cleanup: flip remaining pendente/ativa phases to
-- nao_necessaria (so the board reads cleanly; a stranded in_progress draft is then
-- inert — the submit trigger no-ops on a terminal case) and stamp closed_at/by.
-- Leaving a terminal status is impossible (HC025), so closed_* are only ever set.
create function app.apply_case_status(p_case_id uuid, p_status_key text)
returns public.cases
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_old_status text;
  v_is_defined boolean;
  v_new_terminal boolean;
  v_result public.cases;
begin
  select commission_id, status into v_commission_id, v_old_status
  from public.cases where id = p_case_id;
  if v_commission_id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;

  -- A terminal case is frozen.
  if app.case_status_is_terminal(v_commission_id, v_old_status) then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC025';
  end if;

  -- The target must be a defined, non-archived key of this commission.
  select true, is_terminal into v_is_defined, v_new_terminal
  from public.case_status_defs
  where commission_id = v_commission_id and key = p_status_key and not archived;
  if v_is_defined is null then
    raise exception 'estado de caso inválido para esta comissão'
      using errcode = 'HC024';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  -- Entering a terminal status: close the open phases (mirrors close_case) and
  -- stamp closed_at/closed_by.
  if v_new_terminal then
    update public.case_phases
    set status = 'nao_necessaria', skipped_at = coalesce(skipped_at, now()), updated_at = now()
    where case_id = p_case_id and status in ('pendente', 'ativa');

    update public.cases
    set status = p_status_key, closed_at = now(), closed_by = auth.uid()
    where id = p_case_id
    returning * into v_result;
  else
    update public.cases
    set status = p_status_key
    where id = p_case_id
    returning * into v_result;
  end if;

  perform set_config('app.in_case_rpc', 'off', true);

  return v_result;
end;
$$;

revoke all on function app.apply_case_status(uuid, text) from public;
grant execute on function app.apply_case_status(uuid, text) to authenticated, service_role;

-- ===========================================================================
-- set_case_status(p_case_id, p_status_key) -> cases   (public board move)
-- ===========================================================================
-- THE coordinator board move / status picker. SECURITY INVOKER — RLS
-- cases_staff_admin_write is the authority (a non-staff_admin's UPDATE of
-- cases.status is denied by RLS, so app.apply_case_status's write affects 0 rows
-- and the RPC raises not-found). Gated by BOTH cases_multi_phase and the NEW
-- cases_extras flag (a new write surface). All the validation + cleanup lives in
-- app.apply_case_status.
create function public.set_case_status(p_case_id uuid, p_status_key text)
returns public.cases
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_seen uuid;
begin
  perform app.assert_cases_enabled();
  perform app.assert_extras_enabled();

  -- RLS authority: an invoker who cannot WRITE this case's status must not flip
  -- it. apply_case_status is SECURITY DEFINER (bypasses RLS), so we first confirm
  -- the caller can SELECT the case AND is a staff_admin/admin of its commission
  -- via the RLS-scoped read + the is_staff_admin_of gate, mirroring how the other
  -- invoker case RPCs lean on RLS. A plain member (read-only) is rejected here.
  select c.id into v_seen
  from public.cases c
  where c.id = p_case_id
    and (app.is_staff_admin_of(c.commission_id) or app.is_admin());
  if v_seen is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;

  return app.apply_case_status(p_case_id, p_status_key);
end;
$$;

grant execute on function public.set_case_status(uuid, text) to authenticated, service_role;

-- ===========================================================================
-- close_case(case_id) / cancel_case(case_id) -> cases   (thin back-compat wrappers)
-- ===========================================================================
-- Replace the 20260613090006 bodies with thin wrappers over app.apply_case_status,
-- targeting the seeded terminal keys ('concluido' / 'cancelado'). They KEEP gating
-- only cases_multi_phase (NOT cases_extras) so the existing UI buttons (closeCase /
-- cancelCase actions) keep working before the extras flag flips. RLS
-- cases_staff_admin_write remains the authority (these are SECURITY INVOKER, and a
-- non-staff_admin's status UPDATE is denied — apply_case_status then affects 0 rows
-- and raises not-found). app.case_terminal_key asserts the key exists + is terminal
-- for the case's commission (HC024 otherwise).
create or replace function public.close_case(p_case_id uuid)
returns public.cases
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
begin
  perform app.assert_cases_enabled();

  select commission_id into v_commission_id
  from public.cases
  where id = p_case_id
    and (app.is_staff_admin_of(commission_id) or app.is_admin());
  if v_commission_id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;

  return app.apply_case_status(
    p_case_id, app.case_terminal_key(v_commission_id, 'concluido'));
end;
$$;

grant execute on function public.close_case(uuid) to authenticated, service_role;

create or replace function public.cancel_case(p_case_id uuid)
returns public.cases
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
begin
  perform app.assert_cases_enabled();

  select commission_id into v_commission_id
  from public.cases
  where id = p_case_id
    and (app.is_staff_admin_of(commission_id) or app.is_admin());
  if v_commission_id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;

  return app.apply_case_status(
    p_case_id, app.case_terminal_key(v_commission_id, 'cancelado'));
end;
$$;

grant execute on function public.cancel_case(uuid) to authenticated, service_role;

-- ===========================================================================
-- LIVENESS SWEEP — replace `status = 'aberto'` with `not case_status_is_terminal`
-- ===========================================================================
-- Each object below is byte-for-byte its current definition (post-091000/091001),
-- with the SOLE change being the case-liveness test:
--   v_case_status <> 'aberto'        ->  app.case_status_is_terminal(comm, status)
--   v_case_status is distinct from 'aberto'  -> app.case_status_is_terminal(...)
-- and create_case_from_template's initial status = the commission's is_initial key.
-- They KEEP gating only cases_multi_phase (never cases_extras).

-- ---------------------------------------------------------------------------
-- sync_case_phase_on_submit — submit->advance trigger (liveness via helper)
-- ---------------------------------------------------------------------------
-- A phase response flipping in_progress -> submitted advances the phase to
-- concluida and recomputes downstream recommendations — but ONLY while the case
-- is still LIVE. The old check `v_case_status is distinct from 'aberto'` becomes
-- `app.case_status_is_terminal(...)`: a case in a CUSTOM non-terminal status (e.g.
-- em_revisao) now advances correctly (the bug this sweep prevents); a terminal
-- case leaves the phase inert. We need the commission id for the helper, so the
-- lookup also selects c.commission_id.
create or replace function public.sync_case_phase_on_submit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_case_id uuid;
  v_case_status text;
  v_commission_id uuid;
begin
  -- Only react to a phase response transitioning to submitted.
  if new.case_phase_id is null
     or new.status <> 'submitted'
     or old.status = 'submitted' then
    return new;
  end if;

  select cp.case_id, c.status, c.commission_id
    into v_case_id, v_case_status, v_commission_id
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = new.case_phase_id;

  -- Stranded draft on a TERMINAL case: leave the phase as-is (inert).
  if app.case_status_is_terminal(v_commission_id, v_case_status) then
    return new;
  end if;

  -- Advance the phase under our OWN session flag (submit_response only set
  -- app.in_submit_rpc, which the phase guard does not honour).
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
-- activate_phase(case_phase, assigned_to, due_date) — liveness via helper
-- ---------------------------------------------------------------------------
-- Current signature is the 3-arg due-date overload from 091000. Unchanged except
-- the liveness check: `v_case_status <> 'aberto'` -> the terminal helper (so a
-- phase on a custom non-terminal status can be activated; HC020 only on terminal).
create or replace function public.activate_phase(
  p_case_phase_id uuid,
  p_assigned_to uuid,
  p_due_date date default null
)
returns public.case_phases
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_case_id uuid;
  v_position integer;
  v_status text;
  v_case_status text;
  v_commission_id uuid;
  v_blocking integer;
  v_result public.case_phases;
begin
  perform app.assert_cases_enabled();

  select cp.case_id, cp.position, cp.status, c.status, c.commission_id
    into v_case_id, v_position, v_status, v_case_status, v_commission_id
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_phase_id;

  if v_case_id is null then
    raise exception 'fase % não encontrada', p_case_phase_id using errcode = 'no_data_found';
  end if;
  if app.case_status_is_terminal(v_commission_id, v_case_status) then
    raise exception 'este caso não está aberto' using errcode = 'HC020';
  end if;
  if v_status <> 'pendente' then
    raise exception 'esta fase não está pendente' using errcode = 'HC019';
  end if;

  -- Strict sequential: any earlier phase not yet concluida/nao_necessaria blocks.
  select count(*) into v_blocking
  from public.case_phases
  where case_id = v_case_id
    and position < v_position
    and status not in ('concluida', 'nao_necessaria');
  if v_blocking > 0 then
    raise exception 'conclua ou marque as fases anteriores antes de ativar esta'
      using errcode = 'HC018';
  end if;

  if not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set status = 'ativa',
      assigned_to = p_assigned_to,
      due_date = p_due_date,
      activated_at = now(),
      updated_at = now()
  where id = p_case_phase_id
  returning * into v_result;
  perform set_config('app.in_case_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.activate_phase(uuid, uuid, date) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- skip_phase(case_phase) — liveness via helper
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
  v_commission_id uuid;
  v_result public.case_phases;
begin
  perform app.assert_cases_enabled();

  select cp.case_id, cp.status, c.status, c.commission_id
    into v_case_id, v_status, v_case_status, v_commission_id
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_phase_id;

  if v_case_id is null then
    raise exception 'fase % não encontrada', p_case_phase_id using errcode = 'no_data_found';
  end if;
  if app.case_status_is_terminal(v_commission_id, v_case_status) then
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
-- add_ad_hoc_phase(case, form, title, recommend_when, assigned_to) — liveness
-- ---------------------------------------------------------------------------
-- Unchanged from 20260613090006 except the liveness check. It already selected
-- commission_id, so the helper call is a one-line swap.
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
  if app.case_status_is_terminal(v_commission_id, v_case_status) then
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
-- reassign_phase(case_phase, new_assignee, due_date) — liveness via helper
-- ---------------------------------------------------------------------------
-- Current signature is the 3-arg due-date overload from 091001. Unchanged except
-- the liveness check. It already selected commission_id.
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
  if app.case_status_is_terminal(v_commission_id, v_case_status) then
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
-- create_case_from_template(template, label) — set the INITIAL status key
-- ---------------------------------------------------------------------------
-- Identical to the 091000 (snapshot/default_due_days) body except: the new case's
-- status is set from the commission's NON-archived is_initial key instead of the
-- now-removed 'aberto' default. The commission ALWAYS has an is_initial (the seed
-- trigger guarantees it; the partial-unique index guarantees exactly one), so the
-- lookup is total; we raise HC024 defensively if a commission somehow lacks one.
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
  v_initial_key text;
  v_case public.cases;
  r_slot record;
  v_version uuid;
  v_from_phase integer;
  v_source_version uuid;
  v_qkey text;
  v_attempt integer := 0;
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

  -- Resolve the commission's initial case-status key (the status new cases enter).
  select key into v_initial_key
  from public.case_status_defs
  where commission_id = v_commission_id and is_initial and not archived;
  if v_initial_key is null then
    raise exception 'a comissão não tem um estado inicial de caso configurado'
      using errcode = 'HC024';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  -- Insert the case; the minting trigger sets case_number. The unique backstop
  -- can collide under a concurrent open for the same commission; the trigger
  -- re-acquires the advisory lock + recomputes max() each attempt, so a bounded
  -- retry loop converges.
  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.cases (commission_id, template_id, label, status, created_by)
      values (v_commission_id, p_template_id, nullif(btrim(p_label), ''),
              v_initial_key, auth.uid())
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

  -- Materialize the template slots into case_phases, pinning published versions.
  for r_slot in
    select position, form_id, title, recommend_when, default_due_days
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

    -- Re-validate recommend_when against the PINNED source version: a template
    -- edit between publish and now could have removed the referenced key.
    if r_slot.recommend_when is not null then
      v_from_phase := (r_slot.recommend_when ->> 'from_phase')::integer;
      v_qkey := r_slot.recommend_when ->> 'question_key';

      -- Resolve the source slot's currently-published version (the one this
      -- case pins for that earlier phase).
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

    -- Snapshot the slot default into the case phase (ADR 0017). due_date null.
    insert into public.case_phases
      (case_id, position, form_id, form_version_id, title, recommend_when,
       is_ad_hoc, default_due_days)
    values
      (v_case.id, r_slot.position, r_slot.form_id, v_version, r_slot.title,
       r_slot.recommend_when, false, r_slot.default_due_days);
  end loop;

  perform set_config('app.in_case_rpc', 'off', true);

  -- Initial recommendation pass (no submitted phases yet, so this is a no-op in
  -- practice, but keeps the path uniform).
  perform public.recompute_recommendations(v_case.id);

  return v_case;
end;
$$;

grant execute on function public.create_case_from_template(uuid, text) to authenticated, service_role;

-- ===========================================================================
-- Status-vocabulary CRUD RPCs (staff_admin settings)
-- ===========================================================================
-- All SECURITY INVOKER — RLS case_status_defs_staff_admin_write is the authority;
-- each adds an explicit is_staff_admin_of/admin gate for a clean pt-BR forbidden
-- (42501) instead of a silent 0-row write, and gates the cases_extras flag (a NEW
-- write surface). The key is derived from the label (slugified) on create and is
-- IMMUTABLE thereafter (it is the value stored on existing cases).

-- A tiny accent-folding fallback (the unaccent extension is not assumed present);
-- covers the pt-BR letters that appear in status labels. Keeps slugify pure.
-- Defined BEFORE slugify_status_key, which calls it (schema-qualified).
create function app.unaccent_fallback(p_text text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select translate(
    p_text,
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC');
$$;

revoke all on function app.unaccent_fallback(text) from public;
grant execute on function app.unaccent_fallback(text) to authenticated, service_role;

-- app.slugify_status_key(label) -> text   (internal: ASCII slug for a new key)
create function app.slugify_status_key(p_label text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  -- Lowercase, strip accents, non-alphanumerics -> '_', collapse + trim '_'.
  select btrim(
    regexp_replace(
      regexp_replace(
        lower(app.unaccent_fallback(p_label)),
        '[^a-z0-9]+', '_', 'g'),
      '_+', '_', 'g'),
    '_');
$$;

revoke all on function app.slugify_status_key(text) from public;
grant execute on function app.slugify_status_key(text) to authenticated, service_role;

-- create_case_status(commission, label, color_token, is_initial, is_terminal) -> def
create function public.create_case_status(
  p_commission_id uuid,
  p_label text,
  p_color_token text default 'muted',
  p_is_initial boolean default false,
  p_is_terminal boolean default false
)
returns public.case_status_defs
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_key text;
  v_position integer;
  v_result public.case_status_defs;
begin
  perform app.assert_cases_enabled();
  perform app.assert_extras_enabled();

  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  if nullif(btrim(p_label), '') is null then
    raise exception 'informe o nome do estado' using errcode = 'check_violation';
  end if;

  v_key := app.slugify_status_key(p_label);
  if v_key is null or v_key = '' then
    raise exception 'nome de estado inválido' using errcode = 'check_violation';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.case_status_defs where commission_id = p_commission_id;

  -- A new is_initial must displace the existing one (partial-unique index).
  if p_is_initial then
    update public.case_status_defs
    set is_initial = false, updated_at = now()
    where commission_id = p_commission_id and is_initial and not archived;
  end if;

  insert into public.case_status_defs
    (commission_id, key, label, position, color_token, is_initial, is_terminal)
  values
    (p_commission_id, v_key, btrim(p_label), v_position, p_color_token,
     coalesce(p_is_initial, false), coalesce(p_is_terminal, false))
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.create_case_status(uuid, text, text, boolean, boolean)
  to authenticated, service_role;

-- update_case_status(status_key, commission, label, color_token, is_initial, is_terminal)
-- The key is immutable; only presentation + flags change.
create function public.update_case_status(
  p_status_key text,
  p_commission_id uuid,
  p_label text,
  p_color_token text,
  p_is_initial boolean,
  p_is_terminal boolean
)
returns public.case_status_defs
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_archived boolean;
  v_result public.case_status_defs;
begin
  perform app.assert_cases_enabled();
  perform app.assert_extras_enabled();

  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select archived into v_archived
  from public.case_status_defs
  where commission_id = p_commission_id and key = p_status_key;
  if v_archived is null then
    raise exception 'estado de caso inválido para esta comissão' using errcode = 'HC024';
  end if;

  if nullif(btrim(p_label), '') is null then
    raise exception 'informe o nome do estado' using errcode = 'check_violation';
  end if;

  -- Promoting to is_initial displaces the current initial (skip self).
  if p_is_initial then
    update public.case_status_defs
    set is_initial = false, updated_at = now()
    where commission_id = p_commission_id and is_initial and not archived
      and key <> p_status_key;
  end if;

  update public.case_status_defs
  set label = btrim(p_label),
      color_token = p_color_token,
      is_initial = coalesce(p_is_initial, false),
      is_terminal = coalesce(p_is_terminal, false),
      updated_at = now()
  where commission_id = p_commission_id and key = p_status_key
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.update_case_status(text, uuid, text, text, boolean, boolean)
  to authenticated, service_role;

-- reorder_case_status(commission, ordered_keys[]) -> void
-- Renumber positions to match ordered_keys. The (commission_id, position) unique is
-- DEFERRABLE INITIALLY IMMEDIATE, so a single UPDATE...FROM with the new ordinals
-- tolerates the transient duplicates mid-statement (mirror reorder_section).
create function public.reorder_case_status(
  p_commission_id uuid,
  p_ordered_keys text[]
)
returns void
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
begin
  perform app.assert_cases_enabled();
  perform app.assert_extras_enabled();

  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.case_status_defs d
  set position = o.ord, updated_at = now()
  from (
    select key, ordinality::integer as ord
    from unnest(p_ordered_keys) with ordinality as t(key, ordinality)
  ) o
  where d.commission_id = p_commission_id and d.key = o.key;
end;
$$;

grant execute on function public.reorder_case_status(uuid, text[]) to authenticated, service_role;

-- archive_case_status(status_key, commission) -> def
-- Cannot archive the sole non-archived is_initial (a commission must always have an
-- initial status; the partial-unique index + create_case_from_template depend on it).
create function public.archive_case_status(
  p_status_key text,
  p_commission_id uuid
)
returns public.case_status_defs
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_is_initial boolean;
  v_result public.case_status_defs;
begin
  perform app.assert_cases_enabled();
  perform app.assert_extras_enabled();

  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select is_initial into v_is_initial
  from public.case_status_defs
  where commission_id = p_commission_id and key = p_status_key and not archived;
  if v_is_initial is null then
    raise exception 'estado de caso inválido para esta comissão' using errcode = 'HC024';
  end if;
  if v_is_initial then
    raise exception 'defina outro estado inicial antes de arquivar este'
      using errcode = 'check_violation';
  end if;

  update public.case_status_defs
  set archived = true, updated_at = now()
  where commission_id = p_commission_id and key = p_status_key
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.archive_case_status(text, uuid) to authenticated, service_role;

-- ===========================================================================
-- list_case_status_defs(commission, include_archived) -> setof rows
-- ===========================================================================
-- SECURITY DEFINER, internally is_staff_admin_of-gated (mirror list_cases_board),
-- so it returns nothing to a non-staff_admin (no leak). Ordered by position. By
-- default returns NON-archived defs (the board columns / picker); the settings
-- manager passes include_archived=true for the full vocabulary. Reads do NOT gate
-- cases_extras (a dark feature returns an empty/early set; the read is harmless).
create function public.list_case_status_defs(
  p_commission_id uuid,
  p_include_archived boolean default false
)
returns table (
  key text,
  label text,
  status_position integer,
  color_token text,
  is_initial boolean,
  is_terminal boolean,
  archived boolean
)
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    return;
  end if;

  return query
  select d.key, d.label, d.position, d.color_token,
         d.is_initial, d.is_terminal, d.archived
  from public.case_status_defs d
  where d.commission_id = p_commission_id
    and (p_include_archived or not d.archived)
  order by d.position;
end;
$$;

grant execute on function public.list_case_status_defs(uuid, boolean) to authenticated, service_role;

-- ===========================================================================
-- Revoke the implicit PUBLIC/anon EXECUTE on every public function this batch
-- creates OR replaces (B6 hardening, ADR 0020 / migration 090012-090015).
-- ===========================================================================
-- `CREATE OR REPLACE` RESETS a function's ACL to the default (which re-grants
-- PUBLIC), so even the pre-existing case RPCs we re-state here re-leak anon
-- EXECUTE unless re-revoked — pgTAP 100_dashboard test 19 enforces this.
-- This block ALSO closes a pre-existing leak: the 091000/091001 due-date
-- migrations recreated add_template_phase / update_template_phase / activate_phase
-- / reassign_phase WITHOUT re-revoking, so those have been anon-executable since;
-- we revoke them here as part of this batch's hardening. (Reads stay
-- authenticated/service_role only; anon never reaches these RPCs.)
revoke execute on function public.set_case_status(uuid, text) from anon, public;
revoke execute on function public.close_case(uuid) from anon, public;
revoke execute on function public.cancel_case(uuid) from anon, public;
revoke execute on function public.activate_phase(uuid, uuid, date) from anon, public;
revoke execute on function public.skip_phase(uuid) from anon, public;
revoke execute on function public.add_ad_hoc_phase(uuid, uuid, text, jsonb, uuid) from anon, public;
revoke execute on function public.reassign_phase(uuid, uuid, date) from anon, public;
revoke execute on function public.create_case_from_template(uuid, text) from anon, public;
revoke execute on function public.create_case_status(uuid, text, text, boolean, boolean) from anon, public;
revoke execute on function public.update_case_status(text, uuid, text, text, boolean, boolean) from anon, public;
revoke execute on function public.reorder_case_status(uuid, text[]) from anon, public;
revoke execute on function public.archive_case_status(text, uuid) from anon, public;
revoke execute on function public.list_case_status_defs(uuid, boolean) from anon, public;
-- Pre-existing leak from 091000 / 091001 (template-phase editors) — close it here.
revoke execute on function public.add_template_phase(uuid, uuid, text, jsonb, integer) from anon, public;
revoke execute on function public.update_template_phase(uuid, uuid, text, jsonb, boolean, integer, boolean) from anon, public;
