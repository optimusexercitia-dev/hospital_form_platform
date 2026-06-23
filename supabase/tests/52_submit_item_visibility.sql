-- Form Builder Enhancements — submit_response per-ITEM visibility forward pass
-- + number/date min/max enforcement (HC061), and clone_form_version copying
-- visible_when/config (BE-4).

begin;
select plan(7);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;

-- Build + publish a form in commission X with a SINGLE section containing:
--   gate (choice, pos 0), detail (free_text conditional on gate=Sim, pos 1),
--   count (number with min=1/max=10, pos 2).
create temp table d on commit drop as
  select gen_random_uuid() as form_id, gen_random_uuid() as ver_id,
         gen_random_uuid() as s0,
         gen_random_uuid() as i_gate, gen_random_uuid() as i_detail,
         gen_random_uuid() as i_count;

-- Build as superuser; publish with the staff_admin's claims (publish is invoker).
insert into public.forms (id, commission_id, title, created_by)
select form_id, (c.v->>'comm_x')::uuid, 'Form IV-submit', (c.v->>'sa_x')::uuid from d, ctx c;
insert into public.form_versions (id, form_id, version_number, status)
select ver_id, form_id, 1, 'draft' from d;
insert into public.form_sections (id, form_version_id, position, is_default)
select s0, ver_id, 0, true from d;

insert into public.form_items (id, section_id, position, item_type, question_key, label, options, required)
select i_gate, s0, 0, 'multiple_choice', 'iv_gate', 'Gate?', '["Sim","Não"]'::jsonb, true from d;
-- Conditional item (visible only when iv_gate = Sim); cannot be required.
insert into public.form_items (id, section_id, position, item_type, question_key, label, required, visible_when)
select i_detail, s0, 1, 'free_text', 'iv_detail', 'Detalhe', false,
       jsonb_build_object('question_key','iv_gate','op','equals','value','Sim')
from d;
-- Number with bounds 1..10.
insert into public.form_items (id, section_id, position, item_type, question_key, label, required, config)
select i_count, s0, 2, 'number', 'iv_count', 'Quantos?', false,
       jsonb_build_object('min', 1, 'max', 10)
from d;

-- act_as reads these fixture temp tables while role = authenticated; grant up
-- front (before the first authenticated block builds its SQL from them).
create temp table r on commit drop as select gen_random_uuid() as id;
grant select on ctx, d, r to authenticated;

select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;
select lives_ok(
  format($$ select public.publish_form_version(%L) $$, (select ver_id from d)),
  'form with a conditional item + bounded number publishes'
);
reset role;

-- ---- A response owned by staff X. ----
insert into public.responses (id, form_version_id, commission_id, created_by, status)
select r.id, (select ver_id from d), (c.v->>'comm_x')::uuid, (c.v->>'st_x')::uuid, 'in_progress'
from r, ctx c;

-- Gate=Não (hides iv_detail), but a STRAY iv_detail answer was saved earlier;
-- count within bounds.
insert into public.answers (response_id, item_id, question_key, value)
select (select id from r), (select i_gate from d), 'iv_gate', '"Não"'::jsonb;
insert into public.answers (response_id, item_id, question_key, value)
select (select id from r), (select i_detail from d), 'iv_detail', '"stray detail"'::jsonb;
insert into public.answers (response_id, item_id, question_key, value)
select (select id from r), (select i_count from d), 'iv_count', '5'::jsonb;

select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select lives_ok(
  format($$ select public.submit_response(%L) $$, (select id from r)),
  'submit succeeds: hidden item answer is stray-cleared, number within bounds'
);
reset role;

-- The hidden item's stray answer was cleared by the per-item forward pass.
select is(
  (select count(*)::int from public.answers
     where response_id = (select id from r) and question_key = 'iv_detail'),
  0,
  'hidden conditional item answer is cleared on submit'
);

-- Gate + count survive.
select is(
  (select count(*)::int from public.answers
     where response_id = (select id from r) and question_key in ('iv_gate','iv_count')),
  2,
  'visible item answers (gate + count) are preserved'
);

-- ---- A second response: number BELOW min must block submit with HC061. ----
create temp table r2 on commit drop as select gen_random_uuid() as id;
grant select on r2 to authenticated;
insert into public.responses (id, form_version_id, commission_id, created_by, status)
select r2.id, (select ver_id from d), (c.v->>'comm_x')::uuid, (c.v->>'st_x2')::uuid, 'in_progress'
from r2, ctx c;
insert into public.answers (response_id, item_id, question_key, value)
select (select id from r2), (select i_gate from d), 'iv_gate', '"Não"'::jsonb;
insert into public.answers (response_id, item_id, question_key, value)
select (select id from r2), (select i_count from d), 'iv_count', '0'::jsonb;  -- below min=1

select test_helpers.claims_for((select (v->>'st_x2')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$ select public.submit_response(%L) $$, (select id from r2)),
  'HC061',
  null,
  'submit rejects a number below its config min (HC061)'
);
reset role;

-- ---- A third response: number ABOVE max blocks submit too. ----
update public.answers set value = '11'::jsonb
  where response_id = (select id from r2) and question_key = 'iv_count';  -- above max=10

select test_helpers.claims_for((select (v->>'st_x2')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$ select public.submit_response(%L) $$, (select id from r2)),
  'HC061',
  null,
  'submit rejects a number above its config max (HC061)'
);
reset role;

-- ---- clone_form_version copies visible_when + config. ----
select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;
create temp table cl on commit drop as
  select public.clone_form_version((select ver_id from d)) as new_ver;
reset role;
grant select on cl to authenticated;

select is(
  (select count(*)::int
     from public.form_items i
     join public.form_sections s on s.id = i.section_id
    where s.form_version_id = (select new_ver from cl)
      and ((i.question_key = 'iv_detail' and i.visible_when is not null)
        or (i.question_key = 'iv_count' and i.config ->> 'max' = '10'))),
  2,
  'clone copies visible_when (conditional item) and config (bounded number)'
);

select * from finish();
rollback;
