-- =============================================================================
-- PDF·P2 — the `meeting` arm keystones (ADR 0104 D15 step 2; migration
-- 20260914000000; plan §3; lead-acked plan 2026-08-08).
--
-- ⭐ KEYSTONES: (1) the NO-ADMIN-ARM delta — the meeting arm delegates to
-- can_reach_meeting, which admits members (+ attendees under
-- participants_only) and NOBODY else since the C7 cut; org_admin AND
-- hospital_admin DENY probes pin that divergence from the form_response arm
-- as DELIBERATE domain semantics (D11), with a form-arm CONTROL proving the
-- probes measure the arm, not a broken helper. (2) the RELOCATED fail-closed
-- keystones on REAL case/interview fixtures — P1's t9 specimen (meeting arm
-- unregistered) legitimately inverted this phase, the vacuity-control trap;
-- these anchor on kinds that stay unregistered through P2.
--
-- Non-vacuity: drill D8 (meeting arm -> true) must RED the deny legs here;
-- D1 (ELSE -> true) must RED the fail-closed legs; D2 (mint authority drop)
-- must RED the mint denials. Run + recorded in the phase report.
-- =============================================================================

begin;
select plan(38);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid as admin,
         (v->>'sa_x')::uuid  as sa_x,
         (v->>'st_x')::uuid  as st_x,
         (v->>'st_x2')::uuid as st_x2,
         (v->>'st_y')::uuid  as st_y,
         (v->>'oa_b')::uuid  as oa_b,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'org_b')::uuid  as org_b,
         (v->>'hosp_b')::uuid as hosp_b,
         (v->>'ver_u')::uuid  as ver_u
  from ctx;
grant select on k to authenticated;

-- A hospital_admin persona — bootstrap has none, and the no-admin-arm keystone
-- needs BOTH admin tiers probed (lead ruling).
create temp table ha on commit drop as
  select '00000000-0000-0000-0000-00000000e001'::uuid as ha_b;
grant select on ha to authenticated;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', ha_b, 'authenticated', 'authenticated', ha_b || '@test', now(), now() from ha;
update public.profiles set full_name = 'HospAdmin B', home_organization_id = (select org_b from k)
  where id = (select ha_b from ha);
insert into public.memberships (organization_id, hospital_id, principal_id, role)
select k.org_b, k.hosp_b, ha.ha_b, 'hospital_admin' from k, ha;

-- Meetings: one commission_default, one participants_only (with st_x the sole
-- attendee). The participants_only value is set by UPDATE after the attendee
-- row exists — trg_meetings_roster refuses a restricted meeting with an empty
-- roster at insert.
create temp table m on commit drop as
  select '00000000-0000-0000-0000-00000000e101'::uuid as meet_def,
         '00000000-0000-0000-0000-00000000e102'::uuid as meet_res;
grant select on m to authenticated;
insert into public.meetings (id, commission_id, meeting_number, title, scheduled_start, visibility_policy)
select m.meet_def, k.comm_x, 990101, 'Reunião pública da comissão', now(), 'commission_default' from m, k;
insert into public.meetings (id, commission_id, meeting_number, title, scheduled_start, visibility_policy)
select m.meet_res, k.comm_x, 990102, 'Reunião reservada', now(), 'commission_default' from m, k;
insert into public.meeting_attendees (meeting_id, user_id, role, attendance)
select m.meet_res, k.st_x, 'membro', 'summoned' from m, k;
update public.meetings set visibility_policy = 'participants_only'
  where id = (select meet_res from m);

-- A submitted response (the form-arm CONTROL) + a REAL case + a REAL interview
-- (the relocated fail-closed fixtures — visible sources of unregistered kinds).
create temp table r on commit drop as
  select '00000000-0000-0000-0000-00000000e201'::uuid as resp_sub;
grant select on r to authenticated;
insert into public.responses (id, form_version_id, commission_id, created_by, status, started_at, submitted_at)
select r.resp_sub, k.ver_u, k.comm_x, k.st_x, 'submitted', now(), now() from r, k;

create temp table cs on commit drop as
  select '00000000-0000-0000-0000-00000000e301'::uuid as case_a,
         '00000000-0000-0000-0000-00000000e302'::uuid as iv_a;
grant select on cs to authenticated;
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy, status)
select cs.case_a, k.comm_x, 990103, k.sa_x, 'commission_default', 'in_review' from cs, k;
insert into public.case_interviews (id, commission_id, case_id, interview_category, created_by)
select cs.iv_a, k.comm_x, cs.case_a, 'administrative', k.sa_x from cs, k;

-- Registry ids + credentials; objects pre-exist for EVERY id a mint may reach,
-- including the denial probes (authority must be the only gate).
create temp table d on commit drop as
  select '00000000-0000-0000-0000-00000000e401'::uuid as doc_m1,
         '00000000-0000-0000-0000-00000000e402'::uuid as doc_m2,
         '00000000-0000-0000-0000-00000000e403'::uuid as doc_c1;
grant select on d to authenticated;
create temp table tk on commit drop as
  select 'MEETTOKEN1AAAABBBBCCCCDDDDEEEEFFFF'::text as mtok1,
         'MEETTOKEN2AAAABBBBCCCCDDDDEEEEFFFF'::text as mtok2,
         'MEETTOKEN3AAAABBBBCCCCDDDDEEEEFFFF'::text as mtok3,
         'MNPQRS2345'::text as msc1,
         'NPQRST2345'::text as msc2,
         'PQRSTU2345'::text as msc3;
grant select on tk to authenticated;
insert into storage.objects (bucket_id, name)
select 'printed-documents', 'std/' || doc_m1 || '.pdf' from d;
insert into storage.objects (bucket_id, name)
select 'printed-documents', 'std/' || doc_m2 || '.pdf' from d;
insert into storage.objects (bucket_id, name)
select 'printed-documents', 'std/' || doc_c1 || '.pdf' from d;

-- ── 0. Preconditions (asserted, never assumed) ───────────────────────────────
select is(app.feature_enabled('document_printing'), true,
  't1 PRECONDITION: document_printing ON');
select is(app.feature_enabled('audit_trail'), true,
  't2 PRECONDITION: audit_trail ON');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.meetings where id = (select meet_def from m)), 1,
  't3 PRECONDITION: the meeting fixture is real under RLS');
reset role;
select is(app.can_reach_meeting((select meet_def from m), (select st_x from k)), true,
  't4 PRECONDITION: the delegate predicate admits a member on a commission_default meeting');
select ok(app.can_reach_meeting((select meet_res from m), (select st_x from k))
      and not app.can_reach_meeting((select meet_res from m), (select st_x2 from k)),
  't5 PRECONDITION ⭐: participants_only discriminates — attendee st_x in, member-non-attendee st_x2 out (the inner gate is real)');

-- ── 1. The meeting arm — ALLOW legs ─────────────────────────────────────────
select is(app.can_view_printed_document('meeting', (select meet_def from m), (select st_x from k)), true,
  't6 arm: a commission member sees a commission_default meeting''s prints');
select is(app.can_view_printed_document('meeting', (select meet_res from m), (select st_x from k)), true,
  't7 arm: an ATTENDEE sees a participants_only meeting''s prints');

-- ── 2. The meeting arm — DENY legs (the D8 drill's targets) ──────────────────
select is(app.can_view_printed_document('meeting', (select meet_res from m), (select st_x2 from k)), false,
  't8 arm: a member who is NOT an attendee is denied on participants_only');
select is(app.can_view_printed_document('meeting', (select meet_def from m), (select st_y from k)), false,
  't9 arm: foreign-commission staff denied');
select is(app.can_view_printed_document('meeting', (select meet_def from m), (select oa_b from k)), false,
  't10 ⭐ NO-ADMIN-ARM delta: org_admin is DENIED — the meetings domain admits members only (C7 cut); the module never grants sight the domain doesn''t (D11)');
select is(app.can_view_printed_document('meeting', (select meet_def from m), (select ha_b from ha)), false,
  't11 ⭐ NO-ADMIN-ARM delta: hospital_admin is DENIED too');
select is(app.can_view_printed_document('form_response', (select resp_sub from r), (select oa_b from k)), true,
  't12 CONTROL: the SAME org_admin passes the form_response arm — t10/t11 measure the meeting arm''s semantics, not a broken helper');
select is(app.can_view_printed_document('meeting', (select meet_def from m), (select admin from k)), false,
  't13 ⭐ platform_admin denied (D11 noun rule, meeting kind)');

-- ── 3. Mint through the meeting kind ─────────────────────────────────────────
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  $$select public.mint_printed_document(
      (select doc_m1 from d), 'meeting', (select meet_def from m),
      'meeting', 1, repeat('aa', 32),
      (select mtok1 from tk), (select msc1 from tk), false)$$,
  't14 mint: a commission member mints the ata of a commission_default meeting');
reset role;
select is(
  (select status || '|' || storage_path || '|' || commission_id::text
     from public.printed_documents where id = (select doc_m1 from d)),
  'active|std/' || (select doc_m1 from d) || '.pdf|' || (select comm_x from k),
  't15 mint: active, path derived, commission resolved via commission_of_meeting (per-kind CASE site 2)');
select is((select count(*)::int from public.audit_log
            where action = 'document.minted' and entity_id = (select doc_m1 from d)), 1,
  't16 audit: document.minted emitted');
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$select public.mint_printed_document(
      (select doc_m2 from d), 'meeting', (select meet_def from m),
      'form_response', 1, repeat('aa', 32),
      (select mtok2 from tk), (select msc2 from tk), false)$$,
  'HC0D1', null,
  't17 template coherence: a form_response template on a meeting mint is refused (per-kind CASE site 1)');
reset role;
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select throws_ok(
  $$select public.mint_printed_document(
      (select doc_m2 from d), 'meeting', (select meet_def from m),
      'meeting', 1, repeat('aa', 32),
      (select mtok2 from tk), (select msc2 from tk), false)$$,
  '42501', null,
  't18 mint denied: foreign staff cannot mint a meeting ata');
reset role;
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select throws_ok(
  $$select public.mint_printed_document(
      (select doc_m2 from d), 'meeting', (select meet_def from m),
      'meeting', 1, repeat('aa', 32),
      (select mtok2 from tk), (select msc2 from tk), false)$$,
  '42501', null,
  't19 ⭐ platform_admin may not mint an ata (D11 noun rule, write side)');
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$select public.mint_printed_document(
      (select doc_m2 from d), 'meeting', (select meet_def from m),
      'meeting', 1, repeat('bb', 32),
      (select mtok2 from tk), (select msc2 from tk), false)$$,
  't20 supersession: re-minting the same (meeting, template) succeeds for another viewer');
reset role;
select is(
  (select status || '|' || (superseded_at is not null)::text
     from public.printed_documents where id = (select doc_m1 from d)),
  'superseded|true',
  't21 supersession: the prior ata print flipped in-transaction');
select is((select count(*)::int from public.printed_documents
            where source_kind = 'meeting' and source_id = (select meet_def from m)
              and template_key = 'meeting' and status = 'active'), 1,
  't22 supersession: exactly ONE active ata per meeting');

-- ── 4. Open / RLS breadth / lookup on the meeting kind ───────────────────────
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select storage_path || '|' || status || '|' || contains_phi::text
     from public.open_printed_document((select doc_m2 from d))),
  'std/' || (select doc_m2 from d) || '.pdf|active|false',
  't23 open: an authorized member gets the streaming triple');
reset role;
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select is((select count(*)::int from public.open_printed_document((select doc_m2 from d))), 0,
  't24 ⭐ platform_admin may not OPEN an ata print (no row, no audit)');
select is((select count(*)::int from public.printed_documents), 0,
  't25 ⭐ platform_admin reads ZERO registry rows (registry non-empty — the zero discriminates)');
reset role;
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.printed_documents), 2,
  't26 RLS breadth: a plain member sees BOTH prints of the commission_default meeting (the arm''s member breadth is real)');
reset role;
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.printed_documents), 0,
  't27 RLS: foreign staff reads zero');
reset role;
select is(
  (select matched::text || '|' || status || '|' || source_kind || '|' || hospital_name
     from public.lookup_printed_document((select mtok2 from tk), null)),
  'true|active|meeting|Hosp Bootstrap',
  't28 lookup: the anemic tuple reports kind=meeting');
select is(
  (select document_id from public.lookup_printed_document((select mtok2 from tk), (select st_x2 from k))),
  (select doc_m2 from d),
  't29 lookup: a member viewer resolves the registry id THROUGH the meeting arm');

-- ── 5. Revoke on the meeting kind ────────────────────────────────────────────
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$select public.revoke_printed_document((select doc_m2 from d), 'wrong_data', 'Tentativa do emissor')$$,
  '42501', null,
  't30 revoke: a plain-staff minter cannot revoke an ata print');
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$select public.revoke_printed_document((select doc_m2 from d), 'wrong_data', 'Ata emitida com dados incorretos.')$$,
  't31 revoke: the commission staff_admin revokes');
reset role;
select ok(
  (select status = 'revoked' and revoked_reason_class = 'wrong_data'
     from public.printed_documents where id = (select doc_m2 from d)),
  't32 revoke: state recorded');

-- ── 6. Fail-closed keystones, RELOCATED onto REAL fixtures ⭐ ────────────────
select is(app.can_read_case((select case_a from cs), (select sa_x from k)), true,
  't33 PRECONDITION ⭐: sa_x reads case_a IN FULL — the case fixture is real, so t34''s false is the ELSE, never a missing row');
select is(app.can_view_printed_document('case', (select case_a from cs), (select sa_x from k)), false,
  't34 ⭐ FAIL-CLOSED: the case arm is UNREGISTERED through P2 — visible source, unreadable print kind (ADR 0104 D3)');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$select public.mint_printed_document(
      (select doc_c1 from d), 'case', (select case_a from cs),
      'case', 1, repeat('cc', 32),
      (select mtok3 from tk), (select msc3 from tk), false)$$,
  '42501', null,
  't35 ⭐ FAIL-CLOSED, write side: the case kind cannot mint (object EXISTS — authority is the only gate)');
reset role;
select is(app.can_read_interview((select iv_a from cs), (select sa_x from k)), true,
  't36 PRECONDITION: sa_x reads the interview — the fixture is real');
select is(app.can_view_printed_document('interview', (select iv_a from cs), (select sa_x from k)), false,
  't37 ⭐ FAIL-CLOSED: the interview arm is UNREGISTERED through P3 — visible source, unreadable print kind');
select is(app.can_view_printed_document('kind_inexistente', (select meet_def from m), (select sa_x from k)), false,
  't38 FAIL-CLOSED: an unknown kind is false, never an error, never true');

select * from finish();
rollback;
