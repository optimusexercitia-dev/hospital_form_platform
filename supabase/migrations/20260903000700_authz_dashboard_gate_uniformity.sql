-- BUG-AUTHZ-001 — unify the dashboard DEFINER gate on ONE shape.
--
-- FILED AS: "`platform_admin` reads response-level content through DEFINER dashboard
-- functions, invisible to a policy audit of `responses`." True, and understated. The
-- live catalog (never the migration text — CLAUDE.md graphify exception) shows the nine
-- `dashboard_*` functions split into two mutually exclusive gate shapes:
--
--   A (5): is_staff_admin_of(cid) OR app.is_admin()
--          distributions · entity_references · export_rows · matrix_cells · risk_scores
--   B (4): is_staff_admin_of(cid) OR app.is_commission_admin_of(cid)
--          completion_by_member · form_totals · free_text · submissions_over_time
--
-- So shape A is wrong at BOTH ends, and the bug report only named one:
--
--  1. It ADMITS `platform_admin` to commission content. `dashboard_export_rows` returns
--     TABLE(response_id, member_name, submitted_at, version_number, answers jsonb,
--     signoffs jsonb) — one row per response with its answers and the member's name, not
--     an aggregate. CLAUDE.md's noun rule says platform_admin may not touch commission
--     content; ADR 0078 A35 rests on a census finding it reads 0 responses. That census
--     read `pg_policies` and was structurally blind to `prosecdef` — ADR 0078's own
--     documented blind spot. The policies were right; the DEFINER door was the leak.
--  2. It DENIES `org_admin` / `hospital_admin`, who ARE admitted by shape B. A live
--     access gap nobody filed: the same org_admin reads Totais/Texto livre/Ao longo do
--     tempo but takes 42501 on Distribuições/Exportar/Matriz/Risco/Referências.
--
-- PO-ruled 2026-08-03: unify on shape B. One change closes the overreach and the gap,
-- and leaves all nine functions structurally identical.
--
-- ROOT CAUSE (docs/reviews/phase-8-review.md): at Phase 8 all six original dashboard
-- functions shared ONE gate — shape A. A later change put the commission-admin mirror
-- on four of them and MISSED `dashboard_distributions` + `dashboard_export_rows`. That
-- partial conversion created shape B, broke no test, and every door added since copied
-- a sibling in good faith (FF-2 two, FF-5 one), carrying the stale shape from 2 doors
-- to 5. A rewrite applied to PART of a function family is invisible to every check this
-- platform runs — which is why the guard at the bottom of this file is an invariant over
-- `pg_proc` rather than a corrected list of names.
--
-- ⚠ The filed report named FOUR functions and misnamed one (`dashboard_matrix_risk_scores`;
-- the relation is `dashboard_risk_scores`). `dashboard_entity_references` — FF-5's
-- reference surface, added after the report — carries the same arm and was never listed.
-- Hence the rewrite below enumerates from `pg_proc`, NOT from a hand-written list: the
-- authority defining the property is the catalog, and any list typed into this file
-- would go stale the next time a dashboard function is added.

do $$
declare
  r        record;
  v_src    text;
  v_new    text;
  v_fixed  int := 0;
begin
  -- Enumerate from the catalog, not a literal list (see the note above).
  for r in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'          -- ⚠ the dashboard_* fns live in PUBLIC; the
      and p.proname like 'dashboard\_%' --   authz HELPERS they call live in `app`.
      and pg_get_functiondef(p.oid) ~ 'app\.is_admin\(\)'
    order by p.proname
  loop
    v_src := pg_get_functiondef(r.oid);

    -- Every shape-A gate binds the commission to `v_commission_id` before the check.
    -- Assert it rather than assume it: if a future function used a different variable,
    -- a blind replace would produce a body referencing an undeclared identifier that
    -- only fails at CALL time, long after this migration reported success.
    if v_src !~ 'app\.is_staff_admin_of\(v_commission_id\)\s+or\s+app\.is_admin\(\)' then
      raise exception
        'BUG-AUTHZ-001: public.% carries app.is_admin() but not the expected '
        '"is_staff_admin_of(v_commission_id) or is_admin()" gate — rewrite by hand.',
        r.proname;
    end if;

    v_new := replace(v_src, 'app.is_admin()', 'app.is_commission_admin_of(v_commission_id)');

    if v_new = v_src then
      raise exception 'BUG-AUTHZ-001: rewrite of % was a no-op', r.proname;
    end if;

    execute v_new;
    v_fixed := v_fixed + 1;
    raise notice 'BUG-AUTHZ-001: rewrote gate of public.%', r.proname;
  end loop;

  raise notice 'BUG-AUTHZ-001: % dashboard function(s) rewritten', v_fixed;
end $$;

-- ---------------------------------------------------------------------------
-- The invariant, asserted executably (idempotent: re-running this migration on an
-- already-fixed database re-checks it and passes with 0 rewrites).
--
-- This is the load-bearing claim of the whole change; a NOTICE would let it rot
-- silently the next time someone copies an old dashboard function as a template.
-- ---------------------------------------------------------------------------
do $$
declare
  v_leaks text;
  v_gaps  text;
  v_pop   int;
begin
  -- NON-VACUITY FIRST. Both checks below are "no function matches X" assertions, and
  -- an empty population satisfies those BY CONSTRUCTION. The first draft of this file
  -- looked in `app` (where the helpers live) instead of `public` (where the dashboard
  -- functions live) and would have passed on ZERO rows while changing nothing.
  select count(*) into v_pop
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'dashboard\_%';

  if v_pop = 0 then
    raise exception
      'BUG-AUTHZ-001: found 0 public.dashboard_* functions — the invariant below would '
      'pass vacuously. Schema moved? Fix the predicate, do not delete the check.';
  end if;

  select string_agg(p.proname, ', ' order by p.proname) into v_leaks
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'dashboard\_%'
    and pg_get_functiondef(p.oid) ~ 'app\.is_admin\(\)';

  if v_leaks is not null then
    raise exception 'BUG-AUTHZ-001: platform_admin arm still present on: %', v_leaks;
  end if;

  -- The other half of the unification: every dashboard function must now ADMIT the
  -- org/hospital admin. Without this arm the fix would have silently degraded into
  -- "strip is_admin()", leaving the org_admin gap that motivated half the change.
  select string_agg(p.proname, ', ' order by p.proname) into v_gaps
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'dashboard\_%'
    and pg_get_functiondef(p.oid) !~ 'app\.is_commission_admin_of\(';

  if v_gaps is not null then
    raise exception 'BUG-AUTHZ-001: org/hospital-admin arm missing on: %', v_gaps;
  end if;
end $$;
