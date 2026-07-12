-- pgTAP — F-cleanup · D11 · G4: controlled_documents.status + controlled_document_versions.status.
-- Migration 20260719000600. NEG = old pt-BR key rejected (absent from the CHECK def);
-- POS = new English key accepted (present) + is the column default. Functional transition
-- coverage (submit → publish → supersede → obsolete, guard HC089, frozen approver set)
-- lives in 200_controlled_documents — it stays green on the same reset.
-- Assertion count: 6

begin;
select plan(6);

-- #8a controlled_documents.status: draft / in_approval / effective / obsolete
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'controlled_documents_status_check')
    like '%in_approval%',
  'G4: controlled_documents CHECK accepts ''in_approval''');
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'controlled_documents_status_check')
    not like '%rascunho%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'controlled_documents_status_check')
    not like '%em_aprovacao%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'controlled_documents_status_check')
    not like '%vigente%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'controlled_documents_status_check')
    not like '%obsoleto%',
  'G4: controlled_documents CHECK no longer lists pt-BR keys (rascunho/em_aprovacao/vigente/obsoleto)');
select col_default_is('public', 'controlled_documents', 'status', 'draft',
  'G4: controlled_documents.status default = ''draft''');

-- #8b controlled_document_versions.status: draft / in_approval / effective / obsolete
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'controlled_document_versions_status_check')
    like '%effective%',
  'G4: controlled_document_versions CHECK accepts ''effective''');
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'controlled_document_versions_status_check')
    not like '%vigente%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'controlled_document_versions_status_check')
    not like '%obsoleto%',
  'G4: controlled_document_versions CHECK no longer lists pt-BR keys (vigente/obsoleto/…)');
select col_default_is('public', 'controlled_document_versions', 'status', 'draft',
  'G4: controlled_document_versions.status default = ''draft''');

select * from finish();
rollback;
