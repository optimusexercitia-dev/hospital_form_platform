-- BUG-AUTHZ-001 keystone — the dashboard DEFINER gate admits commission/org admins and
-- NOT platform_admin (migration 20260903000700).
--
-- QO·A REWRITE (ADR 0100 D11, migration 20260911000400): the ONE-uniform-gate
-- contract is now a TWO-CLASS contract. Six AGGREGATE doors additionally admit an
-- oversight quality_reviewer via app.can_read_quality_dashboards; the three
-- ROW-LEVEL doors (export_rows, free_text, completion_by_member) do NOT. §9
-- below holds the class boundary from the catalog — it is the ONLY guard on the
-- D11 six/three split, and q1-quality-mutation-audit.sh case `arm_seventh_door`
-- proves it can fail (arming a row-level door reds t10). Behavioural depth for
-- the reviewer lives in 309; this file pins the boundary + one live pair.
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
select plan(15);

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
-- ⛔ INVERTED BY QO·B M5 (20260915000400). This asserted that an org_admin NOW reads the
-- submitted row — the unification that made all nine doors uniform. ADR 0100 D12 splits
-- them again, on a different axis: the tenancy admin KEEPS the six PHI-free AGGREGATES
-- and LOSES the three ROW-LEVEL doors (export_rows / free_text / completion_by_member),
-- which are the same three D11 already closed to the quality_reviewer. The aggregate half
-- of the unification survives and is asserted by the very next line, so this inversion
-- narrows the claim rather than abandoning it.
select is(
  (select count(*)::int from public.dashboard_export_rows((select form_d from ids))),
  0,
  'QO·B WALL ⭐: org_admin no longer reads the submitted row via dashboard_export_rows (ROW-LEVEL door, D12)');
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
  6,
  'INVARIANT ⭐ (+ non-vacuity for t7): the SIX AGGREGATE dashboard doors carry the is_commission_admin_of arm — QO·B M5 cut it from the three ROW-LEVEL doors (was 9 of 9 before the D12 split)');

-- The other side of the two-class contract, asserted by NAME so the split cannot drift
-- into the wrong three doors while the counts still add up.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('dashboard_export_rows','dashboard_free_text','dashboard_completion_by_member')
     and pg_get_functiondef(p.oid) ~ 'app\.is_commission_admin_of\('),
  0,
  'INVARIANT ⭐ QO·B: and the three ROW-LEVEL doors carry it ZERO times — named explicitly, because a bare count of 6 is satisfied by cutting ANY three');

-- ==========================================================================
-- t9/t10 — THE QO·A TWO-CLASS BOUNDARY (ADR 0100 D11), from the catalog and
-- comment-stripped (§7.2 — a prosrc regex happily counts comments). t9 is an
-- ARRAY equality: a seventh armed door, a missing sixth, or a renamed door all
-- red it. t10 is the row-level half; t9's non-empty result is its non-vacuity
-- guard (same regex, 6 hits — the pattern provably finds arms).
-- ==========================================================================
select is(
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}'::text[])
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'dashboard\_%'
     and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'can_read_quality_dashboards'),
  array['dashboard_distributions','dashboard_entity_references','dashboard_form_totals',
        'dashboard_matrix_cells','dashboard_risk_scores','dashboard_submissions_over_time'],
  'TWO-CLASS ⭐⭐: EXACTLY the six aggregate doors carry the quality_reviewer arm (D11 — the boundary''s only structural guard)');

select is(
  (select count(*)::int
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('dashboard_export_rows','dashboard_free_text','dashboard_completion_by_member')
     and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'can_read_quality_dashboards'),
  0,
  'TWO-CLASS ⭐: the three ROW-LEVEL doors carry ZERO trace of the reviewer arm');

-- ==========================================================================
-- t11/t12 — one LIVE pair on this file's own fixture: a reviewer of the
-- fixture hospital, commission opted in. Distributions opens (aggregate),
-- export_rows stays shut (row-level) — the same calls t1/t2 prove non-vacuous
-- for the staff_admin.
-- ==========================================================================
create temp table qr270 on commit drop as select gen_random_uuid() as qr;
grant select on qr270 to authenticated;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', qr, 'authenticated', 'authenticated',
       qr || '@test', now(), now() from qr270;
-- Clear the t5/t6 claims: the identity-column guard refuses this patch from a
-- non-service SESSION; the superuser fixture path needs auth.uid() null.
select test_helpers.claims_for(null, false);
update public.profiles set home_organization_id = '00000000-0000-0000-0000-0000000a0001'
  where id = (select qr from qr270);
insert into public.memberships (organization_id, hospital_id, principal_id, role)
select '00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-0000000b0001',
       qr, 'quality_reviewer' from qr270;
select set_config('app.in_commission_rpc', 'on', true);
update public.commissions set quality_oversight = 'visible' where id = (select comm_x from k);
select set_config('app.in_commission_rpc', 'off', true);

select test_helpers.claims_for((select qr from qr270), false);
set local role authenticated;
select cmp_ok(
  (select count(*)::int from public.dashboard_distributions((select form_d from ids))),
  '>', 0,
  'REVIEWER ARM ⭐: an oversight reviewer reads a non-empty dashboard_distributions (aggregate class open)');

select is(
  (select count(*)::int from public.dashboard_export_rows((select form_d from ids))),
  0,
  'REVIEWER ARM ⭐: the same reviewer takes ZERO rows from dashboard_export_rows (row-level class shut)');
reset role;

-- ==========================================================================
-- t13 — the M5 no-property-loss invariant, held by the suite instead of a
-- one-shot migration check: all nine doors keep prosecdef AND both original
-- admin arms (a rebuild that dropped either would pass a green build).
-- ==========================================================================
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'dashboard\_%'
     and p.prosecdef
     and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'app\.is_staff_admin_of'
     and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'app\.is_commission_admin_of'),
  6,
  'REBUILD GUARD ⭐: the six AGGREGATE doors keep SECURITY DEFINER + both admin arms (QO·B M5 removed the tenancy arm from the three ROW-LEVEL doors; was 9)');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'dashboard\_%'
     and p.prosecdef
     and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ 'app\.is_staff_admin_of'),
  9,
  'REBUILD GUARD ⭐ QO·B: ...and ALL NINE still keep SECURITY DEFINER + the committee''s own is_staff_admin_of arm — M5 removed the tenancy disjunct ONLY, never a door''s DEFINER property');

select * from finish();
rollback;
