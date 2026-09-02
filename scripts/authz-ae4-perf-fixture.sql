-- ============================================================================
-- AE4 PERFORMANCE ACCEPTANCE — SCALED FIXTURE LOADER
--
--   Obligation:  FUP-AE4-PERFORMANCE-EVIDENCE-ON-THE-FINAL-PATH (audit IA-F9)
--   Acceptance:  docs/design/authz-ae4-performance-acceptance.md   <- READ FIRST
--   Teardown:    scripts/authz-ae4-perf-teardown.sql               <- ALWAYS PAIRED
--   Harness:     scripts/authz-ae4-perf-harness.sql
--
-- RUN IT (repo root, on a FRESH `supabase db reset --local`, EXCLUSIVE stack):
--
--   docker exec -i supabase_db_azkbbhskturikxpgmafq \
--     psql -U postgres -d postgres -X -f - \
--     < scripts/authz-ae4-perf-fixture.sql
--
-- ============================================================================
-- ⛔ THIS FILE IS NOT PART OF THE SEED CONTRACT.
--    `supabase db reset` does NOT apply it.  It lives in scripts/ (beside
--    scripts/authz-explain-baselines-ae0.sql, the AE0.2 precedent) and NOT in
--    supabase/tests/, because `supabase test db` sweeps supabase/tests for
--    pg_prove and every subdirectory there holds deliberately non-.sql
--    artifacts (mutation/*.sh, vectors/*.json).  A .sql file under
--    supabase/tests is reserved for the numbered pgTAP suite.
--
-- ⛔ THIS FILE `ANALYZE`s THE DATABASE.  That is REQUIRED by the acceptance
--    (a statistics-free plan is a default-estimate guess) and it PERMANENTLY
--    BREAKS COMPARABILITY WITH THE AE0.2 BASELINES, which are defined on a
--    never-ANALYZEd database.  The two cannot coexist on one instance.  After
--    the AE4 run, `supabase db reset --local` restores the AE0 condition.
--
-- ⛔ TRIGGERS ARE DISABLED FOR THE LOAD — and that is a correctness
--    requirement, not an optimisation.  `public.memberships` carries
--    `trg_audit_memberships`, a FOR EACH ROW trigger that appends to the
--    HASH-CHAINED `public.audit_log`.  Loading ~49 000 memberships would
--    append ~49 000 links to a tamper-evident chain that `verify_audit_chain`
--    and the audit pgTAP suites assert over — and an append-only chain cannot
--    be un-appended by the teardown.  The fixture would then be IRREVERSIBLE.
--    So the audit + seeding triggers are disabled inside the load transaction
--    (ALTER TABLE is transactional: if this file aborts, the disable rolls
--    back with everything else) and re-enabled before COMMIT.  The DERIVATION
--    and GUARD triggers stay ON, so every fixture row is valid under exactly
--    the rules production enforces.
--    Bound this creates, stated: fixture rows have no `audit_log` history and
--    fixture commissions have no default meeting types / member titles.
--    Nothing on the measured chain reads either (see the acceptance doc §2).
--
-- ⛔ THE STACK MUST BE OWNED EXCLUSIVELY.  ALTER TABLE ... DISABLE TRIGGER
--    takes ACCESS EXCLUSIVE on memberships / commissions / the four form
--    tables for the duration of the load.
-- ============================================================================

\set ON_ERROR_STOP on
\timing on
\pset pager off

-- ---------------------------------------------------------------------------
-- Scale — every number here is justified per-axis in the acceptance doc §3.
-- Change one and the doc's §3 justification and §6 pass conditions must move
-- with it; the harness re-reads them from ae4perf.fixture_meta, so a silent
-- edit here is caught by the harness's fixture-census gate, not by review.
-- ---------------------------------------------------------------------------
\set N_ORG        10
\set N_HOSP_ORG   12
\set N_COMM_HOSP  8
\set N_USER       12000
\set N_MB_USER    4
\set N_PROF       10000
\set N_FORM       40
\set N_VER_FORM   2
\set N_SEC_VER    8
\set N_ITEM_SEC   25
\set N_FANOUT     20

-- ⛔ ONE bcrypt call for the whole fixture.  Inlining `crypt(... gen_salt ...)`
--    in the INSERT would put a VOLATILE function in the target list and
--    Postgres would evaluate it PER ROW — 12 000 bcrypt hashes, tens of
--    minutes, for a value no one is ever meant to know.  \gset evaluates it
--    exactly once, here.
select crypt('ae4perf-unknowable-' || gen_random_uuid()::text, gen_salt('bf')) as pw
\gset ae4perf_


begin;

-- --------------------------------------------------------------------------
-- 0. Guard: refuse to load twice.  A double load would double every
--    cardinality and silently invalidate the declared scale factor.
-- --------------------------------------------------------------------------
do $$
begin
  if to_regnamespace('ae4perf') is not null then
    raise exception
      'AE4 perf fixture is ALREADY LOADED (schema ae4perf exists). Run scripts/authz-ae4-perf-teardown.sql first.';
  end if;
end $$;

create schema ae4perf;
comment on schema ae4perf is
  'AE4 performance-acceptance fixture bookkeeping. NOT part of the seed contract; dropped by scripts/authz-ae4-perf-teardown.sql.';

-- Deterministic identity.  Every fixture row''s primary key is a pure function
-- of (kind, ordinal), so the teardown deletes BY IDENTITY — it enumerates the
-- same ordinals and deletes exactly those ids.  ⛔ No positional delete, no
-- uuid range predicate, no "delete the newest N": a positional cleanup eats
-- seed rows that ~900 E2E tests depend on.
create function ae4perf.pid(p_kind text, p_n bigint) returns uuid
  language sql immutable as $$ select md5('ae4perf:' || p_kind || ':' || p_n)::uuid $$;

create table ae4perf.fixture_meta(k text primary key, v text not null);

-- --------------------------------------------------------------------------
-- 1. Side-effect triggers OFF (see the header for why this is required).
-- --------------------------------------------------------------------------
alter table public.memberships   disable trigger trg_audit_memberships;
alter table public.commissions   disable trigger audit_commissions_trg;
alter table public.commissions   disable trigger seed_meetings_on_commission_insert_trg;
alter table public.commissions   disable trigger seed_member_titles_on_commission_insert_trg;
alter table public.forms         disable trigger audit_forms_trg;
alter table public.form_versions disable trigger audit_form_versions_trg;
alter table public.form_sections disable trigger audit_form_sections_trg;
alter table public.form_items    disable trigger audit_form_items_trg;

-- --------------------------------------------------------------------------
-- 2. Tenancy — 10 orgs x 12 hospitals x 8 commissions = 960 commissions.
--    `scope_reaches` walks commission -> hospital -> organization on EVERY
--    assignment fact, so these three tables are read per fact per protected
--    row.  They are scaled for that reason and no other.
-- --------------------------------------------------------------------------
insert into public.organizations (id, name, slug)
select ae4perf.pid('org', g),
       format('AE4 Perf Rede P%s', lpad(g::text, 2, '0')),
       format('ae4perf-org-%s', g)
from generate_series(1, :N_ORG) g;

insert into public.hospitals (id, organization_id, name, slug)
select ae4perf.pid('hosp', (o - 1) * :N_HOSP_ORG + h),
       ae4perf.pid('org', o),
       format('AE4 Perf Hospital %s-%s', o, h),
       format('ae4perf-hosp-%s-%s', o, h)
from generate_series(1, :N_ORG) o, generate_series(1, :N_HOSP_ORG) h;

insert into public.commissions (id, name, slug, hospital_id, organization_id)
select ae4perf.pid('comm', (hh - 1) * :N_COMM_HOSP + c),
       format('AE4 Perf Comissao %s-%s', hh, c),
       format('ae4perf-comm-%s-%s', hh, c),
       ae4perf.pid('hosp', hh),
       ae4perf.pid('org', ((hh - 1) / :N_HOSP_ORG) + 1)
from generate_series(1, :N_ORG * :N_HOSP_ORG) hh, generate_series(1, :N_COMM_HOSP) c;

-- --------------------------------------------------------------------------
-- 3. People.  `handle_new_user` (AFTER INSERT on auth.users) writes the
--    matching public.profiles row with is_admin = false — that trigger stays
--    ENABLED, so the fixture principals are ordinary non-admin accounts by
--    exactly the production mechanism.
--
--    ⛔ NOT LOGINABLE BY DESIGN.  One bcrypt hash is computed once, of a
--    random secret that is discarded — no fixture account has a knowable
--    password, and the addresses are under the reserved `.invalid` TLD.
-- --------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
)
select '00000000-0000-0000-0000-000000000000',
       ae4perf.pid('user', g),
       'authenticated', 'authenticated',
       format('ae4perf-%s@perf.invalid', g),
       :'ae4perf_pw',
       now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', format('AE4 Perf Pessoa %s', g)),
       now(), now(), '', '', '', ''
from generate_series(1, :N_USER) g;

-- --------------------------------------------------------------------------
-- 4. Memberships — the input to authz.assignment_facts.
--
--    4a. THE MEASURED PRINCIPAL, user #1: exactly 20 rows (N_FANOUT), of
--        which EXACTLY ONE can grant anything the acceptance measures.
--        ⛔ ZERO org_admin and ZERO hospital_admin rows: those two roles are
--        the ONLY inputs to app.is_tenancy_admin_of_for, which is the ONLY
--        other arm of app.can_edit_commission_forms.  Their absence is what
--        makes "the permission arm is the only grant path" a property of the
--        PRINCIPAL rather than of the session hat.  (The hat would also
--        suppress them — app.has_role's self-check requires the acting role
--        to equal the granted role — but relying on that would make the
--        property an accident of the claims payload.  Belt and braces.)
--        The other 19 rows are `staff` / `staff_admin` at other commissions
--        and three hospital-scope roles; none of them holds
--        commission.forms.edit, org.professionals.create or
--        org.professionals.read in authz.role_permissions, and the four
--        foreign `staff_admin` rows are in org 10 so `scope_reaches` returns
--        FALSE for them at the measured scope.  They exist to give
--        authz.entailed_grants a realistic inner-loop length.
-- --------------------------------------------------------------------------

-- 4a-i  the ONE granting row: staff_admin of the measured commission (comm 1)
insert into public.memberships (id, principal_id, commission_id, role)
values (ae4perf.pid('mb-target', 1), ae4perf.pid('user', 1), ae4perf.pid('comm', 1), 'staff_admin');

-- 4a-ii 12 x `staff` at sibling commissions of the same hospital/org region
insert into public.memberships (id, principal_id, commission_id, role)
select ae4perf.pid('mb-fanout', k), ae4perf.pid('user', 1), ae4perf.pid('comm', 1 + k), 'staff'
from generate_series(1, 12) k;

-- 4a-iii 4 x `staff_admin` in ORG 10 — grants the permission at THOSE
--        commissions, never at the measured one.  scope_reaches must reject
--        each of them, per protected row.
insert into public.memberships (id, principal_id, commission_id, role)
select ae4perf.pid('mb-fanout', 100 + k), ae4perf.pid('user', 1), ae4perf.pid('comm', 900 + k), 'staff_admin'
from generate_series(1, 4) k;

-- 4a-iv 3 x hospital-scope roles that grant nothing measured here
insert into public.memberships (id, principal_id, organization_id, hospital_id, role)
values
  (ae4perf.pid('mb-fanout', 201), ae4perf.pid('user', 1), ae4perf.pid('org', 1), ae4perf.pid('hosp', 1), 'quality_reviewer'),
  (ae4perf.pid('mb-fanout', 202), ae4perf.pid('user', 1), ae4perf.pid('org', 1), ae4perf.pid('hosp', 2), 'pqs_member'),
  (ae4perf.pid('mb-fanout', 203), ae4perf.pid('user', 1), ae4perf.pid('org', 1), ae4perf.pid('hosp', 3), 'technical_director_deputy');

-- 4b. Bulk commission roster — users 2..N_USER, 4 commissions each, spaced
--     240 apart so the four are always distinct (memberships_one_commission_
--     role_uq is UNIQUE(principal_id, commission_id)).
--     ~50 members per commission across 960 commissions.
insert into public.memberships (id, principal_id, commission_id, role)
select ae4perf.pid('mb-bulk', (g - 2)::bigint * :N_MB_USER + k),
       ae4perf.pid('user', g),
       ae4perf.pid('comm', ((g + k * 240 - 1) % (:N_ORG * :N_HOSP_ORG * :N_COMM_HOSP)) + 1),
       case when k = 0 and g % 8 = 0 then 'staff_admin' else 'staff' end
from generate_series(2, :N_USER) g, generate_series(0, :N_MB_USER - 1) k;

-- 4c. Hospital-scope roles — 6 per hospital, principals drawn from a band
--     that EXCLUDES user 1.  memberships_one_technical_director_uq permits
--     one technical_director per hospital; one is what this writes.
insert into public.memberships (id, principal_id, organization_id, hospital_id, role)
select ae4perf.pid('mb-hosp', (hh - 1) * 6 + r.k),
       ae4perf.pid('user', 11000 + ((hh - 1) * 6 + r.k)),
       ae4perf.pid('org', ((hh - 1) / :N_HOSP_ORG) + 1),
       ae4perf.pid('hosp', hh),
       r.role
from generate_series(1, :N_ORG * :N_HOSP_ORG) hh
cross join (values (1,'hospital_admin'), (2,'nsp_coordinator'), (3,'pqs_member'),
                   (4,'technical_director'), (5,'technical_director_deputy'),
                   (6,'quality_reviewer')) as r(k, role);

-- 4d. Org-scope roles — 2 per org, again from a band that excludes user 1.
insert into public.memberships (id, principal_id, organization_id, role)
select ae4perf.pid('mb-org', (o - 1) * 2 + r.k),
       ae4perf.pid('user', 10000 + (o - 1) * 2 + r.k),
       ae4perf.pid('org', o),
       r.role
from generate_series(1, :N_ORG) o
cross join (values (1,'org_admin'), (2,'nsp_org_admin')) as r(k, role);

-- --------------------------------------------------------------------------
-- 5. Protected rows, axis 1 — professional_profiles in the MEASURED org.
--    public.professional_profiles carries exactly ONE permissive SELECT
--    policy (professional_profiles_select), whose predicate is
--    app.can_read_professional_profile(id, auth.uid()).  So an unfiltered
--    read evaluates the full layer-3 -> 2 -> 1 chain once PER ROW, with no
--    sibling policy able to short-circuit it.  This is the F9 mechanism made
--    directly measurable.
--    link_state 'no_account' + user_id NULL keeps professional_profiles_
--    link_state_coherent satisfied and creates no auth linkage.
-- --------------------------------------------------------------------------
insert into public.professional_profiles (id, organization_id, full_name, link_state)
select ae4perf.pid('prof', g),
       ae4perf.pid('org', 1),
       format('AE4 Perf Profissional %s', g),
       'no_account'
from generate_series(1, :N_PROF) g;

-- --------------------------------------------------------------------------
-- 6. Protected rows, axis 2 — the form tree of the MEASURED commission.
--    All versions are `draft`: guard_published_structure blocks INSERT and
--    UPDATE on the children of a published version, so a published fixture
--    version could neither be loaded nor measured on the write path.
-- --------------------------------------------------------------------------
insert into public.forms (id, commission_id, title)
select ae4perf.pid('form', f), ae4perf.pid('comm', 1), format('AE4 Perf Formulario %s', f)
from generate_series(1, :N_FORM) f;

insert into public.form_versions (id, form_id, version_number, status)
select ae4perf.pid('ver', (f - 1) * :N_VER_FORM + v), ae4perf.pid('form', f), v, 'draft'
from generate_series(1, :N_FORM) f, generate_series(1, :N_VER_FORM) v;

insert into public.form_sections (id, form_version_id, position, title, is_default)
select ae4perf.pid('sec', (vv - 1) * :N_SEC_VER + s),
       ae4perf.pid('ver', vv),
       s,
       format('AE4 Perf Secao %s', s),
       (s = 1)
from generate_series(1, :N_FORM * :N_VER_FORM) vv, generate_series(1, :N_SEC_VER) s;

insert into public.form_items (id, section_id, form_version_id, position, item_type, question_key, label)
select ae4perf.pid('item', ((vv - 1) * :N_SEC_VER + s - 1)::bigint * :N_ITEM_SEC + i),
       ae4perf.pid('sec', (vv - 1) * :N_SEC_VER + s),
       ae4perf.pid('ver', vv),
       i,
       'short_text',
       format('q%s_%s', s, i),
       format('AE4 Perf Pergunta %s.%s', s, i)
from generate_series(1, :N_FORM * :N_VER_FORM) vv,
     generate_series(1, :N_SEC_VER) s,
     generate_series(1, :N_ITEM_SEC) i;

-- --------------------------------------------------------------------------
-- 7. Manifest — the scale the harness must find, and the identities the
--    teardown must remove.  The harness ABORTS if the live census disagrees
--    with these numbers: a fixture that did not fully load cannot reach the
--    failing state the acceptance is written against.
-- --------------------------------------------------------------------------
insert into ae4perf.fixture_meta(k, v) values
  ('loaded_at',            now()::text),
  ('n_org',                (:N_ORG)::text),
  ('n_hosp',               (:N_ORG * :N_HOSP_ORG)::text),
  ('n_comm',               (:N_ORG * :N_HOSP_ORG * :N_COMM_HOSP)::text),
  ('n_user',               (:N_USER)::text),
  ('n_prof',               (:N_PROF)::text),
  ('n_form',               (:N_FORM)::text),
  ('n_ver',                (:N_FORM * :N_VER_FORM)::text),
  ('n_sec',                (:N_FORM * :N_VER_FORM * :N_SEC_VER)::text),
  ('n_item',               (:N_FORM * :N_VER_FORM * :N_SEC_VER * :N_ITEM_SEC)::text),
  ('n_fanout',             (:N_FANOUT)::text),
  ('principal_id',         ae4perf.pid('user', 1)::text),
  ('principal_email',      'ae4perf-1@perf.invalid'),
  ('principal_hat',        'staff_admin'),
  ('target_commission_id', ae4perf.pid('comm', 1)::text),
  ('target_org_id',        ae4perf.pid('org', 1)::text),
  ('target_hospital_id',   ae4perf.pid('hosp', 1)::text),
  ('target_form_id',       ae4perf.pid('form', 1)::text),
  ('target_version_id',    ae4perf.pid('ver', 1)::text),
  ('target_profile_id',    ae4perf.pid('prof', 1)::text),
  -- The legacy-arm comparison principal for pass condition P5: org_admin of
  -- the measured org, which reaches the same rows through
  -- app.is_tenancy_admin_of_for and NEVER through the permission arm.
  ('legacy_principal_id',  ae4perf.pid('user', 10001)::text),
  ('legacy_principal_hat', 'org_admin');

-- --------------------------------------------------------------------------
-- 8. Triggers back ON, inside the same transaction.
-- --------------------------------------------------------------------------
alter table public.memberships   enable trigger trg_audit_memberships;
alter table public.commissions   enable trigger audit_commissions_trg;
alter table public.commissions   enable trigger seed_meetings_on_commission_insert_trg;
alter table public.commissions   enable trigger seed_member_titles_on_commission_insert_trg;
alter table public.forms         enable trigger audit_forms_trg;
alter table public.form_versions enable trigger audit_form_versions_trg;
alter table public.form_sections enable trigger audit_form_sections_trg;
alter table public.form_items    enable trigger audit_form_items_trg;

-- Fail loudly if any of the eight is still disabled — a fixture that leaves
-- the audit trigger off would silently un-audit every later membership write.
do $$
declare v_off text;
begin
  select string_agg(c.relname || '.' || t.tgname, ', ')
    into v_off
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and not t.tgisinternal
     and t.tgenabled = 'D'
     and c.relname in ('memberships','commissions','forms','form_versions','form_sections','form_items');
  if v_off is not null then
    raise exception 'AE4 fixture would leave triggers DISABLED: %', v_off;
  end if;
end $$;

commit;


-- ============================================================================
-- 9. ANALYZE — required by the acceptance.  ⛔ This is the step that breaks
--    AE0.2 comparability (see the header).  Only the tables the
--    catalog-verified chain reads are analyzed; nothing else is touched.
-- ============================================================================
analyze public.memberships;
analyze public.profiles;
analyze public.commissions;
analyze public.hospitals;
analyze public.organizations;
analyze public.professional_profiles;
analyze public.professional_participants;
analyze public.case_participants;
analyze public.forms;
analyze public.form_versions;
analyze public.form_sections;
analyze public.form_items;
analyze authz.roles;
analyze authz.role_permissions;
analyze authz.permissions;
analyze authz.permission_implication_closure;


-- ============================================================================
-- 10. Post-load census — printed for the record and re-asserted by the
--     harness.  `audit_log` MUST be unchanged from its pre-load value: that
--     is the reversibility claim, and it is the reason section 1 exists.
-- ============================================================================
\echo ''
\echo '=== AE4 perf fixture: post-load census ==='
select 'memberships' as t, count(*) from public.memberships
union all select 'profiles',                  count(*) from public.profiles
union all select 'auth.users',                count(*) from auth.users
union all select 'organizations',             count(*) from public.organizations
union all select 'hospitals',                 count(*) from public.hospitals
union all select 'commissions',               count(*) from public.commissions
union all select 'professional_profiles',     count(*) from public.professional_profiles
union all select 'forms',                     count(*) from public.forms
union all select 'form_versions',             count(*) from public.form_versions
union all select 'form_sections',             count(*) from public.form_sections
union all select 'form_items',                count(*) from public.form_items
union all select 'audit_log (MUST be unchanged)', count(*) from public.audit_log
order by 1;

\echo ''
\echo '=== ANALYZE state (every row must show a last_analyze timestamp) ==='
select c.relname, c.reltuples::bigint as reltuples, s.last_analyze
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_all_tables s on s.relid = c.oid
where (n.nspname = 'public' and c.relname in
        ('memberships','profiles','commissions','hospitals','professional_profiles',
         'forms','form_versions','form_sections','form_items'))
   or (n.nspname = 'authz' and c.relname in
        ('roles','role_permissions','permissions','permission_implication_closure'))
order by 1;

\echo ''
\echo '=== Fixture manifest ==='
select k, v from ae4perf.fixture_meta order by k;

\echo ''
\echo '=== AE4 perf fixture loaded. Next: scripts/authz-ae4-perf-harness.sql ==='
