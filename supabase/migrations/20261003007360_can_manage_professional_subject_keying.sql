-- FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM — the two professional-identity predicates are
-- re-keyed onto the parameter their signature promises. ADR 0200 (pre-AE5 remediation Batch 8),
-- PO rulings R1 (fix now, via the existing `_for` twins) + R2 (both sites, one migration).
--
-- door-sweep-targets: app.can_manage_professional(uuid, uuid), app.can_read_professional_profile(uuid, uuid)
--
-- ============================================================================
-- THE DEFECT, measured on the live catalog at head pair (20261003007350, 524), 2026-09-09.
--
--   app.can_manage_professional(p_org, p_uid)
--     select p_uid is not null and (coalesce(app.is_admin(), false) or app.is_org_admin_of(p_org));
--
-- `app.is_admin()` takes NO argument and reads `auth.uid()` / `request.jwt.claims`.
-- `app.is_org_admin_of(p_org)` reads `auth.uid()` twice. So BOTH arms answer about the CALLER and
-- `p_uid` is a pure null guard — a third-party-shaped signature over a pure self-check.
--
-- ⛔ THE FOLLOW-UP NAMED ONE ARM; THERE ARE TWO, AND THERE ARE TWO SITES.
-- `app.can_read_professional_profile(p_profile_id, p_uid)` carries its OWN
-- `if coalesce(app.is_admin(), false) then return true; end if;` which fires BEFORE it ever calls
-- `can_manage_professional`. Fixing only the predicate the follow-up names would have left the
-- follow-up's own stated consequence — "a platform_admin asking whether X may read this profile
-- gets TRUE because the ASKER is an admin" — still true: a partial fix that reads as a complete
-- one. PO ruling R2 puts both sites in this migration; pgTAP 415 gives each site its OWN
-- bidirectional cells, so the two remain individually attributable.
--
-- BOTH POLARITIES CONSTRUCTED AND MEASURED at head, in rolled-back transactions:
--   OVER-GRANT   caller platform@test.local (hat on), subject chefe.ccih  -> TRUE,  correct FALSE
--   UNDER-GRANT  caller chefe.ccih,                   subject orgadmin.a  -> FALSE, correct TRUE
--   SELF control caller orgadmin.a,                   subject orgadmin.a  -> TRUE,  correct TRUE
--
-- REACH AT HEAD: ZERO reachable third-party paths. All 20 call expressions in the transitive
-- closure resolve `p_uid` to `auth.uid()`, `app` is not PostgREST-exposed, and no trigger reaches
-- either predicate. This is a LATENT TRAP, not a live hole — which is why no BUG row is opened
-- and why the proof is a constructed pgTAP differential rather than an E2E.
--
-- ⭐ THE FIX INVENTS NOTHING. `app` already carries the subject-keyed `_for` family, and
-- `app.is_admin_for`'s own comment was written for exactly this problem ("a question about a
-- THIRD PARTY is unchanged — one principal's hat must never alter what the system concludes
-- about another"). `is_admin_for` has 3 existing callers, `is_org_admin_of_for` 14. Signatures,
-- `prosecdef`, `proconfig`, volatility, owner and ACLs are all unchanged by `create or replace`,
-- and no `app` function appears in `src/lib/types/database.ts`, so `gen:types` is a no-op.
--
-- ⚠ ONE DECLARED BEHAVIOUR CHANGE AT SELF, NOT AN IDENTITY (PO ruling R3; ADR 0200 §
-- Consequences). `app.is_admin()` has a JWT-claim fast path — `request.jwt.claims ->> 'is_admin'`
-- — that `app.is_admin_for` does not; the latter always reads `public.profiles`. Since
-- `public.custom_access_token_hook` mints that claim FROM `profiles.is_admin`, the two agree
-- except in a stale-token window: an admin demoted after their JWT was issued keeps the old
-- answer until it expires. This substitution CLOSES that window. It is a tightening and is
-- recorded as one; it is not folded into a "no regression" claim.
--
-- METHOD: a full `create or replace` of both bodies, NOT the `pg_get_functiondef` + `replace()`
-- pattern of 20261003007190, with that migration's both-direction landing assertions preserved
-- verbatim in spirit. Two reasons, both load-bearing:
--   (a) the change replaces a whole disjunction rather than one clause, so a `replace()` would
--       need two independent substitutions per function — doubling the surface on which a
--       mutation that did not fully apply reports green;
--   (b) THE HEADER COMMENT MUST BE REWRITTEN. The live body currently documents the defect as a
--       deliberate decision ("narrowed rather than fixed … Left alone deliberately"). That
--       sentence is FALSE after this migration, and a comment is an assertion that goes stale
--       silently. `replace()` cannot cleanly rewrite a ten-line comment block.
--
-- ⚠ EVERY NEEDLE BELOW IS `(`-TERMINATED, AND THAT IS LOAD-BEARING IN BOTH DIRECTIONS.
-- `app.is_admin` is a PREFIX of `app.is_admin_for`, and `app.is_org_admin_of` of
-- `app.is_org_admin_of_for`. A bare-substring "the old arm is gone" check would red forever
-- (matching the new name), and a bare "the new arm landed" check would pass while only the old
-- one is present. 410 § 3.5 records having been bitten by exactly this with the
-- `is_tenancy_admin_of` / `is_tenancy_admin_of_for` pair.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- LANDING ASSERTIONS, BEFORE — both functions, both directions.
-- ---------------------------------------------------------------------------
do $mig$
declare
  v_src text;
begin
  v_src := pg_get_functiondef('app.can_manage_professional(uuid, uuid)'::regprocedure);
  if position('app.is_admin(' in v_src) = 0
     or position('app.is_org_admin_of(p_org)' in v_src) = 0 then
    raise exception 'BATCH8: app.can_manage_professional does not carry the expected caller-keyed arms — the body changed since this migration was written.'
      using errcode = 'check_violation';
  end if;
  if position('app.is_admin_for(' in v_src) > 0
     or position('app.is_org_admin_of_for(' in v_src) > 0 then
    raise exception 'BATCH8: app.can_manage_professional is ALREADY subject-keyed — investigate rather than re-run.'
      using errcode = 'check_violation';
  end if;

  v_src := pg_get_functiondef('app.can_read_professional_profile(uuid, uuid)'::regprocedure);
  if position('app.is_admin(' in v_src) = 0 then
    raise exception 'BATCH8: app.can_read_professional_profile does not carry the expected caller-keyed admin arm — the body changed since this migration was written.'
      using errcode = 'check_violation';
  end if;
  if position('app.is_admin_for(' in v_src) > 0 then
    raise exception 'BATCH8: app.can_read_professional_profile is ALREADY subject-keyed — investigate rather than re-run.'
      using errcode = 'check_violation';
  end if;
end $mig$;

-- ---------------------------------------------------------------------------
-- SITE 1 — app.can_manage_professional. Both arms move to the `_for` twins.
-- ---------------------------------------------------------------------------
create or replace function app.can_manage_professional(p_org uuid, p_uid uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  -- ORG AUTHORITY ONLY since AE4.7c. The commission staff_admin ascent moved to
  -- app.can_create_professional (row 43) — a staff_admin ADDS a professional, never modifies
  -- or redacts one (matrix § 12.8.5).
  --
  -- SUBJECT-KEYED SINCE ADR 0200 (pre-AE5 Batch 8, PO ruling R1), and that is the whole point
  -- of this body: both arms answer about `p_uid`, the principal the signature names, never
  -- about auth.uid(). Before it, BOTH arms read the CALLER and `p_uid` was a pure null guard —
  -- FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM, which AE4.7c narrowed rather than fixed by
  -- removing the last arm that read the parameter.
  --
  -- ⛔ THE `p_uid is not null` GUARD IS KEPT DELIBERATELY, though it is now redundant:
  -- app.is_admin_for's `exists` and app.is_active's coalesce both already deny on null. It
  -- stays so the deny-on-null contract is STATED at this gate rather than inferred from two
  -- helpers a future edit could change.
  --
  -- ⚠ AE5 TEMPLATE OBLIGATION (ADR 0193 D5, restated as data in ADR 0200): this gate is
  -- SUBJECT-KEYED. The per-role template that substitutes eleven increments through this chain
  -- must never pair a caller-keyed arm with a `p_uid`-keyed one — a differential whose two
  -- sides answer about different principals is not a differential.
  select p_uid is not null and (
    app.is_admin_for(p_uid)
    or app.is_org_admin_of_for(p_org, p_uid)
  );
$function$;

-- ---------------------------------------------------------------------------
-- SITE 2 — app.can_read_professional_profile. ONLY the first arm moves; arms 2, 3 and 4 are
-- preserved VERBATIM from the head body, so this file's claim stays "the admin arm is
-- re-keyed at both sites" and nothing else.
-- ---------------------------------------------------------------------------
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
  -- → case, gated by the broad can_read_case. PRESERVED VERBATIM — this arm grants with NO org
  -- term at all and its cells are exercised-but-not-oracled (ADR 0175 D3 / 403 §7.3).
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
-- LANDING ASSERTIONS, AFTER — both functions, both directions. Re-read from the CATALOG, never
-- assumed from the statements above: a mutation that did not fully apply otherwise reports green.
-- ---------------------------------------------------------------------------
do $mig$
declare
  v_new text;
begin
  v_new := pg_get_functiondef('app.can_manage_professional(uuid, uuid)'::regprocedure);
  if position('app.is_admin_for(p_uid)' in v_new) = 0
     or position('app.is_org_admin_of_for(p_org, p_uid)' in v_new) = 0 then
    raise exception 'BATCH8: the subject-keyed arms are ABSENT from app.can_manage_professional after replace — the change did not land.'
      using errcode = 'check_violation';
  end if;
  if position('app.is_admin(' in v_new) > 0
     or position('app.is_org_admin_of(' in v_new) > 0 then
    raise exception 'BATCH8: a caller-keyed arm SURVIVED the replace in app.can_manage_professional.'
      using errcode = 'check_violation';
  end if;

  v_new := pg_get_functiondef('app.can_read_professional_profile(uuid, uuid)'::regprocedure);
  if position('app.is_admin_for(p_uid)' in v_new) = 0 then
    raise exception 'BATCH8: the subject-keyed admin arm is ABSENT from app.can_read_professional_profile after replace — the change did not land.'
      using errcode = 'check_violation';
  end if;
  if position('app.is_admin(' in v_new) > 0 then
    raise exception 'BATCH8: the caller-keyed admin arm SURVIVED the replace in app.can_read_professional_profile.'
      using errcode = 'check_violation';
  end if;
  -- ⛔ THE PRESERVATION HALF. The three arms this migration does NOT touch must still be there:
  -- a `create or replace` that dropped one would satisfy every check above and silently narrow
  -- the gate. This is the "one-directional mutation" guard applied to the migration itself.
  if position('app.can_manage_professional(v_org, p_uid)' in v_new) = 0
     or position('authz.has_permission(p_uid, ''organization'', v_org, ''org.professionals.read'')' in v_new) = 0
     or position('app.can_read_case_committee(cp.case_id, p_uid)' in v_new) = 0 then
    raise exception 'BATCH8: app.can_read_professional_profile LOST one of its three preserved arms — this migration re-keys arm 1 only.'
      using errcode = 'check_violation';
  end if;
end $mig$;
