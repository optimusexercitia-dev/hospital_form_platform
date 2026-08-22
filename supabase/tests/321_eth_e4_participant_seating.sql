-- =============================================================================
-- ETH·E4 — PARTICIPANT SEATING & PROFESSIONAL IDENTITY (ADR 0108; closes FUP-ETH-1).
--
-- What this suite pins: the two new mint doors (`ensure_professional_participant`,
-- `create_external_participant`), the two deltas to the SHIPPED `set_primary_subject`
-- (MOVE semantics + the respondent-linkage re-run), the ADR 0108 D5 read-gate
-- widening, and the `participants`-writer census that closes FUP-FF5-2.
--
-- ⭐ TWO RED-FIRST PROOFS WERE RUN BEFORE THE MIGRATIONS EXISTED, and both were
-- OBSERVED RED against the shipped body — recorded here because a keystone that was
-- green on its first run is vacuous by default (`authz-handoff` §7.1):
--   K6a  promote a second participant while one is already primary
--        -> shipped body raised HC0E7 "não é possível definir mais de um sujeito
--           principal ativo". RED. The door was set-only; there was no way to
--           correct a mis-designated respondent short of removing them.
--   K6b  promote a participant whose professional linkage is `unknown`
--        -> shipped body SUCCEEDED (is_primary_subject flipped to t, no HC0F0).
--           RED. ⚠ But see the K6b block: the catalog says the state it was
--           observed against is NOT product-reachable, so delta 2 is a BACKSTOP,
--           not a live-hole fix. ADR 0108 D2's stated rationale is wrong on the
--           substrate; the keystone is written to the catalog, not the ADR.
--
-- ⭐ K3 IS THE WIDENING, AND THE PLAN'S LITERAL WORDING FOR IT COULD NOT FAIL.
-- Plan §5.1 keystone 3 reads "a member who is neither an org manager nor a case
-- reader still gets 0 rows". Reverting the new arm leaves that assertion GREEN — it
-- is a no-regression test, and a no-regression test passes a widening BY
-- CONSTRUCTION. The falsifiable pair is written below instead: K3a asserts the arm
-- ADMITS (goes RED the moment the disjunct is reverted — verified by reverting it)
-- and K3b asserts it does not over-admit. Both are asserted as ROW COUNTS THROUGH
-- RLS under `set local role authenticated`, never by calling the predicate with an
-- explicit p_uid: `can_manage_professional`'s `is_org_admin_of` disjunct reads the
-- CALLER's auth.uid(), not its p_uid argument (ADR 0108 D5, second adjacent
-- exposure), so a direct predicate call would exercise the asymmetric path and
-- answer a different question than the policy does.
--
-- Personas (test_helpers.bootstrap): admin, sa_x (staff_admin comm_x), st_x / st_x2
-- (plain members comm_x), sa_y (staff_admin comm_y), st_y (plain member comm_y),
-- oa_b (org_admin). comm_x and comm_y share ONE org — which is what makes sa_y the
-- exact probe D5 needs: an org manager who is NOT a reader of comm_x's case.
-- =============================================================================

begin;
select plan(75);

update app.feature_flags set enabled = true
  where key in ('cases_multi_phase', 'case_participants', 'audit_trail');
update app.feature_flags set enabled = false
  where key in ('case_types', 'case_access');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'st_y')::uuid   as st_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

-- ---------------------------------------------------------------------------
-- FLAG ASSERTIONS. The updates above are an ASSUMPTION until asserted, and a
-- fixture missing a flag-enable SKIPS keystones silently. `audit_trail`
-- especially: app.audit_write RETURNS EARLY when it is off, so the audit
-- assertions below would measure the flag rather than the door.
-- ---------------------------------------------------------------------------
select is(app.feature_enabled('case_participants'), true,
  'FLAG: case_participants is ON — every door in this suite asserts it first');
select is(app.feature_enabled('audit_trail'), true,
  'FLAG: audit_trail is ON — else audit_write returns early and the audit keystones are vacuous');

-- ---------------------------------------------------------------------------
-- FIXTURE. One case in comm_x, the seeded ethics role vocabulary, and the
-- personas' memberships. NOTHING here pre-mints a registry row for a
-- professional — the whole point is that the DOORS do it.
-- ---------------------------------------------------------------------------
insert into public.cases (id, commission_id, case_number, created_by)
values ('00000000-0000-0000-0000-0000000e4001', (select comm_x from k), 99400,
        (select sa_x from k));

insert into public.case_participant_roles
  (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
values
  ('00000000-0000-0000-0000-0000000e4010', (select org_x from k), 'respondent_doctor',
   'Médico denunciado', array['professional'], true),
  ('00000000-0000-0000-0000-0000000e4011', (select org_x from k), 'complainant',
   'Denunciante', array['external_person', 'professional'], false),
  ('00000000-0000-0000-0000-0000000e4012', (select org_x from k), 'legal_representative',
   'Representante legal', array['external_person'], false);

-- Two professional profiles in org_x. `p_user_id` given ⇒ link_state 'linked'.
insert into public.professional_profiles (id, organization_id, user_id, full_name,
                                          professional_type, license_number, specialty)
values
  ('00000000-0000-0000-0000-0000000e4201', (select org_x from k), (select st_x from k),
   'Dr. Alfa', 'medico', 'CRM-11111', 'Cardiologia'),
  ('00000000-0000-0000-0000-0000000e4202', (select org_x from k), (select st_x2 from k),
   'Dr. Beta', 'medico', 'CRM-22222', 'Pediatria');

-- ⭐ PRE-FLIGHT. If these do not hold, several keystones below assert nothing.
select is((select count(*)::int from public.professional_participants
           where professional_profile_id in ('00000000-0000-0000-0000-0000000e4201',
                                             '00000000-0000-0000-0000-0000000e4202')), 0,
  'PRE: neither profile has a registry identity yet — the mint door has real work to do');
select is(app.can_manage_professional((select org_x from k), (select sa_x from k)), true,
  'PRE: sa_x may manage professionals in org_x (the mint gate has something to admit)');
select is(app.can_manage_professional((select org_x from k), (select st_x from k)), false,
  'PRE ⭐: st_x may NOT — the HC0E4 twins below deny for the RIGHT reason');

-- ===========================================================================
-- KEYSTONE 1 — the full professional seating path succeeds for a coordinator.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table mint_a on commit drop as
  select public.ensure_professional_participant('00000000-0000-0000-0000-0000000e4201') as pid;
reset role;
grant select on mint_a to authenticated;

select isnt((select pid from mint_a), null,
  'K1: ensure_professional_participant returns a registry id for a coordinator');
select is((select participant_type from public.participants where id = (select pid from mint_a)),
  'professional',
  'K1: the minted registry row is a `professional`');
select is((select sensitivity_class from public.participants where id = (select pid from mint_a)),
  'professional_identity',
  'K1: …and carries professional_identity (the derives-type CHECK''s only legal pairing)');
select is((select display_name from public.participants where id = (select pid from mint_a)),
  'Dr. Alfa',
  'K1: display_name is the real name snapshotted from the profile (ADR 0108 D3)');
select is((select count(*)::int from public.professional_participants
           where participant_id = (select pid from mint_a)
             and professional_profile_id = '00000000-0000-0000-0000-0000000e4201'), 1,
  'K1: the link row ties the registry identity to the profile');
select is((select count(*)::int from public.audit_log
           where action = 'professional_profile.participant_minted'
             and entity_id = '00000000-0000-0000-0000-0000000e4201'), 1,
  'K1: the mint is audited on the ORG chain (the door is org-scoped, not case-scoped)');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table seat_a on commit drop as
  select public.add_case_participant('00000000-0000-0000-0000-0000000e4001',
           (select pid from mint_a), '00000000-0000-0000-0000-0000000e4010', true, 'Denunciado') as cpid;
reset role;
grant select on seat_a to authenticated;

select is((select is_primary_subject from public.case_participants where id = (select cpid from seat_a)),
  true,
  'K1 ⭐: the minted professional SEATS as respondent_doctor and primary subject — the '
  'end-to-end path FUP-ETH-1 says had no writer');

-- ===========================================================================
-- KEYSTONE 2 — a plain staff member is denied at all three doors (HC0E4).
--
-- Written NARROWLY: st_x is a MEMBER of comm_x (bootstrap), so each denial below
-- is the AUTHORITY gate refusing, not RLS refusing to find the row.
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.ensure_professional_participant('00000000-0000-0000-0000-0000000e4202') $$,
  'HC0E4', null,
  'K2: a plain member cannot mint a professional registry identity');
select throws_ok(
  format($$ select public.create_external_participant(%L, 'external_person', 'Sr. Intruso') $$,
         (select org_x from k)),
  'HC0E4', null,
  'K2: a plain member cannot mint an external participant');
select throws_ok(
  format($$ select public.set_primary_subject(%L) $$, (select cpid from seat_a)),
  'HC0E4', null,
  'K2: a plain member cannot designate the primary subject');
reset role;

select is((select count(*)::int from public.professional_participants
           where professional_profile_id = '00000000-0000-0000-0000-0000000e4202'), 0,
  'K2: …and the refused mint wrote NOTHING (the denial is not merely cosmetic)');

-- ===========================================================================
-- KEYSTONE 3 — the ADR 0108 D5 read-gate widening. See the header: K3a is the
-- arm (RED on revert), K3b is the containment.
--
-- sa_y is staff_admin of comm_y, which shares org_x with comm_x. She is therefore
-- an ORG MANAGER (can_manage_professional true) but NOT a reader of comm_x's case,
-- so before the widening `can_read_professional_profile` resolved FALSE for her.
-- ===========================================================================
select is(app.can_manage_professional((select org_x from k), (select sa_y from k)), true,
  'K3 PRE: sa_y IS an org manager (staff_admin of a sibling commission in the same org)');
select is(app.can_read_case_committee('00000000-0000-0000-0000-0000000e4001', (select sa_y from k)),
  false,
  'K3 PRE ⭐: …and is NOT a reader of the case — so ONLY the new arm can admit her');

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.professional_profiles
           where id = '00000000-0000-0000-0000-0000000e4201'), 1,
  'K3a ⭐ THE WIDENING: an org manager who is NOT a case reader READS the profile. '
  'Reverting the D5 disjunct turns this RED — verified by reverting it.');
select is((select license_number from public.professional_profiles
           where id = '00000000-0000-0000-0000-0000000e4201'), 'CRM-11111',
  'K3a: …including the CRM — the disambiguation the picker exists for');
reset role;

-- st_y: a plain member of comm_y. Same org, so `participants_select` already shows
-- him the registry NAME — but he is not a manager and not a case reader, so the
-- Class-2 identity columns must stay shut.
select is(app.can_manage_professional((select org_x from k), (select st_y from k)), false,
  'K3b PRE: st_y is a plain member — NOT an org manager');
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.professional_profiles
           where id = '00000000-0000-0000-0000-0000000e4201'), 0,
  'K3b ⭐ CONTAINMENT: a plain org member still gets 0 rows — the arm admits managers, '
  'not the org');
select is((select count(*)::int from public.professional_participants
           where professional_profile_id = '00000000-0000-0000-0000-0000000e4201'), 0,
  'K3b: …and the same predicate keeps professional_participants shut for him too');
select is((select count(*)::int from public.participants where id = (select pid from mint_a)), 1,
  'K3b: …while the org-readable REGISTRY row is visible — the exposure D5 argues is '
  'pre-existing, pinned so a future tightening of participants_select is a visible change');
reset role;

-- ⚠⚠ K3c — THE EXPOSURE D5's ARGUMENT DOES NOT NAME, AND ITS ONLY CONTAINMENT.
--
-- ADR 0108 D5 enumerates what the arm adds as "`license_number` / `specialty` /
-- `professional_type`". `professional_profiles` also carries **`cpf`** — a Brazilian
-- national ID, LGPD sensitive personal data — and `authenticated` holds a
-- TABLE-WIDE SELECT grant on the table (verified column-by-column against
-- information_schema.column_privileges: all 17 columns, `cpf` included; there is no
-- column-list grant here, unlike `profiles` and `case_referral`). So every org
-- manager admitted by the new arm can read CPF, both through RLS and through
-- `get_case_professional`, which returns `to_jsonb(v_profile)` — the WHOLE row.
-- Measured live: a staff_admin of a sibling commission, with no access to the case,
-- read `full_name` AND `cpf` of an Ethics respondent.
--
-- THE ONLY THING MAKING THAT LATENT RATHER THAN LIVE is that NO DOOR WRITES the
-- column: `create_professional_profile` and `update_professional_profile` have no
-- CPF parameter, `redact_professional_profile` only nulls fields, and the seed
-- carries zero non-null values. This keystone pins exactly that. If someone adds a
-- CPF writer, this reds and the exposure question gets asked BEFORE real national
-- IDs are behind an org-wide read arm — rather than after.
--
-- Reported to the lead as an ADR-0108-D5 gap; the proposed fix (a column-list
-- SELECT grant excluding `cpf`, mirroring `profiles`) is a security change outside
-- this track's approved plan and is deliberately NOT made here.
-- ⚠⚠ K3d — P0-1. THE DISCLOSURE ADR 0108 D5's ARGUMENT DID NOT ENUMERATE.
--
-- D5 promised the arm "discloses no case linkage (`professional_participants` carries
-- no `case_id`)". True, and irrelevant: the disclosure travels through columns on
-- `professional_profiles` itself. `app.trg_pin_respondent_retention` is the ONLY writer
-- of `retention_pinned_at` / `retention_pin_reason`, fires solely on
-- `case_decisions → 'issued'`, solely for a seated `respondent_doctor`, and writes the
-- literal `'ethics_decision_issued'`. So `retention_pin_reason` IS a case linkage:
-- named doctor + role + stage. It sat inside a TABLE-WIDE `authenticated` SELECT grant.
--
-- sa_y is QA's positive-control persona: staff_admin of a SIBLING commission, an org
-- manager (so the D5 arm admits her to the row) with NO ethics membership and NO case
-- access. The values are planted directly rather than driven through `issue_decision`
-- on purpose: the privilege check is on the COLUMN and is independent of which writer
-- put the value there, and planting keeps this keystone from depending on the whole
-- decision pipeline. The trigger being the real writer is asserted separately, below.
update public.professional_profiles
   set cpf = '11144477735',
       retention_pinned_at = now(),
       retention_pin_reason = 'ethics_decision_issued'
 where id = '00000000-0000-0000-0000-0000000e4201';

-- PRE: the values are really there. Without this the denials below could be passing on
-- NULL columns and asserting nothing.
select is((select retention_pin_reason from public.professional_profiles
           where id = '00000000-0000-0000-0000-0000000e4201'), 'ethics_decision_issued',
  'K3d PRE: the case-linked retention reason is actually set on the row');

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  $$ select retention_pin_reason from public.professional_profiles
      where id = '00000000-0000-0000-0000-0000000e4201' $$,
  '42501', null,
  'K3d ⭐ P0-1: an org manager outside the case CANNOT read retention_pin_reason — '
  'the ethics-proceeding linkage D5 claimed not to disclose');
select throws_ok(
  $$ select retention_pinned_at from public.professional_profiles
      where id = '00000000-0000-0000-0000-0000000e4201' $$,
  '42501', null,
  'K3d P0-1: …nor retention_pinned_at');
select throws_ok(
  $$ select cpf from public.professional_profiles
      where id = '00000000-0000-0000-0000-0000000e4201' $$,
  '42501', null,
  'K3d P0-1: …nor cpf (the national ID — FUP-ETH-CPF-1, closed)');
select throws_ok(
  $$ select user_id from public.professional_profiles
      where id = '00000000-0000-0000-0000-0000000e4201' $$,
  '42501', null,
  'K3d P0-1: …nor user_id (the auth-account correlation)');
select throws_ok(
  $$ select redacted_by from public.professional_profiles
      where id = '00000000-0000-0000-0000-0000000e4201' $$,
  '42501', null,
  'K3d P0-1: …nor redacted_by (who performed an LGPD erasure)');

-- ⭐ THE OVER-REVOCATION TWIN. A grant fix that quietly broke the picker would still
-- pass every denial above — this is the arm that makes the fix falsifiable in the
-- other direction, and it is why D5's actual purpose survives.
select is((select license_number from public.professional_profiles
           where id = '00000000-0000-0000-0000-0000000e4201'), 'CRM-11111',
  'K3d ⭐ OVER-REVOCATION TWIN: the D5 disambiguation columns are STILL readable — '
  'the fix removed the leak, not the feature');
select is((select count(*)::int from public.professional_profiles
           where id = '00000000-0000-0000-0000-0000000e4201'
             and redacted_at is null), 1,
  'K3d: …and `redacted_at` is still FILTERABLE — searchParticipants filters on it, and '
  'PostgREST filtering needs SELECT on the filtered column (revoking it 42501s the picker)');
reset role;

-- The DEFINER half. `get_case_professional` is prosecdef, so the column grant above
-- does NOT constrain it; it returned `to_jsonb(<whole row>)`. A grant-only fix would
-- read as correct and still leak through this door (the FUP-PDF-3 shape).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table gcp on commit drop as
  select public.get_case_professional((select pid from mint_a)) as j;
reset role;
grant select on gcp to authenticated;

select is((select j->>'full_name' from gcp), 'Dr. Alfa',
  'K3d PRE: get_case_professional still returns the identity it is for');
select ok((select j from gcp) ? 'cpf' is false,
  'K3d ⭐ P0-1 DEFINER HALF: the audited door no longer emits `cpf`');
select ok((select j from gcp) ? 'retention_pin_reason' is false,
  'K3d ⭐ P0-1 DEFINER HALF: …nor `retention_pin_reason`');
select ok((select j from gcp) ? 'retention_pinned_at' is false,
  'K3d P0-1 DEFINER HALF: …nor `retention_pinned_at`');
select ok((select j from gcp) ? 'user_id' is false,
  'K3d P0-1 DEFINER HALF: …nor `user_id`');
select ok((select j from gcp) ? 'redacted_by' is false,
  'K3d P0-1 DEFINER HALF: …nor `redacted_by`');

-- The two surfaces must stay in step. A future column granted but not projected (or
-- projected but not granted) is a divergence, and this is what catches it.
select set_eq(
  $$ select jsonb_object_keys(j) from gcp $$,
  $$ select column_name::text from information_schema.column_privileges
      where table_schema='public' and table_name='professional_profiles'
        and grantee='authenticated' and privilege_type='SELECT' $$,
  'K3d ⭐: the DEFINER door''s projection is EXACTLY the granted column set — add a '
  'column to one and this reds until you add it to the other');

-- The trigger claim the P0 rests on, pinned from the catalog rather than from prose.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','app')
      and p.prosrc ~* 'retention_pin_reason\s*=\s*''ethics_decision_issued'''), 1,
  'K3d: exactly ONE writer stamps `ethics_decision_issued` — the claim that the column '
  'IS a case linkage depends on that, so it is asserted, not assumed');

select is(
  (select count(*)::int from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app')
      and p.prosrc ~* 'update\s+public\.professional_profiles'
      and p.prosrc ~* '\mcpf\M\s*='), 1,
  'K3c (amended): exactly ONE function writes professional_profiles.cpf — '
  '`redact_professional_profile`, which NULLs it. It previously wrote none and left the '
  'national ID in place through an LGPD erasure; the count moved 0 → 1 deliberately.');

-- ===========================================================================
-- KEYSTONE 4 — idempotency. The registry identity is 1:1 with the profile and
-- REUSED across cases; that is what makes prior-case history one record.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table mint_a2 on commit drop as
  select public.ensure_professional_participant('00000000-0000-0000-0000-0000000e4201') as pid;
reset role;
grant select on mint_a2 to authenticated;

select is((select pid from mint_a2), (select pid from mint_a),
  'K4 ⭐: a second call returns the SAME registry id (get-or-create, not create)');
select is((select count(*)::int from public.participants
           where organization_id = (select org_x from k) and display_name = 'Dr. Alfa'), 1,
  'K4: …and exactly one participants row exists for the profile');
select is((select count(*)::int from public.professional_participants
           where professional_profile_id = '00000000-0000-0000-0000-0000000e4201'), 1,
  'K4: …and exactly one link row (the unique index holds)');
select throws_ok(
  format($$ insert into public.professional_participants (participant_id, professional_profile_id)
            values (%L, '00000000-0000-0000-0000-0000000e4201') $$, gen_random_uuid()),
  '23505', null,
  'K4: the 1:1 unique index is REAL — a second registry identity for one profile is rejected');

-- ===========================================================================
-- KEYSTONE 5 — an `unknown`-linkage professional cannot be SEATED as respondent
-- (HC0F0), and can be once the linkage is resolved.
-- ===========================================================================
insert into public.professional_profiles (id, organization_id, full_name)
values ('00000000-0000-0000-0000-0000000e4203', (select org_x from k), 'Dr. Desconhecido');
select is((select link_state from public.professional_profiles
           where id = '00000000-0000-0000-0000-0000000e4203'), 'unknown',
  'K5 PRE: a profile created without a user_id is `unknown` (fail-closed default)');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table mint_c on commit drop as
  select public.ensure_professional_participant('00000000-0000-0000-0000-0000000e4203') as pid;
reset role;
grant select on mint_c to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_case_participant('00000000-0000-0000-0000-0000000e4001', %L,
             '00000000-0000-0000-0000-0000000e4010', false, null) $$, (select pid from mint_c)),
  'HC0F0', null,
  'K5: an `unknown`-linkage professional is REFUSED as respondent_doctor');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.set_professional_link_state(
              '00000000-0000-0000-0000-0000000e4203', 'no_account', null) $$),
  'K5: the coordinator resolves the linkage (`no_account` — the audited human assertion)');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table seat_c on commit drop as
  select public.add_case_participant('00000000-0000-0000-0000-0000000e4001', (select pid from mint_c),
           '00000000-0000-0000-0000-0000000e4010', false, null) as cpid;
reset role;
grant select on seat_c to authenticated;
select isnt((select cpid from seat_c), null,
  'K5 POSITIVE TWIN ⭐: …and the SAME professional now seats — the dead end has a remedy');

-- ===========================================================================
-- KEYSTONE 6 — set_primary_subject MOVES the designation, and re-asserts the
-- respondent linkage. BOTH were observed RED against the shipped body (header).
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table mint_b on commit drop as
  select public.ensure_professional_participant('00000000-0000-0000-0000-0000000e4202') as pid;
reset role;
grant select on mint_b to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table seat_b on commit drop as
  select public.add_case_participant('00000000-0000-0000-0000-0000000e4001', (select pid from mint_b),
           '00000000-0000-0000-0000-0000000e4010', false, null) as cpid;
reset role;
grant select on seat_b to authenticated;

select is((select is_primary_subject from public.case_participants where id = (select cpid from seat_a)),
  true, 'K6 PRE: Dr. Alfa is the incumbent primary subject — there IS something to move');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.set_primary_subject(%L) $$, (select cpid from seat_b)),
  'K6a ⭐ RED-FIRST: promoting a second participant SUCCEEDS. The shipped body raised '
  'HC0E7 here — observed red before the migration was written.');
reset role;

select is((select is_primary_subject from public.case_participants where id = (select cpid from seat_b)),
  true, 'K6a: the target is now the primary subject');
select is((select is_primary_subject from public.case_participants where id = (select cpid from seat_a)),
  false, 'K6a ⭐: …and the incumbent was DEMOTED — a move, not a second primary');
select is((select count(*)::int from public.case_participants
           where case_id = '00000000-0000-0000-0000-0000000e4001'
             and is_primary_subject and removed_at is null), 1,
  'K6a: the ≤1-live-primary invariant still holds after the move');

-- ---------------------------------------------------------------------------
-- Delta 2 — the linkage re-run. ⚠ READ THIS BEFORE TRUSTING THE KEYSTONE BELOW.
--
-- ADR 0108 D2 justifies this delta with "a profile can be flipped back to
-- `unknown` by `set_professional_link_state` after seating". THE CATALOG SAYS
-- OTHERWISE, and the catalog wins. `trg_guard_professional_linkage` (BEFORE
-- INSERT OR UPDATE on professional_profiles, SECURITY DEFINER) raises HC0F2 for
-- ANY linkage change — including direct DML — while the professional holds a LIVE
-- `respondent_doctor` link. Enumerated from the catalog, every path to "live
-- respondent_doctor with link_state = 'unknown'" is closed:
--   • add_case_participant        → asserts the linkage (HC0F0)
--   • set_case_participant_role   → asserts the linkage (HC0F0)   [A27]
--   • set_professional_link_state → frozen by the trigger (HC0F2)
--   • update_professional_profile → has no user_id/link_state write path at all
--   • redact_professional_profile → the ONE trigger escape, and it sets
--                                   'no_account' (RESOLVED), never 'unknown'
--   • direct DML                  → `authenticated` holds SELECT-only on
--                                   case_participants and professional_profiles
--
-- So delta 2 is a BACKSTOP over a state the product cannot currently reach — NOT
-- a fix for a live hole, and this suite does not claim it is one. It is still
-- worth having: the freeze trigger already carries one documented escape hatch
-- (`app.in_redaction_rpc`), and a second one added later would silently re-open
-- the promotion path if set_primary_subject were the only door not asserting.
--
-- The red-first observation stands as an observation — the shipped body DID
-- promote an unknown-linkage respondent without complaint — but the state it was
-- observed against was built by privileged DML, as it is here. The keystone below
-- therefore proves the assert is WIRED INTO THIS DOOR, which is the falsifiable
-- claim: remove the `perform app.assert_respondent_linkage_resolved(...)` line
-- from the migration and it goes RED.
--
-- The fixture uses the trigger's own sanctioned escape rather than inventing a
-- new one, so the bypass is visible and named.
-- ---------------------------------------------------------------------------
set local app.in_redaction_rpc = 'on';
update public.professional_profiles set link_state = 'unknown', user_id = null
  where id = '00000000-0000-0000-0000-0000000e4203';
set local app.in_redaction_rpc = 'off';

select is((select link_state from public.professional_profiles
           where id = '00000000-0000-0000-0000-0000000e4203'), 'unknown',
  'K6b PRE: the fixture really did reach `unknown` on a live respondent (via the '
  'trigger''s named escape) — else the keystone below asserts nothing');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_primary_subject(%L) $$, (select cpid from seat_c)),
  'HC0F0', null,
  'K6b ⭐: promoting an `unknown`-linkage respondent is REFUSED — the delta-2 assert '
  'is wired into this door (remove that one line and this goes RED)');
reset role;

-- And the freeze itself, pinned: this is the invariant that makes delta 2 a
-- backstop rather than a live fix, so if a future migration relaxes it, THIS reds
-- and the backstop's status is re-examined deliberately instead of by accident.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_professional_link_state(
              '00000000-0000-0000-0000-0000000e4203', 'linked', %L) $$, (select st_y from k)),
  'HC0F2', null,
  'K6b ⭐ THE PREMISE, PINNED: a live respondent''s linkage is FROZEN — which is why '
  'ADR 0108 D2''s "can be flipped back to unknown after seating" is false');
reset role;

select is((select is_primary_subject from public.case_participants where id = (select cpid from seat_b)),
  true,
  'K6b ⭐: …and the REFUSED promotion left the incumbent intact — the demote did not '
  'run ahead of the assert (an exception mid-function must not half-apply the move)');

-- ===========================================================================
-- KEYSTONE 7 — the external lane (ADR 0108 D8).
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table ext_1 on commit drop as
  select public.create_external_participant((select org_x from k), 'external_person',
           '  Maria Denunciante  ') as pid;
reset role;
grant select on ext_1 to authenticated;

select is((select sensitivity_class from public.participants where id = (select pid from ext_1)),
  'non_sensitive',
  'K7: an external participant is minted `non_sensitive`');
select is((select display_name from public.participants where id = (select pid from ext_1)),
  'Maria Denunciante',
  'K7: …with a trimmed display name');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.add_case_participant('00000000-0000-0000-0000-0000000e4001', %L,
             '00000000-0000-0000-0000-0000000e4011', false, null) $$, (select pid from ext_1)),
  'K7 ⭐: an external DENUNCIANTE seats — one of the four seeded roles that had no '
  'fillable lane before this track');
select throws_ok(
  format($$ select public.add_case_participant('00000000-0000-0000-0000-0000000e4001', %L,
             '00000000-0000-0000-0000-0000000e4010', false, null) $$, (select pid from ext_1)),
  'HC0E3', null,
  'K7: a PROFESSIONAL-only role over an external participant raises HC0E3');
select throws_ok(
  format($$ select public.create_external_participant(%L, 'professional', 'Dr. Contrabando') $$,
         (select org_x from k)),
  '23514', null,
  'K7 ⭐: the external door REFUSES a sensitive type — it cannot be used to mint a '
  'professional identity around the professional lane''s gate');
select throws_ok(
  format($$ select public.create_external_participant(%L, 'external_person', '   ') $$,
         (select org_x from k)),
  '23514', null,
  'K7: a blank display name is refused');
reset role;

-- Create-always, not get-or-create: two identically-named externals are two rows.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.create_external_participant((select org_x from k), 'external_person',
         'Maria Denunciante');
reset role;
select is((select count(*)::int from public.participants
           where organization_id = (select org_x from k) and display_name = 'Maria Denunciante'), 2,
  'K7 ⭐: the external lane is CREATE-ALWAYS — two same-named people stay two rows. '
  'Deduplicating by display name would silently MERGE distinct people (ADR 0108 D8).');

-- ===========================================================================
-- KEYSTONE 8 — the `participants` WRITER CENSUS. Closes FUP-FF5-2.
--
-- Asserted by COUNT **and** NAME, and the expected set is derived from what the
-- catalog answers, not from any ADR's prose: ADR 0091 claimed "exactly two" while
-- the catalog answered one. Before this track it was genuinely ONE
-- (`set_participant_patient`); this track adds exactly two more.
--
-- The pattern is deliberately narrow. A broader `insert into …participants` also
-- matches `insert into public.case_participants`, which is a DIFFERENT table —
-- that over-wide bucket is how a census hides an enforcement door.
--
-- ⭐ AMENDED 2026-08-22 (ADR 0134 Amdt 2 option D) — A SWAP, NOT A GROWTH, AND THE SET IS
-- STILL THREE. The patient lane's member was renamed:
--     public.set_participant_patient  ->  app._set_participant_patient_unchecked
-- `set_participant_patient` was SPLIT at its authority cut: the gate stayed in the
-- `public` door and the entire body below it — including the `insert into participants` —
-- moved to the `app` helper. So the door still exists and still gates; it simply no longer
-- performs the insert this census keys on, and it left the set on the same commit the
-- helper joined it. The count did not change.
-- ⛔ This note is not decoration. K8 is a NAME-KEYED verdict, and a rename is exactly what
-- orphans one — updating the array quietly is the failure K8 exists to catch, performed by
-- the person updating K8. If you are here because K8 went red, establish whether a writer
-- was ADDED or RENAMED before you touch the array.
-- ===========================================================================
select is(
  (select array_agg(n.nspname || '.' || p.proname order by n.nspname, p.proname)
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app')
      and p.prosrc ~* 'insert\s+into\s+(public\.)?participants\M'),
  array['app._set_participant_patient_unchecked',
        'public.create_external_participant',
        'public.ensure_professional_participant'],
  'K8 ⭐ FUP-FF5-2: the `participants` writer set is EXACTLY these three, by name — '
  'the patient lane, the professional lane, and the external lane');
select is(
  (select count(*)::int from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app')
      and p.prosrc ~* 'insert\s+into\s+(public\.)?participants\M'), 3,
  'K8: …and exactly three by count — a new writer added without a keystone reds this');
select is(
  (select count(*)::int from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app')
      and p.prosrc ~* 'insert\s+into\s+(public\.)?professional_participants\M'), 1,
  'K8: exactly ONE function writes professional_participants (the mint door) — the '
  'table had ZERO writers before this track');

-- The census counts DOORS, not reachability. Pin that all three are actually
-- callable by a client, or the count above could be satisfied by dead code.
select is(has_function_privilege('authenticated',
  'public.ensure_professional_participant(uuid)', 'EXECUTE'), true,
  'K8 t19: authenticated can EXECUTE ensure_professional_participant');
select is(has_function_privilege('anon',
  'public.ensure_professional_participant(uuid)', 'EXECUTE'), false,
  'K8 t19 ⭐: anon CANNOT — the revoke-then-grant idiom held (a NULL proacl would '
  'have meant EXECUTE to PUBLIC, which is not "no grants")');
select is(has_function_privilege('authenticated',
  'public.create_external_participant(uuid,text,text)', 'EXECUTE'), true,
  'K8 t19: authenticated can EXECUTE create_external_participant');
select is(has_function_privilege('anon',
  'public.create_external_participant(uuid,text,text)', 'EXECUTE'), false,
  'K8 t19: anon cannot EXECUTE create_external_participant');

-- The two doors must live in a PostgREST-REACHABLE schema. pgTAP calls
-- in-database and would stay green over an `app.*` misplacement forever; this is
-- the cheapest in-database proxy for that, and E2E is the real proof.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.proname in ('ensure_professional_participant', 'create_external_participant')
      and n.nspname = 'public'), 2,
  'K8 ⭐: both mint doors are in `public` — config.toml exposes only public to '
  'PostgREST, so an `app.*` RPC would be a 404 no client could reach');

-- The two `create or replace`d doors kept their shipped properties. The full
-- property diff is done from the catalog outside pgTAP; these pin the two that
-- fail OPEN if a future migration turns either into a DROP+CREATE.
select is((select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where p.proname = 'set_primary_subject' and n.nspname = 'public'), true,
  'K8: set_primary_subject is still SECURITY DEFINER after the ETH·E4 replace');
select is(has_function_privilege('anon', 'public.set_primary_subject(uuid)', 'EXECUTE'), false,
  'K8 ⭐: …and still carries its ACL — a DROP+CREATE would have restored the Postgres '
  'default of EXECUTE to PUBLIC and this would read true');

select * from finish();
rollback;
