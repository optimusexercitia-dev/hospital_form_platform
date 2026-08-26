-- AFF4 — the D4 containment trigger must be SECURITY DEFINER.
--
-- ⛔ THE BREAK THIS FIXES, measured and 100% reproducible before this migration:
--    `app.assert_hospital_affiliation_has_org` was created SECURITY **INVOKER**
--    (20261003004000). Its `exists` against `public.organization_affiliations` therefore
--    ran under the CALLING user's RLS — and `organization_affiliations_select` is
--    `(principal_id = auth.uid() OR app.is_org_admin_of(organization_id))`, with **no
--    hospital tier by design** (ADR 0151 D1, pinned by `375` §4.1, reaffirmed by ADR 0158).
--
--    So for a `hospital_admin` performing ADR 0151 D5's one-step rehire:
--      1. `app.affiliate_person_impl` (DEFINER) correctly creates the active org parent,
--      2. then inserts the hospital affiliation,
--      3. the deferred constraint trigger fires and, reading as the hospital_admin,
--         CANNOT SEE the parent row created one statement earlier,
--      4. it raises a false-positive 23514 and the whole transaction rolls back.
--    The rehire was broken outright for every hospital_admin, via the UI and a raw
--    `affiliate_person` RPC alike.
--
-- ⭐ THE SHAPE WORTH REMEMBERING: two individually-correct decisions composing into a
--    break — a deliberately narrow policy, and a backstop that reads under caller RLS.
--    Neither is wrong alone, and no test that varies only the STATE can see it.
--
-- ⭐ WHY DEFINER IS THE RIGHT FIX AND GRANTS NOBODY ANYTHING. This function enforces a
--    DATA INVARIANT, not an authorization decision: it reads no caller identity — no
--    `auth.uid()`, no `app.has_role`, no `app.active_role()` — and its only outcome is to
--    raise or not raise. DEFINER simply lets an invariant check SEE the data it is
--    asserting over. It is not callable as an ordinary function (owner-only EXECUTE, and
--    it returns `trigger`), so there is no reachable path that could use it as a read
--    oracle.
--
-- ⛔ THE FIX IS **NOT** A HOSPITAL TIER ON `organization_affiliations_select`. Widening a
--    deliberately-narrow policy to make a backstop work would trade a data-invariant bug
--    for a privilege grant — never fix a read by granting access (ADR 0158 D2). `381` §2.2
--    asserts the hospital_admin STILL reads zero org affiliations after this change, so the
--    two fixes cannot be confused for one another later.
--
-- Coverage: `supabase/tests/381_containment_actor_dimension.sql` — the ACTOR dimension
-- `380` §6 lacked. Observed RED on this exact arm before this migration (23514 raised from
-- `assert_hospital_affiliation_has_org` line 23) with the org_admin control arm passing.
-- ============================================================================

alter function app.assert_hospital_affiliation_has_org() security definer;

-- Re-asserted EXPLICITLY rather than relied upon. A SECURITY DEFINER function without a
-- pinned `search_path` is a privilege-escalation vector, and `alter function ... security
-- definer` does not touch `proconfig` — so a future author reading only this migration
-- sees the whole security contract in one place instead of inferring it from another file.
alter function app.assert_hospital_affiliation_has_org()
  set search_path = public, pg_catalog;

-- Belt and braces: the function must never be executable by an ordinary caller. It is
-- already owner-only, so this is a no-op today and a guard against a later broad GRANT.
revoke all on function app.assert_hospital_affiliation_has_org() from public;

comment on function app.assert_hospital_affiliation_has_org() is
  'ADR 0151 D4 containment: an ACTIVE hospital affiliation requires an ACTIVE organization '
  'affiliation. SECURITY DEFINER *deliberately* — it enforces a data invariant, reads no '
  'caller identity, and under INVOKER it read organization_affiliations through the '
  'caller''s RLS, which has no hospital tier (ADR 0151 D1), breaking the D5 rehire for '
  'every hospital_admin. Do NOT revert to INVOKER, and do NOT "fix" a future instance of '
  'this by widening organization_affiliations_select (ADR 0158 D2). Actor-dimension '
  'coverage: supabase/tests/381_containment_actor_dimension.sql.';
