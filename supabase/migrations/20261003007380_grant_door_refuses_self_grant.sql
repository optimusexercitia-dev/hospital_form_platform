-- GRANT-PLANE-CONVENTION-A1 — the case grant door refuses a SELF-GRANT.
-- ADR 0205 § Amendment 1, clause D6·5·1 (PO ruling, 2026-09-10). Pre-pilot,
-- case-only; no contact with AE5.

-- door-sweep-targets: public.grant_case_access(uuid, uuid, text, timestamptz, text, boolean, boolean)

-- ============================================================================
-- THE DEFECT, measured on the live catalog at head 20261003007370, 2026-09-10.
--
-- `public.grant_case_access` validates authority (42501) → the U1 exclusion (HC0F1)
-- → level → grantee membership (HC021) → future expiry → terminal case (HC0U0), and
-- then calls the kernel. It NEVER compares the grantee to `auth.uid()`. Its own
-- comment names grantee membership as the anti-self-escalation guard:
--
--     "safe because the door also requires grantee membership below, so an
--      Organization User (not a member) can never self-escalate."
--
-- ⛔ THAT GUARD DOES NOT DO THAT JOB, and the measurement below is the reason this
-- migration exists — it also CORRECTS D6·5·1's own account of which arm is open.
-- Probed pre-migration through `test_helpers.claims_for`, one arm per hat:
--
--   · oa_b (org_admin of the org) + a plain `staff` row in the commission,
--     wearing hat `org_admin`   → is_tenancy_admin_of = t, self_is_member = f → HC021
--     wearing hat `staff`       → is_tenancy_admin_of = f, self_is_member = t → 42501
--     wearing no hat            → both false
--     ⇒ the TENANCY-ADMIN escalation D6·5·1 names is NOT reachable today, for a
--       reason the clause does not mention: `app.has_role` / `app.has_role_any` carry
--       the ACT hat conjunct `p_user_id is distinct from auth.uid() or m.role is not
--       distinct from app.active_role()` (BUG-ACT-NULLHAT-1). For the SELF grantee
--       that conjunct collapses onto the caller's own hat, so her plain membership is
--       invisible in the very session that opens the authority arm. The closure is
--       INCIDENTAL — a hat conjunct in a membership helper, at a LATER gate, for an
--       unrelated reason (LEARN-058) — and nothing asserts it.
--
--   · sa_x (the COORDINATOR), wearing hat `staff_admin`
--                               → is_staff_admin_of = t, self_is_member = t
--                               → THE SELF-GRANT SUCCEEDED, storing a row stamped
--                                 `coordinator_grant`.
--     ⇒ ⭐ THE ARM THAT IS ACTUALLY OPEN IS THE COORDINATOR'S, and it is the sharper
--       one, because D5·6 explicitly lets a coordinator ISSUE `read_restricted_phi`
--       without holding it — so through the door's two SQL-only PHI parameters she
--       could issue that to HERSELF. The ruling's REMEDY is right and closes strictly
--       more than the clause claims; only its premise about the live arm was wrong.
--
-- THE FIX. A refusal in the door, with its own catchable SQLSTATE, placed
-- IMMEDIATELY after the authority gate and the exclusion check and BEFORE level,
-- membership, expiry and the terminal check — so a self-grant is refused as an ACT
-- and not as a payload.
--
-- ⛔ SCOPE — three things this migration deliberately does NOT touch, each for a
-- stated reason rather than by omission:
--   · `app._grant_case_access_unchecked` — the INVOKER kernel, shared with
--     `create_case`'s creator self-grant. That is the ONE legitimate self-grant on
--     the platform (ADR 0061 revised: only the NON-coordinator capability-arm creator
--     reaches it) and it must keep working. pgTAP 417 §F is that twin.
--   · `public.revoke_case_access` — unchanged. Giving access up is not an authority
--     act (D6·5·1). 417 §G is that twin.
--   · `app._case_caps` — ADR 0078 A24·3. This is DOOR validation; the capability
--     lattice is untouched.
--
-- NEW SQLSTATE `HC0U1`, derivation stated because "the next free code" has gone
-- stale repeatedly in the register that records it (`docs/backend-state/conventions.md`
-- § SQLSTATE → meaning says so about itself):
--   · live catalog — `select distinct m[1] from pg_proc …, lateral
--     regexp_matches(prosrc, 'HC0[0-9A-Z][0-9A-Z]', 'g') m` over app/public/authz:
--     243 codes; alpha high-water `HC0T7` plus `HC0U0`; `HC0U1` ABSENT.
--   · repo (migrations + src + tests): 265 codes; `HC0U1` ABSENT.
--   · docs: 271 codes; `HC0U1` present in exactly TWO places, and both are the
--     sentence "next free = HC0U1" (`conventions.md` § SQLSTATE → meaning and
--     `docs/progress/grant-plane-convention.md`) — a CLAIM about the next code, never
--     an allocation of it.
--   · union of all three: `HC0U1` is free. `HC0U1` it is.
--
-- METHOD — RE-EMIT FROM THE LIVE `pg_get_functiondef`, NOT FROM MIGRATION TEXT
-- (ADR 0078; LEARN-057). This file INSERTS one block into whatever the catalog holds
-- at apply time, and asserts — from a RE-READ of the catalog, never from the
-- statement above — that the insert landed, that it landed in the RIGHT POSITION,
-- that nothing else moved, and that identity args, result, `prosecdef`, `proconfig`,
-- owner, volatility and the full ACL are byte-identical before and after.
-- ============================================================================

do $mig$
declare
  v_re   regprocedure := 'public.grant_case_access(uuid, uuid, text, timestamp with time zone, text, boolean, boolean)'::regprocedure;
  v_old  text;
  v_new  text;
  v_read text;
  -- The LEVEL check is the first thing the refusal must precede, so it is the anchor.
  v_needle constant text := '  if p_level not in (''read'', ''write'') then';
  v_patch constant text := $patch$  -- ADR 0205 § Amendment 1, D6·5·1 (PO ruling, 2026-09-10) — NO SELF-GRANT.
  -- Placed IMMEDIATELY after the authority gate (42501) and the U1 exclusion (HC0F1),
  -- and BEFORE the level check, the grantee-membership check (HC021), the future-expiry
  -- check and the terminal-case refusal (HC0U0). The POSITION is the ruling: a
  -- self-grant is refused as an ACT, not as a payload — so `read`, `write` and the two
  -- SQL-only PHI parameters are all refused alike. It is load-bearing in BOTH
  -- directions, which is why it sits exactly here and nowhere else:
  --   · NOT EARLIER than authority — a principal with no standing on the case must
  --     still be told 42501 and learn nothing further (pgTAP 417 §E).
  --   · NOT LATER than membership — that is the gate the comment above used to call
  --     the anti-self-escalation guard, and for the SELF grantee it is empty: it
  --     collapses onto the caller's own ACT hat, so it refused a tenancy admin
  --     incidentally and did not refuse the COORDINATOR at all (417 §A P3, §C P7).
  --
  -- A machine caller has no `auth.uid()`; the comparison is then NULL and this does not
  -- fire, which is correct — such a caller has no self to grant to, and would already
  -- have failed the authority gate above.
  if p_user = auth.uid() then
    raise exception 'não é possível conceder acesso a si mesmo'
      using errcode = 'HC0U1';
  end if;

$patch$;
  -- The shape, captured BEFORE and compared AFTER. `create or replace` cannot move
  -- any of these — which is exactly why they are asserted: the claim is that this
  -- migration performs a create-or-replace and nothing else.
  v_args   text;
  v_result text;
  v_secdef boolean;
  v_config text;
  v_owner  text;
  v_volat  "char";
  v_acl    text;
begin
  select pg_get_functiondef(p.oid),
         pg_get_function_identity_arguments(p.oid),
         pg_get_function_result(p.oid),
         p.prosecdef,
         coalesce(array_to_string(p.proconfig, ','), '<none>'),
         pg_get_userbyid(p.proowner),
         p.provolatile,
         coalesce(array_to_string(p.proacl::text[], ' '), '<none>')
    into v_old, v_args, v_result, v_secdef, v_config, v_owner, v_volat, v_acl
  from pg_proc p where p.oid = v_re;

  -- ── LANDING ASSERTIONS, BEFORE ──────────────────────────────────────────────
  if position('HC0U1' in v_old) > 0
     or position('p_user = auth.uid()' in v_old) > 0 then
    raise exception 'GRANT-PLANE-A1: public.grant_case_access ALREADY carries a self-grant refusal — investigate rather than re-run.'
      using errcode = 'check_violation';
  end if;
  -- The anchor must occur EXACTLY once. `replace()` is global: a second occurrence
  -- would insert the block twice and every downstream check would still pass.
  if position(v_needle in v_old) = 0 then
    raise exception 'GRANT-PLANE-A1: the level-check anchor is ABSENT from the live body of public.grant_case_access — the body changed since this migration was written.'
      using errcode = 'check_violation';
  end if;
  if (length(v_old) - length(replace(v_old, v_needle, ''))) / length(v_needle) <> 1 then
    raise exception 'GRANT-PLANE-A1: the level-check anchor occurs more than once in public.grant_case_access — a global replace would duplicate the guard.'
      using errcode = 'check_violation';
  end if;
  -- The two validations this block must sit BEHIND, and the four it must sit BEFORE,
  -- asserted present so "between them" is a measured position and not an assumption
  -- about a body read hours earlier.
  if position('errcode = ''42501''' in v_old) = 0
     or position('app.assert_not_case_excluded(p_case)' in v_old) = 0
     or position('errcode = ''HC021''' in v_old) = 0
     or position('p_expires_at <= now()' in v_old) = 0
     or position('errcode = ''HC0U0''' in v_old) = 0
     or position('app._grant_case_access_unchecked(' in v_old) = 0 then
    raise exception 'GRANT-PLANE-A1: public.grant_case_access is missing one of the six validations this guard is positioned against.'
      using errcode = 'check_violation';
  end if;
  -- And the anchor really is BEHIND the two gates the refusal must follow — otherwise
  -- "immediately after authority and exclusion" would be a hope about where it lands.
  if position(v_needle in v_old) < position('errcode = ''42501''' in v_old)
     or position(v_needle in v_old) < position('app.assert_not_case_excluded(p_case)' in v_old) then
    raise exception 'GRANT-PLANE-A1: the level-check anchor sits BEFORE the authority gate or the U1 exclusion — the ruled position is not reachable by inserting there.'
      using errcode = 'check_violation';
  end if;

  v_new := replace(v_old, v_needle, v_patch || v_needle);
  execute v_new;

  -- ── LANDING ASSERTIONS, AFTER — RE-READ from the catalog. A mutation that did not
  --    fully apply otherwise reports green (LEARN-059). ─────────────────────────
  select pg_get_functiondef(p.oid) into v_read from pg_proc p where p.oid = v_re;

  if position('errcode = ''HC0U1''' in v_read) = 0
     or position('p_user = auth.uid()' in v_read) = 0 then
    raise exception 'GRANT-PLANE-A1: the self-grant refusal is ABSENT after replace — the change did not land.'
      using errcode = 'check_violation';
  end if;
  if (length(v_read) - length(replace(v_read, 'HC0U1', ''))) / 5 <> 1 then
    raise exception 'GRANT-PLANE-A1: HC0U1 appears more than once after replace — the guard was inserted twice.'
      using errcode = 'check_violation';
  end if;
  -- ⛔ THE PRESERVATION HALF. A rewrite that DROPPED an existing validation would
  -- satisfy every check above and silently widen the door.
  if position('errcode = ''42501''' in v_read) = 0
     or position('app.assert_not_case_excluded(p_case)' in v_read) = 0
     or position('errcode = ''HC021''' in v_read) = 0
     or position('p_expires_at <= now()' in v_read) = 0
     or position('errcode = ''HC0U0''' in v_read) = 0
     or position('app.case_is_terminal(p_case)' in v_read) = 0
     or position('app._grant_case_access_unchecked(' in v_read) = 0
     or position('org_admin_deadlock_exit' in v_read) = 0 then
    raise exception 'GRANT-PLANE-A1: public.grant_case_access LOST one of its pre-existing validations or its kernel call.'
      using errcode = 'check_violation';
  end if;
  -- ⛔ THE ORDERING HALF, asserted rather than trusted to the anchor. This is the
  -- ruling itself, so it is measured end to end: authority + exclusion BEFORE the
  -- refusal; level, membership, expiry, terminal and the kernel AFTER it.
  if position('errcode = ''HC0U1''' in v_read) < position('errcode = ''42501''' in v_read)
     or position('errcode = ''HC0U1''' in v_read) < position('app.assert_not_case_excluded(p_case)' in v_read)
     or position('errcode = ''HC0U1''' in v_read) > position('  if p_level not in (''read'', ''write'') then' in v_read)
     or position('errcode = ''HC0U1''' in v_read) > position('errcode = ''HC021''' in v_read)
     or position('errcode = ''HC0U1''' in v_read) > position('p_expires_at <= now()' in v_read)
     or position('errcode = ''HC0U1''' in v_read) > position('errcode = ''HC0U0''' in v_read)
     or position('errcode = ''HC0U1''' in v_read) > position('app._grant_case_access_unchecked(' in v_read) then
    raise exception 'GRANT-PLANE-A1: the self-grant refusal landed in the WRONG POSITION in public.grant_case_access.'
      using errcode = 'check_violation';
  end if;

  -- ── THE SHAPE DID NOT MOVE ──────────────────────────────────────────────────
  if (select pg_get_function_identity_arguments(p.oid) from pg_proc p where p.oid = v_re) <> v_args
     or (select pg_get_function_result(p.oid) from pg_proc p where p.oid = v_re) <> v_result
     or (select p.prosecdef from pg_proc p where p.oid = v_re) <> v_secdef
     or (select coalesce(array_to_string(p.proconfig, ','), '<none>') from pg_proc p where p.oid = v_re) <> v_config
     or (select pg_get_userbyid(p.proowner) from pg_proc p where p.oid = v_re) <> v_owner
     or (select p.provolatile from pg_proc p where p.oid = v_re) <> v_volat
     or (select coalesce(array_to_string(p.proacl::text[], ' '), '<none>') from pg_proc p where p.oid = v_re) <> v_acl then
    raise exception 'GRANT-PLANE-A1: signature, result, prosecdef, search_path, owner, volatility or ACL of public.grant_case_access MOVED — a create-or-replace must move none of them.'
      using errcode = 'check_violation';
  end if;
  if not v_secdef then
    raise exception 'GRANT-PLANE-A1: public.grant_case_access is not SECURITY DEFINER — its gate is supposed to REPLACE RLS.'
      using errcode = 'check_violation';
  end if;
end $mig$;
