-- GRANT-PLANE-CONVENTION — the case grant door refuses a WRITE grant on a TERMINAL case.
-- ADR 0205 D9 (PO ruling, 2026-09-10). Pre-pilot, case-only; no contact with AE5.

-- door-sweep-targets: public.grant_case_access(uuid, uuid, text, timestamptz, text, boolean, boolean)

-- ============================================================================
-- THE DEFECT, measured on the live catalog at head 20261003007360, 2026-09-10.
--
-- `public.grant_case_access` validates authority → exclusion → level → grantee
-- membership → future expiry, and then calls the kernel. It carries NO lifecycle
-- check. The UI greys out "Edição" on a closed case; the DOOR stores the write
-- grant regardless. It is inert only because the CONTENT tables refuse writes on a
-- terminal case — i.e. the grant plane and the write plane disagree, and only the
-- second one is enforcing. Measured directly: pgTAP 416 K1b read `1` row in
-- `case_access_grants` after a coordinator granted `write` on a `completed` case.
--
-- THE FIX. A refusal in the door, with its own catchable SQLSTATE, placed AFTER
-- every existing validation and BEFORE the kernel call.
--
-- ⛔ SCOPE — three things this migration deliberately does NOT touch, each for a
-- stated reason rather than by omission:
--   · `app._case_caps` — ADR 0078 A24·3 forbids a lifecycle step in the resolver.
--     This is a DOOR validation; the capability lattice is unchanged.
--   · `app._grant_case_access_unchecked` — the kernel, shared with the creator
--     self-grant path. Narrowing it would narrow paths this ruling did not judge.
--   · READ grants on a terminal case — EXPLICITLY still legal (ADR 0033 D6), and
--     e2e `case-access.spec.ts` AC-3d depends on it. pgTAP 416 K3 is that paired
--     positive; without it a door that refused every grant on a closed case would
--     satisfy the two negatives by construction (§7.7).
--
-- NEW SQLSTATE `HC0U0`, and the derivation is stated because "the next free code"
-- has gone stale three times in the register that records it (see
-- `docs/backend-state/conventions.md` § SQLSTATE → meaning, which says so itself):
--   · live catalog — `select distinct m[1] from pg_proc …, lateral
--     regexp_matches(prosrc, 'HC0[0-9A-Z][0-9A-Z]', 'g') m` over app/public/authz:
--     242 codes, numeric high-water `HC095`, alpha high-water `HC0T7`.
--   · repo (migrations + src + tests): 262. docs: 269. `HC0T5` is allocated but never
--     persisted (raised only inside migration-time `do $$` assertion blocks, so a
--     catalog-only derivation cannot see it); `HC0T8` / `HC0T9` are claimed by
--     `docs/plans/authz-ae1-person-doors.md`.
--   · union of all three: the `HC0U` family is entirely unallocated. `HC0U0` it is.
--
-- METHOD — RE-EMIT FROM THE LIVE `pg_get_functiondef`, NOT FROM MIGRATION TEXT.
-- `20260802000000`'s literal body is stale by design (ADR 0078; LEARN-057): later
-- migrations rewrite bodies programmatically, and a hand-copied `create or replace`
-- would silently revert every intervening patch. So this file INSERTS one block into
-- whatever the catalog holds at apply time, and asserts — from a RE-READ of the
-- catalog, never from the statement above — that the insert landed, that nothing
-- else moved, and that identity args, result, `prosecdef`, `proconfig`, owner,
-- volatility and the full ACL are byte-identical before and after.
-- ============================================================================

do $mig$
declare
  v_re   regprocedure := 'public.grant_case_access(uuid, uuid, text, timestamp with time zone, text, boolean, boolean)'::regprocedure;
  v_old  text;
  v_new  text;
  v_read text;
  v_needle constant text :=
    '  -- D5·6: the coordinator may ISSUE read_restricted_phi without holding it. No';
  v_patch constant text := $patch$  -- ADR 0205 D9 (PO ruling, 2026-09-10) — A WRITE GRANT ON A TERMINAL CASE IS REFUSED.
  -- Placed AFTER authority (42501), the U1 exclusion (HC0F1), the level check, the
  -- grantee-membership check (HC021) and the future-expiry check, and BEFORE the
  -- kernel call. The ordering is load-bearing in one direction: moving this ahead of
  -- the authority gate would tell a principal with NO standing on the case that the
  -- case is closed. pgTAP 416 K5/K5b pin it (a non-coordinator still gets 42501).
  --
  -- READ STAYS LEGAL on a terminal case (ADR 0033 D6) — only `write` is refused, and
  -- 416 K3 is the positive twin that keeps this from being a blanket narrowing.
  if p_level = 'write' and app.case_is_terminal(p_case) then
    raise exception 'não é possível conceder edição em um caso encerrado'
      using errcode = 'HC0U0';
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
  if position('HC0U0' in v_old) > 0
     or position('app.case_is_terminal(' in v_old) > 0 then
    raise exception 'GRANT-PLANE: public.grant_case_access ALREADY carries a terminal-case refusal — investigate rather than re-run.'
      using errcode = 'check_violation';
  end if;
  -- The anchor must occur EXACTLY once. `replace()` is global: a second occurrence
  -- would insert the block twice and every downstream check would still pass.
  if position(v_needle in v_old) = 0 then
    raise exception 'GRANT-PLANE: the D5·6 anchor comment is ABSENT from the live body of public.grant_case_access — the body changed since this migration was written.'
      using errcode = 'check_violation';
  end if;
  if (length(v_old) - length(replace(v_old, v_needle, ''))) / length(v_needle) <> 1 then
    raise exception 'GRANT-PLANE: the D5·6 anchor occurs more than once in public.grant_case_access — a global replace would duplicate the guard.'
      using errcode = 'check_violation';
  end if;
  -- The four validations this block must sit BEHIND, asserted present so "after them"
  -- is a measured position and not an assumption about a body read hours earlier.
  if position('errcode = ''42501''' in v_old) = 0
     or position('app.assert_not_case_excluded(p_case)' in v_old) = 0
     or position('errcode = ''HC021''' in v_old) = 0
     or position('p_expires_at <= now()' in v_old) = 0 then
    raise exception 'GRANT-PLANE: public.grant_case_access is missing one of the four validations this guard is placed behind.'
      using errcode = 'check_violation';
  end if;

  v_new := replace(v_old, v_needle, v_patch || v_needle);
  execute v_new;

  -- ── LANDING ASSERTIONS, AFTER — RE-READ from the catalog. A mutation that did not
  --    fully apply otherwise reports green (LEARN-059). ─────────────────────────
  select pg_get_functiondef(p.oid) into v_read from pg_proc p where p.oid = v_re;

  if position('errcode = ''HC0U0''' in v_read) = 0
     or position('app.case_is_terminal(p_case)' in v_read) = 0 then
    raise exception 'GRANT-PLANE: the terminal-case refusal is ABSENT after replace — the change did not land.'
      using errcode = 'check_violation';
  end if;
  if (length(v_read) - length(replace(v_read, 'HC0U0', ''))) / 5 <> 1 then
    raise exception 'GRANT-PLANE: HC0U0 appears more than once after replace — the guard was inserted twice.'
      using errcode = 'check_violation';
  end if;
  -- ⛔ THE PRESERVATION HALF. A rewrite that DROPPED an existing validation would
  -- satisfy every check above and silently widen the door.
  if position('errcode = ''42501''' in v_read) = 0
     or position('app.assert_not_case_excluded(p_case)' in v_read) = 0
     or position('errcode = ''HC021''' in v_read) = 0
     or position('p_expires_at <= now()' in v_read) = 0
     or position('app._grant_case_access_unchecked(' in v_read) = 0
     or position('org_admin_deadlock_exit' in v_read) = 0 then
    raise exception 'GRANT-PLANE: public.grant_case_access LOST one of its pre-existing validations or its kernel call.'
      using errcode = 'check_violation';
  end if;
  -- ⛔ THE ORDERING HALF, asserted rather than trusted to the anchor: the new guard
  -- must sit after all four validations and before the kernel call.
  if position('errcode = ''HC0U0''' in v_read) < position('errcode = ''HC021''' in v_read)
     or position('errcode = ''HC0U0''' in v_read) < position('p_expires_at <= now()' in v_read)
     or position('errcode = ''HC0U0''' in v_read) > position('app._grant_case_access_unchecked(' in v_read) then
    raise exception 'GRANT-PLANE: the terminal-case refusal landed in the WRONG POSITION in public.grant_case_access.'
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
    raise exception 'GRANT-PLANE: signature, result, prosecdef, search_path, owner, volatility or ACL of public.grant_case_access MOVED — a create-or-replace must move none of them.'
      using errcode = 'check_violation';
  end if;
  if not v_secdef then
    raise exception 'GRANT-PLANE: public.grant_case_access is not SECURITY DEFINER — its gate is supposed to REPLACE RLS.'
      using errcode = 'check_violation';
  end if;
end $mig$;
