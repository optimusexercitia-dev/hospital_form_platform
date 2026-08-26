-- AFF4 B4 (increment 2) — D9 staff data on the affiliation doors, and the D5 org-parent
-- ensure inside `affiliate_person`.
--
-- ⚠ EVIDENCE IS MUTATION-BASED, NOT TEMPORAL RED-FIRST, and that is deliberate. These
-- surfaces did not exist before the migration, so running this suite beforehand would have
-- failed with "function does not exist" — a red that proves the function is absent and
-- NOTHING about whether the assertions discriminate. That is the vacuous-red trap in its
-- purest form. Each load-bearing arm below was instead run against a deliberately mutated
-- implementation and required to fail; the mutations are named on the arms.
--
-- ⭐ §1 IS THE ONE THAT MATTERS: D5, the org-parent ensure. It is what makes a rehire ONE
-- STEP. The org-tier door is org_admin-only, so without the ensure a hospital admin's
-- rehire would stall waiting for an org_admin ticket for someone the hospital is actively
-- trying to re-employ. §1.1 is a DIFFERENTIAL — §0.1 proves no org affiliation exists
-- first, or "one exists afterwards" would be satisfied by one that was always there.
--
-- ⭐ THAT PREDICTION CAME TRUE, AND THIS IS THE REPAIR (AFF4 B7, 2026-08-26). The header
-- used to say `organization_affiliations` is EMPTY until B5 backfills and B7 seeds it,
-- which made §0.1's control trivially true and load-bearing later — "when the seed does
-- carry org rows, an unchanged §0.1 will fail loudly rather than letting §1.1 quietly stop
-- measuring". B7's seed now gives EVERY persona an active org affiliation, §0.1 failed
-- exactly as designed, and the repair is to CONSTRUCT the state the differential needs
-- rather than to relax the assertion: §0.1a ends the subject's seeded org affiliation, so
-- §1 measures an ensure that genuinely has work to do.
--
-- ⚠ THE FIXTURE ENDS THE ROW WITH SQL, NOT WITH THE DOOR, and that is forced rather than
-- lazy: `end_org_affiliation` refuses while an active hospital affiliation remains in the
-- org (D3's blocker enumeration), and the subject keeps their central-a employment because
-- §3–§5 exercise the REFRESH path against it. The resulting state — an active hospital
-- affiliation whose org parent is ended — is precisely the D4 violation the containment
-- backstop exists to prevent, so no door can produce it; it lives only inside this
-- transaction, and §0.1b asserts the fixture actually landed rather than assuming it.
--
-- Assertion count: 16

begin;
select plan(16);

create temp table k on commit drop as select
  '00000000-0000-0000-0000-0000000000d1'::uuid as subject,      -- novato.pendente, org A
  '00000000-0000-0000-0000-0000000000b1'::uuid as org_admin_a,  -- actor for every call
  '0c000000-0000-0000-0000-00000000000a'::uuid as org_a,
  '05000000-0000-0000-0000-00000000000a'::uuid as central_a,    -- subject ALREADY affiliated here
  '05000000-0000-0000-0000-0000000000a2'::uuid as secundario_a; -- subject NOT affiliated here
grant select on k to authenticated;
grant select on k to service_role;

-- ============================================================================
-- §0 PRECONDITIONS — each is a way an arm below could stop measuring.
-- ============================================================================
select is((select enabled from app.feature_flags where key = 'audit_trail'), true,
  '0.0 PRECONDITION: audit_trail is enabled (§1.3 reads the audit row the ensure emits)');

-- §0.1a THE FIXTURE. End the subject's SEEDED org affiliation so §1's ensure has work to
-- do. See the header for why this is SQL and not the door.
update public.organization_affiliations
   set ended_on = current_date - 1,
       ended_by = (select org_admin_a from k)
 where principal_id    = (select subject from k)
   and organization_id = (select org_a from k)
   and ended_on is null and voided_at is null;

-- §1.3 counts the audit row the ensure emits. The seed's own inserts ALSO emit
-- `org_affiliation.created` rows (one per persona, this subject among them), so an
-- absolute count would silently include a row this transaction did not create. Snapshot
-- first and count only the difference — the `302` §5 idiom, for the same reason.
create temp table org_affil_audit_before on commit drop as
  select id from public.audit_log where action = 'org_affiliation.created';

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select subject from k)
      and ended_on is null and voided_at is null), 0,
  '0.1 PRECONDITION (the differential''s other half): the subject has NO ACTIVE org affiliation');

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select subject from k) and ended_on is not null), 1,
  '0.1b PRECONDITION: ... because §0.1a ENDED the seeded one — asserted, so a fixture that silently matched zero rows cannot make §0.1 pass for the wrong reason');

select is(
  (select count(*)::int from public.hospital_affiliations
    where principal_id = (select subject from k) and hospital_id = (select secundario_a from k)), 0,
  '0.2 PRECONDITION: and none at secundario-a, so §1 exercises the INSERT path rather than the refresh');

-- ============================================================================
-- §1 ⭐ D5 — the org-parent ensure, plus D9 staff data on the INSERT path.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select lives_ok(
  $$select public.affiliate_person('00000000-0000-0000-0000-0000000000d1',
                                   '05000000-0000-0000-0000-0000000000a2',
                                   'MAT-378', null,
                                   'Enfermeiro-chefe', 'chefe.378@hospital.local', '11988887777')$$,
  '1.0 affiliating with staff data is accepted');
reset role;

-- Mutation: deleting the ensure block makes 1.1 return 0.
select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select subject from k) and organization_id = (select org_a from k)
      and ended_on is null and voided_at is null), 1,
  '1.1 ⭐ D5: an ACTIVE org affiliation now exists — created by the hospital-affiliation door, so a rehire is ONE step');

-- The ACTIVE filter is load-bearing since B7: the subject now also owns an ENDED row
-- (§0.1a), and an unfiltered scalar subquery would return two rows and abort.
select is(
  (select created_by from public.organization_affiliations
    where principal_id = (select subject from k) and organization_id = (select org_a from k)
      and ended_on is null and voided_at is null),
  (select org_admin_a from k),
  '1.2 ⭐ ... naming the ACTOR, not NULL — an ensure that loses the actor is an unattributable write (Rule 11)');

select is(
  (select count(*)::int from public.audit_log
    where entity_type = 'organization_affiliation' and action = 'org_affiliation.created'
      and (metadata->>'user_id')::uuid = (select subject from k)
      and id not in (select id from org_affil_audit_before)), 1,
  '1.3 ⭐ ... and it is audited as its own org_affiliation.created row (scoped to rows THIS transaction created — the seed emits one per persona)');

-- Mutation: dropping the three columns from the INSERT column-list makes 1.4-1.6 return null.
select is(
  (select job_title from public.hospital_affiliations
    where principal_id = (select subject from k) and hospital_id = (select secundario_a from k)),
  'Enfermeiro-chefe',
  '1.4 D9: job_title is stored on the INSERT path');

select is(
  (select work_email::text from public.hospital_affiliations
    where principal_id = (select subject from k) and hospital_id = (select secundario_a from k)),
  'chefe.378@hospital.local',
  '1.5 D9: work_email is stored (text parameter into a citext column)');

select is(
  (select work_phone from public.hospital_affiliations
    where principal_id = (select subject from k) and hospital_id = (select secundario_a from k)),
  '11988887777',
  '1.6 D9: work_phone is stored');

-- ============================================================================
-- §2 THE ENSURE IS IDEMPOTENT. A second call must not stack a second org affiliation —
--    the partial unique would reject it, and a 23505 surfacing as a generic pt-BR error
--    is a worse answer than the intended one.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select public.affiliate_person('00000000-0000-0000-0000-0000000000d1',
                               '05000000-0000-0000-0000-0000000000a2', 'MAT-378B');
reset role;

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select subject from k) and organization_id = (select org_a from k)
      and ended_on is null and voided_at is null), 1,
  '2.1 a second affiliation call leaves exactly ONE ACTIVE org affiliation (the partial unique is on active rows, and the subject also owns the ended one from §0.1a)');

-- ============================================================================
-- §3 THE REFRESH PATH also carries staff data. The subject is already affiliated at
--    central-a, so this exercises the idempotent UPDATE rather than the INSERT — the two
--    write sites are separate code and a fix to one does not reach the other.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select public.affiliate_person('00000000-0000-0000-0000-0000000000d1',
                               '05000000-0000-0000-0000-00000000000a',
                               null, null, 'Coordenador', null, null);
reset role;

select is(
  (select job_title from public.hospital_affiliations
    where principal_id = (select subject from k) and hospital_id = (select central_a from k)),
  'Coordenador',
  '3.1 the idempotent REFRESH path stores staff data on the existing row');

-- ============================================================================
-- §4 update_affiliation — set, then CLEAR. "Leave alone" and "clear it" cannot both be
--    null, hence one explicit flag per field.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select public.update_affiliation('00000000-0000-0000-0000-0000000000d1',
                                 '05000000-0000-0000-0000-00000000000a',
                                 null, null, false, 'Diretor', null, null);
reset role;

select is(
  (select job_title from public.hospital_affiliations
    where principal_id = (select subject from k) and hospital_id = (select central_a from k)),
  'Diretor',
  '4.1 update_affiliation sets job_title');

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select public.update_affiliation('00000000-0000-0000-0000-0000000000d1',
                                 '05000000-0000-0000-0000-00000000000a',
                                 null, null, false, null, null, null, true, false, false);
reset role;

select is(
  (select job_title from public.hospital_affiliations
    where principal_id = (select subject from k) and hospital_id = (select central_a from k)),
  null,
  '4.2 ⭐ p_clear_job_title CLEARS it — and passing null alone (4.1 -> here) would have left it, which is the whole reason the flag exists');

-- ============================================================================
-- §5 A BLANK BOX IS NOT A FACT. `nullif(btrim(...))` normalises whitespace to NULL, which
--    the not-blank CHECKs would otherwise reject with a raw 23514.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select public.update_affiliation('00000000-0000-0000-0000-0000000000d1',
                                 '05000000-0000-0000-0000-00000000000a',
                                 null, null, false, '   ', null, null);
reset role;

select is(
  (select job_title from public.hospital_affiliations
    where principal_id = (select subject from k) and hospital_id = (select central_a from k)),
  null,
  '5.1 a whitespace-only job_title is normalised to NULL, not stored as blank and not raised as 23514');

select * from finish();
rollback;
