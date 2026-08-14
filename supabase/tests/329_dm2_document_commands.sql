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
-- 66 → 92: S2.8 adds S7–S9 (3 structural) + R0–R9 (19: fixtures-as-pins,
-- authority, hold, happy path, copy integrity, the last-copy differential
-- pair, the vacuity pin, version semantics) + A1–A3 (4: canDelete
-- affordances).
-- 92 → 100: S4 routed bugs — B0–B6 (8: BUG-DM2-001 observable failure,
-- BUG-DM2-003 expired-session contract).
-- 100 → 108: QA r1 P0-1 — the QO·B byte-discrimination cut re-expressed
-- (P0-f1/f2 fixtures + P0a–P0f, the 308 §5.2–5.7 obligation).
-- 108 → 115: R10 (ADR 0118 §10 hardening — the load-bearing sibling
-- predicate `f2.disposal_state = 'none'` pinned, structurally and with the
-- two-pending differential QA r1 named), 7 assertions.
select plan(115);

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
-- Scoped to the probe's entity (F2 deliberately used the CASE id, which no
-- real open ever uses as the document entity) — a GLOBAL zero broke the first
-- time the tester's legitimate E2E opens landed in the append-only log (the
-- pgtap-vs-E2E-leftovers class, caught 2026-08-13: have 10, want 0).
select is((select count(*)::int from public.audit_log
            where action = 'document.opened'
              and entity_id = 'd0000000-0000-0000-0000-0000000000c1'),
  0, 'F3 the refused registry attempt minted nothing (probe-scoped, hermetic)');

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

-- =============================================================================
-- R — S2.8 reclassification (ADR 0118 §10: append-only new-version commit +
-- the EVIDENCE-GATED duplicate-retirement lane) + S7–S9 structural.
-- RED-FIRST: authored before 20260924000500; R1/R2/R4 observed
-- `caught: 42883` pre-migration (doors absent), fixture-bearing pins abort —
-- shape recorded in the S2 record.
-- =============================================================================
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.proconfig::text ~ 'search_path=app, public, pg_catalog'
      and p.proname in ('reclassify_document', 'complete_document_reclassification',
                        'document_delete_affordances')),
  3, 'S7 the three S2.8 doors are SECURITY DEFINER with the pinned search_path');
select is(has_function_privilege('authenticated',
  'public.complete_document_reclassification(uuid,uuid,uuid,text)', 'EXECUTE'),
  false, 'S8 the reclassification completion door is SERVICE-ROLE ONLY');
select is(has_function_privilege('authenticated',
  'public.document_delete_affordances(uuid[])', 'EXECUTE'),
  true, 'S9 authenticated may EXECUTE the canDelete affordance door');

-- Fixture: a fresh, fully-walked phi document on Caso 0001 (u6).
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
create temp table u6 on commit drop as
  select public.begin_document_upload('case', 'd0000000-0000-0000-0000-0000000000c1',
    'Documento 329 (reclassificacao)', null, null, null, 'r.pdf', 'application/pdf', 100) as r;
select set_config('request.jwt.claims', '', true);
insert into storage.objects (bucket_id, name, metadata)
select f.storage_bucket, f.storage_path, '{"size": 11, "mimetype": "application/pdf"}'::jsonb
  from public.file_objects f where f.id = (select (r->>'file_object_id')::uuid from u6);
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select lives_ok(
  $q$ select public.finalize_document_upload((select (r->>'upload_session_id')::uuid from u6)) $q$,
  'R0 u6 upload finalizes');
select set_config('request.jwt.claims', '', true);
select lives_ok(
  $q$ select public.complete_document_upload_verification(
        (select (r->>'upload_session_id')::uuid from u6), repeat('d', 64), true) $q$,
  'R0b u6 upload completes');

-- R1 authority: a non-writer cannot reclassify (the canonical door carries
-- the case-arm exclusion deny — 229 heritage).
select test_helpers.claims_for('00000000-0000-0000-0000-000000000003'::uuid, false, 'staff');
select throws_ok(
  $q$ select public.reclassify_document((select (r->>'document_id')::uuid from u6), 'standard') $q$,
  '42501', null, 'R1 a plain member cannot reclassify');

-- R2 a live hold blocks reclassification (retire-source is a disposal).
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
create temp table rh on commit drop as
  select public.place_document_hold((select (r->>'document_id')::uuid from u6), 'audit') as hold_id;
select throws_ok(
  $q$ select public.reclassify_document((select (r->>'document_id')::uuid from u6), 'standard') $q$,
  'HC0D3', null, 'R2 a live hold blocks reclassification');
select lives_ok(
  $q$ select public.release_document_hold((select hold_id from rh)) $q$,
  'R2b hold released for the happy path');

-- R3 happy begin: append-only successor minted.
--
-- ⚠ GUARDED FIXTURE. The guard is load-bearing for the AUTHZ DOOR SWEEP, not
-- for this suite's own green run — unguarded, this file is green either way.
--
-- This is a raw `create temp table … as select <door>()`, outside any pgTAP
-- wrapper. When the sweep neutralizes `app.can_write_document`, R1 above STOPS
-- refusing (exactly the coverage we want it to have), the document is
-- reclassified early, and this call then raises `arquivo indisponível para
-- reclassificação` with nothing to catch it. The transaction aborted and the
-- file's LAST 41 ASSERTIONS NEVER RAN — measured: 74 of 115. So the harness
-- scored the gate `ERROR (run-shape != baseline)` rather than COVERED, because
-- "a run that did not happen is not evidence" (ADR 0079). A file that NOTICES a
-- neutralization and then dies of noticing scores worse than one that ignores it.
--
-- ⚠ That 41 also collided numerically with 341's old plan of 41 and produced a
-- confident, wrong "341 aborts" diagnosis that two people adopted. The abort was
-- always here.
--
-- The guard catches the error; it does NOT stop the statement mattering. On
-- failure `rr` carries a NULL row, so R3/R3b — which assert over it — still
-- FAIL. The file then reports 115/115 with real failures instead of aborting.
-- Idiom: the 340 B7 `do $$ … exception when others …` fixture guard.
do $g$ begin
  create temp table rr on commit drop as
    select public.reclassify_document((select (r->>'document_id')::uuid from u6), 'standard') as r;
exception when others then
  create temp table rr on commit drop as select null::jsonb as r;
  raise notice '329 R3 fixture guarded (R3/R3b below still evaluate): %', sqlerrm;
end $g$;
select is(
  (select count(*)::int from rr where (r->>'new_document_version_id') is not null
      and (r->>'old_file_object_id') is not null),
  1, 'R3 reclassify mints the successor version + reserved target-tier file');
select is(
  (select f.storage_bucket || '|' || f.sensitivity_tier || '|' || f.upload_state
     from public.file_objects f where f.id = (select (r->>'new_file_object_id')::uuid from rr)),
  'documents-standard|standard|reserved',
  'R3b the new file is reserved in the TARGET bucket (tier override is the door''s purpose)');

-- R4 copy integrity: a wrong sha is refused (service context).
select set_config('request.jwt.claims', '', true);
select throws_ok(
  $q$ select public.complete_document_reclassification(
        (select (r->>'new_document_version_id')::uuid from rr),
        (select (r->>'new_file_object_id')::uuid from rr),
        (select (r->>'old_file_object_id')::uuid from rr),
        repeat('e', 64)) $q$,
  'HC0D9', null, 'R4 a sha mismatch refuses the commit (copy integrity is the gate)');

-- R5 happy completion: plant the copied object, commit with the TRUE sha.
insert into storage.objects (bucket_id, name, metadata)
select f.storage_bucket, f.storage_path, '{"size": 11, "mimetype": "application/pdf"}'::jsonb
  from public.file_objects f where f.id = (select (r->>'new_file_object_id')::uuid from rr);
select lives_ok(
  $q$ select public.complete_document_reclassification(
        (select (r->>'new_document_version_id')::uuid from rr),
        (select (r->>'new_file_object_id')::uuid from rr),
        (select (r->>'old_file_object_id')::uuid from rr),
        repeat('d', 64)) $q$,
  'R5 the commit proceeds with the verified sha');
select is(
  (select count(*)::int from public.document_version_files
    where document_version_id = (select (r->>'new_document_version_id')::uuid from rr)),
  1, 'R5b the successor version is bound (append-only — no binding was edited)');
select is(
  (select f.disposal_state || '|' || f.disposal_reason_category || '|' from public.file_objects f
    where f.id = (select (r->>'old_file_object_id')::uuid from rr)) ||
  (select f2.upload_state from public.file_objects f2
    where f2.id = (select (r->>'new_file_object_id')::uuid from rr)),
  'disposal_pending|duplicate|unscanned_accepted',
  'R5c retire-source entered the SYSTEM-set duplicate lane; the copy inherited servability');

-- R6 Condition 1a: the old copy retires THROUGH provisional retention on
-- EVIDENCE (the live same-sha successor), with the audited override.
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects o
 where (o.bucket_id, o.name) in
   (select f.storage_bucket, f.storage_path from public.file_objects f
     where f.id = (select (r->>'old_file_object_id')::uuid from rr));
select set_config('storage.allow_delete_query', 'false', true);
select lives_ok(
  $q$ select public.complete_document_disposal((select (r->>'old_file_object_id')::uuid from rr)) $q$,
  'R6 duplicate-evidence lane: the old copy retires (a live same-sha sibling survives)');
select is(
  (select count(*)::int from public.audit_log
    where action = 'document.retention_override'
      and entity_id = (select (r->>'document_id')::uuid from u6)
      and metadata->>'lane' = 'duplicate_evidence'),
  1, 'R6b …with the audited override marker naming the evidence lane');

-- R9 version semantics: the retired copy''s version reads disposed; the
-- successor serves.
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select throws_ok(
  $q$ select public.open_document_version((select (r->>'document_version_id')::uuid from u6)) $q$,
  'HC0DD', null, 'R9a the pre-reclassification version reads disposed (content lives in the successor)');
select lives_ok(
  $q$ select public.open_document_version((select (r->>'new_document_version_id')::uuid from rr)) $q$,
  'R9b the successor version serves');

-- R7 Condition 1b — THE LAST-COPY INVARIANT, differentially (same statement,
-- one variable: the sibling''s liveness): the successor now has NO live
-- same-sha sibling — the duplicate lane must refuse it.
select set_config('request.jwt.claims', '', true);
update public.file_objects
   set disposal_state = 'disposal_pending', disposal_reason_category = 'duplicate'
 where id = (select (r->>'new_file_object_id')::uuid from rr);
select throws_ok(
  $q$ select public.complete_document_disposal((select (r->>'new_file_object_id')::uuid from rr)) $q$,
  'HC0DR', null,
  'R7 LAST COPY PROTECTED: with the sibling disposed, the duplicate lane refuses — a servable copy always survives');

-- R8 Condition 2 — the vacuity pin: a NON-duplicated file cannot claim the
-- lane (the exemption is evidence, never a caller''s claim).
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
create temp table u7 on commit drop as
  select public.begin_document_upload('case', 'd0000000-0000-0000-0000-0000000000c1',
    'Documento 329 (unico)', null, null, null, 'u.pdf', 'application/pdf', 100) as r;
select set_config('request.jwt.claims', '', true);
insert into storage.objects (bucket_id, name, metadata)
select f.storage_bucket, f.storage_path, '{"size": 5, "mimetype": "application/pdf"}'::jsonb
  from public.file_objects f where f.id = (select (r->>'file_object_id')::uuid from u7);
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select lives_ok(
  $q$ select public.finalize_document_upload((select (r->>'upload_session_id')::uuid from u7)) $q$,
  'R8a u7 finalizes');
select set_config('request.jwt.claims', '', true);
select lives_ok(
  $q$ select public.complete_document_upload_verification(
        (select (r->>'upload_session_id')::uuid from u7), repeat('f', 64), true) $q$,
  'R8b u7 completes (a UNIQUE sha — no sibling anywhere)');
update public.file_objects
   set disposal_state = 'disposal_pending', disposal_reason_category = 'duplicate'
 where id = (select (r->>'file_object_id')::uuid from u7);
select throws_ok(
  $q$ select public.complete_document_disposal((select (r->>'file_object_id')::uuid from u7)) $q$,
  'HC0DR', null,
  'R8 a non-duplicated file claiming the duplicate lane is REFUSED (evidence-gated, not claim-gated)');

-- ---------------------------------------------------------------------------
-- R10 — ADR 0118 §10's LOAD-BEARING PREDICATE, pinned (QA r1). The last-copy
-- induction holds BECAUSE the sibling arm requires `f2.disposal_state =
-- 'none'`, not `<> 'disposed'`: request_document_disposition marks ALL bound
-- files pending in one statement, so two simultaneously-pending same-sha
-- duplicates must each fail to find a live sibling and BOTH refuse. Under a
-- relaxation to `<> 'disposed'` each pending duplicate satisfies the other's
-- evidence probe and BOTH dispose — the invariant dies while R6/R7/R8 all
-- stay green (R7's dead sibling is `disposed`, which both spellings reject).
-- R10a is the pin that reds on exactly that relaxation; R10b is the
-- differential twin (same statement, one variable: the sibling's
-- disposal_state pending → none, a legal back-arc in the D10 machine).
-- FALSIFIABILITY: proven by the relaxation mutation in a rolled-back txn
-- (R10a red `caught: HC0D9` — the exemption wrongly admitted and fell to the
-- absence check; R10s red; R6/R7/R8 green throughout, QA's exact claim) —
-- output in the DM2 phase record.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
create temp table u8d on commit drop as
  select public.begin_document_upload('case', 'd0000000-0000-0000-0000-0000000000c1',
    'Documento 329 (dupla pendencia)', null, null, null, 'p8.pdf', 'application/pdf', 100) as r;
select set_config('request.jwt.claims', '', true);
insert into storage.objects (bucket_id, name, metadata)
select f.storage_bucket, f.storage_path, '{"size": 7, "mimetype": "application/pdf"}'::jsonb
  from public.file_objects f where f.id = (select (r->>'file_object_id')::uuid from u8d);
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select lives_ok(
  $q$ select public.finalize_document_upload((select (r->>'upload_session_id')::uuid from u8d)) $q$,
  'R10f1 u8 finalizes');
select set_config('request.jwt.claims', '', true);
select lives_ok(
  $q$ select public.complete_document_upload_verification(
        (select (r->>'upload_session_id')::uuid from u8d), repeat('8', 64), true) $q$,
  'R10f2 u8 completes');
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
create temp table rr3 on commit drop as
  select public.reclassify_document((select (r->>'document_id')::uuid from u8d), 'standard') as r;
select is(
  (select count(*)::int from rr3 where (r->>'new_file_object_id') is not null
      and (r->>'old_file_object_id') is not null),
  1, 'R10f3 reclassify mints the same-sha successor pair');
insert into storage.objects (bucket_id, name, metadata)
select f.storage_bucket, f.storage_path, '{"size": 7, "mimetype": "application/pdf"}'::jsonb
  from public.file_objects f where f.id = (select (r->>'new_file_object_id')::uuid from rr3);
select set_config('request.jwt.claims', '', true);
select lives_ok(
  $q$ select public.complete_document_reclassification(
        (select (r->>'new_document_version_id')::uuid from rr3),
        (select (r->>'new_file_object_id')::uuid from rr3),
        (select (r->>'old_file_object_id')::uuid from rr3),
        repeat('8', 64)) $q$,
  'R10f4 the copy commits — old copy now SYSTEM-set disposal_pending/duplicate');

-- BOTH duplicates pending — the state request_document_disposition's
-- one-statement marking produces.
update public.file_objects
   set disposal_state = 'disposal_pending', disposal_reason_category = 'duplicate'
 where id = (select (r->>'new_file_object_id')::uuid from rr3);
select throws_ok(
  $q$ select public.complete_document_disposal((select (r->>'old_file_object_id')::uuid from rr3)) $q$,
  'HC0DR', null,
  'R10a TWO PENDING DUPLICATES: a pending sibling is NOT a live sibling — the lane refuses (disposal_state = ''none'' is load-bearing)');

-- The differential twin: ONE variable flips (the sibling back to 'none' — a
-- legal pending→none back-arc), the same statement admits.
update public.file_objects
   set disposal_state = 'none', disposal_reason_category = null
 where id = (select (r->>'new_file_object_id')::uuid from rr3);
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects o
 where (o.bucket_id, o.name) in
   (select f.storage_bucket, f.storage_path from public.file_objects f
     where f.id = (select (r->>'old_file_object_id')::uuid from rr3));
select set_config('storage.allow_delete_query', 'false', true);
select lives_ok(
  $q$ select public.complete_document_disposal((select (r->>'old_file_object_id')::uuid from rr3)) $q$,
  'R10b …and with the SAME sibling live (none), the same statement admits — the pair isolates the predicate');

-- Resolve-shape: the sibling arm's spelling, comment-stripped, f2-scoped (the
-- document-closure query legitimately uses <> 'disposed' — the alias is the
-- disambiguator).
select ok(
  (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'complete_document_disposal')
    ~ $r$f2\.disposal_state = 'none'$r$,
  'R10s the sibling-liveness spelling is disposal_state = ''none'' (relaxing to <> ''disposed'' reds this pin)');

-- A — the canDelete affordance door (server-computed; holds accounted
-- WITHOUT disclosure).
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
create temp table u8 on commit drop as
  select public.begin_document_upload('case', 'd0000000-0000-0000-0000-0000000000c1',
    'Documento 329 (afford)', null, null, null, 'a.pdf', 'application/pdf', 100) as r;
select is(
  (select can_delete from public.document_delete_affordances(
     array[(select (r->>'document_id')::uuid from u8)])),
  true, 'A1 the home staff_admin holds the delete affordance');
select test_helpers.claims_for('00000000-0000-0000-0000-000000000003'::uuid, false, 'staff');
select is(
  (select can_delete from public.document_delete_affordances(
     array[(select (r->>'document_id')::uuid from u8)])),
  false, 'A2 a plain member does not');
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select lives_ok(
  $q$ select public.place_document_hold((select (r->>'document_id')::uuid from u8), 'litigation') $q$,
  'A3a hold placed');
select is(
  (select can_delete from public.document_delete_affordances(
     array[(select (r->>'document_id')::uuid from u8)])),
  false, 'A3 under a live hold even the staff_admin loses the affordance (no hold disclosure needed)');

-- =============================================================================
-- B — S4 routed bugs (2026-08-13). BUG-DM2-001 (MAJOR): a failed verification
-- must be READER-OBSERVABLE — the completion door now binds the failed file,
-- so the projection derives `failed`, not eternal `pending`. The door-side
-- pins B1–B4 are the substrate half; the browser-side half is tester's
-- test.fail() spec flipping hard. BUG-DM2-003 (MINOR): the expired-marking
-- UPDATE was rolled back by its own RAISE — removed; the refusal stays
-- predicate-based and expiry marking belongs to reconciliation. B5/B6 pin the
-- DECIDED contract (B6 is green-on-both-sides BY DESIGN — it asserts the
-- refusal leaves state 'reserved', replacing the state-column lie; its red
-- half is the tester's spec + the dead line's removal, catalog-diffed).
-- RED-FIRST: B1 `have: 0, want: 1` · B2 `have: 0, want: 1` · B4 caught the
-- unbound message, wanted the failed-state message — observed pre-
-- 20260924000600 and quoted in the S2 record.
-- =============================================================================

select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
create temp table u9 on commit drop as
  select public.begin_document_upload('case', 'd0000000-0000-0000-0000-0000000000c1',
    'Documento 329 (falha)', null, null, null, 'x.pdf', 'application/pdf', 100) as r;
grant select on u9 to authenticated;  -- B2 reads it under set local role (the 191 mtg dialect)
select set_config('request.jwt.claims', '', true);
insert into storage.objects (bucket_id, name, metadata)
select f.storage_bucket, f.storage_path, '{"size": 3, "mimetype": "application/pdf"}'::jsonb
  from public.file_objects f where f.id = (select (r->>'file_object_id')::uuid from u9);
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select lives_ok(
  $q$ select public.finalize_document_upload((select (r->>'upload_session_id')::uuid from u9)) $q$,
  'B0 u9 finalizes (object present)');
select set_config('request.jwt.claims', '', true);
select is(
  (select public.complete_document_upload_verification(
      (select (r->>'upload_session_id')::uuid from u9), '', false)->>'upload_state'),
  'failed', 'B0b the verifier reports the failure (p_verified = false)');

select is(
  (select count(*)::int from public.document_version_files
    where document_version_id = (select (r->>'document_version_id')::uuid from u9)),
  1, 'B1 BUG-DM2-001: the FAILED file is BOUND — the failure is part of the version''s record');
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
set local role authenticated;
select is(
  (select f.upload_state from public.file_objects f
    where f.id = (select (r->>'file_object_id')::uuid from u9)),
  'failed',
  'B2 …and READER-OBSERVABLE: the uploader sees the failed state through the chain (the projection derives `failed`, never eternal `pending`)');
reset role;
select is(
  (select f.disposal_state from public.file_objects f
    where f.id = (select (r->>'file_object_id')::uuid from u9)),
  'none', 'B3 a failed upload is not a disposal (states stay orthogonal)');
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select throws_ok(
  $q$ select public.open_document_version((select (r->>'document_version_id')::uuid from u9)) $q$,
  'HC0D8', 'arquivo indisponível para download',
  'B4 the corridor refuses the failed version on its STATE, no longer as merely unbound (message-matched)');

-- BUG-DM2-003: the expired-session contract, as decided.
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
create temp table u10 on commit drop as
  select public.begin_document_upload('case', 'd0000000-0000-0000-0000-0000000000c1',
    'Documento 329 (expira)', null, null, null, 'y.pdf', 'application/pdf', 100) as r;
select set_config('request.jwt.claims', '', true);
update public.upload_sessions set expires_at = now() - interval '1 minute'
 where id = (select (r->>'upload_session_id')::uuid from u10);
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select throws_ok(
  $q$ select public.finalize_document_upload((select (r->>'upload_session_id')::uuid from u10)) $q$,
  'HC0DE', null, 'B5 an expired reservation refuses finalize (predicate-based — no state write needed)');
select is(
  (select s.state from public.upload_sessions s
    where s.id = (select (r->>'upload_session_id')::uuid from u10)),
  'reserved',
  'B6 the refusal leaves state = reserved BY DESIGN (a refusal that must also persist state fights its own transaction; expiry marking is reconciliation''s sweep)');

-- =============================================================================
-- P0 — QA r1 P0-1: the QO·B byte-discrimination cut, re-expressed in the new
-- corridor (308 §5.2–5.7's named obligation — its tombstone ran green this
-- phase, which was itself a finding). The predecessor contract (M9,
-- 20260911000800): case/interview BYTES require `read_case_deliberation` —
-- conferred by every content source EXCEPT the S7 oversight arm — applied
-- INSIDE the byte door; the KERNEL stays bare can_read_case because the M8
-- half of the contract is that the reviewer KEEPS metadata (titles).
-- Personas: quality.a (…f3) holds content+overview, NO deliberation
-- (catalog-verified); staff1 + chefe both hold deliberation, so no green pin
-- over-narrows. P0e is the OVER-NARROWING control (green in the unmutated
-- run by design — the M8 metadata contract must survive the fix). The QA/
-- tester pre-fix reproduction (P0a caught NO exception, SERVED tier=phi) is
-- recorded in the phase record.
-- FALSIFIABILITY RECORD (executed 2026-08-13 — three mutations in rolled-back
-- txns, each restore verified from the catalog by body-md5; output in the
-- phase record): (A) conjunct -> `and false`: P0a red (caught: no exception),
-- P0d red, P0f red (have 1 want 0). (B) conjunct -> `and true`: P0b + P0c red
-- (died: 42501); the FULL file under B aborts earlier at O1 (an unguarded
-- serving assertion — a cruder member-refusal detector), so B ran as a
-- focused harness replicating up0 + the two pins verbatim. (C) the wrong fix
-- QA warned against — the deliberation conjunct in the KERNEL's case arm:
-- P0e red AND P0a red (caught P0002, wanted 42501 — the message pin
-- discriminates the kernel corridor from the byte cut, which is why the fix
-- lives in the door and not the kernel).
-- =============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
create temp table up0 on commit drop as
  select public.begin_document_upload('case', 'd0000000-0000-0000-0000-0000000000c1',
    'Documento 329 (oversight)', null, null, null, 'q.pdf', 'application/pdf', 100) as r;
grant select on up0 to authenticated;
select set_config('request.jwt.claims', '', true);
insert into storage.objects (bucket_id, name, metadata)
select f.storage_bucket, f.storage_path, '{"size": 9, "mimetype": "application/pdf"}'::jsonb
  from public.file_objects f where f.id = (select (r->>'file_object_id')::uuid from up0);
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select lives_ok(
  $q$ select public.finalize_document_upload((select (r->>'upload_session_id')::uuid from up0)) $q$,
  'P0-f1 oversight fixture finalizes');
select set_config('request.jwt.claims', '', true);
select lives_ok(
  $q$ select public.complete_document_upload_verification(
        (select (r->>'upload_session_id')::uuid from up0), repeat('9', 64), true) $q$,
  'P0-f2 oversight fixture completes (servable)');

-- (5.6/M8) METADATA stays reviewer-visible — the over-narrowing control.
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000f3'::uuid, false);
set local role authenticated;
select is(
  (select count(*)::int from public.documents
    where id = (select (r->>'document_id')::uuid from up0)),
  1, 'P0e M8 SURVIVES: the oversight reviewer still reads the document row (metadata yes)');
reset role;

-- (5.2 serving layer) the reviewer is REFUSED bytes at the corridor.
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000f3'::uuid, false);
select throws_ok(
  $q$ select public.open_document_version((select (r->>'document_version_id')::uuid from up0)) $q$,
  '42501', 'sem autorização para baixar este documento',
  'P0a M9 RE-EXPRESSED: content-without-deliberation (the S7 oversight arm) gets NO bytes');
-- (5.7) …and the refusal minted NOTHING.
select is(
  (select count(*)::int from public.audit_log
    where action = 'document.opened'
      and entity_id = (select (r->>'document_id')::uuid from up0)),
  0, 'P0f the byte refusal mints no audit row (denials raise, never log)');

-- (5.3/5.4) non-vacuity twins: deliberation-holders keep bytes.
select test_helpers.claims_for('00000000-0000-0000-0000-000000000003'::uuid, false, 'staff');
select lives_ok(
  $q$ select public.open_document_version((select (r->>'document_version_id')::uuid from up0)) $q$,
  'P0b a deliberation-holding member (the member arm confers it) is SERVED');
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select lives_ok(
  $q$ select public.open_document_version((select (r->>'document_version_id')::uuid from up0)) $q$,
  'P0c the coordinator is SERVED (the cut removes exactly one class, nothing else)');

-- (5.5 resolve-shape) the conjunct lives in the DOOR body (comment-stripped).
select ok(
  (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'open_document_version')
    ~ 'read_case_deliberation',
  'P0d the deliberation conjunct is the DOOR''s, not a React prop (resolve-shape)');

select * from finish();
rollback;
