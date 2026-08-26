-- AFF4 B9 — the properties `375`/`377`/`378`/`379` do NOT already cover.
-- ADR 0151 D1/D3/D4/D6/D7/D8/D13 + migration 20261003004200.
--
-- ⛔ THIS FILE IS DEFINED BY WHAT THE SIBLING SUITES ALREADY PROVE, and that boundary was
--    MEASURED before a line was written rather than assumed — the recorded
--    *"before building X, grep for X"* lesson, which exists because a universal negative
--    gets sampled and authorises a duplicate. What is already covered, and is therefore
--    deliberately ABSENT here:
--      · policy audience (self ALLOW / org_admin ALLOW / sibling-org DENY / hospital_admin
--        DENY) -> `375` §1–§4
--      · all five doors, ALLOW and DENY on every arm, each pinned by SQLSTATE -> `379`
--        §2/§2b/§3/§4/§5
--      · void refuses on a membership EVER attached (`HC0R9`), blank reason (`HC0R7`),
--        re-void (`HC0R8`) -> `379` §4.3/4.4/4.7
--      · the D6 VERDICT differential (an expired seat does not block) -> `379` §3.3
--      · `org_affiliation.created` audited -> `378` §1.3; `.voided` audited -> `379` §5.4
--      · the C5 read differential (wrong-hospital admin reads pre-void, loses BOTH
--        post-void, voided row still visible, org-admin scope control) -> `374`, plan(15)
--    ⚠ Absence of an assertion HERE is therefore not absence of coverage. Every line above
--    names where the property actually lives, because a half-swept class is hardest to see
--    precisely when it is buried under real evidence.
--
-- WHAT IS NEW, and why each was missing:
--   §1 the `organization_affiliations` no-delete guard — the HOSPITAL analogue is tested
--      (`302` §7) and this one was not. A guard nobody exercises is a guard nobody knows
--      is wired to the right table.
--   §2 audit ATTRIBUTION, plus the two verbs that had zero assertions anywhere
--      (`org_affiliation.ended`, `.updated`). Migration 20261003004200 made D5's claim
--      "audited ... naming the actor" true on the SERVICE path, where it was false.
--   §3 the blocker `detail` payload. `379` pins `HC0R6` and passes `null` for the message
--      argument on every `throws_ok`, so NOTHING asserted the enumeration D3 promises the
--      caller — a refusal that enumerates nothing is "it did not work", which is the
--      failure mode D3 exists to prevent.
--   §4 "an ENDED row is still voidable" — true today only INCIDENTALLY: `379` §4.5 voids a
--      row that an earlier line happened to end, under a label about creation symmetry.
--      An unnamed property is one nobody notices losing.
--   §5 `coalesce(p_started_on, current_date)` on D5's org-parent ensure (20261003004200).
--   §6 D4 containment — and see the ⛔ at that section: written the obvious way it proves
--      NOTHING.
--
-- ⚠ ROLE IDIOM, as the sibling suites use it: `test_helpers.claims_for(<uuid>, false)`
--   then `set local role authenticated; ... reset role;`. The THREE-argument form is
--   mandatory for a multi-role persona (`claims_for` mints no `active_role` for one, and
--   every `app.is_*_of` then returns false — a DENY that passes because the persona
--   assumed no role). No such persona is used here; every actor below is single-role.
--
-- Assertion count: 28

begin;
select plan(28);

create temp table k on commit drop as select
  '00000000-0000-0000-0000-0000000000d1'::uuid as subject,     -- org A, ZERO memberships
  '00000000-0000-0000-0000-0000000000b1'::uuid as org_admin_a,
  '00000000-0000-0000-0000-0000000000e1'::uuid as hosp_admin,  -- central-a only
  '0c000000-0000-0000-0000-00000000000a'::uuid as org_a,
  '05000000-0000-0000-0000-00000000000a'::uuid as central_a,
  '05000000-0000-0000-0000-0000000000a2'::uuid as secundario_a,
  'a0000000-0000-0000-0000-0000000000a1'::uuid as commission_a,
  -- Fixed ids for every row this suite creates. ⛔ NEVER a seed-random id and never one
  -- id shared between sections: batching cases onto one id removes isolation the schema
  -- gives for free, and in this repo that has fabricated BOTH a defect and an all-clear.
  'bb000000-0000-0000-0000-000000000380'::uuid as seat_id,
  'ba000000-0000-0000-0000-000000000380'::uuid as orphan_aff_id,
  'ba000000-0000-0000-0000-000000000381'::uuid as orphan_ended_id,
  'ba000000-0000-0000-0000-000000000382'::uuid as deferred_child_id,
  'bc000000-0000-0000-0000-000000000380'::uuid as deferred_parent_id,
  -- ⛔ A FIXED DATE IN THE PAST, AND NEVER `current_date`. `coalesce(p_started_on,
  -- current_date)` means an expected value equal to today passes identically whether the
  -- parameter is threaded or discarded — the assertion and the bug would agree.
  '2019-03-04'::date as past_start;
grant select on k to authenticated;
grant select on k to service_role;

-- ============================================================================
-- §0 PRECONDITIONS — asserted, never assumed.
-- ============================================================================
select is((select enabled from app.feature_flags where key = 'audit_trail'), true,
  '0.1 PRECONDITION: audit_trail is enabled — §2 reads rows the triggers would otherwise never write');

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select subject from k) and ended_on is null and voided_at is null), 1,
  '0.2 PRECONDITION: the subject holds exactly ONE active org affiliation');

select is(
  (select count(*)::int from public.hospital_affiliations
    where principal_id = (select subject from k) and ended_on is null and voided_at is null), 1,
  '0.3 PRECONDITION: exactly one active hospital affiliation — §3.1 measures it as a blocker');

select is(
  (select count(*)::int from public.memberships where principal_id = (select subject from k)), 0,
  '0.4 PRECONDITION: ZERO memberships, so §3 controls exactly which blockers exist');

-- ============================================================================
-- §1 THE NO-DELETE GUARD (D1/D7). Rule 12's minimise-not-destroy posture, structural.
-- ============================================================================
select throws_ok(
  $$delete from public.organization_affiliations
     where principal_id = '00000000-0000-0000-0000-0000000000d1'$$,
  '23514',
  null,
  '1.1 ⛔ DELETE is refused outright — even as the OWNER, which is the point: this is not an RLS rule');

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select subject from k)), 1,
  '1.2 ... and the row is still there — a raise that rolled back nothing would be a guard in name only');

-- NON-VACUITY. A `23514` could come from a CHECK constraint or a foreign key; this pins
-- that the refusal comes from the guard TRIGGER, on THIS table, in BEFORE DELETE. Without
-- it, dropping the trigger and adding an unrelated CHECK would keep 1.1 green.
select is(
  (select count(*)::int from pg_trigger t
    where t.tgrelid = 'public.organization_affiliations'::regclass
      and t.tgname = 'guard_org_affiliation_no_delete_trg'
      and not t.tgisinternal
      -- pg_trigger.tgtype bits: ROW=1, BEFORE=2, INSERT=4, DELETE=8, UPDATE=16.
      -- ⚠ DELETE is bit 8, not 4 — 4 is INSERT, and using it made this arm read 0 on a
      -- trigger that is wired exactly right (measured 2026-08-26, first run).
      and (t.tgtype::int & 8) = 8      -- DELETE
      and (t.tgtype::int & 2) = 2), 1, -- BEFORE
  '1.3 ... and the refusal is a BEFORE DELETE trigger on THIS table, not an incidental constraint');

-- ============================================================================
-- §2 AUDIT ATTRIBUTION AND THE TWO UNASSERTED VERBS (migration 20261003004200).
--
-- ⭐ WHY THIS SECTION EXISTS. ADR 0151 D5 says the org-parent ensure is audited "naming
-- the actor", and `app.affiliate_person_impl`'s own body repeats it. That was FALSE on the
-- SERVICE path: `app.audit_write` derives `v_actor := auth.uid()`, NULL under service_role,
-- and the trigger's metadata carried only `user_id` + `organization_id`.
--
-- ⚠ AND THE REASON NOBODY NOTICED IS ITSELF ASSERTED, at 2.6: on the AUTHENTICATED path
-- `actor_id` IS populated, so every surface anyone had exercised looked correct. A reader
-- checking the claim on that path would have concluded the bug was not there.
-- ============================================================================

-- Fresh subject state for this section: end the seeded org affiliation so the create arm
-- has real work to do (an idempotent no-op would emit no audit row at all).
update public.organization_affiliations
   set ended_on = current_date, ended_by = (select org_admin_a from k)
 where principal_id = (select subject from k) and ended_on is null;

-- ⛔⛔ MARKED BY ID SET, NEVER BY `max(seq)` — AND THIS WAS MEASURED, NOT ANTICIPATED.
--    `audit_log.seq` is CHAIN-LOCAL, not global: `audit_write` numbers each chain
--    (commission / hospital / org / platform) independently, so on a seeded database
--    `case_access.granted` alone spans seq 52..129 while other actions sit at 2..10.
--    A `seq > max(seq)` marker therefore selects NOTHING for a new org-chain row whose
--    seq restarts low — and the first version of this section did exactly that. Every
--    assertion below returned NULL: some RED for the wrong reason, and 2.2 (`actor_id`
--    IS NULL) **PASSED VACUOUSLY**, because "no row at all" and "a row with a null
--    actor" are the same answer to that question. The instrument was well-formed,
--    plausible, and about something else.
create temp table audit_seen on commit drop as select id from public.audit_log;

-- THE SERVICE PATH — no claims at all, exactly as `registerUser` runs it.
select set_config('request.jwt.claims', '', true);
set local role service_role;
select public.affiliate_person_to_org_for(
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000d1',
  '0c000000-0000-0000-0000-00000000000a',
  '2019-03-04');
reset role;

select is(
  (select metadata ->> 'actor_user_id' from public.audit_log
    where action = 'org_affiliation.created' and id not in (select id from audit_seen)
    order by occurred_at desc, id desc limit 1),
  (select org_admin_a::text from k),
  '2.1 ⭐ the SERVICE path names the actor in metadata (D5''s claim, false before 20261003004200)');

-- ⛔ COUNTED, NOT READ. `is(<the actor_id>, null)` passes when there is NO ROW — the
-- missing-row answer and the null-actor answer are identical, and that is exactly how the
-- first version of this arm went green while the section's instrument was broken. Counting
-- rows that satisfy BOTH halves cannot be satisfied by an empty set.
select is(
  (select count(*)::int from public.audit_log
    where action = 'org_affiliation.created'
      and id not in (select id from audit_seen)
      and actor_id is null), 1,
  '2.2 ⭐ THE DIFFERENTIAL: exactly one `.created` row exists AND its `actor_id` column is NULL — the metadata is the ONLY attribution on this path, which is precisely why the gap was invisible');

-- THE AUTHENTICATED path, as a control on 2.2: same door, `auth.uid()` present.
update public.organization_affiliations
   set ended_on = current_date, ended_by = (select org_admin_a from k)
 where principal_id = (select subject from k) and ended_on is null;
insert into audit_seen select id from public.audit_log where id not in (select id from audit_seen);

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select public.affiliate_person_to_org(
  '00000000-0000-0000-0000-0000000000d1',
  '0c000000-0000-0000-0000-00000000000a',
  '2019-03-04');
reset role;

select is(
  (select actor_id from public.audit_log
    where action = 'org_affiliation.created' and id not in (select id from audit_seen)
    order by occurred_at desc, id desc limit 1),
  (select org_admin_a from k),
  '2.6 CONTROL: on the AUTHENTICATED path `actor_id` IS populated — the gap 2.2 pins was service-path-ONLY, which is why every exercised surface looked correct');

-- `.updated` — ZERO assertions existed for this verb anywhere in supabase/tests.
insert into audit_seen select id from public.audit_log where id not in (select id from audit_seen);
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select public.update_org_affiliation(
  '00000000-0000-0000-0000-0000000000d1',
  '0c000000-0000-0000-0000-00000000000a',
  '2018-01-15');
reset role;

select is(
  (select count(*)::int from public.audit_log
    where action = 'org_affiliation.updated' and id not in (select id from audit_seen)), 1,
  '2.4a the `.updated` verb is emitted — it had no assertion anywhere before this file');

-- ⚠ THE KEY IS PRESENT AND NULL, DELIBERATELY. `organization_affiliations` has no
-- `updated_by` column, so there is no recorded actor to name. An OMITTED key would read as
-- an oversight to the next auditor; a guessed value would be a fabrication. `?` tests key
-- presence, which `->>` alone cannot distinguish from a null value.
select ok(
  (select metadata ? 'actor_user_id' and metadata ->> 'actor_user_id' is null
     from public.audit_log
    where action = 'org_affiliation.updated' and id not in (select id from audit_seen)
    order by occurred_at desc, id desc limit 1),
  '2.4b ... carrying `actor_user_id` PRESENT-and-NULL: this table records no updater, and saying so beats omitting the key');

-- `.ended` — also zero assertions before this file.
insert into audit_seen select id from public.audit_log where id not in (select id from audit_seen);
-- The subject's hospital affiliation would block D3; end it first (the wizard's own order).
update public.hospital_affiliations set ended_on = current_date
 where principal_id = (select subject from k) and ended_on is null;

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select public.end_org_affiliation(
  '00000000-0000-0000-0000-0000000000d1',
  '0c000000-0000-0000-0000-00000000000a');
reset role;

select is(
  (select metadata ->> 'actor_user_id' from public.audit_log
    where action = 'org_affiliation.ended' and id not in (select id from audit_seen)
    order by occurred_at desc, id desc limit 1),
  (select org_admin_a::text from k),
  '2.3 the `.ended` verb is emitted AND names the ender — the verb had no assertion anywhere before this file');

-- ⭐ THE ACTOR FOLLOWS THE VERB, NOT A COALESCE. This row is now BOTH ended and voided,
-- and D7 rules that voided takes precedence. A `coalesce(voided_by, ended_by, created_by)`
-- would name the right person here only by luck of ordering; the fixture makes the two
-- DIFFERENT people so the wrong implementation is distinguishable.
insert into audit_seen select id from public.audit_log where id not in (select id from audit_seen);
update public.organization_affiliations
   set voided_at = now(), voided_by = (select hosp_admin from k), void_reason = 'lançamento indevido'
 where id = (select id from public.organization_affiliations
              where principal_id = (select subject from k)
                and voided_at is null and ended_on is not null
              order by created_at desc, id desc limit 1);

select is(
  (select metadata ->> 'actor_user_id' from public.audit_log
    where action = 'org_affiliation.voided' and id not in (select id from audit_seen)
    order by occurred_at desc, id desc limit 1),
  (select hosp_admin::text from k),
  '2.5 an ENDED-then-VOIDED row reports `.voided` and names the VOIDER, not the ender — the actor follows the verb');

select is(
  (select metadata ->> 'void_reason' from public.audit_log
    where action = 'org_affiliation.voided' and id not in (select id from audit_seen)
    order by occurred_at desc, id desc limit 1),
  'lançamento indevido',
  '2.7 ... and the reason rides in the audit record, not only in the row (D8)');

-- ============================================================================
-- §3 THE BLOCKER `detail` PAYLOAD (D3).
--
-- `379` pins `HC0R6` and passes `null` for every `throws_ok` message argument, so nothing
-- asserted WHAT the caller is told. D3's whole point is that the refusal is actionable:
-- "the caller is told exactly what still holds the person, which is the difference between
-- an actionable refusal and 'it did not work'." An empty enumeration satisfies the
-- SQLSTATE and defeats the decision.
-- ============================================================================

-- Rebuild a clean, ACTIVE state for the subject: a fresh org affiliation plus a hospital
-- affiliation at central-a. ⛔ Set explicitly, never inherited from §2 — the sibling
-- suite `377` taught that an earlier arm which SUCCEEDS mutates the row every later arm
-- depends on, and the later arms then pass for the wrong reason.
-- ⛔ REACTIVATE EXACTLY ONE ROW. §2 left THREE org-affiliation rows for this subject, and
-- the partial unique index is `(principal_id, organization_id) WHERE ended_on IS NULL AND
-- voided_at IS NULL` — clearing `ended_on` on all of them is a 23505, not a reset. The
-- no-delete guard (§1) means the extras cannot simply be removed either; they stay, ended.
update public.organization_affiliations
   set voided_at = null, voided_by = null, void_reason = null
 where principal_id = (select subject from k) and voided_at is not null;
update public.organization_affiliations
   set ended_on = null, ended_by = null
 where id = (select id from public.organization_affiliations
              where principal_id = (select subject from k)
                and organization_id = (select org_a from k)
              order by created_at desc, id desc limit 1);
update public.hospital_affiliations
   set ended_on = null, ended_by = null
 where principal_id = (select subject from k);

create or replace function pg_temp.blocker_detail(p_user uuid, p_org uuid)
returns text language plpgsql as $fn$
declare v_detail text;
begin
  perform public.end_org_affiliation(p_user, p_org);
  return null; -- reached only if the door did NOT refuse
exception when others then
  -- ⚠ GET STACKED DIAGNOSTICS, not a bare special variable: `pg_exception_detail` alone is
  -- not in scope in plpgsql and would be read as an undeclared identifier.
  get stacked diagnostics v_detail = pg_exception_detail;
  return v_detail;
end;
$fn$;

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select is(
  (select (jsonb_path_query_first(
             pg_temp.blocker_detail('00000000-0000-0000-0000-0000000000d1',
                                    '0c000000-0000-0000-0000-00000000000a')::jsonb,
             '$[*] ? (@.kind == "hospital_affiliation")') ->> 'hospital')),
  'Hospital Central A',
  '3.1 ⭐ the refusal ENUMERATES the hospital affiliation BY NAME — not a count, not an empty array');
reset role;

-- Add an ACTIVE commission-tier seat. Its org is resolved through commissions -> hospitals,
-- never from `organization_id`, so a door checking only the direct column misses it.
insert into public.memberships (id, principal_id, commission_id, role, granted_at)
values ((select seat_id from k), (select subject from k), (select commission_a from k), 'staff', now());

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select is(
  (select (jsonb_path_query_first(
             pg_temp.blocker_detail('00000000-0000-0000-0000-0000000000d1',
                                    '0c000000-0000-0000-0000-00000000000a')::jsonb,
             '$[*] ? (@.kind == "membership")') ->> 'role')),
  'staff',
  '3.2 ... and a COMMISSION-TIER seat is enumerated with its role, resolved through commissions -> hospitals -> org');
reset role;

-- ⭐ THE D6 DIFFERENTIAL AT THE `detail` GRAIN. `379` §3.3 proves an expired seat does not
-- change the VERDICT. It cannot see an expired seat that is still LISTED as a blocker
-- while something else does the blocking — which would tell an operator to revoke a seat
-- that is already gone. Same row, only `expires_at` moved.
update public.memberships set expires_at = now() - interval '1 day' where id = (select seat_id from k);

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
-- ⛔ ASSERTED AS THE EXACT SET OF KINDS, NOT AS "membership IS ABSENT". A bare
-- absence check passes when the detail is NULL — which is what a door that stopped
-- refusing altogether returns — so the vacuous reading and the correct one agree.
-- Naming the surviving blocker makes both failures distinguishable from a pass.
select is(
  (select string_agg(distinct e.value ->> 'kind', ',' order by e.value ->> 'kind')
     from jsonb_array_elements(
            pg_temp.blocker_detail('00000000-0000-0000-0000-0000000000d1',
                                   '0c000000-0000-0000-0000-00000000000a')::jsonb) e),
  'hospital_affiliation',
  '3.3 ⭐ an EXPIRED seat is ABSENT while the hospital affiliation still blocks — the refusal happens either way, so only the LIST can tell the two apart');
reset role;

delete from public.memberships where id = (select seat_id from k);

-- ============================================================================
-- §4 AN ENDED ROW IS STILL VOIDABLE (D7).
--
-- True today only INCIDENTALLY: `379` §4.5 voids a hospital row that an earlier line
-- happened to end, under a label about creation symmetry. Naming the property is the
-- difference between a guarantee and a coincidence — and D7 turns on it, because "was
-- never true" must remain sayable about an employment that has already stopped.
-- ============================================================================

-- End the org affiliation cleanly through the door (the hospital tie must go first, D3).
update public.hospital_affiliations set ended_on = current_date
 where principal_id = (select subject from k) and ended_on is null;
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select public.end_org_affiliation('00000000-0000-0000-0000-0000000000d1',
                                  '0c000000-0000-0000-0000-00000000000a');
reset role;

-- ⚠ D8's OTHER precondition, satisfied as FIXTURE rather than tested here: an org
-- affiliation cannot be voided while a NON-VOIDED hospital affiliation stands in that org
-- (`HC0RA`) — "was never employed here" is not assertable while a hospital record says
-- otherwise. `379` §5.2 is the arm that tests that refusal; this section is about the ENDED
-- tense, so the hospital rows are voided out of the way first. Direct SQL, deliberately:
-- routing fixture setup through `void_affiliation` would make this section's result depend
-- on a second door's rules.
update public.hospital_affiliations
   set voided_at = now(), voided_by = (select org_admin_a from k), void_reason = 'preparação de teste'
 where principal_id = (select subject from k) and voided_at is null;

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select lives_ok(
  $$select public.void_org_affiliation(
      -- ⚠ ORDERED AND LIMITED: §2 leaves several ended rows for this subject (the
      -- no-delete guard means they cannot be cleared away), so an unqualified subquery
      -- here raises 21000 rather than testing anything.
      (select id from public.organization_affiliations
        where principal_id = '00000000-0000-0000-0000-0000000000d1'
          and organization_id = '0c000000-0000-0000-0000-00000000000a'
          and voided_at is null
        order by created_at desc, id desc limit 1),
      'registrado no cadastro errado')$$,
  '4.1 ⭐ an ALREADY-ENDED org affiliation is still VOIDABLE — "was never true" must stay sayable about an employment that already stopped');
reset role;

select ok(
  (select ended_on is not null and voided_at is not null
     from public.organization_affiliations
    where principal_id = (select subject from k)
      and organization_id = (select org_a from k)
    order by voided_at desc nulls last limit 1),
  '4.2 ... and BOTH tenses survive on the row (D7: they may coexist; voided takes precedence) — a void that cleared `ended_on` would rewrite history');

-- ============================================================================
-- §5 THE START DATE REACHES D5's ORG-PARENT ENSURE (migration 20261003004200).
--
-- ⭐ RED-FIRST, AND OBSERVED RED: run against the pre-20261003004200 body, 5.1 fails with
-- the org row carrying `current_date` while 5.2 passes — the hospital row always carried
-- the date. That asymmetry IS the defect: B5's backfill went to the trouble of
-- approximating `started_on = created_at::date` because the date matters, which would have
-- left BACKFILLED rows more faithful than the ones the live write path produces.
-- ============================================================================

-- The subject now holds a voided org affiliation and no active one, so D5's ensure has
-- real work: a no-op idempotent branch would prove nothing about the date.
select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select subject from k) and ended_on is null and voided_at is null), 0,
  '5.0 PRECONDITION: no active org affiliation, so the ensure below actually INSERTS');

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select public.affiliate_person(
  '00000000-0000-0000-0000-0000000000d1',
  '05000000-0000-0000-0000-0000000000a2',  -- secundario-a: no affiliation there yet
  null,
  '2019-03-04');
reset role;

select is(
  (select started_on from public.organization_affiliations
    where principal_id = (select subject from k)
      and organization_id = (select org_a from k)
      and ended_on is null and voided_at is null),
  (select past_start from k),
  '5.1 ⭐ D5''s ORG-PARENT ensure carries the caller''s start date — it discarded it and defaulted to today before 20261003004200');

select is(
  (select started_on from public.hospital_affiliations
    where principal_id = (select subject from k)
      and hospital_id = (select secundario_a from k)
      and ended_on is null and voided_at is null),
  (select past_start from k),
  '5.2 ... and the hospital row carries the SAME date — one employment, two rows, one start');

-- ============================================================================
-- §6 D4 CONTAINMENT — and this section is LAST for a reason: `set constraints all
-- immediate` applies for the REMAINDER of the transaction, so running it earlier would
-- silently change how every later arm's writes are checked.
--
-- ⛔⛔ WRITTEN THE OBVIOUS WAY, THIS SECTION ASSERTS NOTHING.
--    `hospital_affiliation_has_org_trg` is DEFERRABLE INITIALLY DEFERRED, so its check
--    runs at COMMIT — and every pgTAP suite ends in `rollback`, so it NEVER FIRES in any
--    of them. "Insert an orphan, expect a refusal" therefore observes the insert SUCCEED,
--    and wrapped in an exception handler it reports PASS while proving nothing. This is
--    measured, not predicted: exactly that arm was written on 2026-08-26 and passed
--    wrongly on the first attempt. `set constraints all immediate` is the whole fix.
-- ============================================================================

select is(
  (select count(*)::int from pg_trigger
    where tgrelid = 'public.hospital_affiliations'::regclass
      and tgname = 'hospital_affiliation_has_org_trg'
      and tgdeferrable and tginitdeferred), 1,
  '6.0 ⛔ THE TRAP, PINNED: the trigger IS deferrable-initially-deferred, which is why 6.1 must force it immediate — if this ever becomes false, re-read 6.1 before trusting it');

-- ⛔ FLUSH EVERY DEFERRED CHECK QUEUED BY EARLIER SECTIONS, WHILE THE STATE IS STILL LEGAL.
--    §3, §4 and §5 all wrote to `hospital_affiliations`, so each queued a deferred event
--    that is still pending. Without this flush, 6.1's `set constraints all immediate` would
--    also fire THOSE — and 6.1 would throw for a row it did not insert, which is
--    indistinguishable from throwing for the right reason. Precisely the wrong-arm trap the
--    SQLSTATE pins are meant to defeat, one layer down.
--
--    That this flush LIVES is itself the assertion: it says the state reaching §6 satisfies
--    D4, so everything after it is about the rows §6 creates.
select lives_ok(
  $$set constraints all immediate$$,
  '6.0b the state entering this section already satisfies D4 — so every refusal below is about a row THIS section wrote, not a leftover');
set constraints all deferred;

-- Now remove the parent: end the active org affiliation §5 created. This is an UPDATE to
-- `organization_affiliations`, which queues NO deferred event (the trigger is on
-- `hospital_affiliations`), so the orphan it creates is invisible until something writes
-- a hospital row.
update public.organization_affiliations
   set ended_on = current_date, ended_by = (select org_admin_a from k)
 where principal_id = (select subject from k) and ended_on is null and voided_at is null;

select throws_ok(
  $$insert into public.hospital_affiliations
      (id, principal_id, organization_id, hospital_id, started_on)
    values ('ba000000-0000-0000-0000-000000000380',
            '00000000-0000-0000-0000-0000000000d1',
            '0c000000-0000-0000-0000-00000000000a',
            '05000000-0000-0000-0000-00000000000a',
            current_date);
    set constraints all immediate;$$,
  '23514',
  null,
  '6.1 ⭐ an ACTIVE hospital affiliation with NO active org parent is REFUSED — and ONLY because the constraint is forced immediate in the same block; without that line this arm observes the insert SUCCEED and passes while proving nothing');

-- ⭐ THE SCOPE CARVE-OUT IS REAL, and it is what stops 6.1 from being read as "the trigger
-- rejects everything". D7: an ENDED or VOIDED row is a historical record and may outlive
-- its org affiliation — constraining it would make the past unrepresentable.
select lives_ok(
  $$insert into public.hospital_affiliations
      (id, principal_id, organization_id, hospital_id, started_on, ended_on)
    values ('ba000000-0000-0000-0000-000000000381',
            '00000000-0000-0000-0000-0000000000d1',
            '0c000000-0000-0000-0000-00000000000a',
            '05000000-0000-0000-0000-00000000000a',
            '2018-01-01', '2018-12-31');
    set constraints all immediate;$$,
  '6.2 ... but an ENDED orphan is ACCEPTED — the carve-out is real, so 6.1 is about ACTIVE containment and not about the trigger rejecting every write');
set constraints all deferred;

-- ⚠ AT central-a, NOT secundario-a: §5''s `affiliate_person` left an ACTIVE secundario-a
-- row, and the partial unique `(principal_id, hospital_id) WHERE ended_on IS NULL AND
-- voided_at IS NULL` would make this a 23505 — a failure that looks exactly like the
-- containment refusal this arm is asserting must NOT happen.
--
-- ⭐ AND DEFERRAL ITSELF WORKS: child before parent, inside ONE transaction, is legal. That
-- is the entire reason the trigger is DEFERRABLE rather than immediate — a door that writes
-- the parent and the child in either order must not be forced into one ordering. It is also
-- why `supabase db reset` is the real test of `seed.sql`'s insert ordering (plan B7): in the
-- AUTOCOMMIT shape the refusal escapes uncatchably at statement commit.
select lives_ok(
  $$insert into public.hospital_affiliations
      (id, principal_id, organization_id, hospital_id, started_on)
    values ('ba000000-0000-0000-0000-000000000382',
            '00000000-0000-0000-0000-0000000000d1',
            '0c000000-0000-0000-0000-00000000000a',
            '05000000-0000-0000-0000-00000000000a',
            current_date);
    insert into public.organization_affiliations
      (id, principal_id, organization_id, started_on)
    values ('bc000000-0000-0000-0000-000000000380',
            '00000000-0000-0000-0000-0000000000d1',
            '0c000000-0000-0000-0000-00000000000a',
            current_date);
    set constraints all immediate;$$,
  '6.3 ... and CHILD-BEFORE-PARENT in one transaction is ACCEPTED — deferral is doing its job, which is why 6.1 had to force the check rather than expect it');
set constraints all deferred;

select * from finish();
rollback;
