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
select plan(22);

-- Flag preconditions asserted, never assumed (authz-handoff §7.3). A missing
-- flag SILENTLY SKIPS keystones — never trust a self-reported total.
select is(app.feature_enabled('documents_foundation'), true,
  'precondition: documents_foundation is ON (the core model must be live)');
select is(app.feature_enabled('controlled_docs'), true,
  'precondition: controlled_docs is ON (section R exercises the domain tables)');

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

select * from finish();
rollback;
