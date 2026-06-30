-- ----------------------------------------------------------------------------
-- cases_meetings_minor — small additive changes for the Cases/Meetings batch
-- ----------------------------------------------------------------------------
-- Two independent, additive changes (forward-only; no prior migration edited):
--
--   A1. public.list_case_access(p_case) — a coordinator/admin-gated read of the
--       explicit `case_access` grant rows for a case. The existing
--       `case_access_select` RLS policy already lets coordinators read those
--       rows, but it (a) does NOT respect the `case_access` feature flag and
--       (b) also exposes a non-coordinator grantee their OWN row. A flag-
--       respecting, coordinator/admin-ONLY read of ALL grants is the clean fit,
--       so this is a SECURITY DEFINER read that mirrors `grant_case_access` /
--       `revoke_case_access` EXACTLY (assert_case_access_enabled + the
--       staff_admin-of / org-admin-of-commission gate). It backs the
--       "Acesso ao caso" dialog's grant badges. Grants are configuration, not
--       PHI; like grant/revoke_case_access this emits no audit row (Rule 11 —
--       read-logging is for other members' data / PHI, not config).
--
--   A2. public.case_events.occurred_time time — an OPTIONAL companion to the
--       existing `occurred_at date` so a manual case event can carry a wall-clock
--       time. Additive + nullable; `occurred_at` stays a date. The create/update
--       of a case event is a direct (RLS-scoped) supabase-js table write, so no
--       RPC changes — the column flows through the existing
--       `case_events_select` / `case_events_*_write` policies unchanged.
--
-- House style mirrors 20260620017000_case_patient.sql: public.* objects OWNER
-- postgres; this file carries its own self-contained grant block.
-- ----------------------------------------------------------------------------

-- ============================================================================
-- A2 — case_events.occurred_time (additive column)
-- ============================================================================

ALTER TABLE "public"."case_events"
  ADD COLUMN IF NOT EXISTS "occurred_time" time without time zone;

COMMENT ON COLUMN "public"."case_events"."occurred_time" IS
  'Optional wall-clock time companion to occurred_at (date). NULL = no time. Governance metadata, not PHI; surfaced as HH:mm in the UI.';

-- ============================================================================
-- A1 — list_case_access (coordinator/admin-gated DEFINER read of grant rows)
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."list_case_access"("p_case" "uuid")
  RETURNS TABLE("user_id" "uuid", "level" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission uuid;
begin
  -- Respect the case_access feature flag, exactly like grant_case_access.
  perform app.assert_case_access_enabled();

  select commission_id into v_commission from public.cases where id = p_case;
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case using errcode = 'no_data_found';
  end if;
  -- DEFINER: the RLS bypass is intentional, so this internal coordinator/admin
  -- gate is the authority (mirrors grant_case_access / revoke_case_access).
  if not (app.is_staff_admin_of(v_commission) or app.is_org_admin_of_commission(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  return query
    select ca.user_id, ca.level
    from public.case_access ca
    where ca.case_id = p_case
    order by ca.granted_at;
end;
$$;

ALTER FUNCTION "public"."list_case_access"("p_case" "uuid") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."list_case_access"("p_case" "uuid") IS
  'Coordinator/admin-gated read of the explicit case_access grant rows for a case (ADR 0033 D6). SECURITY DEFINER; mirrors grant_case_access authz (assert_case_access_enabled + staff_admin/org-admin-of-commission). Returns (user_id, level); grants are config (not PHI), so no audit row.';

-- ---------------------------------------------------------------------------
-- Grants (self-contained; mirrors the sibling case_access RPCs)
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION "public"."list_case_access"("p_case" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_case_access"("p_case" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_case_access"("p_case" "uuid") TO "service_role";
