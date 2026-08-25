-- Phase 15 — Quality Indicators (migrations 20260712000000–…000300).
-- Builds a dashboard-style form in commission X (mc + checkbox + a numeric item),
-- seeds submitted standalone responses with KNOWN answers, then asserts:
--   * derived compute == dashboard_distributions (the PARITY LOCK), for a
--     percentual (question_key denominator), a 'respondentes' denominator, and a
--     contagem; tempo_medio == avg(value_number);
--   * hybrid taxa one-step + preserve-on-recompute + HC088;
--   * an unknown option code is rejected at SAVE (HC084);
--   * off-target classification across BOTH directions;
--   * indicator_kpis counts;
--   * RLS scoping (foreign-commission read = none; staff cannot write);
--   * hospital_indicator_rollup scope + PHI-free SELECT list;
--   * the two new CAPA FKs resolve;
--   * the two-tier CAPA hook (operator opens; commission member reads; non-operator
--     42501).
--
-- Definer/RPC calls read auth.uid() via request.jwt.claims; assertions reset to
-- superuser to read freely.

begin;
select plan(26);

-- The indicators + CAPA features must be enabled for their RPCs (assert_*).
update app.feature_flags set enabled = true where key in ('quality_indicators', 'patient_safety');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'st_x2')::uuid   as st_x2,
         (v->>'sa_y')::uuid    as sa_y,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'comm_y')::uuid  as comm_y,
         (v->>'org_b')::uuid   as org_id,
         (v->>'hosp_b')::uuid  as hosp_id
  from ctx;
grant select on k to authenticated;

-- ---------------------------------------------------------------------------
-- Build the form: flat section with mc (d_mc) + checkbox (d_cb) + a number item
-- (d_num), plus a conditional section (d_cond, gated on d_mc='sim').
-- ---------------------------------------------------------------------------
create temp table ids on commit drop as
  select gen_random_uuid() as form_d, gen_random_uuid() as ver_d,
         gen_random_uuid() as sec_flat, gen_random_uuid() as sec_cond,
         gen_random_uuid() as it_mc, gen_random_uuid() as it_cb,
         gen_random_uuid() as it_num, gen_random_uuid() as it_cond;
grant select on ids to authenticated;

insert into public.forms (id, commission_id, title, created_by)
select i.form_d, k.comm_x, 'Indicadores Form', k.sa_x from ids i, k;
insert into public.form_versions (id, form_id, version_number, status)
select i.ver_d, i.form_d, 1, 'draft' from ids i;
insert into public.form_sections (id, form_version_id, position, is_default)
select i.sec_flat, i.ver_d, 0, true from ids i;

insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
select i.it_mc, i.sec_flat, 0, 'multiple_choice', 'd_mc', 'MC?', true from ids i;
insert into public.form_item_options (item_id, position, code, label)
select i.it_mc, 0, 'sim', 'Sim' from ids i
union all select i.it_mc, 1, 'nao', 'Não' from ids i;

insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
select i.it_cb, i.sec_flat, 1, 'checkbox', 'd_cb', 'CB?', false from ids i;
insert into public.form_item_options (item_id, position, code, label)
select i.it_cb, 0, 'a', 'A' from ids i
union all select i.it_cb, 1, 'b', 'B' from ids i
union all select i.it_cb, 2, 'c', 'C' from ids i;

insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
select i.it_num, i.sec_flat, 2, 'number', 'd_num', 'Tempo?', false from ids i;

insert into public.form_sections (id, form_version_id, position, title, visible_when)
select i.sec_cond, i.ver_d, 1, 'Conditional',
       jsonb_build_object('question_key','d_mc','op','equals','value','sim')
from ids i;
insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
select i.it_cond, i.sec_cond, 0, 'multiple_choice', 'd_cond', 'Cond?', true from ids i;
insert into public.form_item_options (item_id, position, code, label)
select i.it_cond, 0, 'x', 'X' from ids i
union all select i.it_cond, 1, 'y', 'Y' from ids i;

select public.publish_form_version((select ver_d from ids));

-- ---------------------------------------------------------------------------
-- Seed 4 submitted standalone responses (KNOWN answers):
--   r1: d_mc=sim, d_cb=[a,b], d_num=10, d_cond=x
--   r2: d_mc=sim, d_cb=[a],   d_num=20, d_cond=y
--   r3: d_mc=nao, d_cb=[b,c], d_num=30
--   r4: d_mc=nao, d_cb=[c],   d_num=40
-- => d_mc: sim 2 / nao 2 (section-denom 4); avg(d_num)=25.
-- ---------------------------------------------------------------------------
select set_config('app.in_submit_rpc', 'on', true);
create temp table rs on commit drop as
  select gen_random_uuid() as r1, gen_random_uuid() as r2,
         gen_random_uuid() as r3, gen_random_uuid() as r4;
grant select on rs to authenticated;

insert into public.responses (id, form_version_id, commission_id, created_by, status, submitted_at)
select rs.r1, i.ver_d, k.comm_x, k.st_x,  'submitted', now() - interval '1 day'  from rs, ids i, k
union all select rs.r2, i.ver_d, k.comm_x, k.st_x2, 'submitted', now() - interval '2 days' from rs, ids i, k
union all select rs.r3, i.ver_d, k.comm_x, k.st_x,  'submitted', now() - interval '3 days' from rs, ids i, k
union all select rs.r4, i.ver_d, k.comm_x, k.st_x2, 'submitted', now() - interval '4 days' from rs, ids i, k;

-- Choice selections (parent answer per (response,item) + selections by code).
create temp table _sel on commit drop as
  select t.rid, t.iid, t.code from (
    select rs.r1 as rid, i.it_mc as iid, 'sim'::text as code from rs, ids i
    union all select rs.r1, i.it_cb, 'a' from rs, ids i
    union all select rs.r1, i.it_cb, 'b' from rs, ids i
    union all select rs.r1, i.it_cond, 'x' from rs, ids i
    union all select rs.r2, i.it_mc, 'sim' from rs, ids i
    union all select rs.r2, i.it_cb, 'a' from rs, ids i
    union all select rs.r2, i.it_cond, 'y' from rs, ids i
    union all select rs.r3, i.it_mc, 'nao' from rs, ids i
    union all select rs.r3, i.it_cb, 'b' from rs, ids i
    union all select rs.r3, i.it_cb, 'c' from rs, ids i
    union all select rs.r4, i.it_mc, 'nao' from rs, ids i
    union all select rs.r4, i.it_cb, 'c' from rs, ids i
  ) t;
insert into public.answers (response_id, item_id, question_key, value, group_instance_id)
select distinct d.rid, d.iid, fi.question_key, null::jsonb, null::uuid
from _sel d join public.form_items fi on fi.id = d.iid
on conflict (response_id, item_id) where group_instance_id is null do nothing;
insert into public.answer_selected_options (answer_id, option_id)
select a.id, o.id from _sel t
join public.answers a on a.response_id = t.rid and a.item_id = t.iid and a.group_instance_id is null
join public.form_item_options o on o.item_id = t.iid and o.code = t.code;

-- Numeric answers (value_number is derived by the sync trigger from value).
insert into public.answers (response_id, item_id, question_key, value, group_instance_id)
select rs.r1, i.it_num, 'd_num', to_jsonb(10), null::uuid from rs, ids i
union all select rs.r2, i.it_num, 'd_num', to_jsonb(20), null::uuid from rs, ids i
union all select rs.r3, i.it_num, 'd_num', to_jsonb(30), null::uuid from rs, ids i
union all select rs.r4, i.it_num, 'd_num', to_jsonb(40), null::uuid from rs, ids i;
select set_config('app.in_submit_rpc', 'off', true);

-- ===========================================================================
-- Create the indicators (as staff_admin of X).
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

-- derived percentual: sim / (section-answered denom).
create temp table _pct on commit drop as
  select (public.create_indicator(
    p_commission => (select comm_x from k), p_name => 'Pct sim',
    p_kind => 'percentual', p_data_source => 'derivado', p_target_value => 40,
    p_derived_config => jsonb_build_object('form_id', (select form_d from ids)::text,
      'numerator', jsonb_build_object('question_key','d_mc','option_codes', jsonb_build_array('sim')),
      'denominator', jsonb_build_object('question_key','d_mc')))).id as id;
grant select on _pct to authenticated;

reset role;
-- ---- 1) PARITY LOCK: derived numerator + denominator == dashboard ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.compute_derived_measurement((select id from _pct), '2026-06');

select is(
  (select numerator::int from public.indicator_measurements where indicator_id = (select id from _pct)),
  (select option_count::int from public.dashboard_distributions((select form_d from ids), null, null)
    where question_key='d_mc' and option_code='sim'),
  'PARITY: derived numerator == dashboard option_count(sim)'
);
select is(
  (select denominator::int from public.indicator_measurements where indicator_id = (select id from _pct)),
  (select denominator::int from public.dashboard_distributions((select form_d from ids), null, null)
    where question_key='d_mc' and option_code='sim'),
  'PARITY: derived denominator == dashboard denom(d_mc)'
);
-- ⛔ This `reset role` MUST stay BELOW the two PARITY assertions. It sat above them until
-- 2026-08-24, where it was harmless ONLY because `claims_for` writes request.jwt.claims with
-- is_local => true, so the claims outlive `reset role` and auth.uid() kept returning sa_x.
-- `public.dashboard_distributions` is SECURITY DEFINER and returns 0 rows for an actor that
-- is not staff_admin of the commission, so a genuine owner-context read compares two empty
-- sets and passes for the wrong reason. (FUP-RESET-ROLE-DOES-NOT-CLEAR-JWT-CLAIMS)
reset role;
select is(
  (select value from public.indicator_measurements where indicator_id = (select id from _pct)),
  50.0000::numeric,
  'PARITY: percentual value = 2/4*100 = 50'
);

-- ---- 2) respondentes denominator = total submitted (4) ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table _resp on commit drop as
  select (public.create_indicator(
    p_commission => (select comm_x from k), p_name => 'Pct resp',
    p_kind => 'percentual', p_data_source => 'derivado', p_target_value => 40,
    p_derived_config => jsonb_build_object('form_id', (select form_d from ids)::text,
      'numerator', jsonb_build_object('question_key','d_mc','option_codes', jsonb_build_array('sim')),
      'denominator', 'respondentes'))).id as id;
grant select on _resp to authenticated;
select public.compute_derived_measurement((select id from _resp), '2026-06');
reset role;
select is(
  (select denominator::int from public.indicator_measurements where indicator_id = (select id from _resp)),
  4, 'respondentes denominator = 4 submitted responses'
);

-- ---- 3) contagem = raw numerator (2) ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table _cnt on commit drop as
  select (public.create_indicator(
    p_commission => (select comm_x from k), p_name => 'Contagem sim',
    p_kind => 'contagem', p_data_source => 'derivado', p_target_value => 1,
    p_derived_config => jsonb_build_object('form_id', (select form_d from ids)::text,
      'numerator', jsonb_build_object('question_key','d_mc','option_codes', jsonb_build_array('sim')),
      'denominator', 'respondentes'))).id as id;
grant select on _cnt to authenticated;
select public.compute_derived_measurement((select id from _cnt), '2026-06');
reset role;
select is(
  (select value::int from public.indicator_measurements where indicator_id = (select id from _cnt)),
  2, 'contagem value = raw numerator (2)'
);

-- ---- 4) tempo_medio = avg(value_number) = 25 ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table _tm on commit drop as
  select (public.create_indicator(
    p_commission => (select comm_x from k), p_name => 'Tempo medio',
    p_kind => 'tempo_medio', p_data_source => 'derivado', p_target_value => 30,
    p_direction => 'menor_melhor', p_target_comparator => '<=',
    p_derived_config => jsonb_build_object('form_id', (select form_d from ids)::text,
      'value', jsonb_build_object('question_key','d_num')))).id as id;
grant select on _tm to authenticated;
select public.compute_derived_measurement((select id from _tm), '2026-06');
reset role;
select is(
  (select value from public.indicator_measurements where indicator_id = (select id from _tm)),
  25::numeric, 'tempo_medio value = avg(10,20,30,40) = 25'
);
select is(
  (select status from public.indicator_measurements where indicator_id = (select id from _tm)),
  'on_target', 'tempo_medio 25 <= 30 (menor_melhor) => na_meta'
);

-- ---- 5) hybrid taxa: one-step + preserve-on-recompute + HC088 ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table _hy on commit drop as
  select (public.create_indicator(
    p_commission => (select comm_x from k), p_name => 'Taxa hibrida',
    p_kind => 'taxa', p_data_source => 'hibrido', p_target_value => 600,
    p_direction => 'menor_melhor', p_target_comparator => '<=',
    p_derived_config => jsonb_build_object('form_id', (select form_d from ids)::text,
      'numerator', jsonb_build_object('question_key','d_mc','option_codes', jsonb_build_array('sim'))))).id as id;
grant select on _hy to authenticated;
select public.compute_derived_measurement((select id from _hy), '2026-06', 1000);  -- 2/1000*1000 = 2
reset role;
select is(
  (select denominator::int from public.indicator_measurements where indicator_id = (select id from _hy)),
  1000, 'hybrid one-step: denominator stored = 1000'
);
-- recompute WITHOUT denominator -> preserve 1000
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.compute_derived_measurement((select id from _hy), '2026-06');
reset role;
select is(
  (select denominator::int from public.indicator_measurements where indicator_id = (select id from _hy)),
  1000, 'hybrid recompute (no denom) PRESERVES the stored denominator'
);
-- HC088 for a fresh period with no denom + none stored
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.compute_derived_measurement(%L, '2099-01') $$, (select id from _hy)),
  'HC088', null, 'hybrid compute with no denominator (and none stored) raises HC088'
);
reset role;

-- ---- 6) HC084: unknown option code rejected at SAVE ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_indicator(
    p_commission => %L, p_name => 'bad', p_kind => 'percentual', p_data_source => 'derivado',
    p_derived_config => %L) $$,
    (select comm_x from k),
    jsonb_build_object('form_id', (select form_d from ids)::text,
      'numerator', jsonb_build_object('question_key','d_mc','option_codes', jsonb_build_array('inexistente')),
      'denominator', 'respondentes')::text),
  'HC084', null, 'unknown option code rejected at save (HC084)'
);
reset role;

-- ---- 7) off-target across BOTH directions ----
-- maior_melhor / >= (pct sim = 50 >= 40 => na_meta)
select is(
  (select status from public.indicator_measurements where indicator_id = (select id from _pct)),
  'on_target', 'maior_melhor >=: 50 >= 40 => na_meta'
);
-- menor_melhor / <= manual: a value ABOVE target => fora_da_meta
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table _mm on commit drop as
  select (public.create_indicator(
    p_commission => (select comm_x from k), p_name => 'Menor manual',
    p_kind => 'taxa', p_data_source => 'manual',
    p_direction => 'menor_melhor', p_target_comparator => '<=', p_target_value => 2)).id as id;
grant select on _mm to authenticated;
select public.record_indicator_measurement((select id from _mm), '2026-06', 3, 1000);  -- 3.0 > 2 => fora
reset role;
select is(
  (select status from public.indicator_measurements where indicator_id = (select id from _mm)),
  'off_target', 'menor_melhor <=: 3.0 > 2 => fora_da_meta'
);

-- ---- 8) indicator_kpis counts (act as staff_admin) ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select total::int from public.indicator_kpis((select comm_x from k))),
  6, 'indicator_kpis total = 6 active indicators'
);
reset role;

-- ---- 9) RLS: foreign-commission user reads nothing; staff cannot write ----
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.indicators),
  0, 'a foreign-commission user (Y) reads NO commission-X indicators'
);
reset role;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_indicator(p_commission => %L, p_name => 'nope', p_kind => 'contagem') $$,
    (select comm_x from k)),
  '42501', null, 'a plain staff member cannot create an indicator (42501)'
);
-- posture (b): a direct INSERT by an authenticated staff is denied (no grant).
select throws_ok(
  format($$ insert into public.indicators (commission_id, name, kind, data_source)
            values (%L, 'raw', 'contagem', 'manual') $$, (select comm_x from k)),
  '42501', null, 'posture (b): direct authenticated INSERT into indicators denied'
);
reset role;

-- ---- 10) hospital_indicator_rollup: scope + PHI-free SELECT list ----
-- Grant a hospital_admin of comm_x's hospital (org_b/hosp_b in the fixture).
insert into public.memberships (organization_id, principal_id, role, hospital_id)
select (select org_id from k), (select st_x2 from k), 'hospital_admin', (select hosp_id from k)
on conflict (principal_id, role, organization_id, hospital_id, commission_id) do nothing;

select test_helpers.claims_for((select st_x2 from k), false, 'hospital_admin');
set local role authenticated;
select ok(
  (select total from public.hospital_indicator_rollup((select hosp_id from k))
    where commission_id = (select comm_x from k)) >= 6,
  'hospital_admin rollup sees comm_x indicator counts (>= 6)'
);
reset role;
-- PHI-free / minimum-necessary: the rollup RETURNS TABLE columns are exactly the
-- counts + commission id/name (no indicator name/value/description). A set-returning
-- function's OUT columns live in pg_proc.proargnames (with proargmodes), NOT
-- information_schema.columns. Extract the TABLE (mode 't') OUT names by ordinal.
select set_eq(
  $$ select name from (
       select unnest(p.proargnames) as name, unnest(p.proargmodes) as mode
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname='public' and p.proname='hospital_indicator_rollup'
     ) q where mode = 't' $$,
  $$ values ('commission_id'),('commission_name'),('total'),
            ('on_target'),('off_target'),('no_data') $$,
  'hospital_indicator_rollup exposes ONLY counts + commission id/name (PHI-free, minimum-necessary)'
);

-- foreign hospital_admin (a NEW hospital in a new org) sees nothing.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.hospital_indicator_rollup((select hosp_id from k))),
  0, 'a non-admin of the hospital gets an empty rollup'
);
reset role;

-- ---- 11) the two new CAPA FKs resolve to public.indicators ----
select is(
  (select confrelid::regclass::text from pg_constraint where conname = 'capa_plan_source_indicator_id_fkey'),
  'indicators', 'capa_plan.source_indicator_id FK resolves to public.indicators'
);
select is(
  (select confrelid::regclass::text from pg_constraint where conname = 'capa_measure_indicator_id_fkey'),
  'indicators', 'capa_measure.indicator_id FK resolves to public.indicators'
);

-- ---- 12) two-tier CAPA hook ----
-- Enroll st_x as a PQS operator of comm_x's hospital so they can open the CAPA.
insert into public.memberships (organization_id, hospital_id, principal_id, role)
select (select organization_id from public.hospitals where id = (select hosp_id from k)),
       (select hosp_id from k), (select st_x from k), 'pqs_member'
on conflict (principal_id, role, organization_id, hospital_id, commission_id) do nothing;

-- non-operator staff_admin -> 42501
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.open_capa_plan('indicator','corretiva', %L) $$, (select id from _pct)),
  '42501', null, 'a non-PQS-operator cannot open a CAPA from an indicator (42501)'
);
reset role;

-- PQS operator opens it; hospital_id derived from the indicator's commission.
select test_helpers.claims_for((select st_x from k), false, 'pqs_member');
set local role authenticated;
create temp table _capa on commit drop as
  select (public.open_capa_plan('indicator','corretiva', (select id from _pct))).id as id;
grant select on _capa to authenticated;
reset role;
select is(
  (select hospital_id from public.capa_plan where id = (select id from _capa)),
  (select hosp_id from k),
  'open_capa_plan(indicator) derives hospital_id from the indicator commission'
);
-- a plain commission MEMBER reads it via the indicator arm; a foreign user cannot.
select ok(
  app.can_read_capa((select id from _capa), (select st_x2 from k)),
  'indicator commission member can_read_capa (indicator arm) = true'
);
select ok(
  not app.can_read_capa((select id from _capa), (select sa_y from k)),
  'a foreign-commission user cannot read the indicator CAPA'
);

select * from finish();
rollback;
