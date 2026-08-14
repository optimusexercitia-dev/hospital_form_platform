-- =============================================================================
-- 341 — DM5 S2 (Wave D): NSP RCA/CAPA evidence on the core document model.
-- ADR 0120 D1/D2/D14/D16; plan docs/plans/dm5-wave-d-retirement-plan.md.
-- Covers migrations 20260927000100 (types + both tenant_shape shapes + D16)
-- and 20260927000110 (the can_read_document arms).
--
-- ⭐ MEASURED-FIRST RECORD. Every behavioural assertion below was proven to
-- DISCRIMINATE in a rolled-back transaction BEFORE it was written as a test —
-- the M1 discipline. Where a proof run is quoted, it is a run I actually
-- executed, not a prediction.
--
-- ⚠ CENSUS BLIND CLASS. `app.can_read_document` is a `prosecdef` boolean that
-- ARM=census/hat/floor/wrapper already cover BY NAME, so all four pass no
-- matter what its arms say. Nothing in the §6 gate can see a wrong arm here.
-- THIS FILE IS THE ONLY COVERAGE THAT EXISTS for the rca / capa_action arms.
--
-- ⚠ `lint:vacuous` does not scan SQL (FUP-PGTAP-VACUOUS). Every denial below is
-- preceded by a [CONTROL] asserting its fixture EXISTS, so a denial can never
-- pass by asserting over an empty set — the `197` §4.1 shape
-- (`-> 0 ->> field IS NULL` true on an empty array) found in a PHI suite.
--
-- ⭐ PRE-EXISTING COVERAGE GAP THIS SUITE CLOSES (found while building the
-- fixture, not from the plan): the seed has ZERO events with
-- `current_owner_commission_id` set — all five are NULL — so the CUSTODY arm of
-- `app.can_read_event` has never been exercised by any test in this repo. C0
-- pins that fact so the gap is visible, and C5 is the first assertion anywhere
-- to traverse that arm.
--
-- ⚠ Custody CANNOT be moved by a raw UPDATE: `guard_event_status()` refuses
-- edits once an event is at/past 'triado'. A keystone written before the
-- fixture was proven would have failed AT SETUP and read as a defect in the
-- arm rather than in the fixture. C5 therefore moves custody through the real
-- `public.transfer_event_custody` RPC — which is also the more honest test,
-- since it proves the arm under the transition the product actually performs.
-- =============================================================================
begin;
-- 53 = P:3 + A:5 + B:4 + C:9 + D:8 + E:2 + F:10 + G:12. Count derived by block, not by
-- eye — the first authoring pass said 29 because C5a/C5b were counted as one. G's 12
-- were derived twice and cross-checked: assertion CALL SITES
-- (`^select (is|isnt|ok|throws_ok|lives_ok)\(` = 53) against description TAGS
-- (`'DM5·S2 <Letter><n>` = 53). Two counts of different things agreeing is the check;
-- one count repeated is not.
select plan(53);

-- ---------------------------------------------------------------------------
-- P — preconditions (pgtap-fixture-flag-gaps: assert flags, never assume)
-- ---------------------------------------------------------------------------
select is((select enabled from app.feature_flags where key = 'patient_safety'), true,
  'DM5·S2 P1 precondition: patient_safety flag is ON');
select is((select enabled from app.feature_flags where key = 'documents_foundation'), true,
  'DM5·S2 P2 precondition: documents_foundation flag is ON');
select is((select count(*)::int from app.feature_flags where key = 'documents_wave_d'), 1,
  'DM5·S2 P3 precondition: the documents_wave_d flag row exists');

-- ---------------------------------------------------------------------------
-- A — ADR 0120 D1: the TWO coupled CHECKs, and BOTH tenant_shape shapes.
--
-- The coupling is real and was measured: with ONLY type_check widened, a
-- FULLY TENANTED rca row is still rejected 23514 — fully tenanted on purpose,
-- so the rejection can only come from tenant_shape's type list. A minimally
-- tenanted fixture could not have isolated the cause.
-- ---------------------------------------------------------------------------
select ok((select pg_get_constraintdef(oid) from pg_constraint
            where conname = 'securable_resources_type_check')
          like '%capa_action%',
  'DM5·S2 A1 [CONTROL] type_check enumerates capa_action');
select ok((select pg_get_constraintdef(oid) from pg_constraint
            where conname = 'securable_resources_tenant_shape')
          like '%capa_action%',
  'DM5·S2 A2 ⭐ tenant_shape carries the SECOND shape — widening type_check alone rejects every insert');

-- A3a/A3b/A3c: the three discriminating cases, all measured before being written.
select throws_ok(
  $$ insert into public.securable_resources (id, resource_type, organization_id, hospital_id, commission_id)
     values (gen_random_uuid(), 'capa_action', '0c000000-0000-0000-0000-00000000000a', null, null) $$,
  '23514', null,
  'DM5·S2 A3a shape B still REQUIRES hospital — the capa_action relaxation is one column, not a blanket exemption');
select lives_ok(
  $$ insert into public.securable_resources (id, resource_type, organization_id, hospital_id, commission_id)
     values (gen_random_uuid(), 'capa_action', '0c000000-0000-0000-0000-00000000000a',
             '05000000-0000-0000-0000-00000000000a', null) $$,
  'DM5·S2 A3b ⭐ the D14 relaxation WORKS: capa_action with org+hospital and NULL commission is accepted');
select throws_ok(
  $$ insert into public.securable_resources (id, resource_type, organization_id, hospital_id, commission_id)
     values (gen_random_uuid(), 'rca', '0c000000-0000-0000-0000-00000000000a',
             '05000000-0000-0000-0000-00000000000a', null) $$,
  '23514', null,
  'DM5·S2 A3c ⭐ rca did NOT accidentally inherit shape B — it still requires a commission');

-- ---------------------------------------------------------------------------
-- B — ADR 0120 D2/D14: what the registry pins.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.securable_resources s
     join public.rca r on r.id = s.id where s.resource_type = 'rca'),
  (select count(*)::int from public.rca),
  'DM5·S2 B1 [CONTROL] every seeded RCA has its registry row (the fixture EXISTS before B2 asserts over it)');
select is(
  (select s.commission_id from public.securable_resources s
     join public.rca r on r.id = s.id
     join public.patient_safety_event e on e.id = r.event_id
    where s.resource_type = 'rca' limit 1),
  (select e.reporting_commission_id from public.rca r
     join public.patient_safety_event e on e.id = r.event_id limit 1),
  'DM5·S2 B2 ⭐ D2: the rca registry row pins the REPORTING commission');
select ok(
  (select bool_and(commission_id is null) from public.securable_resources
    where resource_type = 'capa_action'),
  'DM5·S2 B3 ⭐ D14: capa_action registry commission_id is NULL for EVERY row — a half-populated column would read as authoritative');
select is(
  (select s.hospital_id from public.securable_resources s
     join public.capa_action a on a.id = s.id
     join public.capa_plan p on p.id = a.capa_id
    where s.resource_type = 'capa_action' limit 1),
  (select p.hospital_id from public.capa_action a
     join public.capa_plan p on p.id = a.capa_id limit 1),
  'DM5·S2 B4 capa_action tenancy takes capa_plan.hospital_id (NOT NULL for all six sources)');

-- ---------------------------------------------------------------------------
-- C — ADR 0120 D2: CUSTODY IS A READ-TIME INPUT, NEVER A TENANCY KEY.
--
-- Proof run (rolled-back txn, executed before these assertions were authored):
--   custody NULL            -> staff1.farm can_read_event = false
--   transfer_event_custody  -> Farmácia
--   custody = Farmácia      -> staff1.farm can_read_event = TRUE
--   other-hospital reader   -> false          (so it is custody, not "all read")
--   registry commission_id  -> UNCHANGED at the reporting commission
--
-- ⚠ FIXTURE TRAP, checked not assumed. The reader must belong to the OWNER
-- commission and to NOTHING ELSE that could carry the read.
-- `multi@test.local` (…0008) is in BOTH CCIH and Farmácia, and
-- `pqsdual.a@test.local` is a PQS member of the event's hospital — either would
-- turn C5 green while proving nothing. C1/C2/C3 verify staff1.farm against all
-- THREE arms of can_read_event, which is what makes C5 a measurement.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.patient_safety_event
    where current_owner_commission_id is not null),
  0,
  'DM5·S2 C0 ⭐ [CONTROL] the seed has ZERO custody-moved events — so C5 cannot be riding on pre-existing state, and this arm has never been exercised before');
select ok(
  not app.is_pqs_operator_of_for('05000000-0000-0000-0000-00000000000a',
                                 '00000000-0000-0000-0000-000000000006'),
  'DM5·S2 C1 [CONTROL] staff1.farm is NOT a PQS operator of the event hospital (arm 3 cannot carry the read)');
select ok(
  not app.is_member_of_for('a0000000-0000-0000-0000-0000000000a1',
                           '00000000-0000-0000-0000-000000000006'),
  'DM5·S2 C2 [CONTROL] staff1.farm is NOT in the REPORTING commission (arm 2 cannot carry the read)');
select ok(
  app.is_member_of_for('b0000000-0000-0000-0000-0000000000b1',
                       '00000000-0000-0000-0000-000000000006'),
  'DM5·S2 C3 [CONTROL] staff1.farm IS in the future OWNER commission — the fixture EXISTS, so C4''s denial is over a real membership');

select is(
  app.can_read_event('e3000000-0000-0000-0000-0000000000a3',
                     '00000000-0000-0000-0000-000000000006'),
  false,
  'DM5·S2 C4 baseline: custody unset — the owner-commission member cannot read the event');

-- Move custody through the REAL RPC (guard_event_status refuses raw UPDATEs).
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000c1'::uuid, false, 'nsp_coordinator');
set local role authenticated;
select is(
  (public.transfer_event_custody('e3000000-0000-0000-0000-0000000000a3',
     'commission', 'b0000000-0000-0000-0000-0000000000b1',
     'DM5 S2 341 custody keystone')).current_owner_commission_id,
  'b0000000-0000-0000-0000-0000000000b1'::uuid,
  'DM5·S2 C5a custody moves via transfer_event_custody (the transition the product performs)');
reset role;
select set_config('request.jwt.claims', '', true);

select is(
  app.can_read_event('e3000000-0000-0000-0000-0000000000a3',
                     '00000000-0000-0000-0000-000000000006'),
  true,
  'DM5·S2 C5b ⭐ THE CUSTODY ARM: same reader, same event, one variable — the read FOLLOWS custody');
select is(
  app.can_read_event('e3000000-0000-0000-0000-0000000000a3',
                     '00000000-0000-0000-0000-0000000000c6'),
  false,
  'DM5·S2 C6 ⭐ NEGATIVE CONTROL: an other-hospital reader still cannot read — C5b is custody, not "everyone reads now"');
select is(
  (select s.commission_id from public.securable_resources s
     join public.rca r on r.id = s.id
    where r.event_id = 'e3000000-0000-0000-0000-0000000000a3' and s.resource_type = 'rca'),
  'a0000000-0000-0000-0000-0000000000a1'::uuid,
  'DM5·S2 C7 ⭐ TENANCY DID NOT MOVE: custody changed, the registry row still pins the reporting commission');

-- ---------------------------------------------------------------------------
-- D — the kernel arms, pinned in the CATALOG (never migration text).
--
-- D2 is the regression pin: the `meeting` arm reads `v_commission` two lines
-- above, and copying that shape for `rca` is the silent authz regression DM5
-- step 0 predicted — custody moves, a snapshotted commission does not.
-- ---------------------------------------------------------------------------
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'can_read_document')
  ~ 'when ''rca'' then app\.can_read_event',
  'DM5·S2 D1 ⭐ the rca arm resolves through can_read_event (custody-following, at read time)');
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'can_read_document')
  !~ 'when ''rca'' then app\.is_member_of_for\(v_commission',
  'DM5·S2 D2 ⭐ REGRESSION PIN: the rca arm does NOT read the snapshotted registry commission (the `meeting`-arm shape)');
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'can_read_document')
  ~ 'when ''capa_action'' then app\.can_read_capa',
  'DM5·S2 D3 ⭐ the capa_action arm names can_read_capa EXPLICITLY — it would have failed closed on v_commission, but fail-closed-by-accident is not a design');

-- Property pins: a rebuild loses the ACL; a param rename resets privileges.
select ok((select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'can_read_document'),
  'DM5·S2 D4a can_read_document is still SECURITY DEFINER');
select is((select provolatile::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'can_read_document'), 's',
  'DM5·S2 D4b can_read_document is still STABLE');
select is((select array_to_string(proconfig, ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'can_read_document'),
  'search_path=app, public, pg_catalog',
  'DM5·S2 D4c can_read_document kept its search_path pin');
-- ⚠ STRUCTURAL, not substring. PUBLIC is an aclitem with an EMPTY grantee, so
-- `like '%=X/postgres%'` also matches `postgres=X/postgres` — one habit that
-- produced BOTH a false positive and a vacuous guard across three DM5
-- migrations. aclexplode answers the question the string cannot.
select ok(exists(
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
       aclexplode(p.proacl) a
   where n.nspname = 'app' and p.proname = 'can_read_document'
     and a.grantee = 'authenticated'::regrole::oid and a.privilege_type = 'EXECUTE'),
  'DM5·S2 D4d can_read_document kept the authenticated EXECUTE grant (structural)');
select ok(not exists(
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
       aclexplode(p.proacl) a
   where n.nspname = 'app' and p.proname = 'can_read_document' and a.grantee = 0),
  'DM5·S2 D4e ⭐ can_read_document has NO PUBLIC grant (grantee 0 — the direction a presence check cannot see)');

-- ---------------------------------------------------------------------------
-- E — ADR 0120 D16: hospital_of_capa_action reads capa_plan.hospital_id.
-- It previously resolved hospital_of_event(event_of_capa(...)), NULL for 4 of
-- capa_plan.source's 6 values. Zero callers today — which is exactly why it was
-- a loaded gun once D14 made the hospital load-bearing.
-- ---------------------------------------------------------------------------
select isnt(
  app.hospital_of_capa_action((select id from public.capa_action limit 1)),
  null,
  'DM5·S2 E1 ⭐ D16: hospital_of_capa_action resolves non-NULL');
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'hospital_of_capa_action')
  !~ 'event_of_capa',
  'DM5·S2 E2 ⭐ D16: it no longer routes through event_of_capa (NULL for 4 of 6 CAPA sources)');


-- ---------------------------------------------------------------------------
-- F — ADR 0120 D10 (the flag is ARM-SCOPED) + the citation seam's authorization.
--
-- ⭐ F3/F4 ARE THE POINT. A BLANKET assert at the head of add_rca_evidence would
-- satisfy F2's refusal perfectly while silently killing the `link` and
-- `citation` arms, which have nothing to do with Wave D. Only a POSITIVE
-- control can tell those two implementations apart — the DM3 `DM3·T3b` shape.
-- A refusal test alone is compatible with a kill switch.
--
-- ⭐ F6/F7 are a ONE-VARIABLE differential. Both writers can write the RCA
-- (F5 pins that); they differ ONLY in whether they can READ the cited document.
-- A citation is an EXISTENCE DISCLOSURE — label and id project to every reader
-- of the RCA — so "no linking what you cannot read" is the property, and
-- authority over the CONTAINER is not authority over the CONTENT
-- (the FUP-DM4-RECUSAL shape, declined here rather than shipped again).
-- ---------------------------------------------------------------------------
select is((select enabled from app.feature_flags where key = 'documents_wave_d'), true,
  'DM5·S2 F1 [CONTROL] documents_wave_d is ON in the seeded state (so F2''s OFF window is a real change)');

-- ⚠ RESOLVED AS postgres INTO A TEMP TABLE, not inline in the probes.
-- `public.documents` is RLS-gated by `can_read_document`, so an inline subquery
-- is filtered BY THE CALLER: for the writer who cannot read the document it
-- returned NO ROWS, `p_cited_entity_id` arrived NULL, and the SHAPE check fired
-- (23514) before the authorization gate could. F7 would have been asserting the
-- wrong refusal — the fixture disappearing, not the door working. A temp table
-- is not RLS-filtered, so every persona sees the same id.
create temp table f_doc on commit drop as
  select d.id from public.documents d
    join public.securable_resources s on s.id = d.home_resource_id
   where s.commission_id = 'a0000000-0000-0000-0000-0000000000a1'
     and s.resource_type = 'controlled_document' order by d.title limit 1;
-- The probes run as `authenticated`; the temp table is owned by postgres.
grant select on f_doc to authenticated;

update app.feature_flags set enabled = false where key = 'documents_wave_d';
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
set local role authenticated;

select throws_ok(
  $q$ select public.add_rca_evidence('f3000000-0000-0000-0000-0000000000a3','document','flag off',
        null, null, null, null, null) $q$,
  'HC0D7', null,
  'DM5·S2 F2 with wave_d OFF the DOCUMENT arm refuses at its first residue-producing step');
select lives_ok(
  $q$ select public.add_rca_evidence('f3000000-0000-0000-0000-0000000000a3','link','link arm',
        null, 'https://example.org/dm5-f3', null, null, null) $q$,
  'DM5·S2 F3 ⭐ POSITIVE CONTROL: with wave_d OFF the LINK arm still succeeds (the gate is Wave D''s, not a kill switch)');
select lives_ok(
  $q$ select public.add_rca_evidence('f3000000-0000-0000-0000-0000000000a3','citation','citation arm',
        null, null, 'document', (select id from f_doc), 'rotulo F4') $q$,
  'DM5·S2 F4 ⭐ POSITIVE CONTROL: with wave_d OFF the CITATION arm still succeeds');

reset role;
update app.feature_flags set enabled = true where key = 'documents_wave_d';

select ok(
  app.can_write_rca('f3000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000002')
  and app.can_write_rca('f3000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000c1'),
  'DM5·S2 F5 [CONTROL] BOTH writers can write this RCA — so F6/F7 differ only in document readability');

-- ⭐ F5b IS WHY F7 IS NOT VACUOUS. The first version of this block hardcoded a
-- document id captured before a reset; the seed mints those with
-- gen_random_uuid(), so after the next reset the id named NOTHING. F4/F6 went
-- red (visibly), but **F7 stayed GREEN FOR THE WRONG REASON** — it asserts
-- HC0D8 and got HC0D8 from "no such document" rather than from "you may not
-- read it". A denial that cannot tell absence from refusal proves nothing.
-- The id now resolves dynamically and this control pins BOTH sides of the
-- differential before either arm is asserted.
select ok(
  (select d.id from public.documents d
     join public.securable_resources s on s.id = d.home_resource_id
    where s.commission_id = 'a0000000-0000-0000-0000-0000000000a1'
      and s.resource_type = 'controlled_document' order by d.title limit 1) is not null
  and app.can_read_document((select id from f_doc), '00000000-0000-0000-0000-000000000002')
  and not app.can_read_document((select id from f_doc), '00000000-0000-0000-0000-0000000000c1'),
  'DM5·S2 F5b [CONTROL] the cited document EXISTS, IS readable by chefe.ccih and is NOT readable by nspcoord.a');

select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
set local role authenticated;
select lives_ok(
  $q$ select public.add_rca_evidence('f3000000-0000-0000-0000-0000000000a3','citation','pode ler',
        null, null, 'document', (select id from f_doc), 'rotulo F6') $q$,
  'DM5·S2 F6 ⭐ the citation seam is LIVE: a writer who CAN read the document may cite it (328 K8b discharged)');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000c1'::uuid, false, 'nsp_coordinator');
set local role authenticated;
select throws_ok(
  $q$ select public.add_rca_evidence('f3000000-0000-0000-0000-0000000000a3','citation','nao pode ler',
        null, null, 'document', (select id from f_doc), 'rotulo F7') $q$,
  'HC0D8', null,
  'DM5·S2 F7 ⭐ ONE VARIABLE: the same-authority writer who CANNOT read the document is refused (no linking what you cannot read)');
select throws_ok(
  $q$ insert into public.rca_evidence (rca_id,kind,title,cited_document_id,citation_label,created_by)
      values ('f3000000-0000-0000-0000-0000000000a3','citation','ghost',
              '00000000-0000-0000-0000-0000000dead2','rot',auth.uid()) $q$,
  '23503', null,
  'DM5·S2 F8 ⭐ the FK holds the DIRECT-DML path: a citation cannot name a document that does not exist');
reset role;

select ok(
  (select coalesce(with_check, qual) from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='capa_evidence_obj_insert_writable') like '%can_write_capa%'
  and (select coalesce(with_check, qual) from pg_policies
        where schemaname='storage' and tablename='objects'
          and policyname='capa_evidence_obj_insert_writable') not like '%hospital_of_event%',
  'DM5·S2 F9 ⭐ BUG-DM5-CAPA-1: the CAPA insert arm reads segment 1 as a CAPA id (can_write_capa), not through an EVENT resolver');

-- ---------------------------------------------------------------------------
-- G — THE WRITE GATE: `app.can_write_document`'s rca / capa_action arms,
-- asserted THROUGH `public.begin_document_upload` — the door those arms guard,
-- and the door 328/329/330/340 each assert through.
--
-- ⛔ WHY THIS BLOCK EXISTS. Migration 20260927000160 added the two arms and
-- measured them in a three-persona matrix — but that measurement lived in a
-- commit message and a migration comment, and NEVER in a suite. This file
-- named `can_write_document` zero times; it was the only DM suite that never
-- called `begin_document_upload`. Forcing the gate to `return true` left all
-- 41 assertions GREEN, so the write arm had no executable coverage anywhere in
-- the repo. That is BLIND, and the diff-scoped door sweep was right to refuse
-- it. Everything below is the coverage that was missing.
--
-- ⭐ RE-MEASURED, NOT COPIED FORWARD. Run against the live catalog in a
-- rolled-back txn, in THIS suite's state (custody already moved by block C,
-- documents_wave_d ON). Both halves — the predicates AND the door:
--
--   persona             read_evt write_rca read_capa write_capa | rca door  capa door
--   staff1.farm (…006)    true    FALSE     true      FALSE     | REFUSED   REFUSED
--   nspcoord.a  (…0c1)    true    true      true      true      | ACCEPTED  ACCEPTED
--   chefe.ccih  (…002)    true    true      true      FALSE     | ACCEPTED  REFUSED
--
-- ⚠ staff1.farm's READ-YES IS CUSTODY-DEPENDENT. In the raw seed it reads
-- neither home (false/false); it becomes the read-yes/write-no persona only
-- after block C moves custody. G0 pins that, because a denial from a persona
-- who cannot read either proves nothing about a WRITE arm — it is satisfied by
-- the read gate. If this block is ever moved above block C it goes vacuous
-- while staying green.
--
-- ⚠ P0002 IS DELIBERATELY AMBIGUOUS — the oracle-kill. `begin_document_upload`
-- raises the SAME `P0002 recurso não encontrado` for "no such resource" and
-- for "you may not write it" (its own comment: "absence ≡ denial"). A bare
-- throws_ok('P0002') is therefore EXACTLY the shape that already shipped
-- vacuous in this file — F7 asserting HC0D8 and receiving HC0D8 from "no such
-- document" rather than from "you may not read it". Every denial below is
-- bracketed in BOTH directions: a [CONTROL] that the registry row exists, AND
-- a POSITIVE control making the IDENTICAL call against the IDENTICAL fixture
-- as an authorized persona. If a fixture ever evaporates the positive goes
-- red; the denial cannot absorb the loss silently.
--
-- ⭐ G9 IS THE LOAD-BEARING ROW. `capa_plan ca000000-…a3` carries
-- source = 'rca' and source_rca_id = the very RCA chefe.ccih LEADS (G5 pins
-- all three facts). So the likeliest error in this change — pasting the `rca`
-- arm into the `capa_action` slot, or otherwise resolving CAPA write authority
-- through the source RCA — would GRANT chefe.ccih. nspcoord.a (PQS operator,
-- true either way) and staff1.farm (unrelated, false either way) both PASS
-- that mistake. Only this row fails it.
-- ---------------------------------------------------------------------------
select is(
  (select current_owner_commission_id from public.patient_safety_event
    where id = 'e3000000-0000-0000-0000-0000000000a3'),
  'b0000000-0000-0000-0000-0000000000b1'::uuid,
  'DM5·S2 G0 [CONTROL] custody sits at Farmácia (block C ran) — so staff1.farm''s READ-YES below is real and G10/G11 are read-yes/write-no denials');
select is(
  (select count(*)::int from public.securable_resources
    where id = 'f3000000-0000-0000-0000-0000000000a3' and resource_type = 'rca'),
  1,
  'DM5·S2 G1 [CONTROL] the rca registry row EXISTS — so a P0002 below is a REFUSAL, not an absence (the oracle-kill needs this)');
select is(
  (select count(*)::int from public.securable_resources
    where id = 'caa00000-0000-0000-0000-0000000000a1' and resource_type = 'capa_action'),
  1,
  'DM5·S2 G2 [CONTROL] the capa_action registry row EXISTS — same reason, and this one is shape B (NULL commission)');
select is((select enabled from app.feature_flags where key = 'documents_wave_d'), true,
  'DM5·S2 G3 [CONTROL] documents_wave_d is ON here (block F restored it) — with it OFF every call below refuses HC0D7 and would measure the FLAG, not the gate');
select ok(
  app.can_read_event('e3000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000006')
  and app.can_read_capa('ca000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000006'),
  'DM5·S2 G4 [CONTROL] staff1.farm READS both homes — the read-yes half a write arm needs and a read arm structurally cannot supply');
select ok(
  exists (select 1 from public.rca_members m
           where m.rca_id = 'f3000000-0000-0000-0000-0000000000a3'
             and m.user_id = '00000000-0000-0000-0000-000000000002'
             and m.role <> 'observer')
  and not app.is_pqs_operator_of_for('05000000-0000-0000-0000-00000000000a',
                                     '00000000-0000-0000-0000-000000000002')
  and (select source_rca_id from public.capa_plan
        where id = 'ca000000-0000-0000-0000-0000000000a3')
      = 'f3000000-0000-0000-0000-0000000000a3'::uuid,
  'DM5·S2 G5 [CONTROL] chefe.ccih is a NON-OBSERVER member of the RCA that SOURCED this CAPA plan, and is NOT a PQS operator — the exact shape that makes G9 discriminating');

-- nspcoord.a — the PQS operator: BOTH homes accept. These are the positives
-- that make every denial below a refusal rather than an absence.
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000c1'::uuid, false, 'nsp_coordinator');
set local role authenticated;
select lives_ok(
  $q$ select public.begin_document_upload('rca','f3000000-0000-0000-0000-0000000000a3',
        'G6 evidencia de RCA', null, null, null,
        'g6.pdf','application/pdf',100,'evidencia',null) $q$,
  'DM5·S2 G6 ⭐ POSITIVE: the PQS operator uploads onto an RCA home — the rca arm is LIVE and the fixture resolves');
select lives_ok(
  $q$ select public.begin_document_upload('capa_action','caa00000-0000-0000-0000-0000000000a1',
        'G7 evidencia de CAPA', null, null, null,
        'g7.pdf','application/pdf',100,'evidencia',null) $q$,
  'DM5·S2 G7 ⭐ POSITIVE: the same operator uploads onto a CAPA_ACTION home — the capa_action arm is LIVE, and shape B (NULL commission) does not break the corridor');
reset role;
select set_config('request.jwt.claims', '', true);

-- chefe.ccih — THE DIFFERENTIAL. One persona, two homes, opposite verdicts.
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
set local role authenticated;
select lives_ok(
  $q$ select public.begin_document_upload('rca','f3000000-0000-0000-0000-0000000000a3',
        'G8 evidencia do lider da RCA', null, null, null,
        'g8.pdf','application/pdf',100,'evidencia',null) $q$,
  'DM5·S2 G8 ⭐ the rca_member arm carries the write: the RCA lead uploads — so G9 is not "chefe.ccih is refused everywhere"');
select throws_ok(
  $q$ select public.begin_document_upload('capa_action','caa00000-0000-0000-0000-0000000000a1',
        'G9 tentativa na CAPA', null, null, null,
        'g9.pdf','application/pdf',100,'evidencia',null) $q$,
  'P0002', null,
  'DM5·S2 G9 ⭐⭐ THE LOAD-BEARING ROW: the SAME writer who just wrote the SOURCE RCA is refused its CAPA — the two arms are independent, and the rca arm was not pasted into the capa_action slot');
reset role;
select set_config('request.jwt.claims', '', true);

-- staff1.farm — READ-YES / WRITE-NO on both homes. The assertion a write arm
-- needs and a read arm structurally cannot supply (G4 pins the read half).
select test_helpers.claims_for('00000000-0000-0000-0000-000000000006'::uuid, false, 'staff');
set local role authenticated;
select throws_ok(
  $q$ select public.begin_document_upload('rca','f3000000-0000-0000-0000-0000000000a3',
        'G10 tentativa na RCA', null, null, null,
        'g10.pdf','application/pdf',100,'evidencia',null) $q$,
  'P0002', null,
  'DM5·S2 G10 ⭐ READ-YES / WRITE-NO: the custody reader who CAN read the event is refused the RCA upload (G6/G8 prove the same call succeeds for others)');
select throws_ok(
  $q$ select public.begin_document_upload('capa_action','caa00000-0000-0000-0000-0000000000a1',
        'G11 tentativa na CAPA', null, null, null,
        'g11.pdf','application/pdf',100,'evidencia',null) $q$,
  'P0002', null,
  'DM5·S2 G11 ⭐ READ-YES / WRITE-NO on the second home too (G7 proves the same call succeeds for the operator)');
reset role;
select set_config('request.jwt.claims', '', true);

select * from finish();
rollback;
