-- AE4.9 "do now" (2/2) — ADR 0176 D7 [IA-F4]: public.assume_role READS AND ENFORCES
-- authz.roles.session_selectable. Plan § AE4.9 "Do now" item 2; G4 (ADR 0155).
--
-- door-sweep-targets: public.assume_role(platform_role)
--
-- ============================================================================
-- THE SUPERSEDED RULING. An in-flight ruling declared G4 "not implementable" because it read
-- G4's "typed query against authz.roles.session_selectable" as a CLIENT-SIDE query into a
-- sealed schema — application roles hold no USAGE on `authz` (20261003007100), so that reading
-- is correct AND it is not the only one. ADR 0176 D7 supersedes it: public.assume_role is
-- SECURITY DEFINER owned by postgres, so it reads the column SERVER-SIDE with NO new grant to
-- anon / authenticated / service_role and no relaxation of the schema seal.
--
-- MEASURED ON THE LIVE CATALOG BEFORE THIS MIGRATION (head 20261003007240):
--   select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname='public' and p.proname='assume_role'
--      and regexp_replace(p.prosrc,'--[^\n]*','','g') ~ 'session_selectable';   -> 0
--   i.e. the column was NOT read at all. `authz.roles` is RLS-enabled with ZERO policies and
--   relforcerowsecurity = false, so the DEFINER's owner (postgres) reads it and nobody else can.
--
-- ⚠ THE GATE DENIES NOTHING TODAY, AND THAT IS WHY THE PROOF IS A MUTATION. All eleven
-- `platform_role` enum values map to an authz.roles row with session_selectable = true; the one
-- FALSE row is `administrativo`, which is NOT a platform_role value and therefore unreachable
-- through this signature (it is a per-commission delegated capability, not a role — ADR 0061,
-- and 0176 D8 leaves its `authz.roles` seat to AE5). So a green suite proves nothing on its
-- own: pgTAP 408 flips one REAL role's session_selectable true -> false and asserts that role
-- becomes unselectable WHILE THE OTHERS STILL SELECT (the discrimination half — without it a
-- broken query satisfies the assertion too).
--
-- ⛔ IT IS STILL NOT DEAD CODE, and the reach of its SECOND branch is stated precisely rather
-- than gestured at. `coalesce(…, false)` also denies a role with NO authz.roles row at all:
--   * For MEMBERSHIP-DERIVED roles that branch is UNREACHABLE today, and the reason is a
--     constraint, not an argument: memberships_role_scope_kind_fkey is
--     `(role, scope_kind) -> authz.roles(code, allowed_scope_kind) MATCH FULL ON DELETE RESTRICT`,
--     so a membership cannot exist for a role the catalog does not carry, and the catalog row
--     cannot be deleted while one does. That FK retires only at AE5-complete (ADR 0162 §2), and
--     this gate is what stands behind it afterwards.
--   * For `platform_admin` it IS reachable, because that branch of assume_role reads
--     `profiles.is_admin` and touches no membership at all — so the catalog row can be removed
--     while a real platform admin still holds the role. pgTAP 408 §4 constructs exactly that and
--     proves the door then denies. ⛔ That asymmetry is why the fail-closed half is testable at
--     all; do not restate it as "unreachable".
--
-- ORDERING: the gate is FIRST, before the holds check. It is a property of the ROLE, not of the
-- user, so evaluating it first gives every caller the same answer for an unselectable role
-- instead of leaking whether they hold it. No production answer moves either way (see above).
--
-- SCOPE: this migration adds ONE gate to ONE function. ⛔ platform_role retirement is ADR 0176
-- D8, bundled into AE5 — not touched here. No policy, no ACL, no other body.
--
-- METHOD: pg_get_functiondef + replace + execute, with landing assertions in BOTH directions —
-- the substitution must not be a no-op, AND the body is re-read from pg_proc afterwards. A
-- mutation that did not fully apply otherwise reports green.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. PRECONDITIONS.
-- ---------------------------------------------------------------------------
do $mig$
declare
  v_orphans text;
begin
  if to_regprocedure('public.assume_role(public.platform_role)') is null then
    raise exception 'AE4.9 D7: public.assume_role(platform_role) not found. Refusing to no-op.'
      using errcode = 'check_violation';
  end if;

  -- ⛔ A `platform_role` value with NO authz.roles row would be locked out entirely by the
  -- fail-closed gate below. Measured here rather than assumed, because that is a lockout, not
  -- a tightening.
  select string_agg(e.enumlabel, ', ')
    into v_orphans
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
   where t.typname = 'platform_role'
     and not exists (select 1 from authz.roles r where r.code = e.enumlabel);
  if v_orphans is not null then
    raise exception
      'AE4.9 D7: these platform_role values have no authz.roles row and would become '
      'PERMANENTLY UNSELECTABLE: %. Seed them before enforcing session_selectable.', v_orphans
      using errcode = 'check_violation';
  end if;

  -- Every one of them must be selectable TODAY, or this migration changes a production answer
  -- while claiming not to.
  select string_agg(e.enumlabel, ', ')
    into v_orphans
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join authz.roles r on r.code = e.enumlabel
   where t.typname = 'platform_role'
     and not r.session_selectable;
  if v_orphans is not null then
    raise exception
      'AE4.9 D7: these platform_role values are session_selectable = false: %. Enforcing the '
      'column would REVOKE a live capability — rule on it before applying.', v_orphans
      using errcode = 'check_violation';
  end if;
end $mig$;

-- ---------------------------------------------------------------------------
-- 1. THE GATE.
-- ---------------------------------------------------------------------------
do $mig$
declare
  v_fn  constant text := 'public.assume_role(public.platform_role)';
  v_old constant text := '  if p_role = ''platform_admin'' then';
  v_rep constant text :=
    '  -- ⭐ G4 (ADR 0155), ENFORCED SERVER-SIDE (ADR 0176 D7). authz.roles is sealed from every' || chr(10) ||
    '  -- application role; this function is SECURITY DEFINER, so the read needs no grant.' || chr(10) ||
    '  -- FAIL CLOSED: a role with no catalog row is NOT selectable.' || chr(10) ||
    '  if not coalesce(' || chr(10) ||
    '       (select r.session_selectable from authz.roles r where r.code = p_role::text),' || chr(10) ||
    '       false) then' || chr(10) ||
    '    raise exception ''papel não selecionável nesta sessão'' using errcode = ''42501'';' || chr(10) ||
    '  end if;' || chr(10) ||
    '' || chr(10) ||
    '  if p_role = ''platform_admin'' then';
  v_src text;
  v_new text;
begin
  v_src := pg_get_functiondef(v_fn::regprocedure);

  if regexp_replace(v_src, '--[^' || chr(10) || ']*', '', 'g') ~ 'session_selectable' then
    raise exception 'AE4.9 D7: assume_role already reads session_selectable — investigate '
                    'rather than re-run.'
      using errcode = 'check_violation';
  end if;

  if position(v_old in v_src) = 0 then
    raise exception 'AE4.9 D7: assume_role does not contain the expected anchor. The body '
                    'changed since this migration was written — re-derive it from the catalog.'
      using errcode = 'check_violation';
  end if;

  v_new := replace(v_src, v_old, v_rep);
  if v_new = v_src then
    raise exception 'AE4.9 D7: substitution was a NO-OP on %.', v_fn
      using errcode = 'check_violation';
  end if;

  execute v_new;

  -- Re-read from the catalog AFTER the execute — belt and braces.
  if regexp_replace(pg_get_functiondef(v_fn::regprocedure), '--[^' || chr(10) || ']*', '', 'g')
     !~ 'session_selectable' then
    raise exception 'AE4.9 D7: the session_selectable gate is ABSENT from % after execute — '
                    'the mutation did not land.', v_fn
      using errcode = 'check_violation';
  end if;

  -- The DEFINER bit and the pinned search_path must survive the re-emit: pg_get_functiondef
  -- carries them, but a silent loss here would turn a role-selection door into an invoker
  -- function that cannot read the sealed schema at all.
  if not (select p.prosecdef from pg_proc p where p.oid = v_fn::regprocedure) then
    raise exception 'AE4.9 D7: assume_role lost its SECURITY DEFINER bit.'
      using errcode = 'check_violation';
  end if;
end $mig$;

comment on function public.assume_role(public.platform_role) is
  'Selects the caller''s ACTIVE ROLE for this session. ⭐ AE4.9 / ADR 0176 D7: the role must be '
  'authz.roles.session_selectable, read SERVER-SIDE inside this SECURITY DEFINER body — G4 '
  '(ADR 0155) is enforced without granting any application role USAGE on the sealed `authz` '
  'schema, which is what the superseded "not implementable" ruling had assumed was required. '
  'FAIL CLOSED: a platform_role value with no authz.roles row is not selectable. '
  '⚠ The gate denies NOTHING today — all eleven platform_role values are session_selectable, '
  'and the one false row (`administrativo`) is not a platform_role value. pgTAP 408 proves the '
  'gate is WIRED by flipping one real role true -> false and asserting the others still select. '
  '⛔ platform_role retirement is ADR 0176 D8 (AE5) and is not decided here.';
