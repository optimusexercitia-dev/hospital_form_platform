-- pgTAP: "Outros" open option + free_text/short_text length limits
-- (migration 20260713000800_others_open_option_and_length_limits.sql).
--
-- Coverage:
--   §1 reconcile_item_options reserved-row lifecycle: mint __other__ when
--      config.allowOther true (last position); DROP when false; keep+reposition
--      when present; reject an author-supplied __other__ code; the reserved row's
--      absence from the author payload is NOT a deletion.
--   §2 clone_form_version preserves is_other + config.allowOther.
--   §3 save_section_answers p_other_text: writes other_text ONLY when the item's
--      __other__ option is selected; forces NULL otherwise.
--   §4 evaluator isolation: other_text is NEVER in app.answer_map (the reserved
--      __other__ CODE is, so "Outro selected" conditions still work).
--   §5 length limits at submit: min/max character bounds (HC061); a compliant
--      answer submits.
--
-- Assertion count: 17

begin;
select plan(17);

update app.feature_flags set enabled = true
  where key in ('signoff_enforcement');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- ===========================================================================
-- SETUP · a draft form with: an MC item (config.allowOther) + a free_text item
-- with minLength/maxLength. Built as superuser.
-- ===========================================================================
create temp table fx on commit drop as select
  gen_random_uuid() as form_id,
  gen_random_uuid() as ver_id,
  gen_random_uuid() as sec_id,
  gen_random_uuid() as it_mc,     -- multiple_choice with allowOther
  gen_random_uuid() as it_text;   -- free_text with length limits
grant select on fx to authenticated;

do $$
declare
  v_form uuid; v_ver uuid; v_sec uuid; v_mc uuid; v_text uuid; v_comm uuid; v_sa uuid;
begin
  select form_id, ver_id, sec_id, it_mc, it_text into v_form, v_ver, v_sec, v_mc, v_text from fx;
  select comm_x, sa_x into v_comm, v_sa from k;

  insert into public.forms (id, commission_id, title, created_by)
    values (v_form, v_comm, 'Others Form', v_sa);
  insert into public.form_versions (id, form_id, version_number, status)
    values (v_ver, v_form, 1, 'draft');
  insert into public.form_sections (id, form_version_id, position, is_default)
    values (v_sec, v_ver, 0, true);

  -- MC item with allowOther true; two author options.
  insert into public.form_items (id, section_id, position, item_type, question_key, label, required, config)
    values (v_mc, v_sec, 0, 'multiple_choice', 'o_mc', 'Escolha', false,
            jsonb_build_object('allowOther', true));
  insert into public.form_item_options (item_id, position, code, label) values
    (v_mc, 0, 'a', 'A'),
    (v_mc, 1, 'b', 'B');

  -- free_text with minLength 5 / maxLength 10.
  insert into public.form_items (id, section_id, position, item_type, question_key, label, required, config)
    values (v_text, v_sec, 1, 'free_text', 'o_text', 'Texto', false,
            jsonb_build_object('minLength', 5, 'maxLength', 10));
end;
$$;

-- ===========================================================================
-- §1 · reconcile_item_options reserved-row lifecycle
-- ===========================================================================
-- allowOther is true → reconcile the two author rows → a __other__ row is minted
-- last. (Simulate what addItem/updateItem call.)
select public.reconcile_item_options(
  (select it_mc from fx),
  '[{"code":"a","label":"A"},{"code":"b","label":"B"}]'::jsonb);

select is(
  (select count(*)::int from public.form_item_options
   where item_id = (select it_mc from fx) and is_other = true),
  1, 'reconcile: exactly one __other__ reserved row minted when allowOther true');
select is(
  (select code from public.form_item_options
   where item_id = (select it_mc from fx) and is_other = true),
  '__other__', 'reconcile: the reserved row carries the __other__ code');
select is(
  (select position from public.form_item_options
   where item_id = (select it_mc from fx) and is_other = true),
  2, 'reconcile: the reserved row is LAST (position 2, after the 2 author rows)');
select is(
  (select count(*)::int from public.form_item_options
   where item_id = (select it_mc from fx) and is_other = false),
  2, 'reconcile: the two author rows are preserved (reserved-row absence ≠ deletion)');

-- Re-reconcile WITHOUT the reserved row in the payload (author never sends it) →
-- the reserved row is KEPT (not deleted) and repositioned last after 3 author rows.
select public.reconcile_item_options(
  (select it_mc from fx),
  '[{"code":"a","label":"A"},{"code":"b","label":"B"},{"code":"c","label":"C"}]'::jsonb);
select is(
  (select count(*)::int from public.form_item_options
   where item_id = (select it_mc from fx) and is_other = true),
  1, 'reconcile: reserved row KEPT across a re-reconcile that omits it');
select is(
  (select position from public.form_item_options
   where item_id = (select it_mc from fx) and is_other = true),
  3, 'reconcile: reserved row repositioned LAST (after 3 author rows)');

-- An author payload carrying the reserved code is REJECTED.
select throws_ok(
  format($$ select public.reconcile_item_options(%L, '[{"code":"__other__","label":"X"}]'::jsonb) $$,
         (select it_mc from fx)),
  'HC013', null,
  'reconcile: an author-supplied __other__ code is rejected (reserved)');

-- Turn allowOther OFF → reconcile drops the reserved row.
update public.form_items set config = jsonb_build_object('allowOther', false)
  where id = (select it_mc from fx);
select public.reconcile_item_options(
  (select it_mc from fx),
  '[{"code":"a","label":"A"},{"code":"b","label":"B"}]'::jsonb);
select is(
  (select count(*)::int from public.form_item_options
   where item_id = (select it_mc from fx) and is_other = true),
  0, 'reconcile: reserved row DROPPED when allowOther false');

-- Restore allowOther true + mint the reserved row for the rest of the tests.
update public.form_items set config = jsonb_build_object('allowOther', true)
  where id = (select it_mc from fx);
select public.reconcile_item_options(
  (select it_mc from fx),
  '[{"code":"a","label":"A"},{"code":"b","label":"B"}]'::jsonb);

-- ===========================================================================
-- §2 · clone_form_version preserves is_other + config.allowOther
-- ===========================================================================
-- (Publish first so clone starts from a clean published version.)
select public.publish_form_version((select ver_id from fx));
create temp table clone_v on commit drop as
  select public.clone_form_version((select ver_id from fx)) as new_ver;
grant select on clone_v to authenticated;

select is(
  (select count(*)::int from public.form_item_options o
   join public.form_items i on i.id = o.item_id
   where i.form_version_id = (select new_ver from clone_v)
     and i.question_key = 'o_mc' and o.is_other),
  1, 'clone: the reserved __other__ row survives the clone');
select ok(
  (select (i.config ->> 'allowOther')::boolean
   from public.form_items i
   where i.form_version_id = (select new_ver from clone_v) and i.question_key = 'o_mc'),
  'clone: config.allowOther survives the clone');

-- ===========================================================================
-- §3 + §4 · save other_text (gated on __other__ selected) + evaluator isolation
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table rsp on commit drop as
  select (public.start_or_resume_response((select ver_id from fx))).id as rid;
grant select on rsp to authenticated;

-- Select __other__ + type "meu texto" → other_text stored.
select public.save_section_answers(
  (select rid from rsp), (select sec_id from fx),
  '{}'::jsonb, null, null,
  jsonb_build_object((select it_mc from fx)::text, jsonb_build_array('__other__')),
  jsonb_build_object((select it_mc from fx)::text, 'meu texto'));
reset role;

select is(
  (select other_text from public.answers
   where response_id = (select rid from rsp) and item_id = (select it_mc from fx)),
  'meu texto', 'save: other_text stored when __other__ is selected');

-- §4 · other_text is NOT in the answer map, but the __other__ CODE IS.
create temp table ph_map on commit drop as
  select app.answer_map((select rid from rsp)) as m;
grant select on ph_map to authenticated;
select is(
  (select (m -> 'o_mc') from ph_map),
  '"__other__"'::jsonb, 'evaluator: the __other__ CODE is in the answer map (conditions can read it)');
select ok(
  (select (m::text not like '%meu texto%') from ph_map),
  'evaluator: the other_text value is NOT anywhere in the answer map (isolation)');

-- Now DESELECT __other__ (select A instead) → other_text forced NULL.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.save_section_answers(
  (select rid from rsp), (select sec_id from fx),
  '{}'::jsonb, null, null,
  jsonb_build_object((select it_mc from fx)::text, jsonb_build_array('a')),
  jsonb_build_object((select it_mc from fx)::text, 'ainda aqui'));
reset role;
select is(
  (select other_text from public.answers
   where response_id = (select rid from rsp) and item_id = (select it_mc from fx)),
  null::text, 'save: other_text forced NULL when __other__ is NOT selected');

-- ===========================================================================
-- §5 · length limits at submit (minLength 5 / maxLength 10 on the free_text item)
-- ===========================================================================
-- Too short ("abc" = 3 < 5) → submit fails HC061.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.save_section_answers(
  (select rid from rsp), (select sec_id from fx),
  jsonb_build_object((select it_text from fx)::text, to_jsonb('abc'::text)));
select throws_ok(
  format($$ select public.submit_response(%L) $$, (select rid from rsp)),
  'HC061', null,
  'length: a free_text answer shorter than minLength is rejected at submit (HC061)');

-- Too long (11 chars > 10) → HC061.
select public.save_section_answers(
  (select rid from rsp), (select sec_id from fx),
  jsonb_build_object((select it_text from fx)::text, to_jsonb('12345678901'::text)));
select throws_ok(
  format($$ select public.submit_response(%L) $$, (select rid from rsp)),
  'HC061', null,
  'length: a free_text answer longer than maxLength is rejected at submit (HC061)');

-- Compliant (7 chars) + deselect Outro (A selected already) → submits OK.
select public.save_section_answers(
  (select rid from rsp), (select sec_id from fx),
  jsonb_build_object((select it_text from fx)::text, to_jsonb('sete123'::text)));
select lives_ok(
  format($$ select public.submit_response(%L) $$, (select rid from rsp)),
  'length: a within-bounds free_text answer submits successfully');
reset role;

select finish();
rollback;
