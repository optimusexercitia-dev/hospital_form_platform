-- ARM3-HAT-TERM-FIX. The ACT hat becomes a DOOR-LEVEL term on
-- `app.can_read_professional_profile(uuid, uuid)`, evaluated BEFORE the arms, so a case grant
-- can no longer stand in for a missing hat on a self-check.
--
-- Fixes BUG-AE5-MATRIX-ARM3-CELLS-CASE-GRANT-ARM-MAKES-THE-HAT-TERM-UNENFORCEABLE and carries
-- FUP-AE5-MATRIX-ARM3-CELLS-READ-DOOR-COMMENT-CITES-THE-REPLACED-403-SECTION in the same body
-- (the follow-up's own ruling: ⛔ never a standalone comment-only migration).
-- Builds ADR 0209 (D1-D5). ⛔ This migration takes none of those decisions again.
--
-- door-sweep-targets: app.can_read_professional_profile(uuid, uuid)
--
-- ============================================================================
-- THE DEFECT, measured on the LIVE CATALOG at head pair (20261003007390, 528), 2026-09-11,
-- comment-stripped with
--   regexp_replace(regexp_replace(prosrc, '/\*.*?\*/', '', 'gs'), '--[^\n]*', '', 'g')
-- and with two DISCRIMINATING CONTROLS in the same query, so the five negatives are findings
-- rather than a dead needle:
--
--   app.can_read_professional_profile       active_role ABSENT   auth.uid ABSENT
--   app._case_caps                          active_role ABSENT   auth.uid ABSENT
--   app.can_read_case                       active_role ABSENT   auth.uid ABSENT
--   app.can_read_case_committee             active_role ABSENT   auth.uid ABSENT
--   app.can_manage_professional             active_role ABSENT   auth.uid ABSENT
--   app.has_role                            active_role PRESENT  auth.uid PRESENT  <- control
--   app.is_admin_for                        active_role PRESENT  auth.uid PRESENT  <- control
--
-- ⇒ the hat term — "you cannot read your own profile while acting as another role" — lives
-- inside `has_role`/`is_admin_for` and NOWHERE on arm 3's chain. Arm 3 reaches through
-- `app._case_caps` sources S3 (`case_access_grants`) and S4 (case assignment), neither of which
-- contains a role lookup at all, so the rule was RENDERED INOPERATIVE for anyone holding a case
-- grant. ⛔ That is a rule made unenforceable, not a generic fail-open, and the distinction is
-- the PO's (bug body, ruling R2).
--
-- ============================================================================
-- ⭐⭐ THE DECLARED TIGHTENING (ADR 0200's R3 discipline, applied here). Quoted verbatim in the
-- unit's session-log entry and in the QA brief.
--
--   This migration TIGHTENS one gate and it is declared as a tightening, not folded into a
--   no-regression claim. A principal who HOLDS at least one live role and asks the door about
--   THEMSELVES under a hat that is not one of the roles they hold is now DENIED, whatever arm
--   would have answered. Measured cost in the differential vector: 18 cells move GRANT -> DENY
--   at `case_reach = grant_keyed` — the 10 cells of the filed bug plus 8 cells that the
--   generator's own precedence had labelled `arm3:divergent-approved:cross-org`.
--
--   ⭐ THE 8 ARE A RE-RULING AND ARE MARKED **PO to ratify** (ADR 0209 D5). They are
--   `other_role` SELF-checks at a cross-org coordinate, and `expected()` resolves scope
--   (`deny-class:cross_org`) BEFORE the hat (`wrong_active_context:self`), so they landed in
--   class 4 by precedence rather than by a ruling about the hat. PO ruling R2 approved
--   CROSS-ORG reach and never spoke to the WRONG HAT; an org-conditioned hat term — "deny the
--   wrong hat, but only same-org" — is exactly the org check R2 forbids. So the door denies
--   them, and 403 § 7.3's partition records them under the new label.
--
--   ⭐ A HATLESS HOLDER SELF-CHECKING IS DENIED TOO (D4) — a coordinate the vector cannot
--   carry, because the token hook mints an `active_role` implicitly for a principal holding
--   exactly one role TYPE, and every holder persona in 403 holds exactly one. 403 pins that
--   value directly instead.
--
-- ⭐ NOT TIGHTENED, ON PURPOSE — the two arms the PO's caveat protects:
--   * A principal who holds NO live role is EXEMPT (D3). `unprivileged` reaching through an
--     explicit case grant keeps its reach at every hat, which is 403 § 4.1b's 36 class-3 cells
--     and the half a naive role-keyed hat check inside arm 3 would have killed.
--   * NO ORG TERM IS ADDED ANYWHERE (D1). The grant still anchors on the CASE, so cross-org
--     case collaboration under the MATCHING hat is untouched — 403 § 7.5, both directions.
--
-- ⚠ ALSO DECLARED, and OUTSIDE the follow-up's scope: comment correction (3) below. The
-- follow-up names ONE parenthetical; correction (3) fixes a DIFFERENT false clause in the same
-- comment block ("the broad can_read_case", when the body calls the narrow committee-plane
-- variant). It is taken here because this migration re-emits the body and a known-false comment
-- in a live gate is the defect the follow-up exists about — but it is recorded as an addition,
-- not as part of the discharge.
--
-- ============================================================================
-- THE HELD-ROLE SET, DEFINED BY ITS MINTER (ADR 0209 D2). The guard's second half asks whether
-- the presented hat is one of the roles the principal HOLDS, and "holds" is defined as exactly
-- the set `public.custom_access_token_hook` can mint `active_role` from:
--
--   select 'platform_admin' where profiles.is_admin
--   union all
--   select distinct role from public.memberships
--    where principal_id = <uid> and (expires_at is null or expires_at > now())
--
-- ⛔ Defined that way rather than hand-listed, so the door can never refuse a hat the token
-- hook is able to issue (a live session denied for presenting a claim the system minted for it
-- would be a lockout, not a tightening). The liveness predicate is BYTE-IDENTICAL to
-- `app.has_role`'s: `expires_at is null or expires_at > now()`.
--
-- ⛔ NO `app.is_active` TERM IS ADDED. Account state is `_case_caps` STEP 2's job on this path
-- and `app.is_admin_for`'s on arm 1; adding a third copy here would put the same predicate at
-- three sites with no arm able to tell which one answered.
-- ⛔ NO CALL INTO `authz.assignment_facts` OR ANY LAYER-1/2 RESOLVER. This is a legacy door and
-- the differential (403 § 4.1) compares it against the candidate resolver; a door that consults
-- the resolver is not a differential subject any more.
--
-- ⚠ `is not distinct from`, NOT `=`, in BOTH halves. `app.active_role()` is a bare claim read
-- and returns NULL when the hat is absent; with `=` the `not exists` would evaluate to NULL and
-- the guard would FALL THROUGH on exactly the absent-hat case D4 rules on. Same lesson as
-- BUG-ACT-NULLHAT-1, which is why `app.has_role` carries the same operator.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- LANDING ASSERTIONS, BEFORE — both directions, and every needle `(`-terminated.
-- ---------------------------------------------------------------------------
do $mig$
declare
  v_src text;
begin
  v_src := pg_get_functiondef('app.can_read_professional_profile(uuid, uuid)'::regprocedure);
  if position('app.can_read_case_committee(' in v_src) = 0
     or position('app.is_admin_for(' in v_src) = 0 then
    raise exception 'ARM3-HAT: app.can_read_professional_profile does not carry the expected arms — the body changed since this migration was written.'
      using errcode = 'check_violation';
  end if;
  if position('app.active_role(' in v_src) > 0 then
    raise exception 'ARM3-HAT: app.can_read_professional_profile ALREADY reads the active hat — investigate rather than re-run.'
      using errcode = 'check_violation';
  end if;
end $mig$;

create or replace function app.can_read_professional_profile(p_profile_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_org uuid;
begin
  if p_uid is null then
    return false;
  end if;

  -- ⭐⭐ THE ACT HAT, AS A DOOR-LEVEL TERM (ADR 0209 D1) — BEFORE ANY ARM IS EVALUATED.
  -- "You cannot read your own profile while acting as another role" (ADR 0106 D11). That rule
  -- used to live only inside the arms that consult app.has_role / app.is_admin_for, and arm 3
  -- below reaches through _case_caps S3/S4, which carry NO role lookup — so a case grant stood
  -- in for the hat and the rule was unenforceable for anyone holding one
  -- (BUG-AE5-MATRIX-ARM3-CELLS-CASE-GRANT-ARM-MAKES-THE-HAT-TERM-UNENFORCEABLE).
  --
  -- ⛔ IT IS HERE AND NOT INSIDE ARM 3, and the placement is the ruling rather than a style
  -- choice. Two shapes were measured and REFUSED by pgTAP 403 before this one was written:
  -- an ORG check inside arm 3 reds § 7.5 (it revokes the cross-org reach an explicit grant
  -- exists to give), and a ROLE-KEYED hat check inside arm 3 reds § 4.1b (S3 is role-free by
  -- design, so it also kills the 36 cells where a principal holding NO role reaches through a
  -- grant). A term at the door touches neither: it asks only about the CALLER's own hat.
  --
  -- ⛔ SELF-CHECK ONLY, mirroring app.has_role's and app.is_admin_for's own trailing conjunct.
  -- One principal's hat must never alter what the system concludes about ANOTHER — every
  -- third-party question is byte-unchanged, which is the § 6A asymmetry 403 § 5.2 pins.
  -- ⛔ AND ONLY FOR A PRINCIPAL WHO HOLDS SOMETHING (D3): a caller with no live role has no
  -- hat to be wrong, so the guard never fires for them and an explicit case grant still reaches
  -- across the role model exactly as PO ruling R2 approved.
  -- ⛔ `app.active_role()` IS CALLED INLINE, NOT HOISTED INTO A `v_hat` VARIABLE, AND THE
  -- REASON IS A GATE. `supabase/tests/mutation/act-hat-blind-sweep.sh` (ARM=hat) splits a body
  -- into statement CHUNKS on `;` and requires every chunk carrying a caller-bound raw
  -- `memberships` read to carry `active_role(` / `has_role(` / `has_role_any(` IN THE SAME
  -- CHUNK. A hoisted `v_hat := app.active_role();` puts the hat evidence in the PRECEDING chunk
  -- and this door is reported as a NEW HAT-BLIND GATE — measured, not predicted: the first draft
  -- of this body red ARM=hat for exactly that. ⛔ The remedy is the inline call, NEVER an
  -- allowlist entry: the arm's rule is "adjacent", and `app.has_role` satisfies it the same way.
  if p_uid is not distinct from (select auth.uid()) then
    if exists (
         -- HOLDS ANY LIVE ROLE? — the set custom_access_token_hook mints from (D2).
         select 1 from public.memberships m
          where m.principal_id = p_uid
            and (m.expires_at is null or m.expires_at > now())
         union all
         select 1 from public.profiles pr
          where pr.id = p_uid and pr.is_admin
       )
       and not exists (
         -- IS THE PRESENTED HAT ONE OF THEM? — NULL-safe, so an ABSENT hat denies (D4).
         select 1 from public.memberships m
          where m.principal_id = p_uid
            and (m.expires_at is null or m.expires_at > now())
            and m.role is not distinct from app.active_role()
         union all
         select 1 from public.profiles pr
          where pr.id = p_uid and pr.is_admin
            and app.active_role() is not distinct from 'platform_admin'
       )
    then
      return false;
    end if;
  end if;

  -- SUBJECT-KEYED SINCE ADR 0200 (pre-AE5 Batch 8, PO ruling R2). This arm previously called
  -- the zero-argument app.is_admin, so it answered about the CALLER and fired BEFORE the
  -- org arm below — the SECOND site of FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM's defect,
  -- which the follow-up did not name and which fixing can_manage_professional alone would have
  -- left in place. pgTAP 415 § 2 carries this arm's own bidirectional cells.
  if coalesce(app.is_admin_for(p_uid), false) then
    return true;
  end if;

  -- ETH·E4 (ADR 0108 D5) — the org-manager arm. See the header for the exposure
  -- argument and the two accepted adjacent exposures.
  select organization_id into v_org
  from public.professional_profiles
  where id = p_profile_id;

  -- LAYER 3 (ADR 0176 D2/D6). `org.professionals.read` is resolved at the org DERIVED from the
  -- profile above — 401 §19.3 pins that second-order derivation as this row's known exception to
  -- the gate-signature cross-check, and it is why the scope id below is `v_org` and not a
  -- parameter.
  if v_org is not null and (
       -- PRESERVED ARM — the legacy org authority half of the former can_create_professional call.
       app.can_manage_professional(v_org, p_uid)
       -- RE-KEYED ARM — was the `is_org_commission_staff_admin` ascent inside
       -- can_create_professional, i.e. row 43's code standing in for row 33's.
       or authz.has_permission(p_uid, 'organization', v_org, 'org.professionals.read')
     ) then
    return true;
  end if;

  -- DEFINER traversal over BASE tables (bypasses RLS ⇒ no case_participants recursion,
  -- ADR 0064 R6): professional → professional_participants → case_participants(live)
  -- → case, gated by app.can_read_case_committee — the NARROW committee-plane variant
  -- (`can_read_case AND NOT is_oversight_only_reader`), NOT the broad `can_read_case`.
  -- ⚠ The distinction is load-bearing and this comment said "the broad can_read_case" until
  -- 2026-09-11: an oversight-only reader reaches the case and must NOT reach the professional
  -- identities seated in it.
  --
  -- ⭐ THE SQL OF THIS ARM IS UNCHANGED — it still grants with NO org term at all, which is
  -- ADR 0175 D3's finding and is exactly what PO ruling R2 approved (an explicit grant anchors
  -- on the CASE, never on the caller's org). WHAT CHANGED IS ABOVE IT: the ACT hat is now
  -- enforced at the door, so this arm can no longer stand in for a missing or wrong hat on a
  -- SELF-check. It reaches for a third party, and for a role-less principal, exactly as before.
  --
  -- ⚠ DATED HISTORY, corrected 2026-09-11 (FUP-AE5-MATRIX-ARM3-CELLS-READ-DOOR-COMMENT-CITES-
  -- THE-REPLACED-403-SECTION). This parenthetical read "its cells are exercised-but-not-oracled
  -- (ADR 0175 D3 / 403 §7.3)" — a citation made stale by the unit that read it, since
  -- AE5-MATRIX-ARM3-CELLS REPLACED §7.3 by ~400 lines. As of that unit: arm 3's `grant_keyed`
  -- cells are ORACLED by 403 §7.3/§7.3b with a PO value per class; the hat-substitution class
  -- was a filed bug pinned by §7.4. ⛔ §7.4 IS RETIRED BY THIS MIGRATION — it pinned the defect
  -- this body fixes, and its own message named deletion as the route. Its successor is 403's
  -- head-on pin of the door-level hat term (both polarities plus the hatless-holder value).
  return exists (
    select 1
    from public.professional_participants pp
    join public.case_participants cp
      on cp.participant_id = pp.participant_id
     and cp.removed_at is null
    where pp.professional_profile_id = p_profile_id
      and app.can_read_case_committee(cp.case_id, p_uid)
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- LANDING ASSERTIONS, AFTER — the term landed, and the three arms survived it.
-- ⛔ `create or replace` preserves prosecdef, the search_path setting and the ACL; asserted
-- here rather than assumed, because "the signature did not move" is this unit's own criterion.
-- ---------------------------------------------------------------------------
do $mig$
declare
  v_new text;
  v_sec boolean;
  v_acl text;
begin
  v_new := pg_get_functiondef('app.can_read_professional_profile(uuid, uuid)'::regprocedure);
  if position('app.active_role(' in v_new) = 0 then
    raise exception 'ARM3-HAT: the door-level hat term is ABSENT after replace — the change did not land.'
      using errcode = 'check_violation';
  end if;
  if position('app.is_admin_for(' in v_new) = 0
     or position('app.can_manage_professional(' in v_new) = 0
     or position('authz.has_permission(' in v_new) = 0
     or position('app.can_read_case_committee(' in v_new) = 0 then
    raise exception 'ARM3-HAT: app.can_read_professional_profile LOST one of its arms — this migration adds a term above them and changes none of them.'
      using errcode = 'check_violation';
  end if;
  -- ⛔ NO ORG TERM IS ASSERTED HERE, DELIBERATELY. A text needle for one would be trivial to
  -- evade and would read stronger than it is; the ruled guard on that shape is pgTAP 403 § 7.5,
  -- which measures BOTH directions of the cross-org edge against the live door.

  -- ⛔ THE GRANTEE SET, NOT THE ACL STRING. `array_to_string(proacl, ',')` is order- and
  -- grantor-sensitive, so a comparison against a literal reds on a deployment whose grants were
  -- issued in another order — a false red about the wrong property. The claim this unit makes is
  -- "the same principals may still EXECUTE it", so that is what is measured.
  select p.prosecdef into v_sec
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'can_read_professional_profile';
  if not v_sec then
    raise exception 'ARM3-HAT: prosecdef is no longer true.' using errcode = 'check_violation';
  end if;

  select string_agg(distinct g, ',' order by g) into v_acl from (
    select coalesce(nullif(a.grantee::regrole::text, '-'), 'PUBLIC') as g
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral aclexplode(p.proacl) a
     where n.nspname = 'app' and p.proname = 'can_read_professional_profile'
       and a.privilege_type = 'EXECUTE'
  ) t;
  if v_acl is distinct from 'authenticated,postgres,service_role' then
    raise exception 'ARM3-HAT: the EXECUTE grantee set moved — measured before this migration as authenticated,postgres,service_role; now %.', coalesce(v_acl, '(none)')
      using errcode = 'check_violation';
  end if;
end $mig$;
