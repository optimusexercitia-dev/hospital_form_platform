-- Local dev / E2E seed. Idempotent enough to survive `npx supabase db reset`
-- (reset recreates the DB, then runs migrations, then this file once).
--
-- Content rules: all user-facing strings are pt-BR; questions are
-- compliance-checklist style. Identifiers and comments are English. SYNTHETIC PHI
-- (demo patient identifiers) lives ONLY in the isolated PHI tables — event_patient /
-- referral_patient / case_patient — per Architecture Rule 12 (since Phase 14a). The
-- direct seed inserts carry the new organization_id columns (NSP-per-org, ADR 0042).
--
-- Personas (password for ALL: Test1234!):
--   admin@test.local          org_admin of Rede A (+ enrolled in Rede A's PQS roster)
--   chefe.ccih@test.local     staff_admin of commission A (CCIH)
--   staff1.ccih@test.local     staff of A
--   staff2.ccih@test.local     staff of A
--   chefe.farm@test.local     staff_admin of commission B (Farmácia e Terapêutica)
--   staff1.farm@test.local     staff of B
--   staff2.farm@test.local     staff of B
--   multi@test.local          staff of BOTH A and B (exercises the commission picker)
--   platform@test.local       vendor platform_admin (walled off all tenant data)
--   orgadmin.a/.b@test.local  org_admin of Rede A / Rede B
--   nspcoord.a/.b@test.local  per-org NSP coordinator (CURATES the roster; NOT
--                             enrolled → cannot read PHI until self-enrolled)
--   pqs.a/.b@test.local       enrolled PQS reader of Rede A / Rede B (reads that
--                             org's PHI only — the cross-org isolation keystone)

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- answer-model-v2 seed helper: choice selections now hang off a parent answers
-- row (answer_selected_options.answer_id). This helper upserts the parent answer
-- (value null, top-level) and inserts one selection per code — mirroring
-- save_section_answers. Dropped at the end of the seed. Runs under the caller's
-- app.in_submit_rpc setting so it works for submitted responses too.
-- ---------------------------------------------------------------------------
create or replace function app.seed_select(p_response uuid, p_item uuid, p_codes text[])
returns void language plpgsql as $seed_select$
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
end;
$seed_select$;

-- ---------------------------------------------------------------------------
-- User-registration: organizations + hospitals are created FIRST (before the
-- auth.users loop) so each tenant user's profiles.home_organization_id FK is
-- satisfiable at handle_new_user trigger time (the trigger reads the org from
-- user_metadata, mirroring the real invite path). created_by is set to NULL here
-- and patched to the vendor after it exists (breaks the users<->orgs FK cycle;
-- organizations.created_by is nullable + cosmetic). commissions/memberships stay
-- below (they depend on the users). Org/hospital ids are UNCHANGED.
-- ---------------------------------------------------------------------------
insert into public.organizations (id, name, slug, created_by) values
  ('0c000000-0000-0000-0000-00000000000a', 'Rede Hospitalar A', 'rede-a', null),
  ('0c000000-0000-0000-0000-00000000000b', 'Rede Hospitalar B', 'rede-b', null);

insert into public.hospitals (id, organization_id, name, slug) values
  ('05000000-0000-0000-0000-00000000000a', '0c000000-0000-0000-0000-00000000000a', 'Hospital Central A', 'central-a'),
  ('05000000-0000-0000-0000-00000000000b', '0c000000-0000-0000-0000-00000000000b', 'Hospital Central B', 'central-b'),
  -- Hospital-admin tier (ADR 0051): a SECOND hospital under org-a, so cross-
  -- hospital isolation WITHIN one org is testable (a hospital_admin of central-a
  -- must see NOTHING of this hospital's commissions). It gets its own commission
  -- (Comissão de Ética) below.
  ('05000000-0000-0000-0000-0000000000a2', '0c000000-0000-0000-0000-00000000000a', 'Hospital Secundário A', 'secundario-a');

-- ---------------------------------------------------------------------------
-- Auth users. We insert directly into auth.users; the on_auth_user_created
-- trigger creates the matching profiles row. We then patch full_name/is_admin.
-- A confirmed email + bcrypt password lets these users log in locally.
-- ---------------------------------------------------------------------------
do $$
declare
  -- User-registration: `org` anchors each TENANT user's profiles.home_organization_id
  -- (threaded into user_metadata → set by handle_new_user, exactly like the real
  -- invite path). The vendor carries `admin=true` (→ app_metadata bootstrap_admin,
  -- the service-role-only channel) and NO org — it is legitimately org-less.
  --   org-a = 0c000000-…-00a  (CCIH + Farmácia)   org-b = 0c000000-…-00b
  v_org_a_lit text := '0c000000-0000-0000-0000-00000000000a';
  v_org_b_lit text := '0c000000-0000-0000-0000-00000000000b';
  v_users jsonb := jsonb_build_array(
    jsonb_build_object('id', '00000000-0000-0000-0000-000000000001', 'email', 'admin@test.local',       'name', 'Administradora Geral',   'org', '0c000000-0000-0000-0000-00000000000a'),
    jsonb_build_object('id', '00000000-0000-0000-0000-000000000002', 'email', 'chefe.ccih@test.local',  'name', 'Chefe CCIH',              'org', '0c000000-0000-0000-0000-00000000000a'),
    jsonb_build_object('id', '00000000-0000-0000-0000-000000000003', 'email', 'staff1.ccih@test.local', 'name', 'Enfermeiro CCIH Um',      'org', '0c000000-0000-0000-0000-00000000000a'),
    jsonb_build_object('id', '00000000-0000-0000-0000-000000000004', 'email', 'staff2.ccih@test.local', 'name', 'Enfermeira CCIH Dois',    'org', '0c000000-0000-0000-0000-00000000000a'),
    jsonb_build_object('id', '00000000-0000-0000-0000-000000000005', 'email', 'chefe.farm@test.local',  'name', 'Chefe Farmácia',          'org', '0c000000-0000-0000-0000-00000000000a'),
    jsonb_build_object('id', '00000000-0000-0000-0000-000000000006', 'email', 'staff1.farm@test.local', 'name', 'Farmacêutico Um',         'org', '0c000000-0000-0000-0000-00000000000a'),
    jsonb_build_object('id', '00000000-0000-0000-0000-000000000007', 'email', 'staff2.farm@test.local', 'name', 'Farmacêutica Dois',       'org', '0c000000-0000-0000-0000-00000000000a'),
    jsonb_build_object('id', '00000000-0000-0000-0000-000000000008', 'email', 'multi@test.local',       'name', 'Coordenadora Multi',      'org', '0c000000-0000-0000-0000-00000000000a'),
    -- Case Access Control (ADR 0033) personas — plain staff of CCIH used to
    -- exercise the §5 acceptance access paths (grant read, grant write, and the
    -- "gets nothing" boundary). staff3 = write-grantee; staff4 = unrelated boundary.
    jsonb_build_object('id', '00000000-0000-0000-0000-000000000009', 'email', 'staff3.ccih@test.local', 'name', 'Técnico CCIH Três',       'org', '0c000000-0000-0000-0000-00000000000a'),
    jsonb_build_object('id', '00000000-0000-0000-0000-00000000000a', 'email', 'staff4.ccih@test.local', 'name', 'Técnica CCIH Quatro',     'org', '0c000000-0000-0000-0000-00000000000a'),
    -- Multi-tenancy (Phase C) personas:
    --   platform@test.local  = vendor platform_admin (is_admin); NO tenant access
    --                          (walled off — holds NO commission/org membership).
    --   orgadmin.a@test.local = org_admin of org-a (CCIH + Farmácia live here).
    --   orgadmin.b@test.local = org_admin of org-b (the cross-org boundary org).
    jsonb_build_object('id', '00000000-0000-0000-0000-0000000000b0', 'email', 'platform@test.local',     'name', 'Plataforma (Vendor)',    'admin', true),
    jsonb_build_object('id', '00000000-0000-0000-0000-0000000000b1', 'email', 'orgadmin.a@test.local',   'name', 'Admin Rede A',           'org', '0c000000-0000-0000-0000-00000000000a'),
    jsonb_build_object('id', '00000000-0000-0000-0000-0000000000b2', 'email', 'orgadmin.b@test.local',   'name', 'Admin Rede B',           'org', '0c000000-0000-0000-0000-00000000000b'),
    -- A plain staff persona in org-b's commission, for cross-org isolation tests.
    jsonb_build_object('id', '00000000-0000-0000-0000-0000000000b3', 'email', 'staff1.qual.b@test.local', 'name', 'Analista Qualidade B',  'org', '0c000000-0000-0000-0000-00000000000b'),
    -- NSP-per-HOSPITAL (ADR 0052) personas. The roster + coordinator are PER-HOSPITAL.
    -- nspcoord.a / pqs.a map to org-a's FIRST hospital (central-a) so the pre-existing
    -- single-hospital suites (14a-d, 173) keep valid persona references. nspcoord.a2 /
    -- pqs.a2 are NEW, for org-a's SECOND hospital (secundario-a) — proving per-hospital
    -- isolation WITHIN one org. The coordinators are the local NSP heads (full
    -- operators, decision 12); nspcoord.a is left UNENROLLED in its own roster to prove
    -- a coordinator reads via the coordinator arm even without membership.
    jsonb_build_object('id', '00000000-0000-0000-0000-0000000000c1', 'email', 'nspcoord.a@test.local', 'name', 'Coordenador NSP A1',      'org', '0c000000-0000-0000-0000-00000000000a'),
    jsonb_build_object('id', '00000000-0000-0000-0000-0000000000c2', 'email', 'pqs.a@test.local',      'name', 'NSP Central A',           'org', '0c000000-0000-0000-0000-00000000000a'),
    jsonb_build_object('id', '00000000-0000-0000-0000-0000000000c3', 'email', 'nspcoord.b@test.local', 'name', 'Coordenador NSP B',       'org', '0c000000-0000-0000-0000-00000000000b'),
    jsonb_build_object('id', '00000000-0000-0000-0000-0000000000c4', 'email', 'pqs.b@test.local',      'name', 'NSP Rede B',              'org', '0c000000-0000-0000-0000-00000000000b'),
    -- org-a SECOND hospital (secundario-a) NSP personas (ADR 0052 §C):
    jsonb_build_object('id', '00000000-0000-0000-0000-0000000000c5', 'email', 'nspcoord.a2@test.local', 'name', 'Coordenador NSP A2',     'org', '0c000000-0000-0000-0000-00000000000a'),
    jsonb_build_object('id', '00000000-0000-0000-0000-0000000000c6', 'email', 'pqs.a2@test.local',      'name', 'NSP Secundário A',       'org', '0c000000-0000-0000-0000-00000000000a'),
    -- DUAL-HOSPITAL NSP operator who is ALSO a commission member (ADR 0052; closes two
    -- E2E persona gaps): enrolled in BOTH central-a AND secundário-a rosters → the
    -- multi-hospital NSP switcher (grants.length > 1 / resolveNspHospital >1 path); AND
    -- a member of CCIH (central-a) → the "PQS operator reveals PHI via a source-endpoint
    -- commission UI" arm. Does NOT touch any exact count assertion (roster/member counts
    -- are per-persona or hospital-row counts; 189's pqs.a-not-in-secundário keystone is
    -- a DIFFERENT persona).
    jsonb_build_object('id', '00000000-0000-0000-0000-0000000000c7', 'email', 'pqsdual.a@test.local',   'name', 'NSP Dual A',             'org', '0c000000-0000-0000-0000-00000000000a'),
    -- User-registration lifecycle personas (org-a), for the directory + status
    -- badges + enforcement E2E. Their derived status is set by the status-patch
    -- block below (pending = clear email_confirmed_at; suspended = future
    -- suspended_until; deactivated = is_active false). `active` needs no patch.
    jsonb_build_object('id', '00000000-0000-0000-0000-0000000000d1', 'email', 'novato.pendente@test.local', 'name', 'Novato Pendente',   'org', '0c000000-0000-0000-0000-00000000000a'),
    jsonb_build_object('id', '00000000-0000-0000-0000-0000000000d2', 'email', 'ativo.registro@test.local',  'name', 'Ativo Registrado',  'org', '0c000000-0000-0000-0000-00000000000a'),
    jsonb_build_object('id', '00000000-0000-0000-0000-0000000000d3', 'email', 'suspenso.temp@test.local',   'name', 'Suspenso Temporário','org', '0c000000-0000-0000-0000-00000000000a'),
    jsonb_build_object('id', '00000000-0000-0000-0000-0000000000d4', 'email', 'desativado.conta@test.local','name', 'Desativado Conta',  'org', '0c000000-0000-0000-0000-00000000000a'),
    -- Hospital-admin tier (ADR 0051) personas (org-a):
    --   hospitaladmin.a1 = hospital_admin of central-a ONLY — the cross-hospital
    --     ISOLATION subject (184): sees CCIH + Farmácia but ZERO of secundario-a's
    --     Comissão de Ética and ZERO of org-b. home_hospital_id → central-a (Q2).
    --   hospitaladmin.dual = hospital_admin of BOTH central-a and secundario-a —
    --     the Note-2 COEXISTENCE proof: two organization_members rows for one
    --     (org,user), which the OLD (org,user) unique rejected and the new
    --     composite NULLS-NOT-DISTINCT key admits. (Split from a1 so the isolation
    --     subject stays single-hospital — the plan's 184 needs a single-hospital
    --     admin AND a positive coexistence row; one persona can't be both.)
    --   nsporg.a = nsp_org_admin of org-a (row admitted to the CHECK now; INERT
    --     until Phase B).
    jsonb_build_object('id', '00000000-0000-0000-0000-0000000000e1', 'email', 'hospitaladmin.a1@test.local',   'name', 'Admin Hospital A1',   'org', '0c000000-0000-0000-0000-00000000000a'),
    jsonb_build_object('id', '00000000-0000-0000-0000-0000000000e3', 'email', 'hospitaladmin.dual@test.local', 'name', 'Admin Hospital Dual', 'org', '0c000000-0000-0000-0000-00000000000a'),
    jsonb_build_object('id', '00000000-0000-0000-0000-0000000000e2', 'email', 'nsporg.a@test.local',           'name', 'Admin NSP Rede A',    'org', '0c000000-0000-0000-0000-00000000000a')
  );
  u jsonb;
begin
  for u in select * from jsonb_array_elements(v_users)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      (u ->> 'id')::uuid,
      'authenticated', 'authenticated',
      u ->> 'email',
      crypt('Test1234!', gen_salt('bf')),
      now(), now(), now(),
      -- app_metadata carries the vendor admin bootstrap (service-role-only channel).
      case when coalesce((u ->> 'admin')::boolean, false)
        then '{"provider":"email","providers":["email"],"bootstrap_admin":true}'::jsonb
        else '{"provider":"email","providers":["email"]}'::jsonb
      end,
      -- user_metadata carries full_name + (for tenant users) the home org anchor.
      jsonb_strip_nulls(jsonb_build_object(
        'full_name', u ->> 'name',
        'home_organization_id', u ->> 'org'
      )),
      now(), now(), '', '', '', ''
    );

    -- An identities row is required for email/password sign-in to resolve.
    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      (u ->> 'id'),
      (u ->> 'id')::uuid,
      jsonb_build_object('sub', u ->> 'id', 'email', u ->> 'email'),
      'email',
      now(), now(), now()
    );

    -- Patch the trigger-created profile.
    update public.profiles
    set full_name = u ->> 'name'
    where id = (u ->> 'id')::uuid;
  end loop;

  -- Multi-tenancy (Phase C): the VENDOR platform_admin is platform@test.local —
  -- the ONLY is_admin, and walled off from tenant data (no commission/org rows).
  -- admin@test.local stays a plain profile (it is `created_by` on legacy fixtures)
  -- and is re-homed as the org_admin of org-a below.
  update public.profiles set is_admin = true
  where id = '00000000-0000-0000-0000-0000000000b0';
end $$;

-- ---------------------------------------------------------------------------
-- Multi-tenancy hierarchy (Phase C): organizations + hospitals were inserted
-- ABOVE the users loop (see the user-registration note). Now that the vendor
-- exists, patch organizations.created_by to it; then commissions + memberships.
-- org-a holds BOTH CCIH and Farmácia; org-b is the cross-org boundary.
-- commissions.organization_id is auto-derived from hospital_id by the trigger.
-- ---------------------------------------------------------------------------
update public.organizations set created_by = '00000000-0000-0000-0000-0000000000b0'
where id in ('0c000000-0000-0000-0000-00000000000a', '0c000000-0000-0000-0000-00000000000b');

-- MEM (S1): the three role tables collapsed into public.memberships. Org/hospital-tier
-- grants seed as memberships rows (principal_id + scope columns per the shape CHECK).
-- Org-tier: organization_id set. Hospital-tier: organization_id + hospital_id set.
insert into public.memberships (organization_id, hospital_id, principal_id, role) values
  -- admin@test.local re-homed as org_admin of org-a; orgadmin.a as well (so both
  -- a legacy id and the named persona administer org-a). orgadmin.b runs org-b.
  ('0c000000-0000-0000-0000-00000000000a', null, '00000000-0000-0000-0000-000000000001', 'org_admin'),
  ('0c000000-0000-0000-0000-00000000000a', null, '00000000-0000-0000-0000-0000000000b1', 'org_admin'),
  ('0c000000-0000-0000-0000-00000000000b', null, '00000000-0000-0000-0000-0000000000b2', 'org_admin'),
  -- NSP-per-HOSPITAL (ADR 0052): the nsp_coordinator is the LOCAL hospital NSP head
  -- (full operator, decision 12), so the role row carries hospital_id (+ org, per the
  -- memberships shape CHECK). Appointed by the org's nsp_org_admin. nspcoord.a heads
  -- central-a; nspcoord.a2 heads secundario-a; nspcoord.b heads central-b. nspcoord.a
  -- is left UNENROLLED in central-a's roster below — proving a coordinator reads via the
  -- coordinator arm even without membership.
  ('0c000000-0000-0000-0000-00000000000a', '05000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'nsp_coordinator'),
  ('0c000000-0000-0000-0000-00000000000a', '05000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c5', 'nsp_coordinator'),
  ('0c000000-0000-0000-0000-00000000000b', '05000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000c3', 'nsp_coordinator'),
  -- nsp_org_admin of org-a (org-level, ACTIVE — curates any hospital's roster + appoints
  -- coordinators + reads PHI-free aggregates; enrolled in NO roster below, proving
  -- zero-PHI). hospital_id NULL (org-level).
  ('0c000000-0000-0000-0000-00000000000a', null, '00000000-0000-0000-0000-0000000000e2', 'nsp_org_admin');

-- Hospital-admin rows carry hospital_id + org (the memberships shape CHECK requires both).
--   a1   -> central-a ONLY (isolation subject).
--   dual -> BOTH central-a and secundario-a (Note-2 coexistence: two rows for one
--           (org,user), which the memberships NULLS-NOT-DISTINCT grant-unique admits;
--           184 asserts BOTH resolve).
insert into public.memberships (organization_id, hospital_id, principal_id, role) values
  ('0c000000-0000-0000-0000-00000000000a', '05000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000e1', 'hospital_admin'),
  ('0c000000-0000-0000-0000-00000000000a', '05000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000e3', 'hospital_admin'),
  ('0c000000-0000-0000-0000-00000000000a', '05000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000e3', 'hospital_admin');

-- Q2 hospital-scoped directory: anchor the hospital_admin's home hospital to
-- central-a. The dual + nsporg personas stay hospital-less at home.
update public.profiles set home_hospital_id = '05000000-0000-0000-0000-00000000000a'
where id = '00000000-0000-0000-0000-0000000000e1';

-- ---------------------------------------------------------------------------
-- Commissions + memberships. CCIH + Farmácia under org-a's hospital (ids kept);
-- a new Qualidade commission under org-b's hospital for cross-org isolation.
-- ---------------------------------------------------------------------------
insert into public.commissions (id, name, slug, created_by, hospital_id) values
  ('a0000000-0000-0000-0000-0000000000a1', 'Comissão de Controle de Infecção Hospitalar', 'ccih', '00000000-0000-0000-0000-000000000001', '05000000-0000-0000-0000-00000000000a'),
  ('b0000000-0000-0000-0000-0000000000b1', 'Comissão de Farmácia e Terapêutica',          'farmacia', '00000000-0000-0000-0000-000000000001', '05000000-0000-0000-0000-00000000000a'),
  -- org-b commission. Note 'ccih' is reused as a slug HERE under a DIFFERENT org —
  -- proving per-org slug uniqueness (two orgs may both have a `ccih`/`qualidade`).
  ('c0000000-0000-0000-0000-0000000000c1', 'Comissão de Qualidade e Segurança',           'qualidade', '00000000-0000-0000-0000-0000000000b2', '05000000-0000-0000-0000-00000000000b'),
  -- NSP-per-org (ADR 0042): a SECOND org-b commission so an INTRA-rede-b referral
  -- (Qualidade B → Farmácia B) exists — referrals are forbidden across orgs, so the
  -- rede-b referral fixture needs two rede-b commissions.
  ('c0000000-0000-0000-0000-0000000000c2', 'Comissão de Farmácia B',                      'farmacia-b', '00000000-0000-0000-0000-0000000000b2', '05000000-0000-0000-0000-00000000000b'),
  -- Hospital-admin tier (ADR 0051): a commission under org-a's SECOND hospital
  -- (secundario-a). A hospital_admin of central-a ONLY must see ZERO rows of this
  -- commission (184 cross-hospital isolation keystone). Created by orgadmin.a.
  ('e0000000-0000-0000-0000-0000000000e1', 'Comissão de Ética',                           'etica', '00000000-0000-0000-0000-0000000000b1', '05000000-0000-0000-0000-0000000000a2'),
  -- NSP-per-hospital (ADR 0052): a SECOND commission under secundario-a to HOST the
  -- hospital-2 NSP fixtures (an event + the target of an intra-org CROSS-hospital
  -- referral). A central-a NSP operator must get NOTHING on this hospital's PHI; the
  -- secundario-a operator (pqs.a2 / nspcoord.a2) reads it (189 isolation keystone).
  ('e0000000-0000-0000-0000-0000000000e2', 'Comissão de Segurança do Paciente A2',        'seguranca-a2', '00000000-0000-0000-0000-0000000000b1', '05000000-0000-0000-0000-0000000000a2');

-- Commission-tier grants seed as memberships rows (commission_id set; org/hospital null).
insert into public.memberships (commission_id, principal_id, role) values
  -- org-b commission staff_admin + staff (cross-org isolation personas).
  ('c0000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 'staff_admin'),
  ('c0000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b3', 'staff'),
  ('a0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000002', 'staff_admin'),
  ('a0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000003', 'staff'),
  ('a0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000004', 'staff'),
  -- pqsdual.a: a plain CCIH (central-a) staff member who is ALSO a dual-hospital NSP
  -- operator (enrolled in both central-a + secundário-a rosters below) — closes the
  -- "PQS operator who is a commission member" + multi-hospital-switcher E2E gaps.
  ('a0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c7', 'staff'),
  ('b0000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000005', 'staff_admin'),
  ('b0000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000006', 'staff'),
  ('b0000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000007', 'staff'),
  -- multi@test.local: plain staff of BOTH commissions, so the commission picker
  -- is E2E-testable (a single user with >1 membership). Kept as staff in both to
  -- avoid introducing a second staff_admin into either commission.
  ('a0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000008', 'staff'),
  ('b0000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000008', 'staff'),
  -- Case Access Control personas (plain staff of CCIH; ADR 0033 §5 acceptance).
  ('a0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000009', 'staff'),
  ('a0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'staff'),
  -- NSP-per-org: Farmácia B (org-b) staff_admin so the intra-rede-b referral has a
  -- target coordinator; orgadmin.b coordinates Qualidade B (source) — already a
  -- staff_admin there (above). staff1.qual.b is the Farmácia B coordinator here.
  ('c0000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b3', 'staff_admin'),
  -- User-registration lifecycle personas: the active + suspended ones also hold a
  -- CCIH committee (exercises the directory committeeCount + the enforcement path —
  -- a suspended member must be denied by app.is_member_of). Pending + deactivated
  -- stay committee-less (a common "no committee yet" state).
  ('a0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d2', 'staff'),
  ('a0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d3', 'staff');

-- ---------------------------------------------------------------------------
-- User-registration: professional-category assignment + credentials + the
-- derived-status patch for the lifecycle personas.
-- ---------------------------------------------------------------------------
-- Assign a professional category to a few personas (physician/nurse/pharmacist).
update public.profiles set professional_category_id = 'd1000000-0000-0000-0000-000000000001' -- physician
  where id = '00000000-0000-0000-0000-0000000000d2';
update public.profiles set professional_category_id = 'd1000000-0000-0000-0000-000000000002' -- nurse
  where id in ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000d3');
update public.profiles set professional_category_id = 'd1000000-0000-0000-0000-000000000003' -- pharmacist
  where id = '00000000-0000-0000-0000-000000000005';

-- A professional credential for the active persona (CRM, verified) + one nurse
-- (COREN, unverified) — exercises the credentials read path + verified badge.
insert into public.professional_credentials
  (user_id, issuing_country, issuing_state, issuing_authority, registration_number, verified_at, expires_on) values
  ('00000000-0000-0000-0000-0000000000d2', 'BR', 'SP', 'CRM',   '123456-SP', now(),  null),
  ('00000000-0000-0000-0000-0000000000d3', 'BR', 'SP', 'COREN', '654321-SP', null,   '2027-12-31');

-- Derived-status patch (see UserStatus derivation). These are the ONLY writes to
-- the guarded lifecycle columns outside the action path; the seed runs as the
-- superuser (auth.uid() null) so guard_profile_privileged_columns permits them.
--   d1 = pending      : clear the trigger-set email_confirmed_at.
--   d3 = suspended    : suspended_until in the future (auto-reinstating).
--   d4 = deactivated  : is_active false.
update public.profiles set email_confirmed_at = null
  where id = '00000000-0000-0000-0000-0000000000d1';
update public.profiles set suspended_until = now() + interval '30 days'
  where id = '00000000-0000-0000-0000-0000000000d3';
update public.profiles set is_active = false
  where id = '00000000-0000-0000-0000-0000000000d4';

-- ===========================================================================
-- FORM A (commission CCIH): UNSECTIONED — default section only.
-- All four input types (>=2 with question_explanation) + one section_text +
-- one image display block. Built as a draft, then published via the RPC.
-- ===========================================================================
do $$
declare
  v_form_id uuid := 'f0000000-0000-0000-0000-00000000a001';
  v_version_id uuid := '50000000-0000-0000-0000-00000000a001';
  v_section_id uuid := 'c0000000-0000-0000-0000-00000000a001';
begin
  insert into public.forms (id, commission_id, title, description, created_by)
  values (v_form_id, 'a0000000-0000-0000-0000-0000000000a1',
          'Checklist de Higienização das Mãos',
          'Verificação rápida de adesão às práticas de higienização das mãos na unidade.',
          '00000000-0000-0000-0000-000000000002');

  insert into public.form_versions (id, form_id, version_number, status, created_by)
  values (v_version_id, v_form_id, 1, 'draft', '00000000-0000-0000-0000-000000000002');

  insert into public.form_sections (id, form_version_id, position, title, is_default)
  values (v_section_id, v_version_id, 0, null, true);

  -- position 0: display section_text (intro)
  insert into public.form_items (section_id, position, item_type, content)
  values (v_section_id, 0, 'section_text',
          jsonb_build_object('markdown',
            '## Higienização das mãos\nResponda com base na observação da unidade no momento da auditoria.'));

  -- position 1: multiple_choice (with explanation). form-model-normalization:
  -- options are normalized rows with stable codes (slug of the label).
  insert into public.form_items (id, section_id, position, item_type, question_key, label, question_explanation, required)
  values ('d0000000-0000-0000-0000-00000000a101', v_section_id, 1, 'multiple_choice', 'dispensador_disponivel',
          'Há dispensador de álcool em gel disponível e abastecido no ponto de atendimento?',
          'Considere abastecido quando há volume suficiente para uso imediato.', true);
  insert into public.form_item_options (item_id, position, code, label) values
    ('d0000000-0000-0000-0000-00000000a101', 0, 'sim', 'Sim'),
    ('d0000000-0000-0000-0000-00000000a101', 1, 'nao', 'Não'),
    ('d0000000-0000-0000-0000-00000000a101', 2, 'parcialmente', 'Parcialmente');

  -- position 2: dropdown
  insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
  values ('d0000000-0000-0000-0000-00000000a102', v_section_id, 2, 'dropdown', 'turno_auditoria',
          'Turno em que a auditoria foi realizada', true);
  insert into public.form_item_options (item_id, position, code, label) values
    ('d0000000-0000-0000-0000-00000000a102', 0, 'manha', 'Manhã'),
    ('d0000000-0000-0000-0000-00000000a102', 1, 'tarde', 'Tarde'),
    ('d0000000-0000-0000-0000-00000000a102', 2, 'noite', 'Noite');

  -- position 3: checkbox (with explanation)
  insert into public.form_items (id, section_id, position, item_type, question_key, label, question_explanation, required)
  values ('d0000000-0000-0000-0000-00000000a103', v_section_id, 3, 'checkbox', 'epis_observados',
          'Quais EPIs estavam disponíveis no momento da observação?',
          'Marque todos os itens observados na unidade.', false);
  insert into public.form_item_options (item_id, position, code, label) values
    ('d0000000-0000-0000-0000-00000000a103', 0, 'luvas', 'Luvas'),
    ('d0000000-0000-0000-0000-00000000a103', 1, 'avental', 'Avental'),
    ('d0000000-0000-0000-0000-00000000a103', 2, 'mascara', 'Máscara'),
    ('d0000000-0000-0000-0000-00000000a103', 3, 'touca', 'Touca');

  -- position 4: image display block
  insert into public.form_items (section_id, position, item_type, content)
  values (v_section_id, 4, 'image',
          jsonb_build_object(
            'storage_path', 'a0000000-0000-0000-0000-0000000000a1/exemplo-cartaz-higienizacao.png',
            'alt', 'Cartaz dos cinco momentos da higienização das mãos',
            'caption', 'Referência: cinco momentos para a higienização das mãos.'));

  -- position 5: free_text
  insert into public.form_items (section_id, position, item_type, question_key, label, required)
  values (v_section_id, 5, 'free_text', 'observacoes_gerais',
          'Observações gerais da auditoria', false);

  perform public.publish_form_version(v_version_id);
end $$;

-- ===========================================================================
-- FORM B (commission Farmácia): SECTIONED — 4 sections, one conditional,
-- one requires_signoff(respondent), one requires_signoff(staff_admin).
-- ===========================================================================
do $$
declare
  v_form_id uuid := 'f0000000-0000-0000-0000-00000000b001';
  v_version_id uuid := '50000000-0000-0000-0000-00000000b001';
  s_default uuid := 'c0000000-0000-0000-0000-00000000b000'; -- default (kept, position 0)
  s_armazenamento uuid := 'c0000000-0000-0000-0000-00000000b001';
  s_geladeira uuid := 'c0000000-0000-0000-0000-00000000b002'; -- conditional
  s_conformidade uuid := 'c0000000-0000-0000-0000-00000000b003'; -- respondent sign-off
  s_revisao uuid := 'c0000000-0000-0000-0000-00000000b004'; -- staff_admin sign-off
begin
  insert into public.forms (id, commission_id, title, description, created_by)
  values (v_form_id, 'b0000000-0000-0000-0000-0000000000b1',
          'Inspeção de Armazenamento de Medicamentos',
          'Roteiro de inspeção das condições de armazenamento na farmácia.',
          '00000000-0000-0000-0000-000000000005');

  insert into public.form_versions (id, form_id, version_number, status, created_by)
  values (v_version_id, v_form_id, 1, 'draft', '00000000-0000-0000-0000-000000000005');

  -- Default section (position 0) acts as an intro page here.
  insert into public.form_sections (id, form_version_id, position, title, is_default)
  values (s_default, v_version_id, 0, null, true);
  insert into public.form_items (section_id, position, item_type, content)
  values (s_default, 0, 'section_text',
          jsonb_build_object('markdown',
            '## Inspeção de armazenamento\nPreencha cada seção conforme a área inspecionada.'));

  -- Section 1: Armazenamento geral
  insert into public.form_sections (id, form_version_id, position, title, description)
  values (s_armazenamento, v_version_id, 1, 'Armazenamento geral',
          'Condições gerais do estoque.');
  insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
  values ('d0000000-0000-0000-0000-00000000b101', s_armazenamento, 0, 'multiple_choice', 'organizacao_estoque',
          'O estoque está organizado e identificado conforme o procedimento?', true);
  insert into public.form_item_options (item_id, position, code, label) values
    ('d0000000-0000-0000-0000-00000000b101', 0, 'sim', 'Sim'),
    ('d0000000-0000-0000-0000-00000000b101', 1, 'nao', 'Não');
  insert into public.form_items (id, section_id, position, item_type, question_key, label, question_explanation, required)
  values ('d0000000-0000-0000-0000-00000000b102', s_armazenamento, 1, 'multiple_choice', 'possui_termolabeis',
          'A unidade armazena medicamentos termolábeis (refrigerados)?',
          'Se sim, a seção de controle de temperatura será exibida.', true);
  insert into public.form_item_options (item_id, position, code, label) values
    ('d0000000-0000-0000-0000-00000000b102', 0, 'sim', 'Sim'),
    ('d0000000-0000-0000-0000-00000000b102', 1, 'nao', 'Não');

  -- Section 2 (CONDITIONAL): only when possui_termolabeis = 'sim' (the option CODE).
  insert into public.form_sections (id, form_version_id, position, title, description, visible_when)
  values (s_geladeira, v_version_id, 2, 'Controle de temperatura',
          'Aplicável apenas quando há medicamentos refrigerados.',
          jsonb_build_object('question_key', 'possui_termolabeis', 'op', 'equals', 'value', 'sim'));
  insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
  values ('d0000000-0000-0000-0000-00000000b103', s_geladeira, 0, 'multiple_choice', 'temperatura_na_faixa',
          'A temperatura da câmara/refrigerador está dentro da faixa de 2 °C a 8 °C?', true);
  insert into public.form_item_options (item_id, position, code, label) values
    ('d0000000-0000-0000-0000-00000000b103', 0, 'sim', 'Sim'),
    ('d0000000-0000-0000-0000-00000000b103', 1, 'nao', 'Não');
  insert into public.form_items (section_id, position, item_type, question_key, label, required)
  values (s_geladeira, 1, 'free_text', 'temperatura_registrada',
          'Temperatura registrada no momento da inspeção (°C)', false);

  -- Section 3 (respondent sign-off)
  insert into public.form_sections (id, form_version_id, position, title, description, requires_signoff, signoff_role)
  values (s_conformidade, v_version_id, 3, 'Conformidade e validades',
          'Verificação de prazos de validade.', true, 'respondent');
  insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
  values ('d0000000-0000-0000-0000-00000000b104', s_conformidade, 0, 'multiple_choice', 'sem_vencidos',
          'Não foram encontrados medicamentos vencidos no estoque?', true);
  insert into public.form_item_options (item_id, position, code, label) values
    ('d0000000-0000-0000-0000-00000000b104', 0, 'sim', 'Sim'),
    ('d0000000-0000-0000-0000-00000000b104', 1, 'nao', 'Não');

  -- Section 4 (staff_admin sign-off)
  insert into public.form_sections (id, form_version_id, position, title, description, requires_signoff, signoff_role)
  values (s_revisao, v_version_id, 4, 'Revisão da chefia',
          'Conferência final pela chefia da comissão.', true, 'staff_admin');
  insert into public.form_items (section_id, position, item_type, question_key, label, required)
  values (s_revisao, 0, 'free_text', 'parecer_chefia',
          'Parecer da chefia sobre a inspeção', false);

  perform public.publish_form_version(v_version_id);
end $$;

-- ===========================================================================
-- Responses. ~10 submitted across both forms + 1 in_progress. Inserted as
-- in_progress with answers, then flipped to submitted under the immutability
-- guard (seed runs as a superuser; the submit RPC's ownership check relies on
-- auth.uid(), so we drive the lifecycle directly and deterministically here).
-- ===========================================================================
do $$
declare
  -- Form A answerable items (by question_key)
  ia_disp uuid; ia_turno uuid; ia_epis uuid; ia_obs uuid;
  -- Form B answerable items
  ib_org uuid; ib_termo uuid; ib_temp uuid; ib_tempreg uuid; ib_venc uuid; ib_parecer uuid;
  v_resp uuid;
  v_form_a uuid := '50000000-0000-0000-0000-00000000a001';
  v_form_b uuid := '50000000-0000-0000-0000-00000000b001';
  v_comm_a uuid := 'a0000000-0000-0000-0000-0000000000a1';
  v_comm_b uuid := 'b0000000-0000-0000-0000-0000000000b1';
  v_staff_a1 uuid := '00000000-0000-0000-0000-000000000003';
  v_staff_a2 uuid := '00000000-0000-0000-0000-000000000004';
  v_staff_b1 uuid := '00000000-0000-0000-0000-000000000006';
  v_staff_b2 uuid := '00000000-0000-0000-0000-000000000007';
  i integer;
begin
  select id into ia_disp  from public.form_items where form_version_id = v_form_a and question_key = 'dispensador_disponivel';
  select id into ia_turno from public.form_items where form_version_id = v_form_a and question_key = 'turno_auditoria';
  select id into ia_epis  from public.form_items where form_version_id = v_form_a and question_key = 'epis_observados';
  select id into ia_obs   from public.form_items where form_version_id = v_form_a and question_key = 'observacoes_gerais';

  select id into ib_org     from public.form_items where form_version_id = v_form_b and question_key = 'organizacao_estoque';
  select id into ib_termo   from public.form_items where form_version_id = v_form_b and question_key = 'possui_termolabeis';
  select id into ib_temp    from public.form_items where form_version_id = v_form_b and question_key = 'temperatura_na_faixa';
  select id into ib_tempreg from public.form_items where form_version_id = v_form_b and question_key = 'temperatura_registrada';
  select id into ib_venc    from public.form_items where form_version_id = v_form_b and question_key = 'sem_vencidos';
  select id into ib_parecer from public.form_items where form_version_id = v_form_b and question_key = 'parecer_chefia';

  perform set_config('app.in_submit_rpc', 'on', true);

  -- ----- Form A: 6 submitted responses (alternating staff, varied answers)
  for i in 1..6 loop
    v_resp := gen_random_uuid();
    insert into public.responses (id, form_version_id, commission_id, created_by, status, submitted_at, started_at)
    values (v_resp, v_form_a, v_comm_a,
            case when i % 2 = 0 then v_staff_a2 else v_staff_a1 end,
            'submitted', now() - (i || ' days')::interval, now() - (i || ' days')::interval);

    -- Scalar answer (free_text) stays in answers.value.
    insert into public.answers (response_id, item_id, question_key, value) values
      (v_resp, ia_obs, 'observacoes_gerais', to_jsonb('Auditoria de rotina nº ' || i || '.'));
    -- Choice selections -> answers row + answer_selected_options (by option code).
    -- mc: cycle sim/nao/parcialmente; dropdown: manha/tarde/noite.
    perform app.seed_select(v_resp, ia_disp, array[(array['sim','nao','parcialmente'])[1 + (i % 3)]]);
    perform app.seed_select(v_resp, ia_turno, array[(array['manha','tarde','noite'])[1 + (i % 3)]]);
    -- checkbox: even -> {luvas,avental}; odd -> {luvas,mascara,touca}.
    perform app.seed_select(v_resp, ia_epis,
      case when i % 2 = 0 then array['luvas','avental']
           else array['luvas','mascara','touca'] end);
  end loop;

  -- ----- Form B: 4 submitted responses — 2 take the conditional branch
  -- (possui_termolabeis = 'Sim', answering the temperature section) and 2 do
  -- not (= 'Não', so that section is hidden and collects no answers).
  for i in 1..4 loop
    v_resp := gen_random_uuid();
    insert into public.responses (id, form_version_id, commission_id, created_by, status, submitted_at, started_at)
    values (v_resp, v_form_b, v_comm_b,
            case when i % 2 = 0 then v_staff_b2 else v_staff_b1 end,
            'submitted', now() - (i || ' days')::interval, now() - (i || ' days')::interval);

    -- Scalar answer (free_text) stays.
    insert into public.answers (response_id, item_id, question_key, value) values
      (v_resp, ib_parecer, 'parecer_chefia', to_jsonb('Inspeção dentro do esperado.'::text));
    -- Choice selections by code: org='sim', venc='sim', termo='sim' (i<=2) else 'nao'.
    perform app.seed_select(v_resp, ib_org, array['sim']);
    perform app.seed_select(v_resp, ib_venc, array['sim']);
    perform app.seed_select(v_resp, ib_termo, array[(case when i <= 2 then 'sim' else 'nao' end)]);

    -- Conditional-section answers only for the 'sim' branch.
    if i <= 2 then
      perform app.seed_select(v_resp, ib_temp, array['sim']);
      insert into public.answers (response_id, item_id, question_key, value) values
        (v_resp, ib_tempreg, 'temperatura_registrada', to_jsonb(('' || (4 + i) || ' °C'))::jsonb);
    end if;

    -- Both sign-off sections are visible here. Sign-off enforcement is OFF in
    -- Phase 1, but we seed sign-off rows so read-only views have data.
    insert into public.response_section_signoffs (response_id, section_id, signed_by)
    select v_resp, s.id,
           case when s.signoff_role = 'staff_admin' then '00000000-0000-0000-0000-000000000005'::uuid
                else (case when i % 2 = 0 then v_staff_b2 else v_staff_b1 end) end
    from public.form_sections s
    where s.form_version_id = v_form_b and s.requires_signoff;
  end loop;

  perform set_config('app.in_submit_rpc', 'off', true);

  -- ----- 1 in_progress response (Form A, staff1) with partial answers. The
  -- Phase-5 wizard resume fixture — kept intact.
  v_resp := gen_random_uuid();
  insert into public.responses (id, form_version_id, commission_id, created_by, status, last_section_id, started_at)
  values (v_resp, v_form_a, v_comm_a, v_staff_a1, 'in_progress',
          'c0000000-0000-0000-0000-00000000a001', now());
  perform app.seed_select(v_resp, ia_disp, array['sim']);

  -- ----- Phase 6: 1 in_progress response on Form B (Farmácia) by staff1.farm,
  -- SUBMIT-READY and AWAITING the staff_admin sign-off, so the E2E exercises BOTH
  -- sign-off flows end-to-end:
  --   * the respondent section ("Conformidade e validades", respondent role) is
  --     already SIGNED by the respondent (staff1.farm);
  --   * the staff_admin section ("Revisão da chefia", staff_admin role) is
  --     UNSIGNED, so this response surfaces in chefe.farm's "pendentes de
  --     assinatura" queue and can be counter-signed then submitted.
  -- Deterministic id so specs can target it directly. Takes the 'Não' branch
  -- (possui_termolabeis='Não'), so the conditional temperature section is hidden
  -- and requires nothing — the response is fully submit-ready bar the staff_admin
  -- sign-off. last_section_id points at the staff_admin section (resume there).
  v_resp := 'e0000000-0000-0000-0000-0000000000e1';
  insert into public.responses (id, form_version_id, commission_id, created_by, status, last_section_id, started_at, updated_at)
  values (v_resp, v_form_b, v_comm_b, v_staff_b1, 'in_progress',
          (select id from public.form_sections
             where form_version_id = v_form_b and signoff_role = 'staff_admin'),
          now(), now());

  perform app.seed_select(v_resp, ib_org, array['sim']);
  perform app.seed_select(v_resp, ib_termo, array['nao']);
  perform app.seed_select(v_resp, ib_venc, array['sim']);

  -- Respondent sign-off already recorded (signed_by the respondent themselves).
  insert into public.response_section_signoffs (response_id, section_id, signed_by)
  select v_resp, s.id, v_staff_b1
  from public.form_sections s
  where s.form_version_id = v_form_b
    and s.requires_signoff
    and s.signoff_role = 'respondent';
end $$;

-- ===========================================================================
-- Phase 7: Multi-phase cases fixture (commission A / CCIH)
-- ===========================================================================
-- A published process template "Investigação de Óbito (M&M)" with two phase-
-- slots, both bound to Form A (the published CCIH checklist). Phase 2 carries a
-- recommend_when over Phase 1's `dispensador_disponivel = 'Sim'`. One mid-flight
-- case (deterministic id, "Caso 0001 — Óbito UTI leito 7", a NON-identifying
-- pseudonym): Phase 1 is CONCLUIDA (a submitted response by staff1.ccih answering
-- 'Sim'), Phase 2 is PENDENTE and flagged RECOMMENDED (the condition is met).
--
-- The seed runs as superuser (RLS bypassed) and inserts directly, like the
-- responses above — it does NOT call the flag-gated RPCs (the cases_multi_phase
-- flag ships OFF until phase completion). The case-number minting trigger still
-- fires on the cases insert; the case/phase state-machine guards are satisfied by
-- setting app.in_case_rpc for the seeded terminal transitions.
do $$
declare
  v_comm_a   uuid := 'a0000000-0000-0000-0000-0000000000a1';
  v_form_a   uuid := 'f0000000-0000-0000-0000-00000000a001';  -- forms.id (parent)
  v_ver_a    uuid := '50000000-0000-0000-0000-00000000a001';  -- published version
  v_admin    uuid := '00000000-0000-0000-0000-000000000001';
  v_chefe_a  uuid := '00000000-0000-0000-0000-000000000002';
  v_staff_a1 uuid := '00000000-0000-0000-0000-000000000003';
  v_tpl      uuid := gen_random_uuid();
  v_case     uuid := 'd0000000-0000-0000-0000-0000000000c1';   -- deterministic
  v_cp1      uuid := gen_random_uuid();
  v_cp2      uuid := gen_random_uuid();
  v_resp     uuid := gen_random_uuid();
  ia_disp    uuid;
  ia_turno   uuid;
begin
  select id into ia_disp  from public.form_items where form_version_id = v_ver_a and question_key = 'dispensador_disponivel';
  select id into ia_turno from public.form_items where form_version_id = v_ver_a and question_key = 'turno_auditoria';

  -- Published template + two phase-slots.
  insert into public.process_templates (id, commission_id, title, description, status, created_by, collects_patient)
  values (v_tpl, v_comm_a, 'Investigação de Óbito (M&M)',
          'Processo de avaliação multifásica de óbito.',
          'active', v_chefe_a, true);

  insert into public.process_template_phases
    (template_id, position, form_id, title, recommend_when, default_due_days) values
    (v_tpl, 1, v_form_a, 'Fase 1 — Coleta inicial', null, 7),
    (v_tpl, 2, v_form_a, 'Fase 2 — Revisão do comitê',
     jsonb_build_object('from_phase', 1, 'question_key', 'dispensador_disponivel',
                        'op', 'equals', 'value', 'sim'),
     14);

  -- The case (number minted by the trigger). Pin Form A's published version.
  -- status is LEFT to the column default 'not_started' (the FIXED five-value
  -- model; the configurable-status vocabulary R2 introduced was removed). The
  -- recompute trigger on case_phases then auto-advances the macro status as the
  -- phases below are inserted: once Phase 1 lands 'completed' (and none 'active'),
  -- the case computes to 'pending' (>=1 concluida, none ativa) — matching the
  -- mid-flight fixture the dashboard/board E2E expects.
  insert into public.cases (id, commission_id, template_id, label, created_by, patient_enabled)
  values (v_case, v_comm_a, v_tpl, 'Óbito UTI leito 7', v_chefe_a, true);

  -- Seeded patient identifiers for Case 0001 (gates the CasePatientPanel in the dev UI).
  -- Re-keyed to the participant layer (ADR 0064 E0 / F1): a patient participant +
  -- patient_participants + case_participants link + patient_identifiers. Direct owner
  -- inserts (bypass the writer's flag gate, as before). The registry display_name is a
  -- SURROGATE (never the raw name — Q4). Raw identifiers live in patient_identifiers.
  declare
    v_org_of_a  uuid := app.org_of_commission(v_comm_a);
    v_role_pat  uuid := 'e0000000-0000-0000-0000-0000000000a1';
    v_part_pat  uuid := 'e0000000-0000-0000-0000-0000000000c1';
  begin
    insert into public.case_participant_roles
      (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
    values (v_role_pat, v_org_of_a, 'affected_patient', 'Paciente afetado', array['patient'], true)
    on conflict (organization_id, key) where case_type_id is null do nothing;

    insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
    values (v_part_pat, v_org_of_a, 'patient', 'patient_phi', 'Paciente');
    insert into public.patient_participants (participant_id) values (v_part_pat);
    insert into public.case_participants (case_id, participant_id, role_id, is_primary_subject, added_by)
    values (v_case, v_part_pat, v_role_pat, true, v_chefe_a);
    insert into public.patient_identifiers
      (participant_id, name, mrn, date_of_birth, age_years, sex, unit, attending)
    values (v_part_pat, 'Paciente de Demonstração', 'CCIH-2024-001', '1955-03-15', 70,
            'female', 'UTI Adulto', 'Dr. João Mendes');
  end;
  update public.cases set has_patient = true where id = v_case;

  -- Phase 1: concluida + assigned to staff1; Phase 2: pendente + recommended.
  -- The guards permit these seeded statuses under app.in_case_rpc.
  perform set_config('app.in_case_rpc', 'on', true);
  -- default_due_days are the SNAPSHOT copies of the template slot defaults
  -- (ADR 0017). Phase 2 carries a past due_date so the board renders an OVERDUE
  -- example for the frontend/tester (a due_date in the past on an open phase).
  insert into public.case_phases
    (id, case_id, position, form_id, form_version_id, title, status, recommended,
     assigned_to, activated_at, completed_at, default_due_days)
  values
    (v_cp1, v_case, 1, v_form_a, v_ver_a, 'Fase 1 — Coleta inicial',
     'completed', false, v_staff_a1, now(), now(), 7);
  insert into public.case_phases
    (id, case_id, position, form_id, form_version_id, title, status, recommended,
     recommend_when, default_due_days, due_date)
  values
    (v_cp2, v_case, 2, v_form_a, v_ver_a, 'Fase 2 — Revisão do comitê',
     'pending', true,
     jsonb_build_object('from_phase', 1, 'question_key', 'dispensador_disponivel',
                        'op', 'equals', 'value', 'sim'),
     14, current_date - 3);
  perform set_config('app.in_case_rpc', 'off', true);

  -- Phase 1's SUBMITTED response (staff1.ccih), answering the gate 'Sim' so the
  -- recommend_when for Phase 2 is satisfied (matches the seeded recommended=true).
  -- Both required items answered so it is a valid submission. The submitted-
  -- immutability trigger blocks answer inserts on a submitted parent unless
  -- app.in_submit_rpc is on (the same path submit_response uses), so we set it
  -- for the duration — exactly as the Phase-6 submitted responses above do.
  perform set_config('app.in_submit_rpc', 'on', true);
  insert into public.responses
    (id, form_version_id, commission_id, created_by, status, case_phase_id, started_at, updated_at, submitted_at)
  values
    (v_resp, v_ver_a, v_comm_a, v_staff_a1, 'submitted', v_cp1, now(), now(), now());
  -- Choice answers -> parent answers row + selections (by code). in_submit_rpc is
  -- on, so the submitted-children guard permits these inserts (same path as
  -- submit_response); app.seed_select upserts the parent answer + selections.
  perform app.seed_select(v_resp, ia_disp, array['sim']);
  perform app.seed_select(v_resp, ia_turno, array['manha']);
  perform set_config('app.in_submit_rpc', 'off', true);
end $$;

-- ===========================================================================
-- Case OUTCOMES fixture (commission A / CCIH) — for the % adverse dashboard +
-- the outcome E2E. A per-commission outcome vocabulary; the M&M process OFFERS
-- them; Caso 0001 snapshots the offered set; a NEW concluded "Caso 0002" carries
-- an adverse outcome so the dashboard breakdown has real data. No patient data.
-- ===========================================================================
do $$
declare
  v_comm_a   uuid := 'a0000000-0000-0000-0000-0000000000a1';
  v_form_a   uuid := 'f0000000-0000-0000-0000-00000000a001';
  v_ver_a    uuid := '50000000-0000-0000-0000-00000000a001';
  v_chefe_a  uuid := '00000000-0000-0000-0000-000000000002';
  v_staff_a1 uuid := '00000000-0000-0000-0000-000000000003';
  v_case1    uuid := 'd0000000-0000-0000-0000-0000000000c1';  -- existing Caso 0001
  v_case2    uuid := 'd0000000-0000-0000-0000-0000000000c2';  -- new concluded Caso 0002
  v_tpl      uuid;
  v_oc_evit  uuid := 'e1000000-0000-0000-0000-0000000000d1';  -- Óbito evitável (adverse + plan)
  v_oc_nevit uuid := 'e1000000-0000-0000-0000-0000000000d2';  -- Óbito não evitável (adverse)
  v_oc_alta  uuid := 'e1000000-0000-0000-0000-0000000000d3';  -- Alta sem intercorrências (neither)
  v_cp1      uuid := gen_random_uuid();
begin
  -- Resolve the M&M template seeded in the Phase-7 block above (by title).
  select id into v_tpl
  from public.process_templates
  where commission_id = v_comm_a and title = 'Investigação de Óbito (M&M)'
  limit 1;

  -- Outcome vocabulary (positions 1..3). At least one adverse + one action-plan.
  insert into public.case_outcomes
    (id, commission_id, label, color_token, requires_action_plan, is_adverse, position)
  values
    (v_oc_evit,  v_comm_a, 'Óbito evitável',           'red',   true,  true,  1),
    (v_oc_nevit, v_comm_a, 'Óbito não evitável',       'amber', false, true,  2),
    (v_oc_alta,  v_comm_a, 'Alta sem intercorrências', 'green', false, false, 3);

  -- The process OFFERS all three (the builder selection).
  insert into public.process_template_outcomes (template_id, outcome_id, position)
  values (v_tpl, v_oc_evit, 1), (v_tpl, v_oc_nevit, 2), (v_tpl, v_oc_alta, 3);

  -- Caso 0001 (mid-flight, pendente) snapshots the offered set (no outcome chosen
  -- yet — it is still open; the selector offers these three).
  insert into public.case_offered_outcomes (case_id, outcome_id) values
    (v_case1, v_oc_evit), (v_case1, v_oc_nevit), (v_case1, v_oc_alta);

  -- ---- Caso 0002: a CONCLUDED case with an ADVERSE outcome (dashboard data) ----
  -- Insert the case (status defaults to nao_iniciado; we set it terminal here
  -- under the case-RPC flag, mirroring close_case's terminal-first write). Its
  -- single phase is concluida. outcome_id = the adverse "Óbito evitável".
  perform set_config('app.in_case_rpc', 'on', true);
  insert into public.cases
    (id, commission_id, template_id, label, status, outcome_id, created_by, closed_at, closed_by)
  values
    (v_case2, v_comm_a, v_tpl, 'Óbito UTI leito 3', 'completed', v_oc_evit, v_chefe_a, now(), v_chefe_a);

  -- One concluida phase (pins Form A's published version). The recompute trigger
  -- fires on the insert but early-returns because the case is already terminal.
  insert into public.case_phases
    (id, case_id, position, form_id, form_version_id, title, status, recommended,
     assigned_to, activated_at, completed_at, default_due_days)
  values
    (v_cp1, v_case2, 1, v_form_a, v_ver_a, 'Fase 1 — Coleta inicial',
     'completed', false, v_staff_a1, now(), now(), 7);
  perform set_config('app.in_case_rpc', 'off', true);

  -- Caso 0002 also snapshots the offered set (consistency with the model).
  insert into public.case_offered_outcomes (case_id, outcome_id) values
    (v_case2, v_oc_evit), (v_case2, v_oc_nevit), (v_case2, v_oc_alta);
end $$;

-- ===========================================================================
-- Case NARRATIVES fixture (commission A / CCIH) — ADR 0032. A narrative-type
-- vocabulary; the M&M process interleaves narrative SLOTS with its two phases via
-- display_position (phase1=1, Resumo=2, phase2=3, Achados=4, Conclusão=5); Caso
-- 0001 snapshots them — one with a short de-identified body_md, one left empty to
-- exercise the placeholder + the empty-expected close-warning paths. No patient
-- data (de-identified governance prose only). Direct inserts (the seed bypasses
-- the flag-gated RPCs); the case_phases display_position UPDATE runs under
-- app.in_case_rpc (the phase guard rejects a bare UPDATE on a non-pendente phase),
-- and the case_narratives inserts pass guard_case_narrative_frozen because Caso
-- 0001 is still 'aberto'.
-- ===========================================================================
do $$
declare
  v_comm_a   uuid := 'a0000000-0000-0000-0000-0000000000a1';
  v_chefe_a  uuid := '00000000-0000-0000-0000-000000000002';
  v_case1    uuid := 'd0000000-0000-0000-0000-0000000000c1';  -- existing Caso 0001
  v_tpl      uuid;
  v_nt_res   uuid := 'e2000000-0000-0000-0000-0000000000f1';  -- Resumo Clínico
  v_nt_ach   uuid := 'e2000000-0000-0000-0000-0000000000f2';  -- Achados e Discussão
  v_nt_conc  uuid := 'e2000000-0000-0000-0000-0000000000f3';  -- Conclusão do Comitê
  v_cp1      uuid;
  v_cp2      uuid;
begin
  -- Resolve the M&M template + Caso 0001's two phases (by position).
  select id into v_tpl
  from public.process_templates
  where commission_id = v_comm_a and title = 'Investigação de Óbito (M&M)'
  limit 1;
  select id into v_cp1 from public.case_phases where case_id = v_case1 and position = 1;
  select id into v_cp2 from public.case_phases where case_id = v_case1 and position = 2;

  -- Narrative-type vocabulary (positions 1..3).
  insert into public.case_narrative_types
    (id, commission_id, label, description, position)
  values
    (v_nt_res,  v_comm_a, 'Resumo Clínico',
     'Síntese do caso, sem dados que identifiquem o paciente.', 1),
    (v_nt_ach,  v_comm_a, 'Achados e Discussão',
     'Análise do comitê sobre os achados.', 2),
    (v_nt_conc, v_comm_a, 'Conclusão do Comitê', null, 3);

  -- Template narrative SLOTS interleaved with the two phase-slots (which sit at
  -- display_position 1 and 3 after the UPDATE below): Resumo=2, Achados=4,
  -- Conclusão=5. Conclusão is_expected (drives the soft close-warning).
  insert into public.process_template_narratives
    (template_id, narrative_type_id, display_position, title, instructions, is_expected)
  values
    (v_tpl, v_nt_res,  2, null, null, false),
    (v_tpl, v_nt_ach,  4, null, 'Descreva os achados e a discussão do comitê.', false),
    (v_tpl, v_nt_conc, 5, null, null, true);

  -- The two existing template phases keep their order in the merged list
  -- (display_position := position). process_template_phases is UNGUARDED.
  update public.process_template_phases
  set display_position = position
  where template_id = v_tpl;

  -- Caso 0001's phases: display_position := position. GUARDED → wrap in the flag.
  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases set display_position = position
  where case_id = v_case1;
  perform set_config('app.in_case_rpc', 'off', true);

  -- Snapshot the three narratives into Caso 0001 (still 'aberto', so the freeze
  -- guard passes). type_label is the EFFECTIVE label (no slot title overrides
  -- here, so = the type label). One has a short de-identified body_md; the other
  -- two are left empty (Achados to exercise the coordinator placeholder; Conclusão
  -- — is_expected — to exercise the empty-expected close warning).
  insert into public.case_narratives
    (case_id, narrative_type_id, type_label, display_position, title, instructions,
     is_expected, body_md, created_by, updated_by)
  values
    (v_case1, v_nt_res,  'Resumo Clínico', 2, null, null, false,
     E'Paciente do leito 7 da UTI, evoluiu com piora clínica progressiva.\n\n'
     || 'O comitê revisou o checklist da Fase 1. Sem dados identificáveis.',
     v_chefe_a, v_chefe_a),
    (v_case1, v_nt_ach,  'Achados e Discussão', 4, null,
     'Descreva os achados e a discussão do comitê.', false, null, v_chefe_a, null),
    (v_case1, v_nt_conc, 'Conclusão do Comitê', 5, null, null, true, null,
     v_chefe_a, null);
end $$;

-- ===========================================================================
-- Case ACCESS CONTROL fixture (commission A / CCIH) — ADR 0033, §5 acceptance.
-- ===========================================================================
-- Wires Caso 0001 ("Óbito UTI leito 7") to exercise EVERY access path the tester
-- needs, so the §5 personas resolve to real rows once the case_access flag is ON
-- (flipped in migration …110004, which runs before this seed):
--   * chefe.ccih  (…02) — COORDINATOR (staff_admin); passes every predicate.
--   * staff1.ccih (…03) — PHASE assignee: already assigned Caso 0001 Phase 1
--     (the Phase-7 fixture above) → attribution-derived FULL-CASE READ.
--   * staff2.ccih (…04) — NARRATIVE assignee: assigned the "Resumo Clínico"
--     narrative below (status stays 'open') → attribution-derived FULL-CASE READ
--     + may author/conclude THAT narrative (Q14).
--   * multi       (…08) — standalone READ grant (a viewer; editors hidden).
--   * staff3.ccih (…09) — standalone WRITE grant (a collaborator; may author the
--     UN-assigned narratives + action items/docs/tags; no lifecycle, no phase-fill).
--   * staff4.ccih (…0a) — UNRELATED member: NO attribution, NO grant → the BOUNDARY
--     persona (notFound() on the case; absent from Meus Casos).
-- The narrative assignee UPDATE needs no app.in_narrative_rpc flag — Caso 0001 is
-- non-terminal, so guard_case_narrative_frozen passes. Grants insert directly
-- (the grant RPC is the app path; the seed bypasses RLS as superuser). De-identified
-- governance data only — no patient identifiers.
do $$
declare
  v_case1    uuid := 'd0000000-0000-0000-0000-0000000000c1';  -- Caso 0001
  v_chefe_a  uuid := '00000000-0000-0000-0000-000000000002';
  v_staff_a2 uuid := '00000000-0000-0000-0000-000000000004';  -- narrative assignee
  v_multi    uuid := '00000000-0000-0000-0000-000000000008';  -- read grant
  v_staff_a3 uuid := '00000000-0000-0000-0000-000000000009';  -- write grant
  v_nt_res   uuid := 'e2000000-0000-0000-0000-0000000000f1';  -- "Resumo Clínico" type
  v_narr_res uuid;
begin
  -- Assign the "Resumo Clínico" narrative of Caso 0001 to staff2.ccih.
  select id into v_narr_res
  from public.case_narratives
  where case_id = v_case1 and narrative_type_id = v_nt_res
  limit 1;

  if v_narr_res is not null then
    update public.case_narratives
    set assigned_to = v_staff_a2, updated_by = v_chefe_a
    where id = v_narr_res;
  end if;

  -- Standalone grants: multi = read (viewer), staff3 = write (collaborator).
  insert into public.case_access (case_id, user_id, level, granted_by) values
    (v_case1, v_multi,    'read',  v_chefe_a),
    (v_case1, v_staff_a3, 'write', v_chefe_a)
  on conflict (case_id, user_id) do update set level = excluded.level;
end $$;

-- ===========================================================================
-- Phase 10: Meetings fixture (commission A / CCIH)
-- ===========================================================================
-- A `realizada` meeting "Reunião Ordinária — Junho/2026" authored by chefe.ccih,
-- with two agenda items, the three CCIH personas as `presente` attendees, one
-- meeting_cases link to the existing demo case (Caso 0001), and one action item
-- assigned to staff1.ccih. The two default meeting types + the quorum settings
-- row already exist for commission A (seeded by the …090005 backfill).
--
-- The seed runs as superuser (RLS bypassed) and inserts DIRECTLY (like the cases
-- fixture above) — it does NOT call the flag-gated RPCs (the `meetings` flag
-- ships OFF until phase completion). The meeting-number minting trigger fires on
-- the INSERT; the lifecycle/child-lock guards are UPDATE/DELETE-only, so the
-- direct `realizada` insert + its children are unaffected. The same-commission
-- guards on meeting_cases (HC032) DO fire on insert and pass (case + meeting are
-- both commission A).
do $$
declare
  v_comm_a   uuid := 'a0000000-0000-0000-0000-0000000000a1';
  v_chefe_a  uuid := '00000000-0000-0000-0000-000000000002';
  v_staff_a1 uuid := '00000000-0000-0000-0000-000000000003';
  v_staff_a2 uuid := '00000000-0000-0000-0000-000000000004';
  v_case1    uuid := 'd0000000-0000-0000-0000-0000000000c1';  -- existing Caso 0001
  v_mtg      uuid := 'f1000000-0000-0000-0000-0000000000e1';  -- deterministic
  v_type     uuid;
  v_ag1      uuid := gen_random_uuid();
  v_ag2      uuid := gen_random_uuid();
begin
  -- Resolve the "Ordinária" meeting type seeded for commission A.
  select id into v_type
  from public.commission_meeting_types
  where commission_id = v_comm_a and name = 'Ordinária'
  limit 1;

  -- The meeting header (status realizada — held, not yet sent to signature).
  insert into public.meetings
    (id, commission_id, meeting_type_id, title, status, scheduled_start, scheduled_end,
     modality, location_text, minutes_md, created_by)
  values
    (v_mtg, v_comm_a, v_type, 'Reunião Ordinária — Junho/2026', 'held',
     now() - interval '2 days', now() - interval '2 days' + interval '90 minutes',
     'presencial', 'Sala de reuniões da CCIH',
     E'## Pauta\n\nDiscussão dos indicadores de infecção do mês e acompanhamento '
     || E'das ações em andamento. **Sem dados de paciente.**',
     v_chefe_a);

  -- Two agenda items.
  insert into public.meeting_agenda_items
    (id, meeting_id, position, title, description, discussion_notes, resolution, created_by)
  values
    (v_ag1, v_mtg, 1, 'Indicadores do mês',
     'Apresentação das taxas de infecção.',
     'Taxas estáveis em relação ao mês anterior.',
     'Manter o monitoramento atual.', v_chefe_a),
    (v_ag2, v_mtg, 2, 'Acompanhamento de ações',
     'Revisão das ações da última reunião.', null, null, v_chefe_a);

  -- The three CCIH personas as PRESENT attendees (chefe = presidente).
  insert into public.meeting_attendees (meeting_id, user_id, role, attendance) values
    (v_mtg, v_chefe_a,  'presidente', 'present'),
    (v_mtg, v_staff_a1, 'membro',     'present'),
    (v_mtg, v_staff_a2, 'membro',     'present');

  -- One case discussed (Caso 0001), attached to the first agenda item.
  insert into public.meeting_cases (meeting_id, case_id, agenda_item_id, summary, decision)
  values (v_mtg, v_case1, v_ag1,
          'Caso em investigação revisado pelo comitê.',
          'Encaminhar para a próxima fase.');

  -- One action item assigned to staff1 (sourced from agenda item 2), on the
  -- shared action_items hub (meeting source). Status = the global `open` default.
  insert into public.action_items
    (commission_id, source_type, source_meeting_id, source_agenda_item_id,
     title, description, status_id, assigned_to, due_date, created_by)
  values
    (v_comm_a, 'meeting', v_mtg, v_ag2, 'Atualizar protocolo de higienização',
     'Revisar e redistribuir o protocolo às equipes.',
     (select id from public.action_item_statuses where key = 'open' and commission_id is null),
     v_staff_a1, current_date + 14, v_chefe_a);
end $$;

-- ===========================================================================
-- Phase 11: Interviews fixture (commission A / CCIH)
-- ===========================================================================
-- An `em_andamento` interview "Entrevista sobre o Caso 0001" on the existing demo
-- case (Caso 0001, commission A), authored by chefe.ccih. It records:
--   * chefe.ccih as the REGISTERED interviewer (role entrevistador_principal) —
--     this exercises the participant write grant (a registered interviewer can
--     edit/conclude even if not acting as staff_admin), and one EXTERNAL interviewer.
--   * staff1.ccih as a REGISTERED subject + one EXTERNAL subject (free-text role).
--   * one `file` attachment (a signed-transcript metadata row — the object itself
--     is not seeded; the row is enough for the panel/list) and one `link`
--     attachment (an external https audio-recording URL — audio bytes are never
--     stored).
--
-- The seed runs as superuser (RLS bypassed) and inserts DIRECTLY (like the cases /
-- meetings fixtures) — it does NOT call the flag-gated RPCs. The interview-number
-- minting trigger fires on the INSERT; the lifecycle/child-lock guards are
-- UPDATE/DELETE-only (and the parent is em_andamento, not locked), so the direct
-- inserts pass. app.guard_interview_links DOES fire on insert and passes
-- (commission_id matches Caso 0001's commission; no case_phase_id set). The
-- attachment XOR/https CHECKs fire and pass (each row sets exactly one source).
do $$
declare
  v_comm_a   uuid := 'a0000000-0000-0000-0000-0000000000a1';
  v_chefe_a  uuid := '00000000-0000-0000-0000-000000000002';
  v_staff_a1 uuid := '00000000-0000-0000-0000-000000000003';
  v_case1    uuid := 'd0000000-0000-0000-0000-0000000000c1';  -- existing Caso 0001
  v_itw      uuid := 'f2000000-0000-0000-0000-0000000000e1';  -- deterministic
begin
  -- The interview header (status in_progress — being conducted).
  insert into public.case_interviews
    (id, commission_id, case_id, title, status, modality, location_text,
     scheduled_start, conducted_at, summary_md, created_by)
  values
    (v_itw, v_comm_a, v_case1, 'Entrevista sobre o Caso 0001', 'in_progress',
     'presencial', 'Sala da CCIH',
     now() - interval '1 day', now() - interval '1 day',
     E'## Resumo preliminar\n\nEntrevista com a equipe envolvida no caso. '
     || E'**Sem dados de paciente.** Foco no processo assistencial e nas '
     || E'oportunidades de melhoria.',
     v_chefe_a);

  -- Interviewers: chefe.ccih (REGISTERED, principal) + one external.
  insert into public.case_interview_interviewers
    (interview_id, user_id, external_name, external_org, role, note)
  values
    (v_itw, v_chefe_a, null, null, 'entrevistador_principal', null),
    (v_itw, null, 'Dra. Helena Marques', 'Consultoria Externa', 'observador', null);

  -- Subjects (interviewees): staff1.ccih (REGISTERED) + one external person.
  insert into public.case_interview_subjects
    (interview_id, user_id, external_name, external_org, clinical_role, note)
  values
    (v_itw, v_staff_a1, null, null, 'Enfermeiro(a) da unidade', null),
    (v_itw, null, 'Carlos Pereira', 'Hospital Central', 'Técnico de enfermagem', null);

  -- Attachments (F2 fold-in): one stored-file metadata row now lives in
  -- public.attachments (owner_type='interview'); the external audio link now lives
  -- in public.case_interview_links.
  insert into public.attachments
    (owner_type, owner_id, kind, title, storage_bucket, storage_path,
     sensitivity_tier, confidentiality_label, mime_type, size_bytes, uploaded_by)
  values
    ('interview', v_itw, 'transcricao_assinada', 'Transcrição assinada (rascunho)',
     'attachments-phi',
     'interview/' || v_itw || '/00000000-0000-0000-0000-0000000000f1.pdf',
     'phi', 'phi_standard', 'application/pdf', 12345, v_chefe_a);
  insert into public.case_interview_links
    (interview_id, title, external_url, created_by)
  values
    (v_itw, 'Gravação de áudio (link externo)',
     'https://example.com/recordings/caso-0001-entrevista.mp3', v_chefe_a);
end $$;

-- ===========================================================================
-- 9. PATIENT-SAFETY / NSP (Phase 14a) — the singleton NSP + sample events
-- ===========================================================================
-- The platform's FIRST PHI (Rule 12; ADR 0030/0031), isolated + access-audited.
-- Direct inserts as the superuser seed owner (mirrors the meetings/interviews seed;
-- the lifecycle RPCs gate on auth.uid(), which is null here). The code-mint BEFORE
-- INSERT trigger assigns EV-0001/EV-0002 automatically, so `code` is omitted.
-- Two events: one CASE-LINKED with an isolated event_patient PHI row, and one
-- STAND-ALONE (case-less). Both start at the NSP (current_owner_kind = 'pqs').
do $$
declare
  v_comm_a   uuid := 'a0000000-0000-0000-0000-0000000000a1';  -- CCIH
  v_org_a    uuid := '0c000000-0000-0000-0000-00000000000a';  -- Rede A (CCIH's org)
  v_org_b    uuid := '0c000000-0000-0000-0000-00000000000b';  -- Rede B
  v_hosp_a1  uuid := '05000000-0000-0000-0000-00000000000a';  -- central-a (org-a hospital 1)
  v_hosp_a2  uuid := '05000000-0000-0000-0000-0000000000a2';  -- secundario-a (org-a hospital 2)
  v_hosp_b   uuid := '05000000-0000-0000-0000-00000000000b';  -- central-b (org-b hospital)
  v_pqs_a    uuid := '00000000-0000-0000-0000-0000000000c2';  -- pqs.a (enrolled, central-a)
  v_pqs_a2   uuid := '00000000-0000-0000-0000-0000000000c6';  -- pqs.a2 (enrolled, secundario-a)
  v_pqs_dual uuid := '00000000-0000-0000-0000-0000000000c7';  -- pqsdual.a (both hospitals + CCIH member)
  v_pqs_b    uuid := '00000000-0000-0000-0000-0000000000c4';  -- pqs.b (enrolled, rede-b)
  v_comm_b_qual uuid := 'c0000000-0000-0000-0000-0000000000c1'; -- Qualidade B (rede-b)
  v_chefe_b_qual uuid := '00000000-0000-0000-0000-0000000000b2'; -- orgadmin.b (staff_admin Qualidade B)
  v_evb      uuid := 'e4000000-0000-0000-0000-0000000000b1';  -- a rede-b event (has PHI)
  v_admin    uuid := '00000000-0000-0000-0000-000000000001';  -- admin@test.local (enrolled in PQS)
  v_chefe_a  uuid := '00000000-0000-0000-0000-000000000002';  -- chefe.ccih (staff_admin)
  v_staff_a1 uuid := '00000000-0000-0000-0000-000000000003';  -- staff1.ccih (just-culture reporter)
  v_case1    uuid := 'd0000000-0000-0000-0000-0000000000c1';  -- existing Caso 0001
  v_ev1      uuid := 'e1000000-0000-0000-0000-0000000000a1';  -- case-linked event (has PHI)
  v_ev2      uuid := 'e2000000-0000-0000-0000-0000000000a2';  -- stand-alone event
  v_ev3      uuid := 'e3000000-0000-0000-0000-0000000000a3';  -- sentinel event (triaged)
  v_crit_id  uuid;                                            -- a flagged sentinel criterion
  v_rca3     uuid := 'f3000000-0000-0000-0000-0000000000a3';  -- the RCA for v_ev3
  v_factor   uuid := 'fac00000-0000-0000-0000-0000000000a1';  -- a key fishbone factor
  v_root3    uuid;                                            -- the RCA's root cause id
  v_capa3    uuid := 'ca000000-0000-0000-0000-0000000000a3';  -- the CAPA for v_ev3
  v_capa_act uuid := 'caa00000-0000-0000-0000-0000000000a1';  -- a corrective action
  v_capa_meas uuid := 'cab00000-0000-0000-0000-0000000000a1'; -- a measure (hex-only)
begin
  -- NSP-per-HOSPITAL (ADR 0052): ONE pqs_department row PER HOSPITAL, with
  -- DELIBERATELY DIFFERENT RCA due-windows so pgTAP proves per-hospital config
  -- (central-a=45d, secundario-a=20d, central-b=30d).
  insert into public.pqs_department (hospital_id, name, rca_default_due_days) values
    (v_hosp_a1, 'Núcleo de Segurança do Paciente — Central A', 45),
    (v_hosp_a2, 'Núcleo de Segurança do Paciente — Secundário A', 20),
    (v_hosp_b,  'Núcleo de Segurança do Paciente — Central B', 30);

  -- PER-HOSPITAL PQS rosters. Enrollment grants THAT hospital's PHI read.
  --   central-a: pqs.a (the named reader) + admin (so dev/E2E keep NSP access on
  --     central-a). nspcoord.a (central-a's coordinator) is DELIBERATELY NOT enrolled
  --     — it reads via the coordinator arm (full operator, decision 12), proving a
  --     coordinator reads without membership.
  --   secundario-a: pqs.a2 (the isolation subject — reads ONLY secundario-a's PHI).
  --   central-b: pqs.b.
  --   pqsdual.a: enrolled in BOTH central-a AND secundario-a → a dual-hospital operator
  --     (the NSP switcher >1-grant path) who is ALSO a CCIH commission member.
  -- nsporg.a (the org NSP-admin) is enrolled in NO roster — proving it reads ZERO PHI.
  -- MEM (S1): pqs enrollment is the synthetic role='pqs_member' on memberships,
  -- scoped to the hospital (+ its org, per the shape CHECK). granted_by = v_admin.
  insert into public.memberships (organization_id, hospital_id, principal_id, role, granted_by) values
    (v_org_a, v_hosp_a1, v_pqs_a,    'pqs_member', v_admin),
    (v_org_a, v_hosp_a1, v_admin,    'pqs_member', v_admin),
    (v_org_a, v_hosp_a2, v_pqs_a2,   'pqs_member', v_admin),
    (v_org_a, v_hosp_a1, v_pqs_dual, 'pqs_member', v_admin),
    (v_org_a, v_hosp_a2, v_pqs_dual, 'pqs_member', v_admin),
    (v_org_b, v_hosp_b,  v_pqs_b,    'pqs_member', v_admin)
  on conflict (principal_id, role, organization_id, hospital_id, commission_id) do nothing;

  -- Event 1 — CASE-LINKED, reported by a PLAIN staff member (just-culture),
  -- acknowledged by the NSP. Held by the NSP.
  insert into public.patient_safety_event
    (id, reporting_commission_id, case_id, discovered_at, location, reported_by,
     suspected_harm_level, title, description_md, status,
     current_owner_kind, current_owner_commission_id, acknowledged_by, acknowledged_at)
  values
    (v_ev1, v_comm_a, v_case1, current_date - 2, 'UTI Adulto, leito 7', v_staff_a1,
     'moderate', 'Queda de paciente durante transferência',
     E'## Descrição\n\nPaciente sofreu queda durante a transferência da maca para o '
     || E'leito. Avaliado pela equipe; conduta registrada no prontuário.',
     'acknowledged', 'pqs', null, v_chefe_a, now() - interval '1 day');

  -- Its initial custody interval (opened at the NSP).
  insert into public.event_custody
    (event_id, owner_kind, owner_commission_id, assigned_by, note)
  values
    (v_ev1, 'pqs', null, v_staff_a1, 'Notificação inicial ao NSP');

  -- The case_events 'safety_event' echo (Phase-12 timeline; deduped off the
  -- timeline against the authoritative patient_safety_event read).
  insert into public.case_events (case_id, kind, title, body, occurred_at, created_by)
  values
    (v_case1, 'safety_event', 'Evento de segurança EV-0001',
     'Evento EV-0001 notificado ao NSP: Queda de paciente durante transferência',
     current_date - 2, v_staff_a1);

  -- Its ISOLATED PHI row (minimum-necessary identifiers; Rule 12).
  insert into public.event_patient
    (event_id, name, mrn, date_of_birth, sex, encounter_ref, unit, attending)
  values
    (v_ev1, 'Paciente de Demonstração', 'PRT-0099123', '1958-03-14', 'male',
     'ENC-2026-4471', 'UTI Adulto', 'Dr. Ricardo Antunes');
  -- WS A: this direct insert bypasses set_event_patient, so flip the denormalized
  -- has_patient flag manually (set_event_patient does it on the real write path).
  update public.patient_safety_event set has_patient = true where id = v_ev1;

  -- Event 2 — STAND-ALONE (no case), freshly reported, held by the NSP.
  insert into public.patient_safety_event
    (id, reporting_commission_id, case_id, discovered_at, location, reported_by,
     suspected_harm_level, title, description_md, status,
     current_owner_kind, current_owner_commission_id)
  values
    (v_ev2, v_comm_a, null, current_date - 1, 'Farmácia central', v_chefe_a,
     'mild', 'Divergência na dispensação de medicamento',
     E'## Descrição\n\nDivergência identificada na conferência de dispensação. '
     || E'Sem alcance ao paciente. Notificado para análise do NSP.',
     'reported', 'pqs', null);

  insert into public.event_custody
    (event_id, owner_kind, owner_commission_id, assigned_by, note)
  values
    (v_ev2, 'pqs', null, v_chefe_a, 'Notificação inicial ao NSP');

  -- Event 3 — a SENTINEL event, fully TRIAGED (Phase 14b demo). Reported case-less,
  -- acknowledged, then triaged: PSE=yes, reach=sentinel, harm=death, a designated
  -- category flagged → sentinel determination → RCA mandated (shell + 45-day due).
  -- Inserted at 'acknowledged' first, then the worksheet, then flipped to 'triaged'
  -- under app.in_safety_rpc (so the state-machine + freeze guards admit the seed).
  insert into public.patient_safety_event
    (id, reporting_commission_id, case_id, discovered_at, location, reported_by,
     suspected_harm_level, title, description_md, status,
     current_owner_kind, current_owner_commission_id, acknowledged_by, acknowledged_at)
  values
    (v_ev3, v_comm_a, null, current_date - 5, 'Centro cirúrgico, sala 2', v_chefe_a,
     'death', 'Retenção de corpo estranho após cirurgia',
     E'## Descrição\n\nIdentificada retenção de compressa cirúrgica após procedimento; '
     || E'necessário segundo procedimento. Caso encaminhado ao NSP para triagem.',
     'acknowledged', 'pqs', null, v_chefe_a, now() - interval '4 days');

  insert into public.event_custody
    (event_id, owner_kind, owner_commission_id, assigned_by, note)
  values
    (v_ev3, 'pqs', null, v_chefe_a, 'Notificação inicial ao NSP');

  -- The triage worksheet (sentinel determination = true; pathway = rca).
  insert into public.event_triage
    (event_id, is_pse, reach, harm_severity, natural_course, sentinel_determination,
     review_pathway, disposition_notes_md, triaged_by, triaged_at)
  values
    (v_ev3, true, 'sentinel', 'death', false, true, 'rca',
     E'Evento sentinela confirmado. RCA obrigatória em até 45 dias.',
     v_chefe_a, now() - interval '3 days');

  -- The flagged designated category (snapshot key+label — the permanent record).
  select id into v_crit_id from public.pqs_sentinel_criteria where key = 'retained_object';
  insert into public.event_triage_sentinel_flags
    (event_id, criteria_id, criteria_key, criteria_label)
  select v_ev3, v_crit_id, c.key, c.label
  from public.pqs_sentinel_criteria c where c.id = v_crit_id;

  -- Flip the event to 'triaged' (freezes the worksheet) + mint the RCA shell. Both
  -- writes need the safety-RPC session flag so the guards admit the seed transition.
  perform set_config('app.in_safety_rpc', 'on', true);
  update public.patient_safety_event set status = 'triaged', updated_at = now() where id = v_ev3;
  perform set_config('app.in_safety_rpc', 'off', true);

  -- The RCA shell (as confirm_triage would mint it), then fleshed out into a
  -- partially-complete analysis (Phase 14c demo; mirrors README_rca §1.4 depth) so the
  -- workspace shows real content on load: problem statement, a team, a key fishbone
  -- factor + a 5-Whys drill, and a distilled root cause. Status = in_progress.
  insert into public.rca (id, event_id, status, due_date, created_by, what_md, expected_md,
                          detected, impact, scope)
  values (v_rca3, v_ev3, 'in_progress', (current_date - 5) + 45, v_chefe_a,
          E'Compressa cirúrgica retida identificada após colectomia eletiva; '
          || E'necessário segundo procedimento para remoção.',
          E'A contagem de compressas deveria ter sido conferida e conciliada antes do '
          || E'fechamento, conforme protocolo de cirurgia segura.',
          'Centro cirúrgico, ao final do procedimento', 'Óbito · evento sentinela',
          'Perioperatório · Cirurgia Geral');

  -- Team: a Lead (staff_admin) + an SME who is a PLAIN staff member (demonstrates the
  -- participant write grant — a non-observer staff SME can write the RCA).
  insert into public.rca_members (rca_id, user_id, external_name, role) values
    (v_rca3, v_chefe_a, null, 'lead'),
    (v_rca3, v_staff_a1, null, 'sme');

  -- An incident-timeline entry.
  insert into public.rca_timeline_entries (rca_id, occurred_at, description, position) values
    (v_rca3, now() - interval '6 days',
     'Término do procedimento sem conciliação final da contagem de compressas.', 1);

  -- A fishbone factor flagged as KEY (carried into the 5-Whys).
  insert into public.rca_factors (id, rca_id, category, text, is_key, position) values
    (v_factor, v_rca3, 'process',
     'Contagem de compressas não conciliada antes do fechamento', true, 1);

  -- The 5-Whys drill for that key factor + the reached root cause.
  insert into public.rca_why_chains (rca_id, factor_id, steps, root_text) values
    (v_rca3, v_factor,
     to_jsonb(array[
       'A equipe assumiu que a contagem inicial estava correta.',
       'Não havia conferência independente obrigatória ao fechar.',
       'O protocolo de cirurgia segura não definia uma dupla checagem.'
     ]),
     'Ausência de uma dupla checagem padronizada da contagem cirúrgica.');

  -- A distilled root cause (the FK target Phase 14d addresses).
  insert into public.rca_root_causes (rca_id, text, category, classification, type, position)
  values
    (v_rca3,
     'Ausência de processo padronizado de dupla checagem da contagem cirúrgica.',
     'process', 'system', 'root', 1)
  returning id into v_root3;

  -- A CAPA plan opened from that RCA root cause (Phase 14d demo). Left OPEN
  -- (in_execution) so the close-flow stays demoable: one corrective action with a
  -- task, a measure with a result, and a recorded effectiveness verdict — but NOT
  -- closed (closing requires every action settled, which the open action blocks).
  -- capa_plan.hospital_id (WS-3c D4/H-8) is auto-derived from the source RCA by the
  -- derive_capa_hospital BEFORE INSERT trigger (rca -> event -> hospital), so this
  -- direct seed insert needs no explicit hospital_id.
  insert into public.capa_plan (id, source, source_rca_id, classification, status, opened_by)
  values (v_capa3, 'rca', v_rca3, 'corretiva', 'in_execution', v_chefe_a);

  -- A corrective action assigned to a PLAIN staff member (demonstrates the
  -- assignee-or-PQS advance path); links back to the root cause. Strength = forte.
  insert into public.capa_action
    (id, capa_id, title, owner, assignee_user_id, due_date, action_strength,
     success_measure, root_cause_id, status, position)
  values
    (v_capa_act, v_capa3,
     'Implantar dupla checagem padronizada da contagem cirúrgica',
     'Enf. responsável do CC', v_staff_a1, current_date + 30, 'forte',
     'Conformidade da dupla checagem ≥ 95% nas cirurgias auditadas',
     v_root3, 'in_progress', 1);

  insert into public.capa_action_task (action_id, description, is_done, position) values
    (v_capa_act, 'Revisar o protocolo de cirurgia segura com a equipe do CC', true, 1),
    (v_capa_act, 'Treinar a equipe na nova rotina de dupla checagem', false, 2);

  insert into public.capa_measure (id, capa_id, name, target, definition, position) values
    (v_capa_meas, v_capa3, 'Conformidade da dupla checagem', '≥ 95%',
     'Percentual de cirurgias auditadas com dupla checagem registrada', 1);

  insert into public.capa_measure_result (measure_id, period, value, note, created_by) values
    (v_capa_meas, '2026-06', 82, 'Linha de base antes do treinamento.', v_chefe_a);

  -- A recorded effectiveness verdict (partial — the plan stays open for re-verification).
  insert into public.capa_effectiveness (capa_id, verdict, method_md, verified_by) values
    (v_capa3, 'parcial',
     E'Conformidade inicial de 82% após a primeira fase. Reavaliar após o treinamento completo.',
     v_chefe_a);

  -- ── REDE-B event + isolated PHI (NSP-per-org isolation fixture) ────────────────
  -- A stand-alone event reported by a REDE-B commission (Qualidade B), held by the
  -- NSP, with its own event_patient (MRN 'PRT-B-0001'). This is what an org-A NSP
  -- member must get NOTHING on, and a rede-b NSP member (pqs.b) must read — the
  -- cross-org PHI-isolation keystone. Its code mints per-org (rede-b's own EV
  -- sequence). reported_by = orgadmin.b (a member of Qualidade B).
  insert into public.patient_safety_event
    (id, reporting_commission_id, case_id, discovered_at, location, reported_by,
     suspected_harm_level, title, description_md, status,
     current_owner_kind, current_owner_commission_id, acknowledged_by, acknowledged_at)
  values
    (v_evb, v_comm_b_qual, null, current_date - 3, 'Enfermaria B, leito 12', v_chefe_b_qual,
     'moderate', 'Erro de identificação de paciente (Rede B)',
     E'## Descrição\n\nPulseira de identificação trocada entre dois pacientes; '
     || E'detectado antes de qualquer administração. Notificado ao NSP da Rede B.',
     'acknowledged', 'pqs', null, v_chefe_b_qual, now() - interval '2 days');

  insert into public.event_custody
    (event_id, owner_kind, owner_commission_id, assigned_by, note)
  values
    (v_evb, 'pqs', null, v_chefe_b_qual, 'Notificação inicial ao NSP da Rede B');

  insert into public.event_patient
    (event_id, name, mrn, date_of_birth, sex, encounter_ref, unit, attending)
  values
    (v_evb, 'Paciente Rede B', 'PRT-B-0001', '1972-09-02', 'female',
     'ENC-B-2026-0007', 'Enfermaria B', 'Dra. Beatriz Lima');
  update public.patient_safety_event set has_patient = true where id = v_evb;

  -- ── HOSPITAL-A2 event + isolated PHI (NSP-per-HOSPITAL isolation fixture) ───────
  -- A stand-alone event reported by a SECUNDÁRIO-A commission (Segurança A2), held by
  -- the NSP, with its own event_patient (distinct MRN 'PRT-A2-0001'). This is what a
  -- CENTRAL-A NSP member (pqs.a) must get NOTHING on — the cross-HOSPITAL, SAME-ORG
  -- PHI-isolation keystone — while a secundario-a operator (pqs.a2 / nspcoord.a2)
  -- reads it. Its code mints per-hospital (secundario-a's own EV sequence → EV-0001).
  -- reported_by = orgadmin.a (an org-a member).
  insert into public.patient_safety_event
    (id, reporting_commission_id, case_id, discovered_at, location, reported_by,
     suspected_harm_level, title, description_md, status,
     current_owner_kind, current_owner_commission_id, acknowledged_by, acknowledged_at)
  values
    ('e5000000-0000-0000-0000-0000000000a2', 'e0000000-0000-0000-0000-0000000000e2', null,
     current_date - 2, 'Bloco Cirúrgico Secundário A', '00000000-0000-0000-0000-0000000000b1',
     'moderate', 'Contagem cirúrgica divergente (Secundário A)',
     E'## Descrição\n\nDivergência na contagem de compressas ao final do procedimento; '
     || E'resolvida com radiografia. Notificado ao NSP do Hospital Secundário A.',
     'acknowledged', 'pqs', null, '00000000-0000-0000-0000-0000000000b1', now() - interval '1 day');

  insert into public.event_custody
    (event_id, owner_kind, owner_commission_id, assigned_by, note)
  values
    ('e5000000-0000-0000-0000-0000000000a2', 'pqs', null,
     '00000000-0000-0000-0000-0000000000b1', 'Notificação inicial ao NSP do Secundário A');

  insert into public.event_patient
    (event_id, name, mrn, date_of_birth, sex, encounter_ref, unit, attending)
  values
    ('e5000000-0000-0000-0000-0000000000a2', 'Paciente Secundário A', 'PRT-A2-0001',
     '1965-04-18', 'male', 'ENC-A2-2026-0031', 'Bloco Cirúrgico', 'Dr. Otávio Nunes');
  update public.patient_safety_event set has_patient = true
    where id = 'e5000000-0000-0000-0000-0000000000a2';
end $$;

-- ===========================================================================
-- 10. INTER-COMMITTEE REFERRALS (Phase 22) — demo fixtures for E2E
-- ===========================================================================
-- Two referrals A (CCIH) → B (Farmácia), as direct superuser inserts (the
-- lifecycle RPCs gate on auth.uid(), null here — mirrors the NSP seed). The
-- code-mint BEFORE INSERT trigger assigns ENC-0001/ENC-0002. Status transitions
-- are made directly under the app.in_referral_rpc guard flag (so guard_referral_*
-- permits them, exactly as the safety seed flips event status under in_safety_rpc).
--   * ENC-0001 — CONCLUDED, reply-expecting: full happy path (frozen narrative +
--     document snapshot + isolated referral_patient PHI + a delivered reply with a
--     linked case in B). The isolation fixture: A sees only the reply; QPS sees both.
--   * ENC-0002 — ENVIADA, reply-expecting: the CLOSE-GATE fixture (its source case
--     cannot be concluded while it is in flight → close_case HC076).
-- These exist regardless of the `case_referrals` flag (seed data); the E2E suite
-- flips the flag ON to exercise them.
do $$
declare
  v_comm_a    uuid := 'a0000000-0000-0000-0000-0000000000a1';  -- CCIH (source)
  v_comm_b    uuid := 'b0000000-0000-0000-0000-0000000000b1';  -- Farmácia (target)
  v_chefe_a   uuid := '00000000-0000-0000-0000-000000000002';  -- chefe.ccih (source coord)
  v_chefe_b   uuid := '00000000-0000-0000-0000-000000000005';  -- chefe.farm (target coord)
  v_src_case  uuid := 'd0000000-0000-0000-0000-0000000000c1';  -- existing Caso 0001 (CCIH)
  v_gate_case uuid := 'dca00000-0000-0000-0000-0000000000a1';  -- a PHASE-CLEAN source for the HC076 close-gate
  v_tgt_case  uuid := 'dba00000-0000-0000-0000-0000000000b1';  -- a case B creates to link
  v_narr      uuid := 'a2200000-0000-0000-0000-0000000000a1';  -- a narrative to snapshot
  v_doc       uuid := 'a3300000-0000-0000-0000-0000000000a1';  -- a document to snapshot
  v_type_par  uuid;                                            -- 'parecer' (reply-expected)
  v_outcome   uuid;                                            -- 'procede'
  v_ref1      uuid := 'efa00000-0000-0000-0000-0000000000a1';  -- ENC-0001 (concluida)
  v_ref2      uuid := 'efa00000-0000-0000-0000-0000000000a2';  -- ENC-0002 (enviada)
begin
  select id into v_type_par from public.referral_types where key = 'parecer';
  select id into v_outcome  from public.reply_outcomes where key = 'procede';

  -- Seed the rows at their final status directly; set the guard flag so the
  -- snapshot-lock / status guards permit the inserts on already-sent referrals
  -- (mirrors the in_case_rpc / in_submit_rpc pattern used elsewhere in this seed).
  perform set_config('app.in_referral_rpc', 'on', true);

  -- A narrative + a document on the SOURCE case, to freeze into the snapshot.
  insert into public.case_narratives
    (id, case_id, type_label, display_position, title, body_md, created_by)
  values
    (v_narr, v_src_case, 'Resumo do caso', 0, 'Resumo clínico',
     E'## Resumo\n\nPaciente do leito 7 com evolução desfavorável; solicita-se '
     || E'parecer da farmácia sobre a conciliação medicamentosa.', v_chefe_a);
  -- F2 fold-in: case_documents no longer exists; the row is now a case-owned
  -- public.attachments row (owner_type='case').
  insert into public.attachments
    (id, owner_type, owner_id, kind, title, storage_bucket, storage_path,
     sensitivity_tier, confidentiality_label, mime_type, uploaded_by)
  values
    (v_doc, 'case', v_src_case, 'digitalizacao', 'Prescrição digitalizada',
     'attachments-phi', 'case/' || v_src_case || '/prescricao-seed.pdf',
     'phi', 'phi_standard', 'application/pdf', v_chefe_a);

  -- A case in B to link onto ENC-0001 (so B's analyst path is demonstrable).
  insert into public.cases (id, commission_id, case_number, label, status, created_by)
  values (v_tgt_case, v_comm_b, 9001, 'Análise de parecer — CCIH', 'pending', v_chefe_b);

  -- A PHASE-CLEAN source case in A for ENC-0002, so the close-gate E2E hits HC076
  -- (a referral still in flight) WITHOUT the HC031 unsettled-phases gate masking it.
  -- No phases/outcomes are attached, so close_case reaches the referral gate first.
  insert into public.cases (id, commission_id, case_number, label, status, created_by)
  values (v_gate_case, v_comm_a, 9101, 'Caso aguardando parecer (close-gate)', 'pending', v_chefe_a);

  -- === ENC-0001 — CONCLUDED, reply-expecting (full isolation happy path) =====
  insert into public.case_referral
    (id, source_case_id, source_commission_id, target_commission_id, referral_type_id,
     type_label, subject, response_expected, has_patient, target_case_id, created_by,
     status, sent_at, sent_by, received_at, received_by, decided_at, decided_by, concluded_at, concluded_by)
  values
    (v_ref1, v_src_case, v_comm_a, v_comm_b, v_type_par, 'Parecer',
     'Solicitação de parecer sobre conciliação medicamentosa', true, true, v_tgt_case, v_chefe_a,
     'completed', now() - interval '6 days', v_chefe_a, now() - interval '5 days', v_chefe_b,
     now() - interval '5 days', v_chefe_b, now() - interval '2 days', v_chefe_b);

  -- Its frozen snapshot (a narrative copy + a document reference).
  insert into public.referral_shared_item
    (referral_id, kind, source_narrative_id, frozen_title, frozen_body_md, position)
  values
    (v_ref1, 'narrative', v_narr, 'Resumo clínico',
     E'## Resumo\n\nPaciente do leito 7 com evolução desfavorável; solicita-se '
     || E'parecer da farmácia sobre a conciliação medicamentosa.', 0);
  insert into public.referral_shared_item
    (referral_id, kind, source_document_id, frozen_title, frozen_storage_path, frozen_mime_type, position)
  values
    (v_ref1, 'document', v_doc, 'Prescrição digitalizada',
     v_comm_a || '/' || v_src_case || '/prescricao-seed.pdf', 'application/pdf', 1);

  -- Its ISOLATED patient PHI (Rule 12) — the audited-door fixture. Phase 23 (ADR
  -- 0039): this row is the SYNTHETIC CROSS-COMMITTEE TEST PATIENT — it deliberately
  -- shares the MRN 'PRT-0099123' AND the encounter 'ENC-2026-4471' with the NSP
  -- event_patient (event EV-0001, commission A; seed ~line 907) AND with the B-side
  -- case_patient added below (case 9001, commission B). The derivation trigger is
  -- ALWAYS-ON, so right after `db reset` all three rows already carry ONE shared
  -- patient_key (and the event+referral share an encounter_key) — no backfill needed.
  -- Flipping `patient_index` ON then makes a QPS search by 'PRT-0099123' return the
  -- full cross-committee/cross-module trajectory. (The former demo MRN 'PRT-77'
  -- produced zero matches — Phase-23 needs a real one.)
  insert into public.referral_patient
    (referral_id, name, mrn, age_years, sex, encounter_ref, unit, attending)
  values
    (v_ref1, 'Paciente de Demonstração', 'PRT-0099123', 71, 'male', 'ENC-2026-4471',
     'UTI Adulto', 'Dr. Plantonista');

  -- Its delivered reply (procede) — what A receives; QPS sees both ends.
  insert into public.referral_reply
    (referral_id, reply_outcome_id, outcome_label, result_md, acknowledged_only, replied_by, replied_at)
  values
    (v_ref1, v_outcome, 'Procede',
     E'## Parecer\n\nA conciliação medicamentosa procede. Recomenda-se ajuste de dose '
     || E'conforme função renal e suspensão do item duplicado.', false, v_chefe_b, now() - interval '2 days');

  -- === ENC-0002 — ENVIADA, reply-expecting (the close-gate fixture) ==========
  insert into public.case_referral
    (id, source_case_id, source_commission_id, target_commission_id, referral_type_id,
     type_label, subject, response_expected, created_by, status, sent_at, sent_by)
  values
    (v_ref2, v_gate_case, v_comm_a, v_comm_b, v_type_par, 'Parecer',
     'Segundo parecer — interação medicamentosa', true, v_chefe_a,
     'sent', now() - interval '1 day', v_chefe_a);
  insert into public.referral_shared_item
    (referral_id, kind, source_narrative_id, frozen_title, frozen_body_md, position)
  values
    (v_ref2, 'narrative', v_narr, 'Resumo clínico',
     E'Solicita-se avaliação de possível interação medicamentosa.', 0);

  -- Phase 23 (ADR 0039) — SYNTHETIC CROSS-COMMITTEE TEST PATIENT, B-side leg. The
  -- case B created to analyze ENC-0001 (v_tgt_case, case 9001, COMMISSION B) gets
  -- its own isolated case_patient sharing the MRN 'PRT-0099123' with the NSP event
  -- (commission A) and the referral above. This makes case 9001 patient-bearing and
  -- completes the genuine CROSS-COMMITTEE (A ↔ B) + CROSS-MODULE (event/referral/case)
  -- match on one patient_key. Direct insert bypasses set_case_patient's
  -- patient_enabled gate (like the Caso 0001 case_patient seed at ~line 446); flip
  -- has_patient + patient_enabled so the panel/flags read true. Encounter omitted
  -- here so the encounter_key match stays event<->referral only (a second, narrower
  -- match basis for the QPS view to demonstrate).
  -- Re-keyed to the participant layer (ADR 0064 E0 / F1). Surrogate registry display_name
  -- (Q4); raw identifiers only in patient_identifiers. patient_enabled flipped first so
  -- the case is patient-bearing; the derivation trigger fires on the identifiers insert.
  declare
    v_role_pat_b uuid := 'e0000000-0000-0000-0000-0000000000b1';
    v_part_pat_b uuid := 'e0000000-0000-0000-0000-0000000000b9';
  begin
    update public.cases set patient_enabled = true where id = v_tgt_case;

    insert into public.case_participant_roles
      (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
    values (v_role_pat_b, app.org_of_commission(v_comm_b), 'affected_patient', 'Paciente afetado', array['patient'], true)
    on conflict (organization_id, key) where case_type_id is null do nothing;
    -- The org-wide 'affected_patient' role may already exist (org A/B share an org in
    -- this seed's tenancy); resolve the actual role id so the FK below is valid.
    select id into v_role_pat_b from public.case_participant_roles
     where organization_id = app.org_of_commission(v_comm_b)
       and key = 'affected_patient' and case_type_id is null;

    insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
    values (v_part_pat_b, app.org_of_commission(v_comm_b), 'patient', 'patient_phi', 'Paciente');
    insert into public.patient_participants (participant_id) values (v_part_pat_b);
    insert into public.case_participants (case_id, participant_id, role_id, is_primary_subject, added_by)
    values (v_tgt_case, v_part_pat_b, v_role_pat_b, true, v_chefe_b);
    insert into public.patient_identifiers
      (participant_id, name, mrn, age_years, sex, unit, attending)
    values (v_part_pat_b, 'Paciente de Demonstração', 'PRT-0099123', 71, 'male',
            'UTI Adulto', 'Dr. Plantonista');
  end;
  update public.cases set has_patient = true where id = v_tgt_case;

  perform set_config('app.in_referral_rpc', 'off', true);
end $$;

-- ===========================================================================
-- 11. NSP-PER-ORG (ADR 0042) — REDE-B referral + cross-module patient_xref fixture
-- ===========================================================================
-- An INTRA-rede-b referral (Qualidade B → Farmácia B; cross-org referrals are
-- forbidden) carrying isolated referral_patient PHI, plus a rede-b patient_xref
-- synthetic patient sharing ONE MRN ('PRT-B-0001') across the rede-b EVENT (section
-- 9) and this REFERRAL. This is the rede-b leg of the cross-org isolation proof: a
-- rede-a NSP member's patient search must return NOTHING for 'PRT-B-0001', and a
-- rede-b member (pqs.b) must see both the event and the referral. ENC mints continue
-- the GLOBAL sequence (ENC-0003). Direct superuser inserts (RPCs gate on auth.uid()).
do $$
declare
  v_comm_src  uuid := 'c0000000-0000-0000-0000-0000000000c1';  -- Qualidade B (source)
  v_comm_tgt  uuid := 'c0000000-0000-0000-0000-0000000000c2';  -- Farmácia B (target)
  v_coord_src uuid := '00000000-0000-0000-0000-0000000000b2';  -- orgadmin.b (staff_admin Qualidade B)
  v_src_case  uuid := 'dc000000-0000-0000-0000-0000000000b1';  -- a rede-b source case
  v_narr_b    uuid := 'a2200000-0000-0000-0000-0000000000b1';  -- a narrative to snapshot
  v_type_par  uuid;                                            -- 'parecer' (reply-expected)
  v_ref_b     uuid := 'efa00000-0000-0000-0000-0000000000b1';  -- ENC-0003 (rede-b, enviada)
begin
  select id into v_type_par from public.referral_types where key = 'parecer';

  -- A minimal rede-b source case in Qualidade B (so the referral has a provenance
  -- case in the source commission). Created by the source coordinator.
  insert into public.cases (id, commission_id, case_number, label, status, created_by)
  values (v_src_case, v_comm_src, 9101, 'Análise de incidente — Rede B', 'not_started', v_coord_src);

  -- A narrative on that case to snapshot into the referral.
  insert into public.case_narratives
    (id, case_id, type_label, display_position, title, body_md, created_by, assigned_to, status)
  values (v_narr_b, v_src_case, 'Resumo', 1, 'Resumo do incidente',
          E'Resumo do incidente de identificação para parecer da Farmácia B.',
          v_coord_src, v_coord_src, 'open');

  -- The intra-rede-b referral (Qualidade B → Farmácia B), ENVIADA, reply-expecting.
  -- Status set directly under the in_referral_rpc guard (mirrors the section-10 seed).
  perform set_config('app.in_referral_rpc', 'on', true);
  insert into public.case_referral
    (id, source_case_id, source_commission_id, target_commission_id, referral_type_id,
     type_label, subject, response_expected, created_by, status, sent_at, sent_by)
  values
    (v_ref_b, v_src_case, v_comm_src, v_comm_tgt, v_type_par, 'Parecer',
     'Parecer sobre conduta medicamentosa — Rede B', true, v_coord_src,
     'sent', now() - interval '1 day', v_coord_src);

  insert into public.referral_shared_item
    (referral_id, kind, source_narrative_id, frozen_title, frozen_body_md, position)
  values
    (v_ref_b, 'narrative', v_narr_b, 'Resumo do incidente',
     E'Resumo do incidente de identificação para parecer.', 0);

  -- Its isolated referral_patient PHI — SAME MRN as the rede-b event (PRT-B-0001), so
  -- the patient_xref links event<->referral within rede-b ONLY.
  insert into public.referral_patient
    (referral_id, name, mrn, age_years, sex, encounter_ref, unit, attending)
  values
    (v_ref_b, 'Paciente Rede B', 'PRT-B-0001', 54, 'female', 'ENC-B-2026-0007',
     'Enfermaria B', 'Dra. Beatriz Lima');
  update public.case_referral set has_patient = true where id = v_ref_b;
  perform set_config('app.in_referral_rpc', 'off', true);

  -- NOTE: patient_xref rows for the rede-b event + referral are maintained
  -- AUTOMATICALLY by the trg_xref_maintain AFTER-trigger on event_patient /
  -- referral_patient (keyed by the shared MRN under the deployment pepper), with
  -- commission_id resolved to the rede-b commissions -> rede-b org. No manual
  -- patient_xref insert is needed (and the rede-a synthetic PRT-0099123 from
  -- section 10 stays a rede-a-only set).
end $$;

-- ===========================================================================
-- 11b. INTRA-ORG CROSS-HOSPITAL REFERRAL (NSP-per-hospital, ADR 0052 dec. 14)
-- ===========================================================================
-- A referral from CENTRAL-A's CCIH (source) to SECUNDÁRIO-A's Segurança A2 (target)
-- — SAME org, DIFFERENT hospitals (legal: create_referral_draft forbids only
-- CROSS-ORG). Isolated referral_patient PHI (distinct MRN 'PRT-A2-0002'). The
-- DUAL-HOSPITAL keystone: BOTH the source hospital's NSP (central-a: pqs.a /
-- nspcoord.a) AND the target hospital's NSP (secundario-a: pqs.a2 / nspcoord.a2)
-- read this referral's PHI; an org-B NSP member gets NOTHING. Mints ENC-0004 on the
-- GLOBAL sequence. Direct superuser inserts (RPCs gate on auth.uid()).
do $$
declare
  v_comm_src  uuid := 'a0000000-0000-0000-0000-0000000000a1';  -- CCIH (central-a, source)
  v_comm_tgt  uuid := 'e0000000-0000-0000-0000-0000000000e2';  -- Segurança A2 (secundario-a, target)
  v_coord_src uuid := '00000000-0000-0000-0000-000000000002';  -- chefe.ccih (staff_admin CCIH)
  v_src_case  uuid := 'dc000000-0000-0000-0000-0000000000a2';  -- an org-a source case (CCIH)
  v_narr_a2   uuid := 'a2200000-0000-0000-0000-0000000000a2';  -- a narrative to snapshot
  v_type_par  uuid;                                            -- 'parecer' (reply-expected)
  v_ref_x     uuid := 'efa00000-0000-0000-0000-0000000000a4';  -- ENC-0004 (cross-hospital)
begin
  select id into v_type_par from public.referral_types where key = 'parecer';

  insert into public.cases (id, commission_id, case_number, label, status, created_by)
  values (v_src_case, v_comm_src, 9201, 'Análise de incidente — Central A', 'not_started', v_coord_src);

  insert into public.case_narratives
    (id, case_id, type_label, display_position, title, body_md, created_by, assigned_to, status)
  values (v_narr_a2, v_src_case, 'Resumo', 1, 'Resumo do incidente',
          E'Resumo do incidente de infecção para parecer da Segurança do Paciente A2.',
          v_coord_src, v_coord_src, 'open');

  perform set_config('app.in_referral_rpc', 'on', true);
  insert into public.case_referral
    (id, source_case_id, source_commission_id, target_commission_id, referral_type_id,
     type_label, subject, response_expected, created_by, status, sent_at, sent_by)
  values
    (v_ref_x, v_src_case, v_comm_src, v_comm_tgt, v_type_par, 'Parecer',
     'Parecer sobre protocolo entre hospitais — Rede A', true, v_coord_src,
     'sent', now() - interval '1 day', v_coord_src);

  insert into public.referral_shared_item
    (referral_id, kind, source_narrative_id, frozen_title, frozen_body_md, position)
  values
    (v_ref_x, 'narrative', v_narr_a2, 'Resumo do incidente',
     E'Resumo do incidente de infecção para parecer entre hospitais.', 0);

  -- Isolated referral_patient PHI (distinct MRN). Read by BOTH endpoint hospitals' NSPs.
  insert into public.referral_patient
    (referral_id, name, mrn, age_years, sex, encounter_ref, unit, attending)
  values
    (v_ref_x, 'Paciente Entre-Hospitais A', 'PRT-A2-0002', 63, 'male', 'ENC-A2-2026-0044',
     'Clínica Médica', 'Dr. Otávio Nunes');
  update public.case_referral set has_patient = true where id = v_ref_x;
  perform set_config('app.in_referral_rpc', 'off', true);
end $$;

-- answer-model-v2: drop the seed-only selection helper.
drop function if exists app.seed_select(uuid, uuid, text[]);

-- ---------------------------------------------------------------------------
-- Phase 15 — Quality Indicators (Indicadores de Qualidade). Representative data
-- under commission A (CCIH; chefe.ccih persona) so the E2E acceptance flows have
-- something to render: a MANUAL percentual with monthly measurements (two
-- OFF-TARGET, to exercise the two-tier CAPA affordance), a DERIVED percentual
-- bound to the hand-hygiene form's real option codes, a HYBRID taxa, and a
-- TEMPO_MEDIO. Inserted directly as postgres (RLS bypassed); value/status computed
-- via the app helpers so they are self-consistent. The quality_indicators flag is
-- ON (migration 20260712000300).
-- ---------------------------------------------------------------------------
do $ind$
declare
  v_comm_a  uuid := 'a0000000-0000-0000-0000-0000000000a1';
  v_form_hh uuid := 'f0000000-0000-0000-0000-00000000a001';  -- Checklist de Higienização das Mãos
  v_chefe   uuid := '00000000-0000-0000-0000-000000000002';  -- chefe.ccih (staff_admin of A)
  v_ind_manual  uuid;
  v_ind_derived uuid;
  v_ind_hybrid  uuid;
  v_ind_tempo   uuid;
  v_num numeric;
  v_den numeric;
begin
  -- attribute the audit rows to chefe.ccih
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_chefe, 'role', 'authenticated')::text, true);

  -- 1) MANUAL percentual — "Adesão à higienização das mãos" (target >= 90, maior_melhor).
  insert into public.indicators
    (commission_id, name, description_md, kind, numerator_label, denominator_label,
     unit, direction, target_value, target_comparator, frequency, data_source, created_by)
  values
    (v_comm_a, 'Adesão à higienização das mãos',
     'Percentual de oportunidades de higienização das mãos executadas corretamente (observação direta).',
     'percentual', 'Higienizações corretas', 'Oportunidades observadas', '%',
     'maior_melhor', 90, '>=', 'mensal', 'manual', v_chefe)
  returning id into v_ind_manual;

  insert into public.indicator_measurements
    (indicator_id, period_label, period_start, period_end, numerator, denominator, value, status, source, entered_by)
  select v_ind_manual, m.period, m.pstart, m.pend, m.num, m.den,
         app.indicator_compute_value('percentual', m.num, m.den),
         app.indicator_classify(app.indicator_compute_value('percentual', m.num, m.den), 90, '>='),
         'manual', v_chefe
  from (values
    ('2026-03', date '2026-03-01', date '2026-03-31', 84::numeric, 100::numeric),  -- 84% OFF-TARGET
    ('2026-04', date '2026-04-01', date '2026-04-30', 88::numeric, 100::numeric),  -- 88% OFF-TARGET
    ('2026-05', date '2026-05-01', date '2026-05-31', 91::numeric, 100::numeric),  -- 91% on
    ('2026-06', date '2026-06-01', date '2026-06-30', 93::numeric, 100::numeric)   -- 93% on
  ) as m(period, pstart, pend, num, den);

  -- 2) DERIVED percentual — "Dispensadores de álcool disponíveis (%)" bound to the
  --    hand-hygiene form's option code 'sim' over the section-answered denominator.
  --    Seed a pre-computed measurement matching the dashboard aggregate.
  insert into public.indicators
    (commission_id, name, description_md, kind, numerator_label, denominator_label,
     unit, direction, target_value, target_comparator, frequency, data_source, derived_config, created_by)
  values
    (v_comm_a, 'Dispensadores de álcool disponíveis (%)',
     'Percentual de auditorias em que o dispensador de álcool em gel estava disponível e abastecido. Derivado do Checklist de Higienização das Mãos.',
     'percentual', 'Auditorias com dispensador disponível', 'Auditorias realizadas', '%',
     'maior_melhor', 95, '>=', 'mensal', 'derivado',
     jsonb_build_object('form_id', v_form_hh::text,
       'numerator', jsonb_build_object('question_key', 'dispensador_disponivel', 'option_codes', jsonb_build_array('sim')),
       'denominator', jsonb_build_object('question_key', 'dispensador_disponivel')),
     v_chefe)
  returning id into v_ind_derived;

  select count(*) into v_num
  from app.submitted_form_responses(v_form_hh) sr
  join public.answers a on a.response_id = sr.id
  join public.form_items fi on fi.id = a.item_id
  join public.answer_selected_options s on s.answer_id = a.id
  join public.form_item_options o on o.id = s.option_id
  where fi.question_key = 'dispensador_disponivel' and o.code = 'sim';

  select count(distinct sr.id) into v_den
  from app.submitted_form_responses(v_form_hh) sr
  join public.answers a on a.response_id = sr.id
  join public.form_items fi on fi.id = a.item_id
  where fi.item_type in ('multiple_choice','dropdown','checkbox')
    and fi.section_id = (select section_id from public.form_items
                         where form_version_id = app.latest_published_version(v_form_hh)
                           and question_key = 'dispensador_disponivel' limit 1)
    and exists (select 1 from public.answer_selected_options s2 where s2.answer_id = a.id);

  insert into public.indicator_measurements
    (indicator_id, period_label, period_start, period_end, numerator, denominator, value, status, source, entered_by)
  values
    (v_ind_derived, '2026-06', date '2026-06-01', date '2026-06-30', v_num, v_den,
     app.indicator_compute_value('percentual', v_num, v_den),
     app.indicator_classify(app.indicator_compute_value('percentual', v_num, v_den), 95, '>='),
     'derivado', v_chefe);

  -- 3) HYBRID taxa — "Densidade de IRAS" (per 1000 pacientes-dia). Numerator derived
  --    (option code 'nao'), denominator (pacientes-dia) manual.
  insert into public.indicators
    (commission_id, name, description_md, kind, numerator_label, denominator_label,
     unit, direction, target_value, target_comparator, frequency, data_source, derived_config, created_by)
  values
    (v_comm_a, 'Densidade de IRAS (por 1000 pacientes-dia)',
     'Taxa de infecções relacionadas à assistência à saúde por 1000 pacientes-dia. Numerador derivado; denominador (pacientes-dia) informado manualmente.',
     'taxa', 'Casos de IRAS', 'Pacientes-dia', '/1000 pac-dia',
     'menor_melhor', 5, '<=', 'mensal', 'hibrido',
     jsonb_build_object('form_id', v_form_hh::text,
       'numerator', jsonb_build_object('question_key', 'dispensador_disponivel', 'option_codes', jsonb_build_array('nao'))),
     v_chefe)
  returning id into v_ind_hybrid;

  select count(*) into v_num
  from app.submitted_form_responses(v_form_hh) sr
  join public.answers a on a.response_id = sr.id
  join public.form_items fi on fi.id = a.item_id
  join public.answer_selected_options s on s.answer_id = a.id
  join public.form_item_options o on o.id = s.option_id
  where fi.question_key = 'dispensador_disponivel' and o.code = 'nao';

  insert into public.indicator_measurements
    (indicator_id, period_label, period_start, period_end, numerator, denominator, value, status, source, entered_by)
  values
    (v_ind_hybrid, '2026-06', date '2026-06-01', date '2026-06-30', v_num, 900,
     app.indicator_compute_value('taxa', v_num, 900),
     app.indicator_classify(app.indicator_compute_value('taxa', v_num, 900), 5, '<='),
     'derivado', v_chefe);

  -- 4) TEMPO_MEDIO (manual) — "Tempo médio de resposta a alertas" (menor melhor).
  insert into public.indicators
    (commission_id, name, description_md, kind, numerator_label,
     unit, direction, target_value, target_comparator, frequency, data_source, created_by)
  values
    (v_comm_a, 'Tempo médio de resposta a alertas de higienização',
     'Tempo médio (horas) entre um alerta de não conformidade e a ação corretiva.',
     'tempo_medio', 'Tempo médio', 'h',
     'menor_melhor', 24, '<=', 'mensal', 'manual', v_chefe)
  returning id into v_ind_tempo;

  insert into public.indicator_measurements
    (indicator_id, period_label, period_start, period_end, numerator, denominator, value, status, source, entered_by)
  select v_ind_tempo, m.period, m.pstart, m.pend, m.avg, m.n,
         m.avg, app.indicator_classify(m.avg, 24, '<='), 'manual', v_chefe
  from (values
    ('2026-05', date '2026-05-01', date '2026-05-31', 30::numeric, 8::numeric),  -- 30h OFF-TARGET
    ('2026-06', date '2026-06-01', date '2026-06-30', 18::numeric, 9::numeric)   -- 18h on
  ) as m(period, pstart, pend, avg, n);

  perform set_config('request.jwt.claims', '', true);
end $ind$;

-- ===========================================================================
-- Phase 17 — Controlled Documents (Documentos Controlados). Representative data
-- under commission A (CCIH; chefe.ccih persona) so the E2E acceptance flows have
-- something to render:
--   1) A VIGENTE document (published v1) with a PAST-DUE review_due_date — surfaces
--      in the review-due list AND the hospital register.
--   2) A document EM_APROVACAO whose approver set includes chefe.farm (0005) — an
--      ACTIVE same-hospital user who is NOT a CCIH member (the outside-commission
--      approver persona), so the E2E can sign in as 0005 and confirm the approver-
--      read arm (sees ONLY this document) + the approval controls.
-- Inserted directly as postgres (RLS bypassed); status writes wrapped in the
-- app.in_controlled_docs_rpc flag so the state-machine + frozen-approver-set guards
-- permit the direct transitions.
--
-- BUG-DOC-002 (storage_path is NULL on purpose): a SQL seed CANNOT put real object
-- BYTES into the controlled-documents bucket — the local storage-api serves from its
-- own file backend (container /mnt volume), unreachable from Postgres — and a
-- storage.objects row with no bytes 404s on download (worse than an honest empty
-- state). So the seed leaves storage_path NULL and the detail page shows "Sem arquivo"
-- truthfully. This matches the whole existing seed convention (form-assets, meetings,
-- interviews, cases all reference paths WITHOUT backing objects). Download coverage is
-- provided by AC-1's REAL upload flow, not seed data. signature_hash below is computed
-- over the EMPTY path (coalesce(storage_path,'')) so it matches exactly what
-- approve_document would produce for a null-path version (self-consistent seed).
--
-- LOCAL-ONLY FLAG FLIP: the migration keeps controlled_docs default OFF (so PROD
-- stays OFF until the deliberate Record-step flip the lead owns at phase close).
-- seed.sql runs ONLY on `supabase db reset` (never in prod), so flipping it ON HERE
-- yields a flag-ON LOCAL/E2E env — the tester + preview need the `documentos` surface
-- live (with it OFF the layout 404s and the seeded DOC-0001/0002 are unreachable).
-- (Phase 15 flipped quality_indicators via a MIGRATION because that WAS its ship
--  state — prod ON intended. Phase 17 is not shipping yet, so we use the seed instead.)
update app.feature_flags set enabled = true where key = 'controlled_docs';

-- LOCAL-ONLY FLAG FLIP (F2 / ADR 0063 — same convention as controlled_docs above).
-- After the F2 fold-in, the meeting / interview / case attachment features all sit
-- behind the `attachments` flag (their upload/delete/open paths assert it), so with it
-- OFF the EXISTING attachment E2E specs — not just F2's — would fail and the frontend
-- rewire can't be verified in the browser preview. The migration keeps it default OFF
-- (prod stays OFF until the deliberate pilot-cutover flip the lead owns); seed.sql runs
-- ONLY on `db reset`, so flipping it ON HERE yields a flag-ON LOCAL/E2E env. NOT under
-- the F1 m2 hard gate (that gate is case_participants/case_types only — real ethics data).
update app.feature_flags set enabled = true where key = 'attachments';

-- BELT-AND-SUSPENDERS FLAG FLIP (SUP / ADR 0074): the companion migration
-- 20260720000610_flag_response_correction_on.sql already flips
-- response_correction ON unconditionally (the quality_indicators precedent —
-- prod ships ON from that migration), so this line is redundant on an ordinary
-- `db reset`. It is repeated here anyway, matching the plan's explicit
-- "seed.sql forces ON for local/E2E" instruction, so local/E2E stays ON even if
-- a future migration edit ever changes the flip's shape.
update app.feature_flags set enabled = true where key = 'response_correction';
-- ---------------------------------------------------------------------------
do $cd$
declare
  v_comm_a  uuid := 'a0000000-0000-0000-0000-0000000000a1';  -- CCIH (hospital 05..0a)
  v_chefe   uuid := '00000000-0000-0000-0000-000000000002';  -- chefe.ccih (staff_admin of A)
  v_farm    uuid := '00000000-0000-0000-0000-000000000005';  -- chefe.farm (same hospital, NOT a CCIH member) — the E2E outside-commission approver
  v_farm2   uuid := '00000000-0000-0000-0000-000000000006';  -- Farmacêutico Um (same hospital, NOT a CCIH member) — DOC-0001's outside approver
  v_staff1  uuid := '00000000-0000-0000-0000-000000000003';  -- staff of A (in-commission approver)
  v_doc_vig uuid;
  v_ver_vig uuid;
  v_doc_apr uuid;
  v_ver_apr uuid;
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_chefe, 'role', 'authenticated')::text, true);
  perform set_config('app.in_controlled_docs_rpc', 'on', true);

  -- 1) EFFECTIVE document with a PAST-DUE review_due_date.
  insert into public.controlled_documents
    (commission_id, code, title, doc_type, review_cycle_months, status, created_by)
  values
    (v_comm_a, 'DOC-0001', 'Política de Higienização das Mãos', 'politica', 12, 'effective', v_chefe)
  returning id into v_doc_vig;

  insert into public.controlled_document_versions
    (document_id, version_number, storage_path, summary_of_changes_md,
     effective_date, review_due_date, status, created_by)
  -- storage_path NULL on purpose (BUG-DOC-002 — no real bytes seedable; see header).
  values
    (v_doc_vig, 1, null,
     'Versão inicial da política.', date '2025-01-15', date '2026-01-15',  -- review_due IN THE PAST
     'effective', v_chefe)
  returning id into v_ver_vig;

  update public.controlled_documents set current_version_id = v_ver_vig where id = v_doc_vig;

  -- Its two named approvers (both already aprovado, so it published). signature_hash is
  -- computed over the EMPTY path (coalesce(storage_path,'')) exactly as approve_document
  -- would for this null-path version — a self-consistent seed.
  insert into public.document_approvals
    (document_version_id, approver_id, approver_title, decision, decided_at, note, signature_hash)
  values
    (v_ver_vig, v_staff1, 'Enfermeira CCIH', 'aprovado', now() - interval '18 months', null,
     encode(extensions.digest('' || ':' || v_staff1::text || ':aprovado', 'sha256'), 'hex')),
    (v_ver_vig, v_farm2, 'Diretor Técnico', 'aprovado', now() - interval '18 months', null,
     encode(extensions.digest('' || ':' || v_farm2::text || ':aprovado', 'sha256'), 'hex'));

  -- 2) IN_APPROVAL document naming the OUTSIDE-commission approver 0005 (pending).
  insert into public.controlled_documents
    (commission_id, code, title, doc_type, review_cycle_months, status, created_by)
  values
    (v_comm_a, 'DOC-0002', 'POP de Isolamento de Contato', 'pop', 24, 'in_approval', v_chefe)
  returning id into v_doc_apr;

  insert into public.controlled_document_versions
    (document_id, version_number, storage_path, summary_of_changes_md, status, created_by)
  values
    -- storage_path NULL on purpose (BUG-DOC-002 — no real bytes seedable; see header).
    (v_doc_apr, 1, null,
     'Primeira versão para aprovação.', 'in_approval', v_chefe)
  returning id into v_ver_apr;

  update public.controlled_documents set current_version_id = v_ver_apr where id = v_doc_apr;

  -- Pending approvals: one in-commission (staff1), one OUTSIDE-commission same-hospital (chefe.farm).
  -- The pending rows GRANT chefe.farm read of ONLY this document (the approver-read arm).
  insert into public.document_approvals
    (document_version_id, approver_id, approver_title)
  values
    (v_ver_apr, v_staff1, 'Enfermeira CCIH'),
    (v_ver_apr, v_farm, 'Diretor Técnico');

  perform set_config('app.in_controlled_docs_rpc', 'off', true);
  perform set_config('request.jwt.claims', '', true);
end $cd$;

-- ---------------------------------------------------------------------------
-- Administrativo delegation (ADR 0061). staff2.ccih (…04), a plain staff member
-- of commission A (CCIH), is appointed Administrativo with ALL FOUR capabilities
-- so the manager UI + E2E have a ready persona. Seeded via DIRECT INSERT (the seed
-- runs as the RLS-exempt owner, bypassing the guarded DEFINER doors + the internal
-- auth.uid() gates, which is null in seed context). The `administrativo` feature
-- flag stays OFF (seeded false by the migration) — app.member_can is flag-aware, so
-- these grants stay DORMANT until the flag is flipped ON for manual verification /
-- E2E. The audit triggers fire and record the appointment + grants.
-- ---------------------------------------------------------------------------
insert into public.commission_administrativos (commission_id, user_id, appointed_by)
values ('a0000000-0000-0000-0000-0000000000a1',   -- CCIH (commission A)
        '00000000-0000-0000-0000-000000000004',   -- staff2.ccih (plain staff of A)
        '00000000-0000-0000-0000-000000000002')   -- appointed by chefe.ccih (coordinator)
on conflict (commission_id, user_id) do nothing;

insert into public.commission_administrativo_capabilities (commission_id, user_id, capability, granted_by)
select 'a0000000-0000-0000-0000-0000000000a1',
       '00000000-0000-0000-0000-000000000004',
       cap,
       '00000000-0000-0000-0000-000000000002'
from unnest(array['schedule_meetings', 'create_cases', 'assign_case_phases', 'view_signoffs']) as cap
on conflict (commission_id, user_id, capability) do nothing;
