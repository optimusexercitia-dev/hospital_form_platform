-- answer-model-v2 GOLDEN PARITY (ADR 0045; Rule 3) — the keystone gate.
--
-- The three rehydration functions (answer_map / answer_map_by_item /
-- case_phase_answer_map) now source choice selections through the parent answer
-- (answer_id -> answers) instead of answer_selected_options(response_id,item_id).
-- Their question_key->value OUTPUT must stay BYTE-FOR-BYTE identical.
--
-- The expected literals below were captured from the CURRENT baseline
-- (20260620000000) on a representative response BEFORE the answer migration was
-- written, then frozen here (they are NOT derived from the new code). Any diff is
-- phase-blocking. Self-contained fixture (does not depend on the shared bootstrap).

begin;
select plan(4);

-- ---- Fixture: single-select MC + dropdown + checkbox (multi, options OUT of
-- position order) + free_text/number/date/time/short_text scalars + an
-- observation-only row (value null) + a checkbox with NO selection. Selections
-- hang off parent answers rows (answer_id). ----
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
  v_dt uuid := gen_random_uuid();
  v_tm uuid := gen_random_uuid();
  v_st uuid := gen_random_uuid();
  v_obs uuid := gen_random_uuid();
  v_cb_empty uuid := gen_random_uuid();
  v_resp uuid := gen_random_uuid();
  a_mc uuid; a_dd uuid; a_cb uuid;
  o_mc_b uuid; o_dd_p uuid; o_cb_x uuid; o_cb_z uuid;
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
    (v_dt, v_sec, 5, 'date',            'dt', 'DT', false),
    (v_tm, v_sec, 6, 'time',            'tm', 'TM', false),
    (v_st, v_sec, 7, 'short_text',      'st', 'ST', false),
    (v_obs, v_sec, 8, 'free_text',      'obsonly', 'OBS', false),
    (v_cb_empty, v_sec, 9, 'checkbox',  'cb_empty', 'CBE', false);
  insert into public.form_item_options (item_id, position, code, label) values (v_mc,0,'mc_a','A'),(v_mc,1,'mc_b','B');
  select id into o_mc_b from public.form_item_options where item_id=v_mc and code='mc_b';
  insert into public.form_item_options (item_id, position, code, label) values (v_dd,0,'dd_p','P');
  select id into o_dd_p from public.form_item_options where item_id=v_dd and code='dd_p';
  -- Checkbox options OUT of position order on purpose (array must order by position).
  insert into public.form_item_options (item_id, position, code, label) values (v_cb,2,'cb_z','Z'),(v_cb,0,'cb_x','X'),(v_cb,1,'cb_y','Y');
  select id into o_cb_x from public.form_item_options where item_id=v_cb and code='cb_x';
  select id into o_cb_z from public.form_item_options where item_id=v_cb and code='cb_z';
  insert into public.form_item_options (item_id, position, code, label) values (v_cb_empty,0,'cbe_a','A');
  perform public.publish_form_version(v_ver);

  insert into public.responses (id, form_version_id, commission_id, created_by, status)
    values (v_resp, v_ver, v_comm, v_user, 'in_progress');

  -- Parent answers rows for each choice item (value null), then selections by
  -- answer_id. Checkbox: z + x selected (z inserted first) -> array must be [x,z].
  insert into public.answers (response_id, item_id, question_key, value) values (v_resp, v_mc, 'mc', null) returning id into a_mc;
  insert into public.answers (response_id, item_id, question_key, value) values (v_resp, v_dd, 'dd', null) returning id into a_dd;
  insert into public.answers (response_id, item_id, question_key, value) values (v_resp, v_cb, 'cb', null) returning id into a_cb;
  insert into public.answer_selected_options (answer_id, option_id) values
    (a_mc, o_mc_b), (a_dd, o_dd_p), (a_cb, o_cb_z), (a_cb, o_cb_x);

  insert into public.answers (response_id, item_id, question_key, value) values
    (v_resp, v_ft, 'ft', to_jsonb('hello'::text)),
    (v_resp, v_nm, 'nm', to_jsonb(42)),
    (v_resp, v_dt, 'dt', to_jsonb('2026-01-15'::text)),
    (v_resp, v_tm, 'tm', to_jsonb('08:30'::text)),
    (v_resp, v_st, 'st', to_jsonb('curto'::text));
  -- observation-only row (value null) -> contributes NO key.
  insert into public.answers (response_id, item_id, question_key, value, observation) values
    (v_resp, v_obs, 'obsonly', null, 'uma nota');

  perform set_config('test.gr', v_resp::text, false);
  perform set_config('test.gr_mc', v_mc::text, false);
  perform set_config('test.gr_dd', v_dd::text, false);
  perform set_config('test.gr_cb', v_cb::text, false);
  perform set_config('test.gr_ft', v_ft::text, false);
  perform set_config('test.gr_nm', v_nm::text, false);
  perform set_config('test.gr_dt', v_dt::text, false);
  perform set_config('test.gr_tm', v_tm::text, false);
  perform set_config('test.gr_st', v_st::text, false);
end $$;

-- (1) answer_map GOLDEN — frozen from the baseline pre-change.
select is(
  app.answer_map(current_setting('test.gr')::uuid),
  '{"cb": ["cb_x", "cb_z"], "dd": "dd_p", "dt": "2026-01-15", "ft": "hello", "mc": "mc_b", "nm": 42, "st": "curto", "tm": "08:30"}'::jsonb,
  'GOLDEN answer_map — byte-for-byte identical to the baseline output'
);

-- (2) answer_map_by_item GOLDEN — same values keyed by item_id (built from the
-- session-stashed item ids so the literal is order-independent).
select is(
  app.answer_map_by_item(current_setting('test.gr')::uuid),
  jsonb_build_object(
    current_setting('test.gr_mc'), to_jsonb('mc_b'::text),
    current_setting('test.gr_dd'), to_jsonb('dd_p'::text),
    current_setting('test.gr_cb'), '["cb_x","cb_z"]'::jsonb,
    current_setting('test.gr_ft'), to_jsonb('hello'::text),
    current_setting('test.gr_nm'), to_jsonb(42),
    current_setting('test.gr_dt'), to_jsonb('2026-01-15'::text),
    current_setting('test.gr_tm'), to_jsonb('08:30'::text),
    current_setting('test.gr_st'), to_jsonb('curto'::text)
  ),
  'GOLDEN answer_map_by_item — same values keyed by item_id'
);

-- (3) the evaluator still agrees over the golden map (no drift): checkbox `in`.
select is(
  app.eval_condition(
    jsonb_build_object('question_key','cb','op','in','value', jsonb_build_array('cb_z','cb_y')),
    app.answer_map(current_setting('test.gr')::uuid)),
  true,
  'eval_condition `in` matches a selected checkbox code over the golden map'
);

-- ---- case_phase_answer_map GOLDEN: a submitted case-phase response with MC +
-- checkbox + number. Frozen from the baseline: {"cb":["cb_x","cb_z"],"mc":"mc_b","nm":7}.
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
  v_cb uuid := gen_random_uuid();
  v_nm uuid := gen_random_uuid();
  v_tmpl uuid := gen_random_uuid();
  v_tphase uuid := gen_random_uuid();
  v_case uuid := gen_random_uuid();
  v_cphase uuid := gen_random_uuid();
  v_resp uuid := gen_random_uuid();
  a_mc uuid; a_cb uuid;
  o_mc_b uuid; o_cb_x uuid; o_cb_z uuid;
begin
  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated', v_user||'@t', now(), now());
  insert into public.organizations (id, name, slug) values (v_org, 'O', 'o2-'||substr(v_org::text,1,8));
  insert into public.hospitals (id, organization_id, name, slug) values (v_hosp, v_org, 'H', 'h2-'||substr(v_hosp::text,1,8));
  insert into public.commissions (id, name, slug, created_by, hospital_id)
    values (v_comm, 'C', 'c2-'||substr(v_comm::text,1,8), v_user, v_hosp);
  insert into public.commission_members (commission_id, user_id, role) values (v_comm, v_user, 'staff');
  insert into public.forms (id, commission_id, title, created_by) values (v_form, v_comm, 'F', v_user);
  insert into public.form_versions (id, form_id, version_number, status) values (v_ver, v_form, 1, 'draft');
  insert into public.form_sections (id, form_version_id, position, is_default) values (v_sec, v_ver, 0, true);
  insert into public.form_items (id, section_id, position, item_type, question_key, label, required) values
    (v_mc, v_sec, 0, 'multiple_choice', 'mc', 'MC', false),
    (v_cb, v_sec, 1, 'checkbox', 'cb', 'CB', false),
    (v_nm, v_sec, 2, 'number', 'nm', 'NM', false);
  insert into public.form_item_options (item_id, position, code, label) values (v_mc,0,'mc_a','A'),(v_mc,1,'mc_b','B');
  select id into o_mc_b from public.form_item_options where item_id=v_mc and code='mc_b';
  insert into public.form_item_options (item_id, position, code, label) values (v_cb,2,'cb_z','Z'),(v_cb,0,'cb_x','X'),(v_cb,1,'cb_y','Y');
  select id into o_cb_x from public.form_item_options where item_id=v_cb and code='cb_x';
  select id into o_cb_z from public.form_item_options where item_id=v_cb and code='cb_z';
  perform public.publish_form_version(v_ver);

  insert into public.process_templates (id, commission_id, title, created_by) values (v_tmpl, v_comm, 'T', v_user);
  insert into public.process_template_phases (id, template_id, position, title, form_id) values (v_tphase, v_tmpl, 0, 'P', v_form);
  insert into public.cases (id, commission_id, template_id, case_number, label, created_by, status)
    values (v_case, v_comm, v_tmpl, 1, 'Caso', v_user, 'em_revisao');
  insert into public.case_phases (id, case_id, position, title, form_id, form_version_id, status)
    values (v_cphase, v_case, 0, 'P', v_form, v_ver, 'ativa');
  insert into public.responses (id, form_version_id, commission_id, created_by, status, case_phase_id)
    values (v_resp, v_ver, v_comm, v_user, 'in_progress', v_cphase);
  insert into public.answers (response_id, item_id, question_key, value) values (v_resp, v_mc, 'mc', null) returning id into a_mc;
  insert into public.answers (response_id, item_id, question_key, value) values (v_resp, v_cb, 'cb', null) returning id into a_cb;
  insert into public.answer_selected_options (answer_id, option_id) values (a_mc, o_mc_b), (a_cb, o_cb_z), (a_cb, o_cb_x);
  insert into public.answers (response_id, item_id, question_key, value) values (v_resp, v_nm, 'nm', to_jsonb(7));
  update public.responses set status='submitted', submitted_at=now() where id=v_resp;

  perform set_config('test.gcp', v_cphase::text, false);
end $$;

-- (4) case_phase_answer_map GOLDEN — frozen from the baseline.
select is(
  app.case_phase_answer_map(current_setting('test.gcp')::uuid),
  '{"cb": ["cb_x", "cb_z"], "mc": "mc_b", "nm": 7}'::jsonb,
  'GOLDEN case_phase_answer_map — byte-for-byte identical to the baseline output'
);

select * from finish();
rollback;
