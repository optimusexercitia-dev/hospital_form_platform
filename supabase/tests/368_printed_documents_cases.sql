-- =============================================================================
-- PDF·P3 — the `case` arm keystones (ADR 0144; migrations 20261003002200..002800).
--
-- The D14 floor, plus two keystones of this phase's own and the ACL pins that
-- have no other witness.
--
-- ⭐ WHAT THIS SUITE IS FOR, stated so a later reader does not mistake its
-- shape: `case` is the FIRST PHI-capable print kind. Every other printable kind
-- is PHI-free by classification, so the arms below are the only place the
-- platform's PHI posture and its print registry meet.
--
-- ⚠ NON-VACUITY DISCIPLINE. Several assertions here are ABSENCES — "no mint row",
-- "not fail-open", "the de-identified variant does not leak". An absence passes
-- trivially against a fixture that cannot reach the failing state, so each one
-- carries its POSITIVE TWIN in the same section: the same probe on the arm that
-- must succeed. ⛔ In particular §4's fixture case HAS a patient on file
-- (§0 inserts one) — a "de-identified does not leak" assertion over a case with
-- no `patient_identifiers` row proves the seed is empty, not that the variant
-- excludes anything.
--
-- ⛔ CORRECTION CARRIED HERE ON PURPOSE. Migration `20261003002700`'s header says
-- *"of 51 `app.can_*` functions, 4 are NULL — three of the four were these"*.
-- That sentence is WRONG and the migration cannot be edited (forward-only rule):
-- only ONE of the three (`can_read_full_case_content`) matches `can_*` at all;
-- `case_is_terminal` and `bump_case_print_revision` do not. The correct figures
-- are **4 NULL before the fix, 3 after**. This file pins the ACLs that claim was
-- about, so it is where the next reader of it lands.
-- =============================================================================

begin;
select plan(58);   -- 48 + C-3a's 8 (t28a-h) + C-3b's t38a + M-3's t40a

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'st_y')::uuid   as st_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'form_u')::uuid as form_u,
         (v->>'ver_u')::uuid  as ver_u
  from ctx;
grant select on k to authenticated;

-- ---------------------------------------------------------------------------
-- §0 — FIXTURES
-- ---------------------------------------------------------------------------
create temp table cs on commit drop as
  select '00000000-0000-0000-0000-0000000c0001'::uuid as case_t,   -- terminal, printable
         '00000000-0000-0000-0000-0000000c0002'::uuid as case_d,   -- terminal + disposed
         '00000000-0000-0000-0000-0000000c0003'::uuid as case_n,   -- NON-terminal
         '00000000-0000-0000-0000-0000000c0011'::uuid as part_t,
         '00000000-0000-0000-0000-0000000c0021'::uuid as narr_t;
grant select on cs to authenticated;

create temp table d on commit drop as
  select '00000000-0000-0000-0000-0000000d0001'::uuid as doc_deid,
         '00000000-0000-0000-0000-0000000d0002'::uuid as doc_ident,
         '00000000-0000-0000-0000-0000000d0003'::uuid as doc_deny,
         '00000000-0000-0000-0000-0000000d0004'::uuid as doc_cur;
grant select on d to authenticated;

create temp table tk on commit drop as
  select 'CASETOKEN1AAAABBBBCCCCDDDDEEEEFFFF'::text as t1,
         'CASETOKEN2AAAABBBBCCCCDDDDEEEEFFFF'::text as t2,
         'CASETOKEN3AAAABBBBCCCCDDDDEEEEFFFF'::text as t3,
         'CASETOKEN4AAAABBBBCCCCDDDDEEEEFFFF'::text as t4,
         'CASEAA2345'::text as s1, 'CASEBB2345'::text as s2,
         'CASECC2345'::text as s3, 'CASEDD2345'::text as s4;
grant select on tk to authenticated;

-- Three cases. ⚠ `closed_at` is paired by CHECK (`cases_closed_at_paired`).
insert into public.cases (id, commission_id, organization_id, case_number, label, created_by, patient_mode)
select c.case_t, k.comm_x, app.org_of_commission(k.comm_x), 96801, 'Caso terminal', k.sa_x, 'optional' from cs c, k;
insert into public.cases (id, commission_id, organization_id, case_number, label, created_by, patient_mode)
select c.case_d, k.comm_x, app.org_of_commission(k.comm_x), 96802, 'Caso descartado', k.sa_x, 'optional' from cs c, k;
insert into public.cases (id, commission_id, organization_id, case_number, label, created_by, patient_mode)
select c.case_n, k.comm_x, app.org_of_commission(k.comm_x), 96803, 'Caso em curso', k.sa_x, 'optional' from cs c, k;

-- A PATIENT on case_t. ⛔ Load-bearing for §4: "the de-identified variant does
-- not leak" is a statement about EXCLUSION, and over a case with no patient row
-- it would be a statement about an empty table instead.
insert into public.case_participant_roles (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
select gen_random_uuid(), app.org_of_commission(k.comm_x), 'affected_patient', 'Paciente afetado', array['patient'], true from k
  on conflict (organization_id, key) where case_type_id is null do nothing;
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
select c.part_t, app.org_of_commission(k.comm_x), 'patient', 'patient_phi', 'Paciente' from cs c, k;
insert into public.patient_participants (participant_id) select part_t from cs;
insert into public.case_participants (case_id, participant_id, role_id, added_by)
select c.case_t, c.part_t,
       (select id from public.case_participant_roles
         where organization_id = app.org_of_commission(k.comm_x)
           and key = 'affected_patient' and case_type_id is null),
       k.sa_x from cs c, k;
insert into public.patient_identifiers (participant_id, name, mrn, sex, age_years, unit)
select part_t, 'NOME-DO-PACIENTE', 'MRN-96801', 'female', 67, 'UTI' from cs;
update public.cases set has_patient = true where id = (select case_t from cs);

-- Content so the dossier is not empty.
insert into public.case_narratives (id, case_id, display_label, display_position, status, body_md, created_by)
select c.narr_t, c.case_t, 'Resumo', 1, 'open', 'CORPO', k.sa_x from cs c, k;

-- ⭐ THE CONTENT-WITHOUT-PHI PERSONA (`st_y`). An S3 manual grant confers
-- read_case_content (and, by the lattice, read_case_deliberation) while leaving
-- `read_standard_phi` FALSE. This is the exact caller ADR 0144 D14's floor is
-- about: "case-view WITHOUT the PHI door → identified refused, de-identified
-- allowed". ⚠ Built from a GRANT rather than a role because no role produces
-- this shape: S1 confers PHI too, S5 confers deliberation without content, and
-- S8 confers content without deliberation.
insert into public.case_access_grants
  (case_id, principal_id, source, read_case_content, read_standard_phi, granted_by, reason)
select c.case_t, k.st_y, 'manual_grant', true, false, k.sa_x, 'fixture: conteúdo sem PHI' from cs c, k;
insert into public.case_access_grants
  (case_id, principal_id, source, read_case_content, read_standard_phi, granted_by, reason)
select c.case_d, k.st_y, 'manual_grant', true, false, k.sa_x, 'fixture: conteúdo sem PHI' from cs c, k;

-- A RECUSED member (`st_x`) — STEP 4 hard deny.
--
-- ⛔⛔ THE GRANT BELOW IS LOAD-BEARING, AND IT WAS MISSING UNTIL 2026-08-25. Measured:
-- with the recusal deny removed from `app._case_caps` STEP 4, `st_x` still could not
-- read this case — a plain `staff` member under `commission_default` gets caps = 2
-- (read_case_deliberation only, ADR 0104 A15), never `read_case_content`. So NO verdict
-- in this suite moved when the recusal arm was neutralized: t25/t26/t28 were true
-- because st_x had NO POSITIVE ARM AT ALL, and the `case_recusals` row was decorative.
-- ⭐ t25's own caption said *"STEP 4 hard-denies before every positive arm"* — a true
-- statement about the code and a false one about this fixture, which supplied no
-- positive arm to deny. An S3 grant supplies one, so the deny now overrides a grant and
-- mutation 6 of p3-case-print-mutation-audit.sh can red these four assertions.
-- ⚠ read_standard_phi stays FALSE: the grant must make st_x a CONTENT reader that the
-- recusal overrides, not confer PHI and change what t28 is refusing.
insert into public.case_access_grants
  (case_id, principal_id, source, read_case_content, read_standard_phi, granted_by, reason)
select c.case_t, k.st_x, 'manual_grant', true, false, k.sa_x, 'fixture: arm que a recusa anula' from cs c, k;
insert into public.case_recusals (case_id, user_id, source, reason_md, recused_at)
select c.case_t, k.st_x, 'self', 'impedimento declarado', now() from cs c, k;

-- ⭐⭐ C-3a (added 2026-08-25) — D14's PHASE-ONLY RESPONDENT (`st_x2`), STEP 4's OTHER
-- hard-deny arm. Built HERE, in §0, because it must exist before the terminal walk
-- below: `case_phases` carries a D15 bump trigger, and a phase inserted while the case
-- is ALREADY terminal moves the print revision counter — which would red t7 and t34 for
-- a fixture reason that reads exactly like a defect in the trigger.
--
-- ⛔ ADR 0144 D8's own words: "a recused member, OR A RESPONDENT LINKED TO A SINGLE
-- PHASE, can neither mint nor download the dossier — not even de-identified." Those are
-- the TWO ARMS of `app._case_caps` STEP 4, in the order the body evaluates them
-- (`is_case_respondent`, then `is_recused_from_case`) — not one deny described twice.
-- §6 pins both, and `supabase/tests/mutation/p3-case-print-mutation-audit.sh` removes
-- each while keeping the other: a step with two sibling arms is precisely where one arm
-- silently takes credit for the other's coverage.
--
-- ⛔ THE SHAPE IS NOT GUESSABLE, and a guessed one makes the deny fire for the wrong
-- reason or not at all. `app.is_case_respondent` resolves through FOUR joins —
-- case_participants -> case_participant_roles (key = 'respondent_doctor', a literal) ->
-- professional_participants -> professional_profiles.user_id. There is no `user_id` on
-- case_participants, and NO `case_phases` term anywhere in it. Copied from the sibling
-- print suite's live fixture (`313_printed_documents_meetings.sql:110-119`), which
-- builds this same persona for the MEETING arm of the same A7 keystone.
--
-- ⭐ THE TWO PHASE ASSIGNMENTS ARE THE NON-VACUITY ARGUMENT, not decoration:
--   • on `case_t`, `case_phases.assigned_to = st_x2` is a POSITIVE ARM — _case_caps S4
--     confers read_case_content + read_case_deliberation off that column alone
--     (`230_authz_m3_assignment_phi.sql:106` pins it). STEP 4 returns 0 before S4 is
--     ever reached, so t28d is a deny that OVERRIDES A GRANT — the claim ADR 0072 D2
--     actually makes — rather than the absence of any reach at all.
--   • on `case_n`, the SAME persona holds the SAME arm and is NOT a respondent, so t28c
--     proves the arm is LIVE. Without it, t28d is equally satisfied by an S4 arm that
--     grants nothing to anybody.
create temp table rp on commit drop as
  select '00000000-0000-0000-0000-0000000c0031'::uuid as part_r,
         '00000000-0000-0000-0000-0000000c0032'::uuid as prof_r,
         '00000000-0000-0000-0000-0000000c0033'::uuid as role_r,
         '00000000-0000-0000-0000-0000000c0041'::uuid as ph_t,
         '00000000-0000-0000-0000-0000000c0042'::uuid as ph_n;
grant select on rp to authenticated;

insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
select r.part_r, app.org_of_commission(k.comm_x), 'professional', 'professional_identity', 'Dr. Respondente' from rp r, k;
insert into public.professional_profiles (id, organization_id, user_id, full_name)
select r.prof_r, app.org_of_commission(k.comm_x), k.st_x2, 'Dr. Respondente' from rp r, k;
insert into public.professional_participants (participant_id, professional_profile_id)
select r.part_r, r.prof_r from rp r;
insert into public.case_participant_roles (id, organization_id, key, display_name, allowed_participant_types)
select r.role_r, app.org_of_commission(k.comm_x), 'respondent_doctor', 'Médico respondente', array['professional'] from rp r, k
  on conflict (organization_id, key) where case_type_id is null do nothing;
insert into public.case_participants (case_id, participant_id, role_id, added_by)
select c.case_t, r.part_r,
       (select id from public.case_participant_roles
         where organization_id = app.org_of_commission(k.comm_x)
           and key = 'respondent_doctor' and case_type_id is null),
       k.sa_x from cs c, rp r, k;

-- ⚠ `current_response_id` STAYS NULL on both, deliberately. Attaching a response makes
-- `can_read_full_case_content`'s Axis C (every phase response must pass the
-- `form_response` print arm) bite `st_y` as well — st_y is a member of comm_Y holding a
-- manual grant, so it fails that arm — and t37 (st_y DOES download the de-identified
-- dossier) would red for a fixture reason while t36 kept passing for the wrong one.
insert into public.case_phases (id, case_id, position, title, form_id, form_version_id, assigned_to)
select r.ph_t, c.case_t, 1, 'Apuração', k.form_u, k.ver_u, k.st_x2 from rp r, cs c, k;
insert into public.case_phases (id, case_id, position, title, form_id, form_version_id, assigned_to)
select r.ph_n, c.case_n, 1, 'Apuração', k.form_u, k.ver_u, k.st_x2 from rp r, cs c, k;

-- Walk the two cases to their terminal states, then dispose one.
select set_config('app.in_case_rpc', 'on', true);
update public.cases set status = 'completed', closed_at = now()
  where id in ((select case_t from cs), (select case_d from cs));
update public.cases set phi_disposed_at = now() where id = (select case_d from cs);
select set_config('app.in_case_rpc', 'off', true);

-- Storage objects for every id a mint may reach, including the DENIAL probes:
-- authority must be the only gate that fires (Amendment B otherwise raises
-- HC0D3 first and the denial would be untested).
insert into storage.objects (bucket_id, name, metadata)
select 'documents-phi', app.printed_rendition_storage_path(x), jsonb_build_object('size', 1024, 'mimetype', 'application/pdf')
from (select doc_deid as x from d union all select doc_ident from d
      union all select doc_deny from d union all select doc_cur from d) s;

-- ---------------------------------------------------------------------------
-- §1 — ACL PINS. No other witness exists for these (migrations 002700 / 002800).
-- ⚠ BOTH ROLES: `anon` is the one that would matter if `config.toml` ever
-- exposed schema `app`, and it is the role a DROP+CREATE silently grants.
-- ---------------------------------------------------------------------------
select ok(
  not has_function_privilege('authenticated', 'app.resolve_print_source_state(text,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'app.resolve_print_source_state(text,uuid)', 'EXECUTE'),
  't1 ⭐ ACL: app.resolve_print_source_state is NOT PUBLIC-executable. It is an UNGATED DEFINER state oracle (its authorization lives one level up, in public.print_source_state), and migration 002400 DROP+CREATEd it to add an OUT param — which resets proacl to NULL, and for a FUNCTION the default IS execute-to-PUBLIC');

select ok(
  not has_function_privilege('authenticated', 'app.can_read_full_case_content(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'app.can_read_full_case_content(uuid,uuid)', 'EXECUTE'),
  't2 ACL: the new A7 predicate is not PUBLIC-executable (002700)');

select ok(
  not has_function_privilege('authenticated', 'app.bump_case_print_revision(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'app.bump_case_print_revision(uuid)', 'EXECUTE'),
  't3 ACL: the ONE writer of case_print_revisions is not PUBLIC-executable (002700)');

select ok(
  has_function_privilege('authenticated', 'public.print_source_state(text,uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.print_source_state(text,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.print_source_state(text,uuid)', 'EXECUTE'),
  't4 ⭐ ACL OVER-REVOKE TWIN: the PUBLIC door KEPT its authenticated + service_role grants after its own DROP+CREATE, and did NOT gain anon. A revoke that stranded the door would look identical to a correct fix in t1-t3 — the app would 404 with a catalog that reads perfect');

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_name = 'case_print_revisions' and grantee in ('anon', 'authenticated')),
  0,
  't5 ACL: case_print_revisions grants NOTHING to anon/authenticated. ⚠ Supabase default privileges DO grant authenticated on new public tables, so the revoke in 002200 is load-bearing, not decorative');

select ok(
  (select relrowsecurity from pg_class where relname = 'case_print_revisions'),
  't6 case_print_revisions has RLS enabled (two locks: the ACL above and RLS-with-no-policies)');

-- ---------------------------------------------------------------------------
-- §2 — THE SEEDED STARTING REVISION, pinned as a KNOWN VALUE.
-- ⚠ The D15 triggers fire during seed.sql itself, so a seeded completed case
-- does NOT start at 0. A test that assumed 0 would fail in the direction that
-- looks like a bug in the trigger rather than in the assumption.
-- ---------------------------------------------------------------------------
-- ⭐ MEASURED, NOT ASSUMED — and the first draft of this assertion was WRONG,
-- which is worth recording because the mistake is the interesting part.
-- I expected 1, reasoning that "the terminal-status UPDATE fires the D15 self
-- trigger". It does not: `app.trg_bump_case_revision_self` is gated on
-- **OLD.status**, and returns early when the case was NOT already terminal —
-- *"was not locked: nothing registered, nothing to invalidate"*. ⇒ ENTERING the
-- lock never bumps; only writes made while ALREADY terminal do. Every §0 content
-- insert likewise happened pre-terminal and `app.bump_case_print_revision`
-- no-ops for a non-terminal case.
-- ⛔ That gate is not incidental — without it every case would arrive at its lock
-- point already at revision 1+, and a print minted immediately after closing
-- would be racing a counter that moved for reasons no reader could see.
select is(app.print_source_revision('case', (select case_t from cs)), 0,
  't7 ⭐ a freshly-closed case sits at revision 0 — ENTERING the terminal state does NOT bump (the self-trigger is gated on OLD.status). §11 pins the other half: a write made WHILE terminal does bump');

select is(app.print_source_revision('case', gen_random_uuid()), 0,
  't8 an unknown case reads revision 0 — the absent-row rule, which is what makes a never-bumped case match a print storing 0');

-- ---------------------------------------------------------------------------
-- §3 — REGISTRATION / WATERMARK, and the SET-EQUALITY keystone.
-- ---------------------------------------------------------------------------
select ok(app.print_source_registers('case', (select case_t from cs)),
  't9 a completed, undisposed case REGISTERS (ADR 0144 D3)');
select is(app.print_source_watermark('case', (select case_t from cs)), 'final',
  't10 …and stamps FINAL — both axes turn together for a terminal case');

select ok(not app.print_source_registers('case', (select case_d from cs)),
  't11 ⭐ a DISPOSED case does not register — dispose_case_phi guts the content while leaving cases.status untouched, so the status term alone cannot see it');
select is(app.print_source_watermark('case', (select case_d from cs)), 'draft',
  't12 ⭐ …and the watermark drops WITH it. Keyed on status alone this is registers=false + watermark=final: ADR 0125 D5''s forbidden FOURTH CELL, reached');

select ok(not app.print_source_registers('case', (select case_n from cs)),
  't13 a non-terminal case yields a prévia, never a registered emission');

-- ⭐ KEYSTONE (i) — SET EQUALITY between the two separately-declared status sets.
-- `app.case_is_terminal` decides WHEN the revision counter may move; the case arm
-- of `print_source_registers` decides WHEN a print registers. They are declared
-- separately because ADR 0125 D8 / 0126 D7 forbid factoring the print axes into a
-- shared helper — but they MUST agree, and nothing but this assertion says so.
-- ⛔ If the registering set ever widens without case_is_terminal widening, content
-- drift on the new status goes UNBUMPED and /verificar starts claiming currency
-- for a dossier whose text has changed.
select is(
  (select coalesce(array_agg(st order by st), array[]::text[]) from unnest(array['not_started','in_review','pending','completed','cancelled']) st
    where app.case_is_terminal((select id from public.cases where status = st and commission_id = (select comm_x from k) limit 1))),
  (select coalesce(array_agg(st order by st), array[]::text[]) from unnest(array['not_started','in_review','pending','completed','cancelled']) st
    where exists (select 1 from public.cases c where c.status = st and c.commission_id = (select comm_x from k)
                   and c.phi_disposed_at is null and app.print_source_registers('case', c.id))),
  't14 ⭐⭐ KEYSTONE: app.case_is_terminal''s status set EQUALS print_source_registers'' case-arm set (disposal held constant). Declared separately on purpose; this is the only thing that pins the correspondence');

-- ---------------------------------------------------------------------------
-- §4 — THE PHI DOOR, BOTH DIRECTIONS (ADR 0144 D14's floor).
-- ---------------------------------------------------------------------------
select ok(app.can_read_case_patient((select case_t from cs), (select sa_x from k)),
  't15 PRECONDITION: the coordinator HOLDS the PHI door (S1 confers read_standard_phi)');
select ok(not app.can_read_case_patient((select case_t from cs), (select st_y from k)),
  't16 ⭐ …and the granted content-reader does NOT. The S3 grant sets read_case_content and leaves read_standard_phi false — this is the caller D14''s floor is written about');
select ok(app.can_read_case((select case_t from cs), (select st_y from k)),
  't17 ⭐ POSITIVE TWIN for t16: that same caller CAN read the case. Without this, t16 is equally satisfied by a caller who cannot see the case at all, and the "de-identified allowed" half of the floor would be untested');

-- ⭐⭐ M-3 (2026-08-25) — the counter §9 measures, snapshotted BEFORE the audited read.
-- ⛔ WHY THIS EXISTS. §9's t40 used to assert `exists (case_patient.read for case_t)`
-- under the caption "a PHI mint emits both rows". The row is emitted HERE, by t18,
-- twenty-odd assertions earlier in the SAME transaction — `mint_printed_document`
-- never calls `get_case_patients` at all. Deleting §7's mints left the old t40 GREEN.
-- An `exists` can never separate a row from its cause when both live inside one
-- transaction; a DELTA can. §9 reads these two snapshots and nothing else changed.
create temp table phi_pre_read on commit drop as
  select (select count(*)::int from public.audit_log
           where action = 'case_patient.read' and entity_id = (select case_t from cs)) as n;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select isnt(public.get_case_patients((select case_t from cs)), null,
  't18 the audited reader RETURNS rows to the entitled coordinator');
reset role;

select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is(public.get_case_patients((select case_t from cs)), null,
  't19 ⭐ …and returns NULL to the content-only caller. This is the entire PHI protection on the provider path: the de-identified payload builder tolerates null, the identified one THROWS on it');
reset role;

-- ⭐⭐ M-3 — the SAME counter after the audited reads and before ANY mint. Everything
-- between this line and §9 is the window t40a measures: §5's bare predicate calls, §6's
-- A7 arms (including one REFUSED mint) and §7's TWO SUCCESSFUL mints.
create temp table phi_pre_mint on commit drop as
  select (select count(*)::int from public.audit_log
           where action = 'case_patient.read' and entity_id = (select case_t from cs)) as n;

-- ---------------------------------------------------------------------------
-- §5 — can_read_full_case_content is FAIL-CLOSED STANDALONE.
-- ⛔ Its meeting twin is fail-open standalone (a vacuous NOT EXISTS over zero
-- agenda rows) and is safe only behind can_reach_meeting. ADR 0144 D8 requires
-- the case twin to be provably different, called BARE.
-- ---------------------------------------------------------------------------
select ok(not app.can_read_full_case_content((select case_t from cs), null),
  't20 fail-closed standalone: NULL uid');
select ok(not app.can_read_full_case_content(gen_random_uuid(), (select sa_x from k)),
  't21 ⭐ fail-closed standalone: UNKNOWN CASE. This is the exact input on which the meeting twin returns TRUE for any caller — an empty aggregate makes its NOT EXISTS vacuously true');
select ok(not app.can_read_full_case_content(null, (select sa_x from k)),
  't22 fail-closed standalone: NULL case');
select ok(not app.can_read_full_case_content((select case_t from cs), gen_random_uuid()),
  't23 fail-closed standalone: a stranger with no relationship to the case');
select ok(app.can_read_full_case_content((select case_t from cs), (select sa_x from k)),
  't24 ⭐ POSITIVE TWIN: the coordinator DOES pass it. Four denials with no allow would be equally satisfied by a predicate stubbed to constant false — which would pass §5 while breaking every mint');

-- ---------------------------------------------------------------------------
-- §6 — THE A7 ARM: recused member + phase-only respondent, MINT and DOWNLOAD.
--
-- ⚠ THIS HEADER WAS AN OVERCLAIM UNTIL 2026-08-25 (finding C-3). It has said "recused
-- member + phase-only respondent, MINT and DOWNLOAD" — four cells — since the suite was
-- written, while delivering ONE: `st_x2` appeared exactly once in the whole file, in the
-- `k` projection, and in no assertion; the download tests all used a third persona. The
-- other three cells are t28a-h (this section) and t38a (§8). ⛔ A section header is an
-- assertion with no gate behind it; this one was believed for eight days.
-- ---------------------------------------------------------------------------
select ok(not app.can_read_case((select case_t from cs), (select st_x from k)),
  't25 a RECUSED member reaches nothing — _case_caps STEP 4 hard-denies before every positive arm');
select ok(not app.can_view_printed_document('case', (select case_t from cs), (select st_x from k)),
  't26 ⭐ …so the A7 arm refuses them. ADR 0144 D8 states this consequence explicitly: the canonical bytes are the COMPLETE artifact, so arm-parity is not content-parity');
select ok(app.can_view_printed_document('case', (select case_t from cs), (select sa_x from k)),
  't27 ⭐ POSITIVE TWIN: the coordinator passes the A7 arm — t26 is a refusal of a PERSON, not of the kind');

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$select public.mint_printed_document(
      (select doc_deny from d), 'case', (select case_t from cs), 'case', 1,
      repeat('ab', 32), (select t3 from tk), (select s3 from tk), true, 0)$$,
  '42501', null,
  't28 ⭐ A7 on the MINT side: the recused member cannot mint. The storage object EXISTS for this id, so authority is the only gate that can fire');
reset role;

-- ── C-3a: STEP 4's OTHER arm — the PHASE-ONLY RESPONDENT (`st_x2`). Fixture and the
-- full rationale are in §0; the two-arm mutation pair is in
-- supabase/tests/mutation/p3-case-print-mutation-audit.sh.
select is(app.is_case_respondent((select case_t from cs), (select st_x2 from k)), true,
  't28a PRECONDITION ⭐: st_x2 IS the respondent of case_t — the four-join participants-registry chain is REAL, not a guessed shape that would make the deny fire for the wrong reason');
select is(app.is_case_respondent((select case_n from cs), (select st_x2 from k)), false,
  't28b PRECONDITION: …and the respondent link is CASE-SCOPED. This is what makes t28c a control rather than a coincidence');
select is(app.can_read_case((select case_n from cs), (select st_x2 from k)), true,
  't28c ⭐⭐ CONTROL: the SAME persona, holding the SAME single phase assignment, DOES read case_n. So the S4 assignment arm is LIVE for this user — without this, t28d is equally satisfied by an arm that grants nothing to anyone');
select is(app.can_read_case((select case_t from cs), (select st_x2 from k)), false,
  't28d ⭐⭐ …and reaches NOTHING on case_t, where he is the respondent. _case_caps STEP 4 returns 0 before S4 is evaluated, so this is a deny that OVERRIDES A GRANT (ADR 0072 D2''s actual claim) — not the absence of any reach');
select is(app.can_read_full_case_content((select case_t from cs), (select st_x2 from k)), false,
  't28e ⭐ …so the full-sight predicate collapses with it: Axis A reads read_case_content AND read_case_deliberation from the same zeroed caps. This is the middle term of D8''s conjunction, pinned separately because a future body could make it independent of caps');
select is(app.can_view_printed_document('case', (select case_t from cs), (select st_x2 from k)), false,
  't28f ⭐⭐ C-3a: the A7 arm refuses the phase-only respondent — D14''s second floor persona. t27 is the positive twin for this line exactly as it is for t26: a refusal of a PERSON, not of the kind');

select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  $$select public.mint_printed_document(
      (select doc_deny from d), 'case', (select case_t from cs), 'case', 1,
      repeat('ab', 32), (select t3 from tk), (select s3 from tk), true, 0)$$,
  '42501', null,
  't28g ⭐⭐ C-3a, MINT side: the phase-only respondent cannot mint the DE-IDENTIFIED variant either — ADR 0144 D8''s "not even de-identified". ⚠ The errcode is the assertion: the storage object exists (§0) and case_t registers, so neither HC0D3 nor HC0DP can pre-empt authority. Distinct from t35, which is refused by the PHI term on the IDENTIFIED variant — a different conjunct of a different arm');
reset role;
-- ⚠ C-3a's DOWNLOAD half is t38b, in §8 — NOT here. It cannot live in this section:
-- `doc_deid` is not minted until §7, so an `open_printed_document` probe placed here
-- returns zero rows from the FIRST exit (`v_row.id is null`) and passes against a
-- document that does not exist. It was written here first and caught by mutation 5,
-- which failed to red it — the fixture could not reach the failing state.

-- ---------------------------------------------------------------------------
-- §7 — THE MINT. Both variants, and the identified gate on both sides.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

select lives_ok(
  $$select public.mint_printed_document(
      (select doc_deid from d), 'case', (select case_t from cs), 'case', 1,
      repeat('ab', 32), (select t1 from tk), (select s1 from tk), true, 0)$$,
  't29 the de-identified dossier MINTS for the coordinator (contains_phi=true — ADR 0144 D6 makes the band non-suppressible for BOTH variants)');

select lives_ok(
  $$select public.mint_printed_document(
      (select doc_ident from d), 'case', (select case_t from cs), 'case_identified', 1,
      repeat('cd', 32), (select t2 from tk), (select s2 from tk), true, 0)$$,
  't30 ⭐ …and so does the IDENTIFIED variant, as a SECOND ACTIVE document. ADR 0144 D7: two simultaneously-current series over one case, carried by template_key — printed_documents_one_active is (source_kind, source_series_id, template_key)');
reset role;

select is((select count(*)::int from public.printed_documents
            where source_id = (select case_t from cs) and status = 'active'), 2,
  't31 ⭐ BOTH remain ACTIVE — the supersede statement is template_key-scoped, so the de-identified mint did not supersede the identified one. Sharing a series would make /verificar report a valid identified dossier as "superseded", a false statement on an UNAUTHENTICATED surface');

select is((select count(distinct source_series_id)::int from public.printed_documents
            where source_id = (select case_t from cs)), 1,
  't32 …over ONE series (the case id). The variant is the template KEY, not the series — which is why the mint door needed no new parameter and the A8 trio stayed at three');

-- ⭐ KEYSTONE (ii) — A CASE MINT LANDS CURRENT.
-- The finding-3 regression: mint_printed_document inserts the print's OWN
-- `documents` row homed on the CASE, inside the mint transaction and AFTER
-- compare-and-mint passed. Without the `kind = 'printed_rendition'` exclusion in
-- app.trg_bump_case_revision_documents that insert bumps the counter past the
-- source_revision the same transaction is storing — and EVERY case mint lands
-- not-current the instant it succeeds, with /verificar reporting "não é mais a
-- atual" on paper whose ink is still wet.
select ok(
  (select is_current from public.printed_document_currency(array[(select doc_deid from d)])),
  't33 ⭐⭐ KEYSTONE: a freshly minted case dossier is CURRENT. Pins the printed_rendition exclusion in the D15 documents trigger — without it the mint''s own documents row bumps the counter past the revision it just stored');

select is(app.print_source_revision('case', (select case_t from cs)), 0,
  't34 ⭐ …and the mints did NOT move the counter at all. t33 alone would still pass if the counter moved and the stored revision moved with it; this pins the value');

-- The identified-variant gate, MINT side (ADR 0144 D8, trio site 3).
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select throws_ok(
  $$select public.mint_printed_document(
      (select doc_deny from d), 'case', (select case_t from cs), 'case_identified', 1,
      repeat('ef', 32), (select t3 from tk), (select s3 from tk), true, 0)$$,
  '42501', null,
  't35 ⭐ the content-only caller cannot mint the IDENTIFIED variant — site 3''s can_read_case_patient term. Without it they could occupy and supersede the identified series slot with bytes carrying no identifiers');
reset role;

-- ---------------------------------------------------------------------------
-- §8 — THE DOWNLOAD half of the identified gate.
-- ⛔ app.resolve_document_version_bytes gates case-homed bytes on
-- read_case_deliberation and carries NO PHI term for the `case` home (the
-- case_referral home right below it does). P3 mints the first case-homed PHI
-- bytes, so this gate is what stops a content-only reader downloading name+MRN.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.open_printed_document((select doc_ident from d))), 0,
  't36 ⭐⭐ the content-only caller gets NO ROW for the IDENTIFIED document — the download half of D8''s arm. It refuses by `return`, so the serving route renders a 404 indistinguishable from nonexistent');
select is((select count(*)::int from public.open_printed_document((select doc_deid from d))), 1,
  't37 ⭐⭐ …and DOES receive the DE-IDENTIFIED one. This is the pair that proves the gate keys on template_key and NOT on sensitivity_tier: both documents are contains_phi=true and both sit in documents-phi, so a tier-keyed gate would have refused BOTH and destroyed the point of D5''s fork');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.open_printed_document((select doc_ident from d))), 1,
  't38 POSITIVE TWIN: the entitled coordinator downloads the identified document — t36 refuses a PERSON, not the document');
reset role;

-- ⭐⭐ C-3b (added 2026-08-25) — D14's RECUSED-MEMBER cell on the DOWNLOAD side. The
-- floor asks for the A7 arm "on a recused member … for mint AND download"; before this
-- the mint half was t28 and the download half was missing (§8's refusals all use st_y).
--
-- ⛔ THIS IS A DIFFERENT CLAIM FROM t26, not a restatement of it. t26 pins the
-- PREDICATE (`can_view_printed_document` refuses st_x); this pins the WIRING — that
-- `open_printed_document` actually consults it. The predicate is truth about the
-- predicate and evidence about nothing downstream of it, and this phase's own record
-- carries a case where four DB gates all held while the page still 404'd.
--
-- ⛔ DE-IDENTIFIED ON PURPOSE. ADR 0144 D8: a recused member "can neither mint nor
-- download the dossier — not even de-identified". The IDENTIFIED document is already
-- refused to st_y at t36 by a second, template_key-keyed gate, so asserting on it here
-- would be satisfied by that gate and would say nothing about the recusal.
-- ⛔ DIFFERENTIAL, and the reason a zero here is not an empty fixture: t37 has THIS
-- EXACT document returning 1 row to st_y, and t38 returns 1 to the coordinator.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.open_printed_document((select doc_deid from d))), 0,
  't38a ⭐⭐ C-3b: the RECUSED member receives NO ROW for the DE-IDENTIFIED document either. Gate 1 of open_printed_document (the can_view_printed_document scope check) is what fires here; t36 is refused by gate 2 (template_key + can_read_case_patient) — so a mutation that opens one reds exactly one of the two, which is how the two gates are shown to be independent rather than one gate counted twice');
reset role;

-- ⭐⭐ C-3a's DOWNLOAD half, RELOCATED HERE from §6 (2026-08-25). It has to be after
-- §7: `doc_deid` does not exist until t29 mints it, and an `open_printed_document`
-- probe placed before that returns zero from the not-found exit — an absence satisfied
-- by a missing row rather than by a refusal. Mutation 5 is what exposed it: opening the
-- respondent deny reddened t28d-g and left the download probe GREEN, which is only
-- possible if the probe was never testing the door.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.open_printed_document((select doc_deid from d))), 0,
  't38b ⭐⭐ C-3a, DOWNLOAD side: the phase-only respondent receives no row for the de-identified document either. With t28g this closes D14''s floor "for mint AND download" on the second persona; t37 and t38 return 1 row for THIS document to two other callers, so the zero is a refusal of a PERSON and not a missing or unreadable document');
reset role;

-- ---------------------------------------------------------------------------
-- §9 — AUDIT. ⚠ RETITLED 2026-08-25 (finding M-3). This section does NOT prove
-- "a PHI mint emits both rows", and structurally CANNOT. It proves three things,
-- each measured rather than asserted:
--   t39   the MINT causes the `document.minted` row      — causal by IDENTITY
--   t40   the AUDITED READER causes `case_patient.read`  — causal by DELTA (> 0)
--   t40a  the MINT WINDOW causes no `case_patient.read`  — causal by DELTA (= 0)
-- …and then the identified PRÉVIA's asymmetry (t41-t44, ADR 0144 D9), unchanged.
--
-- ⛔ WHY t40a IS NOT VACUOUS. It is an absence, and its positive twin is t40: the
-- SAME counter, over the SAME entity, proven able to MOVE by this same fixture. An
-- absence measured on a counter nothing can move proves the fixture, not the code.
--
-- ⛔ WHAT THIS MEANS FOR ADR 0144 D14 / D9 — written here because this is where the
-- next reader lands. D14's floor item *"a PHI mint emits BOTH rows"* and D9's *"Both
-- halves are pgTAP-pinned: read row present, mint row absent"* are NOT satisfiable in
-- pgTAP. D9 itself says the read row is emitted *"via the domain's audited reader"* —
-- and on the print corridor that reader is called from TYPESCRIPT
-- (`buildCasePayload` -> `getCasePatients`) BEFORE the mint RPC is invoked. In-database
-- the two rows are paired only by sharing a transaction, and a shared transaction is
-- not causality. The MINT-ROW-ABSENT half (t43) is pinned here; the READ-ROW-PRESENT
-- half of the PAIRING needs an E2E assertion over the real corridor. The same
-- structural bound applies to the identified-prévia read row and to Amendment 2 pt 1.
-- ---------------------------------------------------------------------------
select ok(
  exists (select 1 from public.audit_log
           where action = 'document.minted' and entity_id = (select doc_ident from d)),
  't39 ⭐ CAUSAL BY IDENTITY: the identified MINT emitted document.minted. entity_id is the DOCUMENT id — minted exactly once, by t30, and written by no other statement in this transaction. That is what the old t40 lacked: a row with exactly one possible author');

select ok(
  (select n from phi_pre_mint) > (select n from phi_pre_read),
  't40 ⭐⭐ M-3, THE CAUSAL REPAIR: the AUDITED READER caused the case_patient.read row — the counter for this case MOVED across t18/t19, the only statements between the two snapshots. ⛔ The old t40 credited this row to the mint and measured it with a bare `exists`, so deleting the mints left it green');

select is(
  (select count(*)::int from public.audit_log
    where action = 'case_patient.read' and entity_id = (select case_t from cs)),
  (select n from phi_pre_mint),
  't40a ⭐⭐ M-3''s HONEST BOUND: the whole mint window (§5-§7, BOTH successful mints included) added ZERO case_patient.read rows. mint_printed_document holds only the BOOLEAN can_read_case_patient and never calls the audited reader, so the SQL mint emits ONE row, not two — see the section header for why D14''s "both rows" is an E2E claim, and t40 for why this absence is not vacuous');

-- The PRÉVIA asymmetry, on the NON-TERMINAL case (log_document_previa refuses a
-- registering source with HC0DV, so a prévia is only reachable there).
insert into public.case_access_grants
  (case_id, principal_id, source, read_case_content, read_standard_phi, granted_by, reason)
select c.case_n, k.sa_x, 'manual_grant', true, true, k.sa_x, 'fixture' from cs c, k;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$select public.log_document_previa('case', (select case_n from cs), 'case_identified')$$,
  't41 ⭐ an IDENTIFIED prévia of a non-terminal case is logged. ⛔ This is also the regression test for a gap NO gate could see: log_document_previa had no `case` arm at all, so v_commission stayed null and EVERY case prévia raised HC0D1 — rendered by the route as the same pt-BR 404 it returns for an unreachable source, i.e. indistinguishable from correct fail-closed behaviour');
reset role;

select ok(
  exists (select 1 from public.audit_log
           where action = 'document.previa_printed'
             and entity_id = (select case_n from cs)
             and metadata->>'template_key' = 'case_identified'),
  't42 ⭐ …and the row records WHICH VARIANT was previewed. Since D9 gives a prévia no mint row, this is the ONLY registry-side trace an identified prévia leaves');

select ok(
  not exists (select 1 from public.audit_log
               where action = 'document.minted' and entity_id = (select case_n from cs)),
  't43 ⭐⭐ D9''s ASYMMETRY: NO document.minted row for the prévia. ⚠ Paired with t42 on the SAME run deliberately — absence-of-mint is trivially true if the prévia never happened at all, so the two halves must be asserted together or this proves nothing');

select throws_ok(
  $$select public.log_document_previa('case', (select case_t from cs), 'case')$$,
  'HC0DV', null,
  't44 ⭐ a REGISTERING case refuses a prévia (0125 D5, the other direction): a source that must be EMITTED is never served under a footer disclaiming it');

-- ---------------------------------------------------------------------------
-- §10 — DISPOSAL (ADR 0144 D10): registration drops, and the registry closes.
-- ---------------------------------------------------------------------------
select ok(not app.can_read_case_patient((select case_d from cs), (select st_y from k)),
  't45 the disposed case still refuses the PHI door to the content-only caller');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$select public.mint_printed_document(
      (select doc_cur from d), 'case', (select case_d from cs), 'case_identified', 1,
      repeat('99', 32), (select t4 from tk), (select s4 from tk), true, 0)$$,
  'HC0DP', null,
  't46 ⭐ a DISPOSED case cannot mint at all — HC0DP, the registration gate. ⚠ The errcode is the assertion: 42501 would mean it failed on authority and the disposal term was never reached');
reset role;

-- ---------------------------------------------------------------------------
-- §11 — THE D15 PAYOFF, and t33's DIFFERENTIAL.
--
-- t33 asserts a fresh mint is CURRENT. On its own that is equally satisfied by a
-- currency check stubbed to constant true, or by a revision counter that never
-- moves at all — and "never moves" is exactly the bug D15 exists to prevent
-- (a registered dossier reading "autentico e atual" while its rendered text has
-- drifted). This section supplies the other arm: an ordinary content edit made
-- WHILE THE CASE IS TERMINAL must move the counter and must cost the outstanding
-- print its currency.
--
-- ⚠ It also pins the half of t7 that t7 cannot state: entering the lock does not
-- bump, writing while locked does.
-- ---------------------------------------------------------------------------
create temp table rev0 on commit drop as
  select app.print_source_revision('case', (select case_t from cs)) as before;

select set_config('app.in_narrative_rpc', 'on', true);
update public.case_narratives set body_md = 'CORPO EDITADO APOS O FECHAMENTO'
  where id = (select narr_t from cs);
select set_config('app.in_narrative_rpc', 'off', true);

-- ⚠ ASSERTS THAT IT MOVED, NOT BY HOW MUCH — and the delta is deliberately
-- unspecified because it is NOT 1. Measured: one narrative UPDATE advances the
-- counter by TWO. `app.trg_bump_case_revision` bumps the OLD row's case AND the
-- NEW row's case so that a row MOVING between cases invalidates both dossiers;
-- when the row stays put, as it does here and in the overwhelming majority of
-- edits, both calls land on the same case.
--
-- ⭐ That is harmless BY CONSTRUCTION and the reason is worth stating: currency
-- is an EQUALITY test between the revision a print stored and the source's
-- current one (ADR 0126 D9). Nothing counts, compares magnitudes, or reads a
-- delta — so a counter that advances by 2, or by 7, is exactly as correct as one
-- that advances by 1. It must only be MONOTONIC and it must MOVE.
--
-- ⛔ So this assertion must never be written as `= before + 1`. A literal delta
-- would pin an implementation detail that carries no meaning, and would red on
-- any future trigger added to a table this narrative touches — training the next
-- reader to bump the constant, at which point the assertion stops being about
-- D15 at all.
select ok(
  app.print_source_revision('case', (select case_t from cs)) > (select before from rev0),
  't47 ⭐⭐ D15: a narrative edit on an ALREADY-TERMINAL case MOVED the counter. This is the corridor ADR 0144 D15 exists for — dossier-visible content can change with no case-level door involved, so without the trigger set the counter could never move and every stale print would keep claiming currency. ⚠ The DELTA is deliberately unasserted: see the note above');

select ok(
  not (select is_current from public.printed_document_currency(array[(select doc_deid from d)])),
  't48 ⭐⭐ …and the outstanding dossier is NO LONGER CURRENT. This is t33''s differential: without it, t33 passes against a currency check stuck on true and against a counter that never moves. The document stays downloadable — it simply stops claiming to be the current one, which is the true statement');

select * from finish();
rollback;
