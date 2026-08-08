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
select plan(73);

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
insert into storage.objects (bucket_id, name)
select 'printed-documents', 'std/' || doc1 || '.pdf' from d;
insert into storage.objects (bucket_id, name)
select 'printed-documents', 'std/' || doc2 || '.pdf' from d;
insert into storage.objects (bucket_id, name)
select 'printed-documents', 'std/' || doc3 || '.pdf' from d;
insert into storage.objects (bucket_id, name)
select 'printed-documents', 'std/' || doc5 || '.pdf' from d;

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
select is(app.can_view_printed_document('form_response', (select resp_sub from r), (select oa_b from k)), true,
  't7 dispatch: org_admin reaches through the commission-admin chain (responses_admin_all mirror)');

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
select is(
  (select status || '|' || storage_path from public.printed_documents where id = (select doc1 from d)),
  'active|std/' || (select doc1 from d) || '.pdf',
  't12 mint: row is active and the storage path is DERIVED from the row identity (deviation 2)');
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
select is(
  (select storage_path || '|' || status || '|' || contains_phi::text
     from public.open_printed_document((select doc2 from d))),
  'std/' || (select doc2 from d) || '.pdf|active|false',
  't25 open: an authorized caller gets (path, status, contains_phi) — the route''s streaming triple');
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
-- P2 REPOINT (lead-acked): the `meeting` kind is registered since 20260914000000,
-- so this write-side fail-closed probe moves to `interview` (still unregistered).
-- ⚠ P4 NOTE: when the interview arm lands, repoint this to a then-unregistered
-- kind or retire it in favour of 313's real-fixture keystones — do NOT leave it
-- to invert silently (the t9 lesson).
select throws_ok(
  $$select public.mint_printed_document(
      (select doc4 from d), 'interview', (select meet_x from m),
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
select throws_ok(
  $$insert into public.printed_documents
      (id, source_kind, source_id, commission_id, template_key, template_version,
       content_hash, storage_path, verification_token, verification_short_code, minted_by)
    select '00000000-0000-0000-0000-00000000daaa', 'form_response', r.resp_sub, k.comm_x,
       'form_response', 1, repeat('99', 32),
       'std/00000000-0000-0000-0000-00000000daaa.pdf', 'RAWDMLTOKENAAAABBBBCCCCDDDDEEEEFFFF', 'GHJKLM2345', k.st_x
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
select throws_ok(
  $$select storage_path from public.printed_documents where id = (select doc2 from d)$$,
  '42501', null,
  't51 GRANT: storage_path is not readable by authenticated (D8 — bytes only through the route; Note C: defense-in-depth)');
select throws_ok(
  $$select verification_token from public.printed_documents where id = (select doc2 from d)$$,
  '42501', null,
  't52 GRANT: verification_token is not bulk-readable (resolution only through the lookup door)');

-- ── 11. Storage isolation: zero policies = zero reach ────────────────────────
select is((select count(*)::int from storage.objects where bucket_id = 'printed-documents'), 0,
  't53 storage: authenticated reads ZERO printed-documents objects (bucket has NO policies — service-role only, D8)');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('printed-documents', 'std/smuggled.pdf')$$,
  '42501', null,
  't54 storage: authenticated cannot upload into the bucket (mint uploads are server-side only)');

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

-- ── 14. The derived-path CHECK holds against ANY writer ──────────────────────
select throws_ok(
  $$insert into public.printed_documents
      (id, source_kind, source_id, commission_id, template_key, template_version,
       content_hash, storage_path, verification_token, verification_short_code, minted_by)
    select '00000000-0000-0000-0000-00000000dbbb', 'form_response', r.resp_sub, k.comm_x,
       'form_response', 1, repeat('77', 32),
       'std/i-point-at-someone-elses-bytes.pdf',
       'CHECKTOKENAAAABBBBCCCCDDDDEEEEFFFF', 'HJKLMN2345', k.st_x
    from r, k$$,
  '23514', null,
  't65 pd_storage_path_derived: even the OWNER cannot mint a row whose path is not its own identity (deviation 2, layer 2)');

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
select throws_ok(
  $$insert into public.printed_documents
      (id, source_kind, source_id, commission_id, template_key, template_version,
       content_hash, storage_path, verification_token, verification_short_code, minted_by)
    select '00000000-0000-0000-0000-00000000dddd', 'form_response', r.resp_sub, k.comm_x,
       'form_response', 1, repeat('55', 32),
       'std/00000000-0000-0000-0000-00000000dddd.pdf',
       'DUPACTIVETOKENAAAABBBBCCCCDDDDEEEE', 'KLMNPQ2345', k.sa_x
    from r, k$$,
  '23505', null,
  't73 ⭐ one-active is TABLE-level law (QA MINOR-7): a second active row for the same (source, template) is impossible even for the OWNER — the partial unique index, not the door, is the anchor');

select * from finish();
rollback;
