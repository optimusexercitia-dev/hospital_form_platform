-- =========================================================================
-- 362 — ADR 0137 Increment 0: the three-mode PHI setting (D1/D2/D3), the
--       narrative column rename (D10) and the narrative assignment role (D11).
--
-- ⛔ EVERY GUARD HERE WAS PROVEN ABLE TO GO RED BEFORE BEING ACCEPTED, and the
--    method is recorded beside each section. A green assertion that cannot fail
--    is this repo's dominant defect family, and "I wrote a test" is not evidence
--    that the predicate under test is the one being exercised.
--
-- ⚠ TWO VACUITY BUGS WERE FOUND IN THIS FILE'S OWN FIRST DRAFT. Both are
--   recorded because the shapes recur:
--     1. `test_helpers.bootstrap()` TRUNCATEs the whole content cluster. The
--        seed-data assertions in §0b originally sat AFTER it and were counting
--        rows in an empty table — they could not have failed. They now run
--        BEFORE the bootstrap, which is the only point in the file where seeded
--        data exists.
--     2. §2 originally probed the CHECK constraints with
--        `update ... where id = (select id from public.cases limit 1)`. Post-
--        truncate that matched ZERO rows, so the refusals never fired — and the
--        `lives_ok` "control" meant to catch exactly that PASSED, because a
--        zero-row UPDATE lives perfectly well. §2 now uses INSERTs, which cannot
--        silently affect nothing.
--
-- ⚠ ONE THING THIS FILE DELIBERATELY DOES NOT TEST, stated rather than omitted:
--   **the Migration A backfill itself.** `supabase db reset` runs migrations
--   against an EMPTY database and applies `seed.sql` AFTERWARDS, so the backfill
--   matches ZERO rows locally. Any assertion of the form "every pre-existing
--   `true` became 'optional'" would pass having exercised nothing. The backfill
--   is asserted AT MIGRATION TIME instead, in `20261003001400`'s `$precheck$`
--   block while BOTH columns still exist — that runs on `db push` against real
--   data, which is the only place the question is answerable. §0b pins what IS
--   locally checkable: D1's "the backfill never produces `required`" rule.
-- =========================================================================
begin;
select plan(58);

-- (0) FLAG PRECONDITIONS — asserted, not assumed. `case_patient` OFF makes every
-- PHI door raise `check_violation` from `assert_case_patient_enabled` FIRST,
-- which would turn §5's refusals into PASS-shaped skips of the predicate they
-- mean to test.
update app.feature_flags set enabled = true
  where key in ('case_patient', 'processless_cases', 'cases_multi_phase',
                'case_narratives', 'ethics', 'audit_trail');
select is(app.feature_enabled('case_patient'), true,
  '0.1 precondition: case_patient ON (its assert fires BEFORE every check below)');
select is(app.feature_enabled('case_narratives'), true, '0.2 precondition: case_narratives ON');
select is(app.feature_enabled('ethics'), true,
  '0.3 precondition: ethics ON (set_case_narrative_assignment_role asserts it first)');

-- =========================================================================
-- (0b) D1's "NEVER required" rule, over the SEEDED data.
--
-- ⛔ THIS SECTION MUST STAY ABOVE `test_helpers.bootstrap()`, WHICH TRUNCATES
--    THE CONTENT CLUSTER. Below it these counts are 0 no matter what the
--    backfill did, and the assertions become unfalsifiable.
--    0b.0 is the guard on that ordering: it asserts the tables are NON-EMPTY, so
--    a future edit that moves this block (or a seed that stops creating cases)
--    reds here instead of silently going vacuous.
-- =========================================================================
select cmp_ok((select count(*)::int from public.cases), '>', 0,
  '0b.0 ⭐ ORDERING GUARD: seeded cases exist at this point — without this, 0b.1/0b.2 below count an empty table and cannot fail');
select is((select count(*)::int from public.cases where patient_mode = 'required'), 0,
  '0b.1 no seeded/backfilled case is `required` (ADR 0137 D1: a boolean carried no evidence of intent to mandate)');
select is((select count(*)::int from public.process_template_versions where patient_mode = 'required'), 0,
  '0b.2 no seeded/backfilled template version is `required` either');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid as sa_x, (v->>'st_x')::uuid as st_x,
         (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- =========================================================================
-- (1) THE SHARED PREDICATE. Four layers ask `app.patient_required_missing` —
--     the three minting doors, the shared PHI writer and the guard trigger — so
--     its semantics are pinned ONCE here rather than inferred four times.
-- =========================================================================
select is(app.patient_required_missing('none', array['mrn'], null), '{}'::text[],
  '1.1 a none-mode case requires nothing, even with a set on file');
select is(app.patient_required_missing('optional', array['mrn'], null), '{}'::text[],
  '1.2 an optional-mode case requires nothing — an empty PHI block stays legal (D1)');
select is(app.patient_required_missing('required', array['mrn','name'], null),
  array['name','mrn'],
  '1.3 a required-mode case with NO payload reports the whole set, in canonical order');
select is(app.patient_required_missing('required', array['mrn'], '{"mrn":"X1"}'::jsonb),
  '{}'::text[], '1.4 a satisfied set reports nothing');
select is(app.patient_required_missing('required', array['mrn'], '{"mrn":"   "}'::jsonb),
  array['mrn'], '1.5 whitespace is not a value');
select is(app.patient_required_missing('required', array['mrn'], '{"mrn":null}'::jsonb),
  array['mrn'], '1.6 JSON null is not a value');
-- ⭐ `sex` is the one field with a non-empty "absent" sentinel: the column
-- defaults to 'unknown' and every writer coalesces to it, so a naive
-- "is it non-empty?" test would make a required `sex` UNFALSIFIABLE — satisfied
-- by the default on every single row.
select is(app.patient_required_missing('required', array['mrn','sex'],
            '{"mrn":"X1","sex":"unknown"}'::jsonb),
  array['sex'],
  '1.7 ⭐ sex = ''unknown'' is NOT a value — otherwise the column default satisfies the requirement on every row and the check could never fail');
select is(app.patient_required_missing('required', array['mrn','sex'],
            '{"mrn":"X1","sex":"female"}'::jsonb),
  '{}'::text[],
  '1.8 CONTROL for 1.7: a real sex value DOES satisfy it, so 1.7 measures the sentinel and not the field');

-- =========================================================================
-- (2) THE CHECK CONSTRAINTS — ADR 0137 D2 welded to D9.
--     `age_years` and `unit` are refused BY THE DATABASE, not merely absent from
--     a picker, so "removed from every case surface" cannot drift back one field
--     at a time.
--
-- ⚠ THESE ARE INSERTs, NOT UPDATEs, FOR TWO SEPARATE REASONS:
--   (a) a zero-row UPDATE raises nothing and passes a `throws_ok`-shaped test
--       for the wrong reason (this file's own first draft did exactly that);
--   (b) `guard_case_patient_mode_immutable_trg` is a BEFORE UPDATE trigger on
--       these very columns, and a BEFORE trigger fires ahead of the CHECK — so
--       an UPDATE probe would raise HC0T3 and never reach the constraint it
--       claims to be testing.
--
-- RED-PROOF (RUN, not asserted): dropping `cases_patient_required_fields_domain`
-- reds exactly 2.1 + 2.2; dropping `cases_required_implies_mrn` reds 2.4 (and,
-- collaterally, 6.2 — the now-legal 2.4 row leaves a deferred check pending that
-- fires at 6.2's forcing statement, which is coherent rather than a defect).
-- =========================================================================
select throws_ok(
  format($$ insert into public.cases
              (commission_id, case_number, created_by, patient_mode, patient_required_fields)
            values (%L, 9581, %L, 'none', array['mrn','age_years']) $$,
         (select comm_x from k), (select sa_x from k)),
  '23514', null,
  '2.1 age_years is refused by the domain CHECK (D2 welded to D9 — not merely absent from the picker)');
select throws_ok(
  format($$ insert into public.cases
              (commission_id, case_number, created_by, patient_mode, patient_required_fields)
            values (%L, 9582, %L, 'none', array['mrn','unit']) $$,
         (select comm_x from k), (select sa_x from k)),
  '23514', null,
  '2.2 unit is refused by the domain CHECK');
select lives_ok(
  format($$ insert into public.cases
              (commission_id, case_number, created_by, patient_mode, patient_required_fields)
            values (%L, 9583, %L, 'none', array['mrn','name']) $$,
         (select comm_x from k), (select sa_x from k)),
  '2.3 CONTROL: an in-vocabulary set IS accepted — so 2.1/2.2 measured the vocabulary and not a broken statement');
select throws_ok(
  format($$ insert into public.cases
              (commission_id, case_number, created_by, patient_mode, patient_required_fields)
            values (%L, 9584, %L, 'required', array['name']) $$,
         (select comm_x from k), (select sa_x from k)),
  '23514', null,
  '2.4 ⭐ required WITHOUT mrn is refused: the MRN is the LGPD erasure key, so a required mode that does not require it produces exactly the un-erasable record ADR 0137 exists to prevent');
-- The template version carries the SAME two constraints. Asserted from the
-- catalog rather than by driving a second fixture: what matters is that the
-- authored setting and its snapshot cannot disagree about the vocabulary.
select col_has_check('public', 'process_template_versions', 'patient_required_fields',
  '2.5 process_template_versions.patient_required_fields carries a CHECK too — the constraint is not case-only');
select is(
  (select count(*)::int from pg_constraint
   where conrelid = 'public.process_template_versions'::regclass
     and conname = 'process_template_versions_required_implies_mrn'),
  1, '2.6 …and the required-implies-mrn weld exists on the authored side as well');

-- =========================================================================
-- (3) THE PHI-TABLE LOCKDOWN.
--
-- ⛔ THIS REPLACES THE "DIRECT-TABLE EXPLOIT" TEST THE PLAN ORIGINALLY ASKED
--    FOR, AND THE REASON MATTERS. That test would have driven a direct INSERT
--    into `patient_identifiers` as `authenticated` and asserted it fails.
--    Measured, `patient_identifiers` / `patient_participants` / `referral_patient`
--    / `event_patient` all carry
--    `relacl = {postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}` —
--    NOTHING is granted to `authenticated` — so that INSERT fails on the GRANT
--    and never reaches any predicate. It would have passed having proven
--    nothing: the fixture cannot reach the failing state.
--    What CAN fail is the lockdown itself, so that is what is asserted. A future
--    migration re-granting any of these tables reds here.
-- =========================================================================
select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('authenticated', 'anon')
     and table_name in ('patient_identifiers', 'patient_participants', 'referral_patient', 'event_patient')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE')),
  0, '3.1 ⛔ LOCKDOWN: authenticated/anon hold NO INSERT/UPDATE/DELETE on any of the four Class-1 PHI tables (the header above names all four; this query previously checked only three — QA C-2)');
select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('authenticated', 'anon')
     and table_name = 'patient_identifiers'),
  0, '3.2 …and no grant of ANY kind on patient_identifiers — the audited DEFINER door is the only path');
select cmp_ok(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated'
     and table_name = 'cases' and privilege_type in ('INSERT','UPDATE','DELETE')),
  '>', 0,
  '3.3 CONTROL: the same view DOES report authenticated''s DML on `cases`, so 3.1/3.2 measure an absence and not a blind query');

-- =========================================================================
-- FIXTURE for §4–§8: one case per mode, built by the OWNER out of band. Building
-- them through a door would make the PHI-write tests depend on the creation
-- tests passing.
-- =========================================================================
create temp table fx on commit drop as
  select gen_random_uuid() as case_req, gen_random_uuid() as case_opt,
         gen_random_uuid() as case_none;
grant select on fx to authenticated;
insert into public.cases
  (id, commission_id, case_number, label, created_by, patient_mode, patient_required_fields)
values ((select case_req  from fx), (select comm_x from k), 9591, 'Caso obrigatorio',
        (select sa_x from k), 'required', array['mrn','name']),
       ((select case_opt  from fx), (select comm_x from k), 9592, 'Caso opcional',
        (select sa_x from k), 'optional', '{}'::text[]),
       ((select case_none from fx), (select comm_x from k), 9593, 'Caso sem PHI',
        (select sa_x from k), 'none', '{}'::text[]);

-- =========================================================================
-- (4) D3 — THE PHI-WRITE REFUSAL, THROUGH **BOTH** DOORS.
--
-- ⭐ THE ENFORCEMENT POINT IS `app._set_participant_patient_unchecked`, NOT
--    `set_case_patient`. `set_case_patient` is a COMPAT door that resolves the
--    case's single patient and delegates to `set_participant_patient`, which
--    delegates to the shared `_unchecked` body. A refusal placed in
--    `set_case_patient` would leave the E1 multi-patient door completely
--    unguarded — Rule 12's "one writer body with TWO gates" failing open — and a
--    test driving only the compat door would report that hole as covered.
--
-- RED-PROOF (RUN, and this is the most important measurement in the file):
--   * removing the `assert_patient_required_fields` call from
--     `_set_participant_patient_unchecked` reds 4.1, 4.2 AND 4.3 together;
--   * ⭐ MOVING that call into `set_case_patient` instead — the exact
--     misplacement ADR 0137 D3 and the implementation plan warn about — leaves
--     **4.1 GREEN and 4.2 RED**. Measured, not predicted. A suite that drove only
--     the compat door would have reported the E1 multi-patient hole as covered,
--     which is precisely why 4.2 exists.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_patient(%L, 'Fulano', null) $$, (select case_req from fx)),
  'HC0T1', null,
  '4.1 COMPAT DOOR: set_case_patient refuses a required-mode write missing the MRN (HC0T1, an AUTHORED code per ADR 0135 — not a reused 23514)');
select throws_ok(
  format($$ select public.set_participant_patient(%L, null, 'Fulano', null) $$, (select case_req from fx)),
  'HC0T1', null,
  '4.2 ⭐ E1 MULTI-PATIENT DOOR: set_participant_patient refuses it TOO — the arm a refusal placed in set_case_patient would have left wide open');
select throws_ok(
  format($$ select public.set_case_patient(%L, null, 'MRN-1') $$, (select case_req from fx)),
  'HC0T1', null,
  '4.3 the OTHER missing field is caught as well: mrn present, required `name` absent');
select lives_ok(
  format($$ select public.set_case_patient(%L, 'Fulano', 'MRN-1') $$, (select case_req from fx)),
  '4.4 CONTROL: a COMPLETE payload is accepted — so 4.1-4.3 measure the required set and not a door that refuses everything');
select test_helpers.reset_role_and_claims();
select is(
  (select pi.mrn from public.patient_identifiers pi
   join public.case_participants cp on cp.participant_id = pi.participant_id
   where cp.case_id = (select case_req from fx)),
  'MRN-1',
  '4.5 …and 4.4 actually WROTE the row — a lives_ok alone passes on a door that silently did nothing');

-- =========================================================================
-- (5) D1 — `optional` behaves byte-identically to the retired
--     `collects_patient = true`, and `none` to `false`.
--     RED-PROOF (RUN): neutralizing `_unchecked`'s `patient_mode = 'none'` guard
--     reds 5.2 ONLY. ⚠ Recorded precisely because the first draft of this comment
--     claimed it "inverts 5.1 and 5.2 together" — it does not: 5.1 is a lives_ok
--     on an optional case, which an over-permissive guard cannot break. A
--     red-proof claim is worth nothing unless the run is the thing quoted.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.set_case_patient(%L, 'Sicrano', null) $$, (select case_opt from fx)),
  '5.1 optional mode accepts a name-only payload — byte-identical to the old collects_patient = true');
select throws_ok(
  format($$ select public.set_case_patient(%L, 'Sicrano', 'MRN-9') $$, (select case_none from fx)),
  '23514', null,
  '5.2 none mode still refuses PHI with the UNCHANGED message and SQLSTATE — existing callers and mappers depend on both');
select throws_ok(
  format($$ select public.set_case_patient(%L, null, null) $$, (select case_opt from fx)),
  '23514', null,
  '5.3 and the ADR-0038 name-or-MRN floor is untouched on an optional case');
select test_helpers.reset_role_and_claims();

-- =========================================================================
-- (6) THE STRUCTURAL BACKSTOP — the DEFERRED constraint trigger on `cases`.
--
-- ⭐ NOT DEFENCE IN DEPTH. `cases` grants `authenticated` full DML and
--    `cases_staff_admin_write` is a FOR ALL policy, so a staff_admin can INSERT
--    a case DIRECTLY over PostgREST without touching a creation RPC — and
--    `app.guard_case_status` has DELETE and UPDATE arms but NO INSERT arm. An
--    argument-shaped check inside the three minting doors leaves that path wide
--    open. This is the BUG-SUP-002 shape ADR 0137 D3 cites.
--
-- ⚠ pgTAP runs inside a transaction that is rolled back, so a DEFERRED trigger
--   never fires on its own here — a test that merely inserted and moved on would
--   be vacuously green. `set constraints ... immediate` is what forces it, and
--   6.2 is the control proving the forcing statement is not itself the failure.
--
-- RED-PROOF (RUN): dropping `guard_case_patient_required_trg` reds 6.1 (and 6.2,
-- whose forcing statement then names a constraint that no longer exists).
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$
    insert into public.cases
      (commission_id, case_number, label, created_by, patient_mode, patient_required_fields)
    values (%L, 9594, 'Direto sem PHI', %L, 'required', array['mrn']);
    set constraints public.guard_case_patient_required_trg immediate;
  $$, (select comm_x from k), (select sa_x from k)),
  'HC0T1', null,
  '6.1 ⭐ a DIRECT-TABLE INSERT of a required-mode case with NO PHI is refused at commit — the path the RPC-level checks structurally cannot see');
select test_helpers.reset_role_and_claims();

select lives_ok(
  $$ set constraints public.guard_case_patient_required_trg immediate $$,
  '6.2 CONTROL: forcing the constraint immediate is legal and silent when nothing is pending — so 6.1 failed on the PREDICATE, not on the forcing statement');
set constraints public.guard_case_patient_required_trg deferred;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.create_case(%L, 'Criado completo', true, '{}'::uuid[], null, null, null,
              jsonb_build_object('name','Beltrano','mrn','MRN-77')) $$,
         (select comm_x from k)),
  '6.3 create_case still works end to end with a PHI payload — the deferral is what lets the case row precede the PHI row');
select test_helpers.reset_role_and_claims();

-- =========================================================================
-- (7) THE SNAPSHOT IS IMMUTABLE — and the disposal path still works.
--
-- ⛔ WITHOUT 7.1 THE §6 TRIGGER IS BYPASSABLE IN TWO STEPS: insert as 'none'
--    (guard passes, correctly), then UPDATE to 'required' — which the
--    INSERT-only trigger never sees.
-- ⭐ 7.3 IS THE ASSERTION THAT CATCHES AN OVER-TIGHT GUARD, and it is the half a
--    one-directional test would omit. `dispose_case_phi` updates OTHER columns of
--    the same row, so the obvious "fix" for 7.1 — adding an UPDATE arm to the §6
--    trigger — would make an LGPD Art. 18 erasure impossible on exactly the cases
--    that most need it.
--
-- RED-PROOF (RUN): dropping `guard_case_patient_mode_immutable_trg` reds 7.1;
-- widening the §6 trigger to `after insert or update` reds 7.3 + 7.4.
-- ⚠ That second proof FAILED on the first attempt and the fix is in 7.3 below:
--   the widened trigger is still DEFERRED, so its check queued for a COMMIT
--   pgTAP never reaches and 7.3 stayed GREEN. The forcing statement inside 7.3
--   is what makes the assertion able to see an UPDATE arm at all.
-- ⚠ 7.1 alone does NOT pin the guard's `patient_required_fields` arm — it
--   changes patient_mode AND patient_required_fields in one statement, so
--   deleting the `or new.patient_required_fields is distinct from
--   old.patient_required_fields` disjunct (or narrowing the trigger to
--   `before update of patient_mode`) left the suite green (QA C-3). 7.1a
--   isolates the second arm: RED-PROOF (RUN, catalog neutralization, not a
--   migration) — replacing `app.guard_case_patient_mode_immutable`'s live
--   body with the `patient_mode`-only predicate reds 7.1a alone with `caught:
--   no exception / wanted: HC0T3` (7.1/7.2/7.3/7.4 stay green, since none of
--   them change patient_required_fields without also changing patient_mode).
--   Restored byte-identical afterward, verified against `pg_get_functiondef`
--   before/after.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ update public.cases set patient_mode = 'required',
              patient_required_fields = array['mrn'] where id = %L $$,
         (select case_opt from fx)),
  'HC0T3', null,
  '7.1 ⭐ the snapshot is IMMUTABLE after INSERT — closing the insert-as-none-then-update-to-required bypass of the §6 trigger');
select throws_ok(
  format($$ update public.cases set patient_required_fields = array['mrn'] where id = %L $$,
         (select case_opt from fx)),
  'HC0T3', null,
  '7.1a ⭐ …and patient_required_fields ALONE is enough, patient_mode untouched: 7.1 changes both columns in one statement, so it alone cannot tell whether the guard''s patient_required_fields arm is doing anything — it would stay GREEN even with that arm deleted (QA C-3)');
select lives_ok(
  format($$ update public.cases set label = 'Rotulo novo' where id = %L $$,
         (select case_opt from fx)),
  '7.2 CONTROL: an ordinary column of the SAME row still updates — the guard is narrow, not a table-wide lock');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
-- ⚠ THE `set constraints ... immediate` IS LOAD-BEARING AND WAS ADDED AFTER A
--   FAILED RED-PROOF. Without it this assertion CANNOT detect the very thing it
--   exists to detect: the §6 trigger is DEFERRABLE INITIALLY DEFERRED, so an
--   UPDATE arm added to it would queue its check for a COMMIT that pgTAP never
--   reaches — the neutralization "widen the trigger to `after insert or update`"
--   left 7.3 GREEN, measured. Forcing the constraint here is what makes the
--   disposal's own UPDATE actually run the check.
select lives_ok(
  format($$ select public.dispose_case_phi(%L, 'subject_request');
            set constraints public.guard_case_patient_required_trg immediate; $$,
         (select case_req from fx)),
  '7.3 ⭐ dispose_case_phi STILL SUCCEEDS on a required-mode case, checks forced — erasure outranks the collection rule (ADR 0035/0131), which is exactly why the §6 trigger is INSERT-only');
set constraints public.guard_case_patient_required_trg deferred;
select test_helpers.reset_role_and_claims();
select is(
  (select count(*)::int from public.patient_identifiers pi
   join public.case_participants cp on cp.participant_id = pi.participant_id
   where cp.case_id = (select case_req from fx)),
  0, '7.4 …and it actually erased the identifiers. A required-mode case therefore ends up, legitimately and permanently, missing fields its own mode demands — THAT IS THE DECISION, not a hole');

-- =========================================================================
-- (8) D10 — THE RENAME, BOTH DIRECTIONS.
--
-- ⚠ A ONE-SIDED CHECK PASSES IF TOO MUCH WAS RENAMED. Asserting only "no body
--   still says type_label" is satisfied by a global rename that also broke the
--   three referral bodies — which address a DIFFERENT column of a DIFFERENT
--   table that ADR 0137 D10 explicitly does not rename.
--
-- RED-PROOF (RUN), one per direction: re-emitting `public.list_my_cases` with
-- `display_label` reverted to `type_label` reds 8.1; re-emitting
-- `public.get_referral_detail` with `type_label` renamed to `display_label` —
-- i.e. simulating the over-rename — reds 8.2.
-- ⚠ 8.7 has NO run red-proof and that is stated rather than implied: changing a
--   parameter name needs a DROP+CREATE, which is too invasive to inject into a
--   rolled-back probe. It is pinned by construction (any signature change alters
--   the `regprocedure` string it compares).
-- =========================================================================
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('app','public') and p.prokind in ('f','p')
     and p.proname in ('trg_audit_case_narratives','add_ad_hoc_narrative',
                       'add_referral_shared_item','create_case_from_template',
                       'get_case_detail','list_my_cases')
     and regexp_replace(pg_get_functiondef(p.oid), '--[^'||chr(10)||']*', '', 'g')
         ~ '\mtype_label\M'),
  0, '8.1 ⭐ zero case-narrative bodies still reference type_label — a rename does NOT rewrite a stored body, so a miss here breaks at RUNTIME, not at migration time');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('create_referral_draft','get_referral_detail','update_referral_draft')
     and pg_get_functiondef(p.oid) ~ '\mtype_label\M'),
  3, '8.2 ⭐ OVER-RENAME GUARD: all THREE referral bodies STILL reference case_referral.type_label, which D10 does not rename');
select has_column('public', 'case_referral', 'type_label',
  '8.3 case_referral.type_label still exists');
select hasnt_column('public', 'case_narratives', 'type_label',
  '8.4 case_narratives.type_label is gone');
select has_column('public', 'case_narratives', 'display_label',
  '8.5 case_narratives.display_label exists');
select is(
  (select count(*)::int from pg_constraint
   where conrelid = 'public.case_narratives'::regclass
     and conname = 'case_narratives_display_label_not_blank'),
  1, '8.6 the not-blank CHECK travelled with the column');
-- ⚠ The RPC PARAMETER `p_new_type_label` is NOT part of the rename: it names the
-- narrative TYPE's label, and renaming it would silently change the signature
-- the TypeScript caller passes BY NAME. A blanket `replace()` would have done
-- exactly that — which is why the migration uses a `\m…\M` word boundary.
select is(
  (select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'add_ad_hoc_narrative'),
  'add_ad_hoc_narrative(uuid,uuid,text,text,text,uuid)',
  '8.7 add_ad_hoc_narrative''s signature is UNCHANGED — p_new_type_label survived the rename');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select isnt(
  (select public.get_case_detail((select case_opt from fx)) -> 'narratives'), null,
  '8.8 get_case_detail still returns a narratives array — the body was re-emitted, not merely renamed around');
select test_helpers.reset_role_and_claims();

-- =========================================================================
-- (9) D11 — the narrative assignment role mirrors the phase twin.
--
-- RED-PROOF (RUN): replacing the `assert_ethics_coordinator` call with a plain
-- `app.commission_of_case` lookup reds 9.4. 9.2/9.3 are the positive control
-- without which 9.4 could be passing because the door is broken for everybody.
-- =========================================================================
select has_column('public', 'case_narratives', 'assignment_role_id',
  '9.1 case_narratives.assignment_role_id exists (D11)');

create temp table narr on commit drop as
  select gen_random_uuid() as nid, gen_random_uuid() as rid;
grant select on narr to authenticated;
insert into public.case_narratives (id, case_id, display_label, display_position, created_by)
  values ((select nid from narr), (select case_opt from fx), 'Resumo 359', 1, (select sa_x from k));
insert into public.case_assignment_roles (id, organization_id, key, display_name)
  values ((select rid from narr), app.org_of_commission((select comm_x from k)),
          'relator_359', 'Relator 359');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.set_case_narrative_assignment_role(%L, %L) $$,
         (select nid from narr), (select rid from narr)),
  '9.2 the coordinator sets a narrative assignment role');
select test_helpers.reset_role_and_claims();
select is(
  (select assignment_role_id from public.case_narratives where id = (select nid from narr)),
  (select rid from narr),
  '9.3 …and it actually WROTE — not a DEFINER that lives while doing nothing');

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_narrative_assignment_role(%L, %L) $$,
         (select nid from narr), (select rid from narr)),
  'HC0J1', null,
  '9.4 a plain member is refused with HC0J1 — the SAME code the phase twin raises');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_narrative_assignment_role(%L, %L) $$,
         (select nid from narr), gen_random_uuid()::text),
  'HC0J0', null,
  '9.5 a role from another org (or none at all) is refused with HC0J0 — mirroring the phase twin');
select test_helpers.reset_role_and_claims();

-- =========================================================================
-- (10) ACLs on the new surface.
--   ⛔ A fresh function's `proacl` is NULL, which is the PERMISSIVE default
--      INCLUDING PUBLIC. "I granted nothing" is not "nobody may call it", so the
--      REVOKE has to be pinned rather than assumed — the same class
--      `supabase/tests/320` §U1 counts in bulk (these four moved that count
--      237 -> 241 on their first run).
--
-- RED-PROOF (RUN): `grant execute ... to public` on the three functions reds
-- 10.2, 10.4 and 10.6 together.
-- =========================================================================
select is(has_function_privilege('authenticated',
    'public.set_case_narrative_assignment_role(uuid,uuid)', 'EXECUTE'),
  true, '10.1 authenticated CAN execute set_case_narrative_assignment_role');
select is(has_function_privilege('anon',
    'public.set_case_narrative_assignment_role(uuid,uuid)', 'EXECUTE'),
  false, '10.2 anon CANNOT — the REVOKE-from-PUBLIC took (the dashboard t19 guard''s subject)');
select is(has_function_privilege('authenticated',
    'public.set_template_patient_mode(uuid,text,text[])', 'EXECUTE'),
  true, '10.3 authenticated CAN execute set_template_patient_mode');
select is(has_function_privilege('anon',
    'public.set_template_patient_mode(uuid,text,text[])', 'EXECUTE'),
  false, '10.4 anon CANNOT');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'set_template_collects_patient'),
  0, '10.5 the retired set_template_collects_patient is GONE — not left as a shadow overload PostgREST would 300 on');
select is(has_function_privilege('anon',
    'app.patient_required_missing(text,text[],jsonb)', 'EXECUTE'),
  false, '10.6 the shared predicate is not PUBLIC-executable — its NULL default ACL was explicitly revoked');

select * from finish();
rollback;
