-- answer-model-v2 invariants (ADR 0045/0046): typed-column derivation (incl. the
-- never-fail-a-save guard), partial-unique dup rejection, submitted-immutability
-- on the three new surfaces (answers new cols / selections via answer_id /
-- response_group_instances), RLS on response_group_instances + the re-keyed
-- selections, default-value publish validation (HC080), clone copies default_value.
-- Self-contained; reuses the shared bootstrap for the RLS personas.

begin;
select plan(18);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

-- A single in_progress response by staff X on the unsectioned form, plus the MC
-- item + a scalar item to hang answers on. Build extra typed items on a fresh
-- draft version so we can exercise number/date/time derivation.
create temp table ids on commit drop as
  select gen_random_uuid() as resp,
         gen_random_uuid() as vnum, gen_random_uuid() as vform,
         gen_random_uuid() as vver, gen_random_uuid() as vsec,
         gen_random_uuid() as it_num, gen_random_uuid() as it_date,
         gen_random_uuid() as it_time, gen_random_uuid() as it_txt,
         gen_random_uuid() as it_mc, gen_random_uuid() as resp2;
grant select on ids to authenticated;

-- Response on the bootstrap unsectioned form (item_mc / u_q1).
insert into public.responses (id, form_version_id, commission_id, created_by, status)
select resp, (c.v->>'ver_u')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x')::uuid, 'in_progress'
from ids, ctx c;

-- =========================================================================
-- Typed-column derivation. value jsonb stays canonical; typed cols derive.
-- =========================================================================
-- A fresh form/version with number/date/time/short_text + a choice item.
insert into public.forms (id, commission_id, title, created_by)
select vform, (c.v->>'comm_x')::uuid, 'Typed form', (c.v->>'sa_x')::uuid from ids, ctx c;
insert into public.form_versions (id, form_id, version_number, status)
select vver, vform, 1, 'draft' from ids;
insert into public.form_sections (id, form_version_id, position, is_default)
select vsec, vver, 0, true from ids;
insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
select it_num, vsec, 0, 'number', 'q_num', 'Num', false from ids;
insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
select it_date, vsec, 1, 'date', 'q_date', 'Date', false from ids;
insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
select it_time, vsec, 2, 'time', 'q_time', 'Time', false from ids;
insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
select it_txt, vsec, 3, 'short_text', 'q_txt', 'Txt', false from ids;
insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
select it_mc, vsec, 4, 'multiple_choice', 'q_mc', 'MC', false from ids;
insert into public.form_item_options (item_id, position, code, label)
select it_mc, 0, 'a', 'A' from ids;
select public.publish_form_version((select vver from ids));

insert into public.responses (id, form_version_id, commission_id, created_by, status)
select resp2, vver, (c.v->>'comm_x')::uuid, (c.v->>'st_x')::uuid, 'in_progress' from ids, ctx c;

insert into public.answers (response_id, item_id, question_key, value)
select resp2, it_num, 'q_num', to_jsonb(12.5) from ids;
insert into public.answers (response_id, item_id, question_key, value)
select resp2, it_date, 'q_date', to_jsonb('2026-03-01'::text) from ids;
insert into public.answers (response_id, item_id, question_key, value)
select resp2, it_time, 'q_time', to_jsonb('14:45'::text) from ids;
insert into public.answers (response_id, item_id, question_key, value)
select resp2, it_txt, 'q_txt', to_jsonb('livre'::text) from ids;

select is(
  (select value_number from public.answers where response_id=(select resp2 from ids) and item_id=(select it_num from ids)),
  12.5::numeric,
  'number item derives value_number'
);
select is(
  (select value_date from public.answers where response_id=(select resp2 from ids) and item_id=(select it_date from ids)),
  '2026-03-01'::date,
  'date item derives value_date'
);
select is(
  (select value_time from public.answers where response_id=(select resp2 from ids) and item_id=(select it_time from ids)),
  '14:45'::time,
  'time item derives value_time'
);
-- short_text: all typed columns NULL (text is not aggregated).
select ok(
  (select value_number is null and value_date is null and value_time is null
   from public.answers where response_id=(select resp2 from ids) and item_id=(select it_txt from ids)),
  'short_text item leaves all typed columns NULL'
);

-- GUARDRAIL #1: a MALFORMED date string must NOT fail the save — value persists,
-- value_date stays NULL.
insert into public.answers (response_id, item_id, question_key, value)
select resp2, (select it_date from ids), 'q_date', to_jsonb('not-a-date'::text) from ids
on conflict (response_id, item_id) where group_instance_id is null
do update set value = excluded.value;
select is(
  (select value from public.answers where response_id=(select resp2 from ids) and item_id=(select it_date from ids)),
  to_jsonb('not-a-date'::text),
  'malformed date: value jsonb still persists (canonical, never lost)'
);
select ok(
  (select value_date is null from public.answers where response_id=(select resp2 from ids) and item_id=(select it_date from ids)),
  'malformed date: value_date derives NULL instead of raising'
);

-- =========================================================================
-- Partial-unique: a duplicate top-level answer (same response,item, null
-- instance) is rejected; the FIRST row is fine.
-- =========================================================================
select lives_ok($$
  insert into public.answers (response_id, item_id, question_key, value)
  select resp, (c.v->>'item_mc')::uuid, 'u_q1', null from ids, ctx c
$$, 'first top-level answer for (response,item) inserts');
select throws_ok($$
  insert into public.answers (response_id, item_id, question_key, value)
  select resp, (c.v->>'item_mc')::uuid, 'u_q1', null from ids, ctx c
$$, '23505', null, 'duplicate top-level answer for (response,item) is rejected');

-- =========================================================================
-- Selection re-key: a selection hangs off the answer_id; reject_invalid_selection
-- still resolves the item via answer_id (wrong-item option rejected).
-- =========================================================================
-- Give the MC answer a valid selection.
select lives_ok($$
  insert into public.answer_selected_options (answer_id, option_id)
  select a.id, o.id
  from public.answers a, ids, ctx c,
       public.form_item_options o
  where a.response_id = (select resp from ids)
    and a.item_id = (c.v->>'item_mc')::uuid
    and o.item_id = (c.v->>'item_mc')::uuid and o.code = 'sim'
$$, 'valid selection inserts by answer_id');

-- An option belonging to a DIFFERENT item must be rejected (defence via answer_id).
select throws_ok($$
  insert into public.answer_selected_options (answer_id, option_id)
  select a.id, o.id
  from public.answers a, ids,
       public.form_item_options o
  where a.response_id = (select resp2 from ids)
    and a.item_id = (select it_num from ids)   -- number item has no options
    and o.item_id = (select it_mc from ids) and o.code = 'a'
$$, '23514', null, 'answer_selected_options for the wrong item is rejected');

-- =========================================================================
-- Submitted-immutability (GUARDRAIL #3) on the three surfaces. Flip resp to
-- submitted, then attempt child writes with in_submit_rpc OFF.
-- =========================================================================
select set_config('app.in_submit_rpc','on', true);
update public.responses set status='submitted', submitted_at=now() where id=(select resp from ids);
select set_config('app.in_submit_rpc','off', true);

-- answers (new columns ride the whole-row guard): UPDATE blocked.
select throws_ok($$
  update public.answers set answered_at = now()
  where response_id = (select resp from ids)
$$, '23514', null, 'submitted: UPDATE on answers (new col) blocked');

-- answer_selected_options via answer_id -> answers: DELETE blocked.
select throws_ok($$
  delete from public.answer_selected_options s
  using public.answers a
  where s.answer_id = a.id and a.response_id = (select resp from ids)
$$, '23514', null, 'submitted: DELETE on selection (via answer_id) blocked');

-- response_group_instances: INSERT blocked on a submitted response.
select throws_ok($$
  insert into public.response_group_instances (response_id, group_item_id, position)
  select (select resp from ids), (c.v->>'item_mc')::uuid, 0 from ctx c
$$, '23514', null, 'submitted: INSERT on response_group_instances blocked');

-- =========================================================================
-- RLS on response_group_instances: non-creator staff cannot read a creator's
-- in_progress instance row. Insert a row on resp2 (still in_progress) as postgres,
-- then read as staff X2 (a member, not the creator).
-- =========================================================================
insert into public.response_group_instances (id, response_id, group_item_id, position)
select gen_random_uuid(), (select resp2 from ids), (select it_mc from ids), 0;

select test_helpers.claims_for((select (v->>'st_x2')::uuid from ctx), false);
set local role authenticated;
select is(
  (select count(*)::int from public.response_group_instances
   where response_id = (select resp2 from ids)),
  0,
  'RLS: non-creator member cannot read another member''s in_progress group instance'
);
reset role;
select set_config('request.jwt.claims', null, true);

-- The creator CAN read their own instance row.
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select is(
  (select count(*)::int from public.response_group_instances
   where response_id = (select resp2 from ids)),
  1,
  'RLS: creator reads their own in_progress group instance'
);
reset role;
select set_config('request.jwt.claims', null, true);

-- =========================================================================
-- default_value publish validation (HC080) + clone copies default_value.
-- =========================================================================
-- A new draft with a BAD choice default (code that does not exist) must fail publish.
create temp table dvi on commit drop as
  select gen_random_uuid() as f, gen_random_uuid() as v, gen_random_uuid() as s,
         gen_random_uuid() as it;
insert into public.forms (id, commission_id, title, created_by)
select f, (c.v->>'comm_x')::uuid, 'DV form', (c.v->>'sa_x')::uuid from dvi, ctx c;
insert into public.form_versions (id, form_id, version_number, status) select v, f, 1, 'draft' from dvi;
insert into public.form_sections (id, form_version_id, position, is_default) select s, v, 0, true from dvi;
insert into public.form_items (id, section_id, position, item_type, question_key, label, required, default_value)
select it, s, 0, 'multiple_choice', 'dv_q', 'DV', false, to_jsonb('ghost'::text) from dvi;
insert into public.form_item_options (item_id, position, code, label) select it, 0, 'real', 'Real' from dvi;

select throws_ok(
  format($$select public.publish_form_version(%L)$$, (select v from dvi)),
  'HC080', null,
  'publish rejects a choice default_value whose code does not exist (HC080)'
);

-- Fix the default to a real code -> publish succeeds; clone copies default_value.
update public.form_items set default_value = to_jsonb('real'::text) where id = (select it from dvi);
select lives_ok(
  format($$select public.publish_form_version(%L)$$, (select v from dvi)),
  'publish accepts a valid choice default_value'
);

-- Clone first (its own statement so it runs before the assertion), then check the
-- new draft carries the copied default_value.
select public.clone_form_version((select v from dvi));

select is(
  (select default_value
   from public.form_items i
   join public.form_versions fv on fv.id = i.form_version_id
   where fv.form_id = (select f from dvi) and fv.status = 'draft'
     and i.question_key = 'dv_q'),
  to_jsonb('real'::text),
  'clone_form_version copies default_value verbatim'
);

select * from finish();
rollback;
