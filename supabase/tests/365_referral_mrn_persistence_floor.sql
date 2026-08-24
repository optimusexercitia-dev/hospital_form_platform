-- =========================================================================
-- 365 — FUP-0137-MRN-BLANKABLE-AFTER-SEND, SETTLED BY FIXTURE: the blanking is
--       NOT REACHABLE, and this file is what keeps it that way.
--
-- ⭐ THE FOLLOW-UP'S CONCLUSION WAS FALSE, AND IT SAID SO ITSELF. It was raised
--    from `pg_get_functiondef` alone, with the honest caveat that *"a guard read
--    off its definition is exactly the class this project has been wrong about
--    before"* — and it asked for a pgTAP arm to settle it in EITHER direction.
--    Run, the arm settles it: an amend that omits the MRN on a `sent` referral
--    does not blank the erasure key, because the call never commits.
--
-- ⚠ THE MECHANISM IS IN A DIFFERENT OBJECT FROM THE ONE THE FOLLOW-UP READ, and
--   that is the whole lesson. `public.set_referral_patient` really does refuse
--   only `completed`/`rejected`/`withdrawn`, and its `on conflict do update set
--   mrn = excluded.mrn` really does full-replace. Both readings were correct.
--   What the definition cannot show is its LAST statement —
--   `update public.case_referral set has_patient = true` — tripping
--   `app.guard_referral_status`, a BEFORE UPDATE trigger that refuses any edit
--   to a non-`draft` referral outside `app.in_referral_rpc`, a flag this door
--   never sets. The PHI upsert is rolled back with it.
--
-- ⛔ SO THE CLOSURE IS INCIDENTAL, NOT DESIGNED — which is why §2 exists.
--   Nothing in `set_referral_patient` protects the MRN. It is protected by a
--   trigger placed there for status immutability, three objects away. The single
--   edit that OPENS the hole is adding `set_config('app.in_referral_rpc','on')`
--   to this door — the obvious way to implement "let the source coordinator
--   amend PHI after sending", which ADR 0078 D7's amend branch reads as if it
--   already allows. 2.2 reds on exactly that edit. Do not delete it without
--   building the MRN floor the follow-up proposed.
-- =========================================================================
begin;
select plan(12);

update app.feature_flags set enabled = true
  where key in ('case_referrals', 'cases_multi_phase', 'case_narratives',
                'case_patient', 'audit_trail');
select is(app.feature_enabled('case_referrals'), true,
  '0.1 precondition: case_referrals ON — the flag key is `case_referrals`, verified in the catalog (363 §0.1 got this wrong first, and every OTHER assertion still passed)');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid as sa_x, (v->>'st_x')::uuid as st_x,
         (v->>'comm_x')::uuid as comm_x, (v->>'comm_y')::uuid as comm_y
  from ctx;
grant select on k to authenticated;

create temp table cs on commit drop as select gen_random_uuid() as src_case;
grant select on cs to authenticated;
insert into public.cases (id, commission_id, case_number, label, created_by)
  values ((select src_case from cs), (select comm_x from k), 9651, 'Caso origem', (select sa_x from k));

create temp table voc on commit drop as
  select (select id from public.referral_types where key = 'parecer') as type_parecer;
grant select on voc to authenticated;

-- A SENT referral carrying a full PHI block — the state the follow-up could not
-- construct outside the harness, which is why it had to reason instead.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table r1 on commit drop as
  select * from public.create_referral_draft(
    (select src_case from cs), (select comm_y from k),
    (select type_parecer from voc), 'Parecer com prontuario', true,
    'Descricao suficiente para viabilizar o envio.');
grant select on r1 to authenticated;
select public.save_referral_patient((select id from r1), 'Paciente Original', 'MRN-365-1',
                                    '1980-05-04'::date);
select public.send_referral((select id from r1));
select test_helpers.reset_role_and_claims();

select is((select status from public.case_referral where id = (select id from r1)),
  'sent', '0.2 precondition: the referral really is `sent` — every assertion below is about a NON-DRAFT, and a fixture that silently stayed `draft` would make §1 vacuous');
select is((select mrn from public.referral_patient where referral_id = (select id from r1)),
  'MRN-365-1', '0.3 precondition: the MRN really is STORED — §1 must measure a survival, not an absence');

-- =========================================================================
-- (1) THE CLOSURE. The exact call the follow-up predicted would blank the key:
--     a source coordinator amending a SENT referral's name, omitting p_mrn.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($q$ select public.save_referral_patient(%L, 'Nome Corrigido') $q$, (select id from r1)),
  'HC070', null,
  '1.1 ⭐ the predicted blanking call is REFUSED — with HC070 (status immutability) and NOT an MRN-specific code, because no MRN guard exists here. The code is the evidence that the closure is incidental');
select test_helpers.reset_role_and_claims();

select is(
  (select mrn from public.referral_patient where referral_id = (select id from r1)),
  'MRN-365-1',
  '1.2 ⭐ …and the stored erasure key SURVIVED. This is the assertion that settles the follow-up: the upsert is rolled back with the refused `case_referral` update, so a throws_ok alone would not have proven the row intact');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($q$ select public.save_referral_patient(%L, 'Nome Corrigido', '   ') $q$, (select id from r1)),
  'HC070', null,
  '1.3 a spaces-only MRN is refused by the same wall — the whitespace variant needs no `btrim` here, because nothing in this door inspects the MRN at all');
select test_helpers.reset_role_and_claims();

-- =========================================================================
-- (2) WHAT THE CLOSURE ACTUALLY IS — the differential, and the keystone.
--
-- ⚠ 2.1 IS THE ASSERTION THAT PREVENTS THE WRONG CONCLUSION. Without it a
--   reader sees §1 and infers "the MRN is protected". It is not: the door is
--   shut to EVERY post-send PHI write, blanking and correcting alike. State that
--   as a measured fact, or the next reader builds on a protection that is not
--   there.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($q$ select public.save_referral_patient(%L, 'Nome Corrigido', 'MRN-365-1') $q$, (select id from r1)),
  'HC070', null,
  '2.1 ⭐ THE DIFFERENTIAL: re-supplying the CORRECT MRN is refused too. So §1 does not measure an MRN floor — it measures a closed door. The post-send amend branch ADR 0078 D7 gates with `can_amend_referral_phi_snapshot` cannot complete for any non-draft');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'set_referral_patient'
     and regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
         ~ 'in_referral_rpc'),
  0, '2.2 ⛔ THE KEYSTONE — `set_referral_patient` must NOT set `app.in_referral_rpc`. Adding it is the obvious way to make post-send amends work, and it OPENS the blanking hole the follow-up described. If this reds, build the MRN floor before shipping');
select test_helpers.reset_role_and_claims();

select is(
  (select count(*)::int from pg_trigger
   where tgrelid = 'public.case_referral'::regclass and not tgisinternal
     and tgname = 'trg_guard_referral_status'
     and tgenabled = 'O' and tgqual is null),
  1, '2.3 …and the trigger doing the work is ATTACHED, ENABLED and UNCONDITIONAL (no WHEN clause) — a body read from pg_proc is not proof that anything fires it');

-- The terminal-state arm inside the door IS live and reports its own authored
-- code, because it runs BEFORE the upsert. Pinned so the two refusals are not
-- confused for one.
select set_config('app.in_referral_rpc', 'on', true);
update public.case_referral set status = 'withdrawn' where id = (select id from r1);
select set_config('app.in_referral_rpc', 'off', true);
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($q$ select public.save_referral_patient(%L, 'Nome', 'MRN-365-9') $q$, (select id from r1)),
  'HC078', null,
  '2.4 a TERMINAL referral reports the door''s OWN authored refusal (HC078), not the trigger''s HC070 — that arm runs before the upsert, so it is reachable where the sent-status one is not');
select test_helpers.reset_role_and_claims();

-- =========================================================================
-- (3) THE DRAFT PATH IS UNTOUCHED. ADR 0137 D4 keeps `save_referral_patient`'s
--     floor loose on purpose, and names tightening it the most likely
--     well-meant regression. §1's wall must not have leaked into `draft`.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table r2 on commit drop as
  select * from public.create_referral_draft(
    (select src_case from cs), (select comm_y from k),
    (select type_parecer from voc), 'Rascunho em digitacao', true,
    'Descricao suficiente.');
grant select on r2 to authenticated;
select lives_ok(
  format($q$ select public.save_referral_patient(%L, 'Paciente', 'MRN-365-3');
             select public.save_referral_patient(%L, 'Paciente', null); $q$,
         (select id from r2), (select id from r2)),
  '3.1 ⛔ A DRAFT MAY STILL BLANK ITS MRN — D4 keeps the draft save loose, and the send gate (HC0T4, suite 363) is what makes that safe. A floor here is the regression the ADR predicts');
select test_helpers.reset_role_and_claims();
select is(
  (select coalesce(mrn, '(null)') from public.referral_patient where referral_id = (select id from r2)),
  '(null)', '3.2 …and the draft blanking really happened — 3.1''s lives_ok alone would pass on a door that refused quietly');

select * from finish();
rollback;
