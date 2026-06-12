-- Phase 4 / M10: builder mutation entry points — create_form,
-- clone_form_version, reorder_section, reorder_item.
--
-- The RPCs are SECURITY INVOKER, so acting as a real staff_admin (sa_x) also
-- proves the existing builder RLS authorizes them. The bootstrap publishes the
-- unsectioned form (ver_u) and the sectioned form (ver_s, which carries a
-- conditional section + two sign-off sections + display items), so the clone
-- exercises the full fidelity matrix.

begin;
select plan(33);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

-- =========================================================================
-- create_form: born as one default section, v1 draft.
-- =========================================================================
select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;

create temp table created on commit drop as
  select * from public.create_form(
    (select (v->>'comm_x')::uuid from ctx),
    'Novo formulário',
    'descrição'
  );

reset role;
grant select on created to authenticated;

select is(
  (select count(*)::int from public.form_versions
   where id = (select version_id from created)),
  1,
  'create_form created exactly one version'
);

select is(
  (select version_number || '/' || status from public.form_versions
   where id = (select version_id from created)),
  '1/draft',
  'create_form version is v1 draft'
);

select is(
  (select count(*)::int from public.form_sections
   where form_version_id = (select version_id from created)),
  1,
  'create_form created exactly one section'
);

select is(
  (select is_default::text || '|' || coalesce(title, 'NULL') || '|' || position
   from public.form_sections
   where form_version_id = (select version_id from created)),
  'true|NULL|0',
  'the lone section is the default section (is_default, no title, position 0)'
);

select is(
  (select count(*)::int from public.form_items
   where form_version_id = (select version_id from created)),
  0,
  'a fresh form has no items yet'
);

-- =========================================================================
-- clone_form_version: full fidelity on the sectioned form (ver_s).
-- =========================================================================
-- Snapshot the source shape first.
create temp table src_shape on commit drop as
  select
    (select count(*) from public.form_sections where form_version_id = (select (v->>'ver_s')::uuid from ctx)) as n_sections,
    (select count(*) from public.form_items where form_version_id = (select (v->>'ver_s')::uuid from ctx)) as n_items;

select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;

create temp table cloned on commit drop as
  select public.clone_form_version((select (v->>'ver_s')::uuid from ctx)) as new_version_id;

reset role;
grant select on src_shape, cloned to authenticated;

select is(
  (select version_number || '/' || status from public.form_versions
   where id = (select new_version_id from cloned)),
  '2/draft',
  'clone created v2 as a draft'
);

select is(
  (select count(*)::int from public.form_sections
   where form_version_id = (select new_version_id from cloned)),
  (select n_sections::int from src_shape),
  'clone copied every section'
);

select is(
  (select count(*)::int from public.form_items
   where form_version_id = (select new_version_id from cloned)),
  (select n_items::int from src_shape),
  'clone copied every item'
);

-- question_keys survive verbatim (the set of keys is identical).
select is(
  (select array_agg(question_key order by question_key)
   from public.form_items
   where form_version_id = (select new_version_id from cloned)
     and question_key is not null),
  (select array_agg(question_key order by question_key)
   from public.form_items
   where form_version_id = (select (v->>'ver_s')::uuid from ctx)
     and question_key is not null),
  'clone preserved every question_key verbatim'
);

-- visible_when copied verbatim (the conditional section keeps its condition).
select is(
  (select visible_when from public.form_sections
   where form_version_id = (select new_version_id from cloned)
     and visible_when is not null),
  (select visible_when from public.form_sections
   where form_version_id = (select (v->>'ver_s')::uuid from ctx)
     and visible_when is not null),
  'clone preserved visible_when verbatim (condition references key, not id)'
);

-- sign-off settings copied (both roles present).
select is(
  (select array_agg(signoff_role order by signoff_role)
   from public.form_sections
   where form_version_id = (select new_version_id from cloned)
     and requires_signoff),
  array['respondent', 'staff_admin']::text[],
  'clone preserved requires_signoff + signoff_role for both sign-off sections'
);

-- display-item content (section_text markdown) copied verbatim.
select is(
  (select count(*)::int from public.form_items
   where form_version_id = (select new_version_id from cloned)
     and item_type = 'section_text'),
  (select count(*)::int from public.form_items
   where form_version_id = (select (v->>'ver_s')::uuid from ctx)
     and item_type = 'section_text'),
  'clone copied display items (section_text)'
);

-- Section ids are remapped (none shared with the source) yet items point at the
-- NEW sections.
select is(
  (select count(*)::int
   from public.form_sections clone_s
   where clone_s.form_version_id = (select new_version_id from cloned)
     and clone_s.id in (
       select id from public.form_sections
       where form_version_id = (select (v->>'ver_s')::uuid from ctx)
     )),
  0,
  'clone remapped every section id (no id shared with the source)'
);

select is(
  (select count(*)::int
   from public.form_items i
   join public.form_sections s on s.id = i.section_id
   where i.form_version_id = (select new_version_id from cloned)
     and s.form_version_id <> (select new_version_id from cloned)),
  0,
  'every cloned item points at a section of the new version'
);

-- The cloned condition still evaluates identically through the SQL evaluator.
select is(
  app.eval_condition(
    (select visible_when from public.form_sections
     where form_version_id = (select new_version_id from cloned)
       and visible_when is not null),
    '{"s_gate": "Sim"}'::jsonb
  ),
  true,
  'cloned visible_when evaluates true for the matching answer (keys survived)'
);

-- =========================================================================
-- Source immutability holds after the clone exists.
-- =========================================================================
select throws_ok(
  format($$ update public.form_items set label = 'x' where id = %L $$,
         (select v->>'it_gate' from ctx)),
  '23514',
  null,
  'source (published) item still immutable after clone'
);

select throws_ok(
  format($$ update public.form_sections set title = 'x' where id = %L $$,
         (select v->>'sec_s1' from ctx)),
  '23514',
  null,
  'source (published) section still immutable after clone'
);

select throws_ok(
  format($$ insert into public.form_items (section_id, position, item_type, question_key, label, options, required)
            values (%L, 9, 'free_text', 'sneak', 'x', null, false) $$,
         (select v->>'sec_s1' from ctx)),
  '23514',
  null,
  'cannot insert an item into the source published version after clone'
);

-- =========================================================================
-- Clone-when-draft-exists: a second clone returns the SAME draft (ADR 0012).
-- =========================================================================
select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;

create temp table cloned2 on commit drop as
  select public.clone_form_version((select (v->>'ver_s')::uuid from ctx)) as id;

reset role;
grant select on cloned2 to authenticated;

select is(
  (select id from cloned2),
  (select new_version_id from cloned),
  'cloning again returns the existing draft (no new version)'
);

select is(
  (select count(*)::int from public.form_versions
   where form_id = (select (v->>'form_s')::uuid from ctx)),
  2,
  'still exactly two versions after the second clone attempt'
);

-- =========================================================================
-- reorder_section / reorder_item on the editable draft.
-- =========================================================================
-- Work on the cloned draft. Pick the two lowest non-default sections to swap.
create temp table draft_secs on commit drop as
  select id, position from public.form_sections
  where form_version_id = (select new_version_id from cloned)
  order by position;
grant select on draft_secs to authenticated;

select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;

-- Move the section at position 2 up (swaps with position 1).
select public.reorder_section(
  (select id from draft_secs where position = 2),
  'up'
);

reset role;

-- Positions remain contiguous + unique 0..n-1 after the swap.
select is(
  (select array_agg(position order by position)
   from public.form_sections
   where form_version_id = (select new_version_id from cloned)),
  (select array_agg(g order by g)
   from generate_series(0, (select n_sections::int - 1 from src_shape)) g),
  'section positions stay contiguous 0..n-1 after reorder'
);

-- The two rows actually swapped: the section formerly at 2 is now at 1.
select is(
  (select position from public.form_sections
   where id = (select id from draft_secs where position = 2)),
  1,
  'the moved section took the neighbour''s position (atomic swap succeeded)'
);

-- Boundary no-op: moving the first section up does nothing and does not raise.
select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;

select lives_ok(
  format($$ select public.reorder_section(%L, 'up') $$,
         (select id from public.form_sections
          where form_version_id = (select new_version_id from cloned)
          order by position limit 1)),
  'reordering the first section up is a silent no-op'
);

reset role;

-- Item reorder: the gate section in the draft has a single item, so add a second
-- one as the staff_admin and swap them.
select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;

-- Find the cloned "Gate" section (title 'Gate') and append a second item.
create temp table gate_sec on commit drop as
  select id from public.form_sections
  where form_version_id = (select new_version_id from cloned) and title = 'Gate';

insert into public.form_items (section_id, position, item_type, question_key, label, required)
select (select id from gate_sec), 1, 'free_text', 's_gate_extra', 'Extra', false;

select public.reorder_item(
  (select id from public.form_items
   where section_id = (select id from gate_sec) and position = 1),
  'up'
);

reset role;
grant select on gate_sec to authenticated;

select is(
  (select array_agg(position order by position)
   from public.form_items
   where section_id = (select id from gate_sec)),
  array[0, 1]::int[],
  'item positions stay contiguous 0..1 after reorder'
);

select is(
  (select question_key from public.form_items
   where section_id = (select id from gate_sec) and position = 0),
  's_gate_extra',
  'the appended item moved up into position 0 (atomic item swap succeeded)'
);

-- =========================================================================
-- delete_section_moving_items — the "move items then delete" branch.
-- =========================================================================
-- Move the Gate section's items into the default section, then delete Gate.
-- Capture pre-counts so we can prove no item was lost.
create temp table move_pre on commit drop as
  select
    (select id from gate_sec) as gate_id,
    (select id from public.form_sections
       where form_version_id = (select new_version_id from cloned) and is_default) as default_id,
    (select count(*) from public.form_items
       where section_id = (select id from gate_sec)) as gate_items,
    (select count(*) from public.form_items
       where section_id = (select id from public.form_sections
         where form_version_id = (select new_version_id from cloned) and is_default)) as default_items;
grant select on move_pre to authenticated;

select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;

select lives_ok(
  format($$ select public.delete_section_moving_items(%L, %L) $$,
         (select gate_id from move_pre),
         (select default_id from move_pre)),
  'delete_section_moving_items runs for a staff_admin'
);

reset role;

select is(
  (select count(*)::int from public.form_sections
   where id = (select gate_id from move_pre)),
  0,
  'the source section is deleted after its items are moved'
);

select is(
  (select count(*)::int from public.form_items
   where section_id = (select default_id from move_pre)),
  (select (default_items + gate_items)::int from move_pre),
  'every moved item landed in the target section (none lost)'
);

select is(
  (select array_agg(position order by position)
   from public.form_items
   where section_id = (select default_id from move_pre)),
  (select array_agg(g order by g)
   from generate_series(0, (select (default_items + gate_items - 1)::int from move_pre)) g),
  'target section positions stay contiguous 0..n-1 after the move'
);

-- =========================================================================
-- Authorization (RLS) — the invoker RPCs + the repaired form_versions policy.
-- =========================================================================
-- (a) A real staff_admin can now INSERT a draft version DIRECTLY for their own
--     commission — the regression that failed before the (E) policy fix.
select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;

-- A draft form (created via the RPC) to insert a sibling version under.
create temp table authz_form on commit drop as
  select form_id from public.create_form(
    (select (v->>'comm_x')::uuid from ctx), 'Authz form', null
  );

select lives_ok(
  format($$ insert into public.form_versions (form_id, version_number, status)
            values (%L, 2, 'draft') $$,
         (select form_id from authz_form)),
  'staff_admin can directly INSERT a draft version for their own commission (policy fix)'
);

-- (b) A foreign staff_admin (sa_y, commission Y) cannot create_form in X.
reset role;
select test_helpers.claims_for((select (v->>'sa_y')::uuid from ctx), false);
set local role authenticated;

select throws_ok(
  format($$ select public.create_form(%L, 'X form by Y admin', null) $$,
         (select (v->>'comm_x')::uuid from ctx)),
  '42501',
  null,
  'a staff_admin of another commission cannot create_form in commission X'
);

-- (c) A foreign staff_admin cannot clone X's published version.
select throws_ok(
  format($$ select public.clone_form_version(%L) $$,
         (select (v->>'ver_s')::uuid from ctx)),
  null,
  null,
  'a staff_admin of another commission cannot clone X''s version'
);

-- (d) A plain staff member of X cannot create_form (not a staff_admin).
reset role;
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;

select throws_ok(
  format($$ select public.create_form(%L, 'X form by staff', null) $$,
         (select (v->>'comm_x')::uuid from ctx)),
  '42501',
  null,
  'a plain staff member cannot create_form'
);

reset role;

select * from finish();
rollback;
