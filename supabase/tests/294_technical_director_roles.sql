-- =============================================================================
-- ADR 0094 W4 (T4.1-T4.3) — Diretor Técnico: roles, appointment, invariants.
--
-- The DT is the first consumer of ADR 0094's extensibility posture, so §5 is as
-- important as the authorization sections: it proves the two new roles surface in
-- `public.session_context()` with NO change to that function. If that fails, decision
-- 6 is aspirational and every future role pays the cost the posture was meant to
-- remove.
--
-- §1 catalog · §2 the dark flag · §3 authority (incl. the platform_admin refusal the
-- PO ruled on) · §4 the legal invariants (one physician titular) · §5 extensibility
-- · §6 atomic appointment.
--
-- Mutation-checked by supabase/tests/mutation/w4-technical-director-mutation-audit.sh.
-- =============================================================================

begin;
-- 6 catalog + 3 dark-flag + 6 authority + 7 invariants + 3 extensibility + 4 appointment = 29.
select plan(29);

update app.feature_flags set enabled = true where key in ('audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,  (v->>'sa_x')::uuid  as sa_x,
         (v->>'st_x')::uuid   as st_x,   (v->>'st_x2')::uuid as st_x2,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'org_b')::uuid  as org_b,  (v->>'hosp_b')::uuid as hosp_b
  from ctx;
grant select on k to authenticated;

-- ── Fixture, MADE not borrowed ───────────────────────────────────────────────
-- No bootstrap persona carries a professional category, so a "physician" assertion on
-- a borrowed persona would fail on the category and read like a working guard while
-- proving nothing. st_x is made a PHYSICIAN, st_x2 a NURSE (the discriminating pair),
-- and sa_y an org_admin of org_b so there is a legitimate appointer.
do $$
begin
  update public.profiles set professional_category_id =
    (select id from public.professional_categories where key = 'physician')
   where id = (select st_x from k);
  update public.profiles set professional_category_id =
    (select id from public.professional_categories where key = 'nurse')
   where id = (select st_x2 from k);
  insert into public.memberships (principal_id, organization_id, role)
  values ((select sa_y from k), (select org_b from k), 'org_admin')
  on conflict do nothing;
end $$;

-- =============================================================================
-- §1 — CATALOG
-- =============================================================================

select is(
  (select count(*)::int from unnest(array['technical_director','technical_director_deputy']) r(role)
    where pg_get_constraintdef((select oid from pg_constraint
      where conrelid='public.memberships'::regclass and conname='memberships_role_check'))
      like '%'||r.role||'%'),
  2,
  '1.1 both DT roles are admitted to memberships_role_check');

select is(
  (select count(*)::int from unnest(array['technical_director','technical_director_deputy']) r(role)
    where pg_get_constraintdef((select oid from pg_constraint
      where conrelid='public.memberships'::regclass and conname='memberships_scope_shape'))
      like '%'||r.role||'%'),
  2,
  '1.2 both have a scope-shape arm (a role with no arm falls to `else false`)');

select ok(
  pg_get_constraintdef((select oid from pg_constraint
    where conrelid='public.memberships'::regclass and conname='memberships_scope_shape'))
    -- Postgres normalizes the CASE terminator to uppercase in pg_get_constraintdef.
    ilike '%else false%',
  '1.3 the shape CHECK still terminates in `else false` (unknown role = rejected, not unconstrained)');

select is(
  (select indexdef from pg_indexes
    where schemaname='public' and indexname='memberships_one_technical_director_uq'),
  'CREATE UNIQUE INDEX memberships_one_technical_director_uq ON public.memberships USING btree (hospital_id) WHERE (role = ''technical_director''::text)',
  '1.4 the titular index is UNIQUE per hospital and PARTIAL to the titular role');

select is(
  (select count(*)::int from app.feature_flags where key = 'technical_director'),
  1,
  '1.5 the technical_director flag exists');

select ok(
  has_function_privilege('authenticated', 'public.appoint_technical_director(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.appoint_technical_director(uuid,uuid)', 'EXECUTE'),
  '1.6 appoint_technical_director: authenticated yes, anon no');

-- =============================================================================
-- §2 — THE DARK FLAG CONFERS NOTHING
-- =============================================================================
-- Forced OFF here rather than inherited from the migration order. It WAS inherited
-- while W4 was mid-build; T4.9 (20260905000600) then turned the flag on and these two
-- assertions went red — not because the guarantee broke, but because the fixture was
-- reading a global whose value is now decided elsewhere. A hermetic suite states its
-- own preconditions (the 150_referrals convention).
update app.feature_flags set enabled = false where key = 'technical_director';

select throws_ok(
  format($$select app.grant_role_impl(%L, 'hospital', %L, 'technical_director', %L)$$,
         (select sa_y from k), (select hosp_b from k), (select st_x from k)),
  '23514', null,
  '2.1 FLAG DARK: an otherwise-valid appointment is refused');

select is(
  (select count(*)::int from public.memberships where role like 'technical_director%'),
  0,
  '2.2 FLAG DARK: ...and no DT membership exists');

-- Revoke deliberately carries NO flag check: turning the feature off must never
-- strand an existing appointment beyond the administrators who granted it.
select lives_ok(
  format($$select app.revoke_role_impl(%L, 'hospital', %L, 'technical_director', %L)$$,
         (select sa_y from k), (select hosp_b from k), (select st_x from k)),
  '2.3 FLAG DARK: revoke still works (a dark flag must not strand an appointment)');

update app.feature_flags set enabled = true where key = 'technical_director';

-- =============================================================================
-- §3 — AUTHORITY
-- =============================================================================

select lives_ok(
  format($$select app.grant_role_impl(%L, 'hospital', %L, 'technical_director', %L)$$,
         (select sa_y from k), (select hosp_b from k), (select st_x from k)),
  '3.1 an org_admin of the hospital''s org CAN appoint a physician titular');

select is(
  (select role from public.memberships
    where hospital_id = (select hosp_b from k) and principal_id = (select st_x from k)),
  'technical_director',
  '3.2 ...and the grant landed as a hospital-tier row');

-- ⛔ THE PO RULING (2026-08-04): platform_admin may NOT appoint a Diretor Técnico.
-- Appointment is a tenant governance act with legal weight, not tenancy
-- administration, so the noun rule's tenancy arm does not reach it. This is the only
-- grant arm in the kernel with no is_admin_for branch — assert it, or a future
-- "consistency" edit will quietly add one.
select throws_ok(
  format($$select app.grant_role_impl(%L, 'hospital', %L, 'technical_director_deputy', %L)$$,
         (select admin from k), (select hosp_b from k), (select st_x from k)),
  '42501', null,
  '3.3 PO RULING: a platform_admin CANNOT appoint the technical direction');

select throws_ok(
  format($$select app.grant_role_impl(%L, 'hospital', %L, 'technical_director_deputy', %L)$$,
         (select sa_x from k), (select hosp_b from k), (select st_x from k)),
  '42501', null,
  '3.4 a commission staff_admin cannot appoint the technical direction');

-- ⚠ The actor must be a PHYSICIAN for this to measure the self-grant arm at all.
-- The physician check lives inside the DT arm and therefore runs BEFORE the kernel's
-- self-grant rule, so a non-physician self-appointment raises HC0G3 and the assertion
-- would pass while testing an entirely different guard (authz-handoff §7.1, the
-- wrong-arm fixture).
update public.profiles set professional_category_id =
  (select id from public.professional_categories where key = 'physician')
 where id = (select sa_y from k);
-- ...and the role must be the DEPUTY (unbounded): 3.1 already filled the titular
-- slot, so a titular self-appointment raises HC0G4 first. Each guard in the arm masks
-- every guard after it, which is exactly why a deny-code assertion has to name the
-- guard it means.
select throws_ok(
  format($$select app.grant_role_impl(%L, 'hospital', %L, 'technical_director_deputy', %L)$$,
         (select sa_y from k), (select hosp_b from k), (select sa_y from k)),
  '42501', null,
  '3.5 self-appointment is denied even for an eligible physician appointer');

-- POSITIVE TWIN for 3.3/3.4: the arm is not simply refusing everyone — a
-- hospital_admin of THIS hospital is a legitimate appointer.
do $$
begin
  insert into public.memberships (principal_id, organization_id, hospital_id, role)
  values ((select st_x2 from k), (select org_b from k), (select hosp_b from k), 'hospital_admin')
  on conflict do nothing;
end $$;
select lives_ok(
  format($$select app.grant_role_impl(%L, 'hospital', %L, 'technical_director_deputy', %L)$$,
         (select st_x2 from k), (select hosp_b from k), (select st_x from k)),
  '3.6 POSITIVE TWIN: a hospital_admin of THIS hospital can appoint a deputy');

-- =============================================================================
-- §4 — THE LEGAL INVARIANTS
-- =============================================================================

-- Physician requirement, resolved on the category VALUE (`key`), not its pt-BR label.
select throws_ok(
  format($$select app.grant_role_impl(%L, 'hospital', %L, 'technical_director_deputy', %L)$$,
         (select sa_y from k), (select hosp_b from k), (select st_x2 from k)),
  'HC0G3', null,
  '4.1 PHYSICIAN: a nurse is refused the technical direction');

-- The twin that makes 4.1 mean something: the SAME principal becomes eligible the
-- moment their category becomes physician. Without this, an arm that refused everyone
-- would pass 4.1.
update public.profiles set professional_category_id =
  (select id from public.professional_categories where key = 'physician')
 where id = (select st_x2 from k);
select lives_ok(
  format($$select app.grant_role_impl(%L, 'hospital', %L, 'technical_director_deputy', %L)$$,
         (select sa_y from k), (select hosp_b from k), (select st_x2 from k)),
  '4.2 POSITIVE TWIN: the same principal IS accepted once their category is physician');

-- ...and the category must be ACTIVE, so a retired category cannot confer eligibility.
-- ⚠ sa_x must be given the physician category FIRST. Without it the join in the
-- physician check fails on the MISSING category and raises HC0G3 whatever is_active
-- says — the assertion would pass while testing nothing, and dropping `and
-- pc.is_active` from the kernel would leave it green. The W4 mutation audit caught
-- exactly that; this line is the fix.
update public.profiles set professional_category_id =
  (select id from public.professional_categories where key = 'physician')
 where id = (select sa_x from k);
update public.professional_categories set is_active = false where key = 'physician';
select throws_ok(
  format($$select app.grant_role_impl(%L, 'hospital', %L, 'technical_director_deputy', %L)$$,
         (select sa_y from k), (select hosp_b from k), (select sa_x from k)),
  'HC0G3', null,
  '4.3 PHYSICIAN: an INACTIVE physician category does not confer eligibility');
update public.professional_categories set is_active = true where key = 'physician';

-- Deputies are unbounded — two of them coexist (st_x from 3.6, st_x2 from 4.2).
select is(
  (select count(*)::int from public.memberships
    where hospital_id = (select hosp_b from k) and role = 'technical_director_deputy'),
  2,
  '4.4 deputies are UNBOUNDED (two coexist for one hospital)');

-- One titular per hospital, refused at the door with a readable code...
-- (sa_x already carries the physician category, set before 4.3.)
select throws_ok(
  format($$select app.grant_role_impl(%L, 'hospital', %L, 'technical_director', %L)$$,
         (select sa_y from k), (select hosp_b from k), (select sa_x from k)),
  'HC0G4', null,
  '4.5 ONE TITULAR: a second titular is refused at the door (HC0G4, not a raw 23505)');

-- ...and by the INDEX underneath it, which is the real guarantee. A door-only rule is
-- bypassable by any future service-role writer; W3's whole lesson is that they appear.
select throws_ok(
  format($$insert into public.memberships (principal_id, organization_id, hospital_id, role)
           values (%L, %L, %L, 'technical_director')$$,
         (select sa_x from k), (select org_b from k), (select hosp_b from k)),
  '23505', null,
  '4.6 ONE TITULAR: raw DML is refused by memberships_one_technical_director_uq');

-- Scope shape: a DT row is hospital-tier; a commission-scoped one is rejected.
select throws_ok(
  format($$insert into public.memberships (principal_id, commission_id, role)
           values (%L, %L, 'technical_director')$$,
         (select sa_x from k), (select comm_x from k)),
  '23514', null,
  '4.7 SCOPE: a commission-scoped technical_director is rejected by the shape CHECK');

-- =============================================================================
-- §5 — EXTENSIBILITY (ADR 0094 decision 6) — the posture, proven
-- =============================================================================
-- session_context() was written in W2 with no knowledge of these roles. If the DT
-- grants surface through it unchanged, the "generic over roles" claim is real.

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from jsonb_array_elements(public.session_context()->'grants') g
    where g->>'role' = 'technical_director'),
  1,
  '5.1 EXTENSIBILITY: the DT grant surfaces in session_context() with NO change to it');

select is(
  (select g->'hospital'->>'id'
     from jsonb_array_elements(public.session_context()->'grants') g
    where g->>'role' = 'technical_director'),
  (select hosp_b::text from k),
  '5.2 ...carrying its hospital reference, like every other hospital-tier grant');
reset role;

-- The DT gains NO committee content reach from the role itself (decision 9). st_x is
-- a bootstrap member of comm_x, so assert on a commission they are NOT in.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select app.is_member_of((select comm_x from k))
     from k limit 1) is not null, true,
  '5.3 sanity: the membership predicate is callable for the DT principal');
reset role;

-- =============================================================================
-- §6 — ATOMIC APPOINTMENT (T4.3)
-- =============================================================================

-- sa_x (physician) replaces st_x as titular, through the wrapper, as a legitimate
-- appointer. Both events must land, or neither.
select test_helpers.claims_for((select sa_y from k), false, 'org_admin');
set local role authenticated;
select lives_ok(
  format($$select public.appoint_technical_director(%L, %L)$$,
         (select hosp_b from k), (select sa_x from k)),
  '6.1 appoint_technical_director replaces the incumbent titular');
reset role;

select is(
  (select principal_id from public.memberships
    where hospital_id = (select hosp_b from k) and role = 'technical_director'),
  (select sa_x from k),
  '6.2 the appointee IS the titular');

select is(
  (select count(*)::int from public.memberships
    where hospital_id = (select hosp_b from k) and role = 'technical_director'),
  1,
  '6.3 ...and exactly one titular remains (the incumbent was revoked, not accumulated)');

-- The handover is two attributable audit events, not one ambiguous mutation.
select ok(
  (select count(*) from public.audit_log
    where entity_type = 'membership'
      and action in ('membership.revoked','membership.granted')
      and (metadata->>'role') = 'technical_director') >= 2,
  '6.4 the handover emits both membership.revoked and membership.granted (Rule 11)');

select * from finish();
rollback;
