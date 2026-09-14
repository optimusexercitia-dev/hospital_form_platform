-- AE5 increment 1, T6 — the ATOMIC CUTOVER: `staff`'s single-role wrapper, and the state flip.
--
-- Plan: docs/progress/ae5-staff.md § "T6 atomic cutover PLAN", ACKED with four conditions
-- (A1 hat both polarities · A2 principal state by named cells · A3 the zero-caller authority ·
-- A4 `426` is backend's). Decision: ADR 0211 D1/D2/D3.
--
-- ⛔⛔ WHAT THIS MIGRATION DOES **NOT** DO, stated first because the omissions are the design:
--   * it re-keys NOTHING. All 18 manifest rows stay `pending-rekey`; `410 § 4.5` stays `58 / 3`.
--     A landing that moved that pair would be a re-key hiding inside a cutover.
--   * it does not touch `app.is_member_of(_for)` or any of their 82 live dependents. ADR 0211 D3:
--     `is_member_of` stays a role-SET predicate until BOTH commission roles are `authoritative`.
--     After this migration they are — so the re-expression becomes AVAILABLE, and it is still not
--     performed here. It lands with T7, per site, from matrix § 5.4.
--   * it creates no policy and no domain authorizer.
--
-- ⛔ ONE MIGRATION, NOT TWO, and they are not separable: `authz.holds_role` refuses a
-- non-`authoritative` role, so a wrapper created before the flip denies everyone; and a flip before
-- the wrapper leaves a window in which the catalog is authoritative for `staff` with no single-role
-- predicate to ask.

-- ============================================================================
-- 1. SNAPSHOT — captured BEFORE, asserted AFTER, in this transaction.
--
-- ⚠ THIS BLOCK IS DOING A DIFFERENT JOB FROM `20261003007210`'s, AND SAYING SO IS THE POINT.
-- There, the wrappers already existed and the risk was `create or replace` silently changing a
-- property (its own comment: "`create or replace` is NOT drop+create: name, signature, `prosecdef`,
-- volatility, `search_path` and ACLs all persist"). Here the functions are NEW, so there is nothing
-- to preserve — the block asserts the properties they were CREATED WITH, against the values ADR
-- 0208 D4 and the acked plan require. A block copied without that change would assert that nothing
-- moved, which is trivially true of an object that did not exist a moment ago.
-- ============================================================================
create temp table t7460_before on commit drop as
select p.oid, n.nspname, p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef, p.provolatile, p.proconfig, p.proowner, p.proacl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'app'
   and p.proname in ('is_staff_admin_of', 'is_staff_admin_of_for',
                     'is_member_of', 'is_member_of_for',
                     'is_commission_staff_of', 'is_commission_staff_of_for');

do $$
declare v_new integer; v_roles text;
begin
  -- The two NEW names must not already exist: a `create or replace` over an existing function
  -- would inherit its ACLs and search_path silently, which is the one thing § 1 exists to refuse.
  select count(*) into v_new from t7460_before
   where proname in ('is_commission_staff_of', 'is_commission_staff_of_for');
  if v_new <> 0 then
    raise exception 'app.is_commission_staff_of(_for) already exists (% rows) — this migration '
                    'creates them and must not silently replace an object it did not write', v_new;
  end if;

  select string_agg(code || '=' || state::text, ', ' order by code) into v_roles
    from authz.roles where state <> 'legacy';
  if v_roles is distinct from 'staff=test_validation, staff_admin=authoritative' then
    raise exception 'expected the non-legacy role set to be exactly '
                    '`staff=test_validation, staff_admin=authoritative` before the cutover; found `%`',
                    coalesce(v_roles, '(none)');
  end if;
end $$;

-- ============================================================================
-- 2. THE WRAPPER PAIR (ADR 0211 D1).
--
-- ⛔ `search_path = ''` AND A SCHEMA-QUALIFIED BODY — NOT the path of the pair being mirrored.
-- `app.is_staff_admin_of(_for)` run on `search_path=app, public, pg_catalog`, which ADR 0208 D4
-- freezes as compatibility debt that "may not grow": two new DEFINERs on that path would grow the
-- frozen 860 by two and red `419` + gate 18. D4 rules the empty path "the sole forward convention
-- for new or touched SECURITY DEFINER functions". ⇒ mirror the ACLs, never the path.
--
-- ⭐ The PAIR is created together (ADR 0200): a predicate parameterised on a principal owes its
-- `_for` twin, so no site is ever forced to choose between a caller-keyed and a subject-keyed arm.
-- ============================================================================
create or replace function app.is_commission_staff_of(p_commission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select authz.holds_role((select auth.uid()), 'staff', 'commission', p_commission_id);
$fn$;

create or replace function app.is_commission_staff_of_for(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select authz.holds_role(p_user_id, 'staff', 'commission', p_commission_id);
$fn$;

alter function app.is_commission_staff_of(uuid) owner to postgres;
alter function app.is_commission_staff_of_for(uuid, uuid) owner to postgres;

-- ⛔⛔ THE GRANTS ARE STATED, NOT INHERITED BY RESEMBLANCE — and `authenticated` is DEFERRED TO T7.
--
-- (a) NO PUBLIC. Measured: `app.is_member_of` carries a stray `=X/postgres` (PUBLIC EXECUTE) entry
--     that its own `_for` twin does not. Copying the bare member of that pair would propagate a
--     stray grant into a brand-new object, so every grant here is written out and `revoke all from
--     public` precedes them.
--
-- (b) ⚠ `authenticated` IS **NOT** GRANTED HERE, AND THAT IS A DEVIATION FROM "mirror the ACLs
--     exactly" THAT THE PLAN'S REVIEWER SHOULD RULE ON. Measured today, the privilege budget is
--     EXACTLY AT ITS CEILING: `app=326  public=433  total=759`, ceiling `759`
--     (`docs/backend-state/authorization-and-audit.md`'s BUDGET-ANCHOR, mirrored by `320 § U4`,
--     gate 15). Two new `prosecdef` functions executable by `authenticated` make it `app=328
--     total=761` and BREACH it. ⛔ That ceiling "moves only by PO ruling, with a named
--     justification in the raising increment's own gate record", and editing the pin to match
--     "INVERTS the authority the gate enforces" — so it is not mine to move and not something to
--     absorb quietly.
--     ⭐ Deferring costs nothing at T6 BECAUSE THE WRAPPER HAS ZERO CALLERS BY DESIGN (see § 4):
--     nothing executes as `authenticated` against it until T7 re-keys a site onto it, and T7 is
--     where the grant belongs — the same discipline as the zero-caller census line, applied to a
--     privilege instead of a function. A privilege with no consumer is a privilege that should not
--     exist yet.
--     ⇒ TO MIRROR EXACTLY INSTEAD, add `authenticated` to the grant below AND obtain the PO ruling
--     that raises the ceiling to 761, with its justification in this increment's gate record.
--     ⛔ Do not do one without the other.
revoke all on function app.is_commission_staff_of(uuid) from public;
revoke all on function app.is_commission_staff_of_for(uuid, uuid) from public;
grant execute on function app.is_commission_staff_of(uuid) to service_role;
grant execute on function app.is_commission_staff_of_for(uuid, uuid) to service_role;

comment on function app.is_commission_staff_of(uuid) is
  'AE5 increment 1 (ADR 0211 D1) — `staff`''s single-role wrapper, layer 1 (assignment '
  'projection). SUBJECT: the CALLER (auth.uid(), no parameter). HAT: REQUIRED — authz.holds_role '
  'applies the active-role filter on a self question. definerSurface: prosecdef=t, carries no '
  'permission code (it is a ROLE predicate, not a permission check — ADR 0174). ⛔ Its `_for` twin '
  'is the one to call when the question is about a third party; never re-key a subject-keyed site '
  'onto this one (ADR 0200/0201 D3). ⚠ ZERO CALLERS AT T6 BY DESIGN — T7 is its consumer.';

comment on function app.is_commission_staff_of_for(uuid, uuid) is
  'AE5 increment 1 (ADR 0211 D1) — the subject-keyed twin. SUBJECT: `p_user_id`. HAT: IGNORED when '
  'p_user_id <> auth.uid(), REQUIRED when it equals it — the asymmetry is internal to '
  'authz.holds_role and is never a caller-supplied flag. definerSurface: prosecdef=t, no permission '
  'code. ⚠ ZERO CALLERS AT T6 BY DESIGN — T7 is its consumer.';

-- ============================================================================
-- 3. THE FLIP — count-verified (mirrors `20261003007440`'s block).
-- ============================================================================
do $$
declare v_flipped integer; v_auth integer; v_tv integer;
begin
  update authz.roles set state = 'authoritative'
   where code = 'staff' and state = 'test_validation';
  get diagnostics v_flipped = row_count;
  if v_flipped <> 1 then
    raise exception 'expected to flip exactly 1 role to authoritative, flipped % — `staff` was not '
                    '`test_validation` at this point in the chain', v_flipped;
  end if;

  select count(*) into v_auth from authz.roles where state = 'authoritative';
  select count(*) into v_tv   from authz.roles where state = 'test_validation';
  if v_auth <> 2 then
    raise exception 'expected exactly 2 authoritative roles after the cutover, found %', v_auth;
  end if;
  if v_tv <> 0 then
    raise exception 'expected 0 roles left in test_validation after the cutover, found %', v_tv;
  end if;
end $$;

-- ============================================================================
-- 4. ASSERT-AFTER — the four properties, plus the ACL as a SORTED ARRAY.
--
-- ⛔ THE ACL IS COMPARED AS A SORTED ARRAY, NEVER AS A COUNT: a count cannot tell a lost grant
-- from a swapped one, which is the shape a privilege audit is written to catch.
-- ============================================================================
do $$
declare
  r record;
  v_expected_acl text[] := array['postgres=X/postgres', 'service_role=X/postgres'];
  v_acl text[];
begin
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args,
           p.prosecdef, p.provolatile, p.proconfig, pg_get_userbyid(p.proowner) as owner, p.proacl
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'app'
       and p.proname in ('is_commission_staff_of', 'is_commission_staff_of_for')
  loop
    if not r.prosecdef then
      raise exception '%: prosecdef is false — the wrapper must be SECURITY DEFINER', r.proname;
    end if;
    if r.provolatile <> 's' then
      raise exception '%: volatility is %, expected STABLE (`s`)', r.proname, r.provolatile;
    end if;
    if r.proconfig is distinct from array['search_path=""'] then
      raise exception '%: proconfig is %, expected {search_path=""} (ADR 0208 D4 — the empty path '
                      'is the sole forward convention and the frozen non-empty set may not grow)',
                      r.proname, coalesce(array_to_string(r.proconfig, ','), '(null)');
    end if;
    if r.owner <> 'postgres' then
      raise exception '%: owner is %, expected postgres', r.proname, r.owner;
    end if;
    select array_agg(a order by a) into v_acl from unnest(r.proacl::text[]) a;
    if v_acl is distinct from v_expected_acl then
      raise exception '%: proacl is %, expected % — ⛔ compared as a SORTED ARRAY, not a count: a '
                      'count cannot tell a lost grant from a swapped one, and a PUBLIC entry here '
                      'would be exactly the stray `app.is_member_of` carries',
                      r.proname, coalesce(array_to_string(v_acl, ' , '), '(null)'),
                      array_to_string(v_expected_acl, ' , ');
    end if;
  end loop;

  -- and the four MIRRORED functions are untouched by this migration.
  if exists (
    select 1
      from t7460_before b
      join pg_proc p on p.oid = b.oid
     where b.proname in ('is_staff_admin_of', 'is_staff_admin_of_for', 'is_member_of', 'is_member_of_for')
       and (p.prosecdef, p.provolatile, p.proconfig, p.proacl)
           is distinct from (b.prosecdef, b.provolatile, b.proconfig, b.proacl)
  ) then
    raise exception 'a pre-existing wrapper changed a security property during this migration — '
                    'this cutover creates two functions and flips one role, and touches neither '
                    'pair it mirrors';
  end if;
end $$;
