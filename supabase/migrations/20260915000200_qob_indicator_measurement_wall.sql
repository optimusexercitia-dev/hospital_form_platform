-- QO·B M3 — org_admin / hospital_admin content wall: indicator MEASUREMENTS.
--
-- ADR 0100 D12; PO ruling Q3 (2026-08-08) is a SPLIT, not a family cut:
--   KEEP (configuration) — public.indicators + indicators_select, create_indicator,
--                          update_indicator, set_indicator_target. Setting up the
--                          indicator scaffolding (numerator/denominator/target/
--                          periodicity) is admin onboarding work.
--   CUT  (content)       — public.indicator_measurements + indicator_measurements_select,
--                          record_indicator_measurement, compute_derived_measurement.
--                          A recorded measurement IS the quality data.
--   UNCHANGED            — the PHI-free aggregates indicator_kpis, indicator_series and
--                          hospital_indicator_rollup stay open to the tenancy admin
--                          (D12 ⑥). They are explicitly NOT touched here.
--
-- MEASURED PRE-IMAGE: indicator_measurements — org_admin 8 · hospital_admin 8 ·
-- staff_admin 8 · staff 8. The staff/staff_admin 8 must SURVIVE (they are members);
-- only the tenancy admins' 8 may go.
--
-- The two doors are large plpgsql bodies with one identical authority block each. They
-- are rewritten with the repo's pg_get_functiondef + replace + execute idiom rather
-- than transcribed by hand: a hand copy of ~340 lines risks silently altering
-- something other than the arm, and the idiom mutates exactly the matched text. Both
-- the match and the result are ASSERTED — a replace that hits nothing raises, so this
-- migration cannot silently no-op (the failure mode that makes a green suite lie).

begin;

-- ---------------------------------------------------------------------------
-- Policy: the measurement row itself.
-- ---------------------------------------------------------------------------
drop policy if exists indicator_measurements_select on public.indicator_measurements;
create policy indicator_measurements_select on public.indicator_measurements
  as permissive for select to authenticated
  using (
    exists (
      select 1 from public.indicators i
      where i.id = indicator_measurements.indicator_id
        and app.is_member_of(i.commission_id)
    )
  );

comment on policy indicator_measurements_select on public.indicator_measurements is
  'QO·B (ADR 0100 D12, PO ruling Q3): tenancy-admin arm deliberately ABSENT. The '
  'indicator DEFINITION stays readable to org_admin/hospital_admin (indicators_select '
  'is intentionally untouched); the recorded MEASUREMENT does not.';

-- ---------------------------------------------------------------------------
-- Doors: strip the tenancy arm from the authority block of both measurement writers.
-- ---------------------------------------------------------------------------
do $$
declare
  r        record;
  v_src    text;
  v_new    text;
  v_hits   int := 0;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('record_indicator_measurement','compute_derived_measurement')
  loop
    v_src := pg_get_functiondef(r.oid);

    -- The arm as it stands, tolerant of whitespace/newlines between the disjuncts.
    v_new := regexp_replace(
      v_src,
      'app\.is_staff_admin_of\(v_ind\.commission_id\)\s*or\s*app\.is_commission_admin_of\(v_ind\.commission_id\)',
      'app.is_staff_admin_of(v_ind.commission_id)',
      'g');

    if v_new = v_src then
      raise exception
        'QO·B M3: the authority-arm replace matched NOTHING in %(). The body is not the '
        'shape this migration was written against — re-read it from pg_get_functiondef '
        'and fix the pattern. Refusing to no-op silently.', r.proname;
    end if;
    v_hits := v_hits + 1;

    execute v_new;
  end loop;

  if v_hits = 0 then
    raise exception 'QO·B M3 VACUOUS: neither measurement door was found in pg_proc';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Postconditions — derived, with a non-vacuity twin, and an explicit KEEP guard so a
-- future over-cut of the DEFINITION side is caught too (the wall is a SPLIT).
-- ---------------------------------------------------------------------------
do $$
declare v_bad text; v_n int;
begin
  -- (a) Neither measurement door may still route the tenancy admin.
  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p
  where p.pronamespace='public'::regnamespace
    and p.proname in ('record_indicator_measurement','compute_derived_measurement')
    and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
        ~ '\yis_commission_admin_of(_for)?\y';
  if v_bad is not null then
    raise exception 'QO·B M3 postcondition (a): measurement door still routes the tenancy admin: %', v_bad;
  end if;

  -- (b) …nor may the measurement policy.
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='indicator_measurements'
      and coalesce(qual,'')||' '||coalesce(with_check,'') ~ '\yis_commission_admin_of\y') then
    raise exception 'QO·B M3 postcondition (b): indicator_measurements policy still carries the arm';
  end if;

  -- (c) NON-VACUITY: both doors must exist, or (a) passes for the wrong reason.
  select count(*) into v_n from pg_proc
   where pronamespace='public'::regnamespace
     and proname in ('record_indicator_measurement','compute_derived_measurement');
  if v_n < 2 then
    raise exception 'QO·B M3 postcondition (c) VACUOUS: expected 2 measurement doors, found %', v_n;
  end if;

  -- (d) KEEP guard — Q3 is a SPLIT. indicators_select must STILL carry the arm; if a
  --     later edit cuts the definition side too, that is an over-cut of a ratified
  --     KEEP and it should red here rather than surface as a support ticket.
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='indicators' and policyname='indicators_select'
      and coalesce(qual,'') ~ '\yis_commission_admin_of\y') then
    raise exception
      'QO·B M3 postcondition (d): indicators_select LOST its tenancy-admin arm. PO ruling '
      'Q3 keeps the indicator DEFINITION readable to org_admin/hospital_admin — only the '
      'MEASUREMENT is cut. Over-cut, not under-cut.';
  end if;
end $$;

commit;
