-- ----------------------------------------------------------------------------
-- Consolidated baseline — forms
-- ----------------------------------------------------------------------------
SET check_function_bodies = false;
SET client_min_messages = warning;

CREATE OR REPLACE FUNCTION "public"."clone_form_version"("p_source_version_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_form_id uuid;
  v_existing_draft uuid;
  v_new_version_id uuid;
  v_next_number integer;
  v_uid uuid := auth.uid();
begin
  select form_id into v_form_id
  from public.form_versions
  where id = p_source_version_id;

  if v_form_id is null then
    raise exception 'versão % não encontrada', p_source_version_id
      using errcode = 'no_data_found';
  end if;

  -- One editable draft per form: if one exists, hand it back untouched.
  select id into v_existing_draft
  from public.form_versions
  where form_id = v_form_id and status = 'draft'
  limit 1;

  if v_existing_draft is not null then
    return v_existing_draft;
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next_number
  from public.form_versions
  where form_id = v_form_id;

  insert into public.form_versions (form_id, version_number, status, created_by)
  values (v_form_id, v_next_number, 'draft', v_uid)
  returning id into v_new_version_id;

  -- Copy sections, capturing the old->new id remap in a temp table so the item
  -- copy can rewrite section_id in a single set-based statement. A temp table
  -- (rather than a writable CTE) keeps the section INSERT and its BEFORE-INSERT
  -- triggers fully evaluated before the item copy reads the map.
  create temp table _clone_section_map (old_id uuid, new_id uuid) on commit drop;

  with src as (
    select id, position, title, description, is_default,
           visible_when, requires_signoff, signoff_role
    from public.form_sections
    where form_version_id = p_source_version_id
  ),
  ins as (
    insert into public.form_sections (
      form_version_id, position, title, description, is_default,
      visible_when, requires_signoff, signoff_role
    )
    select v_new_version_id, position, title, description, is_default,
           visible_when, requires_signoff, signoff_role
    from src
    order by position
    returning id, position
  )
  insert into _clone_section_map (old_id, new_id)
  select src.id, ins.id
  from src
  join ins on ins.position = src.position;

  -- Copy items into the remapped sections. form_version_id is omitted: the
  -- form_items_sync_version_trg fills it from the (new) section. position /
  -- question_key / content etc. are preserved verbatim.
  insert into public.form_items (
    section_id, position, item_type,
    question_key, label, question_explanation, options, required, content
  )
  select m.new_id, i.position, i.item_type,
         i.question_key, i.label, i.question_explanation, i.options, i.required, i.content
  from public.form_items i
  join public.form_sections s on s.id = i.section_id
  join _clone_section_map m on m.old_id = i.section_id
  where s.form_version_id = p_source_version_id;

  drop table _clone_section_map;

  return v_new_version_id;
end;
$$;

ALTER FUNCTION "public"."clone_form_version"("p_source_version_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_form"("p_commission_id" "uuid", "p_title" "text", "p_description" "text" DEFAULT NULL::"text") RETURNS TABLE("form_id" "uuid", "version_id" "uuid")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_form_id uuid;
  v_version_id uuid;
  v_uid uuid := auth.uid();
begin
  insert into public.forms (commission_id, title, description, created_by)
  values (p_commission_id, p_title, p_description, v_uid)
  returning id into v_form_id;

  insert into public.form_versions (form_id, version_number, status, created_by)
  values (v_form_id, 1, 'draft', v_uid)
  returning id into v_version_id;

  -- The default section: a plain container (is_default = true forces title /
  -- visible_when / requires_signoff to their empty shape via the table CHECK).
  insert into public.form_sections (form_version_id, position, is_default)
  values (v_version_id, 0, true);

  form_id := v_form_id;
  version_id := v_version_id;
  return next;
end;
$$;

ALTER FUNCTION "public"."create_form"("p_commission_id" "uuid", "p_title" "text", "p_description" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."delete_section_moving_items"("p_section_id" "uuid", "p_target_section_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_source_version uuid;
  v_target_version uuid;
  v_base integer;
begin
  if p_section_id = p_target_section_id then
    raise exception 'a seção de destino deve ser diferente da seção excluída'
      using errcode = 'check_violation';
  end if;

  select form_version_id into v_source_version
  from public.form_sections where id = p_section_id;
  select form_version_id into v_target_version
  from public.form_sections where id = p_target_section_id;

  if v_source_version is null or v_target_version is null then
    raise exception 'seção não encontrada' using errcode = 'no_data_found';
  end if;

  if v_source_version <> v_target_version then
    raise exception 'as seções pertencem a versões diferentes'
      using errcode = 'check_violation';
  end if;

  -- Append after the target's current max position. row_number() gives each
  -- moved item a distinct, contiguous slot in a single UPDATE (the deferrable
  -- unique constraint tolerates any transient overlap within the statement).
  select coalesce(max(position), -1) into v_base
  from public.form_items where section_id = p_target_section_id;

  update public.form_items i
  set section_id = p_target_section_id,
      position = v_base + ranked.rn
  from (
    select id, row_number() over (order by position) as rn
    from public.form_items
    where section_id = p_section_id
  ) ranked
  where i.id = ranked.id;

  -- The source section is now empty; delete it (guard_default_section_delete
  -- still blocks the only default section).
  delete from public.form_sections where id = p_section_id;
end;
$$;

ALTER FUNCTION "public"."delete_section_moving_items"("p_section_id" "uuid", "p_target_section_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."form_items_sync_version"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_section_version uuid;
begin
  select form_version_id into v_section_version
  from public.form_sections
  where id = new.section_id;

  if v_section_version is null then
    raise exception 'form_items.section_id % does not exist', new.section_id;
  end if;

  new.form_version_id := v_section_version;
  return new;
end;
$$;

ALTER FUNCTION "public"."form_items_sync_version"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."guard_default_section_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_remaining integer;
begin
  if old.is_default then
    select count(*) into v_remaining
    from public.form_sections
    where form_version_id = old.form_version_id
      and id <> old.id;

    if v_remaining = 0 then
      raise exception
        'cannot delete the default section while it is the only section of its version'
        using errcode = 'check_violation';
    end if;
  end if;
  return old;
end;
$$;

ALTER FUNCTION "public"."guard_default_section_delete"() OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."form_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "published_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "form_versions_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);

ALTER TABLE "public"."form_versions" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reorder_item"("p_item_id" "uuid", "p_direction" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_section_id uuid;
  v_position integer;
  v_neighbor_id uuid;
  v_neighbor_position integer;
begin
  if p_direction not in ('up', 'down') then
    raise exception 'direção inválida: %', p_direction using errcode = 'check_violation';
  end if;

  select section_id, position into v_section_id, v_position
  from public.form_items
  where id = p_item_id;

  if v_section_id is null then
    raise exception 'item % não encontrado', p_item_id using errcode = 'no_data_found';
  end if;

  if p_direction = 'up' then
    select id, position into v_neighbor_id, v_neighbor_position
    from public.form_items
    where section_id = v_section_id and position < v_position
    order by position desc
    limit 1;
  else
    select id, position into v_neighbor_id, v_neighbor_position
    from public.form_items
    where section_id = v_section_id and position > v_position
    order by position asc
    limit 1;
  end if;

  if v_neighbor_id is null then
    return;
  end if;

  update public.form_items
  set position = case id
                   when p_item_id then v_neighbor_position
                   when v_neighbor_id then v_position
                 end
  where id in (p_item_id, v_neighbor_id);
end;
$$;

ALTER FUNCTION "public"."reorder_item"("p_item_id" "uuid", "p_direction" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reorder_section"("p_section_id" "uuid", "p_direction" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_version_id uuid;
  v_position integer;
  v_neighbor_id uuid;
  v_neighbor_position integer;
begin
  if p_direction not in ('up', 'down') then
    raise exception 'direção inválida: %', p_direction using errcode = 'check_violation';
  end if;

  select form_version_id, position into v_version_id, v_position
  from public.form_sections
  where id = p_section_id;

  if v_version_id is null then
    raise exception 'seção % não encontrada', p_section_id using errcode = 'no_data_found';
  end if;

  -- Find the immediate neighbour in the requested direction within the version.
  if p_direction = 'up' then
    select id, position into v_neighbor_id, v_neighbor_position
    from public.form_sections
    where form_version_id = v_version_id and position < v_position
    order by position desc
    limit 1;
  else
    select id, position into v_neighbor_id, v_neighbor_position
    from public.form_sections
    where form_version_id = v_version_id and position > v_position
    order by position asc
    limit 1;
  end if;

  -- Boundary: nothing to swap with.
  if v_neighbor_id is null then
    return;
  end if;

  -- Single-statement swap; the deferrable constraint tolerates the transient
  -- duplicate within the statement.
  update public.form_sections
  set position = case id
                   when p_section_id then v_neighbor_position
                   when v_neighbor_id then v_position
                 end
  where id in (p_section_id, v_neighbor_id);
end;
$$;

ALTER FUNCTION "public"."reorder_section"("p_section_id" "uuid", "p_direction" "text") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."form_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "section_id" "uuid" NOT NULL,
    "form_version_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "item_type" "text" NOT NULL,
    "question_key" "text",
    "label" "text",
    "question_explanation" "text",
    "options" "jsonb",
    "required" boolean DEFAULT false NOT NULL,
    "content" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "form_items_input_vs_display" CHECK (
CASE
    WHEN ("item_type" = ANY (ARRAY['multiple_choice'::"text", 'dropdown'::"text", 'checkbox'::"text", 'free_text'::"text"])) THEN (("question_key" IS NOT NULL) AND ("label" IS NOT NULL) AND ("content" IS NULL))
    WHEN ("item_type" = ANY (ARRAY['section_text'::"text", 'image'::"text"])) THEN (("content" IS NOT NULL) AND ("question_key" IS NULL) AND ("label" IS NULL) AND ("options" IS NULL) AND ("question_explanation" IS NULL) AND ("required" = false))
    ELSE NULL::boolean
END),
    CONSTRAINT "form_items_item_type_check" CHECK (("item_type" = ANY (ARRAY['multiple_choice'::"text", 'dropdown'::"text", 'checkbox'::"text", 'free_text'::"text", 'section_text'::"text", 'image'::"text"]))),
    CONSTRAINT "form_items_options_shape" CHECK (
CASE
    WHEN ("item_type" = ANY (ARRAY['multiple_choice'::"text", 'dropdown'::"text", 'checkbox'::"text"])) THEN (("jsonb_typeof"("options") = 'array'::"text") AND ("jsonb_array_length"("options") > 0))
    WHEN ("item_type" = 'free_text'::"text") THEN ("options" IS NULL)
    ELSE true
END)
);

ALTER TABLE "public"."form_items" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."form_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_version_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "title" "text",
    "description" "text",
    "is_default" boolean DEFAULT false NOT NULL,
    "visible_when" "jsonb",
    "requires_signoff" boolean DEFAULT false NOT NULL,
    "signoff_role" "text",
    CONSTRAINT "form_sections_default_shape" CHECK (((NOT "is_default") OR (("visible_when" IS NULL) AND ("requires_signoff" = false)))),
    CONSTRAINT "form_sections_signoff_role" CHECK ((("requires_signoff" AND ("signoff_role" IS NOT NULL)) OR ((NOT "requires_signoff") AND ("signoff_role" IS NULL)))),
    CONSTRAINT "form_sections_signoff_role_check" CHECK (("signoff_role" = ANY (ARRAY['respondent'::"text", 'staff_admin'::"text"]))),
    CONSTRAINT "form_sections_visible_when_shape" CHECK ((("visible_when" IS NULL) OR (("jsonb_typeof"("visible_when") = 'object'::"text") AND ("visible_when" ? 'question_key'::"text") AND ("visible_when" ? 'op'::"text") AND ("visible_when" ? 'value'::"text") AND (("visible_when" ->> 'op'::"text") = ANY (ARRAY['equals'::"text", 'not_equals'::"text", 'in'::"text"])) AND ("jsonb_typeof"(("visible_when" -> 'question_key'::"text")) = 'string'::"text"))))
);

ALTER TABLE "public"."form_sections" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."forms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "commission_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."forms" OWNER TO "postgres";

COMMENT ON CONSTRAINT "form_sections_default_shape" ON "public"."form_sections" IS 'The default (anchor) section may carry a title but never a visibility condition or a sign-off requirement: it is always first, so it cannot reference an earlier answer, and sign-off on the anchor is out of scope.';

ALTER TABLE ONLY "public"."form_items"
    ADD CONSTRAINT "form_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."form_items"
    ADD CONSTRAINT "form_items_section_id_position_key" UNIQUE ("section_id", "position") DEFERRABLE;

ALTER TABLE ONLY "public"."form_sections"
    ADD CONSTRAINT "form_sections_form_version_id_position_key" UNIQUE ("form_version_id", "position") DEFERRABLE;

ALTER TABLE ONLY "public"."form_sections"
    ADD CONSTRAINT "form_sections_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."form_versions"
    ADD CONSTRAINT "form_versions_form_id_version_number_key" UNIQUE ("form_id", "version_number");

ALTER TABLE ONLY "public"."form_versions"
    ADD CONSTRAINT "form_versions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."form_items"
    ADD CONSTRAINT "form_items_form_version_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "public"."form_versions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."form_items"
    ADD CONSTRAINT "form_items_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."form_sections"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."form_sections"
    ADD CONSTRAINT "form_sections_form_version_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "public"."form_versions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."form_versions"
    ADD CONSTRAINT "form_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."form_versions"
    ADD CONSTRAINT "form_versions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

CREATE UNIQUE INDEX "form_items_question_key_per_version_idx" ON "public"."form_items" USING "btree" ("form_version_id", "question_key") WHERE ("question_key" IS NOT NULL);

CREATE INDEX "form_items_section_idx" ON "public"."form_items" USING "btree" ("section_id");

CREATE INDEX "form_items_version_idx" ON "public"."form_items" USING "btree" ("form_version_id");

CREATE UNIQUE INDEX "form_sections_one_default_idx" ON "public"."form_sections" USING "btree" ("form_version_id") WHERE "is_default";

CREATE INDEX "form_sections_version_idx" ON "public"."form_sections" USING "btree" ("form_version_id");

CREATE INDEX "form_versions_form_idx" ON "public"."form_versions" USING "btree" ("form_id");

CREATE UNIQUE INDEX "form_versions_one_published_idx" ON "public"."form_versions" USING "btree" ("form_id") WHERE ("status" = 'published'::"text");

CREATE INDEX "forms_commission_idx" ON "public"."forms" USING "btree" ("commission_id");

CREATE OR REPLACE TRIGGER "form_items_sync_version_trg" BEFORE INSERT OR UPDATE OF "section_id" ON "public"."form_items" FOR EACH ROW EXECUTE FUNCTION "public"."form_items_sync_version"();

CREATE OR REPLACE TRIGGER "guard_default_section_delete_trg" BEFORE DELETE ON "public"."form_sections" FOR EACH ROW EXECUTE FUNCTION "public"."guard_default_section_delete"();

ALTER TABLE "public"."form_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."form_sections" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."form_versions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."forms" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "form_items_select" ON "public"."form_items" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_version"("form_version_id")) OR "app"."is_admin"()));

CREATE POLICY "form_items_staff_admin_write" ON "public"."form_items" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_version"("form_version_id")) OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_version"("form_version_id")) OR "app"."is_admin"()));

CREATE POLICY "form_sections_select" ON "public"."form_sections" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_version"("form_version_id")) OR "app"."is_admin"()));

CREATE POLICY "form_sections_staff_admin_write" ON "public"."form_sections" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_version"("form_version_id")) OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_version"("form_version_id")) OR "app"."is_admin"()));

CREATE POLICY "form_versions_select" ON "public"."form_versions" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_version"("id")) OR "app"."is_admin"()));

CREATE POLICY "form_versions_staff_admin_write" ON "public"."form_versions" TO "authenticated" USING (("app"."is_admin"() OR "app"."is_staff_admin_of"(( SELECT "f"."commission_id"
   FROM "public"."forms" "f"
  WHERE ("f"."id" = "form_versions"."form_id"))))) WITH CHECK (("app"."is_admin"() OR "app"."is_staff_admin_of"(( SELECT "f"."commission_id"
   FROM "public"."forms" "f"
  WHERE ("f"."id" = "form_versions"."form_id")))));

CREATE POLICY "forms_select" ON "public"."forms" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("commission_id") OR "app"."is_admin"()));

CREATE POLICY "forms_staff_admin_write" ON "public"."forms" TO "authenticated" USING (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"()));

REVOKE ALL ON FUNCTION "public"."clone_form_version"("p_source_version_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."clone_form_version"("p_source_version_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."clone_form_version"("p_source_version_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_form"("p_commission_id" "uuid", "p_title" "text", "p_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_form"("p_commission_id" "uuid", "p_title" "text", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_form"("p_commission_id" "uuid", "p_title" "text", "p_description" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."delete_section_moving_items"("p_section_id" "uuid", "p_target_section_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_section_moving_items"("p_section_id" "uuid", "p_target_section_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_section_moving_items"("p_section_id" "uuid", "p_target_section_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."form_items_sync_version"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."form_items_sync_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."form_items_sync_version"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."guard_default_section_delete"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_default_section_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_default_section_delete"() TO "service_role";

GRANT ALL ON TABLE "public"."form_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."form_versions" TO "service_role";

REVOKE ALL ON FUNCTION "public"."reorder_item"("p_item_id" "uuid", "p_direction" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reorder_item"("p_item_id" "uuid", "p_direction" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_item"("p_item_id" "uuid", "p_direction" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."reorder_section"("p_section_id" "uuid", "p_direction" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reorder_section"("p_section_id" "uuid", "p_direction" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_section"("p_section_id" "uuid", "p_direction" "text") TO "service_role";

GRANT ALL ON TABLE "public"."form_items" TO "authenticated";
GRANT ALL ON TABLE "public"."form_items" TO "service_role";

GRANT ALL ON TABLE "public"."form_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."form_sections" TO "service_role";

GRANT ALL ON TABLE "public"."forms" TO "authenticated";
GRANT ALL ON TABLE "public"."forms" TO "service_role";
