-- QO·B M5 — the response-plane DOORS. Closes a real hole left by M1–M4.
--
-- ADR 0100 D12; inventory §4.1, PO-ratified 2026-08-08.
--
-- ⛔ WHY THIS EXISTS: M1 walled the response TABLES and every gate held, but six DEFINER
-- doors in the SAME ratified §4.1 list were never cut, and they bypass RLS entirely.
-- MEASURED against the post-M4 catalog, as orgadmin.a:
--     dashboard_free_text(form)            -> 6 rows   ← free-text answers, the most
--                                                        sensitive payload on the plane
--     dashboard_export_rows(form)          -> 6 rows
--     dashboard_completion_by_member(form) -> 2 rows
-- So the tenancy admin could still read every free-text answer in the commission
-- through a door, while the table it came from returned zero. The wall had a hole.
--
-- ⚠ NOTHING IN THE ESTATE CAUGHT THIS, and the reason generalises:
--   · the A/B equivalence matrix measures TABLE row visibility under RLS — a DEFINER
--     door is invisible to it BY CONSTRUCTION;
--   · the ADR 0079 door sweep neutralizes BOOLEAN gates — these return SETOF, so the
--     harness cannot express them and they were never in its population;
--   · `ARM=floor` asks whether a door is CALLED, not whether its gate is right;
--   · 314 asserted the tables, not the doors.
-- Four green gates, each blind to this in a different way. The union of scoped sweeps
-- is not a sweep. It was found by re-reading the ratified CUT list against the catalog
-- and asking "did I actually cut each of these?" — the plainest possible check, and the
-- one no harness performs.
--
-- The three dashboard_* doors are the SAME three D11 already rules must stay closed to
-- the quality_reviewer; cutting them here makes the two oversight tiers consistent
-- instead of leaving the tenancy admin with strictly more reach than the reviewer whose
-- whole purpose is oversight.
--
-- ⚠ The SIX AGGREGATE dashboard doors are deliberately untouched (D12 ⑥ keeps
-- PHI-free aggregates). Postcondition (c) asserts that, so an over-zealous follow-up
-- that sweeps all nine reds here rather than reaching a customer.

begin;

do $$
declare
  r        record;
  v_src    text;
  v_new    text;
  v_cut    int := 0;
  -- §4.1-ratified response-plane doors that still admit the tenancy admin.
  v_targets text[] := array[
    'dashboard_free_text','dashboard_export_rows','dashboard_completion_by_member',
    'get_response_for_signoff','supersede_response','target_case_response'];
begin
  for r in
    select p.oid, p.proname
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
      and p.proname = any(v_targets)
    order by p.proname
  loop
    v_src := pg_get_functiondef(r.oid);

    -- Remove the tenancy disjunct in both orders; the argument may carry one level of
    -- nesting (e.g. v_response.commission_id).
    v_new := regexp_replace(v_src,
      '\s+or\s+app\.is_commission_admin_of\((?:[^()]|\([^()]*\))*\)', '', 'g');
    v_new := regexp_replace(v_new,
      'app\.is_commission_admin_of\((?:[^()]|\([^()]*\))*\)\s+or\s+', '', 'g');

    if v_new = v_src then
      raise exception
        'QO·B M5: the tenancy-disjunct removal matched NOTHING in %(). Re-read its gate '
        'from pg_get_functiondef and handle it explicitly — refusing to no-op silently.',
        r.proname;
    end if;
    if regexp_replace(v_new, '/\*.*?\*/', ' ', 'gs') ~ '\yis_commission_admin_of\y' then
      raise exception 'QO·B M5: %() still routes the tenancy admin — the cut is partial.', r.proname;
    end if;

    execute v_new;
    v_cut := v_cut + 1;
  end loop;

  if v_cut <> 6 then
    raise exception 'QO·B M5: expected to cut 6 response-plane doors, cut %', v_cut;
  end if;
  raise notice 'QO·B M5: tenancy disjunct removed from % response-plane doors', v_cut;
end $$;

-- ---------------------------------------------------------------------------
-- Postconditions.
-- ---------------------------------------------------------------------------
do $$
declare v_bad text; v_keep int;
begin
  -- (a) None of the six may still admit the tenancy admin.
  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p
  where p.pronamespace='public'::regnamespace
    and p.proname = any(array['dashboard_free_text','dashboard_export_rows','dashboard_completion_by_member',
                              'get_response_for_signoff','supersede_response','target_case_response'])
    and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
        ~ '\yis_commission_admin_of\y';
  if v_bad is not null then
    raise exception 'QO·B M5 postcondition (a): response-plane door still admits the tenancy admin: %', v_bad;
  end if;

  -- (b) NON-VACUITY: all six must exist, or (a) passes for the wrong reason.
  select count(*) into v_keep from pg_proc
   where pronamespace='public'::regnamespace
     and proname = any(array['dashboard_free_text','dashboard_export_rows','dashboard_completion_by_member',
                             'get_response_for_signoff','supersede_response','target_case_response']);
  if v_keep < 6 then
    raise exception 'QO·B M5 postcondition (b) VACUOUS: expected 6 doors, found %', v_keep;
  end if;

  -- (c) OVER-CUT GUARD: the SIX AGGREGATE dashboard doors must STILL admit the tenancy
  --     admin (D12 ⑥ keeps PHI-free aggregates). The nine dashboard_* doors split
  --     two-to-one, and a follow-up that "finishes the job" across all nine is the
  --     plausible mistake — it reds HERE rather than reaching a customer.
  select count(*) into v_keep from pg_proc
   where pronamespace='public'::regnamespace
     and proname = any(array['dashboard_distributions','dashboard_entity_references','dashboard_form_totals',
                             'dashboard_matrix_cells','dashboard_risk_scores','dashboard_submissions_over_time'])
     and regexp_replace(regexp_replace(prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
         ~ '\yis_commission_admin_of\y';
  if v_keep <> 6 then
    raise exception
      'QO·B M5 postcondition (c): expected all 6 AGGREGATE dashboard doors to KEEP the '
      'tenancy arm (D12 ⑥), found %. Over-cut, not under-cut.', v_keep;
  end if;
end $$;

commit;
