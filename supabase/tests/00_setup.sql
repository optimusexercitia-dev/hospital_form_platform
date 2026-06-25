-- pgTAP shared fixture builder. Each test file BEGINs its own transaction,
-- calls test_helpers.bootstrap() to create a hermetic dataset (independent of
-- seed.sql), runs its assertions, and ROLLBACKs. Personas are created with
-- known uuids so tests can `set local request.jwt.claims` to act as them.
--
-- This file only DEFINES the helper schema; it is loaded first because
-- `supabase test db` runs files in lexical order and each runs in its own
-- transaction. To keep the helper available across files, we install it
-- permanently (outside the per-test rollback) via a separate path: we create it
-- here and the create is idempotent.

create schema if not exists test_helpers;

-- Build a self-contained dataset and return the key ids as a record.
-- admin, two commissions (X, Y), a staff_admin + staff in each, one published
-- unsectioned form in X, one published sectioned form (with a conditional and
-- two sign-off sections) in X, ready for response tests.
create or replace function test_helpers.bootstrap()
returns jsonb
language plpgsql
as $$
declare
  v jsonb := '{}'::jsonb;
  admin_id uuid := gen_random_uuid();
  sa_x uuid := gen_random_uuid();
  st_x uuid := gen_random_uuid();
  st_x2 uuid := gen_random_uuid();
  sa_y uuid := gen_random_uuid();
  st_y uuid := gen_random_uuid();
  comm_x uuid := gen_random_uuid();
  comm_y uuid := gen_random_uuid();
  -- Multi-tenancy: commissions.{hospital_id,organization_id} are NOT NULL since
  -- Phase C, so bootstrap creates an org + hospital and homes both commissions
  -- under it. Tests that need a SECOND org (170/172) create their own and
  -- re-home a commission via update; that still works (the derive trigger refills
  -- organization_id). One org here keeps the legacy commission-isolation tests
  -- (X vs Y) valid — isolation is by commission membership, not org.
  org_b uuid := gen_random_uuid();
  hosp_b uuid := gen_random_uuid();
  form_u uuid := gen_random_uuid();
  ver_u uuid := gen_random_uuid();
  sec_u uuid := gen_random_uuid();
  item_mc uuid := gen_random_uuid();
  form_s uuid := gen_random_uuid();
  ver_s uuid := gen_random_uuid();
  sec_s0 uuid := gen_random_uuid();
  sec_s1 uuid := gen_random_uuid();
  sec_cond uuid := gen_random_uuid();
  sec_signoff_r uuid := gen_random_uuid();
  sec_signoff_a uuid := gen_random_uuid();
  it_gate uuid := gen_random_uuid();
  it_req uuid := gen_random_uuid();
  it_cond uuid := gen_random_uuid();
  it_signoff_q uuid := gen_random_uuid();
  -- Minimal published form in commission Y (so responses scoped to Y reference
  -- a Y form version — required by the response version/commission guard).
  form_y uuid := gen_random_uuid();
  ver_y uuid := gen_random_uuid();
  sec_y uuid := gen_random_uuid();
begin
  -- Multi-tenancy: the committed seed creates 2 orgs, which makes
  -- app.is_multi_org() true globally — turning the global-PQS PHI modules INERT
  -- (the 20260629000000 guard). The hermetic suite tests SINGLE-org behavior, so
  -- wipe the seed's tenant tree first (CASCADE clears commissions/forms/cases/
  -- events/... ) and let bootstrap rebuild a clean single-org world below. This
  -- runs inside each test's transaction and is rolled back, so it never touches
  -- the persisted seed. Tests that WANT multi-org (e.g. 173) add a 2nd org after.
  truncate table public.organizations cascade;

  -- profiles.id references auth.users, so create the auth users first; the
  -- on_auth_user_created trigger inserts the matching profiles rows. We then
  -- patch names + the admin flag.
  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated', admin_id || '@test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', sa_x,  'authenticated', 'authenticated', sa_x  || '@test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', st_x,  'authenticated', 'authenticated', st_x  || '@test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', st_x2, 'authenticated', 'authenticated', st_x2 || '@test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', sa_y,  'authenticated', 'authenticated', sa_y  || '@test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', st_y,  'authenticated', 'authenticated', st_y  || '@test', now(), now());

  update public.profiles set full_name = 'Admin', is_admin = true where id = admin_id;
  update public.profiles set full_name = 'StaffAdmin X' where id = sa_x;
  update public.profiles set full_name = 'Staff X' where id = st_x;
  update public.profiles set full_name = 'Staff X2' where id = st_x2;
  update public.profiles set full_name = 'StaffAdmin Y' where id = sa_y;
  update public.profiles set full_name = 'Staff Y' where id = st_y;

  -- One org + hospital for the fixture; commissions.organization_id is
  -- auto-derived from hospital_id by the trigger (we set hospital_id only).
  insert into public.organizations (id, name, slug)
    values (org_b, 'Org Bootstrap', 'org-' || substr(org_b::text,1,8));
  insert into public.hospitals (id, organization_id, name, slug)
    values (hosp_b, org_b, 'Hosp Bootstrap', 'hosp-' || substr(hosp_b::text,1,8));

  insert into public.commissions (id, name, slug, created_by, hospital_id) values
    (comm_x, 'Comissão X', 'comm-x-' || substr(comm_x::text,1,8), admin_id, hosp_b),
    (comm_y, 'Comissão Y', 'comm-y-' || substr(comm_y::text,1,8), admin_id, hosp_b);

  insert into public.commission_members (commission_id, user_id, role) values
    (comm_x, sa_x, 'staff_admin'),
    (comm_x, st_x, 'staff'),
    (comm_x, st_x2, 'staff'),
    (comm_y, sa_y, 'staff_admin'),
    (comm_y, st_y, 'staff');

  -- Unsectioned published form in X with one required multiple_choice + one
  -- display item.
  insert into public.forms (id, commission_id, title, created_by)
    values (form_u, comm_x, 'Form U', sa_x);
  insert into public.form_versions (id, form_id, version_number, status)
    values (ver_u, form_u, 1, 'draft');
  insert into public.form_sections (id, form_version_id, position, is_default)
    values (sec_u, ver_u, 0, true);
  insert into public.form_items (id, section_id, position, item_type, question_key, label, options, required)
    values (item_mc, sec_u, 0, 'multiple_choice', 'u_q1', 'Q1', '["Sim","Não"]'::jsonb, true);
  insert into public.form_items (section_id, position, item_type, content)
    values (sec_u, 1, 'section_text', jsonb_build_object('markdown','oi'));
  perform public.publish_form_version(ver_u);

  -- Sectioned published form in X: default(0) + gate(1) + conditional(2) +
  -- respondent sign-off(3) + staff_admin sign-off(4).
  insert into public.forms (id, commission_id, title, created_by)
    values (form_s, comm_x, 'Form S', sa_x);
  insert into public.form_versions (id, form_id, version_number, status)
    values (ver_s, form_s, 1, 'draft');
  insert into public.form_sections (id, form_version_id, position, is_default)
    values (sec_s0, ver_s, 0, true);

  insert into public.form_sections (id, form_version_id, position, title)
    values (sec_s1, ver_s, 1, 'Gate');
  insert into public.form_items (id, section_id, position, item_type, question_key, label, options, required)
    values (it_gate, sec_s1, 0, 'multiple_choice', 's_gate', 'Gate?', '["Sim","Não"]'::jsonb, true);

  insert into public.form_sections (id, form_version_id, position, title, visible_when)
    values (sec_cond, ver_s, 2, 'Conditional',
            jsonb_build_object('question_key','s_gate','op','equals','value','Sim'));
  insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
    values (it_cond, sec_cond, 0, 'free_text', 's_cond', 'Cond detail', true);

  insert into public.form_sections (id, form_version_id, position, title, requires_signoff, signoff_role)
    values (sec_signoff_r, ver_s, 3, 'Respondent signoff', true, 'respondent');
  insert into public.form_items (id, section_id, position, item_type, question_key, label, options, required)
    values (it_req, sec_signoff_r, 0, 'multiple_choice', 's_req', 'Confirm?', '["Sim","Não"]'::jsonb, true);

  insert into public.form_sections (id, form_version_id, position, title, requires_signoff, signoff_role)
    values (sec_signoff_a, ver_s, 4, 'Admin signoff', true, 'staff_admin');
  insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
    values (it_signoff_q, sec_signoff_a, 0, 'free_text', 's_admin', 'Admin note', false);

  perform public.publish_form_version(ver_s);

  -- Minimal published unsectioned form in commission Y.
  insert into public.forms (id, commission_id, title, created_by)
    values (form_y, comm_y, 'Form Y', sa_y);
  insert into public.form_versions (id, form_id, version_number, status)
    values (ver_y, form_y, 1, 'draft');
  insert into public.form_sections (id, form_version_id, position, is_default)
    values (sec_y, ver_y, 0, true);
  insert into public.form_items (section_id, position, item_type, question_key, label, options, required)
    values (sec_y, 0, 'multiple_choice', 'y_q1', 'Y Q1', '["Sim","Não"]'::jsonb, true);
  perform public.publish_form_version(ver_y);

  v := jsonb_build_object(
    'admin', admin_id, 'sa_x', sa_x, 'st_x', st_x, 'st_x2', st_x2,
    'sa_y', sa_y, 'st_y', st_y, 'comm_x', comm_x, 'comm_y', comm_y,
    'form_u', form_u, 'ver_u', ver_u, 'sec_u', sec_u, 'item_mc', item_mc,
    'form_s', form_s, 'ver_s', ver_s,
    'sec_s0', sec_s0, 'sec_s1', sec_s1, 'sec_cond', sec_cond,
    'sec_signoff_r', sec_signoff_r, 'sec_signoff_a', sec_signoff_a,
    'it_gate', it_gate, 'it_cond', it_cond, 'it_req', it_req,
    'it_signoff_q', it_signoff_q,
    'form_y', form_y, 'ver_y', ver_y,
    -- Multi-tenancy: the bootstrap org + hospital both commissions hang under.
    'org_b', org_b, 'hosp_b', hosp_b
  );
  return v;
end;
$$;

-- Set the JWT claims PostgREST would set for a given user (sub + is_admin).
-- The test itself issues `set local role authenticated` / `reset role` around
-- the assertion — role switching is done with bare SQL because a non-superuser
-- role cannot SET ROLE back to postgres from inside a function.
create or replace function test_helpers.claims_for(p_user uuid, p_is_admin boolean default false)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', p_user, 'role', 'authenticated', 'is_admin', p_is_admin)::text,
    true);
end;
$$;

-- act_as switches into the authenticated role, which then needs to call
-- reset_role()/act_as() again; grant it access to the helper schema.
grant usage on schema test_helpers to authenticated;
grant execute on all functions in schema test_helpers to authenticated;

-- This file is run by pg_prove first and must emit a TAP plan. It deliberately
-- does NOT wrap itself in a transaction/rollback, so the test_helpers schema
-- above is committed and available to the test files that follow (pg_prove runs
-- files over a shared connection in lexical order).
begin;
select plan(1);
select has_function('test_helpers', 'bootstrap', 'test_helpers installed');
select * from finish();
rollback;
