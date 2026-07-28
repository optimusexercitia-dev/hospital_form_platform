-- FF-5 (ADR 0091) — entity reference: the gate keystones.
--
-- ⚠ FILE NUMBER. The task named `270_ff5_references.sql`; 270 is
-- `270_ff1_repeating_groups.sql` and 275 is `275_condition_validator_parity.sql`,
-- so this is 276 — the first free slot.
--
-- ⚠ THE BAR IS ADR 0079's: revert the guard, the keystone must go RED. Every
-- section below names the exact mutation that reds it, and each was RUN, not
-- reasoned about. Seven keystones that could not fail is what that ADR exists to
-- prevent: review found none of them, and reverting the fix found all seven.
-- A keystone that is green on its first run — before its guard exists — is
-- VACUOUS, and green-on-first-run is a finding, not a pass.
--
-- Two vacuity traps this file was specifically built to avoid, both learned here:
--
--   1. NEVER resolve a cross-tenant id through a query running as
--      `authenticated`. RLS returns no row, the payload value becomes JSON null,
--      `app.save_reference_answers` reads that as "clear", writes nothing, and
--      NOTHING RAISES — the test passes while asserting nothing. That happened
--      during this phase's own smoke run. Every foreign id in §E is a HARDCODED
--      literal.
--   2. A no-regression claim passes BY CONSTRUCTION. §B therefore carries an
--      OVER-GRANT TWIN: it fails if a policy is made too WIDE, not only too
--      narrow. A door-parity section that only ever checks "the right person can
--      read" cannot see a policy that lets everyone read.
--
--   §0 — flags asserted, never forced (the pgtap-fixture-flag-gaps scar).
--   §A — rls_answer_references_reader_non_writer (K9, with the writer LIVE).
--   §B — answer_references_door_parity, arm-for-arm, + the over-grant twin.
--   §C — reference_kind_xor_negative (off-diagonals, zero targets, two targets).
--   §D — reference_restrict_delete_negative (all three lanes).
--   §E — cross_tenant_reference_negative (all three lanes, hardcoded ids).
--   §F — patient_candidates_case_scoped.
--   §G — references_never_read_phi (STRUCTURAL, via pg_depend — not a prosrc grep).
--   §H — completeness_reference_arm (+ the hidden+required deadlock-negative).
--   §I — instance_not_empty_by_reference.
--   §J — correction_copies_reference_answers (by value, on the CORRECT instance).
--   §K — supersession_references_excluded.
--   §L — the participant-type label mirror (Rule 10; the SQL half of the pair
--        pinned on the TS side by participant-type-labels.test.ts).

begin;

select plan(53);

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
-- §0 · Flags ASSERTED, not forced. A fixture that quietly enables its own flag
--      makes every flag-guarded keystone below SKIP while the file reports
--      green (the pgtap-fixture-flag-gaps scar). `entity_refs` must already be
--      ON from 20260902000600 — if that migration is ever dropped, 0a reds here
--      rather than the whole phase going dark unnoticed in production.
-- ===========================================================================
select ok(app.feature_enabled('entity_refs'),
  '0a. flag entity_refs is ON (from its own enable migration) — every section depends on it');
select ok(app.feature_enabled('repeating_groups'),
  '0b. flag repeating_groups is ON — §H/§I/§J drive the per-instance arms');
select ok(app.feature_enabled('case_corrections') or app.feature_enabled('response_correction'),
  '0c. a correction flag is ON — §J drives supersede_response');

-- ---------------------------------------------------------------------------
-- FIXTURE (owner). One published form in commission X carrying:
--   sec 0: a scalar gate (the control), the three lanes, a HIDDEN required
--          reference (§H's deadlock-negative), and a repeating group whose only
--          child is a reference (§I).
-- Plus a FOREIGN organization with its own hospital/commission/participant/user,
-- built here with HARDCODED ids so §E can name them without a lookup.
-- ---------------------------------------------------------------------------
insert into public.forms (id, commission_id, title, created_by)
  values ('ff500000-0000-0000-0000-000000000001', (select comm_x from k), 'FF5 referências', (select sa_x from k));
insert into public.form_versions (id, form_id, version_number, status)
  values ('ff500000-0000-0000-0000-000000000002', 'ff500000-0000-0000-0000-000000000001', 1, 'draft');
insert into public.form_sections (id, form_version_id, position, is_default)
  values ('ff500000-0000-0000-0000-000000000003', 'ff500000-0000-0000-0000-000000000002', 0, true);

-- pos 0 — the scalar gate. Load-bearing as a CONTROL: it makes "the same user,
-- same RPC, same transaction writes a scalar and is refused a reference"
-- observable rather than inferred, and it drives the hidden item's condition.
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff500000-0000-0000-0000-000000000010', 'ff500000-0000-0000-0000-000000000003', 0,
          'short_text', 'f5_gate', 'Porta');

-- pos 1/2/3 — one item per lane. pos 1 is REQUIRED (only legal since FF-5
-- relaxed the arm; 209 §B1c is the twin of that release).
insert into public.form_items (id, section_id, position, item_type, question_key, label, required, config)
  values ('ff500000-0000-0000-0000-000000000011', 'ff500000-0000-0000-0000-000000000003', 1,
          'reference', 'f5_part', 'Setor', true,
          jsonb_build_object('referenceKind','participant'));
insert into public.form_items (id, section_id, position, item_type, question_key, label, config)
  values ('ff500000-0000-0000-0000-000000000012', 'ff500000-0000-0000-0000-000000000003', 2,
          'reference', 'f5_comm', 'Comissão', jsonb_build_object('referenceKind','commission'));
insert into public.form_items (id, section_id, position, item_type, question_key, label, config)
  values ('ff500000-0000-0000-0000-000000000013', 'ff500000-0000-0000-0000-000000000003', 3,
          'reference', 'f5_user', 'Pessoa', jsonb_build_object('referenceKind','user'));

-- pos 4 — HIDDEN *and* REQUIRED. §H's deadlock-negative: visibility must win,
-- and it must win in the CALLERS (they conjunct app.eval_visibility before ever
-- reaching item_required_satisfied), not inside the predicate.
insert into public.form_items (id, section_id, position, item_type, question_key, label, required, visible_when, config)
  values ('ff500000-0000-0000-0000-000000000014', 'ff500000-0000-0000-0000-000000000003', 4,
          'reference', 'f5_hidden', 'Oculta', true,
          jsonb_build_object('question_key','f5_gate','op','equals','value','__nunca__'),
          jsonb_build_object('referenceKind','participant'));

-- pos 5/6 — the repeating group and its ONLY child, a reference. §I turns on
-- this composition: an instance whose sole content is a reference.
insert into public.form_items (id, section_id, position, item_type, label, config)
  values ('ff500000-0000-0000-0000-000000000015', 'ff500000-0000-0000-0000-000000000003', 5,
          'repeating_group', 'Setores', jsonb_build_object('minInstances', 0));
insert into public.form_items (id, section_id, position, item_type, question_key, label, parent_item_id, config)
  values ('ff500000-0000-0000-0000-000000000016', 'ff500000-0000-0000-0000-000000000003', 6,
          'reference', 'f5_rg_part', 'Setor do bloco', 'ff500000-0000-0000-0000-000000000015',
          jsonb_build_object('referenceKind','participant'));

select public.publish_form_version('ff500000-0000-0000-0000-000000000002');

-- Home-org participant (the legitimate participant-lane target).
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
  values ('ff500000-0000-0000-0000-0000000000a1'::uuid, (select org_b from k),
          'department', 'non_sensitive', 'UTI');

-- ---- the FOREIGN tenant, hardcoded (trap 1 above) ----
insert into public.organizations (id, name, slug)
  values ('ff5f0000-0000-0000-0000-000000000001', 'Org Estrangeira', 'ff5-org-estrangeira');
insert into public.hospitals (id, organization_id, name, slug)
  values ('ff5f0000-0000-0000-0000-000000000002', 'ff5f0000-0000-0000-0000-000000000001',
          'Hospital Estrangeiro', 'ff5-hosp-estrangeiro');
insert into public.commissions (id, name, slug, created_by, hospital_id)
  values ('ff5f0000-0000-0000-0000-000000000003', 'Comissão Estrangeira', 'ff5-comm-estrangeira',
          (select admin_id from k), 'ff5f0000-0000-0000-0000-000000000002');
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
  values ('ff5f0000-0000-0000-0000-000000000004', 'ff5f0000-0000-0000-0000-000000000001',
          'department', 'non_sensitive', 'Setor Estrangeiro');

-- The response under test, owned by st_x.
insert into public.responses (id, form_version_id, commission_id, created_by, status)
  values ('ff500000-0000-0000-0000-0000000000b1', 'ff500000-0000-0000-0000-000000000002',
          (select comm_x from k), (select st_x from k), 'in_progress');

-- ===========================================================================
-- §A · rls_answer_references_reader_non_writer (K9), asserted WITH THE WRITER
--      LIVE — which is the whole point of K9. The table was write-inert when F3
--      froze it; the claim that matters now is that `authenticated` STILL cannot
--      write it directly even though a DEFINER door writes it every save.
--
--      A reader-non-writer keystone must probe the WRITE verbs individually:
--      the denied party deleting the row it can read is a real exclusion shape
--      (ADR 0079), so INSERT alone is not the test.
--
--      MUTATION: `grant insert, update, delete on public.answer_references to
--        authenticated` -> A2/A3/A4 go green when they must be red. Verified.
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;

-- A1 is the CONTROL: the RPC path DOES write, in this same session, as this same
-- user. Without it, A2-A4 passing could mean the fixture never reaches the table.
select lives_ok(
  $$select public.save_section_answers(
      'ff500000-0000-0000-0000-0000000000b1', 'ff500000-0000-0000-0000-000000000003',
      p_references => ('{"ff500000-0000-0000-0000-000000000011":"' ||
                       'ff500000-0000-0000-0000-0000000000a1'::text || '"}')::jsonb)$$,
  'A1. CONTROL — the creator writes a reference through the DEFINER door');

select throws_ok(
  $$insert into public.answer_references (answer_id, reference_kind, participant_id)
    select a.id, 'participant', 'ff500000-0000-0000-0000-0000000000a1'::uuid
    from public.answers a where a.response_id = 'ff500000-0000-0000-0000-0000000000b1' limit 1$$,
  '42501', null,
  'A2. …but a direct INSERT by `authenticated` is denied 42501 (no write grant)');

select throws_ok(
  $$update public.answer_references set reference_kind = 'commission'$$,
  '42501', null,
  'A3. …and a direct UPDATE is denied');

-- The exclusion shape ADR 0079 names: reading a row is not permission to destroy
-- it, and DELETE is the verb a read-only grant most often forgets.
select throws_ok(
  $$delete from public.answer_references$$,
  '42501', null,
  'A4. …and a direct DELETE is denied (the reader must not be able to destroy what it reads)');

reset role;
select set_config('request.jwt.claims', null, true);

-- ===========================================================================
-- §B · answer_references_door_parity — the SELECT policy set matches
--      `answer_selected_options` ARM FOR ARM: base + corrector + targeted.
--
--      Asserted as ROWS READ under `set local role`, never as a predicate's
--      return value or a pg_policies row count. ETH·E1 produced three RLS leak
--      shapes each invisible to the method that found the last, and its standing
--      lesson is exactly this. A `FOR ALL` policy IS a read policy.
--
--      ⚠ DO NOT JOIN `answers` IN THESE ASSERTIONS. My first version did, and
--      the mutation run proved it worthless: widening
--      `answer_references_select` to `using (true)` left B2a/B3/B4 GREEN,
--      because the join to `answers` is gated by the ANSWERS policy, which was
--      still doing the excluding. The section was measuring a different table's
--      door. That is ETH·E1's "a correct predicate is not correct policies" in
--      its purest form, and only the over-grant twin could have exposed it.
--
--      So the row ids are captured AS OWNER into a temp table, and every
--      assertion below reads `answer_references` ALONE against those ids —
--      making its own policy the only thing that can exclude a row.
--
--      MUTATION: widen either policy's USING to `true` -> B3/B4 red (verified).
--        Drop policy answer_references_select_targeted -> B7 red.
-- ===========================================================================
create temp table refrow on commit drop as
  select ar.id from public.answer_references ar
  join public.answers a on a.id = ar.answer_id
  where a.response_id = 'ff500000-0000-0000-0000-0000000000b1';
grant select on refrow to authenticated;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.answer_references ar
   join refrow rr on rr.id = ar.id),
  1,
  'B1. BASE arm — the response''s creator reads their own reference');
reset role;
select set_config('request.jwt.claims', null, true);

-- B2 — the base arm's THIRD clause is `status = 'submitted' AND
-- is_staff_admin_of(...)`, and the STATUS half of it is load-bearing, not
-- decoration: it is the ADR-0016 invariant that a staff_admin cannot read
-- another member's IN_PROGRESS answers. So the correct assertion here is ZERO
-- while the response is a draft — asserting 1 is what I wrote first, and the
-- suite caught it. The positive half is B2b, after §H submits this response.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.answer_references ar
   join refrow rr on rr.id = ar.id),
  0,
  'B2a. BASE arm — a staff_admin reads ZERO while the response is IN_PROGRESS (ADR 0016)');
reset role;
select set_config('request.jwt.claims', null, true);

-- B3: the TARGETED arm. `sa_y`/`st_y` belong to commission Y only, so no base
-- arm can help them — anything they read comes from the targeted policy alone.
-- Asserted through the policy's own predicate applied to a real row set.
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.answer_references ar
   join refrow rr on rr.id = ar.id),
  0,
  'B3. an outsider with NO targeting reads ZERO — the targeted arm is not a blanket');
reset role;
select set_config('request.jwt.claims', null, true);

-- B4 — THE OVER-GRANT TWIN. st_x2 is an ordinary member of commission X: not the
-- creator, not an admin, not targeted, not a corrector. The base arm's
-- `submitted + is_staff_admin_of` clause must not reach them, and no arm may.
-- This is the assertion that reds if a policy is widened, which every other
-- assertion in §B would survive.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.answer_references ar
   join refrow rr on rr.id = ar.id),
  0,
  'B4. OVER-GRANT TWIN — a plain co-member of the SAME commission reads ZERO (widening reds here)');
reset role;
select set_config('request.jwt.claims', null, true);

-- B5 — the structural half, kept BESIDE the row assertions rather than instead
-- of them: the arm NAMES must match the sibling's. A row test can pass with the
-- right rows reachable through the wrong arm.
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='answer_references' and cmd='SELECT'),
  2,
  'B5. two SELECT policies, mirroring answer_selected_options'' base + targeted split');
select ok(
  (select bool_or(qual like '%can_read_correction_response%') from pg_policies
   where schemaname='public' and tablename='answer_references'),
  'B6. the CORRECTOR arm is present in the policy set (answer_selected_options parity)');
select ok(
  (select bool_or(qual like '%can_access_targeted_response%') from pg_policies
   where schemaname='public' and tablename='answer_references'),
  'B7. the TARGETED arm is present (the arm F3 shipped without — FF-2 QA r1 B-2)');

-- ===========================================================================
-- §C · reference_kind_xor_negative. Run as OWNER: the CHECK is the subject, and
--      running as `authenticated` would be refused by the missing write grant
--      first (§A), which would make every assertion here pass for the wrong
--      reason — a vacuity shape, not a stricter test.
--
--      ⚠ THE COHERENCE TRIGGER IS DISABLED FOR THIS SECTION, and that is the
--      only way the CHECK can actually be tested. `guard_reference_coherent` is
--      a BEFORE INSERT trigger, and BEFORE triggers run ahead of table
--      constraints — so an off-diagonal row (kind='commission' with only a
--      participant_id) is rejected by the TRIGGER with HC0Q5 and never reaches
--      the CHECK at all. My first version expected 23514 and got HC0Q5, which
--      looked like a failing test but was really the wrong guard answering.
--
--      Testing them separately is the stronger claim, not a workaround: "an
--      exclusion is only as strong as its weakest mutator". The CHECK must hold
--      on its own, because it is the layer that survives a trigger being
--      dropped, disabled, or bypassed by a future writer that does not go
--      through the door. §E covers the trigger; this covers the constraint.
--
--      MUTATION: drop constraint answer_references_kind_target_xor -> C1-C6 all
--        go green when they must be red. Verified.
-- ===========================================================================
alter table public.answer_references disable trigger guard_reference_coherent;
-- ⚠ THE ANSWER ROW MUST EXIST, and this is not bookkeeping. My first version of
-- this section pointed `ans` at an item nothing had answered, so every
-- `insert ... select id from ans` inserted ZERO ROWS, raised nothing, and C1-C6
-- all "passed" while testing absolutely nothing. That is the header's own trap,
-- committed by the person who wrote the header. C0 below is the anti-vacuity
-- control that makes it impossible to repeat: if the fixture ever stops
-- reaching the constraint, C0 goes red FIRST and names the reason.
insert into public.answers (response_id, item_id, question_key, group_instance_id)
  values ('ff500000-0000-0000-0000-0000000000b1', 'ff500000-0000-0000-0000-000000000012',
          'f5_comm', null);

create temp table ans on commit drop as
  select a.id from public.answers a
  where a.response_id = 'ff500000-0000-0000-0000-0000000000b1'
    and a.item_id = 'ff500000-0000-0000-0000-000000000012';

-- C0 — THE CONTROL. A well-formed row on the diagonal is ACCEPTED, which proves
-- the inserts below actually reach the CHECK. Without it, "no exception" is
-- indistinguishable from "no rows".
select lives_ok(
  $$insert into public.answer_references (answer_id, reference_kind, commission_id)
    select id, 'commission', (select comm_x from k) from ans$$,
  'C0. CONTROL — a well-formed diagonal row IS accepted (so C1-C6 reach the constraint)');
delete from public.answer_references ar using ans where ar.answer_id = ans.id;

-- Off-diagonal: kind says commission, the populated column is a participant.
select throws_ok(
  $$insert into public.answer_references (answer_id, reference_kind, participant_id)
    select id, 'commission', 'ff500000-0000-0000-0000-0000000000a1'::uuid from ans$$,
  '23514', null,
  'C1. off-diagonal kind=commission + participant_id rejected');
select throws_ok(
  $$insert into public.answer_references (answer_id, reference_kind, commission_id)
    select id, 'participant', 'ff5f0000-0000-0000-0000-000000000003' from ans$$,
  '23514', null,
  'C2. off-diagonal kind=participant + commission_id rejected');
select throws_ok(
  $$insert into public.answer_references (answer_id, reference_kind, profile_id)
    select id, 'commission', (select sa_x from k) from ans$$,
  '23514', null,
  'C3. off-diagonal kind=commission + profile_id rejected');
-- ZERO targets: the shape the F3 one-sided CHECK allowed.
select throws_ok(
  $$insert into public.answer_references (answer_id, reference_kind)
    select id, 'commission' from ans$$,
  '23514', null,
  'C4. ZERO targets rejected (the F3 constraint permitted this)');
-- TWO targets: the other shape it allowed.
select throws_ok(
  $$insert into public.answer_references (answer_id, reference_kind, participant_id, commission_id)
    select id, 'participant', 'ff500000-0000-0000-0000-0000000000a1'::uuid,
           'ff5f0000-0000-0000-0000-000000000003' from ans$$,
  '23514', null,
  'C5. TWO targets rejected');
-- An unlisted kind (hospital/org are deferred, ADR 0086 ruling 5).
select throws_ok(
  $$insert into public.answer_references (answer_id, reference_kind, participant_id)
    select id, 'hospital', 'ff500000-0000-0000-0000-0000000000a1'::uuid from ans$$,
  '23514', null,
  'C6. an unlisted reference_kind rejected (the lane enum is closed)');

-- Re-enabled immediately. C7 asserts it rather than trusting the line above: a
-- section that silently leaves the coherence trigger off would make §D and §E
-- test nothing, and the failure would surface as *passing* tests.
alter table public.answer_references enable trigger guard_reference_coherent;
select ok(
  (select tgenabled <> 'D' from pg_trigger
   where tgrelid = 'public.answer_references'::regclass
     and tgname = 'guard_reference_coherent'),
  'C7. the coherence trigger is RE-ENABLED (so §D/§E are not silently inert)');

-- ===========================================================================
-- §D · reference_restrict_delete_negative — `on delete restrict` on all three
--      FKs. This is what makes ADR 0091 ruling 4 (labels by LIVE JOIN, never
--      snapshotted) SAFE: a dangling reference must be impossible, so deleting a
--      referenced target must RAISE rather than cascade an answer away.
--
--      MUTATION: change any of the three FKs to `on delete cascade` -> that
--        lane's assertion goes green when it must be red. Verified on the
--        participant lane.
-- ===========================================================================
select throws_ok(
  $$delete from public.participants where id = 'ff500000-0000-0000-0000-0000000000a1'::uuid$$,
  '23503', null,
  'D1. deleting a REFERENCED participant raises 23503 — never cascades the answer away');

-- The other two lanes need their own referenced rows.
insert into public.answer_references (answer_id, reference_kind, commission_id)
  select id, 'commission', (select comm_y from k) from ans;
select throws_ok(
  $$delete from public.commissions where id = (select comm_y from k)$$,
  '23503', null,
  'D2. deleting a REFERENCED commission raises');
delete from public.answer_references ar using public.answers a
  where ar.answer_id = a.id and a.item_id = 'ff500000-0000-0000-0000-000000000012';

-- D3 — the user lane is protected TWICE OVER, and the outer guard fires first.
-- `profiles` carries a delete guard (HC-class 23514, "profiles are never
-- deleted; deactivate via is_active"), so the restrict FK is never reached. The
-- keystone's claim — a referenced target can never be deleted out from under a
-- reference — holds by the stronger route; asserting 23503 here (as I first did)
-- asserts the WEAKER guarantee and reds for the wrong reason.
insert into public.answer_references (answer_id, reference_kind, profile_id)
  select id, 'user', (select st_x2 from k) from ans;
select throws_ok(
  $$delete from public.profiles where id = (select st_x2 from k)$$,
  '23514', null,
  'D3. deleting a REFERENCED profile is refused (by the profiles delete guard, in front of the FK)');

-- …and the restrict FK is genuinely there behind it, asserted structurally so
-- D3 does not silently become the only thing protecting the user lane if that
-- guard is ever relaxed.
select is(
  (select count(*)::int from pg_constraint
   where conrelid = 'public.answer_references'::regclass
     and contype = 'f' and confdeltype = 'r'),
  3,
  'D4. all THREE target FKs are ON DELETE RESTRICT (never cascade an answer away)');
delete from public.answer_references ar using public.answers a
  where ar.answer_id = a.id and a.item_id = 'ff500000-0000-0000-0000-000000000012';

-- ===========================================================================
-- §E · cross_tenant_reference_negative — all three lanes, HARDCODED foreign ids.
--
--      ⚠ Read the header's trap 1 before touching this section. Resolving the
--      foreign id with a subquery under `authenticated` makes every assertion
--      here pass while testing NOTHING: RLS hides the row, the payload value
--      becomes JSON null, the writer treats null as "clear" and inserts nothing,
--      so no exception is raised and throws_ok fails — or worse, an earlier
--      formulation silently succeeded. That is not hypothetical; it happened.
--
--      MUTATION: neutralize the org-containment test in
--        app.guard_reference_coherent (make each `if not exists (...)` an
--        `if false`) -> E1/E2/E3 go green when they must be red. Verified.
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;

select throws_ok(
  $$select public.save_section_answers(
      'ff500000-0000-0000-0000-0000000000b1', 'ff500000-0000-0000-0000-000000000003',
      p_references => '{"ff500000-0000-0000-0000-000000000012":"ff5f0000-0000-0000-0000-000000000003"}'::jsonb)$$,
  'HC0Q5', null,
  'E1. COMMISSION lane — a commission of another ORGANIZATION is refused');

select throws_ok(
  $$select public.save_section_answers(
      'ff500000-0000-0000-0000-0000000000b1', 'ff500000-0000-0000-0000-000000000003',
      p_references => '{"ff500000-0000-0000-0000-000000000011":"ff5f0000-0000-0000-0000-000000000004"}'::jsonb)$$,
  'HC0Q5', null,
  'E2. PARTICIPANT lane — a participant of another organization is refused');

reset role;
select set_config('request.jwt.claims', null, true);

-- The user lane's containment is "has a live commission membership in this org",
-- so the foreign party is a real profile with no such membership.
-- `profiles.id` is an FK to `auth.users` and the on_auth_user_created trigger
-- creates the profile row, so the user must be minted the same way bootstrap
-- does it — inserting straight into `profiles` fails 23503.
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', 'ff5f0000-0000-0000-0000-000000000005',
          'authenticated', 'authenticated', 'ff5-estrangeiro@test.local', now(), now());
update public.profiles
   set full_name = 'Estrangeiro',
       home_organization_id = 'ff5f0000-0000-0000-0000-000000000001'
 where id = 'ff5f0000-0000-0000-0000-000000000005';
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$select public.save_section_answers(
      'ff500000-0000-0000-0000-0000000000b1', 'ff500000-0000-0000-0000-000000000003',
      p_references => '{"ff500000-0000-0000-0000-000000000013":"ff5f0000-0000-0000-0000-000000000005"}'::jsonb)$$,
  'HC0Q5', null,
  'E3. USER lane — a person with no membership in this organization is refused');
reset role;
select set_config('request.jwt.claims', null, true);

-- ===========================================================================
-- §F · patient_candidates_case_scoped (ADR 0091 ruling 2). Patients are
--      CASE-scoped; every other participant type is org-scoped.
--
--      MUTATION: delete the `p.participant_type <> 'patient' or (...)` clause
--        from public.reference_candidates -> F2 red. And neutralize the
--        patient branch of app.guard_reference_coherent -> F3 red. Verified.
-- ===========================================================================
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
  values ('ff500000-0000-0000-0000-0000000000a9'::uuid, (select org_b from k),
          'patient', 'patient_phi', 'Paciente');
insert into public.patient_participants (participant_id)
  values ('ff500000-0000-0000-0000-0000000000a9'::uuid);

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;

-- F1 is the CONTROL: the org-scoped type IS a candidate, so F2 failing cannot be
-- "the search returns nothing at all".
select cmp_ok(
  (select count(*)::int from public.reference_candidates(
     'ff500000-0000-0000-0000-0000000000b1', 'ff500000-0000-0000-0000-000000000011', null)
   where target_id = 'ff500000-0000-0000-0000-0000000000a1'::uuid),
  '=', 1,
  'F1. CONTROL — an ORG-scoped participant IS a candidate');

select is(
  (select count(*)::int from public.reference_candidates(
     'ff500000-0000-0000-0000-0000000000b1', 'ff500000-0000-0000-0000-000000000011', null)
   where target_id = 'ff500000-0000-0000-0000-0000000000a9'::uuid),
  0,
  'F2. a PATIENT is NOT a candidate on a STANDALONE response (ruling 2: case-scoped)');

-- …and the search is a convenience, not the boundary (Rule 1). The trigger must
-- refuse the same write when a hand-rolled call skips the picker entirely.
select throws_ok(
  $$select public.save_section_answers(
      'ff500000-0000-0000-0000-0000000000b1', 'ff500000-0000-0000-0000-000000000003',
      p_references => ('{"ff500000-0000-0000-0000-000000000011":"' ||
                       'ff500000-0000-0000-0000-0000000000a9'::text || '"}')::jsonb)$$,
  'HC0Q5', null,
  'F3. …and the TRIGGER refuses it too — the picker is not the security boundary');

reset role;
select set_config('request.jwt.claims', null, true);

-- ===========================================================================
-- §G · references_never_read_phi — asserted STRUCTURALLY, over pg_depend.
--
--      ⚠ NOT by grepping prosrc. A `prosrc` regex matches COMMENTS, and this
--      repo has already fooled itself that way (ADR 0078: "six ways text is not
--      truth"). Both of this phase's read paths NAME `patient_identifiers` in
--      their comments — precisely to say they never touch it — so a body grep
--      would report the opposite of the truth.
--
--      pg_depend records what the PLANNER actually resolved, so a table named
--      only in a comment does not appear. That is the difference between reading
--      the text and reading the fact.
--
--      MUTATION: add `and exists (select 1 from public.patient_identifiers pi
--        where pi.participant_id = p.id)` to reference_candidates -> G1 red.
--        Verified.
-- ===========================================================================
-- ⚠ pg_depend DOES NOT WORK HERE, and finding that out is why the positive twin
-- exists. Both readers are plpgsql / string-bodied SQL, and Postgres does not
-- parse those bodies at creation time — so pg_depend records NO table
-- dependencies for either, and a "0 dependencies on patient_identifiers" test
-- passes for EVERY function ever written, including one that reads nothing but
-- PHI. That is a keystone that cannot fail: the exact ADR-0079 shape. It was
-- caught by G3 below, which asserted the probe could see a dependency that
-- certainly exists (`reference_candidates` -> `participants`) and returned 0.
--
-- Replaced with the NEUTRALIZATION ORACLE, which is this project's own method
-- and is decisive for plpgsql because names are resolved at EXECUTION: rename
-- the PHI tables out from under the functions and run them. A function that
-- touches a renamed relation fails 42P01; one that does not is unaffected.
-- ⚠ AND THE ORACLE FOUND A REAL ONE. ADR 0091's keystone is worded "the
-- candidate search and the label resolver touch neither patient_identifiers NOR
-- professional_profiles". The second half is FALSE for the candidate search, and
-- unavoidably so:
--
--   public.reference_candidates is INVOKER-RIGHTS (ruling 3 — the phase's central
--   security decision), so its own `select ... from public.responses` is gated by
--   `responses_select`, one of whose arms calls
--   app.can_access_targeted_response, which JOINS professional_profiles to
--   decide whether the caller is the targeted professional.
--
-- That is an AUTHORIZATION predicate on the shared responses read path — it runs
-- identically for every reader of `responses`, returns no professional-identity
-- data to the caller, and opens no new surface. Ruling 1's CONCLUSION (no PHI
-- surfaced, no audit door, Rule 12 stays at three modules) is untouched; only its
-- absolute wording is wrong, and rulings 1 and 3 are in tension as written.
-- Surfaced to the lead rather than papered over — and pinned HERE, executably, so
-- nobody later "fixes" this by making the search SECURITY DEFINER, which would
-- satisfy the sentence by destroying the security property.
--
-- The assertions are therefore split by WHICH table and WHICH function.
alter table public.patient_identifiers rename to ff5_phi_probe_pi;

-- G1 — the ORACLE'S OWN CONTROL. A probe function that genuinely reads PHI must
-- FAIL while the tables are renamed. Without this, G2/G3 passing would be
-- equally consistent with "renaming does not break anything", which would make
-- them vacuous in a new and subtler way.
create function pg_temp.ff5_phi_oracle() returns bigint
language plpgsql stable as $probe$
begin
  return (select count(*) from public.patient_identifiers);
end $probe$;

select throws_ok(
  $$select pg_temp.ff5_phi_oracle()$$,
  '42P01', null,
  'G1. ORACLE CONTROL — a function that DOES read patient_identifiers fails while it is renamed');

-- G2 — THE CLASS-1 CLAIM, which is what Rule 12 and ruling 1 are actually about:
-- the candidate search never touches PATIENT PHI. Only patient_identifiers is
-- renamed here, so this is a clean, true assertion rather than one weakened to
-- fit.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  $$select count(*) from public.reference_candidates(
      'ff500000-0000-0000-0000-0000000000b1', 'ff500000-0000-0000-0000-000000000011', null)$$,
  'G2. the CANDIDATE SEARCH runs with patient_identifiers renamed away (no Class-1 PHI read)');
reset role;
select set_config('request.jwt.claims', null, true);

-- G3 — the LABEL RESOLVER is clean of BOTH. It is SECURITY DEFINER, so no RLS
-- policy runs on its behalf and there is no authorization path to muddy the
-- claim: this is the unqualified version of the keystone.
alter table public.professional_profiles rename to ff5_phi_probe_pp;
select lives_ok(
  $$select app.references_by_item('ff500000-0000-0000-0000-0000000000b1', null)$$,
  'G3. the LABEL RESOLVER / sign-off projection runs with BOTH PHI tables renamed away');

-- G4 — the DOCUMENTED EXCEPTION, asserted rather than described. The candidate
-- search DOES fail while professional_profiles is renamed, because
-- responses_select -> can_access_targeted_response joins it. Pinning the failure
-- means the day someone makes that join go away (or makes the search DEFINER to
-- "fix" this), G4 reds and forces the question back into the open instead of
-- letting the security posture change quietly.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$select count(*) from public.reference_candidates(
      'ff500000-0000-0000-0000-0000000000b1', 'ff500000-0000-0000-0000-000000000011', null)$$,
  '42P01', null,
  'G4. DOCUMENTED — the search DOES reach professional_profiles, via the responses AUTHORIZATION path (ruling 3), not the reference lane');
reset role;
select set_config('request.jwt.claims', null, true);

alter table public.ff5_phi_probe_pi rename to patient_identifiers;
alter table public.ff5_phi_probe_pp rename to professional_profiles;

-- G5 — the tables really are back, so nothing downstream inherits a renamed
-- catalog if this section is ever edited.
select ok(to_regclass('public.patient_identifiers') is not null
          and to_regclass('public.professional_profiles') is not null,
  'G5. both PHI tables are restored');

-- ===========================================================================
-- §H · completeness_reference_arm + the DEADLOCK-NEGATIVE.
--
--      MUTATION: delete the `reference` arm from app.item_required_satisfied ->
--        H2 red (the required reference stops blocking). Verified.
-- ===========================================================================
-- Clear the reference written in §A so the required item is unanswered again.
delete from public.answer_references ar using public.answers a
  where ar.answer_id = a.id and a.response_id = 'ff500000-0000-0000-0000-0000000000b1';

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;

select throws_ok(
  $$select public.submit_response('ff500000-0000-0000-0000-0000000000b1')$$,
  'HC011', null,
  'H1. a REQUIRED reference BLOCKS submit while unanswered');

select lives_ok(
  $$select public.save_section_answers(
      'ff500000-0000-0000-0000-0000000000b1', 'ff500000-0000-0000-0000-000000000003',
      p_references => ('{"ff500000-0000-0000-0000-000000000011":"' ||
                       'ff500000-0000-0000-0000-0000000000a1'::text || '"}')::jsonb)$$,
  'H2. …answering it is accepted');

-- H3 is the DEADLOCK-NEGATIVE. `f5_hidden` is required AND hidden (its condition
-- can never be true). If visibility did not win, submit would be permanently
-- unsatisfiable and the form unshippable. Visibility is applied by the CALLERS,
-- before item_required_satisfied is ever reached — H3 asserts that from outside.
select lives_ok(
  $$select public.submit_response('ff500000-0000-0000-0000-0000000000b1')$$,
  'H3. DEADLOCK-NEGATIVE — a HIDDEN required reference never blocks submit');

reset role;
select set_config('request.jwt.claims', null, true);

-- B2b — the POSITIVE half of §B's base-arm third clause, deferred to here
-- because it needs a SUBMITTED response. Together with B2a it pins the clause in
-- BOTH directions: the staff_admin arm exists (B2b) and it is gated on status
-- (B2a). Either assertion alone is satisfiable by a wrong policy.
-- MUTATION: delete `r.status = 'submitted' and` from the base arm -> B2a red.
--           delete the whole is_staff_admin_of clause -> B2b red.
--
-- `refrow` is RE-CAPTURED first: §H cleared and rewrote this response's
-- references, so the id captured back at §B belongs to a deleted row. Without
-- this refresh B2b reads 0 and "passes" as a false negative — the same
-- stale-fixture shape that makes a keystone untrustworthy.
delete from refrow;
insert into refrow
  select ar.id from public.answer_references ar
  join public.answers a on a.id = ar.answer_id
  where a.response_id = 'ff500000-0000-0000-0000-0000000000b1';

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.answer_references ar
   join refrow rr on rr.id = ar.id),
  1,
  'B2b. BASE arm — the same staff_admin DOES read it once the response is SUBMITTED');
reset role;
select set_config('request.jwt.claims', null, true);

-- ===========================================================================
-- §I · instance_not_empty_by_reference. An instance whose ONLY content is a
--      reference must SURVIVE submit with its reference intact.
--
--      Without the app.instance_is_empty arm, submit_response prunes the
--      instance as empty and the `on delete cascade` on answer_id takes the
--      reference with it — the user's answer silently destroyed at submit. FF-2
--      left that warning in its own body by name.
--
--      MUTATION: delete the answer_references arm from app.instance_is_empty ->
--        I2 red (0 rows survive). Verified — this is the one that matters most,
--        because its failure mode is silent data loss rather than an error.
-- ===========================================================================
insert into public.responses (id, form_version_id, commission_id, created_by, status)
  values ('ff500000-0000-0000-0000-0000000000b2', 'ff500000-0000-0000-0000-000000000002',
          (select comm_x from k), (select st_x2 from k), 'in_progress');

select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;

select public.save_section_answers(
  'ff500000-0000-0000-0000-0000000000b2', 'ff500000-0000-0000-0000-000000000003',
  p_references => ('{"ff500000-0000-0000-0000-000000000011":"' ||
                   'ff500000-0000-0000-0000-0000000000a1'::text || '"}')::jsonb);

create temp table inst on commit drop as
  select (public.add_group_instance('ff500000-0000-0000-0000-0000000000b2',
                                    'ff500000-0000-0000-0000-000000000015')).id as id;

select public.save_section_answers(
  'ff500000-0000-0000-0000-0000000000b2', 'ff500000-0000-0000-0000-000000000003',
  p_instance_answers => jsonb_build_array(jsonb_build_object(
    'instance_id', (select id from inst),
    'references', ('{"ff500000-0000-0000-0000-000000000016":"' ||
                   'ff500000-0000-0000-0000-0000000000a1'::text || '"}')::jsonb)));

-- I1 is the CONTROL: the instance reference really was written before submit.
select is(
  (select count(*)::int from public.answer_references ar
   join public.answers a on a.id = ar.answer_id
   where a.response_id = 'ff500000-0000-0000-0000-0000000000b2'
     and a.group_instance_id is not null),
  1,
  'I1. CONTROL — an instance-scoped reference is written (the per-instance save arm works)');

select lives_ok(
  $$select public.submit_response('ff500000-0000-0000-0000-0000000000b2')$$,
  'I2. …submit succeeds');

select is(
  (select count(*)::int from public.answer_references ar
   join public.answers a on a.id = ar.answer_id
   where a.response_id = 'ff500000-0000-0000-0000-0000000000b2'
     and a.group_instance_id is not null),
  1,
  'I3. …and the reference-ONLY instance SURVIVED submit with its reference intact');

reset role;
select set_config('request.jwt.claims', null, true);

-- ===========================================================================
-- §J · correction_copies_reference_answers — BY VALUE, ON THE CORRECT INSTANCE.
--
--      ⚠ THE TRAP (FF-1's P0-1, verbatim). A correction gives the successor its
--      OWN response_group_instances rows, so any join matching new.group_instance
--      _id to old.group_instance_id is UNSATISFIABLE BY CONSTRUCTION and silently
--      copies nothing for anything inside a repeating group. FF-1's own K4
--      counted `answers` rows against a short_text-only fixture and was blind to
--      it. J3 is the assertion that is not.
--
--      MUTATION: remove the answer_references insert from
--        app.copy_response_answers -> J2/J3 red. And change the resolving join to
--        compare group_instance_id directly -> J3 red while J2 stays green,
--        which is precisely the P0-1 signature. Verified BOTH.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

create temp table succ on commit drop as
  select (public.supersede_response('ff500000-0000-0000-0000-0000000000b2', 'correção de teste')).id as id;

select is(
  (select count(*)::int from public.answer_references ar
   join public.answers a on a.id = ar.answer_id
   where a.response_id = (select id from succ) and a.group_instance_id is null),
  1,
  'J1. the TOP-LEVEL reference survives the correction');

select is(
  (select count(*)::int from public.answer_references ar
   join public.answers a on a.id = ar.answer_id
   where a.response_id = (select id from succ) and a.group_instance_id is not null),
  1,
  'J2. …and the IN-INSTANCE reference is copied at all (the arm exists)');

-- BY VALUE, and on the instance with the PRESERVED (group_item_id, position)
-- identity — not merely "some instance row exists".
select is(
  (select gi.group_item_id::text || '#' || gi.position::text || '=' || ar.participant_id::text
   from public.answer_references ar
   join public.answers a on a.id = ar.answer_id
   join public.response_group_instances gi on gi.id = a.group_instance_id
   where a.response_id = (select id from succ)),
  'ff500000-0000-0000-0000-000000000015#0=' || 'ff500000-0000-0000-0000-0000000000a1',
  'J3. …ON THE CORRECT SUCCESSOR INSTANCE and by VALUE (the P0-1 trap)');

reset role;
select set_config('request.jwt.claims', null, true);

-- ===========================================================================
-- §K · supersession_references_excluded — a superseded predecessor drops out of
--      the reference rollup. Built on app.submitted_form_responses, the same
--      helper the five shipped aggregations use, so this cannot drift from them.
--
--      MUTATION: replace app.submitted_form_responses with a plain
--        `status = 'submitted'` filter in dashboard_entity_references -> K2 red
--        (the predecessor's reference reappears, doubling the count). Verified.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

-- K1 is the CONTROL: the aggregation sees the form at all, for this caller.
select cmp_ok(
  (select count(*)::int from public.dashboard_entity_references('ff500000-0000-0000-0000-000000000001')),
  '>=', 1,
  'K1. CONTROL — the staff_admin gets rows from the reference aggregation');

-- r2 is superseded by an in_progress successor, so it is STILL countable (the
-- helper excludes only a predecessor whose successor is SUBMITTED). Submitting
-- the successor is what must flip it — and the count must stay 1, not become 2.
select public.save_section_answers(
  (select id from succ), 'ff500000-0000-0000-0000-000000000003',
  p_references => ('{"ff500000-0000-0000-0000-000000000011":"' ||
                   'ff500000-0000-0000-0000-0000000000a1'::text || '"}')::jsonb);
select public.submit_response((select id from succ));

-- K2 keys on `f5_rg_part`, the REPEATING-GROUP child, because that question_key
-- exists on exactly two responses in this fixture — the superseded predecessor
-- and its successor — so "1" can only mean the predecessor was excluded.
-- Keying on `f5_part` (as I first did) reads 2, and correctly so: r1 was also
-- submitted in §H and legitimately contributes. A keystone whose expected value
-- depends on unrelated fixtures elsewhere in the file is one edit away from
-- being tuned to whatever it happens to return.
select is(
  (select coalesce(sum(ref_count), 0)::int
   from public.dashboard_entity_references('ff500000-0000-0000-0000-000000000001')
   where question_key = 'f5_rg_part'),
  1,
  'K2. the SUPERSEDED predecessor is EXCLUDED — the successor counts ONCE, not twice');

-- K3 — the twin that stops K2 from passing by "the aggregation returns nothing".
-- r1 (submitted, never superseded) and the successor each contribute one
-- `f5_part`; the superseded r2 contributes none.
select is(
  (select coalesce(sum(ref_count), 0)::int
   from public.dashboard_entity_references('ff500000-0000-0000-0000-000000000001')
   where question_key = 'f5_part'),
  2,
  'K3. …while the two NON-superseded responses (r1 + successor) both still count');

reset role;
select set_config('request.jwt.claims', null, true);

-- ===========================================================================
-- §L · The participant-type label mirror (Architecture Rule 10).
--
--      `app.participant_type_label` is the SQL authority; PARTICIPANT_TYPE_LABELS
--      in src/lib/forms/reference-constants.ts is its TS mirror. Two copies are
--      structurally necessary (the builder labels types client-side; the sign-off
--      projection is DEFINER SQL), so the pair carries the mirrored-evaluator
--      obligation: it must not drift.
--
--      THE LITERALS BELOW ARE THE SHARED VECTOR — byte-identical to the ones in
--      participant-type-labels.test.ts. Changing a label on one side alone reds
--      one of the two suites. Asserting the function against itself would be
--      vacuous, which is why they are written out.
--
--      MUTATION: revert either emission site to the raw `p.participant_type` ->
--        L2/L3 red. Verified.
-- ===========================================================================
select is(
  (select string_agg(app.participant_type_label(t), '|' order by t)
   from unnest(array['department','external_person','institution','other',
                     'patient','professional','regulatory_body']) t),
  'Setor|Pessoa externa|Instituição|Outro|Paciente|Profissional|Órgão regulador',
  'L1. the SQL vocabulary matches the TS mirror byte-for-byte (the shared vector)');

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select sublabel from public.reference_candidates(
     'ff500000-0000-0000-0000-0000000000b1', 'ff500000-0000-0000-0000-000000000011', null)
   where target_id = 'ff500000-0000-0000-0000-0000000000a1'::uuid),
  'Setor',
  'L2. the TYPEAHEAD emits pt-BR, not the raw `department` identifier (Rule 10)');
reset role;
select set_config('request.jwt.claims', null, true);

select is(
  app.references_by_item('ff500000-0000-0000-0000-0000000000b1', null)
    -> 'ff500000-0000-0000-0000-000000000011' ->> 'sublabel',
  'Setor',
  'L3. …and so does the SIGN-OFF PROJECTION — the site the bug report did not name');

select * from finish();
rollback;
