-- =============================================================================
-- AUTHZ · A2 — the capability resolver. ADR 0078 D1/D2/D11, A15/A16, A24, A36.
--
-- WHAT THIS PROVES. A2 is a **MECHANISM SWAP**: `_case_caps` becomes the one semantic
-- source for case authorization and the four predicates become thin projections of it.
-- Semantics must not move. The population proof is the 392-cell A/B matrix (measured
-- separately on the live catalog: **LOST = 0, GAINED = 0** over 1568 predicate-cells,
-- 369 reachable). THIS file pins the ARMS that matrix cannot name.
--
-- ⛔ A2 IS NEITHER A DENIAL NOR A NARROWING — IT IS AN EQUIVALENCE, so §7.7 bites from
-- BOTH sides: a resolver that grants nothing passes every negative by construction, and
-- a resolver that grants everything passes every positive. Every keystone below is
-- therefore PAIRED — each source has a positive arm (it still reaches) AND the
-- non-implications it must NOT confer (never PHI, never write, never the board row).
--
-- ⭐⭐ THE FIXTURE IS THE TRAP, AND IT IS WHY THE PRE-FLIGHT BLOCK EXISTS.
-- A keystone measures the arm its PRINCIPAL actually holds, not the arm its NAME
-- suggests. On this program: an assignee keystone measured the RECUSAL arm; an
-- exclusion keystone raised on AUTHORITY and passed asserting nothing; a persona named
-- `admin` has `is_admin = false`. So every principal below is asserted to hold ONLY the
-- arm under test BEFORE the arm is measured — and the excluded principal in K9 is MADE
-- authorized (coordinator + grant) so that his denial cannot come from lacking
-- authority. No seeded persona is both excluded and authorized (233's finding).
--
-- Falsifiability is NOT self-evident from a green run — proven separately, ONE FUNCTION
-- AT A TIME, by supabase/tests/mutation/a2-mutation-audit.sh. A test that cannot fail is
-- not evidence (§7.1). Review found none of the seven vacuous keystones on this program;
-- reverting the fix found every one.
-- =============================================================================
begin;
select plan(54);   -- ADR 0078 Stage B: K3/K12 (the retired flag-OFF branch, 8 assertions) removed

update app.feature_flags set enabled = true
  where key in ('case_access', 'case_referrals', 'case_patient', 'case_participants',
                'meetings', 'cases_multi_phase', 'case_narratives');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as u_nsp,     -- ⚠ NAME TRAP (§7.2 #4): this persona is
                                            -- called `admin` and has is_admin = FALSE.
                                            -- Used here as a plain user made NSP operator.
         (v->>'sa_x')::uuid   as sa_x,      -- coordinator of comm_x
         (v->>'st_x')::uuid   as st_x,      -- plain member of comm_x — no other arm
         (v->>'st_x2')::uuid  as st_x2,     -- plain member + narrative assignee
         (v->>'sa_y')::uuid   as sa_y,      -- foreign coordinator -> made read-grantee
         (v->>'st_y')::uuid   as st_y,      -- foreign staff -> made org_admin of org_x
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         (v->>'form_u')::uuid as form_u,
         (v->>'ver_u')::uuid  as ver_u,
         app.org_of_commission((v->>'comm_x')::uuid)      as org_x,
         app.hospital_of_commission((v->>'comm_x')::uuid) as hosp_x
  from ctx;
grant select on k to authenticated;

-- ---------------------------------------------------------------------------
-- ⭐ FLAG ASSERTIONS (§7.3 / M4). The updates above are an ASSUMPTION until asserted,
-- and this stack is reset constantly — a reading is not a fact until it is pinned to
-- the state being claimed about. Only the `enabled` column is the flag; a flag's
-- `description` is prose, and believing the prose put a false claim into a permanent
-- ADR and called a LIVE PHI arm inert.
-- ---------------------------------------------------------------------------
select is((select exists (select 1 from app.feature_flags where key = 'case_access')), false,
  'B4: the case_access flag is RETIRED — a single always-on path (the S5L flag-OFF arms are deleted, D9)');
select is(app.feature_enabled('case_referrals'), true,
  'FLAG ⭐: case_referrals is ON — the NSP arm is LIVE, not inert (its description says "Ships OFF"; the enabled column is the flag)');
select is(app.feature_enabled('case_patient'), true,
  'FLAG: case_patient is ON — else the PHI writer rejects and every PHI keystone measures an empty fixture');

-- ===========================================================================
-- FIXTURE
--   c1 = commission_default, PHI-bearing   — the ordinary case
--   c2 = explicit_grants_only, PHI-bearing — the ethics case
-- ===========================================================================
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy, patient_enabled)
values ('00000000-0000-0000-0000-0000000a2001', (select comm_x from k), 94001, (select sa_x from k),
        'commission_default', true),
       ('00000000-0000-0000-0000-0000000a2002', (select comm_x from k), 94002, (select sa_x from k),
        'explicit_grants_only', true);

-- The PHI itself, through the real coordinator door.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.set_participant_patient('00000000-0000-0000-0000-0000000a2001', null, 'Paciente A2', 'MRN-A2-001');
select public.set_participant_patient('00000000-0000-0000-0000-0000000a2002', null, 'Paciente A2 Etica', 'MRN-A2-002');
reset role;

-- st_x2's ONLY arm on c1 is a narrative assignment.
insert into public.case_narrative_types (id, commission_id, label, position)
values ('00000000-0000-0000-0000-0000000a2010', (select comm_x from k), 'Relato', 1);
insert into public.case_narratives (id, case_id, narrative_type_id, type_label, display_position, assigned_to)
values ('00000000-0000-0000-0000-0000000a2011', '00000000-0000-0000-0000-0000000a2001',
        '00000000-0000-0000-0000-0000000a2010', 'Relato', 1, (select st_x2 from k));

-- st_y is MADE an org_admin of org_x (bootstrap ships no org_admin persona).
insert into public.memberships (principal_id, organization_id, role)
values ((select st_y from k), (select org_x from k), 'org_admin');

-- u_nsp is MADE an NSP coordinator at hosp_x, and c1 is MADE referral-touched.
insert into public.memberships (principal_id, organization_id, hospital_id, role)
values ((select u_nsp from k), (select org_x from k), (select hosp_x from k), 'nsp_coordinator');
insert into public.case_referral
  (id, code, source_case_id, source_commission_id, target_commission_id, type_label,
   subject, status, response_expected, has_patient, created_by)
values ('00000000-0000-0000-0000-0000000a2020', 'REF-A2-1',
        '00000000-0000-0000-0000-0000000a2001', (select comm_x from k), (select comm_y from k),
        'Notificação', 'Assunto A2', 'sent', false, false, (select sa_x from k));

-- sa_y is MADE a grantee on c1 with read_standard_phi (a foreign coordinator, so the
-- grant is his ONLY arm). PHI is now a per-column grant — K10 needs him to reach PHI.
select test_helpers.grant_ca('00000000-0000-0000-0000-0000000a2001', (select sa_y from k), 'read',
       (select sa_x from k), null, null, true);

-- A meeting that discusses c1 and c2 — the ONE surface `read_case_deliberation` gates.
insert into public.meetings (id, commission_id, meeting_number, title, scheduled_start)
values ('00000000-0000-0000-0000-0000000a2030', (select comm_x from k), 9401, 'Reunião A2', now());
insert into public.meeting_cases (meeting_id, case_id) values
  ('00000000-0000-0000-0000-0000000a2030', '00000000-0000-0000-0000-0000000a2001'),
  ('00000000-0000-0000-0000-0000000a2030', '00000000-0000-0000-0000-0000000a2002');

-- ===========================================================================
-- ⭐ PRE-FLIGHT — each principal holds ONLY the arm under test.
-- Without these, every keystone below could be measuring a different arm and would be
-- green while asserting nothing. This is the block that makes the rest evidence.
-- ===========================================================================
select is(app.is_staff_admin_of_for((select comm_x from k), (select st_x from k)), false,
  'PRE ⭐: the plain member is NOT a coordinator');
select is(app.is_member_of_for((select comm_x from k), (select st_x from k)), true,
  'PRE ⭐: …but he IS an active member — the member arm is genuinely available to him');
select is((select exists (select 1 from public.case_access_grants
           where case_id = '00000000-0000-0000-0000-0000000a2001' and principal_id = (select st_x from k))), false,
  'PRE ⭐: the plain member holds NO grant — nothing else can confound his cells');
select is(app.is_case_excluded('00000000-0000-0000-0000-0000000a2001', (select st_x from k)), false,
  'PRE ⭐: the plain member is NOT excluded — a poisoned fixture would mask a widening (proven trap)');
select is(app.is_staff_admin_of_for((select comm_x from k), (select st_x2 from k)), false,
  'PRE ⭐: the narrative assignee is NOT a coordinator — assignment is his ONLY arm');
select is(app.is_commission_admin_of_for((select comm_x from k), (select st_y from k)), true,
  'PRE ⭐: the org_admin arm resolves for comm_x (the source A24 has no row for)');
select is(app.is_member_of_for((select comm_x from k), (select st_y from k)), false,
  'PRE ⭐: …and the org_admin is NOT a member of comm_x — so his cells measure the ORG arm, not the member arm');
select is(app.is_pqs_operator_of_for((select hosp_x from k), (select u_nsp from k)), true,
  'PRE ⭐: the NSP persona is a PQS operator of the case''s hospital');
select is(app.is_member_of_for((select comm_x from k), (select u_nsp from k)), false,
  'PRE ⭐: …and is NOT a member of comm_x — his reach comes ONLY through the referral arm');
select is(app.is_member_of_for((select comm_x from k), (select sa_y from k)), false,
  'PRE ⭐: the grantee is NOT a member of comm_x — the grant is his ONLY arm');

-- ===========================================================================
-- STRUCTURAL — the resolver's own contract.
-- ===========================================================================
select is(app.has_case_capability('00000000-0000-0000-0000-0000000a2001', (select sa_x from k), 'read_case_content'),
          app.can_read_case('00000000-0000-0000-0000-0000000a2001', (select sa_x from k)),
  'A2 STRUCTURAL: can_read_case IS the read_case_content projection (same answer, one source)');
select throws_ok(
  $$ select app.has_case_capability('00000000-0000-0000-0000-0000000a2001',
       '00000000-0000-0000-0000-000000000001'::uuid, 'read_case_contentt') $$,
  'HC0A2', null,
  'A2 STRUCTURAL ⭐: an unknown capability name RAISES — a typo must never resolve to a silent "denied"');
select is(app._case_caps('00000000-0000-0000-0000-0000000a2001', null), 0,
  'A2 step 1: a null principal resolves to 0');
select is(app._case_caps('00000000-0000-0000-0000-00000000dead', (select sa_x from k)), 0,
  'A2 step 3: an unknown case fails CLOSED, even for the coordinator');

-- ===========================================================================
-- K1 — the coordinator keeps everything he has today.
-- ===========================================================================
select is(app.can_read_case('00000000-0000-0000-0000-0000000a2001', (select sa_x from k)), true,
  'K1 coordinator: reads case content');
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000a2001', (select sa_x from k)), true,
  'K1 coordinator: reaches the PHI door');
select is(app.can_write_case_content('00000000-0000-0000-0000-0000000a2001', (select sa_x from k)), true,
  'K1 coordinator: writes case content');
-- ⛔ NOT `public.cases`, AND THE MUTATION AUDIT IS WHY. `cases` has TWO permissive
-- policies: `cases_select` (can_read_case_or_admin, which carries its own deny) and
-- `cases_staff_admin_write` — **FOR ALL**, so it grants SELECT too, on
-- `(is_staff_admin_of OR is_commission_admin_of) AND NOT is_case_excluded`, which never
-- touches the resolver. A coordinator therefore reads `cases` whatever _case_caps says:
-- asserted against `cases` first, this keystone stayed GREEN with the coordinator
-- source DELETED. `case_participants_select` is `app.can_read_case(case_id, auth.uid())`
-- — a pure projection — so this row read measures the resolver.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_participants
           where case_id = '00000000-0000-0000-0000-0000000a2001'), 1,
  'K1 coordinator ⭐ ROWS: reads the case row under RLS through a RESOLVER-gated door (not merely a predicate''s return value)');
select is((select (public.get_case_patient('00000000-0000-0000-0000-0000000a2001'))->>'mrn'), 'MRN-A2-001',
  'K1 coordinator ⭐ ROWS: reads the MRN through the audited single door');
reset role;

-- ===========================================================================
-- K11 — the coordinator does NOT hold read_restricted_phi (ADR keystone 31 / D5·6).
-- He may ISSUE it; he does not HAVE it. "Coordinator = full authority" hands him the
-- restricted bit and NO keystone caught that before this one.
-- ===========================================================================
select is(app.has_case_capability('00000000-0000-0000-0000-0000000a2001', (select sa_x from k), 'read_restricted_phi'),
          false,
  'K11 ⭐ (ADR keystone 31): the coordinator does NOT hold read_restricted_phi — he delegates it without holding it');
select is(app.has_case_capability('00000000-0000-0000-0000-0000000a2001', (select sa_x from k), 'manage_case_access'),
          true,
  'K11 twin: …but he DOES hold manage_case_access — the non-holding above is not a blanket denial');

-- ===========================================================================
-- K2 — the org-admin arm (source (a)). ⛔ UPDATED BY A4 (20260730): A4 has now REMOVED
-- this source. At A2 this asserted `can_read_case = true` ("A2 must NOT execute A4's
-- removal"); A4 landed the removal, so the assertion is INVERTED here to track the live
-- truth (the behaviour changed, the test follows it). The comprehensive negative +
-- positive twins live in 235. The one arm A4 KEEPS is manage_case_access (A24·2: A4's
-- scope is Content and PHI; granting is neither) — asserted below so this block still
-- has a live positive, and so the a2-mutation-audit's `drop_orgadmin` case has a
-- non-vacuous RED target (it now inverts THIS bit, not the removed content bit).
-- ===========================================================================
select is(app.can_read_case('00000000-0000-0000-0000-0000000a2001', (select st_y from k)), false,
  'K2 ⭐ source (a) — A4 REMOVED IT: the org_admin no longer reads case content (D4·1). Full twins in 235');
select is(app.has_case_capability('00000000-0000-0000-0000-0000000a2001', (select st_y from k), 'manage_case_access'), true,
  'K2 ⭐ THE ARM A4 KEEPS: the org_admin STILL holds manage_case_access (0 consumers today — A36 — kept on SCOPE grounds, A24·2)');
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000a2001', (select st_y from k)), false,
  'K2 twin ⭐: …and reaches NO PHI — the PHI door never carried an org arm (Rule 12), unchanged by A4');
select is(app.can_write_case_content('00000000-0000-0000-0000-0000000a2001', (select st_y from k)), false,
  'K2 twin: …and cannot write case content — the org arm never conferred write');

-- ===========================================================================
-- K4 — source (c): nsp_referral_touched is LIVE for CONTENT. Without it Stage A silently
-- revokes live NSP content reach. Its PHI half was REMOVED at D8/N1 (Gate 2) — the pin
-- below now asserts the post-removal truth (content-only), and 247 K-N1a/K-N1d carry the
-- mutation-falsifiable version of it.
-- ===========================================================================
select is(app.can_read_case('00000000-0000-0000-0000-0000000a2001', (select u_nsp from k)), true,
  'K4 ⭐ source (c): the NSP operator reads content on a referral-touched case (the arm is LIVE — the flag''s prose lied)');
select is(app.can_read_case('00000000-0000-0000-0000-0000000a2002', (select u_nsp from k)), false,
  'K4 twin ⭐: …and reads NOTHING on the case no referral touches — the arm is referral-scoped, not blanket NSP authority');
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000a2001', (select u_nsp from k)), false,
  'K4 ⭐ (D8/N1 LANDED): the NSP arm no longer confers PHI — content reach retained, patient-identifier arm removed. NSP obtains case PHI only via an explicit grant until Stage D');

-- ===========================================================================
-- K5 — assignment: content YES, PHI NO (defect ①/M3), write NO (D10).
-- ⛔ Keep the axes separate — conflating them is what made two keystones vacuous.
-- ===========================================================================
select is(app.can_read_case('00000000-0000-0000-0000-0000000a2001', (select st_x2 from k)), true,
  'K5 ⭐ assignment KEEPS content: the narrative assignee still reads the case');
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000a2001', (select st_x2 from k)), false,
  'K5 ⭐ assignment CONFERS NO PHI (defect ① / M3): assignment is content reach, never the MRN');
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select (public.get_case_patient('00000000-0000-0000-0000-0000000a2001')) is null), true,
  'K5 ⭐ ROWS / Rule 12: …and the audited door returns NULL — he reads ZERO identifier rows');
reset role;

-- ===========================================================================
-- K6 — NO assignment arm on write_case_content (D10). A deliberate divergence from the
-- read side. Do not "fix" it.
-- ===========================================================================
select is(app.can_write_case_content('00000000-0000-0000-0000-0000000a2001', (select st_x2 from k)), false,
  'K6 ⭐ (D10): the assignee canNOT write case content — no assignment arm on the write bit, deliberately');
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
-- ⚠ The SQLSTATE is pinned to '42501' DELIBERATELY. On the first run this caught
-- 42703 (my invented column name) and failed LOUDLY — with a bare `null` errcode it
-- would have been GREEN while asserting nothing about the write policy. §7.1's
-- "throws_ok catching the wrong error" trap, caught by the structural defence.
select throws_ok(
  $$ insert into public.case_events (case_id, kind, body)
     values ('00000000-0000-0000-0000-0000000a2001', 'note', 'x') $$,
  '42501', null,
  'K6 ⭐ ROWS: …and the write policy rejects him at the table (the bit is enforced, not decorative)');
reset role;

-- ===========================================================================
-- K7 — a manual_grant confers PHI iff read_standard_phi is set (B1 — DEFECT ①·2
-- CLOSED). sa_y holds a read_standard_phi grant, so he reaches PHI via the COLUMN, not
-- the read level; a plain read/write grant never does (230 / 238 prove the flip).
-- ===========================================================================
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000a2001', (select sa_y from k)), true,
  'K7 ⭐ (defect ①·2 CLOSED): a read_standard_phi grantee reaches the PHI door — via the column, not the read level');
select is(app.can_write_case_content('00000000-0000-0000-0000-0000000a2001', (select sa_y from k)), false,
  'K7 twin: …but the grant confers no WRITE (write is a disjoint chain — A16)');

-- ===========================================================================
-- K8 — ⭐ THE LATTICE RUNG THAT BREAKS: read_case_deliberation ⇏ view_case_overview.
-- The member reads the ata section and NOT the case file. This is A15's whole point —
-- conferring read_case_content here was a 12x widening sold as a no-op — and it is the
-- assertion the negative keystones structurally could not catch (ADR keystone 22).
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.meeting_cases
           where case_id = '00000000-0000-0000-0000-0000000a2001'), 1,
  'K8 ⭐ POSITIVE: the ordinary member DOES read the ata section (read_case_deliberation) — the arm is real');
select is((select count(*)::int from public.cases
           where id = '00000000-0000-0000-0000-0000000a2001'), 0,
  'K8 ⭐ THE RUNG BREAKS: …and reads ZERO case rows — deliberation does NOT imply the board row (A15/A16)');
select is((select count(*)::int from public.case_narratives
           where case_id = '00000000-0000-0000-0000-0000000a2001'), 0,
  'K8 ⭐: …and ZERO narratives — the member arm confers the minuted discussion ONLY');
-- ⭐ UPDATED for ADR 0078 C1/A6: the meeting SURFACE is member-wide — the member
-- reads the ata ROW skeleton for the explicit_grants_only case (pre-C1 this was 0;
-- the keystone-4 scope note flags count=0 on the meeting surface as the direct
-- negation of keystones 10/16). The SUMMARY masking is proven in 241 (C1 keystone).
select is((select count(*)::int from public.meeting_cases
           where case_id = '00000000-0000-0000-0000-0000000a2002'), 1,
  'K8 twin (C1/A6): the member reads the ata ROW skeleton for the explicit_grants_only case — content masked, skeleton member-wide');
reset role;
select is(app.has_case_capability('00000000-0000-0000-0000-0000000a2001', (select st_x from k), 'view_case_overview'),
          false,
  'K8 ⭐: the member holds read_case_deliberation WITHOUT view_case_overview — the partial order is not a chain');
select is(app.has_case_capability('00000000-0000-0000-0000-0000000a2001', (select st_x from k), 'read_case_deliberation'),
          true,
  'K8 positive twin: …and he genuinely HOLDS read_case_deliberation (else the line above is vacuous)');

-- ===========================================================================
-- K9 — ⛔ THE HARD DENY PRECEDES EVERY POSITIVE ARM (ADR 0072 D2, verbatim).
-- ⭐ THE FIXTURE IS THE KEYSTONE: sa_x is the coordinator AND holds a grant on c2 —
-- the two strongest positive arms — and is MADE its respondent. If he were merely a
-- plain member, this would raise on AUTHORITY and prove nothing about the deny.
-- ===========================================================================
-- ⚠ The respondent link is NOT a `user_id` on case_participants — it resolves through
-- FOUR joins (case_participants -> case_participant_roles(key='respondent_doctor') ->
-- professional_participants -> professional_profiles.user_id). Taken from
-- app.is_case_respondent's live body, not from a sibling suite: a fixture built on a
-- guessed shape makes the deny fire for the wrong reason, or not at all.
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ('00000000-0000-0000-0000-0000000a2040', (select org_x from k), 'professional',
        'professional_identity', 'Médico denunciado A2');
insert into public.professional_profiles (id, organization_id, user_id, full_name)
values ('00000000-0000-0000-0000-0000000a2042', (select org_x from k), (select sa_x from k), 'Médico denunciado A2');
insert into public.professional_participants (participant_id, professional_profile_id)
values ('00000000-0000-0000-0000-0000000a2040', '00000000-0000-0000-0000-0000000a2042');
insert into public.case_participant_roles
  (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
values ('00000000-0000-0000-0000-0000000a2041', (select org_x from k), 'respondent_doctor',
        'Médico denunciado', array['professional'], true);
insert into public.case_participants (case_id, participant_id, role_id, is_primary_subject)
values ('00000000-0000-0000-0000-0000000a2002', '00000000-0000-0000-0000-0000000a2040',
        '00000000-0000-0000-0000-0000000a2041', true);
select test_helpers.grant_ca('00000000-0000-0000-0000-0000000a2002', (select sa_x from k), 'write', (select sa_x from k));

select is(app.is_case_respondent('00000000-0000-0000-0000-0000000a2002', (select sa_x from k)), true,
  'K9 PRE ⭐ leg 1: the principal IS the respondent of c2');
select is(app.is_staff_admin_of_for((select comm_x from k), (select sa_x from k)), true,
  'K9 PRE ⭐ leg 2: …and IS the coordinator — so a denial below CANNOT be a lack of authority (the vacuity trap)');
select is((select exists (select 1 from public.case_access_grants
           where case_id = '00000000-0000-0000-0000-0000000a2002' and principal_id = (select sa_x from k))), true,
  'K9 PRE ⭐ leg 3: …and holds a WRITE grant on c2 — the deny must out-vote BOTH positive arms');
select is(app._case_caps('00000000-0000-0000-0000-0000000a2002', (select sa_x from k)), 0,
  'K9 ⭐⭐ THE HARD DENY: the respondent resolves to ZERO capabilities — coordinator AND grant notwithstanding');
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000a2002', (select sa_x from k)), false,
  'K9 ⭐ Rule 12: …and reaches no PHI on the case in which he is the accused');
-- ⛔ THE ROW DOOR HERE IS `case_participants`, NOT `cases`, AND THAT IS THE WHOLE
-- POINT. `cases_select` gates on `can_read_case_or_admin`, which carries its OWN
-- respondent+recusal deny and does NOT delegate to the resolver (catalog-verified).
-- Asserting rows through `cases` therefore proves a deny THE RESOLVER DID NOT MAKE —
-- §7.1 trap #2 ("pre-existing deny") verbatim. It was written that way first, and the
-- mutation audit caught it: dropping _case_caps' deny left the assertion GREEN.
-- `case_participants_select` is `app.can_read_case(case_id, auth.uid())` — a pure
-- projection of the resolver — so this row read actually measures step 4.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_participants
           where case_id = '00000000-0000-0000-0000-0000000a2002'), 0,
  'K9 ⭐ ROWS: …and reads ZERO rows for that case under RLS (through a door the RESOLVER gates)');
reset role;

-- ===========================================================================
-- K10 — D3's outer gate survives the swap. A deactivated principal reaches nothing,
-- whatever he still holds. sa_y holds a live grant — the gate must beat it.
-- ===========================================================================
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000a2001', (select sa_y from k)), true,
  'K10 PRE ⭐: the grantee reaches PHI while ACTIVE — the reading must MOVE, else the gate below is vacuous (§7.10)');
-- ⛔ auth.uid() SURVIVES `reset role` (claims_for sets it with set_config(..., local)),
-- and guard_profile_privileged_columns raises for ANY signed-in caller touching
-- is_active. Clearing the claims restores the trusted service-role path. Without this
-- every profile mutation below ABORTS the suite instead of asserting — and an aborted
-- suite is not a red one (§7.1: `red` != `abort`).
select set_config('request.jwt.claims', '', true);
update public.profiles set is_active = false where id = (select sa_y from k);
select is(app._case_caps('00000000-0000-0000-0000-0000000a2001', (select sa_y from k)), 0,
  'K10 ⭐ (D3 / M5 defect ③): a DEACTIVATED grantee resolves to ZERO capabilities');
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000a2001', (select sa_y from k)), false,
  'K10 ⭐ Rule 12: …and reaches no patient identifier');
update public.profiles set is_active = true where id = (select sa_y from k);
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000a2001', (select sa_y from k)), true,
  'K10 ⭐ RESTORED: reactivation restores reach — the gate reads the CURRENT state, not a one-way latch');

-- ===========================================================================
-- ⛔ K3 + K12 REMOVED (ADR 0078 B4/D9). They tested the `case_access` flag-OFF branch
-- (source b) — the S5L legacy member arm that conferred CONTENT and PATIENT IDENTIFIERS
-- to every member. Stage B DELETES that arm and RETIRES the flag, so there is no second
-- body to pin. The surviving member arm confers read_case_deliberation ONLY (A15),
-- never content, never PHI — proven by the member keystones above (flag-independent).
-- The defect ①·2 flip those pins existed to make visible now lands in K7 (above) + 230.
-- ===========================================================================

select * from finish();
rollback;
