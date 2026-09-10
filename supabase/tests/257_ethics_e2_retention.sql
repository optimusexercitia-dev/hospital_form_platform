-- =============================================================================
-- ETH·E2 (ADR 0073 D9) — BE-5 gate: the M2 retention-pin trigger + professional
--   redaction (the platform's first professional-erasure path).
--
-- ⛔ Two mutation twins (be5-retention-mutation-audit.sh):
--   • idempotency — neutralize the pin's `retention_pinned_at is null` guard → a second
--     issued decision RE-PINS (overwrites the stamped timestamp) → the "timestamp
--     preserved" keystone goes RED.
--   • HC0J7 bar — neutralize the bar in redact_professional_profile → a PINNED respondent
--     gets erased → the "redact pinned → HC0J7" keystone goes RED.
-- Both must be RED-PROVEN with the control green.
--
-- Fresh reset. Setup as superuser; the redaction door asserted per persona.
-- =============================================================================

begin;
-- ⚠ 19 -> 22 at pre-AE5 Batch 10 (PO ruling R2): Blocks C, D and E were RE-ACTORED onto
-- `oa_b` and three AUTHORITY cells were added beside them — see the note at Block C.
select plan(22);

update app.feature_flags set enabled = true where key in ('ethics', 'audit_trail', 'case_participants');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         -- Added by pre-AE5 Batch 10: the ORG_ADMIN of the bootstrap org, which is the org
         -- `org_x` below resolves to. Blocks C/D/E moved onto it — see the note at Block C.
         (v->>'oa_b')::uuid   as oa_b,
         (v->>'comm_x')::uuid as comm_x,
         app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

-- ---------------------------------------------------------------------------
-- Fixture: an ethics case; P1 = a respondent_doctor profile (will be pinned); P2 = a
-- NON-respondent (witness) profile (redactable); two decisions (for pin + idempotency).
-- ---------------------------------------------------------------------------
reset role;

insert into public.cases (id, commission_id, case_number, created_by, visibility_policy, confidentiality_level)
values ('00000000-0000-0000-0000-0000000e2001', (select comm_x from k), 92401, (select sa_x from k),
        'explicit_grants_only', 'ethics_investigation');
insert into public.ethics_case_details (case_id) values ('00000000-0000-0000-0000-0000000e2001');

insert into public.case_participant_roles
  (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
values ('00000000-0000-0000-0000-0000000e2103', (select org_x from k), 'respondent_doctor',
        'Médico denunciado', array['professional'], true),
       ('00000000-0000-0000-0000-0000000e2104', (select org_x from k), 'witness',
        'Testemunha', array['professional'], false);

-- P1 (respondent) + P2 (witness).
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ('00000000-0000-0000-0000-0000000e2101', (select org_x from k), 'professional', 'professional_identity', 'P1 surrogate'),
       ('00000000-0000-0000-0000-0000000e2121', (select org_x from k), 'professional', 'professional_identity', 'P2 surrogate');
insert into public.professional_profiles (id, organization_id, user_id, full_name, license_number, link_state)
values ('00000000-0000-0000-0000-0000000e2102', (select org_x from k), (select st_x from k),  'Dr Reu Pin', 'CRM-111', 'linked'),
       ('00000000-0000-0000-0000-0000000e2122', (select org_x from k), (select st_x2 from k), 'Dr Testemunha', 'CRM-222', 'linked');
insert into public.professional_participants (participant_id, professional_profile_id)
values ('00000000-0000-0000-0000-0000000e2101', '00000000-0000-0000-0000-0000000e2102'),
       ('00000000-0000-0000-0000-0000000e2121', '00000000-0000-0000-0000-0000000e2122');
insert into public.case_participants (id, case_id, participant_id, role_id, is_primary_subject)
values ('00000000-0000-0000-0000-0000000e2110', '00000000-0000-0000-0000-0000000e2001',
        '00000000-0000-0000-0000-0000000e2101', '00000000-0000-0000-0000-0000000e2103', true),
       ('00000000-0000-0000-0000-0000000e2130', '00000000-0000-0000-0000-0000000e2001',
        '00000000-0000-0000-0000-0000000e2121', '00000000-0000-0000-0000-0000000e2104', false);

insert into public.case_decisions (id, case_id, decision_type, summary_md, status)
values ('00000000-0000-0000-0000-0000000e2050', '00000000-0000-0000-0000-0000000e2001', 'ethics_ruling', 'x', 'voted'),
       ('00000000-0000-0000-0000-0000000e2051', '00000000-0000-0000-0000-0000000e2001', 'ethics_ruling', 'y', 'voted');

-- ===========================================================================
-- Block A — the pin fires on issue (respondent only), audited PHI-free.
-- ===========================================================================
select ok((select retention_pinned_at from public.professional_profiles where id = '00000000-0000-0000-0000-0000000e2102') is null,
  'pin: the respondent profile is NOT pinned before the decision issues');

-- Issue decision 1 (fires the AFTER UPDATE pin trigger). Actor = sa_x for the audit.
select test_helpers.claims_for((select sa_x from k), false);
update public.case_decisions set status = 'issued', decided_at = now() where id = '00000000-0000-0000-0000-0000000e2050';

select ok((select retention_pinned_at from public.professional_profiles where id = '00000000-0000-0000-0000-0000000e2102') is not null,
  'pin: issuing the decision pins the respondent_doctor profile');
select ok((select retention_pinned_at from public.professional_profiles where id = '00000000-0000-0000-0000-0000000e2122') is null,
  'pin: a NON-respondent (witness) profile is NOT pinned');
select is((select count(*)::int from public.audit_log
           where action = 'professional_profile.retention_pinned'
             and entity_id = '00000000-0000-0000-0000-0000000e2102'), 1,
  'pin: exactly one professional_profile.retention_pinned audit row');
select ok(not exists (
  select 1 from public.audit_log
  where action = 'professional_profile.retention_pinned'
    and (metadata::text ilike '%Dr Reu Pin%' or metadata::text ilike '%CRM-111%')),
  'pin audit (Rule 11): NO identity payload in the retention_pinned row');

-- ===========================================================================
-- Block B — idempotency: a second issued decision does NOT re-pin.
-- ===========================================================================
-- Stamp a distinct past value; a re-pin would overwrite it with now().
update public.professional_profiles
  set retention_pinned_at = '2020-01-01 00:00:00+00'::timestamptz
where id = '00000000-0000-0000-0000-0000000e2102';

select test_helpers.claims_for((select sa_x from k), false);
update public.case_decisions set status = 'issued', decided_at = now() where id = '00000000-0000-0000-0000-0000000e2051';

select is((select retention_pinned_at from public.professional_profiles where id = '00000000-0000-0000-0000-0000000e2102'),
          '2020-01-01 00:00:00+00'::timestamptz,
  'idempotency: a second issued decision does NOT overwrite retention_pinned_at');
select is((select count(*)::int from public.audit_log
           where action = 'professional_profile.retention_pinned'
             and entity_id = '00000000-0000-0000-0000-0000000e2102'), 1,
  'idempotency: still exactly one retention_pinned audit row (no re-pin)');

-- ===========================================================================
-- Block C — the HC0J7 redaction bar.
-- ===========================================================================
-- ⛔⛔ THE CALLER MOVED FROM sa_x TO admin, AND THAT IS WHAT KEEPS BLOCK C ALIVE.
-- Matrix § 12.8.5 warned that these HC0J7 expectations "drift to 42501 and COLLIDE with the
-- negative twin at Block D" — a bar test whose error code slides onto its own authority
-- control's code, so both go green and NEITHER measures what it names. AE4.7c revoked row 30
-- from staff_admin, so sa_x is now refused by AUTHORITY before the redaction bar is ever
-- evaluated. Re-coding HC0J7 to 42501 would have deleted this block's entire subject.
--
-- ⭐ `admin` (platform_admin) still holds row 30, so the call reaches the bar and is refused
-- BY THE BAR. Block D's authority test keeps its own caller and its own 42501, so the two
-- codes stay attached to two different claims.
--
-- ⛔⛔ AND IT HAPPENED AGAIN, 2026-09-10 (pre-AE5 Batch 10, PO ruling R2) — TO THE FIX. ADR
-- 0201 D5 removed the platform arm from `app.can_manage_professional`, so `admin` no longer
-- holds row 30 either: all three `admin` cells in Blocks C/D (and the flag cell in Block E's
-- stated rationale) now hit 42501 at AUTHORITY, one layer BEFORE the bar. ⚠ THE FOUR REDS
-- READ AS IF THE RETENTION BAR HAD BROKEN, and no ruling predicted them — this file was found
-- by DERIVING the red set (files seating a platform_admin hat × files naming an affected door),
-- not by inheriting the four the rulings named.
--
-- ⭐ THE CALLER MOVES AGAIN, TO `oa_b`, FOR THE SAME REASON IT MOVED THE FIRST TIME: the
-- population that still holds row 30 is ORG AUTHORITY. `oa_b` is bootstrap's org_admin of the
-- single bootstrap org, and this file's `org_x` resolves to that same org (verified against
-- `app.org_of_commission(comm_x)`), so no membership is added and no other cell sees a change.
-- Re-coding HC0J7 to 42501 and stopping there would have deleted this block's entire subject —
-- exactly what the paragraph above already warned about, one layer up.
--
-- ⭐ AND EACH RE-ACTORED CELL GAINS AN AUTHORITY TWIN, so the 42501 that used to be this
-- block's red is now an ASSERTION of its own rather than a silenced one.
reset role;
select test_helpers.claims_for((select oa_b from k), false, 'org_admin');
set local role authenticated;
select throws_ok(
  $$ select public.redact_professional_profile('00000000-0000-0000-0000-0000000e2102', 'pedido do titular') $$,
  'HC0J7', null,
  'redaction bar: a retention-pinned respondent cannot be redacted (HC0J7) — asked by ORG AUTHORITY (oa_b since ADR 0201 D5), so the refusal is the bar and not the authority bound');
reset role;
select test_helpers.claims_for((select admin from k), true, 'platform_admin');
set local role authenticated;
select throws_ok(
  $$ select public.redact_professional_profile('00000000-0000-0000-0000-0000000e2102', 'pedido do titular') $$,
  '42501', null,
  'redaction AUTHORITY ⭐⭐ ADR 0201 D5: the hatted platform_admin is refused at the door''s AUTHORITY check and never reaches the retention bar. ⛔ Reading this as "the retention pin broke" is the misread this split exists to prevent — the cell above is where HC0J7 is asserted now.');
reset role;
-- Belt: clear the pin column; the respondent-in-issued-decision check still bars it.
update public.professional_profiles set retention_pinned_at = null where id = '00000000-0000-0000-0000-0000000e2102';
select test_helpers.claims_for((select oa_b from k), false, 'org_admin');
set local role authenticated;
select throws_ok(
  $$ select public.redact_professional_profile('00000000-0000-0000-0000-0000000e2102', 'pedido') $$,
  'HC0J7', null,
  'redaction bar (belt): a respondent in an issued-decision case is barred even if the pin column is clear');
reset role;
select test_helpers.claims_for((select admin from k), true, 'platform_admin');
set local role authenticated;
select throws_ok(
  $$ select public.redact_professional_profile('00000000-0000-0000-0000-0000000e2102', 'pedido') $$,
  '42501', null,
  'redaction AUTHORITY (belt) ⭐ ADR 0201 D5: the same one-layer-earlier refusal on the belt path. Paired with the cell above so the BELT''s HC0J7 and the platform_admin''s 42501 stay attached to two different claims.');
reset role;

-- ===========================================================================
-- Block D — authority + minimise-not-destroy success on an eligible profile (P2).
-- ===========================================================================
-- Authority: a plain member (non-manager) is denied (42501).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.redact_professional_profile('00000000-0000-0000-0000-0000000e2122', 'x') $$,
  '42501', null,
  'redaction authority: a non-manager (plain member) is denied (42501)');
reset role;
-- ⭐ AE4.7c: THE SECOND AUTHORITY DENIAL, and it is the new one. The plain member above was
-- always refused; a staff_admin was always ADMITTED. Row 30 is revoked, so a COORDINATOR is
-- now refused too — the assertion that says the revoke actually reaches the redaction door
-- rather than only the catalog.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.redact_professional_profile('00000000-0000-0000-0000-0000000e2122', 'x') $$,
  '42501', null,
  'redaction authority ⭐ AE4.7c: a COORDINATOR (staff_admin) is denied — a staff_admin adds a professional, never redacts one (matrix row 30 revoked)');
reset role;
-- Success: ORG AUTHORITY redacts the eligible (non-respondent, unpinned) profile. ⛔ Without
-- this the denials above are equally explained by a door that refuses everyone, and every
-- "minimise-not-destroy" assertion below would never run.
-- ⚠ CALLER MOVED TO `oa_b` AT ADR 0201 D5, same reason as Block C: `admin` is no longer org
-- authority for the professional registry. Its authority twin follows immediately.
select test_helpers.claims_for((select admin from k), true, 'platform_admin');
set local role authenticated;
select throws_ok(
  $$ select public.redact_professional_profile('00000000-0000-0000-0000-0000000e2122', 'pedido do titular') $$,
  '42501', null,
  'redaction AUTHORITY ⭐⭐ ADR 0201 D5, THE THIRD DENIAL AND THE NEW ONE: a hatted platform_admin is refused on an ELIGIBLE profile too — so the refusal is the removed arm, not the retention bar and not the flag. Together with the two staff denials above and the org_admin success below, the door is shown to return BOTH answers in this world.');
reset role;
select test_helpers.claims_for((select oa_b from k), false, 'org_admin');
set local role authenticated;
select lives_ok(
  $$ select public.redact_professional_profile('00000000-0000-0000-0000-0000000e2122', 'pedido do titular') $$,
  'redaction: org authority redacts an eligible profile');
reset role;
-- Preservation: the row + linkage + audit survive; identity is nulled.
select is((select count(*)::int from public.professional_profiles where id = '00000000-0000-0000-0000-0000000e2122'), 1,
  'redaction (minimise): the professional_profiles row is PRESERVED (never deleted)');
select is((select full_name from public.professional_profiles where id = '00000000-0000-0000-0000-0000000e2122'),
          'Profissional (dados removidos)',
  'redaction: the identity is nulled (full_name redacted)');
select ok((select user_id is null and link_state = 'no_account'
           from public.professional_profiles where id = '00000000-0000-0000-0000-0000000e2122'),
  'redaction: user_id nulled + link_state = no_account (coherent with the CHECK)');
select is((select count(*)::int from public.case_participants where id = '00000000-0000-0000-0000-0000000e2130'), 1,
  'redaction (minimise): the case_participants linkage is PRESERVED');
select is((select count(*)::int from public.audit_log
           where action = 'professional_profile.redacted'
             and entity_id = '00000000-0000-0000-0000-0000000e2122'), 1,
  'redaction: exactly one professional_profile.redacted audit row');
select ok(not exists (
  select 1 from public.audit_log
  where action = 'professional_profile.redacted'
    and (metadata::text ilike '%Dr Testemunha%' or metadata::text ilike '%CRM-222%')),
  'redaction audit (Rule 11): NO old-identity payload in the redacted row');

-- ===========================================================================
-- Block E — flag-OFF.
-- ===========================================================================
-- ⚠ CALLER MOVED FOR THE SAME REASON AS BLOCK C: the flag guard runs FIRST in this door, so
-- HC000 would still be reached under sa_x today — but that is an ORDERING accident, not a
-- property this suite owns. Asking as org authority makes the assertion depend on the flag
-- alone, which is what it claims to measure.
-- ⚠ CALLER MOVED AGAIN AT ADR 0201 D5 (2026-09-10), and this cell is the one place in the file
-- where the change is NOT driven by a red. Measured: this cell stayed GREEN under `admin`,
-- because `app.assert_ethics_enabled()` raises HC000 BEFORE the authority check ever runs. What
-- went stale is the RATIONALE above — `admin` is no longer "org authority" — and a cell whose
-- stated reason is false is the thing the rest of this file's history is about. Moving the
-- actor to `oa_b` restores the sentence rather than deleting it.
-- ⛔ AND THERE IS DELIBERATELY NO AUTHORITY TWIN HERE, unlike Blocks C and D. A hatted
-- platform_admin at this door gets HC000, not 42501 — the flag guard precedes authority — so
-- such a twin would assert ORDERING while wearing an authority label. The omission is named
-- rather than silently skipped.
update app.feature_flags set enabled = false where key = 'ethics';
select test_helpers.claims_for((select oa_b from k), false, 'org_admin');
set local role authenticated;
select throws_ok(
  $$ select public.redact_professional_profile('00000000-0000-0000-0000-0000000e2122', 'x') $$,
  'HC000', null,
  'flag-OFF: redact_professional_profile raises HC000 when the ethics flag is off');
reset role;

select * from finish();
rollback;
