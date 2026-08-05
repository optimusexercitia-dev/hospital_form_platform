-- PCI — process/case integrity audit keystones (migrations 20260906000100..001100).
--
-- EVERY assertion here is MUTATION-PROVEN: the comment above each section names the
-- exact change that turns it red. A keystone that cannot fail is not a keystone
-- (ADR 0079).
--
-- ⚠ THE CONTROL-PAIR RULE. Most sections below pair a DENY with an ALLOW on the
-- same path. Without the pair, a deny assertion passes on a broken fixture — if the
-- insert would have failed anyway (missing column, wrong commission, absent parent),
-- `throws_ok` is satisfied for the wrong reason and proves nothing. Where a control
-- is missing it is because the assertion reads the catalog directly, which cannot be
-- vacuous in that way.
--
-- Assertion count: 27

begin;
select plan(27);

update app.feature_flags set enabled = true
  where key in ('case_phase_results', 'cases_multi_phase', 'cases_extras',
                'audit_trail', 'case_narratives');
update app.feature_flags set enabled = false where key = 'case_access';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'form_u')::uuid as form_u,
         (v->>'ver_u')::uuid  as ver_u,
         (v->>'form_y')::uuid as form_y,
         (v->>'ver_y')::uuid  as ver_y
  from ctx;
grant select on k to authenticated;

-- Result vocabulary in comm_x (2 options) and comm_y (1, for the cross-tenant arm).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table vocab on commit drop as
  select (public.create_phase_result((select comm_x from k), 'Conforme', 'green', false)).id as ok_id,
         (public.create_phase_result((select comm_x from k), 'Não-conforme', 'red', true)).id as nao_id;
grant select on vocab to authenticated;
reset role;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table vocab_y on commit drop as
  select (public.create_phase_result((select comm_y from k), 'Alheio', 'blue', false)).id as foreign_id;
grant select on vocab_y to authenticated;
reset role;

-- A published 1-phase template in comm_x whose ruleset names BOTH options, so the
-- H4 section has a ruleset-only reference to delete.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'PCI Proc', null)).id as tid, null::uuid as vid;
-- ADR 0096: resolve the v1 draft in a SEPARATE statement. The helper is
-- STABLE, so inside the CREATE ... AS above it would see the pre-statement
-- snapshot and return NULL.
update tpl set vid = app.draft_version_of_template(tid);
grant select on tpl to authenticated;
select public.add_template_phase(
  (select vid from tpl), (select form_u from k), 'Fase 1',
  null, null, '{}'::integer[],
  jsonb_build_object(
    'rules', jsonb_build_array(
      jsonb_build_object('when', jsonb_build_object('question_key','u_q1','op','equals','value','sim'),
                         'result_id', (select ok_id from vocab)::text)),
    'default_result_id', (select nao_id from vocab)::text),
  true,
  jsonb_build_array((select ok_id from vocab)::text)
);
select public.publish_process_template((select tid from tpl));
create temp table c1 on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso PCI')).id as cid;
grant select on c1 to authenticated;
reset role;

-- ===========================================================================
-- §H1 · the case_phases INSERT gate (20260906000100)
-- MUTATION: delete the `tg_op = 'INSERT'` arm of app.guard_case_phase_status → t1 red.
-- ===========================================================================

-- t1 · a CLIENT role cannot forge a phase outside an RPC window. This is the whole
-- audited hole: a FOR ALL policy + INSERT grant let staff_admin POST a terminal row.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($q$insert into public.case_phases
             (case_id, position, form_id, form_version_id, status, completed_at)
           values (%L, 90, %L, %L, 'completed', now())$q$,
         (select cid from c1), (select form_u from k), (select ver_u from k)),
  '23514',
  null,
  'H1: a client-role INSERT of a forged COMPLETED phase is refused');
reset role;

-- t2 · CONTROL. The identical row, written by a privileged fixture, SUCCEEDS —
-- without this, t1 could be passing because the row was malformed.
do $$ begin
  insert into public.case_phases
    (case_id, position, form_id, form_version_id, status, completed_at, activated_at)
  values ((select cid from c1), 91, (select form_u from k), (select ver_u from k),
          'completed', now(), now());
end $$;
select is(
  (select count(*)::int from public.case_phases where case_id = (select cid from c1) and position = 91),
  1, 'H1 control: the SAME row from a privileged (non-client) writer is accepted');

-- t3 · a `pending` phase may not carry lifecycle timestamps (the consistency arm).
-- MUTATION: drop the status='pending' timestamp check → red.
select throws_ok(
  format($q$insert into public.case_phases
             (case_id, position, form_id, form_version_id, status, completed_at)
           values (%L, 92, %L, %L, 'pending', now())$q$,
         (select cid from c1), (select form_u from k), (select ver_u from k)),
  '23514',
  null,
  'H1: a PENDING phase carrying completed_at is refused (even privileged)');

-- t4 · the case-side result_ruleset shape CHECK (the missing twin).
-- MUTATION: drop case_phases_result_ruleset_shape → red.
select throws_ok(
  format($q$insert into public.case_phases
             (case_id, position, form_id, form_version_id, status, emits_result, result_ruleset)
           values (%L, 93, %L, %L, 'pending', true, '{"nonsense": 1}'::jsonb)$q$,
         (select cid from c1), (select form_u from k), (select ver_u from k)),
  '23514',
  null,
  'H1: case_phases.result_ruleset shape CHECK rejects a malformed ruleset');

-- ===========================================================================
-- §H1b · the app.in_case_rpc window must SURVIVE a phase insert (20260906001100)
-- MUTATION: restore the unconditional set_config(...,'off') in
--           app.recompute_case_status → t5 red (and `db reset` fails at the seed).
-- ===========================================================================

-- t5 · two phases in ONE window — the create_case_from_template loop in miniature.
-- Before the fix, inserting phase A closed the window via the recompute AFTER-trigger
-- and phase B was refused.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($q$do $b$ begin
             perform set_config('app.in_case_rpc', 'on', true);
             insert into public.case_phases (case_id, position, form_id, form_version_id)
               values (%L, 94, %L, %L);
             insert into public.case_phases (case_id, position, form_id, form_version_id)
               values (%L, 95, %L, %L);
             perform set_config('app.in_case_rpc', 'off', true);
           end $b$$q$,
         (select cid from c1), (select form_u from k), (select ver_u from k),
         (select cid from c1), (select form_u from k), (select ver_u from k)),
  'H1b: two phases insert in ONE app.in_case_rpc window (the recompute trigger no longer closes it)');
reset role;

-- ===========================================================================
-- §H3 · commission coherence in the substrate (20260906000300)
-- MUTATION: drop app.guard_case_phase_refs_coherent → t6 red.
-- ===========================================================================

-- t6 · comm_y's result may not be attached to a comm_x phase.
-- ⚠ Wrapped in the RPC window on purpose: phase 91 is `completed`, so WITHOUT the
-- window the pre-existing status guard refuses the update first (23514) and this
-- assertion would be measuring that guard instead of the coherence one. Proving a
-- guard requires reaching it.
select throws_ok(
  format($q$do $b$ begin
             perform set_config('app.in_case_rpc', 'on', true);
             update public.case_phases set result_id = %L
               where case_id = %L and position = 91;
             perform set_config('app.in_case_rpc', 'off', true);
           end $b$$q$,
         (select foreign_id from vocab_y), (select cid from c1)),
  'HC030',
  null,
  'H3: a FOREIGN commission result cannot be recorded on a case phase');

-- t7 · CONTROL. The same write with comm_x's OWN result succeeds — proving t6 is
-- about the commission, not about the update being impossible.
do $$ begin
  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases set result_id = (select ok_id from vocab)
    where case_id = (select cid from c1) and position = 91;
  perform set_config('app.in_case_rpc', 'off', true);
end $$;
select is(
  (select result_id from public.case_phases where case_id = (select cid from c1) and position = 91),
  (select ok_id from vocab),
  'H3 control: the case''s OWN commission result IS accepted on the same phase');

-- t8 · a foreign narrative type cannot be attached to a case.
-- MUTATION: drop app.guard_case_narrative_type_coherent → red.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table nt_y on commit drop as
  select (public.create_case_narrative_type((select comm_y from k), 'Tipo Alheio', null)).id as ntid;
grant select on nt_y to authenticated;
reset role;
select throws_ok(
  format($q$insert into public.case_narratives
             (case_id, narrative_type_id, type_label, display_position)
           values (%L, %L, 'X', 80)$q$,
         (select cid from c1), (select ntid from nt_y)),
  'HC054',
  null,
  'H3: a FOREIGN commission narrative type cannot be attached to a case');

-- t9 · a foreign form cannot back a template phase.
-- MUTATION: drop app.guard_template_phase_form_coherent → red.
select throws_ok(
  format($q$insert into public.process_template_phases
             (template_version_id, position, form_id)
           values (%L, 50, %L)$q$,
         (select vid from tpl), (select form_y from k)),
  'HC030',
  null,
  'H3: a FOREIGN commission form cannot back a process template phase');

-- ===========================================================================
-- §H4 · a deleted result must not BRICK case creation (20260906000400)
-- MUTATION: remove the `join public.phase_results pr` filter from
--           create_case_from_template → t10 red with 23503.
--
-- ⚠ This reproduces the ORIGINAL bug. `nao_id` is referenced ONLY from the
-- ruleset's default_result_id (allowed = [ok_id]), i.e. from a JSON string no FK
-- can police. 210_phase_result_junctions.sql asserts the junction rows cascade —
-- correctly — but never inspects the jsonb, which still names the dead uuid.
-- ===========================================================================

delete from public.phase_results where id = (select nao_id from vocab);

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
-- t10 · creation from the affected template still SUCCEEDS.
select lives_ok(
  format($q$select public.create_case_from_template(%L, 'Caso pos-delete')$q$,
         (select tid from tpl)),
  'H4: a ruleset naming a DELETED result no longer bricks create_case_from_template');
reset role;

-- t11 · and the dead id is simply absent from the frozen offered set (graceful
-- degradation, matching what compute_case_phase_result already does).
select is(
  (select count(*)::int from public.case_phase_offered_results
   where result_id = (select nao_id from vocab)),
  0, 'H4: the deleted result appears in NO case''s frozen offered set');

-- ===========================================================================
-- §M4 · the composite form/version FK (20260906000500)
-- MUTATION: restore the single-column case_phases_form_version_id_fkey → t12 red.
-- ===========================================================================

-- t12 · a phase may not pin one form with ANOTHER form's version.
select throws_ok(
  format($q$insert into public.case_phases (case_id, position, form_id, form_version_id)
           values (%L, 96, %L, %L)$q$,
         (select cid from c1), (select form_u from k), (select ver_y from k)),
  '23503',
  null,
  'M4: a case phase cannot pin form A with form B''s version');

-- t13 · the NOT NULL pair that makes MATCH SIMPLE sound on that FK. If either
-- column ever becomes nullable, the composite silently stops constraining.
select is(
  (select count(*)::int from pg_attribute
   where attrelid = 'public.case_phases'::regclass
     and attname in ('form_id', 'form_version_id') and attnotnull),
  2, 'M4: both FK columns are NOT NULL (MATCH SIMPLE has no null-escape)');

-- ===========================================================================
-- §M5 · the revoked grants (20260906000600)
-- MUTATION: drop the revoke loop → t14 red.
-- ===========================================================================

-- t14 · TRUNCATE/TRIGGER/REFERENCES are gone from both client roles. RLS does not
-- gate TRUNCATE, so this is the one privilege a policy audit cannot see.
select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('authenticated', 'anon')
     and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')
     -- ADR 0096 added process_template_versions to this cluster; the assertion
     -- claims cluster-wide coverage, so the new table has to be in the list or
     -- the claim quietly narrows.
     and table_name in ('process_templates','process_template_versions','process_template_phases','process_template_narratives',
       'process_template_outcomes','process_template_custom_fields',
       'process_template_phase_allowed_results','process_template_phase_offered_results',
       'cases','case_phases','case_narratives','case_narrative_types','case_narrative_revisions',
       'phase_results','case_phase_allowed_results','case_phase_offered_results',
       'case_outcomes','case_offered_outcomes','case_custom_field_values')),
  0, 'M5: no TRUNCATE/TRIGGER/REFERENCES for authenticated/anon across the cluster');

-- t15 · CONTROL. The revoke did not overreach — ordinary DML survives on a table
-- the app writes through RLS every day.
select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated'
     and table_name = 'case_phases'
     and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')),
  4, 'M5 control: SELECT/INSERT/UPDATE/DELETE still granted on case_phases');

-- ===========================================================================
-- §M6 · every FK in the cluster is indexed (20260906000700)
-- MUTATION: drop any index from that migration → t16 red.
-- ===========================================================================
select is(
  (with fk as (
     select c.conrelid, c.conkey
     from pg_constraint c
     where c.contype = 'f'
       and c.conrelid::regclass::text in ('cases','case_phases','case_narratives',
         'case_narrative_revisions','case_custom_field_values','process_templates',
         -- ADR 0096: process_template_versions joins the cluster this FK sweep covers.
         'process_template_versions',
         'process_template_phases','case_outcomes','phase_results')
   )
   select count(*)::int from fk
   where not exists (
     select 1 from pg_index i
     where i.indrelid = fk.conrelid
       and (i.indkey::smallint[])[0:array_length(fk.conkey,1)-1] = fk.conkey
   )),
  0, 'M6: zero unindexed foreign keys remain in the process/case cluster');

-- ===========================================================================
-- §M7 · the rewritten RLS policies still DENY (20260906000800)
-- MUTATION: the migration's own self-check aborts on any predicate change; these
--           two prove the behaviour, which a catalog check cannot.
-- ===========================================================================

-- t17 · a foreign-commission principal reads ZERO phases of comm_x's case.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.case_phases where case_id = (select cid from c1)),
  0, 'M7: a foreign-commission principal reads ZERO case_phases after the rewrite');
reset role;

-- t18 · CONTROL. The owning staff_admin reads NON-zero — without this, t17 passes
-- on an empty table and proves nothing.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select cmp_ok(
  (select count(*)::int from public.case_phases where case_id = (select cid from c1)),
  '>', 0,
  'M7 control: the owning staff_admin still reads case_phases (deny is not vacuous)');
reset role;

-- ===========================================================================
-- §M2 · case-side blocks[] integrity (20260906001000)
-- MUTATION: drop app.guard_case_phase_blocks_refs → t19 red;
--           drop app.guard_case_phase_blocks_referenced → t20 red.
-- ===========================================================================

-- t19 · blocks may not name a position that does not exist in this case.
select throws_ok(
  format($q$insert into public.case_phases
             (case_id, position, form_id, form_version_id, blocks)
           values (%L, 97, %L, %L, '{45}'::integer[])$q$,
         (select cid from c1), (select form_u from k), (select ver_u from k)),
  'HC016',
  null,
  'M2: a blocks[] entry naming a non-existent sibling phase is refused');

-- t20 · a phase another phase blocks on may not be deleted.
do $$ begin
  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases set blocks = '{94}'::integer[]
    where case_id = (select cid from c1) and position = 95;
  perform set_config('app.in_case_rpc', 'off', true);
end $$;
select throws_ok(
  format($q$delete from public.case_phases where case_id = %L and position = 94$q$,
         (select cid from c1)),
  'HC016',
  null,
  'M2: deleting a phase that another phase blocks on is refused');

-- (The cascade arm is t21, deliberately LAST — it destroys the case every other
-- assertion depends on.)

-- ===========================================================================
-- §M8 / §L1 · ordering + narrative pairing (20260906000900)
-- ===========================================================================

-- t22 · duplicate (commission_id, position) in the result vocabulary is refused,
-- AND a reorder still works — the second half is what proves DEFERRABLE was kept.
-- MUTATION: drop `deferrable` from the constraint → the reorder inside t22 raises.
select lives_ok(
  $q$do $b$
     declare v_a uuid; v_b uuid;
     begin
       select id into v_a from public.phase_results
         where commission_id = (select comm_x from k) order by position limit 1;
       select id into v_b from public.phase_results
         where commission_id = (select comm_x from k) and id <> v_a order by position limit 1;
       if v_b is null then return; end if;
       update public.phase_results d set position = o.ord
       from (values (v_a, 2), (v_b, 1)) as o(id, ord) where d.id = o.id;
     end $b$$q$,
  'M8: a set-based position PERMUTATION succeeds (the unique constraint is DEFERRABLE)');

-- t23 · an OPEN narrative may not carry a conclusion timestamp.
-- MUTATION: drop case_narratives_concluded_paired → red.
select throws_ok(
  format($q$insert into public.case_narratives
             (case_id, type_label, display_position, status, concluded_at)
           values (%L, 'X', 81, 'open', now())$q$,
         (select cid from c1)),
  '23514',
  null,
  'L1: an OPEN narrative carrying concluded_at is refused');

-- ===========================================================================
-- §M2 (cascade arm) — LAST, because it deletes a case.
-- MUTATION: remove the `commission_of_case(...) is null` escape from
--           app.guard_case_phase_blocks_referenced → t23 red (and every case with
--           a blocked phase becomes undeletable).
--
-- ⚠ A DEDICATED case, not c1. Two properties are needed that c1 cannot supply:
-- its phases must all be NON-terminal (the pre-existing status guard refuses to
-- cascade-delete a `completed` phase, which would mask this assertion), and one
-- phase must genuinely block on another — otherwise the escape being tested is
-- never reached and the assertion is vacuous.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table c3 on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso cascade')).id as cid;
grant select on c3 to authenticated;
reset role;

do $$ begin
  perform set_config('app.in_case_rpc', 'on', true);
  insert into public.case_phases (case_id, position, form_id, form_version_id, blocks)
    values ((select cid from c3), 2, (select form_u from k), (select ver_u from k), '{1}'::integer[]);
  perform set_config('app.in_case_rpc', 'off', true);
end $$;

select lives_ok(
  format($q$delete from public.cases where id = %L$q$, (select cid from c3)),
  'M2: deleting the OWNING CASE still cascades (the guard yields to the parent delete)');

-- ===========================================================================
-- §H2 · the audit mesh (20260906000200) — SECTION ADDED 2026-08-05.
--
-- ⚠ THIS SECTION WAS MISSING ENTIRELY. The header above claims migrations
-- 20260906000100..001100, but 20260906000200 — the audit mesh, which added the
-- `case.deleted` row — had NO keystone at all. That gap is precisely why the
-- ADR-0096 re-key silently dropped the process binding out of the audit record
-- and nothing went red.
--
-- ⚠ NO PROTECTION FROM THE SUFFICIENCY PROOF — READ BEFORE DELETING. Every other
-- assertion in this file is backstopped by blocking a suite: break it and
-- something fails loudly. This one is not. It fails SILENTLY, because
-- `app.audit_diff` filters on `ov is distinct from nv`, and an allow-list entry
-- naming a column that does not exist yields SQL NULL on both sides and is
-- dropped without erroring. It is the ONE assertion here whose ABSENCE would go
-- unnoticed. Do NOT remove it in a tidy-up as "redundant with the audit-mesh
-- tests" — there are no others; this is the audit-mesh test.
--
-- RED-TODAY PROOF (2026-08-05; re-runnable from this note alone). Create a case
-- from a template, delete it, then read the row back:
--     select metadata ? 'template_version_id', metadata ? 'template_id',
--            (select string_agg(kk, ', ' order by kk)
--               from jsonb_object_keys(metadata) kk)
--     from public.audit_log
--     where action = 'case.deleted' and entity_id = <case id>;
--   → f | f | case_number, label, outcome_id, status
-- NEITHER key present: the process binding is GONE from the record, not merely
-- mislabelled.
--
-- MECHANISM: app.trg_audit_cases' DELETE arm passes the allow-list
--   array['status', 'outcome_id', 'case_number', 'template_id', 'label']
-- but ADR 0096 re-keyed `cases`, so to_jsonb(old) now carries
-- `template_version_id` and no `template_id`. The stale entry matches no key and
-- audit_diff drops it. (A NULL-valued column is still recorded — `to_jsonb` emits
-- the key with a JSON null, which IS distinct from SQL NULL — so this failure
-- mode is specifically a MISSING key, not an empty one.)
--
-- MUTATION: revert that allow-list entry to 'template_id' → the keystone reds.
-- PROVEN RED 2026-08-05: that exact mutation failed t27 and ONLY t27 (1 of 27).
--
-- COVERAGE, and the DEBT that remains. The H2 mesh is SEVEN triggers, derived
-- from the catalog (pg_trigger joined to the mesh functions), NOT from the
-- migration filename:
--   cases                      → app.trg_audit_cases          — COVERED (t27, DELETE arm)
--   case_phases                → app.trg_audit_case_phases    — COVERED (t26, INSERT arm)
--   case_narratives            → app.trg_audit_case_narratives      — NOT COVERED
--   case_custom_field_values   → app.trg_audit_case_child           — NOT COVERED
--   case_offered_outcomes      → app.trg_audit_case_child           — NOT COVERED
--   case_phase_allowed_results → app.trg_audit_case_child           — NOT COVERED
--   case_phase_offered_results → app.trg_audit_case_child           — NOT COVERED
-- The five uncovered arms are RECORDED COVERAGE DEBT, deliberately left rather
-- than filled with assertions whose red-first proof nobody ran — writing those
-- is what created this hole in the first place. Do not read the two covered arms
-- as the mesh being tested.
--
-- Placed LAST, beside the cascade arm, for the same reason it is: it deletes a
-- case. It uses a DEDICATED case so it neither consumes nor depends on c1/c3.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table c4 on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso auditoria')).id as cid;
grant select on c4 to authenticated;
reset role;

-- t24 · CONTROL. The case under test is genuinely process-bound, so the binding
-- the keystone looks for is a real one and not a vacuously-recorded null.
select ok(
  (select template_version_id is not null from public.cases where id = (select cid from c4)),
  'H2 control: the case under test IS bound to a process version');

-- t25 · CONTROL. The case has at least one phase. Without this, t26 compares
-- 0 against 0 and passes with the INSERT arm ripped out — the exact vacuity
-- shape this section exists to close.
select ok(
  (select count(*) from public.case_phases where case_id = (select cid from c4)) >= 1,
  'H2 control: the case under test HAS at least one phase (t26 cannot pass on 0 = 0)');

-- t26 · KEYSTONE (case_phases INSERT arm). Every phase materialised with the
-- case emits exactly ONE `case_phase.created` row — a DELTA (audit rows per
-- phase), not existence. Scoped by entity_id to this case's phases, so the
-- other cases this file creates cannot inflate it.
-- MUTATION: make app.trg_audit_case_phases return early on INSERT → red.
-- PROVEN RED 2026-08-05: that mutation failed t26 and ONLY t26 (1 of 27).
select is(
  (select count(*)::int from public.audit_log a
    where a.action = 'case_phase.created'
      and a.entity_id in (select id from public.case_phases
                           where case_id = (select cid from c4))),
  (select count(*)::int from public.case_phases where case_id = (select cid from c4)),
  'H2: each phase created with the case emits exactly one case_phase.created row');

delete from public.cases where id = (select cid from c4);

-- t27 · KEYSTONE (cases DELETE arm). The case.deleted audit row RECORDS the
-- process binding. Asserts the FIELD IS PRESENT — deliberately NOT that a row
-- exists, which the broken behaviour already satisfies and which proves nothing.
select ok(
  (select metadata ? 'template_version_id'
     from public.audit_log
    where action = 'case.deleted' and entity_id = (select cid from c4)),
  'H2: case.deleted records the process binding (template_version_id present)');

select * from finish();
rollback;
