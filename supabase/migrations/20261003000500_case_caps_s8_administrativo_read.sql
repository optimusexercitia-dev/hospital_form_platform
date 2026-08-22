-- ADR 0134 D6 (M2) — the S8 arm: an appointed Administrativo holding `read_cases`
-- reads the commission's ordinary cases. Bounded by Amendment 4 (`not v_eg`).
-- Mechanism corrected by **Amendment 6** (see below). Locally on
-- `feat/case-surface-split-2`; no remote push, no merge.
--
-- ── WHY THIS MIGRATION CREATES app.member_can_for — Amendment 6 ─────────────────────
-- D6 and the implementation plan both name `app.member_can` as the flag-aware
-- chokepoint S8 must route through. Measured 2026-08-22 from `pg_get_functiondef`,
-- **that mechanism cannot work here**:
--
--   app.member_can(p_commission_id, p_capability)          -- TWO args. No uid.
--     = feature_enabled('administrativo')
--     ∧ is_active(auth.uid())
--     ∧ app.is_member_of(p_commission_id)                  -- itself auth.uid()-bound
--     ∧ ∃ row WHERE c.user_id = auth.uid()
--
-- `app._case_caps(p_case_id, p_uid)` is a **(case, uid)** resolver. Its callers
-- routinely ask about a principal who is NOT the caller — a property sweep of every
-- routine calling `can_read_case` / `has_case_capability` / `_case_caps` finds
-- cross-uid sites including `public.file_correction_request` (`can_read_case(v_case_id,
-- v_corrector)` — deciding whether a NOMINATED corrector may act) and
-- `public.get_referral_case_access_summary` (`has_case_capability(v_case, r.uid, …)` —
-- REPORTING other principals' access), plus the whole `_for` helper family that exists
-- precisely to be asked about a third party. Routed through the bare `member_can`, S8
-- would answer **about the caller** at every one of them.
--
-- Two consequences, both measured rather than reasoned:
--   1. It under-fires wherever `auth.uid()` is null — e.g. every owner-context pgTAP
--      assertion of the form `app.can_read_case(case, some_uid)` — so the keystones
--      could not be written honestly.
--   2. Worse: with `member_can` true for the caller and `p_uid` a different, non-member
--      principal, S8 would set `read_case_content` where S5 confers no
--      `read_case_deliberation` — which is `app.is_oversight_only_reader`'s exact bit
--      shape (`content ∧ ¬deliberation`). That is the collision Amendment 4 exists to
--      close, re-entering through a different door, and invisible to every authz ARM
--      (it is a uid-SOURCE mismatch inside a DEFINER body, not a missing gate).
--
-- Every other helper `_case_caps` uses already has a `_for` twin —
-- `is_staff_admin_of_for`, `is_tenancy_admin_of_for`, `is_member_of_for`,
-- `is_quality_reviewer_of_for`, `is_pqs_operator_of_for`. `member_can` was the only one
-- without. This migration closes that gap.
--
-- ⛔ ONE BODY, NOT TWO. `member_can_for` is the single implementation and `member_can`
-- delegates to it. Two hand-copies of an authorization predicate — one term of which is
-- the kill switch — is the shape this repo pays for most: a door that omits a check its
-- sibling makes is invisible to every ARM we run. Pinned by a
-- CATALOG assertion in `supabase/tests/356_case_caps_s8_administrativo_read.sql`:
-- exactly ONE routine in `app` may carry both `feature_enabled('administrativo')` and
-- `commission_administrativo_capabilities` in its comment-stripped body.
--
-- ⚠ Delegation costs no query-plan inlining. Measured empirically with a four-arm
-- `EXPLAIN (VERBOSE)` differential over `public.meetings` (a plain SQL STABLE function
-- INLINES — positive control, the plan shows the body decomposed and the flag conjunct
-- hoisted to a One-Time Filter; `SET search_path` alone does NOT inline; `SECURITY
-- DEFINER` alone does NOT inline; both — `member_can`'s actual shape — does NOT
-- inline). `app.member_can` is therefore not inlined today and loses nothing here.
--
-- ── WHAT S8 CONFERS, AND WHAT IT DOES NOT ───────────────────────────────────────────
-- `read_case_content` ONLY (D6). No write bits — content authorship still needs an
-- explicit S3 grant, exactly like any staff member. No PHI bits: `app.can_read_case_patient`
-- is a bare bit-8 test (`read_standard_phi`) and `app.has_case_capability` applies NO
-- lattice closure, so only S1 and S3 can ever set it — S8's non-leak is structural, not
-- a promise. No `view_case_overview` (S1/S7 only), no `manage_case_access`. No
-- lifecycle: `close_case` / `cancel_case` / `set_case_outcome` stay coordinator-only.
--
-- Bounded by `not v_eg`: an `explicit_grants_only` case is invisible to the arm, and
-- reach there rides an explicit grant (S3) or nothing — exactly as for S5 and S7. ⛔ The
-- bound is the half of the arm that nothing in the §6 gate set can see (an omitted
-- sibling check is invisible to every ARM), which is why P9-twin exists.
--
-- ⛔ `CREATE OR REPLACE` of `_case_caps` below was generated from
-- `pg_get_functiondef('app._case_caps'::regproc)` taken on 2026-08-22 (md5
-- edb85248a21326eb139e7e994b9c469b) with the S8 block injected programmatically — never
-- transcribed from a migration file, whose text is stale by design in this repo.
--
-- Not touched, deliberately: `public.list_cases_board` (its Gate-2 comment forbids
-- caller short-circuits; S8 flows through `app.can_read_case` per row as designed),
-- `public.get_case_detail`, `app.is_oversight_only_reader`, `app.can_read_case_committee`,
-- `app.dispose_case_phi`, the xref gates, and arms S1-S7.

-- ── 1. app.member_can_for — the single implementation ────────────────────────────────
-- Conjuncts identical to today's `member_can`, with `p_user_id` in place of
-- `auth.uid()` and `is_member_of_for` in place of `is_member_of` (the same predicate;
-- measured: `is_member_of(c) = is_active(auth.uid()) ∧ has_role_any('commission', c,
-- auth.uid())`, `is_member_of_for(c,u) = is_active(u) ∧ has_role_any('commission', c, u)`).
--
-- ⚠ THE `is_active` TERM IS REDUNDANT, and this is measured, not read off the text:
-- deleting it alone and running suite 356 gives 71/71 GREEN, because `is_member_of_for`
-- already contains `is_active(p_user_id)`. The same redundancy is in `member_can`'s
-- original body. It is KEPT here so the two bodies stay term-for-term comparable with
-- the pre-Amendment-6 predicate — but the widely-repeated "four conjuncts" description
-- (ADR 0134 Amdt 2 M8, and the mirror test's docblock) counts **three independent**
-- terms, and a sweep that merely checks `is_active` is PRESENT would pass on a body
-- where it had been deleted. Not a hole — the membership term covers it — but not the
-- belt-and-braces the phrasing implies. Recorded at `supabase/tests/356` § (1) 1.2.
create or replace function app.member_can_for(
  p_commission_id uuid, p_capability text, p_user_id uuid
) returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.feature_enabled('administrativo')
     and app.is_active(p_user_id)
     and app.is_member_of_for(p_commission_id, p_user_id)
     and exists (
       select 1 from public.commission_administrativo_capabilities c
       where c.commission_id = p_commission_id
         and c.user_id = p_user_id
         and c.capability = p_capability
     );
$function$;

-- ⛔ A freshly created function's `proacl` is NULL, and NULL is the PERMISSIVE DEFAULT
-- (it includes PUBLIC EXECUTE). The REVOKE is mandatory, not defensive. The grant shape
-- below was DERIVED from the catalog — it is what `app.is_member_of_for`,
-- `app.is_staff_admin_of_for`, `app.is_quality_reviewer_of_for` and `app.member_can` all
-- actually carry (`{postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres}`;
-- `has_function_privilege('anon', …)` false) — not invented, and not assumed from a default.
revoke all on function app.member_can_for(uuid, text, uuid) from public;
grant execute on function app.member_can_for(uuid, text, uuid) to authenticated, service_role;

-- ── 2. app.member_can — now a thin auth.uid() binding of the above ──────────────────
-- Its 12 measured consumers (9 routines + the 3 `meetings_staff_admin_{insert,update,delete}`
-- policies) see identical semantics: `is_member_of(c)` and `is_member_of_for(c, auth.uid())`
-- are the same predicate. `create or replace` preserves the existing ACL.
create or replace function app.member_can(
  p_commission_id uuid, p_capability text
) returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.member_can_for(p_commission_id, p_capability, auth.uid());
$function$;

-- ── 3. app._case_caps — S8 inserted after S7, before the S3 grant loop ──────────────
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
  v_orgadmin := app.is_tenancy_admin_of_for(v_commission, p_uid);
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

  -- ── S8 · administrativo_read_cases (ADR 0134 D6; bounded by Amendment 4;
  --         mechanism corrected by Amendment 6) — read_case_content ONLY, for an
  --         appointed Administrativo of the case's commission holding the ADR-0061
  --         `read_cases` capability. Management ≠ authorship: NO write bits (content
  --         authorship still needs an explicit S3 grant), NO PHI bits (Rule 12), NO
  --         view_case_overview (that bit is S1/S7 only), NO manage_case_access.
  --         Locked cases (v_eg) are fully invisible to the arm (Amdt 4, PO-ruled
  --         2026-08-22) — reach there rides an explicit grant (S3) or nothing, exactly
  --         as for S5 and S7. Routed through the flag-aware capability chokepoint, so
  --         the `administrativo` kill switch darkens it with the rest of ADR 0061.
  --         Inherits STEP-2 is_active, STEP-3 fail-closed-unknown-case and the STEP-4
  --         hard denies BY POSITION, exactly as S5/S7 do.
  --         ⭐ member_can_FOR, not member_can (Amdt 6): `app.member_can` resolves
  --         `auth.uid()`, but this resolver is a (case, p_uid) function whose callers
  --         routinely ask about a THIRD party. The bare form would answer about the
  --         CALLER — under-firing wherever auth.uid() is null and, worse, setting
  --         content-without-deliberation for a non-member p_uid, which is
  --         is_oversight_only_reader's exact bit shape and the very collision Amdt 4
  --         exists to close.
  --         ⭐ WHY S5 ALWAYS PAIRS WITH THIS ARM, by construction and not by argument:
  --         member_can_for's third conjunct IS `app.is_member_of_for(v_commission,
  --         p_uid)` — literally the call that assigned v_member above. So v_member
  --         cannot be false while this guard is true, and on an ordinary case the
  --         appointee holds content (S8) AND deliberation (S5). Amdt 4 §A4.2's
  --         derivation therefore holds structurally.
  --         ⚠ `read_cases` is the ADR-0061 delegation vocabulary, NOT app._cap_bit's
  --         `read_case_content`. Two vocabularies, one word apart. ─────────────────
  if not v_eg
     and app.member_can_for(v_commission, 'read_cases', p_uid) then
    v_caps := v_caps | app._cap_bit('read_case_content');
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
