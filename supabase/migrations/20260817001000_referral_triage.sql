-- =============================================================================
-- Referrals v2 (RV2) · R2 — Triage, SLA & requested-action (ALL PHI-free metadata).
-- =============================================================================
-- Pre-pilot expansion of the shipped Phase-22 referral module (ADR 0037
-- Amendment 1; plan docs/plans/referrals-v2-dialogue-governance.md §3 R2). Adds the
-- triage/SLA metadata the QPS oversight plane needs — priority, a configurable
-- "requested action" vocabulary (+ snapshot label), a response deadline (overdue is
-- COMPUTED, never stored), and a PHI-FREE decline-reason code distinct from the
-- PHI decline_note. Additive / forward-only (reset-OK; no live referral data).
-- Behind the existing `case_referrals` flag. Binding rules 1/2/9/10/11.
--
-- ⚠ PHI POSTURE: every column this migration adds is PHI-FREE governance metadata
-- (Decision 16 — the hub/inbox/QPS plane shows counts + metadata only). Unlike the
-- R1 message body they are NOT column-REVOKED: they carry an explicit per-column
-- GRANT SELECT to `authenticated` (the case_referral column-grant convention —
-- memory `case-referral-column-grants`: a new column with no grant fails reads with
-- 42501) and are visible to a METADATA-tier reader through the case_referral row
-- SELECT policy `app.can_read_referral_metadata` (the current metadata predicate —
-- `can_read_referral` is now a thin wrapper delegating to it). The PHI decline_note
-- stays column-REVOKED + PHI-gated. SQLSTATE: HC0A3 (vocab CRUD), HC0A4 (past due).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. referral_requested_actions — the seeded, admin-managed "requested action"
--    vocabulary (mirrors referral_types: key/label/description/color_token/
--    position/is_active). PHI-FREE. Any-auth READ; admin WRITE (RLS + the CRUD
--    RPCs below carry the labelled HC0A3).
-- -----------------------------------------------------------------------------
create table if not exists public.referral_requested_actions (
  id           uuid primary key default gen_random_uuid(),
  key          text not null,
  label        text not null,
  description  text,
  color_token  text,
  position     integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint referral_requested_actions_key_key unique (key),
  constraint referral_requested_actions_key_not_blank check (btrim(key) <> ''),
  constraint referral_requested_actions_label_not_blank check (btrim(label) <> '')
);
alter table public.referral_requested_actions owner to postgres;

comment on table public.referral_requested_actions is
  'RV2 R2 (ADR 0037 Amendment 1): the seeded, admin-managed requested-action '
  'vocabulary a source coordinator picks when opening a referral ("o que se pede da '
  'comissão de destino"). PHI-FREE. Mirrors referral_types. Read by any authenticated '
  'user; written by app.is_admin() (RLS + the HC0A3 CRUD RPCs). case_referral snapshots '
  'the label into requested_action_label so a later vocab edit never rewrites history.';

create trigger touch_referral_requested_actions_updated_at
  before update on public.referral_requested_actions
  for each row execute function app.touch_updated_at();

-- Grants mirror referral_types (RLS is the write boundary; is_admin()).
revoke all on table public.referral_requested_actions from public;
grant select, insert, update, delete on table public.referral_requested_actions to authenticated;
grant all on table public.referral_requested_actions to service_role;

alter table public.referral_requested_actions enable row level security;

create policy "referral_requested_actions_select_all" on public.referral_requested_actions
  for select to authenticated
  using (true);

create policy "referral_requested_actions_write_admin" on public.referral_requested_actions
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

-- Starter set (PHI-free). Idempotent on key.
insert into public.referral_requested_actions (key, label, description, color_token, position) values
  ('review',      'Emitir parecer',        'Analisar e emitir um parecer técnico sobre o caso.',        'info',    1),
  ('investigate', 'Investigar',            'Conduzir investigação conjunta ou apuração dos fatos.',      'warning', 2),
  ('audit',       'Auditar',               'Realizar auditoria do processo ou do prontuário.',           'accent',  3),
  ('take_action', 'Adotar providências',   'Adotar as providências cabíveis no âmbito da comissão.',     'destructive', 4),
  ('acknowledge', 'Tomar ciência',         'Apenas tomar ciência; nenhuma resposta formal é esperada.',  'muted',   5)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 2. case_referral — the PHI-FREE triage/SLA columns. priority NOT NULL default
--    'routine'; requested_action FK + snapshot label; response_due_at (overdue is
--    computed, never stored); decline_reason_code (PHI-free, distinct from the PHI
--    decline_note).
-- -----------------------------------------------------------------------------
alter table public.case_referral
  add column priority              text not null default 'routine',
  add column requested_action_id   uuid references public.referral_requested_actions(id) on delete set null,
  add column requested_action_label text,
  add column response_due_at       timestamptz,
  add column decline_reason_code   text;

alter table public.case_referral add constraint case_referral_priority_check
  check (priority = any (array['routine', 'high', 'urgent', 'critical']));

alter table public.case_referral add constraint case_referral_decline_reason_code_check
  check (decline_reason_code is null or decline_reason_code = any (array[
    'outside_jurisdiction', 'duplicate', 'wrong_committee',
    'insufficient_information', 'conflict_of_interest', 'other']));

comment on column public.case_referral.priority is
  'RV2 R2: triage priority (routine|high|urgent|critical). PHI-free metadata; drives '
  'the hub/inbox/QPS priority badge + aging sort.';
comment on column public.case_referral.requested_action_id is
  'RV2 R2: FK to the requested-action vocabulary the source picked. PHI-free. NULL '
  'allowed. requested_action_label snapshots the label at pick time.';
comment on column public.case_referral.requested_action_label is
  'RV2 R2: snapshot of the requested-action label (stable across later vocab edits). '
  'PHI-free metadata.';
comment on column public.case_referral.response_due_at is
  'RV2 R2: optional SLA deadline. Overdue is COMPUTED (app.referral_is_overdue: '
  'response_due_at < now() AND status non-terminal) — never a stored flag. PHI-free.';
comment on column public.case_referral.decline_reason_code is
  'RV2 R2: PHI-FREE structured decline reason (outside_jurisdiction|duplicate|'
  'wrong_committee|insufficient_information|conflict_of_interest|other). Distinct from '
  'the PHI free-text decline_note (column-REVOKED). Shown to metadata-tier readers.';

-- Per-column SELECT grants (the case_referral convention — a new column with no grant
-- fails reads with 42501). All five are PHI-FREE, so authenticated reads them directly
-- (gated only by the row policy can_read_referral_metadata). decline_note stays REVOKED.
grant select (priority, requested_action_id, requested_action_label,
              response_due_at, decline_reason_code)
  on table public.case_referral to authenticated;

-- -----------------------------------------------------------------------------
-- 3. app.referral_is_overdue — the SQL overdue predicate for QPS aging. Mirrors the
--    TS isReferralOverdue (src/lib/referrals/types.ts): a deadline strictly in the
--    past AND a status that is neither pre-flight (draft) nor terminal
--    (completed/rejected/withdrawn). PHI-free.
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
     and p_status <> all (array['draft', 'completed', 'rejected', 'withdrawn']);
$$;
alter function app.referral_is_overdue(timestamptz, text) owner to postgres;
revoke all on function app.referral_is_overdue(timestamptz, text) from public;
grant execute on function app.referral_is_overdue(timestamptz, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. referral_requested_actions vocab CRUD RPCs (HC0A3). DEFINER, is_admin()-gated;
--    the labelled SQLSTATE gives the FE a stable door (t19 REVOKE→GRANT). RLS also
--    permits direct admin DML (referral_types parity) — these are the sanctioned door.
-- -----------------------------------------------------------------------------
create or replace function public.create_referral_requested_action(
  p_key text,
  p_label text,
  p_description text default null,
  p_color_token text default null,
  p_position integer default 0
) returns public.referral_requested_actions
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_row public.referral_requested_actions;
begin
  if not app.is_admin() then
    raise exception 'apenas um administrador pode gerenciar o vocabulário de ações solicitadas'
      using errcode = 'HC0A3';
  end if;
  if nullif(btrim(p_key), '') is null or nullif(btrim(p_label), '') is null then
    raise exception 'informe a chave e o rótulo da ação solicitada' using errcode = 'HC0A3';
  end if;
  insert into public.referral_requested_actions (key, label, description, color_token, position)
  values (btrim(p_key), btrim(p_label),
          nullif(btrim(coalesce(p_description, '')), ''),
          nullif(btrim(coalesce(p_color_token, '')), ''),
          coalesce(p_position, 0))
  returning * into v_row;
  return v_row;
end;
$$;
alter function public.create_referral_requested_action(text, text, text, text, integer) owner to postgres;
revoke all on function public.create_referral_requested_action(text, text, text, text, integer) from public;
grant execute on function public.create_referral_requested_action(text, text, text, text, integer) to authenticated, service_role;

create or replace function public.update_referral_requested_action(
  p_id uuid,
  p_label text,
  p_description text default null,
  p_color_token text default null,
  p_position integer default null,
  p_is_active boolean default null
) returns public.referral_requested_actions
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_row public.referral_requested_actions;
begin
  if not app.is_admin() then
    raise exception 'apenas um administrador pode gerenciar o vocabulário de ações solicitadas'
      using errcode = 'HC0A3';
  end if;
  if nullif(btrim(coalesce(p_label, '')), '') is null then
    raise exception 'informe o rótulo da ação solicitada' using errcode = 'HC0A3';
  end if;
  update public.referral_requested_actions
     set label = btrim(p_label),
         description = nullif(btrim(coalesce(p_description, '')), ''),
         color_token = nullif(btrim(coalesce(p_color_token, '')), ''),
         position = coalesce(p_position, position),
         is_active = coalesce(p_is_active, is_active)
   where id = p_id
   returning * into v_row;
  if v_row.id is null then
    raise exception 'ação solicitada não encontrada' using errcode = 'HC0A3';
  end if;
  return v_row;
end;
$$;
alter function public.update_referral_requested_action(uuid, text, text, text, integer, boolean) owner to postgres;
revoke all on function public.update_referral_requested_action(uuid, text, text, text, integer, boolean) from public;
grant execute on function public.update_referral_requested_action(uuid, text, text, text, integer, boolean) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. app.referral_apply_triage — shared helper resolving priority + requested-action
--    snapshot + due-date (past-date → HC0A4). Keeps create/update/set-deadline in
--    agreement. Returns the resolved snapshot label (NULL when no action given).
-- -----------------------------------------------------------------------------
create or replace function app.assert_referral_due_future(p_due timestamptz)
    returns void
    language plpgsql
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
begin
  if p_due is not null and p_due < now() then
    raise exception 'o prazo de resposta não pode estar no passado' using errcode = 'HC0A4';
  end if;
end;
$$;
alter function app.assert_referral_due_future(timestamptz) owner to postgres;

create or replace function app.resolve_requested_action_label(p_action_id uuid)
    returns text
    language plpgsql
    stable
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_row public.referral_requested_actions;
begin
  if p_action_id is null then
    return null;
  end if;
  select * into v_row from public.referral_requested_actions where id = p_action_id;
  if v_row.id is null or not v_row.is_active then
    raise exception 'ação solicitada inválida' using errcode = 'check_violation';
  end if;
  return v_row.label;
end;
$$;
alter function app.resolve_requested_action_label(uuid) owner to postgres;

-- -----------------------------------------------------------------------------
-- 6. create_referral_draft — DROP + recreate with the R2 triage params (trailing,
--    all defaulted, so the ethics 6-positional-arg caller still resolves). LIVE body
--    reproduced verbatim; the only additions are priority / requested_action /
--    response_due_at on the INSERT.
-- -----------------------------------------------------------------------------
drop function if exists public.create_referral_draft(uuid, uuid, uuid, text, boolean, text);
create function public.create_referral_draft(
  p_source_case_id uuid,
  p_target_commission_id uuid,
  p_referral_type_id uuid,
  p_subject text,
  p_response_expected boolean default null,
  p_description_md text default null,
  p_priority text default 'routine',
  p_requested_action_id uuid default null,
  p_response_due_at timestamptz default null
) returns public.case_referral
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_source_commission uuid;
  v_type public.referral_types;
  v_response_expected boolean;
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

  insert into public.case_referral (
    source_case_id, source_commission_id, target_commission_id, referral_type_id,
    type_label, subject, description_md, response_expected, created_by,
    priority, requested_action_id, requested_action_label, response_due_at
  ) values (
    p_source_case_id, v_source_commission, p_target_commission_id, v_type.id,
    v_type.label, btrim(p_subject), nullif(btrim(coalesce(p_description_md, '')), ''),
    v_response_expected, auth.uid(),
    coalesce(nullif(btrim(coalesce(p_priority, '')), ''), 'routine'),
    p_requested_action_id, app.resolve_requested_action_label(p_requested_action_id),
    p_response_due_at
  )
  returning * into v_row;

  return v_row;
end;
$$;
alter function public.create_referral_draft(uuid, uuid, uuid, text, boolean, text, text, uuid, timestamptz) owner to postgres;
revoke all on function public.create_referral_draft(uuid, uuid, uuid, text, boolean, text, text, uuid, timestamptz) from public;
grant execute on function public.create_referral_draft(uuid, uuid, uuid, text, boolean, text, text, uuid, timestamptz) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7. update_referral_draft — DROP + recreate with the R2 triage params. LIVE body
--    reproduced verbatim + priority / requested_action / response_due_at on the UPDATE.
-- -----------------------------------------------------------------------------
drop function if exists public.update_referral_draft(uuid, uuid, text, text, boolean);
create function public.update_referral_draft(
  p_referral_id uuid,
  p_referral_type_id uuid,
  p_subject text,
  p_description_md text default null,
  p_response_expected boolean default true,
  p_priority text default 'routine',
  p_requested_action_id uuid default null,
  p_response_due_at timestamptz default null
) returns public.case_referral
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_type public.referral_types;
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();
  perform app.assert_referral_draft_writable(p_referral_id);

  if btrim(coalesce(p_subject, '')) = '' then
    raise exception 'informe um assunto para o encaminhamento' using errcode = 'check_violation';
  end if;
  select * into v_type from public.referral_types where id = p_referral_type_id;
  if v_type.id is null then
    raise exception 'tipo de encaminhamento inválido' using errcode = 'check_violation';
  end if;
  perform app.assert_referral_due_future(p_response_due_at);

  perform set_config('app.in_referral_rpc', 'on', true);
  update public.case_referral
  set referral_type_id = v_type.id,
      type_label = v_type.label,
      subject = btrim(p_subject),
      description_md = p_description_md,
      response_expected = coalesce(p_response_expected, true),
      priority = coalesce(nullif(btrim(coalesce(p_priority, '')), ''), 'routine'),
      requested_action_id = p_requested_action_id,
      requested_action_label = app.resolve_requested_action_label(p_requested_action_id),
      response_due_at = p_response_due_at,
      updated_at = now()
  where id = p_referral_id
  returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);

  return v_row;
end;
$$;
alter function public.update_referral_draft(uuid, uuid, text, text, boolean, text, uuid, timestamptz) owner to postgres;
revoke all on function public.update_referral_draft(uuid, uuid, text, text, boolean, text, uuid, timestamptz) from public;
grant execute on function public.update_referral_draft(uuid, uuid, text, text, boolean, text, uuid, timestamptz) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8. set_referral_deadline — a coordinator (source OR target) sets/updates the SLA
--    deadline on an in-flight referral. Past-date → HC0A4. Non-terminal only.
-- -----------------------------------------------------------------------------
create or replace function public.set_referral_deadline(
  p_referral_id uuid,
  p_response_due_at timestamptz default null
) returns public.case_referral
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_ref public.case_referral;
  v_uid uuid := auth.uid();
  v_result public.case_referral;
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id for update;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;
  if not (app.can_manage_referral_source(p_referral_id, v_uid)
          or app.can_manage_referral_target(p_referral_id, v_uid)) then
    raise exception 'apenas a coordenação de origem ou destino pode definir o prazo'
      using errcode = 'HC072';
  end if;
  if v_ref.status = any (array['draft', 'completed', 'rejected', 'withdrawn']) then
    raise exception 'não é possível definir prazo neste estado do encaminhamento'
      using errcode = 'HC070';
  end if;
  perform app.assert_referral_due_future(p_response_due_at);

  perform set_config('app.in_referral_rpc', 'on', true);
  update public.case_referral
     set response_due_at = p_response_due_at, updated_at = now()
   where id = p_referral_id
   returning * into v_result;
  perform set_config('app.in_referral_rpc', 'off', true);

  return v_result;
end;
$$;
alter function public.set_referral_deadline(uuid, timestamptz) owner to postgres;
revoke all on function public.set_referral_deadline(uuid, timestamptz) from public;
grant execute on function public.set_referral_deadline(uuid, timestamptz) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 9. decline_referral — DROP + recreate with p_decline_reason_code (PHI-free). LIVE
--    body reproduced verbatim + the structured reason on the UPDATE. The optional
--    PHI free-text note keeps its existing column treatment.
-- -----------------------------------------------------------------------------
drop function if exists public.decline_referral(uuid, text);
create function public.decline_referral(
  p_referral_id uuid,
  p_note text default null,
  p_decline_reason_code text default null
) returns public.case_referral
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();
  perform app.assert_referral_target_acts(p_referral_id, array['received', 'accepted', 'in_review']);

  if p_decline_reason_code is not null and p_decline_reason_code <> all (array[
       'outside_jurisdiction', 'duplicate', 'wrong_committee',
       'insufficient_information', 'conflict_of_interest', 'other']) then
    raise exception 'motivo de recusa inválido' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_referral_rpc', 'on', true);
  update public.case_referral
  set status = 'rejected', decided_at = now(), decided_by = auth.uid(),
      decline_note = p_note, decline_reason_code = p_decline_reason_code, updated_at = now()
  where id = p_referral_id
  returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);
  return v_row;
end;
$$;
alter function public.decline_referral(uuid, text, text) owner to postgres;
revoke all on function public.decline_referral(uuid, text, text) from public;
grant execute on function public.decline_referral(uuid, text, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 10. get_referral_detail — extend the audited door to project the R2 PHI-free
--     triage fields (priority / requested_action / response_due_at / decline_reason_code).
--     LIVE R1 body reproduced verbatim; the ONLY additions are these four keys +
--     re-adding the R1 messages/waiting projection. All PHI-free (no v_can_phi gate).
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
