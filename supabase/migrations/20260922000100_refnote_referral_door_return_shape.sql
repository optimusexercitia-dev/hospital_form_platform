-- =============================================================================
-- BUG-REFNOTE-001 (+ the rest of its class): narrow every referral-module door's
-- RETURN shape to the granted column list.
--
-- FILED AS FOUR DOORS. IT IS TWENTY-THREE. The bug named the four
-- `referral_internal_notes` mutators that hand back the unmasked `body_md`. The
-- shape — a DEFINER door whose `RETURNS <table>` re-opens exactly what a
-- column-list SELECT GRANT closed — holds across the whole referral surface, so
-- this closes the population rather than the instance:
--
--   case_referral            5 withheld  (description_md, decline_note,
--                                         phi_disposed_at/_by/_reason)   15 doors
--   referral_internal_notes  1 withheld  (body_md)                        6 doors
--   referral_messages        1 withheld  (body)                           2 doors
--
-- The 15 `case_referral` doors are the larger half and were NOT in the bug:
-- every one of `send`/`accept`/`decline`/`resolve`/`conclude`/… returns the full
-- row, so a direct PostgREST caller reads `description_md` — the referral's
-- narrative — past a GRANT that exists to force that read through
-- `get_referral_detail`, which gates AND calls `log_audit_access`.
--
-- ⚠ RULE 11, THE OTHER HALF. The bug warns: "do not fix by narrowing the return
-- alone without checking the audit arm — closing one silently leaves the other."
-- Checked, and recorded here rather than assumed:
--   · The Rule 11 READ obligation is DISCHARGED BY REMOVAL, not by a new audit
--     arm. After this migration no withheld column is served on these paths, so
--     there is no read left to log. What keeps that true is the pgTAP keystone
--     pinning each composite's field list to its table's GRANT — re-widen the
--     return and the pin reds. An audit arm added instead would log a read that
--     should not be happening at all.
--   · The Rule 11 MUTATION obligation was verified INDEPENDENTLY of the body
--     comments (a comment is an assertion that goes stale silently):
--     `case_referral` carries `trg_audit_referral_aiud` (AIUD, tgenabled='O') in
--     `pg_trigger`; the 8 note/message doors each call `app.audit_write`
--     directly. Both hold in the LIVE catalog, so no mutation row is owed here.
--
-- DECISION (return-shape): a NAMED COMPOSITE per table whose fields are EXACTLY
-- the columns that table's `authenticated` column-list SELECT GRANT exposes —
-- the FUP-PDF-3 precedent (migration 20260921000100), for its reasons: the GRANT
-- is the single authority on what a direct caller may see, so a future column
-- joins the composite only when it also receives its own GRANT. `RETURNS TABLE`
-- would make the doors set-returning (an ARRAY over PostgREST), breaking the
-- single-object contract the server actions read.
--
-- The projection goes through `app._project_*`, one helper per type, using
-- `jsonb_populate_record` BY NAME — so field order can never silently mis-map a
-- column, and the composite acts as an ALLOWLIST: a column absent from it is
-- dropped, making a future ungranted column withheld by default.
--
-- ⚠ A return type cannot change under CREATE OR REPLACE — this is DROP + CREATE,
-- the exact shape that silently loses properties ("guards that read right but
-- fail open": DROP+CREATE loses the ACL). Every door below re-states SECURITY
-- DEFINER, the pinned search_path, and the ACL explicitly. The pre-change ACL was
-- read from the catalog and is UNIFORM across all 23 —
-- `{postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres}`,
-- owner `postgres`, nothing for PUBLIC — which is what the `revoke all … from
-- public` + `grant … to authenticated, service_role` pair below reproduces.
-- pgTAP 326 pins the property diff.
--
-- PRODUCT IMPACT: none. All four filed call sites
-- (`src/lib/referrals/actions.ts`) read `const { error } = await supabase.rpc(…)`
-- and discard the returned row; the `case_referral` doors' callers were checked
-- the same way.
--
-- ⚠ Every function body below is a VERBATIM `pg_get_functiondef()` transcript
-- from the LIVE catalog (2026-08-12) with exactly two mechanical substitutions —
-- the RETURNS clause and the single final `return` — each asserted to have fired
-- before emission. Bodies were NOT transcribed from prior migration text, which
-- is stale by design in this repo.
-- =============================================================================

-- ====================================================================
-- case_referral → case_referral_public
-- ====================================================================
create type public.case_referral_public as (
  id uuid,
  code text,
  source_case_id uuid,
  source_commission_id uuid,
  target_commission_id uuid,
  referral_type_id uuid,
  type_label text,
  subject text,
  status text,
  response_expected boolean,
  target_case_id uuid,
  has_patient boolean,
  created_by uuid,
  sent_at timestamp with time zone,
  sent_by uuid,
  received_at timestamp with time zone,
  received_by uuid,
  decided_at timestamp with time zone,
  decided_by uuid,
  concluded_at timestamp with time zone,
  concluded_by uuid,
  withdrawn_at timestamp with time zone,
  withdrawn_by uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  source_commission_name text,
  target_commission_name text,
  waiting_on_committee_id uuid,
  last_message_at timestamp with time zone,
  priority text,
  requested_action_id uuid,
  requested_action_label text,
  response_due_at timestamp with time zone,
  decline_reason_code text,
  parent_referral_id uuid,
  target_type text,
  target_hospital_id uuid,
  target_hospital_name text,
  waiting_on_hospital_id uuid
);

create function app._project_case_referral(p public.case_referral)
returns public.case_referral_public
language sql
immutable
set search_path to 'app', 'public', 'pg_catalog'
as $$
  -- BY NAME, not by position: jsonb_populate_record matches keys to composite
  -- fields, so a future case_referral column can never silently land in a
  -- field it was not named for. It is also why this is an ALLOWLIST — a column
  -- absent from the composite is simply dropped, so a new ungranted column is
  -- withheld by default rather than leaked by default.
  select jsonb_populate_record(null::public.case_referral_public, to_jsonb(p));
$$;

-- ── accept_referral ──────────────────────────────────────────────────────────
drop function public.accept_referral(p_referral_id uuid);

create function public.accept_referral(p_referral_id uuid)
 RETURNS case_referral_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();
  perform app.assert_referral_target_acts(p_referral_id, array['received']);

  perform set_config('app.in_referral_rpc', 'on', true);
  update public.case_referral
  set status = 'accepted', decided_at = now(), decided_by = auth.uid(), updated_at = now()
  where id = p_referral_id
  returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);
  return app._project_case_referral(v_row);
end;
$function$
;

revoke all on function public.accept_referral(p_referral_id uuid) from public;
grant execute on function public.accept_referral(p_referral_id uuid) to authenticated, service_role;

-- ── conclude_referral ──────────────────────────────────────────────────────────
drop function public.conclude_referral(p_referral_id uuid, p_reply_outcome_id uuid, p_result_md text, p_acknowledged_only boolean);

create function public.conclude_referral(p_referral_id uuid, p_reply_outcome_id uuid DEFAULT NULL::uuid, p_result_md text DEFAULT NULL::text, p_acknowledged_only boolean DEFAULT false)
 RETURNS case_referral_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
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
  --
  -- The source is a commission on EVERY referral, so the answer always hands the ball
  -- to a committee — but waiting_on_hospital_id must be cleared in the same statement,
  -- or a DT referral that was waiting on its hospital ends up with both parties set.
  if v_referral.response_expected then
    update public.case_referral
    set status = 'answered',
        waiting_on_committee_id = v_referral.source_commission_id,
        waiting_on_hospital_id = null,
        concluded_at = now(), concluded_by = auth.uid(), updated_at = now()
    where id = p_referral_id
    returning * into v_row;
  else
    update public.case_referral
    set status = 'completed',
        waiting_on_committee_id = null,
        waiting_on_hospital_id = null,
        concluded_at = now(), concluded_by = auth.uid(), updated_at = now()
    where id = p_referral_id
    returning * into v_row;
  end if;

  perform set_config('app.in_referral_rpc', 'off', true);
  return app._project_case_referral(v_row);
end;
$function$
;

revoke all on function public.conclude_referral(p_referral_id uuid, p_reply_outcome_id uuid, p_result_md text, p_acknowledged_only boolean) from public;
grant execute on function public.conclude_referral(p_referral_id uuid, p_reply_outcome_id uuid, p_result_md text, p_acknowledged_only boolean) to authenticated, service_role;

-- ── create_referral_draft ──────────────────────────────────────────────────────────
drop function public.create_referral_draft(p_source_case_id uuid, p_target_commission_id uuid, p_referral_type_id uuid, p_subject text, p_response_expected boolean, p_description_md text, p_priority text, p_requested_action_id uuid, p_response_due_at timestamp with time zone, p_parent_referral_id uuid, p_target_hospital_id uuid);

create function public.create_referral_draft(p_source_case_id uuid, p_target_commission_id uuid, p_referral_type_id uuid, p_subject text, p_response_expected boolean DEFAULT NULL::boolean, p_description_md text DEFAULT NULL::text, p_priority text DEFAULT 'routine'::text, p_requested_action_id uuid DEFAULT NULL::uuid, p_response_due_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_parent_referral_id uuid DEFAULT NULL::uuid, p_target_hospital_id uuid DEFAULT NULL::uuid)
 RETURNS case_referral_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_source_commission uuid;
  v_source_hospital uuid;
  v_target_type text;
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
  if not app.is_staff_admin_of_for(v_source_commission, auth.uid()) then
    raise exception 'apenas a coordenação da comissão de origem pode encaminhar o caso'
      using errcode = 'HC071';
  end if;

  -- EXACTLY ONE target, resolved before anything else uses it (D7). Stated as a
  -- two-sided test so neither "both" nor "neither" can slip through.
  if (p_target_commission_id is not null) = (p_target_hospital_id is not null) then
    raise exception 'informe exatamente um destino: uma comissão ou a direção técnica'
      using errcode = 'check_violation';
  end if;
  v_target_type := case when p_target_hospital_id is not null
                        then 'technical_director' else 'commission' end;

  if v_target_type = 'technical_director' then
    perform app.assert_technical_director_enabled();

    -- THE SAME-HOSPITAL RULE. The DT is technically responsible for the committees of
    -- ONE hospital; a committee of another hospital has no standing to address it, and
    -- admitting one would hand that DT the PHI of a hospital they are not responsible
    -- for.
    select hospital_id into v_source_hospital from public.commissions where id = v_source_commission;
    if p_target_hospital_id is distinct from v_source_hospital then
      raise exception 'a comissão só pode encaminhar à direção técnica do seu próprio hospital'
        using errcode = 'HC071';
    end if;
  else
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
    parent_referral_id, target_type, target_hospital_id
  ) values (
    p_source_case_id, v_source_commission, p_target_commission_id, v_type.id,
    v_type.label, btrim(p_subject), nullif(btrim(coalesce(p_description_md, '')), ''),
    v_response_expected, auth.uid(),
    coalesce(nullif(btrim(coalesce(p_priority, '')), ''), 'routine'),
    p_requested_action_id, app.resolve_requested_action_label(p_requested_action_id),
    p_response_due_at,
    p_parent_referral_id, v_target_type, p_target_hospital_id
  )
  returning * into v_row;

  return app._project_case_referral(v_row);
end;
$function$
;

revoke all on function public.create_referral_draft(p_source_case_id uuid, p_target_commission_id uuid, p_referral_type_id uuid, p_subject text, p_response_expected boolean, p_description_md text, p_priority text, p_requested_action_id uuid, p_response_due_at timestamp with time zone, p_parent_referral_id uuid, p_target_hospital_id uuid) from public;
grant execute on function public.create_referral_draft(p_source_case_id uuid, p_target_commission_id uuid, p_referral_type_id uuid, p_subject text, p_response_expected boolean, p_description_md text, p_priority text, p_requested_action_id uuid, p_response_due_at timestamp with time zone, p_parent_referral_id uuid, p_target_hospital_id uuid) to authenticated, service_role;

-- ── decline_referral ──────────────────────────────────────────────────────────
drop function public.decline_referral(p_referral_id uuid, p_note text, p_decline_reason_code text);

create function public.decline_referral(p_referral_id uuid, p_note text DEFAULT NULL::text, p_decline_reason_code text DEFAULT NULL::text)
 RETURNS case_referral_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
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
  return app._project_case_referral(v_row);
end;
$function$
;

revoke all on function public.decline_referral(p_referral_id uuid, p_note text, p_decline_reason_code text) from public;
grant execute on function public.decline_referral(p_referral_id uuid, p_note text, p_decline_reason_code text) to authenticated, service_role;

-- ── link_referral_case ──────────────────────────────────────────────────────────
drop function public.link_referral_case(p_referral_id uuid, p_target_case_id uuid);

create function public.link_referral_case(p_referral_id uuid, p_target_case_id uuid DEFAULT NULL::uuid)
 RETURNS case_referral_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_referral public.case_referral;
  v_case_commission uuid;
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();
  v_referral := app.assert_referral_target_acts(p_referral_id, array['received', 'accepted', 'in_review']);

  -- NULL-hole #3. Below, `v_case_commission <> v_referral.target_commission_id` yields
  -- NULL on a DT row, the IF is not taken, and ANY case in the database would have been
  -- attached. The refusal has to be explicit and it has to come FIRST.
  if v_referral.target_type = 'technical_director' then
    if p_target_case_id is not null then
      raise exception 'um encaminhamento à direção técnica não pode ser vinculado a um caso'
        using errcode = 'HC079';
    end if;
    -- Clearing is harmless (target_case_id is already NULL) and stays idempotent.
  elsif p_target_case_id is not null then
    select commission_id into v_case_commission from public.cases where id = p_target_case_id;
    if v_case_commission is null then
      raise exception 'caso não encontrado' using errcode = 'HC079';
    end if;
    if v_case_commission <> v_referral.target_commission_id then
      raise exception 'o caso selecionado não pertence à comissão de destino' using errcode = 'HC079';
    end if;
  end if;

  perform set_config('app.in_referral_rpc', 'on', true);
  update public.case_referral
  set target_case_id = p_target_case_id, updated_at = now()
  where id = p_referral_id
  returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);
  return app._project_case_referral(v_row);
end;
$function$
;

revoke all on function public.link_referral_case(p_referral_id uuid, p_target_case_id uuid) from public;
grant execute on function public.link_referral_case(p_referral_id uuid, p_target_case_id uuid) to authenticated, service_role;

-- ── provide_referral_information ──────────────────────────────────────────────────────────
drop function public.provide_referral_information(p_referral_id uuid, p_body text);

create function public.provide_referral_information(p_referral_id uuid, p_body text)
 RETURNS case_referral_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_ref public.case_referral;
  v_uid uuid := auth.uid();
  v_seq integer;
  v_msg_id uuid;
  v_result public.case_referral;
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id for update;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  if not app.is_staff_admin_of(v_ref.source_commission_id) then
    raise exception 'apenas a comissão de origem pode responder à solicitação' using errcode = 'HC0A0';
  end if;
  if nullif(btrim(p_body), '') is null then
    raise exception 'informe a resposta à solicitação' using errcode = 'HC0A0';
  end if;
  if v_ref.status <> 'awaiting_information' then
    raise exception 'não há solicitação de informação pendente neste encaminhamento' using errcode = 'HC0A1';
  end if;

  perform set_config('app.in_referral_rpc', 'on', true);
  select coalesce(max(sequence_number), 0) + 1 into v_seq
  from public.referral_messages where referral_id = p_referral_id;
  insert into public.referral_messages
    (referral_id, sequence_number, sender_commission_id, sender_user_id, message_type, body)
  values (p_referral_id, v_seq, v_ref.source_commission_id, v_uid, 'information_response', btrim(p_body))
  returning id into v_msg_id;

  -- D9: the ball goes back to whichever target this referral has.
  update public.case_referral
  set status = 'in_review',
      waiting_on_committee_id = case when target_type = 'commission' then target_commission_id end,
      waiting_on_hospital_id  = case when target_type = 'technical_director' then target_hospital_id end,
      last_message_at = now(), updated_at = now()
  where id = p_referral_id
  returning * into v_result;
  perform set_config('app.in_referral_rpc', 'off', true);

  perform app.audit_write('referral.message_created', 'referral', p_referral_id,
    v_ref.source_commission_id,
    'Resposta à solicitação (msg nº ' || v_seq || ') no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('message_id', v_msg_id, 'sequence_number', v_seq,
                       'message_type', 'information_response', 'sender_commission_id', v_ref.source_commission_id));

  return app._project_case_referral(v_result);
end;
$function$
;

revoke all on function public.provide_referral_information(p_referral_id uuid, p_body text) from public;
grant execute on function public.provide_referral_information(p_referral_id uuid, p_body text) to authenticated, service_role;

-- ── receive_referral ──────────────────────────────────────────────────────────
drop function public.receive_referral(p_referral_id uuid);

create function public.receive_referral(p_referral_id uuid)
 RETURNS case_referral_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();
  perform app.assert_referral_target_acts(p_referral_id, array['sent']);

  perform set_config('app.in_referral_rpc', 'on', true);
  update public.case_referral
  set status = 'received', received_at = now(), received_by = auth.uid(), updated_at = now()
  where id = p_referral_id
  returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);
  return app._project_case_referral(v_row);
end;
$function$
;

revoke all on function public.receive_referral(p_referral_id uuid) from public;
grant execute on function public.receive_referral(p_referral_id uuid) to authenticated, service_role;

-- ── reopen_referral ──────────────────────────────────────────────────────────
drop function public.reopen_referral(p_referral_id uuid, p_reason text);

create function public.reopen_referral(p_referral_id uuid, p_reason text)
 RETURNS case_referral_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
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
  -- D9: same arm as provide_referral_information — reopening hands the ball to the
  -- target, and on a DT row that target is a hospital's technical direction.
  update public.case_referral
     set status = 'in_review',
         waiting_on_committee_id = case when target_type = 'commission' then target_commission_id end,
         waiting_on_hospital_id  = case when target_type = 'technical_director' then target_hospital_id end,
         updated_at = now()
   where id = p_referral_id
   returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);
  -- referral.status_changed is emitted by trg_audit_referral on the status change.

  return app._project_case_referral(v_row);
end;
$function$
;

revoke all on function public.reopen_referral(p_referral_id uuid, p_reason text) from public;
grant execute on function public.reopen_referral(p_referral_id uuid, p_reason text) to authenticated, service_role;

-- ── request_referral_information ──────────────────────────────────────────────────────────
drop function public.request_referral_information(p_referral_id uuid, p_body text);

create function public.request_referral_information(p_referral_id uuid, p_body text)
 RETURNS case_referral_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_ref public.case_referral;
  v_uid uuid := auth.uid();
  v_sender uuid;
  v_seq integer;
  v_msg_id uuid;
  v_result public.case_referral;
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id for update;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  if v_ref.target_type = 'technical_director' then
    if not app.is_technical_director_of_for(v_ref.target_hospital_id, v_uid) then
      raise exception 'apenas a direção técnica de destino pode solicitar informações'
        using errcode = 'HC0A0';
    end if;
    v_sender := null;  -- D3
  else
    if not (app.is_staff_admin_of(v_ref.target_commission_id)
            or app.referral_target_analyst(p_referral_id, v_uid)) then
      raise exception 'apenas a comissão de destino pode solicitar informações' using errcode = 'HC0A0';
    end if;
    v_sender := v_ref.target_commission_id;
  end if;

  if nullif(btrim(p_body), '') is null then
    raise exception 'descreva a informação solicitada' using errcode = 'HC0A0';
  end if;
  if v_ref.status <> 'in_review' then
    raise exception 'só é possível solicitar informações durante a análise' using errcode = 'HC0A1';
  end if;

  perform set_config('app.in_referral_rpc', 'on', true);
  select coalesce(max(sequence_number), 0) + 1 into v_seq
  from public.referral_messages where referral_id = p_referral_id;
  insert into public.referral_messages
    (referral_id, sequence_number, sender_commission_id, sender_user_id, message_type, body)
  values (p_referral_id, v_seq, v_sender, v_uid, 'information_request', btrim(p_body))
  returning id into v_msg_id;

  -- The waiting party here is the SOURCE, which is a commission on every referral —
  -- so this arm needs no D9 treatment. (Its mirror, provide_referral_information,
  -- hands the ball back to the target and does.)
  update public.case_referral
  set status = 'awaiting_information',
      waiting_on_committee_id = source_commission_id,
      waiting_on_hospital_id = null,
      last_message_at = now(), updated_at = now()
  where id = p_referral_id
  returning * into v_result;
  perform set_config('app.in_referral_rpc', 'off', true);

  perform app.audit_write('referral.message_created', 'referral', p_referral_id,
    v_ref.source_commission_id,
    'Solicitação de informação (msg nº ' || v_seq || ') no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('message_id', v_msg_id, 'sequence_number', v_seq,
                       'message_type', 'information_request', 'sender_commission_id', v_sender));

  return app._project_case_referral(v_result);
end;
$function$
;

revoke all on function public.request_referral_information(p_referral_id uuid, p_body text) from public;
grant execute on function public.request_referral_information(p_referral_id uuid, p_body text) to authenticated, service_role;

-- ── resolve_referral ──────────────────────────────────────────────────────────
drop function public.resolve_referral(p_referral_id uuid, p_summary_md text, p_follow_up boolean);

create function public.resolve_referral(p_referral_id uuid, p_summary_md text DEFAULT NULL::text, p_follow_up boolean DEFAULT false)
 RETURNS case_referral_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
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
  -- Resolution is terminal: NOBODY is waiting. Both columns, for the same reason as
  -- conclude_referral — a stale waiting_on_hospital_id would leave a closed referral
  -- reading as "the technical direction is still holding this".
  update public.case_referral
     set status = 'resolved',
         waiting_on_committee_id = null,
         waiting_on_hospital_id = null,
         updated_at = now()
   where id = p_referral_id
   returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);
  -- referral.status_changed is emitted by trg_audit_referral on the status change.

  return app._project_case_referral(v_row);
end;
$function$
;

revoke all on function public.resolve_referral(p_referral_id uuid, p_summary_md text, p_follow_up boolean) from public;
grant execute on function public.resolve_referral(p_referral_id uuid, p_summary_md text, p_follow_up boolean) to authenticated, service_role;

-- ── send_referral ──────────────────────────────────────────────────────────
drop function public.send_referral(p_referral_id uuid);

create function public.send_referral(p_referral_id uuid)
 RETURNS case_referral_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_referral public.case_referral;
  v_item_count integer;
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'P0002';
  end if;
  if not app.can_manage_referral_source(p_referral_id, auth.uid()) then
    raise exception 'apenas a coordenação da comissão de origem pode enviar o encaminhamento'
      using errcode = 'HC071';
  end if;
  if v_referral.status <> 'draft' then
    raise exception 'apenas rascunhos podem ser enviados' using errcode = 'HC070';
  end if;

  select count(*) into v_item_count from public.referral_shared_item where referral_id = p_referral_id;
  if v_item_count = 0 and btrim(coalesce(v_referral.description_md, '')) = '' then
    raise exception 'Informe uma descrição, ou anexe ao menos uma narrativa ou documento, antes de enviar.'
      using errcode = 'check_violation';
  end if;

  perform set_config('app.in_referral_rpc', 'on', true);
  update public.case_referral
  set status = 'sent', sent_at = now(), sent_by = auth.uid(), updated_at = now()
  where id = p_referral_id
  returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);

  return app._project_case_referral(v_row);
end;
$function$
;

revoke all on function public.send_referral(p_referral_id uuid) from public;
grant execute on function public.send_referral(p_referral_id uuid) to authenticated, service_role;

-- ── set_referral_deadline ──────────────────────────────────────────────────────────
drop function public.set_referral_deadline(p_referral_id uuid, p_response_due_at timestamp with time zone);

create function public.set_referral_deadline(p_referral_id uuid, p_response_due_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS case_referral_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
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

  return app._project_case_referral(v_result);
end;
$function$
;

revoke all on function public.set_referral_deadline(p_referral_id uuid, p_response_due_at timestamp with time zone) from public;
grant execute on function public.set_referral_deadline(p_referral_id uuid, p_response_due_at timestamp with time zone) to authenticated, service_role;

-- ── start_referral_review ──────────────────────────────────────────────────────────
drop function public.start_referral_review(p_referral_id uuid);

create function public.start_referral_review(p_referral_id uuid)
 RETURNS case_referral_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();
  perform app.assert_referral_target_acts(p_referral_id, array['accepted']);

  perform set_config('app.in_referral_rpc', 'on', true);
  update public.case_referral
  set status = 'in_review', updated_at = now()
  where id = p_referral_id
  returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);
  return app._project_case_referral(v_row);
end;
$function$
;

revoke all on function public.start_referral_review(p_referral_id uuid) from public;
grant execute on function public.start_referral_review(p_referral_id uuid) to authenticated, service_role;

-- ── update_referral_draft ──────────────────────────────────────────────────────────
drop function public.update_referral_draft(p_referral_id uuid, p_referral_type_id uuid, p_subject text, p_description_md text, p_response_expected boolean, p_priority text, p_requested_action_id uuid, p_response_due_at timestamp with time zone);

create function public.update_referral_draft(p_referral_id uuid, p_referral_type_id uuid, p_subject text, p_description_md text DEFAULT NULL::text, p_response_expected boolean DEFAULT true, p_priority text DEFAULT 'routine'::text, p_requested_action_id uuid DEFAULT NULL::uuid, p_response_due_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS case_referral_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
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

  return app._project_case_referral(v_row);
end;
$function$
;

revoke all on function public.update_referral_draft(p_referral_id uuid, p_referral_type_id uuid, p_subject text, p_description_md text, p_response_expected boolean, p_priority text, p_requested_action_id uuid, p_response_due_at timestamp with time zone) from public;
grant execute on function public.update_referral_draft(p_referral_id uuid, p_referral_type_id uuid, p_subject text, p_description_md text, p_response_expected boolean, p_priority text, p_requested_action_id uuid, p_response_due_at timestamp with time zone) to authenticated, service_role;

-- ── withdraw_referral ──────────────────────────────────────────────────────────
drop function public.withdraw_referral(p_referral_id uuid);

create function public.withdraw_referral(p_referral_id uuid)
 RETURNS case_referral_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_status text;
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();
  select status into v_status from public.case_referral where id = p_referral_id;
  if v_status is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'P0002';
  end if;
  if not app.can_manage_referral_source(p_referral_id, auth.uid()) then
    raise exception 'apenas a coordenação da comissão de origem pode retirar o encaminhamento'
      using errcode = 'HC071';
  end if;
  if v_status not in ('draft', 'sent', 'received', 'accepted', 'in_review') then
    raise exception 'este encaminhamento não pode ser retirado neste estado' using errcode = 'HC070';
  end if;

  perform set_config('app.in_referral_rpc', 'on', true);
  update public.case_referral
  set status = 'withdrawn', withdrawn_at = now(), withdrawn_by = auth.uid(), updated_at = now()
  where id = p_referral_id
  returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);

  return app._project_case_referral(v_row);
end;
$function$
;

revoke all on function public.withdraw_referral(p_referral_id uuid) from public;
grant execute on function public.withdraw_referral(p_referral_id uuid) to authenticated, service_role;

-- ====================================================================
-- referral_internal_notes → referral_internal_note_public
-- ====================================================================
create type public.referral_internal_note_public as (
  id uuid,
  referral_id uuid,
  committee_id uuid,
  author_user_id uuid,
  created_at timestamp with time zone,
  redacted_at timestamp with time zone,
  redacted_by uuid,
  redacted_reason text,
  title text,
  assigned_to uuid,
  status text,
  concluded_at timestamp with time zone,
  concluded_by uuid,
  updated_at timestamp with time zone,
  updated_by uuid,
  kind text
);

create function app._project_referral_internal_note(p public.referral_internal_notes)
returns public.referral_internal_note_public
language sql
immutable
set search_path to 'app', 'public', 'pg_catalog'
as $$
  -- BY NAME, not by position: jsonb_populate_record matches keys to composite
  -- fields, so a future referral_internal_notes column can never silently land in a
  -- field it was not named for. It is also why this is an ALLOWLIST — a column
  -- absent from the composite is simply dropped, so a new ungranted column is
  -- withheld by default rather than leaked by default.
  select jsonb_populate_record(null::public.referral_internal_note_public, to_jsonb(p));
$$;

-- ── assign_referral_internal_note ──────────────────────────────────────────────────────────
drop function public.assign_referral_internal_note(p_note_id uuid, p_user_id uuid);

create function public.assign_referral_internal_note(p_note_id uuid, p_user_id uuid)
 RETURNS referral_internal_note_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_note public.referral_internal_notes;
  v_ref  public.case_referral;
  v_row  public.referral_internal_notes;
begin
  perform app.assert_referrals_enabled();

  select * into v_note from public.referral_internal_notes where id = p_note_id for update;
  if v_note.id is null then
    raise exception 'nota interna não encontrada' using errcode = 'no_data_found';
  end if;
  select * into v_ref from public.case_referral where id = v_note.referral_id;

  -- AUTHORITY FIRST (42501) — coordinator of the note's OWN side only.
  if not app.can_manage_referral_internal_note(p_note_id, auth.uid()) then
    raise exception 'apenas a coordenação desta comissão pode atribuir um responsável'
      using errcode = '42501';
  end if;

  -- DOMAIN (after authority).
  if v_note.status <> 'open' then
    raise exception 'este registro já foi concluído e não pode receber um responsável'
      using errcode = 'HC0A9';
  end if;
  if p_user_id is null
     or not app.is_member_of_for(v_note.committee_id, p_user_id) then
    raise exception 'o responsável deve ser um membro ativo desta comissão'
      using errcode = 'HC0A9';
  end if;

  update public.referral_internal_notes
     set assigned_to = p_user_id, updated_by = auth.uid()
   where id = p_note_id
   returning * into v_row;

  perform app.audit_write(
    'referral.note_assigned', 'referral', v_note.referral_id, v_note.committee_id,
    'Responsável definido para uma nota interna do encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('note_id', v_note.id, 'assigned_to', p_user_id));

  return app._project_referral_internal_note(v_row);
end;
$function$
;

revoke all on function public.assign_referral_internal_note(p_note_id uuid, p_user_id uuid) from public;
grant execute on function public.assign_referral_internal_note(p_note_id uuid, p_user_id uuid) to authenticated, service_role;

-- ── conclude_referral_internal_note ──────────────────────────────────────────────────────────
drop function public.conclude_referral_internal_note(p_note_id uuid);

create function public.conclude_referral_internal_note(p_note_id uuid)
 RETURNS referral_internal_note_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_note public.referral_internal_notes;
  v_ref  public.case_referral;
  v_row  public.referral_internal_notes;
begin
  perform app.assert_referrals_enabled();

  select * into v_note from public.referral_internal_notes where id = p_note_id for update;
  if v_note.id is null then
    raise exception 'nota interna não encontrada' using errcode = 'no_data_found';
  end if;
  select * into v_ref from public.case_referral where id = v_note.referral_id;

  if not app.can_edit_referral_internal_note(p_note_id, auth.uid()) then
    raise exception 'apenas o autor, o responsável ou a coordenação desta comissão pode concluir este registro'
      using errcode = '42501';
  end if;

  -- DOMAIN: conclusion is one-way (the note freezes; redaction stays the only
  -- post-conclusion correction — D10).
  if v_note.status <> 'open' then
    raise exception 'este registro já foi concluído' using errcode = 'HC0A9';
  end if;

  update public.referral_internal_notes
     set status = 'concluded', concluded_at = now(),
         concluded_by = auth.uid(), updated_by = auth.uid()
   where id = p_note_id
   returning * into v_row;

  perform app.audit_write(
    'referral.note_concluded', 'referral', v_note.referral_id, v_note.committee_id,
    'Nota interna concluída no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('note_id', v_note.id));

  return app._project_referral_internal_note(v_row);
end;
$function$
;

revoke all on function public.conclude_referral_internal_note(p_note_id uuid) from public;
grant execute on function public.conclude_referral_internal_note(p_note_id uuid) to authenticated, service_role;

-- ── create_referral_internal_note ──────────────────────────────────────────────────────────
drop function public.create_referral_internal_note(p_referral_id uuid, p_committee_id uuid, p_body_md text, p_title text, p_kind text, p_assigned_to uuid);

create function public.create_referral_internal_note(p_referral_id uuid, p_committee_id uuid, p_body_md text, p_title text DEFAULT NULL::text, p_kind text DEFAULT 'note'::text, p_assigned_to uuid DEFAULT NULL::uuid)
 RETURNS referral_internal_note_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_ref  public.case_referral;
  v_row  public.referral_internal_notes;
  v_kind text := coalesce(nullif(btrim(p_kind), ''), 'note');
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  -- AUTHORITY FIRST (42501, distinct SQLSTATE). The committee must be one of the
  -- referral's two sides AND the caller a member of THAT side.
  if (p_committee_id is distinct from v_ref.source_commission_id
      and p_committee_id is distinct from v_ref.target_commission_id)
     or not app.is_member_of_for(p_committee_id, auth.uid()) then
    raise exception 'apenas um membro da comissão de origem ou destino pode registrar uma nota interna'
      using errcode = '42501';
  end if;

  -- DOMAIN validation (after authority).
  if nullif(btrim(p_body_md), '') is null then
    raise exception 'a nota interna não pode estar vazia' using errcode = 'HC0A9';
  end if;

  -- Shared case-Registro vocabulary; the CHECK is the backstop, this is the
  -- pt-BR-speaking front door.
  if v_kind <> all (array['note', 'meeting', 'decision', 'update', 'follow_up', 'other']) then
    raise exception 'tipo de registro inválido' using errcode = 'HC0A9';
  end if;

  if p_assigned_to is not null
     and not app.is_member_of_for(p_committee_id, p_assigned_to) then
    raise exception 'o responsável deve ser um membro ativo desta comissão'
      using errcode = 'HC0A9';
  end if;

  insert into public.referral_internal_notes
    (referral_id, committee_id, author_user_id, body_md, title,
     kind, assigned_to, updated_by)
  values
    (p_referral_id, p_committee_id, auth.uid(), btrim(p_body_md),
     nullif(btrim(p_title), ''), v_kind, p_assigned_to, auth.uid())
  returning * into v_row;

  perform app.audit_write(
    'referral.note_created', 'referral', p_referral_id, p_committee_id,
    'Nota interna registrada no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('note_id', v_row.id, 'committee_id', p_committee_id));

  return app._project_referral_internal_note(v_row);
end;
$function$
;

revoke all on function public.create_referral_internal_note(p_referral_id uuid, p_committee_id uuid, p_body_md text, p_title text, p_kind text, p_assigned_to uuid) from public;
grant execute on function public.create_referral_internal_note(p_referral_id uuid, p_committee_id uuid, p_body_md text, p_title text, p_kind text, p_assigned_to uuid) to authenticated, service_role;

-- ── redact_referral_note ──────────────────────────────────────────────────────────
drop function public.redact_referral_note(p_note_id uuid, p_reason text);

create function public.redact_referral_note(p_note_id uuid, p_reason text)
 RETURNS referral_internal_note_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_note public.referral_internal_notes;
  v_ref public.case_referral;
  v_row public.referral_internal_notes;
begin
  perform app.assert_referrals_enabled();

  select * into v_note from public.referral_internal_notes where id = p_note_id for update;
  if v_note.id is null then
    raise exception 'nota interna não encontrada' using errcode = 'no_data_found';
  end if;
  select * into v_ref from public.case_referral where id = v_note.referral_id;

  -- AUTHORITY FIRST (42501, distinct SQLSTATE) — a coordinator of the note's OWNING
  -- committee side.
  if v_note.committee_id = v_ref.source_commission_id then
    if not app.can_manage_referral_source(v_note.referral_id, auth.uid()) then
      raise exception 'apenas a coordenação da comissão de origem pode redigir o conteúdo desta nota'
        using errcode = '42501';
    end if;
  else
    if not app.can_manage_referral_target(v_note.referral_id, auth.uid()) then
      raise exception 'apenas a coordenação da comissão de destino pode redigir o conteúdo desta nota'
        using errcode = '42501';
    end if;
  end if;

  -- DOMAIN: append-only — a second redaction is rejected.
  if v_note.redacted_at is not null then
    raise exception 'esta nota já foi redigida' using errcode = 'HC0A9';
  end if;

  update public.referral_internal_notes
     set redacted_at = now(), redacted_by = auth.uid(), redacted_reason = p_reason
   where id = p_note_id
   returning * into v_row;

  perform app.audit_write(
    'referral.message_redacted', 'referral', v_note.referral_id, v_note.committee_id,
    'Nota interna redigida no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('note_id', v_note.id));

  return app._project_referral_internal_note(v_row);
end;
$function$
;

revoke all on function public.redact_referral_note(p_note_id uuid, p_reason text) from public;
grant execute on function public.redact_referral_note(p_note_id uuid, p_reason text) to authenticated, service_role;

-- ── unassign_referral_internal_note ──────────────────────────────────────────────────────────
drop function public.unassign_referral_internal_note(p_note_id uuid);

create function public.unassign_referral_internal_note(p_note_id uuid)
 RETURNS referral_internal_note_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_note public.referral_internal_notes;
  v_ref  public.case_referral;
  v_row  public.referral_internal_notes;
begin
  perform app.assert_referrals_enabled();

  select * into v_note from public.referral_internal_notes where id = p_note_id for update;
  if v_note.id is null then
    raise exception 'nota interna não encontrada' using errcode = 'no_data_found';
  end if;
  select * into v_ref from public.case_referral where id = v_note.referral_id;

  if not app.can_manage_referral_internal_note(p_note_id, auth.uid()) then
    raise exception 'apenas a coordenação desta comissão pode remover o responsável'
      using errcode = '42501';
  end if;

  if v_note.status <> 'open' then
    raise exception 'este registro já foi concluído' using errcode = 'HC0A9';
  end if;

  update public.referral_internal_notes
     set assigned_to = null, updated_by = auth.uid()
   where id = p_note_id
   returning * into v_row;

  perform app.audit_write(
    'referral.note_unassigned', 'referral', v_note.referral_id, v_note.committee_id,
    'Responsável removido de uma nota interna do encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('note_id', v_note.id));

  return app._project_referral_internal_note(v_row);
end;
$function$
;

revoke all on function public.unassign_referral_internal_note(p_note_id uuid) from public;
grant execute on function public.unassign_referral_internal_note(p_note_id uuid) to authenticated, service_role;

-- ── update_referral_internal_note ──────────────────────────────────────────────────────────
drop function public.update_referral_internal_note(p_note_id uuid, p_title text, p_body_md text, p_kind text);

create function public.update_referral_internal_note(p_note_id uuid, p_title text, p_body_md text, p_kind text DEFAULT 'note'::text)
 RETURNS referral_internal_note_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_note public.referral_internal_notes;
  v_ref  public.case_referral;
  v_row  public.referral_internal_notes;
  v_kind text := coalesce(nullif(btrim(p_kind), ''), 'note');
begin
  perform app.assert_referrals_enabled();

  select * into v_note from public.referral_internal_notes where id = p_note_id for update;
  if v_note.id is null then
    raise exception 'nota interna não encontrada' using errcode = 'no_data_found';
  end if;
  select * into v_ref from public.case_referral where id = v_note.referral_id;

  -- AUTHORITY FIRST (42501).
  if not app.can_edit_referral_internal_note(p_note_id, auth.uid()) then
    raise exception 'apenas o autor, o responsável ou a coordenação desta comissão pode editar este registro'
      using errcode = '42501';
  end if;

  -- DOMAIN (after authority).
  if v_note.status <> 'open' then
    raise exception 'este registro já foi concluído e não pode ser editado'
      using errcode = 'HC0A9';
  end if;
  if v_note.redacted_at is not null then
    raise exception 'este registro foi redigido e não pode ser editado' using errcode = 'HC0A9';
  end if;
  if nullif(btrim(p_body_md), '') is null then
    raise exception 'a nota interna não pode estar vazia' using errcode = 'HC0A9';
  end if;
  if v_kind <> all (array['note', 'meeting', 'decision', 'update', 'follow_up', 'other']) then
    raise exception 'tipo de registro inválido' using errcode = 'HC0A9';
  end if;

  -- `title` remains a CLEARING field (blank/NULL stores NULL); `kind` is now
  -- required, so an omitted/blank value falls back to 'note' rather than clearing.
  update public.referral_internal_notes
     set title      = nullif(btrim(p_title), ''),
         body_md    = btrim(p_body_md),
         kind       = v_kind,
         updated_by = auth.uid()
   where id = p_note_id
   returning * into v_row;

  perform app.audit_write(
    'referral.note_updated', 'referral', v_note.referral_id, v_note.committee_id,
    'Nota interna atualizada no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('note_id', v_note.id, 'committee_id', v_note.committee_id));

  return app._project_referral_internal_note(v_row);
end;
$function$
;

revoke all on function public.update_referral_internal_note(p_note_id uuid, p_title text, p_body_md text, p_kind text) from public;
grant execute on function public.update_referral_internal_note(p_note_id uuid, p_title text, p_body_md text, p_kind text) to authenticated, service_role;

-- ====================================================================
-- referral_messages → referral_message_public
-- ====================================================================
create type public.referral_message_public as (
  id uuid,
  referral_id uuid,
  sequence_number integer,
  sender_commission_id uuid,
  sender_user_id uuid,
  message_type text,
  created_at timestamp with time zone,
  in_reply_to_message_id uuid,
  supersedes_message_id uuid,
  redacted_at timestamp with time zone,
  redacted_by uuid,
  redacted_reason text
);

create function app._project_referral_message(p public.referral_messages)
returns public.referral_message_public
language sql
immutable
set search_path to 'app', 'public', 'pg_catalog'
as $$
  -- BY NAME, not by position: jsonb_populate_record matches keys to composite
  -- fields, so a future referral_messages column can never silently land in a
  -- field it was not named for. It is also why this is an ALLOWLIST — a column
  -- absent from the composite is simply dropped, so a new ungranted column is
  -- withheld by default rather than leaked by default.
  select jsonb_populate_record(null::public.referral_message_public, to_jsonb(p));
$$;

-- ── post_referral_message ──────────────────────────────────────────────────────────
drop function public.post_referral_message(p_referral_id uuid, p_message_type text, p_body text);

create function public.post_referral_message(p_referral_id uuid, p_message_type text DEFAULT 'general'::text, p_body text DEFAULT NULL::text)
 RETURNS referral_message_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_ref public.case_referral;
  v_uid uuid := auth.uid();
  v_sender uuid;
  v_seq integer;
  v_result public.referral_messages;
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id for update;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  if not app.can_read_referral_phi(p_referral_id, v_uid) then
    raise exception 'você não pode enviar mensagens neste encaminhamento' using errcode = 'HC0A0';
  end if;

  -- Resolve the sender side (source coord | target coord/analyst | target DT). A pure
  -- QPS reader cannot resolve to a side and thus cannot post.
  --
  -- The three branches are made mutually exclusive by pinning target_type, so a future
  -- edit cannot make two of them true at once. v_sender is left NULL for the DT side —
  -- D3 — and app.guard_referral_message is what tells a deliberate NULL apart from an
  -- unassigned variable.
  if app.is_staff_admin_of(v_ref.source_commission_id) then
    v_sender := v_ref.source_commission_id;
  elsif v_ref.target_type = 'technical_director'
        and app.is_technical_director_of_for(v_ref.target_hospital_id, v_uid) then
    v_sender := null;
  elsif v_ref.target_type = 'commission'
        and (app.is_staff_admin_of(v_ref.target_commission_id)
             or app.referral_target_analyst(p_referral_id, v_uid)) then
    v_sender := v_ref.target_commission_id;
  else
    raise exception 'apenas coordenadores ou o analista do destino podem enviar mensagens'
      using errcode = 'HC0A0';
  end if;

  if p_message_type is null or p_message_type not in
       ('general', 'information_request', 'information_response', 'clarification') then
    raise exception 'tipo de mensagem inválido' using errcode = 'HC0A0';
  end if;
  -- QA M-1: the state-driving types are produced ONLY by Solicitar informação /
  -- Responder (which also flip status + waiting_on). A free-form post may not label
  -- itself with them.
  if p_message_type in ('information_request', 'information_response') then
    raise exception 'use Solicitar informação ou Responder para este tipo de mensagem'
      using errcode = 'HC0A0';
  end if;
  if nullif(btrim(p_body), '') is null then
    raise exception 'a mensagem não pode estar vazia' using errcode = 'HC0A0';
  end if;
  if v_ref.status not in ('sent', 'received', 'accepted', 'in_review', 'awaiting_information') then
    raise exception 'não é possível enviar mensagens neste estado do encaminhamento'
      using errcode = 'HC0A0';
  end if;

  perform set_config('app.in_referral_rpc', 'on', true);
  select coalesce(max(sequence_number), 0) + 1 into v_seq
  from public.referral_messages where referral_id = p_referral_id;
  insert into public.referral_messages
    (referral_id, sequence_number, sender_commission_id, sender_user_id, message_type, body)
  values (p_referral_id, v_seq, v_sender, v_uid, p_message_type, btrim(p_body))
  returning * into v_result;
  update public.case_referral set last_message_at = now(), updated_at = now()
  where id = p_referral_id;
  perform set_config('app.in_referral_rpc', 'off', true);

  perform app.audit_write('referral.message_created', 'referral', p_referral_id,
    v_ref.source_commission_id,
    'Mensagem nº ' || v_seq || ' no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('message_id', v_result.id, 'sequence_number', v_seq,
                       'message_type', p_message_type, 'sender_commission_id', v_sender));

  return app._project_referral_message(v_result);
end;
$function$
;

revoke all on function public.post_referral_message(p_referral_id uuid, p_message_type text, p_body text) from public;
grant execute on function public.post_referral_message(p_referral_id uuid, p_message_type text, p_body text) to authenticated, service_role;

-- ── redact_referral_message ──────────────────────────────────────────────────────────
drop function public.redact_referral_message(p_message_id uuid, p_reason text);

create function public.redact_referral_message(p_message_id uuid, p_reason text)
 RETURNS referral_message_public
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_msg public.referral_messages;
  v_ref public.case_referral;
  v_row public.referral_messages;
begin
  perform app.assert_referrals_enabled();

  select * into v_msg from public.referral_messages where id = p_message_id for update;
  if v_msg.id is null then
    raise exception 'mensagem não encontrada' using errcode = 'no_data_found';
  end if;
  select * into v_ref from public.case_referral where id = v_msg.referral_id;

  -- AUTHORITY FIRST (42501) — a coordinator of EITHER side may redact a thread message.
  if not (app.can_manage_referral_source(v_msg.referral_id, auth.uid())
          or app.can_manage_referral_target(v_msg.referral_id, auth.uid())) then
    raise exception 'apenas a coordenação de origem ou destino pode redigir esta mensagem'
      using errcode = '42501';
  end if;

  -- DOMAIN: append-only — a second redaction is rejected.
  if v_msg.redacted_at is not null then
    raise exception 'esta mensagem já foi redigida' using errcode = 'HC0A9';
  end if;

  update public.referral_messages
     set redacted_at = now(), redacted_by = auth.uid(), redacted_reason = p_reason
   where id = p_message_id
   returning * into v_row;

  perform app.audit_write(
    'referral.message_redacted', 'referral', v_msg.referral_id, v_ref.source_commission_id,
    'Mensagem nº ' || v_msg.sequence_number || ' redigida no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('message_id', v_msg.id, 'sequence_number', v_msg.sequence_number));

  return app._project_referral_message(v_row);
end;
$function$
;

revoke all on function public.redact_referral_message(p_message_id uuid, p_reason text) from public;
grant execute on function public.redact_referral_message(p_message_id uuid, p_reason text) to authenticated, service_role;

