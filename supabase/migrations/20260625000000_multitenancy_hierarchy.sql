-- ----------------------------------------------------------------------------
-- Multi-tenancy hierarchy (Phase A) — organizations -> hospitals -> commissions
--
-- Introduces two tenant levels ABOVE commissions in a pooled single database
-- with RLS isolation, and the org-scoped admin predicates. Forward-only and
-- additive. This migration ONLY adds the three new tables + their management
-- RLS + the four org-admin predicates; it does NOT touch any existing tenant /
-- commission / profiles policy or the ~60 `is_admin()` OR-terms — that swap is
-- Phase B (the RLS rewrite). See the multitenancy plan + ADR ~0041.
-- ----------------------------------------------------------------------------
SET check_function_bodies = false;
SET client_min_messages = warning;

-- ===========================================================================
-- Tables
-- ===========================================================================

-- organizations: the customer/buyer. Slug is GLOBALLY unique (it is /o/[org]).
CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "extensions"."citext" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organizations_name_not_blank" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "organizations_slug_format" CHECK (("slug" OPERATOR("extensions".~) '^[a-z0-9]+(-[a-z0-9]+)*$'::"extensions"."citext"))
);

ALTER TABLE "public"."organizations" OWNER TO "postgres";

COMMENT ON TABLE "public"."organizations" IS 'Top-level tenant (the customer/buyer). Slug is globally unique — it is the /o/[org] route key. Provisioned by platform_admin (is_admin); org_admins administer their own org below it.';

-- hospitals: a facility within an org. Slug unique PER ORG (admin/reporting/
-- grouping attribute — NOT routed; commissions carry the routed slug).
CREATE TABLE IF NOT EXISTS "public"."hospitals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "extensions"."citext" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "hospitals_name_not_blank" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "hospitals_slug_format" CHECK (("slug" OPERATOR("extensions".~) '^[a-z0-9]+(-[a-z0-9]+)*$'::"extensions"."citext"))
);

ALTER TABLE "public"."hospitals" OWNER TO "postgres";

COMMENT ON TABLE "public"."hospitals" IS 'A facility within an organization. Slug is unique per organization; hospital is a data/admin/reporting grouping, NOT part of the URL (commissions carry the routed slug).';

-- organization_members: org-level role. Today org_admin only; the CHECK is the
-- widening seam for a future hospital_admin (widen CHECK + add nullable
-- hospital_id later).
CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organization_members_role_check" CHECK (("role" = 'org_admin'::"text"))
);

ALTER TABLE "public"."organization_members" OWNER TO "postgres";

COMMENT ON TABLE "public"."organization_members" IS 'Org-level role membership. org_admin = org-scoped super-user (sees/writes everything in its org, nothing in any other). The role CHECK is the widening seam for a future hospital_admin.';

-- ---------------------------------------------------------------------------
-- Primary keys + unique constraints
-- ---------------------------------------------------------------------------
ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."hospitals"
    ADD CONSTRAINT "hospitals_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."hospitals"
    ADD CONSTRAINT "hospitals_org_slug_key" UNIQUE ("organization_id", "slug");

ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_org_user_key" UNIQUE ("organization_id", "user_id");

-- ---------------------------------------------------------------------------
-- Foreign keys
-- ---------------------------------------------------------------------------
ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."hospitals"
    ADD CONSTRAINT "hospitals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX "hospitals_organization_idx" ON "public"."hospitals" USING "btree" ("organization_id");

CREATE INDEX "organization_members_organization_idx" ON "public"."organization_members" USING "btree" ("organization_id");

CREATE INDEX "organization_members_user_idx" ON "public"."organization_members" USING "btree" ("user_id");

-- ===========================================================================
-- commissions: gain hospital_id + a denormalized organization_id, and move
-- slug uniqueness from global -> per org.
-- ===========================================================================
-- Columns land NULLABLE in Phase A. They are populated by the Phase C reseed,
-- after which Phase C flips both to NOT NULL. The auto-derive trigger below
-- tolerates a NULL hospital_id (-> NULL organization_id) only transiently
-- (pre-reseed); it is never an app-supported state.
ALTER TABLE "public"."commissions"
    ADD COLUMN "hospital_id" "uuid",
    ADD COLUMN "organization_id" "uuid";

COMMENT ON COLUMN "public"."commissions"."hospital_id" IS 'The hospital this commission belongs to. Nullable only transiently pre-reseed; Phase C flips to NOT NULL.';
COMMENT ON COLUMN "public"."commissions"."organization_id" IS 'DENORMALIZED from hospital_id via the commission_derive_organization_id trigger (non-app-writable, cannot drift). Makes per-org slug uniqueness + org-admin-of-commission a single hop. Nullable only transiently pre-reseed; Phase C flips to NOT NULL.';

ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;

-- Slug uniqueness: global -> per org. The /o/[org]/c/[commission] URL makes the
-- correct product constraint slug-unique PER ORG; UNIQUE(hospital_id, slug)
-- would wrongly allow two `ccih` in one org under different hospitals.
ALTER TABLE "public"."commissions" DROP CONSTRAINT "commissions_slug_key";

ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_org_slug_key" UNIQUE ("organization_id", "slug");

CREATE INDEX "commissions_organization_idx" ON "public"."commissions" USING "btree" ("organization_id");

CREATE INDEX "commissions_hospital_idx" ON "public"."commissions" USING "btree" ("hospital_id");

-- ---------------------------------------------------------------------------
-- Auto-derive organization_id from hospital_id (BEFORE INSERT/UPDATE).
-- Silent-overwrite (not a rejection guard): organization_id is non-app-writable
-- and cannot drift — any app-supplied value is overwritten from the hospital.
-- The trigger fires BEFORE the commissions_org_slug_key check, so per-org
-- uniqueness sees the derived org.
--
-- PHASE B DEPENDENCY: this trigger derives the org of whatever hospital is
-- attached, including a hospital in a FOREIGN org. The control that an org_admin
-- of A cannot attach a commission to a hospital in B is the commissions WRITE
-- policy's WITH CHECK (which Phase B rewrites to is_org_admin_of_commission /
-- is_org_admin_of). That WITH CHECK runs AFTER this BEFORE trigger, on the
-- derived org=B, and rejects it. Do NOT build that commissions write policy
-- here — it is Phase B.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."commission_derive_organization_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
begin
  if new.hospital_id is not null then
    select h.organization_id into new.organization_id
    from public.hospitals h
    where h.id = new.hospital_id;
  else
    -- No hospital => no org. Transient pre-reseed state only.
    new.organization_id := null;
  end if;
  return new;
end;
$$;

ALTER FUNCTION "public"."commission_derive_organization_id"() OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "commission_derive_organization_id_trg"
    BEFORE INSERT OR UPDATE ON "public"."commissions"
    FOR EACH ROW EXECUTE FUNCTION "public"."commission_derive_organization_id"();

-- ===========================================================================
-- Org-admin predicates (schema app) — STABLE SECURITY DEFINER, search_path
-- pinned. Mirror app.is_member_of / app.is_staff_admin_of exactly. Consumed by
-- the management RLS below in Phase A; the ~60 tenant-policy swaps that call
-- them are Phase B.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."is_org_admin_of"("p_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_org_id
      and user_id = auth.uid()
      and role = 'org_admin'
  );
$$;

ALTER FUNCTION "app"."is_org_admin_of"("p_org_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."is_org_admin_of_for"("p_org_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_org_id
      and user_id = p_user_id
      and role = 'org_admin'
  );
$$;

ALTER FUNCTION "app"."is_org_admin_of_for"("p_org_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."is_org_admin_of_commission"("p_commission_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.commissions c
    join public.organization_members om on om.organization_id = c.organization_id
    where c.id = p_commission_id
      and om.user_id = auth.uid()
      and om.role = 'org_admin'
  );
$$;

ALTER FUNCTION "app"."is_org_admin_of_commission"("p_commission_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."is_org_admin_of_commission_for"("p_commission_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.commissions c
    join public.organization_members om on om.organization_id = c.organization_id
    where c.id = p_commission_id
      and om.user_id = p_user_id
      and om.role = 'org_admin'
  );
$$;

ALTER FUNCTION "app"."is_org_admin_of_commission_for"("p_commission_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- Management-table RLS (the THREE new tables only).
--   organizations write  = is_admin()                          (platform provisioning)
--   hospitals / org_members write = is_admin() OR is_org_admin_of(organization_id)
--   SELECT (all three)    = is_admin() OR is_org_admin_of(org)  (org_admin reads own org;
--                                                                platform_admin reads all)
-- No existing tenant/commission/profiles policy is touched here — that is Phase B.
-- ===========================================================================
ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."hospitals" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;

-- organizations: only platform_admin (is_admin) may create/modify orgs; org_admins
-- read their own. org_admins cannot create orgs (provisioning is vendor-only).
CREATE POLICY "organizations_admin_write" ON "public"."organizations" TO "authenticated" USING ("app"."is_admin"()) WITH CHECK ("app"."is_admin"());

CREATE POLICY "organizations_select" ON "public"."organizations" FOR SELECT TO "authenticated" USING (("app"."is_admin"() OR "app"."is_org_admin_of"("id")));

-- hospitals: platform_admin OR the org's org_admin may write/read.
CREATE POLICY "hospitals_write" ON "public"."hospitals" TO "authenticated" USING (("app"."is_admin"() OR "app"."is_org_admin_of"("organization_id"))) WITH CHECK (("app"."is_admin"() OR "app"."is_org_admin_of"("organization_id")));

CREATE POLICY "hospitals_select" ON "public"."hospitals" FOR SELECT TO "authenticated" USING (("app"."is_admin"() OR "app"."is_org_admin_of"("organization_id")));

-- organization_members: platform_admin OR the org's org_admin may write/read.
CREATE POLICY "organization_members_write" ON "public"."organization_members" TO "authenticated" USING (("app"."is_admin"() OR "app"."is_org_admin_of"("organization_id"))) WITH CHECK (("app"."is_admin"() OR "app"."is_org_admin_of"("organization_id")));

CREATE POLICY "organization_members_select" ON "public"."organization_members" FOR SELECT TO "authenticated" USING (("app"."is_admin"() OR "app"."is_org_admin_of"("organization_id")));

-- ===========================================================================
-- Grants — match the commissions/commission_members pattern (REVOKE PUBLIC on
-- the _for predicates that take an explicit user id; GRANT authenticated +
-- service_role on everything).
-- ===========================================================================
GRANT ALL ON FUNCTION "app"."is_org_admin_of"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."is_org_admin_of"("p_org_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."is_org_admin_of_for"("p_org_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."is_org_admin_of_for"("p_org_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."is_org_admin_of_for"("p_org_id" "uuid", "p_user_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "app"."is_org_admin_of_commission"("p_commission_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."is_org_admin_of_commission"("p_commission_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."is_org_admin_of_commission_for"("p_commission_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."is_org_admin_of_commission_for"("p_commission_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."is_org_admin_of_commission_for"("p_commission_id" "uuid", "p_user_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."commission_derive_organization_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."commission_derive_organization_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."commission_derive_organization_id"() TO "service_role";

GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";

GRANT ALL ON TABLE "public"."hospitals" TO "authenticated";
GRANT ALL ON TABLE "public"."hospitals" TO "service_role";

GRANT ALL ON TABLE "public"."organization_members" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_members" TO "service_role";
