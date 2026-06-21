-- ----------------------------------------------------------------------------
-- Phase 22 — Inter-Committee Case Referrals (feature flag `case_referrals`)
-- ----------------------------------------------------------------------------
-- A committee (source A) sends a curated, point-in-time SNAPSHOT of one of its
-- cases to another committee (target B) as a Notification or an Analysis/Review
-- Request. B reads only referral-owned frozen rows (never A's live case), posts a
-- structured reply, and MAY link a case it creates in its own commission. QPS
-- (the NSP/PQS roster, app.is_pqs_member) gets the full end-to-end macro view.
-- A case stays UNCONCLUDABLE while an expected reply is still in flight.
--
-- Supersedes ADR 0022 (header-only/no-PHI); see ADR 0037. PHI posture (Rule 12):
-- this is a SECOND PHI-bearing module outside the NSP, under the SAME isolated-
-- table + audited-single-door safeguards as patient_safety (no column encryption,
-- ADR 0035). The subject/status/commission-name surfaces stay PHI-FREE so
-- list/inbox/dashboard views never leak; patient context surfaces only on
-- drill-down to authorized readers, audited.
--
-- House style mirrors 20260620009000_patient_safety.sql: public.* objects OWNER
-- postgres, RLS enabled, UUID PKs, *_not_blank CHECKs, created_at/updated_at,
-- inline status CHECKs, COMMENT ON for PHI tables/columns. This file carries its
-- OWN grants + revokes (the 20260620012000_grants_revoke.sql baseline is closed)
-- and ships the `case_referrals` flag OFF (the E2E suite flips it ON, like
-- audit_trail / case_access). SQLSTATE block HC070–HC07A (ADR 0037).

-- ===========================================================================
-- Flag assert (mirror app.assert_patient_safety_enabled) — every RPC's 1st line.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."assert_referrals_enabled"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not app.feature_enabled('case_referrals') then
    raise exception 'o recurso de encaminhamentos não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;

ALTER FUNCTION "app"."assert_referrals_enabled"() OWNER TO "postgres";

-- Convenience boolean probe used by the query layer (referralsEnabled()).
CREATE OR REPLACE FUNCTION "public"."referrals_enabled"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.feature_enabled('case_referrals');
$$;

ALTER FUNCTION "public"."referrals_enabled"() OWNER TO "postgres";

-- ===========================================================================
-- Tables
-- ===========================================================================

-- --- referral_types: seeded vocab (PHI-free; any-auth READ, is_admin CRUD) ----
CREATE TABLE IF NOT EXISTS "public"."referral_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "color_token" "text",
    "default_response_expected" boolean DEFAULT true NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "referral_types_key_not_blank" CHECK (("btrim"("key") <> ''::"text")),
    CONSTRAINT "referral_types_label_not_blank" CHECK (("btrim"("label") <> ''::"text"))
);

ALTER TABLE "public"."referral_types" OWNER TO "postgres";

ALTER TABLE ONLY "public"."referral_types"
    ADD CONSTRAINT "referral_types_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."referral_types"
    ADD CONSTRAINT "referral_types_key_key" UNIQUE ("key");

COMMENT ON TABLE "public"."referral_types" IS 'Configurable referral-type vocabulary (Phase 22, Decision 8). PHI-free; any-authenticated READ, is_admin()-gated CRUD. default_response_expected pre-fills the send wizard. FK target of case_referral.referral_type_id.';

-- --- reply_outcomes: seeded structured-reply disposition vocab ----------------
CREATE TABLE IF NOT EXISTS "public"."reply_outcomes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "color_token" "text",
    "position" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reply_outcomes_key_not_blank" CHECK (("btrim"("key") <> ''::"text")),
    CONSTRAINT "reply_outcomes_label_not_blank" CHECK (("btrim"("label") <> ''::"text"))
);

ALTER TABLE "public"."reply_outcomes" OWNER TO "postgres";

ALTER TABLE ONLY "public"."reply_outcomes"
    ADD CONSTRAINT "reply_outcomes_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."reply_outcomes"
    ADD CONSTRAINT "reply_outcomes_key_key" UNIQUE ("key");

COMMENT ON TABLE "public"."reply_outcomes" IS 'Configurable structured-reply disposition vocabulary (Phase 22, Decision 10). PHI-free; any-authenticated READ, is_admin()-gated CRUD. Seeds procede / nao_procede / requer_acao / inconclusivo. FK target of referral_reply.reply_outcome_id.';

-- --- referral code sequence (global ENC-NNNN; PHI-free) -----------------------
CREATE SEQUENCE IF NOT EXISTS "public"."referral_code_seq" AS bigint START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE "public"."referral_code_seq" OWNER TO "postgres";

-- --- case_referral: the message + lifecycle (all PHI-FREE) --------------------
CREATE TABLE IF NOT EXISTS "public"."case_referral" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "source_case_id" "uuid" NOT NULL,
    "source_commission_id" "uuid" NOT NULL,
    "target_commission_id" "uuid" NOT NULL,
    "referral_type_id" "uuid",
    "type_label" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "status" "text" DEFAULT 'rascunho'::"text" NOT NULL,
    "description_md" "text",
    "response_expected" boolean DEFAULT true NOT NULL,
    "target_case_id" "uuid",
    "has_patient" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "sent_at" timestamp with time zone,
    "sent_by" "uuid",
    "received_at" timestamp with time zone,
    "received_by" "uuid",
    "decided_at" timestamp with time zone,
    "decided_by" "uuid",
    "concluded_at" timestamp with time zone,
    "concluded_by" "uuid",
    "withdrawn_at" timestamp with time zone,
    "withdrawn_by" "uuid",
    "decline_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "case_referral_code_not_blank" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "case_referral_subject_not_blank" CHECK (("btrim"("subject") <> ''::"text")),
    CONSTRAINT "case_referral_type_label_not_blank" CHECK (("btrim"("type_label") <> ''::"text")),
    CONSTRAINT "case_referral_distinct_commissions" CHECK (("source_commission_id" <> "target_commission_id")),
    CONSTRAINT "case_referral_status_check" CHECK (("status" = ANY (ARRAY['rascunho'::"text", 'enviada'::"text", 'recebida'::"text", 'aceita'::"text", 'recusada'::"text", 'em_analise'::"text", 'concluida'::"text", 'retirada'::"text"])))
);

ALTER TABLE "public"."case_referral" OWNER TO "postgres";

ALTER TABLE ONLY "public"."case_referral"
    ADD CONSTRAINT "case_referral_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."case_referral"
    ADD CONSTRAINT "case_referral_code_key" UNIQUE ("code");

-- FKs. Cases use ON DELETE NO ACTION for the source (a referred case is not
-- silently destroyed) and SET NULL for B's optional link (Decision 1). Commissions
-- denormalized for RLS; the referral row outlives neither commission in practice
-- (NO ACTION). referral_type_id SET NULL — type_label is snapshotted so the row
-- stays readable across vocab edits/removals.
ALTER TABLE ONLY "public"."case_referral"
    ADD CONSTRAINT "case_referral_source_case_id_fkey" FOREIGN KEY ("source_case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."case_referral"
    ADD CONSTRAINT "case_referral_source_commission_id_fkey" FOREIGN KEY ("source_commission_id") REFERENCES "public"."commissions"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."case_referral"
    ADD CONSTRAINT "case_referral_target_commission_id_fkey" FOREIGN KEY ("target_commission_id") REFERENCES "public"."commissions"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."case_referral"
    ADD CONSTRAINT "case_referral_target_case_id_fkey" FOREIGN KEY ("target_case_id") REFERENCES "public"."cases"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."case_referral"
    ADD CONSTRAINT "case_referral_referral_type_id_fkey" FOREIGN KEY ("referral_type_id") REFERENCES "public"."referral_types"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."case_referral"
    ADD CONSTRAINT "case_referral_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

CREATE INDEX "case_referral_source_case_idx" ON "public"."case_referral" USING "btree" ("source_case_id");
CREATE INDEX "case_referral_target_case_idx" ON "public"."case_referral" USING "btree" ("target_case_id");
CREATE INDEX "case_referral_source_commission_idx" ON "public"."case_referral" USING "btree" ("source_commission_id");
CREATE INDEX "case_referral_target_commission_idx" ON "public"."case_referral" USING "btree" ("target_commission_id");
CREATE INDEX "case_referral_status_idx" ON "public"."case_referral" USING "btree" ("status");

COMMENT ON TABLE "public"."case_referral" IS 'Inter-committee referral message + lifecycle (Phase 22). The list/inbox/dashboard surface (subject/status/code/commission names/dates) is PHI-FREE (Decision 16); list queries select those columns only. The lone PHI-bearing column is description_md, loaded only by the audited detail door (see its own COMMENT). code = global ENC-NNNN. has_patient is the denormalized 0..1 referral_patient flag (a boolean is not PHI).';
COMMENT ON COLUMN "public"."case_referral"."description_md" IS 'PHI-bearing free-text description A wrote on the referral (sanitized Markdown, Rule 7). Loaded ONLY via the audited get_referral_detail door (a non-source-coordinator/non-QPS open emits referral.viewed); NEVER selected on list/hub/dashboard paths and NEVER copied into the audit log (Rule 11).';

-- --- referral_shared_item: frozen snapshot rows B reads ----------------------
CREATE TABLE IF NOT EXISTS "public"."referral_shared_item" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "referral_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "source_narrative_id" "uuid",
    "source_document_id" "uuid",
    "frozen_title" "text",
    "frozen_body_md" "text",
    "frozen_storage_path" "text",
    "frozen_mime_type" "text",
    "frozen_size_bytes" bigint,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "referral_shared_item_kind_check" CHECK (("kind" = ANY (ARRAY['narrative'::"text", 'document'::"text"]))),
    -- One-of shape by kind: a narrative freezes a body_md copy; a document freezes
    -- the storage REFERENCE (Rule 6, never the object).
    CONSTRAINT "referral_shared_item_shape" CHECK (
      (("kind" = 'narrative'::"text") AND ("frozen_body_md" IS NOT NULL) AND ("frozen_storage_path" IS NULL))
      OR (("kind" = 'document'::"text") AND ("frozen_storage_path" IS NOT NULL) AND ("frozen_body_md" IS NULL))
    )
);

ALTER TABLE "public"."referral_shared_item" OWNER TO "postgres";

ALTER TABLE ONLY "public"."referral_shared_item"
    ADD CONSTRAINT "referral_shared_item_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."referral_shared_item"
    ADD CONSTRAINT "referral_shared_item_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "public"."case_referral"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."referral_shared_item"
    ADD CONSTRAINT "referral_shared_item_source_narrative_id_fkey" FOREIGN KEY ("source_narrative_id") REFERENCES "public"."case_narratives"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."referral_shared_item"
    ADD CONSTRAINT "referral_shared_item_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "public"."case_documents"("id") ON DELETE SET NULL;

CREATE INDEX "referral_shared_item_referral_idx" ON "public"."referral_shared_item" USING "btree" ("referral_id");
-- Drives the case_documents storage OR-term lookup (frozen_storage_path = name).
CREATE INDEX "referral_shared_item_storage_path_idx" ON "public"."referral_shared_item" USING "btree" ("frozen_storage_path") WHERE ("frozen_storage_path" IS NOT NULL);

COMMENT ON TABLE "public"."referral_shared_item" IS 'Frozen point-in-time SNAPSHOT rows B reads (Decision 3/9). Decoupled from A''s live case: a narrative freezes a body_md copy, a document freezes the storage REFERENCE (Rule 6 — the object is never re-uploaded). source_*_id are provenance back-pointers (SET NULL on source delete). Immutable once the referral is sent (guard_referral_snapshot_lock).';
COMMENT ON COLUMN "public"."referral_shared_item"."frozen_body_md" IS 'PHI-bearing frozen narrative copy (sanitized Markdown). Loaded ONLY via the audited get_referral_detail door; never on list reads; never copied into the audit log (Rule 11/12).';

-- --- referral_patient: ISOLATED PHI (modeled exactly on event_patient) --------
CREATE TABLE IF NOT EXISTS "public"."referral_patient" (
    "referral_id" "uuid" NOT NULL,
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
    CONSTRAINT "referral_patient_age_nonneg" CHECK ((("age_years" IS NULL) OR ("age_years" >= 0))),
    CONSTRAINT "referral_patient_sex_check" CHECK (("sex" = ANY (ARRAY['female'::"text", 'male'::"text", 'other'::"text", 'unknown'::"text"])))
);

ALTER TABLE "public"."referral_patient" OWNER TO "postgres";

ALTER TABLE ONLY "public"."referral_patient"
    ADD CONSTRAINT "referral_patient_pkey" PRIMARY KEY ("referral_id");
ALTER TABLE ONLY "public"."referral_patient"
    ADD CONSTRAINT "referral_patient_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "public"."case_referral"("id") ON DELETE CASCADE;

COMMENT ON TABLE "public"."referral_patient" IS 'ISOLATED PHI (Rule 12; ADR 0037) — the ONLY place referral patient identifiers live. 0..1 per referral (PK = referral_id). Read via the dedicated AUDITED door only (get_referral_patient → referral_patient.read); direct SELECT is REVOKED from authenticated. NEVER selected on list/dashboard paths (minimum-necessary). Modeled exactly on public.event_patient.';

-- --- referral_reply: the deliverable A receives ------------------------------
CREATE TABLE IF NOT EXISTS "public"."referral_reply" (
    "referral_id" "uuid" NOT NULL,
    "reply_outcome_id" "uuid",
    "outcome_label" "text",
    "result_md" "text",
    "acknowledged_only" boolean DEFAULT false NOT NULL,
    "replied_by" "uuid",
    "replied_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."referral_reply" OWNER TO "postgres";

ALTER TABLE ONLY "public"."referral_reply"
    ADD CONSTRAINT "referral_reply_pkey" PRIMARY KEY ("referral_id");
ALTER TABLE ONLY "public"."referral_reply"
    ADD CONSTRAINT "referral_reply_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "public"."case_referral"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."referral_reply"
    ADD CONSTRAINT "referral_reply_reply_outcome_id_fkey" FOREIGN KEY ("reply_outcome_id") REFERENCES "public"."reply_outcomes"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."referral_reply"
    ADD CONSTRAINT "referral_reply_replied_by_fkey" FOREIGN KEY ("replied_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

COMMENT ON TABLE "public"."referral_reply" IS 'The structured reply B delivers (Decision 10). 0..1 per referral; kept SEPARATE from case_referral so list reads never touch the PHI body. Frozen once replied_at is set (guard_referral_reply_lock). A no-reply-expected referral may conclude with acknowledged_only = true and a null result_md.';
COMMENT ON COLUMN "public"."referral_reply"."result_md" IS 'PHI-bearing result narrative (sanitized Markdown). Loaded ONLY via the audited get_referral_detail door; never on list reads; never copied into the audit log (Rule 11/12).';

-- --- referral_reply_attachment: optional B-side reply files ------------------
CREATE TABLE IF NOT EXISTS "public"."referral_reply_attachment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "referral_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "mime_type" "text",
    "size_bytes" bigint,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "referral_reply_attachment_title_not_blank" CHECK (("btrim"("title") <> ''::"text"))
);

ALTER TABLE "public"."referral_reply_attachment" OWNER TO "postgres";

ALTER TABLE ONLY "public"."referral_reply_attachment"
    ADD CONSTRAINT "referral_reply_attachment_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."referral_reply_attachment"
    ADD CONSTRAINT "referral_reply_attachment_storage_path_key" UNIQUE ("storage_path");
ALTER TABLE ONLY "public"."referral_reply_attachment"
    ADD CONSTRAINT "referral_reply_attachment_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "public"."case_referral"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."referral_reply_attachment"
    ADD CONSTRAINT "referral_reply_attachment_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

CREATE INDEX "referral_reply_attachment_referral_idx" ON "public"."referral_reply_attachment" USING "btree" ("referral_id");

COMMENT ON TABLE "public"."referral_reply_attachment" IS 'Optional B-side reply attachments (Decision 10; PHI-bearing). Immutable: a fresh storage_path per upload (Rule 6), no UPDATE/DELETE. Lives in the referral-attachments bucket; downloaded via the audited get_referral_attachment_url door.';

-- ===========================================================================
-- code default trigger (global ENC-NNNN)
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."set_referral_code"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if new.code is null or btrim(new.code) = '' then
    new.code := 'ENC-' || to_char(nextval('public.referral_code_seq'), 'FM0000');
  end if;
  return new;
end;
$$;

ALTER FUNCTION "app"."set_referral_code"() OWNER TO "postgres";

CREATE TRIGGER "trg_set_referral_code" BEFORE INSERT ON "public"."case_referral"
    FOR EACH ROW EXECUTE FUNCTION "app"."set_referral_code"();

-- ===========================================================================
-- Predicate helpers (app schema; SECURITY DEFINER STABLE so they bypass RLS when
-- called from inside policies / other predicates). REVOKE FROM PUBLIC + grant
-- authenticated/service at the tail.
-- ===========================================================================

-- commission_of_referral: source (provenance) commission, for audit attribution.
CREATE OR REPLACE FUNCTION "app"."commission_of_referral"("p_referral_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select source_commission_id from public.case_referral where id = p_referral_id;
$$;

ALTER FUNCTION "app"."commission_of_referral"("p_referral_id" "uuid") OWNER TO "postgres";

-- can_read_referral: PHI-FREE metadata + snapshot boundary. Source OR target
-- member, OR QPS. A foreign committee reads NOTHING.
CREATE OR REPLACE FUNCTION "app"."can_read_referral"("p_referral_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and (
        app.is_pqs_member(p_uid)
        or app.is_member_of_for(r.source_commission_id, p_uid)
        or app.is_member_of_for(r.target_commission_id, p_uid)
      )
  );
$$;

ALTER FUNCTION "app"."can_read_referral"("p_referral_id" "uuid", "p_uid" "uuid") OWNER TO "postgres";

-- referral_target_analyst: how B's analyst earns PHI access — uid is assigned on
-- a phase/narrative of the referral's target_case_id, or a case_access grantee on
-- it. NULL target_case_id (no link yet) => false (coordinators+QPS only pre-link).
CREATE OR REPLACE FUNCTION "app"."referral_target_analyst"("p_referral_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and r.target_case_id is not null
      and (
        exists (select 1 from public.case_phases cp
                where cp.case_id = r.target_case_id and cp.assigned_to = p_uid)
        or exists (select 1 from public.case_narratives cn
                   where cn.case_id = r.target_case_id and cn.assigned_to = p_uid)
        or exists (select 1 from public.case_access ca
                   where ca.case_id = r.target_case_id and ca.user_id = p_uid)
      )
  );
$$;

ALTER FUNCTION "app"."referral_target_analyst"("p_referral_id" "uuid", "p_uid" "uuid") OWNER TO "postgres";

-- can_read_referral_phi: the TIGHT PHI predicate (mirror can_read_event_patient).
-- QPS OR source/target staff_admin OR target analyst (post-link). Drives the
-- audited PHI door + the snapshot-doc / reply-attachment signed-URL doors.
CREATE OR REPLACE FUNCTION "app"."can_read_referral_phi"("p_referral_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and (
        app.is_pqs_member(p_uid)
        or app.is_staff_admin_of_for(r.source_commission_id, p_uid)
        or app.is_staff_admin_of_for(r.target_commission_id, p_uid)
      )
  )
  or app.referral_target_analyst(p_referral_id, p_uid);
$$;

ALTER FUNCTION "app"."can_read_referral_phi"("p_referral_id" "uuid", "p_uid" "uuid") OWNER TO "postgres";

-- can_manage_referral_source / _target: coordinator authority both ends
-- (Decision 7). Source coord sends/withdraws/curates; target coord
-- receives/accepts/declines/replies. is_admin_for as the global override.
CREATE OR REPLACE FUNCTION "app"."can_manage_referral_source"("p_referral_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and (app.is_staff_admin_of_for(r.source_commission_id, p_uid) or app.is_admin_for(p_uid))
  );
$$;

ALTER FUNCTION "app"."can_manage_referral_source"("p_referral_id" "uuid", "p_uid" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."can_manage_referral_target"("p_referral_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and (app.is_staff_admin_of_for(r.target_commission_id, p_uid) or app.is_admin_for(p_uid))
  );
$$;

ALTER FUNCTION "app"."can_manage_referral_target"("p_referral_id" "uuid", "p_uid" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- Guard triggers (under the app.in_referral_rpc flag; mirror app.in_safety_rpc).
-- ===========================================================================

-- guard_referral_status (HC070): enforce the lifecycle state machine. Any status
-- change must pass through an RPC; the resolved set (concluida/recusada/retirada)
-- is terminal; field edits are frozen once non-draft outside an RPC.
CREATE OR REPLACE FUNCTION "app"."guard_referral_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_referral_rpc', true), 'off') = 'on';
begin
  if tg_op = 'DELETE' then
    -- Only an unsent draft may be deleted, and only via the source-coord DELETE
    -- policy (a cascade from cases/commissions runs as the deleting role; those
    -- FKs are ON DELETE CASCADE and intentionally bypass this guard for cleanup).
    if not v_in_rpc and old.status <> 'rascunho' then
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
      (old.status = 'rascunho'   and new.status in ('enviada', 'retirada'))
      or (old.status = 'enviada'    and new.status in ('recebida', 'retirada'))
      or (old.status = 'recebida'   and new.status in ('aceita', 'recusada', 'retirada'))
      or (old.status = 'aceita'     and new.status in ('em_analise', 'retirada'))
      or (old.status = 'em_analise' and new.status in ('concluida', 'retirada'))
    ) then
      raise exception 'transição de estado de encaminhamento inválida: % -> %', old.status, new.status
        using errcode = 'HC070';
    end if;

    return new;
  end if;

  -- No status change. Under the flag the RPCs are the authority (any field edit
  -- allowed). Outside the flag, freeze a referral that has left rascunho.
  if v_in_rpc then
    return new;
  end if;
  if old.status <> 'rascunho' then
    raise exception 'encaminhamentos enviados são imutáveis fora das RPCs' using errcode = 'HC070';
  end if;
  return new;
end;
$$;

ALTER FUNCTION "app"."guard_referral_status"() OWNER TO "postgres";

-- guard_referral_snapshot_lock (HC073): the snapshot freezes at send. No
-- shared-item INSERT/UPDATE/DELETE once the parent referral is past rascunho
-- (outside an RPC). The send RPC itself runs under the flag to freeze the rows.
CREATE OR REPLACE FUNCTION "app"."guard_referral_snapshot_lock"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_referral_rpc', true), 'off') = 'on';
  v_referral uuid := case when tg_op = 'DELETE' then old.referral_id else new.referral_id end;
  v_status text;
begin
  if v_in_rpc then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  select status into v_status from public.case_referral where id = v_referral;
  -- A parent CASCADE delete (status already gone) leaves v_status NULL — allow it.
  if v_status is not null and v_status <> 'rascunho' then
    raise exception 'o conteúdo compartilhado não pode ser alterado após o envio'
      using errcode = 'HC073';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

ALTER FUNCTION "app"."guard_referral_snapshot_lock"() OWNER TO "postgres";

-- guard_referral_reply_lock (HC070): a delivered reply is immutable. Once
-- replied_at is set, no UPDATE/DELETE outside an RPC.
CREATE OR REPLACE FUNCTION "app"."guard_referral_reply_lock"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_referral_rpc', true), 'off') = 'on';
begin
  if v_in_rpc then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if old.replied_at is not null then
    raise exception 'a resposta concluída é imutável' using errcode = 'HC070';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

ALTER FUNCTION "app"."guard_referral_reply_lock"() OWNER TO "postgres";

-- ===========================================================================
-- Audit triggers (PHI-free metadata — Rule 11). Dark until audit_trail is ON
-- (app.audit_write no-ops while the flag is off).
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."trg_audit_referral"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_cols constant text[] := array['status', 'response_expected', 'target_case_id', 'has_patient'];
  v_action text;
  v_summary text;
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('referral.created', 'referral', new.id, new.source_commission_id,
      'Encaminhamento ' || coalesce(new.code, '') || ' criado',
      app.audit_diff(null, to_jsonb(new), v_cols));
    return null;
  end if;

  -- UPDATE: a status transition is the interesting event; otherwise a metadata edit.
  if new.status is distinct from old.status then
    v_action := 'referral.status_changed';
    v_summary := 'Encaminhamento ' || coalesce(new.code, '') || ': ' || old.status || ' -> ' || new.status;
  else
    v_action := 'referral.updated';
    v_summary := 'Encaminhamento ' || coalesce(new.code, '') || ' atualizado';
  end if;
  perform app.audit_write(v_action, 'referral', new.id, new.source_commission_id,
    v_summary, app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_referral"() OWNER TO "postgres";

-- trg_audit_referral_patient: writes referral_patient.updated with EMPTY metadata
-- (NO identifiers — mirror trg_audit_event_patient). Attributed to the source
-- (provenance) commission.
CREATE OR REPLACE FUNCTION "app"."trg_audit_referral_patient"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_comm uuid;
begin
  v_comm := app.commission_of_referral(new.referral_id);
  perform app.audit_write('referral_patient.updated', 'referral_patient', new.referral_id, v_comm,
    'Dados do paciente do encaminhamento atualizados', '{}'::jsonb);
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_referral_patient"() OWNER TO "postgres";

-- --- trigger bindings --------------------------------------------------------
CREATE TRIGGER "trg_guard_referral_status" BEFORE UPDATE OR DELETE ON "public"."case_referral"
    FOR EACH ROW EXECUTE FUNCTION "app"."guard_referral_status"();
CREATE TRIGGER "trg_audit_referral_aiud" AFTER INSERT OR UPDATE ON "public"."case_referral"
    FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_referral"();

CREATE TRIGGER "trg_guard_referral_snapshot_lock" BEFORE INSERT OR UPDATE OR DELETE ON "public"."referral_shared_item"
    FOR EACH ROW EXECUTE FUNCTION "app"."guard_referral_snapshot_lock"();

CREATE TRIGGER "trg_guard_referral_reply_lock" BEFORE UPDATE OR DELETE ON "public"."referral_reply"
    FOR EACH ROW EXECUTE FUNCTION "app"."guard_referral_reply_lock"();

CREATE TRIGGER "trg_audit_referral_patient_aiu" AFTER INSERT OR UPDATE ON "public"."referral_patient"
    FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_referral_patient"();

-- ===========================================================================
-- RLS — enable on every table + explicit policies.
-- ===========================================================================
ALTER TABLE "public"."referral_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."reply_outcomes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."case_referral" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."referral_shared_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."referral_patient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."referral_reply" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."referral_reply_attachment" ENABLE ROW LEVEL SECURITY;

-- --- vocab: any-auth READ, is_admin CRUD ------------------------------------
CREATE POLICY "referral_types_select_all" ON "public"."referral_types"
  FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "referral_types_write_admin" ON "public"."referral_types"
  FOR ALL TO "authenticated" USING ("app"."is_admin"()) WITH CHECK ("app"."is_admin"());

CREATE POLICY "reply_outcomes_select_all" ON "public"."reply_outcomes"
  FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "reply_outcomes_write_admin" ON "public"."reply_outcomes"
  FOR ALL TO "authenticated" USING ("app"."is_admin"()) WITH CHECK ("app"."is_admin"());

-- --- case_referral ----------------------------------------------------------
CREATE POLICY "case_referral_select_readable" ON "public"."case_referral"
  FOR SELECT TO "authenticated"
  USING ("app"."can_read_referral"("id", "auth"."uid"()));
-- INSERT: source coordinator only. The WITH CHECK cannot call can_manage_referral_source
-- (the row does not exist yet), so it checks staff_admin of the source commission
-- on the NEW row directly.
CREATE POLICY "case_referral_insert_source_coord" ON "public"."case_referral"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    "app"."is_staff_admin_of_for"("source_commission_id", "auth"."uid"())
    or "app"."is_admin_for"("auth"."uid"())
  );
-- UPDATE: either coordinator may write; the status guard enforces WHICH side may
-- drive WHICH transition (the RPCs re-check authority + raise HC071/HC072).
CREATE POLICY "case_referral_update_coord" ON "public"."case_referral"
  FOR UPDATE TO "authenticated"
  USING (
    "app"."can_manage_referral_source"("id", "auth"."uid"())
    or "app"."can_manage_referral_target"("id", "auth"."uid"())
  )
  WITH CHECK (
    "app"."can_manage_referral_source"("id", "auth"."uid"())
    or "app"."can_manage_referral_target"("id", "auth"."uid"())
  );
-- DELETE: only an unsent draft, by the source coordinator (the guard backstops the
-- status, the policy backstops the authority).
CREATE POLICY "case_referral_delete_draft_source" ON "public"."case_referral"
  FOR DELETE TO "authenticated"
  USING (
    "status" = 'rascunho'
    and "app"."can_manage_referral_source"("id", "auth"."uid"())
  );

-- --- referral_shared_item: SELECT readable; writes via RPC (DEFINER) ----------
-- A draft's source coordinator assembles items through the add/remove RPCs (which
-- run as postgres). The SELECT policy lets readers see the metadata; the PHI body
-- is loaded deliberately only by the audited detail RPC.
CREATE POLICY "referral_shared_item_select_readable" ON "public"."referral_shared_item"
  FOR SELECT TO "authenticated"
  USING ("app"."can_read_referral"("referral_id", "auth"."uid"()));

-- --- referral_reply: SELECT readable; writes via RPC -------------------------
CREATE POLICY "referral_reply_select_readable" ON "public"."referral_reply"
  FOR SELECT TO "authenticated"
  USING ("app"."can_read_referral"("referral_id", "auth"."uid"()));

-- --- referral_reply_attachment: SELECT readable; writes via RPC --------------
CREATE POLICY "referral_reply_attachment_select_readable" ON "public"."referral_reply_attachment"
  FOR SELECT TO "authenticated"
  USING ("app"."can_read_referral"("referral_id", "auth"."uid"()));

-- --- referral_patient: NO authenticated policy. Direct DML is REVOKED below;
-- the DEFINER set/get RPCs (run as postgres) are the only door. Exact
-- event_patient posture. (RLS is enabled with zero policies => deny-all for
-- authenticated, which is the intent; DEFINER RPCs bypass it.)

-- ===========================================================================
-- Storage — the referral-attachments bucket + the case-documents snapshot OR-term.
-- ===========================================================================

-- referral-attachments: B-side reply files. Path {target_commission_id}/{referral_id}/{uuid}.{ext}.
-- SELECT keyed on can_read_referral_phi over the path (the same tight predicate as
-- the audited door); INSERT keyed on can_manage_referral_target(seg[2]=referral_id).
-- Immutable (Rule 6) — no UPDATE/DELETE policy.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'referral-attachments',
  'referral-attachments',
  false,
  26214400, -- 25 MiB
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv',
    'text/plain'
  ]
)
on conflict (id) do nothing;

create policy referral_attachments_obj_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'referral-attachments'
    and (
      app.is_admin()
      or app.can_read_referral_phi(((storage.foldername(name))[2])::uuid, auth.uid())
    )
  );

create policy referral_attachments_obj_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'referral-attachments'
    and (
      app.is_admin()
      or app.can_manage_referral_target(((storage.foldername(name))[2])::uuid, auth.uid())
    )
  );

-- case-documents snapshot OR-term (lead-approved, RLS-consistent path). A frozen
-- snapshot DOCUMENT references A's existing case-documents object; B is not a
-- member of A's commission, so the existing case_documents_select_member policy
-- denies it. Add a flag-gated OR-term that grants SELECT when the object is a
-- frozen snapshot document the caller may read at PHI level. The lookup is wrapped
-- in app.can_read_snapshot_document (SECURITY DEFINER) to avoid storage.objects ->
-- referral_shared_item -> (policies) RLS recursion. NO service-role bypass.
CREATE OR REPLACE FUNCTION "app"."can_read_snapshot_document"("p_object_name" "text", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.feature_enabled('case_referrals') and exists (
    select 1
    from public.referral_shared_item rsi
    join public.case_referral r on r.id = rsi.referral_id
    where rsi.kind = 'document'
      and rsi.frozen_storage_path = p_object_name
      and app.can_read_referral_phi(r.id, p_uid)
  );
$$;

ALTER FUNCTION "app"."can_read_snapshot_document"("p_object_name" "text", "p_uid" "uuid") OWNER TO "postgres";

-- Recreate the case-documents SELECT policy with the appended OR-term. (The
-- original lives in 20260620010000_storage.sql; drop+recreate is the additive way
-- to extend a policy forward without editing the prior migration.)
DROP POLICY IF EXISTS "case_documents_select_member" ON "storage"."objects";
CREATE POLICY "case_documents_select_member" ON "storage"."objects"
  FOR SELECT TO "authenticated"
  USING (
    bucket_id = 'case-documents'
    and (
      app.is_admin()
      or app.is_member_of(((storage.foldername(name))[1])::uuid)
      or app.can_read_snapshot_document(name, auth.uid())
    )
  );

-- ===========================================================================
-- Grants + REVOKE. This file carries its own (the 012000 baseline is closed).
-- ===========================================================================

-- --- tables: DML on the 6 non-PHI tables to authenticated/service_role -------
-- (RLS is the row-level boundary; these are the table-level grants the squashed
-- baseline would otherwise auto-emit. referral_patient is deliberately EXCLUDED.)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."referral_types" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."referral_types" TO "service_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."reply_outcomes" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."reply_outcomes" TO "service_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."case_referral" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."case_referral" TO "service_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."referral_shared_item" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."referral_shared_item" TO "service_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."referral_reply" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."referral_reply" TO "service_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."referral_reply_attachment" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."referral_reply_attachment" TO "service_role";

-- --- referral_patient: FULLY RPC-ONLY (exact event_patient posture) ----------
-- ZERO direct authenticated DML. Reads go through the audited get_referral_patient
-- RPC; writes through the set_referral_patient DEFINER (runs as owner postgres);
-- seeds run as superuser. service_role is left intact. RLS already denies anon.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."referral_patient" TO "service_role";
REVOKE ALL PRIVILEGES ON TABLE "public"."referral_patient" FROM "authenticated";

-- --- sequence ---------------------------------------------------------------
GRANT USAGE, SELECT ON SEQUENCE "public"."referral_code_seq" TO "authenticated";
GRANT USAGE, SELECT ON SEQUENCE "public"."referral_code_seq" TO "service_role";

-- --- predicate + assert + probe functions -----------------------------------
REVOKE ALL ON FUNCTION "app"."assert_referrals_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."assert_referrals_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "app"."assert_referrals_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."referrals_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."referrals_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."referrals_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "app"."commission_of_referral"("p_referral_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."commission_of_referral"("p_referral_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."commission_of_referral"("p_referral_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."can_read_referral"("p_referral_id" "uuid", "p_uid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."can_read_referral"("p_referral_id" "uuid", "p_uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."can_read_referral"("p_referral_id" "uuid", "p_uid" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."referral_target_analyst"("p_referral_id" "uuid", "p_uid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."referral_target_analyst"("p_referral_id" "uuid", "p_uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."referral_target_analyst"("p_referral_id" "uuid", "p_uid" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."can_read_referral_phi"("p_referral_id" "uuid", "p_uid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."can_read_referral_phi"("p_referral_id" "uuid", "p_uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."can_read_referral_phi"("p_referral_id" "uuid", "p_uid" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."can_manage_referral_source"("p_referral_id" "uuid", "p_uid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."can_manage_referral_source"("p_referral_id" "uuid", "p_uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."can_manage_referral_source"("p_referral_id" "uuid", "p_uid" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."can_manage_referral_target"("p_referral_id" "uuid", "p_uid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."can_manage_referral_target"("p_referral_id" "uuid", "p_uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."can_manage_referral_target"("p_referral_id" "uuid", "p_uid" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."can_read_snapshot_document"("p_object_name" "text", "p_uid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."can_read_snapshot_document"("p_object_name" "text", "p_uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."can_read_snapshot_document"("p_object_name" "text", "p_uid" "uuid") TO "service_role";

-- trigger functions: revoke EXECUTE from PUBLIC (defense in depth; they are only
-- ever fired by the triggers, never called directly).
REVOKE ALL ON FUNCTION "app"."set_referral_code"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "app"."guard_referral_status"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "app"."guard_referral_snapshot_lock"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "app"."guard_referral_reply_lock"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "app"."trg_audit_referral"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "app"."trg_audit_referral_patient"() FROM PUBLIC;

-- ===========================================================================
-- Feature flag — ships OFF (the E2E suite flips it ON, like audit_trail/case_access).
-- ===========================================================================
INSERT INTO "app"."feature_flags" ("key", "enabled", "description")
VALUES ('case_referrals', false, 'When true, Inter-Committee Case Referrals (Phase 22) are live: a committee sends a frozen point-in-time SNAPSHOT of a case to another committee as a Notification or Analysis Request, the target replies (structured outcome + result, optional linked case), QPS gets the cross-commission macro view, and a source case stays unconcludable while an expected reply is in flight (close_case HC076). Referrals MAY carry isolated PHI on referral_patient behind the audited single-door (Rule 12; ADR 0037). Ships OFF; enabled at Phase 22 completion.')
ON CONFLICT ("key") DO NOTHING;

-- ===========================================================================
-- Reference vocabularies (seeded; admin-managed, hospital-wide). Like
-- pqs_event_types in 20260620011000_seed_vocab.sql, these are config the app needs
-- in EVERY environment (incl. prod), so they ship in the migration, not seed.sql.
-- The demo referrals (E2E fixtures) live in supabase/seed.sql (task P22-008).
-- ===========================================================================
INSERT INTO "public"."referral_types" ("key", "label", "description", "color_token", "default_response_expected", "position", "is_active") VALUES
  ('parecer',      'Parecer',                  'Solicitação de parecer técnico a outra comissão.', 'info',    true,  1, true),
  ('auditoria',    'Auditoria',                'Solicitação de auditoria de prontuário / processo.', 'warning', true,  2, true),
  ('investigacao', 'Investigação conjunta',    'Solicitação de investigação conjunta de um caso.', 'accent',  true,  3, true),
  ('ciencia',      'Ciência / Notificação',    'Encaminhamento apenas para ciência (sem resposta esperada).', 'muted', false, 4, true)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "public"."reply_outcomes" ("key", "label", "description", "color_token", "position", "is_active") VALUES
  ('procede',      'Procede',          'A análise confirma a procedência do encaminhamento.', 'success',     1, true),
  ('nao_procede',  'Não procede',      'A análise não confirma a procedência do encaminhamento.', 'muted',    2, true),
  ('requer_acao',  'Requer ação',      'A análise indica a necessidade de ação corretiva.', 'warning',       3, true),
  ('inconclusivo', 'Inconclusivo',     'A análise foi inconclusiva.', 'destructive',                          4, true)
ON CONFLICT ("key") DO NOTHING;
