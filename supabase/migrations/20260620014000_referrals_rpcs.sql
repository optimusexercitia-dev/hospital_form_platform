-- ----------------------------------------------------------------------------
-- Phase 22 — Inter-Committee Case Referrals: RPCs + cross-cutting gate edits
-- ----------------------------------------------------------------------------
-- Forward-only (Rule): the close_case HC076 gate, the can_read_case QPS term, and
-- the log_audit_access allow-list extension are applied by CREATE OR REPLACE here
-- (NOT by editing the already-applied 20260620005000_cases.sql /
-- 20260620008000_audit.sql). All referral RPCs are public.*, SECURITY DEFINER,
-- search_path set, first line `perform app.assert_referrals_enabled();`, mutations
-- wrapped in the app.in_referral_rpc guard flag, each re-checks authority and
-- raises the mapped HC0xx (block HC070–HC07A; ADR 0037). Audited read doors mirror
-- get_event_patient / get_case_detail.

-- ===========================================================================
-- Cross-cutting edit 1 — log_audit_access allow-list (audit.sql). Append the two
-- referral access verbs so the audited doors can emit them; the positive
-- allow-list still rejects any forged mutation verb.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."log_audit_access"("p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_commission" "uuid", "p_summary" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if p_action not in (
    'response.opened_foreign', 'response.exported', 'audit.exported',
    'event_patient.read', 'case.opened',
    'safety_event.viewed', 'triage.viewed', 'rca.viewed', 'capa.viewed',
    'meeting.viewed', 'interview.viewed',
    -- Phase 22 (referrals): the audited PHI-identifier read + the PHI-bearing
    -- detail open (snapshot/reply bodies). `.viewed` keeps them distinct from
    -- mutation verbs.
    'referral_patient.read', 'referral.viewed'
  ) then
    raise exception 'log_audit_access: ação de acesso não permitida (%)', p_action
      using errcode = 'check_violation';
  end if;
  perform app.audit_write(p_action, p_entity_type, p_entity_id, p_commission, p_summary, p_metadata);
end;
$$;

ALTER FUNCTION "public"."log_audit_access"("p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_commission" "uuid", "p_summary" "text", "p_metadata" "jsonb") OWNER TO "postgres";

-- ===========================================================================
-- Cross-cutting edit 2 — can_read_case QPS term (cases.sql). Insert a flag-gated
-- QPS early-return BEFORE the case_access fallback so QPS macro-read does NOT
-- depend on the case_access flag. NO target_commission membership term => B never
-- gains live read of A. Flag-OFF behaviour is byte-identical to the original.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."can_read_case"("p_case_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return false;  -- unknown case → no access (and avoids is_member_of(NULL))
  end if;

  -- Phase 22 (Decision 6): QPS (the NSP/PQS roster) gets full LIVE read of any
  -- referral-touched source (A) OR linked (B) case — a macro view across
  -- committees. Placed BEFORE the case_access fallback so it does not depend on
  -- that flag. NO target_commission term, so B never reaches A's live case this
  -- way; B's only window into A is the frozen referral_shared_item snapshot.
  if app.feature_enabled('case_referrals') and app.is_pqs_member(p_uid)
     and exists (
       select 1 from public.case_referral r
       where r.source_case_id = p_case_id or r.target_case_id = p_case_id
     ) then
    return true;
  end if;

  -- D9 permissive fallback: with the feature OFF, behave EXACTLY as today
  -- (member-read). This is what keeps "flag OFF ⇒ today's behavior" true at every
  -- tightened SELECT policy.
  if not app.feature_enabled('case_access') then
    return app.is_member_of_for(v_commission, p_uid);
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    or app.is_admin_for(p_uid)
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = p_case_id and ca.user_id = p_uid
    )
    or exists (
      select 1 from public.case_phases cp
      where cp.case_id = p_case_id and cp.assigned_to = p_uid
    )
    or exists (
      select 1 from public.case_narratives cn
      where cn.case_id = p_case_id and cn.assigned_to = p_uid
    );
end;
$$;

ALTER FUNCTION "app"."can_read_case"("p_case_id" "uuid", "p_uid" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- Cross-cutting edit 3 — close_case HC076 gate (cases.sql). A reply-expecting
-- referral in flight (enviada/recebida/aceita/em_analise) blocks conclusion.
-- concluida/recusada/retirada resolve it; response_expected=false never blocks;
-- rascunho (unsent) intentionally excluded. Dark unless the flag is on.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."close_case"("p_case_id" "uuid") RETURNS "public"."cases"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_outcome_id uuid;
  v_unsettled integer;
  v_offered integer;
  v_result public.cases;
begin
  perform app.assert_cases_enabled();

  select status, outcome_id into v_status, v_outcome_id
  from public.cases where id = p_case_id;
  if v_status is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if v_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC025';
  end if;

  -- D3 gate 1: every phase must be settled (concluida or nao_necessaria).
  select count(*) into v_unsettled
  from public.case_phases
  where case_id = p_case_id and status in ('pendente', 'ativa');
  if v_unsettled > 0 then
    raise exception 'conclua ou marque todas as fases antes de concluir o caso'
      using errcode = 'HC031';
  end if;

  -- D3 gate 2: a process that OFFERS outcomes requires one selected.
  select count(*) into v_offered
  from public.case_offered_outcomes where case_id = p_case_id;
  if v_offered > 0 and v_outcome_id is null then
    raise exception 'selecione um desfecho antes de concluir o caso'
      using errcode = 'HC028';
  end if;

  -- Phase 22 (Decision 5): a reply-expecting referral still in flight blocks the
  -- close. rascunho (unsent) is excluded; response_expected=false never blocks.
  if app.feature_enabled('case_referrals') and exists (
    select 1 from public.case_referral r
    where r.source_case_id = p_case_id and r.response_expected = true
      and r.status in ('enviada', 'recebida', 'aceita', 'em_analise')
  ) then
    raise exception 'há encaminhamentos aguardando resposta; conclua, recuse ou retire antes de encerrar o caso'
      using errcode = 'HC076';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  -- Terminal FIRST: freeze the case, then any residual phase flip no-ops.
  update public.cases
  set status = 'concluido', closed_at = now(), closed_by = auth.uid()
  where id = p_case_id
  returning * into v_result;

  update public.case_phases
  set status = 'nao_necessaria', skipped_at = coalesce(skipped_at, now()), updated_at = now()
  where case_id = p_case_id and status in ('pendente', 'ativa');

  perform set_config('app.in_case_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."close_case"("p_case_id" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- Internal helper: load + authorize a draft for source-coordinator assembly.
-- Returns the referral row; raises HC071 (not source coord) / HC070 (not a draft)
-- / P0002 (missing). Keeps the assemble RPCs DRY.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."assert_referral_draft_writable"("p_referral_id" "uuid") RETURNS "public"."case_referral"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_referral public.case_referral;
begin
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'P0002';
  end if;
  if not app.can_manage_referral_source(p_referral_id, auth.uid()) then
    raise exception 'apenas a coordenação da comissão de origem pode editar este encaminhamento'
      using errcode = 'HC071';
  end if;
  if v_referral.status <> 'rascunho' then
    raise exception 'o encaminhamento não está em rascunho' using errcode = 'HC070';
  end if;
  return v_referral;
end;
$$;

ALTER FUNCTION "app"."assert_referral_draft_writable"("p_referral_id" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- Draft / assemble (source coordinator)
-- ===========================================================================

-- create_referral_draft: open a draft on a source case. Source coordinator only
-- (HC071). Snapshots type_label; seeds response_expected from the type when the
-- caller passes NULL.
CREATE OR REPLACE FUNCTION "public"."create_referral_draft"("p_source_case_id" "uuid", "p_target_commission_id" "uuid", "p_referral_type_id" "uuid", "p_subject" "text", "p_response_expected" boolean DEFAULT NULL::boolean) RETURNS "public"."case_referral"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
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
  -- Authority: staff_admin of the SOURCE case's commission (same authority as
  -- close_case) OR platform admin.
  if not (app.is_staff_admin_of_for(v_source_commission, auth.uid()) or app.is_admin_for(auth.uid())) then
    raise exception 'apenas a coordenação da comissão de origem pode encaminhar o caso'
      using errcode = 'HC071';
  end if;
  if v_source_commission = p_target_commission_id then
    raise exception 'a comissão de destino deve ser diferente da origem' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.commissions where id = p_target_commission_id) then
    raise exception 'comissão de destino não encontrada' using errcode = 'no_data_found';
  end if;
  if btrim(coalesce(p_subject, '')) = '' then
    raise exception 'informe um assunto para o encaminhamento' using errcode = 'check_violation';
  end if;

  select * into v_type from public.referral_types where id = p_referral_type_id;
  if v_type.id is null or not v_type.is_active then
    raise exception 'tipo de encaminhamento inválido' using errcode = 'check_violation';
  end if;
  v_response_expected := coalesce(p_response_expected, v_type.default_response_expected);

  insert into public.case_referral (
    source_case_id, source_commission_id, target_commission_id, referral_type_id,
    type_label, subject, response_expected, created_by
  ) values (
    p_source_case_id, v_source_commission, p_target_commission_id, v_type.id,
    v_type.label, btrim(p_subject), v_response_expected, auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

ALTER FUNCTION "public"."create_referral_draft"("p_source_case_id" "uuid", "p_target_commission_id" "uuid", "p_referral_type_id" "uuid", "p_subject" "text", "p_response_expected" boolean) OWNER TO "postgres";

-- update_referral_draft: edit a draft's type/subject/description/response-expected.
CREATE OR REPLACE FUNCTION "public"."update_referral_draft"("p_referral_id" "uuid", "p_referral_type_id" "uuid", "p_subject" "text", "p_description_md" "text" DEFAULT NULL::"text", "p_response_expected" boolean DEFAULT true) RETURNS "public"."case_referral"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
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

  perform set_config('app.in_referral_rpc', 'on', true);
  update public.case_referral
  set referral_type_id = v_type.id,
      type_label = v_type.label,
      subject = btrim(p_subject),
      description_md = p_description_md,
      response_expected = coalesce(p_response_expected, true),
      updated_at = now()
  where id = p_referral_id
  returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);

  return v_row;
end;
$$;

ALTER FUNCTION "public"."update_referral_draft"("p_referral_id" "uuid", "p_referral_type_id" "uuid", "p_subject" "text", "p_description_md" "text", "p_response_expected" boolean) OWNER TO "postgres";

-- add_referral_shared_item: freeze ONE snapshot row (narrative or document) onto a
-- draft. Validates the source belongs to the referral's source_case_id (so A
-- cannot leak another case's content) and the one-of shape (HC077).
CREATE OR REPLACE FUNCTION "public"."add_referral_shared_item"("p_referral_id" "uuid", "p_kind" "text", "p_source_narrative_id" "uuid" DEFAULT NULL::"uuid", "p_source_document_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."referral_shared_item"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_referral public.case_referral;
  v_narrative public.case_narratives;
  v_document public.case_documents;
  v_next_pos integer;
  v_row public.referral_shared_item;
begin
  perform app.assert_referrals_enabled();
  v_referral := app.assert_referral_draft_writable(p_referral_id);

  if p_kind not in ('narrative', 'document') then
    raise exception 'tipo de item inválido' using errcode = 'HC077';
  end if;

  select coalesce(max(position), -1) + 1 into v_next_pos
  from public.referral_shared_item where referral_id = p_referral_id;

  perform set_config('app.in_referral_rpc', 'on', true);

  if p_kind = 'narrative' then
    if p_source_narrative_id is null then
      raise exception 'selecione a narrativa a compartilhar' using errcode = 'HC077';
    end if;
    select * into v_narrative from public.case_narratives
      where id = p_source_narrative_id and case_id = v_referral.source_case_id;
    if v_narrative.id is null then
      raise exception 'narrativa não encontrada neste caso' using errcode = 'HC077';
    end if;
    insert into public.referral_shared_item (
      referral_id, kind, source_narrative_id, frozen_title, frozen_body_md, position
    ) values (
      p_referral_id, 'narrative', v_narrative.id,
      coalesce(v_narrative.title, v_narrative.type_label),
      coalesce(v_narrative.body_md, ''), v_next_pos
    )
    returning * into v_row;
  else
    if p_source_document_id is null then
      raise exception 'selecione o documento a compartilhar' using errcode = 'HC077';
    end if;
    select * into v_document from public.case_documents
      where id = p_source_document_id and case_id = v_referral.source_case_id and deleted_at is null;
    if v_document.id is null then
      raise exception 'documento não encontrado neste caso' using errcode = 'HC077';
    end if;
    insert into public.referral_shared_item (
      referral_id, kind, source_document_id, frozen_title,
      frozen_storage_path, frozen_mime_type, frozen_size_bytes, position
    ) values (
      p_referral_id, 'document', v_document.id, v_document.title,
      v_document.storage_path, v_document.mime_type, v_document.size_bytes, v_next_pos
    )
    returning * into v_row;
  end if;

  perform set_config('app.in_referral_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."add_referral_shared_item"("p_referral_id" "uuid", "p_kind" "text", "p_source_narrative_id" "uuid", "p_source_document_id" "uuid") OWNER TO "postgres";

-- remove_referral_shared_item: drop a frozen item from a draft.
CREATE OR REPLACE FUNCTION "public"."remove_referral_shared_item"("p_shared_item_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_referral_id uuid;
begin
  perform app.assert_referrals_enabled();
  select referral_id into v_referral_id from public.referral_shared_item where id = p_shared_item_id;
  if v_referral_id is null then
    raise exception 'item não encontrado' using errcode = 'P0002';
  end if;
  perform app.assert_referral_draft_writable(v_referral_id);

  perform set_config('app.in_referral_rpc', 'on', true);
  delete from public.referral_shared_item where id = p_shared_item_id;
  perform set_config('app.in_referral_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."remove_referral_shared_item"("p_shared_item_id" "uuid") OWNER TO "postgres";

-- set_referral_patient: upsert the ISOLATED PHI (same 9-arg shape as
-- set_event_patient). Entitled = can_read_referral_phi AND the referral is not yet
-- concluded/withdrawn/declined (HC078). DEFINER (runs as postgres) — the only
-- write door. Maintains has_patient. The audit trigger logs WITHOUT identifiers.
CREATE OR REPLACE FUNCTION "public"."set_referral_patient"("p_referral_id" "uuid", "p_name" "text" DEFAULT NULL::"text", "p_mrn" "text" DEFAULT NULL::"text", "p_date_of_birth" "date" DEFAULT NULL::"date", "p_age_years" integer DEFAULT NULL::integer, "p_sex" "text" DEFAULT 'unknown'::"text", "p_encounter_ref" "text" DEFAULT NULL::"text", "p_unit" "text" DEFAULT NULL::"text", "p_attending" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
begin
  perform app.assert_referrals_enabled();

  select status into v_status from public.case_referral where id = p_referral_id;
  if v_status is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'P0002';
  end if;
  if not app.can_read_referral_phi(p_referral_id, auth.uid()) then
    raise exception 'você não pode registrar dados do paciente neste encaminhamento'
      using errcode = 'HC078';
  end if;
  if v_status in ('concluida', 'recusada', 'retirada') then
    raise exception 'encaminhamento concluído; os dados do paciente não podem mais ser alterados'
      using errcode = 'HC078';
  end if;
  if p_sex is not null and p_sex not in ('female', 'male', 'other', 'unknown') then
    raise exception 'sexo inválido' using errcode = 'check_violation';
  end if;

  insert into public.referral_patient (
    referral_id, name, mrn, date_of_birth, age_years, sex, encounter_ref, unit, attending
  ) values (
    p_referral_id, p_name, p_mrn, p_date_of_birth, p_age_years, coalesce(p_sex, 'unknown'),
    p_encounter_ref, p_unit, p_attending
  )
  on conflict (referral_id) do update
  set name = excluded.name, mrn = excluded.mrn, date_of_birth = excluded.date_of_birth,
      age_years = excluded.age_years, sex = excluded.sex,
      encounter_ref = excluded.encounter_ref, unit = excluded.unit,
      attending = excluded.attending, updated_at = now();

  update public.case_referral set has_patient = true, updated_at = now() where id = p_referral_id;
end;
$$;

ALTER FUNCTION "public"."set_referral_patient"("p_referral_id" "uuid", "p_name" "text", "p_mrn" "text", "p_date_of_birth" "date", "p_age_years" integer, "p_sex" "text", "p_encounter_ref" "text", "p_unit" "text", "p_attending" "text") OWNER TO "postgres";

-- list_referral_target_commissions: the commissions a source coordinator may refer
-- TO (every hospital commission EXCEPT the source). id + name only, PHI-free. Backs
-- the wizard target picker. SECURITY DEFINER so a source staff_admin who is NOT a
-- global admin can list other commissions' names WITHOUT widening the base
-- commissions RLS. Gated on is_staff_admin_of(source) OR is_admin().
CREATE OR REPLACE FUNCTION "public"."list_referral_target_commissions"("p_source_commission_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.assert_referrals_enabled();
  if not (app.is_staff_admin_of(p_source_commission_id) or app.is_admin()) then
    raise exception 'apenas a coordenação da comissão de origem pode listar destinos'
      using errcode = 'HC071';
  end if;
  return query
    select c.id, c.name
    from public.commissions c
    where c.id <> p_source_commission_id
    order by c.name asc;
end;
$$;

ALTER FUNCTION "public"."list_referral_target_commissions"("p_source_commission_id" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- Source transitions
-- ===========================================================================

-- send_referral: rascunho -> enviada. Source coordinator only (HC071). Freezes the
-- snapshot (the snapshot-lock guard bites after this). Requires >= 1 shared item OR
-- a non-empty description (a referral with nothing to read is rejected).
CREATE OR REPLACE FUNCTION "public"."send_referral"("p_referral_id" "uuid") RETURNS "public"."case_referral"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
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
  if v_referral.status <> 'rascunho' then
    raise exception 'apenas rascunhos podem ser enviados' using errcode = 'HC070';
  end if;

  select count(*) into v_item_count from public.referral_shared_item where referral_id = p_referral_id;
  if v_item_count = 0 and btrim(coalesce(v_referral.description_md, '')) = '' then
    raise exception 'adicione ao menos uma narrativa, documento ou descrição antes de enviar'
      using errcode = 'check_violation';
  end if;

  perform set_config('app.in_referral_rpc', 'on', true);
  update public.case_referral
  set status = 'enviada', sent_at = now(), sent_by = auth.uid(), updated_at = now()
  where id = p_referral_id
  returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);

  return v_row;
end;
$$;

ALTER FUNCTION "public"."send_referral"("p_referral_id" "uuid") OWNER TO "postgres";

-- withdraw_referral: any in-flight status -> retirada. Source coordinator only.
-- Resolves the close_case gate. concluida cannot be withdrawn (already delivered).
CREATE OR REPLACE FUNCTION "public"."withdraw_referral"("p_referral_id" "uuid") RETURNS "public"."case_referral"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
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
  if v_status not in ('rascunho', 'enviada', 'recebida', 'aceita', 'em_analise') then
    raise exception 'este encaminhamento não pode ser retirado neste estado' using errcode = 'HC070';
  end if;

  perform set_config('app.in_referral_rpc', 'on', true);
  update public.case_referral
  set status = 'retirada', withdrawn_at = now(), withdrawn_by = auth.uid(), updated_at = now()
  where id = p_referral_id
  returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);

  return v_row;
end;
$$;

ALTER FUNCTION "public"."withdraw_referral"("p_referral_id" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- Target transitions (target coordinator)
-- ===========================================================================

-- app.assert_referral_target_acts: load + authorize a target-coordinator action,
-- asserting the referral is in one of the expected statuses. HC072 / HC070 / P0002.
CREATE OR REPLACE FUNCTION "app"."assert_referral_target_acts"("p_referral_id" "uuid", "p_expected" "text"[]) RETURNS "public"."case_referral"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_referral public.case_referral;
begin
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'P0002';
  end if;
  if not app.can_manage_referral_target(p_referral_id, auth.uid()) then
    raise exception 'apenas a coordenação da comissão de destino pode realizar esta ação'
      using errcode = 'HC072';
  end if;
  if not (v_referral.status = any (p_expected)) then
    raise exception 'o encaminhamento não está no estado necessário para esta ação'
      using errcode = 'HC070';
  end if;
  return v_referral;
end;
$$;

ALTER FUNCTION "app"."assert_referral_target_acts"("p_referral_id" "uuid", "p_expected" "text"[]) OWNER TO "postgres";

-- receive_referral: enviada -> recebida.
CREATE OR REPLACE FUNCTION "public"."receive_referral"("p_referral_id" "uuid") RETURNS "public"."case_referral"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();
  perform app.assert_referral_target_acts(p_referral_id, array['enviada']);

  perform set_config('app.in_referral_rpc', 'on', true);
  update public.case_referral
  set status = 'recebida', received_at = now(), received_by = auth.uid(), updated_at = now()
  where id = p_referral_id
  returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."receive_referral"("p_referral_id" "uuid") OWNER TO "postgres";

-- accept_referral: recebida -> aceita.
CREATE OR REPLACE FUNCTION "public"."accept_referral"("p_referral_id" "uuid") RETURNS "public"."case_referral"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();
  perform app.assert_referral_target_acts(p_referral_id, array['recebida']);

  perform set_config('app.in_referral_rpc', 'on', true);
  update public.case_referral
  set status = 'aceita', decided_at = now(), decided_by = auth.uid(), updated_at = now()
  where id = p_referral_id
  returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."accept_referral"("p_referral_id" "uuid") OWNER TO "postgres";

-- decline_referral: -> recusada (with an optional note). Resolves the close gate.
CREATE OR REPLACE FUNCTION "public"."decline_referral"("p_referral_id" "uuid", "p_note" "text" DEFAULT NULL::"text") RETURNS "public"."case_referral"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();
  perform app.assert_referral_target_acts(p_referral_id, array['recebida', 'aceita', 'em_analise']);

  perform set_config('app.in_referral_rpc', 'on', true);
  update public.case_referral
  set status = 'recusada', decided_at = now(), decided_by = auth.uid(),
      decline_note = p_note, updated_at = now()
  where id = p_referral_id
  returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."decline_referral"("p_referral_id" "uuid", "p_note" "text") OWNER TO "postgres";

-- start_referral_review: aceita -> em_analise.
CREATE OR REPLACE FUNCTION "public"."start_referral_review"("p_referral_id" "uuid") RETURNS "public"."case_referral"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();
  perform app.assert_referral_target_acts(p_referral_id, array['aceita']);

  perform set_config('app.in_referral_rpc', 'on', true);
  update public.case_referral
  set status = 'em_analise', updated_at = now()
  where id = p_referral_id
  returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."start_referral_review"("p_referral_id" "uuid") OWNER TO "postgres";

-- link_referral_case: attach (or clear) a case B created in ITS commission. The
-- case must belong to the target commission (HC079). This is how B's analyst earns
-- PHI access (referral_target_analyst). Allowed while received/accepted/in-review.
CREATE OR REPLACE FUNCTION "public"."link_referral_case"("p_referral_id" "uuid", "p_target_case_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."case_referral"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_referral public.case_referral;
  v_case_commission uuid;
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();
  v_referral := app.assert_referral_target_acts(p_referral_id, array['recebida', 'aceita', 'em_analise']);

  if p_target_case_id is not null then
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
  return v_row;
end;
$$;

ALTER FUNCTION "public"."link_referral_case"("p_referral_id" "uuid", "p_target_case_id" "uuid") OWNER TO "postgres";

-- add_referral_reply_attachment: record a B-side reply attachment reference (the
-- file is uploaded to a fresh immutable path first — Rule 6). Target coord only.
CREATE OR REPLACE FUNCTION "public"."add_referral_reply_attachment"("p_referral_id" "uuid", "p_title" "text", "p_storage_path" "text", "p_mime_type" "text" DEFAULT NULL::"text", "p_size_bytes" bigint DEFAULT NULL::bigint) RETURNS "public"."referral_reply_attachment"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.referral_reply_attachment;
begin
  perform app.assert_referrals_enabled();
  perform app.assert_referral_target_acts(p_referral_id, array['aceita', 'em_analise']);
  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'informe um título para o anexo' using errcode = 'check_violation';
  end if;
  if btrim(coalesce(p_storage_path, '')) = '' then
    raise exception 'caminho do anexo inválido' using errcode = 'check_violation';
  end if;

  insert into public.referral_reply_attachment (
    referral_id, title, storage_path, mime_type, size_bytes, uploaded_by
  ) values (
    p_referral_id, btrim(p_title), p_storage_path, p_mime_type, p_size_bytes, auth.uid()
  )
  returning * into v_row;
  return v_row;
end;
$$;

ALTER FUNCTION "public"."add_referral_reply_attachment"("p_referral_id" "uuid", "p_title" "text", "p_storage_path" "text", "p_mime_type" "text", "p_size_bytes" bigint) OWNER TO "postgres";

-- conclude_referral: em_analise -> concluida. Writes + freezes referral_reply
-- (delivered to A). When response_expected, result_md + outcome are REQUIRED
-- (HC075); a no-reply-expected referral may conclude acknowledged_only.
CREATE OR REPLACE FUNCTION "public"."conclude_referral"("p_referral_id" "uuid", "p_reply_outcome_id" "uuid" DEFAULT NULL::"uuid", "p_result_md" "text" DEFAULT NULL::"text", "p_acknowledged_only" boolean DEFAULT false) RETURNS "public"."case_referral"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_referral public.case_referral;
  v_outcome public.reply_outcomes;
  v_ack boolean;
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();
  v_referral := app.assert_referral_target_acts(p_referral_id, array['em_analise']);

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

  update public.case_referral
  set status = 'concluida', concluded_at = now(), concluded_by = auth.uid(), updated_at = now()
  where id = p_referral_id
  returning * into v_row;

  perform set_config('app.in_referral_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."conclude_referral"("p_referral_id" "uuid", "p_reply_outcome_id" "uuid", "p_result_md" "text", "p_acknowledged_only" boolean) OWNER TO "postgres";

-- ===========================================================================
-- Audited read doors
-- ===========================================================================

-- get_referral_detail: assemble the full detail (header + frozen snapshot + reply).
-- Re-gates can_read_referral (P0002 out of scope). Emits referral.viewed on a PHI
-- open by a reader who is NOT a source coordinator and NOT QPS (mirrors
-- get_case_detail's case.opened). The snapshot/reply PHI bodies are included for
-- entitled readers; a foreign committee never reaches here.
CREATE OR REPLACE FUNCTION "public"."get_referral_detail"("p_referral_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_referral public.case_referral;
  v_is_source_coord boolean;
  v_result jsonb;
begin
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;
  if not app.can_read_referral(p_referral_id, auth.uid()) then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  v_is_source_coord :=
    app.is_staff_admin_of(v_referral.source_commission_id) or app.is_admin();

  -- AUDIT (Rule 11/12): a PHI-bearing detail open by a reader who is neither the
  -- source coordinator (the originator, who already holds the content) nor QPS.
  -- Attributed to the source (provenance) commission; no body/PHI in metadata.
  if not (v_is_source_coord or app.is_pqs_member(auth.uid())) then
    perform public.log_audit_access(
      'referral.viewed', 'referral', p_referral_id, v_referral.source_commission_id,
      'Detalhe do encaminhamento ' || coalesce(v_referral.code, '') || ' visualizado', '{}'::jsonb);
  end if;

  select jsonb_build_object(
    'id', v_referral.id,
    'code', v_referral.code,
    'status', v_referral.status,
    'subject', v_referral.subject,
    'description_md', v_referral.description_md,
    'referral_type_id', v_referral.referral_type_id,
    'type_label', v_referral.type_label,
    'response_expected', v_referral.response_expected,
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
    'decline_note', v_referral.decline_note,
    'shared_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'referral_id', s.referral_id,
        'kind', s.kind,
        'source_narrative_id', s.source_narrative_id,
        'source_document_id', s.source_document_id,
        'frozen_title', s.frozen_title,
        'frozen_body_md', s.frozen_body_md,
        'frozen_storage_path', s.frozen_storage_path,
        'frozen_mime_type', s.frozen_mime_type,
        'frozen_size_bytes', s.frozen_size_bytes,
        'position', s.position
      ) order by s.position)
      from public.referral_shared_item s where s.referral_id = p_referral_id
    ), '[]'::jsonb),
    'reply', (
      select case when r.referral_id is null then null else jsonb_build_object(
        'referral_id', r.referral_id,
        'reply_outcome_id', r.reply_outcome_id,
        'outcome_label', r.outcome_label,
        'result_md', r.result_md,
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

ALTER FUNCTION "public"."get_referral_detail"("p_referral_id" "uuid") OWNER TO "postgres";

-- get_referral_patient: the SINGLE audited door to the isolated PHI identifiers
-- (mirror get_event_patient). Direct SELECT on referral_patient is revoked, so this
-- DEFINER RPC is the only read path. Re-gates with the TIGHT can_read_referral_phi
-- predicate; out of scope -> NULL (no audit row). Emits referral_patient.read on a
-- real, entitled read of an existing row. search_path public (NOT app), matching
-- get_event_patient.
CREATE OR REPLACE FUNCTION "public"."get_referral_patient"("p_referral_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_referral public.case_referral;
  v_patient public.referral_patient;
begin
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    return null;
  end if;
  if not app.can_read_referral_phi(p_referral_id, auth.uid()) then
    return null;  -- out of scope -> NULL, no audit row
  end if;

  select * into v_patient from public.referral_patient where referral_id = p_referral_id;
  if v_patient.referral_id is null then
    return null;  -- entitled, but no PHI on file: nothing read, no audit row
  end if;

  perform public.log_audit_access(
    'referral_patient.read', 'referral_patient', p_referral_id,
    v_referral.source_commission_id,
    'Leitura dos identificadores do paciente do encaminhamento ' || v_referral.code,
    '{}'::jsonb
  );

  return to_jsonb(v_patient);
end;
$$;

ALTER FUNCTION "public"."get_referral_patient"("p_referral_id" "uuid") OWNER TO "postgres";

-- get_referral_snapshot_document_path: DEFINER authorizer for a frozen snapshot
-- DOCUMENT download. Re-gates can_read_referral_phi and returns the authorized
-- case-documents path (which the Node layer signs with the NORMAL cookie client —
-- the case_documents storage policy's snapshot OR-term grants the read). Returns
-- NULL out of scope. Audited as referral.viewed (the doc body is PHI-bearing).
CREATE OR REPLACE FUNCTION "public"."get_referral_snapshot_document_path"("p_shared_item_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_item public.referral_shared_item;
  v_referral public.case_referral;
begin
  select * into v_item from public.referral_shared_item where id = p_shared_item_id;
  if v_item.id is null or v_item.kind <> 'document' then
    return null;
  end if;
  select * into v_referral from public.case_referral where id = v_item.referral_id;
  if v_referral.id is null then
    return null;
  end if;
  if not app.can_read_referral_phi(v_item.referral_id, auth.uid()) then
    return null;
  end if;

  perform public.log_audit_access(
    'referral.viewed', 'referral', v_item.referral_id, v_referral.source_commission_id,
    'Documento do encaminhamento ' || coalesce(v_referral.code, '') || ' acessado', '{}'::jsonb);

  return v_item.frozen_storage_path;
end;
$$;

ALTER FUNCTION "public"."get_referral_snapshot_document_path"("p_shared_item_id" "uuid") OWNER TO "postgres";

-- get_referral_attachment_path: DEFINER authorizer for a B-side reply-attachment
-- download. Re-gates can_read_referral_phi; returns the referral-attachments path
-- (Node signs it; the bucket's own SELECT policy also keys on can_read_referral_phi).
-- NULL out of scope. Audited as referral.viewed.
CREATE OR REPLACE FUNCTION "public"."get_referral_attachment_path"("p_attachment_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_att public.referral_reply_attachment;
  v_referral public.case_referral;
begin
  select * into v_att from public.referral_reply_attachment where id = p_attachment_id;
  if v_att.id is null then
    return null;
  end if;
  select * into v_referral from public.case_referral where id = v_att.referral_id;
  if v_referral.id is null then
    return null;
  end if;
  if not app.can_read_referral_phi(v_att.referral_id, auth.uid()) then
    return null;
  end if;

  perform public.log_audit_access(
    'referral.viewed', 'referral', v_att.referral_id, v_referral.source_commission_id,
    'Anexo da resposta do encaminhamento ' || coalesce(v_referral.code, '') || ' acessado', '{}'::jsonb);

  return v_att.storage_path;
end;
$$;

ALTER FUNCTION "public"."get_referral_attachment_path"("p_attachment_id" "uuid") OWNER TO "postgres";

-- is_pqs_member_self: a PHI-free boolean probe for the QPS dashboard data layer.
-- The /admin/nsp/encaminhamentos queries gate on THIS (duty separation, ADR
-- 0030/0031): a non-PQS admin must get NOTHING from the cross-commission referral
-- aggregate, even though the URL is is_admin-gated. SECURITY DEFINER so the
-- pqs_members lookup bypasses RLS.
CREATE OR REPLACE FUNCTION "public"."is_pqs_member_self"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.is_pqs_member(auth.uid());
$$;

ALTER FUNCTION "public"."is_pqs_member_self"() OWNER TO "postgres";

-- ===========================================================================
-- Grants — EXECUTE on every RPC to authenticated/service_role; REVOKE FROM PUBLIC.
-- ===========================================================================
DO $$
DECLARE
  fn text;
  fns text[] := array[
    'app.assert_referral_draft_writable(uuid)',
    'app.assert_referral_target_acts(uuid, text[])',
    'public.create_referral_draft(uuid, uuid, uuid, text, boolean)',
    'public.update_referral_draft(uuid, uuid, text, text, boolean)',
    'public.add_referral_shared_item(uuid, text, uuid, uuid)',
    'public.remove_referral_shared_item(uuid)',
    'public.set_referral_patient(uuid, text, text, date, integer, text, text, text, text)',
    'public.list_referral_target_commissions(uuid)',
    'public.send_referral(uuid)',
    'public.withdraw_referral(uuid)',
    'public.receive_referral(uuid)',
    'public.accept_referral(uuid)',
    'public.decline_referral(uuid, text)',
    'public.start_referral_review(uuid)',
    'public.link_referral_case(uuid, uuid)',
    'public.add_referral_reply_attachment(uuid, text, text, text, bigint)',
    'public.conclude_referral(uuid, uuid, text, boolean)',
    'public.get_referral_detail(uuid)',
    'public.get_referral_patient(uuid)',
    'public.get_referral_snapshot_document_path(uuid)',
    'public.get_referral_attachment_path(uuid)',
    'public.is_pqs_member_self()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;
