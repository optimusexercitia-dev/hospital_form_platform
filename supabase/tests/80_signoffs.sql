-- Phase 6: sign-off RPCs + enforcement. Exercises sign_section (respondent +
-- staff_admin paths, the signer-role RLS rule, the visibility precondition, the
-- already-signed race), the SECURITY DEFINER reads (list_signoff_queue,
-- get_response_for_signoff), submitted-immutability of sign-offs, and the now-ON
-- submit_response P0012 enforcement (reject unsigned -> succeed once signed).
--
-- The RPCs that sign are SECURITY INVOKER, so we act as the relevant persona
-- (authenticated) around each call and reset to superuser to read freely.
-- Sign-off enforcement is ON in this DB after migration 20260613090001.

begin;
select plan(18);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

-- Bootstrap form S sections: gate(1), conditional(2, visible when s_gate='Sim'),
-- respondent sign-off(3, required item s_req), staff_admin sign-off(4).
-- Helper: a submit-ready in_progress response on S owned by staff X, taking the
-- HIDDEN branch (s_gate='Não'), with the respondent-section required item
-- answered. The staff_admin section (4) is unconditionally visible + unsigned.
create temp table r on commit drop as select gen_random_uuid() as id;
grant select on r to authenticated;

insert into public.responses (id, form_version_id, commission_id, created_by, status)
select r.id, (c.v->>'ver_s')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x')::uuid, 'in_progress'
from r, ctx c;

insert into public.answers (response_id, item_id, question_key, value)
select (select id from r), (c.v->>'it_gate')::uuid, 's_gate', '"Não"'::jsonb from ctx c;
insert into public.answers (response_id, item_id, question_key, value)
select (select id from r), (c.v->>'it_req')::uuid, 's_req', '"Sim"'::jsonb from ctx c;

-- ---- 1) the response creator signs their own RESPONDENT section -> succeeds ----
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select lives_ok(
  format($$ select public.sign_section(%L, %L, %L) $$,
    (select id from r), (select v->>'sec_signoff_r' from ctx), 'ok pelo respondente'),
  'respondent signs their own respondent-role section'
);
reset role;

select is(
  (select count(*)::int from public.response_section_signoffs so
     where so.response_id = (select id from r)
       and so.section_id = (select (v->>'sec_signoff_r')::uuid from ctx)
       and so.signed_by = (select (v->>'st_x')::uuid from ctx)),
  1,
  'respondent sign-off row recorded with signed_by = creator'
);

-- ---- 2) a plain STAFF member cannot sign the STAFF_ADMIN section (RLS) ----
-- st_x2 is a staff (not staff_admin) of comm X and not the creator; the
-- signoffs_insert WITH CHECK must reject the insert.
select test_helpers.claims_for((select (v->>'st_x2')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$ select public.sign_section(%L, %L, null) $$,
    (select id from r), (select v->>'sec_signoff_a' from ctx)),
  '42501',
  null,
  'a plain staff member cannot sign a staff_admin section (RLS rejects)'
);
reset role;

-- ---- 3) the STAFF_ADMIN signs the staff_admin section -> succeeds ----
select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;
select lives_ok(
  format($$ select public.sign_section(%L, %L, %L) $$,
    (select id from r), (select v->>'sec_signoff_a' from ctx), 'revisado pela chefia'),
  'staff_admin signs the staff_admin-role section'
);
reset role;

select is(
  (select count(*)::int from public.response_section_signoffs so
     where so.response_id = (select id from r)
       and so.section_id = (select (v->>'sec_signoff_a')::uuid from ctx)
       and so.signed_by = (select (v->>'sa_x')::uuid from ctx)),
  1,
  'staff_admin sign-off row recorded with signed_by = staff_admin'
);

-- ---- 4) double-sign the same (response, section) -> P0015 already_signed ----
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$ select public.sign_section(%L, %L, null) $$,
    (select id from r), (select v->>'sec_signoff_r' from ctx)),
  'P0015',
  null,
  'signing an already-signed section raises P0015 (já assinada)'
);
reset role;

-- ---- 5a) sign_section rejects a section that does NOT require a sign-off
-- (the requires_signoff guard, before the visibility check) ----
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$ select public.sign_section(%L, %L, null) $$,
    (select id from r), (select v->>'sec_s1' from ctx)),
  '23514',
  null,
  'signing a section that does not require a sign-off is rejected (check_violation)'
);
reset role;

-- ---- 5b) sign_section rejects an INVISIBLE (conditional-hidden) sign-off
-- section with P0014. Build a dedicated published form P (in commission X) whose
-- respondent sign-off section is CONDITIONAL on a gate answer; a response that
-- answers the gate so the sign-off section is hidden cannot sign it. (Form S's
-- sign-off sections are unconditional, so this needs its own fixture.) ----
do $$
declare
  c jsonb := (select v from ctx);
  form_p uuid := gen_random_uuid();
  ver_p uuid := gen_random_uuid();
  sec_p0 uuid := gen_random_uuid();
  sec_pgate uuid := gen_random_uuid();
  sec_psign uuid := gen_random_uuid();
  it_pgate uuid := gen_random_uuid();
begin
  insert into public.forms (id, commission_id, title, created_by)
    values (form_p, (c->>'comm_x')::uuid, 'Form P', (c->>'sa_x')::uuid);
  insert into public.form_versions (id, form_id, version_number, status)
    values (ver_p, form_p, 1, 'draft');
  insert into public.form_sections (id, form_version_id, position, is_default)
    values (sec_p0, ver_p, 0, true);
  insert into public.form_sections (id, form_version_id, position, title)
    values (sec_pgate, ver_p, 1, 'Gate P');
  insert into public.form_items (id, section_id, position, item_type, question_key, label, options, required)
    values (it_pgate, sec_pgate, 0, 'multiple_choice', 'p_gate', 'Gate?', '["Sim","Não"]'::jsonb, true);
  -- Conditional respondent sign-off: visible only when p_gate = 'Sim'.
  insert into public.form_sections (id, form_version_id, position, title, requires_signoff, signoff_role, visible_when)
    values (sec_psign, ver_p, 2, 'Cond signoff P', true, 'respondent',
            jsonb_build_object('question_key','p_gate','op','equals','value','Sim'));
  perform public.publish_form_version(ver_p);

  -- A response that answers the gate 'Não' -> the sign-off section is hidden.
  insert into public.responses (id, form_version_id, commission_id, created_by, status)
    values ('dddddddd-0000-0000-0000-0000000000d1', ver_p, (c->>'comm_x')::uuid, (c->>'st_x')::uuid, 'in_progress');
  insert into public.answers (response_id, item_id, question_key, value)
    values ('dddddddd-0000-0000-0000-0000000000d1', it_pgate, 'p_gate', '"Não"'::jsonb);
  -- Stash the hidden section id for the assertion.
  perform set_config('test.sec_psign', sec_psign::text, true);
end $$;

select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$ select public.sign_section(%L, %L, null) $$,
    'dddddddd-0000-0000-0000-0000000000d1',
    current_setting('test.sec_psign')),
  'P0014',
  null,
  'sign_section rejects a conditional-hidden sign-off section (P0014)'
);
reset role;

-- ---- 6) sign-offs are IMMUTABLE after submission ----
-- Sign both visible sign-off sections (already done: respondent + staff_admin),
-- then submit; afterwards a new sign-off insert / update must be blocked by the
-- submitted-immutability guard.
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select lives_ok(
  format($$ select public.submit_response(%L) $$, (select id from r)),
  'submit succeeds once all visible sign-off sections are signed (enforcement ON)'
);
reset role;

-- Attempt to mutate a sign-off of the now-submitted response (as superuser, so
-- only the immutability TRIGGER — not RLS — can block it).
select throws_ok(
  format($$ update public.response_section_signoffs set note = 'tampered'
            where response_id = %L $$, (select id from r)),
  '23514',
  null,
  'sign-offs of a submitted response are immutable (update blocked)'
);

-- ---- 7) enforcement ON: submit REJECTS while a visible staff_admin section is
-- unsigned, then SUCCEEDS once signed. Fresh response on S, hidden branch. ----
create temp table r2 on commit drop as select gen_random_uuid() as id;
grant select on r2 to authenticated;
insert into public.responses (id, form_version_id, commission_id, created_by, status)
select r2.id, (c.v->>'ver_s')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x2')::uuid, 'in_progress'
from r2, ctx c;
insert into public.answers (response_id, item_id, question_key, value)
select (select id from r2), (c.v->>'it_gate')::uuid, 's_gate', '"Não"'::jsonb from ctx c;
insert into public.answers (response_id, item_id, question_key, value)
select (select id from r2), (c.v->>'it_req')::uuid, 's_req', '"Sim"'::jsonb from ctx c;

-- Sign only the respondent section, leaving the staff_admin section unsigned.
select test_helpers.claims_for((select (v->>'st_x2')::uuid from ctx), false);
set local role authenticated;
select lives_ok(
  format($$ select public.sign_section(%L, %L, null) $$,
    (select id from r2), (select v->>'sec_signoff_r' from ctx)),
  'respondent signs their section on the second response'
);
select throws_ok(
  format($$ select public.submit_response(%L) $$, (select id from r2)),
  'P0012',
  null,
  'submit rejects (P0012) while a visible staff_admin section is unsigned'
);
reset role;

-- ---- 8) list_signoff_queue: the staff_admin sees the awaiting response;
-- a non-staff_admin sees nothing. r2 is now submit-ready + has a pending
-- staff_admin section. ----
select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;
select is(
  (select count(*)::int from public.list_signoff_queue((select (v->>'comm_x')::uuid from ctx)) q
     where q.response_id = (select id from r2)),
  1,
  'list_signoff_queue surfaces the submit-ready response awaiting staff_admin sign-off'
);
reset role;

-- A plain staff member gets an empty queue (internal gate).
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select is(
  (select count(*)::int from public.list_signoff_queue((select (v->>'comm_x')::uuid from ctx))),
  0,
  'list_signoff_queue returns nothing for a non-staff_admin'
);
reset role;

-- ---- 9) list_signoff_queue does NOT surface a half-filled (not submit-ready)
-- draft. Fresh response missing the required respondent answer. ----
create temp table r3 on commit drop as select gen_random_uuid() as id;
grant select on r3 to authenticated;
insert into public.responses (id, form_version_id, commission_id, created_by, status)
select r3.id, (c.v->>'ver_s')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x')::uuid, 'in_progress'
from r3, ctx c;
-- Answer the gate ('Não') but NOT the required s_req item -> not submit-ready.
insert into public.answers (response_id, item_id, question_key, value)
select (select id from r3), (c.v->>'it_gate')::uuid, 's_gate', '"Não"'::jsonb from ctx c;

select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;
select is(
  (select count(*)::int from public.list_signoff_queue((select (v->>'comm_x')::uuid from ctx)) q
     where q.response_id = (select id from r3)),
  0,
  'list_signoff_queue excludes a half-filled (not submit-ready) draft'
);
reset role;

-- ---- 10) get_response_for_signoff: the staff_admin reads r2 (pending
-- staff_admin section); a non-staff_admin is denied. ----
select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;
select is(
  (select (public.get_response_for_signoff((select id from r2)) ->> 'response_id')),
  (select (id)::text from r2),
  'get_response_for_signoff returns the response payload for the gated staff_admin'
);
select throws_ok(
  format($$ select public.get_response_for_signoff(%L) $$, (select id from r)),
  'P0002',
  null,
  'get_response_for_signoff denies a SUBMITTED response (no pending sign-off / not in_progress)'
);
reset role;

-- A non-staff_admin (the creator's peer staff) cannot use the definer read.
select test_helpers.claims_for((select (v->>'st_x')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$ select public.get_response_for_signoff(%L) $$, (select id from r2)),
  'P0002',
  null,
  'get_response_for_signoff denies a non-staff_admin caller'
);
reset role;

select * from finish();
rollback;
