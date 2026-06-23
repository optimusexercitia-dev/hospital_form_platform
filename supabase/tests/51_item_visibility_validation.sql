-- Form Builder Enhancements — per-ITEM visible_when validation + the
-- conditional-not-required CHECK + operator<->target-type validation, plus the
-- group-aware SECTION validation. These exercise validate_visible_when's item
-- walk and app.assert_condition_op_target (BE-3).

begin;
select plan(11);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;

-- A reusable draft form in commission X.
create temp table d on commit drop as
  select gen_random_uuid() as form_id, gen_random_uuid() as ver_id,
         gen_random_uuid() as s0,
         gen_random_uuid() as i_a, gen_random_uuid() as i_b, gen_random_uuid() as i_num;

insert into public.forms (id, commission_id, title, created_by)
select form_id, (c.v->>'comm_x')::uuid, 'Draft IV', (c.v->>'sa_x')::uuid from d, ctx c;
insert into public.form_versions (id, form_id, version_number, status)
select ver_id, form_id, 1, 'draft' from d;
insert into public.form_sections (id, form_version_id, position, is_default)
select s0, ver_id, 0, true from d;

-- Two choice items + one number item, all in the default section (doc order:
-- i_a @ pos 0, i_b @ pos 1, i_num @ pos 2).
insert into public.form_items (id, section_id, position, item_type, question_key, label, options, required)
select i_a, s0, 0, 'multiple_choice', 'qa', 'A?', '["Sim","Não"]'::jsonb, false from d;
insert into public.form_items (id, section_id, position, item_type, question_key, label, options, required)
select i_b, s0, 1, 'multiple_choice', 'qb', 'B?', '["Sim","Não"]'::jsonb, false from d;
insert into public.form_items (id, section_id, position, item_type, question_key, label)
select i_num, s0, 2, 'number', 'qnum', 'Quantos?' from d;

-- ---- 1) A conditional item that requires=true is rejected by the CHECK at
-- write time (form_items_conditional_not_required). ----
select throws_ok(
  format($$
    update public.form_items
      set visible_when = jsonb_build_object('question_key','qa','op','equals','value','Sim'),
          required = true
    where id = %L $$, (select i_b from d)),
  '23514',
  null,
  'a conditional item cannot be required (CHECK form_items_conditional_not_required)'
);

-- ---- 2) A valid backward item reference (qb depends on the earlier qa) passes
-- validate_visible_when. ----
update public.form_items
  set visible_when = jsonb_build_object('question_key','qa','op','equals','value','Sim'),
      required = false
  where id = (select i_b from d);

select lives_ok(
  format($$ select public.validate_visible_when(%L) $$, (select ver_id from d)),
  'item condition referencing an earlier item in the same section passes'
);

-- ---- 3) Self-reference is rejected (qb depends on qb). ----
update public.form_items
  set visible_when = jsonb_build_object('question_key','qb','op','equals','value','Sim')
  where id = (select i_b from d);

select throws_ok(
  format($$ select public.validate_visible_when(%L) $$, (select ver_id from d)),
  '23514',
  null,
  'item condition that self-references is rejected'
);

-- ---- 4) Forward reference is rejected (qa depends on the later qb). ----
update public.form_items set visible_when = null where id = (select i_b from d);
update public.form_items
  set visible_when = jsonb_build_object('question_key','qb','op','equals','value','Sim')
  where id = (select i_a from d);

select throws_ok(
  format($$ select public.validate_visible_when(%L) $$, (select ver_id from d)),
  '23514',
  null,
  'item condition that forward-references a later item is rejected'
);

-- ---- 5) Operator<->type mismatch: an ordered op (gt) against a CHOICE target
-- is rejected. ----
update public.form_items set visible_when = null where id = (select i_a from d);
update public.form_items
  set visible_when = jsonb_build_object('question_key','qa','op','gt','value',5)
  where id = (select i_b from d);

select throws_ok(
  format($$ select public.validate_visible_when(%L) $$, (select ver_id from d)),
  '23514',
  null,
  'a gt operator against a choice target is rejected (op<->type)'
);

-- ---- 6) Operator<->type mismatch: `in` against a NUMBER target is rejected.
-- qnum is at pos 2; make an item AFTER it to legally reference it. ----
update public.form_items set visible_when = null where id = (select i_b from d);
-- i_b is pos 1 (before qnum) so it cannot reference qnum; instead validate the
-- op<->type rule by referencing qnum from a brand-new later item.
insert into public.form_items (id, section_id, position, item_type, question_key, label, visible_when)
select gen_random_uuid(), s0, 3, 'free_text', 'qc', 'C?',
       jsonb_build_object('question_key','qnum','op','in','value', jsonb_build_array(1,2))
from d;

select throws_ok(
  format($$ select public.validate_visible_when(%L) $$, (select ver_id from d)),
  '23514',
  null,
  'an in operator against a number target is rejected (op<->type)'
);

-- Clean the bad item out for the remaining happy-path checks.
delete from public.form_items where question_key = 'qc'
  and section_id = (select s0 from d);

-- ---- 7) A valid ordered op (gt) against the NUMBER target from a later item
-- passes. ----
insert into public.form_items (id, section_id, position, item_type, question_key, label, visible_when)
select gen_random_uuid(), s0, 3, 'free_text', 'qd', 'D?',
       jsonb_build_object('question_key','qnum','op','gt','value',5)
from d;

select lives_ok(
  format($$ select public.validate_visible_when(%L) $$, (select ver_id from d)),
  'a gt operator against a number target passes (op<->type)'
);

-- ---- 8) GROUP shape on an item: an ALL group with one valid + one forward ref
-- is rejected (validates every sub-condition). ----
delete from public.form_items where question_key = 'qd' and section_id = (select s0 from d);
update public.form_items
  set visible_when = jsonb_build_object(
        'match','all',
        'conditions', jsonb_build_array(
          jsonb_build_object('question_key','qa','op','equals','value','Sim'),
          jsonb_build_object('question_key','qnum','op','gt','value',5)  -- qnum is LATER than qb
        ))
  where id = (select i_b from d);

select throws_ok(
  format($$ select public.validate_visible_when(%L) $$, (select ver_id from d)),
  '23514',
  null,
  'an item GROUP with a forward-referencing sub-condition is rejected'
);

-- ---- 9) GROUP shape on a SECTION (group-aware section validation): a section
-- group whose sub-condition references a later section is rejected. ----
update public.form_items set visible_when = null where id = (select i_b from d);
-- Add section 1 referencing a key that lives only in a LATER section 2.
insert into public.form_sections (id, form_version_id, position, title, visible_when)
select gen_random_uuid(), ver_id, 1, 'EarlyGrp',
       jsonb_build_object(
         'match','any',
         'conditions', jsonb_build_array(
           jsonb_build_object('question_key','laterkey','op','equals','value','Sim')))
from d;
insert into public.form_sections (id, form_version_id, position, title)
select gen_random_uuid(), ver_id, 2, 'LaterGrp' from d;
insert into public.form_items (section_id, position, item_type, question_key, label, options, required)
select (select id from public.form_sections where form_version_id = (select ver_id from d) and position = 2),
       0, 'multiple_choice', 'laterkey', 'Later?', '["Sim","Não"]'::jsonb, false
from d;

select throws_ok(
  format($$ select public.validate_visible_when(%L) $$, (select ver_id from d)),
  '23514',
  null,
  'a SECTION group whose sub-condition references a later section is rejected'
);

-- ---- 10) NUMBER condition VALUE-TYPE guard (QA MAJOR-1 safety net): a
-- condition targeting the number question qnum with a STRING value is rejected
-- at publish-validation; with a NUMERIC value it passes. ----
-- Reset the section-9 fixtures back to a clean single-section state.
update public.form_sections set visible_when = null
  where form_version_id = (select ver_id from d);
delete from public.form_items where question_key = 'laterkey'
  and form_version_id = (select ver_id from d);
delete from public.form_sections
  where form_version_id = (select ver_id from d) and position in (1, 2);
update public.form_items set visible_when = null where id = (select i_b from d);

-- A later item (after qnum @ pos 2) referencing qnum with a STRING value.
insert into public.form_items (id, section_id, position, item_type, question_key, label, visible_when)
select gen_random_uuid(), s0, 4, 'free_text', 'qnumstr', 'NumStr?',
       jsonb_build_object('question_key','qnum','op','gt','value','5')  -- string "5"
from d;

select throws_ok(
  format($$ select public.validate_visible_when(%L) $$, (select ver_id from d)),
  '23514',
  null,
  'a number condition with a STRING value is rejected (MAJOR-1 value-type guard)'
);

-- Swap the value to a JSON number -> accepted.
update public.form_items
  set visible_when = jsonb_build_object('question_key','qnum','op','gt','value',5)
  where question_key = 'qnumstr' and form_version_id = (select ver_id from d);

select lives_ok(
  format($$ select public.validate_visible_when(%L) $$, (select ver_id from d)),
  'a number condition with a NUMERIC value passes'
);

select * from finish();
rollback;
