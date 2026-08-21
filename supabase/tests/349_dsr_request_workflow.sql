-- =============================================================================
-- 349 — ADR 0130 Slice 2: the DSR ("Direitos do Titular") execution corridor.
--
-- WHAT THIS PINS. A subject request is an ADJUDICATED CASE, not an erase button:
-- the Encarregado (DPO) opens and closes it, the people who already hold each
-- disposal door execute it under their OWN sessions, and the workflow itself
-- fires nothing. Every assertion below exists to keep one of those three true.
--
-- ⭐ THE GATES ARE KEYSTONED, AND THAT WAS MEASURED, NOT ASSERTED. The Slice 1
-- build found `dispose_meeting_minutes`'s authorization gate BLIND — rewriting it
-- so that any caller passes left all 6548 tests green — and its sibling
-- `dispose_event_phi` is blind still. A door whose gate no test exercises is
-- door-blind by construction (ADR 0079), and NEW doors are the easiest place for
-- that to recur: a brand-new gate is in no BLIND set, so it passes ARM=policy
-- vacuously. Every gate this slice adds was therefore neutralized one at a time
-- against this suite, each restore verified by hash before the next ran:
--
--   create_dsr_request gate ......... RED  (t6/t7/t8)
--   complete_dsr_task gate .......... RED  (t17/t18)
--   complete_dsr_task effect check .. RED  (t19)
--   close_dsr_request gate .......... RED  (t27)
--   the case-grain resolution ....... RED  (t10b)
--   is_dpo_of_for is_active arm ..... RED  (t32b)
--   is_dpo_of_for grant-row arm ..... RED  (t6/t7 + 2)
--   appoint_hospital_dpo gate ....... RED  (t32c)
--   revoke_hospital_dpo gate ........ RED  (t32d)
--   _deny_self_grant ................ RED  (t32e)
--   the grant-time membership floor . RED  (t32f)
--   dsr_tasks_select policy ......... RED  (t16 + 1)
--   dsr_requests_select policy ...... RED  (t33/t34)
--   list_my_executable_dsr_tasks .... RED  (t32n)
--   list_my_dsr_hospitals arm 2 ..... RED  (t32p)
--   hospital_dpos_select policy ..... ⛔ WAS BLIND — t32k/t32l added for it
--
-- ⚠ THAT LAST LINE IS THE POINT. The roster policy was correct and nothing would
-- have noticed its removal, in the very file whose header warns about exactly
-- that. The sweep is not a formality; it found a hole this author had just dug.
--
-- ⭐ TWO POPULATIONS ARE CONSTRUCTED, BECAUSE THE SEED CANNOT PROVE THEM.
--   · attest_review (t14): the seed's ONE meeting_cases row links case
--     `d0000000-…-c1`, which belongs to a DIFFERENT patient than this suite's
--     fixture MRN (`PRT-0099123` resolves to case `dba00000-…-b1`). So the meeting
--     arm cannot fire for the fixture on seed state, and a suite built on seed
--     state would have asserted nothing and stayed green whether the arm worked or
--     not. t14 builds the link.
--     ⚠ THIS COMMENT SAID SOMETHING FALSE, AND IT IS WORTH LEAVING THE CORRECTION
--     VISIBLE. It read "links a case with NO patient_xref entry", from a join of
--     `meeting_cases.case_id` against `patient_xref.entity_id` — which returns 0
--     rows for the reason t10b exists: those columns are DIFFERENT GRAINS, so the
--     join could not have matched anything, ever. The right conclusion (t14 must
--     construct the link) reached through a comparison that proves nothing —
--     inside the file whose header warns about exactly that.
--   · HCDS2 (t35): `patient_xref.commission_id` is nullable and no seed row is
--     null, so the unroutable-row refusal is unreachable until built.
-- The same trap cost Slice 1 a full rewrite: a fixture derived from seed state
-- can look correct and be wrong.
--
-- ⭐ AND THE GRAIN (t10b). `patient_xref` keys the CASE module on a
-- `patient_participants` id while `dispose_case_phi` takes a CASE id. The module
-- name does not name the entity. Believing it would have shipped a case lane that
-- fails closed forever, silently — caught only by measuring the catalog.
--
-- ⚠ DISCRIMINATE ON THE MESSAGE WHERE THE SQLSTATE IS SHARED. The two Slice-2
-- input refusals raise `check_violation` (23514) — the same code the table CHECKs
-- raise — so those assertions pin the door's own pt-BR message, not the code.
--
-- ⚠ ROLE CHOICE IS DELIBERATE. Fixture construction runs as the suite's default
-- (superuser) role; every gate assertion runs as a named persona, because a gate
-- assertion satisfied by an unrelated permission failure proves nothing.
-- =============================================================================

begin;
select plan(53);

-- The doors raise HCDS1 and the predicates return false when the flag is OFF, so
-- without this every keystone below would SKIP into a green
-- (pgtap-fixture-flag-gaps). Asserted, not assumed — t1.
select is(
  (select enabled from app.feature_flags where key = 'dsr'),
  true,
  't1: the dsr feature flag is ON — every assertion below is vacuous without it'
);

create temp table f (
  hosp_a uuid, hosp_b uuid, comm_ccih uuid, comm_farm uuid,
  dpo uuid, executor uuid, plain_staff uuid, hosp_admin uuid,
  pqs_b uuid, platform uuid,
  referral_a uuid, case_a uuid, event_a uuid, meeting_farm uuid,
  req1 uuid, req_b uuid, req_meet uuid, req_hist uuid,
  task_ref uuid, task_meet uuid, task_scrub uuid
) on commit drop;
grant all on f to authenticated;

insert into f (hosp_a, hosp_b, comm_ccih, comm_farm,
               dpo, executor, plain_staff, hosp_admin, pqs_b, platform,
               referral_a, case_a, event_a, meeting_farm)
select '05000000-0000-0000-0000-00000000000a', '05000000-0000-0000-0000-00000000000b',
       'a0000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-0000000000b1',
       (select id from public.profiles where email = 'staff1.ccih@test.local'),
       (select id from public.profiles where email = 'pqs.a@test.local'),
       (select id from public.profiles where email = 'staff2.ccih@test.local'),
       (select id from public.profiles where email = 'hospitaladmin.a1@test.local'),
       (select id from public.profiles where email = 'pqs.b@test.local'),
       (select id from public.profiles where email = 'platform@test.local'),
       -- ⚠ case_a is the CASE, not the participant. For module='case' the xref is
       -- keyed on patient_participants; t14 below pins that the door resolves it.
       'efa00000-0000-0000-0000-0000000000a1',
       app.case_of_patient_participant('e0000000-0000-0000-0000-0000000000b9'),
       'e1000000-0000-0000-0000-0000000000a1',
       (select m.id from public.meetings m
         where m.commission_id = 'b0000000-0000-0000-0000-0000000000b1'
         order by m.created_at limit 1);

-- The three seeded records of MRN PRT-0099123 — a case, an event and a referral,
-- all in Hospital Central A. If this stops holding, every fan-out assertion below
-- is measuring a different population than it claims to.
select is(
  (select count(*)::int from public.patient_xref x
    where x.patient_key = app.derive_patient_key('PRT-0099123')
      and app.hospital_of_commission(x.commission_id) = (select hosp_a from f)),
  3,
  't2: the fixture MRN has exactly 3 indexed records in Hospital A (case+event+referral)'
);

-- Rule 12 census. Pinned as the POSITIVE column list: "has no name column" goes
-- vacuous the moment its subject is removed, and the failure this guards against
-- is the well-meant "just add the patient name" patch.
select set_eq(
  $$ select column_name::text from information_schema.columns
      where table_schema = 'public' and table_name = 'dsr_requests' $$,
  $$ values ('id'),('hospital_id'),('patient_key'),('encounter_key'),('file_ref'),
            ('status'),('outcome'),('outcome_basis'),('legal_consultation_ref'),
            ('received_at'),('due_date'),('adjudicated_at'),('adjudicated_by'),
            ('closed_at'),('closed_by'),
            ('created_by'),('created_at'),('updated_at') $$,
  -- UPDATED BY SLICE 3, deliberately and visibly: `adjudicated_at`/`_by` are the
  -- decision stamp (ADR 0130 Amdt 3). THIS PIN DID ITS JOB — it went RED on the
  -- author's own ALTER TABLE, which is exactly the well-meant column addition it
  -- exists to catch. Neither column is PHI; Rule 12's "exactly three" stands.
  't3: dsr_requests holds EXACTLY the declared PHI-free column set (Rule 12 / ADR 0130 Q6)'
);

select is(
  app.is_dpo_of_for((select hosp_a from f), (select dpo from f)),
  true,
  't4: the seeded Encarregado holds the dpo capability at Hospital A'
);

select is(
  app.is_dpo_of_for((select hosp_b from f), (select dpo from f)),
  false,
  't5: the office is per-hospital — the same person is NOT DPO of Hospital B'
);

-- ---------------------------------------------------------------------------
-- create_dsr_request — gate matrix.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select plain_staff from f), false);
set local role authenticated;
select throws_ok(
  $$ select public.create_dsr_request('05000000-0000-0000-0000-00000000000a', 'PRT-0099123', 'PROC-1') $$,
  '42501',
  'apenas o Encarregado deste hospital pode registrar uma solicitação de titular',
  't6 KEYSTONE: a plain commission member cannot open a subject request'
);
reset role;

select test_helpers.claims_for((select hosp_admin from f), false);
set local role authenticated;
select throws_ok(
  $$ select public.create_dsr_request('05000000-0000-0000-0000-00000000000a', 'PRT-0099123', 'PROC-1') $$,
  '42501',
  'apenas o Encarregado deste hospital pode registrar uma solicitação de titular',
  't7 KEYSTONE: tenancy administration does NOT imply the Encarregado office (ADR 0130 D2)'
);
reset role;

select test_helpers.claims_for((select dpo from f), false);
set local role authenticated;
select throws_ok(
  $$ select public.create_dsr_request('05000000-0000-0000-0000-00000000000b', 'PRT-0099123', 'PROC-1') $$,
  '42501',
  'apenas o Encarregado deste hospital pode registrar uma solicitação de titular',
  't8 KEYSTONE: the DPO of Hospital A cannot open a request against Hospital B'
);

update f set req1 = public.create_dsr_request(
  '05000000-0000-0000-0000-00000000000a', 'PRT-0099123', 'PROC-DPO-2026-001');
reset role;

select isnt((select req1 from f), null::uuid, 't9: the Encarregado opens a request');

-- ---------------------------------------------------------------------------
-- The fan-out (the mechanical tier).
-- ---------------------------------------------------------------------------
select set_eq(
  $$ select kind::text from public.dsr_tasks
      where request_id = (select req1 from f) and kind like 'dispose%' $$,
  $$ values ('dispose_case'),('dispose_event'),('dispose_referral') $$,
  't10: the fan-out mints exactly one disposal task per indexed module'
);

-- ⭐ THE GRAIN. patient_xref keys the case module on a patient_participants id,
-- while dispose_case_phi takes a CASE id. Without the resolution the case lane
-- would fail closed forever and SILENTLY (complete_dsr_task looking for a `cases`
-- row that cannot exist), and the meeting join would never match. Both halves are
-- asserted, and neither is circular: the task's target must be a real case row AND
-- must not be the participant id the xref carries.
select ok(
  exists (
    select 1 from public.cases c
    where c.id = (select t.entity_id from public.dsr_tasks t
                   where t.request_id = (select req1 from f) and t.kind = 'dispose_case')
  )
  and (select t.entity_id from public.dsr_tasks t
        where t.request_id = (select req1 from f) and t.kind = 'dispose_case')
      is distinct from 'e0000000-0000-0000-0000-0000000000b9'::uuid,
  't10b GRAIN: the case task targets the CASE the door takes, not the xref''s participant id'
);

select is(
  (select count(*)::int from public.dsr_tasks t
    where t.request_id = (select req1 from f)
      and t.commission_id is not null
      and app.hospital_of_commission(t.commission_id) <> (select hosp_a from f)),
  0,
  't11: every routed task belongs to this hospital (ADR 0130 D4 — hospital-scoped)'
);

-- ⛔ REVERSED, deliberately and visibly. This asserted `1` — "exactly one
-- notification-residue check per request (Q12a)" — until 2026-08-20. ADR 0130
-- **Amendment 4** withdrew Decision 9 as premise-falsified (the residue class it names
-- does not exist), and migration `20261003000100` stopped minting the task. Leaving the
-- old pin would have made the fix look like a regression in the file a reader trusts
-- most. The FULL retirement contract — the positive control that this counter can still
-- see such a row, that the KIND stays valid and completable, and that the HCDS4 gate is
-- untouched — lives in `354_dsr_notify_scrub_retired.sql`; t12 here is the one-line
-- consequence for this suite's own fixture. t9/t10 above are its non-vacuity control:
-- this request DOES mint tasks, so the zero is a measurement over a populated request.
select is(
  (select count(*)::int from public.dsr_tasks
    where request_id = (select req1 from f) and kind = 'notify_scrub_check'),
  0,
  't12: NO notification-residue check is minted any more (ADR 0130 Amdt 4; contract pinned in 354)'
);

-- The cross-hospital control. PRT-B-0001 is indexed only in Hospital B; opening
-- its request at Hospital A must enumerate NOTHING — silently, per Decision 4
-- (a "this patient also has records elsewhere" hint is the very cross-tenant
-- inference the isolation model exists to prevent).
select test_helpers.claims_for((select dpo from f), false);
set local role authenticated;
update f set req_b = public.create_dsr_request(
  '05000000-0000-0000-0000-00000000000a', 'PRT-B-0001', 'PROC-DPO-2026-002');
reset role;

select is(
  (select count(*)::int from public.dsr_tasks
    where request_id = (select req_b from f) and kind like 'dispose%'),
  0,
  't13 KEYSTONE: a patient indexed only at another hospital fans out zero disposal tasks'
);

-- ---------------------------------------------------------------------------
-- The attested tier for meetings — CONSTRUCTED, because the seed cannot show it.
-- ⛔ The arm must mint attest_review and NEVER dispose_meeting: disposing a whole
-- minutes over one agenda item would destroy other committees' records
-- (ADR 0130 Amendment 2 item 3).
-- ---------------------------------------------------------------------------
insert into public.meeting_cases (meeting_id, case_id)
values ((select meeting_farm from f), (select case_a from f));

select test_helpers.claims_for((select dpo from f), false);
set local role authenticated;
update f set req_meet = public.create_dsr_request(
  '05000000-0000-0000-0000-00000000000a', 'PRT-0099123', 'PROC-DPO-2026-003');
reset role;

select is(
  (select count(*)::int from public.dsr_tasks
    where request_id = (select req_meet from f)
      and kind = 'attest_review' and entity_id = (select meeting_farm from f)),
  1,
  't14: a meeting that discussed the subject''s case mints an attest_review task'
);

select is(
  (select count(*)::int from public.dsr_tasks
    where request_id = (select req_meet from f) and kind = 'dispose_meeting'),
  0,
  't15 KEYSTONE: the fan-out NEVER mints dispose_meeting (Amdt 2 item 3 — over-broad erasure)'
);

-- ---------------------------------------------------------------------------
-- complete_dsr_task — it verifies the EFFECT and fires nothing.
-- ---------------------------------------------------------------------------
update f set task_ref = (select id from public.dsr_tasks
                          where request_id = (select req1 from f) and kind = 'dispose_referral'),
             -- SLICE 3: `attest_review` is no longer one-per-request. The fan-out
             -- now also mints an entity-LESS attestation per prose-bearing commission
             -- (ADR 0130 Amdt 3), so this subquery returned "more than one row" and
             -- ABORTED the suite at fixture time — 16 of 53 tests ran and the rest
             -- never existed to fail. Disambiguated on the MEETING grain it always meant.
             task_meet = (select id from public.dsr_tasks
                          where request_id = (select req_meet from f)
                            and kind = 'attest_review' and module = 'meeting');
-- (`task_scrub` was assigned here and never read by any assertion. Since ADR 0130 Amdt 4
-- nothing mints the kind, so the subquery would resolve to NULL — a dead lookup that
-- reads like coverage. Removed rather than left to rot; the column stays declared so the
-- temp-table shape is untouched.)

select test_helpers.claims_for((select plain_staff from f), false);
set local role authenticated;
select is(
  (select count(*)::int from public.dsr_tasks where id = (select task_ref from f)),
  0,
  't16: a plain commission member cannot even SEE a routed task (the read boundary)'
);
select throws_ok(
  format($$ select public.complete_dsr_task(%L::uuid) $$, (select task_ref from f)),
  '42501',
  'sem permissão para concluir esta tarefa',
  't17 KEYSTONE: a plain commission member cannot complete a routed task'
);
reset role;

select test_helpers.claims_for((select pqs_b from f), false);
set local role authenticated;
select throws_ok(
  format($$ select public.complete_dsr_task(%L::uuid) $$, (select task_ref from f)),
  '42501',
  'sem permissão para concluir esta tarefa',
  't18 KEYSTONE: a PQS operator of Hospital B cannot complete a Hospital A task'
);
reset role;

select test_helpers.claims_for((select executor from f), false);
set local role authenticated;
select throws_ok(
  format($$ select public.complete_dsr_task(%L::uuid) $$, (select task_ref from f)),
  'HCDS3',
  'o descarte ainda não foi realizado neste registro; execute o descarte antes de concluir a tarefa',
  't19 KEYSTONE: the task refuses to close while the disposal has NOT happened'
);

-- The corridor proper: the executor fires the EXISTING module door under their
-- own session — which is why the four disposal gates need no change at all.
select lives_ok(
  format($$ select public.dispose_referral_phi(%L::uuid, 'subject_request') $$,
         (select referral_a from f)),
  't20: the executor fires dispose_referral_phi under their own session and gate'
);

select lives_ok(
  format($$ select public.complete_dsr_task(%L::uuid) $$, (select task_ref from f)),
  't21: with the disposal done, the task completes'
);
reset role;

select is(
  (select status from public.dsr_tasks where id = (select task_ref from f)),
  'done',
  't22: the completed task is stamped done'
);

select is(
  (select status from public.dsr_requests where id = (select req1 from f)),
  'executing',
  't23: the first completion advances the request to executing'
);

-- ⚠ SLICE 3 RELOCATED THIS PIN, deliberately and visibly. `complete_dsr_task` no
-- longer completes an attestation AT ALL: the attested tier needs a named reviewer
-- and a redaction count for the outcome record to state, and an OPTIONAL structured
-- tier is an unreliable one. The blank-note refusal moved to `attest_dsr_task`
-- (350 t42), beside the two new required fields (350 t40/t41). What is pinned HERE
-- is the ROUTING. ⭐ Freshly neutralized in 350 — a rewritten pin is a NEW pin and
-- inherits nothing from the verdict its predecessor carried.
select test_helpers.claims_for((select executor from f), false);
set local role authenticated;
select throws_ok(
  format($$ select public.complete_dsr_task(%L::uuid, '   ') $$, (select task_meet from f)),
  'HCDS3',
  'esta é uma tarefa de revisão: use o formulário de atestação, informando quem revisou e quantas menções foram removidas',
  't24: an attest_review task is ROUTED to the attestation door, not completed here'
);
reset role;

-- Q16iv — idempotence. A NEW request for the same subject finds the referral
-- already disposed and lands its task pre-completed as history, never re-firing.
select test_helpers.claims_for((select dpo from f), false);
set local role authenticated;
update f set req_hist = public.create_dsr_request(
  '05000000-0000-0000-0000-00000000000a', 'PRT-0099123', 'PROC-DPO-2026-004');
reset role;

select is(
  (select status from public.dsr_tasks
    where request_id = (select req_hist from f) and kind = 'dispose_referral'),
  'done',
  't25: a previously disposed record arrives pre-completed as history (Q16iv)'
);

select isnt(
  (select completed_at from public.dsr_tasks
    where request_id = (select req_hist from f) and kind = 'dispose_referral'),
  null::timestamptz,
  't26: the history task carries the ORIGINAL disposal time, not a fresh one'
);

-- ---------------------------------------------------------------------------
-- close_dsr_request — DPO only, two-phase, Art. 18 §4.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select executor from f), false);
set local role authenticated;
select throws_ok(
  format($$ select public.close_dsr_request(%L::uuid, 'withdrawn') $$, (select req1 from f)),
  '42501',
  'apenas o Encarregado deste hospital pode encerrar uma solicitação',
  't27 KEYSTONE: an executor who did the work still cannot close the request (Q16iii)'
);
reset role;

select test_helpers.claims_for((select dpo from f), false);
set local role authenticated;

-- ⚠ t29 NOW RUNS FIRST, because Slice 3's adjudication fixture below records a
-- decision on `req1` and a close that CONTRADICTS a recorded decision is refused
-- HCDS5 (350 t35). Order matters here; it did not before.
select throws_ok(
  format($$ select public.close_dsr_request(%L::uuid, 'refused_retention', 'Retenção institucional de 20 anos.') $$,
         (select req1 from f)),
  '23514',
  'informe a referência da consulta jurídica que fundamentou a decisão',
  't29: refused_retention requires legal_consultation_ref (ADR 0130 Amdt 1 item 3)'
);

-- ⚠ SLICE 3 CHANGED THE CORRIDOR t28 RUNS THROUGH, deliberately and visibly.
-- `granted` is an ERASING outcome and now requires a RECORDED DECISION first:
-- adjudication is where the erasure population — including the per-meeting
-- escalations — is finalized, so a granted close that skipped it would ship an
-- erasure the workflow never finished enumerating. 350 t33 is the pin that the
-- refusal exists; THIS is a fixture line, so t28 still asserts exactly what it
-- always asserted.
select public.adjudicate_dsr_request((select req1 from f), 'granted', null, 'Parecer 12/2026');

-- ⚠ And the hardcoded "3 tarefa(s)" is gone. Slice 3's fan-out also mints a
-- per-commission attestation, so a literal count in the expected MESSAGE would go
-- stale against the seed silently — the pin is that the refusal fires, not how
-- many tasks happened to be pending on the day it was written.
select throws_ok(
  format($$ select public.close_dsr_request(%L::uuid, 'granted', null, 'Parecer 12/2026') $$,
         (select req1 from f)),
  'HCDS4',
  null,
  't28: closing as ATTENDED is refused while execution tasks are still pending'
);

select throws_ok(
  format($$ select public.close_dsr_request(%L::uuid, 'refused_identity', '  ') $$,
         (select req_b from f)),
  '23514',
  'a recusa exige o fundamento legal informado ao titular',
  't30: any refusal requires its legal basis (LGPD Art. 18 §4)'
);

-- The other half of the PO-confirmed split: an identity failure never reaches the
-- merits, so it needs a basis and NOT a legal-consultation reference.
select lives_ok(
  format($$ select public.close_dsr_request(%L::uuid, 'refused_identity', 'Documentação de identidade não apresentada.') $$,
         (select req_b from f)),
  't31: refused_identity closes WITHOUT a legal-consultation reference (the confirmed split)'
);

select throws_ok(
  format($$ select public.close_dsr_request(%L::uuid, 'withdrawn') $$, (select req_b from f)),
  'HCDS5',
  'esta solicitação já foi encerrada',
  't32: a closed request cannot be closed twice'
);
reset role;

-- ---------------------------------------------------------------------------
-- The capability itself: its sibling guard set, and the two grant doors.
--
-- ⚠ These exist because their absence was the defect. The first draft of this
-- suite tested the three workflow doors and left appoint/revoke with NO
-- assertion at all — which is precisely "door-blind by construction", shipped
-- while writing the file whose header warns about it. A capability grant is an
-- authorization door like any other.
-- ---------------------------------------------------------------------------
insert into public.hospital_dpos (hospital_id, user_id)
select (select hosp_a from f), p.id
from public.profiles p where p.email = 'suspenso.temp@test.local';

select is(
  app.is_dpo_of_for((select hosp_a from f),
                    (select id from public.profiles where email = 'suspenso.temp@test.local')),
  false,
  't32b KEYSTONE: a SUSPENDED member holding the grant is not a DPO (the is_active arm)'
);

delete from public.hospital_dpos
 where user_id = (select id from public.profiles where email = 'suspenso.temp@test.local');

select test_helpers.claims_for((select plain_staff from f), false);
set local role authenticated;
select throws_ok(
  format($$ select public.appoint_hospital_dpo(%L::uuid, %L::uuid) $$,
         (select hosp_a from f), (select executor from f)),
  '42501',
  'apenas um administrador da organização ou do hospital pode designar o Encarregado',
  't32c KEYSTONE: a plain member cannot appoint the Encarregado'
);
select throws_ok(
  format($$ select public.revoke_hospital_dpo(%L::uuid, %L::uuid) $$,
         (select hosp_a from f), (select dpo from f)),
  '42501',
  'apenas um administrador da organização ou do hospital pode revogar o Encarregado',
  't32d KEYSTONE: a plain member cannot revoke the Encarregado'
);
reset role;

select test_helpers.claims_for((select hosp_admin from f), false);
set local role authenticated;
select throws_ok(
  format($$ select public.appoint_hospital_dpo(%L::uuid, %L::uuid) $$,
         (select hosp_a from f), (select hosp_admin from f)),
  '42501',
  'não é permitido conceder acesso a si mesmo',
  't32e: the office cannot be granted to oneself'
);
select throws_ok(
  format($$ select public.appoint_hospital_dpo(%L::uuid, %L::uuid) $$,
         (select hosp_a from f), (select pqs_b from f)),
  'HC021',
  'o Encarregado deve possuir vínculo com alguma comissão deste hospital',
  't32f: the grantee needs a real hat in the hospital (the membership floor, at grant time)'
);
select lives_ok(
  format($$ select public.appoint_hospital_dpo(%L::uuid, %L::uuid) $$,
         (select hosp_a from f), (select plain_staff from f)),
  't32g: the hospital admin appoints a second Encarregado'
);
reset role;

select is(
  app.is_dpo_of_for((select hosp_a from f), (select plain_staff from f)),
  true,
  't32h: the appointment takes effect immediately'
);

select test_helpers.claims_for((select hosp_admin from f), false);
set local role authenticated;
select lives_ok(
  format($$ select public.revoke_hospital_dpo(%L::uuid, %L::uuid) $$,
         (select hosp_a from f), (select plain_staff from f)),
  't32i: the hospital admin revokes it'
);
reset role;

select is(
  app.is_dpo_of_for((select hosp_a from f), (select plain_staff from f)),
  false,
  't32j: a revoked grant stops conferring the office'
);

-- ⚠ These two exist because the neutralization sweep found hospital_dpos_select
-- BLIND: opening it to `using (true)` left all 46 tests green. The policy was
-- correct and nothing would have noticed its removal — the exact defect this
-- file's header warns about, present in this file. Who holds a hospital's
-- Encarregado office is personnel information, and Decision 4 makes it
-- hospital-private.
select test_helpers.claims_for((select pqs_b from f), false);
set local role authenticated;
select is(
  (select count(*)::int from public.hospital_dpos where hospital_id = (select hosp_a from f)),
  0,
  't32k KEYSTONE: a member of another hospital cannot read this hospital''s Encarregado roster'
);
reset role;

-- The grantee arm in isolation: plain_staff's grant was REVOKED above, so they no
-- longer pass the is_dpo_of arm — only `user_id = auth.uid()` can still show them
-- their own history.
select test_helpers.claims_for((select plain_staff from f), false);
set local role authenticated;
select is(
  (select count(*)::int from public.hospital_dpos where user_id = (select plain_staff from f)),
  1,
  't32l: a revoked grantee still sees their own historical row (the self arm)'
);
reset role;

-- ---------------------------------------------------------------------------
-- The two console listers. Both are new `prosecdef` census subjects, so both get
-- keystones — a new door is exactly where blindness recurs, because a brand-new
-- gate belongs to no BLIND set and passes ARM=policy vacuously.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select dpo from f), false);
set local role authenticated;
select is(
  jsonb_array_length(public.list_my_dsr_hospitals()),
  1,
  't32m: the Encarregado''s console lists exactly the one hospital they serve'
);
-- ⭐ THE POWER SPLIT, ASSERTED. The Encarregado SEES every task of their hospital
-- (they must watch the work) and can EXECUTE none of them: they hold no disposal
-- door's arm, by design. This is the assertion that caught the inbox offering
-- them an "Executar descarte" button the door would have refused.
select is(
  jsonb_array_length(public.list_my_executable_dsr_tasks((select hosp_a from f))),
  0,
  't32n KEYSTONE: the Encarregado can execute NO task, while seeing them all'
);
select ok(
  (select count(*)::int from public.dsr_tasks where hospital_id = (select hosp_a from f)) > 0,
  't32o: …and the previous assertion is not vacuous — there ARE tasks to see'
);
reset role;

select test_helpers.claims_for((select pqs_b from f), false);
set local role authenticated;
select is(
  jsonb_array_length(public.list_my_dsr_hospitals()),
  0,
  't32p KEYSTONE: a PQS operator of another hospital reaches no DSR console here'
);
reset role;

select test_helpers.claims_for((select executor from f), false);
set local role authenticated;
-- ⚠ SLICE 3 REPOINTED THIS PIN, deliberately. It used `task_ref`, which THIS FILE
-- completes at t20–t22 — and `list_my_executable_dsr_tasks` now filters to
-- `status = 'pending'`, so a DONE task is correctly no longer "executable". The
-- pin's INTENT (an executor can act on a disposal routed to them) is unchanged; it
-- now names a disposal that is actually still pending. ⛔ The old subject made the
-- assertion depend on the lister having NO status filter at all, which was the
-- coarseness the `blocked` sweep exposed (350 t66/t69).
select ok(
  jsonb_exists(
    public.list_my_executable_dsr_tasks((select hosp_a from f)),
    (select id::text from public.dsr_tasks
      where request_id = (select req_hist from f) and kind = 'dispose_event')
  ),
  't32q: the PQS executor CAN act on a PENDING disposal task routed to them'
);
reset role;

-- ---------------------------------------------------------------------------
-- The read boundary. ⛔ platform_admin is outside the DSR plane entirely
-- (ADR 0130 D2 / the ADR-0078 A35 noun rule) — this is content, not tenancy.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select platform from f), true);
set local role authenticated;
select is(
  (select count(*)::int from public.dsr_requests) + (select count(*)::int from public.dsr_tasks),
  0,
  't33 KEYSTONE: platform_admin sees neither requests nor tasks (the noun rule)'
);
reset role;

select test_helpers.claims_for((select executor from f), false);
set local role authenticated;
select is(
  (select count(*)::int from public.dsr_requests),
  0,
  't34: an executor sees the tasks routed to them, never the request record itself'
);
reset role;

-- ---------------------------------------------------------------------------
-- The unroutable xref row — CONSTRUCTED, unreachable on seed state.
-- ---------------------------------------------------------------------------
insert into public.patient_xref (module, entity_id, commission_id, patient_key)
values ('case', gen_random_uuid(), null, app.derive_patient_key('PRT-0099123'));

select test_helpers.claims_for((select dpo from f), false);
set local role authenticated;
select throws_ok(
  $$ select public.create_dsr_request('05000000-0000-0000-0000-00000000000a', 'PRT-0099123', 'PROC-5') $$,
  'HCDS2',
  'há 1 registro(s) do titular sem comissão atribuída; a solicitação não pode ser enumerada com segurança',
  't35: an xref row with no commission is LOUD — the census refuses rather than silently omitting it'
);
reset role;

delete from public.patient_xref
 where commission_id is null and patient_key = app.derive_patient_key('PRT-0099123');

-- ---------------------------------------------------------------------------
-- The parked arm. Every door is unreachable and every predicate false with the
-- flag OFF — the last assertion, because it disables the module.
-- ---------------------------------------------------------------------------
update app.feature_flags set enabled = false where key = 'dsr';

select test_helpers.claims_for((select dpo from f), false);
set local role authenticated;
select throws_ok(
  $$ select public.create_dsr_request('05000000-0000-0000-0000-00000000000a', 'PRT-0099123', 'PROC-6') $$,
  'HCDS1',
  'o módulo de Direitos do Titular não está habilitado',
  't36: with the dsr flag OFF the door is parked — and app.is_dpo_of is false with it'
);
reset role;

select * from finish();
rollback;
