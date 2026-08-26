-- AFF4 B4 (increment 1) — "ACTIVE" excludes the VOIDED tense in the four bodies that
-- decide it. ADR 0151 D6/D7.
--
-- D6 defines active once: `ended_on IS NULL AND voided_at IS NULL`. B1/B2 taught that to
-- the indexes; these four function bodies tested `ended_on IS NULL` alone. Each arm below
-- was observed RED before the migration.
--
-- ⚠ THESE ARE DIFFERENTIALS, NOT POST-STATES. §4 asserts the affiliation is VISIBLE first
-- and gone after — asserting only the absence would pass against a fixture where nothing
-- was ever visible. §1 asserts the pre-void row still exists alongside the new one, so
-- "a new row appeared" cannot be satisfied by the old one having been mutated.
--
-- ⚠ A VOIDED ROW HAS `ended_on IS NULL`. That is the whole mechanism and it is worth
-- stating: void does not end, so every predicate that used `ended_on IS NULL` as a proxy
-- for "active" saw a voided row as live. Nothing here would fail if void set `ended_on`.
--
-- ⚠ The void is applied by an owner-level UPDATE, not by `void_affiliation` — that door is
-- increment 3 and does not exist yet. This suite is about what "active" MEANS; the door's
-- own authority grid is B9's.
--
-- Assertion count: 9

begin;
select plan(9);

create temp table k on commit drop as select
  '00000000-0000-0000-0000-0000000000d1'::uuid as subject,     -- novato.pendente, seeded at central-a
  '00000000-0000-0000-0000-0000000000e1'::uuid as hosp_admin,  -- hospital_admin of central-a
  '00000000-0000-0000-0000-0000000000b1'::uuid as org_admin_a, -- org_admin of Rede A
  '0c000000-0000-0000-0000-00000000000a'::uuid as org_a,
  '05000000-0000-0000-0000-00000000000a'::uuid as central_a;
grant select on k to authenticated;
grant select on k to service_role;

-- ============================================================================
-- §0 PRECONDITIONS
-- ============================================================================
select is((select enabled from app.feature_flags where key = 'audit_trail'), true,
  '0.0 PRECONDITION: audit_trail is enabled (every write below trips the affiliation audit trigger)');

select is(
  (select count(*)::int from public.hospital_affiliations
    where principal_id = (select subject from k) and hospital_id = (select central_a from k)
      and ended_on is null and voided_at is null), 1,
  '0.1 PRECONDITION: the subject has exactly ONE ACTIVE affiliation at central-a to void');

-- ============================================================================
-- §4a CONTROL, taken BEFORE the void — the affiliation is visible in the people search.
--     Without this, §4b's empty array is consistent with the search never showing it.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select is(
  (select jsonb_array_length(p.affiliations)
     from public.list_org_people('0c000000-0000-0000-0000-00000000000a') p
    where p.user_id = '00000000-0000-0000-0000-0000000000d1'), 1,
  '4a CONTROL (pre-void): list_org_people shows the subject''s ONE affiliation');
reset role;

-- ── THE VOID ────────────────────────────────────────────────────────────────
update public.hospital_affiliations
   set voided_at = now(), void_reason = 'lancamento indevido - keystone 377'
 where principal_id = (select subject from k) and hospital_id = (select central_a from k);

-- ============================================================================
-- §4b public.list_org_people — a voided affiliation is not prior employment.
--     This is the arm a USER sees: without it, a mis-entered hospital reappears as a
--     rehire suggestion in the add-a-person search.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select is(
  (select jsonb_array_length(p.affiliations)
     from public.list_org_people('0c000000-0000-0000-0000-00000000000a') p
    where p.user_id = '00000000-0000-0000-0000-0000000000d1'), 0,
  '4b ⭐ list_org_people no longer reports the VOIDED affiliation');
reset role;

-- ============================================================================
-- §2 app.end_affiliation_impl — `end` and `void` make contradictory claims about
--    history. A voided row must not be endable.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false);
set local role authenticated;
select throws_ok(
  $$select public.end_affiliation('00000000-0000-0000-0000-0000000000d1',
                                  '05000000-0000-0000-0000-00000000000a')$$,
  'HC0R2', null,
  '2.1 ⭐ end_affiliation refuses a VOIDED row — "vínculo ativo não encontrado", because it is not active');

-- ⚠ STATE RESET, AND IT IS LOAD-BEARING FOR THE RED. Before this migration
-- `end_affiliation` above SUCCEEDS and stamps `ended_on`. Every later arm would then pass
-- for the WRONG REASON — refusing, or inserting, because the row is ENDED rather than
-- because it is VOIDED — and the red-first evidence for §3 and §1 would be worthless.
-- Each arm has to be independently red. Post-migration this UPDATE matches a row whose
-- `ended_on` is already null and changes nothing.
reset role;
update public.hospital_affiliations
   set ended_on = null, ended_by = null
 where principal_id = (select subject from k) and hospital_id = (select central_a from k)
   and voided_at is not null;
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false);
set local role authenticated;

-- ============================================================================
-- §3 app.update_affiliation_impl — correcting the dates of a record that asserts it
--    never happened.
-- ============================================================================
select throws_ok(
  $$select public.update_affiliation('00000000-0000-0000-0000-0000000000d1',
                                     '05000000-0000-0000-0000-00000000000a', 'MAT-377')$$,
  'HC0R2', null,
  '3.1 ⭐ update_affiliation refuses a VOIDED row');

-- ============================================================================
-- §1 app.affiliate_person_impl — the idempotency probe. A voided row must NOT be found
--    as "the existing active row" and refreshed: voiding a mis-entry and re-affiliating
--    has to produce a NEW row, or the void is silently undone.
-- ============================================================================
select lives_ok(
  $$select public.affiliate_person('00000000-0000-0000-0000-0000000000d1',
                                   '05000000-0000-0000-0000-00000000000a', 'MAT-REHIRE')$$,
  '1.1 re-affiliating after a void is accepted');
reset role;

select is(
  (select count(*)::int from public.hospital_affiliations
    where principal_id = (select subject from k) and hospital_id = (select central_a from k)), 2,
  '1.2 ⭐ TWO rows now exist — the voided one was PRESERVED, not resurrected by the idempotency probe');

select is(
  (select count(*)::int from public.hospital_affiliations
    where principal_id = (select subject from k) and hospital_id = (select central_a from k)
      and ended_on is null and voided_at is null), 1,
  '1.3 ⭐ ... exactly one of which is ACTIVE');

select * from finish();
rollback;
