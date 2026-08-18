-- =============================================================================
-- PDF·P1 — printed_documents registry + doors keystones (ADR 0104; plan §2.1;
-- migrations 20260913000000..000300).
--
-- ⭐ KEYSTONES (red-first discipline, ADR 0079 / authz-handoff §7.1): the
-- fail-closed ELSE (t9/t10) and the platform_admin denial family (t17/t18/t31)
-- are this phase's keystones. Written before the door bodies; their
-- non-vacuity is proven by the A33 one-gate-at-a-time neutralization drills
-- (supabase/tests/mutation drill record in the phase report): ELSE→true,
-- authority-line drop per door, supersession-UPDATE drop — each must RED this
-- file. A keystone green over a neutralized gate is a finding, not a pass.
--
-- FIXTURE NOTES:
--  - Every DENIAL mint probe targets an id whose storage object EXISTS, so the
--    only gate between the caller and success is AUTHORITY (clean drill
--    semantics — a missing-object red would be a red for the wrong reason).
--  - Flag preconditions are ASSERTED, not assumed (§7.3) — seed forces both
--    document_printing and audit_trail ON for local/E2E.
--  - The admin persona is bootstrap's is_admin=true profile with is_admin=true
--    claims — the REAL platform_admin shape, not a name (§7.2·4).
-- =============================================================================

begin;
-- 73 -> 75 (DM5·S3): +t51b (the column-list-grant mechanism, re-pointed at a
-- column that still exists, so retiring storage_path does not silently drop
-- this file's only coverage of it), +t51c/+t51d (QA r1 MAJOR-2: the coordinate is
-- DERIVABLE and always was, and what really protects the bytes is the absent SELECT
-- policy — both now executable so the corrected claim cannot rot back)
-- and +t53pre (the non-vacuity control proving
-- the print objects EXIST to be hidden — without it t53 counts zero rows in an
-- empty bucket and passes while proving nothing).
-- 80 -> 85 (ADR 0123): +t77 (the non-vacuity control for the constructed
-- zero-active state) +t78/+t79/+t80 (the D1 superseded keystone, its exit and
-- its differential) +t81 (the D3 structural pin on the mint's row lock).
select plan(88);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid as admin,
         (v->>'sa_x')::uuid  as sa_x,
         (v->>'st_x')::uuid  as st_x,
         (v->>'st_x2')::uuid as st_x2,
         (v->>'sa_y')::uuid  as sa_y,
         (v->>'st_y')::uuid  as st_y,
         (v->>'oa_b')::uuid  as oa_b,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'ver_u')::uuid  as ver_u
  from ctx;
grant select on k to authenticated;

-- Responses: one submitted + one in_progress draft, both created by st_x in X.
create temp table r on commit drop as
  select '00000000-0000-0000-0000-00000000d101'::uuid as resp_sub,
         '00000000-0000-0000-0000-00000000d102'::uuid as resp_prog;
grant select on r to authenticated;
insert into public.responses (id, form_version_id, commission_id, created_by, status, started_at, submitted_at)
select r.resp_sub, k.ver_u, k.comm_x, k.st_x, 'submitted', now(), now() from r, k;
insert into public.responses (id, form_version_id, commission_id, created_by, status, started_at)
select r.resp_prog, k.ver_u, k.comm_x, k.st_x, 'in_progress', now() from r, k;

-- A real meeting in X: the fail-closed probe target (a source its commission
-- members CAN see, whose kind arm is deliberately unregistered in P1).
create temp table m on commit drop as
  select '00000000-0000-0000-0000-00000000d103'::uuid as meet_x;
grant select on m to authenticated;
insert into public.meetings (id, commission_id, meeting_number, title, scheduled_start)
select m.meet_x, k.comm_x, 990001, 'Reunião fixture PDF', now() from m, k;

-- Registry ids + verification credentials.
create temp table d on commit drop as
  select '00000000-0000-0000-0000-00000000d201'::uuid as doc1,  -- st_x mint (resp_sub)
         '00000000-0000-0000-0000-00000000d202'::uuid as doc2,  -- sa_x re-mint (supersession)
         '00000000-0000-0000-0000-00000000d203'::uuid as doc3,  -- denial probes (object EXISTS)
         '00000000-0000-0000-0000-00000000d204'::uuid as doc4,  -- PHI-refusal + Amendment-B probe (NO object)
         '00000000-0000-0000-0000-00000000d205'::uuid as doc5;  -- format/collision probes (resp_prog)
grant select on d to authenticated;
create temp table tk on commit drop as
  select 'PDTOKEN1AAAABBBBCCCCDDDDEEEEFFFFGGGG'::text as tok1,
         'PDTOKEN2AAAABBBBCCCCDDDDEEEEFFFFGGGG'::text as tok2,
         'PDTOKEN3AAAABBBBCCCCDDDDEEEEFFFFGGGG'::text as tok3,
         'PDTOKEN5AAAABBBBCCCCDDDDEEEEFFFFGGGG'::text as tok5,
         'ABCDEF2345'::text as sc1,
         'BCDEFG2345'::text as sc2,
         'CDEFGH2345'::text as sc3,
         'DEFGHJ2345'::text as sc5;
grant select on tk to authenticated;

-- Upload-before-mint (D5 / Amendment B): objects pre-exist for every id that a
-- mint may legitimately reach — INCLUDING the denial probes (see header).
--
-- ⭐ FORCED FIXTURE CHANGE 1/2 (DM5·S3, migrations 20260927000310/000340) — the
-- COORDINATE MOVED and `metadata` became load-bearing.
--   was: ('printed-documents', 'std/<id>.pdf'), no metadata
--   now: ('documents-standard', 'printed/<id>.pdf'), metadata REQUIRED
-- Three things changed under this fixture, none of them optional:
--   • ADR 0120 D7 retires `printed_documents.storage_path`; a print's bytes are
--     a `file_objects` row, and `file_objects_bucket_check` admits ONLY
--     `documents-standard` / `documents-phi`.
--   • The tier stopped being a path prefix and became the BUCKET, CHECK-pinned
--     by `file_objects_bucket_from_tier` — so the path lost its phi/std branch.
--   • The mint now derives `size_bytes` / `mime_type` from
--     `storage.objects.metadata` (the ADR 0114 D9 server-derived rule the
--     `finalize_document_upload` corridor already follows), so an object with a
--     NULL metadata is indistinguishable from an absent one and the mint
--     refuses HC0D3.
-- ⭐ The pre-move coordinate was an UNINTENDED POSITIVE CONTROL: left
-- unmodified, this fixture made every mint raise exactly HC0D3, which is direct
-- evidence that the coordinate really moved AND that the door really checks it.
-- Recorded because it is stronger than a control I would have had to construct.
-- Paths come from `app.printed_rendition_storage_path` — the single SQL
-- derivation authority — never re-spelled here, so this fixture cannot drift
-- from the door.
insert into storage.objects (bucket_id, name, metadata)
select 'documents-standard', app.printed_rendition_storage_path(doc1),
       jsonb_build_object('size', 1024, 'mimetype', 'application/pdf') from d;
insert into storage.objects (bucket_id, name, metadata)
select 'documents-standard', app.printed_rendition_storage_path(doc2),
       jsonb_build_object('size', 1024, 'mimetype', 'application/pdf') from d;
insert into storage.objects (bucket_id, name, metadata)
select 'documents-standard', app.printed_rendition_storage_path(doc3),
       jsonb_build_object('size', 1024, 'mimetype', 'application/pdf') from d;
insert into storage.objects (bucket_id, name, metadata)
select 'documents-standard', app.printed_rendition_storage_path(doc5),
       jsonb_build_object('size', 1024, 'mimetype', 'application/pdf') from d;

-- ⛔ WHY EXPECTED COORDINATES ARE PRECOMPUTED HERE, AS THE OWNER.
-- `app.printed_rendition_storage_bucket/_path` are the single SQL derivation
-- authority, and migration 20260927000310 REVOKES their EXECUTE from PUBLIC and
-- grants it to `postgres` only — ADR 0120 D12 requires the resolver family to be
-- unreachable by a client, enforced at the ACL and not merely by `app` not being
-- exposed. So an assertion running under `set local role authenticated` CANNOT
-- call them ("permission denied for function"), which is the correct behaviour
-- and was observed. Expected values are therefore computed once here and read
-- from a temp table inside the authenticated blocks.
-- ⛔ The alternative — granting EXECUTE to `authenticated` — is rejected: that
-- would be a testability requirement driving an authorization change, which is
-- exactly what ADR 0120 D12 refused when it declined to widen the print arm.
create temp table xp on commit drop as
  select app.printed_rendition_storage_bucket(false) as std_bucket,
         app.printed_rendition_storage_path(doc2) as p2
  from d;
grant select on xp to authenticated;

-- ⭐ DM5·S3 — WHY THIS HELPER EXISTS, AND IT IS THE MOST IMPORTANT NOTE IN THIS
-- FILE. Migration 20260927000310 adds `trg_guard_printed_document_binding`, a
-- BEFORE INSERT trigger on `printed_documents` that refuses (HC0DA) unless the
-- row's bound `printed_pdf` file object sits at the canonically derived
-- coordinate. That trigger is a NEW SIBLING LOCK standing in front of every
-- direct-DML probe in this file, and BEFORE INSERT triggers fire BEFORE
-- constraint checks.
--   So t73, which exists to prove that `printed_documents_one_active` is
--   TABLE-LEVEL law, would now be answered by the TRIGGER instead of by the
--   partial unique index — passing while measuring the wrong lock. That is the
--   sibling-lock vacuity this phase keeps paying for, and it would have been
--   invisible: the test still goes green, with the right SQLSTATE nowhere in
--   sight but a plausible one in its place.
-- This helper builds a VALID D11 chain so a probe can reach the lock it actually
-- names. `p_path` exists so t65 can present a deliberately WRONG coordinate and
-- reach the trigger ON PURPOSE.
create or replace function pg_temp.pd_chain(
  p_pd_id uuid, p_home uuid, p_uid uuid, p_path text default null
) returns uuid                                  -- the document_version_id
language plpgsql as $fn$
declare
  v_doc uuid := gen_random_uuid();
  v_ver uuid := gen_random_uuid();
  v_file uuid := gen_random_uuid();
begin
  insert into public.documents
    (id, home_resource_id, title, kind, status, created_by)
  values (v_doc, p_home, 'Documento emitido (PDF)', 'printed_rendition', 'active', p_uid);
  insert into public.document_versions (id, document_id, version_number, created_by)
  values (v_ver, v_doc, 1, p_uid);
  insert into public.file_objects
    (id, storage_bucket, storage_path, sensitivity_tier, created_by)
  values (v_file, 'documents-standard',
          coalesce(p_path, app.printed_rendition_storage_path(p_pd_id)),
          'standard', p_uid);
  insert into public.document_version_files
    (document_version_id, file_object_id, rendition_kind)
  values (v_ver, v_file, 'printed_pdf');
  return v_ver;
end $fn$;

-- ── 0. Preconditions (asserted, never assumed — §7.3) ────────────────────────
select is(app.feature_enabled('document_printing'), true,
  't1 PRECONDITION: document_printing flag ON in this environment (seed forces it)');
select is(app.feature_enabled('audit_trail'), true,
  't2 PRECONDITION: audit_trail ON — the audit-row assertions below can observe writes');
select is(app.can_view_printed_document('form_response', (select resp_sub from r), (select st_x from k)), true,
  't3 dispatch: creator sees his own submitted response (own-row arm)');
select is(app.can_view_printed_document('form_response', (select resp_sub from r), (select sa_x from k)), true,
  't4 dispatch: staff_admin sees a submitted response of his commission');
select is(app.can_view_printed_document('form_response', (select resp_sub from r), (select st_x2 from k)), false,
  't5 CONTROL: same-commission plain staff (non-creator) does NOT see it — the discriminating property is real');
select is(app.can_view_printed_document('form_response', (select resp_prog from r), (select st_x from k)), true,
  't6 dispatch: creator sees his own in_progress draft (RASCUNHO prints are legal, D7)');
-- QO·B (ADR 0100 D12) INVERTED, 2026-08-08. This asserted the OPPOSITE until the
-- org_admin content wall landed: it mirrored responses_admin_all, which QO·B M1
-- DELETED, and M2 removed the matching is_tenancy_admin_of_for arm from
-- can_view_printed_document's form_response leg. The mirror moved with the mirrored.
-- Discriminating power is NOT lost: t3 (creator) and t4 (staff_admin on a submitted
-- response) remain live positives, so a broken helper still reds this file.
select is(app.can_view_printed_document('form_response', (select resp_sub from r), (select oa_b from k)), false,
  't7 ⭐ QO·B WALL: org_admin is DENIED the form_response arm — the tenancy admin holds administration and PHI-free aggregates, never row-level response content (D12)');

-- ── 1. Fail-closed ELSE ⭐ ───────────────────────────────────────────────────
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.meetings where id = (select meet_x from m)), 1,
  't8 PRECONDITION: sa_x reads the meeting row itself under RLS — the meeting fixture is real');
reset role;
-- P2 REPOINT (lead-acked): P1's t9 asserted the meeting arm was UNREGISTERED —
-- that specimen INVERTS when M-B3 lands (the vacuity-control trap: a keystone
-- anchored on a state a later phase legitimately changes). The fail-closed
-- keystone now lives in 313 on REAL case/interview fixtures; t9 becomes a
-- meeting-arm DENY leg (foreign-commission staff).
select is(app.can_view_printed_document('meeting', (select meet_x from m), (select st_y from k)), false,
  't9 meeting arm: foreign-commission staff is DENIED (the arm delegates to can_reach_meeting, which has no foreign arm)');
select is(app.can_view_printed_document('bogus_kind', (select resp_sub from r), (select st_x from k)), false,
  't10 ⭐ FAIL-CLOSED: an unknown kind returns false, never an error, never true');

-- ── 2. Mint happy path (st_x over his submitted response) ────────────────────
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  $$select public.mint_printed_document(
      (select doc1 from d), 'form_response', (select resp_sub from r),
      'form_response', 1, repeat('ab', 32),
      (select tok1 from tk), (select sc1 from tk), false)$$,
  't11 mint: the creator mints his own submitted response (mint right = source visibility, NOT admin-gated)');
reset role;
-- ⭐ FORCED FIXTURE CHANGE 2/2 (DM5·S3) — `printed_documents.storage_path` is
-- RETIRED (ADR 0120 D7), so this assertion's subject moved into the substrate.
-- The CLAIM is preserved verbatim — "the row is active and the coordinate is
-- DERIVED from the row identity" — and is now stronger, because reaching the
-- coordinate at all requires the whole D11 chain to exist:
--   printed_documents -> document_version_id -> document_version_files
--   (rendition_kind = 'printed_pdf') -> file_objects
-- The expected value comes from `app.printed_rendition_storage_*`, the single
-- derivation authority the door itself uses, so this cannot drift from it.
select is(
  (select p.status || '|' || f.storage_bucket || '|' || f.storage_path
     from public.printed_documents p
     join public.document_version_files vf
       on vf.document_version_id = p.document_version_id
      and vf.rendition_kind = 'printed_pdf'
     join public.file_objects f on f.id = vf.file_object_id
    where p.id = (select doc1 from d)),
  'active|' || app.printed_rendition_storage_bucket(false) || '|'
            || app.printed_rendition_storage_path((select doc1 from d)),
  't12 mint: row is active and the coordinate is DERIVED from the row identity, reached through the D11 chain (deviation 2)');
select is((select minted_by from public.printed_documents where id = (select doc1 from d)),
  (select st_x from k),
  't13 mint: minted_by records the actor');
select is((select count(*)::int from public.audit_log
            where action = 'document.minted' and entity_id = (select doc1 from d)), 1,
  't14 audit: document.minted emitted exactly once (D12)');

-- ── 3. Denials — authority is the ONLY gate (objects pre-exist for doc3) ─────
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  $$select public.mint_printed_document(
      (select doc3 from d), 'form_response', (select resp_sub from r),
      'form_response', 1, repeat('ab', 32),
      (select tok3 from tk), (select sc3 from tk), false)$$,
  '42501', null,
  't15 mint denied: same-commission staff who cannot VIEW the response cannot mint from it');
reset role;
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select throws_ok(
  $$select public.mint_printed_document(
      (select doc3 from d), 'form_response', (select resp_sub from r),
      'form_response', 1, repeat('ab', 32),
      (select tok3 from tk), (select sc3 from tk), false)$$,
  '42501', null,
  't16 mint denied: foreign-commission staff');
reset role;
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select throws_ok(
  $$select public.mint_printed_document(
      (select doc3 from d), 'form_response', (select resp_sub from r),
      'form_response', 1, repeat('ab', 32),
      (select tok3 from tk), (select sc3 from tk), false)$$,
  '42501', null,
  't17 ⭐ platform_admin may NOT mint (ADR 0104 D11 noun rule — no is_admin arm anywhere in the dispatch)');
select is((select count(*)::int from public.printed_documents), 0,
  't18 ⭐ platform_admin reads ZERO registry rows (table is non-empty — the zero discriminates)');
reset role;
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.printed_documents), 0,
  't19 RLS: a non-viewer member reads zero rows');
reset role;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from (
    select id, source_kind, source_id, commission_id, template_key, template_version,
           content_hash, contains_phi, status, verification_short_code,
           minted_by, minted_at, superseded_at, revoked_reason_class, revoked_at
    from public.printed_documents where id = (select doc1 from d)) s), 1,
  't20 RLS + GRANTs: the viewer reads his row through EVERY granted column (a missing column GRANT reds this with 42501)');
reset role;

-- ── 4. Supersession (sa_x re-mints the same source+template) ─────────────────
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$select public.mint_printed_document(
      (select doc2 from d), 'form_response', (select resp_sub from r),
      'form_response', 1, repeat('cd', 32),
      (select tok2 from tk), (select sc2 from tk), false)$$,
  't21 supersession: re-minting the same (source, template) succeeds for a staff_admin viewer');
reset role;
select is(
  (select status || '|' || (superseded_at is not null)::text
     from public.printed_documents where id = (select doc1 from d)),
  'superseded|true',
  't22 supersession: the prior active flipped to superseded WITH its timestamp, inside the mint transaction (D6)');
select is((select count(*)::int from public.printed_documents
            where source_kind = 'form_response' and source_id = (select resp_sub from r)
              and template_key = 'form_response' and status = 'active'), 1,
  't23 supersession: exactly ONE active print per (source, template) — the partial unique holds');
select is((select status from public.printed_documents where id = (select doc2 from d)), 'active',
  't24 supersession: the new mint is the active one');

-- ── 5. Open door (serve = authorize + audit; no row, no audit on deny) ───────
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
-- FORCED (DM5·S3): the door's return shape gained `storage_bucket` — bytes now
-- live in the two CHECK-constrained document buckets, so the route needs the
-- bucket as well as the key (ADR 0120 D7/D12). Both halves come from the single
-- derivation authority, never re-spelled here.
select is(
  (select storage_bucket || '|' || storage_path || '|' || status || '|' || contains_phi::text
     from public.open_printed_document((select doc2 from d))),
  (select std_bucket from xp) || '|' || (select p2 from xp) || '|active|false',
  't25 open: an authorized caller gets (bucket, path, status, contains_phi) — the route''s streaming tuple');
reset role;
select is((select count(*)::int from public.audit_log
            where action = 'document.downloaded' and entity_id = (select doc2 from d)
              and metadata->>'overlay_applied' = 'false'), 1,
  't26 audit: document.downloaded emitted with overlay_applied=false (computed in-door, deviation 3)');
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.open_printed_document((select doc2 from d))), 0,
  't27 open denied: a non-viewer gets NO ROW (open_attachment idiom — download follows CURRENT access, D11)');
reset role;
select is((select count(*)::int from public.audit_log
            where action = 'document.downloaded' and entity_id = (select doc2 from d)), 1,
  't28 audit: the denied open emitted NOTHING (no row, no audit)');
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.open_printed_document('00000000-0000-0000-0000-00000000dead'::uuid)), 0,
  't29 open: unknown id returns no row (indistinguishable from out-of-scope)');
reset role;

-- ── 6. Revoke — a governance act, never undo ─────────────────────────────────
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$select public.revoke_printed_document((select doc1 from d), 'wrong_data', 'Tentativa do emissor')$$,
  '42501', null,
  't30 revoke denied: the MINTER (plain staff) cannot revoke his own mint (D11 — not the minter)');
reset role;
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select throws_ok(
  $$select public.revoke_printed_document((select doc1 from d), 'wrong_data', 'Tentativa do platform_admin')$$,
  '42501', null,
  't31 ⭐ platform_admin may NOT revoke (D11 noun rule)');
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$select public.revoke_printed_document((select doc1 from d), 'because_i_said_so', 'x')$$,
  'HC0D1', null,
  't32 revoke: reason class outside the closed vocabulary is refused');
select throws_ok(
  $$select public.revoke_printed_document((select doc1 from d), 'wrong_data', '   ')$$,
  'HC0D1', null,
  't33 revoke: the free-text reason is MANDATORY (D6)');
select lives_ok(
  $$select public.revoke_printed_document((select doc1 from d), 'wrong_data', 'Emitido com dados incorretos.')$$,
  't34 revoke: staff_admin of the owning commission revokes (the authority twin)');
reset role;
select ok(
  (select status = 'revoked'
      and revoked_by = (select sa_x from k)
      and revoked_reason_class = 'wrong_data'
      and superseded_at is not null
     from public.printed_documents where id = (select doc1 from d)),
  't35 revoke: state recorded; superseded history RETAINED (the one-directional CHECK admits superseded→revoked)');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$select public.revoke_printed_document((select doc1 from d), 'other', 'De novo')$$,
  'HC0D5', null,
  't36 revoke: an already-revoked document cannot be re-revoked');
reset role;
select is((select count(*)::int from public.audit_log
            where action = 'document.revoked' and entity_id = (select doc1 from d)), 1,
  't37 audit: document.revoked emitted exactly once');
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select status from public.open_printed_document((select doc1 from d))), 'revoked',
  't38 open: a revoked document still SERVES (states change what the overlay stamps, never reachability — D6/D8)');
reset role;
select is((select count(*)::int from public.audit_log
            where action = 'document.downloaded' and entity_id = (select doc1 from d)
              and metadata->>'overlay_applied' = 'true'), 1,
  't39 audit: the non-active serve logged overlay_applied=true (in-door computation)');

-- ── 7. Amendment A — credential format + collision (doc5 over the draft) ─────
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$select public.mint_printed_document(
      (select doc5 from d), 'form_response', (select resp_prog from r),
      'form_response', 1, repeat('ef', 32),
      'tooShort', (select sc5 from tk), false)$$,
  'HC0D1', null,
  't40 Amendment A: a sub-192-bit token is refused by FORMAT (the door validates, the action generates)');
select throws_ok(
  $$select public.mint_printed_document(
      (select doc5 from d), 'form_response', (select resp_prog from r),
      'form_response', 1, repeat('ef', 32),
      (select tok5 from tk), 'ABC', false)$$,
  'HC0D1', null,
  't41 Amendment A: a malformed short code is refused (exact length, unambiguous alphabet)');
select throws_ok(
  $$select public.mint_printed_document(
      (select doc5 from d), 'form_response', (select resp_prog from r),
      'form_response', 1, repeat('ef', 32),
      (select tok5 from tk), (select sc1 from tk), false)$$,
  'HC0D4', null,
  't42 Amendment A: a short-code COLLISION raises the distinct retry code (uniqueness is constraint-enforced)');
select lives_ok(
  $$select public.mint_printed_document(
      (select doc5 from d), 'form_response', (select resp_prog from r),
      'form_response', 1, repeat('ef', 32),
      (select tok5 from tk), (select sc5 from tk), false)$$,
  't43 Amendment A: the retry with fresh credentials succeeds — a RASCUNHO-state mint over the creator''s own draft');

-- ── 8. PHI refusal + Amendment B + template coherence (doc4 — NO object) ─────
select throws_ok(
  $$select public.mint_printed_document(
      (select doc4 from d), 'form_response', (select resp_sub from r),
      'form_response', 1, repeat('ab', 32),
      (select tok3 from tk), (select sc3 from tk), true)$$,
  'HC0D2', null,
  't44 D9 fail-closed: no P1 kind is PHI-capable — contains_phi=true is refused before anything else module-side');
-- P2 REPOINT (lead-acked; fixture de-confused per QA MINOR-3): the `meeting`
-- kind is registered since 20260914000000, so this write-side probe moved to
-- `interview` with an HONEST fixture — a fresh uuid, because the ELSE denies
-- BEFORE any entity resolution (the "visible source, unreadable kind" specimen
-- with a REAL interview lives in 313 t37; this one pins only that an
-- unhandled kind cannot reach the door at all).
-- ⚠ P4 NOTE: when the interview arm lands, repoint to a then-unregistered kind
-- or retire in favour of 313's real-fixture keystones — do NOT leave it to
-- invert silently (the t9 lesson).
select throws_ok(
  $$select public.mint_printed_document(
      (select doc4 from d), 'interview', '00000000-0000-0000-0000-00000000dfff',
      'interview', 1, repeat('ab', 32),
      (select tok3 from tk), (select sc3 from tk), false)$$,
  '42501', null,
  't45 unregistered kind cannot mint EITHER — the dispatch''s ELSE guards the doors too (same fail-closed, write side)');
select throws_ok(
  $$select public.mint_printed_document(
      (select doc4 from d), 'form_response', (select resp_sub from r),
      'form_response', 1, repeat('ab', 32),
      (select tok3 from tk), (select sc3 from tk), false)$$,
  'HC0D3', null,
  't46 ⭐ Amendment B: a mint whose object was never uploaded is refused — a registry row NEVER points at a missing object');
select throws_ok(
  $$select public.mint_printed_document(
      (select doc4 from d), 'form_response', (select resp_sub from r),
      'ata_bonita', 1, repeat('ab', 32),
      (select tok3 from tk), (select sc3 from tk), false)$$,
  'HC0D1', null,
  't47 template coherence: a template key foreign to the kind is refused');

-- ── 9. Write path: no authenticated DML exists (reader-non-writer probe) ─────
-- FORCED (DM5·S3): `storage_path` retired, the two coordinate columns added
-- (both NOT NULL). The uuids below are deliberately arbitrary — the privilege
-- check fires before any FK or trigger, which is exactly the claim: a READER
-- never reaches the row at all.
select throws_ok(
  $$insert into public.printed_documents
      (id, source_kind, source_id, commission_id, template_key, template_version,
       content_hash, verification_token, verification_short_code, minted_by,
       document_id, document_version_id)
    select '00000000-0000-0000-0000-00000000daaa', 'form_response', r.resp_sub, k.comm_x,
       'form_response', 1, repeat('99', 32),
       'RAWDMLTOKENAAAABBBBCCCCDDDDEEEEFFFF', 'GHJKLM2345', k.st_x,
       gen_random_uuid(), gen_random_uuid()
    from r, k$$,
  '42501', null,
  't48 write path: direct INSERT by a READER is impossible — writes only through the doors (Rule 1)');
select throws_ok(
  $$update public.printed_documents set status = 'active' where id = (select doc1 from d)$$,
  '42501', null,
  't49 write path: direct UPDATE denied (un-revoking by DML is not a thing)');
select throws_ok(
  $$delete from public.printed_documents where id = (select doc1 from d)$$,
  '42501', null,
  't50 write path: direct DELETE denied (mints are permanent, D15)');

-- ── 10. Column-list GRANT exclusions ─────────────────────────────────────────
-- ⭐ FORCED, AND DELIBERATELY NOT DELETED (DM5·S3). t51 used to prove that
-- `storage_path` was withheld from `authenticated` by the column-list GRANT.
-- ADR 0120 D7 RETIRES the column, so the original assertion cannot run — and
-- simply removing it would silently drop this file's only coverage of the
-- column-list-grant MECHANISM, which is a live trap (`case_referral`: a new
-- column without its own GRANT reads 42501). So it splits:
--   t51  — the D7 retirement itself, asserted from the catalog. The old claim
--          is now true STRUCTURALLY rather than by privilege, which is stronger:
--          a column that does not exist cannot be under-withheld.
--   t51b — the mechanism, re-pointed at a column that IS still withheld, so the
--          grant list keeps being exercised by something.
-- ⛔ CORRECTED AT QA r1 (MAJOR-2). The first version of this assertion said the
-- retirement made the old claim "true STRUCTURALLY rather than by privilege, which
-- is STRONGER: a column that does not exist cannot be under-withheld", and titled
-- itself "it cannot be leaked from here at all". **That was true of the COLUMN and
-- false of the PROPERTY**, and shipping it would have been a third comment in this
-- phase asserting a property that does not hold.
--
-- ⭐ THE MEASURED TRUTH, which is neither the old text NOR the r1 report's premise:
-- the coordinate was ALREADY derivable before S3 and still is, so nothing was
-- gained and nothing was lost. `id` and `contains_phi` are BOTH granted to
-- `authenticated` and always were; the retired CHECK `pd_storage_path_derived`
-- pinned `storage_path` to `(case when contains_phi then 'phi/' else 'std/' end ||
-- id || '.pdf')` — a PURE FUNCTION OF TWO READABLE COLUMNS. So the column-list
-- withholding of `storage_path` was ALREADY VACUOUS: any legitimate viewer could
-- compute it. Post-S3 it is `printed/<id>.pdf` in a bucket keyed off the same
-- `contains_phi`. EXACTLY as derivable. t51c records that executably so the false
-- claim cannot grow back.
--
-- What actually protects the bytes is NOT withholding a coordinate — it is that
-- the two document buckets carry NO SELECT POLICY (ADR 0114 D8: the F-01 class
-- dies structurally). t51d asserts that, and t53 below asserts its behavioural
-- consequence.
select is(
  (select count(*)::int from pg_attribute
    where attrelid = 'public.printed_documents'::regclass
      and attname = 'storage_path' and not attisdropped),
  0,
  't51 D7: printed_documents.storage_path is RETIRED (the column is gone — this is a RELOCATION, NOT a withholding improvement; see t51c)');
select throws_ok(
  $$select revoked_by from public.printed_documents where id = (select doc2 from d)$$,
  '42501', null,
  't51b GRANT: the column-list grant still withholds — revoked_by is not readable by authenticated (the mechanism t51 used to cover)');
-- t51c — THE NON-PROPERTY, ASSERTED EXECUTABLY. A comment saying "the coordinate
-- is derivable" would rot; this cannot. Both inputs to the derivation are readable
-- by the print's legitimate viewer, so no reader can later claim the coordinate is
-- hidden and build on it.
select is(
  (select (id is not null)::text || '|' || (contains_phi is not null)::text
     from public.printed_documents where id = (select doc2 from d)),
  'true|true',
  't51c ⭐ the coordinate is DERIVABLE by any legitimate viewer from two GRANTED columns (id + contains_phi) — it was equally derivable pre-S3 via pd_storage_path_derived, so S3 neither strengthened nor weakened this');
-- t51d — WHAT ACTUALLY PROTECTS THE BYTES, structural half. Knowing the key buys
-- nothing without a SELECT policy, and there is none for either document bucket.
reset role;
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd in ('SELECT', 'ALL')
      and coalesce(qual, '') || coalesce(with_check, '')
          like any (array['%documents-standard%', '%documents-phi%'])),
  0,
  't51d ⭐ ZERO SELECT policies on storage.objects name either document bucket — the coordinate being derivable costs nothing because the BYTES have no client read path (ADR 0114 D8)');
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$select verification_token from public.printed_documents where id = (select doc2 from d)$$,
  '42501', null,
  't52 GRANT: verification_token is not bulk-readable (resolution only through the lookup door)');

-- ── 11. Storage isolation: zero policies = zero reach ────────────────────────
-- ⭐⭐ FORCED, AND IT WAS ABOUT TO GO SILENTLY VACUOUS (DM5·S3). t53 proved that
-- `authenticated` reads ZERO of the print objects — and its power came entirely
-- from the fact that FOUR such objects existed in `printed-documents` when it
-- ran. This slice moves those objects to `documents-standard`, so the ORIGINAL
-- assertion would still have passed — counting zero rows in a bucket that is now
-- genuinely empty. Green, unchanged, and proving nothing whatsoever.
-- Re-pointed at the bucket the bytes actually occupy now. `documents-standard`
-- carries NO SELECT policy (ADR 0114 D8 reserves it for the single audited
-- door), so the claim is the same claim, against a populated bucket.
-- The non-vacuity is pinned rather than asserted in prose: t53pre proves the
-- rows are THERE to be hidden.
-- The control must run as the OWNER: `authenticated` is precisely the role that
-- cannot see these rows, so asserting their existence from inside the
-- authenticated block would count 0 and "prove" the opposite.
reset role;
select is((select count(*)::int from storage.objects
            where bucket_id = 'documents-standard'
              and name like 'printed/%'), 4,
  't53pre [CONTROL] the print objects EXIST in documents-standard — so t53 has something to fail to see');
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from storage.objects
            where bucket_id = 'documents-standard'), 0,
  't53 storage: authenticated reads ZERO documents-standard objects (bucket has NO SELECT policy — the single audited door only, D8)');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('documents-standard', 'printed/smuggled.pdf')$$,
  '42501', null,
  't54 storage: authenticated cannot upload to an arbitrary key — the INSERT policy admits only a RESERVED path (app.storage_upload_reserved)');

-- ── 12. verification_lookups: single-door log, no client ACL ─────────────────
select throws_ok(
  $$select count(*) from public.verification_lookups$$,
  '42501', null,
  't55 verification_lookups: unreadable by authenticated (minimal log, not a tracker — D12)');
select throws_ok(
  $$select * from public.lookup_printed_document('anything', null)$$,
  '42501', null,
  't56 lookup door: EXECUTE is service-role ONLY (deviation 4 — an anon/authenticated PostgREST path would bypass the rate limiter)');
reset role;

-- ── 13. Lookup door semantics (server path — owner/service_role) ─────────────
select is(
  (select matched::text || '|' || status || '|' || source_kind || '|' || hospital_name
     from public.lookup_printed_document((select tok2 from tk), null)),
  'true|active|form_response|Hosp Bootstrap',
  't57 lookup: the ANEMIC tuple — authentic + status + kind + hospital, nothing else (D10)');
select ok(
  (select document_id is null from public.lookup_printed_document((select tok2 from tk), null)),
  't58 ⭐ lookup: ANONYMOUS callers always get document_id = null (no anonymous download, no oracle)');
select is(
  (select document_id from public.lookup_printed_document((select tok2 from tk), (select st_x from k))),
  (select doc2 from d),
  't59 lookup: a verified viewer session gets the registry id — the audited-download hand-off (D10)');
select ok(
  (select document_id is null from public.lookup_printed_document((select tok2 from tk), (select st_x2 from k))),
  't60 lookup: a verified NON-viewer session still gets null — p_viewer routes the same dispatch');
select is(
  (select matched from public.lookup_printed_document((select sc2 from tk), null)),
  true,
  't61 lookup: the short-code damage fallback resolves the same document');
select is(
  (select matched::text || '|' || coalesce(status, '∅') from public.lookup_printed_document('NAOEXISTE99', null)),
  'false|∅',
  't62 lookup: an unknown credential answers matched=false with NOTHING else (indistinguishable from never-existed)');
select is((select count(*)::int from public.verification_lookups
            where token_hash = encode(extensions.digest('NAOEXISTE99', 'sha256'), 'hex')
              and matched = false), 1,
  't63 lookup log: the scan is recorded as a HASH (never the raw credential), matched=false');
select is(
  (select status from public.lookup_printed_document((select tok1 from tk), null)),
  'revoked',
  't64 lookup: verification reports the CURRENT state of a revoked print (ink does not update; the QR does)');

-- ── 14. The derived-coordinate pin holds against ANY writer ──────────────────
-- ⭐ FORCED, AND THE PIN IS REPLACED RATHER THAN RETIRED (DM5·S3). ADR 0120 D7
-- drops the CHECK `pd_storage_path_derived` along with the column it read, so
-- migration 20260927000310 restores the SAME strength as
-- `trg_guard_printed_document_binding` — a BEFORE INSERT trigger comparing the
-- bound file object's (bucket, path) against the canonical derivation. The
-- assertion's subject moved from a CHECK to a trigger; its CLAIM is unchanged
-- and its SQLSTATE moves 23514 -> HC0DA accordingly.
-- The fixture presents a chain whose file object sits at a FOREIGN coordinate —
-- the direct analogue of the old "I point at someone else's bytes" path.
create temp table ch65 on commit drop as
  select pg_temp.pd_chain(
    '00000000-0000-0000-0000-00000000dbbb'::uuid,
    (select resp_sub from r), (select st_x from k),
    'printed/i-point-at-someone-elses-bytes.pdf') as ver;
select throws_ok(
  $$insert into public.printed_documents
      (id, source_kind, source_id, commission_id, template_key, template_version,
       content_hash, verification_token, verification_short_code, minted_by,
       document_id, document_version_id)
    select '00000000-0000-0000-0000-00000000dbbb', 'form_response', r.resp_sub, k.comm_x,
       'form_response', 1, repeat('77', 32),
       'CHECKTOKENAAAABBBBCCCCDDDDEEEEFFFF', 'HJKLMN2345', k.st_x,
       (select dv.document_id from public.document_versions dv
         where dv.id = (select ver from ch65)),
       (select ver from ch65)
    from r, k$$,
  'HC0DA', null,
  't65 derived-coordinate pin: even the OWNER cannot mint a row whose bound bytes are not at its own derived coordinate (deviation 2, layer 2 — now a trigger, ADR 0120 D7)');

-- ── 15. Flag OFF fails every door (restored after) ───────────────────────────
update app.feature_flags set enabled = false where key = 'document_printing';
select throws_ok(
  $$select public.mint_printed_document(
      '00000000-0000-0000-0000-00000000dccc', 'form_response', (select resp_sub from r),
      'form_response', 1, repeat('ab', 32),
      'FLAGOFFTOKENAAAABBBBCCCCDDDDEEEEFF', 'JKLMNP2345', false)$$,
  '23514', null,
  't66 flag OFF: mint fails with the house disabled-feature class (check_violation)');
select throws_ok(
  $$select * from public.open_printed_document((select doc2 from d))$$,
  '23514', null,
  't67 flag OFF: open fails — the feature is dark on BOTH sides of the boundary');
select throws_ok(
  $$select * from public.lookup_printed_document((select tok2 from tk), null)$$,
  '23514', null,
  't68 flag OFF: the public lookup fails too (no verification surface while the module is off)');
update app.feature_flags set enabled = true where key = 'document_printing';

-- ── 16. Short-code case handling (lead-delegated decision, 2026-08-07): codes
-- are minted from an UPPERCASE-only unambiguous alphabet and the lookup door
-- normalizes the presented credential (upper(btrim(...))) — a human reading a
-- paper code aloud must not fail on case. PINNED here so the behaviour is a
-- keystone, not folklore. (Tokens stay case-SENSITIVE — machine-read from QR.)
select is(
  (select matched from public.lookup_printed_document(lower((select sc2 from tk)), null)),
  true,
  't69 lookup: a LOWERCASED presentation of a valid short code still matches (case-insensitive by normalization)');

-- ── 17. QA fix wave (phase-PDF-P1-review; lead FIX-5) ────────────────────────
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select is((select count(*)::int from public.open_printed_document((select doc2 from d))), 0,
  't70 ⭐ platform_admin may not OPEN either — the D11 noun-rule keystone now covers the fourth verb (QA MINOR-8b)');
reset role;
select is((select count(*)::int from public.audit_log
            where action = 'document.downloaded' and entity_id = (select doc2 from d)), 1,
  't71 audit: the platform_admin open denial emitted NOTHING (no row, no audit)');
update app.feature_flags set enabled = false where key = 'document_printing';
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$select public.revoke_printed_document((select doc2 from d), 'other', 'Tentativa com o recurso desligado')$$,
  '23514', null,
  't72 flag OFF: revoke fails with the house disabled-feature class too (QA MINOR-8a — the fourth door''s flag gate)');
reset role;
update app.feature_flags set enabled = true where key = 'document_printing';
-- ⭐⭐ FORCED, AND THE REASON IS THE WHOLE POINT OF t73 (DM5·S3). This probe
-- exists to prove the PARTIAL UNIQUE INDEX is the anchor — "not the door". The
-- new BEFORE INSERT pin trigger (…000310) fires BEFORE constraint checks, so a
-- probe carrying an invalid binding would now be refused by the TRIGGER with
-- HC0DA and t73 would go green having measured a SIBLING LOCK instead of the
-- index it names. The fixture therefore presents a VALID chain at the CORRECT
-- derived coordinate, so the trigger passes and the index is what refuses —
-- 23505, exactly as before. Neutralize each lock independently; a green test
-- with a plausible-but-wrong refusal is the failure mode this file guards.
create temp table ch73 on commit drop as
  select pg_temp.pd_chain(
    '00000000-0000-0000-0000-00000000dddd'::uuid,
    (select resp_sub from r), (select sa_x from k)) as ver;
select throws_ok(
  $$insert into public.printed_documents
      (id, source_kind, source_id, source_series_id, commission_id, template_key, template_version,
       content_hash, verification_token, verification_short_code, minted_by,
       document_id, document_version_id)
    -- ADR 0126 D1: the index is now keyed on the SERIES, so the probe must supply
    -- one. `resp_sub` has no `supersedes_id`, so it IS its own series root — the
    -- collision this test names is therefore unchanged in meaning, and still
    -- lands on the index rather than on the NOT NULL constraint.
    select '00000000-0000-0000-0000-00000000dddd', 'form_response', r.resp_sub, r.resp_sub, k.comm_x,
       'form_response', 1, repeat('55', 32),
       'DUPACTIVETOKENAAAABBBBCCCCDDDDEEEE', 'KLMNPQ2345', k.sa_x,
       (select dv.document_id from public.document_versions dv
         where dv.id = (select ver from ch73)),
       (select ver from ch73)
    from r, k$$,
  '23505', null,
  't73 ⭐ one-active is TABLE-level law (QA MINOR-7): a second active row for the same (source, template) is impossible even for the OWNER — the partial unique index, not the door and not the pin trigger, is the anchor');

-- ── 9. FUP-DM5-DANGLING-PRINT: a draft with an ACTIVE print cannot be deleted ─
-- Migration 20260928000700 (`app.guard_response_active_print`, BEFORE DELETE on
-- responses). Re-ruled 2026-08-18 after the first ruling — "refuse the mint from
-- a non-submitted response" — was WITHDRAWN for reversing ADR 0104 D7. t43 above
-- is D7's own witness: a RASCUNHO mint over the creator's draft SUCCEEDS. The
-- defect was never the mint; it was that deleting the draft afterwards orphaned
-- the print, because `securable_resources` is polymorphic and can carry no FK to
-- `responses`, so Postgres cannot cascade what it does not know is related.
--
-- ⭐ THREE VACUITY TRAPS DODGED DELIBERATELY:
--  1. t74 runs as the CREATOR under `authenticated`, the one principal whose RLS
--     (`responses_delete_own_draft`: created_by = uid AND status = 'in_progress')
--     actually permits this delete. Run it as anyone else and RLS refuses first,
--     so the pin would go green without the trigger existing at all.
--  2. t76 is the DIFFERENTIAL, and it is the assertion that carries the weight:
--     after the print is revoked, the SAME delete by the SAME principal
--     SUCCEEDS. Without it, t74 is equally satisfied by a guard that blocks
--     every draft delete unconditionally — a far worse bug that would read as a
--     pass. It pins that the guard discriminates on `status = 'active'`.
--  3. Revocation is performed by sa_x, not st_x: `revoke_printed_document`
--     refuses plain staff. Using the creator would fail on authority and leave
--     the print active, making t76 red for a reason unrelated to the guard.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$delete from public.responses where id = (select resp_prog from r)$$,
  'HC069',
  null,
  't74 ⭐ FUP-DM5-DANGLING-PRINT: the creator CANNOT discard his own draft while its printed document is ACTIVE — the paper must be voided deliberately, not orphaned as a side effect');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$select public.revoke_printed_document(
      (select doc5 from d), 'minted_in_error', 'rascunho descartado pelo autor')$$,
  't75 CONTROL setup: the commission coordinator voids the printed document (plain staff cannot — that is why this leg is sa_x)');
reset role;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  $$delete from public.responses where id = (select resp_prog from r)$$,
  't76 ⭐ THE DIFFERENTIAL: with the print REVOKED the very same delete now SUCCEEDS — the guard discriminates on status = ''active'' and does not merely block all draft deletes. A revoked print keeps its row and bytes on purpose, so /verificar can still tell a paper-holder it is ANULADO (lookup_printed_document never joins responses)');
reset role;

-- ── 10. ADR 0123 D1/D3 — `superseded` is a live page, and the mint is ordered ─
-- Migration 20260928000800. Section 9 above pins the ACTIVE case; this pins the
-- half 000700 got wrong and the half no arm was asking about.
--
-- D1: 000700 argued "Only an ACTIVE print represents a live page". ADR 0120
-- D6/D8 says states change the overlay STAMP, never REACHABILITY — a superseded
-- print still serves bytes and still answers /verificar. So the ACTIVE-only
-- guard opened on a reachable state, constructed below entirely from supported
-- actions: mint -> re-mint (SUPERSEDE_ACTIVE flips P1) -> revoke the active P2.
--
-- ⭐⭐ t77 IS THE ASSERTION THAT MAKES t78 A KEYSTONE RATHER THAN A COINCIDENCE.
-- If the sa_x revoke below silently failed, P2 would still be ACTIVE — and t78
-- would then go green against the OLD active-only guard, pinning nothing at all.
-- The whole construction rests on "zero actives remain", so that is asserted
-- directly rather than inferred from the revoke not having raised.
-- (Verified red-first: against the 000700 predicate t78 does not merely fail,
-- the DELETE SUCCEEDS — the orphan is demonstrated, not argued.)
create temp table r9 on commit drop as
  select '00000000-0000-0000-0000-00000000d104'::uuid as resp_sup;
grant select on r9 to authenticated;
insert into public.responses (id, form_version_id, commission_id, created_by, status, started_at)
select r9.resp_sup, k.ver_u, k.comm_x, k.st_x, 'in_progress', now() from r9, k;

create temp table d9 on commit drop as
  select '00000000-0000-0000-0000-00000000d206'::uuid as doc6,   -- P1: becomes superseded
         '00000000-0000-0000-0000-00000000d207'::uuid as doc7;   -- P2: re-mint, then revoked
grant select on d9 to authenticated;
insert into storage.objects (bucket_id, name, metadata)
select 'documents-standard', app.printed_rendition_storage_path(doc6),
       jsonb_build_object('size', 1024, 'mimetype', 'application/pdf') from d9;
insert into storage.objects (bucket_id, name, metadata)
select 'documents-standard', app.printed_rendition_storage_path(doc7),
       jsonb_build_object('size', 1024, 'mimetype', 'application/pdf') from d9;

-- Build the state through the DOORS, never by INSERT: a hand-built fixture
-- would prove the guard reads a column, not that ordinary use can reach it.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.mint_printed_document(
  (select doc6 from d9), 'form_response', (select resp_sup from r9),
  'form_response', 1, repeat('ab', 32),
  'PDTOKEN6AAAABBBBCCCCDDDDEEEEFFFFGGGG', 'EFGHJK2345', false);
select public.mint_printed_document(
  (select doc7 from d9), 'form_response', (select resp_sup from r9),
  'form_response', 1, repeat('ab', 32),
  'PDTOKEN7AAAABBBBCCCCDDDDEEEEFFFFGGGG', 'FGHJKL2345', false);
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.revoke_printed_document(
  (select doc7 from d9), 'minted_in_error', 'anulacao da via em circulacao');
reset role;

select is(
  (select array_agg(status order by status)::text
     from public.printed_documents
    where source_kind = 'form_response'
      and source_id = (select resp_sup from r9)),
  '{revoked,superseded}',
  't77 ⭐⭐ NON-VACUITY CONTROL: the constructed state really is ZERO ACTIVE + one superseded + one revoked. Without this, a silently-failed revoke leaves P2 active and t78 passes against the old active-only guard, proving nothing');

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$delete from public.responses where id = (select resp_sup from r9)$$,
  'HC069',
  null,
  't78 ⭐ ADR 0123 D1 KEYSTONE: with NO active print but one SUPERSEDED, the creator still cannot discard — a superseded print serves bytes and answers /verificar (ADR 0120 D6/D8), so it is a live page. Against the 000700 predicate this DELETE SUCCEEDS');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$select public.revoke_printed_document(
      (select doc6 from d9), 'other', 'rascunho de origem sera descartado')$$,
  't79 ⭐ THE EXIT EXISTS: revoke_printed_document accepts a SUPERSEDED row (it refuses only status = ''revoked''), so D1 adds no dead end it does not also provide a way out of');
reset role;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  $$delete from public.responses where id = (select resp_sup from r9)$$,
  't80 ⭐ THE DIFFERENTIAL: with BOTH prints revoked the same delete succeeds. Without it t78 is equally satisfied by a guard that blocks every draft delete — the worse bug that reads as a pass (the same trap t76 covers for the active case)');
reset role;

-- D3 — the mint/delete race. STRUCTURAL, and the weakness is stated rather than
-- hidden: pgTAP is single-session, so no keystone here can construct the
-- interleaving that produces the orphan (measured separately in a scratch
-- schema; recorded in ADR 0123 D3 and in the migration header). This asserts the
-- lock is still THERE. It cannot fail in the direction that matters most, and it
-- is kept because the alternative was a comment — and a comment is an assertion
-- that goes stale silently, where this one reds the suite.
-- Read from `pg_proc`, never from migration text: seven migrations have redefined
-- this body and one of them rewrites it at runtime, so the file is not truth.
select ok(
  exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'mint_printed_document'
       and p.prosrc ilike '%from public.responses where id = p_source_id for key share%'),
  't81 ⭐ ADR 0123 D3: the live mint body still KEY-SHARE-locks its source response before creating the print chain, so a concurrent discard cannot slip between the guard check and the insert');

-- ── 11. ADR 0126 D1 — a print belongs to a SERIES, not to a ROW ─────────────
-- ⭐⭐ THE DIFFERENTIAL THAT PROVES THE RE-KEY FIXED SOMETHING, rather than that
-- the new index exists. The defect was LIVE and invisible: `start_correction_draft`
-- inserts a NEW `responses` row carrying `supersedes_id`, so R1 and R2 were
-- unrelated as far as the registry was concerned and **both could hold an
-- `active` print at once** — one logical document, two current papers, no
-- constraint violated.
--
-- Under the row-keyed index this block PASSES ITS SETUP and t83 counts 2. Under
-- the series key the second mint supersedes the first, because both resolve to
-- the same series root. Verified by drill: re-keying the index back to
-- `source_id` reds t83.
create temp table r11 on commit drop as
  select '00000000-0000-0000-0000-00000000c101'::uuid as resp_r1,
         '00000000-0000-0000-0000-00000000c102'::uuid as resp_r2,
         '00000000-0000-0000-0000-00000000c201'::uuid as doc_p1,
         '00000000-0000-0000-0000-00000000c202'::uuid as doc_p2;
grant select on r11 to authenticated;

insert into public.responses (id, form_version_id, commission_id, created_by, status, started_at, submitted_at)
select r11.resp_r1, k.ver_u, k.comm_x, k.st_x, 'submitted', now(), now() from r11, k;
-- The correction successor, pre-linked exactly as `start_correction_draft` /
-- `supersede_response` pre-link it.
--
-- ⚠ THE CLAIMS MUST BE CLEARED FIRST, AND THIS COST A RED. `test_helpers.claims_for`
-- sets `request.jwt.claims` for the SESSION, and §10 above left `st_x` — a plain
-- staff member — still in effect. `guard_supersession_coherent`'s standalone arm
-- reads `auth.uid()` and refuses a non-staff_admin with 42501, so the insert died
-- on an authority check this fixture never meant to exercise. The DEFINER /
-- migration path (`auth.uid()` null) is what the guard trusts (ADR 0075) — so say
-- so in SQL rather than in a comment that was true about the mechanism and false
-- about the state.
select set_config('request.jwt.claims', null, true);
insert into public.responses (id, form_version_id, commission_id, created_by, status, started_at, submitted_at, supersedes_id)
select r11.resp_r2, k.ver_u, k.comm_x, k.st_x, 'submitted', now(), now(), r11.resp_r1 from r11, k;

select is(
  app.print_source_series('form_response', (select resp_r2 from r11)),
  (select resp_r1 from r11),
  't82 ⭐ SERIES: the successor resolves to the ROOT of the supersedes_id chain, '
  'not to itself — which is what makes the two prints below collide at all');

insert into storage.objects (bucket_id, name, metadata)
select 'documents-standard', app.printed_rendition_storage_path(doc_p1),
       jsonb_build_object('size', 1024, 'mimetype', 'application/pdf') from r11;
insert into storage.objects (bucket_id, name, metadata)
select 'documents-standard', app.printed_rendition_storage_path(doc_p2),
       jsonb_build_object('size', 1024, 'mimetype', 'application/pdf') from r11;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.mint_printed_document(
  (select doc_p1 from r11), 'form_response', (select resp_r1 from r11),
  'form_response', 1, repeat('ab', 32),
  'SERIESTOK1AAAABBBBCCCCDDDDEEEEFFFF', 'MNPQRS2345', false);
select public.mint_printed_document(
  (select doc_p2 from r11), 'form_response', (select resp_r2 from r11),
  'form_response', 1, repeat('ab', 32),
  'SERIESTOK2AAAABBBBCCCCDDDDEEEEFFFF', 'NPQRST2345', false);
reset role;

select is(
  (select count(*)::int from public.printed_documents
    where source_kind = 'form_response'
      and source_id in ((select resp_r1 from r11), (select resp_r2 from r11))
      and status = 'active'),
  1,
  't83 ⭐ ADR 0126 D1 — THE MINT''s SUPERSESSION KEY: across a CORRECTION CHAIN '
  'exactly ONE print is active, because SUPERSEDE_ACTIVE now matches on the SERIES. '
  'Red-proved by reverting that one column swap. ⚠ This does NOT pin the INDEX — '
  'see t84');

-- ⛔⛔ t84 EXISTS BECAUSE t83 DID NOT PIN WHAT ITS FIRST DRAFT CLAIMED, and the
-- drill is what said so. Re-keying the index back to `(source_kind, source_id,
-- template_key)` left the suite GREEN: the mint's SUPERSEDE_ACTIVE already
-- collapses the chain, so only one active row remains either way. t83's original
-- text asserted "against the row-keyed index this counts 2" — FALSE. The index
-- was doing nothing the mint was not already doing.
--
-- The discriminating state has to be built where the mint cannot reach: a
-- TABLE-LEVEL insert of a SECOND active print whose `source_id` differs from the
-- live one but whose SERIES is the same.
--   after the two mints: P1(source_id=R1, series=R1, SUPERSEDED)
--                        P2(source_id=R2, series=R1, ACTIVE)
--   probe:               P3(source_id=R1, series=R1, ACTIVE)
--   • series-keyed index -> collides with P2 (same series, both active) -> 23505
--   • row-keyed index    -> P1 is superseded, so no ACTIVE row has source_id=R1,
--                           and the insert SUCCEEDS — two current papers for one
--                           logical document, exactly the live defect D1 closes.
create temp table ch84 on commit drop as
  select pg_temp.pd_chain(
    '00000000-0000-0000-0000-00000000c203'::uuid,
    (select resp_r1 from r11), (select sa_x from k)) as ver;

select throws_ok(
  $$insert into public.printed_documents
      (id, source_kind, source_id, source_series_id, commission_id, template_key,
       template_version, content_hash, verification_token, verification_short_code,
       minted_by, document_id, document_version_id)
    select '00000000-0000-0000-0000-00000000c203', 'form_response',
       r11.resp_r1, r11.resp_r1, k.comm_x, 'form_response', 1, repeat('66', 32),
       'SERIESDUPTOKENAAAABBBBCCCCDDDDEEEE', 'PQRSTU2345', k.sa_x,
       (select dv.document_id from public.document_versions dv
         where dv.id = (select ver from ch84)),
       (select ver from ch84)
    from r11, k$$,
  '23505', null,
  't84 ⭐⭐ ADR 0126 D1 INDEX KEYSTONE: a second ACTIVE print for the same SERIES '
  'is impossible at TABLE level even for the owner, across different source rows. '
  'This is the assertion the re-key actually buys — red-proved by re-keying the '
  'index back to source_id, which t83 alone did not notice');

select * from finish();
rollback;
