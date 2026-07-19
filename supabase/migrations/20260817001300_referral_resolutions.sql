-- =============================================================================
-- Referrals v2 (RV2) · R3 — Resolution cycles, reopening & parent lineage.
-- =============================================================================
-- Pre-pilot expansion of the shipped Phase-22 referral module (ADR 0037
-- Amendment 1 — implements the explicitly-DEFERRED resolution phase of D4/D5/D15;
-- plan docs/plans/referrals-v2-dialogue-governance.md §R3). The 🔴 state-machine
-- change: a reply-expecting referral no longer terminates when B concludes — B
-- delivers the formal response (`answered`, A owes the next move) and the SOURCE
-- committee formally confirms closure via `resolve_referral` (`resolved`). A
-- resolved referral may be `reopen`ed (append-only resolution cycles), and a new
-- child referral may denormalize its `parent_referral_id` lineage WITHOUT sharing
-- anything from the parent (ADR 0037 D15). Additive / forward-only (reset-OK; no
-- live referral data). Behind the existing `case_referrals` flag. Rules 1/2/9/10/11/12.
--
-- ⚠ PHI POSTURE (Rule 12): every new column is PHI-FREE governance metadata EXCEPT
-- referral_resolutions.summary_md — the resolution narrative, PHI-bearing clinical
-- free text. It follows the case_referral.decline_note precedent: authenticated is
-- NOT granted SELECT on it (column-REVOKE), so a metadata-tier reader's direct
-- SELECT is denied (42501); a PHI reader receives it ONLY through the audited
-- get_referral_detail door (which runs as owner and bypasses column grants). The
-- resolution ROW is visible to metadata-tier readers (can_read_referral_metadata)
-- so the non-PHI history — number, resolved_at, follow_up, reopen info — projects.
--
-- SQLSTATE (ADR 0037 Amendment 1 reserves HC0A5/HC0A6 for R3):
--   HC0A5 = resolve/reopen wrong-state; HC0A6 = invalid parent-lineage.
-- Authority failures raise 42501, checked FIRST (ADR 0078 non-vacuity discipline —
-- the authority SQLSTATE is distinct from the state SQLSTATE and is asserted before
-- any state check, so a state-invalid fixture still yields 42501 for the wrong actor).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. case_referral — the R3 lifecycle statuses + the parent-lineage self-FK.
--    status += 'answered', 'resolved'. parent_referral_id: PHI-free lineage
--    denormalization (QPS chain view); CHECK ≠ self; same-org enforced in the RPC.
-- -----------------------------------------------------------------------------
alter table public.case_referral drop constraint case_referral_status_check;
alter table public.case_referral add constraint case_referral_status_check
  check (status = any (array[
    'draft', 'sent', 'received', 'accepted', 'rejected', 'in_review',
    'awaiting_information', 'answered', 'resolved', 'completed', 'withdrawn']));

alter table public.case_referral
  add column parent_referral_id uuid references public.case_referral(id);

alter table public.case_referral add constraint case_referral_parent_not_self
  check (parent_referral_id is null or parent_referral_id <> id);

comment on column public.case_referral.parent_referral_id is
  'RV2 R3 (ADR 0037 D15): OPTIONAL lineage back-pointer to the referral this one was '
  'forwarded from ("Encaminhar adiante"). PHI-free denormalization for the QPS chain '
  'view. A child shares NOTHING from its parent automatically — the parent snapshot / '
  'shared items are NOT reachable through the child (D15, pgTAP-locked). Same-org + '
  'reader-of-parent enforced in create_referral_draft (HC0A6).';

-- PHI-free lineage pointer: per-column SELECT grant (the case_referral convention —
-- a new column with no grant fails reads with 42501).
grant select (parent_referral_id) on table public.case_referral to authenticated;

-- -----------------------------------------------------------------------------
-- 2. referral_resolutions — the append-only resolution ledger (0..N per referral;
--    exactly ONE active — reopened_at IS NULL — at a time). resolution_number
--    increments per resolve; a reopen marks the active row reopened, freeing the
--    partial-unique slot for the next resolve. summary_md is PHI (column-REVOKED).
-- -----------------------------------------------------------------------------
create table public.referral_resolutions (
  id                        uuid primary key default gen_random_uuid(),
  referral_id               uuid not null references public.case_referral(id) on delete cascade,
  resolution_number         integer not null,
  resolved_by_commission_id uuid not null references public.commissions(id) on delete cascade,
  resolved_by_user_id       uuid references public.profiles(id) on delete set null,
  summary_md                text,          -- PHI — column-REVOKED (see grants below)
  follow_up_required        boolean not null default false,
  final_reply_id            uuid references public.referral_reply(referral_id) on delete set null,
  resolved_at               timestamptz not null default now(),
  reopened_at               timestamptz,
  reopened_by               uuid references public.profiles(id) on delete set null,
  reopened_reason           text,
  created_at                timestamptz not null default now(),
  constraint referral_resolutions_number_unique unique (referral_id, resolution_number),
  constraint referral_resolutions_reopened_pair check ((reopened_at is null) = (reopened_by is null))
);
alter table public.referral_resolutions owner to postgres;

-- Exactly ONE active (un-reopened) resolution per referral — the "one active
-- resolution" invariant. A reopen sets reopened_at, freeing the slot; the next
-- resolve inserts a fresh row with the next resolution_number (append-only).
create unique index referral_resolutions_one_active
  on public.referral_resolutions (referral_id) where reopened_at is null;

comment on table public.referral_resolutions is
  'RV2 R3 (ADR 0037 D4/D5): the append-only SOURCE-committee resolution ledger. One '
  'row per resolve; reopen marks the active row (reopened_at/by/reason) and the next '
  'resolve appends resolution_number+1. summary_md is PHI (column-REVOKED, decline_note '
  'precedent) — direct authenticated SELECT is denied; a PHI reader gets it via the '
  'audited get_referral_detail door only. Writes go through the DEFINER RPCs only (no '
  'authenticated INSERT/UPDATE policy). purged by dispose_referral_phi.';

-- Grants: authenticated may SELECT the PHI-FREE columns only (the decline_note
-- precedent — authenticated has no SELECT on the PHI column). NO insert/update/delete
-- to authenticated: the DEFINER RPCs (owner = postgres) are the only writers, and
-- there is deliberately no authenticated write policy. service_role keeps full access.
revoke all on table public.referral_resolutions from public;
grant select (id, referral_id, resolution_number, resolved_by_commission_id,
              resolved_by_user_id, follow_up_required, final_reply_id, resolved_at,
              reopened_at, reopened_by, reopened_reason, created_at)
  on table public.referral_resolutions to authenticated;
grant all on table public.referral_resolutions to service_role;

alter table public.referral_resolutions enable row level security;

-- Metadata-tier readers see the resolution ROW (non-PHI history); summary_md stays
-- hidden by the column-REVOKE above (mirrors referral_reply's read gating, but at the
-- metadata tier so the history is visible on the QPS/source plane).
create policy "referral_resolutions_select_metadata" on public.referral_resolutions
  for select to authenticated
  using (app.can_read_referral_metadata(referral_id, auth.uid()));
-- No authenticated INSERT/UPDATE/DELETE policy: writes only via the DEFINER RPCs.

-- -----------------------------------------------------------------------------
-- 3. app.guard_referral_status — extend the state machine with the R3 transitions.
--    LIVE body reproduced verbatim; the ONLY changes are:
--      in_review  -> += 'answered'   (conclude, reply-expected)
--      answered   -> 'resolved' | 'withdrawn'   (resolve / source retraction)
--      resolved   -> 'in_review' | 'withdrawn'  (reopen / source retraction)
--    in_review -> 'completed' stays (the no-reply acknowledgment path).
-- -----------------------------------------------------------------------------
create or replace function app.guard_referral_status()
    returns trigger
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_referral_rpc', true), 'off') = 'on';
begin
  if tg_op = 'DELETE' then
    if not v_in_rpc and old.status <> 'draft' then
      raise exception 'apenas rascunhos podem ser excluídos' using errcode = 'HC070';
    end if;
    return old;
  end if;

  if new.status is distinct from old.status then
    if not v_in_rpc then
      raise exception 'mudanças de estado do encaminhamento devem passar pelas RPCs'
        using errcode = 'HC070';
    end if;

    if not (
      (old.status = 'draft'      and new.status in ('sent', 'withdrawn'))
      or (old.status = 'sent'     and new.status in ('received', 'withdrawn'))
      or (old.status = 'received' and new.status in ('accepted', 'rejected', 'withdrawn'))
      or (old.status = 'accepted' and new.status in ('in_review', 'withdrawn'))
      or (old.status = 'in_review' and new.status in ('completed', 'withdrawn', 'awaiting_information', 'answered'))
      or (old.status = 'awaiting_information' and new.status in ('in_review', 'withdrawn'))
      or (old.status = 'answered' and new.status in ('resolved', 'withdrawn'))
      or (old.status = 'resolved' and new.status in ('in_review', 'withdrawn'))
    ) then
      raise exception 'transição de estado de encaminhamento inválida: % -> %', old.status, new.status
        using errcode = 'HC070';
    end if;

    return new;
  end if;

  -- No status change. Under the flag the RPCs are the authority (any field edit
  -- allowed). Outside the flag, freeze a referral that has left draft.
  if v_in_rpc then
    return new;
  end if;
  if old.status <> 'draft' then
    raise exception 'encaminhamentos enviados são imutáveis fora das RPCs' using errcode = 'HC070';
  end if;
  return new;
end;
$$;
alter function app.guard_referral_status() owner to postgres;

-- -----------------------------------------------------------------------------
-- 4. app.referral_is_overdue — add 'resolved' to the terminal exclusion set (it now
--    releases the close-gate, so it is terminal for aging too). Kept byte-for-byte
--    with the TS mirror OVERDUE_EXCLUDED_STATUSES. 'answered' is NOT excluded (A
--    still owes the resolution — a late confirmation is meaningfully overdue).
-- -----------------------------------------------------------------------------
create or replace function app.referral_is_overdue(p_due timestamptz, p_status text)
    returns boolean
    language sql
    stable
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
  select p_due is not null
     and p_due < now()
     and p_status is not null
     and p_status <> all (array['draft', 'completed', 'rejected', 'withdrawn', 'resolved']);
$$;
alter function app.referral_is_overdue(timestamptz, text) owner to postgres;
revoke all on function app.referral_is_overdue(timestamptz, text) from public;
grant execute on function app.referral_is_overdue(timestamptz, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. resolve_referral — the SOURCE coordinator formally confirms closure
--    (answered -> resolved), appends a resolution row, clears waiting_on. AUTHORITY
--    (can_manage_referral_source = is_staff_admin_of_for(source)) is checked FIRST
--    with 42501 — a non-source actor on a state-valid referral yields 42501, NOT
--    HC0A5 (ADR 0078 non-vacuity). Wrong state -> HC0A5.
-- -----------------------------------------------------------------------------
create or replace function public.resolve_referral(
  p_referral_id uuid,
  p_summary_md text default null,
  p_follow_up boolean default false
) returns public.case_referral
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_ref public.case_referral;
  v_num integer;
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id for update;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  -- AUTHORITY FIRST (distinct SQLSTATE, before the state check).
  if not app.can_manage_referral_source(p_referral_id, auth.uid()) then
    raise exception 'apenas a coordenação da comissão de origem pode resolver o encaminhamento'
      using errcode = '42501';
  end if;

  -- STATE second.
  if v_ref.status <> 'answered' then
    raise exception 'o encaminhamento precisa estar respondido para ser resolvido'
      using errcode = 'HC0A5';
  end if;

  select coalesce(max(resolution_number), 0) + 1 into v_num
    from public.referral_resolutions where referral_id = p_referral_id;

  insert into public.referral_resolutions (
    referral_id, resolution_number, resolved_by_commission_id, resolved_by_user_id,
    summary_md, follow_up_required, final_reply_id, resolved_at
  ) values (
    p_referral_id, v_num, v_ref.source_commission_id, auth.uid(),
    nullif(btrim(coalesce(p_summary_md, '')), ''), coalesce(p_follow_up, false),
    (select referral_id from public.referral_reply where referral_id = p_referral_id),
    now()
  );

  perform set_config('app.in_referral_rpc', 'on', true);
  update public.case_referral
     set status = 'resolved', waiting_on_committee_id = null, updated_at = now()
   where id = p_referral_id
   returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);
  -- referral.status_changed is emitted by trg_audit_referral on the status change.

  return v_row;
end;
$$;
alter function public.resolve_referral(uuid, text, boolean) owner to postgres;
revoke all on function public.resolve_referral(uuid, text, boolean) from public;
grant execute on function public.resolve_referral(uuid, text, boolean) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. reopen_referral — the SOURCE coordinator reopens a resolved referral
--    (resolved -> in_review), marking the active resolution row reopened. The next
--    resolve appends resolution_number+1 (append-only; prior rows preserved). Same
--    authority-first / 42501 vs HC0A5 discipline as resolve_referral.
-- -----------------------------------------------------------------------------
create or replace function public.reopen_referral(
  p_referral_id uuid,
  p_reason text
) returns public.case_referral
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_ref public.case_referral;
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id for update;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  -- AUTHORITY FIRST (distinct SQLSTATE, before the state check).
  if not app.can_manage_referral_source(p_referral_id, auth.uid()) then
    raise exception 'apenas a coordenação da comissão de origem pode reabrir o encaminhamento'
      using errcode = '42501';
  end if;

  -- STATE second.
  if v_ref.status <> 'resolved' then
    raise exception 'o encaminhamento precisa estar resolvido para ser reaberto'
      using errcode = 'HC0A5';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'informe o motivo da reabertura' using errcode = 'check_violation';
  end if;

  -- Mark the single active resolution reopened (append-only: the row is preserved).
  update public.referral_resolutions
     set reopened_at = now(), reopened_by = auth.uid(), reopened_reason = btrim(p_reason)
   where referral_id = p_referral_id and reopened_at is null;

  perform set_config('app.in_referral_rpc', 'on', true);
  update public.case_referral
     set status = 'in_review', waiting_on_committee_id = target_commission_id, updated_at = now()
   where id = p_referral_id
   returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);
  -- referral.status_changed is emitted by trg_audit_referral on the status change.

  return v_row;
end;
$$;
alter function public.reopen_referral(uuid, text) owner to postgres;
revoke all on function public.reopen_referral(uuid, text) from public;
grant execute on function public.reopen_referral(uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7. conclude_referral — AMEND: a reply-expecting referral now lands 'answered'
--    (B delivered the formal response; A owes the resolution) with waiting_on =
--    source; a no-reply acknowledgment keeps 'completed' (terminal). LIVE body
--    reproduced verbatim; the ONLY change is the final status literal (+ waiting_on)
--    on the reply-expected branch. All HC075/HC074 validation + the reply upsert +
--    concluded_at/by are unchanged.
-- -----------------------------------------------------------------------------
create or replace function public.conclude_referral(
  p_referral_id uuid,
  p_reply_outcome_id uuid default null,
  p_result_md text default null,
  p_acknowledged_only boolean default false
) returns public.case_referral
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_referral public.case_referral;
  v_outcome public.reply_outcomes;
  v_ack boolean;
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();
  v_referral := app.assert_referral_target_acts(p_referral_id, array['in_review']);

  -- A reply IS expected unless the referral was marked no-reply AND the caller
  -- explicitly acknowledges only.
  v_ack := coalesce(p_acknowledged_only, false) and not v_referral.response_expected;

  if v_referral.response_expected then
    if btrim(coalesce(p_result_md, '')) = '' then
      raise exception 'descreva o resultado da análise para concluir' using errcode = 'HC075';
    end if;
    if p_reply_outcome_id is null then
      raise exception 'selecione o desfecho da análise para concluir' using errcode = 'HC075';
    end if;
  end if;

  if p_reply_outcome_id is not null then
    select * into v_outcome from public.reply_outcomes where id = p_reply_outcome_id;
    if v_outcome.id is null then
      raise exception 'desfecho de resposta inválido' using errcode = 'HC074';
    end if;
  end if;

  perform set_config('app.in_referral_rpc', 'on', true);

  insert into public.referral_reply (
    referral_id, reply_outcome_id, outcome_label, result_md, acknowledged_only,
    replied_by, replied_at
  ) values (
    p_referral_id, v_outcome.id, v_outcome.label,
    case when v_ack then null else p_result_md end, v_ack,
    auth.uid(), now()
  )
  on conflict (referral_id) do update
  set reply_outcome_id = excluded.reply_outcome_id, outcome_label = excluded.outcome_label,
      result_md = excluded.result_md, acknowledged_only = excluded.acknowledged_only,
      replied_by = excluded.replied_by, replied_at = excluded.replied_at, updated_at = now();

  -- RV2 R3: reply-expected -> 'answered' (A owes the resolution; waiting_on = source);
  -- no-reply acknowledgment -> 'completed' (terminal).
  if v_referral.response_expected then
    update public.case_referral
    set status = 'answered', waiting_on_committee_id = v_referral.source_commission_id,
        concluded_at = now(), concluded_by = auth.uid(), updated_at = now()
    where id = p_referral_id
    returning * into v_row;
  else
    update public.case_referral
    set status = 'completed', waiting_on_committee_id = null,
        concluded_at = now(), concluded_by = auth.uid(), updated_at = now()
    where id = p_referral_id
    returning * into v_row;
  end if;

  perform set_config('app.in_referral_rpc', 'off', true);
  return v_row;
end;
$$;
alter function public.conclude_referral(uuid, uuid, text, boolean) owner to postgres;
revoke all on function public.conclude_referral(uuid, uuid, text, boolean) from public;
grant execute on function public.conclude_referral(uuid, uuid, text, boolean) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8. close_case — AMEND the referral close-gate block set: add 'answered' (A must
--    resolve first) to the in-flight set; 'resolved' releases. LIVE body reproduced
--    verbatim; the ONLY change is the referral EXISTS status IN (...) list. The
--    explicit BLOCK-list style is kept deliberately (a "NOT IN (completed, resolved,
--    rejected, withdrawn)" form would wrongly block an unsent draft).
-- -----------------------------------------------------------------------------
create or replace function public.close_case(p_case_id uuid)
    returns public.cases
    language plpgsql
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_status text;
  v_outcome_id uuid;
  v_unsettled integer;
  v_offered integer;
  v_commission uuid;
  v_result public.cases;
begin
  perform app.assert_cases_enabled();

  v_commission := app.commission_of_case(p_case_id);
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select status, outcome_id into v_status, v_outcome_id
  from public.cases where id = p_case_id;
  if v_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC025';
  end if;

  select count(*) into v_unsettled
  from public.case_phases
  where case_id = p_case_id and status in ('pending', 'active');
  if v_unsettled > 0 then
    raise exception 'conclua ou marque todas as fases antes de concluir o caso'
      using errcode = 'HC031';
  end if;

  select count(*) into v_offered
  from public.case_offered_outcomes where case_id = p_case_id;
  if v_offered > 0 and v_outcome_id is null then
    raise exception 'selecione um desfecho antes de concluir o caso'
      using errcode = 'HC028';
  end if;

  if app.feature_enabled('case_referrals') and exists (
    select 1 from public.case_referral r
    where r.source_case_id = p_case_id and r.response_expected = true
      and r.status in ('sent', 'received', 'accepted', 'in_review', 'awaiting_information', 'answered')
  ) then
    raise exception 'há encaminhamentos aguardando resposta; conclua, recuse ou retire antes de encerrar o caso'
      using errcode = 'HC076';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  update public.cases
  set status = 'completed', closed_at = now(), closed_by = auth.uid()
  where id = p_case_id
  returning * into v_result;

  update public.case_phases
  set status = 'not_required', skipped_at = coalesce(skipped_at, now()), updated_at = now()
  where case_id = p_case_id and status in ('pending', 'active');

  perform set_config('app.in_case_rpc', 'off', true);

  return v_result;
end;
$$;
alter function public.close_case(uuid) owner to postgres;

-- -----------------------------------------------------------------------------
-- 9. create_referral_draft — AMEND: accept p_parent_referral_id (trailing, defaulted
--    NULL, so every existing positional caller — incl. the ethics 6-arg
--    open_ethics_external_referral — still resolves). When set, the parent must
--    exist, be same-organization, and be readable by the creator (HC0A6 otherwise).
--    D15: the child stores only the pointer; NOTHING is copied from the parent. LIVE
--    R2 body reproduced verbatim + the lineage validation + parent_referral_id INSERT.
-- -----------------------------------------------------------------------------
drop function if exists public.create_referral_draft(uuid, uuid, uuid, text, boolean, text, text, uuid, timestamptz);
create function public.create_referral_draft(
  p_source_case_id uuid,
  p_target_commission_id uuid,
  p_referral_type_id uuid,
  p_subject text,
  p_response_expected boolean default null,
  p_description_md text default null,
  p_priority text default 'routine',
  p_requested_action_id uuid default null,
  p_response_due_at timestamptz default null,
  p_parent_referral_id uuid default null
) returns public.case_referral
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_source_commission uuid;
  v_type public.referral_types;
  v_response_expected boolean;
  v_parent public.case_referral;
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();

  select commission_id into v_source_commission from public.cases where id = p_source_case_id;
  if v_source_commission is null then
    raise exception 'caso não encontrado' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of_for(v_source_commission, auth.uid())
          or app.is_commission_admin_of_for(v_source_commission, auth.uid())) then
    raise exception 'apenas a coordenação da comissão de origem pode encaminhar o caso'
      using errcode = 'HC071';
  end if;
  if v_source_commission = p_target_commission_id then
    raise exception 'a comissão de destino deve ser diferente da origem' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.commissions where id = p_target_commission_id) then
    raise exception 'comissão de destino não encontrada' using errcode = 'no_data_found';
  end if;
  if app.org_of_commission(v_source_commission) is distinct from app.org_of_commission(p_target_commission_id) then
    raise exception 'o encaminhamento deve permanecer dentro da mesma organização'
      using errcode = 'check_violation';
  end if;
  if btrim(coalesce(p_subject, '')) = '' then
    raise exception 'informe um assunto para o encaminhamento' using errcode = 'check_violation';
  end if;

  select * into v_type from public.referral_types where id = p_referral_type_id;
  if v_type.id is null or not v_type.is_active then
    raise exception 'tipo de encaminhamento inválido' using errcode = 'check_violation';
  end if;
  v_response_expected := coalesce(p_response_expected, v_type.default_response_expected);

  -- RV2 R2: PHI-free triage. Past-due → HC0A4; requested-action snapshot resolved.
  perform app.assert_referral_due_future(p_response_due_at);

  -- RV2 R3: parent lineage (ADR 0037 D15). Must exist, be same-organization, and be
  -- readable by the creator. The pointer is stored; NOTHING is copied from the parent.
  if p_parent_referral_id is not null then
    select * into v_parent from public.case_referral where id = p_parent_referral_id;
    if v_parent.id is null then
      raise exception 'encaminhamento de origem (lineage) não encontrado' using errcode = 'HC0A6';
    end if;
    if app.org_of_commission(v_parent.source_commission_id)
         is distinct from app.org_of_commission(v_source_commission) then
      raise exception 'o encaminhamento vinculado deve pertencer à mesma organização'
        using errcode = 'HC0A6';
    end if;
    if not app.can_read_referral_metadata(p_parent_referral_id, auth.uid()) then
      raise exception 'sem acesso ao encaminhamento vinculado' using errcode = 'HC0A6';
    end if;
  end if;

  insert into public.case_referral (
    source_case_id, source_commission_id, target_commission_id, referral_type_id,
    type_label, subject, description_md, response_expected, created_by,
    priority, requested_action_id, requested_action_label, response_due_at,
    parent_referral_id
  ) values (
    p_source_case_id, v_source_commission, p_target_commission_id, v_type.id,
    v_type.label, btrim(p_subject), nullif(btrim(coalesce(p_description_md, '')), ''),
    v_response_expected, auth.uid(),
    coalesce(nullif(btrim(coalesce(p_priority, '')), ''), 'routine'),
    p_requested_action_id, app.resolve_requested_action_label(p_requested_action_id),
    p_response_due_at,
    p_parent_referral_id
  )
  returning * into v_row;

  return v_row;
end;
$$;
alter function public.create_referral_draft(uuid, uuid, uuid, text, boolean, text, text, uuid, timestamptz, uuid) owner to postgres;
revoke all on function public.create_referral_draft(uuid, uuid, uuid, text, boolean, text, text, uuid, timestamptz, uuid) from public;
grant execute on function public.create_referral_draft(uuid, uuid, uuid, text, boolean, text, text, uuid, timestamptz, uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 10. dispose_referral_phi — AMEND: also NULL summary_md across the referral's
--     resolutions (LGPD Art. 18 erasure of the PHI-bearing resolution narrative).
--     LIVE body reproduced verbatim; the ONLY addition is the referral_resolutions
--     summary_md purge.
-- -----------------------------------------------------------------------------
create or replace function public.dispose_referral_phi(p_referral_id uuid, p_reason text)
    returns void
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_referral public.case_referral;
  v_redacted constant text := '[PHI removido]';
begin
  perform app.assert_referrals_enabled();

  if not (app.is_commission_admin_of((select source_commission_id from public.case_referral where id = p_referral_id))
          or app.is_pqs_operator_of(app.hospital_of_commission((select source_commission_id from public.case_referral where id = p_referral_id)))
          or app.is_pqs_operator_of(app.hospital_of_commission((select target_commission_id from public.case_referral where id = p_referral_id)))) then
    raise exception 'apenas um administrador da organização ou o NSP pode descartar dados do paciente'
      using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in
       ('retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other') then
    raise exception 'motivo de descarte inválido' using errcode = 'check_violation';
  end if;
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'P0002';
  end if;
  if v_referral.phi_disposed_at is not null then
    raise exception 'os dados do paciente deste encaminhamento já foram descartados'
      using errcode = 'HC056';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  perform set_config('app.in_referral_rpc', 'on', true);
  perform set_config('app.phi_dispose_reason', p_reason, true);

  delete from public.referral_patient where referral_id = p_referral_id;

  update public.case_referral
     set subject = v_redacted, description_md = null, decline_note = null
   where id = p_referral_id;
  update public.referral_reply set result_md = null where referral_id = p_referral_id;
  update public.referral_shared_item
     set frozen_title = v_redacted,
         frozen_body_md = case when frozen_body_md is not null then v_redacted else frozen_body_md end
   where referral_id = p_referral_id;
  update public.referral_reply_attachment set title = v_redacted where referral_id = p_referral_id;
  -- RV2 R1: message bodies are PHI (NOT NULL → redact to the marker).
  update public.referral_messages set body = v_redacted where referral_id = p_referral_id;
  -- RV2 R3: the resolution narrative is PHI — purge it.
  update public.referral_resolutions set summary_md = null where referral_id = p_referral_id;

  update public.case_referral
     set has_patient = false, phi_disposed_at = now(), phi_disposed_by = auth.uid(),
         phi_disposed_reason = p_reason, updated_at = now()
   where id = p_referral_id;

  perform app.audit_write(
    'referral_patient.disposed', 'referral_patient', p_referral_id, v_referral.source_commission_id,
    'Dados do paciente do encaminhamento ' || v_referral.code || ' descartados',
    jsonb_build_object('reason', p_reason));

  perform set_config('app.in_safety_rpc', 'off', true);
  perform set_config('app.in_referral_rpc', 'off', true);
end;
$$;
alter function public.dispose_referral_phi(uuid, text) owner to postgres;
revoke all on function public.dispose_referral_phi(uuid, text) from public;
grant execute on function public.dispose_referral_phi(uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 11. get_referral_detail — AMEND: expose parent_referral_id (PHI-free) + the
--     resolution history. The non-PHI history projects to every metadata-tier reader;
--     summary_md is served ONLY inside the existing v_can_phi (can_read_referral_phi)
--     gate. LIVE R2 body reproduced verbatim; the ONLY additions are the
--     parent_referral_id key and the 'resolutions' array.
-- -----------------------------------------------------------------------------
create or replace function public.get_referral_detail(p_referral_id uuid)
    returns jsonb
    language plpgsql security definer
    set search_path to 'public', 'pg_catalog'
    as $$
declare
  v_referral public.case_referral;
  v_is_source_coord boolean;
  v_can_phi boolean;
  v_can_compose_target boolean;
  v_result jsonb;
begin
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;
  if not app.can_read_referral(p_referral_id, auth.uid()) then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  v_is_source_coord := app.is_staff_admin_of(v_referral.source_commission_id);
  v_can_phi := app.can_read_referral_phi(p_referral_id, auth.uid());
  -- RV2 R1 fast-follow: compose authority = the EXACT R1 RPC gates (PHI-free).
  v_can_compose_target := app.is_staff_admin_of(v_referral.target_commission_id)
                          or app.referral_target_analyst(p_referral_id, auth.uid());

  if v_can_phi and not v_is_source_coord then
    perform public.log_audit_access(
      'referral.viewed', 'referral', p_referral_id, v_referral.source_commission_id,
      'Conteúdo do encaminhamento ' || coalesce(v_referral.code, '') || ' visualizado', '{}'::jsonb);
  end if;

  select jsonb_build_object(
    'id', v_referral.id,
    'code', v_referral.code,
    'status', v_referral.status,
    'subject', v_referral.subject,
    'description_md', case when v_can_phi then v_referral.description_md else null end,
    'referral_type_id', v_referral.referral_type_id,
    'type_label', v_referral.type_label,
    'response_expected', v_referral.response_expected,
    -- RV2 R2: PHI-FREE triage/SLA metadata (visible to every metadata-tier reader).
    'priority', v_referral.priority,
    'requested_action_id', v_referral.requested_action_id,
    'requested_action_label', v_referral.requested_action_label,
    'response_due_at', v_referral.response_due_at,
    'decline_reason_code', v_referral.decline_reason_code,
    -- RV2 R3: PHI-FREE lineage pointer (QPS chain view).
    'parent_referral_id', v_referral.parent_referral_id,
    'source_commission_id', v_referral.source_commission_id,
    'source_commission_name', (select name from public.commissions where id = v_referral.source_commission_id),
    'target_commission_id', v_referral.target_commission_id,
    'target_commission_name', (select name from public.commissions where id = v_referral.target_commission_id),
    'source_case_id', v_referral.source_case_id,
    'source_case_number', (select case_number from public.cases where id = v_referral.source_case_id),
    'target_case_id', v_referral.target_case_id,
    'target_case_number', (select case_number from public.cases where id = v_referral.target_case_id),
    'has_patient', v_referral.has_patient,
    'created_by', v_referral.created_by,
    'created_by_name', (select full_name from public.profiles where id = v_referral.created_by),
    -- PHI free-text decline note stays PHI-gated (distinct from decline_reason_code).
    'decline_note', case when v_can_phi then v_referral.decline_note else null end,
    'waiting_on_committee_id', v_referral.waiting_on_committee_id,
    'last_message_at', v_referral.last_message_at,
    -- RV2 R1 fast-follow: compose authority for THIS caller (PHI-free).
    'can_compose_as_source', v_is_source_coord,
    'can_compose_as_target', v_can_compose_target,
    'shared_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'referral_id', s.referral_id,
        'kind', s.kind,
        'source_narrative_id', s.source_narrative_id,
        'source_document_id', s.source_document_id,
        'frozen_title', s.frozen_title,
        'frozen_body_md', case when v_can_phi then s.frozen_body_md else null end,
        'frozen_storage_path', case when v_can_phi then s.frozen_storage_path else null end,
        'frozen_mime_type', s.frozen_mime_type,
        'frozen_size_bytes', s.frozen_size_bytes,
        'position', s.position
      ) order by s.position)
      from public.referral_shared_item s where s.referral_id = p_referral_id
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'referral_id', m.referral_id,
        'sequence_number', m.sequence_number,
        'sender_commission_id', m.sender_commission_id,
        'sender_commission_name', (select name from public.commissions where id = m.sender_commission_id),
        'sender_user_id', m.sender_user_id,
        'sender_user_name', (select full_name from public.profiles where id = m.sender_user_id),
        'message_type', m.message_type,
        'body', case when v_can_phi then m.body else null end,
        'created_at', m.created_at
      ) order by m.sequence_number)
      from public.referral_messages m where m.referral_id = p_referral_id
    ), '[]'::jsonb),
    -- RV2 R3: the resolution history. Non-PHI columns project to every metadata-tier
    -- reader; summary_md is served ONLY to a PHI reader (v_can_phi).
    'resolutions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rr.id,
        'referral_id', rr.referral_id,
        'resolution_number', rr.resolution_number,
        'resolved_by_commission_id', rr.resolved_by_commission_id,
        'resolved_by_user_id', rr.resolved_by_user_id,
        'resolved_by_name', (select full_name from public.profiles where id = rr.resolved_by_user_id),
        'summary_md', case when v_can_phi then rr.summary_md else null end,
        'follow_up_required', rr.follow_up_required,
        'final_reply_id', rr.final_reply_id,
        'resolved_at', rr.resolved_at,
        'reopened_at', rr.reopened_at,
        'reopened_by', rr.reopened_by,
        'reopened_reason', rr.reopened_reason
      ) order by rr.resolution_number)
      from public.referral_resolutions rr where rr.referral_id = p_referral_id
    ), '[]'::jsonb),
    'reply', (
      select case when r.referral_id is null then null else jsonb_build_object(
        'referral_id', r.referral_id,
        'reply_outcome_id', r.reply_outcome_id,
        'outcome_label', r.outcome_label,
        'result_md', case when v_can_phi then r.result_md else null end,
        'acknowledged_only', r.acknowledged_only,
        'replied_by', r.replied_by,
        'replied_by_name', (select full_name from public.profiles where id = r.replied_by),
        'replied_at', r.replied_at,
        'attachments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', a.id, 'referral_id', a.referral_id, 'title', a.title,
            'storage_path', a.storage_path, 'mime_type', a.mime_type,
            'size_bytes', a.size_bytes, 'uploaded_by', a.uploaded_by,
            'uploaded_by_name', (select full_name from public.profiles where id = a.uploaded_by),
            'created_at', a.created_at
          ) order by a.created_at)
          from public.referral_reply_attachment a where a.referral_id = p_referral_id
        ), '[]'::jsonb)
      ) end
      from public.referral_reply r where r.referral_id = p_referral_id
    ),
    'sent_at', v_referral.sent_at,
    'received_at', v_referral.received_at,
    'decided_at', v_referral.decided_at,
    'concluded_at', v_referral.concluded_at,
    'withdrawn_at', v_referral.withdrawn_at,
    'created_at', v_referral.created_at,
    'updated_at', v_referral.updated_at
  ) into v_result;

  return v_result;
end;
$$;
alter function public.get_referral_detail(uuid) owner to postgres;
revoke all on function public.get_referral_detail(uuid) from public;
grant execute on function public.get_referral_detail(uuid) to authenticated, service_role;
