-- =============================================================================
-- 330 — DM3 · Wave B: controlled documents + the ethics document seams.
-- ADR 0114 (D13 Wave B; Amendment 1 D15/D16; Amendment 2 D17), on the DM1
-- substrate (ADR 0116) and the DM2 command layer (ADR 0118).
-- Plan: docs/plans/dm3-controlled-documents-plan.md.
--
-- ⚠ LABELLING (binding condition R1). Labels are `DM3·<Section><n>`, NOT bare
-- K-numbers. `328` uses ~104 `K`-prefixed labels (K1a…K16s) and DM4 / Wave D
-- still refer to `328`'s K8a / K8b / K8c BY NAME; a bare K-scheme here collided
-- with ELEVEN of them (K1a, K1b, K2b, K3, K9, K10, K12a, K12b, K13, K14b,
-- K16*), each meaning something unrelated in each suite. `329` had already
-- abandoned K-numbering for section letters; this file follows the newer
-- sibling and adds the program tag so every label is globally greppable.
--   R registry · A authorization arm · C ceiling · T tier/no-PHI ·
--   B bucket & door retirement · P pointer freeze · E ethics seams ·
--   X reconciliation & audit · S structural/ACL.
--
-- ⭐ RED-FIRST RECORD. Sections are authored and run BEFORE their implementing
-- migration; the observed pre-migration failures are recorded in the phase
-- record and in each migration's commit message. A section that is GREEN on
-- its first run is a FINDING, not a pass, and is investigated before the SQL
-- is written (authz-handoff §7.1).
--
-- Turn 1 (this commit): section R, red against the pre-M1 catalog.
-- Sections A/C/T/B/P/E/X/S join with M2–M7; plan() grows with them.
-- =============================================================================

-- ⚠ IN-SUITE MUTATION IDIOM (found the hard way, 2026-08-13). An assertion that
-- sits between `savepoint` and `rollback to savepoint` PRINTS `ok` but is
-- DISCARDED from pgTAP's tally — the rollback unwinds pgTAP's own bookkeeping.
-- Minimal repro: plan(1); savepoint s; <mutate>; throws_ok(...) → prints "ok 1";
-- rollback to savepoint s; finish() → "# No tests run!". The file then reports
-- "planned N but ran N-1", which a summary line can hide. So: mutate WITHOUT a
-- savepoint, assert, then restore explicitly from a CAPTURED definition; the
-- file-level `rollback` is the real safety net. Cross-check
-- `194_tenant_composite_fk.sql` (savepoint → alter → throws_ok → rollback to
-- savepoint, its test 4.1) against this before trusting its count.
-- =============================================================================

begin;
select plan(50);

-- Flag preconditions asserted, never assumed (authz-handoff §7.3). A missing
-- flag SILENTLY SKIPS keystones — never trust a self-reported total.
select is(app.feature_enabled('documents_foundation'), true,
  'precondition: documents_foundation is ON (the core model must be live)');
select is(app.feature_enabled('controlled_docs'), true,
  'precondition: controlled_docs is ON (section R exercises the domain tables)');
-- ⚠ Wave B's own gate. With this OFF, every DM3 door answers HC0D7 and sections
-- B/P/E red on the FLAG rather than on a defect — the pgTAP fixture-flag-gap
-- trap, which normally hides keystones by SKIPPING them. Asserted, never
-- assumed; seed.sql forces it ON locally (and 328 K9b/K9c is its twin).
select is(app.feature_enabled('documents_wave_b'), true,
  'precondition: documents_wave_b is ON (seed-forced locally; prod stays OFF until the DM3 gate)');

-- =============================================================================
-- R — REGISTRY ADMISSION (M1). `controlled_document` becomes a
-- `securable_resources.resource_type` so a controlled document can be a
-- document HOME. Three barriers refuse it today; R1 opens two of them, and the
-- third (the kernel's `else false` arm) is section A's, deliberately split so
-- A1 is red on the real catalog rather than born green.
-- =============================================================================

-- R1 ⭐ — the type is admitted WITH the full tenant triple.
-- RED pre-M1: `securable_resources_type_check` refuses (23514).
select lives_ok(
  $$ insert into public.securable_resources
       (id, resource_type, organization_id, hospital_id, commission_id)
     select gen_random_uuid(), 'controlled_document',
            c.organization_id, c.hospital_id, c.id
       from public.commissions c
      where c.id = 'a0000000-0000-0000-0000-0000000000a1' $$,
  'DM3·R1 ⭐ securable_resources admits resource_type = controlled_document with the tenant triple');

-- R1b — every existing controlled document has exactly one registry row, and
-- the shared-PK identity holds (id == controlled_documents.id), mirroring the
-- cases / meetings / interviews / action_items precedent.
select is(
  (select count(*)::int from public.controlled_documents d
     join public.securable_resources s
       on s.id = d.id and s.resource_type = 'controlled_document'),
  (select count(*)::int from public.controlled_documents),
  'DM3·R1b every controlled_documents row has its shared-PK registry row');

-- R1c — the registry row carries the DOCUMENT'S OWN commission, not a
-- hard-coded or inherited one (an all-rows-same-tenant backfill would pass a
-- bare count and fail this).
-- ⚠ Expressed as "rows that AGREE == rows that EXIST", never as
-- "violations == 0": the latter passes by ABSENCE (pre-M1 there are no registry
-- rows at all, so a violation count of 0 is vacuously true). This shape cannot
-- go green until the backfill has actually produced rows.
select is(
  (select count(*)::int from public.controlled_documents d
     join public.securable_resources s on s.id = d.id
    where s.commission_id = d.commission_id
      and s.organization_id is not null
      and s.hospital_id is not null),
  (select count(*)::int from public.controlled_documents),
  'DM3·R1c each registry row carries its own document''s commission + a complete tenant triple');

-- R2 ⭐ — THE TWO CONSTRAINTS ARE INDEPENDENT BARRIERS.
-- `securable_resources_tenant_shape` is an UNCONDITIONAL conjunction that
-- re-enumerates the closed type set, so it must be widened too; a half-widening
-- leaves the type refused. One twin per barrier, never one twin standing for
-- both (the DM2 "two codes, one barrier" finding).
--
-- ⚠ NO SAVEPOINT HERE, DELIBERATELY — see the header note. An assertion between
-- `savepoint` and `rollback to savepoint` prints `ok` but is DISCARDED from
-- pgTAP's tally (proven: plan(1) + savepoint + throws_ok + rollback-to-savepoint
-- ⇒ finish() reports "No tests run!"). The file-level `rollback` at the end is
-- what undoes the mutation; the explicit restore below keeps every LATER section
-- running against the true, unmutated catalog.

-- Capture the real definition first, so the restore cannot drift from it.
create temp table _dm3_saved_ck on commit drop as
  select pg_get_constraintdef(oid) as def
    from pg_constraint where conname = 'securable_resources_type_check';

alter table public.securable_resources drop constraint securable_resources_type_check;

select throws_ok(
  $$ insert into public.securable_resources
       (id, resource_type, organization_id, hospital_id, commission_id)
     select gen_random_uuid(), 'not_a_real_type',
            c.organization_id, c.hospital_id, c.id
       from public.commissions c
      where c.id = 'a0000000-0000-0000-0000-0000000000a1' $$,
  '23514', null,
  'DM3·R2 ⭐ with _type_check NEUTRALIZED, _tenant_shape independently refuses an unknown type');

do $$
declare d text;
begin
  select def into d from _dm3_saved_ck;
  execute format(
    'alter table public.securable_resources add constraint securable_resources_type_check %s', d);
end $$;

-- R2b — the STRUCTURAL half: BOTH constraint definitions must enumerate the new
-- type. Catches a half-widening, which is invisible to R1 (whichever constraint
-- Postgres evaluates first reports, so R1 alone cannot attribute the refusal).
select is(
  (select count(*)::int from pg_constraint
    where conname in ('securable_resources_type_check', 'securable_resources_tenant_shape')
      and pg_get_constraintdef(oid) like '%controlled_document%'),
  2,
  'DM3·R2b BOTH securable_resources constraints enumerate controlled_document (no half-widening)');

-- =============================================================================
-- A — THE AUTHORIZATION ARM (M2). `app.can_read_document`'s dispatch gains a
-- `controlled_document` arm: commission member OR entitled approver. The
-- approver half is the arm the dying bucket policy
-- (`controlled_documents_obj_select_member` → `app.can_read_document_object`,
-- "member of foldername[1] OR approver on foldername[2]") would otherwise take
-- with it, silently.
--
-- Seed fixtures (catalog-verified, not assumed):
--   chefe.ccih  …002  CCIH member;      reads the ethics case;   cleared
--   staff1.ccih …003  CCIH member;      NO ethics-case access;   uncleared
--   staff1.farm …006  NOT a CCIH member; approver on DOC-0001
--   chefe.farm  …005  NOT a CCIH member; approver on DOC-0002 ONLY
-- =============================================================================

-- Fixture: a core document homed on DOC-0001's registry row, and one homed on
-- the seeded ethics case. Both live only inside this rolled-back transaction.
insert into public.documents (id, home_resource_id, title, kind, status, created_by)
select 'dd300000-0000-0000-0000-0000000000c1', d.id,
       'Fixture A · controlled-document home', 'documento_controlado', 'active',
       '00000000-0000-0000-0000-000000000002'
  from public.controlled_documents d
 where d.id = 'c4c3f346-b18b-42bf-a754-968ecf264e58';

insert into public.documents (id, home_resource_id, title, kind, status, created_by)
values ('dd300000-0000-0000-0000-0000000000e1',
        'ca000000-0000-0000-0000-0000000000e1',
        'Fixture A · ethics-case home', 'registro', 'active',
        '00000000-0000-0000-0000-000000000002');

-- A1 ⭐ — the member arm. RED pre-M2: the dispatch falls to `else false`, so
-- this is denied to EVERYONE, member or not.
select is(
  app.can_read_document('dd300000-0000-0000-0000-0000000000c1',
                        '00000000-0000-0000-0000-000000000002'),
  true,
  'DM3·A1 ⭐ a commission member reads a controlled-document-homed document');

-- A2a — POSITIVE CONTROL. Without it, A1 red is indistinguishable from "that
-- persona was never a member" (a wrong-arm fixture — authz-handoff §7.1).
select is(
  app.is_member_of_for('a0000000-0000-0000-0000-0000000000a1',
                       '00000000-0000-0000-0000-000000000002'),
  true,
  'DM3·A2a POSITIVE CONTROL: chefe.ccih genuinely holds CCIH membership');

-- A2b ⭐ — the approver arm is scoped to THIS DOCUMENT, not global. chefe.farm
-- is an approver — on DOC-0002 — and a non-member here. A global approver arm
-- would hand him DOC-0001. This is the discriminating control: it separates
-- "the approver arm works" from "the approver arm is a blanket grant".
select is(
  app.can_read_document('dd300000-0000-0000-0000-0000000000c1',
                        '00000000-0000-0000-0000-000000000005'),
  false,
  'DM3·A2b ⭐ an approver of a DIFFERENT controlled document does NOT reach this one');

-- A3 ⭐ — the approver arm. RED pre-M2. staff1.farm holds no membership in the
-- owning commission; his ONLY route is the approver corridor the bucket policy
-- grants today.
select is(
  app.can_read_document('dd300000-0000-0000-0000-0000000000c1',
                        '00000000-0000-0000-0000-000000000006'),
  true,
  'DM3·A3 ⭐ a cross-commission APPROVER reads the controlled document (the arm the bucket policy carried)');

-- A3b — POSITIVE CONTROL for A3: he must genuinely NOT be a member, else A3
-- passes through the member arm and proves nothing about the approver arm.
select is(
  app.is_member_of_for('a0000000-0000-0000-0000-0000000000a1',
                       '00000000-0000-0000-0000-000000000006'),
  false,
  'DM3·A3b POSITIVE CONTROL: staff1.farm holds NO membership in the owning commission');

-- A4 ⭐ NEGATIVE TWIN (ADR 0114 Amendment 2). An ethics-case-homed document is
-- gated by the ETH·E1 spine, NOT by commission membership. staff1.ccih IS a
-- member of the ethics case's commission and has NO case access.
-- ⚠ This is a NO-REGRESSION pin: green before AND after M2 by design. Its
-- falsifier is the mutation twin, which WIDENS the `case` branch with a
-- membership arm and requires this to go red — a no-regression claim passes a
-- widening by construction, so the twin is the assertion, not this line.
select is(
  app.can_read_document('dd300000-0000-0000-0000-0000000000e1',
                        '00000000-0000-0000-0000-000000000003'),
  false,
  'DM3·A4 ⭐ NEGATIVE TWIN: an ethics-case-homed document is NOT readable by an ordinary commission member (Wave B''s reader set must not leak into ethics)');

-- A4b — POSITIVE CONTROL: the same document IS readable by a persona with real
-- case access, so A4 is not passing because the fixture is unreadable to all.
select is(
  app.can_read_document('dd300000-0000-0000-0000-0000000000e1',
                        '00000000-0000-0000-0000-000000000002'),
  true,
  'DM3·A4b POSITIVE CONTROL: a persona WITH ethics-case access does read it (A4 is not vacuous)');

-- =============================================================================
-- X / P — THE DOMAIN↔CORE SEAM AND ITS FREEZE (M3).
--
-- `controlled_document_versions.core_document_version_id` is the mutable
-- DOMAIN-side pointer that lets a coordinator re-upload a draft's file without
-- ever touching the append-only core binding (`document_version_files`), which
-- D10 governs and DM1's immutability trigger enforces. Lead ruling Q3: the
-- domain pointer is outside D10 — CONDITIONAL on the freeze below (R2).
--
-- ⚠⚠ WHY THE FREEZE NEEDS ITS OWN TRIGGER, AND WHY THAT TRIGGER MUST IGNORE THE
-- GUC. `app.guard_controlled_document_status` already ends with:
--     if old.status not in ('draft','changes_requested') and not v_in_rpc then
--       raise ... 'versões publicadas/obsoletas são imutáveis' (HC089)
-- where v_in_rpc := current_setting('app.in_controlled_docs_rpc') = 'on'. EVERY
-- controlled-docs RPC sets that GUC, so that clause guards only direct table
-- DML — and after M4 the RPC corridor is the ONLY writable path. A pointer
-- guard written in that sibling's image would be VACUOUS BY CONSTRUCTION:
-- green forever, guarding nothing, exactly where D10 exists to protect.
-- So `app.guard_controlled_core_binding` deliberately does NOT read the GUC,
-- and DM3·P3 makes that non-bypassability EXECUTABLE rather than a comment a
-- future "restore consistency with the sibling" edit would delete.
--
-- Barrier codes are deliberately DISTINCT so a red can be attributed:
--   HC089  — the DOOR's freeze re-check (mirrors set_document_version_file)
--   HC0DB  — the TRIGGER's hard freeze (not bypassable by the corridor)
-- =============================================================================

-- Structural: the seam columns exist. RED pre-M3.
select has_column('public', 'controlled_documents', 'core_document_id',
  'DM3·X1a controlled_documents.core_document_id exists (one core document per controlled document)');
select has_column('public', 'controlled_document_versions', 'core_document_version_id',
  'DM3·X1b controlled_document_versions.core_document_version_id exists (the domain-side pointer)');

-- X1 ⭐ — the reconciliation count identity (lead ruling Q2: backfill 1:1, so
-- this stays a real assertion with no documented exception). RED pre-M3: 0 vs 3.
select is(
  (select count(*)::int
     from public.document_versions dv
     join public.documents d on d.id = dv.document_id
     join public.securable_resources s on s.id = d.home_resource_id
    where s.resource_type = 'controlled_document'),
  (select count(*)::int from public.controlled_document_versions),
  'DM3·X1 ⭐ one core document_version per controlled_document_version (1:1 backfill reconciled)');

-- X1c — every domain version's pointer RESOLVES to a core version of that same
-- document. Expressed as "rows that AGREE == rows that EXIST", never as
-- "violations == 0" — the latter passes by ABSENCE (the DM3·R1c lesson).
select is(
  (select count(*)::int
     from public.controlled_document_versions v
     join public.document_versions dv on dv.id = v.core_document_version_id
     join public.controlled_documents cd on cd.id = v.document_id
    where dv.document_id = cd.core_document_id),
  (select count(*)::int from public.controlled_document_versions),
  'DM3·X1c every domain version''s pointer resolves to a core version of its OWN core document');

-- Fixture: the seed has NO draft/changes_requested version (all three are
-- effective/in_approval — catalog-checked), so the unfrozen positive control
-- has to be created here. INSERT is not guarded by
-- app.guard_controlled_document_status (BEFORE DELETE OR UPDATE only).
insert into public.controlled_document_versions (id, document_id, version_number, status, created_by)
values ('dc300000-0000-0000-0000-0000000000d1',
        'c4c3f346-b18b-42bf-a754-968ecf264e58', 2, 'draft',
        '00000000-0000-0000-0000-000000000002');

-- P2b — POSITIVE CONTROL, and it must come FIRST. Without it, P2/P3 are
-- satisfied by "the pointer can never move for anyone", which a broken column
-- or a blanket-deny trigger would also satisfy.
select lives_ok(
  $$ update public.controlled_document_versions
        set core_document_version_id = (
              select dv.id from public.document_versions dv
              join public.documents d on d.id = dv.document_id
              join public.securable_resources s on s.id = d.home_resource_id
              where s.resource_type = 'controlled_document'
                and d.id = (select core_document_id from public.controlled_documents
                             where id = 'c4c3f346-b18b-42bf-a754-968ecf264e58')
              order by dv.version_number limit 1)
      where id = 'dc300000-0000-0000-0000-0000000000d1' $$,
  'DM3·P2b POSITIVE CONTROL: the pointer DOES move while the version is a draft (P2/P3 are not "nothing ever moves")');

-- P2 ⭐ — the TRIGGER refuses a pointer move on a FROZEN version.
-- RED pre-M3: the column does not exist, so this raises 42703, not HC0DB.
select throws_ok(
  $$ update public.controlled_document_versions
        set core_document_version_id = gen_random_uuid()
      where id = '18f68d3e-7804-4d01-a1ff-33e6bdd55218' $$,
  'HC0DB', null,
  'DM3·P2 ⭐ the core-binding trigger refuses a pointer move on an EFFECTIVE version');

-- P3 ⭐⭐ — THE NON-BYPASSABILITY PIN. Impersonate the RPC corridor by setting
-- the very GUC that disarms the sibling guard, and require the refusal to hold.
-- If someone later "restores consistency" by making this trigger honour
-- `app.in_controlled_docs_rpc`, THIS goes red instead of the freeze silently
-- evaporating for every command in the corridor.
set local app.in_controlled_docs_rpc = 'on';
select throws_ok(
  $$ update public.controlled_document_versions
        set core_document_version_id = gen_random_uuid()
      where id = '5e49cd45-307a-4216-8004-75d0354f8d63' $$,
  'HC0DB', null,
  'DM3·P3 ⭐⭐ the freeze holds even INSIDE the RPC corridor (app.in_controlled_docs_rpc = on) — the sibling guard''s bypass is deliberately not inherited');
set local app.in_controlled_docs_rpc = 'off';

-- P3b — PROOF THE IMPERSONATION IS REAL. If the GUC were not actually set, P3
-- would pass for the trivial reason that it is just P2 again. This asserts the
-- sibling guard genuinely IS disarmed by that GUC — i.e. the bypass P3 defeats
-- is a real bypass, not a hypothetical one.
set local app.in_controlled_docs_rpc = 'on';
select lives_ok(
  $$ update public.controlled_document_versions
        set summary_of_changes_md = 'corridor probe'
      where id = '18f68d3e-7804-4d01-a1ff-33e6bdd55218' $$,
  'DM3·P3b PROOF OF IMPERSONATION: the SIBLING guard IS disarmed by the same GUC (a non-pointer update on a frozen version succeeds) — so P3 defeats a real bypass');
set local app.in_controlled_docs_rpc = 'off';

-- =============================================================================
-- B / S — THE WRITE PATH REPLACEMENT (M4). `set_document_version_file` and the
-- raw `storage_path` column die; bytes arrive only through the DM2
-- begin/finalize pair, and the domain records the pointer.
--
-- Five product verbs called the retiring RPC — addDocumentVersion,
-- createAndSubmitDocument, createDraftOnly, supersedeAndSubmitDocument,
-- reviseChangesRequestedDocument — so the TS side changes with it.
-- =============================================================================

select hasnt_function('public', 'set_document_version_file',
  'DM3·B5a the raw-path writer set_document_version_file is GONE');
select hasnt_column('public', 'controlled_document_versions', 'storage_path',
  'DM3·B5b the raw storage_path column is GONE (0 non-null rows in either environment)');

-- S1a — door hygiene asserted from the CATALOG, never from the migration text.
-- A DROP+CREATE that forgot the re-GRANT would restore the Postgres default
-- (PUBLIC EXECUTE, no authenticated grant) and this is what catches it.
--
-- ⚠ PRIVILEGE IS TESTED SEMANTICALLY, via has_function_privilege — never by
-- pattern-matching proacl. The first draft of this keystone used
-- `proacl::text like '%=X/postgres,%'` to mean "PUBLIC has EXECUTE"; that
-- substring is present in EVERY ordinary grant (`postgres=X/postgres,`), so it
-- reported PUBLIC access on a correctly-locked door. It happened to fail
-- closed, but the same shape fails OPEN just as easily — an ACL is a value to
-- resolve, not a string to grep.
select is(
  (select p.prosecdef::text || '|' ||
          array_to_string(p.proconfig, ',') || '|' ||
          has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || '|' ||
          has_function_privilege('public', p.oid, 'EXECUTE')::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'attach_controlled_document_version_file'),
  'true|search_path=app, public, pg_catalog|true|false',
  'DM3·S1a the new door is DEFINER, search_path-pinned, EXECUTable by authenticated, and NOT by PUBLIC');

-- A core version to attach: minted directly (begin/finalize is exercised by 329;
-- this section is about the DOMAIN door, not the upload machine).
insert into public.document_versions (id, document_id, version_number, created_by)
select 'da300000-0000-0000-0000-0000000000a1', cd.core_document_id, 2,
       '00000000-0000-0000-0000-000000000002'
  from public.controlled_documents cd
 where cd.id = 'c4c3f346-b18b-42bf-a754-968ecf264e58';

-- P1c — AUTHORITY, inherited from the retiring door. A plain member of the
-- owning commission is not a writer. Asserted BEFORE the success case so a
-- broken door cannot pass P1b by being open to everyone.
select test_helpers.claims_for('00000000-0000-0000-0000-000000000003'::uuid, false, 'staff');
select throws_ok(
  $q$ select public.attach_controlled_document_version_file(
        'dc300000-0000-0000-0000-0000000000d1',
        'da300000-0000-0000-0000-0000000000a1') $q$,
  '42501', null,
  'DM3·P1c a plain commission member cannot attach a file (the set_document_version_file authority survives)');

select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');

-- P1 ⭐ — THE DOOR's freeze re-check, distinct from the trigger's (HC089 vs
-- HC0DB) so the two barriers are separately attributable (R2).
select throws_ok(
  $q$ select public.attach_controlled_document_version_file(
        '18f68d3e-7804-4d01-a1ff-33e6bdd55218',
        'da300000-0000-0000-0000-0000000000a1') $q$,
  'HC089', null,
  'DM3·P1 ⭐ the DOOR refuses attaching a file to an EFFECTIVE version (HC089, distinct from the trigger''s HC0DB)');

-- P1b — POSITIVE CONTROL: the door works on a draft. Without it P1/P1c are
-- satisfied by a door that refuses everyone.
select lives_ok(
  $q$ select public.attach_controlled_document_version_file(
        'dc300000-0000-0000-0000-0000000000d1',
        'da300000-0000-0000-0000-0000000000a1', 'resumo das alterações') $q$,
  'DM3·P1b POSITIVE CONTROL: the staff_admin DOES attach on a draft version (P1/P1c are not "refuses everyone")');

-- =============================================================================
-- T — THE NO-PHI STANCE (M6). ADR 0114 D13: "PHI-tier input on a controlled
-- document fails closed."
--
-- ⚠ THAT SENTENCE HAS NO TARGET AT THE UPLOAD DOOR. `begin_document_upload`
-- DERIVES the tier server-side (`case`/`interview` → phi, else standard), so a
-- controlled-document upload is standard BY CONSTRUCTION and there is no PHI
-- input to reject there — a guard placed at that door would cover an impossible
-- input. The reachable surface is `reclassify_document(p_document_id,
-- p_target_tier)`, which accepts 'phi' for ANY home type. That is where the
-- stance is enforced (M6) and where T1's red lives.
-- =============================================================================

-- A real, servable file on the controlled document's latest core version.
-- Built by WALKING the D9 state machine, because app.guard_file_object_transition
-- refuses any file object that does not start life 'reserved' (HC0D1) — the
-- fixture cannot shortcut into 'clean'.
insert into public.file_objects (id, storage_bucket, storage_path, sensitivity_tier, created_by)
values ('f0300000-0000-0000-0000-0000000000a1', 'documents-standard',
        '0c000000-0000-0000-0000-00000000000a/f0300000-0000-0000-0000-0000000000a1/gen1',
        'standard', '00000000-0000-0000-0000-000000000002');
update public.file_objects set upload_state = 'uploaded', uploaded_at = now()
  where id = 'f0300000-0000-0000-0000-0000000000a1';
update public.file_objects set upload_state = 'verifying'
  where id = 'f0300000-0000-0000-0000-0000000000a1';
update public.file_objects set upload_state = 'scan_pending'
  where id = 'f0300000-0000-0000-0000-0000000000a1';
update public.file_objects
   set upload_state = 'clean', verified_at = now(), size_bytes = 100,
       mime_type = 'application/pdf', sha256 = repeat('a', 64)
  where id = 'f0300000-0000-0000-0000-0000000000a1';
insert into public.document_version_files (document_version_id, file_object_id, rendition_kind)
values ('da300000-0000-0000-0000-0000000000a1', 'f0300000-0000-0000-0000-0000000000a1', 'source');

select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');

-- T1 ⭐ — a controlled document cannot be pushed into the PHI tier.
-- RED pre-M6 for the RIGHT reason: with a clean, bound, servable file in place
-- the call genuinely SUCCEEDS there — the hole is real, not hypothetical.
select throws_ok(
  format($q$ select public.reclassify_document(%L, 'phi') $q$,
         (select core_document_id from public.controlled_documents
           where id = 'c4c3f346-b18b-42bf-a754-968ecf264e58')),
  'HC0DH', null,
  'DM3·T1 ⭐ reclassify_document refuses to move a CONTROLLED document into the phi tier (D13 no-PHI stance)');

-- T1b — POSITIVE CONTROL: the same door still works in the ALLOWED direction,
-- so T1 is not passing because reclassification is simply broken. A case home
-- is phi by the tier rule, so the legal move for it is phi → standard.
select lives_ok(
  format($q$ select public.reclassify_document(%L, 'standard') $q$,
         (select d.id from public.documents d
            join public.securable_resources s on s.id = d.home_resource_id
            join public.document_versions dv on dv.document_id = d.id
            join public.document_version_files dvf on dvf.document_version_id = dv.id
            join public.file_objects f on f.id = dvf.file_object_id
           where s.resource_type = 'case' and d.status = 'active'
             and f.sensitivity_tier = 'phi' and f.disposal_state = 'none'
             and f.upload_state in ('clean', 'unscanned_accepted')
           limit 1)),
  'DM3·T1b POSITIVE CONTROL: reclassify_document still works for a non-controlled home (T1 is not "the door is broken")');

-- T2 — the upload door derives `standard` for a controlled-document home. The
-- by-construction half, asserted so a future tier-derivation edit cannot
-- quietly send Wave B bytes to the PHI bucket.
-- ⚠ The door is called into a temp table first (the 329 idiom) rather than
-- inlined in a scalar subquery — inlining made the result unobservable.
create temp table t2_begin on commit drop as
  select public.begin_document_upload(
           'controlled_document',
           'c4c3f346-b18b-42bf-a754-968ecf264e58',
           'Fixture T2', null, null,
           (select core_document_id from public.controlled_documents
             where id = 'c4c3f346-b18b-42bf-a754-968ecf264e58')) as r;

select is(
  (select f.storage_bucket || '|' || f.sensitivity_tier
     from public.file_objects f
    where f.id = (select (r->>'file_object_id')::uuid from t2_begin)),
  'documents-standard|standard',
  'DM3·T2 the upload door derives the STANDARD tier/bucket for a controlled-document home');

select set_config('request.jwt.claims', '', true);

-- =============================================================================
-- B — BUCKET + DOOR RETIREMENT (M5). The `controlled-documents` bucket loses
-- BOTH policies (lead ruling Q4 — the INSERT one bypasses begin_document_upload
-- entirely, so dropping only SELECT would leave a hole straight through the
-- command layer). The bucket ROW itself retires at DM5 under the single
-- retirement manifest — deliberately not here.
-- =============================================================================

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) like '%controlled-documents%'),
  0,
  'DM3·B1 ⭐ ZERO storage.objects policies reference controlled-documents (both SELECT and INSERT retired)');

select hasnt_function('app', 'can_read_document_object',
  'DM3·B2 the bucket predicate app.can_read_document_object is GONE (its only caller was that policy)');

-- B3 — POSITIVE CONTROL for the derivation itself. B1 asserts a ZERO; a broken
-- derivation also reports zero. This proves the same query still SEES a live
-- policy elsewhere. Mirrors 325 t4 — a detector that finds nothing must be
-- proven able to find something.
select ok(
  (select count(*) >= 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) like '%case-documents%'),
  'DM3·B3 POSITIVE CONTROL: the same derivation still sees the live case-documents policy (B1''s zero is real)');

-- =============================================================================
-- B4 / X3 — THE BYTE CORRIDOR: prior versions, and the projection↔door contract.
-- =============================================================================

-- The test's ORACLE for the availability predicate. It mirrors, branch for
-- branch and in the same order, `documentVersionAvailability` in
-- `src/lib/queries/documents.ts` — the ONE predicate Wave A and Wave B share.
--
-- ⚠ THIS ORACLE AND THAT TS FUNCTION ARE A PAIR. Changing either without the
-- other is the drift X3 exists to catch. The oracle is deliberately a
-- restatement rather than a call: X3's job is to prove the TS predicate's
-- CONTRACT holds against the real door, and an oracle that delegated to the
-- thing under test would prove nothing.
create or replace function pg_temp.availability_oracle(p_version uuid)
returns text language sql stable as $$
  select case
    when d.status in ('disposal_pending', 'disposed') then 'disposed'
    when f.id is null then 'pending'
    when f.disposal_state <> 'none' then 'disposed'
    when f.upload_state in ('clean', 'unscanned_accepted')
      then case when d.status = 'active' then 'available' else 'unavailable' end
    when f.upload_state in ('failed', 'rejected', 'infected', 'abandoned') then 'failed'
    else 'pending'
  end
  from public.document_versions dv
  join public.documents d on d.id = dv.document_id
  left join public.document_version_files dvf
    on dvf.document_version_id = dv.id and dvf.rendition_kind = 'source'
  left join public.file_objects f on f.id = dvf.file_object_id
  where dv.id = p_version;
$$;

-- Did the REAL door hand over bytes? Any refusal — whatever its code — is a
-- non-serve, which is exactly the granularity the UI gate cares about.
create or replace function pg_temp.door_serves(p_version uuid)
returns boolean language plpgsql as $$
begin
  perform public.open_document_version(p_version);
  return true;
exception when others then
  return false;
end $$;

select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');

-- Bind T2's RESERVED file object as this version's source: bound, but not
-- servable. This is the sharpest arm — it is the state where "the pointer is
-- non-null" would wrongly imply "the file is available", which is precisely the
-- inference the frontend must not make.
insert into public.document_version_files (document_version_id, file_object_id, rendition_kind)
select (r->>'document_version_id')::uuid, (r->>'file_object_id')::uuid, 'source' from t2_begin;

-- X3a ⭐ — servable: the door serves ⟺ the predicate says `available`.
select is(
  pg_temp.door_serves('da300000-0000-0000-0000-0000000000a1'),
  pg_temp.availability_oracle('da300000-0000-0000-0000-0000000000a1') = 'available',
  'DM3·X3a ⭐ clean+bound: the door SERVES and the predicate says available — they agree');

-- X3b ⭐⭐ — bound but NOT servable. A projection that keyed off the pointer
-- alone would call this available; the door refuses it.
select is(
  pg_temp.door_serves((select (r->>'document_version_id')::uuid from t2_begin)),
  pg_temp.availability_oracle((select (r->>'document_version_id')::uuid from t2_begin)) = 'available',
  'DM3·X3b ⭐⭐ bound but unservable (reserved): the door REFUSES and the predicate does NOT say available — they agree');

-- X3b-control — pin the state under test, so X3b cannot pass by the fixture
-- having drifted into some other non-available state.
select is(
  pg_temp.availability_oracle((select (r->>'document_version_id')::uuid from t2_begin)),
  'pending',
  'DM3·X3b-control the unservable fixture is genuinely `pending` (bound, reserved) — not disposed/failed by accident');

-- X3c — unbound: no source rendition at all (the backfilled fileless version).
select is(
  pg_temp.door_serves(
    (select dv.id from public.document_versions dv
      join public.controlled_documents cd on cd.core_document_id = dv.document_id
     where cd.id = 'c4c3f346-b18b-42bf-a754-968ecf264e58' and dv.version_number = 1)),
  pg_temp.availability_oracle(
    (select dv.id from public.document_versions dv
      join public.controlled_documents cd on cd.core_document_id = dv.document_id
     where cd.id = 'c4c3f346-b18b-42bf-a754-968ecf264e58' and dv.version_number = 1)) = 'available',
  'DM3·X3c unbound: the door REFUSES and the predicate does NOT say available — they agree');

-- B4a — PRECONDITION for B4: the version B4 opens must genuinely NOT be the
-- latest. Without this, B4 passes on a door that only ever serves the current
-- version — which is the exact regression it exists to catch.
select ok(
  (select max(dv.version_number) from public.document_versions dv
     join public.controlled_documents cd on cd.core_document_id = dv.document_id
    where cd.id = 'c4c3f346-b18b-42bf-a754-968ecf264e58')
  > (select version_number from public.document_versions
      where id = 'da300000-0000-0000-0000-0000000000a1'),
  'DM3·B4a PRECONDITION: the version B4 opens is genuinely NOT the latest');

-- B4 ⭐ — THE DM3 EXIT CRITERION (plan step 4 + the Exit line): prior-version
-- downloads keep working for authorized commission members after the bucket
-- policy dies. It holds by construction — `open_document_version` takes a
-- version id and never consults `controlled_documents.current_version_id` — but
-- "by construction" is a claim, and this repo has been burned by that phrasing.
-- ⚠ Routed through `pg_temp.door_serves` rather than calling the door inline.
-- An inline `is(open_document_version(...)->>...)` RAISES when the door refuses,
-- which ABORTS the transaction and silently drops every later assertion — under
-- the B4 mutation twin this file reported ONE failure and ten un-run tests, with
-- B4's own line never printed. A keystone whose red takes the rest of the suite
-- with it is a keystone you cannot read.
select is(
  pg_temp.door_serves('da300000-0000-0000-0000-0000000000a1'),
  true,
  'DM3·B4 ⭐ EXIT CRITERION: an authorized member opens a PRIOR version through the audited door');

select set_config('request.jwt.claims', '', true);

-- =============================================================================
-- E — THE ETHICS DOCUMENT SEAMS (M7). ADR 0114 Amendment 2 / D17, five binding
-- discharge conditions. A partial discharge is not a discharge.
--
-- ⚠ THE HOME TYPE IS THE WHOLE SECURITY ARGUMENT (lead ruling Q1). An ethics
-- letter's core `documents` row homes on the CASE securable resource, NEVER on
-- a `controlled_document` one, so it inherits the ETH·E1 spine
-- (app.can_read_case + app.confidentiality_clearance_ok) rather than Wave B's
-- commission-membership arm. DM3·A4 is the negative twin for that; this section
-- pins the seam itself.
--
-- Distinct errcodes so a red is attributable to ONE barrier:
--   HC0DI  the TRIGGER's cross-case refusal (substrate)
--   HC0DJ  the RPC's cross-case refusal (door, nicer pt-BR message)
-- =============================================================================

-- E1 — condition 1: BOTH columns carry a real FK to documents(id).
select is(
  (select count(*)::int from pg_constraint con
     join pg_class src on src.oid = con.conrelid
     join pg_class tgt on tgt.oid = con.confrelid
    where con.contype = 'f' and tgt.relname = 'documents'
      and src.relname in ('ethics_decision_details', 'ethics_notifications')),
  2,
  'DM3·E1 ⭐ both ethics seam columns carry a REAL FK to documents(id) (condition 1)');

-- A second case's document, for the cross-case probes.
insert into public.documents (id, home_resource_id, title, kind, status, created_by)
values ('dd300000-0000-0000-0000-0000000000e2',
        'd0000000-0000-0000-0000-0000000000c2',
        'Fixture E · a DIFFERENT case''s document', 'registro', 'active',
        '00000000-0000-0000-0000-000000000002');

select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');

-- E1b ⭐ — conditions 2+3: the door ACCEPTS a same-case document. This is the
-- inverse of 328 K8c, which pinned the DM1 fail-closed refusal and which DM3
-- removes. RED pre-M7: HC0DM.
select lives_ok(
  $q$ select public.issue_ethics_notification(
        'ca000000-0000-0000-0000-0000000000e1', 'decision_notice', 'email',
        null, null, null, 'dd300000-0000-0000-0000-0000000000e1') $q$,
  'DM3·E1b ⭐ issue_ethics_notification ACCEPTS a same-case document (the 328 K8c refusal is lifted — conditions 2+3)');

-- E3 ⭐ — the DOOR refuses a document belonging to ANOTHER case.
select throws_ok(
  $q$ select public.issue_ethics_notification(
        'ca000000-0000-0000-0000-0000000000e1', 'decision_notice', 'email',
        null, null, null, 'dd300000-0000-0000-0000-0000000000e2') $q$,
  'HC0DJ', null,
  'DM3·E3 ⭐ the RPC refuses linking a document that belongs to a DIFFERENT case');

select set_config('request.jwt.claims', '', true);

-- E2 ⭐ — and the SUBSTRATE refuses it independently, with a distinct code.
-- Direct DML bypasses the RPC entirely, so this neutralizes the door barrier by
-- going around it rather than by editing it — one twin per barrier (the DM2
-- "two codes, one barrier" finding).
select throws_ok(
  $q$ insert into public.ethics_notifications
        (case_id, notification_type, delivery_method, status, related_document_id)
      values ('ca000000-0000-0000-0000-0000000000e1', 'decision_notice', 'email',
              'sent', 'dd300000-0000-0000-0000-0000000000e2') $q$,
  'HC0DI', null,
  'DM3·E2 ⭐ the TRIGGER refuses a cross-case link independently of the RPC (distinct code HC0DI)');

-- E5 ⭐ — condition 5: set_ethics_decision_details ACCEPTS and PERSISTS the
-- decision-letter id. Condition 1 without this would give the column a real FK
-- while leaving it unwritable at every layer — "a column pointing at documents
-- nothing can create", the same defect wearing a constraint.
-- RED pre-M7: 42883, the parameter does not exist.
insert into public.case_decisions (id, case_id, decision_type, summary_md, status)
values ('cd300000-0000-0000-0000-0000000000e1',
        'ca000000-0000-0000-0000-0000000000e1', 'sancao', 'Resumo', 'draft');

select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select lives_ok(
  $q$ select public.set_ethics_decision_details(
        'cd300000-0000-0000-0000-0000000000e1', null, null, null, false, null,
        false, null, null, true, null,
        'dd300000-0000-0000-0000-0000000000e1') $q$,
  'DM3·E5a condition 5: set_ethics_decision_details ACCEPTS p_decision_letter_document_id');
select is(
  (select decision_letter_document_id from public.ethics_decision_details
    where decision_id = 'cd300000-0000-0000-0000-0000000000e1'),
  'dd300000-0000-0000-0000-0000000000e1'::uuid,
  'DM3·E5 ⭐ …and PERSISTS it (the round trip, not just the signature)');
select set_config('request.jwt.claims', '', true);

-- E6 — the DROP+CREATE did not silently restore the default ACL. Asserted on the
-- 12-ARG identity, so it cannot be satisfied by the surviving 11-arg overload.
select is(
  (select p.pronargs::text || '|' ||
          has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || '|' ||
          has_function_privilege('public', p.oid, 'EXECUTE')::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_ethics_decision_details'),
  '12|true|false',
  'DM3·E6 ⭐ set_ethics_decision_details is the 12-arg identity, authenticated-granted, NOT PUBLIC (the re-GRANT after DROP+CREATE)');

-- E4 ⭐ — you may not link what you cannot read. The document is raised to an
-- ENFORCING label and the coordinator's clearance is removed, so the D15
-- ceiling — not the same-case rule — is the barrier under test.
-- ⚠ ORDERED LAST ON PURPOSE: this probe DESTROYS the coordinator's clearance,
-- and anything after it inherits a caller who can no longer read the letter.
-- Placed earlier, it silently broke E5 (which then failed with HC0DJ for the
-- fixture's reason, not the product's) — a fixture whose side effect becomes
-- the next test's premise.
update public.documents set confidentiality_level = 'legal_privileged'
 where id = 'dd300000-0000-0000-0000-0000000000e1';
delete from public.case_access_grants
 where case_id = 'ca000000-0000-0000-0000-0000000000e1'
   and principal_id = '00000000-0000-0000-0000-000000000002';

select is(
  app.can_read_document('dd300000-0000-0000-0000-0000000000e1',
                        '00000000-0000-0000-0000-000000000002'),
  false,
  'DM3·E4a PRECONDITION: with clearance removed the coordinator genuinely cannot READ the letter (so E4 tests the read gate, not the case rule)');

select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select throws_ok(
  $q$ select public.issue_ethics_notification(
        'ca000000-0000-0000-0000-0000000000e1', 'decision_notice', 'email',
        null, null, null, 'dd300000-0000-0000-0000-0000000000e1') $q$,
  'HC0DJ', null,
  'DM3·E4 ⭐ a coordinator who cannot READ the letter cannot LINK it either (no leak by reference)');
select set_config('request.jwt.claims', '', true);

select * from finish();
rollback;
