-- =========================================================================
-- 363 — ADR 0137 D4: a referral cannot be SENT without an MRN,
--       plus the `bulk_create_cases` row-index wrapper (Inc 0 item 6).
--
-- ⛔ EVERY GUARD HERE WAS PROVEN ABLE TO GO RED, by neutralization, before being
--    accepted. The observed reds are recorded beside each section.
--
-- ⚠ THE ORDERING OF THE REFUSALS IS ITSELF UNDER TEST (§2). The MRN check sits
--   with the CONTENT checks — after authority (HC071) and state (HC070), after
--   the description/item guard (check_violation). That ordering is not cosmetic:
--   if the MRN check ran first, every pre-existing refusal in this door would
--   start reporting HC0T4 instead of its own code, and three suites' throws_ok
--   assertions would be passing on the wrong predicate. §2 pins each earlier
--   refusal STILL WINS against a referral that also lacks an MRN.
-- =========================================================================
begin;
select plan(15);

-- ⚠ THE KEY IS `case_referrals`, NOT `referrals`, and the flag name is not
--   guessable from the predicate name: `app.assert_referrals_enabled` reads
--   `app.feature_enabled('case_referrals')` — verified in the catalog, not
--   inferred. The first draft of this file asserted `'referrals'`, which is a
--   key no row carries, so `feature_enabled` returned false and 0.1 was the only
--   red in the file. ⭐ Worth keeping: EVERY OTHER ASSERTION STILL PASSED,
--   because the flag was already on from the seed — i.e. a precondition that
--   names a nonexistent flag fails LOUDLY here, but the same mistake in a file
--   whose flag happened to be OFF would have skipped the real subject silently.
update app.feature_flags set enabled = true
  where key in ('case_referrals', 'cases_multi_phase', 'case_narratives',
                'case_patient', 'cases_bulk_create', 'audit_trail');
select is(app.feature_enabled('case_referrals'), true,
  '0.1 precondition: case_referrals ON (assert_referrals_enabled fires before every check below)');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid as sa_x, (v->>'st_x')::uuid as st_x,
         (v->>'comm_x')::uuid as comm_x, (v->>'comm_y')::uuid as comm_y
  from ctx;
grant select on k to authenticated;

-- A source case + a narrative to share, so the description/item guard is
-- satisfied and cannot mask the MRN refusal under test.
create temp table cs on commit drop as select gen_random_uuid() as src_case, gen_random_uuid() as narr;
grant select on cs to authenticated;
insert into public.cases (id, commission_id, case_number, label, created_by)
  values ((select src_case from cs), (select comm_x from k), 9601, 'Caso origem', (select sa_x from k));
insert into public.case_narratives (id, case_id, display_label, display_position, body_md, created_by)
  values ((select narr from cs), (select src_case from cs), 'Resumo', 1, 'Corpo.', (select sa_x from k));

-- `referral_types` is a GLOBAL seeded vocabulary (no organization_id column) —
-- resolved by key exactly as 150_referrals does, not minted here.
create temp table voc on commit drop as
  select (select id from public.referral_types where key = 'parecer') as type_parecer;
grant select on voc to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table r1 on commit drop as
  select * from public.create_referral_draft(
    (select src_case from cs), (select comm_y from k),
    (select type_parecer from voc), 'Parecer sem prontuario', true,
    'Descricao suficiente para viabilizar o envio.');
select test_helpers.reset_role_and_claims();
grant select on r1 to authenticated;

-- =========================================================================
-- (1) THE REFUSAL AND ITS COMPLEMENT — both arms, on the same referral.
--
-- ⚠ TWO FAILING SHAPES, NOT ONE. A referral can lack an MRN because it has NO
--   `referral_patient` row at all (1.1 — by far the common case: nobody opened
--   the PHI step) or because it HAS one whose `mrn` is blank (1.2 — the
--   coordinator filled only a name, which the save floor still permits by
--   design). A test that built only the second would leave the first unguarded.
--
-- RED-PROOF (RUN): deleting the MRN block from `public.send_referral` reds
-- 1.1, 1.2a, 1.2b, 1.3 AND 1.4.
-- ⚠ THE CASCADE IS REAL AND THE FIRST DRAFT OF THIS COMMENT DENIED IT. It
--   claimed "1.4 stays green throughout"; measured, it does not. Once 1.1's send
--   succeeds instead of refusing, `r1` is already `sent`, so the later PHI write
--   and the later send both fail for a DIFFERENT reason than the one under test.
--   That makes this neutralization a blunt instrument: it proves the block is
--   load-bearing, but it does NOT isolate which assertion measures what. The
--   isolating evidence is M2 in §2 — which reds 2.1/2.2 while every §1
--   assertion stays green — and 1.4 itself, which passes on the unmodified door
--   with an MRN present.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.send_referral(%L) $$, (select id from r1)),
  'HC0T4', null,
  '1.1 ⭐ NO referral_patient row at all: send is refused with HC0T4 (an AUTHORED code per ADR 0135 — not the check_violation the neighbouring content guard raises)');

-- Name only, no MRN. This is a state the SAVE floor deliberately still permits
-- (ADR 0137 D4: a partially-entered draft must remain saveable), which is
-- exactly why the SEND transition is where the requirement lands.
select lives_ok(
  format($$ select public.save_referral_patient(%L, 'Paciente Sem Prontuario', null) $$,
         (select id from r1)),
  '1.2a ⛔ THE DRAFT-SAVE FLOOR IS UNCHANGED: a name-only PHI block still SAVES. ADR 0137 D4 keeps `name OR mrn` here on purpose; tightening this is the most likely well-meant regression');
select throws_ok(
  format($$ select public.send_referral(%L) $$, (select id from r1)),
  'HC0T4', null,
  '1.2b …but SENDING that same name-only referral is still refused — the requirement is on the transition, not the keystroke');
-- ⚠ The SAVE succeeds (there is no DB floor at all — see §4); the SEND is what
--   refuses. Both statements run inside the one throws_ok so the assertion
--   cannot pass on the save half.
select throws_ok(
  format($$ select public.save_referral_patient(%L, 'Paciente', '   ');
            select public.send_referral(%L); $$,
         (select id from r1), (select id from r1)),
  'HC0T4', null,
  '1.3 whitespace is not an MRN — `btrim` is applied, so a spaces-only value refuses exactly like an absent one');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.save_referral_patient(%L, 'Paciente Completo', 'MRN-360-1');
            select public.send_referral(%L); $$,
         (select id from r1), (select id from r1)),
  '1.4 CONTROL: with an MRN the same referral SENDS — so 1.1-1.3 measure the MRN and not a permanently-closed door');
select test_helpers.reset_role_and_claims();
select is(
  (select status from public.case_referral where id = (select id from r1)),
  'sent', '1.5 …and it actually transitioned to `sent` — a lives_ok alone passes on a door that silently did nothing');

-- =========================================================================
-- (2) REFUSAL ORDERING — every EARLIER guard still wins.
--
-- ⭐ THIS IS THE SECTION THAT PROTECTS OTHER SUITES. Three files assert
--    `throws_ok(..., 'HC071' | 'HC070' | '23514')` against `send_referral`. If
--    the new MRN check had been placed at the top of the door, those assertions
--    would still be GREEN — they would simply have started passing on a
--    different predicate than the one they name. Each is re-asserted here
--    against a referral that ALSO lacks an MRN, which is the only construction
--    in which the ordering is observable.
--
-- RED-PROOF (RUN): moving the MRN block to the top of `send_referral` — above
-- `can_manage_referral_source` — reds 2.1 and 2.2, while §1 stays ENTIRELY
-- green. That combination is the useful one: it isolates the ordering property
-- from the existence property.
-- ⚠ 2.3 stays GREEN under that neutralization, and the first draft of this
--   comment wrongly claimed all three moved. The reason is structural, not
--   luck: by the time 2.3 runs, `r1` HAS an MRN (1.4 set one), so a top-placed
--   MRN check passes and HC070 still wins. 2.3 therefore pins the state guard's
--   precedence over the CONTENT guard, not over the MRN guard, and it cannot be
--   made to do the latter without a second already-sent referral that never
--   received PHI. Recorded rather than quietly over-claimed.
-- =========================================================================
create temp table r2 on commit drop as select gen_random_uuid() as id_placeholder;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table r3 on commit drop as
  select * from public.create_referral_draft(
    (select src_case from cs), (select comm_y from k),
    (select type_parecer from voc), 'Sem descricao nem itens', true);
select test_helpers.reset_role_and_claims();
grant select on r3 to authenticated;

-- 2.1 authority (HC071) still wins over the missing MRN.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.send_referral(%L) $$, (select id from r3)),
  'HC071', null,
  '2.1 ⭐ AUTHORITY STILL WINS: a plain member sending an MRN-less draft gets HC071, not HC0T4 — the door does not leak "this draft is incomplete" to someone with no right to know it exists');
select test_helpers.reset_role_and_claims();

-- 2.2 content guard (check_violation) still wins: r3 has neither description nor items.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.send_referral(%L) $$, (select id from r3)),
  '23514', null,
  '2.2 the description/item guard still wins over the MRN check — the caller learns the cheaper problem first');

-- 2.3 state (HC070) still wins: r1 is already `sent` from §1.4.
select throws_ok(
  format($$ select public.send_referral(%L) $$, (select id from r1)),
  'HC070', null,
  '2.3 a non-draft is still HC070 — re-sending a SENT referral reports its state, not its MRN');
select test_helpers.reset_role_and_claims();

-- =========================================================================
-- (3) THE DOOR IS THE ONLY DOOR — measured, not assumed.
--
-- ⭐ Inc 0 needed a table-level deferred trigger on `cases` because a direct
--    INSERT walked past every RPC check there. THE REFERRAL SHAPE IS DIFFERENT
--    and this section is the measurement that justifies NOT building the same
--    backstop here: `app.guard_referral_status` refuses any `status` change made
--    outside `app.in_referral_rpc`, so `draft -> sent` is structurally
--    RPC-only. Without 3.1 that claim would live only in a migration comment.
--
-- RED-PROOF (RUN): removing the `if not v_in_rpc` arm from
-- `app.guard_referral_status` reds 3.1.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ update public.case_referral set status = 'sent' where id = %L $$, (select id from r3)),
  'HC070', null,
  '3.1 ⭐ a DIRECT-TABLE status change is refused (HC070) — which is why the MRN gate belongs in send_referral and needs no table-level twin, unlike the cases module');
select test_helpers.reset_role_and_claims();

select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('authenticated','anon')
     and table_name = 'referral_patient'),
  0, '3.2 referral_patient remains fully locked down for authenticated/anon — the audited DEFINER door is still the only path to referral PHI');

-- ⛔ THE SAFETY MODULE IS UNCHANGED, AND THAT IS A DECISION.
-- ADR 0137 Consequences: an NSP notification is often filed at the bedside by
-- someone holding a name and no chart. Blocking it is a PATIENT-SAFETY cost, not
-- a compliance win, and the ADR names this as the most likely thing a future
-- reader will "fix". Pinned so the fix is loud rather than quiet.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'set_event_patient'
     and regexp_replace(pg_get_functiondef(p.oid), '--[^'||chr(10)||']*', '', 'g') ~ '\mHC0T4\M'),
  0, '3.3 ⛔ the SAFETY door carries NO MRN requirement — ADR 0137 leaves `name OR mrn` intact for NSP notifications ON PURPOSE');
select test_helpers.reset_role_and_claims();

-- =========================================================================
-- (4) THE ACTION-LAYER FLOOR HAS NO DATABASE TWIN — stated, because "unchanged"
--     is otherwise a claim about something that does not exist.
--
-- ⚠ The implementation plan and ADR 0137 D4 both speak of "the existing
--   `name OR mrn` floor on `save_referral_patient`". Measured: that function is
--   a pure delegation to `public.set_referral_patient`, and NEITHER contains any
--   such check. The only body in the database carrying that rule belongs to the
--   CASE module. 1.2a already proves the behaviour; these two pin the STRUCTURE,
--   so a future reader who goes looking for the DB floor finds this instead of
--   concluding it was deleted.
-- =========================================================================
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('save_referral_patient','set_referral_patient')
     and pg_get_functiondef(p.oid) like '%ao menos o nome ou o prontu%'),
  0, '4.1 neither referral PHI door contains a name-or-MRN floor — the referral floor is action-layer ONLY (src/lib/referrals/actions.ts)');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = '_set_participant_patient_unchecked'
     and pg_get_functiondef(p.oid) like '%ao menos o nome ou o prontu%'),
  1, '4.2 CONTROL: the CASE module''s writer DOES carry it — so 4.1 measures an absence and not a broken LIKE pattern');

-- ⛔ INC 0 ITEM 6 IS NOT TESTED HERE, AND THE REASON IS A CORRECTION.
-- I reported `bulk_create_cases`' `linha N:` row-index wrapper as untested at the
-- end of Increment 0. THAT WAS WRONG: `189_bulk_create_cases.sql` §7 already
-- covers BOTH halves — `throws_ok(..., 'HC068')` proves the wrapper preserves the
-- SQLSTATE, and `throws_like(..., '%linha 2:%')` proves the index is right, on
-- row TWO so a hard-coded 'linha 1' could not pass it. Adding a second copy here
-- would be duplicate coverage bought with a full template fixture.
-- ⚠ The claim was a universal negative ("nothing exercises it") asserted without
--   grepping for the thing itself; one `grep -n linha supabase/tests` would have
--   settled it. Recorded rather than quietly dropped.

select * from finish();
rollback;
