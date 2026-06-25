-- ----------------------------------------------------------------------------
-- NSP-per-org (ADR 0042) — bind the PQS roster + every PHI door to an ORGANIZATION.
--
-- The NSP/patient-safety + inter-committee referral PHI modules authorize PHI through
-- a single GLOBAL roster (`public.pqs_members` via `app.is_pqs_member`). Under
-- multi-tenancy that global term would let an org-A NSP member read org-B PHI, so ADR
-- 0041 amendment 10 made the whole surface INERT whenever `is_multi_org()` (>1 org).
-- This migration lifts that interim guard FOR REAL: the roster + NSP config become
-- per-org, every PHI door resolves entity -> commission -> organization and replaces
-- the global `app.is_pqs_member(uid)` term with `app.is_pqs_member_of(<that org>, uid)`,
-- and `is_multi_org()` + the global PQS predicates are deleted (last).
--
-- Single-org behavior stays BYTE-IDENTICAL: one org => the per-org term collapses to
-- "is enrolled" (the existing 14a/b/c/d + 150_referrals pgTAP suites stay green).
--
-- *** NOT ADDITIVE *** — this changes the PRIMARY KEY of `public.pqs_members`
-- (PK(user_id) -> PK(organization_id, user_id)) and drops the `pqs_department`
-- singleton column. It relies on the greenfield reseed (ADR 0041 dec. 9): the seed
-- TRUNCATEs + reinserts, so there is NO row migration here. Do NOT apply this to a DB
-- with rows you intend to keep.
--
-- Three-way duty separation (per-org): org_admin APPOINTS the coordinator (manages
-- `organization_members`); the per-org `nsp_coordinator` CURATES `pqs_members`;
-- enrollment in `pqs_members` is what grants PHI READ. A coordinator is NOT implicitly
-- a reader (explicit enrollment).
--
-- Ordering: schema -> predicate primitives + org-resolution helpers (§A2) -> read
-- predicates (§A3a) -> write gates/policies (§A3b) -> DEFINER doors (§A3c) -> flag/
-- assert reversions (§A3d) -> per-org mint (§A3e) -> roster RPCs (§A3f) -> storage +
-- patient_index (§A3g) -> cross-org-referral forbid (§A3h) -> drops LAST (§A3i).
-- `check_function_bodies = false` so primitives can be created before their callers.
-- ----------------------------------------------------------------------------
SET check_function_bodies = false;
SET client_min_messages = warning;

-- ===========================================================================
-- §A2.1 — SCHEMA: organization_members.role widening seam.
-- Widen the role CHECK from {org_admin} to {org_admin, nsp_coordinator}. The existing
-- organization_members_write policy keys on organization_id (NOT role), so an
-- org_admin can already insert the new role — no policy change for appointment.
-- ===========================================================================
ALTER TABLE "public"."organization_members"
  DROP CONSTRAINT IF EXISTS "organization_members_role_check";
ALTER TABLE "public"."organization_members"
  ADD CONSTRAINT "organization_members_role_check"
  CHECK ("role" = ANY (ARRAY['org_admin'::"text", 'nsp_coordinator'::"text"]));

COMMENT ON CONSTRAINT "organization_members_role_check" ON "public"."organization_members"
  IS 'NSP-per-org (ADR 0042): widened to {org_admin, nsp_coordinator}. org_admin = org super-user; nsp_coordinator = curates that org''s PQS roster (pqs_members) — three-way duty separation (org_admin appoints ≠ coordinator curates ≠ enrolled member reads PHI).';

-- ===========================================================================
-- §A2.2 — SCHEMA: pqs_department singleton -> PER-ORG.
-- Drop the singleton column + its CHECK + its unique index; add organization_id (FK,
-- NOT NULL post-reseed) + UNIQUE(organization_id). name/rca_default_due_days become
-- per-org config. Singleton readers switch to `where organization_id = <org>` (§A3).
-- ===========================================================================
ALTER TABLE "public"."pqs_department"
  ADD COLUMN IF NOT EXISTS "organization_id" "uuid";

ALTER TABLE "public"."pqs_department"
  ADD CONSTRAINT "pqs_department_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;

-- Drop the singleton machinery (column, its CHECK, its unique index).
DROP INDEX IF EXISTS "public"."pqs_department_singleton_key";
ALTER TABLE "public"."pqs_department"
  DROP CONSTRAINT IF EXISTS "pqs_department_singleton_true";
ALTER TABLE "public"."pqs_department"
  DROP COLUMN IF EXISTS "singleton";

-- Greenfield reseed truncates + reinserts with organization_id populated, so we can
-- enforce NOT NULL immediately.
ALTER TABLE "public"."pqs_department"
  ALTER COLUMN "organization_id" SET NOT NULL;

-- One NSP-department config row per org.
ALTER TABLE "public"."pqs_department"
  ADD CONSTRAINT "pqs_department_organization_id_key" UNIQUE ("organization_id");

COMMENT ON TABLE "public"."pqs_department"
  IS 'NSP/PQS-department configuration, ONE ROW PER ORGANIZATION (NSP-per-org, ADR 0042; was a global singleton). Holds that org''s name + RCA default due-window read by triage (14b) / RCA (14c). No PHI.';

-- ===========================================================================
-- §A2.3 — SCHEMA: pqs_members global -> PER-ORG (the PK change; NOT additive).
-- Add organization_id (FK) -> drop PK(user_id) -> set NOT NULL -> PK(org, user) ->
-- INDEX(user_id). The two profile FKs stay. RLS: drop the admin-all policy, add the
-- per-org coordinator-all policy. Greenfield reseed => no row migration.
-- ===========================================================================
ALTER TABLE "public"."pqs_members"
  ADD COLUMN IF NOT EXISTS "organization_id" "uuid";

ALTER TABLE "public"."pqs_members"
  ADD CONSTRAINT "pqs_members_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;

-- Repoint the primary key from (user_id) to (organization_id, user_id).
ALTER TABLE "public"."pqs_members" DROP CONSTRAINT IF EXISTS "pqs_members_pkey";
ALTER TABLE "public"."pqs_members" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "public"."pqs_members"
  ADD CONSTRAINT "pqs_members_pkey" PRIMARY KEY ("organization_id", "user_id");

-- Support the "member of ANY org" probe (is_pqs_member_of_any) + profile-side lookups.
CREATE INDEX IF NOT EXISTS "pqs_members_user_id_idx" ON "public"."pqs_members" ("user_id");

COMMENT ON TABLE "public"."pqs_members"
  IS 'PER-ORG PQS/NSP roster (NSP-per-org, ADR 0042; was a global PK(user_id) roster). Enrollment in (organization_id, user_id) is what grants that org''s PHI READ via app.is_pqs_member_of. Curated by the org''s nsp_coordinator (pqs_members_coordinator_all); NO platform-admin escape hatch (duty separation).';

COMMENT ON COLUMN "public"."pqs_members"."organization_id"
  IS 'The organization whose PHI this enrollment grants read of. Part of the composite PK (organization_id, user_id).';

-- ===========================================================================
-- §A2.4 — PREDICATE PRIMITIVES (replace the global ones) + ORG-RESOLUTION HELPERS.
-- All STABLE SECURITY DEFINER, search_path pinned, OWNER postgres, REVOKE PUBLIC +
-- GRANT authenticated/service_role. `_for(…, p_user_id)` + bare auth.uid() variants,
-- mirroring app.is_org_admin_of / _for exactly. Created BEFORE any caller
-- (check_function_bodies=false) so the rebinds below resolve.
-- ===========================================================================

-- ---- Org-resolution helpers (DRY/testable; entity -> organization_id) ----
-- org_of_commission: the single hop commission -> org (denormalized on commissions).
CREATE OR REPLACE FUNCTION "app"."org_of_commission"("p_commission_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select organization_id from public.commissions where id = p_commission_id;
$$;
ALTER FUNCTION "app"."org_of_commission"("p_commission_id" "uuid") OWNER TO "postgres";

-- org_of_event: via reporting_commission_id (NOT NULL; provenance, retained across
-- custody hand-offs) — NEVER current_owner_commission_id (NULL for PQS-held events).
CREATE OR REPLACE FUNCTION "app"."org_of_event"("p_event_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select c.organization_id
  from public.patient_safety_event e
  join public.commissions c on c.id = e.reporting_commission_id
  where e.id = p_event_id;
$$;
ALTER FUNCTION "app"."org_of_event"("p_event_id" "uuid") OWNER TO "postgres";

-- org_of_referral: via source_commission_id (NOT NULL; the provenance/audit commission).
CREATE OR REPLACE FUNCTION "app"."org_of_referral"("p_referral_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select c.organization_id
  from public.case_referral r
  join public.commissions c on c.id = r.source_commission_id
  where r.id = p_referral_id;
$$;
ALTER FUNCTION "app"."org_of_referral"("p_referral_id" "uuid") OWNER TO "postgres";

-- org_of_capa_action: action -> capa_plan -> event -> org. (capa write policies that
-- start from a child resolve to capa_id first, then call can_write_capa.)
CREATE OR REPLACE FUNCTION "app"."org_of_capa_action"("p_action_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.org_of_event(app.event_of_capa(ca.capa_id))
  from public.capa_action ca
  where ca.id = p_action_id;
$$;
ALTER FUNCTION "app"."org_of_capa_action"("p_action_id" "uuid") OWNER TO "postgres";

-- ---- The workhorse + the other per-org predicates ----
-- is_pqs_member_of: enrolled in THIS org's roster. PK point-lookup on
-- (organization_id, user_id) — no extra index needed. EVERY read predicate resolves
-- the entity's org and calls this.
CREATE OR REPLACE FUNCTION "app"."is_pqs_member_of_for"("p_org_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1 from public.pqs_members
    where organization_id = p_org_id and user_id = p_user_id
  );
$$;
ALTER FUNCTION "app"."is_pqs_member_of_for"("p_org_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."is_pqs_member_of"("p_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.is_pqs_member_of_for(p_org_id, auth.uid());
$$;
ALTER FUNCTION "app"."is_pqs_member_of"("p_org_id" "uuid") OWNER TO "postgres";

-- is_nsp_coordinator_of: the per-org roster CURATOR (organization_members role). Mirror
-- is_org_admin_of, filtered to role='nsp_coordinator'.
CREATE OR REPLACE FUNCTION "app"."is_nsp_coordinator_of_for"("p_org_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_org_id
      and user_id = p_user_id
      and role = 'nsp_coordinator'
  );
$$;
ALTER FUNCTION "app"."is_nsp_coordinator_of_for"("p_org_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."is_nsp_coordinator_of"("p_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.is_nsp_coordinator_of_for(p_org_id, auth.uid());
$$;
ALTER FUNCTION "app"."is_nsp_coordinator_of"("p_org_id" "uuid") OWNER TO "postgres";

-- is_pqs_writer_of: per-org write authority = per-org roster membership (mirrors the
-- old is_pqs_writer = is_pqs_member, now org-bound).
CREATE OR REPLACE FUNCTION "app"."is_pqs_writer_of"("p_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.is_pqs_member_of(p_org_id);
$$;
ALTER FUNCTION "app"."is_pqs_writer_of"("p_org_id" "uuid") OWNER TO "postgres";

-- is_pqs_member_of_any: enrolled in ANY org's roster. The nav-level "show NSP at all"
-- probe AND the GLOBAL-vocab CRUD gate (pqs_event_types / pqs_sentinel_criteria are
-- hospital-wide shared vocab, NOT per-org). Backed by pqs_members_user_id_idx.
CREATE OR REPLACE FUNCTION "app"."is_pqs_member_of_any"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (select 1 from public.pqs_members where user_id = p_user_id);
$$;
ALTER FUNCTION "app"."is_pqs_member_of_any"("p_user_id" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- §A2.5 — pqs_members RLS swap: drop admin-all, add per-org coordinator-all.
-- No platform-admin escape hatch (duty separation). org_admin gets NO direct
-- pqs_members write (appoints coordinators via organization_members only).
-- ===========================================================================
DROP POLICY IF EXISTS "pqs_members_admin_all" ON "public"."pqs_members";
CREATE POLICY "pqs_members_coordinator_all" ON "public"."pqs_members"
  TO "authenticated"
  USING ("app"."is_nsp_coordinator_of"("organization_id"))
  WITH CHECK ("app"."is_nsp_coordinator_of"("organization_id"));

COMMENT ON POLICY "pqs_members_coordinator_all" ON "public"."pqs_members"
  IS 'NSP-per-org (ADR 0042): the org''s nsp_coordinator is the ONLY direct writer of its roster. No platform_admin / org_admin escape hatch — three-way duty separation. Enrollment grants PHI read, so curation is a distinct grant from reading (a coordinator must enroll themselves to read).';

-- ===========================================================================
-- §A2.6 — GRANTS on every new helper/predicate (mirror the app predicates).
-- ===========================================================================
DO $grants$
DECLARE
  fn text;
BEGIN
  FOR fn IN
    SELECT unnest(ARRAY[
      'app.org_of_commission(uuid)',
      'app.org_of_event(uuid)',
      'app.org_of_referral(uuid)',
      'app.org_of_capa_action(uuid)',
      'app.is_pqs_member_of_for(uuid, uuid)',
      'app.is_pqs_member_of(uuid)',
      'app.is_nsp_coordinator_of_for(uuid, uuid)',
      'app.is_nsp_coordinator_of(uuid)',
      'app.is_pqs_writer_of(uuid)',
      'app.is_pqs_member_of_any(uuid)'
    ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('GRANT ALL ON FUNCTION %s TO authenticated', fn);
    EXECUTE format('GRANT ALL ON FUNCTION %s TO service_role', fn);
  END LOOP;
END
$grants$;

-- ===========================================================================
-- §A3a — READ PREDICATES: rebind the global PQS term -> per-org, drop the
-- is_multi_org wrapper. Org-bounded terms (member/custody/reporting/staff_admin/
-- case_access/coordinator/assignee) are untouched. (These same CREATE OR REPLACEs
-- also satisfy §A3i's "no is_multi_org reference" requirement for the 5 guard-
-- migration predicates.)
-- ===========================================================================

-- can_read_event (event read): PQS term -> per-org; keep both reporting/owner member terms.
CREATE OR REPLACE FUNCTION "app"."can_read_event"("p_event_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.patient_safety_event e
    where e.id = p_event_id
      and (
        app.is_member_of_for(e.current_owner_commission_id, p_user_id)
        or app.is_member_of_for(e.reporting_commission_id, p_user_id)
        or app.is_pqs_member_of_for(app.org_of_event(e.id), p_user_id)
      )
  );
$$;

-- can_read_event_patient (PHI-identifier door, tightest): PQS term -> per-org; the
-- access-follows-custody staff_admin term is org-safe.
CREATE OR REPLACE FUNCTION "app"."can_read_event_patient"("p_event_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.patient_safety_event e
    where e.id = p_event_id
      and (
        app.is_pqs_member_of_for(app.org_of_event(e.id), p_user_id)
        or app.is_staff_admin_of_for(e.current_owner_commission_id, p_user_id)
      )
  );
$$;

-- can_read_capa: PQS term -> per-org (resolve event via the capa); keep can_read_event.
CREATE OR REPLACE FUNCTION "app"."can_read_capa"("p_capa_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select
    app.is_pqs_member_of_for(app.org_of_event(app.event_of_capa(p_capa_id)), p_user_id)
    or app.can_read_event(app.event_of_capa(p_capa_id), p_user_id);
$$;

-- can_read_referral (broad, PHI-FREE metadata): PQS term -> per-org via source org.
CREATE OR REPLACE FUNCTION "app"."can_read_referral"("p_referral_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and (
        app.is_pqs_member_of_for(app.org_of_referral(r.id), p_uid)
        or app.is_member_of_for(r.source_commission_id, p_uid)
        or app.is_member_of_for(r.target_commission_id, p_uid)
      )
  );
$$;

-- can_read_referral_phi (tight PHI door): PQS term -> per-org; source/target
-- staff_admin + analyst terms are org-bounded. (Lives in 629000; rewritten with NO
-- is_multi_org reference.)
CREATE OR REPLACE FUNCTION "app"."can_read_referral_phi"("p_referral_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and (
        app.is_pqs_member_of_for(app.org_of_referral(r.id), p_uid)
        or app.is_staff_admin_of_for(r.source_commission_id, p_uid)
        or app.is_staff_admin_of_for(r.target_commission_id, p_uid)
      )
  )
  or app.referral_target_analyst(p_referral_id, p_uid);
$$;

-- event_current_custodian (HC044 custody gate): PQS term -> per-org.
CREATE OR REPLACE FUNCTION "app"."event_current_custodian"("p_event_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.patient_safety_event e
    where e.id = p_event_id
      and (
        app.is_pqs_member_of_for(app.org_of_event(e.id), p_user_id)
        or (e.current_owner_kind = 'commission'
            and app.is_staff_admin_of_for(e.current_owner_commission_id, p_user_id))
      )
  );
$$;

-- can_write_rca (read+write arm): the PQS term -> per-org; keep the assigned-member arm.
CREATE OR REPLACE FUNCTION "app"."can_write_rca"("p_rca_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select
    app.is_pqs_member_of_for(app.org_of_event(app.event_of_rca(p_rca_id)), p_uid)
    or exists (
      select 1 from public.rca_members m
      where m.rca_id = p_rca_id and m.user_id = p_uid and m.role <> 'observer'
    );
$$;

-- can_read_case — QPS MACRO TERM ONLY: per-org via the case's commission; drop the
-- `and not is_multi_org()` guard. All other terms (governance/assignee/grantee/
-- flag-OFF member-read) unchanged. (Lives in 629000; rewritten with no is_multi_org.)
CREATE OR REPLACE FUNCTION "app"."can_read_case"("p_case_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return false;
  end if;

  -- QPS macro-view of any referral-touched case — now per-org (the org's NSP roster).
  if app.feature_enabled('case_referrals')
     and app.is_pqs_member_of_for(app.org_of_commission(v_commission), p_uid)
     and exists (
       select 1 from public.case_referral r
       where r.source_case_id = p_case_id or r.target_case_id = p_case_id
     ) then
    return true;
  end if;

  -- Flag-OFF fallback: member-read + org-governance (org-bounded; unaffected).
  if not app.feature_enabled('case_access') then
    return app.is_member_of_for(v_commission, p_uid)
        or app.is_org_admin_of_commission_for(v_commission, p_uid);
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    or app.is_org_admin_of_commission_for(v_commission, p_uid)
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

-- can_read_case_patient — same QPS macro-term rewrite; org-bounded worker terms stay.
CREATE OR REPLACE FUNCTION "app"."can_read_case_patient"("p_case_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return false;
  end if;

  -- QPS macro-view of any referral-touched case — now per-org (the org's NSP roster).
  if app.feature_enabled('case_referrals')
     and app.is_pqs_member_of_for(app.org_of_commission(v_commission), p_uid)
     and exists (
       select 1 from public.case_referral r
       where r.source_case_id = p_case_id or r.target_case_id = p_case_id
     ) then
    return true;
  end if;

  -- Flag-OFF fallback: member-read (org-bounded; PHI never follows org governance).
  if not app.feature_enabled('case_access') then
    return app.is_member_of_for(v_commission, p_uid);
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
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

-- ===========================================================================
-- §A3b — WRITE GATES / POLICIES: consolidate the 8 CAPA writers behind a per-org
-- can_write_capa (mirrors the can_read_capa pairing), rebind assert_capa_writable +
-- advance_capa_action_core, and rebind every NSP-lifecycle is_pqs_member gate.
-- ===========================================================================

-- can_write_capa: per-org write authority for a CAPA plan (writer = enrolled in the
-- plan's event's org). The single consolidation the 8 *_write policies call.
--
-- A capa_plan is source-polymorphic. For event/rca-sourced plans the org is the
-- event's org (PHI-bearing → org-scoped). For the other sources (indicator /
-- audit_finding / meeting / manual) event_of_capa is NULL — those plans carry NO
-- event PHI, so the faithful translation of the old global is_pqs_writer() is
-- "any-org NSP member" (NOT a per-org gate, which would make them unwritable by
-- anyone). NULL org => is_pqs_member_of(NULL) is false, so the explicit branch is
-- required.
CREATE OR REPLACE FUNCTION "app"."can_write_capa"("p_capa_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select case
    when app.event_of_capa(p_capa_id) is not null
      then app.is_pqs_member_of_for(app.org_of_event(app.event_of_capa(p_capa_id)), p_uid)
    else app.is_pqs_member_of_any(p_uid)
  end;
$$;
ALTER FUNCTION "app"."can_write_capa"("p_capa_id" "uuid", "p_uid" "uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "app"."can_write_capa"("p_capa_id" "uuid", "p_uid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."can_write_capa"("p_capa_id" "uuid", "p_uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."can_write_capa"("p_capa_id" "uuid", "p_uid" "uuid") TO "service_role";

-- The 8 CAPA write policies: is_pqs_writer() -> can_write_capa(<resolved capa_id>,
-- auth.uid()). Per-table resolution: action->capa_id, child->action->capa_id,
-- measure->capa_id, result->measure->capa_id, plan->id.
DROP POLICY IF EXISTS "capa_action_write" ON "public"."capa_action";
CREATE POLICY "capa_action_write" ON "public"."capa_action" TO "authenticated"
  USING ("app"."can_write_capa"("capa_id", "auth"."uid"()))
  WITH CHECK ("app"."can_write_capa"("capa_id", "auth"."uid"()));

DROP POLICY IF EXISTS "capa_action_evidence_write" ON "public"."capa_action_evidence";
CREATE POLICY "capa_action_evidence_write" ON "public"."capa_action_evidence" TO "authenticated"
  USING ("app"."can_write_capa"((select ca.capa_id from public.capa_action ca where ca.id = "action_id"), "auth"."uid"()))
  WITH CHECK ("app"."can_write_capa"((select ca.capa_id from public.capa_action ca where ca.id = "action_id"), "auth"."uid"()));

DROP POLICY IF EXISTS "capa_action_task_write" ON "public"."capa_action_task";
CREATE POLICY "capa_action_task_write" ON "public"."capa_action_task" TO "authenticated"
  USING ("app"."can_write_capa"((select ca.capa_id from public.capa_action ca where ca.id = "action_id"), "auth"."uid"()))
  WITH CHECK ("app"."can_write_capa"((select ca.capa_id from public.capa_action ca where ca.id = "action_id"), "auth"."uid"()));

DROP POLICY IF EXISTS "capa_measure_write" ON "public"."capa_measure";
CREATE POLICY "capa_measure_write" ON "public"."capa_measure" TO "authenticated"
  USING ("app"."can_write_capa"("capa_id", "auth"."uid"()))
  WITH CHECK ("app"."can_write_capa"("capa_id", "auth"."uid"()));

DROP POLICY IF EXISTS "capa_measure_result_write" ON "public"."capa_measure_result";
CREATE POLICY "capa_measure_result_write" ON "public"."capa_measure_result" TO "authenticated"
  USING ("app"."can_write_capa"((select cm.capa_id from public.capa_measure cm where cm.id = "measure_id"), "auth"."uid"()))
  WITH CHECK ("app"."can_write_capa"((select cm.capa_id from public.capa_measure cm where cm.id = "measure_id"), "auth"."uid"()));

DROP POLICY IF EXISTS "capa_effectiveness_write" ON "public"."capa_effectiveness";
CREATE POLICY "capa_effectiveness_write" ON "public"."capa_effectiveness" TO "authenticated"
  USING ("app"."can_write_capa"("capa_id", "auth"."uid"()))
  WITH CHECK ("app"."can_write_capa"("capa_id", "auth"."uid"()));

DROP POLICY IF EXISTS "capa_plan_update" ON "public"."capa_plan";
CREATE POLICY "capa_plan_update" ON "public"."capa_plan" FOR UPDATE TO "authenticated"
  USING ("app"."can_write_capa"("id", "auth"."uid"()))
  WITH CHECK ("app"."can_write_capa"("id", "auth"."uid"()));

DROP POLICY IF EXISTS "capa_plan_delete" ON "public"."capa_plan";
CREATE POLICY "capa_plan_delete" ON "public"."capa_plan" FOR DELETE TO "authenticated"
  USING ("app"."can_write_capa"("id", "auth"."uid"()));

-- assert_capa_writable: is_pqs_writer() -> can_write_capa(p_capa_id, auth.uid()).
CREATE OR REPLACE FUNCTION "app"."assert_capa_writable"("p_capa_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if (select id from public.capa_plan where id = p_capa_id) is null then
    raise exception 'plano de ação não encontrado' using errcode = 'no_data_found';
  end if;
  if not app.can_write_capa(p_capa_id, auth.uid()) then
    raise exception 'apenas o NSP pode gerenciar planos de ação' using errcode = '42501';
  end if;
end;
$$;

-- advance_capa_action_core: the is_pqs_member arm -> per-org (resolve event via capa).
CREATE OR REPLACE FUNCTION "app"."advance_capa_action_core"("p_action_id" "uuid", "p_status" "text") RETURNS "public"."capa_action"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_assignee uuid;
  v_capa_id uuid;
  v_uid uuid := auth.uid();
  v_result public.capa_action;
begin
  if p_status not in ('pendente', 'em_andamento', 'concluida', 'cancelada') then
    raise exception 'estado de ação inválido' using errcode = 'check_violation';
  end if;

  select assignee_user_id, capa_id into v_assignee, v_capa_id
  from public.capa_action where id = p_action_id;
  if v_capa_id is null then
    raise exception 'ação % não encontrada', p_action_id using errcode = 'no_data_found';
  end if;

  if not (
    (v_assignee is not null and v_assignee = v_uid)
    or app.is_pqs_member_of(app.org_of_event(app.event_of_capa(v_capa_id)))
  ) then
    raise exception 'você não pode alterar esta ação corretiva' using errcode = 'HC050';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.capa_action
  set status = p_status,
      completed_at = case when p_status = 'concluida' then coalesce(completed_at, now()) else null end,
      completed_by = case when p_status = 'concluida' then coalesce(completed_by, v_uid) else null end,
      updated_at = now()
  where id = p_action_id
  returning * into v_result;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_result;
end;
$$;

-- ---- NSP triage lifecycle RPCs: is_pqs_member(auth.uid()) gate -> per-org via the
-- event; confirm_triage's pqs_department singleton read -> per-org. Bodies are
-- otherwise reproduced verbatim from 20260620009000_patient_safety.sql. ----

CREATE OR REPLACE FUNCTION "public"."save_triage"("p_event_id" "uuid", "p_is_pse" boolean DEFAULT NULL::boolean, "p_pse_closure_reason" "text" DEFAULT NULL::"text", "p_reach" "text" DEFAULT NULL::"text", "p_harm_severity" "text" DEFAULT NULL::"text", "p_natural_course" boolean DEFAULT NULL::boolean, "p_review_pathway" "text" DEFAULT NULL::"text", "p_disposition_notes_md" "text" DEFAULT NULL::"text", "p_sentinel_criteria_ids" "uuid"[] DEFAULT '{}'::"uuid"[]) RETURNS "public"."event_triage"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_triage public.event_triage;
  v_reach text := p_reach;
  v_harm text := p_harm_severity;
  v_natural boolean := p_natural_course;
  v_has_designated boolean := coalesce(array_length(p_sentinel_criteria_ids, 1), 0) > 0;
  v_sentinel boolean;
begin
  perform app.assert_patient_safety_enabled();

  if not app.can_read_event(p_event_id, auth.uid()) then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;
  -- Triage is an NSP activity (per-org).
  if not app.is_pqs_member_of(app.org_of_event(p_event_id)) then
    raise exception 'apenas o NSP pode triar eventos' using errcode = '42501';
  end if;

  if (select status from public.patient_safety_event where id = p_event_id) <> 'acknowledged' then
    raise exception 'o evento precisa estar reconhecido pelo NSP para ser triado'
      using errcode = 'HC045';
  end if;

  if v_reach is not null and v_reach not in ('unsafe', 'near_miss', 'no_harm', 'adverse', 'sentinel') then
    raise exception 'alcance inválido' using errcode = 'HC046';
  end if;
  if v_harm is not null and v_harm not in ('none', 'mild', 'moderate', 'severe', 'permanent', 'death') then
    raise exception 'gravidade de dano inválida' using errcode = 'HC046';
  end if;
  if p_review_pathway is not null
     and p_review_pathway not in ('rca', 'peer_review', 'mm', 'fmea', 'tracking_only') then
    raise exception 'desfecho inválido' using errcode = 'HC046';
  end if;

  if p_is_pse is false then
    if p_pse_closure_reason is null
       or p_pse_closure_reason not in ('natural', 'expected', 'nonclinical', 'duplicate') then
      raise exception 'selecione o motivo de encerramento (não é evento de segurança)'
        using errcode = 'HC046';
    end if;
    v_reach := null;
    v_harm := null;
    v_natural := null;
    v_has_designated := false;
    p_sentinel_criteria_ids := '{}';
  end if;

  if coalesce(p_is_pse, true) and v_reach is not null then
    if v_reach in ('unsafe', 'near_miss', 'no_harm') then
      v_harm := 'none';
      v_natural := null;
    elsif v_reach = 'sentinel' then
      if v_harm is null or v_harm in ('none', 'mild', 'moderate') then
        v_harm := 'severe';
      end if;
    end if;
  end if;

  v_sentinel := app.compute_sentinel_determination(v_reach, v_harm, v_natural, v_has_designated);

  perform set_config('app.in_safety_rpc', 'on', true);

  insert into public.event_triage (
    event_id, is_pse, pse_closure_reason, reach, harm_severity, natural_course,
    sentinel_determination, review_pathway, disposition_notes_md, updated_at
  ) values (
    p_event_id, p_is_pse,
    case when p_is_pse is false then p_pse_closure_reason else null end,
    v_reach, v_harm, v_natural, v_sentinel, p_review_pathway, p_disposition_notes_md, now()
  )
  on conflict (event_id) do update
  set is_pse = excluded.is_pse,
      pse_closure_reason = excluded.pse_closure_reason,
      reach = excluded.reach,
      harm_severity = excluded.harm_severity,
      natural_course = excluded.natural_course,
      sentinel_determination = excluded.sentinel_determination,
      review_pathway = excluded.review_pathway,
      disposition_notes_md = excluded.disposition_notes_md,
      updated_at = now()
  returning * into v_triage;

  delete from public.event_triage_sentinel_flags where event_id = p_event_id;
  if v_has_designated then
    insert into public.event_triage_sentinel_flags (event_id, criteria_id, criteria_key, criteria_label)
    select p_event_id, c.id, c.key, c.label
    from public.pqs_sentinel_criteria c
    where c.id = any (p_sentinel_criteria_ids);
  end if;

  perform set_config('app.in_safety_rpc', 'off', true);
  return v_triage;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."confirm_triage"("p_event_id" "uuid") RETURNS "public"."event_triage"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_triage public.event_triage;
  v_event public.patient_safety_event;
  v_due_days integer;
  v_anchor date;
  v_pathway text;
begin
  perform app.assert_patient_safety_enabled();

  if not app.can_read_event(p_event_id, auth.uid()) then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;
  if not app.is_pqs_member_of(app.org_of_event(p_event_id)) then
    raise exception 'apenas o NSP pode triar eventos' using errcode = '42501';
  end if;

  select * into v_event from public.patient_safety_event where id = p_event_id;
  if v_event.status <> 'acknowledged' then
    raise exception 'a triagem só pode ser confirmada a partir de um evento reconhecido'
      using errcode = 'HC045';
  end if;

  select * into v_triage from public.event_triage where event_id = p_event_id;
  if not found or v_triage.is_pse is null then
    raise exception 'complete a triagem antes de confirmá-la' using errcode = 'HC046';
  end if;

  if v_triage.is_pse = false then
    if v_triage.pse_closure_reason is null then
      raise exception 'selecione o motivo de encerramento' using errcode = 'HC046';
    end if;

    perform set_config('app.in_safety_rpc', 'on', true);
    update public.event_triage
    set review_pathway = null, triaged_by = auth.uid(), triaged_at = now(), updated_at = now()
    where event_id = p_event_id
    returning * into v_triage;

    update public.patient_safety_event
    set status = 'closed', closed_by = auth.uid(), closed_at = now(), updated_at = now()
    where id = p_event_id;
    perform set_config('app.in_safety_rpc', 'off', true);

    return v_triage;
  end if;

  if v_triage.reach is null then
    raise exception 'classifique o alcance do evento antes de confirmar' using errcode = 'HC046';
  end if;

  if v_triage.sentinel_determination then
    if v_triage.review_pathway is not null and v_triage.review_pathway <> 'rca' then
      raise exception 'eventos sentinela exigem RCA — o desfecho não pode ser alterado'
        using errcode = 'HC046';
    end if;
    v_pathway := 'rca';
  else
    v_pathway := coalesce(v_triage.review_pathway, 'peer_review');
    if v_pathway = 'rca' then
      null;
    end if;
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.event_triage
  set review_pathway = v_pathway, triaged_by = auth.uid(), triaged_at = now(), updated_at = now()
  where event_id = p_event_id
  returning * into v_triage;

  update public.patient_safety_event
  set status = 'triaged', updated_at = now()
  where id = p_event_id;

  -- Pathway = rca ⇒ mint the configurable due date from THIS event's ORG config.
  if v_pathway = 'rca' then
    select rca_default_due_days into v_due_days
    from public.pqs_department where organization_id = app.org_of_event(p_event_id);
    v_due_days := coalesce(v_due_days, 45);
    v_anchor := coalesce(v_event.discovered_at, v_event.reported_at::date);

    insert into public.rca (event_id, status, due_date, created_by)
    values (p_event_id, 'draft', v_anchor + v_due_days, auth.uid())
    on conflict (event_id) do nothing;
  end if;

  perform set_config('app.in_safety_rpc', 'off', true);
  return v_triage;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."reopen_triage"("p_event_id" "uuid") RETURNS "public"."event_triage"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_triage public.event_triage;
begin
  perform app.assert_patient_safety_enabled();

  if not app.can_read_event(p_event_id, auth.uid()) then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;
  if not app.is_pqs_member_of(app.org_of_event(p_event_id)) then
    raise exception 'apenas o NSP pode reabrir uma triagem' using errcode = '42501';
  end if;

  if (select status from public.patient_safety_event where id = p_event_id) <> 'triaged' then
    raise exception 'apenas uma triagem confirmada pode ser reaberta' using errcode = 'HC045';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.patient_safety_event
  set status = 'acknowledged', updated_at = now()
  where id = p_event_id;

  update public.event_triage
  set triaged_by = null, triaged_at = null, updated_at = now()
  where event_id = p_event_id
  returning * into v_triage;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_triage;
end;
$$;

-- triage_disposition: read-only preview. No is_pqs gate (rides can_read_event); only
-- the pqs_department singleton read -> per-org via the event. Body otherwise verbatim.
CREATE OR REPLACE FUNCTION "public"."triage_disposition"("p_event_id" "uuid") RETURNS TABLE("event_id" "uuid", "is_pse" boolean, "reached" boolean, "severe" boolean, "is_sentinel" boolean, "verdict" "text", "review_pathway" "text", "rca_due_date" "date")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_t public.event_triage;
  v_event public.patient_safety_event;
  v_reached boolean;
  v_severe boolean;
  v_verdict text;
  v_pathway text;
  v_due date;
  v_due_days integer;
begin
  if not app.can_read_event(p_event_id, auth.uid()) then
    return;  -- out of scope: no rows
  end if;

  select * into v_event from public.patient_safety_event where id = p_event_id;
  if not found then
    return;
  end if;

  select * into v_t from public.event_triage where event_triage.event_id = p_event_id;

  v_reached := coalesce(v_t.reach in ('no_harm', 'adverse', 'sentinel'), false);
  v_severe := coalesce(v_t.harm_severity in ('severe', 'permanent', 'death'), false);

  if v_t.is_pse is false then
    v_verdict := 'closed';
    v_pathway := null;
  elsif coalesce(v_t.sentinel_determination, false) then
    v_verdict := 'rca';
    v_pathway := 'rca';
  elsif v_t.reach is not null then
    v_verdict := 'review';
    v_pathway := coalesce(v_t.review_pathway, 'peer_review');
  else
    v_verdict := 'pending';
    v_pathway := null;
  end if;

  if v_verdict = 'rca' then
    select rca_default_due_days into v_due_days
    from public.pqs_department where organization_id = app.org_of_event(p_event_id);
    v_due_days := coalesce(v_due_days, 45);
    v_due := coalesce(v_event.discovered_at, v_event.reported_at::date) + v_due_days;
  end if;

  return query select
    p_event_id, v_t.is_pse, v_reached, v_severe,
    coalesce(v_t.sentinel_determination, false), v_verdict, v_pathway, v_due;
end;
$$;

-- add_rca_member: the is_pqs_member bootstrap arm -> per-org via the rca's event.
CREATE OR REPLACE FUNCTION "public"."add_rca_member"("p_rca_id" "uuid", "p_role" "text", "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_external_name" "text" DEFAULT NULL::"text") RETURNS "public"."rca_members"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.rca_members;
begin
  perform app.assert_patient_safety_enabled();

  if (select event_id from public.rca where id = p_rca_id) is null then
    raise exception 'análise de causa raiz não encontrada' using errcode = 'no_data_found';
  end if;
  -- Bootstrap: per-org NSP OR an existing writer may add members.
  if not (app.is_pqs_member_of(app.org_of_event(app.event_of_rca(p_rca_id)))
          or app.can_write_rca(p_rca_id, auth.uid())) then
    raise exception 'você não pode editar esta análise de causa raiz' using errcode = 'HC048';
  end if;

  if p_role not in ('lead', 'facilitator', 'sme', 'reviewer', 'executive_sponsor', 'observer') then
    raise exception 'função inválida' using errcode = 'check_violation';
  end if;
  if not (
    (p_user_id is not null and (p_external_name is null or btrim(p_external_name) = ''))
    or (p_user_id is null and p_external_name is not null and btrim(p_external_name) <> '')
  ) then
    raise exception 'informe um usuário da plataforma OU um nome externo para o integrante'
      using errcode = 'check_violation';
  end if;
  if p_user_id is not null and not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'usuário não encontrado' using errcode = 'no_data_found';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  perform app.rca_bump_in_progress(p_rca_id);
  insert into public.rca_members (rca_id, user_id, external_name, role)
  values (p_rca_id, p_user_id, case when p_user_id is null then btrim(p_external_name) else null end, p_role)
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_row;
end;
$$;

-- open_capa_plan: the is_pqs_writer() create-gate -> per-org for event/rca sources;
-- "any-org NSP member" for the non-event sources (indicator/audit_finding/meeting/
-- manual carry no event PHI — faithful translation of the old global gate). Body
-- otherwise verbatim.
CREATE OR REPLACE FUNCTION "public"."open_capa_plan"("p_source" "text", "p_classification" "text" DEFAULT 'corretiva'::"text", "p_source_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."capa_plan"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_plan public.capa_plan;
  v_attempts int := 0;
  v_rca uuid;
  v_event uuid;
  v_meeting uuid;
  v_indicator uuid;
  v_audit uuid;
  v_src_event uuid;  -- the event the source resolves to (null for non-event sources)
  v_authorized boolean;
begin
  perform app.assert_patient_safety_enabled();

  if p_source not in ('rca', 'event', 'indicator', 'audit_finding', 'meeting', 'manual') then
    raise exception 'origem de plano inválida' using errcode = 'check_violation';
  end if;
  if coalesce(p_classification, 'corretiva') not in ('corretiva', 'preventiva', 'melhoria') then
    raise exception 'classificação inválida' using errcode = 'check_violation';
  end if;

  -- Route the source id to the matching column; require it for non-manual sources.
  if p_source = 'manual' then
    if p_source_id is not null then
      raise exception 'um plano manual não tem origem vinculada' using errcode = 'check_violation';
    end if;
  elsif p_source_id is null then
    raise exception 'informe a origem do plano de ação' using errcode = 'check_violation';
  else
    case p_source
      when 'rca' then v_rca := p_source_id;
      when 'event' then v_event := p_source_id;
      when 'meeting' then v_meeting := p_source_id;
      when 'indicator' then v_indicator := p_source_id;
      when 'audit_finding' then v_audit := p_source_id;
    end case;
  end if;

  -- Authority: per-org NSP when the source resolves to an event (event/rca);
  -- any-org NSP otherwise (no event PHI). Mirrors can_write_capa's branch.
  v_src_event := case
                   when p_source = 'event' then v_event
                   when p_source = 'rca' then app.event_of_rca(v_rca)
                   else null
                 end;
  if v_src_event is not null then
    v_authorized := app.is_pqs_member_of(app.org_of_event(v_src_event));
  else
    v_authorized := app.is_pqs_member_of_any(auth.uid());
  end if;
  if not v_authorized then
    raise exception 'apenas o NSP pode abrir planos de ação' using errcode = '42501';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  loop
    begin
      insert into public.capa_plan (
        source, source_rca_id, source_event_id, source_meeting_id,
        source_indicator_id, source_audit_finding_id, classification, opened_by
      ) values (
        p_source, v_rca, v_event, v_meeting, v_indicator, v_audit,
        coalesce(p_classification, 'corretiva'), auth.uid()
      )
      returning * into v_plan;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts >= 5 then raise; end if;
    end;
  end loop;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_plan;
end;
$$;

-- ---- NSP config-vocab CRUD (pqs_event_types / pqs_sentinel_criteria are
-- GLOBAL hospital-wide shared vocab, NOT per-org): is_pqs_member(auth.uid())
-- gate -> is_pqs_member_of_any(auth.uid()) (any-org NSP member may curate the
-- shared vocab). Bodies otherwise verbatim from 009000. ----

CREATE OR REPLACE FUNCTION "public"."create_event_type"("p_key" "text", "p_label" "text", "p_description" "text" DEFAULT NULL::"text") RETURNS "public"."pqs_event_types"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.pqs_event_types;
begin
  perform app.assert_patient_safety_enabled();
  if not app.is_pqs_member_of_any(auth.uid()) then
    raise exception 'apenas o NSP pode gerenciar tipos de evento' using errcode = '42501';
  end if;
  if btrim(coalesce(p_key, '')) = '' or btrim(coalesce(p_label, '')) = '' then
    raise exception 'informe um identificador e um rótulo' using errcode = 'check_violation';
  end if;
  insert into public.pqs_event_types (key, label, description, position)
  values (btrim(p_key), btrim(p_label), p_description,
          coalesce((select max(position) from public.pqs_event_types), 0) + 1)
  returning * into v_row;
  return v_row;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."update_event_type"("p_id" "uuid", "p_label" "text", "p_description" "text" DEFAULT NULL::"text") RETURNS "public"."pqs_event_types"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.pqs_event_types;
begin
  perform app.assert_patient_safety_enabled();
  if not app.is_pqs_member_of_any(auth.uid()) then
    raise exception 'apenas o NSP pode gerenciar tipos de evento' using errcode = '42501';
  end if;
  if btrim(coalesce(p_label, '')) = '' then
    raise exception 'informe um rótulo' using errcode = 'check_violation';
  end if;
  update public.pqs_event_types
  set label = btrim(p_label), description = p_description, updated_at = now()
  where id = p_id
  returning * into v_row;
  if not found then
    raise exception 'tipo de evento não encontrado' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."archive_event_type"("p_id" "uuid") RETURNS "public"."pqs_event_types"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.pqs_event_types;
begin
  perform app.assert_patient_safety_enabled();
  if not app.is_pqs_member_of_any(auth.uid()) then
    raise exception 'apenas o NSP pode gerenciar tipos de evento' using errcode = '42501';
  end if;
  update public.pqs_event_types
  set is_active = false, updated_at = now()
  where id = p_id
  returning * into v_row;
  if not found then
    raise exception 'tipo de evento não encontrado' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."reorder_event_types"("p_ordered_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.assert_patient_safety_enabled();
  if not app.is_pqs_member_of_any(auth.uid()) then
    raise exception 'apenas o NSP pode gerenciar tipos de evento' using errcode = '42501';
  end if;
  -- Single UPDATE against the deferrable position unique (offset into negatives first
  -- to avoid transient collisions, then renumber to 1..n by array order).
  update public.pqs_event_types
  set position = -position;
  update public.pqs_event_types t
  set position = ord.rn, updated_at = now()
  from (select id, row_number() over () as rn from unnest(p_ordered_ids) as id) ord
  where t.id = ord.id;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."create_sentinel_criterion"("p_key" "text", "p_label" "text", "p_description" "text" DEFAULT NULL::"text") RETURNS "public"."pqs_sentinel_criteria"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.pqs_sentinel_criteria;
begin
  perform app.assert_patient_safety_enabled();
  if not app.is_pqs_member_of_any(auth.uid()) then
    raise exception 'apenas o NSP pode gerenciar critérios de evento sentinela' using errcode = '42501';
  end if;
  if btrim(coalesce(p_key, '')) = '' or btrim(coalesce(p_label, '')) = '' then
    raise exception 'informe um identificador e um rótulo' using errcode = 'check_violation';
  end if;
  insert into public.pqs_sentinel_criteria (key, label, description, position)
  values (btrim(p_key), btrim(p_label), p_description,
          coalesce((select max(position) from public.pqs_sentinel_criteria), 0) + 1)
  returning * into v_row;
  return v_row;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."update_sentinel_criterion"("p_id" "uuid", "p_label" "text", "p_description" "text" DEFAULT NULL::"text") RETURNS "public"."pqs_sentinel_criteria"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.pqs_sentinel_criteria;
begin
  perform app.assert_patient_safety_enabled();
  if not app.is_pqs_member_of_any(auth.uid()) then
    raise exception 'apenas o NSP pode gerenciar critérios de evento sentinela' using errcode = '42501';
  end if;
  if btrim(coalesce(p_label, '')) = '' then
    raise exception 'informe um rótulo' using errcode = 'check_violation';
  end if;
  update public.pqs_sentinel_criteria
  set label = btrim(p_label), description = p_description, updated_at = now()
  where id = p_id
  returning * into v_row;
  if not found then
    raise exception 'critério não encontrado' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."archive_sentinel_criterion"("p_id" "uuid") RETURNS "public"."pqs_sentinel_criteria"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.pqs_sentinel_criteria;
begin
  perform app.assert_patient_safety_enabled();
  if not app.is_pqs_member_of_any(auth.uid()) then
    raise exception 'apenas o NSP pode gerenciar critérios de evento sentinela' using errcode = '42501';
  end if;
  update public.pqs_sentinel_criteria
  set is_active = false, updated_at = now()
  where id = p_id
  returning * into v_row;
  if not found then
    raise exception 'critério não encontrado' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."reorder_sentinel_criteria"("p_ordered_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.assert_patient_safety_enabled();
  if not app.is_pqs_member_of_any(auth.uid()) then
    raise exception 'apenas o NSP pode gerenciar critérios de evento sentinela' using errcode = '42501';
  end if;
  update public.pqs_sentinel_criteria
  set position = -position;
  update public.pqs_sentinel_criteria t
  set position = ord.rn, updated_at = now()
  from (select id, row_number() over () as rn from unnest(p_ordered_ids) as id) ord
  where t.id = ord.id;
end;
$$;


-- ===========================================================================
-- §A3c — DEFINER DOORS.
-- ===========================================================================

-- pqs_inbox: ORG-SCOPE the result set. The is_pqs_member(auth.uid()) WHERE term ->
-- "the reporting commission's org is one of the caller's enrolled orgs". An org-A
-- coordinator sees only org-A events; a non-member gets zero rows; a multi-org member
-- sees the union of their orgs. (reporting_commission_id is NOT NULL.)
CREATE OR REPLACE FUNCTION "public"."pqs_inbox"("p_status" "text" DEFAULT NULL::"text", "p_suspected_harm_level" "text" DEFAULT NULL::"text", "p_reporting_commission_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "code" "text", "title" "text", "status" "text", "suspected_harm_level" "text", "reporting_commission_id" "uuid", "reporting_commission_name" "text", "current_owner_kind" "text", "current_owner_commission_id" "uuid", "case_id" "uuid", "case_number" integer, "reported_at" timestamp with time zone, "acknowledged_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select
    e.id, e.code, e.title, e.status, e.suspected_harm_level,
    e.reporting_commission_id, rc.name,
    e.current_owner_kind, e.current_owner_commission_id,
    e.case_id, c.case_number,
    e.reported_at, e.acknowledged_at
  from public.patient_safety_event e
  join public.commissions rc on rc.id = e.reporting_commission_id
  left join public.cases c on c.id = e.case_id
  where rc.organization_id in (
          select organization_id from public.pqs_members where user_id = auth.uid()
        )
    and (p_status is null or e.status = p_status)
    and (p_suspected_harm_level is null or e.suspected_harm_level = p_suspected_harm_level)
    and (p_reporting_commission_id is null or e.reporting_commission_id = p_reporting_commission_id)
  order by e.reported_at desc;
$$;

-- dispose_event_phi: org-scope BOTH gate arms (lead ruling 2; ADR 0041 amd 11). The
-- platform is_admin() -> the EVENT'S ORG org_admin (LGPD erasure stays in-org; vendor
-- platform_admin walled off); the is_pqs_member arm -> per-org. Body otherwise verbatim
-- from 20260620019000_patient_index.sql.
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

  -- Gate: the event's-org org_admin OR the event's-org NSP. Disposal is a compliance/
  -- erasure action — it does NOT read PHI, so no can_read_event_patient. DEFINER
  -- bypasses RLS → re-check. (org_admin/NSP scoped to the event's org; the vendor
  -- platform_admin is NOT a tenant-path grant — ADR 0041 amendment 11.)
  if not (app.is_org_admin_of_commission(app.commission_of_event(p_event_id))
          or app.is_pqs_member_of(app.org_of_event(p_event_id))) then
    raise exception 'apenas um administrador da organização ou o NSP pode descartar dados do paciente'
      using errcode = '42501';
  end if;

  if p_reason is null or p_reason not in
       ('retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other') then
    raise exception 'motivo de descarte inválido' using errcode = 'check_violation';
  end if;

  select * into v_event from public.patient_safety_event where id = p_event_id;
  if v_event.id is null then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;

  if v_event.phi_disposed_at is not null then
    raise exception 'os dados do paciente deste evento já foram descartados'
      using errcode = 'HC056';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  perform set_config('app.phi_dispose_reason', p_reason, true);

  delete from public.event_patient where event_id = p_event_id;

  update public.patient_safety_event
     set description_md = null
   where id = p_event_id;

  update public.event_triage
     set disposition_notes_md = null
   where event_id = p_event_id;

  select id into v_rca_id from public.rca where event_id = p_event_id;
  if v_rca_id is not null then
    update public.rca
       set what_md = null, expected_md = null, summary_md = null,
           impact = null, scope = null
     where id = v_rca_id;
    update public.rca_factors          set text = v_redacted        where rca_id = v_rca_id;
    update public.rca_root_causes       set text = v_redacted        where rca_id = v_rca_id;
    update public.rca_timeline_entries  set description = v_redacted  where rca_id = v_rca_id;
  end if;

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

  update public.patient_safety_event
     set has_patient = false,
         phi_disposed_at = now(),
         phi_disposed_by = auth.uid(),
         phi_disposed_reason = p_reason,
         updated_at = now()
   where id = p_event_id;

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

-- is_pqs_member_self(): KEEP no-arg = "member of ANY org" (nav "show NSP at all";
-- gates referrals.ts listAllReferrals/referralFlowMetrics — must survive). Rebound
-- onto is_pqs_member_of_any.
CREATE OR REPLACE FUNCTION "public"."is_pqs_member_self"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.is_pqs_member_of_any(auth.uid());
$$;
ALTER FUNCTION "public"."is_pqs_member_self"() OWNER TO "postgres";

-- is_pqs_member_of_self(org): the ORG-SCOPED QPS-dashboard / NSP-route gate (the FE
-- getNspAccessByOrg seam). PHI-free boolean.
CREATE OR REPLACE FUNCTION "public"."is_pqs_member_of_self"("p_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.is_pqs_member_of(p_org_id);
$$;
ALTER FUNCTION "public"."is_pqs_member_of_self"("p_org_id" "uuid") OWNER TO "postgres";

-- is_nsp_coordinator_of_self(org): gates the per-org roster-curation UI + the
-- org_admin "appoint coordinator" affordance check. PHI-free boolean.
CREATE OR REPLACE FUNCTION "public"."is_nsp_coordinator_of_self"("p_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.is_nsp_coordinator_of(p_org_id);
$$;
ALTER FUNCTION "public"."is_nsp_coordinator_of_self"("p_org_id" "uuid") OWNER TO "postgres";

-- get_referral_detail: the QPS audit-exemption term -> per-org via the source
-- org. Read gate is can_read_referral (rebound). Body otherwise verbatim from
-- 20260620014000_referrals_rpcs.sql (only the is_pqs_member term changes).
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
  if not (v_is_source_coord or app.is_pqs_member_of(app.org_of_referral(p_referral_id))) then
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

-- Grants for the new public probe functions (mirror is_pqs_member_self's grants).
DO $g$
DECLARE fn text;
BEGIN
  FOR fn IN SELECT unnest(ARRAY[
    'public.is_pqs_member_of_self(uuid)',
    'public.is_nsp_coordinator_of_self(uuid)',
    'app.can_write_capa(uuid, uuid)'
  ]) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('GRANT ALL ON FUNCTION %s TO authenticated', fn);
    EXECUTE format('GRANT ALL ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $g$;

-- ===========================================================================
-- §A3d — FLAG / ASSERT REVERSIONS: drop the multi-org term (the point of the phase).
-- Revert patient_safety_enabled / referrals_enabled to flag-only; revert the two
-- assert_*_enabled to their original flag-only raise (009000 / 013000 bodies).
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."patient_safety_enabled"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.feature_enabled('patient_safety');
$$;

CREATE OR REPLACE FUNCTION "public"."referrals_enabled"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.feature_enabled('case_referrals');
$$;

CREATE OR REPLACE FUNCTION "app"."assert_patient_safety_enabled"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not app.feature_enabled('patient_safety') then
    raise exception 'o módulo de segurança do paciente não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;

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

-- ===========================================================================
-- §A3e — PER-ORG EVENT NUMBERING. mint_event_code: per-org advisory lock + per-org
-- max(suffix). Resolve new.reporting_commission_id -> org inside the BEFORE-INSERT
-- trigger. ENC-%04d (referrals) stays GLOBAL (intra-org; untouched).
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."mint_event_code"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $_$
declare
  v_next integer;
  v_org uuid := app.org_of_commission(new.reporting_commission_id);
begin
  -- Per-org advisory lock so two orgs mint concurrently without serializing on one key.
  perform pg_advisory_xact_lock(hashtextextended('pqs:event_code:' || coalesce(v_org::text, ''), 0));

  -- Highest existing EV-#### suffix + 1, FILTERED to this org's events (so an org
  -- cannot infer another org's event volume from gaps).
  v_next := coalesce(
    (select max((substring(e.code from 4))::integer)
     from public.patient_safety_event e
     join public.commissions c on c.id = e.reporting_commission_id
     where e.code ~ '^EV-[0-9]+$'
       and c.organization_id = v_org),
    0
  ) + 1;

  new.code := 'EV-' || lpad(v_next::text, 4, '0');
  return new;
end;
$_$;

-- ===========================================================================
-- §A3f — ROSTER CURATION RPCs: platform-admin+global -> coordinator+per-org.
-- DROP the old signatures (arity changed) so stale overloads don't linger, then
-- recreate with (p_org_id, …) + the is_nsp_coordinator_of(p_org_id) gate. set_pqs_
-- rca_due_window also moves per-org + audits at the ORG tier.
-- ===========================================================================
DROP FUNCTION IF EXISTS "public"."add_pqs_member"("uuid");
DROP FUNCTION IF EXISTS "public"."remove_pqs_member"("uuid");
DROP FUNCTION IF EXISTS "public"."list_pqs_members"();
DROP FUNCTION IF EXISTS "public"."set_pqs_rca_due_window"("integer");

-- add_pqs_member(org, user): coordinator-only enrollment into THAT org's roster.
CREATE OR REPLACE FUNCTION "public"."add_pqs_member"("p_org_id" "uuid", "p_user_id" "uuid") RETURNS "public"."pqs_members"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.pqs_members;
begin
  -- Per-org coordinator only (NOT org_admin, NOT platform_admin — duty separation).
  if not app.is_nsp_coordinator_of(p_org_id) then
    raise exception 'apenas o coordenador do NSP da organização pode gerenciar a equipe'
      using errcode = '42501';
  end if;
  insert into public.pqs_members (organization_id, user_id, added_by)
  values (p_org_id, p_user_id, auth.uid())
  on conflict (organization_id, user_id) do nothing;
  select * into v_row from public.pqs_members
    where organization_id = p_org_id and user_id = p_user_id;
  return v_row;
end;
$$;
ALTER FUNCTION "public"."add_pqs_member"("p_org_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

-- remove_pqs_member(org, user): coordinator-only removal.
CREATE OR REPLACE FUNCTION "public"."remove_pqs_member"("p_org_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not app.is_nsp_coordinator_of(p_org_id) then
    raise exception 'apenas o coordenador do NSP da organização pode gerenciar a equipe'
      using errcode = '42501';
  end if;
  delete from public.pqs_members
    where organization_id = p_org_id and user_id = p_user_id;
end;
$$;
ALTER FUNCTION "public"."remove_pqs_member"("p_org_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

-- list_pqs_members(org): COORDINATOR-ONLY (curation duty), filtered to the org.
CREATE OR REPLACE FUNCTION "public"."list_pqs_members"("p_org_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_result jsonb;
begin
  if not app.is_nsp_coordinator_of(p_org_id) then
    raise exception 'apenas o coordenador do NSP da organização pode listar a equipe'
      using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'userId', m.user_id,
             'fullName', p.full_name,
             'email', p.email,
             'addedAt', m.added_at,
             'addedBy', m.added_by
           )
           order by p.full_name
         ), '[]'::jsonb)
    into v_result
    from public.pqs_members m
    join public.profiles p on p.id = m.user_id
    where m.organization_id = p_org_id;
  return v_result;
end;
$$;
ALTER FUNCTION "public"."list_pqs_members"("p_org_id" "uuid") OWNER TO "postgres";

-- set_pqs_rca_due_window(org, days): coordinator OR enrolled member of the org;
-- updates THAT org's pqs_department row; audits at the ORG tier (p_organization).
CREATE OR REPLACE FUNCTION "public"."set_pqs_rca_due_window"("p_org_id" "uuid", "p_days" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_old integer;
  v_id uuid;
begin
  perform app.assert_patient_safety_enabled();
  -- The org's coordinator OR an enrolled member may set its window.
  if not (app.is_nsp_coordinator_of(p_org_id) or app.is_pqs_member_of(p_org_id)) then
    raise exception 'apenas o NSP pode configurar a janela de RCA' using errcode = '42501';
  end if;
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'a janela de RCA deve estar entre 1 e 365 dias' using errcode = 'HC046';
  end if;

  select id, rca_default_due_days into v_id, v_old
  from public.pqs_department where organization_id = p_org_id;
  if v_id is null then
    raise exception 'NSP não configurado' using errcode = 'P0002';
  end if;

  update public.pqs_department
  set rca_default_due_days = p_days, updated_at = now()
  where id = v_id;

  -- Audit at the ORG tier (was platform-tier in the global RPC). PHI-free integer.
  perform app.audit_write('pqs_config.rca_due_window_changed', 'pqs_department', v_id, null,
    'Janela de RCA do NSP definida para ' || p_days || ' dias',
    jsonb_build_object('rca_default_due_days',
      jsonb_build_object('old', v_old, 'new', p_days)),
    p_org_id);

  return p_days;
end;
$$;
ALTER FUNCTION "public"."set_pqs_rca_due_window"("p_org_id" "uuid", "p_days" integer) OWNER TO "postgres";

-- Grants for the recreated roster RPCs.
DO $g$
DECLARE fn text;
BEGIN
  FOR fn IN SELECT unnest(ARRAY[
    'public.add_pqs_member(uuid, uuid)',
    'public.remove_pqs_member(uuid, uuid)',
    'public.list_pqs_members(uuid)',
    'public.set_pqs_rca_due_window(uuid, integer)'
  ]) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('GRANT ALL ON FUNCTION %s TO authenticated', fn);
    EXECUTE format('GRANT ALL ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $g$;

-- ===========================================================================
-- §A3g(i) — STORAGE. Only capa_evidence_obj_insert_writable carried the bare global
-- is_pqs_writer() (the other 3 nsp-evidence policies already dropped is_admin in
-- …626000 and ride the rebound can_read_event/can_write_rca/can_read_capa -> org-
-- correct automatically). Rebind it to the event's-org writer (seg[1] = event_id).
-- ===========================================================================
DROP POLICY IF EXISTS "capa_evidence_obj_insert_writable" ON "storage"."objects";
CREATE POLICY "capa_evidence_obj_insert_writable" ON "storage"."objects"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    bucket_id = 'nsp-evidence'
    and app.is_pqs_writer_of(app.org_of_event(((storage.foldername(name))[1])::uuid))
  );

-- ===========================================================================
-- §A3g(ii) — PATIENT_INDEX (the FOURTH PHI surface). patient_xref aggregates across
-- ALL commissions with no org filter; org-scope every door + the RLS, with the audit
-- moved to the caller's org tier. patient_xref.commission_id is always resolved for
-- keyed rows (event->reporting / referral->source / case->case commission, all NOT
-- NULL — verified), so the org filter never drops a legit row; NULL-commission rows
-- deny (defensive).
-- ===========================================================================

-- can_read_xref_row: per-org gate for a single xref row (NULL commission -> deny).
CREATE OR REPLACE FUNCTION "app"."can_read_xref_row"("p_commission_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select p_commission_id is not null
     and app.is_pqs_member_of_for(app.org_of_commission(p_commission_id), p_uid);
$$;
ALTER FUNCTION "app"."can_read_xref_row"("p_commission_id" "uuid", "p_uid" "uuid") OWNER TO "postgres";

-- RLS: patient_xref SELECT -> per-org (was the global is_pqs_member(auth.uid())).
DROP POLICY IF EXISTS "patient_xref_select_pqs" ON "public"."patient_xref";
CREATE POLICY "patient_xref_select_pqs" ON "public"."patient_xref"
  FOR SELECT TO "authenticated"
  USING ("app"."can_read_xref_row"("commission_id", "auth"."uid"()));

-- patient_trajectory_bundle(keys, p_org_id): filter matched xref rows to p_org_id.
CREATE OR REPLACE FUNCTION "app"."patient_trajectory_bundle"("p_patient_key" "text", "p_encounter_key" "text", "p_org_id" "uuid") RETURNS "jsonb"
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
    where ((p_patient_key is not null and x.patient_key = p_patient_key)
        or (p_encounter_key is not null and x.encounter_key = p_encounter_key))
      -- ORG SCOPE: only this org's xref rows (no cross-org union for a multi-org member).
      and app.org_of_commission(x.commission_id) = p_org_id
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
ALTER FUNCTION "app"."patient_trajectory_bundle"("p_patient_key" "text", "p_encounter_key" "text", "p_org_id" "uuid") OWNER TO "postgres";

-- The old 2-arg bundle is replaced by the 3-arg org-scoped one.
DROP FUNCTION IF EXISTS "app"."patient_trajectory_bundle"("text", "text");

-- search_patient_xref(mrn, encounter, p_org_id): org-scoped QPS search. Gate on
-- enrollment in p_org_id; pass org to the bundle; audit at the ORG tier. (Arity
-- changed -> drop the old 2-arg.)
DROP FUNCTION IF EXISTS "public"."search_patient_xref"("text", "text");
CREATE OR REPLACE FUNCTION "public"."search_patient_xref"("p_mrn" "text" DEFAULT NULL::"text", "p_encounter" "text" DEFAULT NULL::"text", "p_org_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
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

  -- Duty separation + ORG scope: must be enrolled in THIS org's roster (a non-member,
  -- incl. another org's member or a non-PQS admin, gets the empty bundle).
  if p_org_id is null or not app.is_pqs_member_of(p_org_id) then
    return jsonb_build_object('matchedOn', null, 'matchCount', 0, 'entries', '[]'::jsonb);
  end if;

  v_patient_key := app.derive_patient_key(p_mrn);
  v_encounter_key := app.derive_patient_key(p_encounter);

  if v_patient_key is null and v_encounter_key is null then
    return jsonb_build_object('matchedOn', null, 'matchCount', 0, 'entries', '[]'::jsonb);
  end if;

  v_bundle := app.patient_trajectory_bundle(v_patient_key, v_encounter_key, p_org_id);
  v_count := coalesce((v_bundle ->> 'matchCount')::integer, 0);

  if v_count >= 1 then
    v_audit_key := coalesce(v_patient_key, v_encounter_key);
    perform app.audit_write(
      'patient.searched', 'patient', app.patient_key_to_uuid(v_audit_key), null,
      'Pesquisa de paciente entre comissões (' || v_count::text || ' registro(s))',
      jsonb_build_object('patient_key', left(v_audit_key, 12) || '…', 'matches', v_count),
      p_org_id
    );
  end if;

  return v_bundle;
end;
$$;
ALTER FUNCTION "public"."search_patient_xref"("p_mrn" "text", "p_encounter" "text", "p_org_id" "uuid") OWNER TO "postgres";

-- get_patient_trajectory_for_entity(module, entity_id): resolve the entity's org
-- SERVER-SIDE (its xref commission -> org), gate on enrollment in THAT org, pass it to
-- the bundle, audit at the org tier. Arity UNCHANGED (the pivot entity pins the org).
CREATE OR REPLACE FUNCTION "public"."get_patient_trajectory_for_entity"("p_module" "text", "p_entity_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" VOLATILE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_patient_key text;
  v_encounter_key text;
  v_commission uuid;
  v_org uuid;
  v_bundle jsonb;
  v_count integer;
  v_audit_key text;
begin
  perform app.assert_patient_index_enabled();

  if p_module is null or p_module not in ('event', 'referral', 'case') then
    raise exception 'módulo inválido' using errcode = 'check_violation';
  end if;

  select patient_key, encounter_key, commission_id
    into v_patient_key, v_encounter_key, v_commission
  from public.patient_xref
  where module = p_module and entity_id = p_entity_id;

  -- Unknown entity OR name-only (never indexed) -> nothing to pivot on.
  if v_patient_key is null and v_encounter_key is null then
    return jsonb_build_object('matchedOn', null, 'matchCount', 0, 'entries', '[]'::jsonb);
  end if;

  v_org := app.org_of_commission(v_commission);
  -- ORG scope + duty separation: must be enrolled in the pivot entity's org.
  if v_org is null or not app.is_pqs_member_of(v_org) then
    return jsonb_build_object('matchedOn', null, 'matchCount', 0, 'entries', '[]'::jsonb);
  end if;

  v_bundle := app.patient_trajectory_bundle(v_patient_key, v_encounter_key, v_org);
  v_count := coalesce((v_bundle ->> 'matchCount')::integer, 0);

  if v_count >= 1 then
    v_audit_key := coalesce(v_patient_key, v_encounter_key);
    perform app.audit_write(
      'patient.viewed', 'patient', p_entity_id, null,
      'Trajetória de paciente aberta a partir de um registro (' || v_count::text || ' registro(s))',
      jsonb_build_object('patient_key', left(v_audit_key, 12) || '…', 'matches', v_count),
      v_org
    );
  end if;

  return v_bundle;
end;
$$;
ALTER FUNCTION "public"."get_patient_trajectory_for_entity"("p_module" "text", "p_entity_id" "uuid") OWNER TO "postgres";

-- patient_access_audit(mrn, encounter, p_org_id): org-scoped. Gate on enrollment in
-- p_org_id; restrict the entity subquery to that org's xref rows AND audit_log rows of
-- that org's tier. (Arity changed -> drop the old 2-arg.)
DROP FUNCTION IF EXISTS "public"."patient_access_audit"("text", "text");
CREATE OR REPLACE FUNCTION "public"."patient_access_audit"("p_mrn" "text" DEFAULT NULL::"text", "p_encounter" "text" DEFAULT NULL::"text", "p_org_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_patient_key text;
  v_encounter_key text;
  v_rows jsonb;
begin
  perform app.assert_patient_index_enabled();

  if p_org_id is null or not app.is_pqs_member_of(p_org_id) then
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
  where a.organization_id = p_org_id  -- ORG scope on the audit tier
    and a.entity_id in (
      select x.entity_id
      from public.patient_xref x
      where ((v_patient_key is not null and x.patient_key = v_patient_key)
          or (v_encounter_key is not null and x.encounter_key = v_encounter_key))
        and app.org_of_commission(x.commission_id) = p_org_id  -- ORG scope on the xref rows
    );

  return v_rows;
end;
$$;
ALTER FUNCTION "public"."patient_access_audit"("p_mrn" "text", "p_encounter" "text", "p_org_id" "uuid") OWNER TO "postgres";

-- patient_xref_count(module, entity_id): the gate (can_read_referral_phi) is rebound;
-- ORG-SCOPE the count to the entity's org so a B-side reader cannot infer cross-org
-- links. Arity unchanged. Body otherwise verbatim from 019000.
CREATE OR REPLACE FUNCTION "public"."patient_xref_count"("p_module" "text", "p_entity_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_patient_key text;
  v_org uuid;
  v_count integer;
begin
  perform app.assert_patient_index_enabled();

  if p_module is null or p_module not in ('event', 'referral', 'case') then
    return 0;
  end if;

  if p_module = 'referral' then
    if not app.can_read_referral_phi(p_entity_id, auth.uid()) then
      return 0;
    end if;
  else
    return 0;
  end if;

  select patient_key, app.org_of_commission(commission_id)
    into v_patient_key, v_org
  from public.patient_xref
  where module = p_module and entity_id = p_entity_id;

  if v_patient_key is null then
    return 0;  -- name-only / not indexed -> no cross-links to count
  end if;

  -- ORG-SCOPE: count only OTHER non-disposed xref rows in the SAME org.
  select count(*)
    into v_count
  from public.patient_xref x
  where x.patient_key = v_patient_key
    and x.disposed_at is null
    and app.org_of_commission(x.commission_id) = v_org
    and not (x.module = p_module and x.entity_id = p_entity_id);

  return coalesce(v_count, 0);
end;
$$;
ALTER FUNCTION "public"."patient_xref_count"("p_module" "text", "p_entity_id" "uuid") OWNER TO "postgres";

-- Grants for the org-scoped patient_index doors (mirror their originals).
DO $g$
DECLARE fn text;
BEGIN
  FOR fn IN SELECT unnest(ARRAY[
    'app.can_read_xref_row(uuid, uuid)',
    'app.patient_trajectory_bundle(text, text, uuid)',
    'public.search_patient_xref(text, text, uuid)',
    'public.get_patient_trajectory_for_entity(text, uuid)',
    'public.patient_access_audit(text, text, uuid)',
    'public.patient_xref_count(text, uuid)'
  ]) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('GRANT ALL ON FUNCTION %s TO authenticated', fn);
    EXECUTE format('GRANT ALL ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $g$;

-- ===========================================================================
-- §A3h — FORBID CROSS-ORG REFERRALS. case_referral_distinct_commissions only forbids
-- self-referral; a referral could structurally span orgs (a cross-customer PHI
-- channel). Add an org guard to create_referral_draft + filter the target picker to
-- the source's org. (Cross-HOSPITAL, same-org referrals stay fine.)
-- ===========================================================================
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
  -- FORBID CROSS-ORG: source and target must be in the SAME organization (a referral
  -- is an intra-org, possibly cross-hospital, channel — never cross-customer PHI).
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

-- list_referral_target_commissions(source): filter to the SOURCE'S ORG (was every
-- commission). Body otherwise verbatim from 20260620014000_referrals_rpcs.sql.
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
      and c.organization_id = app.org_of_commission(p_source_commission_id)  -- same org only
    order by c.name asc;
end;
$$;

-- ===========================================================================
-- §A3i — DROPS (LAST). The 5 guard-migration predicates were already CREATE OR
-- REPLACEd above with NO is_multi_org reference (§A3a + can_read_case[_patient]).
-- Now drop the interim guard + the global PQS predicates. TS-callsite grep was clean
-- (only is_pqs_member_self() is TS-consumed, and it is KEPT, rebound onto
-- is_pqs_member_of_any) -> no deprecation shim needed.
-- ===========================================================================
DROP FUNCTION IF EXISTS "app"."is_multi_org"();
DROP FUNCTION IF EXISTS "app"."is_pqs_member"("uuid");
DROP FUNCTION IF EXISTS "app"."is_pqs_writer"();
