-- =============================================================================
-- ADR 0078 · Gate 2 fix wave — A GATE-1 ESCAPE, fixed here.
--
-- ⚠ SCOPE: this is a **Gate-1 defect (A4 / D4·1)**, not Stage C, and unlike the
-- Gate-2 P0 it is **on `main`** — all three of its defining migrations shipped
-- there. Nothing is deployed (pre-pilot), but this is shipping code, not
-- branch-only. Recorded in its own migration so the record shows Gate 2 fixing a
-- Gate-1 escape. Found by the Gate-2 DEFINER class sweep (qa review §7 risk 1).
--
-- `public.list_cases_board` (prosecdef = t) computed a "coordinator fast-path"
-- boolean and used it to SHORT-CIRCUIT the per-row authorization predicate:
--     v_is_coordinator := app.is_staff_admin_of(p_commission_id)
--                         or app.is_commission_admin_of(p_commission_id);
--     ...  and (v_is_coordinator or app.can_read_case(c.id, v_uid))
-- The door never calls the resolver, so it is outside the perimeter BY
-- CONSTRUCTION — D4's own "general form": *every door that authorizes without
-- calling a case-read predicate is outside the perimeter.*
--
-- BOTH ARMS ARE BROKEN. Proven by execution, each with its control:
--
-- 1. THE ORG ARM (A4 / D4·1 — "Organization Users … lose case content").
--    orgadmin.a: is_member_of = f, `app.can_read_case` = FALSE on all five cases,
--    ZERO `cases` rows under RLS — yet the board returned **5**, including
--    case 5 `Denúncia Ética` (explicit_grants_only) and case 2's outcome
--    `Óbito evitável`.
--
-- 2. THE COORDINATOR ARM (ADR 0072 D2 — the hard deny). `app._case_caps` carries
--    `-- STEP 4 — HARD DENY, before every positive arm`, with
--    `if app.is_case_respondent(...)` at STEP 4 and
--    `v_coord := app.is_staff_admin_of_for(...)` a POSITIVE ARM at STEP 5, AFTER
--    it. The fast-path recomputes coordinator-ness directly and never reaches
--    STEP 4. Measured, coordinator made respondent of his own case:
--        is_staff_admin_of = t · is_case_respondent = t
--        app.can_read_case = FALSE   ← the hard deny WORKS at the resolver
--        cases base-table RLS = 0    ← and the policy honours it
--        list_cases_board          → RETURNS HIS OWN RESPONDENT CASE
--    ⇒ cutting only the org arm would have been INSUFFICIENT and left this live.
--
-- THE FIX: delete the short-circuit entirely; the row filter is now
-- `and app.can_read_case(c.id, v_uid)` — the single boundary, hard deny included.
--
-- NOT LOAD-BEARING ELSEWHERE (checked before deleting): in the LIVE body
-- `v_is_coordinator` occurred exactly TWICE — its declaration and the row filter.
-- No column projection, no ordering, no `administrativo` branch (the live body
-- contains no `member_can` / `administrativo` reference at all, despite
-- 20260714000100_administrativo_cases_board.sql's name). The variable is removed
-- with it.
--
-- NO FUNCTIONAL LOSS: for a legitimate coordinator the fast-path was
-- boundary-equivalent, purely a per-row shortcut — `chefe.ccih` has
-- `can_read_case = t` on 5/5 and reads 5 under RLS anyway.
--
-- COST, MEASURED (not restored as a bypass): 205 cases in the commission,
-- p_limit = 100 → fast-path 2.1 ms vs per-row predicate ~44 ms (48.0 / 40.8 ms,
-- median of 2). ~20x relative, ~44 ms absolute (~0.4 ms/row) for a
-- server-rendered board. Within budget; NOT a reason to bypass a boundary. If it
-- ever becomes one, the answer is a set-based rewrite, not a short-circuit.
--
-- ⚠ §7.2 IN A NEW DIRECTION — a comment asserting the invariant its code breaks:
-- `-- (ADR 0061 — no broadening beyond app.can_read_case's existing arms)` sat
-- DIRECTLY ABOVE the arm that broadened beyond `app.can_read_case`. Rewritten
-- below to describe the code that now exists.
--
-- METHOD: the body is REGENERATED FROM THE LIVE CATALOG (pg_get_functiondef) at
-- apply time and only the declaration + row filter + comments are edited — the
-- ~40-line projection is never restated, so it cannot drift (A28; migration text
-- is stale by design). pg_get_functiondef emits CREATE OR REPLACE carrying the
-- live STABLE / SECURITY DEFINER / search_path, so the ACL is never reset (the
-- 17a8d08 trap). Every step asserted.
-- =============================================================================

do $$
declare
  v_oid      oid;
  v_def      text;
  v_new      text;
  v_secdef   boolean;
  v_volatile "char";
  v_acl      text;
begin
  select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'list_cases_board';
  if v_oid is null then
    raise exception 'gate1/cases_board: public.list_cases_board not found';
  end if;

  v_def := pg_get_functiondef(v_oid);
  select prosecdef, provolatile, coalesce(array_to_string(proacl, ','), '<null>')
    into v_secdef, v_volatile, v_acl from pg_proc where oid = v_oid;

  -- §7.2 — the short-circuit must be LIVE CODE, not a comment.
  if not exists (
    select 1 from unnest(string_to_array(v_def, E'\n')) ln
     where ln ~ 'v_is_coordinator or app\.can_read_case' and trim(ln) !~ '^--'
  ) then
    raise exception 'gate1/cases_board: the short-circuit is not live code — premise wrong, stop';
  end if;

  -- 1. The row filter: the short-circuit goes; can_read_case is the sole boundary.
  v_new := replace(v_def,
    '    -- Coordinator sees all; a non-coordinator sees only cases they can already read'
    || E'\n' ||
    '    -- (ADR 0061 — no broadening beyond app.can_read_case''s existing arms).'
    || E'\n' ||
    '    and (v_is_coordinator or app.can_read_case(c.id, v_uid))',
    '    -- EVERY caller is filtered to app.can_read_case per row — the single case-read'
    || E'\n' ||
    '    -- boundary, ADR 0072 D2''s STEP-4 hard deny (respondent / recused) included.'
    || E'\n' ||
    '    -- ⛔ NEVER re-add a coordinator/admin short-circuit here. It looks like a'
    || E'\n' ||
    '    -- per-row cost saving; it is a BOUNDARY BYPASS. It let an org_admin read an'
    || E'\n' ||
    '    -- explicit_grants_only ethics case, and a coordinator read his OWN respondent'
    || E'\n' ||
    '    -- case, both with can_read_case = FALSE. Measured cost of doing it right at'
    || E'\n' ||
    '    -- p_limit=100 over 205 cases: ~44 ms. If that ever matters, rewrite it'
    || E'\n' ||
    '    -- set-based — do not bypass the boundary. (ADR 0078 Gate-2 wave.)'
    || E'\n' ||
    '    and app.can_read_case(c.id, v_uid)');
  if v_new = v_def then
    raise exception 'gate1/cases_board: the row-filter pattern did not match — body shape changed';
  end if;

  -- 2. The now-unused declaration + its false comment.
  v_def := v_new;
  v_new := replace(v_def,
    '  -- Coordinator fast-path: a staff_admin OR commission-admin (org_admin/'
    || E'\n' ||
    '  -- hospital_admin) sees the whole board without a per-row read check. Everyone'
    || E'\n' ||
    '  -- else is filtered to app.can_read_case per row (their existing read boundary).'
    || E'\n' ||
    '  v_is_coordinator boolean :='
    || E'\n' ||
    '    app.is_staff_admin_of(p_commission_id) or app.is_commission_admin_of(p_commission_id);'
    || E'\n',
    '');
  if v_new = v_def then
    raise exception 'gate1/cases_board: the v_is_coordinator declaration did not match';
  end if;

  execute v_new;

  -- POST-CONDITIONS -----------------------------------------------------------
  v_def := pg_get_functiondef(v_oid);
  if v_def ~ 'v_is_coordinator' then
    raise exception 'gate1/cases_board: v_is_coordinator SURVIVES';
  end if;
  if exists (select 1 from unnest(string_to_array(v_def, E'\n')) ln
              where ln ~ 'app\.is_commission_admin_of' and trim(ln) !~ '^--') then
    raise exception 'gate1/cases_board: the org arm survives as live code';
  end if;
  if v_def !~ 'and app\.can_read_case\(c\.id, v_uid\)' then
    raise exception 'gate1/cases_board: the per-row can_read_case filter is MISSING — fail closed';
  end if;
  if (select prosecdef from pg_proc where oid = v_oid) is distinct from v_secdef then
    raise exception 'gate1/cases_board: prosecdef changed';
  end if;
  if (select provolatile from pg_proc where oid = v_oid) is distinct from v_volatile then
    raise exception 'gate1/cases_board: provolatile changed (the ac57a20 class)';
  end if;
  if (select coalesce(array_to_string(proacl, ','), '<null>') from pg_proc where oid = v_oid)
     is distinct from v_acl then
    raise exception 'gate1/cases_board: the ACL changed (the 17a8d08 class)';
  end if;
end $$;
