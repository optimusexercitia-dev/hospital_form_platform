-- ----------------------------------------------------------------------------
-- Multi-org PHI safety guard (gate-blocking). Forward-only.
--
-- The NSP / patient-safety and inter-committee referral modules rely on a SINGLE
-- GLOBAL PQS/QPS roster (`public.pqs_members` + app.is_pqs_member). With more than
-- one organization in a pooled DB, a global PQS member of org A would read PHI of
-- org B through that global-roster term — a cross-org leak. NSP-per-org (per-org
-- rosters + event scoping) is a follow-up phase; in the interim we CLOSE the leak
-- by making the global-roster PHI paths INERT whenever there is >1 org.
--
-- Two layers:
--   (1) READ guard (security-critical, defense-in-depth): the global-PQS/QPS term
--       in each PHI read predicate goes inert in multi-org. The ORG-BOUNDED terms
--       (member / custody / reporting-commission / staff_admin / case_access /
--       coordinator / assignee) are untouched — they are already org-safe.
--   (2) MODULE-OFF (UX + entry gates): patient_safety_enabled() / referrals_enabled()
--       return false in multi-org, and the RPC entry asserts raise. The seed creates
--       all NSP/referral rows via DIRECT inserts (never the guarded RPCs), so the
--       2-org seed stays green with no seed change.
--
-- NOTE (divergence from the brief): can_read_case_patient (Phase B) DOES carry the
-- QPS referral-macro term (added for parity with can_read_case), so it is guarded
-- here too — otherwise a global PQS member could read a foreign org's case PHI
-- IDENTIFIERS via the single door. Its org-bounded terms stay untouched.
-- ----------------------------------------------------------------------------
SET check_function_bodies = false;
SET client_min_messages = warning;

-- ===========================================================================
-- (0) The guard predicate: is this a multi-organization deployment?
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."is_multi_org"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select (select count(*) from public.organizations) > 1;
$$;

ALTER FUNCTION "app"."is_multi_org"() OWNER TO "postgres";

-- ===========================================================================
-- (0b) PRIMARY, COMPLETE closure — gate is_pqs_member AT ITS SOURCE.
--
-- Every global-PQS/QPS PHI path (read predicates, the pqs_inbox / get_referral_*
-- / search_patient_* doors, the RCA/CAPA/triage write gates via is_pqs_writer)
-- funnels through app.is_pqs_member. Making IT inert in multi-org closes the
-- ENTIRE global-roster surface at one chokepoint — no call-site enumeration to
-- get wrong (a single missed predicate is a PHI leak). The ORG-BOUNDED terms
-- (member / custody / reporting-commission / staff_admin / case_access /
-- coordinator / assignee) are all independent of is_pqs_member, so they keep
-- working. The disposal exception (dispose_event_phi = is_admin OR is_pqs_member)
-- still works via is_admin. In single-org is_multi_org() is false, so behavior is
-- byte-identical to today (the whole pgTAP PQS suite stays valid).
--
-- The per-predicate guards in (1) below are kept as DEFENSE-IN-DEPTH (the brief
-- asked for them explicitly) — redundant with this chokepoint but cheap.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."is_pqs_member"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  -- Global PQS/QPS roster is INERT in a multi-org deployment (pending NSP-per-org):
  -- the single roster cannot safely span orgs, so global-PQS authority is withdrawn
  -- platform-wide. Org-bounded access is unaffected (it never routed through here).
  select (select count(*) from public.organizations) <= 1
     and exists (select 1 from public.pqs_members where user_id = p_user_id);
$$;

-- ===========================================================================
-- (1) READ guards (DEFENSE-IN-DEPTH) — wrap the global-PQS/QPS term with
-- `and not is_multi_org()`. Redundant with (0b) but explicit at each PHI read.
-- ===========================================================================

-- can_read_event: the reporting-commission + custody terms are org-safe; gate the
-- global-PQS term.
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
        or (app.is_pqs_member(p_user_id) and not app.is_multi_org())
      )
  );
$$;

-- can_read_event_patient: the PHI-IDENTIFIER single-door predicate (tightest). Its
-- global-PQS term is gated; the access-follows-custody staff_admin term is org-safe.
-- (Already closed by the (0b) chokepoint; explicit here at the identifier door.)
CREATE OR REPLACE FUNCTION "app"."can_read_event_patient"("p_event_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.patient_safety_event e
    where e.id = p_event_id
      and (
        (app.is_pqs_member(p_user_id) and not app.is_multi_org())
        or app.is_staff_admin_of_for(e.current_owner_commission_id, p_user_id)
      )
  );
$$;

-- can_read_referral_phi: the source/target staff_admin terms + the analyst term are
-- org-bounded; gate the global-PQS term.
CREATE OR REPLACE FUNCTION "app"."can_read_referral_phi"("p_referral_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and (
        (app.is_pqs_member(p_uid) and not app.is_multi_org())
        or app.is_staff_admin_of_for(r.source_commission_id, p_uid)
        or app.is_staff_admin_of_for(r.target_commission_id, p_uid)
      )
  )
  or app.referral_target_analyst(p_referral_id, p_uid);
$$;

-- can_read_case: gate the QPS referral-macro term; the org-bounded governance /
-- assignee / grantee terms stay.
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

  -- QPS macro-view of any referral-touched case — INERT in multi-org (global PQS).
  if app.feature_enabled('case_referrals') and app.is_pqs_member(p_uid)
     and not app.is_multi_org()
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

-- can_read_case_patient: same QPS referral-macro term (parity with can_read_case)
-- guarded; the org-bounded worker terms (staff_admin / case_access / assignee /
-- the flag-OFF member-read) stay untouched — they are commission-bounded.
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

  -- QPS macro-view of any referral-touched case — INERT in multi-org (global PQS).
  if app.feature_enabled('case_referrals') and app.is_pqs_member(p_uid)
     and not app.is_multi_org()
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
-- (2) MODULE-OFF — the *_enabled() flag reads + the RPC entry asserts go false /
-- raise in multi-org. The seed never calls the guarded RPCs (direct inserts), so
-- the 2-org seed is unaffected.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."patient_safety_enabled"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.feature_enabled('patient_safety') and not app.is_multi_org();
$$;

CREATE OR REPLACE FUNCTION "public"."referrals_enabled"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.feature_enabled('case_referrals') and not app.is_multi_org();
$$;

CREATE OR REPLACE FUNCTION "app"."assert_patient_safety_enabled"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not app.feature_enabled('patient_safety') or app.is_multi_org() then
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
  if not app.feature_enabled('case_referrals') or app.is_multi_org() then
    raise exception 'o recurso de encaminhamentos não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;

-- ===========================================================================
-- Grants — is_multi_org mirrors the other app predicates.
-- ===========================================================================
REVOKE ALL ON FUNCTION "app"."is_multi_org"() FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."is_multi_org"() TO "authenticated";
GRANT ALL ON FUNCTION "app"."is_multi_org"() TO "service_role";
