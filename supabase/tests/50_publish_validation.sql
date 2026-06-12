-- Publish-time visible_when validation: a condition that references a later /
-- nonexistent question, or sits on the first section, blocks publishing.

begin;
select plan(4);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;

-- Build a fresh draft (form in commission X) with a forward reference and try
-- to publish it.
create temp table d on commit drop as
  select gen_random_uuid() as form_id, gen_random_uuid() as ver_id,
         gen_random_uuid() as s0, gen_random_uuid() as s1, gen_random_uuid() as s2,
         gen_random_uuid() as i_later;

insert into public.forms (id, commission_id, title, created_by)
select form_id, (c.v->>'comm_x')::uuid, 'Draft FV', (c.v->>'sa_x')::uuid from d, ctx c;
insert into public.form_versions (id, form_id, version_number, status)
select ver_id, form_id, 1, 'draft' from d;
insert into public.form_sections (id, form_version_id, position, is_default)
select s0, ver_id, 0, true from d;

-- Section 1 references a key defined only in section 2 (forward reference).
insert into public.form_sections (id, form_version_id, position, title, visible_when)
select s1, ver_id, 1, 'Early',
       jsonb_build_object('question_key','later_key','op','equals','value','Sim')
from d;
insert into public.form_sections (id, form_version_id, position, title)
select s2, ver_id, 2, 'Late' from d;
insert into public.form_items (id, section_id, position, item_type, question_key, label, options, required)
select i_later, s2, 0, 'multiple_choice', 'later_key', 'Later?', '["Sim","Não"]'::jsonb, true from d;

select throws_ok(
  format($$ select public.validate_visible_when(%L) $$, (select ver_id from d)),
  '23514',
  null,
  'forward reference fails validate_visible_when'
);

select throws_ok(
  format($$ select public.publish_form_version(%L) $$, (select ver_id from d)),
  '23514',
  null,
  'publish is blocked for a forward reference'
);

-- The version is still a draft (publish rolled back its own work via the error).
select is(
  (select status from public.form_versions where id = (select ver_id from d)),
  'draft',
  'version remains draft after a blocked publish'
);

-- Fix the reference to point backwards (a real earlier key) and publish OK.
-- Move the question into section 0's neighbourhood: add an input to section 1
-- is not allowed to be referenced by itself; instead point section 2 at a key
-- in section 1. Reset the bad condition first.
update public.form_sections set visible_when = null where id = (select s1 from d);
update public.form_sections
  set visible_when = jsonb_build_object('question_key','later_key','op','equals','value','Sim')
  where id = (select s2 from d);
-- 'later_key' now lives in section 2 referencing itself -> still invalid. Put
-- the key in section 1 and have section 2 reference it.
update public.form_items set section_id = (select s1 from d), question_key = 'gatekey'
  where id = (select i_later from d);
update public.form_sections
  set visible_when = jsonb_build_object('question_key','gatekey','op','equals','value','Sim')
  where id = (select s2 from d);

select lives_ok(
  format($$ select public.publish_form_version(%L) $$, (select ver_id from d)),
  'publish succeeds once the condition references an earlier section'
);

select * from finish();
rollback;
