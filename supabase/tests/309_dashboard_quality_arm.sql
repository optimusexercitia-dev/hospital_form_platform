-- =============================================================================
-- QO·A keystones — the two-class dashboard contract (M5; ADR 0100 D11).
--
-- Six AGGREGATE doors admit an oversight reviewer; three ROW-LEVEL doors
-- (export_rows / free_text / completion_by_member — per-response rows, member
-- names) stay closed. ⚠ Every dashboard door denies by EMPTY `return;`, so every
-- zero-row deny below is PAIRED with the identical call returning rows for a
-- permitted caller (270's in-file discipline) — without the pair, is(count,0)
-- passes on an empty fixture and proves nothing.
--
-- COVERAGE HONESTY (the 270 precedent, kept): only distributions / form_totals /
-- submissions_over_time / export_rows / free_text / completion_by_member return
-- rows for this fixture's item types. matrix_cells / risk_scores /
-- entity_references would be 0 rows even when PERMITTED — a behavioural test
-- there is vacuous by construction; they are covered by 270's rewritten
-- two-class CATALOG invariant + the q1 mutation (force the helper true / arm a
-- seventh door).
-- =============================================================================

begin;
select plan(15);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'org_b')::uuid  as org_b,
         (v->>'hosp_b')::uuid as hosp_b
  from ctx;
grant select on k to authenticated;

create temp table p on commit drop as
  select gen_random_uuid() as qr, gen_random_uuid() as qr_f,
         gen_random_uuid() as org2, gen_random_uuid() as hosp3;
grant select on p to authenticated;

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.id || '@test', now(), now()
from (select qr as id from p union all select qr_f from p) u;

insert into public.organizations (id, name, slug)
select org2, 'Org QO5 Foreign', 'org-qo5-' || substr(org2::text, 1, 8) from p;
insert into public.hospitals (id, organization_id, name, slug)
select hosp3, org2, 'Hosp QO5 Foreign', 'hosp-qo5-' || substr(hosp3::text, 1, 8) from p;

update public.profiles pr set home_organization_id = (select org_b from k)
  where pr.id = (select qr from p);
update public.profiles pr set home_organization_id = (select org2 from p)
  where pr.id = (select qr_f from p);

insert into public.memberships (organization_id, hospital_id, principal_id, role)
select k.org_b, k.hosp_b, p.qr,   'quality_reviewer' from k, p union all
select p.org2,  p.hosp3,  p.qr_f, 'quality_reviewer' from p;

select set_config('app.in_commission_rpc', 'on', true);
update public.commissions set quality_oversight = 'visible' where id = (select comm_x from k);
select set_config('app.in_commission_rpc', 'off', true);

-- Published form in comm_x: one multiple_choice + one free_text; one submitted
-- response answering both (mirrors 270's fixture + the free-text lane).
create temp table ids on commit drop as
  select gen_random_uuid() as form_d, gen_random_uuid() as ver_d,
         gen_random_uuid() as sec_d, gen_random_uuid() as it_mc,
         gen_random_uuid() as it_ft, gen_random_uuid() as r1;
grant select on ids to authenticated;

insert into public.forms (id, commission_id, title, created_by)
select i.form_d, k.comm_x, 'QO Dashboard Form', k.sa_x from ids i, k;
insert into public.form_versions (id, form_id, version_number, status)
select i.ver_d, i.form_d, 1, 'draft' from ids i;
insert into public.form_sections (id, form_version_id, position, is_default)
select i.sec_d, i.ver_d, 0, true from ids i;
insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
select i.it_mc, i.sec_d, 0, 'multiple_choice', 'qo_mc', 'MC?', true from ids i;
insert into public.form_item_options (item_id, position, code, label)
select i.it_mc, 0, 'sim', 'Sim' from ids i
union all select i.it_mc, 1, 'nao', 'Não' from ids i;
insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
select i.it_ft, i.sec_d, 1, 'free_text', 'qo_ft', 'Comente', false from ids i;
select public.publish_form_version((select ver_d from ids));

select set_config('app.in_submit_rpc', 'on', true);
insert into public.responses (id, form_version_id, commission_id, created_by, status, submitted_at)
select i.r1, i.ver_d, k.comm_x, k.st_x, 'submitted', now() - interval '1 day' from ids i, k;
insert into public.answers (response_id, item_id, question_key, value, group_instance_id)
select i.r1, i.it_mc, 'qo_mc', null::jsonb, null::uuid from ids i;
insert into public.answer_selected_options (answer_id, option_id)
select a.id, o.id
from public.answers a
join ids i on a.response_id = i.r1 and a.item_id = i.it_mc
join public.form_item_options o on o.item_id = i.it_mc and o.code = 'sim';
insert into public.answers (response_id, item_id, question_key, value, group_instance_id)
select i.r1, i.it_ft, 'qo_ft', to_jsonb('paciente estável'::text), null::uuid from ids i;
select set_config('app.in_submit_rpc', 'off', true);

-- =============================================================================
-- §1 — THE SIX-AGGREGATE ARM ADMITS THE REVIEWER (behavioural where the
-- fixture can produce rows) + aggregate PARITY with the coordinator.
-- =============================================================================

select test_helpers.claims_for((select qr from p), false);
set local role authenticated;
select cmp_ok(
  (select count(*)::int from public.dashboard_distributions((select form_d from ids))),
  '>', 0,
  '1.1 ARM ⭐: the reviewer reads a non-empty dashboard_distributions on a VISIBLE commission');

select cmp_ok(
  (select count(*)::int from public.dashboard_form_totals((select comm_x from k))),
  '>', 0,
  '1.2 ARM: dashboard_form_totals (the p_commission_id-shaped door) admits the reviewer');

select cmp_ok(
  (select count(*)::int from public.dashboard_submissions_over_time((select form_d from ids))),
  '>', 0,
  '1.3 ARM: dashboard_submissions_over_time admits the reviewer');

reset role;

create temp table qr_dist_n (n int) on commit drop;
grant all on qr_dist_n to authenticated;
select test_helpers.claims_for((select qr from p), false);
set local role authenticated;
insert into qr_dist_n
  select count(*)::int from public.dashboard_distributions((select form_d from ids));
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select n from qr_dist_n),
  (select count(*)::int from public.dashboard_distributions((select form_d from ids))),
  '1.4 PARITY: the reviewer sees the SAME aggregate the coordinator sees — the arm is a gate, not a filtered projection');

-- =============================================================================
-- §2 — NON-VACUITY twins for §3: the same three row-level calls DO return rows
-- for the staff_admin (deny = empty return; a zero without this pair is noise).
-- =============================================================================

select is(
  (select count(*)::int from public.dashboard_export_rows((select form_d from ids))),
  1,
  '2.1 NON-VACUITY ⭐: staff_admin reads the 1 submitted row via dashboard_export_rows');

select cmp_ok(
  (select count(*)::int from public.dashboard_free_text((select form_d from ids))),
  '>', 0,
  '2.2 NON-VACUITY: staff_admin reads the free-text lane');

select cmp_ok(
  (select count(*)::int from public.dashboard_completion_by_member((select form_d from ids))),
  '>', 0,
  '2.3 NON-VACUITY: staff_admin reads completion_by_member');
reset role;

-- =============================================================================
-- §3 — THE ROW-LEVEL CLASS STAYS CLOSED (D11).
-- =============================================================================

select test_helpers.claims_for((select qr from p), false);
set local role authenticated;
select is(
  (select count(*)::int from public.dashboard_export_rows((select form_d from ids))),
  0,
  '3.1 ROW-LEVEL CLOSED ⭐⭐ (D11): the reviewer takes ZERO rows from dashboard_export_rows (per-response answers + member names)');

select is(
  (select count(*)::int from public.dashboard_free_text((select form_d from ids))),
  0,
  '3.2 ROW-LEVEL CLOSED: dashboard_free_text serves the reviewer nothing');

select is(
  (select count(*)::int from public.dashboard_completion_by_member((select form_d from ids))),
  0,
  '3.3 ROW-LEVEL CLOSED: dashboard_completion_by_member serves the reviewer nothing');
reset role;

-- =============================================================================
-- §4 — BOUNDARIES of the aggregate arm.
-- =============================================================================

select set_config('app.in_commission_rpc', 'on', true);
update public.commissions set quality_oversight = 'excluded' where id = (select comm_x from k);
select set_config('app.in_commission_rpc', 'off', true);

select test_helpers.claims_for((select qr from p), false);
set local role authenticated;
select is(
  (select count(*)::int from public.dashboard_distributions((select form_d from ids))),
  0,
  '4.1 EXCLUDED COMMISSION ⭐: opting out closes the aggregate arm immediately');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select cmp_ok(
  (select count(*)::int from public.dashboard_distributions((select form_d from ids))),
  '>', 0,
  '4.2 ...while the coordinator''s own dashboards are untouched by the classification');
reset role;

select set_config('app.in_commission_rpc', 'on', true);
update public.commissions set quality_oversight = 'visible' where id = (select comm_x from k);
select set_config('app.in_commission_rpc', 'off', true);

select test_helpers.claims_for((select qr_f from p), false);
set local role authenticated;
select is(
  (select count(*)::int from public.dashboard_distributions((select form_d from ids))),
  0,
  '4.3 TENANCY: a foreign-org reviewer takes zero from every armed door');
reset role;

update public.memberships m set expires_at = now() - interval '1 hour'
  where m.principal_id = (select qr from p) and m.role = 'quality_reviewer';
select test_helpers.claims_for((select qr from p), false);
set local role authenticated;
select is(
  (select count(*)::int from public.dashboard_distributions((select form_d from ids))),
  0,
  '4.4 EXPIRED: an expired reviewer is no reviewer at the dashboard door either');
reset role;
update public.memberships m set expires_at = null
  where m.principal_id = (select qr from p) and m.role = 'quality_reviewer';

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.dashboard_export_rows((select form_d from ids))),
  0,
  '4.5 CONTROL: plain staff still takes zero from a row-level door (the pre-existing boundary survived M5)');
reset role;

select * from finish();
rollback;
