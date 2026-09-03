-- AE4/IA-F9 — QA finding: `app.current_professional_read_organizations` declares a
-- search_path that resolves to NOTHING it names. Follow-on to 20261003007320 (ADR 0182);
-- found by the QA review of that increment, 2026-09-03.
--
-- ============================================================================
-- THE DEFECT. 20261003007320 line 226 emitted
--
--     set search_path to 'app, public, pg_catalog'
--
-- SINGLE-QUOTED. That is ONE identifier — a schema literally named
-- `app, public, pg_catalog` — not a three-element list. Postgres accepts it, stores it, and
-- silently searches nothing: a non-existent schema in `search_path` is skipped, not an error.
--
-- MEASURED, not read off the text (2026-09-03):
--
--   function                                        current_schemas(true)
--   app.can_read_professional_profile  (sibling)    {pg_temp_87, app, public, pg_catalog}
--   app.current_professional_read_organizations     {pg_temp_87, pg_catalog}
--
-- The catalog showed the tell all along and it was read past: `proconfig` renders the correct
-- form as `search_path=app, public, pg_catalog` and the broken one as
-- `search_path="app, public, pg_catalog"` — the ESCAPED QUOTES are the whole difference.
--
-- ⛔ WHY IT DID NOT BITE, and why that is not a reason to leave it. The body fully qualifies
-- every name it uses (`authz.authorized_scope_ids`, `auth.uid()`), so nothing was ever resolved
-- through the empty path. That makes this latent, not harmless: this is a SECURITY DEFINER
-- function on the authorization path, and it is ONE unqualified identifier away from resolving
-- a name somewhere the caller can influence. The declared safety property was simply not the
-- one in force.
--
-- ⚠ THE `authz.*` FUNCTIONS ARE NOT AFFECTED. Their `set search_path to ''` is the intended
-- empty path and matches every sibling resolver; measured, it yields `{pg_temp_N, pg_catalog}`,
-- which is what an empty search_path means (`pg_catalog` is always implicitly searched).
-- Only this one function used the list form, and only this one got it wrong.
--
-- ⛔ AND THE TEST PINNED THE DEFECT. pgTAP 413's catalog keystone hand-typed the expected
-- `proconfig` string, copied from the broken catalog output, so the suite would have gone RED
-- when someone fixed this. That is repaired in the same commit, and repaired STRUCTURALLY: the
-- assertion now compares this function's `search_path` to its SIBLING's rather than to a
-- hand-typed constant. A hand-typed expected value is what made a defect look like a pass.
-- ============================================================================

-- Preflight. This migration is a no-op-if-already-right, but it must not silently apply to a
-- function that has drifted into some third shape — that would mean 7320 is not what is
-- installed and this fix is aimed at the wrong body.
do $preflight$
declare
  v_cfg text;
begin
  select array_to_string(p.proconfig, ',') into v_cfg
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'current_professional_read_organizations';

  if v_cfg is null then
    raise exception
      'search_path fix REFUSED — app.current_professional_read_organizations is not installed, or carries no SET clause at all.';
  end if;

  if v_cfg not in ('search_path="app, public, pg_catalog"',   -- the defect 7320 shipped
                   'search_path=app, public, pg_catalog') then -- already fixed
    raise exception
      'search_path fix REFUSED — unexpected proconfig %. Expected either the 7320 defect or the corrected form; a third shape means this fix is aimed at the wrong body.',
      v_cfg;
  end if;
end
$preflight$;

-- The body is re-emitted BYTE-IDENTICAL to 20261003007320's. The ONLY change is the SET
-- clause, which is now an unquoted identifier list. `create or replace` preserves the ACL.
create or replace function app.current_professional_read_organizations()
returns setof uuid
language sql
stable
security definer
set search_path to app, public, pg_catalog
as $function$
  select authz.authorized_scope_ids(
           (select auth.uid()),
           'organization',
           'org.professionals.read'
         );
$function$;

-- Postflight. Two assertions, and the first is a DIFFERENTIAL rather than a constant: the
-- reference is the sibling authorizer that has always been right, so this cannot be satisfied
-- by re-encoding whatever this migration happened to produce.
do $postflight$
declare
  v_this    text;
  v_sibling text;
  v_acl     text;
begin
  select array_to_string(p.proconfig, ',') into v_this
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'current_professional_read_organizations';

  select array_to_string(p.proconfig, ',') into v_sibling
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'can_read_professional_profile';

  if v_this is distinct from v_sibling then
    raise exception
      'search_path fix POSTFLIGHT FAILED — this function declares %, its sibling app.can_read_professional_profile declares %. The two app-layer authorizers must resolve names identically.',
      v_this, v_sibling;
  end if;

  -- The quote character is the entire tell between the two forms; assert its absence directly
  -- so a future edit that re-introduces the literal cannot pass by matching a stale sibling.
  if v_this like '%"%' then
    raise exception
      'search_path fix POSTFLIGHT FAILED — proconfig % still contains a quote, i.e. the list collapsed to ONE identifier again.',
      v_this;
  end if;

  select coalesce(array_to_string(p.proacl, ','), '(null)') into v_acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'current_professional_read_organizations';

  if v_acl is distinct from 'postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres' then
    raise exception
      'search_path fix POSTFLIGHT FAILED — the ACL moved to %. `create or replace` must preserve it; a NULL proacl would include PUBLIC.',
      v_acl;
  end if;

  raise notice
    'app.current_professional_read_organizations search_path fixed: % (identical to its sibling), ACL preserved.',
    v_this;
end
$postflight$;
