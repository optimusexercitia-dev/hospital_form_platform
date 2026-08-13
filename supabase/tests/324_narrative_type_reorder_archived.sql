-- =============================================================================
-- case_narrative_types: reorder after archiving a NON-LAST type (RDR MINOR-1's
-- surviving site). REG·KIND (ADR 0110) deleted the `referral_note_types`
-- mirror outright, so the "ONE platform-wide fix at two sites" argument (RDR
-- plan amendment A6) is gone and the fix lands here unilaterally.
--
-- Substrate (live catalog, 2026-08-12): archived rows KEEP their NOT NULL
-- `position`; `case_narrative_types_commission_position_key` is
-- UNIQUE (commission_id, position) DEFERRABLE INITIALLY IMMEDIATE — it shields
-- intra-STATEMENT shuffles among the rows a statement updates, but an archived
-- row absent from p_ordered_ids retained its old position and collided at
-- statement end (23505). Fix (migration 20260921000200): the reorder's single
-- UPDATE renumbers the actives 1..N in caller order AND compacts the
-- commission's remaining archived rows to N+1.. (ordered by previous position,
-- then id) — one statement, so the deferrable check still sees a consistent
-- final state, and repeated reorders are stable (no unbounded position drift).
--
-- ⭐ KEYSTONE (red-first, authz-handoff §7.1): t4 was observed RED (23505)
-- against the pre-fix catalog before the migration landed.
-- =============================================================================

begin;
select plan(8);

update app.feature_flags set enabled = true where key in ('case_narratives', 'audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid as sa_x, (v->>'comm_x')::uuid as comm_x from ctx;
grant select on k to authenticated;

select is(app.feature_enabled('case_narratives'), true,
  't1 PRECONDITION: case_narratives ON (forced above; asserted, never assumed — §7.3)');

-- Three types created in deterministic order (separate statements — a single
-- select list would not pin the max(position)+1 evaluation order).
create temp table nt on commit drop as
  select null::uuid as a, null::uuid as b, null::uuid as c;
grant select, update on nt to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
update nt set a = (public.create_case_narrative_type((select comm_x from k), 'Tipo A', null)).id;
update nt set b = (public.create_case_narrative_type((select comm_x from k), 'Tipo B', null)).id;
update nt set c = (public.create_case_narrative_type((select comm_x from k), 'Tipo C', null)).id;
reset role;

select is(
  (select string_agg(label || ':' || position, ',' order by position)
   from public.case_narrative_types where commission_id = (select comm_x from k)),
  'Tipo A:1,Tipo B:2,Tipo C:3',
  't2 PRECONDITION: three actives at positions 1,2,3');

-- Archive the MIDDLE type — the non-last case that used to poison the reorder.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select (public.archive_case_narrative_type((select b from nt))).archived;
reset role;

select is(
  (select archived::text || ':' || position::text
   from public.case_narrative_types where id = (select b from nt)),
  'true:2',
  't3 PRECONDITION: the archived middle type retains its position (the collision substrate)');

-- ── THE KEYSTONE ─────────────────────────────────────────────────────────────
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$select public.reorder_case_narrative_types(
      (select comm_x from k),
      array[(select c from nt), (select a from nt)])$$,
  't4 ⭐ KEYSTONE: reorder after archiving a NON-LAST type succeeds (was 23505 — the archived row still held position 2)');
reset role;

select is(
  (select string_agg(label || ':' || position, ',' order by position)
   from public.case_narrative_types
   where commission_id = (select comm_x from k) and not archived),
  'Tipo C:1,Tipo A:2',
  't5 the caller order is applied to the actives');
select is(
  (select archived::text || ':' || position::text
   from public.case_narrative_types where id = (select b from nt)),
  'true:3',
  't6 the archived type is compacted AFTER the actives and stays archived (reorder never resurrects)');

-- Stability control: a second reorder must not drift the archived position.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$select public.reorder_case_narrative_types(
      (select comm_x from k),
      array[(select a from nt), (select c from nt)])$$,
  't7 CONTROL: a second reorder still succeeds (archived compaction is idempotent)');
reset role;

select is(
  (select string_agg(label || ':' || position || ':' || archived, ',' order by position)
   from public.case_narrative_types where commission_id = (select comm_x from k)),
  'Tipo A:1:false,Tipo C:2:false,Tipo B:3:true'::text,
  't8 final state: actives 1..2 in caller order, archived pinned at 3 — no unbounded growth');

select * from finish();
rollback;
