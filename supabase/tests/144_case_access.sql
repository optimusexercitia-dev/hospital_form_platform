-- Case Access Control (ADR 0033) — the SECURITY CORE checkpoint.
-- Migrations 20260619110000 (table + narrative cols + flag) + 110001 (the three
-- predicates + RLS tighten + additive write policies). RPCs (grants, narrative
-- lifecycle, list_my_cases, get_case_detail re-gate) land in BE-4 and are tested
-- separately — this file asserts ONLY the DB-side access spine the lead gated.
--
-- Proves (lead checkpoint):
--   (a) the predicate TRUTH-TABLE across personas with case_access ON —
--       can_read_case / can_write_case_content / can_write_case_narrative (Q14);
--   (b) flag OFF ⇒ can_read_case ≡ is_member_of for EVERY persona;
--   (c) the RLS BOUNDARY with the flag ON — an unrelated member gets 0 rows from
--       cases / case_phases / case_narratives / the child tables, while attributed
--       + granted members get their rows; no anon/PUBLIC leak.
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
select plan(43);

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
         (v->>'ver_u')::uuid  as ver_u
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

insert into public.commission_members (commission_id, user_id, role)
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
   (select ver_u from k), 'ativa', (select st_x from k), '{}');

insert into public.case_narratives
  (id, case_id, type_label, display_position, status, assigned_to)
values
  ((select narr1 from cs), (select case_x from cs), 'Resumo', 2, 'aberta',
   (select st_x2 from k)),
  ((select narr2 from cs), (select case_x from cs), 'Conclusão', 3, 'aberta', null);

insert into public.case_documents (id, case_id, title, storage_path, uploaded_by)
values ((select doc_x from cs), (select case_x from cs), 'Ata',
        (select comm_x from k) || '/' || (select case_x from cs) || '/doc.pdf',
        (select sa_x from k));

insert into public.case_events (id, case_id, kind, body, created_by)
values ((select event_x from cs), (select case_x from cs), 'note', 'nota',
        (select sa_x from k));

-- The two grants (direct insert; the grant RPC is BE-4). gx_r read, gx_w write.
insert into public.case_access (case_id, user_id, level, granted_by)
values
  ((select case_x from cs), (select gx_r from p), 'read',  (select sa_x from k)),
  ((select case_x from cs), (select gx_w from p), 'write', (select sa_x from k));

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
select ok(app.can_read_case((select case_x from cs), (select admin from k)),
  'can_read_case: admin → true');
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
select ok(app.can_write_case_content((select case_x from cs), (select admin from k)),
  'can_write_case_content: admin → true');
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
select is((select count(*)::int from public.case_documents where case_id = (select case_x from cs)),
  0, 'RLS: unrelated member reads 0 case_documents rows');
select is((select count(*)::int from public.case_events where case_id = (select case_x from cs)),
  0, 'RLS: unrelated member reads 0 case_events rows');
reset role;

-- gx_r (granted read): reads the case + a child.
select test_helpers.claims_for((select gx_r from p), false);
set local role authenticated;
select is((select count(*)::int from public.cases where id = (select case_x from cs)),
  1, 'RLS: granted-read member reads the case');
select is((select count(*)::int from public.case_documents where case_id = (select case_x from cs)),
  1, 'RLS: granted-read member reads the case documents');
reset role;

-- st_x (phase assignee): reads the case (attribution-derived).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.cases where id = (select case_x from cs)),
  1, 'RLS: phase assignee reads the case (attribution)');
reset role;

-- =========================================================================
-- (b) FLAG-OFF FALLBACK — with case_access OFF, can_read_case ≡ is_member_of for
-- EVERY persona (today's behavior; the boundary does not bite).
-- =========================================================================
update app.feature_flags set enabled = false where key = 'case_access';

-- Every MEMBER of X (coordinator, both assignees, both grantees, AND the otherwise
-- "unrelated" member) now reads the case — exactly is_member_of.
select ok(app.can_read_case((select case_x from cs), (select ux from p))
       =  app.is_member_of_for((select comm_x from k), (select ux from p)),
  'flag OFF: can_read_case(ux) ≡ is_member_of(ux) → true (member)');
select ok(app.can_read_case((select case_x from cs), (select ux from p)),
  'flag OFF: the unrelated MEMBER now reads the case (no boundary)');
select ok(app.can_read_case((select case_x from cs), (select sa_x from k))
       =  app.is_member_of_for((select comm_x from k), (select sa_x from k)),
  'flag OFF: can_read_case(coordinator) ≡ is_member_of');
select ok(app.can_read_case((select case_x from cs), (select st_x from k))
       =  app.is_member_of_for((select comm_x from k), (select st_x from k)),
  'flag OFF: can_read_case(phase assignee) ≡ is_member_of');
-- A NON-member (foreign coordinator) still reads nothing — is_member_of is false.
select ok(app.can_read_case((select case_x from cs), (select sa_y from k))
       =  app.is_member_of_for((select comm_x from k), (select sa_y from k)),
  'flag OFF: can_read_case(foreign) ≡ is_member_of → false (non-member)');
select ok(not app.can_read_case((select case_x from cs), (select sa_y from k)),
  'flag OFF: the foreign coordinator still reads nothing (non-member)');

-- The RLS policy itself follows the fallback: ux (a member) reads the case with the
-- flag OFF (proving the tightened policy reduces to member-read).
select test_helpers.claims_for((select ux from p), false);
set local role authenticated;
select is((select count(*)::int from public.cases where id = (select case_x from cs)),
  1, 'flag OFF (RLS): the unrelated member reads the case — byte-for-byte member-read');
reset role;

update app.feature_flags set enabled = true where key = 'case_access';

-- =========================================================================
-- No anon/PUBLIC leak: the three predicates + the capability read are not
-- anon-executable (deny-by-default for the public web role).
-- =========================================================================
select ok(not has_function_privilege('anon', 'app.can_read_case(uuid,uuid)', 'EXECUTE'),
  'anon cannot EXECUTE app.can_read_case');
select ok(not has_function_privilege('anon', 'public.case_viewer_capabilities(uuid)', 'EXECUTE'),
  'anon cannot EXECUTE public.case_viewer_capabilities');

select * from finish();
rollback;
