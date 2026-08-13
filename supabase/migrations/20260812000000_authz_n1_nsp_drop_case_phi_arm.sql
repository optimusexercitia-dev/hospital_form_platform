-- ADR 0078 D8 / N1 (Stage F-min pre-pilot): drop the NSP automatic patient-identifier
-- arm from the CASE capability resolver.
--
-- The D8 text ("remove is_pqs_operator_of_for from can_read_case_patient") describes the
-- PRE-Gate-1 shape; Gate 1 made can_read_case_patient a thin projection over
-- has_case_capability(..., 'read_standard_phi') with ZERO arms. The NSP arm now lives in
-- the resolver app._case_caps, branch S6 (nsp_referral_touched). This migration re-emits
-- _case_caps from its LIVE pg_get_functiondef (ADR 0078 A28 — preserving the Gate-1
-- defect-①/A15/A16 fixes byte-for-byte) and removes EXACTLY ONE bit from S6:
--   `| app._cap_bit('read_standard_phi')`.
-- read_case_content and read_case_deliberation are KEPT (NSP oversight reach retained).
-- Nothing else in the resolver changes. can_read_case / can_read_case_patient projections,
-- is_pqs_operator_of_for and its OTHER consumers (event PHI, referral PHI, xref, capa/rca)
-- are untouched. The S1 coordinator and S3 manual_grant read_standard_phi sources stay,
-- so an NSP operator obtains case PHI only through an explicit grant until Stage D.

CREATE OR REPLACE FUNCTION app._case_caps(p_case_id uuid, p_uid uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_caps       int  := 0;
  v_commission uuid;
  v_policy     text;
  v_eg         boolean;
  v_coord      boolean;
  v_orgadmin   boolean;
  v_member     boolean;
  v_g          record;
begin
  -- STEP 1 — null user => 0.
  if p_uid is null then
    return 0;
  end if;

  -- STEP 2 — D3 outer gate: a deactivated/suspended principal reaches nothing.
  if not app.is_active(p_uid) then
    return 0;
  end if;

  -- STEP 3 — tenant anchors. Unknown case => fail closed.
  select commission_id, visibility_policy
    into v_commission, v_policy
  from public.cases where id = p_case_id;
  if v_commission is null then
    return 0;
  end if;

  -- STEP 4 — HARD DENY, before every positive arm (ADR 0072 D2). A respondent or a
  -- recused user is denied even where a positive arm would grant.
  if app.is_case_respondent(p_case_id, p_uid) then
    return 0;
  end if;
  if app.is_recused_from_case(p_case_id, p_uid) then
    return 0;
  end if;

  -- STEP 5 — union the positive sources.
  v_eg       := (v_policy = 'explicit_grants_only');
  v_coord    := app.is_staff_admin_of_for(v_commission, p_uid);
  v_orgadmin := app.is_commission_admin_of_for(v_commission, p_uid);
  v_member   := app.is_member_of_for(v_commission, p_uid);

  -- ── S6 · nsp_referral_touched — content + deliberation ONLY; NO PHI. The
  --         read_standard_phi bit was REMOVED here (ADR 0078 D8/N1): an NSP operator
  --         keeps Case Content reach on a referral-touched case (its oversight job) but
  --         LOSES the automatic patient-identifier arm — D1 (Standard PHI is separate
  --         from Case Content) applied consistently. Until Stage D, NSP obtains case PHI
  --         through an explicit grant (the S1 coordinator / S3 manual_grant arms below
  --         still confer read_standard_phi). ────────────────────────────────────────
  if app.feature_enabled('case_referrals')
     and app.is_pqs_operator_of_for(app.hospital_of_commission(v_commission), p_uid)
     and exists (
       select 1 from public.case_referral r
       where r.source_case_id = p_case_id or r.target_case_id = p_case_id
     ) then
    v_caps := v_caps | app._cap_bit('read_case_content')
                     | app._cap_bit('read_case_deliberation');
  end if;

  -- ── S1 · committee_coordinator — all EXCEPT read_restricted_phi (D5·6). ───────
  if v_coord then
    v_caps := v_caps | app._cap_bit('view_case_overview')
                     | app._cap_bit('read_case_deliberation')
                     | app._cap_bit('read_case_content')
                     | app._cap_bit('read_standard_phi')
                     | app._cap_bit('write_case_content')
                     | app._cap_bit('manage_case_access');
  end if;

  -- ── S2 · org_admin — manage_case_access ONLY (A4 removed content/deliberation). ─
  if v_orgadmin then
    v_caps := v_caps | app._cap_bit('manage_case_access');
  end if;

  -- ── S5 · committee_member_default — read_case_deliberation ONLY (A15). ────────
  if v_member and not v_eg then
    v_caps := v_caps | app._cap_bit('read_case_deliberation');
  end if;

  -- ── S3 · manual_grant (case_access_grants — per-column capabilities). ─────────
  -- ⭐ DEFECT ①·2 CLOSED: read_standard_phi is conferred iff its COLUMN is set,
  -- NEVER inferred from a read/write grant and NEVER from write (A16). Lattice
  -- closure applied on read. NO feature-flag branch (the flag is retired); the
  -- flag-OFF legacy member arm (S5L) is DELETED (D9). Multiple active grants union
  -- (the active partial-unique bounds it to one per source, but the loop is robust).
  for v_g in
    select read_case_content, read_case_deliberation, read_standard_phi,
           read_restricted_phi, write_case_content
    from public.case_access_grants g
    where g.case_id = p_case_id and g.principal_id = p_uid
      and g.revoked_at is null
      and (g.expires_at is null or g.expires_at > now())
  loop
    -- Faithful to the pre-cut grant arm: it conferred content + deliberation (NOT
    -- view_case_overview — that RESERVED bit stays coordinator-only), so the mechanism
    -- swap keeps GAINED=0 on the raw bitmask, not only on consumed reach.
    if v_g.write_case_content then
      v_caps := v_caps | app._cap_bit('write_case_content')
                       | app._cap_bit('read_case_content')
                       | app._cap_bit('read_case_deliberation');
    end if;
    if v_g.read_case_content then
      v_caps := v_caps | app._cap_bit('read_case_content')
                       | app._cap_bit('read_case_deliberation');
    end if;
    if v_g.read_case_deliberation then
      v_caps := v_caps | app._cap_bit('read_case_deliberation');
    end if;
    if v_g.read_standard_phi then
      v_caps := v_caps | app._cap_bit('read_standard_phi');
    end if;
    if v_g.read_restricted_phi then
      v_caps := v_caps | app._cap_bit('read_restricted_phi')
                       | app._cap_bit('read_standard_phi');
    end if;
  end loop;

  -- ── S4 · case_assignment — read_case_content + read_case_deliberation ONLY
  --         (NEVER PHI — defect ①; NEVER write — D10). Unchanged from A2. ────────
  if exists (select 1 from public.case_phases cp
             where cp.case_id = p_case_id and cp.assigned_to = p_uid)
     or exists (select 1 from public.case_narratives cn
                where cn.case_id = p_case_id and cn.assigned_to = p_uid) then
    v_caps := v_caps | app._cap_bit('read_case_content')
                     | app._cap_bit('read_case_deliberation');
  end if;

  -- STEP 6 — return. (No lifecycle step; guard_case_status owns terminal-freeze.)
  return v_caps;
end;
$function$;
