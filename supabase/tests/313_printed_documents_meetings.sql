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
select plan(54);

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
-- `explicit_grants_only`: suppresses the MEMBER arm of the capability lattice
-- (A15 confers read_case_deliberation to members only under commission_default)
-- — so st_x is a genuine DELIBERATION-MASKED member specimen for the A7
-- keystones, while sa_x (coordinator) keeps full reach.
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy, status)
select cs.case_a, k.comm_x, 990103, k.sa_x, 'explicit_grants_only', 'in_review' from cs, k;
insert into public.case_interviews (id, commission_id, case_id, interview_category, created_by)
select cs.iv_a, k.comm_x, cs.case_a, 'administrative', k.sa_x from cs, k;

-- The A7 fix-wave fixture: a meeting whose agenda item is CASE-LINKED with
-- gated free text PRESENT, and st_x2 as the RESPONDENT of the linked case
-- (participants-registry chain — the is_case_respondent shape, key
-- 'respondent_doctor', resolved via professional_profiles.user_id).
create temp table mc on commit drop as
  select '00000000-0000-0000-0000-00000000e501'::uuid as meet_case,
         '00000000-0000-0000-0000-00000000e502'::uuid as ai_c1,
         '00000000-0000-0000-0000-00000000e511'::uuid as part_r,
         '00000000-0000-0000-0000-00000000e512'::uuid as prof_r,
         '00000000-0000-0000-0000-00000000e513'::uuid as role_r,
         '00000000-0000-0000-0000-00000000e514'::uuid as cp_r,
         '00000000-0000-0000-0000-00000000e521'::uuid as doc_mc1;
grant select on mc to authenticated;
insert into public.meetings (id, commission_id, meeting_number, title, scheduled_start, visibility_policy)
select mc.meet_case, k.comm_x, 990104, 'Reunião com pauta de caso', now(), 'commission_default' from mc, k;
select set_config('app.in_meeting_rpc', 'on', true);
insert into public.meeting_agenda_items (id, meeting_id, position, title, description)
select mc.ai_c1, mc.meet_case, 0, 'Processo 990103', 'Substância deliberativa presente.' from mc;
insert into public.meeting_cases (meeting_id, case_id, agenda_item_id)
select mc.meet_case, cs.case_a, mc.ai_c1 from mc, cs;
select set_config('app.in_meeting_rpc', 'off', true);
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
select mc.part_r, k.org_b, 'professional', 'professional_identity', 'Dr. Respondente' from mc, k;
insert into public.professional_profiles (id, organization_id, user_id, full_name)
select mc.prof_r, k.org_b, k.st_x2, 'Dr. Respondente' from mc, k;
insert into public.professional_participants (participant_id, professional_profile_id)
select mc.part_r, mc.prof_r from mc;
insert into public.case_participant_roles (id, organization_id, key, display_name, allowed_participant_types)
select mc.role_r, k.org_b, 'respondent_doctor', 'Médico respondente', array['professional'] from mc, k;
insert into public.case_participants (id, case_id, participant_id, role_id)
select mc.cp_r, cs.case_a, mc.part_r, mc.role_r from mc, cs;
insert into storage.objects (bucket_id, name)
select 'printed-documents', 'phi/' || doc_mc1 || '.pdf' from mc;

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
-- QO·B (ADR 0100 D12) INVERTED, 2026-08-08. t12 used to prove "the helper is not
-- broken" by showing the SAME org_admin passed a DIFFERENT kind. QO·B walls the
-- tenancy admin out of the form_response arm too, so that control can no longer be
-- built from oa_b — and the claim it made is now false rather than merely unused.
-- The control's JOB is relocated, not dropped: t6 and t7 above are live ALLOW legs of
-- this very helper (member on commission_default, attendee on participants_only), so
-- t10/t11 still measure the meeting arm's semantics rather than a dead function.
-- The form_response arm's own positives live in 312 (t3 creator, t4 staff_admin).
select is(app.can_view_printed_document('form_response', (select resp_sub from r), (select oa_b from k)), false,
  't12 ⭐ QO·B WALL: the SAME org_admin is denied the form_response arm too — the wall is kind-independent (D12); t6/t7 remain this helper''s live ALLOW legs');
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
-- QA MINOR-4: doc_m2 was minted by sa_x at t20 (st_x minted doc_m1), so the
-- label pins the PLAIN-STAFF property; 312 t30 pins the minter property.
select throws_ok(
  $$select public.revoke_printed_document((select doc_m2 from d), 'wrong_data', 'Tentativa do emissor')$$,
  '42501', null,
  't30 revoke: a plain-staff member cannot revoke an ata print');
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

-- ── 7. A7 full-sight conjunction + A8 PHI labeling (QA fix wave) ─────────────
select is(app.is_case_respondent((select case_a from cs), (select st_x2 from k)), true,
  't39 PRECONDITION: st_x2 IS the respondent of case_a — the participants-registry chain is REAL');
select ok(app.can_read_full_meeting_content((select meet_case from mc), (select sa_x from k))
      and not app.can_read_full_meeting_content((select meet_case from mc), (select st_x from k))
      and not app.can_read_full_meeting_content((select meet_case from mc), (select st_x2 from k)),
  't40 PRECONDITION ⭐: the full-sight predicate DISCRIMINATES — coordinator in, deliberation-masked member out, respondent out (mirrors the live projection terms)');
select is(app.can_view_printed_document('meeting', (select meet_case from mc), (select st_x2 from k)), false,
  't41 ⭐ A7: the RESPONDENT of a linked case is denied the ata — the exact party the projection blinds cannot reach the complete bytes');
select is(app.can_view_printed_document('meeting', (select meet_def from m), (select st_x2 from k)), true,
  't42 CONTROL: the SAME persona passes on the un-linked meeting — t41''s deny is the conjunction, never the persona or reach');
select is(app.can_view_printed_document('meeting', (select meet_case from mc), (select st_x from k)), false,
  't43 ⭐ A7: a member WITHOUT read_case_deliberation is denied where gated text is PRESENT');
select is(app.can_view_printed_document('meeting', (select meet_case from mc), (select sa_x from k)), true,
  't44 A7: the coordinator (full sight) passes — the complete ata remains mintable');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$select public.mint_printed_document(
      (select doc_mc1 from mc), 'meeting', (select meet_case from mc),
      'meeting', 1, repeat('dd', 32),
      'MEETTOKEN4AAAABBBBCCCCDDDDEEEEFFFF', 'QRSTUV2345', true)$$,
  't45 ⭐ A8: a masked-content ata mints with contains_phi=true (the per-kind PHI gate ACCEPTS the presence-derived label for meetings)');
reset role;
select is(
  (select contains_phi::text || '|' || storage_path
     from public.printed_documents where id = (select doc_mc1 from mc)),
  'true|phi/' || (select doc_mc1 from mc) || '.pdf',
  't46 A8: the label drives the phi/ storage bifurcation (the A4 derived-path CHECK, phi arm)');
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.open_printed_document((select doc_mc1 from mc))), 0,
  't47 ⭐ A7, download side: the respondent cannot open the ata about his own process (no row, no audit)');
select throws_ok(
  $$select public.mint_printed_document(
      '00000000-0000-0000-0000-00000000e5aa', 'meeting', (select meet_case from mc),
      'meeting', 1, repeat('dd', 32),
      'MEETTOKEN5AAAABBBBCCCCDDDDEEEEFFFF', 'RSTUVW2345', false)$$,
  '42501', null,
  't48 ⭐ A7, mint side: the respondent cannot mint the ata either — mint AND download alike');
reset role;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$select public.mint_printed_document(
      '00000000-0000-0000-0000-00000000e5bb', 'form_response', (select resp_sub from r),
      'form_response', 1, repeat('dd', 32),
      'MEETTOKEN6AAAABBBBCCCCDDDDEEEEFFFF', 'STUVWX2345', true)$$,
  'HC0D2', null,
  't49 ⭐ A8: the PHI gate stays PER-KIND — form_response still refuses contains_phi=true (forms are PHI-free by classification)');
reset role;
select is((select contains_phi from public.printed_documents where id = (select doc_m1 from d)), false,
  't50 A8: an ata with NO masked-class content labels false and lives under std/ (t15 pins the path)');
select is(app.is_hospital_admin_of_for((select hosp_b from k), (select ha_b from ha)), true,
  't51 CONTROL (QA MINOR-1): ha_b genuinely HOLDS the hospital_admin tier — t11''s deny is the arm''s, never a broken fixture');
-- QA MINOR-2, lead-RULED deliberate (ADR 0104 D11): revocation is a GOVERNANCE
-- act on commission_id — the admin chain may revoke an ata print it cannot
-- download (revoke reveals no content; sight stays domain-scoped). Pinned in
-- BOTH directions so the asymmetry is a decision, not an accident.
select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select is((select count(*)::int from public.open_printed_document((select doc_m1 from d))), 0,
  't52 MINOR-2 pin, sight side: org_admin cannot OPEN the ata print (no meeting-arm admin sight)');
select lives_ok(
  $$select public.revoke_printed_document((select doc_m1 from d), 'minted_in_error', 'Revogação administrativa (D11 — ato de governança)')$$,
  't53 MINOR-2 pin, governance side: the SAME org_admin MAY revoke it (D11 admin chain — deliberate asymmetry)');
reset role;
select ok(
  (select status = 'revoked' and revoked_by = (select oa_b from k)
     from public.printed_documents where id = (select doc_m1 from d)),
  't54 MINOR-2 pin: the revocation is recorded to the admin actor');

select * from finish();
rollback;
