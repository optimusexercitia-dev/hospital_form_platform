-- Case data-model adjustments: configurable PHASE BLOCKERS (decisions D1/D4) —
-- migration 093002.
--
-- A phase declares the EARLIER phases that block it (blocks integer[] on both
-- process_template_phases and case_phases). A blocker is satisfied when the
-- blocking phase is concluida OR nao_necessaria (skip unblocks, D4). Multiple
-- phases can be ativa at once (parallel, D1) unless blocked.
--
-- Covers:
--   * activate_phase HC018 via blocks (blocked until the blocker settles),
--     asserting BOTH D4 satisfiers (concluida unblocks AND nao_necessaria unblocks);
--   * parallel activation when blocks = '{}' (the strict-sequential guard is gone);
--   * template-side HC016 validation: forward ref, self ref, missing position;
--   * the blocks RENUMBER MIRROR on reorder (value-swap) and remove (tail shift);
--   * the snapshot of blocks into case_phases at case creation.
-- cases_multi_phase is flipped ON for the txn.

begin;
select plan(16);

update app.feature_flags set enabled = true where key = 'cases_multi_phase';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'form_u')::uuid  as form_u
  from ctx;
grant select on k to authenticated;

-- =========================================================================
-- A 3-phase template; phase 2 blocks [1], phase 3 blocks [2]. Built as a draft so
-- we can exercise the blocks setters + validation, then published + a case.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'Blockers', null)).id as tid;
reset role;
grant select on tpl to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table ph on commit drop as
  select (public.add_template_phase((select tid from tpl), (select form_u from k), 'Fase 1')).id as p1;
grant select on ph to authenticated;
-- Add phases 2 and 3 with their blockers set at creation (p_blocks param).
select public.add_template_phase((select tid from tpl), (select form_u from k), 'Fase 2', null, null, array[1]);
select public.add_template_phase((select tid from tpl), (select form_u from k), 'Fase 3', null, null, array[2]);
reset role;

-- =========================================================================
-- 1) Template blocks stored as authored (phase 2 -> [1], phase 3 -> [2]).
-- =========================================================================
select is(
  (select blocks from public.process_template_phases
   where template_id = (select tid from tpl) and position = 2),
  array[1],
  'add_template_phase stores blocks for phase 2 = {1}'
);
select is(
  (select blocks from public.process_template_phases
   where template_id = (select tid from tpl) and position = 3),
  array[2],
  'add_template_phase stores blocks for phase 3 = {2}'
);

-- =========================================================================
-- 2) HC016 template validation: forward / self / missing references
-- =========================================================================
-- Forward ref: phase 2 cannot block phase 3 (a LATER position).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_template_phase_blocks(
              (select id from public.process_template_phases
               where template_id = %L and position = 2), array[3]) $$,
          (select tid from tpl)),
  'HC016',
  null,
  'set_template_phase_blocks rejects a FORWARD reference (block a later phase) — HC016'
);
reset role;

-- Self ref: phase 2 cannot block itself.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_template_phase_blocks(
              (select id from public.process_template_phases
               where template_id = %L and position = 2), array[2]) $$,
          (select tid from tpl)),
  'HC016',
  null,
  'set_template_phase_blocks rejects a SELF reference — HC016'
);
reset role;

-- Missing position: phase 3 cannot block position 9 (does not exist).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_template_phase_blocks(
              (select id from public.process_template_phases
               where template_id = %L and position = 3), array[9]) $$,
          (select tid from tpl)),
  'HC016',
  null,
  'set_template_phase_blocks rejects a reference to a NON-EXISTENT position — HC016'
);
reset role;

-- =========================================================================
-- Publish + create a case; assert the blocks snapshot into case_phases.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.publish_process_template((select tid from tpl));
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso Blockers')).id as cid;
reset role;
grant select on cse to authenticated;

create temp table cp on commit drop as
  select id, position, blocks from public.case_phases where case_id = (select cid from cse);
grant select on cp to authenticated;

-- =========================================================================
-- 3) SNAPSHOT: case_phases.blocks copied verbatim from the template.
-- =========================================================================
select is(
  (select blocks from cp where position = 2),
  array[1],
  'create_case_from_template snapshots blocks for phase 2 = {1}'
);
select is(
  (select blocks from cp where position = 3),
  array[2],
  'create_case_from_template snapshots blocks for phase 3 = {2}'
);

-- =========================================================================
-- 4) HC018: phase 2 is BLOCKED while phase 1 is pendente (not yet settled).
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.activate_phase(%L, %L) $$,
          (select id from cp where position = 2), (select st_x from k)),
  'HC018',
  null,
  'activate_phase rejects a phase whose blocker is not yet settled (HC018)'
);
reset role;

-- =========================================================================
-- 5) PARALLEL: phase 1 (blocks = {}) activates regardless of others (no sequence).
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (public.activate_phase((select id from cp where position = 1), (select st_x from k))).status,
  'ativa',
  'a phase with empty blocks activates freely (no strict-sequential guard)'
);
reset role;

-- =========================================================================
-- 6) D4 satisfier A: blocker CONCLUIDA unblocks phase 2.
-- =========================================================================
-- Drive phase 1 ativa -> concluida directly under the flag (the submit path's
-- effect), then phase 2 should activate.
select set_config('app.in_case_rpc', 'on', true);
update public.case_phases set status = 'concluida', completed_at = now()
  where id = (select id from cp where position = 1);
select set_config('app.in_case_rpc', 'off', true);

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (public.activate_phase((select id from cp where position = 2), (select st_x from k))).status,
  'ativa',
  'D4 satisfier A: a CONCLUIDA blocker unblocks the dependent phase (activates)'
);
reset role;

-- =========================================================================
-- 7) D4 satisfier B: blocker NAO_NECESSARIA unblocks (skip unblocks). Phase 3
-- blocks [2]; settle phase 2 by SKIP, then phase 3 activates.
-- =========================================================================
-- Phase 2 is currently ativa; bring it to concluida is one path, but D4-B is the
-- SKIP path — so build a SEPARATE case and skip phase 2 to unblock phase 3.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse2 on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso Blockers 2')).id as cid;
reset role;
grant select on cse2 to authenticated;

create temp table cp2 on commit drop as
  select id, position from public.case_phases where case_id = (select cid from cse2);
grant select on cp2 to authenticated;

-- Phase 3 blocks [2]; while phase 2 is pendente, phase 3 is blocked.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.activate_phase(%L, %L) $$,
          (select id from cp2 where position = 3), (select st_x from k)),
  'HC018',
  null,
  'phase 3 is blocked while its blocker (phase 2) is still pendente'
);
reset role;

-- SKIP phase 2 (pendente -> nao_necessaria). Phase 2 itself blocks [1]; phase 1
-- is pendente, but skip_phase has no blocker gate (only activate does), so a
-- pendente phase can always be skipped.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.skip_phase((select id from cp2 where position = 2));
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (public.activate_phase((select id from cp2 where position = 3), (select st_x from k))).status,
  'ativa',
  'D4 satisfier B: a NAO_NECESSARIA (skipped) blocker unblocks the dependent phase'
);
reset role;

-- =========================================================================
-- 8) REORDER RENUMBER MIRROR: a value-swap remaps blocks across moved positions.
-- =========================================================================
-- Fresh draft: phase 1, 2, 3 with phase 3 blocking [1]. Move phase 1 DOWN (swap
-- positions 1<->2). After the swap, the phase that referenced old position 1 must
-- now reference position 2 (where that phase moved). Assert phase 3.blocks = {2}.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table rtpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'Reorder blocks', null)).id as tid;
reset role;
grant select on rtpl to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table rp1 on commit drop as
  select (public.add_template_phase((select tid from rtpl), (select form_u from k), 'R1')).id as pid;
grant select on rp1 to authenticated;
select public.add_template_phase((select tid from rtpl), (select form_u from k), 'R2');
select public.add_template_phase((select tid from rtpl), (select form_u from k), 'R3', null, null, array[1]);
-- Move phase 1 down (swap 1<->2).
select public.reorder_template_phase((select pid from rp1), 'down');
reset role;

select is(
  (select blocks from public.process_template_phases
   where template_id = (select tid from rtpl) and position = 3),
  array[2],
  'reorder remaps blocks across the value-swap: phase 3 blocker {1} -> {2}'
);

-- =========================================================================
-- 9) REMOVE RENUMBER MIRROR: removing a (non-referenced) middle phase shifts the
-- tail's blocks references down by one.
-- =========================================================================
-- Fresh draft: phases 1,2,3,4. Phase 4 blocks [3]; phase 3 blocks [1]. Remove
-- phase 2 (position 2, NOT referenced by any blocks). After removal: old-3 -> pos
-- 2, old-4 -> pos 3. Phase at new pos 3 (was 4, blocks {3}) must remap {3}->{2}
-- (its blocker old-3 is now at pos 2); phase at new pos 2 (was 3, blocks {1})
-- keeps {1} (1 < 2 unchanged).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table xtpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'Remove blocks', null)).id as tid;
reset role;
grant select on xtpl to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_template_phase((select tid from xtpl), (select form_u from k), 'X1');
create temp table xp2 on commit drop as
  select (public.add_template_phase((select tid from xtpl), (select form_u from k), 'X2')).id as pid;
grant select on xp2 to authenticated;
select public.add_template_phase((select tid from xtpl), (select form_u from k), 'X3', null, null, array[1]);
select public.add_template_phase((select tid from xtpl), (select form_u from k), 'X4', null, null, array[3]);
-- Remove phase 2 (position 2).
select public.remove_template_phase((select pid from xp2));
reset role;

-- new position 3 (was phase 4, blocks {3}) -> remapped to {2}.
select is(
  (select blocks from public.process_template_phases
   where template_id = (select tid from xtpl) and position = 3),
  array[2],
  'remove shifts the tail: phase formerly-{3} blocker is remapped to {2}'
);
-- new position 2 (was phase 3, blocks {1}) -> unchanged {1}.
select is(
  (select blocks from public.process_template_phases
   where template_id = (select tid from xtpl) and position = 2),
  array[1],
  'remove leaves a below-the-removed-position blocker unchanged ({1})'
);

-- =========================================================================
-- 10) REMOVE REJECT: a position still referenced by another phase's blocks cannot
-- be removed (would dangle the reference) — HC016.
-- =========================================================================
-- In xtpl, the remaining phase at position 2 blocks [1], so position 1 is
-- referenced; removing position 1 must be rejected.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.remove_template_phase(
              (select id from public.process_template_phases
               where template_id = %L and position = 1)) $$,
          (select tid from xtpl)),
  'HC016',
  null,
  'remove_template_phase rejects removing a position still referenced by a blocks array (HC016)'
);
reset role;

select * from finish();
rollback;
