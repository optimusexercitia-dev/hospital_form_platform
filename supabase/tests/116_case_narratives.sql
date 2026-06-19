-- Case Narratives (ADR 0032) — migrations 20260619100000–100003.
--
-- A per-commission narrative-type vocabulary (case_narrative_types); per-template
-- SLOTS (process_template_narratives) interleaved with phase-slots by
-- display_position; per-case snapshot + content (case_narratives) frozen on close.
--
-- Covers: vocab CRUD + RLS isolation (mirror 115_case_outcomes); HC054
-- same-commission type guard; the cross-table interleave reorder
-- (reorder_case_layout_template renumbers BOTH tables + rejects an incomplete set);
-- create_case_from_template materializes narratives with the snapshot type_label +
-- interleaved display_position while phase.position is unchanged;
-- guard_case_narrative_frozen rejects a body write on a terminal case but allows it
-- while aberto; update_case_narrative_body allows staff_admin, rejects a plain
-- member (42501); audit: one case_narrative.updated per save whose metadata NEVER
-- contains body_md. The case_narratives + cases_multi_phase + audit_trail flags are
-- ON for the txn.

begin;
select plan(21);

update app.feature_flags set enabled = true
  where key in ('case_narratives', 'cases_multi_phase', 'audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'sa_y')::uuid    as sa_y,
         (v->>'st_y')::uuid    as st_y,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'comm_y')::uuid  as comm_y,
         (v->>'form_u')::uuid  as form_u
  from ctx;
grant select on k to authenticated;

-- =========================================================================
-- 1) CREATE TYPE in commission X (two types).
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table nt on commit drop as
  select (public.create_case_narrative_type((select comm_x from k), 'Resumo Clínico', 'Síntese')).id as resumo_id;
grant select on nt to authenticated;
create temp table nt2 on commit drop as
  select (public.create_case_narrative_type((select comm_x from k), 'Conclusão do Comitê', null)).id as concl_id;
grant select on nt2 to authenticated;
reset role;

select ok(
  (select resumo_id from nt) is not null and (select concl_id from nt2) is not null,
  'create_case_narrative_type succeeds for staff_admin (two types created)'
);

-- =========================================================================
-- 2) UNIQUE per commission; same label allowed in a different commission.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_case_narrative_type(%L, 'Resumo Clínico', null) $$,
         (select comm_x from k)),
  '23505', null,
  'create_case_narrative_type rejects a duplicate label in the same commission (23505)'
);
reset role;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table nt_y on commit drop as
  select (public.create_case_narrative_type((select comm_y from k), 'Resumo Clínico', null)).id as nid;
grant select on nt_y to authenticated;
reset role;
select ok((select nid from nt_y) is not null,
  'same narrative-type label is allowed in a DIFFERENT commission');

-- =========================================================================
-- 3) PLAIN STAFF cannot create a type (staff_admin-gated → 42501).
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_case_narrative_type(%L, 'Staff narrativa', null) $$,
         (select comm_x from k)),
  '42501', null,
  'plain staff cannot create a narrative type (RPC is staff_admin-gated)'
);
reset role;

-- =========================================================================
-- 4) RLS: member reads own commission's types; cross-commission member cannot.
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select ok(
  (select count(*)::int from public.case_narrative_types
   where commission_id = (select comm_x from k)) >= 2,
  'a staff member can read case_narrative_types of their own commission'
);
reset role;

select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.case_narrative_types
   where commission_id = (select comm_x from k)),
  0,
  'RLS: a cross-commission member cannot read another commission''s narrative types'
);
reset role;

-- =========================================================================
-- Build a template in X with TWO phases, then add a narrative slot interleaved.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'Proc Narrativas', null)).id as tid;
grant select on tpl to authenticated;
select public.add_template_phase((select tid from tpl), (select form_u from k), 'F1');
select public.add_template_phase((select tid from tpl), (select form_u from k), 'F2');
reset role;

-- =========================================================================
-- 5) HC054: add_template_narrative rejects a type from ANOTHER commission.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_template_narrative(%L, %L) $$,
         (select tid from tpl), (select nid from nt_y)),
  'HC054', null,
  'add_template_narrative rejects a type from a different commission (HC054)'
);
reset role;

-- Add a narrative slot (lands at display_position 3 = max(1,2)+1).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table ns on commit drop as
  select (public.add_template_narrative((select tid from tpl), (select resumo_id from nt),
                                        null, null, true)).id as nsid;
grant select on ns to authenticated;
reset role;

select is(
  (select display_position from public.process_template_narratives where id = (select nsid from ns)),
  3,
  'add_template_narrative appends at max(display_position over BOTH tables)+1 (= 3)'
);

-- =========================================================================
-- 6) REORDER (cross-table): put the narrative between the two phases.
--    Order: phase@pos1, narrative, phase@pos2  -> display_position 1,2,3.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.reorder_case_layout_template(
  (select tid from tpl),
  jsonb_build_array(
    jsonb_build_object('kind','phase','id',
      (select id from public.process_template_phases where template_id=(select tid from tpl) and position=1)),
    jsonb_build_object('kind','narrative','id', (select nsid from ns)),
    jsonb_build_object('kind','phase','id',
      (select id from public.process_template_phases where template_id=(select tid from tpl) and position=2))
  )
);
reset role;

select is(
  (select display_position from public.process_template_narratives where id = (select nsid from ns)),
  2,
  'reorder_case_layout_template renumbers the narrative to display_position 2 (interleaved)'
);
select is(
  (select array_agg(display_position order by position)
   from public.process_template_phases where template_id = (select tid from tpl)),
  array[1, 3],
  'reorder_case_layout_template renumbers BOTH phases (display_position 1 and 3) while position is unchanged'
);
-- position (the phase NUMBER) is untouched by the reorder.
select is(
  (select array_agg(position order by position)
   from public.process_template_phases where template_id = (select tid from tpl)),
  array[1, 2],
  'reorder_case_layout_template never touches phase.position (still 1,2)'
);

-- =========================================================================
-- 7) REORDER rejects an INCOMPLETE set (count != phases + narratives).
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.reorder_case_layout_template(%L, %L::jsonb) $$,
         (select tid from tpl),
         jsonb_build_array(jsonb_build_object('kind','narrative','id',(select nsid from ns)))::text),
  'HC054', null,
  'reorder_case_layout_template rejects an incomplete order set (HC054)'
);
reset role;

-- =========================================================================
-- Publish + create a case (snapshots phases + narratives).
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.publish_process_template((select tid from tpl));
create temp table cse on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso Narrativa')).id as cid;
grant select on cse to authenticated;
reset role;

-- =========================================================================
-- 8) SNAPSHOT: case_narratives materialized with the EFFECTIVE type_label +
--    the interleaved display_position; phase.position unchanged.
-- =========================================================================
select is(
  (select count(*)::int from public.case_narratives where case_id = (select cid from cse)),
  1,
  'create_case_from_template materializes the template narrative into case_narratives'
);
select is(
  (select type_label from public.case_narratives where case_id = (select cid from cse)),
  'Resumo Clínico',
  'the snapshot type_label = the effective label (coalesce(slot.title, type.label))'
);
select is(
  (select display_position from public.case_narratives where case_id = (select cid from cse)),
  2,
  'the snapshot narrative keeps its interleaved display_position (2)'
);
select is(
  (select array_agg(display_position order by position)
   from public.case_phases where case_id = (select cid from cse)),
  array[1, 3],
  'the snapshot case_phases carry display_position 1 and 3 while position stays 1,2'
);

-- =========================================================================
-- 9) BODY SAVE: staff_admin saves body while the case is aberto.
-- =========================================================================
create temp table cn on commit drop as
  select id as nid from public.case_narratives where case_id = (select cid from cse);
grant select on cn to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (public.update_case_narrative_body((select nid from cn), 'Conteúdo da narrativa, sem PHI.')).body_md,
  'Conteúdo da narrativa, sem PHI.',
  'update_case_narrative_body persists body_md while the case is aberto (staff_admin)'
);
reset role;

-- =========================================================================
-- 10) BODY SAVE denied for a plain member (42501).
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.update_case_narrative_body(%L, 'hack') $$, (select nid from cn)),
  '42501', null,
  'update_case_narrative_body rejects a plain member (42501)'
);
reset role;

-- =========================================================================
-- 11) AUDIT: a body save emits case_narrative.updated whose metadata has NO body.
-- =========================================================================
select ok(
  (select count(*)::int from public.audit_log
   where action = 'case_narrative.updated'
     and entity_id = (select nid from cn)) >= 1,
  'a body save emits at least one case_narrative.updated audit row'
);
select ok(
  not exists (
    select 1 from public.audit_log
    where entity_id = (select nid from cn)
      and (metadata::text ilike '%sem PHI%' or metadata ? 'body_md'
           or metadata ? 'title' or metadata ? 'instructions')
  ),
  'case_narrative audit metadata NEVER contains body_md / title / instructions'
);

-- =========================================================================
-- 12) FREEZE: conclude the case, then a body write is rejected (HC054).
-- =========================================================================
-- Settle both phases so close_case passes (no outcomes offered → no HC028).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.skip_phase((select id from public.case_phases where case_id=(select cid from cse) and position=1));
select public.skip_phase((select id from public.case_phases where case_id=(select cid from cse) and position=2));
select public.close_case((select cid from cse));
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.update_case_narrative_body(%L, 'editar depois de concluir') $$,
         (select nid from cn)),
  'HC054', null,
  'update_case_narrative_body rejects a body write once the case is terminal (HC054 freeze)'
);
reset role;

select * from finish();
rollback;
