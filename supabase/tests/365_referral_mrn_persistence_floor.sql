-- =========================================================================
-- 365 — FUP-0137-MRN-BLANKABLE-AFTER-SEND: the blanking is NOT REACHABLE, and
--       this file is what keeps it that way.
--
-- ⭐ THE FOLLOW-UP'S CONCLUSION WAS FALSE, AND IT SAID SO ITSELF. It was raised
--    from `pg_get_functiondef` alone, with the honest caveat that *"a guard read
--    off its definition is exactly the class this project has been wrong about
--    before"* — and it asked for a pgTAP arm to settle it in EITHER direction.
--    Run, the arm settles it: an amend that omits the MRN on a `sent` referral
--    does not blank the erasure key.
--
-- ⛔⛔ THE REASON WHY CHANGED ON 2026-08-24, AND THE OLD REASON IS KEPT HERE
--    BECAUSE IT IS THE LESSON.
--
--    UNTIL THEN the closure was INCIDENTAL. `public.set_referral_patient`
--    refused only `completed`/`rejected`/`withdrawn`, and its `on conflict do
--    update set mrn = excluded.mrn` really does full-replace — so on a `sent`
--    referral the door ran the PHI upsert and only then hit its own LAST
--    statement, `update public.case_referral set has_patient = true`, tripping
--    `app.guard_referral_status` (HC070) — a BEFORE UPDATE trigger placed there
--    for STATUS IMMUTABILITY, three objects away, refusing any edit to a
--    non-`draft` referral outside `app.in_referral_rpc`. The upsert rolled back
--    with it. Nothing in the door protected the MRN; a trigger about something
--    else did, and the caller was told *"mudanças de estado do encaminhamento
--    devem passar pelas RPCs"* for a PHI edit.
--
--    ⭐ AN ACCIDENTAL GUARD IS ONE REFACTOR FROM REMOVAL BY SOMEONE WHO CANNOT
--    SEE WHAT IT HOLDS UP. The single edit that opened the hole was adding
--    `set_config('app.in_referral_rpc','on')` to this door — the obvious way to
--    implement "let the source coordinator amend PHI after sending", which ADR
--    0078 D7's amend branch reads as if it already allows.
--
--    SINCE THE PO RULING (FUP-0137-POSTSEND-PHI-AMEND-IS-DEAD, shape (a):
--    post-send PHI amendment is NOT a product capability), migration
--    `20261003001700` moved the refusal INTO the door: a non-`draft` referral is
--    refused BEFORE any row is written, with the door's own HC078 and a message
--    about patient data. Same outcome, stated instead of stumbled into.
--
-- ⚠ WHAT THAT MEANS FOR THIS FILE. §1/§2.1 now pin HC078 rather than HC070, and
--   they no longer prove the closure is incidental — they prove it is the DOOR'S.
--   §2.2 keeps pinning the absence of `in_referral_rpc`, now as defence in depth
--   rather than as the only thing standing there. ⛔ If post-send amendment is
--   ever wanted, deleting the status arm is NOT sufficient: the full-replace
--   upsert is untouched, so an amend that omits the MRN would blank it. Build the
--   MRN persistence floor in the same change — §2.5 is the differential that
--   would then have to be re-argued.
-- =========================================================================
begin;
select plan(13);

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
  'HC078', 'encaminhamento já enviado; os dados do paciente não podem mais ser alterados',
  '1.1 ⭐ the predicted blanking call is REFUSED — by the DOOR''S OWN authored HC078, naming PATIENT DATA. ⛔ The MESSAGE is load-bearing: until 2026-08-24 this refusal was the status trigger''s HC070 ("mudanças de estado … devem passar pelas RPCs"), a sentence about lifecycle transitions surfaced for a PHI edit. An errcode-only assertion would pass on either, and would not notice the door losing its arm and falling back on the trigger again');
select test_helpers.reset_role_and_claims();

select is(
  (select mrn from public.referral_patient where referral_id = (select id from r1)),
  'MRN-365-1',
  '1.2 ⭐ …and the stored erasure key SURVIVED. A throws_ok alone would not prove the row intact — and this is the assertion that reds if someone deletes the status arm to "enable post-send amends": the full-replace upsert would then run and blank the MRN (`have: NULL`)');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($q$ select public.save_referral_patient(%L, 'Nome Corrigido', '   ') $q$, (select id from r1)),
  'HC078', null,
  '1.3 a spaces-only MRN is refused by the same wall — the whitespace variant needs no `btrim` here, because the door refuses on STATUS before it ever inspects the MRN');
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
  'HC078', null,
  '2.1 ⭐ THE DIFFERENTIAL: re-supplying the CORRECT MRN is refused too. So §1 does not measure an MRN floor — it measures a closed door. `can_amend_referral_phi_snapshot` (ADR 0078 D7) therefore governs ONLY draft re-saves; PO-ruled 2026-08-24 that post-send amendment is not a product capability, and the door says so itself');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'set_referral_patient'
     and regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
         ~ 'in_referral_rpc'),
  0, '2.2 ⛔ DEFENCE IN DEPTH — `set_referral_patient` must NOT set `app.in_referral_rpc`. ⚠ Until 2026-08-24 this was THE keystone: the flag was the single edit that opened the blanking, because the status trigger was the only thing refusing. The door now refuses on status itself, so this is no longer load-bearing ALONE — it is the second lock, and it is kept because the two locks fail independently');
select test_helpers.reset_role_and_claims();

select is(
  (select count(*)::int from pg_trigger
   where tgrelid = 'public.case_referral'::regclass and not tgisinternal
     and tgname = 'trg_guard_referral_status'
     and tgenabled = 'O' and tgqual is null),
  1, '2.3 …and the trigger doing the work is ATTACHED, ENABLED and UNCONDITIONAL (no WHEN clause) — a body read from pg_proc is not proof that anything fires it');

-- ⚠ BOTH non-draft arms now report HC078, so the CODE no longer tells them apart
-- and only the MESSAGE does. 2.4/2.5 pin the two sentences separately: a
-- coordinator whose referral is FINISHED and one whose referral is merely SENT are
-- being told different facts, and collapsing them to one string is the drift this
-- pair exists to catch.
select set_config('app.in_referral_rpc', 'on', true);
update public.case_referral set status = 'withdrawn' where id = (select id from r1);
select set_config('app.in_referral_rpc', 'off', true);
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($q$ select public.save_referral_patient(%L, 'Nome', 'MRN-365-9') $q$, (select id from r1)),
  'HC078', 'encaminhamento concluído; os dados do paciente não podem mais ser alterados',
  '2.4 a TERMINAL referral reports the door''s OWN authored refusal, with the CONCLUDED wording');
select test_helpers.reset_role_and_claims();
select is(
  (select mrn from public.referral_patient where referral_id = (select id from r1)),
  'MRN-365-1',
  '2.5 …and the erasure key survived the terminal attempt too — the arm runs before the upsert, so a refused amend leaves nothing behind on EITHER non-draft path');

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
