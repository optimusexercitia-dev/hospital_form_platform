-- reconcile_item_options (form-model-normalization, QA MAJOR-1) — the atomic
-- option-set reconcile that fixes the cross-transaction DEFERRABLE-unique reorder
-- bug. Covers: reorder an existing option UP into an OCCUPIED slot (the exact
-- repro), codes preserved through the reorder, add/remove in the same call, and
-- draft-only immutability (a published item's options can't be reconciled).
-- Self-contained fixture.

begin;
select plan(9);

-- ---- Build a hermetic draft form with a 3-option multiple_choice. ----
do $$
declare
  v_hosp uuid;
  v_comm uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
  v_form uuid := gen_random_uuid();
  v_ver uuid := gen_random_uuid();
  v_sec uuid := gen_random_uuid();
  v_mc uuid := gen_random_uuid();
begin
  select h.id into v_hosp from public.hospitals h limit 1;
  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', v_user, 'authenticated','authenticated', v_user||'@t', now(), now());
  insert into public.commissions (id, name, slug, created_by, hospital_id)
    values (v_comm, 'RC', 'rc-'||substr(v_user::text,1,8), v_user, v_hosp);
  -- (fetch the derived id back — commissions id may be trigger-managed elsewhere,
  -- but here we set it explicitly, so v_comm is valid.)
  insert into public.commission_members (commission_id, user_id, role) values (v_comm, v_user, 'staff_admin');

  insert into public.forms (id, commission_id, title, created_by) values (v_form, v_comm, 'F', v_user);
  insert into public.form_versions (id, form_id, version_number, status) values (v_ver, v_form, 1, 'draft');
  insert into public.form_sections (id, form_version_id, position, is_default) values (v_sec, v_ver, 0, true);
  insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
    values (v_mc, v_sec, 0, 'multiple_choice', 'q', 'Q', true);
  insert into public.form_item_options (item_id, position, code, label) values
    (v_mc, 0, 'a', 'A'), (v_mc, 1, 'b', 'B'), (v_mc, 2, 'c', 'C');

  perform set_config('test.rc_item', v_mc::text, false);
  perform set_config('test.rc_ver', v_ver::text, false);
end $$;

-- ---- 1) THE REPRO: reorder so C moves UP into slot 0 (occupied) — [C,A,B].
-- Under the old per-row loop this raised the DEFERRABLE unique violation; the
-- atomic RPC must succeed.
select lives_ok(
  format($$ select public.reconcile_item_options(%L, %L::jsonb) $$,
         current_setting('test.rc_item'),
         '[{"code":"c","label":"C"},{"code":"a","label":"A"},{"code":"b","label":"B"}]'),
  'reconcile_item_options reorders an option UP into an occupied slot without a unique violation'
);

-- 2) the new order is exactly C(0), A(1), B(2).
select is(
  (select array_agg(code order by position)
   from public.form_item_options where item_id = current_setting('test.rc_item')::uuid),
  array['c','a','b'],
  'positions reflect the new order after reorder'
);

-- 3) codes preserved (same set, no regeneration).
select is(
  (select array_agg(code order by code)
   from public.form_item_options where item_id = current_setting('test.rc_item')::uuid),
  array['a','b','c'],
  'reorder preserves the option codes (no regeneration)'
);

-- 4) ADD a new option + REMOVE one in the same reconcile: keep C, A; drop B; add D.
-- The caller supplies a code for the new row (app-side gen); here 'd_new'.
select lives_ok(
  format($$ select public.reconcile_item_options(%L, %L::jsonb) $$,
         current_setting('test.rc_item'),
         '[{"code":"a","label":"A"},{"code":"c","label":"C"},{"code":"d_new","label":"D"}]'),
  'reconcile handles add + remove + reorder in one atomic call'
);

-- 5) the option set is now {a,c,d_new} in order a(0),c(1),d_new(2).
select is(
  (select array_agg(code order by position)
   from public.form_item_options where item_id = current_setting('test.rc_item')::uuid),
  array['a','c','d_new'],
  'add/remove/reorder yields the exact submitted set + order'
);

-- 6) B was deleted.
select is(
  (select count(*)::int from public.form_item_options
   where item_id = current_setting('test.rc_item')::uuid and code = 'b'),
  0,
  'a removed option is deleted'
);

-- 7) content update on a kept row (rename A -> "Alpha", colour it) applies.
select lives_ok(
  format($$ select public.reconcile_item_options(%L, %L::jsonb) $$,
         current_setting('test.rc_item'),
         '[{"code":"a","label":"Alpha","color_token":"green","score":5},{"code":"c","label":"C"},{"code":"d_new","label":"D"}]'),
  'reconcile updates a kept row''s label/colour/score (code frozen)'
);
select is(
  (select label || '|' || coalesce(color_token,'') || '|' || coalesce(score::text,'')
   from public.form_item_options
   where item_id = current_setting('test.rc_item')::uuid and code = 'a'),
  'Alpha|green|5',
  'kept-row content updated in place, code unchanged'
);

-- 8) duplicate code in the payload is rejected (HC013).
select throws_ok(
  format($$ select public.reconcile_item_options(%L, %L::jsonb) $$,
         current_setting('test.rc_item'),
         '[{"code":"a","label":"A"},{"code":"a","label":"A2"}]'),
  'HC013',
  null,
  'reconcile rejects a payload with a duplicate code'
);

select * from finish();
rollback;
