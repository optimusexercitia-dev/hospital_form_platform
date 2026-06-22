-- ----------------------------------------------------------------------------
-- case_patient — Capture patient identifiers at Case creation (THIRD PHI module)
-- ----------------------------------------------------------------------------
-- When a Case is created (and afterwards), a coordinator may record an OPTIONAL
-- minimum-necessary set of patient identifiers so whoever assumes the case knows
-- WHICH patient records to look up. This makes the Cases module the THIRD place
-- PHI lives, modeled EXACTLY on the two existing identifier modules
-- (public.event_patient in NSP, public.referral_patient in referrals): an
-- isolated 0..1 satellite, all direct DML REVOKED from authenticated, written via
-- a DEFINER setter, read only via the AUDITED single-door RPC (emits
-- case_patient.read), never copying any identifier into the audit log (Rule 11/12).
--
-- DELIBERATE asymmetry (ADR 0038): the READ predicate is the BROAD app.can_read_case
-- (coordinator OR phase/narrative attribution OR explicit grant OR QPS), looser
-- than can_read_event_patient / can_read_referral_phi (staff_admin + PQS only),
-- because case ASSIGNEES need the MRN to do the work. WRITES stay coordinators-only
-- (staff_admin-of-commission OR admin). Every read is still funneled through the
-- one audited door.
--
-- House style mirrors 20260620013000_referrals.sql / 20260620009000_patient_safety.sql:
-- public.* objects OWNER postgres, RLS enabled, COMMENT ON for PHI tables/columns.
-- This file carries its OWN grants + revokes (the 012000 baseline + the referral
-- files are closed) and ships the `case_patient` flag OFF (the E2E suite flips it
-- ON, like audit_trail / case_access / case_referrals). Forward-only / additive:
-- the cross-cutting log_audit_access / create_case_from_template / get_case_detail
-- are applied here by CREATE OR REPLACE, NOT by editing the already-applied files.

SET check_function_bodies = false;
SET client_min_messages = warning;

-- ===========================================================================
-- Flag assert (mirror app.assert_referrals_enabled) — every writer's 1st line.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."assert_case_patient_enabled"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not app.feature_enabled('case_patient') then
    raise exception 'o registro de identificação do paciente do caso não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;

ALTER FUNCTION "app"."assert_case_patient_enabled"() OWNER TO "postgres";

-- Convenience boolean probe used by the query layer (casePatientEnabled()).
CREATE OR REPLACE FUNCTION "public"."case_patient_enabled"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.feature_enabled('case_patient');
$$;

ALTER FUNCTION "public"."case_patient_enabled"() OWNER TO "postgres";

-- ===========================================================================
-- cases columns (additive) — the denormalized PHI flag + per-case config
-- snapshot + the disposal stamps (mirror patient_safety_event). NOTE: cases has
-- NO updated_at column — writers must never set one.
-- ===========================================================================
ALTER TABLE "public"."cases"
  ADD COLUMN IF NOT EXISTS "has_patient" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "patient_enabled" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "phi_disposed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "phi_disposed_by" "uuid",
  ADD COLUMN IF NOT EXISTS "phi_disposed_reason" "text";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cases_phi_disposed_reason_check'
  ) THEN
    ALTER TABLE "public"."cases"
      ADD CONSTRAINT "cases_phi_disposed_reason_check"
      CHECK (("phi_disposed_reason" IS NULL OR "phi_disposed_reason" = ANY (ARRAY['retention_expired'::"text", 'subject_request'::"text", 'entered_in_error'::"text", 'duplicate'::"text", 'other'::"text"])));
  END IF;
END $$;

COMMENT ON COLUMN "public"."cases"."has_patient" IS 'Denormalized "an isolated case_patient (PHI) row exists" flag. Set true by set_case_patient, false by PHI disposal (dispose_case_phi). Lets governance/list reads derive hasPatient WITHOUT embedding case_patient (which is not directly SELECT-able). A boolean is not PHI.';
COMMENT ON COLUMN "public"."cases"."patient_enabled" IS 'Snapshotted at case creation from process_templates.collects_patient (immutable per case). When true (AND the case_patient flag is on) the create dialog + detail panel offer the optional PHI block. Existing/other templates stay PHI-free.';
COMMENT ON COLUMN "public"."cases"."phi_disposed_at" IS 'When the case PHI was disposed (NULL until disposal). PHI-safe accountability stamp set by dispose_case_phi; one-shot.';
COMMENT ON COLUMN "public"."cases"."phi_disposed_by" IS 'Who disposed the case PHI (NULL until disposal). PHI-safe accountability stamp set by dispose_case_phi.';
COMMENT ON COLUMN "public"."cases"."phi_disposed_reason" IS 'WHY the PHI was disposed — a CONSTRAINED CATEGORY (retention_expired/subject_request/entered_in_error/duplicate/other), NEVER free text (Rule 11 + LGPD Art. 18). NULL until disposal.';

-- ===========================================================================
-- process_templates config — the draft-only on/off toggle (default OFF).
-- ===========================================================================
ALTER TABLE "public"."process_templates"
  ADD COLUMN IF NOT EXISTS "collects_patient" boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN "public"."process_templates"."collects_patient" IS 'Draft-only config (ADR 0038, Decision 5): when true, cases created from this template offer the optional patient-identifier block (snapshotted into cases.patient_enabled at creation). Default OFF; set via set_template_collects_patient while status=draft.';

-- ===========================================================================
-- Read predicate — a thin DEFINER wrapper over the LIVE app.can_read_case (the
-- QPS-term version replaced in 20260620014000_referrals_rpcs.sql). DELIBERATELY
-- looser than can_read_event_patient / can_read_referral_phi (staff_admin + PQS
-- only): case assignees (phase/narrative attribution) AND case_access grantees
-- need the MRN to do the work, so the identifiers follow the SAME read scope as
-- the case itself. Still fully audited via the single get_case_patient door.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."can_read_case_patient"("p_case_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.can_read_case(p_case_id, p_uid);
$$;

ALTER FUNCTION "app"."can_read_case_patient"("p_case_id" "uuid", "p_uid" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- case_patient table — ISOLATED PHI (copy event_patient / referral_patient
-- field-for-field). PK = case_id; FK -> cases ON DELETE CASCADE.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS "public"."case_patient" (
    "case_id" "uuid" NOT NULL,
    "name" "text",
    "mrn" "text",
    "date_of_birth" "date",
    "age_years" integer,
    "sex" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "encounter_ref" "text",
    "unit" "text",
    "attending" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "case_patient_age_nonneg" CHECK ((("age_years" IS NULL) OR ("age_years" >= 0))),
    CONSTRAINT "case_patient_sex_check" CHECK (("sex" = ANY (ARRAY['female'::"text", 'male'::"text", 'other'::"text", 'unknown'::"text"])))
);

ALTER TABLE "public"."case_patient" OWNER TO "postgres";

ALTER TABLE ONLY "public"."case_patient"
    ADD CONSTRAINT "case_patient_pkey" PRIMARY KEY ("case_id");
ALTER TABLE ONLY "public"."case_patient"
    ADD CONSTRAINT "case_patient_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;

COMMENT ON TABLE "public"."case_patient" IS 'ISOLATED PHI (Rule 12; ADR 0038) — the ONLY place case patient identifiers live. 0..1 per case (PK = case_id). Read via the dedicated AUDITED door only (get_case_patient -> case_patient.read); direct SELECT is REVOKED from authenticated. NEVER selected on list/board/dashboard paths (minimum-necessary). Modeled exactly on public.event_patient / public.referral_patient. The READ scope is the BROAD app.can_read_case (assignees need the MRN), unlike the staff_admin+PQS predicates of the other two modules — see ADR 0038.';

ALTER TABLE "public"."case_patient" ENABLE ROW LEVEL SECURITY;

-- SELECT policy on the BROAD predicate (the door re-gates the same way). Direct
-- DML is REVOKED below; the DEFINER set/get/dispose RPCs are the only door. RLS
-- enabled with only a SELECT policy => deny-all writes for authenticated, which
-- is the intent (DEFINER RPCs run as postgres and bypass it).
CREATE POLICY "case_patient_select" ON "public"."case_patient"
  FOR SELECT TO "authenticated"
  USING ("app"."can_read_case_patient"("case_id", "auth"."uid"()));

-- ===========================================================================
-- Audit trigger — writes case_patient.updated with EMPTY metadata (NO
-- identifiers; mirror trg_audit_event_patient / trg_audit_referral_patient).
-- Attributed to the case's commission. Dark until audit_trail is ON
-- (app.audit_write no-ops while the flag is off).
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."trg_audit_case_patient"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_comm uuid;
begin
  v_comm := app.commission_of_case(new.case_id);
  perform app.audit_write('case_patient.updated', 'case_patient', new.case_id, v_comm,
    'Dados do paciente do caso atualizados', '{}'::jsonb);
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_case_patient"() OWNER TO "postgres";

CREATE TRIGGER "trg_audit_case_patient_aiu" AFTER INSERT OR UPDATE ON "public"."case_patient"
    FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_case_patient"();

-- ===========================================================================
-- log_audit_access replace — carry the FULL current allow-list forward (the base
-- list in 20260620008000_audit.sql UNION the referral verbs added in
-- 20260620014000_referrals_rpcs.sql) and APPEND 'case_patient.read'. The positive
-- allow-list still rejects any forged mutation verb (mutations go through
-- audit_write, which has no allow-list). Dropping any existing verb silently
-- breaks that module's read-audit — do NOT.
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
    -- detail open (snapshot/reply bodies).
    'referral_patient.read', 'referral.viewed',
    -- case_patient (ADR 0038): the audited case-identifier read door.
    'case_patient.read'
  ) then
    raise exception 'log_audit_access: ação de acesso não permitida (%)', p_action
      using errcode = 'check_violation';
  end if;
  perform app.audit_write(p_action, p_entity_type, p_entity_id, p_commission, p_summary, p_metadata);
end;
$$;

ALTER FUNCTION "public"."log_audit_access"("p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_commission" "uuid", "p_summary" "text", "p_metadata" "jsonb") OWNER TO "postgres";

-- ===========================================================================
-- set_case_patient — upsert the ISOLATED PHI (same 9-arg shape as
-- set_referral_patient / set_event_patient). DEFINER (runs as postgres) = the only
-- write door. Gate COORDINATORS ONLY: staff_admin of the case's commission OR
-- platform admin (NOT assignees, NOT case-write grantees). Editable (upsert), NOT
-- frozen. Asserts the per-case patient_enabled snapshot. The name-or-MRN floor
-- lives in the action layer (matching the existing pattern). Maintains has_patient;
-- the audit trigger logs WITHOUT identifiers.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."set_case_patient"("p_case_id" "uuid", "p_name" "text" DEFAULT NULL::"text", "p_mrn" "text" DEFAULT NULL::"text", "p_date_of_birth" "date" DEFAULT NULL::"date", "p_age_years" integer DEFAULT NULL::integer, "p_sex" "text" DEFAULT 'unknown'::"text", "p_encounter_ref" "text" DEFAULT NULL::"text", "p_unit" "text" DEFAULT NULL::"text", "p_attending" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_case public.cases;
begin
  perform app.assert_case_patient_enabled();

  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;
  -- COORDINATOR-ONLY write gate (not can_read_case — that is the broad READ scope).
  if not (app.is_staff_admin_of(v_case.commission_id) or app.is_admin()) then
    raise exception 'apenas a coordenação da comissão pode registrar dados do paciente'
      using errcode = '42501';
  end if;
  if not v_case.patient_enabled then
    raise exception 'este caso não coleta identificação do paciente'
      using errcode = 'check_violation';
  end if;
  if v_case.phi_disposed_at is not null then
    raise exception 'os dados do paciente deste caso foram descartados e não podem mais ser alterados'
      using errcode = 'check_violation';
  end if;
  if p_sex is not null and p_sex not in ('female', 'male', 'other', 'unknown') then
    raise exception 'sexo inválido' using errcode = 'check_violation';
  end if;

  insert into public.case_patient (
    case_id, name, mrn, date_of_birth, age_years, sex, encounter_ref, unit, attending
  ) values (
    p_case_id, p_name, p_mrn, p_date_of_birth, p_age_years, coalesce(p_sex, 'unknown'),
    p_encounter_ref, p_unit, p_attending
  )
  on conflict (case_id) do update
  set name = excluded.name, mrn = excluded.mrn, date_of_birth = excluded.date_of_birth,
      age_years = excluded.age_years, sex = excluded.sex,
      encounter_ref = excluded.encounter_ref, unit = excluded.unit,
      attending = excluded.attending, updated_at = now();

  -- Maintain the denormalized has_patient flag. Runs under the case-RPC guard
  -- bypass so it works even on a terminal case (cases has no updated_at).
  if not v_case.has_patient then
    perform set_config('app.in_case_rpc', 'on', true);
    update public.cases set has_patient = true where id = p_case_id;
    perform set_config('app.in_case_rpc', 'off', true);
  end if;
end;
$$;

ALTER FUNCTION "public"."set_case_patient"("p_case_id" "uuid", "p_name" "text", "p_mrn" "text", "p_date_of_birth" "date", "p_age_years" integer, "p_sex" "text", "p_encounter_ref" "text", "p_unit" "text", "p_attending" "text") OWNER TO "postgres";

-- ===========================================================================
-- get_case_patient — the SINGLE audited door to the isolated PHI identifiers
-- (mirror get_referral_patient / get_event_patient). Direct SELECT on case_patient
-- is revoked, so this DEFINER RPC is the only read path. Re-gates with the BROAD
-- can_read_case_patient predicate; out of scope/absent -> NULL (no audit row). On
-- a real, entitled read of an existing row, emit case_patient.read then return the
-- row. search_path public (NOT app), matching the other two doors.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."get_case_patient"("p_case_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_case public.cases;
  v_patient public.case_patient;
begin
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    return null;
  end if;
  if not app.can_read_case_patient(p_case_id, auth.uid()) then
    return null;  -- out of scope -> NULL, no audit row
  end if;

  select * into v_patient from public.case_patient where case_id = p_case_id;
  if v_patient.case_id is null then
    return null;  -- entitled, but no PHI on file: nothing read, no audit row
  end if;

  perform public.log_audit_access(
    'case_patient.read', 'case_patient', p_case_id, v_case.commission_id,
    'Leitura dos identificadores do paciente do caso ' || v_case.case_number,
    '{}'::jsonb
  );

  return to_jsonb(v_patient);
end;
$$;

ALTER FUNCTION "public"."get_case_patient"("p_case_id" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- dispose_case_phi — LGPD Art. 18 erasure (copy dispose_event_phi). Deletes the
-- isolated case_patient row + redacts the case PHI free text
-- (case_narratives.body_md -> NULL since nullable; case_events.body -> sentinel
-- since NOT NULL), PRESERVES the governance skeleton (case_number, status,
-- phases, outcome, audit chain). One-shot (HC056); 5-value reason CHECK; stamps
-- phi_disposed_*/has_patient=false; emits case_patient.disposed (reason-only
-- metadata). Gate = staff_admin-of-commission OR admin. Bypasses the case-status
-- AND narrative-freeze guards (both fire on a terminal case) via their guard flags.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."dispose_case_phi"("p_case_id" "uuid", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_case public.cases;
  v_redacted constant text := '[PHI removido]';
begin
  perform app.assert_case_patient_enabled();

  -- Gate: staff_admin of the case's commission OR admin. Disposal is a
  -- compliance/erasure action — it does NOT read PHI, so it does not require
  -- can_read_case_patient. DEFINER bypasses RLS -> re-check.
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;
  if not (app.is_staff_admin_of(v_case.commission_id) or app.is_admin()) then
    raise exception 'apenas a coordenação da comissão ou um administrador pode descartar dados do paciente'
      using errcode = '42501';
  end if;

  -- Constrained reason category (PHI-safe, LGPD Art. 18 accountability) — never free text.
  if p_reason is null or p_reason not in
       ('retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other') then
    raise exception 'motivo de descarte inválido' using errcode = 'check_violation';
  end if;

  -- One-shot (HC056): disposal cannot run twice on the same case.
  if v_case.phi_disposed_at is not null then
    raise exception 'os dados do paciente deste caso já foram descartados'
      using errcode = 'HC056';
  end if;

  -- Bypass the case-status guard (non-status update on a terminal case) AND the
  -- narrative-freeze guard (body edit on a terminal case). Txn-local.
  perform set_config('app.in_case_rpc', 'on', true);
  perform set_config('app.in_narrative_rpc', 'on', true);

  -- (1) The isolated identifiers go entirely.
  delete from public.case_patient where case_id = p_case_id;

  -- (2) Case narrative free text (nullable -> NULL).
  update public.case_narratives
     set body_md = null
   where case_id = p_case_id;

  -- (3) Case-event free text (NOT NULL -> REDACT to a sentinel; the not-blank
  --     CHECK forbids ''). case_events has no UPDATE guard, but DEFINER runs as
  --     owner so RLS is bypassed regardless.
  update public.case_events
     set body = v_redacted
   where case_id = p_case_id;

  -- (4) Stamp the case: who/when/why + flip has_patient false (so hasPatient reads
  --     false and the panel affordance disappears). PRESERVES the governance
  --     skeleton (case_number, status, phases, outcome, audit chain).
  update public.cases
     set has_patient = false,
         phi_disposed_at = now(),
         phi_disposed_by = auth.uid(),
         phi_disposed_reason = p_reason
   where id = p_case_id;

  -- (5) Audit MUTATION row with the enum reason ONLY (PHI-safe metadata; no free text).
  perform app.audit_write(
    'case_patient.disposed', 'case_patient', p_case_id, v_case.commission_id,
    'Dados do paciente do caso ' || v_case.case_number || ' descartados',
    jsonb_build_object('reason', p_reason)
  );

  perform set_config('app.in_narrative_rpc', 'off', true);
  perform set_config('app.in_case_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."dispose_case_phi"("p_case_id" "uuid", "p_reason" "text") OWNER TO "postgres";

-- ===========================================================================
-- create_case_from_template REPLACE — only change vs 20260620005000_cases.sql:
-- read collects_patient alongside commission_id/status and snapshot it into the
-- INSERT as patient_enabled = coalesce(v_collects, false). has_patient stays false
-- at creation. Everything else is verbatim (forward-only; do not edit 005000).
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."create_case_from_template"("p_template_id" "uuid", "p_label" "text" DEFAULT NULL::"text") RETURNS "public"."cases"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_status text;
  v_collects boolean;
  v_case public.cases;
  r_slot record;
  v_version uuid;
  v_from_phase integer;
  v_source_version uuid;
  v_qkey text;
  v_attempt integer := 0;
  v_narratives_on boolean := app.feature_enabled('case_narratives');
begin
  perform app.assert_cases_enabled();

  select commission_id, status, collects_patient
    into v_commission_id, v_status, v_collects
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

  perform set_config('app.in_case_rpc', 'on', true);

  -- Insert the case; the minting trigger sets case_number. status defaults to
  -- 'nao_iniciado' (no explicit status -> the column default applies). Bounded
  -- unique_violation retry for the per-commission number race. patient_enabled is
  -- SNAPSHOTTED from the template's collects_patient (immutable per case, ADR 0038).
  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.cases (commission_id, template_id, label, created_by, patient_enabled)
      values (v_commission_id, p_template_id, nullif(btrim(p_label), ''), auth.uid(), coalesce(v_collects, false))
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

  -- Materialize the template slots into case_phases, pinning published versions
  -- and snapshotting recommend_when, default_due_days, blocks AND display_position
  -- verbatim.
  for r_slot in
    select position, form_id, title, recommend_when, default_due_days, blocks,
           display_position
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

    -- Re-validate recommend_when against the PINNED source version.
    if r_slot.recommend_when is not null then
      v_from_phase := (r_slot.recommend_when ->> 'from_phase')::integer;
      v_qkey := r_slot.recommend_when ->> 'question_key';

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

    -- Snapshot the slot (ADR 0017 + blocks + ADR 0032 display_position). due_date
    -- null. The blocks shape trigger re-asserts earlier-only on this insert.
    insert into public.case_phases
      (case_id, position, form_id, form_version_id, title, recommend_when,
       is_ad_hoc, default_due_days, blocks, display_position)
    values
      (v_case.id, r_slot.position, r_slot.form_id, v_version, r_slot.title,
       r_slot.recommend_when, false, r_slot.default_due_days, r_slot.blocks,
       coalesce(r_slot.display_position, r_slot.position));
  end loop;

  -- Freeze the OFFERED outcome set for this case (D15) from the template's live
  -- offering. The conclude gate + selector read THIS, not process_template_outcomes.
  insert into public.case_offered_outcomes (case_id, outcome_id)
  select v_case.id, pto.outcome_id
  from public.process_template_outcomes pto
  where pto.template_id = p_template_id;

  -- Snapshot the NARRATIVE slots (ADR 0032) — only when the feature is on. The
  -- EFFECTIVE label (coalesce(slot.title, type.label)) is frozen into type_label.
  -- Runs while the case is 'aberto', so guard_case_narrative_frozen passes.
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

  -- Initial recommendation pass (no submitted phases yet; uniform path).
  perform public.recompute_recommendations(v_case.id);

  return v_case;
end;
$$;

ALTER FUNCTION "public"."create_case_from_template"("p_template_id" "uuid", "p_label" "text") OWNER TO "postgres";

-- ===========================================================================
-- get_case_detail REPLACE — only change vs 20260620005000_cases.sql: echo
-- has_patient / patient_enabled in the case-header jsonb_build_object so the
-- detail page can render the panel affordance. Everything else verbatim.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."get_case_detail"("p_case_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_case public.cases;
  v_outcome jsonb;
  v_is_coordinator boolean;
  v_result jsonb;
begin
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if app.feature_enabled('case_access') then
    if not app.can_read_case(p_case_id, auth.uid()) then
      raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
    end if;
  else
    if not app.is_staff_admin_of(v_case.commission_id) then
      raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
    end if;
  end if;

  v_is_coordinator :=
    app.is_staff_admin_of(v_case.commission_id) or app.is_admin();

  if app.feature_enabled('case_access') and not v_is_coordinator then
    perform public.log_audit_access(
      'case.opened', 'case', p_case_id, v_case.commission_id,
      'Caso aberto por participante/concedido', '{}'::jsonb);
  end if;

  select case when o.id is null then null else jsonb_build_object(
           'id', o.id,
           'label', o.label,
           'color_token', o.color_token,
           'requires_action_plan', o.requires_action_plan,
           'is_adverse', o.is_adverse
         ) end
    into v_outcome
  from (select v_case.outcome_id as oid) s
  left join public.case_outcomes o on o.id = s.oid;

  select jsonb_build_object(
    'id', v_case.id,
    'commission_id', v_case.commission_id,
    'template_id', v_case.template_id,
    'case_number', v_case.case_number,
    'label', v_case.label,
    'status', v_case.status,
    'outcome_id', v_case.outcome_id,
    'outcome', v_outcome,
    -- case_patient (ADR 0038): the panel renders only when patient_enabled, and the
    -- body gates on has_patient. Booleans are PHI-free; identifiers stay on the door.
    'has_patient', v_case.has_patient,
    'patient_enabled', v_case.patient_enabled,
    -- The viewer's capability descriptor (ADR 0033 D7), for auth.uid().
    'viewer_capabilities', jsonb_build_object(
      'can_read', true,  -- we only reach here if the caller may read
      'can_write_content', app.can_write_case_content(p_case_id, auth.uid()),
      'can_manage_lifecycle', v_is_coordinator
    ),
    'offered_outcomes', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', o.id,
          'label', o.label,
          'color_token', o.color_token,
          'requires_action_plan', o.requires_action_plan,
          'is_adverse', o.is_adverse
        ) order by o.position)
       from public.case_offered_outcomes coo
       join public.case_outcomes o on o.id = coo.outcome_id
       where coo.case_id = p_case_id),
      '[]'::jsonb),
    'created_at', v_case.created_at,
    'closed_at', v_case.closed_at,
    'phases', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', cp.id,
          'position', cp.position,
          'form_id', cp.form_id,
          'form_version_id', cp.form_version_id,
          'form_title', f.title,
          'title', cp.title,
          'status', cp.status,
          'recommended', cp.recommended,
          'assigned_to', cp.assigned_to,
          'assignee_name', pr.full_name,
          'is_ad_hoc', cp.is_ad_hoc,
          'blocks', cp.blocks,
          'recommend_when', cp.recommend_when,
          'due_date', cp.due_date,
          'default_due_days', cp.default_due_days,
          'display_position', coalesce(cp.display_position, cp.position),
          'response_id', sub.response_id,
          'submitted_at', sub.submitted_at
        ) order by cp.position)
       from public.case_phases cp
       join public.forms f on f.id = cp.form_id
       left join public.profiles pr on pr.id = cp.assigned_to
       left join lateral (
         select r.id as response_id, r.submitted_at
         from public.responses r
         where r.case_phase_id = cp.id
           and r.status = 'submitted'
           and cp.status = 'concluida'
         limit 1
       ) sub on true
       where cp.case_id = p_case_id),
      '[]'::jsonb),
    'narratives', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', cn.id,
          'narrative_type_id', cn.narrative_type_id,
          'type_label', cn.type_label,
          'display_position', cn.display_position,
          'title', cn.title,
          'instructions', cn.instructions,
          'is_expected', cn.is_expected,
          'body_md', cn.body_md,
          'assigned_to', cn.assigned_to,
          'assignee_name', npr.full_name,
          'status', cn.status,
          'concluded_at', cn.concluded_at,
          'concluded_by', cn.concluded_by,
          'updated_at', cn.updated_at
        ) order by cn.display_position)
       from public.case_narratives cn
       left join public.profiles npr on npr.id = cn.assigned_to
       where cn.case_id = p_case_id),
      '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."get_case_detail"("p_case_id" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- set_template_collects_patient — tiny draft-only setter (mirror
-- set_process_outcomes). staff_admin-or-admin + status='draft' guard; sets the
-- column and process_templates.updated_at (this table DOES have updated_at).
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."set_template_collects_patient"("p_template_id" "uuid", "p_collects" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_status text;
begin
  perform app.assert_case_patient_enabled();

  select commission_id, status into v_commission_id, v_status
  from public.process_templates where id = p_template_id;
  if v_commission_id is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  update public.process_templates
  set collects_patient = coalesce(p_collects, false), updated_at = now()
  where id = p_template_id;
end;
$$;

ALTER FUNCTION "public"."set_template_collects_patient"("p_template_id" "uuid", "p_collects" boolean) OWNER TO "postgres";

-- ===========================================================================
-- Grants + REVOKE. This file carries its own (the prior baselines are closed).
-- ===========================================================================

-- --- case_patient table: FULLY RPC-ONLY (exact event_patient / referral_patient
-- posture). ZERO direct authenticated DML. Reads go through the audited
-- get_case_patient RPC; writes through set_case_patient / dispose_case_phi DEFINER
-- (run as owner postgres). service_role is left intact. RLS already denies anon.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."case_patient" TO "service_role";
REVOKE ALL PRIVILEGES ON TABLE "public"."case_patient" FROM "authenticated";

-- --- assert + probe + predicate functions -----------------------------------
REVOKE ALL ON FUNCTION "app"."assert_case_patient_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."assert_case_patient_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "app"."assert_case_patient_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."case_patient_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."case_patient_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."case_patient_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "app"."can_read_case_patient"("p_case_id" "uuid", "p_uid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."can_read_case_patient"("p_case_id" "uuid", "p_uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."can_read_case_patient"("p_case_id" "uuid", "p_uid" "uuid") TO "service_role";

-- --- the audited / DEFINER RPCs + the replaced cross-cutting functions --------
DO $$
DECLARE
  fn text;
  fns text[] := array[
    'public.log_audit_access(text, text, uuid, uuid, text, jsonb)',
    'public.set_case_patient(uuid, text, text, date, integer, text, text, text, text)',
    'public.get_case_patient(uuid)',
    'public.dispose_case_phi(uuid, text)',
    'public.create_case_from_template(uuid, text)',
    'public.get_case_detail(uuid)',
    'public.set_template_collects_patient(uuid, boolean)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

-- trigger function: revoke EXECUTE from PUBLIC (defense in depth; only ever fired
-- by the trigger, never called directly).
REVOKE ALL ON FUNCTION "app"."trg_audit_case_patient"() FROM PUBLIC;

-- ===========================================================================
-- Feature flag — ships OFF (the E2E suite flips it ON, like the other PHI flags).
-- ===========================================================================
INSERT INTO "app"."feature_flags" ("key", "enabled", "description")
VALUES ('case_patient', false, 'When true, the Cases module captures an OPTIONAL minimum-necessary set of patient identifiers (the THIRD PHI module; ADR 0038): a per-template collects_patient toggle gates the create-dialog PHI block, identifiers live on the isolated public.case_patient behind the audited single-door get_case_patient (case_patient.read), the read scope is the BROAD can_read_case (assignees need the MRN) while writes stay coordinators-only, and dispose_case_phi provides LGPD erasure. Ships OFF; enabled at feature completion.')
ON CONFLICT ("key") DO NOTHING;
