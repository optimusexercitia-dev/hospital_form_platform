-- =============================================================================
-- 329 — DM2·S2 document command layer keystones (ADR 0114 D8/D9/D10/D11;
-- decisions ADR 0118). Doors: begin/finalize upload + service-only completion,
-- open_document_version (THE byte corridor), classification, disposition +
-- service-only disposal completion, holds, soft-delete, and the
-- dispose_case_phi document arm (FUP-DM1-DISPOSE).
--
-- ⭐ RED-FIRST (the S1-adapted ladder): authored and run BEFORE
-- 20260924000300 existed — every door pin red `caught: 42883` (function does
-- not exist); after part 1, the open-door pins stayed red 42883 until part 2.
-- Quoted in the S2 record. FINDING 2 (per-state twins, one neutralization per
-- serving-state check, each in its own rolled-back txn) is executed in the
-- twin harness, not this file.
--
-- Fixtures are hermetic to this txn (rollback at end). Personas: chefe.ccih
-- …0002 (staff_admin CCIH), staff1 …0003 (staff CCIH; reads Caso 0001 via a
-- real content source), chefe.farm …0005 (foreign staff_admin), platform …b0.
-- =============================================================================

begin;
-- 3 preconditions + S6 + F3 + U18 + O16 + D5 + H7 + C3 + W5 = 66.
select plan(66);

-- Flags: the module flag flips ON for this txn; the rest asserted as state.
update app.feature_flags set enabled = true where key = 'documents_foundation';
select is(app.feature_enabled('documents_foundation'), true,
  'precondition: documents_foundation ON for this txn');
select is(app.feature_enabled('audit_trail'), true,
  'precondition: audit_trail ON (audit-exactness pins)');
select is(app.feature_enabled('case_patient'), true,
  'precondition: case_patient ON (dispose-wiring pins)');

-- =============================================================================
-- S — structural: ten doors, DEFINER, pinned path; ACL split user vs service.
-- =============================================================================
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.proconfig::text ~ 'search_path=app, public, pg_catalog'
      and p.proname in ('begin_document_upload', 'finalize_document_upload',
                        'open_document_version', 'set_document_confidentiality',
                        'request_document_disposition', 'place_document_hold',
                        'release_document_hold', 'soft_delete_document',
                        'complete_document_upload_verification', 'complete_document_disposal')),
  10, 'S1 all ten command doors are SECURITY DEFINER with the pinned search_path');
select is(has_function_privilege('authenticated',
  'public.begin_document_upload(text,uuid,text,text,text,uuid,text,text,bigint,text,date)', 'EXECUTE'),
  true, 'S2 authenticated may EXECUTE begin');
select is(has_function_privilege('authenticated', 'public.open_document_version(uuid)', 'EXECUTE'),
  true, 'S3 authenticated may EXECUTE open');
select is(has_function_privilege('authenticated',
  'public.complete_document_upload_verification(uuid,text,boolean)', 'EXECUTE'),
  false, 'S4 the verification completion door is SERVICE-ROLE ONLY');
select is(has_function_privilege('authenticated', 'public.complete_document_disposal(uuid)', 'EXECUTE'),
  false, 'S5 the disposal completion door is SERVICE-ROLE ONLY');
select is(has_function_privilege('anon',
  'public.begin_document_upload(text,uuid,text,text,text,uuid,text,text,bigint,text,date)', 'EXECUTE'),
  false, 'S6 anon holds nothing');

-- =============================================================================
-- F — FINDING 1(a): the registry lost its document arm; the door is the ONLY
-- minter of the document-open verb.
-- =============================================================================
select ok(
  (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = '_audit_access_authorized')
    !~ 'document\.opened',
  'F1 the access-registry dispatcher no longer carries the document arm');
-- The ENTITLED home staff_admin (not a stranger — §7.1 wrong-arm discipline):
-- the refusal must be the ALLOWLIST, not authorization.
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select throws_ok(
  $q$ select public.log_audit_access('document.opened', 'document',
        'd0000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-0000000000a1',
        'probe F2') $q$,
  '23514', null,
  'F2 the document verb is not registry-dispatchable even for an entitled reader');
select is((select count(*)::int from public.audit_log where action = 'document.opened'),
  0, 'F3 zero registry-minted document-open rows exist');

-- =============================================================================
-- U — the upload machine on seeded Caso 0001 (CCIH; phi tier by home rule).
-- =============================================================================
-- Authority: a case READER who is not a writer, and a foreign staff_admin,
-- get the SAME not-found (absence ≡ denial).
select test_helpers.claims_for('00000000-0000-0000-0000-000000000003'::uuid, false, 'staff');
select throws_ok(
  $q$ select public.begin_document_upload('case', 'd0000000-0000-0000-0000-0000000000c1',
        'Documento 329 negado') $q$,
  'P0002', null, 'U1 a case reader who is not a writer cannot begin (oracle-killed)');
select test_helpers.claims_for('00000000-0000-0000-0000-000000000005'::uuid, false, 'staff_admin');
select throws_ok(
  $q$ select public.begin_document_upload('case', 'd0000000-0000-0000-0000-0000000000c1',
        'Documento 329 negado') $q$,
  'P0002', null, 'U2 a foreign staff_admin gets the byte-identical refusal');

-- The home staff_admin begins: hints validated, ids returned.
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select throws_ok(
  $q$ select public.begin_document_upload('case', 'd0000000-0000-0000-0000-0000000000c1',
        'Documento grande', null, null, null, 'a.pdf', 'application/pdf', 999999999) $q$,
  'HC0DF', null, 'U3 an oversized declared hint is refused before any row is minted');
select throws_ok(
  $q$ select public.begin_document_upload('case', 'd0000000-0000-0000-0000-0000000000c1',
        'Documento exe', null, null, null, 'a.exe', 'application/x-msdownload', 100) $q$,
  'HC0DG', null, 'U4 a disallowed MIME hint is refused');
select throws_ok(
  $q$ select public.begin_document_upload('meeting',
        (select id from public.securable_resources
          where resource_type = 'meeting'
            and commission_id = 'a0000000-0000-0000-0000-0000000000a1' limit 1),
        'Documento privilegiado em reunião', null, 'legal_privileged') $q$,
  'HC0D6', null, 'U5 the S1 seam holds THROUGH the door (enforcing label, meeting home)');

create temp table u1 on commit drop as
  select public.begin_document_upload('case', 'd0000000-0000-0000-0000-0000000000c1',
    'Documento 329 (caso)', 'fixture', null, null, 'ata.pdf', 'application/pdf', 100,
    'ata', '2026-08-01') as r;
select is((select count(*)::int from u1 where (r->>'document_id') is not null
             and (r->>'upload_session_id') is not null), 1,
  'U6 begin returns the id set');
select is(
  (select f.storage_bucket || '|' || f.sensitivity_tier from public.file_objects f
    where f.id = (select (r->>'file_object_id')::uuid from u1)),
  'documents-phi|phi',
  'U7 tier is SERVER-derived from the case home (phi), bucket from tier');
select ok(
  (select f.storage_path ~ ('^0c000000-0000-0000-0000-00000000000a/' || f.id::text || '/')
     from public.file_objects f where f.id = (select (r->>'file_object_id')::uuid from u1)),
  'U8 the path is server-generated {org}/{file_object_id}/{gen} — no names, no titles');
select is(
  (select d.kind || '|' || d.occurred_on::text from public.documents d
    where d.id = (select (r->>'document_id')::uuid from u1)),
  'ata|2026-08-01', 'U9 kind + occurred_on persisted (contract amendments 1-2)');
select is(
  (select count(*)::int from public.audit_log
    where action = 'document.upload_started'
      and entity_id = (select (r->>'document_id')::uuid from u1)),
  1, 'U10 begin audits exactly once');

-- Finalize before any PUT: refused, session stays retryable.
select throws_ok(
  $q$ select public.finalize_document_upload(
        (select (r->>'upload_session_id')::uuid from u1)) $q$,
  'HC0D9', null, 'U11 finalize with no object behind the reservation is refused');
select is(
  (select s.state from public.upload_sessions s
    where s.id = (select (r->>'upload_session_id')::uuid from u1)),
  'reserved', 'U12 …and the reservation stays retryable');

-- The PUT lands (fixture: the storage row the API would write).
select set_config('request.jwt.claims', '', true);
insert into storage.objects (bucket_id, name, metadata)
select f.storage_bucket, f.storage_path,
       '{"size": 4321, "mimetype": "application/pdf"}'::jsonb
  from public.file_objects f where f.id = (select (r->>'file_object_id')::uuid from u1);

select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select is(
  (select public.finalize_document_upload((select (r->>'upload_session_id')::uuid from u1))->>'upload_state'),
  'verifying', 'U13 finalize moves the machine to verifying');
select is(
  (select f.size_bytes::text || '|' || f.mime_type from public.file_objects f
    where f.id = (select (r->>'file_object_id')::uuid from u1)),
  '4321|application/pdf',
  'U14 size/MIME are SERVER-derived from the storage row, not the declared hints (D9/F-04)');
select lives_ok(
  $q$ select public.finalize_document_upload((select (r->>'upload_session_id')::uuid from u1)) $q$,
  'U15 finalize is idempotent');

-- Verified completion (as the service context = runner).
select set_config('request.jwt.claims', '', true);
select is(
  (select public.complete_document_upload_verification(
      (select (r->>'upload_session_id')::uuid from u1), repeat('a', 64), true)->>'upload_state'),
  'unscanned_accepted', 'U16 verified completion lands the D9 interim accepted state');
select is(
  (select count(*)::int from public.document_version_files
    where document_version_id = (select (r->>'document_version_id')::uuid from u1)),
  1, 'U17 the binding exists only after verified completion');
select is(
  (select count(*)::int from public.audit_log
    where action = 'document.uploaded'
      and entity_id = (select (r->>'document_id')::uuid from u1)),
  1, 'U18 the upload audit row is exact');

-- =============================================================================
-- O — the byte corridor (part 2). Caso-0001 doc = phi tier; a meeting doc
-- (standard tier) discriminates the D11 floor.
-- =============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-000000000003'::uuid, false, 'staff');
select is(
  (select (public.open_document_version((select (r->>'document_version_id')::uuid from u1))->>'version_number')::int),
  1, 'O1 an entitled non-creator opens the servable version');
select is(
  (select count(*)::int from public.audit_log
    where action = 'document.opened'
      and entity_id = (select (r->>'document_id')::uuid from u1)),
  1, 'O2 exactly ONE open row (D11: phi tier / non-creator)');

-- A standard-tier doc: the meeting home. Full walk.
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
create temp table u2 on commit drop as
  select public.begin_document_upload('meeting',
    (select id from public.securable_resources
      where resource_type = 'meeting'
        and commission_id = 'a0000000-0000-0000-0000-0000000000a1' limit 1),
    'Documento 329 (reuniao)', null, null, null, 'pauta.pdf', 'application/pdf', 100,
    'pauta') as r;
select set_config('request.jwt.claims', '', true);
insert into storage.objects (bucket_id, name, metadata)
select f.storage_bucket, f.storage_path, '{"size": 99, "mimetype": "application/pdf"}'::jsonb
  from public.file_objects f where f.id = (select (r->>'file_object_id')::uuid from u2);
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select lives_ok(
  $q$ select public.finalize_document_upload((select (r->>'upload_session_id')::uuid from u2)) $q$,
  'O3 meeting-doc finalize proceeds');
select set_config('request.jwt.claims', '', true);
select lives_ok(
  $q$ select public.complete_document_upload_verification(
        (select (r->>'upload_session_id')::uuid from u2), repeat('b', 64), true) $q$,
  'O4 meeting-doc completion proceeds (standard tier)');

select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select lives_ok(
  $q$ select public.open_document_version((select (r->>'document_version_id')::uuid from u2)) $q$,
  'O5 the creator opens the standard-tier document');
select is(
  (select count(*)::int from public.audit_log
    where action = 'document.opened'
      and entity_id = (select (r->>'document_id')::uuid from u2)),
  0, 'O6 a same-user STANDARD open is NOT logged (the floor exactly, no expansion)');
select test_helpers.claims_for('00000000-0000-0000-0000-000000000003'::uuid, false, 'staff');
select lives_ok(
  $q$ select public.open_document_version((select (r->>'document_version_id')::uuid from u2)) $q$,
  'O7 a plain member opens the meeting document (member arm)');
select is(
  (select count(*)::int from public.audit_log
    where action = 'document.opened'
      and entity_id = (select (r->>'document_id')::uuid from u2)),
  1, 'O8 the non-creator standard open IS logged');

-- Gate BEFORE record (MINOR-2 discharged) + the noun rule at the corridor.
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b0'::uuid, true);
select throws_ok(
  $q$ select public.open_document_version((select (r->>'document_version_id')::uuid from u1)) $q$,
  'P0002', null, 'O9 platform_admin is refused at the corridor (noun rule; denial = absence)');
select is(
  (select count(*)::int from public.audit_log
    where action = 'document.opened'
      and entity_id = (select (r->>'document_id')::uuid from u1)),
  1, 'O10 …and the refusal minted NOTHING (gate before record)');

-- Per-state refusals.
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
create temp table u3 on commit drop as
  select public.begin_document_upload('meeting',
    (select id from public.securable_resources
      where resource_type = 'meeting'
        and commission_id = 'a0000000-0000-0000-0000-0000000000a1' limit 1),
    'Documento 329 v2', null, null, (select (r->>'document_id')::uuid from u2),
    'v2.pdf', 'application/pdf', 100) as r;
select is((select (r->>'document_version_id') is not null from u3), true,
  'O11 a second version on an existing document mints (version 2 path)');
select throws_ok(
  $q$ select public.open_document_version((select (r->>'document_version_id')::uuid from u3)) $q$,
  'HC0D8', null, 'O12 an UNBOUND (never-finalized) version is not servable');

select lives_ok(
  $q$ select public.soft_delete_document((select (r->>'document_id')::uuid from u2)) $q$,
  'O13 the staff_admin soft-deletes the meeting document');
select throws_ok(
  $q$ select public.open_document_version((select (r->>'document_version_id')::uuid from u2)) $q$,
  'HC0D8', null, 'O14 a soft-deleted document is not servable');

select lives_ok(
  $q$ select public.request_document_disposition(
        (select (r->>'document_id')::uuid from u1), 'entered_in_error') $q$,
  'O15 the staff_admin requests disposition on the case document');
select throws_ok(
  $q$ select public.open_document_version((select (r->>'document_version_id')::uuid from u1)) $q$,
  'HC0DD', null, 'O16 disposition blocks reads IMMEDIATELY (D10 — the F-02 class dies)');

-- =============================================================================
-- D — disposal completion: verify-absence, provisional retention, Art. 18.
-- =============================================================================
select set_config('request.jwt.claims', '', true);
-- Gate ORDER is the point of D1/D2 (caught red-first: the first draft expected
-- verify-absence first): retention refuses BEFORE anything instructs a byte
-- deletion — a retention-blocked file must never lose its bytes — and only a
-- retention-passing file reaches the verify-absence step.
select throws_ok(
  $q$ select public.complete_document_disposal((select (r->>'file_object_id')::uuid from u1)) $q$,
  'HC0DR', null, 'D1 a PROVISIONAL retention policy refuses disposal FIRST, bytes untouched (ADR 0116 §7)');
update public.file_objects set disposal_reason_category = 'subject_request'
 where id = (select (r->>'file_object_id')::uuid from u1);
select throws_ok(
  $q$ select public.complete_document_disposal((select (r->>'file_object_id')::uuid from u1)) $q$,
  'HC0D9', null, 'D2 the Art. 18 lane passes retention, then verify-absence refuses while the object exists');
-- Fixture stand-in for the Storage-API delete the TS job performs, via the
-- protect trigger's own sanctioned txn-local GUC (raw deletes stay blocked
-- everywhere else; set_config(..., true) dies with this txn's rollback).
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects o
 where (o.bucket_id, o.name) in
   (select f.storage_bucket, f.storage_path from public.file_objects f
     where f.id = (select (r->>'file_object_id')::uuid from u1));
select set_config('storage.allow_delete_query', 'false', true);
select lives_ok(
  $q$ select public.complete_document_disposal((select (r->>'file_object_id')::uuid from u1)) $q$,
  'D3 the Art. 18 lane proceeds under provisional retention once absence is verified (FINDING 4)');
select is(
  (select count(*)::int from public.audit_log
    where action = 'document.retention_override'
      and entity_id = (select (r->>'document_id')::uuid from u1)),
  1, 'D4 …with the audited override marker (the PO''s reversal seam)');
select is(
  (select d.status || '|' || d.title from public.documents d
    where d.id = (select (r->>'document_id')::uuid from u1)),
  'disposed|[removido]', 'D5 document closure: disposed + D12 redaction');

-- =============================================================================
-- H — legal holds: authority, disposal/soft-delete blocks, release.
-- =============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
create temp table u4 on commit drop as
  select public.begin_document_upload('case', 'd0000000-0000-0000-0000-0000000000c1',
    'Documento 329 (retencao)', null, null, null, 'h.pdf', 'application/pdf', 100) as r;
select test_helpers.claims_for('00000000-0000-0000-0000-000000000003'::uuid, false, 'staff');
select throws_ok(
  $q$ select public.place_document_hold((select (r->>'document_id')::uuid from u4), 'litigation') $q$,
  '42501', null, 'H1 a plain member cannot place a hold (write-authority audience)');
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
create temp table h1 on commit drop as
  select public.place_document_hold((select (r->>'document_id')::uuid from u4), 'litigation') as hold_id;
select is((select count(*)::int from public.document_legal_holds
            where id = (select hold_id from h1) and released_at is null), 1,
  'H2 the staff_admin places a live hold');
select throws_ok(
  $q$ select public.request_document_disposition((select (r->>'document_id')::uuid from u4), 'other') $q$,
  'HC0D3', null, 'H3 a live hold blocks disposition');
select throws_ok(
  $q$ select public.soft_delete_document((select (r->>'document_id')::uuid from u4)) $q$,
  'HC0D3', null, 'H4 …and soft-delete honors the hold (D10)');
select lives_ok(
  $q$ select public.release_document_hold((select hold_id from h1)) $q$,
  'H5 the staff_admin releases the hold');
select lives_ok(
  $q$ select public.soft_delete_document((select (r->>'document_id')::uuid from u4)) $q$,
  'H6 released, the soft-delete proceeds');
select is(
  (select count(*)::int from public.audit_log
    where action in ('document.hold_placed', 'document.hold_released')
      and entity_id = (select (r->>'document_id')::uuid from u4)),
  2, 'H7 both hold transitions audited exactly once each');

-- =============================================================================
-- C — classification (S1-O2): audited, authority-gated; NO Wave-A UI (lead
-- ruling — command + keystones only).
-- =============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-000000000003'::uuid, false, 'staff');
select throws_ok(
  $q$ select public.set_document_confidentiality(
        (select (r->>'document_id')::uuid from u4), 'legal_privileged') $q$,
  '42501', null, 'C1 a plain member cannot reclassify');
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select lives_ok(
  $q$ select public.set_document_confidentiality(
        (select (r->>'document_id')::uuid from u4), 'legal_privileged') $q$,
  'C2 the staff_admin classifies a case document as privileged (seam-legal home)');
select is(
  (select count(*)::int from public.audit_log
    where action = 'document.classification_changed'
      and entity_id = (select (r->>'document_id')::uuid from u4)),
  1, 'C3 the classification change is audited exactly once');

-- =============================================================================
-- W — the dispose_case_phi document arm (FUP-DM1-DISPOSE discharged).
-- Fresh case so seeded rows are untouched; full document walk; phi file.
-- =============================================================================
select set_config('request.jwt.claims', '', true);
insert into public.cases (id, commission_id, case_number, label, status, created_by)
values ('32900000-0000-0000-0000-0000000000c9', 'a0000000-0000-0000-0000-0000000000a1',
        329001, 'Caso W (fixture 329)', 'pending', '00000000-0000-0000-0000-000000000002');
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
create temp table u5 on commit drop as
  select public.begin_document_upload('case', '32900000-0000-0000-0000-0000000000c9',
    'Laudo do caso W', null, null, null, 'w.pdf', 'application/pdf', 100) as r;
select set_config('request.jwt.claims', '', true);
insert into storage.objects (bucket_id, name, metadata)
select f.storage_bucket, f.storage_path, '{"size": 7, "mimetype": "application/pdf"}'::jsonb
  from public.file_objects f where f.id = (select (r->>'file_object_id')::uuid from u5);
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select lives_ok(
  $q$ select public.finalize_document_upload((select (r->>'upload_session_id')::uuid from u5)) $q$,
  'W1 caso-W upload finalizes');
select set_config('request.jwt.claims', '', true);
select lives_ok(
  $q$ select public.complete_document_upload_verification(
        (select (r->>'upload_session_id')::uuid from u5), repeat('c', 64), true) $q$,
  'W2 caso-W upload completes');
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select lives_ok(
  $q$ select public.dispose_case_phi('32900000-0000-0000-0000-0000000000c9', 'subject_request') $q$,
  'W3 dispose_case_phi runs with the document arm live');
select is(
  (select d.title || '|' || d.status from public.documents d
    where d.id = (select (r->>'document_id')::uuid from u5)),
  '[PHI removido]|disposal_pending',
  'W4 the case document is redacted and enters disposition (D12 + D10)');
select is(
  (select f.disposal_state || '|' || f.disposal_reason_category from public.file_objects f
    where f.id = (select (r->>'file_object_id')::uuid from u5)),
  'disposal_pending|subject_request',
  'W5 the phi-tier file entered the disposal machine on the Art. 18 lane');

select * from finish();
rollback;
