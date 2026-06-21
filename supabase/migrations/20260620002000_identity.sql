-- ----------------------------------------------------------------------------
-- Consolidated baseline — identity
-- ----------------------------------------------------------------------------
SET check_function_bodies = false;
SET client_min_messages = warning;

CREATE OR REPLACE FUNCTION "app"."commission_of_version"("p_form_version_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select f.commission_id
  from public.form_versions v
  join public.forms f on f.id = v.form_id
  where v.id = p_form_version_id;
$$;

ALTER FUNCTION "app"."commission_of_version"("p_form_version_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_claim text;
begin
  v_claim := nullif(current_setting('request.jwt.claims', true), '');
  if v_claim is not null and (v_claim::jsonb ->> 'is_admin') = 'true' then
    return true;
  end if;

  return exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
end;
$$;

ALTER FUNCTION "app"."is_admin"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."is_admin_for"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1 from public.profiles where id = p_user_id and is_admin = true
  );
$$;

ALTER FUNCTION "app"."is_admin_for"("p_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."is_member_of"("p_commission_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1 from public.commission_members
    where commission_id = p_commission_id
      and user_id = auth.uid()
  );
$$;

ALTER FUNCTION "app"."is_member_of"("p_commission_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."is_member_of_for"("p_commission_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1 from public.commission_members
    where commission_id = p_commission_id and user_id = p_user_id
  );
$$;

ALTER FUNCTION "app"."is_member_of_for"("p_commission_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."is_staff_admin_of"("p_commission_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1 from public.commission_members
    where commission_id = p_commission_id
      and user_id = auth.uid()
      and role = 'staff_admin'
  );
$$;

ALTER FUNCTION "app"."is_staff_admin_of"("p_commission_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."is_staff_admin_of_for"("p_commission_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1 from public.commission_members
    where commission_id = p_commission_id
      and user_id = p_user_id
      and role = 'staff_admin'
  );
$$;

ALTER FUNCTION "app"."is_staff_admin_of_for"("p_commission_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."custom_access_token_hook"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  claims jsonb;
  v_is_admin boolean;
begin
  select is_admin into v_is_admin
  from public.profiles
  where id = (event ->> 'user_id')::uuid;

  claims := coalesce(event -> 'claims', '{}'::jsonb);
  claims := jsonb_set(claims, '{is_admin}', to_jsonb(coalesce(v_is_admin, false)));

  return jsonb_set(event, '{claims}', claims);
end;
$$;

ALTER FUNCTION "public"."custom_access_token_hook"("event" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."guard_profile_no_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  raise exception 'profiles are never deleted; deactivate via is_active'
    using errcode = 'check_violation';
end;
$$;

ALTER FUNCTION "public"."guard_profile_no_delete"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."guard_profile_privileged_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_actor_is_admin boolean;
begin
  if new.is_admin is distinct from old.is_admin
     or new.is_active is distinct from old.is_active then
    -- service_role / postgres (no auth.uid) are trusted callers.
    if auth.uid() is null then
      return new;
    end if;

    select is_admin into v_actor_is_admin
    from public.profiles where id = auth.uid();

    if not coalesce(v_actor_is_admin, false) then
      raise exception 'only an admin may change is_admin/is_active'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

ALTER FUNCTION "public"."guard_profile_privileged_columns"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."sync_profile_email"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
begin
  if new.email is distinct from old.email then
    update public.profiles
    set email = new.email
    where id = new.id;
  end if;
  return new;
end;
$$;

ALTER FUNCTION "public"."sync_profile_email"() OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."commission_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "commission_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commission_members_role_check" CHECK (("role" = ANY (ARRAY['staff'::"text", 'staff_admin'::"text"])))
);

ALTER TABLE "public"."commission_members" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."commissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "extensions"."citext" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commissions_slug_format" CHECK (("slug" OPERATOR("extensions".~) '^[a-z0-9]+(-[a-z0-9]+)*$'::"extensions"."citext"))
);

ALTER TABLE "public"."commissions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" DEFAULT ''::"text" NOT NULL,
    "is_admin" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "extensions"."citext"
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

COMMENT ON TABLE "public"."profiles" IS 'One row per auth user. Never deleted; deactivate via is_active.';

COMMENT ON COLUMN "public"."profiles"."email" IS 'Denormalized copy of auth.users.email; kept fresh by the signup trigger and the auth-email-change sync trigger. Source of truth remains auth.users.';

ALTER TABLE ONLY "public"."commission_members"
    ADD CONSTRAINT "commission_members_commission_id_user_id_key" UNIQUE ("commission_id", "user_id");

ALTER TABLE ONLY "public"."commission_members"
    ADD CONSTRAINT "commission_members_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."commission_members"
    ADD CONSTRAINT "commission_members_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."commission_members"
    ADD CONSTRAINT "commission_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;

CREATE INDEX "commission_members_commission_idx" ON "public"."commission_members" USING "btree" ("commission_id");

CREATE INDEX "commission_members_user_idx" ON "public"."commission_members" USING "btree" ("user_id");

CREATE UNIQUE INDEX "profiles_email_key" ON "public"."profiles" USING "btree" ("email") WHERE ("email" IS NOT NULL);

CREATE OR REPLACE TRIGGER "guard_profile_no_delete_trg" BEFORE DELETE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."guard_profile_no_delete"();

CREATE OR REPLACE TRIGGER "guard_profile_privileged_columns_trg" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."guard_profile_privileged_columns"();

-- Triggers on auth.users (excluded from the public/app schema dump; carried
-- verbatim from the original identity migrations). Profile bootstrap on signup
-- and the denormalized-email sync.
CREATE TRIGGER "on_auth_user_created"
  AFTER INSERT ON "auth"."users"
  FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();

CREATE TRIGGER "on_auth_user_email_changed"
  AFTER UPDATE OF "email" ON "auth"."users"
  FOR EACH ROW EXECUTE FUNCTION "public"."sync_profile_email"();

ALTER TABLE "public"."commission_members" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."commissions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commission_members_admin_all" ON "public"."commission_members" TO "authenticated" USING ("app"."is_admin"()) WITH CHECK ("app"."is_admin"());

CREATE POLICY "commission_members_select" ON "public"."commission_members" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("commission_id") OR "app"."is_admin"()));

CREATE POLICY "commission_members_staff_admin_delete" ON "public"."commission_members" FOR DELETE TO "authenticated" USING (("app"."is_staff_admin_of"("commission_id") AND ("role" = 'staff'::"text")));

CREATE POLICY "commission_members_staff_admin_insert" ON "public"."commission_members" FOR INSERT TO "authenticated" WITH CHECK (("app"."is_staff_admin_of"("commission_id") AND ("role" = 'staff'::"text")));

CREATE POLICY "commission_members_staff_admin_update" ON "public"."commission_members" FOR UPDATE TO "authenticated" USING (("app"."is_staff_admin_of"("commission_id") AND ("role" = 'staff'::"text"))) WITH CHECK (("app"."is_staff_admin_of"("commission_id") AND ("role" = 'staff'::"text")));

CREATE POLICY "commissions_admin_write" ON "public"."commissions" TO "authenticated" USING ("app"."is_admin"()) WITH CHECK ("app"."is_admin"());

CREATE POLICY "commissions_select_member_or_admin" ON "public"."commissions" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("id") OR "app"."is_admin"()));

CREATE POLICY "profiles_admin_insert" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK ("app"."is_admin"());

CREATE POLICY "profiles_admin_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("app"."is_admin"());

CREATE POLICY "profiles_admin_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ("app"."is_admin"()) WITH CHECK ("app"."is_admin"());

CREATE POLICY "profiles_select_self_or_admin" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR "app"."is_admin"() OR (EXISTS ( SELECT 1
   FROM ("public"."commission_members" "me"
     JOIN "public"."commission_members" "them" ON (("them"."commission_id" = "me"."commission_id")))
  WHERE (("me"."user_id" = "auth"."uid"()) AND ("them"."user_id" = "profiles"."id"))))));

CREATE POLICY "profiles_update_self" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));

GRANT ALL ON FUNCTION "app"."commission_of_version"("p_form_version_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."commission_of_version"("p_form_version_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "app"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "app"."is_admin"() TO "service_role";

REVOKE ALL ON FUNCTION "app"."is_admin_for"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."is_admin_for"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."is_admin_for"("p_user_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "app"."is_member_of"("p_commission_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."is_member_of"("p_commission_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."is_member_of_for"("p_commission_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."is_member_of_for"("p_commission_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."is_member_of_for"("p_commission_id" "uuid", "p_user_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "app"."is_staff_admin_of"("p_commission_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."is_staff_admin_of"("p_commission_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."is_staff_admin_of_for"("p_commission_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."is_staff_admin_of_for"("p_commission_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."is_staff_admin_of_for"("p_commission_id" "uuid", "p_user_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "supabase_auth_admin";

REVOKE ALL ON FUNCTION "public"."guard_profile_no_delete"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_profile_no_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_profile_no_delete"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."guard_profile_privileged_columns"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_profile_privileged_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_profile_privileged_columns"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."sync_profile_email"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_profile_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_profile_email"() TO "service_role";

GRANT ALL ON TABLE "public"."commission_members" TO "authenticated";
GRANT ALL ON TABLE "public"."commission_members" TO "service_role";

GRANT ALL ON TABLE "public"."commissions" TO "authenticated";
GRANT ALL ON TABLE "public"."commissions" TO "service_role";

GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT ON TABLE "public"."profiles" TO "supabase_auth_admin";
