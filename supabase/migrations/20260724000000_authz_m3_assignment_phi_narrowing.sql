-- =============================================================================
-- AUTHZ · M3 — defect ①: bare assignment must NOT confer patient identifiers.
-- ADR 0078 confirmed defect ① — one of the THREE justifications for this program,
-- and the ADR's own words: "can_write_case_content DOES filter ca.level='write';
-- the PHI door filters nothing. So a grant deliberately issued read-only opens
-- patient identifiers, and a bare phase or narrative assignment does the same,
-- unqualified. This is the single most consequential finding."
--
-- Amends ARCHITECTURE.md Rule 12 (per the ADR): "Standard PHI becomes a capability
-- distinct from Case Content; ordinary case read and bare assignment no longer
-- imply patient-identifier read."
--
-- ⚠⚠ THIS IS A NARROWING, NOT A DENIAL — the first on this program. M1/M2 removed
-- reach nobody should have had; M3 removes reach people HAVE TODAY. A narrowing
-- that denies EVERYONE passes its negative BY CONSTRUCTION, so the positive twin
-- is the whole risk and is mandatory (230, keystoned + mutation-proven).
--
-- ⛔ SCOPE FENCE: `can_read_case_patient` ONLY. No resolver, no case_access_grants,
-- no A21 arm removal, no member/NSP/org changes. `can_read_case` KEEPS both
-- assignment arms — assignment is CONTENT reach (D10), and 230 asserts that.
--
-- PROVEN BEFORE THE FIX (live catalog, rolled back) — the arm was live:
--   st_x2 is staff_admin?           = false
--   st_x2 has a case_access grant?  = false
--   st_x2 can_read_case (content)   = true
--   st_x2 can_read_case_patient     = true    ← a bare narrative assignee read PHI
--
-- =============================================================================
-- ⛔ THE `case_access` LEVEL FILTER IS **NOT** FIXED HERE — DELIBERATE, WITH EVIDENCE.
--
-- The brief asked me to fix it "if today's shape supports it" and to say so with
-- evidence if it does not. It does not, for two independent catalog-verified
-- reasons:
--
--  1. `case_access.level` is `CHECK (level IN ('read','write'))` — it expresses
--     WRITE AUTHORITY, not PHI. Filtering PHI on `level='write'` would encode
--     `write_case_content ⇒ read_standard_phi`. **A16's lattice puts them on
--     DISJOINT CHAINS:**
--         write_case_content ⇒ read_case_content ⇒ {view_case_overview, read_case_deliberation}
--         read_restricted_phi ⇒ read_standard_phi
--     So that filter would contradict the target model, not implement it. It would
--     also make "read + PHI" ungrantable — a capability that exists today.
--
--  2. `case_access.max_confidentiality` is NOT the standard-PHI door: the ADR
--     explicitly migrates it to `case_access_grants.read_restricted_phi` (D5·4) —
--     the RESTRICTED tier. And it is NULL on the large majority of live rows (3 of 4
--     on the seeded stack), so filtering on it would revoke PHI from nearly every
--     existing grant — far beyond defect ① and straight through the positive twin.
--     (The argument rests on the DIRECTION, not the count: seed volumes move.)
--
-- The capability this needs is `case_access_grants.read_standard_phi` — an explicit
-- per-capability column that **arrives at Stage B (B1)**. Inventing a proxy for it
-- on today's two-value `level` is exactly the "do not invent a shape" trap.
-- 230 therefore PINS today's grant behaviour (a `read` grant still confers PHI) so
-- that B1's change is VISIBLE as a change rather than silent.
-- =============================================================================

create or replace function app.can_read_case_patient(p_case_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return false;
  end if;

  -- ⟵E1 HARD DENY (respondent must not reach the PHI door either; recused likewise).
  if app.is_case_respondent(p_case_id, p_uid) then
    return false;
  end if;
  if app.is_recused_from_case(p_case_id, p_uid) then
    return false;
  end if;

  -- QPS macro-view of any referral-touched case — per-HOSPITAL.
  --
  -- ⛔⛔ THIS ARM IS **LIVE**, AND IT CONFERS PHI. `case_referrals` is **ENABLED**
  -- (`app.feature_enabled('case_referrals') = t`; baseline force-sets it `true` in
  -- every environment via `on conflict … do update set enabled = excluded.enabled`).
  -- Its `description` says "Ships OFF" — **the description is stale prose; only the
  -- `enabled` column is the flag.** I previously reported this arm as INERT on the
  -- strength of that prose. That was WRONG.
  --
  -- Consequence, stated plainly so this comment does not suppress it: PQS/NSP
  -- operators read **patient identifiers** on every referral-touched case through
  -- this arm ALONE, while ADR 0078's source table says `nsp_referral_touched`
  -- confers **content only**. Its removal is **D8/N1, scheduled for Gate 2** — a
  -- KNOWN, SCHEDULED removal, not a new defect, and **A24·1 is right about its
  -- urgency**. It is untouched by M3 because M3 is defect ① only.
  --
  -- ⚠ And it is REQUIRED as an A2 resolver source: without it, Stage A silently
  -- revokes LIVE NSP content reach.
  if app.feature_enabled('case_referrals')
     and app.is_pqs_operator_of_for(app.hospital_of_commission(v_commission), p_uid)
     and exists (
       select 1 from public.case_referral r
       where r.source_case_id = p_case_id or r.target_case_id = p_case_id
     ) then
    return true;
  end if;

  if not app.feature_enabled('case_access') then
    -- ⟵E1 belt: explicit_grants_only PHI door → coordinators only, no member-wide read.
    -- ⚠ UNTOUCHED BY M3. This branch has NO assignment arm to remove; its member arm
    -- is A15/A2's business (230 asserts M3 left it alone).
    if (select visibility_policy from public.cases where id = p_case_id) = 'explicit_grants_only' then
      return app.is_staff_admin_of_for(v_commission, p_uid);
    end if;
    return app.is_member_of_for(v_commission, p_uid);
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    -- ⚠ `level` is deliberately NOT filtered — see the header. The shape cannot
    -- express "this grant confers PHI" until case_access_grants.read_standard_phi
    -- (B1). Pinned by 230 so B1's change is visible.
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = p_case_id and ca.user_id = p_uid
        and (ca.expires_at is null or ca.expires_at > now())
    );
    -- ⬅ ADR 0078 defect ① / M3: the two BARE-ASSIGNMENT arms are DELETED here.
    -- Assignment is CONTENT reach, never PHI (Context·1 / D10). `can_read_case`
    -- KEEPS both arms — 230's scope fence asserts it.
    --
    -- ⚠ THIS COMMENT DELIBERATELY DOES NOT NAME THE DELETED TABLES — not once, in
    -- any form. 230 asserts their ABSENCE from this body via a catalog regex, so any
    -- mention here (even quoting the regex itself) re-creates the string and the
    -- removal documents itself back into existence. I hit this twice in a row: first
    -- by quoting the deleted arms, then INSIDE THE COMMENT WARNING ABOUT IT. Same
    -- trap as M2's admin-arm comment, and the same one that made the A30 census read
    -- 42 instead of 40. `text is not truth` applies to the text you write while
    -- removing the text. Do not name them here.
end;
$$;

comment on function app.can_read_case_patient(uuid, uuid) is
  'Rule 12 standard-PHI door. ADR 0078 defect ① / M3: a bare case_phases / case_narratives '
  'assignment NO LONGER confers patient identifiers — assignment is CONTENT reach only '
  '(Context·1 / D10). Surviving arms (case_access ON): staff_admin OR an unexpired '
  'case_access grant. ⚠ The grant arm still does NOT filter `level` — the other half of '
  'defect ①; today''s two-value level (read|write) cannot express PHI without encoding '
  'write ⇒ read_standard_phi, which A16''s lattice puts on a DISJOINT chain. That half '
  'lands with case_access_grants.read_standard_phi at B1.';
