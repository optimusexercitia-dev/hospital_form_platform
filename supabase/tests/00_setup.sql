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
  -- AFF T3.5 / FUP-PCITV-1 row 6 — the ORG_ADMIN the hermetic fixture never had.
  -- Its absence left the `is_tenancy_admin_of` ORG disjunct of six existing
  -- isolation keystones unexercised: every one of them denied (or admitted) through
  -- the staff_admin arm, so the org arm could have been anything at all.
  oa_b uuid := gen_random_uuid();
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
  it_y_q1 uuid := gen_random_uuid();
begin
  -- Multi-tenancy: the committed seed creates 2 orgs, which makes
  -- app.is_multi_org() true globally — turning the global-PQS PHI modules INERT
  -- (the 20260629000000 guard). The hermetic suite tests SINGLE-org behavior, so
  -- wipe the seed's tenant tree first (CASCADE clears commissions/forms/cases/
  -- events/... ) and let bootstrap rebuild a clean single-org world below. This
  -- runs inside each test's transaction and is rolled back, so it never touches
  -- the persisted seed. Tests that WANT multi-org (e.g. 173) add a 2nd org after.
  --
  -- WS-2 C-1 (20260711000100): audit_log now carries a BEFORE TRUNCATE guard (HC042).
  -- This cascade reaches audit_log (audit_log FKs commissions), so opt into the
  -- deliberate-maintenance escape for the teardown only. Not a client bypass —
  -- authenticated has no TRUNCATE grant regardless of the GUC. `set local` keeps it
  -- scoped to this transaction (rolled back with the rest of the fixture).
  set local app.allow_audit_teardown = 'on';
  truncate table public.organizations cascade;
  set local app.allow_audit_teardown = 'off';

  -- The shared action_items hub ships GLOBAL default status/urgency vocabularies
  -- (commission_id NULL), seeded in migration 20260706000000. TRUNCATE cascades at
  -- the TABLE level: `truncate organizations cascade` flushes commissions, which
  -- FK-cascades into action_item_statuses / action_item_urgency_levels and wipes
  -- the globals too (NULL-commission rows included). Re-seed them here so the
  -- committee_* RPCs resolve an initial/done status inside the hermetic fixture —
  -- keeping the tests aligned with the exact keys the app ships (open/in_progress/
  -- done/cancelled; low/normal/high/critical).
  insert into public.action_item_statuses
    (commission_id, key, label, category, is_initial, is_terminal, sort_order)
  values
    (null, 'open',        'Aberto',       'open',        true,  false, 1),
    (null, 'in_progress', 'Em andamento', 'in_progress', false, false, 2),
    (null, 'done',        'Concluído',    'completed',   false, true,  3),
    (null, 'cancelled',   'Cancelado',    'cancelled',   false, true,  4)
  on conflict do nothing;
  insert into public.action_item_urgency_levels
    (commission_id, key, label, rank, sort_order)
  values
    (null, 'low',      'Baixa',   1, 1),
    (null, 'normal',   'Normal',  2, 2),
    (null, 'high',     'Alta',    3, 3),
    (null, 'critical', 'Crítica', 4, 4)
  on conflict do nothing;

  -- WS-3b D7: pqs_event_types / pqs_sentinel_criteria gained a hospital_id FK to
  -- hospitals (ON DELETE CASCADE, dual-scope). `truncate organizations cascade` above
  -- now transitively TRUNCATE-CASCADEs into these two vocab tables (it didn't before —
  -- they had no FK to a truncated table), wiping the baseline-seeded GLOBAL defaults.
  -- Re-seed a global default set here (all hospital_id NULL), mirroring the
  -- action_item_statuses re-seed precedent, so the flag-guarded triage tests (141 needs
  -- >= 5 event types + >= 10 sentinel criteria) still see platform vocab.
  insert into public.pqs_event_types (key, label, position, hospital_id) values
    ('fall','Queda',1,null), ('medication','Erro de medicação',2,null),
    ('hai','IRAS',3,null), ('patient_id','Identificação',4,null),
    ('surgical','Cirúrgico',5,null), ('device','Dispositivo',6,null),
    ('transfusion','Transfusional',7,null), ('diagnostic','Diagnóstico',8,null)
  on conflict do nothing;
  insert into public.pqs_sentinel_criteria (key, label, position, hospital_id) values
    ('wrong_site','Cirurgia em local errado',1,null), ('retained_object','Objeto retido',2,null),
    ('wrong_patient','Procedimento no paciente errado',3,null), ('suicide','Suicídio',4,null),
    ('infant_discharge','Alta de bebê para pessoa errada',5,null), ('rape','Violência sexual',6,null),
    ('hemolytic','Reação hemolítica',7,null), ('med_error_death','Óbito por erro de medicação',8,null),
    ('maternal_death','Morte materna',9,null), ('fall_death','Óbito por queda',10,null),
    ('fire','Incêndio/queimadura',11,null), ('gas_mixup','Troca de gás/linha',12,null)
  on conflict do nothing;

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
    ('00000000-0000-0000-0000-000000000000', st_y,  'authenticated', 'authenticated', st_y  || '@test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', oa_b,  'authenticated', 'authenticated', oa_b  || '@test', now(), now());

  update public.profiles set full_name = 'Admin', is_admin = true where id = admin_id;
  update public.profiles set full_name = 'StaffAdmin X' where id = sa_x;
  update public.profiles set full_name = 'Staff X' where id = st_x;
  update public.profiles set full_name = 'Staff X2' where id = st_x2;
  update public.profiles set full_name = 'StaffAdmin Y' where id = sa_y;
  update public.profiles set full_name = 'Staff Y' where id = st_y;
  update public.profiles set full_name = 'OrgAdmin B' where id = oa_b;

  -- One org + hospital for the fixture; commissions.organization_id is
  -- auto-derived from hospital_id by the trigger (we set hospital_id only).
  insert into public.organizations (id, name, slug)
    values (org_b, 'Org Bootstrap', 'org-' || substr(org_b::text,1,8));
  insert into public.hospitals (id, organization_id, name, slug)
    values (hosp_b, org_b, 'Hosp Bootstrap', 'hosp-' || substr(hosp_b::text,1,8));

  -- User-registration: every non-admin profile must be org-anchored (the deferred
  -- profiles_tenant_has_org_trg checks this at COMMIT). Anchor the bootstrap's
  -- tenant users to this fixture org now that it exists; the admin stays org-less.
  update public.profiles set home_organization_id = org_b
    where id in (sa_x, st_x, st_x2, sa_y, st_y, oa_b);

  insert into public.commissions (id, name, slug, created_by, hospital_id) values
    (comm_x, 'Comissão X', 'comm-x-' || substr(comm_x::text,1,8), admin_id, hosp_b),
    (comm_y, 'Comissão Y', 'comm-y-' || substr(comm_y::text,1,8), admin_id, hosp_b);

  -- The org-tier grant (organization_id set, hospital + commission NULL, per
  -- memberships_scope_shape). This makes `app.is_tenancy_admin_of(comm_x)` true for
  -- oa_b through its ORG leg, with no commission row at all — which is precisely the
  -- disjunct the fixture could not reach before.
  insert into public.memberships (organization_id, principal_id, role) values
    (org_b, oa_b, 'org_admin');

  insert into public.memberships (commission_id, principal_id, role) values
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
  insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
    values (item_mc, sec_u, 0, 'multiple_choice', 'u_q1', 'Q1', true);
  -- form-model-normalization: choice options are normalized rows. Codes are
  -- stable, hidden; tests that need to SELECT an option reference these codes.
  insert into public.form_item_options (item_id, position, code, label) values
    (item_mc, 0, 'sim', 'Sim'),
    (item_mc, 1, 'nao', 'Não');
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
  insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
    values (it_gate, sec_s1, 0, 'multiple_choice', 's_gate', 'Gate?', true);
  insert into public.form_item_options (item_id, position, code, label) values
    (it_gate, 0, 'sim', 'Sim'),
    (it_gate, 1, 'nao', 'Não');

  -- form-model-normalization: the condition stores the option CODE ('sim'), not
  -- the label — the answer_map is code-keyed. The gate option's code is 'sim'.
  insert into public.form_sections (id, form_version_id, position, title, visible_when)
    values (sec_cond, ver_s, 2, 'Conditional',
            jsonb_build_object('question_key','s_gate','op','equals','value','sim'));
  insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
    values (it_cond, sec_cond, 0, 'free_text', 's_cond', 'Cond detail', true);

  insert into public.form_sections (id, form_version_id, position, title, requires_signoff, signoff_role)
    values (sec_signoff_r, ver_s, 3, 'Respondent signoff', true, 'respondent');
  insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
    values (it_req, sec_signoff_r, 0, 'multiple_choice', 's_req', 'Confirm?', true);
  insert into public.form_item_options (item_id, position, code, label) values
    (it_req, 0, 'sim', 'Sim'),
    (it_req, 1, 'nao', 'Não');

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
  insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
    values (it_y_q1, sec_y, 0, 'multiple_choice', 'y_q1', 'Y Q1', true);
  insert into public.form_item_options (item_id, position, code, label) values
    (it_y_q1, 0, 'sim', 'Sim'),
    (it_y_q1, 1, 'nao', 'Não');
  perform public.publish_form_version(ver_y);

  v := jsonb_build_object(
    'admin', admin_id, 'sa_x', sa_x, 'st_x', st_x, 'st_x2', st_x2,
    'sa_y', sa_y, 'st_y', st_y, 'oa_b', oa_b, 'comm_x', comm_x, 'comm_y', comm_y,
    'form_u', form_u, 'ver_u', ver_u, 'sec_u', sec_u, 'item_mc', item_mc,
    'form_s', form_s, 'ver_s', ver_s,
    'sec_s0', sec_s0, 'sec_s1', sec_s1, 'sec_cond', sec_cond,
    'sec_signoff_r', sec_signoff_r, 'sec_signoff_a', sec_signoff_a,
    'it_gate', it_gate, 'it_cond', it_cond, 'it_req', it_req,
    'it_signoff_q', it_signoff_q,
    'form_y', form_y, 'ver_y', ver_y, 'it_y_q1', it_y_q1,
    -- Multi-tenancy: the bootstrap org + hospital both commissions hang under.
    'org_b', org_b, 'hosp_b', hosp_b
  );
  return v;
end;
$$;

-- answer-model-v2 test helper: choice selections now hang off a parent answers
-- row (answer_selected_options.answer_id). Mirrors save_section_answers: upsert
-- the top-level parent answer (value null), then insert one selection per code.
-- Returns the parent answer id. Used by the fixture test files that previously
-- inserted answer_selected_options(response_id,item_id,option_id) directly.
create or replace function test_helpers.add_selection(p_response uuid, p_item uuid, p_codes text[])
returns uuid
language plpgsql
as $$
declare
  v_answer_id uuid;
  v_qk text;
begin
  select question_key into v_qk from public.form_items where id = p_item;

  insert into public.answers (response_id, item_id, question_key, value, group_instance_id)
  values (p_response, p_item, v_qk, null, null)
  on conflict (response_id, item_id) where group_instance_id is null
  do update set question_key = excluded.question_key
  returning id into v_answer_id;

  insert into public.answer_selected_options (answer_id, option_id)
  select v_answer_id, o.id
  from public.form_item_options o
  where o.item_id = p_item and o.code = any (p_codes);

  return v_answer_id;
end;
$$;

-- Set the JWT claims PostgREST would set for a given user (sub + is_admin).
-- The test itself issues `set local role authenticated` / `reset role` around
-- the assertion — role switching is done with bare SQL because a non-superuser
-- role cannot SET ROLE back to postgres from inside a function.
--
-- ACT Stage 1 (ADR 0106 D12): gains p_active_role, the JWT claim Stage 3's
-- app.active_role() will read. NULL (the default) mints NO active_role key at
-- all — not a JSON null, an absent key — so every existing 2-arg call site
-- produces byte-identical claims to before, and the whole suite stays
-- vacuously green pre-cutover (plan §4 Stage 1).
--
-- ⚠ CREATE OR REPLACE cannot add a parameter to an existing function — the
-- argument list is part of its identity, so that would mint a SECOND
-- `claims_for(uuid, boolean)` overload beside this one and any existing 2-arg
-- call site becomes "function is not unique". DROP the old signature first so
-- exactly one `claims_for` overload exists. Verified property-preserving
-- against the pre-change pg_proc row (owner postgres, prosecdef=f/INVOKER,
-- volatile, plpgsql): none of those are set explicitly below, so none can
-- regress by omission, and the schema-level
-- `grant execute on all functions in schema test_helpers to authenticated`
-- a few lines down re-applies the ACL on every 00_setup.sql run regardless.
--
-- ACT Stage 2 regression fix (found running the diff-scoped door sweep,
-- ADR 0079 Amendment 1): this DROP only ever matches the STALE 2-arg
-- signature, so it is a no-op on every run after the first successful
-- 2-arg -> 3-arg transition (the 2-arg overload is gone for good at that
-- point). The block below was `create function` (not `create or replace`),
-- which is safe exactly once — the FIRST run after this file changed, when
-- no 3-arg claims_for existed yet to collide with. Every subsequent
-- `supabase test db` invocation without an intervening `db reset` hit
-- "function test_helpers.claims_for(uuid, boolean, text) already exists
-- with same argument types" at 00_setup.sql itself, aborting before any TAP
-- output — Files=175 but Result: FAIL, no plan found. This silently broke
-- the load-bearing assumption p0-authz-door-audit.sh states outright ("this
-- harness runs `supabase test db`... so there is NO pgtap preflight here")
-- and every other workflow that calls `supabase test db` more than once
-- against the same reset. Restored to `create or replace`: once the 3-arg
-- signature is resident, CREATE OR REPLACE on the identical signature is
-- always idempotent (unlike the 2-arg -> 3-arg transition, where the
-- argument list itself changes identity) — the DROP above still handles
-- that one-time transition, and OR REPLACE now handles every run after.
-- ACT Stage 3 addition: when p_active_role is NOT given, auto-derive it by
-- MIRRORING public.custom_access_token_hook's own D11 break-glass logic
-- (exactly one live role type -> that role; 0 or 2+ -> no claim at all) —
-- instead of requiring every one of ~1949 claims_for call sites across the
-- suite to pass p_active_role explicitly. A pgTAP fixture principal is
-- overwhelmingly single-role (synthetic, minimally-provisioned per file) —
-- exactly the population D11's implicit derivation exists for; this makes
-- the harness's default behaviour match production's default behaviour for
-- that population, rather than diverging from it. A genuinely multi-role
-- fixture principal still gets NO claim here (same as a real multi-role
-- hatless caller, D5) and needs an EXPLICIT p_active_role at its own call
-- site to exercise a specific hat.
--
-- SECURITY DEFINER — a deliberate property change from the INVOKER shape Stage
-- 1/2 verified and preserved (found live: several files call `set local role
-- authenticated` BEFORE their first `claims_for`, e.g.
-- 201_documents_redesign.sql:47-48 — at that point `request.jwt.claims` is
-- still unset/stale, so the auto-derivation query below, run as `authenticated`
-- under `memberships`'s own RLS policy, saw ZERO rows for a principal who
-- genuinely holds exactly one live role, minted NO claim, and every
-- has_role-gated call in the test then failed closed). DEFINER makes this
-- internal lookup see the TRUE membership state regardless of which PG role
-- is active when it's called — exactly the sanctioned SECURITY DEFINER use
-- (bypassing RLS on an internal lookup, `test_helpers` is never exposed to
-- PostgREST, and the function still only acts on the p_user it's given, no
-- caller-supplied SQL). `search_path` pinned per the same house convention as
-- every other DEFINER function in this codebase.
create or replace function test_helpers.claims_for(
  p_user uuid,
  p_is_admin boolean default false,
  p_active_role text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_claims jsonb;
  v_role text := p_active_role;
  v_live_roles text[];
begin
  if v_role is null then
    select array_agg(distinct role) into v_live_roles
    from (
      select 'platform_admin'::text as role where p_is_admin
      union all
      select distinct m.role from public.memberships m
      where m.principal_id = p_user
        and (m.expires_at is null or m.expires_at > now())
    ) t;

    if coalesce(array_length(v_live_roles, 1), 0) = 1 then
      v_role := v_live_roles[1];
    end if;
  end if;

  v_claims := jsonb_build_object('sub', p_user, 'role', 'authenticated', 'is_admin', p_is_admin);
  if v_role is not null then
    v_claims := v_claims || jsonb_build_object('active_role', v_role);
  end if;
  perform set_config('request.jwt.claims', v_claims::text, true);
end;
$$;

-- ADR 0078 Stage B: the legacy `case_access(level)` shape is gone. This helper
-- translates a legacy read/write grant into a `case_access_grants` row EXACTLY as
-- the B5 seed + the data migration do (read→content+deliberation, write→+write,
-- NO PHI inferred; max_confidentiality carried as the orthogonal ceiling). Test
-- fixtures that used to `insert into public.case_access (...)` call this instead.
create or replace function test_helpers.grant_ca(
  p_case uuid, p_user uuid, p_level text default 'read',
  p_granted_by uuid default null,
  p_expires_at timestamptz default null,
  p_max_conf text default null,
  p_read_standard_phi boolean default false,
  p_read_restricted_phi boolean default false)
returns void
language sql
as $$
  insert into public.case_access_grants
    (case_id, principal_id, source, read_case_content, read_case_deliberation,
     write_case_content, read_standard_phi, read_restricted_phi,
     max_confidentiality, granted_by, expires_at, reason_code)
  values
    (p_case, p_user, 'manual_grant', true, true,
     (p_level = 'write'),
     (p_read_standard_phi or p_read_restricted_phi), p_read_restricted_phi,
     p_max_conf, p_granted_by, p_expires_at, 'coordinator_grant')
  on conflict (case_id, principal_id, source, source_entity_id) where revoked_at is null
  do update set write_case_content    = excluded.write_case_content,
                read_standard_phi      = excluded.read_standard_phi,
                read_restricted_phi    = excluded.read_restricted_phi,
                max_confidentiality    = excluded.max_confidentiality,
                expires_at             = excluded.expires_at;
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
