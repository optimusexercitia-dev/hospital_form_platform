-- Case Access Control (ADR 0033) — the full DB-side test (BE-2 → BE-5).
-- Migrations 20260619110000 (table + narrative cols + flag) + 110001 (predicates +
-- RLS tighten + write policies) + 110002 (grants / narrative lifecycle /
-- list_my_cases / get_case_detail re-gate / content-write broadening) + 110003
-- (audit).
--
-- Proves:
--   (a) the predicate TRUTH-TABLE across personas with case_access ON —
--       can_read_case / can_write_case_content / can_write_case_narrative (Q14);
--   (b) flag OFF ⇒ can_read_case ≡ is_member_of for EVERY persona;
--   (c) the RLS BOUNDARY with the flag ON — an unrelated member gets 0 rows from
--       cases / case_phases / case_narratives / the child tables; no anon leak;
--   (d) get_case_detail re-gate + the SUBMITTED-ONLY invariant (a read-grantee sees
--       a concluded phase's response_id but NEVER an in-progress one's) + viewer
--       capabilities; flag-OFF get_case_detail stays coordinator-only;
--   (e) narrative lifecycle + Q14 RPC enforcement (assignee writes; write-grantee
--       blocked on an attributed narrative, allowed on an un-assigned one; conclude
--       freezes → HC055; coordinator-only reopen);
--   (f) grant / revoke RPCs (coordinator-only; HC021 member check);
--   (g) list_my_cases (self-scoped; role chip; actionable; boundary empty);
--   (h) audit — case.opened on a non-coordinator open (not a coordinator one);
--       the allow-list guard; the narrative metadata is body_md/PHI-free.
--
-- Personas (all in commission X unless noted), built directly as table owner (the
-- predicates are read-only; case_phases/case_narratives INSERT is unguarded — the
-- state guards are BEFORE UPDATE/DELETE only):
--   sa_x   coordinator (staff_admin of X)
--   st_x   PHASE assignee (assigned the case's one phase)
--   st_x2  NARRATIVE assignee (assigned narrative N1)
--   gx_r   granted READ   (case_access level 'read')
--   gx_w   granted WRITE  (case_access level 'write')
--   ux     unrelated member of X — NO attribution, NO grant (the boundary persona)
--   sa_y   foreign coordinator (commission Y) — sees nothing
--   admin  platform admin — sees everything

begin;
select plan(94);   -- ADR 0078 Stage B: removed the flag-OFF fallback (b, 7) + list_case_access flag-OFF (1)

-- The feature ships ON in-increment; flip it ON for the truth-table + boundary
-- sections (a hermetic test must not depend on migration order). The flag-OFF
-- section toggles it OFF locally and back.
update app.feature_flags set enabled = true where key = 'case_access';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         (v->>'form_u')::uuid as form_u,
         (v->>'ver_u')::uuid  as ver_u,
         (v->>'item_mc')::uuid as item_mc
  from ctx;
grant select on k to authenticated;

-- ---------------------------------------------------------------------------
-- Three extra plain-staff members of commission X (the bootstrap has only st_x /
-- st_x2). gx_r/gx_w receive grants; ux stays unrelated.
-- ---------------------------------------------------------------------------
create temp table p on commit drop as
  select gen_random_uuid() as gx_r, gen_random_uuid() as gx_w, gen_random_uuid() as ux;
grant select on p to authenticated;

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
       u || '@test', now(), now()
from (select gx_r as u from p union all select gx_w from p union all select ux from p) s;

update public.profiles set full_name = 'Granted Read X'  where id = (select gx_r from p);
update public.profiles set full_name = 'Granted Write X' where id = (select gx_w from p);
update public.profiles set full_name = 'Unrelated X'     where id = (select ux from p);

insert into public.memberships (commission_id, principal_id, role)
select (select comm_x from k), u, 'staff'
from (select gx_r as u from p union all select gx_w from p union all select ux from p) s;

-- ---------------------------------------------------------------------------
-- One case in X with: 1 phase (assigned st_x), narrative N1 (assigned st_x2),
-- narrative N2 (UN-assigned). Plus a few child rows to prove the boundary reaches
-- them. Built as table owner.
-- ---------------------------------------------------------------------------
create temp table cs on commit drop as
  select gen_random_uuid() as case_x,
         gen_random_uuid() as phase_x,
         gen_random_uuid() as narr1,   -- assigned to st_x2
         gen_random_uuid() as narr2,   -- un-assigned
         gen_random_uuid() as doc_x,
         gen_random_uuid() as event_x;
grant select on cs to authenticated;

insert into public.cases (id, commission_id, case_number, label, created_by)
values ((select case_x from cs), (select comm_x from k), 9201, 'Caso Acesso',
        (select sa_x from k));

insert into public.case_phases
  (id, case_id, position, form_id, form_version_id, status, assigned_to, blocks)
values
  ((select phase_x from cs), (select case_x from cs), 1, (select form_u from k),
   (select ver_u from k), 'active', (select st_x from k), '{}');

insert into public.case_narratives
  (id, case_id, type_label, display_position, status, assigned_to)
values
  ((select narr1 from cs), (select case_x from cs), 'Resumo', 2, 'open',
   (select st_x2 from k)),
  ((select narr2 from cs), (select case_x from cs), 'Conclusão', 3, 'open', null);

-- F2 (ADR 0063): case documents are attachments (owner_type='case'); their read
-- follows can_read_attachment('case', …) = can_read_case (ACL under case_access).
insert into public.attachments
  (id, owner_type, owner_id, kind, title, storage_bucket, storage_path, sensitivity_tier, uploaded_by)
values ((select doc_x from cs), 'case', (select case_x from cs), 'ata', 'Ata',
        'attachments-phi', 'case/' || (select case_x from cs) || '/doc.pdf', 'phi',
        (select sa_x from k));

insert into public.case_events (id, case_id, kind, body, created_by)
values ((select event_x from cs), (select case_x from cs), 'note', 'nota',
        (select sa_x from k));

-- The two grants (ADR 0078 Stage B: case_access_grants, per-capability). gx_r read, gx_w write.
select test_helpers.grant_ca((select case_x from cs), (select gx_r from p), 'read',  (select sa_x from k));
select test_helpers.grant_ca((select case_x from cs), (select gx_w from p), 'write', (select sa_x from k));

-- ---------------------------------------------------------------------------
-- INFO-N1 (ADR 0033 D2 fast-follow, migration 20260713001200): an interview on
-- case_x with one subject, one interviewer, one attachment — to prove the interview
-- graph now case-scopes its SELECT to can_read_case (was is_member_of). Plus an
-- ORG_ADMIN (oa) of the bootstrap org (org_b) who is NOT a commission member, to
-- prove the preserved org-admin arm independent of membership.
-- ---------------------------------------------------------------------------
create temp table ivt on commit drop as
  select gen_random_uuid() as iv, gen_random_uuid() as subj,
         gen_random_uuid() as intr, gen_random_uuid() as att,
         gen_random_uuid() as oa;
grant select on ivt to authenticated;

-- Org admin persona (org-level, no commission membership; profile auto-created by
-- the auth.users trigger, then anchored to org_b).
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', (select oa from ivt), 'authenticated',
       'authenticated', (select oa from ivt) || '@test', now(), now();
update public.profiles
   set full_name = 'Org Admin', home_organization_id = (select (v->>'org_b')::uuid from ctx)
 where id = (select oa from ivt);
insert into public.memberships (organization_id, principal_id, role)
  values ((select (v->>'org_b')::uuid from ctx), (select oa from ivt), 'org_admin');

-- The interview graph (interview_number is minted by the BEFORE INSERT trigger).
insert into public.case_interviews
  (id, commission_id, case_id, interview_number, status, interview_category)
values ((select iv from ivt), (select comm_x from k), (select case_x from cs), 0, 'draft', 'other');
insert into public.case_interview_subjects (id, interview_id, external_name, note, relationship_to_case)
values ((select subj from ivt), (select iv from ivt), 'Sujeito Externo', 'nota', 'other');
insert into public.case_interview_interviewers (id, interview_id, external_name, role)
values ((select intr from ivt), (select iv from ivt), 'Entrevistador Externo', 'entrevistador');
-- F2 (ADR 0063): interview external links live in case_interview_links (case-scoped
-- read, INFO-N1 parity); interview FILE attachments moved to public.attachments.
insert into public.case_interview_links
  (id, interview_id, title, external_url, created_by)
values ((select att from ivt), (select iv from ivt), 'Anexo',
        'https://example.test/a', (select sa_x from k));

-- =========================================================================
-- (a) PREDICATE TRUTH-TABLE — can_read_case (flag ON)
-- =========================================================================
-- coordinator / phase-assignee / narrative-assignee / granted-read / granted-write
-- → TRUE; unrelated member / foreign coordinator → FALSE; admin → TRUE.
select ok(app.can_read_case((select case_x from cs), (select sa_x from k)),
  'can_read_case: coordinator (staff_admin) → true');
select ok(app.can_read_case((select case_x from cs), (select st_x from k)),
  'can_read_case: phase assignee → true (attribution-derived)');
select ok(app.can_read_case((select case_x from cs), (select st_x2 from k)),
  'can_read_case: narrative assignee → true (attribution-derived)');
select ok(app.can_read_case((select case_x from cs), (select gx_r from p)),
  'can_read_case: granted read → true');
select ok(app.can_read_case((select case_x from cs), (select gx_w from p)),
  'can_read_case: granted write → true (write implies read)');
-- Multi-tenancy Phase B: the platform-admin term was DROPPED from can_read_case
-- (governance is now org_admin-scoped, and a platform admin is not a case worker).
select ok(not app.can_read_case((select case_x from cs), (select admin from k)),
  'can_read_case: platform_admin → FALSE (admin term dropped; Phase B duty separation)');
select ok(not app.can_read_case((select case_x from cs), (select ux from p)),
  'can_read_case: unrelated member of the commission → FALSE');
select ok(not app.can_read_case((select case_x from cs), (select sa_y from k)),
  'can_read_case: foreign coordinator (other commission) → FALSE');
select ok(not app.can_read_case((select case_x from cs), gen_random_uuid()),
  'can_read_case: a random non-member uid → FALSE');
select ok(not app.can_read_case(gen_random_uuid(), (select sa_x from k)),
  'can_read_case: an unknown case id → FALSE');

-- =========================================================================
-- (a) PREDICATE TRUTH-TABLE — can_write_case_content (flag ON)
-- =========================================================================
-- coordinator + granted-write → TRUE; granted-read, phase-assignee,
-- narrative-assignee (attribution is NOT content-write), unrelated, foreign → FALSE.
select ok(app.can_write_case_content((select case_x from cs), (select sa_x from k)),
  'can_write_case_content: coordinator → true');
select ok(app.can_write_case_content((select case_x from cs), (select gx_w from p)),
  'can_write_case_content: granted write → true');
-- Multi-tenancy Phase B: the platform-admin term was DROPPED from
-- can_write_case_content (PHI-module duty separation; org_admin governance does
-- not grant case content-write either — writes stay coordinators/grantees).
select ok(not app.can_write_case_content((select case_x from cs), (select admin from k)),
  'can_write_case_content: platform_admin → FALSE (admin term dropped; Phase B)');
select ok(not app.can_write_case_content((select case_x from cs), (select gx_r from p)),
  'can_write_case_content: granted READ only → FALSE (read ≠ write)');
select ok(not app.can_write_case_content((select case_x from cs), (select st_x from k)),
  'can_write_case_content: phase assignee → FALSE (attribution ≠ content-write)');
select ok(not app.can_write_case_content((select case_x from cs), (select st_x2 from k)),
  'can_write_case_content: narrative assignee → FALSE (attribution ≠ content-write)');
select ok(not app.can_write_case_content((select case_x from cs), (select ux from p)),
  'can_write_case_content: unrelated member → FALSE');

-- =========================================================================
-- (a) PREDICATE TRUTH-TABLE — can_write_case_narrative (Q14)
-- =========================================================================
-- N1 (assigned st_x2): coordinator YES, the assignee (st_x2) YES, a write-grantee
-- (gx_w) NO (an attributed narrative is reserved to its assignee), a read-grantee NO.
select ok(app.can_write_case_narrative((select narr1 from cs), (select sa_x from k)),
  'can_write_case_narrative N1(assigned): coordinator → true');
select ok(app.can_write_case_narrative((select narr1 from cs), (select st_x2 from k)),
  'can_write_case_narrative N1(assigned): the assignee → true');
select ok(not app.can_write_case_narrative((select narr1 from cs), (select gx_w from p)),
  'can_write_case_narrative N1(assigned): a WRITE-grantee → FALSE (Q14 ownership)');
select ok(not app.can_write_case_narrative((select narr1 from cs), (select gx_r from p)),
  'can_write_case_narrative N1(assigned): a read-grantee → FALSE');
select ok(not app.can_write_case_narrative((select narr1 from cs), (select st_x from k)),
  'can_write_case_narrative N1(assigned): a DIFFERENT assignee (phase) → FALSE');
-- N2 (un-assigned): coordinator YES, write-grantee YES (un-attributed is open to
-- content writers), read-grantee NO, unrelated NO.
select ok(app.can_write_case_narrative((select narr2 from cs), (select sa_x from k)),
  'can_write_case_narrative N2(un-assigned): coordinator → true');
select ok(app.can_write_case_narrative((select narr2 from cs), (select gx_w from p)),
  'can_write_case_narrative N2(un-assigned): a WRITE-grantee → true (open)');
select ok(not app.can_write_case_narrative((select narr2 from cs), (select gx_r from p)),
  'can_write_case_narrative N2(un-assigned): a read-grantee → FALSE');
select ok(not app.can_write_case_narrative((select narr2 from cs), (select ux from p)),
  'can_write_case_narrative N2(un-assigned): unrelated member → FALSE');

-- =========================================================================
-- (c) RLS BOUNDARY (flag ON) — the unrelated member ux reads 0 rows everywhere;
-- the granted-read member gx_r reads the case + children; the phase assignee st_x
-- reads the case.
-- =========================================================================
-- ux (unrelated member of X): 0 from every case table.
select test_helpers.claims_for((select ux from p), false);
set local role authenticated;
select is((select count(*)::int from public.cases where id = (select case_x from cs)),
  0, 'RLS: unrelated member reads 0 cases rows');
select is((select count(*)::int from public.case_phases where case_id = (select case_x from cs)),
  0, 'RLS: unrelated member reads 0 case_phases rows');
select is((select count(*)::int from public.case_narratives where case_id = (select case_x from cs)),
  0, 'RLS: unrelated member reads 0 case_narratives rows');
select is((select count(*)::int from public.attachments where owner_type = 'case' and owner_id = (select case_x from cs)),
  0, 'RLS: unrelated member reads 0 case attachments rows');
select is((select count(*)::int from public.case_events where case_id = (select case_x from cs)),
  0, 'RLS: unrelated member reads 0 case_events rows');
reset role;

-- gx_r (granted read): reads the case + a child.
select test_helpers.claims_for((select gx_r from p), false);
set local role authenticated;
select is((select count(*)::int from public.cases where id = (select case_x from cs)),
  1, 'RLS: granted-read member reads the case');
select is((select count(*)::int from public.attachments where owner_type = 'case' and owner_id = (select case_x from cs)),
  1, 'RLS: granted-read member reads the case attachments');
reset role;

-- st_x (phase assignee): reads the case (attribution-derived).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.cases where id = (select case_x from cs)),
  1, 'RLS: phase assignee reads the case (attribution)');
reset role;

-- =========================================================================
-- (c′) INFO-N1 — the interview graph now case-scopes SELECT to can_read_case
-- (parent + 3 children). Boundary: a bare member reads NOTHING; a case-worker
-- (grant OR attribution) reads them.
-- ⛔ UPDATED BY A4 (20260730): the org-admin arm is NO LONGER "preserved" — A4
-- removed it. The graph routes can_read_interview -> can_read_case_or_admin (which A4
-- collapsed to can_read_case) and can_write_interview (whose org arm A4 also removed),
-- so an org_admin reads ZERO interview material now. See block (c) below.
-- =========================================================================
-- (a) ux — a bare member with NO attribution/grant (not yet granted) — reads 0.
select test_helpers.claims_for((select ux from p), false);
set local role authenticated;
select is((select count(*)::int from public.case_interviews where id = (select iv from ivt)),
  0, 'INFO-N1 boundary: bare member reads 0 case_interviews rows');
select is((select count(*)::int from public.case_interview_subjects where interview_id = (select iv from ivt)),
  0, 'INFO-N1 boundary: bare member reads 0 case_interview_subjects rows');
select is((select count(*)::int from public.case_interview_interviewers where interview_id = (select iv from ivt)),
  0, 'INFO-N1 boundary: bare member reads 0 case_interview_interviewers rows');
select is((select count(*)::int from public.case_interview_links where interview_id = (select iv from ivt)),
  0, 'INFO-N1 boundary: bare member reads 0 case_interview_links rows');
reset role;

-- (b) gx_r — a granted-READ case-worker — reads the interview + every child.
select test_helpers.claims_for((select gx_r from p), false);
set local role authenticated;
select is((select count(*)::int from public.case_interviews where id = (select iv from ivt)),
  1, 'INFO-N1: granted-read case-worker reads the case_interviews row');
select is((select count(*)::int from public.case_interview_subjects where interview_id = (select iv from ivt)),
  1, 'INFO-N1: granted-read case-worker reads the interview subject');
select is((select count(*)::int from public.case_interview_interviewers where interview_id = (select iv from ivt)),
  1, 'INFO-N1: granted-read case-worker reads the interviewer');
select is((select count(*)::int from public.case_interview_links where interview_id = (select iv from ivt)),
  1, 'INFO-N1: granted-read case-worker reads the interview link');
reset role;

-- (b′) st_x — an ATTRIBUTION-derived case-worker (phase assignee) — reads the
-- parent + a child (the child follows via app.case_of_interview → can_read_case).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_interviews where id = (select iv from ivt)),
  1, 'INFO-N1: attributed case-worker (phase assignee) reads the case_interviews row');
select is((select count(*)::int from public.case_interview_subjects where interview_id = (select iv from ivt)),
  1, 'INFO-N1: attributed case-worker reads the interview subject (child via case_of_interview)');
reset role;

-- (c) oa — an org_admin of the case''s org, NOT a commission member. ⛔ POST-A4 he reads
-- ZERO interview material (was 1 on every row pre-A4 via the org-admin arm). This is
-- D4·2's whole point: interviews are case-linked, PHI-capable material, and an
-- Organization User ceases to be a Case Content source. The removal spans BOTH the read
-- path (can_read_case_or_admin collapsed) AND the write predicate the FOR ALL policies
-- route (can_write_interview's org arm), so all four children go to 0 together.
select test_helpers.claims_for((select oa from ivt), false);
set local role authenticated;
select is((select count(*)::int from public.case_interviews where id = (select iv from ivt)),
  0, 'INFO-N1 (A4): org_admin reads ZERO case_interviews rows — the org-admin arm was removed');
select is((select count(*)::int from public.case_interview_subjects where interview_id = (select iv from ivt)),
  0, 'INFO-N1 (A4): org_admin reads ZERO interview subjects — via can_write_interview''s removed org arm');
select is((select count(*)::int from public.case_interview_interviewers where interview_id = (select iv from ivt)),
  0, 'INFO-N1 (A4): org_admin reads ZERO interviewers');
select is((select count(*)::int from public.case_interview_links where interview_id = (select iv from ivt)),
  0, 'INFO-N1 (A4): org_admin reads ZERO interview links');
reset role;

-- =========================================================================
-- (b) REMOVED (ADR 0078 B4/D9). The "flag-OFF fallback — can_read_case ≡ is_member_of"
-- tested the S5L legacy member arm (every member reads the case). Stage B DELETES it;
-- the surviving member arm confers read_case_deliberation ONLY (A15), so a plain member
-- no longer reads case content — proven under the always-on model by 234/238 and by
-- the flag-ON boundary section above (ux, the unrelated member, reads 0 rows).
-- =========================================================================

-- =========================================================================
-- No anon/PUBLIC leak: the three predicates + the capability read are not
-- anon-executable (deny-by-default for the public web role).
-- =========================================================================
select ok(not has_function_privilege('anon', 'app.can_read_case(uuid,uuid)', 'EXECUTE'),
  'anon cannot EXECUTE app.can_read_case');
select ok(not has_function_privilege('anon', 'public.case_viewer_capabilities(uuid)', 'EXECUTE'),
  'anon cannot EXECUTE public.case_viewer_capabilities');

-- =========================================================================
-- BE-4: get_case_detail RE-GATE + SUBMITTED-ONLY PRESERVATION (the must-prove
-- regression). audit_trail ON so case.opened is captured.
-- =========================================================================
update app.feature_flags set enabled = true
  where key in ('cases_multi_phase', 'audit_trail');

-- Add two more phases to the case: phase 2 CONCLUIDA with a SUBMITTED response (by
-- st_x), phase 3 ATIVA with an IN-PROGRESS response (by st_x2). A read-grantee
-- (gx_r) must see phase 2's response_id (submitted) but NOT phase 3's (in-progress).
create temp table ph2 on commit drop as
  select gen_random_uuid() as phase2, gen_random_uuid() as phase3,
         gen_random_uuid() as resp_sub, gen_random_uuid() as resp_ip;
grant select on ph2 to authenticated;

insert into public.case_phases
  (id, case_id, position, form_id, form_version_id, status, assigned_to, blocks)
values
  ((select phase2 from ph2), (select case_x from cs), 2, (select form_u from k),
   (select ver_u from k), 'completed', (select st_x from k), '{}'),
  ((select phase3 from ph2), (select case_x from cs), 3, (select form_u from k),
   (select ver_u from k), 'active', (select st_x2 from k), '{}');

-- A SUBMITTED response for phase 2 (the submitted-immutability trigger needs
-- app.in_submit_rpc to write answers on a submitted parent — mirror the seed).
select set_config('app.in_submit_rpc', 'on', true);
insert into public.responses
  (id, form_version_id, commission_id, created_by, status, case_phase_id,
   started_at, updated_at, submitted_at)
values
  ((select resp_sub from ph2), (select ver_u from k), (select comm_x from k),
   (select st_x from k), 'submitted', (select phase2 from ph2), now(), now(), now());
insert into public.answers (response_id, item_id, question_key, value)
values ((select resp_sub from ph2), (select item_mc from k), 'u_q1', to_jsonb('Sim'::text));
select set_config('app.in_submit_rpc', 'off', true);

-- An IN-PROGRESS response for phase 3 (st_x2's draft — must never leak).
insert into public.responses
  (id, form_version_id, commission_id, created_by, status, case_phase_id,
   started_at, updated_at)
values
  ((select resp_ip from ph2), (select ver_u from k), (select comm_x from k),
   (select st_x2 from k), 'in_progress', (select phase3 from ph2), now(), now());

-- gx_r (read-grantee) opens the case: get_case_detail returns it (re-gate to
-- can_read_case) with phase 2 carrying a response_id and phase 3 NOT.
select test_helpers.claims_for((select gx_r from p), false);
set local role authenticated;
create temp table det on commit drop as
  select public.get_case_detail((select case_x from cs)) as d;
grant select on det to authenticated;
reset role;

select is(
  (select (d ->> 'id') from det), (select case_x from cs)::text,
  'get_case_detail: a read-grantee opens the case (re-gated to can_read_case)');
-- Phase 2 (concluida + submitted) → response_id is NON-null.
select isnt(
  (select p2 ->> 'response_id'
   from det, lateral (select e from jsonb_array_elements(d -> 'phases') e
                      where (e ->> 'position') = '2') x(p2)),
  null, 'SUBMITTED-ONLY: a concluded phase exposes its response_id to the read-grantee');
-- Phase 3 (ativa + IN-PROGRESS) → response_id is NULL (the Phase-7 invariant).
select is(
  (select p3 ->> 'response_id'
   from det, lateral (select e from jsonb_array_elements(d -> 'phases') e
                      where (e ->> 'position') = '3') x(p3)),
  null, 'SUBMITTED-ONLY: an in-progress phase NEVER exposes response_id (Phase-7 invariant)');
-- viewer_capabilities for the read-grantee: read yes, write/lifecycle no.
select is(
  (select d -> 'viewer_capabilities' ->> 'can_write_content' from det),
  'false', 'viewer_capabilities: a read-grantee has can_write_content=false');
select is(
  (select d -> 'viewer_capabilities' ->> 'can_manage_lifecycle' from det),
  'false', 'viewer_capabilities: a read-grantee has can_manage_lifecycle=false');

-- The unrelated member ux is DENIED get_case_detail (no_data_found → the query
-- layer maps to null; here the RPC raises).
select test_helpers.claims_for((select ux from p), false);
set local role authenticated;
select throws_ok(
  format($$ select public.get_case_detail(%L) $$, (select case_x from cs)),
  'P0002', null, 'get_case_detail: an unrelated member is denied (no_data_found)');
reset role;

-- =========================================================================
-- BE-4: narrative LIFECYCLE + Q14 RPC enforcement.
-- =========================================================================
-- save_narrative_body on N1 (assigned st_x2): the assignee CAN; a write-grantee
-- CANNOT (Q14); a read-grantee CANNOT.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.save_narrative_body(%L, 'corpo') $$, (select narr1 from cs)),
  'save_narrative_body: the narrative assignee can write N1');
reset role;

select test_helpers.claims_for((select gx_w from p), false);
set local role authenticated;
select throws_ok(
  format($$ select public.save_narrative_body(%L, 'hack') $$, (select narr1 from cs)),
  '42501', null, 'save_narrative_body: a write-grantee CANNOT write an other-assigned narrative (Q14)');
-- …but CAN write the UN-assigned N2.
select lives_ok(
  format($$ select public.save_narrative_body(%L, 'colaboração') $$, (select narr2 from cs)),
  'save_narrative_body: a write-grantee CAN write the un-assigned N2');
reset role;

-- conclude_narrative N1: the assignee concludes; then a write-grantee cannot reopen
-- (coordinator-only); the coordinator reopens.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.conclude_narrative(%L) $$, (select narr1 from cs)),
  'conclude_narrative: the assignee concludes N1 (aberta → concluida)');
-- A concluded narrative is frozen: a further body write is HC055.
select throws_ok(
  format($$ select public.save_narrative_body(%L, 'again') $$, (select narr1 from cs)),
  'HC055', null, 'save_narrative_body on a concluded narrative is rejected (HC055)');
reset role;
select is((select status from public.case_narratives where id = (select narr1 from cs)),
  'completed', 'N1 is concluida after conclude_narrative');

-- A write-grantee cannot reopen (coordinator-only) → 42501.
select test_helpers.claims_for((select gx_w from p), false);
set local role authenticated;
select throws_ok(
  format($$ select public.reopen_narrative(%L) $$, (select narr1 from cs)),
  '42501', null, 'reopen_narrative: a write-grantee cannot reopen (coordinator-only)');
reset role;
-- The coordinator reopens.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.reopen_narrative(%L) $$, (select narr1 from cs)),
  'reopen_narrative: the coordinator reopens N1 (concluida → aberta)');
reset role;
select is((select status from public.case_narratives where id = (select narr1 from cs)),
  'open', 'N1 is aberta again after reopen_narrative');

-- =========================================================================
-- BE-4: grant / revoke RPCs (coordinator-only; HC021 member check).
-- =========================================================================
-- A coordinator grants ux read; ux can now open the case.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.grant_case_access(%L, %L, 'read') $$,
         (select case_x from cs), (select ux from p)),
  'grant_case_access: coordinator grants read to a member');
-- Granting a NON-member (sa_y, of commission Y) is rejected (HC021).
select throws_ok(
  format($$ select public.grant_case_access(%L, %L, 'read') $$,
         (select case_x from cs), (select sa_y from k)),
  'HC021', null, 'grant_case_access: a non-member target is rejected (HC021)');
reset role;
select ok(app.can_read_case((select case_x from cs), (select ux from p)),
  'after grant, the formerly-unrelated member can_read_case → true');

-- =========================================================================
-- list_case_access (coordinator/admin-gated DEFINER read of the grant rows).
-- At this point the case has THREE grants: gx_r (read), gx_w (write), ux (read,
-- granted just above). Mirrors grant_case_access authz exactly.
-- =========================================================================
-- A coordinator reads ALL three grant rows.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.list_case_access((select case_x from cs))),
  3, 'list_case_access: the coordinator reads all three grant rows');
-- The levels are exactly read/write/read for gx_r/gx_w/ux.
select is(
  (select level from public.list_case_access((select case_x from cs))
   where user_id = (select gx_w from p)),
  'write', 'list_case_access: returns the correct level (gx_w → write)');
reset role;

-- A plain staff member (a non-coordinator, even though a member) is denied → 42501,
-- mirroring grant_case_access (the RPC gate, not the per-row RLS policy).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select * from public.list_case_access(%L) $$, (select case_x from cs)),
  '42501', null, 'list_case_access: a plain staff member is denied (42501)');
reset role;

-- A read-grantee is likewise a non-coordinator → denied (NOT the RLS "see own row").
select test_helpers.claims_for((select gx_r from p), false);
set local role authenticated;
select throws_ok(
  format($$ select * from public.list_case_access(%L) $$, (select case_x from cs)),
  '42501', null, 'list_case_access: a read-grantee (non-coordinator) is denied (42501)');
reset role;

-- A foreign coordinator (commission Y) is denied → 42501.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select * from public.list_case_access(%L) $$, (select case_x from cs)),
  '42501', null, 'list_case_access: a foreign coordinator is denied (42501)');
reset role;

-- (ADR 0078 B4: the flag-OFF "23514 unavailable" check is REMOVED — the case_access
-- flag is retired, so list_case_access is always available; authority is coordinator-only.)

-- A plain staff member cannot grant (coordinator-only) → 42501.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.grant_case_access(%L, %L, 'write') $$,
         (select case_x from cs), (select st_x from k)),
  '42501', null, 'grant_case_access: a plain staff member cannot grant (42501)');
reset role;

-- The coordinator revokes ux; ux loses read again.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.revoke_case_access(%L, %L) $$,
         (select case_x from cs), (select ux from p)),
  'revoke_case_access: coordinator revokes the grant');
reset role;
select ok(not app.can_read_case((select case_x from cs), (select ux from p)),
  'after revoke, the member can_read_case → false again (boundary restored)');

-- =========================================================================
-- BE-4: list_my_cases (self-scoped; status only; role chip; actionable).
-- =========================================================================
-- st_x (phase assignee of phases 1 & 2): the case appears, with at least the ativa
-- phase 1 marked actionable. my_role = viewer (no write grant).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table myc on commit drop as
  select public.list_my_cases((select comm_x from k)) as d;
grant select on myc to authenticated;
reset role;
select is((select jsonb_array_length(d) from myc), 1,
  'list_my_cases: the phase assignee sees exactly the one case');
select is(
  (select d -> 0 ->> 'my_role' from myc), 'viewer',
  'list_my_cases: a pure attributed member has my_role = viewer');
select ok(
  (select bool_or((it ->> 'actionable')::boolean)
   from myc, lateral jsonb_array_elements(d -> 0 -> 'items') it),
  'list_my_cases: at least one item is actionable (the ativa phase)');

-- gx_w (write grant, no attribution): the case appears with my_role = collaborator
-- and an EMPTY items array (granted, not attributed).
select test_helpers.claims_for((select gx_w from p), false);
set local role authenticated;
create temp table mycw on commit drop as
  select public.list_my_cases((select comm_x from k)) as d;
grant select on mycw to authenticated;
reset role;
select is((select d -> 0 ->> 'my_role' from mycw), 'collaborator',
  'list_my_cases: a write-grantee has my_role = collaborator');
select is(
  (select jsonb_array_length(d -> 0 -> 'items') from mycw), 0,
  'list_my_cases: a granted-but-unattributed member has an empty items array');

-- ux (unrelated, grant revoked above): list_my_cases is EMPTY (boundary).
select test_helpers.claims_for((select ux from p), false);
set local role authenticated;
select is(
  (select jsonb_array_length(public.list_my_cases((select comm_x from k)))), 0,
  'list_my_cases: the unrelated member sees NOTHING (boundary)');
reset role;

-- =========================================================================
-- BE-5 + CA-001 REGRESSION GUARD: get_case_detail must be VOLATILE (it now writes
-- the case.opened audit row); a non-coordinator open SUCCEEDS + writes EXACTLY ONE
-- case.opened row; a coordinator open writes NONE. (CA-001: declared stable, the
-- INSERT failed with 25006 in PostgREST's read-only txn → 404 for every
-- non-coordinator. This catalog + behavior pair makes the regression permanent.)
-- =========================================================================
-- (1) CATALOG: get_case_detail is volatile (provolatile='v'). The lone guard that
-- would have caught CA-001 at the migration level.
select is(
  (select provolatile::text from pg_proc
   where pronamespace = 'public'::regnamespace and proname = 'get_case_detail'),
  'v', 'CA-001: get_case_detail is VOLATILE (it writes the case.opened audit row)');
-- list_my_cases + case_viewer_capabilities are PURE reads → stable is correct.
select is(
  (select provolatile::text from pg_proc
   where pronamespace = 'public'::regnamespace and proname = 'list_my_cases'),
  's', 'list_my_cases is STABLE (pure read — no audit write)');
select is(
  (select provolatile::text from pg_proc
   where pronamespace = 'public'::regnamespace and proname = 'case_viewer_capabilities'),
  's', 'case_viewer_capabilities is STABLE (pure read)');

-- (2) BEHAVIOR: a fresh non-coordinator open by gx_w (who has NOT opened this case
-- yet — det above was gx_r) SUCCEEDS and writes EXACTLY ONE case.opened row for
-- that actor. This is the exact path CA-001 broke (25006 → null → notFound()).
select test_helpers.claims_for((select gx_w from p), false);
set local role authenticated;
select public.get_case_detail((select case_x from cs)) is not null as gxw_open_ok;
reset role;
select is(
  (select count(*)::int from public.audit_log
   where action = 'case.opened' and entity_id = (select case_x from cs)
     and actor_id = (select gx_w from p)),
  1, 'CA-001: a non-coordinator open SUCCEEDS and writes EXACTLY ONE case.opened row');

-- A read-grantee opened the case earlier (det) → at least one case.opened exists.
select cmp_ok(
  (select count(*)::int from public.audit_log
   where action = 'case.opened' and entity_id = (select case_x from cs)),
  '>=', 1, 'audit: a non-coordinator open emits a case.opened row');
-- The coordinator opens the case — must NOT add a case.opened row.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.get_case_detail((select case_x from cs)) is not null as coord_open;
reset role;
select is(
  (select count(*)::int from public.audit_log
   where action = 'case.opened' and entity_id = (select case_x from cs)
     and actor_id = (select sa_x from k)),
  0, 'audit: a coordinator open does NOT emit case.opened');
-- log_audit_access rejects a non-allow-listed action (positive allow-list).
select throws_ok(
  $$ select public.log_audit_access('case.deleted', 'case', gen_random_uuid(), null, 'x', '{}'::jsonb) $$,
  '23514', null, 'log_audit_access rejects an action outside the allow-list');
-- PHI-free: no case_narrative audit row copies body_md (we wrote 'corpo' /
-- 'colaboração' above) into its metadata.
select ok(
  not exists (
    select 1 from public.audit_log
    where entity_type = 'case_narrative'
      and (metadata ? 'body_md'
           or metadata::text ilike '%corpo%'
           or metadata::text ilike '%colabora%')
  ),
  'audit: case_narrative metadata NEVER carries body_md (Rule 11 — PHI/free-text free)');
-- The narrative audit DID capture status / assigned_to (the safe new allow-list cols).
select ok(
  exists (
    select 1 from public.audit_log
    where entity_type = 'case_narrative' and action = 'case_narrative.updated'
      and (metadata ? 'status' or metadata ? 'assigned_to')
  ),
  'audit: narrative status/assigned_to ARE captured (safe allow-list additions)');
-- A grant emitted a case_access.granted row carrying only the level (safe).
select cmp_ok(
  (select count(*)::int from public.audit_log
   where entity_type = 'case_access' and action = 'case_access.granted'),
  '>=', 1, 'audit: a grant emits a case_access.granted row');

-- =========================================================================
-- BE-4: get_case_detail re-gates to can_read_case (ADR 0078 B4 — the flag-OFF
-- coordinator-only floor is gone). The phase assignee now reads it; the coordinator too.
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select (public.get_case_detail((select case_x from cs)) ->> 'id')),
  (select case_x from cs)::text,
  'get_case_detail: the phase assignee (a case reader) reads it (re-gated to can_read_case)');
reset role;
-- The coordinator reads it too.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select (public.get_case_detail((select case_x from cs)) ->> 'id')),
  (select case_x from cs)::text,
  'get_case_detail: the coordinator reads it');
reset role;

select * from finish();
rollback;
