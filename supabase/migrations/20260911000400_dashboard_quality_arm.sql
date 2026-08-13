-- =============================================================================
-- QO·A M5 — the quality_reviewer arm on exactly the SIX aggregate dashboard
-- doors (ADR 0100 D11).
--
-- The live catalog holds NINE dashboard_* DEFINER doors. Return shapes split
-- them: six AGGREGATES gain the reviewer arm (distributions, entity_references,
-- form_totals, matrix_cells, risk_scores, submissions_over_time); three
-- ROW-LEVEL doors stay closed to the reviewer (export_rows, free_text,
-- completion_by_member — they return per-response rows incl. member names).
--
-- Mechanism: each armed door is rewritten from its LIVE pg_get_functiondef with
-- exactly ONE gate-line substitution (the established house pattern — this is
-- why migration file text is stale by design). The needle raise + length check
-- prove exactly one replacement landed per door; the postcondition pins the
-- 6/3 split from the catalog (pgTAP 270's rewritten two-class invariant holds
-- it from then on). CREATE OR REPLACE via the emitted definition preserves
-- owner, ACL, SECURITY DEFINER, search_path and volatility by construction.
--
-- ⚠ The doors deny by silent empty `return;`, NOT by raising — deliberately
-- unchanged (changing the deny mode of nine doors is app-visible scope creep).
-- Deny keystones are zero-row assertions PAIRED with permitted-caller
-- non-vacuity twins (270's in-file discipline).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The helper: ONE predicate carries "this commission's dashboards are readable
-- by this quality reviewer" — arm-consistent with S7 (M4): hospital-scoped role
-- + oversight-visible commission. Unknown commission fails closed via the
-- coalesce. auth.uid()-flavored like the doors' existing is_staff_admin_of arm.
-- -----------------------------------------------------------------------------
create function app.can_read_quality_dashboards(p_commission_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.is_quality_reviewer_of(app.hospital_of_commission(p_commission_id))
     and coalesce(
           (select quality_oversight from public.commissions where id = p_commission_id),
           'excluded') = 'visible';
$function$;

revoke all on function app.can_read_quality_dashboards(uuid) from public;
grant execute on function app.can_read_quality_dashboards(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Arm the six aggregate doors.
-- -----------------------------------------------------------------------------
do $$
declare
  -- The 8 form-derived doors share one gate line verbatim; form_totals takes
  -- p_commission_id directly. Needles captured from the live catalog 2026-08-06.
  c_needle_form constant text :=
    'if v_commission_id is null or not (app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)) then';
  c_repl_form constant text :=
    'if v_commission_id is null or not (app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id) or app.can_read_quality_dashboards(v_commission_id)) then';
  c_needle_totals constant text :=
    'if not (app.is_staff_admin_of(p_commission_id) or app.is_commission_admin_of(p_commission_id)) then';
  c_repl_totals constant text :=
    'if not (app.is_staff_admin_of(p_commission_id) or app.is_commission_admin_of(p_commission_id) or app.can_read_quality_dashboards(p_commission_id)) then';
  v_fn   text;
  v_old  text;
  v_new  text;
begin
  foreach v_fn in array array[
    'dashboard_distributions',
    'dashboard_entity_references',
    'dashboard_matrix_cells',
    'dashboard_risk_scores',
    'dashboard_submissions_over_time'
  ] loop
    v_old := pg_get_functiondef(format('public.%I(uuid,date,date)', v_fn)::regprocedure);
    v_new := replace(v_old, c_needle_form, c_repl_form);
    if v_new = v_old then
      raise exception 'M5: gate needle not found in % — the door text drifted; re-read the catalog', v_fn;
    end if;
    if length(v_new) - length(v_old)
       <> length(c_repl_form) - length(c_needle_form) then
      raise exception 'M5: more than one gate replacement landed in %', v_fn;
    end if;
    execute v_new;
  end loop;

  v_old := pg_get_functiondef('public.dashboard_form_totals(uuid,date,date)'::regprocedure);
  v_new := replace(v_old, c_needle_totals, c_repl_totals);
  if v_new = v_old then
    raise exception 'M5: gate needle not found in dashboard_form_totals';
  end if;
  if length(v_new) - length(v_old) <> length(c_repl_totals) - length(c_needle_totals) then
    raise exception 'M5: more than one gate replacement landed in dashboard_form_totals';
  end if;
  execute v_new;
end $$;

-- -----------------------------------------------------------------------------
-- Postcondition: the D11 boundary, from the catalog (comment-stripped). Exactly
-- the six aggregates carry the helper; the three row-level doors carry ZERO
-- trace of it; all nine kept their original two admin arms and prosecdef.
-- -----------------------------------------------------------------------------
do $$
declare v_armed text[]; v_rowlevel_armed int; v_kept int;
begin
  select coalesce(array_agg(p.proname order by p.proname), '{}') into v_armed
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'dashboard\_%'
    and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'can_read_quality_dashboards';

  if v_armed <> array['dashboard_distributions','dashboard_entity_references','dashboard_form_totals',
                      'dashboard_matrix_cells','dashboard_risk_scores','dashboard_submissions_over_time'] then
    raise exception 'M5 postcondition: armed set is % — expected exactly the six aggregates', v_armed;
  end if;

  select count(*) into v_rowlevel_armed
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('dashboard_export_rows','dashboard_free_text','dashboard_completion_by_member')
    and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'can_read_quality_dashboards';
  if v_rowlevel_armed <> 0 then
    raise exception 'M5 postcondition: a ROW-LEVEL dashboard door acquired the reviewer arm (D11 violation)';
  end if;

  select count(*) into v_kept
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'dashboard\_%'
    and p.prosecdef
    and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'app\.is_staff_admin_of'
    and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'app\.is_commission_admin_of';
  if v_kept <> 9 then
    raise exception 'M5 postcondition: an existing admin arm or prosecdef was lost (% of 9)', v_kept;
  end if;
end $$;
