-- FF-1 (ADR 0087 + Amendment 1) — Repeating Groups keystones.
--
-- EVERY assertion here is MUTATION-PROVEN: the comment above each section names
-- the exact change that makes it go red. A keystone that cannot fail is not a
-- keystone (ADR 0079). `qa` should be able to re-run any proof from the note
-- alone, without reconstructing the reasoning.
--
-- The dual-evaluator parity for the instance-aware map lives in
-- 20_conditions.sql (SQL side) + src/lib/queries/conditions.test.ts (TS side),
-- sharing __fixtures__/instance-map-vectors.json. Drift is phase-blocking
-- (Rule 3). 209_flexible_forms.sql keeps §B (matrix/risk/reference stay
-- never-required) and §C (the SIX write-inert tables) pinned — note that
-- `response_group_instances` is deliberately NOT one of the six: it is
-- authenticated=arwdDxtm under a FOR ALL own-draft policy, which is why FF-1's
-- writers are INVOKER and the plan's `rls_group_instances_reader_non_writer`
-- keystone is recorded not-applicable (ADR 0087 ruling 5).

begin;

select plan(53);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'org_b')::uuid  as org_b
  from ctx;
grant select on k to authenticated;

-- ===========================================================================
-- §0 · THE FLAG. Asserted, never forced.
--   A fixture that silently leaves `repeating_groups` OFF makes every
--   flag-guarded keystone below raise HC0N0 instead of testing anything, while
--   the suite still reports a total (the pgtap-fixture-flag-gaps scar). Forcing
--   the flag here would make this assertion vacuous, so it asserts the SEED.
--   MUTATION: remove the `repeating_groups` line from supabase/seed.sql -> red.
-- ===========================================================================
select ok(
  app.feature_enabled('repeating_groups'),
  '0a. flag repeating_groups is ON (seed.sql) — every keystone below depends on it'
);

-- ---------------------------------------------------------------------------
-- Fixtures: a draft version in comm_x holding, in one section and in position
-- order: a top-level gate, a repeating group + its two children, a plain group
-- + its required child, and a conditional+required top-level item.
-- ---------------------------------------------------------------------------
insert into public.forms (id, commission_id, title, created_by)
  values ('ff100000-0000-0000-0000-000000000001', (select comm_x from k), 'FF1', (select sa_x from k));
insert into public.form_versions (id, form_id, version_number, status)
  values ('ff100000-0000-0000-0000-000000000002', 'ff100000-0000-0000-0000-000000000001', 1, 'draft');
insert into public.form_sections (id, form_version_id, position, is_default)
  values ('ff100000-0000-0000-0000-000000000003', 'ff100000-0000-0000-0000-000000000002', 0, true);

-- pos 0 — the gate every condition below reads.
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff100000-0000-0000-0000-000000000010', 'ff100000-0000-0000-0000-000000000003', 0, 'short_text', 'porta', 'Porta');
-- pos 1 — a repeating group (min 2, max 3), conditional on the gate.
insert into public.form_items (id, section_id, position, item_type, label, config, visible_when)
  values ('ff100000-0000-0000-0000-000000000011', 'ff100000-0000-0000-0000-000000000003', 1, 'repeating_group', 'Medicamentos',
          '{"minInstances":2,"maxInstances":3}'::jsonb,
          '{"question_key":"porta","op":"equals","value":"sim"}'::jsonb);
-- pos 2,3 — its children; the second is conditional on the first (INSIDE-OUT).
insert into public.form_items (id, section_id, position, item_type, question_key, label, parent_item_id, required)
  values ('ff100000-0000-0000-0000-000000000012', 'ff100000-0000-0000-0000-000000000003', 2, 'short_text', 'med_nome', 'Nome', 'ff100000-0000-0000-0000-000000000011', true);
insert into public.form_items (id, section_id, position, item_type, question_key, label, parent_item_id, required, visible_when)
  values ('ff100000-0000-0000-0000-000000000013', 'ff100000-0000-0000-0000-000000000003', 3, 'short_text', 'med_dose', 'Dose', 'ff100000-0000-0000-0000-000000000011', true,
          '{"question_key":"med_nome","op":"equals","value":"Dipirona"}'::jsonb);
-- pos 4 — a CHOICE child of the repeating group. Load-bearing for §K: a
-- short_text child leaves NO `answer_selected_options` row, so a keystone built
-- only on short_text children cannot observe selections being lost (P0-1).
insert into public.form_items (id, section_id, position, item_type, question_key, label, parent_item_id)
  values ('ff100000-0000-0000-0000-000000000017', 'ff100000-0000-0000-0000-000000000003', 4, 'multiple_choice', 'med_via', 'Via', 'ff100000-0000-0000-0000-000000000011');
insert into public.form_item_options (item_id, position, code, label) values
  ('ff100000-0000-0000-0000-000000000017', 0, 'oral', 'Oral'),
  ('ff100000-0000-0000-0000-000000000017', 1, 'ev', 'Endovenosa');
-- pos 5,6 — a PLAIN group and its REQUIRED child (Amendment 1.2's guard).
insert into public.form_items (id, section_id, position, item_type, label)
  values ('ff100000-0000-0000-0000-000000000014', 'ff100000-0000-0000-0000-000000000003', 5, 'group', 'Dados gerais');
insert into public.form_items (id, section_id, position, item_type, question_key, label, parent_item_id, required)
  values ('ff100000-0000-0000-0000-000000000015', 'ff100000-0000-0000-0000-000000000003', 6, 'short_text', 'geral', 'Geral', 'ff100000-0000-0000-0000-000000000014', true);
-- pos 7 — CONDITIONAL **and** REQUIRED at top level (unauthorable before ruling 4).
insert into public.form_items (id, section_id, position, item_type, question_key, label, required, visible_when)
  values ('ff100000-0000-0000-0000-000000000016', 'ff100000-0000-0000-0000-000000000003', 7, 'short_text', 'extra', 'Extra', true,
          '{"question_key":"porta","op":"equals","value":"sim"}'::jsonb);

-- ===========================================================================
-- §A · ruling 1 — the depth-1 cap, in TWO separate objects.
--   MUTATION A1: revert form_items_parent_item_id_fkey to the single-column
--     (parent_item_id) -> (id) FK -> A1 goes green when it must be red.
--   MUTATION A2: drop form_items_no_nested_container -> A2 goes red.
--   They are asserted separately ON PURPOSE: with one object doing both jobs,
--   either keystone could pass on the other's strength (ADR 0079's vacuity trap).
-- ===========================================================================
select throws_ok(
  $$insert into public.form_items (section_id, position, item_type, question_key, label, parent_item_id)
    values ('ff100000-0000-0000-0000-000000000003', 90, 'short_text', 'orfa', 'Órfã', 'ff100000-0000-0000-0000-000000000010')$$,
  '23503',
  null,
  'A1. a child under a NON-container parent is rejected by the composite parent FK'
);

select throws_ok(
  $$insert into public.form_items (section_id, position, item_type, label, parent_item_id)
    values ('ff100000-0000-0000-0000-000000000003', 91, 'group', 'Aninhado', 'ff100000-0000-0000-0000-000000000011')$$,
  '23514',
  null,
  'A2. a container INSIDE a container is rejected (nesting capped at depth 1)'
);

select is(
  (select count(*)::int from public.form_items
    where parent_item_id = 'ff100000-0000-0000-0000-000000000011'),
  3, 'A3. …while legitimate children of a repeating group insert normally'
);

-- ===========================================================================
-- §B · container shape (BE-1). `question_key IS NULL` is what makes a container
--   invisible to every question_key-keyed path (answer_map, the dashboard
--   explode, condition targets, submit_response's item filter) by construction.
--   MUTATION: drop `question_key is null` / `label is not null` from the
--     group arm of form_items_input_vs_display -> B1 / B2 go red.
-- ===========================================================================
select throws_ok(
  $$insert into public.form_items (section_id, position, item_type, question_key, label)
    values ('ff100000-0000-0000-0000-000000000003', 92, 'repeating_group', 'chave', 'Com chave')$$,
  '23514',
  null,
  'B1. a container may NOT carry a question_key'
);

select throws_ok(
  $$insert into public.form_items (section_id, position, item_type)
    values ('ff100000-0000-0000-0000-000000000003', 93, 'repeating_group')$$,
  '23514',
  null,
  'B2. a container MUST carry a label'
);

select is(
  (select question_key from public.form_items where id = 'ff100000-0000-0000-0000-000000000011'),
  null, 'B3. the fixture container really does hold a NULL question_key'
);

-- ===========================================================================
-- §C · ruling 4 — conditional AND required, platform-wide.
--   The `visible_when IS NULL OR required = false` CHECK made this combination
--   UNCONSTRUCTIBLE, which is why app.response_required_complete's
--   "a per-item condition can hide a required item" branch was dead code.
--   MUTATION: re-add form_items_conditional_not_required -> the fixture inserts
--     at pos 3, 6 fail and this whole suite cannot even load. That IS the proof.
-- ===========================================================================
select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.form_items'::regclass
      and conname = 'form_items_conditional_not_required'),
  0, 'C1. form_items_conditional_not_required is gone (ruling 4)'
);

select is(
  (select count(*)::int from public.form_items
    where form_version_id = 'ff100000-0000-0000-0000-000000000002'
      and required = true and visible_when is not null),
  2, 'C2. two conditional+required items exist — unauthorable before FF-1'
);

-- ===========================================================================
-- §D · publish-time layout gate (app.validate_group_layout).
--   PUBLISH-time and not a trigger, deliberately: a draft mid-edit legitimately
--   passes through non-contiguous states while the builder shifts positions.
--   MUTATION: remove the `perform app.validate_group_layout(...)` call from
--     publish_form_version, or the contiguity branch from the function -> D2 red.
-- ===========================================================================
select ok(
  app.validate_group_layout('ff100000-0000-0000-0000-000000000002'),
  'D1. the contiguous fixture layout passes the gate'
);

savepoint d2;
update public.form_items set position = 40
  where id = 'ff100000-0000-0000-0000-000000000013';
select throws_ok(
  $$select app.validate_group_layout('ff100000-0000-0000-0000-000000000002')$$,
  '23514',
  null,
  'D2. a child moved away from its parent is rejected at publish'
);
rollback to d2;

savepoint d3;
insert into public.form_items (id, section_id, position, item_type, label)
  values ('ff100000-0000-0000-0000-000000000099', 'ff100000-0000-0000-0000-000000000003', 50, 'repeating_group', 'Vazio');
select throws_ok(
  $$select app.validate_group_layout('ff100000-0000-0000-0000-000000000002')$$,
  '23514',
  null,
  'D3. a container with no questions at all is rejected at publish'
);
rollback to d3;

-- ===========================================================================
-- §E · ruling 2 — inside-out resolves, outside-in is forbidden.
--   The THREE positives are not padding: a validator that rejected everything
--   would satisfy E2/E4/E5 while breaking every legal form. E1/E3 are what stop
--   the ban from being vacuously strict.
--   MUTATION: delete either `if v_ref_group is not null …` block from
--     validate_visible_when -> E2 (item arm) / E4 (section arm) go red.
-- ===========================================================================
select ok(
  public.validate_visible_when('ff100000-0000-0000-0000-000000000002'),
  'E1. INSIDE-OUT: med_dose conditional on its same-group sibling med_nome publishes'
);

savepoint e2;
update public.form_items set visible_when = '{"question_key":"med_nome","op":"equals","value":"x"}'::jsonb
  where id = 'ff100000-0000-0000-0000-000000000016';
select throws_ok(
  $$select public.validate_visible_when('ff100000-0000-0000-0000-000000000002')$$,
  '23514',
  null,
  'E2. OUTSIDE-IN: a top-level item may not target a repeating-group child'
);
rollback to e2;

savepoint e3;
update public.form_items set visible_when = '{"question_key":"geral","op":"equals","value":"x"}'::jsonb
  where id = 'ff100000-0000-0000-0000-000000000016';
select ok(
  public.validate_visible_when('ff100000-0000-0000-0000-000000000002'),
  'E3. a PLAIN-group child stays a legal target from outside (ruling 6)'
);
rollback to e3;

savepoint e4;
insert into public.form_sections (id, form_version_id, position, is_default, title, visible_when)
  values ('ff100000-0000-0000-0000-000000000004', 'ff100000-0000-0000-0000-000000000002', 1, false, 'S2',
          '{"question_key":"med_nome","op":"equals","value":"x"}'::jsonb);
select throws_ok(
  $$select public.validate_visible_when('ff100000-0000-0000-0000-000000000002')$$,
  '23514',
  null,
  'E4. a SECTION condition may not target a repeating-group child'
);
rollback to e4;

savepoint e5;
insert into public.form_items (id, section_id, position, item_type, label)
  values ('ff100000-0000-0000-0000-000000000020', 'ff100000-0000-0000-0000-000000000003', 60, 'repeating_group', 'Bloco B');
insert into public.form_items (id, section_id, position, item_type, question_key, label, parent_item_id, visible_when)
  values ('ff100000-0000-0000-0000-000000000021', 'ff100000-0000-0000-0000-000000000003', 61, 'short_text', 'b_x', 'BX', 'ff100000-0000-0000-0000-000000000020',
          '{"question_key":"med_nome","op":"equals","value":"x"}'::jsonb);
select throws_ok(
  $$select public.validate_visible_when('ff100000-0000-0000-0000-000000000002')$$,
  '23514',
  null,
  'E5. CROSS-GROUP: group B may not target a child of group A'
);
rollback to e5;

-- ---------------------------------------------------------------------------
-- A draft response owned by st_x, for the instance/fill keystones.
-- ---------------------------------------------------------------------------
insert into public.responses (id, form_version_id, commission_id, created_by, status)
  values ('ff100000-0000-0000-0000-000000000030', 'ff100000-0000-0000-0000-000000000002', (select comm_x from k), (select st_x from k), 'in_progress');
insert into public.answers (response_id, item_id, question_key, value)
  values ('ff100000-0000-0000-0000-000000000030', 'ff100000-0000-0000-0000-000000000010', 'porta', '"sim"'),
         ('ff100000-0000-0000-0000-000000000030', 'ff100000-0000-0000-0000-000000000015', 'geral', '"ok"'),
         ('ff100000-0000-0000-0000-000000000030', 'ff100000-0000-0000-0000-000000000016', 'extra', '"x"');

-- ===========================================================================
-- §F · the instance RPCs (ruling 5 — INVOKER correctness doors under RLS).
--   MUTATION F2: drop the maxInstances branch from add_group_instance -> red.
--   MUTATION F3: replace reorder's deferred window with a single naive UPDATE
--     -> F3 raises 23505 instead of succeeding -> red. This is the one the
--     DEFERRABLE constraint change exists for.
--   MUTATION F4: relax the permutation check to a subset test -> F4 red.
--   MUTATION F5: drop the re-pack UPDATE from remove_group_instance -> F5 red.
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;

create temp table inst on commit drop as
  select (public.add_group_instance('ff100000-0000-0000-0000-000000000030','ff100000-0000-0000-0000-000000000011')).id as id, 0 as ord
  union all
  select (public.add_group_instance('ff100000-0000-0000-0000-000000000030','ff100000-0000-0000-0000-000000000011')).id, 1
  union all
  select (public.add_group_instance('ff100000-0000-0000-0000-000000000030','ff100000-0000-0000-0000-000000000011')).id, 2;
grant select on inst to authenticated;

select is(
  (select string_agg(position::text, ',' order by position)
     from public.response_group_instances where response_id = 'ff100000-0000-0000-0000-000000000030'),
  '0,1,2', 'F1. three adds land at contiguous positions 0,1,2'
);

select throws_ok(
  $$select public.add_group_instance('ff100000-0000-0000-0000-000000000030','ff100000-0000-0000-0000-000000000011')$$,
  'HC0N1',
  null,
  'F2. a fourth add is refused — maxInstances = 3'
);

-- The collision case: 0,1,2 -> 1,0,2 swaps two positions that both already exist.
select lives_ok(
  $$select public.reorder_group_instances(
      'ff100000-0000-0000-0000-000000000030','ff100000-0000-0000-0000-000000000011',
      array[(select id from inst where ord = 1), (select id from inst where ord = 0), (select id from inst where ord = 2)])$$,
  'F3. reorder 0,1,2 -> 1,0,2 succeeds (the deferred-unique window)'
);

select is(
  (select position from public.response_group_instances where id = (select id from inst where ord = 1)),
  0, 'F3b. …and the swap actually took effect'
);

select throws_ok(
  $$select public.reorder_group_instances(
      'ff100000-0000-0000-0000-000000000030','ff100000-0000-0000-0000-000000000011',
      array[(select id from inst where ord = 0)])$$,
  'HC0N3',
  null,
  'F4. a reorder list that is not a PERMUTATION is refused'
);

-- ===========================================================================
-- §G · the save arm + the substrate-6 clear fix.
--   MUTATION G1: point the instance upsert at answers_uq_top -> G1 red.
--   MUTATION G2: restore the UNSCOPED p_clear_item_ids delete -> G2 red.
--     G2 asserts the SIBLING SURVIVES, not merely that the call succeeded.
-- ===========================================================================
select public.save_section_answers(
  'ff100000-0000-0000-0000-000000000030', 'ff100000-0000-0000-0000-000000000003',
  '{}'::jsonb, null, null, null, null,
  jsonb_build_array(
    jsonb_build_object('instance_id', (select id from inst where ord = 0),
                       'answers', jsonb_build_object('ff100000-0000-0000-0000-000000000012', '"Dipirona"'::jsonb,
                                                     'ff100000-0000-0000-0000-000000000013', '"500mg"'::jsonb)),
    jsonb_build_object('instance_id', (select id from inst where ord = 1),
                       'answers', jsonb_build_object('ff100000-0000-0000-0000-000000000012', '"Amoxicilina"'::jsonb))
  )
);

select is(
  (select count(distinct a.value)::int from public.answers a
    where a.response_id = 'ff100000-0000-0000-0000-000000000030'
      and a.item_id = 'ff100000-0000-0000-0000-000000000012'
      and a.group_instance_id is not null),
  2, 'G1. the SAME item holds DIFFERENT values in two instances'
);

-- ADR 0087 substrate correction 5, asserted DIRECTLY. `app.answer_map` had NO
-- group_instance_id filter at all, so with two instances answering `med_nome`
-- the TOP-LEVEL map silently absorbed one of them (jsonb_object_agg last-wins for
-- scalars; the group-by CTEs merge checkbox codes across instances). Nine call
-- sites read that map. This is the state that exposes it: two instances, two
-- different values, one key.
--   MUTATION: drop the `is not distinct from` filter from app.answer_map_scoped
--     -> red. Added AFTER the mutation run showed the regression was caught only
--     indirectly (via I3/K3), which is a poor diagnostic for the defect it is.
select ok(
  not (app.answer_map('ff100000-0000-0000-0000-000000000030') ? 'med_nome'),
  'G1b. the TOP-LEVEL answer map excludes instance answers entirely (substrate 5)'
);

select public.save_section_answers(
  'ff100000-0000-0000-0000-000000000030', 'ff100000-0000-0000-0000-000000000003',
  '{}'::jsonb, array['ff100000-0000-0000-0000-000000000012']::uuid[]
);

select is(
  (select count(*)::int from public.answers
    where response_id = 'ff100000-0000-0000-0000-000000000030'
      and item_id = 'ff100000-0000-0000-0000-000000000012'
      and group_instance_id is not null),
  2, 'G2. a TOP-LEVEL clear leaves both instances'' answers intact (substrate 6)'
);

select public.save_section_answers(
  'ff100000-0000-0000-0000-000000000030', 'ff100000-0000-0000-0000-000000000003',
  '{}'::jsonb, null, null, null, null,
  jsonb_build_array(jsonb_build_object(
    'instance_id', (select id from inst where ord = 1),
    'clear_item_ids', jsonb_build_array('ff100000-0000-0000-0000-000000000012')))
);

select is(
  (select count(*)::int from public.answers
    where response_id = 'ff100000-0000-0000-0000-000000000030'
      and item_id = 'ff100000-0000-0000-0000-000000000012'
      and group_instance_id is not null),
  1, 'G2b. an INSTANCE clear removes only that instance''s answer'
);

-- ===========================================================================
-- §H · the two completeness authorities (BE-5).
--   MUTATION H1: break visibility-wins (check required before visibility) -> red.
--   MUTATION H2: take substrate 4 literally (exclude every parent_item_id IS NOT
--     NULL from the flat arm) -> H2 goes green when it must be red. This is
--     Amendment 1.2's guard.
--   MUTATION H4: move the minInstances check BEFORE the prune -> H4 red.
--   MUTATION H5: make response_required_complete disagree with submit_response
--     in any way -> H5 red.
-- ===========================================================================
-- State entering §H, after §G: instance 0 = {med_nome, med_dose}; instance 1 was
-- emptied by the instance-scoped clear (G2b); instance 2 was never filled.
-- So exactly ONE instance is non-empty, against minInstances = 2.
reset role;
select set_config('request.jwt.claims', null, true);

select ok(
  not app.response_required_complete('ff100000-0000-0000-0000-000000000030'),
  'H4a. one non-empty + two EMPTY instances does not satisfy minInstances = 2'
);

-- Refill instance 1 -> exactly TWO non-empty, one still empty.
-- This must happen BEFORE H1/H2: with the group still incomplete, H2 would go
-- red for the group''s reason rather than the plain-group child''s, and would
-- pass while proving nothing (the vacuity trap ADR 0079 warns about).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.save_section_answers(
  'ff100000-0000-0000-0000-000000000030', 'ff100000-0000-0000-0000-000000000003',
  '{}'::jsonb, null, null, null, null,
  jsonb_build_array(jsonb_build_object(
    'instance_id', (select id from inst where ord = 1),
    'answers', jsonb_build_object('ff100000-0000-0000-0000-000000000012', '"Amoxicilina"'::jsonb)))
);
reset role;
select set_config('request.jwt.claims', null, true);

select ok(
  app.response_required_complete('ff100000-0000-0000-0000-000000000030'),
  'H3. two non-empty instances satisfy minInstances = 2 (the empty third is skipped, not counted)'
);

-- A CHOICE selection inside instance 0, so §K has a selection to lose. Written
-- through the real save path (instance arm), not inserted, so the row is exactly
-- what the wizard would produce.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.save_section_answers(
  'ff100000-0000-0000-0000-000000000030', 'ff100000-0000-0000-0000-000000000003',
  '{}'::jsonb, null, null, null, null,
  jsonb_build_array(jsonb_build_object(
    'instance_id', (select id from inst where ord = 0),
    'selections', jsonb_build_object('ff100000-0000-0000-0000-000000000017', jsonb_build_array('ev'))))
);
reset role;
select set_config('request.jwt.claims', null, true);

select is(
  (select count(*)::int
     from public.answer_selected_options aso
     join public.answers a on a.id = aso.answer_id
    where a.response_id = 'ff100000-0000-0000-0000-000000000030'
      and a.group_instance_id is not null),
  1, 'H3b. the instance carries a CHOICE selection before submit (the row §K must preserve)'
);

-- ---------------------------------------------------------------------------
-- H1 — ruling 4's headline deadlock-negative, REBUILT (qa MAJOR-1).
--
-- The previous H1 only closed the gate and asserted `rrc` was true. That passed
-- while proving NOTHING: `extra` was answered and the group already held 2
-- non-empty instances against min = 2, so the response was complete whether or
-- not visibility was honoured. qa broke the visibility branch in THREE places
-- and the suite stayed 46/46. The branch was load-bearing; the TEST was not.
--
-- Rebuilt so visibility is the ONLY variable. Every other blocker is switched
-- ON first — `extra` unanswered, the group emptied below min — so the response
-- is genuinely incomplete (H1a proves that, and is what stops H1b from passing
-- vacuously). Then the gate alone flips, and H1b must go from false to true
-- purely because both are now hidden.
-- ---------------------------------------------------------------------------
savepoint h1;
-- Arm both blockers.
delete from public.answers
  where response_id = 'ff100000-0000-0000-0000-000000000030'
    and item_id = 'ff100000-0000-0000-0000-000000000016';   -- `extra` unanswered
delete from public.response_group_instances
  where response_id = 'ff100000-0000-0000-0000-000000000030';  -- 0 of min 2

select ok(
  not app.response_required_complete('ff100000-0000-0000-0000-000000000030'),
  'H1a. gate OPEN: the conditional+required item and the unmet minInstances both really do block (the anti-vacuity twin for H1b)'
);

update public.answers set value = '"nao"'
  where response_id = 'ff100000-0000-0000-0000-000000000030'
    and item_id = 'ff100000-0000-0000-0000-000000000010';

select ok(
  app.response_required_complete('ff100000-0000-0000-0000-000000000030'),
  'H1b. gate CLOSED: VISIBILITY ALONE flips it to complete — a hidden required item is not required and a hidden group is not checked (ruling 4 + ruling 3)'
);
rollback to h1;

-- H1c — the same rule in the OTHER authority. submit_response has its own
-- hidden-container branch, and qa neutralised it without turning the suite red.
-- With the group hidden and unsatisfiable, submit must still SUCCEED.
savepoint h1c;
delete from public.response_group_instances
  where response_id = 'ff100000-0000-0000-0000-000000000030';
update public.answers set value = '"nao"'
  where response_id = 'ff100000-0000-0000-0000-000000000030'
    and item_id = 'ff100000-0000-0000-0000-000000000010';
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  $$select public.submit_response('ff100000-0000-0000-0000-000000000030')$$,
  'H1c. submit_response skips a HIDDEN repeating group entirely — no HC0N5 for a group the author cannot see'
);
reset role;
select set_config('request.jwt.claims', null, true);
rollback to h1c;

savepoint h2;
delete from public.answers
  where response_id = 'ff100000-0000-0000-0000-000000000030'
    and item_id = 'ff100000-0000-0000-0000-000000000015';
select ok(
  not app.response_required_complete('ff100000-0000-0000-0000-000000000030'),
  'H2. a required child of a PLAIN group still blocks — with the group complete, this is the ONLY remaining cause (Amendment 1.2)'
);
rollback to h2;

select is(
  (select count(*)::int from public.response_group_instances
    where response_id = 'ff100000-0000-0000-0000-000000000030'),
  3, 'H4b. …and the empty instance is still present BEFORE submit'
);

-- ===========================================================================
-- §I · submit — prune, re-pack, and post-submit immutability.
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  $$select public.submit_response('ff100000-0000-0000-0000-000000000030')$$,
  'I1. submit succeeds — rrc said complete and submit agrees (completeness_authorities_agree)'
);
reset role;
select set_config('request.jwt.claims', null, true);

select is(
  (select string_agg(position::text, ',' order by position)
     from public.response_group_instances where response_id = 'ff100000-0000-0000-0000-000000000030'),
  '0,1', 'I2. the zero-answer instance was PRUNED and positions re-packed (ruling 3)'
);

select is(
  (select count(*)::int from public.answers
    where response_id = 'ff100000-0000-0000-0000-000000000030'
      and item_id = 'ff100000-0000-0000-0000-000000000013'),
  1, 'I3. the per-instance conditional child kept only the instance where its condition held (med_nome = Dipirona)'
);

-- MUTATION: drop guard_submitted_group_instances_trg -> I4 goes red.
select throws_ok(
  $$insert into public.response_group_instances (response_id, group_item_id, position)
    values ('ff100000-0000-0000-0000-000000000030','ff100000-0000-0000-0000-000000000011', 9)$$,
  '23514',
  null,
  'I4. instances of a SUBMITTED response are immutable'
);

-- ===========================================================================
-- §J · RLS is the boundary (ruling 5). The RPCs add NO authority.
--   MUTATION: widen response_group_instances_write_own_draft's qual to drop
--     `created_by = auth.uid()` -> J1b goes red. Asserted by attempting the WRITE
--     as another user and requiring it to fail — never by reading a predicate's
--     return value (the ETH·E1 lesson).
--
--   qa MAJOR-2: J1 alone was passing for the WRONG REASON. `st_x2` is an
--   ordinary `staff`, and the responses SELECT policy already hides a foreign
--   draft from them — so the insert failed on the READ, and dropping
--   `created_by = auth.uid()` from the write qual left the suite 46/46.
--   A reader-non-writer keystone needs a persona that genuinely CAN READ the row:
--   `is_tenancy_admin_of` is org_admin/hospital_admin (NOT staff_admin — qa
--   confirmed sa_x reads 0 foreign instances), so §J now mints an org_admin.
--   J1a establishes the read; J1b is then unambiguously about the WRITE qual.
-- ===========================================================================
insert into public.responses (id, form_version_id, commission_id, created_by, status)
  values ('ff100000-0000-0000-0000-000000000031', 'ff100000-0000-0000-0000-000000000002', (select comm_x from k), (select st_x from k), 'in_progress');
-- st_x's draft holds an instance, so "cannot write" is not trivially "nothing there".
insert into public.response_group_instances (id, response_id, group_item_id, position)
  values ('ff100000-0000-0000-0000-000000000032', 'ff100000-0000-0000-0000-000000000031', 'ff100000-0000-0000-0000-000000000011', 0);

-- An org_admin of the fixture org: satisfies the SELECT policy's
-- is_tenancy_admin_of arm, but is NOT the draft's creator.
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', 'ff100000-0000-0000-0000-0000000000a1',
          'authenticated', 'authenticated', 'ff1-orgadmin@test', now(), now());
update public.profiles
  set full_name = 'OrgAdmin FF1', home_organization_id = (select org_b from k)
  where id = 'ff100000-0000-0000-0000-0000000000a1';
insert into public.memberships (organization_id, principal_id, role)
  values ((select org_b from k), 'ff100000-0000-0000-0000-0000000000a1', 'org_admin');

select test_helpers.claims_for('ff100000-0000-0000-0000-0000000000a1'::uuid, false);
set local role authenticated;

-- ⛔ INVERTED BY QO·B (20260915) — and this inversion DEMOLISHES J1b's premise.
-- ADR 0100 D12 removed the tenancy-admin arm from the response plane, so the
-- org_admin minted above no longer reads a foreign draft at all.
select is(
  (select count(*)::int from public.response_group_instances
    where response_id = 'ff100000-0000-0000-0000-000000000031'),
  0, 'J1a. QO·B WALL: an org_admin can NO LONGER read another member''s draft instances (D12; was 1 before the wall)'
);

-- ⚠⚠ J1b IS NOW VACUOUS — ANNOTATED, NOT DELETED (A2 precedent), AND FILED AS
--    FUP-QOB-1 rather than quietly left green.
--
-- This is qa MAJOR-2 reappearing through the front door. Its own header (above)
-- records that J1 once passed for the WRONG REASON with a plain `staff`: the insert
-- failed on the READ, because write_own_draft's WITH CHECK subquery reads
-- public.responses UNDER RLS, so a caller who cannot SEE the parent row yields
-- `exists = false` no matter what the `created_by = auth.uid()` term says. An
-- org_admin was minted precisely to escape that — is_tenancy_admin_of was the only
-- reader-non-writer available.
--
-- QO·B removes it, and NO REPLACEMENT EXISTS. Post-M1 the readers of an in_progress
-- response's instances are exactly {creator, targeted respondent}, and BOTH are
-- writers (can_write_targeted_response = can_access_targeted_response AND
-- in_progress). The one other reader — staff_admin on a SUBMITTED response — is
-- blocked first by the immutability trigger (23514, see I4), which proves
-- immutability, not the write qual.
--
-- CONSEQUENCE, worth a ruling: `created_by = auth.uid()` in
-- response_group_instances_write_own_draft is no longer INDEPENDENTLY OBSERVABLE —
-- the read surface of an in-progress response now coincides exactly with its write
-- surface. That is a STRONGER property than the one this keystone pinned, but it is
-- not the property the keystone claims to pin. Deleting the term would leave this
-- suite green; the guard against that must be relocated, not assumed.
--
-- ➜ RELOCATED (FUP-QOB-1, 2026-08-09, PROVISIONAL pending PO ratification): the
--   guard now lives in J1c below — an executable CATALOG PIN on the policy's
--   qual/with_check text, red-proven by the b1 mutation audit
--   (fup_qob1_drop_created_by: dropping the term reds J1c while J1b stays green,
--   which DEMONSTRATES this annotation's vacuity claim in the same run). J1b is
--   KEPT as-annotated (A2 precedent: annotate, never delete).
select throws_ok(
  $$insert into public.response_group_instances (response_id, group_item_id, position)
    values ('ff100000-0000-0000-0000-000000000031','ff100000-0000-0000-0000-000000000011', 5)$$,
  '42501',
  null,
  'J1b. [VACUOUS SINCE QO·B — FUP-QOB-1] denies, but now via invisibility of the parent, NOT via the write qual (reader-non-writer no longer constructible)'
);

reset role;
select set_config('request.jwt.claims', null, true);

-- ⭐ J1c — FUP-QOB-1: the STRUCTURAL PIN that replaces J1b's collapsed behavioural
-- surface. [PROVISIONAL — accepted pending PO ratification of FUP-QOB-1.]
--
-- Post-QO·B no reader-non-writer persona EXISTS for this policy (J1b's header): the
-- read surface of an in-progress response's instances coincides exactly with its
-- write surface, so `created_by = auth.uid()` cannot be isolated behaviourally.
-- This pin is the strongest guard available WITHOUT inventing a persona: it asserts,
-- from the LIVE CATALOG, that the policy (a) still exists on
-- response_group_instances, FOR ALL, to authenticated, and (b) still carries the
-- `created_by = auth.uid()` term in BOTH its USING and WITH CHECK halves. A
-- structural assertion cannot substitute for a behavioural one (QO·B's own lesson) —
-- but where the behavioural surface has COLLAPSED, an executable catalog pin beats
-- an annotation alone: deleting the term reds THIS test (red-proven by the b1
-- mutation audit's fup_qob1_drop_created_by case, which also shows J1b staying
-- green under the same deletion — the vacuity claim, demonstrated); dropping or
-- renaming the policy fails the count closed, no mutation needed.
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public'
      and tablename  = 'response_group_instances'
      and policyname = 'response_group_instances_write_own_draft'
      and cmd = 'ALL'
      and 'authenticated' = any(roles)
      and coalesce(qual, '')       ~ 'created_by = auth\.uid\(\)'
      and coalesce(with_check, '') ~ 'created_by = auth\.uid\(\)'),
  1,
  'J1c. [FUP-QOB-1 STRUCTURAL PIN — PROVISIONAL] write_own_draft still exists, FOR ALL to authenticated, and carries created_by = auth.uid() in BOTH qual and with_check'
);

select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;

select throws_ok(
  $$insert into public.response_group_instances (response_id, group_item_id, position)
    values ('ff100000-0000-0000-0000-000000000031','ff100000-0000-0000-0000-000000000011', 0)$$,
  '42501',
  null,
  'J1. another member cannot write an instance into someone else''s draft (RLS)'
);

-- The RPC refuses too — but with `no_data_found`, NOT the HC0N2 creator error,
-- because the responses SELECT policy hides another member's draft outright: the
-- RPC's own lookup returns nothing, so it never reaches the creator comparison.
-- That is the STRONGER outcome (no existence leak), and asserting the code that
-- actually fires is the point — expecting HC0N2 here would have passed only if
-- RLS had let the row through.
select throws_ok(
  $$select public.add_group_instance('ff100000-0000-0000-0000-000000000031','ff100000-0000-0000-0000-000000000011')$$,
  'P0002',
  null,
  'J2. …and the RPC cannot even see the foreign draft (no existence leak)'
);

reset role;
select set_config('request.jwt.claims', null, true);

-- ===========================================================================
-- §K · Amendment 1.3 — the correction paths copy the INSTANCE ROWS.
--   Before FF-1 both copied answers.group_instance_id VERBATIM, so a correction
--   pointed at the predecessor's instances — frozen by the submit guard and
--   cascade-deleted with the predecessor.
--   MUTATION: delete the instance-copy CTE from supersede_response -> K1 red
--     (the successor would share the predecessor's instance ids) and K2 red.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table succ on commit drop as
  select (public.supersede_response('ff100000-0000-0000-0000-000000000030', 'correção de teste')).id as id;
grant select on succ to authenticated;
reset role;
select set_config('request.jwt.claims', null, true);

select is(
  (select count(*)::int from public.response_group_instances where response_id = (select id from succ)),
  2, 'K1. the correction draft gets its OWN instance rows'
);

select is(
  (select count(*)::int
     from public.answers a
     join public.response_group_instances gi on gi.id = a.group_instance_id
    where a.response_id = (select id from succ)
      and gi.response_id <> (select id from succ)),
  0, 'K2. …and NO copied answer still points at the predecessor''s instances'
);

select is(
  (select count(*)::int from public.answers
    where response_id = (select id from succ) and group_instance_id is not null),
  4, 'K3. every instance-scoped answer was copied (2x med_nome + med_dose + med_via)'
);

-- K4 — qa P0-1. K1-K3 count `answers` rows ONLY, and the original fixture used
-- short_text children exclusively, so no selection ever existed to be lost:
-- the keystone I was asked for was structurally blind to the bug my own
-- Amendment 1.3 introduced. Assert the SELECTION survives, BY VALUE.
--   MUTATION: revert the selections join to
--     `new_a.group_instance_id is not distinct from old_a.group_instance_id`
--     -> K4 red (0 rows), while K1-K3 stay green. That gap IS the bug.
select results_eq(
  $$select o.code
      from public.answer_selected_options aso
      join public.answers a on a.id = aso.answer_id
      join public.form_item_options o on o.id = aso.option_id
     where a.response_id = (select id from succ)
       and a.group_instance_id is not null$$,
  $$values ('ev'::text)$$,
  'K4. the instance-scoped CHOICE selection survives the correction with its value intact (P0-1)'
);

-- ===========================================================================
-- §L · aggregation (BE-8). Supersession exclusion is INHERITED — group answers
--   are rows in `answers`, behind app.submitted_form_responses, not a new table.
--   MUTATION: remove the `not exists (… succ …)` clause from
--     app.submitted_form_responses -> L1 goes red.
-- ===========================================================================
-- Two assertions, because ONE would not discriminate. The SUP rule is
-- latest-SUBMITTED-in-chain: a merely in_progress correction must NOT blank the
-- metric, and only once it is submitted does the predecessor drop out. A bare
-- count would read 1 in both states and prove nothing, so assert the SET.
select is(
  (select count(*)::int from app.submitted_form_responses('ff100000-0000-0000-0000-000000000001')
    where id = 'ff100000-0000-0000-0000-000000000030'),
  1, 'L1a. an IN-PROGRESS correction does not remove the predecessor from the countable set'
);

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.submit_response((select id from succ));
reset role;
select set_config('request.jwt.claims', null, true);

select results_eq(
  $$select id from app.submitted_form_responses('ff100000-0000-0000-0000-000000000001')$$,
  $$select id from succ$$,
  'L1b. once the correction is SUBMITTED the predecessor (and its group answers) leaves the countable set, and only the correction counts'
);

select is(
  (select count(*)::int from public.form_items
    where form_version_id = 'ff100000-0000-0000-0000-000000000002'
      and item_type in ('group','repeating_group')
      and question_key is not null),
  0, 'L2. no container can ever reach a question_key-keyed projection'
);

-- ===========================================================================
-- §M · THE SIGN-OFF DOOR must carry the instance answers.
--   A staff_admin counter-signs on the strength of the review screen, which
--   renders exactly what `get_response_for_signoff` returns. With no `instances`
--   key the screen is silently missing every repeating-group answer and the
--   signer signs anyway — a governance artifact (Rule 4) attesting to evidence
--   the signer was never shown.
--   This is precisely the failure mode that passes every test which only checks
--   what IS rendered, so it is asserted on the DOOR'S PAYLOAD, not on a view.
--   MUTATION: remove the `instances` key from get_response_for_signoff -> M1 red.
--   MUTATION: drop the instance filter from app.answer_map_by_item_scoped -> M2
--     red (the two instances collide onto one item_id entry).
-- ===========================================================================
-- A SECOND, non-default section carries the sign-off requirement: the default
-- section may never require one (`form_sections_default_shape`). The door returns
-- every instance of the RESPONSE, not per section, so the group in section 1 is
-- what the signer must see.
insert into public.form_sections (id, form_version_id, position, is_default, title, requires_signoff, signoff_role)
  values ('ff100000-0000-0000-0000-00000000004f', 'ff100000-0000-0000-0000-000000000002', 1, false, 'Assinatura', true, 'staff_admin');

-- Created by st_x2, not st_x: `responses_one_draft_per_user_idx` allows ONE
-- in_progress draft per (version, user) and st_x already holds the §J draft.
insert into public.responses (id, form_version_id, commission_id, created_by, status)
  values ('ff100000-0000-0000-0000-000000000040', 'ff100000-0000-0000-0000-000000000002', (select comm_x from k), (select st_x2 from k), 'in_progress');
insert into public.answers (response_id, item_id, question_key, value)
  values ('ff100000-0000-0000-0000-000000000040', 'ff100000-0000-0000-0000-000000000010', 'porta', '"sim"');
insert into public.response_group_instances (id, response_id, group_item_id, position)
  values ('ff100000-0000-0000-0000-000000000041', 'ff100000-0000-0000-0000-000000000040', 'ff100000-0000-0000-0000-000000000011', 0),
         ('ff100000-0000-0000-0000-000000000042', 'ff100000-0000-0000-0000-000000000040', 'ff100000-0000-0000-0000-000000000011', 1);
insert into public.answers (response_id, item_id, question_key, value, group_instance_id)
  values ('ff100000-0000-0000-0000-000000000040', 'ff100000-0000-0000-0000-000000000012', 'med_nome', '"Dipirona"', 'ff100000-0000-0000-0000-000000000041'),
         ('ff100000-0000-0000-0000-000000000040', 'ff100000-0000-0000-0000-000000000012', 'med_nome', '"Amoxicilina"', 'ff100000-0000-0000-0000-000000000042');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

select is(
  (select jsonb_array_length(
     public.get_response_for_signoff('ff100000-0000-0000-0000-000000000040') -> 'instances'))::int,
  2, 'M1. the sign-off door exposes BOTH repeating-group instances to the signer'
);

select results_eq(
  $$select jsonb_agg(inst -> 'answers' ->> 'med_nome' order by (inst ->> 'position')::int)
      from jsonb_array_elements(
        public.get_response_for_signoff('ff100000-0000-0000-0000-000000000040') -> 'instances'
      ) inst$$,
  $$select '["Dipirona", "Amoxicilina"]'::jsonb$$,
  'M2. …each with ITS OWN answer, not one value collided across both'
);

-- M3 exists because M2 turned out to be VACUOUS for the projection it was meant
-- to cover: `answers` comes from app.instance_answer_map, so neutralising
-- app.answer_map_by_item_scoped left M2 green. The read-only RENDERER keys by
-- item_id, so `answers_by_item` is the projection that actually reaches the
-- signer's eyes — and it needs its own assertion.
--   MUTATION: drop the instance filter from app.answer_map_by_item_scoped -> red.
select results_eq(
  $$select jsonb_agg(inst -> 'answers_by_item' ->> 'ff100000-0000-0000-0000-000000000012'
                     order by (inst ->> 'position')::int)
      from jsonb_array_elements(
        public.get_response_for_signoff('ff100000-0000-0000-0000-000000000040') -> 'instances'
      ) inst$$,
  $$select '["Dipirona", "Amoxicilina"]'::jsonb$$,
  'M3. …and the by-ITEM projection the renderer keys on is instance-scoped too'
);

reset role;
select set_config('request.jwt.claims', null, true);

select * from finish();
rollback;
