-- pgTAP — F-cleanup · D8 (forward-compat FK locks) + D10 (updated_at touch triggers).
-- Migrations: 20260719000200_updated_at_touch_triggers.sql (D10); D8 has no
-- structural migration — this is a regression lock on the Phase-15 indicator FKs
-- + a guard that capa_plan.source_audit_finding_id stays intentionally FK-less
-- (its FK lands at Phase 18, when public.audit_findings exists).
--
-- Assertion count: 11

begin;
select plan(11);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- ===========================================================================
-- D8 — forward-compat UUID columns: FK where the target exists; intentional
-- FK-less where the target's phase has not landed.
-- ===========================================================================

-- 1) capa_plan.source_indicator_id has its Phase-15 FK → indicators.id
select fk_ok('public', 'capa_plan', 'source_indicator_id', 'public', 'indicators', 'id',
  'D8: capa_plan.source_indicator_id FK → indicators.id (Phase 15) still present');

-- 2) capa_measure.indicator_id has its Phase-15 FK → indicators.id
select fk_ok('public', 'capa_measure', 'indicator_id', 'public', 'indicators', 'id',
  'D8: capa_measure.indicator_id FK → indicators.id (Phase 15) still present');

-- 3) capa_plan.source_audit_finding_id is intentionally FK-less (Phase 18 hook —
--    public.audit_findings does not exist yet; add the FK when it does)
select ok(
  not exists (
    select 1 from pg_constraint c
    where c.contype = 'f'
      and c.conrelid = 'public.capa_plan'::regclass
      and (select attname from pg_attribute
           where attrelid = c.conrelid and attnum = c.conkey[1]) = 'source_audit_finding_id'
  ),
  'D8: capa_plan.source_audit_finding_id is intentionally FK-less (add FK at Phase 18)');

-- ===========================================================================
-- D10 — uniform updated_at touch trigger on cases / commissions / forms.
-- ===========================================================================

-- 4) generic touch function exists
select has_function('app', 'touch_updated_at', 'D10: app.touch_updated_at() exists');

-- 5-7) the column exists on all three tables
select has_column('public', 'cases',       'updated_at', 'D10: cases.updated_at exists');
select has_column('public', 'commissions', 'updated_at', 'D10: commissions.updated_at exists');
select has_column('public', 'forms',       'updated_at', 'D10: forms.updated_at exists');

-- 8-10) the BEFORE UPDATE touch trigger exists on all three tables
select has_trigger('public', 'cases',       'touch_cases_updated_at',       'D10: cases touch trigger');
select has_trigger('public', 'commissions', 'touch_commissions_updated_at', 'D10: commissions touch trigger');
select has_trigger('public', 'forms',       'touch_forms_updated_at',       'D10: forms touch trigger');

-- 11) behavioral: the BEFORE UPDATE trigger stamps updated_at = now(). Seed a row
--     with a far-past updated_at on INSERT (the trigger is BEFORE UPDATE only, so it
--     does not fire on insert), then UPDATE and assert updated_at advanced.
do $$
declare
  v_form uuid := gen_random_uuid();
begin
  insert into public.forms (id, commission_id, title, created_by, updated_at)
  select v_form, comm_x, 'Touch Test', sa_x, timestamptz '2000-01-01' from k;

  update public.forms set title = 'Touch Test 2' where id = v_form;

  create temp table touched (updated_at timestamptz) on commit drop;
  insert into touched select updated_at from public.forms where id = v_form;
end;
$$;
select ok(
  (select updated_at from touched) > timestamptz '2001-01-01',
  'D10: BEFORE UPDATE trigger stamps updated_at = now() (advanced from the far-past seed)');

select * from finish();
rollback;
