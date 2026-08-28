-- FF-4 (ADR 0092) — Power Authoring: the gate keystones.
--
-- ⚠ THE BAR IS ADR 0079's: revert the guard, the keystone must go RED. Every
-- section names the exact mutation that reds it; the ones with "(verified)"
-- were RUN by hand against the local stack while this file was written, not
-- merely reasoned about — the FF-5 lesson (seven keystones that could not
-- fail; review found none, reverting the fix found all seven).
--
--   §0 — flags asserted, never forced (the pgtap-fixture-flag-gaps scar).
--   §A — library_rls_tenant_scoped: same-org sibling commission + cross-org,
--        denied read; + the OVER-GRANT TWIN (widen the policy -> must red).
--   §B — library_reader_non_writer (K9): direct INSERT/UPDATE/DELETE denied
--        for an authorized staff_admin, WITH the writer door live. Includes
--        the DELETE arm (the reader must not be able to destroy what it reads).
--   §C — library_doors_revoke_public: neither door is anon/public-executable.
--   §D — snapshot_condition_closure_negative: an out-of-subtree reference
--        refuses HC0Q6 and names the key; an internally-closed block saves
--        clean (the positive control that keeps this from being vacuous).
--   §E — library_insert_deep_copy: a block carrying options + matrix axes +
--        validations + a reference config round-trips save -> insert with
--        every child intact, over the SAME child-table set as
--        app.copy_version_children — asserted by parsing that function's OWN
--        live body (pg_get_functiondef), never a hand-listed array.
--   §F — insert_rewrites_conditions_with_keys: a renamed key's internal
--        condition follows it; the PRE-EXISTING item that owned the literal
--        key beforehand is untouched.
--   §G — insert_collision_suffix_deterministic: two inserts of one block into
--        one version yield k_2 then k_3; the returned rename map matches what
--        actually landed.
--   §H — default_prefill_idempotent: seeded exactly at draft creation; a
--        resume after the seeded item is cleared does not re-seed it.
--   §I — default_source_type_check_negative: every ineligible token x type
--        pairing rejected, and default_source + default_value together
--        rejected — plus the positive control (every eligible pairing works).
--   §J — library_metadata_door_cannot_touch_snapshot (BE-7): the rename door's
--        UPDATE...SET clause never references snapshot/commission_id/
--        provenance, structurally (regex over its own live body) AND
--        behaviorally (rename changes name/description, leaves the rest
--        byte-identical).
--   §K — a tenant-scope negative for the two BE-7 metadata doors: a sibling
--        commission's admin can neither rename nor delete another's entry.
--   §L — delete_safety_no_form_impact (BE-7): deleting an entry does not
--        remove or alter any item in a form previously built from it — the
--        whole point of ruling 2's no-live-link design.

begin;

select plan(61);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin_id,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'st_y')::uuid   as st_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         (v->>'org_b')::uuid  as org_b,
         (v->>'hosp_b')::uuid as hosp_b
  from ctx;
grant select on k to authenticated;

-- ===========================================================================
-- §0 · Flags ASSERTED, not forced.
-- ===========================================================================
select ok(app.feature_enabled('power_authoring'),
  '0a. flag power_authoring is ON — every section below depends on it');
select ok(app.feature_enabled('matrix_fields'),
  '0b. flag matrix_fields is ON — §E''s matrix axes need the writer reachable');
select ok(app.feature_enabled('item_validations'),
  '0c. flag item_validations is ON — §E''s validation row needs it');
select ok(app.feature_enabled('entity_refs'),
  '0d. flag entity_refs is ON — §E''s reference config needs it');
select ok(app.feature_enabled('repeating_groups'),
  '0e. flag repeating_groups is ON — the source block is a repeating_group root');

-- ---------------------------------------------------------------------------
-- FIXTURE (owner sa_x, commission X). A rich source form carrying the block
-- under test: a repeating_group root with five children exercising every
-- child-table shape (options, matrix axes, validations, a reference config)
-- plus one internal condition (altura -> peso) and one item whose condition
-- points OUTSIDE the block (used only by §D's negative case).
-- ---------------------------------------------------------------------------
insert into public.forms (id, commission_id, title, created_by)
  values ('ff400000-0000-0000-0000-000000000001', (select comm_x from k), 'FF4 fonte', (select sa_x from k));
insert into public.form_versions (id, form_id, version_number, status)
  values ('ff400000-0000-0000-0000-000000000002', 'ff400000-0000-0000-0000-000000000001', 1, 'draft');
insert into public.form_sections (id, form_version_id, position, is_default)
  values ('ff400000-0000-0000-0000-000000000003', 'ff400000-0000-0000-0000-000000000002', 0, true);

-- pos 0 — an OUTSIDE anchor, never part of the saved block, so §D's negative
-- case has a real key to dangle to.
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff400000-0000-0000-0000-000000000004', 'ff400000-0000-0000-0000-000000000003', 0,
          'number', 'idade', 'Idade');

-- pos 1 — the rich block's ROOT: a repeating_group.
insert into public.form_items (id, section_id, position, item_type, label, config)
  values ('ff400000-0000-0000-0000-000000000010', 'ff400000-0000-0000-0000-000000000003', 1,
          'repeating_group', 'Bloco Completo', jsonb_build_object('minInstances', 0));

-- pos 2 — child: short_text 'peso', carrying ONE validation rule.
insert into public.form_items (id, section_id, position, item_type, question_key, label, parent_item_id)
  values ('ff400000-0000-0000-0000-000000000011', 'ff400000-0000-0000-0000-000000000003', 2,
          'short_text', 'peso', 'Peso', 'ff400000-0000-0000-0000-000000000010');
insert into public.form_item_validations (item_id, form_version_id, position, rule_type, config, severity, message)
  values ('ff400000-0000-0000-0000-000000000011', 'ff400000-0000-0000-0000-000000000002', 0,
          'text_length', jsonb_build_object('min', 1, 'max', 50), 'error', 'Peso inválido');

-- pos 3 — child: number 'altura', with an INTERNAL condition on 'peso'
-- (closed — this is the positive-closure item).
insert into public.form_items (id, section_id, position, item_type, question_key, label, parent_item_id, visible_when)
  values ('ff400000-0000-0000-0000-000000000012', 'ff400000-0000-0000-0000-000000000003', 3,
          'number', 'altura', 'Altura', 'ff400000-0000-0000-0000-000000000010',
          jsonb_build_object('question_key', 'peso', 'op', 'is_not_empty'));

-- pos 4 — child: multiple_choice 'escolha', WITH options.
insert into public.form_items (id, section_id, position, item_type, question_key, label, required, parent_item_id)
  values ('ff400000-0000-0000-0000-000000000013', 'ff400000-0000-0000-0000-000000000003', 4,
          'multiple_choice', 'escolha', 'Escolha', true, 'ff400000-0000-0000-0000-000000000010');
insert into public.form_item_options (item_id, position, code, label, is_other) values
  ('ff400000-0000-0000-0000-000000000013', 0, 'sim', 'Sim', false),
  ('ff400000-0000-0000-0000-000000000013', 1, 'nao', 'Não', false);

-- pos 5 — child: matrix 'grade', WITH axes (2x2).
insert into public.form_items (id, section_id, position, item_type, question_key, label, parent_item_id)
  values ('ff400000-0000-0000-0000-000000000014', 'ff400000-0000-0000-0000-000000000003', 5,
          'matrix', 'grade', 'Grade', 'ff400000-0000-0000-0000-000000000010');
insert into public.form_matrix_rows (item_id, form_version_id, position, code, label) values
  ('ff400000-0000-0000-0000-000000000014', 'ff400000-0000-0000-0000-000000000002', 0, 'r1', 'Linha 1'),
  ('ff400000-0000-0000-0000-000000000014', 'ff400000-0000-0000-0000-000000000002', 1, 'r2', 'Linha 2');
insert into public.form_matrix_columns (item_id, form_version_id, position, code, label) values
  ('ff400000-0000-0000-0000-000000000014', 'ff400000-0000-0000-0000-000000000002', 0, 'c1', 'Coluna 1'),
  ('ff400000-0000-0000-0000-000000000014', 'ff400000-0000-0000-0000-000000000002', 1, 'c2', 'Coluna 2');

-- pos 6 — child: reference 'ref_item', WITH a reference config.
insert into public.form_items (id, section_id, position, item_type, question_key, label, config, parent_item_id)
  values ('ff400000-0000-0000-0000-000000000015', 'ff400000-0000-0000-0000-000000000003', 6,
          'reference', 'ref_item', 'Referência', jsonb_build_object('referenceKind', 'commission'),
          'ff400000-0000-0000-0000-000000000010');

-- A SECOND, standalone item (NOT part of the block) whose visible_when
-- references 'peso' (INSIDE the block) — §D's out-of-subtree negative uses a
-- separate root, this one is only fixture noise proving the closure check
-- looks at the SAVED item's own subtree, not the whole version.
insert into public.form_items (id, section_id, position, item_type, question_key, label, visible_when)
  values ('ff400000-0000-0000-0000-000000000016', 'ff400000-0000-0000-0000-000000000003', 7,
          'short_text', 'nota', 'Nota',
          jsonb_build_object('question_key', 'peso', 'op', 'is_not_empty'));

-- The OPEN block for §D's negative: a lone item whose visible_when points at
-- 'idade' (pos 0), which is OUTSIDE this single-item subtree.
insert into public.form_items (id, section_id, position, item_type, question_key, label, visible_when)
  values ('ff400000-0000-0000-0000-000000000017', 'ff400000-0000-0000-0000-000000000003', 8,
          'short_text', 'aberto', 'Aberto',
          jsonb_build_object('question_key', 'idade', 'op', 'is_not_empty'));

-- Two DRAFT-TARGET forms in commission X, for §E-§G (insert destinations).
-- Target 1: empty, for the round-trip (§E) and the rename-preserves-existing
-- assertion (§F).
insert into public.forms (id, commission_id, title, created_by)
  values ('ff400000-0000-0000-0000-000000000020', (select comm_x from k), 'FF4 alvo 1', (select sa_x from k));
insert into public.form_versions (id, form_id, version_number, status)
  values ('ff400000-0000-0000-0000-000000000021', 'ff400000-0000-0000-0000-000000000020', 1, 'draft');
insert into public.form_sections (id, form_version_id, position, is_default)
  values ('ff400000-0000-0000-0000-000000000022', 'ff400000-0000-0000-0000-000000000021', 0, true);
-- A pre-existing item that OWNS the literal 'peso' key — forces the first
-- insert's root-level key to suffix, and §F asserts this row is untouched.
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff400000-0000-0000-0000-000000000023', 'ff400000-0000-0000-0000-000000000022', 0,
          'short_text', 'peso', 'Peso pré-existente');

-- Target 2: for §G's double-insert (peso -> peso_2 -> peso_3), a clean draft
-- with NO pre-existing collision, so the suffix ladder is driven purely by
-- the block's own two inserts.
insert into public.forms (id, commission_id, title, created_by)
  values ('ff400000-0000-0000-0000-000000000030', (select comm_x from k), 'FF4 alvo 2', (select sa_x from k));
insert into public.form_versions (id, form_id, version_number, status)
  values ('ff400000-0000-0000-0000-000000000031', 'ff400000-0000-0000-0000-000000000030', 1, 'draft');
insert into public.form_sections (id, form_version_id, position, is_default)
  values ('ff400000-0000-0000-0000-000000000032', 'ff400000-0000-0000-0000-000000000031', 0, true);

-- A published form for §H's draft-start default seeding.
insert into public.forms (id, commission_id, title, created_by)
  values ('ff400000-0000-0000-0000-000000000040', (select comm_x from k), 'FF4 defaults', (select sa_x from k));
insert into public.form_versions (id, form_id, version_number, status)
  values ('ff400000-0000-0000-0000-000000000041', 'ff400000-0000-0000-0000-000000000040', 1, 'draft');
insert into public.form_sections (id, form_version_id, position, is_default)
  values ('ff400000-0000-0000-0000-000000000042', 'ff400000-0000-0000-0000-000000000041', 0, true);
insert into public.form_items (id, section_id, position, item_type, question_key, label, default_source) values
  ('ff400000-0000-0000-0000-000000000043', 'ff400000-0000-0000-0000-000000000042', 0, 'date', 'hoje', 'Hoje', 'today'),
  ('ff400000-0000-0000-0000-000000000044', 'ff400000-0000-0000-0000-000000000042', 1, 'short_text', 'sem_default', 'Sem default', null);
select public.publish_form_version('ff400000-0000-0000-0000-000000000041');

-- ---- the FOREIGN tenant, hardcoded (never resolved through an RLS-scoped
--      query — the FF-5 lesson: a cross-tenant id resolved AS authenticated
--      silently reads as null and asserts nothing) ----
insert into public.organizations (id, name, slug)
  values ('ff4f0000-0000-0000-0000-000000000001', 'Org FF4 Estrangeira', 'ff4-org-estrangeira');
insert into public.hospitals (id, organization_id, name, slug)
  values ('ff4f0000-0000-0000-0000-000000000002', 'ff4f0000-0000-0000-0000-000000000001',
          'Hospital FF4 Estrangeiro', 'ff4-hosp-estrangeiro');
insert into public.commissions (id, name, slug, created_by, hospital_id)
  values ('ff4f0000-0000-0000-0000-000000000003', 'Comissão FF4 Estrangeira', 'ff4-comm-estrangeira',
          (select admin_id from k), 'ff4f0000-0000-0000-0000-000000000002');
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', 'ff4f0000-0000-0000-0000-000000000004',
          'authenticated', 'authenticated', 'ff4f0000-0000-0000-0000-000000000004@test', now(), now());
update public.profiles set full_name = 'SA Estrangeira'
  where id = 'ff4f0000-0000-0000-0000-000000000004';
insert into public.memberships (commission_id, principal_id, role)
  values ('ff4f0000-0000-0000-0000-000000000003', 'ff4f0000-0000-0000-0000-000000000004', 'staff_admin');

-- Save the rich block into the library, as sa_x (staff_admin of X). This is
-- ALSO §D's positive control: an internally-closed block saves clean.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select id as entry_id from public.save_block_to_library(
  'ff400000-0000-0000-0000-000000000010', 'Bloco Completo', 'bloco de teste'
) \gset
reset role;
select set_config('request.jwt.claims', null, true);

-- ===========================================================================
-- §A · library_rls_tenant_scoped — a sibling commission in the SAME org
--      cannot read (sa_y / st_y, commission Y); cross-org likewise (the
--      foreign staff_admin). A plain `staff` of the OWNING commission (st_x,
--      not staff_admin) is ALSO excluded — ruling 1's perimeter is
--      staff_admin/commission-admin, not "any member".
--
--      MUTATION: `alter policy form_block_library_select on
--        public.form_block_library using (true)` -> A2-A5 all go GREEN when
--        they must be RED (verified: with the policy widened, sa_y/st_y/st_x/
--        the foreign SA all read the row; restoring the policy reds them
--        again and A1 stays green throughout).
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.form_block_library where id = :'entry_id'),
  1,
  'A1. CONTROL — sa_x (owning commission''s staff_admin) reads the entry');
reset role;
select set_config('request.jwt.claims', null, true);

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.form_block_library where id = :'entry_id'),
  0,
  'A2. a plain staff (not staff_admin) of the OWNING commission reads NOTHING');
reset role;
select set_config('request.jwt.claims', null, true);

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.form_block_library where id = :'entry_id'),
  0,
  'A3. staff_admin of a SIBLING commission (same org) reads NOTHING');
reset role;
select set_config('request.jwt.claims', null, true);

select test_helpers.claims_for('ff4f0000-0000-0000-0000-000000000004'::uuid, false);
set local role authenticated;
select is(
  (select count(*)::int from public.form_block_library where id = :'entry_id'),
  0,
  'A4. staff_admin of a CROSS-ORG commission reads NOTHING');
reset role;
select set_config('request.jwt.claims', null, true);

-- Direct insert-from / write attempts across tenants go through the DOORS
-- (DEFINER, bypasses RLS) — asserted here rather than in §A, since the door's
-- OWN authority check is what excludes them, not the SELECT policy.
--
-- ⚠ THE FF-5 TRAP, avoided on purpose: the target section id is a HARDCODED
-- literal (X's own source-form section), never resolved through a query
-- running AS sa_y. `insert_block_from_library` is DEFINER and reads without
-- RLS, so a section id sa_y genuinely cannot SELECT still resolves to a real
-- version inside the function — reaching the AUTHORITY check and raising
-- 42501. Resolving it via `select id from form_sections limit 1` AS sa_y
-- would return no row (RLS excludes X's sections from Y's staff_admin), so
-- the call would raise `no_data_found` instead — a mismatched SQLSTATE that
-- LOOKS like a pass under a looser assertion but asserts the wrong boundary
-- entirely (a not-found, not an authority denial).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  format(
    $q$select public.insert_block_from_library(%L, 'ff400000-0000-0000-0000-000000000003'::uuid)$q$,
    :'entry_id'
  ),
  '42501', null,
  'A5. sa_y cannot insert X''s library entry into X''s own section — no draft '
  'of theirs is authorized');
reset role;
select set_config('request.jwt.claims', null, true);

-- ===========================================================================
-- §B · library_reader_non_writer (K9), WITH THE WRITER LIVE (the whole point
--      of K9 — the table was write-inert before FF-4 shipped its own writer;
--      what matters is that `authenticated` STILL cannot write it directly).
--
--      MUTATION (verified, two steps — CORRECTED after a wrong first
--      explanation; the coordinator caught the wrongness, not the redness).
--
--      `grant insert, update, delete on public.form_block_library to
--      authenticated` alone reds B2/B3/B4 (pure `has_table_privilege` checks)
--      AND B6/B7 (real UPDATE/DELETE statements) — but B6/B7 do NOT go red
--      because the row becomes reachable. Postgres does NOT reuse a SELECT
--      policy's USING clause for UPDATE/DELETE when no verb-specific policy
--      exists (verified directly: `set local role authenticated; update …`
--      returns `UPDATE 0` — no exception, ZERO rows touched, silently). RLS
--      still excludes every row; `throws_ok` reds B6/B7 because it expected
--      an EXCEPTION and got a silent no-op instead, not because the update
--      "succeeded".
--
--      B5 (INSERT) does NOT flip on the grant alone, but not because RLS
--      "independently blocks" it in the way B6/B7 are blocked either: INSERT
--      has no existing row for a USING filter to exclude, so with no
--      applicable WITH CHECK policy Postgres REJECTS the new row outright —
--      `ERROR: new row violates row-level security policy for table
--      "form_block_library"` (still 42501, so `throws_ok(…, '42501', …)`
--      keeps passing — a real exception, from RLS itself rather than the
--      missing grant, coincidentally satisfying the same assertion). Adding
--      `create policy … for all … using (true) with check (true)` on top
--      supplies the missing USING/WITH CHECK and flips B5 too. Both extra
--      grants/policy dropped afterward; B1 (the SELECT grant) unaffected
--      throughout.
-- ===========================================================================
select ok(has_table_privilege('authenticated', 'public.form_block_library', 'SELECT'),
  'B1. authenticated keeps its SELECT grant');
select ok(not has_table_privilege('authenticated', 'public.form_block_library', 'INSERT'),
  'B2. authenticated has NO INSERT grant');
select ok(not has_table_privilege('authenticated', 'public.form_block_library', 'UPDATE'),
  'B3. authenticated has NO UPDATE grant');
select ok(not has_table_privilege('authenticated', 'public.form_block_library', 'DELETE'),
  'B4. authenticated has NO DELETE grant — the reader must not be able to '
  'destroy what it reads (ADR 0079 exclusion shape)');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $q$insert into public.form_block_library (commission_id, name, snapshot, saved_by_id, saved_by_name, source_form_title, source_version_number)
     values ((select comm_x from k), 'x', '[]'::jsonb, (select sa_x from k), 'x', 'x', 1)$q$,
  '42501', null,
  'B5. a direct INSERT by the OWNING commission''s own staff_admin is denied 42501 — reader, not writer');
select throws_ok(
  format($q$update public.form_block_library set name = 'hacked' where id = %L$q$, :'entry_id'),
  '42501', null,
  'B6. a direct UPDATE by the OWNING commission''s own staff_admin is denied 42501');
select throws_ok(
  format($q$delete from public.form_block_library where id = %L$q$, :'entry_id'),
  '42501', null,
  'B7. a direct DELETE by the OWNING commission''s own staff_admin is denied 42501');
reset role;
select set_config('request.jwt.claims', null, true);

-- ===========================================================================
-- §C · library_doors_revoke_public (ADR 0091 Amendment 2 pattern) — neither
--      door is executable by `public` or `anon`. `proacl` shows grants, never
--      revokes, so this is checked with has_function_privilege, not by
--      re-reading migration text.
--
--      MUTATION: `grant execute on function public.save_block_to_library(uuid,
--        text, text) to public` -> C1 goes green when it must be red
--        (verified; a bare re-`create or replace` without the revoke leaves
--        the widened grant in place — this is EXACTLY the FF-5 regression the
--        standing keystone in 100_dashboard.sql §19 exists to catch, and this
--        section pins these two functions by name per its §19b convention).
-- ===========================================================================
select ok(
  not has_function_privilege('anon', 'public.save_block_to_library(uuid,text,text)', 'EXECUTE')
  and not has_function_privilege('public', 'public.save_block_to_library(uuid,text,text)', 'EXECUTE'),
  'C1. save_block_to_library is neither anon- nor public-executable');
select ok(
  not has_function_privilege('anon', 'public.insert_block_from_library(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('public', 'public.insert_block_from_library(uuid,uuid)', 'EXECUTE'),
  'C2. insert_block_from_library is neither anon- nor public-executable');
select ok(
  has_function_privilege('authenticated', 'public.save_block_to_library(uuid,text,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.insert_block_from_library(uuid,uuid)', 'EXECUTE'),
  'C3. both doors ARE authenticated-executable (the app can still call them)');

-- ===========================================================================
-- §D · snapshot_condition_closure_negative (ruling 3, HC0Q6).
--
--      MUTATION: comment out the "if v_offending is not null…raise" block in
--      save_block_to_library -> D1 stops raising and D2 (offending key named
--      in DETAIL) has nothing to assert against (verified by temporarily
--      redefining the function with the guard removed, confirming the save
--      succeeds where it must refuse, then restoring the real migration body).
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $q$select public.save_block_to_library('ff400000-0000-0000-0000-000000000017', 'Bloco aberto', null)$q$,
  'HC0Q6', null,
  'D1. a subtree whose condition references a key OUTSIDE it refuses HC0Q6');

reset role;
select set_config('request.jwt.claims', null, true);

-- D2: the offending key ('idade') is named in the exception DETAIL, not just
-- reachable by re-reading the source — a caller must be able to build
-- "N chaves renomeadas"-style pt-BR copy from this alone. Captured via a
-- PL/pgSQL probe (GET STACKED DIAGNOSTICS), since throws_ok only pins the
-- SQLSTATE + message, not the DETAIL.
create or replace function pg_temp.probe_closure_detail(p_item uuid)
returns text
language plpgsql
as $$
declare
  v_detail text;
begin
  begin
    perform public.save_block_to_library(p_item, 'Bloco aberto 2', null);
    return 'NO_ERROR';
  exception when sqlstate 'HC0Q6' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail;
  end;
end;
$$;

-- ⚠ EXPLICIT GRANT REQUIRED SINCE `20261003005300` (AE1 close condition #2 / PA-F4).
-- This helper is invoked below as a NON-OWNER role. It used to be executable only because
-- a newly created function inherited the built-in PUBLIC EXECUTE default; that default is
-- now revoked globally for the `postgres` creator role, so the grant must be STATED.
-- ⛔ `to public` reproduces the PRIOR semantics exactly — this is not a widening, and
-- narrowing it to one role would quietly change what this suite exercises.
grant execute on function pg_temp.probe_closure_detail(uuid) to public;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  pg_temp.probe_closure_detail('ff400000-0000-0000-0000-000000000017'),
  'idade',
  'D2. the exception DETAIL names the offending (out-of-subtree) key: idade');
reset role;
select set_config('request.jwt.claims', null, true);

-- D3 (positive control) — the rich block saved in the FIXTURE section above
-- (internally closed: altura -> peso, both inside the subtree) saved WITHOUT
-- raising. If §D's negative were vacuous (e.g. the guard always fired), this
-- entry would not exist.
select ok(:'entry_id' is not null, 'D3. CONTROL — an internally-closed block saves clean (no HC0Q6)');

-- ===========================================================================
-- §E · library_insert_deep_copy — round-trips options + matrix axes +
--      validations + a reference config, over the SAME child-table set as
--      app.copy_version_children (derived from ITS live body, never
--      hand-listed — a sixth child table added to the clone path without
--      joining the library reds this section's structural half).
--
--      MUTATION (structural half): temporarily append a bogus
--      `insert into public.some_new_table (...)` line to a COPY of
--      app.copy_version_children's body and install it under a throwaway
--      name, confirm the extraction below then includes it and the SUBSET
--      assertion reds because insert_block_from_library's body was never
--      touched (verified via the throwaway function, not the real one — the
--      real copy_version_children is restored/untouched throughout).
-- ===========================================================================

-- Structural half: parse `insert into public.<table>` targets out of the
-- LIVE bodies (pg_get_functiondef), never a literal array. `form_items` and
-- `form_sections` are excluded on BOTH sides: they are the version-clone's
-- own structural tables (a whole section, sibling items), not "what an item
-- subtree is" (ADR 0092 §Substrate's table + ruling 8 — a library entry is
-- never a section). Every remaining table copy_version_children inserts into
-- IS a child-table shape ruling 8's subtree carries.
select is(
  (
    select array_agg(distinct m[1] order by m[1])
    from regexp_matches(
      pg_get_functiondef('app.copy_version_children(uuid,uuid)'::regprocedure),
      'insert into public\.(\w+)', 'g'
    ) as m
    where m[1] not in ('form_items', 'form_sections')
  ),
  (
    select array_agg(distinct t order by t)
    from (
      select m[1] as t
      from regexp_matches(
        pg_get_functiondef('public.insert_block_from_library(uuid,uuid)'::regprocedure),
        'insert into public\.(\w+)', 'g'
      ) as m
      union
      select m[1]
      from regexp_matches(
        pg_get_functiondef('app._insert_block_child_rows(uuid,uuid,jsonb)'::regprocedure),
        'insert into public\.(\w+)', 'g'
      ) as m
    ) x
    where t not in ('form_items', 'form_sections')
  ),
  'E1. every child table app.copy_version_children copies (minus form_items/'
  'form_sections, its own version-clone structural tables) is ALSO written by '
  'insert_block_from_library''s own child-row writer — derived from both '
  'functions'' LIVE bodies'
);

-- Behavioral half: the round trip.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.insert_block_from_library(:'entry_id', 'ff400000-0000-0000-0000-000000000022') as insert1 \gset
select (:'insert1')::jsonb ->> 'rootItemId' as root_id \gset
select (:'insert1')::jsonb -> 'renamedKeys' as renamed \gset

select is(
  (select item_type from public.form_items where id = :'root_id'),
  'repeating_group',
  'E2. the round-tripped root is a repeating_group');
select is(
  (select count(*)::int from public.form_items where parent_item_id = :'root_id'),
  5,
  'E3. all 5 children landed');
select is(
  (select count(*)::int from public.form_item_options o
   join public.form_items i on i.id = o.item_id
   where i.parent_item_id = :'root_id' and i.item_type = 'multiple_choice'),
  2,
  'E4. the multiple_choice child''s 2 options landed');
select is(
  (select count(*)::int from public.form_matrix_rows r
   join public.form_items i on i.id = r.item_id
   where i.parent_item_id = :'root_id'),
  2,
  'E5. the matrix child''s 2 rows landed');
select is(
  (select count(*)::int from public.form_matrix_columns c
   join public.form_items i on i.id = c.item_id
   where i.parent_item_id = :'root_id'),
  2,
  'E6. the matrix child''s 2 columns landed');
select is(
  (select count(*)::int from public.form_item_validations val
   join public.form_items i on i.id = val.item_id
   where i.parent_item_id = :'root_id'),
  1,
  'E7. the validation-bearing child''s 1 rule landed, AFTER the parent_item_id '
  're-link (its item_id FK would be unsatisfiable otherwise)');
select is(
  (select config ->> 'referenceKind' from public.form_items
   where parent_item_id = :'root_id' and item_type = 'reference'),
  'commission',
  'E8. the reference child''s config (referenceKind) round-tripped verbatim');
reset role;
select set_config('request.jwt.claims', null, true);

-- ===========================================================================
-- §F · insert_rewrites_conditions_with_keys (ruling 3's defect, pinned).
--      Target 1 already has a pre-existing 'peso' item (fixture above), so
--      the root-level 'peso' collided and was suffixed — the CHILD 'altura'
--      condition (originally {question_key: 'peso', op: is_not_empty}) must
--      now read the RENAMED key, and the PRE-EXISTING item must be untouched.
-- ===========================================================================
select is(
  (:'renamed'::jsonb -> 0 ->> 'oldKey'),
  'peso',
  'F1. the rename map''s one entry has oldKey=peso');
select ok(
  (:'renamed'::jsonb -> 0 ->> 'newKey') <> 'peso',
  'F2. …and a newKey distinct from peso (it collided and was suffixed)');

select is(
  (select (visible_when ->> 'question_key')
   from public.form_items
   where parent_item_id = :'root_id' and question_key = 'altura'),
  (:'renamed'::jsonb -> 0 ->> 'newKey'),
  'F3. the inserted altura''s condition references the RENAMED key, not the '
  'literal peso — the defect this keystone exists to catch'
);
select is(
  (select label from public.form_items where id = 'ff400000-0000-0000-0000-000000000023'),
  'Peso pré-existente',
  'F4. the PRE-EXISTING item that owned the literal peso key is untouched');
select is(
  (select question_key from public.form_items where id = 'ff400000-0000-0000-0000-000000000023'),
  'peso',
  'F5. …and it still owns the literal peso key (the collision resolved on the '
  'INCOMING block, never by displacing what was already there)');

-- ===========================================================================
-- §G · insert_collision_suffix_deterministic — two inserts of the SAME block
--      into ONE clean version yield k_2 then k_3, and the returned map
--      matches what actually landed (not merely "some suffix was applied").
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.insert_block_from_library(:'entry_id', 'ff400000-0000-0000-0000-000000000032') as insert_g1 \gset
select (:'insert_g1')::jsonb -> 'renamedKeys' as renamed1 \gset
select public.insert_block_from_library(:'entry_id', 'ff400000-0000-0000-0000-000000000032') as insert_g2 \gset
select (:'insert_g2')::jsonb -> 'renamedKeys' as renamed2 \gset
reset role;
select set_config('request.jwt.claims', null, true);

-- First insert into a CLEAN version: nothing collides (peso lands as peso).
select is(:'renamed1'::jsonb, '[]'::jsonb,
  'G1. the FIRST insert into a clean version renames nothing');
select is(
  (select count(*)::int from public.form_items
   where section_id = 'ff400000-0000-0000-0000-000000000032' and question_key = 'peso'),
  1,
  'G2. …peso landed as peso');

-- Second insert: peso collides with the FIRST insert's own peso -> peso_2;
-- escolha collides with the first insert's own escolha -> escolha_2.
select is(
  :'renamed2'::jsonb @> jsonb_build_array(jsonb_build_object('oldKey', 'peso', 'newKey', 'peso_2')),
  true,
  'G3. the SECOND insert''s map renames peso -> peso_2 (colliding with the '
  'first insert''s own peso)');
select is(
  (select count(*)::int from public.form_items
   where section_id = 'ff400000-0000-0000-0000-000000000032' and question_key = 'peso_2'),
  1,
  'G4. …and peso_2 actually landed, matching the returned map');

-- ===========================================================================
-- §H · default_prefill_idempotent — seeded exactly at draft creation; a
--      clear-then-resume does not re-seed.
--
--      MUTATION: call app.seed_default_answers a SECOND time (simulating a
--      re-run at resume) after manually clearing the 'hoje' answer -> if the
--      idempotency guard (the partial-unique ON CONFLICT) were absent, the
--      second call would re-insert / overwrite it and H3 would read the
--      resolved value again instead of null (verified: with the ON CONFLICT
--      clause temporarily removed, the second seed call raises a unique
--      violation instead of the no-op H2/H3 expect — restored before commit).
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select id as resp_id from public.start_or_resume_response('ff400000-0000-0000-0000-000000000041') \gset
reset role;
select set_config('request.jwt.claims', null, true);

select is(
  (select count(*)::int from public.answers where response_id = :'resp_id' and question_key = 'hoje'),
  1,
  'H1. draft-start seeded exactly one answer for the today-default item');
select is(
  (select count(*)::int from public.answers where response_id = :'resp_id' and question_key = 'sem_default'),
  0,
  'H2. …and NONE for the item with no default_source');

update public.answers set value = null where response_id = :'resp_id' and question_key = 'hoje';

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select id from public.start_or_resume_response('ff400000-0000-0000-0000-000000000041');
reset role;
select set_config('request.jwt.claims', null, true);

select is(
  (select value from public.answers where response_id = :'resp_id' and question_key = 'hoje'),
  null,
  'H3. …resuming after clearing it does NOT re-seed — idempotent, never '
  'overwrites a cleared answer');

-- H4: the function's OWN idempotency guarantee, called DIRECTLY a second time
-- (H1-H3 only prove start_or_resume_response never RE-INVOKES it on resume —
-- a true and separate property. This proves app.seed_default_answers itself
-- is safe to call twice, which is what its ON CONFLICT DO NOTHING is FOR).
select app.seed_default_answers(
  :'resp_id'::uuid, 'ff400000-0000-0000-0000-000000000041'::uuid,
  (select comm_x from k), (select st_x from k)
);
select is(
  (select value from public.answers where response_id = :'resp_id' and question_key = 'hoje'),
  null,
  'H4. …and calling app.seed_default_answers directly a SECOND time still '
  'does not re-seed the cleared item (the function''s own idempotency, not '
  'just start_or_resume_response never re-invoking it)');

-- ===========================================================================
-- §I · default_source_type_check_negative — every ineligible token x type
--      pairing rejected (23514), and default_source + default_value together
--      rejected. Positive control: every ELIGIBLE pairing succeeds.
--
--      A FRESH draft section — target ...042 above is published (§H froze
--      it), and CHECK constraints are asserted with raw INSERTs, which the
--      published-structure immutability trigger would refuse regardless of
--      the CHECK itself.
-- ===========================================================================
insert into public.forms (id, commission_id, title, created_by)
  values ('ff400000-0000-0000-0000-000000000050', (select comm_x from k), 'FF4 check', (select sa_x from k));
insert into public.form_versions (id, form_id, version_number, status)
  values ('ff400000-0000-0000-0000-000000000051', 'ff400000-0000-0000-0000-000000000050', 1, 'draft');
insert into public.form_sections (id, form_version_id, position, is_default)
  values ('ff400000-0000-0000-0000-000000000052', 'ff400000-0000-0000-0000-000000000051', 0, true);
select throws_ok(
  $q$insert into public.form_items (section_id, position, item_type, question_key, label, default_source)
     values ('ff400000-0000-0000-0000-000000000052', 90, 'number', 'i_bad1', 'Bad', 'today')$q$,
  '23514', null,
  'I1. today on a number item is rejected (23514)');
select throws_ok(
  $q$insert into public.form_items (section_id, position, item_type, question_key, label, default_source)
     values ('ff400000-0000-0000-0000-000000000052', 91, 'date', 'i_bad2', 'Bad', 'now')$q$,
  '23514', null,
  'I2. now on a date item is rejected (23514)');
select throws_ok(
  $q$insert into public.form_items (section_id, position, item_type, question_key, label, default_source)
     values ('ff400000-0000-0000-0000-000000000052', 92, 'number', 'i_bad3', 'Bad', 'current_user_name')$q$,
  '23514', null,
  'I3. current_user_name on a number item is rejected (23514)');
select throws_ok(
  $q$insert into public.form_items (section_id, position, item_type, question_key, label, default_source, default_value)
     values ('ff400000-0000-0000-0000-000000000052', 93, 'short_text', 'i_bad4', 'Bad', 'commission_name', '"x"'::jsonb)$q$,
  '23514', null,
  'I4. default_source + default_value together is rejected (the ruling-6 XOR)');

insert into public.form_items (section_id, position, item_type, question_key, label, default_source) values
  ('ff400000-0000-0000-0000-000000000052', 94, 'date', 'i_ok1', 'Ok1', 'today'),
  ('ff400000-0000-0000-0000-000000000052', 95, 'time', 'i_ok2', 'Ok2', 'now'),
  ('ff400000-0000-0000-0000-000000000052', 96, 'short_text', 'i_ok3', 'Ok3', 'current_user_email'),
  ('ff400000-0000-0000-0000-000000000052', 97, 'free_text', 'i_ok4', 'Ok4', 'commission_name');
select is(
  (select count(*)::int from public.form_items
   where section_id = 'ff400000-0000-0000-0000-000000000052' and question_key like 'i_ok%'),
  4,
  'I5. CONTROL — every eligible token x type pairing is accepted');

-- ===========================================================================
-- §J · library_metadata_door_cannot_touch_snapshot (BE-7, ADR 0092 ruling 2).
--      Ruling 2's snapshot/provenance immutability was a CONVENTION while
--      nothing could write at all; the moment update_block_library_entry
--      exists it becomes a real invariant needing a real proof.
--
--      MUTATION (verified): widen the door's UPDATE to also
--      `set snapshot = '[]'::jsonb` -> J1 (structural) reds immediately, on
--      the door's own live body, with no call needed. Restored from a
--      pg_get_functiondef capture taken before mutating.
-- ===========================================================================
insert into public.forms (id, commission_id, title, created_by)
  values ('ff400000-0000-0000-0000-000000000060', (select comm_x from k), 'FF4 meta', (select sa_x from k));
insert into public.form_versions (id, form_id, version_number, status)
  values ('ff400000-0000-0000-0000-000000000061', 'ff400000-0000-0000-0000-000000000060', 1, 'draft');
insert into public.form_sections (id, form_version_id, position, is_default)
  values ('ff400000-0000-0000-0000-000000000062', 'ff400000-0000-0000-0000-000000000061', 0, true);
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff400000-0000-0000-0000-000000000063', 'ff400000-0000-0000-0000-000000000062', 0,
          'short_text', 'meta_src', 'Fonte Meta');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select id as meta_entry_id from public.save_block_to_library(
  'ff400000-0000-0000-0000-000000000063', 'Bloco Metadata', 'descrição original'
) \gset
reset role;
select set_config('request.jwt.claims', null, true);

select snapshot as meta_snapshot_before, commission_id as meta_commission_before,
       saved_by_id as meta_saved_by_before, source_form_title as meta_title_before
  from public.form_block_library where id = :'meta_entry_id' \gset

-- J1: structural — the LIVE body of update_block_library_entry, parsed via
-- pg_get_functiondef, never mentions any of the columns a metadata rename
-- must not touch inside its own UPDATE...SET clause.
select ok(
  not (
    pg_get_functiondef('public.update_block_library_entry(uuid,text,text)'::regprocedure)
    ~ '(?i)update\s+public\.form_block_library\s+set[^;]*\y(snapshot|commission_id|saved_by_id|saved_by_name|source_form_title|source_version_number)\y'
  ),
  'J1. update_block_library_entry''s SET clause never references snapshot/'
  'commission_id/provenance columns (structural, on its own live body)');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.update_block_library_entry(:'meta_entry_id', 'Bloco Metadata Renomeado', 'nova descrição');
reset role;
select set_config('request.jwt.claims', null, true);

select is(
  (select name from public.form_block_library where id = :'meta_entry_id'),
  'Bloco Metadata Renomeado',
  'J2. …behaviorally: the rename DOES change name');
select is(
  (select description from public.form_block_library where id = :'meta_entry_id'),
  'nova descrição',
  'J3. …and description');
select is(
  (select snapshot from public.form_block_library where id = :'meta_entry_id')::text,
  :'meta_snapshot_before',
  'J4. …while snapshot stays BYTE-IDENTICAL to before the rename');
select is(
  (select commission_id::text from public.form_block_library where id = :'meta_entry_id'),
  :'meta_commission_before',
  'J5. …and commission_id / saved_by_id / source_form_title (provenance) are untouched');
select is(
  (select saved_by_id::text from public.form_block_library where id = :'meta_entry_id'),
  :'meta_saved_by_before',
  'J6. …saved_by_id specifically, unchanged');

-- ===========================================================================
-- §K · tenant-scope negative for the BE-7 doors — a sibling commission's
--      admin (sa_y, commission Y, same org) can neither rename nor delete X's
--      entry. Hardcoded id, resolved through the DEFINER door (which reads
--      without RLS), never through an RLS-scoped query as sa_y — the FF-5
--      trap §A already avoided once in this file.
-- ===========================================================================
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  format($q$select public.update_block_library_entry(%L, 'sequestrado', null)$q$, :'meta_entry_id'),
  '42501', null,
  'K1. sa_y (sibling commission, same org) cannot rename X''s entry');
select throws_ok(
  format($q$select public.delete_block_library_entry(%L)$q$, :'meta_entry_id'),
  '42501', null,
  'K2. …nor delete it');
reset role;
select set_config('request.jwt.claims', null, true);

select is(
  (select name from public.form_block_library where id = :'meta_entry_id'),
  'Bloco Metadata Renomeado',
  'K3. the entry still reads exactly as J2 left it — both denied attempts touched nothing');

-- ===========================================================================
-- §L · delete_safety_no_form_impact (ruling 2's no-live-link design, pinned
--      behaviorally). Deletes the RICH entry §D/§E saved and §E/§F/§G already
--      inserted twice (targets 022 and 032) — the whole point of "insert
--      materializes a copy" is that this delete cannot touch either.
-- ===========================================================================
select count(*)::int as items_022_before from public.form_items
  where section_id = 'ff400000-0000-0000-0000-000000000022' \gset
select count(*)::int as items_032_before from public.form_items
  where section_id = 'ff400000-0000-0000-0000-000000000032' \gset

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.delete_block_library_entry(:'entry_id');
reset role;
select set_config('request.jwt.claims', null, true);

select is(
  (select count(*)::int from public.form_items where section_id = 'ff400000-0000-0000-0000-000000000022'),
  :items_022_before,
  'L1. deleting the source entry removes NO item from a form previously built from it (target 1)');
select is(
  (select count(*)::int from public.form_items where section_id = 'ff400000-0000-0000-0000-000000000032'),
  :items_032_before,
  'L2. …nor from target 2, which received it twice');
select is(
  (select count(*)::int from public.form_block_library where id = :'entry_id'),
  0,
  'L3. …and the library entry itself is genuinely gone');

select * from finish();
rollback;
