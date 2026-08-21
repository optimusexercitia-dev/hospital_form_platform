-- =============================================================================
-- 350 — ADR 0130 Slice 3: the DSR adjudication lane, the attested tier, and the
-- program's ONE named authorization widening.
--
-- WHAT THIS PINS. Three things, each of which was false or unreachable before
-- this slice:
--   1. The Encarregado can SEE the hospital's census of a subject before deciding
--      (`search_patient_xref` gains an `app.is_dpo_of` arm — ADR 0130 Decision 3,
--      the only gate this whole program changes).
--   2. `open → adjudicated → executing → closed` is a real lane. ⭐ MEASURED: it
--      was NOT. `complete_dsr_task` advanced `open → executing` directly, so no
--      writer ever produced the middle state and the CHECK constraint admitting
--      `adjudicated` described a state nothing could reach.
--   3. The attested tier is POPULATED for the population it names, and its
--      redaction count reaches the outcome record.
--
-- ---------------------------------------------------------------------------
-- ⛔ THE WIDENING'S KEYSTONE IS A CONTENT DIFFERENTIAL, NOT AN ABSENCE OF RAISE.
--
-- `search_patient_xref`'s gate RETURNS THE EMPTY BUNDLE — it does not raise
-- (measured from the live body, not the migration text). So `lives_ok` on a DPO's
-- call passes IDENTICALLY whether the arm is present or absent: it is vacuous BY
-- CONSTRUCTION, and it is the test a reasonable author writes first. t4–t9 assert
-- the CONTENT instead — a DPO of Hospital A gets matchCount ≥ 1 for the fixture
-- MRN, and every other principal gets 0.
--
-- ⭐ AND THE NEGATIVE ARMS NEED THE SAME CARE IN THE OTHER DIRECTION. "DPO of B
-- gets 0" would also hold if the arm did not exist at all, so on its own it proves
-- nothing about hospital scoping — it is only meaningful BESIDE t4, which proves
-- the same principal shape DOES get rows at its own hospital. The pair is the
-- assertion; neither half is.
--
-- ---------------------------------------------------------------------------
-- ⭐ NEUTRALIZATION VERDICTS — 48 probes, ONE AT A TIME, every restore verified.
--
-- ⚠ 48 = 47 RED + 1 GREEN, and the parts are spelled out because they must sum.
--
-- ⛔ THE COUNT IS DERIVED, AND THE DERIVATION HAS A SHAPE CONTRACT. Every verdict
-- line below MUST match `^--   [a-z_].*\.\.+ RED` — three spaces, a lowercase
-- identifier, a dot-leader of TWO OR MORE dots, then ` RED`. That grep returns
-- **47**; the 48th is the inverted-guard probe marked GREEN, which is a FINDING,
-- not a pass.
--
-- ⛔⛔ AND THE SHAPE IS THE FRAGILE PART, NOT THE ARITHMETIC — this paragraph has
-- now been WRONG THREE TIMES, twice while being the paragraph that warns about it:
-- it said "37" through two edits that claimed to fix it, then "45" after the two
-- re-earned verdicts were appended with a ONE-DOT leader the pattern only half
-- matched. ⚠ And loosening the pattern is not the fix: the naive `^--   .*RED`
-- returns **49**, inflated by prose lines that merely contain the word.
-- **A derivation is only as stable as the shape it scans, and NOTHING HERE ASSERTS
-- THE SHAPE.** A comment cannot check itself; the honest state is that this
-- contract is enforced by nobody. Filed as part of
-- `FUP-AUTHZ-HARNESS-PRECONDITIONS` — the same family as a harness that verifies
-- its baseline but not that its domain contains the keystone.
--
-- ⛔ THE HARNESS WAS PROVEN BEFORE ANY VERDICT WAS BELIEVED, IN BOTH DIRECTIONS:
-- the probe must MOVE `md5(pg_get_functiondef(oid))` and the restore must bring
-- that exact hash BACK; a probe that matches nothing aborts loudly instead of
-- reporting a green. Three controls ran first —
--   CTL1 a `from` string absent from the body  -> "PROBE MATCHED NOTHING" ✅ caught
--   CTL2 a LOWERCASE `security definer` probe  -> "PROBE MATCHED NOTHING" ✅ caught
--        (`pg_get_functiondef` emits it UPPERCASE — the trap the brief names)
--   CTL3 a real gate mutation                  -> hash moved, suite RED, hash back ✅
-- — because Slice 2's first sweep "restored" through `psql -f <hostpath>`, which
-- resolves INSIDE the container: five neutralizations accumulated and every
-- verdict after the first was meaningless. A rollback nobody watched succeed is
-- not a rollback. After the battery, all 8 probed functions hash-matched their
-- saved originals, both policies read back their original expressions, and the
-- clean run was 56/56.
--
--   search_patient_xref: is_dpo_of arm removed ....... RED  t4, t9
--   search_patient_xref: PQS arm removed (twin) ...... RED  t8
--   search_patient_xref: audit suppressed ............ RED  t9
--   search_patient_xref: whole gate opened ........... RED  t5, t7
--   patient_trajectory_bundle: hospital scope off .... RED  t6
--   patient_trajectory_bundle: case grain reverted ... RED  t10
--   create_dsr_request: per-commission arm disabled .. RED  t13 (+10 cascade)
--   create_dsr_request: prose predicate always true .. RED  t14   ← the over-mint twin
--   create_dsr_request: meeting arm mints disposal ... RED  t15, t16
--   adjudicate: gate opened .......................... RED  t18-t21
--   adjudicate: re-adjudication allowed .............. RED  t27
--   adjudicate: enumeration bound off ................ RED  t24
--   adjudicate: outcome bound off .................... RED  t25
--   adjudicate: already-disposed bound off ........... RED  t31
--   adjudicate: the mint disabled .................... RED  t26, t30
--   adjudicate: legal-consultation check off ......... RED  t22
--   close: gate opened ............................... RED  t32
--   close: granted-needs-adjudication off ............ RED  t33
--   close: null-outcome message off .................. RED  t34
--   close: outcome-mismatch refusal off .............. RED  t35
--   close: pending-work check off .................... RED  t36
--   close: direct-path adjudication stamp removed .... RED  t38
--   complete_dsr_task: attest refusal off ............ RED  t39
--   attest_dsr_task: gate opened ..................... RED  t44, t45
--   attest_dsr_task: reviewer-name check off ......... RED  t40
--   attest_dsr_task: redaction-count check off ....... RED  t41
--   attest_dsr_task: note check off .................. RED  t42
--   attest_dsr_task: kind guard off .................. RED  t43
--   attest_dsr_task: OVERWRITES `note` ............... RED  t49
--   attest_dsr_task: count not recorded .............. RED  t48, t50
--   list_dsr_disposable_meetings: gate removed ....... RED  t55, t56
--   list_dsr_disposable_meetings: returns nothing .... RED  t53, t54
--   dsr_requests_select policy opened ................ RED  t51
--   dsr_tasks_select policy opened ................... RED  t52
--   a `patient_name` column added to dsr_requests .... RED  t11   ← the Rule 12 pin
--   a `patient_mrn` column added to dsr_tasks ........ RED  t12
--   the entity-less unique index dropped ............. RED  t17 ⚠ see below
--   list_my_dsr_task_commissions: gate removed ....... RED  t59   ← BUG-DSR-S3-002
--   list_my_dsr_task_commissions: hospital-wide join .. RED  t60   ← the over-list twin
--   close: the refusal RETIREMENT removed ............ RED  t65, t66, t67
--   complete_dsr_task: `blocked` arm removed ......... RED  t67
--   list_my_executable_dsr_tasks: status filter off .. RED  t66
--   attest_dsr_task: `blocked` arm removed ........... RED  t69  ⚠ GREEN on first probe
--   list_my_executable_dsr_tasks: filter -> 'done' ... RED  t67
--   close: retirement guard INVERTED ................. ⛔ **GREEN — SEE BELOW**
--   list_my_dsr_task_commissions: returns nothing .... RED  t57, t58, t60
--
-- ⛔⛔ ONE PROBE CAME BACK GREEN, AND THAT IS THE MOST IMPORTANT LINE HERE.
-- Inverting the retirement guard (`if v_outcome not in ('granted','granted_partial')`
-- -> `if true`) so it fires on EVERY close left the suite fully PASS. My
-- over-grant twin could not fail, and I had already written the reason why in the
-- migration's own comment without noticing it disqualified the test. The twin is
-- REMOVED rather than left green; the full mechanism is at the bottom of this
-- file, where it used to sit.
--
-- ⛔ AND A SECOND PROBE CAME BACK GREEN THE FIRST TIME IT RAN: the `blocked` arm on
-- `attest_dsr_task`. I added that arm on purpose — reasoning that guarding one of a
-- sibling pair is the omission class this project has already paid for — and then
-- wrote NO test for it, because the brief named only `complete_dsr_task` and
-- nobody was owed a test for a fix I invented. t69 exists because the battery
-- found it, not because review did; it now goes RED under the same mutation. Two
-- of this slice's green probes were the author's own un-keystoned work.
--
-- ⚠ AND ONE THING THE BATTERY TAUGHT ME ABOUT MY OWN PIN, recorded because it is
-- the kind of thing that otherwise stays invisible. The over-list probe (join
-- `commissions` on the HOSPITAL rather than on the task's commission) reds t60 but
-- NOT t58, the differential — at that point in the suite the hospital's commission
-- set and the visible-tasks' commission set COINCIDE, so the differential cannot
-- separate them. t60's deletion is what breaks the coincidence. **t58 and t60 are
-- complementary and neither alone is sufficient**; a suite carrying only the
-- differential would have called that mutation covered.
--
-- ⚠ ONE VERDICT IS WEAKER THAN THE OTHERS AND IS RECORDED AS SUCH. Dropping
-- `dsr_tasks_request_kind_commission_uniq` reds t17 — but it reds 44 of 56,
-- because `create_dsr_request`'s `ON CONFLICT (request_id, kind, commission_id)`
-- INFERS that same index and the door then errors outright. So t17's red proves
-- the index is load-bearing; it does NOT isolate uniqueness from inference. There
-- is no mutation that separates them (ON CONFLICT inference requires a unique
-- index on exactly those columns), so the limit is stated rather than papered over.
--
-- ⛔⛔ TWO VERDICTS IN THIS BATTERY ARE STALE, AND QA CAUGHT IT USING THIS FILE'S
-- OWN DOCTRINE AGAINST IT. The header below says "a rewritten pin is a NEW pin and
-- inherits nothing from its predecessor's verdict" — and that is SYMMETRIC for a
-- rewritten DOOR. These two carry only SLICE 2's results, against bodies Slice 3
-- rewrote (`complete_dsr_task` twice):
--
--   create_dsr_request GATE ............ verdict predates the Slice 3 rewrite
--   complete_dsr_task EFFECT check ..... verdict predates BOTH Slice 3 rewrites
--
-- ✅ BOTH RE-PROBED 2026-08-20 AGAINST THE REWRITTEN BODIES, and both RED:
--   create_dsr_request GATE opened ..... RED  349 t6/t7/t8 + t32p
--   complete_dsr_task EFFECT check off ........... RED  349 t19, t21
-- Baseline verified green first, harness control caught a dead write channel, both
-- restores hash-verified, post-battery clean run green.
--
-- ⛔⛔ AND THE DOMAIN LESSON, which cost a near-miss: run FIRST against
-- `00_setup + 350` alone, BOTH probes came back **PASS** — which read literally
-- says `create_dsr_request`'s authorization gate is BLIND on a live PHI-adjacent
-- door. It says nothing of the kind. **The keystones for both gates live in 349**,
-- and 350 was never their domain. A neutralization verdict is meaningless unless
-- the suite you run CONTAINS the keystone you are trying to falsify — "nothing
-- noticed" and "nothing that could notice was running" are indistinguishable in
-- the output. ⚠ Second near-identical near-miss in one session: the first was a
-- verdict over a RED baseline (a failed `db reset`), this one a verdict over the
-- WRONG DOMAIN. Both would have filed a false BLIND on the same door.
--
-- ⚠ t33 and t39 are REWRITES of 349 t28 and t24. A rewritten pin is a NEW pin and
-- is in no BLIND set, so it inherits NOTHING from the verdict its predecessor
-- carried; both were neutralized on their own above.
--
-- ⚠ AND ONE PAIRING TO READ CORRECTLY: t7 does NOT go red when the bundle's
-- hospital scope is removed, because t7's principal is stopped by the search
-- door's GATE and never reaches the bundle. Its verdict comes from CTL3 (gate
-- opened) instead. Attributing t7 to the scope probe would have recorded a
-- verdict for the wrong mechanism.
--
-- ---------------------------------------------------------------------------
-- ⭐ THE DETECTOR IS PROVEN IN BOTH DIRECTIONS. A per-commission attestation arm
-- that mints for everything is as wrong as one that mints for nothing, and a
-- suite that only ever asserts "it fired" cannot tell them apart. MEASURED on the
-- seed: Hospital A's two commissions BOTH carry non-case prose (6 free-text
-- answers each) while Hospital B's two carry NONE. So t13 proves the arm fires
-- and t14 proves it does not fire indiscriminately — on real, unconstructed state,
-- from the same door, in the same run.
--
-- ⚠ FIXTURE FLAGS ARE ASSERTED, NOT ASSUMED (t1–t3). This suite depends on three
-- flags — `dsr`, `patient_index` and `meetings` — and every keystone below SKIPS
-- into a green if one is off (pgtap-fixture-flag-gaps). The catalog is truth at a
-- POINT IN TIME and this stack is reset constantly, so the state is asserted.
--
-- ⚠ ROLE CHOICE IS DELIBERATE. Fixture construction runs as the suite's default
-- (superuser) role; every gate assertion runs as a named persona. `dpo_b` is
-- given an EXPLICIT hat (`claims_for(..., 'staff_admin')`) because that persona
-- holds two role TYPES and the harness's auto-derivation correctly mints no claim
-- for a multi-role principal — without the explicit hat `app.has_role_any`'s
-- self-arm fails and every dpo_b assertion would pass for the WRONG REASON.
-- =============================================================================

begin;
select plan(75);

-- ---------------------------------------------------------------------------
-- Flag preconditions.
-- ---------------------------------------------------------------------------
select is(
  (select enabled from app.feature_flags where key = 'dsr'), true,
  't1: the dsr feature flag is ON — every assertion below is vacuous without it'
);
select is(
  (select enabled from app.feature_flags where key = 'patient_index'), true,
  't2: the patient_index flag is ON — search_patient_xref raises without it'
);
select is(
  (select enabled from app.feature_flags where key = 'meetings'), true,
  't3: the meetings flag is ON — the meeting lane is unreachable without it'
);

create temp table f (
  hosp_a uuid, hosp_a2 uuid, hosp_b uuid,
  comm_ccih uuid, comm_farm uuid,
  dpo_a uuid, dpo_b uuid, executor uuid, pqs_b uuid, plain uuid, platform uuid,
  case_a uuid, meeting_farm uuid,
  req_a uuid, req_a2 uuid, req_a3 uuid, req_a4 uuid, req_b uuid,
  task_meet uuid, task_meet2 uuid, task_comm uuid, task_scrub_b uuid, task_ref uuid,
  bundle jsonb, minted_note text
) on commit drop;
grant all on f to authenticated;

insert into f (hosp_a, hosp_a2, hosp_b, comm_ccih, comm_farm,
               dpo_a, dpo_b, executor, pqs_b, plain, platform,
               case_a, meeting_farm)
select '05000000-0000-0000-0000-00000000000a',
       '05000000-0000-0000-0000-0000000000a2',
       '05000000-0000-0000-0000-00000000000b',
       'a0000000-0000-0000-0000-0000000000a1',
       'b0000000-0000-0000-0000-0000000000b1',
       (select id from public.profiles where email = 'staff1.ccih@test.local'),
       (select id from public.profiles where email = 'staff1.qual.b@test.local'),
       (select id from public.profiles where email = 'pqs.a@test.local'),
       (select id from public.profiles where email = 'pqs.b@test.local'),
       (select id from public.profiles where email = 'staff2.ccih@test.local'),
       (select id from public.profiles where email = 'platform@test.local'),
       app.case_of_patient_participant('e0000000-0000-0000-0000-0000000000b9'),
       (select m.id from public.meetings m
         where m.commission_id = 'b0000000-0000-0000-0000-0000000000b1'
         order by m.created_at limit 1);

-- The Encarregado of Hospital B. The seed has exactly ONE dpo row (Hospital A),
-- so the cross-hospital arm of every keystone below has to be constructed — and a
-- cross-hospital assertion with no cross-hospital principal asserts nothing.
insert into public.hospital_dpos (hospital_id, user_id, appointed_by)
select (select hosp_b from f), (select dpo_b from f), (select platform from f);

-- The meeting lane's population. The seed's ONE meeting_cases row links a case
-- belonging to a DIFFERENT patient than the fixture MRN, so the meeting arm cannot
-- fire for this fixture on seed state (349's header records the same trap). Build
-- the link rather than search for it.
insert into public.meeting_cases (meeting_id, case_id)
select (select meeting_farm from f), (select case_a from f)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- B1 — THE WIDENING. Content differential, six arms.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select dpo_a from f), false);
set local role authenticated;
update f set bundle = public.search_patient_xref('PRT-0099123', null, (select hosp_a from f));
reset role;

select cmp_ok(
  ((select bundle from f) ->> 'matchCount')::int, '>=', 1,
  't4 KEYSTONE: the Encarregado of Hospital A SEES the subject''s records (the one '
  'named widening — ADR 0130 D3). ⚠ CONTENT, not lives_ok: the gate returns an '
  'empty bundle rather than raising, so a no-raise assertion is vacuous here'
);

select test_helpers.claims_for((select plain from f), false);
set local role authenticated;
select is(
  (public.search_patient_xref('PRT-0099123', null, (select hosp_a from f)) ->> 'matchCount')::int,
  0,
  't5 KEYSTONE: a plain commission member of the SAME hospital sees nothing — the '
  'widening added one arm, not an opening'
);
reset role;

select test_helpers.claims_for((select dpo_b from f), false, 'staff_admin');
set local role authenticated;
select is(
  (public.search_patient_xref('PRT-0099123', null, (select hosp_b from f)) ->> 'matchCount')::int,
  0,
  't6 KEYSTONE: the Encarregado of Hospital B gets ZERO for a subject whose records '
  'are all at Hospital A — hospital-scoped SILENTLY (D4: a cross-hospital hint IS '
  'the inference isolation prevents). Meaningful only beside t4'
);
select is(
  (public.search_patient_xref('PRT-0099123', null, (select hosp_a from f)) ->> 'matchCount')::int,
  0,
  't7 KEYSTONE: the Encarregado of Hospital B passing Hospital A''s id is refused — '
  'the office is per-hospital, and so is the arm'
);
reset role;

select test_helpers.claims_for((select executor from f), false);
set local role authenticated;
select cmp_ok(
  (public.search_patient_xref('PRT-0099123', null, (select hosp_a from f)) ->> 'matchCount')::int,
  '>=', 1,
  't8: the ORIGINAL PQS-operator arm still works — the over-narrow twin. A widening '
  'that quietly replaced the old arm would pass t4 and fail nobody'
);
reset role;

-- Rule 11: every PHI read is logged. The audit fires on >= 1 match, and it is NOT
-- arm-conditional — a DPO search is audited exactly as a PQS search is.
select cmp_ok(
  (select count(*) from public.audit_log
    where action = 'patient.searched' and actor_id = (select dpo_a from f))::int,
  '>=', 1,
  't9: a DPO search that matched is AUDITED (Rule 11 — the new arm is not an '
  'unaudited back door)'
);

-- ---------------------------------------------------------------------------
-- The case-grain display defect, fixed in the same migration.
-- ⚠ Pinned on the CORRECTED VALUE, not on "not null": `entityCode` had a
-- non-null fallback ('—') all along, so a null-check would have passed while the
-- defect was live.
-- ---------------------------------------------------------------------------
select is(
  (select e ->> 'entityCode'
     from jsonb_array_elements((select bundle from f) -> 'entries') e
    where e ->> 'module' = 'case' limit 1),
  'Caso ' || (select c.case_number::text from public.cases c where c.id = (select case_a from f)),
  't10 KEYSTONE: the case entry shows its real case number. It rendered "—" FOREVER '
  '— the bundle compared a patient_participants id to cases.id (the Slice-2 grain), '
  'so the subquery could never match'
);

-- ---------------------------------------------------------------------------
-- Rule 12 census — POSITIVE column lists on both DSR tables.
-- "has no name column" goes vacuous the moment its subject is removed; the failure
-- this guards is the well-meant "just add the patient name" patch, which would
-- make a FOURTH PHI module.
-- ---------------------------------------------------------------------------
select set_eq(
  $$ select column_name::text from information_schema.columns
      where table_schema = 'public' and table_name = 'dsr_requests' $$,
  $$ values ('id'),('hospital_id'),('patient_key'),('encounter_key'),('file_ref'),
            ('status'),('outcome'),('outcome_basis'),('legal_consultation_ref'),
            ('received_at'),('due_date'),('adjudicated_at'),('adjudicated_by'),
            ('closed_at'),('closed_by'),('created_by'),('created_at'),('updated_at') $$,
  't11: dsr_requests holds EXACTLY the declared PHI-free column set (Rule 12 / Q6)'
);

select set_eq(
  $$ select column_name::text from information_schema.columns
      where table_schema = 'public' and table_name = 'dsr_tasks' $$,
  $$ values ('id'),('request_id'),('kind'),('module'),('entity_id'),
            ('commission_id'),('hospital_id'),('status'),('note'),
            ('completion_note'),('attested_by_name'),('attested_redactions'),
            ('completed_at'),('completed_by'),('created_at') $$,
  't12: dsr_tasks holds EXACTLY the declared column set — `attested_by_name` is a '
  'STAFF reviewer''s signature, never the subject''s name'
);

-- ---------------------------------------------------------------------------
-- Intake — the attested tier's measured population.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select dpo_a from f), false);
set local role authenticated;
update f set req_a = public.create_dsr_request((select hosp_a from f), 'PRT-0099123', 'PROC-350-A1');
update f set req_a2 = public.create_dsr_request((select hosp_a from f), 'PRT-0099123', 'PROC-350-A2');
update f set req_a3 = public.create_dsr_request((select hosp_a from f), 'PRT-0099123', 'PROC-350-A3');
update f set req_a4 = public.create_dsr_request((select hosp_a from f), 'PRT-0099123', 'PROC-350-A4');
reset role;

select set_eq(
  format($$ select c.slug::text from public.dsr_tasks t
             join public.commissions c on c.id = t.commission_id
            where t.request_id = %L and t.kind = 'attest_review' and t.entity_id is null $$,
         (select req_a from f)),
  $$ values ('ccih'),('farmacia') $$,
  't13 KEYSTONE: the attested tier mints ONE task per commission of the hospital '
  'that HOLDS free prose — the population with no mechanical signal at all '
  '(ADR 0130 D6). Without it the outcome record reports "attested: 0" forever'
);

select test_helpers.claims_for((select dpo_b from f), false, 'staff_admin');
set local role authenticated;
update f set req_b = public.create_dsr_request((select hosp_b from f), 'PRT-0099123', 'PROC-350-B1');
reset role;

select is(
  (select count(*)::int from public.dsr_tasks
    where request_id = (select req_b from f) and kind = 'attest_review'),
  0,
  't14 KEYSTONE (the over-mint twin): Hospital B''s commissions hold NO free prose, '
  'so NO attestation is minted there. A detector that fires for everything is as '
  'wrong as one that fires for nothing, and t13 alone cannot tell them apart'
);

select is(
  (select count(*)::int from public.dsr_tasks
    where request_id = (select req_a from f) and kind = 'attest_review'
      and module = 'meeting' and entity_id = (select meeting_farm from f)),
  1,
  't15: the Slice-2 per-MEETING attestation still mints, exactly once'
);

select is(
  (select count(*)::int from public.dsr_tasks
    where request_id = (select req_a from f) and kind = 'dispose_meeting'),
  0,
  't16 KEYSTONE: intake NEVER mints dispose_meeting — a whole-minutes erasure over '
  'one agenda item would destroy other committees'' records (Amdt 2 item 3)'
);

-- req_a2 enumerates the SAME meeting and is never escalated (t31's attempt raises,
-- so its transaction retires nothing). Its attestation is the untouched control
-- for t75 and the subject t47 moved to once t26 retires req_a's.
update f set task_meet2 = (select id from public.dsr_tasks
                            where request_id = (select req_a2 from f)
                              and kind = 'attest_review' and module = 'meeting');
update f set task_meet = (select id from public.dsr_tasks
                           where request_id = (select req_a from f)
                             and kind = 'attest_review' and module = 'meeting');
update f set task_comm = (select t.id from public.dsr_tasks t
                           join public.commissions c on c.id = t.commission_id
                          where t.request_id = (select req_a from f)
                            and t.kind = 'attest_review' and t.entity_id is null
                            and c.slug = 'ccih');
-- (`task_scrub_b` was assigned here and never read by any assertion. Since ADR 0130
-- Amdt 4 nothing mints `notify_scrub_check`, so the subquery would resolve to NULL — a
-- dead lookup that reads like coverage. Removed rather than left to rot; the column stays
-- declared so the temp-table shape is untouched. The retirement contract is in `354`.)
update f set task_ref = (select id from public.dsr_tasks
                          where request_id = (select req_a from f) and kind = 'dispose_referral');
-- Snapshot the MINTED PROCEDURE before anyone completes the task. ⚠ t49 compares
-- against THIS, not against "length > 0": a neutralization that writes the
-- caller's own note over the procedure leaves a non-empty string, so a length
-- check would stay green while the defect it guards was live.
update f set minted_note = (select note from public.dsr_tasks where id = (select task_comm from f));

-- The entity-less double-mint guard. The pre-existing partial unique index is
-- `WHERE entity_id IS NOT NULL` and CANNOT cover a commission-scoped task.
select throws_ok(
  format($$ insert into public.dsr_tasks (request_id, kind, commission_id, hospital_id)
            values (%L, 'attest_review', %L, %L) $$,
         (select req_a from f), (select comm_ccih from f), (select hosp_a from f)),
  '23505',
  null,
  't17: a per-commission attestation cannot be minted twice for one request'
);

-- ---------------------------------------------------------------------------
-- adjudicate_dsr_request — the gate matrix.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select plain from f), false);
set local role authenticated;
select throws_ok(
  format($$ select public.adjudicate_dsr_request(%L, 'withdrawn') $$, (select req_a from f)),
  '42501',
  'apenas o Encarregado deste hospital pode registrar a decisão de uma solicitação',
  't18 KEYSTONE: a plain commission member cannot decide a subject request'
);
reset role;

select test_helpers.claims_for((select executor from f), false);
set local role authenticated;
select throws_ok(
  format($$ select public.adjudicate_dsr_request(%L, 'withdrawn') $$, (select req_a from f)),
  '42501',
  'apenas o Encarregado deste hospital pode registrar a decisão de uma solicitação',
  't19 KEYSTONE: an EXECUTOR who does the disposal work still cannot decide (Q16iii '
  '— the powers are split, and this is the split)'
);
reset role;

select test_helpers.claims_for((select dpo_b from f), false, 'staff_admin');
set local role authenticated;
select throws_ok(
  format($$ select public.adjudicate_dsr_request(%L, 'withdrawn') $$, (select req_a from f)),
  '42501',
  'apenas o Encarregado deste hospital pode registrar a decisão de uma solicitação',
  't20 KEYSTONE: the Encarregado of Hospital B cannot decide Hospital A''s request'
);
reset role;

select test_helpers.claims_for((select platform from f), true);
set local role authenticated;
select throws_ok(
  format($$ select public.adjudicate_dsr_request(%L, 'withdrawn') $$, (select req_a from f)),
  '42501',
  'apenas o Encarregado deste hospital pode registrar a decisão de uma solicitação',
  't21 KEYSTONE: platform_admin cannot decide — commission CONTENT and PHI are '
  'outside its nouns (ADR 0078 A35)'
);
reset role;

-- ---------------------------------------------------------------------------
-- adjudicate_dsr_request — the recorded consultation, and the escalation bounds.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select dpo_a from f), false);
set local role authenticated;

select throws_ok(
  format($$ select public.adjudicate_dsr_request(%L, 'refused_retention', 'Retenção institucional de 20 anos.') $$,
         (select req_a from f)),
  '23514',
  'informe a referência da consulta jurídica que fundamentou a decisão',
  't22: a substantive decision requires its recorded legal consultation (ADR 0035 '
  'Amdt 1 holding 2 — decided case by case, WITH counsel)'
);

select throws_ok(
  format($$ select public.adjudicate_dsr_request(%L, 'refused_identity', '   ') $$,
         (select req_a from f)),
  '23514',
  'a recusa exige o fundamento legal informado ao titular',
  't23: any refusal carries the basis given to the subject (LGPD Art. 18 §4)'
);

select throws_ok(
  format($$ select public.adjudicate_dsr_request(%L, 'granted', null, 'Parecer 7/2026',
                                                 array['00000000-0000-0000-0000-0000000000ff']::uuid[]) $$,
         (select req_a from f)),
  'HCDS2',
  null,
  't24 KEYSTONE: a meeting the census never enumerated cannot be escalated to '
  'erasure — this door''s reach is bounded by ITS OWN request, not by the hospital'
);

select throws_ok(
  format($$ select public.adjudicate_dsr_request(%L, 'withdrawn', null, null, array[%L]::uuid[]) $$,
         (select req_a from f), (select meeting_farm from f)),
  'HCDS5',
  'o descarte de atas só pode ser determinado em um desfecho de atendimento',
  't25 KEYSTONE: nothing is escalated to erasure on a refusal or a withdrawal'
);

select is(
  public.adjudicate_dsr_request((select req_a from f), 'granted', null, 'Parecer 12/2026',
                                array[(select meeting_farm from f)]::uuid[]),
  1,
  't26 KEYSTONE: a HUMAN adjudication — and only that — mints the dispose_meeting '
  'task (Amdt 2 item 3: the escalation the fan-out deliberately refused to automate)'
);

select throws_ok(
  format($$ select public.adjudicate_dsr_request(%L, 'withdrawn') $$, (select req_a from f)),
  'HCDS5',
  'esta solicitação já foi decidida; a decisão registrada não pode ser reescrita',
  't27 KEYSTONE: a decision that can be silently rewritten is not a decision'
);
reset role;

select is(
  (select status from public.dsr_requests where id = (select req_a from f)),
  'adjudicated',
  't28: the request reaches `adjudicated` — a state NOTHING could produce before '
  'this slice, though the CHECK constraint has admitted it since Slice 2'
);

select isnt(
  (select adjudicated_at from public.dsr_requests where id = (select req_a from f)),
  null::timestamptz,
  't29: the decision is stamped with when, and (by CHECK) with whom'
);

select is(
  (select count(*)::int from public.dsr_tasks
    where request_id = (select req_a from f) and kind = 'dispose_meeting'
      and entity_id = (select meeting_farm from f) and module = 'meeting'),
  1,
  't30: exactly one dispose_meeting task, carrying the meeting as its entity'
);

-- ---------------------------------------------------------------------------
-- QA r1 M2 — escalation RETIRES the same meeting's attestation, and nothing else.
--
-- ⛔ The fan-out's `attest_review` for this ata instructs the revoke corridor —
-- "reabra a reunião, edite o trecho e assine novamente". The decision has just
-- ordered the ata erased WHOLESALE, so following it would reopen and re-sign a
-- meeting about to be destroyed, bumping `revision` and invalidating registered
-- prints (ADR 0126). Same harm as the refusal path's, on the GRANTING path.
--
-- ⚠ Hiding the text in the UI is NOT the fix: the row would stay `pending` and
-- `close_dsr_request` counts every pending task for a granted close, so the DPO
-- would be blocked from closing by a task nobody should perform.
-- ---------------------------------------------------------------------------
select is(
  (select status from public.dsr_tasks
    where request_id = (select req_a from f) and kind = 'attest_review'
      and module = 'meeting' and entity_id = (select meeting_farm from f)),
  'blocked',
  't73 KEYSTONE: escalating a meeting RETIRES that meeting''s own attestation'
);

select is(
  (select count(*)::int from public.dsr_tasks
    where request_id = (select req_a from f) and kind = 'attest_review'
      and entity_id is null and status = 'blocked'),
  0,
  't74 KEYSTONE (the over-retire twin): the per-COMMISSION attestations on the same '
  'request are untouched. Retirement is scoped to the escalated meeting, never to '
  'siblings — a statement that retired the request''s attestations wholesale would '
  'pass t73 and fail nobody'
);

select is(
  (select status from public.dsr_tasks where id = (select task_meet2 from f)),
  'pending',
  't75 KEYSTONE: another request''s attestation for the SAME meeting is untouched — '
  'the retirement is bounded by the request that made the decision'
);

-- The already-disposed bound. Disposed AFTER req_a''s escalation, so req_a2 still
-- enumerated the meeting and the refusal is about disposal state, not enumeration.
update public.meetings set phi_disposed_at = now(), phi_disposed_by = (select dpo_a from f),
       phi_disposed_reason = 'subject_request'
 where id = (select meeting_farm from f);

select test_helpers.claims_for((select dpo_a from f), false);
set local role authenticated;
select throws_ok(
  format($$ select public.adjudicate_dsr_request(%L, 'granted', null, 'Parecer 13/2026', array[%L]::uuid[]) $$,
         (select req_a2 from f), (select meeting_farm from f)),
  'HCDS5',
  null,
  't31 KEYSTONE: an already-disposed ata cannot be escalated again — the refusal is '
  'at DECISION time, not discovered by the executor at fire time'
);
reset role;

-- ---------------------------------------------------------------------------
-- close_dsr_request — consuming the decision.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select executor from f), false);
set local role authenticated;
select throws_ok(
  format($$ select public.close_dsr_request(%L, 'withdrawn') $$, (select req_a from f)),
  '42501',
  'apenas o Encarregado deste hospital pode encerrar uma solicitação',
  't32 KEYSTONE: an executor who did the work still cannot close the request'
);
reset role;

select test_helpers.claims_for((select dpo_a from f), false);
set local role authenticated;

select throws_ok(
  format($$ select public.close_dsr_request(%L, 'granted', null, 'Parecer 14/2026') $$,
         (select req_a3 from f)),
  'HCDS5',
  'registre a decisão (parecer) antes de encerrar a solicitação como atendida',
  't33 KEYSTONE (rewrite of 349 t28, freshly neutralized): an ERASING outcome '
  'requires a recorded decision. Adjudication is where the erasure population — '
  'including the meeting escalations — is finalized, so a granted close that '
  'skipped it would ship an erasure the workflow never finished enumerating'
);

select throws_ok(
  format($$ select public.close_dsr_request(%L) $$, (select req_a4 from f)),
  'HCDS5',
  'registre a decisão (parecer) antes de encerrar a solicitação',
  't34: closing with no outcome and no recorded decision names the missing step'
);

select throws_ok(
  format($$ select public.close_dsr_request(%L, 'withdrawn') $$, (select req_a from f)),
  'HCDS5',
  'o desfecho informado difere da decisão já registrada para esta solicitação',
  't35 KEYSTONE: close cannot quietly overwrite the recorded decision — otherwise '
  'it is a second, unstamped author of the outcome'
);

select throws_ok(
  format($$ select public.close_dsr_request(%L) $$, (select req_a from f)),
  'HCDS4',
  null,
  't36: closing as ATTENDED is still refused while execution tasks are pending'
);

-- The DIRECT path: never adjudicated, and the outcome erases nothing.
select lives_ok(
  format($$ select public.close_dsr_request(%L, 'refused_retention',
                                            'Política institucional de retenção de 20 anos.',
                                            'Parecer 15/2026') $$,
         (select req_a4 from f)),
  't37: a NON-ERASING outcome closes in one step — the rule is "close may record a '
  'decision directly only when the decision erases nothing"'
);
reset role;

select isnt(
  (select adjudicated_at from public.dsr_requests where id = (select req_a4 from f)),
  null::timestamptz,
  't38 KEYSTONE: the direct path STILL stamps the adjudication. refused_retention '
  'requires a legal consultation by CHECK, so it IS a substantive adjudication — a '
  'closed request whose stamp was null would say a decision made with counsel was '
  'never adjudicated'
);

-- ---------------------------------------------------------------------------
-- The attested tier.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select executor from f), false);
set local role authenticated;
select throws_ok(
  format($$ select public.complete_dsr_task(%L, 'revisei') $$, (select task_comm from f)),
  'HCDS3',
  'esta é uma tarefa de revisão: use o formulário de atestação, informando quem revisou e quantas menções foram removidas',
  't39 KEYSTONE (relocation of 349 t24, freshly neutralized): the generic completion '
  'door REFUSES an attestation. An optional structured tier is an unreliable one, '
  'and the outcome record could not state a count nobody was required to give'
);

select throws_ok(
  format($$ select public.attest_dsr_task(%L, '  ', 0, 'revisei') $$, (select task_comm from f)),
  'HCDS3',
  'informe o nome de quem revisou o conteúdo; a atestação é pessoal e nominal',
  't40: an attestation with no attestor is not an attestation'
);

select throws_ok(
  format($$ select public.attest_dsr_task(%L, 'Ana Souza', null, 'revisei') $$, (select task_comm from f)),
  'HCDS3',
  'informe quantas menções ao titular foram removidas (use 0 se nenhuma foi encontrada)',
  't41: the count is REQUIRED — 0 ("I looked and found nothing") is a real answer '
  'that must be given, where NULL is "nobody said"'
);

select throws_ok(
  format($$ select public.attest_dsr_task(%L, 'Ana Souza', 0, '   ') $$, (select task_comm from f)),
  'HCDS3',
  'descreva o que foi revisado para concluir esta tarefa',
  't42: and a statement of what was reviewed'
);

select throws_ok(
  format($$ select public.attest_dsr_task(%L, 'Ana Souza', 0, 'x') $$, (select task_ref from f)),
  'HCDS3',
  'esta tarefa não é uma revisão; conclua-a pelo fluxo da própria tarefa',
  't43: the attestation door refuses a DISPOSAL task — the two speech acts do not '
  'substitute for each other'
);
reset role;

select test_helpers.claims_for((select plain from f), false);
set local role authenticated;
select throws_ok(
  format($$ select public.attest_dsr_task(%L, 'Ana Souza', 0, 'revisei') $$, (select task_comm from f)),
  '42501',
  'sem permissão para concluir esta tarefa',
  't44 KEYSTONE: a plain commission member cannot attest'
);
reset role;

select test_helpers.claims_for((select pqs_b from f), false);
set local role authenticated;
select throws_ok(
  format($$ select public.attest_dsr_task(%L, 'Ana Souza', 0, 'revisei') $$, (select task_comm from f)),
  '42501',
  'sem permissão para concluir esta tarefa',
  't45 KEYSTONE: a PQS operator of Hospital B cannot attest a Hospital A task'
);
reset role;

select test_helpers.claims_for((select executor from f), false);
set local role authenticated;
select lives_ok(
  format($$ select public.attest_dsr_task(%L, 'Ana Souza', 2, 'Revisei as respostas de formulário da comissão.') $$,
         (select task_comm from f)),
  't46: the attestation is recorded by a named human with a count'
);
-- ⚠ SUBJECT MOVED (QA r1 M2). This attested `task_meet` — req_a's attestation for
-- the meeting t26 ESCALATES — which M2 now retires, so attesting it correctly
-- raises HCDS5. It uses req_a2's attestation for the same ata instead: a request
-- that was never escalated (t31's attempt raises and rolls back), so the task is
-- genuinely pending and the pin asserts what it always did.
select lives_ok(
  format($$ select public.attest_dsr_task(%L, 'Bruno Lima', 1, 'Revisei a ata.') $$,
         (select task_meet2 from f)),
  't47: the per-meeting attestation likewise'
);
reset role;

select is(
  (select attested_by_name || '/' || attested_redactions::text
     from public.dsr_tasks where id = (select task_comm from f)),
  'Ana Souza/2',
  't48: the reviewer and the count land on the row'
);

select is(
  (select note from public.dsr_tasks where id = (select task_comm from f)),
  (select minted_note from f),
  't49 KEYSTONE: the MINTED PROCEDURE survives completion, BYTE FOR BYTE. '
  '`complete_dsr_task` used to overwrite `note` with the caller''s text, destroying '
  'the revoke-corridor instructions the task exists to carry, at the exact moment '
  'they were being followed. ⚠ Compared against the snapshot, not against '
  '"length > 0" — an overwrite leaves a non-empty string and would pass that'
);

select is(
  (select sum(attested_redactions)::int from public.dsr_tasks
    where request_id = (select req_a from f) and kind = 'attest_review' and status = 'done'),
  2,
  't50: the redaction count reaches the OUTCOME RECORD — this sum is what the '
  'hospital tells the data subject the attested tier removed'
);

-- ---------------------------------------------------------------------------
-- platform_admin sees NEITHER plane, and the escalation lister is DPO-only.
--
-- ⚠ These are NEGATIVE row assertions, which a SIBLING DENY can fake. Checked:
-- `dsr_requests` and `dsr_tasks` each carry exactly ONE policy (`*_select`), so
-- there is no sibling to fake them — and t13/t26 prove the same rows ARE readable
-- by the DPO in this very run, so the tables are not merely empty.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select platform from f), true);
set local role authenticated;
select is(
  (select count(*)::int from public.dsr_requests), 0,
  't51 KEYSTONE: platform_admin reads ZERO subject requests (the A35 noun rule)'
);
select is(
  (select count(*)::int from public.dsr_tasks), 0,
  't52 KEYSTONE: and zero tasks — it administers tenancy and identity, not '
  'commission content'
);
reset role;

-- ---------------------------------------------------------------------------
-- list_dsr_disposable_meetings — the escalation picker's lister.
--
-- ⚠ A NEW `prosecdef` READ PATH, so its gate REPLACES RLS and a policy-shaped
-- audit is structurally blind to it. Keystoned here for exactly that reason.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select dpo_a from f), false);
set local role authenticated;
select cmp_ok(
  jsonb_array_length(public.list_dsr_disposable_meetings((select req_a from f))),
  '>=', 1,
  't53: the Encarregado sees the meetings THIS request enumerated — the positive '
  'arm without which every refusal below is satisfiable by an empty table'
);
select is(
  (public.list_dsr_disposable_meetings((select req_a from f)) -> 0 ->> 'label') like 'Reuni%',
  true,
  't54: it returns a governance IDENTIFIER (number + date) — ⛔ never the title, '
  'never minutes_md, never an agenda item. The Encarregado needs to know WHICH '
  'meeting, not what is in it'
);
reset role;

select test_helpers.claims_for((select plain from f), false);
set local role authenticated;
select is(
  public.list_dsr_disposable_meetings((select req_a from f)),
  '[]'::jsonb,
  't55 KEYSTONE: a plain commission member gets nothing from the lister'
);
reset role;

select test_helpers.claims_for((select dpo_b from f), false, 'staff_admin');
set local role authenticated;
select is(
  public.list_dsr_disposable_meetings((select req_a from f)),
  '[]'::jsonb,
  't56 KEYSTONE: the Encarregado of Hospital B gets nothing for Hospital A''s '
  'request — the DEFINER gate is per-hospital, like the office'
);
reset role;

-- ---------------------------------------------------------------------------
-- BUG-DSR-S3-002 — `list_my_dsr_task_commissions`: name the scope an attestation
-- covers.
--
-- ⛔ WHY THIS IS A KEYSTONE AND NOT A COSMETIC PIN. The attested tier is a NAMED
-- HUMAN stating they reviewed a DEFINED SCOPE, and the outcome record reports that
-- statement to the data subject as coverage. The card used to read "Comissão fora
-- do seu acesso" directly above "Revise o conteúdo em texto livre DESTA COMISSÃO":
-- the embed on `commissions` is RLS-filtered and the Encarregado is a plain member
-- of ONE commission by design. An attestation against an unnameable scope is a
-- NOMINAL attestation.
-- ---------------------------------------------------------------------------
-- ⭐ THE PRECONDITION THAT MAKES t57 MEAN ANYTHING, asserted rather than assumed.
-- If the Encarregado were a member of BOTH commissions, `commissions_select` would
-- already name both and t57 would pass with the fix REMOVED — the wrong-arm fixture
-- shape. Measured today: staff1.ccih is a member of `ccih` only. Pinned so a seed
-- change cannot make t57 vacuous silently.
select is(
  app.is_member_of_for((select comm_farm from f), (select dpo_a from f)),
  false,
  't61 PRECONDITION: the Encarregado is NOT a member of `farmacia` — so t57 below '
  'genuinely requires naming a commission `commissions_select` refuses them'
);

select test_helpers.claims_for((select dpo_a from f), false);
set local role authenticated;

-- ⛔ POSITIVE KEY LIST. `taskId` was removed from this payload (BUG-DSR-S3-001:
-- the panel posted it where a MEETING id was validated, so the door refused and
-- the escalation silently never happened). Asserting "has no taskId" would go
-- vacuous the moment the subject moved; the positive list catches a re-add AND a
-- rename.
select set_eq(
  format($$ select jsonb_object_keys(
              public.list_dsr_disposable_meetings(%L::uuid) -> 0) $$, (select req_a from f)),
  $$ values ('meetingId'),('commissionId'),('commissionName'),('label'),('alreadyDisposed') $$,
  't62 KEYSTONE: the escalation payload carries EXACTLY one uuid a caller acts on. '
  'A second same-typed id in this shape is what BUG-DSR-S3-001 was'
);

select set_eq(
  format($$ select e ->> 'slug' from jsonb_array_elements(
              public.list_my_dsr_task_commissions(%L::uuid)) e $$, (select hosp_a from f)),
  $$ values ('ccih'),('farmacia') $$,
  't57 KEYSTONE: the Encarregado can NAME both commissions their hospital''s tasks '
  'cover — including the sibling commission `commissions_select` refuses them, '
  'which is the whole defect'
);

-- ⭐ THE MIRROR, ASSERTED RATHER THAN PROMISED. The lister restates
-- `dsr_tasks_select`'s USING expression, and "it calls the same predicates" is a
-- claim about TEXT, which goes stale silently — a policy could gain an arm this
-- copy never learns about. So compare the SETS: what the door returns must equal
-- what the POLICY returns, computed live, in the same session, as the same role.
select set_eq(
  format($$ select (e ->> 'commissionId')::uuid from jsonb_array_elements(
              public.list_my_dsr_task_commissions(%L::uuid)) e $$, (select hosp_a from f)),
  format($$ select distinct t.commission_id from public.dsr_tasks t
             where t.hospital_id = %L::uuid and t.commission_id is not null $$,
         (select hosp_a from f)),
  't58 KEYSTONE: the lister returns EXACTLY the commissions of the tasks '
  '`dsr_tasks_select` already shows this caller — a differential, so drift between '
  'the copied predicate and the policy goes RED instead of going unnoticed'
);
reset role;

select test_helpers.claims_for((select plain from f), false);
set local role authenticated;
select is(
  public.list_my_dsr_task_commissions((select hosp_a from f)),
  '[]'::jsonb,
  't59 KEYSTONE: a plain commission member — who can see no DSR task — learns no '
  'commission name from this door'
);
reset role;

-- No task ⇒ no name, at the SAME hospital and for the SAME caller, so this
-- isolates the task-scoping from the hospital filter. Without it t57 is
-- satisfiable by a door that simply lists the hospital's commissions.
delete from public.dsr_tasks
 where hospital_id = (select hosp_a from f) and commission_id = (select comm_farm from f);

select test_helpers.claims_for((select dpo_a from f), false);
set local role authenticated;
select set_eq(
  format($$ select e ->> 'slug' from jsonb_array_elements(
              public.list_my_dsr_task_commissions(%L::uuid)) e $$, (select hosp_a from f)),
  $$ values ('ccih') $$,
  't60 KEYSTONE (the over-list twin): with every task in `farmacia` removed, the '
  'door stops naming it. A door that listed the HOSPITAL''s commissions instead of '
  'the caller''s TASKS'' commissions would pass t57 and fail nobody'
);
reset role;

-- ---------------------------------------------------------------------------
-- A REFUSAL RETIRES ITS OUTSTANDING WORK.
--
-- ⛔ Measured before the fix: after a `refused_retention` close, all six tasks
-- stayed `pending` and the executor was still offered SIX executable tasks —
-- three of them PHI erasures — for a request whose decision was to RETAIN. The
-- workflow was instructing the opposite of its own decision, failing OPEN against
-- a retention decision.
--
-- ⚠ `blocked` means RETIRED BY DECISION here, not "waiting". Nothing wrote that
-- value before this change, so every reader of `dsr_tasks.status` was swept first
-- (migration `20261002000300` header lists all nine SQL readers plus the TS and UI
-- ones and what each DOES when it meets the new value).
-- ---------------------------------------------------------------------------
create temp table g (req uuid, task_disp uuid, granted_req uuid) on commit drop;
-- ⚠ THE ROW MUST EXIST BEFORE `update g set …` CAN DO ANYTHING. Omitting this
-- insert left `g` EMPTY, so every `update g set req = …` was a silent no-op and
-- `(select req from g)` was NULL — under which t65 ("0 pending after the close")
-- counts rows `where request_id = NULL`, gets 0, and passes GREEN having asserted
-- nothing. t63 is the control that caught exactly that, on its first run.
insert into g (req, task_disp, granted_req) values (null, null, null);
grant all on g to authenticated;

select test_helpers.claims_for((select dpo_a from f), false);
set local role authenticated;
update g set req = public.create_dsr_request((select hosp_a from f), 'PRT-0099123', 'PROC-350-REFUSE');
update g set task_disp = (select id from public.dsr_tasks
                           where request_id = (select req from g) and kind = 'dispose_referral');

select cmp_ok(
  (select count(*)::int from public.dsr_tasks
    where request_id = (select req from g) and status = 'pending'), '>=', 4,
  't63: the fixture request starts with outstanding work — without this the '
  'retirement below has nothing to retire and t64 passes by construction'
);

select lives_ok(
  format($$ select public.close_dsr_request(%L::uuid, 'refused_retention',
              'Política institucional de retenção de 20 anos.', 'Parecer 21/2026') $$,
         (select req from g)),
  't64: a refusal closes with work outstanding — the asymmetry STAYS. Demanding '
  'those tasks be done first would force erasing exactly what the refusal retained'
);
reset role;

select is(
  (select count(*)::int from public.dsr_tasks
    where request_id = (select req from g) and status = 'pending'),
  0,
  't65 KEYSTONE: the refusal RETIRES every outstanding task. A decision to retain '
  'must not leave live erasure instructions in an executor''s inbox'
);

select test_helpers.claims_for((select executor from f), false);
set local role authenticated;
select ok(
  not jsonb_exists(
    public.list_my_executable_dsr_tasks((select hosp_a from f)),
    (select task_disp::text from g)),
  't66 KEYSTONE: the executor is no longer OFFERED the retired disposal. This is '
  'the reader that made the defect visible — it had no status filter at all'
);
-- The other half of the same filter, pinned because the sweep EXPOSED it rather
-- than caused it: the lister had no status filter at ALL, so it offered `done`
-- tasks as executable too. `= 'pending'` enumerates the ACTIONABLE domain, which
-- survives the next new status value; `<> 'blocked'` would not have.
select ok(
  not jsonb_exists(
    public.list_my_executable_dsr_tasks((select hosp_a from f)),
    (select task_comm::text from f)),
  't67: nor is a COMPLETED task offered as executable — the pre-existing coarseness '
  'the blocked sweep uncovered (349 t32q had to be repointed for exactly this)'
);

select throws_ok(
  format($$ select public.complete_dsr_task(%L::uuid) $$, (select task_disp from g)),
  'HCDS5',
  'esta tarefa foi encerrada pela decisão registrada e não deve mais ser executada',
  't68 KEYSTONE: and the door refuses it. Without this arm, an executor who erased '
  'the record anyway would have the erasure recorded as workflow-sanctioned'
);

-- ⛔ THE SIBLING. `attest_dsr_task` carries the same `blocked` arm as
-- `complete_dsr_task`, and this pin exists because the battery caught its ABSENCE:
-- removing that arm left the suite fully GREEN. I added the guard on purpose —
-- reasoning that guarding one of a sibling pair is the omission class this project
-- has already paid for — and then wrote no test for it, which is the
-- un-keystoned-deviation shape exactly: a fix the engineer was right to invent gets
-- no keystone, because nobody was owed a test for it.
select throws_ok(
  format($$ select public.attest_dsr_task(%L::uuid, 'Ana Souza', 0, 'revisei') $$,
         (select id from public.dsr_tasks
           where request_id = (select req from g) and kind = 'attest_review'
             and status = 'blocked' limit 1)),
  'HCDS5',
  'esta tarefa foi encerrada pela decisão registrada e não deve mais ser executada',
  't69 KEYSTONE: the ATTESTATION door refuses a retired task too — both completion '
  'doors carry the arm, not just the one the brief named'
);
reset role;

-- ⛔⛔ THERE IS NO OVER-GRANT TWIN FOR THE RETIREMENT GUARD, AND SAYING SO IS THE
-- HONEST OUTCOME — I WROTE ONE AND THE BATTERY PROVED IT VACUOUS.
--
-- The intended twin was: "a GRANTED close retires nothing", asserted as
-- `count(*) where request_id = <a granted request> and status = 'blocked'` = 0.
-- It passed. It ALSO passed with the guard **inverted to `if true then`**, so it
-- was green whether the guard existed or not — a test that cannot fail is not
-- evidence, and this one was written by the author who had just recorded the
-- reason it could not fail in the migration's own comment.
--
-- ⭐ WHY IT IS NOT CONSTRUCTIBLE, mechanically: the retirement updates rows
-- `where status = 'pending'`, and the granting path CANNOT REACH IT with any such
-- row — `close_dsr_request` raises HCDS4 unless the pending count is already ZERO.
-- So on a granted close the statement matches nothing whether it is guarded or
-- not, and no fixture can separate the two. The guard is DEFENSIVE ONLY.
--
-- **What actually protects the granting path is t36** (`HCDS4` while tasks pend),
-- which IS falsifiable and IS neutralization-proven. If that check were ever
-- relaxed, this guard becomes load-bearing and a twin becomes constructible — at
-- which point one belongs here. Recorded so the absence reads as a measured limit
-- rather than an oversight.

-- ---------------------------------------------------------------------------
-- ACLs, PINNED — QA r1: these sat outside the battery on a ONE-TIME MANUAL
-- MEASUREMENT, which is a reading, not a control. A NULL `proacl` is the DEFAULT
-- and it INCLUDES PUBLIC, so an ACL regression is silent and no other assertion in
-- this suite would notice it.
--
-- ⚠ This slice already made exactly that mistake once: the house
-- `grant to authenticated, service_role` idiom was applied to a REWRITE of
-- `app.patient_trajectory_bundle` — the raw, UNGATED PHI assembler, deliberately
-- service_role-only — and only suite 152 §M1 caught it. t72 puts that guard in
-- this slice's own suite too, beside the doors whose grants the same migration set.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like '%dsr%'
      and has_function_privilege('anon', p.oid, 'execute')),
  0,
  't70 KEYSTONE: NO DSR door is executable by `anon` — a NULL proacl is the default '
  'and it includes PUBLIC, so this cannot be left to the migration''s intent'
);

select cmp_ok(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like '%dsr%'
      and has_function_privilege('authenticated', p.oid, 'execute')),
  '>=', 9,
  't71: …and the population is NON-EMPTY. Without this, t70 counts zero rows out of '
  'zero doors and passes having asserted nothing — the removing-a-subject shape'
);

select is(
  has_function_privilege('authenticated', 'app.patient_trajectory_bundle(text, text, uuid)', 'execute'),
  false,
  't72 KEYSTONE: the raw PHI assembler stays service_role-ONLY. ⚠ This slice widened '
  'it once by applying the new-function grant idiom to a REWRITE; CREATE OR REPLACE '
  'does not reset an ACL, so the grant line belongs to NEW functions only'
);

select * from finish();
rollback;
