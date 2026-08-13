-- =============================================================================
-- QO·A M4 — the S7 quality_reviewer arm of the capability resolver
-- (ADR 0100 D3/D4/D5/D6/D7).
--
-- BODY RE-EMITTED FROM THE LIVE CATALOG (pg_get_functiondef, 2026-08-06); same
-- signature => CREATE OR REPLACE preserves owner + ACL. Exactly three edits,
-- diffed post-apply:
--   1. the S7 arm, inserted after S5 (cheap short-circuits first) and before
--      the S3 grant loop;
--   2. the S3 in-loop comment — its "view_case_overview ... stays
--      coordinator-only" parenthetical went stale the moment D3 widened the bit
--      (a comment is an assertion that goes stale silently);
--   3. app._cap_bit's "RESERVED + UNCONSUMED" annotation on the same bit, the
--      second stale-comment site (buildnotes row 14).
--
-- Propagation is automatic and deliberate: cases_select routes can_read_case ->
-- has_case_capability('read_case_content') -> this resolver, and list_cases_board
-- filters app.can_read_case per row. can_read_case_patient projects
-- read_standard_phi, which S7 never confers — PHI stays closed (D5, pinned by
-- pgTAP 308).
-- =============================================================================

create or replace function app._case_caps(p_case_id uuid, p_uid uuid)
 returns integer
 language plpgsql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
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

  -- ── S7 · quality_reviewer (ADR 0100 D1/D3) — read_case_content +
  --         view_case_overview, on an oversight-VISIBLE commission of a hospital
  --         the principal reviews. DELIBERATE ABSENCES: no read_case_deliberation
  --         (D4 — the S3/S4 read-closure rung is intentionally NOT applied here),
  --         no PHI bits (D5), no write bits (D7). Locked cases (v_eg) are fully
  --         invisible to the arm (D6) — exceptions ride case_access_grants (S3).
  --         Inherits STEP-2 is_active, STEP-3 fail-closed-unknown-case and the
  --         STEP-4 hard denies by position. Cost: `not v_eg` short-circuits
  --         first, then one memberships_hospital_idx probe + one commissions PK
  --         read. ─────────────────────────────────────────────────────────────
  if not v_eg
     and app.is_quality_reviewer_of_for(app.hospital_of_commission(v_commission), p_uid)
     and (select quality_oversight from public.commissions where id = v_commission) = 'visible' then
    v_caps := v_caps | app._cap_bit('read_case_content')
                     | app._cap_bit('view_case_overview');
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
    -- view_case_overview — grants never confer it; since ADR 0100 D3 that bit
    -- comes from the S1 coordinator and S7 quality_reviewer arms only), so the
    -- mechanism swap keeps GAINED=0 on the raw bitmask, not only on consumed reach.
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

-- -----------------------------------------------------------------------------
-- app._cap_bit — semantically IDENTICAL re-emission; the only change is the
-- view_case_overview annotation (stale-comment site #2). IMMUTABLE, plain
-- invoker, no search_path — exactly as captured live.
-- -----------------------------------------------------------------------------
create or replace function app._cap_bit(p_cap text)
 returns integer
 language sql
 immutable
as $function$
  select case p_cap
    when 'view_case_overview'     then 1    -- conferred by S1 (coordinator) + S7 (quality_reviewer — ADR 0100 D3
                                            -- deliberately widened the old coordinator-only RESERVED contract);
                                            -- still no projection consumer.
    when 'read_case_deliberation' then 2    -- projected by can_reach_case_on_member_surface
    when 'read_case_content'      then 4    -- projected by can_read_case
    when 'read_standard_phi'      then 8    -- projected by can_read_case_patient (Rule 12)
    when 'read_restricted_phi'    then 16   -- RESERVED + UNCONSUMED (A16, extended per A2·C7)
    when 'write_case_content'     then 32   -- projected by can_write_case_content
    when 'manage_case_access'     then 64   -- UNCONSUMED by the resolver: grant_case_access
                                            -- gates itself directly. Wired to mirror that
                                            -- door, decorative until a consumer exists.
  end;
$function$;

-- Self-check: the S7 arm landed and confers exactly content|overview (5), and
-- the resolver still ends at S4 (no accidental truncation of the re-emission).
do $$
declare v_src text := (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g')
                       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'app' and p.proname = '_case_caps');
begin
  if v_src !~ 'is_quality_reviewer_of_for' then
    raise exception 'M4 postcondition: S7 arm missing from _case_caps';
  end if;
  if v_src !~ 'assigned_to = p_uid' then
    raise exception 'M4 postcondition: the S4 tail is missing — re-emission truncated';
  end if;
  if app._cap_bit('read_case_content') | app._cap_bit('view_case_overview') <> 5 then
    raise exception 'M4 postcondition: _cap_bit re-emission changed the lattice values';
  end if;
end $$;
