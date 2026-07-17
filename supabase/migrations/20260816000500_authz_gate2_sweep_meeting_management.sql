-- =============================================================================
-- ADR 0078 · Gate 2 fix wave — THE CLASS SWEEP, part 1: meeting MANAGEMENT
-- (qa review §7 open risk 1: "the DEFINER-door blind spot is a class, not an
-- instance").
--
-- A8 (PO): an Organization User "cannot manage meetings".
-- A10, verbatim, lists what loses the arm:
--   "Helpers | app.assert_meeting_staff_admin (the guard on create_meeting /
--    conclude_meeting / reopen_meeting)"
--   "…the arm's removal also stops Organization Users scheduling, concluding,
--    and reopening meetings. Intended (PO)."
--
-- ⭐ THE HELPER WAS FIXED; THE DOORS INLINE THE ARM AND NEVER REACH IT.
-- Catalog-verified: app.assert_meeting_staff_admin is now `is_staff_admin_of`
-- alone (C7 did that work) — but conclude_meeting / reopen_meeting / create_meeting
-- each inline their OWN `is_staff_admin_of(x) or is_commission_admin_of(x)` gate.
-- This is the P0's shape exactly, one noun over, and C7 missed it.
--
-- PROVEN BY EXECUTION as orgadmin.a (preconditions asserted: is_staff_admin_of
-- = f, is_member_of = f, is_commission_admin_of = t):
--   • conclude_meeting on a `scheduled` meeting  → SUCCEEDED, status → in_signature
--   • reopen_meeting  on a `signed` meeting      → SUCCEEDED, status → held
--       ⇒ a non-member Organization User UN-SIGNS a signed ata.
--   • create_meeting → LATENT: its inline gate passes, but the RPC is
--     prosecdef = f, so the fixed `meetings_staff_admin_write` policy backstops
--     the insert (verified: "new row violates row-level security policy").
--     Removed anyway as a RE-ARMING TRAP — the same disposition the review gave
--     `get_case_meeting_links`. A gate that passes and relies on a policy one
--     layer down is a seam, not a boundary.
--
-- ⚠ 245's own header claims "cannot conclude" — NO assertion in the file ever
-- tested it (§7.2: text is not truth, in a test header this time). 245 now
-- calls these doors.
--
-- ⚠ NO LOCKOUT (A10): is_staff_admin_of plus `administrativo`'s
-- `schedule_meetings` capability cover scheduling from inside the commission;
-- create_meeting's `app.member_can(..., 'schedule_meetings')` disjunct is
-- deliberately PRESERVED below.
--
-- METHOD — the re-emit trap, handled: each body is REGENERATED FROM THE LIVE
-- CATALOG (pg_get_functiondef) at apply time and only the gate disjunct is
-- removed. Migration text is stale by design (A28), so this migration reads the
-- catalog rather than restating a body. pg_get_functiondef emits CREATE OR
-- REPLACE with the live volatility / SECURITY DEFINER / search_path, so those
-- are carried verbatim and the ACL is never reset. Every step is asserted.
-- =============================================================================

do $$
declare
  v_fn        text;
  v_oid       oid;
  v_def       text;
  v_new       text;
  v_pattern   text := '\s+or\s+app\.is_commission_admin_of(_for)?\s*\([^()]*\)';
  v_secdef    boolean;
  v_volatile  "char";
  v_acl       text;
begin
  foreach v_fn in array array['conclude_meeting', 'reopen_meeting', 'create_meeting'] loop
    for v_oid in
      select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = v_fn
    loop
      v_def := pg_get_functiondef(v_oid);
      select prosecdef, provolatile, coalesce(array_to_string(proacl, ','), '<null>')
        into v_secdef, v_volatile, v_acl from pg_proc where oid = v_oid;

      -- §7.2 — a body regex can match a COMMENT. Assert the arm is LIVE CODE.
      if not exists (
        select 1 from unnest(string_to_array(v_def, E'\n')) ln
         where ln ~ 'app\.is_commission_admin_of' and trim(ln) !~ '^--'
      ) then
        raise exception 'sweep/meetings: %: the arm is not live code (comment-only or absent) — '
                        'the premise of this migration is wrong; stop and re-verify', v_fn;
      end if;

      v_new := regexp_replace(v_def, v_pattern, '', 'g');
      if v_new = v_def then
        raise exception 'sweep/meetings: %: the gate pattern did not match — body shape changed; '
                        'do NOT assume the cut landed', v_fn;
      end if;

      execute v_new;

      -- Post-conditions: the arm is gone and nothing else moved.
      if pg_get_functiondef(v_oid) ~ 'app\.is_commission_admin_of' then
        raise exception 'sweep/meetings: %: the arm SURVIVES the replace', v_fn;
      end if;
      if (select prosecdef from pg_proc where oid = v_oid) is distinct from v_secdef then
        raise exception 'sweep/meetings: %: prosecdef changed', v_fn;
      end if;
      if (select provolatile from pg_proc where oid = v_oid) is distinct from v_volatile then
        raise exception 'sweep/meetings: %: provolatile changed (the ac57a20 class of regression)', v_fn;
      end if;
      if (select coalesce(array_to_string(proacl, ','), '<null>') from pg_proc where oid = v_oid)
         is distinct from v_acl then
        raise exception 'sweep/meetings: %: the ACL changed (the 17a8d08 class of regression)', v_fn;
      end if;
    end loop;
  end loop;

  -- create_meeting must KEEP the administrativo capability disjunct (A10: no lockout).
  if (select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'create_meeting') !~ 'schedule_meetings' then
    raise exception 'sweep/meetings: create_meeting lost the administrativo schedule_meetings arm — '
                    'that is a LOCKOUT (A10), not a fix';
  end if;
end $$;
