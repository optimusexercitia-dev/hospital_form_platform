-- BUG-AUTHZ-001 keystone — the dashboard DEFINER gate admits commission/org admins and
-- NOT platform_admin (migration 20260903000700).
--
-- WHY THIS FILE EXISTS. The bug survived because nothing asserted the property. The
-- census behind ADR 0078 A35 read `pg_policies`, and `responses`' policies were correct
-- — the leak was a SECURITY DEFINER gate, which a policy-shaped audit is structurally
-- blind to (ADR 0078's own documented blind spot: `prosecdef` belongs beside
-- `pg_policies`). The full 4301-test pgTAP suite passed both before and after the fix.
-- So these are written to be MUTATION-FALSIFIABLE: revert the migration and t3/t4/t7
-- go red.
--
-- ⚠ THE GATE DENIES BY `return;`, NOT BY RAISING. Denial and "allowed but no matching
-- data" are the SAME observable: zero rows. Every deny assertion below is therefore
-- paired with a non-vacuity assertion proving the identical call yields rows for a
-- permitted caller — without that pair, `is(count, 0)` passes on an empty fixture and
-- proves nothing.
--
-- COVERAGE HONESTY: five functions changed, but only `dashboard_export_rows` and
-- `dashboard_distributions` return non-zero rows for a plain multiple_choice/checkbox
-- form. `matrix_cells` / `risk_scores` / `entity_references` need matrix/reference items
-- and would return 0 rows even when PERMITTED — a behavioural deny test on those three
-- would be vacuous by construction, so they are covered by the catalog invariant (t7/t8)
-- instead. That is a real limit of this file, stated rather than papered over.

begin;
select plan(8);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

create temp table ids on commit drop as
  select gen_random_uuid() as form_d,
         gen_random_uuid() as ver_d,
         gen_random_uuid() as sec_flat,
         gen_random_uuid() as it_mc;
grant select on ids to authenticated;

-- --------------------------------------------------------------------------
-- Fixture: one published form in comm_x with a single multiple_choice item and
-- one submitted standalone response.
-- --------------------------------------------------------------------------
insert into public.forms (id, commission_id, title, created_by)
select i.form_d, k.comm_x, 'AUTHZ-001 Gate Form', k.sa_x from ids i, k;

insert into public.form_versions (id, form_id, version_number, status)
select i.ver_d, i.form_d, 1, 'draft' from ids i;

insert into public.form_sections (id, form_version_id, position, is_default)
select i.sec_flat, i.ver_d, 0, true from ids i;

insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
select i.it_mc, i.sec_flat, 0, 'multiple_choice', 'g_mc', 'MC?', true from ids i;
insert into public.form_item_options (item_id, position, code, label)
select i.it_mc, 0, 'sim', 'Sim' from ids i
union all select i.it_mc, 1, 'nao', 'Não' from ids i;

select public.publish_form_version((select ver_d from ids));

select set_config('app.in_submit_rpc', 'on', true);
create temp table rs on commit drop as select gen_random_uuid() as r1;
grant select on rs to authenticated;

insert into public.responses (id, form_version_id, commission_id, created_by, status, submitted_at)
select rs.r1, i.ver_d, k.comm_x, k.st_x, 'submitted', now() - interval '1 day' from rs, ids i, k;

insert into public.answers (response_id, item_id, question_key, value, group_instance_id)
select rs.r1, i.it_mc, 'g_mc', null::jsonb, null::uuid from rs, ids i;

insert into public.answer_selected_options (answer_id, option_id)
select a.id, o.id
from public.answers a, rs, ids i
join public.form_item_options o on o.item_id = i.it_mc and o.code = 'sim'
where a.response_id = rs.r1 and a.item_id = i.it_mc;
select set_config('app.in_submit_rpc', 'off', true);

-- --------------------------------------------------------------------------
-- Tenancy: give comm_x an org, and make sa_y (who is NOT a member of comm_x)
-- its org_admin. `admin` is deliberately left OUT of this org — it is a bare
-- platform_admin, which is exactly the persona the noun rule constrains.
--
-- If `admin` were accidentally an org member, t3/t4 would return rows and FAIL.
-- The mis-setup direction is a red test, never a vacuous green.
-- --------------------------------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('00000000-0000-0000-0000-0000000a0001', 'Org AuthZ001', 'org-authz-001');
insert into public.hospitals (id, organization_id, name, slug) values
  ('00000000-0000-0000-0000-0000000b0001', '00000000-0000-0000-0000-0000000a0001', 'Hosp AuthZ001', 'hosp-authz-001');
update public.commissions set hospital_id = '00000000-0000-0000-0000-0000000b0001'
  where id = (select comm_x from k);
insert into public.memberships (organization_id, principal_id, role)
select '00000000-0000-0000-0000-0000000a0001', k.sa_y, 'org_admin' from k;

-- ==========================================================================
-- t1/t2 — NON-VACUITY. The staff_admin of comm_x (the arm that never changed)
-- reads real rows through both functions, so the zero-row assertions below are
-- meaningful.
-- ==========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.dashboard_export_rows((select form_d from ids))),
  1,
  'NON-VACUITY ⭐: staff_admin of the commission reads the 1 submitted row via dashboard_export_rows');
select cmp_ok(
  (select count(*)::int from public.dashboard_distributions((select form_d from ids))),
  '>', 0,
  'NON-VACUITY ⭐: staff_admin reads a non-empty dashboard_distributions for the same form');
reset role;

-- ==========================================================================
-- t3/t4 — THE KEYSTONE. A bare platform_admin reads NOTHING. Revert migration
-- 20260903000700 and these two go red — that is the whole point of the file.
--
-- dashboard_export_rows is the sharp one: it returns per-response answers plus
-- the member's NAME, not an aggregate, so platform_admin reach here was a direct
-- contradiction of CLAUDE.md's noun rule ("may NOT touch commission content").
-- ==========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select is(
  (select count(*)::int from public.dashboard_export_rows((select form_d from ids))),
  0,
  'KEYSTONE ⭐: platform_admin reads ZERO response rows via dashboard_export_rows (noun rule)');
select is(
  (select count(*)::int from public.dashboard_distributions((select form_d from ids))),
  0,
  'KEYSTONE ⭐: platform_admin reads ZERO via dashboard_distributions (noun rule)');
reset role;

-- ==========================================================================
-- t5/t6 — the OTHER half of the unification. Before the fix these five functions
-- admitted platform_admin but DENIED org_admin/hospital_admin, while the other
-- four dashboard functions admitted them — so an org_admin saw Totais and Texto
-- livre but took an empty Exportar/Distribuições. A live access gap nobody filed.
-- ==========================================================================
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.dashboard_export_rows((select form_d from ids))),
  1,
  'NEW ARM ⭐: org_admin of the owning org NOW reads the submitted row via dashboard_export_rows');
select cmp_ok(
  (select count(*)::int from public.dashboard_distributions((select form_d from ids))),
  '>', 0,
  'NEW ARM ⭐: org_admin NOW reads a non-empty dashboard_distributions');
reset role;

-- ==========================================================================
-- t7/t8 — CATALOG INVARIANT across ALL nine dashboard functions, covering the
-- three that cannot be tested behaviourally here (see the header note).
--
-- t8 is the non-vacuity guard for t7: both are "no function matches X" claims,
-- which an empty population satisfies by construction. The first draft of the
-- migration looked in schema `app` (where the authz HELPERS live) instead of
-- `public` (where the dashboard functions live) and would have passed on zero
-- rows while changing nothing.
-- ==========================================================================
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'dashboard\_%'
     and pg_get_functiondef(p.oid) ~ 'app\.is_admin\(\)'),
  0,
  'INVARIANT ⭐: zero public.dashboard_* functions carry the app.is_admin() arm');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'dashboard\_%'
     and pg_get_functiondef(p.oid) ~ 'app\.is_commission_admin_of\('),
  9,
  'INVARIANT ⭐ (+ non-vacuity for t7): all NINE public.dashboard_* functions carry the is_commission_admin_of arm');

select * from finish();
rollback;
