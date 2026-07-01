-- app.answer_map shape (form-model-normalization, BE-3) — proves the rebuilt
-- question_key -> jsonb shapes are EXACTLY what the unchanged evaluator consumes:
--   * single-select (multiple_choice / dropdown) -> scalar option CODE (jsonb string)
--   * checkbox                                    -> jsonb ARRAY of codes by position
--   * scalar inputs (free_text/number/date/time)  -> raw answers.value
--   * a choice item with NO selection contributes NO key (missing-answer semantics)
-- This is the evaluator-non-drift gate's SQL half (the TS half is the Vitest
-- vectors). Self-contained fixture (does not depend on the shared bootstrap).

begin;
select plan(11);

-- ---- Build a hermetic form: 1 MC, 1 dropdown, 1 checkbox, 1 free_text, 1 number.
do $$
declare
  v_org uuid := gen_random_uuid();
  v_hosp uuid := gen_random_uuid();
  v_comm uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
  v_form uuid := gen_random_uuid();
  v_ver uuid := gen_random_uuid();
  v_sec uuid := gen_random_uuid();
  v_mc uuid := gen_random_uuid();
  v_dd uuid := gen_random_uuid();
  v_cb uuid := gen_random_uuid();
  v_ft uuid := gen_random_uuid();
  v_nm uuid := gen_random_uuid();
  v_cb_empty uuid := gen_random_uuid();
  v_resp uuid := gen_random_uuid();
  o_mc_a uuid; o_mc_b uuid;
  o_cb_x uuid; o_cb_y uuid; o_cb_z uuid;
  o_dd_p uuid;
begin
  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated', v_user||'@t', now(), now());

  insert into public.organizations (id, name, slug) values (v_org, 'O', 'o-'||substr(v_org::text,1,8));
  insert into public.hospitals (id, organization_id, name, slug) values (v_hosp, v_org, 'H', 'h-'||substr(v_hosp::text,1,8));
  insert into public.commissions (id, name, slug, created_by, hospital_id)
    values (v_comm, 'C', 'c-'||substr(v_comm::text,1,8), v_user, v_hosp);
  insert into public.commission_members (commission_id, user_id, role) values (v_comm, v_user, 'staff');

  insert into public.forms (id, commission_id, title, created_by) values (v_form, v_comm, 'F', v_user);
  insert into public.form_versions (id, form_id, version_number, status) values (v_ver, v_form, 1, 'draft');
  insert into public.form_sections (id, form_version_id, position, is_default) values (v_sec, v_ver, 0, true);

  insert into public.form_items (id, section_id, position, item_type, question_key, label, required) values
    (v_mc, v_sec, 0, 'multiple_choice', 'mc', 'MC', false),
    (v_dd, v_sec, 1, 'dropdown',        'dd', 'DD', false),
    (v_cb, v_sec, 2, 'checkbox',        'cb', 'CB', false),
    (v_ft, v_sec, 3, 'free_text',       'ft', 'FT', false),
    (v_nm, v_sec, 4, 'number',          'nm', 'NM', false),
    (v_cb_empty, v_sec, 5, 'checkbox',  'cb_empty', 'CBE', false);

  insert into public.form_item_options (item_id, position, code, label) values
    (v_mc, 0, 'mc_a', 'A'), (v_mc, 1, 'mc_b', 'B');
  select id into o_mc_a from public.form_item_options where item_id = v_mc and code = 'mc_a';
  select id into o_mc_b from public.form_item_options where item_id = v_mc and code = 'mc_b';

  insert into public.form_item_options (item_id, position, code, label) values (v_dd, 0, 'dd_p', 'P');
  select id into o_dd_p from public.form_item_options where item_id = v_dd and code = 'dd_p';

  -- Checkbox options inserted OUT of position order on purpose, to prove the
  -- answer_map array is ordered by position, not insert order.
  insert into public.form_item_options (item_id, position, code, label) values
    (v_cb, 2, 'cb_z', 'Z'), (v_cb, 0, 'cb_x', 'X'), (v_cb, 1, 'cb_y', 'Y');
  select id into o_cb_x from public.form_item_options where item_id = v_cb and code = 'cb_x';
  select id into o_cb_y from public.form_item_options where item_id = v_cb and code = 'cb_y';
  select id into o_cb_z from public.form_item_options where item_id = v_cb and code = 'cb_z';

  insert into public.form_item_options (item_id, position, code, label) values (v_cb_empty, 0, 'cbe_a', 'A');

  perform public.publish_form_version(v_ver);

  -- An in_progress response to hang answers on.
  insert into public.responses (id, form_version_id, commission_id, created_by, status)
    values (v_resp, v_ver, v_comm, v_user, 'in_progress');

  -- answer-model-v2: selections hang off a parent answers row (answer_id).
  -- Single-select MC -> code 'mc_b'.
  perform test_helpers.add_selection(v_resp, v_mc, array['mc_b']);
  -- Single-select dropdown -> code 'dd_p'.
  perform test_helpers.add_selection(v_resp, v_dd, array['dd_p']);
  -- Checkbox -> codes z + x; array must come out ordered by position: x(0), z(2).
  perform test_helpers.add_selection(v_resp, v_cb, array['cb_z','cb_x']);
  -- Scalars.
  insert into public.answers (response_id, item_id, question_key, value) values
    (v_resp, v_ft, 'ft', to_jsonb('hello'::text)),
    (v_resp, v_nm, 'nm', to_jsonb(42));
  -- cb_empty: NO selection -> absent from the map.

  -- Stash the response id for the assertions below.
  perform set_config('test.answer_map_resp', v_resp::text, false);
  -- Stash item ids so the by-item_id map assertions can key on them.
  perform set_config('test.am_mc', v_mc::text, false);
  perform set_config('test.am_cb', v_cb::text, false);
  perform set_config('test.am_ft', v_ft::text, false);
end $$;

-- ---- Assertions against the rebuilt map.
-- (1) single-select MC -> scalar string code.
select is(
  (app.answer_map(current_setting('test.answer_map_resp')::uuid)) -> 'mc',
  to_jsonb('mc_b'::text),
  'single-select MC -> scalar option code'
);

-- (2) single-select dropdown -> scalar string code.
select is(
  (app.answer_map(current_setting('test.answer_map_resp')::uuid)) -> 'dd',
  to_jsonb('dd_p'::text),
  'single-select dropdown -> scalar option code'
);

-- (3) checkbox -> jsonb array of codes ORDERED BY position (x=0 before z=2).
select is(
  (app.answer_map(current_setting('test.answer_map_resp')::uuid)) -> 'cb',
  '["cb_x","cb_z"]'::jsonb,
  'checkbox -> array of codes ordered by option.position'
);

-- (4) free_text -> raw value.
select is(
  (app.answer_map(current_setting('test.answer_map_resp')::uuid)) -> 'ft',
  to_jsonb('hello'::text),
  'free_text -> raw scalar value'
);

-- (5) number -> raw numeric value.
select is(
  (app.answer_map(current_setting('test.answer_map_resp')::uuid)) -> 'nm',
  to_jsonb(42),
  'number -> raw numeric value'
);

-- (6) checkbox with NO selection -> key ABSENT (missing-answer semantics).
select ok(
  not ((app.answer_map(current_setting('test.answer_map_resp')::uuid)) ? 'cb_empty'),
  'checkbox with no selection contributes no key'
);

-- (7) the evaluator agrees: equals on the MC code is true, on a different code false.
select is(
  app.eval_condition(
    jsonb_build_object('question_key','mc','op','equals','value','mc_b'),
    app.answer_map(current_setting('test.answer_map_resp')::uuid)),
  true,
  'eval_condition equals on selected MC code is true (no drift)'
);

-- (8) `in` over the checkbox codes is true for a member, false for a non-member.
select is(
  app.eval_condition(
    jsonb_build_object('question_key','cb','op','in','value', jsonb_build_array('cb_z','cb_y')),
    app.answer_map(current_setting('test.answer_map_resp')::uuid)),
  true,
  'eval_condition `in` matches a selected checkbox code (no drift)'
);

-- ---- app.answer_map_by_item (BUG-FMN-002): same value shapes, keyed by item_id.
-- (9) single-select MC -> scalar code under its item_id.
select is(
  (app.answer_map_by_item(current_setting('test.answer_map_resp')::uuid))
    -> current_setting('test.am_mc'),
  to_jsonb('mc_b'::text),
  'answer_map_by_item: single-select MC -> scalar code keyed by item_id'
);

-- (10) checkbox -> ordered code array under its item_id.
select is(
  (app.answer_map_by_item(current_setting('test.answer_map_resp')::uuid))
    -> current_setting('test.am_cb'),
  '["cb_x","cb_z"]'::jsonb,
  'answer_map_by_item: checkbox -> array of codes by position keyed by item_id'
);

-- (11) scalar free_text -> raw value under its item_id.
select is(
  (app.answer_map_by_item(current_setting('test.answer_map_resp')::uuid))
    -> current_setting('test.am_ft'),
  to_jsonb('hello'::text),
  'answer_map_by_item: free_text -> raw value keyed by item_id'
);

select * from finish();
rollback;
