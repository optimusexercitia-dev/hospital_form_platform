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
select plan(7);

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

select * from finish();
rollback;
