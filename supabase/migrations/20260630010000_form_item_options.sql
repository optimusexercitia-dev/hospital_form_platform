-- ----------------------------------------------------------------------------
-- form-model-normalization (BE-2) — normalize choice options + answer selections
-- ----------------------------------------------------------------------------
-- The form data model leaned on JSONB for two things that outgrew it:
--   * form_items.options — an array of bare strings OR {label,color} objects.
--   * answers.value (choice items) — the chosen option's LABEL string (checkbox =
--     an array of label strings).
-- Consequence: an option's IDENTITY was its label. Renaming a label fragmented
-- historical analytics and could break conditions. There was nowhere to hang
-- per-option metadata (scores, analytics codes, stable ids, ordering).
--
-- This migration introduces the normalized model (ADR drafted with the refactor
-- plan; precedent: phase_results — a normalized stable-id/colour/score/ordering
-- vocabulary):
--   * public.form_item_options — per-question, version-scoped option rows with a
--     stable hidden `code` (the analytics/condition identity), label, colour,
--     nullable score, free-text analytics_code, and ordering. Cloned + frozen with
--     the version.
--   * public.answer_selected_options — one row per selected option (hard FK to the
--     option row). Choice answers move here; answers.value becomes scalars-only.
--
-- This is an ADDITIVE migration (forward-only). The squash to a single clean
-- baseline is the FINAL packaging step (BE-7), a schema dump of the fully-migrated
-- local DB — NOT done here. The downstream RPC rewrites (answer_map,
-- save_section_answers, submit_response, clone_form_version, dashboards) and the
-- publish-time validations land in BE-3…BE-6.
--
-- EVALUATOR NON-DRIFT (ARCHITECTURE Rule 3): this migration does NOT touch
-- app.eval_condition / app.eval_visibility nor the shared __fixtures__ vectors.
-- The answer_map rewrite (BE-3) reconstructs the SAME question_key -> code(s)
-- shapes from the two tables, so the evaluator is unaffected.
--
-- RLS (Rule 1): form_item_options mirrors form_items (member-read /
-- staff_admin-write via app.commission_of_version, with the org-admin clause from
-- the multitenancy RLS rewrite). answer_selected_options mirrors answers
-- (own-draft write; submitted-immutable; org_admin/submitted-staff_admin read).
-- ----------------------------------------------------------------------------

SET check_function_bodies = false;
SET client_min_messages = warning;

-- ===========================================================================
-- DROP the old options-jsonb machinery on form_items.
-- The four columns/constraints + the shape validator are superseded by the
-- normalized rows. "A choice item needs >= 1 option" moves to publish-time
-- validation (BE-5). No data migration: pre-launch, the squash baseline (BE-7)
-- is authoritative, and a local `db reset` + re-seed re-creates the rows.
-- ===========================================================================
ALTER TABLE "public"."form_items" DROP CONSTRAINT IF EXISTS "form_items_options_shape";

-- input-vs-display CHECK still references `options` (display branch asserts it is
-- NULL). Re-state it WITHOUT the options clause before dropping the column.
ALTER TABLE "public"."form_items" DROP CONSTRAINT IF EXISTS "form_items_input_vs_display";
ALTER TABLE "public"."form_items" ADD CONSTRAINT "form_items_input_vs_display" CHECK (
  CASE
    WHEN "item_type" = ANY (ARRAY[
      'multiple_choice'::"text", 'dropdown'::"text", 'checkbox'::"text", 'free_text'::"text",
      'short_text'::"text", 'number'::"text", 'date'::"text", 'time'::"text"
    ])
      THEN ("question_key" IS NOT NULL AND "label" IS NOT NULL AND "content" IS NULL)
    WHEN "item_type" = ANY (ARRAY['section_text'::"text", 'image'::"text"])
      THEN ("content" IS NOT NULL AND "question_key" IS NULL AND "label" IS NULL
            AND "question_explanation" IS NULL AND "required" = false)
    ELSE NULL::boolean
  END
);

ALTER TABLE "public"."form_items" DROP COLUMN IF EXISTS "options";

-- The jsonb-shape validator is now unused.
DROP FUNCTION IF EXISTS "app"."is_valid_options"("jsonb");

-- ===========================================================================
-- form_item_options — version-scoped, immutable-code option rows.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS "public"."form_item_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    -- Denormalized version id (mirror form_items.form_version_id): synced by a
    -- BEFORE INSERT/UPDATE trigger so RLS + the published-structure guard key on
    -- it without a join.
    "form_version_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    -- The stable analytics/condition identity: auto slug(label)+suffix, hidden,
    -- immutable, unique per item. Conditions/recommend_when/result_ruleset and
    -- dashboards key on THIS (survives cloning).
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "color_token" "text",
    "score" numeric,
    "analytics_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "form_item_options_code_not_blank" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "form_item_options_label_not_blank" CHECK (("btrim"("label") <> ''::"text")),
    -- Mirror phase_results_color_token_check (the shared 7-token palette).
    CONSTRAINT "form_item_options_color_token_check" CHECK (
      ("color_token" IS NULL) OR ("color_token" = ANY (ARRAY[
        'muted'::"text", 'slate'::"text", 'blue'::"text", 'amber'::"text",
        'green'::"text", 'red'::"text", 'violet'::"text"
      ]))
    )
);

ALTER TABLE "public"."form_item_options" OWNER TO "postgres";

ALTER TABLE ONLY "public"."form_item_options"
    ADD CONSTRAINT "form_item_options_pkey" PRIMARY KEY ("id");

-- Ordering within the item; deferrable to tolerate transient overlap in a
-- single-statement reorder (mirrors form_items_section_id_position_key).
ALTER TABLE ONLY "public"."form_item_options"
    ADD CONSTRAINT "form_item_options_item_id_position_key" UNIQUE ("item_id", "position") DEFERRABLE;

-- The code is unique per item (the analytics identity within a question).
ALTER TABLE ONLY "public"."form_item_options"
    ADD CONSTRAINT "form_item_options_item_id_code_key" UNIQUE ("item_id", "code");

ALTER TABLE ONLY "public"."form_item_options"
    ADD CONSTRAINT "form_item_options_item_id_fkey" FOREIGN KEY ("item_id")
    REFERENCES "public"."form_items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."form_item_options"
    ADD CONSTRAINT "form_item_options_form_version_id_fkey" FOREIGN KEY ("form_version_id")
    REFERENCES "public"."form_versions"("id") ON DELETE CASCADE;

CREATE INDEX "form_item_options_item_idx" ON "public"."form_item_options" USING "btree" ("item_id");
CREATE INDEX "form_item_options_version_idx" ON "public"."form_item_options" USING "btree" ("form_version_id");

COMMENT ON TABLE "public"."form_item_options" IS 'Normalized per-question choice options (form-model-normalization). Version-scoped, cloned + frozen with the version. `code` is the stable hidden analytics/condition identity (conditions/recommend_when/result_ruleset + dashboards key on it); `label` is the renameable display text. Only choice item_types (multiple_choice/dropdown/checkbox) own rows.';
COMMENT ON COLUMN "public"."form_item_options"."code" IS 'Auto slug(label)+suffix, immutable (trg_form_item_options_code_immutable), unique per item. The clone-stable analytics/condition identity — NEVER rewritten, copied verbatim on clone.';
COMMENT ON COLUMN "public"."form_item_options"."analytics_code" IS 'Optional author-facing free-text cross-form tagging hook (greenfield indicator engine). No managed vocabulary yet.';

-- ---------------------------------------------------------------------------
-- Trigger: sync form_version_id from the parent item (mirror form_items_sync_version).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."form_item_options_sync_version"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_item_version uuid;
begin
  select form_version_id into v_item_version
  from public.form_items
  where id = new.item_id;

  if v_item_version is null then
    raise exception 'form_item_options.item_id % does not exist', new.item_id;
  end if;

  new.form_version_id := v_item_version;
  return new;
end;
$$;

ALTER FUNCTION "public"."form_item_options_sync_version"() OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "form_item_options_sync_version_trg"
  BEFORE INSERT OR UPDATE OF "item_id" ON "public"."form_item_options"
  FOR EACH ROW EXECUTE FUNCTION "public"."form_item_options_sync_version"();

-- ---------------------------------------------------------------------------
-- Trigger: only CHOICE item types may own option rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."form_item_options_parent_is_choice"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_item_type text;
begin
  select item_type into v_item_type
  from public.form_items
  where id = new.item_id;

  if v_item_type is null then
    raise exception 'form_item_options.item_id % does not exist', new.item_id;
  end if;

  if v_item_type <> all (array['multiple_choice','dropdown','checkbox']) then
    raise exception 'cannot add an option to a non-choice item % (type %)',
      new.item_id, v_item_type
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

ALTER FUNCTION "public"."form_item_options_parent_is_choice"() OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "form_item_options_parent_is_choice_trg"
  BEFORE INSERT OR UPDATE OF "item_id" ON "public"."form_item_options"
  FOR EACH ROW EXECUTE FUNCTION "public"."form_item_options_parent_is_choice"();

-- ---------------------------------------------------------------------------
-- Trigger: the `code` is IMMUTABLE once set (the analytics identity). Fires only
-- on UPDATE OF code, and raises only on an actual change — a no-op rewrite of the
-- same value is tolerated. The clone path is a pure INSERT, so this never fires
-- on it (codes are copied verbatim); label/color_token/score/analytics_code stay
-- freely editable on draft rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."form_item_options_code_immutable"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
begin
  if new.code is distinct from old.code then
    raise exception 'o código da opção é imutável e não pode ser alterado'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

ALTER FUNCTION "public"."form_item_options_code_immutable"() OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "form_item_options_code_immutable_trg"
  BEFORE UPDATE OF "code" ON "public"."form_item_options"
  FOR EACH ROW EXECUTE FUNCTION "public"."form_item_options_code_immutable"();

-- ---------------------------------------------------------------------------
-- Trigger: published-structure immutability. Reuse the existing guard, which
-- keys on form_version_id (already present on the row) and blocks any
-- insert/update/delete to a non-draft version's structure.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER "guard_published_options_trg"
  BEFORE INSERT OR DELETE OR UPDATE ON "public"."form_item_options"
  FOR EACH ROW EXECUTE FUNCTION "public"."guard_published_structure"();

-- ---------------------------------------------------------------------------
-- RLS — member-read / staff_admin-write, mirroring the CURRENT (post-
-- multitenancy-rewrite) form_items policies: the org-admin clause replaces the
-- old is_admin() one.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."form_item_options" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "form_item_options_select" ON "public"."form_item_options"
  FOR SELECT TO "authenticated"
  USING ((
    "app"."is_member_of"("app"."commission_of_version"("form_version_id"))
    OR "app"."is_org_admin_of_commission"("app"."commission_of_version"("form_version_id"))
  ));

CREATE POLICY "form_item_options_staff_admin_write" ON "public"."form_item_options"
  TO "authenticated"
  USING ((
    "app"."is_staff_admin_of"("app"."commission_of_version"("form_version_id"))
    OR "app"."is_org_admin_of_commission"("app"."commission_of_version"("form_version_id"))
  ))
  WITH CHECK ((
    "app"."is_staff_admin_of"("app"."commission_of_version"("form_version_id"))
    OR "app"."is_org_admin_of_commission"("app"."commission_of_version"("form_version_id"))
  ));

GRANT ALL ON TABLE "public"."form_item_options" TO "authenticated";
GRANT ALL ON TABLE "public"."form_item_options" TO "service_role";

REVOKE ALL ON FUNCTION "public"."form_item_options_sync_version"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."form_item_options_sync_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."form_item_options_sync_version"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."form_item_options_parent_is_choice"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."form_item_options_parent_is_choice"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."form_item_options_parent_is_choice"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."form_item_options_code_immutable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."form_item_options_code_immutable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."form_item_options_code_immutable"() TO "service_role";

-- ===========================================================================
-- answer_selected_options — one row per selected option (hard FK to the row).
-- ===========================================================================
CREATE TABLE IF NOT EXISTS "public"."answer_selected_options" (
    "response_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "option_id" "uuid" NOT NULL
);

ALTER TABLE "public"."answer_selected_options" OWNER TO "postgres";

ALTER TABLE ONLY "public"."answer_selected_options"
    ADD CONSTRAINT "answer_selected_options_pkey" PRIMARY KEY ("response_id", "item_id", "option_id");

ALTER TABLE ONLY "public"."answer_selected_options"
    ADD CONSTRAINT "answer_selected_options_response_id_fkey" FOREIGN KEY ("response_id")
    REFERENCES "public"."responses"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."answer_selected_options"
    ADD CONSTRAINT "answer_selected_options_item_id_fkey" FOREIGN KEY ("item_id")
    REFERENCES "public"."form_items"("id");

-- Hard FK to the option row (instance data, decision #8). ON DELETE CASCADE: an
-- option deleted from a DRAFT (the only place options are mutable) drops any
-- selections referencing it; submitted responses live on PUBLISHED (immutable)
-- versions whose options can never be deleted, so this never silently mutates a
-- submitted answer.
ALTER TABLE ONLY "public"."answer_selected_options"
    ADD CONSTRAINT "answer_selected_options_option_id_fkey" FOREIGN KEY ("option_id")
    REFERENCES "public"."form_item_options"("id") ON DELETE CASCADE;

CREATE INDEX "answer_selected_options_response_idx" ON "public"."answer_selected_options" USING "btree" ("response_id");
CREATE INDEX "answer_selected_options_option_idx" ON "public"."answer_selected_options" USING "btree" ("option_id");

COMMENT ON TABLE "public"."answer_selected_options" IS 'Normalized choice-answer selections (form-model-normalization): one row per selected option, hard FK to form_item_options. Order resolved by option.position (no stored order). Single-select items have one row; checkbox zero-or-more. answers.value stays NULL for choice items. RLS mirrors answers.';

-- ---------------------------------------------------------------------------
-- Trigger: a selection's option_id must belong to the SAME item, and the item
-- must be a CHOICE input (rejects a selection on a display item or a mismatched
-- option). Mirrors reject_answer_on_display_item but stricter (also binds the
-- option to the item).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."reject_invalid_selection"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_item_type text;
  v_option_item uuid;
begin
  select item_type into v_item_type
  from public.form_items
  where id = new.item_id;

  if v_item_type is null then
    raise exception 'answer_selected_options.item_id % does not exist', new.item_id;
  end if;

  if v_item_type = any (array['section_text','image']) then
    raise exception 'cannot record a selection for display item % (type %)',
      new.item_id, v_item_type
      using errcode = 'check_violation';
  end if;

  -- The selected option must belong to THIS item (defence; the FK only proves the
  -- option exists, not that it belongs to item_id).
  select item_id into v_option_item
  from public.form_item_options
  where id = new.option_id;

  if v_option_item is distinct from new.item_id then
    raise exception 'a opção % não pertence ao item %', new.option_id, new.item_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

ALTER FUNCTION "public"."reject_invalid_selection"() OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "reject_invalid_selection_trg"
  BEFORE INSERT OR UPDATE ON "public"."answer_selected_options"
  FOR EACH ROW EXECUTE FUNCTION "public"."reject_invalid_selection"();

-- ---------------------------------------------------------------------------
-- Trigger: submitted-response immutability. Reuse the existing guard_submitted_
-- children (keys on response_id, tolerates writes inside the submit RPC via the
-- app.in_submit_rpc GUC).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER "guard_submitted_selections_trg"
  BEFORE INSERT OR DELETE OR UPDATE ON "public"."answer_selected_options"
  FOR EACH ROW EXECUTE FUNCTION "public"."guard_submitted_children"();

-- ---------------------------------------------------------------------------
-- RLS — mirror answers: own-draft write; submitted-immutable; read = own /
-- org_admin / (submitted + staff_admin). The own-draft policy uses the CURRENT
-- answers_write_own_draft shape (creator + in_progress; no admin clause needed —
-- it is creator-scoped).
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."answer_selected_options" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "answer_selected_options_select" ON "public"."answer_selected_options"
  FOR SELECT TO "authenticated"
  USING ((EXISTS ( SELECT 1
     FROM "public"."responses" "r"
    WHERE (("r"."id" = "answer_selected_options"."response_id")
      AND (("r"."created_by" = "auth"."uid"())
        OR "app"."is_org_admin_of_commission"("r"."commission_id")
        OR (("r"."status" = 'submitted'::"text") AND "app"."is_staff_admin_of"("r"."commission_id")))))));

CREATE POLICY "answer_selected_options_write_own_draft" ON "public"."answer_selected_options"
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
     FROM "public"."responses" "r"
    WHERE (("r"."id" = "answer_selected_options"."response_id")
      AND ("r"."created_by" = "auth"."uid"())
      AND ("r"."status" = 'in_progress'::"text")))))
  WITH CHECK ((EXISTS ( SELECT 1
     FROM "public"."responses" "r"
    WHERE (("r"."id" = "answer_selected_options"."response_id")
      AND ("r"."created_by" = "auth"."uid"())
      AND ("r"."status" = 'in_progress'::"text")))));

GRANT ALL ON TABLE "public"."answer_selected_options" TO "authenticated";
GRANT ALL ON TABLE "public"."answer_selected_options" TO "service_role";

REVOKE ALL ON FUNCTION "public"."reject_invalid_selection"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reject_invalid_selection"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_invalid_selection"() TO "service_role";
