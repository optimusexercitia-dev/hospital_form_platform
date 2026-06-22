-- ----------------------------------------------------------------------------
-- patient_index — Patient Identity & Cross-Committee Linkage (Phase 23; ADR 0039)
-- ----------------------------------------------------------------------------
-- A NON-IDENTIFYING matching layer ON TOP of the three existing isolated PHI
-- modules (public.event_patient / public.referral_patient / public.case_patient).
-- It lets the platform recognize the SAME patient across committees WITHOUT ever
-- letting a raw MRN leave its locked per-committee table:
--
--   * A deterministic, non-reversible keyed hash (patient_key from the MRN,
--     encounter_key from the encounter number) = HMAC-SHA256(normalize(value),
--     pepper). Same identifier → same key everywhere (cross-committee match);
--     irreversible without the pepper (safe in the index, on referrals, truncated
--     in the audit log).
--   * A KEY-ONLY index (public.patient_xref) — NO names, NO raw MRN — with
--     QPS-only RLS, maintained by triggers off the three PHI tables.
--   * QPS-only DEFINER doors: search by MRN/encounter -> PHI-free cross-committee
--     trajectory + a patient-scoped access audit; a deep-link pivot from one
--     entity; and the ONE non-QPS door, a count-only referral receiver hint.
--   * Every QPS reassembly is audited on the GLOBAL chain, KEY-ONLY metadata —
--     never the raw MRN/name (Rule 11). PHI itself is NEVER surfaced here; QPS
--     reaches identifiers only by drilling into a record through that module's
--     existing audited door (*_patient.read).
--
-- This module adds NO fourth PHI store (Rule 12): patient_xref holds keys only.
--
-- House style mirrors 20260620017000_case_patient.sql: public.* objects OWNER
-- postgres, RLS enabled, COMMENT ON for the index, this file carries its OWN
-- grants + revokes, ships the `patient_index` flag OFF (the E2E suite flips it ON,
-- like the other PHI flags). Forward-only / additive: the cross-cutting
-- dispose_case_phi / dispose_event_phi are applied here by CREATE OR REPLACE, NOT
-- by editing the already-applied files.

SET check_function_bodies = false;
SET client_min_messages = warning;

-- ===========================================================================
-- (1) Pepper store — app.app_secrets, a locked-down secrets TABLE (NOT a GUC,
--     NOT Supabase Vault).
-- ===========================================================================
-- The HMAC pepper lives in a one-row-per-secret table in the `app` schema (NOT
-- public, so it is NEVER PostgREST-exposed). The DEFINER derive_patient_key reads
-- it as owner and HARD-FAILS if the row is missing/empty (so we never emit a
-- constant empty-pepper key).
--
-- Why a TABLE (ADR 0039):
--   * NOT Vault — Vault is empty during `supabase db reset` -> seed, so a trigger
--     fired on the seed's direct PHI inserts would derive null keys.
--   * NOT a GUC (`ALTER DATABASE ... SET app.mrn_pepper`) — that requires SUPERUSER,
--     which the migration role is not (and never is on Supabase Cloud): it fails with
--     42501 "permission denied to set parameter". A plain INSERT/SELECT needs no
--     special privilege and works on cloud + survives reset.
--   * The superuser-visible residual is the SAME accepted ADR-0035 posture (a
--     compromised superuser/app-owner can read the secret either way); a separate
--     keyed-hash linkage is still the right control vs. column encryption.
--
-- The table is created in the `app` schema (already exists; same home as
-- feature_flags). The DEV pepper is seeded at the END of this file (so the table +
-- grants exist first), `ON CONFLICT DO NOTHING` — never clobbering a value already
-- set out-of-band. PROD sets the real secret out-of-band ONCE before any real PHI:
--   UPDATE app.app_secrets SET value = '<real>', updated_at = now() WHERE key = 'mrn_pepper';
CREATE TABLE IF NOT EXISTS "app"."app_secrets" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "app_secrets_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "app"."app_secrets" OWNER TO "postgres";

COMMENT ON TABLE "app"."app_secrets" IS 'Server-side application secrets (ADR 0039) — currently the HMAC pepper for patient-identity linkage (key = ''mrn_pepper''). In the `app` schema (NOT public) so it is never PostgREST-exposed; all DML REVOKED from authenticated/anon, SELECT granted only to service_role. The DEFINER app.derive_patient_key reads it as owner. Superuser/owner-visible is the accepted ADR-0035 residual (the keyed hash is a linkage control, not an at-rest-encryption control).';

-- Lock down: zero access for the data-API roles. service_role keeps SELECT (an
-- operator path); the DEFINER reader runs as owner regardless. (No RLS needed —
-- the table is outside `public`/PostgREST and authenticated has no grant at all.)
REVOKE ALL ON TABLE "app"."app_secrets" FROM "authenticated", "anon";
GRANT SELECT ON TABLE "app"."app_secrets" TO "service_role";

-- ===========================================================================
-- (2) Normalization + key derivation.
-- ===========================================================================

-- normalize_identifier — CONSERVATIVE (ADR 0039): trim, uppercase, collapse
-- internal whitespace; NULL for blank. Leading zeros & punctuation are
-- SIGNIFICANT (we don't know they're insignificant in this hospital's numbering),
-- keeping false-positive cross-links near zero. IMMUTABLE so it can back indexes
-- and be inlined.
CREATE OR REPLACE FUNCTION "app"."normalize_identifier"("p_value" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog'
    AS $$
  select nullif(btrim(regexp_replace(upper(p_value), '\s+', ' ', 'g')), '');
$$;

ALTER FUNCTION "app"."normalize_identifier"("p_value" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "app"."normalize_identifier"("p_value" "text") IS 'ADR 0039 — conservative identifier normalization for keyed-hash linkage: trim, uppercase, collapse internal whitespace; NULL for blank. Leading zeros & punctuation are significant (exact-match policy). IMMUTABLE.';

-- derive_patient_key — the keyed hash. STABLE (the pepper is stable within a
-- transaction) SECURITY DEFINER (reads app.app_secrets as owner + extensions.hmac).
-- HARD-FAILS if the pepper row is missing/empty so we never emit a constant
-- empty-pepper key. NULL norm -> NULL key (name-only rows get no key). MUST
-- schema-qualify extensions.hmac — extensions is not on search_path (the audit
-- chain proves the same with extensions.digest).
CREATE OR REPLACE FUNCTION "app"."derive_patient_key"("p_value" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'pg_catalog'
    AS $$
declare
  v_pepper text;
  v_norm text;
begin
  select nullif(btrim(value), '') into v_pepper
  from app.app_secrets where key = 'mrn_pepper';

  if v_pepper is null then
    raise exception 'o segredo app_secrets[''mrn_pepper''] não está configurado — não é possível derivar a chave do paciente'
      using errcode = 'check_violation';
  end if;
  v_norm := app.normalize_identifier(p_value);
  if v_norm is null then
    return null;
  end if;
  return encode(extensions.hmac(v_norm, v_pepper, 'sha256'), 'hex');
end;
$$;

ALTER FUNCTION "app"."derive_patient_key"("p_value" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "app"."derive_patient_key"("p_value" "text") IS 'ADR 0039 — HMAC-SHA256(normalize(value), app.app_secrets[mrn_pepper]) hex. Deterministic (cross-committee match) + irreversible without the pepper. RAISES if the pepper row is missing/empty (never a constant empty-pepper key); NULL value/norm -> NULL key. extensions.hmac is schema-qualified (not on search_path).';

-- ===========================================================================
-- (3) Key columns on the three isolated PHI tables (additive).
-- ===========================================================================
-- A key is a non-reversible hash, NOT PHI. It is derived by the BEFORE trigger
-- below (covers RPC writes AND the seed's direct inserts). NULL until the flag is
-- on, and NULL for name-only rows.
ALTER TABLE "public"."event_patient"
  ADD COLUMN IF NOT EXISTS "patient_key" "text",
  ADD COLUMN IF NOT EXISTS "encounter_key" "text";
ALTER TABLE "public"."referral_patient"
  ADD COLUMN IF NOT EXISTS "patient_key" "text",
  ADD COLUMN IF NOT EXISTS "encounter_key" "text";
ALTER TABLE "public"."case_patient"
  ADD COLUMN IF NOT EXISTS "patient_key" "text",
  ADD COLUMN IF NOT EXISTS "encounter_key" "text";

COMMENT ON COLUMN "public"."event_patient"."patient_key" IS 'ADR 0039 — non-reversible keyed hash of the MRN (HMAC-SHA256 under the app.app_secrets pepper). NOT PHI. Derived ALWAYS by app.trg_derive_patient_keys (not flag-gated; the flag gates exposure via the RPCs/UI). Links the patient across committees via public.patient_xref. NULL only when there is no MRN.';
COMMENT ON COLUMN "public"."event_patient"."encounter_key" IS 'ADR 0039 — non-reversible keyed hash of the encounter number. NOT PHI. Lets QPS pivot encounter -> patient. NULL only when there is no encounter.';
COMMENT ON COLUMN "public"."referral_patient"."patient_key" IS 'ADR 0039 — non-reversible keyed hash of the MRN (see event_patient.patient_key). The key TRAVELS on the referral via this row (no new transport). NOT PHI.';
COMMENT ON COLUMN "public"."referral_patient"."encounter_key" IS 'ADR 0039 — non-reversible keyed hash of the encounter number (see event_patient.encounter_key). NOT PHI.';
COMMENT ON COLUMN "public"."case_patient"."patient_key" IS 'ADR 0039 — non-reversible keyed hash of the MRN (see event_patient.patient_key). NOT PHI.';
COMMENT ON COLUMN "public"."case_patient"."encounter_key" IS 'ADR 0039 — non-reversible keyed hash of the encounter number (see event_patient.encounter_key). NOT PHI.';

-- ===========================================================================
-- (4) BEFORE INSERT/UPDATE derivation trigger on the three PHI tables.
-- ===========================================================================
-- Sets NEW.patient_key/encounter_key from NEW.mrn/encounter_ref. ALWAYS-ON (NOT
-- flag-gated) — keys are non-identifying + the xref is QPS-only, so the only thing
-- the flag gates is EXPOSURE (the RPCs + UI). Always deriving keeps the data layer
-- consistent and makes enablement a single flag flip (no backfill). Fires on RPC
-- writes AND the seed's direct inserts (seed.sql:904, :1145) — which is why
-- derivation is a trigger, not RPC-only logic.
CREATE OR REPLACE FUNCTION "app"."trg_derive_patient_keys"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  -- ALWAYS-ON (NOT flag-gated): keys are non-identifying and the xref is QPS-only,
  -- so deriving them regardless of flag state has ZERO exposure (the RPCs + UI gate
  -- the flag). This keeps the data layer consistent right after any reset/write, so
  -- enabling the feature is a single flag flip — no backfill step. Re-derive only on
  -- INSERT or when mrn/encounter_ref actually change (so an unrelated UPDATE doesn't
  -- re-hash).
  if TG_OP = 'INSERT'
     or new.mrn is distinct from old.mrn
     or new.encounter_ref is distinct from old.encounter_ref then
    new.patient_key   := app.derive_patient_key(new.mrn);
    new.encounter_key := app.derive_patient_key(new.encounter_ref);
  end if;

  return new;
end;
$$;

ALTER FUNCTION "app"."trg_derive_patient_keys"() OWNER TO "postgres";

CREATE TRIGGER "trg_derive_patient_keys_biu" BEFORE INSERT OR UPDATE ON "public"."event_patient"
    FOR EACH ROW EXECUTE FUNCTION "app"."trg_derive_patient_keys"();
CREATE TRIGGER "trg_derive_patient_keys_biu" BEFORE INSERT OR UPDATE ON "public"."referral_patient"
    FOR EACH ROW EXECUTE FUNCTION "app"."trg_derive_patient_keys"();
CREATE TRIGGER "trg_derive_patient_keys_biu" BEFORE INSERT OR UPDATE ON "public"."case_patient"
    FOR EACH ROW EXECUTE FUNCTION "app"."trg_derive_patient_keys"();

-- ===========================================================================
-- (5) patient_xref — the KEY-ONLY, QPS-only cross-committee index.
-- ===========================================================================
-- NO names, NO raw MRN — keys + governance metadata only. One row per
-- (module, entity_id). disposed_at/reason support retain-marked-disposed (the keys
-- are non-identifying, and historical access rows must still correlate).
CREATE TABLE IF NOT EXISTS "public"."patient_xref" (
    "module" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "commission_id" "uuid",
    "patient_key" "text",
    "encounter_key" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "disposed_at" timestamp with time zone,
    "disposed_reason" "text",
    CONSTRAINT "patient_xref_module_check" CHECK (("module" = ANY (ARRAY['event'::"text", 'referral'::"text", 'case'::"text"]))),
    CONSTRAINT "patient_xref_disposed_reason_check" CHECK (("disposed_reason" IS NULL OR "disposed_reason" = ANY (ARRAY['retention_expired'::"text", 'subject_request'::"text", 'entered_in_error'::"text", 'duplicate'::"text", 'other'::"text"])))
);

ALTER TABLE "public"."patient_xref" OWNER TO "postgres";

ALTER TABLE ONLY "public"."patient_xref"
    ADD CONSTRAINT "patient_xref_pkey" PRIMARY KEY ("module", "entity_id");

COMMENT ON TABLE "public"."patient_xref" IS 'ADR 0039 — KEY-ONLY cross-committee patient index. Holds non-reversible keyed hashes (patient_key/encounter_key) + governance metadata ONLY — NO names, NO raw MRN, so it is NOT a PHI store (Rule 12 — this layer adds no fourth PHI table). QPS-only: RLS SELECT = app.is_pqs_member; all DML REVOKED from authenticated (maintained by triggers off the 3 PHI tables, served by DEFINER doors). retain-marked-disposed on PHI erasure.';
COMMENT ON COLUMN "public"."patient_xref"."module" IS 'Which isolated PHI module this row mirrors: event | referral | case.';
COMMENT ON COLUMN "public"."patient_xref"."entity_id" IS 'The module-native entity id (event_id / referral_id / case_id).';
COMMENT ON COLUMN "public"."patient_xref"."disposed_reason" IS 'WHY the source PHI was disposed — constrained category (mirrors the *_patient disposal reason), never free text. NULL until disposal. The xref row is RETAINED (keys are non-identifying).';

-- Partial indexes back the two search paths (only keyed rows are ever matched).
CREATE INDEX IF NOT EXISTS "patient_xref_patient_key_idx"
  ON "public"."patient_xref" ("patient_key") WHERE ("patient_key" IS NOT NULL);
CREATE INDEX IF NOT EXISTS "patient_xref_encounter_key_idx"
  ON "public"."patient_xref" ("encounter_key") WHERE ("encounter_key" IS NOT NULL);

ALTER TABLE "public"."patient_xref" ENABLE ROW LEVEL SECURITY;

-- QPS-only SELECT (duty separation — a non-PQS admin sees nothing). DML is REVOKED
-- below; the maintenance triggers (DEFINER, run as owner) and the DEFINER doors are
-- the only writers/readers.
CREATE POLICY "patient_xref_select_pqs" ON "public"."patient_xref"
  FOR SELECT TO "authenticated"
  USING ("app"."is_pqs_member"("auth"."uid"()));

-- ===========================================================================
-- (6) AFTER INSERT/UPDATE/DELETE xref-maintenance trigger on the 3 PHI tables.
-- ===========================================================================
-- ALWAYS-ON (NOT flag-gated): the xref is QPS-only + key-only, so keeping the data
-- layer consistent regardless of flag state has ZERO exposure (the RPCs + UI gate
-- the flag). Keys exist immediately after any reset/write, so enabling the feature
-- is a single flag flip with NO backfill step.
--
-- Entity id + module are resolved GENERICALLY from TG_TABLE_NAME — the three PHI
-- tables have DIFFERENT entity-id columns (event_id / referral_id / case_id), so we
-- must NEVER statically dereference one table's column (that breaks the moment the
-- trigger fires on another table). We read it out of to_jsonb(NEW|OLD).
--
-- INSERT/UPDATE: upsert the keys (skip entirely when BOTH keys are NULL — name-only
--   rows never enter the index). commission resolved via the existing
--   app.commission_of_* helpers.
-- DELETE: STAMP, don't delete — set disposed_at/reason, reading the reason from the
--   txn-local app.phi_dispose_reason GUC the dispose RPCs set (default 'other', e.g.
--   the referral cascade path which has no dispose RPC yet).
CREATE OR REPLACE FUNCTION "app"."trg_xref_maintain"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_module text := case TG_TABLE_NAME
                     when 'event_patient' then 'event'
                     when 'referral_patient' then 'referral'
                     when 'case_patient' then 'case'
                   end;
  v_id_col text := case TG_TABLE_NAME
                     when 'event_patient' then 'event_id'
                     when 'referral_patient' then 'referral_id'
                     when 'case_patient' then 'case_id'
                   end;
  v_entity uuid;
  v_comm uuid;
  v_reason text;
begin
  if TG_OP = 'DELETE' then
    v_entity := (to_jsonb(old) ->> v_id_col)::uuid;
    v_reason := coalesce(nullif(btrim(coalesce(current_setting('app.phi_dispose_reason', true), '')), ''), 'other');
    -- Retain the xref row, stamp it disposed. If no xref row exists (name-only PHI
    -- never indexed), this updates nothing — fine.
    update public.patient_xref
       set disposed_at = coalesce(disposed_at, now()),
           disposed_reason = v_reason
     where module = v_module and entity_id = v_entity;
    return old;
  end if;

  -- INSERT / UPDATE
  v_entity := (to_jsonb(new) ->> v_id_col)::uuid;

  -- Skip when there is nothing to index (both keys NULL): name-only PHI (no MRN /
  -- encounter). No xref row is created.
  if new.patient_key is null and new.encounter_key is null then
    return new;
  end if;

  v_comm := case v_module
              when 'event' then app.commission_of_event(v_entity)
              when 'referral' then app.commission_of_referral(v_entity)
              when 'case' then app.commission_of_case(v_entity)
            end;

  insert into public.patient_xref (module, entity_id, commission_id, patient_key, encounter_key)
  values (v_module, v_entity, v_comm, new.patient_key, new.encounter_key)
  on conflict (module, entity_id) do update
    set patient_key = excluded.patient_key,
        encounter_key = excluded.encounter_key,
        commission_id = excluded.commission_id;
  -- NOTE: a live UPDATE of identifiers does NOT clear an earlier disposed stamp —
  -- disposal deletes the PHI row, so a subsequent UPDATE on it cannot occur.

  return new;
end;
$$;

ALTER FUNCTION "app"."trg_xref_maintain"() OWNER TO "postgres";

-- Module is resolved inside the function from TG_TABLE_NAME (no TG_ARGV needed).
CREATE TRIGGER "trg_xref_maintain_aiud" AFTER INSERT OR UPDATE OR DELETE ON "public"."event_patient"
    FOR EACH ROW EXECUTE FUNCTION "app"."trg_xref_maintain"();
CREATE TRIGGER "trg_xref_maintain_aiud" AFTER INSERT OR UPDATE OR DELETE ON "public"."referral_patient"
    FOR EACH ROW EXECUTE FUNCTION "app"."trg_xref_maintain"();
CREATE TRIGGER "trg_xref_maintain_aiud" AFTER INSERT OR UPDATE OR DELETE ON "public"."case_patient"
    FOR EACH ROW EXECUTE FUNCTION "app"."trg_xref_maintain"();

-- ===========================================================================
-- (10/11) Feature flag assert + probe (mirror app.assert_case_patient_enabled).
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."assert_patient_index_enabled"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not app.feature_enabled('patient_index') then
    raise exception 'o índice de identidade do paciente não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;

ALTER FUNCTION "app"."assert_patient_index_enabled"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."patient_index_enabled"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.feature_enabled('patient_index');
$$;

ALTER FUNCTION "public"."patient_index_enabled"() OWNER TO "postgres";

-- ===========================================================================
-- Shared internals for the DEFINER doors.
-- ===========================================================================
-- app.patient_match_basis — collapse "did the patient key match / the encounter
-- key match / both" into the PatientMatchBasis union value. NULL when neither.
CREATE OR REPLACE FUNCTION "app"."patient_match_basis"("p_by_patient" boolean, "p_by_encounter" boolean) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog'
    AS $$
  select case
    when p_by_patient and p_by_encounter then 'both'
    when p_by_patient then 'patient'
    when p_by_encounter then 'encounter'
    else null
  end;
$$;

ALTER FUNCTION "app"."patient_match_basis"("p_by_patient" boolean, "p_by_encounter" boolean) OWNER TO "postgres";

-- app.patient_key_to_uuid — a STABLE, non-reversible UUID derived from a key, for
-- the entity_id of the global-chain patient.searched/viewed audit rows. audit_log
-- .entity_id is NOT NULL and a cross-committee search has no single entity, so we
-- reference "the patient" by a UUID deterministically formatted from the first 32
-- hex chars of the (already non-reversible) keyed hash — canonical 8-4-4-4-12 form,
-- so it is a valid uuid regardless of the server's input leniency. Same patient ->
-- same uuid, so these rows are correlatable; the raw key is never stored.
CREATE OR REPLACE FUNCTION "app"."patient_key_to_uuid"("p_key" "text") RETURNS "uuid"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog'
    AS $$
  select case when p_key is null or length(p_key) < 32 then null else (
    substr(p_key, 1, 8)  || '-' ||
    substr(p_key, 9, 4)  || '-' ||
    substr(p_key, 13, 4) || '-' ||
    substr(p_key, 17, 4) || '-' ||
    substr(p_key, 21, 12)
  )::uuid end;
$$;

ALTER FUNCTION "app"."patient_key_to_uuid"("p_key" "text") OWNER TO "postgres";

-- app.patient_trajectory_bundle — the shared PHI-FREE result builder for BOTH
-- search_patient_xref and get_patient_trajectory_for_entity. Given the resolved
-- patient_key/encounter_key (either may be NULL), assemble the
-- PatientSearchResult-shaped jsonb: { matchedOn, matchCount, entries:[ ... ] }.
-- Entries are resolved per module to their PHI-FREE human code + commission name +
-- dates + disposed flag, newest-first. NO raw PHI is read or returned.
CREATE OR REPLACE FUNCTION "app"."patient_trajectory_bundle"("p_patient_key" "text", "p_encounter_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_entries jsonb;
  v_count integer;
  v_any_patient boolean;
  v_any_encounter boolean;
begin
  if p_patient_key is null and p_encounter_key is null then
    return jsonb_build_object('matchedOn', null, 'matchCount', 0, 'entries', '[]'::jsonb);
  end if;

  with matched as (
    select
      x.module,
      x.entity_id,
      x.commission_id,
      x.disposed_at,
      x.created_at,
      (p_patient_key is not null and x.patient_key = p_patient_key) as by_patient,
      (p_encounter_key is not null and x.encounter_key = p_encounter_key) as by_encounter
    from public.patient_xref x
    where (p_patient_key is not null and x.patient_key = p_patient_key)
       or (p_encounter_key is not null and x.encounter_key = p_encounter_key)
  ),
  resolved as (
    select
      m.module,
      m.entity_id,
      m.commission_id,
      coalesce(c.name, null) as commission_name,
      app.patient_match_basis(m.by_patient, m.by_encounter) as matched_on,
      (m.disposed_at is not null) as disposed,
      m.disposed_at,
      m.created_at,
      case m.module
        when 'event' then (select e.code from public.patient_safety_event e where e.id = m.entity_id)
        when 'referral' then (select r.code from public.case_referral r where r.id = m.entity_id)
        when 'case' then (select 'Caso ' || cs.case_number::text from public.cases cs where cs.id = m.entity_id)
      end as entity_code,
      m.by_patient,
      m.by_encounter
    from matched m
    left join public.commissions c on c.id = m.commission_id
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'module', module,
      'entityId', entity_id,
      'entityCode', coalesce(entity_code, '—'),
      'commissionId', commission_id,
      'commissionName', commission_name,
      'matchedOn', matched_on,
      'disposed', disposed,
      'disposedAt', disposed_at,
      'createdAt', created_at
    ) order by created_at desc), '[]'::jsonb),
    count(*),
    bool_or(by_patient),
    bool_or(by_encounter)
  into v_entries, v_count, v_any_patient, v_any_encounter
  from resolved;

  return jsonb_build_object(
    'matchedOn', app.patient_match_basis(coalesce(v_any_patient, false), coalesce(v_any_encounter, false)),
    'matchCount', coalesce(v_count, 0),
    'entries', v_entries
  );
end;
$$;

ALTER FUNCTION "app"."patient_trajectory_bundle"("p_patient_key" "text", "p_encounter_key" "text") OWNER TO "postgres";

-- ===========================================================================
-- (7) search_patient_xref — QPS search by MRN/encounter -> PHI-free trajectory.
-- ===========================================================================
-- PQS-gated (empty for non-PQS). Hashes the inputs, builds the trajectory bundle,
-- and emits patient.searched on the GLOBAL chain (key-only metadata) ONLY when
-- matches >= 1. A zero-match search returns the empty bundle and audits nothing.
CREATE OR REPLACE FUNCTION "public"."search_patient_xref"("p_mrn" "text" DEFAULT NULL::"text", "p_encounter" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" VOLATILE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_patient_key text;
  v_encounter_key text;
  v_bundle jsonb;
  v_count integer;
  v_audit_key text;
begin
  perform app.assert_patient_index_enabled();

  -- Duty separation: non-PQS callers (incl. non-PQS admins) get the empty bundle.
  if not app.is_pqs_member(auth.uid()) then
    return jsonb_build_object('matchedOn', null, 'matchCount', 0, 'entries', '[]'::jsonb);
  end if;

  v_patient_key := app.derive_patient_key(p_mrn);
  v_encounter_key := app.derive_patient_key(p_encounter);

  if v_patient_key is null and v_encounter_key is null then
    return jsonb_build_object('matchedOn', null, 'matchCount', 0, 'entries', '[]'::jsonb);
  end if;

  v_bundle := app.patient_trajectory_bundle(v_patient_key, v_encounter_key);
  v_count := coalesce((v_bundle ->> 'matchCount')::integer, 0);

  -- Audit ONLY a successful match, on the GLOBAL chain, with KEY-ONLY metadata
  -- (truncated key + match count) — NEVER the raw MRN/name (Rule 11). Prefer the
  -- patient key for the metadata; fall back to the encounter key.
  if v_count >= 1 then
    v_audit_key := coalesce(v_patient_key, v_encounter_key);
    -- entity_id is NOT NULL on audit_log; reference "the patient" by a stable,
    -- non-reversible UUID derived from the key (a search has no single entity).
    perform app.audit_write(
      'patient.searched', 'patient', app.patient_key_to_uuid(v_audit_key), null,
      'Pesquisa de paciente entre comissões (' || v_count::text || ' registro(s))',
      jsonb_build_object('patient_key', left(v_audit_key, 12) || '…', 'matches', v_count)
    );
  end if;

  return v_bundle;
end;
$$;

ALTER FUNCTION "public"."search_patient_xref"("p_mrn" "text", "p_encounter" "text") OWNER TO "postgres";

-- ===========================================================================
-- (4-FE) get_patient_trajectory_for_entity — deep-link pivot from one entity.
-- ===========================================================================
-- A QPS user clicks a record (access-audit table / module detail). Resolve the
-- entity's keys SERVER-SIDE from patient_xref (PQS-gated), assemble the SAME bundle
-- as search, but emit patient.viewed (opened, not searched). Out of scope / keyless
-- entity / no match -> empty bundle (the caller never supplies or learns a key).
CREATE OR REPLACE FUNCTION "public"."get_patient_trajectory_for_entity"("p_module" "text", "p_entity_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" VOLATILE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_patient_key text;
  v_encounter_key text;
  v_bundle jsonb;
  v_count integer;
  v_audit_key text;
begin
  perform app.assert_patient_index_enabled();

  if p_module is null or p_module not in ('event', 'referral', 'case') then
    raise exception 'módulo inválido' using errcode = 'check_violation';
  end if;
  if not app.is_pqs_member(auth.uid()) then
    return jsonb_build_object('matchedOn', null, 'matchCount', 0, 'entries', '[]'::jsonb);
  end if;

  select patient_key, encounter_key into v_patient_key, v_encounter_key
  from public.patient_xref
  where module = p_module and entity_id = p_entity_id;

  if v_patient_key is null and v_encounter_key is null then
    -- Unknown entity OR name-only (never indexed) -> nothing to pivot on.
    return jsonb_build_object('matchedOn', null, 'matchCount', 0, 'entries', '[]'::jsonb);
  end if;

  v_bundle := app.patient_trajectory_bundle(v_patient_key, v_encounter_key);
  v_count := coalesce((v_bundle ->> 'matchCount')::integer, 0);

  if v_count >= 1 then
    v_audit_key := coalesce(v_patient_key, v_encounter_key);
    perform app.audit_write(
      'patient.viewed', 'patient', p_entity_id, null,
      'Trajetória de paciente aberta a partir de um registro (' || v_count::text || ' registro(s))',
      jsonb_build_object('patient_key', left(v_audit_key, 12) || '…', 'matches', v_count)
    );
  end if;

  return v_bundle;
end;
$$;

ALTER FUNCTION "public"."get_patient_trajectory_for_entity"("p_module" "text", "p_entity_id" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- (8) patient_access_audit — patient-scoped cross-committee access audit.
-- ===========================================================================
-- PQS-gated DEFINER door returning audit_log rows for every entity sharing the
-- patient's patient_key (resolved from the MRN/encounter, hashed server-side).
-- BYPASSES per-commission audit RLS BY DESIGN (a QPS-only cross-committee view),
-- selecting NON-PHI columns only (+ PHI-free actor/commission name joins). Reading
-- the audit is NOT re-audited (no audit_write here). Newest-first.
CREATE OR REPLACE FUNCTION "public"."patient_access_audit"("p_mrn" "text" DEFAULT NULL::"text", "p_encounter" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_patient_key text;
  v_encounter_key text;
  v_rows jsonb;
begin
  perform app.assert_patient_index_enabled();

  if not app.is_pqs_member(auth.uid()) then
    return '[]'::jsonb;
  end if;

  v_patient_key := app.derive_patient_key(p_mrn);
  v_encounter_key := app.derive_patient_key(p_encounter);
  if v_patient_key is null and v_encounter_key is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id,
           'occurredAt', a.occurred_at,
           'actorId', a.actor_id,
           'actorName', pr.full_name,
           'action', a.action,
           'entityType', a.entity_type,
           'entityId', a.entity_id,
           'commissionId', a.commission_id,
           'commissionName', c.name
         ) order by a.occurred_at desc), '[]'::jsonb)
    into v_rows
  from public.audit_log a
  left join public.profiles pr on pr.id = a.actor_id
  left join public.commissions c on c.id = a.commission_id
  where a.entity_id in (
    select x.entity_id
    from public.patient_xref x
    where (v_patient_key is not null and x.patient_key = v_patient_key)
       or (v_encounter_key is not null and x.encounter_key = v_encounter_key)
  );

  return v_rows;
end;
$$;

ALTER FUNCTION "public"."patient_access_audit"("p_mrn" "text", "p_encounter" "text") OWNER TO "postgres";

-- ===========================================================================
-- (9) patient_xref_count — the ONE non-QPS door: referral receiver hint (count).
-- ===========================================================================
-- Gated on app.can_read_referral_phi (so a referral's B-side coordinator/analyst
-- gets the COUNT without QPS membership and WITHOUT learning which records or the
-- patient identity). Returns the count of OTHER non-disposed xref rows sharing the
-- entity's patient_key (excluding self). 0 when out of scope / keyless / no match.
CREATE OR REPLACE FUNCTION "public"."patient_xref_count"("p_module" "text", "p_entity_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_patient_key text;
  v_count integer;
begin
  perform app.assert_patient_index_enabled();

  if p_module is null or p_module not in ('event', 'referral', 'case') then
    return 0;
  end if;

  -- v1 the only consumer is the referral hint; the entitlement check is the
  -- referral PHI predicate. (The module arg keeps the door reusable; a future
  -- non-referral hint would add its own predicate branch here.)
  if p_module = 'referral' then
    if not app.can_read_referral_phi(p_entity_id, auth.uid()) then
      return 0;
    end if;
  else
    -- No entitlement path defined for other modules yet -> deny.
    return 0;
  end if;

  select patient_key into v_patient_key
  from public.patient_xref
  where module = p_module and entity_id = p_entity_id;

  if v_patient_key is null then
    return 0;  -- name-only / not indexed -> no cross-links to count
  end if;

  select count(*)
    into v_count
  from public.patient_xref x
  where x.patient_key = v_patient_key
    and x.disposed_at is null
    and not (x.module = p_module and x.entity_id = p_entity_id);  -- exclude self

  return coalesce(v_count, 0);
end;
$$;

ALTER FUNCTION "public"."patient_xref_count"("p_module" "text", "p_entity_id" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- (11-edit) dispose_event_phi REPLACE — stamp the xref reason before deleting PHI.
-- ===========================================================================
-- Forward-only CREATE OR REPLACE of 20260620009000_patient_safety.sql's
-- dispose_event_phi. ONLY change vs the original: inside the existing in_safety_rpc
-- bypass window, set the txn-local app.phi_dispose_reason GUC so the AFTER-DELETE
-- xref trigger stamps the real reason (not the 'other' fallback). Everything else
-- — the gate, the reason CHECK, the one-shot guard, the free-text redaction across
-- event/triage/rca/capa, the stamps, the audit — is verbatim from the original.
CREATE OR REPLACE FUNCTION "public"."dispose_event_phi"("p_event_id" "uuid", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_event public.patient_safety_event;
  v_rca_id uuid;
  v_redacted constant text := '[PHI removido]';
begin
  perform app.assert_patient_safety_enabled();

  -- Gate: admin OR PQS. Disposal is a compliance/erasure action — it does NOT read
  -- PHI, so it does not require can_read_event_patient. DEFINER bypasses RLS → re-check.
  if not (app.is_admin() or app.is_pqs_member(auth.uid())) then
    raise exception 'apenas um administrador ou o NSP pode descartar dados do paciente'
      using errcode = '42501';
  end if;

  -- Constrained reason category (PHI-safe, LGPD Art. 18 accountability) — never free text.
  if p_reason is null or p_reason not in
       ('retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other') then
    raise exception 'motivo de descarte inválido' using errcode = 'check_violation';
  end if;

  select * into v_event from public.patient_safety_event where id = p_event_id;
  if v_event.id is null then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;

  -- One-shot (HC056): disposal cannot run twice on the same event.
  if v_event.phi_disposed_at is not null then
    raise exception 'os dados do paciente deste evento já foram descartados'
      using errcode = 'HC056';
  end if;

  -- Bypass the lifecycle/content-freeze guards so disposal works on a frozen/triaged/
  -- completed/closed record (same mechanism as transfer_event_custody). Txn-local.
  perform set_config('app.in_safety_rpc', 'on', true);

  -- ADR 0039: carry the disposal reason to the AFTER-DELETE xref-maintenance trigger
  -- (txn-local) so the retained xref row is stamped with the REAL reason, not 'other'.
  perform set_config('app.phi_dispose_reason', p_reason, true);

  -- (1) The isolated identifiers go entirely. (The AFTER-DELETE trigger stamps the
  --     retained patient_xref row using app.phi_dispose_reason.)
  delete from public.event_patient where event_id = p_event_id;

  -- (2) Event free text (nullable → NULL).
  update public.patient_safety_event
     set description_md = null
   where id = p_event_id;

  -- (3) Triage free text (1:1; nullable → NULL).
  update public.event_triage
     set disposition_notes_md = null
   where event_id = p_event_id;

  -- (4) RCA + its children (1:1 RCA per event).
  select id into v_rca_id from public.rca where event_id = p_event_id;
  if v_rca_id is not null then
    update public.rca
       set what_md = null, expected_md = null, summary_md = null,
           impact = null, scope = null
     where id = v_rca_id;
    -- NOT-NULL columns → REDACT to a sentinel (cannot NULL).
    update public.rca_factors          set text = v_redacted        where rca_id = v_rca_id;
    update public.rca_root_causes       set text = v_redacted        where rca_id = v_rca_id;
    update public.rca_timeline_entries  set description = v_redacted  where rca_id = v_rca_id;
  end if;

  -- (5) CAPA plans sourced from this event (event-sourced OR via the event's RCA),
  --     plus their PHI-bearing children. Scope by the matching plan ids.
  update public.capa_plan
     set lessons_learned_md = null
   where source_event_id = p_event_id
      or (v_rca_id is not null and source_rca_id = v_rca_id);

  update public.capa_effectiveness ce
     set method_md = null
   where ce.capa_id in (
     select cp.id from public.capa_plan cp
     where cp.source_event_id = p_event_id
        or (v_rca_id is not null and cp.source_rca_id = v_rca_id)
   );

  update public.capa_measure_result cmr
     set note = null
   where cmr.measure_id in (
     select cm.id from public.capa_measure cm
     where cm.capa_id in (
       select cp.id from public.capa_plan cp
       where cp.source_event_id = p_event_id
          or (v_rca_id is not null and cp.source_rca_id = v_rca_id)
     )
   );

  -- NOT-NULL → REDACT.
  update public.capa_action_task cat
     set description = v_redacted
   where cat.action_id in (
     select ca.id from public.capa_action ca
     where ca.capa_id in (
       select cp.id from public.capa_plan cp
       where cp.source_event_id = p_event_id
          or (v_rca_id is not null and cp.source_rca_id = v_rca_id)
     )
   );

  -- (6) Stamp the event: who/when/why + flip has_patient false (so hasPatient reads
  --     false and the panel affordance disappears). PRESERVES the governance skeleton
  --     (codes, status, custody ledger, structured non-PHI, audit chain).
  update public.patient_safety_event
     set has_patient = false,
         phi_disposed_at = now(),
         phi_disposed_by = auth.uid(),
         phi_disposed_reason = p_reason,
         updated_at = now()
   where id = p_event_id;

  -- (7) Audit MUTATION row with the enum reason ONLY (PHI-safe metadata; no free text).
  perform app.audit_write(
    'event_patient.disposed',
    'event_patient',
    p_event_id,
    v_event.reporting_commission_id,
    'Dados do paciente do evento ' || v_event.code || ' descartados',
    jsonb_build_object('reason', p_reason)
  );

  perform set_config('app.in_safety_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."dispose_event_phi"("p_event_id" "uuid", "p_reason" "text") OWNER TO "postgres";

-- ===========================================================================
-- (11-edit) dispose_case_phi REPLACE — stamp the xref reason before deleting PHI.
-- ===========================================================================
-- Forward-only CREATE OR REPLACE of 20260620017000_case_patient.sql's
-- dispose_case_phi. ONLY change vs the original: set the txn-local
-- app.phi_dispose_reason GUC (inside the existing bypass window) before the
-- delete from public.case_patient, so the AFTER-DELETE xref trigger stamps the real
-- reason. Everything else is verbatim.
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

  -- ADR 0039: carry the disposal reason to the AFTER-DELETE xref-maintenance trigger
  -- (txn-local) so the retained xref row is stamped with the REAL reason, not 'other'.
  perform set_config('app.phi_dispose_reason', p_reason, true);

  -- (1) The isolated identifiers go entirely. (The AFTER-DELETE trigger stamps the
  --     retained patient_xref row using app.phi_dispose_reason.)
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
-- (12) backfill_patient_keys — idempotent REPAIR TOOL, DEFINER, LOCAL/CI ONLY.
-- ===========================================================================
-- The derivation trigger is ALWAYS-ON, so seed/RPC writes are already keyed and the
-- normal path needs NO backfill. This is a manual REPAIR tool only — e.g. to re-key
-- after a pepper rotation, or to rebuild xref if it were ever cleared. Derives keys
-- DIRECTLY on the 3 PHI tables (idempotent WHERE: only rows whose derived key would
-- change are touched), firing the AFTER trigger to (re)build xref. Raises if the
-- pepper is absent (via derive_patient_key). Not wired into prod.
CREATE OR REPLACE FUNCTION "app"."backfill_patient_keys"() RETURNS "void"
    LANGUAGE "plpgsql" VOLATILE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.assert_patient_index_enabled();
  -- Set the keys explicitly (derive_patient_key raises if the pepper is unset). The
  -- AFTER xref-maintenance trigger fires on each UPDATE and (re)builds patient_xref;
  -- the WHERE keeps it idempotent (only rows whose derived key would CHANGE are
  -- touched, so a re-run is a no-op once converged).
  update public.event_patient
     set patient_key = app.derive_patient_key(mrn),
         encounter_key = app.derive_patient_key(encounter_ref)
   where patient_key is distinct from app.derive_patient_key(mrn)
      or encounter_key is distinct from app.derive_patient_key(encounter_ref);

  update public.referral_patient
     set patient_key = app.derive_patient_key(mrn),
         encounter_key = app.derive_patient_key(encounter_ref)
   where patient_key is distinct from app.derive_patient_key(mrn)
      or encounter_key is distinct from app.derive_patient_key(encounter_ref);

  update public.case_patient
     set patient_key = app.derive_patient_key(mrn),
         encounter_key = app.derive_patient_key(encounter_ref)
   where patient_key is distinct from app.derive_patient_key(mrn)
      or encounter_key is distinct from app.derive_patient_key(encounter_ref);
end;
$$;

ALTER FUNCTION "app"."backfill_patient_keys"() OWNER TO "postgres";

-- ===========================================================================
-- (13) Grants + REVOKE. This file carries its own (the prior baselines are closed).
-- ===========================================================================

-- --- patient_xref: QPS-only SELECT via RLS; ZERO direct authenticated DML. The
-- maintenance triggers (DEFINER) write it; the DEFINER doors read it. service_role
-- intact. RLS already denies anon.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."patient_xref" TO "service_role";
REVOKE ALL PRIVILEGES ON TABLE "public"."patient_xref" FROM "authenticated";

-- --- normalize / derive / basis / bundle helpers + assert + probe -------------
REVOKE ALL ON FUNCTION "app"."normalize_identifier"("p_value" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."normalize_identifier"("p_value" "text") TO "service_role";

-- derive_patient_key: NOT granted to authenticated (only the triggers + DEFINER
-- doors, which run as owner, ever call it). Revoke from PUBLIC; service_role only.
REVOKE ALL ON FUNCTION "app"."derive_patient_key"("p_value" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."derive_patient_key"("p_value" "text") TO "service_role";

REVOKE ALL ON FUNCTION "app"."patient_match_basis"("p_by_patient" boolean, "p_by_encounter" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."patient_match_basis"("p_by_patient" boolean, "p_by_encounter" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "app"."patient_trajectory_bundle"("p_patient_key" "text", "p_encounter_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."patient_trajectory_bundle"("p_patient_key" "text", "p_encounter_key" "text") TO "service_role";

REVOKE ALL ON FUNCTION "app"."assert_patient_index_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."assert_patient_index_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "app"."assert_patient_index_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."patient_index_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."patient_index_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."patient_index_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "app"."backfill_patient_keys"() FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."backfill_patient_keys"() TO "service_role";

-- --- the PostgREST-callable DEFINER doors + the replaced dispose RPCs ----------
DO $$
DECLARE
  fn text;
  fns text[] := array[
    'public.search_patient_xref(text, text)',
    'public.get_patient_trajectory_for_entity(text, uuid)',
    'public.patient_access_audit(text, text)',
    'public.patient_xref_count(text, uuid)',
    'public.dispose_event_phi(uuid, text)',
    'public.dispose_case_phi(uuid, text)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

-- trigger functions: revoke EXECUTE from PUBLIC (defense in depth; only ever fired
-- by their triggers, never called directly).
REVOKE ALL ON FUNCTION "app"."trg_derive_patient_keys"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "app"."trg_xref_maintain"() FROM PUBLIC;

-- ===========================================================================
-- DEV pepper seed — placed here so app.app_secrets + its grants already exist.
-- ===========================================================================
-- DEV/CI default ONLY — deterministic, non-secret; it only needs to be stable
-- across local/CI resets so derived keys are reproducible. Present after every
-- `db reset`. ON CONFLICT DO NOTHING => NEVER clobbers a value already set
-- out-of-band. PROD overrides it ONCE, out-of-band, before any real PHI:
--   UPDATE app.app_secrets SET value = '<real secret>', updated_at = now()
--   WHERE key = 'mrn_pepper';
INSERT INTO "app"."app_secrets" ("key", "value")
VALUES ('mrn_pepper', 'dev-only-mrn-pepper-hospital-form-platform-20260622')
ON CONFLICT ("key") DO NOTHING;

-- ===========================================================================
-- (14) Feature flag — ships OFF (the E2E suite flips it ON, like the other PHI flags).
-- ===========================================================================
INSERT INTO "app"."feature_flags" ("key", "enabled", "description")
VALUES ('patient_index', false, 'When true, a NON-IDENTIFYING patient-identity layer links the same patient across committees (Phase 23; ADR 0039): a deterministic, non-reversible keyed hash (patient_key/encounter_key = HMAC-SHA256 under the app.app_secrets pepper) is derived by a trigger on the three isolated PHI tables, mirrored into the KEY-ONLY QPS-only public.patient_xref, transmitted on referrals (with a count-only receiver hint), and reassembled into a PHI-free cross-committee trajectory + access audit by QPS-only DEFINER doors — every reassembly audited on the global chain, key-only, never the raw MRN. Adds no fourth PHI store. Ships OFF; enabled at feature completion.')
ON CONFLICT ("key") DO NOTHING;
